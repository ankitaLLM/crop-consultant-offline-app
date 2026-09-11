/**
 * TerraSync IndexedDB Database wrapper
 * Handles local data persistence and offline syncing queue.
 */
class TerraSyncDB {
  constructor(dbName = 'TerraSyncDB', version = 3) {
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
        // Sync queue for recommendations created offline
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

        console.log('Database stores created/upgraded');
      };
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
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  delete(storeName, key) {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error('Database not initialized'));
      const tx = this.db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).delete(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  clear(storeName) {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error('Database not initialized'));
      const tx = this.db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).clear();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
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
      syncStatus: 'pending'
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
}

window.AppDB = new TerraSyncDB();
