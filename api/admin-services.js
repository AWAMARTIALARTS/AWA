const supabase = require('../lib/supabase');

function checkAdmin(req) {
  return req.headers['x-admin-password'] === process.env.ADMIN_PASSWORD;
}

module.exports = async (req, res) => {
  if (!checkAdmin(req)) return res.status(401).json({ error: 'Incorrect admin password.' });

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .order('category')
      .order('sort_order');
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ services: data });
  }

  if (req.method === 'POST') {
    const { key, label, fee } = req.body || {};
    if (!key || label === undefined || fee === undefined) {
      return res.status(400).json({ error: 'Missing key, label, or fee.' });
    }
    const { error } = await supabase
      .from('services')
      .update({ label, fee })
      .eq('key', key);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
};
