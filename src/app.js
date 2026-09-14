/**
 * TerraSync Application Core
 * Dedicated to Crop Consultant persona & workflow
 */

const escapeHTML = window.escapeHTML || (value => String(value ?? '').replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));

class TerraSyncApp {
  constructor() {
    this.db = window.AppDB;
    this.config = window.TERRASYNC_CONFIG || {};
    this.mapController = null;
    this.locationService = null;
    
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
    this.cloudAuthModal = document.getElementById('cloudAuthModal');
    
    // Map overlay & location elements
    this.locateMeBtn = document.getElementById('locateMeBtn');
    this.followLocationBtn = document.getElementById('followLocationBtn');
    this.locationStatusBadge = document.getElementById('locationStatusBadge');
    this.locationAccuracyText = document.getElementById('locationAccuracyText');
    this.fieldDistanceText = document.getElementById('fieldDistanceText');
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
    this.attachDeviceLocationCheckbox = document.getElementById('attachDeviceLocationCheckbox');
    this.obsLocationHelpText = document.getElementById('obsLocationHelpText');
    
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

    // Map API Key / Provider settings
    this.apiKeyModal = document.getElementById('apiKeyModal');
    this.configureMapApiKeyBtn = document.getElementById('configureMapApiKeyBtn');
    this.closeApiKeyModalBtn = document.getElementById('closeApiKeyModalBtn');
    this.apiKeyForm = document.getElementById('apiKeyForm');
    this.googleApiKeyInput = document.getElementById('googleApiKeyInput');
    this.enableOsmBasemapToggle = document.getElementById('enableOsmBasemapToggle');
    this.clearApiKeyBtn = document.getElementById('clearApiKeyBtn');
    this.mapProviderBadge = document.getElementById('mapProviderBadge');
    
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
    this.simulationCurrentPoint = null;
    this.simulationTrack = [];
    
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

      // 4. Initialize Map Controller & Location Service
      this.drafts = new DraftWorkspace(this);
      this.cloud = new TerraSyncCloud(this);
      await this.initMapControllerAndLocation();

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

      // 9. Restore authenticated cloud session and synchronize
      await this.cloud.initialize();

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
   * Initializes MapController and LocationService with error boundaries
   */
  async initMapControllerAndLocation() {
    // 1. Initialize LocationService
    if (window.LocationService) {
      this.locationService = new window.LocationService({
        options: {
          timeout: this.config.locationTimeoutMs || 15000,
          staleThresholdMs: this.config.staleLocationThresholdMs || 30000,
          lowAccuracyThresholdM: this.config.lowAccuracyThresholdM || 50
        }
      });
      this.locationService.subscribe((state) => this.handleLocationStateChange(state));
    }

    // 2. Initialize MapController
    if (window.MapController) {
      try {
        this.mapController = new window.MapController(this.config);
        const mountedType = await this.mapController.init('map');
        
        this.mapController.onFieldSelected((fieldId) => this.selectField(fieldId));
        this.mapController.onMapPanned(() => {
          if (this.locationService) this.locationService.suspendFollow();
        });
        this.mapController.onAdapterChanged((type) => {
          this.updateMapProviderBadge(type);
          const isGoogle = type === 'google';
          this.showToast(isGoogle ? 'Google Maps Online active' : (this.isOnline ? 'OpenStreetMap Online active' : 'Offline Field View active (boundaries only)'), false);
        });

        this.updateMapProviderBadge(mountedType);
        console.log(`Map mounted with adapter: ${mountedType}`);
      } catch (err) {
        console.warn('MapController failed to initialize:', err);
        const mapEl = document.getElementById('map');
        if (mapEl) {
          mapEl.textContent = 'Map view could not load. Field records and recommendations remain available.';
        }
      }
    }
  }

  async handleLocateMe() {
    if (!this.locationService) {
      this.showToast('Location service unavailable in this browser.', true);
      return;
    }
    try {
      this.showToast('Requesting device GPS position...', false);
      const loc = await this.locationService.getCurrentPosition();
      this.showToast(`Location acquired (±${loc.accuracyM || 0}m)`, false);

      if (this.mapController) {
        this.mapController.setLocation(loc);
        this.mapController.panTo(loc.latitude, loc.longitude);
      }

      if (this.selectedFieldId) {
        const field = this.fields.find(f => f.id === this.selectedFieldId);
        if (field) this.updateFieldProximity(field);
      }
    } catch (err) {
      this.showToast(err.message || 'Unable to obtain GPS location.', true);
    }
  }

  handleToggleFollow() {
    if (!this.locationService) return;
    const state = this.locationService.getState();
    if (state.isFollowing) {
      this.locationService.stopWatch();
      this.showToast('Stopped following device location.', false);
    } else {
      this.locationService.startWatch();
      this.showToast('Following device location.', false);
    }
  }

  handleLocationStateChange(state) {
    if (!this.locationStatusBadge) return;

    this.locationStatusBadge.className = `location-badge ${state.status}`;
    
    let statusLabel = 'Location: Idle';
    let detailLabel = 'Click "Locate Me" for real GPS fix';

    if (state.status === 'locating') {
      statusLabel = 'Locating...';
      detailLabel = 'Acquiring satellite / browser fix...';
    } else if (state.status === 'current') {
      statusLabel = state.isLowAccuracy ? 'GPS: Low Accuracy' : 'GPS: Active';
      const timeStr = state.lastFixTime ? new Date(state.lastFixTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
      detailLabel = `Fix at ${timeStr} · ±${state.accuracyM || '?'}m`;
    } else if (state.status === 'stale') {
      statusLabel = 'GPS: Stale Fix';
      detailLabel = `Last fix > 30s ago (±${state.accuracyM || '?'}m)`;
    } else if (state.status === 'permission-denied') {
      statusLabel = 'GPS: Denied';
      detailLabel = 'Permission denied. You can still enter observations.';
    } else if (state.status === 'timeout') {
      statusLabel = 'GPS: Timeout';
      detailLabel = 'Location request timed out. Retrying...';
    } else if (state.status === 'unavailable') {
      statusLabel = 'GPS: Unavailable';
      detailLabel = state.errorMessage || 'Position unavailable.';
    }

    this.locationStatusBadge.textContent = statusLabel;
    if (this.locationAccuracyText) {
      this.locationAccuracyText.textContent = detailLabel;
    }

    if (this.followLocationBtn) {
      this.followLocationBtn.classList.toggle('btn-primary', state.isFollowing);
      this.followLocationBtn.textContent = state.isFollowing ? 'Following' : 'Follow';
    }

    // Forward location to map
    if (this.mapController) {
      this.mapController.setLocation(state.location);
      this.mapController.setFollowLocation(state.isFollowing);
    }

    // Update field proximity if field selected
    if (this.selectedFieldId) {
      const field = this.fields.find(f => f.id === this.selectedFieldId);
      if (field) this.updateFieldProximity(field);
    }

    // Update observation modal location helper
    this.updateObservationLocationHelper(state);
  }

  updateFieldProximity(field) {
    if (!this.fieldDistanceText || !field || !window.TerraSyncGeo) return;
    const loc = this.locationService?.getState()?.location;
    if (!loc || typeof loc.latitude !== 'number' || !Array.isArray(field.polygon)) {
      this.fieldDistanceText.style.display = 'none';
      return;
    }

    try {
      const centroid = window.TerraSyncGeo.calculateCentroid(field.polygon);
      const distM = window.TerraSyncGeo.haversineDistance(loc.latitude, loc.longitude, centroid[0], centroid[1]);
      const inside = window.TerraSyncGeo.isPointInPolygon([loc.latitude, loc.longitude], field.polygon);
      const formattedDist = window.TerraSyncGeo.formatStraightLineDistance(distM);

      this.fieldDistanceText.style.display = 'block';
      this.fieldDistanceText.innerHTML = inside
        ? `📍 <span style="color:var(--primary); font-weight:600;">Inside field boundary</span> (${formattedDist} to center)`
        : `📍 ${formattedDist} to field center`;
    } catch {
      this.fieldDistanceText.style.display = 'none';
    }
  }

  updateObservationLocationHelper(state) {
    if (!this.obsLocationHelpText) return;
    if (state && state.location && state.status !== 'permission-denied') {
      const lat = state.location.latitude.toFixed(5);
      const lng = state.location.longitude.toFixed(5);
      const acc = state.location.accuracyM ? ` (±${state.location.accuracyM}m)` : '';
      this.obsLocationHelpText.textContent = `Fix: ${lat}, ${lng}${acc} [source: device GPS]`;
    } else if (this.simulationCurrentPoint) {
      const lat = this.simulationCurrentPoint.latitude.toFixed(5);
      const lng = this.simulationCurrentPoint.longitude.toFixed(5);
      this.obsLocationHelpText.textContent = `Simulation: ${lat}, ${lng} [source: sample demo]`;
    } else if (state && state.status === 'permission-denied') {
      this.obsLocationHelpText.textContent = 'Location permission denied. Observation will be saved unlocated.';
    } else {
      this.obsLocationHelpText.textContent = 'No device GPS fix yet. Observation will be saved unlocated.';
    }
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
    this.networkToggle.addEventListener('change', async (e) => {
      this.demoOffline = !e.target.checked;
      this.updateOnlineStatus();
      if (this.mapController) {
        await this.mapController.setConnectivityState(this.isOnline);
      }
    });

    window.addEventListener('online', () => {
      this.updateOnlineStatus();
      this.cloud?.sync();
    });
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

    const cloudAuthBtn = document.getElementById('cloudAuthBtn');
    const closeCloudAuthBtn = document.getElementById('closeCloudAuthBtn');
    const cloudStatus = document.getElementById('cloudAuthStatus');
    const openCloudDialog = () => {
      this.cloudAuthModal.classList.add('open');
      this.cloudAuthModal.inert = false;
      this.cloudAuthModal.setAttribute('aria-hidden', 'false');
      document.getElementById(this.cloud?.signedIn ? 'cloudSignOutBtn' : 'cloudGoogleSignInBtn').focus();
    };
    const closeCloudDialog = () => {
      this.cloudAuthModal.classList.remove('open');
      this.cloudAuthModal.inert = true;
      this.cloudAuthModal.setAttribute('aria-hidden', 'true');
      cloudAuthBtn.focus();
    };
    cloudAuthBtn.addEventListener('click', openCloudDialog);
    closeCloudAuthBtn.addEventListener('click', closeCloudDialog);
    this.cloudAuthModal.addEventListener('click', event => {
      if (event.target === this.cloudAuthModal) closeCloudDialog();
    });
    document.getElementById('cloudGoogleSignInBtn').addEventListener('click', async () => {
      cloudStatus.textContent = 'Opening Google sign-in…';
      try {
        await this.cloud.signInWithGoogle();
      } catch (error) { cloudStatus.textContent = `Google sign-in failed: ${error.message}`; }
    });
    document.getElementById('cloudSignOutBtn').addEventListener('click', async () => {
      try {
        await this.cloud.signOut();
        cloudStatus.textContent = 'Signed out. Local records remain on this browser.';
      } catch (error) { cloudStatus.textContent = `Sign-out failed: ${error.message}`; }
    });

    // Cache Map tiles
    // Device Location controls
    if (this.locateMeBtn) {
      this.locateMeBtn.addEventListener('click', () => this.handleLocateMe());
    }
    if (this.followLocationBtn) {
      this.followLocationBtn.addEventListener('click', () => this.handleToggleFollow());
    }

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

    // Map API Key / Provider modal listeners
    if (this.configureMapApiKeyBtn) {
      this.configureMapApiKeyBtn.addEventListener('click', () => {
        this.openApiKeyModal();
      });
    }
    if (this.closeApiKeyModalBtn) {
      this.closeApiKeyModalBtn.addEventListener('click', () => {
        this.closeApiKeyModal();
      });
    }
    if (this.clearApiKeyBtn) {
      this.clearApiKeyBtn.addEventListener('click', async () => {
        if (this.googleApiKeyInput) this.googleApiKeyInput.value = '';
        if (this.mapController) {
          await this.mapController.setGoogleMapsApiKey('');
        }
        this.showToast('Google Maps API key cleared.', false);
        this.closeApiKeyModal();
      });
    }
    if (this.apiKeyForm) {
      this.apiKeyForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const key = this.googleApiKeyInput?.value.trim() || '';
        if (this.mapController) {
          await this.mapController.setGoogleMapsApiKey(key);
        }
        if (key) {
          this.showToast('Google Maps key applied.', false);
        } else {
          this.showToast('Using standard offline/OpenStreetMap adapter.', false);
        }
        this.closeApiKeyModal();
      });
    }
    if (this.enableOsmBasemapToggle) {
      this.enableOsmBasemapToggle.addEventListener('change', (e) => {
        if (this.mapController?.activeAdapter?.setBasemapEnabled) {
          this.mapController.activeAdapter.setBasemapEnabled(e.target.checked);
        }
      });
    }

    // ESC key closes modals
    document.addEventListener('keydown', (e) => {
      const dialog = [this.recDetailOverlay, this.recModal, this.scoutingModal, this.apiKeyModal].find(el => el?.classList.contains('open') || el?.style.display === 'flex');
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
        this.closeApiKeyModal();
      }
    });
  }

  openApiKeyModal() {
    if (!this.apiKeyModal) return;
    const currentKey = this.config.googleMapsApiKey || (typeof localStorage !== 'undefined' && localStorage.getItem('terrasync_google_maps_api_key')) || '';
    if (this.googleApiKeyInput) {
      this.googleApiKeyInput.value = currentKey;
    }
    this.apiKeyModal.style.display = 'flex';
  }

  closeApiKeyModal() {
    if (!this.apiKeyModal) return;
    this.apiKeyModal.style.display = 'none';
  }

  updateMapProviderBadge(type) {
    if (!this.mapProviderBadge) return;
    const isGoogle = type === 'google';
    if (isGoogle) {
      this.mapProviderBadge.textContent = 'Google Maps Online';
      this.mapProviderBadge.style.color = '#10b981';
      this.mapProviderBadge.style.background = 'rgba(16, 185, 129, 0.15)';
      this.mapProviderBadge.style.borderColor = 'rgba(16, 185, 129, 0.3)';
    } else if (this.isOnline && !this.demoOffline) {
      this.mapProviderBadge.textContent = 'OpenStreetMap Online';
      this.mapProviderBadge.style.color = '#3b82f6';
      this.mapProviderBadge.style.background = 'rgba(59, 130, 246, 0.15)';
      this.mapProviderBadge.style.borderColor = 'rgba(59, 130, 246, 0.3)';
    } else {
      this.mapProviderBadge.textContent = 'Offline Field View';
      this.mapProviderBadge.style.color = '#f59e0b';
      this.mapProviderBadge.style.background = 'rgba(245, 158, 11, 0.15)';
      this.mapProviderBadge.style.borderColor = 'rgba(245, 158, 11, 0.3)';
    }
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

    // Zoom and highlight polygon via MapController
    if (this.mapController) {
      this.mapController.setSelectedField(field.id);
      this.mapController.fitToField(field.id);
    }
    this.updateFieldProximity(field);

    this.stopGpsSimulation();
    this.showToast(`Active Field: ${field.name}`, false);
  }

  /**
   * Load local scouting logs and combine with initial data
   */
  async loadFieldObservations(field) {
    const localObs = await this.db.getScoutingLogs(this.cloud?.user?.id || null);
    const fieldLocalObs = localObs.filter(o => o.fieldId === field.id);
    
    // Merge seeded scoutingHistory with newly logged local observations
    const combinedObs = [...(field.scoutingHistory || []), ...fieldLocalObs];
    
    // Sort descending by date
    combinedObs.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    this.renderScoutingLogs(combinedObs);
    if (this.mapController) {
      this.mapController.setObservations(combinedObs);
    }
  }

  /**
   * Renders growers fields boundaries as polygons via MapController
   */
  renderFieldsOnMap(growerFields) {
    if (this.mapController) {
      this.mapController.setFields(growerFields);
    }
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
      this.mapController?.setVisualizationLayer(null);
      return;
    }

    this.activeMapLayer = layerType;
    this.layerNdviBtn.classList.remove('btn-primary');
    this.layerNdviBtn.classList.add('btn-secondary');
    this.layerSoilBtn.classList.remove('btn-primary');
    this.layerSoilBtn.classList.add('btn-secondary');
    
    const field = this.fields.find(f => f.id === this.selectedFieldId);
    if (layerType === 'ndvi') {
      this.layerNdviBtn.classList.remove('btn-secondary');
      this.layerNdviBtn.classList.add('btn-primary');
      this.showToast(`NDVI Layer Active (Score: ${field ? field.ndvi : '0.0'})`, false);
    } else {
      this.layerSoilBtn.classList.remove('btn-secondary');
      this.layerSoilBtn.classList.add('btn-primary');
      this.showToast(`Soil Layer Active: ${field ? field.soilType : 'Unknown'}`, false);
    }
    this.mapController?.setVisualizationLayer(layerType);
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
      
      let locBadge = '';
      if (raw.location && raw.location.source) {
        locBadge = ` · <span style="color:var(--primary); font-weight:500;">📍 ${escapeHTML(raw.location.source)}</span>`;
      } else if (raw.lat && raw.lng) {
        locBadge = ` · <span style="color:var(--text-muted);">📍 located</span>`;
      } else {
        locBadge = ` · <span style="color:var(--text-muted); font-style:italic;">unlocated</span>`;
      }

      div.innerHTML = `
        <div style="flex: 1;">
          <strong style="display:block; margin-bottom: 2px;">${obs.issue}</strong>
          <span style="color: var(--text-secondary);">${obs.note}</span>
          <div style="font-size: 0.65rem; color: var(--text-muted); margin-top: 0.25rem;">
            📅 ${obs.date} | Category: ${obs.category}${locBadge}
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

    const locState = this.locationService ? this.locationService.getState() : { location: null, status: 'idle' };
    if (this.attachDeviceLocationCheckbox) {
      if (locState.location && locState.status !== 'permission-denied') {
        this.attachDeviceLocationCheckbox.checked = true;
      } else if (this.simulationCurrentPoint) {
        this.attachDeviceLocationCheckbox.checked = true;
      } else {
        this.attachDeviceLocationCheckbox.checked = false;
      }
    }
    this.updateObservationLocationHelper(locState);

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

      // Explicit location provenance: device, sample, or null
      // Never fall back to field polygon vertices as coordinates
      let location = null;
      let lat = null;
      let lng = null;

      const attachLocation = this.attachDeviceLocationCheckbox ? this.attachDeviceLocationCheckbox.checked : false;

      if (attachLocation) {
        const locState = this.locationService ? this.locationService.getState() : null;
        if (locState && locState.location && locState.status !== 'permission-denied') {
          location = {
            latitude: locState.location.latitude,
            longitude: locState.location.longitude,
            accuracyM: locState.location.accuracyM || null,
            capturedAt: locState.location.capturedAt || new Date().toISOString(),
            source: 'device'
          };
          lat = location.latitude;
          lng = location.longitude;
        } else if (this.simulationCurrentPoint) {
          location = {
            latitude: this.simulationCurrentPoint.latitude,
            longitude: this.simulationCurrentPoint.longitude,
            accuracyM: 5,
            capturedAt: new Date().toISOString(),
            source: 'sample'
          };
          lat = location.latitude;
          lng = location.longitude;
        }
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
        lng: lng,
        location: location,
        cloudOwnerId: this.cloud?.user?.id || null
      };

      await this.db.addScoutingLog(observation);
      window.dispatchEvent(new CustomEvent('terrasync-local-change', {
        detail: { entityType: 'observation' }
      }));
      
      this.closeScoutingModal();
      this.showToast(`Observation saved on this device · ${this.cloud?.signedIn ? 'waiting for cloud' : 'sign in to sync'}`, false);
      await this.drafts.render();

      // Re-load view content
      await this.loadFieldObservations(field);
    } catch (err) {
      console.error('Error saving observation:', err);
      this.showToast('Failed to save observation', true);
    }
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
    if (this.cloud) this.cloud.updateUI();
    else {
      this.manualSyncBtn.disabled = true;
      this.manualSyncBtn.textContent = 'Cloud setup';
    }
    if (this.mapController) {
      this.mapController.setConnectivityState(this.isOnline);
    }
    this.updateMapProviderBadge(this.mapController?.getActiveAdapterType());
  }
  /**
   * Trigger Synchronization Queue
   */
  async triggerSync() {
    this.updateOnlineStatus();
    await this.cloud?.sync();
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
    if (!this.mapController) return;
    const field = this.fields.find(f => f.id === this.selectedFieldId);
    if (!field || !Array.isArray(field.polygon) || field.polygon.length < 3) {
      this.showToast('Select a field to run demo walk simulation', true);
      return;
    }

    this.gpsRouteCoords = this.interpolatePolygonPath(field.polygon, 20);
    this.gpsRouteIndex = 0;
    
    this.simGpsBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
      Stop Simulation
    `;
    this.simGpsBtn.style.borderColor = '#ef4444';

    const startCoord = this.gpsRouteCoords[0];
    this.simulationCurrentPoint = {
      latitude: startCoord[0],
      longitude: startCoord[1],
      accuracyM: 5,
      capturedAt: new Date().toISOString(),
      source: 'sample'
    };
    this.simulationTrack = [startCoord];

    this.mapController.setLocation(this.simulationCurrentPoint);
    this.mapController.setTrack(this.simulationTrack);
    this.mapController.panTo(startCoord[0], startCoord[1]);

    this.gpsCoordText.textContent = `Simulation: Lat ${startCoord[0].toFixed(5)}, Lng ${startCoord[1].toFixed(5)}`;
    this.gpsCoordText.style.color = '#3b82f6';

    this.gpsInterval = setInterval(() => {
      this.gpsRouteIndex = (this.gpsRouteIndex + 1) % this.gpsRouteCoords.length;
      const nextCoord = this.gpsRouteCoords[this.gpsRouteIndex];
      
      this.simulationCurrentPoint = {
        latitude: nextCoord[0],
        longitude: nextCoord[1],
        accuracyM: 5,
        capturedAt: new Date().toISOString(),
        source: 'sample'
      };
      this.simulationTrack.push(nextCoord);
      if (this.simulationTrack.length > 50) {
        this.simulationTrack.shift();
      }

      this.mapController.setLocation(this.simulationCurrentPoint);
      this.mapController.setTrack(this.simulationTrack);
      this.gpsCoordText.textContent = `Simulation: Lat ${nextCoord[0].toFixed(5)}, Lng ${nextCoord[1].toFixed(5)}`;
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

    this.simulationCurrentPoint = null;
    this.simulationTrack = [];

    if (this.mapController) {
      const realLoc = this.locationService?.getState()?.location;
      if (realLoc) {
        this.mapController.setLocation(realLoc);
      } else {
        this.mapController.setLocation(null);
      }
      this.mapController.setTrack([]);
    }

    if (this.simGpsBtn) {
      this.simGpsBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
        Demo walk (Simulated)
      `;
      this.simGpsBtn.style.borderColor = '';
    }

    if (this.gpsCoordText) {
      this.gpsCoordText.textContent = 'Simulation: Idle';
      this.gpsCoordText.style.color = '';
    }
  }
}

// Instantiate and start app on page load
window.addEventListener('DOMContentLoaded', () => {
  const app = new TerraSyncApp();
  app.init();
});
