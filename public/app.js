const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const fmt = n => Number(n || 0).toLocaleString('ar-EG') + ' ₽';
let SETTINGS = {}, HOTELS = [], SERVICES = [], EXTRA_SERVICES = [], EVENTS = [], CITY_LIST = [];

const CURRENCY_NAMES = {
  RUB: { name: 'روبل روسي', symbol: '₽' },
  USD: { name: 'دولار أمريكي', symbol: '$' },
  AED: { name: 'درهم إماراتي', symbol: 'AED' },
  SAR: { name: 'ريال سعودي', symbol: 'SAR' },
  QAR: { name: 'ريال قطري', symbol: 'QAR' },
  KWD: { name: 'دينار كويتي', symbol: 'KWD' },
  OMR: { name: 'ريال عماني', symbol: 'OMR' },
  BHD: { name: 'دينار بحريني', symbol: 'BHD' }
};

function convertFromRub(rub, currency) {
  if (!currency || currency === 'RUB') return null;
  const rate = +SETTINGS['rate_' + currency] || 0;
  if (!rate) return null;
  return rub / rate;
}
function fmtCurrency(amount, currency) {
  const info = CURRENCY_NAMES[currency];
  if (!info) return '';
  const rounded = amount >= 100 ? Math.round(amount) : Math.round(amount * 100) / 100;
  return rounded.toLocaleString('ar-EG') + ' ' + info.symbol;
}
function fmtWithCurrency(rub, currency) {
  const base = fmt(rub);
  if (!currency || currency === 'RUB') return base;
  const conv = convertFromRub(rub, currency);
  if (conv === null) return base;
  return base + ' ≈ ' + fmtCurrency(conv, currency);
}

function toast(msg, type = '') {
  const t = $('#toast');
  t.textContent = msg; t.className = 'toast show ' + type;
  setTimeout(() => t.className = 'toast ' + type, 3000);
}
async function api(path, opts) {
  const r = await fetch(path, opts);
  return r.ok ? r.json() : Promise.reject(await r.json().catch(() => ({ error: 'خطأ' })));
}
function waLink(text = '') {
  const num = SETTINGS.whatsapp_number || '';
  return 'https://wa.me/' + num + (text ? '?text=' + encodeURIComponent(text) : '');
}
window.addEventListener('scroll', () => $('#hdr').classList.toggle('solid', window.scrollY > 50));
$('#burger').onclick = () => $('#nav').classList.toggle('open');
$$('#nav a').forEach(a => a.onclick = () => $('#nav').classList.remove('open'));

async function loadSettings() {
  SETTINGS = await api('/api/settings');
  $('#heroTitle').innerHTML = SETTINGS.hero_title.replace('مُساعد', '<span>مُساعد</span>');
  $('#heroDesc').textContent = SETTINGS.hero_description;
  $('#cWhats').innerHTML = '<span dir="ltr" style="display:inline-block;">+' + SETTINGS.whatsapp_number + '</span>';
  $('#cEmail').innerHTML = SETTINGS.contact_email;
  $('#cPhone').innerHTML = SETTINGS.contact_phone;
  $('#footText').textContent = SETTINGS.footer_text;
  $('#footPhone').innerHTML = 'الهاتف: ' + SETTINGS.contact_phone;
  $('#footEmail').innerHTML = 'البريد: ' + SETTINGS.contact_email;
  const w = waLink('مرحباً مُساعد، أرغب بالاستفسار عن خدماتكم.');
  $('#whatsFab').href = w; $('#heroWhats').href = w; $('#footWhats').href = w;
  $('#yr').textContent = new Date().getFullYear();

  const socials = [
    ['instagram', '#socialInstagram'],
    ['facebook',  '#socialFacebook'],
    ['tiktok',    '#socialTikTok'],
    ['telegram',  '#socialTelegram']
  ];
  socials.forEach(([key, sel]) => {
    const el = document.querySelector(sel);
    if (!el) return;
    const url = (SETTINGS[key] || '').trim();
    if (url && url !== '#') {
      el.href = url.startsWith('http') ? url : 'https://' + url;
      el.style.display = '';
    } else {
      el.style.display = 'none';
    }
  });
}
const unitLabel = u => ({ person: '/ للفرد', car: '/ للسيارة', day: '/ لليوم', order: '/ للطلب', from: 'يبدأ من' }[u] || '');

async function loadServices() {
  try {
    const r = await fetch('/api/services');
    SERVICES = await r.json();
    const icons = ['[1]','[2]','[3]','[4]','[5]','[6]','[7]','[8]'];
    const unitLabel = u => ({ person: '/ للفرد', car: '/ للسيارة', day: '/ لليوم', order: '/ للطلب', from: 'يبدأ من' }[u] || '');
    const grid = document.getElementById('servicesGrid');
    if (!grid) return;
    grid.innerHTML = SERVICES.map((s, i) => {
      const hasQty = +s.allow_quantity === 1;
      return `
        <div class="svc" data-service-id="${s.id}">
          ${s.image
            ? `<div class="svc-img"><img src="${s.image}" alt="${s.name}" loading="lazy"></div>`
            : `<div class="ico">${icons[i % icons.length]}</div>`
          }
          <h3>${s.name}</h3>
          <p>${s.description || ''}</p>
          ${s.price_rub ? `<div style="margin-top:12px;font-weight:800;color:var(--gold)">${fmt(s.price_rub)} <small style="color:var(--gray);font-weight:400">${unitLabel(s.price_unit)}</small></div>` : ''}
          ${hasQty ? `
            <div class="svc-qty-row" style="margin-top:10px;display:none;">
              <label style="font-size:.85rem;font-weight:700;color:var(--navy);">${s.price_unit === 'day' ? 'عدد الأيام' : s.price_unit === 'person' ? 'عدد الأشخاص' : 'العدد'}:</label>
              <input type="number" class="svc-qty" min="1" value="1" style="width:80px;padding:6px 10px;border:2px solid var(--border);border-radius:8px;font-family:inherit;text-align:center;font-weight:700;color:var(--navy);margin-top:6px;">
            </div>
          ` : ''}
          <button class="btn btn-gold" style="margin-top:14px;width:100%;" onclick="requestService(${s.id})">احجز هذه الخدمة</button>
        </div>`;
    }).join('');
  } catch (e) {
    console.warn('Services load failed', e);
  }
}
async function loadDestinations() {
  const list = await api('/api/destinations');
  $('#destGrid').innerHTML = list.map(d => `
    <div class="card"><div class="card-img"><img src="${d.image || ''}" alt="${d.name_ar}"></div>
    <div class="card-body"><h3>${d.name_ar}</h3><p>${d.description || ''}</p></div></div>`).join('');
}
async function loadEvents() {
  const list = await api('/api/events');
  EVENTS = list;
  const renderCard = (e) => `
    <div class="card">
      <div class="card-img"><img src="${e.image || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800'}" alt="${e.name}"></div>
      <div class="card-body">
        <h3>${e.name}</h3>
        <p style="color:var(--gold);font-weight:700">${e.venue || e.city} - ${e.event_date || ''}</p>
        <p>${e.description || ''}</p>
        <div class="card-foot">
          <div class="price">${fmt(e.price_rub)}</div>
          <a href="${waLink('أرغب بحجز فعالية: ' + e.name + ' في ' + e.city)}" target="_blank" class="btn btn-navy">احجز</a>
        </div>
      </div>
    </div>`;
  const emptyMsg = '<p style="text-align:center;color:var(--gray);grid-column:1/-1;padding:20px;">لا توجد فعاليات متاحة حالياً.</p>';
  const moscow = list.filter(e => (e.city || '').trim() === 'موسكو');
  const sochi  = list.filter(e => (e.city || '').trim() === 'سوتشي');
  const other  = list.filter(e => !['موسكو', 'سوتشي'].includes((e.city || '').trim()));
  const moscowGrid = document.getElementById('eventsMoscow');
  const sochiGrid  = document.getElementById('eventsSochi');
  const otherGrid  = document.getElementById('eventsOther');
  if (moscowGrid) moscowGrid.innerHTML = moscow.length ? moscow.map(renderCard).join('') : emptyMsg;
  if (sochiGrid)  sochiGrid.innerHTML  = sochi.length  ? sochi.map(renderCard).join('')  : emptyMsg;
  if (otherGrid)  otherGrid.innerHTML  = other.length  ? other.map(renderCard).join('')  : emptyMsg;
}
/* ============ RESTAURANTS ============ */
async function loadRestaurants() {
  const list = await api('/api/restaurants');

  const renderCard = (r) => `
    <div class="card">
      <div class="card-img"><img src="${r.image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800'}" alt="${r.name}"></div>
      <div class="card-body">
        <h3>${r.name}</h3>
        <p style="color:var(--gold);font-weight:700">${r.cuisine || ''}</p>
        ${r.note ? `<p style="font-size:.85rem;color:var(--gray);background:#f8fafc;padding:8px 12px;border-radius:8px;margin-bottom:10px;">${r.note}</p>` : '<p style="color:var(--gray);font-size:.85rem;">&nbsp;</p>'}
        <div class="card-foot">
          <button class="btn btn-navy" onclick="requestRestaurant(${r.id})">احجز هذا المطعم</button>
        </div>
      </div>
    </div>`;

  const emptyMsg = '<p style="text-align:center;color:var(--gray);grid-column:1/-1;padding:20px;">لا توجد مطاعم متاحة حالياً.</p>';

  const moscow = list.filter(r => (r.city || '').trim() === 'موسكو');
  const sochi  = list.filter(r => (r.city || '').trim() === 'سوتشي');
  const spb    = list.filter(r => ['سانت بطرسبرغ', 'سانت بطرسبورغ', 'بيتر', 'بطرسبرغ'].includes((r.city || '').trim()));
  const other  = list.filter(r => !['موسكو', 'سوتشي', 'سانت بطرسبرغ', 'سانت بطرسبورغ', 'بيتر', 'بطرسبرغ'].includes((r.city || '').trim()));

  const g1 = document.getElementById('restaurantsMoscow');
  const g2 = document.getElementById('restaurantsSochi');
  const g3 = document.getElementById('restaurantsSpb');
  const g4 = document.getElementById('restaurantsOther');

  if (g1) g1.innerHTML = moscow.length ? moscow.map(renderCard).join('') : emptyMsg;
  if (g2) g2.innerHTML = sochi.length  ? sochi.map(renderCard).join('')  : emptyMsg;
  if (g3) g3.innerHTML = spb.length    ? spb.map(renderCard).join('')    : emptyMsg;
  if (g4) g4.innerHTML = other.length  ? other.map(renderCard).join('')  : emptyMsg;
}

window.requestService = async (id) => {
  try {
    const r = await fetch('/api/services');
    const list = await r.json();
    const s = list.find(x => x.id === id);
    if (!s) return;

    const hasQty = +s.allow_quantity === 1;
    let qty = 1;

    if (hasQty) {
      const promptText = s.price_unit === 'day' ? 'عدد الأيام:' : s.price_unit === 'person' ? 'عدد الأشخاص:' : 'العدد:';
      const input = prompt(promptText, '1');
      if (input === null) return; // user cancelled
      qty = Math.max(1, +input || 1);
    }

    const total = (s.price_rub || 0) * qty;

    let msg = 'السلام عليكم، أرغب بحجز خدمة عبر مُساعد:';
    msg += '\n\n';
    msg += 'الخدمة: ' + s.name;
    if (s.city)         msg += '\nالمدينة: ' + s.city;
    if (s.description)  msg += '\nالتفاصيل: ' + s.description;
    if (hasQty)         msg += '\nالعدد: ' + qty;
    if (s.price_rub)    msg += '\nالسعر: ' + total.toLocaleString('ar-EG') + ' RUB';
    msg += '\n\nأرجو تأكيد التوفر.';

    try {
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'عميل من الموقع',
          phone: '-', whatsapp: '-', country: '-',
          persons: qty, city: s.city || '',
          services: [{ type: 'service', id: s.id, name: s.name, qty: qty }],
          estimated_rub: total,
          notes: 'حجز خدمة: ' + s.name + (hasQty ? ' (عدد: ' + qty + ')' : '')
        })
      });
    } catch (e) { /* ignore */ }

    toast('جارٍ فتح WhatsApp...', 'ok');
    setTimeout(() => {
      window.open('https://wa.me/' + SETTINGS.whatsapp_number + '?text=' + encodeURIComponent(msg), '_blank');
    }, 500);
  } catch (e) { toast('خطأ', 'err'); }
};

window.requestRestaurant = async (id) => {
  try {
    const r = await fetch('/api/restaurants');
    const list = await r.json();
    const rest = list.find(x => x.id === id);
    if (!rest) return;

    let msg = 'السلام عليكم، أريد حجز مطعم عبر مُساعد:';
    msg += '\n\n';
    msg += 'المطعم: ' + rest.name + '\n';
    msg += 'المدينة: ' + rest.city;
    if (rest.cuisine) msg += '\nالنوع: ' + rest.cuisine;

    try {
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'عميل من الموقع',
          phone: '-', whatsapp: '-', country: '-',
          persons: 1, city: rest.city,
          services: [{ type: 'restaurant', id: rest.id, name: rest.name }],
          estimated_rub: 0,
          notes: 'حجز مطعم: ' + rest.name
        })
      });
    } catch (e) { /* ignore */ }

    toast('جارٍ فتح WhatsApp...', 'ok');
    setTimeout(() => {
      window.open('https://wa.me/' + SETTINGS.whatsapp_number + '?text=' + encodeURIComponent(msg), '_blank');
    }, 500);
  } catch (e) { toast('خطأ', 'err'); }
};

