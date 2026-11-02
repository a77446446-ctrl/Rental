const fs = require('fs');
const path = require('path');
const { pbAdmin } = require('../src/config/pocketbase');

async function main() {
  await pbAdmin.collection('_superusers').authWithPassword('admin@admin.com', 'admin@admin.com');
  const cabins = await pbAdmin.collection('cabins').getFullList();
  console.log('Current PocketBase cabins count:', cabins.length);
  cabins.forEach(c => console.log(' - ' + c.name + ' (' + c.slug + ')'));

  const mainpage = await pbAdmin.collection('app_config').getFirstListItem('key="mainpage"');
  console.log('Mainpage hero title:', mainpage.value?.hero?.title);
  console.log('Mainpage logo text:', mainpage.value?.header?.logoText);
  console.log('Mainpage logo image:', mainpage.value?.header?.logoImage);
  console.log('Mainpage hero image:', mainpage.value?.hero?.backgroundImage);
}

main().catch(console.error);
