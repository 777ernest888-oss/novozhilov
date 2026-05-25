console.log(" Проект Новожилов запущен!");

// 🔗 ДАННЫЕ ПРОЕКТА (ВСТАВЬ СЮДА ID СВОЕЙ ТАБЛИЦЫ НОВОЖИЛОВА)
const SHEET_ID = '1RB6hp-9RbQ0hwXZHR79bihxXRT4l7QHZ9ZJWedDpcLA';
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`;

// 🔐 НАСТРОЙКИ БЕЗОПАСНОСТИ
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxiuUMeslxZOUBC2Y4sg2QqJe_Iy5u8qA3WE7j3sWfuvWmzXz8P807FK9m7Q5YFiWs2/exec';
const SECRET_KEY = 'SecretParol999';

let allObjects = [];
let currentModalId = null;

async function loadObjects() {
  try {
    const response = await fetch(SHEET_URL);
    const text = await response.text();
    const lines = text.trim().split('\n');
    const rows = lines.slice(1);
   
    allObjects = rows.map(row => {
      const cols = row.split(',');
      return {
        id: cols[0]?.trim() || '',
        title: cols[1]?.trim() || 'Объект',
        price: parseFloat(cols[2]?.trim()) || 0,
        city: cols[3]?.trim() || '',
        photo: cols[4]?.trim() || '',
        description: cols[5]?.trim() || 'Описание отсутствует'
      };
    }).filter(obj => obj.id);

    renderList(allObjects);
    document.getElementById('loadingScreen').classList.add('hidden');
    document.getElementById('welcomeScreen').classList.remove('hidden');
  } catch (e) {
    alert("Ошибка загрузки: " + e.message);
    document.getElementById('loadingScreen').classList.add('hidden');
  }
}

function startApp() {
  document.getElementById('welcomeScreen').classList.add('hidden');
  document.getElementById('mainScreen').classList.remove('hidden');
  renderList(allObjects);
}

function renderList(objects) {
  const container = document.getElementById('objectsList');
  if (!container) return;  if (objects.length === 0) {
    container.innerHTML = '<p style="text-align:center; padding:40px;">Нет объектов</p>';
    return;
  }

  container.innerHTML = objects.map(obj => `
    <div class="card" onclick="openModal('${obj.id}')">
      <img src="${obj.photo || 'placeholder.jpg'}" class="card-img" alt="${obj.title}">
      <div class="card-body">
        <h3>${obj.title}</h3>
        <div class="card-price">${obj.price.toLocaleString('ru-RU')} ₽</div>
        <div class="card-meta"><span>📍 ${obj.city}</span></div>
        <button class="card-btn">Подробнее</button>
      </div>
    </div>`
  ).join('');
}

function openModal(id) {
  currentModalId = id;
  const obj = allObjects.find(o => o.id === id);
  if (!obj) return;

  document.getElementById('modalImg').src = obj.photo || 'placeholder.jpg';
  document.getElementById('modalTitle').textContent = obj.title;
  document.getElementById('modalPrice').textContent = `${obj.price.toLocaleString('ru-RU')} ₽`;
  document.getElementById('modalYield').innerHTML = `<div>📍 <b>Город:</b> ${obj.city || 'Не указан'}</div>`;
  document.getElementById('modalDesc').textContent = obj.description;
 
  document.getElementById('objectDetails').classList.remove('hidden');
  document.getElementById('modalActions').classList.remove('hidden');
  document.getElementById('leadForm').classList.add('hidden');
  document.getElementById('leadName').value = '';
  document.getElementById('leadPhone').value = '';
  document.getElementById('leadTelegram').value = '';

  document.getElementById('modalOverlay').classList.remove('hidden');
}

function closeModal(e) {
  if (!e || e.target.id === 'modalOverlay') document.getElementById('modalOverlay').classList.add('hidden');
}

function openLeadForm() {
  document.getElementById('objectDetails').classList.add('hidden');
  document.getElementById('modalActions').classList.add('hidden');
  document.getElementById('leadForm').classList.remove('hidden');
}

function cancelLead() {  document.getElementById('objectDetails').classList.remove('hidden');
  document.getElementById('modalActions').classList.remove('hidden');
  document.getElementById('leadForm').classList.add('hidden');
}

// 📞 МАСКА ТЕЛЕФОНА
document.getElementById('leadPhone')?.addEventListener('input', function(e) {
  let val = e.target.value.replace(/\D/g, '');
  if (val.length > 15) val = val.slice(0, 15);
  let formatted = val;
  if (val.startsWith('7')) {
    formatted = '+7';
    if (val.length > 1) formatted += ' (' + val.slice(1, 4);
    if (val.length >= 5) formatted += ') ' + val.slice(4, 7);
    if (val.length >= 8) formatted += '-' + val.slice(7, 9);
    if (val.length >= 10) formatted += '-' + val.slice(9, 11);
  } else if (val.startsWith('375')) {
    formatted = '+375';
    if (val.length > 3) formatted += ' (' + val.slice(3, 5);
    if (val.length >= 6) formatted += ') ' + val.slice(5, 8);
    if (val.length >= 9) formatted += '-' + val.slice(8, 10);
    if (val.length >= 11) formatted += '-' + val.slice(10, 12);
  } else if (val.length > 0) {
    formatted = '+' + val;
  }
  e.target.value = formatted;
});

// 🚀 ОТПРАВКА ЗАЯВКИ
async function submitLead() {
  const obj = allObjects.find(o => o.id === currentModalId);
  if (!obj) return;

  const name = document.getElementById('leadName').value.trim();
  const phone = document.getElementById('leadPhone').value.trim();
  let telegram = document.getElementById('leadTelegram').value.trim();
  const phoneDigits = phone.replace(/\D/g, '');

  if (!name || name.length < 2) { alert('❌ Введите имя (мин. 2 символа)'); return; }
  if (phoneDigits.length < 10 || phoneDigits.length > 15) { alert('❌ Введите корректный телефон (10–15 цифр)'); return; }

  if (telegram) {
    if (/[а-яА-ЯёЁ]/.test(telegram)) { alert('❌ Telegram не должен содержать кириллицу'); return; }
    if (!/^@?[a-zA-Z0-9_]{3,32}$/.test(telegram)) { alert('❌ Неверный формат Telegram'); return; }
    if (!telegram.startsWith('@')) telegram = '@' + telegram;
  }

  const btn = document.getElementById('submitLeadBtn');
  btn.textContent = 'Отправка...'; btn.disabled = true;
  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        secret: SECRET_KEY,
        projectId: 'novozhilov',
        title: obj.title,
        price: obj.price.toLocaleString('ru-RU'),
        city: obj.city,
        leadName: name,
        leadPhone: phone,
        leadTelegram: telegram || 'Не указан'
      })
    });
    const result = await response.json();
    if (result.success) { alert('✅ Заявка отправлена!'); closeModal(); }
    else { alert('❌ Ошибка: ' + result.error); }
  } catch (e) { alert(' Ошибка сети: ' + e.message); }
  finally { btn.textContent = 'Отправить заявку'; btn.disabled = false; }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadObjects); else loadObjects();
