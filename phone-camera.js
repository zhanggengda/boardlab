(function () {
  'use strict';
  const el = id => document.getElementById(id), video = el('phoneVideo');
  let storage; try { storage = sessionStorage; } catch { /* Pairing still works until this page reloads. */ }
  const tickets = K10CameraLink.createTicketStore(storage, location.href), initial = tickets.load(location.hash);
  // Remove the ticket from history; this tab can restore an unconsumed ticket until its original expiry.
  history.replaceState(null, '', location.pathname + location.search);
  let stream = null, facing = 'user', link = null, generation = 0, starting = false, paired = false, wakeLock = null;
  let pairing = initial.ticket, pairingReady = false, pairingFailure = initial.status, preparing = 0;
  const releases = [], volumeTimers = new Map(), heldTimers = new Map();
  function status(message) { el('phoneStatus').textContent = message; }
  function pairingError(value) {
    return value === 'expired' ? '配对码已过期。请在电脑点击“重新生成二维码”，再用手机扫描新码。' :
      value === 'invalid' ? '配对链接不完整或无效。请复制电脑显示的完整“手机链接”，粘贴到下方。' :
      '此页面没有配对码。请扫描电脑新生成的二维码，或在下方粘贴完整“手机链接”。';
  }
  function showPairingError(value) {
    pairingReady = false; pairingFailure = value; tickets.clear(); el('phoneStart').disabled = el('phoneSwitch').disabled = true;
    el('phonePairing').open = true; el('phonePairingTime').textContent = ''; status(pairingError(value));
  }
  function updatePairingTime() {
    if (!pairingReady || paired) return;
    if (K10CameraLink.ticketStatus(pairing) !== 'valid') { end(false); showPairingError('expired'); return; }
    const seconds = Math.ceil((pairing.expires - Date.now()) / 1000);
    el('phonePairingTime').textContent = `请在 ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} 内将返回码粘贴到电脑并确认连接`;
  }
  async function preparePairing(info) {
    const request = ++preparing; pairingReady = false;
    el('phoneStart').disabled = el('phoneSwitch').disabled = true;
    if (info.status !== 'valid') { showPairingError(info.status); return; }
    status('正在检查配对信息…');
    try {
      await K10CameraLink.decode(info.ticket.offer, 'offer');
      if (request !== preparing) return;
      if (K10CameraLink.ticketStatus(info.ticket) !== 'valid') { showPairingError('expired'); return; }
      pairing = info.ticket; tickets.save(pairing); pairingReady = true;
      el('phoneStart').disabled = el('phoneSwitch').disabled = false; el('phonePairing').open = false;
      status(info.restored ? '已恢复此标签页的有效配对信息。点击开启摄像头，再把新返回码粘贴到电脑。' : '配对信息已就绪。点击开启摄像头，再将返回码粘贴到电脑确认。');
      updatePairingTime();
    } catch { if (request === preparing) showPairingError('invalid'); }
  }
  function button(name, phase) {
    if (phase === 'UP') { clearInterval(heldTimers.get(name)); heldTimers.delete(name); }
    if (!paired || link?.channel?.readyState !== 'open') { if (phase === 'DOWN') status('请先在电脑确认连接，再使用 A/B 按钮'); return; }
    link.send({ type: 'button', button: name, phase });
    clearInterval(heldTimers.get(name)); heldTimers.delete(name);
    if (phase === 'DOWN') heldTimers.set(name, setInterval(() => link?.send({ type: 'button', button: name, phase: 'DOWN' }), 1000));
  }
  function releaseAll() { releases.forEach(release => release());
    for (const [name, timer] of volumeTimers) { clearTimeout(timer); button(name, 'UP'); } volumeTimers.clear();
    for (const [name, timer] of heldTimers) { clearInterval(timer); link?.send({ type: 'button', button: name, phase: 'UP' }); } heldTimers.clear(); }
  async function keepAwake() { try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* Optional: manual screen-on remains supported. */ } }
  function pause(notify = true) {
    generation++; releaseAll(); stream?.getTracks().forEach(t => t.stop()); stream = null; video.srcObject = null;
    wakeLock?.release().catch(() => {}); wakeLock = null;
    if (notify) link?.send({ type: 'pause' }); status('拍摄已暂停，点击“开启 / 恢复摄像头”继续');
  }
  function end(notify = true, discard = true) {
    pause(false); if (notify) link?.send({ type: 'end' }); link?.close(); link = null; paired = false;
    if (discard) { preparing++; tickets.clear(); pairing = null; pairingReady = false; el('phonePairingTime').textContent = '';
      el('phoneStart').disabled = el('phoneSwitch').disabled = true; el('phonePairing').open = true; }
    el('phoneReturn').hidden = true; el('phoneAnswer').value = ''; status('连接已结束，请从电脑生成新二维码');
  }
  async function start(switching = false) {
    if (starting) return;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { status('请使用 HTTPS 地址，在系统 Chrome 或 Safari 中打开'); return; }
    if (!paired && (!pairingReady || K10CameraLink.ticketStatus(pairing) !== 'valid')) { showPairingError(pairingReady ? K10CameraLink.ticketStatus(pairing) : pairingFailure); return; }
    starting = true; const ticket = ++generation;
    const old = stream;
    try {
      // Mobile browsers often cannot open two camera devices at once.
      old?.getTracks().forEach(t => t.stop()); stream = null;
      const incoming = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 20 } }, audio: false });
      if (ticket !== generation) { incoming.getTracks().forEach(t => t.stop()); return; }
      stream = incoming; video.srcObject = incoming; video.style.transform = facing === 'user' ? 'scaleX(-1)' : '';
      await video.play();
      if (ticket !== generation) return;
      if (link?.pc && ['failed', 'closed'].includes(link.pc.connectionState)) throw new Error('连接已失效，请重新扫码');
      if (link?.pc) { await link.replace(incoming); link.send({ type: 'resumed' }); status('拍摄中 · A/B 功能由电脑积木定义'); }
      else {
        const connection = link = new K10CameraLink.Link({
          open: () => { if (connection !== link) return; paired = true; tickets.clear(); el('phonePairingTime').textContent = '已完成配对 · 刷新或结束连接后须从电脑生成新码'; el('phoneReturn').hidden = true; status('已连接电脑 · A/B 功能由电脑积木定义'); },
          closed: () => { if (connection === link) { end(false); status('电脑连接已断开，请重新扫码'); } },
          state: value => { if (connection !== link) return; if (['failed', 'disconnected'].includes(value)) { end(false); status('连接中断，请重新扫码；跨网络可能需要中继服务'); } },
          message: m => { if (connection !== link) return;
            if (m.type === 'pause') pause(false);
            if (m.type === 'end') end(false);
            if (m.type === 'resume-request') status('电脑请求恢复拍摄，请点击“开启 / 恢复摄像头”');
            if (m.type === 'status' && typeof m.message === 'string' && m.message.length <= 180) status(m.message);
          }
        });
        const answer = await connection.answer(pairing.offer, incoming);
        if (ticket !== generation || link !== connection) return;
        if (K10CameraLink.ticketStatus(pairing) !== 'valid') { end(false); showPairingError('expired'); return; }
        el('phoneAnswer').value = answer; el('phoneReturn').hidden = false;
        status('请将返回码粘贴到电脑，并在电脑确认连接');
      }
      await keepAwake();
    } catch (e) {
      if (ticket !== generation) return;
      stream?.getTracks().forEach(t => t.stop()); stream = null; video.srcObject = null;
      if (!paired) { link?.close(); link = null; }
      status(e.name === 'NotAllowedError' ? '未获得摄像头权限，请允许后重试' : switching ? '切换失败，请点击“开启 / 恢复”重试' : e.message || '摄像头开启失败，请重试');
    } finally { starting = false; }
  }
  el('phoneStart').onclick = () => start();
  el('phoneApplyPairing').onclick = async () => {
    if (starting) return;
    const ticket = K10CameraLink.parseTicket(el('phonePairLink').value, location.href);
    const value = ticket ? K10CameraLink.ticketStatus(ticket) : 'invalid';
    if (value !== 'valid') { status(pairingError(value)); return; }
    // Validate before replacing a working connection.
    try { await K10CameraLink.decode(ticket.offer, 'offer'); } catch { status(pairingError('invalid')); return; }
    end(); el('phonePairLink').value = ''; await preparePairing({ ticket, status: value });
  };
  el('phoneSwitch').onclick = () => { if (starting) return; facing = facing === 'user' ? 'environment' : 'user'; start(true); };
  el('phonePause').onclick = () => pause(); el('phoneEnd').onclick = () => end();
  el('phoneCopy').onclick = async () => { try { await navigator.clipboard.writeText(el('phoneAnswer').value); status('返回码已复制，请发送或粘贴到电脑'); } catch { el('phoneAnswer').select(); status('请长按返回码，选择复制'); } };
  document.querySelectorAll('[data-phone-key]').forEach(key => releases.push(K10VisionCore.bindButton(key, phase => button(key.dataset.phoneKey, phase))));
  document.addEventListener('keydown', e => {
    if (!el('phoneVolume').checked || e.repeat || !['AudioVolumeUp', 'AudioVolumeDown', 'VolumeUp', 'VolumeDown'].includes(e.key)) return;
    e.preventDefault(); const name = e.key.endsWith('Up') ? 'A' : 'B'; button(name, 'DOWN');
    clearTimeout(volumeTimers.get(name)); volumeTimers.set(name, setTimeout(() => { button(name, 'UP'); volumeTimers.delete(name); }, 180));
    el('phoneVolumeStatus').textContent = '已收到音量键事件；系统音量仍可能同时变化';
  });
  document.addEventListener('keyup', e => { if (['AudioVolumeUp', 'AudioVolumeDown', 'VolumeUp', 'VolumeDown'].includes(e.key)) {
    const name = e.key.endsWith('Up') ? 'A' : 'B'; clearTimeout(volumeTimers.get(name)); volumeTimers.delete(name); button(name, 'UP'); } });
  el('phoneVolume').onchange = () => { releaseAll(); el('phoneVolumeStatus').textContent = '此浏览器尚未报告音量键事件；如果无反应，请使用屏幕 A/B 按钮'; };
  window.addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  window.addEventListener('pagehide', () => end(true, false));
  window.addEventListener('pageshow', e => { if (e.persisted) preparePairing(tickets.load('')); });
  window.addEventListener('hashchange', () => {
    if (!location.hash) return;
    const info = tickets.load(location.hash);
    history.replaceState(null, '', location.pathname + location.search);
    end(); preparePairing(info);
  });
  setInterval(updatePairingTime, 1000);
  preparePairing(initial);
})();
