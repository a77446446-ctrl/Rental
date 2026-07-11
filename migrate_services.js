const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('extra_services').select('*');
  if (error) {
    console.error('Error fetching data:', error);
  } else {
    fs.writeFileSync('src/data/extra_services.json', JSON.stringify(data || [], null, 2));
    console.log('Successfully wrote ' + (data ? data.length : 0) + ' extra services to src/data/extra_services.json');
  }
}

run();
