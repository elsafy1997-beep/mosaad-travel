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
const TITLES = { dashboard: 'الرئيسية', leads: 'الطلبات', hotels: 'الفنادق', services: 'الخدمات', events: 'الفعاليات', universities: 'الجامعات', destinations: 'الوجهات', restaurants: 'المطاعم', ads: 'الإعلانات', trips: 'جداول العملاء', templates: 'قوالب الجداول', medical: 'العلاج', settings: 'الإعدادات' };
async function loadView(view) {
  $('#viewTitle').textContent = TITLES[view] || view;
  if (view === 'dashboard') return renderDashboard();
  if (view === 'leads') return renderLeads();
  if (view === 'settings') return renderSettings();
  if (view === 'ads') return renderAdsAdmin();
  if (view === 'trips') return renderTripsAdmin();
  if (view === 'templates') return renderTemplatesAdmin();
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
  medical: { title: 'العلاج', fields: [
    { k: 'name', l: 'الاسم', type: 'text', required: 1 },
    { k: 'type', l: 'النوع', type: 'select', options: [['hospital', 'مستشفى'], ['clinic', 'عيادة'], ['dentist', 'عيادة أسنان'], ['cosmetic', 'عيادة تجميل'], ['other', 'أخرى']] },
    { k: 'city', l: 'المدينة', type: 'select', options: [['موسكو', 'موسكو'], ['سوتشي', 'سوتشي'], ['سانت بطرسبرغ', 'سانت بطرسبرغ'], ['قازان', 'قازان'], ['مدينة أخرى', 'مدينة أخرى']] },
    { k: 'specialization', l: 'التخصص', type: 'text' },
    { k: 'description', l: 'الوصف', type: 'textarea' },
    { k: 'image', l: 'الصورة', type: 'text' },
    { k: 'active', l: 'مفعّل', type: 'bool' }
  ], cols: ['name', 'type', 'city', 'specialization', 'active'] },
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

async function renderAdsAdmin() {
  const ads = await api('/api/admin/ads');
  const today = new Date().toISOString().split('T')[0];
  $('#viewContent').innerHTML = `
    <button class="btn btn-gold" id="addAdBtn" style="margin-bottom:16px">+ إعلان جديد</button>
    <table>
      <thead><tr>
        <th>ID</th><th>العنوان</th><th>المكان</th><th>الفترة</th>
        <th>الأولوية</th><th>مشاهدات</th><th>نقرات</th><th>CTR</th>
        <th>الحالة</th><th>إجراءات</th>
      </tr></thead>
      <tbody>${ads.length ? ads.map(a => {
        let status = 'نشط', statusClass = 'booked';
        if (!a.active || !a.manual_active) { status = 'معطّل'; statusClass = 'cancelled'; }
        else if (a.date_to && a.date_to < today) { status = 'منتهي'; statusClass = 'new'; }
        else if (a.date_from && a.date_from > today) { status = 'مجدول'; statusClass = 'contacted'; }
        const ctr = a.impressions ? Math.round(a.clicks / a.impressions * 10000) / 100 : 0;
        const dates = (a.date_from || '—') + ' → ' + (a.date_to || '—');
        const posText = a.position === 'top' ? 'علوي' : a.position === 'bottom' ? 'سفلي' : 'وسط';
        return '<tr>' +
          '<td>' + a.id + '</td>' +
          '<td>' + a.title + '</td>' +
          '<td>' + posText + '</td>' +
          '<td style="font-size:.8rem;color:var(--gray);">' + dates + '</td>' +
          '<td>' + a.priority + '</td>' +
          '<td>' + a.impressions + '</td>' +
          '<td>' + a.clicks + '</td>' +
          '<td>' + ctr + '%</td>' +
          '<td><span class="pill ' + statusClass + '">' + status + '</span></td>' +
          '<td class="row-actions">' +
            '<button class="icon-btn" data-edit-ad="' + a.id + '">تعديل</button>' +
            '<button class="icon-btn" data-stats-ad="' + a.id + '">إحصائيات</button>' +
            '<button class="icon-btn del" data-del-ad="' + a.id + '">حذف</button>' +
          '</td>' +
        '</tr>';
      }).join('') : '<tr><td colspan="10" style="text-align:center;color:var(--gray);padding:30px">لا توجد إعلانات بعد</td></tr>'}</tbody>
    </table>`;

  $('#addAdBtn').onclick = function() { openAdModal(null); };
  $$('[data-edit-ad]').forEach(function(b) {
    b.onclick = function() { openAdModal(ads.find(function(x) { return x.id == b.dataset.editAd; })); };
  });
  $$('[data-del-ad]').forEach(function(b) {
    b.onclick = async function() {
      if (!confirm('حذف الإعلان؟')) return;
      await api('/api/admin/ads/' + b.dataset.delAd, { method: 'DELETE' });
      toast('تم الحذف', 'ok');
      renderAdsAdmin();
    };
  });
  $$('[data-stats-ad]').forEach(function(b) {
    b.onclick = async function() {
      const s = await api('/api/admin/ads/' + b.dataset.statsAd + '/stats');
      let dailyHtml = '<tr><td colspan="3" style="text-align:center;color:var(--gray)">لا توجد بيانات</td></tr>';
      if (s.daily.length) {
        dailyHtml = s.daily.map(function(d) {
          return '<tr><td>' + d.day + '</td><td>' + d.impressions + '</td><td>' + d.clicks + '</td></tr>';
        }).join('');
      }
      $('#modalContent').innerHTML =
        '<h2>إحصائيات الإعلان</h2>' +
        '<div class="stats" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px">' +
          '<div class="stat"><div class="label">المشاهدات</div><div class="value">' + s.impressions + '</div></div>' +
          '<div class="stat"><div class="label">النقرات</div><div class="value">' + s.clicks + '</div></div>' +
          '<div class="stat"><div class="label">CTR</div><div class="value">' + s.ctr + '%</div></div>' +
        '</div>' +
        '<h4 style="margin-bottom:10px">آخر 30 يوم:</h4>' +
        '<table style="font-size:.85rem"><thead><tr><th>التاريخ</th><th>مشاهدات</th><th>نقرات</th></tr></thead>' +
        '<tbody>' + dailyHtml + '</tbody></table>' +
        '<div class="modal-actions">' +
          '<button class="icon-btn" onclick="document.getElementById(\'modalBg\').classList.remove(\'show\')">إغلاق</button>' +
        '</div>';
      $('#modalBg').classList.add('show');
    };
  });
}

function openAdModal(ad) {
  const isEdit = !!ad;
  const a = ad || { position: 'middle', action_type: 'link', bg_color: '#0a1f44', text_color: '#ffffff', priority: 5, active: 1, manual_active: 1, button_text: 'اعرف المزيد' };
  const title = isEdit ? 'تعديل' : 'إضافة';
  const imgId = 'adImg_' + Math.random().toString(36).slice(2, 9);

  $('#modalContent').innerHTML =
    '<h2>' + title + ' إعلان</h2>' +
    '<form class="form" id="adForm" style="display:grid;gap:12px">' +
      '<div class="field"><label>العنوان *</label><input name="title" value="' + (a.title || '') + '" required></div>' +
      '<div class="field"><label>الوصف</label><textarea name="description" rows="2">' + (a.description || '') + '</textarea></div>' +
      '<div class="field"><label>الصورة</label>' +
        '<div style="display:flex;gap:8px;align-items:stretch;">' +
          '<input type="text" name="image" id="' + imgId + '" value="' + (a.image || '') + '" placeholder="رابط الصورة أو ارفع صورة" style="flex:1;padding:10px 14px;border:2px solid var(--border);border-radius:10px;font-family:inherit;">' +
          '<button type="button" class="btn btn-navy" style="white-space:nowrap;padding:10px 16px;font-size:.9rem;" onclick="openImageUploader(\'' + imgId + '\')">📁 رفع صورة</button>' +
        '</div>' +
        '<div id="' + imgId + '_preview">' + (a.image ? '<img src="' + a.image + '" style="max-width:120px;margin-top:10px;border-radius:8px;border:2px solid var(--border);" onerror="this.style.display=\'none\'">' : '') + '</div>' +
      '</div>' +
      '<div class="field"><label>نص الزر</label><input name="button_text" value="' + (a.button_text || 'اعرف المزيد') + '"></div>' +
      '<div class="field"><label>المكان</label>' +
        '<select name="position">' +
          '<option value="top" ' + (a.position === 'top' ? 'selected' : '') + '>علوي (تحت القائمة)</option>' +
          '<option value="middle" ' + (a.position === 'middle' ? 'selected' : '') + '>وسط (بين الأقسام)</option>' +
          '<option value="bottom" ' + (a.position === 'bottom' ? 'selected' : '') + '>سفلي (فوق Footer)</option>' +
        '</select>' +
      '</div>' +
      '<div class="field"><label>نوع الزر</label>' +
        '<select name="action_type">' +
          '<option value="link" ' + (a.action_type === 'link' ? 'selected' : '') + '>رابط خارجي</option>' +
          '<option value="whatsapp" ' + (a.action_type === 'whatsapp' ? 'selected' : '') + '>WhatsApp</option>' +
          '<option value="page" ' + (a.action_type === 'page' ? 'selected' : '') + '>رابط داخلي</option>' +
        '</select>' +
      '</div>' +
      '<div class="field"><label>قيمة الزر</label><input name="action_value" value="' + (a.action_value || '') + '" placeholder="https://example.com أو 966501234567"></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
        '<div class="field"><label>لون الخلفية</label><input type="color" name="bg_color" value="' + (a.bg_color || '#0a1f44') + '" style="height:44px"></div>' +
        '<div class="field"><label>لون النص</label><input type="color" name="text_color" value="' + (a.text_color || '#ffffff') + '" style="height:44px"></div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">' +
        '<div class="field"><label>الأولوية</label><input type="number" name="priority" min="1" max="10" value="' + (a.priority || 5) + '"></div>' +
        '<div class="field"><label>من تاريخ</label><input type="date" name="date_from" value="' + (a.date_from || '') + '"></div>' +
        '<div class="field"><label>إلى تاريخ</label><input type="date" name="date_to" value="' + (a.date_to || '') + '"></div>' +
      '</div>' +
      '<div class="field"><label><input type="checkbox" name="active" ' + (a.active ? 'checked' : '') + '> مفعّل تلقائياً</label></div>' +
      '<div class="field"><label><input type="checkbox" name="manual_active" ' + (a.manual_active ? 'checked' : '') + '> تشغيل يدوي</label></div>' +
      '<div class="modal-actions">' +
        '<button type="button" class="icon-btn" onclick="document.getElementById(\'modalBg\').classList.remove(\'show\')">إلغاء</button>' +
        '<button type="submit" class="btn btn-gold">حفظ</button>' +
      '</div>' +
    '</form>';

  $('#modalBg').classList.add('show');

  $('#adForm').onsubmit = async function(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
      title: fd.get('title'), description: fd.get('description'), image: fd.get('image'),
      button_text: fd.get('button_text'), action_type: fd.get('action_type'), action_value: fd.get('action_value'),
      position: fd.get('position'), bg_color: fd.get('bg_color'), text_color: fd.get('text_color'),
      priority: +fd.get('priority'), date_from: fd.get('date_from') || null, date_to: fd.get('date_to') || null,
      active: fd.get('active') ? 1 : 0, manual_active: fd.get('manual_active') ? 1 : 0
    };
    try {
      if (isEdit) await api('/api/admin/ads/' + ad.id, { method: 'PUT', body: JSON.stringify(data) });
      else await api('/api/admin/ads', { method: 'POST', body: JSON.stringify(data) });
      toast('تم الحفظ', 'ok');
      document.getElementById('modalBg').classList.remove('show');
      renderAdsAdmin();
    } catch (err) { toast(err.message, 'err'); }
  };
}


