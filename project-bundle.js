const boardlabBundleLimits={input:64*1024*1024,total:128*1024*1024,member:32*1024*1024};
let projectName=localStorage.getItem('boardlab-project-name')||'我的程序',projectWorkspaces={};
function projectBytesToBase64(bytes){let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(text);}
function projectBase64ToBytes(text){const value=atob(text);return Uint8Array.from(value,char=>char.charCodeAt(0));}
async function mapWorkspaceImages(workspace,transform){
  const walk=async(b,depth=0)=>{
    if(depth>100)throw new Error('积木嵌套过深');
    if(b.type==='screen_image'&&b.data){const data=JSON.parse(b.data);if(data.localImage?.src)data.localImage.src=await transform(data.localImage.src);b.data=JSON.stringify(data);}
    if(['m10_image','m10_set_image'].includes(b.type)&&b.extraState?.src)b.extraState.src=await transform(b.extraState.src);
    for(const input of Object.values(b.inputs||{})){if(input.block)await walk(input.block,depth+1);if(input.shadow)await walk(input.shadow,depth+1);}
    if(b.next?.block)await walk(b.next.block,depth+1);
  };
  for(const block of workspace.blocks?.blocks||[])await walk(block);
}
async function buildBoardlabBundle(project){
  const manifest=JSON.parse(JSON.stringify({...project,resources:undefined})),assets={},metadata={},sourceResources=project.resources||[];
  let total=0;
  const add=async(bytes,mime)=>{
    if(bytes.length>boardlabBundleLimits.member)throw new Error('单个资源超过 32 MB');
    const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
    const hash=Array.from(digest,n=>n.toString(16).padStart(2,'0')).join(''),name='assets/'+hash+'.bin';
    if(!assets[name]){total+=bytes.length;if(total>boardlabBundleLimits.total)throw new Error('工程资源超过 128 MB');assets[name]=bytes;}
    metadata[name]||={mime};return name;
  };
  for(const workspace of Object.values(manifest.workspaces))await mapWorkspaceImages(workspace,async src=>{
    const match=/^data:(image\/(?:png|jpeg|webp|gif|bmp));base64,([\s\S]+)$/i.exec(src);
    if(!match)throw new Error('图片需要嵌入工程');
    return 'boardlab-asset:'+await add(projectBase64ToBytes(match[2]),match[1]);
  });
  manifest.resources=[];
  for(const file of sourceResources){const asset=await add(file.bytes,file.mime||'application/octet-stream');manifest.resources.push({name:file.name,mime:file.mime||'application/octet-stream',asset});}
  manifest.assets=metadata;
  const json=new TextEncoder().encode(JSON.stringify(manifest));if(json.length>boardlabBundleLimits.member)throw new Error('工程积木数据过大');
  const zipped=fflate.zipSync({'project.json':json,...assets},{level:6});
  if(zipped.length>boardlabBundleLimits.input)throw new Error('压缩后的工程超过 64 MB');
  return new Blob([zipped],{type:'application/zip'});
}
async function decodeBoardlabBundle(bytes){
  const files=readProjectZip(bytes,{all:true,maxInput:boardlabBundleLimits.input,maxTotal:boardlabBundleLimits.total});
  const project=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(files['project.json']));
  if(project.format!=='boardlab'||project.version!==2||!project.workspaces||!project.workspaces[project.board])throw new Error('完整工程版本或工作区不完整');
  const verified=new Set();
  const asset=async name=>{
    if(!/^assets\/[a-f0-9]{64}\.bin$/.test(name)||!Object.hasOwn(project.assets||{},name)||!files[name])throw new Error('工程缺少资源：'+name);
    if(!verified.has(name)){const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',files[name]));if('assets/'+Array.from(hash,n=>n.toString(16).padStart(2,'0')).join('')+'.bin'!==name)throw new Error('资源内容与校验信息不符');verified.add(name);}
    return files[name];
  };
  for(const [board,workspace] of Object.entries(project.workspaces)){
    if(!['k10','m10'].includes(board))throw new Error('工程包含不支持的主板');
    await mapWorkspaceImages(workspace,async src=>{
      if(!src.startsWith('boardlab-asset:'))throw new Error('工程图片引用不完整');
      const name=src.slice('boardlab-asset:'.length),data=await asset(name),mime=project.assets[name].mime;
      if(!/^image\/(png|jpeg|webp|gif|bmp)$/i.test(mime))throw new Error('图片资源格式不受支持');
      return 'data:'+mime+';base64,'+projectBytesToBase64(data);
    });
  }
  if(!Array.isArray(project.resources))throw new Error('工程资源清单不完整');
  const names=new Set();
  for(const resource of project.resources){
    if(typeof resource.name!=='string'||!resource.name||resource.name.length>255||names.has(resource.name)||!/^image\/|^audio\//.test(resource.mime))throw new Error('虚拟 TF 卡文件信息不正确');
    names.add(resource.name);resource.bytes=await asset(resource.asset);
  }
  return project;
}
async function captureCompleteProject(){
  const workspaces={};
  for(const board of ['k10','m10']){
    const saved=board===currentBoard?Blockly.serialization.workspaces.save(blocklyWorkspace):projectWorkspaces[board]||JSON.parse(localStorage.getItem('boardlab-workspace-'+board)||'null');
    if(saved)workspaces[board]=saved;
  }
  const resources=[];
  for(const [name,item] of virtualState.files){
    let blob;
    if(item.url?.startsWith('blob:'))blob=await (await fetch(item.url)).blob();
    else if(item.image){const canvas=document.createElement('canvas');canvas.width=item.image.width;canvas.height=item.image.height;canvas.getContext('2d').drawImage(item.image,0,0);blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));}
    if(!blob)throw new Error('无法保存虚拟 TF 卡文件：'+name);
    resources.push({name,mime:blob.type||'application/octet-stream',bytes:new Uint8Array(await blob.arrayBuffer())});
  }
  const {files,...virtualInputs}=virtualState;
  return {format:'boardlab',version:2,name:projectName,savedAt:Date.now(),board:currentBoard,workspaces,
    settings:{modules:[...selectedModules],keys:{...keyMap},speed:Number($('#speed').value),sensors:{...sensorState},m10Sensors:{...m10Sensors},virtualInputs:JSON.parse(JSON.stringify(virtualInputs)),learnedFaces:[...learnedK10Faces]},resources};
}
async function prepareProjectResources(project){
  const resources=new Map();
  try {
    for(const file of project.resources||[]){
      const url=URL.createObjectURL(new Blob([file.bytes],{type:file.mime})),item={url};resources.set(file.name,item);
      if(file.mime.startsWith('image/')){item.image=new Image();item.image.src=url;await item.image.decode();}
    }
  }catch(error){for(const item of resources.values())URL.revokeObjectURL(item.url);throw new Error('工程中的图片无法读取：'+error.message);}
  return resources;
}
function projectBackupStore(action,value,key='previous'){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open('boardlab-project-recovery',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('snapshots');
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>{
      const db=request.result,transaction=db.transaction('snapshots',action==='put'?'readwrite':'readonly'),store=transaction.objectStore('snapshots');
      const operation=action==='put'?store.put(value,key):store.get(key);let result;
      operation.onsuccess=()=>{result=operation.result};transaction.oncomplete=()=>{db.close();resolve(result)};transaction.onabort=()=>{db.close();reject(transaction.error)};transaction.onerror=()=>{};
    };
  });
}
function validateCompleteProject(project){
  if(project.version!==2||project.format!=='boardlab'||!project.workspaces?.[project.board])throw new Error('工程结构不完整');
  const issues=[];
  for(const [board,workspace] of Object.entries(project.workspaces)){if(!['k10','m10'].includes(board))throw new Error('工程包含未知主板');issues.push(...validateProjectDocument({board,workspace}));}
  const settings=project.settings||{};
  if(settings.modules&&!Array.isArray(settings.modules))issues.push('扩展配置不正确');
  if(settings.keys&&(typeof settings.keys.A!=='string'||typeof settings.keys.B!=='string'||settings.keys.A===settings.keys.B||!settings.keys.A||!settings.keys.B||settings.keys.A.length>40||settings.keys.B.length>40))issues.push('按键映射不正确');
  for(const data of [settings.sensors,settings.m10Sensors])if(data)for(const value of Object.values(data))if(typeof value!=='string'&&!Number.isFinite(value))issues.push('虚拟环境数值不正确');
  if(settings.speed&&!['1','2','4'].includes(String(settings.speed)))issues.push('运行速度不正确');
  return [...new Set(issues)];
}
function updateProjectName(name){
  projectName=String(name||'我的程序').trim().slice(0,64)||'我的程序';
  $('#projectNameInput').value=projectName;$('.workspace-name').textContent=projectName;
  try{localStorage.setItem('boardlab-project-name',projectName)}catch{}
}
function syncProjectEnvironment(){
  document.querySelectorAll('[data-virtual]').forEach(el=>{const value=virtualState[el.dataset.virtual];if(el.type==='checkbox')el.checked=!!value;else el.value=value;});
  document.querySelectorAll('[data-pin]').forEach(el=>{el.value=virtualState.pins[el.dataset.pin][el.dataset.value];});
  $('#virtualFileList').textContent=[...virtualState.files.keys()].join(' · ')||'尚未加载文件';
}
