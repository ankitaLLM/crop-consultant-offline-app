/**
 * TerraSync Application Core
 * Dedicated to Crop Consultant persona & workflow
 */

const escapeHTML = window.escapeHTML || (value => String(value ?? '').replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));

class TerraSyncApp {
  constructor() {
    this.db = window.AppDB;
    this.map = null;
    this.tileLayer = null;
    
    // Header Info
    this.consultantNameEl = document.getElementById('consultantName');
    
    // Left Sidebar UI elements
    this.growerSelect = document.getElementById('growerSelect');
    this.growerDetails = document.getElementById('growerDetails');
    this.growerSearchInput = document.getElementById('growerSearchInput');
    this.fieldList = document.getElementById('fieldList');
    this.fieldCount = document.getElementById('fieldCount');
    
    // Sync & Network controls
    this.networkToggle = document.getElementById('networkToggle');
    this.syncStatusBadge = document.getElementById('syncStatusBadge');
    this.syncStatusText = document.getElementById('syncStatusText');
    this.manualSyncBtn = document.getElementById('manualSyncBtn');
    this.offlineBanner = document.getElementById('offlineBanner');
    
    // Map overlay elements
    this.downloadMapBtn = document.getElementById('downloadMapBtn');
    this.downloadProgressBar = document.getElementById('downloadProgressBar');
    this.downloadProgressFill = document.getElementById('downloadProgressFill');
    this.downloadStatusText = document.getElementById('downloadStatusText');
    this.simGpsBtn = document.getElementById('simGpsBtn');
    this.gpsCoordText = document.getElementById('gpsCoordText');
    this.mapToast = document.getElementById('mapToast');
    this.toastText = document.getElementById('toastText');
    this.toastDot = document.getElementById('toastDot');
    
    // Right Sidebar panels
    this.activeFieldName = document.getElementById('activeFieldName');
    this.fieldInfoBar = document.getElementById('fieldInfoBar');
    this.fieldDiagnostics = document.getElementById('fieldDiagnostics');
    this.scoutingSection = document.getElementById('scoutingSection');
    this.addObservationBtn = document.getElementById('addObservationBtn');
    this.scoutingLogList = document.getElementById('scoutingLogList');
    this.openRecModalBtn = document.getElementById('openRecommendModalBtn');
    this.syncQueueList = document.getElementById('syncQueueList');
    this.queueCount = document.getElementById('queueCount');
    this.lastSyncedEl = document.getElementById('lastSyncedTime');
    
    // Scouting Modal elements
    this.scoutingModal = document.getElementById('scoutingModal');
    this.closeScoutingModalBtn = document.getElementById('closeScoutingModalBtn');
    this.cancelScoutingBtn = document.getElementById('cancelScoutingBtn');
    this.scoutingForm = document.getElementById('scoutingForm');
    this.scoutFieldInput = document.getElementById('scoutFieldInput');
    this.scoutCategory = document.getElementById('scoutCategory');
    this.scoutIssue = document.getElementById('scoutIssue');
    this.scoutSeverity = document.getElementById('scoutSeverity');
    this.scoutNote = document.getElementById('scoutNote');
    this.scoutAction = document.getElementById('scoutAction');
    
    // Recommendation Modal elements
    this.recModal = document.getElementById('recommendationModal');
    this.closeModalBtn = document.getElementById('closeModalBtn');
    this.cancelModalBtn = document.getElementById('cancelModalBtn');
    this.recommendationForm = document.getElementById('recommendationForm');
    this.recFieldInput = document.getElementById('recFieldInput');
    this.recProductType = document.getElementById('recProductType');
    this.recProduct = document.getElementById('recProduct');
    this.recRate = document.getElementById('recRate');
    this.recUnit = document.getElementById('recUnit');
    this.recNotes = document.getElementById('recNotes');
    
    // Detail display overlay
    this.recDetailOverlay = document.getElementById('recDetailOverlay');
    
    // Cost calculation displays
    this.calcAcreage = document.getElementById('calcAcreage');
    this.calcUnitPrice = document.getElementById('calcUnitPrice');
    this.calcTotalQty = document.getElementById('calcTotalQty');
    this.calcTotalCost = document.getElementById('calcTotalCost');
    
    // State variables
    this.selectedGrowerId = null;
    this.selectedFieldId = null;
    this.fields = [];
    this.growers = [];
    this.products = {};
    this.scoutingCategories = [];
    this.severityLevels = [];
    this.consultant = {};
    
    this.mapPolygons = {};
    this.mapMarkers = [];
    this.gpsMarker = null;
    this.gpsInterval = null;
    this.gpsRouteCoords = [];
    this.gpsRouteIndex = 0;
    
    this.layerNdviBtn = document.getElementById('layerNdviBtn');
    this.layerSoilBtn = document.getElementById('layerSoilBtn');
    this.activeMapLayer = null; // 'ndvi', 'soil', or null
    
    this.isOnline = navigator.onLine;
    this.demoOffline = false;
    this.syncInProgress = false;
    this.toastTimeout = null;
    this.lastSyncedTimestamp = null;
  }

  /**
   * Initializes application state and event handlers
   */
  async init() {
    try {
      // 1. Open database
      await this.db.open();

      // 2. Seed database
      await this.seedDatabaseIfNeeded();

      // 3. Load from IndexedDB
      await this.loadStateFromDB();

      // 4. Initialize Leaflet Map
      this.drafts = new DraftWorkspace(this);
      if (window.L) this.initMap();
      else document.getElementById('map').textContent = 'Map unavailable. Grower data and drafts are still available.';

      // 5. Setup UI listeners
      this.setupEventListeners();

      // 6. Populate UI views
      this.renderConsultantHeader();
      this.populateModalDropdowns();
      this.populateGrowerDropdown();

      // 7. Refresh local queues
      await this.refreshSyncQueueUI();
      
      // 8. Trigger connection check
      this.updateOnlineStatus();

      this.showToast('TerraSync Agronomy Module Initialized', false);
    } catch (err) {
      document.getElementById('localRecordSummary').textContent = 'Storage could not open. Close other TerraSync tabs and reload; do not clear browser data.';
      console.error('TerraSync Init failed:', err);
      this.showToast('Database connection error', true);
    }
  }

