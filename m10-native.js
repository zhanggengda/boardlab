// M10 uses the Python 3 unihiker GUI object model, not the K10 canvas cache.
const m10Groups = [
  {name:'屏幕对象 · 创建后立即显示',types:['m10_text','m10_image','m10_button','m10_rect','m10_circle','m10_line']},
  {name:'更新同一个对象',types:['m10_set_text','m10_set_image','m10_set_position','m10_set_color','m10_set_size','m10_remove','m10_clear']},
  {name:'触屏与按键',types:['m10_touch_event','m10_key_event','m10_button_state']},
  {name:'板载传感器',types:['m10_light','m10_sound','m10_acceleration','m10_gyroscope']},
  {name:'L 灯与蜂鸣器',types:['m10_led','m10_tone','m10_buzzer_stop']},
  {name:'程序输出',types:['m10_print']}
];
const m10Types = new Set(['m10_start',...m10Groups.flatMap(group=>group.types)]);
const m10Sensors = {light:320,sound:0,ax:0,ay:0,az:1,gx:0,gy:0,gz:0};
const m10Objects = new Map();
const m10Scene = new Set();
let m10Tone = null;
let m10ImageEditor = null;

function defineM10Blocks() {
  const num=(name,value=0,min=-4096,max=4096)=>({type:'field_number',name,value,min,max});
  const str=(name,text)=>({type:'field_input',name,text});
  const color=()=>({type:'field_colour',name:'COLOR',colour:'#26374e'});
  const drop=(name,options)=>({type:'field_dropdown',name,options});
  const input=(name,check)=>({type:'input_value',name,check});
  const xy=()=>[num('X',20),num('Y',30)];
  const id=()=>str('NAME','控件1');
  const defs=[];
  const add=(type,message0,args0=[],output)=>defs.push({type,message0,args0,inputsInline:true,style:'board_blocks',...(output?{output}:{previousStatement:null,nextStatement:null})});
  defs.push({type:'m10_start',message0:'行空板 M10 程序开始',nextStatement:null,style:'board_blocks'});
  add('m10_text','创建文本对象 %1 内容 %2 X %3 Y %4 字号 %5 颜色 %6',[id(),input('TEXT','String'),...xy(),num('SIZE',20,8,120),color()]);
  add('m10_button','创建触屏按钮 %1 文字 %2 X %3 Y %4 宽 %5 高 %6',[id(),input('TEXT','String'),...xy(),num('W',120,1),num('H',40,1)]);
  add('m10_rect','创建矩形对象 %1 X %2 Y %3 宽 %4 高 %5 颜色 %6',[id(),...xy(),num('W',100,1),num('H',60,1),color()]);
  add('m10_circle','创建圆形对象 %1 X %2 Y %3 半径 %4 颜色 %5',[id(),...xy(),num('R',20,1),color()]);
  add('m10_line','创建线段对象 %1 X1 %2 Y1 %3 X2 %4 Y2 %5 颜色 %6',[id(),num('X',20),num('Y',30),num('X2',180),num('Y2',30),color()]);
  add('m10_set_text','更新对象 %1 的文本为 %2',[id(),input('TEXT')]);
  add('m10_set_position','更新对象 %1 坐标 X %2 Y %3',[id(),...xy()]);
  add('m10_set_color','更新对象 %1 颜色 %2',[id(),color()]);
  add('m10_set_size','更新图片或按钮 %1 宽 %2 高 %3',[id(),num('W',100,1),num('H',100,1)]);
  add('m10_remove','删除屏幕对象 %1',[id()]);
  add('m10_clear','清空 M10 屏幕对象');
  defs.push({type:'m10_touch_event',message0:'当触屏对象 %1 被点击',args0:[id()],nextStatement:null,style:'board_blocks'});
  defs.push({type:'m10_key_event',message0:'当 M10 按键 %1 被点击',args0:[drop('BUTTON',[['A','A'],['B','B']])],nextStatement:null,style:'board_blocks'});
  add('m10_button_state','M10 按键 %1 %2 ?',[drop('BUTTON',[['A','A'],['B','B'],['A+B','A+B']]),drop('STATE',[['按下','DOWN'],['松开','UP']])],'Boolean');
  add('m10_light','读取 M10 环境光原始值（0–4095）',[],'Number');
  add('m10_sound','读取 M10 麦克风声强（0–100）',[],'Number');
  const axis=()=>drop('AXIS',[['X','x'],['Y','y'],['Z','z']]);
  add('m10_acceleration','读取 M10 加速度 %1（库返回值）',[axis()],'Number');
  add('m10_gyroscope','读取 M10 陀螺仪 %1（库返回值）',[axis()],'Number');
  add('m10_led','M10 蓝色 L 灯 %1',[drop('STATE',[['点亮','ON'],['关闭','OFF']])]);
  add('m10_tone','M10 蜂鸣器 音调 %1 Hz 节拍 %2',[num('FREQ',523,100,4000),num('BEAT',1,.125,16)]);
  add('m10_buzzer_stop','停止 M10 蜂鸣器');
  add('m10_print','输出 %1',[input('TEXT')]);
  Blockly.defineBlocksWithJsonArray(defs);
  Blockly.Blocks.m10_image={
    init() {
      this.m10Image={src:'',filename:'',width:100,height:100};
      const row=this.appendDummyInput().appendField(this.type==='m10_set_image'?'更新图片对象':'创建图片对象').appendField(new Blockly.FieldTextInput('图片1'),'NAME')
        .appendField(new Blockly.FieldImage('data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="white" d="M4 3h16v18H4V3zm2 2v10l4-4 4 4 2-2 2 2V5H6z"/></svg>'),24,24,'选择本地图片',()=>openM10ImageEditor(this)));
      if(this.type==='m10_image')row.appendField('X').appendField(new Blockly.FieldNumber(0,-4096,4096),'X').appendField('Y').appendField(new Blockly.FieldNumber(0,-4096,4096),'Y');
      this.setPreviousStatement(true);this.setNextStatement(true);this.setStyle('board_blocks');
      this.setTooltip('点击图片图标选择文件。M10 官方 GUI 按比例缩放到指定宽高内，创建对象立即显示。');
    },
    saveExtraState(){return {...this.m10Image}},
    loadExtraState(state){Object.assign(this.m10Image,{src:'',filename:'',width:100,height:100,...state})}
  };
  Blockly.Blocks.m10_set_image={...Blockly.Blocks.m10_image};
}

