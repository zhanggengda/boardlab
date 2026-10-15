// A single native Blockly flyout, with a separate compact category rail.
const paletteWidth=260;
const collapsedGroups=new Set();
let paletteSections=[];
let paletteCategories=[];
let paletteRefreshPending=false;
let trashDragFromPalette=false;
let trashDragActive=false;
let trashPointerX=Infinity;

document.addEventListener('pointerdown',event=>{
  trashDragFromPalette=!!event.target.closest?.('.blocklyFlyout');
  trashPointerX=event.clientX;
},true);
document.addEventListener('pointermove',event=>{
  trashPointerX=event.clientX;
  if(trashDragActive)updatePaletteTrash();
},true);

function setPaletteTrashDragging(active){
  trashDragActive=active&&!trashDragFromPalette;
  updatePaletteTrash();
  if(!active)trashDragFromPalette=false;
}
function updatePaletteTrash(){
  const host=document.getElementById('blocksView');
  if(!host)return;
  const edge=host.querySelector('.palette-delete-overlay')?.getBoundingClientRect().right??-Infinity;
  const near=trashDragActive&&trashPointerX<=edge+52;
  host.classList.toggle('delete-near',near);
  host.classList.toggle('delete-open',near&&trashPointerX<=edge);
}

class ContinuousFlyout extends Blockly.VerticalFlyout {
  constructor(options){super(options);this.MARGIN=10;this.GAP_Y=14;}
  getFlyoutScale(){return .8;}
  reflowInternal_(){
    this.workspace_.scale=this.getFlyoutScale();
    this.width_=paletteWidth;
    this.position();
    this.targetWorkspace.resizeContents();
    this.targetWorkspace.recordDragTargets();
    this.clipBlocks_();
  }
  clipBlocks_(){
    for(const item of this.getContents()){
      const block=item.getElement();
      if(!block.getSvgRoot || !block.inputList)continue;
      const root=block.getSvgRoot(),p=block.getRelativeToSurfaceXY();
      const right=(paletteWidth-16)/this.workspace_.scale-p.x;
      const bottom=block.getHeightWidth().height+30;
      root.classList.add('palette-block');
      root.style.setProperty('--palette-clip',`polygon(-30px -30px, ${right}px -30px, ${right}px ${bottom}px, -30px ${bottom}px)`);
    }
    this.svgGroup_?.querySelectorAll('.blocklyFlyoutBlockBackground').forEach(rect=>rect.setAttribute('width',Math.min(Number(rect.getAttribute('width')),(paletteWidth-25)/this.workspace_.scale)));
  }
  getClientRect(){
    if(!this.isVisible()||!this.svgGroup_)return null;
    const left=this.svgGroup_.getBoundingClientRect().left;
    return new Blockly.utils.Rect(-1e9,1e9,-1e9,left+paletteWidth);
  }
  onDragEnter(){updatePaletteTrash();}
  onDragOver(){updatePaletteTrash();}
  onDragExit(){updatePaletteTrash();}
  onDrop(){setPaletteTrashDragging(false);}
  wheel_(event){super.wheel_(event);requestAnimationFrame(updatePaletteSelection);}
}
Blockly.registry.register(Blockly.registry.Type.FLYOUTS_VERTICAL_TOOLBOX,'boardlabContinuous',ContinuousFlyout);

