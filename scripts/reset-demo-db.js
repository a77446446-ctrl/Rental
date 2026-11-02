const { pbAdmin } = require('d:/Рабочий стол D/GPT Ai/Projects/eco-gorniy/eco-gorniy/cabin-rental-app/src/config/pocketbase');
const fs = require('fs');
const path = require('path');

async function resetDemoDb() {
  await pbAdmin.collection('_superusers').authWithPassword('admin@admin.com', 'admin@admin.com');
  console.log('1. Superuser auth OK');

  // 1. Reset mainpage config to default clean state
  const cleanMainpage = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../src/data/mainpage.json'), 'utf8'));
  try {
    const existingMainpage = await pbAdmin.collection('app_config').getFirstListItem('key="mainpage"');
    await pbAdmin.collection('app_config').update(existingMainpage.id, { value: cleanMainpage });
    console.log('2. Reset mainpage config to default template: OK');
  } catch (e) {
    console.log('2. Mainpage reset warning:', e.message);
  }

  // 2. Clean up cabins
  const allCabins = await pbAdmin.collection('cabins').getFullList();
  console.log('Total cabins found in DB:', allCabins.length);

  const allowedDemoSlugs = new Set(['lesnoy-uyut', 'ozerniy-briz', 'gornaya-panorama', 'semeyniy-shale']);

  for (const c of allCabins) {
    if (!allowedDemoSlugs.has(c.slug)) {
      console.log(`Deleting test cabin: "${c.name}" (${c.slug}, id: ${c.id})`);
      await pbAdmin.collection('cabins').delete(c.id);
    }
  }

  // Check remaining cabins
  const remaining = await pbAdmin.collection('cabins').getFullList();
  console.log('Remaining clean demo cabins:', remaining.map(c => `${c.name} (${c.slug})`));

  console.log('✓ Database clean reset finished successfully!');
}

resetDemoDb().catch(console.error);
