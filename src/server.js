import { calculateBooking } from './booking-engine.js';
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
// Track visits to public pages (before static, to catch only real page loads)
app.use((req, res, next) => {
  // Skip: admin, API, assets
  const p = req.path;
  const isPublicPage = 
    p === '/' || 
    p === '/index.html';
  const isAsset = /\.(css|js|png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|map)$/i.test(p);
  const isApi = p.startsWith('/api/');
  const isAdmin = p.startsWith('/admin');
  
  if (isPublicPage && !isAsset && !isApi && !isAdmin) {
    try {
      db.prepare('INSERT INTO visits (page) VALUES (?)').run(p);
    } catch (e) {
      console.warn('Visit track failed:', e.message);
    }
  }
  next();
});

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
  q += ' ORDER BY sort_order ASC, price_rub ASC';
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

/* ===== PUBLIC ADS API ===== */
app.get('/api/ads', (req, res) => {
  const { position } = req.query;
  const today = new Date().toISOString().split('T')[0];
  let q = "SELECT * FROM ads WHERE active=1 AND manual_active=1 AND (date_from IS NULL OR date_from<=?) AND (date_to IS NULL OR date_to>=?)";
  const p = [today, today];
  if (position) { q += ' AND position=?'; p.push(position); }
  q += ' ORDER BY priority DESC, id DESC LIMIT 10';
  ok(res, db.prepare(q).all(...p));
});

app.post('/api/ads/:id/event', (req, res) => {
  try {
    const { type } = req.body || {};
    if (!['impression', 'click'].includes(type)) return err(res, 400, 'نوع الحدث غير صحيح');
    db.prepare('INSERT INTO ad_events (ad_id, event_type, ip, user_agent) VALUES (?,?,?,?)')
      .run(req.params.id, type, req.ip || '', (req.headers['user-agent'] || '').slice(0, 200));
    ok(res, { ok: true });
  } catch (e) { err(res, 500, 'خطأ'); }
});

/* ===== PUBLIC TRIP PLANS API ===== */
app.post('/api/trip-plans', (req, res) => {
  try {
    const d = req.body || {};
    if (!d.client_name) return err(res, 400, 'الاسم مطلوب');
    if (!Array.isArray(d.activities) || !d.activities.length)
      return err(res, 400, 'يجب إضافة نشاط واحد على الأقل');

    const count = db.prepare('SELECT COUNT(*) c FROM trip_plans').get().c + 1;
    const code = 'TRIP-' + String(count).padStart(4, '0');

    const planInfo = db.prepare(`
      INSERT INTO trip_plans (code, client_name, client_whatsapp, country, persons, start_date, end_date, notes)
      VALUES (?,?,?,?,?,?,?,?)
    `).run(
      code, d.client_name, d.client_whatsapp || '', d.country || '',
      d.persons || 1, d.start_date || null, d.end_date || null, d.notes || ''
    );

    const planId = planInfo.lastInsertRowid;
    const insertAct = db.prepare(`
      INSERT INTO trip_activities (plan_id, day_number, day_date, time_slot, title, description, location)
      VALUES (?,?,?,?,?,?,?)
    `);

    const insertAll = db.transaction((acts) => {
      for (const a of acts) {
        insertAct.run(planId, a.day_number, a.day_date || null, a.time_slot || '',
          a.title || '', a.description || '', a.location || '');
      }
    });
    insertAll(d.activities);

    ok(res, { ok: true, code, id: planId });
  } catch (e) {
    console.error(e);
    err(res, 500, 'حدث خطأ أثناء حفظ الجدول');
  }
});

/* ===== PUBLIC TRIP TEMPLATES ===== */
app.get('/api/trip-templates', (req, res) => {
  const templates = db.prepare('SELECT * FROM trip_templates WHERE active=1 ORDER BY sort_order, id').all();
  templates.forEach(t => {
    t.activities = db.prepare('SELECT * FROM trip_template_activities WHERE template_id=? ORDER BY day_number, sort_order, id').all(t.id);
  });
  ok(res, templates);
});

/* ===== PUBLIC MEDICAL API ===== */
app.get('/api/medical', (req, res) => {
  const { city, type } = req.query;
  let q = 'SELECT * FROM medical_centers WHERE active=1';
  const p = [];
  if (city) { q += ' AND city=?'; p.push(city); }
  if (type) { q += ' AND type=?'; p.push(type); }
  q += ' ORDER BY city, type, name';
  ok(res, db.prepare(q).all(...p));
});

/* ===== PUBLIC SCHOLARSHIPS API ===== */
app.get('/api/scholarships', (req, res) => {
  ok(res, db.prepare('SELECT * FROM scholarships WHERE active=1 ORDER BY id DESC').all());
});

/* ===== PUBLIC TOURS API ===== */
app.get('/api/tours', (req, res) => {
  ok(res, db.prepare('SELECT * FROM tours WHERE active=1 ORDER BY id').all());
});