const chipIcon='<svg viewBox="0 0 32 32" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.8"><rect x="7" y="7" width="18" height="18" rx="3"/><rect x="11" y="11" width="10" height="10" rx="1"/><path d="M11 2v5m5-5v5m5-5v5M11 25v5m5-5v5m5-5v5M2 11h5m-5 5h5m-5 5h5m18-10h5m-5 5h5m-5 5h5M14 14h4v4h-4z"/></g></svg>';
function continuousDefinition(workspace){
  paletteCategories=toolboxFor(currentBoard).contents;
  const contents=[];
  paletteSections=[];
  paletteCategories.forEach((category,index)=>{
    contents.push({kind:'label',text:category.name,'web-class':'palette-heading'});
    paletteSections.push({name:category.name,index:contents.length-1});
    let items=category.contents||[];
    if(category.custom&&workspace){const callback=workspace.getToolboxCategoryCallback(category.custom);items=callback?callback(workspace):[];}
    let hidden=false;
    items.forEach(item=>{
      if(item.kind==='label'&&category.name==='行空板K10'){
        const key='K10_GROUP_'+item.text;
        hidden=collapsedGroups.has(item.text);
        workspace?.registerButtonCallback(key,()=>{
          const flyout=workspace.getFlyout(),scroll=flyout.getWorkspace().scrollY;
          collapsedGroups.has(item.text)?collapsedGroups.delete(item.text):collapsedGroups.add(item.text);
          refreshContinuousToolbox();
          flyout.getWorkspace().scrollbar?.setY(Math.max(0,-scroll));
          updatePaletteSelection();
        });
        contents.push({kind:'button',text:(hidden?'▸ ':'▾ ')+item.text,callbackKey:key,'web-class':'palette-group'});
      }else if(!hidden)contents.push(item);
    });
  });
  return {kind:'flyoutToolbox',contents};
}
function refreshContinuousToolbox(){
  const ws=blocklyWorkspace;if(!ws)return;
  const flyout=ws.getFlyout(),scroll=flyout.getWorkspace().scrollY;
  ws.updateToolbox(continuousDefinition(ws));
  const items=flyout.getContents();
  paletteSections.forEach(section=>{
    const heading=items.map(item=>item.getElement()).find(item=>item.getButtonText?.()===section.name);
    section.y=heading?.getBoundingRectangle().top??0;
  });
  const rail=document.getElementById('categoryRail');
  rail.innerHTML=paletteCategories.map((category,i)=>`<button type="button" data-category="${i}" aria-label="${category.name}"><span class="category-icon" style="color:${category.colour}">${category.name==='行空板K10'?chipIcon:`<i style="background:${category.colour}"></i>`}</span><span>${category.name}</span></button>`).join('');
  rail.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{
    const section=paletteSections[Number(button.dataset.category)];
    flyout.getWorkspace().scrollbar.setY(Math.max(0,section.y*flyout.getWorkspace().scale-10));
    updatePaletteSelection();
  }));
  flyout.getWorkspace().scrollbar?.setY(Math.max(0,-scroll));
  updatePaletteSelection();
}
function updatePaletteSelection(){
  const flyout=blocklyWorkspace?.getFlyout();if(!flyout)return;
  const y=(-flyout.getWorkspace().scrollY+30)/flyout.getWorkspace().scale;
  let active=0;paletteSections.forEach((section,i)=>{if(section.y<=y)active=i;});
  document.querySelectorAll('#categoryRail button').forEach((button,i)=>{button.classList.toggle('active',i===active);button.setAttribute('aria-pressed',String(i===active));});
}
function installContinuousToolbox(workspace){
  refreshContinuousToolbox();
  workspace.getFlyout().getWorkspace().addChangeListener(()=>requestAnimationFrame(updatePaletteSelection));
  workspace.addChangeListener(event=>{
    const procedureChange=event.type===Blockly.Events.BLOCK_DELETE||([Blockly.Events.BLOCK_CREATE,Blockly.Events.BLOCK_CHANGE].includes(event.type)&&Boolean(workspace.getBlockById(event.blockId)?.type.startsWith('procedures_def')||event.oldJson?.type?.startsWith('procedures_def')));
    if(([Blockly.Events.VAR_CREATE,Blockly.Events.VAR_DELETE,Blockly.Events.VAR_RENAME].includes(event.type)||procedureChange)&&!paletteRefreshPending){
      paletteRefreshPending=true;setTimeout(()=>{paletteRefreshPending=false;refreshContinuousToolbox();},0);
    }
  });
}
