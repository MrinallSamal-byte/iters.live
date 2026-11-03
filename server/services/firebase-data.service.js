const firebase = require('../database/firebase');

const { db, realtimeDb, isFirebaseAdminReady, isRealtimeDbReady } = firebase;

// Firestore allows at most 30 values in an `in` clause.
const MAX_IN_VALUES = 30;

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeStoredValue(value) {
  if (value === undefined) return null;
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value?.toDate === 'function') {
    try {
      return value.toDate().toISOString();
    } catch (_) {
      return value;
    }
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeStoredValue(item));
  }
  if (isPlainObject(value)) {
    return Object.entries(value).reduce((acc, [key, item]) => {
      const normalized = normalizeStoredValue(item);
      if (normalized !== undefined) {
        acc[key] = normalized;
      }
      return acc;
    }, {});
  }
  return value;
}

/**
 * Remove top-level `undefined` values so a partial update never wipes a field
 * the caller simply did not provide.
 */
function stripUndefined(payload = {}) {
  return Object.entries(payload || {}).reduce((acc, [key, value]) => {
    if (value !== undefined) acc[key] = value;
    return acc;
  }, {});
}

/**
 * Document ids that Firestore (and the RTDB mirror) can address safely.
 * Rejecting everything else lets callers treat hostile/garbled ids as
 * "not found" instead of surfacing a 500 from the SDK.
 */
function isValidDocId(id) {
  if (id === undefined || id === null) return false;
  const value = String(id);
  if (value.length === 0 || Buffer.byteLength(value, 'utf8') > 1500) return false;
  if (value === '.' || value === '..') return false;
  if (value.includes('/')) return false;
  if (/^__.*__$/.test(value)) return false;
  return true;
}

function isValidRealtimeKey(id) {
  return isValidDocId(id) && !/[.#$\[\]]/.test(String(id));
}

function toComparableValue(value) {
  if (value === undefined || value === null) return null;
  if (typeof value?.toDate === 'function') {
    try {
      return value.toDate().getTime();
    } catch (_) {
      return null;
    }
  }
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed) && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return parsed;
  }
  if (typeof value === 'string') return value.toLowerCase();
  return value;
}

function applyFilters(records, filters = []) {
  return records.filter((record) => filters.every((filter) => {
    const { field, op = '==', value } = filter;
    const actual = record?.[field];

    switch (op) {
      case '==':
        return actual === value;
      case '!=':
        return actual !== value;
      case 'in':
        return Array.isArray(value) && value.includes(actual);
      case 'contains':
        return String(actual || '').toLowerCase().includes(String(value || '').toLowerCase());
      case 'array-contains':
        return Array.isArray(actual) && actual.includes(value);
      case '>=':
        return toComparableValue(actual) >= toComparableValue(value);
      case '<=':
        return toComparableValue(actual) <= toComparableValue(value);
      case '>':
        return toComparableValue(actual) > toComparableValue(value);
      case '<':
        return toComparableValue(actual) < toComparableValue(value);
      default:
        return true;
    }
  }));
}

function applyOrdering(records, orderBy = []) {
  if (!Array.isArray(orderBy) || orderBy.length === 0) {
    return [...records];
  }

  return [...records].sort((left, right) => {
    for (const order of orderBy) {
      const field = typeof order === 'string' ? order : order.field;
      const direction = (typeof order === 'object' ? order.direction : 'asc') || 'asc';
      const leftValue = toComparableValue(left?.[field]);
      const rightValue = toComparableValue(right?.[field]);

      if (leftValue === rightValue) continue;
      if (leftValue === null) return direction === 'desc' ? 1 : -1;
      if (rightValue === null) return direction === 'desc' ? -1 : 1;
      if (leftValue < rightValue) return direction === 'desc' ? 1 : -1;
      if (leftValue > rightValue) return direction === 'desc' ? -1 : 1;
    }

    return 0;
  });
}

/**
 * Decide which filters Firestore can evaluate server-side with identical
 * semantics to the in-memory matcher (strict equality, `in`, array-contains).
 * Everything else (ranges, `contains`, `!=`) is still applied in memory.
 *
 * Returns the filters to push down. The caller always re-applies *all* filters
 * in memory afterwards, so pushdown can only ever shrink the read set.
 */
function planPushdown(filters = []) {
  const pushable = [];
  for (const filter of filters) {
    if (!filter || typeof filter.field !== 'string') continue;
    const { field, op = '==', value } = filter;

    if (field === 'id') {
      // Document id lives in the doc path, not necessarily in the stored data.
      if (op === '==' && isValidDocId(value)) {
        pushable.push({ field, op, value: String(value) });
      } else if (op === 'in' && Array.isArray(value)) {
        // Ids that can never be document ids cannot match; drop them from the query.
        const ids = value.map(String).filter(isValidDocId);
        if (ids.length > 0 && ids.length <= MAX_IN_VALUES) {
          pushable.push({ field, op, value: ids });
        }
      }
      continue;
    }

    if (op === '==' && value !== undefined && typeof value !== 'object') {
      pushable.push({ field, op, value });
    } else if (op === '==' && value === null) {
      pushable.push({ field, op, value });
    } else if (op === 'in' && Array.isArray(value) && value.length > 0 && value.length <= MAX_IN_VALUES
      && value.every((item) => item !== undefined && (item === null || typeof item !== 'object'))) {
      pushable.push({ field, op, value });
    } else if (op === 'array-contains' && value !== undefined && typeof value !== 'object') {
      pushable.push({ field, op, value });
    }
  }
  return pushable;
}

