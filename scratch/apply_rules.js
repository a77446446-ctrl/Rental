const { DatabaseSync } = require('node:sqlite');

const db = new DatabaseSync('d:/Рабочий стол D/GPT Ai/Projects/eco-gorniy/eco-gorniy/cabin-rental-app/pb_data/data.db');
const res = db.prepare("UPDATE _collections SET listRule = '', viewRule = '' WHERE name IN ('cabins', 'prices', 'app_config', 'media')").run();
console.log('Updated collections rules, changes:', res.changes);

db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').run();
db.close();

// Also check
const checkDb = new DatabaseSync('d:/Рабочий стол D/GPT Ai/Projects/eco-gorniy/eco-gorniy/cabin-rental-app/pb_data/data.db', { readOnly: true });
const cols = checkDb.prepare('SELECT name, listRule, viewRule FROM _collections').all();
cols.forEach(c => console.log(` - ${c.name}: listRule="${c.listRule}", viewRule="${c.viewRule}"`));
checkDb.close();
