/* TerraSync authenticated cloud synchronization.
 * Local IndexedDB remains authoritative while offline. Supabase becomes the
 * shared, user-scoped exchange point between browsers and devices.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else Object.assign(root, api);
}(typeof self !== 'undefined' ? self : globalThis, function (root) {
  'use strict';

  const ENTITY_STORES = { draft: 'drafts', observation: 'scoutingLogs' };
  const toMillis = value => {
    const parsed = Date.parse(value || '');
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const recordTime = record => record?.updatedAt || record?.createdAt || '';
  const chooseNewest = (local, remotePayload, remoteUpdatedAt) => {
    if (!local) return 'remote';
    return toMillis(remoteUpdatedAt) >= toMillis(recordTime(local)) ? 'remote' : 'local';
  };
  const cloudRow = (userId, entityType, record) => ({
    user_id: userId,
    entity_type: entityType,
    entity_id: String(record.id),
    payload: { ...record, cloudOwnerId: userId, syncStatus: 'synced' },
    client_updated_at: recordTime(record) || new Date().toISOString(),
    deleted: false
  });

  class TerraSyncCloud {
    constructor(app) {
      this.app = app;
      this.db = app.db;
      this.client = null;
      this.user = null;
      this.timer = null;
      this.syncing = false;
      this.subscription = null;
      this.config = null;
    }

    get configured() { return Boolean(this.config?.url && this.config?.publishableKey); }
    get signedIn() { return Boolean(this.user); }

    async initialize() {
      this.config = {
        url: this.app.config.supabaseUrl || localStorage.getItem('terrasync_supabase_url') || '',
        publishableKey: this.app.config.supabasePublishableKey || localStorage.getItem('terrasync_supabase_publishable_key') || ''
      };
      if (!this.configured || !root.supabase?.createClient) {
        this.updateUI();
        return;
      }
      this.client = root.supabase.createClient(this.config.url, this.config.publishableKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
      // Restore the locally cached session so an offline consultant still sees
      // only their own on-device workspace. The server validates it again when
      // an online request is made and RLS remains the authorization boundary.
      const { data: sessionData } = await this.client.auth.getSession();
      this.user = sessionData.session?.user || null;
      if (navigator.onLine) {
        const { data, error } = await this.client.auth.getUser();
        if (!error) this.user = data.user || null;
      }
      this.client.auth.onAuthStateChange((_event, session) => {
        this.user = session?.user || null;
        this.updateUI();
        this.app.drafts?.render();
        if (this.app.selectedFieldId) {
          const field = this.app.fields.find(item => item.id === this.app.selectedFieldId);
          if (field) this.app.loadFieldObservations(field);
        }
        if (this.user && navigator.onLine) setTimeout(() => this.sync(), 0);
      });
      window.addEventListener('online', () => this.sync());
      window.addEventListener('focus', () => this.user && this.sync());
      window.addEventListener('terrasync-local-change', () => this.user && navigator.onLine && this.sync());
      this.timer = setInterval(() => this.user && navigator.onLine && this.sync(), 30000);
      this.updateUI();
      if (this.user && navigator.onLine) await this.sync();
    }

    saveConfiguration(url, publishableKey) {
      const cleanUrl = String(url || '').trim().replace(/\/$/, '');
      const cleanKey = String(publishableKey || '').trim();
      if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(cleanUrl) || !cleanKey) {
        throw new Error('Enter a valid Supabase project URL and publishable key.');
      }
      localStorage.setItem('terrasync_supabase_url', cleanUrl);
      localStorage.setItem('terrasync_supabase_publishable_key', cleanKey);
    }

    async signIn(email, password) {
      if (!this.client) throw new Error('Configure Supabase first.');
      const { error } = await this.client.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }

    async signUp(email, password) {
      if (!this.client) throw new Error('Configure Supabase first.');
      const { error } = await this.client.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${location.origin}${location.pathname}` }
      });
      if (error) throw error;
    }

    async signOut() {
      if (!this.client) return;
      const { error } = await this.client.auth.signOut();
      if (error) throw error;
      this.user = null;
      this.updateUI();
    }

    async localRecords() {
      const [drafts, observations] = await Promise.all([
        this.db.getVisible('drafts', this.user.id), this.db.getVisible('scoutingLogs', this.user.id)
      ]);
      return { draft: drafts, observation: observations };
    }

    async sync() {
      if (!this.client || !this.user || !this.app.isOnline || this.syncing) return;
      this.syncing = true;
      this.app.syncInProgress = true;
      this.updateUI('syncing');
      try {
        const local = await this.localRecords();
        const { data: remoteRows, error: pullError } = await this.client
          .from('sync_records').select('entity_type,entity_id,payload,client_updated_at,deleted');
        if (pullError) throw pullError;

        const remoteByKey = new Map((remoteRows || []).map(row => [`${row.entity_type}:${row.entity_id}`, row]));
        const uploads = [];

        for (const [entityType, records] of Object.entries(local)) {
          const store = ENTITY_STORES[entityType];
          for (const record of records) {
            const remote = remoteByKey.get(`${entityType}:${record.id}`);
            if (remote && chooseNewest(record, remote.payload, remote.client_updated_at) === 'remote') {
              if (!remote.deleted) await this.db.put(store, { ...remote.payload, id: remote.payload.id ?? remote.entity_id, syncStatus: 'synced' });
            } else {
              uploads.push(cloudRow(this.user.id, entityType, record));
            }
            remoteByKey.delete(`${entityType}:${record.id}`);
          }
        }

        for (const remote of remoteByKey.values()) {
          const store = ENTITY_STORES[remote.entity_type];
          if (store && !remote.deleted) {
            await this.db.put(store, { ...remote.payload, id: remote.payload.id ?? remote.entity_id, syncStatus: 'synced' });
          }
        }

        if (uploads.length) {
          const { error: pushError } = await this.client.from('sync_records')
            .upsert(uploads, { onConflict: 'user_id,entity_type,entity_id' });
          if (pushError) throw pushError;
        }

        // Pull the acknowledged server versions. The database trigger protects
        // a newer change made concurrently by another browser.
        const { data: acknowledged, error: ackError } = await this.client
          .from('sync_records').select('entity_type,entity_id,payload,client_updated_at,deleted');
        if (ackError) throw ackError;
        for (const row of acknowledged || []) {
          const store = ENTITY_STORES[row.entity_type];
          if (store && !row.deleted) await this.db.put(store, { ...row.payload, id: row.payload.id ?? row.entity_id, syncStatus: 'synced' });
        }
        this.app.lastSyncedTimestamp = new Date();
        await this.app.loadStateFromDB();
        await this.app.drafts?.render();
        if (this.app.selectedFieldId) {
          const field = this.app.fields.find(item => item.id === this.app.selectedFieldId);
          if (field) await this.app.loadFieldObservations(field);
        }
        this.updateUI('synced');
      } catch (error) {
        console.error('Cloud synchronization failed:', error);
        this.updateUI('error', error.message);
      } finally {
        this.syncing = false;
        this.app.syncInProgress = false;
      }
    }

    updateUI(state, detail) {
      const app = this.app;
      const email = this.user?.email || '';
      const account = document.getElementById('cloudAccountText');
      if (account) account.textContent = email ? `Signed in as ${email}` : this.configured ? 'Supabase configured · sign in to synchronize' : 'Cloud synchronization requires setup';
      const button = app.manualSyncBtn;
      if (!this.configured) {
        app.syncStatusBadge.className = 'sync-badge offline';
        app.syncStatusText.textContent = 'Device-only storage · cloud setup required';
        button.disabled = true;
        button.textContent = 'Cloud setup';
      } else if (!this.client) {
        app.syncStatusBadge.className = 'sync-badge offline';
        app.syncStatusText.textContent = 'Cloud library unavailable · local saves continue';
        button.disabled = true;
        button.textContent = 'Cloud unavailable';
      } else if (!this.user) {
        app.syncStatusBadge.className = 'sync-badge pending';
        app.syncStatusText.textContent = 'Cloud ready · sign in';
        button.disabled = true;
        button.textContent = 'Sign in to sync';
      } else if (!navigator.onLine) {
        app.syncStatusBadge.className = 'sync-badge offline';
        app.syncStatusText.textContent = 'Offline · changes queued on this device';
        button.disabled = true;
        button.textContent = 'Waiting for network';
      } else if (state === 'syncing' || this.syncing) {
        app.syncStatusBadge.className = 'sync-badge pending';
        app.syncStatusText.textContent = 'Synchronizing with cloud…';
        button.disabled = true;
        button.textContent = 'Synchronizing…';
      } else if (state === 'error') {
        app.syncStatusBadge.className = 'sync-badge offline';
        app.syncStatusText.textContent = `Sync failed · ${detail || 'retry available'}`;
        button.disabled = false;
        button.textContent = 'Retry sync';
      } else {
        app.syncStatusBadge.className = 'sync-badge';
        app.syncStatusText.textContent = state === 'synced' ? 'Saved to cloud · available on your devices' : `Cloud connected · ${email}`;
        button.disabled = false;
        button.textContent = 'Sync now';
      }
      const authButton = document.getElementById('cloudAuthBtn');
      if (authButton) authButton.textContent = this.user ? 'Cloud account' : 'Connect cloud';
      const signOut = document.getElementById('cloudSignOutBtn');
      if (signOut) signOut.hidden = !this.user;
      if (app.lastSyncedEl && app.lastSyncedTimestamp) {
        app.lastSyncedEl.textContent = `Cloud synchronized ${app.lastSyncedTimestamp.toLocaleString()} · newest change wins`;
      } else if (app.lastSyncedEl) {
        app.lastSyncedEl.textContent = this.user ? 'Cloud connected · records synchronize automatically' :
          'Local records only · connect and sign in for cross-browser access';
      }
    }
  }

  return { TerraSyncCloud, TerraSyncSyncHelpers: { chooseNewest, cloudRow, recordTime } };
}));
