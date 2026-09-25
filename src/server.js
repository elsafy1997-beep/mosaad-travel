import express from 'express';
import session from 'express-session';
import bcrypt from 'bcryptjs';
import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import { db, initDb, getSettings, setSetting } from './db.js';
import { requireAuth } from './auth.js';
import multer from 'multer';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
initDb();

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 24 * 7 }
}));
app.use(express.static(path.join(__dirname, '../public')));

const ok = (res, data) => res.json(data);
const err = (res, code, msg) => res.status(code).json({ error: msg });

/* ===== PUBLIC API ===== */
app.get('/api/settings', (req, res) => ok(res, getSettings()));

app.get('/api/destinations', (req, res) =>
  ok(res, db.prepare('SELECT * FROM destinations WHERE active=1 ORDER BY sort_order').all()));

app.get('/api/hotels', (req, res) => {
  const { city, stars, max_price } = req.query;
  let q = 'SELECT * FROM hotels WHERE active=1'; const p = [];
  if (city)      { q += ' AND city=?';      p.push(city); }
  if (stars)     { q += ' AND stars=?';     p.push(stars); }
  if (max_price) { q += ' AND price_rub<=?'; p.push(max_price); }
  q += ' ORDER BY price_rub';
  ok(res, db.prepare(q).all(...p));
});
app.get('/api/hotels/:id', (req, res) => {
  const r = db.prepare('SELECT * FROM hotels WHERE id=?').get(req.params.id);
  if (!r) return err(res, 404, 'Not found');
  r.prices = db.prepare('SELECT * FROM hotel_prices WHERE hotel_id=? ORDER BY date_from').all(req.params.id);
  ok(res, r);
});
app.get('/api/hotels/:id/price', (req, res) => {
  const { id } = req.params;
  const { from, to } = req.query;
  if (!from || !to) return err(res, 400, 'from and to required');
  const hotel = db.prepare('SELECT * FROM hotels WHERE id=?').get(id);
  if (!hotel) return err(res, 404, 'Hotel not found');
  const result = calcHotelPrice(hotel, from, to);
  ok(res, result);
});

/* ===== RESTAURANTS ===== */
app.get('/api/restaurants', (req, res) => {
  const { city } = req.query;
  let q = 'SELECT * FROM restaurants WHERE active=1'; const p = [];
  if (city) { q += ' AND city=?'; p.push(city); }
  q += ' ORDER BY id DESC';
  ok(res, db.prepare(q).all(...p));
});

app.get('/api/services', (req, res) =>
  ok(res, db.prepare('SELECT * FROM services WHERE active=1 ORDER BY id').all()));

app.get('/api/events', (req, res) =>
  ok(res, db.prepare('SELECT * FROM events WHERE active=1 ORDER BY event_date').all()));

app.get('/api/universities', (req, res) => {
  const { city } = req.query;
  let q = 'SELECT * FROM universities WHERE active=1'; const p = [];
  if (city) { q += ' AND city=?'; p.push(city); }
  ok(res, db.prepare(q + ' ORDER BY name_ar').all(...p));
});

