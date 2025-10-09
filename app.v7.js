// IndexedDB
const DB_NAME = 'lista_spesa_db';
const STORE = 'todos';
const VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function dbGetAll() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}
async function dbPut(item) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function dbDelete(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// UI
const listEl = document.getElementById('list');
const formEl = document.getElementById('add-form');
const inputEl = document.getElementById('new-item');
const qtyEl = document.getElementById('qty');
const unitEl = document.getElementById('unit');
const countEl = document.getElementById('count');

function uuid() {
  if (crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}
function fmtMeta(item) {
  const q = (item.qty ?? '').toString().trim();
  const u = (item.unit ?? '').toString().trim();
  if (!q && !u) return '';
  if (q && u) return `${q} ${u}`;
  if (q) return q;
  return u;
}

async function render() {
  const items = await dbGetAll();
  items.sort((a, b) => (a.done === b.done) ? 0 : (a.done ? 1 : -1));
  listEl.innerHTML = '';
  countEl.textContent = String(items.length);

  for (const it of items) {
    const li = document.createElement('li');
    if (it.done) li.classList.add('done');

    const rowTop = document.createElement('div');
    rowTop.className = 'row-top';

    const textBtn = document.createElement('button');
    textBtn.className = 'text-btn';
    textBtn.textContent = it.text || '(senza nome)';
    textBtn.title = 'Segna fatto/da fare';
    textBtn.onclick = async () => {
      it.done = !it.done;
      await dbPut(it);
      render();
    };

    const actions = document.createElement('div');
    actions.className = 'actions';
    const delBtn = document.createElement('button');
    delBtn.className = 'icon-btn';
    delBtn.setAttribute('aria-label', 'Elimina');
    delBtn.textContent = '🗑️';
    delBtn.onclick = async () => { await dbDelete(it.id); render(); };
    actions.appendChild(delBtn);

    rowTop.appendChild(textBtn);
    rowTop.appendChild(actions);

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = fmtMeta(it);

    li.appendChild(rowTop);
    if (meta.textContent) li.appendChild(meta);
    listEl.appendChild(li);
  }
}

formEl.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = (inputEl.value || '').trim();
  const qty = (qtyEl.value || '').trim();
  const unit = (unitEl.value || '').trim();
  if (!text) return;

  const item = { id: uuid(), text, done: false };
  if (qty) item.qty = qty;
  if (unit) item.unit = unit;

  await dbPut(item);
  inputEl.value = '';
  qtyEl.value = '';
  unitEl.value = '';
  render();
});

render();
