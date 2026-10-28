const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const askQuestion = (query) => new Promise(resolve => rl.question(query, resolve));

async function main() {
  console.log('✨ Route Registration Script ✨\n');

  const args = process.argv.slice(2);
  let moduleNames = args;

  if (moduleNames.length === 0) {
    const input = await askQuestion('📦 Enter module names to register (space-separated): ');
    moduleNames = input.split(/\s+/).filter(Boolean);
  }

  if (moduleNames.length === 0) {
    console.error('❌ At least one module name is required.');
    process.exit(1);
  }
  
  // Verify modules exist
  for (const moduleName of moduleNames) {
    const moduleDir = path.join(__dirname, '..', 'src', 'app', 'modules', moduleName);
    if (!fs.existsSync(moduleDir)) {
      console.error(`❌ Module '${moduleName}' does not exist in modules directory!`);
      console.log(`Hint: Use 'npm run create:module ${moduleName}' first.`);
      process.exit(1);
    }
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
    const answer = await askQuestion(`Select version to register to (1-${versions.length}) [1]: `);
    const index = parseInt(answer) - 1;
    if (!isNaN(index) && versions[index]) {
      selectedVersion = versions[index];
    }
  }
  
  console.log(`\n📌 Target Version: ${selectedVersion}`);

  const indexRoutePath = path.join(routesDir, selectedVersion, 'index.ts');
  if (!fs.existsSync(indexRoutePath)) {
    console.warn(`⚠️ No index.ts found in ${selectedVersion}. Route was not registered.`);
    process.exit(1);
  }

  let content = fs.readFileSync(indexRoutePath, 'utf8');
  let registeredCount = 0;

  for (const moduleName of moduleNames) {
    const importStatement = `import ${moduleName}Routes from '@/app/modules/${moduleName}/${moduleName}.routes';`;
    
    if (content.includes(importStatement) || content.includes(`${moduleName}Routes,`)) {
      console.log(`⚠️ Module '${moduleName}' is already registered in ${selectedVersion}/index.ts`);
      continue;
    }
    
    // Inject Import
    const imports = content.match(/^import .*$/gm);
    if (imports && imports.length > 0) {
      const lastImport = imports[imports.length - 1];
      content = content.replace(lastImport, `${lastImport}\n${importStatement}`);
    } else {
      content = importStatement + '\n\n' + content;
    }

    // Inject into routes array
    const routesArrayRegex = /(const\s+routes(?:\s*:\s*Router\[\])?\s*=\s*\[)/;
    if (routesArrayRegex.test(content)) {
      content = content.replace(routesArrayRegex, `$1\n  ${moduleName}Routes,`);
      console.log(`✅ Registered ${moduleName}Routes in routes/${selectedVersion}/index.ts`);
      registeredCount++;
    } else {
      console.warn(`⚠️ Could not auto-register ${moduleName}. The 'const routes: Router[] = []' array was not found.`);
    }
  }

  if (registeredCount > 0) {
    fs.writeFileSync(indexRoutePath, content);
    console.log(`\n🎉 Successfully added ${registeredCount} module(s) to ${selectedVersion}!`);
  }

  rl.close();
}

main().catch(err => {
  console.error("An unexpected error occurred:", err);
  process.exit(1);
});
