'use strict';

const FB_CONFIG = {
  apiKey: 'AIzaSyDpXNCiPUmfpJ6aqKNfj8mTQZelUw5GWnU',
  authDomain: 'gomez-hub.firebaseapp.com',
  databaseURL: 'https://gomez-hub-default-rtdb.firebaseio.com',
  projectId: 'gomez-hub',
  storageBucket: 'gomez-hub.firebasestorage.app',
  messagingSenderId: '684386720371',
  appId: '1:684386720371:web:2226277faca5269c28a806'
};

const DATA_PATH = 'aurea/v1/data';
const PIN_PATH = 'aurea/v1/config/pinHash';
const LOCAL_KEY = 'aurea_data_v1';
const PIN_KEY = 'aurea_pin_hash_v1';

const AUREA_BRAND_PROMPT = `Dirección artística de catálogo premium para AUREA, una marca colombiana de manillas artesanales. Inspiración visual: fotografía vertical elegante, cálida y romántica; paleta champaña, crema, rosa empolvado, negro profundo y dorado; telas satinadas, lino fino, fibras naturales y flores secas muy sutiles; iluminación editorial suave con destellos dorados controlados; profundidad de campo delicada; producto protagonista, nítido y realista. La escena debe sentirse artesanal, femenina, amorosa, sofisticada y lista para Instagram o WhatsApp. Conservar exactamente la forma, colores, cantidades, orden y materiales de la manilla de referencia. No añadir ni quitar balines, dijes, hilos o accesorios. No generar letras, logotipos, marcas de agua, números, sellos ni iconos. Dejar espacio visual limpio en la parte superior y en la parte inferior para que Aurea coloque después su identidad, beneficios y WhatsApp sin cubrir el producto.`;

const DEFAULT_SETTINGS = {
  packaging: 5000,
  labor: 15000,
  wastePct: 5,
  marginMin: 35,
  marginRec: 45,
  marginPremium: 55,
  roundTo: 1000,
  lowStock: 5,
  aiModel: 'gpt-5.6',
  aiQuality: 'medium',
  aiSize: '1024x1536',
  aiTheme: 'champagne',
  aiBrandPrompt: AUREA_BRAND_PROMPT,
  aiHeadline: 'Detalles que hablan de ti',
  aiCaption: 'Una joya especial para un momento inolvidable.',
  aiWhatsapp: '324 234 3363',
  aiBenefits: 'Hechas a mano|Materiales de alta calidad|Duraderas y resistentes',
  aiStyleReferences: []
};

const DEFAULT_MATERIALS = [
  ['italiano-3', 'Balinería italiana', 'Balín', '3 mm', 1800],
  ['italiano-4', 'Balinería italiana', 'Balín', '4 mm', 2500],
  ['italiano-5', 'Balinería italiana', 'Balín', '5 mm', 4500],
  ['lisa-3', 'Balín liso', 'Balín', '3 mm', 1600],
  ['lisa-4', 'Balín liso', 'Balín', '4 mm', 2200],
  ['lisa-5', 'Balín liso', 'Balín', '5 mm', 3900],
  ['lisa-6', 'Balín liso', 'Balín', '6 mm', 5000],
  ['lisa-8', 'Balín liso', 'Balín', '8 mm', 9000],
  ['diamantada-3', 'Balinería diamantada', 'Balín', '3 mm', 2000],
  ['diamantada-4', 'Balinería diamantada', 'Balín', '4 mm', 2500],
  ['diamantada-5', 'Balinería diamantada', 'Balín', '5 mm', 4700],
  ['diamantada-6', 'Balinería diamantada', 'Balín', '6 mm', 6400],
  ['diamantada-8', 'Balinería diamantada', 'Balín', '8 mm', 9000],
  ['neopreno-6', 'Neopreno argollado', 'Neopreno', '6 mm', 3000],
  ['neopreno-8', 'Neopreno argollado', 'Neopreno', '8 mm', 3500],
  ['balinx-6', 'Balín X', 'Balín', '6 mm', 5000],
  ['balinx-8', 'Balín X', 'Balín', '8 mm', 7200]
].map(([id, name, category, size, cost]) => ({
  id, name, category, size, cost, stock: 0, minStock: 5, active: true, createdAt: Date.now()
}));

let S = {
  settings: { ...DEFAULT_SETTINGS },
  materials: DEFAULT_MATERIALS,
  designs: [],
  sales: [],
  purchases: [],
  movements: [],
  customers: [],
  expenses: []
};

