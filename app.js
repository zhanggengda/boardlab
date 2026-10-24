const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

const boardProfiles = {
  k10: { name: '行空板 K10', simName: '行空板 K10 仿真器', codeName: 'MicroPython', accent: '#20cfaf', sku:'DFR0992', image:'assets/k10-front.png', description:'支持当前内置积木、屏幕、按键与传感器仿真' },
  m10: { name:'行空板 M10', simName:'行空板 M10 仿真器', codeName:'Python 3', accent:'#20cfaf', sku:'DFR0706', image:'assets/m10-official-overview.jpg', description:'触屏对象、A/B 按键、光线、运动传感器、L 灯与官方 Python 3 代码；AI / 物联网待接入' }
};

const moduleCatalog = {
  dht11: { name:'DHT11 温湿度传感器', tab:'sensor', sku:'DFR0067', image:'assets/module-dht11.webp', description:'读取温度与相对湿度', blocks:['dht_temperature','dht_humidity'], colour:'#20b593' },
  ultrasonic: { name:'防水超声波测距', tab:'sensor', sku:'SEN0300', image:'assets/module-ultrasonic.webp', description:'虚拟测量 27–800 cm 距离', blocks:['ultrasonic_distance'], colour:'#20b593' },
  servo: { name:'HS-311 舵机', tab:'actuator', sku:'SER0001', image:'assets/module-servo.webp', description:'设置 0–180° 舵机角度', blocks:['servo_angle','servo_sweep'], colour:'#ef7b48' },
  bluetooth: { name:'蓝牙通信模块 V3', tab:'communication', sku:'TEL0026', image:'assets/module-bluetooth.webp', description:'发送文本并接收蓝牙消息', blocks:['bluetooth_send','bluetooth_receive'], colour:'#4a78ff' },
  oled: { name:'SSD1306 OLED 显示器', tab:'display', sku:'TOY0007', image:'assets/module-oled.webp', description:'显示文本、数值并清屏', blocks:['oled_text','oled_number','oled_clear'], colour:'#9b72ff' }
};

const upcomingBoardCatalog = {
  microbit: { name:'micro:bit V2', sku:'MICROBIT-V2', image:'assets/microbit-v2.png', description:'5×5 点阵与 A/B 按键仿真' },
  zhangkong: { name:'掌控板', sku:'DFR0608', image:'', description:'ESP32 教育主控板' },
  arduino: { name:'Arduino Uno R3', sku:'A000066', image:'assets/arduino-uno.jpg', description:'数字引脚、模拟输入与 PWM' },
  esp32: { name:'ESP32', sku:'DFR0478', image:'assets/board-firebeetle.webp', description:'Wi-Fi 与蓝牙主控板' },
  pico: { name:'Raspberry Pi Pico', sku:'DFR0817', image:'assets/board-pico.jpg', description:'基于 RP2040 的 MicroPython 主控板' }
};

let currentBoard = boardProfiles[localStorage.getItem('boardlab-board')] ? localStorage.getItem('boardlab-board') : 'k10';
let currentMode = 'virtual';
let k10Added = localStorage.getItem('boardlab-k10-added') === 'true';
let selectedModules = JSON.parse(localStorage.getItem('boardlab-modules') || '[]').filter(id => moduleCatalog[id]);
let extensionActiveTab = 'board';
let blocklyWorkspace;
let runtimeWorkspace = null;
let running = false;
let runRequestId = 0;
let programArmed = false;
let hasRunProgram = false;
let programDirty = false;
let runStartedAt = 0;
let runTimer = null;
let eventTimers = new Set();
let activeBlock = null;
let displayMode = 'idle';
const pendingButtonPresses = new Set();
const buttonReleaseTimers = new Map();
let activeButtonSnapshot = null;
let keyMap = JSON.parse(localStorage.getItem('boardlab-keymap') || '{"A":"a","B":"b"}');
let keyMappingTarget = null;
let toneContext = null;
let rgbCycle = 0;
const sensorState = { temp: 24, humidity: 56, light: 320, distance: 126, servo: 90, bluetooth: '你好，蓝牙', oled: '', tilt: 'flat', x: 0, y: 0, z: 1000, analog: 620, digital: 0 };

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function defineBlocks() {
  if (window.registerFieldColour) window.registerFieldColour();
  const ColourField=Blockly.registry.getClass(Blockly.registry.Type.FIELD,'field_colour');
  const colourFromJson=ColourField.fromJson;
  const colourOptions=new ColourField('#ffffff').getOptions().map(option=>option[1]);
  ColourField.fromJson=function(options) {
    return colourFromJson.call(this,{...options,colourOptions:[...new Set([options.colour,...colourOptions])].filter(Boolean)});
  };
  const colourUpdateSize=ColourField.prototype.updateSize_;
  ColourField.prototype.updateSize_=function(...args) {
    colourUpdateSize.apply(this,args);
    if(!this.isFullBlockField()) {
      this.size_.width=38;
      this.size_.height=25;
      this.positionBorderRect_();
      this.borderRect_?.setAttribute('rx','13');
      this.borderRect_?.setAttribute('ry','13');
    }
  };
  Blockly.defineBlocksWithJsonArray([
    { type:'board_start', message0:'行空板K10主程序开始', nextStatement:null, style:'board_blocks', tooltip:'程序开始运行' },
    { type:'board_forever', message0:'循环执行', message1:'%1', args1:[{type:'input_statement',name:'DO'}], previousStatement:null, nextStatement:null, style:'control_blocks' },
    { type:'board_repeat', message0:'重复执行 %1 次', args0:[{type:'field_number',name:'COUNT',value:10,min:0,max:9007199254740991,precision:1}], message1:'%1', args1:[{type:'input_statement',name:'DO'}], previousStatement:null, nextStatement:null, style:'control_blocks' },
    { type:'board_wait', message0:'等待 %1 秒', args0:[{type:'field_number',name:'SECONDS',value:1,min:.1,max:10,precision:.1}], previousStatement:null, nextStatement:null, style:'control_blocks' },
    { type:'control_wait_until', message0:'等待直到 %1', args0:[{type:'input_value',name:'CHECK',check:'Boolean'}], previousStatement:null, nextStatement:null, style:'control_blocks' },
    { type:'control_repeat_until', inputsInline:true, message0:'重复执行直到 %1', args0:[{type:'input_value',name:'CHECK',check:'Boolean'}], message1:'%1', args1:[{type:'input_statement',name:'DO'}], previousStatement:null, nextStatement:null, style:'control_blocks' },
    { type:'control_if', inputsInline:true, message0:'如果 %1 那么执行', args0:[{type:'input_value',name:'CHECK',check:'Boolean'}], message1:'%1', args1:[{type:'input_statement',name:'DO'}], previousStatement:null, nextStatement:null, style:'control_blocks' },
    { type:'control_if_else', inputsInline:true, message0:'如果 %1 那么执行', args0:[{type:'input_value',name:'CHECK',check:'Boolean'}], message1:'%1', args1:[{type:'input_statement',name:'DO'}], message2:'否则', message3:'%1', args3:[{type:'input_statement',name:'ELSE'}], previousStatement:null, nextStatement:null, style:'control_blocks' },
    { type:'screen_text', inputsInline:true, message0:'显示文本 %1 颜色 %2', args0:[{type:'input_value',name:'TEXT',check:'String'},{type:'field_colour',name:'COLOR',colour:'#ffffff'}], previousStatement:null, nextStatement:null, style:'board_blocks' },
    { type:'screen_sensors', message0:'屏幕显示环境数据', previousStatement:null, nextStatement:null, style:'board_blocks' },
    { type:'screen_clear', message0:'显示纯色背景 %1', args0:[{type:'field_colour',name:'COLOR',colour:'#163b72'}], previousStatement:null, nextStatement:null, style:'board_blocks' },
    { type:'rgb_set', message0:'全部 RGB 灯设为 %1', args0:[{type:'field_colour',name:'COLOR',colour:'#2fe0b6'}], previousStatement:null, nextStatement:null, style:'board_blocks' },
    { type:'rgb_rainbow', message0:'RGB 流水灯', previousStatement:null, nextStatement:null, style:'board_blocks' },
    { type:'rgb_off', message0:'关闭 %1 RGB 灯', args0:[{type:'field_dropdown',name:'LED',options:[['全部','all'],['0号','0'],['1号','1'],['2号','2']]}], previousStatement:null, nextStatement:null, style:'board_blocks' },
    { type:'tone_play', message0:'播放音调 %1 Hz 持续 %2 秒', args0:[{type:'field_number',name:'FREQ',value:523,min:100,max:2000},{type:'field_number',name:'DURATION',value:.3,min:.1,max:3,precision:.1}], previousStatement:null, nextStatement:null, style:'board_blocks' },
    { type:'speak_text', inputsInline:true, message0:'语音播报 %1', args0:[{type:'input_value',name:'TEXT',check:'String'}], previousStatement:null, nextStatement:null, style:'board_blocks' },
    { type:'serial_sensors', message0:'输出环境数据', previousStatement:null, nextStatement:null, style:'board_blocks' },
    { type:'button_event', message0:'当按键 %1 %2', inputsInline:true, args0:[{type:'field_dropdown',name:'BUTTON',options:[['A','A'],['B','B'],['A+B','A+B']]},{type:'field_dropdown',name:'STATE',options:[['按下','DOWN'],['松开','UP']]}], nextStatement:null, style:'board_blocks' },
    { type:'tilt_event', message0:'当主板 %1 时', args0:[{type:'field_dropdown',name:'TILT',options:[['向前倾斜','forward'],['向后倾斜','back'],['向左倾斜','left'],['向右倾斜','right'],['平放','flat']]}], nextStatement:null, style:'board_blocks' },
    { type:'microbit_icon', message0:'点阵显示 %1', args0:[{type:'field_dropdown',name:'ICON',options:[['爱心','heart'],['笑脸','smile'],['对勾','yes'],['叉号','no']]}], previousStatement:null, nextStatement:null, style:'display_blocks' },
    { type:'microbit_text', message0:'滚动显示文字 %1', args0:[{type:'field_input',name:'TEXT',text:'HELLO'}], previousStatement:null, nextStatement:null, style:'display_blocks' },
    { type:'microbit_led_plot', message0:'点亮 x %1 y %2', args0:[{type:'field_number',name:'X',value:2,min:0,max:4},{type:'field_number',name:'Y',value:2,min:0,max:4}], previousStatement:null, nextStatement:null, style:'light_blocks' },
    { type:'arduino_led', message0:'板载 LED %1', args0:[{type:'field_dropdown',name:'STATE',options:[['点亮','HIGH'],['熄灭','LOW']]}], previousStatement:null, nextStatement:null, style:'light_blocks' },
    { type:'arduino_digital', message0:'数字引脚 %1 输出 %2', args0:[{type:'field_number',name:'PIN',value:13,min:0,max:13},{type:'field_dropdown',name:'STATE',options:[['高电平','HIGH'],['低电平','LOW']]}], previousStatement:null, nextStatement:null, style:'io_blocks' },
    { type:'arduino_pwm', message0:'PWM 引脚 %1 输出 %2', args0:[{type:'field_dropdown',name:'PIN',options:[['3','3'],['5','5'],['6','6'],['9','9'],['10','10'],['11','11']]},{type:'field_number',name:'VALUE',value:128,min:0,max:255}], previousStatement:null, nextStatement:null, style:'io_blocks' },
    { type:'arduino_serial', message0:'串口打印 %1', args0:[{type:'field_input',name:'TEXT',text:'Hello Arduino'}], previousStatement:null, nextStatement:null, style:'sensor_blocks' },
    { type:'dht_temperature', message0:'DHT11 温度（°C）', output:'Number', style:'module_blocks' },
    { type:'dht_humidity', message0:'DHT11 湿度（%）', output:'Number', style:'module_blocks' },
    { type:'ultrasonic_distance', message0:'超声波距离（cm）', output:'Number', style:'module_blocks' },
    { type:'servo_angle', message0:'舵机转到 %1 度', args0:[{type:'field_number',name:'ANGLE',value:90,min:0,max:180}], previousStatement:null, nextStatement:null, style:'module_blocks' },
    { type:'servo_sweep', message0:'舵机在 %1 和 %2 度之间往返', args0:[{type:'field_number',name:'FROM',value:0,min:0,max:180},{type:'field_number',name:'TO',value:180,min:0,max:180}], previousStatement:null, nextStatement:null, style:'module_blocks' },
    { type:'bluetooth_send', message0:'蓝牙发送 %1', args0:[{type:'field_input',name:'TEXT',text:'Hello'}], previousStatement:null, nextStatement:null, style:'module_blocks' },
    { type:'bluetooth_receive', message0:'收到的蓝牙文本', output:'String', style:'module_blocks' },
    { type:'oled_text', message0:'OLED 显示文字 %1', args0:[{type:'field_input',name:'TEXT',text:'Hello'}], previousStatement:null, nextStatement:null, style:'module_blocks' },
    { type:'oled_number', message0:'OLED 显示数值 %1', args0:[{type:'field_number',name:'VALUE',value:42}], previousStatement:null, nextStatement:null, style:'module_blocks' },
    { type:'oled_clear', message0:'清空 OLED 屏幕', previousStatement:null, nextStatement:null, style:'module_blocks' }
  ]);
  defineExpandableCondition();
  defineReferenceBlocks();
  defineK10NativeBlocks();
  defineM10Blocks();
  installK10BlockIcons();
}

