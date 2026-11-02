const { execSync } = require('child_process');
const path = require('path');
const binaryPath = path.resolve(__dirname, '../pocketbase.exe');
const cwd = path.resolve(__dirname, '../');

try {
  const out1 = execSync(`"${binaryPath}" superuser upsert "admin@admin.com" "admin@admin.com"`, { cwd });
  console.log('superuser upsert stdout:', out1.toString());
} catch (e) {
  console.log('superuser upsert failed:', e.message);
}
