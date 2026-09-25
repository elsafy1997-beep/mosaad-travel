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
