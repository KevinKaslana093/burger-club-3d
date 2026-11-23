/* Finish the existing food meshes and packed surface maps once as they are built. */
(() => {
  'use strict';
  const clamp = n => Math.max(0, Math.min(1, n));
  const smooth = (a,b,n) => {const t=clamp((n-a)/(b-a));return t*t*(3-2*t);};
  const grainShadows=[];
  let heelMaterial;

  function finishHeel(mesh) {
    if(!window.document||!window.THREE)return;
    if(heelMaterial){mesh.material=heelMaterial;return;}
    const T=window.THREE,size=256;
    let seed=8041;
    function random(){seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;}
    function map(){
      const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
      const ctx=canvas.getContext('2d');
      return {canvas,ctx,pixels:ctx.createImageData(size,size)};
    }
    const paint=map(),relief=map(),pits=new Float32Array(size*size),rim=new Float32Array(size*size);
    for(let n=0;n<1770;n++){
      const cx=random()*size,cy=random()*size,rx=.33+2.4*random()**2,ry=rx*(.53+.46*random());
      const theta=random()*Math.PI,cs=Math.cos(theta),sn=Math.sin(theta);
      const reach=Math.ceil(rx+.8),depth=.30+.7*random();
      for(let dy=-reach;dy<=reach;dy++)for(let dx=-reach;dx<=reach;dx++){
        const x=Math.floor(cx+dx),y=Math.floor(cy+dy);
        if(x<0||y<0||x>=size||y>=size)continue;
        const sp=x+.5-cx,sy=y+.5-cy,ax=(sp*cs+sy*sn)/rx,ay=(sy*cs-sp*sn)/ry;
        const d=ax*ax+ay*ay,idx=y*size+x;
        if(d<1)pits[idx]=Math.max(pits[idx],depth*(1-d));
        if(sy>0)rim[idx]=Math.max(rim[idx],depth*clamp(1-Math.abs(1-d)*2.35));
      }
    }
    const a=paint.pixels.data,p=relief.pixels.data;
    for(let i=0;i<size*size;i++){
      const k=i*4,x=i%size,y=Math.floor(i/size),grit=random()-.5;
      const flour=.5+.24*Math.sin(x*.087+2.3*Math.sin(y*.073))+.19*Math.cos(y*.112+Math.sin(x*.048));
      const crumb=(flour-.5)*12+grit*7+rim[i]*10-pits[i]*41;
      a[k]=246+crumb;a[k+1]=241+crumb;a[k+2]=228+crumb*1.15;a[k+3]=255;
      p[k]=125+grit*11-68*pits[i]+18*rim[i];p[k+1]=192+15*flour+15*pits[i];p[k+3]=255;
    }
    function tex(map,encoding){
      map.ctx.putImageData(map.pixels,0,0);const texture=new T.CanvasTexture(map.canvas);
      texture.encoding=encoding;texture.anisotropy=2;return texture;
    }
    heelMaterial=mesh.material.clone();
    heelMaterial.map=tex(paint,T.sRGBEncoding);
    heelMaterial.bumpMap=heelMaterial.roughnessMap=tex(relief,T.LinearEncoding);
    heelMaterial.bumpScale=.0018;mesh.material=heelMaterial;
    // Diffuse browning from the same brioche photo as the crown. The heel
    // retains its own softer crumb relief and matte surface response.
    if(window.DinerFoodAtlas){
      const photo=new Image();
      photo.onload=()=>{
        const source=map();source.ctx.drawImage(photo,3,3,photo.width/2-6,photo.height/2-6,0,0,size,size);
        const image=source.ctx.getImageData(0,0,size,size).data;
        const mean=[0,0,0],N=size*size;
        for(let k=0;k<image.length;k+=4)for(let c=0;c<3;c++)mean[c]+=image[k+c]/N;
        for(let k=0;k<a.length;k+=4)for(let c=0;c<3;c++){
          const toasted=Math.min(1.20,Math.max(.55,image[k+c]/Math.max(20,mean[c])));
          a[k+c]*=.51+.49*toasted;
        }
        paint.ctx.putImageData(paint.pixels,0,0);heelMaterial.map.needsUpdate=true;
        window.dispatchEvent(new Event('diner-model-ready'));
      };
      photo.src=window.DinerFoodAtlas;
    }
  }

  function seedGroups(geometry, isSeed) {
    // The crown and kernels already share a draw call. Connected components
    // recover each kernel's footprint without tying it to a tessellation count.
    const links=new Int32Array(isSeed.length);links.fill(-1);
    const root=i=>{while(links[i]>=0){if(links[links[i]]>=0)links[i]=links[links[i]];i=links[i];}return i;};
    const index=geometry.index.array;
    for(let p=0;p<index.length;p+=3){
      if(!isSeed[index[p]])continue;
      const a=root(index[p]);
      for(let k=1;k<=2;k++){
        const b=root(index[p+k]);if(a!==b)links[b]=a;
      }
    }
    const groups=new Map();
    for(let i=0;i<isSeed.length;i++)if(isSeed[i]){
      const key=root(i);if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push(i);
    }
    return groups;
  }
  function sesame(geometry) {
    const {position:p,color:c,uv}=geometry.attributes;
    const isSeed=Uint8Array.from({length:c.count},(_,i)=>p.getY(i)>.07&&c.getY(i)>.47&&c.getZ(i)>.24);
    for(const ids of seedGroups(geometry,isSeed).values()){
      let x=0,y=0,z=0;
      for(const i of ids){x+=p.getX(i);y+=p.getY(i);z+=p.getZ(i);}
      x/=ids.length;y/=ids.length;z/=ids.length;
      const radial=Math.hypot(x,z);
      const scale=Math.min(.485,.264*Math.atan2(radial/.525,(y-.065)/.284))/radial;
      let xx=0,zz=0,xz=0;
      for(const i of ids){
        const dx=p.getX(i)-x,dz=p.getZ(i)-z;xx+=dx*dx;zz+=dz*dz;xz+=dx*dz;
      }
      const angle=.5*Math.atan2(2*xz,xx-zz),cs=Math.cos(angle),sn=Math.sin(angle);
      grainShadows.push({u:.5+x*scale,v:.5-z*scale,cs,sn:-sn});
      // Creamy sesame with toasted ends and a darker narrow side. Use the
      // neutral texel consistently, including kernels with lighter vertex tints.
      const roast=.5+.5*Math.sin(x*179+z*73);
      for(const i of ids){
        const dx=p.getX(i)-x,dz=p.getZ(i)-z;
        const along=(dx*cs+dz*sn)/.022,cross=(-dx*sn+dz*cs)/.011;
        const groove=Math.exp(-((cross-.21)**2)/.033)*clamp(1-along*along);
        const browned=clamp(.09+.34*roast+.37*along*along+.16*groove);
        c.setXYZ(i,.84-.275*browned,.66-.30*browned,.40-.22*browned);
        p.setXYZ(i,x+dx*.91,y+(p.getY(i)-y)*.86-.0019,z+dz*.91);
        uv.setXY(i,.006,.006);
      }
    }
  }
  function sculpt(id, mesh) {
    const g=mesh.geometry, {position:p,color:c,uv,normal:n}=g.attributes;
    if(id==='top')sesame(g);
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),y=p.getY(i),z=p.getZ(i),r=Math.hypot(x,z),a=Math.atan2(z,x);
      const R=c.getX(i),G=c.getY(i),B=c.getZ(i);
      if(id==='top'){
        if(uv.getX(i)<.009&&uv.getY(i)<.009)continue;
        // A thin honey-coloured proof line runs irregularly around the base.
        const belt=Math.exp(-((y-.055-.007*Math.sin(a*6+.1)-.004*Math.sin(a*13))**2)/.00055);
        const toast=smooth(.08,.30,y);
        c.setXYZ(i,R*(1.025+.035*toast)+belt*.062,G*(1.025+.06*toast)+belt*.077,B*(1.03+.09*toast)+belt*.041);
      }else if(id==='bottom'){
        const belt=Math.exp(-((y-.084-.010*Math.cos(a*5))**2)/.001);
        const toasted=smooth(.055,.003,y),flour=.5+.26*Math.sin(11*a+4*y)+.15*Math.cos(19*a);
        c.setXYZ(i,.725+.10*belt-.31*toasted+.049*flour,.36+.121*belt-.215*toasted+.035*flour,.14+.092*belt-.105*toasted+.025*flour);
        const ripple=smooth(.36,.49,r)*(.005*Math.sin(10*a+y*18)+.002*Math.cos(19*a-y*12));
        p.setXYZ(i,x*(1+ripple),y,z*(1+ripple));
      }else if(id==='patty'){
        // Irregular fried crags on the exposed perimeter, keeping both contact
        // planes and the stack height intact.
        const rough=Math.sin(63*a+18*y+1.3*Math.sin(13*a))*Math.sin(y*114+3*Math.sin(a*21));
        const side=smooth(.36,.49,r),edge=Math.sin(Math.PI*clamp(y/.149));
        const d=side*edge*(.006*rough+.0025*Math.sin(43*a-85*y));
        if(r>.001){p.setX(i,x*(1+d/r));p.setZ(i,z*(1+d/r));}
        const crack=smooth(.31,.87,-rough)*side;
        const fat=smooth(.47,.91,rough)*(.55+.45*Math.sin(a*9+3)**2);
        c.setXYZ(i,R*(.94-.22*crack)+.030*fat,G*(.96-.22*crack)+.018*fat,B*(.97-.18*crack)+.007*fat);
      }else if(id==='tomato'&&uv.getX(i)<.010&&uv.getY(i)<.010&&G<.39){
        // Map only the cut rind into a spare strip of the tomato atlas. The
        // cross-section and its existing seeds retain their original projection.
        const u=.5+.5*Math.sin(2.5*a+.47*Math.cos(a*6));
        const v=.014+.029*clamp(.20+.61*(n.getY(i)+.6));
        uv.setXY(i,.09+.84*u,v);
        const flesh=clamp(.42+.37*Math.sin(a*6+y*27)+.18*Math.sin(a*11-.4));
        c.setXYZ(i,R*(.88+.16*flesh),G*(.94+.18*flesh)+.008*flesh,B*(.86+.09*flesh));
      }else if(id==='lettuce'){
        const edge=smooth(.33,.57,r);
        p.setY(i,y+edge*(.005*Math.sin(42*a+16*r)+.0026*Math.sin(74*a-8*r)));
        const rim=clamp(edge*(.65+.28*Math.cos(17*a)));
        c.setXYZ(i,R*(.97+.13*rim),G*(.98+.035*rim),B*(.96-.03*rim));
      }
    }
    if(id==='patty'||id==='bottom'){g.computeVertexNormals();g.computeBoundingSphere();}
    if(id==='lettuce')g.computeBoundingSphere();
    if(id==='bottom')finishHeel(mesh);
    c.needsUpdate=uv.needsUpdate=p.needsUpdate=true;
  }
  function pressSeeds(albedo,packed,size) {
    for(const seed of grainShadows){
      const u=seed.u*size,v=seed.v*size;
      for(let y=Math.max(0,Math.floor(v-10));y<Math.min(size,v+10);y++){
        for(let x=Math.max(0,Math.floor(u-10));x<Math.min(size,u+10);x++){
          const dx=x-u,dy=y-v;
          const ax=(dx*seed.cs+dy*seed.sn)/(size*.0118);
          const az=(-dx*seed.sn+dy*seed.cs)/(size*.0065);
          const d=ax*ax+az*az;if(d>3.0)continue;
          const influence=Math.exp(-d*1.07),k=4*(y*size+x);
          albedo[k]*=1-.21*influence;albedo[k+1]*=1-.29*influence;albedo[k+2]*=1-.33*influence;
          packed[k]=Math.max(0,packed[k]-23*influence);
        }
      }
    }
  }
  function surface(kind, paint, relief) {
    const size=paint.canvas.width, a=paint.image.data, p=relief.image.data;
    const luminance=new Float32Array(size*size);
    for(let k=0;k<a.length;k+=4)luminance[k/4]=(a[k]*.25+a[k+1]*.60+a[k+2]*.15)/255;
    // Reuse the existing albedo as a source for fine relief. A second scale
    // separates pores and seared granules from the much larger surface features.
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      if(x<8&&y>size-9)continue;
      const j=y*size+x,k=j*4;
      const micro=luminance[((y*3+73)%size)*size+(x*3+101)%size];
      const local=luminance[j],mid=luminance[Math.min(size-1,y+3)*size+Math.min(size-1,x+3)];
      if(kind==='bread'){
        const amber=clamp((.884-local)*3.1),grain=micro-.91;
        a[k]*=1+grain*.16;a[k+1]*=1+grain*.19;a[k+2]*=1+grain*.22;
        p[k]=123+(p[k]-123)*.72+(local-mid)*42+grain*20;
        p[k+1]=Math.min(231,119+amber*42+(1-micro)*39);
      }else if(kind==='beef'){
        const charcoal=smooth(.77,.46,local),crumb=smooth(.67,.94,micro);
        const fine=(micro-.82)*.47+(local-mid)*.20;
        a[k]*=1+fine*.80;a[k+1]*=1+fine*.92;a[k+2]*=1+fine*.91;
        p[k]=125+(p[k]-125)*.84+fine*86+(local-mid)*62;
        p[k+1]=Math.min(238,107+95*charcoal+31*(1-crumb));
      }else if(kind==='leaf'){
        const vein=smooth(.90,1.0,local),fold=smooth(.85,.58,local);
        p[k]=122+(p[k]-122)*.77+vein*18-fold*10;
        p[k+1]=173-30*vein+13*fold;
      }else if(kind==='tomato'){
        const v=1-y/size;
        if(v>.009&&v<.053){
          const u=x/size,striation=.5+.5*Math.sin(u*149+.47*Math.sin(v*70+u*48));
          const damp=.5+.5*Math.sin(u*31+.7*Math.cos(v*82+u*11));
          a[k]=239+7*striation;a[k+1]=214+21*damp+4*striation;a[k+2]=211+12*damp;
          p[k]=121+13*striation*damp;p[k+1]=86+31*(1-damp);
        }else{
          const gel=smooth(.86,.56,local);
          p[k+1]=109-46*gel;p[k]=124+(p[k]-124)*.67+(local-mid)*18;
        }
      }
    }
    if(kind==='bread')pressSeeds(a,p,size);
  }
  window.DinerFoodDetail={surface,sculpt};
})();
