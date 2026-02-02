require('dotenv').config();
const express = require('express');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const nodemailer = require('nodemailer');
const { body, validationResult } = require('express-validator');

const app = express();
const PORT = process.env.PORT || 3000;

// Basic security + parsing
app.use(helmet());
app.use(express.json({ limit: '10kb' }));

const corsOptions = {};
if (process.env.ALLOWED_ORIGIN) {
  corsOptions.origin = process.env.ALLOWED_ORIGIN;
} else {
  corsOptions.origin = true; // allow all if not configured
}
app.use(cors(corsOptions));

// Rate limiter - protect the contact endpoint
const contactLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: process.env.RATE_LIMIT_MAX ? parseInt(process.env.RATE_LIMIT_MAX) : 6,
  message: { error: 'Too many requests, please try again later.' }
});

// create transporter
function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn('SMTP config missing. Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  });
}

const transporter = createTransporter();

// Health
app.get('/ping', (req, res) => res.json({ ok: true }));

// Contact endpoint
app.post('/api/contact', contactLimiter, [
  body('name').trim().isLength({ min: 1, max: 200 }).escape(),
  body('email').trim().isEmail().normalizeEmail(),
  body('message').trim().isLength({ min: 1, max: 5000 }).escape(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', details: errors.array() });
  }

  const { name, email, message } = req.body;

  const to = process.env.TO_EMAIL || process.env.SMTP_USER;
  if (!to) {
    return res.status(500).json({ error: 'Recipient not configured on server.' });
  }

  const mailOptions = {
    from: process.env.FROM_EMAIL || (process.env.SMTP_USER || 'no-reply@example.com'),
    to,
    subject: `CHAOS website contact - ${name}`,
    text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
    html: `
      <h3>CHAOS website contact</h3>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <hr/>
      <p>${message.replace(/\n/g, '<br/>')}</p>
    `,
    replyTo: email,
  };

  try {
    await transporter.sendMail(mailOptions);
    return res.json({ ok: true });
  } catch (err) {
    console.error('Failed to send email', err && err.message ? err.message : err);
    return res.status(500).json({ error: 'Failed to send message' });
  }
});

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.listen(PORT, () => {
  console.log(`Contact server running on port ${PORT}`);
});
