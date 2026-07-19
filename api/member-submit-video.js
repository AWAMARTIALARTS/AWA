const supabase = require('../lib/supabase');
const { getAuthedMember } = require('../lib/auth');

module.exports = async (req, res) => {
  const member = await getAuthedMember(req);
  if (!member) return res.status(401).json({ error: 'Please log in with an active membership.' });

  if (req.method === 'GET') {
    // Return the member's current level and their submission history
    const { data: submissions } = await supabase
      .from('video_submissions')
      .select('*')
      .eq('member_id', member.id)
      .order('submitted_at', { ascending: false });
    return res.status(200).json({ current_level: member.current_level, submissions: submissions || [] });
  }

  if (req.method === 'POST') {
    const { video_url } = req.body || {};
    if (!video_url) return res.status(400).json({ error: 'Please provide a video link.' });

    // Block a new submission while one is still pending for this member
    const { data: pending } = await supabase
      .from('video_submissions')
      .select('id')
      .eq('member_id', member.id)
      .eq('status', 'pending')
      .single();

    if (pending) {
      return res.status(400).json({ error: 'You already have a submission awaiting review.' });
    }

    const { data, error } = await supabase
      .from('video_submissions')
      .insert({
        member_id: member.id,
        level_submitted_for: member.current_level,
        video_url,
        status: 'pending',
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true, submission: data });
  }

  res.status(405).json({ error: 'Method not allowed' });
};