/**
 * True when an `id ==` filter carries a value that can never be a document id
 * (so the result set is provably empty and no read is needed).
 */
function hasUnmatchableIdFilter(filters = []) {
  return filters.some((filter) => {
    if (!filter || filter.field !== 'id') return false;
    const op = filter.op || '==';
    if (op === '==') return !isValidDocId(filter.value);
    if (op === 'in') return !Array.isArray(filter.value) || !filter.value.some((id) => isValidDocId(id));
    return false;
  });
}

function buildFirestoreQuery(collectionName, pushable) {
  let query = db.collection(collectionName);
  for (const filter of pushable) {
    if (filter.field === 'id') {
      const documentId = firebase.admin?.firestore?.FieldPath?.documentId?.();
      if (!documentId) return null;
      query = query.where(documentId, filter.op, filter.value);
    } else {
      query = query.where(filter.field, filter.op, filter.value);
    }
  }
  return query;
}

async function mirrorToRealtime(collectionName, id, payload) {
  if (!isRealtimeDbReady || !isValidRealtimeKey(id)) return;
  await realtimeDb.ref(`app_data/${collectionName}/${id}`).set(normalizeStoredValue(payload));
}

async function removeRealtimeMirror(collectionName, id) {
  if (!isRealtimeDbReady || !isValidRealtimeKey(id)) return;
  await realtimeDb.ref(`app_data/${collectionName}/${id}`).remove();
}

/**
 * Fire-and-forget mirror write. The mirror is best-effort (Firestore is the
 * source of truth) but a failure must be visible in the logs.
 */
function mirrorInBackground(collectionName, id, payload) {
  if (!isRealtimeDbReady) return;
  Promise.resolve()
    .then(() => mirrorToRealtime(collectionName, id, payload))
    .catch((error) => {
      console.warn(`RTDB mirror write failed for ${collectionName}/${id}: ${error.message}`);
    });
}

async function listFromRealtime(collectionName) {
  if (!isRealtimeDbReady) return [];

  const snapshot = await realtimeDb.ref(`app_data/${collectionName}`).once('value');
  const value = snapshot.val();
  if (!value || typeof value !== 'object') return [];

  return Object.entries(value).map(([id, item]) => ({
    id,
    ...normalizeStoredValue(item)
  }));
}

function mapSnapshot(snapshot) {
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...normalizeStoredValue(doc.data())
  }));
}

async function listFromFirestore(collectionName, filters = []) {
  if (!isFirebaseAdminReady) return [];
  if (hasUnmatchableIdFilter(filters)) return [];

  const pushable = planPushdown(filters);
  if (pushable.length > 0) {
    try {
      const query = buildFirestoreQuery(collectionName, pushable);
      if (query) {
        return mapSnapshot(await query.get());
      }
    } catch (error) {
      // Typically a missing composite index (FAILED_PRECONDITION). Correctness
      // beats efficiency: fall back to a scan and let the in-memory filters run.
      console.warn(`Firestore query pushdown failed for ${collectionName}, scanning instead: ${error.message}`);
    }
  }

  return mapSnapshot(await db.collection(collectionName).get());
}

/**
 * List records. Filters are pushed down to Firestore where semantics match, so
 * a per-student read no longer downloads the entire collection.
 *
 * Firestore is authoritative. The RTDB mirror is only consulted when the
 * caller explicitly asks for it (`preferRealtime: true`) because the mirror is
 * written best-effort and can be incomplete.
 */
async function listRecords(collectionName, options = {}) {
  const { filters = [], orderBy = [], limit = null, preferRealtime = false } = options;
  let records = [];

  if (preferRealtime) {
    records = await listFromRealtime(collectionName);
  }

  if (records.length === 0) {
    records = await listFromFirestore(collectionName, filters);
  }

  const filtered = applyOrdering(applyFilters(records, filters), orderBy);
  if (limit == null) return filtered;
  return filtered.slice(0, Number(limit));
}

