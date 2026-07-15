const fs = require('fs');
const path = require('path');

const adminDir = path.join(__dirname, 'public', 'admin');

for (const name of fs.readdirSync(adminDir)) {
  if (!name.endsWith('.html')) continue;
  const file = path.join(adminDir, name);
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/\/css\/admin-mobile\.css\?v=\d+/g, '/css/admin-mobile.css?v=7');
  fs.writeFileSync(file, content);
}

console.log('Successfully bumped admin-mobile.css version to v=7');
