const supabase = require('../lib/supabase');
const { listServices } = require('../lib/services');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { category } = req.query;
  if (category) {
    const services = await listServices(category);
    return res.status(200).json({ services });
  }

  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('active', true)
    .order('category')
    .order('sort_order');

  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json({ services: data });
};
