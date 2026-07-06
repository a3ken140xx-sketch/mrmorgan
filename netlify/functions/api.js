exports.handler = async (event) => {
  const path = (event.path || '').replace(/^\/\.netlify\/functions\/api\//, '').replace(/^\/api\//, '').replace(/^\//, '');

  // ---- HEALTH (no deps needed) ----
  if (path === 'health') {
    let bcryptOk = false, supOk = false;
    try { require('bcryptjs'); bcryptOk = true; } catch {}
    try { require('@supabase/supabase-js'); supOk = true; } catch {}
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        bcrypt: bcryptOk,
        supabase_js: supOk,
        supabase_url: !!process.env.SUPABASE_URL,
        supabase_key: (process.env.SUPABASE_KEY || '').length > 10,
        key_length: (process.env.SUPABASE_KEY || '').length,
        path_received: event.path
      })
    };
  }

  // Load deps only when needed
  const bcrypt = require('bcryptjs');
  const { createClient } = require('@supabase/supabase-js');
  const ADMIN_EMAIL = 'a3ken140xx@gmail.com';

  function json(body, status = 200) { return { statusCode: status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' }, body: JSON.stringify(body) }; }
  function supabase() { return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY); }

  try {
    if (path === 'login' && event.httpMethod === 'POST') {
      const { email, password } = JSON.parse(event.body || '{}');
      if (!email || !password) return json({ error: 'البريد الإلكتروني وكلمة المرور مطلوبان' }, 400);
      const { data: users, error } = await supabase().from('users').select('*').eq('email', email).limit(1);
      if (error) return json({ error: 'DB error: ' + error.message }, 500);
      const user = users && users.length ? users[0] : null;
      if (!user) return json({ error: 'بريد إلكتروني أو كلمة مرور غير صحيحة' }, 400);
      if (user.banned) return json({ error: 'حسابك محظور' }, 403);
      if (!(await bcrypt.compare(password, user.password_hash))) return json({ error: 'بريد إلكتروني أو كلمة مرور غير صحيحة' }, 400);
      return json({ message: 'تم تسجيل الدخول بنجاح', email, admin: email === ADMIN_EMAIL });
    }

    if (path === 'check-admin') {
      const body = JSON.parse(event.body || '{}');
      return json({ admin: body.email === ADMIN_EMAIL });
    }

    if (path === 'stats/users') {
      const { data } = await supabase().from('users').select('id');
      return json({ value: data ? data.length : 0 });
    }

    if (path === 'tools') {
      const { data } = await supabase().from('tools').select('*').order('created_at', { ascending: true });
      return json(data || []);
    }

    if (path === 'visitors' && event.httpMethod === 'POST') {
      const ip = (event.headers['x-forwarded-for'] || '').split(',')[0].trim();
      await supabase().from('visits').insert({ ip, user_agent: event.headers['user-agent'] || '' });
      const { data } = await supabase().from('visits').select('id');
      return json({ value: data ? data.length : 0 });
    }

    if (path === 'visitors/count') {
      const { data } = await supabase().from('visits').select('id');
      return json({ value: data ? data.length : 0 });
    }

    if (path === 'admin/tools' && event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      if (body.adminEmail !== ADMIN_EMAIL) return json({ error: 'غير مصرح' }, 403);
      const { data } = await supabase().from('tools').insert(body).select().single();
      return json(data);
    }

    const tMatch = path.match(/^admin\/tools\/(.+)/);
    if (tMatch && event.httpMethod === 'DELETE') {
      const q = event.queryStringParameters || {};
      if (q.admin !== ADMIN_EMAIL) return json({ error: 'غير مصرح' }, 403);
      await supabase().from('tools').delete().eq('id', tMatch[1]);
      return json({ message: 'تم الحذف' });
    }

    if (path === 'admin/users' && event.httpMethod === 'GET') {
      const q = event.queryStringParameters || {};
      if (q.admin !== ADMIN_EMAIL) return json({ error: 'غير مصرح' }, 403);
      const { data } = await supabase().from('users').select('id,email,first_name,last_name,banned,created_at').order('created_at', { ascending: false });
      return json(data || []);
    }

    const uMatch = path.match(/^admin\/users\/(.+)/);
    if (uMatch && event.httpMethod === 'DELETE') {
      const q = event.queryStringParameters || {};
      if (q.admin !== ADMIN_EMAIL) return json({ error: 'غير مصرح' }, 403);
      await supabase().from('users').delete().eq('email', decodeURIComponent(uMatch[1]));
      return json({ message: 'تم الحذف' });
    }

    const uBanMatch = path.match(/^admin\/users\/(.+)\/ban/);
    if (uBanMatch && event.httpMethod === 'PUT') {
      const body = JSON.parse(event.body || '{}');
      if (body.adminEmail !== ADMIN_EMAIL) return json({ error: 'غير مصرح' }, 403);
      await supabase().from('users').update({ banned: body.banned }).eq('email', decodeURIComponent(uBanMatch[1]));
      return json({ message: 'تم التحديث' });
    }

    if (path === 'send-verification') {
      const { email } = JSON.parse(event.body || '{}');
      if (!email) return json({ error: 'البريد الإلكتروني مطلوب' }, 400);
      const { data: existing } = await supabase().from('users').select('id').eq('email', email).limit(1);
      if (existing && existing.length) return json({ error: 'البريد الإلكتروني مستخدم بالفعل' }, 400);
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      await supabase().from('verification_codes').insert({ email, code, type: 'signup', expires_at: new Date(Date.now() + 10*60000).toISOString() });
      return json({ message: 'تم إرسال الكود', code });
    }

    if (path === 'verify-code') {
      const { email, code, password, firstName, lastName } = JSON.parse(event.body || '{}');
      if (!email || !code || !password) return json({ error: 'جميع الحقول مطلوبة' }, 400);
      const { data: stored } = await supabase().from('verification_codes').select('*').eq('email', email).eq('type', 'signup').order('created_at', { ascending: false }).limit(1);
      const s = stored && stored.length ? stored[0] : null;
      if (!s) return json({ error: 'لم يتم إرسال كود لهذا البريد' }, 400);
      if (Date.now() > new Date(s.expires_at).getTime()) return json({ error: 'انتهت صلاحية الكود' }, 400);
      if (s.code !== code) return json({ error: 'الكود غير صحيح' }, 400);
      await supabase().from('verification_codes').delete().eq('email', email).eq('type', 'signup');
      const hash = await bcrypt.hash(password, 10);
      await supabase().from('users').insert({ email, first_name: firstName, last_name: lastName, password_hash: hash, verified: true });
      return json({ message: 'تم تفعيل الحساب بنجاح', email });
    }

    return json({ error: 'مش موجود: ' + path }, 404);
  } catch (err) {
    return json({ error: err.message || 'خطأ داخلي' }, 500);
  }
};
