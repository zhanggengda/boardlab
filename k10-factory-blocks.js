// An editable Blockly port of the classic official out-of-box demo.
// Uses normal conditions, variables, functions, sensors and drawing blocks;
// there is no hidden "run factory firmware" block or embedded C++ execution.
function createK10FactoryWorkspace(assets) {
  const variables = new Map();
  const variable = name => {
    if (!variables.has(name)) variables.set(name, { name, id: `factory-${variables.size}`, type: '' });
    return { id: variables.get(name).id };
  };
  const b = (type, fields = {}, values = {}, extraState) => ({ type, ...(Object.keys(fields).length ? { fields } : {}),
    ...(Object.keys(values).length ? { inputs: Object.fromEntries(Object.entries(values).map(([name, value]) => [name, { block: value }])) } : {}),
    ...(extraState ? { extraState } : {}) });
  const chain = items => { for (let i = 0; i < items.length - 1; i++) items[i].next = { block: items[i + 1] }; return items[0]; };
  const number = value => b('math_number', { NUM: value });
  const text = value => b('text', { TEXT: value });
  const get = name => b('variables_get', { VAR: variable(name) });
  const set = (name, value) => b('variables_set', { VAR: variable(name) }, { VALUE: typeof value === 'number' ? number(value) : value });
  const math = (op, a, c) => b('math_arithmetic', { OP: op }, { A: typeof a === 'number' ? number(a) : a, B: typeof c === 'number' ? number(c) : c });
  const compare = (op, a, c) => b('logic_compare', { OP: op }, { A: typeof a === 'number' ? number(a) : a, B: typeof c === 'number' ? number(c) : c });
  const both = (a, c) => b('logic_operation', { OP: 'AND' }, { A: a, B: c });
  const condition = (test, yes, no) => b(no ? 'control_if_else' : 'control_if', {}, { CHECK: test, DO: chain(yes), ...(no ? { ELSE: chain(no) } : {}) });
  const branches = pairs => {
    const inputs = {};
    pairs.forEach(([test, items], i) => { inputs[i ? `CHECK${i + 1}` : 'CHECK'] = test; inputs[i ? `DO${i + 1}` : 'DO'] = chain(items); });
    return b('control_if_elseif', {}, inputs, { elseIfCount: pairs.length - 1, hasElse: false });
  };
  const call = name => b('procedures_callnoreturn', {}, {}, { name, params: [] });
  const image = (name, x, y) => {
    if (!assets[name]?.src) throw new Error(`缺少出厂图片资源：${name}`);
    return { ...b('screen_image', { X: x, Y: y }), data: JSON.stringify({ localImage: assets[name] }) };
  };
  const label = (content, x, y, size = 16, color = '#333333') => b('screen_text_xy', { X: x, Y: y, SIZE: String(size), COLOR: color, WRAP: 50, CLEAR: 'NO' }, { TEXT: typeof content === 'string' ? text(content) : content });
  const join = parts => b('text_join', {}, Object.fromEntries(parts.map((part, i) => [`ADD${i}`, typeof part === 'string' ? text(part) : part])), { itemCount: parts.length });
  const rect = (x, y, w, h, color, fill = true) => b('screen_rect', { X: x, Y: y, W: w, H: h, COLOR: color, FCOLOR: color, FILL: fill ? 'YES' : 'NO' });
  const circle = (x, y, r, color, fill = true) => b('screen_circle', { X: x, Y: y, R: r, COLOR: color, FCOLOR: color, FILL: fill ? 'YES' : 'NO' });
  const drawing = (type, values, color, fill = true) => b(type, { COLOR: color, ...(type === 'screen_line_value' ? {} : { FCOLOR: color, FILL: fill ? 'YES' : 'NO' }) }, Object.fromEntries(Object.entries(values).map(([key, value]) => [key, typeof value === 'number' ? number(value) : value])));
  const sensor = key => b('k10_environment', { SENSOR: key });
  const clamp = (value, low, high) => b('math_constrain', {}, { VALUE: value, LOW: number(low), HIGH: number(high) });
  const scale = (value, low, high, output) => clamp(b('operator_map', {}, { VALUE: value, FROM_LOW: number(low), FROM_HIGH: number(high), TO_LOW: number(0), TO_HIGH: number(output) }), 0, output);
  const clear = () => b('screen_clear', { COLOR: '#ffffff' });
  const definitions = [];
  function define(name, items, note) {
    definitions.push({ ...b('procedures_defnoreturn', { NAME: name }, { STACK: chain(items) }, { params: [] }), collapsed: true,
      ...(note ? { icons: { comment: { text: note, pinned: false, width: 300, height: 100 } } } : {}) });
  }
  define('初始化出厂演示', [
    set('页面', 0), set('语音画面', 0), set('上次命令', 0), set('旋转角度', 0), set('目标X', 140), set('目标Y', 70),
    b('screen_orientation', { DIRECTION: '0' }), b('camera_preview', { SHOW: 'NO' }), b('ai_mode', { MODE: '人脸检测' }),
    b('rgb_brightness', { VALUE: 2 }), b('rgb_off', { LED: 'all' }), b('speech_speed', { VALUE: 3 }),
    b('speech_config', { MODE: '连续', TIME: 5000, LANG: '中文' }),
    ...['kai deng', 'guan deng', 'dong hua', 'gu shi', 'bo fang yin yue', 'ping heng'].map((command, i) => b('speech_command', { ID: i + 1 }, { TEXT: text(command) }))
  ], '经典出厂程序的初始化：变量、显示、AI、灯光和六条语音命令。板演中不初始化真实硬件。');
  define('开机首页', [image('logo', 45, 50), image('mode', 7, 250), label('A 上一页 · B 下一页', 34, 215)]);
  define('人脸检测页面', [
    image('robotimg', 70, 60), label('人脸检测 · 仿真输入', 26, 20),
    condition(b('ai_detect', { OBJECT: '人脸' }), [
      b('screen_width', { WIDTH: 2 }),
      drawing('screen_rect_value', { X: b('ai_face_attr', { ATTR: 'x' }), Y: b('ai_face_attr', { ATTR: 'y' }), W: b('ai_face_attr', { ATTR: 'width' }), H: b('ai_face_attr', { ATTR: 'height' }) }, '#00bb66', false),
      label('检测到人脸', 70, 190, 16, '#00aa55')
    ], [label('用下方按钮模拟人脸', 24, 190)]), label('A 上一页 · B 下一页', 32, 265), label('真实相机可在相机面板选择', 10, 289)
  ], '默认绘制机器人作为占位背景；检测结果来自虚拟输入。用户主动切换到真实相机后，AI积木可读取真实检测结果。');
  const idle = [image('robotimg', 70, 30)];
  define('语音显示页面', [
    branches([
      [compare('EQ', get('语音画面'), 0), idle], [compare('EQ', get('语音画面'), 1), [image('kaideng', 70, 30)]],
      [compare('EQ', get('语音画面'), 2), [image('guandeng', 70, 30)]], [compare('EQ', get('语音画面'), 3), [call('绘制旋转立方体')]],
      [compare('EQ', get('语音画面'), 4), [image('gushi', 55, 15)]], [compare('EQ', get('语音画面'), 5), [image('music_img', 56, 16)]],
      [compare('EQ', get('语音画面'), 6), [call('绘制平衡球')]]
    ]), ...[60, 100, 140, 180].map(x => circle(x, 160, 6, '#00cc66')),
    label('请说：你好小行，开灯 / 关灯', 7, 184), label('动画 / 古诗 / 播放音乐 / 平衡', 7, 206),
    label('板演：用下方模拟命令触发', 14, 228, 16, '#597082'), image('mode2', 7, 250)
  ]);
  const commandTests = Array.from({ length: 6 }, (_, i) => b('speech_detect', { ID: i + 1 }));
  define('处理语音命令', [
    ...commandTests.map((test, i) => condition(both(test, compare('NEQ', get('上次命令'), i + 1)), [
      set('上次命令', i + 1), set('语音画面', i + 1),
      ...(i === 0 ? ['#00ff00', '#ffff00', '#ff0000'].map((color, led) => b('rgb_pixel', { LED: String(led), COLOR: color })) : []),
      ...(i === 1 ? [b('rgb_off', { LED: 'all' })] : []),
      ...(i === 3 ? [b('speak_text', {}, { TEXT: text('静夜思，李白。床前明月光，疑是地上霜。举头望明月，低头思故乡。') })] : []),
      ...(i === 4 ? [b('audio_tf_play', {}, { FILE: text('music.wav') })] : [])
    ])),
    condition(b('logic_negate', {}, { BOOL: Array.from({ length: 6 }, (_, i) => b('speech_detect', { ID: i + 1 })).reduce((a, c) => b('logic_operation', { OP: 'OR' }, { A: a, B: c })) }), [set('上次命令', 0)])
  ], '只有新的语音命令触发一次播报/音乐。音乐需要先在“虚拟输入”的TF卡中载入music.wav；不是使用电脑麦克风识别。');
  define('植物互动页面', [
    set('温度', sensor('temp')), set('湿度', sensor('humidity')), set('光照', sensor('light')),
    image('plant_img', 20, 100), rect(71, 94, 100, 131, '#ffffff'),
    condition(compare('LTE', get('湿度'), 30), [image('rain_img', 25, 30), rect(30, 67, 50, 27, '#ffffff'), image('plant_img_0', 71, 105)], [image('rain_img_1', 25, 30), image('plant_img_1', 71, 105)]),
    branches([
      [compare('LTE', get('光照'), 100), [image('sun_img_40', 145, 35)]],
      [both(compare('GT', get('光照'), 100), compare('LTE', get('光照'), 1500)), [image('sun_img_60', 135, 25)]],
      [compare('GT', get('光照'), 1500), [image('sun_img_80', 125, 15), circle(165, 55, 17, '#ffd700')]]
    ]), condition(both(compare('GT', get('光照'), 1500), compare('GT', get('湿度'), 30)), [image('plant_img_2', 71, 94)]),
    set('湿度条高度', scale(get('湿度'), 10, 80, 75)), set('温度条高度', scale(get('温度'), 15, 50, 75)),
    drawing('screen_rect_value', { X: 33, Y: math('MINUS', 195, get('湿度条高度')), W: 9, H: get('湿度条高度') }, '#00ffff'),
    drawing('screen_rect_value', { X: 199, Y: math('MINUS', 197, get('温度条高度')), W: 9, H: get('温度条高度') }, '#ff6666'),
    label(join([get('湿度'), '%']), 20, 232), label(join([get('温度'), '°C']), 179, 232), image('mode3', 7, 250)
  ], '使用官方原始图片和阈值：湿度≤30枯萎、光照>1500且湿度>30开花。拖动右侧环境滑块即可实时观察。');
  define('教程二维码页面', [image('wikicode', 55, 30), label('扫码查看 K10 使用教程', 28, 190), label('或点击下方官方教程链接', 20, 214), image('mode4', 7, 250)]);
  define('绘制平衡球', [
    set('球X', math('ADD', 120, math('DIVIDE', b('k10_acceleration', { AXIS: 'x' }), 10))),
    set('球Y', math('ADD', 75, math('DIVIDE', b('k10_acceleration', { AXIS: 'y' }), 10))),
    set('球X', clamp(get('球X'), 66, 174)), set('球Y', clamp(get('球Y'), 21, 129)), b('screen_width', { WIDTH: 2 }),
    rect(55, 10, 130, 130, '#222222', false), drawing('screen_circle_value', { X: get('目标X'), Y: get('目标Y'), R: 12 }, '#ef6691', false),
    drawing('screen_circle_value', { X: get('球X'), Y: get('球Y'), R: 10 }, '#00cccc'),
    condition(both(compare('LT', b('math_single', { OP: 'ABS' }, { NUM: math('MINUS', get('球X'), get('目标X')) }), 16), compare('LT', b('math_single', { OP: 'ABS' }, { NUM: math('MINUS', get('球Y'), get('目标Y')) }), 16)), [
      set('目标X', b('math_random_int', {}, { FROM: number(72), TO: number(168) })), set('目标Y', b('math_random_int', {}, { FROM: number(27), TO: number(123) }))
    ])
  ], '姿态面板改变X/Y加速度，小球跟随移动。碰到目标后生成下一个目标。');
  // Rotate all eight cube vertices around the Y axis, then project to 2D.
  // Each coordinate remains an editable arithmetic/trigonometric expression.
  const vertices = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
  const cube = [set('旋转角度', b('math_modulo', {}, { DIVIDEND: math('ADD', get('旋转角度'), 5), DIVISOR: number(360) })),
    set('正弦', b('math_trig', { OP: 'SIN' }, { NUM: get('旋转角度') })), set('余弦', b('math_trig', { OP: 'COS' }, { NUM: get('旋转角度') }))];
  vertices.forEach(([x, y, z], i) => cube.push(
    set(`点${i}X`, math('ADD', 120, math('MULTIPLY', 40, math('ADD', math('MULTIPLY', x, get('余弦')), math('MULTIPLY', z, get('正弦')))))),
    set(`点${i}Y`, math('ADD', 75, math('ADD', y * 40, math('MULTIPLY', 12, math('MINUS', math('MULTIPLY', z, get('余弦')), math('MULTIPLY', x, get('正弦')))))))
  ));
  cube.push(b('screen_width', { WIDTH: 2 }));
  [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]].forEach(([a,c], i) => cube.push(drawing('screen_line_value', { X1: get(`点${a}X`), Y1: get(`点${a}Y`), X2: get(`点${c}X`), Y2: get(`点${c}Y`) }, i < 4 ? '#ed6b91' : '#25a6cf')));
  define('绘制旋转立方体', cube, '图形化教学版使用Y轴旋转与正交投影；不是原C++中的逐行自动反编译。修改角度步进、三角函数和线段即可改变动画。');
  define('刷新当前页面', [clear(), b('screen_width', { WIDTH: 1 }),
    branches([
      [compare('EQ', get('页面'), 0), [call('开机首页')]], [compare('EQ', get('页面'), 1), [call('人脸检测页面')]],
      [compare('EQ', get('页面'), 2), [call('处理语音命令'), call('语音显示页面')]], [compare('EQ', get('页面'), 3), [call('植物互动页面')]],
      [compare('EQ', get('页面'), 4), [call('教程二维码页面')]]
    ]), b('screen_update')
  ]);
  const start = { ...chain([b('board_start'), call('初始化出厂演示'), b('board_forever', {}, { DO: chain([call('刷新当前页面'), b('board_wait', { SECONDS: 0.1 })]) })]), id: 'factory-main', x: 40, y: 45,
    data: JSON.stringify({ example: 'k10-factory-blocks', version: '241202' }) };
  const events = ['A', 'B'].map((key, i) => ({ ...chain([b('button_event', { BUTTON: key, STATE: 'DOWN' }),
    ...(key === 'B' ? [set('页面', math('ADD', get('页面'), 1)), condition(compare('GT', get('页面'), 4), [set('页面', 1)])]
      : [set('页面', math('MINUS', get('页面'), 1)), condition(compare('LT', get('页面'), 1), [set('页面', 4)])]),
    set('语音画面', 0), set('上次命令', 0), b('music_stop'), b('audio_stop')
  ]), x: 430, y: 45 + i * 400 }));
  definitions.forEach((definition, i) => { definition.x = 1150; definition.y = 45 + i * 88; });
  return { variables: [...variables.values()], blocks: { languageVersion: 0, blocks: [start, ...events, ...definitions] } };
}