/* ===== TRIPS (جداول العملاء) ===== */
async function renderTripsAdmin() {
  const trips = await api('/api/admin/trip-plans');
  $('#viewContent').innerHTML = `
    <table>
      <thead><tr>
        <th>ID</th><th>الرقم</th><th>الاسم</th><th>WhatsApp</th>
        <th>الفترة</th><th>الأشخاص</th><th>الأنشطة</th>
        <th>الحالة</th><th>إجراءات</th>
      </tr></thead>
      <tbody>${trips.length ? trips.map(t => {
        const dates = (t.start_date || '—') + ' → ' + (t.end_date || '—');
        return '<tr>' +
          '<td>' + t.id + '</td>' +
          '<td>' + (t.code || '') + '</td>' +
          '<td>' + t.client_name + '</td>' +
          '<td>' + (t.client_whatsapp || '—') + '</td>' +
          '<td style="font-size:.8rem;color:var(--gray);">' + dates + '</td>' +
          '<td>' + t.persons + '</td>' +
          '<td>' + t.activities_count + '</td>' +
          '<td><span class="pill ' + (t.status === 'new' ? 'new' : 'booked') + '">' + statusLabel(t.status) + '</span></td>' +
          '<td class="row-actions">' +
            '<a class="icon-btn" target="_blank" href="https://wa.me/' + ((t.client_whatsapp || '').replace(/\D/g, '')) + '">واتساب</a>' +
            '<button class="icon-btn" data-view-trip="' + t.id + '">تفاصيل</button>' +
            '<button class="icon-btn del" data-del-trip="' + t.id + '">حذف</button>' +
          '</td>' +
        '</tr>';
      }).join('') : '<tr><td colspan="9" style="text-align:center;color:var(--gray);padding:30px">لا توجد جداول بعد</td></tr>'}</tbody>
    </table>`;

  $$('[data-del-trip]').forEach(b => b.onclick = async () => {
    if (!confirm('حذف هذا الجدول؟')) return;
    await api('/api/admin/trip-plans/' + b.dataset.delTrip, { method: 'DELETE' });
    toast('تم الحذف', 'ok');
    renderTripsAdmin();
  });

  $$('[data-view-trip]').forEach(b => b.onclick = async () => {
    const plan = await api('/api/admin/trip-plans/' + b.dataset.viewTrip);
    const byDay = {};
    plan.activities.forEach(a => {
      if (!byDay[a.day_number]) byDay[a.day_number] = [];
      byDay[a.day_number].push(a);
    });

    let daysHtml = '';
    Object.keys(byDay).sort((a,b) => +a - +b).forEach(dayNum => {
      daysHtml += '<div style="background:#f8fafc;padding:14px;border-radius:10px;margin-bottom:12px;">';
      daysHtml += '<h4 style="color:var(--navy);margin-bottom:10px;">📅 اليوم ' + dayNum + '</h4>';
      byDay[dayNum].forEach(a => {
        daysHtml += '<div style="padding:8px 12px;background:#fff;border-radius:8px;margin-bottom:6px;font-size:.9rem;">';
        daysHtml += '<strong>' + (a.time_slot || '') + '</strong> — ' + (a.title || a.description);
        if (a.location) daysHtml += ' <span style="color:var(--gray);">📍 ' + a.location + '</span>';
        if (a.description && a.title) daysHtml += '<br><span style="font-size:.85rem;color:var(--gray);">' + a.description + '</span>';
        daysHtml += '</div>';
      });
      daysHtml += '</div>';
    });

    $('#modalContent').innerHTML =
      '<h2>جدول: ' + plan.code + '</h2>' +
      '<div style="display:grid;gap:8px;font-size:.92rem;margin-bottom:16px;">' +
        '<div><strong>الاسم:</strong> ' + plan.client_name + '</div>' +
        '<div><strong>WhatsApp:</strong> ' + (plan.client_whatsapp || '—') + '</div>' +
        '<div><strong>الدولة:</strong> ' + (plan.country || '—') + '</div>' +
        '<div><strong>عدد الأشخاص:</strong> ' + plan.persons + '</div>' +
        '<div><strong>الفترة:</strong> ' + (plan.start_date || '—') + ' → ' + (plan.end_date || '—') + '</div>' +
        '<div><strong>التاريخ:</strong> ' + plan.created_at + '</div>' +
        (plan.notes ? '<div><strong>ملاحظات:</strong> ' + plan.notes + '</div>' : '') +
      '</div>' +
      '<h3 style="margin-bottom:12px;">الأنشطة:</h3>' +
      daysHtml +
      '<div class="modal-actions"><button class="icon-btn" onclick="document.getElementById(\'modalBg\').classList.remove(\'show\')">إغلاق</button></div>';
    $('#modalBg').classList.add('show');
  });
}

