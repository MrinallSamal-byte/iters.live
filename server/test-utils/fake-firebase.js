/**
 * In-memory stand-in for ../database/firebase.
 *
 * It implements the slice of the Firestore Admin API the server uses
 * (documents, equality / in / array-contains queries, count aggregation,
 * batches, transactions, FieldValue.increment, FieldPath.documentId) so tests
 * exercise the real routes and the real data service, not mocks of them.
 *
 * Transactions are serialised, which gives the same observable result as
 * Firestore's optimistic retry: a transaction never sees a half-applied one.
 */

const DOCUMENT_ID = { __documentId: true };

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function applyWrite(existing, data, merge) {
  const base = merge && existing ? { ...existing } : {};
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === 'object' && value.__increment !== undefined) {
      base[key] = (Number(base[key]) || 0) + value.__increment;
    } else {
      base[key] = clone(value);
    }
  }
  return base;
}

function createFirebaseMock() {
  const collections = new Map();
  let autoId = 0;
  let transactionTail = Promise.resolve();

  const stats = { queries: 0, documentsRead: 0 };

  function bucket(name) {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name);
  }

  function snapshotOf(collection, id) {
    const data = bucket(collection).get(id);
    return {
      id,
      exists: data !== undefined,
      data: () => clone(data),
      ref: docRef(collection, id)
    };
  }

  function querySnapshot(collection, filters, limitN, { aggregate = false } = {}) {
    stats.queries += 1;
    let docs = Array.from(bucket(collection).entries()).map(([id, data]) => ({ id, data }));

    for (const { field, op, value } of filters) {
      docs = docs.filter(({ id, data }) => {
        const actual = field === DOCUMENT_ID ? id : data[field];
        if (op === '==') return actual === value;
        if (op === 'in') return Array.isArray(value) && value.includes(actual);
        if (op === 'array-contains') return Array.isArray(actual) && actual.includes(value);
        throw new Error(`Unsupported fake Firestore operator: ${op}`);
      });
    }
    if (limitN !== null) docs = docs.slice(0, limitN);

    // A count aggregation is answered by the index; no documents are downloaded.
    if (!aggregate) stats.documentsRead += docs.length;
    const snapshots = docs.map(({ id }) => snapshotOf(collection, id));
    return { docs: snapshots, size: snapshots.length, empty: snapshots.length === 0 };
  }

  function docRef(collection, id) {
    return {
      id,
      path: `${collection}/${id}`,
      async get() {
        stats.documentsRead += bucket(collection).has(id) ? 1 : 0;
        return snapshotOf(collection, id);
      },
      async set(data, options = {}) {
        bucket(collection).set(id, applyWrite(bucket(collection).get(id), data, Boolean(options.merge)));
      },
      async create(data) {
        if (bucket(collection).has(id)) {
          const error = new Error('6 ALREADY_EXISTS: Document already exists');
          error.code = 6;
          throw error;
        }
        bucket(collection).set(id, applyWrite(undefined, data, false));
      },
      async update(data) {
        if (!bucket(collection).has(id)) {
          const error = new Error('5 NOT_FOUND: No document to update');
          error.code = 5;
          throw error;
        }
        bucket(collection).set(id, applyWrite(bucket(collection).get(id), data, true));
      },
      async delete() {
        bucket(collection).delete(id);
      },
      __collection: collection
    };
  }

  function query(collection, filters = [], limitN = null) {
    return {
      where(field, op, value) {
        return query(collection, [...filters, { field, op, value }], limitN);
      },
      limit(count) {
        return query(collection, filters, count);
      },
      async get() {
        return querySnapshot(collection, filters, limitN);
      },
      count() {
        return {
          get: async () => ({ data: () => ({ count: querySnapshot(collection, filters, limitN, { aggregate: true }).size }) })
        };
      },
      __collection: collection,
      __filters: filters
    };
  }

  const db = {
    collection(name) {
      const base = query(name);
      return {
        ...base,
        doc(id) {
          autoId += 1;
          return docRef(name, id === undefined ? `auto${String(autoId).padStart(6, '0')}` : String(id));
        },
        async add(data) {
          autoId += 1;
          const ref = docRef(name, `auto${String(autoId).padStart(6, '0')}`);
          await ref.set(data);
          return ref;
        }
      };
    },

    batch() {
      const ops = [];
      return {
        set: (ref, data, options) => { ops.push(() => ref.set(data, options)); },
        update: (ref, data) => { ops.push(() => ref.update(data)); },
        delete: (ref) => { ops.push(() => ref.delete()); },
        async commit() { for (const op of ops) await op(); }
      };
    },

    runTransaction(work) {
      const run = async () => {
        const writes = [];
        const tx = {
          get: async (target) => (typeof target.get === 'function' ? target.get() : target),
          set: (ref, data, options) => { writes.push(() => ref.set(data, options)); },
          update: (ref, data) => { writes.push(() => ref.update(data)); },
          delete: (ref) => { writes.push(() => ref.delete()); }
        };
        const result = await work(tx);
        for (const write of writes) await write();
        return result;
      };
      const next = transactionTail.then(run, run);
      transactionTail = next.catch(() => {});
      return next;
    }
  };

  return {
    admin: {
      firestore: {
        FieldPath: { documentId: () => DOCUMENT_ID },
        FieldValue: { increment: (amount) => ({ __increment: amount }) }
      }
    },
    db,
    auth: {
      verifyIdToken: jest.fn(),
      createCustomToken: jest.fn(async (uid) => `custom-${uid}`),
      createUser: jest.fn(async () => ({}))
    },
    storage: {},
    realtimeDb: null,
    isFirebaseAdminReady: true,
    isRealtimeDbReady: false,

    // ---- test helpers ----
    __reset() {
      collections.clear();
      autoId = 0;
      stats.queries = 0;
      stats.documentsRead = 0;
    },
    __seed(collection, id, data) {
      bucket(collection).set(String(id), clone({ id: String(id), ...data }));
    },
    __read(collection, id) {
      return clone(bucket(collection).get(String(id)));
    },
    __all(collection) {
      return Array.from(bucket(collection).values()).map(clone);
    },
    __stats: stats
  };
}

module.exports = { createFirebaseMock, DOCUMENT_ID };
