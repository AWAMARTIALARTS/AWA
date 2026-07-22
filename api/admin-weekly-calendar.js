const supabase = require('../lib/supabase');

function checkAdmin(req) {
  return req.headers['x-admin-password'] === process.env.ADMIN_PASSWORD;
}

module.exports = async (req, res) => {
  if (!checkAdmin(req)) return res.status(401).json({ error: 'Incorrect admin password.' });
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { start_date, end_date, category } = req.query;
  if (!start_date) return res.status(400).json({ error: 'Missing start_date.' });

  let endStr = end_date;
  if (!endStr) {
    const start = new Date(start_date + 'T00:00:00');
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    endStr = end.toISOString().slice(0, 10);
  }

  let slotQuery = supabase
    .from('slots')
    .select('*')
    .gte('slot_date', start_date)
    .lte('slot_date', endStr)
    .order('slot_date')
    .order('slot_time');
  if (category) slotQuery = slotQuery.eq('category', category);

  const { data: slots, error: slotErr } = await slotQuery;
  if (slotErr) return res.status(500).json({ error: slotErr.message });

  const slotIds = (slots || []).map(s => s.id);
  let bookingsBySlot = {};

  if (slotIds.length) {
    const { data: bookings, error: bookingErr } = await supabase
      .from('bookings')
      .select('slot_id, customer_name, customer_email, payment_status')
      .in('slot_id', slotIds)
      .in('payment_status', ['paid', 'paid_manual']);

    if (bookingErr) return res.status(500).json({ error: bookingErr.message });

    (bookings || []).forEach(b => {
      if (!bookingsBySlot[b.slot_id]) bookingsBySlot[b.slot_id] = [];
      bookingsBySlot[b.slot_id].push({ name: b.customer_name, email: b.customer_email });
    });
  }

  const result = (slots || []).map(s => ({
    ...s,
    customers: bookingsBySlot[s.id] || [],
  }));

  res.status(200).json({ slots: result });
};