/* ===== TEMPLATES (قوالب الجداول) ===== */
async function renderTemplatesAdmin() {
  const templates = await api('/api/admin/trip-templates');
  $('#viewContent').innerHTML = `
    <button class="btn btn-gold" id="addTemplateBtn" style="margin-bottom:16px">+ قالب جديد</button>
    <table>
      <thead><tr>
        <th>ID</th><th>الاسم</th><th>الوصف</th><th>المدينة</th>
        <th>الأيام</th><th>الأنشطة</th><th>الحالة</th><th>إجراءات</th>
      </tr></thead>
      <tbody>${templates.length ? templates.map(t => `
        <tr>
          <td>${t.id}</td>
          <td>${t.name}</td>
          <td style="font-size:.85rem;color:var(--gray);">${t.description || '—'}</td>
          <td>${t.city || '—'}</td>
          <td>${t.days_count}</td>
          <td>${t.activities_count}</td>
          <td><span class="pill ${t.active ? 'booked' : 'cancelled'}">${t.active ? 'نشط' : 'معطّل'}</span></td>
          <td class="row-actions">
            <button class="icon-btn" data-edit-tpl="${t.id}">تعديل</button>
            <button class="icon-btn" data-toggle-tpl="${t.id}" data-active="${t.active}">${t.active ? 'تعطيل' : 'تفعيل'}</button>
            <button class="icon-btn del" data-del-tpl="${t.id}">حذف</button>
          </td>
        </tr>`).join('') : '<tr><td colspan="8" style="text-align:center;color:var(--gray);padding:30px">لا توجد قوالب بعد</td></tr>'}</tbody>
    </table>`;

  $('#addTemplateBtn').onclick = () => openTemplateModal(null);
  $$('[data-edit-tpl]').forEach(b => b.onclick = async () => {
    const tpl = await api('/api/admin/trip-templates/' + b.dataset.editTpl);
    openTemplateModal(tpl);
  });
  $$('[data-toggle-tpl]').forEach(b => b.onclick = async () => {
    const isActive = b.dataset.active === '1' || b.dataset.active === 'true';
    await api('/api/admin/trip-templates/' + b.dataset.toggleTpl, {
      method: 'PUT',
      body: JSON.stringify({ active: isActive ? 0 : 1 })
    });
    toast('تم التحديث', 'ok');
    renderTemplatesAdmin();
  });
  $$('[data-del-tpl]').forEach(b => b.onclick = async () => {
    if (!confirm('حذف هذا القالب؟')) return;
    await api('/api/admin/trip-templates/' + b.dataset.delTpl, { method: 'DELETE' });
    toast('تم الحذف', 'ok');
    renderTemplatesAdmin();
  });
}

