#!/bin/bash
set -e

# Ensure queue name and job name were provided
if [ -z "$1" ] || [ -z "$2" ]; then
  echo "❌ Error: Please provide a queue name and a job name"
  echo "Usage: npm run create:queue-job <queue_name> <job_name>"
  echo "Example: npm run create:queue-job email sendWelcome"
  exit 1
fi

QUEUE_NAME=$1
JOB_NAME=$2
QUEUE_DIR="worker/src/app/queues/$QUEUE_NAME"
JOBS_DIR="$QUEUE_DIR/jobs"
JOB_FILE="$JOBS_DIR/$JOB_NAME.job.ts"

# Check if queue directory exists
if [ ! -d "$QUEUE_DIR" ]; then
  echo "❌ Error: Queue module '$QUEUE_NAME' does not exist in $QUEUE_DIR"
  echo "Please create the queue first using: npm run create:queue $QUEUE_NAME"
  exit 1
fi

# Check if job file already exists
if [ -f "$JOB_FILE" ]; then
  echo "❌ Error: Job '$JOB_NAME' already exists in $JOBS_DIR"
  exit 1
fi

JOB_NAME_PASCAL="$(tr '[:lower:]' '[:upper:]' <<< ${JOB_NAME:0:1})${JOB_NAME:1}"
JOB_CONSTANT_KEY=$(echo "$JOB_NAME" | sed 's/\([A-Z]\)/_\1/g' | tr 'a-z' 'A-Z')

# Generate the job handler file
cat > "$JOB_FILE" <<EOF
import { Job } from 'bullmq';
import { IJobHandler } from '@/app/@types/queue.types';
import { I${JOB_NAME_PASCAL} } from '@/app/queues/${QUEUE_NAME}/${QUEUE_NAME}.types';
import { QUEUE_JOBS } from '@/const';

const handler: IJobHandler<I${JOB_NAME_PASCAL}> = {
  name: QUEUE_JOBS.${JOB_CONSTANT_KEY},
  handler: async (data: I${JOB_NAME_PASCAL}, job: Job) => {
    // Write your processing logic here
    console.log(\`Executing \${job.name} with data:\`, data);
  }
};

export default handler;
EOF

TYPES_FILE="$QUEUE_DIR/${QUEUE_NAME}.types.ts"
if [ -f "$TYPES_FILE" ]; then
  echo -e "\nexport interface I${JOB_NAME_PASCAL} {\n  // Add properties here\n}" >> "$TYPES_FILE"
fi

echo "✅ Successfully created job handler '$JOB_NAME' in queue '$QUEUE_NAME'!"
echo "   - $JOB_FILE"

# Automatically register the job key in const.ts files
node worker/scripts/register-queue-job.js "$QUEUE_NAME" "$JOB_NAME"