function definePythonGenerators() {
  const generator = window.python?.pythonGenerator;
  if (!generator) return;
  const text = value => JSON.stringify(String(value));
  generator.forBlock.board_start = () => '# 主板启动\n';
  generator.forBlock.board_wait = b => `time.sleep(${b.getFieldValue('SECONDS')})\n`;
  generator.forBlock.board_forever = (b,g) => `while True:\n${g.statementToCode(b,'DO') || '    pass\n'}`;
  generator.forBlock.board_repeat = (b,g) => `for _ in range(${b.getFieldValue('COUNT')}):\n${g.statementToCode(b,'DO') || '    pass\n'}`;
  const condition = (b,g,name) => g.valueToCode(b,name,g.ORDER_NONE) || 'False';
  generator.forBlock.control_wait_until = (b,g) => `while not (${condition(b,g,'CHECK')}):\n    time.sleep(0.05)\n`;
  generator.forBlock.control_repeat_until = (b,g) => `while not (${condition(b,g,'CHECK')}):\n${g.statementToCode(b,'DO') || '    pass\n'}`;
  generator.forBlock.control_if = (b,g) => `if ${condition(b,g,'CHECK')}:\n${g.statementToCode(b,'DO') || '    pass\n'}`;
  generator.forBlock.control_if_else = (b,g) => `if ${condition(b,g,'CHECK')}:\n${g.statementToCode(b,'DO') || '    pass\n'}else:\n${g.statementToCode(b,'ELSE') || '    pass\n'}`;
  generator.forBlock.control_if_elseif = (b,g) => {
    let code=`if ${condition(b,g,'CHECK')}:\n${g.statementToCode(b,'DO') || '    pass\n'}`;
    for(let i=0;i<b.elseIfCount_;i++) code+=`elif ${condition(b,g,`CHECK${i+2}`)}:\n${g.statementToCode(b,`DO${i+2}`)||'    pass\n'}`;
    if(b.hasElse_) code+=`else:\n${g.statementToCode(b,'ELSE')||'    pass\n'}`;
    return code;
  };
  generator.forBlock.screen_text = (b,g) => `board.screen.text(${g.valueToCode(b,'TEXT',g.ORDER_NONE)||"''"}, color=${text(b.getFieldValue('COLOR'))})\n`;
  generator.forBlock.screen_sensors = () => `board.screen.environment(temperature, humidity, light)\n`;
  generator.forBlock.screen_clear = b => `board.screen.clear(${text(b.getFieldValue('COLOR'))})\n`;
  generator.forBlock.rgb_set = b => `board.rgb.fill(${text(b.getFieldValue('COLOR'))})\n`;
  generator.forBlock.rgb_rainbow = () => `board.rgb.rainbow()\n`;
  generator.forBlock.rgb_off = b => b.getFieldValue('LED')==='all'||!b.getFieldValue('LED') ? 'board.rgb.off()\n' : `board.rgb.set(${text(b.getFieldValue('LED'))}, "#000000")\n`;
  generator.forBlock.tone_play = b => `board.speaker.tone(${b.getFieldValue('FREQ')}, ${b.getFieldValue('DURATION')})\n`;
  generator.forBlock.speak_text = (b,g) => `board.speaker.say(${g.valueToCode(b,'TEXT',g.ORDER_NONE)||"''"})\n`;
  generator.forBlock.serial_sensors = () => `print(temperature, humidity, light)\n`;
  generator.forBlock.button_event = b => `# 当按键 ${b.getFieldValue('BUTTON')} ${b.getFieldValue('STATE')==='UP'?'松开':'按下'}\n`;
  generator.forBlock.tilt_event = b => `# 当姿态为 ${b.getFieldValue('TILT')}\n`;
  generator.forBlock.microbit_icon = b => `display.show(Image.${b.getFieldValue('ICON').toUpperCase()})\n`;
  generator.forBlock.microbit_text = b => `display.scroll(${text(b.getFieldValue('TEXT'))})\n`;
  generator.forBlock.microbit_led_plot = b => `display.set_pixel(${b.getFieldValue('X')}, ${b.getFieldValue('Y')}, 9)\n`;
  generator.forBlock.arduino_led = b => `digital_write(13, ${text(b.getFieldValue('STATE'))})\n`;
  generator.forBlock.arduino_digital = b => `digital_write(${b.getFieldValue('PIN')}, ${text(b.getFieldValue('STATE'))})\n`;
  generator.forBlock.arduino_pwm = b => `analog_write(${b.getFieldValue('PIN')}, ${b.getFieldValue('VALUE')})\n`;
  generator.forBlock.arduino_serial = b => `print(${text(b.getFieldValue('TEXT'))})\n`;
  generator.forBlock.dht_temperature = () => ['dht.temperature()', generator.ORDER_ATOMIC];
  generator.forBlock.dht_humidity = () => ['dht.humidity()', generator.ORDER_ATOMIC];
  generator.forBlock.ultrasonic_distance = () => ['ultrasonic.distance_cm()', generator.ORDER_ATOMIC];
  generator.forBlock.servo_angle = b => `servo.write(${b.getFieldValue('ANGLE')})\n`;
  generator.forBlock.servo_sweep = b => `servo.sweep(${b.getFieldValue('FROM')}, ${b.getFieldValue('TO')})\n`;
  generator.forBlock.bluetooth_send = b => `bluetooth.send(${text(b.getFieldValue('TEXT'))})\n`;
  generator.forBlock.bluetooth_receive = () => ['bluetooth.receive()', generator.ORDER_ATOMIC];
  generator.forBlock.oled_text = b => `oled.text(${text(b.getFieldValue('TEXT'))})\n`;
  generator.forBlock.oled_number = b => `oled.number(${b.getFieldValue('VALUE')})\n`;
  generator.forBlock.oled_clear = () => 'oled.clear()\n';
}

function toolboxFor(boardId) {
  const categoryClasses = {行空板:'cat-board',扩展模块:'cat-module',控制:'cat-control',运算符:'cat-operator'};
  const category = (name, colour, contents, cssConfig={}) => ({ kind:'category', name, colour, contents, cssConfig:{container:categoryClasses[name] || 'cat-module',...cssConfig} });
  const block = type => ({ kind:'block', type });
  const label = text => ({kind:'label', text});
  const sharedControl = category('控制','#ffab19',[block('board_wait'),block('control_wait_until'),block('board_repeat'),block('control_repeat_until'),block('control_if'),block('control_if_else'),block('control_if_elseif'),block('board_forever')]);
  const sharedOperators = category('运算符','#59c059',operatorTypes.map(type=>referenceToolboxBlock(type)));
  const variables = { kind:'category', name:'变量', colour:'#ff8c1a', custom:'MIND_VARIABLES', cssConfig:{container:'cat-variable'} };
  const procedures = { kind:'category', name:'函数', colour:'#ff6680', custom:'MIND_PROCEDURES', cssConfig:{container:'cat-function'} };
  const moduleCategories = selectedModules.length ? [category('扩展模块','#25aa91', selectedModules.flatMap(id => [label(moduleCatalog[id].name), ...moduleCatalog[id].blocks.map(block)]))] : [];
  if(boardId==='m10')return {kind:'categoryToolbox',contents:[sharedControl,sharedOperators,variables,procedures,
    ...(k10Added?[category('行空板M10','#5b3fe8',[block('m10_start'),...m10Groups.flatMap(group=>[label(group.name),...group.types.map(m10ToolboxBlock)])],{container:'cat-board'})]:[])]};
  if (boardId === 'k10') return { kind:'categoryToolbox', contents:[
    sharedControl, sharedOperators, variables, procedures, ...moduleCategories,
    ...(k10Added ? [category('行空板K10','#5b3fe8',[
      block('board_start'),
      ...k10NativeGroups.flatMap(group=>[label(group.name),...group.types.map(type=>referenceToolboxBlock(type))])
    ],{container:'cat-board'})] : [])
  ]};
  if (boardId === 'microbit') return { kind:'categoryToolbox', contents:[
    category('事件','#d9a426',[block('board_start'),block('button_event'),block('tilt_event')]),
    category('显示','#4a78ff',[block('microbit_icon'),block('microbit_text'),block('microbit_led_plot')]),
    category('声音','#ef7b48',[block('tone_play')]),
    category('传感器','#20b593',[block('serial_sensors')]), ...moduleCategories, sharedControl, sharedOperators, variables, procedures
  ]};
  return { kind:'categoryToolbox', contents:[
    category('事件','#d9a426',[block('board_start')]),
    category('输出','#15a4bb',[block('arduino_led'),block('arduino_digital'),block('arduino_pwm')]),
    category('串口','#20b593',[block('arduino_serial')]), ...moduleCategories, sharedControl, sharedOperators, variables, procedures
  ]};
}

