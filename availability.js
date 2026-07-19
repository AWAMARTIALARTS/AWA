const supabase = require('../lib/supabase');
module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { category } = req.query;
  if (!category) return res.status(400).json({ error: 'Missing category' });
  const { data, error } = await supabase
    .from('slots')
    .select('*')
    .eq('category', category)
    .eq('blocked', false)
    .gte('slot_date', new Date().toISOString().slice(0, 10))
    .order('slot_date', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  const slots = data.map(s => ({
    id: s.id,
    slot_date: s.slot_date,
    slot_time: s.slot_time,
    location: s.location,
    capacity: s.capacity,
    spots_left: s.capacity - s.booked_count,
    full: s.booked_count >= s.capacity
  }));
  res.status(200).json({ slots });
};
