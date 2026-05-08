import * as db from '../services/db.js';

function safe(v) { return isNaN(v) || v == null ? 0 : v; }
function uid() { return Math.random().toString(36).slice(2,10); }

function normalizeMongoId(raw) {
  const bytesToHex = (bytes) => {
    try {
      if (!bytes || typeof bytes.length !== 'number') return '';
      let out = '';
      for (let i = 0; i < bytes.length; i++) out += (bytes[i] & 0xff).toString(16).padStart(2, '0');
      return out;
    } catch { return '';
    }
  };

  if (raw == null) return '';
  if (typeof raw === 'string' || typeof raw === 'number') return String(raw);
  if (typeof raw === 'object') {
    // Extended JSON ObjectId formats
    if (raw.$oid) return String(raw.$oid);
    if (raw.oid) return String(raw.oid);

    const nested = raw._id ?? raw.id;
    if (nested != null) return normalizeMongoId(nested);

    // Structured-clone / BSON-like shapes that carry bytes
    // Common shapes:
    // - { id: { type: 'Buffer', data: [..12 bytes..] } }
    // - { buffer: { data: [..] } }
    // - Uint8Array(12)
    const buf = raw.buffer ?? raw.id;
    const data = buf?.data ?? raw.data;
    if (Array.isArray(data) && data.length === 12) {
      const hex = bytesToHex(data);
      if (hex) return hex;
    }
    if (Array.isArray(buf) && buf.length === 12) {
      const hex = bytesToHex(buf);
      if (hex) return hex;
    }
    if (typeof raw.length === 'number' && raw.length === 12) {
      const hex = bytesToHex(raw);
      if (hex) return hex;
    }

    if (typeof raw.toString === 'function' && raw.toString !== Object.prototype.toString) {
      return String(raw.toString());
    }
    return '';
  }
  return String(raw);
}

// ─── StorageKeys (kept for backward compat) ───
export const StorageKeys = {
  foods: 'foods',
  deals: 'deals',
  drinks: 'drinks',
  extras: 'extras',
  bill: 'billItems',
  tokenCounter: 'tokenCounter',
  tokenDate: 'tokenDate',
  tokenCounterBizDate: 'tokenCounterBizDate',
  tokenClosed: 'tokenClosed',
  businessHours: 'businessHours',
  dayClosures: 'dayClosures',
  dayOpenAt: 'dayOpenAt',
  dayOpenBizDate: 'dayOpenBizDate',
  restaurantInfo: 'restaurantInfo',
  sales: 'salesRecords',
  returns: 'returnRecords',
  users: 'users',
  session: 'currentUserId',
  lastToken: 'lastTokenNumber',
  yesterdaySummary: 'yesterdaySummary',
  printerConfig: 'printerConfig',
}

// ─── Internal: Settings helpers via MongoDB ───
async function getSetting(key) {
  try { return await db.settings.getByKey(key); } catch { return null; }
}
async function setSetting(key, value) {
  try { return await db.settings.setByKey(key, value); } catch { return null; }
}

// ─── Caches for sync access (loaded by bootstrapCache) ───
let _cachedActiveBizDate = '';
let _cachedBizHours = { open: '06:00', close: '03:00' };
let _cachedDayOpenAt = 0;
let _cachedTokenClosed = false;
let _cachedTokenDate = '';
let _cachedTokenCounterBizDate = '';
let _cachedCurrentUser = null;
let _cachedRestaurantInfo = { name: 'Your Restaurant', address: '123 Main Street, City', phone: '+00 000 0000000', logo: '' };
let _cachedPrinterConfig = { printerName: '', enabled: false };
let _cachedUsers = [];

// ─── Day open status ───
export async function getDayOpenAt() {
  const v = await getSetting('dayOpenAt'); return safe(parseInt(v)||0) || 0;
}
export async function setDayOpenAt(ts) { await setSetting('dayOpenAt', String(ts)); }
export async function clearDayOpenAt() { await db.settings.deleteByKey('dayOpenAt'); }
export async function getDayOpenBizDate() { const v = await getSetting('dayOpenBizDate'); return v || ''; }
export async function setDayOpenBizDate(bizId) { await setSetting('dayOpenBizDate', String(bizId||'')); }
export async function clearDayOpenBizDate() { await db.settings.deleteByKey('dayOpenBizDate'); }

