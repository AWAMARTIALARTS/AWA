const supabase = require('../lib/supabase');

async function bookOneSlot(slotId) {
  const { data: slot, error } = await supabase.from('slots').select('*').eq('id', slotId).single();
  if (error || !slot) return { ok: false, error: 'Slot not found' };
  if (slot.booked_count >= slot.capacity) return { ok: false, error: 'That slot was just booked by someone else.' };
  await supabase.from('slots').update({ booked_count: slot.booked_count + 1 }).eq('id', slotId);
  return { ok: true, slot };
}

function weeksAreDistinct(dates) {
  const weekNumbers = dates.map(d => Math.floor(new Date(d).getTime() / (7 * 24 * 60 * 60 * 1000)));
  return new Set(weekNumbers).size === weekNumbers.length;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { booking_id, slot_id, slot_ids } = req.body;
    if (!booking_id) return res.status(400).json({ error: 'Missing booking_id' });

    const { data: booking, error: bookingErr } = await supabase
      .from('bookings').select('*').eq('id', booking_id).single();
    if (bookingErr || !booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.payment_status !== 'deposit_paid' && booking.payment_status !== 'paid_full') {
      return res.status(402).json({ error: 'Payment not confirmed for this booking yet.' });
    }

    if (booking.service_type === 'block4') {
      if (!Array.isArray(slot_ids) || slot_ids.length !== 4) {
        return res.status(400).json({ error: 'Please choose exactly 4 sessions, one per week.' });
      }
      const { data: chosenSlots } = await supabase.from('slots').select('*').in('id', slot_ids);
      if (!chosenSlots || chosenSlots.length !== 4) return res.status(404).json({ error: 'One or more slots not found.' });
      if (chosenSlots.some(s => s.booked_count >= s.capacity)) {
        return res.status(409).json({ error: 'One of those slots was just booked by someone else — please re-check availability.' });
      }
      if (!weeksAreDistinct(chosenSlots.map(s => s.slot_date))) {
        return res.status(400).json({ error: 'Please choose one session per week across 4 different weeks.' });
      }

      for (const s of chosenSlots) {
        await supabase.from('slots').update({ booked_count: s.booked_count + 1 }).eq('id', s.id);
        await supabase.from('bookings').insert({
          parent_booking_id: booking.id,
          slot_id: s.id,
          customer_name: booking.customer_name,
          customer_email: booking.customer_email,
          customer_phone: booking.customer_phone,
          service_type: 'block4_session',
          fee_total: 0,
          payment_status: 'scheduled'
        });
      }
      await supabase.from('bookings').update({ slot_id: chosenSlots[0].id }).eq('id', booking.id);
      return res.status(200).json({ success: true });
    }

    if (!slot_id) return res.status(400).json({ error: 'Missing slot_id' });
    const result = await bookOneSlot(slot_id);
    if (!result.ok) return res.status(409).json({ error: result.error });

    await supabase.from('bookings').update({ slot_id }).eq('id', booking.id);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong booking your slot.' });
  }
};
