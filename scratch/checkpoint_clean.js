const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const pbDataDir = path.resolve(__dirname, 'clean_pb/pb_data');
console.log('Checkpointing clean_pb...');

const db = new DatabaseSync(path.join(pbDataDir, 'data.db'));
db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').run();
db.close();

const aux = new DatabaseSync(path.join(pbDataDir, 'auxiliary.db'));
aux.prepare('PRAGMA wal_checkpoint(TRUNCATE)').run();
aux.close();

console.log('Checkpoint complete. Checking directory:');
fs.readdirSync(pbDataDir).forEach(f => {
  const s = fs.statSync(path.join(pbDataDir, f));
  console.log(` - ${f} (${s.size} bytes)`);
});
