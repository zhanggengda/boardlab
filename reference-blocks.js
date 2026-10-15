// K10 display parameters follow the official Mind+ screen reference.
function defineReferenceBlocks() {
  const n=(name,value=0,min=0,max=320)=>({type:'field_number',name,value,min,max});
  const drop=(name,options)=>({type:'field_dropdown',name,options});
  const color=(name='COLOR',colour='#0000ff')=>({type:'field_colour',name,colour});
  const input=(name,check)=>({type:'input_value',name,...(check?{check}:{})});
  const row=()=>drop('ROW',Array.from({length:13},(_,i)=>[String(i+1),String(i+1)]));
  const json=(type,message0,args0=[],output)=>({type,message0,args0,inputsInline:true,...(output?{output}:{previousStatement:null,nextStatement:null}),style:output==='operator'?'operator_blocks':'board_blocks'});
  const blocks=[
    json('screen_text_line','缓存显示文字 %1 在第 %2 行 颜色 %3',[input('TEXT'),row(),color()]),
    {...json('screen_text_xy','缓存显示文字 %1',[input('TEXT')]),message1:'坐标 X %1 Y %2 字号 %3',args1:[n('X'),n('Y'),drop('SIZE',[['24×24','24'],['16×16','16']])],message2:'颜色 %1 换行字数 %2 自动清除 %3',args2:[color(),n('WRAP',50,1,50),drop('CLEAR',[['是','YES'],['否','NO']])]},
    json('screen_update','将缓存内容显示 / 显示更新'),
    json('screen_clear_all','清除全屏'),
    json('screen_clear_line','立即清除第 %1 行文字',[row()]),
    json('screen_width','设置线宽 / 边框宽为 %1',[n('WIDTH',1,1,20)]),
    json('screen_point','缓存画点 X %1 Y %2 颜色 %3',[n('X'),n('Y'),color()]),
    {...json('screen_line','缓存画线 X1 %1 Y1 %2',[n('X1'),n('Y1')]),message1:'到 X2 %1 Y2 %2 颜色 %3',args1:[n('X2',100),n('Y2',100),color()]},
    {...json('screen_rect','缓存画矩形 X %1 Y %2 宽 %3 高 %4',[n('X'),n('Y'),n('W',80),n('H',60)]),message1:'边框 %1 填充 %2 颜色 %3',args1:[color(),drop('FILL',[['否','NO'],['是','YES']]),color('FCOLOR','#ffffff')]},
    {...json('screen_circle','缓存画圆 X %1 Y %2 半径 %3',[n('X',120),n('Y',160),n('R',40)]),message1:'边框 %1 填充 %2 颜色 %3',args1:[color(),drop('FILL',[['否','NO'],['是','YES']]),color('FCOLOR','#ffffff')]},
    json('screen_line_value','缓存画线 X1 %1 Y1 %2 到 X2 %3 Y2 %4 颜色 %5',[input('X1','Number'),input('Y1','Number'),input('X2','Number'),input('Y2','Number'),color()]),
    json('screen_rect_value','缓存画矩形 X %1 Y %2 宽 %3 高 %4 边框 %5 填充 %6 颜色 %7',[input('X','Number'),input('Y','Number'),input('W','Number'),input('H','Number'),color(),drop('FILL',[['否','NO'],['是','YES']]),color('FCOLOR','#ffffff')]),
    json('screen_circle_value','缓存画圆 X %1 Y %2 半径 %3 边框 %4 填充 %5 颜色 %6',[input('X','Number'),input('Y','Number'),input('R','Number'),color(),drop('FILL',[['否','NO'],['是','YES']]),color('FCOLOR','#ffffff')]),
    json('k10_environment','读取 %1',[drop('SENSOR',[['温度（℃）','temp'],['温度（℉）','fahrenheit'],['湿度（%）','humidity'],['环境光（Lux）','light']])],'Number'),
    json('k10_light','读取环境光强度',[],'Number'),
    json('k10_acceleration','读取加速度 %1（mg）',[drop('AXIS',[['X','x'],['Y','y'],['Z','z'],['强度','strength']])],'Number'),
    json('k10_button_state','按键 %1 %2？',[drop('BUTTON',[['A','A'],['B','B'],['A+B','A+B']]),drop('STATE',[['按下','DOWN'],['松开','UP']])],'Boolean'),
    json('k10_posture','主板姿态为 %1？',[drop('TILT',[['向前倾斜','forward'],['向后倾斜','back'],['向左倾斜','left'],['向右倾斜','right'],['屏幕朝上','flat'],['屏幕朝下','down']])],'Boolean'),
    json('rgb_pixel','RGB 灯 %1 设为 %2',[drop('LED',[['全部','all'],['0','0'],['1','1'],['2','2']]),color('COLOR','#2fe0b6')]),
    json('rgb_brightness','设置 RGB 灯亮度 %1',[{...n('VALUE',5,0,9),precision:1}]),
    {...json('operator_map','映射 %1 从 %2 — %3',[input('VALUE','Number'),input('FROM_LOW','Number'),input('FROM_HIGH','Number')],'Number'),message1:'到 %1 — %2',args1:[input('TO_LOW','Number'),input('TO_HIGH','Number')],style:'operator_blocks'},
    {...json('operator_contains','%1 包含 %2？',[input('TEXT'),input('FIND')],'Boolean'),style:'operator_blocks'},
    {...json('operator_prefix','%1 以 %2 字符串开头？',[input('TEXT'),input('PREFIX')],'Boolean'),style:'operator_blocks'}
  ];
  for(const block of blocks) {
    let args=block.args0||[];
    for(let i=1;block['message'+i]!==undefined;i++){const offset=args.length;block.message0+=' '+block['message'+i].replace(/%(\d+)/g,(_,n)=>'%'+(Number(n)+offset));args=args.concat(block['args'+i]||[]);delete block['message'+i];delete block['args'+i];}block.args0=args;
    if(block.type.startsWith('screen_'))block.tooltip='K10 屏幕按 240×320 像素绘制；缓存文字与图形后使用“显示更新”。';
  }
  Blockly.defineBlocksWithJsonArray(blocks);
  for(const type of ['screen_text_line','screen_text_xy']) {
    const definition=Blockly.Blocks[type],init=definition.init;
    definition.init=function() {
      init.call(this);
      const initSvg=this.initSvg;
      this.initSvg=function(){initSvg.call(this);this.getSvgRoot().classList.add('cached-text-block');};
    };
  }
  for(const [kind,type] of [['String','string'],['Array','list']]) {
    const variable=()=>({type:'field_variable',name:'VAR',variable:'my '+type+' variable',variableTypes:[kind],defaultType:kind});
    Blockly.defineBlocksWithJsonArray([
      {...json('typed_'+type+'_get','变量 %1',[variable()],kind),style:kind==='String'?'string_variable_blocks':'variable_blocks'},
      {...json('typed_'+type+'_set','设置 %1 的值为 %2',[variable(),input('VALUE',kind)]),style:kind==='String'?'string_variable_blocks':'variable_blocks'},
      ...(kind==='Array'?[
        {...json('typed_list_add','将 %2 加入 %1',[variable(),input('VALUE')]),style:'variable_blocks'},
        {...json('typed_list_remove','删除 %1 第 %2 项',[variable(),input('INDEX','Number')]),style:'variable_blocks'},
        {...json('typed_list_clear','删除 %1 的全部项目',[variable()]),style:'variable_blocks'},
        {...json('typed_list_insert','在 %1 的第 %2 项前插入 %3',[variable(),input('INDEX','Number'),input('VALUE')]),style:'variable_blocks'},
        {...json('typed_list_replace','将 %1 的第 %2 项替换为 %3',[variable(),input('INDEX','Number'),input('VALUE')]),style:'variable_blocks'},
        {...json('typed_list_item','%1 第 %2 项',[variable(),input('INDEX','Number')],'Any'),output:null,style:'variable_blocks'},
        {...json('typed_list_index','%1 中第一个 %2 的编号',[variable(),input('VALUE')],'Number'),style:'variable_blocks'},
        {...json('typed_list_length','%1 的项目数',[variable()],'Number'),style:'variable_blocks'},
        {...json('typed_list_contains','%1 包含 %2？',[variable(),input('VALUE')],'Boolean'),style:'variable_blocks'}
      ]:[])
    ]);
  }
}

