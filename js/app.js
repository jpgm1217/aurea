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
const PENDING_CRITICAL_KEY = 'aurea_pending_critical_v1';
const APP_CHECK_SITE_KEY = '6Ld8oGstAAAAALAszbzyh31d-rv9sq3jITg0sTNX';
const SCHEMA_VERSION = 2;
const D = window.AureaDomain;

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
  aiStyleReferences: [],
  lastBackupAt: 0
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
].map(([id, name, category, size, cost], index) => ({
  id, code: `MAT-${String(index + 1).padStart(3, '0')}`, name, category, size, unit: 'unidad',
  cost, stock: 0, minStock: 5, active: true, createdAt: Date.now()
}));

let S = {
  schemaVersion: SCHEMA_VERSION,
  revision: 0,
  appliedOperations: [],
  settings: { ...DEFAULT_SETTINGS },
  materials: DEFAULT_MATERIALS,
  designs: [],
  productions: [],
  sales: [],
  purchases: [],
  movements: [],
  customers: [],
  expenses: []
};

let db = null;
let saving = false;
let saveTimer = null;
let firebaseConnected = false;
let lastRemoteRevision = 0;
let pendingLocalChanges = false;
let localGeneration = 0;
let criticalInFlight = false;
let criticalBaseState = null;
let deferredInstall = null;
let currentComponents = [];
let currentImageData = '';
let currentProductImageData = '';
let currentAIResponseId = '';
let currentAIVersions = [];
let currentAIChat = [];
let currentAIVersionId = '';
let pendingManualFeedback = '';
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
const fingerprint = value => {
  const text = JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};
function readPendingCritical() {
  try {
    const value = JSON.parse(localStorage.getItem(PENDING_CRITICAL_KEY) || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}
function createCriticalOperation(prefix, signature) {
  const key = `${prefix}:${fingerprint(signature)}`;
  const pending = readPendingCritical();
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  Object.keys(pending).forEach(item => {
    if (number(pending[item]?.createdAt) < cutoff) delete pending[item];
  });
  if (!pending[key]?.id) pending[key] = { id: uid(prefix), createdAt: Date.now() };
  try { localStorage.setItem(PENDING_CRITICAL_KEY, JSON.stringify(pending)); } catch {}
  return { key, id: pending[key].id };
}
function clearCriticalOperation(operation) {
  if (!operation?.key) return;
  const pending = readPendingCritical();
  delete pending[operation.key];
  try { localStorage.setItem(PENDING_CRITICAL_KEY, JSON.stringify(pending)); } catch {}
}
function reconcilePendingCritical() {
  try { localStorage.removeItem(PENDING_CRITICAL_KEY); } catch {}
}
const roundUp = (value, step) => Math.ceil(number(value) / Math.max(1, number(step))) * Math.max(1, number(step));
const clone = value => JSON.parse(JSON.stringify(value));
const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[char]));
const dateText = value => {
  if (!value) return 'Sin fecha';
  const d = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('es-CO');
};
const cleanCode = value => String(value || '').trim().toUpperCase().replace(/[^A-Z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
const shortId = value => String(value || '').replace(/[^a-zA-Z0-9]/g, '').slice(-5).toUpperCase() || 'NUEVO';
const makeSku = design => {
  const words = String(design?.name || 'MANILLA').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 14) || 'MANILLA';
  return `AUR-${words}-${shortId(design?.id)}`;
};
const makeMaterialCode = material => `MAT-${shortId(material?.id)}`;
const formatQty = (qty, unit) => D.formatQuantity(number(qty), unit);

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
  const materialCodes = new Set();
  const materialsSource = Array.isArray(source.materials) && source.materials.length ? source.materials : DEFAULT_MATERIALS;
  let materials = materialsSource.filter(item => item && item.id && item.name).map((item, index) => {
    const material = { ...item };
    let code = cleanCode(material.code) || makeMaterialCode(material) || `MAT-${index + 1}`;
    while (materialCodes.has(code.toLowerCase())) code = `${code.slice(0, 25)}-${index + 1}`;
    materialCodes.add(code.toLowerCase());
    return {
      ...material,
      code,
      unit: D.normalizeUnit(material.unit),
      stock: Math.max(0, number(material.stock)),
      minStock: Math.max(0, number(material.minStock ?? settings.lowStock)),
      cost: Math.max(0, number(material.cost)),
      active: material.active !== false
    };
  });
  if (!materials.length) materials = DEFAULT_MATERIALS.map(material => ({ ...material }));

  const designSkus = new Set();
  const designs = (Array.isArray(source.designs) ? source.designs : []).filter(item => item && item.id && item.name).map((item, index) => {
    const design = { ...item };
    let sku = cleanCode(design.sku) || makeSku(design);
    while (designSkus.has(sku.toLowerCase())) sku = `${sku.slice(0, 25)}-${index + 1}`;
    designSkus.add(sku.toLowerCase());
    return {
      ...design,
      sku,
      components: D.aggregateComponents(Array.isArray(design.components) ? design.components : [])
        .map(component => ({ ...component, qty: Math.max(0, number(component.qty)) }))
        .filter(component => component.materialId && component.qty > 0),
      finishedStock: Math.max(0, number(design.finishedStock)),
      minFinishedStock: Math.max(0, Math.floor(number(design.minFinishedStock))),
      finishedUnitCost: Math.max(0, number(design.finishedUnitCost)),
      active: design.active !== false
    };
  });

  const productions = (Array.isArray(source.productions) ? source.productions : []).filter(item => item && item.id && item.designId).map(item => {
    const produced = Math.max(0, Math.floor(number(item.quantityProduced)));
    const status = item.status === 'Anulada' ? 'Anulada' : 'Completada';
    return {
      ...item,
      quantityProduced: produced,
      availableQuantity: status === 'Anulada' ? 0 : Math.min(produced, Math.max(0, number(item.availableQuantity ?? produced))),
      unitCost: Math.max(0, number(item.unitCost)),
      totalCost: Math.max(0, number(item.totalCost ?? number(item.unitCost) * produced)),
      componentsSnapshot: Array.isArray(item.componentsSnapshot) ? item.componentsSnapshot : [],
      source: item.source || 'Fabricación',
      status
    };
  });

  const state = {
    ...source,
    schemaVersion: SCHEMA_VERSION,
    revision: Math.max(0, Math.floor(number(source.revision))),
    appliedOperations: Array.isArray(source.appliedOperations) ? source.appliedOperations.slice(-200) : [],
    settings,
    materials,
    designs,
    productions,
    sales: [],
    purchases: Array.isArray(source.purchases) ? source.purchases : [],
    movements: Array.isArray(source.movements) ? source.movements : [],
    customers: Array.isArray(source.customers) ? source.customers : [],
    expenses: Array.isArray(source.expenses) ? source.expenses : []
  };
  state.designs.forEach(design => D.recalculateDesignInventory(state, design.id));

  state.sales = (Array.isArray(source.sales) ? source.sales : []).filter(item => item && item.id).map(item => {
    const quantity = Math.max(1, Math.floor(number(item.quantity || 1)));
    const total = Math.max(0, number(item.total ?? item.price));
    const totalCost = Math.max(0, number(item.totalCost ?? item.cost));
    const inventoryMode = item.inventoryMode || (item.deductedInventory ? 'legacy-materials' : 'legacy-no-inventory');
    let payments = Array.isArray(item.payments) ? item.payments : [];
    let paymentMigrationPending = item.paymentMigrationPending === true;
    if (!payments.length && item.paymentStatus === 'Pagado' && total > 0) {
      payments = [{
        id: `pay_legacy_${item.id}`,
        amount: total,
        date: item.date,
        method: 'No registrado',
        notes: 'Migrado desde estado Pagado',
        status: 'Aplicado',
        source: 'legacy-status',
        createdAt: number(item.createdAt)
      }];
    } else if (!payments.length && item.paymentStatus === 'Abono') {
      paymentMigrationPending = true;
    }
    const sale = {
      ...item,
      quantity,
      unitPrice: Math.max(0, number(item.unitPrice ?? (quantity ? total / quantity : 0))),
      total,
      price: total,
      unitCost: Math.max(0, number(item.unitCost ?? (quantity ? totalCost / quantity : 0))),
      totalCost,
      cost: totalCost,
      profit: number(item.profit ?? total - totalCost),
      inventoryMode,
      lotAllocations: Array.isArray(item.lotAllocations) ? item.lotAllocations : [],
      payments,
      refunds: Array.isArray(item.refunds) ? item.refunds : [],
      paymentMigrationPending
    };
    sale.paymentStatus = D.paymentSummary(sale).status;
    return sale;
  });
  return state;
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
    const serialized = JSON.stringify(S);
    localStorage.setItem(LOCAL_KEY, serialized);
    if (serialized.length > 4_000_000) setSync('error', 'Respaldo recomendado');
    return true;
  } catch (error) {
    console.warn('No fue posible guardar todos los datos en este dispositivo:', error);
    setSync('error', 'Sin espacio local');
    return false;
  }
}

function persist() {
  if (criticalInFlight) {
    if (criticalBaseState) S = normalizeState(clone(criticalBaseState));
    saveLocalState();
    renderAll();
    toast('Espera a que termine la operación en curso y repite este cambio.');
    return;
  }
  const savedLocally = saveLocalState();
  if (!savedLocally) toast('El dispositivo no tiene espacio para guardar más fotos');
  renderAll();
  pendingLocalChanges = true;
  localGeneration += 1;
  const generation = localGeneration;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => syncNonCriticalState(generation), 350);
}

async function reloadRemoteAfterConflict() {
  if (!db) return;
  const snapshot = await db.ref(DATA_PATH).once('value');
  if (!snapshot.exists()) return;
  S = normalizeState(snapshot.val());
  lastRemoteRevision = number(S.revision);
  pendingLocalChanges = false;
  localGeneration += 1;
  saveLocalState();
  renderAll();
}

async function syncNonCriticalState(generation) {
  if (!db) return;
  if (!firebaseConnected) {
    setSync('error', 'Cambios locales pendientes');
    return;
  }
  const expectedRevision = lastRemoteRevision;
  const localSnapshot = normalizeState(clone(S));
  let conflict = false;
  try {
    saving = true;
    setSync('', 'Guardando');
    const result = await db.ref(DATA_PATH).transaction(currentRaw => {
      const current = normalizeState(currentRaw || {});
      if (number(current.revision) !== expectedRevision) {
        conflict = true;
        return;
      }
      localSnapshot.revision = expectedRevision + 1;
      localSnapshot.schemaVersion = SCHEMA_VERSION;
      localSnapshot.updatedAt = Date.now();
      return localSnapshot;
    }, undefined, false);
    if (!result.committed) {
      await reloadRemoteAfterConflict();
      toast(conflict ? 'Había cambios nuevos en otro dispositivo. Se recargó la información; repite el último cambio.' : 'No fue posible guardar el cambio.');
      return;
    }
    const remote = normalizeState(result.snapshot.val());
    lastRemoteRevision = number(remote.revision);
    if (generation === localGeneration) {
      S = remote;
      pendingLocalChanges = false;
      saveLocalState();
      renderAll();
      setSync('online', 'Sincronizado');
    } else {
      pendingLocalChanges = true;
      setTimeout(() => syncNonCriticalState(localGeneration), 0);
    }
  } catch (error) {
    setSync('error', 'Cambios locales pendientes');
    console.warn('Error guardando en Firebase:', error);
  } finally {
    saving = false;
  }
}

