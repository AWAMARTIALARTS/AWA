const supabase = require('./supabase');

async function getService(key) {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('key', key)
    .eq('active', true)
    .single();
  if (error || !data) return null;
  return data;
}

async function listServices(category) {
  const { data, error } = await supabase
    .from('services')
    .select('key, label, fee, mode, category')
    .eq('category', category)
    .eq('active', true)
    .order('sort_order', { ascending: true });
  if (error) {
    console.error('listServices error:', error);
    return { __debug_error: error.message, __debug_details: error };
  }
  return data;
}

module.exports = { getService, listServices };