async function loadUniversities() {
  try {
    const r = await fetch('/api/universities');
    const list = await r.json();
    // For contract section: show universities with study_type = 'contract' or 'both'
    const contractOnly = list.filter(u => !u.study_type || u.study_type === 'contract' || u.study_type === 'both');

    const renderCard = (u) => {
      return '<div class="card">' +
        '<div class="card-img"><img src="' + (u.image || 'https://images.unsplash.com/photo-1562774053-701939374585?w=800') + '" alt="' + u.name_ar + '" loading="lazy"></div>' +
        '<div class="card-body">' +
          '<h3>' + u.name_ar + '</h3>' +
          '<p style="color:var(--gold);font-weight:700;">' + (u.city || '') + '</p>' +
          (u.specializations ? '<p style="font-size:.85rem;color:var(--gray);">التخصصات: ' + u.specializations + '</p>' : '') +
          (u.description ? '<p>' + u.description + '</p>' : '') +
          '<div class="card-foot" style="display:flex;gap:8px;flex-wrap:wrap;">' +
            (u.tuition_rub ? '<div class="price" style="width:100%;margin-bottom:8px;">' + u.tuition_rub.toLocaleString('ar-EG') + ' RUB / سنة</div>' : '') +
            '<button class="btn btn-gold" style="width:100%;" onclick="requestUniversity(' + u.id + ')">استفسر عبر واتساب</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    };

    const emptyMsg = '<p style="text-align:center;color:var(--gray);grid-column:1/-1;padding:40px;">لا توجد جامعات متاحة حالياً.</p>';
    const grid = document.getElementById('universitiesGrid');
    if (grid) grid.innerHTML = contractOnly.length ? contractOnly.map(renderCard).join('') : emptyMsg;
  } catch (e) {
    console.warn('Universities load failed', e);
  }
}

/* ============ حساب سعر الفندق يوم بيوم ============ */
function calcSegment(seg) {
  const rooms = +seg.rooms || 1;
  const hotel = HOTELS.find(x => x.id === seg.hotelId);
  if (!hotel) return { nights: 0, total: 0, hotel: null, rooms, breakdown: [], isNewBooking: false };
  if (!seg.arrival || !seg.departure) return { nights: 0, total: 0, hotel, rooms, breakdown: [], isNewBooking: false };

  const nights = Math.max(0, Math.round((new Date(seg.departure) - new Date(seg.arrival)) / 86400000));
  if (nights === 0) return { nights: 0, total: 0, hotel, rooms, breakdown: [], isNewBooking: false };

  // إذا لم يتم اختيار نوع الغرفة، استخدم الطريقة القديمة
  if (!seg.roomTypeId) {
    // === الطريقة القديمة (fallback) ===
    let total = 0;
    const breakdown = [];
    let dStr = seg.arrival;
    let last = null;
    while (dStr < seg.departure) {
      const price = hotel.price_rub || 0;
      const dateObj = new Date(dStr);
      const month = dateObj.getMonth() + 1;
      let label = 'السعر الأساسي';
      let priceForDay = price;

      // موسمية بسيطة (نفس المنطق القديم)
      if (month === 12 || month === 1) {
        label = 'موسم رأس السنة';
        priceForDay = price * 1.5;
      } else if (month >= 6 && month <= 8) {
        label = 'موسم الصيف';
        priceForDay = price * 1.2;
      } else if (month === 5 || month === 9) {
        label = 'موسم الربيع/الخريف';
        priceForDay = price * 1.1;
      }

      total += priceForDay;
      if (last && last.label === label && last.subtotal !== undefined) {
        last.subtotal += priceForDay;
        last.to = dStr;
      } else {
        last = { from: dStr, to: dStr, price: priceForDay, label, nights: 1, subtotal: priceForDay };
        breakdown.push(last);
      }

      const next = new Date(dStr);
      next.setDate(next.getDate() + 1);
      dStr = next.toISOString().split('T')[0];
    }

    const totalWithRooms = total * rooms;
    return { nights, total: totalWithRooms, hotel, rooms, breakdown, perNightTotal: total, isNewBooking: false };
  }

  // === الطريقة الجديدة (Booking Engine) ===
  // هذه البيانات ستُجلب من API لاحقاً (calculate)
  // هنا نعرض فقط أن الحساب سيتم عبر API
  return {
    nights,
    total: seg._bookingTotal || 0,
    hotel,
    rooms,
    breakdown: seg._bookingBreakdown || [],
    perNightTotal: seg._bookingPerNight || 0,
    isNewBooking: true,
    roomTypeId: seg.roomTypeId,
    adults: seg.adults || 2,
    childrenAges: seg.childrenAges || [],
    mealPlanId: seg.mealPlanId || null
  };
}

/* ============ HOTEL SEGMENTS ============ */
let hotelSegments = [];
let hotelCounter = 0;

function addHotelSegment() {
  hotelCounter++;
  const id = 'hs-' + hotelCounter;
  const seg = { id, city: '', hotelId: '', arrival: '', departure: '', rooms: '' };
  hotelSegments.push(seg);
  renderHotelSegments();
  calculate();
}
function removeHotelSegment(id) {
  hotelSegments = hotelSegments.filter(s => s.id !== id);
  renderHotelSegments();
  calculate();
}
function renderHotelSegments() {
  const container = document.getElementById('hotelsList');
  if (!container) return;
  if (!hotelSegments.length) {
    container.innerHTML = '<p style="text-align:center;color:var(--gray);padding:20px;background:#fff;border-radius:12px;border:2px dashed var(--border);">اضغط "إضافة فندق جديد" لبدء إضافة فنادق رحلتك</p>';
    return;
  }
  container.innerHTML = hotelSegments.map((seg, idx) => {
    const cityOptions = CITY_LIST.map(c => `<option value="${c}" ${seg.city === c ? 'selected' : ''}>${c}</option>`).join('');
    // ✅ عرض الفنادق فقط بعد: المدينة + التواريخ
    const canShowHotels = seg.city && seg.arrival && seg.departure;
    const filteredHotels = canShowHotels 
      ? HOTELS.filter(h => h.city === seg.city).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      : [];
    const hotelOptions = filteredHotels.map(h => `<option value="${h.id}" ${seg.hotelId == h.id ? 'selected' : ''}>${h.name}</option>`).join('');
    const roomsCount = +seg.rooms || 0;

    // بناء نموذج لكل غرفة
    let roomsHtml = '';
    for (let r = 1; r <= roomsCount; r++) {
      const roomKey = 'room' + r; // room1, room2, ...
      const roomData = seg[roomKey] || {};
      const roomTypeId = roomData.roomTypeId || '';
      const mealPlanId = roomData.mealPlanId || '';
      const adults = roomData.adults || '';
      const childrenCount = roomData.childrenCount || 0;
      const childrenAges = roomData.childrenAges || [];

      // حقول أعمار الأطفال
      let childrenAgesHtml = '';
      for (let c = 0; c < childrenCount; c++) {
        const ageVal = childrenAges[c] !== undefined ? childrenAges[c] : '';
        childrenAgesHtml += `
          <div class="field" style="margin-top:6px;">
            <label style="font-size:.8rem;"> عمر الطفل ${c + 1}</label>
            <input type="number" class="seg-child-age" data-seg-id="${seg.id}" data-room="${r}" data-child-idx="${c}" min="0" max="17" value="${ageVal}" placeholder="مثال: 5">
          </div>
          <div class="field seg-child-bed-container" data-seg-id="${seg.id}" data-room="${r}" data-child-idx="${c}" style="margin-top:6px;display:none;">
            <label style="font-size:.8rem;">🛏️ نوع سرير الطفل ${c + 1}</label>
            <select class="seg-child-bed-type" data-seg-id="${seg.id}" data-room="${r}" data-child-idx="${c}">
              <option value="">— أدخل العمر أولاً —</option>
            </select>
          </div>`;
      }

      roomsHtml += `
      <div class="room-block" data-seg-id="${seg.id}" data-room="${r}" style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:14px;margin-top:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <strong style="color:var(--navy);font-size:.95rem;">الغرفة ${r}</strong>
        </div>
        <div class="hotel-segment-grid">
          <div class="field full">
            <label> نوع الغرفة</label>
            <select class="seg-room-type" data-seg-id="${seg.id}" data-room="${r}" ${(!seg.hotelId || roomsCount < 1) ? 'disabled' : ''}>
              <option value="">${!seg.hotelId ? '— اختر الفندق أولاً —' : roomsCount < 1 ? '— حدد عدد الغرف أولاً —' : '— جاري التحميل... —'}</option>
            </select>
          </div>
          <div class="field">
            <label> عدد البالغين</label>
            <input type="number" class="seg-adults" data-seg-id="${seg.id}" data-room="${r}" min="1" max="6" value="${adults || ''}" placeholder="أدخل عدد البالغين">
          </div>
          <div class="field">
            <label> عدد الأطفال</label>
            <input type="number" class="seg-children-count" data-seg-id="${seg.id}" data-room="${r}" min="0" max="4" value="${childrenCount}">
          </div>
        </div>
        ${childrenAgesHtml ? `<div style="margin-top:10px;padding-top:10px;border-top:1px dashed #e5e7eb;">${childrenAgesHtml}</div>` : ''}
        <div class="field full" style="margin-top:10px;">
          <label> خطة الوجبات</label>
          <select class="seg-meal-plan" data-seg-id="${seg.id}" data-room="${r}">
            <option value="">بدون وجبات (RO)</option>
          </select>
        </div>
      </div>`;
    }

    return `
    <div class="hotel-segment" data-seg-id="${seg.id}">
      <div class="hotel-segment-header">
        <h4><span class="num">${idx + 1}</span> فندق رقم ${idx + 1}</h4>
        <button type="button" class="hotel-segment-remove" onclick="removeHotelSegment('${seg.id}')" title="حذف">X</button>
      </div>
      <div class="hotel-segment-grid">
        <div class="field full">
          <label>المدينة</label>
          <select class="seg-city" data-seg-id="${seg.id}">
            <option value="">اختر المدينة</option>
            ${cityOptions}
          </select>
        </div>
        <div class="field">
          <label>تاريخ الوصول</label>
          <input type="date" class="seg-arrival" data-seg-id="${seg.id}" value="${seg.arrival}">
        </div>
        <div class="field">
          <label>تاريخ المغادرة</label>
          <input type="date" class="seg-departure" data-seg-id="${seg.id}" value="${seg.departure}">
        </div>
        <div class="field full">
          <label>الفندق</label>
          <select class="seg-hotel" data-seg-id="${seg.id}" ${(!seg.city || !seg.arrival || !seg.departure) ? 'disabled' : ''}>
            <option value="">${(!seg.city || !seg.arrival || !seg.departure) ? 'أكمل المدينة والتواريخ أولاً' : 'اختر الفندق'}</option>
            ${(!seg.city || !seg.arrival || !seg.departure) ? '' : hotelOptions}
          </select>
        </div>
        <div class="field">
          <label>عدد الغرف</label>
          <input type="number" class="seg-rooms" data-seg-id="${seg.id}" min="1" max="5" value="${seg.rooms || ''}" placeholder="أدخل عدد الغرف">
        </div>
      </div>
      ${roomsHtml}
      <div class="seg-breakdown" data-seg-id="${seg.id}" style="display:none;background:#f0fdf4;padding:12px;border-radius:8px;margin-top:12px;font-size:.85rem;border:1px solid #86efac;"></div>
      <div class="hotel-segment-total">
        <span>مجموع هذا الفندق</span>
        <span class="seg-total" data-seg-id="${seg.id}">0 ₽</span>
      </div>
    </div>`;
  }).join('');

  // مستمعات الأحداث
  $$('.seg-city').forEach(el => el.onchange = () => updateSegment(el.dataset.segId, 'city', el.value));
  $$('.seg-hotel').forEach(el => el.onchange = () => updateSegment(el.dataset.segId, 'hotelId', el.value));
  $$('.seg-arrival').forEach(el => el.onchange = () => {
    updateSegment(el.dataset.segId, 'arrival', el.value);
    updateNightsDisplay(el.dataset.segId);
    const seg = hotelSegments.find(s => s.id === el.dataset.segId);
    if (seg && seg.hotelId) loadHotelBookingOptions(seg);
  });
  $$('.seg-departure').forEach(el => el.onchange = () => {
    updateSegment(el.dataset.segId, 'departure', el.value);
    updateNightsDisplay(el.dataset.segId);
    const seg = hotelSegments.find(s => s.id === el.dataset.segId);
    if (seg && seg.hotelId) loadHotelBookingOptions(seg);
  });
  $$('.seg-rooms').forEach(el => el.oninput = () => {
    updateSegment(el.dataset.segId, 'rooms', el.value);
    // ✅ إعادة تحميل أنواع الغرف بعد تغيير عدد الغرف
    setTimeout(() => {
      const seg = hotelSegments.find(s => s.id === el.dataset.segId);
      if (seg && seg.hotelId) loadHotelBookingOptions(seg);
    }, 100);
  });

  // مستمعات الغرف المتعددة
  $$('.seg-room-type').forEach(el => el.onchange = () => updateRoomData(el.dataset.segId, el.dataset.room, 'roomTypeId', el.value));
  $$('.seg-adults').forEach(el => el.onchange = () => updateRoomData(el.dataset.segId, el.dataset.room, 'adults', +el.value || 2));
  $$('.seg-children-count').forEach(el => el.onchange = () => updateRoomData(el.dataset.segId, el.dataset.room, 'childrenCount', +el.value || 0));
  $$('.seg-child-age').forEach(el => {
    el.onchange = async () => {
      const segId = el.dataset.segId;
      const roomNum = el.dataset.room;
      const childIdx = +el.dataset.childIdx;
      const age = +el.value || 0;
      
      console.log('🔍 Age changed:', { segId, roomNum, childIdx, age });
      
      // تحديث childrenAges
      updateChildAge(segId, roomNum, childIdx, age);
      
      // جلب أنواع الأسرّة
      const seg = hotelSegments.find(s => s.id === segId);
      const roomData = seg['room' + roomNum] || {};
      const roomTypeId = roomData.roomTypeId;
      
      console.log('🔍 roomTypeId:', roomTypeId);
      
      if (!roomTypeId) {
        console.log('⏭️  No roomTypeId');
        return;
      }
      
      // ابحث عن bed container
      let bedContainer = document.querySelector('.seg-child-bed-container[data-seg-id="' + segId + '"][data-room="' + roomNum + '"][data-child-idx="' + childIdx + '"]');
      let bedSelect = bedContainer ? bedContainer.querySelector('.seg-child-bed-type') : null;
      
      console.log('🔍 bedContainer:', bedContainer);
      console.log('🔍 bedSelect:', bedSelect);
      
      if (!bedSelect) {
        console.log('❌ bedSelect not found');
        return;
      }
      
      if (!age || age < 0) {
        bedContainer.style.display = 'none';
        return;
      }
      
      try {
        const url = '/api/booking/child-bed-types/' + roomTypeId + '?age=' + age;
        console.log('📡 Fetching:', url);
        const bedTypes = await api(url);
        console.log('📥 Received:', bedTypes);
        
        if (!bedTypes || bedTypes.length === 0) {
          // ✅ لا توجد سياسات → إخفاء الـ container بالكامل
          console.log('⏭️  No bed types available — hiding container');
          bedContainer.style.display = 'none';
          return;
        }
        
        const bedLabels = { base: '🛏️ أساسي', extra: '➕ إضافي', child: '👶 أطفال' };
        const priceLabels = (p) => {
          if (p.price_type === 'free') return 'مجاني';
          if (p.price_type === 'fixed') return p.price_value + ' RUB';
          if (p.price_type === 'percent') return p.price_value + '%';
          return '';
        };
        
        bedSelect.disabled = false;
        bedSelect.innerHTML = '<option value="">— اختر نوع السرير —</option>' +
          bedTypes.map(bt => `<option value="${bt.bed_type}">${bedLabels[bt.bed_type] || bt.bed_type} (${priceLabels(bt)})</option>`).join('');
        
        bedContainer.style.display = 'block';
        console.log('✅ Bed types loaded');
      } catch (e) {
        console.error('❌ child-bed-types error:', e);
        bedContainer.style.display = 'block';
        bedSelect.innerHTML = '<option value="">خطأ في التحميل</option>';
      }
    };
  });
  
  // ✅ مستمع child bed type
  $$('.seg-child-bed-type').forEach(el => el.onchange = () => {
    const segId = el.dataset.segId;
    const roomNum = el.dataset.room;
    const childIdx = +el.dataset.childIdx;
    const bedType = el.value;
    
    updateChildBedType(segId, roomNum, childIdx, bedType);
  });
  $$('.seg-meal-plan').forEach(el => el.onchange = () => updateRoomData(el.dataset.segId, el.dataset.room, 'mealPlanId', el.value));

  //  تحديث المدة لكل فندق (متعدد المرات لضمان الثبات)
  hotelSegments.forEach(seg => {
    updateNightsDisplay(seg.id);
    setTimeout(() => updateNightsDisplay(seg.id), 0);
    setTimeout(() => updateNightsDisplay(seg.id), 50);
    setTimeout(() => updateNightsDisplay(seg.id), 150);
  });

  // تحميل خيارات الحجز لكل فندق
  hotelSegments.forEach(seg => {
    if (seg.hotelId) loadHotelBookingOptions(seg);
  });
}

// 🆕 تحديث بيانات غرفة محددة
function updateRoomData(segId, roomNum, key, value) {
  const seg = hotelSegments.find(s => s.id === segId);
  if (!seg) return;
  const roomKey = 'room' + roomNum;
  if (!seg[roomKey]) seg[roomKey] = {};
  seg[roomKey][key] = value;

  // ✅ إذا تغير نوع الغرفة → امسح بيانات الأطفال
  if (key === 'roomTypeId') {
    // امسح أعمار الأطفال + أنواع الأسرّة
    seg[roomKey].childrenAges = [];
    seg[roomKey].childBedTypes = [];
    
    // امسح رسالة السعر القديمة
    const breakdownEl = document.querySelector('.seg-breakdown[data-seg-id="' + segId + '"]');
    if (breakdownEl) {
      breakdownEl.style.display = 'none';
      breakdownEl.innerHTML = '';
    }
    
    // أعد بناء الفندق (لإخفاء/إظهار dropdown)
    renderHotelSegments();
    updateNightsDisplay(segId);
    recalcBooking(seg);
    return;
  }

  // امسح الرسالة القديمة + اعرض "جاري الحساب"
  const breakdownEl = document.querySelector('.seg-breakdown[data-seg-id="' + segId + '"]');
  if (breakdownEl) {
    breakdownEl.style.display = 'block';
    breakdownEl.innerHTML = '<p style="text-align:center;color:#6b7280;">جاري الحساب...</p>';
  }

  updateNightsDisplay(segId);

  // إذا تغير عدد الأطفال → امسح الأعمار + أعد البناء
  if (key === 'childrenCount') {
    if (seg[roomKey].childrenAges) {
      seg[roomKey].childrenAges = seg[roomKey].childrenAges.slice(0, Math.max(0, value));
    } else {
      seg[roomKey].childrenAges = [];
    }
    if (seg[roomKey].childBedTypes) {
      seg[roomKey].childBedTypes = seg[roomKey].childBedTypes.slice(0, Math.max(0, value));
    } else {
      seg[roomKey].childBedTypes = [];
    }
    renderHotelSegments();
    setTimeout(() => updateNightsDisplay(segId), 0);
    setTimeout(() => recalcBooking(seg), 50);
    return;
  }

  // إذا تغير البالغين أو الوجبات → أعد الحساب
  if (key === 'adults' || key === 'mealPlanId') {
    recalcBooking(seg);
  }
}

// 🆕 تحديث عمر طفل محدد

function updateChildBedType(segId, roomNum, childIdx, bedType) {
  const seg = hotelSegments.find(s => s.id === segId);
  if (!seg) return;
  const roomKey = 'room' + roomNum;
  if (!seg[roomKey]) seg[roomKey] = {};
  if (!seg[roomKey].childBedTypes) seg[roomKey].childBedTypes = [];
  seg[roomKey].childBedTypes[childIdx] = bedType;
  
  // ✅ امسح الرسالة القديمة + اعرض "جاري الحساب"
  const breakdownEl = document.querySelector('.seg-breakdown[data-seg-id="' + segId + '"]');
  if (breakdownEl) {
    breakdownEl.style.display = 'block';
    breakdownEl.innerHTML = '<p style="text-align:center;color:#6b7280;">جاري الحساب...</p>';
  }
  
  updateNightsDisplay(segId);
  recalcBooking(seg);
}

function updateChildAge(segId, roomNum, childIdx, age) {
  const seg = hotelSegments.find(s => s.id === segId);
  if (!seg) return;
  const roomKey = 'room' + roomNum;
  if (!seg[roomKey]) seg[roomKey] = {};
  if (!seg[roomKey].childrenAges) seg[roomKey].childrenAges = [];
  
  // ✅ التحقق: هل تغير العمر فعلاً؟
  const previousAge = seg[roomKey].childrenAges[childIdx];
  seg[roomKey].childrenAges[childIdx] = age;
  
  // ✅ إذا تغيّر العمر، امسح نوع السرير المُختار
  if (previousAge !== age) {
    if (!seg[roomKey].childBedTypes) seg[roomKey].childBedTypes = [];
    seg[roomKey].childBedTypes[childIdx] = '';
    
    // امسح قيمة الـ select في الواجهة
    const bedSelect = document.querySelector('.seg-child-bed-type[data-seg-id="' + segId + '"][data-room="' + roomNum + '"][data-child-idx="' + childIdx + '"]');
    if (bedSelect) {
      bedSelect.value = '';
    }
  }
  
  // ✅ امسح الرسالة القديمة + اعرض "جاري الحساب"
  const breakdownEl = document.querySelector('.seg-breakdown[data-seg-id="' + segId + '"]');
  if (breakdownEl) {
    breakdownEl.style.display = 'block';
    breakdownEl.innerHTML = '<p style="text-align:center;color:#6b7280;">جاري الحساب...</p>';
  }
  
  updateNightsDisplay(segId);
  recalcBooking(seg);
}

function updateSegment(id, key, value) {
  const seg = hotelSegments.find(s => s.id === id);
  if (!seg) return;

  if (key === 'city') {
    seg.city = value;
    seg.hotelId = '';
    for (let r = 1; r <= 5; r++) delete seg['room' + r];
    renderHotelSegments();
    updateNightsDisplay(seg.id);
    calculate();
    return;
  }

  if (key === 'arrival' || key === 'departure') {
    seg[key] = value;
    updateNightsDisplay(seg.id);
    
    // ✅ إذا اكتملت الشروط (مدينة + تواريخ) → أعد البناء لإظهار الفنادق
    if (seg.city && seg.arrival && seg.departure) {
      // إذا كان الفندق محدد لكنه ليس من المدينة → امسحه
      if (seg.hotelId) {
        const hotel = HOTELS.find(h => h.id == seg.hotelId);
        if (!hotel || hotel.city !== seg.city) {
          seg.hotelId = '';
          for (let r = 1; r <= 5; r++) delete seg['room' + r];
        }
      }
      renderHotelSegments();
    }
    
    // ✅ التحقق من التاريخ في الماضي
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const arrivalDate = new Date(seg.arrival + 'T00:00:00');
    
    const breakdownEl = document.querySelector('.seg-breakdown[data-seg-id="' + seg.id + '"]');
    
    if (arrivalDate < today) {
      if (breakdownEl) {
        breakdownEl.style.display = 'block';
        breakdownEl.innerHTML = '<div style="padding:12px;margin-bottom:8px;background:#fef2f2;border:1px solid #dc2626;border-radius:8px;">' +
          '<div style="font-weight:700;color:#991b1b;font-size:.9rem;margin-bottom:6px;">⚠️ تاريخ غير صالح</div>' +
          '<div style="font-size:.85rem;color:#7f1d1d;line-height:1.5;">تاريخ الوصول في الماضي. الرجاء اختيار تاريخ صالح.</div>' +
          '</div>';
      }
      seg._bookingTotal = 0;
      refreshSegmentsUI();
      calculate();
      return;
    }
    
    // امسح تفاصيل السعر + اعرض "جاري الحساب"
    if (breakdownEl && seg.hotelId) {
      breakdownEl.style.display = 'block';
      breakdownEl.innerHTML = '<p style="text-align:center;color:#6b7280;">جاري حساب السعر...</p>';
    }
    
    const totalEl = document.querySelector('.seg-total[data-seg-id="' + seg.id + '"]');
    if (totalEl) totalEl.textContent = '...';
    
    recalcBooking(seg);
    return;
  }

  if (key === 'hotelId') {
    seg.hotelId = value;
    for (let r = 1; r <= 5; r++) delete seg['room' + r];
    renderHotelSegments();
    if (seg.hotelId) loadHotelBookingOptions(seg);
    updateNightsDisplay(seg.id);
    calculate();
    return;
  }

  if (key === 'rooms') {
    const newRooms = value === '' ? '' : Math.max(1, Math.min(5, +value || 1));
    seg.rooms = newRooms;
    if (newRooms === '') {
      // امسح كل الغرف
      for (let r = 1; r <= 5; r++) delete seg['room' + r];
    } else {
      for (let r = newRooms + 1; r <= 5; r++) delete seg['room' + r];
    }
    renderHotelSegments();
    if (seg.hotelId && newRooms !== '') loadHotelBookingOptions(seg);
    setTimeout(() => updateNightsDisplay(seg.id), 0);
    if (newRooms !== '') recalcBooking(seg);
    return;
  }

  seg[key] = value;
  updateNightsDisplay(seg.id);
  calculate();
}
async function loadHotelBookingOptions(seg) {
  if (!seg.hotelId) return;
  const roomsCount = +seg.rooms || 1;

  try {
    let roomTypesUrl = '/api/booking/room-types/' + seg.hotelId;
    if (seg.arrival && seg.departure) {
      roomTypesUrl += '?date_from=' + seg.arrival + '&date_to=' + seg.departure;
    }
    
    const roomTypes = await api(roomTypesUrl);
    const meals = await api('/api/booking/meal-plans/' + seg.hotelId);

    for (let r = 1; r <= roomsCount; r++) {
      const roomKey = 'room' + r;
      const roomData = seg[roomKey] || {};
      
      // التحقق من أن النوع المختار لا يزال متاحاً
      let currentType = roomData.roomTypeId || '';
      if (currentType && roomTypes.length > 0) {
        const isStillAvailable = roomTypes.some(rt => rt.id == currentType);
        if (!isStillAvailable) {
          seg[roomKey].roomTypeId = '';
          currentType = '';
        }
      }
      
      const currentMeal = roomData.mealPlanId || '';

      const rtSelect = document.querySelector('.seg-room-type[data-seg-id="' + seg.id + '"][data-room="' + r + '"]');
      if (rtSelect) {
        // ✅ التحقق من الشروط: الفندق + عدد الغرف
        const canShowRooms = seg.hotelId && (+seg.rooms || 0) > 0;
        
        if (!canShowRooms) {
          rtSelect.disabled = true;
          rtSelect.style.color = '';
          rtSelect.style.fontWeight = '';
          const placeholder = !seg.hotelId ? '— اختر الفندق أولاً —' : '— حدد عدد الغرف أولاً —';
          rtSelect.innerHTML = '<option value="">' + placeholder + '</option>';
        } else if (roomTypes.length === 0 && seg.arrival && seg.departure) {
          rtSelect.innerHTML = '<option value="">لا تتوفر أنواع غرف للتواريخ المحددة — تواصل معنا على واتساب</option>';
          rtSelect.disabled = true;
          rtSelect.style.color = '#dc2626';
          rtSelect.style.fontWeight = '700';
        } else {
          rtSelect.disabled = false;
          rtSelect.style.color = '';
          rtSelect.style.fontWeight = '';
          rtSelect.innerHTML = '<option value="">— اختر نوع الغرفة —</option>' +
            roomTypes.map(rt => `<option value="${rt.id}" ${currentType == rt.id ? 'selected' : ''}>${rt.name}</option>`).join('');
        }
      }

      const mealSelect = document.querySelector('.seg-meal-plan[data-seg-id="' + seg.id + '"][data-room="' + r + '"]');
      if (mealSelect) {
        // ✅ التحقق من تفعيل الوجبات لهذا النوع
        const currentTypeNum = currentType ? +currentType : null;
        const selectedRoomType = currentTypeNum ? roomTypes.find(rt => +rt.id === currentTypeNum) : null;
        
        console.log('🍽️ Meal check:', { currentType, currentTypeNum, selectedRoomType: selectedRoomType ? { id: selectedRoomType.id, meals_enabled: selectedRoomType.meals_enabled } : null });
        
        const mealsEnabled = selectedRoomType ? (+selectedRoomType.meals_enabled === 1) : true;
        
        if (!mealsEnabled && currentType) {
          // ✅ الوجبات معطّلة → إخفاء الحقل
          const mealField = mealSelect.closest('.field');
          if (mealField) mealField.style.display = 'none';
          mealSelect.innerHTML = '<option value="">بدون وجبات (RO)</option>';
          console.log('   → Hidden meals for type', currentType);
        } else {
          const mealField = mealSelect.closest('.field');
          if (mealField) mealField.style.display = '';
          mealSelect.innerHTML = '<option value="">بدون وجبات (RO)</option>' +
            meals.map(m => `<option value="${m.id}" ${currentMeal == m.id ? 'selected' : ''}>${m.name} — ${m.description || ''} (${m.price_per_person} RUB/شخص)</option>`).join('');
        }
      }
    }
  } catch (e) {
    console.error('loadHotelBookingOptions error:', e);
  }
  
  updateNightsDisplay(seg.id);
}

async function recalcBooking(seg) {
  const roomsCount = +seg.rooms || 0;
  const breakdownEl = document.querySelector('.seg-breakdown[data-seg-id="' + seg.id + '"]');
  
  // إذا كانت البيانات ناقصة، أخفِ التفاصيل
  if (!seg.hotelId || !seg.arrival || !seg.departure) {
    if (breakdownEl) {
      breakdownEl.style.display = 'none';
      breakdownEl.innerHTML = '';
    }
    updateNightsDisplay(seg.id);
    refreshSegmentsUI();
    return;
  }

  // ✅ التحقق من أن تاريخ الوصول ليس في الماضي
  const today = new Date();
  today.setHours(0, 0, 0, 0);  // إزالة الوقت
  const arrivalDate = new Date(seg.arrival + 'T00:00:00');
  
  if (arrivalDate < today) {
    if (breakdownEl) {
      breakdownEl.style.display = 'block';
      breakdownEl.innerHTML = '<div style="padding:12px;margin-bottom:8px;background:#fef2f2;border:1px solid #dc2626;border-radius:8px;">' +
        '<div style="font-weight:700;color:#991b1b;font-size:.9rem;margin-bottom:6px;">⚠️ تاريخ غير صالح</div>' +
        '<div style="font-size:.85rem;color:#7f1d1d;line-height:1.5;">تاريخ الوصول في الماضي. الرجاء اختيار تاريخ صالح.</div>' +
        '</div>';
    }
    seg._bookingTotal = 0;
    refreshSegmentsUI();
    calculate();
    return;
  }
  
  // إذا لم يتم اختيار أي نوع غرفة، أخفِ التفاصيل
  let anyRoomSelected = false;
  for (let r = 1; r <= roomsCount; r++) {
    const roomData = seg['room' + r] || {};
    if (roomData.roomTypeId) {
      anyRoomSelected = true;
      break;
    }
  }
  if (!anyRoomSelected) {
    if (breakdownEl) {
      breakdownEl.style.display = 'none';
      breakdownEl.innerHTML = '';
    }
    updateNightsDisplay(seg.id);
    refreshSegmentsUI();
    return;
  }

  if (breakdownEl) {
    breakdownEl.style.display = 'block';
    breakdownEl.innerHTML = '<p style="text-align:center;color:#6b7280;">جاري حساب السعر...</p>';
  }

  let totalAllRooms = 0;
  const roomDetails = [];

  // ✅ إذا لم يُدخل العميل عدد الغرف → لا نحسب
  if (roomsCount < 1) {
    if (breakdownEl) {
      breakdownEl.style.display = 'none';
      breakdownEl.innerHTML = '';
    }
    seg._bookingTotal = 0;
    refreshSegmentsUI();
    calculate();
    return;
  }

  try {
    for (let r = 1; r <= roomsCount; r++) {
      const roomData = seg['room' + r] || {};
      const roomTypeId = roomData.roomTypeId;
      const adults = roomData.adults || 0;
      // ✅ استخدم childrenCount لقص childrenAges
      const expectedChildrenCount = roomData.childrenCount || 0;
      let childrenAges = (roomData.childrenAges || []).filter(a => a !== undefined && a !== null && a !== '');
      // إذا كان عدد الأطفال المتوقع أقل، اقص القائمة
      if (childrenAges.length > expectedChildrenCount) {
        childrenAges = childrenAges.slice(0, expectedChildrenCount);
      }
      const mealPlanId = roomData.mealPlanId;

      // ✅ التحقق من إدخال عدد البالغين (قبل أي استدعاء API)
      if (!adults || adults < 1) {
        roomDetails.push({ 
          room: r, 
          waiting_bed_type: true,
          waiting_adults: true,
          reason: 'الرجاء إدخال عدد البالغين لحساب السعر.'
        });
        continue;
      }

      if (!roomTypeId) {
        roomDetails.push({ room: r, skipped: true, reason: 'لم يتم اختيار نوع الغرفة' });
        continue;
      }

      // ✅ جلب سياسات الأطفال لهذا النوع
      let childPoliciesExist = false;
      try {
        const policiesResp = await api('/api/booking/child-bed-types/' + roomTypeId + '?age=0');
        // إذا رجع مصفوفة فارغة (أو لا توجد سياسات لأي عمر) → لا سياسات
        // لكن سنتحقق أيضاً من العمر الفعلي
        if (policiesResp && policiesResp.length > 0) {
          childPoliciesExist = true;
        } else {
          // ابحث في كل الأعمار المطلوبة
          for (const age of childrenAges) {
            const resp = await api('/api/booking/child-bed-types/' + roomTypeId + '?age=' + age);
            if (resp && resp.length > 0) {
              childPoliciesExist = true;
              break;
            }
          }
        }
      } catch (e) {
        childPoliciesExist = false;
      }

      // ✅ إذا لم توجد سياسات → تجاهل التحقق من الأطفال
      if (childPoliciesExist) {
        // التحقق من إدخال أعمار جميع الأطفال
        const expectedCount = roomData.childrenCount || 0;
        if (expectedCount > 0 && childrenAges.length < expectedCount) {
          roomDetails.push({ 
            room: r, 
            waiting_bed_type: true,
            reason: 'الرجاء إدخال عمر الطفل واختيار نوع السرير لحساب السعر.'
          });
          continue;
        }
        
        // التحقق من اختيار نوع السرير لكل طفل
        const childBedTypesForCheck = roomData.childBedTypes || [];
        let hasMissingBedType = false;
        for (let ci = 0; ci < childrenAges.length; ci++) {
          if (!childBedTypesForCheck[ci] || childBedTypesForCheck[ci] === '') {
            hasMissingBedType = true;
            break;
          }
        }
        
        if (hasMissingBedType) {
          roomDetails.push({ 
            room: r, 
            waiting_bed_type: true,
            reason: 'الرجاء اختيار نوع السرير لكل طفل لحساب السعر.'
          });
          continue;
        }
      } else {
        // ✅ لا توجد سياسات → أرسل children_ages كـ [] لحساب بدون أطفال
        childrenAges = [];
      }

      try {
        // ✅ childBedTypes
        const childBedTypes = (roomData.childBedTypes || []).slice(0, childrenAges.length);
        
        const result = await api('/api/booking/calculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hotel_id: +seg.hotelId,
            room_type_id: +roomTypeId,
            date_from: seg.arrival,
            date_to: seg.departure,
            adults: +adults,
            children_ages: childrenAges,
            child_bed_types: childBedTypes,
            meal_plan_id: mealPlanId ? +mealPlanId : null
          })
        });

        totalAllRooms += result.total;
        roomDetails.push({
          room: r,
          roomTypeId: roomTypeId,
          roomTypeName: result.room_type_name,
          adults: adults,
          childrenAges: childrenAges,
          mealPlanId: mealPlanId,
          mealPlanName: result.meal_plan ? result.meal_plan.name : null,
          nights: result.nights,
          subtotal: result.total,
          breakdown: result.breakdown,
          is_request: result.is_request || false,
          request_message: result.message || null
        });
      } catch (err) {
        roomDetails.push({ room: r, error: err.error || err.message || 'خطأ' });
      }
    }

    seg._bookingTotal = totalAllRooms;
    seg._bookingRooms = roomDetails;
    seg._bookingNights = seg.arrival && seg.departure ? Math.round((new Date(seg.departure) - new Date(seg.arrival)) / 86400000) : 0;

    if (breakdownEl) {
      const validRooms = roomDetails.filter(rd => !rd.skipped && !rd.error);
      //  التحقق: كل الغرف لها roomTypeId (حتى لو فشلت)
      const allRoomsSelected = (() => {
        let count = 0;
        for (let r = 1; r <= roomsCount; r++) {
          const roomData = seg['room' + r] || {};
          if (roomData.roomTypeId) count++;
        }
        return count === roomsCount;
      })();

      if (validRooms.length === 0 && allRoomsSelected) {
        seg._bookingTotal = 0;
        totalAllRooms = 0;
        const totalEl = document.querySelector('.seg-total[data-seg-id="' + seg.id + '"]');
        if (totalEl) totalEl.textContent = '-';
        
        breakdownEl.style.display = 'block';
        
        // ✅ التحقق من نوع الخطأ
        const firstError = roomDetails.find(rd => rd.error);
        const errorMsg = firstError ? firstError.error : '';
        const isOccupancyError = errorMsg && (
          errorMsg.includes('غير مسموحة') || 
          errorMsg.includes('أقصى عدد') || 
          errorMsg.includes('يستوعب')
        );
        
        if (isOccupancyError) {
          // ✅ خطأ في الإشغال
          breakdownEl.innerHTML = '<div style="text-align:center;padding:16px 12px;background:#fef2f2;border:1px solid #dc2626;border-radius:10px;"><div style="font-weight:700;color:#991b1b;font-size:.95rem;margin-bottom:8px;">تركيبة الإشغال غير متاحة</div><div style="font-size:.85rem;color:#7f1d1d;line-height:1.6;">' + errorMsg + '</div></div>';
        } else {
          // ✅ خطأ في الأسعار
          breakdownEl.innerHTML = '<div style="text-align:center;padding:16px 12px;background:#fffbeb;border:1px solid #fbbf24;border-radius:10px;"><div style="font-weight:700;color:#92400e;font-size:.95rem;margin-bottom:8px;">التواريخ المطلوبة غير مسجّلة حالياً</div><div style="font-size:.85rem;color:#78350f;line-height:1.6;">الرجاء التواصل معنا عبر واتساب لمعرفة السعر المتاح لهذه الفترة.</div></div>';
        }
      } else if (validRooms.length === 0) {
        breakdownEl.style.display = 'none';
        breakdownEl.innerHTML = '';
      } else {
        //  عرض تفاصيل كل غرفة (بما فيها الفاشلة)
        let html = '<div style="font-weight:700;margin-bottom:10px;color:#111827;">تفاصيل السعر:</div>';
        
        roomDetails.forEach(rd => {
          if (rd.skipped) return;
          
          // ✅ في انتظار اختيار نوع السرير / عدد البالغين
          if (rd.waiting_bed_type) {
            // ✅ رسالة مخصصة حسب السبب
            let icon = '🛏️';
            let title = 'الغرفة ' + rd.room;
            if (rd.waiting_adults) {
              icon = '👤';
              title = 'الغرفة ' + rd.room + ' — عدد البالغين';
            }
            
            html += '<div style="padding:12px;margin-bottom:8px;background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;">';
            html += '<div style="font-weight:700;color:#92400e;font-size:.9rem;margin-bottom:6px;">' + icon + ' ' + title + '</div>';
            html += '<div style="font-size:.85rem;color:#78350f;line-height:1.5;">' + (rd.reason || 'الرجاء إكمال البيانات المطلوبة لحساب السعر.') + '</div>';
            html += '</div>';
            return;
          }
          
          // ✅ طلب خاص (سعر رمزي = 0)
          if (rd.is_request) {
            html += '<div style="padding:12px;margin-bottom:8px;background:#eff6ff;border:1px solid #3b82f6;border-radius:8px;">';
            html += '<div style="font-weight:700;color:#1e40af;font-size:.9rem;margin-bottom:6px;">📞 الغرفة ' + rd.room + ': ' + rd.roomTypeName + '</div>';
            html += '<div style="font-size:.85rem;color:#1e3a8a;line-height:1.5;">' + (rd.request_message || 'هذا النوع يتم إرسال طلب خاص للفندق. يرجى التواصل على الواتساب للاتفاق.') + '</div>';
            html += '</div>';
            return;
          }
          
          if (rd.error) {
            // 🆕 غرفة بدون أسعار → رسالة ودية
            html += '<div style="padding:12px;margin-bottom:8px;background:#fffbeb;border:1px solid #fbbf24;border-radius:8px;">';
            html += '<div style="font-weight:700;color:#92400e;font-size:.9rem;margin-bottom:6px;">الغرفة ' + rd.room + '</div>';
            html += '<div style="font-weight:700;color:#92400e;font-size:.85rem;margin-bottom:4px;">التواريخ المطلوبة غير مسجّلة حالياً</div>';
            html += '<div style="font-size:.8rem;color:#78350f;line-height:1.5;">الرجاء التواصل معنا عبر واتساب لمعرفة السعر المتاح لهذه الفترة.</div>';
            html += '</div>';
          } else {
            //  غرفة بها سعر
            html += '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f3f4f6;"><span style="font-weight:600;color:#1f2937;">الغرفة ' + rd.room + ': ' + rd.roomTypeName + '</span><span style="font-weight:700;color:#059669;">' + rd.subtotal.toLocaleString('ar-EG') + ' RUB</span></div>';
          }
        });
        
        if (totalAllRooms > 0) {
          html += '<div style="display:flex;justify-content:space-between;padding:10px 0;margin-top:10px;border-top:2px solid #10b981;font-weight:700;color:#059669;font-size:1rem;"><span>المجموع الكلي</span><span>' + totalAllRooms.toLocaleString('ar-EG') + ' RUB</span></div>';
        }
        breakdownEl.innerHTML = html;
        breakdownEl.style.display = 'block';
      }
    }

    updateNightsDisplay(seg.id);
    refreshSegmentsUI();
    calculate();
  } catch (e) {
    console.error('recalcBooking error:', e);
    if (breakdownEl) {
      breakdownEl.innerHTML = '<p style="color:#dc2626;font-size:.85rem;"> ' + (e.error || e.message || 'خطأ') + '</p>';
    }
    updateNightsDisplay(seg.id);
    refreshSegmentsUI();
  }
}






