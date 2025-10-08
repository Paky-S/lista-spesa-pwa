// --- Mini helper IndexedDB ---
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
    const store = tx.objectStore(STORE);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function dbPut(item) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const req = store.put(item);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function dbDelete(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// --- UI logic ---
const listEl = document.getElementById('list');
const formEl = document.getElementById('add-form');
const inputEl = document.getElementById('new-item');

function uuid() {
  if (crypto && crypto.randomUUID) return crypto.randomUUID();
  // fallback semplice
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

async function render() {
  const items = await dbGetAll();
  listEl.innerHTML = '';
  for (const it of items) {
    const li = document.createElement('li');
    if (it.done) li.classList.add('done');

    const textBtn = document.createElement('button');
    textBtn.className = 'text-btn';
    textBtn.textContent = it.text;
    textBtn.title = 'Segna fatto/da fare';
    textBtn.onclick = async () => {
      it.done = !it.done;
      await dbPut(it);
      render();
    };

    const delBtn = document.createElement('button');
    delBtn.className = 'del-btn';
    delBtn.textContent = '🗑️';
    delBtn.title = 'Elimina';
    delBtn.onclick = async () => {
      await dbDelete(it.id);
      render();
    };

    li.appendChild(textBtn);
    li.appendChild(delBtn);
    listEl.appendChild(li);
  }
}

formEl.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = inputEl.value.trim();
  if (!text) return;
  const item = { id: uuid(), text, done: false };
  await dbPut(item);
  inputEl.value = '';
  render();
});

// Primo render
render();