const operatorTypes=['logic_compare','logic_operation','logic_negate','logic_boolean','math_arithmetic','math_random_int','math_modulo','math_round','math_single','math_trig','math_constant','math_number_property','operator_map','math_constrain','text_join','text_charAt','text_length','operator_contains','operator_prefix','text_getSubstring','text_indexOf'];
const referenceScreenTypes=['screen_text_line','screen_text_xy','screen_update','screen_clear','screen_clear_all','screen_clear_line','screen_point','screen_width','screen_line','screen_circle','screen_rect','screen_line_value','screen_rect_value','screen_circle_value'];
const referenceSensorTypes=['button_event','tilt_event','k10_button_state','k10_posture','k10_environment','k10_light','k10_acceleration'];
function referenceToolboxBlock(type,fields={}) {
  const shadow=(type,fields)=>({shadow:{type,fields}});
  const number=value=>shadow('math_number',{NUM:value});
  const text=value=>shadow('text',{TEXT:value});
  const defaults={screen_text_line:{TEXT:text('行空板')},screen_text_xy:{TEXT:text('行空板')},logic_compare:{A:number(0),B:number(0)},logic_operation:{A:shadow('logic_boolean',{BOOL:'TRUE'}),B:shadow('logic_boolean',{BOOL:'TRUE'})},logic_negate:{BOOL:shadow('logic_boolean',{BOOL:'TRUE'})},math_arithmetic:{A:number(0),B:number(0)},math_number_property:{NUMBER_TO_CHECK:number(0)},operator_map:{VALUE:number(0),FROM_LOW:number(0),FROM_HIGH:number(1023),TO_LOW:number(0),TO_HIGH:number(255)},operator_contains:{TEXT:text('hello'),FIND:text('world')},operator_prefix:{TEXT:text('hello'),PREFIX:text('h')},variables_set:{VALUE:number(0)},math_change:{DELTA:number(1)},typed_string_set:{VALUE:text('hello')},typed_list_set:{VALUE:shadow('lists_create_empty',{})},typed_list_add:{VALUE:text('东西')},typed_list_remove:{INDEX:number(1)},typed_list_insert:{INDEX:number(1),VALUE:text('1')},typed_list_replace:{INDEX:number(1),VALUE:text('1')},typed_list_item:{INDEX:number(1)},typed_list_index:{VALUE:text('东西')},typed_list_contains:{VALUE:text('东西')},math_random_int:{FROM:number(1),TO:number(10)},math_modulo:{DIVIDEND:number(10),DIVISOR:number(3)},math_constrain:{VALUE:number(0),LOW:number(0),HIGH:number(100)},math_round:{NUM:number(3.5)},math_single:{NUM:number(9)},math_trig:{NUM:number(45)},text_join:{ADD0:text('hello'),ADD1:text('world')},text_length:{VALUE:text('world')},text_charAt:{VALUE:text('world'),AT:number(1)},text_indexOf:{VALUE:text('apple'),FIND:text('ap')},text_getSubstring:{STRING:text('apple'),AT1:number(1),AT2:number(2)},
    screen_text:{TEXT:text('行空板')},screen_tf_image:{FILE:text('image.png')},camera_photo:{FILE:text('photo.bmp')},screen_qr:{TEXT:text('https://www.unihiker.com')},
    audio_tf_play:{FILE:text('music.wav')},audio_record:{FILE:text('sound.wav')},speech_command:{TEXT:text('kai deng')},speak_text:{TEXT:text('你好')},serial_write:{TEXT:text('hello')},number_decimal:{VALUE:number(0)}};
  Object.assign(defaults,{operator_to_number:{TEXT:text('123')},operator_ascii_text:{VALUE:number(0)},operator_ascii_number:{TEXT:text('a')},operator_to_text:{VALUE:number(132)}});
  Object.assign(defaults,{screen_line_value:{X1:number(0),Y1:number(0),X2:number(100),Y2:number(100)},screen_rect_value:{X:number(0),Y:number(0),W:number(80),H:number(60)},screen_circle_value:{X:number(120),Y:number(160),R:number(40)}});
  const inputs=Object.fromEntries(Object.entries(defaults[type]||{}).filter(([,value])=>value));
  return {kind:'block',type,...(Object.keys(fields).length?{fields}:{}),...(Object.keys(inputs).length?{inputs}:{})};
}

