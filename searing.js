(() => {
  'use strict';
  const clamp=x=>Math.min(1,Math.max(0,x));
  const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
  function create(T,model,rawMaterial){
    const body=model.children.find(x=>x.isMesh);if(!body)return null;
    const source=body.geometry,geometry=body.geometry=source.clone(),position=geometry.attributes.position,colour=geometry.attributes.color;
    const uv=geometry.attributes.uv;
    const original=colour.array.slice(),raw=new Float32Array(original.length),heatWeight=new Float32Array(position.count),char=new Float32Array(position.count);
    const pink=new T.Color(0xad514b).convertSRGBToLinear(),marble=new T.Color(0xe99b88).convertSRGBToLinear();
    for(let i=0;i<position.count;i++){
      const x=position.getX(i),y=position.getY(i),z=position.getZ(i),j=3*i;
      const grain=clamp(.42+.25*Math.sin(x*73+Math.sin(z*27)*3)+.18*Math.cos(z*62+y*33)+.12*Math.sin(x*150-z*71));
      for(const [k,key] of ['r','g','b'].entries())raw[j+k]=pink[key]+(marble[key]-pink[key])*grain;
      // Planar sampling across the previously hidden face eliminates a radial texture pinch after the real half-turn.
      const underside=1-smooth((y-.022)/.031);if(underside>0){uv.setXY(i,uv.getX(i)*(1-underside)+(.50+.85*x)*underside,uv.getY(i)*(1-underside)+(.50+.85*z)*underside);}
      heatWeight[i]=smooth((y-.013)/.126);
      char[i]=.45+.28*Math.sin(x*21+z*17)+.15*Math.sin(z*92+x*13)+.09*Math.cos(x*85-z*63);
    }
    let key='',mapKey='',blend=null,context=null,material=null;
    const baked=body.material;
    if(rawMaterial?.map&&baked.map){
      const surface=document.createElement('canvas');surface.width=surface.height=512;context=surface.getContext('2d');
      blend=new T.CanvasTexture(surface);blend.encoding=T.sRGBEncoding;blend.anisotropy=2;
      material=baked.clone();material.map=blend;body.material=material;
    }
    function cook(a=0,b=0,flipped=false){
      a=Math.round(a);b=Math.round(b);
      if(context){
        const exposed=flipped?a+.12*b:b+.27*a,grade=Math.round(smooth((exposed-5)/67)*12),signature=grade+'/'+baked.map.version;
        if(signature!==mapKey){
          mapKey=signature;const face=grade/12;context.globalAlpha=1;context.drawImage(rawMaterial.map.image,0,0,512,512);context.globalAlpha=face;context.drawImage(baked.map.image,0,0,512,512);context.globalAlpha=1;blend.needsUpdate=true;
          material.bumpMap=face<.48?rawMaterial.bumpMap:baked.bumpMap;material.roughnessMap=face<.48?rawMaterial.roughnessMap:baked.roughnessMap;material.bumpScale=.0026+.0035*face;
        }
      }
      const signature=a+'/'+b;if(signature===key)return;key=signature;
      for(let i=0,j=0;i<position.count;i++,j+=3){
        const upper=heatWeight[i],effective=(1-upper)*a+upper*b+.29*(upper*a+(1-upper)*b),level=smooth((effective-5+char[i]*12)/74),burn=smooth((effective-88+char[i]*8)/35),dark=1-burn*(.33+.36*char[i]);
        for(let k=0;k<3;k++)colour.array[j+k]=(raw[j+k]+(original[j+k]-raw[j+k])*level)*dark;
      }
      colour.needsUpdate=true;
    }
    cook();return {cook,dispose(){geometry.dispose();blend?.dispose();material?.dispose();}};
  }
  const plated=new WeakMap();
  function finish(T,node,faces){
    if(!node||!Array.isArray(faces))return;
    const layer=node.name==='patty'?node:node.children.find(n=>n.name==='patty');
    const meat=layer?.children.find(m=>m.isMesh);if(!meat)return;
    const base=meat.geometry;
    let variants=plated.get(base);if(!variants){variants=new Map();plated.set(base,variants);}
    // Finite shared finish variants keep a shift full of diners within the same geometry budget.
    const grade=h=>h<28?15:h<58?44:h<=86?73:98;
    const a=grade(faces[0]),b=grade(faces[1]),key=a*100+b;
    if(variants.has(key)){meat.geometry=variants.get(key);return;}
    const sear=create(T,layer);sear.cook(b,a);variants.set(key,meat.geometry);
  }
  window.DinerSearing={create,finish};
})();
