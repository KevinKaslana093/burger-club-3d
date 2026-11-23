(() => {
  'use strict';
  const guests=window.DinerGame.guests;
  const owner={name:'陆川',role:'店主兼主厨',note:'他习惯把铅笔削好，再把清晨的第一锅铁板烧热。',color:'#476956'};
  const profiles=[...guests,owner];
  const dialog=document.createElement('dialog');dialog.className='guestbook';dialog.id='guestbook';dialog.setAttribute('aria-labelledby','bookTitle');
  dialog.innerHTML=`<section class="book-layout"><header><h2 id="bookTitle">人物手册</h2><button type="button" data-close aria-label="关闭手册">×</button></header>
    <div class="book-stage" tabindex="0" aria-label="人物模型，拖动旋转，或使用下方转身按钮"><div class="book-stage-tools"><button type="button" data-turn="-1" aria-label="向左转身">↶</button><button type="button" data-turn="1" aria-label="向右转身">↷</button></div></div>
    <section class="book-card"><small id="bookNumber"></small><h3 id="bookName"></h3><strong id="bookRole"></strong><p id="bookNote"></p>
    <div class="book-zoom" role="group" aria-label="观察距离"><button type="button" data-zoom="face">面部</button><button type="button" data-zoom="bust">半身</button><button type="button" data-zoom="full">全身</button></div>
    <label class="book-select">选择人物<select aria-label="选择人物"><optgroup label="店员"><option value="${guests.length}">${owner.name} · ${owner.role}</option></optgroup><optgroup label="常客">${guests.map((p,i)=>`<option value="${i}">${p.name} · ${p.role}</option>`).join('')}</optgroup></select></label>
    <nav><button type="button" data-step="-1">← 上一位</button><button type="button" data-step="1">下一位 →</button></nav></section></section>`;
  document.body.appendChild(dialog);
  const surface=dialog.querySelector('.book-stage'), menu=dialog.querySelector('select');
  const T=window.THREE, reduce=matchMedia('(prefers-reduced-motion: reduce)');
  let renderer,scene,camera,pivot,figure,idx=0,zoom='bust',yaw=0,drag=null,frame=0,dirty=true,prev=0,software=false;
  const box=new T.Box3(),faceBox=new T.Box3();
  let backdrop,backdropPaint;
  function studio(){
    const canvas=document.createElement('canvas');canvas.width=384;canvas.height=384;
    backdropPaint=canvas.getContext('2d');const tex=new T.CanvasTexture(canvas);tex.encoding=T.sRGBEncoding;
    backdrop=new T.Mesh(new T.PlaneGeometry(14,12),new T.MeshBasicMaterial({map:tex}));backdrop.position.set(0,2,-2.3);scene.add(backdrop);
    const shade=document.createElement('canvas');shade.width=shade.height=128;const ctx=shade.getContext('2d');
    const soft=ctx.createRadialGradient(64,64,1,64,64,64);soft.addColorStop(0,'rgba(57,46,35,.45)');soft.addColorStop(.32,'rgba(71,56,42,.24)');soft.addColorStop(1,'rgba(80,68,48,0)');ctx.fillStyle=soft;ctx.fillRect(0,0,128,128);
    const contact=new T.Mesh(new T.PlaneGeometry(1.32,.86),new T.MeshBasicMaterial({map:new T.CanvasTexture(shade),transparent:true,depthWrite:false}));contact.rotation.x=-Math.PI/2;contact.position.y=.003;scene.add(contact);
  }
  function setBackdrop(color){
    const c=backdropPaint;const mix=(f)=>'#'+new T.Color('#fff0d6').lerp(new T.Color(color),f).getHexString();
    const wash=c.createRadialGradient(167,168,2,185,203,231);wash.addColorStop(0,mix(.04));wash.addColorStop(.45,mix(.15));wash.addColorStop(1,mix(.47));c.fillStyle=wash;c.fillRect(0,0,384,384);
    const floor=c.createLinearGradient(0,219,0,384);floor.addColorStop(0,'rgba(117,94,70,0)');floor.addColorStop(1,'rgba(117,94,70,.28)');c.fillStyle=floor;c.fillRect(0,219,384,165);backdrop.material.map.needsUpdate=true;
  }
  function releaseFigure(){if(!figure)return;pivot.remove(figure);figure.userData.dispose?.();figure=null;}

  function init(){
    if(renderer)return;
    try{renderer=new T.WebGLRenderer({antialias:true,powerPreference:'low-power'});}catch{renderer=new window.DinerCanvasRenderer();software=true;}
    renderer.outputEncoding=T.sRGBEncoding;renderer.setPixelRatio(Math.min(software?1:2,devicePixelRatio||1));
    surface.prepend(renderer.domElement);scene=new T.Scene();camera=new T.PerspectiveCamera(27,1,.035,45);pivot=new T.Group();scene.add(pivot);studio();
    const hemi=new T.HemisphereLight(0xfff6e3,0xb4a3a6,.74);scene.add(hemi);
    for(const [color,intensity,x,y,z] of [[0xfff4df,.90,-3,5,4],[0xf4faff,.40,3,3,1],[0xffdfa7,.76,1,3,-3]]){const light=new T.DirectionalLight(color,intensity);light.position.set(x,y,z);scene.add(light);}
  }
  function fit(){
    if(!figure||!dialog.open)return;
    const radians=pivot.rotation.y;pivot.rotation.y=0;pivot.updateMatrixWorld(true);box.setFromObject(figure);
    faceBox.makeEmpty();figure.userData.portraitFaceBounds?.(faceBox);
    pivot.rotation.y=radians;
    const height=box.max.y-box.min.y||2.7;
    const cfg=zoom==='face'?[.866,.365]:zoom==='full'?[.505,1.10]:[.725,.66];
    const face=zoom==='face'&&!faceBox.isEmpty(),faceHeight=faceBox.max.y-faceBox.min.y;
    const target=face?faceBox.min.y+faceHeight*.55:box.min.y+height*cfg[0],width=surface.clientWidth,heightPx=surface.clientHeight;
    if(!width||!heightPx)return;
    camera.aspect=width/heightPx;camera.updateProjectionMatrix();renderer.setSize(width,heightPx,false);
    const halfSpan=face?faceHeight*.865:height*cfg[1]*.5;
    const distance=halfSpan/Math.tan(T.MathUtils.degToRad(camera.fov/2))*Math.max(1,.76/camera.aspect)+(face?faceBox.max.z:.18);
    camera.position.set(0,target+.025,distance);camera.lookAt(0,target,0);dirty=true;
  }
  function select(value){
    idx=(value+profiles.length)%profiles.length; const p=profiles[idx];menu.value=String(idx);
    const number=p===owner?'铁板汉堡社':`常客 ${String(idx+1).padStart(2,'0')} / ${guests.length}`;
    for(const [id,text] of Object.entries({bookNumber:number,bookName:p.name,bookRole:p.role,bookNote:p.note}))document.getElementById(id).textContent=text;
    releaseFigure();figure=p===owner?window.DinerModels.chef():window.DinerGuests.customer(idx,window.DinerModels);
    figure.userData.setVisitPose?.('wait',0,.84);
    pivot.add(figure);yaw=p===owner?-.22:-.10;pivot.rotation.y=yaw;
    scene.background=new T.Color('#f1e8d7').lerp(new T.Color(p.color),.28).convertSRGBToLinear();
    setBackdrop(p.color);dialog.style.setProperty('--guest-accent',p.color);fit();
  }
  function paint(t){
    if(!dialog.open)return;
    frame=requestAnimationFrame(paint);
    if(document.hidden||(!dirty&&(reduce.matches||!figure?.userData.onFrame||t-prev<(software?115:33))))return;
    prev=t;dirty=false;figure?.userData.onFrame?.(t,reduce.matches,'portrait');pivot.rotation.y=yaw;renderer.render(scene,camera);
  }
  function chooseZoom(key){zoom=key;for(const b of dialog.querySelectorAll('[data-zoom]'))b.setAttribute('aria-pressed',String(b.dataset.zoom===key));fit();}
  function turn(delta){yaw+=delta;dirty=true;}
  surface.addEventListener('pointerdown',e=>{if(e.target.closest('button')||e.button!==0||!e.isPrimary)return;drag={id:e.pointerId,x:e.clientX,yaw};surface.setPointerCapture(e.pointerId);});
  surface.addEventListener('pointermove',e=>{if(drag?.id===e.pointerId){yaw=drag.yaw+(e.clientX-drag.x)*Math.PI*2/Math.max(240,surface.clientWidth*.8);dirty=true;}});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])surface.addEventListener(type,()=>{drag=null;});
  dialog.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.hasAttribute('data-close'))dialog.close();else if(b.dataset.step)select(idx+Number(b.dataset.step));else if(b.dataset.turn)turn(Number(b.dataset.turn)*Math.PI/6);else if(b.dataset.zoom)chooseZoom(b.dataset.zoom);});
  menu.addEventListener('change',()=>select(Number(menu.value)));
  dialog.addEventListener('keydown',e=>{e.stopPropagation();if(e.target===menu)return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();select(idx+(e.key==='ArrowLeft'?-1:1));}});
  dialog.addEventListener('close',()=>{cancelAnimationFrame(frame);drag=null;releaseFigure();window.dispatchEvent(new Event('diner-book-close'));});
  new ResizeObserver(()=>{if(dialog.open)fit();}).observe(surface);window.addEventListener('diner-model-ready',()=>{if(dialog.open)fit();});
  window.DinerGuestBook={open(index){dialog.showModal();try{init();select(index);chooseZoom('bust');frame=requestAnimationFrame(paint);}catch(err){console.error('人物预览',err);dialog.close();return false;}return true;}};
})();