/* ===== PUBLIC EXTRA SERVICES API ===== */
app.get('/api/extra-services', (req, res) => {
  ok(res, db.prepare('SELECT * FROM extra_services WHERE active=1 ORDER BY id').all());
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

app.use('/api/admin/hotels',       crud('hotels',       ['name','city','stars','room_type','breakfast','price_rub','description','address','image','website','active','sort_order']));
app.use('/api/admin/restaurants',  crud('restaurants',  ['name','city','cuisine','note','image','active']));
app.use('/api/admin/services',     crud('services',     ['name','description','price_rub','price_unit','allow_quantity','city','image','active']));
app.use('/api/admin/events',       crud('events',       ['name','city','event_date','venue','price_rub','description','image','active']));
app.use('/api/admin/universities', crud('universities', ['name_ar','name_ru','name_en','city','specializations','tuition_rub','housing','image','description','website','study_type','active']));
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

/* ===== ADMIN ADS ===== */
app.get('/api/admin/ads', (req, res) => {
  const rows = db.prepare(`
    SELECT a.*,
      (SELECT COUNT(*) FROM ad_events WHERE ad_id=a.id AND event_type='impression') AS impressions,
      (SELECT COUNT(*) FROM ad_events WHERE ad_id=a.id AND event_type='click') AS clicks
    FROM ads a ORDER BY a.id DESC
  `).all();
  ok(res, rows);
});

app.post('/api/admin/ads', (req, res) => {
  const d = req.body || {};
  if (!d.title) return err(res, 400, 'العنوان مطلوب');
  const info = db.prepare(`
    INSERT INTO ads (title, description, image, button_text, action_type, action_value, position, bg_color, text_color, priority, date_from, date_to, manual_active, active)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    d.title, d.description || '', d.image || '', d.button_text || 'اعرف المزيد',
    d.action_type || 'link', d.action_value || '',
    d.position || 'middle', d.bg_color || '#0a1f44', d.text_color || '#ffffff',
    +d.priority || 5, d.date_from || null, d.date_to || null,
    d.manual_active === 0 ? 0 : 1, d.active === 0 ? 0 : 1
  );
  ok(res, { ok: true, id: info.lastInsertRowid });
});

app.put('/api/admin/ads/:id', (req, res) => {
  const d = req.body || {};
  const allowed = ['title','description','image','button_text','action_type','action_value','position','bg_color','text_color','priority','date_from','date_to','manual_active','active'];
  const data = {};
  allowed.forEach(f => { if (f in d) data[f] = d[f]; });
  if (!Object.keys(data).length) return ok(res, { ok: true });
  const sets = Object.keys(data).map(k => `${k}=?`).join(',');
  db.prepare(`UPDATE ads SET ${sets} WHERE id=?`).run(...Object.values(data), req.params.id);
  ok(res, { ok: true });
});

app.delete('/api/admin/ads/:id', (req, res) => {
  db.prepare('DELETE FROM ads WHERE id=?').run(req.params.id);
  ok(res, { ok: true });
});

app.get('/api/admin/ads/:id/stats', (req, res) => {
  const impressions = db.prepare("SELECT COUNT(*) c FROM ad_events WHERE ad_id=? AND event_type='impression'").get(req.params.id).c;
  const clicks = db.prepare("SELECT COUNT(*) c FROM ad_events WHERE ad_id=? AND event_type='click'").get(req.params.id).c;
  const daily = db.prepare(`
    SELECT substr(created_at,1,10) AS day,
      SUM(CASE WHEN event_type='impression' THEN 1 ELSE 0 END) AS impressions,
      SUM(CASE WHEN event_type='click' THEN 1 ELSE 0 END) AS clicks
    FROM ad_events WHERE ad_id=? GROUP BY day ORDER BY day DESC LIMIT 30
  `).all(req.params.id);
  ok(res, { impressions, clicks, ctr: impressions ? Math.round(clicks / impressions * 10000) / 100 : 0, daily });
});

app.delete('/api/admin/ads/:id/stats', (req, res) => {
  db.prepare('DELETE FROM ad_events WHERE ad_id=?').run(req.params.id);
  ok(res, { ok: true });
});

/* ===== ADMIN TRIP PLANS ===== */
app.get('/api/admin/trip-plans', (req, res) => {
  const rows = db.prepare(`
    SELECT tp.*,
      (SELECT COUNT(*) FROM trip_activities WHERE plan_id=tp.id) AS activities_count
    FROM trip_plans tp
    ORDER BY tp.id DESC
  `).all();
  ok(res, rows);
});

app.get('/api/admin/trip-plans/:id', (req, res) => {
  const plan = db.prepare('SELECT * FROM trip_plans WHERE id=?').get(req.params.id);
  if (!plan) return err(res, 404, 'Not found');
  plan.activities = db.prepare('SELECT * FROM trip_activities WHERE plan_id=? ORDER BY day_number, id').all(req.params.id);
  ok(res, plan);
});

app.put('/api/admin/trip-plans/:id', (req, res) => {
  const allowed = ['status', 'notes'];
  const data = {};
  allowed.forEach(f => { if (f in req.body) data[f] = req.body[f]; });
  if (!Object.keys(data).length) return ok(res, { ok: true });
  const sets = Object.keys(data).map(k => `${k}=?`).join(',');
  db.prepare(`UPDATE trip_plans SET ${sets} WHERE id=?`).run(...Object.values(data), req.params.id);
  ok(res, { ok: true });
});

app.delete('/api/admin/trip-plans/:id', (req, res) => {
  db.prepare('DELETE FROM trip_plans WHERE id=?').run(req.params.id);
  ok(res, { ok: true });
});

/* ===== ADMIN TRIP TEMPLATES ===== */
app.get('/api/admin/trip-templates', (req, res) => {
  const templates = db.prepare(`
    SELECT t.*,
      (SELECT COUNT(*) FROM trip_template_activities WHERE template_id=t.id) AS activities_count
    FROM trip_templates t
    ORDER BY t.sort_order, t.id DESC
  `).all();
  ok(res, templates);
});

app.get('/api/admin/trip-templates/:id', (req, res) => {
  const t = db.prepare('SELECT * FROM trip_templates WHERE id=?').get(req.params.id);
  if (!t) return err(res, 404, 'Not found');
  t.activities = db.prepare('SELECT * FROM trip_template_activities WHERE template_id=? ORDER BY day_number, sort_order, id').all(req.params.id);
  ok(res, t);
});

app.post('/api/admin/trip-templates', (req, res) => {
  try {
    const d = req.body || {};
    if (!d.name) return err(res, 400, 'الاسم مطلوب');
    if (!Array.isArray(d.activities)) return err(res, 400, 'الأنشطة مطلوبة');

    // Compute days_count
    const days = new Set(d.activities.map(a => +a.day_number || 1));
    const daysCount = days.size || 0;

    const info = db.prepare(`
      INSERT INTO trip_templates (name, description, city, days_count, sort_order, active)
      VALUES (?,?,?,?,?,?)
    `).run(
      d.name, d.description || '', d.city || '',
      daysCount, +d.sort_order || 0, d.active === 0 ? 0 : 1
    );
    const templateId = info.lastInsertRowid;

    const insertAct = db.prepare(`
      INSERT INTO trip_template_activities (template_id, day_number, time_slot, title, description, location, sort_order)
      VALUES (?,?,?,?,?,?,?)
    `);
    const insertAll = db.transaction((acts) => {
      acts.forEach((a, i) => {
        insertAct.run(templateId, +a.day_number || 1, a.time_slot || '',
          a.title || '', a.description || '', a.location || '', +a.sort_order || i);
      });
    });
    insertAll(d.activities);

    ok(res, { ok: true, id: templateId });
  } catch (e) {
    console.error(e);
    err(res, 500, 'خطأ أثناء الحفظ');
  }
});

app.put('/api/admin/trip-templates/:id', (req, res) => {
  try {
    const d = req.body || {};
    const id = req.params.id;

    // Update template
    const templateData = {};
    ['name','description','city','sort_order','active'].forEach(f => {
      if (f in d) templateData[f] = d[f];
    });

    if (Array.isArray(d.activities)) {
      const days = new Set(d.activities.map(a => +a.day_number || 1));
      templateData.days_count = days.size || 0;
    }

    if (Object.keys(templateData).length) {
      const sets = Object.keys(templateData).map(k => `${k}=?`).join(',');
      db.prepare(`UPDATE trip_templates SET ${sets} WHERE id=?`).run(...Object.values(templateData), id);
    }

    // Replace activities if provided
    if (Array.isArray(d.activities)) {
      db.prepare('DELETE FROM trip_template_activities WHERE template_id=?').run(id);
      const insertAct = db.prepare(`
        INSERT INTO trip_template_activities (template_id, day_number, time_slot, title, description, location, sort_order)
        VALUES (?,?,?,?,?,?,?)
      `);
      const insertAll = db.transaction((acts) => {
        acts.forEach((a, i) => {
          insertAct.run(id, +a.day_number || 1, a.time_slot || '',
            a.title || '', a.description || '', a.location || '', +a.sort_order || i);
        });
      });
      insertAll(d.activities);
    }

    ok(res, { ok: true });
  } catch (e) {
    console.error(e);
    err(res, 500, 'خطأ أثناء التحديث');
  }
});

app.delete('/api/admin/trip-templates/:id', (req, res) => {
  db.prepare('DELETE FROM trip_templates WHERE id=?').run(req.params.id);
  ok(res, { ok: true });
});

/* ===== ADMIN MEDICAL ===== */
app.get('/api/admin/medical', (req, res) => {
  ok(res, db.prepare('SELECT * FROM medical_centers ORDER BY id DESC').all());
});

app.post('/api/admin/medical', (req, res) => {
  const d = req.body || {};
  if (!d.name) return err(res, 400, 'الاسم مطلوب');
  if (!d.city) return err(res, 400, 'المدينة مطلوبة');
  const info = db.prepare(`
    INSERT INTO medical_centers (name, type, city, specialization, description, image, active)
    VALUES (?,?,?,?,?,?,?)
  `).run(
    d.name, d.type || 'hospital', d.city, d.specialization || '',
    d.description || '', d.image || '', d.active === 0 ? 0 : 1
  );
  ok(res, { ok: true, id: info.lastInsertRowid });
});

app.put('/api/admin/medical/:id', (req, res) => {
  const allowed = ['name','type','city','specialization','description','image','active'];
  const data = {};
  allowed.forEach(f => { if (f in req.body) data[f] = req.body[f]; });
  if (!Object.keys(data).length) return ok(res, { ok: true });
  const sets = Object.keys(data).map(k => `${k}=?`).join(',');
  db.prepare(`UPDATE medical_centers SET ${sets} WHERE id=?`).run(...Object.values(data), req.params.id);
  ok(res, { ok: true });
});

app.delete('/api/admin/medical/:id', (req, res) => {
  db.prepare('DELETE FROM medical_centers WHERE id=?').run(req.params.id);
  ok(res, { ok: true });
});

/* ===== ADMIN SCHOLARSHIPS ===== */
app.use('/api/admin/scholarships', crud('scholarships', ['name','description','website','deadline','image','active']));

/* ===== ADMIN TOURS ===== */
app.use('/api/admin/tours', crud('tours', ['name','description','price_rub','price_unit','note','active']));

/* ===== ADMIN EXTRA SERVICES ===== */
app.use('/api/admin/extra-services', crud('extra_services', ['name','description','price_rub','price_unit','note','allow_quantity','active']));

/* ===== BULK DELETE ===== */
app.delete('/api/admin/leads/all', (req, res) => {
  try {
    const count = db.prepare('SELECT COUNT(*) c FROM leads').get().c;
    db.prepare('DELETE FROM leads').run();
    ok(res, { ok: true, deleted: count });
  } catch (e) {
    console.error(e);
    err(res, 500, 'خطأ أثناء الحذف');
  }
});

app.delete('/api/admin/trip-plans/all', (req, res) => {
  try {
    const count = db.prepare('SELECT COUNT(*) c FROM trip_plans').get().c;
    // Delete activities first (FK constraint)
    db.prepare('DELETE FROM trip_activities').run();
    // Then delete plans
    db.prepare('DELETE FROM trip_plans').run();
    console.log('✅ Deleted', count, 'trip plans');
    ok(res, { ok: true, deleted: count });
  } catch (e) {
    console.error(e);
    err(res, 500, 'خطأ أثناء الحذف');
  }
});

/* ===== ADMIN VISITS ===== */
app.get('/api/admin/visits', (req, res) => {
  try {
    // This week: from Monday 00:00 until now
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - daysFromMonday);
    monday.setHours(0, 0, 0, 0);
    const weekStart = monday.toISOString().replace('T', ' ').split('.')[0];

    // This month: from 1st day 00:00 until now
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthStart = firstOfMonth.toISOString().replace('T', ' ').split('.')[0];

    const weekCount = db.prepare('SELECT COUNT(*) c FROM visits WHERE created_at >= ?').get(weekStart).c;
    const monthCount = db.prepare('SELECT COUNT(*) c FROM visits WHERE created_at >= ?').get(monthStart).c;
    const totalCount = db.prepare('SELECT COUNT(*) c FROM visits').get().c;

    ok(res, {
      week: weekCount,
      month: monthCount,
      total: totalCount,
      week_start: weekStart,
      month_start: monthStart
    });
  } catch (e) {
    console.error(e);
    err(res, 500, 'خطأ في جلب الإحصائيات');
  }
});

app.delete('/api/admin/visits/all', (req, res) => {
  try {
    const count = db.prepare('SELECT COUNT(*) c FROM visits').get().c;
    db.prepare('DELETE FROM visits').run();
    console.log('🧹 Manual cleanup: deleted', count, 'visits');
    ok(res, { ok: true, deleted: count });
  } catch (e) {
    console.error(e);
    err(res, 500, 'خطأ أثناء الحذف');
  }
});

/* ===== HOTEL ROOM TYPES ===== */
app.get('/api/admin/hotels/:hotelId/room-types', (req, res) => {
  const rows = db.prepare('SELECT * FROM hotel_room_types WHERE hotel_id=? ORDER BY sort_order, id').all(req.params.hotelId);
  ok(res, rows);
});

app.post('/api/admin/hotels/:hotelId/room-types', (req, res) => {
  try {
    const d = req.body || {};
    if (!d.name) return err(res, 400, 'الاسم مطلوب');
    const info = db.prepare(`
      INSERT INTO hotel_room_types (hotel_id, name, description, image, max_adults, max_children, max_total, meals_enabled, sort_order, active)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `).run(
      req.params.hotelId,
      d.name, d.description || '', d.image || '',
      +d.max_adults || 2, +d.max_children || 0, +d.max_total || 2,
      d.meals_enabled === 0 ? 0 : 1,
      +d.sort_order || 0, d.active === 0 ? 0 : 1
    );
    ok(res, { ok: true, id: info.lastInsertRowid });
  } catch (e) { console.error(e); err(res, 500, 'خطأ'); }
});

app.put('/api/admin/room-types/:id', (req, res) => {
  try {
    const fields = ['name','description','image','max_adults','max_children','max_total','meals_enabled','sort_order','active'];
    const data = {};
    fields.forEach(f => { if (f in req.body) data[f] = req.body[f]; });
    if (!Object.keys(data).length) return ok(res, { ok: true });
    const sets = Object.keys(data).map(k => `${k}=?`).join(',');
    db.prepare(`UPDATE hotel_room_types SET ${sets} WHERE id=?`).run(...Object.values(data), req.params.id);
    ok(res, { ok: true });
  } catch (e) { console.error(e); err(res, 500, 'خطأ'); }
});

app.delete('/api/admin/room-types/:id', (req, res) => {
  db.prepare('DELETE FROM hotel_room_types WHERE id=?').run(req.params.id);
  ok(res, { ok: true });
});

/* ===== ROOM PRICES ===== */
app.get('/api/admin/room-types/:roomTypeId/prices', (req, res) => {
  const rows = db.prepare('SELECT * FROM hotel_room_prices WHERE room_type_id=? ORDER BY date_from').all(req.params.roomTypeId);
  ok(res, rows);
});

app.post('/api/admin/room-types/:roomTypeId/prices', (req, res) => {
  try {
    const d = req.body || {};
    if (!d.date_from || !d.date_to) return err(res, 400, 'التواريخ مطلوبة');
    if (new Date(d.date_to) < new Date(d.date_from)) return err(res, 400, 'تاريخ النهاية بعد البداية');

    // Check overlap
    const conflict = db.prepare(
      `SELECT * FROM hotel_room_prices 
       WHERE room_type_id=? 
         AND NOT (date_to < ? OR date_from > ?)`
    ).get(req.params.roomTypeId, d.date_from, d.date_to);
    if (conflict) return err(res, 400, 'التواريخ تتداخل مع فترة موجودة (' + conflict.date_from + ' → ' + conflict.date_to + ')');

    const info = db.prepare(`
      INSERT INTO hotel_room_prices (room_type_id, date_from, date_to, price_single, price_double, price_triple, price_quad)
      VALUES (?,?,?,?,?,?,?)
    `).run(
      req.params.roomTypeId,
      d.date_from, d.date_to,
      d.price_single ? +d.price_single : null,
      d.price_double ? +d.price_double : null,
      d.price_triple ? +d.price_triple : null,
      d.price_quad ? +d.price_quad : null
    );
    ok(res, { ok: true, id: info.lastInsertRowid });
  } catch (e) { console.error(e); err(res, 500, 'خطأ'); }
});

app.put('/api/admin/room-prices/:id', (req, res) => {
  try {
    const fields = ['date_from','date_to','price_single','price_double','price_triple','price_quad'];
    const data = {};
    fields.forEach(f => { if (f in req.body) data[f] = req.body[f]; });
    if (!Object.keys(data).length) return ok(res, { ok: true });
    const sets = Object.keys(data).map(k => `${k}=?`).join(',');
    db.prepare(`UPDATE hotel_room_prices SET ${sets} WHERE id=?`).run(...Object.values(data), req.params.id);
    ok(res, { ok: true });
  } catch (e) { console.error(e); err(res, 500, 'خطأ'); }
});

app.delete('/api/admin/room-prices/:id', (req, res) => {
  db.prepare('DELETE FROM hotel_room_prices WHERE id=?').run(req.params.id);
  ok(res, { ok: true });
});


/* ===== CHILD POLICIES ===== */
app.get('/api/admin/room-types/:roomTypeId/child-policies', (req, res) => {
  const rows = db.prepare('SELECT * FROM hotel_child_policies WHERE room_type_id=? ORDER BY bed_type, age_from').all(req.params.roomTypeId);
  ok(res, rows);
});

app.post('/api/admin/room-types/:roomTypeId/child-policies', (req, res) => {
  try {
    const d = req.body || {};
    if (d.age_from === undefined || d.age_to === undefined) return err(res, 400, 'الأعمار مطلوبة');
    if (+d.age_to < +d.age_from) return err(res, 400, 'عمر النهاية يجب أن يكون أكبر من البداية');
    const info = db.prepare(`
      INSERT INTO hotel_child_policies (room_type_id, age_from, age_to, bed_type, price_type, price_value)
      VALUES (?,?,?,?,?,?)
    `).run(
      req.params.roomTypeId,
      +d.age_from, +d.age_to,
      d.bed_type || 'base',
      d.price_type || 'free',
      +d.price_value || 0
    );
    ok(res, { ok: true, id: info.lastInsertRowid });
  } catch (e) { console.error(e); err(res, 500, 'خطأ'); }
});

app.put('/api/admin/child-policies/:id', (req, res) => {
  try {
    const fields = ['age_from','age_to','bed_type','price_type','price_value'];
    const data = {};
    fields.forEach(f => { if (f in req.body) data[f] = req.body[f]; });
    if (!Object.keys(data).length) return ok(res, { ok: true });
    const sets = Object.keys(data).map(k => `${k}=?`).join(',');
    db.prepare(`UPDATE hotel_child_policies SET ${sets} WHERE id=?`).run(...Object.values(data), req.params.id);
    ok(res, { ok: true });
  } catch (e) { console.error(e); err(res, 500, 'خطأ'); }
});

app.delete('/api/admin/child-policies/:id', (req, res) => {
  db.prepare('DELETE FROM hotel_child_policies WHERE id=?').run(req.params.id);
  ok(res, { ok: true });
});

/* ===== MEAL PLANS ===== */
app.get('/api/admin/hotels/:hotelId/meal-plans', (req, res) => {
  const rows = db.prepare('SELECT * FROM hotel_meal_plans WHERE hotel_id=? ORDER BY sort_order, id').all(req.params.hotelId);
  ok(res, rows);
});

app.post('/api/admin/hotels/:hotelId/meal-plans', (req, res) => {
  try {
    const d = req.body || {};
    if (!d.name) return err(res, 400, 'اسم الخطة مطلوب');
    const info = db.prepare(`
      INSERT INTO hotel_meal_plans (hotel_id, name, description, price_per_person, per_night, active, sort_order)
      VALUES (?,?,?,?,?,?,?)
    `).run(
      req.params.hotelId,
      d.name, d.description || '',
      +d.price_per_person || 0,
      d.per_night === 0 ? 0 : 1,
      d.active === 0 ? 0 : 1,
      +d.sort_order || 0
    );
    ok(res, { ok: true, id: info.lastInsertRowid });
  } catch (e) { console.error(e); err(res, 500, 'خطأ'); }
});

app.put('/api/admin/meal-plans/:id', (req, res) => {
  try {
    const fields = ['name','description','price_per_person','per_night','active','sort_order'];
    const data = {};
    fields.forEach(f => { if (f in req.body) data[f] = req.body[f]; });
    if (!Object.keys(data).length) return ok(res, { ok: true });
    const sets = Object.keys(data).map(k => `${k}=?`).join(',');
    db.prepare(`UPDATE hotel_meal_plans SET ${sets} WHERE id=?`).run(...Object.values(data), req.params.id);
    ok(res, { ok: true });
  } catch (e) { console.error(e); err(res, 500, 'خطأ'); }
});

app.delete('/api/admin/meal-plans/:id', (req, res) => {
  db.prepare('DELETE FROM hotel_meal_plans WHERE id=?').run(req.params.id);
  ok(res, { ok: true });
});


/* ===== BOOKING ENGINE ===== */
app.post('/api/booking/calculate', (req, res) => {
  try {
    const result = calculateBooking(req.body || {});
    ok(res, result);
  } catch (e) {
    console.error('Booking error:', e.message);
    err(res, 400, e.message);
  }
});

app.get('/api/booking/room-types/:hotelId', (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    
    // إذا لم يتم تمرير التواريخ → إرجاع كل الأنواع
    if (!date_from || !date_to) {
      const rows = db.prepare(`
        SELECT * FROM hotel_room_types 
        WHERE hotel_id = ? AND active = 1 
        ORDER BY sort_order, id
      `).all(req.params.hotelId);
      return ok(res, rows);
    }
    
    // إذا تم تمرير التواريخ → إرجاع فقط الأنواع التي تغطي التواريخ
    const allRooms = db.prepare(`
      SELECT * FROM hotel_room_types 
      WHERE hotel_id = ? AND active = 1 
      ORDER BY sort_order, id
    `).all(req.params.hotelId);
    
    const availableRooms = [];
    
    for (const room of allRooms) {
      const prices = db.prepare(`
        SELECT * FROM hotel_room_prices 
        WHERE room_type_id = ? 
        ORDER BY date_from
      `).all(room.id);
      
      if (prices.length === 0) continue;
      
      let coversAllDates = true;
      let checkDate = new Date(date_from);
      const endDate = new Date(date_to);
      
      while (checkDate < endDate) {
        const dateStr = checkDate.toISOString().split('T')[0];
        const found = prices.find(p => dateStr >= p.date_from && dateStr <= p.date_to);
        if (!found) {
          coversAllDates = false;
          break;
        }
        checkDate.setDate(checkDate.getDate() + 1);
      }
      
      if (coversAllDates) {
        availableRooms.push(room);
      }
    }
    
    ok(res, availableRooms);
  } catch (e) {
    console.error('room-types filter error:', e);
    err(res, 500, 'خطأ');
  }
});

app.get('/api/booking/meal-plans/:hotelId', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT * FROM hotel_meal_plans 
      WHERE hotel_id = ? AND active = 1 
      ORDER BY sort_order, id
    `).all(req.params.hotelId);
    ok(res, rows);
  } catch (e) { err(res, 500, 'خطأ'); }
});


/* ===== BOOKING CREATE ===== */
app.post('/api/booking/create', (req, res) => {
  try {
    const d = req.body || {};

    // التحقق
    if (!d.hotel_id || !d.room_type_id) return err(res, 400, 'الفندق ونوع الغرفة مطلوبان');
    if (!d.date_from || !d.date_to) return err(res, 400, 'التواريخ مطلوبة');
    if (!d.adults || d.adults < 1) return err(res, 400, 'عدد البالغين مطلوب');
    if (!d.customer_name) return err(res, 400, 'اسم العميل مطلوب');

    // حساب السعر من محرك الحساب
    const calc = calculateBooking({
      hotel_id: +d.hotel_id,
      room_type_id: +d.room_type_id,
      date_from: d.date_from,
      date_to: d.date_to,
      adults: +d.adults,
      children_ages: d.children_ages || [],
      meal_plan_id: d.meal_plan_id ? +d.meal_plan_id : null
    });

    // توليد رقم حجز
    const ref = 'BK-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();

    // حفظ الحجز
    const info = db.prepare(`
      INSERT INTO hotel_bookings (
        booking_ref, hotel_id, room_type_id, meal_plan_id,
        date_from, date_to, nights, rooms_count,
        adults, children_ages,
        customer_name, customer_email, customer_phone, customer_notes,
        total_price, currency, breakdown_json, status, source
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      ref,
      +d.hotel_id,
      +d.room_type_id,
      d.meal_plan_id ? +d.meal_plan_id : null,
      d.date_from,
      d.date_to,
      calc.nights,
      +d.rooms_count || 1,
      +d.adults,
      JSON.stringify(d.children_ages || []),
      d.customer_name,
      d.customer_email || '',
      d.customer_phone || '',
      d.customer_notes || '',
      calc.total * (+d.rooms_count || 1),
      d.currency || 'RUB',
      JSON.stringify(calc.breakdown),
      'pending',
      d.source || 'trip-planner'
    );

    ok(res, {
      ok: true,
      booking_id: info.lastInsertRowid,
      booking_ref: ref,
      calc
    });
  } catch (e) {
    console.error('Booking create error:', e.message);
    err(res, 400, e.message);
  }
});

/* ===== BOOKING LIST (للإدارة) ===== */
app.get('/api/admin/hotel-bookings', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT b.*, h.name as hotel_name, rt.name as room_type_name, mp.name as meal_plan_name
      FROM hotel_bookings b
      LEFT JOIN hotels h ON h.id = b.hotel_id
      LEFT JOIN hotel_room_types rt ON rt.id = b.room_type_id
      LEFT JOIN hotel_meal_plans mp ON mp.id = b.meal_plan_id
      ORDER BY b.created_at DESC
      LIMIT 100
    `).all();
    ok(res, rows);
  } catch (e) { err(res, 500, 'خطأ'); }
});

/* ===== BOOKING DETAILS ===== */
app.get('/api/admin/hotel-bookings/:id', (req, res) => {
  try {
    const row = db.prepare(`
      SELECT b.*, h.name as hotel_name, rt.name as room_type_name, mp.name as meal_plan_name
      FROM hotel_bookings b
      LEFT JOIN hotels h ON h.id = b.hotel_id
      LEFT JOIN hotel_room_types rt ON rt.id = b.room_type_id
      LEFT JOIN hotel_meal_plans mp ON mp.id = b.meal_plan_id
      WHERE b.id = ?
    `).get(req.params.id);
    if (!row) return err(res, 404, 'الحجز غير موجود');
    ok(res, row);
  } catch (e) { err(res, 500, 'خطأ'); }
});

/* ===== BOOKING STATUS UPDATE ===== */
app.put('/api/admin/hotel-bookings/:id/status', (req, res) => {
  try {
    const { status } = req.body || {};
    if (!['pending', 'confirmed', 'cancelled'].includes(status)) {
      return err(res, 400, 'حالة غير صحيحة');
    }
    db.prepare('UPDATE hotel_bookings SET status=? WHERE id=?').run(status, req.params.id);
    ok(res, { ok: true });
  } catch (e) { err(res, 500, 'خطأ'); }
});


/* ===== CHILD MEAL POLICIES ===== */
app.get('/api/admin/meal-plans/:mealPlanId/child-policies', (req, res) => {
  const rows = db.prepare('SELECT * FROM hotel_child_meal_policies WHERE meal_plan_id=? ORDER BY age_from').all(req.params.mealPlanId);
  ok(res, rows);
});

app.post('/api/admin/meal-plans/:mealPlanId/child-policies', (req, res) => {
  try {
    const d = req.body || {};
    if (d.age_from === undefined || d.age_to === undefined) return err(res, 400, 'الأعمار مطلوبة');
    if (+d.age_to < +d.age_from) return err(res, 400, 'عمر النهاية يجب أن يكون أكبر من البداية');
    const info = db.prepare(`
      INSERT INTO hotel_child_meal_policies (meal_plan_id, age_from, age_to, price_per_person)
      VALUES (?,?,?,?)
    `).run(
      req.params.mealPlanId,
      +d.age_from, +d.age_to,
      +d.price_per_person || 0
    );
    ok(res, { ok: true, id: info.lastInsertRowid });
  } catch (e) { console.error(e); err(res, 500, 'خطأ'); }
});

app.put('/api/admin/child-meal-policies/:id', (req, res) => {
  try {
    const fields = ['age_from','age_to','price_per_person'];
    const data = {};
    fields.forEach(f => { if (f in req.body) data[f] = req.body[f]; });
    if (!Object.keys(data).length) return ok(res, { ok: true });
    const sets = Object.keys(data).map(k => `${k}=?`).join(',');
    db.prepare(`UPDATE hotel_child_meal_policies SET ${sets} WHERE id=?`).run(...Object.values(data), req.params.id);
    ok(res, { ok: true });
  } catch (e) { console.error(e); err(res, 500, 'خطأ'); }
});

app.delete('/api/admin/child-meal-policies/:id', (req, res) => {
  db.prepare('DELETE FROM hotel_child_meal_policies WHERE id=?').run(req.params.id);
  ok(res, { ok: true });
});


/* ===== OCCUPANCY RULES ===== */
app.get('/api/admin/room-types/:roomTypeId/occupancy-rules', (req, res) => {
  const rows = db.prepare('SELECT * FROM hotel_room_occupancy_rules WHERE room_type_id=? ORDER BY sort_order, id').all(req.params.roomTypeId);
  ok(res, rows);
});

app.post('/api/admin/room-types/:roomTypeId/occupancy-rules', (req, res) => {
  try {
    const d = req.body || {};
    if (d.adults_min === undefined || d.adults_max === undefined) return err(res, 400, 'حدود البالغين مطلوبة');
    if (d.children_min === undefined || d.children_max === undefined) return err(res, 400, 'حدود الأطفال مطلوبة');
    const info = db.prepare(`
      INSERT INTO hotel_room_occupancy_rules (room_type_id, adults_min, adults_max, children_min, children_max, action, description, sort_order)
      VALUES (?,?,?,?,?,?,?,?)
    `).run(
      req.params.roomTypeId,
      +d.adults_min, +d.adults_max,
      +d.children_min, +d.children_max,
      d.action || 'deny',
      d.description || '',
      +d.sort_order || 0
    );
    ok(res, { ok: true, id: info.lastInsertRowid });
  } catch (e) { console.error(e); err(res, 500, 'خطأ'); }
});

app.put('/api/admin/occupancy-rules/:id', (req, res) => {
  try {
    const fields = ['adults_min','adults_max','children_min','children_max','action','description','sort_order'];
    const data = {};
    fields.forEach(f => { if (f in req.body) data[f] = req.body[f]; });
    if (!Object.keys(data).length) return ok(res, { ok: true });
    const sets = Object.keys(data).map(k => `${k}=?`).join(',');
    db.prepare(`UPDATE hotel_room_occupancy_rules SET ${sets} WHERE id=?`).run(...Object.values(data), req.params.id);
    ok(res, { ok: true });
  } catch (e) { console.error(e); err(res, 500, 'خطأ'); }
});

app.delete('/api/admin/occupancy-rules/:id', (req, res) => {
  db.prepare('DELETE FROM hotel_room_occupancy_rules WHERE id=?').run(req.params.id);
  ok(res, { ok: true });
});


/* ===== ROOM COVERAGE (Gaps) ===== */
app.get('/api/admin/room-types/:roomTypeId/coverage', (req, res) => {
  try {
    const roomTypeId = req.params.roomTypeId;
    const { from, to } = req.query;
    
    const today = new Date();
    const fromDate = from || today.toISOString().split('T')[0];
    const toDate = to || '2027-12-31';
    
    const prices = db.prepare(`
      SELECT date_from, date_to FROM hotel_room_prices 
      WHERE room_type_id = ? 
      ORDER BY date_from
    `).all(roomTypeId);
    
    if (prices.length === 0) {
      return ok(res, {
        has_prices: false,
        gaps: [{ from: fromDate, to: toDate }],
        covered_periods: [],
        search_range: { from: fromDate, to: toDate }
      });
    }
    
    const gaps = [];
    const sortedPrices = [...prices].sort((a, b) => a.date_from.localeCompare(b.date_from));
    const firstDate = new Date(fromDate);
    
    if (sortedPrices.length > 0 && firstDate < new Date(sortedPrices[0].date_from)) {
      const gapEnd = new Date(sortedPrices[0].date_from);
      gapEnd.setDate(gapEnd.getDate() - 1);
      gaps.push({
        from: fromDate,
        to: gapEnd.toISOString().split('T')[0]
      });
    }
    
    for (let i = 0; i < sortedPrices.length - 1; i++) {
      const currentEnd = new Date(sortedPrices[i].date_to);
      const nextStart = new Date(sortedPrices[i + 1].date_from);
      const diffDays = Math.round((nextStart - currentEnd) / 86400000);
      
      if (diffDays > 1) {
        const gapStart = new Date(currentEnd);
        gapStart.setDate(gapStart.getDate() + 1);
        const gapEnd = new Date(nextStart);
        gapEnd.setDate(gapEnd.getDate() - 1);
        gaps.push({
          from: gapStart.toISOString().split('T')[0],
          to: gapEnd.toISOString().split('T')[0]
        });
      }
    }
    
    if (sortedPrices.length > 0) {
      const lastPrice = sortedPrices[sortedPrices.length - 1];
      const lastEnd = new Date(lastPrice.date_to);
      const endDateObj = new Date(toDate);
      
      if (lastEnd < endDateObj) {
        const gapStart = new Date(lastEnd);
        gapStart.setDate(gapStart.getDate() + 1);
        gaps.push({
          from: gapStart.toISOString().split('T')[0],
          to: toDate
        });
      }
    }
    
    ok(res, {
      has_prices: true,
      gaps: gaps,
      covered_periods: sortedPrices.map(p => ({ from: p.date_from, to: p.date_to })),
      search_range: { from: fromDate, to: toDate }
    });
  } catch (e) {
    console.error('coverage error:', e);
    err(res, 500, 'خطأ');
  }
});


/* ===== CHILD BED TYPES (للعمر المحدد) ===== */
app.get('/api/booking/child-bed-types/:roomTypeId', (req, res) => {
  try {
    const { roomTypeId } = req.params;
    const { age } = req.query;
    
    if (age === undefined) {
      return err(res, 400, 'العمر مطلوب');
    }
    
    const ageNum = +age;
    
    // جلب كل السياسات المطابقة للعمر
    const policies = db.prepare(`
      SELECT * FROM hotel_child_policies 
      WHERE room_type_id = ? 
        AND age_from <= ? 
        AND age_to >= ?
      ORDER BY 
        CASE bed_type 
          WHEN 'base' THEN 1 
          WHEN 'child' THEN 2 
          WHEN 'extra' THEN 3 
        END
    `).all(roomTypeId, ageNum, ageNum);
    
    // ✅ تجميع حسب bed_type (الأول لكل نوع)
    const bedTypes = {};
    policies.forEach(p => {
      if (!bedTypes[p.bed_type]) {
        bedTypes[p.bed_type] = {
          bed_type: p.bed_type,
          price_type: p.price_type,
          price_value: p.price_value,
          age_from: p.age_from,
          age_to: p.age_to
        };
      }
    });
    
    const result = Object.values(bedTypes);
    ok(res, result);
  } catch (e) {
    console.error('child-bed-types error:', e);
    err(res, 500, 'خطأ');
  }
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
  medical_total:       db.prepare('SELECT COUNT(*) c FROM medical_centers').get().c,
  scholarships_total:  db.prepare('SELECT COUNT(*) c FROM scholarships').get().c,
  tours_total:         db.prepare('SELECT COUNT(*) c FROM tours').get().c,
  extra_services_total: db.prepare('SELECT COUNT(*) c FROM extra_services').get().c,
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