  /**
   * Seeds database if it is empty
   */
  async seedDatabaseIfNeeded() {
    const consultantProfile = await this.db.get('products', 'consultant');
    if (consultantProfile) {
      console.log('IndexedDB matches cached schema.');
      return;
    }

    console.log('Pre-loading consultant database tables (New Schema migration)...');
    
    // Preserve existing records; only seed missing items.
    
    const data = window.TerraSyncData;

    // Seed growers
    for (const grower of data.growers) {
      if (!await this.db.get('growers', grower.id)) await this.db.put('growers', grower);
    }

    // Seed fields
    for (const field of data.fields) {
      if (!await this.db.get('fields', field.id)) await this.db.put('fields', { ...field, cachedMap: false });
    }

    // Seed product catalog & metadata
    await this.db.put('products', { id: 'catalog', ...data.products });
    await this.db.put('products', { id: 'categories', list: data.scoutingCategories });
    await this.db.put('products', { id: 'severity', list: data.severityLevels });
    await this.db.put('products', { id: 'consultant', ...data.consultant });
    console.log('Seeding process finished.');
  }

  /**
   * Load state variables from IndexedDB
   */
  async loadStateFromDB() {
    this.growers = await this.db.getAll('growers');
    this.fields = await this.db.getAll('fields');
    
    const catalog = await this.db.get('products', 'catalog');
    this.products = catalog || {};
    
    const catList = await this.db.get('products', 'categories');
    this.scoutingCategories = catList ? catList.list : [];
    
    const sevList = await this.db.get('products', 'severity');
    this.severityLevels = sevList ? sevList.list : [];
    
    const consultantProfile = await this.db.get('products', 'consultant');
    this.consultant = consultantProfile || { name: 'Field Consultant', title: 'Consultant' };
  }

  /**
   * Renders the consultant profile in the header
   */
  renderConsultantHeader() {
    if (this.consultantNameEl) {
      const licenseSuffix = this.consultant.license ? ` (${this.consultant.license})` : '';
      this.consultantNameEl.textContent = `${this.consultant.name}${licenseSuffix}`;
    }
  }