// ─── Business hours ───
const DEFAULT_BIZ_HOURS = { open: '06:00', close: '03:00' };
export async function getBusinessHours() { const v = await getSetting('businessHours'); return v || DEFAULT_BIZ_HOURS; }
export async function setBusinessHours(hours) { await setSetting('businessHours', hours); }

// ─── Business date helpers (pure computation — uses cache) ───
export function getBusinessWindow(ts) {
  const { open, close } = _cachedBizHours;
  const [oh, om] = (open||'00:00').split(':').map(n=>parseInt(n||'0',10));
  const [ch, cm] = (close||'23:59').split(':').map(n=>parseInt(n||'0',10));
  const d = new Date(ts || Date.now());
  const base = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const openTime = new Date(base.getFullYear(), base.getMonth(), base.getDate(), oh, om).getTime();
  let closeTime = new Date(base.getFullYear(), base.getMonth(), base.getDate(), ch, cm).getTime();
  if (closeTime <= openTime) closeTime += 24*60*60*1000;
  if ((ts||Date.now()) < openTime) {
    const prev = openTime - 24*60*60*1000;
    return { start: prev, end: prev + (closeTime - openTime) };
  }
  return { start: openTime, end: closeTime };
}

export function getBusinessDateId(ts) {
  const { start } = getBusinessWindow(ts);
  const d = new Date(start);
  const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,'0'); const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

export function incrementBusinessDateId(ymd, days = 1) {
  try {
    const [y, m, d] = String(ymd||'').split('-').map(n=>parseInt(n,10));
    if (!y || !m || !d) return getBusinessDateId(Date.now());
    const dt = new Date(y, m-1, d, 12, 0, 0, 0);
    dt.setDate(dt.getDate() + (parseInt(days,10)||1));
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth()+1).padStart(2,'0');
    const dd = String(dt.getDate()).padStart(2,'0');
    return `${yyyy}-${mm}-${dd}`;
  } catch { return getBusinessDateId(Date.now()); }
}

// ─── Active business date (sync via cache) ───
export function getActiveBusinessDateId() {
  if (_cachedTokenDate) return _cachedTokenDate;
  if (_cachedDayOpenAt && !_cachedTokenClosed) return getBusinessDateId(_cachedDayOpenAt);
  return getBusinessDateId(Date.now());
}

export async function loadActiveBusinessDateId() {
  const [tokenDate, dayOpenAt, tokenClosed, bizHours] = await Promise.all([
    getSetting('tokenDate'),
    getSetting('dayOpenAt'),
    getSetting('tokenClosed'),
    getBusinessHours(),
  ]);
  _cachedTokenDate = tokenDate || '';
  _cachedDayOpenAt = safe(parseInt(dayOpenAt)||0);
  _cachedTokenClosed = tokenClosed === '1';
  _cachedBizHours = bizHours;
  _cachedTokenCounterBizDate = (await getSetting('tokenCounterBizDate')) || '';
  return getActiveBusinessDateId();
}

export async function setActiveBusinessDateId(bizId) {
  const requested = String(bizId||'');
  const current = _cachedTokenDate || '';
  let next = requested;
  if (current) {
    if (!requested || requested <= current) next = incrementBusinessDateId(current, 1);
  }
  _cachedTokenDate = next || requested || '';
  await setSetting('tokenDate', _cachedTokenDate);
  await ensureTokenDay();
  try { window.dispatchEvent(new Event('day:status-changed')); } catch {}
}

export async function forceSetBusinessDateId(bizId) {
  const requested = String(bizId||'');
  if (requested) {
    _cachedTokenDate = requested;
    await setSetting('tokenDate', requested);
  }
  await ensureTokenDay();
  try { window.dispatchEvent(new Event('day:status-changed')); } catch {}
}

