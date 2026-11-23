(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const game = DinerGame.create();
  const s = game.state;
  const session=game.session;
  const shiftLocked=()=>session?.mode==='opening'||session?.mode==='observer';
  let surfaceLost=false,recoveryTimer=0;
  const areas = ['order','grill','build'];
  const labels = ['客席区','煎烤台','组装台'];
  const cams = ['DINING ROOM','GRIDDLE','ASSEMBLY'];
  const products = ['bottom','patty','cheese','smoke','lettuce','tomato','pickle','onion','top'];
  const digits = (n,l=2) => String(n).padStart(l,'0');
  const money = n => '¥' + Number(n || 0).toFixed(2);
  let modalMode = '', savedFocus, lastFrame = 0, acc = 0, muted = false, volume = 8;
  try {
    muted = localStorage.getItem('burgerclub-muted') === 'true';
    const saved=Number(localStorage.getItem('burgerclub-volume'));
    if(Number.isInteger(saved)&&saved>=1&&saved<=10)volume=saved;
  } catch {}
  const sound=(window.AudioContext||window.webkitAudioContext)?window.DinerAudio?.create():null;
  const svg = (body,box='0 0 24 24') => '<svg viewBox="'+box+'" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+body+'</svg>';
  const icons = {
    order:svg('<path d="M3 18h18v3H3zM5 17v-4a7 7 0 0 1 14 0v4M10 4h4M12 4v2"/>'),
    grill:svg('<path d="m4 15 5 5 8-8-5-5zM14 9l6-6M7 15l4-4m-2 6 4-4M3 9c-2-2 2-3 0-5m4 2c-2-2 2-3 0-5"/>'),
    build:svg('<path d="M3 9c.5-4 4.4-6 9-6s8.5 2 9 6H3zm0 4 3 1.5L10 12l4 2 4-2 3 1M3 17h18c-.3 3-2 4-4 4H7c-2 0-3.7-1-4-4zM9 6h.2m4 0h.3"/>'),
    sound:svg('<path d="M3 9h4l5-4v14l-5-4H3zM15 8q4 4 0 8m3-11q7 7 0 14"/>'),
    mute:svg('<path d="M3 9h4l5-4v14l-5-4H3zM16 9l6 6m0-6-6 6"/>'),
    pause:svg('<path fill="currentColor" stroke="none" d="M6 4h4v16H6zm8 0h4v16h-4z"/>'),
    bell:svg('<path d="M4 15h16M6 15a6 6 0 0 1 12 0M3 19h18M11 7h2"/>'),
    arrow:svg('<path d="M3 12h16m-6-6 6 6-6 6"/>'),
    voice:svg('<path d="M3 4h18v13H9l-5 4v-4H3zM7 9h10M7 12h6"/>')
  };
  const emblem='<svg viewBox="0 0 78 72" aria-hidden="true"><g stroke="#443827" stroke-width="2.7" stroke-linejoin="round"><path fill="#edab4c" d="M8 32C9 16 20 7 36 6c16-1 29 6 34 23 0 2-1 3-3 3z"/><path fill="#f7d985" d="M8 29c12-3 34-4 60-2l2 5-61 4z"/><path fill="#7fad60" d="m7 36 8-4 8 4 9-4 9 4 9-4 9 3 10-4 2 6-9 4-11-2-9 5-9-4-10 3-10-2-6-1z"/><path fill="#c54e34" d="m9 41 60-4 1 6-59 6z"/><path fill="#6a3e29" d="M10 48c15-5 47-7 59-6l2 7c-8 4-45 8-61 6z"/><path fill="#ffc34e" d="m16 45 34-3-9 12-10-6-12 4z"/><path fill="#e9a54e" d="M9 55c20 0 44-3 62-6 0 9-9 14-27 16-22 3-31 0-35-10z"/></g><g stroke="#ffe9ae" stroke-width="3" stroke-linecap="round"><path d="m20 22 4-3m9-3 4-2m7 8 4-1m5-4 3 1"/></g></svg>';
  const drawings={
    bottom:'<path fill="#d78840" d="M2 11q0 7 18 7t18-7z"/><ellipse fill="#f2bc6c" cx="20" cy="10" rx="18" ry="5"/>',
    top:'<path fill="#dda052" d="M2 14Q5-1 21 2q13 0 17 12-14 7-36 0z"/><g stroke="#fff0b3" stroke-width="1.7"><path d="m9 9 3-1m4-3 3-1m5 5 3-1m2 4 2-1"/></g>',
    patty:'<path fill="#6b432c" d="M2 9q2-5 17-5 15 0 18 4l1 5q-4 5-18 5Q4 18 2 14z"/><path fill="#976344" d="M3 9q4-5 17-5 14 0 17 5-4 6-18 5Q7 14 3 9z"/><path stroke="#593d28" d="m10 10 8-4m-1 6 10-5m-1 5 4-2"/>',
    cheese:'<path fill="#f8b62e" d="m1 9 20-6 18 6-18 9z"/><path fill="#ffdb54" d="m1 8 20-6 18 6-19 8z"/><path fill="#e5a22d" stroke="none" d="M17 7a2 1 0 1 0 .1 0m7 2a2 1 0 1 0 .1 0"/>',
    smoke:'<path d="M5 13c4 2 22-11 25-9s-19 10-16 12 17-7 21-6" stroke="#663127" stroke-width="5" stroke-linecap="round"/><path d="M5 12c4 2 22-11 25-9s-19 10-16 12 17-7 21-6" stroke="#b45839" stroke-width="3" stroke-linecap="round"/><path d="m7 11 5-2m6 4 4-2" stroke="#e59969" stroke-linecap="round"/>',
    lettuce:'<path fill="#72a954" d="m1 11 5-4 4 1 4-5 6 2 7-2 3 3 5 1 3 4-4 2-3 2-6-1-5 3-5-2-5 2-4-3z"/><path stroke="#45834e" d="m7 11 8-3 5 1 6-2 6 2"/>',
    tomato:'<ellipse fill="#d45236" cx="20" cy="11" rx="17" ry="7"/><ellipse fill="#f37e4c" cx="20" cy="8" rx="17" ry="5"/><path stroke="#ffd287" d="m9 8 4-1m5-2 3 2m4 2 5-1"/>',
    pickle:'<ellipse fill="#609355" cx="16" cy="12" rx="12" ry="5"/><ellipse fill="#a5b85c" cx="24" cy="8" rx="12" ry="5"/><path stroke="#6e9348" d="m17 7 3 2m3-3 3 3m3-2 2 1"/>',
    onion:'<ellipse fill="#ce8a9d" cx="20" cy="11" rx="17" ry="6"/><ellipse fill="#f1d5ca" cx="20" cy="9" rx="17" ry="6"/><ellipse fill="#fff1d3" stroke="#a56f88" cx="20" cy="9" rx="10" ry="3"/>'
  };
  const foodIcon=id=>'<svg viewBox="0 0 40 21" fill="none" stroke="#604b32" stroke-width="1.15" stroke-linejoin="round" aria-hidden="true">'+(drawings[id]||'')+'</svg>';
  $('brandIcon').innerHTML=emblem;
  $('pauseBtn').innerHTML=icons.pause;
  function updateVolume(save=false){
    sound?.setVolume(volume/10);sound?.setMuted(muted);
    const label=sound?(muted?'开启音效':'关闭音效'):'音效不可用';
    $('audioBtn').disabled=!sound;
    $('audioBtn').innerHTML=icons[muted||!sound?'mute':'sound'];$('audioBtn').title=label;
    $('audioBtn').setAttribute('aria-label',label);$('audioBtn').setAttribute('aria-pressed',String(!!sound&&!muted));
    if($('volumeSlider')){
      $('volumeSlider').disabled=!sound;
      $('volumeSlider').value=muted||!sound?0:volume;
      $('volumeReadout').textContent=sound?(muted?0:volume*10)+'%':'不可用';
    }
    if(save)try{
      localStorage.setItem('burgerclub-muted',String(muted));
      localStorage.setItem('burgerclub-volume',String(volume));
    }catch{}
  }
  function syncDiningSound(){
    const inRoom=!surfaceLost&&!shiftLocked()&&s.station==='order'&&!modalMode&&!document.hidden&&(s.phase==='waiting'||s.phase==='playing');
    let seats=0;
    if(inRoom)for(const diner of s.previousDiners||[]){
      const clock=DinerGame.mealTimes(diner);
      if(diner.seconds<Math.min(clock.done,clock.leave))seats|=1<<(diner.table-1);
    }
    sound?.setDiningRoom?.(inRoom,seats);
  }
  function syncKitchenSound(){
    const paused=surfaceLost||shiftLocked()||document.hidden||['pause','confirm','guestbook','music','exterior'].includes(modalMode);
    window.DinerMusic?.setPaused(surfaceLost||shiftLocked()||modalMode==='pause'||modalMode==='confirm');
    sound?.setPaused(paused);
    const frying=s.phase==='playing'&&s.station==='grill'&&!stage?.isGrillAirborne?.()&&(s.grillStage==='sideA'||s.grillStage==='sideB');
    const heat=s.grillStage==='sideB'?s.heatB:s.heatA;
    sound?.setGrill(frying&&!paused?(heat>=85?'hot':'sizzle'):'off');
    syncDiningSound();
  }
  updateVolume();
  document.addEventListener('pointerdown',()=>sound?.unlock(),{once:true,capture:true});
  $('audioBtn').onclick=()=>{muted=!muted;updateVolume(true);if(!muted){sound?.unlock();sound?.play('tap');}};
  document.addEventListener('input',e=>{
    if(e.target.id!=='volumeSlider')return;
    const level=Number(e.target.value);muted=level===0;
    if(level>0)volume=level;
    updateVolume(true);
    if(!muted)sound?.unlock();
  });
  let stage;
  try { stage=DinerScene.mount($('stage')); } catch(e){ console.error('餐厅渲染初始化失败',e); }
  stage?.setGrillContactListener?.(()=>{
    if(!modalMode&&!document.hidden&&s.phase==='playing'&&s.station==='grill')sound?.play('drop');
    syncKitchenSound();
  });
  stage?.setGrillPlateListener?.(()=>{
    if(!modalMode&&!document.hidden&&s.phase==='playing'&&s.station==='build')sound?.play('plate');
  });
  let pendingServe=null, ingredientDrag=null, suppressTrayClick=false;
  stage?.setPlacementListener?.((food,strength,contact)=>{
    if(!modalMode&&!document.hidden&&s.phase==='playing'&&s.station==='build')
      sound?.play('ingredient',food,strength,contact);
  });
  const tray=$('buildTools');
  function resetIngredientDrag(commit=false){
    const held=ingredientDrag;
    ingredientDrag=null;
    if(held?.moving)held.offset=stage.releaseIngredient(commit);
    if(held?.button.hasPointerCapture(held.pointer))held.button.releasePointerCapture(held.pointer);
    held?.button.classList.remove('picked-up');
    $('viewport').classList.remove('holding-food','drop-ready');
    if(held?.moving&&!commit&&s.station==='build')actions();
    return held;
  }
  tray.addEventListener('pointerdown',e=>{
    const button=e.target.closest('.ingredient:not(:disabled)');
    if(!button||ingredientDrag||!stage?.holdIngredient||e.button!==0||!e.isPrimary)return;
    suppressTrayClick=false;
    ingredientDrag={button,pointer:e.pointerId,food:button.dataset.v,x:e.clientX,y:e.clientY,moving:false};
    button.setPointerCapture(e.pointerId);
  });
  tray.addEventListener('pointermove',e=>{
    const held=ingredientDrag;
    if(!held||held.pointer!==e.pointerId)return;
    if(!held.moving){
      if(Math.hypot(e.clientX-held.x,e.clientY-held.y)<7)return;
      stage.holdIngredient(held.food,e.clientX,e.clientY);
      held.moving=true;suppressTrayClick=true;sound?.unlock();
      held.button.classList.add('picked-up');$('viewport').classList.add('holding-food');
    }
    const ready=stage.moveHeldIngredient(e.clientX,e.clientY);
    $('viewport').classList.toggle('drop-ready',ready);
    if($('assemblyHint'))$('assemblyHint').textContent=ready?'松手，食材会落在标记处。':'把食材拖到案板中央。';
  });
  tray.addEventListener('pointerup',e=>{
    if(!ingredientDrag||ingredientDrag.pointer!==e.pointerId)return;
    const commit=ingredientDrag.moving&&stage.moveHeldIngredient(e.clientX,e.clientY);
    const held=resetIngredientDrag(commit);
    if(commit)run('add',held.food,held.offset);
  });
  for(const name of ['pointercancel','lostpointercapture'])tray.addEventListener(name,e=>{
    if(ingredientDrag?.pointer===e.pointerId)resetIngredientDrag();
  });
  tray.addEventListener('click',e=>{
    if(suppressTrayClick&&e.detail>0){e.preventDefault();e.stopPropagation();suppressTrayClick=false;}
  },true);
  const showcase=$('showcase');
  const lens=window.DinerBurgerLens.create(showcase,(...view)=>stage?.inspectShowcase(...view));
  let showcaseTime=0, showcaseFrame=null;
  function openShowcase(replay=false){
    if(s.phase!=='result'||showcase.open)return false;
    if(!replay&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)return false;
    if(typeof showcase.showModal!=='function'||!stage?.setShowcase?.(s.stack))return false;
    if(modalMode)closeModal();
    const correctStack=s.recipe.length===s.stack.length&&s.recipe.every((food,i)=>food===s.stack[i]);
    $('showcaseName').textContent=correctStack?s.recipeName:'主厨自选堡';
    $('showcaseTicket').textContent='出餐特写 · #'+digits(s.orderNo,3);
    $('showcaseFill').style.transform='scaleX(0)';
    showcaseTime=0;showcaseFrame=null;lens.reset();drag=null;swallowClick=false;
    $('showcaseStage').appendChild($('stage'));
    showcase.showModal();
    stage.resize();
    if(replay)sound?.play('serve');
    $('showcaseSkip').focus({preventScroll:true});
    return true;
  }
  function endShowcase(silent=false){
    if(!showcase.open)return;
    showcase.close();
    $('viewport').prepend($('stage'));
    stage.setShowcase(null);
    stage.resize();
    showcaseFrame=null;
    if(!silent){showModal('result');sound?.play('rating');}
  }
  function advanceShowcase(t){
    if(document.hidden){showcaseFrame=null;return;}
    const delta=showcaseFrame===null?0:Math.max(0,t-showcaseFrame);showcaseFrame=t;
    if(lens.held()){lens.tick(delta);return;}
    if(lens.consumeResume())showcaseTime=0;
    showcaseTime+=delta;
    const fraction=Math.min(1,Math.max(0,(showcaseTime-180)/4900));
    const orbit=fraction-.08*Math.sin(2*Math.PI*fraction);
    stage.setShowcaseProgress(lens.auto(orbit));
    $('showcaseFill').style.transform='scaleX('+fraction+')';
    if(showcaseTime>=5500)endShowcase();
  }
  showcase.addEventListener('cancel',e=>{e.preventDefault();endShowcase();});
  let closeup=false,orbit=0,drag=null,swallowClick=false;
  $('inspectBtn').onclick=()=>{
    sound?.unlock();sound?.play('tap');
    closeup=!closeup;orbit=0;stage?.setCloseup?.(closeup);
    $('stage').classList.toggle('inspect',closeup);
    $('viewport').classList.toggle('inspecting',closeup);
    $('inspectBtn').setAttribute('aria-pressed',String(closeup));
    $('inspectBtn').querySelector('b').textContent=closeup?'全景':'近景';
  };
  $('stage').addEventListener('pointerdown',e=>{
    if(showcase.open||!closeup||!stage?.orbitCloseup||e.button!==0)return;
    drag={id:e.pointerId,x:e.clientX,base:orbit};swallowClick=false;
    $('stage').setPointerCapture(e.pointerId);
  });
  $('stage').addEventListener('pointermove',e=>{
    if(!drag||drag.id!==e.pointerId)return;
    const dx=e.clientX-drag.x;if(Math.abs(dx)>5)swallowClick=true;
    orbit=Math.max(-1,Math.min(1,drag.base-dx/Math.max(95,$('stage').clientWidth*.31)));
    stage.orbitCloseup(orbit);
  });
  function releaseOrbit(e){if(drag?.id===e.pointerId)drag=null;}
  $('stage').addEventListener('pointerup',releaseOrbit);$('stage').addEventListener('pointercancel',releaseOrbit);
  const stationBtns=areas.map((id,i)=>'<button class="station-button" data-act="station" data-v="'+id+'">'+icons[id]+'<span><strong>'+labels[i]+'</strong><small>'+cams[i]+'</small></span><kbd>'+(i+1)+'</kbd></button>').join('');
  $('stations').innerHTML=stationBtns;
  function primary(action,label,icon='arrow',disabled=false){return '<button class="action" data-act="'+action+'" '+(disabled?'disabled':'')+'>'+label+icons[icon]+'</button>';}
  function dialogLine(label,line){return '<div class="dialogue-label">'+icons.voice+label+'</div><p>'+line+'</p>';}
  const guestLines = [
    ['呼，刚跳完最后一首。能点单了吗？','排练完就等这一口！'],
    ['我画完了，正好点单。','等我先画个侧面……算了，趁热吃。'],
    ['滑板放好了，我选好啦。','这口比练成新动作还开心。'],
    ['菜单借我垫一下速写本。可以点了。','切面真漂亮，我得记下来。'],
    ['今天的课下得早，慢慢吃。','这层芝麻包烤得真香。'],
    ['我把手上的木屑洗干净了。点菜吧。','看这断面，叠得真齐整。'],
    ['我数过菜单上那只汉堡的芝麻了！','我本来想数芝麻的，一口就忘了。'],
    ['毛线放这儿就好。麻烦来一下。','我明天把隔壁店的姑娘也叫来。'],
    ['琴盒就靠在这儿吧。我选好了。','这下晚上那场演出有劲儿了。'],
    ['窗边光正好。你好，点单。','刚才拍了一张，可惜香味拍不进去。'],
    ['车锁好了。来，点个热的。','接下一单之前，还来得及好好吃完。'],
    ['花先放在旁边。今天想吃点热的。','今天收工最开心的一刻就是现在。'],
    ['这首唱片我认得。菜单也看好了。','正好赶上这首曲子最喜欢的一段。']
  ];
  function guestReview(){
    const q=s.score;
    const alignment=q.alignment??100;
    if(alignment<98&&alignment<=Math.min(q.cooking,q.build,q.pace)){
      let worst=0,distance=0;
      s.stackOffsets.forEach(([x,z],i)=>{
        const radius=Math.hypot(x,z);
        if(radius>distance){distance=radius;worst=i;}
      });
      return '第 '+(worst+1)+' 层的'+DinerGame.names[s.stack[worst]]+'偏到一边了，往面包中心放会更稳。';
    }
    if(q.cooking===100&&q.build===100&&q.pace>=90){
      if(s.customer===0&&s.recipe.includes('smoke'))return '芝士还是我喜欢的那味，这回多了股烟熏香。下次排练完还点这个！';
      return guestLines[s.customer][1];
    }
    if(q.build<100&&q.build<=q.cooking&&q.build<=q.pace){
      const missing=s.recipe.filter(id=>!s.stack.includes(id));
      if(missing.length)return '我点的'+missing.map(id=>DinerGame.names[id]).join('、')+'好像漏放了。';
      const extra=s.stack.find((id,i)=>!s.recipe.includes(id)||s.stack.indexOf(id)<i);
      return extra?'这份多了一层'+DinerGame.names[extra]+'。':'配料都到了，叠放的顺序跟我点的不太一样。';
    }
    if(q.cooking<100&&q.cooking<=q.pace){
      if(!s.platedFaces)return '肉饼的火候跟我喜欢的还有一点距离。';
      if(Math.min(...s.platedFaces)<65)return '肉饼有一面火候偏轻，再煎一会儿更合我口味。';
      return '肉饼边上有点干，下回早点出锅吧。';
    }
    if(q.pace<90)return '谢谢！等得有点久，我可要开动了。';
    return '刚出炉的香味真好，谢谢招待。';
  }
  function actions(){
    let out='';
    if(s.phase==='waiting')out=primary('take',s.visit==='arriving'?'客人正在入座…':s.visit==='ordering'?'正在记单…':'到 '+s.table+' 号桌点单','bell',s.visit!=='seated');
    else if(s.visit==='carrying')out=primary('deliver','送到 '+s.table+' 号桌','bell');
    else if(s.visit==='delivering')out=primary('serve','正在送往 '+s.table+' 号桌…','bell',true);
    else if(s.phase==='result'||s.phase==='dayEnd')out=primary('showResult','查看结算');
    else if(s.station==='order')out=primary('goGrill','前往煎烤台');
    else if(s.station==='grill'){
      let a=s.grillStage;
      if(a==='sideA'||a==='sideB')out+='<p id="heatCaption"></p><div class="heat-meter" role="meter" aria-label="肉饼当前火候" aria-valuemin="0" aria-valuemax="100"><i id="needle"></i></div>';
      out+=primary('grill',{empty:'放上生肉饼',sideA:'翻面',sideB:'出锅，去组装',ready:'重新煎一块'}[a],'grill');
      if(a==='ready')out+='<div class="minor-row"><button data-act="goBuild">返回组装台 →</button></div>';
    }else{
      const capped=s.stack.at(-1)==='top';
      const offset=s.stackOffsets?.at(-1);
      let hint=s.canServe?'汉堡已合上，可以出餐。':capped?'少了肉饼，撤回顶包后补上。':s.cookedQuality===null?'先去煎烤台准备肉饼。':s.stack.length===0?'先放底层面包。':'轻点居中放置，或拖到想放的位置。';
      if(s.recipe[s.stack.length]==='smoke'&&s.stack.every((id,j)=>id===s.recipe[j]))hint='在芝士上淋一道烟熏酱，就可以盖顶包了。';
      if(offset&&Math.hypot(...offset)>.12&&(!capped||s.canServe)){
        hint=DinerGame.names[s.stack.at(-1)]+'靠近边缘，可撤回重放。';
      }
      out+='<p id="assemblyHint">'+hint+'</p>'+primary('serve',pendingServe?'正在装盘…':'端起餐盘','bell',!s.canServe||!!pendingServe);
      out+='<div class="minor-row"><button data-act="undo" '+(!s.stack.length?'disabled':'')+'>撤回一层</button><button data-act="clear" '+(!s.stack.length?'disabled':'')+'>移除全部配料</button></div>';
    }
    $('actionArea').innerHTML=out;
    heat();
  }
  function heat(){
    const el=$('needle');if(!el)return;
    const value=s.grillStage==='sideA'?s.heatA:s.heatB;
    el.style.left=Math.min(100,value)+'%';el.parentNode.setAttribute('aria-valuenow',Math.round(value));$('heatCaption').textContent=(s.grillStage==='sideA'?'第一面':'第二面')+' · '+Math.floor(value)+'%　'+(value<65?'等指针进入绿色区':value<=85?'火候正好，点下方按钮':'火候偏老，尽快操作');
  }
  function updateLobby(){
    const guest=s.waitingGuest,line=$('lobbyWait');
    if(!guest){line.hidden=true;return;}
    const name=DinerGame.guests[guest.customer].name;
    const text=guest.seconds<DinerGame.queueWalkSeconds?name+'进店':name+'候位中';
    if(line.textContent!==text)line.textContent=text;
    line.hidden=false;
  }
  function advanceShift(seconds){
    const before=s.waitingGuest;
    game.tick(seconds);
    updateLobby();
    if(!before&&s.waitingGuest)sound?.play('door',null,s.station==='order'?.65:.36);
  }
  function waitClock(){
    const clock=$('waitClock'),visible=s.visit!=='arriving'&&['waiting','playing'].includes(s.phase);
    clock.hidden=!visible;
    if(!visible)return;
    const seconds=Math.floor(s.elapsed),late=s.elapsed>DinerGame.fullSpeedSeconds(s);
    const text=(late?'久候 ':'等候 ')+Math.floor(seconds/60)+':'+digits(seconds%60);
    if(clock.textContent!==text)clock.textContent=text;
    clock.classList.toggle('late',late);
  }
  function shiftTotals(){
    $('dayLabel').textContent='DAY '+digits(s.day);
    $('dayLabel').nextElementSibling.textContent=s.orderNo===s.daySize?'晚市营业':s.orderNo>1?'午后营业':'午市营业';
    $('orderCount').textContent=s.orderNo+' / '+s.daySize;
    $('tips').textContent=money(s.dayTips);
    $('best').textContent='最高评分 · '+(s.best?s.best+' 分':'—');
  }
  function render(){
    updateLobby();waitClock();
    if(ingredientDrag)resetIngredientDrag();
    const i=areas.indexOf(s.station);
    $('camLabel').textContent='CAM 0'+(i+1)+' / '+cams[i];
    shiftTotals();
    $('ticketNo').textContent='#'+digits(s.orderNo,3);$('statusStamp').textContent={waiting:'待接单',playing:'制作中',result:'已出餐',dayEnd:'已打烊'}[s.phase];
    const hasOrdered=s.phase!=='waiting'||s.visit==='ordering';
    const special=s.recipe.includes('smoke');
    $('ticketKind').textContent=hasOrdered&&special?'本店招牌':'顾客点单';
    if(s.visit==='arriving')$('statusStamp').textContent='入座中';
    if(s.visit==='carrying')$('statusStamp').textContent='待送餐';
    if(s.visit==='delivering')$('statusStamp').textContent='送餐中';
    $('dishTitle').textContent=hasOrdered?s.recipeName:'等候点单';$('guestName').textContent=s.table+' 号桌 · '+s.customerName;$('serial').textContent='BC–'+digits(s.day,3)+' / '+digits(s.orderNo,3);
    $('recipe').innerHTML=(hasOrdered?s.recipe:[]).map((id,j)=>'<li><small>'+digits(j+1)+'</small>'+foodIcon(id)+'<span>'+DinerGame.names[id]+'</span><span class="mark">'+(s.stack[j]===id?'✓':'')+'</span></li>').join('');
    Array.from($('stations').children).forEach((b,j)=>{b.disabled=(s.phase!=='playing'||['carrying','delivering'].includes(s.visit))&&s.station!==areas[j];b.classList.toggle('active',j===i);b.setAttribute('aria-pressed',String(j===i));});
    const assembly=s.station==='build'&&s.phase==='playing';
    $('buildTools').hidden=!assembly;$('dialogue').hidden=assembly;
    if(assembly)$('buildTools').innerHTML=products.filter(id=>id!=='smoke'||(s.smokeLaunchDay>0&&s.day>=s.smokeLaunchDay)).map(id=>{
      const locked=s.stack.at(-1)==='top'||s.stack.length>=12||(id==='bottom')!==!s.stack.length||(id==='patty'&&!s.hasPatty);
      return '<button class="ingredient" data-act="add" data-v="'+id+'" '+(locked?'disabled':'')+'>'+foodIcon(id)+DinerGame.names[id]+'</button>';
    }).join('');
    else if(s.station==='order'){
      const launchOrder=special&&s.day===s.smokeLaunchDay&&s.orderNo===1&&s.customer===0;
      const greeting=launchOrder?'我又来啦。老板，黑板上那款烟熏芝士堡，今天能点了吗？':guestLines[s.customer][0];
      const orderLine=launchOrder?'来一个烟熏芝士堡！刚出锅的肉饼配芝士，上面再淋一圈烟熏酱。':'你好！我想来一份'+s.recipeName+'。';
      $('dialogue').innerHTML=dialogLine(s.table+' 号桌 · '+s.customerName, s.visit==='arriving'?(s.queueEntryProgress!=null?'客人正从等位区走向 '+s.table+' 号桌。':'客人进门了，等入座后到桌边点单。'):s.visit==='seated'?greeting:s.visit==='ordering'?orderLine:s.visit==='carrying'?'餐点已备好。点餐厅中的 '+s.table+' 号桌送餐。':s.visit==='delivering'?'端稳餐盘，汉堡马上送到。':s.phase==='result'?'收到啦，谢谢主厨！':'我的汉堡，就拜托你啦。');
    }
    else if(s.station==='grill')$('dialogue').innerHTML=dialogLine('煎烤台',{empty:'把肉饼放上铁板，两面都要煎。',sideA:'第一面在煎，指针进入绿区就翻面。',sideB:'再煎另一面，进入绿区时出锅。',ready:'肉饼已备好，可以去组装台了。'}[s.grillStage]);
    stage?.update({...s,served:s.phase==='result'});
    actions();
    syncKitchenSound();
  }
  function closingCard(){
    const balance=DinerGame.availableTips(s),price=DinerGame.smokePrice;
    const summary='<div class="closing-ledger"><div class="modal-kicker">SHIFT COMPLETE</div><h2 id="modalTitle">今日打烊</h2>'+
      '<div class="grade-row"><span>完成订单</span><b>'+s.daySize+' 单</b></div>'+
      '<div class="grade-row"><span>今日小费</span><b>'+money(s.dayTips)+'</b></div>'+
      '<div class="grade-row"><span>累计小费</span><b>'+money(s.allTips)+'</b></div>'+
      '<div class="closing-balance"><span>可用小费</span><b>'+money(balance)+'</b></div></div>';
    let stock='';
    if(!s.smokeLaunchDay||s.smokeLaunchDay===s.day+1){
      const bought=Boolean(s.smokeLaunchDay);
      const description=bought?'第 '+s.smokeLaunchDay+' 天起供应烟熏芝士堡。':'进货一次，明天起供应烟熏芝士堡。';
      const action=bought?'<p class="stock-confirmation" role="status">✓ 已付 '+money(price)+' · 明日上架</p>':
        '<button type="button" class="stock-buy" data-act="buySmoke"'+(balance<price?' disabled':'')+'>花 '+money(price)+' 进货</button>'+
        (balance<price?'<small class="stock-shortfall">还差 '+money(price-balance)+'，攒够后可在打烊时进货。</small>':'');
      const stackPreview='<svg class="stock-burger" viewBox="0 0 42 41" fill="none" stroke="#604b32" stroke-width="1.15" stroke-linejoin="round" aria-hidden="true">'+
        '<g transform="translate(1 22)">'+drawings.bottom+'</g><g transform="translate(1 17)">'+drawings.patty+'</g>'+
        '<g transform="translate(1 15)">'+drawings.cheese+'</g><g transform="translate(1 11)">'+drawings.smoke+'</g>'+
        '<g transform="translate(1 0)">'+drawings.top+'</g></svg>';
      stock='<section class="night-stock" aria-labelledby="stockTitle">'+stackPreview+
        '<div class="stock-copy"><span class="stock-label">打烊进货</span><h3 id="stockTitle">烟熏酱</h3></div>'+
        '<p class="stock-description">'+description+'</p>'+action+'</section>';
    }
    return summary+stock+primary('next','第 '+(s.day+1)+' 天开店');
  }
  function showModal(mode){
    if(ingredientDrag)resetIngredientDrag();
    if(pendingServe){pendingServe=null;actions();}
    stage?.setPlacementPaused?.(mode==='pause'||mode==='confirm'||document.hidden);
    if(!modalMode)savedFocus=document.activeElement;
    modalMode=mode;let out='';
    if(mode==='pause')out='<div class="modal-kicker">Ⅱ &nbsp; SERVICE PAUSED</div><h2 id="modalTitle">营业暂停</h2><ol><li>等客人入座，到对应桌边点单。</li><li>煎肉时，两面指针都在绿区操作。</li><li>照小票从下往上叠好汉堡，再端回客人的桌边。</li></ol><div class="sound-setting"><label for="volumeSlider">音效音量</label><output id="volumeReadout" for="volumeSlider"></output><input type="range" id="volumeSlider" min="0" max="10" step="1"></div>'+primary('resume','继续营业')+'<button class="quiet" data-act="restartConfirm">本日重新开始</button>';
    if(mode==='confirm')out='<div class="modal-kicker">RESTART SHIFT</div><h2 id="modalTitle">重开今天？</h2><p>今天的订单和本日小费将重新计算。</p>'+primary('restart','重新开始')+'<button class="quiet" data-act="pause">返回</button>';
    if(mode==='result'){const q=s.score;out='<div class="modal-kicker">★ &nbsp; CUSTOMER REVIEW</div><h2 id="modalTitle">'+s.customerName+'的评价</h2><div class="result-number">'+q.total+' <small>/ 100</small></div><p>'+('“'+guestReview()+'”')+'</p>'+[['煎烤火候',q.cooking+' 分'],['配料顺序',q.build+' 分'],...(q.alignment===undefined?[]:[['叠放整齐',q.alignment+' 分']]),['上餐速度',q.pace+' 分'],['本单小费',money(q.tip)]].map(a=>'<div class="grade-row"><span>'+a[0]+'</span><b>'+a[1]+'</b></div>').join('')+primary('next',s.orderNo===s.daySize?'查看营业结算':s.waitingGuest?'请'+DinerGame.guests[s.waitingGuest.customer].name+'入座':'招呼下一位');}
    if(mode==='result'&&stage?.setShowcase)out+='<button class="quiet" data-act="replayShowcase">观看成品 360° 特写</button>';
    if(mode==='dayEnd')out=closingCard();
    $('modalCard').innerHTML=out;$('modal').hidden=false;
    if(mode==='pause')updateVolume();
    syncKitchenSound();
    $('modalCard').querySelector(mode==='dayEnd'?'[data-act="next"]':'button:enabled')?.focus({preventScroll:true});
  }
  function closeModal(){modalMode='';$('modal').hidden=true;lastFrame=0;syncKitchenSound();stage?.setPlacementPaused?.(document.hidden);savedFocus?.isConnected&&savedFocus.focus({preventScroll:true});}
  function run(act,v,offset){
    if(act==='takeControl'){requestControl();return;}
    if(surfaceLost||shiftLocked())return;
    sound?.unlock();
    if(showcase.open){if(act==='endShowcase')endShowcase();return;}
    if(act==='replayShowcase'){openShowcase(true);return;}
    if(act==='music'){window.DinerMusic?.open();return;}
    if(act==='pause'){showModal('pause');return;}
    if(act==='resume'){closeModal();sound?.play('tap');return;}
    if(act==='restartConfirm'){showModal('confirm');return;}
    if(act==='showResult'){showModal(s.phase);return;}
    if(act==='goGrill'||act==='goBuild'){v=act==='goGrill'?'grill':'build';act='station';}
    if(act==='serve'&&s.canServe&&stage?.isPlacing?.()){
      if(pendingServe)return;
      const request={};pendingServe=request;actions();
      stage.whenPlacementSettled().then(()=>{
        if(pendingServe!==request)return;
        pendingServe=null;
        if(s.canServe&&s.station==='build'&&!modalMode&&!document.hidden)run('serve');
        else actions();
      });
      return;
    }
    if(pendingServe){pendingServe=null;actions();}
    const priorGrill=s.grillStage;
    if(act==='deliver'){
      v=v??s.table;
      if(s.visit==='carrying'&&Number(v)!==s.table){
        $('dialogue').innerHTML=dialogLine('送餐小票','这是 '+v+' 号桌。这份'+s.recipeName+'是 '+s.table+' 号桌点的。');
        return;
      }
    }
    if(!game.act(act,v,offset))return;
    if(act==='buySmoke'){
      sound?.play('ticket',null,.66);
      showModal('dayEnd');
      return;
    }
    if(modalMode)closeModal();
    if(act==='grill'){
      if(priorGrill==='sideA'){stage?.finishGrillDrop?.(true);sound?.play('flip');}
      else if(priorGrill==='sideB'){
        sound?.play('lift');
        if(!stage?.setGrillPlateListener)sound?.play('plate',null,.28);
      }
      else if(stage?.startGrillDrop)stage.startGrillDrop();
      else sound?.play('drop');
    }
    else if(act==='add'){if(!stage?.setPlacementListener)sound?.play('ingredient',v);}
    else if(!['take','serve','deliver'].includes(act))sound?.play(({station:'station',undo:'undo',clear:'undo'})[act]||'tap');
    render();
    if(s.phase==='result'||s.phase==='dayEnd')showModal(s.phase);
  }
  document.addEventListener('click',e=>{const b=e.target.closest('[data-act]');if(b&&!b.disabled)run(b.dataset.act,b.dataset.v);});
  function sceneTarget(e){
    if(modalMode||showcase.open)return null;
    const hit=stage?.hit?.(e.clientX,e.clientY);
    if(hit?.act==='music')return hit;
    if(!hit||(hit.act==='take'?s.visit!=='seated':s.phase!=='playing'))return null;
    return hit;
  }
  $('stage').addEventListener('click',e=>{if(swallowClick){swallowClick=false;return;}const target=sceneTarget(e);if(target)run(target.act,target.v);});
  $('stage').addEventListener('pointermove',e=>{if(e.pointerType==='mouse')$('stage').style.cursor=sceneTarget(e)?'pointer':'';});
  $('diningMap')?.addEventListener('click',e=>{const b=e.target.closest('button[data-table]');if(b&&!b.disabled&&s.visit==='carrying')run('deliver',b.dataset.table);});
  $('pauseBtn').onclick=()=>run('pause');
  document.addEventListener('keydown',e=>{
    if(surfaceLost||shiftLocked()||showcase.open||modalMode==='guestbook'||modalMode==='music'||modalMode==='exterior')return;
    if(e.repeat)return;
    if(e.key==='Escape'){if(modalMode==='pause')closeModal();else if(!modalMode)showModal('pause');return;}
    if(modalMode){if(e.key==='Tab'){const buttons=[...$('modalCard').querySelectorAll('button:enabled,input:enabled')];if(document.activeElement===buttons[e.shiftKey?0:buttons.length-1]){e.preventDefault();buttons[e.shiftKey?buttons.length-1:0].focus();}}return;}
    if('123'.includes(e.key)&&e.key.length===1)run('station',areas[Number(e.key)-1]);
  });
  document.addEventListener('visibilitychange',()=>{lastFrame=0;showcaseFrame=null;if(!shiftLocked()&&document.hidden&&s.phase==='playing'&&!modalMode)showModal('pause');syncKitchenSound();});
  function enterOverlay(mode){
    if(shiftLocked()||modalMode||showcase.open)return false;
    if(ingredientDrag)resetIngredientDrag();
    if(pendingServe){pendingServe=null;actions();}
    modalMode=mode;stage?.setPlacementPaused?.(true);lastFrame=0;syncKitchenSound();return true;
  }
  function leaveOverlay(mode){
    if(modalMode!==mode)return;
    modalMode='';lastFrame=0;stage?.setPlacementPaused?.(document.hidden);syncKitchenSound();
    if(document.hidden&&s.phase==='playing')showModal('pause');
  }
  $('streetViewBtn').onclick=()=>{
    if(!enterOverlay('exterior'))return;
    stage?.update({...s,served:s.phase==='result'});
    if(!window.DinerStorefront?.open(stage?.getBuildingParts?.()))leaveOverlay('exterior');
  };
  window.addEventListener('diner-exterior-close',()=>leaveOverlay('exterior'));
  $('guestBookBtn').addEventListener('click',()=>{
    if(enterOverlay('guestbook')&&!window.DinerGuestBook?.open(s.customer))leaveOverlay('guestbook');
  });
  window.addEventListener('diner-book-close',()=>leaveOverlay('guestbook'));
  window.addEventListener('diner-music-open',()=>enterOverlay('music'));
  window.addEventListener('diner-music-close',()=>leaveOverlay('music'));
  function tick(t){
    if(surfaceLost||shiftLocked()){lastFrame=0;return requestAnimationFrame(tick);}
    if(showcase.open)advanceShowcase(t);
    if(!modalMode&&!document.hidden&&(s.phase==='waiting'||s.phase==='playing')){
      const delta=lastFrame?Math.min((t-lastFrame)/1000,1):0;
      const before=s.visit;
      if(['arriving','ordering','delivering'].includes(before)){
        const from=s.visitProgress;
        advanceShift(delta);
        const to=before===s.visit?s.visitProgress:1;
        if(before==='arriving'&&s.queueEntryProgress==null&&from<.07&&to>=.07)sound?.play('door');
        if(before==='ordering'){
          if(from<.90&&to>=.90)sound?.play('ticket',null,.84,{table:s.table});
          else if([.21,.465,.71].some(beat=>from<beat&&to>=beat))sound?.play('pencil',null,.90,{table:s.table});
        }
        const beats=before==='arriving'?[.16,.30,.44,.58,.72]:before==='delivering'?[.13,.33,.51]:[];
        if(beats.some(beat=>from<beat&&to>=beat))sound?.play('step');
        if(before==='delivering'&&from<.91&&to>=.91)sound?.play('table',null,1,{table:s.table});
        if(before!==s.visit){
          render();
          if(s.phase==='result'){
            if(!openShowcase())showModal('result');
          }
        }else stage?.update({...s,served:false});
        acc=0;
      }else if(s.phase==='playing'||s.visit==='seated'||s.previousDiner){
        acc+=delta;
        if(acc>=.08){
          const hadDiner=!!s.previousDiner;
          const hadQueue=!!s.waitingGuest;
          advanceShift(acc);acc=0;heat();waitClock();
          if(s.station==='order')syncDiningSound();
          if(s.station==='grill')syncKitchenSound();
          if(s.station==='grill'||s.station==='order'&&(hadDiner||hadQueue||s.waitingGuest))stage?.update({...s,served:false});
        }
      }
    }else acc=0;
    lastFrame=t;requestAnimationFrame(tick);
  }
  const control=$('shiftControl'),controlButton=control.querySelector('button');
  let lastMode=null,claiming=false;
  control.addEventListener('cancel',event=>event.preventDefault());
  async function requestControl(){
    if(!session||claiming||session.mode!=='observer')return;
    claiming=true;controlButton.disabled=true;controlButton.textContent='正在接续…';
    let acquired=false;
    try{acquired=await session.takeControl();}
    catch{acquired=false;}
    finally{
      claiming=false;controlButton.disabled=false;controlButton.textContent='在这里继续营业';
      if(!acquired&&control.open)$('shiftControlHint').textContent='接续尚未完成。可以重试，或回到原窗口继续营业。';
    }
  }
  function syncSession(mode){
    mode=mode||'owner';
    if(mode==='observer'){
      shiftTotals();
      const text='第 '+s.day+' 天 · 第 '+s.orderNo+' 单　今日小费 '+money(s.dayTips);
      if($('shiftControlOrder').textContent!==text)$('shiftControlOrder').textContent=text;
    }
    if(lastMode===mode)return;
    const previousMode=lastMode;lastMode=mode;
    document.body.dataset.shiftSession=mode;
    $('sessionLocal').hidden=mode!=='memory';
    lastFrame=0;acc=0;showcaseFrame=null;
    if(mode==='observer'||mode==='opening'){
      pendingServe=null;if(ingredientDrag)resetIngredientDrag();if(showcase.open)endShowcase(true);
      for(const panel of document.querySelectorAll('dialog[open]'))if(panel!==control)panel.close();
      modalMode='';$('modal').hidden=true;
      stage?.setPlacementPaused?.(true);syncKitchenSound();
      if(mode==='observer'&&!control.open){
        $('shiftControlHint').textContent='可以切回原窗口，或在这里接续同一份订单和小费。';
        control.showModal();
      }
      return;
    }
    if(control.open)control.close();
    if(surfaceLost){if(!recovery.open)recovery.showModal();return;}
    stage?.setPlacementPaused?.(document.hidden);
    render();
    if(s.phase==='result'||s.phase==='dayEnd')showModal(s.phase);
    else if(document.hidden&&s.phase==='playing')showModal('pause');
    else if(previousMode==='observer')$('actionArea').querySelector('button:enabled')?.focus({preventScroll:true});
  }
  const recovery=$('surfaceRecovery');
  recovery.addEventListener('cancel',e=>e.preventDefault());
  $('reopenShift').onclick=()=>location.reload();
  $('stage').addEventListener('diner-surface-lost',()=>{
    surfaceLost=true;lastFrame=0;acc=0;showcaseFrame=null;pendingServe=null;
    if(ingredientDrag)resetIngredientDrag();
    stage?.setPlacementPaused?.(true);syncKitchenSound();
    clearTimeout(recoveryTimer);$('reopenShift').hidden=true;
    if(!shiftLocked()&&!recovery.open)recovery.showModal();
    recoveryTimer=setTimeout(()=>{$('reopenShift').hidden=session?.mode==='memory';},8000);
  });
  $('stage').addEventListener('diner-surface-restored',()=>{
    surfaceLost=false;lastFrame=0;showcaseFrame=null;clearTimeout(recoveryTimer);
    if(recovery.open)recovery.close();
    if(!shiftLocked()&&!modalMode&&!showcase.open){
      render();showModal(s.phase==='result'||s.phase==='dayEnd'?s.phase:'pause');
    }else{stage?.setPlacementPaused?.(shiftLocked()||!!modalMode||document.hidden);syncKitchenSound();}
  });
  session?.subscribe(syncSession);syncSession(session?.mode);requestAnimationFrame(tick);
})();
