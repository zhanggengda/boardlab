/* Shared, model-independent K10 vision contracts. */
(function (root) {
  'use strict';
  const MODEL = 'face-api-0.22.2-ssd68-resnet128-v1';
  const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
  function validDescriptor(value) {
    return Array.isArray(value) && value.length === 128 && value.every(Number.isFinite);
  }
  function fit(width, height, targetWidth = 240, targetHeight = 320) {
    const scale = Math.min(targetWidth / width, targetHeight / height);
    return { scale, ox: (targetWidth - width * scale) / 2, oy: (targetHeight - height * scale) / 2 };
  }
  function mapFace(face, width, height) {
    if (!face || !width || !height) return null;
    const { scale, ox, oy } = fit(width, height);
    const point = p => ({ x: p.x * scale + ox, y: p.y * scale + oy });
    const points = (face.points || []).map(point);
    const eye = start => points.length >= 68 ? {
      x: points.slice(start, start + 6).reduce((sum, p) => sum + p.x, 0) / 6,
      y: points.slice(start, start + 6).reduce((sum, p) => sum + p.y, 0) / 6 } : { x: 0, y: 0 };
    const left = eye(36), right = eye(42), nose = points[30] || {x:0,y:0}, mouthLeft = points[48] || {x:0,y:0}, mouthRight = points[54] || {x:0,y:0};
    return { width: face.box.width * scale, height: face.box.height * scale,
      x: (face.box.x + face.box.width / 2) * scale + ox,
      y: (face.box.y + face.box.height / 2) * scale + oy,
      box: { x: face.box.x * scale + ox, y: face.box.y * scale + oy,
        width: face.box.width * scale, height: face.box.height * scale },
      leftEyeX: left.x, leftEyeY: left.y, rightEyeX: right.x, rightEyeY: right.y,
      noseX: nose.x, noseY: nose.y, leftMouthX: mouthLeft.x, leftMouthY: mouthLeft.y,
      rightMouthX: mouthRight.x, rightMouthY: mouthRight.y, points };
  }
  class Results {
    constructor() { this.reset(); }
    reset() { this.id = -1; this.complete = false; }
    finish(id = -1) { this.id = id; this.complete = true; }
    readComplete() { const value = this.complete; this.complete = false; return value; }
    readId() { const value = this.id; this.id = -1; return value; }
  }
  class ProfileBook {
    constructor(saved) { this.profiles = []; this.revision = 0; if (saved) this.restore(saved); }
    restore(saved) {
      if (saved.model !== MODEL) throw new Error('人脸模型版本已变化，请遗忘旧档案后重新学习');
      if (!Array.isArray(saved.profiles) || saved.profiles.length > 48) throw new Error('本机人脸档案损坏，请遗忘后重新学习');
      const ids = new Set();
      for (const p of saved.profiles) {
        if (!Number.isInteger(p.id) || p.id < 1 || p.id > 48 || ids.has(p.id) ||
          !Array.isArray(p.samples) || !p.samples.length || p.samples.length > 3 || !p.samples.every(validDescriptor)) throw new Error('本机人脸档案损坏，请遗忘后重新学习');
        ids.add(p.id);
      }
      this.profiles = structuredClone(saved.profiles);
    }
    snapshot() { return { model: MODEL, profiles: structuredClone(this.profiles) }; }
    match(descriptor, threshold = 0.5) {
      if (!validDescriptor(descriptor)) throw new Error('人脸特征无效');
      const matches = this.profiles.map(p => ({ id: p.id,
        distance: p.samples.reduce((sum, s) => sum + distance(s, descriptor), 0) / p.samples.length })).sort((a, b) => a.distance - b.distance);
      const best = matches[0];
      return best && best.distance <= threshold && (!matches[1] || matches[1].distance - best.distance >= 0.06) ? best.id : -1;
    }
    learn(samples) {
      if (samples.length !== 3 || !samples.every(validDescriptor)) throw new Error('需要三个有效的新鲜人脸样本');
      if (samples.some(s => distance(s, samples[0]) > 0.35)) throw new Error('采样时人脸变化过大，请保持同一人正对摄像头');
      const matches = samples.map(s => this.match(s));
      const existing = matches.every(id => id > 0 && id === matches[0]) ? matches[0] : -1;
      if (existing < 0 && matches.some(id => id > 0)) throw new Error('身份不稳定，请调整光线后重新学习');
      const id = existing > 0 ? existing : Array.from({ length: 48 }, (_, i) => i + 1).find(i => !this.profiles.some(p => p.id === i));
      if (!id) throw new Error('已学习 48 张人脸，请先遗忘一个档案');
      this.profiles = this.profiles.filter(p => p.id !== id);
      this.profiles.push({ id, samples: structuredClone(samples) }); this.revision++;
      return id;
    }
    forget(id) { this.profiles = this.profiles.filter(p => p.id !== id); this.revision++; }
    clear() { this.profiles = []; this.revision++; }
  }
  function bindButton(element, dispatch) {
    let pointer = null, keyboard = false;
    const release = () => { if (pointer !== null || keyboard) { pointer = null; keyboard = false; element.classList.remove('pressed'); dispatch('UP'); } };
    element.addEventListener('pointerdown', e => { if (pointer !== null || e.button > 0) return; e.preventDefault(); pointer = e.pointerId; element.setPointerCapture?.(pointer); element.classList.add('pressed'); dispatch('DOWN'); });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) element.addEventListener(event, release);
    element.addEventListener('keydown', e => { if (![' ', 'Enter'].includes(e.key)) return; e.preventDefault(); if (!keyboard) { keyboard = true; element.classList.add('pressed'); dispatch('DOWN'); } });
    element.addEventListener('keyup', e => { if ([' ', 'Enter'].includes(e.key)) { e.preventDefault(); release(); } });
    element.addEventListener('blur', release);
    // Assistive technology can emit a click without pointer/keyboard events.
    element.addEventListener('click', e => { if (e.detail === 0 && !keyboard && pointer === null) { dispatch('DOWN'); dispatch('UP'); } });
    return release;
  }
  const api = { MODEL, distance, validDescriptor, fit, mapFace, Results, ProfileBook, bindButton };
  root.K10VisionCore = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
