const supabase = require('./supabase');

function getCookie(req, name) {
  const cookies = (req.headers.cookie || '').split(';').map(c => c.trim());
  const match = cookies.find(c => c.startsWith(name + '='));
  return match ? match.split('=')[1] : null;
}

// Returns the member row if the session is valid, otherwise null.
// NOTE: this only confirms the person is logged in — it does NOT check
// whether any specific membership is currently paid/active. Each endpoint
// that serves gated content must check the relevant *_active flag itself
// (see member-content.js), since a member can have one membership active
// and another lapsed at the same time.
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
    .select('id, email, solo_challenge_active, fitness_active, membership_active, current_level')
    .eq('id', session.member_id)
    .single();
  if (!member) return null;

  return member;
}

module.exports = { getAuthedMember };
