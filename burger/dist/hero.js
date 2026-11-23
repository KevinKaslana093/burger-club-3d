/* Featured guests based on licensed pixiv humanoids credited in vendor/Guest-credits.txt. */
(function (global) {
  'use strict';
  const T=global.THREE,cache=new Map(),deltaCache=new WeakMap();
  function load(key){
    if(cache.has(key))return cache.get(key);
    const result=new Promise((resolve,reject)=>{
      const loader=new T.GLTFLoader(),data=global.DinerGuestData?.[key];
      if(data){
        const str=atob(data),bytes=new Uint8Array(str.length);
        for(let i=0;i<str.length;i++)bytes[i]=str.charCodeAt(i);
        loader.parse(bytes.buffer,'',resolve,reject);
      }else loader.load('guests/guest-'+key+'.glb',resolve,undefined,reject);
    }).then(gltf=>{
      gltf.scene.traverse(mesh=>{
        if(!mesh.isMesh)return;
        const old=mesh.material,hair=/HAIR/i.test(old.name),eye=/EYE/i.test(old.name);
        const paintedSkin=key==='a'&&/_SKIN/i.test(old.name);
        const mat=new T.MeshLambertMaterial({color:old.color,map:old.map,side:T.DoubleSide,alphaTest:old.alphaTest>0?Math.max(hair?.45:.34,old.alphaTest):0});
        // The painted skin maps are already lit. Leave headroom for the
        // window light to reveal the cheeks and jaw without clipping.
        if(paintedSkin)mat.color.multiplyScalar(.72);
        mat.name=old.name;mat.emissive.setScalar(paintedSkin?.027:eye?.082:hair?.055:.07);mat.emissiveMap=old.map;
        mesh.material=mat;mesh.castShadow=true;mesh.receiveShadow=false;
      });
      return gltf.scene;
    });
    cache.set(key,result);return result;
  }

  // Pose deltas are baked from the original humanoid bones. Updating a private
  // position attribute keeps the exact same pose in WebGL and the canvas renderer.
  function deformation(mesh){
    const source=mesh.geometry,targets=source.morphAttributes.position;
    if(!targets?.length)return null;
    let clips=deltaCache.get(source);
    if(!clips){
      clips={};
      for(const [name,index] of Object.entries(mesh.morphTargetDictionary||{})){
        const src=targets[index]?.array;
        if(!src)continue;
        const normal=source.morphAttributes.normal?.[index]?.array,offsets=[];
        for(let j=0;j<src.length;j+=3){
          if(Math.abs(src[j])+Math.abs(src[j+1])+Math.abs(src[j+2])>1e-7||
             (normal&&Math.abs(normal[j])+Math.abs(normal[j+1])+Math.abs(normal[j+2])>1e-7))offsets.push(j);
        }
        if(offsets.length)clips[name]={src,normal,offsets:new Uint32Array(offsets)};
      }
      // mealReach was exported relative to seated. Its sparse indices already
      // identify the upper-limb skin and matching sleeves, including seam
      // duplicates. Reuse the half-sit forearms on just those vertices.
      const reach=clips.mealReach,half=clips.sitHalf;
      if(reach){
        // The resting hand starts beneath the near edge. Draw it back, lift,
        // then reach over the tabletop. Both offsets vanish at the grip.
        const lift=new Float32Array(reach.src.length),drawBack=new Float32Array(reach.src.length);
        for(const j of reach.offsets){
          const dx=reach.src[j],dy=reach.src[j+1],dz=reach.src[j+2];
          lift[j+1]=dy;
          drawBack[j+2]=-.046*Math.min(1,Math.hypot(dx,dy,dz)/.30);
        }
        clips.reachLift={src:lift,offsets:reach.offsets};
        clips.reachBack={src:drawBack,offsets:reach.offsets};
      }
      if(reach&&half){
        const left=[],right=[];
        const neutral=source.attributes.position.array;
        for(const j of reach.offsets)(neutral[j]<0?left:right).push(j);
        if(left.length)clips.waitLeft={...half,offsets:new Uint32Array(left)};
        if(right.length)clips.waitRight={...half,offsets:new Uint32Array(right)};
      }
      deltaCache.set(source,clips);
    }
    const geo=new T.BufferGeometry();
    for(const [key,att] of Object.entries(source.attributes))
      geo.setAttribute(key,key==='position'||key==='normal'?att.clone().setUsage(T.DynamicDrawUsage):att);
    geo.setIndex(source.index);mesh.geometry=geo;mesh.frustumCulled=false;
    const current={},positions=geo.attributes.position,normals=geo.attributes.normal;
    return weights=>{
      let changed=false,nchanged=false;
      for(const [name,weight] of Object.entries(weights)){
        const clip=clips[name],prev=current[name]||0,delta=weight-prev;
        if(!clip||Math.abs(delta)<.00001)continue;
        const p=positions.array,n=normals.array;
        for(let i=0;i<clip.offsets.length;i++){
          const j=clip.offsets[i];
          p[j]+=clip.src[j]*delta;p[j+1]+=clip.src[j+1]*delta;p[j+2]+=clip.src[j+2]*delta;
          if(clip.normal){n[j]+=clip.normal[j]*delta;n[j+1]+=clip.normal[j+1]*delta;n[j+2]+=clip.normal[j+2]*delta;}
        }
        current[name]=weight;changed=true;if(clip.normal)nchanged=true;
      }
      if(changed)positions.needsUpdate=true;
      if(nchanged)normals.needsUpdate=true;
    };
  }
  const trimGeometry=new T.SphereGeometry(1,14,10),trimMaterials=new Map();
  function accessories(id){
    const group=new T.Group();
    function bead(color,x,y,z,w,h,d,turn=0,spin=0){
      if(!trimMaterials.has(color))trimMaterials.set(color,new T.MeshStandardMaterial({color:new T.Color(color).convertSRGBToLinear(),roughness:.46,metalness:.18}));
      const mesh=new T.Mesh(trimGeometry,trimMaterials.get(color));
      mesh.position.set(x,y,z);mesh.scale.set(w,h,d);mesh.rotation.set(0,turn,spin);group.add(mesh);
    }
    if(id===1){
      // A brass double barrette with a small cloisonne daisy, set against the side fringe.
      for(let j=0;j<2;j++)bead('#BC9766',.132,2.465+j*.027,.087,.069,.006,.005,.68,.12);
      for(let j=0;j<6;j++){
        const a=j*Math.PI/3,x=.119+.016*Math.sin(a),y=2.486+.016*Math.cos(a);
        bead('#EBD49A',x,y,.105-(x-.119)*.72,.008,.014,.004,.62,-a);
      }
      bead('#A97742',.119,2.486,.110,.009,.009,.006,.62);
    }else{
      // The small brass lightning pin catches light on the dance jacket lapel.
      bead('#B6A487',-.168,1.862,.153,.038,.041,.008,-.48,-.2);
      bead('#415E64',-.168,1.862,.158,.031,.034,.008,-.48,-.2);
      bead('#E8BA71',-.170,1.869,.168,.006,.017,.003,-.45,-.43);
      bead('#E8BA71',-.166,1.850,.168,.006,.014,.003,-.45,-.43);
    }
    return group;
  }
  function customer(id,models){
    const key=id===0?'b':id===1?'a':null;
    if(!key)return models.customer(id);
    const holder=new T.Group(),fallback=models.customer(id);
    const privateGeometries=[];
    let disposed=false;
    let pose=['stand',0,1],poseFn=fallback.userData.setVisitPose,frameFn=fallback.userData.onFrame;
    holder.add(fallback);holder.name='guest-'+id;
    holder.userData.portraitFaceBounds=fallback.userData.portraitFaceBounds;
    let gripFn=out=>fallback.userData.mealAnchor?.(out)||false;
    holder.userData.mealAnchor=out=>!disposed&&gripFn(out);
    holder.userData.setVisitPose=(mode,phase=0,amount=1)=>{pose=[mode,phase,amount];poseFn?.(...pose);};
    holder.userData.onFrame=(t,reduced,phase)=>frameFn?.(t,reduced,phase);
    holder.userData.setDetailForHeight=pixels=>{
      if(!disposed&&!holder.userData.featured)fallback.userData.setDetailForHeight?.(pixels);
    };
    holder.userData.dispose=()=>{
      disposed=true;poseFn=null;frameFn=null;
      holder.clear();
      for(const geometry of privateGeometries)geometry.dispose();
      privateGeometries.length=0;
    };
    load(key).then(template=>{
      if(disposed)return;
      const asset=template.clone(true),stage=new T.Group(),before=new T.Box3();
      asset.updateMatrixWorld(true);
      asset.traverse(mesh=>{
        if(mesh.isMesh)before.union(new T.Box3().setFromBufferAttribute(mesh.geometry.attributes.position).applyMatrix4(mesh.matrixWorld));
      });
      const height=before.max.y-before.min.y;
      const scale=2.69/height,deforms=[],soles=[];
      asset.traverse(mesh=>{
        if(!mesh.isMesh)return;
        const apply=deformation(mesh);
        if(apply){deforms.push(apply);privateGeometries.push(mesh.geometry);}
        if(/Face_\d+_SKIN/i.test(mesh.material.name)){
          const faceBox=new T.Box3().setFromBufferAttribute(mesh.geometry.attributes.position);
          holder.userData.portraitFaceBounds=out=>out.copy(faceBox).applyMatrix4(mesh.matrixWorld);
        }
        if(/shoes/i.test(mesh.material.name))soles.push({pos:mesh.geometry.attributes.position.array,world:mesh.matrixWorld.clone()});
      });
      asset.scale.setScalar(scale);
      asset.position.set(-(before.max.x+before.min.x)*scale/2,-before.min.y*scale,-.025);
      stage.add(asset,accessories(id));
      const entered=performance.now();
      const grips=template.userData.mealGrip;
      let halfSeat=false;
      asset.traverse(mesh=>{if(mesh.morphTargetDictionary?.sitHalf!==undefined)halfSeat=true;});
      const reach=grips?new T.Vector3().fromArray(grips.mealReach):null,bite=grips?new T.Vector3().fromArray(grips.mealBite):null;
      let lastSit=NaN,lastSwing=NaN,lastWalk=NaN,lastWait=0,lastMeal=-1,lastReach=-1;
      const finishTime=global.DinerGame?.mealTimes({customer:id}).done??Infinity;
      function smooth(t){t=Math.min(1,Math.max(0,t));return t*t*(3-2*t);}
      gripFn=out=>{
        if(!reach||lastMeal<0)return false;
        asset.updateMatrix();stage.updateMatrix();
        return out.copy(reach).lerp(bite,lastMeal).applyMatrix4(asset.matrix).applyMatrix4(stage.matrix);
      };
      poseFn=(mode,phase,amount)=>{
        const sit=mode==='eat'?1:mode==='sit'?Math.min(1,Math.max(0,amount)):0,walk=mode==='walk'?Math.min(1,Math.max(0,amount)):0;
        const swing=walk*Math.sin(phase),meal=mode==='eat'&&reach?Math.min(1,Math.max(0,amount)):-1;
        const wait=mode==='wait'?Math.min(1,Math.max(0,amount)):0;
        const prep=meal<0?0:Math.max(0,Math.min(1,phase/.82,(finishTime-phase)/.72));
        if(lastSit===sit&&lastSwing===swing&&lastWalk===walk&&lastMeal===meal&&lastWait===wait&&lastReach===prep)return;
        const forward=smooth((prep-.47)/.53),lift=smooth((prep-.20)/.44);
        const drawBack=smooth(prep/.25)*(1-smooth((prep-.54)/.46));
        const weights={walkRight:Math.max(0,swing)+.11*wait,walkLeft:Math.max(0,-swing),sitHalf:halfSeat?1-Math.abs(2*sit-1):0,seated:halfSeat?Math.max(0,2*sit-1):sit,mealReach:meal<0?0:(1-meal)*forward,mealBite:Math.max(0,meal)*forward,reachLift:lift-forward,reachBack:drawBack,waitLeft:.67*wait,waitRight:.29*wait};
        lastMeal=meal;lastWait=wait;lastReach=prep;
        for(const apply of deforms)apply(weights);
        // Keep the supporting shoe on the floor throughout the blend, including
        // the interval where the bent leg passes from a walk into the seat.
        let floor=Infinity;
        for(const {pos,world} of soles){
          const e=world.elements;
          for(let j=0;j<pos.length;j+=3)floor=Math.min(floor,e[1]*pos[j]+e[5]*pos[j+1]+e[9]*pos[j+2]+e[13]);
        }
        stage.position.y=Number.isFinite(floor)?(before.min.y-floor)*scale:-.42*sit;
        stage.position.z=halfSeat?-.133*Math.sin(Math.PI*sit):0;
        lastSit=sit;lastWalk=walk;lastSwing=swing;
      };
      frameFn=(t,reduced,phase)=>{
        const age=Math.max(0,t-entered),cycle=(age+id*627)%4600;
        const blink=reduced?0:Math.max(0,1-Math.abs(cycle-4250)/107);
        const talking=reduced||phase==='portrait'?0:age<2100?.22*Math.abs(Math.sin(age*.009))*(1-age/2100):0;
        const chew=phase==='eating'&&!reduced?.12*Math.max(0,Math.sin(age*.0042+id))**1.4:0;
        const weights={blink,relaxed:phase==='result'?.39:phase==='portrait'?.22:.12,aa:Math.max(talking,chew)};
        for(const apply of deforms)apply(weights);
        stage.rotation.y=reduced?0:.018*Math.sin(t*.00082+id)+(phase==='lobby'?.043*Math.sin(t*.00051+id):0);
      };
      holder.clear();holder.add(stage);poseFn(...pose);
      holder.userData.featured=true;holder.userData.revision=(holder.userData.revision||0)+1;
      global.dispatchEvent(new Event('diner-model-ready'));
    }).catch(error=>{if(!disposed)holder.userData.modelError=String(error?.message||error);});
    return holder;
  }
  global.DinerGuests={customer};
})(window);