function updateNightsDisplay(segId) {
  //  حقل المدة محذوف من الواجهة — هذه الدالة آمنة ولا تفعل شيئاً
  return;
}

function refreshSegmentsUI() {
  hotelSegments.forEach(seg => {
    const { nights, total } = calcSegment(seg);
    const nightsEl = document.querySelector('.seg-nights[data-seg-id="' + seg.id + '"]');
    const totalEl = document.querySelector('.seg-total[data-seg-id="' + seg.id + '"]');
    if (nightsEl) nightsEl.value = nights;
    if (totalEl) {
      // إذا كان الحساب الجديد قد اكتمل، استخدم _bookingTotal
      if (seg._bookingTotal !== undefined && seg._bookingTotal > 0) {
        totalEl.textContent = fmt(seg._bookingTotal);
      } else if (seg.roomTypeId) {
        // جاري الحساب
        totalEl.textContent = 'جاري الحساب...';
      } else {
        // الطريقة القديمة
        totalEl.textContent = fmt(total);
      }
    }
  });
}

/* ============ PLANNER ============ */
function fillPlanner() {
  renderExtraServices();

  const moscowEvents = EVENTS.filter(e => (e.city || '').trim() === 'موسكو');
  const sochiEvents  = EVENTS.filter(e => (e.city || '').trim() === 'سوتشي');
  const otherEvents  = EVENTS.filter(e => !['موسكو', 'سوتشي'].includes((e.city || '').trim()));

  const renderEvent = (e) => `
    <label class="event-check" data-id="${e.id}" data-price="${e.price_rub}" data-type="event" data-city="${e.city || ''}">
      <input type="checkbox" value="${e.id}">
      <span>
        <span class="ev-name">${e.name}</span>
        <span class="ev-price">${fmt(e.price_rub)} / للتذكرة</span>
      </span>
      <input type="number" class="ev-tickets" min="1" value="1" disabled>
    </label>`;

  let html = '';
  if (moscowEvents.length) html += '<div class="events-section-title">فعاليات موسكو</div>' + moscowEvents.map(renderEvent).join('');
  if (sochiEvents.length)  html += '<div class="events-section-title">فعاليات سوتشي</div>' + sochiEvents.map(renderEvent).join('');
  if (otherEvents.length)  html += '<div class="events-section-title">فعاليات أخرى</div>' + otherEvents.map(renderEvent).join('');

  $('#pEvents').innerHTML = html || '<p style="text-align:center;color:var(--gray);grid-column:1/-1;">لا توجد فعاليات متاحة.</p>';

  $$('.event-check input[type=checkbox]').forEach(cb => cb.onchange = () => {
    const label = cb.closest('.event-check');
    label.classList.toggle('active', cb.checked);
    const tickets = label.querySelector('.ev-tickets');
    tickets.disabled = !cb.checked;
    calculate();
  });
  $$('.event-check .ev-tickets').forEach(inp => {
    inp.onchange = calculate;
    inp.oninput = calculate;
  });
  // (Old .check handler removed - extra services use .extra-service)
  ['#pPersons', '#pArrival', '#pDeparture'].forEach(s => {
    const el = $(s); if (el) el.onchange = calculate;
  });
  $('#pCurrency').onchange = calculate;

  const addBtn = document.getElementById('addHotelBtn');
  if (addBtn) addBtn.onclick = addHotelSegment;

  renderTourPackages();

  if (!hotelSegments.length) addHotelSegment();
}
function updateHotelOptions() { /* no-op */ }
function calculate() {
  const persons = +$('#pPersons').value || 1;
  let hotelsTotal = 0;
  hotelSegments.forEach(seg => {
    //  إذا كان الحساب الجديد قد اكتمل (من recalcBooking)، استخدم _bookingTotal
    if (seg._bookingTotal !== undefined && seg._bookingTotal > 0) {
      hotelsTotal += seg._bookingTotal;
    } else {
      // fallback: النظام القديم
      hotelsTotal += calcSegment(seg).total;
    }
  });
  refreshSegmentsUI();

  let servicesTotal = 0, eventsTotal = 0, tourPackagesTotal = 0;

  // Extra Services (cards, with quantity support)
  $$('.extra-card.active').forEach(card => {
    const price = +card.dataset.price || 0;
    const hasQty = +card.dataset.qty === 1;
    let qty = 1;
    if (hasQty) {
      const countInput = card.querySelector('.extra-count');
      qty = countInput ? (+countInput.value || 1) : 1;
    }
    servicesTotal += price * qty;
  });

  // Events
  $$('.event-check input[type=checkbox]:checked').forEach(cb => {
    const label = cb.closest('.event-check');
    const price = +label.dataset.price || 0;
    const tickets = +label.querySelector('.ev-tickets').value || 1;
    eventsTotal += price * tickets;
  });

  // Tour packages (cards)
  $$('.tour-card.active').forEach(card => {
    const price = +card.dataset.price || 0;
    const unit = card.dataset.unit;
    let count = 1;
    if (unit === 'day' || unit === 'tour') {
      const countInput = card.querySelector('.tour-count');
      count = countInput ? (+countInput.value || 1) : 1;
    }
    tourPackagesTotal += price * count;
  });

  const total = hotelsTotal + servicesTotal + eventsTotal + tourPackagesTotal;
  const currency = $('#pCurrency').value;
  const res = $('#pResult');
  if (!hotelsTotal && !servicesTotal && !eventsTotal && !tourPackagesTotal) {
    res.classList.remove('show');
    $('#pSubmit').disabled = true;
    return;
  }
  res.classList.add('show');
  res.innerHTML = `
    <div class="row"><span>الفنادق (${hotelSegments.length} فندق)</span><span>${fmtWithCurrency(hotelsTotal, currency)}</span></div>
    <div class="row"><span>الجولات والتنقلات</span><span>${fmtWithCurrency(tourPackagesTotal, currency)}</span></div>
    <div class="row"><span>الفعاليات</span><span>${fmtWithCurrency(eventsTotal, currency)}</span></div>
    <div class="row"><span>الخدمات الإضافية</span><span>${fmtWithCurrency(servicesTotal, currency)}</span></div>
    <div class="total row"><span>الإجمالي التقديري</span><span>${fmtWithCurrency(total, currency)}</span></div>
    <p style="font-size:.8rem;opacity:.7;margin-top:10px">* السعر تقديري وقابل للتغيير حسب التوفر والموسم.</p>`;
  $('#pSubmit').disabled = false;
  return { persons, hotelsTotal, servicesTotal, eventsTotal, tourPackagesTotal, total, currency };
}
$('#pSubmit').onclick = async () => {
  const calc = calculate(); if (!calc) return;
  const persons = +$('#pPersons').value;
  const currency = $('#pCurrency').value;

    const hotelLines = [];
  hotelSegments.forEach((seg, idx) => {
    const hotel = HOTELS.find(h => h.id == seg.hotelId);
    if (!hotel) return;
    const nights = seg.arrival && seg.departure
      ? Math.max(0, Math.round((new Date(seg.departure) - new Date(seg.arrival)) / 86400000))
      : 0;
    const days = nights > 0 ? nights + 1 : 0;

    hotelLines.push('فندق رقم ' + (idx + 1) + ':');
    hotelLines.push('- المدينة: ' + seg.city);
    hotelLines.push('- الفندق: ' + hotel.name);
    // ✅ إضافة رابط الفندق إذا كان موجوداً
    if (hotel.website && hotel.website.trim() !== '') {
      hotelLines.push('- رابط الفندق: ' + hotel.website);
    }
    hotelLines.push('- الوصول: ' + (seg.arrival || 'لم يحدد') + ' -> ' + (seg.departure || 'لم يحدد'));
    if (nights > 0) hotelLines.push('- المدة: ' + days + ' أيام (' + nights + ' ليال)');
    hotelLines.push('- عدد الغرف: ' + (seg.rooms || 1));
    hotelLines.push('');

    // عرض تفاصيل كل غرفة (بما فيها الفاشلة)
    const roomDetails = seg._bookingRooms || [];
    let roomsTotal = 0;

    roomDetails.forEach(rd => {
      if (rd.skipped) return;
      
      if (rd.error) {
        // غرفة بدون أسعار
        hotelLines.push('  الغرفة ' + rd.room + ':');
        hotelLines.push('    - التواريخ المطلوبة غير مسجلة في المنصه');
        hotelLines.push('');
      } else {
        // غرفة بها سعر
        roomsTotal += rd.subtotal || 0;
        hotelLines.push('  الغرفة ' + rd.room + ':');
        hotelLines.push('    - نوع الغرفة: ' + (rd.roomTypeName || '-'));
        hotelLines.push('    - البالغين: ' + rd.adults);
        if (rd.childrenAges && rd.childrenAges.length) {
          hotelLines.push('    - الأطفال: ' + rd.childrenAges.length + ' (أعمار: ' + rd.childrenAges.join(', ') + ')');
        } else {
          hotelLines.push('    - الأطفال: 0');
        }
        if (rd.mealPlanName) {
          hotelLines.push('    - الوجبات: ' + rd.mealPlanName);
        }
        hotelLines.push('    - سعر الغرفة: ' + rd.subtotal.toLocaleString('ar-EG') + ' RUB');
        hotelLines.push('');
      }
    });

    if (roomsTotal > 0) {
      hotelLines.push('  مجموع الفندق: ' + roomsTotal.toLocaleString('ar-EG') + ' RUB');
    }
    hotelLines.push('');
  });

  const selectedTours = $$('.tour-card.active').map(card => {
    const name = card.querySelector('.tour-card-name').textContent.trim();
    const price = +card.dataset.price || 0;
    const unit = card.dataset.unit;
    let count = 1;
    if (unit === 'day' || unit === 'tour') {
      const countInput = card.querySelector('.tour-count');
      count = countInput ? (+countInput.value || 1) : 1;
    }
    const unitLabel = unit === 'day' ? 'أيام' : unit === 'tour' ? 'جولات' : 'طلب';
    return { name, price, unit, count, unitLabel, total: price * count };
  });

  const selectedEvents = $$('.event-check input[type=checkbox]:checked').map(cb => {
    const label = cb.closest('.event-check');
    const name = label.querySelector('.ev-name').textContent.trim();
    const tickets = +label.querySelector('.ev-tickets').value || 1;
    const price = +label.dataset.price || 0;
    const city = label.dataset.city || '';
    return { name, tickets, price, city, total: price * tickets };
  });
  const services = $$('.extra-card.active').map(card => {
    const name = card.querySelector('.extra-card-name').textContent.trim();
    const price = +card.dataset.price || 0;
    const hasQty = +card.dataset.qty === 1;
    let qty = 1;
    if (hasQty) {
      const countInput = card.querySelector('.extra-count');
      qty = countInput ? (+countInput.value || 1) : 1;
    }
    return { name, price, qty, hasQty, total: price * qty };
  });

  const lines = [];
  lines.push('السلام عليكم، أريد تجهيز رحلة إلى روسيا عبر مُساعد.');
  lines.push('');
  lines.push('عدد الأشخاص: ' + persons);

  // ✅ إضافة التواريخ العامة والمدة
  const globalArrival = $('#pArrival').value;
  const globalDeparture = $('#pDeparture').value;

  if (globalArrival && globalDeparture) {
    const startDate = new Date(globalArrival + 'T00:00:00');
    const endDate = new Date(globalDeparture + 'T00:00:00');
    const diffDays = Math.round((endDate - startDate) / 86400000);

    if (diffDays > 0) {
      const days = diffDays + 1;
      const nightsText = diffDays === 1 ? 'ليلة واحدة' : diffDays === 2 ? 'ليلتان' : diffDays + ' ليال';
      const daysText = days === 1 ? 'يوم واحد' : days === 2 ? 'يومان' : days + ' أيام';

      // تنسيق التواريخ لـ DD.MM.YYYY
      const fmtDate = (isoDate) => {
        const [y, m, d] = isoDate.split('-');
        return d + '.' + m + '.' + y;
      };

      lines.push('تاريخ الوصول: ' + fmtDate(globalArrival));
      lines.push('تاريخ المغادرة: ' + fmtDate(globalDeparture));
      lines.push('مدة الرحلة: ' + daysText + ' (' + nightsText + ')');
    }
  }

  lines.push('');
  if (hotelLines.length) {
    lines.push('الفنادق المختارة:');
    lines.push('');
    lines.push(...hotelLines);
  }
  if (selectedTours.length) {
    lines.push('الجولات والتنقلات:');
    selectedTours.forEach(t => {
      if (t.unit === 'order') {
        lines.push('- ' + t.name + ' (' + t.unitLabel + ') - ' + t.price.toLocaleString('ar-EG') + ' RUB');
      } else {
        lines.push('- ' + t.name + ' (' + t.count + ' ' + t.unitLabel + ' × ' + t.price.toLocaleString('ar-EG') + ') - ' + t.total.toLocaleString('ar-EG') + ' RUB');
      }
    });
    lines.push('');
  }
  if (selectedEvents.length) {
    // Group events by city
    const eventsByCity = {};
    selectedEvents.forEach(e => {
      const city = e.city || 'أخرى';
      if (!eventsByCity[city]) eventsByCity[city] = [];
      eventsByCity[city].push(e);
    });
    // Output grouped
    Object.keys(eventsByCity).forEach(city => {
      lines.push('فعاليات ' + city + ':');
      eventsByCity[city].forEach(e => {
        lines.push('- ' + e.name + ' (' + e.tickets + ' تذكرة) - ' + e.total.toLocaleString('ar-EG') + ' RUB');
      });
      lines.push('');
    });
  }
  if (services.length) {
    lines.push('الخدمات الإضافية:');
    services.forEach(s => {
      if (s.hasQty && s.qty > 1) {
        lines.push('- ' + s.name + ' (' + s.qty + ' × ' + s.price.toLocaleString('ar-EG') + ') - ' + s.total.toLocaleString('ar-EG') + ' RUB');
      } else {
        lines.push('- ' + s.name + ' - ' + s.total.toLocaleString('ar-EG') + ' RUB');
      }
    });
    lines.push('');
  }
  lines.push('الإجمالي التقديري:');
  lines.push('- الفنادق: ' + calc.hotelsTotal.toLocaleString('ar-EG') + ' RUB');
  lines.push('- الجولات والتنقلات: ' + calc.tourPackagesTotal.toLocaleString('ar-EG') + ' RUB');
  lines.push('- الفعاليات: ' + calc.eventsTotal.toLocaleString('ar-EG') + ' RUB');
  lines.push('- الخدمات: ' + calc.servicesTotal.toLocaleString('ar-EG') + ' RUB');
  lines.push('- الإجمالي: ' + calc.total.toLocaleString('ar-EG') + ' RUB');
  if (currency && currency !== 'RUB') {
    const conv = convertFromRub(calc.total, currency);
    if (conv !== null) lines.push('ما يعادل: ' + fmtCurrency(conv, currency));
  }
  lines.push('');
  lines.push('أرجو تأكيد التوفر والسعر النهائي.');

  const message = lines.join('\n');

  const payload = {
    name: 'عميل من الموقع', phone: '-', whatsapp: '-', country: '-',
    persons, arrival: $('#pArrival').value, departure: $('#pDeparture').value,
    city: (hotelSegments[0] && hotelSegments[0].city) || '',
    hotel_id: (hotelSegments[0] && hotelSegments[0].hotelId) || null,
    services,
    estimated_rub: calc.total,
    currency,
    notes: 'عدد الفنادق: ' + hotelSegments.length
  };
  try {
    // حفظ الـ lead
    await api('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });

    // 🆕 حفظ كل حجز فندقي في جدول hotel_bookings
    if (hotelSegments.length) {
      for (const seg of hotelSegments) {
        const roomDetails = seg._bookingRooms || [];
        for (const rd of roomDetails) {
          if (rd.skipped || rd.error) continue;
          try {
            await api('/api/booking/create', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                hotel_id: +seg.hotelId,
                room_type_id: +rd.roomTypeId,
                meal_plan_id: rd.mealPlanId ? +rd.mealPlanId : null,
                date_from: seg.arrival,
                date_to: seg.departure,
                rooms_count: 1,
                adults: rd.adults,
                children_ages: rd.childrenAges || [],
                customer_name: 'عميل من Trip Planner',
                customer_phone: '-',
                customer_notes: 'غرفة رقم ' + rd.room + ' من فندق رقم ' + (hotelSegments.indexOf(seg) + 1),
                currency: currency,
                source: 'trip-planner'
              })
            });
          } catch (e) { console.warn('Booking save failed:', e); }
        }
      }
    }

    toast('جارٍ فتح WhatsApp...', 'ok');
    setTimeout(() => {
      window.open('https://wa.me/' + SETTINGS.whatsapp_number + '?text=' + encodeURIComponent(message), '_blank');
    }, 500);
  } catch (e) { toast(e.error || 'حدث خطأ', 'err'); }
};

