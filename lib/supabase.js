const { createClient } = require('@supabase/supabase-js');

console.log('SUPABASE_URL from env:', process.env.SUPABASE_URL);
console.log('SUPABASE_URL length:', process.env.SUPABASE_URL ? process.env.SUPABASE_URL.length : 'undefined');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = supabase;
