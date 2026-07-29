const supabase = require('../lib/supabase');

function checkAdmin(req) {
  return req.headers['x-admin-password'] === process.env.ADMIN_PASSWORD;
}

module.exports = async (req, res) => {
  if (!checkAdmin(req)) return res.status(401).json({ error: 'Incorrect admin password.' });
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Pulling from the same bookings table used by both online checkout and
  // manual bookings, so both naturally show up here together.
  const { data, error } = await supabase
    .from('bookings')
    .select('customer_name, customer_email, customer_phone, completed')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const clientsMap = {};
  (data || []).forEach(b => {
    if (!b.customer_email) return;
    const key = b.customer_email.toLowerCase();
    if (!clientsMap[key]) {
      clientsMap[key] = {
        name: b.customer_name || null,
        email: b.customer_email,
        phone: b.customer_phone || null,
        totalBookings: 0,
        completedSessions: 0,
      };
    }
    clientsMap[key].totalBookings += 1;
    if (b.completed) clientsMap[key].completedSessions += 1;
    if (!clientsMap[key].name && b.customer_name) clientsMap[key].name = b.customer_name;
    if (!clientsMap[key].phone && b.customer_phone) clientsMap[key].phone = b.customer_phone;
  });

  const clients = Object.values(clientsMap).sort((a, b) => b.totalBookings - a.totalBookings);
  res.status(200).json({ clients });
};
