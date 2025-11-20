// チェックリスト アプリ main (defer)
// 要件: URL同期、ローカルストレージ保存、テーマ、WQHDで2カラム、インポート/エクスポート

let initialLoad = () => null;

(async function init() {
  'use strict';

  // ---------- Utilities ----------
  const idle = window.requestIdleCallback || ((cb) => setTimeout(() => cb({ didTimeout:false, timeRemaining:()=>50 }), 1));
  const on = (el, ev, fn, opts) => el.addEventListener(ev, fn, opts);
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const uuid4 = () => crypto.randomUUID();

  const STORAGE = {
    get(key, fallback=null) {
      try { const v = localStorage.getItem(key); return v==null?fallback:JSON.parse(v); } catch(e){ return fallback; }
    },
    set(key, value) {
      return new Promise(resolve => {
        idle(() => {
          try {
            localStorage.setItem(key, JSON.stringify(value));
          } catch(e) {
            console.warn('LS set failed', e);
          }
          resolve();
        });
      });
    },
    remove(key) {
      return new Promise(resolve => {
        idle(() => {
          try {
            localStorage.removeItem(key);
          } catch (e) {}
          resolve(); // 必ず完了通知
        });
      });
    },
  };

  const KEY = {
    theme: 'cl_theme_v1',
    settings: 'cl_settings_v1',
    index: 'cl_index_v1',
    list: (id) => `cl_list_${id}_v1`,
  };

  const BC = ('BroadcastChannel' in window) ? new BroadcastChannel('cl_sync_v1') : null;
  const bcPost = (type, payload) => { if (BC) { try { BC.postMessage({ type, payload, ts: Date.now() }); } catch(e){} } };

  function encodeBase64(bytes) {
    // Uint8Array -> base64 (RFC4648)
    let bin = '';
    const chunk = 0x8000;
    for (let i=0; i<bytes.length; i+=chunk) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i+chunk));
    }
    return btoa(bin);
  }
  function decodeBase64ToBytes(b64) {
    const bin = atob(b64);
    const len = bin.length;
    const bytes = new Uint8Array(len);
    for (let i=0;i<len;i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  const textEncoder = new TextEncoder();
  const textDecoder = new TextDecoder();

  async function tryLoadPako() {
    // ESM優先 -> UMD fallback
    try {
      const mod = await import('https://cdn.jsdelivr.net/npm/pako@2.1.0/dist/pako.esm.mjs');
      return mod;
    } catch(e) {
      // fallback to UMD
      return new Promise((resolve) => {
        const id = 'pako-umd';
        if (document.getElementById(id)) return resolve(window.pako);
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/pako@2.1.0/dist/pako.min.js';
        s.async = true;
        s.id = id;
        s.onload = () => resolve(window.pako);
        s.onerror = () => resolve(null);
        document.head.appendChild(s);
      });
    }
  }

  // ---------- Data Model ----------
  /** @typedef {{id:string,text:string,checked:boolean}} Item */
  /** @typedef {{v:1,id:string,name:string,saveState:boolean,items:Item[],updatedAt:number}} Checklist */

  function loadIndex() { return STORAGE.get(KEY.index, []); }
  async function saveIndex(index) { await STORAGE.set(KEY.index, index); bcPost('index', null); }
  function loadList(id) { return STORAGE.get(KEY.list(id), null); }
  async function saveList(list) { list.updatedAt = Date.now(); await STORAGE.set(KEY.list(list.id), list); bcPost('list', list.id); }
  async function removeList(id) { await STORAGE.remove(KEY.list(id)); bcPost('list-removed', id); }

  async function ensureDefaultList() {
    let idx = loadIndex();
    if (!idx || idx.length === 0) {
      const id = uuid4();
      const list = /** @type {Checklist} */({ v:1, id, name: 'デフォルト', saveState: true, items: [], updatedAt: Date.now() });
      await saveList(list);
      idx = [{ id, name: list.name, createdAt: Date.now() }];
      saveIndex(idx);
    }
    return idx;
  }

  // ---------- Elements ----------
  const els = {
    themeSelect: $('#themeSelect'),
    sizeSelect: $('#sizeSelect'),
    mainListSelect: $('#mainListSelect'), // moved into main panel header
    newListBtn: $('#newListBtn'),
    renameListBtn: $('#renameListBtn'),
    moveUpBtn: $('#moveUpBtn'),
    moveDownBtn: $('#moveDownBtn'),
    swapBtn: $('#swapBtn'),
    deleteListBtn: $('#deleteListBtn'),
    exportBtn: $('#exportBtn'),
    importBtn: $('#importBtn'),
    bulkAddBtn: $('#bulkAddBtn'),
    items: $('#items'),
    mainListTitle: $('#mainListTitle'),
    brandListName: $('#brandListName'),
    newItemInput: $('#newItemInput'),
    // main bulk controls
    mainCheckAllBtn: $('#mainCheckAllBtn'),
    mainUncheckAllBtn: $('#mainUncheckAllBtn'),
    grid: document.querySelector('.grid'),
    // secondary
    secondaryListSelect: $('#secondaryListSelect'),
    secondaryItems: $('#secondaryItems'),
    secondaryMakeMainBtn: $('#secondaryMakeMainBtn'),
    secondaryCheckAllBtn: $('#secondaryCheckAllBtn'),
    secondaryUncheckAllBtn: $('#secondaryUncheckAllBtn'),
    // modals
    exportBackdrop: $('#exportBackdrop'),
    exportModal: $('#exportModal'),
    exportUrlBox: $('#exportUrlBox'),
    exportWarn: $('#exportWarn'),
    exportWarnYes: $('#exportWarnYes'),
    exportWarnNo: $('#exportWarnNo'),
    copyExportBtn: $('#copyExportBtn'),
    copyBtn: $('#copyBtn'),
    importBackdrop: $('#importBackdrop'),
    importModal: $('#importModal'),
    importSummary: $('#importSummary'),
    importPreview: $('#importPreview'),
    confirmImportBtn: $('#confirmImportBtn'),
    importNameOverride: $('#importNameOverride'),
    bulkBackdrop: $('#bulkBackdrop'),
    bulkModal: $('#bulkModal'),
    bulkText: $('#bulkText'),
    bulkImportAddItemsBtn: $('#bulkImportAddItemsBtn'),
    bulkCreateNewListBtn: $('#bulkCreateNewListBtn'),
    bulkNameOverride: $('#bulkNameOverride'),
    importUrlInput: $('#importUrlInput'),
    openUrlBtn: $('#openUrlBtn'),
    // nudge
    importNudge: $('#importNudge'),
    openImportConfirmBtn: $('#openImportConfirmBtn'),
    // notfound
    notFoundBackdrop: $('#notFoundBackdrop'),
    notFoundModal: $('#notFoundModal'),
  };

  // ---------- State ----------
  let currentListId = null;
  let currentList = null; // Checklist
  let secondaryListId = null;
  let visibleListIds = []; // sub panels excluding currentListId (順序はURLで保持)
  let pendingImportPayload = null; // from URL

  // ---------- Theme & Size Controls ----------
  // init theme select
  try {
    const theme = localStorage.getItem(KEY.theme) || document.documentElement.getAttribute('data-theme') || 'light';
    els.themeSelect.value = theme;
  } catch {}
  on(els.themeSelect, 'change', (e) => {
    const theme = els.themeSelect.value;
    const allowed = { light:1, lightgray:1, dark:1, deepdark:1 };
    if (!allowed[theme]) return;
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(KEY.theme, theme); } catch {}
  });

  const SIZE_MAP = { s: 22, m: 28, l: 36 };
  // load saved size
  const settings = STORAGE.get(KEY.settings, { size: 'm' });
  if (settings.size && SIZE_MAP[settings.size]) {
    els.sizeSelect.value = settings.size;
    document.documentElement.style.setProperty('--checkbox-size', SIZE_MAP[settings.size] + 'px');
  }
  on(els.sizeSelect, 'change', () => {
    const v = els.sizeSelect.value;
    const px = SIZE_MAP[v] || 28;
    document.documentElement.style.setProperty('--checkbox-size', px + 'px');
    settings.size = v; STORAGE.set(KEY.settings, settings);
  });

  // ---------- Lists UI ----------

  function populateListSelects() {
    const idx = loadIndex();

    // secondaryListId の現在値を取得（あなたのロジックをそのまま使用）
    const secondaryListId = els.secondaryListSelect ? (els.secondaryListSelect.value || null) : null;

    let idx2 = idx;

    // ---------- メイン用オプション（secondary が選択されている場合は除外） ----------
    let mainOptions = idx
        .filter(e => !secondaryListId || e.id !== secondaryListId)
        .map((e) => `<option value="${e.id}">${escapeHtml(e.name)}</option>`)
        .join('');
    if (!idx.length) {
      mainOptions = `<option value="">読み込むものはありません</option>`;
    }

    // ---------- セカンダリ用オプション（currentListId を除外。ただし secondary 未選択なら全表示） ----------
    let secondaryOptions = idx2
        .filter(e => !currentListId || e.id !== currentListId)
        .map((e) => `<option value="${e.id}">${escapeHtml(e.name)}</option>`)
        .join('');
    if (!idx.length) {
      secondaryOptions = `<option value="">読み込むものはありません</option>`;
    }

    // ---------- DOM反映 ----------
    if (els.mainListSelect) els.mainListSelect.innerHTML = mainOptions;
    if (els.secondaryListSelect) {
      els.secondaryListSelect.innerHTML = '<option value="">(なし)</option>' + secondaryOptions;
    }

    // ---------- 値の復帰 ----------
    // main
    if (currentListId && idx.find(x => x.id === currentListId)) {
      if (els.mainListSelect) els.mainListSelect.value = currentListId;
    } else if (idx[0]) {
      if (els.mainListSelect) els.mainListSelect.value = idx[0].id;
    } else {
      if (els.mainListSelect) els.mainListSelect.value = '';
    }

    // secondary
    if (secondaryListId) {
      if (els.secondaryListSelect) els.secondaryListSelect.value = secondaryListId;
    } else {
      if (els.secondaryListSelect) els.secondaryListSelect.value = '';
    }
  }


  function escapeHtml(s){ return (s??'').replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }

  function selectList(listId) {
    currentListId = listId;
    const list = loadList(listId);
    if (!list) return;
    currentList = list;
    els.mainListTitle.textContent = list.name;
    if (els.brandListName) els.brandListName.textContent = list.name;
    renderItems(list, els.items, true);
    // URL反映
    reflectListsInUrl();
    populateListSelects();
  }

  function reflectListsInUrl() {
    const url = new URL(location.href);
    const ordered = [currentListId, ...visibleListIds.filter(id=>id && id!==currentListId)];
    url.searchParams.set('lists', ordered.join(','));
    url.searchParams.delete('list');
    history.replaceState(null, '', url);
  }

  function renderItems(list, container, interactive) {
    // Avoid heavy rAF; simple string template and one injection
    const html = list.items.map((it, i) => {
      const inputId = `${list.id}-${it.id}`;
      const checked = it.checked ? 'checked' : '';
      const leading = extractLeadingEmoji(it.text || '');
      let namePart = escapeHtml(it.text || '');
      if (leading) {
        // 先頭絵文字を切り出す（最初の絵文字だけ）
        const rest = (it.text || '').slice(leading.length).trim();
        namePart = `<span class="emoji-first" data-native="${escapeHtml(leading)}">${escapeHtml(leading)}</span><span class="item-text">${escapeHtml(rest)}</span>`;
      } else {
        namePart = `<span class="item-text">${escapeHtml(it.text || '')}</span>`;
      }
      return `
        <div class="item" data-id="${escapeHtml(it.id)}">
          <button class="drag-handle" data-action="drag" title="並べ替え"><span class="bars"><span></span></span></button>
          <div class="checkbox-wrap"><input ${interactive? '' : 'disabled'} type="checkbox" id="${escapeHtml(inputId)}" ${checked} aria-label="${escapeHtml(it.text)}"></div>
          <label class="checkbox-label" for="${escapeHtml(inputId)}">${namePart}</label>
          <button class="btn" data-action="edit">編集</button>
          <button class="btn delete-btn" data-action="del">削除</button>
        </div>`;
    }).join('');
    container.innerHTML = html;
  }

  async function updateIndexName(id, name) {
    const idx = loadIndex();
    const e = idx.find(x=>x.id===id);
    if (e) { e.name = name; await saveIndex(idx); }
  }

  // ---------- Item interactions ----------
  function getListForContainer(container) {
    if (container === els.items) return currentListId ? loadList(currentListId) : null;
    if (container === els.secondaryItems) return secondaryListId ? loadList(secondaryListId) : null;
    return null;
  }

  async function handleCheckboxChange(ev, container) {
    const t = ev.target;
    if (!(t instanceof HTMLInputElement) || t.type !== 'checkbox') return;
    const wrap = t.closest('.item');
    const list = getListForContainer(container);
    if (!wrap || !list) return;
    const id = wrap.getAttribute('data-id');
    const it = list.items.find(x=>x.id===id);
    if (!it) return;
    it.checked = !!t.checked;
    await saveList(list);
    if (container===els.items && list.id===currentListId) currentList = list;
  }

  async function handleItemClick(ev, container) {
    const list = getListForContainer(container);
    if (!list) return;
    const delBtn = ev.target.closest('button[data-action="del"]');
    const editBtn = ev.target.closest('button[data-action="edit"]');
    const dragBtn = ev.target.closest('button[data-action="drag"]');
    if (delBtn) {
      const wrap = delBtn.closest('.item');
      const id = wrap.getAttribute('data-id');
      list.items = list.items.filter(x=>x.id!==id);
      await saveList(list);
      renderItems(list, container, true);
      // リストセレクトをもれなく更新
      populateListSelects();
      if (container===els.items && list.id===currentListId) currentList = list;
      return;
    }
    if (editBtn) {
      const wrap = editBtn.closest('.item');
      const id = wrap.getAttribute('data-id');
      const it = list.items.find(x=>x.id===id);
      if (!it) return;
      const label = wrap.querySelector('.checkbox-label');
      if (!label) return;
      const input = document.createElement('input');
      input.type = 'text';
      input.value = it.text;
      input.style.width = '100%';
      label.replaceWith(input);
      input.focus(); input.select();
      const finish = async (commit) => {
        if (commit) { it.text = input.value.trim() || it.text; await saveList(list); }
        renderItems(list, container, true);
        if (container===els.items && list.id===currentListId) currentList = list;
      };
      input.addEventListener('keydown', async (e)=>{
        if (e.key==='Enter') { e.preventDefault(); await finish(true); }
        if (e.key==='Escape') { e.preventDefault(); await finish(false); }
      });
      input.addEventListener('blur', async ()=> await finish(true));
      return;
    }
    if (dragBtn) return; // drag handled separately
    // toggle by clicking item area (excluding buttons/inputs)
    const wrap = ev.target.closest('.item');
    if (!wrap) return;
    if (ev.target.closest('button, input, textarea, select, a, label')) return;
    const id = wrap.getAttribute('data-id');
    const it = list.items.find(x=>x.id===id);
    if (!it) return;
    it.checked = !it.checked;
    // 仕様: saveState=true の場合は保存しない
    await saveList(list);
    renderItems(list, container, true);
    if (container===els.items && list.id===currentListId) currentList = list;
  }

  on(els.items, 'change', (ev) => handleCheckboxChange(ev, els.items));
  on(els.items, 'click', (ev) => handleItemClick(ev, els.items));
  on(els.secondaryItems, 'change', (ev) => handleCheckboxChange(ev, els.secondaryItems));
  on(els.secondaryItems, 'click', (ev) => handleItemClick(ev, els.secondaryItems));

  on(els.newItemInput, 'keydown', async (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      const text = els.newItemInput.value.trim();
      if (!text || !currentList) return;
      currentList.items.push({ id: uuid4(), text, checked: false });
      els.newItemInput.value = '';
      await saveList(currentList);
      renderItems(currentList, els.items, true);
      populateListSelects(); // 追加時もセレクト更新（要件: もれなく更新）
    }
  });

  // ---------- List Controls ----------
    // メインパネル内のリスト切り替え
  if (els.mainListSelect) on(els.mainListSelect, 'change', () => {
    const id = els.mainListSelect.value;
    if (!id) return;
    selectList(id);
  });

  on(els.secondaryListSelect, 'change', () => {
    secondaryListId = els.secondaryListSelect.value || null;
    if (secondaryListId) {
      const l2 = loadList(secondaryListId);
      if (l2) renderItems(l2, els.secondaryItems, true);
    } else {
      els.secondaryItems.innerHTML = '';
    }
  });
  on(els.renameListBtn, 'click', async () => {
    if (!currentList) return;
    const name = prompt('新しいリスト名を入力', currentList.name || '');
    if (name==null) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    currentList.name = trimmed;
    await saveList(currentList);
    await updateIndexName(currentList.id, trimmed);
    selectList(currentList.id);
  });
  on(els.newListBtn, 'click', async () => {
    const id = uuid4();
    const name = `新規リスト`;
    const list = { v:1, id, name, saveState: true, items: [], updatedAt: Date.now() };
    await saveList(list);
    const idx = loadIndex(); idx.push({ id, name, createdAt: Date.now() }); await saveIndex(idx);
    selectList(id);
    console.log(KEY.list(id));
    //initialLoad();
  });
  on(els.deleteListBtn, 'click', async () => {
    if (!currentList) return;
    if (!confirm('このチェックリストを完全に削除しますか？この操作は元に戻せません。')) return;
    const id = currentList.id;
    await removeList(id);
    const idx = loadIndex().filter(x=>x.id!==id); await saveIndex(idx);
    const next = idx[0]?.id;
    if (next) selectList(next); else {
      ensureDefaultList(); populateListSelects(); selectList(loadIndex()[0].id);
    }
    //initialLoad();
  });

  // 現在のリストをインデックス内で上下に移動
  async function moveCurrentList(direction) {
    // direction: -1 (上へ) or +1 (下へ)
    if (!currentListId) return;
    const idx = loadIndex() || [];
    const pos = idx.findIndex(x => x.id === currentListId);
    if (pos < 0) return;
    const target = pos + direction;
    if (target < 0 || target >= idx.length) return; // 範囲外は何もしない
    const [moved] = idx.splice(pos, 1);
    idx.splice(target, 0, moved);
    await saveIndex(idx); // 必ず await
    // UI更新: 同じリストを選び直してセレクト/URL/タイトルを更新
    selectList(currentListId);
    populateListSelects();
  }

  if (els.moveUpBtn) on(els.moveUpBtn, 'click', async () => { await moveCurrentList(-1); });
  if (els.moveDownBtn) on(els.moveDownBtn, 'click', async () => { await moveCurrentList(1); });

  // 現在のリストをインデックス内で上下に移動
  async function swapbtn(direction) {
    // direction: -1 (上へ) or +1 (下へ)
    if (!currentListId) return;
    let list = loadList(currentListId);
    if(list.items.length===0) return;
    list.items.forEach(it=>{ it.checked = !it.checked; });
    await saveList(list);
    selectList(currentListId);
  }

  if (els.swapBtn) on(els.swapBtn, 'click', async () => { await swapbtn(); });

  // ---------- Export ----------
  async function openExportForList(baseList) {
    const listForExport = JSON.parse(JSON.stringify(baseList));
    if (!listForExport.saveState) { listForExport.items.forEach(it=>{ it.checked = false; }); }
    const payload = { v:1, id: listForExport.id, list: listForExport };
    const jsonStr = JSON.stringify(payload);
    const utf8 = textEncoder.encode(jsonStr);
    let urlParam = '';
    let encoding = '';
    let pako = await tryLoadPako();
    if (pako && (pako.deflate || pako.default?.deflate)) {
      const deflate = pako.deflate || pako.default.deflate;
      try {
        const gz = deflate(utf8);
        urlParam = encodeBase64(gz);
        encoding = 'gz+b64';
      } catch {}
    }
    if (!urlParam) { // fallback to plain b64
      urlParam = encodeBase64(utf8);
      encoding = 'b64';
    }
    const url = new URL(location.href);
    url.searchParams.delete('list');
    url.searchParams.delete('lists');
    url.searchParams.set('import', urlParam);
    url.searchParams.set('enc', encoding);
    // 表示
    openModal('export');
    els.exportUrlBox.value = url.toString();
    // 長さ警告
    if (els.exportUrlBox.value.length >= 4096) {
      els.exportWarn.style.display = '';
    } else {
      els.exportWarn.style.display = 'none';
    }
  }
  on(els.exportBtn, 'click', async () => {
    if (!currentList) return;
    await openExportForList(currentList);
  });
  on(els.copyExportBtn, 'click', async () => {
    try { await navigator.clipboard.writeText(els.exportUrlBox.value); } catch(e) { /* ignore */ }
  });
  on(els.exportWarnYes, 'click', () => { els.exportWarn.style.display = 'none'; });
  on(els.exportWarnNo, 'click', () => { closeModal('export'); });

  // ---------- Import ----------
  on(els.importBtn, 'click', () => {
    // 手動インポートはバルクモーダルを活用 or 専用UIに誘導
    // ここでは、URL貼り付けはエクスポートURLモーダルに貼ってもらう運用にせず、バルクを使う要件があるので、
    // シンプルにバルクモーダルを開いてペーストしてもらう
    openModal('bulk');
  });

  // URLインポート処理
  async function handleImportFromUrl() {
    const url = new URL(location.href);
    const imp = url.searchParams.get('import');
    if (!imp) return;
    const enc = url.searchParams.get('enc') || 'gz+b64';
    // デコード
    let bytes;
    try {
      const b = decodeBase64ToBytes(imp);
      if (enc === 'gz+b64') {
        const pako = await tryLoadPako();
        const inflate = pako?.inflate || pako?.default?.inflate;
        if (!inflate) throw new Error('inflate not available');
        const out = inflate(b);
        bytes = out;
      } else {
        bytes = b;
      }
    } catch(e) {
      console.warn('Import decode failed', e);
      return;
    }
    let obj;
    try { obj = JSON.parse(textDecoder.decode(bytes)); } catch(e) { return; }
    if (!obj || obj.v!==1 || !obj.list) return;
    pendingImportPayload = obj.list; // Checklist

    const exists = !!loadList(obj.list.id);
    if(!exists) {
      // 右下ボタンではなく、全画面ポップアップで確認
      openImportConfirm(pendingImportPayload);
    }else{
      const url1 = new URL(location.href);
      url1.searchParams.delete('import');
      url1.searchParams.delete('enc');
      history.replaceState(null, '', url1);
    }
    hideNudge();
    // 取り込みプレビュー時はURLのlistsは触らない
  }

  function showNudge() { els.importNudge.style.display = 'block'; }
  function hideNudge() { els.importNudge.style.display = 'none'; }
  on(els.openImportConfirmBtn, 'click', () => {
    if (!pendingImportPayload) return;
    openImportConfirm(pendingImportPayload);
  });

  function openImportConfirm(list) {
    els.importSummary.textContent = `あなたのチェックリストに「${list.name}」をインポートしようとしており、下記の要素が含まれます。よろしいですか？`;
    const preview = list.items.map((it,i)=>`- [${it.checked?'x':' '}] ${it.text}`).join('\n');
    els.importPreview.textContent = preview;
    if (els.importNameOverride) els.importNameOverride.value = '';
    openModal('import');
  }

  on(els.confirmImportBtn, 'click', async () => {
    if (!pendingImportPayload) return;
    const list = pendingImportPayload;
    const nameOverride = els.importNameOverride?.value?.trim();
    if (nameOverride) list.name = nameOverride;
    await saveList(list);
    const idx = loadIndex();
    if (!idx.find(x=>x.id===list.id)) { idx.push({ id:list.id, name:list.name, createdAt: Date.now() }); await saveIndex(idx); }
    populateListSelects();
    selectList(list.id);
    pendingImportPayload = null;
    closeModal('import');
    hideNudge();
    const url1 = new URL(location.href);
    url1.searchParams.delete('import');
    url1.searchParams.delete('enc');
    history.replaceState(null, '', url1);
    populateListSelects();
  });

  // ---------- Bulk Add Modal ----------
  on(els.bulkAddBtn, 'click', () => openModal('bulk'));
  on(els.bulkImportAddItemsBtn, 'click', async () => {
    if (!currentList) return;
    if(!els.bulkText.value.startsWith("name,checked")){
      const lines = els.bulkText.value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
      if (!lines.length) { closeModal('bulk'); return; }
      for (const t of lines) currentList.items.push({ id: uuid4(), text: t, checked: false });
      await saveList(currentList);
    }else{
      //csv import
      const csv = els.bulkText.value.trim();
      const newItems = parseCsvToItems(csv);
      if(!newItems.length){ closeModal('bulk'); return; }
      for(const it of newItems) currentList.items.push(it);
      await saveList(currentList);
    }

    renderItems(currentList, els.items, true);
    els.bulkText.value = '';
    closeModal('bulk');
    populateListSelects();
    //initialLoad();
  });
  on(els.bulkCreateNewListBtn, 'click', async () => {
    const lines = els.bulkText.value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    if (!lines.length) { closeModal('bulk'); return; }

    const defaultName = `インポート ${new Date().toLocaleString()}`;
    const ovName = (els.bulkNameOverride?.value || '').trim();
    const id = uuid4();
    
    if(!els.bulkText.value.startsWith("name,checked")){
      const lines = els.bulkText.value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
      const list = { v:1, id, name: ovName || defaultName, saveState: true, items: lines.map(t=>({ id:uuid4(), text:t, checked:false })), updatedAt: Date.now() };
      await saveList(list);
      const idx = loadIndex(); idx.push({ id, name: list.name, createdAt: Date.now() }); await saveIndex(idx);
    }else{
      let newItems = parseCsvToItems(els.bulkText.value);
      if(!newItems.length){ closeModal('bulk'); return; }
      const list = { v:1, id, name: ovName || defaultName, saveState: true, items: newItems, updatedAt: Date.now() };
      await saveList(list);
      const idx = loadIndex(); idx.push({ id, name: list.name, createdAt: Date.now() }); await saveIndex(idx);
    }

    populateListSelects();
    selectList(id);
    els.bulkText.value = '';
    if (els.bulkNameOverride) els.bulkNameOverride.value = '';
    closeModal('bulk');
  });

  function parseCsvToItems(csvText){
    const lines = csvText.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    if(lines.length < 2) return [];

    const items = [];
    for(let i=1; i<lines.length; i++){
      const row = lines[i].split(",");
      const name = row[0] ?? "";
      const checkedStr = row[1]?.toLowerCase() ?? "false";

      const checked =
          checkedStr === "true" ||
          checkedStr === "1" ||
          checkedStr === "on" ||
          checkedStr === "yes";

      items.push({
        id: uuid4(),
        text: name,
        checked
      });
    }
    return items;
  }


  // 開くURL（http(s)/file:///）入力対応（先頭行のみ採用）
  on(els.openUrlBtn, 'click', () => {
    const raw = (els.importUrlInput?.value || '').split(/\r?\n/)[0].trim();
    if (!raw) return;
    if (/^(https?:\/\/|file:\/\/\/)/i.test(raw)) {
      location.href = raw; // ユーザー操作により遷移
    }
  });

  // ---------- Modals common ----------
  function openModal(kind) {
    if (kind==='export') { els.exportBackdrop.classList.add('show'); els.exportModal.classList.add('show'); }
    if (kind==='import') { els.importBackdrop.classList.add('show'); els.importModal.classList.add('show'); }
    if (kind==='bulk') { els.bulkBackdrop.classList.add('show'); els.bulkModal.classList.add('show'); }
    if (kind==='notfound') { els.notFoundBackdrop.classList.add('show'); els.notFoundModal.classList.add('show'); }
  }
  function closeModal(kind) {
    if (kind==='export') { els.exportBackdrop.classList.remove('show'); els.exportModal.classList.remove('show'); }
    if (kind==='import') { els.importBackdrop.classList.remove('show'); els.importModal.classList.remove('show'); }
    if (kind==='bulk') { els.bulkBackdrop.classList.remove('show'); els.bulkModal.classList.remove('show'); }
    if (kind==='notfound') { els.notFoundBackdrop.classList.remove('show'); els.notFoundModal.classList.remove('show'); }
  }
  on(document.body, 'click', (e) => {
    const close = e.target.closest('[data-close]');
    if (close) { closeModal(close.getAttribute('data-close')); }
  });
  // backdropクリックで閉じる（インポートは仕様上「黒を押すと非表示」）
  on(els.exportBackdrop, 'click', () => closeModal('export'));
  on(els.importBackdrop, 'click', () => closeModal('import'));
  on(els.bulkBackdrop, 'click', () => closeModal('bulk'));
  if (els.notFoundBackdrop) on(els.notFoundBackdrop, 'click', () => closeModal('notfound'));

  // ---------- Cross-window sync ----------
  if (BC) {
    BC.onmessage = (ev) => {
      const { type, payload } = ev.data || {};
      if (type === 'index') { populateListSelects(); }
      if (type === 'list') {
        if (payload === currentListId) { const l = loadList(currentListId); if (l) { currentList = l; renderItems(currentList, els.items, true); } }
        if (payload === secondaryListId) { const l2 = loadList(secondaryListId); if (l2) renderItems(l2, els.secondaryItems, true); }
      }
      if (type === 'list-removed') {
        if (payload === currentListId) {
          const idx = loadIndex();
          populateListSelects();
          if (idx[0]) selectList(idx[0].id);
        }
      }
    };
  }
  window.addEventListener('storage', (e) => {
    if (e.key === KEY.index) { populateListSelects(); }
    if (e.key && currentListId && e.key === KEY.list(currentListId)) { const l = loadList(currentListId); if (l) { currentList = l; renderItems(currentList, els.items, true); } }
    if (e.key && secondaryListId && e.key === KEY.list(secondaryListId)) { const l2 = loadList(secondaryListId); if (l2) renderItems(l2, els.secondaryItems, true); }
  });

  let loaded = true;

  // ---------- Initial Bootstrap ----------
  initialLoad = async () => {
    // 初期UIはすでにHTMLに存在。ここではデータを流し込むのみ。
    const idx = await ensureDefaultList();
    // URL ?lists= (複数) を優先、なければ ?list=
    const url = new URL(location.href);
    const listsParam = url.searchParams.get('lists');
    const singleList = url.searchParams.get('list');
    let ids = [];
    if (listsParam) {
      ids = listsParam.split(',').map(s=>s.trim()).filter(Boolean);
    } else if (singleList) {
      ids = [singleList];
    } else if (idx[0]) {
      ids = [idx[0].id];
    }
    const exists = [];
    let missing = false;
    for (const id of ids) {
      if (loadList(id)) exists.push(id); else missing = true;
    }
    if (!exists.length && idx[0]) exists.push(idx[0].id);
    currentListId = exists[0] || null;
    visibleListIds = exists.slice(1);
    if (missing) idle(()=>openModal('notfound'));
    if (currentListId) selectList(currentListId);


    if(loaded){
      // セカンダリ初期値
      els.secondaryListSelect.value = visibleListIds[0] || '';
      secondaryListId = visibleListIds[0] || null;
      if (secondaryListId) { const l2 = loadList(secondaryListId); if (l2) renderItems(l2, els.secondaryItems, true); }
      // 追加のサブパネル描画
      //renderDynamicSubPanels();

      populateListSelects();
      // URLインポート/バルク開き
      handleImportFromUrl();
      if (url.searchParams.get('bulk') === '1') openModal('bulk');
    }
    loaded = false;
  };
  await initialLoad();


  // ---------- Drag & Drop order (with cross-panel in WQHD) ----------
  let dragging = null; // {srcContainer, srcListId, itemId, draggedEl, placeholder}
  function setupDnd(container) {
    on(container, 'pointerdown', (ev) => {
      const btn = ev.target.closest('button[data-action="drag"]');
      if (!btn) return;
      const item = btn.closest('.item');
      if (!item) return;
      if (dragging) return; // allow only one
      const list = getListForContainer(container);
      if (!list) return;
      try { document.body.classList.add('grabbing'); } catch {}

      document.querySelectorAll(".item, .checkbox-label, .drag-handle").forEach(el1 => {
        el1.setAttribute("data-draggable", "true");
      });

      dragging = {
        srcContainer: container,
        srcListId: list.id,
        itemId: item.getAttribute('data-id'),
        draggedEl: item,
        placeholder: null,
        startX: ev.clientX,
        startY: ev.clientY,
      };
      item.classList.add('dragging');
      ev.preventDefault();
      const ph = document.createElement('div');
      ph.className = 'item placeholder';
      ph.style.height = item.getBoundingClientRect().height + 'px';
      dragging.placeholder = ph;
      item.parentElement.insertBefore(ph, item.nextSibling);

// ダミーを作成
      dragging.ghost = dragging.draggedEl.cloneNode(true);
      dragging.ghost.classList.add('drag-ghost');
      document.body.appendChild(dragging.ghost);

      const rect = dragging.draggedEl.getBoundingClientRect();
      dragging.ghost.style.position = 'fixed';
      dragging.ghost.style.left = rect.left + 'px';
      dragging.ghost.style.top = rect.top + 'px';
      dragging.ghost.style.width = rect.width + 'px';

      dragging.startX = ev.clientX;
      dragging.startY = ev.clientY;

// 本体は透明化
      dragging.draggedEl.style.opacity = "0.3";


      const move = (e) => {
        const pointY = e.clientY;
        const pointX = e.clientX;

        if(!dragging){ return; }

        // --- 追加: 相対位置でドラッグ要素を移動 ---
        const dx = pointX - dragging.startX - 30;
        const dy = pointY - dragging.startY;
        dragging.ghost.style.transform = `translate(${dx}px, ${dy}px)`;

        // --- パネル切り替えに pointX を使う ---
        let targetContainer = container;
        const other = (container === els.items) ? els.secondaryItems : els.items;
        if (other && other.offsetParent !== null) {
          const rect = other.getBoundingClientRect();
          const inX = pointX >= rect.left - 40 && pointX <= rect.right + 40;
          const inY = pointY >= rect.top - 20 && pointY <= rect.bottom + 20;
          if (inX && inY) targetContainer = other;
        }

        // find position in targetContainer
        const siblings = Array.from(targetContainer.querySelectorAll('.item:not(.dragging)'));
        let insertBefore = null;
        for (const s of siblings) {
          const r = s.getBoundingClientRect();
          const mid = (r.top + r.bottom) / 2;
          if (pointY < mid) { insertBefore = s; break; }
        }
        // move placeholder
// 1. targetContainer が変わった場合だけ append（初期配置）
        if (dragging.placeholder.parentElement !== targetContainer) {
          dragging.placeholder.remove();
          targetContainer.appendChild(dragging.placeholder);
        }

// 2. ポジション調整は insertBefore のみ
        if (insertBefore) {
          targetContainer.insertBefore(dragging.placeholder, insertBefore);
        }
      };
      const up = async (e) => {
        dragging.draggedEl.style.opacity = '';
        try { dragging.ghost.remove(); }catch{}
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
        try { document.body.classList.remove('grabbing'); } catch {}

        const src = dragging.srcContainer;
        const targetContainer = dragging.placeholder.parentElement;
        const targetIsPrimary = targetContainer === els.items;
        const fromList = loadList(dragging.srcListId);
        const toListId = targetIsPrimary ? currentListId : secondaryListId;
        const toList = toListId ? loadList(toListId) : null;
        // compute target index
        let index = 0;
        const nodes =  Array.from(targetContainer.querySelectorAll('.item:not(.placeholder):not(.dragging)'));

        const beforeNode = dragging.placeholder.nextElementSibling; // first real item after placeholder
        if (beforeNode && beforeNode.classList.contains('item')) {
          index = nodes.findIndex(n=>n===beforeNode);
        } else {
          index = nodes.length; // append
        }
        // mutate lists
        if (fromList) {
          const i = fromList.items.findIndex(x=>x.id===dragging.itemId);
          if (i>=0) {

            if (toList) {
              if (toList.id === fromList.id) {
                // same list
                const insertIndex = Math.min(index, toList.items.length);
                const [moved] = toList.items.splice(i,1);
                toList.items.splice(insertIndex, 0, moved);
                await saveList(toList);//saveは同期で行う
                if (toList.id===currentListId) { currentList = toList; renderItems(currentList, els.items, true); }
                if (toListId && toListId===secondaryListId) { const l2 = loadList(secondaryListId); if (l2) renderItems(l2, els.secondaryItems, true); }
              } else {
                const insertIndex = Math.min(index, toList.items.length);
                const [moved] = fromList.items.splice(i,1);
                toList.items.splice(insertIndex, 0, moved);
                //saveは同期で行う
                await saveList(fromList);
                await saveList(toList);
                if (fromList.id===currentListId) { currentList = fromList; renderItems(currentList, els.items, true); }
                if (toList.id===currentListId) { currentList = toList; renderItems(currentList, els.items, true); }
                if (secondaryListId) { const l2 = loadList(secondaryListId); if (l2) renderItems(l2, els.secondaryItems, true); }
              }
            }
          }

        }
        // cleanup
        dragging.draggedEl.classList.remove('dragging');

        document.querySelectorAll(".item, .checkbox-label .drag-handle").forEach(el1 => {
          el1.removeAttribute("data-draggable");
        });

        dragging.placeholder.remove();
        dragging = null;
      };

      function throttle(fn, wait) {
        let lastTime = 0;
        return function (...args) {
          const now = Date.now();
          if (now - lastTime >= wait) {
            lastTime = now;
            fn.apply(this, args);
          }
        };
      }

      const throttledMove = throttle(move, 200); // 0.2秒に1回
      document.addEventListener('pointermove', throttledMove);
      document.addEventListener('pointerup', up, { once: true });
    });
  }
  setupDnd(els.items);
  setupDnd(els.secondaryItems);

  // ---------- Bulk check/uncheck helpers ----------
  async function setAllChecked(list, checked) {
    list.items.forEach(it=>{ it.checked = !!checked; });
    // Bulk操作は saveState を無視して保存する可能性がある → ここでは保存する
    await saveList(list);
  }
  if (els.mainCheckAllBtn) on(els.mainCheckAllBtn, 'click', async ()=>{ if (!currentList) return; await setAllChecked(currentList, true); renderItems(currentList, els.items, true); });
  if (els.mainUncheckAllBtn) on(els.mainUncheckAllBtn, 'click', async ()=>{ if (!currentList) return; await setAllChecked(currentList, false); renderItems(currentList, els.items, true); });
  if (els.secondaryCheckAllBtn) on(els.secondaryCheckAllBtn, 'click', async ()=>{ if (!secondaryListId) return; const l=loadList(secondaryListId); if (!l) return; await setAllChecked(l, true); renderItems(l, els.secondaryItems, true); });
  if (els.secondaryUncheckAllBtn) on(els.secondaryUncheckAllBtn, 'click', async ()=>{ if (!secondaryListId) return; const l=loadList(secondaryListId); if (!l) return; await setAllChecked(l, false); renderItems(l, els.secondaryItems, true); });
  if (els.secondaryMakeMainBtn) on(els.secondaryMakeMainBtn, 'click', ()=>{ if (!secondaryListId) return; // swap main and secondary
    const sid = secondaryListId; const arr = [currentListId, ...visibleListIds.filter(id=>id && id!==sid)];
    currentListId = sid;
    visibleListIds = arr;
    selectList(currentListId);
    els.secondaryListSelect.value = visibleListIds[0] || '';
    secondaryListId = visibleListIds[0] || null;
    const l2 = secondaryListId? loadList(secondaryListId):null; if (l2) renderItems(l2, els.secondaryItems, true); else els.secondaryItems.innerHTML='';
    populateListSelects();
    //renderDynamicSubPanels();
  });

  // 既存のsecondaryListSelect handlerの上書き: URLにも反映し、描画更新
  // まず既存のリスナーを追加している箇所を上書きする意図で、ここでも設定
  on(els.secondaryListSelect, 'change', () => {
    secondaryListId = els.secondaryListSelect.value || null;
    // visibleListIds 先頭がセカンダリ
    if(secondaryListId){
      visibleListIds = [secondaryListId, ...visibleListIds.filter(id=>id && id!==secondaryListId)];
    }else{
      visibleListIds = [secondaryListId];
      secondaryListId = null;
    }

    const l2 = secondaryListId? loadList(secondaryListId):null; if (l2) renderItems(l2, els.secondaryItems, true); else els.secondaryItems.innerHTML='';
    //renderDynamicSubPanels();
    populateListSelects();
    reflectListsInUrl();
  });

  // ---------- Dynamic sub-panels (3rd,4th,...) ----------
  // delegate actions within dynamic panels
  if (els.grid) on(els.grid, 'click', async (ev)=>{
    const sec = ev.target.closest('.dynamic-sub');
    if (!sec) return;
    const id = sec.getAttribute('data-list-id');
    if (!id) return;
    const l = loadList(id); if (!l) return;
    if (ev.target.closest('[data-action="make-main"]')) {
      // move id to front
      visibleListIds = [id, ...visibleListIds.filter(x=>x!==id)];
      const oldMain = currentListId;
      currentListId = id;
      // place old main to list start
      visibleListIds = [oldMain, ...visibleListIds.filter(x=>x!==oldMain)];
      selectList(currentListId);
      els.secondaryListSelect.value = visibleListIds[0] || '';
      secondaryListId = visibleListIds[0] || null;
      const l2 = secondaryListId? loadList(secondaryListId):null; if (l2) renderItems(l2, els.secondaryItems, true); else els.secondaryItems.innerHTML='';
    } else if (ev.target.closest('[data-action="check-all"]')) {
      await setAllChecked(l, true);
    } else if (ev.target.closest('[data-action="uncheck-all"]')) {
      await setAllChecked(l, false);
    }
    reflectListsInUrl();
  });

  // 先頭文字が絵文字か判定（Unicode の Extended_Pictographic を使用）
  function extractLeadingEmoji(text) {
    if (!text) return null;
    try {
      const m = text.match(/^\p{Extended_Pictographic}+/u);
      return m ? m[0] : null;
    } catch(e) {
      // 古い環境で \p{} が使えない場合の簡易判定（絵文字範囲の目安）
      const m2 = text.match(/^([\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}])/u);
      return m2 ? m2[0] : null;
    }
  }

  /* ===================================================================
   File Import / Export + D&D support
   - Export: immediate uncompressed JSON of localStorage
   - Import: drag-and-drop or file select; shows existing import modal for confirmation
   - D&D will be ignored when document.body.classList.contains('grabbing')
   =================================================================== */
  (function () {
    'use strict';

    // helper
    function $id(id) { return document.getElementById(id); }
    function fmtFilenameDate(d) {
      const z = n => String(n).padStart(2,'0');
      return `${d.getFullYear()}${z(d.getMonth()+1)}${z(d.getDate())}_${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}`;
    }
    function safeJsonStringify(v) {
      try { return JSON.stringify(v, null, 2); } catch (e) { return String(v); }
    }

    // Export localStorage -> download
    function exportLocalStorageAsFile() {
      const data = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        // preserve exact stored string
        data[k] = localStorage.getItem(k);
      }
      const out = { exportedAt: new Date().toISOString(), data: data };
      const blob = new Blob([JSON.stringify(out)], { type: 'application/json' });
      const fn = 'checkbox_' + fmtFilenameDate(new Date()) + '.json';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fn;
      // append to body so click works in Firefox
      document.body.appendChild(a);
      a.click();
      a.remove();
      // cleanup
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }

    // Show existing import modal with parsed data and wire confirm to actually import
    function showImportConfirmation(parsedObject) {
      // Expect either { exportedAt: ..., data: { ... } } or plain object mapping
      const modal = $id('importModal');
      const backdrop = $id('importBackdrop');
      const preview = $id('importPreview');
      const summary = $id('importSummary');
      const nameOverride = $id('importNameOverride');
      const confirmBtn = $id('confirmImportBtn');

      if (!modal || !backdrop || !preview || !summary || !confirmBtn) {
        alert('インポート用モーダル要素が見つかりません。');
        return;
      }

      // determine data object
      const payload = (parsedObject && typeof parsedObject === 'object' && parsedObject.data && typeof parsedObject.data === 'object')
          ? parsedObject.data
          : (parsedObject && typeof parsedObject === 'object' ? parsedObject : null);

      if (!payload) {
        preview.textContent = 'ファイルの形式が認識できません。オブジェクト形式（JSON）が必要です。';
        summary.textContent = 'インポートできません。';
        // show modal briefly
        modal.classList.add('show');
        backdrop.classList.add('show');
        return;
      }

      // prepare preview & summary
      const keys = Object.keys(payload);
      summary.textContent = `このファイルをインポートすると、現在の localStorage を全て上書きします。キー数: ${keys.length}`;
      // show limited-size preview (but allow scroll)
      try {
        preview.textContent = safeJsonStringify(parsedObject).slice(0, 100000);
      } catch (e) {
        preview.textContent = '(プレビューを生成できません)';
      }
      if (nameOverride) nameOverride.value = ''; // default empty

      // show modal
      modal.classList.add('show');
      backdrop.classList.add('show');

      // on confirm: perform full import (clear localStorage then set)
      function onConfirmOnce(ev) {
        ev && ev.preventDefault();
        try {
          // fully replace localStorage
          localStorage.clear();
          for (const k of keys) {
            // store value as-is (string). If original export stored non-string values you may need to stringify here,
            // but typical export stored strings (because they came from localStorage.getItem).
            const v = payload[k];
            // ensure value is string
            localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
          }
        } catch (e) {
          console.error('Import failed', e);
          alert('インポートに失敗しました。コンソールを確認してください。');
          hideImportModal();
          return;
        }
        hideImportModal();
        // Reload as requested
        location.href = location.href;
      }

      // attach listener once
      confirmBtn.addEventListener('click', onConfirmOnce, { once: true });
    }

    function hideImportModal() {
      const modal = $id('importModal');
      const backdrop = $id('importBackdrop');
      if (modal) modal.classList.remove('show');
      if (backdrop) backdrop.classList.remove('show');
    }

    // Read a File object (assume JSON) and parse, then show confirmation modal
    function handleFileForImport(file) {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function (e) {
        let txt = e.target.result;
        try {
          const parsed = JSON.parse(txt);
          showImportConfirmation(parsed);
        } catch (err) {
          alert('JSON の解析に失敗しました: ' + err.message);
        }
      };
      reader.onerror = function () {
        alert('ファイルの読み込みに失敗しました。');
      };
      reader.readAsText(file, 'utf-8');
    }

    // Create hidden file input for manual selection (reused)
    const hiddenFileInput = document.createElement('input');
    hiddenFileInput.type = 'file';
    hiddenFileInput.accept = 'application/json,application/*,text/*';
    hiddenFileInput.style.display = 'none';
    hiddenFileInput.addEventListener('change', function (e) {
      const f = e.target.files && e.target.files[0];
      if (f) handleFileForImport(f);
      hiddenFileInput.value = '';
    });
    document.body.appendChild(hiddenFileInput);

    // Drag & Drop: only handle file drops and only when body is NOT .grabbing
    // Also avoid interfering with site internal D&D by checking dataTransfer.types includes 'Files'
    function onDragOver(e) {
      if (!e.dataTransfer) return;
      // if site dragging (body.grabbing) then ignore
      if (document.body.classList.contains('grabbing')) return;
      const types = e.dataTransfer.types ? Array.from(e.dataTransfer.types) : [];
      if (types.indexOf && types.indexOf('Files') !== -1) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }
    }

    function onDrop(e) {
      if (!e.dataTransfer) return;
      if (document.body.classList.contains('grabbing')) return;
      const files = e.dataTransfer.files;
      if (files && files.length) {
        e.preventDefault();
        // take first file
        const f = files[0];
        handleFileForImport(f);
      }
    }

    document.addEventListener('dragover', onDragOver, { passive: false });
    document.addEventListener('drop', onDrop, { passive: false });

    // Also add a visible small hint area (optional) — commented out by default.
    // If you want a visible drop target, uncomment the following block.
    /*
    const dropHint = document.createElement('div');
    dropHint.textContent = 'ここに JSON ファイルをドロップしてインポート';
    dropHint.style.position = 'fixed';
    dropHint.style.right = '16px';
    dropHint.style.bottom = '80px';
    dropHint.style.padding = '8px 12px';
    dropHint.style.borderRadius = '8px';
    dropHint.style.background = 'rgba(0,0,0,0.6)';
    dropHint.style.color = 'white';
    dropHint.style.fontSize = '13px';
    dropHint.style.zIndex = 1000;
    document.body.appendChild(dropHint);
    */

    // Provide an API if other scripts need to call export/import
    window.__checkbox_fileio = {
      exportLocalStorageAsFile,
      handleFileForImport,
      showImportConfirmation,
      hideImportModal
    };

  })();

  /* ===============================================================
   全バックアップ / 全復元 (個別インポートと競合しない独立モジュール)
   =============================================================== */
 (function () {
    'use strict';

    function $id(id) { return document.getElementById(id); }

    // ---------- 書き出し ----------
    function exportAll() {
      const obj = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        obj[k] = localStorage.getItem(k);
      }
      const wrap = { exportedAt: new Date().toISOString(), data: obj };
      const blob = new Blob([JSON.stringify(wrap, null, 2)], { type: 'application/json' });
      const d = new Date();
      const fn = `checkbox_${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}_${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}${String(d.getSeconds()).padStart(2,'0')}.json`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = fn;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    }

    // ---------- 読み込み処理 ----------
    function handleFileForImportAll(file) {
      const reader = new FileReader();
      reader.onload = e => {
        let parsed;
        try {
          parsed = JSON.parse(e.target.result);
        } catch (err) {
          alert('JSONとして読み込めません。');
          return;
        }
        showImportAllModal(parsed);
      };
      reader.readAsText(file, 'utf-8');
    }

    // ---------- モーダル表示 ----------
    function showImportAllModal(parsed) {
      const modal = $id('importAllModal');
      const backdrop = $id('importAllBackdrop');
      const preview = $id('importAllPreview');
      const confirmBtn = $id('confirmImportAllBtn');
      const cancelBtn = $id('cancelImportAllBtn');

      preview.textContent = JSON.stringify(parsed, null, 2).slice(0, 50000);

      modal.classList.add('show');
      backdrop.classList.add('show');

      cancelBtn.onclick = () => hide();

      confirmBtn.onclick = () => {
        hide();
        localStorage.clear();
        const data = parsed.data || parsed;
        for (const k in data) {
          localStorage.setItem(k, typeof data[k] === 'string' ? data[k] : JSON.stringify(data[k]));
        }

        const url = new URL(location.href);
        url.searchParams.delete('list');
        url.searchParams.delete('lists');
        history.replaceState(null, '', url);

        location.href = location.href;
      };

      function hide() {
        modal.classList.remove('show');
        backdrop.classList.remove('show');
      }
    }

    // ---------- ヘッダーボタン ----------
    const exportBtn = $id('exportAllBtn');
    const importBtn = $id('importAllBtn');

    const hiddenInput = document.createElement('input');
    hiddenInput.type = 'file';
    hiddenInput.accept = 'application/json';
    hiddenInput.style.display = 'none';
    document.body.appendChild(hiddenInput);
    hiddenInput.onchange = e => {
      const f = e.target.files[0];
      if (f) handleFileForImportAll(f);
      hiddenInput.value = '';
    };

    if (exportBtn) exportBtn.onclick = () => exportAll();
    if (importBtn) importBtn.onclick = () => hiddenInput.click();

    // ---------- Drag & Drop（body.grabbing のときは無効） ----------
    document.addEventListener('dragover', e => {
      if (document.body.classList.contains('grabbing')) return;
      if (e.dataTransfer.types && [...e.dataTransfer.types].includes('Files')) {
        e.preventDefault();
      }
    }, { passive: false });

    document.addEventListener('drop', e => {
      if (document.body.classList.contains('grabbing')) return;
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) {
        e.preventDefault();
        handleFileForImportAll(f);
      }
    }, { passive: false });

  })();

  /* ============================================================
    CSV エクスポート（ナゲット + モーダル + リアルタイム更新）
    追記: checkbox.js の末尾にそのまま追加してください
    ============================================================ */
  (function () {
    'use strict';

    function $id(id) { return document.getElementById(id); }
    function pad(n) { return String(n).padStart(2, '0'); }
    function filenameForCsv() {
      const d = new Date();
      return `checkbox_${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.csv`;
    }

    // loadList が Promise を返す場合も同期の場合も扱うユーティリティ
    async function getCurrentList() {
      if (typeof currentListId === 'undefined' || !currentListId) return null;
      try {
        const maybe = loadList(currentListId);
        if (maybe && typeof maybe.then === 'function') {
          return await maybe;
        }
        return maybe;
      } catch (e) {
        console.error('loadList error', e);
        return null;
      }
    }

    // CSV エスケープ（簡易）
    function csvEscapeCell(s) {
      if (s == null) return '';
      const str = String(s);
      if (str.indexOf('"') !== -1 || str.indexOf(',') !== -1 || str.indexOf('\n') !== -1) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }

    // list オブジェクト -> CSV 文字列 を生成
    // format: 'name_only' | 'true_false' | 'on_off' | 'checked_unchecked'
    function generateCsvFromList(list, format) {
      if (!list || !Array.isArray(list.items)) return '';
      const rows = [];
      // ヘッダ: 名前のみ または name,checked として出す
      if (format === 'name_only') {
        // header optional — 以下は名前のみでヘッダなしにする（ニーズに合わせて変更可）
        // rows.push('name');
        list.items.forEach(it => rows.push(csvEscapeCell(it.text)));
      } else {
        rows.push(['name','checked'].map(csvEscapeCell).join(','));
        list.items.forEach(it => {
          let state;
          const checked = !!it.checked;
          if (format === 'true_false') state = checked ? 'true' : 'false';
          else if (format === 'on_off') state = checked ? 'on' : 'off';
          else if (format === 'checked_unchecked') state = checked ? 'checked' : 'unchecked';
          else state = checked ? 'true' : 'false';
          rows.push([csvEscapeCell(it.text), csvEscapeCell(state)].join(','));
        });
      }
      return rows.join('\n');
    }

    // Blob URL とダウンロードリンクを更新
    function createCsvDownload(blobStr, filename) {
      const blob = new Blob([blobStr], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      return { url, filename };
    }

    // UI 要素
    const csvNudge = $id('csvNudge');
    const openCsvBtn = $id('openCsvBtn');
    const csvModal = $id('csvModal');
    const csvBackdrop = $id('csvBackdrop');
    const csvPreview = $id('csvPreview');
    const csvStateFormat = $id('csvStateFormat');
    const csvDownloadBtn = $id('csvDownloadBtn');

    // 内部状態
    let lastCsvBlobUrl = null;
    let lastCsvFilename = null;
    let lastGeneratedCsv = '';

    function showCsvNudge() { if (csvNudge) csvNudge.style.display = 'block'; }
    function hideCsvNudge() { if (csvNudge) csvNudge.style.display = 'none'; }

    async function openCsvModal() {
      if (csvModal) csvModal.classList.add('show');
      if (csvBackdrop) csvBackdrop.classList.add('show');
      await onCsvRequest()
    }
    function closeCsvModal() {
      if (csvModal) csvModal.classList.remove('show');
      if (csvBackdrop) csvBackdrop.classList.remove('show');
    }

    // モーダルの close ボタン（data-close="csv"）が押されたときに閉じる処理
    document.addEventListener('click', function (e) {
      const t = e.target;
      if (t && t.getAttribute && t.getAttribute('data-close') === 'csv') {
        closeCsvModal();
      }
    });

    on(els.copyBtn, 'click', async () => {
      try { await navigator.clipboard.writeText(lastGeneratedCsv); } catch(e) { /* ignore */ }
    })

    // CSV を生成してナゲット表示（csvBtn 押下、非同期対応）
    async function onCsvRequest() {
      const list = await getCurrentList();
      if (!list) {
        alert('現在のリストが選択されていないか読み込めません。');
        return;
      }
      const format = (csvStateFormat && csvStateFormat.value) ? csvStateFormat.value : 'true_false';
      const csv = generateCsvFromList(list, format);
      lastGeneratedCsv = csv;

      // 既存 Blob URL があれば解放
      if (lastCsvBlobUrl) {
        try { URL.revokeObjectURL(lastCsvBlobUrl); } catch (e) {}
        lastCsvBlobUrl = null;
      }
      const fn = filenameForCsv();
      const info = createCsvDownload(csv, fn);
      lastCsvBlobUrl = info.url;
      lastCsvFilename = info.filename;

      // プレビュー更新
      if (csvPreview) csvPreview.value = csv;

      // ダウンロードボタンを更新
      if (csvDownloadBtn) {
        csvDownloadBtn.onclick = function () {
          // create anchor and click
          const a = document.createElement('a');
          a.href = lastCsvBlobUrl;
          a.download = lastCsvFilename || fn;
          document.body.appendChild(a);
          a.click();
          a.remove();
        };
      }

      // ナゲット表示（ユーザー指定どおり）
      showCsvNudge();
    }

    // モーダル内のフォーマット切替を監視（リアルタイム更新）
    if (csvStateFormat) {
      csvStateFormat.addEventListener('change', async function () {
        // regenerate using the most recent list (or reload)
        const list = await getCurrentList();
        if (!list) return;
        const csv = generateCsvFromList(list, csvStateFormat.value);
        lastGeneratedCsv = csv;
        if (csvPreview) csvPreview.value = csv;
        // update blob URL and filename for download
        if (lastCsvBlobUrl) { try { URL.revokeObjectURL(lastCsvBlobUrl); } catch(e) {} lastCsvBlobUrl = null; }
        const info = createCsvDownload(csv, filenameForCsv());
        lastCsvBlobUrl = info.url;
        lastCsvFilename = info.filename;
        // update download handler
        if (csvDownloadBtn) {
          csvDownloadBtn.onclick = function () {
            const a = document.createElement('a');
            a.href = lastCsvBlobUrl;
            a.download = lastCsvFilename;
            document.body.appendChild(a);
            a.click();
            a.remove();
          };
        }
      });
    }

    // csvNudge の「開く」ボタンを押すとモーダルを開く
    if (openCsvBtn) openCsvBtn.addEventListener('click', function (e) {
      e && e.preventDefault();
      openCsvModal();
    });

    // モーダル外クリックで閉じる（backdrop）
    if (csvBackdrop) csvBackdrop.addEventListener('click', function () {
      closeCsvModal();
    });

    // ページ unload 前に Blob URL を解放
    window.addEventListener('beforeunload', function () {
      if (lastCsvBlobUrl) {
        try { URL.revokeObjectURL(lastCsvBlobUrl); } catch (e) {}
      }
    });

    // API（必要なら外部からも呼べる）
    window.__checkbox_csv = {
      generateCsvFromList,
      onCsvRequest,
      openCsvModal,
      closeCsvModal,
      showCsvNudge,
      hideCsvNudge
    };

  })();
})();