// ─── Day open / close ───
export async function openDay() {
  const bizId = getActiveBusinessDateId();
  _cachedTokenDate = String(bizId||'');
  _cachedTokenCounterBizDate = String(bizId||'');
  _cachedTokenClosed = false;
  _cachedDayOpenAt = Date.now();
  await Promise.all([
    setSetting('tokenDate', _cachedTokenDate),
    setSetting('tokenCounterBizDate', _cachedTokenCounterBizDate),
    db.tokenCounters.reset('order_token', bizId),
    setSetting('tokenClosed', ''),
    setSetting('dayOpenBizDate', String(bizId||'')),
    setSetting('dayOpenAt', String(_cachedDayOpenAt)),
  ]);
  try { window.dispatchEvent(new Event('day:status-changed')); } catch {}
}

export async function isTokenClosed() {
  const v = await getSetting('tokenClosed');
  _cachedTokenClosed = v === '1';
  return _cachedTokenClosed;
}
export function isTokenClosedSync() { return _cachedTokenClosed; }

export async function closeTokens() {
  _cachedTokenClosed = true;
  await setSetting('tokenClosed', '1');
  try { window.dispatchEvent(new Event('day:status-changed')); } catch {}
}
export async function openTokens() {
  _cachedTokenClosed = false;
  await setSetting('tokenClosed', '');
}

// ─── Token helpers ───
export async function ensureTokenDay() {
  const activeBiz = getActiveBusinessDateId();
  if (_cachedTokenCounterBizDate !== activeBiz) {
    _cachedTokenCounterBizDate = activeBiz;
    await db.tokenCounters.reset('order_token', activeBiz);
  }
}

export async function nextToken() {
  if (_cachedTokenClosed) return '';
  await ensureTokenDay();
  const activeBiz = getActiveBusinessDateId();
  const result = await db.tokenCounters.increment('order_token', activeBiz);
  if (result && result.currentValue != null) return String(result.currentValue);
  return String(Math.floor(1 + Math.random()*999));
}

export async function resetTokenCounter(startAt = 0) {
  const activeBiz = getActiveBusinessDateId();
  await db.tokenCounters.set('order_token', startAt, activeBiz);
}

export async function getLastToken() {
  const result = await db.tokenCounters.getByName('order_token');
  const counter = result ? Number(result.currentValue ?? result.lastValue ?? 0) : 0;
  return String(counter);
}
export async function setLastToken(t) { /* kept in sync server-side */ }

// ─── Yesterday summary ───
export async function getYesterdaySummary() {
  const v = await getSetting('yesterdaySummary');
  return v || { bizId: '', subtotal: 0, deliveryCharges: 0, gross: 0, discount: 0, net: 0, returned: 0, salesCount: 0, returnsCount: 0, tokensGenerated: 0 };
}
export async function setYesterdaySummary(summary) {
  await setSetting('yesterdaySummary', summary || { bizId: '', subtotal: 0, deliveryCharges: 0, gross: 0, discount: 0, net: 0, returned: 0, salesCount: 0, returnsCount: 0, tokensGenerated: 0 });
}

// ─── Restaurant info ───
export function getRestaurantInfo() { return _cachedRestaurantInfo; }
export async function loadRestaurantInfo() {
  const v = await getSetting('restaurantInfo');
  _cachedRestaurantInfo = v || { name: 'Your Restaurant', address: '123 Main Street, City', phone: '+00 000 0000000', logo: '' };
  return _cachedRestaurantInfo;
}
export async function setRestaurantInfo(info) {
  _cachedRestaurantInfo = info;
  await setSetting('restaurantInfo', info);
}

// ─── Menu Items (foods/deals/drinks/extras) ───
const KEY_TO_CATEGORY = { foods: 'Food', deals: 'Deals', drinks: 'Drinks', extras: 'Extras' };

export async function listItems(key) {
  const category = KEY_TO_CATEGORY[key];
  if (!category) return [];
  const items = await db.menuItems.getAll({ category });
  return (Array.isArray(items) ? items : []).map(i => ({
    ...i,
    id: normalizeMongoId(i._id || i.id),
    img: i.img || i.image || '',
    image: i.image || i.img || '',
  }));
}

