const supabase = require('../lib/supabase');

function checkAdmin(req) {
  return req.headers['x-admin-password'] === process.env.ADMIN_PASSWORD;
}

module.exports = async (req, res) => {
  if (!checkAdmin(req)) return res.status(401).json({ error: 'Incorrect admin password.' });

  if (req.method === 'GET') {
    const { status } = req.query;
    let query = supabase
      .from('video_submissions')
      .select('*, members(email, current_level)')
      .order('submitted_at', { ascending: true });
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ submissions: data });
  }

  if (req.method === 'POST') {
    const { id, decision, admin_notes } = req.body || {};
    if (!id || !['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ error: 'Missing id or invalid decision.' });
    }

    const { data: submission, error: fetchError } = await supabase
      .from('video_submissions')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !submission) return res.status(404).json({ error: 'Submission not found.' });

    await supabase
      .from('video_submissions')
      .update({ status: decision, admin_notes: admin_notes || null, reviewed_at: new Date() })
      .eq('id', id);

    if (decision === 'approved') {
      // Advance the member to the next level (cap at 5, matching AWA Strike Level 1-5)
      const nextLevel = Math.min(submission.level_submitted_for + 1, 5);
      await supabase
        .from('members')
        .update({ current_level: nextLevel })
        .eq('id', submission.member_id);
    }

    res.status(200).json({ success: true });
  }
};
