/* DQVC _list.txt generator
   Requirements satisfied:
   - Modern UI with predefined overlay and modal (no CLS)
   - Drag & drop across window with throttled overlay toggling (<= 2 changes/sec)
   - Multiple files, preview list with filename, exact bytes, dropdown (auction/quest/mes)
   - Generate _list.txt using control chars: \t and \r; join lines by \r\r with no trailing
   - Accept DnD .txt in the same format → dynamically reset items to parsed list
   - Only store metadata (id, name, size, kind); no file contents retained
   - Deletable items; reset state when empty
   - Confirmation modal if duplicate kinds exist on generate
*/

(() => {

  const listEl = document.getElementById('list');
  const dropzoneEl = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const overlayEl = document.getElementById('overlay');
  const genTop = document.getElementById('generate-top');
  const genBottom = document.getElementById('generate-bottom');
  const confirmModal = document.getElementById('confirm-modal');
  const duplicateCountsEl = document.getElementById('duplicate-counts');
  const confirmBtn = document.getElementById('confirm-generate');
  const cancelBtn = document.getElementById('cancel-generate');

  const KINDS = ['auction', 'quest', 'mes'];

  const state = {
    items: [], // { id, name, size, kind }
  };

  const genUUIDv4 = () => {
    // RFC4122 v4
    const buf = new Uint8Array(16);
    crypto.getRandomValues(buf);
    buf[6] = (buf[6] & 0x0f) | 0x40;
    buf[8] = (buf[8] & 0x3f) | 0x80;
    const toHex = (n) => n.toString(16).padStart(2, '0');
    const b = Array.from(buf, toHex);
    return `${b[0]}${b[1]}${b[2]}${b[3]}-${b[4]}${b[5]}-${b[6]}${b[7]}-${b[8]}${b[9]}-${b[10]}${b[11]}${b[12]}${b[13]}${b[14]}${b[15]}`;
  };

  function resetState() {
    state.items = [];
    render();
  }

  function render() {
    // Rebuild list
    listEl.innerHTML = '';
    const frag = document.createDocumentFragment();
    for (const item of state.items) {
      const row = document.createElement('div');
      row.className = 'row';
      row.dataset.id = item.id; // internal only, not exported

      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = item.name;
      name.title = item.name;

      const bytes = document.createElement('div');
      bytes.className = 'bytes';
      bytes.textContent = `${item.size}`; // exact bytes
      bytes.setAttribute('aria-label', `${item.size} bytes`);

      const select = document.createElement('select');
      select.className = 'kind';
      for (const k of KINDS) {
        const opt = document.createElement('option');
        opt.value = k; opt.textContent = k;
        if (k === item.kind) opt.selected = true;
        select.appendChild(opt);
      }
      select.addEventListener('change', () => {
        item.kind = select.value;
      });

      const del = document.createElement('button');
      del.className = 'delete-btn';
      del.type = 'button';
      del.title = '削除';
      del.setAttribute('aria-label', '削除');
      del.textContent = '×';
      del.addEventListener('click', () => {
        state.items = state.items.filter(it => it.id !== item.id);
        if (state.items.length === 0) {
          resetState();
        } else {
          render();
        }
      });

      row.appendChild(name);
      row.appendChild(bytes);
      row.appendChild(select);
      row.appendChild(del);
      frag.appendChild(row);
    }
    listEl.appendChild(frag);
  }

  function addMetaFromFilesLike(list) {
    // Accept FileList or Array<File>
    const files = Array.from(list || []);
    for (const f of files) {
      // Store only metadata
      state.items.push({ id: genUUIDv4(), name: f.name, size: f.size >>> 0, kind: 'auction' });
    }
    render();
  }

  function setOverlayVisible(show, force = false) {
    // Throttle changes to <= 2 per second
    const now = Date.now();
    if (!force && setOverlayVisible.lastChange && now - setOverlayVisible.lastChange < 500) {
      return; // ignore rapid toggles
    }
    setOverlayVisible.lastChange = now;
    if (show) {
      if (!overlayEl.classList.contains('show')) {
        overlayEl.classList.add('show');
        overlayEl.setAttribute('aria-hidden', 'false');
      }
    } else {
      if (overlayEl.classList.contains('show')) {
        overlayEl.classList.remove('show');
        overlayEl.setAttribute('aria-hidden', 'true');
      }
    }
  }

  function hideOverlayImmediate() {
    overlayEl.classList.remove('show');
    overlayEl.setAttribute('aria-hidden', 'true');
  }

  function parseListTxt(content) {
    // Expected: lines separated by CRCR (\r\r), each line: name\t\t(kind)\t\t\t(size)
    // Be tolerant to different line endings as well.
    if (typeof content !== 'string') return null;
    // Normalize to \r\r separators: split on two or more CR/LF groups
    const parts = content.split(/\r\r|\r\n\r\n|\n\n/g);
    if (parts.length === 0) return null;
    const out = [];
    for (const raw of parts) {
      const line = raw.trim();
      if (!line) continue; // ignore blank fragments
      const m = line.match(/^([^\t]+)\t\t(auction|quest|mes)\t\t\t(\d+)$/);
      if (!m) {
        return null;
      }
      const name = m[1];
      const kind = m[2];
      const size = Number(m[3]);
      if (!Number.isFinite(size) || size < 0) return null;
      out.push({ name, kind, size });
    }
    return out.length ? out : null;
  }

  async function handleDroppedFiles(fileList, isDnD) {
    const files = Array.from(fileList || []);
    if (isDnD) {
      // If any .txt is present and parse-able, reset to that content (ignore others)
      for (const f of files) {
        if (f.type === 'text/plain' || /\.txt$/i.test(f.name)) {
          try {
            const text = await f.text();
            const parsed = parseListTxt(text);
            if (parsed && parsed.length) {
              state.items = parsed.map(p => ({ id: genUUIDv4(), name: p.name, size: p.size >>> 0, kind: p.kind }));
              render();
              return; // done per requirement: reset from txt
            }
          } catch (_) {
            // Ignore and fall back to normal handling
          }
        }
      }
    }
    // Normal handling: add as items (metadata only)
    addMetaFromFilesLike(files);
  }

  function getDuplicateKindCounts() {
    const counts = Object.create(null);
    for (const it of state.items) counts[it.kind] = (counts[it.kind] || 0) + 1;
    const dups = Object.entries(counts).filter(([, c]) => c > 1);
    return { counts, duplicates: dups };
  }

  function showDuplicateModal(dups) {
    duplicateCountsEl.innerHTML = '';
    const ul = document.createElement('ul');
    for (const [k, c] of dups) {
      const li = document.createElement('li');
      li.textContent = `${k}: ${c}個`;
      ul.appendChild(li);
    }
    duplicateCountsEl.appendChild(ul);
    confirmModal.classList.add('show');
    confirmModal.setAttribute('aria-hidden', 'false');
  }

  function hideDuplicateModal() {
    confirmModal.classList.remove('show');
    confirmModal.setAttribute('aria-hidden', 'true');
  }

  function buildListTxt() {
    const TAB = '\t';
    const CR = '\r';
    const lines = state.items.map(it => `${it.name}${TAB}${TAB}${it.kind}${TAB}${TAB}${TAB}${it.size}`);
    return lines.join(`${CR}${CR}`);
  }

  function download(filename, text) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function attemptGenerate() {
    if (!state.items.length) return;
    const { duplicates } = getDuplicateKindCounts();
    if (duplicates.length) {
      showDuplicateModal(duplicates);
      attemptGenerate.pending = true;
      return;
    }
    const text = buildListTxt();
    download('_list.txt', text);
  }

  // Event wiring (async init)
  (async function init() {
    // File input
    fileInput.addEventListener('change', async (e) => {
      await handleDroppedFiles(e.target.files, /*isDnD*/ false);
      // clear input to allow re-select same files
      fileInput.value = '';
    });

    // Click label also triggers; no special handling

    // DnD overlay for whole window
    let dragCounter = 0;
    const onDragEnter = (e) => {
      e.preventDefault(); e.stopPropagation();
      dragCounter++;
      setOverlayVisible(true);
    };
    const onDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setOverlayVisible(true); };
    const onDragLeave = (e) => {
      e.preventDefault(); e.stopPropagation();
      dragCounter = Math.max(0, dragCounter - 1);
      if (dragCounter === 0) setOverlayVisible(false);
    };
    const onDrop = async (e) => {
      e.preventDefault(); e.stopPropagation();
      dragCounter = 0;
      hideOverlayImmediate();
      const files = e.dataTransfer?.files;
      if (files && files.length) await handleDroppedFiles(files, /*isDnD*/ true);
    };
    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);

    // Also allow dropping directly on dropzone
    dropzoneEl.addEventListener('dragover', (e) => { e.preventDefault(); });
    dropzoneEl.addEventListener('drop', onDrop);

    // Generate buttons
    genTop.addEventListener('click', attemptGenerate);
    genBottom.addEventListener('click', attemptGenerate);

    // Modal actions
    cancelBtn.addEventListener('click', () => {
      hideDuplicateModal();
      attemptGenerate.pending = false;
    });
    confirmBtn.addEventListener('click', () => {
      hideDuplicateModal();
      attemptGenerate.pending = false;
      const text = buildListTxt();
      download('_list.txt', text);
    });

    // Keyboard escape to close modal/overlay
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        hideDuplicateModal();
        hideOverlayImmediate();
      }
    });
  })();
    let dragAliveTimer = null;

    const showOverlay = () => {

    };

    const hideOverlay = () => {
        overlayEl.classList.remove('show');
        overlayEl.setAttribute('aria-hidden', 'true');
    };

    document.addEventListener("dragenter", (e) => {
        e.preventDefault();
        showOverlay();
    });

    document.addEventListener("dragover", (e) => {
        e.preventDefault();
        showOverlay();

        // dragover が来続ける限り延命する
        if (dragAliveTimer) clearTimeout(dragAliveTimer);
        dragAliveTimer = setTimeout(() => {
            hideOverlay();
            dragAliveTimer = null;
        }, 200);
    });

    document.addEventListener("dragleave", (e) => {
        e.preventDefault();
        // OS DnD では信用できないので何もしない
    });

    document.addEventListener("drop", (e) => {
        e.preventDefault();
        hideOverlay();
    });

})();
