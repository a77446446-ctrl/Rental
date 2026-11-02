const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../');
const cleanDir = path.resolve(__dirname, 'clean_pb');
const pbBin = path.join(rootDir, 'pocketbase.exe');

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log('1. Preparing pristine directory:', cleanDir);
  if (fs.existsSync(cleanDir)) {
    fs.rmSync(cleanDir, { recursive: true, force: true });
  }
  fs.mkdirSync(cleanDir, { recursive: true });

  // Copy pocketbase.exe to cleanDir
  fs.copyFileSync(pbBin, path.join(cleanDir, 'pocketbase.exe'));

  // Create superuser via CLI
  console.log('2. Creating superuser via CLI in clean directory...');
  const out = execSync(`"${path.join(cleanDir, 'pocketbase.exe')}" superuser upsert "admin@admin.com" "admin@admin.com"`, {
    cwd: cleanDir
  });
  console.log('CLI output:', out.toString().trim());

  // Start pocketbase on port 8098
  console.log('3. Starting PocketBase on port 8098...');
  const child = spawn(path.join(cleanDir, 'pocketbase.exe'), ['serve', '--http=127.0.0.1:8098'], {
    cwd: cleanDir,
    stdio: 'inherit'
  });

  // Wait for health
  let healthy = false;
  for (let i = 0; i < 20; i++) {
    await sleep(250);
    try {
      const res = await fetch('http://127.0.0.1:8098/api/health');
      if (res.ok) {
        healthy = true;
        break;
      }
    } catch {}
  }

  if (!healthy) {
    console.error('PocketBase failed to start on 8098');
    child.kill();
    process.exit(1);
  }
  console.log('4. PocketBase is healthy on 8098!');

  // Run setup-pocketbase against port 8098
  console.log('5. Running schema & demo setup...');
  process.env.POCKETBASE_URL = 'http://127.0.0.1:8098';
  process.env.POCKETBASE_ADMIN_EMAIL = 'admin@admin.com';
  process.env.POCKETBASE_ADMIN_PASSWORD = 'admin@admin.com';

  const { runSetup } = require('../scripts/setup-pocketbase');
  await runSetup();

  console.log('6. Setup finished! Stopping PocketBase gracefully...');
  child.kill('SIGINT');
  await sleep(1000);

  // Verify DB files
  const pbDataDir = path.join(cleanDir, 'pb_data');
  console.log('7. Files in pb_data:');
  fs.readdirSync(pbDataDir).forEach(f => {
    const s = fs.statSync(path.join(pbDataDir, f));
    console.log(` - ${f} (${s.size} bytes)`);
  });

  console.log('8. SUCCESS! Pristine, uncorrupted database created!');
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
