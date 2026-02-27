import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 5000);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.join(__dirname, '..');

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(webRoot));

const bids = [];

app.get('/api', (_req, res) => {
  res.json({
    ok: true,
    service: 'PropertySetu API',
    version: '1.0.0',
    features: ['static-site', 'sealed-bid-demo', 'health'],
  });
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, uptimeSeconds: Math.floor(process.uptime()) });
});

app.post('/api/sealed-bids', (req, res) => {
  const { propertyId, propertyTitle, amount, bidderName } = req.body || {};
  const parsedAmount = Number(amount);

  if (!propertyId || !propertyTitle || !bidderName || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
    res.status(400).json({ ok: false, message: 'Invalid bid payload.' });
    return;
  }

  bids.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    propertyId,
    propertyTitle,
    amount: parsedAmount,
    bidderName,
    createdAt: new Date().toISOString(),
  });

  res.status(201).json({ ok: true, message: 'Bid submitted successfully.' });
});

app.get('/api/sealed-bids/reveal', (req, res) => {
  const adminKey = req.query.adminKey;
  const expectedAdminKey = process.env.ADMIN_KEY || 'propertysetu-admin';

  if (adminKey !== expectedAdminKey) {
    res.status(401).json({ ok: false, message: 'Unauthorized admin key.' });
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
