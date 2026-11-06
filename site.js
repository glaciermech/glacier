/* Notes from NTU — lightweight blog renderer and browser-only editor. No dependencies. */
(() => {
  'use strict';
  const SEMESTERS = [
    ['y1s1', 'Year 1, Semester 1'], ['y1s2', 'Year 1, Semester 2'],
    ['y2s1', 'Year 2, Semester 1'], ['y2s2', 'Year 2, Semester 2'],
    ['y3s1', 'Year 3, Semester 1'], ['y3s2', 'Year 3, Semester 2'],
    ['y4s1', 'Year 4, Semester 1'], ['y4s2', 'Year 4, Semester 2']
  ];
  const SEM_LABEL = Object.fromEntries(SEMESTERS);
  const PUBLISHED = structuredClone(window.SITE_DATA);
  const DB_NAME = 'ntu-personal-blog-v1';
  const DB_STORE = 'drafts';
  const DB_KEY = 'site';
  let site = structuredClone(PUBLISHED);
  let selectedSemester = 'y1s1';
  let editingResource = null;
  let statusTimer = null;
  let semesterDirty = false;

  function escapeHTML(input) {
    return String(input ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[ch]);
  }
  function escapeAttr(input) { return escapeHTML(input); }
  function cleanText(input) { return String(input ?? '').trim(); }
  function validHttpUrl(raw) {
    try {
      const url = new URL(raw);
      return url.protocol === 'https:' || url.protocol === 'http:';
    } catch (_) { return false; }
  }
  function safeLink(url) { return validHttpUrl(url) ? url : '#'; }
  function renderInline(raw) {
    const value = String(raw ?? '');
    const regex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
    let out = '', pos = 0, match;
    while ((match = regex.exec(value)) !== null) {
      out += escapeHTML(value.slice(pos, match.index));
      out += `<a href="${escapeAttr(match[2])}" target="_blank" rel="noopener noreferrer">${escapeHTML(match[1])}</a>`;
      pos = regex.lastIndex;
    }
    return out + escapeHTML(value.slice(pos));
  }
  function renderProse(raw) {
    const lines = String(raw ?? '').replace(/\r\n/g, '\n').split('\n');
    let html = '', paragraph = [], bullet = [];
    const flushP = () => {
      if (paragraph.length) { html += `<p>${paragraph.map(renderInline).join('<br>')}</p>`; paragraph = []; }
    };
    const flushList = () => {
      if (bullet.length) { html += '<ul>' + bullet.map(s => `<li>${renderInline(s)}</li>`).join('') + '</ul>'; bullet = []; }
    };
    lines.forEach(line => {
      const heading = line.match(/^(#{2,3})\s+(.+)/);
      const item = line.match(/^[-*]\s+(.+)/);
      if (!cleanText(line)) { flushP(); flushList(); }
      else if (heading) {
        flushP(); flushList();
        const level = heading[1].length;
        html += `<h${level}>${renderInline(heading[2])}</h${level}>`;
      } else if (item) { flushP(); bullet.push(item[1]); }
      else { flushList(); paragraph.push(line); }
    });
    flushP(); flushList();
    return html;
  }
  function dateLabel(iso) {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
    const [y,m,d] = iso.split('-').map(Number);
    const t = new Date(y,m-1,d);
    if (t.getFullYear()!==y || t.getMonth()!==m-1 || t.getDate()!==d) return '';
    return t.toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' });
  }
  function hasEntry(entry) {
    return Boolean(entry && ['courses','au','gpa','cgpa','reflection','screenshot','moduleNotes'].some(k => cleanText(entry[k])));
  }
  function defaultEntry() {
    return { date:'', courses:'', au:'', gpa:'', cgpa:'', reflection:'', screenshot:'', caption:'', moduleNotes:'' };
  }
  function ensureShape(value) {
    if (!value || typeof value !== 'object' || !value.entries || typeof value.entries !== 'object' || !Array.isArray(value.resources)) throw new Error('Not a valid site-data file.');
    if (typeof value.siteName !== 'string') throw new Error('Missing site title.');
    for (const [key] of SEMESTERS) {
      if (!value.entries[key] || typeof value.entries[key] !== 'object') value.entries[key] = defaultEntry();
    }
    return value;
  }
  function openDB() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) return reject(new Error('Browser storage is unavailable.'));
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function readDraft() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readonly');
      const req = tx.objectStore(DB_STORE).get(DB_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  }
  async function writeDraft(data) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).put(data, DB_KEY);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  }
  async function clearDraft() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).delete(DB_KEY);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  }
  async function saveDraft() {
    site.updatedAt = new Date().toISOString();
    await writeDraft(site);
  }
  function setTitleAndNav() {
    document.querySelectorAll('[data-site-title]').forEach(el => el.textContent = site.siteName || 'Notes from NTU');
    const page = document.body.dataset.page;
    const title = page === 'home' ? 'Semester reviews' : page === 'semester' ? SEM_LABEL[document.body.dataset.semester] : page === 'materials' ? 'Materials' : 'Edit site';
    document.title = title + ' — ' + (site.siteName || 'Notes from NTU');
    const navItem = document.querySelector(`[data-nav="${page === 'semester' ? 'none' : page}"]`);
    if (navItem) { navItem.classList.add('is-current'); navItem.setAttribute('aria-current', 'page'); }
    const key = document.body.dataset.semester;
    if (key) document.querySelectorAll(`a[href="${key}.html"]`).forEach(el => {
      el.classList.add('is-current'); el.setAttribute('aria-current','page');
    });
  }
  function renderHome() {
    const el = document.getElementById('main');
    let out = `<header class="entry-header"><h1>Semester reviews</h1></header>`;
    if (cleanText(site.siteIntro)) out += `<div class="home-intro">${renderProse(site.siteIntro)}</div>`;
    for (let y = 1; y <= 4; y++) {
      out += `<h2 class="archive-heading">Year ${y}</h2><ul class="post-list">`;
      for (let s = 1; s <= 2; s++) {
        const key = `y${y}s${s}`;
        const post = site.entries[key] || defaultEntry();
        const d = dateLabel(post.date);
        const snippet = cleanText(post.reflection).split('\n').find(x => cleanText(x)) || '';
        const detail = !hasEntry(post) ? 'Not written yet' : (d || (snippet ? snippet.slice(0, 65) + (snippet.length > 65 ? '…' : '') : 'Semester review'));
        out += `<li><a href="${key}.html">Semester ${s}</a><span class="list-detail">${escapeHTML(detail)}</span></li>`;
      }
      out += '</ul>';
    }
    el.innerHTML = out;
  }
  function renderSemester() {
    const key = document.body.dataset.semester;
    const entry = site.entries[key] || defaultEntry();
    const i = SEMESTERS.findIndex(([k]) => k === key);
    const publishedDate = dateLabel(entry.date);
    let out = `<article class="entry"><header class="entry-header"><h1>${SEM_LABEL[key]}</h1>${publishedDate ? `<div class="entry-meta">${escapeHTML(publishedDate)}</div>` : ''}</header><div class="entry-content">`;
    if (!hasEntry(entry)) out += '<p class="empty-post">No entry for this semester yet.</p>';
    else {
      const courses = String(entry.courses || '').split(/\r?\n/).filter(l => cleanText(l));
      if (courses.length) {
        out += '<p class="course-label"><strong>Courses taken:</strong></p><ol class="course-list">';
        out += courses.map(c => `<li>${renderInline(c)}</li>`).join('') + '</ol>';
      }
      const lines = [];
      if (cleanText(entry.au)) lines.push('Total AUs: ' + escapeHTML(entry.au));
      if (cleanText(entry.gpa)) lines.push('Semester GPA: ' + escapeHTML(entry.gpa));
      if (cleanText(entry.cgpa)) lines.push('CGPA: ' + escapeHTML(entry.cgpa));
      if (lines.length) out += `<p class="grade-summary">${lines.join('<br>')}</p>`;
      if (cleanText(entry.reflection)) out += `<div class="essay">${renderProse(entry.reflection)}</div>`;
      if (cleanText(entry.screenshot) && /^data:image\/(png|jpeg|webp);base64,/i.test(entry.screenshot)) {
        out += `<figure><img src="${escapeAttr(entry.screenshot)}" alt="Academic results screenshot for ${SEM_LABEL[key]}" loading="lazy">`;
        if (cleanText(entry.caption)) out += `<figcaption>${escapeHTML(entry.caption)}</figcaption>`;
        out += '</figure>';
      }
      if (cleanText(entry.moduleNotes)) out += `<div class="essay">${renderProse(entry.moduleNotes)}</div>`;
    }
    out += '</div></article><nav class="post-pager" aria-label="Between semester posts">';
    if (i > 0) out += `<a href="${SEMESTERS[i-1][0]}.html">← ${SEMESTERS[i-1][1]}</a>`;
    if (i < 7) out += `<a href="${SEMESTERS[i+1][0]}.html">${SEMESTERS[i+1][1]} →</a>`;
    out += '</nav>';
    document.getElementById('main').innerHTML = out;
  }
  function materialHref(item) {
    if (item.fileData && /^data:(?:[a-z0-9.+\-/]+)?;base64,/i.test(item.fileData)) return item.fileData;
    if (validHttpUrl(item.url)) return item.url;
    return '';
  }
  function renderMaterials() {
    let out = `<header class="entry-header"><h1>Materials</h1></header><p class="materials-intro">Notes, links and other study materials, arranged by year.</p>`;
    if (!site.resources.length) out += '<p class="empty-post">Nothing here yet.</p>';
    for (const [group, label] of [['general','General'],['y1','Year 1'],['y2','Year 2'],['y3','Year 3'],['y4','Year 4']]) {
      const matched = site.resources.filter(item => group === 'general' ? item.semester === 'general' || !item.semester : String(item.semester || '').startsWith(group));
      if (!matched.length) continue;
      out += `<section class="resource-section"><h2>${label}</h2><ul class="resource-list">`;
      for (const item of matched) {
        const url = materialHref(item);
        const title = escapeHTML(item.title || 'Untitled resource');
        const fileAttrs = item.fileData ? ` download="${escapeAttr(item.fileName || 'attachment')}"` : ' target="_blank" rel="noopener noreferrer"';
        const a = url ? `<a class="resource-title" href="${escapeAttr(url)}"${fileAttrs}>${title}</a>` : `<span>${title}</span>`;
        const detail = [item.module, SEM_LABEL[item.semester]].filter(Boolean).map(escapeHTML).join(' · ');
        out += `<li>${a}${detail ? `<div class="resource-details">${detail}</div>` : ''}${cleanText(item.note) ? `<p class="resource-note">${escapeHTML(item.note)}</p>` : ''}</li>`;
      }
      out += '</ul></section>';
    }
    document.getElementById('main').innerHTML = out;
  }
  function formValue(id) { return document.getElementById(id).value.trim(); }
  function fileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error('Could not read file.'));
      r.readAsDataURL(file);
    });
  }
  function editorMessage(message, isError = false) {
    const el = document.getElementById('editor-status');
    if (!el) return;
    if (statusTimer) clearTimeout(statusTimer);
    el.hidden = false;
    el.textContent = message;
    el.classList.toggle('is-error', isError);
    statusTimer = setTimeout(() => { el.hidden = true; }, 9000);
  }
  function setTab(which) {
    document.querySelectorAll('[data-tab]').forEach(b => {
      const active = b.dataset.tab === which;
      b.classList.toggle('is-current', active);
      b.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('[data-panel]').forEach(s => { s.hidden = s.dataset.panel !== which; });
  }
  function loadSemester(key) {
    selectedSemester = key;
    const entry = site.entries[key] || defaultEntry();
    document.getElementById('edit-semester').value = key;
    for (const [id,k] of [['edit-date','date'],['edit-courses','courses'],['edit-au','au'],['edit-gpa','gpa'],['edit-cgpa','cgpa'],['edit-reflection','reflection'],['edit-caption','caption'],['edit-module-notes','moduleNotes']]) {
      document.getElementById(id).value = entry[k] || '';
    }
    const input = document.getElementById('edit-screenshot');
    input.value = '';
    document.getElementById('remove-screenshot').checked = false;
    const current = document.getElementById('current-screenshot');
    if (entry.screenshot && /^data:image\/(png|jpeg|webp);base64,/i.test(entry.screenshot)) {
      current.hidden = false;
      current.innerHTML = `<img src="${escapeAttr(entry.screenshot)}" alt="Current screenshot"><small>Current screenshot (choose a file above to replace it).</small>`;
    } else { current.hidden = true; current.innerHTML = ''; }
    document.getElementById('view-entry').href = `${key}.html`;
    semesterDirty = false;
  }
  async function saveSemester(ev) {
    ev.preventDefault();
    try {
      const entry = site.entries[selectedSemester] || defaultEntry();
      for (const [id,k] of [['edit-date','date'],['edit-courses','courses'],['edit-au','au'],['edit-gpa','gpa'],['edit-cgpa','cgpa'],['edit-reflection','reflection'],['edit-caption','caption'],['edit-module-notes','moduleNotes']]) {
        entry[k] = formValue(id);
      }
      const newFile = document.getElementById('edit-screenshot').files[0];
      if (document.getElementById('remove-screenshot').checked) { entry.screenshot = ''; }
      else if (newFile) {
        if (!['image/png','image/jpeg','image/webp'].includes(newFile.type)) throw new Error('Please choose a PNG, JPEG or WebP image.');
        if (newFile.size > 6 * 1024 * 1024) throw new Error('Screenshot is over 6 MB. Please crop or compress it first.');
        entry.screenshot = await fileAsDataUrl(newFile);
      }
      site.entries[selectedSemester] = entry;
      await saveDraft();
      loadSemester(selectedSemester);
      editorMessage(`${SEM_LABEL[selectedSemester]} saved in this browser. Use Publish / backup to put it online.`);
    } catch(err) { editorMessage('Not saved: ' + err.message, true); }
  }
  function resetMaterialForm() {
    editingResource = null;
    document.getElementById('material-form').reset();
    document.getElementById('material-form-title').textContent = 'Add a resource';
    document.getElementById('mat-existing-file').hidden = true;
  }
  function showMaterialsAdmin() {
    const list = document.getElementById('materials-admin-list');
    if (!site.resources.length) { list.innerHTML = '<p>No materials added yet.</p>'; return; }
    list.innerHTML = '<ul>' + site.resources.map(item =>
      `<li><span class="admin-item-name">${escapeHTML(item.title)}${item.module ? ' — ' + escapeHTML(item.module) : ''}</span><div class="admin-actions"><button type="button" data-edit-resource="${escapeAttr(item.id)}">Edit</button><button type="button" class="delete" data-remove-resource="${escapeAttr(item.id)}">Delete</button></div></li>`
    ).join('') + '</ul>';
    list.querySelectorAll('[data-edit-resource]').forEach(btn => btn.addEventListener('click', () => {
      const item = site.resources.find(v => v.id === btn.dataset.editResource);
      if (!item) return;
      editingResource = item.id;
      document.getElementById('mat-title').value = item.title || '';
      document.getElementById('mat-module').value = item.module || '';
      document.getElementById('mat-semester').value = item.semester || 'general';
      document.getElementById('mat-url').value = item.url || '';
      document.getElementById('mat-note').value = item.note || '';
      document.getElementById('mat-file').value = '';
      document.getElementById('material-form-title').textContent = 'Edit resource';
      const oldFile = document.getElementById('mat-existing-file');
      oldFile.hidden = !item.fileName;
      oldFile.textContent = item.fileName ? `Existing attachment: ${item.fileName}. Select a new file or enter a link to replace it.` : '';
      document.getElementById('mat-title').focus();
    }));
    list.querySelectorAll('[data-remove-resource]').forEach(btn => btn.addEventListener('click', async () => {
      const item = site.resources.find(v => v.id === btn.dataset.removeResource);
      if (!item || !confirm(`Delete "${item.title}"?`)) return;
      site.resources = site.resources.filter(v => v.id !== item.id);
      try { await saveDraft(); showMaterialsAdmin(); resetMaterialForm(); editorMessage('Resource removed.'); }
      catch(err) { editorMessage('Could not save: ' + err.message, true); }
    }));
  }
  async function saveMaterial(ev) {
    ev.preventDefault();
    try {
      const title = formValue('mat-title'), link = formValue('mat-url');
      if (!title) throw new Error('Enter a title.');
      if (link && !validHttpUrl(link)) throw new Error('Links must start with https:// or http://.');
      const old = site.resources.find(v => v.id === editingResource);
      const file = document.getElementById('mat-file').files[0];
      let fileData = old?.fileData || '', fileName = old?.fileName || '';
      if (file) {
        if (file.size > 8 * 1024 * 1024) throw new Error('File is over 8 MB. Use an external link for large files.');
        fileData = await fileAsDataUrl(file);
        fileName = file.name;
      } else if (link) { fileData = ''; fileName = ''; }
      if (!link && !fileData) throw new Error('Provide a link or attach a file.');
      const item = {
        id: old?.id || `r${Date.now()}${Math.random().toString(36).slice(2,7)}`,
        title,
        module: formValue('mat-module'), semester: formValue('mat-semester'),
        url: fileData ? '' : link, fileData, fileName, note: formValue('mat-note')
      };
      if (old) site.resources[site.resources.indexOf(old)] = item;
      else site.resources.push(item);
      await saveDraft();
      resetMaterialForm(); showMaterialsAdmin(); editorMessage('Resource saved in this browser.');
    } catch(err) { editorMessage('Not saved: ' + err.message, true); }
  }
  async function saveSettings(ev) {
    ev.preventDefault();
    try {
      site.siteName = formValue('site-name') || 'Notes from NTU';
      site.siteIntro = formValue('site-intro');
      await saveDraft(); setTitleAndNav();
      editorMessage('Site details saved.');
    } catch(err) { editorMessage('Not saved: ' + err.message, true); }
  }
  function downloadSiteData() {
    const text = '/* Published content for Notes from NTU. */\nwindow.SITE_DATA = ' + JSON.stringify(site, null, 2) + ';\n';
    const blob = new Blob([text], {type:'text/javascript;charset=utf-8'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'site-data.js';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1200);
    editorMessage('Downloaded site-data.js. Replace that file in your website repository to publish your changes.');
  }
  async function importSiteData(file) {
    if (!file) return;
    try {
      const content = await file.text();
      const start = content.indexOf('window.SITE_DATA');
      if (start === -1) throw new Error('This is not a site-data.js file.');
      const json = content.slice(start).replace(/^window\.SITE_DATA\s*=\s*/, '').replace(/;\s*$/, '').trim();
      const next = ensureShape(JSON.parse(json));
      if (!confirm('Import this file and replace the drafts saved in this browser?')) return;
      site = next;
      await saveDraft();
      initializeEditorValues(); setTitleAndNav();
      editorMessage('Backup imported successfully.');
    } catch(err) { editorMessage('Could not import: ' + err.message, true); }
    document.getElementById('import-data').value = '';
  }
  function initializeEditorValues() {
    loadSemester(selectedSemester);
    showMaterialsAdmin();
    document.getElementById('site-name').value = site.siteName || 'Notes from NTU';
    document.getElementById('site-intro').value = site.siteIntro || '';
  }
  function startEditor() {
    const semSelect = document.getElementById('edit-semester');
    const resSelect = document.getElementById('mat-semester');
    for (const [key,title] of SEMESTERS) {
      const a = new Option(title, key), b = new Option(title, key);
      semSelect.add(a); resSelect.add(b);
    }
    const query = new URLSearchParams(window.location.search).get('semester');
    selectedSemester = SEM_LABEL[query] ? query : 'y1s1';
    initializeEditorValues();
    document.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
    const semesterForm = document.getElementById('semester-form');
    semesterForm.addEventListener('input', e => { if (e.target.id !== 'edit-semester') semesterDirty = true; });
    semesterForm.addEventListener('change', e => { if (e.target.id !== 'edit-semester') semesterDirty = true; });
    document.getElementById('edit-semester').addEventListener('change', e => {
      if (semesterDirty && !confirm('Switch semesters without saving your changes?')) {
        e.target.value = selectedSemester;
        return;
      }
      loadSemester(e.target.value);
    });
    window.addEventListener('beforeunload', e => {
      if (semesterDirty) { e.preventDefault(); e.returnValue = ''; }
    });
    document.getElementById('semester-form').addEventListener('submit', saveSemester);
    document.getElementById('material-form').addEventListener('submit', saveMaterial);
    document.getElementById('mat-cancel').addEventListener('click', resetMaterialForm);
    document.getElementById('settings-form').addEventListener('submit', saveSettings);
    document.getElementById('export-data').addEventListener('click', downloadSiteData);
    document.getElementById('import-data').addEventListener('change', e => importSiteData(e.target.files[0]));
    document.getElementById('reset-data').addEventListener('click', async () => {
      if (!confirm('Discard all local drafts and restore the published version?')) return;
      try { await clearDraft(); site = structuredClone(PUBLISHED); initializeEditorValues(); setTitleAndNav(); editorMessage('Local drafts discarded.'); }
      catch(err) { editorMessage('Could not reset: ' + err.message, true); }
    });
    if (window.location.hash === '#materials') setTab('materials');
    else if (window.location.hash === '#publish') setTab('publish');
    else setTab('semester');
  }
  function setupMenu() {
    const button = document.getElementById('semester-menu-button');
    const wrap = button.closest('.nav-dropdown');
    button.addEventListener('click', () => {
      const isOpen = wrap.classList.toggle('open');
      button.setAttribute('aria-expanded', String(isOpen));
    });
    document.addEventListener('click', e => {
      if (!wrap.contains(e.target)) { wrap.classList.remove('open'); button.setAttribute('aria-expanded','false'); }
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { wrap.classList.remove('open'); button.setAttribute('aria-expanded','false'); }
    });
  }
  async function init() {
    try {
      const draft = await readDraft();
      if (draft && String(draft.updatedAt || '') >= String(PUBLISHED.updatedAt || '')) site = ensureShape(draft);
    } catch (err) {
      // Reader pages still work if browser storage is blocked.
      console.warn('Local drafts unavailable:', err);
    }
    setTitleAndNav(); setupMenu();
    const page = document.body.dataset.page;
    if (page === 'home') renderHome();
    else if (page === 'semester') renderSemester();
    else if (page === 'materials') renderMaterials();
    else if (page === 'edit') startEditor();
  }
  init();
})();
