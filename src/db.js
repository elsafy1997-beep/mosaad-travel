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
      description TEXT, address TEXT, image TEXT,
      active INTEGER DEFAULT 1,
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

    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL, description TEXT,
      price_rub INTEGER DEFAULT 0, price_unit TEXT DEFAULT 'order',
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
    site_name: 'مُساعد | MOSAAD',
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
}

export function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}
export function setSetting(k, v) {
  db.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
    .run(k, String(v));
}