let db = null;
let functionsClient = null;
let saving = false;
let saveTimer = null;
let deferredInstall = null;
let currentComponents = [];
let currentImageData = '';
let currentProductImageData = '';
let currentAIResponseId = '';
let currentAIVersions = [];
let currentAIChat = [];
let currentAIVersionId = '';
let aiRequestInFlight = false;
let aiRequestSequence = 0;
let editingMaterialId = null;
let editingDesignId = null;
let editingSaleId = null;
let editingCustomerId = null;
let editingExpenseId = null;
let editingPurchaseId = null;

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const money = value => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0
}).format(Number(value) || 0);
const number = value => Number(value) || 0;
const uid = prefix => `${prefix || 'id'}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const roundUp = (value, step) => Math.ceil(number(value) / Math.max(1, number(step))) * Math.max(1, number(step));
const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[char]));
const dateText = value => {
  if (!value) return 'Sin fecha';
  const d = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('es-CO');
};

function toast(message) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(element._timer);
  element._timer = setTimeout(() => element.classList.remove('show'), 2500);
}

function setSync(mode, text) {
  const element = $('#sync');
  element.className = `sync ${mode || ''}`;
  $('#sync-text').textContent = text;
}

function normalizeState(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const settings = { ...DEFAULT_SETTINGS, ...(source.settings || {}) };
  if (!String(settings.aiModel || '').startsWith('gpt-5.6')) settings.aiModel = 'gpt-5.6';
  settings.aiStyleReferences = Array.isArray(settings.aiStyleReferences) ? settings.aiStyleReferences.slice(0, 4) : [];
  return {
    settings,
    materials: Array.isArray(source.materials) && source.materials.length ? source.materials : DEFAULT_MATERIALS,
    designs: Array.isArray(source.designs) ? source.designs : [],
    sales: Array.isArray(source.sales) ? source.sales : [],
    purchases: Array.isArray(source.purchases) ? source.purchases : [],
    movements: Array.isArray(source.movements) ? source.movements : [],
    customers: Array.isArray(source.customers) ? source.customers : [],
    expenses: Array.isArray(source.expenses) ? source.expenses : []
  };
}

function loadLocal() {
  try {
    const raw = JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null');
    if (raw) S = normalizeState(raw);
  } catch (error) {
    console.warn('No fue posible leer datos locales:', error);
  }
}

function saveLocalState() {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(S));
    return true;
  } catch (error) {
    console.warn('No fue posible guardar todos los datos en este dispositivo:', error);
    setSync('error', 'Sin espacio local');
    return false;
  }
}

function persist() {
  const savedLocally = saveLocalState();
  if (!savedLocally) toast('El dispositivo no tiene espacio para guardar más fotos');
  renderAll();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    if (!db) return;
    try {
      saving = true;
      setSync('', 'Guardando');
      await db.ref(DATA_PATH).set(S);
      setSync('online', 'Sincronizado');
    } catch (error) {
      setSync('error', 'Solo local');
      console.warn('Error guardando en Firebase:', error);
    } finally {
      saving = false;
    }
  }, 350);
}

async function initFirebase() {
  if (typeof firebase === 'undefined') {
    $('#auth-screen')?.classList.add('hidden');
    setSync('error', 'Solo local');
    return true;
  }
  let signedInUser = null;
  try {
    if (!firebase.apps.length) firebase.initializeApp(FB_CONFIG);
    if (firebase.functions) functionsClient = firebase.app().functions('us-central1');
    if (firebase.auth) {
      const auth = firebase.auth();
      signedInUser = await new Promise(resolve => {
        let unsubscribe = () => {};
        unsubscribe = auth.onAuthStateChanged(user => {
          unsubscribe();
          resolve(user || null);
        }, () => resolve(null));
      });
    }
    if (!signedInUser) {
      $('#auth-screen')?.classList.remove('hidden');
      setSync('error', 'Inicia sesión');
      return false;
    }

    $('#auth-screen')?.classList.add('hidden');
    if ($('#connected-account')) $('#connected-account').textContent = signedInUser.email || 'Cuenta de Google';
    db = firebase.database();
    const snapshot = await Promise.race([
      db.ref(DATA_PATH).once('value'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5500))
    ]);
    if (snapshot.exists()) S = normalizeState(snapshot.val());
    else await db.ref(DATA_PATH).set(S);
    saveLocalState();
    setSync('online', 'Sincronizado');
    db.ref(DATA_PATH).on('value', snap => {
      if (saving || !snap.exists()) return;
      S = normalizeState(snap.val());
      saveLocalState();
      renderAll();
    });
    return true;
  } catch (error) {
    if (signedInUser) $('#auth-screen')?.classList.add('hidden');
    setSync('error', 'Solo local');
    console.warn('Firebase:', error);
    return Boolean(signedInUser);
  }
}

async function signInWithGoogle() {
  if (typeof firebase === 'undefined' || !firebase.auth) {
    $('#auth-help').textContent = 'Firebase Authentication no está disponible.';
    $('#auth-help').classList.add('error');
    return;
  }
  const button = $('#google-signin-btn');
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = 'Abriendo Google…';
  $('#auth-help').classList.remove('error');
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await firebase.auth().signInWithPopup(provider);
    location.reload();
  } catch (error) {
    console.warn('Ingreso con Google:', error);
    $('#auth-help').textContent = error?.code === 'auth/unauthorized-domain'
      ? 'Debes autorizar este dominio en Firebase Authentication.'
      : 'No fue posible ingresar. Revisa la cuenta autorizada e inténtalo de nuevo.';
    $('#auth-help').classList.add('error');
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

async function signOutGoogle() {
  if (typeof firebase !== 'undefined' && firebase.auth) await firebase.auth().signOut();
  sessionStorage.removeItem('aurea_unlocked');
  location.reload();
}

async function hashPIN(pin) {
  const raw = `aurea_pin_salt_v1:${pin}`;
  if (crypto?.subtle) {
    const data = new TextEncoder().encode(raw);
    const buffer = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(buffer)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) hash = ((hash << 5) - hash) + raw.charCodeAt(i) | 0;
  return `fallback_${Math.abs(hash)}`;
}

let pinBuffer = '';
let pinMode = 'check';
let firstPinHash = '';
let pinAttempts = 0;
let lockedUntil = Number(localStorage.getItem('aurea_locked_until') || 0);

async function initPIN() {
  let remoteHash = null;
  let remoteKnown = false;
  if (typeof firebase !== 'undefined') {
    try {
      if (!firebase.apps.length) firebase.initializeApp(FB_CONFIG);
      db = db || firebase.database();
      const snapshot = await Promise.race([
        db.ref(PIN_PATH).once('value'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000))
      ]);
      remoteKnown = true;
      remoteHash = snapshot.val() || null;
    } catch (error) {
      console.warn('PIN remoto:', error);
    }
  }
  const localHash = localStorage.getItem(PIN_KEY);
  if (remoteHash) {
    localStorage.setItem(PIN_KEY, remoteHash);
    pinMode = 'check';
    $('#pin-sub').textContent = 'Ingresa tu PIN de 4 dígitos';
  } else if (remoteKnown && !remoteHash) {
    pinMode = 'setup1';
    $('#pin-sub').textContent = 'Crea tu PIN de 4 dígitos';
  } else if (localHash) {
    pinMode = 'check';
    $('#pin-sub').textContent = 'Modo sin conexión · ingresa tu PIN';
  } else {
    pinMode = 'setup1';
    $('#pin-sub').textContent = 'Crea tu PIN de 4 dígitos';
  }
  updatePinLock();
}

function updatePinLock() {
  const remaining = lockedUntil - Date.now();
  if (remaining > 0) {
    $('#pin-hint').textContent = `Bloqueado por ${Math.ceil(remaining / 1000)} segundos`;
    $$('[data-pin], #pin-del').forEach(button => { button.disabled = true; });
    setTimeout(updatePinLock, 1000);
  } else {
    $$('[data-pin], #pin-del').forEach(button => { button.disabled = false; });
    if ($('#pin-hint').textContent.startsWith('Bloqueado')) $('#pin-hint').textContent = '';
  }
}

function drawPin(error = false) {
  $$('.pin-dot').forEach((dot, index) => {
    dot.className = `pin-dot${index < pinBuffer.length ? (error ? ' error' : ' filled') : ''}`;
  });
}

async function verifyPin() {
  const hash = await hashPIN(pinBuffer);
  if (pinMode === 'setup1') {
    firstPinHash = hash;
    pinBuffer = '';
    drawPin();
    pinMode = 'setup2';
    $('#pin-sub').textContent = 'Confirma tu PIN';
    return;
  }
  if (pinMode === 'setup2') {
    if (hash !== firstPinHash) {
      pinError('Los PIN no coinciden');
      pinMode = 'setup1';
      $('#pin-sub').textContent = 'Crea tu PIN de 4 dígitos';
      return;
    }
    await savePinHash(hash);
    unlock();
    return;
  }
  if (hash === localStorage.getItem(PIN_KEY)) {
    pinAttempts = 0;
    unlock();
  } else {
    pinAttempts += 1;
    if (pinAttempts >= 5) {
      lockedUntil = Date.now() + 30000;
      localStorage.setItem('aurea_locked_until', String(lockedUntil));
      pinAttempts = 0;
      pinBuffer = '';
      drawPin();
      updatePinLock();
    } else pinError('PIN incorrecto');
  }
}

async function savePinHash(hash) {
  localStorage.setItem(PIN_KEY, hash);
  if (db) {
    try { await db.ref(PIN_PATH).set(hash); } catch (error) { console.warn(error); }
  }
}

function pinError(message) {
  drawPin(true);
  $('#pin-hint').textContent = message;
  setTimeout(() => {
    pinBuffer = '';
    drawPin();
    $('#pin-hint').textContent = '';
  }, 850);
}

function unlock() {
  pinBuffer = '';
  drawPin();
  $('#pin-screen').classList.add('hidden');
  sessionStorage.setItem('aurea_unlocked', '1');
}

function lock() {
  sessionStorage.removeItem('aurea_unlocked');
  $('#pin-screen').classList.remove('hidden');
  pinMode = localStorage.getItem(PIN_KEY) ? 'check' : 'setup1';
  $('#pin-sub').textContent = pinMode === 'check' ? 'Ingresa tu PIN de 4 dígitos' : 'Crea tu PIN de 4 dígitos';
}

function showView(name, tab = '') {
  $$('.view').forEach(view => view.classList.toggle('active', view.id === `view-${name}`));
  $$('.nav-btn').forEach(button => button.classList.toggle('active', button.dataset.view === name));
  if (name === 'management' && tab) showManagementTab(tab);
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (name === 'designer') renderDesigner();
  if (name === 'management') renderManagement();
}

function showManagementTab(name) {
  $$('.tab').forEach(tab => tab.classList.toggle('active', tab.dataset.mtab === name));
  $$('.management-panel').forEach(panel => panel.classList.toggle('active', panel.id === `panel-${name}`));
  renderManagement();
}

function renderAll() {
  renderDashboard();
  renderInventory();
  renderDesigner();
  renderSales();
  renderManagement();
}

function activeSales() {
  return S.sales.filter(sale => sale.status !== 'Cancelada');
}

function isCurrentMonth(value) {
  const date = new Date(value || Date.now());
  const now = new Date();
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

function renderDashboard() {
  const sales = activeSales().filter(sale => isCurrentMonth(sale.date || sale.createdAt));
  const expenses = S.expenses.filter(expense => expense.active !== false && isCurrentMonth(expense.date || expense.createdAt));
  const revenue = sales.reduce((sum, sale) => sum + number(sale.price), 0);
  const grossProfit = sales.reduce((sum, sale) => sum + number(sale.profit), 0);
  const expenseTotal = expenses.reduce((sum, expense) => sum + number(expense.amount), 0);
  const inventoryValue = S.materials.reduce((sum, material) => sum + number(material.stock) * number(material.cost), 0);
  const units = S.materials.reduce((sum, material) => sum + number(material.stock), 0);
  const low = S.materials.filter(material => material.active !== false && number(material.stock) <= number(material.minStock ?? S.settings.lowStock)).length;

  $('#stat-sales').textContent = money(revenue);
  $('#stat-profit').textContent = money(grossProfit);
  $('#stat-expenses').textContent = money(expenseTotal);
  $('#stat-net').textContent = money(grossProfit - expenseTotal);
  $('#stat-inventory').textContent = money(inventoryValue);
  $('#stat-units').textContent = `${units} unidades`;
  $('#stat-low').textContent = String(low);
  $('#stat-sales-count').textContent = `${sales.length} venta${sales.length === 1 ? '' : 's'}`;

  const recent = [...S.sales].sort((a, b) => number(b.createdAt) - number(a.createdAt)).slice(0, 4);
  $('#recent-sales').innerHTML = recent.length
    ? recent.map(sale => saleCard(sale, false)).join('')
    : '<div class="card empty"><b>Aún no hay ventas</b>Registra la primera venta para ver tus resultados.</div>';
}

function getMaterial(id) { return S.materials.find(material => material.id === id); }
function getDesign(id) { return S.designs.find(design => design.id === id); }
function getCustomer(id) { return S.customers.find(customer => customer.id === id); }

function materialIsUsed(id) {
  return S.designs.some(design => (design.components || []).some(component => component.materialId === id)) ||
    S.purchases.some(purchase => purchase.materialId === id);
}

function renderInventory() {
  const search = ($('#material-search')?.value || '').toLowerCase();
  const category = $('#material-category')?.value || '';
  const status = $('#material-status')?.value || 'active';
  const list = S.materials.filter(material => {
    const matchesSearch = `${material.name} ${material.size} ${material.category}`.toLowerCase().includes(search);
    const matchesCategory = !category || material.category === category;
    const matchesStatus = status === 'all' || (status === 'active' ? material.active !== false : material.active === false);
    return matchesSearch && matchesCategory && matchesStatus;
  }).sort((a, b) => String(a.category).localeCompare(String(b.category)) || String(a.name).localeCompare(String(b.name)) || String(a.size).localeCompare(String(b.size)));

  $('#material-list').innerHTML = list.length ? list.map(material => {
    const low = material.active !== false && number(material.stock) <= number(material.minStock ?? S.settings.lowStock);
    const iconClass = material.category === 'Neopreno' ? 'neopreno' : material.category === 'Dije' ? 'dije' : '';
    return `<article class="material ${material.active === false ? 'inactive' : ''}">
      <div class="material-icon ${iconClass}"></div>
      <div><div class="material-name">${esc(material.name)} · ${esc(material.size || '')}</div><div class="material-meta">${esc(material.category)} · Costo ${money(material.cost)} c/u ${material.active === false ? '· Inactivo' : ''}</div></div>
      <div class="stock ${low ? 'low' : ''}"><b>${number(material.stock)}</b><span>unidades</span></div>
      <div class="material-actions">
        ${material.active !== false ? `<button class="btn btn-soft btn-sm" onclick="openPurchase('${material.id}')">＋ Compra</button>` : ''}
        <button class="btn btn-outline btn-sm" onclick="openMaterial('${material.id}')">Editar</button>
        <button class="btn ${material.active === false ? 'btn-soft' : 'btn-danger'} btn-sm" onclick="toggleMaterial('${material.id}')">${material.active === false ? 'Activar' : 'Desactivar'}</button>
      </div>
    </article>`;
  }).join('') : '<div class="card empty"><b>No hay resultados</b>Cambia el filtro o registra un material.</div>';
  renderMaterialSelects();
}

function renderMaterialSelects() {
  const select = $('#component-material');
  if (!select) return;
  const current = select.value;
  const materials = S.materials.filter(material => material.active !== false).sort((a, b) => String(a.name).localeCompare(String(b.name)));
  select.innerHTML = materials.map(material => `<option value="${material.id}">${esc(material.name)} ${esc(material.size || '')} · ${money(material.cost)}</option>`).join('');
  if (materials.some(material => material.id === current)) select.value = current;
}

function openModal(html) {
  $('#modal').innerHTML = html;
  $('#modal-backdrop').classList.remove('hidden');
}

function closeModal() {
  $('#modal-backdrop').classList.add('hidden');
  $('#modal').innerHTML = '';
}

function openMaterial(id = '') {
  editingMaterialId = id || null;
  const material = id ? getMaterial(id) : { name: '', category: 'Dije', size: '', cost: 0, stock: 0, minStock: 5, active: true };
  openModal(`<div class="modal-head"><h3>${id ? 'Editar' : 'Nuevo'} material</h3><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="form-grid two">
      <div class="field"><label>Nombre</label><input class="input" id="m-name" value="${esc(material.name)}"></div>
      <div class="field"><label>Categoría</label><select class="input" id="m-category">${['Balín', 'Neopreno', 'Dije', 'Hilo', 'Empaque', 'Otro'].map(item => `<option ${material.category === item ? 'selected' : ''}>${item}</option>`).join('')}</select></div>
      <div class="field"><label>Tamaño / referencia</label><input class="input" id="m-size" value="${esc(material.size || '')}" placeholder="Ej. 6 mm"></div>
      <div class="field"><label>Costo unitario</label><input class="input" id="m-cost" type="number" min="0" value="${number(material.cost)}"></div>
      <div class="field"><label>Stock actual</label><input class="input" id="m-stock" type="number" min="0" value="${number(material.stock)}"></div>
      <div class="field"><label>Stock mínimo</label><input class="input" id="m-min" type="number" min="0" value="${number(material.minStock ?? 5)}"></div>
    </div>
    <div class="modal-actions">
      ${id && !materialIsUsed(id) && number(material.stock) === 0 ? `<button class="btn btn-danger" onclick="deleteMaterial('${id}')">Eliminar</button>` : ''}
      <button class="btn btn-outline" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="saveMaterial()">Guardar</button>
    </div>`);
}

function saveMaterial() {
  const name = $('#m-name').value.trim();
  const cost = number($('#m-cost').value);
  const stock = number($('#m-stock').value);
  if (!name || cost < 0 || stock < 0) { toast('Revisa el nombre, costo y stock'); return; }
  if (editingMaterialId) {
    const material = getMaterial(editingMaterialId);
    const oldStock = number(material.stock);
    Object.assign(material, {
      name,
      category: $('#m-category').value,
      size: $('#m-size').value.trim(),
      cost,
      stock,
      minStock: number($('#m-min').value),
      updatedAt: Date.now()
    });
    if (oldStock !== stock) S.movements.push({ id: uid('mov'), materialId: material.id, materialName: material.name, type: 'Ajuste manual', qty: stock - oldStock, date: new Date().toISOString(), createdAt: Date.now() });
  } else {
    S.materials.push({
      id: uid('mat'), name, category: $('#m-category').value, size: $('#m-size').value.trim(),
      cost, stock, minStock: number($('#m-min').value), active: true, createdAt: Date.now()
    });
  }
  closeModal();
  persist();
  toast('Material guardado');
}

function toggleMaterial(id) {
  const material = getMaterial(id);
  if (!material) return;
  material.active = material.active === false;
  material.updatedAt = Date.now();
  persist();
  toast(material.active ? 'Material activado' : 'Material desactivado');
}

function deleteMaterial(id) {
  const material = getMaterial(id);
  if (!material || materialIsUsed(id) || number(material.stock) !== 0) { toast('Este material no se puede eliminar; desactívalo'); return; }
  if (!confirm(`¿Eliminar definitivamente ${material.name}?`)) return;
  S.materials = S.materials.filter(item => item.id !== id);
  closeModal();
  persist();
  toast('Material eliminado');
}

function openPurchase(materialId = '', purchaseId = '') {
  editingPurchaseId = purchaseId || null;
  const purchase = purchaseId ? S.purchases.find(item => item.id === purchaseId) : null;
  const activeMaterials = S.materials.filter(material => material.active !== false);
  if (!activeMaterials.length) { toast('No hay materiales activos'); return; }
  const selectedId = purchase?.materialId || materialId || activeMaterials[0].id;
  const material = getMaterial(selectedId);

  if (purchase) {
    openModal(`<div class="modal-head"><h3>Editar compra</h3><button class="modal-close" onclick="closeModal()">×</button></div>
      <div class="warning">Por trazabilidad, cantidad y valores no se editan. Para reversar inventario usa “Anular compra”.</div>
      <div class="form-grid two" style="margin-top:12px">
        <div class="field"><label>Material</label><input class="input" disabled value="${esc(purchase.materialName)}"></div>
        <div class="field"><label>Cantidad</label><input class="input" disabled value="${number(purchase.qty)}"></div>
        <div class="field"><label>Proveedor</label><input class="input" id="p-provider" value="${esc(purchase.provider || '')}"></div>
        <div class="field"><label>Fecha</label><input class="input" id="p-date" type="date" value="${esc((purchase.date || '').slice(0, 10))}"></div>
        <div class="field full"><label>Notas</label><textarea class="input" id="p-notes">${esc(purchase.notes || '')}</textarea></div>
      </div>
      <div class="modal-actions"><button class="btn btn-outline" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="savePurchase()">Guardar cambios</button></div>`);
    return;
  }

  openModal(`<div class="modal-head"><h3>Registrar compra</h3><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="form-grid two">
      <div class="field full"><label>Material</label><select class="input" id="p-material">${activeMaterials.map(item => `<option value="${item.id}" ${item.id === selectedId ? 'selected' : ''}>${esc(item.name)} ${esc(item.size || '')}</option>`).join('')}</select></div>
      <div class="field"><label>Cantidad comprada</label><input class="input" id="p-qty" type="number" min="1" value="12"></div>
      <div class="field"><label>Valor total materiales</label><input class="input" id="p-total" type="number" min="0" value="${number(material.cost) * 12}"></div>
      <div class="field"><label>Envío asignado</label><input class="input" id="p-shipping" type="number" min="0" value="0"></div>
      <div class="field"><label>Proveedor</label><input class="input" id="p-provider" value="Beads Market Co."></div>
      <div class="field"><label>Fecha</label><input class="input" id="p-date" type="date" value="${new Date().toISOString().slice(0, 10)}"></div>
      <div class="field full"><label>Notas</label><textarea class="input" id="p-notes" placeholder="Factura, referencia o detalle"></textarea></div>
    </div>
    <div class="help" id="p-preview" style="margin-top:12px"></div>
    <div class="modal-actions"><button class="btn btn-outline" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="savePurchase()">Registrar</button></div>`);

  const updatePurchasePreview = () => {
    const qty = number($('#p-qty').value);
    const total = number($('#p-total').value);
    const shipping = number($('#p-shipping').value);
    $('#p-preview').textContent = qty ? `Nuevo lote: ${money((total + shipping) / qty)} por unidad. Se calculará costo promedio.` : '';
  };
  ['#p-qty', '#p-total', '#p-shipping'].forEach(selector => { $(selector).oninput = updatePurchasePreview; });
  $('#p-material').onchange = () => {
    const selected = getMaterial($('#p-material').value);
    $('#p-total').value = number(selected?.cost) * number($('#p-qty').value || 12);
    updatePurchasePreview();
  };
  updatePurchasePreview();
}

function savePurchase() {
  if (editingPurchaseId) {
    const purchase = S.purchases.find(item => item.id === editingPurchaseId);
    if (!purchase) return;
    purchase.provider = $('#p-provider').value.trim();
    purchase.date = $('#p-date').value;
    purchase.notes = $('#p-notes').value.trim();
    purchase.updatedAt = Date.now();
    closeModal();
    persist();
    toast('Compra actualizada');
    return;
  }

  const materialId = $('#p-material').value;
  const material = getMaterial(materialId);
  const qty = number($('#p-qty').value);
  const total = number($('#p-total').value);
  const shipping = number($('#p-shipping').value);
  if (!material || qty <= 0 || total < 0 || shipping < 0) { toast('Cantidad o valor inválido'); return; }

  const oldStock = number(material.stock);
  const oldCost = number(material.cost);
  const oldValue = oldStock * oldCost;
  const unitCost = (total + shipping) / qty;
  material.cost = (oldValue + total + shipping) / (oldStock + qty);
  material.stock = oldStock + qty;
  material.updatedAt = Date.now();

  const purchase = {
    id: uid('buy'), materialId, materialName: material.name, materialSize: material.size || '', qty,
    total, shipping, unitCost, previousCost: oldCost, previousStock: oldStock,
    provider: $('#p-provider').value.trim(), date: $('#p-date').value,
    notes: $('#p-notes').value.trim(), status: 'Activa', createdAt: Date.now()
  };
  S.purchases.push(purchase);
  S.movements.push({ id: uid('mov'), materialId, materialName: material.name, type: 'Compra', qty, cost: unitCost, date: purchase.date, createdAt: Date.now() });
  closeModal();
  persist();
  toast('Compra registrada y stock actualizado');
}

function annulPurchase(id) {
  const purchase = S.purchases.find(item => item.id === id);
  const material = purchase ? getMaterial(purchase.materialId) : null;
  if (!purchase || !material || purchase.status === 'Anulada') return;
  if (number(material.stock) < number(purchase.qty)) { toast('No hay stock suficiente para reversar esta compra'); return; }
  if (!confirm('¿Anular esta compra y descontar sus unidades del inventario?')) return;

  const currentStock = number(material.stock);
  const currentValue = currentStock * number(material.cost);
  const reversalValue = number(purchase.total) + number(purchase.shipping);
  const newStock = currentStock - number(purchase.qty);
  material.stock = newStock;
  material.cost = newStock > 0 ? Math.max(0, (currentValue - reversalValue) / newStock) : number(purchase.previousCost || material.cost);
  material.updatedAt = Date.now();
  purchase.status = 'Anulada';
  purchase.annulledAt = Date.now();
  S.movements.push({ id: uid('mov'), materialId: material.id, materialName: material.name, type: 'Anulación compra', qty: -number(purchase.qty), date: new Date().toISOString(), createdAt: Date.now() });
  persist();
  toast('Compra anulada');
}

function priceData() {
  const materials = currentComponents.reduce((sum, component) => {
    const material = getMaterial(component.materialId);
    return sum + number(material?.cost) * number(component.qty);
  }, 0);
  const waste = materials * number(S.settings.wastePct) / 100;
  const labor = number(S.settings.labor);
  const packaging = number(S.settings.packaging);
  const total = materials + waste + labor + packaging;
  const calculate = margin => roundUp(total / Math.max(0.05, 1 - number(margin) / 100), S.settings.roundTo);
  return {
    materials, waste, labor, packaging, total,
    min: calculate(S.settings.marginMin),
    rec: calculate(S.settings.marginRec),
    premium: calculate(S.settings.marginPremium)
  };
}

function addComponent() {
  const materialId = $('#component-material').value;
  const qty = Math.max(1, number($('#component-qty').value));
  if (!materialId) { toast('Selecciona un material'); return; }
  const existing = currentComponents.find(component => component.materialId === materialId);
  if (existing) existing.qty += qty;
  else currentComponents.push({ materialId, qty });
  $('#component-qty').value = 1;
  renderDesigner();
}

function changeComponentQty(materialId, delta) {
  const component = currentComponents.find(item => item.materialId === materialId);
  if (!component) return;
  component.qty = Math.max(1, number(component.qty) + delta);
  renderDesigner();
}

function removeComponent(materialId) {
  currentComponents = currentComponents.filter(component => component.materialId !== materialId);
  renderDesigner();
}

function renderDesigner() {
  renderMaterialSelects();
  const componentList = $('#component-list');
  if (!componentList) return;

  componentList.innerHTML = currentComponents.length ? currentComponents.map(component => {
    const material = getMaterial(component.materialId);
    if (!material) return '';
    return `<div class="component-row">
      <div><div class="name">${esc(material.name)} ${esc(material.size || '')}</div><div class="meta">${money(material.cost)} por unidad · stock ${number(material.stock)}</div></div>
      <div class="qty-editor"><button onclick="changeComponentQty('${material.id}',-1)">−</button><span>${number(component.qty)}</span><button onclick="changeComponentQty('${material.id}',1)">＋</button></div>
      <div class="money">${money(number(material.cost) * number(component.qty))}</div>
      <button class="remove" onclick="removeComponent('${material.id}')">×</button>
    </div>`;
  }).join('') : '<div class="empty" style="padding:16px"><b>Agrega los materiales</b>Ejemplo: balines, neoprenos y dijes.</div>';

  const beads = [];
  currentComponents.forEach(component => {
    const material = getMaterial(component.materialId);
    if (!material) return;
    for (let index = 0; index < Math.min(number(component.qty), 14) && beads.length < 32; index += 1) {
      const mm = parseInt(material.size, 10) || 6;
      const size = Math.max(13, Math.min(30, mm * 3));
      const className = material.category === 'Neopreno' ? 'neopreno' : material.category === 'Dije' ? 'dije' : '';
      beads.push(`<span class="bead ${className}" title="${esc(material.name)}" style="width:${size}px;height:${size}px"></span>`);
    }
  });
  $('#bracelet-line').innerHTML = beads.length ? beads.join('') : '<span style="color:#9f8871;font-size:12px">El boceto aparecerá aquí</span>';

  const productWrap = $('#product-reference-wrap');
  if (currentProductImageData) {
    $('#product-reference-preview').src = currentProductImageData;
    productWrap.classList.remove('hidden');
    $('#remove-product-image-btn').classList.remove('hidden');
  } else {
    $('#product-reference-preview').removeAttribute('src');
    productWrap.classList.add('hidden');
    $('#remove-product-image-btn').classList.add('hidden');
  }

  const styleCount = (S.settings.aiStyleReferences || []).length;
  $('#ai-style-summary').textContent = styleCount
    ? `${styleCount} referencia${styleCount === 1 ? '' : 's'} visual${styleCount === 1 ? '' : 'es'} guardada${styleCount === 1 ? '' : 's'} para la marca.`
    : 'Usará la identidad champaña, rosa y negro dorado guardada en el prompt.';

  const imageWrap = $('#design-image-wrap');
  if (currentImageData) {
    $('#design-image-preview').src = currentImageData;
    imageWrap.classList.remove('hidden');
  } else {
    $('#design-image-preview').removeAttribute('src');
    imageWrap.classList.add('hidden');
  }

  renderPosterBrand();
  renderAIVersions();
  renderAIChat();

  const prices = priceData();
  const rows = currentComponents.map(component => {
    const material = getMaterial(component.materialId);
    return material ? `<tr><td>${esc(material.name)} ${esc(material.size || '')}</td><td>${number(component.qty)}</td><td>${money(material.cost)}</td><td>${money(number(material.cost) * number(component.qty))}</td></tr>` : '';
  }).join('');
  $('#cost-lines').innerHTML = rows || '<tr><td colspan="4" style="text-align:center;color:var(--muted)">Sin materiales</td></tr>';
  $('#cost-totals').innerHTML = `<tr><td colspan="3">Materiales</td><td>${money(prices.materials)}</td></tr>
    <tr><td colspan="3">Desperdicio (${number(S.settings.wastePct)}%)</td><td>${money(prices.waste)}</td></tr>
    <tr><td colspan="3">Mano de obra</td><td>${money(prices.labor)}</td></tr>
    <tr><td colspan="3">Empaque y presentación</td><td>${money(prices.packaging)}</td></tr>
    <tr><td colspan="3">Costo total</td><td>${money(prices.total)}</td></tr>`;
  $('#price-min').textContent = money(prices.min);
  $('#price-rec').textContent = money(prices.rec);
  $('#price-premium').textContent = money(prices.premium);

  const saved = $('#saved-designs');
  const selected = saved.value;
  const activeDesigns = S.designs.filter(design => design.active !== false).sort((a, b) => number(b.updatedAt || b.createdAt) - number(a.updatedAt || a.createdAt));
  saved.innerHTML = '<option value="">Seleccionar diseño...</option>' + activeDesigns.map(design => `<option value="${design.id}">${esc(design.name)} · ${money(design.priceRec)}</option>`).join('');
  if (activeDesigns.some(design => design.id === editingDesignId)) saved.value = editingDesignId;
  else if (activeDesigns.some(design => design.id === selected)) saved.value = selected;

  $('#save-design-btn').textContent = editingDesignId ? 'Actualizar' : 'Guardar';
  $('#edit-design-actions').classList.toggle('hidden', !editingDesignId);
}

function brandBenefits() {
  return String(S.settings.aiBenefits || DEFAULT_SETTINGS.aiBenefits)
    .split('|')
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function renderPosterBrand() {
  const poster = $('#aurea-poster-preview');
  if (!poster) return;
  const format = S.settings.aiSize === '1024x1024'
    ? 'square'
    : S.settings.aiSize === '1536x1024' ? 'horizontal' : 'vertical';
  poster.className = `aurea-poster theme-${S.settings.aiTheme || 'champagne'} format-${format}`;
  $('#poster-headline').textContent = S.settings.aiHeadline || DEFAULT_SETTINGS.aiHeadline;
  $('#poster-caption').textContent = S.settings.aiCaption || DEFAULT_SETTINGS.aiCaption;
  $('#poster-whatsapp').textContent = S.settings.aiWhatsapp || DEFAULT_SETTINGS.aiWhatsapp;
  $('#poster-benefits').innerHTML = brandBenefits().map(item => `<div class="poster-benefit">${esc(item)}</div>`).join('');
}

function renderAIVersions() {
  const wrap = $('#ai-versions-wrap');
  const strip = $('#ai-version-strip');
  if (!wrap || !strip) return;
  wrap.classList.toggle('hidden', currentAIVersions.length === 0);
  strip.innerHTML = currentAIVersions.map((version, index) => `
    <button class="ai-version ${version.imageUrl === currentImageData ? 'active' : ''}" type="button" onclick="selectAIVersion(${index})" title="${esc(version.instruction || `Versión ${index + 1}`)}">
      <img src="${esc(version.imageUrl)}" alt="Versión ${index + 1}">
      <span>V${index + 1}</span>
    </button>`).join('');
}

function renderAIChat() {
  const chat = $('#ai-chat');
  const messages = $('#ai-chat-messages');
  if (!chat || !messages) return;
  chat.classList.toggle('hidden', !currentImageData);
  messages.innerHTML = currentAIChat.length ? currentAIChat.map(message => `
    <div class="ai-message ${message.role === 'user' ? 'user' : 'assistant'}">${esc(message.text)}</div>`).join('') :
    '<div class="ai-message assistant">La primera versión está lista. Dime qué quieres cambiar y conservaré el contexto del diseño.</div>';
  messages.scrollTop = messages.scrollHeight;
}

function resetDesign() {
  editingDesignId = null;
  currentComponents = [];
  currentImageData = '';
  currentProductImageData = '';
  currentAIResponseId = '';
  currentAIVersions = [];
  currentAIChat = [];
  currentAIVersionId = '';
  $('#design-name').value = '';
  $('#thread-color').value = 'Negro';
  $('#design-notes').value = '';
  $('#saved-designs').value = '';
  renderDesigner();
}

function saveDesign(options = {}) {
  const silent = options?.silent === true;
  const name = $('#design-name').value.trim();
  if (!name || (!currentComponents.length && !currentProductImageData && !currentImageData)) {
    if (!silent) toast('Agrega nombre y materiales o una foto');
    return false;
  }
  const prices = priceData();
  const payload = {
    name,
    threadColor: $('#thread-color').value,
    notes: $('#design-notes').value.trim(),
    imageData: currentImageData || '',
    productImageData: currentProductImageData || '',
    aiResponseId: currentAIResponseId || '',
    aiVersions: currentAIVersions.slice(-8),
    aiChat: currentAIChat.slice(-20),
    components: currentComponents.map(component => {
      const material = getMaterial(component.materialId);
      return { ...component, name: material?.name || '', size: material?.size || '', category: material?.category || '', costSnapshot: number(material?.cost) };
    }),
    cost: prices.total,
    priceMin: prices.min,
    priceRec: prices.rec,
    pricePremium: prices.premium,
    active: true,
    updatedAt: Date.now()
  };

  if (editingDesignId) {
    const design = getDesign(editingDesignId);
    Object.assign(design, payload);
    if (!silent) toast('Diseño actualizado');
  } else {
    const design = { id: uid('des'), ...payload, createdAt: Date.now() };
    S.designs.push(design);
    editingDesignId = design.id;
    if (!silent) toast('Diseño guardado');
  }
  persist();
  return true;
}

function loadDesign(id) {
  const design = getDesign(id);
  if (!design) { resetDesign(); return; }
  editingDesignId = design.id;
  $('#design-name').value = design.name || '';
  $('#thread-color').value = design.threadColor || 'Negro';
  $('#design-notes').value = design.notes || '';
  const legacyProductImage = String(design.imageData || '').startsWith('data:image/') && !design.productImageData && !design.aiResponseId;
  currentImageData = legacyProductImage ? '' : (design.imageData || '');
  currentProductImageData = design.productImageData || (legacyProductImage ? design.imageData : '');
  currentAIResponseId = design.aiResponseId || '';
  currentAIVersions = Array.isArray(design.aiVersions) ? design.aiVersions : [];
  currentAIChat = Array.isArray(design.aiChat) ? design.aiChat : [];
  currentAIVersionId = currentAIVersions.find(version => version.imageUrl === currentImageData)?.id || currentAIVersions.at(-1)?.id || '';
  currentComponents = (design.components || []).map(component => ({ materialId: component.materialId, qty: number(component.qty) })).filter(component => getMaterial(component.materialId));
  renderDesigner();
  toast('Diseño cargado');
}

function duplicateDesign() {
  if (!editingDesignId) return;
  const originalName = $('#design-name').value.trim() || 'Diseño';
  editingDesignId = null;
  currentAIResponseId = '';
  currentAIChat = [];
  currentAIVersionId = currentAIVersions.find(version => version.imageUrl === currentImageData)?.id || '';
  $('#design-name').value = `${originalName} copia`;
  renderDesigner();
  toast('Copia preparada; guarda el nuevo diseño');
}

function deleteDesign() {
  if (!editingDesignId) return;
  const design = getDesign(editingDesignId);
  if (!design || !confirm(`¿Eliminar el diseño “${design.name}”?`)) return;
  const used = S.sales.some(sale => sale.designId === design.id);
  if (used) {
    design.active = false;
    design.updatedAt = Date.now();
    toast('Diseño desactivado porque tiene ventas asociadas');
  } else {
    S.designs = S.designs.filter(item => item.id !== design.id);
    toast('Diseño eliminado');
  }
  resetDesign();
  persist();
}

function shareDesign() {
  if (!currentComponents.length) { toast('Primero agrega materiales'); return; }
  const prices = priceData();
  const name = $('#design-name').value.trim() || 'Manilla Aurea';
  const details = currentComponents.map(component => {
    const material = getMaterial(component.materialId);
    return `${number(component.qty)} × ${material?.name || 'Material'} ${material?.size || ''}`;
  }).join('\n');
  const text = `*${name}*\n${details}\n\nPrecio sugerido: *${money(prices.rec)}*\nHecha a mano por Aurea ✨`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
}

function buildAIPrompt() {
  const name = $('#design-name').value.trim() || 'manilla Aurea';
  const thread = $('#thread-color').value;
  const notes = $('#design-notes').value.trim();
  const details = currentComponents.map(component => {
    const material = getMaterial(component.materialId);
    return `${number(component.qty)} ${material?.name || 'accesorios'} de ${material?.size || 'tamaño pequeño'}`;
  }).join(', ');
  return `${S.settings.aiBrandPrompt || AUREA_BRAND_PROMPT}

