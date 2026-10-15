// Generator mappings checked against unihiker 0.0.29.0 and PinPong 0.6.2 sources.
function defineM10PythonGenerators(){
  const g=window.python?.pythonGenerator;if(!g)return;
  g.addReservedWords('gui,audio,time,GUI,Audio,Board,Pin,light,button_a,button_b,accelerometer,gyroscope,buzzer,_objects,_dispatch,_move,_recolor,_touch_handlers,_led');
  const q=value=>JSON.stringify(String(value??''));
  const f=(b,name)=>b.getFieldValue(name);
  const value=(b,name)=>g.valueToCode(b,name,g.ORDER_NONE)||"''";
  const object=b=>`_objects[${q(f(b,'NAME'))}]`;
  const coords=b=>`x=${f(b,'X')}, y=${f(b,'Y')}`;
  const click=b=>`onclick=lambda: _dispatch(${q(f(b,'NAME'))})`;
  g.forBlock.m10_start=()=>'';
  g.forBlock.m10_touch_event=()=>'';
  g.forBlock.m10_key_event=()=>'';
  g.forBlock.m10_text=b=>`${object(b)} = gui.draw_text(${coords(b)}, text=str(${value(b,'TEXT')}), font_size=${f(b,'SIZE')}, color=${q(f(b,'COLOR'))}, origin="nw", ${click(b)})\n`;
  g.forBlock.m10_button=b=>`${object(b)} = gui.add_button(${coords(b)}, w=${f(b,'W')}, h=${f(b,'H')}, text=str(${value(b,'TEXT')}), origin="nw", ${click(b)})\n`;
  g.forBlock.m10_rect=b=>`${object(b)} = gui.fill_rect(${coords(b)}, w=${f(b,'W')}, h=${f(b,'H')}, color=${q(f(b,'COLOR'))}, fill=${q(f(b,'COLOR'))}, ${click(b)})\n`;
  g.forBlock.m10_circle=b=>`${object(b)} = gui.fill_circle(${coords(b)}, r=${f(b,'R')}, color=${q(f(b,'COLOR'))}, fill=${q(f(b,'COLOR'))}, ${click(b)})\n`;
  g.forBlock.m10_line=b=>`${object(b)} = gui.draw_line(x0=${f(b,'X')}, y0=${f(b,'Y')}, x1=${f(b,'X2')}, y1=${f(b,'Y2')}, color=${q(f(b,'COLOR'))}, ${click(b)})\n`;
  g.forBlock.m10_image=b=>`${object(b)} = gui.draw_image(${coords(b)}, w=${b.m10Image.width}, h=${b.m10Image.height}, image=${q(m10ImagePath(b))}, origin="nw", ${click(b)})\n`;
  g.forBlock.m10_set_text=b=>`${object(b)}.config(text=str(${value(b,'TEXT')}))\n`;
  g.forBlock.m10_set_image=b=>`${object(b)}.config(image=${q(m10ImagePath(b))}, w=${b.m10Image.width}, h=${b.m10Image.height})\n`;
  g.forBlock.m10_set_position=b=>`_move(${object(b)}, ${f(b,'X')}, ${f(b,'Y')})\n`;
  g.forBlock.m10_set_color=b=>`_recolor(${object(b)}, ${q(f(b,'COLOR'))})\n`;
  g.forBlock.m10_set_size=b=>`${object(b)}.config(w=${f(b,'W')}, h=${f(b,'H')})\n`;
  g.forBlock.m10_remove=b=>`gui.remove(${object(b)})\ndel ${object(b)}\n`;
  g.forBlock.m10_clear=()=>`gui.clear()\n_objects.clear()\n`;
  g.forBlock.m10_light=()=>['light.read()',g.ORDER_FUNCTION_CALL];
  g.forBlock.m10_sound=()=>['audio.sound_level()',g.ORDER_FUNCTION_CALL];
  g.forBlock.m10_acceleration=b=>[`accelerometer.get_${f(b,'AXIS')}()`,g.ORDER_FUNCTION_CALL];
  g.forBlock.m10_gyroscope=b=>[`gyroscope.get_${f(b,'AXIS')}()`,g.ORDER_FUNCTION_CALL];
  g.forBlock.m10_button_state=b=>{
    const key=f(b,'BUTTON'),expression=key==='A+B'?'(button_a.is_pressed() and button_b.is_pressed())':`button_${key.toLowerCase()}.is_pressed()`;
    return [f(b,'STATE')==='UP'?`not ${expression}`:expression,g.ORDER_LOGICAL_NOT];
  };
  g.forBlock.m10_led=b=>`_led.write_digital(${f(b,'STATE')==='ON'?1:0})\n`;
  g.forBlock.m10_tone=b=>`buzzer.pitch(${f(b,'FREQ')}, ${f(b,'BEAT')})\n`;
  g.forBlock.m10_buzzer_stop=()=>`buzzer.stop()\n`;
  g.forBlock.m10_print=b=>`print(${value(b,'TEXT')})\n`;
}
function m10ImagePath(block){
  // Block IDs are encoded, so assets cannot traverse out of the export folder.
  const id=Array.from(String(block.id)).map(c=>c.codePointAt(0).toString(16)).join('_');
  const mime=(block.m10Image?.src||'').match(/^data:image\/(png|jpeg|webp|bmp);/i)?.[1];
  return `assets/image_${id}.${mime==='jpeg'?'jpg':mime||'png'}`;
}
function m10ProgramBlocks(workspace){
  const roots=workspace.getTopBlocks(true).filter(b=>['m10_start','m10_touch_event','m10_key_event'].includes(b.type));
  const blocks=[];
  const walk=b=>{if(!b||b.disabled||b.isEnabled?.()===false)return;blocks.push(b);for(const input of b.inputList||[]){const child=input.connection?.targetBlock();if(child)walk(child);}walk(b.getNextBlock());};
  roots.forEach(walk);return {roots,blocks};
}
function generateM10Python(workspace){
  const g=window.python?.pythonGenerator;
  if(!g)return {code:'# Python 生成器尚未加载',issues:['Python 生成器尚未加载'],images:[]};
  const {roots,blocks}=m10ProgramBlocks(workspace),issues=[];
  if(workspace.getTopBlocks(false).some(b=>['board_start','button_event','tilt_event'].includes(b.type)&&b.getNextBlock()))issues.push('工作区含 K10 程序入口，请使用 M10 程序开始或 M10 事件入口');
  // Shared numeric, text, variable and procedure rules already emit standard Python.
  const shared=new Set([...operatorTypes,'text','math_number','variables_get','variables_set','math_change','typed_string_get','typed_string_set','typed_list_get','typed_list_set','lists_create_empty','board_wait','board_forever','board_repeat','control_wait_until','control_repeat_until','control_if','control_if_else','control_if_elseif','procedures_callnoreturn']);
  for(const type of Object.keys(g.forBlock))if(type.startsWith('typed_list_'))shared.add(type);
  const procedureBlocks=workspace.getTopBlocks(false).filter(b=>b.type.startsWith('procedures_def'));
  // Procedures are reachable code; validate their bodies too, including disconnected definitions.
  const all=[...blocks,...procedureBlocks.flatMap(b=>b.getDescendants?.(false)||[b])];
  for(const b of all){
    if(!m10Types.has(b.type)&&!shared.has(b.type)&&!b.type.startsWith('procedures_def'))issues.push(`积木「${b.type}」尚无 M10 官方生成规则`);
    if(['m10_image','m10_set_image'].includes(b.type)&&!b.m10Image?.src)issues.push(`图片对象「${b.getFieldValue('NAME')}」尚未选择本地图片`);
  }
  const kinds=new Map();for(const b of all)if(['m10_text','m10_button','m10_image','m10_line','m10_rect','m10_circle'].includes(b.type)){
    const name=b.getFieldValue('NAME');if(!kinds.has(name))kinds.set(name,new Set());kinds.get(name).add(b.type.replace('m10_',''));
  }
  const permitted={m10_set_text:['text','button'],m10_set_image:['image'],m10_set_size:['image','button'],m10_set_position:['text','button','image','rect','circle','line'],m10_set_color:['text','rect','circle','line']};
  for(const b of all)if(b.type.startsWith('m10_set_')){
    const name=b.getFieldValue('NAME'),types=kinds.get(name);
    if(!types)issues.push(`更新对象「${name}」没有对应的创建积木`);
    else if([...types].some(type=>!permitted[b.type]?.includes(type)))issues.push(`对象「${name}」的 ${b.type.replace('m10_set_','')} 更新尚无完整生成规则`);
  }
  const images=all.filter(b=>['m10_image','m10_set_image'].includes(b.type)&&b.m10Image?.src).map(b=>({path:m10ImagePath(b),src:b.m10Image.src}));
  if(issues.length)return {code:'# M10 Python 3 工程尚不完整\n# '+[...new Set(issues)].join('\n# '),issues:[...new Set(issues)],images};
  try{
    g.init(workspace);
    const q=value=>JSON.stringify(String(value));
    let callbacks='';
    const globals=workspace.getAllVariables?.().map(v=>g.getVariableName(v.getId()))||[];
    const touch=new Map(),keys=new Map();
    roots.filter(b=>b.type!=='m10_start').forEach((b,index)=>{
      const name=`_handler_${index}`;
      // Event hats have a next chain, not a statement input.
      const generated=b.getNextBlock()?g.blockToCode(b.getNextBlock()):'';
      callbacks+=`def ${name}():\n${globals.length?'    global '+globals.join(', ')+'\n':''}${generated?g.prefixLines(generated,'    '):'    pass\n'}\n`;
      const map=b.type==='m10_touch_event'?touch:keys,key=b.getFieldValue(b.type==='m10_touch_event'?'NAME':'BUTTON');
      if(!map.has(key))map.set(key,[]);map.get(key).push(name);
    });
    callbacks+=`_touch_handlers = {${[...touch].map(([name,functions])=>q(name)+': ['+functions.join(', ')+']').join(', ')}}\n\ndef _dispatch(name):\n    for callback in _touch_handlers.get(name, []):\n        callback()\n\n`;
    if(all.some(b=>b.type==='m10_set_position'))callbacks+=`def _move(obj, x, y):\n    if isinstance(obj, GUI.CanvasLine):\n        obj.config(x0=x, y0=y)\n    else:\n        obj.config(x=x, y=y)\n\n`;
    if(all.some(b=>b.type==='m10_set_color'))callbacks+=`def _recolor(obj, color):\n    if isinstance(obj, (GUI.CanvasRect, GUI.CanvasCircle)):\n        obj.config(color=color, fill=color)\n    else:\n        obj.config(color=color)\n\n`;
    for(const [key,names] of keys){callbacks+=`def _key_${key.toLowerCase()}():\n${names.map(name=>'    '+name+'()\n').join('')}\ngui.on_${key.toLowerCase()}_click(_key_${key.toLowerCase()})\n\n`;}
    procedureBlocks.forEach(b=>g.blockToCode(b));
    let main='';roots.filter(b=>b.type==='m10_start').forEach(b=>{if(b.getNextBlock())main+=g.blockToCode(b.getNextBlock());});
    const body=g.finish(callbacks+main+'\n# 保持触屏和按键回调可用\nwhile True:\n    time.sleep(0.05)\n');
    const pin=all.some(b=>['m10_light','m10_acceleration','m10_gyroscope','m10_button_state','m10_led','m10_tone','m10_buzzer_stop'].includes(b.type));
    const audio=all.some(b=>b.type==='m10_sound');
    const headers=`# 板演 · 行空板 M10 · Python 3\n# 官方 API 映射，未在实板运行验证；浏览器仿真不执行此 Python 文件。\nimport time\nfrom unihiker import GUI${audio?', Audio':''}\n${pin?'from pinpong.board import Board, Pin\nfrom pinpong.extension.unihiker import light, button_a, button_b, accelerometer, gyroscope, buzzer\n\nBoard().begin()\n':''}\ngui = GUI()\n${audio?'audio = Audio()\n':''}${all.some(b=>b.type==='m10_led')?'_led = Pin(Pin.P25, Pin.OUT)\n':''}_objects = {}\n\n`;
    return {code:headers+body,issues:[],images};
  }catch(error){return {code:'# M10 代码生成失败\n# '+error.message,issues:[`代码生成失败：${error.message}`],images};}
}
function downloadM10Project(){
  const result=generateM10Python(blocklyWorkspace);if(result.issues.length){updateCode();return;}
  const files=[['BoardLab_M10/main.py',result.code],['BoardLab_M10/workspace.json',JSON.stringify(Blockly.serialization.workspaces.save(blocklyWorkspace),null,2)],['BoardLab_M10/README.txt','行空板 M10 Python 3 工程\n使用官方 unihiker、PinPong 库；不是 K10 MicroPython / Arduino 工程。\n将整个目录（包括 assets）复制到 M10 后，从此目录运行 main.py。\n生成规则依据 unihiker 0.0.29.0、PinPong 0.6.2；当前工程未在实板执行验证。\n图像按比例缩放。创建控件立即显示，config 更新已有控件，无缓存更新步骤。\nM10 A+B 是 A 与 B 同时按下；两个单键读取仍为真，请用 if/elif 安排优先级。\n摄像头识别、真实 MQTT 通信和外接模块尚未接入此版本。\n']];
  for(const image of result.images){const data=atob(image.src.split(',')[1]);files.push(['BoardLab_M10/'+image.path,Uint8Array.from(data,c=>c.charCodeAt(0))]);}
  const url=URL.createObjectURL(createK10ProjectZip(files)),link=document.createElement('a');link.href=url;link.download='BoardLab_M10_Python3.zip';link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);toast('M10 Python 3 工程已生成');
}

