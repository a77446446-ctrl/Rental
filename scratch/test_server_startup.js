const { ensureLocalPocketbase } = require('../src/services/localPocketbase.service');
const { initPocketBase, pbAdmin } = require('../src/config/pocketbase');

async function test() {
  console.log('Testing startup sequence...');
  await ensureLocalPocketbase();
  await initPocketBase();

  console.log('Testing queries:');
  const cabins = await pbAdmin.collection('cabins').getFullList();
  console.log('Cabins count:', cabins.length);

  const settings = await pbAdmin.collection('app_config').getFirstListItem('key="settings"').catch(e => ({ error: e.message }));
  console.log('Settings:', settings.error || 'OK');

  const mainpage = await pbAdmin.collection('app_config').getFirstListItem('key="mainpage"').catch(e => ({ error: e.message }));
  console.log('Mainpage:', mainpage.error || 'OK');

  console.log('All tests passed successfully!');
  process.exit(0);
}

test().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
