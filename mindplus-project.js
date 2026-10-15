// Mind+ 1.8 upload-page block records, checked against downloaded DFRobot projects.
// Only explicitly mapped blocks convert; an unsupported record blocks application/export.
const mpK10Prefix='esp32s3bit.esp32s3bit_';
const mpBlankSvg='<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360"><path fill="#fff" d="M0 0h480v360H0z"/></svg>';
const mpBlankAsset='3ab5adf30df30968a2c034f3d81a05cd.svg';
const mpRule=(type,op,fields={},inputs={},extra={})=>({type,op,fields,inputs,...extra});
const mpFixed=(name,kind='number',menu=null,values=null)=>({name,kind,menu,values});
const mpField=(name,values=null)=>({name,kind:'field',values});
const mpSub=name=>({name,kind:'statement'});
const mpRules=[
  mpRule('board_start',mpK10Prefix+'functions'),
  mpRule('procedures_defnoreturn','procedures_definition',{},{},{procedure:'definition'}),
  mpRule('procedures_callnoreturn','procedures_call',{},{},{procedure:'call'}),
  mpRule('board_forever','control_loop',{}, {DO:mpSub('SUBSTACK')}),
  mpRule('board_repeat','control_repeat',{COUNT:mpFixed('TIMES')},{DO:mpSub('SUBSTACK')}),
  mpRule('board_wait','control_wait',{SECONDS:mpFixed('DURATION')}),
  mpRule('control_wait_until','control_wait_until',{}, {CHECK:'CONDITION'}),
  mpRule('control_repeat_until','control_repeat_until',{}, {CHECK:'CONDITION',DO:mpSub('SUBSTACK')}),
  mpRule('control_if','control_if',{}, {CHECK:'CONDITION',DO:mpSub('SUBSTACK')}),
  mpRule('control_if_else','control_if_else',{}, {CHECK:'CONDITION',DO:mpSub('SUBSTACK'),ELSE:mpSub('SUBSTACK2')}),
  mpRule('screen_update',mpK10Prefix+'canvasDisplayUpdate'),
  mpRule('screen_clear_all',mpK10Prefix+'canvasDisplayClearAll'),
  mpRule('screen_orientation',mpK10Prefix+'initScreen',{DIRECTION:mpField('DIRECTION')}),
  mpRule('screen_clear',mpK10Prefix+'setScreenBackground',{COLOR:mpFixed('BACKGROUND','colour')}),
  mpRule('screen_text_line',mpK10Prefix+'canvasDisplayTextInLine',{ROW:mpFixed('LINE','menu','canvasLineMenu'),COLOR:mpFixed('COLOR','colour')},{TEXT:'TEXT'}),
  mpRule('screen_clear_line',mpK10Prefix+'canvasDisplayClearInLine',{ROW:mpFixed('LINE','menu','canvasLineMenu')}),
  mpRule('screen_image',mpK10Prefix+'canvasLocalPicture',{X:mpFixed('X'),Y:mpFixed('Y')},{},{image:true}),
  mpRule('k10_button_state',mpK10Prefix+'isButtonPressed',{BUTTON:mpField('BTNNUMBER'),STATE:mpField('BUTTONSTATE',{Pressed:'DOWN',Released:'UP'})}),
  mpRule('k10_light',mpK10Prefix+'readAlsOrUvs',{},{},{constantFields:{INTENSITY:'Ambient light intensity'}}),
  mpRule('k10_environment',mpK10Prefix+'readAHT20',{SENSOR:mpField('DATATYPE',{eAHT20TempC:'temp',eAHT20TempF:'fahrenheit',eAHT20Humi:'humidity'})}),
  mpRule('k10_acceleration',mpK10Prefix+'acceleration',{AXIS:mpField('TYPE',{x:'x',y:'y',z:'z',strength:'strength'})}),
  mpRule('rgb_off',mpK10Prefix+'rgbDisable',{LED:mpField('INDEX')}),
  mpRule('rgb_pixel',mpK10Prefix+'setLightsColor',{LED:mpFixed('LIGHTS','menu','lightsMenu',{ALL:'all','0':'0','1':'1','2':'2'}),COLOR:mpFixed('COLOR','colour')}),
  mpRule('rgb_brightness',mpK10Prefix+'setBrightness',{VALUE:mpFixed('BRIGHTVALUE','menu','brightnessMenu')}),
  mpRule('speech_speed',mpK10Prefix+'setSpeechSynthesisPace',{VALUE:mpFixed('PACE')}),
  mpRule('speak_text',mpK10Prefix+'speechSynthesis',{}, {TEXT:'PROMPT'}),
  mpRule('logic_compare','operator_equals',{OP:mpField('unused')},{A:'OPERAND1',B:'OPERAND2'},{compare:true}),
  mpRule('math_arithmetic','operator_add',{},{A:'NUM1',B:'NUM2'},{arithmetic:true}),
  mpRule('logic_operation','operator_and',{},{A:'OPERAND1',B:'OPERAND2'},{logic:true}),
  mpRule('logic_negate','operator_not',{}, {BOOL:'OPERAND'}),
  mpRule('math_random_int','operator_random',{}, {FROM:'FROM',TO:'TO'}),
  mpRule('text_join','operator_join',{}, {ADD0:'STRING1',ADD1:'STRING2'},{extraState:{itemCount:2}}),
  mpRule('text_length','operator_length',{}, {VALUE:'STRING'}),
  mpRule('text_charAt','operator_letter_of',{}, {VALUE:'STRING',AT:'LETTER'},{extraState:{isAt:true},nativeFields:{WHERE:'FROM_START'}}),
  mpRule('variables_set','data_setvariableto',{}, {VALUE:'VALUE'},{variable:true}),
  mpRule('math_change','data_changevariableby',{}, {DELTA:'VALUE'},{variable:true})
];
// Additional opcodes share the exact operand layout in the Mind+ 1.8 records.
for(const [op,value] of [['operator_lt','LT'],['operator_gt','GT']])mpRules.push({...mpRules.find(r=>r.compare),op,operator:value});
for(const [op,value] of [['operator_subtract','MINUS'],['operator_multiply','MULTIPLY'],['operator_divide','DIVIDE'],['operator_mod','MODULO']]){
  if(value!=='MODULO')mpRules.push({...mpRules.find(r=>r.arithmetic),op,operator:value});
}
mpRules.push({...mpRules.find(r=>r.logic),op:'operator_or',operator:'OR'});
mpRules.push(mpRule('rgb_set',mpK10Prefix+'setLightsColor',{COLOR:mpFixed('COLOR','colour')},{},{constantInputs:{LIGHTS:{menu:'lightsMenu',value:'ALL'}}}));