app.post('/api/leads', (req, res) => {
  try {
    const d = req.body || {};
    if (!d.name) return err(res, 400, 'الاسم مطلوب');
    const count = db.prepare('SELECT COUNT(*) c FROM leads').get().c + 1;
    const code = 'MOSAAD-' + String(count).padStart(4, '0');
    const info = db.prepare(
      `INSERT INTO leads (code,name,country,phone,whatsapp,persons,arrival,departure,city,hotel_id,services,estimated_rub,currency,notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run(
      code, d.name, d.country || '', d.phone || '', d.whatsapp || d.phone || '',
      d.persons || 1, d.arrival || '', d.departure || '', d.city || '',
      d.hotel_id || null, JSON.stringify(d.services || []),
      d.estimated_rub || 0, d.currency || 'RUB', d.notes || ''
    );
    ok(res, { ok: true, code, id: info.lastInsertRowid });
  } catch (e) {
    console.error(e);
    err(res, 500, 'حدث خطأ أثناء إرسال الطلب');
  }
});

/* ===== AUTH ===== */
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return err(res, 400, 'بيانات ناقصة');
  const admin = db.prepare('SELECT * FROM admins WHERE username=?').get(username);
  if (!admin || !bcrypt.compareSync(password, admin.password_hash))
    return err(res, 401, 'بيانات الدخول غير صحيحة');
  req.session.adminId = admin.id;
  req.session.username = admin.username;
  ok(res, { ok: true, username: admin.username });
});
app.post('/api/auth/logout', (req, res) =>
  req.session.destroy(() => ok(res, { ok: true })));
app.get('/api/auth/me', (req, res) => {
  if (req.session?.adminId) return ok(res, { ok: true, username: req.session.username });
  err(res, 401, 'not logged in');
});

/* ===== ADMIN ===== */
app.use('/api/admin', requireAuth);

/* ===== FILE UPLOAD ===== */
const uploadsDir = path.join(__dirname, '../public/uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safe = Date.now() + '-' + Math.round(Math.random() * 1e9) + ext;
    cb(null, safe);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /jpeg|jpg|png|gif|webp/.test(file.mimetype);
    cb(ok ? null : new Error('نوع الملف غير مسموح'), ok);
  }
});
app.post('/api/admin/upload', upload.single('image'), (req, res) => {
  if (!req.file) return err(res, 400, 'لم يتم رفع أي صورة');
  ok(res, { ok: true, url: '/uploads/' + req.file.filename });
});

function crud(table, fields) {
  const r = express.Router();
  r.get('/', (req, res) => ok(res, db.prepare(`SELECT * FROM ${table} ORDER BY id DESC`).all()));
  r.post('/', (req, res) => {
    const data = {};
    fields.forEach(f => { data[f] = req.body[f] ?? null; });
    const cols = Object.keys(data).join(',');
    const ph = Object.keys(data).map(() => '?').join(',');
    const info = db.prepare(`INSERT INTO ${table} (${cols}) VALUES (${ph})`).run(...Object.values(data));
    ok(res, { ok: true, id: info.lastInsertRowid });
  });
  r.put('/:id', (req, res) => {
    const data = {};
    fields.forEach(f => { if (f in req.body) data[f] = req.body[f]; });
    if (!Object.keys(data).length) return ok(res, { ok: true });
    const sets = Object.keys(data).map(k => `${k}=?`).join(',');
    db.prepare(`UPDATE ${table} SET ${sets} WHERE id=?`).run(...Object.values(data), req.params.id);
    ok(res, { ok: true });
  });
  r.delete('/:id', (req, res) => {
    db.prepare(`DELETE FROM ${table} WHERE id=?`).run(req.params.id);
    ok(res, { ok: true });
  });
  return r;
}

app.use('/api/admin/hotels',       crud('hotels',       ['name','city','stars','room_type','breakfast','price_rub','description','address','image','active']));
app.use('/api/admin/restaurants',  crud('restaurants',  ['name','city','cuisine','note','image','active']));
app.use('/api/admin/services',     crud('services',     ['name','description','price_rub','price_unit','city','image','active']));
app.use('/api/admin/events',       crud('events',       ['name','city','event_date','venue','price_rub','description','image','active']));
app.use('/api/admin/universities', crud('universities', ['name_ar','name_ru','name_en','city','specializations','tuition_rub','housing','image','description','website','active']));
app.use('/api/admin/destinations', crud('destinations', ['name_ar','name_ru','name_en','description','image','active','sort_order']));

/* ===== HOTEL PRICES ===== */
app.get('/api/admin/hotels/:id/prices', (req, res) => {
  const rows = db.prepare('SELECT * FROM hotel_prices WHERE hotel_id=? ORDER BY date_from').all(req.params.id);
  ok(res, rows);
});
app.post('/api/admin/hotels/:id/prices', (req, res) => {
  const { date_from, date_to, price_rub, label } = req.body || {};
  if (!date_from || !date_to || !price_rub)
    return err(res, 400, 'date_from, date_to, price_rub مطلوبة');
  if (new Date(date_to) < new Date(date_from))
    return err(res, 400, 'تاريخ النهاية يجب أن يكون بعد البداية');
  const conflict = db.prepare(
    `SELECT * FROM hotel_prices WHERE hotel_id=? AND NOT (date_to < ? OR date_from > ?)`
  ).get(req.params.id, date_from, date_to);
  if (conflict)
    return err(res, 400, 'الفترة تتداخل مع فترة موجودة (' + conflict.date_from + ' → ' + conflict.date_to + ')');
  const info = db.prepare(
    `INSERT INTO hotel_prices (hotel_id, date_from, date_to, price_rub, label)
     VALUES (?,?,?,?,?)`
  ).run(req.params.id, date_from, date_to, +price_rub, label || '');
  ok(res, { ok: true, id: info.lastInsertRowid });
});
app.delete('/api/admin/hotel-prices/:id', (req, res) => {
  db.prepare('DELETE FROM hotel_prices WHERE id=?').run(req.params.id);
  ok(res, { ok: true });
});

/* ===== LEADS ===== */
app.get('/api/admin/leads', (req, res) =>
  ok(res, db.prepare('SELECT * FROM leads ORDER BY id DESC').all()));
app.get('/api/admin/leads/:id', (req, res) => {
  const r = db.prepare('SELECT * FROM leads WHERE id=?').get(req.params.id);
  r ? ok(res, r) : err(res, 404, 'Not found');
});
app.put('/api/admin/leads/:id', (req, res) => {
  const fields = ['status', 'notes', 'estimated_rub'];
  const data = {};
  fields.forEach(f => { if (f in req.body) data[f] = req.body[f]; });
  if (!Object.keys(data).length) return ok(res, { ok: true });
  const sets = Object.keys(data).map(k => `${k}=?`).join(',');
  db.prepare(`UPDATE leads SET ${sets} WHERE id=?`).run(...Object.values(data), req.params.id);
  ok(res, { ok: true });
});
app.delete('/api/admin/leads/:id', (req, res) => {
  db.prepare('DELETE FROM leads WHERE id=?').run(req.params.id);
  ok(res, { ok: true });
});

/* ===== STATS ===== */
app.get('/api/admin/stats', (req, res) => ok(res, {
  leads_total:         db.prepare('SELECT COUNT(*) c FROM leads').get().c,
  leads_new:           db.prepare("SELECT COUNT(*) c FROM leads WHERE status='new'").get().c,
  leads_booked:        db.prepare("SELECT COUNT(*) c FROM leads WHERE status='booked'").get().c,
  hotels_total:        db.prepare('SELECT COUNT(*) c FROM hotels').get().c,
  restaurants_total:   db.prepare('SELECT COUNT(*) c FROM restaurants').get().c,
  services_total:      db.prepare('SELECT COUNT(*) c FROM services').get().c,
  events_total:        db.prepare('SELECT COUNT(*) c FROM events').get().c,
  universities_total:  db.prepare('SELECT COUNT(*) c FROM universities').get().c,
  revenue_estimate:    db.prepare('SELECT COALESCE(SUM(estimated_rub),0) s FROM leads').get().s,
  by_city:             db.prepare(`SELECT city, COUNT(*) c FROM leads WHERE city<>'' GROUP BY city ORDER BY c DESC LIMIT 8`).all(),
  recent_leads:        db.prepare('SELECT id,code,name,city,estimated_rub,status,created_at FROM leads ORDER BY id DESC LIMIT 5').all()
}));

/* ===== SETTINGS ===== */
app.get('/api/admin/settings', (req, res) => ok(res, getSettings()));
app.put('/api/admin/settings', (req, res) => {
  for (const [k, v] of Object.entries(req.body || {})) setSetting(k, v);
  ok(res, { ok: true });
});

/* ===== PASSWORD ===== */
app.post('/api/admin/password', (req, res) => {
  const { current, next } = req.body || {};
  const admin = db.prepare('SELECT * FROM admins WHERE id=?').get(req.session.adminId);
  if (!admin || !bcrypt.compareSync(current, admin.password_hash))
    return err(res, 400, 'كلمة المرور الحالية غير صحيحة');
  if (!next || next.length < 6) return err(res, 400, 'كلمة مرور قصيرة (6 أحرف على الأقل)');
  db.prepare('UPDATE admins SET password_hash=? WHERE id=?')
    .run(bcrypt.hashSync(next, 10), admin.id);
  ok(res, { ok: true });
});

/* ===== Helper: حساب سعر الفندق يوم بيوم ===== */
function calcHotelPrice(hotel, from, to) {
  const prices = db.prepare('SELECT * FROM hotel_prices WHERE hotel_id=? ORDER BY date_from').all(hotel.id);
  const start = new Date(from);
  const end = new Date(to);
  const nights = Math.max(0, Math.round((end - start) / 86400000));
  if (nights === 0) return { nights: 0, total: 0, breakdown: [], default_price: hotel.price_rub };

  const breakdown = [];
  let total = 0;
  for (let i = 0; i < nights; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const dStr = d.toISOString().split('T')[0];
    const match = prices.find(p => dStr >= p.date_from && dStr <= p.date_to);
    const price = match ? match.price_rub : hotel.price_rub;
    const label = match ? (match.label || 'موسم خاص') : 'افتراضي';
    total += price;
    const last = breakdown[breakdown.length - 1];
    if (last && last.price === price && last.label === label) {
      last.to = dStr;
      last.nights++;
      last.subtotal += price;
    } else {
      breakdown.push({ from: dStr, to: dStr, price, label, nights: 1, subtotal: price });
    }
  }
  return { nights, total, breakdown, default_price: hotel.price_rub };
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`MOSAAD running on http://localhost:${PORT}`));