  /**
   * Populates default inputs on forms
   */
  populateModalDropdowns() {
    // 1. Scouting issue categories
    this.scoutCategory.innerHTML = '<option value="">-- Choose Category --</option>';
    this.scoutingCategories.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat.value;
      option.textContent = `${cat.icon} ${cat.label}`;
      this.scoutCategory.appendChild(option);
    });

    // 2. Severity options
    this.scoutSeverity.innerHTML = '<option value="">-- Choose Severity --</option>';
    this.severityLevels.forEach(sev => {
      const option = document.createElement('option');
      option.value = sev.value;
      option.textContent = sev.label;
      this.scoutSeverity.appendChild(option);
    });
  }

  /**
   * Initialize Leaflet Map
   */
  initMap() {
    const defaultCenter = [42.0266, -93.6465]; // Ames, Iowa
    
    this.map = L.map('map', {
      center: defaultCenter,
      zoom: 13,
      zoomControl: true,
      attributionControl: true
    });

    this.tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.map);

    L.control.scale({ position: 'bottomleft' }).addTo(this.map);
  }

  /**
   * Populates the grower selector list
   */
  populateGrowerDropdown(filterText = '') {
    this.growerSelect.innerHTML = '';
    const query = filterText.toLowerCase();

    const filtered = this.growers.filter(g => {
      if (!filterText) return true;
      return g.name.toLowerCase().includes(query) || 
             g.contactName.toLowerCase().includes(query) ||
             (g.address && g.address.toLowerCase().includes(query));
    });

    filtered.forEach(grower => {
      const option = document.createElement('option');
      option.value = grower.id;
      option.textContent = grower.name;
      this.growerSelect.appendChild(option);
    });

    if (filtered.length > 0) {
      if (this.selectedGrowerId && filtered.some(g => g.id === this.selectedGrowerId)) {
        this.growerSelect.value = this.selectedGrowerId;
      } else {
        this.selectGrower(filtered[0].id);
      }
    } else {
      this.growerDetails.innerHTML = '<p style="text-align:center; color: var(--text-muted); padding: 0.5rem;">No growers match.</p>';
      this.fieldList.innerHTML = '';
      this.fieldCount.textContent = '(0)';
      this.selectedFieldId = null;
      this.openRecModalBtn.disabled = true;
      this.addObservationBtn.disabled = true;
    }
  }

  /**
   * Configures visual controls & event binds
   */
  setupEventListeners() {
    // Dropdown change
    this.growerSelect.addEventListener('change', (e) => {
      this.selectGrower(e.target.value);
    });

    // Search query
    if (this.growerSearchInput) {
      this.growerSearchInput.addEventListener('input', (e) => {
        this.populateGrowerDropdown(e.target.value);
      });
    }

    // Offline mode toggle
    this.networkToggle.addEventListener('change', (e) => {
      this.demoOffline = !e.target.checked;
      this.updateOnlineStatus();
    });

    window.addEventListener('online', () => this.updateOnlineStatus());
    window.addEventListener('offline', () => this.updateOnlineStatus());
    document.getElementById('exportEditorBtn').addEventListener('click', () => this.drafts.exportBackup());
    document.getElementById('protectStorageBtn').addEventListener('click', async () => {
      const status = document.getElementById('storageProtectionStatus');
      try {
        const granted = await navigator.storage?.persist?.();
        status.textContent = granted ? 'Storage protection granted. Clearing browser data still deletes local work.' : 'Protection not granted. Download a backup regularly.';
      } catch { status.textContent = 'Storage protection unavailable. Download a backup regularly.'; }
    });
    // Sync button
    this.manualSyncBtn.addEventListener('click', () => {
      if (this.isOnline && !this.syncInProgress) {
        this.triggerSync();
      }
    });

    // Cache Map tiles
    this.downloadMapBtn.addEventListener('click', () => {
      this.simulateMapCache();
    });

    // Map Layers
    if (this.layerNdviBtn) {
      this.layerNdviBtn.addEventListener('click', () => this.toggleMapLayer('ndvi'));
    }
    if (this.layerSoilBtn) {
      this.layerSoilBtn.addEventListener('click', () => this.toggleMapLayer('soil'));
    }

    // Walk perimeter
    this.simGpsBtn.addEventListener('click', () => {
      this.toggleGpsSimulation();
    });

    // Add Scouting Pin
    this.addObservationBtn.addEventListener('click', () => {
      this.openScoutingModal();
    });

    this.closeScoutingModalBtn.addEventListener('click', () => this.closeScoutingModal());
    this.cancelScoutingBtn.addEventListener('click', () => this.closeScoutingModal());
    
    this.scoutingForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveScoutingObservation();
    });

    // Create recommendation
    this.openRecModalBtn.addEventListener('click', () => {
      this.openRecommendationModal();
    });

    this.closeModalBtn.addEventListener('click', () => this.closeRecommendationModal());
    this.cancelModalBtn.addEventListener('click', () => this.closeRecommendationModal());

    // Modal product categories select loader
    this.recProductType.addEventListener('change', (e) => {
      this.populateModalProducts(e.target.value);
      // Persist the cleared product as part of the category change.
      this.drafts.autosave();
    });

    // Cost calculations
    this.recProduct.addEventListener('change', () => this.calculateRecommendationCost());
    this.recRate.addEventListener('input', () => this.calculateRecommendationCost());

    this.recommendationForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveRecommendation();
    });

    // Detail Modal closing
    if (this.recDetailOverlay) {
      this.recDetailOverlay.addEventListener('click', (e) => {
        if (e.target === this.recDetailOverlay) {
          this.closeRecDetailModal();
        }
      });
    }

    // ESC key closes modals
    document.addEventListener('keydown', (e) => {
      const dialog = [this.recDetailOverlay, this.recModal, this.scoutingModal].find(el => el?.classList.contains('open'));
      if (dialog && e.key === 'Tab') {
        const nodes = [...dialog.querySelectorAll('button, input, select, textarea, [tabindex="0"]')].filter(el => !el.disabled && !el.hidden);
        const first = nodes[0], last = nodes.at(-1);
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
      if (e.key === 'Escape') {
        this.closeRecommendationModal();
        this.closeScoutingModal();
        this.closeRecDetailModal();
      }
    });
  }

  /**
   * Handle grower selection details loading
   */
  async selectGrower(growerId) {
    this.selectedGrowerId = growerId;
    const grower = this.growers.find(g => g.id === growerId);
    if (!grower) return;

    this.growerDetails.innerHTML = `
      <p><strong>Contact:</strong> ${grower.contactName}</p>
      <p><strong>Phone:</strong> ${grower.phone}</p>
      <p><strong>Email:</strong> ${grower.email}</p>
      <p><strong>Address:</strong> ${grower.address || 'Field address not provided'}</p>
      <p><strong>Total Acreage:</strong> ${grower.totalAcreage} acres</p>
      <p><strong>Last Visit:</strong> ${grower.lastVisit || 'Not logged'}</p>
      ${grower.notes ? `<p style="margin-top: 0.5rem; color: var(--text-secondary); font-style: italic;">"${grower.notes}"</p>` : ''}
    `;

    this.renderFieldList();
  }

  /**
   * Render grower's fields in Left sidebar
   */
  renderFieldList() {
    this.fieldList.innerHTML = '';
    const growerFields = this.fields.filter(f => f.growerId === this.selectedGrowerId);
    this.fieldCount.textContent = `(${growerFields.length})`;

    if (growerFields.length === 0) {
      this.fieldList.innerHTML = '<p style="text-align:center; padding: 1.5rem; color: var(--text-muted);">No fields logged for grower.</p>';
      return;
    }

    growerFields.forEach(field => {
      const card = document.createElement('div');
      card.className = `field-card ${this.selectedFieldId === field.id ? 'active' : ''}`;
      card.dataset.id = field.id;

      const observationsCount = field.scoutingHistory ? field.scoutingHistory.length : 0;

      card.innerHTML = `
        <div class="field-card-header">
          <span class="field-name">${field.name}</span>
          <span class="field-crop-badge ${field.crop.toLowerCase()}">${field.crop}</span>
        </div>
        <div class="field-meta-grid">
          <div class="field-meta-item">Area: <strong>${field.acreage} ac</strong></div>
          <div class="field-meta-item">Stage: <strong>${field.cropStage}</strong></div>
          <div class="field-meta-item">Soil: <strong>${field.soilType}</strong></div>
          <div class="field-meta-item">History: <strong>${observationsCount} logs</strong></div>
        </div>
        <div class="ndvi-bar-container">
          <div class="ndvi-row">
            <span>NDVI (Crop Health)</span>
            <strong>${field.ndvi}</strong>
          </div>
          <div class="ndvi-bar">
            <div class="ndvi-fill" style="width: ${field.ndvi * 100}%"></div>
          </div>
        </div>
      `;

      card.addEventListener('click', () => this.selectField(field.id));
      this.fieldList.appendChild(card);
    });

    this.renderFieldsOnMap(growerFields);

    if (growerFields.length > 0 && (!this.selectedFieldId || !growerFields.some(f => f.id === this.selectedFieldId))) {
      this.selectField(growerFields[0].id);
    }
  }

  /**
   * Highlight field boundary, center map and render charts
   */
  async selectField(fieldId) {
    document.querySelectorAll('.field-card').forEach(c => {
      c.classList.toggle('active', c.dataset.id === fieldId);
    });

    this.selectedFieldId = fieldId;
    const field = this.fields.find(f => f.id === fieldId);
    if (!field) return;

    // Header panels
    this.activeFieldName.textContent = field.name;
    this.fieldInfoBar.style.display = 'block';
    this.fieldInfoBar.innerHTML = `
      <div class="field-meta-grid" style="grid-template-columns: repeat(3, 1fr); padding: 0.5rem 0; font-size: 0.8rem; border-bottom: 1px solid var(--border-glow);">
        <div>Crop: <strong style="color:var(--primary);">${field.crop}</strong></div>
        <div>Variety: <strong>${field.variety || 'Unknown'}</strong></div>
        <div>Planted: <strong>${field.plantDate || 'N/A'}</strong></div>
      </div>
      <div style="font-size: 0.75rem; color:var(--text-muted); margin-top: 0.25rem;">Previous crop rotation: <strong>${field.previousCrop || 'N/A'}</strong></div>
    `;

    this.fieldDiagnostics.style.display = 'block';
    this.scoutingSection.style.display = 'block';
    this.openRecModalBtn.removeAttribute('disabled');
    this.addObservationBtn.disabled = false;

    // Render soil & NDVI graphs
    this.renderSoilMoistureChart(field.charts.soilMoisture);
    this.renderNPKChart(field.charts.npk);
    this.renderNDVIHistoryChart(field.charts.ndviHistory);
    
    // Load local observations merged with seeded ones
    await this.loadFieldObservations(field);

    this.updateMapCacheUI(field);

    // Reset map layers when switching fields
    this.activeMapLayer = null;
    if (this.layerNdviBtn) {
      this.layerNdviBtn.classList.remove('btn-primary');
      this.layerNdviBtn.classList.add('btn-secondary');
    }
    if (this.layerSoilBtn) {
      this.layerSoilBtn.classList.remove('btn-primary');
      this.layerSoilBtn.classList.add('btn-secondary');
    }

    // Zoom and highlight polygon
    const polygon = this.mapPolygons[field.id];
    if (polygon) {
      this.map.fitBounds(polygon.getBounds(), { padding: [50, 50], maxZoom: 16 });
      
      Object.keys(this.mapPolygons).forEach(id => {
        const poly = this.mapPolygons[id];
        poly.setStyle({
          weight: id === fieldId ? 4 : 2,
          color: id === fieldId ? '#10b981' : '#4b5563',
          fillOpacity: id === fieldId ? 0.3 : 0.1
        });
      });
    }

    this.stopGpsSimulation();
    this.showToast(`Active Field: ${field.name}`, false);
  }

  /**
   * Load local scouting logs and combine with initial data
   */
  async loadFieldObservations(field) {
    const localObs = await this.db.getScoutingLogs();
    const fieldLocalObs = localObs.filter(o => o.fieldId === field.id);
    
    // Merge seeded scoutingHistory with newly logged local observations
    const combinedObs = [...(field.scoutingHistory || []), ...fieldLocalObs];
    
    // Sort descending by date
    combinedObs.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    this.renderScoutingLogs(combinedObs);
    this.renderScoutingMarkersOnMap(field, fieldLocalObs);
  }

  /**
   * Renders growers fields boundaries as polygons
   */
  renderFieldsOnMap(growerFields) {
    if (!this.map) return;
    Object.values(this.mapPolygons).forEach(p => this.map.removeLayer(p));
    this.mapPolygons = {};

    this.mapMarkers.forEach(m => this.map.removeLayer(m));
    this.mapMarkers = [];

    const cropColors = {
      'Corn': '#f59e0b',
      'Soybeans': '#10b981',
      'Wheat': '#8b5cf6'
    };

    growerFields.forEach(field => {
      const color = cropColors[field.crop] || '#3b82f6';
      
      const polygon = L.polygon(field.polygon, {
        color: '#4b5563',
        weight: 2,
        fillColor: color,
        fillOpacity: 0.1,
        className: `field-polygon-${field.id}`
      }).addTo(this.map);

      this.mapPolygons[field.id] = polygon;

      polygon.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        this.selectField(field.id);
      });

      polygon.bindTooltip(field.name, {
        permanent: true,
        direction: 'center',
        className: 'field-label-overlay'
      });

      // Render default seeded markers
      if (field.scoutingHistory) {
        field.scoutingHistory.forEach(pin => {
          this.createObservationMarker(pin);
        });
      }
    });
  }

  /**
   * Toggles Map Layers (NDVI / Soil)
   */
  toggleMapLayer(layerType) {
    if (!this.selectedFieldId) {
      this.showToast("Select a field first", true);
      return;
    }

    // Toggle off if already active
    if (this.activeMapLayer === layerType) {
      this.activeMapLayer = null;
      this.layerNdviBtn.classList.remove('btn-primary');
      this.layerNdviBtn.classList.add('btn-secondary');
      this.layerSoilBtn.classList.remove('btn-primary');
      this.layerSoilBtn.classList.add('btn-secondary');
      // Reset polygon
      const poly = this.mapPolygons[this.selectedFieldId];
      if (poly) poly.setStyle({ fillOpacity: 0.3, fillColor: '#10b981' }); // Default active color
      return;
    }

    this.activeMapLayer = layerType;
    this.layerNdviBtn.classList.remove('btn-primary');
    this.layerNdviBtn.classList.add('btn-secondary');
    this.layerSoilBtn.classList.remove('btn-primary');
    this.layerSoilBtn.classList.add('btn-secondary');
    
    if (layerType === 'ndvi') {
      this.layerNdviBtn.classList.remove('btn-secondary');
      this.layerNdviBtn.classList.add('btn-primary');
    } else {
      this.layerSoilBtn.classList.remove('btn-secondary');
      this.layerSoilBtn.classList.add('btn-primary');
    }
    
    this.renderActiveMapLayer();
  }

  renderActiveMapLayer() {
    if (!this.activeMapLayer || !this.selectedFieldId) return;
    
    const field = this.fields.find(f => f.id === this.selectedFieldId);
    const poly = this.mapPolygons[this.selectedFieldId];
    if (!poly || !field) return;
    
    if (this.activeMapLayer === 'ndvi') {
       // Green to red heat map simulation based on NDVI score
       const color = field.ndvi > 0.7 ? '#10b981' : (field.ndvi > 0.5 ? '#f59e0b' : '#ef4444');
       poly.setStyle({ fillColor: color, fillOpacity: 0.7 });
       this.showToast(`NDVI Layer Active (Score: ${field.ndvi})`, false);
    } else if (this.activeMapLayer === 'soil') {
       // Brown/earth tone simulation for Soil Topography
       poly.setStyle({ fillColor: '#8b4513', fillOpacity: 0.6 });
       this.showToast(`Soil Layer Active: ${field.soilType}`, false);
    }
  }

  /**
   * Renders local field markers
   */
  renderScoutingMarkersOnMap(field, localObs) {
    if (!this.map) return;
    // Remove existing markers
    this.mapMarkers.forEach(m => this.map.removeLayer(m));
    this.mapMarkers = [];

    // Render seeded markers
    if (field.scoutingHistory) {
      field.scoutingHistory.forEach(pin => {
        this.createObservationMarker(pin);
      });
    }

    // Render local markers
    localObs.forEach(pin => {
      this.createObservationMarker(pin);
    });
  }

  /**
   * Helper to draw a circle marker on leaflet
   */
  createObservationMarker(pin) {
    pin = Object.fromEntries(Object.entries(pin).map(([k, v]) => [k, typeof v === 'string' ? escapeHTML(v) : v]));
    if (!pin.lat || !pin.lng) return;
    
    const pinColor = pin.severity === 'High' ? '#ef4444' : pin.severity === 'Medium' ? '#f59e0b' : '#10b981';

    const marker = L.circleMarker([pin.lat, pin.lng], {
      radius: 8,
      fillColor: pinColor,
      color: '#ffffff',
      weight: 2,
      fillOpacity: 0.9
    }).addTo(this.map);

    const severityBadge = `<span class="scouting-severity ${pin.severity}">${pin.severity} Priority</span>`;
    const actionStr = pin.actionTaken ? `<div style="font-size: 0.75rem; color:#f8fafc; margin-top: 4px;"><strong>Action:</strong> ${pin.actionTaken}</div>` : '';
    
    marker.bindPopup(`
      <div style="font-family: var(--font-family); min-width: 160px;">
        <h5 style="font-weight: 700; margin-bottom: 2px;">${pin.issue}</h5>
        <div style="font-size: 0.7rem; color: #94a3b8; margin-bottom: 4px;">Category: ${pin.category} | ${pin.date}</div>
        ${severityBadge}
        <p style="font-size: 0.75rem; margin-top: 6px; color:#94a3b8; line-height: 1.3;">${pin.note}</p>
        ${actionStr}
      </div>
    `);

    this.mapMarkers.push(marker);
  }

  /**
   * Render NPK bar charts
   */
  renderNPKChart(npk) {
    document.getElementById('nVal').textContent = `${npk.N}%`;
    document.getElementById('nBar').style.height = `${npk.N}%`;

    document.getElementById('pVal').textContent = `${npk.P}%`;
    document.getElementById('pBar').style.height = `${npk.P}%`;

    document.getElementById('kVal').textContent = `${npk.K}%`;
    document.getElementById('kBar').style.height = `${npk.K}%`;
  }

  /**
   * Render Soil Moisture sparkline
   */
  renderSoilMoistureChart(moistureData) {
    const chartContainer = document.getElementById('soilMoistureChart');
    chartContainer.innerHTML = '';

    const width = 300;
    const height = 80;
    const minVal = 15;
    const maxVal = 60;
    
    const points = moistureData.map((val, index) => {
      const x = (index / (moistureData.length - 1)) * (width - 20) + 10;
      const y = height - ((val - minVal) / (maxVal - minVal)) * (height - 30) - 15;
      return { x, y, val };
    });

    const pathD = `M ${points.map(p => `${p.x} ${p.y}`).join(' L ')}`;
    const areaD = `${pathD} L ${points[points.length-1].x} ${height} L ${points[0].x} ${height} Z`;

    const svg = `
      <svg class="sparkline-svg" viewBox="0 0 ${width} ${height}">
        <path d="${areaD}" class="sparkline-area" />
        <path d="${pathD}" class="sparkline-path" />
        ${points.map((p, i) => `
          <circle cx="${p.x}" cy="${p.y}" r="3" fill="#f8fafc" stroke="#3b82f6" stroke-width="2">
            <title>Day ${i+1}: ${p.val}%</title>
          </circle>
        `).join('')}
      </svg>
      <div class="sparkline-labels" style="width: 100%;">
        <span>7 Days Ago (${moistureData[0]}%)</span>
        <span>Today (${moistureData[moistureData.length-1]}%)</span>
      </div>
    `;

    chartContainer.innerHTML = svg;
  }

  /**
   * Render NDVI trend history sparkline
   */
  renderNDVIHistoryChart(ndviData) {
    const container = document.getElementById('ndviHistoryChart');
    if (!container || !ndviData || ndviData.length === 0) return;

    const width = 300;
    const height = 60;

    const points = ndviData.map((val, index) => {
      const x = (index / (ndviData.length - 1)) * (width - 20) + 10;
      const y = height - (val * (height - 15)) - 5;
      return { x, y, val };
    });

    const pathD = `M ${points.map(p => `${p.x} ${p.y}`).join(' L ')}`;
    const areaD = `${pathD} L ${points[points.length-1].x} ${height} L ${points[0].x} ${height} Z`;

    container.innerHTML = `
      <svg class="ndvi-sparkline" viewBox="0 0 ${width} ${height}">
        <path d="${areaD}" class="ndvi-sparkline-area" />
        <path d="${pathD}" class="ndvi-sparkline-path" />
        ${points.map((p) => `
          <circle cx="${p.x}" cy="${p.y}" r="3.5" fill="#f8fafc" stroke="#10b981" stroke-width="1.5">
            <title>NDVI: ${p.val.toFixed(2)}</title>
          </circle>
        `).join('')}
      </svg>
      <div class="sparkline-labels" style="width: 100%;">
        <span>Planted (${ndviData[0].toFixed(2)})</span>
        <span>Current (${ndviData[ndviData.length-1].toFixed(2)})</span>
      </div>
    `;
  }

  /**
   * Render list of scouting observations
   */
  renderScoutingLogs(combinedObs) {
    this.scoutingLogList.innerHTML = '';
    
    if (combinedObs.length === 0) {
      this.scoutingLogList.innerHTML = '<p style="text-align: center; color: var(--text-muted); font-size: 0.75rem; padding: 1rem;">No observations logged.</p>';
      return;
    }

    combinedObs.forEach(raw => {
      const obs = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, typeof v === 'string' ? escapeHTML(v) : v]));
      const div = document.createElement('div');
      div.className = 'scouting-log-item';
      
      const actionBadge = obs.actionTaken ? `<div style="font-size:0.7rem; color:var(--text-primary); margin-top:0.25rem;">📝 Action: ${obs.actionTaken}</div>` : '';
      
      div.innerHTML = `
        <div style="flex: 1;">
          <strong style="display:block; margin-bottom: 2px;">${obs.issue}</strong>
          <span style="color: var(--text-secondary);">${obs.note}</span>
          <div style="font-size: 0.65rem; color: var(--text-muted); margin-top: 0.25rem;">
            📅 ${obs.date} | Category: ${obs.category}
          </div>
          ${actionBadge}
        </div>
        <span class="scouting-severity ${obs.severity}">${obs.severity}</span>
      `;
      this.scoutingLogList.appendChild(div);
    });
  }

  /**
   * Opens Add Scouting Observation Modal
   */
  openScoutingModal() {
    const field = this.fields.find(f => f.id === this.selectedFieldId);
    if (!field) return;

    this.scoutingForm.reset();
    this.scoutFieldInput.value = field.name;
    this.scoutingModal.classList.add('open');
    this.scoutingModal.inert = false;
    this.scoutIssue.focus();
  }

  closeScoutingModal() {
    this.scoutingModal.classList.remove('open');
    this.scoutingModal.inert = true;
  }

  /**
   * Saves a new scouting observation
   */
  async saveScoutingObservation() {
    try {
      const field = this.fields.find(f => f.id === this.selectedFieldId);
      const categoryVal = this.scoutCategory.value;
      const issueText = this.scoutIssue.value;
      const severityVal = this.scoutSeverity.value;
      const noteText = this.scoutNote.value;
      const actionText = this.scoutAction.value;

      if (!field || !categoryVal || !issueText || !severityVal || !noteText) {
        this.showToast('Please fill in required observation details', true);
        return;
      }

      // Default GPS coords to field boundary starting coordinate or active GPS walk simulation point
      let lat = field.polygon[0][0];
      let lng = field.polygon[0][1];

      if (this.gpsMarker) {
        const gpsLatLng = this.gpsMarker.getLatLng();
        lat = gpsLatLng.lat;
        lng = gpsLatLng.lng;
      }

      const observation = {
        fieldId: field.id,
        fieldName: field.name,
        category: categoryVal,
        issue: issueText,
        severity: severityVal,
        note: noteText,
        actionTaken: actionText || 'Noted',
        date: new Date().toISOString().split('T')[0],
        lat: lat,
        lng: lng
      };

      await this.db.addScoutingLog(observation);
      
      this.closeScoutingModal();
      this.showToast('Observation saved on this device · not sent', false);
      await this.drafts.render();

      // Re-load view content
      await this.loadFieldObservations(field);
    } catch (err) {
      console.error('Error saving observation:', err);
      this.showToast('Failed to save observation', true);
    }
  }

  /**
   * Update map cache card text and UI
   */
  updateMapCacheUI(field) {
    this.downloadStatusText.textContent = 'Field boundaries are local. Offline basemap downloads are not implemented.';
    this.downloadMapBtn.textContent = 'Map downloads unavailable';
    this.downloadMapBtn.disabled = true;
  }
  /**
   * Simulates map downloading for offline PWA storage
   */
  simulateMapCache() {
    this.showToast('Offline basemap downloads are not implemented.', true);
  }
  /**
   * Network Status switch toggled
   */
  updateOnlineStatus() {
    this.isOnline = navigator.onLine && !this.demoOffline;
    this.syncStatusBadge.className = this.isOnline ? 'sync-badge' : 'sync-badge offline';
    this.syncStatusText.textContent = this.isOnline ? 'Network available · device-only saves' : this.demoOffline ? 'Offline demo · device-only saves' : 'Offline · device-only saves';
    this.offlineBanner.style.display = this.isOnline ? 'none' : 'flex';
    this.offlineBanner.textContent = this.demoOffline ? 'OFFLINE DEMO · NETWORK IS NOT DISCONNECTED' : 'OFFLINE · WORK SAVES ON THIS DEVICE';
    this.manualSyncBtn.disabled = true;
    this.manualSyncBtn.textContent = 'Cloud sync not connected';
  }
  /**
   * Trigger Synchronization Queue
   */
  async triggerSync() {
    // No backend is configured. Never fabricate server acknowledgements.
    this.updateOnlineStatus();
    await this.drafts.render();
  }
  /**
   * Refresh sync queue list display
   */
  async refreshSyncQueueUI() { 
    await this.drafts.render();
  }
  /**
   * Recommendation modal triggers
   */
  openRecommendationModal() {
    return this.drafts.open();
  }
  closeRecommendationModal() {
    return this.drafts?.close();
  }
  /**
   * Populate product selection catalog
   */
  populateModalProducts(category) {
    this.recProduct.innerHTML = '';
    this.recUnit.value = '-';
    this.calculateRecommendationCost();
    
    if (!category || !this.products[category]) {
      this.recProduct.setAttribute('disabled', 'true');
      this.recProduct.innerHTML = '<option value="">-- Select Category First --</option>';
      return;
    }

    this.recProduct.removeAttribute('disabled');
    
    const items = this.products[category];
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '-- Choose Product --';
    this.recProduct.appendChild(defaultOption);

    items.forEach((item) => {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = `${item.name} ($${item.pricePerUnit}/${item.unit})`;
      this.recProduct.appendChild(option);
    });
  }

  /**
   * Cost calculation calculator updates
   */
  calculateRecommendationCost() {
    this.drafts?.updateEstimate();
  }
  /**
   * Saves Recommendation to Offline IndexedDB Sync Queue
   */
  async saveRecommendation() {
    await this.drafts.finish();
  }
  /**
   * Opens printable recommendation invoice detail overlay
   */
  openRecDetailModal(item) {
    if (!this.recDetailOverlay) return;

    item = Object.fromEntries(Object.entries(item).map(([k, v]) => [k, typeof v === 'string' ? escapeHTML(v) : v]));
    const rawGrower = this.growers.find(g => g.id === item.growerId);
    const grower = rawGrower ? Object.fromEntries(Object.entries(rawGrower).map(([k, v]) => [k, typeof v === 'string' ? escapeHTML(v) : v])) : null;
    const growerName = item.growerName || (grower ? grower.name : 'Unknown');
    const growerContact = grower ? grower.contactName : '';
    const growerPhone = grower ? grower.phone : '';
    const growerAddress = grower ? (grower.address || '') : '';
    
    const createdDate = new Date(item.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const createdTime = new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const docContent = this.recDetailOverlay.querySelector('.rec-detail-modal');
    docContent.innerHTML = `
      <div class="modal-header">
        <h3>${item.documentType === 'sales' ? 'Sales Draft' : 'Recommendation Draft'}</h3>
        <button class="modal-close" id="closeDetailOverlayBtn">&times;</button>
      </div>
      <div class="print-document" id="printableDocument">
        <div class="doc-header">
          <div>
            <div class="doc-logo">🌱 TerraSync App</div>
            <div style="font-size: 0.75rem; color: #6b7280; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">Prairie AgriServices Consultant Network</div>
          </div>
          <div class="doc-date">
            <div><strong>Date:</strong> ${createdDate}</div>
            <div><strong>Time:</strong> ${createdTime}</div>
            <div><strong>Status:</strong> Local draft · not sent or approved</div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-top: 1rem; border-top: 1.5px solid #10b981; padding-top: 1rem;">
          <div>
            <h4 style="color:#065f46; font-size:0.8rem; text-transform:uppercase; margin-bottom:0.5rem;">Grower Details</h4>
            <p style="font-size:0.9rem; font-weight:600;">${growerName}</p>
            <p style="font-size:0.8rem; color:#4b5563;">Contact: ${growerContact}</p>
            <p style="font-size:0.8rem; color:#4b5563;">Phone: ${growerPhone}</p>
            <p style="font-size:0.8rem; color:#4b5563;">${growerAddress}</p>
          </div>
          <div>
            <h4 style="color:#065f46; font-size:0.8rem; text-transform:uppercase; margin-bottom:0.5rem;">Field Specifics</h4>
            <p style="font-size:0.9rem; font-weight:600;">Field: ${item.fieldName}</p>
            <p style="font-size:0.8rem; color:#4b5563;">Crop Type: ${item.crop || '—'} (${item.variety || 'Unknown'})</p>
            <p style="font-size:0.8rem; color:#4b5563;">Acreage Size: ${item.fieldAcreage || '—'} acres</p>
          </div>
        </div>

        <p class="document-disclaimer">DRAFT — for discussion only. Sample catalog; prices and application suitability require consultant verification. Not an approved order or application instruction.</p><h2 style="margin-top: 1.5rem;">Proposed Program Estimate</h2>
        <table>
          <thead>
            <tr>
              <th>Prescription Category</th>
              <th>Product Prescribed</th>
              <th>Application Rate</th>
              <th>Unit Cost</th>
              <th>Total Quantity Required</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${item.categoryLabel || item.category}</td>
              <td><strong>${item.productName}</strong></td>
              <td>${item.rate} ${item.unit}/acre</td>
              <td>$${(item.unitPrice || 0).toFixed(2)} / ${item.unit}</td>
              <td>${(item.totalQty || item.rate * (item.fieldAcreage || 0)).toFixed(1)} ${item.unit}s</td>
            </tr>
            <tr style="background:#f0fdf4;">
              <td colspan="4" style="text-align:right; font-weight:700; color:#065f46; border-top:1.5px solid #10b981;">Estimated Program Cost:</td>
              <td style="font-weight: 700; color:#065f46; font-size: 1.1rem; border-top:1.5px solid #10b981;">$${item.cost.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
            </tr>
          </tbody>
        </table>

        ${item.notes ? `
          <h2>Application Notes / Special Instructions</h2>
          <p style="font-size: 0.85rem; line-height: 1.6; color: #374151; background: #f9fafb; padding: 0.8rem; border-radius: 6px; border-left: 4px solid #10b981; font-style: italic;">"${item.notes}"</p>
        ` : ''}

        <div class="doc-signature">
          <div>
            <div style="font-size:0.8rem; font-weight:600; margin-bottom: 2rem;">Prepared By:</div>
            <div class="sig-line">${this.consultant.name}, CCA (${this.consultant.license})</div>
          </div>
          <div>
            <div style="font-size:0.8rem; font-weight:600; margin-bottom: 2rem;">Approved By:</div>
            <div class="sig-line">Grower Signature / Date</div>
          </div>
        </div>

        <div class="doc-footer">
          <span>TerraSync Offline Agronomist Portal</span>
          <span>Doc Ref ID: TS-REC-${(item.id || '').toString().padStart(5, '0')}</span>
        </div>
      </div>
      <div class="print-doc-actions">
        <button class="btn" id="closeDetailOverlayBtn2">Close</button>
        <button class="btn btn-primary" id="printDocActionBtn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          Print / Save PDF
        </button>
      </div>
    `;

    this.recDetailOverlay.classList.add('open');
    this.recDetailOverlay.inert = false;

    // Register overlay close events dynamically
    document.getElementById('closeDetailOverlayBtn').addEventListener('click', () => this.closeRecDetailModal());
    document.getElementById('closeDetailOverlayBtn2').addEventListener('click', () => this.closeRecDetailModal());
    document.getElementById('printDocActionBtn').addEventListener('click', () => window.print());
  }

  closeRecDetailModal() {
    if (this.recDetailOverlay) {
      this.recDetailOverlay.classList.remove('open');
      this.recDetailOverlay.inert = true;
    }
  }

  /**
   * Map notification helper toast
   */
  showToast(text, isError) {
    clearTimeout(this.toastTimeout);
    
    if (this.toastText) this.toastText.textContent = text;
    if (this.toastDot) this.toastDot.className = `toast-dot ${isError ? 'error' : ''}`;
    if (this.mapToast) {
      this.mapToast.className = `map-notification-toast ${isError ? 'error' : ''}`;
      this.mapToast.style.display = 'flex';
    }

    this.toastTimeout = setTimeout(() => {
      if (this.mapToast) this.mapToast.style.display = 'none';
    }, 3000);
  }

  /**
   * GPS simulation handlers
   */
  toggleGpsSimulation() {
    if (this.gpsInterval) {
      this.stopGpsSimulation();
    } else {
      this.startGpsSimulation();
    }
  }

  startGpsSimulation() {
    if (!this.map) return;
    const field = this.fields.find(f => f.id === this.selectedFieldId);
    if (!field) return;

    this.gpsRouteCoords = this.interpolatePolygonPath(field.polygon, 20);
    this.gpsRouteIndex = 0;
    
    this.simGpsBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
      Stop Tracking
    `;
    this.simGpsBtn.style.borderColor = '#ef4444';

    const startCoord = this.gpsRouteCoords[0];
    this.gpsMarker = L.circleMarker(startCoord, {
      radius: 10,
      fillColor: '#3b82f6',
      color: '#ffffff',
      weight: 3,
      fillOpacity: 1.0
    }).addTo(this.map);

    this.gpsMarker.bindTooltip("Simulated location — not device GPS", { permanent: false });
    this.map.panTo(startCoord);

    this.gpsCoordText.textContent = `Lat: ${startCoord[0].toFixed(5)}, Lng: ${startCoord[1].toFixed(5)}`;
    this.gpsCoordText.style.color = '#3b82f6';

    this.gpsInterval = setInterval(() => {
      this.gpsRouteIndex = (this.gpsRouteIndex + 1) % this.gpsRouteCoords.length;
      const nextCoord = this.gpsRouteCoords[this.gpsRouteIndex];
      
      this.gpsMarker.setLatLng(nextCoord);
      this.gpsCoordText.textContent = `Lat: ${nextCoord[0].toFixed(5)}, Lng: ${nextCoord[1].toFixed(5)}`;

      if (!this.map.getBounds().contains(nextCoord)) {
        this.map.panTo(nextCoord);
      }
    }, 800);

    this.showToast('Demo animation — not your actual GPS location', false);
  }

  /**
   * Interpolate along polygon edges to create smooth walk path
   */
  interpolatePolygonPath(polygon, stepsPerEdge) {
    const points = [];
    for (let i = 0; i < polygon.length; i++) {
      const start = polygon[i];
      const end = polygon[(i + 1) % polygon.length];
      for (let s = 0; s < stepsPerEdge; s++) {
        const t = s / stepsPerEdge;
        points.push([
          start[0] + (end[0] - start[0]) * t,
          start[1] + (end[1] - start[1]) * t
        ]);
      }
    }
    return points;
  }

  stopGpsSimulation() {
    if (this.gpsInterval) {
      clearInterval(this.gpsInterval);
      this.gpsInterval = null;
    }

    if (this.gpsMarker) {
      this.map.removeLayer(this.gpsMarker);
      this.gpsMarker = null;
    }

    this.simGpsBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
      Demo perimeter walk
    `;
    this.simGpsBtn.style.borderColor = '';
    this.gpsCoordText.textContent = 'GPS: Idle';
    this.gpsCoordText.style.color = '';
  }
}

// Instantiate and start app on page load
window.addEventListener('DOMContentLoaded', () => {
  const app = new TerraSyncApp();
  app.init();
});