function initBlockly() {
  defineBlocks();
  // Keep the quote marks inside the white string reporter. Blockly's stock
  // quote images reserve their original width even when visually scaled.
  class CompactStringInput extends Blockly.FieldTextInput {
    positionTextElement_(...args){
      super.positionTextElement_(...args);
      this.textElement_?.setAttribute('x',String(this.size_.width/2));
      this.textElement_?.setAttribute('text-anchor','middle');
    }
    updateSize_(...args){
      super.updateSize_(...args);
      // Blockly reserves generous editor padding; the surrounding quote fields
      // already provide the visual spacing for this literal.
      this.size_.width=Math.max(22,this.size_.width-14);
      this.size_.height=this.getConstants().FIELD_TEXT_HEIGHT;
      this.positionTextElement_(0,0);
      this.positionBorderRect_();
    }
  }
  Blockly.Blocks.text={init:function(){
    this.appendDummyInput()
      .appendField(new Blockly.FieldLabel('"','string-quote'))
      .appendField(new CompactStringInput(''),'TEXT')
      .appendField(new Blockly.FieldLabel('"','string-quote'));
    this.setOutput(true,'String');
    this.setTooltip('文本');
  }};
  // Give string literals a thinner capsule without scaling their text or
  // changing the geometry of numbers and other reporter blocks.
  class CompactStringRenderInfo extends Blockly.zelos.RenderInfo {
    createRows_(){
      super.createRows_();
      this.topRow.minHeight=2;
      this.bottomRow.minHeight=2;
      for(const row of this.inputRows)row.minHeight=24;
    }
  }
  class BoardLabRenderer extends Blockly.zelos.Renderer {
    makeRenderInfo_(block){
      return block.type==='text'?new CompactStringRenderInfo(this,block):super.makeRenderInfo_(block);
    }
  }
  Blockly.blockRendering.register('boardlab',BoardLabRenderer);
  Object.keys(Blockly.Blocks).filter(type => /^(logic_|math_|text)/.test(type)||/^(variables_|procedures_|lists_)/.test(type)).forEach(type => {
    const definition = Blockly.Blocks[type];
    if (!definition?.init) return;
    const init = definition.init;
    definition.init = function() {
      init.call(this);
      this.setInputsInline(true);
      this.setStyle(type.startsWith('variables_')||type==='math_change'||type.startsWith('lists_')?'variable_blocks':type.startsWith('procedures_')?'procedure_blocks':'operator_blocks');
      if(type==='math_number'||type==='text'){
        const initSvg=this.initSvg;
        this.initSvg=function(){initSvg.call(this);this.getSvgRoot().classList.add('literal-input-block');};
      }
    };
  });
  definePythonGenerators();
  defineReferenceGenerators();
  defineK10NativeGenerators();
  defineM10PythonGenerators();
  const theme = Blockly.Theme.defineTheme('boardlab', {
    base: Blockly.Themes.Zelos,
    blockStyles: {
      board_blocks:{colourPrimary:'#5b3fe8',colourSecondary:'#4930c5',colourTertiary:'#372394'},
      event_blocks:{colourPrimary:'#e5aa1c',colourSecondary:'#f5c751',colourTertiary:'#b47c0c'},
      display_blocks:{colourPrimary:'#4c7ee8',colourSecondary:'#7299ef',colourTertiary:'#315db9'},
      light_blocks:{colourPrimary:'#e74f83',colourSecondary:'#ef77a0',colourTertiary:'#b93664'},
      sound_blocks:{colourPrimary:'#f2784b',colourSecondary:'#f59a78',colourTertiary:'#bf542e'},
      sensor_blocks:{colourPrimary:'#25aa91',colourSecondary:'#50c4ae',colourTertiary:'#147965'},
      control_blocks:{colourPrimary:'#ffab19',colourSecondary:'#ffc45b',colourTertiary:'#c77d08'},
      operator_blocks:{colourPrimary:'#59c059',colourSecondary:'#45a745',colourTertiary:'#2d8233'},
      variable_blocks:{colourPrimary:'#ff8c1a',colourSecondary:'#e9770b',colourTertiary:'#bd5e08'},
      string_variable_blocks:{colourPrimary:'#8918ec',colourSecondary:'#7415cc',colourTertiary:'#5c0fa7'},
      procedure_blocks:{colourPrimary:'#ff6680',colourSecondary:'#e54c69',colourTertiary:'#bd3550'},
      module_blocks:{colourPrimary:'#25aa91',colourSecondary:'#50c4ae',colourTertiary:'#147965'},
      io_blocks:{colourPrimary:'#168ba1',colourSecondary:'#3ab1c5',colourTertiary:'#0c6374'},
      module_sensor_blocks:{colourPrimary:'#169d81',colourSecondary:'#3bc0a6',colourTertiary:'#0e725e'},
      module_actuator_blocks:{colourPrimary:'#d96936',colourSecondary:'#ed8d60',colourTertiary:'#9e4925'},
      module_communication_blocks:{colourPrimary:'#3e6de0',colourSecondary:'#6790f2',colourTertiary:'#294eac'},
      module_display_blocks:{colourPrimary:'#7753cf',colourSecondary:'#9a79e6',colourTertiary:'#563aa0'}
    },
    componentStyles: { workspaceBackgroundColour:'#fafafb', toolboxBackgroundColour:'#ffffff', flyoutBackgroundColour:'#f6f7f9', flyoutForegroundColour:'#4b5563', flyoutOpacity:1, scrollbarColour:'#c5cbd3', insertionMarkerColour:'#20cfaf', insertionMarkerOpacity:.6, cursorColour:'#159f88' },
    fontStyle:{family:'Microsoft YaHei, sans-serif',weight:'400',size:12},
    startHats:true
  });
  blocklyWorkspace = Blockly.inject('blocklyDiv', {
    toolbox: continuousDefinition(), theme, renderer:'boardlab', trashcan:false, sounds:true,
    plugins:{flyoutsVerticalToolbox:ContinuousFlyout},
    rendererOverrides:{MIN_BLOCK_HEIGHT:34,EMPTY_INLINE_INPUT_HEIGHT:26,DUMMY_INPUT_MIN_HEIGHT:26,FIELD_BORDER_RECT_Y_PADDING:3,EMPTY_STATEMENT_INPUT_HEIGHT:32,STATEMENT_INPUT_SPACER_MIN_WIDTH:176,STATEMENT_INPUT_PADDING_LEFT:20,BOTTOM_ROW_AFTER_STATEMENT_MIN_HEIGHT:26},
    move:{scrollbars:true,drag:true,wheel:true}, zoom:{controls:false,wheel:true,startScale:.8,maxScale:1.25,minScale:.05,scaleSpeed:1.12,pinch:true},
    grid:{spacing:22,length:1,colour:'#dde2e8',snap:false}
  });
  installReferenceEditing(blocklyWorkspace);
  installContinuousToolbox(blocklyWorkspace);
  blocklyWorkspace.addChangeListener(onWorkspaceChange);
  loadWorkspaceOrExample();
  setTimeout(() => {
    const toolbox = blocklyWorkspace.getToolbox();
    toolbox?.clearSelection?.();
  }, 0);
  window.addEventListener('resize', () => Blockly.svgResize(blocklyWorkspace));
}

function onWorkspaceChange(event) {
  if (!event.isUiEvent && !['collapsed','comment'].includes(event.element)) markProgramModified();
  if (event.type === Blockly.Events.BLOCK_DRAG) {
    $('#blocksView').classList.toggle('dragging', Boolean(event.isStart));
    setPaletteTrashDragging(Boolean(event.isStart));
    if (!event.isStart) {
      $('#blocksView').classList.remove('delete-near','delete-open');
      // A C-shaped loop inserted before a stack should enclose that stack.
      const draggedId=event.blockId;
      setTimeout(()=>wrapFollowingStackInLoop(blocklyWorkspace.getBlockById(draggedId)),0);
    }
  }
  if (!event.isUiEvent) {
    try { updateCode(); } finally { saveWorkspace(); }
  }
}

function saveWorkspace() {
  if (!blocklyWorkspace || !k10Added) return false;
  const data=Blockly.serialization.workspaces.save(blocklyWorkspace);projectWorkspaces[currentBoard]=data;
  try { localStorage.setItem(`boardlab-workspace-${currentBoard}`, JSON.stringify(data));localStorage.setItem(`boardlab-workspace-updated-${currentBoard}`,String(Date.now()));return true; } catch {return false}
}

function markProgramModified() {
  if(!hasRunProgram || programDirty)return;
  programDirty=true;
  $('#restartBtn').classList.add('needs-restart');
  const state=running?'运行中':programArmed?'等待事件':'已修改';
  $('#simStatus').className=running||programArmed?'running':'stopped';
  $('#simStatus').innerHTML=`<i></i>${state} · 请重新运行`;
  renderRuntimeDebug(true);
}

function wrapFollowingStackInLoop(loop){
  if(loop?.type!=='board_forever'||loop.isInFlyout||!loop.getNextBlock())return;
  const following=loop.getNextBlock();
  const body=loop.getInputTargetBlock('DO');
  let tail=body;
  while(tail?.getNextBlock())tail=tail.getNextBlock();
  const target=tail?.nextConnection||loop.getInput('DO')?.connection;
  if(!target||!following.previousConnection)return;
  Blockly.Events.setGroup(true);
  try {
    following.unplug(false);
    target.connect(following.previousConnection);
  } finally {Blockly.Events.setGroup(false);}
}

function loadWorkspaceOrExample(forceExample = false) {
  Blockly.Events.disable();
  try {
  blocklyWorkspace.clear();
  if(!k10Added) { updateCode(); return; }
  const cached=projectWorkspaces[currentBoard],saved=cached?JSON.stringify(cached):localStorage.getItem(`boardlab-workspace-${currentBoard}`);
  if (saved && !forceExample) {
    try { Blockly.serialization.workspaces.load(migrateMindWorkspace(JSON.parse(saved)), blocklyWorkspace); blocklyWorkspace.getTopBlocks(false).filter(block=>block.type.startsWith('procedures_def')).forEach(decorateMindProcedure);blocklyWorkspace.getAllBlocks(false).filter(block=>block.type==='screen_image').forEach(block=>k10ImageFromSource(k10ImageSettings(block).src));refreshContinuousToolbox();updateCode(); requestAnimationFrame(()=>blocklyWorkspace.scrollCenter()); return; } catch {}
  }
  Blockly.serialization.workspaces.load({blocks:{languageVersion:0,blocks:[{type:currentBoard==='m10'?'m10_start':'board_start',x:220,y:60}]}},blocklyWorkspace);
  updateCode();
  } finally {Blockly.Events.enable();}
}

function connectChain(types, fields = []) {
  const made = types.map((type,index) => {
    const b = blocklyWorkspace.newBlock(type); b.initSvg(); b.render();
    Object.entries(fields[index] || {}).forEach(([key,value]) => b.setFieldValue(String(value),key));
    return b;
  });
  for (let i=0;i<made.length-1;i++) if (made[i].nextConnection && made[i+1].previousConnection) made[i].nextConnection.connect(made[i+1].previousConnection);
  return made;
}

