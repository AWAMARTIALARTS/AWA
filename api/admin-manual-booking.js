const supabase = require('../lib/supabase');
const { getService } = require('../lib/services');

function checkAdmin(req) {
  return req.headers['x-admin-password'] === process.env.ADMIN_PASSWORD;
}

module.exports = async (req, res) => {
  if (!checkAdmin(req)) return res.status(401).json({ error: 'Incorrect admin password.' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, email, phone, service_type, slot_id } = req.body || {};
  if (!name || !email || !service_type) {
    return res.status(400).json({ error: 'Name, email, and service are required.' });
  }

  const priceInfo = await getService(service_type);
  if (!priceInfo) return res.status(400).json({ error: 'Unknown service.' });

  // If a slot was chosen, confirm it has room and reserve it
  if (slot_id) {
    const { data: slot, error: slotErr } = await supabase.from('slots').select('*').eq('id', slot_id).single();
    if (slotErr || !slot) return res.status(404).json({ error: 'Slot not found.' });
    if (slot.booked_count >= slot.capacity) {
      return res.status(409).json({ error: 'That slot is already full.' });
    }
    await supabase.from('slots').update({ booked_count: slot.booked_count + 1 }).eq('id', slot_id);
  }

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      slot_id: slot_id || null,
      customer_name: name,
      customer_email: email,
      customer_phone: phone || null,
      service_type,
      fee_total: priceInfo.fee,
      deposit_amount: null,
      balance_amount: 0,
      payment_status: 'paid_manual',
      stripe_checkout_session_id: null,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json({ success: true, booking: data });
};
