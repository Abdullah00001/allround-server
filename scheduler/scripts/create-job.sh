#!/bin/bash
set -e

# Ensure a job name was provided
if [ -z "$1" ]; then
  echo "❌ Error: Please provide a job name (e.g., npm run create:job email-reminder)"
  exit 1
fi

JOB_NAME=$1
JOB_DIR="scheduler/src/app/jobs/$JOB_NAME"

# Check if directory already exists
if [ -d "$JOB_DIR" ]; then
  echo "❌ Error: Job module '$JOB_NAME' already exists in $JOB_DIR"
  exit 1
fi

# Create the directory
mkdir -p "$JOB_DIR"

# Convert kebab-case to PascalCase for interfaces/variables
JOB_PASCAL=$(echo "$JOB_NAME" | awk -F- '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2))}1' OFS="")
# Convert to camelCase for the job instance
JOB_CAMEL="$(tr '[:upper:]' '[:lower:]' <<< ${JOB_PASCAL:0:1})${JOB_PASCAL:1}"

# Create the types file
cat > "$JOB_DIR/$JOB_NAME.types.ts" <<EOF
// Types specific to the $JOB_NAME module can be defined here
export interface I${JOB_PASCAL}Data {
  // Example property
  // id: string;
}
EOF

# Create the tasks file
cat > "$JOB_DIR/$JOB_NAME.tasks.ts" <<EOF
import { ICronJob } from '@/app/@types/job.types';

const ${JOB_CAMEL}Job: ICronJob = {
  name: '${JOB_NAME}',
  // Run every minute by default
  schedule: '* * * * *',
  execute: async () => {
    // Add your job execution logic here
    console.log('Executing ${JOB_NAME} job...');
  },
};

export default ${JOB_CAMEL}Job;
EOF

echo "✅ Successfully created job module '$JOB_NAME' in $JOB_DIR!"
echo "   - $JOB_DIR/$JOB_NAME.types.ts"
echo "   - $JOB_DIR/$JOB_NAME.tasks.ts"
