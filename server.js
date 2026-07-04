const express = require('express');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: '*' }));
app.use(express.json());

// In-memory storage (replace with DB for production)
const users = {};
const verificationCodes = {};

// Email transporter
let transporter;

async function initTransporter() {
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });
    console.log('Using Gmail SMTP');
  } else {
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass }
    });
    console.log('Using Ethereal test email:', testAccount.user);
  }
}

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send verification code
app.post('/api/send-verification', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) return res.status(400).json({ error: 'البريد الإلكتروني مطلوب' });

    if (users[email] && users[email].verified) {
      return res.status(400).json({ error: 'البريد الإلكتروني مستخدم بالفعل' });
    }

    const code = generateCode();
    verificationCodes[email] = { code, expires: Date.now() + 10 * 60 * 1000 };

    const info = await transporter.sendMail({
      from: '"CrazyTeam" <noreply@crazyteam.com>',
      to: email,
      subject: 'كود تفعيل حساب CrazyTeam',
      html: `
        <div dir="rtl" style="font-family: Tahoma, Arial, sans-serif; background: #0a0f19; padding: 30px; border-radius: 16px; max-width: 500px; margin: auto; border: 1px solid rgba(100,255,218,0.15);">
          <div style="text-align: center; margin-bottom: 25px;">
            <div style="width: 60px; height: 60px; margin: 0 auto 15px; background: linear-gradient(135deg, #64ffda, #00d4a3); border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 900; color: #0a0f19;">C</div>
            <h1 style="color: #ffffff; font-size: 22px; margin: 0;">مرحباً بك في CrazyTeam</h1>
          </div>
          <p style="color: rgba(255,255,255,0.7); font-size: 15px; text-align: center;">كود التفعيل الخاص بك هو:</p>
          <div style="text-align: center; margin: 25px 0;">
            <span style="font-size: 36px; font-weight: 900; color: #64ffda; letter-spacing: 8px; font-family: 'Courier New', monospace; text-shadow: 0 0 20px rgba(100,255,218,0.3);">${code}</span>
          </div>
          <p style="color: rgba(255,255,255,0.4); font-size: 13px; text-align: center;">ينتهي الكود بعد 10 دقائق</p>
          <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.05); margin: 25px 0;">
          <p style="color: rgba(255,255,255,0.3); font-size: 12px; text-align: center;">إذا لم تطلب هذا الكود، تجاهل هذه الرسالة.</p>
        </div>
      `
    });

    if (process.env.EMAIL_USER) {
      console.log('Verification code sent to:', email);
    } else {
      console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
    }

    res.json({ message: 'تم إرسال الكود', preview: nodemailer.getTestMessageUrl(info) });
  } catch (err) {
    console.error('Send verification error:', err);
    res.status(500).json({ error: 'فشل إرسال الكود' });
  }
});

// Verify code & register
app.post('/api/verify-code', async (req, res) => {
  try {
    const { email, code, password, firstName, lastName } = req.body;

    if (!email || !code || !password) {
      return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
    }

    const stored = verificationCodes[email];
    if (!stored) return res.status(400).json({ error: 'لم يتم إرسال كود لهذا البريد' });
    if (Date.now() > stored.expires) return res.status(400).json({ error: 'انتهت صلاحية الكود' });
    if (stored.code !== code) return res.status(400).json({ error: 'الكود غير صحيح' });

    delete verificationCodes[email];

    const hashedPassword = await bcrypt.hash(password, 10);
    users[email] = { email, firstName, lastName, password: hashedPassword, verified: true, createdAt: new Date() };

    res.json({ message: 'تم تفعيل الحساب بنجاح', email });
  } catch (err) {
    console.error('Verify error:', err);
    res.status(500).json({ error: 'حدث خطأ في التفعيل' });
  }
});

// Login - send verification code
app.post('/api/send-login-code', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'البريد الإلكتروني وكلمة المرور مطلوبان' });
    }

    const user = users[email];
    if (!user) return res.status(400).json({ error: 'بريد إلكتروني أو كلمة مرور غير صحيحة' });
    if (!user.verified) return res.status(400).json({ error: 'الحساب غير مفعل' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: 'بريد إلكتروني أو كلمة مرور غير صحيحة' });

    const code = generateCode();
    verificationCodes['login_' + email] = { code, expires: Date.now() + 10 * 60 * 1000 };

    const info = await transporter.sendMail({
      from: '"CrazyTeam" <noreply@crazyteam.com>',
      to: email,
      subject: 'كود تسجيل الدخول - CrazyTeam',
      html: `
        <div dir="rtl" style="font-family: Tahoma, Arial, sans-serif; background: #0a0f19; padding: 30px; border-radius: 16px; max-width: 500px; margin: auto; border: 1px solid rgba(100,255,218,0.15);">
          <div style="text-align: center; margin-bottom: 25px;">
            <div style="width: 60px; height: 60px; margin: 0 auto 15px; background: linear-gradient(135deg, #64ffda, #00d4a3); border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 900; color: #0a0f19;">C</div>
            <h1 style="color: #ffffff; font-size: 22px; margin: 0;">تسجيل الدخول - CrazyTeam</h1>
          </div>
          <p style="color: rgba(255,255,255,0.7); font-size: 15px; text-align: center;">كود تسجيل الدخول الخاص بك هو:</p>
          <div style="text-align: center; margin: 25px 0;">
            <span style="font-size: 36px; font-weight: 900; color: #64ffda; letter-spacing: 8px; font-family: 'Courier New', monospace; text-shadow: 0 0 20px rgba(100,255,218,0.3);">${code}</span>
          </div>
          <p style="color: rgba(255,255,255,0.4); font-size: 13px; text-align: center;">ينتهي الكود بعد 10 دقائق</p>
          <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.05); margin: 25px 0;">
          <p style="color: rgba(255,255,255,0.3); font-size: 12px; text-align: center;">إذا لم تطلب هذا الكود، تجاهل هذه الرسالة.</p>
        </div>
      `
    });

    console.log('Login code sent to:', email);
    res.json({ message: 'تم إرسال كود تسجيل الدخول', email });
  } catch (err) {
    console.error('Send login code error:', err);
    res.status(500).json({ error: 'فشل إرسال الكود' });
  }
});

// Verify login code
app.post('/api/verify-login-code', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: 'البريد الإلكتروني والكود مطلوبان' });
    }

    const stored = verificationCodes['login_' + email];
    if (!stored) return res.status(400).json({ error: 'لم يتم إرسال كود لهذا البريد' });
    if (Date.now() > stored.expires) return res.status(400).json({ error: 'انتهت صلاحية الكود' });
    if (stored.code !== code) return res.status(400).json({ error: 'الكود غير صحيح' });

    delete verificationCodes['login_' + email];
    res.json({ message: 'تم تسجيل الدخول بنجاح', email });
  } catch (err) {
    console.error('Verify login code error:', err);
    res.status(500).json({ error: 'حدث خطأ في التحقق' });
  }
});

// Serve frontend files
app.use(express.static(__dirname));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

initTransporter().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CrazyTeam server running on http://localhost:${PORT}`);
  });
});
