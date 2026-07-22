const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

async function sendBookingNotification(booking) {
  try {
    await resend.emails.send({
      from: 'AWA Bookings <onboarding@resend.dev>',
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
    console.error('Failed to send booking notification email:', err.message);
  }
}

module.exports = { sendBookingNotification };
