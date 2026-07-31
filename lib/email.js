const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

async function sendBookingNotification(booking) {
  try {
    await resend.emails.send({
      from: 'AWA Bookings <bookings@allwalksacademy.com>',
      to: process.env.NOTIFY_EMAIL,
      subject: `New Booking: ${booking.service_type} — ${booking.customer_name}`,
      text: `New booking received!

Service: ${booking.service_type}
Name: ${booking.customer_name}
Email: ${booking.customer_email}
Phone: ${booking.customer_phone || 'Not provided'}
Amount paid: £${booking.deposit_amount || booking.fee_total}
Total fee: £${booking.fee_total}

Check the admin panel for full details.`
    });
  } catch (err) {
    // Don't let an email failure break the booking flow — just log it
    console.error('Failed to send booking notification email:', err.message);
  }
}

async function sendCustomerConfirmation(booking, slot) {
  if (!booking.customer_email) return;
  try {
    const amountPaid = booking.deposit_amount || booking.fee_total;
    const balanceLine = booking.balance_amount
      ? `\nBalance due at your session: £${booking.balance_amount}`
      : '';
    const slotLine = slot
      ? `\nDate: ${slot.slot_date}\nTime: ${slot.slot_time}`
      : '';

    await resend.emails.send({
      from: 'All Walks Academy <bookings@allwalksacademy.com>',
      to: booking.customer_email,
      subject: `Booking Confirmed — ${booking.service_type}`,
      text: `Hi ${booking.customer_name || 'there'},

Your booking is confirmed!

Service: ${booking.service_type}${slotLine}
Amount paid: £${amountPaid}${balanceLine}

If you have any questions, just reply to this email or get in touch directly.

See you soon!
All Walks Academy`
    });
  } catch (err) {
    console.error('Failed to send customer confirmation email:', err.message);
  }
}

module.exports = { sendBookingNotification, sendCustomerConfirmation };
