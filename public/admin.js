const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const fmt = n => Number(n || 0).toLocaleString('ar-EG') + ' ₽';
function toast(msg, type = '') {
  const t = $('#toast'); t.textContent = msg;
  t.className = 'toast show ' + type;
  setTimeout(() => t.className = 'toast ' + type, 2600);
}
async function api(path, opts = {}) {
  const r = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!r.ok) { const e = await r.json().catch(() => ({ error: 'خطأ' })); throw new Error(e.error || 'خطأ'); }
  return r.json();
}
$('#loginForm').onsubmit = async e => {
  e.preventDefault();
  const fd = new FormData(e.target);
  try {
    const r = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: fd.get('username'), password: fd.get('password') }) });
    $('#adminName').textContent = r.username;
    showDash();
  } catch (e) { $('#loginErr').textContent = e.message; }
};
$('#logoutBtn').onclick = async e => { e.preventDefault(); await api('/api/auth/logout', { method: 'POST' }); location.reload(); };
function showDash() {
  $('#loginView').classList.add('hidden');
  $('#dashView').classList.remove('hidden');
  loadView('dashboard');
}
$$('#sideNav a[data-view]').forEach(a => {
  a.onclick = e => {
    e.preventDefault();
    $$('#sideNav a').forEach(x => x.classList.remove('active'));
    a.classList.add('active');
    loadView(a.dataset.view);
  };
});
const TITLES = { dashboard: 'الرئيسية', leads: 'الطلبات', hotels: 'الفنادق', services: 'الخدمات', events: 'الفعاليات', universities: 'الجامعات', destinations: 'الوجهات', restaurants: 'المطاعم', settings: 'الإعدادات' };
async function loadView(view) {
  $('#viewTitle').textContent = TITLES[view] || view;
  if (view === 'dashboard') return renderDashboard();
  if (view === 'leads') return renderLeads();
  if (view === 'settings') return renderSettings();
  return renderTable(view);
}
async function renderDashboard() {
  const s = await api('/api/admin/stats');
  const cities = (s.by_city || []).map(c => `<li>${c.city}: <strong>${c.c}</strong></li>`).join('') || '<li>—</li>';
  const recent = (s.recent_leads || []).map(l => `<tr><td>${l.code}</td><td>${l.name}</td><td>${l.city}</td><td>${fmt(l.estimated_rub)}</td><td><span class="pill ${l.status}">${statusLabel(l.status)}</span></td></tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--gray)">لا توجد طلبات بعد</td></tr>';
  $('#viewContent').innerHTML = `
    <div class="stats">
      <div class="stat"><div class="label">إجمالي الطلبات</div><div class="value">${s.leads_total}</div></div>
      <div class="stat"><div class="label">طلبات جديدة</div><div class="value">${s.leads_new}</div></div>
      <div class="stat"><div class="label">حجوزات مكتملة</div><div class="value">${s.leads_booked}</div></div>
      <div class="stat"><div class="label">قيمة الطلبات التقديرية</div><div class="value">${fmt(s.revenue_estimate)}</div></div>
      <div class="stat"><div class="label">عدد الفنادق</div><div class="value">${s.hotels_total}</div></div>
      <div class="stat"><div class="label">عدد المطاعم</div><div class="value">${s.restaurants_total || 0}</div></div>
      <div class="stat"><div class="label">عدد الخدمات</div><div class="value">${s.services_total}</div></div>
      <div class="stat"><div class="label">عدد الفعاليات</div><div class="value">${s.events_total || 0}</div></div>
      <div class="stat"><div class="label">عدد الجامعات</div><div class="value">${s.universities_total}</div></div>
    </div>
    <h2 style="margin:20px 0 12px">أحدث الطلبات</h2>
    <table><thead><tr><th>#</th><th>الاسم</th><th>المدينة</th><th>القيمة</th><th>الحالة</th></tr></thead><tbody>${recent}</tbody></table>
    <h2 style="margin:26px 0 12px">المدن الأكثر طلباً</h2>
    <ul style="background:#fff;padding:18px 34px;border-radius:12px;box-shadow:var(--shadow);list-style:disc">${cities}</ul>`;
}
const SCHEMAS = {
  hotels: { title: 'الفنادق', fields: [
    { k: 'name', l: 'الاسم', type: 'text', required: 1 }, { k: 'city', l: 'المدينة', type: 'text', required: 1 },
    { k: 'stars', l: 'النجوم', type: 'number' }, { k: 'room_type', l: 'نوع الغرفة', type: 'text' },
    { k: 'breakfast', l: 'إفطار', type: 'bool' }, { k: 'price_rub', l: 'السعر الافتراضي (RUB)', type: 'number' },
    { k: 'address', l: 'العنوان', type: 'text' }, { k: 'image', l: 'رابط الصورة', type: 'text' },
    { k: 'description', l: 'الوصف', type: 'textarea' }, { k: 'active', l: 'مفعّل', type: 'bool' }
  ], cols: ['name', 'city', 'stars', 'price_rub', 'active'] },
  services: { title: 'الخدمات', fields: [
    { k: 'name', l: 'الاسم', type: 'text', required: 1 }, { k: 'description', l: 'الوصف', type: 'textarea' },
    { k: 'price_rub', l: 'السعر (RUB)', type: 'number' },
    { k: 'price_unit', l: 'وحدة السعر', type: 'select', options: [['order', 'للطلب'], ['person', 'للفرد'], ['car', 'للسيارة'], ['day', 'لليوم'], ['from', 'يبدأ من']] },
    { k: 'city', l: 'المدينة', type: 'text' }, { k: 'image', l: 'رابط الصورة', type: 'text' },
    { k: 'active', l: 'مفعّل', type: 'bool' }
  ], cols: ['name', 'city', 'price_rub', 'active'] },
  events: { title: 'الفعاليات', fields: [
    { k: 'name', l: 'الاسم', type: 'text', required: 1 }, { k: 'city', l: 'المدينة (موسكو / سوتشي)', type: 'text' },
    { k: 'event_date', l: 'التاريخ', type: 'date' }, { k: 'venue', l: 'المكان', type: 'text' },
    { k: 'price_rub', l: 'السعر (RUB)', type: 'number' }, { k: 'description', l: 'الوصف (ملاحظة)', type: 'textarea' },
    { k: 'image', l: 'رابط الصورة', type: 'text' }, { k: 'active', l: 'مفعّل', type: 'bool' }
  ], cols: ['name', 'city', 'event_date', 'price_rub', 'active'] },
  universities: { title: 'الجامعات', fields: [
    { k: 'name_ar', l: 'الاسم بالعربية', type: 'text', required: 1 }, { k: 'name_ru', l: 'الاسم بالروسية', type: 'text' },
    { k: 'name_en', l: 'الاسم بالإنجليزية', type: 'text' }, { k: 'city', l: 'المدينة', type: 'text' },
    { k: 'specializations', l: 'التخصصات', type: 'text' }, { k: 'tuition_rub', l: 'الرسوم (RUB)', type: 'number' },
    { k: 'housing', l: 'السكن', type: 'text' }, { k: 'website', l: 'الموقع الإلكتروني', type: 'text' },
    { k: 'description', l: 'الوصف', type: 'textarea' }, { k: 'image', l: 'رابط الصورة', type: 'text' },
    { k: 'active', l: 'مفعّل', type: 'bool' }
  ], cols: ['name_ar', 'city', 'tuition_rub', 'active'] },
  restaurants: { title: 'المطاعم', fields: [
    { k: 'name', l: 'اسم المطعم', type: 'text', required: 1 },
    { k: 'city', l: 'المدينة', type: 'select', options: [['موسكو', 'موسكو'], ['سوتشي', 'سوتشي'], ['سانت بطرسبرغ', 'سانت بطرسبرغ'], ['قازان', 'قازان'], ['مدينة أخرى', 'مدينة أخرى']] },
    { k: 'cuisine', l: 'نوع المطعم (نص حر)', type: 'text' },
    { k: 'note', l: 'ملاحظة (حلال / يبعد عن السنتر ...)', type: 'textarea' },
    { k: 'image', l: 'رابط الصورة', type: 'text' },
    { k: 'active', l: 'مفعّل', type: 'bool' }
  ], cols: ['name', 'city', 'cuisine', 'active'] },
  destinations: { title: 'الوجهات', fields: [
    { k: 'name_ar', l: 'الاسم بالعربية', type: 'text', required: 1 }, { k: 'name_ru', l: 'الاسم بالروسية', type: 'text' },
    { k: 'name_en', l: 'الاسم بالإنجليزية', type: 'text' }, { k: 'description', l: 'الوصف', type: 'textarea' },
    { k: 'image', l: 'رابط الصورة', type: 'text' }, { k: 'sort_order', l: 'الترتيب', type: 'number' },
    { k: 'active', l: 'مفعّل', type: 'bool' }
  ], cols: ['name_ar', 'sort_order', 'active'] }
};
function statusLabel(s) {
  return ({ new: 'جديد', contacted: 'تم التواصل', interested: 'مهتم', quote: 'عرض سعر', pending: 'بانتظار التأكيد', booked: 'تم الحجز', done: 'مكتمل', cancelled: 'ملغي' })[s] || s;
}
async function renderTable(entity) {
  const schema = SCHEMAS[entity];
  const rows = await api('/api/admin/' + entity);
  const cols = schema.cols;
  const isHotels = entity === 'hotels';
  $('#viewContent').innerHTML = `
    <button class="btn btn-gold" id="addBtn" style="margin-bottom:16px">+ إضافة جديد</button>
    <table><thead><tr><th>ID</th>${cols.map(c => `<th>${c}</th>`).join('')}<th>إجراءات</th></tr></thead>
      <tbody>${rows.length ? rows.map(r => `<tr><td>${r.id}</td>${cols.map(c => { let v = r[c]; if (typeof v === 'number' && c.includes('price')) v = fmt(v); if (c === 'active') v = v ? 'نعم' : 'لا'; return `<td>${v ?? ''}</td>`; }).join('')}<td class="row-actions"><button class="icon-btn" data-edit="${r.id}">تعديل</button>${isHotels ? `<button class="icon-btn" data-prices="${r.id}" style="background:var(--gold);color:var(--navy);">الأسعار</button>` : ''}<button class="icon-btn del" data-del="${r.id}">حذف</button></td></tr>`).join('') : `<tr><td colspan="${cols.length + 2}" style="text-align:center;color:var(--gray);padding:30px">لا توجد بيانات بعد</td></tr>`}</tbody></table>`;
  $('#addBtn').onclick = () => openModal(entity, null, schema);
  $$('[data-edit]').forEach(b => b.onclick = () => openModal(entity, rows.find(x => x.id == b.dataset.edit), schema));
  $$('[data-del]').forEach(b => b.onclick = async () => {
    if (!confirm('تأكيد الحذف؟')) return;
    await api(`/api/admin/${entity}/${b.dataset.del}`, { method: 'DELETE' });
    toast('تم الحذف', 'ok'); renderTable(entity);
  });
  if (isHotels) {
    $$('[data-prices]').forEach(b => b.onclick = () => {
      const hotel = rows.find(x => x.id == b.dataset.prices);
      openPricesModal(hotel);
    });
  }
}
/* ===== Seasonal Prices Modal ===== */
async function openPricesModal(hotel) {
  $('#modalContent').innerHTML = `
    <h2>الأسعار الموسمية — ${hotel.name}</h2>
    <p style="color:var(--gray);font-size:.9rem;margin-bottom:16px;">
      السعر الافتراضي: <strong style="color:var(--navy)">${fmt(hotel.price_rub)}</strong> / ليلة<br>
      <small>أضف فترات بسعر خاص (مثل رأس السنة، الصيف، العطلات).</small>
    </p>

    <form id="addPriceForm" style="background:var(--light);padding:16px;border-radius:12px;margin-bottom:16px;">
      <h4 style="margin-bottom:12px;font-size:.95rem;">+ إضافة فترة سعر جديدة</h4>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div class="field"><label>من تاريخ</label><input type="date" name="date_from" required></div>
        <div class="field"><label>إلى تاريخ</label><input type="date" name="date_to" required></div>
        <div class="field"><label>السعر / ليلة (RUB)</label><input type="number" name="price_rub" required placeholder="مثال: 65000"></div>
        <div class="field"><label>الاسم (اختياري)</label><input type="text" name="label" placeholder="مثال: رأس السنة"></div>
      </div>
      <button type="submit" class="btn btn-gold" style="margin-top:12px;">إضافة الفترة</button>
    </form>

    <h4 style="margin-bottom:10px;font-size:.95rem;">الفترات الحالية:</h4>
    <div id="pricesList"><p style="text-align:center;color:var(--gray);">جاري التحميل...</p></div>

    <div class="modal-actions"><button class="icon-btn" onclick="document.getElementById('modalBg').classList.remove('show')">إغلاق</button></div>
  `;
  $('#modalBg').classList.add('show');

  const loadPrices = async () => {
    const list = await api('/api/admin/hotels/' + hotel.id + '/prices');
    if (!list.length) {
      $('#pricesList').innerHTML = '<p style="text-align:center;color:var(--gray);padding:14px;">لا توجد فترات موسمية — سيُستخدم السعر الافتراضي دائماً.</p>';
      return;
    }
    $('#pricesList').innerHTML = `
      <table style="width:100%;font-size:.85rem;background:#fff;border-radius:10px;overflow:hidden;box-shadow:var(--shadow);border-collapse:collapse;">
        <thead><tr><th style="padding:8px;">من</th><th style="padding:8px;">إلى</th><th style="padding:8px;">السعر</th><th style="padding:8px;">الاسم</th><th style="padding:8px;"></th></tr></thead>
        <tbody>${list.map(p => `<tr>
          <td style="padding:8px;">${p.date_from}</td>
          <td style="padding:8px;">${p.date_to}</td>
          <td style="padding:8px;font-weight:700;color:var(--navy);">${fmt(p.price_rub)}</td>
          <td style="padding:8px;color:var(--gray);">${p.label || '—'}</td>
          <td style="padding:8px;"><button class="icon-btn del" data-del-price="${p.id}">حذف</button></td>
        </tr>`).join('')}</tbody>
      </table>`;
    $$('[data-del-price]').forEach(b => b.onclick = async () => {
      if (!confirm('حذف هذه الفترة؟')) return;
      await api('/api/admin/hotel-prices/' + b.dataset.delPrice, { method: 'DELETE' });
      toast('تم الحذف', 'ok');
      loadPrices();
    });
  };
  loadPrices();

  $('#addPriceForm').onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd);
    try {
      await api('/api/admin/hotels/' + hotel.id + '/prices', { method: 'POST', body: JSON.stringify(data) });
      toast('تمت الإضافة', 'ok');
      e.target.reset();
      loadPrices();
    } catch (err) { toast(err.message, 'err'); }
  };
}

async function uploadImage(file) {
  const fd = new FormData();
  fd.append('image', file);
  const r = await fetch('/api/admin/upload', { method: 'POST', body: fd });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: 'فشل الرفع' }));
    throw new Error(err.error || 'فشل رفع الصورة');
  }
  const data = await r.json();
  return data.url;
}
function openImageUploader(inputId) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async () => {
    if (!input.files.length) return;
    toast('جارٍ رفع الصورة...', '');
    try {
      const url = await uploadImage(input.files[0]);
      const field = document.getElementById(inputId);
      if (field) field.value = url;
      toast('تم رفع الصورة بنجاح', 'ok');
    } catch (e) {
      toast(e.message || 'فشل الرفع', 'err');
    }
  };
  input.click();
}

function openModal(entity, row, schema) {
  const isEdit = !!row;
  const form = schema.fields.map(f => {
    const v = row ? (row[f.k] ?? '') : '';
    if (f.type === 'textarea') return `<div class="field"><label>${f.l}</label><textarea name="${f.k}" rows="3">${v}</textarea></div>`;
    if (f.k === 'image') {
      const inputId = 'img_' + Math.random().toString(36).slice(2, 9);
      return `<div class="field">
        <label>${f.l}</label>
        <div style="display:flex;gap:8px;align-items:stretch;">
          <input type="text" name="${f.k}" id="${inputId}" value="${v}" placeholder="رابط الصورة أو ارفع صورة" style="flex:1;padding:10px 14px;border:2px solid var(--border);border-radius:10px;font-family:inherit;">
          <button type="button" class="btn btn-navy" style="white-space:nowrap;padding:10px 16px;font-size:.9rem;" onclick="openImageUploader('${inputId}')">📁 رفع صورة</button>
        </div>
        ${v ? `<img src="${v}" style="max-width:100px;margin-top:8px;border-radius:8px;border:2px solid var(--border);" onerror="this.style.display='none'">` : ''}
      </div>`;
    }
    if (f.type === 'bool') return `<div class="field"><label><input type="checkbox" name="${f.k}" ${v ? 'checked' : ''}> ${f.l}</label></div>`;
    if (f.type === 'select') return `<div class="field"><label>${f.l}</label><select name="${f.k}">${f.options.map(([val, lbl]) => `<option value="${val}" ${v === val ? 'selected' : ''}>${lbl}</option>`).join('')}</select></div>`;
    return `<div class="field"><label>${f.l}</label><input type="${f.type}" name="${f.k}" value="${v}" ${f.required ? 'required' : ''}></div>`;
  }).join('');
  $('#modalContent').innerHTML = `<h2>${isEdit ? 'تعديل' : 'إضافة'} — ${schema.title}</h2><form class="form" id="entityForm">${form}<div class="modal-actions"><button type="button" class="icon-btn" id="cancelBtn">إلغاء</button><button type="submit" class="btn btn-gold">حفظ</button></div></form>`;
  $('#modalBg').classList.add('show');
  $('#cancelBtn').onclick = closeModal;
  $('#entityForm').onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {};
    schema.fields.forEach(f => { data[f.k] = f.type === 'bool' ? (fd.get(f.k) ? 1 : 0) : fd.get(f.k); });
    try {
      if (isEdit) await api(`/api/admin/${entity}/${row.id}`, { method: 'PUT', body: JSON.stringify(data) });
      else await api(`/api/admin/${entity}`, { method: 'POST', body: JSON.stringify(data) });
      toast('تم الحفظ', 'ok'); closeModal(); renderTable(entity);
    } catch (err) { toast(err.message, 'err'); }
  };
}
function closeModal() { $('#modalBg').classList.remove('show'); }
$('#modalBg').onclick = e => { if (e.target.id === 'modalBg') closeModal(); };
async function renderLeads() {
  const rows = await api('/api/admin/leads');
  $('#viewContent').innerHTML = `<table><thead><tr><th>ID</th><th>الرقم</th><th>الاسم</th><th>الهاتف</th><th>المدينة</th><th>القيمة</th><th>الحالة</th><th>إجراءات</th></tr></thead>
    <tbody>${rows.length ? rows.map(r => `<tr><td>${r.id}</td><td>${r.code}</td><td>${r.name}</td><td>${r.whatsapp || r.phone}</td><td>${r.city || '—'}</td><td>${fmt(r.estimated_rub)}</td>
      <td><select data-status="${r.id}" style="padding:5px 8px;border-radius:8px;border:1px solid var(--border);font-family:inherit">${['new','contacted','interested','quote','pending','booked','done','cancelled'].map(s => `<option value="${s}" ${r.status === s ? 'selected' : ''}>${statusLabel(s)}</option>`).join('')}</select></td>
      <td class="row-actions"><a class="icon-btn" target="_blank" href="https://wa.me/${(r.whatsapp || r.phone || '').replace(/\D/g, '')}">واتساب</a><button class="icon-btn" data-view="${r.id}">تفاصيل</button><button class="icon-btn del" data-del="${r.id}">حذف</button></td></tr>`).join('') : `<tr><td colspan="8" style="text-align:center;color:var(--gray);padding:30px">لا توجد طلبات بعد</td></tr>`}</tbody></table>`;
  $$('[data-status]').forEach(sel => sel.onchange = async () => {
    await api(`/api/admin/leads/${sel.dataset.status}`, { method: 'PUT', body: JSON.stringify({ status: sel.value }) });
    toast('تم تحديث الحالة', 'ok');
  });
  $$('[data-del]').forEach(b => b.onclick = async () => {
    if (!confirm('حذف الطلب؟')) return;
    await api('/api/admin/leads/' + b.dataset.del, { method: 'DELETE' });
    toast('تم الحذف', 'ok'); renderLeads();
  });
  $$('[data-view]').forEach(b => b.onclick = async () => {
    const l = await api('/api/admin/leads/' + b.dataset.view);
    const services = JSON.parse(l.services || '[]');
    $('#modalContent').innerHTML = `<h2>طلب ${l.code}</h2>
      <div style="display:grid;gap:8px;font-size:.92rem">
        <div><strong>الاسم:</strong> ${l.name}</div>
        <div><strong>الدولة:</strong> ${l.country || '—'}</div>
        <div><strong>الهاتف:</strong> ${l.phone || '—'}</div>
        <div><strong>WhatsApp:</strong> ${l.whatsapp || '—'}</div>
        <div><strong>عدد الأشخاص:</strong> ${l.persons}</div>
        <div><strong>الوصول:</strong> ${l.arrival || '—'}</div>
        <div><strong>المغادرة:</strong> ${l.departure || '—'}</div>
        <div><strong>المدينة:</strong> ${l.city || '—'}</div>
        <div><strong>القيمة التقديرية:</strong> ${fmt(l.estimated_rub)}</div>
        <div><strong>العملة:</strong> ${l.currency || 'RUB'}</div>
        <div><strong>الحالة:</strong> ${statusLabel(l.status)}</div>
        <div><strong>الخدمات:</strong> ${services.length ? services.map(s => '• ' + s.name).join('<br>') : '—'}</div>
        <div><strong>ملاحظات:</strong> ${l.notes || '—'}</div>
        <div><strong>التاريخ:</strong> ${l.created_at}</div>
      </div>
      <div class="modal-actions"><button class="icon-btn" onclick="document.getElementById('modalBg').classList.remove('show')">إغلاق</button></div>`;
    $('#modalBg').classList.add('show');
  });
}
async function renderSettings() {
  const s = await api('/api/admin/settings');
  const GENERAL = [
    ['site_name', 'اسم الموقع'], ['site_tagline', 'الشعار'],
    ['hero_title', 'عنوان Hero'], ['hero_description', 'وصف Hero'],
    ['whatsapp_number', 'رقم واتساب (بدون +)'],
    ['contact_email', 'البريد'], ['contact_phone', 'الهاتف'],
    ['footer_text', 'نص التذييل'],
    ['instagram', 'Instagram'], ['facebook', 'Facebook'],
    ['tiktok', 'TikTok'], ['telegram', 'Telegram']
  ];
  const RATES = [
    ['rate_USD', 'الدولار الأمريكي (USD)', 'كم روبل يعادل 1 دولار'],
    ['rate_AED', 'الدرهم الإماراتي (AED)', 'كم روبل يعادل 1 درهم'],
    ['rate_SAR', 'الريال السعودي (SAR)', 'كم روبل يعادل 1 ريال'],
    ['rate_QAR', 'الريال القطري (QAR)', 'كم روبل يعادل 1 ريال قطري'],
    ['rate_KWD', 'الدينار الكويتي (KWD)', 'كم روبل يعادل 1 دينار'],
    ['rate_OMR', 'الريال العماني (OMR)', 'كم روبل يعادل 1 ريال عماني'],
    ['rate_BHD', 'الدينار البحريني (BHD)', 'كم روبل يعادل 1 دينار بحريني']
  ];
  $('#viewContent').innerHTML = `
    <form id="settingsForm" style="background:#fff;padding:26px;border-radius:16px;box-shadow:var(--shadow);display:grid;gap:14px;max-width:640px;margin-bottom:30px">
      <h3 style="color:var(--navy);margin-bottom:6px">إعدادات عامة</h3>
      ${GENERAL.map(([k, l]) => `
        <div class="field"><label style="font-size:.85rem;font-weight:700">${l}</label>
        <input name="${k}" value="${(s[k] || '').replace(/"/g, '&quot;')}" style="padding:10px 14px;border:2px solid var(--border);border-radius:10px;font-family:inherit"></div>`).join('')}
      <button class="btn btn-gold" type="submit">حفظ الإعدادات العامة</button>
    </form>

    <form id="ratesForm" style="background:#fff;padding:26px;border-radius:16px;box-shadow:var(--shadow);display:grid;gap:14px;max-width:640px;margin-bottom:30px">
      <h3 style="color:var(--navy);margin-bottom:6px">أسعار الصرف (مقابل الروبل الروسي)</h3>
      <p style="font-size:.85rem;color:var(--gray);margin-bottom:10px">حدّث القيم يومياً حسب سعر الصرف الحالي. مثال: إذا كان 1 دولار = 95 روبل، اكتب 95.</p>
      ${RATES.map(([k, l, hint]) => `
        <div class="field"><label style="font-size:.85rem;font-weight:700">${l}</label>
        <input name="${k}" value="${(s[k] || '').replace(/"/g, '&quot;')}" type="number" step="0.01" placeholder="${hint}" style="padding:10px 14px;border:2px solid var(--border);border-radius:10px;font-family:inherit"></div>`).join('')}
      <button class="btn btn-navy" type="submit">حفظ أسعار الصرف</button>
    </form>

    <h3 style="margin-bottom:14px">تغيير كلمة المرور</h3>
    <form id="pwdForm" style="background:#fff;padding:26px;border-radius:16px;box-shadow:var(--shadow);display:grid;gap:14px;max-width:640px">
      <div class="field"><label style="font-size:.85rem;font-weight:700">كلمة المرور الحالية</label><input name="current" type="password" required style="padding:10px 14px;border:2px solid var(--border);border-radius:10px;font-family:inherit"></div>
      <div class="field"><label style="font-size:.85rem;font-weight:700">كلمة المرور الجديدة</label><input name="next" type="password" required minlength="6" style="padding:10px 14px;border:2px solid var(--border);border-radius:10px;font-family:inherit"></div>
      <button class="btn btn-navy" type="submit">تغيير كلمة المرور</button>
    </form>`;
  $('#settingsForm').onsubmit = async e => {
    e.preventDefault();
    await api('/api/admin/settings', { method: 'PUT', body: JSON.stringify(Object.fromEntries(new FormData(e.target))) });
    toast('تم حفظ الإعدادات', 'ok');
  };
  $('#ratesForm').onsubmit = async e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    const cleaned = {};
    for (const [k, v] of Object.entries(data)) cleaned[k] = String(parseFloat(v) || 0);
    await api('/api/admin/settings', { method: 'PUT', body: JSON.stringify(cleaned) });
    toast('تم حفظ أسعار الصرف', 'ok');
  };
  $('#pwdForm').onsubmit = async e => {
    e.preventDefault();
    try {
      await api('/api/admin/password', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(e.target))) });
      toast('تم تغيير كلمة المرور', 'ok'); e.target.reset();
    } catch (err) { toast(err.message, 'err'); }
  };
}
(async () => {
  try {
    const me = await api('/api/auth/me');
    $('#adminName').textContent = me.username;
    showDash();
  } catch {}
})();
