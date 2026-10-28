const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const askQuestion = (query) => new Promise(resolve => rl.question(query, resolve));

async function main() {
  console.log('✨ Endpoint Generation Script ✨\n');

  // Prompt for inputs
  const moduleName = await askQuestion('📦 Target Module Name: ');
  if (!moduleName) { console.error('❌ Module name is required.'); process.exit(1); }

  const moduleDir = path.join(__dirname, '..', 'src', 'app', 'modules', moduleName);
  if (!fs.existsSync(moduleDir)) {
    console.error(`❌ Module '${moduleName}' does not exist!`);
    console.log(`Hint: Use 'npm run create:module ${moduleName}' first.`);
    process.exit(1);
  }

  const controllerName = await askQuestion('⚙️  Controller Name (e.g. createUser): ');
  if (!controllerName) { console.error('❌ Controller name is required.'); process.exit(1); }

  const routePath = await askQuestion('🔗 Route Path (e.g. / or /create) [/]: ') || '/';
  let method = (await askQuestion('🌐 HTTP Method (get, post, put, patch, delete) [post]: ')).toLowerCase() || 'post';
  if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) method = 'post';
  
  const statusCode = await askQuestion('🔢 Status Code [200]: ') || '200';
  const message = await askQuestion('💬 Success Message [Success]: ') || 'Success';

  // File paths
  const serviceFile = path.join(moduleDir, `${moduleName}.services.ts`);
  const controllerFile = path.join(moduleDir, `${moduleName}.controllers.ts`);
  const routeFile = path.join(moduleDir, `${moduleName}.routes.ts`);

  // --- 1. Update Service ---
  let serviceContent = fs.existsSync(serviceFile) ? fs.readFileSync(serviceFile, 'utf8') : '';
  const serviceCode = `\nexport const ${controllerName}Service = async (): Promise<void> => {\n  try {\n    console.log("${controllerName}Service called");\n    return;\n  } catch (error) {\n    throw error;\n  }\n};\n`;
  fs.writeFileSync(serviceFile, serviceContent + serviceCode);
  console.log(`✅ Appended ${controllerName}Service to ${moduleName}.services.ts`);

  // --- 2. Update Controller ---
  let controllerContent = fs.existsSync(controllerFile) ? fs.readFileSync(controllerFile, 'utf8') : '';
  
  // Inject Service Import
  const serviceImport = `import { ${controllerName}Service } from '@/app/modules/${moduleName}/${moduleName}.services';`;
  const imports = controllerContent.match(/^import .*$/gm);
  if (imports && imports.length > 0) {
    const lastImport = imports[imports.length - 1];
    // Check if the file already imports from this module's services
    const serviceImportRegex = new RegExp(`import\\s+\\{([^}]+)\\}\\s+from\\s+['"]@/app/modules/${moduleName}/${moduleName}.services['"];?`);
    const match = controllerContent.match(serviceImportRegex);
    if (match) {
      // Append to existing import
      const existingVars = match[1].split(',').map(s => s.trim());
      if (!existingVars.includes(`${controllerName}Service`)) {
        existingVars.push(`${controllerName}Service`);
        const newImport = `import { ${existingVars.join(', ')} } from '@/app/modules/${moduleName}/${moduleName}.services';`;
        controllerContent = controllerContent.replace(match[0], newImport);
      }
    } else {
      controllerContent = controllerContent.replace(lastImport, `${lastImport}\n${serviceImport}`);
    }
  } else {
    controllerContent = serviceImport + '\n\n' + controllerContent;
  }

  const controllerCode = `\nexport const ${controllerName}Controller = asyncHandler(\n  async (req: Request, res: Response): Promise<void> => {\n    const traceId = getTraceId();\n    await ${controllerName}Service();\n    \n    res.status(${statusCode}).json({\n      success: true,\n      message: '${message}',\n      traceId\n    });\n    return;\n  }\n);\n`;
  fs.writeFileSync(controllerFile, controllerContent + controllerCode);
  console.log(`✅ Appended ${controllerName}Controller to ${moduleName}.controllers.ts`);

  // --- 3. Update Routes ---
  let routeContent = fs.existsSync(routeFile) ? fs.readFileSync(routeFile, 'utf8') : '';
  
  // Inject Controller Import
  const controllerImportRegex = new RegExp(`import\\s+\\{([^}]+)\\}\\s+from\\s+['"]@/app/modules/${moduleName}/${moduleName}.controllers['"];?`);
  const cMatch = routeContent.match(controllerImportRegex);
  if (cMatch) {
    const existingVars = cMatch[1].split(',').map(s => s.trim());
    if (!existingVars.includes(`${controllerName}Controller`)) {
      existingVars.push(`${controllerName}Controller`);
      const newImport = `import { ${existingVars.join(', ')} } from '@/app/modules/${moduleName}/${moduleName}.controllers';`;
      routeContent = routeContent.replace(cMatch[0], newImport);
    }
  } else {
    const rImports = routeContent.match(/^import .*$/gm);
    const cImport = `import { ${controllerName}Controller } from '@/app/modules/${moduleName}/${moduleName}.controllers';`;
    if (rImports && rImports.length > 0) {
      const lastImport = rImports[rImports.length - 1];
      routeContent = routeContent.replace(lastImport, `${lastImport}\n${cImport}`);
    } else {
      routeContent = cImport + '\n\n' + routeContent;
    }
  }

  // Inject Route before 'export default router;'
  const routeCode = `router.route('${routePath}').${method}(${controllerName}Controller);\n\n`;
  const exportRegex = /export\s+default\s+router;?/;
  if (exportRegex.test(routeContent)) {
    routeContent = routeContent.replace(exportRegex, `${routeCode}$&`);
  } else {
    routeContent += `\n${routeCode}`;
  }

  fs.writeFileSync(routeFile, routeContent);
  console.log(`✅ Registered route [${method.toUpperCase()}] '${routePath}' in ${moduleName}.routes.ts`);

  console.log(`\n🎉 Endpoint '${controllerName}' created successfully!`);
  rl.close();
}

main().catch(err => {
  console.error("An unexpected error occurred:", err);
  process.exit(1);
});
