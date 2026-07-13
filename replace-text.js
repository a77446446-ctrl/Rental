const fs = require('fs');
const path = require('path');
const htmlDir = path.join(__dirname, 'public', 'admin');
const files = fs.readdirSync(htmlDir).filter(f => f.endsWith('.html')).map(f => path.join(htmlDir, f));

files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  if (content.includes('Управление фондом')) {
    content = content.replace(/Управление фондом/g, 'Управление объектами');
    fs.writeFileSync(f, content, 'utf8');
    console.log('Updated ' + f);
  }
});
