// backend/test-azure.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 Testing Azure deployment structure...');
console.log('==========================================');

// Check current directory
console.log('📁 Current directory:', __dirname);
console.log('');

// List all files in current directory
console.log('📋 Files in current directory:');
try {
  const files = fs.readdirSync(__dirname);
  files.forEach(file => {
    const filePath = path.join(__dirname, file);
    const stats = fs.statSync(filePath);
    console.log(`   ${file} (${stats.isDirectory() ? 'folder' : 'file'})`);
  });
} catch (error) {
  console.log('   ❌ Error reading directory:', error.message);
}
console.log('');

// Check essential files
console.log('✅ Essential file checks:');
const essentialFiles = [
  'server.js',
  'package.json',
  'package-lock.json',
  'services/sharepoint.js',
  'config/auth.js',
  'public/index.html'
];

essentialFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  const exists = fs.existsSync(filePath);
  console.log(`   ${exists ? '✓' : '✗'} ${file}`);
  
  if (!exists && !file.includes('/')) {
    console.log(`      ❌ MISSING: ${file}`);
  }
});
console.log('');

// Check public folder contents
console.log('📁 Public folder contents:');
const publicPath = path.join(__dirname, 'public');
if (fs.existsSync(publicPath)) {
  try {
    const publicFiles = fs.readdirSync(publicPath);
    publicFiles.forEach(file => {
      console.log(`   ${file}`);
    });
    
    // Check if index.html exists
    const indexHtmlPath = path.join(publicPath, 'index.html');
    if (fs.existsSync(indexHtmlPath)) {
      console.log('   ✓ index.html found in public folder');
    } else {
      console.log('   ❌ index.html NOT found in public folder');
    }
  } catch (error) {
    console.log('   ❌ Error reading public folder:', error.message);
  }
} else {
  console.log('   ❌ Public folder does not exist');
}
console.log('');

// Check environment variables
console.log('🔧 Environment variables check:');
const envVars = [
  'PORT',
  'NODE_ENV',
  'SHAREPOINT_CLIENT_ID',
  'SHAREPOINT_CLIENT_SECRET',
  'SHAREPOINT_TENANT_ID'
];

envVars.forEach(envVar => {
  const value = process.env[envVar];
  console.log(`   ${value ? '✓' : '✗'} ${envVar}: ${value ? 'SET' : 'NOT SET'}`);
});
console.log('');

// Test production dependencies
console.log('📦 Production dependencies check:');
try {
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  console.log('   Main script:', packageJson.main || 'Not specified');
  console.log('   Start script:', packageJson.scripts?.start || 'Not specified');
  
  if (packageJson.scripts && packageJson.scripts.start) {
    console.log('   ✓ Start script found in package.json');
  } else {
    console.log('   ❌ No start script in package.json');
  }
} catch (error) {
  console.log('   ❌ Error reading package.json:', error.message);
}
console.log('');

console.log('==========================================');
console.log('✅ Azure deployment test completed');