export async function addItem(key, item) {
  const category = KEY_TO_CATEGORY[key];
  if (!category) return item;
  try {
    const created = await db.menuItems.create({ ...item, category });
    if (created) return { ...created, id: normalizeMongoId(created._id || created.id) };
  } catch (e) { console.error('addItem error', e); }
  return { id: uid(), ...item };
}

export async function addItemsBulk(key, items) {
  const category = KEY_TO_CATEGORY[key];
  if (!category) return { insertedCount: 0, inserted: [], errors: [{ message: 'Invalid category key' }] };
  const arr = Array.isArray(items) ? items : [];
  const payload = arr.map(it => ({ ...it, category }));
  const result = await db.menuItems.createMany(payload);

  // If API call failed (returned null), fallback to individual create.
  if (!result) {
    const errors = [];
    const inserted = [];
    const chunkSize = 25;
    for (let i = 0; i < payload.length; i += chunkSize) {
      const chunk = payload.slice(i, i + chunkSize);
      const res = await Promise.allSettled(chunk.map(data => db.menuItems.create(data)));
      res.forEach((r, idx) => {
        if (r.status === 'fulfilled' && r.value && !r.value.error) inserted.push(r.value);
        else {
          const reason = r.status === 'rejected' ? r.reason : (r.value && r.value.error);
          errors.push({ index: i + idx, message: String(reason?.message || reason || 'Create failed') });
        }
      });
    }
    const normalizedInserted = inserted.map(i => ({
      ...i,
      id: normalizeMongoId(i._id || i.id),
      img: i.img || i.image || '',
      image: i.image || i.img || '',
    }));
    return { insertedCount: normalizedInserted.length, inserted: normalizedInserted, errors };
  }

  const inserted = (Array.isArray(result?.inserted) ? result.inserted : []).map(i => ({
    ...i,
    id: normalizeMongoId(i._id || i.id),
    img: i.img || i.image || '',
    image: i.image || i.img || '',
  }));
  return { insertedCount: Number(result?.insertedCount || inserted.length || 0), inserted, errors: Array.isArray(result?.errors) ? result.errors : [] };
 }

export async function updateItem(key, item) {
  if (!item.id && !item._id) return;
  const id = normalizeMongoId(item.id || item._id);
  if (!id) return { error: 'Invalid id' };
  try {
    const result = await db.menuItems.update(id, item);
    return result ? { ...result, id: normalizeMongoId(result._id || result.id || id) } : result;
  } catch (e) { console.error('updateItem error', e); throw e; }
}

export async function deleteItem(key, id) {
  const cleanId = normalizeMongoId(id);
  if (!cleanId) return { error: 'Invalid id' };
  return await db.menuItems.delete(cleanId);
}

export async function searchItems(key, query) {
  const items = await listItems(key);
  const q = (query || '').toLowerCase();
  return items.filter(i => (i.name||'').toLowerCase().includes(q) || (i.type||'').toLowerCase().includes(q));
}

export async function getAllCatalog() {
  const [foods, deals, drinks, extras] = await Promise.all([
    listItems('foods'), listItems('deals'), listItems('drinks'), listItems('extras'),
  ]);
  return { foods, deals, drinks, extras };
}

// ─── Bill (current order items) ───
export async function listBill() {
  const v = await getSetting('billItems');
  return Array.isArray(v) ? v : [];
}
export async function setBill(items) { await setSetting('billItems', items); }

// ─── Custom Types per Category ───
function typeKey(category) { return `types:${category}`; }

export async function listTypesForCategory(category) {
  const v = await getSetting(typeKey(category));
  return Array.isArray(v) ? v.filter(Boolean) : [];
}
export async function addTypeForCategory(category, newType) {
  const t = String(newType || '').trim();
  if (!t) return listTypesForCategory(category);
  const arr = await listTypesForCategory(category);
  if (!arr.includes(t)) { arr.push(t); await setSetting(typeKey(category), arr); }
  return arr;
}

