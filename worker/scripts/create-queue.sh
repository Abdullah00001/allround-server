#!/bin/bash
set -e

# Ensure a queue name was provided
if [ -z "$1" ]; then
  echo "❌ Error: Please provide a queue name (e.g., npm run create:queue email)"
  exit 1
fi

QUEUE_NAME=$1
QUEUE_DIR="worker/src/app/queues/$QUEUE_NAME"
JOBS_DIR="$QUEUE_DIR/jobs"

# Check if directory already exists
if [ -d "$QUEUE_DIR" ]; then
  echo "❌ Error: Queue module '$QUEUE_NAME' already exists in $QUEUE_DIR"
  exit 1
fi

# Create the directory
mkdir -p "$JOBS_DIR"

# Convert kebab-case to PascalCase for interfaces/variables
QUEUE_PASCAL=$(echo "$QUEUE_NAME" | awk -F- '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2))}1' OFS="")
QUEUE_CAMEL="$(tr '[:upper:]' '[:lower:]' <<< ${QUEUE_PASCAL:0:1})${QUEUE_PASCAL:1}"

# 1. Create the types file
cat > "$QUEUE_DIR/$QUEUE_NAME.types.ts" <<EOF
// Types specific to the $QUEUE_NAME queue can be defined here
// export interface I${QUEUE_PASCAL}JobData { ... }
EOF

# 2. Create the queue instance file
cat > "$QUEUE_DIR/$QUEUE_NAME.queue.ts" <<EOF
import { Queue } from 'bullmq';
import { createQueueOptions } from '@/app/configs/queue.configs';

let _${QUEUE_CAMEL}Queue: Queue | null = null;

export const get${QUEUE_PASCAL}Queue = (): Queue => {
  if (!_${QUEUE_CAMEL}Queue) {
    _${QUEUE_CAMEL}Queue = new Queue('${QUEUE_NAME}-queue', createQueueOptions());
  }
  return _${QUEUE_CAMEL}Queue;
};
EOF

# 3. Create the workers file with dynamic job discovery
cat > "$QUEUE_DIR/$QUEUE_NAME.workers.ts" <<EOF
import { Job, Worker } from 'bullmq';
import fs from 'fs';
import path from 'path';

import logger from '@/app/configs/logger.configs';
import { getRedisClient } from '@/app/configs/redis.configs';
import { IJobHandler } from '@/app/@types/queue.types';

export const create${QUEUE_PASCAL}Worker = (): Worker => {
  // Dynamically load all job handlers from the jobs/ directory
  const handlers: Record<string, IJobHandler> = {};
  const jobsDir = path.join(__dirname, 'jobs');

  if (fs.existsSync(jobsDir)) {
    const files = fs.readdirSync(jobsDir).filter(f => f.endsWith('.job.ts') || f.endsWith('.job.js'));
    for (const file of files) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const importedModule = require(path.join(jobsDir, file));
      const jobHandler: IJobHandler = importedModule.default || importedModule;
      if (jobHandler && jobHandler.name && typeof jobHandler.handler === 'function') {
        handlers[jobHandler.name] = jobHandler;
        logger.info(\`[Worker] Registered handler for job '\${jobHandler.name}' in queue '${QUEUE_NAME}'\`);
      }
    }
  }

  const worker = new Worker(
    '${QUEUE_NAME}-queue',
    async (job: Job) => {
      const { name, data, id } = job;
      
      const jobHandler = handlers[name];
      if (!jobHandler) {
        throw new Error(\`Unhandled job '\${name}' in queue '${QUEUE_NAME}'\`);
      }

      try {
        await jobHandler.handler(data, job);
      } catch (error) {
        logger.error(\`[\${job.name}] Job failed\`, { jobId: id, error });
        throw error;
      }
    },
    { connection: getRedisClient() as unknown as import('bullmq').ConnectionOptions }
  );

  worker.on('completed', (job: Job) => {
    logger.info(\`[Worker] Job '\${job.name}' (ID: \${job.id}) completed successfully in '${QUEUE_NAME}' queue.\`);
  });

  worker.on('failed', (job: Job | undefined, error: Error) => {
    if (job) {
      logger.error(\`[Worker] Job '\${job.name}' (ID: \${job.id}) failed in '${QUEUE_NAME}' queue.\n\${error.stack}\`);
    } else {
      logger.error(\`[Worker] A job failed in '${QUEUE_NAME}' queue but job data is undefined.\n\${error.stack}\`);
    }
  });

  return worker;
};
EOF


# 5. Mirror the queue interface to the Server and Scheduler so they can produce jobs
SERVER_QUEUE_DIR="server/src/app/queues/$QUEUE_NAME"
SCHEDULER_QUEUE_DIR="scheduler/src/app/queues/$QUEUE_NAME"

mkdir -p "$SERVER_QUEUE_DIR"
mkdir -p "$SCHEDULER_QUEUE_DIR"

# Copy queue instances so producers can enqueue jobs
cp "$QUEUE_DIR/$QUEUE_NAME.queue.ts" "$SERVER_QUEUE_DIR/"
cp "$QUEUE_DIR/$QUEUE_NAME.queue.ts" "$SCHEDULER_QUEUE_DIR/"

# Ensure the server and scheduler have the queue.configs.ts file to support the queue definitions
if [ ! -f "server/src/app/configs/queue.configs.ts" ]; then
  cp "worker/src/app/configs/queue.configs.ts" "server/src/app/configs/queue.configs.ts"
fi
if [ ! -f "scheduler/src/app/configs/queue.configs.ts" ]; then
  cp "worker/src/app/configs/queue.configs.ts" "scheduler/src/app/configs/queue.configs.ts"
fi

echo "✅ Successfully created queue module '$QUEUE_NAME' in $QUEUE_DIR!"
echo "   - $QUEUE_DIR/$QUEUE_NAME.queue.ts"
echo "   - $QUEUE_DIR/$QUEUE_NAME.workers.ts"
echo "   - $QUEUE_DIR/$QUEUE_NAME.types.ts"

echo "✅ Mirrored queue definition into server and scheduler!"
