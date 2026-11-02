const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const sourceDbPath = 'D:/Рабочий стол D/codeready-23/pb_data';
const destDbPath = path.resolve(__dirname, '../pb_data');

console.log('1. Opening source DB:', sourceDbPath);
const db = new DatabaseSync(path.join(sourceDbPath, 'data.db'));

// Clean media
console.log('2. Purging media table...');
db.prepare('DELETE FROM media').run();

// Clean test bookings / guests / chat_logs if any
db.prepare('DELETE FROM bookings').run();
db.prepare('DELETE FROM guests').run();
db.prepare('DELETE FROM chat_logs').run();
db.prepare('DELETE FROM external_bookings').run();
db.prepare('DELETE FROM external_calendar_sources').run();

// Verify cabins
const cabins = db.prepare('SELECT id, name, slug FROM cabins').all();
console.log('3. Cabins in DB:', cabins.map(c => `${c.name} (${c.slug})`));

// Verify app_config mainpage
const mainpage = db.prepare("SELECT value FROM app_config WHERE key = 'mainpage'").get();
if (mainpage) {
  const val = JSON.parse(mainpage.value);
  console.log('4. Mainpage hero title:', val.hero?.title);
  console.log('   Mainpage hero bg:', val.hero?.backgroundImage);
  console.log('   Mainpage logo:', val.header?.logoImage);
}

// Checkpoint and close
console.log('5. Running WAL checkpoint TRUNCATE...');
db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').run();
db.close();

// Also checkpoint auxiliary.db
const auxDb = new DatabaseSync(path.join(sourceDbPath, 'auxiliary.db'));
auxDb.prepare('PRAGMA wal_checkpoint(TRUNCATE)').run();
auxDb.close();

// Clean storage folder in sourceDbPath
const storageDir = path.join(sourceDbPath, 'storage');
if (fs.existsSync(storageDir)) {
  console.log('6. Cleaning storage folder...');
  fs.rmSync(storageDir, { recursive: true, force: true });
  fs.mkdirSync(storageDir, { recursive: true });
}

// Ensure destination pb_data exists and clean it
console.log('7. Copying clean pb_data to cabin-rental-app...');
if (!fs.existsSync(destDbPath)) {
  fs.mkdirSync(destDbPath, { recursive: true });
}

const filesToCopy = ['data.db', 'auxiliary.db', 'types.d.ts'];
for (const file of filesToCopy) {
  const src = path.join(sourceDbPath, file);
  const dst = path.join(destDbPath, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dst);
    console.log(`   Copied ${file} (${fs.statSync(dst).size} bytes)`);
  }
}

// Create clean storage dir in destDbPath
const destStorage = path.join(destDbPath, 'storage');
if (fs.existsSync(destStorage)) {
  fs.rmSync(destStorage, { recursive: true, force: true });
}
fs.mkdirSync(destStorage, { recursive: true });
console.log('   Created clean storage directory.');

console.log('✓ Successfully prepared clean, demo-ready pb_data!');