function serializedChain(items, x, y) {
  let root;
  let cursor;
  items.forEach(({type,fields,inputs})=>{
    const node={type};
    if(fields)node.fields={...fields};
    if(inputs)node.inputs=structuredClone(inputs);
    if(['screen_text','screen_text_line','speak_text'].includes(type)&&fields?.TEXT!==undefined){node.inputs={TEXT:{shadow:{type:'text',fields:{TEXT:fields.TEXT}}}};delete node.fields.TEXT;}
    if(!root){root=node;root.x=x;root.y=y;}else cursor.next={block:node};
    cursor=node;
  });
  return root;
}

function createExample(boardId, exampleId = 'hello') {
  if(boardId==='m10'){createM10Example(exampleId);return;}
  const examples = {
    hello: [
      serializedChain([{type:'board_start'},{type:'screen_clear',fields:{COLOR:'#000000'}},{type:'screen_text_line',fields:{TEXT:'你好，创客！',ROW:1,COLOR:'#ffffff'}},{type:'screen_update'},{type:'rgb_rainbow'}],290,55),
      serializedChain([{type:'button_event',fields:{BUTTON:'A'}},{type:'rgb_set',fields:{COLOR:'#ff5d8f'}}],290,370)
    ],
    display: [serializedChain([{type:'board_start'},{type:'screen_clear',fields:{COLOR:'#000000'}},{type:'screen_text_line',fields:{ROW:1,COLOR:'#ffffff'},inputs:{TEXT:{shadow:{type:'text',fields:{TEXT:'行空板'}}}}},{type:'screen_point',fields:{X:120,Y:160,COLOR:'#20cfaf'}},{type:'screen_update'}],290,55)],
    rgb: [serializedChain([{type:'board_start'},{type:'rgb_rainbow'},{type:'board_wait',fields:{SECONDS:1}},{type:'rgb_off'}],290,55)],
    button: [
      serializedChain([{type:'board_start'},{type:'screen_clear',fields:{COLOR:'#000000'}},{type:'screen_text_line',fields:{TEXT:'请按 A 或 B',ROW:1,COLOR:'#ffffff'}},{type:'screen_update'}],290,55),
      serializedChain([{type:'button_event',fields:{BUTTON:'A'}},{type:'rgb_set',fields:{COLOR:'#ff5d8f'}}],290,220),
      serializedChain([{type:'button_event',fields:{BUTTON:'B'}},{type:'rgb_set',fields:{COLOR:'#4c7ee8'}}],290,360)
    ],
    face: [
      serializedChain([{type:'board_start'},{type:'ai_mode',fields:{MODE:'人脸检测'}},{type:'camera_preview',fields:{SHOW:'YES'}}],40,40),
      serializedChain([{type:'button_event',fields:{BUTTON:'A',STATE:'DOWN'}},{type:'ai_learn'}],400,40),
      serializedChain([{type:'button_event',fields:{BUTTON:'B',STATE:'DOWN'}},{type:'ai_forget_all'}],400,200),
      {type:'board_start',x:40,y:270,next:{block:{type:'board_forever',inputs:{DO:{block:serializedChain([{type:'ai_recognize'},{type:'board_wait',fields:{SECONDS:2}}],0,0)}}}}}
    ],
    night: [],
    environment: []
  };
  examples.night=[{type:'board_start',x:0,y:0,next:{block:{type:'board_forever',inputs:{DO:{block:{type:'control_if_else',inputs:{CHECK:{block:{type:'logic_compare',fields:{OP:'LT'},inputs:{A:{block:{type:'k10_light'}},B:{block:{type:'math_number',fields:{NUM:400}}}}}},DO:{block:{type:'rgb_set',fields:{COLOR:'#ffd66b'}}},ELSE:{block:{type:'rgb_off'}}},next:{block:{type:'board_wait',fields:{SECONDS:.2}}}}}}}}}];
  const sensorLine=(row,label,sensor)=>({type:'screen_text_line',fields:{ROW:row,COLOR:'#000000'},inputs:{TEXT:{block:{type:'text_join',inputs:{ADD0:{block:{type:'text',fields:{TEXT:label}}},ADD1:{block:sensor}}}}}});
  examples.environment=[{type:'board_start',x:0,y:0,next:{block:{type:'board_forever',inputs:{DO:{block:serializedChain([
    sensorLine(1,'温度(℃): ',{type:'k10_environment',fields:{SENSOR:'temp'}}),
    sensorLine(2,'湿度(%): ',{type:'k10_environment',fields:{SENSOR:'humidity'}}),
    sensorLine(3,'环境光(lx): ',{type:'k10_light'}),
    {type:'screen_update'},{type:'board_wait',fields:{SECONDS:1}}
  ],0,0)}}}}}];
  const stacks = examples[exampleId] || examples.hello;
  Blockly.serialization.workspaces.load({blocks:{languageVersion:0,blocks:stacks}},blocklyWorkspace);
  Blockly.svgResize(blocklyWorkspace); requestAnimationFrame(()=>{blocklyWorkspace.scrollCenter();saveWorkspace();});
}

function updateCode() {
  if (!blocklyWorkspace) return;
  updateK10FactoryHelp();
  const languages=$('#codeLanguage');
  languages.querySelector('option[value="python"]').textContent=currentBoard==='m10'?'Python 3（M10 官方库）':'MicroPython（仿真接口）';
  languages.querySelector('option[value="k10-arduino"]').disabled=currentBoard==='m10';
  if(currentBoard==='m10'){
    languages.value='python';
    const result=generateM10Python(blocklyWorkspace);
    $('#codeFileName').textContent='main.py';$('#pythonCode').textContent=result.code;
    $('#codeDiagnostics').textContent=result.issues.length?result.issues.join('；'):'已按 M10 官方 Python 3 库生成；未在实板运行验证。仿真执行积木快照，下载工程包含图片与工作区。';
    $('#codeDiagnostics').classList.toggle('has-issues',result.issues.length>0);
    $('#copyCode').disabled=result.issues.length>0;$('#downloadArduino').hidden=false;$('#downloadArduino').disabled=result.issues.length>0;return;
  }
  if (currentBoard === 'k10' && $('#codeLanguage').value === 'k10-arduino') {
    const result = generateK10Arduino(blocklyWorkspace);
    $('#codeFileName').textContent = 'main.ino';
    $('#pythonCode').textContent = result.code;
    $('#codeDiagnostics').textContent = result.issues.length
      ? `尚不能编译：${result.issues.join('；')}`
      : result.images.length
        ? `包含 ${result.images.length} 张本地图片；请下载包含 arduino_image_cache.h 的完整工程。基础图片程序已用本机 K10 工具链编译，当前程序仍需自行编译验证。`
        : '已映射当前积木；仍需使用 K10 官方板卡包实际编译验证，才可用于上传。';
    $('#codeDiagnostics').classList.toggle('has-issues', result.issues.length > 0);
    $('#copyCode').disabled = result.issues.length > 0 || result.images.length > 0;
    $('#downloadArduino').hidden = false;
    $('#downloadArduino').disabled = result.issues.length > 0;
    return;
  }
  $('#codeFileName').textContent = 'main.py';
  $('#codeDiagnostics').textContent = '当前为板演仿真接口示意代码，不是 K10 官方固件程序。';
  $('#codeDiagnostics').classList.remove('has-issues');
  $('#copyCode').disabled = false;
  $('#downloadArduino').hidden = true;
  if (currentBoard === 'arduino') {
    $('#pythonCode').textContent = generateArduinoCode();
    return;
  }
  const generator = window.python?.pythonGenerator;
  let code = generator ? generator.workspaceToCode(blocklyWorkspace) : '# 代码生成器未加载';
  const moduleImports = selectedModules.map(id=>`from boardlab_modules import ${id}`).join('\n');
  const headers = currentBoard === 'k10' ? `from boardlab import K10\nimport time\n${moduleImports}\n\nboard = K10()\n` : `from microbit import *\nimport music\nimport time\n${moduleImports}\n`;
  $('#pythonCode').textContent = headers + '\n' + code;
}

function generateArduinoCode() {
  const lineFor = block => {
    if (!block) return '';
    const f = name => block.getFieldValue(name);
    const lines = {
      board_wait:`delay(${Math.round(Number(f('SECONDS'))*1000)});`, arduino_led:`digitalWrite(LED_BUILTIN, ${f('STATE')});`,
      arduino_digital:`digitalWrite(${f('PIN')}, ${f('STATE')});`, arduino_pwm:`analogWrite(${f('PIN')}, ${f('VALUE')});`, arduino_serial:`Serial.println(${JSON.stringify(f('TEXT'))});`,
      servo_angle:`servo.write(${f('ANGLE')});`, servo_sweep:`sweepServo(${f('FROM')}, ${f('TO')});`, bluetooth_send:`bluetooth.println(${JSON.stringify(f('TEXT'))});`,
      oled_text:`oled.print(${JSON.stringify(f('TEXT'))});`, oled_number:`oled.print(${f('VALUE')});`, oled_clear:'oled.clearDisplay();'
    };
    return lines[block.type] || `// ${block.toString()}`;
  };
  const program=[];
  blocklyWorkspace.getTopBlocks(true).filter(b=>b.type==='board_start').forEach(root=>{let b=root.getNextBlock();while(b){program.push(`  ${lineFor(b)}`);b=b.getNextBlock();}});
  const moduleHeaders = [selectedModules.includes('servo')?'#include <Servo.h>\nServo servo;':'',selectedModules.includes('oled')?'#include <Adafruit_SSD1306.h>\nAdafruit_SSD1306 oled(128, 64);':''].filter(Boolean).join('\n');
  return `// 板演自动生成 · Arduino Uno R3\n${moduleHeaders}\n\nvoid setup() {\n  pinMode(LED_BUILTIN, OUTPUT);\n  Serial.begin(9600);\n}\n\nvoid loop() {\n${program.join('\n') || '  // 从左侧拖入并拼接积木'}\n}\n`;
}

function blockValue(block) {
  if (!block) return '';
  if(typeof m10Value==='function'){const m10=m10Value(block);if(m10!==undefined)return m10;}
  const native=nativeK10Value(block);if(native!==undefined)return native;
  const reference=referenceValue(block);
  if(reference!==undefined)return reference;
  const child = name => blockValue(block.getInputTargetBlock(name));
  switch (block.type) {
    case 'logic_boolean': return block.getFieldValue('BOOL') === 'TRUE';
    case 'logic_negate': return !child('BOOL');
    case 'logic_operation': return block.getFieldValue('OP') === 'AND' ? Boolean(child('A')) && Boolean(child('B')) : Boolean(child('A')) || Boolean(child('B'));
    case 'logic_compare': {
      const a=child('A'), b=child('B');
      return ({EQ:()=>a==b,NEQ:()=>a!=b,LT:()=>a<b,LTE:()=>a<=b,GT:()=>a>b,GTE:()=>a>=b})[block.getFieldValue('OP')]?.() ?? false;
    }
    case 'math_number': return Number(block.getFieldValue('NUM'));
    case 'math_arithmetic': {
      const a=Number(child('A')), b=Number(child('B'));
      return ({ADD:()=>a+b,MINUS:()=>a-b,MULTIPLY:()=>a*b,DIVIDE:()=>b?a/b:0,POWER:()=>a**b})[block.getFieldValue('OP')]?.() ?? 0;
    }
    case 'text': return block.getFieldValue('TEXT');
    case 'dht_temperature': return sensorState.temp;
    case 'dht_humidity': return sensorState.humidity;
    case 'ultrasonic_distance': return sensorState.distance;
    default: return false;
  }
}

