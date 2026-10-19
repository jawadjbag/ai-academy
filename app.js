/* JBI Hub — application collaborative, stockage local ou Supabase avec RLS. */
(function () {
  'use strict';
  const DATA_KEY = 'jbi-hub-items-v1';
  const CFG_KEY = 'jbi-hub-backend-v1';
  const ACTIVE_KEY = 'jbi-hub-active-project';
  const COLORS = ['#6559db', '#e9876d', '#25a48e', '#e0a64d', '#4379d7', '#a65eb7'];
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const uid = () => crypto.randomUUID();
  const iso = () => new Date().toISOString();
  const initialNames = ['Better Days', 'Ludikoo', 'MASSEO', 'Supernova'];
  function seeds() {
    return initialNames.map((name, i) => ({
      id: '00000000-0000-4000-8000-' + String(i + 1).padStart(12, '0'),
      kind: 'project', project_id: null,
      data: { name, description: '', color: COLORS[i] },
      created_at: iso(), updated_at: iso()
    }));
  }
  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (_) { return fallback; }
  }
  let items = readJson(DATA_KEY, null);
  if (!Array.isArray(items)) { items = seeds(); localStorage.setItem(DATA_KEY, JSON.stringify(items)); }
  let active = localStorage.getItem(ACTIVE_KEY) || initialProjectId();
  let filter = 'all';
  let vaultPhrase = '';
  let sb = null;
  let session = null;
  let mode = 'local';
  let cloudError = '';
  let realtimeChannel = null;
  let toastTimer = null;
  const backend = Object.assign({}, window.JBI_CONFIG || {}, readJson(CFG_KEY, {}));

  function initialProjectId() {
    const p = items.find(x => x.kind === 'project');
    return p ? p.id : 'overview';
  }
  function projects() { return items.filter(x => x.kind === 'project').sort((a,b) => a.created_at.localeCompare(b.created_at)); }
  function project() { return projects().find(x => x.id === active); }
  function entries(kind, projectId) {
    return items.filter(x => x.kind === kind && x.project_id === projectId).sort((a,b) => b.created_at.localeCompare(a.created_at));
  }
  function notify(message) {
    const t = $('#toast');
    t.textContent = message; t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
  }
  function persistLocal() { if (mode === 'local') localStorage.setItem(DATA_KEY, JSON.stringify(items)); }
  function stamp(kind, project_id, data, id) {
    const previous = items.find(x => x.id === id);
    return { id: id || uid(), kind, project_id: project_id || null, data,
      created_at: previous ? previous.created_at : iso(), updated_at: iso() };
  }
  async function saveRow(row) {
    if (mode === 'cloud') {
      const {error} = await sb.from('workspace_items').upsert(row);
      if (error) { notify('Non enregistré : ' + error.message); return false; }
    }
    const idx = items.findIndex(x => x.id === row.id);
    if (idx < 0) items.push(row); else items[idx] = row;
    persistLocal();
    render();
    return true;
  }
  async function deleteRows(ids) {
    if (mode === 'cloud') {
      const {error} = await sb.from('workspace_items').delete().in('id', ids);
      if (error) { notify('Suppression impossible : ' + error.message); return false; }
    }
    items = items.filter(x => !ids.includes(x.id));
    persistLocal(); render(); return true;
  }
  function smallEmpty(icon, heading, detail) {
    return '<div class="empty"><span class="empty-icon">' + icon + '</span><strong>' + heading + '</strong><p>' + detail + '</p></div>';
  }
  function setActive(id) {
    active = id;
    filter = 'all';
    localStorage.setItem(ACTIVE_KEY, id);
    render();
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function panel(title, subtitle, button, content, extraClass) {
    return '<section class="panel ' + (extraClass || '') + '"><div class="panel-head"><div><h2 class="panel-title">' + title +
      '</h2><p class="panel-subtitle">' + subtitle + '</p></div>' + button + '</div><div class="panel-body">' + content + '</div></section>';
  }
  function stat(label, number, glyph) {
    return '<div class="stat-card"><div><small>' + esc(label) + '</small><strong>' + number + '</strong></div><div class="stat-icon">' + glyph + '</div></div>';
  }
  function safeUrl(url) {
    try {
      const parsed = new URL(url);
      return ['https:','http:'].includes(parsed.protocol) ? parsed.href : '';
    } catch (_) { return ''; }
  }
  function renderNav() {
    const curr = project();
    $('#breadcrumbTitle').textContent = curr ? curr.data.name : 'Vue d’ensemble';
    $('#allProjectsBtn').classList.toggle('selected', active === 'overview');
    let nav = '<button class="project-link ' + (active === 'overview' ? 'active' : '') + '" data-action="overview" type="button" id="mobileOverview">◫ <span class="project-label">Tous</span></button>';
    nav += projects().map(p => '<button class="project-link ' + (p.id === active ? 'active' : '') +
      '" type="button" data-action="select-project" data-id="' + esc(p.id) + '">' +
      '<span class="mini-dot" style="background:' + esc(p.data.color || COLORS[0]) + '"></span><span class="project-label">' + esc(p.data.name) + '</span></button>').join('');
    $('#projectNav').innerHTML = nav;
    const label = mode === 'cloud' ? 'Équipe synchronisée' : mode === 'auth' ? 'Connexion requise' : 'Mode local';
    $('#modeStatus').classList.toggle('cloud', mode === 'cloud');
    $('#modeStatus').innerHTML = '<span class="status-dot"></span><span>' + label + '</span>';
    $('#topStatus').className = 'top-status' + (mode === 'cloud' ? ' cloud' : '');
    $('#topStatus').textContent = mode === 'cloud' ? '● Synchronisé' : mode === 'auth' ? '● Privé' : '● Données locales';
  }
  function renderOverview() {
    const pp = projects(), totalTasks = items.filter(x => x.kind === 'task');
    const done = totalTasks.filter(x => x.data.done).length;
    const tiles = pp.map(p => {
      const t = entries('task', p.id), closed = t.filter(x => x.data.done).length;
      const copy = entries('copy', p.id).length;
      const desc = t.length + ' tâche' + (t.length > 1 ? 's' : '') + ' · ' + copy + ' texte' + (copy > 1 ? 's' : '');
      return '<button class="project-tile" type="button" data-action="select-project" data-id="' + esc(p.id) + '">' +
        '<div class="tile-top"><span class="tile-dot" style="background:' + esc(p.data.color) + '">' + esc(p.data.name.slice(0,1)) + '</span><span class="tile-arrow">↗</span></div>' +
        '<div><strong>' + esc(p.data.name) + '</strong><p>' + esc(desc) + '</p><div class="inline-progress"><span style="width:' + (t.length ? Math.round(closed / t.length * 100) : 0) + '%"></span></div></div></button>';
    }).join('');
    return '<div class="page-head"><div><p class="page-eyebrow">TON ESPACE DE TRAVAIL</p><h1 class="page-title">Tout au même endroit.</h1><p class="page-desc">Les accès, les textes et les priorités de chaque business.</p></div>' +
      '<button class="btn primary" data-action="new-project" type="button">＋ Nouveau projet</button></div>' +
      (mode === 'local' ? '<div class="info-banner"><span>ⓘ</span><div><strong>Mode local :</strong> les changements restent sur cet appareil. Pour travailler à plusieurs, connecte Supabase dans les paramètres. Ne partage pas d’identifiants sensibles avant cette configuration.</div></div>' : '') +
      '<div class="stat-grid">' + stat('Projets actifs', pp.length, '◫') + stat('Tâches à faire', totalTasks.length - done, '✓') + stat('Textes enregistrés', items.filter(x => x.kind === 'copy').length, '✎') + '</div>' +
      '<div class="section-heading"><div><p class="page-eyebrow">MES BUSINESS</p><h2 style="font-size:19px;letter-spacing:-.5px;margin:0">Tous les projets</h2></div></div>' +
      '<div class="project-tiles">' + tiles + '<button class="project-tile" style="border-style:dashed;align-items:center;justify-content:center;min-height:166px;background:transparent;color:#7a73d9" type="button" data-action="new-project"><span style="font-size:28px">＋</span><strong>Ajouter un projet</strong></button></div>';
  }
  function renderVault() {
    const list = entries('vault', active);
    let content = list.map(row => {
      const d = row.data, site = safeUrl(d.url);
      return '<div class="item"><div class="stat-icon" style="width:31px;height:31px;flex-shrink:0;border-radius:9px;font-size:14px">⌘</div><div class="item-main"><div class="item-name">' +
        esc(d.title) + '</div><div class="item-meta">' + esc(d.username || 'Identifiant masqué') +
        (site ? ' · <a href="' + esc(site) + '" target="_blank" rel="noopener noreferrer" style="color:#635ce2">Ouvrir ↗</a>' : '') +
        '</div></div><div class="item-actions"><button class="action-icon" data-action="reveal-vault" data-id="' + esc(row.id) +
        '" title="Voir le mot de passe">◉</button><button class="action-icon" data-action="edit-vault" data-id="' + esc(row.id) +
        '" title="Modifier">✎</button><button class="action-icon" data-action="delete-row" data-id="' + esc(row.id) +
        '" title="Supprimer">×</button></div></div>';
    }).join('');
    if (!list.length) content = smallEmpty('♙', 'Aucun accès enregistré', 'Centralise ici les connexions de ce projet.');
    const vaultInfo = '<div class="helper" style="margin-top:13px">🔒 Mots de passe chiffrés dans le navigateur. Une phrase secrète commune est nécessaire pour les ouvrir.</div>';
    return panel('<span class="title-icon">♙</span> Accès & identifiants', list.length + ' accès · mot de passe chiffré',
      '<div class="btn-row"><button class="btn small" type="button" data-action="unlock-vault">' +
      (vaultPhrase ? '🔓 Coffre ouvert' : '🔐 Déverrouiller') +
      '</button><button class="btn small primary" data-action="new-vault" type="button">＋ Ajouter</button></div>', content + vaultInfo);
  }
  function renderTasks() {
    const all = entries('task', active), done = all.filter(r => r.data.done).length;
    const visible = all.filter(r => filter === 'all' || (filter === 'open' ? !r.data.done : r.data.done));
    const controls = '<div class="filters">' +
      [['all','Toutes'],['open','À faire'],['done','Terminées']].map(pair => '<button type="button" class="filter ' +
      (filter === pair[0] ? 'active' : '') + '" data-action="filter-task" data-value="' + pair[0] + '">' + pair[1] + '</button>').join('') + '</div>';
    let content = visible.map(row => {
      const d = row.data;
      const meta = '<span class="priority ' + esc(d.priority || '') + '"></span>' + esc(d.owner || 'Non attribuée') +
        (d.due ? ' · ' + esc(new Date(d.due + 'T12:00:00').toLocaleDateString('fr-BE',{day:'2-digit',month:'short'})) : '');
      return '<div class="item ' + (d.done ? 'done' : '') + '"><input class="task-check" type="checkbox" data-task-check="' + esc(row.id) +
        '" aria-label="Terminer ' + esc(d.title) + '" ' + (d.done ? 'checked' : '') + '/><div class="item-main"><div class="item-name">' + esc(d.title) +
        '</div><div class="item-meta">' + meta + '</div></div><div class="item-actions"><button class="action-icon" title="Modifier" data-action="edit-task" data-id="' +
        esc(row.id) + '">✎</button><button class="action-icon" data-action="delete-row" data-id="' + esc(row.id) + '" title="Supprimer">×</button></div></div>';
    }).join('');
    if (!visible.length) content = smallEmpty('✓', filter === 'all' ? 'Aucune tâche' : 'Aucune tâche ici', 'Créez des actions claires avec un responsable.');
    if (all.length) content += '<div class="inline-progress"><span style="width:' + Math.round(done / all.length * 100) + '%"></span></div>' +
      '<p class="helper">' + done + ' sur ' + all.length + ' tâches terminées</p>';
    return panel('<span class="title-icon">☑</span> To-do list', all.length - done + ' tâche(s) en attente',
      '<button class="btn small primary" data-action="new-task" type="button">＋ Tâche</button>', controls + content);
  }
  function renderCopies() {
    const list = entries('copy', active);
    let content = list.map(row => {
      const d = row.data;
      return '<div class="item"><div class="copy-preview"><div class="copy-topline"><span class="pill">' + esc(d.category || 'Texte') +
        '</span><span class="item-name">' + esc(d.title) + '</span></div><div class="copy-text">' + esc(d.body || '') +
        '</div></div><div class="item-actions"><button class="action-icon" data-action="copy-text" data-id="' + esc(row.id) +
        '" title="Copier le texte">▣</button><button class="action-icon" data-action="edit-copy" data-id="' + esc(row.id) +
        '" title="Modifier">✎</button><button class="action-icon" data-action="delete-row" data-id="' + esc(row.id) +
        '" title="Supprimer">×</button></div></div>';
    }).join('');
    if (!list.length) content = smallEmpty('✎', 'Aucun texte enregistré', 'Conservez vos hooks, scripts, publicités et pages de vente.');
    return panel('<span class="title-icon">✎</span> Copywriting', list.length + ' texte(s) · facilement copiables',
      '<button class="btn small primary" type="button" data-action="new-copy">＋ Ajouter un texte</button>', content, 'wide');
  }
  function renderProject() {
    const p = project();
    if (!p) { active = 'overview'; return renderOverview(); }
    const ts = entries('task', p.id), todo = ts.filter(x => !x.data.done).length;
    const credits = entries('vault', p.id).length, texts = entries('copy', p.id).length;
    return '<div class="page-head"><div><p class="page-eyebrow">PROJET · ' + esc(p.data.name).toUpperCase() + '</p>' +
      '<h1 class="page-title">' + esc(p.data.name) + '</h1><p class="page-desc">' +
      esc(p.data.description || 'Gérez ce projet avec vos associés, sans dispersion.') +
      '</p></div><button class="btn" type="button" data-action="edit-project" data-id="' + esc(p.id) +
      '">⚙ Modifier</button></div><div class="stat-grid">' +
      stat('Accès enregistrés', credits, '♙') + stat('Textes disponibles', texts, '✎') + stat('Tâches en cours', todo, '✓') +
      '</div><div class="panel-grid">' + renderVault() + renderTasks() + renderCopies() + '</div>';
  }
  function renderAuth() {
    return '<div class="auth-card"><div class="brand-mark">J<span>.</span></div><h2>Connexion à JBI Hub</h2>' +
      '<p>Un espace privé pour les associés autorisés. Entre ton adresse e-mail pour recevoir un lien de connexion.</p>' +
      (cloudError ? '<div class="info-banner">' + esc(cloudError) + '</div>' : '') +
      '<form data-form="login"><div class="field"><label for="signin-email">Adresse e-mail professionnelle</label><input id="signin-email" name="email" type="email" placeholder="toi@entreprise.com" autocomplete="email" required/></div>' +
      '<div class="modal-actions"><button class="btn primary" type="submit">Recevoir le lien de connexion →</button></div></form>' +
      '<p class="helper">Accès réservé aux adresses invitées dans Supabase.</p>' +
      '<button class="btn small" style="margin-top:15px" data-action="settings" type="button">⚙ Configuration</button></div>';
  }
  function render() {
    renderNav();
    $('#main').innerHTML = mode === 'auth' ? renderAuth() : active === 'overview' ? renderOverview() : renderProject();
  }

  const modal = $('#modal');
  function showModal(title, body) {
    $('#modalBody').innerHTML = '<div class="modal-head"><h2>' + title +
      '</h2><button type="button" class="modal-close" aria-label="Fermer" data-action="close-modal">×</button></div>' +
      '<div class="modal-content">' + body + '</div>';
    if (!modal.open) modal.showModal();
  }
  function actions(saveLabel) {
    return '<div class="modal-actions"><button type="button" class="btn" data-action="close-modal">Annuler</button><button type="submit" class="btn primary">' +
      (saveLabel || 'Enregistrer') + '</button></div>';
  }
  function field(label, name, value, type, required, placeholder) {
    return '<div class="field"><label>' + label + '</label><input name="' + name + '" type="' + (type || 'text') +
      '" value="' + esc(value || '') + '" placeholder="' + esc(placeholder || '') + '" ' +
      (required ? 'required' : '') + ' autocomplete="off"/></div>';
  }
  function openProjectForm(id) {
    const item = items.find(x => x.id === id), d = item ? item.data : {};
    showModal(item ? 'Modifier le projet' : 'Nouveau projet',
      '<form data-form="project" data-id="' + esc(id || '') + '">' +
      field('Nom du projet', 'name', d.name, 'text', true, 'Ex. : Better Days') +
      field('Description (facultatif)', 'description', d.description, 'text', false, 'Objectif principal') +
      '<div class="field"><label>Couleur du projet</label><select name="color">' +
      COLORS.map((c,i) => '<option value="' + c + '" ' + ((d.color || COLORS[0]) === c ? 'selected' : '') + '>Couleur ' + (i + 1) + '</option>').join('') +
      '</select></div>' + actions() + '</form>' +
      (item ? '<button type="button" class="btn small danger" style="margin-top:12px" data-action="delete-project" data-id="' + esc(id) + '">Supprimer définitivement ce projet</button>' : ''));
  }
  function openCopyForm(id) {
    const item = items.find(x => x.id === id), d = item ? item.data : {};
    showModal(item ? 'Modifier le texte' : 'Ajouter un copywriting',
      '<form data-form="copy" data-id="' + esc(id || '') + '">' +
      field('Titre', 'title', d.title, 'text', true, 'Ex. : Hook Meta Ads — Angle douleur') +
      '<div class="field"><label>Type de contenu</label><select name="category">' +
      ['Publicité Meta', 'Hook', 'Script vidéo', 'Landing page', 'E-mail', 'Réseaux sociaux', 'Autre'].map(c =>
        '<option value="' + esc(c) + '" ' + ((d.category || 'Publicité Meta') === c ? 'selected' : '') + '>' + esc(c) + '</option>').join('') +
      '</select></div><div class="field"><label>Texte</label><textarea name="body" required placeholder="Colle ton texte ici…">' +
      esc(d.body || '') + '</textarea></div>' + actions() + '</form>');
  }
  function openTaskForm(id) {
    const item = items.find(x => x.id === id), d = item ? item.data : {};
    showModal(item ? 'Modifier la tâche' : 'Nouvelle tâche',
      '<form data-form="task" data-id="' + esc(id || '') + '">' +
      field('Tâche', 'title', d.title, 'text', true, 'Ex. : Valider les 3 créas Meta') +
      field('Responsable', 'owner', d.owner, 'text', false, 'Ex. : Jawad') +
      field('Échéance', 'due', d.due, 'date', false, '') +
      '<div class="field"><label>Priorité</label><select name="priority">' +
      [['low','Basse'],['medium','Normale'],['high','Haute']].map(([v,label]) =>
        '<option value="' + v + '" ' + ((d.priority || 'medium') === v ? 'selected' : '') + '>' + label + '</option>').join('') +
      '</select></div>' + actions() + '</form>');
  }
  function openVaultForm(id) {
    if (!vaultPhrase) { openUnlock(); return; }
    const item = items.find(x => x.id === id), d = item ? item.data : {};
    showModal(item ? 'Modifier un accès' : 'Ajouter un accès',
      '<form data-form="vault" data-id="' + esc(id || '') + '">' +
      field('Service / plateforme', 'title', d.title, 'text', true, 'Ex. : Shopify') +
      field('Identifiant ou e-mail', 'username', d.username, 'text', false, 'Ex. : team@business.com') +
      field('Lien de connexion', 'url', d.url, 'url', false, 'https://…') +
      field(item ? 'Nouveau mot de passe (laisser vide pour conserver)' : 'Mot de passe', 'password', '', 'password', !item, '') +
      '<div class="hint-box">🔒 Le mot de passe est chiffré avant sauvegarde. La phrase secrète ne quitte pas le navigateur.</div>' +
      actions() + '</form>');
  }
  function openUnlock() {
    showModal('Déverrouiller le coffre',
      '<p class="helper">Saisis la phrase secrète commune à ton équipe. Elle n’est pas enregistrée sur le serveur, ni sur cet appareil.</p>' +
      '<form data-form="unlock">' + field('Phrase secrète', 'phrase', '', 'password', true, 'Une phrase longue et unique') +
      '<div class="hint-box">Attention : si la phrase secrète est perdue, les mots de passe chiffrés ne pourront plus être récupérés. Privilégiez les invitations d’équipe plutôt que le partage d’un compte.</div>' +
      actions(vaultPhrase ? 'Changer de phrase' : 'Déverrouiller') + '</form>');
  }
  function openSettings() {
    const cloudMode = mode === 'cloud';
    let content = '<div class="hint-box"><strong>' +
      (cloudMode ? '✓ Synchronisation active' : mode === 'auth' ? 'Connexion à l’équipe' : 'Mode local uniquement') +
      '</strong><div style="margin-top:5px">' +
      (cloudMode ? 'Vos modifications sont partagées entre les membres autorisés.' :
        'Pour partager les données entre associés, configurez Supabase. Les données locales ne se synchronisent pas automatiquement.') +
      '</div></div>';
    if (cloudMode) {
      content += '<p class="helper" style="margin:16px 0">Connecté : ' + esc(session && session.user && session.user.email) + '</p>' +
        '<button class="btn danger" data-action="sign-out" type="button">Déconnecter mon compte</button>';
    } else {
      content += '<form data-form="settings">' +
        field('URL Supabase', 'url', backend.url, 'url', false, 'https://xxx.supabase.co') +
        field('Clé publique / anon (jamais service_role)', 'anonKey', backend.anonKey, 'text', false, 'eyJ… ou sb_publishable_…') +
        '<p class="helper">Ces paramètres sont publics côté navigateur : seule une base avec RLS et utilisateurs autorisés protège vos données. Un guide SQL est fourni dans le dépôt.</p>' +
        actions('Enregistrer la connexion') + '</form>';
    }
    content += '<div style="border-top:1px solid #eee;padding-top:16px;margin-top:20px"><strong style="font-size:13px">Sauvegarde des données</strong>' +
      '<p class="helper">Exporter les projets et textes, sans jamais déchiffrer les mots de passe.</p>' +
      '<button class="btn small" type="button" data-action="export">↓ Exporter JSON</button> ' +
      (mode === 'local' ? '<button class="btn small" type="button" data-action="import">↑ Importer JSON</button><input hidden id="importFile" type="file" accept=".json,application/json"/>' : '') +
      '</div>';
    showModal('Paramètres du workspace', content);
  }

  function bytesTo64(bytes) {
    let out = '';
    bytes.forEach(v => { out += String.fromCharCode(v); });
    return btoa(out);
  }
  function b64ToBytes(v) { return Uint8Array.from(atob(v), x => x.charCodeAt(0)); }
  async function derive(pass, salt) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name:'PBKDF2', salt, iterations:240000, hash:'SHA-256' },
      base, { name:'AES-GCM', length:256 }, false, ['encrypt','decrypt']);
  }
  async function encryptSecret(value) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await derive(vaultPhrase, salt);
    const encrypted = await crypto.subtle.encrypt({name:'AES-GCM',iv}, key, new TextEncoder().encode(value));
    return {salt:bytesTo64(salt),iv:bytesTo64(iv),cipher:bytesTo64(new Uint8Array(encrypted))};
  }
  async function decryptSecret(secret) {
    if (!vaultPhrase) throw Error('Coffre verrouillé');
    const salt = b64ToBytes(secret.salt), iv = b64ToBytes(secret.iv);
    const key = await derive(vaultPhrase, salt);
    const result = await crypto.subtle.decrypt({name:'AES-GCM',iv}, key, b64ToBytes(secret.cipher));
    return new TextDecoder().decode(result);
  }
  async function copyToClipboard(value) {
    try { await navigator.clipboard.writeText(String(value)); notify('Copié dans le presse-papiers'); }
    catch (_) { notify('Copie impossible : vérifie les permissions'); }
  }
  async function revealVault(id) {
    const row = items.find(x => x.id === id);
    if (!row) return;
    if (!vaultPhrase) { openUnlock(); return; }
    try {
      const secret = await decryptSecret(row.data.password);
      showModal('Mot de passe · ' + esc(row.data.title),
        '<p class="helper">Visible uniquement sur cet appareil pendant cette consultation.</p>' +
        '<div class="field"><label>Mot de passe</label><input id="secretValue" type="password" readonly/></div>' +
        '<div class="modal-actions"><button class="btn" type="button" data-action="toggle-secret">Afficher / masquer</button>' +
        '<button class="btn primary" type="button" data-action="copy-secret">▣ Copier</button></div>');
      $('#secretValue').value = secret;
    } catch (_) { notify('Phrase secrète incorrecte ou donnée illisible'); }
  }
  function exportData() {
    const file = new Blob([JSON.stringify({version:1,exported_at:iso(),items},null,2)],{type:'application/json'});
    const url = URL.createObjectURL(file);
    const a = document.createElement('a'); a.href=url; a.download='jbi-hub-sauvegarde.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); notify('Sauvegarde exportée');
  }
  async function importData(file) {
    if (mode !== 'local') return;
    try {
      const imported = JSON.parse(await file.text());
      if (!imported || !Array.isArray(imported.items) || imported.items.length > 10000) throw Error('Fichier invalide');
      const kinds = ['project','task','copy','vault'];
      const checked = imported.items.filter(r => r && typeof r.id === 'string' && kinds.includes(r.kind) && r.data && typeof r.data === 'object' && r.id.length < 100);
      if (!checked.length) throw Error('Aucune donnée reconnue');
      if (!confirm('Remplacer les données locales actuelles par cette sauvegarde ?')) return;
      items = checked; active = 'overview'; persistLocal(); render(); notify('Sauvegarde importée');
      modal.close();
    } catch (e) { notify('Import impossible : ' + e.message); }
  }
  async function loadCloud() {
    if (mode !== 'cloud' || !sb) return;
    const {data,error} = await sb.from('workspace_items').select('*').order('created_at',{ascending:true});
    if (error) { cloudError = error.message; notify('Accès refusé : ' + error.message); return; }
    if (!data.length) {
      const {error:seedError} = await sb.from('workspace_items').insert(seeds());
      if (seedError) { notify('Compte non autorisé : contactez l’administrateur'); return; }
      items = seeds();
    } else { items = data; }
    if (!project()) active = 'overview';
    render();
  }
  async function startCloud() {
    if (!backend.url || !backend.anonKey) { mode = 'local'; render(); return; }
    mode = 'auth'; render();
    if (!window.supabase || !window.supabase.createClient) {
      cloudError = 'Bibliothèque Supabase indisponible. Vérifiez votre connexion réseau.';
      render(); return;
    }
    try {
      sb = window.supabase.createClient(backend.url.trim(),backend.anonKey.trim(),{
        auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true}
      });
      const {data,error} = await sb.auth.getSession();
      if (error) throw error;
      session = data.session;
      if (session) {
        mode='cloud'; await loadCloud();
        realtimeChannel = sb.channel('jbi-hub-shared-items').on('postgres_changes',
          {event:'*',schema:'public',table:'workspace_items'}, () => loadCloud()).subscribe();
      } else { mode='auth'; }
      sb.auth.onAuthStateChange((event,newSession) => {
        // Éviter des appels auth/REST asynchrones directement dans ce callback Supabase.
        if (event === 'SIGNED_IN' && newSession && mode !== 'cloud') {
          session = newSession; mode='cloud'; render();
          setTimeout(async () => {
            await loadCloud();
            if (!realtimeChannel) realtimeChannel = sb.channel('jbi-hub-shared-items')
              .on('postgres_changes',{event:'*',schema:'public',table:'workspace_items'},() => loadCloud()).subscribe();
          }, 0);
        }
        if (event === 'SIGNED_OUT') { session=null; mode='auth'; items=[]; vaultPhrase=''; render(); }
      });
    } catch(e) { cloudError = e.message; mode = 'auth'; render(); }
  }

  document.addEventListener('click', async e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const act = btn.dataset.action, id = btn.dataset.id;
    if (act === 'overview') setActive('overview');
    if (act === 'select-project') setActive(id);
    if (act === 'new-project') openProjectForm();
    if (act === 'edit-project') openProjectForm(id);
    if (act === 'new-copy') openCopyForm();
    if (act === 'edit-copy') openCopyForm(id);
    if (act === 'new-task') openTaskForm();
    if (act === 'edit-task') openTaskForm(id);
    if (act === 'new-vault') openVaultForm();
    if (act === 'edit-vault') openVaultForm(id);
    if (act === 'unlock-vault') openUnlock();
    if (act === 'reveal-vault') await revealVault(id);
    if (act === 'settings') openSettings();
    if (act === 'close-modal') modal.close();
    if (act === 'filter-task') { filter = btn.dataset.value; render(); }
    if (act === 'copy-text') {
      const r = items.find(x => x.id === id);
      if (r) await copyToClipboard(r.data.body || '');
    }
    if (act === 'toggle-secret') {
      const input = $('#secretValue'); if (input) input.type = input.type === 'password' ? 'text' : 'password';
    }
    if (act === 'copy-secret') {
      const input = $('#secretValue'); if (input) await copyToClipboard(input.value);
    }
    if (act === 'export') exportData();
    if (act === 'import') $('#importFile').click();
    if (act === 'sign-out' && sb) { await sb.auth.signOut(); modal.close(); }
    if (act === 'delete-row') {
      const item = items.find(x => x.id === id);
      if (item && confirm('Supprimer définitivement cet élément ?')) {
        if (await deleteRows([id])) { modal.close(); notify('Élément supprimé'); }
      }
    }
    if (act === 'delete-project') {
      if (confirm('Supprimer ce projet ET tous ses accès, textes et tâches ? Cette action est irréversible.')) {
        const ids = items.filter(x => x.id === id || x.project_id === id).map(x => x.id);
        if (await deleteRows(ids)) { active = 'overview'; modal.close(); render(); notify('Projet supprimé'); }
      }
    }
  });
  document.addEventListener('change', async e => {
    if (e.target.matches('[data-task-check]')) {
      const r = items.find(x => x.id === e.target.dataset.taskCheck);
      if (r) await saveRow(stamp('task',r.project_id,Object.assign({},r.data,{done:e.target.checked}),r.id));
    }
    if (e.target.id === 'importFile' && e.target.files[0]) await importData(e.target.files[0]);
  });
  document.addEventListener('submit', async e => {
    const form = e.target.closest('form[data-form]');
    if (!form) return;
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form).entries());
    const kind = form.dataset.form, id = form.dataset.id || undefined;
    const submit = form.querySelector('[type="submit"]');
    if (submit) submit.disabled = true;
    try {
      if (kind === 'project') {
        const row = stamp('project',null,{name:d.name.trim(),description:d.description.trim(),color:d.color},id);
        if (await saveRow(row)) { active = row.id; modal.close(); render(); notify('Projet enregistré'); }
      }
      if (kind === 'copy') {
        if (await saveRow(stamp('copy',active,{title:d.title.trim(),body:d.body,category:d.category},id))) {
          modal.close(); notify('Texte enregistré');
        }
      }
      if (kind === 'task') {
        const old = items.find(x => x.id === id);
        if (await saveRow(stamp('task',active,{title:d.title.trim(),owner:d.owner.trim(),due:d.due,
          priority:d.priority,done:old ? !!old.data.done : false},id))) { modal.close(); notify('Tâche enregistrée'); }
      }
      if (kind === 'vault') {
        const old = items.find(x => x.id === id);
        const password = d.password ? await encryptSecret(d.password) : old && old.data.password;
        if (!password) throw Error('Ajoute un mot de passe');
        if (await saveRow(stamp('vault',active,{title:d.title.trim(),username:d.username.trim(),url:d.url.trim(),password},id))) {
          modal.close(); notify('Accès chiffré et enregistré');
        }
      }
      if (kind === 'unlock') {
        const phrase = d.phrase;
        if (phrase.length < 12) throw Error('Utilise une phrase d’au moins 12 caractères');
        const existing = items.find(x => x.kind === 'vault');
        const previous = vaultPhrase;
        vaultPhrase = phrase;
        try { if (existing) await decryptSecret(existing.data.password); }
        catch (_) { vaultPhrase = previous; throw Error('Phrase secrète incorrecte'); }
        modal.close(); render(); notify('Coffre déverrouillé pour cette session');
      }
      if (kind === 'settings') {
        if ((d.url && !d.anonKey) || (!d.url && d.anonKey)) throw Error('Renseigne les deux valeurs Supabase');
        if (d.url && !/^https:\/\/[a-z0-9.-]+\.supabase\.co\/?$/i.test(d.url.trim())) throw Error('URL Supabase incorrecte');
        if (d.anonKey && /service_role|secret_/i.test(d.anonKey)) throw Error('Ne jamais utiliser une clé privée ici');
        localStorage.setItem(CFG_KEY,JSON.stringify({url:d.url.trim(),anonKey:d.anonKey.trim()}));
        location.reload();
      }
      if (kind === 'login') {
        if (!sb) throw Error('Configuration Supabase manquante');
        const {error} = await sb.auth.signInWithOtp({email:d.email.trim(), options:{
          shouldCreateUser:false,emailRedirectTo:location.origin+location.pathname
        }});
        if (error) throw error;
        notify('Vérifie ton e-mail pour te connecter');
        form.reset();
      }
    } catch(err) { notify(err.message || 'Erreur inconnue'); }
    finally { if (submit) submit.disabled = false; }
  });
  modal.addEventListener('click', e => { if (e.target === modal) modal.close(); });
  modal.addEventListener('close', () => { $('#modalBody').innerHTML = ''; });
  render();
  startCloud();
  if ('serviceWorker' in navigator) window.addEventListener('load', () =>
    navigator.serviceWorker.register('./sw.js').catch(() => {}));
})();