// ─── Sales (Orders) ───
export async function listSales() {
  const items = await db.orders.getAll({});
  return (Array.isArray(items) ? items : []).map(i => ({ ...i, id: normalizeMongoId(i._id || i.id) }));
}
export async function addSale(sale) {
  const currentUser = _cachedCurrentUser;
  const bizId = getActiveBusinessDateId();
  if (!bizId) {
    console.error('[addSale] No business date — open day first');
    return { error: 'No business date. Please open the day first.' };
  }
  const rec = {
    ...sale,
    bizId,
    businessDate: bizId,
    cashier: currentUser ? currentUser.username : 'Unknown',
    cashierId: currentUser ? (currentUser.id || currentUser._id) : null,
  };
  console.log('[addSale] Saving order, bizId:', bizId, 'token:', rec.token);
  const created = await db.orders.create(rec);
  if (!created) {
    console.error('[addSale] db.orders.create returned null — API call failed');
    return { error: 'Order save failed. Server may be unavailable. Please check console and try again.' };
  }
  if (created.error) {
    console.error('[addSale] db.orders.create error:', created.error);
    return { error: created.error };
  }
  try { window.dispatchEvent(new Event('data:sales-changed')); } catch {}
  return { ...created, id: normalizeMongoId(created._id || created.id) };
}
export async function deleteSale(id) {
  await db.orders.delete(normalizeMongoId(id));
  try { window.dispatchEvent(new Event('data:sales-changed')); } catch {}
}

// ─── Returns (Refunds) ───
export async function listReturns() {
  const items = await db.refunds.getAll({});
  return (Array.isArray(items) ? items : []).map(i => ({ ...i, id: normalizeMongoId(i._id || i.id) }));
}
export async function addReturn(ret) {
  const bizId = getActiveBusinessDateId();
  const rec = { ...ret, bizId, businessDate: bizId, createdAt: Date.now() };
  const created = await db.refunds.create(rec);
  try { window.dispatchEvent(new Event('data:returns-changed')); } catch {}
  return created ? { ...created, id: normalizeMongoId(created._id || created.id) } : { id: uid(), ...rec };
}
export async function deleteReturn(id) {
  await db.refunds.delete(normalizeMongoId(id));
  try { window.dispatchEvent(new Event('data:returns-changed')); } catch {}
}

// ─── Users ───
export async function listUsers() {
  const items = await db.users.getAll({});
  _cachedUsers = (Array.isArray(items) ? items : []).map(i => ({ ...i, id: normalizeMongoId(i._id || i.id) }));
  return _cachedUsers;
}
export async function addUser(user) {
  const created = await db.users.create(user);
  return created ? { ...created, id: normalizeMongoId(created._id || created.id) } : { id: uid(), ...user };
}
export async function updateUser(user) {
  const id = normalizeMongoId(user.id || user._id);
  if (!id) return { error: 'Invalid id' };
  return await db.users.update(id, user);
}
export async function deleteUser(id) {
  const cleanId = normalizeMongoId(id);
  if (!cleanId) return { error: 'Invalid id' };
  return await db.users.delete(cleanId);
}
export function exportUsers() { return JSON.stringify(_cachedUsers || [], null, 2); }
export async function importUsers(json) {
  try {
    const arr = JSON.parse(json);
    if (Array.isArray(arr)) { for (const u of arr) await db.users.create(u); }
  } catch (e) { console.error('Invalid users import', e); }
}

// ─── Auth ───
export function getCurrentUser() { return _cachedCurrentUser; }
export async function loadCurrentUser() {
  const sessionId = await getSetting('currentUserId');
  if (!sessionId) { _cachedCurrentUser = null; return null; }
  const users = await listUsers();
  _cachedCurrentUser = users.find(u => String(u.id) === String(sessionId) || String(u._id) === String(sessionId)) || null;
  return _cachedCurrentUser;
}

export async function getCashiers() {
  const users = await listUsers();
  return users.filter(u => (u.role||'').toLowerCase() === 'cashier');
}

