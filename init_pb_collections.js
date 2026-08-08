const PocketBase = require('pocketbase/cjs');
const dotenv = require('dotenv');

dotenv.config({ path: './.env' });

const pb = new PocketBase(process.env.POCKETBASE_URL);

async function init() {
  try {
    await pb.admins.authWithPassword(process.env.POCKETBASE_ADMIN_EMAIL, process.env.POCKETBASE_ADMIN_PASSWORD);
    
    // Создаем коллекцию cabins
    try {
      await pb.collections.create({
        name: 'cabins',
        type: 'base',
        schema: [
          { name: 'name', type: 'text', required: true },
          { name: 'description', type: 'text' },
          { name: 'base_price', type: 'number', required: true },
          { name: 'capacity', type: 'number', required: true },
          { name: 'is_active', type: 'bool' },
          { name: 'images', type: 'json' },
          { name: 'amenities', type: 'json' },
          { name: 'sort_order', type: 'number' }
        ]
      });
      console.log('Collection cabins created');
    } catch (e) {
      console.log('cabins already exists or error:', e.message);
    }

    // Создаем коллекцию prices
    try {
      await pb.collections.create({
        name: 'prices',
        type: 'base',
        schema: [
          { name: 'cabin_id', type: 'relation', required: true, options: { collectionId: pb.collections.getOne('cabins').then(c => c.id).catch(() => 'cabins'), maxSelect: 1 } },
          { name: 'date', type: 'date', required: true },
          { name: 'custom_price', type: 'number' },
          { name: 'promo_description', type: 'text' }
        ]
      });
      console.log('Collection prices created');
    } catch (e) {
      console.log('prices already exists or error:', e.message);
    }

    console.log('Done!');
  } catch (err) {
    console.error('Error:', err.message);
  }
}

init();
