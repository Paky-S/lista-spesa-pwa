// app.js

// ======================
//  IndexedDB
// ======================

const DB_NAME = 'lista_spesa_db';
const TODO_STORE = 'todos';
const LIST_STORE = 'lists';
const VERSION = 2; // versione schema DB per le liste

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(TODO_STORE)) {
        db.createObjectStore(TODO_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(LIST_STORE)) {
        db.createObjectStore(LIST_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ---- Operazioni TODO ----
async function dbGetAllTodos() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TODO_STORE, 'readonly');
    const req = tx.objectStore(TODO_STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function dbPutTodo(item) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TODO_STORE, 'readwrite');
    tx.objectStore(TODO_STORE).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbDeleteTodo(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TODO_STORE, 'readwrite');
    tx.objectStore(TODO_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---- Operazioni LISTE ----
async function dbGetAllLists() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LIST_STORE, 'readonly');
    const req = tx.objectStore(LIST_STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function dbPutList(list) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LIST_STORE, 'readwrite');
    tx.objectStore(LIST_STORE).put(list);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbDeleteList(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LIST_STORE, 'readwrite');
    tx.objectStore(LIST_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbCountTodosForList(listId) {
  const all = await dbGetAllTodos();
  return all.filter(t => t.listId === listId).length;
}

// ======================
//  Stato UI
// ======================

const listEl = document.getElementById('list');
const formEl = document.getElementById('add-form');
const inputEl = document.getElementById('new-item');
const qtyEl = document.getElementById('qty');
const unitEl = document.getElementById('unit');
const countEl = document.getElementById('count');
const currentListNameEl = document.getElementById('current-list-name');

// Sidebar
const sidebarEl = document.getElementById('sidebar');
const sidebarBackdropEl = document.getElementById('sidebar-backdrop');
const sidebarToggleEl = document.getElementById('sidebar-toggle');
const sidebarCloseEl = document.getElementById('sidebar-close');
const listsContainerEl = document.getElementById('lists-container');
const addListBtn = document.getElementById('add-list-btn');

// Limite cifre quantità
const MAX_QTY_DIGITS = 10;

let currentListId = null;
let listsCache = [];

// Action sheet per le liste
let actionMenuRoot = null;
let actionMenuTitleEl = null;
let actionMenuRenameBtn = null;
let actionMenuDeleteBtn = null;
let actionMenuCancelBtn = null;
let actionMenuCurrentList = null;

// ======================
//  Helpers
// ======================

function uuid() {
  if (crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

function sanitizeQtyInput(raw) {
  let out = '';
  let digits = 0;
  let hasSep = false;
  for (const ch of (raw || '').replace(/\s+/g, '')) {
    if (/\d/.test(ch)) {
      if (digits < MAX_QTY_DIGITS) {
        out += ch;
        digits++;
      }
    } else if ((ch === '.' || ch === ',') && !hasSep) {
      out += ch;
      hasSep = true;
    }
  }
  return out;
}

qtyEl.addEventListener('input', (e) => {
  const val = e.target.value;
  const san = sanitizeQtyInput(val);
  if (san !== val) {
    const pos = e.target.selectionStart;
    e.target.value = san;
    try {
      const delta = val.length - san.length;
      const newPos = pos - delta;
      e.target.setSelectionRange(newPos, newPos);
    } catch {}
  }
});

function fmtMeta(item) {
  const q = (item.qty ?? '').toString().trim();
  const u = (item.unit ?? '').toString().trim();
  if (!q && !u) return '';
  if (q && u) return `${q} ${u}`;
  if (q) return q;
  return u;
}

function getCurrentList() {
  return listsCache.find(l => l.id === currentListId) || null;
}

// ======================
//  Action sheet per liste
// ======================

function ensureActionMenu() {
  if (actionMenuRoot) return;

  const backdrop = document.createElement('div');
  backdrop.className = 'action-menu-backdrop';

  const menu = document.createElement('div');
  menu.className = 'action-menu';

  const title = document.createElement('p');
  title.className = 'action-menu-title';

  const btnRename = document.createElement('button');
  btnRename.className = 'action-btn';
  btnRename.textContent = 'Rinomina';

  const btnDelete = document.createElement('button');
  btnDelete.className = 'action-btn danger';
  btnDelete.textContent = 'Elimina';

  const btnCancel = document.createElement('button');
  btnCancel.className = 'action-btn cancel';
  btnCancel.textContent = 'Annulla';

  menu.appendChild(title);
  menu.appendChild(btnRename);
  menu.appendChild(btnDelete);
  menu.appendChild(btnCancel);

  backdrop.appendChild(menu);
  document.body.appendChild(backdrop);

  actionMenuRoot = backdrop;
  actionMenuTitleEl = title;
  actionMenuRenameBtn = btnRename;
  actionMenuDeleteBtn = btnDelete;
  actionMenuCancelBtn = btnCancel;

  // chiusura cliccando fuori
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) {
      closeActionMenu();
    }
  });
}

function openListActionMenu(list) {
  ensureActionMenu();
  actionMenuCurrentList = list;
  actionMenuTitleEl.textContent = `Lista: "${list.name}"`;

  // se è l'unica lista, non permettiamo Elimina
  if (listsCache.length === 1 && list.id === currentListId) {
    actionMenuDeleteBtn.disabled = true;
    actionMenuDeleteBtn.classList.add('disabled');
  } else {
    actionMenuDeleteBtn.disabled = false;
    actionMenuDeleteBtn.classList.remove('disabled');
  }

  actionMenuRenameBtn.onclick = async () => {
    const l = actionMenuCurrentList;
    closeActionMenu();
    if (l) await renameList(l);
  };

  actionMenuDeleteBtn.onclick = async () => {
    const l = actionMenuCurrentList;
    closeActionMenu();
    if (l && !actionMenuDeleteBtn.disabled) {
      await deleteListFlow(l);
    }
  };

  actionMenuCancelBtn.onclick = () => {
    closeActionMenu();
  };

  actionMenuRoot.classList.add('open');
}

function closeActionMenu() {
  if (!actionMenuRoot) return;
  actionMenuRoot.classList.remove('open');
  actionMenuCurrentList = null;
}

// ======================
//  Liste: init e UI
// ======================

async function ensureDefaultList() {
  const lists = await dbGetAllLists();
  if (lists.length === 0) {
    const def = {
      id: uuid(),
      name: 'Lista principale',
      createdAt: Date.now()
    };
    await dbPutList(def);
  }
}

async function loadLists() {
  let lists = await dbGetAllLists();
  if (!lists || lists.length === 0) {
    await ensureDefaultList();
    lists = await dbGetAllLists();
  }
  lists.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  listsCache = lists;
  if (!currentListId || !listsCache.find(l => l.id === currentListId)) {
    currentListId = listsCache[0].id;
  }
  updateListsSidebarUI();
  updateCurrentListLabel();
}

async function createNewList() {
  const name = (window.prompt('Nome nuova lista (es. Lidl, Ferramenta, Decathlon):') || '').trim();
  if (!name) return;
  const list = { id: uuid(), name, createdAt: Date.now() };
  await dbPutList(list);
  await loadLists();
  currentListId = list.id;
  updateListsSidebarUI();
  updateCurrentListLabel();
  render();
}

function updateCurrentListLabel() {
  const cur = getCurrentList();
  if (currentListNameEl) {
    currentListNameEl.textContent = cur ? cur.name : '';
  }
}

function updateListsSidebarUI() {
  listsContainerEl.innerHTML = '';
  const all = listsCache.slice();
  if (all.length === 0) return;

  all.forEach((l) => {
    const btn = document.createElement('button');
    btn.className = 'list-pill';
    if (l.id === currentListId) btn.classList.add('active');
    btn.dataset.id = l.id;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'name';
    nameSpan.textContent = l.name;

    const countSpan = document.createElement('span');
    countSpan.className = 'count';
    countSpan.textContent = '';

    btn.appendChild(nameSpan);
    btn.appendChild(countSpan);

    // click normale → seleziona lista
    btn.addEventListener('click', () => {
      if (btn._longPressHandled) {
        btn._longPressHandled = false;
        return;
      }
      currentListId = l.id;
      updateListsSidebarUI();
      updateCurrentListLabel();
      closeSidebar();
      render();
    });

    // tasto destro → menù azioni
    btn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      handleListAction(l);
    });

    // long press mobile
    let pressTimer = null;
    const startPress = () => {
      if (pressTimer) clearTimeout(pressTimer);
      pressTimer = setTimeout(() => {
        btn._longPressHandled = true;
        handleListAction(l);
      }, 600);
    };
    const cancelPress = () => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    };
    btn.addEventListener('touchstart', startPress);
    btn.addEventListener('touchend', cancelPress);
    btn.addEventListener('touchmove', cancelPress);
    btn.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      startPress();
    });
    btn.addEventListener('mouseup', cancelPress);
    btn.addEventListener('mouseleave', cancelPress);

    listsContainerEl.appendChild(btn);
  });
}