export async function getActiveStaff() {
  try {
    // Use db.staff.getAll which goes through clean() to strip ObjectIds
    const raw = await db.staff.getAll({});
    const staffList = Array.isArray(raw) ? raw : [];

    const eligibleRoleSet = new Set(['waiter','receptionist','chef','manager','delivery','other','cashier']);
    const activeStaff = staffList.filter(s => {
      const role = String(s?.role || '').trim().toLowerCase();
      const status = String(s?.status || '').trim().toLowerCase();
      if (status === 'terminated') return false;
      return eligibleRoleSet.has(role);
    });

    if (activeStaff.length > 0) {
      return activeStaff.map(s => {
        const id = normalizeMongoId(s._id || s.id);
        return { id, _id: id, name: s.name, username: s.name, role: s.role, isActive: true };
      }).filter(s => s.id);
    }

    // Fallback: use User model if no Staff records exist yet
    const users = await listUsers();
    const safeUsers = Array.isArray(users) ? users : [];
    return safeUsers.filter(u =>
      u && u.isActive !== false && String(u.role || '').toLowerCase() !== 'admin'
    );
  } catch (e) {
    console.warn('[getActiveStaff] error:', e.message);
    return [];
  }
}

export async function loginAdmin(username, password) {
  const user = await db.users.login(username, password, 'Admin');
  if (user) {
    _cachedCurrentUser = { ...user, id: user._id };
    await setSetting('currentUserId', String(user._id));
    // Save to JWT auth system
    const { saveCompanyUser } = await import('./jwtAuth.js');
    saveCompanyUser(_cachedCurrentUser);
    return _cachedCurrentUser;
  }
  return null;
}
export async function verifyAdminCredentials(username, password) {
  return await db.verifyAdminCredentials(username, password);
}

export async function loginCashier(cashierId, password) {
  const users = await listUsers();
  const user = users.find(u => (String(u.id) === String(cashierId) || String(u._id) === String(cashierId)) && u.role === 'Cashier');
  if (user) {
    const result = await db.users.login(user.username, password, 'Cashier');
    if (result) {
      _cachedCurrentUser = { ...result, id: result._id };
      await setSetting('currentUserId', String(result._id));
      // Save to JWT auth system
      const { saveCompanyUser } = await import('./jwtAuth.js');
      saveCompanyUser(_cachedCurrentUser);
      return _cachedCurrentUser;
    }
  }
  return null;
}

export async function logout() {
  _cachedCurrentUser = null;
  await db.settings.deleteByKey('currentUserId');
}

// ─── Day Closures → DaySessions ───
export async function listDayClosures() {
  const items = await db.daySessions.getAll({});
  return (Array.isArray(items) ? items : []).map(i => ({ ...i, id: normalizeMongoId(i._id || i.id) }));
}
export async function addDayClosure(summary) {
  const created = await db.daySessions.create(summary);
  return created ? { ...created, id: normalizeMongoId(created._id || created.id) } : { id: uid(), ...summary };
}

// ─── Printer config ───
export function getPrinterConfig() { return _cachedPrinterConfig; }
export async function loadPrinterConfig() {
  const v = await getSetting('printerConfig');
  _cachedPrinterConfig = v || { printerName: '', enabled: false };
  return _cachedPrinterConfig;
}
export async function setPrinterConfig(config) {
  _cachedPrinterConfig = config;
  await setSetting('printerConfig', config);
  try { window.dispatchEvent(new Event('printer:config-changed')); } catch {}
}

// ─── Tables ───
export async function listTables() {
  const items = await db.tables.getAll({});
  return (Array.isArray(items) ? items : []).map(i => ({ ...i, id: normalizeMongoId(i._id || i.id) }));
}
export async function addTable(table) {
  const created = await db.tables.create({
    tableNumber: table.number, number: table.number,
    floor: table.floor || 'Ground Floor', seats: table.capacity || 4, capacity: table.capacity || 4,
    status: String(table.status || 'available').toLowerCase(), shape: table.shape || 'square',
  });
  try { window.dispatchEvent(new Event('tables:changed')); } catch {}
  return created ? { ...created, id: normalizeMongoId(created._id || created.id) } : { id: uid(), ...table, createdAt: Date.now() };
}
export async function updateTable(table) {
  const id = normalizeMongoId(table.id || table._id);
  if (!id) return { error: 'Invalid id' };
  const data = { ...table };
  if (table.number) { data.tableNumber = table.number; data.number = table.number; }
  if (table.capacity != null) { data.seats = Number(table.capacity); }
  if (table.status) data.status = String(table.status).toLowerCase();
  const result = await db.tables.update(id, data);
  try { window.dispatchEvent(new Event('tables:changed')); } catch {}
  return result ? { ...result, id: normalizeMongoId(result._id || result.id || id) } : result;
}
export async function deleteTable(id) {
  const cleanId = normalizeMongoId(id);
  if (!cleanId) return { error: 'Invalid id' };
  await db.tables.delete(cleanId);
  try { window.dispatchEvent(new Event('tables:changed')); } catch {}
}
export async function updateTableStatus(id, status) {
  const cleanId = normalizeMongoId(id);
  if (!cleanId) return { error: 'Invalid id' };
  return await db.tables.update(cleanId, { status: String(status || 'available').toLowerCase() });
}