let tplDays = [];

function openTemplateModal(template) {
  const isEdit = !!template;
  const t = template || { name: '', description: '', city: '', active: 1 };
  
  // Convert activities to days structure
  tplDays = [];
  if (t.activities && t.activities.length) {
    const byDay = {};
    t.activities.forEach(a => {
      if (!byDay[a.day_number]) byDay[a.day_number] = [];
      byDay[a.day_number].push(a);
    });
    Object.keys(byDay).sort((a,b) => +a - +b).forEach(dn => {
      tplDays.push({
        id: 'd' + Math.random().toString(36).slice(2, 9),
        activities: byDay[dn].map(a => ({
          id: 'a' + Math.random().toString(36).slice(2, 9),
          time_slot: a.time_slot || 'صباحاً',
          title: a.title || '',
          description: a.description || '',
          location: a.location || ''
        }))
      });
    });
  } else {
    tplDays.push({ id: 'd1', activities: [] });
  }

  $('#modalContent').innerHTML =
    '<h2>' + (isEdit ? 'تعديل' : 'إضافة') + ' قالب جدول</h2>' +
    '<form id="tplForm" style="display:grid;gap:14px;">' +
      '<div class="field"><label>اسم القالب *</label><input name="name" value="' + (t.name || '') + '" required></div>' +
      '<div class="field"><label>الوصف</label><textarea name="description" rows="2">' + (t.description || '') + '</textarea></div>' +
      '<div class="field"><label>المدينة</label><input name="city" value="' + (t.city || '') + '"></div>' +
      '<div class="field"><label><input type="checkbox" name="active" ' + (t.active ? 'checked' : '') + '> نشط</label></div>' +
      '<hr>' +
      '<h4 style="color:var(--navy);">📅 أيام القالب والأنشطة</h4>' +
      '<div id="tplDaysContainer"></div>' +
      '<button type="button" class="btn btn-navy" id="addTplDayBtn">+ إضافة يوم</button>' +
      '<div class="modal-actions">' +
        '<button type="button" class="icon-btn" onclick="document.getElementById(\'modalBg\').classList.remove(\'show\')">إلغاء</button>' +
        '<button type="submit" class="btn btn-gold">💾 حفظ القالب</button>' +
      '</div>' +
    '</form>';

  $('#modalBg').classList.add('show');
  renderTplDays();

  $('#addTplDayBtn').onclick = () => {
    tplDays.push({ id: 'd' + Math.random().toString(36).slice(2, 9), activities: [] });
    renderTplDays();
  };

  $('#tplForm').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    
    const activities = [];
    tplDays.forEach((day, idx) => {
      day.activities.forEach(a => {
        if (!a.title && !a.description) return;
        activities.push({
          day_number: idx + 1,
          time_slot: a.time_slot,
          title: a.title,
          description: a.description,
          location: a.location
        });
      });
    });

    const data = {
      name: fd.get('name'),
      description: fd.get('description'),
      city: fd.get('city'),
      active: fd.get('active') ? 1 : 0,
      activities
    };

    try {
      if (isEdit) {
        await api('/api/admin/trip-templates/' + template.id, { method: 'PUT', body: JSON.stringify(data) });
      } else {
        await api('/api/admin/trip-templates', { method: 'POST', body: JSON.stringify(data) });
      }
      toast('تم الحفظ', 'ok');
      document.getElementById('modalBg').classList.remove('show');
      renderTemplatesAdmin();
    } catch (err) { toast(err.message, 'err'); }
  };
}

