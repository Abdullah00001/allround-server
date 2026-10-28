const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const askQuestion = (query) => new Promise(resolve => rl.question(query, resolve));

async function main() {
  console.log('✨ Module Creation Script ✨\n');

  const args = process.argv.slice(2);
  let moduleName = args[0];

  if (!moduleName) {
    moduleName = await askQuestion('📦 Enter module name: ');
  }

  if (!moduleName) {
    console.error('❌ Module name is required.');
    process.exit(1);
  }

  // 1. Find versions in server/src/app/routes
  const routesDir = path.join(__dirname, '..', 'src', 'app', 'routes');
  let versions = [];
  
  if (fs.existsSync(routesDir)) {
    versions = fs.readdirSync(routesDir).filter(file => {
      const fullPath = path.join(routesDir, file);
      return fs.statSync(fullPath).isDirectory();
    });
  }

  if (versions.length === 0) {
    console.error(`❌ No route version directories found in ${routesDir}`);
    console.error(`Please create a version directory (e.g., v1) first.`);
    process.exit(1);
  }

  let selectedVersion = versions[0];
  if (versions.length > 1) {
    console.log('Available versions:');
    versions.forEach((v, i) => console.log(`  ${i + 1}. ${v}`));
    const answer = await askQuestion(`Select version (1-${versions.length}) [1]: `);
    const index = parseInt(answer) - 1;
    if (!isNaN(index) && versions[index]) {
      selectedVersion = versions[index];
    }
  }
  
  console.log(`\n📌 Target Version: ${selectedVersion}`);

  // 2. Create Module Directory
  const moduleDir = path.join(__dirname, '..', 'src', 'app', 'modules', moduleName);
  if (fs.existsSync(moduleDir)) {
    console.error(`❌ Module '${moduleName}' already exists in modules directory!`);
    process.exit(1);
  }

  fs.mkdirSync(moduleDir, { recursive: true });

  const controllerAndMiddlewareBoilerplate = `import { Request, Response } from 'express';\nimport { getTraceId } from '@/app/configs/requestContext.configs';\nimport { asyncHandler } from '@/app/utils/system.utils';\n`;

  const routesBoilerplate = `import { Router } from 'express';\n\nconst router = Router();\n\nexport default router;\n`;

  const files = [
    { name: `${moduleName}.controllers.ts`, content: controllerAndMiddlewareBoilerplate },
    { name: `${moduleName}.middlewares.ts`, content: controllerAndMiddlewareBoilerplate },
    { name: `${moduleName}.services.ts`, content: `` },
    { name: `${moduleName}.helpers.ts`, content: `` },
    { name: `${moduleName}.routes.ts`, content: routesBoilerplate },
    { name: `${moduleName}.schema.ts`, content: `` },
    { name: `${moduleName}.dto.ts`, content: `` },
    { name: `${moduleName}.types.ts`, content: `` },
  ];

  files.forEach(file => {
    fs.writeFileSync(path.join(moduleDir, file.name), file.content);
  });
  console.log(`✅ Created 8 files in src/app/modules/${moduleName}`);

  // 3. Auto Register Route in version index.ts
  const indexRoutePath = path.join(routesDir, selectedVersion, 'index.ts');
  if (fs.existsSync(indexRoutePath)) {
    let content = fs.readFileSync(indexRoutePath, 'utf8');
    const importStatement = `import ${moduleName}Routes from '@/app/modules/${moduleName}/${moduleName}.routes';`;
    
    // Inject Import Statement after the last import, or at the top
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
      fs.writeFileSync(indexRoutePath, content);
      console.log(`✅ Auto-registered ${moduleName}Routes in routes/${selectedVersion}/index.ts`);
    } else {
      console.warn(`⚠️ Could not auto-register route. Please manually add ${moduleName}Routes to your routes array in ${selectedVersion}/index.ts`);
    }
  } else {
    console.warn(`⚠️ No index.ts found in ${selectedVersion}. Route was not auto-registered.`);
  }

  console.log(`\n🎉 Module '${moduleName}' created successfully!`);
  rl.close();
}

main().catch(err => {
  console.error("An unexpected error occurred:", err);
  process.exit(1);
});
