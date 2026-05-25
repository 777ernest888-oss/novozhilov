// === ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ===
let tg = null;
let config = {};
let listings = [];
let currentModalId = null;
let map = null;
let markers = [];

// === НАСТРОЙКИ БЕЗОПАСНОЙ ОТПРАВКИ ===
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxiuUMeslxZOUBC2Y4sg2QqJe_Iy5u8qA3WE7j3sWfuvWmzXz8P807FK9m7Q5YFiWs2/exec';
const SECRET_KEY = 'SecretParol999';
const PROJECT_ID = 'novozhilov';

// === БЕЗОПАСНАЯ ИНИЦИАЛИЗАЦИЯ TELEGRAM ===
try {
  if (window.Telegram && window.Telegram.WebApp) {
    tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();
  }
} catch (e) {
  console.log('Telegram SDK error:', e);
}
if (!tg) {
  tg = {
    ready: () => {},
    expand: () => {},
    MainButton: { setText: () => {}, show: () => {}, onClick: () => {}, hide: () => {} },
    showAlert: (msg) => alert(msg),
    openLink: (url) => window.open(url, '_blank'),
    initDataUnsafe: { user: {} },
    close: () => {}
  };
}

// === НАВИГАЦИЯ ===
function showBack() {
  const btn = document.getElementById('customBackBtn');
  if (btn) btn.classList.remove('hidden');
}

function hideBack() {
  const btn = document.getElementById('customBackBtn');
  if (btn) btn.classList.add('hidden');
}

function appBack() {
  if (!document.getElementById('consultModal').classList.contains('hidden')) {
    return closeConsultModal();
  }  if (!document.getElementById('detailsModal').classList.contains('hidden')) {
    return closeModal();
  }
  if (!document.getElementById('mapContainer').classList.contains('hidden')) {
    return switchView('list');
  }
  if (tg.close) tg.close();
}

// === ЗАПУСК ===
function startApp() {
  document.getElementById('welcomeScreen')?.classList.add('hidden');
  document.getElementById('mainContent')?.classList.remove('hidden');
  window.scrollTo(0, 0);
  hideBack();
}

function switchView(view) {
  const listBtn = document.getElementById('listViewBtn');
  const mapBtn = document.getElementById('mapViewBtn');
  const listContainer = document.getElementById('listingsContainer');
  const mapContainer = document.getElementById('mapContainer');
 
  if (view === 'list') {
    listBtn?.classList.add('active');
    mapBtn?.classList.remove('active');
    listContainer?.classList.remove('hidden');
    mapContainer?.classList.add('hidden');
    hideBack();
  } else {
    listBtn?.classList.remove('active');
    mapBtn?.classList.add('active');
    listContainer?.classList.add('hidden');
    mapContainer?.classList.remove('hidden');
    showBack();
    setTimeout(() => initMap(), 100);
  }
}

// === ИНИЦИАЛИЗАЦИЯ ===
async function init() {
  const loader = document.getElementById('loadingScreen');
  loader?.classList.remove('hidden');
 
  try {
    const configRes = await fetch('config.json?v=' + Date.now());
    if (!configRes.ok) throw new Error('Не удалось загрузить config.json');
    config = await configRes.json();
   
    if (config.data?.sheetUrl) {      listings = await loadFromGoogleSheets(config.data.sheetUrl);
      console.log('Загружено объектов:', listings.length);
    }
   
    applyTheme();
    applyBranding();
    renderWelcome();
    renderListings(listings);
    initPhoneMask();
    hideBack();
   
  } catch (error) {
    console.error('Init Error:', error);
    const container = document.getElementById('listingsContainer');
    if (container) {
      container.innerHTML = `<div class="empty-state">⚠️ Ошибка: ${error.message}. Откройте консоль (F12) для деталей.</div>`;
    }
  } finally {
    loader?.classList.add('hidden');
  }
}

function applyTheme() {
  if (!config.brand) return;
  if (config.brand.primaryColor) document.documentElement.style.setProperty('--primary', config.brand.primaryColor);
  if (config.brand.accentColor) document.documentElement.style.setProperty('--accent', config.brand.accentColor);
}

