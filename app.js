// === ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ===
let tg = null;
let config = {};
let listings = [];
let currentModalId = null;
let map = null;
let markers = [];

// === НАСТРОЙКИ ===
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxiuUMeslxZOUBC2Y4sg2QqJe_Iy5u8qA3WE7j3sWfuvWmzXz8P807FK9m7Q5YFiWs2/exec';
const SECRET_KEY = 'SecretParol999';
const PROJECT_ID = 'novozhilov';

// === ИНИЦИАЛИЗАЦИЯ TELEGRAM ===
try {
  if (window.Telegram && window.Telegram.WebApp) {
    tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();
  }
} catch (e) {
  console.log('TG Error', e);
}

if (!tg) {
  tg = {
    ready: function() {},
    expand: function() {},
    MainButton: { setText: function() {}, show: function() {}, hide: function() {} },
    showAlert: function(msg) { alert(msg); },
    openLink: function(url) { window.open(url, '_blank'); },
    close: function() {}
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
  const consult = document.getElementById('consultModal');
  const details = document.getElementById('detailsModal');
  const mapCont = document.getElementById('mapContainer');
  if (consult && !consult.classList.contains('hidden')) {
    closeConsultModal();
  } else if (details && !details.classList.contains('hidden')) {
    closeModal();
  } else if (mapCont && !mapCont.classList.contains('hidden')) {
    switchView('list');
  } else if (tg.close) {
    tg.close();
  }
}

function startApp() {
  const welcome = document.getElementById('welcomeScreen');
  const main = document.getElementById('mainContent');
 
  if (welcome) welcome.classList.add('hidden');
  if (main) main.classList.remove('hidden');
 
  window.scrollTo(0, 0);
  hideBack();
}

function switchView(view) {
  const listBtn = document.getElementById('listViewBtn');
  const mapBtn = document.getElementById('mapViewBtn');
  const listCont = document.getElementById('listingsContainer');
  const mapCont = document.getElementById('mapContainer');
 
  if (view === 'list') {
    if (listBtn) listBtn.classList.add('active');
    if (mapBtn) mapBtn.classList.remove('active');
    if (listCont) listCont.classList.remove('hidden');
    if (mapCont) mapCont.classList.add('hidden');
    hideBack();
  } else {
    if (listBtn) listBtn.classList.remove('active');
    if (mapBtn) mapBtn.classList.add('active');
    if (listCont) listCont.classList.add('hidden');
    if (mapCont) mapCont.classList.remove('hidden');
    showBack();
    setTimeout(initMap, 100);
  }
}

// === ГЛАВНАЯ ФУНКЦИЯ ===
async function init() {
  const loader = document.getElementById('loadingScreen');
  const welcome = document.getElementById('welcomeScreen');
  const main = document.getElementById('mainContent'); 
  try {
    const res = await fetch('config.json?v=' + Date.now());
    if (!res.ok) throw new Error('Config error');
    config = await res.json();
   
    if (config.data && config.data.sheetUrl) {
      listings = await loadFromGoogleSheets(config.data.sheetUrl);
      console.log('Objects:', listings.length);
    }
   
    applyTheme();
    applyBranding();
    initPhoneMask();
   
    if (loader) loader.classList.add('hidden');
    if (welcome) welcome.classList.remove('hidden');
    if (main) main.classList.add('hidden');
   
    renderListings(listings);
   
  } catch (err) {
    console.error(err);
    if (loader) loader.classList.add('hidden');
    if (welcome) welcome.classList.remove('hidden');
    if (main) main.classList.add('hidden');
  }
}

function applyTheme() {
  if (!config.brand) return;
  if (config.brand.primaryColor) document.documentElement.style.setProperty('--primary', config.brand.primaryColor);
  if (config.brand.accentColor) document.documentElement.style.setProperty('--accent', config.brand.accentColor);
}

function applyBranding() {
  if (!config.brand) return;
  const img = document.getElementById('welcomeImage');
  if (config.brand.welcomeImage && img) {
    img.src = config.brand.welcomeImage + '?v=' + Date.now();
    img.classList.remove('hidden');
  }
}

// === ЗАГРУЗКА ТАБЛИЦЫ ===
async function loadFromGoogleSheets(url) {
  let csvUrl = url.trim();
  csvUrl = csvUrl.replace('/pubhtml', '/pub').replace('/edit', '/pub');
  if (csvUrl.indexOf('output=csv') === -1) {
    csvUrl += (csvUrl.indexOf('?') !== -1 ? '&' : '?') + 'output=csv';  }
  const res = await fetch(csvUrl);
  if (!res.ok) throw new Error('Sheet Error');
  return parseCSV(await res.text());
}

function parseCSV(csv) {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = parseLine(lines[0]).map(h => h.trim());
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const vals = parseLine(line);
    const obj = {};
    headers.forEach((h, i) => {
      let v = vals[i] !== undefined ? vals[i].trim() : '';
      if (v === 'TRUE') v = true;
      else if (v === 'FALSE') v = false;
      else if (!isNaN(v) && v !== '') v = Number(v);
      obj[h] = v;
    });
    return obj;
  });
}