// ─── Reservations ───
export async function listReservations() {
  const items = await db.reservations.getAll({});
  return (Array.isArray(items) ? items : []).map(i => ({ ...i, id: normalizeMongoId(i._id || i.id) }));
}
export async function addReservation(reservation) {
  const created = await db.reservations.create({ ...reservation, status: reservation.status || 'pending' });
  try { window.dispatchEvent(new Event('reservations:changed')); } catch {}
  return created ? { ...created, id: normalizeMongoId(created._id || created.id) } : { id: uid(), ...reservation, status: reservation.status || 'pending', createdAt: Date.now() };
}
export async function updateReservation(reservation) {
  const id = normalizeMongoId(reservation.id || reservation._id);
  if (!id) return { error: 'Invalid id' };
  const result = await db.reservations.update(id, reservation);
  try { window.dispatchEvent(new Event('reservations:changed')); } catch {}
  return result;
}
export async function deleteReservation(id) {
  await db.reservations.delete(normalizeMongoId(id));
  try { window.dispatchEvent(new Event('reservations:changed')); } catch {}
}

// ─── Inventory ───
export async function listInventory() {
  const items = await db.inventory.getAll({});
  return (Array.isArray(items) ? items : []).map(i => ({
    ...i,
    id: normalizeMongoId(i._id || i.id),
    stock: i.stock ?? i.currentStock ?? i.quantity ?? 0,
    price: i.price ?? i.costPrice ?? i.pricePerUnit ?? 0,
  }));
}
export async function listInventoryCategories() {
  const v = await getSetting('inventoryCategories');
  return Array.isArray(v) ? v : ['All', 'Food', 'Beverages', 'Supplies', 'Equipment'];
}
export async function addInventoryCategory(category) {
  const cats = await listInventoryCategories();
  if (!cats.includes(category)) { cats.push(category); await setSetting('inventoryCategories', cats); }
  return cats;
}
export async function addInventoryItem(item) {
  const categoryMap = {
    raw: 'Raw Materials', beverage: 'Beverages', packaging: 'Packaging', cleaning: 'Cleaning', food: 'Food', supplies: 'Supplies', equipment: 'Equipment', other: 'Other', all: 'All'
  };
  const normalizedCategory = categoryMap[(item.category || '').toLowerCase()] || (item.category || 'Other');
  const created = await db.inventory.create({
    name: item.name, category: normalizedCategory,
    currentStock: item.quantity || 0, quantity: item.quantity || 0,
    unit: item.unit || 'pcs', minLevel: item.minStock || 10, minStock: item.minStock || 10,
    maxStock: item.maxStock || 100, pricePerUnit: item.costPrice || 0, costPrice: item.costPrice || 0,
    supplier: item.supplier || '', status: item.status || 'in-stock', isActive: true,
  });
  try { window.dispatchEvent(new Event('inventory:changed')); } catch {}
  return created ? { ...created, id: normalizeMongoId(created._id || created.id) } : { id: uid(), ...item, createdAt: Date.now() };
}
export async function updateInventoryItem(item) {
  const id = normalizeMongoId(item.id || item._id);
  if (!id) return { error: 'Invalid id' };
  const data = { ...item };
  if (item.quantity != null) { data.currentStock = item.quantity; }
  if (item.minStock != null) { data.minLevel = item.minStock; }
  if (item.costPrice != null) { data.pricePerUnit = item.costPrice; }
  if (item.category) {
    const categoryMap = {
      raw: 'Raw Materials', beverage: 'Beverages', packaging: 'Packaging', cleaning: 'Cleaning', food: 'Food', supplies: 'Supplies', equipment: 'Equipment', other: 'Other', all: 'All'
    };
    data.category = categoryMap[item.category.toLowerCase()] || item.category;
  }
  const result = await db.inventory.update(id, data);
  try { window.dispatchEvent(new Event('inventory:changed')); } catch {}
  return result ? { ...result, id: normalizeMongoId(result._id || result.id || id) } : result;
}
export async function deleteInventoryItem(id) {
  const cleanId = normalizeMongoId(id);
  if (!cleanId) return { error: 'Invalid id' };
  await db.inventory.delete(cleanId);
  try { window.dispatchEvent(new Event('inventory:changed')); } catch {}
}
export async function updateInventoryStock(id, quantity) {
  const cleanId = normalizeMongoId(id);
  if (!cleanId) return { error: 'Invalid id' };
  let status = 'in-stock';
  const item = await db.inventory.getById(cleanId);
  if (item) {
    if (quantity <= 0) status = 'out-of-stock';
    else if (quantity <= (item.minLevel || item.minStock || 10)) status = 'low-stock';
  }
  const result = await db.inventory.update(cleanId, { currentStock: quantity, quantity, status });
  try { window.dispatchEvent(new Event('inventory:changed')); } catch {}
  return result;
}

