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

const signToken = (user) => jwt.sign(
  {
    id: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    phone: user.phone,
  },
  JWT_SECRET,
  { expiresIn: '24h' },
);

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

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const normalizePhone = (value) => String(value || '').replace(/\D/g, '');
const normalizeName = (value) => String(value || '').trim().replace(/\s+/g, ' ');

const looksLikeEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const looksLikePhone = (value) => /^\d{10}$/.test(value);

const blockedEmailPatterns = [
  /@example\.com$/i,
  /@test\.com$/i,
  /@mailinator\.com$/i,
  /@tempmail/i,
  /\bfake\b/i,
];

const validateGenuineProfile = ({ name, email, phone, password }) => {
  if (!name || name.length < 3 || /[^a-zA-Z\s]/.test(name)) {
    return 'Please enter a genuine full name (letters and spaces only).';
  }

  if (email) {
    if (!looksLikeEmail(email)) {
      return 'Please enter a valid email address.';
    }
    if (blockedEmailPatterns.some((pattern) => pattern.test(email))) {
      return 'Disposable/test email addresses are not allowed. Please use a genuine email.';
    }
  }

  if (phone && !looksLikePhone(phone)) {
    return 'Please enter a valid 10-digit Indian mobile number.';
  }

  if (!email && !phone) {
    return 'Provide at least one contact method: email or mobile number.';
  }

  if (!password || password.length < 6) {
    return 'Password must contain at least 6 characters.';
  }

  if (/^(123456|password|qwerty|000000)$/i.test(password)) {
    return 'Weak password detected. Please choose a stronger password.';
  }

  return null;
};

const findUserByIdentifier = ({ role, identifier, email, phone }) => {
  const cleanIdentifier = String(identifier || '').trim().toLowerCase();
  const normalizedPhoneIdentifier = normalizePhone(identifier);

  return users.find((entry) => {
    if (entry.role !== role) return false;

    if (cleanIdentifier) {
      if (looksLikeEmail(cleanIdentifier)) return entry.email === cleanIdentifier;
      if (normalizedPhoneIdentifier) return entry.phone === normalizedPhoneIdentifier;
      return false;
    }

    if (email && entry.email === email) return true;
    if (phone && entry.phone === phone) return true;
    return false;
  });
};

app.get('/api', (_req, res) => {
  res.json({
    ok: true,
    service: 'PropertySetu API',
    version: '1.2.0',
    features: ['static-site', 'auth', 'sealed-bid-demo', 'health', 'security-headers', 'email-or-mobile-login', 'fake-profile-detection'],
  });
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, uptimeSeconds: Math.floor(process.uptime()) });
});

app.post('/api/auth/register', async (req, res) => {
  const {
    name,
    email,
    phone,
    password,
    role,
    otp,
  } = req.body || {};

  const cleanEmail = normalizeEmail(email);
  const cleanPhone = normalizePhone(phone);
  const cleanName = normalizeName(name);
  const cleanRole = role === 'admin' ? 'admin' : 'customer';

  if (String(otp || '') !== '123456') {
    res.status(400).json({ ok: false, message: 'Invalid OTP. Use demo OTP 123456.' });
    return;
  }

  const validationError = validateGenuineProfile({
    name: cleanName,
    email: cleanEmail,
    phone: cleanPhone,
    password: String(password || ''),
  });
  if (validationError) {
    res.status(400).json({ ok: false, message: validationError });
    return;
  }

  const existingUser = users.find((user) => user.role === cleanRole
    && ((cleanEmail && user.email === cleanEmail) || (cleanPhone && user.phone === cleanPhone)));

  if (existingUser) {
    res.status(409).json({ ok: false, message: 'Account already exists. Please login.' });
    return;
  }

  const hashedPassword = await bcrypt.hash(String(password), 10);
  const user = {
    id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: cleanName,
    email: cleanEmail || null,
    phone: cleanPhone || null,
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
      email: user.email,
      phone: user.phone,
      role: user.role,
      verified: user.verified,
    },
  });
});

app.post('/api/auth/login', async (req, res) => {
  const {
    identifier,
    email,
    phone,
    password,
    role,
    otp,
  } = req.body || {};

  const cleanEmail = normalizeEmail(email);
  const cleanPhone = normalizePhone(phone);
  const cleanIdentifier = String(identifier || '').trim().toLowerCase();
  const cleanRole = role === 'admin' ? 'admin' : 'customer';

  if (String(otp || '') !== '123456') {
    res.status(400).json({ ok: false, message: 'Invalid OTP. Use demo OTP 123456.' });
    return;
  }

  if (!cleanIdentifier && !cleanEmail && !cleanPhone) {
    res.status(400).json({ ok: false, message: 'Login requires email or mobile number.' });
    return;
  }

  const user = findUserByIdentifier({
    role: cleanRole,
    identifier: cleanIdentifier,
    email: cleanEmail,
    phone: cleanPhone,
  });

  if (!user) {
    res.status(404).json({ ok: false, message: 'User not found. Please sign up first.' });
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
      email: user.email,
      phone: user.phone,
      role: user.role,
      verified: user.verified,
    },
  });
});

app.post('/api/auth/logout', (_req, res) => {
  res.json({ ok: true, message: 'Logged out successfully.' });
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
