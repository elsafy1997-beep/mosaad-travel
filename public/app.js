const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const fmt = n => Number(n || 0).toLocaleString('ar-EG') + ' ₽';
let SETTINGS = {}, HOTELS = [], SERVICES = [], EVENTS = [], CITY_LIST = [];

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
  $('#cWhats').textContent = '+' + SETTINGS.whatsapp_number;
  $('#cEmail').textContent = SETTINGS.contact_email;
  $('#cPhone').textContent = SETTINGS.contact_phone;
  $('#footText').textContent = SETTINGS.footer_text;
  $('#footPhone').textContent = 'Phone: ' + SETTINGS.contact_phone;
  $('#footEmail').textContent = 'Email: ' + SETTINGS.contact_email;
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
  SERVICES = await api('/api/services');
  const icons = ['[1]','[2]','[3]','[4]','[5]','[6]','[7]','[8]'];
  $('#servicesGrid').innerHTML = SERVICES.map((s, i) => `
    <div class="svc">
      ${s.image
        ? `<div class="svc-img"><img src="${s.image}" alt="${s.name}" loading="lazy"></div>`
        : `<div class="ico">${icons[i % icons.length]}</div>`
      }
      <h3>${s.name}</h3>
      <p>${s.description || ''}</p>
      ${s.price_rub ? `<div style="margin-top:12px;font-weight:800;color:var(--gold)">${fmt(s.price_rub)} <small style="color:var(--gray);font-weight:400">${unitLabel(s.price_unit)}</small></div>` : ''}
      <button class="btn btn-gold" style="margin-top:14px;width:100%;" onclick="requestService(${s.id})">احجز هذه الخدمة</button>
    </div>`).join('');
}
async function loadDestinations() {
  const list = await api('/api/destinations');
  $('#destGrid').innerHTML = list.map(d => `
    <div class="card"><div class="card-img"><img src="${d.image || ''}" alt="${d.name_ar}"></div>
    <div class="card-body"><h3>${d.name_ar}</h3><p>${d.description || ''}</p></div></div>`).join('');
}
async function loadHotels() {
  HOTELS = await api('/api/hotels');
  CITY_LIST = [...new Set(HOTELS.map(h => h.city))];
  $('#hotelsGrid').innerHTML = HOTELS.map(h => `
    <div class="card">
      <div class="card-img"><img src="${h.image || ''}" alt="${h.name}">
      ${h.breakfast ? '<span class="badge">إفطار مجاني</span>' : ''}</div>
      <div class="card-body">
        <h3>${h.name}</h3>
        <p style="color:var(--gold);font-weight:700">${'*'.repeat(h.stars || 0)} ${h.city} - ${h.room_type || ''}</p>
        <p>${h.description || ''}</p>
        <div class="card-foot">
          <div class="price">${fmt(h.price_rub)} <small>/ ليلة</small></div>
          <button class="btn btn-navy" onclick="requestHotel(${h.id})">اطلب الحجز</button>
        </div>
      </div>
    </div>`).join('');
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
    const list = await api('/api/services');
    const s = list.find(x => x.id === id);
    if (!s) return;

    let msg = 'السلام عليكم، أريد حجز خدمة عبر مُساعد:';
    msg += '\n\n';
    msg += 'الخدمة: ' + s.name;
    if (s.city)         msg += '\nالمدينة: ' + s.city;
    if (s.description)  msg += '\nالتفاصيل: ' + s.description;
    if (s.price_rub)    msg += '\nالسعر: ' + s.price_rub.toLocaleString('ar-EG') + ' RUB';

    await api('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'عميل من الموقع',
        phone: '-', whatsapp: '-', country: '-',
        persons: 1, city: s.city || '',
        services: [{ type: 'service', id: s.id, name: s.name }],
        estimated_rub: s.price_rub || 0,
        notes: 'حجز خدمة: ' + s.name
      })
    });

    toast('جارٍ فتح WhatsApp...', 'ok');
    setTimeout(() => {
      window.open('https://wa.me/' + SETTINGS.whatsapp_number + '?text=' + encodeURIComponent(msg), '_blank');
    }, 500);
  } catch (e) {
    toast('خطأ', 'err');
  }
};