function* runStack(start, depth=0, buttonSnapshot=null) {
  if (depth > 20) return;
  const read=target=>{
    const previous=activeButtonSnapshot;activeButtonSnapshot=buttonSnapshot;
    try{return blockValue(target)}finally{activeButtonSnapshot=previous}
  };
  const condition=(block,target,label)=>recordRuntimeCondition(block,read(target),label);
  for (let block=start; block; block=block.getNextBlock()) {
    const branch = name => block.getInputTargetBlock(name);
    switch (block.type) {
      case 'board_repeat': {
        const n=Math.max(0,Math.trunc(Number(block.getFieldValue('COUNT'))));
        if(!Number.isSafeInteger(n)){log('程序','循环次数必须是有限的非负整数');break;}
        if(!n)yield {block,control:true,buttonSnapshot,delay:20};
        for (let i=0;i<n;i++) { yield {block,control:true,buttonSnapshot,delay:20}; yield* runStack(branch('DO'),depth+1,buttonSnapshot); }
        break;
      }
      case 'board_forever':
        while (true) { const scan=captureButtonSnapshot();yield {block,control:true,cycle:true,buttonSnapshot:scan,delay:20}; yield* runStack(branch('DO'),depth+1,scan); }
      case 'control_wait_until':
        while (true) {yield {block,control:true,cycle:true,buttonSnapshot,delay:20};if(recordRuntimeCondition(block,blockValue(branch('CHECK')),'等待条件'))break;}
        break;
      case 'control_repeat_until':
        while (true) {yield {block,control:true,cycle:true,buttonSnapshot,delay:20};if(recordRuntimeCondition(block,blockValue(branch('CHECK')),'停止循环条件'))break;yield* runStack(branch('DO'),depth+1,captureButtonSnapshot());}
        break;
      case 'control_if_elseif': {
        yield {block,control:true,buttonSnapshot,delay:20};
        let chosen=condition(block,branch('CHECK'),'如果')?'DO':'ELSE';
        if(chosen==='ELSE') for(let i=0;i<block.elseIfCount_;i++) if(condition(block,branch(`CHECK${i+2}`),`否则如果 ${i+1}`)) {chosen=`DO${i+2}`;break;}
        yield* runStack(branch(chosen),depth+1,buttonSnapshot);
        break;
      }
      case 'control_if':
      case 'control_if_else':
        yield {block,control:true,buttonSnapshot,delay:20};
        yield* runStack(branch(condition(block,branch('CHECK'),'如果') ? 'DO' : 'ELSE'),depth+1,buttonSnapshot);
        break;
      case 'controls_if': {
        yield {block,control:true,buttonSnapshot,delay:20};
        let chosen='ELSE';
        for(let i=0;block.getInput(`IF${i}`);i++) if(condition(block,branch(`IF${i}`),i?`否则如果 ${i}`:'如果')) {chosen=`DO${i}`;break;}
        yield* runStack(branch(chosen),depth+1,buttonSnapshot);
        break;
      }
      case 'controls_whileUntil':
        while (true) {yield {block,control:true,cycle:true,buttonSnapshot,delay:20};if(!recordRuntimeCondition(block,Boolean(blockValue(branch('BOOL'))) === (block.getFieldValue('MODE')==='WHILE'),'继续循环条件'))break;yield* runStack(branch('DO'),depth+1,captureButtonSnapshot());}
        break;
      case 'controls_for': {
        const from=Number(read(branch('FROM'))), to=Number(read(branch('TO'))), by=Math.abs(Number(read(branch('BY'))))||1;
        const distance=Math.abs(to-from)/by;
        const count=Math.floor(distance+Number.EPSILON*8*Math.max(1,distance))+1;
        if(![from,to,by].every(Number.isFinite)||!Number.isSafeInteger(count)){log('程序','计数循环范围无效');break;}
        const variable=block.getFieldValue('VAR'),step=from<=to?by:-by;
        for(let i=0;i<count;i++){
          runtimeVariables.set(variable,from+i*step);
          yield {block,control:true,buttonSnapshot,delay:20};yield* runStack(branch('DO'),depth+1,buttonSnapshot);
        }
        break;
      }
      case 'procedures_callnoreturn': {
        const definition=runtimeWorkspace?.getTopBlocks(false).find(candidate=>candidate.type==='procedures_defnoreturn'&&candidate.getFieldValue('NAME')===block.getFieldValue('NAME'));
        if(!definition)break;
        const ids=definition.getVarModels().map(model=>model.getId());
        const values=ids.map((_,index)=>read(branch(`ARG${index}`)));
        const previous=ids.map(id=>({id,exists:runtimeVariables.has(id),value:runtimeVariables.get(id)}));
        ids.forEach((id,index)=>runtimeVariables.set(id,values[index]));
        try{yield {block,control:true,buttonSnapshot,delay:20};yield* runStack(definition.getInputTargetBlock('STACK'),depth+1,buttonSnapshot);}
        finally{previous.forEach(({id,exists,value})=>exists?runtimeVariables.set(id,value):runtimeVariables.delete(id));}
        break;
      }
      default: yield {block,buttonSnapshot,delay:block.type==='board_wait'?Number(block.getFieldValue('SECONDS'))*1000:block.type==='note_play'?Number(block.getFieldValue('BEAT'))*500:block.type==='tone_play'?Number(block.getFieldValue('DURATION'))*1000:0};
    }
  }
}

function* programSteps(roots) {
  for (const root of roots) yield* runStack(root.getNextBlock());
}

function executeRuntimeInstruction(instruction){
  const previous=activeButtonSnapshot;activeButtonSnapshot=instruction.buttonSnapshot||null;
  try{executeBlock(instruction.block)}finally{activeButtonSnapshot=previous}
}

async function runProgram(startPaused=false) {
  if(currentMode!=='virtual'){toast('真实模式的连接与上传功能正在准备中');return;}
  if(!k10Added) {openExtensions('board');return;}
  if(currentBoard==='m10'){
    const result=generateM10Python(blocklyWorkspace);
    if(result.issues.length){toast('M10 程序还有未完成的积木，请查看代码区提示');updateCode();return;}
  }
  const nextWorkspace=new Blockly.Workspace();
  let roots,handlers;
  try {
    Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(blocklyWorkspace),nextWorkspace);
    roots=nextWorkspace.getTopBlocks(true).filter(b=>b.type===(currentBoard==='m10'?'m10_start':'board_start')&&b.getNextBlock());
    handlers=nextWorkspace.getTopBlocks(false).filter(b=>(currentBoard==='m10'?['m10_touch_event','m10_key_event']:['button_event','tilt_event']).includes(b.type)&&b.getNextBlock());
  } catch(error) {nextWorkspace.dispose();console.error('程序快照失败',error);toast('程序无法运行，请检查积木');return;}
  if (!roots.length && !handlers.length) {nextWorkspace.dispose();toast('先从左侧拖出积木并拼接程序');return;}
  stopProgram(false); runtimeVariables.clear(); resetVirtualRuntime();initializeK10Screen(nextWorkspace);
  const requestId=++runRequestId;
  runtimeWorkspace=nextWorkspace;hasRunProgram=true;programDirty=false;
  $('#restartBtn').disabled=false;$('#restartBtn').classList.remove('needs-restart');
  $('#runBtn').disabled = true; $('#stopBtn').disabled = false;
  $('#simStatus').className = 'running'; $('#simStatus').innerHTML = '<i></i>准备图片…';
  const failedImages=await prepareK10Images(nextWorkspace);
  if(requestId!==runRequestId)return;
  failedImages.forEach(name=>log('图片',`图片无法解码：${name}`));
  runStartedAt=performance.now();running=true;programArmed=true;
  $('#simStatus').className = 'running'; $('#simStatus').innerHTML = '<i></i>运行中';
  log('运行', `${boardProfiles[currentBoard].name} 程序已启动`);
  runtimeDebugger=createRuntimeDebugger(startPaused===true);
  runtimeDebugger.add(programSteps(roots),()=>{
    if(requestId===runRequestId){
      activeBlock=null;running=false;
      $('#runBtn').disabled=false;$('#stopBtn').disabled=!handlers.length;
      $('#simStatus').className=handlers.length?'running':programDirty?'stopped':'';
      $('#simStatus').innerHTML='<i></i>'+(programDirty?(handlers.length?'等待事件 · 请重新运行':'已修改 · 请重新运行'):(handlers.length?'等待事件':'已完成'));
      if(!handlers.length)programArmed=false;
    }
  });
  renderRuntimeDebug(true);
}

function stopProgram(writeLog = true) {
  runRequestId++;
  runtimeDebugger?.dispose();runtimeDebugger=null;
  pendingScreenFrame=null;screenFrameDeferred=false;
  blocklyWorkspace?.highlightBlock?.(null);
  running = false; programArmed=false; clearTimeout(runTimer);
  stopNativeMedia();
  if(typeof cancelK10FactoryVoicePulse==='function')cancelK10FactoryVoicePulse();
  eventTimers.forEach(clearTimeout); eventTimers.clear();
  buttonReleaseTimers.forEach(clearTimeout);buttonReleaseTimers.clear();
  pendingButtonPresses.clear();activeButtonSnapshot=null;
  runtimeWorkspace?.dispose();runtimeWorkspace=null;
  resetBoardDisplay();
  activeBlock = null;
  $('#runBtn').disabled = currentMode!=='virtual'||!k10Added; $('#stopBtn').disabled = true;
  $('#restartBtn').disabled=currentMode!=='virtual'||!k10Added||!hasRunProgram;
  $('#simStatus').className = writeLog||programDirty ? 'stopped' : '';
  $('#simStatus').innerHTML = `<i></i>${programDirty?'已修改 · 请重新运行':writeLog?'已停止':'待运行'}`;
  if (writeLog) log('停止','程序已停止');
  renderRuntimeDebug(true);
}

function resetBoardDisplay(){
  if(currentBoard==='m10'&&typeof m10Reset==='function'){m10Reset();return;}
  screenBuffer=null;screenLineWidth=1;displayMode='idle';
  setRgb(['#000000','#000000','#000000']);
  const lcd=$('#lcd'),content=$('#lcdContent');
  if(lcd)lcd.style.background='';
  if(content){
    for(const key of ['width','height','left','top','transform'])content.style[key]='';
    content.innerHTML='';
  }
  $('#buttonA')?.classList.remove('pressed');
  $('#buttonB')?.classList.remove('pressed');
}

