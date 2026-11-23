/* Fit one cheddar slice to the actual cooked patty without adding a draw call. */
((global)=>{
  'use strict';
  const clamp=x=>Math.max(0,Math.min(1,x));
  const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
  const terrain=new WeakMap(),tau=Math.PI*2;
  function heat(support,faces){
    if(support!=='patty'||!Array.isArray(faces)||faces.length!==2||!faces.every(Number.isFinite))return 0;
    // Side A faces the cheese once the patty has been turned onto the tray.
    // The second face contributes heat through the centre of the meat.
    const warm=.64*faces[0]+.25*faces[1]+.11*Math.min(...faces);
    return Math.round(4*smooth((warm-25)/56));
  }
  function profile(geometry){
    if(terrain.has(geometry))return terrain.get(geometry);
    const p=geometry.attributes.position,indices=geometry.index.array;
    const count=161,span=1.2,unit=span/(count-1),half=span/2;
    const heights=new Float32Array(count*count).fill(-Infinity),edge=new Float32Array(128);
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),z=p.getZ(i),a=(Math.atan2(z,x)/tau+1)%1;
      const ai=Math.round(a*edge.length)%edge.length;
      edge[ai]=Math.max(edge[ai],Math.hypot(x,z));
    }
    // Rasterize only once for all four heat grades. The highest triangle
    // includes both surface ridges and the irregular seared shoulder.
    for(let i=0;i<indices.length;i+=3){
      const ai=indices[i],bi=indices[i+1],ci=indices[i+2];
      const ax=p.getX(ai),az=p.getZ(ai),bx=p.getX(bi),bz=p.getZ(bi),cx=p.getX(ci),cz=p.getZ(ci);
      const den=(bx-ax)*(cz-az)-(bz-az)*(cx-ax);if(Math.abs(den)<1e-9)continue;
      const ix0=Math.max(0,Math.ceil((Math.min(ax,bx,cx)+half)/unit)),ix1=Math.min(count-1,Math.floor((Math.max(ax,bx,cx)+half)/unit));
      const iz0=Math.max(0,Math.ceil((Math.min(az,bz,cz)+half)/unit)),iz1=Math.min(count-1,Math.floor((Math.max(az,bz,cz)+half)/unit));
      for(let iz=iz0;iz<=iz1;iz++)for(let ix=ix0;ix<=ix1;ix++){
        const x=ix*unit-half-ax,z=iz*unit-half-az,u=(x*(cz-az)-z*(cx-ax))/den,v=((bx-ax)*z-(bz-az)*x)/den;
        if(u<0||v<0||u+v>1)continue;
        const y=p.getY(ai)*(1-u-v)+u*p.getY(bi)+v*p.getY(ci),j=iz*count+ix;
        heights[j]=Math.max(heights[j],y);
      }
    }
    const rim=edge.map((_,i)=>Math.max(edge[(i+127)%128],edge[i],edge[(i+1)%128]));
    function radius(a){
      const f=((a/tau+1)%1)*128,i=Math.floor(f);
      return rim[i]+(rim[(i+1)%128]-rim[i])*(f-i);
    }
    function height(x,z,fallback){
      const sx=(x+half)/unit,sz=(z+half)/unit,i=Math.floor(sx),j=Math.floor(sz);
      if(i<0||j<0||i+1>=count||j+1>=count)return fallback;
      const tx=sx-i,tz=sz-j;let y=0,w=0;
      for(let v=0;v<2;v++)for(let u=0;u<2;u++){
        const h=heights[(j+v)*count+i+u],weight=(u?tx:1-tx)*(v?tz:1-tz);
        if(Number.isFinite(h)){y+=h*weight;w+=weight;}
      }
      return w>.05?y/w:fallback;
    }
    const result={radius,height};terrain.set(geometry,result);return result;
  }
  function form(T,flat,meat,grade,pattyHeight,relative=[0,0]){
    const g=flat.geometry.clone(),p=g.attributes.position,c=g.attributes.color,n=g.attributes.normal,heat=grade/4;
    const support=profile(meat.geometry);
    const [offsetX,offsetZ]=relative;
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
      const meatX=x+offsetX,meatZ=z+offsetZ,r=Math.hypot(meatX,meatZ),a=Math.atan2(meatZ,meatX);
      const dx=r>0?meatX/r:0,dz=r>0?meatZ/r:0,shoulder=support.radius(a);
      const bend=.054+.008*Math.sin(3*a+.7),start=shoulder+.012-bend;
      const over=Math.max(0,r-start),arc=Math.min(Math.PI*.5,over/bend),wrap=smooth(over/.087);
      const hanging=Math.max(0,over-Math.PI*.5*bend);
      // Long unsupported edges continue out over the lower bun after folding
      // down the patty, instead of collapsing the entire overhang onto its side.
      const tail=Math.max(0,hanging-.09);
      const drapedR=over?start+bend*Math.sin(arc)+.006*smooth(hanging/.035)+tail*.89:r;
      const coldThickness=.016,top=.024+.0016*Math.cos(x*8+z*4)+.0014*Math.sin(z*10-x*2);
      const depth=clamp((top-y)/coldThickness);
      const shoulderY=support.height(dx*Math.min(r,start),dz*Math.min(r,start),pattyHeight)-pattyHeight;
      const topSlip=.0145+.0021*Math.sin(x*19-z*8)*Math.sin(z*13+.4);
      const drop=bend*(1-Math.cos(arc))+(hanging-tail)*(.83+.14*Math.cos(3*a+.7))+Math.min(.007,tail*.16);
      const fold=wrap*(.0036*Math.sin(a*14+.4)+.0022*Math.sin(a*23-1));
      const target=shoulderY+.0032+topSlip*(1-depth)-drop+fold;
      // Keep the top surface over the curved shoulders until it passes the
      // outside of the meat; below that edge the corner can hang freely.
      const sampled=support.height(dx*drapedR,dz*drapedR,-1);
      const floor=sampled<0?-1:sampled-pattyHeight+.0014+topSlip*(1-depth);
      const lowerBun=-pattyHeight+.002+topSlip*(1-depth);
      const contact=Math.min(.032,Math.max(target,floor,lowerBun));
      const radius=r+heat*(drapedR-r);
      p.setXYZ(i,dx*radius-offsetX,y+heat*(contact-y),dz*radius-offsetZ);
      const edge=wrap*(1-.46*Math.max(0,n.getY(i))),milk=.5+.5*Math.sin(a*5+.3);
      c.setXYZ(i,c.getX(i)*(1+.055*heat*edge),c.getY(i)*(1+.045*heat*edge),
        c.getZ(i)*(1+.083*heat*edge)+.005*heat*edge*milk);
    }
    g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
    const mat=flat.material.clone();mat.roughness=flat.material.roughness*(1-.13*heat);
    mat.bumpScale=flat.material.bumpScale*(1-.19*heat);mat.name='warm-cheddar-'+grade;
    return new T.Mesh(g,mat);
  }
  const offsetShapes=new WeakMap();
  function shifted(T,flat,meat,grade,height,relative){
    let cache=offsetShapes.get(flat.geometry);
    if(!cache){cache=new Map();offsetShapes.set(flat.geometry,cache);}
    const key=grade+'@'+relative[0].toFixed(3)+','+relative[1].toFixed(3);
    let mesh=cache.get(key);
    if(mesh)cache.delete(key);
    else{
      mesh=form(T,flat,meat,grade,height,relative);
      if(cache.size>=24){
        const [oldKey,old]=cache.entries().next().value;
        cache.delete(oldKey);old.geometry.dispose();old.material.dispose();
      }
    }
    cache.set(key,mesh);return mesh;
  }
  const sauceFits=new WeakMap();
  function drizzle(T,sauce,cheese,layerHeight,[dx,dz],meat,underlayOffset,meatHeight){
    let fits=sauceFits.get(cheese);
    if(!fits){
      fits=new Map();sauceFits.set(cheese,fits);
      cheese.addEventListener('dispose',()=>{for(const m of fits.values())m.geometry.dispose();fits.clear();});
    }
    const key=[dx,dz,...(underlayOffset||[])].map(x=>x.toFixed(3)).join(',');
    if(fits.has(key))return fits.get(key);
    const support=profile(cheese),underlay=meat&&profile(meat),g=sauce.geometry.clone(),pos=g.attributes.position;
    for(let i=0;i<pos.count;i++){
      const x=pos.getX(i)+dx,z=pos.getZ(i)+dz;
      const r=Math.hypot(x,z),rim=support.radius(Math.atan2(z,x));
      const s=Math.min(1,Math.max(0,rim-.012)/Math.max(.001,r));
      const draped=support.height(x*s,z*s,.017)-Math.min(.12,Math.max(0,r-rim)*.85);
      let y=support.height(x,z,draped);
      if(underlay)y=Math.max(y,underlay.height(x+underlayOffset[0],z+underlayOffset[1],-Infinity)-meatHeight);
      pos.setY(i,pos.getY(i)+y-layerHeight+.003);
    }
    g.computeVertexNormals();g.computeBoundingSphere();
    const mesh=new T.Mesh(g,sauce.material);
    if(fits.size>=24){const oldest=fits.keys().next().value;fits.get(oldest).geometry.dispose();fits.delete(oldest);}
    fits.set(key,mesh);
    return mesh;
  }
  global.DinerCheeseMelt={heat,form,shifted,drizzle};
})(typeof window==='object'?window:globalThis);
