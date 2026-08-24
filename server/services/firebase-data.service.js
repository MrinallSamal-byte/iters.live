const { db, realtimeDb, isFirebaseAdminReady, isRealtimeDbReady } = require('../database/firebase');

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

async function mirrorToRealtime(collectionName, id, payload) {
  if (!isRealtimeDbReady) return;
  await realtimeDb.ref(`app_data/${collectionName}/${id}`).set(normalizeStoredValue(payload));
}

async function removeRealtimeMirror(collectionName, id) {
  if (!isRealtimeDbReady) return;
  await realtimeDb.ref(`app_data/${collectionName}/${id}`).remove();
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

async function listFromFirestore(collectionName) {
  if (!isFirebaseAdminReady) return [];

  const snapshot = await db.collection(collectionName).get();
  const records = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...normalizeStoredValue(doc.data())
  }));

  // ponytail: RTDB mirror now write-time only -> remove preferRealtime reads if mirror drift matters

  return records;
}

async function listRecords(collectionName, options = {}) {
  const { filters = [], orderBy = [], limit = null, preferRealtime = true } = options;
  let records = [];

  if (preferRealtime) {
    records = await listFromRealtime(collectionName);
  }

  if (records.length === 0) {
    records = await listFromFirestore(collectionName);
  }

  const filtered = applyOrdering(applyFilters(records, filters), orderBy);
  if (limit == null) return filtered;
  return filtered.slice(0, Number(limit));
}

async function getRecord(collectionName, id, options = {}) {
  const { preferRealtime = true } = options;

  if (preferRealtime && isRealtimeDbReady) {
    const snapshot = await realtimeDb.ref(`app_data/${collectionName}/${id}`).once('value');
    if (snapshot.exists()) {
      return {
        id,
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

  await mirrorToRealtime(collectionName, doc.id, record).catch(() => {});
  return record;
}

async function createRecord(collectionName, payload, options = {}) {
  if (!isFirebaseAdminReady) {
    throw new Error('Firebase Admin SDK is not initialized');
  }

  const id = String(options.id || db.collection(collectionName).doc().id);
  const record = normalizeStoredValue({
    id,
    created_at: new Date().toISOString(),
    ...payload
  });

  await db.collection(collectionName).doc(id).set(record);
  await mirrorToRealtime(collectionName, id, record).catch(() => {});
  return record;
}

async function setRecord(collectionName, id, payload, options = {}) {
  if (!isFirebaseAdminReady) {
    throw new Error('Firebase Admin SDK is not initialized');
  }

  const recordId = String(id);
  const current = options.merge ? await getRecord(collectionName, recordId, { preferRealtime: false }) : null;
  const merged = normalizeStoredValue({
    ...(options.merge ? current : {}),
    ...payload,
    id: recordId,
    updated_at: new Date().toISOString()
  });

  await db.collection(collectionName).doc(recordId).set(merged, { merge: Boolean(options.merge) });
  await mirrorToRealtime(collectionName, recordId, merged).catch(() => {});
  return merged;
}

async function updateRecord(collectionName, id, payload) {
  return setRecord(collectionName, id, payload, { merge: true });
}

async function deleteRecord(collectionName, id) {
  if (!isFirebaseAdminReady) {
    throw new Error('Firebase Admin SDK is not initialized');
  }

  const recordId = String(id);
  await db.collection(collectionName).doc(recordId).delete();
  await removeRealtimeMirror(collectionName, recordId).catch(() => {});
}

async function findOne(collectionName, options = {}) {
  const [record] = await listRecords(collectionName, {
    ...options,
    limit: 1
  });
  return record || null;
}

async function countRecords(collectionName, options = {}) {
  const records = await listRecords(collectionName, options);
  return records.length;
}

module.exports = {
  normalizeStoredValue,
  listRecords,
  getRecord,
  createRecord,
  setRecord,
  updateRecord,
  deleteRecord,
  findOne,
  countRecords
};
