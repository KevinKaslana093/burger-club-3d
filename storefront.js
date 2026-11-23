(() => {
  'use strict';
  const dialog=document.createElement('dialog');
  dialog.className='storefront-viewer';dialog.setAttribute('aria-labelledby','street-title');
  dialog.innerHTML=`<header><div><small>BURGER CLUB · PALM STREET</small><h2 id="street-title">街角餐厅</h2></div><button type="button" data-action="close">返回营业</button></header><div class="street-canvas" tabindex="0" aria-label="餐厅三维模型"></div><footer><div class="street-modes" aria-label="建筑视图"><button type="button" data-action="street" aria-pressed="true">沿街外观</button><button type="button" data-action="cut" aria-pressed="false">揭顶看店内</button><button type="button" data-action="walk" aria-pressed="false">入店走走</button></div><div class="street-orbit"><button type="button" data-action="left" aria-label="向左旋转">↶</button><button type="button" data-action="right" aria-label="向右旋转">↷</button><button type="button" data-action="in" aria-label="拉近">＋</button><button type="button" data-action="out" aria-label="拉远">－</button></div></footer>`;
  document.body.append(dialog);
  const surface=dialog.querySelector('.street-canvas');
  let rig,walk,drag,frame=0,restore=0,theta,tilt,zoom,cut=false;
  function reset(){theta=cut?-.43:-.38;tilt=cut?1.05:.24;zoom=1;}
  function draw(now){
    frame=0;if(!dialog.open||!rig)return;
    const width=surface.clientWidth,height=surface.clientHeight;if(!width||!height)return;
    const {camera,renderer,scene}=rig;camera.aspect=width/height;
    if(walk?.active)camera.fov=Math.min(69,2*Math.atan(Math.tan(106*Math.PI/360)/camera.aspect)*180/Math.PI);
    camera.updateProjectionMatrix();
    let moving=false;
    if(walk?.active){moving=walk.update(now);}
    else{
      const distance=Math.max(cut?32:22.7,(cut?34:30)/camera.aspect)*zoom;
      camera.position.set(Math.sin(theta)*Math.cos(tilt)*distance,1.65+Math.sin(tilt)*distance,1.55-Math.cos(theta)*Math.cos(tilt)*distance);
      camera.lookAt(0,1.65,1.55);
    }
    rig.occupants.view(camera,height,Boolean(walk?.active),moving);
    const ratio=!rig.gpu&&moving?.68:Math.min(devicePixelRatio||1,1.5);
    if(rig.width!==width||rig.height!==height||rig.ratio!==ratio){renderer.setPixelRatio(ratio);renderer.setSize(width,height,false);rig.width=width;rig.height=height;rig.ratio=ratio;}
    renderer.render(scene,camera);
    if(moving&&!rig.gpu&&!frame){clearTimeout(restore);restore=setTimeout(requestDraw,215);}
  }
  function requestDraw(){if(!frame&&dialog.open)frame=requestAnimationFrame(draw);}
  function mount(parts){
    const T=window.THREE,scene=new T.Scene(),camera=new T.PerspectiveCamera(42,1,.15,150);
    let renderer,gpu=true;try{renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});}catch(error){if(!window.DinerCanvasRenderer)throw error;gpu=false;renderer=new window.DinerCanvasRenderer();}
    renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.outputEncoding=T.sRGBEncoding;
    scene.background=new T.Color(0xcbdcdf);scene.fog=new T.FogExp2(0xe3e7da,.010);
    const hemi=new T.HemisphereLight(0xfff4de,0xadada4,.67),key=new T.DirectionalLight(0xffe4bc,.77),fill=new T.DirectionalLight(0xc0e0e5,.20);
    key.position.set(-12,20,-16);key.target.position.z=2;scene.add(key.target);fill.position.set(9,8,6);scene.add(hemi,key,fill);
    const building=window.DinerBuilding.create(T,parts);scene.add(building.root);
    if(gpu){renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;key.castShadow=true;key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-15,right:15,top:15,bottom:-15,near:.5,far:52});key.shadow.bias=-.0005;key.shadow.normalBias=.018;building.root.traverse(o=>{if(o.isMesh&&!o.material?.transparent){o.receiveShadow=true;if(o.geometry?.type!=='PlaneGeometry')o.castShadow=true;}});}
    else {const batches=[];building.root.traverse(o=>{if(o.isInstancedMesh)batches.push(o);});for(const batch of batches){const group=new T.Group();batch.parent.add(group);group.applyMatrix4(batch.matrix);for(let i=0;i<batch.count;i++){const matrix=new T.Matrix4();batch.getMatrixAt(i,matrix);const mesh=new T.Mesh(batch.geometry,batch.material);mesh.applyMatrix4(matrix);group.add(mesh);}batch.parent.remove(batch);}}
    surface.prepend(renderer.domElement);rig={scene,camera,renderer,building,gpu,lights:{hemi,key,fill}};
    rig.occupants=window.DinerTourOccupants.create(T,rig,requestDraw);
  }
  function mode(name){
    if(name==='walk'&&!walk)walk=window.DinerWalk.create({T:window.THREE,dialog,surface,rig,requestDraw});
    cut=name==='cut';walk?.set(name==='walk');drag=null;rig.building.roof.visible=!cut;rig.renderer.shadowMap.needsUpdate=true;
    for(const btn of dialog.querySelectorAll('.street-modes button'))btn.setAttribute('aria-pressed',String(btn.dataset.action===name));
    surface.setAttribute('aria-label',name==='walk'?'餐厅步行观光，WASD 移动，方向键转头，也可直接选择位置':'餐厅三维模型，拖动或用方向键旋转，用加减键调整距离');
    reset();requestDraw();
  }
  function distance(factor){zoom=Math.max(.54,Math.min(1.6,zoom*factor));requestDraw();}
  function action(which){switch(which){case 'close':dialog.close();break;case 'street':case 'cut':case 'walk':mode(which);break;case 'left':theta-=.23;break;case 'right':theta+=.23;break;case 'in':distance(.87);break;case 'out':distance(1.15);break;}requestDraw();}
  dialog.addEventListener('click',e=>{const btn=e.target.closest('[data-action]');if(btn)action(btn.dataset.action);if(e.target===dialog)dialog.close();});
  dialog.addEventListener('keydown',e=>{if(walk?.active){walk.keyboard(e,true);e.stopPropagation();return;}const which={ArrowLeft:'left',ArrowRight:'right','+':'in','=':'in','-':'out'}[e.key];if(which){action(which);e.preventDefault();}if(e.key==='ArrowUp'||e.key==='ArrowDown'){tilt=Math.max(.09,Math.min(1.42,tilt+(e.key==='ArrowUp'?.12:-.12)));requestDraw();e.preventDefault();}e.stopPropagation();});
  dialog.addEventListener('keyup',e=>{if(walk?.active){walk.keyboard(e,false);e.stopPropagation();}});
  surface.addEventListener('pointerdown',e=>{if(walk?.active||e.button||!e.isPrimary)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,theta,tilt};surface.setPointerCapture(e.pointerId);});
  surface.addEventListener('pointermove',e=>{if(drag?.id!==e.pointerId)return;theta=drag.theta-(e.clientX-drag.x)*.008;tilt=Math.max(.09,Math.min(1.42,drag.tilt+(e.clientY-drag.y)*.007));requestDraw();});
  for(const evt of ['pointerup','pointercancel','lostpointercapture'])surface.addEventListener(evt,()=>drag=null);
  surface.addEventListener('wheel',e=>{e.preventDefault();if(!walk?.active)distance(Math.exp(Math.min(120,Math.max(-120,e.deltaY))*.0018));},{passive:false});
  new ResizeObserver(requestDraw).observe(surface);
  dialog.addEventListener('close',()=>{cancelAnimationFrame(frame);clearTimeout(restore);frame=0;drag=null;walk?.set(false);rig?.occupants.close();window.dispatchEvent(new Event('diner-exterior-close'));document.getElementById('streetViewBtn')?.focus({preventScroll:true});});
  window.DinerStorefront={open(parts){if(!parts||!window.DinerBuilding)return false;try{
    if(!rig)mount(parts);
    rig.building.root.traverse(o=>{if(o.userData.smokeStock)o.visible=!!parts.smokeStock;});
    rig.occupants.open(parts);dialog.showModal();mode('street');return true;
  }catch(error){console.error('建筑预览加载失败',error);if(dialog.open)dialog.close();return false;}}};
})();
