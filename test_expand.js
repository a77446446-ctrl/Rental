const { pbAdmin } = require('./src/config/pocketbase');

async function test() {
  const records = await pbAdmin.collection('bookings').getList(1, 1, { sort: '-created', expand: 'cabin_id' });
  console.log(JSON.stringify(records.items[0].expand, null, 2));
}

test().catch(console.error);
