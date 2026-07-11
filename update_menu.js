const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'public', 'admin');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

files.forEach(f => {
  const p = path.join(dir, f);
  let content = fs.readFileSync(p, 'utf8');
  if (!content.includes('mainpage.html')) {
    const searchStr = '<a href="/admin/settings.html" class="admin-menu-item">Настройки</a>';
    const replaceStr = '<a href="/admin/mainpage.html" class="admin-menu-item">Главный экран</a>\n      <a href="/admin/settings.html" class="admin-menu-item">Настройки</a>';
    if (content.includes(searchStr)) {
      content = content.replace(searchStr, replaceStr);
      fs.writeFileSync(p, content);
      console.log('Updated ' + f);
    }
  }
});
