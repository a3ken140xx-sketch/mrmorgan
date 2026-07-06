const { createClient } = require('@supabase/supabase-js');
function json(body, s = 200) { return { statusCode: s, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' }, body: JSON.stringify(body) }; }

exports.handler = async (event) => {
  const p = (event.path || '').replace(/^\/\.netlify\/functions\/api\//, '').replace(/^\/api\//, '').replace(/^\//, '');
  const m = event.httpMethod;
  const sb = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

  try {
    // Health
    if (p === 'health') return json({ ok: true });

    // Visitors
    if (p === 'visitors' && m === 'POST') {
      const ip = (event.headers['x-forwarded-for'] || '').split(',')[0].trim();
      await sb().from('visits').insert({ ip, user_agent: event.headers['user-agent'] || '' });
      const { data } = await sb().from('visits').select('id');
      return json({ value: data ? data.length : 0 });
    }

    if (p === 'visitors/count') {
      const { data } = await sb().from('visits').select('id');
      return json({ value: data ? data.length : 0 });
    }

    // Stats
    if (p === 'stats/users') {
      const { data } = await sb().from('users').select('id');
      return json({ value: data ? data.length : 0 });
    }

    // Tools
    if (p === 'tools') {
      const { data } = await sb().from('tools').select('*').order('created_at', { ascending: true });
      return json(data || []);
    }

    return json({ error: 'غير موجود: ' + p }, 404);
  } catch (err) {
    return json({ error: err.message || 'خطأ داخلي' }, 500);
  }
};