function installReferenceEditing(workspace) {
  // Autoclose flyouts normally prevent field clicks. Permit selection before drag.
  Blockly.FieldDropdown.prototype.isClickableInFlyout=()=>true;
  Blockly.FieldTextInput.prototype.isClickableInFlyout=()=>true;
  Blockly.FieldNumber.prototype.isClickableInFlyout=()=>true;
  Blockly.FieldColour?.prototype && (Blockly.FieldColour.prototype.isClickableInFlyout=()=>true);
  workspace.registerToolboxCategoryCallback('MIND_VARIABLES',ws=>{
    const contents=[];
    for(const [type,title,key,get,set] of [['','数字','NUMBER','variables_get','variables_set'],['String','字符串','STRING','typed_string_get','typed_string_set'],['Array','列表','LIST','typed_list_get','typed_list_set']]) {
      contents.push({kind:'button',text:type==='Array'?'新建列表':'新建'+title+'类型变量',callbackKey:'CREATE_'+key});
      for(const model of ws.getVariableMap().getVariablesOfType(type)) {
        const field={VAR:{id:model.getId()}};
        contents.push(referenceToolboxBlock(get,field),referenceToolboxBlock(set,field));
        if(type==='')contents.push(referenceToolboxBlock('math_change',field));
        if(type==='Array')for(const block of ['typed_list_add','typed_list_remove','typed_list_clear','typed_list_insert','typed_list_replace','typed_list_item','typed_list_index','typed_list_length','typed_list_contains'])contents.push(referenceToolboxBlock(block,field));
      }
    }
    return contents;
  });
  workspace.registerToolboxCategoryCallback('MIND_PROCEDURES',ws=>{
    const calls=ws.getToolboxCategoryCallback('PROCEDURE')(ws).filter(item=>item.kind==='block'&&item.type?.startsWith('procedures_call'));
    for(const call of calls){
      const definition=ws.getTopBlocks(false).find(block=>block.type.startsWith('procedures_def')&&block.getFieldValue('NAME')===call.extraState?.name);
      let params=[];try{params=JSON.parse(definition?.data||'{}').mindParams||[];}catch{}
      const inputs={};let index=0;
      for(const param of params){if(param.kind==='label')continue;
        inputs['ARG'+index++]={shadow:param.kind==='number'?{type:'math_number',fields:{NUM:0}}:param.kind==='boolean'?{type:'logic_boolean',fields:{BOOL:'TRUE'}}:{type:'text',fields:{TEXT:'text'}}};
      }
      if(index)call.inputs=inputs;
    }
    return [{kind:'button',text:'自定义模块',callbackKey:'CREATE_PROCEDURE'},...calls];
  });
  workspace.registerButtonCallback('CREATE_PROCEDURE',()=>openProcedureBuilder(workspace));
  for(const [key,type] of [['NUMBER',''],['STRING','String'],['LIST','Array']])workspace.registerButtonCallback('CREATE_'+key,()=>Blockly.Variables.createVariableButtonHandler(workspace,()=>refreshContinuousToolbox(),type));
  const item=Blockly.ContextMenuRegistry.registry.getItem('blockDuplicate');
  item.callback=scope=>{if(scope.block)beginDuplicateCarry(scope.block)};
}

