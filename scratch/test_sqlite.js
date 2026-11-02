const { DatabaseSync } = require('node:sqlite');

const db = new DatabaseSync('D:/Рабочий стол D/codeready-23/pb_data/data.db');
const mediaRows = db.prepare('SELECT id, file FROM media').all();
console.log('Media rows count:', mediaRows.length);
console.log(mediaRows);
