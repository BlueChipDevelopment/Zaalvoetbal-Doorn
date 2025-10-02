const fs = require('fs');
const path = require('path');

// Markers to locate previously injected block
const INJECTION_MARKER = '// CUSTOM_PUSH_HANDLER_START';
const INJECTION_END_MARKER = '// CUSTOM_PUSH_HANDLER_END';

// Paths
const ngswPath = path.join(__dirname, '../dist/ngsw-worker.js');
const backupPath = path.join(__dirname, '../dist/ngsw-worker.js.backup');
const handlerPublicPath = '/push-handler-sw.js';
const handlerDistPath = path.join(__dirname, '../dist/push-handler-sw.js');

// Generate minimal code that only imports our custom push handler
function generateInjectionCode() {
  return `${INJECTION_MARKER}\n` +
    `try {\n` +
    `  importScripts('${handlerPublicPath}');\n` +
    `} catch (e) {\n` +
    `  console.error('Failed to import custom push handler:', e);\n` +
    `}\n` +
    `${INJECTION_END_MARKER}\n`;
}

function inject() {
  try {
    if (!fs.existsSync(ngswPath)) {
      console.error('ngsw-worker.js not found. Run ng build first.');
      process.exit(1);
    }

    const injectionCode = generateInjectionCode();

    // Read the existing ngsw-worker.js
    let content = fs.readFileSync(ngswPath, 'utf8');

    // Create backup of original service worker once
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(ngswPath, backupPath);
      console.log('📦 Created backup: ngsw-worker.js.backup');
    }

    // Clean previous injected block
    console.log('🧹 Cleaning existing injection from service worker (if any)...');
    const startIdx = content.indexOf(INJECTION_MARKER);
    const endIdx = content.indexOf(INJECTION_END_MARKER);
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      content = content.slice(0, startIdx) + content.slice(endIdx + INJECTION_END_MARKER.length);
      console.log('✅ Removed previous injection');
    }

    // Normalize whitespace
    content = content.replace(/\n\s*\n\s*\n/g, '\n\n').trim();

    // Inject at the beginning
    const injected = injectionCode + '\n\n' + content;
    fs.writeFileSync(ngswPath, injected);

    // Verify
    const verifyContent = fs.readFileSync(ngswPath, 'utf8');
    const hasImport = verifyContent.includes(`importScripts('${handlerPublicPath}')`);
    if (hasImport) {
      console.log('✅ Injected custom push handler import into ngsw-worker.js');
    } else {
      throw new Error('Injection verification failed - importScripts not found');
    }

    // Ensure the handler exists in dist
    if (fs.existsSync(handlerDistPath)) {
      console.log('📄 Found push handler in dist:', handlerDistPath);
    } else {
      console.warn('⚠️ Push handler not found in dist. Ensure it is listed under assets in angular.json');
    }
  } catch (error) {
    console.error('❌ Error injecting custom handler into ngsw-worker.js:', error.message);
    if (fs.existsSync(backupPath)) {
      console.log('🔄 Attempting to restore from backup...');
      try {
        fs.copyFileSync(backupPath, ngswPath);
        console.log('✅ Restored original service worker from backup');
      } catch (restoreError) {
        console.error('❌ Failed to restore backup:', restoreError.message);
      }
    }
    console.error('💥 Build failed due to injection error');
    process.exit(1);
  }
}

// Run the injection
inject();