async function getRecord(collectionName, id, options = {}) {
  const { preferRealtime = false } = options;

  if (!isValidDocId(id)) return null;

  if (preferRealtime && isRealtimeDbReady && isValidRealtimeKey(id)) {
    const snapshot = await realtimeDb.ref(`app_data/${collectionName}/${id}`).once('value');
    if (snapshot.exists()) {
      return {
        id: String(id),
        ...normalizeStoredValue(snapshot.val())
      };
    }
  }

  if (!isFirebaseAdminReady) return null;

  const doc = await db.collection(collectionName).doc(String(id)).get();
  if (!doc.exists) return null;

  const record = {
    id: doc.id,
    ...normalizeStoredValue(doc.data())
  };

  mirrorInBackground(collectionName, doc.id, record);
  return record;
}

/**
 * Create a record. With `options.exclusive` the write fails with an
 * ALREADY_EXISTS error (code 6) instead of silently overwriting, which makes
 * "create if absent" atomic.
 */
async function createRecord(collectionName, payload, options = {}) {
  if (!isFirebaseAdminReady) {
    throw new Error('Firebase Admin SDK is not initialized');
  }

  const id = String(options.id || db.collection(collectionName).doc().id);
  if (!isValidDocId(id)) {
    const error = new Error('Invalid record id');
    error.statusCode = 400;
    throw error;
  }

  const record = normalizeStoredValue({
    id,
    created_at: new Date().toISOString(),
    ...payload
  });

  if (options.exclusive) {
    await db.collection(collectionName).doc(id).create(record);
  } else {
    await db.collection(collectionName).doc(id).set(record);
  }
  mirrorInBackground(collectionName, id, record);
  return record;
}

async function setRecord(collectionName, id, payload, options = {}) {
  if (!isFirebaseAdminReady) {
    throw new Error('Firebase Admin SDK is not initialized');
  }

  if (!isValidDocId(id)) {
    const error = new Error('Invalid record id');
    error.statusCode = 400;
    throw error;
  }

  const recordId = String(id);
  const merge = Boolean(options.merge);
  const current = merge ? await getRecord(collectionName, recordId, { preferRealtime: false }) : null;
  const merged = normalizeStoredValue({
    ...(merge ? current : {}),
    ...(merge ? stripUndefined(payload) : payload),
    id: recordId,
    updated_at: new Date().toISOString()
  });

  await db.collection(collectionName).doc(recordId).set(merged, { merge });
  mirrorInBackground(collectionName, recordId, merged);
  return merged;
}

async function updateRecord(collectionName, id, payload) {
  return setRecord(collectionName, id, payload, { merge: true });
}

async function deleteRecord(collectionName, id) {
  if (!isFirebaseAdminReady) {
    throw new Error('Firebase Admin SDK is not initialized');
  }

  if (!isValidDocId(id)) return;

  const recordId = String(id);
  await db.collection(collectionName).doc(recordId).delete();
  await removeRealtimeMirror(collectionName, recordId).catch((error) => {
    console.warn(`RTDB mirror delete failed for ${collectionName}/${recordId}: ${error.message}`);
  });
}

async function findOne(collectionName, options = {}) {
  const [record] = await listRecords(collectionName, {
    ...options,
    limit: 1
  });
  return record || null;
}

/**
 * Count matching records. When every filter can be evaluated by Firestore this
 * uses a server-side count aggregation (no documents are downloaded).
 */
async function countRecords(collectionName, options = {}) {
  const { filters = [] } = options;

  if (isFirebaseAdminReady && !hasUnmatchableIdFilter(filters)) {
    const pushable = planPushdown(filters);
    const everyFilterPushed = pushable.length === filters.length;
    if (everyFilterPushed) {
      try {
        const query = pushable.length > 0
          ? buildFirestoreQuery(collectionName, pushable)
          : db.collection(collectionName);
        if (query && typeof query.count === 'function') {
          const aggregate = await query.count().get();
          const total = Number(aggregate.data().count);
          if (Number.isFinite(total)) return total;
        }
      } catch (error) {
        console.warn(`Firestore count aggregation failed for ${collectionName}, counting in memory: ${error.message}`);
      }
    }
  }

  const records = await listRecords(collectionName, options);
  return records.length;
}

/**
 * Rebuild the RTDB mirror of one collection from Firestore (the source of
 * truth). The mirror is written best-effort on each save, so a failed write
 * leaves it incomplete; this is the repair.
 */
async function syncRealtimeMirror(collectionName) {
  if (!isRealtimeDbReady) return { enabled: false, synced: 0 };

  const records = await listFromFirestore(collectionName);
  const payload = {};
  for (const record of records) {
    if (isValidRealtimeKey(record.id)) {
      payload[record.id] = normalizeStoredValue(record);
    }
  }

  const synced = Object.keys(payload).length;
  await realtimeDb.ref(`app_data/${collectionName}`).set(synced > 0 ? payload : null);
  return { enabled: true, synced };
}

module.exports = {
  syncRealtimeMirror,
  normalizeStoredValue,
  isValidDocId,
  planPushdown,
  applyFilters,
  listRecords,
  getRecord,
  createRecord,
  setRecord,
  updateRecord,
  deleteRecord,
  findOne,
  countRecords
};
