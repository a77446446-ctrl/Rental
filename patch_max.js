const fs = require('fs');
let maxSvc = fs.readFileSync('src/services/max.service.js', 'utf8');

const target = `    withPets,
    comment,
    chatToken
  } = bookingData;`;

const newDestructure = `    withPets,
    comment,
    chatToken,
    petTypes,
    extrasSnapshot
  } = bookingData;`;

maxSvc = maxSvc.replace(target, newDestructure);
fs.writeFileSync('src/services/max.service.js', maxSvc);
console.log('patched max.service.js');
