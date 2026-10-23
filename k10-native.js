const k10NativeGroups=[
  {name:'屏幕显示',types:['screen_orientation','camera_preview','screen_clear','screen_update','screen_clear_all','screen_image','screen_tf_image','camera_photo','screen_text_line','screen_clear_line','screen_text_xy','screen_point','screen_width','screen_line','screen_circle','screen_rect','screen_line_value','screen_circle_value','screen_rect_value','screen_qr','screen_qr_clear','screen_text']},
  {name:'板载传感器',types:['button_event','tilt_event','k10_button_state','k10_posture','k10_environment','k10_light','k10_acceleration']},
  {name:'LED控制',types:['rgb_pixel','rgb_off','rgb_color','rgb_brightness','rgb_brightness_get','rgb_set','rgb_rainbow']},
  {name:'音频录放',types:['music_play','music_stop','note_play','audio_tf_play','audio_stop','audio_record','tone_play']},
  {name:'人工智能',types:['ai_mode','ai_detect','ai_face_attr','ai_learn','ai_recognize','ai_complete','ai_face_id','ai_forget','ai_forget_all','ai_animal_attr','ai_qr_result','ai_motion_sensitivity','speech_config','speech_command','speech_detect','speech_awake','speech_speed','speak_text']},
  {name:'串口操作',types:['serial_write','serial_available','serial_read','serial_number','number_decimal','serial_baud','serial_pins']},
  {name:'引脚操作',types:['pin_mode','pin_digital_read','pin_analog_read','pin_digital_write','pin_pwm']},
  {name:'系统资源',types:['system_millis','system_mac']}
];
const nativeBlockTypes=new Set(k10NativeGroups.flatMap(group=>group.types).concat('board_start','serial_sensors'));
function defineK10NativeBlocks(){
  const field=(name,options)=>({type:'field_dropdown',name,options:options.map(x=>Array.isArray(x)?x:[String(x),String(x)])});
  const num=(name,value=0,min=0,max=65535)=>({type:'field_number',name,value,min,max});
  const input=(name,check='String')=>({type:'input_value',name,check});
  const port=()=>field('PORT',['串口0','串口1']);
  const pin=name=>field(name,['P0','P1','P2']);
  const attr=()=>field('ATTR',[['长','width'],['宽','height'],['中心 X','x'],['中心 Y','y'],['左眼 X','leftEyeX'],['左眼 Y','leftEyeY'],['右眼 X','rightEyeX'],['右眼 Y','rightEyeY'],['鼻尖 X','noseX'],['鼻尖 Y','noseY'],['左嘴角 X','leftMouthX'],['左嘴角 Y','leftMouthY'],['右嘴角 X','rightMouthX'],['右嘴角 Y','rightMouthY']]);
  const definitions=[];
  const add=(type,message0,args0=[],output)=>definitions.push({type,message0,args0,inputsInline:true,style:'board_blocks',...(output?{output}:{previousStatement:null,nextStatement:null})});
  add('screen_orientation','初始化设置屏幕方向 %1',[field('DIRECTION',['0','90','180','270'])]);
  add('camera_preview','%1 摄像头画面',[field('SHOW',[['显示','YES'],['隐藏','NO']])]);
  add('screen_tf_image','缓存显示TF卡图片 %1 在 X %2 Y %3',[input('FILE'),num('X'),num('Y')]);
  add('camera_photo','拍照存储到TF卡 %1',[input('FILE')]);
  add('screen_qr','立即显示二维码 %1',[input('TEXT')]);
  add('screen_qr_clear','清除二维码显示');
  add('rgb_color','红 %1 绿 %2 蓝 %3',[num('R',255,0,255),num('G',255,0,255),num('B',255,0,255)],'String');
  add('rgb_brightness_get','读取RGB灯亮度',[],'Number');
  add('music_play','后台播放内置音乐 %1',[field('MUSIC',['DADADADUM','ENTERTAINER','PRELUDE','ODE','BIRTHDAY'])]);
  add('music_stop','停止播放内置音乐');
  add('note_play','播放音符 音调 %1 节拍 %2',[field('NOTE',[['1 低 C/C3','131'],['2 低 D/D3','147'],['3 低 E/E3','165'],['1 中 C/C4','262'],['2 中 D/D4','294'],['3 中 E/E4','330'],['4 中 F/F4','349'],['5 中 G/G4','392'],['6 中 A/A4','440'],['7 中 B/B4','494'],['1 高 C/C5','523']]),field('BEAT',['0.25','0.5','1','2','4'])]);
  add('audio_tf_play','后台播放TF卡音频 %1',[input('FILE')]);add('audio_stop','停止TF卡音频播放');
  add('audio_record','录音保存到TF卡 %1 录制时间 %2',[input('FILE'),num('SECONDS',10,1,60)]);
  add('ai_mode','切换为 %1 模式',[field('MODE',['人脸检测','猫脸/狗脸检测','移动检测','二维码识别'])]);
  add('ai_detect','检测到 %1？',[field('OBJECT',['人脸','猫脸','狗脸','移动物体','二维码'])],'Boolean');
  add('ai_face_attr','获取检测到人脸的 %1',[attr()],'Number');
  add('ai_learn','学习人脸');add('ai_recognize','识别人脸');add('ai_complete','是否识别完成？',[],'Boolean');add('ai_face_id','获取识别到的人脸ID',[],'Number');
  add('ai_forget','忘记人脸ID %1',[num('ID',1)]);add('ai_forget_all','忘记全部人脸ID');
  add('ai_animal_attr','检测猫脸/狗脸的 %1',[attr()],'Number');add('ai_qr_result','获取二维码识别结果',[],'String');
  add('ai_motion_sensitivity','设置移动检测灵敏度 %1',[num('VALUE',50,0,100)]);
  add('speech_config','设置语音识别 %1 唤醒时间 %2 语言 %3',[field('MODE',['连续','唤醒']),num('TIME',6000),field('LANG',['中文','English'])]);
  add('speech_command','添加语音识别命令词ID %1 命令 %2',[num('ID',0,0,199),input('TEXT')]);
  add('speech_detect','检测到命令词ID %1？',[num('ID',0,0,199)],'Boolean');add('speech_awake','语音识别当前状态为唤醒？',[],'Boolean');add('speech_speed','设置语音合成语速为 %1',[num('VALUE',2,0,5)]);
  add('serial_write','%1 %2 %3 %4',[port(),field('FORMAT',['字符串输出','数值输出']),input('TEXT',null),field('NEWLINE',['换行','不换行'])]);
  add('serial_available','%1 有数据可读？',[port()],'Boolean');add('serial_read','读取 %1 数据',[port()],'String');add('serial_number','从 %1 读取一个 %2',[port(),field('FORMAT',['整数','浮点数'])],'Number');
  add('number_decimal','%1 保留 %2 位小数',[input('VALUE','Number'),num('DIGITS',0,0,10)],'String');
  add('serial_baud','设置 %1 波特率 %2',[port(),field('BAUD',['9600','19200','38400','57600','115200'])]);add('serial_pins','设置 串口1 Rx %1 Tx %2 波特率为 %3',[pin('RX'),pin('TX'),field('BAUD',['9600','19200','38400','57600','115200'])]);
  add('pin_mode','设置引脚 %1 模式 %2',[pin('PIN'),field('MODE',['OUTPUT','INPUT','INPUT_PULLUP'])]);
  add('pin_digital_read','读取数字引脚 %1',[pin('PIN')],'Boolean');add('pin_analog_read','读取模拟引脚 %1',[pin('PIN')],'Number');
  add('pin_digital_write','设置数字引脚 %1 输出 %2',[pin('PIN'),field('VALUE',[['低电平','0'],['高电平','1']])]);add('pin_pwm','设置模拟引脚 %1 输出(PWM) %2',[pin('PIN'),num('VALUE',512,0,1023)]);
  add('system_millis','系统运行时间(ms)',[],'Number');add('system_mac','MAC 地址',[],'String');
  Blockly.defineBlocksWithJsonArray(definitions);
  const pickerIcon='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30"><circle cx="15" cy="15" r="14" fill="white" opacity=".2"/><path fill="white" d="M12.9 4h4.2l.6 2.6 2.2.9 2.3-1.4 3 3-1.4 2.3.9 2.2 2.6.6v4.2l-2.6.6-.9 2.2 1.4 2.3-3 3-2.3-1.4-2.2.9-.6 2.6h-4.2l-.6-2.6-2.2-.9-2.3 1.4-3-3 1.4-2.3-.9-2.2-2.6-.6v-4.2l2.6-.6.9-2.2-1.4-2.3 3-3 2.3 1.4 2.2-.9z"/><circle cx="15" cy="15" r="4.1" fill="#5840df"/></svg>');
  Blockly.Blocks.screen_image={init:function(){
    this.appendDummyInput()
      .appendField('缓存显示本地加载图片')
      .appendField(new Blockly.FieldImage(pickerIcon,27,27,'选择本地图片',()=>openK10ImagePicker(this)))
      .appendField('在坐标 X')
      .appendField(new Blockly.FieldNumber(0,0,240),'X')
      .appendField('Y')
      .appendField(new Blockly.FieldNumber(0,0,320),'Y');
    this.setPreviousStatement(true);this.setNextStatement(true);this.setStyle('board_blocks');this.setInputsInline(true);
    this.setTooltip('点击齿轮选择图片，也可拖入图片或按 Ctrl+V 粘贴。');
  }};
  // Complete the string/number conversions present in the Mind+ operators.
  for(const [type,message,args,output] of [
    ['operator_to_number','将字符串 %1 转换为 %2',[input('TEXT'),field('FORMAT',['整数','浮点数'])],'Number'],
    ['operator_ascii_text','将数字 %1 转换为ASCII字符串',[input('VALUE','Number')],'String'],
    ['operator_ascii_number','将字符 %1 转换为ASCII数值',[input('TEXT')],'Number'],
    ['operator_to_text','将数字 %1 转换为字符串',[input('VALUE','Number')],'String']
  ]){Blockly.defineBlocksWithJsonArray([{type,message0:message,args0:args,output,inputsInline:true,style:'operator_blocks'}]);operatorTypes.splice(operatorTypes.length-2,0,type);}
}
function installK10BlockIcons(){
  const source='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 22 26"><circle cx="11" cy="10" r="8" fill="none" stroke="white" stroke-width="1.6"/><path d="M5 10c3-5 9-2 12 0M5 11c3 5 9 2 12 0" fill="none" stroke="white" stroke-width="1.4"/><text x="11" y="25" text-anchor="middle" font-family="sans-serif" font-size="7" font-style="italic" font-weight="bold" fill="white">K10</text></svg>');
  nativeBlockTypes.forEach(type=>{const definition=Blockly.Blocks[type];if(!definition)return;const init=definition.init;definition.init=function(){init.call(this);this.inputList[0]?.insertFieldAt(0,new Blockly.FieldImage(source,19,23,'K10'));this.setInputsInline(true);};});
}