function readProjectZip(bytes,{all=false,maxInput=32*1024*1024,maxTotal=64*1024*1024}={}) {
  if(bytes.length>maxInput)throw new Error('工程文件超过大小限制');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let end=-1;
  for(let p=bytes.length-22;p>=Math.max(0,bytes.length-65557);p--)if(view.getUint32(p,true)===0x06054b50&&p+22+view.getUint16(p+20,true)===bytes.length){end=p;break;}
  if(end<0)throw new Error('不是完整的 Mind+ ZIP 工程');
  const count=view.getUint16(end+10,true),offset=view.getUint32(end+16,true);let p=offset,total=0;const entries=new Map();
  if(count>3000||view.getUint16(end+4,true)||view.getUint16(end+6,true))throw new Error('工程归档格式不受支持');
  for(let i=0;i<count;i++){
    if(p+46>end||view.getUint32(p,true)!==0x02014b50)throw new Error('工程归档目录损坏');
    const size=view.getUint32(p+24,true),n=view.getUint16(p+28,true),extra=view.getUint16(p+30,true),comment=view.getUint16(p+32,true);
    const name=new TextDecoder().decode(bytes.subarray(p+46,p+46+n));
    if(view.getUint16(p+8,true)&1||size===0xffffffff||name.split(/[\\/]/).some(part=>part==='..'||part==='__proto__')||/^[\\/]|^[a-z]:/i.test(name))throw new Error('工程归档包含不支持的条目');
    total+=size;if(total>maxTotal||size>32*1024*1024)throw new Error('工程解压大小超过限制');
    if(entries.has(name))throw new Error('工程包含重复的条目');entries.set(name,{crc:view.getUint32(p+16,true),size});
    p+=46+n+extra+comment;
  }
  if(!entries.has('project.json'))throw new Error('工程缺少 project.json');
  const files=fflate.unzipSync(bytes,{filter:file=>all||file.name==='project.json'});
  const table=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0});
  for(const [name,raw] of Object.entries(files)){
    let crc=0xffffffff;for(const byte of raw)crc=table[(crc^byte)&255]^(crc>>>8);
    const entry=entries.get(name);if(raw.length!==entry?.size||((crc^0xffffffff)>>>0)!==entry.crc)throw new Error(name+' 校验失败，文件可能损坏');
  }
  return files;
}
function mpDecodeProject(bytes) {
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(readProjectZip(bytes)['project.json']));
}
function mpToWorkspace(project) {
  const issues=[],variables=new Map(),used=new Set();
  const page=project.page1;
  if(!page?.targets||!page.extensions?.includes('esp32s3bit'))return {issues:['目前支持 Mind+ 1.8.x 的 K10 上传模式工程。实时模式、Python 模式和其它主板还未适配。']};
  if(project.pageIndex!==1||page.pageInfo?.codeLanguage!=='cpp')return {issues:['请在 Mind+ 切换到 K10 上传模式（Arduino C），保存为 .mp 后再打开。']};
  if(page.pageInfo?.writeCode)return {issues:['该工程含手动代码，不能准确转换为积木。请保留原工程。']};
  const result=[];let visited=0;
  for(const target of page.targets){
    const blocks=target.blocks||{};
    const register=(id,name)=>{id=String(id);if(!variables.has(id))variables.set(id,{id,name:String(name),type:''});return id;};
    for(const [id,value] of Object.entries(target.variables||{})){register(id,value[0]);if(value[1]!==0&&value[1]!==''&&value[1]!==false)issues.push('变量 '+value[0]+' 含工程初值，请用赋值积木初始化后再转换');}
    const field=(b,name)=>b.fields?.[name]?.[0];
    const input=(b,name)=>b.inputs?.[name]?.[1];
    const literal=(value)=>{
      if(Array.isArray(value)){if(value[0]>=12)throw new Error('固定字段连接了变量，暂不能准确转换');return value[1];}
      const b=blocks[value];
      if(!b)throw new Error('缺少输入值');
      if(b.opcode==='colour_palette')return field(b,'COLOUR');
      if(b.shadow||['math_range','math_number','string','text'].includes(b.opcode))return Object.values(b.fields||{})[0]?.[0];
      throw new Error('固定字段连接了表达式，暂不能准确转换');
    };
    const make=(value,depth=0)=>{
      if(depth>100||++visited>10000)throw new Error('工程积木过多或连接成环');
      if(Array.isArray(value)){
        if(value[0]===12)return {type:'variables_get',fields:{VAR:{id:register(value[2],value[1])}}};
        return {type:value[0]===10?'text':'math_number',fields:value[0]===10?{TEXT:String(value[1])}:{NUM:Number(value[1])||0}};
      }
      if(!value)return null;
      if(used.has(value))throw new Error('积木连接重复或成环');used.add(value);
      const b=blocks[value];if(!b)throw new Error('工程引用了缺失的积木');
      const rule=mpRules.find(r=>r.op===b.opcode);
      if(!rule){issues.push('尚未适配：'+b.opcode);return null;}
      const out={type:rule.type,id:value,fields:{},inputs:{}};
      if(rule.procedure){
        const prototype=rule.procedure==='definition'?blocks[input(b,'custom_block')]:b;
        const mutation=prototype?.mutation;
        if(!mutation?.proccode||JSON.parse(mutation.argumentids||'[]').length||/%[nsb]/.test(mutation.proccode))throw new Error('带输入参数的自定义模块尚未适配');
        if(rule.procedure==='definition'){
          out.fields.NAME=mutation.proccode;
          const body=make(b.next,depth+1);if(body)out.inputs.STACK={block:body};
        }else out.extraState={name:mutation.proccode,params:[]};
        if(b.topLevel){out.x=Number(b.x)||220;out.y=Number(b.y)||60;}
        if(rule.procedure==='definition')return out;
      }
      if(rule.extraState)out.extraState={...rule.extraState};
      if(rule.nativeFields)Object.assign(out.fields,rule.nativeFields);
      if(rule.compare)out.fields.OP=rule.operator||'EQ';
      if(rule.arithmetic)out.fields.OP=rule.operator||'ADD';
      if(rule.logic)out.fields.OP=rule.operator||'AND';
      for(const [name,spec] of Object.entries(rule.fields)){
        if(rule.compare)continue;
        const raw=spec.kind==='field'?field(b,spec.name):literal(input(b,spec.name));
        if(raw===undefined)throw new Error('缺少字段 '+spec.name);
        if(spec.values&&!Object.hasOwn(spec.values,raw))throw new Error('尚未适配字段值 '+spec.name+'='+raw);
        out.fields[name]=spec.values?spec.values[raw]:spec.kind==='number'?Number(raw):String(raw);
      }
      for(const [name,wanted] of Object.entries(rule.constantFields||{}))if(field(b,name)!==wanted)throw new Error('尚未适配字段值 '+name+'='+field(b,name));
      if(rule.variable)out.fields.VAR={id:register(b.fields.VARIABLE[1],field(b,'VARIABLE'))};
      for(const [name,spec] of Object.entries(rule.inputs)){
        const child=make(input(b,typeof spec==='string'?spec:spec.name),depth+1);
        if(child)out.inputs[name]={block:child};
      }
      if(rule.image){
        const imageBlock=blocks[input(b,'IAMGE')],settings=JSON.parse(field(imageBlock,'bit_image'));
        if(settings.fileData&&!/^data:image\/(png|jpeg|webp|gif|bmp);base64,/i.test(settings.fileData))throw new Error('图片格式暂不能转换');
        out.data=JSON.stringify({localImage:{src:settings.fileData||'',name:String(settings.filePath||'image.png').split(/[\\/]/).pop(),width:Number(settings.imgWidth),height:Number(settings.imgHeight)}});
      }
      if(b.topLevel){out.x=Number(b.x)||220;out.y=Number(b.y)||60;}
      const next=make(b.next,depth+1);if(next)out.next={block:next};
      return out;
    };
    for(const [id,b] of Object.entries(blocks))if(b.topLevel&&!b.shadow){try{const out=make(id);if(out)result.push(out);}catch(error){issues.push(b.opcode+'：'+error.message);}}
    // Report unsupported descendants even when an unsupported parent prevented traversal.
    for(const b of Object.values(blocks))if(!b.shadow&&!mpRules.some(r=>r.op===b.opcode)&&!['esp32_s3_image_settings','procedures_prototype'].includes(b.opcode))issues.push('尚未适配：'+b.opcode);
  }
  const workspace={blocks:{languageVersion:0,blocks:result},variables:[...variables.values()]};
  return {board:'k10',workspace,issues:[...new Set(issues)],count:visited};
}
function workspaceToMp(workspace) {
  const blocks={},issues=[];let serial=0;
  const id=()=>`boardlab_${++serial}`;
  const menus=(opcode,fields,parent)=>{const key=id();blocks[key]={opcode,next:null,parent,inputs:{},fields,shadow:true,topLevel:false};return key;};
  const make=(b,parent=null)=>{
    const key=id();
    if(b.type==='text')return [10,String(b.fields?.TEXT||'')];
    if(b.type==='math_number')return [4,String(b.fields?.NUM??0)];
    if(b.type==='variables_get'){const variable=workspace.variables?.find(v=>v.id===b.fields.VAR.id);return [12,variable?.name||b.fields.VAR.id,b.fields.VAR.id];}
    const candidates=mpRules.filter(r=>r.type===b.type);
    let rule=candidates.find(r=>r.operator===b.fields?.OP)||candidates[0];
    if(!rule){issues.push('尚未适配：'+b.type);return null;}
    if(rule.compare&&!['EQ','LT','GT'].includes(b.fields?.OP)){issues.push('比较方式尚未适配：'+b.fields?.OP);return null;}
    if(rule.arithmetic&&!['ADD','MINUS','MULTIPLY','DIVIDE'].includes(b.fields?.OP)){issues.push('运算方式尚未适配：'+b.fields?.OP);return null;}
    if(b.type==='text_join'&&b.extraState?.itemCount!==2){issues.push('Mind+ 合并文本仅支持两个输入');return null;}
    if(rule.nativeFields&&Object.entries(rule.nativeFields).some(([name,value])=>b.fields?.[name]!==value)){issues.push('字段尚未适配：'+b.type);return null;}
    const out={opcode:rule.op,next:null,parent,inputs:{},fields:{},shadow:false,topLevel:!parent};blocks[key]=out;
    if(rule.procedure){
      if(b.extraState?.params?.length){issues.push('带输入参数的自定义模块尚未适配');return key;}
      const name=rule.procedure==='definition'?b.fields?.NAME:b.extraState?.name;
      const mutation={tagName:'mutation',children:[],proccode:name,argumentids:'[]',argumentnames:'[]',argumentdefaults:'[]',warp:'false'};
      if(rule.procedure==='definition'){
        const proto=menus('procedures_prototype',{},key);blocks[proto].mutation=mutation;out.inputs.custom_block=[1,proto];
        if(b.inputs?.STACK?.block)out.next=make(b.inputs.STACK.block,key);
      }else out.mutation=mutation;
    }
    if(!parent){out.x=b.x||220;out.y=b.y||60;out.position={x:out.x,y:out.y};}
    for(const [name,spec] of Object.entries(rule.fields)){
      if(rule.compare)continue;
      let value=b.fields?.[name];
      if(spec.values){const entry=Object.entries(spec.values).find(([,v])=>String(v)===String(value));if(!entry){issues.push('字段尚未适配：'+b.type+'.'+name);continue;}value=entry[0];}
      if(spec.kind==='field')out.fields[spec.name]=[String(value),null];
      else if(spec.kind==='colour')out.inputs[spec.name]=[1,menus('colour_palette',{COLOUR:[value,null]},key)];
      else if(spec.menu)out.inputs[spec.name]=[1,menus('esp32s3bit.menu.'+spec.menu,{[spec.menu]:[String(value),null]},key)];
      else out.inputs[spec.name]=[1,[4,String(value)]];
    }
    for(const [name,value] of Object.entries(rule.constantFields||{}))out.fields[name]=[value,null];
    for(const [name,spec] of Object.entries(rule.constantInputs||{}))out.inputs[name]=[1,menus('esp32s3bit.menu.'+spec.menu,{[spec.menu]:[spec.value,null]},key)];
    if(rule.variable){const variable=workspace.variables?.find(v=>v.id===b.fields.VAR.id);out.fields.VARIABLE=[variable?.name||b.fields.VAR.id,b.fields.VAR.id];}
    for(const [name,spec] of Object.entries(rule.inputs)){
      const child=b.inputs?.[name]?.block||b.inputs?.[name]?.shadow;if(!child)continue;
      const converted=make(child,key);if(converted)out.inputs[typeof spec==='string'?spec:spec.name]=[typeof spec==='object'?2:Array.isArray(converted)?1:2,converted];
    }
    if(rule.image){
      const settings=JSON.parse(b.data||'{}').localImage;
      if(!settings?.src){issues.push('本地图片尚未选择');}
      else out.inputs.IAMGE=[1,menus('esp32_s3_image_settings',{bit_image:[JSON.stringify({fileData:settings.src,filePath:settings.name,imgWidth:String(settings.width),imgHeight:String(settings.height)}),null]},key)];
    }
    if(b.next?.block)out.next=make(b.next.block,key);
    return key;
  };
  for(const b of workspace.blocks?.blocks||[])make(b);
  const target={isStage:false,name:'Mind+',variables:Object.fromEntries((workspace.variables||[]).map(v=>[v.id,[v.name,0]])),lists:{},strings:{},mcvariables:{},broadcasts:{},blocks,comments:{},costumes:[],sounds:[],currentCostume:0,volume:100,layerOrder:1,visible:true,x:0,y:0,size:100,direction:90,draggable:false,rotationStyle:'all around'};
  const stage={...target,isStage:true,name:'Stage',blocks:{},variables:{},layerOrder:0};
  const costume={assetId:mpBlankAsset.slice(0,-4),name:'backdrop1',bitmapResolution:1,md5ext:mpBlankAsset,dataFormat:'svg',rotationCenterX:240,rotationCenterY:180};
  target.costumes=[{...costume,name:'Mind+'}];stage.costumes=[costume];
  const meta={semver:'3.0.0',vm:'0.1.0',agent:'BoardLab Mind+ 1.8 K10 converter'};
  const empty={targets:[stage,{...target,blocks:{},variables:{}}],meta};
  return {issues:[...new Set(issues)],project:{page0:empty,page1:{targets:[stage,target],monitors:[],thirdExtensions:[],extensions:['esp32s3bit'],version:'1.8.1',versionTimestamp:Date.now(),meta,pageInfo:{page:1,codeLanguage:'cpp',writeCode:''}},page2:empty,pageIndex:1}};
}