function m10ToolboxBlock(type){
  const item={kind:'block',type};
  if(['m10_text','m10_button','m10_set_text','m10_print'].includes(type))item.inputs={TEXT:{shadow:{type:'text',fields:{TEXT:type==='m10_text'?'你好，M10':type==='m10_button'?'点击我':''}}}};
  return item;
}

function m10Value(block){
  const f=name=>block.getFieldValue(name);
  switch(block.type){
    case 'm10_light':return m10Sensors.light;
    case 'm10_sound':return m10Sensors.sound;
    case 'm10_acceleration':return m10Sensors['a'+f('AXIS')];
    case 'm10_gyroscope':return m10Sensors['g'+f('AXIS')];
    case 'm10_button_state': {
      const name=f('BUTTON');
      const down=activeButtonSnapshot?Boolean(activeButtonSnapshot[name]):buttonIsPressed(name);
      return f('STATE')==='UP'?!down:down;
    }
  }
}

function m10StopTone(){
  if(m10Tone){try{m10Tone.stop()}catch{}m10Tone.disconnect();m10Tone=null;}
}
function m10PlayTone(freq,beats){
  m10StopTone();
  if(!toneContext){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;toneContext=new Audio();}
  toneContext.resume();
  const oscillator=toneContext.createOscillator(),gain=toneContext.createGain();
  oscillator.type='square';oscillator.frequency.value=Number(freq);gain.gain.value=.025;
  oscillator.connect(gain);gain.connect(toneContext.destination);oscillator.start();
  oscillator.stop(toneContext.currentTime+Number(beats)*.5);m10Tone=oscillator;
  oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();if(m10Tone===oscillator)m10Tone=null;};
}

