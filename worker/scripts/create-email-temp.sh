#!/bin/bash
set -e

if [ -z "$1" ]; then
  read -p "📝 Enter the template name (e.g., welcomeEmail): " TEMP_NAME
  if [ -z "$TEMP_NAME" ]; then
    echo "❌ Error: Template name cannot be empty."
    exit 1
  fi
else
  TEMP_NAME=$1
fi
TEMP_DIR="worker/src/app/templates"
TEMP_FILE="$TEMP_DIR/$TEMP_NAME.template.ts"

# Create the directory if it doesn't exist
mkdir -p "$TEMP_DIR"

# Check if file already exists
if [ -f "$TEMP_FILE" ]; then
  echo "❌ Error: Template '$TEMP_NAME' already exists at $TEMP_FILE"
  exit 1
fi

# Create the template file
cat > "$TEMP_FILE" <<EOF
import { companyInformation } from '@/const';

const ${TEMP_NAME}Template = \`\`;

export default ${TEMP_NAME}Template;
EOF

echo "✅ Successfully created email template '$TEMP_NAME'!"
echo "   - $TEMP_FILE"