async function commitCritical(operation, mutate) {
  const operationId = typeof operation === 'string' ? operation : operation?.id;
  if (!operationId) return { ok: false, error: 'No fue posible identificar la operación.' };
  if (criticalInFlight) return { ok: false, error: 'Ya se está confirmando otra operación. Espera un momento.' };
  criticalBaseState = clone(S);
  criticalInFlight = true;
  try {
    const result = await commitCriticalInternal(operationId, mutate);
    if (result.ok && typeof operation === 'object') clearCriticalOperation(operation);
    return result;
  } finally {
    criticalInFlight = false;
    criticalBaseState = null;
  }
}

async function commitCriticalInternal(operationId, mutate) {
  if (!db) {
    return { ok: false, error: 'No fue posible conectar con Firebase. Recarga la aplicación antes de modificar inventario, ventas o pagos.' };
  }
  if (!firebaseConnected) {
    return { ok: false, error: 'Necesitas conexión para modificar inventario, ventas o pagos de forma segura.' };
  }
  if (pendingLocalChanges) {
    clearTimeout(saveTimer);
    await syncNonCriticalState(localGeneration);
    if (pendingLocalChanges) {
      return { ok: false, error: 'Primero debe sincronizarse el cambio anterior. Revisa la conexión y vuelve a intentarlo.' };
    }
  }

  let operationError = '';
  let outcome = null;
  try {
    saving = true;
    setSync('', 'Confirmando');
    const result = await db.ref(DATA_PATH).transaction(currentRaw => {
      operationError = '';
      const next = normalizeState(currentRaw || S);
      if ((next.appliedOperations || []).includes(operationId)) {
        outcome = { ok: true, duplicate: true };
        next.schemaVersion = SCHEMA_VERSION;
        next.revision = number(next.revision) + 1;
        next.updatedAt = Date.now();
        return next;
      }
      outcome = mutate(next);
      if (!outcome?.ok) {
        operationError = outcome?.error || 'La operación no pudo completarse.';
        return;
      }
      next.appliedOperations = [...new Set([...(next.appliedOperations || []), operationId])].slice(-200);
      next.schemaVersion = SCHEMA_VERSION;
      next.revision = number(next.revision) + 1;
      next.updatedAt = Date.now();
      return next;
    }, undefined, false);
    if (!result.committed) return { ok: false, error: operationError || 'La información cambió; vuelve a intentarlo.' };
    S = normalizeState(result.snapshot.val());
    lastRemoteRevision = number(S.revision);
    pendingLocalChanges = false;
    localGeneration += 1;
    saveLocalState();
    renderAll();
    setSync('online', 'Sincronizado');
    return outcome || { ok: true };
  } catch (error) {
    console.warn('Operación transaccional:', error);
    try {
      const verification = await db.ref(DATA_PATH).once('value');
      const remote = verification.exists() ? normalizeState(verification.val()) : null;
      if (remote && (remote.appliedOperations || []).includes(operationId)) {
        S = remote;
        lastRemoteRevision = number(S.revision);
        pendingLocalChanges = false;
        localGeneration += 1;
        saveLocalState();
        renderAll();
        setSync('online', 'Sincronizado');
        return outcome || { ok: true, reconciled: true };
      }
    } catch (verificationError) {
      console.warn('No fue posible verificar la operación después del error:', verificationError);
    }
    return { ok: false, error: 'No fue posible confirmar la operación. Revisa la conexión e inténtalo otra vez.' };
  } finally {
    saving = false;
  }
}

async function migrateRemoteState(snapshot) {
  const raw = snapshot.exists() ? snapshot.val() : null;
  if (raw?.schemaVersion === SCHEMA_VERSION) return normalizeState(raw);
  const result = await db.ref(DATA_PATH).transaction(currentRaw => {
    const next = normalizeState(currentRaw || S);
    next.schemaVersion = SCHEMA_VERSION;
    next.revision = number(next.revision) + 1;
    next.updatedAt = Date.now();
    return next;
  }, undefined, false);
  return normalizeState(result.snapshot.val());
}

