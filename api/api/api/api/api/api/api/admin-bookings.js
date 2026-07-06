const supabase = require('../lib/supabase');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const passcode = req.headers['x-admin-passcode'];
  if (!passcode || passcode !== process.env.ADMIN_PASSCODE) {
    return res.status(401).json({ error: 'Incorrect passcode' });
  }

  const { data, error } = await supabase
    .from('bookings')
    .select('*, slots(slot_date, slot_time, category)')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json({ bookings: data });
};
