// Cooperative main/event execution. A paused step advances exactly one yield.
class RuntimeStepper {
  constructor({onInstruction,onBoundary=()=>{},onChange=()=>{},onError=error=>{throw error},alive=()=>true,clock=()=>performance.now(),setTimer=(fn,delay)=>setTimeout(fn,delay),clearTimer=id=>clearTimeout(id),paused=false,batch=false}) {
    Object.assign(this,{onInstruction,onBoundary,onChange,onError,alive,clock,setTimer,clearTimer,paused,batch});
    this.tasks=new Set();this.order=0;this.disposed=false;
  }
  add(iterator,onDone=()=>{}) {
    if(this.disposed)return;
    const task={iterator,onDone,timer:null,remaining:0,due:this.clock(),order:++this.order};
    this.tasks.add(task);
    if(this.paused)this.onChange();else this.advance(task);
  }
  advance(task,single=false) {
    if(this.disposed||!this.tasks.has(task))return;
    if(!this.alive()){this.dispose();return;}
    this.clearTimer(task.timer);task.timer=null;
    try {
      let delay=0,done=false,steps=0;const started=this.clock();
      do {
        const next=task.iterator.next();
        if(next.done){done=true;this.tasks.delete(task);this.onBoundary();task.onDone();break;}
        delay=this.onInstruction(next.value,{single})||0;
        if(this.disposed)return;
        if(single||delay>0)this.onBoundary();
      }while(this.batch&&!single&&!this.paused&&delay<=0&&++steps<128&&this.clock()-started<8);
      if(!done){task.remaining=Math.max(16,delay);task.due=this.clock()+task.remaining;task.order=++this.order;this.schedule(task);}
      this.onChange();
    } catch(error){this.dispose();this.onError(error);}
  }
  schedule(task) {
    if(this.paused||this.disposed)return;
    task.due=this.clock()+task.remaining;
    task.timer=this.setTimer(()=>{task.timer=null;if(!this.paused)this.advance(task);},task.remaining);
  }
  pause() {
    if(this.paused||this.disposed)return;
    this.paused=true;
    for(const task of this.tasks){task.remaining=Math.max(0,task.due-this.clock());this.clearTimer(task.timer);task.timer=null;}
    this.onChange();
  }
  resume() {
    if(!this.paused||this.disposed)return;
    this.paused=false;for(const task of this.tasks)this.schedule(task);this.onChange();
  }
  step() {
    if(this.disposed)return;
    this.pause();
    const task=[...this.tasks].sort((a,b)=>a.due-b.due||a.order-b.order)[0];
    if(task)this.advance(task,true);
    return Boolean(task);
  }
  dispose() {
    this.disposed=true;
    for(const task of this.tasks){this.clearTimer(task.timer);try{task.iterator.return?.()}catch{}}
    this.tasks.clear();
  }
}

let runtimeDebugger=null;
function recordRuntimeCondition(block,value) {return value;}
function createRuntimeDebugger(paused=false) {
  const epoch=runRequestId;
  return new RuntimeStepper({paused,batch:true,alive:()=>epoch===runRequestId&&programArmed,
    onInstruction(instruction,{single}){
      activeBlock=instruction.block||null;screenFrameDeferred=!single;
      if(activeBlock&&!instruction.control)executeRuntimeInstruction(instruction);
      return (instruction.control&&!instruction.cycle?0:instruction.delay)/Number($('#speed').value);
    },
    onBoundary:flushScreenFrame,
    onChange:renderRuntimeDebug,
    onError(error){console.error('虚拟运行失败',error);stopProgram(false);log('程序',`执行失败：${error.message}`);toast('程序执行失败，请查看输出');}
  });
}
function renderRuntimeDebug() {
  const paused=!!runtimeDebugger?.paused;
  if(programArmed){const status=$('#simStatus'),text=paused?(programDirty?'已暂停 · 请重新运行':'已暂停'):(running?'运行中':'等待事件')+(programDirty?' · 请重新运行':'');status.className=paused?'stopped':'running';if(status.textContent!==text)status.textContent=text;}
}
