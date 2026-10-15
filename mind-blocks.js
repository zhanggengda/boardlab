// Mind+ uses inline condition headers and direct +/- branch controls.
function defineExpandableCondition() {
  const icon = plus => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="white" stroke-width="2.4"/><path d="M7 12h10${plus?'M12 7v10':''}" stroke="white" stroke-width="2.4" stroke-linecap="round"/></svg>`);
  Blockly.Blocks.control_if_elseif = {
    init() {
      this.elseIfCount_ = 0;
      this.hasElse_ = false;
      this.appendValueInput('CHECK').setCheck('Boolean').appendField('如果');
      this.appendDummyInput('THEN').appendField('那么执行');
      this.appendStatementInput('DO');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('control_blocks');
      this.setInputsInline(true);
      this.updateBranches_(0, false);
      this.setTooltip('点击加号增加分支；点击减号移除这一层，里面的积木会保留在工作区。');
    },
    saveExtraState() { return {elseIfCount:this.elseIfCount_,hasElse:this.hasElse_}; },
    loadExtraState(state) { this.updateBranches_(Math.max(0, Number(state.elseIfCount)||0), Boolean(state.hasElse)); },
    mutationToDom() {
      const element = Blockly.utils.xml.createElement('mutation');
      element.setAttribute('elseif', this.elseIfCount_);
      element.setAttribute('else', this.hasElse_ ? '1' : '0');
      return element;
    },
    domToMutation(element) { this.updateBranches_(Number(element.getAttribute('elseif'))||0, element.getAttribute('else')==='1'); },
    changeBranches_(count, hasElse, removed = -1) {
      if (this.isInFlyout) return;
      const oldState=JSON.stringify(this.saveExtraState());
      Blockly.Events.setGroup(true);
      try {
        this.updateBranches_(count,hasElse,removed);
        const newState=JSON.stringify(this.saveExtraState());
        Blockly.Events.fire(new Blockly.Events.BlockChange(this,'mutation',null,oldState,newState));
      } finally { Blockly.Events.setGroup(false); }
    },
    branchButton_(plus, label, callback) {
      return new Blockly.FieldImage(icon(plus),24,24,label,callback);
    },
    updateBranches_(count, hasElse, removed=-1) {
      const saved=[];
      for(let i=0;i<this.elseIfCount_;i++) saved.push({check:this.getInput(`CHECK${i+2}`)?.connection?.targetConnection,body:this.getInput(`DO${i+2}`)?.connection?.targetConnection});
      const otherwise=this.getInput('ELSE')?.connection?.targetConnection;
      if(removed>=0) saved.splice(removed,1);
      for(const input of [...this.inputList]) if(!['CHECK','THEN','DO'].includes(input.name)) this.removeInput(input.name);
      this.elseIfCount_=count;
      this.hasElse_=hasElse;
      for(let i=0;i<count;i++) {
        const index=i+2;
        this.appendValueInput(`CHECK${index}`).setCheck('Boolean').appendField('否则如果');
        this.appendDummyInput(`THEN${index}`).appendField('那么执行').appendField(this.branchButton_(false,`移除第 ${i+1} 个否则如果`,()=>this.changeBranches_(this.elseIfCount_-1,this.hasElse_,i)));
        this.appendStatementInput(`DO${index}`);
        if(saved[i]?.check) this.getInput(`CHECK${index}`).connection.connect(saved[i].check);
        if(saved[i]?.body) this.getInput(`DO${index}`).connection.connect(saved[i].body);
      }
      if(hasElse) {
        this.appendDummyInput('ELSE_LABEL').appendField('否则').appendField(this.branchButton_(false,'移除否则',()=>this.changeBranches_(this.elseIfCount_,false)));
        this.appendStatementInput('ELSE');
        if(otherwise) this.getInput('ELSE').connection.connect(otherwise);
      }
      this.appendDummyInput('ADD_BRANCH').appendField(this.branchButton_(true,'增加否则分支',()=>this.hasElse_?this.changeBranches_(this.elseIfCount_+1,true):this.changeBranches_(this.elseIfCount_,true)));
    }
  };
}

function migrateMindWorkspace(state) {
  const visit = block => {
    if (!block) return;
    if(block.type==='screen_image'&&block.inputs?.FILE){
      const oldFile=block.inputs.FILE.block||block.inputs.FILE.shadow;
      if(!block.data)block.data=JSON.stringify({localImage:{name:oldFile?.fields?.TEXT||'',width:100,height:100,src:''}});
      delete block.inputs.FILE;
    }
    if(['screen_text','speak_text'].includes(block.type)){
      const oldText=block.fields?.TEXT;
      if(oldText!==undefined){block.inputs={...block.inputs,TEXT:{shadow:{type:'text',fields:{TEXT:oldText}}}};delete block.fields.TEXT;}
      else if(!block.inputs?.TEXT?.block&&!block.inputs?.TEXT?.shadow){block.inputs={...block.inputs,TEXT:{shadow:{type:'text',fields:{TEXT:block.type==='screen_text'?'你好，创客！':'你好'}}}};}
    }
    if(['screen_text_line','screen_text_xy'].includes(block.type)&&!block.inputs?.TEXT?.block&&!block.inputs?.TEXT?.shadow){
      block.inputs={...block.inputs,TEXT:{shadow:{type:'text',fields:{TEXT:block.fields?.TEXT??'行空板'}}}};
      if(block.fields)delete block.fields.TEXT;
    }
    if(block.type==='control_if_elseif'&&!block.extraState) block.extraState={elseIfCount:1,hasElse:true};
    Object.values(block.inputs||{}).forEach(input=>{visit(input.block);visit(input.shadow);});
    visit(block.next?.block);
  };
  state.blocks?.blocks?.forEach(visit);
  return state;
}
