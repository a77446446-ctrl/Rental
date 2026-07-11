const fs = require('fs');
const path = require('path');

const adminDir = path.join(__dirname, 'public', 'admin');

for (const name of fs.readdirSync(adminDir)) {
  if (!name.endsWith('.html')) continue;
  const file = path.join(adminDir, name);
  const next = fs
    .readFileSync(file, 'utf8')
    .replace(/\/css\/admin-mobile\.css\?v=4/g, '/css/admin-mobile.css?v=5');
  fs.writeFileSync(file, next);
}

fs.unlinkSync(__filename);