function m10DispatchTouch(name){
  if(!programArmed||!runtimeWorkspace)return;
  runtimeWorkspace.getTopBlocks(false).filter(b=>b.type==='m10_touch_event'&&b.getFieldValue('NAME')===name).forEach(b=>executeConnected(b.getNextBlock()));
}
function m10KeyEvent(name,phase){
  if(phase!=='DOWN'||!programArmed||!runtimeWorkspace)return;
  runtimeWorkspace.getTopBlocks(false).filter(b=>b.type==='m10_key_event'&&b.getFieldValue('BUTTON')===name).forEach(b=>executeConnected(b.getNextBlock()));
}
function m10RenderObject(obj){
  const element=obj.element,p=obj.props;
  if(!element)return;
  for(const [key,value] of Object.entries({x:p.x,y:p.y,width:p.w,height:p.h,fill:p.color}))if(value!==undefined)element.setAttribute(key,String(value));
  if(obj.kind==='text'){
    element.setAttribute('font-size',p.size);element.setAttribute('dominant-baseline','text-before-edge');
    element.replaceChildren();
    String(p.text).split('\n').forEach((line,index)=>{const span=document.createElementNS('http://www.w3.org/2000/svg','tspan');span.setAttribute('x',p.x);span.setAttribute('dy',index?p.size*1.2:0);span.textContent=line;element.append(span);});
  }else if(obj.kind==='button'){
    element.setAttribute('transform',`translate(${p.x},${p.y})`);element.removeAttribute('x');element.removeAttribute('y');
    const rect=element.firstChild,text=element.lastChild;rect.setAttribute('width',p.w);rect.setAttribute('height',p.h);
    text.setAttribute('x',p.w/2);text.setAttribute('y',p.h/2);text.textContent=String(p.text);text.setAttribute('fill',p.color||'#26374e');
  }else if(obj.kind==='circle'){
    element.setAttribute('cx',p.x);element.setAttribute('cy',p.y);element.setAttribute('r',p.r);
  }else if(obj.kind==='line'){
    element.setAttribute('x1',p.x);element.setAttribute('y1',p.y);element.setAttribute('x2',p.x2);element.setAttribute('y2',p.y2);element.setAttribute('stroke',p.color);element.setAttribute('stroke-width','1');
  }else if(obj.kind==='image'){
    // ImageOps.contain in unihiker 0.0.29 scales proportionally and anchors NW.
    const size=m10Contain(p.naturalW||p.w,p.naturalH||p.h,p.w,p.h);
    element.setAttribute('width',size.w);element.setAttribute('height',size.h);element.setAttribute('href',p.src);
  }
}
function m10Contain(nw,nh,w,h){const scale=Math.min(w/nw,h/nh);return {w:Math.max(1,Math.round(nw*scale)),h:Math.max(1,Math.round(nh*scale))};}
function m10CreateObject(name,kind,props){
  const screen=$('#m10Screen');
  const tag={text:'text',button:'g',rect:'rect',circle:'circle',line:'line',image:'image'}[kind];
  const element=screen?document.createElementNS('http://www.w3.org/2000/svg',tag):null;
  const obj={kind,props,element,name};
  if(element){
    $('#m10Welcome')?.remove();
    element.dataset.object=name;
    element.style.cursor='pointer';
    element.addEventListener('click',()=>m10DispatchTouch(name));
    if(kind==='button'){
      const rect=document.createElementNS('http://www.w3.org/2000/svg','rect');rect.setAttribute('fill','#eef3fb');rect.setAttribute('stroke','#bacadd');rect.setAttribute('rx','5');
      const text=document.createElementNS('http://www.w3.org/2000/svg','text');text.setAttribute('text-anchor','middle');text.setAttribute('dominant-baseline','central');text.setAttribute('font-size','16');element.append(rect,text);
    }
    screen.append(element);
  }
  // Recreating the same name leaves the earlier GUI object on screen, just as Python assignment does.
  m10Scene.add(obj);m10Objects.set(name,obj);m10RenderObject(obj);return obj;
}
function m10Reset(welcome=false){
  m10StopTone();m10Objects.clear();m10Scene.clear();
  const screen=$('#m10Screen');screen?.replaceChildren();
  if(welcome&&screen){const text=document.createElementNS('http://www.w3.org/2000/svg','text');text.id='m10Welcome';text.setAttribute('x','120');text.setAttribute('y','155');text.setAttribute('text-anchor','middle');text.setAttribute('fill','#64758d');text.setAttribute('font-size','17');text.textContent='M10 · 点击运行';screen.append(text);}
  $('#m10Led')?.classList.remove('on');
  $('#buttonA')?.classList.remove('pressed');$('#buttonB')?.classList.remove('pressed');
}
function m10Execute(block){
  if(!m10Types.has(block.type))return false;
  const f=name=>block.getFieldValue(name),n=name=>Number(f(name)),v=name=>blockValue(block.getInputTargetBlock(name));
  const name=f('NAME'),props={x:n('X'),y:n('Y'),color:f('COLOR')};
  switch(block.type){
    case 'm10_text':m10CreateObject(name,'text',{...props,text:String(v('TEXT')),size:n('SIZE')});break;
    case 'm10_button':m10CreateObject(name,'button',{...props,text:String(v('TEXT')),w:n('W'),h:n('H')});break;
    case 'm10_rect':m10CreateObject(name,'rect',{...props,w:n('W'),h:n('H')});break;
    case 'm10_circle':m10CreateObject(name,'circle',{...props,r:n('R')});break;
    case 'm10_line':m10CreateObject(name,'line',{...props,x2:n('X2'),y2:n('Y2')});break;
    case 'm10_image':{
      const p=block.m10Image||{};
      if(!p.src){log('M10','图片对象尚未选择文件');break;}
      m10CreateObject(name,'image',{...props,src:p.src,w:p.width,h:p.height,naturalW:p.naturalW,naturalH:p.naturalH});break;
    }
    case 'm10_set_text':case 'm10_set_image':case 'm10_set_position':case 'm10_set_color':case 'm10_set_size':case 'm10_remove':{
      const obj=m10Objects.get(name);
      if(!obj){log('M10',`尚未创建对象「${name}」`);break;}
      const allowed={m10_set_text:['text','button'],m10_set_image:['image'],m10_set_position:['text','button','rect','circle','line','image'],m10_set_color:['text','rect','circle','line'],m10_set_size:['button','image']}[block.type];
      if(allowed&&!allowed.includes(obj.kind)){log('M10',`对象「${name}」不支持此更新`);break;}
      if(block.type==='m10_remove'){obj.element?.remove();m10Objects.delete(name);m10Scene.delete(obj);break;}
      if(block.type==='m10_set_image'){
        const p=block.m10Image;if(!p?.src){log('M10','更新图片对象尚未选择文件');break;}
        Object.assign(obj.props,{src:p.src,w:p.width,h:p.height,naturalW:p.naturalW,naturalH:p.naturalH});m10RenderObject(obj);break;
      }
      const changes={m10_set_text:{text:String(v('TEXT'))},m10_set_position:{x:n('X'),y:n('Y')},m10_set_color:{color:f('COLOR')},m10_set_size:{w:n('W'),h:n('H')}}[block.type];
      if(Object.keys(changes).some(key=>changes[key]!==obj.props[key])){Object.assign(obj.props,changes);m10RenderObject(obj);}break;
    }
    case 'm10_clear':m10Objects.clear();m10Scene.clear();$('#m10Screen')?.replaceChildren();break;
    case 'm10_led':$('#m10Led')?.classList.toggle('on',f('STATE')==='ON');break;
    case 'm10_tone':m10PlayTone(n('FREQ'),n('BEAT'));break;
    case 'm10_buzzer_stop':m10StopTone();break;
    case 'm10_print':log('M10',String(v('TEXT')));break;
  }
  return true;
}