$('#contactForm').onsubmit = async e => {
  e.preventDefault();
  const f = e.target;
  try {
    const r = await api('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      name: f.name.value, country: f.country.value, phone: f.phone.value, notes: f.notes.value, persons: 1
    }) });
    toast('تم استلام طلبك - رقم: ' + r.code, 'ok');
    f.reset();
    setTimeout(() => window.open(waLink('مرحباً، رقم طلبي ' + r.code), '_blank'), 800);
  } catch (e) { toast(e.error || 'حدث خطأ', 'err'); }
};
window.requestHotel = async (id) => {
  try {
    const h = HOTELS.find(x => x.id === id); if (!h) return;

    let msg = 'السلام عليكم، أرغب بحجز فندق عبر مُساعد:';
    msg += '\n\n';
    msg += 'الفندق: ' + h.name + '\n';
    msg += 'المدينة: ' + h.city;
    if (h.stars) msg += '\nالنجوم: ' + h.stars + ' نجوم';
    if (h.room_type) msg += '\nنوع الغرفة: ' + h.room_type;
    if (h.website) msg += '\nالرابط: ' + h.website;
    msg += '\n\nأرجو إرسال الأسعار المتاحة حسب تواريخ رحلتي.';

    try {
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'عميل من الموقع',
          phone: '-', whatsapp: '-', country: '-',
          persons: 2, city: h.city, hotel_id: h.id,
          services: [],
          estimated_rub: 0,
          notes: 'استفسار عن فندق: ' + h.name
        })
      });
    } catch (e) { /* ignore */ }

    toast('جارٍ فتح WhatsApp...', 'ok');
    setTimeout(() => {
      window.open('https://wa.me/' + SETTINGS.whatsapp_number + '?text=' + encodeURIComponent(msg), '_blank');
    }, 500);
  } catch (e) { toast('خطأ', 'err'); }
};
window.removeHotelSegment = removeHotelSegment;