function handleListAction(list) {
  // ora non chiediamo più "r/e": apriamo l'action sheet
  openListActionMenu(list);
}

async function renameList(list) {
  const nuovo = (window.prompt('Nuovo nome per la lista:', list.name) || '').trim();
  if (!nuovo || nuovo === list.name) return;
  list.name = nuovo;
  await dbPutList(list);
  await loadLists();
  updateCurrentListLabel();
  render();
}

async function deleteListFlow(list) {
  const count = await dbCountTodosForList(list.id);
  if (count > 0) {
    const ok = window.confirm(
      `La lista "${list.name}" contiene ${count} elementi.\nVuoi eliminarla comunque insieme ai suoi elementi?`
    );
    if (!ok) return;
  }

  // elimina tutti i todo della lista
  const allTodos = await dbGetAllTodos();
  const toDelete = allTodos.filter(t => t.listId === list.id);
  for (const t of toDelete) {
    await dbDeleteTodo(t.id);
  }

  // elimina lista
  await dbDeleteList(list.id);

  // ricarica liste e scegli nuova lista corrente
  await loadLists();
  const cur = getCurrentList();
  if (!cur && listsCache.length > 0) {
    currentListId = listsCache[0].id;
  }
  updateCurrentListLabel();
  render();
}

// ======================
//  Sidebar open/close
// ======================

