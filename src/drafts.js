/* Device-local recommendation workspace. No server acknowledgements are fabricated. */
const escapeDraftHTML = (value) => String(value ?? '').replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
window.escapeHTML = escapeDraftHTML;

function priceDraft(draft, products) {
  const product = products[draft.category]?.find(p => p.id === draft.productId);
  const rate = Number(draft.rate);
  const acreage = Number(draft.fieldAcreage);
  if (!product || !Number.isFinite(rate) || rate <= 0 || !Number.isFinite(acreage) || acreage <= 0) return null;
  const totalQty = rate * acreage;
  const cost = totalQty * product.pricePerUnit;
  if (!Number.isFinite(cost) || !Number.isFinite(totalQty)) return null;
  return { productName: product.name, unit: product.unit, unitPrice: product.pricePerUnit,
    rate, totalQty, cost, categoryLabel: draft.category === 'fertilizers' ? 'Fertilizer estimate' :
      draft.category === 'chemicals' ? 'Crop protection estimate' : 'Seed estimate' };
}

class DraftWorkspace {
  constructor(app) {
    this.app = app;
    this.db = app.db;
    this.record = null;
    this.revision = 0;
    this.pending = 0;
    this.failed = null;
    this.chain = Promise.resolve();
    this.renderVersion = 0;
    this.status = document.getElementById('draftSaveStatus');
    this.copyBtn = document.getElementById('saveDraftCopyBtn');
    this.retryBtn = document.getElementById('retryDraftBtn');
    app.recommendationForm.addEventListener('input', () => this.autosave());
    app.recommendationForm.addEventListener('change', () => this.autosave());
    this.copyBtn.addEventListener('click', () => this.saveCopy());
    this.retryBtn.addEventListener('click', () => { this.failed = null; this.autosave(); });
    document.getElementById('exportDraftsBtn').addEventListener('click', () => this.exportBackup());
    window.addEventListener('beforeunload', e => {
      if (this.pending || this.failed) { e.preventDefault(); e.returnValue = ''; }
    });
    window.addEventListener('focus', () => this.render());
    if ('BroadcastChannel' in window) {
      this.channel = new BroadcastChannel('terrasync-drafts');
      this.channel.onmessage = () => this.render();
    }
  }

  announce(text, error = false) {
    this.status.textContent = text;
    this.status.classList.toggle('save-error', error);
    this.copyBtn.hidden = !this.failed;
    this.retryBtn.hidden = !this.failed || this.failed.name === 'DraftConflictError';
  }

  snapshot() {
    return { category: this.app.recProductType.value, productId: this.app.recProduct.value,
      rate: this.app.recRate.value, notes: this.app.recNotes.value,
      documentType: document.getElementById('draftDocumentType').value, status: 'editing' };
  }

  async open(id) {
    if (this.record && !await this.close()) return;
    const app = this.app;
    const field = app.fields.find(f => f.id === app.selectedFieldId);
    if (!id && !field) return;
    try {
      const grower = app.growers.find(g => g.id === field?.growerId);
      this.record = id ? await this.db.get('drafts', id) : {
        id: crypto.randomUUID(), revision: 0, createdAt: new Date().toISOString(),
        fieldId: field.id, fieldName: field.name, fieldAcreage: field.acreage,
        growerId: field.growerId, growerName: grower?.name || '', crop: field.crop,
        variety: field.variety || '', category: '', productId: '', rate: '', notes: '',
        documentType: 'recommendation', status: 'editing', syncStatus: 'local-only'
      };
      if (!this.record) throw new Error('Draft could not be found');
      this.revision = this.record.revision || 0;
      this.failed = null;
      const draft = this.record;
      app.recommendationForm.reset();
      app.recFieldInput.value = `${draft.growerName} / ${draft.fieldName}`;
      app.recProductType.value = draft.category || '';
      app.populateModalProducts(draft.category);
      app.recProduct.value = draft.productId || '';
      app.recRate.value = draft.rate ?? '';
      app.recNotes.value = draft.notes || '';
      document.getElementById('draftDocumentType').value = draft.documentType || 'recommendation';
      this.updateEstimate();
      this.announce(this.revision ? 'Saved on this device · continue editing below' : 'Changes save automatically on this device');
      this.returnFocus = document.activeElement;
      app.recModal.classList.add('open');
      app.recModal.inert = false;
      app.recModal.setAttribute('aria-hidden', 'false');
      document.getElementById('draftDocumentType').focus();
    } catch (error) {
      this.record = null;
      app.showToast('Could not open draft. Please try again.', true);
    }
  }

  updateEstimate() {
    if (!this.record) return;
    const app = this.app;
    const draft = { ...this.record, ...this.snapshot() };
    const price = priceDraft(draft, app.products);
    const product = app.products[draft.category]?.find(p => p.id === draft.productId);
    app.recUnit.value = product?.unit || '—';
    app.calcAcreage.textContent = `${draft.fieldAcreage} acres`;
    app.calcUnitPrice.textContent = product ? `$${product.pricePerUnit.toFixed(2)} / ${product.unit}` : '—';
    app.calcTotalQty.textContent = price ? `${price.totalQty.toFixed(2)} ${price.unit}` : '—';
    app.calcTotalCost.textContent = price ? price.cost.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : '—';
  }

  autosave() {
    if (!this.record) return;
    this.updateEstimate();
    this.enqueue(this.snapshot());
  }

