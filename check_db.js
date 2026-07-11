const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
  const { data, error } = await supabase.from('guest_notes').select('*').limit(1);
  console.log('guest_notes exists?', !error);
  if (error) console.log(error);
}
run();
