/**
 * TerraSync IndexedDB Database wrapper
 * Handles confirmed device-local data persistence and draft migrations.
 */
class TerraSyncDB {
  constructor(dbName = 'TerraSyncDB', version = 4) {
    this.dbName = dbName;
    this.version = version;
    this.db = null;
  }

  open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = (e) => {
        console.error('Database failed to open:', e);
        reject(e.target.error);
      };

      request.onsuccess = (e) => {
        this.db = e.target.result;
        this.db.onversionchange = () => {
          this.db.close();
          window.dispatchEvent(new Event('terrasync-db-closed'));
        };
        console.log('Database initialized successfully');
        resolve(this.db);
      };

      request.onupgradeneeded = (e) => {
        const db = e.target.result;

        if (!db.objectStoreNames.contains('growers')) {
          db.createObjectStore('growers', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('fields')) {
          db.createObjectStore('fields', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('products')) {
          db.createObjectStore('products', { keyPath: 'id' });
        }
        // Legacy stores remain so version upgrades never discard prior work.
        if (!db.objectStoreNames.contains('syncQueue')) {
          db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
        }
        // Locally-created scouting observations (merged into field data on save)
        if (!db.objectStoreNames.contains('scoutingLogs')) {
          db.createObjectStore('scoutingLogs', { keyPath: 'id', autoIncrement: true });
        }
        // Draft recommendations/sales documents
        if (!db.objectStoreNames.contains('recommendations')) {
          db.createObjectStore('recommendations', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('drafts')) {
          const drafts = db.createObjectStore('drafts', { keyPath: 'id' });
          drafts.createIndex('fieldId', 'fieldId');
          // One atomic version upgrade. Keep every original record as well.
          for (const name of ['syncQueue', 'recommendations']) {
            const cursor = e.target.transaction.objectStore(name).openCursor();
            cursor.onsuccess = () => {
              const row = cursor.result;
              if (!row) return;
              drafts.put({ ...row.value, id: `legacy-${name}-${row.primaryKey}`,
                revision: 1, documentType: 'recommendation', status: 'ready',
                syncStatus: 'local-only', legacyStatus: row.value.status || row.value.syncStatus,
                updatedAt: row.value.createdAt || new Date().toISOString() });
              row.continue();
            };
          }
        }

        console.log('Database stores created/upgraded');
      };
      request.onblocked = () => window.dispatchEvent(new Event('terrasync-db-blocked'));
    });
  }

  getAll(storeName) {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error('Database not initialized'));
      const tx = this.db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  get(storeName, key) {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error('Database not initialized'));
      const tx = this.db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  put(storeName, val) {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error('Database not initialized'));
      const tx = this.db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).put(val);
      tx.oncomplete = () => resolve(req.result);
      tx.onabort = () => reject(tx.error || new Error('Local save was interrupted'));
      tx.onerror = () => reject(tx.error || req.error);
    });
  }

  delete(storeName, key) {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error('Database not initialized'));
      const tx = this.db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).delete(key);
      tx.oncomplete = () => resolve(req.result);
      tx.onabort = () => reject(tx.error || new Error('Local change was interrupted'));
      tx.onerror = () => reject(tx.error || req.error);
    });
  }

  clear(storeName) {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error('Database not initialized'));
      const tx = this.db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).clear();
      tx.oncomplete = () => resolve(req.result);
      tx.onabort = () => reject(tx.error || new Error('Local change was interrupted'));
      tx.onerror = () => reject(tx.error || req.error);
    });
  }

  addToSyncQueue(recommendation) {
    return this.put('syncQueue', {
      ...recommendation,
      createdAt: new Date().toISOString(),
      status: 'pending'
    });
  }

  getSyncQueue() {
    return this.getAll('syncQueue');
  }

  addScoutingLog(observation) {
    return this.put('scoutingLogs', {
      ...observation,
      createdAt: new Date().toISOString(),
      syncStatus: 'local-only'
    });
  }

  getScoutingLogs() {
    return this.getAll('scoutingLogs');
  }

  addRecommendation(rec) {
    return this.put('recommendations', {
      ...rec,
      createdAt: new Date().toISOString(),
      syncStatus: 'pending'
    });
  }

  getRecommendations() {
    return this.getAll('recommendations');
  }

  saveDraft(draft, expectedRevision) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('drafts', 'readwrite');
      const store = tx.objectStore('drafts');
      let saved, failure;
      const req = store.get(draft.id);
      req.onsuccess = () => {
        if ((req.result?.revision || 0) !== expectedRevision) {
          failure = new Error('This draft was edited in another tab. Save a separate copy to keep your changes.');
          failure.name = 'DraftConflictError';
          tx.abort();
          return;
        }
        saved = { ...draft, revision: expectedRevision + 1,
          syncStatus: 'local-only', updatedAt: new Date().toISOString() };
        store.put(saved);
      };
      tx.oncomplete = () => resolve(saved);
      tx.onabort = () => reject(failure || tx.error || new Error('Local save was interrupted'));
      tx.onerror = () => reject(tx.error || req.error);
    });
  }
}

window.AppDB = new TerraSyncDB();
