import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Checking deployment structure...');
console.log('Current directory:', __dirname);

// Check if we're in the right location
if (!__dirname.includes('backend')) {
    console.log('⚠️  Warning: This script should be run from the backend directory');
}

const requiredFiles = [
    'server.js',
    'package.json',
    'package-lock.json'
];

const frontendFiles = [
    '../frontend/index.html',
    '../frontend/script.js', 
    '../frontend/styles.css'
];

let allGood = true;

console.log('\n📁 Checking backend files:');
requiredFiles.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
        console.log(`✅ ${file}`);
    } else {
        console.log(`❌ ${file} - MISSING`);
        allGood = false;
    }
});

console.log('\n📁 Checking frontend files:');
frontendFiles.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
        console.log(`✅ ${file}`);
    } else {
        console.log(`❌ ${file} - MISSING`);
        allGood = false;
    }
});

console.log('\n' + (allGood ? '✅ Deployment structure looks good!' : '❌ Deployment structure has issues!'));
console.log('\n💡 Next steps:');
console.log('1. Run: git add .');
console.log('2. Run: git commit -m "Fixed deployment"');
console.log('3. Run: git push origin main');

process.exit(allGood ? 0 : 1);