function applyBranding() {
  if (!config.brand) return;
  const imgEl = document.getElementById('welcomeImage');
  if (config.brand.welcomeImage && imgEl) {
    imgEl.src = config.brand.welcomeImage + '?v=' + Date.now();
    imgEl.classList.remove('hidden');
  }
  const titleEl = document.getElementById('welcomeTitle');
  const subtitleEl = document.getElementById('welcomeSubtitle');
  if (config.brand.welcomeTitle && titleEl) titleEl.textContent = config.brand.welcomeTitle;
  if (config.brand.welcomeSubtitle && subtitleEl) subtitleEl.textContent = config.brand.welcomeSubtitle;
}

function renderWelcome() {
  if (config.features?.showWelcomeScreen === false) {
    document.getElementById('welcomeScreen')?.classList.add('hidden');
    document.getElementById('mainContent')?.classList.remove('hidden');
  }
}

// === ЗАГРУЗКА ДАННЫХ ИЗ GOOGLE SHEETS (ИСПРАВЛЕНА) ===
async function loadFromGoogleSheets(url) {  let csvUrl = url.trim();
  csvUrl = csvUrl.replace('/pubhtml', '/pub').replace('/edit', '/pub');
  if (!csvUrl.includes('output=csv')) {
    csvUrl += (csvUrl.includes('?') ? '&' : '?') + 'output=csv';
  }
  const response = await fetch(csvUrl + '&_t=' + Date.now());
  if (!response.ok) throw new Error(`Таблица недоступна (статус ${response.status})`);
  return parseCSV(await response.text());
}

function parseCSV(csv) {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]).map(h => h.trim());
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const values = parseCSVLine(line);
    const obj = {};
    headers.forEach((h, i) => {
      let v = values[i] !== undefined ? values[i].trim() : '';
      if (v === 'TRUE') v = true;
      else if (v === 'FALSE') v = false;
      else if (!isNaN(v) && v !== '') v = Number(v);
      obj[h] = v;
    });
    return obj;
  });
}

function parseCSVLine(line) {
  const res = [];
  let cur = '';
  let inQ = false;
  for (const c of line) {
    if (c === '"') inQ = !inQ;
    else if (c === ',' && !inQ) { res.push(cur); cur = ''; }
    else cur += c;
  }
  res.push(cur);
  return res;
}

// === ОТРИСОВКА СПИСКА ===
function renderListings(data) {
  const cont = document.getElementById('listingsContainer');
  if (!cont) return;
  cont.innerHTML = '';
 
  if (!data?.length) {
    cont.innerHTML = `<div class="empty-state">${listings.length ? 'Ничего не найдено' : 'Объекты ещё не добавлены'}</div>`;
    return;  }
 
  data.forEach((item, index) => {
    let price = '?';
    if (typeof item.price_from === 'number') {
      price = item.price_from < 1000 ? item.price_from.toFixed(1) : (item.price_from / 1000000).toFixed(1);
    }
    const ppsqm = typeof item.price_per_sqm === 'number' ? Math.round(item.price_per_sqm).toLocaleString('ru-RU') : '';
    const area = (typeof item.area_min === 'number' && typeof item.area_max === 'number') ? `${item.area_min}–${item.area_max} м²` : '';
    const statusKey = (item.status || 'other').toString().replace(/\s+/g, '-');
    const statusTxt = item.status === 'Сдан' ? '✅ Сдан' : item.status === 'Строится' ? '🏗 Строится' : '🟡 Частично сдан';
   
    const card = document.createElement('div');
    card.className = 'listing-card';
    card.style.animationDelay = (index * 0.05) + 's';
    card.onclick = e => { if (!e.target.closest('.consult-btn-inline')) openDetails(item.id); };
   
    card.innerHTML = `
      <img src="${escapeHtml(item.image_main) || ''}" class="listing-image" onerror="this.style.display='none'; this.parentElement.innerHTML+='<div style=\'height:200px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;color:#999\'>📷</div>'">
      <div class="listing-info">
        <h3>${escapeHtml(item.name) || 'Без названия'}</h3>
        <div class="listing-meta">
          <span>${escapeHtml(item.district) || ''}</span>
          <span>🚇 ${escapeHtml(item.metro) || ''}</span>
          ${item.rooms ? `<span>🚪 ${escapeHtml(item.rooms)}</span>` : ''}
          ${area ? `<span>📐 ${escapeHtml(area)}</span>` : ''}
        </div>
        <div class="listing-price">от ${price} млн ₽ ${ppsqm ? `<span class="price-per-sqm">~${ppsqm} ₽/м²</span>` : ''}</div>
        <div class="listing-status status-${statusKey}">${statusTxt}</div>
        <button class="tg-btn consult-btn-inline" onclick="openConsultForm('${item.id}', event)">📞 Получить консультацию</button>
      </div>
    `;
    cont.appendChild(card);
  });
}

