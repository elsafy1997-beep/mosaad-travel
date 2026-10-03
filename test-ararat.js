/**
 * اختبار محرك الحساب على Ararat Park Hyatt Moscow
 */

import { db } from './src/db.js';
import { calculateBooking } from './src/booking-engine.js';

const HOTEL_ID = 7;

console.log('═══════════════════════════════════════════');
console.log('🏨 Ararat Park Hyatt Moscow — اختبار شامل');
console.log('═══════════════════════════════════════════\n');

// جلب أنواع الغرف
const roomTypes = db.prepare('SELECT * FROM hotel_room_types WHERE hotel_id = ? ORDER BY sort_order').all(HOTEL_ID);
console.log(`🛏️  أنواع الغرف (${roomTypes.length}):`);
roomTypes.forEach(r => console.log(`   [${r.id}] ${r.name} (max=${r.max_total})`));

// جلب خطط الوجبات
const meals = db.prepare('SELECT * FROM hotel_meal_plans WHERE hotel_id = ? AND active = 1').all(HOTEL_ID);
console.log(`\n🍽️  خطط الوجبات:`);
meals.forEach(m => console.log(`   [${m.id}] ${m.name}: ${m.price_per_person} RUB/شخص`));

// ==========================================
// السيناريو 1: عرض الخريف — بارك كينغ (شخصان)
// ==========================================
console.log('\n═══════════════════════════════════════════');
console.log('📅 السيناريو 1: عرض الخريف — شخصان بدون أطفال');
console.log('   من 2026-09-15 إلى 2026-09-18 (3 ليال)');
console.log('═══════════════════════════════════════════');

try {
  const r = calculateBooking({
    hotel_id: HOTEL_ID,
    room_type_id: 5,
    date_from: '2026-09-15',
    date_to: '2026-09-18',
    adults: 2,
    children_ages: []
  });
  console.log(`✅ الإجمالي: ${r.total.toLocaleString('ar-EG')} RUB`);
  r.breakdown.forEach(b => console.log(`   • ${b.label}: ${b.amount.toLocaleString('ar-EG')} RUB`));
} catch (e) { console.log(`❌ ${e.message}`); }

// ==========================================
// السيناريو 2: عرض الخريف — بارك كينغ + طفلان (3 و 8)
// ==========================================
console.log('\n═══════════════════════════════════════════');
console.log('📅 السيناريو 2: عرض الخريف — شخصان + طفلان (3 و 8)');
console.log('   من 2026-09-15 إلى 2026-09-18 (3 ليال)');
console.log('═══════════════════════════════════════════');

try {
  const r = calculateBooking({
    hotel_id: HOTEL_ID,
    room_type_id: 5,
    date_from: '2026-09-15',
    date_to: '2026-09-18',
    adults: 2,
    children_ages: [3, 8]
  });
  console.log(`✅ الإجمالي: ${r.total.toLocaleString('ar-EG')} RUB`);
  r.breakdown.forEach(b => console.log(`   • ${b.label}: ${b.amount.toLocaleString('ar-EG')} RUB`));
} catch (e) { console.log(`❌ ${e.message}`); }

// ==========================================
// السيناريو 3: عرض الشتاء — جناح بارك + BB
// ==========================================
console.log('\n═══════════════════════════════════════════');
console.log('📅 السيناريو 3: عرض الشتاء — جناح بارك + BB');
console.log('   شخصان + طفل واحد (7 سنوات)');
console.log('   من 2026-12-15 إلى 2026-12-20 (5 ليال)');
console.log('═══════════════════════════════════════════');

const bbMeal = meals.find(m => m.name === 'BB');
try {
  const r = calculateBooking({
    hotel_id: HOTEL_ID,
    room_type_id: 8,
    date_from: '2026-12-15',
    date_to: '2026-12-20',
    adults: 2,
    children_ages: [7],
    meal_plan_id: bbMeal.id
  });
  console.log(`✅ الإجمالي: ${r.total.toLocaleString('ar-EG')} RUB`);
  r.breakdown.forEach(b => console.log(`   • ${b.label}: ${b.amount.toLocaleString('ar-EG')} RUB`));
} catch (e) { console.log(`❌ ${e.message}`); }

// ==========================================
// السيناريو 4: العرض الموسمي — بارك ديلوكس + طفلان (5 و 12)
// ==========================================
console.log('\n═══════════════════════════════════════════');
console.log('📅 السيناريو 4: العرض الموسمي — بارك ديلوكس + طفلان (5 و 12)');
console.log('   من 2026-11-01 إلى 2026-11-05 (4 ليال)');
console.log('═══════════════════════════════════════════');

try {
  const r = calculateBooking({
    hotel_id: HOTEL_ID,
    room_type_id: 7,
    date_from: '2026-11-01',
    date_to: '2026-11-05',
    adults: 2,
    children_ages: [5, 12]
  });
  console.log(`✅ الإجمالي: ${r.total.toLocaleString('ar-EG')} RUB`);
  r.breakdown.forEach(b => console.log(`   • ${b.label}: ${b.amount.toLocaleString('ar-EG')} RUB`));
} catch (e) { console.log(`❌ ${e.message}`); }

// ==========================================
// السيناريو 5: بارك بإطلالة على المدينة + 3 أشخاص بالغين
// ==========================================
console.log('\n═══════════════════════════════════════════');
console.log('📅 السيناريو 5: بارك بإطلالة — 3 بالغين');
console.log('   من 2026-09-15 إلى 2026-09-18 (3 ليال)');
console.log('═══════════════════════════════════════════');

try {
  const r = calculateBooking({
    hotel_id: HOTEL_ID,
    room_type_id: 6,
    date_from: '2026-09-15',
    date_to: '2026-09-18',
    adults: 3,
    children_ages: []
  });
  console.log(`✅ الإجمالي: ${r.total.toLocaleString('ar-EG')} RUB`);
  r.breakdown.forEach(b => console.log(`   • ${b.label}: ${b.amount.toLocaleString('ar-EG')} RUB`));
} catch (e) { console.log(`❌ ${e.message}`); }

console.log('\n═══════════════════════════════════════════');
console.log('🎉 انتهى الاختبار');
console.log('═══════════════════════════════════════════');
