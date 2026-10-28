const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node register-queue-job.js <queue-name> <job-name>');
  process.exit(1);
}

const queueName = args[0];
const jobName = args[1]; // Expected to be camelCase, e.g. sendSignupSuccessEmail

// Helper to convert camelCase to kebab-case (e.g. send-signup-success-email)
const toKebabCase = (str) => {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
};

const jobNameKebab = toKebabCase(jobName);

// Create constant key (e.g. SEND_SIGNUP_SUCCESS_EMAIL)
const constantKey = jobNameKebab.toUpperCase().replace(/-/g, '_');

// Use kebab-case string value
const newEntry = `  ${constantKey}: '${jobNameKebab}',\n`;



const targetFiles = [
  path.join(__dirname, '../../server/src/const.ts'),
  path.join(__dirname, '../../worker/src/const.ts'),
  path.join(__dirname, '../../scheduler/src/const.ts'),
];

targetFiles.forEach((file) => {
  if (!fs.existsSync(file)) {
    console.warn(`⚠️ Warning: ${file} does not exist, skipping...`);
    return;
  }

  const content = fs.readFileSync(file, 'utf8');
  
  if (content.includes(`  ${constantKey}:`)) {
    console.log(`ℹ️ Info: Job ${constantKey} already registered in ${path.basename(path.dirname(path.dirname(file)))}/src/const.ts`);
    return;
  }

  const marker = '// AUTO-GENERATED-JOBS-START\n';
  const markerIndex = content.indexOf(marker);

  if (markerIndex === -1) {
    console.warn(`⚠️ Warning: AUTO-GENERATED-JOBS-START marker not found in ${file}`);
    return;
  }

  const insertIndex = markerIndex + marker.length;
  const updatedContent = content.slice(0, insertIndex) + newEntry + content.slice(insertIndex);

  fs.writeFileSync(file, updatedContent, 'utf8');
  console.log(`✅ Registered ${constantKey} in ${path.basename(path.dirname(path.dirname(file)))}/src/const.ts`);
});
