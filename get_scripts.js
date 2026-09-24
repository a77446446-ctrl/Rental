const fs = require('fs');
const html = fs.readFileSync('public/mediakit.html', 'utf8');
const match = html.match(/<script>[\s\S]*?<\/script>/);
if (match) {
    fs.writeFileSync('scripts.txt', match[0], 'utf8');
}