/* ============ PWA INSTALL ============ */
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const btn = document.getElementById('installAppBtn');
  if (btn) btn.style.display = 'flex';
});

window.addEventListener('appinstalled', () => {
  const btn = document.getElementById('installAppBtn');
  if (btn) btn.style.display = 'none';
  toast('تم تثبيت التطبيق بنجاح!', 'ok');
  deferredInstallPrompt = null;
});

window.installApp = async function() {
  // iPhone/iPad - لا يدعم prompt التلقائي
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

  if (isStandalone) {
    toast('التطبيق مثبت بالفعل', 'ok');
    return;
  }

  if (isIOS) {
    document.getElementById('iosInstallTip').style.display = 'flex';
    return;
  }

  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    const result = await deferredInstallPrompt.userChoice;
    if (result.outcome === 'accepted') {
      toast('جارٍ تثبيت التطبيق...', 'ok');
    }
    deferredInstallPrompt = null;
  } else {
    // Fallback: تعليمات يدوية
    alert('لتثبيت التطبيق:\n\n1. افتح قائمة المتصفح (3 نقاط)\n2. اختر "تثبيت التطبيق" أو "إضافة إلى الشاشة الرئيسية"\n3. اضغط تثبيت');
  }
};

// إظهار الزر على كل الأجهزة غير المثبّتة
window.addEventListener('load', () => {
  const btn = document.getElementById('installAppBtn');
  if (!btn) return;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (!isStandalone) {
    // إظهار الزر بعد 3 ثوانٍ إذا لم يُطلق beforeinstallprompt
    setTimeout(() => {
      if (!deferredInstallPrompt) {
        btn.style.display = 'flex';
      }
    }, 3000);
  }
});

