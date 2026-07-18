const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
  });
}

walkDir(path.join(__dirname, '../public'), function(filePath) {
  if (filePath.endsWith('.html')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let orig = content;
    
    // Удаляем Google Fonts
    content = content.replace(/<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">\s*/g, '');
    content = content.replace(/<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com"[^>]*>\s*/g, '');
    content = content.replace(/<link href="https:\/\/fonts\.googleapis\.com[^"]+" rel="stylesheet">\s*/g, '');

    // Удаляем Yandex Maps
    content = content.replace(/<script src="https:\/\/api-maps\.yandex\.ru[^>]+><\/script>\s*/g, '');

    if (content !== orig) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('Updated', filePath);
    }
  }
});