// === КАРТА ===
function initMap() {
  if (typeof L === 'undefined') return;
  const cont = document.getElementById('mapContainer');
  if (!cont) return;
  if (!map) {
    map = L.map('mapContainer').setView([59.9343, 30.3351], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);
  }
  updateMapMarkers(listings.filter(l => l.active));
  setTimeout(() => map.invalidateSize(), 150);
}

function updateMapMarkers(items) {  if (!map) return;
  markers.forEach(m => map.removeLayer(m));
  markers = [];
  items.forEach(item => {
    if (!item.active || !item.lat || !item.lng) return;
    let p = '?';
    if (typeof item.price_from === 'number') p = item.price_from < 1000 ? item.price_from.toFixed(1) : (item.price_from / 1000000).toFixed(1);
    const m = L.marker([item.lat, item.lng]).addTo(map).bindPopup(`<b>${escapeHtml(item.name)}</b><br>от ${p} млн ₽`);
    markers.push(m);
  });
  if (markers.length) map.fitBounds(new L.featureGroup(markers).getBounds().pad(0.1));
}

// === МОДАЛЬНОЕ ОКНО ДЕТАЛЕЙ ===
function openDetails(id) {
  const item = listings.find(l => l.id === id);
  if (!item) return;
  currentModalId = id;
  document.getElementById('modalTitle').textContent = item.name || '';
  let price = '?';
  if (typeof item.price_from === 'number') price = item.price_from < 1000 ? item.price_from.toFixed(1) : (item.price_from / 1000000).toFixed(1);
  const ppsqm = typeof item.price_per_sqm === 'number' ? Math.round(item.price_per_sqm).toLocaleString('ru-RU') : '';
  document.getElementById('modalPrice').innerHTML = `от <b>${price}</b> млн ₽ ${ppsqm ? `<span class="price-per-sqm">~${ppsqm} ₽/м²</span>` : ''}`;
  document.getElementById('modalMeta').innerHTML = `
    <div class="meta-row"><span>📍 ${escapeHtml(item.address) || ''}</span></div>
    <div class="meta-row"><span> ${escapeHtml(item.metro) || ''}</span></div>
    <div class="meta-row"><span>${escapeHtml(item.class) || ''} • ${escapeHtml(item.finishing) || ''}</span></div>
    <div class="meta-row"><span>${escapeHtml(item.completion_soonest || item.completion_all) || ''}</span></div>`;
  document.getElementById('modalDescription').textContent = item.description || 'Описание отсутствует';
  const featuresEl = document.getElementById('modalFeatures');
  featuresEl.innerHTML = item.features ? `<ul>${item.features.split(',').map(f => `<li>${escapeHtml(f.trim())}</li>`).join('')}</ul>` : '<p style="color:var(--text-secondary)">Информация уточняется</p>';
  const plansEl = document.getElementById('modalFloorPlans');
  plansEl.innerHTML = '';
  if (item.floor_plans_text) { const t = document.createElement('div'); t.className = 'floor-plans-text'; t.textContent = item.floor_plans_text; plansEl.appendChild(t); }
  if (item.floor_plans_images) { const g = document.createElement('div'); g.className = 'floor-plans-gallery'; item.floor_plans_images.split(',').map(u => u.trim()).filter(Boolean).forEach(url => { const img = document.createElement('img'); img.src = url; img.className = 'floor-plan-image'; img.onclick = () => window.open(url, '_blank'); g.appendChild(img); }); plansEl.appendChild(g); }
  if (!item.floor_plans_text && !item.floor_plans_images) plansEl.innerHTML = '<p style="color:var(--text-secondary)">Информация уточняется</p>';
  const gallery = document.getElementById('modalGallery');
  gallery.innerHTML = '';
  if (item.image_main) { const img = document.createElement('img'); img.src = item.image_main; img.className = 'modal-main-image'; gallery.appendChild(img); }
  if (item.images_gallery) { item.images_gallery.split(',').map(u => u.trim()).filter(Boolean).forEach(url => { const img = document.createElement('img'); img.src = url; img.className = 'modal-thumb'; img.onclick = () => window.open(url, '_blank'); gallery.appendChild(img); }); }
  let btn = document.getElementById('modalConsultBtn');
  if (!btn) { btn = document.createElement('button'); btn.id = 'modalConsultBtn'; btn.className = 'tg-btn modal-cta'; document.querySelector('#detailsModal .modal-content')?.appendChild(btn); }
  btn.textContent = ' Получить консультацию';
  btn.onclick = () => openConsultForm(id);
  document.getElementById('detailsModal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  showBack();
}

function closeModal() {  document.getElementById('detailsModal').classList.add('hidden');
  document.body.style.overflow = '';
  currentModalId = null;
  if (document.getElementById('mapContainer').classList.contains('hidden')) hideBack();
}

// === ФОРМА ЗАЯВКИ ===
function openConsultForm(id, e) {
  if (e) e.stopPropagation();
  currentModalId = id;
  const item = listings.find(l => l.id === id);
  if (!item) return;
  document.getElementById('consultObjectName').textContent = '🏢 ' + item.name;
  document.getElementById('consultName').value = '';
  document.getElementById('consultPhone').value = '+7 (';
  document.getElementById('consultModal').classList.remove('hidden');
  showBack();
}

function closeConsultModal() {
  document.getElementById('consultModal').classList.add('hidden');
  document.getElementById('consultForm')?.reset();
  if (document.getElementById('detailsModal').classList.contains('hidden') && document.getElementById('mapContainer').classList.contains('hidden')) hideBack();
}

function initPhoneMask() {
  const inp = document.getElementById('consultPhone');
  if (!inp) return;
  inp.addEventListener('input', function(e) {
    let x = e.target.value.replace(/\D/g, '').match(/(\d{0,1})(\d{0,3})(\d{0,3})(\d{0,2})(\d{0,2})/);
    if (!x) return;
    e.target.value = !x[2] ? '+7 (' : '+7 (' + x[2] + (x[3] ? ') ' + x[3] : '') + (x[4] ? '-' + x[4] : '') + (x[5] ? '-' + x[5] : '');
  });
  inp.addEventListener('focus', function(e) { if (e.target.value === '' || e.target.value === '+7 ') e.target.value = '+7 ('; });
}

function submitConsultForm(e) {
  e.preventDefault();
  const item = listings.find(l => l.id === currentModalId);
  if (!item) return;
  const name = document.getElementById('consultName').value.trim();
  const phone = document.getElementById('consultPhone').value.trim();
  if (name.length < 2) { tg?.showAlert('❌ Введите имя (мин. 2 символа)'); return; }
  if (phone.replace(/\D/g, '').length < 10) { tg?.showAlert('❌ Введите корректный номер телефона'); return; }
  const btn = e.target.querySelector('button[type="submit"]');
  const orig = btn.textContent;
  btn.textContent = 'Отправка...'; btn.disabled = true;
  fetch(GOOGLE_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },    body: JSON.stringify({ secret: SECRET_KEY, projectId: PROJECT_ID, title: item.name, price: typeof item.price_from === 'number' ? item.price_from : '', city: item.district || '', leadName: name, leadPhone: phone, leadTelegram: 'Не указан' })
  })
  .then(r => r.json())
  .then(d => { if (d.success) { closeConsultModal(); tg?.showAlert('✅ Заявка отправлена!'); e.target.reset(); } else throw new Error(d.error || 'Ошибка'); })
  .catch(err => tg?.showAlert('⚠️ ' + err.message))
  .finally(() => { btn.textContent = orig; btn.disabled = false; });
}

function escapeHtml(text) {
  if (!text) return '';
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