function renderM10Simulator(){
  $('#simStage').innerHTML=`<div class="m10-frame"><div class="m10-board" aria-label="行空板 M10 官方正面照片仿真"><svg id="m10Screen" viewBox="0 0 240 320" aria-label="M10 240×320 触摸屏"></svg></div><div class="m10-indicators"><span id="m10Led" title="背面蓝色 L 灯的仿真状态">L</span><span>蓝色 L 灯</span></div><p>240 × 320 · 触摸屏</p></div><div class="board-controls"><div class="hardware-control"><button class="hardware-btn" id="buttonA" type="button"><b>A</b><span>按键</span></button><button class="key-map" data-button="A" type="button">键盘 <kbd id="keyA">A</kbd></button></div><div class="hardware-control"><button class="hardware-btn" id="buttonB" type="button"><b>B</b><span>按键</span></button><button class="key-map" data-button="B" type="button">键盘 <kbd id="keyB">B</kbd></button></div><button class="hardware-btn reset" id="boardReset" type="button"><b>↻</b><span>仿真复位</span></button></div>`;
  m10Reset();bindBoardControls();renderKeyMap();renderM10Sensors();
}
function renderM10Sensors(){
  const controls=[['light','环境光原始值',0,4095,1],['sound','麦克风声强（0–100）',0,100,.1],['ax','加速度 X',-16,16,.01],['ay','加速度 Y',-16,16,.01],['az','加速度 Z',-16,16,.01],['gx','陀螺仪 X',-35,35,.01],['gy','陀螺仪 Y',-35,35,.01],['gz','陀螺仪 Z',-35,35,.01]];
  $('.sensor-panel').innerHTML=`<div class="sensor-tabs"><button class="active" type="button">M10 虚拟输入</button></div><div class="m10-sensor-grid">${controls.map(([name,label,min,max,step])=>`<label>${label}<input type="number" value="${m10Sensors[name]}" min="${min}" max="${max}" step="${step}" data-m10-sensor="${name}" aria-label="${label}固定值"></label>`).join('')}</div>`;
  $$('[data-m10-sensor]').forEach(input=>input.addEventListener('change',()=>{const value=Number(input.value),name=input.dataset.m10Sensor;if(input.value===''||!Number.isFinite(value)){input.value=m10Sensors[name];return;}m10Sensors[name]=Math.max(Number(input.min),Math.min(Number(input.max),value));input.value=m10Sensors[name];}));
}

