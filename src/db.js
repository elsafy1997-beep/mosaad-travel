import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import 'dotenv/config';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(process.env.DATABASE_URL || './data/mosaad.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS destinations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_ar TEXT NOT NULL, name_ru TEXT, name_en TEXT,
      description TEXT, image TEXT,
      active INTEGER DEFAULT 1, sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS hotels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL, city TEXT NOT NULL,
      stars INTEGER DEFAULT 3, room_type TEXT,
      breakfast INTEGER DEFAULT 0, price_rub INTEGER DEFAULT 0,
      description TEXT, address TEXT, image TEXT, website TEXT DEFAULT '',
      active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS hotel_prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hotel_id INTEGER NOT NULL,
      date_from TEXT NOT NULL,
      date_to TEXT NOT NULL,
      price_rub INTEGER NOT NULL,
      label TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_hotel_prices_hotel ON hotel_prices(hotel_id);
    CREATE INDEX IF NOT EXISTS idx_hotel_prices_dates ON hotel_prices(date_from, date_to);

    CREATE TABLE IF NOT EXISTS hotel_room_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hotel_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      image TEXT,
      max_adults INTEGER DEFAULT 2,
      max_children INTEGER DEFAULT 0,
      max_total INTEGER DEFAULT 2,
      meals_enabled INTEGER DEFAULT 1,
      base_bed_type TEXT DEFAULT 'double',
      has_extra_bed INTEGER DEFAULT 0,
      max_extra_beds INTEGER DEFAULT 0,
      extra_bed_adult_price INTEGER DEFAULT 0,
      extra_bed_child_price INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_room_types_hotel ON hotel_room_types(hotel_id);
    CREATE TABLE IF NOT EXISTS hotel_meal_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hotel_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      price_per_person INTEGER DEFAULT 0,
      per_night INTEGER DEFAULT 1,
      active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_meal_plans_hotel ON hotel_meal_plans(hotel_id);
    CREATE TABLE IF NOT EXISTS hotel_child_meal_policies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meal_plan_id INTEGER NOT NULL,
      age_from INTEGER NOT NULL,
      age_to INTEGER NOT NULL,
      price_per_person INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (meal_plan_id) REFERENCES hotel_meal_plans(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_child_meal_plan ON hotel_child_meal_policies(meal_plan_id);

    CREATE TABLE IF NOT EXISTS hotel_bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_ref TEXT UNIQUE NOT NULL,
      hotel_id INTEGER NOT NULL,
      room_type_id INTEGER NOT NULL,
      meal_plan_id INTEGER,
      date_from TEXT NOT NULL,
      date_to TEXT NOT NULL,
      nights INTEGER NOT NULL,
      rooms_count INTEGER DEFAULT 1,
      adults INTEGER NOT NULL,
      children_ages TEXT DEFAULT '[]',
      customer_name TEXT,
      customer_email TEXT,
      customer_phone TEXT,
      customer_notes TEXT,
      total_price INTEGER NOT NULL,
      currency TEXT DEFAULT 'RUB',
      breakdown_json TEXT DEFAULT '[]',
      status TEXT DEFAULT 'pending',
      source TEXT DEFAULT 'trip-planner',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE,
      FOREIGN KEY (room_type_id) REFERENCES hotel_room_types(id) ON DELETE CASCADE,
      FOREIGN KEY (meal_plan_id) REFERENCES hotel_meal_plans(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_hotel_bookings_hotel ON hotel_bookings(hotel_id);
    CREATE INDEX IF NOT EXISTS idx_hotel_bookings_ref ON hotel_bookings(booking_ref);
    CREATE INDEX IF NOT EXISTS idx_hotel_bookings_status ON hotel_bookings(status);



    CREATE TABLE IF NOT EXISTS hotel_room_prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_type_id INTEGER NOT NULL,
      season_name TEXT DEFAULT '',
      date_from TEXT NOT NULL,
      date_to TEXT NOT NULL,
      price_single INTEGER,
      price_double INTEGER,
      price_triple INTEGER,
      price_quad INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (room_type_id) REFERENCES hotel_room_types(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_room_prices_type ON hotel_room_prices(room_type_id);
    CREATE INDEX IF NOT EXISTS idx_room_prices_dates ON hotel_room_prices(date_from, date_to);
    CREATE TABLE IF NOT EXISTS hotel_child_policies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_type_id INTEGER NOT NULL,
      age_from INTEGER NOT NULL,
      age_to INTEGER NOT NULL,
      bed_type TEXT DEFAULT 'base',
      price_type TEXT DEFAULT 'free',
      price_value INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (room_type_id) REFERENCES hotel_room_types(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_child_policies_room ON hotel_child_policies(room_type_id);
    CREATE TABLE IF NOT EXISTS hotel_room_occupancy_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_type_id INTEGER NOT NULL,
      adults_min INTEGER DEFAULT 0,
      adults_max INTEGER DEFAULT 99,
      children_min INTEGER DEFAULT 0,
      children_max INTEGER DEFAULT 99,
      action TEXT DEFAULT 'deny',
      description TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (room_type_id) REFERENCES hotel_room_types(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_occupancy_rules_room ON hotel_room_occupancy_rules(room_type_id);



    CREATE TABLE IF NOT EXISTS restaurants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      city TEXT NOT NULL,
      cuisine TEXT DEFAULT '',
      note TEXT DEFAULT '',
      image TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_restaurants_city ON restaurants(city);

    CREATE TABLE IF NOT EXISTS ads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      image TEXT,
      button_text TEXT DEFAULT 'اعرف المزيد',
      action_type TEXT DEFAULT 'link',
      action_value TEXT DEFAULT '',
      position TEXT DEFAULT 'middle',
      bg_color TEXT DEFAULT '#0a1f44',
      text_color TEXT DEFAULT '#ffffff',
      priority INTEGER DEFAULT 5,
      date_from TEXT,
      date_to TEXT,
      manual_active INTEGER DEFAULT 1,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_ads_position ON ads(position);
    CREATE INDEX IF NOT EXISTS idx_ads_dates ON ads(date_from, date_to);
    CREATE INDEX IF NOT EXISTS idx_ads_active ON ads(active);

    CREATE TABLE IF NOT EXISTS ad_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ad_id INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      ip TEXT DEFAULT '',
      user_agent TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ad_id) REFERENCES ads(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_ad_events_ad ON ad_events(ad_id);
    CREATE INDEX IF NOT EXISTS idx_ad_events_type ON ad_events(event_type);

    CREATE TABLE IF NOT EXISTS trip_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE,
      client_name TEXT DEFAULT '',
      client_whatsapp TEXT DEFAULT '',
      country TEXT DEFAULT '',
      persons INTEGER DEFAULT 1,
      start_date TEXT,
      end_date TEXT,
      notes TEXT DEFAULT '',
      status TEXT DEFAULT 'new',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_trip_plans_status ON trip_plans(status);
    CREATE INDEX IF NOT EXISTS idx_trip_plans_code ON trip_plans(code);

    CREATE TABLE IF NOT EXISTS trip_activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER NOT NULL,
      day_number INTEGER NOT NULL,
      day_date TEXT,
      time_slot TEXT DEFAULT '',
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      location TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (plan_id) REFERENCES trip_plans(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_trip_activities_plan ON trip_activities(plan_id);

    CREATE TABLE IF NOT EXISTS trip_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      city TEXT DEFAULT '',
      days_count INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_trip_templates_active ON trip_templates(active);

    CREATE TABLE IF NOT EXISTS trip_template_activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER NOT NULL,
      day_number INTEGER NOT NULL,
      time_slot TEXT DEFAULT '',
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      location TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (template_id) REFERENCES trip_templates(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_trip_template_acts ON trip_template_activities(template_id);

    CREATE TABLE IF NOT EXISTS medical_centers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT DEFAULT 'hospital',
      city TEXT NOT NULL,
      specialization TEXT DEFAULT '',
      description TEXT DEFAULT '',
      image TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_medical_city ON medical_centers(city);
    CREATE INDEX IF NOT EXISTS idx_medical_type ON medical_centers(type);
    CREATE INDEX IF NOT EXISTS idx_medical_active ON medical_centers(active);

    CREATE TABLE IF NOT EXISTS scholarships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      website TEXT DEFAULT '',
      deadline TEXT DEFAULT '',
      image TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_scholarships_active ON scholarships(active);

    CREATE TABLE IF NOT EXISTS tours (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      price_rub INTEGER DEFAULT 0,
      price_unit TEXT DEFAULT 'order',
      allow_quantity INTEGER DEFAULT 0,
      note TEXT DEFAULT '',
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_tours_active ON tours(active);

    CREATE TABLE IF NOT EXISTS extra_services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      price_rub INTEGER DEFAULT 0,
      price_unit TEXT DEFAULT 'order',
      note TEXT DEFAULT '',
      allow_quantity INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_extra_services_active ON extra_services(active);

    CREATE TABLE IF NOT EXISTS visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page TEXT DEFAULT '/',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_visits_created ON visits(created_at);

    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL, description TEXT,
      price_rub INTEGER DEFAULT 0, price_unit TEXT DEFAULT 'order',
      allow_quantity INTEGER DEFAULT 0,
      city TEXT, image TEXT, active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL, city TEXT, event_date TEXT, venue TEXT,
      price_rub INTEGER DEFAULT 0, description TEXT, image TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS universities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_ar TEXT NOT NULL, name_ru TEXT, name_en TEXT,
      city TEXT, specializations TEXT,
      tuition_rub INTEGER DEFAULT 0, housing TEXT,
      image TEXT, description TEXT, website TEXT,
      study_type TEXT DEFAULT 'contract',
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE, name TEXT NOT NULL,
      country TEXT, phone TEXT, whatsapp TEXT,
      persons INTEGER DEFAULT 1,
      arrival TEXT, departure TEXT, city TEXT,
      hotel_id INTEGER, services TEXT,
      estimated_rub INTEGER DEFAULT 0,
      currency TEXT DEFAULT 'RUB',
      currency_amount REAL DEFAULT 0,
      status TEXT DEFAULT 'new', notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY, value TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
    CREATE INDEX IF NOT EXISTS idx_hotels_city ON hotels(city);
  `);

  if (db.prepare('SELECT COUNT(*) c FROM admins').get().c === 0) {
    const u = process.env.ADMIN_USERNAME || 'admin';
    const p = process.env.ADMIN_PASSWORD || 'CHANGE_ME_NOW';
    db.prepare('INSERT INTO admins (username, password_hash) VALUES (?, ?)')
      .run(u, bcrypt.hashSync(p, 10));
    console.log('Admin created:', u);
  }

  const defaults = {
    site_name: 'مُساعد | MOSAED',
    site_tagline: 'مساعدك العربي في روسيا',
    whatsapp_number: process.env.WHATSAPP_NUMBER || '79990000000',
    contact_email: 'info@mosaad.ru',
    contact_phone: '+7 999 000 0000',
    hero_title: 'روسيا أسهل مع مُساعد',
    hero_description: 'من حجز الفندق والجولات إلى استقبال المطار والدراسة في روسيا، نساعدك في ترتيب رحلتك وخدماتك باللغة العربية.',
    footer_text: 'وجهتك المثالية لاكتشاف روسيا.',
    instagram: '#', telegram: '#', tiktok: '#', facebook: '#',
    rate_USD: '95', rate_AED: '26', rate_SAR: '25',
    rate_QAR: '26', rate_KWD: '305', rate_OMR: '245', rate_BHD: '250'
  };
  const ins = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(defaults)) ins.run(k, v);

  if (db.prepare('SELECT COUNT(*) c FROM hotels').get().c === 0) {
    db.prepare(`INSERT INTO hotels (name,city,stars,room_type,breakfast,price_rub,description,address,image) VALUES
      ('Arbat Stars','موسكو',5,'Deluxe',1,43000,'فندق فاخر في قلب أربات مع إطلالة على المدينة.','Arbat St, Moscow','https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800'),
      ('Nevsky Grand','سانت بطرسبرغ',4,'Standard',1,28000,'قريب من شارع نيفسكي والمتاحف الرئيسية.','Nevsky Prospekt','https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800'),
      ('Sochi Sea View','سوتشي',5,'Suite',1,55000,'إطلالة مباشرة على البحر الأسود.','Sochi Coast','https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=800')
    `).run();

    db.prepare(`INSERT INTO services (name,description,price_rub,price_unit,city) VALUES
      ('استقبال المطار','استقبال من المطار مع سائق يتحدث العربية.',5000,'car','موسكو'),
      ('توصيل المطار','توصيل آمن إلى المطار في الوقت المحدد.',5000,'car','موسكو'),
      ('شريحة اتصال روسية','شريحة مع إنترنت للاستخدام خلال الرحلة.',1500,'order','موسكو'),
      ('سيارة خاصة مع سائق','سيارة خاصة لليوم كامل.',12000,'day','موسكو'),
      ('مساعدة في الصرافة','مرافقة لتحويل العملة بأفضل سعر.',2000,'order','موسكو'),
      ('دعم عربي 24/7','خط دعم عربي على مدار الساعة.',0,'order','موسكو')
    `).run();

    db.prepare(`INSERT INTO destinations (name_ar,name_ru,name_en,description,image,sort_order) VALUES
      ('موسكو','Москва','Moscow','العاصمة الروسية وقلب الحياة الثقافية والتجارية.','https://images.unsplash.com/photo-1520106212299-d99c443e4568?w=800',1),
      ('سانت بطرسبرغ','Санкт-Петербург','Saint Petersburg','مدينة القصور والمتاحف والأنهار.','https://images.unsplash.com/photo-1556610961-2fecc5927173?w=800',2),
      ('سوتشي','Сочи','Sochi','البحر الأسود والطبيعة الساحرة.','https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=800',3),
      ('قازان','Казань','Kazan','مدينة التقاليد الإسلامية والتاريخ.','https://images.unsplash.com/photo-1580835615106-3b96c2f1b6f4?w=800',4)
    `).run();

    db.prepare(`INSERT INTO universities (name_ar,name_ru,name_en,city,specializations,tuition_rub,housing,description,website) VALUES
      ('جامعة موسكو الحكومية','МГУ','MSU','موسكو','الطب، الهندسة، العلوم، الاقتصاد',450000,'سكن جامعي متوفر','من أعرق الجامعات الروسية.','https://www.msu.ru'),
      ('جامعة الصداقة بين الشعوب','РУДН','RUDN','موسكو','الطب، الصيدلة، العلاقات الدولية',380000,'سكن جامعي متوفر','وجهة مميزة للطلاب الدوليين.','https://www.rudn.ru'),
      ('جامعة سانت بطرسبرغ','СПбГУ','SPbU','سانت بطرسبرغ','القانون، الآداب، العلوم',400000,'سكن جامعي متوفر','ثاني أقدم جامعة في روسيا.','https://www.spbu.ru')
    `).run();

    db.prepare(`INSERT INTO events (name,city,event_date,venue,price_rub,description) VALUES
      ('مهرجان الشتاء','موسكو','2025-12-20','الساحة الحمراء',3500,'احتفالات رأس السنة وعروض شتوية.'),
      ('ليالي سوتشي الموسيقية','سوتشي','2025-08-15','قاعة الحفلات',5000,'حفلات موسيقية على البحر.')
    `).run();

    console.log('Sample data seeded');
  }
  
  // Migrations - add missing columns
  try {
    const cols = db.prepare("PRAGMA table_info(services)").all();
    const hasQty = cols.some(c => c.name === 'allow_quantity');
    if (!hasQty) {
      db.prepare('ALTER TABLE services ADD COLUMN allow_quantity INTEGER DEFAULT 0').run();
      console.log('✅ Migration: allow_quantity added to services');
    }
  } catch (e) {
    console.log('Migration warning:', e.message);
  }
  
  // Migration for tours
  try {
    const cols = db.prepare("PRAGMA table_info(tours)").all();
    const hasQty = cols.some(c => c.name === 'allow_quantity');
    if (!hasQty) {
      db.prepare('ALTER TABLE tours ADD COLUMN allow_quantity INTEGER DEFAULT 0').run();
      console.log('✅ Migration: allow_quantity added to tours');
    }
  } catch (e) {
    console.log('Migration warning (tours):', e.message);
  }
  
  // Migration for hotels website
  try {
    const hcols = db.prepare("PRAGMA table_info(hotels)").all();
    const hasWebsite = hcols.some(c => c.name === 'website');
    if (!hasWebsite) {
      db.prepare("ALTER TABLE hotels ADD COLUMN website TEXT DEFAULT ''").run();
      console.log('✅ Migration: website added to hotels');
    }
  } catch (e) {
    console.log('Migration warning (hotels):', e.message);
  }
  
  // Auto-cleanup: remove visits older than 12 months
  try {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 12);
    const cutoffStr = cutoff.toISOString().replace('T', ' ').split('.')[0];
    const result = db.prepare('DELETE FROM visits WHERE created_at < ?').run(cutoffStr);
    if (result.changes > 0) {
      console.log('🧹 Cleaned up', result.changes, 'old visits');
    }
  } catch (e) {
    console.log('Cleanup warning:', e.message);
  }
}

export function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}
export function setSetting(k, v) {
  db.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
    .run(k, String(v));
}
