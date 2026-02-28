import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 5000);
const JWT_SECRET = process.env.JWT_SECRET || 'propertysetu-dev-secret';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.join(__dirname, '..');

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});
app.use(express.static(webRoot));

const bids = [];
const users = [];

const disposableDomains = new Set([
  'mailinator.com',
  'tempmail.com',
  '10minutemail.com',
  'guerrillamail.com',
  'yopmail.com',
]);

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const normalizePhone = (value) => String(value || '').replace(/\D/g, '');

const signToken = (user) => jwt.sign({ id: user.id, role: user.role, name: user.name, email: user.email, phone: user.phone }, JWT_SECRET, { expiresIn: '24h' });

const authGuard = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    res.status(401).json({ ok: false, message: 'Missing auth token.' });
    return;
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ ok: false, message: 'Invalid or expired token.' });
  }
};

const findUserByIdentifier = (identifierType, identifierValue, role) => {
  if (identifierType === 'mobile') {
    return users.find((entry) => entry.phone === identifierValue && entry.role === role);
  }
  return users.find((entry) => entry.email === identifierValue && entry.role === role);
};

const detectFakeSignup = ({ name, email, phone, password }) => {
  const reasons = [];
  if (/\b(test|fake|spam|demo user)\b/i.test(name)) reasons.push('Suspicious name pattern detected.');

  const domain = email.includes('@') ? email.split('@')[1] : '';
  if (domain && disposableDomains.has(domain)) reasons.push('Disposable email domains are not allowed.');

  if (phone && /^(\d)\1{9}$/.test(phone)) reasons.push('Invalid mobile number pattern detected.');

  if (/^(123456|1234567|password|qwerty)/i.test(password)) reasons.push('Password is too weak for a genuine account.');

  const duplicateCount = users.filter((entry) => (email && entry.email === email) || (phone && entry.phone === phone)).length;
  if (duplicateCount >= 2) reasons.push('Too many accounts detected with same identifier.');

  return {
    isFake: reasons.length > 0,
    reasons,
  };
};

app.get('/api', (_req, res) => {
  res.json({
    ok: true,
    service: 'PropertySetu API',
    version: '1.2.0',
    features: ['static-site', 'auth', 'sealed-bid-demo', 'health', 'security-headers'],
  });
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, uptimeSeconds: Math.floor(process.uptime()) });
});

app.post('/api/auth/register', async (req, res) => {
  const { name, email, mobile, password, role, otp } = req.body || {};
  const cleanEmail = normalizeEmail(email);
  const cleanMobile = normalizePhone(mobile);
  const cleanName = String(name || '').trim();
  const cleanRole = role === 'admin' ? 'admin' : 'customer';
  const cleanIdentifier = normalizeIdentifier(identifier || email || phone);
  const parsedPhone = sanitizePhone(phone || identifier);
  const parsedEmail = normalizeIdentifier(email || (looksLikeEmail(cleanIdentifier) ? cleanIdentifier : ''));

  if (!cleanName || (!cleanEmail && !cleanMobile) || !password || String(password).length < 6) {
    res.status(400).json({ ok: false, message: 'Name, password (min 6), and either email or mobile are required.' });
    return;
  }

  if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    res.status(400).json({ ok: false, message: 'Please enter a valid email address.' });
    return;
  }

  if (cleanMobile && !/^\d{10}$/.test(cleanMobile)) {
    res.status(400).json({ ok: false, message: 'Mobile number must be exactly 10 digits.' });
    return;
  }

  if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    res.status(400).json({ ok: false, message: 'Please enter a valid email address.' });
    return;
  }

  const fakeCheck = detectFakeSignup({ name: cleanName, email: cleanEmail, phone: cleanMobile, password: String(password) });
  if (fakeCheck.isFake) {
    res.status(422).json({ ok: false, message: `Signup blocked: ${fakeCheck.reasons.join(' ')}` });
    return;
  }

  const existing = users.find((user) => user.role === cleanRole && ((cleanEmail && user.email === cleanEmail) || (cleanMobile && user.phone === cleanMobile)));
  if (existing) {
    res.status(409).json({ ok: false, message: 'Account already exists for this role. Please login.' });
    return;
  }

  const hashedPassword = await bcrypt.hash(String(password), 10);
  const user = {
    id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: cleanName,
    email: cleanEmail || null,
    phone: cleanMobile || null,
    passwordHash: hashedPassword,
    role: cleanRole,
    verified: true,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  const token = signToken(user);

  res.status(201).json({ ok: true, token, user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role, verified: user.verified } });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, mobile, password, role, otp } = req.body || {};
  const cleanEmail = normalizeEmail(email);
  const cleanMobile = normalizePhone(mobile);
  const cleanRole = role === 'admin' ? 'admin' : 'customer';

  if (!cleanIdentifier || !password) {
    res.status(400).json({ ok: false, message: 'Email/Mobile and password are required.' });
    return;
  }

  if (String(otp || '') !== '123456') {
    res.status(400).json({ ok: false, message: 'Invalid OTP. Use demo OTP 123456.' });
    return;
  }

  if (!cleanEmail && !cleanMobile) {
    res.status(400).json({ ok: false, message: 'Please enter email or mobile to login.' });
    return;
  }

  const identifierType = cleanMobile ? 'mobile' : 'email';
  const identifierValue = cleanMobile || cleanEmail;
  const user = findUserByIdentifier(identifierType, identifierValue, cleanRole);

  if (!user) {
    res.status(404).json({ ok: false, message: 'User not found. Please signup first.' });
    return;
  }

  const validPassword = await bcrypt.compare(String(password || ''), user.passwordHash);
  if (!validPassword) {
    res.status(401).json({ ok: false, message: 'Invalid credentials.' });
    return;
  }

  const token = signToken(user);
  res.json({ ok: true, token, user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role, verified: user.verified } });
});

app.post('/api/auth/logout', authGuard, (_req, res) => {
  res.json({ ok: true, message: 'Logged out successfully. Please clear token on client.' });
});

app.get('/api/auth/me', authGuard, (req, res) => {
  res.json({ ok: true, user: req.user });
});

app.post('/api/sealed-bids', authGuard, (req, res) => {
  const { propertyId, propertyTitle, amount } = req.body || {};
  const parsedAmount = Number(amount);

  if (!propertyId || !propertyTitle || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
    res.status(400).json({ ok: false, message: 'Invalid bid payload.' });
    return;
  }

  bids.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    propertyId,
    propertyTitle,
    amount: parsedAmount,
    bidderId: req.user.id,
    bidderName: req.user.name,
    createdAt: new Date().toISOString(),
  });

  res.status(201).json({ ok: true, message: 'Bid submitted successfully.' });
});

app.get('/api/sealed-bids/reveal', authGuard, (req, res) => {
  if (req.user.role !== 'admin') {
    res.status(403).json({ ok: false, message: 'Only admin can reveal bids.' });
    return;
  }

  const winnersByProperty = {};
  for (const bid of bids) {
    if (!winnersByProperty[bid.propertyId] || bid.amount > winnersByProperty[bid.propertyId].amount) {
      winnersByProperty[bid.propertyId] = bid;
    }
  }

  res.json({ ok: true, totalBids: bids.length, winners: Object.values(winnersByProperty) });
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(webRoot, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`PropertySetu server running on http://localhost:${PORT}`);
});