window.requestRestaurant = async (id) => {
  try {
    const list = await api('/api/restaurants');
    const r = list.find(x => x.id === id);
    if (!r) return;

    let msg = 'السلام عليكم، أريد حجز مطعم عبر مُساعد:\n\n';
    msg += 'المطعم: ' + r.name + '\n';
    msg += 'المدينة: ' + r.city;
    if (r.cuisine) msg += '\nالنوع: ' + r.cuisine;
    if (r.note)    msg += '\nملاحظات: ' + r.note;

    await api('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'عميل من الموقع',
        phone: '-', whatsapp: '-', country: '-',
        persons: 1, city: r.city,
        services: [{ type: 'restaurant', id: r.id, name: r.name }],
        estimated_rub: 0,
        notes: 'حجز مطعم: ' + r.name
      })
    });

    toast('جارٍ فتح WhatsApp...', 'ok');
    setTimeout(() => {
      window.open('https://wa.me/' + SETTINGS.whatsapp_number + '?text=' + encodeURIComponent(msg), '_blank');
    }, 500);
  } catch (e) {
    toast('خطأ', 'err');
  }
};

async function loadUniversities() {
  const list = await api('/api/universities');
  $('#uniGrid').innerHTML = list.length ? list.map(u => `
    <div class="card">
      <div class="card-img"><img src="${u.image || 'https://images.unsplash.com/photo-1562774053-701939374585?w=800'}" alt="${u.name_ar}"></div>
      <div class="card-body">
        <h3>${u.name_ar}</h3>
        <p style="color:var(--gold);font-weight:700">${u.city}</p>
        <p>${u.description || ''}</p>
        <p style="font-size:.85rem;color:var(--gray)"><strong>التخصصات:</strong> ${u.specializations || '-'}</p>
        <div class="card-foot">
          <div class="price">${fmt(u.tuition_rub)} <small>/ سنة</small></div>
          <a href="${waLink('أرغب بالاستفسار عن الدراسة في: ' + u.name_ar)}" target="_blank" class="btn btn-navy">استفسر</a>
        </div>
      </div>
    </div>`).join('') : '<p style="text-align:center;color:var(--gray)">لا توجد جامعات متاحة حالياً.</p>';
}

