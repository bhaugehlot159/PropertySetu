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

const signToken = (user) => jwt.sign({ id: user.id, role: user.role, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '24h' });

const normalizeIdentifier = (value) => String(value || '').trim().toLowerCase();
const sanitizePhone = (value) => String(value || '').replace(/\D/g, '');
const looksLikeEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const findUserByIdentifier = (identifier, role) => {
  const cleanIdentifier = normalizeIdentifier(identifier);
  const phoneValue = sanitizePhone(identifier);

  return users.find((entry) => {
    if (entry.role !== role) return false;
    if (cleanIdentifier && entry.email === cleanIdentifier) return true;
    if (phoneValue && entry.phone === phoneValue) return true;
    return false;
  });
};

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

app.get('/api', (_req, res) => {
  res.json({
    ok: true,
    service: 'PropertySetu API',
    version: '1.1.0',
    features: ['static-site', 'auth', 'sealed-bid-demo', 'health', 'security-headers'],
  });
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, uptimeSeconds: Math.floor(process.uptime()) });
});

app.post('/api/auth/register', async (req, res) => {
  const { name, identifier, email, phone, password, role, otp } = req.body || {};
  const cleanName = String(name || '').trim();
  const cleanRole = role === 'admin' ? 'admin' : 'customer';
  const cleanIdentifier = normalizeIdentifier(identifier || email || phone);
  const parsedPhone = sanitizePhone(phone || identifier);
  const parsedEmail = normalizeIdentifier(email || (looksLikeEmail(cleanIdentifier) ? cleanIdentifier : ''));

  if (!cleanName || !cleanIdentifier || !password || String(password).length < 6) {
    res.status(400).json({ ok: false, message: 'Name, Email/Mobile and password (min 6) are required.' });
    return;
  }

  if (!parsedEmail && parsedPhone.length < 10) {
    res.status(400).json({ ok: false, message: 'Please enter a valid email or mobile number.' });
    return;
  }

  if (String(otp || '') !== '123456') {
    res.status(400).json({ ok: false, message: 'Invalid OTP. Use demo OTP 123456.' });
    return;
  }

  const existing = findUserByIdentifier(cleanIdentifier, cleanRole);
  if (existing) {
    res.status(409).json({ ok: false, message: 'Account already exists for this role. Please login.' });
    return;
  }

  const hashedPassword = await bcrypt.hash(String(password), 10);
  const user = {
    id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: cleanName,
    email: parsedEmail || `${parsedPhone}@mobile.propertysetu.in`,
    phone: parsedPhone || '',
    passwordHash: hashedPassword,
    role: cleanRole,
    verified: true,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  const token = signToken(user);

  res.status(201).json({
    ok: true,
    token,
    user: {
      id: user.id,
      name: user.name,
      email: parsedEmail,
      phone: user.phone,
      role: user.role,
      verified: user.verified,
      loginIdentifierType: parsedEmail ? 'email' : 'mobile',
    },
  });
});

app.post('/api/auth/login', async (req, res) => {
  const { identifier, email, phone, password, role, otp } = req.body || {};
  const cleanIdentifier = normalizeIdentifier(identifier || email || phone);
  const cleanRole = role === 'admin' ? 'admin' : 'customer';

  if (!cleanIdentifier || !password) {
    res.status(400).json({ ok: false, message: 'Email/Mobile and password are required.' });
    return;
  }

  if (String(otp || '') !== '123456') {
    res.status(400).json({ ok: false, message: 'Invalid OTP. Use demo OTP 123456.' });
    return;
  }

  const user = findUserByIdentifier(cleanIdentifier, cleanRole);
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
  res.json({
    ok: true,
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email.includes('@mobile.propertysetu.in') ? '' : user.email,
      phone: user.phone,
      role: user.role,
      verified: user.verified,
      loginIdentifierType: looksLikeEmail(cleanIdentifier) ? 'email' : 'mobile',
    },
  });
});

app.post('/api/auth/logout', authGuard, (_req, res) => {
  res.json({ ok: true, message: 'Logout successful on client side. Please clear token.' });
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
