const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'public', 'admin', 'login.html');
const html = fs
  .readFileSync(file, 'utf8')
  .replace('/css/admin-mobile.css?v=4', '/css/admin-mobile.css?v=5');

fs.writeFileSync(file, html);
fs.unlinkSync(__filename);