function createM10Example(id){
  const text=TEXT=>({shadow:{type:'text',fields:{TEXT}}});
  const literal=TEXT=>({block:{type:'text',fields:{TEXT}}});
  const block=(type,fields={},inputs={})=>({type,fields,inputs});
  const chain=(...items)=>{for(let i=0;i<items.length-1;i++)items[i].next={block:items[i+1]};return items[0]};
  const title=()=>block('m10_text',{NAME:'标题',X:15,Y:20,SIZE:20,COLOR:'#26374e'},{TEXT:text('你好，M10')});
  const update=label=>block('m10_set_text',{NAME:'标题'},{TEXT:literal(label)});
  const loop=body=>block('board_forever',{}, {DO:{block:body}});
  const condition=(key,yes,no)=>block('control_if_else',{}, {CHECK:{block:block('m10_button_state',{BUTTON:key,STATE:'DOWN'})},DO:{block:yes},ELSE:{block:no}});
  const initial=block('m10_start');initial.x=170;initial.y=55;
  let roots=[initial];
  if(id==='image')initial.next={block:{type:'m10_image',fields:{NAME:'图片1',X:0,Y:0},extraState:{src:'',filename:'',width:240,height:320}}};
  else if(id==='display')initial.next={block:chain(title(),block('m10_rect',{NAME:'色块',X:20,Y:75,W:200,H:60,COLOR:'#20b593'}),block('m10_circle',{NAME:'圆形',X:120,Y:195,R:45,COLOR:'#5b3fe8'}))};
  else if(id==='rgb')initial.next={block:loop(chain(block('m10_led',{STATE:'ON'}),block('board_wait',{SECONDS:.5}),block('m10_led',{STATE:'OFF'}),block('board_wait',{SECONDS:.5})))};
  else if(id==='button')initial.next={block:chain(title(),loop(chain(condition('A+B',update('A + B 同时按下'),condition('A',update('按键 A'),condition('B',update('按键 B'),update('请按 A / B')))),block('board_wait',{SECONDS:.05}))))};
  else if(id==='night'){
    const compare=block('logic_compare',{OP:'LT'},{A:{block:block('m10_light')},B:{shadow:{type:'math_number',fields:{NUM:400}}}});
    initial.next={block:loop(chain(block('control_if_else',{}, {CHECK:{block:compare},DO:{block:block('m10_led',{STATE:'ON'})},ELSE:{block:block('m10_led',{STATE:'OFF'})}}),block('board_wait',{SECONDS:.1})))};
  }else if(id==='environment')initial.next={block:chain(title(),loop(chain(block('m10_set_text',{NAME:'标题'},{TEXT:{block:block('m10_light')}}),block('board_wait',{SECONDS:.1}))))};
  else{
    initial.next={block:chain(title(),block('m10_button',{NAME:'按钮',X:20,Y:80,W:200,H:50},{TEXT:text('点击触屏按钮')}))};
    roots.push({...chain(block('m10_touch_event',{NAME:'按钮'}),update('触屏成功！')),x:170,y:245});
  }
  Blockly.serialization.workspaces.load({blocks:{languageVersion:0,blocks:roots}},blocklyWorkspace);saveWorkspace();
  requestAnimationFrame(()=>blocklyWorkspace.scrollCenter());
}
