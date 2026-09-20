const PocketBase = require('pocketbase/cjs');
require('dotenv').config();
const pb = new PocketBase(process.env.POCKETBASE_URL || 'http://localhost:8090');
(async () => {
  try {
    await pb.admins.authWithPassword(process.env.POCKETBASE_ADMIN_EMAIL, process.env.POCKETBASE_ADMIN_PASSWORD);
    
    // update cabins
    const cabins = await pb.collections.getOne('cabins');
    let schemaCabins = cabins.schema;
    if (!schemaCabins.find(f => f.name === 'allow_pets')) {
      schemaCabins.push({ name: 'allow_pets', type: 'bool' });
      await pb.collections.update('cabins', { schema: schemaCabins });
      console.log('Added allow_pets to cabins');
    } else {
      console.log('allow_pets already exists in cabins');
    }

    // update bookings
    const bookings = await pb.collections.getOne('bookings');
    let schemaBookings = bookings.schema;
    if (!schemaBookings.find(f => f.name === 'with_pets')) {
      schemaBookings.push({ name: 'with_pets', type: 'bool' });
      await pb.collections.update('bookings', { schema: schemaBookings });
      console.log('Added with_pets to bookings');
    } else {
      console.log('with_pets already exists in bookings');
    }
    
    console.log('Done');
  } catch(e) {
    console.error(e.message, e.data);
  }
})();
