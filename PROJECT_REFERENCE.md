# 📖 المرجع الشامل لمشروع مُساعد (MOSAAD)

> آخر تحديث: 2026-09-29

## 🎯 نظرة عامة
منصة سياحية عربية لتنظيم الرحلات إلى روسيا. تحتوي على Trip Planner + لوحة تحكم + نظام حجز فنادق متقدم.

## 🗂️ البنية
- src/db.js — قاعدة البيانات + 24 جدول
- src/server.js — Express API + كل الـ endpoints
- src/booking-engine.js — محرك حساب الأسعار
- public/index.html + app.js — الموقع + Trip Planner
- public/admin.html + admin.js — لوحة التحكم

## 🗄️ جداول قاعدة البيانات الرئيسية

### الفنادق:
- hotels — الفنادق
- hotel_prices — الأسعار الموسمية القديمة
- hotel_room_types — أنواع الغرف (🆕)
- hotel_room_prices — أسعار الفترات لكل نوع (🆕)
- hotel_child_policies — سياسات الأطفال (🆕)
- hotel_meal_plans — خطط الوجبات (🆕)
- hotel_bookings — الحجوزات (🆕)

### الطلبات:
- leads — طلبات العملاء
- trip_plans — جداول الرحلات
- trip_activities — أنشطة الجداول
- visits — الزيارات

### الخدمات:
- services, extra_services, tours, events, restaurants

### المحتوى:
- destinations, universities, scholarships, medical_centers

### الإدارة:
- admins, settings, ads, ad_events

### القوالب:
- trip_templates, trip_template_activities

## 🔌 API Endpoints الرئيسية

### Public:
GET /api/settings
GET /api/hotels
GET /api/hotels/:id
GET /api/restaurants
GET /api/services
GET /api/events
GET /api/universities
GET /api/ads
GET /api/tours
GET /api/extra-services
POST /api/leads
POST /api/trip-plans

### Booking Engine:
POST /api/booking/calculate
GET /api/booking/room-types/:hotelId
GET /api/booking/meal-plans/:hotelId
POST /api/booking/create

### Admin:
GET/POST/PUT/DELETE /api/admin/hotels
GET/POST/PUT/DELETE /api/admin/hotels/:id/room-types
GET/POST/PUT/DELETE /api/admin/room-types/:id
GET/POST/PUT/DELETE /api/admin/room-types/:id/prices
GET/POST/PUT/DELETE /api/admin/room-types/:id/child-policies
GET/POST/PUT/DELETE /api/admin/hotels/:id/meal-plans
GET /api/admin/hotel-bookings
GET/POST/PUT/DELETE /api/admin/leads
GET/POST/PUT/DELETE /api/admin/trip-plans
GET/POST/PUT/DELETE /api/admin/trip-templates
GET /api/admin/stats
GET /api/admin/visits

## 🧮 محرك الحساب (booking-engine.js)

### calculateBooking(params) يستقبل:
- hotel_id, room_type_id
- date_from, date_to
- adults, children_ages
- meal_plan_id

### يُرجع:
- nights, total_guests
- base_price_per_night
- room_cost, children_cost, extra_bed_cost, meal_cost
- total
- breakdown: [{label, detail, amount}]

### منطق الحساب:
1. عدد الليالي = الفرق بين التواريخ
2. التحقق من الإشغال (max_total + max_extra_beds)
3. البحث عن فترة السعر المناسبة
4. حساب الغرفة (فردي/مزدوج/ثلاثي/رباعي)
5. حساب الأطفال (free/fixed/percent)
6. حساب الأسرّة الإضافية
7. حساب الوجبات (سعر × أشخاص × ليال)
8. الإجمالي = مجموع الكل

## 🎨 Trip Planner (app.js)

### المتغيرات:
- hotelSegments — مقاطع الفنادق
- tripDays — أيام جدول الرحلة
- HOTELS, CITY_LIST, TOUR_PACKAGES, EXTRA_SERVICES

