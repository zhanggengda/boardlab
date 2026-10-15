// K10 Arduino C++ preview. Only mappings checked against the official K10 SDK
// are emitted; unsupported blocks make the preview explicitly non-compilable.
function generateK10Arduino(workspace) {
  const issues = [];
  const setup = [];
  const loop = [];
  const images = [];
  let usesMusic = false;
  let usesSD = false;
  let repeatIndex = 0;
  const field = (block, name) => block.getFieldValue(name);
  const number = (block, name) => Number(field(block, name)) || 0;
  const color = value => `0x${String(value || '#000000').replace('#', '').toUpperCase()}`;
  const quote = value => JSON.stringify(String(value ?? ''));
  const unsupported = block => {
    const name = block.toString?.().replace(/\s+/g, ' ').slice(0, 64) || block.type;
    issues.push(`${name}：尚无已核对的 K10 Arduino C++ 生成规则`);
  };
  const child = (block, name) => block.getInputTargetBlock(name);
  const value = (block, name, fallback = '0') => {
    const target = child(block, name);
    return target ? expression(target) : fallback;
  };
  function expression(block) {
    const f = name => field(block, name);
    const v = (name, fallback) => value(block, name, fallback);
    switch (block.type) {
      case 'math_number': return String(number(block, 'NUM'));
      case 'text': return quote(f('TEXT'));
      case 'logic_boolean': return f('BOOL') === 'TRUE' ? 'true' : 'false';
      case 'logic_negate': return `!(${v('BOOL', 'false')})`;
      case 'logic_operation': return `(${v('A', 'false')} ${f('OP') === 'AND' ? '&&' : '||'} ${v('B', 'false')})`;
      case 'logic_compare': {
        const op = { EQ: '==', NEQ: '!=', LT: '<', LTE: '<=', GT: '>', GTE: '>=' }[f('OP')];
        return `(${v('A')} ${op || '=='} ${v('B')})`;
      }
      case 'math_arithmetic': {
        const op = { ADD: '+', MINUS: '-', MULTIPLY: '*', DIVIDE: '/' }[f('OP')];
        if (!op) break;
        return `(${v('A')} ${op} ${v('B')})`;
      }
      case 'k10_light': return 'k10.readALS()';
      case 'k10_environment': if (f('SENSOR') === 'light') return 'k10.readALS()'; break;
      case 'k10_acceleration': return ({ x: 'k10.getAccelerometerX()', y: 'k10.getAccelerometerY()', z: 'k10.getAccelerometerZ()', strength: 'k10.getStrength()' })[f('AXIS')] || '0';
      case 'k10_button_state': {
        const a = 'k10.buttonA->isPressed()', b = 'k10.buttonB->isPressed()', ab = 'k10.buttonAB->isPressed()';
        if (f('STATE') === 'UP') return `!(${f('BUTTON') === 'A+B' ? ab : f('BUTTON') === 'B' ? b : a})`;
        return f('BUTTON') === 'A+B' ? ab : f('BUTTON') === 'B' ? `((${b}) && !(${a}))` : `((${a}) && !(${b}))`;
      }
      case 'rgb_brightness_get': return 'k10.rgb->brightness()';
    }
    unsupported(block);
    return '0 /* unsupported value */';
  }
  function chain(block, depth = 1) {
    const lines = [];
    for (let current = block; current; current = current.getNextBlock()) lines.push(...statement(current, depth));
    return lines;
  }
  function statement(block, depth) {
    const pad = '  '.repeat(depth);
    const f = name => field(block, name);
    const v = (name, fallback) => value(block, name, fallback);
    const body = name => chain(child(block, name), depth + 1);
    const wrap = (test, thenBody, elseBody) => [
      `${pad}if (${test}) {`, ...thenBody,
      ...(elseBody ? [`${pad}} else {`, ...elseBody] : []), `${pad}}`
    ];
    switch (block.type) {
      case 'board_wait': return [`${pad}delay(${Math.max(0, Math.round(number(block, 'SECONDS') * 1000))});`];
      case 'board_repeat': {
        const counter = `_boardlabRepeat${++repeatIndex}`;
        return [`${pad}for (int ${counter} = 0; ${counter} < ${number(block, 'COUNT')}; ++${counter}) {`, ...body('DO'), `${pad}}`];
      }
      case 'control_if': return wrap(v('CHECK', 'false'), body('DO'));
      case 'control_if_else': return wrap(v('CHECK', 'false'), body('DO'), body('ELSE'));
      case 'control_if_elseif': {
        const result = [`${pad}if (${v('CHECK', 'false')}) {`, ...body('DO')];
        for (let i = 0; i < (block.elseIfCount_ || 0); i++) result.push(`${pad}} else if (${v(`CHECK${i + 2}`, 'false')}) {`, ...body(`DO${i + 2}`));
        if (block.hasElse_) result.push(`${pad}} else {`, ...body('ELSE'));
        result.push(`${pad}}`);
        return result;
      }
      case 'control_wait_until': return [`${pad}while (!(${v('CHECK', 'false')})) { delay(10); }`];
      case 'control_repeat_until': return [`${pad}while (!(${v('CHECK', 'false')})) {`, ...body('DO'), `${pad}  delay(1);`, `${pad}}`];
      case 'screen_text_line': return [`${pad}k10.canvas->canvasText(${v('TEXT', quote(''))}, ${number(block, 'ROW')}, ${color(f('COLOR'))});`];
      case 'screen_text_xy': return [`${pad}k10.canvas->canvasText(${v('TEXT', quote(''))}, ${number(block, 'X')}, ${number(block, 'Y')}, ${color(f('COLOR'))}, k10.canvas->eCNAndENFont${f('SIZE') === '16' ? '16' : '24'}, ${number(block, 'WRAP')}, ${f('CLEAR') === 'YES' ? 'true' : 'false'});`];
      case 'screen_text': return [`${pad}k10.canvas->canvasText(${v('TEXT', quote(''))}, 1, ${color(f('COLOR'))});`, `${pad}k10.canvas->updateCanvas();`];
      case 'screen_update': return [`${pad}k10.canvas->updateCanvas();`];
      case 'screen_clear_all': return [`${pad}k10.canvas->canvasClear();`, `${pad}k10.canvas->updateCanvas();`];
      case 'screen_clear_line': return [`${pad}k10.canvas->canvasClear(${number(block, 'ROW')});`, `${pad}k10.canvas->updateCanvas();`];
      case 'screen_clear': return [`${pad}k10.setScreenBackground(${color(f('COLOR'))});`];
      case 'screen_point': return [`${pad}k10.canvas->canvasPoint(${number(block, 'X')}, ${number(block, 'Y')}, ${color(f('COLOR'))});`];
      case 'screen_width': return [`${pad}k10.canvas->canvasSetLineWidth(${number(block, 'WIDTH')});`];
      case 'screen_line': return [`${pad}k10.canvas->canvasLine(${number(block, 'X1')}, ${number(block, 'Y1')}, ${number(block, 'X2')}, ${number(block, 'Y2')}, ${color(f('COLOR'))});`];
      case 'screen_line_value': return [`${pad}k10.canvas->canvasLine(${v('X1')}, ${v('Y1')}, ${v('X2')}, ${v('Y2')}, ${color(f('COLOR'))});`];
      case 'screen_rect_value': return [`${pad}k10.canvas->canvasRectangle(${v('X')}, ${v('Y')}, ${v('W')}, ${v('H')}, ${color(f('COLOR'))}, ${color(f('FCOLOR'))}, ${f('FILL') === 'YES' ? 'true' : 'false'});`];
      case 'screen_circle_value': return [`${pad}k10.canvas->canvasCircle(${v('X')}, ${v('Y')}, ${v('R')}, ${color(f('COLOR'))}, ${color(f('FCOLOR'))}, ${f('FILL') === 'YES' ? 'true' : 'false'});`];
      case 'screen_rect': return [`${pad}k10.canvas->canvasRectangle(${number(block, 'X')}, ${number(block, 'Y')}, ${number(block, 'W')}, ${number(block, 'H')}, ${color(f('COLOR'))}, ${color(f('FCOLOR'))}, ${f('FILL') === 'YES' ? 'true' : 'false'});`];
      case 'screen_circle': return [`${pad}k10.canvas->canvasCircle(${number(block, 'X')}, ${number(block, 'Y')}, ${number(block, 'R')}, ${color(f('COLOR'))}, ${color(f('FCOLOR'))}, ${f('FILL') === 'YES' ? 'true' : 'false'});`];
      case 'screen_qr': return [`${pad}k10.canvasDrawCode(${v('TEXT', quote(''))});`, `${pad}k10.canvas->updateCanvas();`];
      case 'screen_qr_clear': return [`${pad}k10.clearCode();`];
      case 'rgb_set': return [`${pad}k10.rgb->write(-1, ${color(f('COLOR'))});`];
      case 'rgb_pixel': return [`${pad}k10.rgb->write(${f('LED') === 'all' ? '-1' : Number(f('LED'))}, ${color(f('COLOR'))});`];
      case 'rgb_off': return [`${pad}k10.rgb->write(${f('LED') === 'all' ? '-1' : Number(f('LED'))}, 0x000000);`];
      case 'rgb_brightness': return [`${pad}k10.rgb->brightness(${Math.max(0, Math.min(9, Math.round(number(block, 'VALUE'))))});`];
      case 'music_play': usesMusic = true; return [`${pad}music.playMusic(${f('MUSIC')});`];
      case 'music_stop': usesMusic = true; return [`${pad}music.stopPlayTone();`];
      case 'note_play': usesMusic = true; return [`${pad}music.playTone(${Number(f('NOTE'))}, ${Math.round(Number(f('BEAT')) * 8000)});`];
      case 'audio_tf_play': usesMusic = true; usesSD = true; return [`${pad}music.playTFCardAudio(${v('FILE', quote('S:/music.wav'))});`];
      case 'audio_stop': usesMusic = true; return [`${pad}music.stopPlayAudio();`];
      case 'audio_record': usesMusic = true; usesSD = true; return [`${pad}music.recordSaveToTFCard(${v('FILE', quote('S:/sound.wav'))}, ${number(block, 'SECONDS')});`];
      case 'screen_image': {
        const settings = k10ImageSettings(block);
        if (!settings.src) {
          issues.push('本地图片：尚未选择图片');
          return [`${pad}// 本地图片尚未选择`];
        }
        const name = `image_data${images.length + 1}`;
        images.push({ ...settings, name, fileName: settings.name });
        return [`${pad}k10.canvas->canvasDrawBitmap(${number(block, 'X')}, ${number(block, 'Y')}, ${settings.width}, ${settings.height}, ${name});`];
      }
      default: unsupported(block); return [`${pad}// 尚未支持：${block.type}`];
    }
  }
  const roots = workspace.getTopBlocks(true).filter(block => !block.isInFlyout && !block.isShadow());
  const starts = roots.filter(block => block.type === 'board_start');
  if (!starts.length) issues.push('没有“行空板K10主程序开始”积木');
  if (starts.length > 1) issues.push('检测到多个主程序开始积木；Arduino 工程只能有一个 setup/loop');
  for (const root of roots) if (root.type !== 'board_start') unsupported(root);
  if (starts.length) {
    for (let block = starts[0].getNextBlock(); block; block = block.getNextBlock()) {
      if (block.type === 'board_forever') {
        loop.push(...chain(child(block, 'DO')));
        if (block.getNextBlock()) issues.push('循环执行下方还连接了积木；这些积木在真实程序中不可达');
        break;
      }
      setup.push(...statement(block, 1));
    }
  }
  const code = [
    '// 板演 · K10 Arduino C++ 预览（尚未经过本机 K10 编译验证）',
    ...(issues.length ? ['#error BoardLab_K10_Arduino_generation_incomplete'] : []),
    '#include "unihiker_k10.h"', ...(images.length ? ['#include "arduino_image_cache.h"'] : []), '',
    'UNIHIKER_K10 k10;', ...(usesMusic ? ['Music music;'] : []), 'uint8_t screen_dir = 2;', '',
    'void setup() {', '  k10.begin();', '  k10.initScreen(screen_dir);', '  k10.creatCanvas();', ...(usesSD ? ['  k10.initSDFile();'] : []), ...setup, '}', '',
    'void loop() {', ...loop, '  delay(1);', '}', ''
  ].join('\n');
  return { code, images, issues: [...new Set(issues)] };
}

