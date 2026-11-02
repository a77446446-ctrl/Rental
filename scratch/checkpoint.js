const { DatabaseSync } = require('node:sqlite');

const db = new DatabaseSync('d:/Рабочий стол D/GPT Ai/Projects/eco-gorniy/eco-gorniy/cabin-rental-app/pb_data/data.db');
db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').run();
db.close();

console.log('Checkpoint OK');
