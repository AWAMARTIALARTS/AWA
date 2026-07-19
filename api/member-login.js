const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const supabase = require('../lib/supabase');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Enter your email and password.' });

  const { data: member } = await supabase
    .from('members')
    .select('*')
    .eq('email', email.toLowerCase())
    .single();

  if (!member) return res.status(401).json({ error: 'No account found with that email.' });

  const valid = await bcrypt.compare(password, member.password_hash);
  if (!valid) return res.status(401).json({ error: 'Incorrect password.' });

  if (!member.active) {
    return res.status(403).json({ error: 'Your membership isn\'t active yet — payment may still be processing, or your subscription has lapsed.' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await supabase.from('member_sessions').insert({ token, member_id: member.id, expires_at });

  res.setHeader('Set-Cookie', `awa_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`);
  res.status(200).json({ success: true });
};