function renderTplDays() {
  const container = document.getElementById('tplDaysContainer');
  if (!container) return;

  const timeSlots = ['صباحاً', 'ظهراً', 'مساءً', 'ليلاً'];

  if (!tplDays.length) {
    container.innerHTML = '<p style="text-align:center;color:var(--gray);padding:14px;">لم تُضف أي يوم بعد</p>';
    return;
  }

  container.innerHTML = tplDays.map((day, idx) => {
    const actsHtml = day.activities.length
      ? day.activities.map(a => `
        <div style="background:#f8fafc;padding:10px;border-radius:10px;margin-bottom:8px;display:grid;gap:8px;">
          <div style="display:grid;grid-template-columns:120px 1fr 1fr;gap:8px;">
            <select onchange="updateTplActivity('${day.id}','${a.id}','time_slot',this.value)" style="padding:6px 10px;border:2px solid var(--border);border-radius:8px;font-family:inherit;">
              ${timeSlots.map(t => '<option value="' + t + '" ' + (a.time_slot === t ? 'selected' : '') + '>' + t + '</option>').join('')}
            </select>
            <input type="text" placeholder="العنوان" value="${(a.title || '').replace(/"/g, '&quot;')}" onchange="updateTplActivity('${day.id}','${a.id}','title',this.value)" style="padding:6px 10px;border:2px solid var(--border);border-radius:8px;font-family:inherit;">
            <input type="text" placeholder="الموقع" value="${(a.location || '').replace(/"/g, '&quot;')}" onchange="updateTplActivity('${day.id}','${a.id}','location',this.value)" style="padding:6px 10px;border:2px solid var(--border);border-radius:8px;font-family:inherit;">
          </div>
          <textarea rows="2" placeholder="الوصف" onchange="updateTplActivity('${day.id}','${a.id}','description',this.value)" style="padding:6px 10px;border:2px solid var(--border);border-radius:8px;font-family:inherit;">${a.description || ''}</textarea>
          <button type="button" class="icon-btn del" style="justify-self:end;" onclick="removeTplActivity('${day.id}','${a.id}')">حذف النشاط</button>
        </div>
      `).join('')
      : '<p style="text-align:center;color:var(--gray);font-size:.85rem;padding:8px;">لا توجد أنشطة</p>';

    return '<div style="background:#fff;padding:14px;border-radius:12px;margin-bottom:12px;border:2px solid var(--border);">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">' +
        '<strong style="color:var(--navy);">اليوم ' + (idx + 1) + '</strong>' +
        (tplDays.length > 1 ? '<button type="button" class="icon-btn del" onclick="removeTplDay(\'' + day.id + '\')">حذف اليوم</button>' : '') +
      '</div>' +
      actsHtml +
      '<button type="button" class="btn btn-navy" style="width:100%;margin-top:8px;" onclick="addTplActivity(\'' + day.id + '\')">+ إضافة نشاط</button>' +
    '</div>';
  }).join('');
}

window.updateTplActivity = function(dayId, actId, field, value) {
  const day = tplDays.find(d => d.id === dayId);
  if (!day) return;
  const a = day.activities.find(x => x.id === actId);
  if (!a) return;
  a[field] = value;
};

window.addTplActivity = function(dayId) {
  const day = tplDays.find(d => d.id === dayId);
  if (!day) return;
  day.activities.push({
    id: 'a' + Math.random().toString(36).slice(2, 9),
    time_slot: 'صباحاً',
    title: '', description: '', location: ''
  });
  renderTplDays();
};

window.removeTplActivity = function(dayId, actId) {
  const day = tplDays.find(d => d.id === dayId);
  if (!day) return;
  day.activities = day.activities.filter(a => a.id !== actId);
  renderTplDays();
};

window.removeTplDay = function(dayId) {
  if (!confirm('حذف هذا اليوم؟')) return;
  tplDays = tplDays.filter(d => d.id !== dayId);
  renderTplDays();
};

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