const localK10Images=new Map();
let closeK10ImagePicker=null;
const localK10Bitmaps=new WeakMap();
// Images are decoded before executing a program. Drawing only changes the cache;
// asynchronous image callbacks must never publish a frame or reorder instructions.
async function prepareK10Images(workspace){
  const sources=new Map();
  workspace.getAllBlocks(false).filter(block=>block.type==='screen_image').forEach(block=>{
    const settings=k10ImageSettings(block);if(settings.src)sources.set(settings.src,settings.name);
  });
  const failed=[];
  await Promise.all([...sources].map(async([src,name])=>{
    const image=k10ImageFromSource(src);
    try{if(!image.complete||!image.naturalWidth)await image.decode();if(!image.naturalWidth)throw new Error('Empty image');}
    catch{failed.push(name||'未命名图片');}
  }));
  return failed;
}
function k10LocalBitmap(image,width,height){
  let sizes=localK10Bitmaps.get(image);if(!sizes){sizes=new Map();localK10Bitmaps.set(image,sizes)}
  const key=`${width}x${height}`;if(sizes.has(key))return sizes.get(key);
  const bitmap=document.createElement('canvas');bitmap.width=width;bitmap.height=height;
  const ctx=bitmap.getContext('2d');ctx.drawImage(image,0,0,width,height);
  const pixels=ctx.getImageData(0,0,width,height);
  for(let i=0;i<pixels.data.length;i+=4){
    // Match the RGB565 image header: local bitmaps have no alpha channel.
    const r=pixels.data[i]>>3,g=pixels.data[i+1]>>2,b=pixels.data[i+2]>>3;
    pixels.data[i]=(r<<3)|(r>>2);pixels.data[i+1]=(g<<2)|(g>>4);pixels.data[i+2]=(b<<3)|(b>>2);pixels.data[i+3]=255;
  }
  ctx.putImageData(pixels,0,0);sizes.set(key,bitmap);return bitmap;
}
function k10ImageSettings(block){
  try{const value=JSON.parse(block.data||'{}').localImage;if(value&&typeof value==='object')return {name:String(value.name||''),width:Math.max(1,Math.min(240,Math.round(Number(value.width))||100)),height:Math.max(1,Math.min(320,Math.round(Number(value.height))||100)),src:String(value.src||'').startsWith('data:image/')?value.src:''}}catch{}
  return {name:'',width:100,height:100,src:''};
}
function k10ImageFromSource(src){
  if(!src)return null;
  if(!localK10Images.has(src)){const image=new Image();image.src=src;localK10Images.set(src,image)}
  return localK10Images.get(src);
}
async function k10ImageData(file){
  const url=URL.createObjectURL(file),image=new Image();
  try{
    image.src=url;await image.decode();
    const scale=Math.min(1,480/image.naturalWidth,640/image.naturalHeight);
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
    canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
    const src=canvas.toDataURL('image/webp',.82),cached=new Image();cached.src=src;await cached.decode();localK10Images.set(src,cached);
    const screenScale=Math.min(1,240/image.naturalWidth,320/image.naturalHeight);
    return {src,width:Math.max(1,Math.round(image.naturalWidth*screenScale)),height:Math.max(1,Math.round(image.naturalHeight*screenScale))};
  }finally{URL.revokeObjectURL(url)}
}
function openK10ImagePicker(block){
  closeK10ImagePicker?.();
  if(block.isInFlyout){toast('先将积木拖到工作区，再选择图片');return}
  const settings=k10ImageSettings(block),popover=document.createElement('div');popover.className='k10-image-popover';popover.setAttribute('role','dialog');popover.setAttribute('aria-label','选择本地图片');
  popover.innerHTML='<div class="k10-image-head"><strong>本地图片</strong><button type="button" class="k10-image-close" aria-label="关闭图片设置">×</button></div><div class="k10-image-content"><div class="k10-image-fields"><div class="k10-image-file-row"><span>图片文件</span><input class="k10-image-name" aria-label="已选图片" readonly placeholder="尚未选择图片"><button type="button" class="k10-image-open">打开…</button></div><button type="button" class="image-input-dropzone k10-image-dropzone">拖动图片到这里<small>或复制图片后按 Ctrl+V 粘贴</small></button><div class="k10-image-size"><label>宽<input type="number" class="k10-image-width" min="1" max="240"></label><label>高<input type="number" class="k10-image-height" min="1" max="320"></label></div><small>本地图片最大 240 × 320，不保留透明背景。</small><p class="k10-image-error" role="alert"></p><input class="k10-image-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,image/x-ms-bmp" hidden></div><div class="k10-image-preview-column"><div class="k10-image-preview-title">屏幕预览 <span>240 × 320</span></div><div class="k10-image-preview"><canvas width="240" height="320"></canvas><span class="k10-image-empty">拖入图片、Ctrl+V 粘贴，或点击“打开”</span></div></div></div>';
  document.body.append(popover);
  const rect=block.getSvgRoot().getBoundingClientRect(),popupRect=popover.getBoundingClientRect(),popoverWidth=popupRect.width;
  const editorRight=Math.min(innerWidth,document.getElementById('blocksView')?.getBoundingClientRect().right||innerWidth);
  const top=Math.max(8,Math.min(rect.bottom+8,innerHeight-popupRect.height-8));
  popover.style.left=`${Math.max(8,Math.min(rect.left,editorRight-popoverWidth-8))}px`;
  popover.style.top=`${top}px`;
  const name=popover.querySelector('.k10-image-name'),width=popover.querySelector('.k10-image-width'),height=popover.querySelector('.k10-image-height'),canvas=popover.querySelector('canvas'),empty=popover.querySelector('.k10-image-empty'),error=popover.querySelector('.k10-image-error'),fileInput=popover.querySelector('.k10-image-input');
  const draw=()=>{name.value=settings.name;width.value=settings.width;height.value=settings.height;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,240,320);empty.hidden=!!settings.src;if(settings.src){const image=k10ImageFromSource(settings.src);if(image.complete&&image.naturalWidth)ctx.drawImage(k10LocalBitmap(image,settings.width,settings.height),Number(block.getFieldValue('X'))||0,Number(block.getFieldValue('Y'))||0);else image.addEventListener('load',draw,{once:true})}};
  const persist=()=>{const nextData=JSON.stringify({localImage:settings});if(block.data!==nextData)markProgramModified();block.data=nextData;error.textContent=saveWorkspace()?'':'图片已加载，但浏览器存储空间不足，刷新后可能丢失';updateCode()};
  let imageInput;
  const close=()=>{imageInput?.dispose();document.removeEventListener('pointerdown',outside,true);popover.remove();if(closeK10ImagePicker===close)closeK10ImagePicker=null};
  const outside=event=>{if(!popover.contains(event.target)&&!block.getSvgRoot()?.contains(event.target))close()};
  closeK10ImagePicker=close;
  popover.querySelector('.k10-image-close').onclick=close;
  popover.querySelector('.k10-image-open').onclick=()=>fileInput.click();
  popover.querySelector('.k10-image-dropzone').onclick=()=>fileInput.click();
  imageInput=window.BoardlabImageInput.bind({
    target:popover,input:fileInput,maxBytes:20*1024*1024,load:k10ImageData,isActive:()=>!block.isDisposed?.(),
    apply:(selected,file)=>{Object.assign(settings,{name:file.name,...selected});persist();draw()},
    onError:message=>{error.textContent=message},
    onBusy:value=>{error.classList.toggle('image-input-loading',value);if(value)error.textContent='正在导入图片…';else if(error.textContent==='正在导入图片…')error.textContent=''}
  });
  for(const [input,key] of [[width,'width'],[height,'height']])input.onchange=()=>{settings[key]=Math.max(1,Math.min(key==='width'?240:320,Math.round(Number(input.value))||1));persist();draw()};
  popover.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();close()}});
  document.addEventListener('pointerdown',outside,true);draw();popover.querySelector('.k10-image-open').focus();
}

