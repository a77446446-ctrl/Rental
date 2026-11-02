const { DatabaseSync } = require('node:sqlite');

const db = new DatabaseSync('d:/Рабочий стол D/GPT Ai/Projects/eco-gorniy/eco-gorniy/cabin-rental-app/pb_data/data.db', { readOnly: true });
const cols = db.prepare('SELECT name, listRule, viewRule, createRule, updateRule, deleteRule FROM _collections').all();
console.log('Collections rules:');
cols.forEach(c => {
  console.log(` - ${c.name}: listRule=${c.listRule}, viewRule=${c.viewRule}`);
});