// ─── Export / Import / Wipe ───
export async function exportAllData() {
  try {
    const data = await db.bulk.exportAll();
    return JSON.stringify(data, null, 2);
  } catch (e) { console.error('Failed to export all data', e); return '{}'; }
}
export async function importAllData(json) {
  try {
    const obj = JSON.parse(json);
    if (!obj || typeof obj !== 'object') throw new Error('Invalid data');
    await db.bulk.importAll(obj);
    return true;
  } catch (e) { console.error('Invalid all-data import', e); return false; }
}
export async function wipeAllData() { await db.bulk.wipeAll(); }

// ─── Notifications ───
export async function listNotifications(filters) { const r = await db.notifications.getAll(filters); return Array.isArray(r) ? r : []; }
export async function createNotification(data) { return await db.notifications.create(data) }
export async function updateNotification(id, data) { return await db.notifications.update(id, data) }
export async function deleteNotification(id) { return await db.notifications.delete(id) }
export async function getUnreadNotificationCount() {
  const all = await db.notifications.getAll({ status: 'pending' })
  return Array.isArray(all) ? all.length : 0
}

// ─── Reprint Requests ───
export async function listReprintRequests(filters) { const r = await db.reprintRequests.getAll(filters); return Array.isArray(r) ? r : []; }
export async function createReprintRequest(data) { return await db.reprintRequests.create(data) }
export async function updateReprintRequest(id, data) { return await db.reprintRequests.update(id, data) }
export async function approveReprintRequest(id, adminName) { return await db.reprintRequests.approve(id, adminName) }
export async function declineReprintRequest(id, adminName) { return await db.reprintRequests.decline(id, adminName) }
export async function getPendingReprintForToken(token) {
  const all = await db.reprintRequests.getAll({ token, status: 'pending' })
  return Array.isArray(all) && all.length > 0 ? all[0] : null
}
export async function getApprovedReprintForToken(token) {
  const all = await db.reprintRequests.getAll({ token, status: 'approved' })
  if (!Array.isArray(all) || all.length === 0) return null
  const rr = all[0]
  // Check if within 10 min window
  if (rr.approvedAt && (Date.now() - new Date(rr.approvedAt).getTime() < 10 * 60 * 1000)) return rr
  return null
}

// ─── Bootstrap: load caches on app start ───
export async function bootstrapCache() {
  await Promise.all([
    loadActiveBusinessDateId(),
    loadRestaurantInfo(),
    loadPrinterConfig(),
    loadCurrentUser(),
  ]);
}