function trackConnection() {
  if (!db) return;
  db.ref('.info/connected').on('value', snapshot => {
    firebaseConnected = snapshot.val() === true;
    if (!firebaseConnected) {
      setSync('error', pendingLocalChanges ? 'Cambios locales pendientes' : 'Sin conexión');
      return;
    }
    setSync('online', pendingLocalChanges ? 'Sincronizando' : 'Sincronizado');
    if (pendingLocalChanges && !saving) syncNonCriticalState(localGeneration);
  });
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
    if (firebase.appCheck) {
      firebase.appCheck().activate(
        new firebase.appCheck.ReCaptchaEnterpriseProvider(APP_CHECK_SITE_KEY),
        true
      );
    }
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
    trackConnection();
    const snapshot = await Promise.race([
      db.ref(DATA_PATH).once('value'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5500))
    ]);
    S = await migrateRemoteState(snapshot);
    reconcilePendingCritical();
    lastRemoteRevision = number(S.revision);
    pendingLocalChanges = false;
    saveLocalState();
    setSync('online', 'Sincronizado');
    db.ref(DATA_PATH).on('value', snap => {
      if (saving || pendingLocalChanges || !snap.exists()) return;
      const incoming = normalizeState(snap.val());
      if (number(incoming.revision) < lastRemoteRevision) return;
      S = incoming;
      lastRemoteRevision = number(S.revision);
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
  renderGettingStarted();
  renderInventory();
  renderDesigner();
  renderSales();
  renderManagement();
}

function activeSales() {
  return S.sales.filter(sale => sale.status !== 'Cancelada');
}

function setupTasks() {
  const hasInventory = S.materials.some(material => number(material.stock) > 0);
  const hasDesign = S.designs.some(design => design.active !== false && (design.components || []).length);
  const hasProduction = S.productions.some(production => production.status !== 'Anulada')
    || S.designs.some(design => number(design.finishedStock) > 0);
  const hasSale = S.sales.some(sale => sale.status !== 'Cancelada');
  const hasBackup = number(S.settings.lastBackupAt) > 0;
  return [
    {
      id: 'inventory',
      done: hasInventory,
      title: 'Cargar los materiales que ya tienes',
      pending: 'Cuenta balines, hilos, dijes y empaques antes de comenzar.',
      complete: 'Ya tienes materiales con existencias.',
      button: 'Abrir inventario'
    },
    {
      id: 'design',
      done: hasDesign,
      title: 'Guardar la primera manilla',
      pending: 'Crea su receta con los materiales de una sola unidad.',
      complete: 'Ya guardaste al menos un diseño con receta.',
      button: 'Crear diseño'
    },
    {
      id: 'production',
      done: hasProduction,
      title: 'Cargar o fabricar manillas terminadas',
      pending: 'Registra las que ya están hechas o fabrica un lote nuevo.',
      complete: 'Ya existe inventario o historial de producción.',
      button: 'Ir a producción'
    },
    {
      id: 'sale',
      done: hasSale,
      title: 'Registrar la primera venta',
      pending: 'Guarda cliente, cantidad, precio y cuánto dinero recibiste.',
      complete: 'La primera venta ya está registrada.',
      button: 'Registrar venta'
    },
    {
      id: 'backup',
      done: hasBackup,
      title: 'Descargar el primer respaldo',
      pending: 'Guarda una copia de seguridad al terminar la jornada.',
      complete: `Último respaldo: ${dateText(S.settings.lastBackupAt)}`,
      button: 'Descargar'
    }
  ];
}

function renderGettingStarted() {
  const container = $('#setup-checklist');
  if (!container) return;
  const tasks = setupTasks();
  const completed = tasks.filter(task => task.done).length;
  const percentage = Math.round(completed / tasks.length * 100);
  $('#setup-progress-bar').style.width = `${percentage}%`;
  $('#setup-progress-text').textContent = `${completed} de ${tasks.length} pasos`;
  $('#getting-started').classList.toggle('complete', completed === tasks.length);
  $('#getting-started-title').textContent = completed === tasks.length
    ? '¡Aurea está lista para trabajar!'
    : 'Aprende mientras organizas Aurea';
  container.innerHTML = tasks.map((task, index) => `
    <article class="setup-task ${task.done ? 'done' : ''}">
      <span class="setup-task-status" aria-hidden="true">${task.done ? '✓' : index + 1}</span>
      <div>
        <b>${esc(task.title)}</b>
        <p>${esc(task.done ? task.complete : task.pending)}</p>
      </div>
      <button class="btn ${task.done ? 'btn-outline' : 'btn-soft'} btn-sm" type="button" onclick="runSetupAction('${task.id}')">${task.done ? 'Ver' : esc(task.button)}</button>
    </article>
  `).join('');
}

function runSetupAction(action) {
  if (action === 'inventory') {
    showView('inventory');
    toast('Abre un material para cargar lo que ya tienes o usa ＋ Compra');
    return;
  }
  if (action === 'design') {
    showView('designer');
    return;
  }
  if (action === 'production') {
    showView('management', 'production');
    return;
  }
  if (action === 'sale') {
    openSale();
    return;
  }
  if (action === 'backup') downloadBackup();
}

function guideGo(view, tab = '') {
  closeModal();
  showView(view, tab);
}

function openUserGuide() {
  openModal(`<div class="modal-head"><div><span class="guide-label">Guía sencilla</span><h3>¿Qué debo hacer en Aurea?</h3></div><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="guide-intro"><b>No necesitas aprender todo el primer día.</b><p>Sigue este orden y registra cada movimiento cuando ocurra. Aurea hará los cálculos de inventario, costos, utilidad y saldos.</p></div>
    <div class="guide-routine">
      <button type="button" onclick="guideGo('inventory')"><span>1</span><div><b>Cuando compras materiales</b><small>Inventario → busca el material → ＋ Compra.</small></div></button>
      <button type="button" onclick="guideGo('designer')"><span>2</span><div><b>Cuando creas un modelo</b><small>Diseñar → agrega la receta de una manilla → Guardar.</small></div></button>
      <button type="button" onclick="guideGo('management','production')"><span>3</span><div><b>Cuando fabricas manillas</b><small>Gestión → Producción → Fabricar. Aquí se descuentan los materiales.</small></div></button>
      <button type="button" onclick="guideGo('sales')"><span>4</span><div><b>Cuando vendes</b><small>Ventas → ＋ Venta. Registra solamente el dinero recibido.</small></div></button>
      <button type="button" onclick="guideGo('management','receivables')"><span>5</span><div><b>Cuando te pagan después</b><small>Gestión → Cartera → Registrar abono.</small></div></button>
      <button type="button" onclick="guideGo('management','expenses')"><span>6</span><div><b>Cuando sale dinero del negocio</b><small>Gestión → Gastos → anota transporte, publicidad o herramientas.</small></div></button>
    </div>
    <div class="guide-safety">
      <b>Si te equivocas</b>
      <p>No registres lo mismo otra vez. En ventas, compras y abonos usa <strong>Anular</strong> para conservar la historia. Si no sabes qué hacer, descarga primero un respaldo.</p>
      <b>Al terminar el día</b>
      <p>Confirma que arriba diga <strong>Sincronizado</strong> y descarga el respaldo desde Gestión → Ajustes.</p>
    </div>
    <div class="modal-actions"><button class="btn btn-outline" onclick="closeModal()">Cerrar</button><button class="btn btn-primary" onclick="guideGo('inventory')">Comenzar por inventario</button></div>`);
}

function isCurrentMonth(value) {
  const date = new Date(value || Date.now());
  const now = new Date();
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

function renderDashboard() {
  const sales = activeSales().filter(sale => isCurrentMonth(sale.date || sale.createdAt));
  const expenses = S.expenses.filter(expense => expense.active !== false && isCurrentMonth(expense.date || expense.createdAt));
  const revenue = sales.reduce((sum, sale) => sum + number(sale.total ?? sale.price), 0);
  const grossProfit = sales.reduce((sum, sale) => sum + number(sale.profit), 0);
  const expenseTotal = expenses.reduce((sum, expense) => sum + number(expense.amount), 0);
  const rawInventoryValue = S.materials.reduce((sum, material) => sum + number(material.stock) * number(material.cost), 0);
  const finishedInventoryValue = S.productions
    .filter(production => production.status !== 'Anulada')
    .reduce((sum, production) => sum + number(production.availableQuantity) * number(production.unitCost), 0);
  const rawUnits = S.materials.reduce((sum, material) => sum + number(material.stock), 0);
  const finishedUnits = S.designs.reduce((sum, design) => sum + number(design.finishedStock), 0);
  const lowMaterials = S.materials.filter(material => material.active !== false && number(material.stock) <= number(material.minStock ?? S.settings.lowStock)).length;
  const lowProducts = S.designs.filter(design => design.active !== false && number(design.minFinishedStock) > 0 && number(design.finishedStock) <= number(design.minFinishedStock)).length;
  const paymentTotals = activeSales().reduce((totals, sale) => {
    const summary = D.paymentSummary(sale);
    totals.collected += summary.paid;
    totals.receivables += summary.balance;
    return totals;
  }, { collected: 0, receivables: 0 });

  $('#stat-sales').textContent = money(revenue);
  $('#stat-profit').textContent = money(grossProfit);
  $('#stat-expenses').textContent = money(expenseTotal);
  $('#stat-net').textContent = money(grossProfit - expenseTotal);
  $('#stat-inventory').textContent = money(rawInventoryValue + finishedInventoryValue);
  $('#stat-units').textContent = `${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(rawUnits)} insumos · ${finishedUnits} manillas`;
  $('#stat-low').textContent = String(lowMaterials + lowProducts);
  $('#stat-sales-count').textContent = `${sales.reduce((sum, sale) => sum + number(sale.quantity || 1), 0)} unidad${sales.reduce((sum, sale) => sum + number(sale.quantity || 1), 0) === 1 ? '' : 'es'}`;
  $('#stat-collected').textContent = money(paymentTotals.collected);
  $('#stat-receivables').textContent = money(paymentTotals.receivables);

  const recent = [...S.sales].sort((a, b) => number(b.createdAt) - number(a.createdAt)).slice(0, 4);
  $('#recent-sales').innerHTML = recent.length
    ? recent.map(sale => saleCard(sale, false)).join('')
    : '<div class="card empty"><b>Aún no hay ventas</b>Registra la primera venta para ver tus resultados.</div>';
}

function getMaterial(id) { return S.materials.find(material => material.id === id); }
function getDesign(id) { return S.designs.find(design => design.id === id); }
function getProduction(id) { return S.productions.find(production => production.id === id); }
function getCustomer(id) { return S.customers.find(customer => customer.id === id); }

function materialIsUsed(id) {
  return S.designs.some(design => (design.components || []).some(component => component.materialId === id)) ||
    S.purchases.some(purchase => purchase.materialId === id) ||
    S.productions.some(production => (production.componentsSnapshot || []).some(component => component.materialId === id)) ||
    S.movements.some(movement => movement.materialId === id);
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
      <div><div class="material-name">${esc(material.name)} · ${esc(material.size || '')}</div><div class="material-meta">${esc(material.code)} · ${esc(material.category)} · Costo ${money(material.cost)} por ${esc(D.unitLabel(material.unit, 1))} ${material.active === false ? '· Inactivo' : ''}</div></div>
      <div class="stock ${low ? 'low' : ''}"><b>${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(number(material.stock))}</b><span>${esc(D.unitLabel(material.unit, material.stock))}</span></div>
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
  select.innerHTML = materials.map(material => `<option value="${material.id}">${esc(material.name)} ${esc(material.size || '')} · ${money(material.cost)}/${esc(D.unitLabel(material.unit, 1))}</option>`).join('');
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
  const material = id ? getMaterial(id) : { code: '', name: '', category: 'Dije', size: '', unit: 'unidad', cost: 0, stock: 0, minStock: 5, active: true };
  const unitLocked = Boolean(id && (materialIsUsed(id) || number(material.stock) !== 0));
  openModal(`<div class="modal-head"><h3>${id ? 'Editar' : 'Nuevo'} material</h3><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="form-grid two">
      <div class="field"><label>Nombre</label><input class="input" id="m-name" value="${esc(material.name)}"></div>
      <div class="field"><label>Código</label><input class="input" id="m-code" maxlength="30" value="${esc(material.code || '')}" placeholder="Ej. BAL-NEG-4MM"></div>
      <div class="field"><label>Categoría</label><select class="input" id="m-category">${['Balín', 'Neopreno', 'Dije', 'Hilo', 'Empaque', 'Otro'].map(item => `<option ${material.category === item ? 'selected' : ''}>${item}</option>`).join('')}</select></div>
      <div class="field"><label>Tamaño / referencia</label><input class="input" id="m-size" value="${esc(material.size || '')}" placeholder="Ej. 6 mm"></div>
      <div class="field"><label>Unidad base</label><select class="input" id="m-unit" ${unitLocked ? 'disabled' : ''}>${['unidad', 'centímetro', 'metro', 'gramo'].map(item => `<option value="${item}" ${D.normalizeUnit(material.unit) === item ? 'selected' : ''}>${item[0].toUpperCase() + item.slice(1)}</option>`).join('')}</select>${unitLocked ? '<span class="help">No se puede cambiar porque ya tiene stock o movimientos.</span>' : ''}</div>
      <div class="field"><label>Costo por unidad base</label><input class="input" id="m-cost" type="number" min="0" step="0.01" value="${number(material.cost)}"></div>
      <div class="field"><label>Stock actual</label><input class="input" id="m-stock" type="number" min="0" value="${number(material.stock)}"></div>
      <div class="field"><label>Stock mínimo</label><input class="input" id="m-min" type="number" min="0" value="${number(material.minStock ?? 5)}"></div>
    </div>
    <div class="modal-actions">
      ${id && !materialIsUsed(id) && number(material.stock) === 0 ? `<button class="btn btn-danger" onclick="deleteMaterial('${id}')">Eliminar</button>` : ''}
      <button class="btn btn-outline" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="saveMaterial()">Guardar</button>
    </div>`);
}

async function saveMaterial() {
  const name = $('#m-name').value.trim();
  const requestedCode = cleanCode($('#m-code').value);
  const cost = number($('#m-cost').value);
  const stock = number($('#m-stock').value);
  const minStock = number($('#m-min').value);
  const unit = D.normalizeUnit($('#m-unit').value);
  const category = $('#m-category').value;
  const size = $('#m-size').value.trim();
  if (!name || cost < 0 || stock < 0 || minStock < 0) { toast('Revisa nombre, costo y existencias'); return; }
  const operation = createCriticalOperation('op_material', [
    editingMaterialId || 'new', requestedCode || 'auto', name, category, size, unit, cost, stock, minStock
  ]);
  const materialId = editingMaterialId || `mat_${operation.id}`;
  const code = requestedCode || makeMaterialCode({ id: materialId });
  const timestamp = Date.now();
  const operationId = operation.id;
  const result = await commitCritical(operation, state => {
    if (state.materials.some(item => item.id !== materialId && String(item.code || '').toLowerCase() === code.toLowerCase())) {
      return { ok: false, error: 'Ya existe otro material con ese código.' };
    }
    const material = state.materials.find(item => item.id === materialId);
    if (material) {
      const used = state.designs.some(design => (design.components || []).some(component => component.materialId === material.id))
        || state.purchases.some(purchase => purchase.materialId === material.id)
        || state.productions.some(production => (production.componentsSnapshot || []).some(component => component.materialId === material.id))
        || state.movements.some(movement => movement.materialId === material.id);
      if (D.normalizeUnit(material.unit) !== unit && (used || number(material.stock) !== 0)) {
        return { ok: false, error: 'La unidad base no puede cambiarse después de usar el material.' };
      }
      const oldStock = number(material.stock);
      Object.assign(material, {
        code, name, category, size, unit,
        cost, stock, minStock, updatedAt: timestamp
      });
      if (Math.abs(oldStock - stock) > 1e-9) {
        state.movements.push({
          id: `${operationId}_stock`, materialId: material.id, materialName: material.name, unit,
          type: 'Ajuste manual', qty: stock - oldStock, date: new Date(timestamp).toISOString(), createdAt: timestamp
        });
      }
    } else {
      state.materials.push({
        id: materialId, code, name, category, size, unit,
        cost, stock, minStock, active: true, createdAt: timestamp
      });
      if (stock > 0) {
        state.movements.push({
          id: `${operationId}_initial`, materialId, materialName: name, unit,
          type: 'Inventario inicial', qty: stock, cost, date: new Date(timestamp).toISOString(), createdAt: timestamp
        });
      }
    }
    return { ok: true };
  });
  if (!result.ok) { toast(result.error); return; }
  closeModal();
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
        <div class="field"><label>Cantidad</label><input class="input" disabled value="${esc(formatQty(purchase.qty, purchase.unit || getMaterial(purchase.materialId)?.unit))}"></div>
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
      <div class="field"><label>Cantidad que ingresa (${esc(D.unitLabel(material.unit, 2))})</label><input class="input" id="p-qty" type="number" min="0.01" step="0.01" value="12"></div>
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
    const selected = getMaterial($('#p-material').value);
    $('#p-preview').textContent = qty ? `Nuevo lote: ${money((total + shipping) / qty)} por ${D.unitLabel(selected?.unit, 1)}. Se calculará costo promedio.` : '';
  };
  ['#p-qty', '#p-total', '#p-shipping'].forEach(selector => { $(selector).oninput = updatePurchasePreview; });
  $('#p-material').onchange = () => {
    const selected = getMaterial($('#p-material').value);
    $('#p-total').value = number(selected?.cost) * number($('#p-qty').value || 12);
    updatePurchasePreview();
  };
  updatePurchasePreview();
}

async function savePurchase() {
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
  const qty = number($('#p-qty').value);
  const total = number($('#p-total').value);
  const shipping = number($('#p-shipping').value);
  const provider = $('#p-provider').value.trim();
  const date = $('#p-date').value;
  const notes = $('#p-notes').value.trim();
  if (qty <= 0 || total < 0 || shipping < 0) { toast('Cantidad o valor inválido'); return; }
  const timestamp = Date.now();
  const operation = createCriticalOperation('op_purchase', [
    materialId, qty, total, shipping, provider, date, notes
  ]);
  const operationId = operation.id;
  const purchaseId = `buy_${operationId}`;
  const result = await commitCritical(operation, state => {
    const material = D.getMaterial(state, materialId);
    if (!material) return { ok: false, error: 'El material ya no está disponible.' };
    const oldStock = number(material.stock);
    const oldCost = number(material.cost);
    const oldValue = oldStock * oldCost;
    const unitCost = (total + shipping) / qty;
    material.cost = (oldValue + total + shipping) / (oldStock + qty);
    material.stock = oldStock + qty;
    material.updatedAt = timestamp;
    const purchase = {
      id: purchaseId, operationId, materialId, materialName: material.name, materialSize: material.size || '',
      unit: D.normalizeUnit(material.unit), qty, total, shipping, unitCost, previousCost: oldCost, previousStock: oldStock,
      provider, date, notes, status: 'Activa', createdAt: timestamp
    };
    state.purchases.push(purchase);
    state.movements.push({
      id: `${operationId}_stock`, materialId, materialName: material.name, unit: D.normalizeUnit(material.unit),
      type: 'Compra', qty, cost: unitCost, referenceType: 'purchase', referenceId: purchaseId, date, createdAt: timestamp
    });
    return { ok: true, purchase };
  });
  if (!result.ok) { toast(result.error); return; }
  closeModal();
  toast('Compra registrada y stock actualizado');
}

async function annulPurchase(id) {
  const purchase = S.purchases.find(item => item.id === id);
  if (!purchase || purchase.status === 'Anulada') return;
  if (!confirm('¿Anular esta compra y descontar sus unidades del inventario?')) return;
  const operation = createCriticalOperation('op_annul_purchase', [id]);
  const operationId = operation.id;
  const timestamp = Date.now();
  const result = await commitCritical(operation, state => {
    const currentPurchase = state.purchases.find(item => item.id === id);
    const material = currentPurchase ? D.getMaterial(state, currentPurchase.materialId) : null;
    if (!currentPurchase || !material || currentPurchase.status === 'Anulada') return { ok: false, error: 'La compra ya fue anulada.' };
    if (number(material.stock) + 1e-9 < number(currentPurchase.qty)) return { ok: false, error: 'No hay stock suficiente para reversar esta compra.' };
    const currentStock = number(material.stock);
    const currentValue = currentStock * number(material.cost);
    const reversalValue = number(currentPurchase.total) + number(currentPurchase.shipping);
    const newStock = currentStock - number(currentPurchase.qty);
    material.stock = newStock;
    material.cost = newStock > 0 ? Math.max(0, (currentValue - reversalValue) / newStock) : number(currentPurchase.previousCost || material.cost);
    material.updatedAt = timestamp;
    currentPurchase.status = 'Anulada';
    currentPurchase.annulledAt = timestamp;
    currentPurchase.annulOperationId = operationId;
    state.movements.push({
      id: `${operationId}_stock`, materialId: material.id, materialName: material.name, unit: D.normalizeUnit(material.unit),
      type: 'Anulación compra', qty: -number(currentPurchase.qty), referenceType: 'purchase', referenceId: id,
      date: new Date(timestamp).toISOString(), createdAt: timestamp
    });
    return { ok: true };
  });
  if (!result.ok) { toast(result.error); return; }
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
  const qty = Math.max(0.01, number($('#component-qty').value));
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
  component.qty = Math.max(0.01, number(component.qty) + delta);
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
      <div><div class="name">${esc(material.name)} ${esc(material.size || '')}</div><div class="meta">${money(material.cost)} por ${esc(D.unitLabel(material.unit, 1))} · stock ${esc(formatQty(material.stock, material.unit))}</div></div>
      <div class="qty-editor"><button onclick="changeComponentQty('${material.id}',-1)">−</button><span>${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(number(component.qty))}</span><button onclick="changeComponentQty('${material.id}',1)">＋</button></div>
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
    return material ? `<tr><td>${esc(material.name)} ${esc(material.size || '')}</td><td>${esc(formatQty(component.qty, material.unit))}</td><td>${money(material.cost)}</td><td>${money(number(material.cost) * number(component.qty))}</td></tr>` : '';
  }).join('');
  $('#cost-lines').innerHTML = rows || '<tr><td colspan="4" style="text-align:center;color:var(--muted)">Sin materiales</td></tr>';
  $('#cost-totals').innerHTML = `<tr><td colspan="3">Materiales</td><td>${money(prices.materials)}</td></tr>
    <tr><td colspan="3">Desperdicio (${number(S.settings.wastePct)}%)</td><td>${money(prices.waste)}</td></tr>
    <tr><td colspan="3">Mano de obra</td><td>${money(prices.labor)}</td></tr>
    <tr><td colspan="3">Empaque y presentación</td><td>${money(prices.packaging)}</td></tr>
    <tr><td colspan="3">Costo total</td><td>${money(prices.total)}</td></tr>
    ${number(S.settings.packaging) > 0 && currentComponents.some(component => getMaterial(component.materialId)?.category === 'Empaque') ? '<tr><td colspan="4"><span class="warning" style="display:block;text-align:left">La receta contiene un empaque y también se está sumando el costo fijo de presentación. Revisa que no sea el mismo gasto dos veces.</span></td></tr>' : ''}`;
  $('#price-min').textContent = money(prices.min);
  $('#price-rec').textContent = money(prices.rec);
  $('#price-premium').textContent = money(prices.premium);

  const saved = $('#saved-designs');
  const selected = saved.value;
  const activeDesigns = S.designs.filter(design => design.active !== false).sort((a, b) => number(b.updatedAt || b.createdAt) - number(a.updatedAt || a.createdAt));
  saved.innerHTML = '<option value="">Seleccionar diseño...</option>' + activeDesigns.map(design => `<option value="${design.id}">${esc(design.sku)} · ${esc(design.name)} · stock ${number(design.finishedStock)}</option>`).join('');
  if (activeDesigns.some(design => design.id === editingDesignId)) saved.value = editingDesignId;
  else if (activeDesigns.some(design => design.id === selected)) saved.value = selected;

  $('#save-design-btn').textContent = editingDesignId ? 'Actualizar' : 'Guardar';
  $('#edit-design-actions').classList.toggle('hidden', !editingDesignId);
  const operational = $('#product-operational-summary');
  const currentDesign = editingDesignId ? getDesign(editingDesignId) : null;
  const availability = D.productionAvailability(S, { components: currentComponents });
  if (currentDesign) {
    operational.classList.remove('hidden');
    operational.innerHTML = `<div class="operational-summary-grid">
      <div><b>${esc(currentDesign.sku)}</b>SKU</div>
      <div><b>${number(currentDesign.finishedStock)}</b>Terminadas</div>
      <div><b>${availability}</b>Puedes fabricar</div>
    </div>
    <button class="btn btn-dark btn-sm" type="button" onclick="openProduction('${currentDesign.id}')">Fabricar este diseño</button>`;
  } else {
    operational.classList.toggle('hidden', currentComponents.length === 0);
    operational.innerHTML = currentComponents.length
      ? `<div class="operational-summary-grid"><div><b>Nuevo</b>Producto</div><div><b>0</b>Terminadas</div><div><b>${availability}</b>Puedes fabricar</div></div><span class="help block">Guarda el diseño para habilitar la fabricación.</span>`
      : '';
  }
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
    '<div class="ai-message assistant">La imagen está importada. Escribe qué quieres cambiar, copia la corrección y pégala en la misma conversación de ChatGPT.</div>';
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
  pendingManualFeedback = '';
  $('#design-name').value = '';
  $('#design-sku').value = '';
  $('#design-min-stock').value = '0';
  $('#thread-color').value = 'Negro';
  $('#design-notes').value = '';
  $('#saved-designs').value = '';
  renderDesigner();
}

