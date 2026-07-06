const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
const ADMIN_EMAIL = 'a3ken140xx@gmail.com';

function isAdmin(email) { return email === ADMIN_EMAIL; }
function json(body, status = 200) { return { statusCode: status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' }, body: JSON.stringify(body) }; }

function getPath(event) {
  let p = event.path || '';
  p = p.replace(/^\/\.netlify\/functions\/api\//, '');
  p = p.replace(/^\/api\//, '');
  p = p.replace(/^\//, '');
  return p;
}

exports.handler = async (event) => {
  const path = getPath(event);
  const method = event.httpMethod;

  // Hello (always works)
  if (path === 'health') return json({ ok: true, path: event.path, method, key_len: (process.env.SUPABASE_KEY || '').length, url_set: !!process.env.SUPABASE_URL });

  try {
    // Login
    if (path === 'login' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { email, password } = body;
      if (!email || !password) return json({ error: 'البريد الإلكتروني وكلمة المرور مطلوبان' }, 400);
      const { data: users, error } = await supabase.from('users').select('*').eq('email', email).limit(1);
      if (error) return json({ error: 'DB error: ' + error.message }, 500);
      const user = users && users.length ? users[0] : null;
      if (!user) return json({ error: 'بريد إلكتروني أو كلمة مرور غير صحيحة' }, 400);
      if (!user.verified) return json({ error: 'الحساب غير مفعل' }, 400);
      if (user.banned) return json({ error: 'حسابك محظور. تواصل مع الإدارة.' }, 403);
      if (!(await bcrypt.compare(password, user.password_hash))) return json({ error: 'بريد إلكتروني أو كلمة مرور غير صحيحة' }, 400);
      return json({ message: 'تم تسجيل الدخول بنجاح', email, admin: isAdmin(email) });
    }

    // All other endpoints
    if (path === 'check-admin' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      return json({ admin: isAdmin(body.email) });
    }

    if (path === 'stats/users' && method === 'GET') {
      if (!supabase) return json({ value: 0 });
      const { data } = await supabase.from('users').select('id');
      return json({ value: data ? data.length : 0 });
    }

    if (path === 'tools' && method === 'GET') {
      if (!supabase) return json([]);
      const { data } = await supabase.from('tools').select('*').order('created_at', { ascending: true });
      return json(data || []);
    }

    if (path === 'visitors' && method === 'POST') {
      if (!supabase) return json({ value: 0 });
      const ip = (event.headers['x-forwarded-for'] || '').split(',')[0].trim();
      const ua = event.headers['user-agent'] || '';
      await supabase.from('visits').insert({ ip, user_agent: ua });
      const { data } = await supabase.from('visits').select('id');
      return json({ value: data ? data.length : 0 });
    }

    if (path === 'visitors/count' && method === 'GET') {
      if (!supabase) return json({ value: 0 });
      const { data } = await supabase.from('visits').select('id');
      return json({ value: data ? data.length : 0 });
    }

    if (path === 'admin/tools' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      if (!isAdmin(body.adminEmail)) return json({ error: 'غير مصرح' }, 403);
      const { data } = await supabase.from('tools').insert({ name: body.name, description: body.description, icon: body.icon || 'fa-shield-halved', download_url: body.download_url, video_url: body.video_url || '', tag1: body.tag1 || 'جديد', tag2: body.tag2 || 'v1.0', rating: body.rating || '4.9' }).select().single();
      return json(data);
    }

    const toolMatch = path.match(/^admin\/tools\/(.+)/);
    if (toolMatch && method === 'DELETE') {
      const q = event.queryStringParameters || {};
      if (!isAdmin(q.admin)) return json({ error: 'غير مصرح' }, 403);
      await supabase.from('tools').delete().eq('id', toolMatch[1]);
      return json({ message: 'تم الحذف' });
    }

    if (path === 'admin/users' && method === 'GET') {
      const q = event.queryStringParameters || {};
      if (!isAdmin(q.admin)) return json({ error: 'غير مصرح' }, 403);
      const { data } = await supabase.from('users').select('id,email,first_name,last_name,banned,created_at').order('created_at', { ascending: false });
      return json(data || []);
    }

    const userDelMatch = path.match(/^admin\/users\/(.+)/);
    if (userDelMatch && method === 'DELETE') {
      const q = event.queryStringParameters || {};
      if (!isAdmin(q.admin)) return json({ error: 'غير مصرح' }, 403);
      await supabase.from('users').delete().eq('email', decodeURIComponent(userDelMatch[1]));
      return json({ message: 'تم الحذف' });
    }

    const userBanMatch = path.match(/^admin\/users\/(.+)\/ban/);
    if (userBanMatch && method === 'PUT') {
      const body = JSON.parse(event.body || '{}');
      if (!isAdmin(body.adminEmail)) return json({ error: 'غير مصرح' }, 403);
      await supabase.from('users').update({ banned: body.banned }).eq('email', decodeURIComponent(userBanMatch[1]));
      return json({ message: 'تم التحديث' });
    }

    if (path === 'send-verification' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { email } = body;
      if (!email) return json({ error: 'البريد الإلكتروني مطلوب' }, 400);
      const { data: existing } = await supabase.from('users').select('id').eq('email', email).limit(1);
      if (existing && existing.length) return json({ error: 'البريد الإلكتروني مستخدم بالفعل' }, 400);
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      await supabase.from('verification_codes').insert({ email, code, type: 'signup', expires_at: expires });
      return json({ message: 'تم إرسال الكود', code });
    }

    if (path === 'verify-code' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { email, code, password, firstName, lastName } = body;
      if (!email || !code || !password) return json({ error: 'جميع الحقول مطلوبة' }, 400);
      const { data: stored } = await supabase.from('verification_codes').select('*').eq('email', email).eq('type', 'signup').order('created_at', { ascending: false }).limit(1);
      const s = stored && stored.length ? stored[0] : null;
      if (!s) return json({ error: 'لم يتم إرسال كود لهذا البريد' }, 400);
      if (Date.now() > new Date(s.expires_at).getTime()) return json({ error: 'انتهت صلاحية الكود' }, 400);
      if (s.code !== code) return json({ error: 'الكود غير صحيح' }, 400);
      await supabase.from('verification_codes').delete().eq('email', email).eq('type', 'signup');
      const hash = await bcrypt.hash(password, 10);
      await supabase.from('users').insert({ email, first_name: firstName, last_name: lastName, password_hash: hash, verified: true }).select().single();
      return json({ message: 'تم تفعيل الحساب بنجاح', email });
    }

    return json({ error: 'مش موجود: ' + path }, 404);
  } catch (err) {
    console.error('API error:', err);
    return json({ error: err.message || 'خطأ داخلي' }, 500);
  }
};
