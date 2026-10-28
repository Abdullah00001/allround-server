const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const askQuestion = (query) => new Promise(resolve => rl.question(query, resolve));

async function main() {
  console.log('✨ Route Removal Script ✨\n');

  const args = process.argv.slice(2);
  let moduleNames = args;

  if (moduleNames.length === 0) {
    const input = await askQuestion('📦 Enter module names to remove (space-separated): ');
    moduleNames = input.split(/\s+/).filter(Boolean);
  }

  if (moduleNames.length === 0) {
    console.error('❌ At least one module name is required.');
    process.exit(1);
  }

  const routesDir = path.join(__dirname, '..', 'src', 'app', 'routes');
  let versions = [];
  
  if (fs.existsSync(routesDir)) {
    versions = fs.readdirSync(routesDir).filter(file => {
      return fs.statSync(path.join(routesDir, file)).isDirectory();
    });
  }

  if (versions.length === 0) {
    console.error(`❌ No route version directories found in ${routesDir}`);
    process.exit(1);
  }

  let selectedVersion = versions[0];
  if (versions.length > 1) {
    console.log('Available versions:');
    versions.forEach((v, i) => console.log(`  ${i + 1}. ${v}`));
    const answer = await askQuestion(`Select version to remove from (1-${versions.length}) [1]: `);
    const index = parseInt(answer) - 1;
    if (!isNaN(index) && versions[index]) {
      selectedVersion = versions[index];
    }
  }
  
  console.log(`\n📌 Target Version: ${selectedVersion}`);

  const indexRoutePath = path.join(routesDir, selectedVersion, 'index.ts');
  if (!fs.existsSync(indexRoutePath)) {
    console.warn(`⚠️ No index.ts found in ${selectedVersion}. Route was not removed.`);
    process.exit(1);
  }

  let content = fs.readFileSync(indexRoutePath, 'utf8');
  let removedCount = 0;

  for (const moduleName of moduleNames) {
    let wasModified = false;

    // Remove Import
    const importRegex = new RegExp(`import\\s+${moduleName}Routes\\s+from\\s+['"]@/app/modules/${moduleName}/${moduleName}.routes['"];?\\s*\\n?`, 'g');
    if (importRegex.test(content)) {
      content = content.replace(importRegex, '');
      wasModified = true;
    }

    // Remove from array (handles with or without trailing comma, and any spaces)
    const arrayItemRegex = new RegExp(`[\\s\\n]*${moduleName}Routes,?`, 'g');
    if (arrayItemRegex.test(content)) {
      content = content.replace(arrayItemRegex, '');
      wasModified = true;
    }

    if (wasModified) {
      console.log(`✅ Removed ${moduleName}Routes from routes/${selectedVersion}/index.ts`);
      removedCount++;
    } else {
      console.log(`⚠️ Module '${moduleName}' was not found in ${selectedVersion}/index.ts`);
    }
  }

  if (removedCount > 0) {
    // Clean up empty lines inside the array to make it look nicer
    content = content.replace(/(\[\s*\n)\s*\n/g, '$1');
    fs.writeFileSync(indexRoutePath, content);
    console.log(`\n🎉 Successfully removed ${removedCount} module(s) from ${selectedVersion}!`);
  }

  rl.close();
}

main().catch(err => {
  console.error("An unexpected error occurred:", err);
  process.exit(1);
});
