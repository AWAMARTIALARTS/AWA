const supabase = require('../lib/supabase');

function checkAdmin(req) {
  return req.headers['x-admin-password'] === process.env.ADMIN_PASSWORD;
}

function toMinutes(timeStr) {
  const match = (timeStr || '').trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (!match) return null;
  let [, h, m, ampm] = match;
  h = parseInt(h, 10);
  m = parseInt(m, 10);
  ampm = ampm.toLowerCase();
  if (ampm === 'pm' && h !== 12) h += 12;
  if (ampm === 'am' && h === 12) h = 0;
  return h * 60 + m;
}

// Generates the same fixed 6:00am-9:00pm, 75-minutes-apart list used elsewhere
function allTimeOptions() {
  const times = [];
  let minutes = 6 * 60;
  const end = 22 * 60;
  while (minutes <= end) {
    let h = Math.floor(minutes / 60);
    const m = minutes % 60;
    const ampm = h >= 12 ? 'pm' : 'am';
    let h12 = h % 12;
    if (h12 === 0) h12 = 12;
    times.push(`${h12}:${m.toString().padStart(2, '0')}${ampm}`);
    minutes += 75;
  }
  return times;
}

module.exports = async (req, res) => {
  if (!checkAdmin(req)) return res.status(401).json({ error: 'Incorrect admin password.' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { category, days_of_week, start_time, end_time, start_date, weeks, capacity } = req.body || {};
  if (!category || !days_of_week || !days_of_week.length || !start_time || !end_time || !start_date || !weeks) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  const startMin = toMinutes(start_time);
  const endMin = toMinutes(end_time);
  const times = allTimeOptions().filter(t => {
    const m = toMinutes(t);
    return m !== null && m >= startMin && m <= endMin;
  });

  if (!times.length) {
    return res.status(400).json({ error: 'No times fall within that range.' });
  }

  // Build every matching date across the requested number of weeks
  const dates = [];
  const start = new Date(start_date + 'T00:00:00');
  const totalDays = weeks * 7;
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    if (days_of_week.includes(d.getDay())) {
      dates.push(d.toISOString().slice(0, 10));
    }
  }

  // Avoid creating duplicates of slots that already exist
  const { data: existing } = await supabase
    .from('slots')
    .select('slot_date, slot_time')
    .eq('category', category)
    .gte('slot_date', dates[0])
    .lte('slot_date', dates[dates.length - 1]);

  const existingSet = new Set((existing || []).map(s => `${s.slot_date}|${s.slot_time}`));

  const rows = [];
  dates.forEach(date => {
    times.forEach(time => {
      if (!existingSet.has(`${date}|${time}`)) {
        rows.push({ category, slot_date: date, slot_time: time, capacity: capacity || 1, booked_count: 0 });
      }
    });
  });

  if (!rows.length) {
    return res.status(200).json({ success: true, created: 0, message: 'All matching slots already exist.' });
  }

  const { error } = await supabase.from('slots').insert(rows);
  if (error) return res.status(500).json({ error: error.message });

  res.status(200).json({ success: true, created: rows.length });
};