function decorateMindProcedure(block){
  let params=[];try{params=JSON.parse(block.data||'{}').mindParams||[];}catch{}
  block.inputList.filter(input=>input.name?.startsWith('MIND_LABEL_')).forEach(input=>block.removeInput(input.name));
  params.filter(param=>param.kind==='label').forEach((param,index)=>{
    const name='MIND_LABEL_'+index;
    block.appendDummyInput(name).appendField(param.name||'label text');
    if(block.getInput('STACK'))block.moveInputBefore(name,'STACK');
  });
  if(block.rendered)block.render();
}

function openProcedureBuilder(workspace){
  document.querySelector('.procedure-builder')?.remove();
  const previousFocus=document.activeElement;
  const overlay=document.createElement('div');overlay.className='procedure-builder';
  overlay.innerHTML=`<section role="dialog" aria-modal="true" aria-labelledby="procedureTitle">
    <header class="procedure-header">
      <div class="procedure-heading"><span class="procedure-mark" aria-hidden="true">ƒ</span><div><span class="procedure-eyebrow">函数积木</span><h2 id="procedureTitle">创建自定义模块</h2></div></div>
      <button type="button" class="procedure-close" aria-label="关闭弹窗">×</button>
    </header>
    <div class="procedure-body">
      <div class="procedure-form">
        <label class="procedure-field-label" for="procedureName">积木名称</label>
        <input id="procedureName" type="text" maxlength="40" value="积木名称" autocomplete="off" />
        <div class="procedure-section-heading"><h3>输入项</h3><span>按需添加</span></div>
        <div class="procedure-params" id="procedureParams"></div>
        <div class="procedure-kinds" role="group" aria-label="添加输入项">
          <button type="button" data-kind="string"><span class="procedure-kind-icon" aria-hidden="true">Aa</span><span>文本值</span></button>
          <button type="button" data-kind="number"><span class="procedure-kind-icon" aria-hidden="true">12</span><span>数字值</span></button>
          <button type="button" data-kind="boolean"><span class="procedure-kind-icon" aria-hidden="true">◇</span><span>布尔值</span></button>
          <button type="button" data-kind="label"><span class="procedure-kind-icon" aria-hidden="true">T</span><span>文本标签</span></button>
        </div>
        <p class="procedure-error" id="procedureError" role="alert"></p>
      </div>
      <aside class="procedure-preview" aria-label="积木预览">
        <div class="procedure-preview-heading"><strong>实时预览</strong><span class="procedure-live-dot" aria-hidden="true"></span></div>
        <div class="procedure-preview-stage"><div class="procedure-chip"><span class="procedure-chip-prefix">定义</span><strong id="procedurePreviewName">积木名称</strong><span id="procedurePreviewParams"></span></div></div>
        <p class="procedure-preview-note">创建后可在「函数」分类中使用</p>
      </aside>
    </div>
    <footer><span id="procedureCount">0 个输入项</span><div class="procedure-footer-actions"><button type="button" class="procedure-cancel">取消</button><button type="button" class="procedure-save">创建模块</button></div></footer>
  </section>`;
  document.body.append(overlay);
  const nameInput=overlay.querySelector('#procedureName'),list=overlay.querySelector('#procedureParams');
  const params=[];const close=()=>{overlay.remove();if(previousFocus?.isConnected)previousFocus.focus()};
  const previewParams=()=>{
    const preview=overlay.querySelector('#procedurePreviewParams');preview.replaceChildren();
    params.forEach(param=>{
      const token=document.createElement('span');token.className='procedure-preview-token'+(param.kind==='label'?' is-label':'');
      token.textContent=param.name.trim()||({string:'文本值',number:'数字值',boolean:'条件',label:'说明文字'})[param.kind];
      if(param.kind!=='label'){const type=document.createElement('em');type.textContent=param.kind==='string'?'文本':param.kind==='number'?'数字':'布尔';token.append(type)}
      preview.append(token);
    });
  };
  const render=()=>{
    overlay.querySelector('#procedurePreviewName').textContent=nameInput.value.trim()||'积木名称';
    previewParams();
    list.replaceChildren();
    overlay.querySelector('#procedureCount').textContent=`${params.length} 个输入项`;
    if(!params.length){const empty=document.createElement('p');empty.className='procedure-empty';empty.textContent='还没有输入项，可直接创建，或在下方添加。';list.append(empty)}
    params.forEach((param,index)=>{const row=document.createElement('div');row.className='procedure-param';const kind=document.createElement('span');kind.className='procedure-param-kind';kind.textContent=({string:'文本值',number:'数字值',boolean:'布尔值',label:'文本标签'})[param.kind];const input=document.createElement('input');input.value=param.name;input.maxLength=30;input.setAttribute('aria-label',`${kind.textContent}名称`);input.addEventListener('input',()=>{param.name=input.value;overlay.querySelector('#procedureError').textContent='';previewParams();});const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label',`删除${kind.textContent}`);remove.addEventListener('click',()=>{params.splice(index,1);render()});row.append(kind,input,remove);list.append(row);});
  };
  nameInput.addEventListener('input',()=>{overlay.querySelector('#procedureError').textContent='';render()});
  overlay.querySelectorAll('[data-kind]').forEach(button=>button.addEventListener('click',()=>{const kind=button.dataset.kind;params.push({kind,name:kind==='label'?'说明文字':kind==='string'?'文本值':kind==='number'?'数字值':'条件'});render();list.lastElementChild?.querySelector('input')?.select();}));
  overlay.querySelector('.procedure-close').addEventListener('click',close);
  overlay.querySelector('.procedure-cancel').addEventListener('click',close);
  overlay.addEventListener('click',event=>{if(event.target===overlay)close()});
  overlay.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();close()}
    if(event.key==='Tab'){
      const focusable=[...overlay.querySelectorAll('button,input')].filter(element=>element.getClientRects().length);
      if(event.shiftKey&&document.activeElement===focusable[0]){event.preventDefault();focusable.at(-1)?.focus()}
      else if(!event.shiftKey&&document.activeElement===focusable.at(-1)){event.preventDefault();focusable[0]?.focus()}
    }
  });
  overlay.querySelector('.procedure-save').addEventListener('click',()=>{
    const name=nameInput.value.trim(),error=overlay.querySelector('#procedureError');
    const names=params.filter(param=>param.kind!=='label').map(param=>param.name.trim());
    if(!name){error.textContent='请输入积木名称';nameInput.focus();return}
    if(workspace.getTopBlocks(false).some(block=>block.type.startsWith('procedures_def')&&block.getFieldValue('NAME').toLowerCase()===name.toLowerCase())){error.textContent='已有同名模块，请换一个名称';nameInput.focus();return}
    if(names.some(value=>!value)||new Set(names).size!==names.length){error.textContent='输入项名称不能为空或重复';return}
    Blockly.Events.setGroup(true);
    try{
      const block=workspace.newBlock('procedures_defnoreturn');block.setFieldValue(name,'NAME');
      if(names.length){const mutation=Blockly.utils.xml.createElement('mutation');names.forEach(value=>{let model=workspace.getVariableMap().getVariable(value,'');if(!model)model=workspace.getVariableMap().createVariable(value,'');const arg=Blockly.utils.xml.createElement('arg');arg.setAttribute('name',value);arg.setAttribute('varid',model.getId());mutation.appendChild(arg)});block.domToMutation(mutation)}
      block.data=JSON.stringify({mindParams:params.map(param=>({...param,name:param.name.trim()}))});
      decorateMindProcedure(block);block.initSvg();block.render();block.moveBy(250,80);
      close();refreshContinuousToolbox();workspace.centerOnBlock?.(block.id);
    }finally{Blockly.Events.setGroup(false)}
  });
  render();nameInput.focus();nameInput.select();
}

