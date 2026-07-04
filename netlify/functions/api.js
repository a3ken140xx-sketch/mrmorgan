const express = require('express');
const serverless = require('serverless-http');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');

const app = express();
app.use(express.json());

const users = {};
const verificationCodes = {};

let transporter;

async function initTransporter() {
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });
  } else {
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass }
    });
  }
}

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

app.post('/api/send-verification', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'البريد الإلكتروني مطلوب' });
    if (users[email] && users[email].verified) {
      return res.status(400).json({ error: 'البريد الإلكتروني مستخدم بالفعل' });
    }
    const code = generateCode();
    verificationCodes[email] = { code, expires: Date.now() + 10 * 60 * 1000 };
    await transporter.sendMail({
      from: '"CrazyTeam" <noreply@crazyteam.com>',
      to: email,
      subject: 'كود تفعيل حساب CrazyTeam',
      html: emailTemplate(code, 'مرحباً بك في CrazyTeam', 'كود التفعيل الخاص بك هو:')
    });
    res.json({ message: 'تم إرسال الكود' });
  } catch (err) {
    res.status(500).json({ error: 'فشل إرسال الكود' });
  }
});

app.post('/api/verify-code', async (req, res) => {
  try {
    const { email, code, password, firstName, lastName } = req.body;
    if (!email || !code || !password) return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
    const stored = verificationCodes[email];
    if (!stored) return res.status(400).json({ error: 'لم يتم إرسال كود لهذا البريد' });
    if (Date.now() > stored.expires) return res.status(400).json({ error: 'انتهت صلاحية الكود' });
    if (stored.code !== code) return res.status(400).json({ error: 'الكود غير صحيح' });
    delete verificationCodes[email];
    const hashedPassword = await bcrypt.hash(password, 10);
    users[email] = { email, firstName, lastName, password: hashedPassword, verified: true, createdAt: new Date() };
    res.json({ message: 'تم تفعيل الحساب بنجاح', email });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ في التفعيل' });
  }
});

app.post('/api/send-login-code', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'البريد الإلكتروني وكلمة المرور مطلوبان' });
    const user = users[email];
    if (!user) return res.status(400).json({ error: 'بريد إلكتروني أو كلمة مرور غير صحيحة' });
    if (!user.verified) return res.status(400).json({ error: 'الحساب غير مفعل' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: 'بريد إلكتروني أو كلمة مرور غير صحيحة' });
    const code = generateCode();
    verificationCodes['login_' + email] = { code, expires: Date.now() + 10 * 60 * 1000 };
    await transporter.sendMail({
      from: '"CrazyTeam" <noreply@crazyteam.com>',
      to: email,
      subject: 'كود تسجيل الدخول - CrazyTeam',
      html: emailTemplate(code, 'تسجيل الدخول - CrazyTeam', 'كود تسجيل الدخول الخاص بك هو:')
    });
    res.json({ message: 'تم إرسال كود تسجيل الدخول', email });
  } catch (err) {
    res.status(500).json({ error: 'فشل إرسال الكود' });
  }
});

app.post('/api/verify-login-code', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: 'البريد الإلكتروني والكود مطلوبان' });
    const stored = verificationCodes['login_' + email];
    if (!stored) return res.status(400).json({ error: 'لم يتم إرسال كود لهذا البريد' });
    if (Date.now() > stored.expires) return res.status(400).json({ error: 'انتهت صلاحية الكود' });
    if (stored.code !== code) return res.status(400).json({ error: 'الكود غير صحيح' });
    delete verificationCodes['login_' + email];
    res.json({ message: 'تم تسجيل الدخول بنجاح', email });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ في التحقق' });
  }
});

function emailTemplate(code, title, subtitle) {
  return `
    <div dir="rtl" style="font-family: Tahoma, Arial, sans-serif; background: #0a0f19; padding: 30px; border-radius: 16px; max-width: 500px; margin: auto; border: 1px solid rgba(100,255,218,0.15);">
      <div style="text-align: center; margin-bottom: 25px;">
        <div style="width: 60px; height: 60px; margin: 0 auto 15px; background: linear-gradient(135deg, #64ffda, #00d4a3); border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 900; color: #0a0f19;">C</div>
        <h1 style="color: #ffffff; font-size: 22px; margin: 0;">${title}</h1>
      </div>
      <p style="color: rgba(255,255,255,0.7); font-size: 15px; text-align: center;">${subtitle}</p>
      <div style="text-align: center; margin: 25px 0;">
        <span style="font-size: 36px; font-weight: 900; color: #64ffda; letter-spacing: 8px; font-family: 'Courier New', monospace; text-shadow: 0 0 20px rgba(100,255,218,0.3);">${code}</span>
      </div>
      <p style="color: rgba(255,255,255,0.4); font-size: 13px; text-align: center;">ينتهي الكود بعد 10 دقائق</p>
      <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.05); margin: 25px 0;">
      <p style="color: rgba(255,255,255,0.3); font-size: 12px; text-align: center;">إذا لم تطلب هذا الكود، تجاهل هذه الرسالة.</p>
    </div>`;
}

let handler;

async function getHandler() {
  if (!transporter) await initTransporter();
  if (!handler) handler = serverless(app);
  return handler;
}

exports.handler = async (event, context) => {
  const h = await getHandler();
  return h(event, context);
};