function saveDesign(options = {}) {
  const silent = options?.silent === true;
  const name = $('#design-name').value.trim();
  if (!name || !currentComponents.length) {
    if (!silent) toast('Agrega el nombre y la receta de materiales');
    return false;
  }
  const existing = editingDesignId ? getDesign(editingDesignId) : null;
  const designId = editingDesignId || uid('des');
  const sku = cleanCode($('#design-sku').value) || makeSku({ id: designId, name });
  if (S.designs.some(design => design.id !== editingDesignId && String(design.sku || '').toLowerCase() === sku.toLowerCase())) {
    if (!silent) toast('Ya existe otro diseño con ese SKU');
    return false;
  }
  const prices = priceData();
  const payload = {
    sku,
    name,
    minFinishedStock: Math.max(0, Math.floor(number($('#design-min-stock').value))),
    threadColor: $('#thread-color').value,
    notes: $('#design-notes').value.trim(),
    imageData: currentImageData || '',
    productImageData: currentProductImageData || '',
    aiResponseId: currentAIResponseId || '',
    aiVersions: currentAIVersions.slice(-2).map(version => ({
      ...version,
      imageUrl: version.imageUrl === currentImageData ? '' : version.imageUrl,
      isCurrent: version.imageUrl === currentImageData
    })),
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
    const design = existing;
    Object.assign(design, payload);
    if (!silent) toast('Diseño actualizado');
  } else {
    const design = { id: designId, ...payload, finishedStock: 0, finishedUnitCost: 0, createdAt: Date.now() };
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
  $('#design-sku').value = design.sku || makeSku(design);
  $('#design-min-stock').value = number(design.minFinishedStock);
  $('#thread-color').value = design.threadColor || 'Negro';
  $('#design-notes').value = design.notes || '';
  const legacyProductImage = String(design.imageData || '').startsWith('data:image/') && !design.productImageData && !design.aiResponseId;
  currentImageData = legacyProductImage ? '' : (design.imageData || '');
  currentProductImageData = design.productImageData || (legacyProductImage ? design.imageData : '');
  currentAIResponseId = design.aiResponseId || '';
  currentAIVersions = Array.isArray(design.aiVersions)
    ? design.aiVersions.map(version => ({ ...version, imageUrl: version.imageUrl || (version.isCurrent ? design.imageData || '' : '') }))
    : [];
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
  $('#design-sku').value = '';
  $('#design-min-stock').value = '0';
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
  const used = S.sales.some(sale => sale.designId === design.id) || S.productions.some(production => production.designId === design.id) || number(design.finishedStock) > 0;
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
  const referenceCount = (S.settings.aiStyleReferences || []).length;
  openModal(`<div class="modal-head"><h3>Crear la imagen con ChatGPT</h3><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="warning"><b>Pasos:</b><br>1. Copia y abre ChatGPT.<br>2. Adjunta la foto real del producto${referenceCount ? ` y tus ${referenceCount} referencia${referenceCount === 1 ? '' : 's'} visual${referenceCount === 1 ? '' : 'es'}` : ''}.<br>3. Pega este prompt y genera la imagen.<br>4. Descárgala sin textos y vuelve a Aurea para importarla.</div>
    <p class="help">Aurea añadirá después el logo, los textos y WhatsApp para que queden escritos correctamente.</p>
    <div class="prompt-box" id="ai-prompt-text">${esc(prompt)}</div>
    <div class="modal-actions"><button class="btn btn-outline" onclick="closeModal()">Cerrar</button><button class="btn btn-outline" onclick="copyAIPrompt()">Copiar prompt</button><button class="btn btn-primary" onclick="copyAIPromptAndOpenChatGPT()">Copiar y abrir ChatGPT</button></div>`);
}

async function copyAIPrompt() {
  const prompt = $('#ai-prompt-text')?.textContent || buildAIPrompt();
  try {
    await navigator.clipboard.writeText(prompt);
    toast('Prompt copiado');
    return true;
  } catch (error) {
    toast('No fue posible copiar; selecciónalo manualmente');
    return false;
  }
}

function openChatGPT() {
  window.open('https://chatgpt.com/', '_blank', 'noopener');
}

async function copyAIPromptAndOpenChatGPT() {
  const copied = await copyAIPrompt();
  if (!copied) return;
  closeModal();
  openChatGPT();
}

function prepareManualAI() {
  if (!currentComponents.length && !currentProductImageData) {
    toast('Agrega materiales o sube una foto real de la manilla');
    return;
  }
  showAIPrompt();
}

function buildManualRefinementPrompt(feedback) {
  return `Vamos a mejorar la última imagen de esta misma conversación para AUREA.

CAMBIO SOLICITADO
${feedback}

DEBES CONSERVAR
- La manilla real: forma, tejido, materiales, cantidades, orden, colores y proporciones.
- El encuadre comercial y la apariencia fotográfica premium.
- Espacio limpio arriba y abajo para que Aurea añada su plantilla.

IMPORTANTE
- Modifica únicamente lo solicitado.
- No agregues letras, logotipos, números, teléfono, sellos, iconos ni marcas de agua.
- Devuelve una nueva versión de la imagen lista para descargar.
- Si no puedes ver la última imagen, pídeme que la adjunte nuevamente.`;
}

async function prepareManualRefinement(instruction = '') {
  const feedback = String(instruction || $('#ai-feedback-input').value || '').trim();
  if (!currentImageData) { toast('Primero importa una presentación'); return; }
  if (feedback.length < 5) { toast('Describe el cambio que quieres hacer'); return; }
  pendingManualFeedback = feedback;
  try {
    await navigator.clipboard.writeText(buildManualRefinementPrompt(feedback));
    toast('Corrección copiada; pégala en la misma conversación de ChatGPT');
  } catch (error) {
    openModal(`<div class="modal-head"><h3>Corrección para ChatGPT</h3><button class="modal-close" onclick="closeModal()">×</button></div>
      <p class="help">Copia este mensaje y pégalo en la misma conversación donde generaste la imagen.</p>
      <div class="prompt-box">${esc(buildManualRefinementPrompt(feedback))}</div>
      <div class="modal-actions"><button class="btn btn-primary" onclick="closeModal()">Listo</button></div>`);
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
    currentProductImageData = await compressImage(file, 960, 0.72);
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

async function handleAIResultImage(file) {
  if (!file) return;
  const input = $('#ai-result-input');
  try {
    const importedImage = await compressImage(file, 1080, 0.76);
    const isFirstVersion = currentAIVersions.length === 0;
    const instruction = pendingManualFeedback || (isFirstVersion
      ? 'Primera presentación creada en ChatGPT'
      : 'Nueva versión importada desde ChatGPT');
    if (pendingManualFeedback) {
      currentAIChat.push({ role: 'user', text: pendingManualFeedback, createdAt: Date.now() });
    } else if (isFirstVersion) {
      currentAIChat.push({ role: 'user', text: 'Crear una presentación premium con el estilo de Aurea.', createdAt: Date.now() });
    }
    currentAIChat.push({
      role: 'assistant',
      text: isFirstVersion
        ? 'Primera versión importada. Puedes pedirme cambios en la misma conversación de ChatGPT.'
        : 'Nueva versión importada. Puedes seguir corrigiéndola o descargar la publicidad.',
      createdAt: Date.now()
    });
    currentAIChat = currentAIChat.slice(-20);
    const versionId = uid('aiv');
    currentImageData = importedImage;
    currentAIResponseId = '';
    currentAIVersions.push({
      id: versionId,
      parentId: currentAIVersionId || '',
      imageUrl: importedImage,
      responseId: '',
      instruction,
      chat: currentAIChat.slice(),
      createdAt: Date.now()
    });
    currentAIVersions = currentAIVersions.slice(-6);
    currentAIVersionId = versionId;
    pendingManualFeedback = '';
    $('#ai-feedback-input').value = '';
    renderDesigner();
    const autoSaved = saveDesign({ silent: true });
    toast(`Imagen importada${autoSaved ? ' y diseño guardado' : ''}`);
  } catch (error) {
    toast(error.message || 'No fue posible importar la imagen');
  } finally {
    if (input) input.value = '';
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
  let lines = [];
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
  if (lines.length > 1 && words.length >= 4 && words.length <= 10 && maxLines >= 2) {
    const balanced = [];
    for (let split = 1; split < words.length; split += 1) {
      const first = words.slice(0, split).join(' ');
      const second = words.slice(split).join(' ');
      const firstWidth = context.measureText(first).width;
      const secondWidth = context.measureText(second).width;
      if (firstWidth <= maxWidth && secondWidth <= maxWidth) {
        balanced.push({ lines: [first, second], score: Math.abs(firstWidth - secondWidth) });
      }
    }
    if (balanced.length) {
      balanced.sort((a, b) => a.score - b.score);
      lines = balanced[0].lines;
    }
  }
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

function productionLotNumber(id, date) {
  return `LOT-${String(date || new Date().toISOString()).slice(0, 10).replaceAll('-', '')}-${shortId(id)}`;
}

function productionPreview(designId, quantity) {
  const design = getDesign(designId);
  if (!design) return '';
  const qty = Math.max(1, Math.floor(number(quantity)));
  const costs = D.costBreakdown(S, design);
  const availability = D.productionAvailability(S, design);
  const componentLines = (design.components || []).map(component => {
    const material = getMaterial(component.materialId);
    return `<div class="modal-summary-row"><span>${esc(material?.name || component.name)} · disponibles ${esc(formatQty(material?.stock, material?.unit))}</span><b>${esc(formatQty(number(component.qty) * qty, material?.unit))}</b></div>`;
  }).join('');
  return `<div class="modal-summary-row"><span>Puedes fabricar ahora</span><b>${availability}</b></div>
    ${componentLines}
    <div class="modal-summary-row"><span>Costo unitario actual</span><b>${money(costs.total)}</b></div>
    <div class="modal-summary-row total"><span>Costo total del lote</span><b>${money(costs.total * qty)}</b></div>`;
}

function openProduction(designId = '') {
  const designs = S.designs.filter(design => design.active !== false && (design.components || []).length);
  if (!designs.length) { toast('Primero guarda un diseño con su receta'); showView('designer'); return; }
  const selectedId = designs.some(design => design.id === designId) ? designId : designs[0].id;
  openModal(`<div class="modal-head"><h3>Fabricar manillas</h3><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="form-grid two">
      <div class="field full"><label>Diseño / producto</label><select class="input" id="prod-design">${designs.map(design => `<option value="${design.id}" ${design.id === selectedId ? 'selected' : ''}>${esc(design.sku)} · ${esc(design.name)}</option>`).join('')}</select></div>
      <div class="field"><label>Cantidad a fabricar</label><input class="input" id="prod-qty" type="number" min="1" step="1" value="1"></div>
      <div class="field"><label>Fecha</label><input class="input" id="prod-date" type="date" value="${new Date().toISOString().slice(0, 10)}"></div>
      <div class="field full"><label>Notas del lote</label><textarea class="input" id="prod-notes" placeholder="Talla, color, pedido o responsable"></textarea></div>
    </div>
    <div class="modal-summary" id="prod-preview"></div>
    <p class="connection-required">La fabricación se confirma con conexión para evitar stock negativo entre celular y computador.</p>
    <div class="modal-actions"><button class="btn btn-outline" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" id="confirm-production-btn" onclick="saveProduction()">Fabricar</button></div>`);
  const refresh = () => { $('#prod-preview').innerHTML = productionPreview($('#prod-design').value, $('#prod-qty').value); };
  $('#prod-design').onchange = refresh;
  $('#prod-qty').oninput = refresh;
  refresh();
}

async function saveProduction() {
  const designId = $('#prod-design').value;
  const quantity = Number($('#prod-qty').value);
  const date = $('#prod-date').value;
  const notes = $('#prod-notes').value.trim();
  if (!Number.isInteger(quantity) || quantity <= 0) { toast('La cantidad debe ser un número entero mayor que cero'); return; }
  const operation = createCriticalOperation('op_production', [designId, quantity, date, notes]);
  const operationId = operation.id;
  const productionId = `prod_${operationId}`;
  const timestamp = Date.now();
  const result = await commitCritical(operation, state => D.applyProduction(state, {
    operationId,
    productionId,
    lotNumber: productionLotNumber(productionId, date),
    designId,
    quantity,
    source: 'Fabricación',
    date,
    notes,
    createdAt: timestamp
  }));
  if (!result.ok) { toast(result.error); return; }
  closeModal();
  toast(`${quantity} manilla${quantity === 1 ? '' : 's'} fabricada${quantity === 1 ? '' : 's'}`);
}

function openInitialFinishedStock(designId) {
  const design = getDesign(designId);
  if (!design) return;
  openModal(`<div class="modal-head"><h3>Inventario inicial terminado</h3><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="warning">Usa esta opción solo para manillas que ya estaban fabricadas antes de registrarlas. No descontará materiales nuevamente.</div>
    <div class="form-grid two" style="margin-top:12px">
      <div class="field full"><label>Producto</label><input class="input" disabled value="${esc(design.sku)} · ${esc(design.name)}"></div>
      <div class="field"><label>Cantidad existente</label><input class="input" id="initial-qty" type="number" min="1" step="1" value="1"></div>
      <div class="field"><label>Costo estimado por unidad</label><input class="input" id="initial-cost" type="number" min="1" value="${Math.round(number(design.cost || design.finishedUnitCost))}"></div>
      <div class="field"><label>Fecha</label><input class="input" id="initial-date" type="date" value="${new Date().toISOString().slice(0, 10)}"></div>
      <div class="field full"><label>Nota</label><textarea class="input" id="initial-notes" placeholder="Conteo inicial"></textarea></div>
    </div>
    <div class="modal-actions"><button class="btn btn-outline" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="saveInitialFinishedStock('${design.id}')">Registrar inventario</button></div>`);
}

async function saveInitialFinishedStock(designId) {
  const quantity = Number($('#initial-qty').value);
  const unitCost = number($('#initial-cost').value);
  const date = $('#initial-date').value;
  const notes = $('#initial-notes').value.trim();
  if (!Number.isInteger(quantity) || quantity <= 0 || unitCost <= 0) { toast('Revisa cantidad y costo'); return; }
  const operation = createCriticalOperation('op_initial_finished', [designId, quantity, unitCost, date, notes]);
  const operationId = operation.id;
  const productionId = `prod_initial_${operationId}`;
  const timestamp = Date.now();
  const result = await commitCritical(operation, state => D.applyProduction(state, {
    operationId,
    productionId,
    lotNumber: productionLotNumber(productionId, date),
    designId,
    quantity,
    unitCost,
    source: 'Inventario inicial',
    date,
    notes,
    createdAt: timestamp
  }));
  if (!result.ok) { toast(result.error); return; }
  closeModal();
  toast('Inventario inicial de manillas registrado');
}

async function annulProduction(id) {
  const production = getProduction(id);
  if (!production || production.status === 'Anulada') return;
  const message = production.source === 'Inventario inicial'
    ? '¿Anular este inventario inicial? Se retirarán las manillas terminadas.'
    : '¿Anular esta producción? Las manillas se desarmarán y los materiales volverán al inventario.';
  if (!confirm(message)) return;
  const operation = createCriticalOperation('op_annul_production', [id]);
  const operationId = operation.id;
  const timestamp = Date.now();
  const result = await commitCritical(operation, state => D.applyAnnulProduction(state, {
    operationId,
    productionId: id,
    date: new Date(timestamp).toISOString().slice(0, 10),
    createdAt: timestamp
  }));
  if (!result.ok) { toast(result.error); return; }
  toast('Producción anulada correctamente');
}

function renderProductions() {
  const productList = $('#product-stock-list');
  const productionList = $('#production-list');
  if (!productList || !productionList) return;
  const products = S.designs
    .filter(design => design.active !== false || number(design.finishedStock) > 0)
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  productList.innerHTML = products.length ? products.map(design => {
    const availability = D.productionAvailability(S, design);
    const low = number(design.minFinishedStock) > 0 && number(design.finishedStock) <= number(design.minFinishedStock);
    return `<article class="product-stock-card">
      <div class="product-stock-head"><div><b>${esc(design.name)}</b><small>${esc(design.sku)}${design.active === false ? ' · Inactivo' : ''}</small></div><span class="badge ${low ? 'pending' : 'active'}">${low ? 'Stock bajo' : 'Disponible'}</span></div>
      <div class="product-stock-metrics">
        <div><b>${number(design.finishedStock)}</b>Terminadas</div>
        <div><b>${availability}</b>Por fabricar</div>
        <div><b>${money(design.finishedUnitCost)}</b>Costo promedio</div>
      </div>
      <div class="product-stock-actions">
        ${design.active !== false ? `<button class="btn btn-primary btn-sm" onclick="openProduction('${design.id}')">Fabricar</button>` : ''}
        <button class="btn btn-outline btn-sm" onclick="openInitialFinishedStock('${design.id}')">Inventario inicial</button>
        <button class="btn btn-soft btn-sm" onclick="loadDesign('${design.id}');showView('designer')">Ver receta</button>
      </div>
    </article>`;
  }).join('') : '<div class="card empty"><b>No hay productos</b>Guarda primero un diseño con receta.</div>';

  const productions = [...S.productions].sort((a, b) => number(b.createdAt) - number(a.createdAt));
  productionList.innerHTML = productions.length ? productions.map(production => {
    const canAnnul = production.status !== 'Anulada' && number(production.availableQuantity) === number(production.quantityProduced);
    return `<article class="record">
      <div><div class="record-title">${esc(production.designName)} · ${esc(production.lotNumber)}</div><div class="record-meta">${dateText(production.date)} · ${esc(production.source)} · <span class="badge ${production.status === 'Anulada' ? 'cancelled' : 'production'}">${esc(production.status)}</span></div><div class="record-subline">Disponibles ${number(production.availableQuantity)} de ${number(production.quantityProduced)} · costo unitario ${money(production.unitCost)}</div></div>
      <div class="record-value"><b>${number(production.quantityProduced)} manilla${number(production.quantityProduced) === 1 ? '' : 's'}</b><span>${money(production.totalCost)}</span></div>
      ${production.status !== 'Anulada' ? `<div class="record-actions">${canAnnul ? `<button class="btn btn-danger btn-sm" onclick="annulProduction('${production.id}')">Anular lote</button>` : '<span class="help">No se puede anular porque alguna unidad fue vendida.</span>'}</div>` : ''}
    </article>`;
  }).join('') : '<div class="card empty"><b>No hay lotes</b>La primera fabricación aparecerá aquí.</div>';
}

function saleCard(sale, withActions = true) {
  const statusClass = sale.status === 'Cancelada' ? 'cancelled' : sale.paymentStatus === 'Pagado' ? 'paid' : 'pending';
  const summary = D.paymentSummary(sale);
  const quantity = number(sale.quantity || 1);
  return `<article class="record">
    <div><div class="record-title">${esc(sale.designName || 'Venta')} · ${quantity} ${quantity === 1 ? 'unidad' : 'unidades'}</div><div class="record-meta">${esc(sale.customer || 'Cliente no registrado')} · ${dateText(sale.date)} · <span class="badge ${statusClass}">${esc(sale.status === 'Cancelada' ? 'Cancelada' : summary.status)}</span></div><div class="record-subline">${esc(sale.designSku || '')}${sale.paymentMigrationPending ? ' · Abono histórico por conciliar' : ''}</div></div>
    <div class="record-value"><b>${money(sale.total ?? sale.price)}</b><span class="${number(sale.profit) >= 0 ? 'positive' : 'negative'}">Utilidad ${money(sale.profit)}</span><div class="record-subline">${summary.balance > 0 && sale.status !== 'Cancelada' ? `Saldo ${money(summary.balance)}` : `Recibido ${money(summary.paid)}`}</div></div>
    ${withActions && sale.status !== 'Cancelada' ? `<div class="record-actions"><button class="btn btn-outline btn-sm" onclick="openSale('${sale.id}')">Editar datos</button>${summary.balance > 0 ? `<button class="btn btn-soft btn-sm" onclick="openPayment('${sale.id}')">＋ Abono</button>` : ''}<button class="btn btn-danger btn-sm" onclick="openCancelSale('${sale.id}')">Anular</button></div>` : ''}
  </article>`;
}

function renderSales() {
  const search = ($('#sale-search')?.value || '').toLowerCase();
  const status = $('#sale-status')?.value || 'active';
  const list = [...S.sales].filter(sale => {
    const matchesSearch = `${sale.designName} ${sale.designSku} ${sale.customer} ${sale.phone}`.toLowerCase().includes(search);
    const matchesStatus = status === 'all' || (status === 'active' ? sale.status !== 'Cancelada' : sale.status === 'Cancelada');
    return matchesSearch && matchesStatus;
  }).sort((a, b) => number(b.createdAt) - number(a.createdAt));
  $('#sales-list').innerHTML = list.length ? list.map(sale => saleCard(sale, true)).join('') : '<div class="card empty"><b>No hay ventas registradas</b>Guarda un diseño y registra la primera venta.</div>';
}

function upsertCustomer(name, phone) {
  return upsertCustomerInState(S, name, phone, Date.now(), uid('cus'));
}

function upsertCustomerInState(state, name, phone, timestamp, fallbackId) {
  const cleanName = (name || '').trim();
  const cleanPhone = (phone || '').trim();
  if (!cleanName && !cleanPhone) return '';
  let customer = state.customers.find(item => cleanPhone && item.phone === cleanPhone);
  if (!customer) customer = state.customers.find(item => cleanName && String(item.name).toLowerCase() === cleanName.toLowerCase());
  if (customer) {
    if (cleanName) customer.name = cleanName;
    if (cleanPhone) customer.phone = cleanPhone;
    customer.active = true;
    customer.updatedAt = timestamp;
    return customer.id;
  }
  customer = { id: fallbackId, name: cleanName || cleanPhone, phone: cleanPhone, notes: '', active: true, createdAt: timestamp };
  state.customers.push(customer);
  return customer.id;
}

function openSale(id = '') {
  editingSaleId = id || null;
  const sale = id ? S.sales.find(item => item.id === id) : null;
  const designs = S.designs.filter(design => (design.active !== false || number(design.finishedStock) > 0) && (design.components || []).length);
  if (!sale && !designs.length) { toast('Primero guarda al menos un diseño'); showView('designer'); return; }
  const selectedDesign = sale ? getDesign(sale.designId) : designs[0];
  const saleSummary = sale ? D.paymentSummary(sale) : null;
  const defaultMode = number(selectedDesign?.finishedStock) > 0 ? 'finished-product' : 'make-to-order';
  const paymentHistory = sale ? [
    ...(sale.payments || []).map(payment => {
      const annulled = payment.status === 'Anulado';
      return `<div class="modal-summary-row"><span>${dateText(payment.date)} · ${esc(payment.method)}${annulled ? ' · Anulado' : ''}</span><span><b class="${annulled ? 'muted strike' : ''}">${money(payment.amount)}</b>${annulled ? '' : ` <button class="btn btn-danger btn-xs" onclick="openAnnulPayment('${sale.id}','${payment.id}')">Anular</button>`}</span></div>`;
    }),
    ...(sale.refunds || []).map(refund => `<div class="modal-summary-row"><span>${dateText(refund.date)} · Reembolso</span><b>−${money(refund.amount)}</b></div>`)
  ].join('') : '';

  openModal(`<div class="modal-head"><h3>${sale ? 'Editar' : 'Registrar'} venta</h3><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="form-grid two">
      <div class="field"><label>Diseño</label>${sale ? `<input class="input" disabled value="${esc(sale.designName)}">` : `<select class="input" id="s-design">${designs.map(design => `<option value="${design.id}">${esc(design.name)}</option>`).join('')}</select>`}</div>
      <div class="field"><label>Cantidad</label><input class="input" id="s-quantity" type="number" min="1" step="1" value="${sale ? number(sale.quantity || 1) : 1}" ${sale ? 'disabled' : ''}></div>
      <div class="field"><label>Precio por unidad</label><input class="input" id="s-price" type="number" min="0" value="${sale ? number(sale.unitPrice ?? sale.price) : number(selectedDesign?.priceRec)}"></div>
      ${sale ? `<div class="field"><label>Origen del inventario</label><input class="input" disabled value="${sale.inventoryMode === 'make-to-order' ? 'Fabricada bajo pedido' : sale.inventoryMode?.startsWith('legacy') ? 'Venta histórica' : 'Producto terminado'}"></div>` : `<div class="field"><label>Forma de entrega</label><select class="input" id="s-mode"><option value="finished-product" ${defaultMode === 'finished-product' ? 'selected' : ''}>Vender desde stock terminado</option><option value="make-to-order" ${defaultMode === 'make-to-order' ? 'selected' : ''}>Fabricar y vender bajo pedido</option></select></div>`}
      <div class="field"><label>Cliente</label><input class="input" id="s-customer" value="${esc(sale?.customer || '')}" placeholder="Nombre"></div>
      <div class="field"><label>WhatsApp</label><input class="input" id="s-phone" value="${esc(sale?.phone || '')}" inputmode="tel" placeholder="3XX XXX XXXX"></div>
      <div class="field"><label>Fecha</label><input class="input" id="s-date" type="date" value="${esc((sale?.date || new Date().toISOString()).slice(0, 10))}"></div>
      ${sale ? '' : `<div class="field"><label>Pago inicial</label><input class="input" id="s-initial-payment" type="number" min="0" value="0"></div><div class="field"><label>Medio de pago</label><select class="input" id="s-payment-method">${['Efectivo', 'Nequi', 'Daviplata', 'Transferencia', 'Tarjeta', 'Otro'].map(item => `<option>${item}</option>`).join('')}</select></div>`}
      <div class="field full"><label>Notas</label><textarea class="input" id="s-notes">${esc(sale?.notes || '')}</textarea></div>
    </div>
    <div class="modal-summary" id="sale-preview">${sale ? `<div class="modal-summary-row"><span>Total</span><b>${money(sale.total)}</b></div><div class="modal-summary-row"><span>Pagado</span><b>${money(saleSummary.paid)}</b></div><div class="modal-summary-row total"><span>Saldo</span><b>${money(saleSummary.balance)}</b></div>${paymentHistory}` : ''}</div>
    ${sale ? '<div class="warning">Producto, cantidad y costo histórico no cambian al editar. Para corregir el inventario, anula la venta y registra una nueva.</div>' : '<p class="connection-required">La venta se confirma con conexión para impedir sobreventa desde otro dispositivo.</p>'}
    <div class="modal-actions"><button class="btn btn-outline" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="saveSale()">Guardar venta</button></div>`);

  if (!sale) {
    const refresh = () => {
      const design = getDesign($('#s-design').value);
      const quantity = Math.max(1, Math.floor(number($('#s-quantity').value)));
      const total = quantity * number($('#s-price').value);
      const mode = $('#s-mode').value;
      const available = mode === 'finished-product' ? number(design?.finishedStock) : D.productionAvailability(S, design);
      $('#sale-preview').innerHTML = `<div class="modal-summary-row"><span>${mode === 'finished-product' ? 'Manillas terminadas disponibles' : 'Manillas que puedes fabricar'}</span><b>${available}</b></div><div class="modal-summary-row"><span>${quantity} × ${money($('#s-price').value)}</span><b>${money(total)}</b></div><div class="modal-summary-row total"><span>Total de la venta</span><b>${money(total)}</b></div>`;
    };
    $('#s-design').onchange = () => {
      const design = getDesign($('#s-design').value);
      if (design) {
        $('#s-price').value = number(design.priceRec);
        $('#s-mode').value = number(design.finishedStock) > 0 ? 'finished-product' : 'make-to-order';
      }
      refresh();
    };
    ['#s-quantity', '#s-price'].forEach(selector => { $(selector).oninput = refresh; });
    $('#s-mode').onchange = refresh;
    refresh();
  }
}

async function saveSale() {
  const unitPrice = number($('#s-price').value);
  if (unitPrice <= 0) { toast('Ingresa un precio válido'); return; }

  if (editingSaleId) {
    const customer = $('#s-customer').value.trim();
    const phone = $('#s-phone').value.trim();
    const date = $('#s-date').value;
    const notes = $('#s-notes').value.trim();
    const operation = createCriticalOperation('op_edit_sale', [
      editingSaleId, unitPrice, customer, phone, date, notes
    ]);
    const operationId = operation.id;
    const customerId = `cus_${operationId}`;
    const timestamp = Date.now();
    const result = await commitCritical(operation, state => {
      const sale = state.sales.find(item => item.id === editingSaleId);
      if (!sale || sale.status === 'Cancelada') return { ok: false, error: 'La venta no se puede editar.' };
      const newTotal = unitPrice * number(sale.quantity || 1);
      const summary = D.paymentSummary(sale);
      if (newTotal + 0.005 < summary.paid) return { ok: false, error: 'El nuevo total no puede ser menor que el dinero ya pagado.' };
      sale.customer = customer;
      sale.phone = phone;
      sale.customerId = upsertCustomerInState(state, customer, phone, timestamp, customerId);
      sale.unitPrice = unitPrice;
      sale.total = newTotal;
      sale.price = newTotal;
      sale.profit = newTotal - number(sale.totalCost ?? sale.cost);
      sale.paymentStatus = D.paymentSummary(sale).status;
      sale.date = date;
      sale.notes = notes;
      sale.updatedAt = timestamp;
      return { ok: true, sale };
    });
    if (!result.ok) { toast(result.error); return; }
    closeModal();
    toast('Venta actualizada');
    return;
  }

  const quantity = Number($('#s-quantity').value);
  if (!Number.isInteger(quantity) || quantity <= 0) { toast('La cantidad debe ser un número entero mayor que cero'); return; }
  const designId = $('#s-design').value;
  const mode = $('#s-mode').value;
  const initialPayment = number($('#s-initial-payment').value);
  const customer = $('#s-customer').value.trim();
  const phone = $('#s-phone').value.trim();
  const date = $('#s-date').value;
  const notes = $('#s-notes').value.trim();
  const paymentMethod = $('#s-payment-method').value;
  const operation = createCriticalOperation('op_sale', [
    designId, quantity, unitPrice, mode, initialPayment, paymentMethod, customer, phone, date, notes
  ]);
  const operationId = operation.id;
  const saleId = `sale_${operationId}`;
  const productionId = `prod_order_${operationId}`;
  const customerId = `cus_${operationId}`;
  const timestamp = Date.now();
  const result = await commitCritical(operation, state => {
    const linkedCustomerId = upsertCustomerInState(state, customer, phone, timestamp, customerId);
    const outcome = D.applySale(state, {
      operationId,
      saleId,
      productionId,
      lotNumber: productionLotNumber(productionId, date),
      paymentId: `${saleId}_payment_initial`,
      designId,
      quantity,
      unitPrice,
      mode,
      initialPayment,
      paymentMethod,
      customerId: linkedCustomerId,
      customer,
      phone,
      date,
      notes,
      createdAt: timestamp
    });
    if (!outcome.ok && linkedCustomerId === customerId) state.customers = state.customers.filter(item => item.id !== customerId);
    return outcome;
  });
  if (!result.ok) { toast(result.error); return; }
  closeModal();
  toast(mode === 'make-to-order' ? 'Manilla fabricada y venta registrada' : 'Venta registrada');
}

function openPayment(id) {
  const sale = S.sales.find(item => item.id === id);
  if (!sale || sale.status === 'Cancelada') return;
  const summary = D.paymentSummary(sale);
  if (summary.balance <= 0) { toast('La venta ya está pagada'); return; }
  openModal(`<div class="modal-head"><h3>Registrar abono</h3><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="modal-summary"><div class="modal-summary-row"><span>Total</span><b>${money(summary.total)}</b></div><div class="modal-summary-row"><span>Pagado</span><b>${money(summary.paid)}</b></div><div class="modal-summary-row total"><span>Saldo</span><b>${money(summary.balance)}</b></div></div>
    ${sale.paymentMigrationPending ? '<div class="warning">Esta venta tenía “Abono” en la versión anterior, pero no existía un valor guardado. Registra aquí el monto real recibido.</div>' : ''}
    <div class="form-grid two" style="margin-top:12px">
      <div class="field"><label>Valor del abono</label><input class="input" id="pay-amount" type="number" min="1" max="${summary.balance}" value="${summary.balance}"></div>
      <div class="field"><label>Medio</label><select class="input" id="pay-method">${['Efectivo', 'Nequi', 'Daviplata', 'Transferencia', 'Tarjeta', 'Otro'].map(item => `<option>${item}</option>`).join('')}</select></div>
      <div class="field"><label>Fecha</label><input class="input" id="pay-date" type="date" value="${new Date().toISOString().slice(0, 10)}"></div>
      <div class="field"><label>Referencia</label><input class="input" id="pay-reference" placeholder="Opcional"></div>
      <div class="field full"><label>Nota</label><textarea class="input" id="pay-notes"></textarea></div>
    </div>
    <div class="modal-actions"><button class="btn btn-outline" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="savePayment('${sale.id}')">Guardar abono</button></div>`);
}

async function savePayment(saleId) {
  const amount = number($('#pay-amount').value);
  const method = $('#pay-method').value;
  const date = $('#pay-date').value;
  const reference = $('#pay-reference').value.trim();
  const notes = $('#pay-notes').value.trim();
  const operation = createCriticalOperation('op_payment', [saleId, amount, method, date, reference, notes]);
  const operationId = operation.id;
  const paymentId = `pay_${operationId}`;
  const timestamp = Date.now();
  const input = {
    operationId, paymentId, saleId, amount, method,
    date, reference, notes, createdAt: timestamp
  };
  const result = await commitCritical(operation, state => D.applyPayment(state, input));
  if (!result.ok) { toast(result.error); return; }
  closeModal();
  toast('Abono registrado');
}

function openAnnulPayment(saleId, paymentId) {
  const sale = S.sales.find(item => item.id === saleId);
  const payment = sale?.payments?.find(item => item.id === paymentId);
  if (!sale || sale.status === 'Cancelada' || !payment || payment.status === 'Anulado') return;
  openModal(`<div class="modal-head"><h3>Anular abono</h3><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="warning">Usa esta opción únicamente cuando el abono fue registrado por error. El registro se conservará tachado para mantener la trazabilidad.</div>
    <div class="modal-summary"><div class="modal-summary-row total"><span>Valor</span><b>${money(payment.amount)}</b></div></div>
    <div class="field" style="margin-top:12px"><label>Motivo de la corrección</label><textarea class="input" id="payment-annul-reason">Abono registrado por error</textarea></div>
    <div class="modal-actions"><button class="btn btn-outline" onclick="closeModal()">Volver</button><button class="btn btn-danger" onclick="annulPayment('${saleId}','${paymentId}')">Confirmar anulación</button></div>`);
}

async function annulPayment(saleId, paymentId) {
  const reason = $('#payment-annul-reason')?.value.trim();
  if (!reason) { toast('Escribe el motivo de la corrección'); return; }
  const operation = createCriticalOperation('op_annul_payment', [saleId, paymentId, reason]);
  const operationId = operation.id;
  const result = await commitCritical(operation, state => D.applyAnnulPayment(state, {
    operationId,
    saleId,
    paymentId,
    reason,
    createdAt: Date.now()
  }));
  if (!result.ok) { toast(result.error); return; }
  closeModal();
  toast('Abono anulado; el saldo fue actualizado');
}

function openCancelSale(id) {
  const sale = S.sales.find(item => item.id === id);
  if (!sale || sale.status === 'Cancelada') return;
  const summary = D.paymentSummary(sale);
  const legacyMaterials = sale.inventoryMode === 'legacy-materials' || sale.deductedInventory;
  const inventoryMessage = legacyMaterials
    ? 'Esta venta pertenece a la versión anterior: la anulación devolverá sus materiales originales.'
    : `La anulación devolverá ${number(sale.quantity || 1)} manilla${number(sale.quantity || 1) === 1 ? '' : 's'} al inventario terminado. No devolverá balines ni hilos.`;
  openModal(`<div class="modal-head"><h3>Anular venta</h3><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="warning">${inventoryMessage}</div>
    ${summary.paid > 0 ? `<div class="modal-summary"><div class="modal-summary-row total"><span>Valor que debe devolverse</span><b>${money(summary.paid)}</b></div></div><div class="form-grid two" style="margin-top:12px"><div class="field"><label>Medio del reembolso</label><select class="input" id="refund-method">${['Mismo medio', 'Efectivo', 'Nequi', 'Daviplata', 'Transferencia', 'Otro'].map(item => `<option>${item}</option>`).join('')}</select></div><div class="field"><label>Fecha</label><input class="input" id="refund-date" type="date" value="${new Date().toISOString().slice(0, 10)}"></div><div class="field full"><label>Nota</label><textarea class="input" id="refund-notes">Reembolso por cancelación</textarea></div></div>` : `<input type="hidden" id="refund-date" value="${new Date().toISOString().slice(0, 10)}">`}
    <div class="modal-actions"><button class="btn btn-outline" onclick="closeModal()">Volver</button><button class="btn btn-danger" onclick="confirmCancelSale('${sale.id}')">Confirmar anulación</button></div>`);
}

function cancelSale(id) {
  openCancelSale(id);
}

async function confirmCancelSale(id) {
  const timestamp = Date.now();
  const refundMethod = $('#refund-method')?.value || 'Mismo medio';
  const refundNotes = $('#refund-notes')?.value.trim() || 'Reembolso por cancelación';
  const date = $('#refund-date')?.value || new Date(timestamp).toISOString().slice(0, 10);
  const operation = createCriticalOperation('op_cancel_sale', [id, refundMethod, refundNotes, date]);
  const operationId = operation.id;
  const result = await commitCritical(operation, state => D.applyCancelSale(state, {
    operationId,
    saleId: id,
    refundId: `refund_${operationId}`,
    refundMethod,
    refundNotes,
    date,
    createdAt: timestamp
  }));
  if (!result.ok) { toast(result.error); return; }
  closeModal();
  toast('Venta anulada e inventario terminado restaurado');
}

function deleteSale() {
  toast('Las ventas canceladas se conservan para mantener la trazabilidad.');
}

function renderReceivables() {
  const container = $('#receivables-list');
  if (!container) return;
  const sales = activeSales().sort((a, b) => {
    const balanceDiff = D.paymentSummary(b).balance - D.paymentSummary(a).balance;
    return balanceDiff || number(b.createdAt) - number(a.createdAt);
  });
  container.innerHTML = sales.length ? sales.map(sale => {
    const summary = D.paymentSummary(sale);
    return `<article class="record">
      <div><div class="record-title">${esc(sale.customer || 'Cliente no registrado')} · ${esc(sale.designName)}</div><div class="record-meta">${dateText(sale.date)} · <span class="badge ${summary.status === 'Pagado' ? 'paid' : 'pending'}">${esc(summary.status)}</span>${sale.paymentMigrationPending ? ' · Conciliación pendiente' : ''}</div><div class="balance-line"><span>Total ${money(summary.total)}</span><span>Pagado ${money(summary.paid)}</span></div></div>
      <div class="record-value"><b class="${summary.balance > 0 ? 'negative' : 'positive'}">${money(summary.balance)}</b><span>Saldo</span></div>
      ${summary.balance > 0 ? `<div class="record-actions"><button class="btn btn-soft btn-sm" onclick="openPayment('${sale.id}')">＋ Registrar abono</button><button class="btn btn-outline btn-sm" onclick="openSale('${sale.id}')">Ver venta</button></div>` : ''}
    </article>`;
  }).join('') : '<div class="card empty"><b>No hay ventas activas</b>Los saldos y pagos aparecerán aquí.</div>';
}

function renderManagement() {
  renderProductions();
  renderPurchases();
  renderReceivables();
  renderCustomers();
  renderExpenses();
  renderMovements();
  renderSettings();
}

function renderPurchases() {
  const list = [...S.purchases].sort((a, b) => number(b.createdAt) - number(a.createdAt));
  $('#purchases-list').innerHTML = list.length ? list.map(purchase => `<article class="record">
    <div><div class="record-title">${esc(purchase.materialName)} ${esc(purchase.materialSize || '')}</div><div class="record-meta">${dateText(purchase.date)} · ${esc(purchase.provider || 'Sin proveedor')} · <span class="badge ${purchase.status === 'Anulada' ? 'cancelled' : 'active'}">${esc(purchase.status || 'Activa')}</span></div></div>
    <div class="record-value"><b>${esc(formatQty(purchase.qty, purchase.unit || getMaterial(purchase.materialId)?.unit))}</b><span>${money(number(purchase.total) + number(purchase.shipping))}</span></div>
    <div class="record-actions"><button class="btn btn-outline btn-sm" onclick="openPurchase('', '${purchase.id}')">Editar datos</button>${purchase.status !== 'Anulada' ? `<button class="btn btn-danger btn-sm" onclick="annulPurchase('${purchase.id}')">Anular</button>` : ''}</div>
  </article>`).join('') : '<div class="card empty"><b>No hay compras</b>Registra una entrada desde inventario o desde este módulo.</div>';
}

function customerMetrics(customerId) {
  const sales = activeSales().filter(sale => sale.customerId === customerId);
  return {
    count: sales.reduce((sum, sale) => sum + number(sale.quantity || 1), 0),
    revenue: sales.reduce((sum, sale) => sum + number(sale.total ?? sale.price), 0)
  };
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
    <div><div class="record-title">${esc(movement.productName || movement.materialName || getMaterial(movement.materialId)?.name || 'Inventario')}</div><div class="record-meta">${esc(movement.type)} · ${dateText(movement.date)}${movement.designSku ? ` · ${esc(movement.designSku)}` : ''}</div></div>
    <div class="record-value"><b class="${number(movement.qty) >= 0 ? 'positive' : 'negative'}">${number(movement.qty) >= 0 ? '+' : '−'}${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(Math.abs(number(movement.qty)))}</b><span>${esc(D.unitLabel(movement.unit || getMaterial(movement.materialId)?.unit, movement.qty))}</span></div>
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
    aiModel: S.settings.aiModel || 'gpt-5.6',
    aiQuality: S.settings.aiQuality || 'medium',
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

function downloadBackup() {
  const backupTime = Date.now();
  S.settings.lastBackupAt = backupTime;
  const backup = {
    exportedAt: new Date(backupTime).toISOString(),
    app: 'Aurea',
    schemaVersion: SCHEMA_VERSION,
    data: normalizeState(S)
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `aurea-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  persist();
  toast('Respaldo descargado');
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
  $$('[data-import-ai-result]').forEach(button => { button.onclick = () => $('#ai-result-input').click(); });
  $('#ai-result-input').onchange = event => handleAIResultImage(event.target.files?.[0]);
  $('#download-presentation-btn').onclick = downloadAureaPresentation;
  $('#ai-prompt-btn').onclick = showAIPrompt;
  $('#ai-generate-btn').onclick = prepareManualAI;
  $('#ai-refine-btn').onclick = () => prepareManualRefinement();
  $$('[data-ai-suggestion]').forEach(button => {
    button.onclick = () => {
      $('#ai-feedback-input').value = button.dataset.aiSuggestion;
      $('#ai-feedback-input').focus();
      toast('Corrección preparada; puedes editarla antes de copiar');
    };
  });

  $('#sale-search').oninput = renderSales;
  $('#sale-status').onchange = renderSales;
  $('#new-customer-btn').onclick = () => openCustomer();
  $('#new-expense-btn').onclick = () => openExpense();

  $('#save-settings-btn').onclick = saveSettings;
  $('#download-backup-btn').onclick = downloadBackup;
  $('#open-user-guide-btn').onclick = openUserGuide;
  $('#open-full-guide-btn').onclick = openUserGuide;
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
  AureaDiagnostics: Object.freeze({ schemaVersion: SCHEMA_VERSION, normalizeState: value => normalizeState(clone(value)) }),
  openUserGuide, guideGo, runSetupAction,
  closeModal, openMaterial, saveMaterial, toggleMaterial, deleteMaterial,
  openPurchase, savePurchase, annulPurchase,
  changeComponentQty, removeComponent,
  loadDesign, showView,
  openProduction, saveProduction, openInitialFinishedStock, saveInitialFinishedStock, annulProduction,
  openSale, saveSale, openPayment, savePayment, openAnnulPayment, annulPayment,
  openCancelSale, cancelSale, confirmCancelSale, deleteSale,
  openCustomer, saveCustomer, toggleCustomer, deleteCustomer,
  openExpense, saveExpense, deleteExpense,
  copyAIPrompt, copyAIPromptAndOpenChatGPT, openChatGPT,
  prepareManualAI, prepareManualRefinement, selectAIVersion,
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
