/* Bind-space coordinates keep the weave attached through walking and sitting. */
(function(global){
  'use strict';
  const fabricGeometry=new WeakMap();
  const fabrics={key:'fabrics',roughness:.89,materials:new WeakMap(),pending:new Set()};
  const printed={key:'textiles',roughness:.87,materials:new WeakMap(),pending:new Set()};
  const locks={key:'grooms',file:'art/guest-grooms.png',roughness:.83,materials:new WeakMap(),pending:new Set()};
  function fit(index,parts,T,skin){
    const complexion=new T.Color(skin).convertSRGBToLinear();
    for(const [name,geometry] of Object.entries(parts)){
      if(!/^(body|arm-?1|fore-?1|thigh-?1|shin-?1)$/.test(name))continue;
      const legs=name.startsWith('thigh')||name.startsWith('shin');
      const tile=legs?(index===5||index===2?3:2):index-2;
      const position=geometry.attributes.position,paint=geometry.attributes.color,uv=new Float32Array(position.count*2);
      for(let i=0;i<position.count;i++){
        const x=position.getX(i),y=position.getY(i),z=position.getZ(i);
        const exposed=(name==='body'&&y>1.90)||(name.startsWith('fore')&&y<1.027)||
          Math.abs(paint.getX(i)-complexion.r)+Math.abs(paint.getY(i)-complexion.g)+Math.abs(paint.getZ(i)-complexion.b)<.006;
        if(exposed){uv[2*i]=.003;uv[2*i+1]=legs?.994:.04;continue;}
        if(!legs){
          const across=T.MathUtils.clamp(.5+x/.88,.016,.984);
          const height=T.MathUtils.clamp((1.955-y)/1.10,.012,.988);
          uv[2*i]=(tile%4+across)/4;
          uv[2*i+1]=1-(Math.floor(tile/4)+height)/4;
          continue;
        }
        const u=T.MathUtils.clamp(.49+x*.85+z*.36,.028,.972);
        const v=T.MathUtils.clamp(.04+y*.89,.012,.988);
        uv[2*i]=(tile%4+u)/4;
        uv[2*i+1]=(1-Math.floor(tile/4)+v)/2;
      }
      geometry.setAttribute('uv',new T.BufferAttribute(uv,2));
      fabricGeometry.set(geometry,legs?fabrics:printed);
    }
  }
  function paintedMaterial(slot,base,T){
    if(slot.materials.has(base))return slot.materials.get(base);
    const finish=base.clone();
    finish.roughness=slot.roughness;
    if(slot===locks){finish.side=T.DoubleSide;finish.alphaTest=.33;}
    slot.materials.set(base,finish);
    if(slot.texture){finish.map=slot.texture;return finish;}
    slot.pending.add(finish);
    if(!slot.started){
      slot.started=true;
      const url=global.DinerArtData?.[slot.key]||slot.file||'art/guest-'+slot.key+'.jpg';
      new T.TextureLoader().load(url,texture=>{
        texture.encoding=T.sRGBEncoding;
        texture.anisotropy=4;
        slot.texture=texture;
        for(const waiting of slot.pending){waiting.map=texture;waiting.needsUpdate=true;}
        slot.pending.clear();
        global.dispatchEvent(new Event('diner-model-ready'));
      },undefined,()=>{slot.pending.clear();});
    }
    return finish;
  }
  function material(geometry,base,T,name){
    if(!global.document)return base;
    if(name==='hair'&&geometry.attributes.uv)return paintedMaterial(locks,base,T);
    const slot=fabricGeometry.get(geometry);
    return slot?paintedMaterial(slot,base,T):base;
  }
  global.DinerGuestCloth={fit,material};
})(window);
