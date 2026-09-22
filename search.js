const fs = require('fs');
const content = fs.readFileSync('public/js/main.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('не выбран')) {
    console.log(i + ': ' + line.trim());
  }
});
