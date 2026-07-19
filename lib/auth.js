const supabase = require('./supabase');

function getCookie(req, name) {
  const cookies = (req.headers.cookie || '').split(';').map(c => c.trim());
  const match = cookies.find(c => c.startsWith(name + '='));
  return match ? match.split('=')[1] : null;
}

// Returns the member row if the session is valid and active, otherwise null
async function getAuthedMember(req) {
  const token = getCookie(req, 'awa_session');
  if (!token) return null;

  const { data: session } = await supabase
    .from('member_sessions')
    .select('member_id, expires_at')
    .eq('token', token)
    .single();

  if (!session || new Date(session.expires_at) < new Date()) return null;

  const { data: member } = await supabase
    .from('members')
    .select('id, email, active')
    .eq('id', session.member_id)
    .single();

  if (!member || !member.active) return null;
  return member;
}

module.exports = { getAuthedMember };
