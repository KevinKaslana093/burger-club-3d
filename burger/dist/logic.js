(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DinerGame = api;
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";
  const names = Object.freeze({
    bottom: "底层面包", patty: "牛肉饼", cheese: "芝士", lettuce: "生菜",
    tomato: "番茄", pickle: "酸黄瓜", onion: "洋葱", smoke: "烟熏酱", top: "芝麻顶包"
  });
  const menu = [
    ["经典芝士堡", "cheese"],
    ["田园鲜蔬堡", "lettuce", "tomato"],
    ["双料酸黄瓜堡", "cheese", "pickle"],
    ["加州招牌堡", "cheese", "tomato", "lettuce"],
    ["洋葱芝士堡", "onion", "cheese"],
    ["红绿脆脆堡", "pickle", "tomato", "lettuce"],
    ["日落特制堡", "cheese", "onion", "pickle", "lettuce"],
    ["农夫鲜蔬堡", "lettuce", "onion", "tomato"],
    ["公路巨无霸", "cheese", "pickle", "tomato", "onion", "lettuce"]
  ];
  const guests = [
    ["阿乐","街舞社成员","排练散场后，她总会带一份热芝士堡回去。", "#435d71"],
    ["米娅","设计系学生","她喜欢靠窗的位置，画完速写才开始吃。", "#a6674e"],
    ["小满","滑板爱好者","练成一个新动作，就来店里给自己加一片芝士。", "#537a76"],
    ["阿哲","插画师","等餐的工夫，足够他在小票背面画一张速写。", "#906373"],
    ["露露","舞蹈老师","下了晚课，她喜欢在柜台边跟主厨聊两句。", "#a76649"],
    ["老麦","木匠","午休只有半个钟头，他总把第一口留给焦香的肉饼。", "#6c7954"],
    ["可可","学生","每次来，她都要数一数顶包上有多少粒芝麻。", "#6c809a"],
    ["南希","针织店老板","隔壁新到的毛线，往往比当季菜单更早被她带来。", "#996853"],
    ["阿宽","乐手","演出前吃一只汉堡，是他多年的习惯。", "#76657e"],
    ["林舟","街头摄影师","午后的暖光照进店门时，他会把相机放上柜台。", "#57788c"],
    ["桔子","单车信使","一趟单送完，她最惦记的是热乎的第一口。", "#9e653b"],
    ["苏禾","花艺师","收工时顺路吃晚饭，有时还带来一枝当天的花。", "#718569"],
    ["岑叔","唱片店主","他记得每一张老唱片，也记得第一次来吃的那份汉堡。", "#826957"]
  ].map(([name,role,note,color])=>Object.freeze({name,role,note,color}));
  Object.freeze(guests);
  const guestRotation = [0,1,2,9,3,10,4,5,11,6,7,12,8];
  const smokePrice = 12;
  const smokeSpecial = ["烟熏芝士堡", "cheese", "smoke"];
  function availableTips(s) {
    return s.allTips - (s.smokeLaunchDay ? smokePrice : 0);
  }
  const saveKey = "burger-club.shift.v1";
  const stations = ["order", "grill", "build"];
  const stages = ["empty", "sideA", "sideB", "ready"];
  const phases = ["waiting", "playing", "result", "dayEnd"];
  const bounded = (n, low, high) => Math.min(high, Math.max(low, n));
  const numberIn = (n, min, max) => Number.isFinite(n) && n >= min && n <= max;
  const integerIn = (n, min, max) => Number.isSafeInteger(n) && numberIn(n, min, max);
  const knownFood = food => typeof food === "string" && Object.hasOwn(names, food);
  const daySize = day => Math.min(5, day + 2);
  const visitTimes = Object.freeze({arriving: 4.8, ordering: 2.8, delivering: 3.6});
  const queueWalkSeconds = 2.4;
  // Restaurant time advances with the current shift. Customers vary slightly
  // in pace; leaving the day or restarting clears every table.
  function mealTimes(diner){
    const cycle=8.7+(diner.customer%5)*.54;
    const done=4+cycle*6;
    const leave=Math.min(done+15.0+(diner.customer%3)*1.3,diner.leaveAt??Infinity);
    return {cycle,done,leave,exit:leave+6.5,clear:leave+8.6};
  }
  function order(day, orderNo, savedGuest, smokeLaunchDay = 0) {
    const previousOrders=day===1?0:day===2?3:7+5*(day-3);
    const firstSpecial = day === smokeLaunchDay && orderNo === 1;
    const scheduled = firstSpecial ? 0 : guestRotation[(previousOrders+orderNo-1)%guestRotation.length];
    const customer = Number.isInteger(savedGuest) && guests[savedGuest] ? savedGuest : scheduled;
    const menuIndex = day === 1 ? orderNo - 1 : (day * 5 + orderNo * 2 - 6) % menu.length;
    const wantsSpecial = smokeLaunchDay > 0 && day >= smokeLaunchDay && customer === 0;
    const [recipeName, ...toppings] = wantsSpecial ? smokeSpecial : menu[menuIndex];
    return {
      day, orderNo, daySize: daySize(day), smokeLaunchDay, customer, customerName: guests[customer].name,
      recipeName, recipe: ["bottom", "patty", ...toppings, "top"], stack: [], stackOffsets: [],
      previousDiners: [], table: 1 + (previousOrders + orderNo - 1) % 4, visit: "arriving", visitProgress: 0,
      nextGuestIn: orderNo < daySize(day) ? 8 + (day + orderNo * 2) % 5 : null,
      waitingGuest: null, queueEntryProgress: null,
      station: "order", phase: "waiting", grillStage: "empty",
      heatA: 0, heatB: 0, elapsed: 0, hasPatty: false, canServe: false,
      cookedQuality: null, platedQuality: null, cookedFaces: null, platedFaces: null, score: null
    };
  }
  function nextGuestOrder(s) {
    const next=order(s.day,s.orderNo+1,s.waitingGuest?.customer,s.smokeLaunchDay);
    // Older saves can carry a guest chosen outside the normal rotation. Give
    // each person one place in the room even when resuming one of those days.
    const occupied=new Set([s.customer,...s.previousDiners.map(d=>d.customer)]);
    if(!occupied.has(next.customer))return next;
    const start=guestRotation.indexOf(next.customer);
    for(let i=1;i<guestRotation.length;i++){
      const id=guestRotation[(start+i)%guestRotation.length];
      if(!occupied.has(id))return order(s.day,s.orderNo+1,id,s.smokeLaunchDay);
    }
    return next;
  }
  function advanceQueue(s,seconds) {
    if(s.phase!=='playing'||s.orderNo===s.daySize||seconds<=0)return;
    if(s.waitingGuest){
      s.waitingGuest.seconds=Math.min(1e8,s.waitingGuest.seconds+seconds);
      return;
    }
    if(seconds<s.nextGuestIn){s.nextGuestIn-=seconds;return;}
    const next=nextGuestOrder(s);
    s.waitingGuest={day:next.day,orderNo:next.orderNo,customer:next.customer,seconds:Math.min(1e8,seconds-s.nextGuestIn)};
    s.nextGuestIn=0;
  }
  function refresh(s) {
    s.hasPatty = s.cookedQuality !== null && !s.stack.includes("patty");
    s.canServe = s.phase === "playing" && s.visit === "dining" && s.stack[0] === "bottom" &&
      s.stack.includes("patty") && s.stack.at(-1) === "top";
  }
  // Distance measures both side doneness and the cost of leaving one face raw.
  function sideQuality(heat) {
    const miss = Math.max(65 - heat, heat - 85, 0);
    return Math.round(bounded(100 - miss * (heat < 65 ? 1.55 : 4), 0, 100));
  }
  function cookingScore(a, b) {
    const lo = Math.min(sideQuality(a), sideQuality(b));
    const hi = Math.max(sideQuality(a), sideQuality(b));
    return Math.round(lo * 0.6 + hi * 0.4);
  }
  // Longest common subsequence gives partial credit for ingredients in order.
  function buildScore(actual, expected) {
    const row = Array(expected.length + 1).fill(0);
    for (const item of actual) {
      let previous = 0;
      for (let i = 1; i <= expected.length; i++) {
        const above = row[i];
        row[i] = item === expected[i - 1] ? previous + 1 : Math.max(above, row[i - 1]);
        previous = above;
      }
    }
    return Math.round(100 * row[expected.length] / Math.max(actual.length, expected.length));
  }
  const maxLayerOffset = .22, centeredRadius = .045;
  function layerOffset(food, value) {
    if (food === "bottom" || !value) return [0, 0];
    const [x, z] = Array.isArray(value) ? value : [value.x, value.z];
    if (!Number.isFinite(x) || !Number.isFinite(z)) return [0, 0];
    if (Math.hypot(x, z) <= maxLayerOffset) return [x || 0, z || 0];
    // Normalize first so even finite coordinates near Number.MAX_VALUE have a direction.
    const scale = Math.max(Math.abs(x), Math.abs(z)), dx = x / scale, dz = z / scale;
    const length = Math.hypot(dx, dz);
    return [maxLayerOffset * dx / length, maxLayerOffset * dz / length];
  }
  function copyLayerOffsets(stack, offsets) {
    return stack.map((food, i) => layerOffset(food, offsets?.[i]));
  }
  function alignmentScore(stack, offsets) {
    let sum = 0, worst = 0, count = 0;
    for (let i = 0; i < stack.length; i++) {
      if (stack[i] === "bottom") continue;
      const [x, z] = offsets[i];
      const penalty = bounded((Math.hypot(x, z) - centeredRadius) / (maxLayerOffset - centeredRadius), 0, 1);
      sum += penalty;
      worst = Math.max(worst, penalty);
      count++;
    }
    return count ? Math.round(100 * (1 - .7 * sum / count - .3 * worst)) : 100;
  }
  function fullSpeedSeconds(state) { return 42 + state.recipe.length * 2; }
  function validScore(score) {
    return score && ["total", "cooking", "build", "pace"].every(k => integerIn(score[k], 0, 100)) &&
      (score.alignment === undefined || integerIn(score.alignment, 0, 100)) &&
      integerIn(score.tip, 0, 10);
  }
  function validSave(raw) {
    if (!raw || raw.v !== 1) return false;
    const s = raw.state;
    if (!s || !integerIn(s.day, 1, 1e8) || !integerIn(s.orderNo, 1, daySize(s.day))) return false;
    if (!stations.includes(s.station) || !stages.includes(s.grillStage) || !phases.includes(s.phase)) return false;
    if (!Array.isArray(s.stack) || s.stack.length > 12 || !s.stack.every(knownFood)) return false;
    if (s.cookedQuality !== null && !integerIn(s.cookedQuality, 0, 100)) return false;
    if (s.stack.includes("patty") && s.cookedQuality === null) return false;
    if (![s.heatA, s.heatB].every(n => numberIn(n, 0, 100)) || !numberIn(s.elapsed, 0, 1e8)) return false;
    if (![s.dayTips, s.allTips, s.daysCompleted].every(n => integerIn(n, 0, 1e10))) return false;
    if (s.dayTips > s.allTips || !integerIn(s.best, 0, 100)) return false;
    const launch = s.smokeLaunchDay === undefined ? 0 : s.smokeLaunchDay;
    if (launch !== 0) {
      if (!integerIn(launch, 2, s.day + 1)) return false;
      const justBought = launch === s.day + 1;
      if (justBought && s.phase !== "dayEnd") return false;
      if (s.allTips - (justBought ? 0 : s.dayTips) < smokePrice) return false;
    }
    if (s.stack.includes("smoke") && (!launch || s.day < launch)) return false;
    if (s.phase === "dayEnd" && s.orderNo !== daySize(s.day)) return false;
    return s.phase === "result" || s.phase === "dayEnd" ? validScore(s.score) : s.score === null;
  }
  function defaultStorage() {
    try { return globalThis.localStorage; } catch (_) { return null; }
  }
  const writerLock=saveKey+'.writer',memoryPeers=new WeakMap();
  function identity(){
    if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();
    return Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)+'-'+Math.random().toString(36).slice(2);
  }
  async function browserMutex(preferred){
    const locks=globalThis.navigator?.locks;
    if(preferred!=='idb'&&locks?.request){
      try{
        await locks.request(writerLock,()=>{});
        return {kind:'locks',run:job=>locks.request(writerLock,job)};
      }catch{/* A restricted document may still have transactional storage. */}
    }
    if(!globalThis.indexedDB)throw Error('No origin mutex');
    const db=await new Promise((resolve,reject)=>{
      const req=globalThis.indexedDB.open('burger-club.coordination.v1',1);
      req.onupgradeneeded=()=>req.result.createObjectStore('mutex');
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
      req.onblocked=()=>reject(Error('Coordination store blocked'));
    });
    db.onversionchange=()=>db.close();
    return {kind:'idb',dispose:()=>db.close(),run:job=>new Promise((resolve,reject)=>{
      // The read is deliberately inside a readwrite transaction. IndexedDB
      // does not run two such transactions on this store at the same time.
      const tx=db.transaction('mutex','readwrite'),req=tx.objectStore('mutex').get(writerLock);
      let result,error;
      req.onsuccess=()=>{try{result=job();}catch(e){error=e;tx.abort();}};
      tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(error||tx.error||Error('Storage transaction aborted'));
    })};
  }
  function sessionFor(storage,explicit,coordinated,restore,snapshot){
    const callbacks=new Set(),localId=identity(),lease=90000;
    let mode='opening',token='',serial=0,last=null,runner=null,peers=null,closed=false,timer=null;
    let resumeToken=null,returningTab=null,watching=false;
    const notify=()=>{for(const fn of [...callbacks])fn(mode);};
    function modeIs(next,changed=false){const old=mode;mode=next;if(old!==next||changed)notify();}
    function localOnly(){if(!closed)modeIs('memory');return false;}
    function raw(){return storage.getItem(saveKey)??null;}
    function parse(text){try{return text?JSON.parse(text):null;}catch{return null;}}
    function current(text){const r=parse(text);return validSave(r)?r:null;}
    function transact(job){
      try{const value=runner.run(job);return value?.then?value.catch(localOnly):value;}
      catch{return localOnly();}
    }
    function emit(){
      if(peers)for(const peer of [...peers])if(peer!==observe)peer();
    }
    const draftKey=id=>writerLock+'.'+id;
    function discardRetired(id){
      // Tokens never repeat, even when the same window takes over twice.
      // Clean precisely the old private slot once the canonical snapshot no
      // longer names it. Never scan or remove another active tenure's keys.
      if(!id)return;
      try{if(current(raw())?.writer?.token!==id)storage.removeItem?.(draftKey(id));}catch{}
    }
    function draft(data){
      if(!data?.writer?.token)return null;
      const proposed=current(storage.getItem(draftKey(data.writer.token)));
      return proposed&&Number.isSafeInteger(proposed.step)&&proposed.step>data.writer.step?proposed:null;
    }
    function unpack(text){last=text;restore(current(text));}
    function observe(){
      if(closed||mode==='memory'||!runner)return;
      let text;try{text=raw();}catch{localOnly();return;}
      if(text===last)return;
      const data=current(text),owner=data?.writer;
      if(mode==='owner'&&owner?.token===token){last=text;return;}
      if(mode==='owner')discardRetired(token);
      unpack(text);modeIs('observer',true);
      if(!owner?.token||owner.until<=Date.now())claim(false);
    }
    function record(body,owner,step){
      const data={...body,writer:{token:owner,step,until:owner?Date.now()+lease:0,via:runner.kind}};
      if(returningTab&&returningTab.until>Date.now())data.writer.returning=returningTab;
      const text=JSON.stringify(data);storage.setItem(saveKey,text);last=text;
    }
    function claim(force){
      if(closed||!runner)return false;
      return transact(()=>{
        if(closed)return false;
        const text=raw(),data=current(text),existing=data?.writer,latest=draft(data);
        // A document with a different storage policy cannot share the same
        // mutex. Never update a journal claimed through that other backend.
        if(existing?.via&&existing.via!==runner.kind){unpack(text);return localOnly();}
        if(mode==='owner'&&existing?.token===token)return true;
        const previous=existing?.returning;
        const returning=resumeToken&&previous?.token===resumeToken&&previous.until>Date.now()&&!latest?.returnCancelled;
        if(!force&&!returning&&existing?.token&&existing.token!==resumeToken&&!latest?.released&&existing.until>Date.now()){
          const changed=last!==text;unpack(text);modeIs('observer',changed);return false;
        }
        // Both closing and reloading trigger pagehide. Let a reloaded tab
        // resume through one automatic handoff, until the new player acts.
        returningTab=null;
        if(!force&&!returning&&existing?.token!==resumeToken){
          if(latest?.released)returningTab={token:existing.token,until:Date.now()+15000};
          else if(!existing?.token)returningTab=previous;
        }
        last=text;restore(latest||data);token=localId+':'+identity();serial=0;resumeToken=null;
        record(snapshot(),token,serial);modeIs('owner');emit();
        discardRetired(existing?.token);
        if(!explicit)try{globalThis.sessionStorage.setItem(writerLock,token);}catch{}
        return true;
      });
    }
    function commit(playerAction=false){
      if(mode!=='owner'||closed)return;
      if(playerAction)returningTab=null;
      if(explicit&&!coordinated){
        try{if(raw()!==last){unpack(raw());modeIs('observer',true);return;}
          const text=JSON.stringify(snapshot());storage.setItem(saveKey,text);last=text;
        }catch{localOnly();}
        return;
      }
      const expected=token,step=++serial;
      // Snapshot at the moment the action succeeds. A later transaction from
      // an old owner must never publish it, even if storage events were delayed.
      // Requests from two documents can reach the native mutex out of order.
      // Publish the accepted action in this tenure's private staging slot
      // before returning. A takeover folds in that slot under the mutex.
      const body={...snapshot(),step,returnCancelled:!returningTab};
      try{storage.setItem(draftKey(expected),JSON.stringify(body));}catch{localOnly();return;}
      transact(()=>{
        const text=raw(),data=current(text),owner=data?.writer;
        if(closed||mode!=='owner'||expected!==token)return;
        if(owner?.token!==expected||owner.via!==runner.kind){observe();return;}
        const latest=draft(data);
        if(!latest)return;
        record({v:1,state:latest.state},expected,latest.step);emit();
      });
    }
    function writable(){
      if(closed||mode==='opening'||mode==='observer')return false;
      if(mode==='memory')return true;
      try{
        const text=raw();
        if(text!==last){
          if(explicit&&!coordinated){unpack(text);modeIs('observer',true);}
          else observe();
        }
      }catch{localOnly();}
      return mode==='owner'||mode==='memory';
    }
    function handleStorage(e){
      if(e.key===saveKey||e.key===null)observe();
      else if(mode==='observer'&&e.key?.startsWith(writerLock+'.')&&e.newValue?.startsWith('{"released":true,'))claim(false);
    }
    function watch(){
      if(watching)return;watching=true;
      globalThis.addEventListener('storage',handleStorage);
      timer=globalThis.setInterval(()=>{
        if(closed||mode==='memory')return;
        try{
          observe();const writer=current(raw())?.writer;
          if(mode==='observer'&&(!writer?.token||writer.until<=Date.now()))claim(false);
          else if(mode==='owner'&&writer?.until<Date.now()+lease/2)commit();
        }catch{localOnly();}
      },5000);
    }
    function close(){
      if(closed)return Promise.resolve();
      const wasOwner=mode==='owner',expected=token,body=wasOwner?snapshot():null;
      if(wasOwner&&runner){
        // pagehide may terminate the document before it can run another
        // asynchronous lock callback. This notice belongs only to our tenure.
        try{
          if(current(raw())?.writer?.token===expected)
            storage.setItem(draftKey(expected),JSON.stringify({released:true,...body,step:++serial}));
          discardRetired(expected);
        }catch{}
      }
      closed=true;if(peers)peers.delete(observe);
      if(timer)globalThis.clearInterval(timer);
      if(watching){globalThis.removeEventListener('storage',handleStorage);watching=false;}
      if(!explicit)globalThis.removeEventListener('pagehide',pageHide);
      modeIs('observer');
      const release=wasOwner&&runner?transact(()=>{
        const data=current(raw());
        if(data?.writer?.token!==expected||data.writer.via!==runner.kind){discardRetired(expected);return;}
        returningTab={token:expected,until:Date.now()+15000};
        record(body,'',0);discardRetired(expected);emit();
      }):null;
      return Promise.resolve(release).finally(()=>runner?.dispose?.());
    }
    function pageHide(e){
      close();
      if(e.persisted)globalThis.addEventListener('pageshow',()=>globalThis.location.reload(),{once:true});
    }
    const api={
      get mode(){return mode;},
      subscribe(fn){callbacks.add(fn);return ()=>callbacks.delete(fn);},
      takeControl(){
        if(closed)return Promise.resolve(false);
        if(mode==='memory')return Promise.resolve(true);
        if(explicit&&!coordinated){try{unpack(raw());modeIs('owner');return Promise.resolve(true);}catch{return Promise.resolve(localOnly());}}
        return Promise.resolve(claim(true));
      },close
    };
    if(!storage){mode='memory';return {api,commit,writable};}
    try{unpack(raw());}catch{mode='memory';return {api,commit,writable};}
    if(explicit){
      if(!coordinated)mode='owner';
      else{
        peers=memoryPeers.get(storage);if(!peers){peers=new Set();memoryPeers.set(storage,peers);}
        peers.add(observe);runner={kind:'realm',run:job=>job()};claim(false);
      }
    }else{
      try{
        if(globalThis.performance?.getEntriesByType('navigation')[0]?.type==='reload')
          resumeToken=globalThis.sessionStorage.getItem(writerLock);
        // A duplicated tab may inherit its opener's sessionStorage. Never
        // retain that token merely by observing another window's shift.
        globalThis.sessionStorage.removeItem(writerLock);
      }catch{}
      globalThis.addEventListener('pagehide',pageHide);
      browserMutex(current(last)?.writer?.via).then(r=>{
        if(closed){r.dispose?.();return;}
        runner=r;watch();claim(false);
      },localOnly);
    }
    return {api,commit,writable};
  }
  function create(options) {
    const storage = options && "storage" in options ? options.storage : defaultStorage();
    const state = Object.assign(order(1, 1), {dayTips: 0, allTips: 0, best: 0, daysCompleted: 0});
    Object.defineProperty(state,'previousDiner',{get(){return this.previousDiners.at(-1)??null;}});
    let sinceSave = 0;
    function restore(raw) {
      Object.assign(state,order(1,1),{dayTips:0,allTips:0,best:0,daysCompleted:0});sinceSave=0;
      if (validSave(raw)) {
        const s = raw.state;
        Object.assign(state, order(s.day, s.orderNo, s.customer, s.smokeLaunchDay));
        for (const key of ["station", "phase", "grillStage", "heatA", "heatB", "elapsed",
          "cookedQuality", "stack", "score", "dayTips", "allTips", "best", "daysCompleted"]) {
          state[key] = s[key];
        }
        state.stackOffsets = copyLayerOffsets(state.stack, s.stackOffsets);
        const hasPlatedPatty=state.stack.includes('patty');
        state.platedQuality=hasPlatedPatty?(integerIn(s.platedQuality,0,100)?s.platedQuality:s.cookedQuality):null;
        for(const key of ['cookedFaces','platedFaces']){
          if(Array.isArray(s[key])&&s[key].length===2&&s[key].every(heat=>numberIn(heat,0,100)))state[key]=s[key].slice();
        }
        const legacy=!Array.isArray(s.previousDiners),claimed=new Set([state.table]);
        const saved=legacy?[s.previousDiner]:s.previousDiners;
        for(let i=saved.length-1;i>=0&&state.previousDiners.length<3;i--){
          const d=saved[i];
          if(!d||!integerIn(d.customer,0,guests.length-1)||!integerIn(d.table,1,4)||claimed.has(d.table)||
              !Number.isFinite(d.seconds)||d.seconds<0||!Array.isArray(d.stack)||!d.stack.length||
              d.stack.length>12||!d.stack.every(knownFood))continue;
          const diner={customer:d.customer,table:d.table,stack:d.stack.slice(),stackOffsets:copyLayerOffsets(d.stack,d.stackOffsets),seconds:d.seconds};
          if(numberIn(d.leaveAt,0,160))diner.leaveAt=d.leaveAt;
          if(Array.isArray(d.platedFaces)&&d.platedFaces.length===2&&d.platedFaces.every(h=>numberIn(h,0,100)))diner.platedFaces=d.platedFaces.slice();
          if(legacy){
            if(d.seconds>=48)continue;
            const clock=mealTimes(diner);
            diner.seconds=d.seconds<41.5?d.seconds*clock.leave/41.5:clock.leave+(d.seconds-41.5);
          }
          if(diner.seconds>=mealTimes(diner).clear)continue;
          claimed.add(diner.table);state.previousDiners.unshift(diner);
        }
        const allowed = s.phase === "waiting" ? ["arriving", "seated", "ordering"] : s.phase === "playing" ? ["dining", "carrying", "delivering"] : ["dining"];
        state.visit = allowed.includes(s.visit) ? s.visit : s.phase === "waiting" ? "seated" : "dining";
        state.visitProgress = numberIn(s.visitProgress, 0, 1) ? s.visitProgress : 0;
        if(state.visit==='arriving'&&numberIn(s.queueEntryProgress,0,1))
          state.queueEntryProgress=s.queueEntryProgress;
        if(state.nextGuestIn!==null&&['playing','result'].includes(state.phase)){
          const guest=s.waitingGuest;
          if(guest?.day===state.day&&guest.orderNo===state.orderNo+1&&integerIn(guest.customer,0,guests.length-1)&&
             guest.customer!==state.customer&&!state.previousDiners.some(d=>d.customer===guest.customer)&&
             numberIn(guest.seconds,0,1e8)){
            state.waitingGuest={day:state.day,orderNo:guest.orderNo,customer:guest.customer,seconds:guest.seconds};
            state.nextGuestIn=0;
          }else if(numberIn(s.nextGuestIn,0,state.nextGuestIn))state.nextGuestIn=s.nextGuestIn;
        }
        if (["carrying","delivering"].includes(state.visit)) state.station = "order";
        refresh(state);
      }
    }
    const session=sessionFor(storage,!!options&&'storage' in options&&storage!==defaultStorage(),
      !!options?.coordinated,restore,()=>({v:1,state}));
    function save(playerAction=false) {
      sinceSave = 0;
      session.commit(playerAction);
    }
    function grill() {
      switch (state.grillStage) {
        case "empty":
        case "ready":
          state.grillStage = "sideA";
          state.heatA = state.heatB = 0;
          break;
        case "sideA":
          state.grillStage = "sideB";
          break;
        case "sideB":
          state.cookedQuality = cookingScore(state.heatA, state.heatB);
          state.cookedFaces = [state.heatA,state.heatB];
          state.grillStage = "ready";
          state.station = "build";
          if (!state.stack.length) {
            state.stack.push("bottom");
            state.stackOffsets.push([0, 0]);
          }
          break;
      }
    }
    function add(food, offset) {
      if (!knownFood(food) || state.stack.length >= 12 || state.stack.at(-1) === "top") return false;
      if (food === "smoke" && (!state.smokeLaunchDay || state.day < state.smokeLaunchDay)) return false;
      if (!state.stack.length && food !== "bottom") return false;
      if (state.stack.length && food === "bottom") return false;
      if (food === "patty" && !state.hasPatty) return false;
      if(food==='patty'){
        state.platedQuality=state.cookedQuality;
        state.platedFaces=state.cookedFaces?.slice()??null;
      }
      state.stack.push(food);
      state.stackOffsets.push(layerOffset(food, offset));
      return true;
    }
    function serve() {
      const cooking = state.platedQuality ?? state.cookedQuality;
      const build = buildScore(state.stack, state.recipe);
      const alignment = alignmentScore(state.stack, state.stackOffsets);
      const pace = Math.round(bounded(100 - Math.max(state.elapsed - fullSpeedSeconds(state), 0) * 0.8, 0, 100));
      const total = Math.round((build * 40 + cooking * 25 + alignment * 20 + pace * 15) / 100);
      const tip = Math.round(10 * Math.pow(total / 100, 3));
      state.score = {total, cooking, build, alignment, pace, tip};
      state.best = Math.max(state.best, total);
      state.dayTips += tip;
      state.allTips += tip;
      state.phase = "result";
      state.station = "order";
    }
    function next() {
      if (state.phase === "dayEnd") {
        Object.assign(state, order(state.day + 1, 1, undefined, state.smokeLaunchDay), {dayTips: 0});
      } else if (state.phase === "result" && state.orderNo === state.daySize) {
        state.daysCompleted = Math.max(state.daysCompleted, state.day);
        state.phase = "dayEnd";
      } else if (state.phase === "result") {
        const diner={customer:state.customer,table:state.table,stack:state.stack.slice(),stackOffsets:copyLayerOffsets(state.stack,state.stackOffsets),seconds:0};
        if(state.platedFaces)diner.platedFaces=state.platedFaces.slice();
        const nextOrder=nextGuestOrder(state);
        if(state.waitingGuest)nextOrder.queueEntryProgress=Math.min(1,state.waitingGuest.seconds/queueWalkSeconds);
        const previousDiners=[...state.previousDiners,diner].filter(g=>g.table!==nextOrder.table).slice(-3);
        if(previousDiners.length===3&&nextOrder.orderNo<nextOrder.daySize){
          // Give the longest-seated diner an exit window before that table
          // receives its next guest, even when the player rushes every order.
          const oldest=previousDiners[0];
          oldest.leaveAt=Math.min(mealTimes(oldest).leave,oldest.seconds+1.8);
        }
        Object.assign(state,nextOrder,{previousDiners});
      } else return false;
      return true;
    }
    function act(action, value, offset) {
      if(!session.writable())return false;
      if (state.visit === "delivering" && action !== "restart") return false;
      if (state.visit === "carrying" && action !== "deliver" && action !== "restart") return false;
      switch (action) {
        case "restart":
          state.allTips -= state.dayTips;
          state.daysCompleted = Math.min(state.daysCompleted, state.day - 1);
          // Replaying the purchase day rolls back its receipts and its end-of-day purchase together.
          Object.assign(state, order(state.day, 1, undefined, state.smokeLaunchDay > state.day ? 0 : state.smokeLaunchDay), {dayTips: 0});
          break;
        case "buySmoke":
          if (state.phase !== "dayEnd" || state.smokeLaunchDay || availableTips(state) < smokePrice) return false;
          state.smokeLaunchDay = state.day + 1;
          break;
        case "next":
          if (!next()) return false;
          break;
        case "take":
          if (state.phase !== "waiting" || state.visit !== "seated") return false;
          state.visit = "ordering";
          state.visitProgress = 0;
          break;
        case "station":
          if (state.phase !== "playing" || !stations.includes(value)) return false;
          state.station = value;
          break;
        case "grill":
          if (state.phase !== "playing" || state.station !== "grill") return false;
          grill();
          break;
        case "add":
          if (state.phase !== "playing" || state.station !== "build" || !add(value, offset)) return false;
          break;
        case "undo":
        case "clear":
          if (state.phase !== "playing" || state.station !== "build" || !state.stack.length) return false;
          if (action === "undo") {
            state.stack.pop();
            state.stackOffsets.pop();
          } else {
            state.stack.length = state.stackOffsets.length = 0;
          }
          if(!state.stack.includes("patty")){state.platedQuality=null;state.platedFaces=null;}
          break;
        case "serve":
          if (state.station !== "build" || !state.canServe) return false;
          state.station = "order";
          state.visit = "carrying";
          state.visitProgress = 0;
          break;
        case "deliver":
          if (state.phase !== "playing" || state.visit !== "carrying" || Number(value)!==state.table) return false;
          state.visit="delivering";
          state.visitProgress=0;
          break;
        default: return false;
      }
      refresh(state);
      save(true);
      return true;
    }
    function tick(seconds) {
      if (!Number.isFinite(seconds) || seconds <= 0 || !session.writable()) return;
      if(state.previousDiners.length&&['waiting','playing'].includes(state.phase)){
        for(const diner of state.previousDiners)diner.seconds+=seconds;
        state.previousDiners=state.previousDiners.filter(diner=>diner.seconds<mealTimes(diner).clear);
      }
      const duration = visitTimes[state.visit];
      const activeSeconds=duration?Math.min(seconds,Math.max(0,1-state.visitProgress)*duration):seconds;
      advanceQueue(state,activeSeconds);
      if (duration) {
        state.visitProgress = Math.min(1, state.visitProgress + seconds / duration);
        sinceSave += seconds;
        if (state.visitProgress >= 1 - 1e-8) {
          if (state.visit === "arriving") {state.visit = "seated";state.queueEntryProgress=null;}
          else if (state.visit === "ordering") {
            state.visit = "dining";
            state.phase = "playing";
            state.station = "grill";
          } else {
            state.visit = "dining";
            serve();
          }
          state.visitProgress = 1;
          refresh(state);
          save();
        } else if (sinceSave >= 1) save();
        return;
      }
      const waitingAtTable=state.phase==='waiting'&&state.visit==='seated';
      if(state.phase!=='playing'&&!waitingAtTable)return;
      // Only time the player can control affects the speed grade. The fixed
      // entry, order-taking and delivery animations pass through the branch above.
      state.elapsed = Math.min(1e8, state.elapsed + seconds);
      if (state.grillStage === "sideA") state.heatA = Math.min(100, state.heatA + seconds * 11);
      if (state.grillStage === "sideB") state.heatB = Math.min(100, state.heatB + seconds * 11);
      sinceSave += seconds;
      if (sinceSave >= 1) save();
    }
    return {state, act, tick,session:session.api};
  }
  return {create, names, guests, mealTimes, fullSpeedSeconds, queueWalkSeconds, smokePrice, availableTips};
});
