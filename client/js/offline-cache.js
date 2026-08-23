(function () {
  'use strict';

  var DB_NAME = 'iterasn-offline';
  var STORE_NAME = 'kv';
  var DB_VERSION = 1;
  var STAMP_PREFIX = 'stamp:';

  var warnedOnce = false;
  var dbPromise = null;

  window.APP = window.APP || {};

  function warnOnce(err) {
    if (warnedOnce) return;
    warnedOnce = true;
    console.warn('[OfflineCache] IndexedDB unavailable:', err && err.message ? err.message : err);
  }

  function openDb() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise(function (resolve, reject) {
      if (typeof indexedDB === 'undefined' || indexedDB === null) {
        reject(new Error('IndexedDB is not supported in this browser'));
        return;
      }

      var request;
      try {
        request = indexedDB.open(DB_NAME, DB_VERSION);
      } catch (err) {
        reject(err);
        return;
      }

      request.onupgradeneeded = function () {
        try {
          if (!request.result.objectStoreNames.contains(STORE_NAME)) {
            request.result.createObjectStore(STORE_NAME);
          }
        } catch (err) {
          reject(err);
        }
      };

      request.onsuccess = function () {
        resolve(request.result);
      };

      request.onerror = function () {
        reject(request.error || new Error('Failed to open IndexedDB database'));
      };

      request.onblocked = function () {
        reject(new Error('IndexedDB open request blocked'));
      };
    });

    // Reset on failure so a later call can retry opening.
    dbPromise.catch(function (err) {
      warnOnce(err);
      dbPromise = null;
    });

    return dbPromise;
  }

  function runTransaction(mode, action) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx;
        try {
          tx = db.transaction(STORE_NAME, mode);
        } catch (err) {
          reject(err);
          return;
        }

        var store = tx.objectStore(STORE_NAME);
        var result;

        try {
          result = action(store);
        } catch (err) {
          reject(err);
          return;
        }

        tx.oncomplete = function () {
          resolve(result ? result.result : undefined);
        };
        tx.onerror = function () {
          reject(tx.error || new Error('IndexedDB transaction failed'));
        };
        tx.onabort = function () {
          reject(tx.error || new Error('IndexedDB transaction aborted'));
        };
      });
    });
  }

  async function safely(run, fallback) {
    try {
      return await run();
    } catch (err) {
      warnOnce(err);
      return fallback;
    }
  }

  window.APP.OfflineCache = {
    available: function () {
      try {
        return typeof indexedDB !== 'undefined' && indexedDB !== null;
      } catch (err) {
        return false;
      }
    },

    put: function (key, value) {
      return safely(async function () {
        await runTransaction('readwrite', function (store) {
          store.put(value, String(key));
        });
        return true;
      }, false);
    },

    get: function (key) {
      return safely(async function () {
        const value = await runTransaction('readonly', function (store) {
          return store.get(String(key));
        });
        return value === undefined ? null : value;
      }, null);
    },

    setStamp: function (key, isoString) {
      return safely(async function () {
        await runTransaction('readwrite', function (store) {
          store.put(String(isoString), STAMP_PREFIX + String(key));
        });
        return true;
      }, false);
    },

    getStamp: function (key) {
      return safely(async function () {
        const stamp = await runTransaction('readonly', function (store) {
          return store.get(STAMP_PREFIX + String(key));
        });
        return typeof stamp === 'string' ? stamp : null;
      }, null);
    },

    clearAll: function () {
      return safely(async function () {
        await runTransaction('readwrite', function (store) {
          store.clear();
        });
        return true;
      }, false);
    }
  };

  function dispatchConnectivity(online) {
    try {
      window.dispatchEvent(new CustomEvent('app-connectivity', {
        detail: { online: Boolean(online) }
      }));
    } catch (err) {
      console.warn('[OfflineCache] Failed to dispatch app-connectivity event:', err && err.message ? err.message : err);
    }
  }

  window.addEventListener('online', function () {
    dispatchConnectivity(true);
  });

  window.addEventListener('offline', function () {
    dispatchConnectivity(false);
  });
})();