function executeBlock(block) {
  if(typeof m10Execute==='function'&&m10Execute(block))return;
  if(nativeK10Execute(block)||referenceExecute(block))return;
  const value = name => block.getFieldValue(name);
  switch (block.type) {
    case 'screen_text': displayMode='text'; setScreen(String(blockValue(block.getInputTargetBlock('TEXT'))||''),'',value('COLOR')); break;
    case 'screen_sensors': displayMode='environment'; showSensorScreen(); break;
    case 'screen_clear': {const c=getScreenBuffer();c.background=value('COLOR');const ctx=c.getContext('2d');if(window.K10Vision?.displaying())ctx.clearRect(0,0,c.width,c.height);else{ctx.fillStyle=c.background;ctx.fillRect(0,0,c.width,c.height);}presentScreenBuffer();break;}
    case 'rgb_set': setRgb([value('COLOR'),value('COLOR'),value('COLOR')]); break;
    case 'rgb_rainbow': setRgb(['#ff5d8f','#2fe0b6','#4a78ff']); break;
    case 'rgb_off': writeK10Rgb(value('LED')||'all','#000000');break;
    case 'tone_play': playTone(value('FREQ'),value('DURATION')); log('声音',`${value('FREQ')} Hz`); break;
    case 'speak_text': {const text=String(blockValue(block.getInputTargetBlock('TEXT'))||'');speak(text);log('语音',text);break;}
    case 'serial_sensors': log('数据',`温度 ${sensorState.temp}°C · 湿度 ${sensorState.humidity}% · 光线 ${sensorState.light}lx`); break;
    case 'microbit_icon': showMicrobitIcon(value('ICON')); break;
    case 'microbit_text': log('点阵',`滚动显示 ${value('TEXT')}`); showMicrobitIcon('text'); break;
    case 'microbit_led_plot': plotMicrobit(Number(value('X')),Number(value('Y'))); break;
    case 'arduino_led': setArduinoLed(value('STATE') === 'HIGH'); log('D13',value('STATE')); break;
    case 'arduino_digital': log(`D${value('PIN')}`,value('STATE')); break;
    case 'arduino_pwm': log(`PWM ${value('PIN')}`,value('VALUE')); break;
    case 'arduino_serial': log('串口',value('TEXT')); break;
    case 'servo_angle': sensorState.servo=Number(value('ANGLE')); log('舵机',`转到 ${sensorState.servo}°`); renderModuleDock(); break;
    case 'servo_sweep': sensorState.servo=Number(value('TO')); log('舵机',`${value('FROM')}° ↔ ${value('TO')}°`); renderModuleDock(); break;
    case 'bluetooth_send': log('蓝牙',`发送：${value('TEXT')}`); break;
    case 'oled_text': sensorState.oled=value('TEXT'); log('OLED',`显示：${sensorState.oled}`); renderModuleDock(); break;
    case 'oled_number': sensorState.oled=value('VALUE'); log('OLED',`显示数值：${sensorState.oled}`); renderModuleDock(); break;
    case 'oled_clear': sensorState.oled=''; log('OLED','屏幕已清空'); renderModuleDock(); break;
  }
}

function moduleDockValue(id) {
  if (id === 'dht11') return `${sensorState.temp}°C · ${sensorState.humidity}%`;
  if (id === 'ultrasonic') return `${sensorState.distance} cm`;
  if (id === 'servo') return `${sensorState.servo}°`;
  if (id === 'bluetooth') return '已连接';
  if (id === 'oled') return sensorState.oled || '待显示';
  return '';
}

function renderModuleDock() {
  const dock = $('#moduleDock');
  if (!dock) return;
  dock.innerHTML = selectedModules.map(id => `<span>${escapeHtml(moduleCatalog[id].name.split(' ')[0])}<b>${escapeHtml(moduleDockValue(id))}</b></span>`).join('');
  dock.hidden = selectedModules.length === 0;
}

function renderSimulator(boardId) {
  if(!k10Added) {
    $('#simStage').innerHTML='<div class="sim-empty"><b>选择主控板</b><p>从扩展添加行空板 K10，开始虚拟仿真</p><button type="button" id="chooseBoardBtn">＋ 添加主控板</button></div>';
    $('#chooseBoardBtn').addEventListener('click',()=>openExtensions('board'));
    $('.sensor-panel').hidden=true;
    return;
  }
  $('.sensor-panel').hidden=false;
  if(boardId==='m10'){renderM10Simulator();return;}
  displayMode = 'idle';
  const stage = $('#simStage');
  stage.innerHTML = `<div class="board-frame"><div class="k10-board" aria-label="行空板 K10 正面仿真"><div class="lcd" id="lcd"><div class="lcd-content" id="lcdContent"></div></div></div><div class="rgb-row" aria-label="三颗 RGB 灯"><span id="led0"></span><span id="led1"></span><span id="led2"></span></div></div><div class="board-controls"><div class="hardware-control"><button class="hardware-btn" id="buttonA" type="button"><b>A</b><span>按键</span></button><button class="key-map" data-button="A" type="button">键盘 <kbd id="keyA">A</kbd></button></div><div class="hardware-control"><button class="hardware-btn" id="buttonB" type="button"><b>B</b><span>按键</span></button><button class="key-map" data-button="B" type="button">键盘 <kbd id="keyB">B</kbd></button></div><button class="hardware-btn reset" id="boardReset" type="button"><b>↻</b><span>复位</span></button></div>`;
  stage.insertAdjacentHTML('beforeend','<div class="module-dock" id="moduleDock" hidden></div>');
  renderModuleDock();
  bindBoardControls(); renderKeyMap(); renderSensorPanel();
}

function renderSensorPanel() {
  if(currentBoard==='m10'){renderM10Sensors();return;}
  const panel = $('.sensor-panel');
  const sensorControl=(name,label,min,max,unit)=>`<label class="sensor-fixed-control"><span>${label}</span><div class="sensor-adjust"><input id="${name}Input" type="range" min="${min}" max="${max}" value="${sensorState[name]}"><span class="sensor-fixed-value"><input id="${name}Value" type="number" min="${min}" max="${max}" step="any" value="${sensorState[name]}" aria-label="${label}固定值">${unit}</span></div></label>`;
  const moduleInputs = [
    selectedModules.includes('dht11') ? `<label><span>DHT11 温度 <output id="moduleTempOut">${sensorState.temp}°C</output></span><input id="moduleTempInput" type="range" min="0" max="50" value="${sensorState.temp}"></label>` : '',
    selectedModules.includes('ultrasonic') ? `<label><span>超声波距离 <output id="distanceOut">${sensorState.distance} cm</output></span><input id="distanceInput" type="range" min="27" max="800" value="${sensorState.distance}"></label>` : '',
    selectedModules.includes('servo') ? `<label><span>舵机角度 <output id="servoOut">${sensorState.servo}°</output></span><input id="servoInput" type="range" min="0" max="180" value="${sensorState.servo}"></label>` : ''
  ].join('');
  if (currentBoard === 'arduino') panel.innerHTML = `<div class="sensor-tabs"><button class="active" type="button">引脚与扩展模块</button></div><div class="sensor-page active" id="environmentSensors"><label><span>模拟 A0 <output id="analogOut">${sensorState.analog}</output></span><input id="analogInput" type="range" min="0" max="1023" value="${sensorState.analog}"></label><label><span>数字 D2 <output id="digitalOut">${sensorState.digital}</output></span><input id="digitalRange" type="range" min="0" max="1" value="${sensorState.digital}"></label>${moduleInputs}</div>`;
  else panel.innerHTML = `<div class="sensor-tabs"><button class="active" data-sensor-tab="environment" type="button">虚拟环境输入</button><button data-sensor-tab="motion" type="button">虚拟姿态</button></div><div class="sensor-page active" id="environmentSensors">${sensorControl('temp','温度',-10,50,'°C')}${currentBoard==='k10'?sensorControl('humidity','湿度',0,100,'%')+sensorControl('light','环境光',0,2000,'lx'):''}${moduleInputs}</div><div class="sensor-page" id="motionSensors"><div class="tilt-pad"><button data-tilt="forward" type="button">↑<small>前倾</small></button><button data-tilt="left" type="button">←<small>左倾</small></button><button data-tilt="flat" class="flat ${sensorState.tilt==='flat'?'active':''}" type="button">●<small>平放</small></button><button data-tilt="right" type="button">→<small>右倾</small></button><button data-tilt="back" type="button">↓<small>后倾</small></button></div><div class="axis-values"><span>X <b id="axisX">${sensorState.x}</b></span><span>Y <b id="axisY">${sensorState.y}</b></span><span>Z <b id="axisZ">${sensorState.z}</b></span></div></div>`;
  if (currentBoard === 'k10' && moduleInputs) {
    const extraLabels = [...$('#environmentSensors').querySelectorAll('label')].slice(3);
    const details = document.createElement('details');
    details.className = 'module-inputs';
    details.innerHTML = '<summary>外接模块输入</summary><div></div>';
    extraLabels.forEach(label => details.querySelector('div').append(label));
    $('#environmentSensors').append(details);
  }
  bindSensorControls();
}

function bindBoardControls() {
  $('#buttonA')?.addEventListener('click',()=>triggerButton('A'));
  $('#buttonB')?.addEventListener('click',()=>triggerButton('B'));
  $('#digitalInput')?.addEventListener('click',()=>{sensorState.digital=sensorState.digital?0:1; $('#digitalOut').textContent=sensorState.digital; $('#digitalRange').value=sensorState.digital; log('D2',`输入 ${sensorState.digital}`);});
  $('#boardReset')?.addEventListener('click',()=>{stopProgram(false); renderSimulator(currentBoard); log('系统',`${boardProfiles[currentBoard].name} 已复位`);});
  $$('.key-map').forEach(button=>button.addEventListener('click',()=>{keyMappingTarget=button.dataset.button; $$('.key-map').forEach(x=>x.classList.toggle('listening',x===button)); toast(`按下一个键，绑定到主板按键 ${keyMappingTarget}`);}));
}

function bindSensorControls() {
  [['temp',-10,50],['humidity',0,100],['light',0,2000]].forEach(([name,min,max])=>{
    const slider=$(`#${name}Input`),number=$(`#${name}Value`);if(!slider||!number)return;
    const apply=raw=>{const value=Number(raw);if(raw===''||!Number.isFinite(value)){number.value=sensorState[name];return;}sensorState[name]=Math.max(min,Math.min(max,value));slider.value=sensorState[name];number.value=sensorState[name];if(name==='temp'&&$('#moduleTempInput')){$('#moduleTempInput').value=sensorState.temp;$('#moduleTempOut').textContent=`${sensorState.temp}°C`;}if(currentBoard==='k10'&&displayMode==='environment')showSensorScreen();renderModuleDock();};
    slider.addEventListener('input',()=>apply(slider.value));number.addEventListener('change',()=>apply(number.value));number.addEventListener('keydown',event=>{if(event.key==='Enter')number.blur()});
  });
  $('#moduleTempInput')?.addEventListener('input',e=>{sensorState.temp=Number(e.target.value);$('#moduleTempOut').textContent=`${sensorState.temp}°C`;if($('#tempInput'))$('#tempInput').value=sensorState.temp;if($('#tempValue'))$('#tempValue').value=sensorState.temp;renderModuleDock();});
  $('#distanceInput')?.addEventListener('input',e=>{sensorState.distance=Number(e.target.value);$('#distanceOut').textContent=`${e.target.value} cm`;renderModuleDock();});
  $('#servoInput')?.addEventListener('input',e=>{sensorState.servo=Number(e.target.value);$('#servoOut').textContent=`${e.target.value}°`;renderModuleDock();});
  $('#analogInput')?.addEventListener('input',e=>{sensorState.analog=Number(e.target.value); $('#analogOut').textContent=e.target.value;});
  $('#digitalRange')?.addEventListener('input',e=>{sensorState.digital=Number(e.target.value); $('#digitalOut').textContent=e.target.value;});
  $$('[data-sensor-tab]').forEach(button=>button.addEventListener('click',()=>{$$('[data-sensor-tab]').forEach(x=>x.classList.toggle('active',x===button)); $$('.sensor-page').forEach(x=>x.classList.remove('active')); const environment=button.dataset.sensorTab==='environment'; $(`#${environment?'environmentSensors':'motionSensors'}`).classList.add('active');}));
  $$('[data-tilt]').forEach(button=>button.addEventListener('click',()=>{const tilt=button.dataset.tilt; sensorState.tilt=tilt; const axes={flat:[0,0,1000],forward:[0,720,690],back:[0,-720,690],left:[-720,0,690],right:[720,0,690]}[tilt]; [sensorState.x,sensorState.y,sensorState.z]=axes; $$('#motionSensors button').forEach(x=>x.classList.toggle('active',x===button)); $('#axisX').textContent=axes[0]; $('#axisY').textContent=axes[1]; $('#axisZ').textContent=axes[2]; log('姿态',button.querySelector('small').textContent); triggerTilt(tilt);}));
}