// Mind+ K10 stores each pixel as RGB565, high byte first. Its image field
// draws the selected image to a canvas at the configured width and height.
async function buildK10ImageHeader(images) {
  const chunks = ['#pragma once', '#include <stdint.h>', ''];
  for (const image of images) {
    const source = new Image();
    source.src = image.src;
    await source.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(source, 0, 0, image.width, image.height);
    const pixels = context.getImageData(0, 0, image.width, image.height).data;
    const bytes = [];
    for (let i = 0; i < pixels.length; i += 4) {
      const rgb565 = ((pixels[i] & 0xf8) << 8) | ((pixels[i + 1] & 0xfc) << 3) | (pixels[i + 2] >> 3);
      bytes.push(`0x${(rgb565 >> 8).toString(16).padStart(2, '0')}`, `0x${(rgb565 & 0xff).toString(16).padStart(2, '0')}`);
    }
    chunks.push(`// ${String(image.fileName || image.name).replace(/[\r\n]/g, ' ')}: ${image.width} x ${image.height}`);
    chunks.push(`const uint8_t ${image.name}[${bytes.length}] = {`);
    for (let i = 0; i < bytes.length; i += 16) chunks.push(`  ${bytes.slice(i, i + 16).join(', ')},`);
    chunks.push('};', '');
  }
  return chunks.join('\n');
}

