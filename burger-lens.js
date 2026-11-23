(() => {
  'use strict';
  const clamp=(value,low,high)=>Math.max(low,Math.min(high,value));
  function create(dialog,view){
    const surface=dialog.querySelector('#showcaseStage'),hold=dialog.querySelector('#orbitHold'),layers=dialog.querySelector('#orbitLayers');
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    let paused=false,angle=0,base=0,elevation=0,zoom=1,split=0,goal=0,drag=null,resumed=false;
    function paint(){view(angle,elevation,zoom,split);}
    function controls(){hold.textContent=paused?'继续环绕':'停下细看';hold.setAttribute('aria-pressed',String(paused));layers.setAttribute('aria-pressed',String(!!goal));layers.textContent=goal?'合起汉堡':'看夹层';dialog.classList.toggle('held',paused);}
    function pause(){if(paused)return;paused=true;controls();}
    function resume(){paused=false;goal=split=0;elevation=0;zoom=1;base=angle;resumed=true;controls();paint();}
    hold.onclick=()=>{if(paused)resume();else pause();};
    layers.onclick=()=>{pause();goal=goal?0:1;controls();if(reduced){split=goal;paint();}};
    surface.addEventListener('pointerdown',e=>{if(e.button!==0||drag)return;pause();drag={id:e.pointerId,x:e.clientX,y:e.clientY};surface.setPointerCapture(e.pointerId);surface.focus({preventScroll:true});});
    surface.addEventListener('pointermove',e=>{if(drag?.id!==e.pointerId)return;angle-=(e.clientX-drag.x)/Math.max(280,surface.clientWidth*.75);elevation=clamp(elevation+(e.clientY-drag.y)*.14,-8,27);drag.x=e.clientX;drag.y=e.clientY;paint();});
    const release=e=>{if(drag?.id===e.pointerId)drag=null;};for(const event of ['pointerup','lostpointercapture','pointercancel'])surface.addEventListener(event,release);
    surface.addEventListener('wheel',e=>{e.preventDefault();pause();zoom=clamp(zoom*Math.exp(-e.deltaY*.001),.77,1.46);paint();},{passive:false});
    dialog.addEventListener('keydown',e=>{
      if(!dialog.open||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-'].includes(e.key))return;e.preventDefault();pause();
      if(e.key==='ArrowLeft'||e.key==='ArrowRight')angle+=(e.key==='ArrowLeft'?-1:1)/36;
      else if(e.key==='ArrowUp'||e.key==='ArrowDown')elevation=clamp(elevation+(e.key==='ArrowUp'?3:-3),-8,27);
      else zoom=clamp(zoom*(e.key==='-'?1/1.09:1.09),.77,1.46);paint();
    });
    return {held:()=>paused,auto(v){angle=base+v;return angle;},consumeResume(){const value=resumed;resumed=false;return value;},tick(delta){if(split===goal)return;const step=clamp(delta/430,0,1);split=split<goal?Math.min(goal,split+step):Math.max(goal,split-step);paint();},reset(){paused=false;angle=base=elevation=split=goal=0;zoom=1;drag=null;resumed=false;controls();}};
  }
  window.DinerBurgerLens={create};
})();
