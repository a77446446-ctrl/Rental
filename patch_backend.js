const fs = require('fs');

// 1. Patch public.routes.js
let routesJs = fs.readFileSync('src/routes/public.routes.js', 'utf8');
routesJs = routesJs.replace(
  'with_pets: Boolean(req.body.with_pets),',
  'with_pets: Boolean(req.body.with_pets),\n      pet_types: Array.isArray(req.body.pet_types) ? req.body.pet_types : [],'
);
fs.writeFileSync('src/routes/public.routes.js', routesJs);

// 2. Patch booking.service.js
let bookingSvc = fs.readFileSync('src/services/booking.service.js', 'utf8');
bookingSvc = bookingSvc.replace('petTypes: input.petTypes,', 'petTypes: input.pet_types,');
fs.writeFileSync('src/services/booking.service.js', bookingSvc);

// 3. Patch max.service.js
let maxSvc = fs.readFileSync('src/services/max.service.js', 'utf8');
const maxDestructureOld = `    withPets,
    comment,
    chatToken
  } = bookingData;`;

const maxDestructureNew = `    withPets,
    comment,
    chatToken,
    petTypes,
    extrasSnapshot
  } = bookingData;`;

if(maxSvc.includes(maxDestructureOld)) {
  maxSvc = maxSvc.replace(maxDestructureOld, maxDestructureNew);
  fs.writeFileSync('src/services/max.service.js', maxSvc);
  console.log('patched max.service.js successfully');
} else {
  console.log('could not find old destructure in max.service.js');
}

console.log('patches applied');