function parseLine(line) {
  const res = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQ = !inQ;
    else if (c === ',' && !inQ) { res.push(cur); cur = ''; }
    else cur += c;
  }
  res.push(cur);
  return res;
}

// === ОТРИСОВКА ===
function renderListings(data) {
  const cont = document.getElementById('listingsContainer');
  if (!cont) return;
  cont.innerHTML = '';
 
  if (!data || data.length === 0) {
    cont.innerHTML = '<div class="empty-state">Ничего не найдено</div>';
    return;
  }
 
  data.forEach(function(item, i) {    let price = '?';
    if (typeof item.price_from === 'number') {
      price = item.price_from < 1000 ? item.price_from.toFixed(1) : (item.price_from / 1000000).toFixed(1);
    }
    const ppsqm = typeof item.price_per_sqm === 'number' ? Math.round(item.price_per_sqm).toLocaleString('ru-RU') : '';
    const area = (typeof item.area_min === 'number' && typeof item.area_max === 'number') ? item.area_min + '–' + item.area_max + ' м²' : '';
   
    const card = document.createElement('div');
    card.className = 'listing-card';
    card.onclick = function() { openDetails(item.id); };
   
    card.innerHTML =
      '<img src="' + (item.image_main || '') + '" class="listing-image">' +
      '<div class="listing-info">' +
        '<h3>' + (item.name || '') + '</h3>' +
        '<div class="listing-meta">' +
          '<span>' + (item.district || '') + '</span>' +
          '<span> ' + (item.metro || '') + '</span>' +
        '</div>' +
        '<div class="listing-price">от ' + price + ' млн ₽</div>' +
        '<button class="tg-btn consult-btn-inline">Получить консультацию</button>' +
      '</div>';
     
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
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
  }
  updateMarkers(listings);
  setTimeout(function() { map.invalidateSize(); }, 150);
}

function updateMarkers(items) {
  if (!map) return;
  markers.forEach(m => map.removeLayer(m));
  markers = [];
  items.forEach(item => {
    if (!item.lat || !item.lng) return;
    const m = L.marker([item.lat, item.lng]).addTo(map).bindPopup(item.name);
    markers.push(m);
  });
  if (markers.length) map.fitBounds(new L.featureGroup(markers).getBounds().pad(0.1));}

// === ДЕТАЛИ ===
function openDetails(id) {
  const item = listings.find(l => l.id === id);
  if (!item) return;
  currentModalId = id;
 
  document.getElementById('modalTitle').textContent = item.name || '';
  document.getElementById('modalDescription').textContent = item.description || '';
 
  document.getElementById('detailsModal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  showBack();
}

function closeModal() {
  document.getElementById('detailsModal').classList.add('hidden');
  document.body.style.overflow = '';
  currentModalId = null;
  hideBack();
}

// === ФОРМА ===
function openConsultForm(id) {
  currentModalId = id;
  const item = listings.find(l => l.id === id);
  document.getElementById('consultObjectName').textContent = '🏢 ' + (item ? item.name : '');
  document.getElementById('consultName').value = '';
  document.getElementById('consultPhone').value = '+7 (';
  document.getElementById('consultModal').classList.remove('hidden');
  showBack();
}

function closeConsultModal() {
  document.getElementById('consultModal').classList.add('hidden');
  document.getElementById('consultForm').reset();
  hideBack();
}

function initPhoneMask() {
  const inp = document.getElementById('consultPhone');
  if (!inp) return;
  inp.addEventListener('input', function(e) {
    let x = e.target.value.replace(/\D/g, '').match(/(\d{0,1})(\d{0,3})(\d{0,3})(\d{0,2})(\d{0,2})/);
    if (!x) return;
    e.target.value = !x[2] ? '+7 (' : '+7 (' + x[2] + (x[3] ? ') ' + x[3] : '') + (x[4] ? '-' + x[4] : '') + (x[5] ? '-' + x[5] : '');
  });
}
function submitConsultForm(e) {
  e.preventDefault();
  const name = document.getElementById('consultName').value;
  const phone = document.getElementById('consultPhone').value;
  if (name.length < 2) { tg.showAlert('Введите имя'); return; }
  if (phone.length < 16) { tg.showAlert('Введите телефон'); return; }
 
  tg.showAlert('Заявка отправлена!');
  closeConsultModal();
}

// === ЗАПУСК ===
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
