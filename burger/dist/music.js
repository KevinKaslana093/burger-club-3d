(() => {
  'use strict';
  const tracks = {
    original: {name:'午间出单', credit:'铁板汉堡社原创', tag:'A'},
    online: {name:'Bossa Antigua', credit:'Kevin MacLeod · CC BY 4.0', tag:'B'}
  };
  const button = document.getElementById('musicChoice');
  if (!button) return;
  const panel = document.createElement('dialog');
  panel.className='music-picker'; panel.id='musicPicker'; panel.setAttribute('aria-labelledby','musicTitle');
  panel.innerHTML=`<header><h2 id="musicTitle">餐厅配乐</h2><button type="button" data-close aria-label="关闭配乐选择">×</button></header>
    <div class="record-preview" aria-label="餐厅点唱机"></div><section class="record-selection"><div class="music-tracks">${Object.entries(tracks).map(([key,t])=>`<button type="button" data-track="${key}"><b>${t.tag}</b><span><strong>${t.name}</strong><small>${t.credit}</small></span></button>`).join('')}</div>
    <div class="music-volume"><label for="musicLevel">音乐音量</label><input id="musicLevel" type="range" min="0" max="10" step="1"><output for="musicLevel"></output></div>
    <footer><button type="button" data-track="off">关闭音乐</button><span><a href="https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1700069" target="_blank" rel="noopener noreferrer">原曲</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">许可</a></span></footer></section>`;
  document.body.appendChild(panel);
  let selection='original', level=5, unlocked=false, paused=false, generation=0;
  try {
    const saved=JSON.parse(localStorage.getItem('burgerclub-music'));
    if(saved && (tracks[saved.selection] || saved.selection==='off')) selection=saved.selection;
    if(saved && Number.isInteger(saved.level) && saved.level>=0 && saved.level<=10) level=saved.level;
  } catch {}
  const players=new Map();
  function player(key) {
    if(!players.has(key)) {
      const audio = new Audio(window.DinerMusicData?.[key] || `music/${key}.mp3`);
      audio.loop=true; audio.preload='none'; players.set(key,audio);
    }
    return players.get(key);
  }
  async function ramp(audio,to,ms,token){
    const from=audio.volume,start=performance.now();
    while(token===generation){
      const progress=Math.min(1,(performance.now()-start)/ms);
      audio.volume=from+(to-from)*progress;
      if(progress===1)return;
      await new Promise(resolve=>setTimeout(resolve,16));
    }
  }
  async function sync(){
    const token=++generation;
    const active=unlocked&&!document.hidden&&!paused&&level>0&&tracks[selection]?player(selection):null;
    if(!active){for(const audio of players.values()){audio.pause();audio.volume=0;}return;}
    for(const audio of players.values()){
      if(audio===active||audio.paused)continue;
      await ramp(audio,0,110,token);if(token!==generation)return;audio.pause();
    }
    const target=.6*(level/10)**1.35;
    if(active.paused){
      active.volume=0;
      try{await active.play();}catch{return;}
      if(token!==generation){if(document.hidden||paused||active!==players.get(selection)||level===0)active.pause();return;}
    }
    await ramp(active,target,145,token);
  }
  function display() {
    const current=tracks[selection];
    const caption=current?'音乐 '+current.tag:'音乐关';
    const label=button.querySelector('[data-music-label]'); if(label)label.textContent=caption;
    button.title='餐厅配乐 · '+(current?.name||'已关闭');button.setAttribute('aria-label',button.title);
    for(const el of panel.querySelectorAll('[data-track]'))el.setAttribute('aria-pressed',String(el.dataset.track===selection));
    panel.querySelector('input').value=level;panel.querySelector('output').textContent=level*10+'%';
  }
  const preview=panel.querySelector('.record-preview');
  let rig=null,raf=0,rotation=-.24,hold=null,dirty=true,lastDraw=-1000;
  function mountPreview(){
    if(rig||!window.DinerJukebox)return;
    const T=window.THREE,scene=new T.Scene(),camera=new T.PerspectiveCamera(29,1,.03,20);
    let renderer,cpu=false;
    try{renderer=new T.WebGLRenderer({antialias:true,powerPreference:'low-power'});}catch{renderer=new window.DinerCanvasRenderer();cpu=true;}
    renderer.setPixelRatio(Math.min(cpu?1:1.7,devicePixelRatio||1));renderer.outputEncoding=T.sRGBEncoding;preview.appendChild(renderer.domElement);
    scene.background=new T.Color(0xdbc7a7);
    scene.add(new T.HemisphereLight(0xfff3df,0xb0a39c,.89));
    for(const [col,k,x,y,z] of [[0xffe3bb,1.24,-3,4,4],[0xebffff,.6,3,2,1],[0xffdd9c,.8,2,4,-3]]){const l=new T.DirectionalLight(col,k);l.position.set(x,y,z);scene.add(l);}
    const model=window.DinerJukebox.create(T);scene.add(model);
    rig={T,scene,camera,renderer,cpu,model};resizePreview();
  }
  function resizePreview(){if(!rig||!panel.open)return;const w=preview.clientWidth,h=preview.clientHeight;if(!w||!h)return;const {camera,renderer}=rig;camera.aspect=w/h;camera.position.set(.02,1.07,Math.max(4.13,2.67/camera.aspect));camera.lookAt(0,.94,0);camera.updateProjectionMatrix();renderer.setSize(w,h,false);dirty=true;}
  function paintPreview(t){
    if(!panel.open||!rig)return;
    raf=requestAnimationFrame(paintPreview);
    if(document.hidden)return;
    const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
    if(!dirty&&(selection==='off'||!level||reduced||t-lastDraw<(rig.cpu?140:50)))return;
    rig.model.rotation.y=rotation;rig.model.userData.playback(selection,t,reduced);rig.renderer.render(rig.scene,rig.camera);dirty=false;lastDraw=t;
  }
  preview.addEventListener('pointerdown',e=>{if(e.button!==0||!e.isPrimary)return;hold={x:e.clientX,base:rotation,id:e.pointerId};preview.setPointerCapture(e.pointerId);});
  preview.addEventListener('pointermove',e=>{if(hold?.id===e.pointerId){rotation=hold.base+(e.clientX-hold.x)*.013;dirty=true;}});
  for(const type of ['pointerup','lostpointercapture','pointercancel'])preview.addEventListener(type,()=>hold=null);
  new ResizeObserver(resizePreview).observe(preview);
  function persist(){try{localStorage.setItem('burgerclub-music',JSON.stringify({selection,level}));}catch{}display();dirty=true;sync();}
  function unlock(){if(!unlocked){unlocked=true;sync();}}
  for(const evt of ['click','keydown'])document.addEventListener(evt,unlock,{capture:true,once:true});
  button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls',panel.id);
  button.addEventListener('click',()=>{if(panel.open)return;panel.showModal();button.setAttribute('aria-expanded','true');try{mountPreview();resizePreview();raf=requestAnimationFrame(paintPreview);}catch{preview.hidden=true;}panel.querySelector('[aria-pressed="true"]')?.focus();window.dispatchEvent(new Event('diner-music-open'));});
  panel.addEventListener('click',e=>{
    const choice=e.target.closest('[data-track]');
    if(choice){selection=choice.dataset.track;persist();}
    if(e.target.closest('[data-close]')||e.target===panel)panel.close();
  });
  panel.addEventListener('keydown',e=>e.stopPropagation());
  panel.addEventListener('close',()=>{button.setAttribute('aria-expanded','false');cancelAnimationFrame(raf);hold=null;window.dispatchEvent(new Event('diner-music-close'));button.focus({preventScroll:true});});
  panel.querySelector('input').addEventListener('input',e=>{level=Number(e.target.value);persist();});
  document.addEventListener('visibilitychange',sync);
  window.DinerMusic={get selection(){return unlocked&&!paused&&level>0?selection:'off';},open(){button.click();},setPaused(value){if(value!==paused){paused=value;sync();}}};display();
})();