let k10FactoryAssets;
let k10FactoryVoiceTimer = null;
function cancelK10FactoryVoicePulse() {
  if (k10FactoryVoiceTimer === null) return;
  clearTimeout(k10FactoryVoiceTimer); eventTimers.delete(k10FactoryVoiceTimer);
  k10FactoryVoiceTimer = null; virtualState.command = -1;
}
async function loadK10FactoryBlocks() {
  if (currentBoard !== 'k10' || !k10Added) { toast('请先选择行空板 K10'); return; }
  const button = document.querySelector('#factoryExampleBtn');
  button.disabled = true;
  try {
    if (!k10FactoryAssets) {
      const response = await fetch('examples/k10-factory/bitmaps.json');
      if (!response.ok) throw new Error('出厂图片资源加载失败，请重试');
      k10FactoryAssets = await response.json();
    }
    if (currentBoard !== 'k10' || !k10Added) return;
    const state = createK10FactoryWorkspace(k10FactoryAssets);
    stopProgram(false);
    Blockly.Events.disable();
    try {
      Blockly.serialization.workspaces.load(state, blocklyWorkspace);
      blocklyWorkspace.getTopBlocks(false).filter(block => block.type.startsWith('procedures_def')).forEach(decorateMindProcedure);
    } finally { Blockly.Events.enable(); }
    refreshContinuousToolbox();
    updateProjectName('K10 出厂演示 · 图形化版');
    markProgramModified(); updateCode(); saveWorkspace();
    document.querySelector('#examplesPopover').hidden = true;
    document.querySelector('#factoryExampleDialog').close();
    document.querySelector('[data-view="blocks"]').click();
    requestAnimationFrame(() => { Blockly.svgResize(blocklyWorkspace); blocklyWorkspace.centerOnBlock('factory-main'); });
    if (currentMode === 'virtual') await runProgram();
    toast('已载入可编辑的出厂积木：按 A/B 切页，展开函数查看逻辑');
  } catch (error) { toast(`载入未成功：${error.message}`); }
  finally { button.disabled = false; }
}