/* ============ ADS ============ */
let AD_VIEWED = JSON.parse(localStorage.getItem('mosaad_ads_viewed') || '{}');

function isAdClosed(id) {
  const today = new Date().toISOString().split('T')[0];
  return AD_VIEWED[id] === today;
}
function markAdClosed(id) {
  const today = new Date().toISOString().split('T')[0];
  AD_VIEWED[id] = today;
  localStorage.setItem('mosaad_ads_viewed', JSON.stringify(AD_VIEWED));
}

async function loadAds() {
  try {
    const [top, middle, bottom] = await Promise.all([
      api('/api/ads?position=top'),
      api('/api/ads?position=middle'),
      api('/api/ads?position=bottom')
    ]);

    renderAds('adsTopContainer', top, 'top');
    renderAds('adsMiddleContainer', middle, 'middle');
    renderAds('adsBottomContainer', bottom, 'bottom');
  } catch (e) {
    console.warn('Ads failed to load', e);
  }
}

function renderAds(containerId, ads, position) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const visible = ads.filter(a => !isAdClosed(a.id));
  if (!visible.length) {
    container.innerHTML = '';
    container.style.display = 'none';
    return;
  }
  container.style.display = '';
  container.innerHTML = visible.map(ad => `
    <a class="ad-card ad-card-${position}" data-ad-id="${ad.id}" href="javascript:void(0)"
       style="background:${ad.bg_color || '#0a1f44'};color:${ad.text_color || '#fff'}"
       onclick="handleAdClick(event, ${ad.id}, '${(ad.action_type || 'link').replace(/'/g, "\\'")}', '${(ad.action_value || '').replace(/'/g, "\\'")}')">
      <button class="ad-close" onclick="closeAd(event, ${ad.id})" title="إغلاق">✕</button>
      ${ad.image ? `<img class="ad-image" src="${ad.image}" alt="${ad.title}" loading="lazy">` : ''}
      <div class="ad-body">
        <div class="ad-title">
          <span class="ad-badge">إعلان</span>
          ${ad.title}
        </div>
        ${ad.description ? `<div class="ad-description">${ad.description}</div>` : ''}
      </div>
      ${ad.button_text ? `<div class="ad-button">${ad.button_text}</div>` : ''}
    </a>
  `).join('');

  // Track impressions
  visible.forEach(ad => {
    api('/api/ads/' + ad.id + '/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'impression' })
    }).catch(() => {});
  });
}

window.closeAd = function(event, id) {
  event.stopPropagation();
  event.preventDefault();
  markAdClosed(id);
  const card = document.querySelector(`.ad-card[data-ad-id="${id}"]`);
  if (card) {
    card.style.opacity = '0';
    card.style.transform = 'translateY(-10px)';
    setTimeout(() => {
      const container = card.parentElement;
      card.remove();
      if (container && !container.querySelector('.ad-card')) {
        container.style.display = 'none';
      }
    }, 300);
  }
};

window.handleAdClick = function(event, id, actionType, actionValue) {
  event.preventDefault();
  // Track click
  api('/api/ads/' + id + '/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'click' })
  }).catch(() => {});

  if (!actionValue) return;

  if (actionType === 'whatsapp') {
    const num = (actionValue || SETTINGS.whatsapp_number || '').replace(/\D/g, '');
    const msg = 'مرحباً، شاهدت إعلانكم على منصة مُساعد وأريد الاستفسار.';
    window.open('https://wa.me/' + num + '?text=' + encodeURIComponent(msg), '_blank');
  } else if (actionType === 'page') {
    window.location.href = actionValue;
  } else {
    // link
    const url = actionValue.startsWith('http') ? actionValue : 'https://' + actionValue;
    window.open(url, '_blank');
  }
};

