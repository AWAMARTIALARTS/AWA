const supabase = require('../lib/supabase');
function checkAdmin(req) {
  return req.headers['x-admin-password'] === process.env.ADMIN_PASSWORD;
}
const SETTING_KEY = {
  academy_training: 'academy_training_live',
  solo_challenge: 'solo_challenge_live',
  fitness_subscription: 'fitness_subscription_live',
  combat_fitness: 'combat_fitness_live',
};
module.exports = async (req, res) => {
  if (!checkAdmin(req)) return res.status(401).json({ error: 'Incorrect admin password.' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { product, live } = req.body || {};
  if (!SETTING_KEY[product] || typeof live !== 'boolean') {
    return res.status(400).json({ error: 'Missing valid product and live (true/false).' });
  }
  const { error } = await supabase
    .from('settings')
    .upsert({ key: SETTING_KEY[product], value: live ? 'true' : 'false' });
  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json({ success: true, product, live });
};
