let pendingProjectDocument=null,projectBackupAvailable=!!localStorage.getItem('boardlab-project-backup');
function boardlabProjectDocument() {
  return {format:'boardlab',version:1,board:currentBoard,workspace:Blockly.serialization.workspaces.save(blocklyWorkspace),settings:{modules:[...selectedModules],keys:{...keyMap}}};
}
function validateProjectDocument(project) {
  const issues=[];
  if(!['k10','m10'].includes(project.board)||!project.workspace?.blocks)throw new Error('工程主板或积木数据不完整');
  let count=0;
  const inspect=(node,depth=0)=>{
    if(depth>150||++count>100000)throw new Error('工程数据过大或嵌套过深');
    if(node&&typeof node==='object')for(const [key,value] of Object.entries(node)){
      if(['__proto__','prototype','constructor'].includes(key))throw new Error('工程包含不支持的数据键');inspect(value,depth+1);
    }
  };inspect(project.workspace);
  const expected=new Map();
  const walk=(b,depth=0)=>{
    if(depth>100)throw new Error('积木嵌套过深');
    if(!Blockly.Blocks[b.type])issues.push('尚未适配：'+b.type);
    if(project.board==='k10'&&b.type.startsWith('m10_')||project.board==='m10'&&b.type==='board_start')issues.push('工程混入了其它主板的积木：'+b.type);
    if(b.id)expected.set(b.id,b.fields||{});
    for(const image of [b.extraState,b.type==='screen_image'?JSON.parse(b.data||'{}').localImage:null])if(image?.src){
      if(!/^data:image\/(png|jpeg|webp|gif|bmp);base64,/i.test(image.src))issues.push('本地图片需要嵌入工程，暂不支持外部地址');
      if(!Number.isFinite(Number(image.width))||!Number.isFinite(Number(image.height))||image.width<1||image.height<1||image.width>240||image.height>320)issues.push('图片尺寸需要在 240×320 范围内');
    }
    Object.values(b.inputs||{}).forEach(input=>{if(input.block)walk(input.block,depth+1);else if(input.shadow)walk(input.shadow,depth+1)});
    if(b.next?.block)walk(b.next.block,depth+1);
  };
  for(const block of project.workspace.blocks.blocks||[])walk(block);
  if(!issues.length){
    const workspace=new Blockly.Workspace();
    try {
      Blockly.serialization.workspaces.load(project.workspace,workspace);
      for(const [id,fields] of expected){const block=workspace.getBlockById(id);for(const [name,value] of Object.entries(fields)){
        const wanted=typeof value==='object'?value.id:value;
        if(String(block?.getFieldValue(name)).toLowerCase()!==String(wanted).toLowerCase())issues.push(`${block?.type||id}.${name} 的值无法准确转换：${wanted}`);
      }}
    } finally {workspace.dispose();}
  }
  return [...new Set(issues)];
}
function showProjectCheck(title,summary,issues=[],document=null) {
  pendingProjectDocument=document;
  $('#projectDialogTitle').textContent=title;$('#projectSummary').textContent=summary;
  const list=$('#projectIssues');list.replaceChildren();
  for(const issue of issues){const item=documentCreate('li');item.textContent=issue;list.append(item);}
  $('#applyProjectBtn').hidden=!document||!!issues.length;$('#projectReplaceNote').hidden=!document||!!issues.length;
  $('#recoverProjectBtn').hidden=!projectBackupAvailable;
  $('#projectDialog').showModal();
}
function documentCreate(tag){return document.createElement(tag)}
function downloadProjectFile(name,data,type='application/json') {
  const blob=data instanceof Blob?data:new Blob([data],{type}),url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
async function loadProjectDocument(project,expectedEpoch=null) {
  const complete=project.version===2;
  const issues=complete?validateCompleteProject(project):validateProjectDocument(project);if(issues.length)throw new Error(issues.join('；'));
  const restoredFiles=complete?await prepareProjectResources(project):null,oldFiles=virtualState.files;
  if(expectedEpoch!==null&&(expectedEpoch!==runRequestId||programArmed)){if(restoredFiles)for(const item of restoredFiles.values())URL.revokeObjectURL(item.url);return;}
  stopProgram(false);
  if(project.settings){
    selectedModules=(project.settings.modules||[]).filter(id=>moduleCatalog[id]);localStorage.setItem('boardlab-modules',JSON.stringify(selectedModules));
    const keys=project.settings.keys;
    if(keys&&typeof keys.A==='string'&&typeof keys.B==='string'&&keys.A!==keys.B&&keys.A.length<40&&keys.B.length<40){keyMap={A:keys.A,B:keys.B};localStorage.setItem('boardlab-keymap',JSON.stringify(keyMap));}
  }
  if(complete){
    const settings=project.settings||{};
    for(const [target,data] of [[sensorState,settings.sensors],[m10Sensors,settings.m10Sensors]])if(data)for(const key of Object.keys(target))if(Object.hasOwn(data,key))target[key]=typeof target[key]==='number'?Number(data[key]):String(data[key]);
    const inputs=settings.virtualInputs||{};
    for(const key of Object.keys(virtualState).filter(key=>!['files','pins'].includes(key)))if(Object.hasOwn(inputs,key))virtualState[key]=typeof virtualState[key]==='number'?Number(inputs[key]):typeof virtualState[key]==='boolean'?Boolean(inputs[key]):String(inputs[key]);
    for(const pin of Object.keys(virtualState.pins))if(inputs.pins?.[pin])virtualState.pins[pin]={analog:Math.max(0,Math.min(4095,Number(inputs.pins[pin].analog)||0)),digital:inputs.pins[pin].digital?1:0};
    if(settings.speed){$('#speed').value=String(settings.speed);localStorage.setItem('boardlab-speed',String(settings.speed));}
    if(Array.isArray(settings.learnedFaces)){learnedK10Faces.clear();settings.learnedFaces.filter(Number.isSafeInteger).forEach(id=>learnedK10Faces.add(id));}
    virtualState.files=restoredFiles;
  }
  selectBoard(project.board);
  const workspaces=complete?project.workspaces:{[project.board]:project.workspace};
  if(complete){
    projectWorkspaces={};
    for(const board of ['k10','m10'])if(!workspaces[board]){localStorage.removeItem('boardlab-workspace-'+board);localStorage.removeItem('boardlab-workspace-updated-'+board);}
  }
  Object.assign(projectWorkspaces,workspaces);
  for(const [board,workspace] of Object.entries(workspaces))try{localStorage.setItem('boardlab-workspace-'+board,JSON.stringify(workspace));localStorage.setItem('boardlab-workspace-updated-'+board,String(Date.now()));}catch{}
  Blockly.Events.disable();
  try{blocklyWorkspace.clear();Blockly.serialization.workspaces.load(workspaces[project.board],blocklyWorkspace);}
  finally{Blockly.Events.enable();}
  blocklyWorkspace.getAllBlocks(false).filter(b=>b.type.startsWith('procedures_def')).forEach(decorateMindProcedure);
  refreshContinuousToolbox();updateCode();blocklyWorkspace.scrollCenter();renderKeyMap();
  updateProjectName(project.name||projectName);syncProjectEnvironment();
  saveWorkspace();
  if(complete)for(const item of oldFiles.values())if(item.url)URL.revokeObjectURL(item.url);
}
function bindProjectFiles() {
  const menu=$('#projectMenu');
  updateProjectName(projectName);
  $('#projectNameInput').addEventListener('change',event=>updateProjectName(event.target.value));
  $('#speed').addEventListener('change',()=>{try{localStorage.setItem('boardlab-speed',$('#speed').value)}catch{}});
  projectBackupStore('get').then(blob=>{projectBackupAvailable=!!blob||projectBackupAvailable}).catch(()=>{});
  const close=()=>{menu.hidden=true;$('#projectMenuBtn').setAttribute('aria-expanded','false')};
  $('#projectMenuBtn').addEventListener('click',()=>{menu.hidden=!menu.hidden;$('#projectMenuBtn').setAttribute('aria-expanded',String(!menu.hidden));$('#examplesPopover').hidden=true;});
  document.addEventListener('click',event=>{if(!menu.contains(event.target)&&event.target!==$('#projectMenuBtn'))close();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')close()});
  $('#saveProjectBtn').addEventListener('click',async()=>{
    close();const button=$('#saveProjectBtn');button.disabled=true;
    try{updateProjectName($('#projectNameInput').value);const blob=await buildBoardlabBundle(await captureCompleteProject());let name=projectName.replace(/[\\/<>:"|?*\x00-\x1f]/g,'_').replace(/[. ]+$/,'')||'板演工程';if(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name))name='板演_'+name;downloadProjectFile(name+'.boardlab',blob);try{await projectBackupStore('put',blob,'current')}catch{}toast('完整工程已保存，包含各主板程序、资源和环境设置');}
    catch(error){showProjectCheck('工程保存失败','当前程序保留。',[error.message]);}
    finally{button.disabled=false;}
  });
  $('#openProjectBtn').addEventListener('click',()=>{close();$('#projectFileInput').click()});
  $('#projectFileInput').addEventListener('change',async event=>{
    const file=event.target.files?.[0];if(!file)return;
    try {
      if(file.size>64*1024*1024)throw new Error('请选择 64 MB 以内的板演工程');
      let project,issues=[];
      if(/\.mp$/i.test(file.name)){
        const result=mpToWorkspace(mpDecodeProject(new Uint8Array(await file.arrayBuffer())));issues=result.issues;
        if(result.workspace)project={format:'boardlab',version:1,board:result.board,workspace:result.workspace};
      } else if(/\.boardlab$/i.test(file.name)){
        const bytes=new Uint8Array(await file.arrayBuffer());
        if(bytes[0]===0x50&&bytes[1]===0x4b)project=await decodeBoardlabBundle(bytes);
        else{project=JSON.parse(new TextDecoder().decode(bytes));if(project.format!=='boardlab'||project.version!==1)throw new Error('板演工程版本不受支持');}
      }else throw new Error('请选择 .mp 或 .boardlab 工程');
      if(project&&!issues.length)issues=project.version===2?validateCompleteProject(project):validateProjectDocument(project);
      const detail=project?.version===2?`包含 ${Object.keys(project.workspaces).map(x=>x.toUpperCase()).join(' / ')} 工作区和 ${project.resources.length} 个 TF 文件。`:`将打开 ${project?.board?.toUpperCase()} 积木工程。`;
      showProjectCheck('打开工程',issues.length?`${file.name} 暂不能完整打开，当前程序保留。`:`${file.name} 检查通过。${detail}`,issues,project);
    } catch(error){showProjectCheck('工程无法打开',file.name,[error.message]);}
    finally{event.target.value='';}
  });
  $('#applyProjectBtn').addEventListener('click',async()=>{
    if(!pendingProjectDocument)return;
    const button=$('#applyProjectBtn');button.disabled=true;let backup;
    try{
      backup=await buildBoardlabBundle(await captureCompleteProject());await projectBackupStore('put',backup);projectBackupAvailable=true;
      await loadProjectDocument(pendingProjectDocument);const current=await buildBoardlabBundle(await captureCompleteProject());await projectBackupStore('put',current,'current');$('#projectDialog').close();toast('完整工程已打开，点击运行开始');
    }catch(error){if(backup)try{await loadProjectDocument(await decodeBoardlabBundle(new Uint8Array(await backup.arrayBuffer())))}catch{}showProjectCheck('工程打开失败','当前程序保留或已恢复打开前的程序。',[error.message]);}
    finally{button.disabled=false;}
  });
  $('#recoverProjectBtn').addEventListener('click',async()=>{
    try{const blob=await projectBackupStore('get'),old=blob?await decodeBoardlabBundle(new Uint8Array(await blob.arrayBuffer())):JSON.parse(localStorage.getItem('boardlab-project-backup'));await loadProjectDocument(old);await projectBackupStore('put',await buildBoardlabBundle(await captureCompleteProject()),'current');$('#projectDialog').close();toast('已恢复打开前的完整工程');}
    catch(error){showProjectCheck('恢复失败','恢复副本暂不能打开。',[error.message]);}
  });
  $('#closeProjectDialog').addEventListener('click',()=>$('#projectDialog').close());
  $('#exportMpBtn').addEventListener('click',()=>{
    close();
    if(currentBoard!=='k10'){showProjectCheck('Mind+ 导出范围','目前支持 K10 上传模式。M10 请保存为板演工程，或导出已有 Python 3 工程。');return;}
    try {
      const workspace=Blockly.serialization.workspaces.save(blocklyWorkspace),result=workspaceToMp(workspace);
      if(blocklyWorkspace.getTopBlocks(false).some(block=>block.outputConnection))result.issues.push('工程含未连接的值积木，请先连接到程序再导出 Mind+');
      if(result.issues.length){showProjectCheck('暂不能导出 Mind+ 工程','以下积木尚未适配，未生成不完整的 .mp 文件。',result.issues);return;}
      const check=mpToWorkspace(result.project),issues=[...check.issues,...validateProjectDocument({board:'k10',workspace:check.workspace})];
      if(issues.length){showProjectCheck('转换检查未通过','请保存板演工程，保留完整积木和图片。',issues);return;}
      downloadProjectFile('板演_K10_MindPlus1.8.mp',createK10ProjectZip([['project.json',JSON.stringify(result.project)],[mpBlankAsset,mpBlankSvg]]));
      showProjectCheck('Mind+ 工程已导出','已生成 Mind+ 1.8.x K10 上传模式 .mp。已通过格式和板演回读检查；尚未在 Mind+ 应用内验证，属于兼容测试版。');
    } catch(error){showProjectCheck('Mind+ 导出失败','当前工程保留。',[error.message]);}
  });
}
async function restoreCompleteProject(){
  const epoch=runRequestId;
  try{
    const blob=await projectBackupStore('get',null,'current');if(!blob||epoch!==runRequestId||programArmed)return;
    const project=await decodeBoardlabBundle(new Uint8Array(await blob.arrayBuffer()));if(epoch!==runRequestId||programArmed)return;
    for(const board of Object.keys(project.workspaces))if(Number(localStorage.getItem('boardlab-workspace-updated-'+board))>project.savedAt){const newer=JSON.parse(localStorage.getItem('boardlab-workspace-'+board)||'null');if(newer)project.workspaces[board]=newer;}
    if(project.workspaces[currentBoard])project.board=currentBoard;
    project.name=projectName;project.settings.modules=[...selectedModules];project.settings.keys={...keyMap};const speed=localStorage.getItem('boardlab-speed');if(speed)project.settings.speed=Number(speed);
    await loadProjectDocument(project,epoch);
  }catch(error){console.warn('完整工程恢复失败',error);toast('完整工程自动恢复失败，可从“工程”重新打开文件');}
}