function updateK10FactoryHelp() {
  const panel = document.querySelector('#factoryDemoHelp');
  if (!panel) return;
  const face = document.querySelector('#factoryFaceToggle');
  face.setAttribute('aria-pressed', String(virtualState.object === '人脸'));
  face.textContent = virtualState.object === '人脸' ? '模拟人脸：有' : '模拟人脸：无';
  panel.hidden = currentBoard !== 'k10' || !blocklyWorkspace.getTopBlocks(false).some(block => {
    try { return JSON.parse(block.data || '{}').example === 'k10-factory-blocks'; } catch { return false; }
  });
}
function bindK10FactoryBlocks() {
  // renderSensorControls rebuilds the sensor panel. Keep this control outside it.
  document.querySelector('.runtime-controls').append(document.querySelector('#factoryDemoHelp'));
  document.querySelector('#factoryExampleBtn').addEventListener('click', loadK10FactoryBlocks);
  document.querySelector('#factoryLoadBlocks').addEventListener('click', loadK10FactoryBlocks);
  document.querySelector('#factoryVoiceSend').addEventListener('click', () => {
    if (!running || currentMode !== 'virtual') { toast('请先运行图形化出厂示例'); return; }
    if (runtimeVariables.get('factory-0') !== 2) { toast('按 B 切换到第 2 页「语音识别」再发送命令'); return; }
    cancelK10FactoryVoicePulse(); virtualState.awake = true;
    virtualState.command = Number(document.querySelector('#factoryVoiceCommand').value);
    k10FactoryVoiceTimer = setTimeout(cancelK10FactoryVoicePulse, 600);
    eventTimers.add(k10FactoryVoiceTimer);
    toast('已发送模拟语音命令（非麦克风识别）');
  });
  document.querySelector('#factoryFaceToggle').addEventListener('click', event => {
    virtualState.object = virtualState.object === '人脸' ? '无' : '人脸';
    event.currentTarget.setAttribute('aria-pressed', String(virtualState.object === '人脸'));
    event.currentTarget.textContent = virtualState.object === '人脸' ? '模拟人脸：有' : '模拟人脸：无';
  });
  document.querySelector('#factoryInspect').addEventListener('click', () => {
    const name = document.querySelector('#factoryProcedure').value;
    const definition = blocklyWorkspace.getTopBlocks(false).find(block => block.type === 'procedures_defnoreturn' && block.getFieldValue('NAME') === name);
    if (!definition) return;
    Blockly.Events.disable();
    try {
      definition.setCollapsed(false);
      const selectedPosition = definition.getRelativeToSurfaceXY();
      definition.moveBy(1150 - selectedPosition.x, 45 - selectedPosition.y);
      const otherX = 1150 + definition.getHeightWidth().width + 140;
      blocklyWorkspace.getTopBlocks(false).filter(block => block.type === 'procedures_defnoreturn' && block !== definition).forEach((block, i) => {
        block.setCollapsed(true);
        const position = block.getRelativeToSurfaceXY();
        block.moveBy(otherX - position.x, 45 + i * 88 - position.y);
      });
    } finally { Blockly.Events.enable(); }
    saveWorkspace();
    document.querySelector('[data-view="blocks"]').click();
    requestAnimationFrame(() => {
      Blockly.svgResize(blocklyWorkspace);
      const metrics = blocklyWorkspace.getMetrics(), width = definition.getHeightWidth().width;
      blocklyWorkspace.setScale(Math.min(blocklyWorkspace.scale, (metrics.viewWidth - 60) / width));
      const position = definition.getRelativeToSurfaceXY(), scale = blocklyWorkspace.scale;
      blocklyWorkspace.scroll(30 - position.x * scale, 30 - position.y * scale);
    });
  });
}
