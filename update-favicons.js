const fs = require('fs');
const path = require('path');

function replaceInDir(dir) {
    fs.readdirSync(dir).forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            replaceInDir(fullPath);
        } else if (fullPath.endsWith('.html')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            // Remove existing <link rel="icon"... just in case
            content = content.replace(/<link rel="icon"[^>]*>\n\s*/g, '');
            // Replace apple-touch-icon with both icon and apple-touch-icon
            content = content.replace(/<link rel="apple-touch-icon"[^>]*>/g, '<link rel="icon" href="/api/icon.png">\n  <link rel="apple-touch-icon" href="/api/icon.png">');
            fs.writeFileSync(fullPath, content, 'utf8');
        }
    });
}

replaceInDir('public');
console.log('Replaced successfully');
