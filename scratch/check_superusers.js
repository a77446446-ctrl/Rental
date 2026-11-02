const { DatabaseSync } = require('node:sqlite');

const db = new DatabaseSync('d:/Рабочий стол D/GPT Ai/Projects/eco-gorniy/eco-gorniy/cabin-rental-app/pb_data/data.db', { readOnly: true });
const cols = db.prepare('PRAGMA table_info(_superusers)').all();
console.log('Columns:', cols.map(c => c.name));
const all = db.prepare('SELECT * FROM _superusers').all();
console.log('Rows count:', all.length);
all.forEach(r => console.log('User:', r.id, r.email));