### الدوال الرئيسية:
- calcSegment(seg) — يحسب مقطع فندق
- recalcBooking(seg) — يحسب كل غرفة عبر API
- loadHotelBookingOptions(seg) — يجلب الأنواع
- renderHotelSegments() — يعرض الفنادق
- updateRoomData(), updateChildAge() — تحديث بيانات الغرفة
- updateSegment() — تحديث حقول الفندق
- refreshSegmentsUI() — عرض المجموع
- calculate() — يجمع كل شيء
- $('#pSubmit').onclick — إرسال الطلب

## 🛠️ لوحة التحكم (admin.js)

### الصفحات:
- dashboard, visits, leads, hotels, services
- extra-services, events, universities, scholarships
- tours, destinations, restaurants, medical
- ads, trips, templates, settings

### الدوال:
- renderTable(entity) — عرض جدول
- openModal(entity, row, schema) — نموذج CRUD
- openRoomTypesModal(hotel) — أنواع الغرف
- openRoomTypeForm() — نموذج نوع غرفة
- openRoomPricesModal() — أسعار الفترات
- openChildPoliciesModal() — سياسات الأطفال
- openMealPlansModal() — خطط الوجبات
- renderLeads() — الطلبات
- renderTripsAdmin() — جداول العملاء
- renderTemplatesAdmin() — القوالب
- renderSettings() — الإعدادات
- uploadImage(file) — رفع صور

## 🔄 إضافة ميزة جديدة

### 1. قاعدة البيانات (db.js):
أضف جدول جديد في initDb().

### 2. API (server.js):
أضف endpoint جديد.

### 3. لوحة التحكم (admin.js):
أضف entity في SCHEMAS + TITLES.

### 4. الموقع (app.js):
أضف load function + عرض.

## ⚠️ ملاحظات مهمة

1. الحجوزات لا تُحفظ تلقائياً في hotel_bookings (كود موجود لكن غير مفعّل)
2. النسخ الاحتياطية في ~/Desktop/mosaad_FINAL_*
3. قاعدة البيانات في data/mosaad.db (SQLite + WAL)
4. app.js كبير (~1900 سطر)
5. admin.js كبير (~2500 سطر)
6. hotel_prices للأسعار البسيطة، hotel_room_prices للفنادق المتقدمة
7. calcSegment يعمل بالطريقتين:
   - بدون roomTypeId → النظام القديم (hotel.price_rub)
   - مع roomTypeId → النظام الجديد (Booking Engine)

## 📝 TODO
- إضافة صور لأنواع الغرف
- تفعيل حفظ الحجوزات
- الترجمة (روسي + إنجليزي)
- نظام دفع أونلاين

---
نهاية المرجع ✅

---

## 🆕 تحديثات 2026-09-30 (الجزء الثاني)

### ✅ ميزات جديدة:

1. **إخفاء أنواع الغرف بدون أسعار:**
   - API `/api/booking/room-types/:hotelId?date_from=&date_to=`.
   - يُرجع فقط الأنواع التي تغطي التواريخ.
   - إعادة التحميل تلقائياً عند تغيير التواريخ.
   - مسح الاختيار إذا لم يعد متاحاً.

2. **روابط الفنادق في رسالة الواتساب:**
   - سطر "رابط الفندق:" يظهر إذا كان `hotel.website` مُدخلاً.
   - يمكن للمدير إدارتها من لوحة التحكم.

3. **رسالة واتساب محسّنة:**
   - بدون إيموجي (لتجنب مشاكل الترميز).
   - تواريخ الوصول/المغادرة العامة.
   - تفاصيل كل غرفة.
   - روابط الفنادق.

### ⚠️ ملاحظات:
- زر "أسعار قديمة" موجود لكن غير مستخدم (نظام احتياطي).
- حقل "المدة" محذوف من الواجهة (لتبسيط Trip Planner).
- النسخة الاحتياطية: `~/Desktop/mosaad_FINAL_20260930_*`.

### 🎯 النظام الكامل:
- قاعدة بيانات: 25 جدول.
- API endpoints: ~70.
- Trip Planner: يعمل بشكل احترافي.
- لوحة تحكم: كاملة.
- رسالة الواتساب: شاملة.

