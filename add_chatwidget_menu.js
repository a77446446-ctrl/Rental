const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'public', 'admin');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html') && f !== 'chatwidget.html');

files.forEach(f => {
  const p = path.join(dir, f);
  let content = fs.readFileSync(p, 'utf8');
  if (content.includes('chatwidget.html')) {
    console.log('Already has link: ' + f);
    return;
  }
  const searchStr = '<a href="/admin/settings.html"';
  if (content.includes(searchStr)) {
    content = content.replace(
      searchStr,
      '<a href="/admin/chatwidget.html" class="admin-menu-item">Виджет чата</a>\n      <a href="/admin/settings.html"'
    );
    fs.writeFileSync(p, content, 'utf8');
    console.log('Updated ' + f);
  } else {
    console.log('No settings link found in ' + f);
  }
});