OBJETIVO DE ESTA IMAGEN
Crear una fotografía comercial hiperrealista vertical para presentar la manilla “${name}” a un cliente de Aurea.

PRODUCTO
- Color del hilo: ${thread}.
- Composición registrada: ${details || 'diseño artesanal minimalista según la fotografía de producto'}.
- Notas del diseño: ${notes || 'sin notas adicionales'}.
- Si se adjunta una foto real, debe ser la fuente principal: preservar el producto, sus proporciones, cantidades, orden, colores y detalles. Las demás imágenes adjuntas son referencias de dirección artística, paleta, iluminación y composición; no copies sus productos ni sus textos.

COMPOSICIÓN
- Producto protagonista, completo, enfocado y visualmente atractivo.
- Acabado editorial premium para catálogo, Instagram y WhatsApp.
- Dejar aproximadamente 22% de espacio limpio arriba y 24% abajo para la plantilla de marca.
- No generar texto, logotipos, teléfono, iconos, sellos ni marcas de agua; Aurea los superpondrá después con precisión.`;
}

function aiErrorMessage(error) {
  const code = String(error?.code || '').replace(/^functions\//, '');
  const providerCode = String(error?.details?.providerCode || error?.details || '');
  const rawMessage = `${code} ${providerCode} ${error?.message || ''}`.toLowerCase();
  if (code === 'unauthenticated') return 'Activa el acceso autorizado en Firebase Authentication';
  if (code === 'permission-denied') return 'Tu cuenta o PIN no está autorizado para usar la IA';
  if (code === 'not-found') return 'Primero despliega la función de IA en Firebase';
  if (code === 'resource-exhausted' || rawMessage.includes('rate_limit')) return 'Se alcanzó el límite de imágenes; espera un momento antes de intentar de nuevo';
  if (code === 'deadline-exceeded' || code === 'cancelled') return 'La generación tardó demasiado; puedes volver a intentarlo';
  if (code === 'invalid-argument' || /(moderation|invalid_prompt|content_policy)/.test(rawMessage)) return 'La solicitud no pudo procesarse. Cambia la instrucción e inténtalo de nuevo';
  if (/(billing|insufficient_quota)/.test(rawMessage)) return 'Revisa la facturación de OpenAI o Firebase';
  return 'No fue posible generar la imagen. Revisa Functions y la clave de OpenAI.';
}

function aiRequestContext(prompt) {
  return {
    editingDesignId,
    prompt,
    productImageData: currentProductImageData,
    imageData: currentImageData,
    responseId: currentAIResponseId,
    components: JSON.stringify(currentComponents)
  };
}

function isSameAIRequestContext(context) {
  return context.editingDesignId === editingDesignId
    && context.prompt === buildAIPrompt()
    && context.productImageData === currentProductImageData
    && context.imageData === currentImageData
    && context.responseId === currentAIResponseId
    && context.components === JSON.stringify(currentComponents);
}

function setAIRequestControls(disabled) {
  ['#ai-generate-btn', '#ai-refine-btn', '#ai-prompt-btn', '#upload-image-btn', '#remove-product-image-btn', '#remove-image-btn']
    .forEach(selector => {
      const element = $(selector);
      if (element) element.disabled = disabled;
    });
  $$('[data-ai-suggestion], .ai-version').forEach(element => { element.disabled = disabled; });
}

async function requestAIImage(feedback = '') {
  if (aiRequestInFlight) {
    toast('Espera a que termine la imagen actual');
    return;
  }
  const isRefinement = Boolean(feedback && currentImageData);
  if (!isRefinement && !currentComponents.length && !currentProductImageData) {
    toast('Agrega materiales o sube una foto real de la manilla');
    return;
  }
  if (location.protocol === 'file:') { toast('Para usar IA abre la app con INICIAR_LOCAL.bat o desde Firebase'); return; }
  if (!functionsClient) { toast('Firebase Functions no está disponible'); return; }
  if (!firebase.auth?.().currentUser) { toast('Activa Firebase Authentication para usar la IA'); return; }

  const prompt = buildAIPrompt();
  const requestContext = aiRequestContext(prompt);
  const requestSequence = ++aiRequestSequence;
  const button = isRefinement ? $('#ai-refine-btn') : $('#ai-generate-btn');
  const originalText = button.textContent;
  aiRequestInFlight = true;
  setAIRequestControls(true);
  button.classList.add('loading');
  button.textContent = isRefinement ? 'Mejorando…' : 'Creando…';
  button.disabled = true;

  try {
    const generate = functionsClient.httpsCallable('generateAureaDesignImage', { timeout: 260_000 });
    const result = await generate({
      prompt,
      feedback,
      previousResponseId: isRefinement ? currentAIResponseId : '',
      currentImageUrl: isRefinement ? currentImageData : '',
      productImageData: isRefinement ? '' : currentProductImageData,
      styleReferenceImages: isRefinement ? [] : (S.settings.aiStyleReferences || []).slice(0, 4),
      model: S.settings.aiModel || 'gpt-5.6',
      quality: S.settings.aiQuality || 'medium',
      size: S.settings.aiSize || '1024x1536'
    });
    const imageUrl = result?.data?.imageUrl;
    if (!imageUrl) throw new Error('La función no devolvió una imagen');
    if (requestSequence !== aiRequestSequence || !isSameAIRequestContext(requestContext)) {
      toast('El diseño cambió mientras se generaba; el resultado no se aplicó');
      return;
    }

    const parentVersionId = currentAIVersionId;
    currentImageData = imageUrl;
    currentAIResponseId = result?.data?.responseId || '';
    if (isRefinement) currentAIChat.push({ role: 'user', text: feedback, createdAt: Date.now() });
    else currentAIChat.push({ role: 'user', text: 'Crear una presentación premium con el estilo de Aurea.', createdAt: Date.now() });
    currentAIChat.push({
      role: 'assistant',
      text: isRefinement ? 'Preparé una nueva versión con tus cambios. Puedes seguir pidiéndome ajustes.' : 'Creé la primera versión. Dime qué quieres mejorar.',
      createdAt: Date.now()
    });
    currentAIChat = currentAIChat.slice(-20);
    const versionId = uid('aiv');
    const instruction = isRefinement ? feedback : 'Primera presentación con el estilo guardado de Aurea';
    currentAIVersions.push({
      id: versionId,
      parentId: parentVersionId || '',
      imageUrl,
      responseId: currentAIResponseId,
      instruction,
      chat: currentAIChat.slice(),
      createdAt: Date.now()
    });
    currentAIVersions = currentAIVersions.slice(-8);
    currentAIVersionId = versionId;
    $('#ai-feedback-input').value = '';
    renderDesigner();
    const autoSaved = saveDesign({ silent: true });
    toast(isRefinement
      ? `Nueva versión creada${autoSaved ? ' y guardada' : ''}`
      : `Presentación creada con IA${autoSaved ? ' y guardada' : ''}`);
  } catch (error) {
    console.error('Generación IA:', error);
    toast(aiErrorMessage(error));
  } finally {
    if (requestSequence === aiRequestSequence) aiRequestInFlight = false;
    setAIRequestControls(false);
    button.classList.remove('loading');
    button.textContent = originalText;
    button.disabled = false;
  }
}

function generateAIImage() {
  return requestAIImage('');
}

function refineAIImage(instruction = '') {
  const feedback = String(instruction || $('#ai-feedback-input').value || '').trim();
  if (!currentImageData) { toast('Primero crea una presentación'); return; }
  if (feedback.length < 5) { toast('Describe el cambio que quieres hacer'); return; }
  return requestAIImage(feedback);
}

function selectAIVersion(index) {
  const version = currentAIVersions[index];
  if (!version) return;
  currentImageData = version.imageUrl;
  currentAIResponseId = version.responseId || '';
  currentAIVersionId = version.id || '';
  if (Array.isArray(version.chat)) currentAIChat = version.chat.slice(-20);
  renderDesigner();
  toast(`Versión ${index + 1} seleccionada`);
}

function showAIPrompt() {
  const prompt = buildAIPrompt();
  openModal(`<div class="modal-head"><h3>Idea visual guardada</h3><button class="modal-close" onclick="closeModal()">×</button></div>
    <p class="help">Aurea combina esta dirección de arte con los materiales, la foto real y las notas del diseño. Puedes editar la base desde Gestión → Configuración.</p>
    <div class="prompt-box" id="ai-prompt-text">${esc(prompt)}</div>
    <div class="modal-actions"><button class="btn btn-outline" onclick="closeModal()">Cerrar</button><button class="btn btn-outline" onclick="copyAIPrompt()">Copiar idea</button><button class="btn btn-primary" onclick="closeModal();generateAIImage()">Crear con IA</button></div>`);
}

async function copyAIPrompt() {
  const prompt = $('#ai-prompt-text')?.textContent || buildAIPrompt();
  try {
    await navigator.clipboard.writeText(prompt);
    toast('Prompt copiado');
  } catch (error) {
    toast('No fue posible copiar; selecciónalo manualmente');
  }
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function compressImage(file, maxSide = 960, quality = 0.72) {
  if (!file?.type?.startsWith('image/')) throw new Error('Selecciona una imagen válida');
  const dataUrl = await readFileAsDataURL(file);
  const image = new Image();
  await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = dataUrl; });
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
}

async function handleDesignImage(file) {
  try {
    currentProductImageData = await compressImage(file, 1200, 0.8);
    currentImageData = '';
    currentAIResponseId = '';
    currentAIVersions = [];
    currentAIChat = [];
    currentAIVersionId = '';
    renderDesigner();
    toast('Foto real preparada como referencia');
  } catch (error) {
    toast(error.message || 'No fue posible cargar la imagen');
  } finally {
    $('#design-image-input').value = '';
  }
}

function removeProductImage() {
  currentProductImageData = '';
  currentAIResponseId = '';
  renderDesigner();
  toast('Foto de referencia eliminada');
}

function removeDesignImage() {
  currentImageData = '';
  currentAIResponseId = '';
  currentAIVersions = [];
  currentAIChat = [];
  currentAIVersionId = '';
  renderDesigner();
  toast('Resultado de IA eliminado');
}

async function handleAIStyleReferences(files) {
  const available = Math.max(0, 4 - (S.settings.aiStyleReferences || []).length);
  const selected = [...(files || [])].slice(0, available);
  if (!selected.length) {
    toast(available ? 'Selecciona una o más imágenes' : 'Ya tienes cuatro referencias');
    return;
  }
  const button = $('#add-ai-reference-btn');
  const originalText = button.textContent;
  button.classList.add('loading');
  button.textContent = 'Preparando…';
  try {
    const references = [];
    for (const file of selected) references.push(await compressImage(file, 760, 0.68));
    S.settings.aiStyleReferences = [...(S.settings.aiStyleReferences || []), ...references].slice(0, 4);
    persist();
    toast(`${references.length} referencia${references.length === 1 ? '' : 's'} guardada${references.length === 1 ? '' : 's'}`);
  } catch (error) {
    toast(error.message || 'No fue posible preparar las referencias');
  } finally {
    button.classList.remove('loading');
    button.textContent = originalText;
    $('#ai-reference-input').value = '';
  }
}

function removeAIStyleReference(index) {
  S.settings.aiStyleReferences = (S.settings.aiStyleReferences || []).filter((_, itemIndex) => itemIndex !== index);
  persist();
  toast('Referencia eliminada');
}

function loadCanvasImage(src) {
  return new Promise(async (resolve, reject) => {
    try {
      let imageSource = src;
      let objectUrl = '';
      if (!String(src).startsWith('data:') && new URL(src, location.href).origin !== location.origin) {
        const response = await fetch(src);
        if (!response.ok) throw new Error('No fue posible descargar la imagen generada');
        objectUrl = URL.createObjectURL(await response.blob());
        imageSource = objectUrl;
      }
      const image = new Image();
      image.onload = () => {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        resolve(image);
      };
      image.onerror = () => {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        reject(new Error('No fue posible cargar la imagen'));
      };
      image.src = imageSource;
    } catch (error) {
      reject(error);
    }
  });
}

function drawImageCover(context, image, width, height) {
  const scale = Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  context.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
}

function wrapCanvasText(context, text, x, y, maxWidth, lineHeight, maxLines = 3) {
  const words = String(text || '').split(/\s+/);
  const lines = [];
  let line = '';
  words.forEach(word => {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  });
  if (line) lines.push(line);
  lines.slice(0, maxLines).forEach((item, index) => context.fillText(item, x, y + (index * lineHeight)));
  return Math.min(lines.length, maxLines);
}

async function buildAureaPresentationBlob() {
  if (!currentImageData) throw new Error('Primero crea una presentación');
  const [widthText, heightText] = String(S.settings.aiSize || '1024x1536').split('x');
  const width = Math.max(720, Number(widthText) || 1024);
  const height = Math.max(720, Number(heightText) || 1536);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  const scene = await loadCanvasImage(currentImageData);
  drawImageCover(context, scene, width, height);

  const theme = S.settings.aiTheme || 'champagne';
  const overlay = {
    champagne: ['rgba(19,12,7,.82)', 'rgba(19,12,7,.94)', '#f0c86f', '#b07b28'],
    rose: ['rgba(91,46,55,.78)', 'rgba(83,43,52,.93)', '#f3d5c5', '#bc7c81'],
    'black-gold': ['rgba(0,0,0,.9)', 'rgba(0,0,0,.97)', '#efc465', '#a76e18']
  }[theme] || ['rgba(19,12,7,.82)', 'rgba(19,12,7,.94)', '#f0c86f', '#b07b28'];

  const topGradient = context.createLinearGradient(0, 0, 0, height * 0.38);
  topGradient.addColorStop(0, overlay[0]);
  topGradient.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = topGradient;
  context.fillRect(0, 0, width, height * 0.4);

  const bottomGradient = context.createLinearGradient(0, height * 0.58, 0, height);
  bottomGradient.addColorStop(0, 'rgba(0,0,0,0)');
  bottomGradient.addColorStop(1, overlay[1]);
  context.fillStyle = bottomGradient;
  context.fillRect(0, height * 0.56, width, height * 0.44);

  const logo = await loadCanvasImage('assets/logo-aurea.jpg');
  const logoSize = Math.round(width * 0.13);
  const logoX = Math.round(width * 0.07);
  const logoY = Math.round(height * 0.045);
  context.save();
  context.beginPath();
  context.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
  context.clip();
  context.drawImage(logo, logoX, logoY, logoSize, logoSize);
  context.restore();
  context.strokeStyle = overlay[2];
  context.lineWidth = Math.max(2, width * 0.002);
  context.beginPath();
  context.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
  context.stroke();

  const brandX = logoX + logoSize + width * 0.025;
  context.fillStyle = overlay[2];
  context.font = `${Math.round(width * 0.055)}px Georgia, serif`;
  context.fillText('A U R E A', brandX, logoY + logoSize * 0.54);
  context.fillStyle = '#fff4df';
  context.font = `${Math.round(width * 0.016)}px Arial, sans-serif`;
  context.fillText('JOYAS HECHAS CON AMOR, BRILLO Y ESENCIA', brandX, logoY + logoSize * 0.78);

  context.fillStyle = '#ffffff';
  context.font = `${Math.round(width * 0.072)}px Georgia, serif`;
  const headlineY = Math.round(height * 0.21);
  const headlineLines = wrapCanvasText(context, S.settings.aiHeadline || DEFAULT_SETTINGS.aiHeadline, width * 0.07, headlineY, width * 0.76, width * 0.078, 3);
  context.fillStyle = '#fff4e3';
  context.font = `${Math.round(width * 0.026)}px Arial, sans-serif`;
  wrapCanvasText(context, S.settings.aiCaption || DEFAULT_SETTINGS.aiCaption, width * 0.07, headlineY + headlineLines * width * 0.078 + height * 0.014, width * 0.68, width * 0.035, 2);

  const benefits = brandBenefits().slice(0, 4);
  const benefitY = height * 0.82;
  const benefitWidth = width * 0.86 / Math.max(1, benefits.length);
  context.textAlign = 'center';
  benefits.forEach((benefit, index) => {
    const x = width * 0.07 + benefitWidth * index + benefitWidth / 2;
    context.fillStyle = overlay[2];
    context.font = `${Math.round(width * 0.032)}px Georgia, serif`;
    context.fillText('✦', x, benefitY);
    context.fillStyle = '#fff8ed';
    context.font = `${Math.round(width * 0.019)}px Arial, sans-serif`;
    wrapCanvasText(context, benefit, x, benefitY + height * 0.025, benefitWidth * 0.86, width * 0.026, 2);
  });
  context.textAlign = 'left';

  const phone = S.settings.aiWhatsapp || DEFAULT_SETTINGS.aiWhatsapp;
  context.font = `700 ${Math.round(width * 0.037)}px Arial, sans-serif`;
  const phoneWidth = context.measureText(phone).width;
  const pillWidth = phoneWidth + width * 0.2;
  const pillHeight = height * 0.057;
  const pillX = (width - pillWidth) / 2;
  const pillY = height * 0.918;
  const pillGradient = context.createLinearGradient(pillX, pillY, pillX + pillWidth, pillY + pillHeight);
  pillGradient.addColorStop(0, overlay[3]);
  pillGradient.addColorStop(1, overlay[2]);
  context.fillStyle = pillGradient;
  context.beginPath();
  context.roundRect(pillX, pillY, pillWidth, pillHeight, pillHeight / 2);
  context.fill();
  context.fillStyle = '#fff';
  context.font = `${Math.round(width * 0.016)}px Arial, sans-serif`;
  context.fillText('WHATSAPP', pillX + width * 0.045, pillY + pillHeight * 0.58);
  context.font = `700 ${Math.round(width * 0.037)}px Arial, sans-serif`;
  context.fillText(phone, pillX + width * 0.14, pillY + pillHeight * 0.66);

  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('No fue posible preparar la descarga')), 'image/jpeg', 0.92));
}

async function downloadAureaPresentation() {
  const button = $('#download-presentation-btn');
  const originalText = button.textContent;
  button.classList.add('loading');
  button.textContent = 'Preparando…';
  try {
    const blob = await buildAureaPresentationBlob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const name = ($('#design-name').value.trim() || 'diseno-aurea').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    link.href = url;
    link.download = `aurea-${name || 'presentacion'}.jpg`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('Publicidad descargada');
  } catch (error) {
    toast(error.message || 'No fue posible descargar la publicidad');
  } finally {
    button.classList.remove('loading');
    button.textContent = originalText;
  }
}

function saleCard(sale, withActions = true) {
  const statusClass = sale.status === 'Cancelada' ? 'cancelled' : sale.paymentStatus === 'Pagado' ? 'paid' : 'pending';
  return `<article class="record">
    <div><div class="record-title">${esc(sale.designName || 'Venta')}</div><div class="record-meta">${esc(sale.customer || 'Cliente no registrado')} · ${dateText(sale.date)} · <span class="badge ${statusClass}">${esc(sale.status === 'Cancelada' ? 'Cancelada' : sale.paymentStatus || 'Pendiente')}</span></div></div>
    <div class="record-value"><b>${money(sale.price)}</b><span class="${number(sale.profit) >= 0 ? 'positive' : 'negative'}">Utilidad ${money(sale.profit)}</span></div>
    ${withActions ? `<div class="record-actions"><button class="btn btn-outline btn-sm" onclick="openSale('${sale.id}')">Editar</button>${sale.status !== 'Cancelada' ? `<button class="btn btn-danger btn-sm" onclick="cancelSale('${sale.id}')">Anular</button>` : `<button class="btn btn-danger btn-sm" onclick="deleteSale('${sale.id}')">Eliminar</button>`}</div>` : ''}
  </article>`;
}

function renderSales() {
  const search = ($('#sale-search')?.value || '').toLowerCase();
  const status = $('#sale-status')?.value || 'active';
  const list = [...S.sales].filter(sale => {
    const matchesSearch = `${sale.designName} ${sale.customer} ${sale.phone}`.toLowerCase().includes(search);
    const matchesStatus = status === 'all' || (status === 'active' ? sale.status !== 'Cancelada' : sale.status === 'Cancelada');
    return matchesSearch && matchesStatus;
  }).sort((a, b) => number(b.createdAt) - number(a.createdAt));
  $('#sales-list').innerHTML = list.length ? list.map(sale => saleCard(sale, true)).join('') : '<div class="card empty"><b>No hay ventas registradas</b>Guarda un diseño y registra la primera venta.</div>';
}

function upsertCustomer(name, phone) {
  const cleanName = (name || '').trim();
  const cleanPhone = (phone || '').trim();
  if (!cleanName && !cleanPhone) return '';
  let customer = S.customers.find(item => cleanPhone && item.phone === cleanPhone);
  if (!customer) customer = S.customers.find(item => cleanName && item.name.toLowerCase() === cleanName.toLowerCase());
  if (customer) {
    if (cleanName) customer.name = cleanName;
    if (cleanPhone) customer.phone = cleanPhone;
    customer.active = true;
    customer.updatedAt = Date.now();
    return customer.id;
  }
  customer = { id: uid('cus'), name: cleanName || cleanPhone, phone: cleanPhone, notes: '', active: true, createdAt: Date.now() };
  S.customers.push(customer);
  return customer.id;
}

function openSale(id = '') {
  editingSaleId = id || null;
  const sale = id ? S.sales.find(item => item.id === id) : null;
  const designs = S.designs.filter(design => design.active !== false);
  if (!sale && !designs.length) { toast('Primero guarda al menos un diseño'); showView('designer'); return; }
  const selectedDesign = sale ? getDesign(sale.designId) : designs[0];

  openModal(`<div class="modal-head"><h3>${sale ? 'Editar' : 'Registrar'} venta</h3><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="form-grid two">
      <div class="field"><label>Diseño</label>${sale ? `<input class="input" disabled value="${esc(sale.designName)}">` : `<select class="input" id="s-design">${designs.map(design => `<option value="${design.id}">${esc(design.name)}</option>`).join('')}</select>`}</div>
      <div class="field"><label>Precio vendido</label><input class="input" id="s-price" type="number" min="0" value="${sale ? number(sale.price) : number(selectedDesign?.priceRec)}"></div>
      <div class="field"><label>Cliente</label><input class="input" id="s-customer" value="${esc(sale?.customer || '')}" placeholder="Nombre"></div>
      <div class="field"><label>WhatsApp</label><input class="input" id="s-phone" value="${esc(sale?.phone || '')}" inputmode="tel" placeholder="3XX XXX XXXX"></div>
      <div class="field"><label>Estado del pago</label><select class="input" id="s-payment">${['Pagado', 'Pendiente', 'Abono'].map(item => `<option ${sale?.paymentStatus === item ? 'selected' : ''}>${item}</option>`).join('')}</select></div>
      <div class="field"><label>Fecha</label><input class="input" id="s-date" type="date" value="${esc((sale?.date || new Date().toISOString()).slice(0, 10))}"></div>
      <div class="field full"><label>Notas</label><textarea class="input" id="s-notes">${esc(sale?.notes || '')}</textarea></div>
    </div>
    ${sale ? '<div class="warning">Editar la venta no vuelve a descontar inventario. Para reversarlo usa “Anular”.</div>' : '<label class="inline" style="margin-top:13px"><input type="checkbox" id="s-deduct" checked> <span style="font-size:12px">Descontar materiales del inventario</span></label>'}
    <div class="modal-actions"><button class="btn btn-outline" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="saveSale()">Guardar venta</button></div>`);

  if (!sale) {
    $('#s-design').onchange = () => {
      const design = getDesign($('#s-design').value);
      if (design) $('#s-price').value = number(design.priceRec);
    };
  }
}

function saveSale() {
  const price = number($('#s-price').value);
  if (price <= 0) { toast('Ingresa un precio válido'); return; }

  if (editingSaleId) {
    const sale = S.sales.find(item => item.id === editingSaleId);
    if (!sale) return;
    sale.customer = $('#s-customer').value.trim();
    sale.phone = $('#s-phone').value.trim();
    sale.customerId = upsertCustomer(sale.customer, sale.phone);
    sale.price = price;
    sale.profit = price - number(sale.cost);
    sale.paymentStatus = $('#s-payment').value;
    sale.date = $('#s-date').value;
    sale.notes = $('#s-notes').value.trim();
    sale.updatedAt = Date.now();
    closeModal();
    persist();
    toast('Venta actualizada');
    return;
  }

  const design = getDesign($('#s-design').value);
  if (!design) { toast('Selecciona un diseño'); return; }
  const deduct = $('#s-deduct').checked;
  const components = (design.components || []).map(component => ({
    materialId: component.materialId,
    qty: number(component.qty),
    name: component.name || getMaterial(component.materialId)?.name || ''
  }));

  if (deduct) {
    const shortages = components.filter(component => number(getMaterial(component.materialId)?.stock) < number(component.qty));
    if (shortages.length) { toast(`Stock insuficiente: ${shortages.map(item => item.name).join(', ')}`); return; }
    components.forEach(component => {
      const material = getMaterial(component.materialId);
      material.stock = number(material.stock) - number(component.qty);
      material.updatedAt = Date.now();
      S.movements.push({ id: uid('mov'), materialId: material.id, materialName: material.name, type: 'Venta/producción', qty: -number(component.qty), date: new Date().toISOString(), createdAt: Date.now() });
    });
  }

  const customer = $('#s-customer').value.trim();
  const phone = $('#s-phone').value.trim();
  const sale = {
    id: uid('sale'), designId: design.id, designName: design.name,
    customerId: upsertCustomer(customer, phone), customer, phone, price,
    cost: number(design.cost), profit: price - number(design.cost),
    paymentStatus: $('#s-payment').value, status: 'Registrada',
    date: $('#s-date').value, notes: $('#s-notes').value.trim(),
    deductedInventory: deduct, componentsSnapshot: components, createdAt: Date.now()
  };
  S.sales.push(sale);
  closeModal();
  persist();
  toast('Venta registrada');
}

function cancelSale(id) {
  const sale = S.sales.find(item => item.id === id);
  if (!sale || sale.status === 'Cancelada' || !confirm('¿Anular esta venta?')) return;
  if (sale.deductedInventory) {
    (sale.componentsSnapshot || []).forEach(component => {
      const material = getMaterial(component.materialId);
      if (!material) return;
      material.stock = number(material.stock) + number(component.qty);
      material.updatedAt = Date.now();
      S.movements.push({ id: uid('mov'), materialId: material.id, materialName: material.name, type: 'Anulación venta', qty: number(component.qty), date: new Date().toISOString(), createdAt: Date.now() });
    });
  }
  sale.status = 'Cancelada';
  sale.cancelledAt = Date.now();
  persist();
  toast('Venta anulada e inventario reversado');
}

function deleteSale(id) {
  const sale = S.sales.find(item => item.id === id);
  if (!sale || sale.status !== 'Cancelada') { toast('Solo se pueden eliminar ventas canceladas'); return; }
  if (!confirm('¿Eliminar definitivamente esta venta cancelada?')) return;
  S.sales = S.sales.filter(item => item.id !== id);
  persist();
  toast('Venta eliminada');
}

function renderManagement() {
  renderPurchases();
  renderCustomers();
  renderExpenses();
  renderMovements();
  renderSettings();
}

function renderPurchases() {
  const list = [...S.purchases].sort((a, b) => number(b.createdAt) - number(a.createdAt));
  $('#purchases-list').innerHTML = list.length ? list.map(purchase => `<article class="record">
    <div><div class="record-title">${esc(purchase.materialName)} ${esc(purchase.materialSize || '')}</div><div class="record-meta">${dateText(purchase.date)} · ${esc(purchase.provider || 'Sin proveedor')} · <span class="badge ${purchase.status === 'Anulada' ? 'cancelled' : 'active'}">${esc(purchase.status || 'Activa')}</span></div></div>
    <div class="record-value"><b>${number(purchase.qty)} unidades</b><span>${money(number(purchase.total) + number(purchase.shipping))}</span></div>
    <div class="record-actions"><button class="btn btn-outline btn-sm" onclick="openPurchase('', '${purchase.id}')">Editar datos</button>${purchase.status !== 'Anulada' ? `<button class="btn btn-danger btn-sm" onclick="annulPurchase('${purchase.id}')">Anular</button>` : ''}</div>
  </article>`).join('') : '<div class="card empty"><b>No hay compras</b>Registra una entrada desde inventario o desde este módulo.</div>';
}

function customerMetrics(customerId) {
  const sales = activeSales().filter(sale => sale.customerId === customerId);
  return { count: sales.length, revenue: sales.reduce((sum, sale) => sum + number(sale.price), 0) };
}

function renderCustomers() {
  const list = [...S.customers].sort((a, b) => String(a.name).localeCompare(String(b.name)));
  $('#customers-list').innerHTML = list.length ? list.map(customer => {
    const metrics = customerMetrics(customer.id);
    return `<article class="record">
      <div><div class="record-title">${esc(customer.name)}</div><div class="record-meta">${esc(customer.phone || 'Sin teléfono')} · ${metrics.count} compra${metrics.count === 1 ? '' : 's'} · ${customer.active === false ? '<span class="badge inactive">Inactivo</span>' : '<span class="badge active">Activo</span>'}</div></div>
      <div class="record-value"><b>${money(metrics.revenue)}</b><span>Total comprado</span></div>
      <div class="record-actions"><button class="btn btn-outline btn-sm" onclick="openCustomer('${customer.id}')">Editar</button><button class="btn ${customer.active === false ? 'btn-soft' : 'btn-danger'} btn-sm" onclick="toggleCustomer('${customer.id}')">${customer.active === false ? 'Activar' : 'Desactivar'}</button>${metrics.count === 0 ? `<button class="btn btn-danger btn-sm" onclick="deleteCustomer('${customer.id}')">Eliminar</button>` : ''}</div>
    </article>`;
  }).join('') : '<div class="card empty"><b>No hay clientes</b>Se crearán automáticamente al registrar ventas.</div>';
}

function openCustomer(id = '') {
  editingCustomerId = id || null;
  const customer = id ? getCustomer(id) : { name: '', phone: '', notes: '', active: true };
  openModal(`<div class="modal-head"><h3>${id ? 'Editar' : 'Nuevo'} cliente</h3><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="form-grid two"><div class="field"><label>Nombre</label><input class="input" id="c-name" value="${esc(customer.name)}"></div><div class="field"><label>WhatsApp</label><input class="input" id="c-phone" inputmode="tel" value="${esc(customer.phone || '')}"></div><div class="field full"><label>Notas</label><textarea class="input" id="c-notes">${esc(customer.notes || '')}</textarea></div></div>
    <div class="modal-actions"><button class="btn btn-outline" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="saveCustomer()">Guardar</button></div>`);
}

function saveCustomer() {
  const name = $('#c-name').value.trim();
  if (!name) { toast('Ingresa el nombre'); return; }
  const payload = { name, phone: $('#c-phone').value.trim(), notes: $('#c-notes').value.trim(), updatedAt: Date.now() };
  if (editingCustomerId) Object.assign(getCustomer(editingCustomerId), payload);
  else S.customers.push({ id: uid('cus'), ...payload, active: true, createdAt: Date.now() });
  closeModal();
  persist();
  toast('Cliente guardado');
}

function toggleCustomer(id) {
  const customer = getCustomer(id);
  if (!customer) return;
  customer.active = customer.active === false;
  customer.updatedAt = Date.now();
  persist();
}

function deleteCustomer(id) {
  const metrics = customerMetrics(id);
  if (metrics.count > 0) { toast('No se puede eliminar porque tiene ventas'); return; }
  if (!confirm('¿Eliminar definitivamente este cliente?')) return;
  S.customers = S.customers.filter(customer => customer.id !== id);
  persist();
  toast('Cliente eliminado');
}

function renderExpenses() {
  const list = [...S.expenses].filter(expense => expense.active !== false).sort((a, b) => number(b.createdAt) - number(a.createdAt));
  $('#expenses-list').innerHTML = list.length ? list.map(expense => `<article class="record">
    <div><div class="record-title">${esc(expense.description)}</div><div class="record-meta">${esc(expense.category)} · ${dateText(expense.date)}</div></div>
    <div class="record-value"><b class="negative">${money(expense.amount)}</b><span>Gasto</span></div>
    <div class="record-actions"><button class="btn btn-outline btn-sm" onclick="openExpense('${expense.id}')">Editar</button><button class="btn btn-danger btn-sm" onclick="deleteExpense('${expense.id}')">Eliminar</button></div>
  </article>`).join('') : '<div class="card empty"><b>No hay gastos</b>Registra publicidad, transporte, herramientas u otros costos.</div>';
}

function openExpense(id = '') {
  editingExpenseId = id || null;
  const expense = id ? S.expenses.find(item => item.id === id) : { description: '', category: 'Otro', amount: 0, date: new Date().toISOString().slice(0, 10), notes: '' };
  openModal(`<div class="modal-head"><h3>${id ? 'Editar' : 'Nuevo'} gasto</h3><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="form-grid two">
      <div class="field"><label>Descripción</label><input class="input" id="e-description" value="${esc(expense.description)}"></div>
      <div class="field"><label>Categoría</label><select class="input" id="e-category">${['Publicidad', 'Transporte', 'Herramientas', 'Empaques', 'Comisiones', 'Servicios', 'Otro'].map(item => `<option ${expense.category === item ? 'selected' : ''}>${item}</option>`).join('')}</select></div>
      <div class="field"><label>Valor</label><input class="input" id="e-amount" type="number" min="0" value="${number(expense.amount)}"></div>
      <div class="field"><label>Fecha</label><input class="input" id="e-date" type="date" value="${esc((expense.date || '').slice(0, 10))}"></div>
      <div class="field full"><label>Notas</label><textarea class="input" id="e-notes">${esc(expense.notes || '')}</textarea></div>
    </div>
    <div class="modal-actions"><button class="btn btn-outline" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="saveExpense()">Guardar</button></div>`);
}

function saveExpense() {
  const description = $('#e-description').value.trim();
  const amount = number($('#e-amount').value);
  if (!description || amount <= 0) { toast('Revisa descripción y valor'); return; }
  const payload = { description, category: $('#e-category').value, amount, date: $('#e-date').value, notes: $('#e-notes').value.trim(), active: true, updatedAt: Date.now() };
  if (editingExpenseId) Object.assign(S.expenses.find(item => item.id === editingExpenseId), payload);
  else S.expenses.push({ id: uid('exp'), ...payload, createdAt: Date.now() });
  closeModal();
  persist();
  toast('Gasto guardado');
}

function deleteExpense(id) {
  if (!confirm('¿Eliminar este gasto?')) return;
  S.expenses = S.expenses.filter(expense => expense.id !== id);
  persist();
  toast('Gasto eliminado');
}

function renderMovements() {
  const list = [...S.movements].sort((a, b) => number(b.createdAt) - number(a.createdAt)).slice(0, 150);
  $('#movements-list').innerHTML = list.length ? list.map(movement => `<article class="record">
    <div><div class="record-title">${esc(movement.materialName || getMaterial(movement.materialId)?.name || 'Material')}</div><div class="record-meta">${esc(movement.type)} · ${dateText(movement.date)}</div></div>
    <div class="record-value"><b class="${number(movement.qty) >= 0 ? 'positive' : 'negative'}">${number(movement.qty) >= 0 ? '+' : ''}${number(movement.qty)}</b><span>unidades</span></div>
  </article>`).join('') : '<div class="card empty"><b>No hay movimientos</b>Las compras, ventas y ajustes aparecerán aquí.</div>';
}

function renderSettings() {
  if (!$('#set-packaging')) return;
  $('#set-packaging').value = number(S.settings.packaging);
  $('#set-labor').value = number(S.settings.labor);
  $('#set-waste').value = number(S.settings.wastePct);
  $('#set-margin-min').value = number(S.settings.marginMin);
  $('#set-margin-rec').value = number(S.settings.marginRec);
  $('#set-margin-premium').value = number(S.settings.marginPremium);
  $('#set-round').value = String(number(S.settings.roundTo));
  $('#set-ai-model').value = S.settings.aiModel || 'gpt-5.6';
  $('#set-ai-quality').value = S.settings.aiQuality || 'medium';
  $('#set-ai-size').value = S.settings.aiSize || '1024x1536';
  $('#set-ai-theme').value = S.settings.aiTheme || 'champagne';
  $('#set-ai-brand-prompt').value = S.settings.aiBrandPrompt || AUREA_BRAND_PROMPT;
  $('#set-ai-headline').value = S.settings.aiHeadline || DEFAULT_SETTINGS.aiHeadline;
  $('#set-ai-caption').value = S.settings.aiCaption || DEFAULT_SETTINGS.aiCaption;
  $('#set-ai-whatsapp').value = S.settings.aiWhatsapp || DEFAULT_SETTINGS.aiWhatsapp;
  $('#set-ai-benefits').value = S.settings.aiBenefits || DEFAULT_SETTINGS.aiBenefits;
  renderAIReferenceSettings();
}

function renderAIReferenceSettings() {
  const grid = $('#ai-reference-grid');
  if (!grid) return;
  const references = S.settings.aiStyleReferences || [];
  grid.innerHTML = references.length ? references.map((src, index) => `
    <div class="ai-reference"><img src="${esc(src)}" alt="Referencia visual ${index + 1}"><button type="button" onclick="removeAIStyleReference(${index})" aria-label="Eliminar referencia ${index + 1}">×</button></div>
  `).join('') : '<div class="ai-reference-empty">Todavía no hay fotos de referencia. Puedes subir aquí las imágenes de presentación que compartiste.</div>';
  const button = $('#add-ai-reference-btn');
  button.disabled = references.length >= 4;
  button.textContent = references.length >= 4 ? 'Máximo alcanzado' : 'Agregar fotos';
}

function saveSettings() {
  const next = {
    packaging: number($('#set-packaging').value), labor: number($('#set-labor').value), wastePct: number($('#set-waste').value),
    marginMin: number($('#set-margin-min').value), marginRec: number($('#set-margin-rec').value), marginPremium: number($('#set-margin-premium').value),
    roundTo: number($('#set-round').value),
    aiModel: $('#set-ai-model').value,
    aiQuality: $('#set-ai-quality').value,
    aiSize: $('#set-ai-size').value,
    aiTheme: $('#set-ai-theme').value,
    aiBrandPrompt: $('#set-ai-brand-prompt').value.trim() || AUREA_BRAND_PROMPT,
    aiHeadline: $('#set-ai-headline').value.trim() || DEFAULT_SETTINGS.aiHeadline,
    aiCaption: $('#set-ai-caption').value.trim() || DEFAULT_SETTINGS.aiCaption,
    aiWhatsapp: $('#set-ai-whatsapp').value.trim() || DEFAULT_SETTINGS.aiWhatsapp,
    aiBenefits: $('#set-ai-benefits').value.trim() || DEFAULT_SETTINGS.aiBenefits
  };
  if ([next.marginMin, next.marginRec, next.marginPremium].some(value => value >= 95 || value < 0)) { toast('Los márgenes deben estar entre 0% y 94%'); return; }
  if (!(next.marginMin <= next.marginRec && next.marginRec <= next.marginPremium)) { toast('Los márgenes deben ir de menor a mayor'); return; }
  Object.assign(S.settings, next);
  persist();
  toast('Parámetros guardados');
}

async function changePin() {
  const first = $('#new-pin').value;
  const second = $('#confirm-pin').value;
  if (!/^\d{4}$/.test(first)) { toast('El PIN debe tener 4 números'); return; }
  if (first !== second) { toast('Los PIN no coinciden'); return; }
  await savePinHash(await hashPIN(first));
  $('#new-pin').value = '';
  $('#confirm-pin').value = '';
  toast('PIN actualizado');
}

function bindEvents() {
  $$('.nav-btn').forEach(button => { button.onclick = () => showView(button.dataset.view); });
  $$('[data-go]').forEach(button => { button.onclick = () => showView(button.dataset.go, button.dataset.tab || ''); });
  $$('[data-action="new-sale"]').forEach(button => { button.onclick = () => openSale(); });
  $$('.tab').forEach(button => { button.onclick = () => showManagementTab(button.dataset.mtab); });

  $$('[data-pin]').forEach(button => {
    button.onclick = () => {
      if (pinBuffer.length >= 4) return;
      pinBuffer += button.dataset.pin;
      drawPin();
      if (pinBuffer.length === 4) setTimeout(verifyPin, 100);
    };
  });
  $('#pin-del').onclick = () => { pinBuffer = pinBuffer.slice(0, -1); drawPin(); };

  $('#material-search').oninput = renderInventory;
  $('#material-category').onchange = renderInventory;
  $('#material-status').onchange = renderInventory;
  $('#add-material-btn').onclick = () => openMaterial();
  $('#new-purchase-btn').onclick = () => openPurchase();

  $('#add-component-btn').onclick = addComponent;
  $('#new-design-btn').onclick = resetDesign;
  $('#save-design-btn').onclick = saveDesign;
  $('#share-design-btn').onclick = shareDesign;
  $('#duplicate-design-btn').onclick = duplicateDesign;
  $('#delete-design-btn').onclick = deleteDesign;
  $('#saved-designs').onchange = event => event.target.value ? loadDesign(event.target.value) : resetDesign();
  $('#upload-image-btn').onclick = () => $('#design-image-input').click();
  $('#design-image-input').onchange = event => handleDesignImage(event.target.files?.[0]);
  $('#remove-product-image-btn').onclick = removeProductImage;
  $('#remove-image-btn').onclick = removeDesignImage;
  $('#download-presentation-btn').onclick = downloadAureaPresentation;
  $('#ai-prompt-btn').onclick = showAIPrompt;
  $('#ai-generate-btn').onclick = generateAIImage;
  $('#ai-refine-btn').onclick = () => refineAIImage();
  $$('[data-ai-suggestion]').forEach(button => { button.onclick = () => refineAIImage(button.dataset.aiSuggestion); });

  $('#sale-search').oninput = renderSales;
  $('#sale-status').onchange = renderSales;
  $('#new-customer-btn').onclick = () => openCustomer();
  $('#new-expense-btn').onclick = () => openExpense();

  $('#save-settings-btn').onclick = saveSettings;
  $('#add-ai-reference-btn').onclick = () => $('#ai-reference-input').click();
  $('#ai-reference-input').onchange = event => handleAIStyleReferences(event.target.files);
  $('#change-pin-btn').onclick = changePin;
  $('#lock-btn').onclick = lock;
  $('#google-signin-btn').onclick = signInWithGoogle;
  $('#google-signout-btn').onclick = signOutGoogle;
  $('#modal-backdrop').onclick = event => { if (event.target.id === 'modal-backdrop') closeModal(); };

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstall = event;
    $('#install-banner').classList.remove('hidden');
  });
  $('#install-btn').onclick = async () => {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    await deferredInstall.userChoice;
    deferredInstall = null;
    $('#install-banner').classList.add('hidden');
  };
  window.addEventListener('appinstalled', () => toast('Aurea instalada'));
}

Object.assign(window, {
  closeModal, openMaterial, saveMaterial, toggleMaterial, deleteMaterial,
  openPurchase, savePurchase, annulPurchase,
  changeComponentQty, removeComponent,
  openSale, saveSale, cancelSale, deleteSale,
  openCustomer, saveCustomer, toggleCustomer, deleteCustomer,
  openExpense, saveExpense, deleteExpense,
  copyAIPrompt, generateAIImage, refineAIImage, selectAIVersion,
  removeAIStyleReference, downloadAureaPresentation
});

document.addEventListener('DOMContentLoaded', async () => {
  loadLocal();
  bindEvents();
  renderAll();
  if (location.protocol === 'file:') $('#local-warning')?.classList.remove('hidden');
  const firebaseReady = await initFirebase();
  if (!firebaseReady) return;
  if (sessionStorage.getItem('aurea_unlocked') === '1') $('#pin-screen').classList.add('hidden');
  else await initPIN();
  renderAll();
  const requestedView = new URLSearchParams(location.search).get('view');
  const requestedTab = new URLSearchParams(location.search).get('tab') || '';
  if (['home', 'inventory', 'designer', 'sales', 'management'].includes(requestedView)) showView(requestedView, requestedTab);
  if (location.protocol !== 'file:' && 'serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(console.warn);
});