const virtualState={object:'无',faceId:1,width:80,height:100,x:60,y:70,qr:'',command:-1,awake:true,serial0:'',serial1:'',pins:{P0:{analog:0,digital:0},P1:{analog:0,digital:0},P2:{analog:0,digital:0}},files:new Map()};
const learnedK10Faces=new Set();
let nativeRuntime={},nativeAudio=null,nativeMusicTimers=[],cameraStream=null,cameraVideo=null,activeRecorder=null,recordingStream=null,mediaEpoch=0;
function stopNativeMedia(){
  window.K10Vision?.stop();
  mediaEpoch++;nativeMusicTimers.forEach(clearTimeout);nativeMusicTimers=[];nativeAudio?.pause();
  cameraStream?.getTracks().forEach(track=>track.stop());cameraStream=null;
  if(activeRecorder?.state==='recording')activeRecorder.stop();
  recordingStream?.getTracks().forEach(track=>track.stop());recordingStream=null;
  if('speechSynthesis' in window)speechSynthesis.cancel();
}
function resetVirtualRuntime(){window.K10Vision?.reset();nativeMusicTimers.forEach(clearTimeout);nativeMusicTimers=[];nativeAudio?.pause();nativeRuntime={brightness:5,faces:learnedK10Faces,recognized:-1,complete:false,commands:new Map(),pwm:{},speed:2,direction:0,mode:'人脸检测',sensitivity:50};applyScreenDirection();}
function setK10RgbBrightness(value){nativeRuntime.brightness=Math.max(0,Math.min(9,Math.round(Number(value)||0)));}
function writeK10Rgb(led,color){
  const ids=led==='all'?[0,1,2]:[Number(led)],level=nativeRuntime.brightness;
  ids.forEach(i=>{
    const el=$('#led'+i);if(!el)return;
    const rgb=/^#[0-9a-f]{6}$/i.test(color)?color:'#000000';
    const channels=[1,3,5].map(offset=>Math.round(parseInt(rgb.slice(offset,offset+2),16)*level/9));
    const lit=channels.some(Boolean),visible='#'+channels.map(v=>v.toString(16).padStart(2,'0')).join('');
    el.style.opacity='1';el.style.background=lit?visible:'#6d7480';
    el.style.boxShadow=lit?`0 0 15px ${visible},0 0 0 2px #e3e6ea`:'0 0 0 2px #e3e6ea';
  });
}
resetVirtualRuntime();
function nativeK10Value(block){
  const f=name=>block.getFieldValue(name),v=name=>blockValue(block.getInputTargetBlock(name));
  const queue=()=>f('PORT')==='串口1'?'serial1':'serial0';
  switch(block.type){
    case 'rgb_color':return '#'+['R','G','B'].map(key=>Number(f(key)).toString(16).padStart(2,'0')).join('');
    case 'rgb_brightness_get':return nativeRuntime.brightness;
    case 'ai_detect':if(window.K10Vision?.isReal())return f('OBJECT')==='人脸'&&!!window.K10Vision.currentFace();return virtualState.object===f('OBJECT')&&({人脸:'人脸检测',猫脸:'猫脸/狗脸检测',狗脸:'猫脸/狗脸检测',移动物体:'移动检测',二维码:'二维码识别'}[f('OBJECT')]===nativeRuntime.mode);
    case 'ai_face_attr':if(window.K10Vision?.isReal())return window.K10Vision.currentFace()?.[f('ATTR')]||0;return nativeRuntime.mode==='人脸检测'&&virtualState.object==='人脸'?(virtualState[f('ATTR')]||0):0;
    case 'ai_animal_attr':if(window.K10Vision?.isReal())return 0;return virtualState.object==='无'?0:virtualState[f('ATTR')];
    case 'ai_complete':{if(window.K10Vision?.isReal())return window.K10Vision.results.readComplete();const complete=nativeRuntime.complete;nativeRuntime.complete=false;return complete;}
    case 'ai_face_id':{if(window.K10Vision?.isReal())return window.K10Vision.results.readId();const id=nativeRuntime.recognized;nativeRuntime.recognized=-1;return id;}
    case 'ai_qr_result':return virtualState.object==='二维码'?virtualState.qr:'';
    case 'speech_detect':return virtualState.awake&&Number(f('ID'))===virtualState.command&&nativeRuntime.commands.has(Number(f('ID')));
    case 'speech_awake':return virtualState.awake;
    case 'serial_available':return virtualState[queue()].length>0;
    case 'serial_read':{const data=virtualState[queue()];virtualState[queue()]='';return data;}
    case 'serial_number':{const match=virtualState[queue()].match(/[-+]?\d*\.?\d+/);if(!match)return 0;virtualState[queue()]=virtualState[queue()].slice(match.index+match[0].length);return f('FORMAT')==='整数'?parseInt(match[0],10):Number(match[0]);}
    case 'number_decimal':return Number(v('VALUE')).toFixed(Number(f('DIGITS')));
    case 'pin_digital_read':return Boolean(virtualState.pins[f('PIN')].digital);
    case 'pin_analog_read':return virtualState.pins[f('PIN')].analog;
    case 'system_millis':return Math.round(performance.now()-runStartedAt);
    case 'system_mac':return '02:4B:31:30:00:01';
    case 'operator_to_number':return (f('FORMAT')==='整数'?parseInt(v('TEXT'),10):parseFloat(v('TEXT')))||0;
    case 'operator_ascii_text':return String.fromCodePoint(Math.max(0,Math.min(0x10ffff,Number(v('VALUE'))||0)));
    case 'operator_ascii_number':return String(v('TEXT')||'').codePointAt(0)||0;
    case 'operator_to_text':return String(v('VALUE')??0);
    default:return undefined;
  }
}
function nativeK10Execute(block){
  const f=name=>block.getFieldValue(name),v=name=>blockValue(block.getInputTargetBlock(name)),text=name=>String(v(name)||'');
  const file=()=>virtualState.files.get(text('FILE'));
  switch(block.type){
    case 'screen_orientation':nativeRuntime.direction=Number(f('DIRECTION'));applyScreenDirection();log('屏幕',`方向 ${f('DIRECTION')}°`);break;
    case 'camera_preview':if(window.K10Vision?.isReal()){window.K10Vision.show(f('SHOW')==='YES');break;}if(f('SHOW')==='NO'){cameraStream?.getTracks().forEach(track=>track.stop());cameraStream=null;setScreen('');}else startVirtualCamera();break;
    case 'screen_image':{
      const settings=k10ImageSettings(block),image=k10ImageFromSource(settings.src);
      if(!image){log('图片','点击积木上的齿轮选择本地图片');break}
      if(!image.complete||!image.naturalWidth){log('图片',`图片无法解码：${settings.name||'未命名图片'}`);break}
      getScreenBuffer().getContext('2d').drawImage(k10LocalBitmap(image,settings.width,settings.height),Number(f('X')),Number(f('Y')));
      break;
    }
    case 'screen_tf_image':{const item=file();if(item?.image)getScreenBuffer().getContext('2d').drawImage(item.image,Number(f('X')),Number(f('Y')));else log('文件',`请在虚拟输入中加载图片：${text('FILE')||'未指定文件名'}`);break;}
    case 'camera_photo':{if(window.K10Vision?.isReal()){const image=window.K10Vision.snapshot();if(!text('FILE'))log('文件','请插入文件名字符串积木');else if(image){virtualState.files.set(text('FILE'),{image});log('虚拟TF卡',`照片已保存：${text('FILE')}`);}else log('摄像头','没有新鲜画面，无法拍照');break;}if(!text('FILE')){log('文件','请插入文件名字符串积木');break;}if(cameraVideo){const image=document.createElement('canvas');image.width=240;image.height=320;image.getContext('2d').drawImage(cameraVideo,0,0,240,320);virtualState.files.set(text('FILE'),{image});log('虚拟TF卡',`照片已保存：${text('FILE')}`);}else log('摄像头','先显示摄像头画面，再拍照');break;}
    case 'screen_qr':{if(window.K10Vision?.displaying()){const layer=document.createElement('canvas');layer.width=240;layer.height=320;const host=document.createElement('div');new QRCode(host,{text:text('TEXT')||' ',width:200,height:200,correctLevel:QRCode.CorrectLevel.M});layer.getContext('2d').drawImage(host.querySelector('canvas'),20,60);window.K10Vision.qr(layer);break;}if(!window.QRCode){log('二维码','二维码组件未加载');break;}const host=document.createElement('div');new QRCode(host,{text:text('TEXT')||' ',width:200,height:200,correctLevel:QRCode.CorrectLevel.M});const canvas=host.querySelector('canvas'),ctx=getScreenBuffer().getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,240,320);ctx.drawImage(canvas,20,60);presentScreenBuffer();break;}
    case 'screen_qr_clear':{if(window.K10Vision?.displaying()){window.K10Vision.qr(null);break;}const ctx=getScreenBuffer().getContext('2d');ctx.fillStyle=getScreenBuffer().background;ctx.fillRect(0,0,240,320);presentScreenBuffer();break;}
    case 'rgb_brightness':setK10RgbBrightness(f('VALUE'));break;
    case 'music_play':{nativeMusicTimers.forEach(clearTimeout);const notes={DADADADUM:[392,392,392,311],ENTERTAINER:[294,311,330,523,330,523,330],PRELUDE:[262,330,392,523],ODE:[330,330,349,392,392,349,330,294],BIRTHDAY:[262,262,294,262,349,330]}[f('MUSIC')];nativeMusicTimers=notes.map((note,i)=>setTimeout(()=>playTone(note,i===notes.length-1?.65:.2),i*280));break;}
    case 'music_stop':nativeMusicTimers.forEach(clearTimeout);nativeMusicTimers=[];break;
    case 'note_play':playTone(Number(f('NOTE')),Number(f('BEAT'))*.5);break;
    case 'audio_tf_play':{nativeAudio?.pause();const item=file();if(item?.url){nativeAudio=new Audio(item.url);nativeAudio.play().catch(()=>log('音频','浏览器未允许播放音频'));}else log('虚拟TF卡','请先在虚拟输入中加载音频文件');break;}
    case 'audio_stop':nativeAudio?.pause();break;
    case 'audio_record':recordVirtualAudio(text('FILE'),Number(f('SECONDS')));break;
    case 'ai_mode':nativeRuntime.mode=f('MODE');nativeRuntime.complete=false;nativeRuntime.recognized=-1;window.K10Vision?.mode(f('MODE'));break;
    case 'ai_learn':if(window.K10Vision?.isReal()){window.K10Vision.enroll();break;}if(nativeRuntime.mode==='人脸检测'&&virtualState.object==='人脸'){nativeRuntime.faces.add(virtualState.faceId);log('虚拟AI',`已学习模拟人脸 ${virtualState.faceId}`);}break;
    case 'ai_recognize':if(window.K10Vision?.isReal()){window.K10Vision.command('recognize');break;}nativeRuntime.recognized=nativeRuntime.mode==='人脸检测'&&virtualState.object==='人脸'&&nativeRuntime.faces.has(virtualState.faceId)?virtualState.faceId:-1;nativeRuntime.complete=true;break;
    case 'ai_forget':if(window.K10Vision?.isReal()){window.K10Vision.forget(Number(f('ID')));break;}nativeRuntime.faces.delete(Number(f('ID')));nativeRuntime.recognized=-1;nativeRuntime.complete=false;break;
    case 'ai_forget_all':if(window.K10Vision?.isReal()){window.K10Vision.forget();break;}nativeRuntime.faces.clear();nativeRuntime.recognized=-1;nativeRuntime.complete=false;break;
    case 'ai_motion_sensitivity':nativeRuntime.sensitivity=Number(f('VALUE'));break;
    case 'speech_config':nativeRuntime.speechMode=f('MODE');nativeRuntime.wakeTime=Number(f('TIME'));nativeRuntime.language=f('LANG');break;
    case 'speech_command':nativeRuntime.commands.set(Number(f('ID')),text('TEXT'));break;
    case 'speech_speed':nativeRuntime.speed=Number(f('VALUE'));break;
    case 'serial_write':log(f('PORT'),String(v('TEXT')??'')+(f('NEWLINE')==='换行'?' ↵':''));break;
    case 'serial_baud':nativeRuntime[f('PORT')+'Baud']=Number(f('BAUD'));break;
    case 'serial_pins':nativeRuntime.serialPins={rx:f('RX'),tx:f('TX'),baud:Number(f('BAUD'))};break;
    case 'pin_mode':virtualState.pins[f('PIN')].mode=f('MODE');break;
    case 'pin_digital_write':virtualState.pins[f('PIN')].digital=Number(f('VALUE'));log(f('PIN'),Number(f('VALUE'))?'高电平':'低电平');break;
    case 'pin_pwm':nativeRuntime.pwm[f('PIN')]=Number(f('VALUE'));log(f('PIN'),`PWM ${f('VALUE')}`);break;
    default:return false;
  }
  return true;
}
function applyScreenDirection(){const content=document.getElementById('lcdContent');if(!content)return;const angle=nativeRuntime.direction||0;content.style.transform=`rotate(${angle}deg) scale(${angle%180?0.75:1})`;}
async function startVirtualCamera(){const epoch=mediaEpoch;try{cameraStream?.getTracks().forEach(track=>track.stop());const stream=await navigator.mediaDevices.getUserMedia({video:true});if(epoch!==mediaEpoch){stream.getTracks().forEach(track=>track.stop());return;}cameraStream=stream;displayMode='camera';document.getElementById('lcdContent').innerHTML='<video class="camera-preview" autoplay playsinline muted></video>';cameraVideo=document.querySelector('.camera-preview');cameraVideo.srcObject=cameraStream;}catch{log('摄像头','未能打开电脑摄像头，请检查浏览器授权');}}
async function recordVirtualAudio(name,seconds){if(!name){log('录音','请插入文件名字符串积木');return;}const epoch=mediaEpoch;try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});if(epoch!==mediaEpoch){stream.getTracks().forEach(track=>track.stop());return;}if(activeRecorder?.state==='recording')activeRecorder.stop();recordingStream=stream;const recorder=new MediaRecorder(stream),chunks=[];activeRecorder=recorder;recorder.ondataavailable=e=>chunks.push(e.data);recorder.onstop=()=>{stream.getTracks().forEach(track=>track.stop());virtualState.files.set(name,{url:URL.createObjectURL(new Blob(chunks,{type:recorder.mimeType}))});log('虚拟TF卡',`录音已保存：${name}`);};recorder.start();setTimeout(()=>{if(recorder.state==='recording')recorder.stop();},seconds*1000);}catch{log('录音','未能打开麦克风，请检查浏览器授权');}}
function defineK10NativeGenerators(){
  const g=window.python?.pythonGenerator;if(!g)return;
  g.forBlock.screen_image=block=>{const image=k10ImageSettings(block);return `board.virtual.screen_image(${JSON.stringify(image.name)}, ${Number(block.getFieldValue('X'))||0}, ${Number(block.getFieldValue('Y'))||0}, ${image.width}, ${image.height})\n`};
  const types=k10NativeGroups.flatMap(group=>group.types).filter(type=>!g.forBlock[type]).concat(['operator_to_number','operator_ascii_text','operator_ascii_number','operator_to_text']);
  types.forEach(type=>{g.forBlock[type]=(block,generator)=>{
    const args=block.inputList.flatMap(input=>[...input.fieldRow.filter(field=>field.name).map(field=>JSON.stringify(field.getValue())),...(input.connection&&input.type===Blockly.INPUT_VALUE?[generator.valueToCode(block,input.name,generator.ORDER_NONE)||"''"]:[])]);
    const call=`board.virtual.${type}(${args.join(', ')})`;
    return block.outputConnection?[call,generator.ORDER_FUNCTION_CALL]:call+'\n';
  };});
}
function installVirtualModeUI(){
  document.body.insertAdjacentHTML('beforeend',`<div class="virtual-io-modal" id="virtualIO" hidden><section role="dialog" aria-modal="true" aria-labelledby="virtualIOTitle"><header><div><b id="virtualIOTitle">虚拟输入</b><small>这里的数值用于模拟 K10，不读取真实板卡</small></div><button id="closeVirtualIO" aria-label="关闭虚拟输入">×</button></header><div class="virtual-io-grid"><fieldset><legend>人工智能 · 模拟检测结果</legend><label>检测对象<select data-virtual="object"><option>无</option><option>人脸</option><option>猫脸</option><option>狗脸</option><option>移动物体</option><option>二维码</option></select></label><label>人脸 ID<input type="number" min="1" value="1" data-virtual="faceId"></label><div class="virtual-box-inputs">${['x','y','width','height'].map(key=>`<label>${{x:'X',y:'Y',width:'长',height:'宽'}[key]}<input type="number" min="0" value="${virtualState[key]}" data-virtual="${key}"></label>`).join('')}</div><label>二维码内容<input data-virtual="qr" placeholder="输入模拟识别结果"></label><label>语音命令 ID<input type="number" min="-1" max="199" value="-1" data-virtual="command"></label><label class="checkbox-label"><input type="checkbox" checked data-virtual="awake">语音识别已唤醒</label></fieldset><fieldset><legend>串口 · 接收队列</legend><label>串口0<textarea data-virtual="serial0" placeholder="输入供串口积木读取的数据"></textarea></label><label>串口1<textarea data-virtual="serial1" placeholder="输入供串口积木读取的数据"></textarea></label><small>“读取”积木会依次取走接收队列的数据。</small></fieldset><fieldset><legend>引脚 · 虚拟输入</legend>${['P0','P1','P2'].map(pin=>`<label>${pin} 数字<select data-pin="${pin}" data-value="digital"><option value="0">低电平</option><option value="1">高电平</option></select></label><label>${pin} 模拟<input type="number" min="0" max="4095" value="0" data-pin="${pin}" data-value="analog"></label>`).join('')}</fieldset><fieldset><legend>虚拟TF卡 · 图片与音频</legend><label class="file-label">加载文件<input id="virtualFiles" type="file" accept="image/*,audio/*" multiple></label><div id="virtualFileList">尚未加载文件</div><small>将文件名字符串积木放入对应槽位。虚拟文件保存在本次浏览器会话中。</small></fieldset></div></section></div>`);
  document.getElementById('virtualIOBtn').onclick=()=>{document.getElementById('virtualIO').hidden=false;document.getElementById('virtualFileList').textContent=[...virtualState.files.keys()].join(' · ')||'尚未加载文件';document.querySelectorAll('[data-virtual]').forEach(input=>{input.type==='checkbox'?input.checked=virtualState[input.dataset.virtual]:input.value=virtualState[input.dataset.virtual];});document.querySelectorAll('[data-pin]').forEach(input=>input.value=virtualState.pins[input.dataset.pin][input.dataset.value]);};
  document.getElementById('closeVirtualIO').onclick=()=>document.getElementById('virtualIO').hidden=true;
  document.querySelectorAll('[data-virtual]').forEach(input=>input.oninput=()=>virtualState[input.dataset.virtual]=input.type==='checkbox'?input.checked:input.type==='number'?Number(input.value):input.value);
  document.querySelectorAll('[data-pin]').forEach(input=>input.oninput=()=>virtualState.pins[input.dataset.pin][input.dataset.value]=Math.max(0,Math.min(input.dataset.value==='digital'?1:4095,Number(input.value)||0)));
  document.getElementById('virtualFiles').onchange=async event=>{
    for(const file of event.target.files){const url=URL.createObjectURL(file),item={url};if(file.type.startsWith('image/')){item.image=new Image();item.image.src=url;await item.image.decode();}virtualState.files.set(file.name,item);}
    document.getElementById('virtualFileList').textContent=[...virtualState.files.keys()].join(' · ');
  };
  document.querySelector('.sim-panel').insertAdjacentHTML('beforeend','<div class="real-mode-panel" id="realModePanel" hidden><span class="real-mode-icon">'+chipIcon+'</span><h2>真实模式</h2><p>正在准备 K10 串口连接与上传功能</p><small>当前先完善虚拟模式，积木程序已自动保存。</small><button id="backToVirtual">返回虚拟模式</button></div>');
  const selectMode=mode=>{currentMode=mode;stopProgram(false);document.querySelectorAll('[data-mode]').forEach(button=>{button.classList.toggle('active',button.dataset.mode===mode);button.setAttribute('aria-pressed',String(button.dataset.mode===mode));});document.getElementById('realModePanel').hidden=mode!=='real';document.getElementById('runBtn').disabled=mode==='real'||!k10Added;document.getElementById('virtualIOBtn').disabled=mode==='real';};
  document.querySelectorAll('[data-mode]').forEach(button=>button.onclick=()=>selectMode(button.dataset.mode));document.getElementById('backToVirtual').onclick=()=>selectMode('virtual');
  document.addEventListener('keydown',event=>{if(event.key==='Escape')document.getElementById('virtualIO').hidden=true;});
}
document.addEventListener('DOMContentLoaded',installVirtualModeUI);
