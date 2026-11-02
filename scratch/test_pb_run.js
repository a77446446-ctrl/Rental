const { spawn } = require('child_process');
const path = require('path');

function testDir(dir) {
  return new Promise((resolve) => {
    const bin = path.join(dir, 'pocketbase.exe');
    console.log('Testing dir:', dir);
    const p = spawn(bin, ['serve', '--http=127.0.0.1:8099'], { cwd: dir });
    p.stdout.on('data', d => console.log('STDOUT:', d.toString()));
    p.stderr.on('data', d => console.log('STDERR:', d.toString()));
    p.on('error', e => console.log('ERROR:', e.message));
    p.on('close', code => {
      console.log('Exit code:', code);
      resolve();
    });
    setTimeout(() => {
      p.kill();
      resolve();
    }, 1500);
  });
}

async function main() {
  await testDir('d:/Рабочий стол D/GPT Ai/Projects/eco-gorniy/eco-gorniy/cabin-rental-app');
  console.log('---');
  await testDir('D:/Рабочий стол D/GPT Ai/Projects/eco-gorniy/Комерческая копия/universal-rental-platform-v1.0.0');
}

main().catch(console.error);