function openM10ImageEditor(block){
  m10ImageEditor?.remove();
  const panel=document.createElement('section');panel.className='m10-image-editor';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','M10 本地图片');
  const settings=block.m10Image;
  panel.innerHTML=`<header><b>M10 本地图片</b><button type="button" aria-label="关闭">×</button></header><div class="m10-image-layout"><div><label>图片文件 <input class="m10-file-name" readonly><button class="m10-open" type="button">打开…</button></label><input class="m10-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,image/x-ms-bmp" hidden><button class="image-input-dropzone m10-image-dropzone" type="button">拖动图片到这里<small>或复制图片后按 Ctrl+V 粘贴</small></button><p class="m10-image-error" role="alert"></p><div class="m10-dimensions"><label>宽 <input data-dim="width" type="number" min="1" max="4096"></label><label>高 <input data-dim="height" type="number" min="1" max="4096"></label></div><p>按比例缩放到宽高范围内。修改后需重新运行，才会影响仿真。</p></div><div><b>屏幕预览 <small>240 × 320</small></b><svg viewBox="0 0 240 320"></svg></div></div>`;
  document.body.append(panel);m10ImageEditor=panel;
  const anchor=block.getSvgRoot().getBoundingClientRect(),width=Math.min(640,window.innerWidth-24);
  panel.style.width=width+'px';panel.style.left=Math.max(12,Math.min(anchor.left,window.innerWidth-width-12))+'px';panel.style.top=Math.max(12,Math.min(anchor.bottom+12,window.innerHeight-panel.offsetHeight-12))+'px';
  const render=()=>{
    panel.querySelector('.m10-file-name').value=settings.filename||'尚未选择图片';
    panel.querySelectorAll('[data-dim]').forEach(input=>input.value=settings[input.dataset.dim]);
    const svg=panel.querySelector('svg');svg.replaceChildren();
    if(settings.src){const image=document.createElementNS('http://www.w3.org/2000/svg','image');const size=m10Contain(settings.naturalW,settings.naturalH,settings.width,settings.height);image.setAttribute('x',block.getFieldValue('X')||0);image.setAttribute('y',block.getFieldValue('Y')||0);image.setAttribute('width',size.w);image.setAttribute('height',size.h);image.setAttribute('href',settings.src);svg.append(image);}
  };
  const changed=old=>{Blockly.Events.fire(new Blockly.Events.BlockChange(block,'mutation',null,JSON.stringify(old),JSON.stringify(settings)));markProgramModified();saveWorkspace();updateCode();render();};
  let imageInput;
  panel.querySelector('header button').onclick=()=>{imageInput?.dispose();panel.remove();m10ImageEditor=null;};
  panel.querySelector('.m10-open').onclick=()=>panel.querySelector('.m10-file').click();
  panel.querySelectorAll('[data-dim]').forEach(input=>{
    const apply=()=>{const value=Number(input.value);if(input.value===''||!Number.isFinite(value)||value<1||value>4096)return;
      const rounded=Math.round(value);if(settings[input.dataset.dim]===rounded)return;
      const old={...settings};settings[input.dataset.dim]=rounded;changed(old);
    };
    input.addEventListener('input',apply);
    input.addEventListener('change',()=>{apply();render();});
  });
  panel.querySelector('.m10-image-dropzone').onclick=()=>panel.querySelector('.m10-file').click();
  const error=panel.querySelector('.m10-image-error');
  imageInput=window.BoardlabImageInput.bind({
    target:panel,input:panel.querySelector('.m10-file'),maxBytes:8*1024*1024,isActive:()=>!block.isDisposed(),
    load:async file=>{
      const src=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file)});
      const image=new Image();image.src=src;await image.decode();
      return {src,naturalW:image.naturalWidth,naturalH:image.naturalHeight};
    },
    apply:(selected,file)=>{const old={...settings};Object.assign(settings,{...selected,filename:file.name});changed(old)},
    onError:message=>{error.textContent=message},
    onBusy:value=>{error.classList.toggle('image-input-loading',value);if(value)error.textContent='正在导入图片…';else if(error.textContent==='正在导入图片…')error.textContent=''}
  });render();
}
