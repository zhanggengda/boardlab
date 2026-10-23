(() => {
  'use strict';
  const mimeByExtension = { png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', webp:'image/webp', gif:'image/gif', bmp:'image/bmp' };
  const supported = /^image\/(png|jpeg|webp|gif|bmp|x-ms-bmp)$/i;
  let active = null;

  function readableError(message) { return Object.assign(new Error(message), { imageInput: true }); }
  function validateFile(file, maxBytes) {
    const mime = file.type || mimeByExtension[file.name?.split('.').pop().toLowerCase()] || '';
    if (!supported.test(mime)) throw readableError('请拖入 PNG、JPG、WebP、GIF 或 BMP 图片。');
    if (!file.size) throw readableError('图片内容为空，请重新复制或选择图片。');
    if (file.size > maxBytes) throw readableError(`请选择 ${Math.round(maxBytes / 1024 / 1024)} MB 以内的图片。`);
    return file;
  }
  function imageUrl(value) {
    try {
      const url = new URL(value);
      if (url.username || url.password) return '';
      if (['http:', 'https:', 'blob:'].includes(url.protocol) || /^data:image\/(png|jpeg|webp|gif|bmp|x-ms-bmp)[;,]/i.test(value)) return url.href;
    } catch {}
    return '';
  }
  function sourceFromTransfer(transfer) {
    if (!transfer) return null;
    const files = [...(transfer.files || [])];
    if (!files.length) for (const item of transfer.items || []) {
      if (item.kind === 'file') { const file = item.getAsFile(); if (file) files.push(file); }
    }
    if (files.length) return { file: files.find(file => /^image\//i.test(file.type) || mimeByExtension[file.name?.split('.').pop().toLowerCase()]) || files[0] };
    const get = type => transfer.getData?.(type) || '';
    const html = get('text/html');
    if (html) {
      // Template content stays inert: do not insert third-party HTML into the page.
      const template = document.createElement('template'); template.innerHTML = html.slice(0, 200000);
      const src = template.content.querySelector('img')?.getAttribute('src');
      const url = src && imageUrl(src); if (url) return { url };
    }
    for (const type of ['text/uri-list', 'text/plain']) {
      const value = get(type).split(/\r?\n/).find(line => line.trim() && !line.startsWith('#'))?.trim();
      const url = value && imageUrl(value); if (url) return { url };
    }
    return null;
  }
  function hasTransfer(transfer) {
    return [...(transfer?.types || [])].some(type => ['Files', 'text/html', 'text/uri-list', 'text/plain'].includes(type));
  }
  async function fileFromUrl(url, maxBytes, signal) {
    let response;
    try { response = await fetch(url, { mode:'cors', credentials:'omit', referrerPolicy:'no-referrer', signal }); }
    catch (error) {
      if (error.name === 'AbortError') throw error;
      throw readableError('来源网站不允许读取或图片暂不可用。请复制图片后按 Ctrl+V，或先保存图片再拖入。');
    }
    if (!response.ok) throw readableError('图片地址暂不可用，请复制图片后粘贴，或先保存再拖入。');
    if (Number(response.headers.get('content-length')) > maxBytes) {
      await response.body?.cancel();
      throw readableError(`请选择 ${Math.round(maxBytes / 1024 / 1024)} MB 以内的图片。`);
    }
    const chunks = []; let size = 0;
    if (response.body) {
      const reader = response.body.getReader();
      try {
        while (true) {
          const { value, done } = await reader.read(); if (done) break;
          size += value.byteLength;
          if (size > maxBytes) { await reader.cancel(); throw readableError(`请选择 ${Math.round(maxBytes / 1024 / 1024)} MB 以内的图片。`); }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
    } else { chunks.push(await response.arrayBuffer()); }
    let name = '拖入的图片.png';
    if (/^https?:/i.test(url)) {
      try { name = decodeURIComponent(new URL(url).pathname.split('/').pop()) || name; } catch {}
    }
    const type = response.headers.get('content-type')?.split(';')[0].trim() || mimeByExtension[name.split('.').pop().toLowerCase()] || '';
    return validateFile(new File(chunks, name.slice(0, 180), { type }), maxBytes);
  }

  function bind({ target, input, maxBytes, load, apply, onError, onBusy = () => {}, isActive = () => true }) {
    active?.dispose();
    let disposed = false, revision = 0, controller = null, dragDepth = 0;
    const listeners = [];
    const current = ticket => !disposed && ticket === revision && target.isConnected && isActive();
    const listen = (element, type, handler, options) => {
      element.addEventListener(type, handler, options);
      listeners.push(() => element.removeEventListener(type, handler, options));
    };
    const busy = value => { target.setAttribute('aria-busy', String(value)); onBusy(value); };
    async function importSource(source) {
      const ticket = ++revision; controller?.abort(); controller = new AbortController();
      const request = controller;
      const timer = setTimeout(() => request.abort(), 15000);
      onError(''); busy(true);
      try {
        const file = source.file ? validateFile(source.file, maxBytes) : await fileFromUrl(source.url, maxBytes, request.signal);
        if (!current(ticket)) return;
        const result = await load(file);
        if (current(ticket)) apply(result, file);
      } catch (error) {
        if (current(ticket)) onError(error.name === 'AbortError' ? '导入超时，请重试，或复制图片后粘贴。'
          : error.imageInput ? error.message : '图片无法打开，请更换图片，或先保存到本地再拖入。');
      } finally { clearTimeout(timer); if (current(ticket)) busy(false); }
    }
    listen(input, 'change', () => { const file = input.files?.[0]; input.value = ''; if (file) void importSource({ file }); });
    listen(target, 'dragenter', event => { if (hasTransfer(event.dataTransfer)) { event.preventDefault(); dragDepth++; target.classList.add('image-input-dragging'); } });
    listen(target, 'dragover', event => { if (hasTransfer(event.dataTransfer)) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; } });
    listen(target, 'dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; target.classList.remove('image-input-dragging'); } });
    listen(target, 'drop', event => {
      event.preventDefault(); event.stopPropagation(); dragDepth = 0; target.classList.remove('image-input-dragging');
      const source = sourceFromTransfer(event.dataTransfer);
      if (source) void importSource(source); else onError('未找到可读取的图片，请复制图片后按 Ctrl+V，或先保存再拖入。');
    });
    listen(document, 'paste', event => {
      if (disposed || !target.isConnected || !isActive()) return;
      const source = sourceFromTransfer(event.clipboardData); if (!source) return;
      // Keep normal text/number pasting in editable fields.
      if (!source.file && event.target?.matches?.('input:not([readonly]),textarea,[contenteditable="true"]')) return;
      event.preventDefault(); event.stopPropagation(); void importSource(source);
    }, true);
    for (const type of ['dragover', 'drop']) listen(document, type, event => { if (hasTransfer(event.dataTransfer)) event.preventDefault(); });
    const observer = new MutationObserver(() => { if (!target.isConnected) binding.dispose(); });
    observer.observe(document.body, { childList: true });
    const binding = { dispose() {
      if (disposed) return; disposed = true; revision++; controller?.abort();
      listeners.forEach(remove => remove()); observer.disconnect(); target.classList.remove('image-input-dragging');
      if (active === binding) active = null;
    } };
    active = binding;
    return binding;
  }
  window.BoardlabImageInput = { bind };
})();
