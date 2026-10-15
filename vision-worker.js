/* Tensor-only inference keeps video and the Blockly UI off the inference thread. */
'use strict';
// TensorFlow.js 1.x needs a canvas factory for its WebGL backend in a Worker.
// Video pixels still enter as a tensor; no DOM or camera is exposed here.
if (typeof OffscreenCanvas !== 'undefined') {
  self.window = self;
  self.document = { createElement: name => {
    if (name !== 'canvas') throw new Error('Only offscreen inference canvases are supported');
    return new OffscreenCanvas(1, 1);
  } };
}
importScripts('vendor/face-api/face-api.min.js');
const EmptyMedia = class {};
faceapi.env.setEnv({ Canvas: EmptyMedia, Image: EmptyMedia, Video: EmptyMedia,
  ImageData: EmptyMedia, fetch: self.fetch.bind(self), createCanvasElement: () => { throw new Error('Tensor-only engine'); } });
let ready;
function sharpness(pixels, width, height, box) {
  const gray = (x, y) => { const i = (y * width + x) * 4; return .299 * pixels[i] + .587 * pixels[i + 1] + .114 * pixels[i + 2]; };
  let sum = 0, square = 0, count = 0;
  const x0 = Math.max(1, Math.floor(box.x)), y0 = Math.max(1, Math.floor(box.y));
  const x1 = Math.min(width - 1, Math.ceil(box.x + box.width)), y1 = Math.min(height - 1, Math.ceil(box.y + box.height));
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const lap = 4 * gray(x, y) - gray(x - 1, y) - gray(x + 1, y) - gray(x, y - 1) - gray(x, y + 1);
    sum += lap; square += lap * lap; count++;
  }
  return count ? square / count - (sum / count) ** 2 : 0;
}
function initialize() {
  return ready ||= (async () => {
    let backend = 'cpu';
    try { if (typeof OffscreenCanvas !== 'undefined' && await faceapi.tf.setBackend('webgl')) backend = 'webgl'; }
    catch { /* Devices without worker WebGL use the CPU fallback. */ }
    if (backend === 'cpu') await faceapi.tf.setBackend('cpu');
    self.postMessage({ type: 'progress', message: backend === 'webgl' ? '人脸引擎已启用图形加速' : '人脸引擎使用 CPU，处理可能较慢' });
    const path = new URL('vendor/face-api/', self.location.href).href;
    for (const [index, net] of [faceapi.nets.ssdMobilenetv1, faceapi.nets.faceLandmark68TinyNet, faceapi.nets.faceRecognitionNet].entries()) {
      self.postMessage({ type: 'progress', message: `正在加载人脸模型 ${index + 1}/3…` });
      await net.loadFromUri(path);
    }
    self.postMessage({ type: 'progress', message: '正在预热人脸模型，首次启动可能需要十几秒…' });
    const warmup = faceapi.tf.zeros([240, 320, 3], 'int32');
    try {
      await faceapi.detectAllFaces(warmup, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.6, maxResults: 8 }));
      await faceapi.nets.faceLandmark68TinyNet.detectLandmarks(warmup);
      await faceapi.nets.faceRecognitionNet.computeFaceDescriptor(warmup);
    } finally { warmup.dispose(); }
  })().catch(error => { ready = null; throw error; });
}
self.onmessage = async ({ data }) => {
  let tensor;
  try {
    await initialize();
    if (data.type === 'init') { self.postMessage({ type: 'ready', id: data.id }); return; }
    const pixels = new Uint8Array(data.pixels);
    const rgb = new Int32Array(data.width * data.height * 3);
    for (let i = 0, j = 0; i < pixels.length; i += 4) { rgb[j++] = pixels[i]; rgb[j++] = pixels[i + 1]; rgb[j++] = pixels[i + 2]; }
    tensor = faceapi.tf.tensor3d(rgb, [data.height, data.width, 3], 'int32');
    const task = faceapi.detectAllFaces(tensor, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.6, maxResults: 8 })).withFaceLandmarks(true);
    const faces = await task;
    // Multiple people must never be enrolled or identified as a single person.
    if (data.descriptor && faces.length === 1) {
      const results = await new faceapi.ComputeAllFaceDescriptorsTask(Promise.resolve(faces), tensor);
      faces[0] = results[0];
    }
    self.postMessage({ type: 'result', id: data.id, faces: faces.map(f => ({
      box: { x: f.detection.box.x, y: f.detection.box.y, width: f.detection.box.width, height: f.detection.box.height },
      score: f.detection.score, sharpness: sharpness(pixels, data.width, data.height, f.detection.box), points: f.landmarks.positions.map(p => ({ x: p.x, y: p.y })),
      descriptor: f.descriptor ? Array.from(f.descriptor) : null
    })), tensors: faceapi.tf.memory().numTensors });
  } catch (error) { self.postMessage({ type: 'error', id: data.id, message: error.message }); }
  finally { tensor?.dispose(); }
};