function openSidebar() {
  sidebarEl.classList.add('open');
  sidebarBackdropEl.classList.add('open');
}

function closeSidebar() {
  sidebarEl.classList.remove('open');
  sidebarBackdropEl.classList.remove('open');
}

sidebarToggleEl.addEventListener('click', openSidebar);
sidebarCloseEl.addEventListener('click', closeSidebar);
sidebarBackdropEl.addEventListener('click', closeSidebar);
addListBtn.addEventListener('click', createNewList);

// ======================
//  Render lista TODO
// ======================

async function render() {
  const allItems = await dbGetAllTodos();
  const items = allItems.filter(t => t.listId === currentListId);
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
      await dbPutTodo(it);
      render();
    };

    const actions = document.createElement('div');
    actions.className = 'actions';
    const delBtn = document.createElement('button');
    delBtn.className = 'icon-btn';
    delBtn.setAttribute('aria-label', 'Elimina');
    delBtn.textContent = '🗑️';
    delBtn.onclick = async () => {
      await dbDeleteTodo(it.id);
      render();
    };
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

  // aggiorna conteggi nelle pill delle liste
  const sidebarButtons = listsContainerEl.querySelectorAll('.list-pill');
  sidebarButtons.forEach(btn => {
    const id = btn.dataset.id;
    const cnt = allItems.filter(t => t.listId === id).length;
    const spanCount = btn.querySelector('.count');
    if (spanCount) {
      spanCount.textContent = cnt ? String(cnt) : '';
    }
  });
}

// ======================
//  Form submit
// ======================

formEl.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = (inputEl.value || '').trim();
  const qty = sanitizeQtyInput(qtyEl.value || '').trim();
  const unit = (unitEl.value || '').trim();
  if (!text) return;

  const item = {
    id: uuid(),
    listId: currentListId,
    text,
    done: false
  };
  if (qty) item.qty = qty.replace(',', '.');
  if (unit) item.unit = unit;

  await dbPutTodo(item);
  inputEl.value = '';
  qtyEl.value = '';
  unitEl.value = '';
  render();
});

// ======================
//  Init
// ======================

(async function init() {
  await ensureDefaultList();
  await loadLists();
  await render();
})();
d