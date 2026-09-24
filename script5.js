const fs = require('fs');
const path = 'public/mediakit.html';
let html = fs.readFileSync(path, 'utf8');

if (!html.includes('grid-template-columns: repeat(3, 1fr);')) {
    html = html.replace('.feature-card {', '    .features-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 30px; width: 100%; max-width: 1200px; }\n    .feature-card {');
}

fs.writeFileSync(path, html, 'utf8');
console.log('Fixed features-grid CSS!');