function triggerButton(name,phase='DOWN',held=false) {
  const down=phase==='DOWN';
  if(buttonIsPressed(name)===down){
    if(down&&held){clearTimeout(buttonReleaseTimers.get(name));buttonReleaseTimers.delete(name);}
    return;
  }
  clearTimeout(buttonReleaseTimers.get(name));buttonReleaseTimers.delete(name);
  const wasChordPressed=buttonIsPressed('A+B');
  const element=$(`#button${name}`); element?.classList.toggle('pressed',down);
  renderRuntimeDebug(true);
  if(down&&!held)buttonReleaseTimers.set(name,setTimeout(()=>{buttonReleaseTimers.delete(name);triggerButton(name,'UP');},180));
  log('按键',`${name} ${phase==='DOWN'?'被按下':'已松开'}`);
  if(!programArmed)return;
  if(currentBoard==='m10')m10KeyEvent(name,phase);
  const chordPressed=buttonIsPressed('A+B');
  if(phase==='DOWN'){
    if(chordPressed){
      pendingButtonPresses.delete('A');pendingButtonPresses.delete('B');
      if(!wasChordPressed)pendingButtonPresses.add('A+B');
    }else pendingButtonPresses.add(name);
  }
  const triggeredButtons=chordPressed?['A+B']:[name];
  if(wasChordPressed!==chordPressed)triggeredButtons.push('A+B');
  const eventBlocks=runtimeWorkspace.getAllBlocks(false).filter(b=>b.type==='button_event'&&triggeredButtons.includes(b.getFieldValue('BUTTON'))&&(b.getFieldValue('STATE')||'DOWN')===(b.getFieldValue('BUTTON')==='A+B'?(chordPressed?'DOWN':'UP'):phase));
  eventBlocks.forEach(event=>executeConnected(event.getNextBlock()));
}
function buttonIsPressed(name){
  return name==='A+B' ? buttonIsPressed('A')&&buttonIsPressed('B') : !!$(`#button${name}`)?.classList.contains('pressed');
}
function captureButtonSnapshot(){
  const pendingA=pendingButtonPresses.delete('A'),pendingB=pendingButtonPresses.delete('B'),pendingChord=pendingButtonPresses.delete('A+B');
  const chord=buttonIsPressed('A+B')||pendingChord;
  if(currentBoard==='m10')return {A:buttonIsPressed('A')||pendingA||chord,B:buttonIsPressed('B')||pendingB||chord,'A+B':chord};
  return {A:!chord&&(buttonIsPressed('A')||pendingA),B:!chord&&(buttonIsPressed('B')||pendingB),'A+B':chord};
}
function buttonPressedForCondition(name){
  if(activeButtonSnapshot)return Boolean(activeButtonSnapshot[name]);
  const pending=pendingButtonPresses.delete(name);
  if(name!=='A+B'&&buttonIsPressed('A+B'))return false;
  return buttonIsPressed(name)||pending;
}
function triggerTilt(tilt){if(!programArmed)return;runtimeWorkspace.getAllBlocks(false).filter(b=>b.type==='tilt_event'&&b.getFieldValue('TILT')===tilt).forEach(event=>executeConnected(event.getNextBlock()));}
function executeConnected(block){
  if(!programArmed)return;
  if(!runtimeDebugger||runtimeDebugger.disposed)runtimeDebugger=createRuntimeDebugger();
  runtimeDebugger.add(runStack(block));
}

function setScreen(title,subtitle='',color='#fff',background=null){if(!$('#lcd'))return;pendingScreenFrame=null;if(background)$('#lcd').style.background=background;$('#lcdContent').innerHTML=title?`<strong style="color:${color}">${escapeHtml(title)}</strong>${subtitle?`<p>${escapeHtml(subtitle)}</p>`:''}`:'';}
function showSensorScreen(){if(!$('#lcd'))return;pendingScreenFrame=null;$('#lcd').style.background='linear-gradient(145deg,#0c6b83,#26355f)';$('#lcdContent').innerHTML=`<span class="lcd-kicker">ENVIRONMENT</span><strong>环境数据</strong><div class="sensor-readings"><span><em>温度</em><b>${sensorState.temp}<small>℃</small></b></span><span><em>湿度</em><b>${sensorState.humidity}<small>%</small></b></span><span><em>环境光</em><b>${sensorState.light}<small> lx</small></b></span></div>`;}
function setRgb(colors){colors.forEach((color,index)=>writeK10Rgb(index,color));}
function showMicrobitIcon(icon){const patterns={heart:[1,3,5,6,7,8,9,11,12,13,17],smile:[6,8,16,19,22,23,24],yes:[4,8,12,16,20,21],no:[0,4,6,8,12,16,18,20,24],text:[2,7,12,17,22]};const on=patterns[icon]||patterns.heart;$$('#microbitLeds i').forEach((led,index)=>led.classList.toggle('on',on.includes(index)));}
function plotMicrobit(x,y){const index=y*5+x;$$('#microbitLeds i')[index]?.classList.add('on');}
function setArduinoLed(on){$('#arduinoLed')?.classList.toggle('on',on);}
function playTone(freq=523,duration=.3){try{toneContext||=new(window.AudioContext||window.webkitAudioContext)();const osc=toneContext.createOscillator(),gain=toneContext.createGain();osc.frequency.value=Number(freq);gain.gain.setValueAtTime(.08,toneContext.currentTime);gain.gain.exponentialRampToValueAtTime(.001,toneContext.currentTime+Number(duration));osc.connect(gain).connect(toneContext.destination);osc.start();osc.stop(toneContext.currentTime+Number(duration));}catch{}}
function speak(text){if('speechSynthesis'in window){speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(text);utterance.rate=.6+(nativeRuntime.speed||0)*.3;speechSynthesis.speak(utterance);}}
function log(tag,message){const now=new Date().toLocaleTimeString('zh-CN',{hour12:false});$('#consoleOutput').insertAdjacentHTML('beforeend',`<p><time>${now}</time><span>${escapeHtml(tag)}</span>${escapeHtml(message)}</p>`);$('#consoleOutput').scrollTop=$('#consoleOutput').scrollHeight;}
function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(el._timer);el._timer=setTimeout(()=>el.classList.remove('show'),1800);}
function renderKeyMap(){if($('#keyA'))$('#keyA').textContent=keyMap.A===' '?'空格':keyMap.A.toUpperCase();if($('#keyB'))$('#keyB').textContent=keyMap.B===' '?'空格':keyMap.B.toUpperCase();}

function selectBoard(boardId, closeAfter = true) {
  if (!boardProfiles[boardId]) return;
  if(boardId!==currentBoard)saveWorkspace();
  const changed=boardId!==currentBoard || !k10Added; k10Added=true; localStorage.setItem('boardlab-k10-added','true');hasRunProgram=false;programDirty=false;$('#restartBtn').classList.remove('needs-restart');stopProgram(false); currentBoard=boardId; localStorage.setItem('boardlab-board',boardId);
  $('#resetProgram').disabled=false; $('#runBtn').disabled=currentMode!=='virtual'; $('#simBoardName').textContent=boardProfiles[boardId].name;
  $('.sim-panel').setAttribute('aria-label',boardProfiles[boardId].simName);
  $('[data-view="code"]').textContent='代码';
  updateExampleMenu();m10ImageEditor?.remove();m10ImageEditor=null;
  refreshContinuousToolbox(); if(changed)loadWorkspaceOrExample(); renderSimulator(boardId); updateCode(); renderExtensionLibrary();
  if (closeAfter) closeExtensions();
  log('扩展',`已切换到 ${boardProfiles[boardId].name}`);
  renderRuntimeDebug(true);
}
function toggleModule(moduleId) {
  if (!moduleCatalog[moduleId]) return;
  const wasAdded = selectedModules.includes(moduleId);
  selectedModules = wasAdded ? selectedModules.filter(id=>id!==moduleId) : [...selectedModules,moduleId];
  localStorage.setItem('boardlab-modules',JSON.stringify(selectedModules));
  markProgramModified();
  refreshContinuousToolbox();
  if(k10Added){renderModuleDock();renderSensorPanel()}else renderSimulator(currentBoard);
  renderExtensionLibrary(); updateCode();
  const action = wasAdded ? '已移除' : '已添加';
  toast(`${action} ${moduleCatalog[moduleId].name}`); log('扩展',`${action} ${moduleCatalog[moduleId].name}`);
}
function extensionItems(tab) {
  if (tab === 'board') return [
    ...Object.entries(boardProfiles).map(([id,item])=>({id,type:'board',...item})),
    ...Object.entries(upcomingBoardCatalog).map(([id,item])=>({id,type:'upcoming',...item}))
  ];
  return Object.entries(moduleCatalog).filter(([,item])=>item.tab===tab).map(([id,item])=>({id,type:'module',...item}));
}
function renderExtensionLibrary() {
  const query = ($('#boardSearch')?.value || '').trim().toLowerCase();
  const items = extensionItems(extensionActiveTab).filter(item=>`${item.name} ${item.sku} ${item.description}`.toLowerCase().includes(query));
  const grid = $('#boardGrid');
  if (!grid) return;
  grid.innerHTML = items.map(item=>{
    const selected = item.type==='board' ? k10Added && item.id===currentBoard : item.type==='module' && selectedModules.includes(item.id);
    const data = item.type==='board' ? `data-board="${item.id}"` : item.type==='module' ? `data-module="${item.id}"` : `data-upcoming="${item.id}"`;
    const imageClass = item.id==='k10' ? ' k10-image' : item.id==='m10'?' m10-image':'';
    const status = item.type==='upcoming' ? '即将支持' : selected?'已添加':'添加';
    const visual = item.image ? `<img src="${item.image}" alt="${escapeHtml(item.name)}">` : `<span class="board-placeholder">${escapeHtml(item.name)}</span>`;
    return `<button class="board-card ${selected?'selected module-added':''} ${item.type==='upcoming'?'upcoming':''}" ${data} type="button"><span class="board-visual${imageClass}">${visual}</span><span class="sku">${escapeHtml(item.sku)}</span><b>${escapeHtml(item.name)}</b><small>${escapeHtml(item.description)}</small><em>${status}</em></button>`;
  }).join('');
  $('#extensionEmpty').hidden = items.length > 0;
  grid.hidden = items.length === 0;
  $('#extensionSummary').textContent = extensionActiveTab==='board' ? 'K10 与 M10 基础仿真已可用；M10 AI、真实物联网和外接模块继续适配' : currentBoard==='m10'?'当前模块仅适配 K10；M10 外接模块将在核对官方生成规则后开放':`已添加 ${selectedModules.length} 个模块；模块积木集中在左侧“扩展模块”中`;
}
function setExtensionTab(tab) {
  extensionActiveTab=tab;
  $$('#extensionTabs button').forEach(button=>button.classList.toggle('active',button.dataset.extensionTab===tab));
  renderExtensionLibrary();
}
function openExtensions(tab='board'){extensionActiveTab=tab;$('#boardSearch').value='';setExtensionTab(tab);$('#extensionsModal').hidden=false;closeExampleMenu();setTimeout(()=>$('#boardSearch').focus(),40);}
function closeExtensions(){$('#extensionsModal').hidden=true;}