/* ============ حساب سعر الفندق يوم بيوم ============ */
function calcSegment(seg) {
  const hotel = HOTELS.find(h => h.id == seg.hotelId);
  if (!hotel) return { nights: 0, total: 0, hotel: null, rooms: 1, breakdown: [] };
  const rooms = +seg.rooms || 1;
  if (!seg.arrival || !seg.departure) return { nights: 0, total: 0, hotel, rooms, breakdown: [] };

  const start = new Date(seg.arrival);
  const end = new Date(seg.departure);
  const nights = Math.max(0, Math.round((end - start) / 86400000));
  if (nights === 0) return { nights: 0, total: 0, hotel, rooms, breakdown: [] };

  // البحث عن الأسعار الموسمية للفندق
  const seasonal = (hotel.prices || []).slice().sort((a,b) => a.date_from.localeCompare(b.date_from));

  const breakdown = [];
  let total = 0;
  for (let i = 0; i < nights; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const dStr = d.toISOString().split('T')[0];
    const match = seasonal.find(p => dStr >= p.date_from && dStr <= p.date_to);
    const price = match ? +match.price_rub : +hotel.price_rub;
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
  const totalWithRooms = total * rooms;
  return { nights, total: totalWithRooms, hotel, rooms, breakdown, perNightTotal: total };
}

/* ============ HOTEL SEGMENTS ============ */
let hotelSegments = [];
let hotelCounter = 0;

function addHotelSegment() {
  hotelCounter++;
  const id = 'hs-' + hotelCounter;
  const seg = { id, city: '', hotelId: '', arrival: '', departure: '', rooms: 1 };
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
    const filteredHotels = seg.city ? HOTELS.filter(h => h.city === seg.city) : HOTELS;
    const hotelOptions = filteredHotels.map(h => `<option value="${h.id}" data-price="${h.price_rub}" ${seg.hotelId == h.id ? 'selected' : ''}>${h.name} - ${fmt(h.price_rub)} / ليلة</option>`).join('');
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
        <div class="field full">
          <label>الفندق</label>
          <select class="seg-hotel" data-seg-id="${seg.id}">
            <option value="">اختر الفندق</option>
            ${hotelOptions}
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
        <div class="field">
          <label>عدد الغرف</label>
          <input type="number" class="seg-rooms" data-seg-id="${seg.id}" min="1" value="${seg.rooms}">
        </div>
        <div class="field">
          <label>الليالي</label>
          <input type="text" class="seg-nights" data-seg-id="${seg.id}" value="-" disabled>
        </div>
      </div>
      <div class="hotel-segment-total">
        <span>مجموع هذا الفندق</span>
        <span class="seg-total" data-seg-id="${seg.id}">0 ₽</span>
      </div>
    </div>`;
  }).join('');

  $$('.seg-city').forEach(el => el.onchange = () => updateSegment(el.dataset.segId, 'city', el.value));
  $$('.seg-hotel').forEach(el => el.onchange = () => updateSegment(el.dataset.segId, 'hotelId', el.value));
  $$('.seg-arrival').forEach(el => el.onchange = () => updateSegment(el.dataset.segId, 'arrival', el.value));
  $$('.seg-departure').forEach(el => el.onchange = () => updateSegment(el.dataset.segId, 'departure', el.value));
  $$('.seg-rooms').forEach(el => el.oninput = () => updateSegment(el.dataset.segId, 'rooms', el.value));
}
function updateSegment(id, key, value) {
  const seg = hotelSegments.find(s => s.id === id);
  if (!seg) return;
  if (key === 'city') {
    seg.city = value;
    seg.hotelId = '';
    renderHotelSegments();
  } else {
    seg[key] = key === 'rooms' ? (+value || 1) : value;
  }
  calculate();
}
function refreshSegmentsUI() {
  hotelSegments.forEach(seg => {
    const { nights, total } = calcSegment(seg);
    const nightsEl = document.querySelector('.seg-nights[data-seg-id="' + seg.id + '"]');
    const totalEl = document.querySelector('.seg-total[data-seg-id="' + seg.id + '"]');
    if (nightsEl) nightsEl.value = nights;
    if (totalEl) totalEl.textContent = fmt(total);
  });
}

/* ============ PLANNER ============ */
function fillPlanner() {
  const svcUnit = u => ({ person: 'للفرد', car: 'للسيارة', day: 'لليوم', order: 'للطلب', from: 'يبدأ من' }[u] || '');
  $('#pServices').innerHTML = SERVICES.map(s => `
    <label class="check" data-id="${s.id}" data-price="${s.price_rub}" data-type="service">
      <input type="checkbox" value="${s.id}">
      <span>${s.name} <small style="color:var(--gold)">(${fmt(s.price_rub)} ${svcUnit(s.price_unit)})</small></span>
    </label>`).join('');

  const moscowEvents = EVENTS.filter(e => (e.city || '').trim() === 'موسكو');
  const sochiEvents  = EVENTS.filter(e => (e.city || '').trim() === 'سوتشي');
  const otherEvents  = EVENTS.filter(e => !['موسكو', 'سوتشي'].includes((e.city || '').trim()));

  const renderEvent = (e) => `
    <label class="event-check" data-id="${e.id}" data-price="${e.price_rub}" data-type="event">
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
  $$('.check input').forEach(cb => cb.onchange = () => {
    cb.closest('.check').classList.toggle('active', cb.checked);
    calculate();
  });
  ['#pPersons', '#pArrival', '#pDeparture'].forEach(s => {
    const el = $(s); if (el) el.onchange = calculate;
  });
  $('#pCurrency').onchange = calculate;

  const addBtn = document.getElementById('addHotelBtn');
  if (addBtn) addBtn.onclick = addHotelSegment;

  if (!hotelSegments.length) addHotelSegment();
}
function updateHotelOptions() { /* no-op */ }
function calculate() {
  const persons = +$('#pPersons').value || 1;
  let hotelsTotal = 0;
  hotelSegments.forEach(seg => { hotelsTotal += calcSegment(seg).total; });
  refreshSegmentsUI();

  let servicesTotal = 0, eventsTotal = 0;
  $$('.check input:checked').forEach(cb => {
    const label = cb.closest('.check');
    servicesTotal += +label.dataset.price || 0;
  });
  $$('.event-check input[type=checkbox]:checked').forEach(cb => {
    const label = cb.closest('.event-check');
    const price = +label.dataset.price || 0;
    const tickets = +label.querySelector('.ev-tickets').value || 1;
    eventsTotal += price * tickets;
  });
  const total = hotelsTotal + servicesTotal + eventsTotal;
  const currency = $('#pCurrency').value;
  const res = $('#pResult');
  if (!hotelsTotal && !servicesTotal && !eventsTotal) {
    res.classList.remove('show');
    $('#pSubmit').disabled = true;
    return;
  }
  res.classList.add('show');
  res.innerHTML = `
    <div class="row"><span>الفنادق (${hotelSegments.length} فندق)</span><span>${fmtWithCurrency(hotelsTotal, currency)}</span></div>
    <div class="row"><span>الفعاليات</span><span>${fmtWithCurrency(eventsTotal, currency)}</span></div>
    <div class="row"><span>الخدمات الإضافية</span><span>${fmtWithCurrency(servicesTotal, currency)}</span></div>
    <div class="total row"><span>الإجمالي التقديري</span><span>${fmtWithCurrency(total, currency)}</span></div>
    <p style="font-size:.8rem;opacity:.7;margin-top:10px">* السعر تقديري وقابل للتغيير حسب التوفر والموسم.</p>`;
  $('#pSubmit').disabled = false;
  return { persons, hotelsTotal, servicesTotal, eventsTotal, total, currency };
}
$('#pSubmit').onclick = async () => {
  const calc = calculate(); if (!calc) return;
  const persons = +$('#pPersons').value;
  const currency = $('#pCurrency').value;

  const hotelLines = [];
  hotelSegments.forEach((seg, idx) => {
    const result = calcSegment(seg);
    if (!result.hotel) return;
    hotelLines.push('فندق رقم ' + (idx + 1) + ':');
    hotelLines.push('- المدينة: ' + seg.city);
    hotelLines.push('- الفندق: ' + result.hotel.name);
    hotelLines.push('- الوصول: ' + (seg.arrival || 'لم يحدد') + ' الى ' + (seg.departure || 'لم يحدد'));
    hotelLines.push('- الليالي: ' + result.nights + ' | الغرف: ' + result.rooms);
    if (result.breakdown && result.breakdown.length) {
      const distinct = result.breakdown.map(b => `${b.nights} ليلة (${b.from} الى ${b.to}) بسعر ${b.price.toLocaleString('ar-EG')} RUB - ${b.label}`).join(' | ');
      hotelLines.push('- التفصيل: ' + distinct);
    }
    hotelLines.push('- السعر: ' + result.total.toLocaleString('ar-EG') + ' RUB');
    hotelLines.push('');
  });

  const selectedEvents = $$('.event-check input[type=checkbox]:checked').map(cb => {
    const label = cb.closest('.event-check');
    const name = label.querySelector('.ev-name').textContent.trim();
    const tickets = +label.querySelector('.ev-tickets').value || 1;
    const price = +label.dataset.price || 0;
    return { name, tickets, price, total: price * tickets };
  });
  const services = $$('.check input:checked').map(cb => ({
    type: cb.closest('.check').dataset.type,
    id: +cb.value,
    name: cb.closest('.check').querySelector('span').textContent.trim().split('(')[0].trim()
  }));

  const lines = [];
  lines.push('السلام عليكم، أريد تجهيز رحلة إلى روسيا عبر مُساعد.');
  lines.push('');
  lines.push('عدد الأشخاص: ' + persons);
  lines.push('');
  if (hotelLines.length) {
    lines.push('الفنادق المختارة:');
    lines.push('');
    lines.push(...hotelLines);
  }
  if (selectedEvents.length) {
    lines.push('الفعاليات:');
    selectedEvents.forEach(e => lines.push('- ' + e.name + ' (' + e.tickets + ' تذكرة) - ' + e.total.toLocaleString('ar-EG') + ' RUB'));
    lines.push('');
  }
  if (services.length) {
    lines.push('الخدمات الإضافية:');
    services.forEach(s => lines.push('- ' + s.name));
    lines.push('');
  }
  lines.push('الإجمالي التقديري:');
  lines.push('- الفنادق: ' + calc.hotelsTotal.toLocaleString('ar-EG') + ' RUB');
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
    await api('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
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
  const h = HOTELS.find(x => x.id === id); if (!h) return;
  const msg = 'السلام عليكم، أرغب بحجز فندق عبر مُساعد:\n\n' +
    'الفندق: ' + h.name + '\n' +
    'المدينة: ' + h.city + '\n' +
    'السعر: ' + h.price_rub.toLocaleString('ar-EG') + ' RUB / ليلة';
  try {
    await api('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'عميل من الموقع', phone: '-', whatsapp: '-', country: '-', persons: 2, city: h.city, hotel_id: h.id, services: [], estimated_rub: h.price_rub }) });
    toast('جارٍ فتح WhatsApp...', 'ok');
    setTimeout(() => window.open('https://wa.me/' + SETTINGS.whatsapp_number + '?text=' + encodeURIComponent(msg), '_blank'), 500);
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
        '<h4 style="color:var(--navy);margin-bottom:6px;">📋 ' + t.name + '</h4>' +
        (t.description ? '<p style="font-size:.9rem;color:var(--gray);margin-bottom:10px;">' + t.description + '</p>' : '') +
        '<div style="display:flex;gap:14px;font-size:.85rem;color:var(--gray);">' +
          '<span>📅 ' + days + ' أيام</span>' +
          '<span>✓ ' + acts + ' أنشطة</span>' +
          (t.city ? '<span>📍 ' + t.city + '</span>' : '') +
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
          '<p style="color:var(--gray);font-size:.85rem;">📍 ' + c.city + '</p>' +
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
    HOTELS = hotelsWithPrices;
    CITY_LIST = [...new Set(HOTELS.map(h => h.city))];
    $('#hotelsGrid').innerHTML = HOTELS.map(h => `
      <div class="card">
        <div class="card-img"><img src="${h.image || ''}" alt="${h.name}">
        ${h.breakfast ? '<span class="badge">إفطار مجاني</span>' : ''}</div>
        <div class="card-body">
          <h3>${h.name}</h3>
          <p style="color:var(--gold);font-weight:700">${'*'.repeat(h.stars || 0)} ${h.city} - ${h.room_type || ''}</p>
          <p>${h.description || ''}</p>
          <div class="card-foot">
            <div class="price">${fmt(h.price_rub)} <small>/ ليلة</small></div>
            <button class="btn btn-navy" onclick="requestHotel(${h.id})">اطلب الحجز</button>
          </div>
        </div>
      </div>`).join('');

    await Promise.all([loadServices(), loadDestinations(), loadEvents(), loadRestaurants(), loadUniversities(), loadAds(), loadMedical()]);
    fillPlanner();
  } catch (e) { console.error(e); toast('تعذر تحميل بعض البيانات', 'err'); }
})();
