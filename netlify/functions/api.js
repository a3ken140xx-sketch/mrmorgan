const ADMIN_EMAIL = 'a3ken140xx@gmail.com';
function json(body, s = 200) { return { statusCode: s, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' }, body: JSON.stringify(body) }; }

exports.handler = async (event) => {
  const p = (event.path || '').replace(/^\/\.netlify\/functions\/api\//, '').replace(/^\/api\//, '').replace(/^\//, '');
  const m = event.httpMethod;

  if (p === 'health') return json({ ok: true });

  const { createClient } = require('@supabase/supabase-js');
  const sb = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
  const body = (() => { try { return JSON.parse(event.body || '{}'); } catch { return {}; } })();
  const q = event.queryStringParameters || {};

  try {
    if (p === 'stats/users') { const { data } = await sb().from('users').select('id'); return json({ value: data ? data.length : 0 }); }

    if (p === 'tools' && m === 'GET') { const { data } = await sb().from('tools').select('*').order('created_at', { ascending: true }); return json(data || []); }

    if (p === 'visitors' && m === 'POST') {
      const ip = (event.headers['x-forwarded-for'] || '').split(',')[0].trim();
      await sb().from('visits').insert({ ip, user_agent: event.headers['user-agent'] || '' });
      const { data } = await sb().from('visits').select('id');
      return json({ value: data ? data.length : 0 });
    }
    if (p === 'visitors/count') { const { data } = await sb().from('visits').select('id'); return json({ value: data ? data.length : 0 }); }

    if (p === 'admin/tools' && m === 'POST') {
      if (body.adminEmail !== ADMIN_EMAIL) return json({ error: 'غير مصرح' }, 403);
      const { data } = await sb().from('tools').insert(body).select().single();
      return json(data);
    }

    const td = p.match(/^admin\/tools\/(.+)/);
    if (td && m === 'DELETE') {
      if (q.admin !== ADMIN_EMAIL) return json({ error: 'غير مصرح' }, 403);
      await sb().from('tools').delete().eq('id', td[1]);
      return json({ message: 'تم الحذف' });
    }

    if (p === 'admin/users' && m === 'GET') {
      if (q.admin !== ADMIN_EMAIL) return json({ error: 'غير مصرح' }, 403);
      const { data } = await sb().from('users').select('id,email,first_name,last_name,banned,created_at').order('created_at', { ascending: false });
      return json(data || []);
    }

    const ud = p.match(/^admin\/users\/(.+)/);
    if (ud && m === 'DELETE') {
      if (q.admin !== ADMIN_EMAIL) return json({ error: 'غير مصرح' }, 403);
      await sb().from('users').delete().eq('email', decodeURIComponent(ud[1]));
      return json({ message: 'تم الحذف' });
    }

    const ub = p.match(/^admin\/users\/(.+)\/ban/);
    if (ub && m === 'PUT') {
      if (body.adminEmail !== ADMIN_EMAIL) return json({ error: 'غير مصرح' }, 403);
      await sb().from('users').update({ banned: body.banned }).eq('email', decodeURIComponent(ub[1]));
      return json({ message: 'تم التحديث' });
    }

    return json({ error: 'مش موجود: ' + p }, 404);
  } catch (err) {
    console.error('API error:', err);
    return json({ error: err.message || 'خطأ داخلي' }, 500);
  }
};