$$('.tab').forEach(button=>button.addEventListener('click',()=>{$$('.tab').forEach(x=>{x.classList.toggle('active',x===button);x.setAttribute('aria-selected',x===button);});const code=button.dataset.view==='code';$('#blocksView').hidden=code;$('#codeView').hidden=!code;if(!code)setTimeout(()=>Blockly.svgResize(blocklyWorkspace));updateCode();}));
$('#codeLanguage').addEventListener('change',updateCode);
$('#runBtn').addEventListener('click',()=>runProgram());$('#restartBtn').addEventListener('click',()=>runProgram());$('#stopBtn').addEventListener('click',()=>stopProgram(true));
function closeExampleMenu(){$('#examplesPopover').hidden=true;$('#resetProgram').setAttribute('aria-expanded','false');}
$('#resetProgram').setAttribute('aria-expanded','false');
$('#resetProgram').addEventListener('click',()=>{const menu=$('#examplesPopover');menu.hidden=!menu.hidden;$('#resetProgram').setAttribute('aria-expanded',String(!menu.hidden));});
document.addEventListener('pointerdown',event=>{if(!$('#examplesPopover').contains(event.target)&&!$('#resetProgram').contains(event.target))closeExampleMenu();},true);
function updateExampleMenu(){
  $('#examplesPopover header b').textContent=currentBoard==='m10'?'M10 示例':'K10 示例';
  $('#factoryExampleBtn').hidden=currentBoard!=='k10';
  $('#factorySourceBtn').hidden=currentBoard!=='k10';
  const labels=currentBoard==='m10'?['Hello M10 · 触屏','屏幕图形','L 灯闪烁','A / B / A+B','光控 L 灯','环境光读取']:['Hello K10','屏幕显示','RGB 灯光','按键交互','智能夜灯','环境数据'];
  $$('[data-example]').forEach((button,index)=>{button.hidden=button.dataset.example==='image'?currentBoard!=='m10':button.dataset.example==='face'?currentBoard!=='k10':false;button.querySelector('b').textContent=button.dataset.example==='face'?'人脸识别 · A 学习 / B 遗忘':button.dataset.example==='image'?'本地图片':labels[index]||'本地图片';});
}
$$('[data-example]').forEach(button=>button.addEventListener('click',()=>{blocklyWorkspace.clear();createExample(currentBoard,button.dataset.example);markProgramModified();updateCode();closeExampleMenu();toast(`已载入「${button.querySelector('b').textContent}」示例`);}));
bindK10FactoryExample();
bindK10FactoryBlocks();
$('#copyCode').addEventListener('click',async()=>{await navigator.clipboard.writeText($('#pythonCode').textContent);toast('代码已复制');});
$('#downloadArduino').addEventListener('click',async()=>{
  const button=$('#downloadArduino');
  if(button.disabled)return;
  if(currentBoard==='m10'){try{downloadM10Project()}catch(error){toast('M10 工程导出失败');console.error(error)}return;}
  const result=generateK10Arduino(blocklyWorkspace);
  if(result.issues.length){updateCode();return;}
  button.disabled=true;button.textContent='正在生成…';
  try{
    const files=[['BoardLab_K10/BoardLab_K10.ino',result.code]];
    if(result.images.length)files.push(['BoardLab_K10/arduino_image_cache.h',await buildK10ImageHeader(result.images)]);
    files.push(['BoardLab_K10/README.txt','板演 K10 Arduino C++ 工程\n请在 Arduino IDE 中安装并选择行空板 K10 官方板卡包，再打开 BoardLab_K10.ino 编译。\n基础图片程序已通过本机 K10 工具链编译；当前工程尚未自动编译验证，实际上传前请先编译并检查硬件行为。\n']);
    const archive=createK10ProjectZip(files),url=URL.createObjectURL(archive),link=document.createElement('a');
    link.href=url;link.download='BoardLab_K10_Arduino.zip';link.click();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
    toast('Arduino 工程已生成');
  }catch(error){toast('工程生成失败，请检查图片文件');console.error('K10 Arduino export failed',error)}
  finally{button.textContent='下载工程';updateCode()}
});
$('#clearConsole').addEventListener('click',()=>$('#consoleOutput').innerHTML='');
$('#addonBtn').addEventListener('click',()=>openExtensions('board'));$('#closeExtensions').addEventListener('click',closeExtensions);$('#finishExtensions').addEventListener('click',closeExtensions);
$('#undoBtn').addEventListener('click',()=>blocklyWorkspace.undo(false));
$('#redoBtn').addEventListener('click',()=>blocklyWorkspace.undo(true));
$('#zoomInBtn').addEventListener('click',()=>blocklyWorkspace.zoomCenter(1));
$('#zoomOutBtn').addEventListener('click',()=>blocklyWorkspace.zoomCenter(-1));
$('#centerBtn').addEventListener('click',()=>blocklyWorkspace.scrollCenter());
$('#captureBtn').addEventListener('click',()=>{
  const source=blocklyWorkspace.getParentSvg();
  const snapshot=source.cloneNode(true);
  snapshot.querySelectorAll('.blocklyFlyout,.blocklyScrollbarHorizontal,.blocklyScrollbarVertical,.blocklyBubbleCanvas,.blocklyBlockDragSurface,.blocklyWidgetDiv').forEach(element=>element.remove());
  const {width,height}=source.getBoundingClientRect();
  snapshot.setAttribute('xmlns','http://www.w3.org/2000/svg');
  snapshot.setAttribute('width',String(Math.round(width)));
  snapshot.setAttribute('height',String(Math.round(height)));
  snapshot.setAttribute('viewBox',`0 0 ${Math.round(width)} ${Math.round(height)}`);
  const style=document.createElementNS('http://www.w3.org/2000/svg','style');
  style.textContent=Array.from(document.styleSheets).flatMap(sheet=>{try{return Array.from(sheet.cssRules).map(rule=>rule.cssText);}catch{return [];}}).join('\n');
  snapshot.prepend(style);
  const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(snapshot)],{type:'image/svg+xml'}));
  const link=document.createElement('a');link.href=url;link.download='板演积木截图.svg';link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
});
$('#boardGrid').addEventListener('click',event=>{const card=event.target.closest('.board-card');if(!card)return;if(card.dataset.board)selectBoard(card.dataset.board,true);if(card.dataset.module)toggleModule(card.dataset.module);if(card.dataset.upcoming)toast(`${upcomingBoardCatalog[card.dataset.upcoming].name} 正在适配仿真与积木`);});
$$('#extensionTabs button').forEach(button=>button.addEventListener('click',()=>setExtensionTab(button.dataset.extensionTab)));
$('#boardSearch').addEventListener('input',renderExtensionLibrary);
document.addEventListener('keydown',event=>{if(event.key==='Escape'){if(!$('#extensionsModal').hidden){closeExtensions();return;}closeExampleMenu();}if(keyMappingTarget){event.preventDefault();const other=keyMappingTarget==='A'?'B':'A';if(event.key.toLowerCase()===keyMap[other]){toast(`这个键已经绑定到按键 ${other}`);return;}keyMap[keyMappingTarget]=event.key.toLowerCase();log('键位',`按键 ${keyMappingTarget} → ${event.key===' '?'空格':event.key.toUpperCase()}`);keyMappingTarget=null;$$('.key-map').forEach(x=>x.classList.remove('listening'));renderKeyMap();localStorage.setItem('boardlab-keymap',JSON.stringify(keyMap));return;}if(event.target.matches('input,textarea,select,.blocklyHtmlInput'))return;if(event.key.toLowerCase()===keyMap.A){event.preventDefault();document.activeElement?.blur();if(!event.repeat)triggerButton('A','DOWN',true);}if(event.key.toLowerCase()===keyMap.B){event.preventDefault();document.activeElement?.blur();if(!event.repeat)triggerButton('B','DOWN',true);}if((event.ctrlKey||event.metaKey)&&event.key==='Enter')runProgram();});

try { if(navigator.modelContext?.registerTool){navigator.modelContext.registerTool({name:'select_virtual_board',description:'选择已支持的虚拟主板。',inputSchema:{type:'object',properties:{board:{type:'string',enum:['k10','m10']}},required:['board'],additionalProperties:false},execute:async({board})=>{selectBoard(board);return{content:[{type:'text',text:`已选择 ${boardProfiles[board].name}。`}]};}});navigator.modelContext.registerTool({name:'run_board_program',description:'运行当前图形化积木程序。',inputSchema:{type:'object',properties:{},additionalProperties:false},execute:async()=>{runProgram();return{content:[{type:'text',text:'程序已开始运行。'}]};}});navigator.modelContext.registerTool({name:'stop_board_program',description:'停止当前虚拟主板程序。',inputSchema:{type:'object',properties:{},additionalProperties:false},execute:async()=>{stopProgram(true);return{content:[{type:'text',text:'程序已停止。'}]};}});}}catch(error){console.debug('WebMCP unavailable',error);}

document.addEventListener('keyup',event=>{for(const key of ['A','B'])if(event.key.toLowerCase()===keyMap[key])triggerButton(key,'UP');});
window.addEventListener('blur',()=>{for(const key of ['A','B'])triggerButton(key,'UP');pendingButtonPresses.clear();});
initBlockly();
bindProjectFiles();renderRuntimeDebug(true);
if(k10Added) selectBoard(currentBoard);
else {
  $('#simBoardName').textContent='虚拟仿真器';
  $('#simStatus').innerHTML='<i></i>未添加主控板';
  $('#resetProgram').disabled=true; $('#runBtn').disabled=true;
  renderSimulator(currentBoard); renderExtensionLibrary();
}
restoreCompleteProject();

