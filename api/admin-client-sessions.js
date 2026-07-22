const supabase = require('../lib/supabase');

function checkAdmin(req) {
  return req.headers['x-admin-password'] === process.env.ADMIN_PASSWORD;
}

module.exports = async (req, res) => {
  if (!checkAdmin(req)) return res.status(401).json({ error: 'Incorrect admin password.' });

  if (req.method === 'GET') {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'Missing email.' });

    const { data, error } = await supabase
      .from('bookings')
      .select('id, service_type, payment_status, completed, created_at, slot_id')
      .eq('customer_email', email)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    const completedCount = (data || []).filter(b => b.completed).length;
    return res.status(200).json({ bookings: data, completedCount });
  }

  if (req.method === 'POST') {
    const { booking_id, completed } = req.body || {};
    if (!booking_id || typeof completed !== 'boolean') {
      return res.status(400).json({ error: 'Missing booking_id or completed (true/false).' });
    }

    const { error } = await supabase.from('bookings').update({ completed }).eq('id', booking_id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
};
