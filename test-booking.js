/**
 * سكربت اختبار محرك الحساب
 */

import { db } from './src/db.js';
import { calculateBooking } from './src/booking-engine.js';

console.log('═══════════════════════════════════════════');
console.log('🧪 اختبار محرك حساب أسعار الفنادق');
console.log('═══════════════════════════════════════════\n');

// اختر الفندق التجريبي (id=6) أو أي فندق به أنواع غرف
const testHotel = db.prepare(`
  SELECT h.* FROM hotels h 
  WHERE EXISTS (SELECT 1 FROM hotel_room_types rt WHERE rt.hotel_id = h.id)
  ORDER BY h.id DESC LIMIT 1
`).get();

if (!testHotel) {
  console.log('⚠️  لا توجد فنادق بأنواع غرف. أضف بيانات أولاً.');
  process.exit(0);
}

console.log(`🏨 الفندق: ${testHotel.name} (id=${testHotel.id}, ${testHotel.city})\n`);

const roomTypes = db.prepare('SELECT * FROM hotel_room_types WHERE hotel_id = ? ORDER BY id').all(testHotel.id);
console.log(`🛏️  أنواع الغرف (${roomTypes.length}):`);
roomTypes.forEach(r => console.log(`   [${r.id}] ${r.name} (max=${r.max_total}, extra_bed=${r.has_extra_bed})`));

const meals = db.prepare('SELECT * FROM hotel_meal_plans WHERE hotel_id = ? AND active = 1 ORDER BY sort_order').all(testHotel.id);
console.log(`\n🍽️  خطط الوجبات (${meals.length}):`);
meals.forEach(m => console.log(`   [${m.id}] ${m.name}: ${m.price_per_person} RUB/شخص`));

console.log('\n═══════════════════════════════════════════\n');

// ==========================================
// اختبار على نوع الغرفة الأول
// ==========================================
const testRoom = roomTypes[0];
console.log(`🧪 اختبار على: ${testRoom.name} (id=${testRoom.id})\n`);

// تواريخ اختبار: 2026-11-15 → 2026-11-20 (5 ليال في الموسم المنخفض)
const dateFrom = '2026-11-15';
const dateTo = '2026-11-20';
console.log(`📅 من ${dateFrom} إلى ${dateTo} (5 ليال)\n`);

// ==========================================
// اختبار 1: بالغ واحد
// ==========================================
console.log('━━━ اختبار 1: بالغ واحد ━━━');
try {
  const r = calculateBooking({
    hotel_id: testHotel.id,
    room_type_id: testRoom.id,
    date_from: dateFrom,
    date_to: dateTo,
    adults: 1,
    children_ages: []
  });
  console.log(`✅ الإجمالي: ${r.total.toLocaleString('ar-EG')} RUB`);
  r.breakdown.forEach(b => console.log(`   • ${b.label}: ${b.amount.toLocaleString('ar-EG')} RUB`));
} catch (e) {
  console.log(`❌ خطأ: ${e.message}`);
}

// ==========================================
// اختبار 2: بالغان + طفلان (3 و 8 سنوات)
// ==========================================
console.log('\n━━━ اختبار 2: بالغان + طفلان (3 و 8 سنوات) ━━━');
try {
  const r = calculateBooking({
    hotel_id: testHotel.id,
    room_type_id: testRoom.id,
    date_from: dateFrom,
    date_to: dateTo,
    adults: 2,
    children_ages: [3, 8]
  });
  console.log(`✅ الإجمالي: ${r.total.toLocaleString('ar-EG')} RUB`);
  r.breakdown.forEach(b => console.log(`   • ${b.label}: ${b.amount.toLocaleString('ar-EG')} RUB`));
} catch (e) {
  console.log(`❌ خطأ: ${e.message}`);
}

// ==========================================
// اختبار 3: بالغان + طفلان + BB
// ==========================================
const bbMeal = meals.find(m => m.name === 'BB');
if (bbMeal) {
  console.log(`\n━━━ اختبار 3: بالغان + طفلان + ${bbMeal.name} (مع إفطار) ━━━`);
  try {
    const r = calculateBooking({
      hotel_id: testHotel.id,
      room_type_id: testRoom.id,
      date_from: dateFrom,
      date_to: dateTo,
      adults: 2,
      children_ages: [3, 8],
      meal_plan_id: bbMeal.id
    });
    console.log(`✅ الإجمالي: ${r.total.toLocaleString('ar-EG')} RUB`);
    r.breakdown.forEach(b => console.log(`   • ${b.label}: ${b.amount.toLocaleString('ar-EG')} RUB`));
  } catch (e) {
    console.log(`❌ خطأ: ${e.message}`);
  }
}

// ==========================================
// اختبار 4: موسم رأس السنة (سعر أعلى)
// ==========================================
console.log('\n━━━ اختبار 4: بالغان + طفل واحد (5 سنوات) — موسم رأس السنة ━━━');
try {
  const r = calculateBooking({
    hotel_id: testHotel.id,
    room_type_id: testRoom.id,
    date_from: '2026-12-25',
    date_to: '2026-12-30',
    adults: 2,
    children_ages: [5]
  });
  console.log(`✅ الإجمالي: ${r.total.toLocaleString('ar-EG')} RUB`);
  r.breakdown.forEach(b => console.log(`   • ${b.label}: ${b.amount.toLocaleString('ar-EG')} RUB`));
} catch (e) {
  console.log(`❌ خطأ: ${e.message}`);
}

// ==========================================
// اختبار 5: الجناح العائلي (نوع ثاني)
// ==========================================
if (roomTypes.length > 1) {
  const room2 = roomTypes[1];
  console.log(`\n━━━ اختبار 5: ${room2.name} — بالغان + 3 أطفال (2, 7, 10) ━━━`);
  try {
    const r = calculateBooking({
      hotel_id: testHotel.id,
      room_type_id: room2.id,
      date_from: dateFrom,
      date_to: dateTo,
      adults: 2,
      children_ages: [2, 7, 10]
    });
    console.log(`✅ الإجمالي: ${r.total.toLocaleString('ar-EG')} RUB`);
    r.breakdown.forEach(b => console.log(`   • ${b.label}: ${b.amount.toLocaleString('ar-EG')} RUB`));
  } catch (e) {
    console.log(`❌ خطأ: ${e.message}`);
  }
}

console.log('\n═══════════════════════════════════════════');
console.log('🎉 انتهى الاختبار');
console.log('═══════════════════════════════════════════');
