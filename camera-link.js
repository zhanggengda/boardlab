/* Static-site WebRTC pairing. No public signaling service or long-lived secrets. */
(function (root) {
  'use strict';
  const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
  const PAIRING_TTL = 5 * 60 * 1000, TICKET_KEY = 'boardlab-phone-pairing-v1';
  function ticketStatus(ticket, now = Date.now()) {
    if (!ticket) return 'missing';
    if (typeof ticket.offer !== 'string' || ticket.offer.length > 24000 || !/^[\w-]+$/.test(ticket.offer) ||
        !Number.isSafeInteger(ticket.expires) || ticket.expires <= 0) return 'invalid';
    return now >= ticket.expires ? 'expired' : 'valid';
  }
  function parseTicket(input, baseURL) {
    if (typeof input !== 'string' || input.length > 26000) return null;
    let hash = input.trim();
    try {
      if (!hash.startsWith('#') && !hash.startsWith('offer=')) {
        const url = new URL(hash), base = new URL(baseURL);
        if (url.origin !== base.origin || url.pathname !== base.pathname) return null;
        hash = url.hash;
      }
      const params = new URLSearchParams(hash.replace(/^#/, ''));
      if (params.getAll('offer').length !== 1 || params.getAll('expires').length !== 1 || !/^\d+$/.test(params.get('expires'))) return null;
      return { offer: params.get('offer'), expires: Number(params.get('expires')) };
    } catch { return null; }
  }
  function createTicketStore(storage, baseURL, now = () => Date.now()) {
    const clear = () => { try { storage?.removeItem(TICKET_KEY); } catch { /* Storage is optional. */ } };
    const save = ticket => { if (ticketStatus(ticket, now()) !== 'valid') { clear(); return; }
      try { storage?.setItem(TICKET_KEY, JSON.stringify(ticket)); } catch { /* The current page still works without storage. */ } };
    return { clear, save, load(hash) {
      let ticket = null, restored = false;
      if (hash) { ticket = parseTicket(hash, baseURL); clear(); }
      else { try { ticket = JSON.parse(storage?.getItem(TICKET_KEY) || 'null'); restored = !!ticket; } catch { clear(); } }
      const status = hash && !ticket ? 'invalid' : ticketStatus(ticket, now());
      if (status === 'valid') save(ticket); else clear();
      return { ticket, status, restored };
    } };
  }
  async function encode(description) {
    const bytes = new TextEncoder().encode(JSON.stringify({ v: 1, type: description.type, sdp: description.sdp }));
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'));
    const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
    return btoa(String.fromCharCode(...compressed)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  }
  async function decode(code, type) {
    if (typeof code !== 'string' || code.length > 24000 || !/^[\w-]+$/.test(code)) throw new Error('配对码无效，请重新复制完整内容');
    const data = Uint8Array.from(atob(code.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0));
    const reader = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate')).getReader();
    const chunks = []; let size = 0;
    try { while (true) { const { value, done } = await reader.read(); if (done) break; size += value.length;
      if (size > 64000) throw new Error('配对码过大'); chunks.push(value); } } finally { await reader.cancel(); }
    const result = JSON.parse(await new Blob(chunks).text());
    if (result.v !== 1 || result.type !== type || typeof result.sdp !== 'string' || !result.sdp.startsWith('v=0')) throw new Error('配对码类型不正确');
    return { type: result.type, sdp: result.sdp };
  }
  function gather(pc) {
    if (pc.iceGatheringState === 'complete') return Promise.resolve();
    return new Promise((resolve, reject) => {
      const done = () => { if (pc.iceGatheringState === 'complete') finish(); };
      const timer = setTimeout(() => finish(), 6500);
      function finish() { clearTimeout(timer); pc.removeEventListener('icegatheringstatechange', done); resolve(); }
      pc.addEventListener('icegatheringstatechange', done);
      if (pc.signalingState === 'closed') { clearTimeout(timer); reject(new Error('连接已关闭')); }
    });
  }
  class Link {
    constructor(callbacks = {}) { this.callbacks = callbacks; this.pc = null; this.channel = null; this.generation = 0; this.expires = 0; }
    setup() {
      this.close();
      if (!root.RTCPeerConnection || !root.CompressionStream) throw new Error('请使用新版 Chrome、Edge 或 Safari 打开手机摄像头');
      const generation = this.generation, pc = this.pc = new RTCPeerConnection({ iceServers });
      pc.onconnectionstatechange = () => { if (pc === this.pc) this.callbacks.state?.(pc.connectionState); };
      pc.ontrack = e => { if (pc === this.pc) this.callbacks.stream?.(e.streams[0] || new MediaStream([e.track])); };
      pc.ondatachannel = e => this.attach(e.channel, generation);
      return pc;
    }
    attach(channel, generation) {
      this.channel = channel;
      channel.onopen = () => { if (generation === this.generation) this.callbacks.open?.(); };
      channel.onclose = () => { if (generation === this.generation) this.callbacks.closed?.(); };
      channel.onmessage = e => {
        if (generation !== this.generation || typeof e.data !== 'string' || e.data.length > 2048) return;
        try { const m = JSON.parse(e.data); this.callbacks.message?.(m); } catch { /* Ignore malformed control packets. */ }
      };
    }
    send(message) { if (this.channel?.readyState === 'open') this.channel.send(JSON.stringify(message)); }
    async offer() {
      const pc = this.setup();
      pc.addTransceiver('video', { direction: 'recvonly' });
      this.attach(pc.createDataChannel('k10-controls', { ordered: true }), this.generation);
      await pc.setLocalDescription(await pc.createOffer()); await gather(pc);
      if (pc !== this.pc) throw new Error('配对已取消');
      const code = await encode(pc.localDescription);
      if (pc !== this.pc) throw new Error('配对已取消');
      this.expires = Date.now() + PAIRING_TTL;
      return code;
    }
    async accept(code) {
      const pc = this.pc;
      if (!pc || Date.now() >= this.expires) throw new Error('配对已过期，请生成新二维码');
      if (pc.signalingState !== 'have-local-offer') throw new Error('此配对码已经使用，请生成新二维码');
      const description = await decode(code.trim(), 'answer');
      if (pc !== this.pc || Date.now() >= this.expires) throw new Error('配对已过期');
      await pc.setRemoteDescription(description);
    }
    async answer(code, stream) {
      const pc = this.setup();
      const description = await decode(code, 'offer');
      if (pc !== this.pc) throw new Error('连接已取消');
      await pc.setRemoteDescription(description);
      for (const track of stream.getVideoTracks()) pc.addTrack(track, stream);
      await pc.setLocalDescription(await pc.createAnswer()); await gather(pc);
      if (pc !== this.pc) throw new Error('连接已取消');
      return encode(pc.localDescription);
    }
    async replace(stream) {
      const sender = this.pc?.getSenders().find(s => s.track?.kind === 'video');
      if (!sender) throw new Error('连接已结束，请重新扫码');
      await sender.replaceTrack(stream.getVideoTracks()[0]);
    }
    close() { this.generation++; this.channel?.close(); this.channel = null; this.pc?.close(); this.pc = null; }
  }
  root.K10CameraLink = { Link, encode, decode, PAIRING_TTL, ticketStatus, parseTicket, createTicketStore };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.K10CameraLink;
})(globalThis);
