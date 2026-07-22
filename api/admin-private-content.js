const supabase = require('../lib/supabase');
function checkAdmin(req) {
  return req.headers['x-admin-password'] === process.env.ADMIN_PASSWORD;
}
const PRIVATE_KEYS = ['private_cardio', 'private_strength', 'private_power', 'private_explosiveness', 'private_movement', 'private_mission', 'private_syllabus'];

const SKILL_PREFIXES = ['skill_muaythai', 'skill_boxing', 'skill_blocking', 'skill_counters', 'skill_punchmove', 'skill_headmovement'];
const SKILL_KEYS = SKILL_PREFIXES.flatMap(prefix => [1, 2, 3, 4, 5].map(level => `${prefix}_${level}`));

const KEYS = [...PRIVATE_KEYS, ...SKILL_KEYS];

module.exports = async (req, res) => {
  if (!checkAdmin(req)) return res.status(401).json({ error: 'Incorrect admin password.' });
  if (req.method === 'GET') {
    const { data } = await supabase.from('settings').select('key, value').in('key', KEYS);
    const result = {};
    (data || []).forEach(row => { result[row.key] = row.value; });
    return res.status(200).json({ content: result });
  }
  if (req.method === 'POST') {
    const { key, value } = req.body || {};
    if (!KEYS.includes(key)) return res.status(400).json({ error: 'Unknown content key.' });
    const { error } = await supabase.from('settings').upsert({ key, value: value || '' });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }
  res.status(405).json({ error: 'Method not allowed' });
};
