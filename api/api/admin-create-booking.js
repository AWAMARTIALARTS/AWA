const supabase = require('../lib/supabase');
const { getService } = require('../lib/services');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const passcode = req.headers['x-admin-passcode'];
  if (!passcode || passcode !== process.env.ADMIN_PASSCODE) {
    return res.status(401).json({ error: 'Incorrect passcode' });
  }

  try {
    const { name, email, phone, service_key, slot_id, payment_status } = req.body;
    if (!name || !email || !service_key) {
      return res.status(400).json({ error: 'Name, email and a service are required.' });
    }

    const service = await getService(service_key);
    if (!service) return res.status(400).json({ error: 'Unknown service.' });

    if (slot_id) {
      const { data: slot, error: slotErr } = await supabase.from('slots').select('*').eq('id', slot_id).single();
      if (slotErr || !slot) return res.status(404).json({ error: 'Slot not found.' });
      if (slot.booked_count >= slot.capacity) {
        return res.status(409).json({ error: 'That slot is already full.' });
      }
      await supabase.from('slots').update({ booked_count: slot.booked_count + 1 }).eq('id', slot_id);
    }

    const deposit = service.mode === 'deposit' ? service.fee / 2 : null;
    const balance = service.mode === 'deposit' ? service.fee - deposit : 0;
    const status = payment_status || (service.mode === 'deposit' ? 'deposit_paid' : 'paid_full');

    const { data: booking, error } = await supabase.from('bookings').insert({
      slot_id: slot_id || null,
      customer_name: name,
      customer_email: email,
      customer_phone: phone || null,
      service_type: service_key,
      fee_total: service.fee,
      deposit_amount: deposit,
      balance_amount: balance,
      payment_status: status
    }).select().single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(200).json({ success: true, booking });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong creating the booking.' });
  }
};