function createK10ProjectZip(files) {
  const encoder = new TextEncoder();
  const parts = [];
  const directory = [];
  let offset = 0;
  const crcTable = Array.from({ length: 256 }, (_, index) => {
    let crc = index;
    for (let i = 0; i < 8; i++) crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
    return crc >>> 0;
  });
  const crc32 = bytes => {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  };
  const short = (view, at, value) => view.setUint16(at, value, true);
  const long = (view, at, value) => view.setUint32(at, value, true);
  for (const [filename, content] of files) {
    const name = encoder.encode(filename);
    const data = ArrayBuffer.isView(content)
      ? new Uint8Array(content.buffer,content.byteOffset,content.byteLength)
      : encoder.encode(content);
    const crc = crc32(data);
    const local = new Uint8Array(30 + name.length);
    const header = new DataView(local.buffer);
    long(header, 0, 0x04034b50); short(header, 4, 20); short(header, 8, 0);
    long(header, 14, crc); long(header, 18, data.length); long(header, 22, data.length);
    short(header, 26, name.length); local.set(name, 30);
    parts.push(local, data);
    const central = new Uint8Array(46 + name.length);
    const entry = new DataView(central.buffer);
    long(entry, 0, 0x02014b50); short(entry, 4, 20); short(entry, 6, 20);
    long(entry, 16, crc); long(entry, 20, data.length); long(entry, 24, data.length);
    short(entry, 28, name.length); long(entry, 42, offset); central.set(name, 46);
    directory.push(central);
    offset += local.length + data.length;
  }
  const directoryLength = directory.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  long(endView, 0, 0x06054b50);
  short(endView, 8, files.length); short(endView, 10, files.length);
  long(endView, 12, directoryLength); long(endView, 16, offset);
  return new Blob([...parts, ...directory, end], { type: 'application/zip' });
}
