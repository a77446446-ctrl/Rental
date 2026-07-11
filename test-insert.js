const { supabaseAdmin } = require('./src/config/supabase');

async function testInsert() {
  console.log('Testing insert...');
  const { data, error } = await supabaseAdmin
    .from('cabins')
    .insert([{
      name: 'Test Cabin',
      slug: 'test-cabin',
      description: 'Test',
      base_price: 5000,
      capacity: 2,
      status: 'active',
      image_url: 'http://test.com/img.jpg'
    }])
    .select()
    .single();

  console.log('Error:', error);
  console.log('Data:', data);
  
  // also get schema
  const { data: schema, error: err } = await supabaseAdmin.from('cabins').select('*').limit(1);
  console.log('Schema:', Object.keys(schema[0] || {}));
}

testInsert();