let duplicateCarry=null, lastEditorPointer={x:0,y:0};
document.addEventListener('pointermove',e=>{lastEditorPointer={x:e.clientX,y:e.clientY}},true);
function beginDuplicateCarry(source,point=lastEditorPointer) {
  finishDuplicateCarry(null,true);
  const ws=source.workspace,rect=ws.getInjectionDiv().getBoundingClientRect(),origin=ws.getOriginOffsetInPixels();
  if(!point.x&&!point.y){const r=source.getSvgRoot().getBoundingClientRect();point={x:r.x+24,y:r.y+20}}
  const loc=new Blockly.utils.Coordinate((point.x-rect.x-origin.x)/ws.scale,(point.y-rect.y-origin.y)/ws.scale);
  Blockly.Events.setGroup(true);
  const copy=Blockly.clipboard.paste(source.toCopyData(true),ws,loc);
  if(!copy){Blockly.Events.setGroup(false);return null}
  const event=new PointerEvent('pointermove',{clientX:point.x,clientY:point.y,pointerType:'mouse'});
  const dragger=new Blockly.dragging.Dragger(copy);
  dragger.onDragStart(event);
  duplicateCarry={copy,dragger,point};
  Blockly.hideChaff();
  $('#blocksView').classList.add('carrying-copy');
  return copy;
}
function finishDuplicateCarry(event,cancel=false) {
  const carry=duplicateCarry;if(!carry)return;
  duplicateCarry=null;
  carry.dragger.onDragEnd(event||new KeyboardEvent('keydown'));
  if(cancel&&!carry.copy.isDeadOrDying())carry.copy.dispose(false);
  Blockly.Events.setGroup(false);
  $('#blocksView').classList.remove('carrying-copy');
  saveWorkspace();
}
document.addEventListener('pointermove',e=>{
  if(!duplicateCarry)return;
  e.preventDefault();e.stopImmediatePropagation();
  const {dragger,point}=duplicateCarry;
  dragger.onDrag(e,new Blockly.utils.Coordinate(e.clientX-point.x,e.clientY-point.y));
},true);
document.addEventListener('pointerdown',e=>{if(duplicateCarry){e.preventDefault();e.stopImmediatePropagation();finishDuplicateCarry(e,e.button===2)}},true);
document.addEventListener('keydown',e=>{if(duplicateCarry&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();finishDuplicateCarry(null,true)}},true);

