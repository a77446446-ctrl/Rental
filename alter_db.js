const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function alterTable() {
  const { data, error } = await supabase.rpc('execute_sql', { sql: 'ALTER TABLE prices ADD COLUMN IF NOT EXISTS is_closed BOOLEAN DEFAULT FALSE;' });
  if (error && error.code === 'PGRST202') {
    // RPC might not exist, let's try direct insert to create the column? No, we can't alter table from JS without RPC.
    console.log('RPC execute_sql does not exist or failed:', error);
  } else {
    console.log('Result:', error || 'Success');
  }
}
alterTable();