/* ============ TRIP PLANNER ============ */
let tripDays = [];
let tripDayCounter = 0;

window.addTripDay = function() {
  tripDayCounter++;
  tripDays.push({
    id: 'd' + tripDayCounter,
    date: '',
    activities: []
  });
  renderTripDays();
};

window.removeTripDay = function(dayId) {
  if (!confirm('حذف هذا اليوم؟')) return;
  tripDays = tripDays.filter(d => d.id !== dayId);
  renderTripDays();
};

window.moveTripDay = function(dayId, direction) {
  const idx = tripDays.findIndex(d => d.id === dayId);
  if (idx < 0) return;
  const newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= tripDays.length) return;
  const tmp = tripDays[idx];
  tripDays[idx] = tripDays[newIdx];
  tripDays[newIdx] = tmp;
  renderTripDays();
};

window.updateTripDayDate = function(dayId, value) {
  const d = tripDays.find(x => x.id === dayId);
  if (d) d.date = value;
};

window.addTripActivity = function(dayId) {
  const d = tripDays.find(x => x.id === dayId);
  if (!d) return;
  d.activities.push({
    id: 'a' + Date.now() + Math.random().toString(36).slice(2, 6),
    time_slot: 'صباحاً',
    title: '',
    description: '',
    location: ''
  });
  renderTripDays();
};

window.removeTripActivity = function(dayId, actId) {
  const d = tripDays.find(x => x.id === dayId);
  if (!d) return;
  d.activities = d.activities.filter(a => a.id !== actId);
  renderTripDays();
};

window.updateTripActivity = function(dayId, actId, field, value) {
  const d = tripDays.find(x => x.id === dayId);
  if (!d) return;
  const a = d.activities.find(x => x.id === actId);
  if (!a) return;
  a[field] = value;
};

window.clearTrip = function() {
  if (!confirm('مسح كل الأيام والأنشطة؟')) return;
  tripDays = [];
  tripDayCounter = 0;
  renderTripDays();
  document.getElementById('tripFooter').style.display = 'none';
};

window.loadTripTemplate = async function() {
  if (tripDays.length && !confirm('سيتم استبدال الجدول الحالي. متابعة؟')) return;
  try {
    const r = await fetch('/api/trip-templates');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const templates = await r.json();
    if (!templates.length) {
      toast('لا توجد قوالب متاحة حالياً', 'err');
      return;
    }
    openTemplatePicker(templates);
  } catch (e) {
    console.error('فشل تحميل القوالب:', e);
    toast('فشل تحميل القوالب: ' + e.message, 'err');
  }
};

window.openTemplatePicker = function(templates) {
  const html = '<h2>اختر قالباً</h2>' +
    '<div style="display:grid;gap:12px;max-height:60vh;overflow-y:auto;">' +
    templates.map((t, i) => {
      const days = new Set((t.activities || []).map(a => +a.day_number || 1)).size;
      const acts = (t.activities || []).length;
      return '<div data-tpl-idx="' + i + '" style="background:#f8fafc;padding:16px;border-radius:12px;border:2px solid var(--border);cursor:pointer;transition:.2s;" onmouseover="this.style.borderColor=\'var(--gold)\';this.style.background=\'#fff9e6\'" onmouseout="this.style.borderColor=\'var(--border)\';this.style.background=\'#f8fafc\'">' +
        '<h4 style="color:var(--navy);margin-bottom:6px;"> ' + t.name + '</h4>' +
        (t.description ? '<p style="font-size:.9rem;color:var(--gray);margin-bottom:10px;">' + t.description + '</p>' : '') +
        '<div style="display:flex;gap:14px;font-size:.85rem;color:var(--gray);">' +
          '<span> ' + days + ' أيام</span>' +
          '<span>✓ ' + acts + ' أنشطة</span>' +
          (t.city ? '<span> ' + t.city + '</span>' : '') +
        '</div>' +
      '</div>';
    }).join('') +
    '</div>' +
    '<div class="modal-actions">' +
      '<button class="icon-btn" onclick="document.getElementById(\'modalBg\').classList.remove(\'show\')">إلغاء</button>' +
    '</div>';

  $('#modalContent').innerHTML = html;
  $('#modalBg').classList.add('show');

  document.querySelectorAll('[data-tpl-idx]').forEach(el => {
    el.onclick = () => {
      const idx = +el.dataset.tplIdx;
      applyTemplate(templates[idx]);
      document.getElementById('modalBg').classList.remove('show');
    };
  });
};

window.applyTemplate = function(template) {
  if (!template.activities || !template.activities.length) {
    toast('القالب فارغ', 'err');
    return;
  }
  // Group by day
  const byDay = {};
  template.activities.forEach(a => {
    const dn = +a.day_number || 1;
    if (!byDay[dn]) byDay[dn] = [];
    byDay[dn].push(a);
  });

  tripDays = [];
  Object.keys(byDay).sort((a,b) => +a - +b).forEach(dn => {
    tripDays.push({
      id: 'd' + Math.random().toString(36).slice(2, 9),
      date: '',
      activities: byDay[dn].map(a => ({
        id: 'a' + Math.random().toString(36).slice(2, 9),
        time_slot: a.time_slot || 'صباحاً',
        title: a.title || '',
        description: a.description || '',
        location: a.location || ''
      }))
    });
  });
  tripDayCounter = tripDays.length;

  renderTripDays();
  toast('تم تحميل القالب: ' + template.name, 'ok');
};

function renderTripDays() {
  const container = document.getElementById('tripDaysContainer');
  const footer = document.getElementById('tripFooter');
  if (!container) return;

  if (!tripDays.length) {
    container.innerHTML = '<div class="trip-empty">لم تضف أي يوم بعد. اضغط "إضافة يوم جديد" للبدء.</div>';
    if (footer) footer.style.display = 'none';
    return;
  }
  if (footer) footer.style.display = 'block';

  const timeSlots = ['صباحاً', 'ظهراً', 'مساءً', 'ليلاً'];

  container.innerHTML = tripDays.map((day, idx) => {
    const actsHtml = day.activities.length
      ? day.activities.map(a => `
        <div class="trip-activity">
          <div class="trip-activity-fields">
            <div class="trip-activity-row">
              <select onchange="updateTripActivity('${day.id}','${a.id}','time_slot',this.value)">
                ${timeSlots.map(t => `<option value="${t}" ${a.time_slot === t ? 'selected' : ''}>${t}</option>`).join('')}
              </select>
              <input type="text" placeholder="عنوان النشاط (مثال: جولة الكرملين)" value="${(a.title || '').replace(/"/g, '&quot;')}" onchange="updateTripActivity('${day.id}','${a.id}','title',this.value)">
              <input type="text" placeholder="الموقع (اختياري)" value="${(a.location || '').replace(/"/g, '&quot;')}" onchange="updateTripActivity('${day.id}','${a.id}','location',this.value)">
            </div>
            <textarea rows="2" placeholder="تفاصيل إضافية (اختياري)" onchange="updateTripActivity('${day.id}','${a.id}','description',this.value)">${a.description || ''}</textarea>
          </div>
          <button class="trip-activity-delete" onclick="removeTripActivity('${day.id}','${a.id}')" title="حذف النشاط">✕</button>
        </div>
      `).join('')
      : '<p style="text-align:center;color:var(--gray);font-size:.85rem;padding:10px;">لا توجد أنشطة بعد</p>';

    return `
      <div class="trip-day">
        <div class="trip-day-header">
          <div class="trip-day-title">
            <div class="trip-day-number">${idx + 1}</div>
            <div class="trip-day-info">
              <h4>اليوم ${idx + 1}</h4>
              <input type="date" class="day-date-input" value="${day.date}" onchange="updateTripDayDate('${day.id}', this.value)">
            </div>
          </div>
          <div class="trip-day-actions">
            <button class="trip-day-btn up" onclick="moveTripDay('${day.id}', -1)" title="أعلى">↑</button>
            <button class="trip-day-btn down" onclick="moveTripDay('${day.id}', 1)" title="أسفل">↓</button>
            <button class="trip-day-btn del" onclick="removeTripDay('${day.id}')" title="حذف اليوم">✕</button>
          </div>
        </div>
        <div class="trip-activities">${actsHtml}</div>
        <button class="trip-add-activity" onclick="addTripActivity('${day.id}')">+ إضافة نشاط لهذا اليوم</button>
      </div>
    `;
  }).join('');
}

window.submitTripPlan = async function() {
  const name = document.getElementById('tripName').value.trim();


  const persons = +document.getElementById('tripPersons').value || 1;
  const startDate = document.getElementById('tripStartDate').value;
  const endDate = document.getElementById('tripEndDate').value;
  const notes = document.getElementById('tripNotes').value.trim();

  if (!name) { toast('الاسم مطلوب', 'err'); return; }

  if (!tripDays.length) { toast('أضف يوماً واحداً على الأقل', 'err'); return; }

  // Collect all activities
  const activities = [];
  tripDays.forEach((day, idx) => {
    day.activities.forEach(a => {
      if (!a.title && !a.description) return;
      activities.push({
        day_number: idx + 1,
        day_date: day.date || null,
        time_slot: a.time_slot || '',
        title: a.title || '',
        description: a.description || '',
        location: a.location || ''
      });
    });
  });

  if (!activities.length) { toast('أضف نشاطاً واحداً على الأقل', 'err'); return; }

  const payload = {
    client_name: name,
    client_whatsapp: "",

    persons,
    start_date: startDate || null,
    end_date: endDate || null,
    notes,
    activities
  };

  try {
    const r = await api('/api/trip-plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    toast('تم حفظ جدولك بنجاح — رقم: ' + r.code, 'ok');

    // Build WhatsApp message
    const lines = [];
    lines.push('السلام عليكم، هذا جدول رحلتي عبر مُساعد.');
    lines.push('');
    lines.push('رقم الجدول: ' + r.code);
    lines.push('الاسم: ' + name);

    lines.push('عدد الأشخاص: ' + persons);
    if (startDate || endDate) lines.push('الفترة: ' + (startDate || '—') + ' الى ' + (endDate || '—'));
    lines.push('');
    lines.push('=== الجدول ===');
    lines.push('');

    tripDays.forEach((day, idx) => {
      lines.push('اليوم ' + (idx + 1) + (day.date ? ' (' + day.date + ')' : '') + ':');
      day.activities.forEach(a => {
        if (!a.title && !a.description) return;
        let line = '- ' + (a.time_slot ? '[' + a.time_slot + '] ' : '');
        line += a.title || a.description;
        if (a.location) line += ' — ' + a.location;
        lines.push(line);
      });
      lines.push('');
    });

    if (notes) {
      lines.push('ملاحظات: ' + notes);
      lines.push('');
    }
    lines.push('أرجو تأكيد التوفر والترتيب.');

    const message = lines.join('\n');

    setTimeout(() => {
      window.open('https://wa.me/' + SETTINGS.whatsapp_number + '?text=' + encodeURIComponent(message), '_blank');
    }, 700);
  } catch (e) {
    toast(e.error || 'حدث خطأ', 'err');
  }
};

/* ============ MEDICAL ============ */
async function loadMedical() {
  try {
    const r = await fetch('/api/medical');
    const list = await r.json();

    const renderCard = (c) => {
      const typeLabel = c.type === 'hospital' ? 'مستشفى' : c.type === 'clinic' ? 'عيادة' : c.type === 'dentist' ? 'عيادة أسنان' : c.type === 'cosmetic' ? 'عيادة تجميل' : c.type;
      return '<div class="card">' +
        '<div class="card-img"><img src="' + (c.image || 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800') + '" alt="' + c.name + '" loading="lazy"></div>' +
        '<div class="card-body">' +
          '<h3>' + c.name + '</h3>' +
          '<p style="color:var(--gold);font-weight:700;">' + typeLabel + ' - ' + (c.specialization || 'عام') + '</p>' +
          '<p style="color:var(--gray);font-size:.85rem;"> ' + c.city + '</p>' +
          (c.description ? '<p>' + c.description + '</p>' : '<p style="min-height:20px;"></p>') +
          '<div class="card-foot">' +
            '<button class="btn btn-navy" onclick="requestMedical(' + c.id + ')">احجز الآن</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    };

    const emptyMsg = '<p style="text-align:center;color:var(--gray);grid-column:1/-1;padding:40px;">لا توجد مستشفيات أو عيادات متاحة حالياً.</p>';

    const grid = document.getElementById('medicalGrid');
    if (grid) grid.innerHTML = list.length ? list.map(renderCard).join('') : emptyMsg;
  } catch (e) {
    console.warn('Medical load failed', e);
  }
}

window.requestMedical = async function(id) {
  try {
    const r = await fetch('/api/medical');
    const list = await r.json();
    const c = list.find(x => x.id === id);
    if (!c) return;

    const typeLabel = c.type === 'hospital' ? 'مستشفى' : c.type === 'clinic' ? 'عيادة' : c.type === 'dentist' ? 'عيادة أسنان' : c.type === 'cosmetic' ? 'تجميل' : c.type;

    let msg = 'السلام عليكم، أرغب بحجز موعد في:';
    msg += '\n\n';
    msg += 'المنشأة: ' + c.name + '\n';
    msg += 'النوع: ' + typeLabel + '\n';
    msg += 'المدينة: ' + c.city;
    if (c.specialization) msg += '\nالتخصص: ' + c.specialization;
    msg += '\n\nأرجو التواصل لتحديد موعد.';

    // Save lead
    try {
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'عميل من الموقع',
          phone: '-', whatsapp: '-', country: '-',
          persons: 1, city: c.city,
          services: [{ type: 'medical', id: c.id, name: c.name }],
          estimated_rub: 0,
          notes: 'حجز: ' + c.name
        })
      });
    } catch (e) { /* ignore */ }

    toast('جارٍ فتح WhatsApp...', 'ok');
    setTimeout(() => {
      window.open('https://wa.me/' + SETTINGS.whatsapp_number + '?text=' + encodeURIComponent(msg), '_blank');
    }, 500);
  } catch (e) {
    toast('خطأ', 'err');
  }
};

