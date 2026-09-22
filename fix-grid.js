const fs = require('fs');
let content = fs.readFileSync('public/admin/cabins.html', 'utf8');

// Find the block starting with <div class="responsive-grid-2"> and ending with <div class="form-group">\s*<label>Статус на сайте
const regex = /<div class="responsive-grid-2">[\s\S]*?(?=<div class="form-group">\s*<label>Статус на сайте)/;

const replacement = `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 16px; margin-bottom: 16px;">
          <div class="form-group">
            <label>Включено гостей (чел.)</label>
            <input type="number" id="cabinBaseGuests" min="1" placeholder="2" style="width: 100%; box-sizing: border-box;">
          </div>
          <div class="form-group">
            <label>За доп. гостя (₽/сут)</label>
            <input type="number" id="cabinExtraGuestPrice" min="0" placeholder="1000" style="width: 100%; box-sizing: border-box;">
          </div>
          <div class="form-group">
            <label>Макс. вместимость (чел.)</label>
            <input type="number" id="cabinCapacity" min="1" max="20" required style="width: 100%; box-sizing: border-box;">
          </div>
          <div class="form-group">
            <label>Базовая цена (₽/сутки)</label>
            <input type="number" id="cabinBasePrice" min="0" step="100" required style="width: 100%; box-sizing: border-box;">
          </div>
        </div>
        `;

if (regex.test(content)) {
  content = content.replace(regex, replacement);
  fs.writeFileSync('public/admin/cabins.html', content);
  console.log('Replaced successfully');
} else {
  console.log('Regex did not match');
}
