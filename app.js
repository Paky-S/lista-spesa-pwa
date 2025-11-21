// app.js

// ======================
//  IndexedDB
// ======================

const DB_NAME = 'lista_spesa_db';
const TODO_STORE = 'todos';
const LIST_STORE = 'lists';
const VERSION = 2; // versione schema: TODO + LISTE

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

// Action sheet
const sheetEl = document.getElementById('list-action-sheet');
const sheetBackdropEl = document.getElementById('list-action-sheet-backdrop');
const sheetTitleEl = document.getElementById('sheet-title');
const sheetRenameBtn = document.getElementById('sheet-rename-btn');
const sheetDuplicateBtn = document.getElementById('sheet-duplicate-btn');
const sheetDeleteBtn = document.getElementById('sheet-delete-btn');
const sheetCancelBtn = document.getElementById('sheet-cancel-btn');

// Limite cifre quantità
const MAX_QTY_DIGITS = 10;

let currentListId = null;
let listsCache = [];
let sheetList = null;
let sheetCanDelete = false;

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

// Evidenzia la lista attiva senza ricreare tutta la sidebar
function highlightActiveList() {
  const buttons = listsContainerEl.querySelectorAll('.list-pill');
  buttons.forEach(btn => {
    if (btn.dataset.id === currentListId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
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
  highlightActiveList();
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

    // click singolo = seleziona lista (NON chiude sidebar, NON ricrea sidebar)
    // doppio click/tap (entro soglia) = pannello comandi
    let clickTimeoutId = null;
    const dblClickThreshold = 280; // ms

    btn.addEventListener('click', () => {
      if (clickTimeoutId !== null) {
        // secondo click entro la soglia → doppio click
        clearTimeout(clickTimeoutId);
        clickTimeoutId = null;
        handleListAction(l);
        return;
      }

      // primo click → aspettiamo un attimo per vedere se arriva il secondo
      clickTimeoutId = setTimeout(() => {
        clickTimeoutId = null;
        // singolo click: seleziona lista
        currentListId = l.id;
        highlightActiveList();
        updateCurrentListLabel();
        render();
      }, dblClickThreshold);
    });

    listsContainerEl.appendChild(btn);
  });
}

// ======================
//  Action sheet gestione lista
// ======================

function openListActionSheet(list, canDelete) {
  sheetList = list;
  sheetCanDelete = !!canDelete;

  if (sheetTitleEl) {
    sheetTitleEl.textContent = `Lista: "${list.name}"`;
  }

  if (sheetCanDelete) {
    sheetDeleteBtn.classList.remove('disabled');
    sheetDeleteBtn.disabled = false;
  } else {
    sheetDeleteBtn.classList.add('disabled');
    sheetDeleteBtn.disabled = true;
  }

  sheetEl.classList.add('open');
  sheetBackdropEl.classList.add('open');
}

function closeListActionSheet() {
  sheetEl.classList.remove('open');
  sheetBackdropEl.classList.remove('open');
  sheetList = null;
  sheetCanDelete = false;
}

function handleListAction(list) {
  const isOnlyList = (listsCache.length === 1 && list.id === currentListId);
  const canDelete = !isOnlyList;
  openListActionSheet(list, canDelete);
}

sheetBackdropEl.addEventListener('click', closeListActionSheet);
sheetCancelBtn.addEventListener('click', closeListActionSheet);

sheetRenameBtn.addEventListener('click', async () => {
  if (!sheetList) return;
  const target = sheetList;
  closeListActionSheet();
  await renameList(target);
});

sheetDuplicateBtn.addEventListener('click', async () => {
  if (!sheetList) return;
  const target = sheetList;
  closeListActionSheet();
  await duplicateList(target);
});

sheetDeleteBtn.addEventListener('click', async () => {
  if (!sheetList) return;
  if (!sheetCanDelete) {
    window.alert('Non puoi eliminare l’unica lista. Crea prima un’altra lista oppure rinomina questa.');
    return;
  }
  const target = sheetList;
  closeListActionSheet();
  await deleteListFlow(target);
});

async function renameList(list) {
  const nuovo = (window.prompt('Nuovo nome per la lista:', list.name) || '').trim();
  if (!nuovo || nuovo === list.name) return;
  list.name = nuovo;
  await dbPutList(list);
  await loadLists();
  highlightActiveList();
  updateCurrentListLabel();
  render();
}

async function duplicateList(list) {
  const defaultName = list.name + ' (copia)';
  const nuovoNome = (window.prompt('Nome per la copia della lista:', defaultName) || '').trim();
  if (!nuovoNome) return;

  const newList = {
    id: uuid(),
    name: nuovoNome,
    createdAt: Date.now()
  };
  await dbPutList(newList);

  const allTodos = await dbGetAllTodos();
  const sourceTodos = allTodos.filter(t => t.listId === list.id);

  for (const t of sourceTodos) {
    const clone = {
      id: uuid(),
      listId: newList.id,
      text: t.text,
      done: false,
      qty: t.qty,
      unit: t.unit
    };
    await dbPutTodo(clone);
  }

  await loadLists();
  currentListId = newList.id;
  highlightActiveList();
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

  const allTodos = await dbGetAllTodos();
  const toDelete = allTodos.filter(t => t.listId === list.id);
  for (const t of toDelete) {
    await dbDeleteTodo(t.id);
  }

  await dbDeleteList(list.id);

  await loadLists();
  const cur = getCurrentList();
  if (!cur && listsCache.length > 0) {
    currentListId = listsCache[0].id;
  }
  highlightActiveList();
  updateCurrentListLabel();
  render();
}

// ======================
//  Sidebar open/close
// ======================

function openSidebar() {
  sidebarEl.classList.add('open');
  sidebarBackdropEl.classList.add('open');

  // evidenzia sempre la lista attiva
  highlightActiveList();

  // se la lista attiva è fuori vista, scrolla fino a lei
  const active = listsContainerEl.querySelector('.list-pill.active');
  if (active) {
    active.scrollIntoView({ block: 'nearest' });
  }
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

  // aggiorna conteggi nelle "pillole" lista
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
