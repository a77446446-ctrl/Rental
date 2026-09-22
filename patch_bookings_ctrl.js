const fs = require('fs');
let js = fs.readFileSync('src/controllers/admin/bookings.controller.js', 'utf8');

const target = `    const data = await pbAdmin.collection('bookings').getFullList({
      expand: 'cabin_id,guest_id',
      sort: '-created'
    });
    
    const mappedData = data.map(normalizeBookingRecord).map(b => {
      const cabin = b.expand?.cabin_id;`;

const replacement = `    const data = await pbAdmin.collection('bookings').getFullList({
      expand: 'cabin_id,guest_id',
      sort: '-created'
    });

    let allCabins = [];
    try {
      allCabins = await pbAdmin.collection('cabins').getFullList();
    } catch(e) {}
    const cabinsMap = {};
    allCabins.forEach(c => cabinsMap[c.id] = c);
    
    const mappedData = data.map(normalizeBookingRecord).map(b => {
      const cabin = b.expand?.cabin_id || cabinsMap[b.cabin_id];`;

if(js.includes(target)) {
    js = js.replace(target, replacement);
    fs.writeFileSync('src/controllers/admin/bookings.controller.js', js);
    console.log('patched bookings.controller.js getAll');
} else {
    console.log('Target not found in bookings.controller.js');
}
