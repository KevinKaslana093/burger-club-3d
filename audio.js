/* Recorded kitchen foley. The offline sample bank is loaded by the preceding script. */
(function (root) {
  'use strict';
  const effects = new Set(['ticket','drop','flip','lift','plate','undo','station','serve','rating','tap','door','step','pencil','table']);
  const foods = new Set(['top','bottom','patty','lettuce','cheese','tomato','pickle','onion','smoke']);
  const clamp = value => Math.max(0, Math.min(1, value));

  function create() {
    let context, master, limiter, resuming, grill, roomBed, roomShot;
    let muted = false, paused = false, volume = .8, grillMode = 'off';
    let inRoom=false,seatMask=0,lastSeat=0,nextUtensil=Infinity,quietUntil=0;
    const cache = new Map(), takes = new Map(), shots = new Set(), voices=new Set();

    function audible() { return !muted && !paused && volume > 0; }

    function bufferFor(key) {
      if (cache.has(key)) return cache.get(key);
      const bank = root.DinerFoley;
      if (!bank || !bank.samples[key]) return null;
      // PCM can be scheduled on the very first trusted gesture, even from file://.
      const bytes = root.atob(bank.samples[key]);
      const buffer = context.createBuffer(1, bytes.length / 2, bank.rates?.[key]||bank.rate);
      const channel = buffer.getChannelData(0);
      for (let i = 0; i < channel.length; i++) {
        let sample = bytes.charCodeAt(2*i) | (bytes.charCodeAt(2*i + 1) << 8);
        if (sample >= 32768) sample -= 65536;
        channel[i] = sample / 32768;
      }
      cache.set(key, buffer);
      return buffer;
    }

    function glide(param, value, seconds) {
      const now = context.currentTime;
      if (typeof param.cancelAndHoldAtTime === 'function') param.cancelAndHoldAtTime(now);
      else {
        const current = param.value;
        param.cancelScheduledValues(now);
        param.setValueAtTime(current, now);
      }
      param.linearRampToValueAtTime(value, now + seconds);
    }

    function voice(key, cycle, level, speed, pan, cutoff) {
      const buffer = bufferFor(key);
      if (!buffer) return null;
      const source = context.createBufferSource(), gain = context.createGain();
      const panner = context.createStereoPanner ? context.createStereoPanner() : null;
      const v = {source, gain, stopping:false,release:null};
      source.buffer = buffer;
      source.loop = cycle;
      source.playbackRate.value = speed;
      gain.gain.value = level;
      const filter=cutoff&&context.createBiquadFilter?context.createBiquadFilter():null;
      if(filter){filter.type='lowpass';filter.frequency.value=cutoff;filter.Q.value=.56;source.connect(filter);filter.connect(gain);}
      else source.connect(gain);
      if (panner) {
        panner.pan.value = pan;
        gain.connect(panner);
        panner.connect(master);
      } else gain.connect(master);
      v.release = () => {
        if(!v.release)return;
        v.release=null;
        source.disconnect();
        gain.disconnect();
        if(filter)filter.disconnect();
        if (panner) panner.disconnect();
        shots.delete(v);
        voices.delete(v);
      };
      source.onended = ()=>v.release?.();
      voices.add(v);
      source.start(0,cycle?Math.random()*buffer.duration:0);
      return v;
    }

    function stop(v) {
      if (!v || !v.release) return;
      // A suspended context can hold a scheduled fade indefinitely. Disconnect
      // its voices immediately so a stale action cannot play on resume.
      if(context.state!=='running'){
        v.stopping=true;v.source.stop();v.release();return;
      }
      if(v.stopping)return;
      v.stopping = true;
      glide(v.gain.gain, 0, .025);
      v.source.stop(context.currentTime + .03);
    }

    function syncGrill() {
      if (!context) return;
      if (!audible() || grillMode === 'off' || context.state !== 'running') {
        if (grill) grill.forEach(stop);
        grill = null;
        return;
      }
      if (!grill) {
        const low = voice('grillLow', true, 0, 1, -.10);
        const hot = voice('grillHot', true, 0, 1, .08);
        if (!low || !hot) { stop(low); stop(hot); return; }
        grill = [low, hot];
      }
      // Crossfade two independent recordings of a pan at different temperatures.
      const hot = grillMode === 'hot';
      glide(grill[0].gain.gain, hot ? .28 : .78, .45);
      glide(grill[1].gain.gain, hot ? .96 : .19, .52);
    }
    function syncRoom(){
      if(!context)return;
      if(!inRoom||!audible()||context.state!=='running'){
        stop(roomBed);stop(roomShot);roomBed=roomShot=null;nextUtensil=Infinity;return;
      }
      if(!roomBed){
        roomBed=voice('roomTone',true,0,1,-.16);
        if(!roomBed)return;
        // The single refrigeration motor stays at the back of the room.
        glide(roomBed.gain.gain,.080,.85);
        nextUtensil=context.currentTime+7+Math.random()*5;
      }
    }
    function setDiningRoom(enabled,seated){
      const mask=Number.isInteger(seated)?seated&15:0;
      const changed=!!enabled!==inRoom;
      inRoom=!!enabled;seatMask=mask;
      if(changed)syncRoom();
      if(!roomBed||!seatMask||context.currentTime<nextUtensil)return;
      const now=context.currentTime;
      if(now<quietUntil){nextUtensil=quietUntil+1.2;return;}
      const tables=[1,2,3,4].filter(i=>seatMask&(1<<(i-1)));
      const available=tables.filter(i=>i!==lastSeat),pool=available.length?available:tables;
      const table=pool[Math.floor(Math.random()*pool.length)],far=table<=2;
      lastSeat=table;
      const prev=takes.get('utensil')??0,take=(prev+1+Math.floor(Math.random()*2))%3;
      takes.set('utensil',take);
      const v=voice('utensil'+take,false,far?.14:.19,.966+Math.random()*.072,
        (table%2?-1:1)*(far?.29:.47),far?2900:3900);
      if(v){shots.add(v);roomShot=v;}
      nextUtensil=now+14+Math.random()*11+(4-tables.length)*3;
    }
    function synchronizeContext(){
      if(context?.state!=='running')voices.forEach(stop);
      syncGrill();syncRoom();
    }

    function sync() {
      if (!master) return;
      glide(master.gain, audible() ? volume : 0, .022);
      if (!audible()) shots.forEach(stop);
      syncGrill();syncRoom();
    }

    function unlock() {
      if (!context) {
        const Audio = root.AudioContext || root.webkitAudioContext;
        if (!Audio) return;
        try {
          context = new Audio({latencyHint:'interactive'});
          master = context.createGain();
          limiter = context.createDynamicsCompressor();
          limiter.threshold.value = -8;
          limiter.knee.value = 6;
          limiter.ratio.value = 4;
          limiter.attack.value = .004;
          limiter.release.value = .14;
          master.gain.value = audible() ? volume : 0;
          master.connect(limiter);
          limiter.connect(context.destination);
          context.onstatechange = synchronizeContext;
          const warm = () => { bufferFor('grillLow'); bufferFor('grillHot'); };
          if (root.requestIdleCallback) root.requestIdleCallback(warm, {timeout:800});
          else root.setTimeout(warm, 50);
          synchronizeContext();
        } catch { context = null; master = null; return; }
      }
      if (context.state !== 'running' && !resuming) {
        try {
          resuming = Promise.resolve(context.resume()).then(synchronizeContext)
            .catch(() => {}).finally(() => { resuming = null; });
        } catch { resuming = null; }
      }
    }

    return {
      unlock,setDiningRoom,
      setMuted(value) { value = !!value; if (muted !== value) { muted = value; sync(); } },
      setPaused(value) {
        value=!!value;if(paused===value)return;
        paused=value;sync();
        if(!paused&&audible()&&context?.state==='suspended')unlock();
      },
      setVolume(value) {
        if (Number.isFinite(value) && clamp(value) !== volume) { volume = clamp(value); sync(); }
      },
      setGrill(mode) {
        if (!['off','sizzle','hot'].includes(mode) || grillMode === mode) return;
        grillMode = mode;
        syncGrill();
      },
      play(cue, food, strength = 1, contact) {
        if (!audible() || context?.state !== 'running') return;
        if (cue === 'ingredient' ? !foods.has(food) : !effects.has(cue)) return;
        const material = cue === 'ingredient' ? food : cue;
        const variants = material === 'step' ? 4 : material==='pencil'?3:2;
        const previous = takes.get(material);
        const take = previous === undefined ? Math.floor(Math.random()*variants)
          : (previous + 1 + Math.floor(Math.random()*(variants-1))) % variants;
        takes.set(material, take);
        let level = .94 + .06*Math.random();
        if (Number.isFinite(strength)) level *= Math.sqrt(clamp(strength));
        if (!level) return;
        quietUntil=context.currentTime+(cue==='ticket'||cue==='table'?2.1:1.15);
        const impact=cue==='ingredient'&&contact&&Number.isFinite(contact.speed);
        const energy=impact?clamp(contact.speed/3.3):1;
        const placedAtTable=Number.isInteger(contact?.table)&&contact.table>=1&&contact.table<=4;
        const tablePan=placedAtTable?(contact.table%2?-.25:.25):0;
        const direction=impact&&Number.isFinite(contact.pan)?Math.max(-.45,Math.min(.45,contact.pan)):tablePan;
        const velocity=.984+.032*Math.random()-(impact?(1-energy)*.075:0);
        const support=impact?contact.support:null;
        const supportKey=support==='board'?'station':support==='bottom'||support==='top'?'bottom':support==='patty'?'patty':null;
        const useSupport=supportKey&&supportKey!==material;
        const live=[...shots].filter(v=>!v.stopping);
        for(const old of live.slice(0,Math.max(0,live.length+(useSupport?2:1)-8)))stop(old);
        // A discreet second recording gives the same ingredient different
        // contact on a bare board, a soft bun or a moist cooked patty.
        if(useSupport){
          const bed=voice(supportKey+(1-take),false,level*(support==='board'?.29:.15),
            .82+.10*energy,direction,2200+1700*energy);
          if(bed)shots.add(bed);
        }
        const v = voice(material + take, false, level, velocity, direction+(Math.random()-.5)*.08,
          impact?5200+energy*6700:undefined);
        if (v) shots.add(v);
      }
    };
  }
  root.DinerAudio = {create};
})(window);