/* ============ SCHOLARSHIPS ============ */
async function loadScholarships() {
  try {
    const r = await fetch('/api/scholarships');
    const list = await r.json();

    const renderCard = (s) => {
      return '<div class="card">' +
        '<div class="card-img"><img src="' + (s.image || 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800') + '" alt="' + s.name + '" loading="lazy"></div>' +
        '<div class="card-body">' +
          '<h3>' + s.name + '</h3>' +
          (s.deadline ? '<p style="color:var(--gold);font-weight:700;">اخر موعد للتقديم: ' + s.deadline + '</p>' : '') +
          (s.description ? '<p>' + s.description + '</p>' : '<p style="min-height:20px;"></p>') +
          '<div class="card-foot" style="display:flex;gap:8px;flex-wrap:wrap;">' +
            (s.website ? '<a href="' + s.website + '" target="_blank" class="btn btn-navy" style="flex:1;min-width:120px;">زيارة الموقع</a>' : '') +
            '<button class="btn btn-gold" style="flex:1;min-width:120px;" onclick="requestScholarship(' + s.id + ')">استفسر عبر واتساب</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    };

    const emptyMsg = '<p style="text-align:center;color:var(--gray);grid-column:1/-1;padding:40px;">لا توجد منح متاحة حالياً.</p>';
    const grid = document.getElementById('scholarshipsGrid');
    if (grid) grid.innerHTML = list.length ? list.map(renderCard).join('') : emptyMsg;
  } catch (e) {
    console.warn('Scholarships load failed', e);
  }
}

window.requestScholarship = async function(id) {
  try {
    const r = await fetch('/api/scholarships');
    const list = await r.json();
    const s = list.find(x => x.id === id);
    if (!s) return;

    let msg = 'السلام عليكم، أرغب بالاستفسار عن منحة:';
    msg += '\n\n';
    msg += 'المنحة: ' + s.name;
    if (s.deadline) msg += '\nاخر موعد للتقديم: ' + s.deadline;
    if (s.website) msg += '\nرابط المنحة: ' + s.website;
    msg += '\n\nأرجو معلومات عن التقديم والمواعيد.';

    try {
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'عميل من الموقع',
          phone: '-', whatsapp: '-', country: '-',
          persons: 1, city: '',
          services: [{ type: 'scholarship', id: s.id, name: s.name }],
          estimated_rub: 0,
          notes: 'استفسار عن منحة: ' + s.name
        })
      });
    } catch (e) {}

    toast('جارٍ فتح WhatsApp...', 'ok');
    setTimeout(() => {
      window.open('https://wa.me/' + SETTINGS.whatsapp_number + '?text=' + encodeURIComponent(msg), '_blank');
    }, 500);
  } catch (e) {
    toast('خطأ', 'err');
  }
};

window.requestUniversity = async function(id) {
  try {
    const r = await fetch('/api/universities');
    const list = await r.json();
    const u = list.find(x => x.id === id);
    if (!u) return;

    let msg = 'السلام عليكم، أرغب بالاستفسار عن الدراسة في:';
    msg += '\n\n';
    msg += 'الجامعة: ' + (u.name_ar || u.name_en || u.name_ru);
    if (u.city) msg += '\nالمدينة: ' + u.city;
    if (u.tuition_rub) msg += '\nالرسوم: ' + u.tuition_rub.toLocaleString('ar-EG') + ' RUB';
    if (u.website) msg += '\nالموقع: ' + u.website;
    msg += '\n\nأرجو معلومات عن التقديم.';

    try {
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'عميل من الموقع',
          phone: '-', whatsapp: '-', country: '-',
          persons: 1, city: u.city || '',
          services: [{ type: 'university', id: u.id, name: u.name_ar }],
          estimated_rub: u.tuition_rub || 0,
          notes: 'استفسار عن جامعة: ' + u.name_ar
        })
      });
    } catch (e) {}

    toast('جارٍ فتح WhatsApp...', 'ok');
    setTimeout(() => {
      window.open('https://wa.me/' + SETTINGS.whatsapp_number + '?text=' + encodeURIComponent(msg), '_blank');
    }, 500);
  } catch (e) {
    toast('خطأ', 'err');
  }
};

/* ============ TOURS & TRANSFERS ============ */
let TOUR_PACKAGES = [];

async function loadTourPackages() {
  try {
    const r = await fetch('/api/tours');
    TOUR_PACKAGES = await r.json();
  } catch (e) {
    console.warn('Tours load failed', e);
    TOUR_PACKAGES = [];
  }
}

function renderTourPackages() {
  const container = document.getElementById('pTourPackages');
  if (!container) return;

  if (!TOUR_PACKAGES.length) {
    container.innerHTML = '<p style="text-align:center;color:var(--gray);grid-column:1/-1;padding:20px;">لا توجد جولات متاحة حالياً.</p>';
    return;
  }

  const unitLabel = u => ({ order: 'للطلب', day: 'لليوم', tour: 'للجولة' }[u] || 'للطلب');

  container.innerHTML = TOUR_PACKAGES.map(t => {
    const isCountable = t.price_unit === 'day' || t.price_unit === 'tour';
    return `
      <div class="tour-card" data-id="${t.id}" data-price="${t.price_rub}" data-unit="${t.price_unit}">
        <div class="tour-card-head">
          <div class="tour-card-name">${t.name}</div>
          <div class="tour-card-price">${fmt(t.price_rub)} / ${unitLabel(t.price_unit)}</div>
        </div>
        ${t.description ? `<div class="tour-card-desc">${t.description}</div>` : ''}
        ${t.note ? `<div class="tour-card-note">${t.note}</div>` : ''}
        ${isCountable ? `
          <div class="tour-count-row">
            <label>${t.price_unit === 'day' ? 'عدد الأيام' : 'عدد الجولات'}:</label>
            <input type="number" class="tour-count" min="1" value="1">
          </div>
          <div class="tour-total"></div>
        ` : ''}
      </div>`;
  }).join('');

  // Wire events
  container.querySelectorAll('.tour-card').forEach(card => {
    card.onclick = (e) => {
      // Ignore clicks on input
      if (e.target.tagName === 'INPUT') return;
      const isActive = card.classList.toggle('active');
      const countRow = card.querySelector('.tour-count-row');
      const totalEl = card.querySelector('.tour-total');
      if (countRow && totalEl) {
        if (isActive) {
          countRow.classList.add('show');
          totalEl.classList.add('show');
          updateTourTotal(card);
        } else {
          countRow.classList.remove('show');
          totalEl.classList.remove('show');
        }
      }
      calculate();
    };
  });

  container.querySelectorAll('.tour-count').forEach(inp => {
    inp.onclick = (e) => e.stopPropagation();
    inp.oninput = () => {
      updateTourTotal(inp.closest('.tour-card'));
      calculate();
    };
    inp.onchange = () => {
      updateTourTotal(inp.closest('.tour-card'));
      calculate();
    };
  });
}

function updateTourTotal(card) {
  const price = +card.dataset.price || 0;
  const unit = card.dataset.unit;
  const countInput = card.querySelector('.tour-count');
  const totalEl = card.querySelector('.tour-total');
  if (!totalEl) return;
  let count = 1;
  if (unit === 'day' || unit === 'tour') {
    count = countInput ? (+countInput.value || 1) : 1;
  }
  const total = price * count;
  totalEl.textContent = 'المجموع: ' + fmt(total);
}

/* ============ EXTRA SERVICES ============ */
async function loadExtraServices() {
  try {
    const r = await fetch('/api/extra-services');
    EXTRA_SERVICES = await r.json();
  } catch (e) {
    console.warn('Extra services load failed', e);
    EXTRA_SERVICES = [];
  }
}

function renderExtraServices() {
  const container = document.getElementById('pExtraServices');
  if (!container) return;

  if (!EXTRA_SERVICES.length) {
    container.innerHTML = '<p style="text-align:center;color:var(--gray);grid-column:1/-1;padding:20px;">لا توجد خدمات إضافية متاحة حالياً.</p>';
    return;
  }

  const unitLabel = u => ({ person: 'للفرد', car: 'للسيارة', day: 'لليوم', order: 'للطلب', from: 'يبدأ من' }[u] || 'للطلب');

  container.innerHTML = EXTRA_SERVICES.map(s => {
    const hasQty = +s.allow_quantity === 1;
    const isFree = !s.price_rub || s.price_rub === 0;
    return `
      <div class="extra-card" data-id="${s.id}" data-price="${s.price_rub}" data-qty="${hasQty ? 1 : 0}">
        <div class="extra-card-head">
          <div class="extra-card-name">${s.name}</div>
          <div class="extra-card-price ${isFree ? 'free' : ''}">${isFree ? 'مجاناً' : fmt(s.price_rub) + ' / ' + unitLabel(s.price_unit)}</div>
        </div>
        ${s.description ? `<div class="extra-card-desc">${s.description}</div>` : ''}
        ${s.note ? `<div class="extra-card-note">${s.note}</div>` : ''}
        ${hasQty ? `
          <div class="extra-count-row">
            <label>العدد:</label>
            <input type="number" class="extra-count" min="1" value="1">
          </div>
          <div class="extra-total"></div>
        ` : ''}
      </div>`;
  }).join('');

  // Wire events
  container.querySelectorAll('.extra-card').forEach(card => {
    card.onclick = (e) => {
      if (e.target.tagName === 'INPUT') return;
      const isActive = card.classList.toggle('active');
      const countRow = card.querySelector('.extra-count-row');
      const totalEl = card.querySelector('.extra-total');
      if (countRow && totalEl) {
        if (isActive) {
          countRow.classList.add('show');
          totalEl.classList.add('show');
          updateExtraTotal(card);
        } else {
          countRow.classList.remove('show');
          totalEl.classList.remove('show');
        }
      }
      calculate();
    };
  });

  container.querySelectorAll('.extra-count').forEach(inp => {
    inp.onclick = (e) => e.stopPropagation();
    inp.oninput = () => {
      updateExtraTotal(inp.closest('.extra-card'));
      calculate();
    };
    inp.onchange = () => {
      updateExtraTotal(inp.closest('.extra-card'));
      calculate();
    };
  });
}

function updateExtraTotal(card) {
  const price = +card.dataset.price || 0;
  const countInput = card.querySelector('.extra-count');
  const totalEl = card.querySelector('.extra-total');
  if (!totalEl) return;
  const count = countInput ? (+countInput.value || 1) : 1;
  totalEl.textContent = 'المجموع: ' + fmt(price * count);
}

(async () => {
  try {
    await loadSettings();
    // جلب الفنادق مع أسعارها الموسمية
    const hotelsRaw = await api('/api/hotels');
    const hotelsWithPrices = await Promise.all(hotelsRaw.map(async h => {
      try {
        const detail = await api('/api/hotels/' + h.id);
        return { ...h, prices: detail.prices || [] };
      } catch { return { ...h, prices: [] }; }
    }));
    // ✅ ترتيب الفنادق حسب sort_order
    HOTELS = hotelsWithPrices.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    
    // ✅ ترتيب المدن حسب عدد الفنادق (الأكثر → الأقل)
    const cityCount = {};
    HOTELS.forEach(h => {
      if (h.city) {
        cityCount[h.city] = (cityCount[h.city] || 0) + 1;
      }
    });
    
    CITY_LIST = Object.keys(cityCount).sort((a, b) => {
      // ترتيب حسب العدد (تنازلي)
      const diff = cityCount[b] - cityCount[a];
      if (diff !== 0) return diff;
      // عند التعادل: ترتيب أبجدي
      return a.localeCompare(b, 'ar');
    });
    
    console.log('📊 ترتيب المدن:', CITY_LIST.map(c => `${c} (${cityCount[c]})`));
    $('#hotelsGrid').innerHTML = HOTELS.map(h => `
      <div class="card">
        <div class="card-img"><img src="${h.image || ''}" alt="${h.name}">
        ${h.breakfast ? '<span class="badge">إفطار مجاني</span>' : ''}</div>
        <div class="card-body">
          <h3>${h.name}</h3>
          <p style="color:var(--gold);font-weight:700">${'*'.repeat(h.stars || 0)} ${h.city} - ${h.room_type || ''}</p>
          <p>${h.description || ''}</p>
          <div class="card-foot">
            <button class="btn btn-navy" style="width:100%;" onclick="requestHotel(${h.id})">احسب السعر واحجز</button>
          </div>
        </div>
      </div>`).join('');

    await Promise.all([loadServices(), loadDestinations(), loadEvents(), loadRestaurants(), loadUniversities(), loadAds(), loadMedical(), loadScholarships(), loadTourPackages(), loadExtraServices()]);
    fillPlanner();
  } catch (e) { console.error(e); toast('تعذر تحميل بعض البيانات', 'err'); }
})();
