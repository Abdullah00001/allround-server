const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const askQuestion = (query) => new Promise(resolve => rl.question(query, resolve));

async function main() {
  console.log('✨ Version Initialization Script ✨\n');

  const args = process.argv.slice(2);
  let version = args[0];

  if (!version) {
    version = await askQuestion('📦 Enter new version name (e.g., v2): ');
  }

  if (!version) {
    console.error('❌ Version name is required.');
    process.exit(1);
  }

  // 1. Create directory and index.ts
  const versionDir = path.join(__dirname, '..', 'src', 'app', 'routes', version);
  if (fs.existsSync(versionDir)) {
    console.error(`❌ Version '${version}' already exists!`);
    process.exit(1);
  }
  
  fs.mkdirSync(versionDir, { recursive: true });
  
  const indexContent = `import { Router } from 'express';\n\nconst routes: Router[] = [\n \n];\n\nconst ${version}Routes = Router();\n\nroutes.forEach((route) => ${version}Routes.use(route));\n\nexport default ${version}Routes;\n`;
  fs.writeFileSync(path.join(versionDir, 'index.ts'), indexContent);
  console.log(`✅ Created routes/${version}/index.ts`);

  // 2. Update const.ts
  const constPath = path.join(__dirname, '..', 'src', 'const.ts');
  if (fs.existsSync(constPath)) {
    let content = fs.readFileSync(constPath, 'utf8');
    const baseUrlRegex = /(export\s+const\s+baseUrl\s*=\s*\{)([\s\S]*?)(\})/;
    const match = content.match(baseUrlRegex);
    if (match) {
      if (!match[2].includes(`${version}:`)) {
        const replacement = `$1$2  ${version}: '/api/${version}',\n$3`;
        content = content.replace(baseUrlRegex, replacement);
        fs.writeFileSync(constPath, content);
        console.log(`✅ Added ${version} to baseUrl in const.ts`);
      }
    }
  }

  // 3. Update app.ts
  const appPath = path.join(__dirname, '..', 'src', 'app.ts');
  if (fs.existsSync(appPath)) {
    let content = fs.readFileSync(appPath, 'utf8');
    
    // Add import
    const importStatement = `import ${version}Routes from '@/app/routes/${version}';`;
    if (!content.includes(importStatement)) {
      const imports = content.match(/^import .*$/gm);
      if (imports && imports.length > 0) {
        const lastImport = imports[imports.length - 1];
        content = content.replace(lastImport, `${lastImport}\n${importStatement}`);
      } else {
        content = importStatement + '\n' + content;
      }
    }
    
    // Add app.use
    const appUseStatement = `// ${version.toUpperCase()} ROUTES\napp.use(baseUrl.${version}, ${version}Routes);`;
    if (!content.includes(`app.use(baseUrl.${version}`)) {
      const lastBaseUrlMatch = [...content.matchAll(/app\.use\(baseUrl\..*?\);/g)].pop();
      if (lastBaseUrlMatch) {
        const index = lastBaseUrlMatch.index + lastBaseUrlMatch[0].length;
        content = content.slice(0, index) + '\n\n' + appUseStatement + content.slice(index);
      } else {
         content = content.replace(/app\.use\(\(req: Request,\s*res: Response\)\s*=>\s*\{/g, `${appUseStatement}\n\napp.use((req: Request, res: Response) => {`);
      }
      fs.writeFileSync(appPath, content);
      console.log(`✅ Registered ${version}Routes in app.ts`);
    }
  }

  console.log(`\n🎉 Version '${version}' initialized successfully!`);
  rl.close();
}

main().catch(err => {
  console.error("An unexpected error occurred:", err);
  process.exit(1);
});