const runtimeVariables=new Map();
function referenceValue(block) {
  const v=name=>blockValue(block.getInputTargetBlock(name)),f=name=>block.getFieldValue(name),num=name=>Number(v(name))||0;
  const text=name=>String(v(name)??'');
  switch(block.type) {
    case 'variables_get':case 'typed_string_get':case 'typed_list_get':return runtimeVariables.get(f('VAR'))??(block.type.includes('list')?[]:block.type.includes('string')?'':0);
    case 'typed_list_length':return (runtimeVariables.get(f('VAR'))||[]).length;
    case 'typed_list_item':return (runtimeVariables.get(f('VAR'))||[])[Math.max(0,num('INDEX')-1)]??'';
    case 'typed_list_index':return (runtimeVariables.get(f('VAR'))||[]).indexOf(v('VALUE'))+1;
    case 'typed_list_contains':return (runtimeVariables.get(f('VAR'))||[]).includes(v('VALUE'));
    case 'lists_create_empty':return [];
    case 'lists_create_with':return Array.from({length:block.itemCount_},(_,i)=>v('ADD'+i));
    case 'math_random_int':{const lo=Math.ceil(num('FROM')),hi=Math.floor(num('TO'));return lo+Math.floor(Math.random()*(Math.max(0,hi-lo)+1))}
    case 'math_modulo':return num('DIVISOR')?num('DIVIDEND')%num('DIVISOR'):0;
    case 'math_round':return ({ROUND:Math.round,ROUNDUP:Math.ceil,ROUNDDOWN:Math.floor})[f('OP')](num('NUM'));
    case 'math_single':return ({ROOT:Math.sqrt,ABS:Math.abs,NEG:n=>-n,LN:Math.log,LOG10:Math.log10,EXP:Math.exp,POW10:n=>10**n})[f('OP')](num('NUM'));
    case 'math_trig':return ({SIN:n=>Math.sin(n*Math.PI/180),COS:n=>Math.cos(n*Math.PI/180),TAN:n=>Math.tan(n*Math.PI/180),ASIN:n=>Math.asin(n)*180/Math.PI,ACOS:n=>Math.acos(n)*180/Math.PI,ATAN:n=>Math.atan(n)*180/Math.PI})[f('OP')](num('NUM'));
    case 'math_constant':return {PI:Math.PI,E:Math.E,GOLDEN_RATIO:(1+Math.sqrt(5))/2,SQRT2:Math.SQRT2,SQRT1_2:Math.SQRT1_2,INFINITY:Infinity}[f('CONSTANT')];
    case 'math_number_property':{const x=num('NUMBER_TO_CHECK');return {EVEN:x%2===0,ODD:Math.abs(x%2)===1,WHOLE:Number.isInteger(x),POSITIVE:x>0,NEGATIVE:x<0,DIVISIBLE_BY:num('DIVISOR')!==0&&x%num('DIVISOR')===0,PRIME:x>=2&&Number.isInteger(x)&&!Array.from({length:Math.max(0,Math.floor(Math.sqrt(x))-1)},(_,i)=>i+2).some(i=>x%i===0)}[f('PROPERTY')]}
    case 'math_constrain':return Math.min(num('HIGH'),Math.max(num('LOW'),num('VALUE')));
    case 'operator_map':{const range=num('FROM_HIGH')-num('FROM_LOW');return range?num('TO_LOW')+(num('VALUE')-num('FROM_LOW'))/range*(num('TO_HIGH')-num('TO_LOW')):num('TO_LOW')}
    case 'text_join':return Array.from({length:block.itemCount_},(_,i)=>String(v('ADD'+i)??'')).join('');
    case 'text_length':return Array.from(text('VALUE')).length;
    case 'operator_contains':return text('TEXT').includes(text('FIND'));
    case 'operator_prefix':return text('TEXT').startsWith(text('PREFIX'));
    case 'text_indexOf':return (f('END')==='FIRST'?text('VALUE').indexOf(text('FIND')):text('VALUE').lastIndexOf(text('FIND')))+1;
    case 'text_charAt':{const s=Array.from(text('VALUE'));const at={FIRST:0,LAST:s.length-1,FROM_START:num('AT')-1,FROM_END:s.length-num('AT'),RANDOM:Math.floor(Math.random()*s.length)}[f('WHERE')];return s[at]||''}
    case 'text_getSubstring':{const s=Array.from(text('STRING'));const index=(where,at)=>({FIRST:0,LAST:s.length-1,FROM_START:num(at)-1,FROM_END:s.length-num(at)})[where];return s.slice(index(f('WHERE1'),'AT1'),index(f('WHERE2'),'AT2')+1).join('')}
    case 'k10_environment':return f('SENSOR')==='fahrenheit'?sensorState.temp*1.8+32:sensorState[f('SENSOR')];
    case 'k10_light':return sensorState.light;
    case 'k10_acceleration':return f('AXIS')==='strength'?Math.hypot(sensorState.x,sensorState.y,sensorState.z):sensorState[f('AXIS')];
    case 'k10_button_state':return f('STATE')==='UP'?!buttonIsPressed(f('BUTTON')):buttonPressedForCondition(f('BUTTON'));
    case 'k10_posture':return sensorState.tilt===f('TILT');
    default:return undefined;
  }
}

