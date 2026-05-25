// ... (начало файла без изменений: tg, config, listings, map...)

// === НАСТРОЙКИ БЕЗОПАСНОЙ ОТПРАВКИ ===
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxiuUMeslxZOUBC2Y4sg2QqJe_Iy5u8qA3WE7j3sWfuvWmzXz8P807FK9m7Q5YFiWs2/exec';
const SECRET_KEY = 'SecretParol999'; // Тот же, что в Code.gs
const PROJECT_ID = 'novozhilov'; // ← Важно для бэкенда!

// ... (навигация, запуск, инициализация — без изменений) ...

// === ФОРМА: безопасная отправка через общий скрипт ===
function submitConsultForm(e) {
  e.preventDefault();
  const item = listings.find(l => l.id === currentModalId);
  if (!item) return;

  const name = document.getElementById('consultName').value.trim();
  const phone = document.getElementById('consultPhone').value.trim();
 
  // Валидация
  if (name.length < 2) { tg?.showAlert('❌ Введите имя (мин. 2 символа)'); return; }
  if (phone.replace(/\D/g,'').length < 10) { tg?.showAlert('❌ Введите корректный телефон'); return; }

  const btn = e.target.querySelector('button[type="submit"]');
  const orig = btn.textContent;
  btn.textContent = 'Отправка...'; btn.disabled = true;

  // Отправка на ОБЩИЙ скрипт
  fetch(GOOGLE_SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify({
      secret: SECRET_KEY,           // ← Проверка на бэкенде
      projectId: PROJECT_ID,        // ← 'novozhilov' для маршрутизации
      title: item.name,
      price: typeof item.price_from==='number' ? item.price_from : '',
      city: item.district || '',
      leadName: name,
      leadPhone: phone,
      leadTelegram: 'Не указан'     // Можно добавить поле, если нужно
    })
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) {
      closeConsultModal();
      tg?.showAlert('✅ Заявка отправлена!');
      e.target.reset();
    } else {
      throw new Error(d.error || 'Ошибка');
    }
  })
  .catch(err => tg?.showAlert('⚠️ ' + err.message))
  .finally(() => { btn.textContent = orig; btn.disabled = false; });
}

// ... (остальной код: escapeHtml, init — без изменений) ...