  enqueue(snapshot) {
    this.pending++;
    this.announce('Saving on this device…');
    // Serialize writes. Revision checks also protect against a second editing tab.
    this.chain = this.chain.then(async () => {
      if (this.failed) return;
      try {
        const record = { ...this.record, ...snapshot };
        const priced = priceDraft(record, this.app.products);
        const saved = await this.db.saveDraft({ ...record, ...(priced || {}), rate: snapshot.rate }, this.revision);
        this.record = saved;
        this.revision = saved.revision;
        this.channel?.postMessage({ changed: saved.id });
      } catch (error) {
        this.failed = error;
      }
    }).finally(() => {
      this.pending--;
      if (!this.pending) {
        if (this.failed) {
          this.announce(this.failed.name === 'DraftConflictError' ? this.failed.message :
            'Not saved. Keep this form open. Free device storage, then retry, or export your work.', true);
        } else {
          this.announce(`Saved on this device at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · not sent`);
        }
        this.render();
      }
    });
    return this.chain;
  }

  async close() {
    if (!this.record) return true;
    do { await this.chain; } while (this.pending);
    if (this.failed) { this.status.focus(); return false; }
    this.app.recModal.classList.remove('open');
    this.app.recModal.inert = true;
    this.app.recModal.setAttribute('aria-hidden', 'true');
    this.record = null;
    this.returnFocus?.focus();
    return true;
  }

  async finish() {
    if (!this.record) return;
    const snapshot = this.snapshot();
    if (!priceDraft({ ...this.record, ...snapshot }, this.app.products)) {
      this.announce('Choose a product and enter a positive, finite rate before marking ready. Your partial draft can still be saved.', true);
      return;
    }
    const button = document.getElementById('finishDraftBtn');
    button.disabled = true;
    try {
      await this.enqueue({ ...snapshot, status: 'ready' });
      if (await this.close()) this.app.showToast('Draft ready for review · saved on this device, not sent', false);
    } finally { button.disabled = false; }
  }

  async saveCopy() {
    await this.chain;
    const snapshot = this.snapshot();
    this.record = { ...this.record, ...snapshot, id: crypto.randomUUID(), revision: 0,
      createdAt: new Date().toISOString(), legacyStatus: undefined };
    this.revision = 0;
    this.failed = null;
    await this.enqueue(snapshot);
  }

  async render() {
    const version = ++this.renderVersion;
    try {
      const [drafts, logs] = await Promise.all([this.db.getAll('drafts'), this.db.getScoutingLogs()]);
      if (version !== this.renderVersion) return;
      drafts.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
      const list = this.app.syncQueueList;
      list.replaceChildren();
      this.app.queueCount.textContent = `(${drafts.length})`;
      document.getElementById('localRecordSummary').textContent = `${drafts.length} documents · ${logs.length} observations saved on this device`;
      if (!drafts.length) {
        const empty = document.createElement('p');
        empty.className = 'draft-empty';
        empty.textContent = 'No drafts yet. Choose a field and start a recommendation. You can finish it later, even offline.';
        list.append(empty);
      }
      for (const draft of drafts) {
        const card = document.createElement('article');
        card.className = 'draft-card';
        const price = priceDraft(draft, this.app.products);
        card.innerHTML = `<div class="draft-card-top"><span class="draft-kind">${draft.documentType === 'sales' ? 'Sales draft' : 'Recommendation'}</span><span class="draft-state">${draft.status === 'ready' ? 'Ready for review' : 'In progress'}</span></div>
          <h3>${escapeDraftHTML(draft.fieldName)}</h3><p>${escapeDraftHTML(draft.growerName)}</p>
          <p class="draft-product">${escapeDraftHTML(price?.productName || 'Product not selected')}${price ? ` · ${price.cost.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}` : ''}</p>
          <p class="draft-meta">Saved ${escapeDraftHTML(new Date(draft.updatedAt).toLocaleString())} · device only</p>
          ${draft.legacyStatus ? '<p class="draft-meta">Recovered from the previous demo. No server upload was verified.</p>' : ''}
          <div class="draft-actions"><button class="btn btn-primary" data-action="edit">${draft.status === 'ready' ? 'Edit draft' : 'Resume draft'}</button><button class="btn" data-action="print" ${price ? '' : 'disabled'}>Preview / print</button></div>`;
        card.querySelector('[data-action="edit"]').addEventListener('click', () => this.open(draft.id));
        card.querySelector('[data-action="print"]').addEventListener('click', () => {
          if (price) this.app.openRecDetailModal({ ...draft, ...price });
        });
        list.append(card);
      }
    } catch (error) {
      this.app.showToast('Unable to read saved drafts. Close other TerraSync tabs and reload.', true);
    }
  }

  async exportBackup() {
    try {
      await this.chain;
      const payload = { format: 'terrasync-local-backup', version: 1, exportedAt: new Date().toISOString(),
        drafts: await this.db.getAll('drafts'), observations: await this.db.getScoutingLogs(),
        unsavedEditor: this.failed && this.record ? { ...this.record, ...this.snapshot() } : null };
      const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `terrasync-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      this.app.showToast('Backup download requested. Keep the file safe; it contains your local work.', false);
    } catch (error) { this.app.showToast('Could not export backup. Your local records were not changed.', true); }
  }
}

window.DraftWorkspace = DraftWorkspace;
window.TerraSyncDrafts = { priceDraft, escapeHTML: escapeDraftHTML };
