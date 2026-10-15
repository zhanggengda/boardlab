(function () {
  'use strict';
  const core = K10VisionCore, book = new core.ProfileBook(), results = new core.Results();
  const state = { source: 'simulation', sourceEpoch: 0, programEpoch: 0, requestId: 0, archiveEpoch: 0,
    show: false, mode: '人脸检测', stream: null, video: null, lastFrame: -Infinity, frameId: 0,
    face: null, faceAt: -Infinity, faces: [], busy: false, command: null, worker: null, inference: null,
    modelReady: false, load: null, drawing: null, qr: null, status: '选择摄像头来源，开始真实人脸识别', db: null,
    archiveError: '', saveQueue: Promise.resolve(), controls: [], link: null, suspended: false, learnTransaction: null };
  let sequence = 0, pollTimer = null, renderFrame = null, frameCallback = null, pairingTimer = null;
  const remoteReleaseTimers = new Map();
  const el = id => document.getElementById(id);
  function status(message, report = false) {
    state.status = message; if (el('visionStatus')) el('visionStatus').textContent = message;
    if (report && typeof log === 'function' && state.lastReported !== message) { log('人脸识别', message); state.lastReported = message; }
    if (report) { state.noticeUntil = performance.now() + 3000; state.link?.send({ type: 'status', message: message.slice(0, 180) }); }
  }
  function updateProfiles() {
    const select = el('visionForgetId'); if (!select) return;
    const previous = select.value; select.replaceChildren();
    for (const p of [...book.profiles].sort((a, b) => a.id - b.id)) {
      const option = document.createElement('option'); option.value = p.id; option.textContent = `人脸 ID ${p.id}`; select.append(option);
    }
    if ([...select.options].some(o => o.value === previous)) select.value = previous;
    if (el('visionCount')) el('visionCount').textContent = `本机已学习 ${book.profiles.length}/48 张人脸`;
    el('visionForget').disabled = !book.profiles.length;
  }
  const ready = new Promise(resolve => {
    const request = indexedDB.open('boardlab-k10-faces', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('archives');
    request.onerror = () => { state.archiveError = '浏览器未允许保存人脸档案，请检查网站存储权限'; status(state.archiveError); resolve(); };
    request.onsuccess = () => {
      state.db = request.result;
      const read = state.db.transaction('archives').objectStore('archives').get('faces');
      read.onsuccess = () => { try { if (read.result) book.restore(read.result); } catch (e) { state.archiveError = e.message; status(e.message); } updateProfiles(); resolve(); };
      read.onerror = () => { state.archiveError = '本机人脸档案读取失败'; status(state.archiveError); resolve(); };
    };
  });
  function persist(snapshot = book.snapshot(), valid = null) {
    const write = () => new Promise((resolve, reject) => {
      if (!state.db) { reject(new Error('浏览器未允许保存人脸档案')); return; }
      if (valid && !valid()) { reject(new Error('学习任务已取消')); return; }
      const tx = state.db.transaction('archives', 'readwrite'); tx.objectStore('archives').put(snapshot, 'faces');
      if (valid) state.learnTransaction = tx;
      const release = () => { if (state.learnTransaction === tx) state.learnTransaction = null; };
      tx.oncomplete = () => { release(); resolve(); }; tx.onerror = tx.onabort = () => { release(); reject(new Error('本机人脸档案保存失败或学习任务已取消')); };
    });
    const saved = state.saveQueue = state.saveQueue.catch(() => {}).then(write);
    updateProfiles(); return saved;
  }
  function invalidate() {
    cancelLearningSave();
    state.sourceEpoch++; state.requestId++; results.reset(); state.face = null; state.faces = []; state.faceAt = -Infinity;
    state.lastFrame = -Infinity; state.command = null; state.busy = false;
    if (state.inference) { clearTimeout(state.inference.timeout); state.inference.reject(new Error('摄像头来源已改变')); state.inference = null; }
    // A worker executing an old source must not block a fresh source.
    state.worker?.terminate(); state.worker = null; state.modelReady = false; state.load = null;
  }
  function cancelLearningSave() { try { state.learnTransaction?.abort(); } catch { /* A committed transaction is already complete. */ } state.learnTransaction = null; }
  function workerRequest(message, transfer = []) {
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      const timeout = setTimeout(() => { if (state.inference?.id !== id) return;
        state.inference = null; state.worker?.terminate(); state.worker = null; state.modelReady = false; state.load = null;
        reject(new Error('人脸模型处理超时，请重新开启摄像头')); }, message.type === 'init' ? 60000 : 15000);
      state.inference = { id, resolve, reject, timeout };
      state.worker.postMessage({ ...message, id }, transfer);
    });
  }
  async function loadModels() {
    if (state.modelReady) return;
    return state.load ||= (async () => {
      const worker = state.worker = new Worker('vision-worker.js?v=34.0');
      worker.onmessage = ({ data }) => {
        if (worker !== state.worker) return;
        if (data.type === 'progress') { status(data.message); return; }
        const pending = state.inference; if (!pending || pending.id !== data.id) return;
        clearTimeout(pending.timeout); state.inference = null;
        data.type === 'error' ? pending.reject(new Error(data.message)) : pending.resolve(data);
      };
      worker.onerror = () => {
        const pending = state.inference; if (!pending || worker !== state.worker) return;
        clearTimeout(pending.timeout); state.inference = null; pending.reject(new Error('人脸模型启动失败，请刷新重试'));
      };
      try { await workerRequest({ type: 'init' }); if (worker === state.worker) state.modelReady = true; }
      catch (error) { worker.terminate(); if (worker === state.worker) { state.worker = null; state.load = null; } throw error; }
    })();
  }
  function fresh() { return state.video && !state.suspended && performance.now() - state.lastFrame < 500 && state.video.readyState >= 2; }
  function currentFace() {
    return state.source !== 'simulation' && state.mode === '人脸检测' && fresh() && performance.now() - state.faceAt < 1000 ? state.face : null;
  }
  function stopFrameWatch() { if (frameCallback !== null) state.video?.cancelVideoFrameCallback?.(frameCallback); frameCallback = null; }
  function watchFrames(video, epoch) {
    stopFrameWatch();
    if (video.requestVideoFrameCallback) {
      const next = () => { if (state.video !== video || epoch !== state.sourceEpoch) return;
        if (!state.suspended) { state.lastFrame = performance.now(); state.frameId++; }
        frameCallback = video.requestVideoFrameCallback(next); };
      frameCallback = video.requestVideoFrameCallback(next);
    } else {
      let previous = -1;
      video._visionCheck = () => { if (epoch !== state.sourceEpoch) return;
        if (video.currentTime !== previous && !video.paused && !state.suspended) { previous = video.currentTime; state.lastFrame = performance.now(); state.frameId++; } };
    }
  }
  async function attachStream(stream, epoch) {
    if (epoch !== state.sourceEpoch) { stream.getTracks().forEach(t => t.stop()); return; }
    state.stream = stream; state.suspended = false;
    state.video ||= document.createElement('video'); const video = state.video;
    video.autoplay = true; video.playsInline = true; video.muted = true; video.srcObject = stream;
    const preview = el('visionPreview'); preview?.replaceChildren(video);
    for (const track of stream.getTracks()) {
      track.addEventListener('ended', () => { if (state.stream === stream) { state.suspended = true; state.face = null; status('画面已中断，请重新开启摄像头'); } });
    }
    watchFrames(video, epoch);
    try { await video.play(); } catch { status('点击“开启 / 恢复”开始预览'); }
    status('摄像头已连接 · 模型准备中');
    startRender(); scheduleDetection();
    try { await loadModels(); if (epoch === state.sourceEpoch) status('摄像头已就绪 · 学习前请保持单人正对画面'); }
    catch (e) { if (epoch === state.sourceEpoch) status(e.message, true); }
  }
  async function start() {
    if (state.source === 'simulation') return;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { status('摄像头需要 HTTPS 或电脑 localhost，请从安全地址打开'); return; }
    if (state.source === 'phone') {
      if (!state.link?.pc) { status('先点击“连接手机”，用手机扫码配对'); return; }
      if (state.suspended) { state.link.send({ type: 'resume-request' }); status('请在手机点击“开启 / 恢复摄像头”'); }
      else if (state.video) { await state.video.play().catch(() => {}); startRender(); scheduleDetection(); }
      return;
    }
    if (state.stream?.active && !state.suspended) { await state.video?.play().catch(() => {}); return; }
    invalidate(); const epoch = state.sourceEpoch;
    status('正在请求摄像头权限…');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 20 }, facingMode: 'user' }, audio: false });
      await attachStream(stream, epoch);
    } catch (e) { if (epoch === state.sourceEpoch) status(e.name === 'NotAllowedError' ? '未获得摄像头权限，请允许后点击“开启 / 恢复”重试' : '无法打开摄像头，请检查是否被其他应用占用', true); }
  }
  function stop(end = false) {
    state.programEpoch++; state.show = false; state.qr = null; stopFrameWatch();
    clearTimeout(pollTimer); pollTimer = null; cancelAnimationFrame(renderFrame); renderFrame = null;
    if (state.source === 'phone' && !end && state.link?.pc) {
      state.suspended = true; state.link.send({ type: 'pause' });
    } else { state.stream?.getTracks().forEach(t => t.stop()); state.stream = null;
      if (state.video) state.video.srcObject = null;
      state.link?.send({ type: 'end' }); state.link?.close(); state.link = null;
      clearPhonePairing(); if (el('visionPairDetails')) el('visionPairDetails').hidden = true;
    }
    invalidate(); state.suspended = true; state.controls.forEach(release => release());
    remoteReleaseTimers.forEach(clearTimeout); remoteReleaseTimers.clear(); button('A', 'UP'); button('B', 'UP');
    status(state.source === 'simulation' ? '模拟输入 · 使用虚拟输入中的人脸数据' : '摄像头已暂停，点击“开启 / 恢复”继续');
  }
  function selectSource(source) {
    stop(true); state.source = source; state.drawing = null; state.suspended = false;
    results.reset(); if (el('visionPhonePair')) el('visionPhonePair').hidden = source !== 'phone';
    status(source === 'simulation' ? '模拟输入 · 使用虚拟输入中的人脸数据' : '点击“开启 / 恢复”授权摄像头；连接不会自动运行积木');
  }
  function token() { return [state.programEpoch, state.sourceEpoch, state.requestId, state.archiveEpoch, state.mode].join(':'); }
  async function infer(descriptor = false) {
    await loadModels();
    if (!fresh()) throw new Error('没有新鲜画面，请开启摄像头并保持页面在前台');
    if (state.inference) throw new Error('人脸引擎正忙，请稍后重试');
    const canvas = document.createElement('canvas'), video = state.video;
    const scale = Math.min(1, 320 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale)); canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const started = performance.now(), epoch = state.sourceEpoch, frameId = state.frameId;
    const output = await workerRequest({ type: 'frame', pixels: pixels.buffer, width: canvas.width, height: canvas.height, descriptor }, [pixels.buffer]);
    if (epoch !== state.sourceEpoch || !fresh()) throw new Error('摄像头画面已失效');
    if (performance.now() - started > 1000) throw new Error('识别结果超过 1 秒，已丢弃；请使用性能更好的电脑');
    state.faces = output.faces; state.faceAt = started;
    const largest = [...output.faces].sort((a, b) => b.box.width * b.box.height - a.box.width * a.box.height)[0];
    state.face = core.mapFace(largest, canvas.width, canvas.height);
    return { faces: output.faces, frameId };
  }
  function scheduleDetection() {
    if (pollTimer !== null) return;
    pollTimer = setTimeout(async () => {
      pollTimer = null; if (!state.stream || state.suspended || state.source === 'simulation') return;
      const epoch = state.sourceEpoch;
      state.video?._visionCheck?.();
      if (state.mode === '人脸检测' && fresh() && !state.busy && !state.inference) {
        try { await infer(); if (!state.busy && !(performance.now() < state.noticeUntil)) status(state.faces.length ? `检测到 ${state.faces.length} 张人脸${state.faces.length > 1 ? ' · 学习和识别需要单人画面' : ''}` : '没有检测到人脸，请调整距离和光线'); }
        catch (e) { if (epoch === state.sourceEpoch && !state.busy) status(e.message); }
      } else if (!fresh() && performance.now() - state.lastFrame > 2000) { state.face = null; status('画面中断，请保持手机亮屏或重新开启摄像头'); }
      if (epoch === state.sourceEpoch) scheduleDetection();
    }, 180);
  }
  function ensureCanvas() {
    const lcd = el('lcdContent'); if (!lcd) return null;
    let canvas = lcd.querySelector(':scope > .k10-vision-canvas');
    if (!canvas) { canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 320; canvas.className = 'k10-vision-canvas'; lcd.replaceChildren(canvas); }
    return canvas;
  }
  function paint() {
    if (!state.show) return;
    const canvas = ensureCanvas(); if (!canvas) return;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#0d1724'; ctx.fillRect(0, 0, 240, 320);
    if (fresh() && state.video.videoWidth) {
      const { scale, ox, oy } = core.fit(state.video.videoWidth, state.video.videoHeight);
      ctx.drawImage(state.video, ox, oy, state.video.videoWidth * scale, state.video.videoHeight * scale);
    } else { ctx.fillStyle = '#ffffff'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('请开启 / 恢复摄像头', 120, 160); }
    if (state.drawing) ctx.drawImage(state.drawing, 0, 0);
    const face = currentFace();
    if (face) { const b = face.box; ctx.strokeStyle = '#20cfaf'; ctx.lineWidth = 2; ctx.strokeRect(b.x, b.y, b.width, b.height); }
    if (state.qr) ctx.drawImage(state.qr, 0, 0);
  }
  function snapshot() {
    if (!fresh() || !state.video.videoWidth) return null;
    const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 320;
    const ctx = canvas.getContext('2d'), { scale, ox, oy } = core.fit(state.video.videoWidth, state.video.videoHeight);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 240, 320);
    ctx.drawImage(state.video, ox, oy, state.video.videoWidth * scale, state.video.videoHeight * scale);
    return canvas;
  }
  function startRender() {
    if (renderFrame !== null) return;
    const frame = () => { renderFrame = null; state.video?._visionCheck?.();
      if (state.show && typeof getScreenBuffer === 'function' && !(typeof screenFrameDeferred !== 'undefined' && screenFrameDeferred) && !window.K10Vision?.debugPaused?.()) setDrawing(getScreenBuffer());
      paint(); if (state.stream && !state.suspended) renderFrame = requestAnimationFrame(frame); };
    renderFrame = requestAnimationFrame(frame);
  }
  function setDrawing(frame) { state.drawing ||= document.createElement('canvas'); state.drawing.width = 240; state.drawing.height = 320; state.drawing.getContext('2d').drawImage(frame, 0, 0); }
  function show(value) {
    const changed = !state.show && value;
    state.show = value;
    if (value) {
      if (changed && typeof getScreenBuffer === 'function') { getScreenBuffer().getContext('2d').clearRect(0, 0, 240, 320); state.drawing = null; }
      paint(); startRender(); start();
    } else { state.drawing = null; if (typeof publishScreenFrame === 'function') publishScreenFrame(getScreenBuffer()); }
  }
  function mode(value) { cancelLearningSave(); state.mode = value; state.requestId++; state.command = null; state.busy = false; state.face = null; state.faces = []; results.reset();
    if (value !== '人脸检测' && state.source !== 'simulation') status('真实摄像头当前支持人脸检测与身份识别；其他 AI 模式请使用模拟输入', true); }
  function single(faces) {
    if (faces.length !== 1) throw new Error(faces.length ? '画面中有多张人脸，请只保留一人' : '没有检测到人脸，请正对摄像头');
    const face = faces[0];
    if (face.score < 0.75 || Math.min(face.box.width, face.box.height) < 40) throw new Error('人脸太小或不够清晰，请靠近并改善光线');
    if (typeof face.sharpness === 'number' && face.sharpness < 8) throw new Error('人脸画面模糊，请保持不动并让摄像头对焦');
    if (!core.validDescriptor(face.descriptor)) throw new Error('未得到有效人脸特征');
    return face.descriptor;
  }
  async function command(kind) {
    if (state.busy) { if (state.command !== kind) status('人脸引擎正忙，请等当前操作完成后重试', true); return; }
    if (state.source === 'simulation') { status('学习与识别演示按钮需要真实摄像头；模拟数据请用积木程序'); return; }
    if (state.mode !== '人脸检测') { status('请先切换为人脸检测模式', true); return; }
    state.busy = true; state.command = kind; state.requestId++; results.reset(); const ticket = token();
    try {
      await ready; if (state.archiveError) throw new Error(state.archiveError);
      // Let an already-running detector finish before the command takes the engine.
      while (state.inference) { await new Promise(r => setTimeout(r, 25)); if (ticket !== token()) return; }
      if (ticket !== token()) return;
      status(kind === 'learn' ? '正在学习，请保持单人正对画面…' : '正在识别人脸…');
      const samples = []; let lastFrame = -1;
      for (let i = 0; i < (kind === 'learn' ? 3 : 1); i++) {
        const until = performance.now() + 2000;
        while (state.frameId === lastFrame) { if (performance.now() > until) throw new Error('没有新的摄像头画面'); await new Promise(r => setTimeout(r, 30)); if (ticket !== token()) return; }
        const output = await infer(true); if (ticket !== token()) return;
        samples.push(single(output.faces)); lastFrame = output.frameId;
      }
      if (ticket !== token()) return;
      if (kind === 'learn') {
        const candidate = new core.ProfileBook(book.snapshot());
        const id = candidate.learn(samples);
        await persist(candidate.snapshot(), () => ticket === token());
        if (ticket !== token()) return;
        book.restore(candidate.snapshot()); book.revision++; updateProfiles();
        status(`已学习人脸 ID ${id} · 特征保存在本机浏览器`, true);
      } else { const id = book.match(samples[0]); results.finish(id); if (el('visionIdentity')) el('visionIdentity').textContent = id > 0 ? `最近识别：人脸 ID ${id}` : '最近识别：未知人脸（ID -1）'; status(id > 0 ? `识别完成 · 人脸 ID ${id}` : '识别完成 · 未知人脸（ID -1）', true); }
    } catch (e) { if (ticket === token()) { if (kind === 'recognize') results.finish(-1); status(e.message, true); } }
    finally { if (ticket === token()) { state.busy = false; state.command = null; } }
  }
  async function forget(id = null) {
    cancelLearningSave();
    state.archiveEpoch++; state.requestId++; state.busy = false; state.command = null; results.reset();
    if (el('visionIdentity')) el('visionIdentity').textContent = '已遗忘 · 等待重新识别';
    await ready; id === null ? book.clear() : book.forget(Number(id));
    try { await persist(); state.archiveError = ''; status(id === null ? '已遗忘本机全部人脸档案' : `已遗忘人脸 ID ${id}`, true); }
    catch (e) { status(e.message, true); }
  }
  function button(name, phase) { if (typeof currentBoard !== 'undefined' && currentBoard === 'k10' && typeof triggerButton === 'function') triggerButton(name, phase, true); }
  function clearPhonePairing(message = '') {
    clearInterval(pairingTimer); pairingTimer = null;
    if (el('visionPairLink')) el('visionPairLink').value = '';
    if (el('visionAnswer')) el('visionAnswer').value = '';
    if (el('visionPairQR')) el('visionPairQR').replaceChildren();
    if (el('visionPairTime')) el('visionPairTime').textContent = message;
    if (el('visionAccept')) el('visionAccept').disabled = true;
    if (el('visionCopyLink')) el('visionCopyLink').disabled = true;
    if (el('visionPair')) { el('visionPair').disabled = false; el('visionPair').textContent = '重新生成二维码 / 更换设备'; }
  }
  function watchPhonePairing(link) {
    const update = () => {
      if (state.link !== link) { clearInterval(pairingTimer); pairingTimer = null; return; }
      if (link.pc?.signalingState !== 'have-local-offer') { clearPhonePairing('返回码已确认，正在建立连接…'); return; }
      const seconds = Math.ceil((link.expires - Date.now()) / 1000);
      if (seconds <= 0) {
        stop(true); el('visionPairDetails').hidden = false;
        el('visionPairTime').textContent = '配对码已过期，请点击“重新生成二维码”，让手机扫描新码。';
        status('配对码已过期，请重新生成二维码'); return;
      }
      el('visionPairTime').textContent = `配对剩余 ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} · 电脑请保持此页面打开`;
    };
    update(); pairingTimer = setInterval(update, 1000);
  }
  async function pairPhone() {
    stop(true); state.source = 'phone'; state.suspended = false; status('正在生成手机配对码…');
    el('visionPair').disabled = true;
    const link = state.link = new K10CameraLink.Link({
      stream: stream => { if (link === state.link) attachStream(stream, state.sourceEpoch); },
      state: value => { if (link !== state.link) return;
        if (['failed', 'disconnected', 'closed'].includes(value)) { state.suspended = true; state.face = null; state.controls.forEach(r => r()); status('手机连接中断，请重新配对；受限或跨网络可能需要中继服务'); }
        if (value === 'connected') { clearPhonePairing('手机已连接 · 更换设备时请生成新二维码'); status('手机已连接 · 可在手机使用 A/B 按钮'); } },
      closed: () => { if (link === state.link) { button('A', 'UP'); button('B', 'UP'); } },
      message: m => { if (link !== state.link) return;
        if (m.type === 'button' && ['A', 'B'].includes(m.button) && ['DOWN', 'UP'].includes(m.phase)) {
          button(m.button, m.phase);
          clearTimeout(remoteReleaseTimers.get(m.button)); remoteReleaseTimers.delete(m.button);
          if (m.phase === 'DOWN') remoteReleaseTimers.set(m.button, setTimeout(() => { button(m.button, 'UP'); remoteReleaseTimers.delete(m.button); }, 2500));
        }
        if (m.type === 'pause') { cancelLearningSave(); state.suspended = true; state.face = null; state.requestId++; state.busy = false; results.reset(); button('A', 'UP'); button('B', 'UP'); status('手机摄像头已暂停，请在手机恢复'); }
        if (m.type === 'resumed') { state.suspended = false; watchFrames(state.video, state.sourceEpoch); startRender(); scheduleDetection(); status('手机摄像头已恢复'); }
        if (m.type === 'end') { stop(true); status('手机已结束连接'); }
      }
    });
    try {
      const offer = await link.offer(); if (state.link !== link) return;
      const url = new URL('phone-camera.html', location.href); url.hash = new URLSearchParams({ offer, expires: link.expires }).toString();
      el('visionPairLink').value = url.href; el('visionAnswer').value = ''; el('visionPairQR').replaceChildren();
      try { new QRCode(el('visionPairQR'), { text: url.href, width: 210, height: 210, correctLevel: QRCode.CorrectLevel.L }); }
      catch { el('visionPairQR').textContent = '配对信息较长，请复制下面的手机链接'; }
      el('visionPairDetails').hidden = false; el('visionAccept').disabled = el('visionCopyLink').disabled = false;
      el('visionPair').disabled = false; el('visionPair').textContent = '重新生成二维码 / 更换设备';
      watchPhonePairing(link); status('手机扫描新码并开启摄像头后，把返回码粘贴到这里确认连接。若手机提示缺少配对码，请复制完整手机链接。');
    } catch (e) { if (state.link === link) { stop(true); status(e.message, true); } }
  }
  function install() {
    const host = document.querySelector('.sim-panel'); if (!host) return;
    const panel = document.createElement('section'); panel.className = 'vision-panel'; panel.id = 'visionPanel';
    panel.innerHTML = `<header><strong>摄像头与人脸识别</strong><span id="visionCount">本机已学习 0/48 张人脸</span></header>
      <label class="vision-source">视觉来源<select id="visionSource"><option value="simulation">模拟输入</option><option value="computer">本机摄像头（电脑 / 手机）</option><option value="phone">手机摄像头 → 电脑</option></select></label>
      <div class="vision-preview" id="visionPreview"><span>连接只预览画面，K10 显示由积木控制</span></div>
      <p id="visionStatus" role="status" aria-live="polite"></p><p id="visionIdentity">尚未识别身份</p>
      <div class="vision-actions"><button id="visionStart" type="button">开启 / 恢复</button><button id="visionEnd" type="button">结束连接</button></div>
      <div class="vision-keys"><button type="button" data-vision-key="A"><b>A</b><span>虚拟按键</span></button><button type="button" data-vision-key="B"><b>B</b><span>虚拟按键</span></button></div>
      <small>与主板 A/B 按键相同，功能由积木程序定义。载入“人脸识别”示例后，A 学习、B 遗忘全部。</small>
      <details><summary>直接体验人脸学习 / 识别</summary><p>首次学习会在本机保存人脸特征，不保存照片或视频。工程文件不包含这些特征。</p>
        <label class="vision-consent"><input type="checkbox" id="visionConsent">允许在本机保存人脸特征</label>
        <div class="vision-actions"><button id="visionLearn" type="button">学习当前人脸</button><button id="visionRecognize" type="button">识别一次</button></div>
        <div class="vision-actions"><select id="visionForgetId" aria-label="要遗忘的人脸 ID"></select><button id="visionForget" type="button" disabled>遗忘所选</button><button id="visionForgetAll" type="button">遗忘全部</button></div></details>
      <div id="visionPhonePair" hidden><button id="visionPair" type="button">连接手机 / 更换设备</button><div id="visionPairDetails" hidden><p id="visionPairTime" class="pairing-time"></p><div id="visionPairQR"></div><label>手机链接<textarea id="visionPairLink" readonly></textarea></label><button id="visionCopyLink" type="button" disabled>复制完整手机链接</button><label>手机返回码<textarea id="visionAnswer" placeholder="粘贴手机页面生成的返回码"></textarea></label><button id="visionAccept" type="button" disabled>确认连接这台手机</button></div><small>手机须能访问当前网站。首版适合同一 Wi-Fi；未配置 TURN，不保证跨网络连接。</small></div>`;
    host.querySelector('.sensor-panel')?.before(panel);
    el('visionSource').onchange = e => selectSource(e.target.value);
    el('visionStart').onclick = () => start(); el('visionEnd').onclick = () => stop(true);
    el('visionConsent').onchange = () => {};
    el('visionLearn').onclick = () => enroll(); el('visionRecognize').onclick = () => command('recognize');
    el('visionForget').onclick = () => forget(Number(el('visionForgetId').value)); el('visionForgetAll').onclick = () => forget();
    el('visionPair').onclick = pairPhone;
    el('visionCopyLink').onclick = async () => { try { await navigator.clipboard.writeText(el('visionPairLink').value); status('完整手机链接已复制，可发送到手机打开或粘贴到手机页的配对入口'); } catch { el('visionPairLink').select(); status('请选择手机链接的全部内容并复制'); } };
    el('visionAccept').onclick = async () => {
      const link = state.link; if (!link) { status('请先生成新二维码'); return; }
      el('visionAccept').disabled = true;
      try { await link.accept(el('visionAnswer').value); if (state.link === link) { clearPhonePairing('返回码已确认，正在建立连接…'); status('正在连接手机…'); } }
      catch (e) { if (state.link === link) { el('visionAccept').disabled = false; status(e.message, true); } }
    };
    panel.querySelectorAll('[data-vision-key]').forEach(key => state.controls.push(core.bindButton(key, phase => button(key.dataset.visionKey, phase))));
    status(state.status); updateProfiles();
    const observer = new MutationObserver(() => { const hide = typeof currentBoard !== 'undefined' && currentBoard !== 'k10' || typeof currentMode !== 'undefined' && currentMode !== 'virtual'; panel.hidden = hide; });
    observer.observe(host, { attributes: true, attributeFilter: ['aria-label'] });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelLearningSave(); state.controls.forEach(r => r()); state.face = null; state.requestId++; state.busy = false; results.reset(); } });
    window.addEventListener('blur', () => state.controls.forEach(r => r()));
    window.addEventListener('pagehide', () => stop(true));
  }
  function enroll() { if (!el('visionConsent')?.checked) { const details = el('visionConsent')?.closest('details'); if (details) details.open = true; status('学习前请勾选“允许在本机保存人脸特征”', true); return; } return command('learn'); }
  window.K10Vision = { state, book, results, ready, install, start, stop, show, mode, command, enroll, forget, currentFace, snapshot,
    isReal: () => state.source !== 'simulation', displaying: () => state.show,
    publish: frame => { if (!state.show) return false; setDrawing(frame); paint(); return true; },
    qr: canvas => { state.qr = canvas; paint(); }, debugPaused: () => typeof runtimeDebugger !== 'undefined' && runtimeDebugger?.paused,
    reset: () => { state.programEpoch++; state.requestId++; state.busy = false; state.command = null; state.face = null; results.reset(); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
})();
