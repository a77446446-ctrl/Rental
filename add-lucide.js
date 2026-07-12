const fs = require('fs');
const path = require('path');

const scriptTag = '<script defer src="https://unpkg.com/lucide@latest"></script>';

function addLucide(dir) {
    fs.readdirSync(dir).forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            addLucide(fullPath);
        } else if (fullPath.endsWith('.html')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            if (!content.includes('unpkg.com/lucide')) {
                // Insert right before </head>
                content = content.replace('</head>', `  ${scriptTag}\n</head>`);
                fs.writeFileSync(fullPath, content, 'utf8');
            }
        }
    });
}

addLucide('public');
console.log('Lucide CDN added to all HTML files');
