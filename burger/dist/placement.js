/* Ingredient transfer, collision and settling in the assembly station. */
(() => {
  'use strict';
  // Dimensions follow the bench model (a complete bun is about one unit wide).
  const types = {
    bottom:{lift:.52,g:9.9,mass:.46,rebound:.19,soft:.84,k:235,d:18},
    patty:{lift:.42,g:11.6,mass:1.0,rebound:.065,soft:.40,k:340,d:24},
    cheese:{lift:.43,g:8.0,mass:.25,rebound:.012,soft:.61,k:175,d:16,flex:.060},
    smoke:{lift:.15,g:8,mass:.08,rebound:0,soft:.48,k:250,d:19},
    lettuce:{lift:.46,g:5.8,mass:.14,rebound:.045,soft:.92,k:150,d:14,flex:.083},
    tomato:{lift:.43,g:9.2,mass:.54,rebound:.082,soft:.45,k:250,d:20,flex:.022},
    pickle:{lift:.43,g:9,mass:.23,rebound:.095,soft:.40,k:320,d:23},
    onion:{lift:.41,g:7.1,mass:.21,rebound:.075,soft:.60,k:215,d:17,flex:.032},
    top:{lift:.53,g:9.4,mass:.49,rebound:.18,soft:.93,k:228,d:17}
  };
  const clamp=(x,lo,hi)=>Math.min(hi,Math.max(lo,x));
  const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
  function makeAssembly(T, models, stack, shadowTexture, reduced, refreshShadows=()=>{}, context=()=>({})) {
    const coat = new T.MeshBasicMaterial({map:shadowTexture, transparent:true, depthWrite:false, opacity:0});
    const shade = new T.Mesh(new T.PlaneGeometry(1.05,1.05),coat);
    shade.rotation.x=-Math.PI/2;shade.renderOrder=2;
    const markMaterial=new T.MeshBasicMaterial({color:0x337b58,transparent:true,opacity:.84,depthWrite:false,side:T.DoubleSide});
    const mark=new T.Mesh(new T.RingGeometry(.505,.522,64),markMaterial);
    mark.rotation.x=-Math.PI/2;mark.renderOrder=3;
    stack.add(shade,mark);shade.visible=false;mark.visible=false;
    const layers=[], waiters=[];
    let listener=null,paused=false,held=null,released=null,restTop=0;
    const deformationModes=new WeakMap();
    const freeFlex=new Map();
    function cast(node,enabled){node.traverse(part=>{if(part.isMesh)part.castShadow=enabled;});}
    const busy=()=>layers.some(layer=>layer.phase!=='rest');
    const animating=()=>busy()||layers.some(layer=>layer.melt);
    function wakeWaiters(){if(!busy())while(waiters.length)waiters.shift()();}
    let bottlesInUse=0;
    function dispensingBottle(){
      const rack=context().source?.('smoke');
      if(!rack)return null;
      const tip=new T.Group(),copy=rack.clone(true),tilt=2.63,scale=1.28;
      copy.visible=true;copy.rotation.set(0,0,tilt);copy.scale.setScalar(scale);
      copy.position.set(.44*scale*Math.sin(tilt),-.44*scale*Math.cos(tilt),0);
      tip.add(copy);tip.name='dispensing-nozzle';stack.add(tip);
      bottlesInUse++;rack.userData.dispensing=true;rack.visible=false;
      return tip;
    }
    function putBack(tip){
      if(!tip)return;
      stack.remove(tip);bottlesInUse--;
      const rack=context().source?.('smoke');
      if(rack){rack.userData.dispensing=bottlesInUse>0;rack.visible=!!rack.userData.stocked&&!bottlesInUse;}
    }
    function release(commit) {
      if(held){
        released=commit&&held.valid?{id:held.id,offset:held.landing,position:held.node.position.clone(),rotation:held.node.rotation.clone(),
          velocity:performance.now()-held.stamp<120?held.velocity.clone():new T.Vector3()}:null;
        if(held.nozzle)putBack(held.nozzle);else stack.remove(held.node);
        held=null;
      } else released=null;
      mark.visible=false;shade.visible=false;
      return released?.offset.slice()||null;
    }
    // Flexible food gets a temporary position buffer, with two edge-bending
    // modes measured in the ingredient's own coordinates. Never deform the
    // static sample in the bin or another order's duplicate layer.
    function acquireFlex(layer){
      if(reduced||!types[layer.id].flex||layer.flex)return;
      const mesh=layer.node.children[0],source=mesh.geometry;
      let modes=deformationModes.get(source);
      if(!modes){
        const p=source.attributes.position;
        const bend=new Float32Array(p.count),wave=new Float32Array(p.count);
        const slopes=new Float32Array(p.count*4);
        for(let i=0;i<p.count;i++){
          const x=p.getX(i),z=p.getZ(i),rr=Math.hypot(x,z);
          const t=clamp((rr-.11)/.43,0,1),margin=smooth(t),slope=rr>0?6*t*(1-t)/(.43*rr):0;
          const axis=3.8*(.69*x-.72*z)+1.34,fold=x*8+z*5.3+.31;
          const b=.53+.47*Math.sin(axis),cross=.61+.39*Math.cos(z*7.3),w=Math.sin(fold)*cross;
          const bPrime=.47*3.8*Math.cos(axis),wPrime=Math.cos(fold)*cross,j=i*4;
          bend[i]=margin*b;wave[i]=margin*w;
          slopes[j]=slope*x*b+margin*bPrime*.69;
          slopes[j+1]=slope*z*b-margin*bPrime*.72;
          slopes[j+2]=slope*x*w+margin*wPrime*8;
          slopes[j+3]=slope*z*w+margin*(wPrime*5.3-Math.sin(fold)*.39*7.3*Math.sin(z*7.3));
        }
        modes={bend,wave,slopes};deformationModes.set(source,modes);
      }
      const pool=freeFlex.get(source);
      const live=pool?.pop()||source.clone();
      live.attributes.position.setUsage(T.DynamicDrawUsage);live.attributes.normal.setUsage(T.DynamicDrawUsage);
      mesh.geometry=live;layer.flex={mesh,source,live,modes};
    }
    function relax(layer){
      const f=layer.flex;if(!f)return;
      f.mesh.geometry=f.source;
      const pool=freeFlex.get(f.source)||[];
      if(pool.length<2){pool.push(f.live);freeFlex.set(f.source,pool);}else f.live.dispose();
      layer.flex=null;
    }
    function bendEdges(layer){
      if(!types[layer.id].flex||reduced||layer.phase==='waiting'||layer.phase==='rest'&&!layer.melt)return;
      acquireFlex(layer);
      const f=layer.flex,rest=f.source.attributes.position.array,live=f.live.attributes.position.array;
      const amount=types[layer.id].flex,air=layer.impacted?0:Math.sin(Math.PI*clamp(layer.age/layer.flightTime,0,1));
      const elapsed=layer.impacted?Math.max(0,layer.age-layer.hitTime):0;
      const pulse=layer.impacted?Math.exp(-9*elapsed)*Math.sin(24*elapsed):0;
      const bend=amount*(-.71*air+1.05*pulse)*layer.sign;
      const ripple=amount*(air*.43*Math.cos(layer.age*13)+pulse*.51);
      const srcN=f.source.attributes.normal.array,n=f.live.attributes.normal.array,slopes=f.modes.slopes;
      const hot=layer.melt?.goal.attributes,blend=layer.melt?smooth(layer.melt.time/layer.melt.duration):0;
      for(let i=0,k=0,j=0;i<f.modes.bend.length;i++,k+=3,j+=4){
        let x=rest[k],y=rest[k+1],z=rest[k+2],rx=srcN[k],ry=srcN[k+1],rz=srcN[k+2];
        if(hot&&blend>0){
          const p=hot.position.array,norm=hot.normal.array;
          x+=(p[k]-x)*blend;y+=(p[k+1]-y)*blend;z+=(p[k+2]-z)*blend;
          rx+=(norm[k]-rx)*blend;ry+=(norm[k+1]-ry)*blend;rz+=(norm[k+2]-rz)*blend;
        }
        live[k]=x;live[k+1]=y+f.modes.bend[i]*bend+f.modes.wave[i]*ripple;live[k+2]=z;
        // Inverse transpose of the vertical displacement field keeps highlights
        // attached to the freshly bending surface at each point.
        const nx=rx-ry*(slopes[j]*bend+slopes[j+2]*ripple);
        const ny=ry,nz=rz-ry*(slopes[j+1]*bend+slopes[j+3]*ripple);
        const length=Math.sqrt(nx*nx+ny*ny+nz*nz)||1;
        n[k]=nx/length;n[k+1]=ny/length;n[k+2]=nz/length;
      }
      f.live.attributes.position.needsUpdate=f.live.attributes.normal.needsUpdate=true;
    }
    function finishMelt(layer){
      relax(layer);
      if(layer.melt){layer.node.children[0].geometry=layer.melt.goal;layer.melt=null;}
    }
    function endPour(layer){
      if(!layer.pour)return;
      putBack(layer.pour.tip);
      layer.node.children[0].geometry=layer.pour.full;
      layer.pour.live.dispose();layer.pour=null;
    }
    function finish(layer,force=false){
      endPour(layer);
      if(layer.phase!=='rest'){cast(layer.node,true);refreshShadows();}
      if(force||!layer.melt||layer.melt.time>=layer.melt.duration)finishMelt(layer);
      layer.phase='rest';layer.impacted=true;layer.h=0;layer.speed=0;layer.squeeze=0;layer.spring=0;layer.wobble=0;layer.slide=0;
      layer.node.visible=true;layer.node.position.copy(layer.base);layer.node.rotation.copy(layer.rotation);
      layer.node.scale.copy(layer.scale);
    }
    function settle(){
      for(const layer of layers)finish(layer,true);
      release(false);wakeWaiters();
    }
    function change(ids,animate,offsets){
      if(!offsets&&released&&ids.at(-1)===released.id){
        offsets=layers.map(l=>[l.base.x,l.base.z]);offsets[ids.length-1]=released.offset;
      }
      let same=0;
      while(same<Math.min(ids.length,layers.length)){
        const layer=layers[same],offset=offsets?.[same];
        if(layer.id!==ids[same]||layer.base.x!==(offset?.[0]||0)||layer.base.z!==(offset?.[1]||0))break;
        same++;
      }
      for(const layer of layers.splice(same)){endPour(layer);relax(layer);stack.remove(layer.node);refreshShadows();}
      // A sentinel gives the last actual layer's designed contact height as well.
      const faces=context().faces;
      const layout=models.burger([...ids,'top'],faces,offsets).children.slice();
      restTop=layout[ids.length].position.y;
      for(let i=same;i<ids.length;i++){
        const node=layout[i],id=ids[i], spec=types[id],base=node.position.clone();
        if(id==='patty')window.DinerSearing?.finish(T,node,faces);
        const initial=released&&released.id===id?released:null;
        const sign=(id==='patty'||i%2)?-1:1;
        const source=!reduced&&!initial&&animate?context().source?.(id):null;
        const start=base.clone(),sourceScale=new T.Vector3(1,1,1),sourceEuler=new T.Euler();
        let height=spec.lift,launch=0;
        if(source){
          const from=new T.Matrix4();
          source.updateWorldMatrix(true,false);stack.updateWorldMatrix(true,false);
          from.copy(stack.matrixWorld).invert().multiply(source.matrixWorld);
          const orientation=new T.Quaternion();from.decompose(start,orientation,sourceScale);sourceEuler.setFromQuaternion(orientation);
          height=start.y-base.y;
          launch=Math.sqrt(2*spec.g*Math.max(.12,spec.lift-height));
        }else if(initial){
          start.copy(initial.position);sourceEuler.copy(initial.rotation);
          height=clamp(start.y-base.y,.035,.98);launch=clamp(initial.velocity.y*.18,-.83,.60);
        }else{
          height=reduced?.035:spec.lift;
          start.x+=reduced?0:sign*.33;start.z+=reduced?0:-.22;
          sourceEuler.z=reduced?0:sign*.13;
        }
        const gravity=reduced?10:spec.g;
        const flightTime=Math.max(.075,(launch+Math.sqrt(Math.max(0,launch*launch+2*gravity*height)))/gravity);
        const layer={id,node,base,rotation:node.rotation.clone(),scale:node.scale.clone(),
          thickness:layout[i+1].position.y-base.y, phase:'waiting',age:0,h:height, firstHeight:height,
          flightTime,sourceScale,sourceEuler,grab:!!initial,
          speed:launch,squeeze:0,spring:0,wobble:0,impacted:false,sign,slide:0,slideSpeed:0,hitTime:0,
          x:start.x-base.x,z:start.z-base.z,handX:initial?clamp(initial.velocity.x,-2.5,2.5):0,handZ:initial?clamp(initial.velocity.z,-2.5,2.5):0};
        if(node.userData.melt&&animate&&!reduced){
          layer.melt={goal:node.children[0].geometry,time:0,duration:1.55-.13*node.userData.melt};
          node.children[0].geometry=models.food('cheese').children[0].geometry;
        }
        if(id==='smoke'&&animate){
          const mesh=node.children[0],full=mesh.geometry,live=full.clone();
          mesh.geometry=live;live.setDrawRange(0,0);
          layer.pour={full,live,tip:null};
        }
        layers.push(layer);stack.add(node);node.visible=false;
        if(animate)cast(node,false);else finish(layer);
      }
      released=null;
      // Put a fresh layer in its start pose immediately, before the next render.
      step(0);wakeWaiters();
    }
    function step(dt) {
      if(paused)return;
      let pendingContact=false,raise=0,shadowLayer=null;
      for(let i=0;i<layers.length;i++){
        const l=layers[i], spec=types[l.id];
        if(l.melt&&l.impacted){
          l.melt.time+=dt;
          if(l.melt.time>=l.melt.duration&&l.phase==='rest')finishMelt(l);
        }
        if(l.phase==='rest'){
          l.node.position.copy(l.base);l.node.position.y+=raise;
          continue;
        }
        if(l.phase==='waiting'){
          if(pendingContact)continue;
          l.phase=l.pour?'pour':'flight';l.node.visible=true;
          if(l.pour&&!reduced)l.pour.tip=dispensingBottle();
        }
        if(l.phase!=='rest')l.age+=dt;
        if(l.phase==='pour'){
          const {live,tip}=l.pour,p=live.attributes.position,sides=live.userData.nozzleSides;
          const rows=p.count/sides-1,t=clamp(l.age/(reduced?.10:.70),0,1),row=Math.round(smooth(t)*rows);
          l.node.position.copy(l.base);l.node.position.y+=raise;
          live.setDrawRange(0,row*sides*6);
          if(tip){
            const a=row*sides,b=a+sides/2;
            tip.position.set((p.getX(a)+p.getX(b))*.5,(p.getY(a)+p.getY(b))*.5+.012,(p.getZ(a)+p.getZ(b))*.5).add(l.node.position);
          }
          if(t===1){
            if(listener)listener('smoke',.3,{support:layers[i-1]?.id||'board',speed:0,pan:0,material:'smoke',dragged:l.grab});
            finish(l);
          }else pendingContact=true;
          continue;
        }
        if(l.phase==='flight'||l.phase==='bounce'){
          const g=reduced?10:spec.g;
          l.h+=l.speed*dt-.5*g*dt*dt;l.speed-=g*dt;
          if(l.h<=0&&l.speed<0){
            const impact=-l.speed;
            l.h=0;
            if(!l.impacted){
              l.impacted=true;l.hitTime=l.age;
              cast(l.node,true);refreshShadows();
              l.spring+=reduced?.22:impact*(.52+1.20*spec.soft);l.wobble=reduced?0:Math.min(1,impact*.32);
              l.slideSpeed=reduced?0:clamp((l.handX*.28-l.x*.22)*Math.abs(impact),-.53,.53);
              const below=layers[i-1];
              if(below&&!reduced){
                below.spring+=impact*spec.mass*(.28+1.17*types[below.id].soft);
                if(below.phase==='rest')below.phase='settle';
              }
              // One contact per actual food placement, independent of refresh rate.
              const strength=clamp(impact/3.30*(.51+.49*Math.sqrt(spec.mass)),.19,1);
              if(listener)listener(l.id,strength,{support:below?.id||'board',speed:impact,
                pan:clamp(l.x*.22,-.32,.32),material:l.id,dragged:l.grab});
            }
            l.speed=reduced?0:impact*spec.rebound*(i?.78:1);
            l.phase=l.speed>.18?'bounce':'settle';
          }
          if(!l.impacted){pendingContact=true;shadowLayer=l;}
        }
        if(!shadowLayer&&l.impacted&&l.age-l.hitTime<.28)shadowLayer=l;
        if(l.phase!=='rest'){
          l.spring+=(-spec.k*l.squeeze-spec.d*l.spring)*dt;
          l.squeeze+=l.spring*dt;l.wobble*=Math.exp(-dt*10);
          l.slideSpeed+=(-162*l.slide-17*l.slideSpeed)*dt;l.slide+=l.slideSpeed*dt;
        }
        const q=clamp(l.squeeze,-.032,.20);
        const t=l.impacted?1:clamp(l.age/l.flightTime,0,1),blend=smooth(t),flight=1-blend;
        const arc=reduced?0:Math.sin(Math.PI*t);
        const wob=l.sign*.059*l.wobble*Math.sin((l.age-l.hitTime)*26);
        const hand=t*(1-t)*(1-t)*l.flightTime;
        const baseLift=raise;
        l.node.position.set(l.base.x+l.x*flight+l.handX*hand+l.slide,
          l.base.y+baseLift+l.h,l.base.z+l.z*flight+l.handZ*hand+arc*l.sign*.029);
        l.node.rotation.set(l.rotation.x*(1-flight)+l.sourceEuler.x*flight+arc*.095+wob,
          l.rotation.y*(1-flight)+l.sourceEuler.y*flight+arc*l.sign*.19,
          l.rotation.z*(1-flight)+l.sourceEuler.z*flight+arc*l.sign*(spec.flex?.22:.095)+wob);
        l.node.scale.set(
          (l.scale.x*blend+l.sourceScale.x*flight)*(1+q*.37),
          (l.scale.y*blend+l.sourceScale.y*flight)*(1-q),
          (l.scale.z*blend+l.sourceScale.z*flight)*(1+q*.37));
        // The top of a rebounding support carries the next layer with it.
        raise+=(l.impacted?l.h:0)-l.thickness*q;
        if(l.phase==='settle'&&Math.abs(l.squeeze)<.001&&Math.abs(l.spring)<.019&&
          Math.abs(l.slide)<.0008&&Math.abs(l.slideSpeed)<.012&&l.wobble<.018&&(!spec.flex||l.age-l.hitTime>.48)){
          finish(l);l.node.position.y+=baseLift;raise=baseLift;
        }
      }
      if(!held){
        shade.visible=!!shadowLayer;
        if(shadowLayer){
          const l=shadowLayer,f=clamp(l.h/types[l.id].lift,0,1),horizontal=Math.hypot(l.node.position.x,l.node.position.z);
          // A shadow gradually reaches the stack with its caster, rather than
          // immediately painting a disc on top of an empty board.
          shade.position.set(l.base.x+(l.node.position.x-l.base.x)*.86,l.base.y+.006,l.base.z+(l.node.position.z-l.base.z)*.86);
          const damp=l.impacted?1-smooth((l.age-l.hitTime)/.28):1;
          shade.scale.setScalar((.76+f*.41)*l.node.scale.x);coat.opacity=(.075+.26*(1-f))*(1-smooth((horizontal-.35)/.70))*damp;
        }
      }
    }
    function advance(delta){
      if(paused||!animating())return false;
      const duration=Math.max(0,Math.min(.75,delta)),n=Math.max(1,Math.ceil(duration*120));
      for(let i=0;i<n;i++)step(duration/n);
      for(const l of layers)bendEdges(l);
      wakeWaiters();return true;
    }
    const aimPoint=new T.Vector3(),at=new T.Vector3(),plane=new T.Plane(),normal=new T.Vector3(),point=new T.Vector3(),ray=new T.Raycaster();
    const contactPlane=new T.Plane(),contactPoint=new T.Vector3();
    function move(x,y,camera,rect) {
      if(!held)return false;
      stack.updateWorldMatrix(true,false);
      const nx=2*(x-rect.left)/rect.width-1,ny=1-2*(y-rect.top)/rect.height;
      aimPoint.set(0,restTop+.36,0);stack.localToWorld(aimPoint);
      camera.getWorldDirection(normal);plane.setFromNormalAndCoplanarPoint(normal,aimPoint);
      ray.setFromCamera({x:nx,y:ny},camera);
      if(!ray.ray.intersectPlane(plane,point))return false;
      stack.worldToLocal(point);
      const prior=held.node.position.clone(),now=performance.now(),elapsed=(now-held.stamp)/1000;
      held.node.position.set(Math.max(-1.45,Math.min(1.45,point.x)),
        restTop+Math.max(.12,Math.min(.93,point.y-restTop)),
        Math.max(-.68,Math.min(.68,point.z)));
      // Screen-space target is a vertical capsule over the actual camera-projected
      // stack. It remains reachable whether the player aims at the crown or board.
      function projectY(h){at.set(0,h,0);stack.localToWorld(at);at.project(camera);return at.y;}
      const lo=projectY(.03),hi=projectY(restTop+.64);
      const cy=Math.max(Math.min(lo,hi),Math.min(Math.max(lo,hi),ny));
      const cx=at.x, depth=aimPoint.distanceTo(camera.position);
      const radius=rect.height*.59*stack.scale.x/(2*depth*Math.tan(T.MathUtils.degToRad(camera.fov/2)));
      held.valid=nx>=-1&&nx<=1&&ny>=-1&&ny<=1&&
        Math.hypot((nx-cx)*rect.width*.5,(ny-cy)*rect.height*.5)<Math.max(30,radius);
      // Project the cursor onto the actual next layer, including camera orbit
      // and the station's full world transform. Only the outer reach is limited.
      at.set(0,restTop,0);stack.localToWorld(at);normal.set(0,1,0).transformDirection(stack.matrixWorld);
      contactPlane.setFromNormalAndCoplanarPoint(normal,at);
      if(!ray.ray.intersectPlane(contactPlane,contactPoint))held.valid=false;
      else{
        stack.worldToLocal(contactPoint);
        const r=Math.hypot(contactPoint.x,contactPoint.z);
        const factor=held.id==='bottom'?0:r>.22?.22/r:smooth((r-.018)/.027);
        held.landing=[contactPoint.x*factor,contactPoint.z*factor];
      }
      const [landX,landZ]=held.landing;
      if(held.valid){held.node.position.x=landX;held.node.position.z=landZ;}
      if(held.stamp&&elapsed>.003&&elapsed<.15){
        held.velocity.lerp(prior.subVectors(held.node.position,prior).divideScalar(elapsed),.48);
      }else if(elapsed>=.15)held.velocity.set(0,0,0);
      held.stamp=now;held.node.rotation.z=-.105*held.node.position.x;
      mark.position.set(landX,restTop+.011,landZ);mark.visible=held.valid;
      markMaterial.color.setHex(held.valid?0x337b58:0xb38553);
      coat.opacity=held.valid?.33:.14;shade.visible=true;shade.scale.setScalar(.98);
      shade.position.set(landX,restTop+.008,landZ);
      return held.valid;
    }
    return {
      change,advance,settle,release,busy,animating,move,
      get top(){return restTop;},
      hold(id,x,y,camera,rect){
        if(paused||!types[id])return false;
        release(false);const nozzle=id==='smoke'?dispensingBottle():null;
        held={id,node:nozzle||models.food(id),nozzle,valid:false,landing:[0,0],stamp:0,velocity:new T.Vector3()};if(id==='patty')window.DinerSearing?.finish(T,held.node,context().faces);cast(held.node,false);stack.add(held.node);
        move(x,y,camera,rect);return true;
      },
      pause(value){paused=!!value;if(paused)release(false);},
      setListener(fn){listener=typeof fn==='function'?fn:null;},
      whenSettled(){return busy()?new Promise(resolve=>waiters.push(resolve)):Promise.resolve();},
      dispose(){settle();for(const pool of freeFlex.values())for(const geometry of pool)geometry.dispose();freeFlex.clear();
        coat.dispose();markMaterial.dispose();shade.geometry.dispose();mark.geometry.dispose();}
    };
  }

  window.DinerPlacement={create:makeAssembly};
})();
