const supabase = require('../lib/supabase');

function checkAdmin(req) {
  return req.headers['x-admin-password'] === process.env.ADMIN_PASSWORD;
}

module.exports = async (req, res) => {
  if (!checkAdmin(req)) return res.status(401).json({ error: 'Incorrect admin password.' });

  if (req.method === 'GET') {
    const { category } = req.query;
    let query = supabase.from('slots').select('*').order('slot_date').order('slot_time');
    if (category) query = query.eq('category', category);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ slots: data });
  }

  if (req.method === 'POST') {
    const { category, slot_date, slot_time, capacity } = req.body || {};
    if (!category || !slot_date || !slot_time) {
      return res.status(400).json({ error: 'Category, date, and time are required.' });
    }

    const { data, error } = await supabase
      .from('slots')
      .insert({
        category,
        slot_date,
        slot_time,
        capacity: capacity || 1,
        booked_count: 0,
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true, slot: data });
  }

  if (req.method === 'DELETE') {
    const { id, ids } = req.body || {};
    const targetIds = ids && ids.length ? ids : (id ? [id] : []);
    if (!targetIds.length) return res.status(400).json({ error: 'Missing id or ids.' });

    // Refuse to delete any slot that already has bookings against it —
    // safer to keep the booking record intact and just stop offering new ones
    const { data: slotsToCheck } = await supabase
      .from('slots')
      .select('id, booked_count')
      .in('id', targetIds);

    const blocked = (slotsToCheck || []).filter(s => s.booked_count > 0).map(s => s.id);
    const deletable = targetIds.filter(tid => !blocked.includes(tid));

    if (deletable.length) {
      const { error } = await supabase.from('slots').delete().in('id', deletable);
      if (error) return res.status(500).json({ error: error.message });
    }

    if (blocked.length && !deletable.length) {
      return res.status(400).json({ error: 'All selected slots already have bookings against them and can\'t be deleted.' });
    }

    return res.status(200).json({
      success: true,
      deleted: deletable.length,
      skipped: blocked.length,
    });
  }

  res.status(405).json({ error: 'Method not allowed' });
};
