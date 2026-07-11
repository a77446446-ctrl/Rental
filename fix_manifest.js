const fs = require('fs');
const path = require('path');

const adminDir = path.join(__dirname, 'public/admin');
const files = fs.readdirSync(adminDir).filter(f => f.endsWith('.html'));

for (const file of files) {
  const filePath = path.join(adminDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  content = content.replace(/href="\/manifest.webmanifest"/g, 'href="/api/manifest.json"');
  
  fs.writeFileSync(filePath, content);
}
console.log('Manifest links updated in all admin HTML files.');
