const supabase = require('../lib/supabase');

function getCookie(req, name) {
  const cookies = (req.headers.cookie || '').split(';').map(c => c.trim());
  const match = cookies.find(c => c.startsWith(name + '='));
  return match ? match.split('=')[1] : null;
}

module.exports = async (req, res) => {
  const token = getCookie(req, 'awa_session');
  if (token) {
    await supabase.from('member_sessions').delete().eq('token', token);
  }
  res.setHeader('Set-Cookie', 'awa_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
  res.status(200).json({ success: true });
};