let screenBuffer=null,screenLineWidth=1,screenFrameDeferred=false,pendingScreenFrame=null;
function getScreenBuffer() {
  if(!screenBuffer){screenBuffer=document.createElement('canvas');screenBuffer.width=240;screenBuffer.height=320;screenBuffer.getContext('2d').fillStyle='#ffffff';screenBuffer.getContext('2d').fillRect(0,0,240,320)}
  return screenBuffer;
}
function presentScreenBuffer() {
  if(screenFrameDeferred){
    pendingScreenFrame||=document.createElement('canvas');pendingScreenFrame.width=240;pendingScreenFrame.height=320;
    pendingScreenFrame.getContext('2d').drawImage(getScreenBuffer(),0,0);return;
  }
  pendingScreenFrame=null;publishScreenFrame(getScreenBuffer());
}
function flushScreenFrame(){
  if(!pendingScreenFrame)return;
  const frame=pendingScreenFrame;pendingScreenFrame=null;publishScreenFrame(frame);
}
function publishScreenFrame(frame){
  if(window.K10Vision?.publish(frame))return;
  const lcd=$('#lcdContent');if(!lcd)return;
  displayMode='canvas';
  let canvas=lcd.querySelector(':scope > .k10-canvas');
  if(!canvas){
    canvas=document.createElement('canvas');canvas.width=240;canvas.height=320;canvas.className='k10-canvas';
    lcd.replaceChildren(canvas);
  }
  canvas.getContext('2d').drawImage(frame,0,0);
}
function referenceExecute(block) {
  const f=name=>block.getFieldValue(name),v=name=>blockValue(block.getInputTargetBlock(name));
  const variable=f('VAR');
  if(['variables_set','typed_string_set','typed_list_set','math_change','typed_list_add','typed_list_remove','typed_list_clear','typed_list_insert','typed_list_replace'].includes(block.type)) {
    if(block.type==='math_change')runtimeVariables.set(variable,Number(runtimeVariables.get(variable)||0)+Number(v('DELTA')||0));
    else if(block.type==='typed_list_add'){const items=[...(runtimeVariables.get(variable)||[])];items.push(v('VALUE'));runtimeVariables.set(variable,items)}
    else if(block.type==='typed_list_remove'){const items=[...(runtimeVariables.get(variable)||[])];items.splice(Math.max(0,Number(v('INDEX'))-1),1);runtimeVariables.set(variable,items)}
    else if(block.type==='typed_list_clear')runtimeVariables.set(variable,[]);
    else if(block.type==='typed_list_insert'){const items=[...(runtimeVariables.get(variable)||[])];items.splice(Math.max(0,Number(v('INDEX'))-1),0,v('VALUE'));runtimeVariables.set(variable,items)}
    else if(block.type==='typed_list_replace'){const items=[...(runtimeVariables.get(variable)||[])];items[Math.max(0,Number(v('INDEX'))-1)]=v('VALUE');runtimeVariables.set(variable,items)}
    else runtimeVariables.set(variable,v('VALUE'));
    return true;
  }
  if(block.type==='rgb_pixel'){writeK10Rgb(f('LED'),f('COLOR'));return true}
  if(block.type==='rgb_brightness'){setK10RgbBrightness(f('VALUE'));return true}
  if(!referenceScreenTypes.includes(block.type)||block.type==='screen_clear')return false;
  const c=getScreenBuffer(),ctx=c.getContext('2d');
  const num=name=>Number(block.type.endsWith('_value')?v(name):f(name))||0;
  ctx.strokeStyle=f('COLOR')||'#000';ctx.fillStyle=f('COLOR')||'#000';ctx.lineWidth=screenLineWidth;
  if(block.type==='screen_update')presentScreenBuffer();
  if(block.type==='screen_clear_all'){ctx.clearRect(0,0,240,320);if(!window.K10Vision?.displaying()){ctx.fillStyle=c.background||'#fff';ctx.fillRect(0,0,240,320);}presentScreenBuffer()}
  if(block.type==='screen_clear_line'){if(window.K10Vision?.displaying())ctx.clearRect(0,(num('ROW')-1)*24,240,24);else{ctx.fillStyle=c.background||'#fff';ctx.fillRect(0,(num('ROW')-1)*24,240,24);}presentScreenBuffer()}
  if(block.type==='screen_width')screenLineWidth=num('WIDTH');
  if(block.type==='screen_point')ctx.fillRect(num('X'),num('Y'),1,1);
  if(['screen_line','screen_line_value'].includes(block.type)){ctx.beginPath();ctx.moveTo(num('X1'),num('Y1'));ctx.lineTo(num('X2'),num('Y2'));ctx.stroke()}
  if(['screen_rect','screen_circle','screen_rect_value','screen_circle_value'].includes(block.type)){ctx.beginPath();if(block.type.startsWith('screen_rect'))ctx.rect(num('X'),num('Y'),num('W'),num('H'));else ctx.arc(num('X'),num('Y'),Math.max(0,num('R')),0,Math.PI*2);if(f('FILL')==='YES'){ctx.fillStyle=f('FCOLOR');ctx.fill()}ctx.stroke()}
  if(['screen_text_line','screen_text_xy'].includes(block.type)) {
    const line=block.type==='screen_text_line',size=line?24:num('SIZE'),x=line?0:num('X'),y=line?(num('ROW')-1)*24:num('Y');
    if(line||f('CLEAR')==='YES'){ctx.fillStyle=c.background||'#fff';ctx.fillRect(x,y,240-x,320-y)}
    ctx.fillStyle=f('COLOR');ctx.font=`${size}px "Microsoft YaHei",sans-serif`;ctx.textBaseline='top';
    const chars=Array.from(String(v('TEXT'))),wrap=line?50:num('WRAP');let dx=x,dy=y,count=0;
    for(const ch of chars){if(ch==='\n'||(wrap<50&&count>=wrap)){dx=x;dy+=size;count=0;if(ch==='\n')continue}ctx.fillText(ch,dx,dy);dx+=ctx.measureText(ch).width;count++}
  }
  return true;
}

