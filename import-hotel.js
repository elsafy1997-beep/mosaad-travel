/**
 * سكربت استيراد فندق كامل من ملف JSON
 * الاستخدام: node import-hotel.js <path-to-json>
 */

import fs from 'fs';
import path from 'path';
import { db } from './src/db.js';

const jsonPath = process.argv[2];
if (!jsonPath) {
  console.error('❌ Usage: node import-hotel.js <path-to-json>');
  process.exit(1);
}

const fullPath = path.resolve(jsonPath);
if (!fs.existsSync(fullPath)) {
  console.error('❌ File not found:', fullPath);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));

console.log('═══════════════════════════════════════════');
console.log('🏨 استيراد فندق:', data.hotel.name);
console.log('═══════════════════════════════════════════\n');

// ==========================================
// 1) إنشاء / تحديث الفندق
// ==========================================
let hotelId;
const existingHotel = db.prepare('SELECT id FROM hotels WHERE name = ? AND city = ?').get(data.hotel.name, data.hotel.city);

if (existingHotel) {
  hotelId = existingHotel.id;
  console.log(`⏭️  الفندق موجود بالفعل (id=${hotelId})`);
  
  // تحديث الحقول
  const fields = ['stars', 'price_rub', 'description', 'image', 'address', 'active'];
  const updates = fields.filter(f => f in data.hotel);
  if (updates.length) {
    const sets = updates.map(f => `${f}=?`).join(',');
    const vals = updates.map(f => data.hotel[f]);
    db.prepare(`UPDATE hotels SET ${sets} WHERE id=?`).run(...vals, hotelId);
    console.log(`✅ تم تحديث ${updates.length} حقل`);
  }
} else {
  const info = db.prepare(`
    INSERT INTO hotels (name, city, stars, price_rub, description, image, address, active)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(
    data.hotel.name,
    data.hotel.city,
    data.hotel.stars || 3,
    data.hotel.price_rub || 0,
    data.hotel.description || '',
    data.hotel.image || '',
    data.hotel.address || '',
    data.hotel.active === 0 ? 0 : 1
  );
  hotelId = info.lastInsertRowid;
  console.log(`✅ تم إنشاء الفندق (id=${hotelId})`);
}

// ==========================================
// 2) خطط الوجبات (Meal Plans)
// ==========================================
console.log('\n🍽️  خطط الوجبات:');
if (data.meal_plans && data.meal_plans.length) {
  // حذف القديمة
  db.prepare('DELETE FROM hotel_meal_plans WHERE hotel_id=?').run(hotelId);
  
  for (const mp of data.meal_plans) {
    db.prepare(`
      INSERT INTO hotel_meal_plans (hotel_id, name, description, price_per_person, per_night, active, sort_order)
      VALUES (?,?,?,?,?,?,?)
    `).run(
      hotelId,
      mp.name,
      mp.description || '',
      mp.price_per_person || 0,
      mp.per_night === 0 ? 0 : 1,
      mp.active === 0 ? 0 : 1,
      mp.sort_order || 0
    );
    console.log(`   ✅ ${mp.name}: ${mp.price_per_person} RUB/شخص`);
  }
} else {
  console.log('   (لا توجد خطط وجبات)');
}

// ==========================================
// 3) أنواع الغرف
// ==========================================
console.log('\n🛏️  أنواع الغرف:');
if (!data.room_types || !data.room_types.length) {
  console.log('   ⚠️  لا توجد أنواع غرف');
  process.exit(0);
}

for (const rt of data.room_types) {
  // حذف النوع القديم إن وجد بنفس الاسم
  const existing = db.prepare('SELECT id FROM hotel_room_types WHERE hotel_id=? AND name=?').get(hotelId, rt.name);
  if (existing) {
    db.prepare('DELETE FROM hotel_room_types WHERE id=?').run(existing.id);
    console.log(`   🗑️  حذف النوع القديم: ${rt.name}`);
  }
  
  const info = db.prepare(`
    INSERT INTO hotel_room_types (
      hotel_id, name, description, image,
      max_adults, max_children, max_total,
      base_bed_type, has_extra_bed, max_extra_beds,
      extra_bed_adult_price, extra_bed_child_price,
      active, sort_order
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    hotelId,
    rt.name,
    rt.description || '',
    rt.image || '',
    rt.max_adults || 2,
    rt.max_children || 0,
    rt.max_total || 2,
    rt.base_bed_type || 'double',
    rt.has_extra_bed ? 1 : 0,
    rt.max_extra_beds || 0,
    rt.extra_bed_adult_price || 0,
    rt.extra_bed_child_price || 0,
    rt.active === 0 ? 0 : 1,
    rt.sort_order || 0
  );
  const roomTypeId = info.lastInsertRowid;
  console.log(`   ✅ ${rt.name} (id=${roomTypeId}, max=${rt.max_total})`);

  // ==========================================
  // 4) فترات الأسعار
  // ==========================================
  if (rt.prices && rt.prices.length) {
    console.log(`      💰 فترات الأسعار:`);
    for (const p of rt.prices) {
      db.prepare(`
        INSERT INTO hotel_room_prices (
          room_type_id, season_name, date_from, date_to,
          price_single, price_double, price_triple, price_quad
        ) VALUES (?,?,?,?,?,?,?,?)
      `).run(
        roomTypeId,
        p.season_name || '',
        p.date_from,
        p.date_to,
        p.price_single || null,
        p.price_double || null,
        p.price_triple || null,
        p.price_quad || null
      );
      console.log(`         • ${p.season_name || '(بدون اسم)'}: ${p.date_from} → ${p.date_to}`);
    }
  }

  // ==========================================
  // 5) سياسات الأطفال
  // ==========================================
  if (rt.child_policies && rt.child_policies.length) {
    console.log(`      👶 سياسات الأطفال:`);
    for (const cp of rt.child_policies) {
      db.prepare(`
        INSERT INTO hotel_child_policies (
          room_type_id, age_from, age_to, bed_type, price_type, price_value
        ) VALUES (?,?,?,?,?,?)
      `).run(
        roomTypeId,
        cp.age_from,
        cp.age_to,
        cp.bed_type || 'base',
        cp.price_type || 'free',
        cp.price_value || 0
      );
      console.log(`         • عمر ${cp.age_from}-${cp.age_to} ${cp.bed_type} ${cp.price_type}=${cp.price_value}`);
    }
  }
}

console.log('\n═══════════════════════════════════════════');
console.log('🎉 تم الاستيراد بنجاح!');
console.log('═══════════════════════════════════════════');

// ==========================================
// التحقق النهائي
// ==========================================
const finalRoomTypes = db.prepare('SELECT COUNT(*) as c FROM hotel_room_types WHERE hotel_id=?').get(hotelId);
const finalPrices = db.prepare(`
  SELECT COUNT(*) as c FROM hotel_room_prices 
  WHERE room_type_id IN (SELECT id FROM hotel_room_types WHERE hotel_id=?)
`).get(hotelId);
const finalPolicies = db.prepare(`
  SELECT COUNT(*) as c FROM hotel_child_policies 
  WHERE room_type_id IN (SELECT id FROM hotel_room_types WHERE hotel_id=?)
`).get(hotelId);
const finalMeals = db.prepare('SELECT COUNT(*) as c FROM hotel_meal_plans WHERE hotel_id=?').get(hotelId);

console.log('\n📊 الإحصائيات النهائية:');
console.log(`   🏨 فندق: ${data.hotel.name} (id=${hotelId})`);
console.log(`   🛏️  أنواع الغرف: ${finalRoomTypes.c}`);
console.log(`   💰 فترات الأسعار: ${finalPrices.c}`);
console.log(`   👶 سياسات الأطفال: ${finalPolicies.c}`);
console.log(`   🍽️  خطط الوجبات: ${finalMeals.c}`);
