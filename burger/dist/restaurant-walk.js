(() => {
  'use strict';
  const spots=[
    ['entrance','正门外',0,-8.70,0,.105],['aisle','客席中央',0,.22,0,-.045],
    ['table1','1 号桌',-1.00,-.64,-2.02,-.24],['table2','2 号桌',1.00,-.64,2.02,-.24],
    ['table3','3 号桌',-1.00,2.64,-2.02,-.24],['table4','4 号桌',1.00,2.64,2.02,-.24],
    ['pass','出餐窗',-.25,3.53,.62,-.03],['grill','后厨烤台',2.34,5.80,.015,-.18],
    ['prep','配料台',-2.21,5.77,-.05,-.18]
  ];
  const radius=.205, keys=new Set(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight']);
  const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
  const colliders=[];
  function block(x,z,w,d,angle=0){colliders.push({x,z,rx:w/2,rz:d/2,sin:Math.sin(angle),cos:Math.cos(angle)});}
  // The glass and internal pass are continuous obstacles except at the two actual doors.
  block(-3.51,-4.22,5.32,.24);block(3.51,-4.22,5.32,.24);
  block(-5.66,4.55,1.00,.23);block(1.18,4.55,10.00,.29);
  block(-5.065,5.098,1.09,.08,-1.54);
  for(const z of [-1.90,1.27])for(const x of [-2.68,2.68]){
    block(x,z-.015,2.08,.98);block(x,z+.83,1.94,1.055);
  }
  block(1.47,-3.68,1.16,.70,-.17);block(5.13,3.72,2.81,.82,-1.20);
  block(0,7.41,9.62,1.89);block(0,9.96,12.0,.35);
  block(-5.49,-6.66,1.49,.23);block(4.60,-5.24,1.86,.39,-.22);
  for(const x of [3.09,4.65])block(x,-5.63,.90,.07);
  const round=[[-3.75,-6.3,.18],[4.30,-6.05,.19],[-1.20,-4.82,.27],[1.20,-4.82,.27]];
  function withinBox(x,z,c){
    const dx=x-c.x,dz=z-c.z,u=dx*c.cos-dz*c.sin,v=dx*c.sin+dz*c.cos;
    return Math.hypot(Math.max(0,Math.abs(u)-c.rx),Math.max(0,Math.abs(v)-c.rz))<radius;
  }
  function allowed(x,z,door){
    if(z< -9.70+radius||z>9.95-radius||Math.abs(x)>(z< -4.22?8.25:6.00)-radius)return false;
    if(Math.abs(x)>5.78&&z> -4.48&&z< -4.00)return false;
    for(const c of colliders)if(withinBox(x,z,c))return false;
    for(const [cx,cz,r] of round)if(Math.hypot(x-cx,z-cz)<r+radius)return false;
    const a=-1.62*door,length=1.62,dx=Math.cos(a),dz=-Math.sin(a),u=clamp((x+.84)*dx+(z+4.22)*dz,0,length);
    return Math.hypot(x+.84-u*dx,z+4.22-u*dz)>radius+.049;
  }
  function outfit(T,root){
    const fit=new T.Group();fit.name='Tour ceiling and coastal view';root.add(fit);
    const paint=c=>new T.Color(c).convertSRGBToLinear();
    const warm=new T.MeshLambertMaterial({color:paint(0xe8d5b3)}),batten=new T.MeshLambertMaterial({color:paint(0xc1a681)});
    const sheet=new T.Mesh(new T.PlaneGeometry(12.16,14.51),warm);sheet.position.set(0,4.449,3.00);sheet.rotation.x=Math.PI/2;fit.add(sheet);
    const trim=new T.BoxGeometry(12.04,.054,.077);
    for(const z of [-3.25,-.26,2.72,5.68,8.67]){
      const board=new T.Mesh(trim,batten);board.position.set(0,4.412,z);fit.add(board);
    }
    const originalStreet=root.getObjectByName('Harbor street');
    if(originalStreet){const panel=originalStreet.clone(false);panel.visible=true;fit.add(panel);}
    else window.DinerRoomArt?.addExterior(T,fit);
    const sky=fit.getObjectByName('Harbor street');if(sky){sky.scale.setScalar(1.48);sky.position.set(0,4.50,-16.1);}
    const lamps=new T.HemisphereLight(0xffeccc,0xb29d85,.16);fit.add(lamps);
    const fill=new T.PointLight(0xffdab0,.24,8,1.2);fill.position.set(0,3.62,-.1);fit.add(fill);
    const kitchen=new T.PointLight(0xffe6c4,.31,7.2,1.4);kitchen.position.set(0,3.55,6.40);fit.add(kitchen);
    const bulbs=[];
    for(const x of [-2.50,2.50])for(const z of [-2.20,.88]){
      const bulb=new T.PointLight(0xffc688,0,4.6,1.55);bulb.position.set(x,3.15,z);fit.add(bulb);bulbs.push(bulb);
    }
    fit.userData.setPeriod=period=>{
      const late=period==='evening',gold=period==='afternoon';
      lamps.color.setHex(late?0xdecdbd:0xffeccc);lamps.intensity=late?.19:.16;
      kitchen.intensity=late?.87:.31;fill.intensity=late?.43:.24;
      for(const bulb of bulbs)bulb.intensity=late?1.60:gold?.32:.04;
    };
    fit.visible=false;return fit;
  }
  function create({T,dialog,surface,rig,requestDraw}){
    const equipment=outfit(T,rig.building.root),pressed=new Set();
    let active=false,x=0,z=0,yaw=0,pitch=0,door=0,moveX=0,moveY=0,last=0,viewDrag=null,stickDrag=null,currentArea='',lastMotion=0;
    const overlay=document.createElement('div');overlay.className='walk-overlay';overlay.hidden=true;
    overlay.innerHTML='<span class="walk-location"></span><span class="walk-touch-tip">左侧移动 · 滑动画面转头</span><div class="walk-stick" role="group" aria-label="拖动方向盘行走"><i></i></div>';
    surface.append(overlay);
    const location=overlay.querySelector('.walk-location'),stick=overlay.querySelector('.walk-stick'),thumb=stick.querySelector('i');
    const nav=document.createElement('div');nav.className='walk-navigation';nav.hidden=true;
    const identifier='walk-destination';
    nav.innerHTML='<label for="'+identifier+'">快速到达</label><select id="'+identifier+'" aria-label="选择要前往的位置"><option value="">选择位置…</option></select><span class="walk-help">WASD 行走 · 拖动画面转头</span>';
    const select=nav.querySelector('select');for(const item of spots){const opt=document.createElement('option');opt.value=item[0];opt.textContent=item[1];select.append(opt);}
    dialog.querySelector('footer').append(nav);
    function area(){if(z< -4.22)return '门前街道';if(z>4.65)return '后厨通道';if(z>3.07)return '出餐窗';for(const s of spots.slice(2,6))if(Math.hypot(x-s[2],z-s[3])<.92)return s[1];return '客席区';}
    function jump(id){
      const s=spots.find(a=>a[0]===id);if(!s)return;
      [, ,x,z,yaw,pitch]=s;door=0;rig.building.setEntryOpen(door);pressed.clear();moveX=moveY=0;thumb.style.transform='';select.value='';requestDraw();
    }
    select.addEventListener('change',()=>{jump(select.value);surface.focus({preventScroll:true});});
    function clear(){pressed.clear();moveX=moveY=0;viewDrag=null;stickDrag=null;thumb.style.transform='';}
    function set(value){
      if(value===active)return;active=value;last=0;lastMotion=0;clear();
      equipment.visible=active;overlay.hidden=!active;nav.hidden=!active;dialog.classList.toggle('is-walking',active);
      const cam=rig.camera;cam.near=value?.072:.15;cam.fov=value?69:42;cam.updateProjectionMatrix();rig.building.setEntryOpen(0);
      if(active){equipment.userData.setPeriod(rig.period);overlay.querySelector('.walk-touch-tip').hidden=false;jump('entrance');surface.focus({preventScroll:true});}
      else {currentArea='';door=0;}
    }
    function step(dx,dz){
      const n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.08));dx/=n;dz/=n;
      for(let i=0;i<n;i++){
        if(allowed(x+dx,z+dz,door)){x+=dx;z+=dz;}
        else{if(allowed(x+dx,z,door))x+=dx;if(allowed(x,z+dz,door))z+=dz;}
      }
    }
    function update(now){
      const dt=last?clamp((now-last)/1000,0,.32):0;last=now;
      const has=(...c)=>c.some(code=>pressed.has(code));
      let forward=+has('KeyW','ArrowUp')-+has('KeyS','ArrowDown')-moveY;
      let side=+has('KeyD')-+has('KeyA')+moveX;
      const rotation=+has('KeyQ','ArrowLeft')-+has('KeyE','ArrowRight');
      yaw+=rotation*dt*1.63;
      const near=Math.hypot(x*.89,(z+4.22)*.82),open=near<(door>.01?2.03:1.66)?1:0;
      const prev=door;door=clamp(door+Math.sign(open-door)*dt*2.8,0,1);
      if(prev!==door){
        rig.building.setEntryOpen(door);
        if(door===0||door===1)rig.renderer.shadowMap.needsUpdate=true;
      }
      const len=Math.hypot(forward,side);
      if(len){const speed=has('ShiftLeft','ShiftRight')?3.52:2.27,scale=speed*dt/Math.max(1,len);forward*=scale;side*=scale;step(Math.sin(yaw)*forward-Math.cos(yaw)*side,Math.cos(yaw)*forward+Math.sin(yaw)*side);}
      const cam=rig.camera,eye=1.60-.16*clamp((-7.56-z)/.26,0,1),c=Math.cos(pitch);
      cam.position.set(x,eye,z);cam.lookAt(x+Math.sin(yaw)*c,eye+Math.sin(pitch),z+Math.cos(yaw)*c);
      const here=area();if(here!==currentArea){currentArea=here;location.textContent=here;}
      if(len||rotation||viewDrag||stickDrag)lastMotion=now;
      const busy=Boolean(len||rotation||door!==open);
      if(busy)requestDraw();
      return (busy||now-lastMotion<180);
    }
    function keyboard(e,down){
      if(!active||e.altKey||e.ctrlKey||e.metaKey||e.target.tagName==='SELECT')return false;
      if(down&&/^Digit[1-4]$/.test(e.code)){jump('table'+e.code.slice(-1));e.preventDefault();return true;}
      if(!keys.has(e.code))return false;
      if(down){if(!pressed.size&&!stickDrag)last=performance.now();pressed.add(e.code);}else pressed.delete(e.code);
      e.preventDefault();requestDraw();return true;
    }
    function capture(target,id){try{target.setPointerCapture(id);}catch(_){}}
    function analog(e){
      const dx=e.clientX-stickDrag.x,dy=e.clientY-stickDrag.y,len=Math.hypot(dx,dy),r=stick.clientWidth*.38,s=Math.min(1,r/Math.max(len,.01));
      moveX=dx*s/r;moveY=dy*s/r;thumb.style.transform='translate('+dx*s+'px,'+dy*s+'px)';requestDraw();
    }
    stick.addEventListener('pointerdown',e=>{if(!active||stickDrag)return;e.stopPropagation();e.preventDefault();const rect=stick.getBoundingClientRect();if(!pressed.size)last=performance.now();stickDrag={id:e.pointerId,x:rect.x+rect.width/2,y:rect.y+rect.height/2};capture(stick,e.pointerId);analog(e);});
    stick.addEventListener('pointermove',e=>{if(stickDrag?.id===e.pointerId){e.stopPropagation();analog(e);}});
    function liftStick(e){if(stickDrag?.id===e.pointerId){e.stopPropagation();stickDrag=null;moveX=moveY=0;thumb.style.transform='';requestDraw();}}
    for(const evt of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(evt,liftStick);
    surface.addEventListener('pointerdown',e=>{if(!active||viewDrag||e.button!==0||e.target.closest('.walk-stick'))return;surface.focus({preventScroll:true});viewDrag={id:e.pointerId,x:e.clientX,y:e.clientY};capture(surface,e.pointerId);});
    surface.addEventListener('pointermove',e=>{if(!active||viewDrag?.id!==e.pointerId)return;if(Math.abs(e.clientX-viewDrag.x)+Math.abs(e.clientY-viewDrag.y)>3)overlay.querySelector('.walk-touch-tip').hidden=true;yaw-=(e.clientX-viewDrag.x)*.0052;pitch=clamp(pitch-(e.clientY-viewDrag.y)*.0040,-1.06,1.04);viewDrag.x=e.clientX;viewDrag.y=e.clientY;lastMotion=performance.now();requestDraw();});
    function liftView(e){if(viewDrag?.id===e.pointerId){viewDrag=null;requestDraw();}}
    for(const evt of ['pointerup','pointercancel','lostpointercapture'])surface.addEventListener(evt,liftView);
    window.addEventListener('blur',clear);document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});
    return {get active(){return active;},set,update,keyboard};
  }
  window.DinerWalk={create};
})();