function defineReferenceGenerators() {
  const g=window.python.pythonGenerator,code=(b,name)=>g.valueToCode(b,name,g.ORDER_NONE)||'0';
  const f=(b,name)=>JSON.stringify(b.getFieldValue(name));
  for(const type of referenceScreenTypes.filter(t=>!['screen_clear','screen_text_xy','screen_text_line'].includes(t)))g.forBlock[type]=b=>`board.screen.${({screen_update:'update',screen_clear_all:'clear_all',screen_clear_line:'clear_line',screen_width:'width',screen_point:'point',screen_line:'line',screen_circle:'circle',screen_rect:'rectangle'})[type]}(${b.inputList.flatMap(i=>i.fieldRow).filter(field=>field.name).map(field=>`${field.name.toLowerCase()}=${JSON.stringify(field.getValue())}`).join(', ')})\n`;
  g.forBlock.screen_text_line=b=>`board.screen.cache_text(${code(b,'TEXT')}, row=${b.getFieldValue('ROW')}, color=${f(b,'COLOR')})\n`;
  g.forBlock.screen_text_xy=b=>`board.screen.cache_text(${code(b,'TEXT')}, x=${b.getFieldValue('X')}, y=${b.getFieldValue('Y')}, size=${b.getFieldValue('SIZE')}, color=${f(b,'COLOR')}, wrap=${b.getFieldValue('WRAP')}, auto_clear=${b.getFieldValue('CLEAR')==='YES'?'True':'False'})\n`;
  for(const [type,method,keys] of [['screen_line_value','line',['X1','Y1','X2','Y2']],['screen_rect_value','rectangle',['X','Y','W','H']],['screen_circle_value','circle',['X','Y','R']]])g.forBlock[type]=b=>`board.screen.${method}(${keys.map(key=>`${key.toLowerCase()}=${code(b,key)}`).join(', ')}, color=${f(b,'COLOR')}${type==='screen_line_value'?'':`, fill=${b.getFieldValue('FILL')==='YES'?'True':'False'}, fill_color=${f(b,'FCOLOR')}`})\n`;
  g.forBlock.operator_map=b=>[`(${code(b,'VALUE')} - ${code(b,'FROM_LOW')}) / (${code(b,'FROM_HIGH')} - ${code(b,'FROM_LOW')}) * (${code(b,'TO_HIGH')} - ${code(b,'TO_LOW')}) + ${code(b,'TO_LOW')}`,g.ORDER_ADDITIVE];
  g.forBlock.operator_contains=b=>[`${code(b,'FIND')} in str(${code(b,'TEXT')})`,g.ORDER_RELATIONAL];
  g.forBlock.operator_prefix=b=>[`str(${code(b,'TEXT')}).startswith(str(${code(b,'PREFIX')}))`,g.ORDER_FUNCTION_CALL];
  const name=b=>g.getVariableName(b.getFieldValue('VAR'));
  for(const kind of ['string','list']){g.forBlock['typed_'+kind+'_get']=b=>[name(b),g.ORDER_ATOMIC];g.forBlock['typed_'+kind+'_set']=b=>`${name(b)} = ${code(b,'VALUE')}\n`}
  g.forBlock.typed_list_add=b=>`${name(b)}.append(${code(b,'VALUE')})\n`;
  g.forBlock.typed_list_remove=b=>`del ${name(b)}[${code(b,'INDEX')} - 1]\n`;
  g.forBlock.typed_list_clear=b=>`${name(b)}.clear()\n`;
  g.forBlock.typed_list_insert=b=>`${name(b)}.insert(${code(b,'INDEX')} - 1, ${code(b,'VALUE')})\n`;
  g.forBlock.typed_list_replace=b=>`${name(b)}[${code(b,'INDEX')} - 1] = ${code(b,'VALUE')}\n`;
  g.forBlock.typed_list_item=b=>[`${name(b)}[${code(b,'INDEX')} - 1]`,g.ORDER_MEMBER];
  g.forBlock.typed_list_index=b=>{const list=name(b),value=code(b,'VALUE');return [`(${list}.index(${value}) + 1 if ${value} in ${list} else 0)`,g.ORDER_ATOMIC]};
  g.forBlock.typed_list_length=b=>[`len(${name(b)})`,g.ORDER_FUNCTION_CALL];
  g.forBlock.typed_list_contains=b=>[`${code(b,'VALUE')} in ${name(b)}`,g.ORDER_RELATIONAL];
  for(const type of ['k10_environment','k10_acceleration','k10_posture'])g.forBlock[type]=b=>[`board.${type.replace('k10_','')}(${f(b,({k10_environment:'SENSOR',k10_acceleration:'AXIS',k10_posture:'TILT'})[type])})`,g.ORDER_FUNCTION_CALL];
  g.forBlock.k10_light=()=>['board.environment("light")',g.ORDER_FUNCTION_CALL];
  g.forBlock.k10_button_state=b=>[`board.button_state(${f(b,'BUTTON')}, ${f(b,'STATE')})`,g.ORDER_FUNCTION_CALL];
  g.forBlock.rgb_pixel=b=>`board.rgb.set(${f(b,'LED')}, ${f(b,'COLOR')})\n`;
  g.forBlock.rgb_brightness=b=>`board.rgb.brightness(${b.getFieldValue('VALUE')})\n`;
}

