/* Hand-built miniature diner figures and ingredients. THREE r128, y up, +z forward. */
(function (global) {
  'use strict';
  const T = global.THREE;
  if (!T) return;
  const tau = Math.PI * 2;
  const block = new T.BoxGeometry(1, 1, 1);
  const ball = new T.SphereGeometry(1, 18, 14);
  const small = new T.SphereGeometry(1, 12, 8);
  const point = (x, y, z) => new T.Vector3(x, y, z);
  const swatches = new Map();
  const foodCache = new Map();
  const peopleCache = new Map();
  const foodFinish = new T.MeshStandardMaterial({vertexColors: true, roughness: 0.65});
  const sauceFinish = new T.MeshStandardMaterial({vertexColors:true,roughness:.24,metalness:0});
  const figureFinish = new T.MeshStandardMaterial({vertexColors: true, roughness: 0.78});
  const cameraFinish=new T.MeshStandardMaterial({vertexColors:true,metalness:.22,roughness:.39});
  const hairFinish=new T.MeshStandardMaterial({vertexColors:true,roughness:.47});
  const croppedHairFinish=new T.MeshStandardMaterial({vertexColors:true,roughness:.67});
  const petalFinish=new T.MeshStandardMaterial({vertexColors:true,roughness:.68,side:T.DoubleSide});
  const kitchenSurfaces = new Map();
  const produceFinish = new T.MeshStandardMaterial({vertexColors:true,roughness:.43,side:T.DoubleSide});
  let atlasReady;
  function foodAtlas() {
    if(!atlasReady && global.DinerFoodAtlas && global.Image){
      atlasReady=new Promise(resolve=>{
        const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>resolve(null);im.src=global.DinerFoodAtlas;
      });
    }
    return atlasReady;
  }
  function blendFoodPhoto(kind,paint,relief,material) {
    const tile={bread:[0,0],beef:[1,0],leaf:[0,1],tomato:[1,1]}[kind];
    const ready=foodAtlas();
    if(!tile||!ready)return;
    ready.then(image=>{
      if(!image)return;
      const {canvas,context}=paint,size=canvas.width,hw=image.width/2,hh=image.height/2;
      const src=document.createElement('canvas');src.width=src.height=size;
      const ctx=src.getContext('2d');
      ctx.drawImage(image,tile[0]*hw+3,tile[1]*hh+3,hw-6,hh-6,0,0,size,size);
      const pixels=ctx.getImageData(0,0,size,size).data;
      const a=paint.image.data,p=relief.image.data;
      const sums=[0,0,0],count=pixels.length/4;
      for(let i=0;i<pixels.length;i+=4)for(let c=0;c<3;c++)sums[c]+=pixels[i+c]/count;
      const mixes={bread:.79,beef:.92,leaf:.84,tomato:.83},factor=mixes[kind];
      for(let i=0;i<pixels.length;i+=4){
        const x=(i/4)%size,y=Math.floor(i/(4*size));
        if(x<8&&y>size-9)continue;
        for(let c=0;c<3;c++){
          const value=pixels[i+c]/Math.max(sums[c],18);
          const local=Math.pow(Math.max(.016,value),kind==='beef'?.75:kind==='tomato'?.83:.55);
          a[i+c]=a[i+c]*(1-factor)+235*Math.min(1.12, local)*factor;
        }
        const height=.23*pixels[i]+.6*pixels[i+1]+.17*pixels[i+2];
        p[i]=p[i]*.60+(80+height*.66)*.40;
      }
      global.DinerFoodDetail?.surface(kind,paint,relief);
      context.putImageData(paint.image,0,0);relief.context.putImageData(relief.image,0,0);
      material.map.needsUpdate=material.bumpMap.needsUpdate=true;
      global.dispatchEvent(new Event('diner-model-ready'));
    });
  }

  function tint(hex) {
    if (!swatches.has(hex)) swatches.set(hex, new T.Color(hex).convertSRGBToLinear());
    return swatches.get(hex);
  }
  function rng(seed) {
    return () => {
      seed = (1664525 * seed + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }
  // Paint paired albedo and packed height/roughness maps once for each food surface.
  // The maps also supply the CPU renderer with the toasted crust and seared detail.
  function kitchenFinish(kind) {
    if(kitchenSurfaces.has(kind))return kitchenSurfaces.get(kind);
    const veg=kind==='leaf'||kind==='tomato';
    if(!global.document)return veg?produceFinish:foodFinish;
    const size=512,area=size*size;
    const seed={bread:19381,beef:47761,raw:65003,cheese:53629,leaf:28091,tomato:97433}[kind];
    const random=rng(seed), pockets=new Float32Array(area), rim=new Float32Array(area);
    const table=Float32Array.from({length:128*128},()=>random());
    const noise=(x,y,f)=>{
      const u=x*f,v=y*f,ix=Math.floor(u),iy=Math.floor(v);
      let a=u-ix,b=v-iy;a=a*a*(3-2*a);b=b*b*(3-2*b);
      const k=ix&127,l=(ix+1)&127,m=(iy&127)*128,n=((iy+1)&127)*128;
      return (table[m+k]*(1-a)+table[m+l]*a)*(1-b)+(table[n+k]*(1-a)+table[n+l]*a)*b;
    };
    const bread=kind==='bread',cheese=kind==='cheese',raw=kind==='raw';
    const count=veg?0:cheese?540:bread?3020:5010;
    for(let i=0;i<count;i++){
      const cx=random()*size,cy=random()*size,r=.63+Math.pow(random(),2)*(cheese?1.6:bread?3.6:4.3);
      const stretch=.45+random()*.7, rot=random()*tau,cs=Math.cos(rot),sn=Math.sin(rot);
      const pad=Math.ceil(r*1.55),strength=.38+.62*random();
      for(let j=-pad;j<=pad;j++)for(let k=-pad;k<=pad;k++){
        const xx=Math.floor(cx+k), yy=Math.floor(cy+j);
        if(xx<0||yy<0||xx>=size||yy>=size)continue;
        const dx=xx+.5-cx,dy=yy+.5-cy;
        const px=(dx*cs+dy*sn)/r,py=(dy*cs-dx*sn)/(r*stretch);
        const ds=px*px+py*py;
        if(ds>1.3)continue;
        const at=yy*size+xx;
        if(ds<1)pockets[at]=Math.max(pockets[at],(1-ds)*strength);
        if(dy>0)rim[at]=Math.max(rim[at],Math.max(0,1-Math.abs(ds-.91)*3.3)*strength);
      }
    }
    function canvasMap() {
      const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
      const context=canvas.getContext('2d');return {canvas,context,image:context.createImageData(size,size)};
    }
    const paint=canvasMap(),relief=canvasMap(),albedo=paint.image.data,physical=relief.image.data;
    const byte=n=>Math.min(255,Math.max(0,n));
    for(let j=0;j<size;j++)for(let i=0;i<size;i++){
      const x=i/size,y=j/size,index=j*size+i,k=index*4;
      const coarse=noise(x,y,5),mid=noise(x+.27,y+.31,18),fine=noise(x+.39,y+.74,61);
      const grit=(random()-.5), pits=pockets[index], lip=rim[index];
      let r,g,b,h,rough;
      if(veg){
        const speck=(mid-.5)*13+(fine-.5)*11+grit*7;
        r=247+speck;g=247+speck;b=244+speck;
        h=123+(fine-.5)*22+(mid-.5)*17;rough=(kind==='leaf'?169:90)+(mid-.5)*34;
      }else if(bread){
        const toast=Math.min(1,Math.max(0,(.55*coarse+.29*mid+.16*fine-.43)*2.85));
        const grain=grit*9+lip*13-pits*41;
        r=254-toast*20+grain;g=253-toast*44+grain;b=249-toast*64+grain;
        h=125+(fine-.5)*31+(mid-.5)*19+grit*12-pits*69+lip*20;
        rough=190+(mid-.5)*46+pits*38;
      }else if(cheese){
        const oil=clipped((.49*coarse+.35*mid+.16*fine-.48)*2.8);
        const milk=(mid-.5)*10+(fine-.5)*6;
        r=249+milk+grit*2-pits*7;g=248+milk+oil*3-(1-mid)*6-pits*7;b=235+milk+oil*7-pits*10;
        h=125+(mid-.5)*15+(fine-.5)*10-pits*24;rough=149-oil*60+(fine-.5)*21;
      }else{
        const islands=Math.max(0,(mid*.62+fine*.38-.48)*2.6);
        const crust=Math.max(0,1-Math.abs(noise(x+.72,y+.07,29)-.48)*8)*(.35+.65*mid);
        const charring=raw?0:Math.min(1,.70*islands+.68*crust+.60*pits);
        const meatGrain=grit*16+(fine-.5)*31+lip*23-pits*(raw?32:49);
        r=253-charring*76+meatGrain;g=246-charring*104+meatGrain;b=239-charring*100+meatGrain;
        h=119+(mid-.5)*69+(fine-.5)*75+grit*22-pits*68+lip*33-crust*21;
        rough=(raw?111:145)+charring*76+(mid-.5)*53-lip*32;
      }
      // Tiny untextured sample reserved for separate seed geometry.
      if(i<7&&j>size-8){r=g=b=255;rough=185;h=127;}
      albedo[k]=byte(r);albedo[k+1]=byte(g);albedo[k+2]=byte(b);albedo[k+3]=255;
      physical[k]=byte(h);physical[k+1]=byte(rough);physical[k+2]=0;physical[k+3]=255;
    }
    function texture(map,encoding){
      map.context.putImageData(map.image,0,0);
      const t=new T.CanvasTexture(map.canvas);t.encoding=encoding;t.anisotropy=2;return t;
    }
    const map=texture(paint,T.sRGBEncoding), packed=texture(relief,T.LinearEncoding);
    const material=new T.MeshStandardMaterial({vertexColors:true,map,roughness:1,roughnessMap:packed,bumpMap:packed,
      bumpScale:veg ? .0017 : cheese ? .0009 : bread ? .0028 : raw ? .0036 : .0062,metalness:0,
      side:kind==='leaf'?T.DoubleSide:T.FrontSide});
    blendFoodPhoto(kind,paint,relief,material);
    kitchenSurfaces.set(kind,material);return material;
  }
  function texturedFood(mesh,id) {
    const kind={top:'bread',bottom:'bread',patty:'beef',raw:'raw',cheese:'cheese',lettuce:'leaf',tomato:'tomato'}[id];
    if(!kind)return mesh;
    const geo=mesh.geometry,pos=geo.attributes.position,colors=geo.attributes.color;
    const uv=new Float32Array(pos.count*2);
    for(let i=0;i<pos.count;i++){
      const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
      if(id==='lettuce'||id==='tomato'){
        const coords=geo.attributes.uv;
        uv[i*2]=coords?coords.getX(i):.006;uv[i*2+1]=coords?coords.getY(i):.006;
      }else if(id==='cheese'){
        uv[i*2]=.50+.92*x;uv[i*2+1]=.50+.92*z;
      }else{
        // Unfold each round top and side into a continuous disk. Equidistant
        // crown coordinates keep individual pores round at the front of the bun.
        const radius=Math.hypot(x,z),fraction=id==='top' ?
          .264*Math.atan2(radius/.525,(y-.065)/.284) :
          .64*radius+Math.max(0,(id==='bottom'?.152:.166)-y)*.91;
        const stretch=radius>.00001 ? Math.min(.485,fraction)/radius : 0;
        uv[i*2]=.50+x*stretch;uv[i*2+1]=.50+z*stretch;
      }
      if(id==='top'&&colors.getY(i)>.54&&colors.getZ(i)>.21){uv[i*2]=uv[i*2+1]=.006;}
    }
    geo.setAttribute('uv',new T.BufferAttribute(uv,2));mesh.material=kitchenFinish(kind);
    global.DinerFoodDetail?.sculpt(id,mesh);
    return mesh;
  }
  // Bake each sculpture into one indexed, vertex-coloured mesh. Even sesame seeds
  // and freckles only add vertices, so an assembled burger uses one draw per layer.
  function sculpture(finish, preserveUV=false) {
    const positions = [], normals = [], colors = [], indices = [];
    const coordinates=[];
    const matrix = new T.Matrix4(), normalMatrix = new T.Matrix3();
    const q = new T.Quaternion(), e = new T.Euler(), p = new T.Vector3(), n = new T.Vector3();
    function part(geometry, color, x=0, y=0, z=0, sx=1, sy=1, sz=1, rx=0, ry=0, rz=0) {
      const offset = positions.length / 3;
      q.setFromEuler(e.set(rx, ry, rz));
      matrix.compose(point(x,y,z), q, point(sx,sy,sz));
      normalMatrix.getNormalMatrix(matrix);
      const v = geometry.attributes.position, vn = geometry.attributes.normal, c = tint(color);
      const painted=geometry.attributes.color;
      for (let i=0; i<v.count; i++) {
        p.fromBufferAttribute(v,i).applyMatrix4(matrix);
        n.fromBufferAttribute(vn,i).applyNormalMatrix(normalMatrix);
        positions.push(p.x,p.y,p.z);
        if(preserveUV){
          const uv=geometry.attributes.foodUV;
          coordinates.push(uv?uv.getX(i):.006,uv?uv.getY(i):.006);
        }
        normals.push(n.x,n.y,n.z);
        if(painted)colors.push(c.r*painted.getX(i),c.g*painted.getY(i),c.b*painted.getZ(i));
        else colors.push(c.r,c.g,c.b);
      }
      if (geometry.index) {
        const a = geometry.index.array;
        for (let i=0; i<a.length; i++) indices.push(offset+a[i]);
      } else {
        for (let i=0; i<v.count; i++) indices.push(offset+i);
      }
    }
    function oval(color,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0) {
      part(Math.max(sx,sy,sz)<0.095 ? small : ball,color,x,y,z,sx,sy,sz,rx,ry,rz);
    }
    function line(color, coords, thickness, closed=false) {
      const path = new T.CatmullRomCurve3(coords.map(c=>point(...c)), closed, 'centripetal');
      const geometry = new T.TubeGeometry(path, Math.max(8,3*coords.length), thickness, 6, closed);
      part(geometry,color);
      geometry.dispose();
    }
    function band(color,x,y,z,radiusX,radiusZ,radiusY,thickness,rx=0,ry=0,rz=0) {
      // Torus lies in the xy plane, e.g. spectacles.
      const geo = new T.TorusGeometry(1,thickness,6,32);
      part(geo,color,x,y,z,radiusX,radiusY,radiusZ,rx,ry,rz);
      geo.dispose();
    }
    function finishMesh() {
      const geo = new T.BufferGeometry();
      geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));
      geo.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
      geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));
      if(preserveUV)geo.setAttribute('uv',new T.Float32BufferAttribute(coordinates,2));
      geo.setIndex(indices); geo.computeBoundingSphere();
      return new T.Mesh(geo, finish);
    }
    return {part,oval,line,band,finishMesh,get vertexCount(){return positions.length/3;}};
  }

  function surface(rows, columns, xyz, wrap=true) {
    const vertices=[], elements=[];
    const width = wrap ? columns : columns+1;
    for (let i=0;i<=rows;i++) {
      for (let j=0;j<width;j++) vertices.push(...xyz(i/rows,j/columns,i,j));
    }
    for(let i=0;i<rows;i++) for(let j=0;j<columns;j++) {
      const a=i*width+j,b=i*width+(j+1)%width;
      elements.push(a,b,a+width,b,b+width,a+width);
    }
    const g=new T.BufferGeometry();
    g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
    g.setIndex(elements); g.computeVertexNormals();
    return g;
  }
  function radial(s, profile, color, distortion, count=56) {
    const geometry=surface(profile.length-1,count,(_u,v,i)=>{
      const [r,h]=profile[i], a=tau*v;
      let rr=r, yy=h;
      if (distortion) [rr,yy]=distortion(r,h,a,i);
      return [rr*Math.sin(a), yy, rr*Math.cos(a)];
    });
    if(typeof color==='function'){paintGeometry(geometry,color);s.part(geometry,'#FFFFFF');}
    else s.part(geometry,color);
    geometry.dispose();
  }
  function ovalRing(s,color,cx,y,cz,r,h,thickness) {
    const coords=Array.from({length:24},(_,i)=>[cx+r*Math.sin(tau*i/24), y, cz+h*Math.cos(tau*i/24)]);
    s.line(color,coords,thickness,true);
  }
  const heights=Object.freeze({bottom:.124,patty:.145,raw:.16,cheese:.032,lettuce:.070,tomato:.078,pickle:.044,onion:.041,smoke:.018,top:.320});
  const clipped=v=>Math.min(1,Math.max(0,v));
  function grain(x,y,z) {
    const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z);
    const smooth=v=>v*v*(3-2*v);
    const a=smooth(x-ix),b=smooth(y-iy),c=smooth(z-iz);
    const hash=(u,v,w)=>{
      let h=Math.imul(u,73856093)^Math.imul(v,19349663)^Math.imul(w,83492791);
      h=Math.imul(h^(h>>>16),0x45d9f3b);return ((h^(h>>>16))>>>0)/4294967295;
    };
    let sum=0;
    for(let i=0;i<2;i++)for(let j=0;j<2;j++)for(let k=0;k<2;k++)
      sum+=hash(ix+i,iy+j,iz+k)*(i?a:1-a)*(j?b:1-b)*(k?c:1-c);
    return sum;
  }
  function addPainted(g,s,tone,uvAt) {
    paintGeometry(g,tone);
    if(uvAt){
      const p=g.attributes.position, tex=new Float32Array(p.count*2);
      for(let i=0;i<p.count;i++){
        const [u,v]=uvAt(i,p.getX(i),p.getY(i),p.getZ(i));tex[i*2]=u;tex[i*2+1]=v;
      }
      g.setAttribute('foodUV',new T.BufferAttribute(tex,2));
    }
    s.part(g,'#FFFFFF');g.dispose();
  }
  const bunProfile=[[.002,.004],[.425,.003],[.484,.008],[.515,.023],[.529,.052],
        [.532,.084],[.524,.119],[.510,.152],[.480,.193],[.442,.227],
        [.396,.256],[.337,.282],[.265,.303],[.178,.317],[.091,.324],[.002,.326]];
  function briochePoint(r,h,a) {
    const u=r/.532, fold=.012*Math.cos(4*a+.3)+.011*Math.cos(7*a+1.2)+.006*Math.sin(11*a-1.7);
    const radius=r*(1+fold*(.3+.7*u))+(grain(r*Math.sin(a)*9,h*9,r*Math.cos(a)*9)-.5)*.008*u;
    const crown=h/.326;
    return [radius*Math.sin(a)*1.022-.023*crown,
      h+u*(.006*Math.sin(a-1.7)+.004*Math.cos(4*a+.6))+.009*Math.sin(crown*Math.PI)*Math.cos(a+.4),
      radius*Math.cos(a)*.983+.013*crown];
  }
  function bun(s,top,random) {
    if(!top){
      radial(s,[[.002,.003],[.38,.003],[.455,.012],[.483,.029],[.49,.055],[.498,.093],[.492,.116],[.469,.128],[.30,.129],[.002,.127]],
        (x,y,z)=>ramp('#A8572D','#F5C98B',clipped(.26+5.5*y+.24*grain(x*21,y*26,z*21))),
        (r,h,a)=>[r*(1+.015*Math.cos(a*3+.6)+.008*Math.sin(9*a)),h+.003*r*Math.sin(5*a)],84);
      return;
    }
    const crown=surface(bunProfile.length-1,112,(_u,v,i)=>briochePoint(...bunProfile[i],v*tau));
    addPainted(crown,s,(x,y,z)=>{
      const a=Math.atan2(x,z), ring=Math.min(1,Math.hypot(x,z)*2.3);
      const mottled=grain(x*8+3.1,y*5,z*8-1);
      const baked=clipped(.14+.70*Math.pow(clipped((y-.026)/.255),.80)+.32*(mottled-.5)-.055*Math.cos(a*7)*ring);
      const crust=ramp('#ECAF65','#9B4522',baked);
      const cut=.014+.008*grain(x*14,1,z*14)+.003*Math.sin(a*9);
      const crumb=clipped((cut+.005-y)/.012);
      return crust.lerp(ramp('#BF8454','#F3D398',.49+.46*grain(x*45,y*70,z*45)),crumb);
    });
    const seed=surface(6,10,(u,v)=>{
      const d=Math.sin(Math.PI*u)**.70*(.80+.34*u);
      return [-d*Math.sin(v*tau),d*.75*Math.cos(v*tau)+.16*Math.sin(u*Math.PI),u*2-1];
    });
    // Keep individual grains flush with the sloping crust; irregular little
    // clusters of two and three leave open patches in the egg-washed surface.
    const profile=bunProfile.slice(5).reverse(), grains=[];
    function topPoint(r,a){
      let k=1;while(k<profile.length-1&&profile[k][0]<r)k++;
      const [r0,h0]=profile[k-1],[r1,h1]=profile[k],h=h0+(h1-h0)*(r-r0)/(r1-r0);
      return new T.Vector3(...briochePoint(r,h,a));
    }
    for(let i=0;i<65;i++){
      const ca=i*2.399963+(random()-.5)*.30,cr=.505*Math.sqrt((i+.5)/65);
      const cx=cr*Math.sin(ca),cz=cr*Math.cos(ca);
      const count=1+Math.floor(random()*2.9);
      for(let j=0;j<count;j++){
        const x=cx+(random()-.5)*.092,z=cz+(random()-.5)*.095, r=Math.hypot(x,z);
        if(r>.510||r<.012||grains.some(p=>(p[0]-x)**2+(p[1]-z)**2<.00088))continue;
        grains.push([x,z]);
        const a=Math.atan2(x,z),p=topPoint(r,a);
        const v1=topPoint(r+.0005,a).sub(p),v2=topPoint(r,a+.001).sub(p);
        const normal=v1.cross(v2).normalize();if(normal.y<0)normal.negate();
        const q=new T.Quaternion().setFromUnitVectors(point(0,1,0),normal);
        q.multiply(new T.Quaternion().setFromAxisAngle(point(0,1,0),random()*tau));
        const e=new T.Euler().setFromQuaternion(q);p.addScaledVector(normal,.0035);
        s.part(seed,i%5?'#E2C29C':'#F1D5A8',p.x,p.y,p.z,.0085+random()*.003,.009,.016+random()*.009,e.x,e.y,e.z);
      }
    }
    seed.dispose();
  }
  function meat(s,cooked) {
    const profile=[[.002,.010],[.28,.008],[.43,.012],[.482,.017],[.494,.027],[.501,.039],
      [.494,.052],[.488,.065],[.495,.081],[.486,.097],[.488,.113],[.474,.128],[.443,.139],
      [.4,.143],[.35,.144],[.30,.145],[.25,.144],[.20,.144],[.15,.145],[.10,.145],[.05,.145],[.002,.145]];
    const rings=profile.length-1;
    const g=surface(rings,144,(_u,v,i)=>{
      const a=tau*v,[r,y]=profile[i],x=r*Math.sin(a),z=r*Math.cos(a);
      const lumps=grain(x*15,y*34,z*15)-.5,lacy=grain(x*44,y*49,z*44)-.5;
      const edge=clipped((r-.36)/.13);
      const rough=cooked?.037:.019;
      const radius=r*(1+.027*Math.cos(3*a-.9)+.017*Math.sin(5*a+1.3)+.013*Math.sin(11*a))+
        edge*(rough*lumps+rough*.65*lacy);
      const lift=(grain(x*18,2.8,z*18)-.5)*.021+
        edge*(.011*Math.cos(7*a)+.008*Math.sin(14*a+.35))+(i<13?lumps*.011:0);
      return [Math.sin(a)*radius,y+(cooked?lift:.60*lift),Math.cos(a)*radius*.985];
    });
    addPainted(g,s,(x,y,z)=>{
      const marbling=grain(x*18,y*33,z*18), grainTerm=grain(x*46,y*58,z*46);
      if(!cooked)return ramp('#9C514B','#DD9785',.27+.48*marbling+.25*grainTerm);
      const face=clipped((y-.112)*28), rib=Math.abs(Math.sin((z*.93+x*.36)*30+.45*Math.sin(x*12)));
      const scorched=face*clipped((.45-rib)*2.1)*(.4+.6*marbling);
      return ramp('#30201B','#A46438',.09+.62*marbling+.25*grainTerm+.08*(1-face)-.48*scorched);
    });
  }
  function leafBed(s) {
    const angles=[.06,1.24,2.57,3.75,5.04], rows=28, cols=38;
    angles.forEach((angle,index)=>{
      const spread=[.255,.29,.262,.295,.266][index], length=[.585,.566,.595,.56,.573][index];
      const phase=index*.79+.31;
      function leaf(u,v){
        const t=v*2-1, tip=Math.sin(Math.PI*u)**.62;
        const curl=Math.abs(t)**1.7, margin=clipped((u+.3*Math.abs(t)-.56)*2);
        const lobes=1+.062*Math.sin(t*12+u*9+phase)+.036*Math.sin(t*23-u*7);
        const r=.012+length*u+tip*(.014*Math.cos(phase+4*t)+margin*.013*Math.sin(14*t+phase));
        const w=spread*tip*(.74+.56*u)*lobes;
        const cross=t*w+.052*Math.sin(u*3+phase)*u;
        const a=angle+.085*Math.sin(3*u+phase);
        const x=Math.sin(a)*r-Math.cos(a)*cross,z=Math.cos(a)*r+Math.sin(a)*cross;
        const y=.010+index*.003+.018*Math.sin(u*Math.PI)+.009*u+.012*u*Math.sin(phase+u*4)+
          tip*(.029*curl+.011*Math.cos(t*11-u*8+phase)*curl+
          margin*(.024*Math.sin(t*15+u*10+phase)+.010*Math.cos(t*28-u*9)))+
          .009*Math.cos(t*19-u*9)*u*tip;
        return [x,y,z];
      }
      const g=surface(rows,cols,leaf,false);
      addPainted(g,s,(x,y,z,i)=>{
        const u=Math.floor(i/(cols+1))/rows,v=i%(cols+1)/cols,t=Math.abs(v*2-1);
        const light=.18+.32*u+.15*t+.18*grain(x*20,y*20,z*20)+.12*Math.sin((u*7-t*2.2)*2.8+phase);
        const green=ramp('#2C5835','#93B05A',light);
        return green.lerp(tint('#C6CD85'),.28*Math.exp(-t*t*42)*(1-u));
      },i=>[.045+.91*(i%(cols+1)/cols),.035+.92*Math.floor(i/(cols+1))/rows]);
      function ridge(u0,u1,vEnd,thick){
        const bands=12,g=surface(bands,3,(u,v)=>{
          const local=u0+(u1-u0)*u, center=.5+(vEnd-.5)*u**.79;
          const t=thick*(1-.88*u),p=leaf(local,center+(v-.5)*t);
          p[1]+=.001+.003*Math.sin(v*Math.PI)*(1-.75*u);return p;
        },false);
        addPainted(g,s,(_x,_y,_z,i)=>ramp('#8CAD69','#CFD69A',vEnd===.5?.61:.24+.15*Math.cos(i)));
      }
      ridge(.07,.92,.5,.033);
      for(let k=0;k<5;k++)for(const side of [-1,1]){
        const start=.21+k*.115+.012*Math.sin(phase+side);
        ridge(start,Math.min(.97,start+.19),.5+side*(.40-.12*k/4),.012);
      }
    });
  }
  function tomatoSlices(s) {
    const slices=[[-.104,.010,.038,.363,.11],[.116,.038,-.032,.364,1.04]];
    const rings=[[.001,0],[.74,0],[.94,.002],[.997,.007],[1,.026],[.978,.035],[.949,.038],[.85,.038],[.72,.036],[.58,.034],[.44,.035],[.29,.038],[.14,.039],[.001,.041]];
    slices.forEach(([cx,cy,cz,rad,rot])=>{
      const seg=84;
      function slicePoint(_u,v,i){
        const a=v*tau,[r,h]=rings[i],w=1+.045*Math.sin(3*a+rot)+.02*Math.cos(6*a-rot)+.015*Math.sin(8*a);
        return [cx+rad*w*r*Math.sin(a),cy+h+.006*r*Math.cos(2*a+rot)+.005*r*Math.sin(a),cz+rad*.93*r*w*Math.cos(a)];
      }
      addPainted(surface(rings.length-1,seg,slicePoint),s,(x,y,z,i)=>{
        const ring=Math.floor(i/seg),a=Math.atan2(x-cx,z-cz)+rot;
        if(ring<6)return ramp('#9F302A','#DD5137',.32+.24*Math.cos(3*a)+.22*grain(x*13,2,z*13));
        const rr=Math.hypot(x-cx,z-cz)/rad, core=clipped(1-rr*3.7);
        return ramp('#C73F32','#F99A63',.22+.30*core+.2*(.5+.5*Math.cos(5*a))+.16*(1-rr));
      },(i,x,y,z)=>{
        if(Math.floor(i/seg)<6)return [.006,.006];
        const xx=(x-cx)/(rad*2.3),zz=(z-cz)/(rad*2.3);
        return [.5+xx*Math.cos(rot)-zz*Math.sin(rot),.5+xx*Math.sin(rot)+zz*Math.cos(rot)];
      });
      for(let j=0;j<5;j++){
        const a=tau*j/5+rot;
        for(let k=0;k<2;k++){
          const t=a+(.15+k*.22),r=rad*(.50+.10*Math.sin(t*4));
          s.oval('#EBC07C',cx+Math.sin(t)*r,cy+.041,cz+Math.cos(t)*r,.005,.0018,.011,0,t+.4,0);
        }
      }
    });
  }
  // A squeeze starts with a small pool, spirals out and trails off as the
  // nozzle lifts. Successive rings also define the dispensing animation.
  function smokeSauce(){
    const rows=176,cols=16;
    function path(t){
      const a=(t*2.38+.62)*tau,r=.025+.471*t;
      return [r*Math.sin(a)*(1+.054*Math.sin(3*a+.5))+.012*(1-t),
        r*Math.cos(a)*(1+.041*Math.sin(4*a-.45))];
    }
    const g=surface(rows,cols,(t,v)=>{
      const [x,z]=path(t),[ax,az]=path(t-.0001),[bx,bz]=path(t+.0001);
      const dx=bx-ax,dz=bz-az,len=Math.hypot(dx,dz);
      const nozzle=Math.min(1,Math.sqrt(t*95),Math.sqrt((1-t)*46));
      const width=(.043+.009*Math.sin(t*34+.35)+.012*(1-t)**5)*nozzle;
      const u=tau*v,height=(.0135+.002*Math.cos(t*20)) * nozzle;
      return [x+dz/len*width*Math.cos(u),.005+height*Math.sin(u),z-dx/len*width*Math.cos(u)];
    });
    g.userData.nozzleSides=cols;
    paintGeometry(g,(x,y,z)=>ramp('#762E20','#B6512E',.22+.28*grain(x*18,0,z*18)
      +.32*clipped((y+.005)/.026)+.08*Math.sin(x*7+z*6)));
    return new T.Mesh(g,sauceFinish);
  }
  function makeFood(id) {
    if(id==='smoke')return smokeSauce();
    const s=sculpture(foodFinish,id==='lettuce'||id==='tomato'), random=rng(481+id.length*7);
    if(id==='bottom'||id==='top') {
      bun(s,id==='top',random);
    } else if(id==='patty'||id==='raw') {
      meat(s,id==='patty');
    } else if(id==='cheese') {
      const edge=.425;
      function cheesePoint(i,j,depth){
        const u=i*2-1,v=j*2-1,round=clipped((Math.abs(u)+Math.abs(v)-1.82)*3);
        let x=u*(edge-.016*round)+.014+.006*v*v*Math.sin(u*6+v*3);
        let z=v*(edge-.017*round)-.009+.005*u*u*Math.sin(v*7+u);
        const a=.18;
        const xx=x*Math.cos(a)-z*Math.sin(a),zz=x*Math.sin(a)+z*Math.cos(a);
        const h=.024+.0016*Math.cos(xx*8+zz*4)+.0014*Math.sin(zz*10-xx*2);
        return [xx,h-depth*.016,zz];
      }
      const sections=32;
      let g=surface(sections,sections,(i,j)=>cheesePoint(i,j,0),false);
      paintGeometry(g,(x,y,z)=>ramp('#C18335','#F2BF66',.32+.35*grain(x*12,1,z*12)+.13*Math.sin(8*x+4*z)+.07*grain(x*45,3,z*45)));
      s.part(g,'#FFFFFF');g.dispose();
      g=surface(sections,sections,(i,j)=>cheesePoint(1-i,j,1),false);s.part(g,'#C58A42');g.dispose();
      for(let side=0;side<4;side++){
        const f=(i,j)=>side===0?cheesePoint(j,0,i):side===1?cheesePoint(1,j,i):side===2?cheesePoint(1-j,1,i):cheesePoint(0,1-j,i);
        g=surface(2,sections,f,false);s.part(g,'#E2A851');g.dispose();
      }
    } else if(id==='lettuce') {
      leafBed(s);
    } else if(id==='tomato') {
      tomatoSlices(s);
    } else if(id==='pickle'){
      const profile=[[.003,.002],[.90,.003],[.985,.007],[1,.016],[.993,.032],[.960,.039],
        [.925,.042],[.85,.042],[.77,.042],[.69,.042],[.61,.042],[.53,.042],[.45,.042],[.37,.042],
        [.29,.042],[.21,.042],[.13,.042],[.06,.042],[.003,.042]];
      for(let i=0;i<3;i++){
        const a=tau*i/3+.28,cx=.248*Math.sin(a),cz=.245*Math.cos(a),phase=i*1.8;
        const angle=.8*i+.34, cs=Math.cos(angle),sn=Math.sin(angle), count=60;
        const ripple=(x,z)=>.0045*Math.sin(64*x-18*z+.61*Math.sin(z*13+phase));
        const f=(_u,v,row)=>{
          const t=tau*v,[r,h]=profile[row];
          const edge=1+.030*Math.sin(5*t+phase)+.023*Math.cos(9*t-1.3)+.014*Math.sin(t*16+phase);
          const x=Math.sin(t)*r*.203*edge,z=Math.cos(t)*r*.171*edge;
          return [cx+x*cs-z*sn,h+ripple(x,z)+i*.002,cz+x*sn+z*cs];
        };
        addPainted(surface(profile.length-1,count,f),s,(x,_y,z,idx)=>{
          const j=Math.floor(idx/count),a0=Math.atan2(x-cx,z-cz),marble=grain(x*35,1,z*35);
          if(j<6)return ramp('#425932','#779245',.20+.44*marble+.24*Math.cos(9*a0));
          const t=clipped((.22-Math.hypot(x-cx,z-cz))*2.3);
          return ramp('#7C9447','#C1BD6D',.17+t+.34*marble+.12*Math.cos(3*a0+phase));
        });
        for(let j=0;j<6;j++){
          const t=tau*j/6+phase,dx=.074*Math.sin(t),dz=.056*Math.cos(t);
          s.oval('#D2C88A',cx+dx*cs-dz*sn,.044+i*.002+ripple(dx,dz),cz+dx*sn+dz*cs,.006,.002,.016,0,t-angle,0);
        }
      }
    } else if(id==='onion') {
      for(let i=0;i<3;i++) {
        const a=tau*i/3+.3,x=.18*Math.sin(a),z=.18*Math.cos(a),y=.023+i*.007;
        ovalRing(s,'#B0668F',x,y,z,.253,.21,.024);
        ovalRing(s,'#F1C8D9',x,y+.007,z,.234,.193,.018);
      }
    }
    return texturedFood(s.finishMesh(),id);
  }

  const looks=[
    {skin:'#EFB287',blush:'#D98169',hair:'#783D29',shine:'#A75936',coat:'#F0AE31',shirt:'#FFF4D7',accent:'#268E8F',style:'band',freckle:true},
    {skin:'#986347',blush:'#945942',hair:'#3C2B28',shine:'#56382D',coat:'#2A9989',shirt:'#F7DEAC',accent:'#E77A44',style:'curls'},
    {skin:'#D99D78',blush:'#C67C64',hair:'#51372C',shine:'#70503B',coat:'#447483',shirt:'#E9C795',accent:'#D75736',style:'cap'},
    {skin:'#F0BE99',blush:'#DC9583',hair:'#302C33',shine:'#4F4248',coat:'#B25970',shirt:'#FEEDD3',accent:'#4A383C',style:'bob',glasses:true},
    {skin:'#B77859',blush:'#AD6855',hair:'#4F332B',shine:'#754A33',coat:'#E68447',shirt:'#FCE4BC',accent:'#F2CF5A',style:'bun'},
    {skin:'#DEAA87',blush:'#CA8C72',hair:'#8E8176',shine:'#ACA397',coat:'#657955',shirt:'#EDD4AF',accent:'#5F493A',style:'gent',glasses:true},
    {skin:'#BF815E',blush:'#B26E56',hair:'#3F2B22',shine:'#66412C',coat:'#507DA0',shirt:'#FFE1A3',accent:'#EC855E',style:'twins',freckle:true},
    {skin:'#F1BF95',blush:'#DA9177',hair:'#B76B3C',shine:'#D88D4A',coat:'#B95843',shirt:'#F3DCB2',accent:'#2F877E',style:'knit',freckle:true},
    {skin:'#CE9870',blush:'#BE7E64',hair:'#41332F',shine:'#604A3C',coat:'#785D8F',shirt:'#F5DCAD',accent:'#D5B85E',style:'swept'},
    {skin:'#D7A079',blush:'#BA7F69',hair:'#262E30',shine:'#46585A',coat:'#566D72',shirt:'#C5BF9F',accent:'#AB633A',style:'quiff'},
    {skin:'#AC765A',blush:'#A76955',hair:'#493532',shine:'#865344',coat:'#256766',shirt:'#E4EDC1',accent:'#EF9C43',style:'helmet',freckle:true},
    {skin:'#E7B399',blush:'#CF9185',hair:'#643E35',shine:'#9D6951',coat:'#E6C4AE',shirt:'#506D55',accent:'#B67775',style:'kerchief'},
    {skin:'#CAA384',blush:'#B48672',hair:'#92877B',shine:'#D0C8B5',coat:'#97674E',shirt:'#344847',accent:'#C3A76B',style:'silver',glasses:true}
  ];
  // Hand-painted vertex washes remain visible in both GPU and CPU renderers.
  function paintGeometry(g, tone) {
    const p=g.attributes.position, col=new Float32Array(p.count*3);
    for(let i=0;i<p.count;i++){
      const c=tone(p.getX(i),p.getY(i),p.getZ(i),i);
      col[i*3]=c.r;col[i*3+1]=c.g;col[i*3+2]=c.b;
    }
    g.setAttribute('color',new T.BufferAttribute(col,3));
    return g;
  }
  function ramp(a,b,t){return tint(a).clone().lerp(tint(b),Math.min(1,Math.max(0,t)));}
  function profileAt(profile,y) {
    let i=1;
    while(i<profile.length-1&&profile[i][0]<y)i++;
    const a=profile[i-1],b=profile[i],span=b[0]-a[0],t=Math.max(0,Math.min(1,(y-a[0])/span));
    const prev=profile[Math.max(0,i-2)],next=profile[Math.min(profile.length-1,i+1)];
    return [1,2,3].map(k=>{
      const slope=(b[k]-a[k])/span;
      const dl=a===prev?slope:(a[k]-prev[k])/(a[0]-prev[0]);
      const dr=b===next?slope:(next[k]-b[k])/(next[0]-b[0]);
      const m0=dl*slope>0?2*dl*slope/(dl+slope):0,m1=dr*slope>0?2*dr*slope/(dr+slope):0;
      const t2=t*t,t3=t2*t;
      return (2*t3-3*t2+1)*a[k]+(t3-2*t2+t)*span*m0+(-2*t3+3*t2)*b[k]+(t3-t2)*span*m1;
    });
  }
  function profiled(profile,warp,rows=54,cols=60) {
    return surface(rows,cols,(u,v)=>{
      const y=profile[0][0]+u*(profile[profile.length-1][0]-profile[0][0]);
      const [rx,rz,cz]=profileAt(profile,y),a=v*tau,x=rx*Math.sin(a),z=cz+rz*Math.cos(a);
      return [x,y,warp?warp(x,y,z,Math.cos(a)):z];
    });
  }
  function facePatch(s,color,points) {
    // A small convex piece of fabric, enamel or makeup, facing the viewer.
    const g=new T.BufferGeometry(), pos=[],ind=[];
    points.forEach(p=>pos.push(...p));
    for(let i=1;i<points.length-1;i++)ind.push(0,i,i+1);
    if((points[1][0]-points[0][0])*(points[2][1]-points[0][1])<(points[1][1]-points[0][1])*(points[2][0]-points[0][0]))
      for(let i=0;i<ind.length;i+=3){const t=ind[i];ind[i]=ind[i+1];ind[i+1]=t;}
    g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(ind);g.computeVertexNormals();s.part(g,color);g.dispose();
  }
  // Sculpted ribbon locks with a raised central ridge, tapered ends and
  // distinct painted highlight bands following the direction of each lock.
  function lock(s,coords,width,thick,base,light,outward,seed){
    const path=new T.CatmullRomCurve3(coords.map(p=>point(...p)),false,'centripetal');
    const out=point(...outward).normalize(), side=new T.Vector3(),normal=new T.Vector3();
    const rings=14,sides=10;
    function section(u,v,lift=0){
      const center=path.getPoint(u),t=path.getTangent(u);
      side.crossVectors(t,out).normalize();normal.crossVectors(side,t).normalize();
      const shape=(.44+.68*Math.pow(Math.sin(Math.PI*Math.min(.98,u+.07)),.72))*(1-.95*Math.pow(u,2.5));
      const a=tau*v,r=Math.sin(a)*width*shape, ridge=Math.pow(Math.max(0,Math.cos(a)),3)*.18;
      center.addScaledVector(side,r).addScaledVector(normal,(Math.cos(a)+ridge)*thick*shape+lift);
      return center.toArray();
    }
    const g=surface(rings,sides,(u,vv)=>section(u,vv));
    paintGeometry(g,(_x,_y,_z,i)=>{
      const u=Math.floor(i/sides)/rings,v=(i%sides)/sides*tau;
      const streak=Math.max(0,Math.cos(v-.49))**9;
      const sheen=.22+.74*Math.exp(-((u-.38-.065*Math.cos(seed))**2)/.044);
      return ramp(base,light,.055+.75*sheen*streak+.12*Math.max(0,Math.cos(v)));
    });
    s.part(g,'#FFFFFF');g.dispose();
    if(width>=.04){
      // Brush-shaped gleams follow the curved lock and narrow to a point.
      const gleam=surface(9,2,(u,vv)=>{
        const flow=.19+.56*u+.053*Math.cos(seed*2),a=.087+.022*Math.sin(flow*4+seed);
        return section(flow,a+(vv-.5)*.07*Math.sin(Math.PI*u),.0017);
      },false);
      paintGeometry(gleam,(_x,_y,_z,i)=>ramp(base,light,.47+.45*Math.sin(Math.floor(i/3)/9*Math.PI)));
      s.part(gleam,'#FFFFFF');gleam.dispose();
    }
  }
  const legacyChefStyle=13,chefLook={skin:'#D3A17D',blush:'#BE8770',hair:'#3A302E',shine:'#8A6047',coat:'#DFD1B6',shirt:'#DECBA5',accent:'#416F61',style:'chef'};
  let handTemplate;
  function sculptGuestHand(index,side,skin){
    if(!handTemplate){
      const decode=(encoded,Type)=>new Type(Uint8Array.from(atob(encoded),c=>c.charCodeAt(0)).buffer);
      const data=global.DinerHandForm;
      handTemplate={points:decode(data.points,Int16Array),tone:decode(data.tone,Uint8Array),indices:decode(data.triangles,Uint16Array)};
    }
    const {points,tone,indices}=handTemplate;
    const xyz=new Float32Array(points.length),rgb=new Float32Array(points.length),triangles=indices.slice();
    const hue=tint(skin),broad=[5,8,12].includes(index)?1.12:index===6?.89:1;
    for(let i=0;i<points.length;i+=3){
      const h=points[i]/1e5,d=points[i+1]/1e5,w=points[i+2]/1e5;
      // Fingers bend toward the palm below their knuckles. Keep the thumb
      // opposed and soften the curl of the index finger.
      const thumb=clipped((w-.048)/.031),curl=clipped((-d-.082)/.125)*(1-thumb);
      xyz[i]=side*(.325+broad*h-.032*curl*curl+.010*thumb);
      xyz[i+1]=1.051+.91*d+.021*curl*curl;
      xyz[i+2]=.053+w*(.81+.07*broad)-.011*curl;
      rgb[i]=hue.r*tone[i]/230;rgb[i+1]=hue.g*tone[i+1]/230;rgb[i+2]=hue.b*tone[i+2]/230;
    }
    if(side<0)for(let i=0;i<triangles.length;i+=3)[triangles[i+1],triangles[i+2]]=[triangles[i+2],triangles[i+1]];
    const result=new T.BufferGeometry();
    result.setAttribute('position',new T.BufferAttribute(xyz,3));result.setAttribute('color',new T.BufferAttribute(rgb,3));
    result.setIndex(new T.BufferAttribute(triangles,1));result.computeVertexNormals();
    return result;
  }
  let chefSections;
  function makeCustomer(index,staff=false) {
    const v=staff?chefLook:looks[index],sections={};
    let s;
    function section(name){s=sections[name]||(sections[name]=sculpture(figureFinish));}
    section('body');
    const {skin,blush,hair,shine,coat,shirt,accent,style}=v;
    const gold='#E6B76A',cream='#FFF1CD',eye='#382B31';
    const head=[[1.967,.016,.018,.082],[1.987,.074,.078,.069],[2.037,.148,.135,.055],[2.097,.222,.183,.036],[2.176,.278,.211,.018],[2.248,.294,.23,.009],[2.335,.302,.24,.003],[2.429,.302,.232,-.004],[2.507,.263,.205,-.009],[2.58,.156,.153,-.011],[2.615,.018,.025,-.02]];
    const jawWidth=[.96,1.09,.98,1.02,.93,1.15,.91,.98,1.05,1.12,.95,.92,1.18,1.055][index];
    const noseSize=[.92,1.10,.98,1.12,.91,1.27,.80,1,.97,1.23,1.04,.89,1.31,1.15][index];
    const eyeOpen=[1,.96,1.06,.91,.95,.76,1.15,1.05,.88,.84,1.0,1.04,.73,.84][index];
    for(const ring of head){
      const weight=clipped((2.35-ring[0])/.25);
      ring[1]*=1+(jawWidth-1)*weight;
      ring[2]*=1+(jawWidth-1)*.55*weight;
    }
    if(index===9){
      // Broader mental pad and square mandibular angle under pronounced cheekbones.
      head[0]=[1.963,.036,.043,.069];head[1]=[1.992,.129,.102,.059];
      head[2]=[2.03,.197,.141,.045];head[3]=[2.095,.252,.177,.025];
      head[4]=[2.176,.279,.214,.018];
    }
    if(index===10){
      head[2]=[2.040,.152,.139,.056];head[3]=[2.098,.219,.184,.035];
      head[4]=[2.177,.282,.214,.021];
    }else if(index===12){
      head[0]=[1.963,.043,.055,.056];head[1]=[1.987,.135,.119,.049];
      head[2]=[2.04,.205,.163,.033];head[3]=[2.102,.265,.199,.019];
    }
    function relief(x,y,z,cos){
      const front=Math.max(0,cos)**2;
      const tip=.058*Math.exp(-((x/.042)**2)-(((y-2.171)/.042)**2));
      const bridge=.027*Math.exp(-((x/.032)**2)-(((y-2.236)/.084)**2));
      const cheek=.014*Math.exp(-(((Math.abs(x)-.15)/.074)**2)-(((y-2.169)/.064)**2));
      const lips=.013*Math.exp(-((x/.077)**2)-(((y-2.082)/.032)**2));
      let volume=noseSize*(tip+bridge)+cheek+lips;
      if(index===11){
        const gaussian=(cx,cy,w,h)=>Math.exp(-(((Math.abs(x)-cx)/w)**2)-(((y-cy)/h)**2));
        volume+=.014*gaussian(.028,2.156,.019,.014)+.011*gaussian(.130,2.364,.083,.028)
          -.016*gaussian(.142,2.297,.081,.036)+.007*gaussian(.027,2.112,.016,.020)-.005*gaussian(0,2.113,.010,.023)
          +.012*gaussian(.165,2.198,.082,.048)-.007*gaussian(.162,2.106,.051,.041);
      }
      if(index===9){
        const bump=(cx,cy,w,h)=>Math.exp(-(((Math.abs(x)-cx)/w)**2)-(((y-cy)/h)**2));
        volume+=.019*bump(.028,2.155,.022,.016)+.013*bump(0,2.244,.033,.082)
          +.018*bump(.125,2.357,.077,.027)-.021*bump(.143,2.298,.080,.038)
          +.014*bump(.169,2.191,.058,.037)-.012*bump(.160,2.109,.047,.048)+.013*bump(0,2.027,.091,.031);
      }
      if(index===10||index===12||staff){
        const bump=(cx,cy,w,h)=>Math.exp(-(((Math.abs(x)-cx)/w)**2)-(((y-cy)/h)**2));
        if(staff)volume+=.015*bump(.13,2.353,.078,.028)-.015*bump(.15,2.292,.076,.042)+.019*bump(.163,2.187,.059,.044)+.012*bump(.029,2.156,.020,.015)+.008*bump(0,2.041,.058,.022);
        else if(index===10)volume+=.014*bump(.157,2.201,.072,.045)-.013*bump(.144,2.295,.076,.035)
          +.009*bump(.127,2.359,.087,.028)+.009*bump(.022,2.156,.014,.014);
        else volume+=.016*bump(.151,2.254,.067,.027)-.017*bump(.143,2.300,.084,.033)+.016*bump(.128,2.362,.081,.029)
          +.019*bump(.031,2.155,.021,.018)+.012*bump(0,2.229,.045,.082)-.008*bump(.173,2.104,.048,.056);
      }
      return z+front*volume;
    }
    function faceZ(x,y){
      const [rx,rz,cz]=profileAt(head,y),cos=Math.sqrt(Math.max(.004,1-(x/rx)**2));
      return relief(x,y,cz+rz*cos,cos);
    }
    function onFace(x,y,lift=0){return [x,y,faceZ(x,y)+lift];}
    function drawn(color,xy,r,lift=.007){s.line(color,xy.map(([x,y])=>onFace(x,y,lift)),r);}
    const body=[[.84,.182,.144,-.006],[.95,.242,.171,0],[1.13,.229,.15,0],[1.35,.20,.132,.006],[1.53,.247,.148,.002],[1.67,.296,.163,0],[1.78,.312,.137,-.008],[1.825,.252,.12,-.012],[1.87,.146,.092,-.012],[1.90,.09,.073,-.012]];
    // Tailor the silhouettes: the mechanic's overalls and the cyclist's windbreaker
    // sit further from the waist, while the dance wrap follows the ribcage.
    const waist=[1,1,1.11,.95,.88,1.19,.97,1.13,1.04,1.13,1.08,.99,1.17,1.08][index];
    for(const row of body){
      const weight=Math.exp(-(((row[0]-1.35)/.33)**2));
      row[1]*=1+(waist-1)*weight;row[2]*=1+(waist-1)*weight*.67;
    }
    function torsoZ(x,y){const [rx,rz,cz]=profileAt(body,y);return cz+rz*Math.sqrt(Math.max(.01,1-(x/rx)**2));}
    function fabric(x,y,d=.008){return [x,y,torsoZ(x,y)+d];}
    function panel(color,outline,z){
      // Subdivide embroidered cloth so its middle follows the curved chest.
      const points=outline.map(([x,y])=>new T.Vector2(x,y));
      const faces=T.ShapeUtils.triangulateShape(points,[]);
      const positions=[],n=7;
      for(const [i,j,k] of faces){
        const a=points[i],b=points[j],c=points[k];
        function corner(u,vv){
          const x=a.x+(b.x-a.x)*u/n+(c.x-a.x)*vv/n;
          const y=a.y+(b.y-a.y)*u/n+(c.y-a.y)*vv/n;
          positions.push(...fabric(x,y,z));
        }
        for(let u=0;u<n;u++)for(let vv=0;vv<n-u;vv++){
          corner(u,vv);corner(u+1,vv);corner(u,vv+1);
          if(u+vv<n-1){corner(u+1,vv);corner(u+1,vv+1);corner(u,vv+1);}
        }
      }
      const g=new T.BufferGeometry(),normals=[],eps=.001;
      for(let i=0;i<positions.length;i+=3){
        const x=positions[i],y=positions[i+1];
        const n=point((torsoZ(x-eps,y)-torsoZ(x+eps,y))/(2*eps),(torsoZ(x,y-eps)-torsoZ(x,y+eps))/(2*eps),1).normalize();
        normals.push(n.x,n.y,n.z);
      }
      g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
      s.part(g,color);g.dispose();
    }
    function stitch(color,p,w,z=.012){s.line(color,p.map(([x,y])=>fabric(x,y,z)),w);}
    const trousers=['#574640','#394D52','#536170','#514A52','#51464A','#62685B','#48516C','#564740','#443F49','#555F55','#364D50','#686657','#56483E','#3A4944'][index];
    const fabricGeo=profiled(body);
    paintGeometry(fabricGeo,(x,y,z)=>{
      if(!staff&&index>=2&&y<.945)return tint(trousers);
      const fold=.05*Math.cos(38*x+3*y)+.065*Math.sin(26*x+7*y);
      return ramp(coat,'#422F37',Math.max(0,.16-.08*y-.09*z+fold));
    });s.part(fabricGeo,'#FFFFFF');fabricGeo.dispose();
    const workBoot=staff||[5,9,11,12].includes(index),sport=[0,2,6,10].includes(index);
    function limb(color,rows,cx,cz=0){
      const geometry=profiled(rows,null,20,28);
      s.part(geometry,color,cx,0,cz);geometry.dispose();
    }
    function guestSleeve(side,color){
      const rings=[[1.026,.053,.050,.055],[1.038,.065,.062,.053],[1.073,.065,.062,.050],[1.082,.061,.058,.049],
        [1.107,.074,.071,.045],[1.21,.082,.079,.030],[1.30,.080,.078,.017],[1.357,.079,.076,.011],
        [1.476,.087,.087,.001],[1.605,.096,.100,-.008],[1.714,.103,.106,-.014],
        [1.765,.095,.099,-.015],[1.80,.069,.077,-.017],[1.83,.010,.010,-.015]];
      const width=index===6?.91:index===5||index===12?1.05:1;
      const mesh=surface(60,36,(u,v)=>{
        const y=mixHeight(u),a=tau*v,[rx,rz,cz]=profileAt(rings,y);
        const elbow=Math.exp(-((y-1.35)**2)/.009);
        const drape=.0036*Math.sin(5*a+u*3)+.0048*elbow*Math.sin(53*y+2.6*Math.cos(a));
        const x=.325+.011*clipped((y-1.026)/.331)-.060*clipped((y-1.357)/.43);
        return [side*x+(width*rx+drape)*Math.sin(a),y,cz+(width*rz+drape)*Math.cos(a)];
      });
      function mixHeight(u){return rings[0][0]+u*(rings.at(-1)[0]-rings[0][0]);}
      paintGeometry(mesh,(x,y,z)=>ramp(color,'#54464C',.06+.046*Math.sin(50*y+12*z)*Math.exp(-((y-1.35)**2)/.012)+.035*clipped(-z*6)));
      s.part(mesh,'#FFFFFF');mesh.dispose();
    }
    for(const k of [-1,1]){
      section('thigh'+k);
      limb(trousers,[[.48,.096,.097,.016],[.54,.110,.107,.016],[.68,.115,.126,0],[.86,.124,.15,-.008],[.96,.118,.128,0],[1.02,.085,.1,0]],k*.122);
      s.line('#8D8674',[[k*.224,.93,.035],[k*.237,.78,.04],[k*.219,.55,.066]],.0035);
      section('shin'+k);
      s.oval(trousers,k*.126,.516,.016,.102,.095,.100,-.04);
      limb(trousers,[[.158,.085,.08,-.003],[.20,.105,.091,.0],[.25,.096,.096,.004],[.38,.101,.107,-.003],[.48,.106,.11,.011],[.55,.096,.098,.013]],k*.128);
      s.line('#8D8674',[[k*.217,.51,.069],[k*.218,.38,.046],[k*.214,.235,.049]],.003);
      section('foot'+k);
      const shoe=workBoot?'#705343':sport?cream:'#503F41',sx=k*.128;
      s.oval(sport?'#CFBA96':'#493B35',sx,.048,.055,.11,.038,.178);
      s.oval(shoe,sx,.091,.074,.107,.064,.154);
      s.oval(shoe,sx,workBoot?.166:.128,-.021,.099,workBoot?.110:.077,.098);
      s.oval(sport?coat:'#796453',sx,.133,.107,.065,.032,.072,-.42);
      for(let row=0;row<(index===4?1:3);row++)
        s.line(sport?accent:'#BCAB8F',[[sx-.048,.144+row*.009,.148-row*.028],[sx,.153+row*.01,.153-row*.029],[sx+.048,.145+row*.009,.143-row*.028]],.0045);
      if(index===10)cyclingShoes(k);
      if(index===12&&k===-1){recordArm();mealForearm(k);continue;}
      if(index===9){photographerArm(k);mealForearm(k);continue;}
      if(index===11&&k===-1){
        floristArm();mealForearm(k);
        continue;
      }
      section('arm'+k);
      const sleeve=[2,3,5,9].includes(index)?shirt:coat;
      if(!staff&&index>=2)guestSleeve(k,sleeve);
      else s.oval(sleeve,k*.3,1.553,-.013,.103,.276,.114,.08,0,k*.151);
      if(index===5||index===11){
        // Sleeve head gathers and the rolled, stitched work-shirt cuff.
        for(let j=0;j<3;j++){
          const y=1.732-j*.023;
          s.line(index===5?'#BDAD89':'#CDA791',[[k*(.283+j*.015),y,.080],[k*(.303+j*.017),y-.044,.097],[k*(.319+j*.018),y-.066,.093]],.003);
        }
      }
      if(index===2||index===10)for(let j=0;j<2;j++){
        s.line(index===2?coat:cream,[[k*.284,1.6-j*.027,.091],[k*.333,1.594-j*.027,.095],[k*.386,1.595-j*.027,.044],[k*.403,1.594-j*.027,-.014]],.009);
      }
      section('fore'+k);
      if(staff||index<2){
        s.oval(sleeve,k*.334,1.202,.023,.088,.194,.091,-.15,0,-k*.075);
        s.oval(index===10?cream:sleeve,k*.328,1.064,.050,.080,.047,.079,-.14,0,-k*.08);
      }
      if(index===5||index===11){
        s.oval(index===11?'#D9B29A':shirt,k*.331,1.125,.043,.090,.045,.088,-.18,0,-k*.08);
        s.line(index===5?'#A99878':'#D2AC94',[[k*.27,1.113,.108],[k*.313,1.1,.130],[k*.366,1.100,.116],[k*.397,1.106,.079]],.004);
      }
      if(staff){
        s.oval('#D4C3A5',k*.332,1.148,.039,.090,.055,.090,-.15,0,-k*.075);
        for(let row=0;row<2;row++)s.line('#B4A381',[[k*.266,1.142+row*.022,.090],[k*.313,1.128+row*.022,.126],[k*.371,1.129+row*.022,.115],[k*.399,1.132+row*.022,.073]],.0030);
        s.oval(skin,k*.328,1.043,.048,.054,.096,.050,-.15,0,-k*.075);
        chefHand(k);continue;
      }
      if(index>=2&&index!==10&&global.DinerHandForm){
        const hand=sculptGuestHand(index,k,skin);
        s.part(hand,'#FFFFFF');hand.dispose();continue;
      }
      s.oval(skin,k*.323,.992,.060,.062,.085,.050,-.09,0,k*.07);
      // Digit lengths, separated finger tips and a turned thumb read in side view.
      for(let j=0;j<4;j++){
        const len=[.049,.057,.053,.042][j],fx=k*(.288+j*.022),fz=.068+.009*Math.sin(j);
        s.oval(skin,fx,.927-(j===1?.003:0),fz,.0135,len,.019,.15,0,k*(.09-j*.04));
        s.oval('#E2A891',fx,.914-len*.36,fz+.015,.007,.012,.004);
      }
      s.oval(skin,k*.269,.982,.096,.026,.057,.029,-.38,0,-k*.32);
      if(index===10)cyclingGlove(k);
      if(index===12)elderKnuckles(k);

    }
    section('body');
    const neckWidth=!staff&&index>=2?([5,8,9,12].includes(index)?.083:.072):.089;
    s.oval(skin,0,1.939,.002,neckWidth,.152,neckWidth*.95);
    if(index<2){
    // Interlocking lapels surround a contrasting placket. Piping is raised.
    panel(shirt,[[-.12,1.844],[.12,1.844],[.101,1.663],[.02,1.28],[-.056,1.32],[-.106,1.637]],.017);
    for(const k of [-1,1]){
      panel(accent,[[k*.10,1.857],[k*.202,1.816],[k*.165,1.741],[k*.189,1.713],[k*.052,1.484],[k*.087,1.707]],.026);
      stitch(gold,[[k*.103,1.849],[k*.19,1.812],[k*.151,1.739],[k*.173,1.708],[k*.061,1.516]],.004,.032);
      panel(cream,[[k*.026,1.849],[k*.104,1.873],[k*.148,1.819],[k*.071,1.745]],.034);
      for(let j=0;j<3;j++){
        const x=.118+.026*j;
        stitch(shirt,[[k*x,1.29-j*.012],[k*(x+.024),1.272-j*.015]],.003);
      }
    }
    stitch('#805D45',[[.004,1.736],[.011,1.574],[.017,1.416],[.02,1.304]],.004,.03);
    for(let j=0;j<4;j++)s.oval(gold,.018,1.702-.084*j,torsoZ(.018,1.702-.084*j)+.039,.012,.013,.006);
    // Embroidered palm sprig on the breast pocket, with enamel pin and chain.
    stitch(gold,[[.149,1.622],[.165,1.657],[.188,1.684]],.004,.035);
    for(let j=0;j<3;j++){
      const x=.151+j*.011,y=1.631+j*.014;
      stitch(gold,[[x,y],[x-.013,y+.005],[x-.019,y+.016]],.0028,.036);
      stitch(gold,[[x,y],[x+.016,y],[x+.023,y+.011]],.0028,.036);
    }
    panel('#6C5544',[[-.217,1.572],[-.104,1.592],[-.104,1.565],[-.213,1.547]],.025);
    stitch(gold,[[-.204,1.565],[-.173,1.573],[-.125,1.579]],.003,.031);
    s.line(gold,[fabric(-.157,1.713,.04),fabric(-.126,1.668,.033),fabric(-.071,1.652,.041),fabric(-.038,1.68,.035)],.0038);
    // Dimensional silk kerchief with a knot and two folded tails.
    lock(s,[fabric(-.016,1.818,.038),fabric(-.042,1.779,.058),fabric(-.07,1.721,.045)],.027,.012,accent,shirt,[0,0,1],3);
    lock(s,[fabric(.004,1.814,.039),fabric(.033,1.762,.062),fabric(.042,1.697,.052)],.027,.012,accent,shirt,[0,0,1],6);
    s.oval(accent,-.003,1.818,torsoZ(0,1.818)+.052,.03,.029,.023);

    }else if(staff){chefUniform();
    }else{
      outfit();
      fittedNeckline();
    }
    section('head');
    const retargeted=!staff&&index>=2&&global.DinerPortraitMesh&&global.DinerGuestFaces;
    if(retargeted){
      for(const k of [-1,1])earDetails(k);
      for(const name of ['eyes-1','eyes1','iris-1','iris1','mouth'])section(name);
    }else buildOriginalFace();
    function earDetails(k){
      s.oval(skin,k*.286,2.225,-.002,.059,.094,.045,0,k*.17,k*-.13);
      s.line(blush,[[k*.302,2.169,.024],[k*.325,2.182,.03],[k*.325,2.23,.038],[k*.313,2.265,.039],[k*.294,2.25,.039]],.01);
      if(!staff&&![3,5,9,10,12].includes(index))s.oval(gold,k*.307,2.145,.021,.014,.015,.014);
      if(['band','bun','twins','bob'].includes(style)){
        s.line(gold,[[k*.308,2.14,.024],[k*.311,2.106,.04],[k*.313,2.075,.043]],.004);
        facePatch(s,accent,[[k*.313,2.094,.048],[k*.326,2.073,.049],[k*.312,2.047,.05],[k*.300,2.074,.051]]);
      }
    }
    function buildOriginalFace(){
      const face=profiled(head,relief,78,88);
      paintGeometry(face,(x,y,z)=>{
        const blushW=Math.exp(-(((Math.abs(x)-.159)/.079)**2)-(((y-2.176)/.045)**2));
        const shade=Math.max(0,Math.min(1,.12-.35*z+.24*Math.max(0,2.16-y)));
        const nose=Math.exp(-((x/.054)**2)-(((y-2.154)/.055)**2));
        const eyeSocket=Math.exp(-(((Math.abs(x)-.14)/.078)**2)-(((y-2.309)/.064)**2));
        const warmth=shade+(.57*blushW+.17*nose+.12*eyeSocket)*Math.max(0,z/.24);
        const base=ramp(skin,blush,warmth);
        if(index===9&&z>-.02){
          const jaw=clipped((2.069+.20*clipped((Math.abs(x)-.087)/.18)**1.4-y)/.040);
          const upperLip=.42*Math.exp(-(((Math.abs(x)-.035)/.045)**2)-(((y-2.119)/.015)**2));
          const stubble=.77+.10*grain(x*47+1,y*52,z*49);
          return base.lerp(tint('#59473F'),Math.max(jaw,upperLip)*stubble*.53);
        }
        if((index===5||index===12)&&z>0){
          const side=clipped((Math.abs(x)-.077)/.16);
          const beard=clipped((2.06+.155*side*side-y)/.042)*clipped((y-1.96)/.055)*clipped(z/.10);
          return base.lerp(tint(index===12?'#ADA08B':'#746151'),beard*(index===12?.70:.23));
        }
        return base;
      });s.part(face,'#FFFFFF');face.dispose();
      for(const k of [-1,1]){
        earDetails(k);
        if(v.freckle)for(let j=0;j<7;j++){
          const x=k*(.088+j*.017),y=2.181+.01*Math.sin(j*2.5);
          s.oval('#BA8165',...onFace(x,y,.002),.003,.0025,.002);
        }
      }
      // Almond-shaped sclera, coloured gradient iris, sharply tapered upper lash.
      const irisPalette=['#488579','#916943','#6E8568','#9A6962','#84724F','#6C8179','#8C7245','#5A8E81','#7E7496','#638D88','#9D663E','#868956','#796A55','#748B72'];
      const iris=irisPalette[index];
      for(const k of [-1,1]){
        section('eyes'+k);
        function eyeBounds(t){return [2.276+.015*t-.022*eyeOpen*Math.sin(Math.PI*t),2.277+.019*t+.042*eyeOpen*Math.sin(Math.PI*t)**.82];}
        function eyelid(t,vv,d=.008){
          const x=k*(.049+.184*t),[lo,hi]=eyeBounds(t);return onFace(x,lo+(hi-lo)*vv,d);
        }
        let lens=surface(7,22,(u,vv)=>eyelid(k===1?vv:1-vv,u),false);
        paintGeometry(lens,(x,y)=>ramp('#F9EDE2','#A99FAD',Math.max(0,(y-2.295)*16)));
        s.part(lens,'#FFFFFF');lens.dispose();
        const ex=k*.142,ey=2.288;
        function irisDisc(rx,ry,c,offset,subTone){
          const g=surface(8,32,(u,vv)=>{
            const a=vv*tau,x=ex+rx*Math.sin(a)*u;
            const aperture=eyeBounds((Math.abs(x)-.049)/.184);
            const y=Math.max(aperture[0]+.001,Math.min(aperture[1]-.001,ey+ry*Math.cos(a)*u));
            return onFace(x,y,offset+.002*(1-u*u));
          });
          // Radius increases outwards: tangent-around crossed with radial faces +z.
          paintGeometry(g,(x,y,z,i)=>{
            const rad=Math.floor(i/32)/8;
            return subTone?subTone(x,y,rad,i):tint(c);
          });
          s.part(g,'#FFFFFF');g.dispose();
        }
        section('iris'+k);
        irisDisc(index===11?.047:.041,index===11?.042:.037,eye,.013);
        irisDisc(index===11?.043:.036,index===11?.039:.034,iris,.016,(x,y,rad,i)=>{
          const value=Math.max(0,Math.min(1,(ey+.028-y)*20));
          if(index===11){
            const a=Math.atan2(x-ex,y-ey),speck=Math.sin(19*a+7*rad)*Math.cos(5*a+4*rad);
            const olive=ramp('#35453C','#B3AD65',.15+.62*value+.16*Math.max(0,Math.sin(Math.PI*rad))+.18*speck);
            return olive.lerp(tint('#E9BD72'),.27*Math.exp(-(((rad-.49)/.18)**2))*(.6+.4*Math.sin(11*a)));
          }
          const c=ramp('#392E36',iris,.1+.9*value);
          return c.lerp(tint('#E9CB99'),(.17+.11*Math.sin(i%32*3.2))*value*value);
        });
        irisDisc(index===11?.017:.015,index===11?.022:.025,eye,.019);
        if(index===11){
          const glint=surface(3,16,(u,t)=>{
            const a=(.52+1.0*t)*Math.PI,rx=.031,ry=.026;
            return onFace(ex+rx*Math.cos(a),ey+ry*Math.sin(a)*(.91+.09*u),.023);
          },false);
          s.part(glint,'#C9B779');glint.dispose();
        }
        s.oval('#FFF6DB',...onFace(ex-.011,ey+.013,.025),.010,.008,.004);
        s.oval('#FFE7BE',...onFace(ex+.016,ey-.014,.024),.0045,.0035,.002);
        section('eyes'+k);
        let lashPts=[];
        for(let j=0;j<=8;j++)lashPts.push(eyelid(j/8,1,.02));
        s.line(eye,lashPts,index===9?.0041:.0065);
        if(index!==9)facePatch(s,eye,[lashPts[6],lashPts[8],onFace(k*.25,2.309,.012),onFace(k*.218,2.307,.015)]);
        s.line(index===9?'#806353':eye,Array.from({length:7},(_,i)=>eyelid(.71+.29*i/6,0,.013)),index===9?.0018:.0028);
        section('head');
        drawn(blush,[[k*.066,2.326],[k*.124,2.347],[k*.184,2.343],[k*.208,2.332]],.003,.006);
        if(index===11){
          floristEye(k);
          continue;
        }
        if(index===9){photographerEye(k);continue;}
        if(index===10||index===12||staff){tailoredEye(k,index===12);continue;}
        const browPts=[[k*.055,2.364],[k*.108,2.385],[k*.157,2.389],[k*.213,2.371],[k*.164,2.379],[k*.112,2.377]];
        facePatch(s,hair,browPts.map(([x,y])=>onFace(x,y,.008)));
      }
      if(staff||[9,10,11,12].includes(index)){
        for(const k of [-1,1]){
          const g=surface(4,14,(u,v)=>{
            const t=k===1?v:1-v,w=Math.sin(Math.PI*t);
            return onFace(k*(.012+.026*t),2.149+.002*t-.004*w+.004*w*u,.0019);
          },false);
          addPainted(g,s,(_x,_y,_z,i)=>ramp('#B17C69','#D7A189',Math.floor(i/15)/4));
        }
      }else{
      drawn('#B77D66',[[-.027,2.147],[-.017,2.145],[-.01,2.147]],.0028);
      drawn('#B77D66',[[.009,2.147],[.018,2.145],[.025,2.148]],.0028);
      }
      // Cupid's bow and lower-lip volume follow each guest's muzzle.
      const mouthW=.066*(index===6?.90:jawWidth),smile=[.010,.012,.014,.008,.013,.006,.016,.012,.006,.007,.012,.013,.005,.013][index];
      section('mouth');
      const lipTone=index===5||index===12?'#986E60':index===11?'#B97372':'#B9786D';
      function lipSurface(upper){
        const g=surface(7,36,(row,t)=>{
          const a=t*2-1,x=mouthW*a,w=1-a*a,center=2.083+smile*a*a+.0018*a;
          const bow=.012*(1-.72*Math.exp(-((a/.22)**2)));
          const y=upper?center+bow*w*row:center-.013*w*(1-row);
          return onFace(x,y,.006+.008*w*Math.sin(row*Math.PI));
        },false);
        paintGeometry(g,(_x,_y,_z,i)=>ramp(lipTone,blush,(upper?.04:.26)+.47*Math.sin(Math.floor(i/37)/7*Math.PI)));
        s.part(g,'#FFFFFF');g.dispose();
      }
      lipSurface(true);lipSurface(false);
      drawn('#804F4A',Array.from({length:9},(_,j)=>{const x=j/4-1;return [mouthW*x,2.083+smile*x*x+.0018*x];}),.0019,.011);
    }
    section('head');
    // A scalp cap closes gaps behind individually modelled front, side and back locks.
    const headTrimStart=s.vertexCount;
    if(index===11){
      floristHair();
    }else if(index===9){photographerHair();
    }else if(index===10){courierHead();
    }else if(index===12){recordHead();
    }else if(staff){chefHead();
    }else{
    if(index>=2&&index<=8&&global.DinerGuestHair)section('hair');
    const cap=surface(20,44,(u,vv)=>{
      const a=tau*vv,front=(1+Math.cos(a))/2,ang=(1-u)*(2.18-1.14*front**2.3)+.004;
      return [.318*Math.sin(ang)*Math.sin(a),2.335+.311*Math.cos(ang),-.019+.263*Math.sin(ang)*Math.cos(a)];
    });s.part(cap,hair);cap.dispose();
    const long=['band','bun','twins','bob'].includes(style),shortHat=style==='knit'||style==='cap';
    for(let j=0;j<14;j++){
      const a=1.15+(tau-2.3)*j/13,dx=Math.sin(a),dz=Math.cos(a),swing=Math.sin(1.8*a+index);
      const endY=style==='bob'?2.02+.047*Math.sin(3*a+.3):long?1.83+.22*Math.abs(dx)+.067*swing:2.087+.061*swing;
      const r=long?.34:.302;
      lock(s,[[dx*.071,2.609,-.028+dz*.072],[dx*.263,2.49,dz*.235-.025],[dx*.309,2.264,dz*.261-.02],[dx*r+.025*swing,endY,dz*(r*.84)-.034]],.078,.035,hair,shine,[dx,.03,dz],j);
    }
    // Long asymmetrical fringe layers point toward the temples, clearing both eyes.
    const direction=index%3===2?-1:1;
    const parting=[-.08,-.08,.045,-.128,.095,-.11,-.026,-.09,-.13,.125,.03,-.075,-.125][index];
    const fringeCount=[8,8,7,7,8,6,9,7,7,5,6,7,5][index];
    for(let j=0;j<fringeCount;j++){
      const t=j/(fringeCount-1),px=-.27+.54*t,edge=Math.abs(px)/.27;
      const center=Math.exp(-(((px-parting)/.12)**2));
      const ageLift=index===5||index===12?.085*center:0;
      const cropped=style==='helmet'?.035:0;
      const swept=style==='bob'||style==='swept'||style==='silver';
      const tipY=2.367+.046*Math.sin(t*3)-.060*edge+.016*Math.sin(j*2.2)+ageLift+cropped+(swept?.086*center:0);
      const destX=direction*px,midX=direction*(px*.82+parting*.38-.018);
      const rootX=direction*(parting*.6+.085*(t-.5));
      if(style==='helmet'){
        const y=2.45;
        lock(s,[[midX*.69,y+.040,.17],[midX*.85,y,.203-edge*.047],[midX,y-.033,.226-edge*.067],[destX,y-.065-.015*Math.sin(j),.237-edge*.082]],.046,.014,hair,shine,[destX,.1,1],j+3);
      }else{
        lock(s,[[rootX,2.598+.024*Math.sin(t*Math.PI),.028],[midX*.60+rootX*.19,2.551,.164],[midX,2.481-.049*edge,.223-.063*edge],[destX,tipY,.24-.082*edge]],.063+(j%3)*.006,.024,hair,shine,[destX,.12,1],j+3);
      }
    }
    for(const k of [-1,1]){
      lock(s,[[k*.176,2.538,.105],[k*.278,2.407,.119],[k*.293,2.233,.118],[k*(long?.259:.282),long?2.061:2.151,.148]],.043,.022,hair,shine,[k*.50,0,.8],2+k);
      if(long&&style!=='bob')lock(s,[[k*.245,2.451,-.137],[k*.332,2.22,-.113],[k*.335,2.021,-.003],[k*.279,1.894,.155],[k*.339,1.814,.197]],.053,.026,hair,shine,[k*.8,0,.5],5+k);
    }
    if(style==='band'){
      s.line(accent,[[-.302,2.407,-.05],[-.257,2.549,-.046],[-.113,2.632,-.047],[.042,2.645,-.052],[.22,2.581,-.052],[.307,2.415,-.053]],.022);
      s.line(gold,[[-.297,2.425,-.025],[-.247,2.554,-.024],[-.109,2.637,-.024],[.048,2.649,-.029],[.218,2.58,-.024],[.305,2.429,-.025]],.004);
      const bowX=-.251,bowY=2.514,bowZ=.177;
      for(const k of [-1,1]){
        function ribbon(u,vv){
          const w=(vv-.5)*2,flare=.013+.037*u;
          return [bowX+k*.090*u,bowY+.027*k*u+w*flare,bowZ+.025*Math.sin(u*Math.PI)-.023*k*u+.016*Math.cos(w*Math.PI)*u];
        }
        const g=surface(9,8,(u,vv)=>ribbon(u,k>0?1-vv:vv),false);
        paintGeometry(g,(_x,_y,_z,i)=>ramp('#126D68','#74B7A0',.19+.43*Math.cos((i%9)/8*Math.PI*2)**2+.27*(Math.floor(i/9)/9)));
        s.part(g,'#FFFFFF');g.dispose();
        s.line(gold,[ribbon(.99,0),ribbon(.99,.25),ribbon(.99,.5),ribbon(.99,.75),ribbon(.99,1)],.0024);
      }
      s.oval(accent,bowX,bowY,bowZ+.02,.021,.026,.013,0,0,.1);
      s.oval(gold,bowX,bowY,bowZ+.032,.009,.012,.006);
    }
    if(style==='bun'||style==='twins'||style==='curls'){
      const centers=style==='twins'?[[-.29,2.474,-.107],[.29,2.474,-.107]]:style==='curls'?[[-.19,2.502,-.116],[.01,2.562,-.16],[.188,2.512,-.1]]:[[.025,2.563,-.179]];
      for(const [cx,cy,cz] of centers){
        const rad=style==='curls'?.127:.143;
        s.oval(hair,cx,cy,cz,rad,rad*.94,rad);
        for(let j=0;j<8;j++){
          const a=j*tau/8;
          lock(s,[[cx+.03*Math.sin(a-.6),cy+rad*.96,cz+.03*Math.cos(a-.6)],[cx+rad*Math.sin(a),cy+rad*.24,cz+rad*Math.cos(a)],[cx+rad*.8*Math.sin(a+.7),cy-rad*.5,cz+rad*.8*Math.cos(a+.7)],[cx+.03*Math.sin(a+1),cy-rad*.92,cz+.03*Math.cos(a+1)]],.029,.014,hair,shine,[Math.sin(a),.12,Math.cos(a)],j);
        }
      }
    }
    if(index>=2&&index<=8&&global.DinerGuestHair)section('head');
    if(shortHat){
      // Open-bottom crowns sit over the hair like fabric instead of running
      // their lower hemispheres through the wearer's temples.
      for(const [cy,cz,rx,ry,rz] of [[2.566,-.024,.333,.151,.302],[2.527,-.016,.334,.051,.298]]){
        const cut=Math.acos((2.503-cy)/ry),shell=new T.SphereGeometry(1,48,22,0,tau,0,cut);
        s.part(shell,accent,0,cy,cz,rx,ry,rz);shell.dispose();
      }
      if(style==='cap'){
        s.oval('#9B4639',0,2.506,.236,.263,.023,.168,-.084);
        s.oval(accent,0,2.517,.236,.262,.018,.170,-.084);
        s.line(gold,[[-.214,2.519,.282],[-.122,2.522,.348],[0,2.526,.368],[.123,2.519,.348],[.213,2.515,.282]],.0035);
        facePatch(s,cream,[[-.038,2.614,.259],[.041,2.614,.259],[.039,2.565,.283],[.002,2.546,.289],[-.038,2.565,.283]]);
        facePatch(s,'#934737',[[-.021,2.595,.273],[.023,2.598,.272],[-.004,2.563,.291],[.001,2.582,.284],[-.02,2.581,.281]]);
      }else{
        for(let j=0;j<46;j++){
          const a=tau*j/46;
          s.line('#76AB95',[[.321*Math.sin(a),2.51,.292*Math.cos(a)-.016],[.335*Math.sin(a+.016),2.529,.300*Math.cos(a+.016)-.016],[.324*Math.sin(a+.029),2.552,.288*Math.cos(a+.029)-.016]],.0035);
        }
        s.oval(cream,0,2.69,-.064,.051,.047,.048);
      }
    }
    if(v.glasses)for(const k of [-1,1]){
      const rim=index===3?'#70524D':index===12?'#8B7155':gold;
      s.band(rim,k*.145,2.289,.231,.101,.10,index===3?.074:.061,index===3?.059:.046,0,k*.48);
      if(k===1)s.line(rim,[[.055,2.295,.278],[0,2.304,.288],[-.055,2.295,.278]],.004);
      s.line(rim,[[k*.229,2.301,.192],[k*.274,2.315,.108],[k*.304,2.299,.025]],.004);
    }
    if(style==='gent')for(const k of [-1,1]){
      lock(s,[onFace(k*.004,2.119,.007),onFace(k*.025,2.112,.012),onFace(k*.054,2.108,.007)],.011,.004,hair,shine,[0,0,1],k);
    }
    if(!global.DinerGuestHair||(index!==3&&index!==8))headwear();
    }
    const geometries={};
    for(const [name,sculpt] of Object.entries(sections))geometries[name]=sculpt.finishMesh().geometry;
    geometries.head.userData.trimStart=headTrimStart;
    return geometries;
    function chefHead(){
      section('hair');
      const root='#362B2B',copper='#754B37',goldLight='#BA8660';
      // Cropped sides taper into the nape underneath the folded service cap.
      const scalp=(u,a,extra=0)=>{
        const front=Math.max(0,Math.cos(a)),y=(2.205+.209*front-.015*Math.cos(2*a))*(1-u)+2.607*u;
        const [rx,rz,cz]=profileAt(head,y);
        return [(rx+.011+extra)*Math.sin(a),y,cz+(rz+.014+extra)*Math.cos(a)];
      };
      const crop=surface(27,82,(u,v)=>scalp(u,v*tau));
      addPainted(crop,s,(_x,y,_z,i)=>ramp(root,copper,.13+.13*clipped((y-2.25)/.31)+.11*Math.cos(i*.8)));
      for(let j=0;j<25;j++){
        const a=.86+j*(tau-1.72)/24;
        const c=[scalp(.81,a-.17),scalp(.64,a-.10,.008),scalp(.40,a,.014),scalp(.17,a+.12,.012),scalp(0,a+.10,.007)];
        c[4][1]-=.018+.021*Math.sin(j*.9)**2;
        lock(s,c,.034,.013,root,copper,[Math.sin(a),.13,Math.cos(a)],j+11);
      }
      for(let j=0;j<9;j++){
        const u=j/8,xx=-.254+.489*u;
        lock(s,[[.135+.047*u,2.52,.122],[.122-.112*(1-u),2.484,.193],[xx+.045,2.458+.015*Math.sin(u*6),.226-.062*Math.abs(xx/.25)],[xx,2.381+.050*u+.011*Math.sin(j*1.4),.236-.062*Math.abs(xx/.25)]],.037+.007*(j%2),.014,copper,goldLight,[xx,.12,1],j+6);
      }
      for(const k of [-1,1])lock(s,[[k*.263,2.463,.108],[k*.292,2.393,.111],[k*.288,2.326,.117],[k*.276,2.275,.128]],.027,.010,root,copper,[k*.80,0,.57],k+6);
      section('head');
      // Elliptical, pleated cotton toque: a low band and airy crown sit
      // over the hairline. The embroidery is stitched on the curved band.
      const bone='#EAD9B9',shade='#C6B99C',red='#A95741',teal='#2F655B';
      function hat(u,a,lift=0){
        const band=u<=.27,curve=Math.sin(Math.PI*clipped((u-.26)/.74));
        const pleat=band?0:(.011*Math.cos(a*13+.38)*curve+.005*Math.cos(a*26+.55)*curve**2);
        const rx=(band?.308+.014*u/.27:.322+.031*curve-.092*((u-.27)/.73)**2)+pleat+lift;
        const rz=(band?.247+.015*u/.27:.262+.031*curve-.088*((u-.27)/.73)**2)+pleat*.80+lift;
        const xx=rx*Math.sin(a)-.047*u*u;
        return [xx,2.457+.277*u-.068*xx+.009*Math.cos(a+.4)*curve,-.021+rz*Math.cos(a)];
      }
      const main=surface(39,110,(u,v)=>hat(u,v*tau));
      addPainted(main,s,(_x,_y,_z,i)=>{
        const u=Math.floor(i/110)/39,a=(i%110)/110*tau;
        return ramp(shade,bone,.66+.19*Math.cos(13*a+.26)*Math.sin(Math.PI*u)**1.1+.05*Math.cos(a*5+u*2));
      });
      s.oval(bone,-.048,2.728,-.021,.233,.028,.178,0,0,-.06);
      for(const [u,col,r] of [[.035,teal,.008],[.092,red,.006],[.224,'#D4BE9D',.0036],[.267,'#E2CFAE',.007]]){
        s.line(col,Array.from({length:69},(_,j)=>hat(u,j*tau/68,.002)),r,true);
      }
      function emblem(x,y){
        const a=Math.asin(x/.322);return hat(.142+y/.277,a,.007);
      }
      // The house mark shows three rising steam stitches over the grill.
      const thread='#47695E',ochre='#AA7950';
      s.line(thread,[emblem(-.044,-.006),emblem(-.031,-.012),emblem(0,-.015),emblem(.033,-.012),emblem(.044,-.006)],.0035);
      for(let j=0;j<3;j++){
        const x=-.022+j*.022;s.line(j===1?ochre:thread,[emblem(x-.003,-.002),emblem(x+.004,.005),emblem(x-.002,.011),emblem(x+.004,.018)],.0030);
      }
      for(const k of [-1,1]){
        drawn('#B2836D',[[k*.143,2.222],[k*.176,2.224],[k*.20,2.231]],.0019,.002);
        for(let j=0;j<3;j++)s.oval('#B68A70',...onFace(k*(.133+j*.017),2.167+.009*Math.cos(j),.0015),.0024,.002,.0015);
      }
    }
    function chefHand(k){
      // The wrist is a shared joint. Service grip and writing grip have
      // separate finger curls so the pencil and plate make physical contact.
      const x=k*.324,y=.974,z=.069;
      const pt=(a,b,c)=>[x+a,y+b,z+c];
      function finger(a,b,r,col=skin){
        const av=point(...a),bv=point(...b),v=bv.clone().sub(av),center=av.clone().lerp(bv,.5);
        const rot=new T.Euler().setFromQuaternion(new T.Quaternion().setFromUnitVectors(point(0,1,0),v.clone().normalize()));
        s.oval(col,center.x,center.y,center.z,r,v.length()*.57,r*.88,rot.x,rot.y,rot.z);
      }
      section('hand'+k);
      s.oval(skin,...pt(-k*.012,-.004,0),.068,.024,.054,0,0,-k*.04);
      for(let j=0;j<4;j++){
        const zz=-.032+j*.020,len=[.079,.089,.086,.072][j];
        const p=pt(-k*.049,.001,zz),q=pt(-k*(len+.004),.012,zz+.004),end=pt(-k*(len+.020),.021,zz+.002);
        finger(p,q,.0122);finger(q,end,.0108);s.oval('#D7A386',end[0],end[1]+.004,end[2],.008,.004,.006);
      }
      finger(pt(-k*.005,.003,.041),pt(-k*.023,.035,.066),.016);
      finger(pt(-k*.023,.035,.066),pt(-k*.045,.049,.059),.013);
      section('noteHand'+k);
      s.oval(skin,...pt(0,-.003,-.004),.056,.039,.052,-.20,0,k*.28);
      for(let j=0;j<4;j++){
        const writing=k===1,zz=.031-j*.022,edge=-k*(.055+.006*Math.sin(j)),base=pt(-k*.027,.006,zz);
        const knuckle=pt(edge,.017+(writing&&j===0?.024:0),zz+.022),tip=pt(-k*(.061-.004*j),j===0?.027:.010,zz+.012);
        finger(base,knuckle,.0132);finger(knuckle,tip,.0105);
        s.oval('#DCA78B',tip[0],tip[1]+.003,tip[2]+.004,.006,.006,.004);
      }
      finger(pt(k*.016,.003,.040),pt(-k*.024,.032,.061),.017);
      finger(pt(-k*.024,.032,.061),pt(-k*.055,.026,.040),.012);
    }
    function chefBack(){
      const canvas='#477164',hem='#31584E',thread='#B5AA84';
      function skirt(k,u,v,lift=0){
        const t=k>0?v:1-v,a=k*(.91+1.78*t);
        const y=.846+.481*u+.023*t*t-.025*Math.sin(u*Math.PI)*t,[rx,rz,cz]=profileAt(body,Math.max(.85,y));
        const ridge=.021+.007*Math.sin(4.0*a+.6*u)+.007*Math.cos(8*a+2*u)*(1-u);
        return [(rx+ridge+lift)*Math.sin(a),y,cz+(rz+ridge+lift)*Math.cos(a)];
      }
      for(const k of [-1,1]){
        const wrap=surface(34,40,(u,v)=>skirt(k,u,v),false);
        addPainted(wrap,s,(_x,y,z,i)=>ramp('#2E554C','#698777',.43+.14*Math.sin(5.6*i%41)+.065*Math.sin(y*52+z*21)));
        for(const u of [.021,.982])s.line(u<.05?canvas:hem,Array.from({length:22},(_,j)=>skirt(k,u,j/21,.004)),.0055);
        const edge=k>0?1:0;s.line(hem,Array.from({length:15},(_,j)=>skirt(k,j/14,edge,.005)),.005);
        for(let j=0;j<11;j++)s.line(thread,[skirt(k,j/11,edge,.007),skirt(k,(j+.47)/11,edge,.007)],.0019);
        s.line('#C0AD91',[[k*.035,1.801,-.128],[k*.113,1.780,-.138],[k*.191,1.762,-.126],[k*.251,1.733,-.105]],.0041);
        s.line('#C6B398',[[k*.117,1.66,-.145],[k*.105,1.592,-.145],[k*.117,1.530,-.132]],.0024);
      }
      const b=(x,y,depth)=>[x,y,-.008-profileAt(body,y)[1]*Math.sqrt(Math.max(.01,1-(x/profileAt(body,y)[0])**2))-depth];
      for(const k of [-1,1])s.line('#A79779',[b(k*.058,1.741,.010),b(k*.058,1.704,.010),b(0,1.684,.012)],.0035);
      s.line('#A79779',[b(-.058,1.741,.010),b(.058,1.741,.010)],.0035);
      for(let j=0;j<3;j++){
        const x=(j-1)*.018;s.line('#8A755B',[b(x-.004,1.712,.012),b(x+.003,1.722,.013),b(x-.002,1.732,.012)],.0028);
      }
      // A striped hem falls from a reinforced towel loop at the right hip.
      const end=(u,v)=>[.256+.039*Math.sin(1.7+u*2)-.068*v,1.326-.276*u+.012*Math.sin(5*v+u),-.047-.150*v+.012*Math.sin(10*v+2*u)];
      const towel=surface(34,24,(u,v)=>end(u,1-v),false);
      addPainted(towel,s,(_x,_y,_z,i)=>{const u=Math.floor(i/25)/34,v=i%25/24,stripe=(u>.70&&u<.752)||(u>.807&&u<.855);return ramp(stripe?'#AF604A':'#C6B79E',stripe?'#CD8365':'#EEE0C2',.44+.26*Math.sin(13*v+u));});
      for(let j=0;j<10;j++){
        const p=end(1,j/9);s.line('#DDD0AD',[p,[p[0],p[1]-.009-.005*Math.sin(j),p[2]]],.0026);
      }
    }

    function chefUniform(){
      chefBack();
      const ink='#345C54',green='#406F61',pale='#A6AC89',creamCloth='#EBD7B4',pipe='#B79A6D',red='#A65C46';
      // Cross-front chef jacket, collar leaves and staggered horn buttons.
      for(const k of [-1,1]){
        panel(creamCloth,[[k*.061,1.881],[k*.137,1.850],[k*.188,1.813],[k*.121,1.760],[k*.047,1.798]],.023);
        stitch('#BAA78B',[[k*.066,1.873],[k*.132,1.841],[k*.175,1.813],[k*.119,1.773]],.003,.029);
      }
      s.oval(red,0,1.857,.011,.112,.043,.087);
      lock(s,[fabric(.005,1.831,.034),fabric(-.019,1.794,.058),fabric(-.068,1.736,.040)],.025,.010,red,'#CB8760',[0,0,1],3);
      lock(s,[fabric(.008,1.831,.034),fabric(.033,1.806,.054),fabric(.066,1.763,.045)],.022,.010,red,'#CB8760',[0,0,1],6);
      for(const k of [-1,1])for(let j=0;j<3;j++)s.oval('#A58C69',...fabric(k*(.181-.008*j),1.703-j*.092,.011),.010,.011,.007);
      for(const k of [-1,1]){
        const strap=[[k*.113,1.72,.163],[k*.153,1.810,.115],[k*.146,1.85,.051],[k*.145,1.851,-.061],[k*.171,1.795,-.122],[-k*.106,1.337,-.145]];
        s.line(ink,strap,.019);s.line('#9F9C74',strap.map(([x,y,z])=>[x+k*.009,y+.003,z]),.0024);
        s.oval(pipe,k*.116,1.727,.166,.022,.016,.006);
      }
      // The duck-canvas bib has a hem with body, and ridges pulled sideways at
      // the waist tie. Its woven colours survive the software renderer.
      function apron(u,v,puff=0){
        const y=.842+.882*u,t=v*2-1,a=t*(1.12-.12*u);
        const width=.259+.021*Math.sin(u*Math.PI)-.130*clipped((u-.54)/.46);
        const tuck=.007*Math.sin(16*t+1.1*u)*Math.sin(Math.PI*u)**.7+.006*Math.cos(31*t-3*u)*Math.exp(-(((u-.44)/.17)**2));
        return [(width+puff)*Math.sin(a)/Math.sin(1.12-.12*u),y+.011*t*t*(1-u),(.205+.017*Math.sin(3.4*u)+puff+tuck)*Math.cos(a)+.010];
      }
      const bib=surface(58,68,(u,v)=>apron(u,v),false);
      addPainted(bib,s,(_x,_y,_z,i)=>{const u=Math.floor(i/69)/58,v=i%69/68;return ramp('#30584D','#658473',.39+.11*Math.cos(17*v+u*3)+.063*Math.sin(v*61+u*6)+.043*Math.sin(u*72));});
      for(const k of [0,1]){
        s.line(ink,Array.from({length:26},(_,i)=>apron(i/25,k,.003)),.0064);
        for(let j=0;j<21;j++){const u=.012+j*.046;s.line(pale,[apron(u,.013+.974*k,.005),apron(u+.019,.013+.974*k,.005)],.0019);}
      }
      for(const u of [.014,.982])s.line(pale,Array.from({length:17},(_,j)=>apron(u,j/16,.006)),.0025);
      const pocket=surface(16,32,(u,v)=>{const [x,y,z]=apron(.255+.204*u,.18+.64*v,.009+.010*Math.sin(u*Math.PI)*Math.sin(v*Math.PI));return [x,y+.014*(v-.5)**2,z];},false);
      s.part(pocket,green);pocket.dispose();
      s.line('#A8A581',Array.from({length:16},(_,j)=>apron(.461,.18+.64*j/15,.013)),.003);
      for(const v of [.185,.52,.815])for(let j=0;j<6;j++){const u=.263+j*.031;s.line(pale,[apron(u,v,.014),apron(u+.014,v,.014)],.0019);}
      for(const k of [-1,1]){
        s.line(ink,[[k*.232,1.31,.101],[k*.244,1.32,-.012],[k*.209,1.316,-.099],[k*.094,1.316,-.161],[0,1.322,-.174]],.017);
        lock(s,[[k*.011,1.322,-.183],[k*.075,1.36,-.182],[k*.116,1.334,-.165],[k*.045,1.310,-.184]],.017,.008,green,pale,[0,.15,-1],k+2);
        lock(s,[[k*.012,1.317,-.184],[k*.035,1.25,-.177],[k*.083,1.123,-.15],[k*.080,1.082,-.155]],.019,.006,green,pale,[0,0,-1],k+4);
      }
      // Woven towel with two brick-coloured stripes tucked through the right loop.
      const towel=(u,v)=>[.205+.052*(1-v)+.029*Math.sin(3*u+5*v),1.36-.34*u+.012*Math.sin(v*5),.117-.12*v+.014*Math.sin(3*v+u*5)];
      const linen=surface(33,16,(u,v)=>towel(u,1-v),false);
      addPainted(linen,s,(_x,_y,_z,i)=>{const u=Math.floor(i/17)/33,v=i%17/16;return ramp((u>.77&&u<.82||u>.86&&u<.89)?red:'#C4B59B',(u>.77&&u<.82||u>.86&&u<.89)?'#CA8561':'#F4E4C7',.45+.26*Math.cos(v*11+u*2));});
      // Small split-hem chest patch with the restaurant's stitched steam logo.
      const patch=surface(9,18,(u,v)=>apron(.754+.106*u,.45+.33*v,.012),false);s.part(patch,'#DAC8A0');patch.dispose();
      for(let j=0;j<3;j++){
        const v=.515+j*.069;
        s.line(ink,[apron(.793,v,.015),apron(.806,v+.017,.016),apron(.821,v-.004,.016),apron(.836,v+.012,.015)],.0023);
      }
      s.line(ink,[apron(.786,.505,.015),apron(.776,.612,.016),apron(.786,.710,.015)],.0029);
    }

    function tailoredEye(k,old){
      const ochre=old?'#A68976':'#A97865';
      function lid(t,upper,zy=0,offset=.012){
        const a=Math.sin(Math.PI*t),x=k*(.049+.184*t),y=upper?2.277+.019*t+.042*eyeOpen*a**.82:2.276+.015*t-.022*eyeOpen*a;
        return onFace(x,y+zy,offset);
      }
      section('eyes'+k);
      const upper=surface(6,30,(row,v)=>{
        const t=k>0?v:1-v,bulge=Math.sin(t*Math.PI);
        return lid(t,true,(old?.021:.015)*bulge*row,.013+.007*(1-row)*bulge);
      },false);
      addPainted(upper,s,(_x,_y,_z,i)=>ramp(old?'#957560':'#855B4E',skin,.20+.76*Math.floor(i/31)/6));
      if(!old){
        for(let j=0;j<3;j++){
          const t=.75+j*.065,p=lid(t,true,.001,.021);
          lock(s,[p,onFace(p[0]+k*.007,p[1]+.004,.022),onFace(p[0]+k*.017,p[1]+.008+j*.002,.016)],.0038,.002,eye,'#64463F',[0,0,1],j);
        }
      }
      s.line(old?'#B99680':'#BD8C78',Array.from({length:13},(_,j)=>lid(.13+.65*j/12,false,-.001,.012)),.0028);
      section('head');
      const brow=surface(4,30,(row,v)=>{
        const t=k>0?v:1-v,a=Math.sin(Math.PI*t),x=k*(.051+.162*t);
        const base=old?2.347+.021*a+.011*t:2.352+.027*a+.012*t;
        return onFace(x,base+row*(old?.008+.017*a:.005+.011*a),.008+.002*row);
      },false);
      addPainted(brow,s,(_x,_y,_z,i)=>ramp(old?'#685F54':'#513B34',old?'#C0B5A1':'#88624E',.26+.39*Math.floor(i/31)/4+.08*Math.cos(i*.89)));
      for(let j=0;j<(old?12:6);j++){
        const t=.07+.83*j/(old?12:6),x=k*(.051+.162*t),a=Math.sin(Math.PI*t),y=(old?2.355:2.358)+(old?.021:.027)*a+.011*t;
        drawn(old?(j%3?'#AD9F8D':'#D0C3AF'):'#725447',[[x,y],[x+k*.009,y+.009-(j%3)*.0014]],old?.0021:.0017,.010);
      }
      if(old){
        drawn(ochre,[[k*.089,2.249],[k*.119,2.239],[k*.158,2.237],[k*.191,2.245]],.0027,.002);
        drawn('#C3A18B',[[k*.112,2.232],[k*.146,2.228],[k*.178,2.233]],.0018,.002);
        for(let j=0;j<3;j++)drawn(j===1?'#BB9781':'#A98B77',[[k*.214,2.272-j*.007],[k*.239,2.272-j*.011],[k*.257,2.279-j*.014]],.0019,.003);
        drawn('#AD8D77',[[k*.058,2.151],[k*.073,2.132],[k*.084,2.106]],.0022,.003);
      }
    }
    function courierHead(){
      section('hair');
      const root='#49332E',copper='#704A3C',gleam='#AA7858';
      // Close-fitting crop with a ponytail emerging below the rear adjustment dial.
      const cap=surface(23,68,(u,v)=>{
        const a=tau*v,front=(1+Math.cos(a))*.5,y=(2.209+.196*front**2)*(1-u)+2.619*u;
        const [rx,rz,cz]=profileAt(head,Math.min(2.615,y));
        return [(rx+.01)*Math.sin(a),y,cz+(rz+.012)*Math.cos(a)];
      });
      addPainted(cap,s,(_x,_y,_z,i)=>ramp(root,copper,.12+.24*Math.sin(i%68*1.42)**2));
      for(let j=0;j<9;j++){
        const t=j/8,ex=-.248+.491*t;
        lock(s,[[-.047+.165*t,2.492,.134],[-.109+.289*t,2.466,.169],[ex*.94,2.436,.224-.070*Math.abs(ex/.248)],[ex,2.378+.053*Math.sin(t*4+.3),.237-.075*Math.abs(ex/.248)]],.040,.013,copper,gleam,[ex,.16,1],j+4);
      }
      for(const k of [-1,1]){
        lock(s,[[k*.248,2.460,.089],[k*.292,2.385,.107],[k*.285,2.275,.109],[k*.264,2.198,.132]],.037,.016,root,gleam,[k*.57,0,.82],k+3);
        lock(s,[[k*.283,2.441,.013],[k*.309,2.343,.034],[k*.306,2.250,.06],[k*.320,2.212,.047]],.024,.010,copper,gleam,[k*.82,0,.38],k+5);
      }
      s.oval(root,.023,2.335,-.264,.085,.086,.073,-.30,0,-.19);
      for(let j=0;j<7;j++){
        const a=tau*j/7,x=.036*Math.sin(a),z=.035*Math.cos(a);
        lock(s,[[.025+x,2.335,-.271+z],[.055+x,2.252,-.336+z],[.117+x,2.163,-.365+z],[.155+x*.6,2.086,-.344+z],[.174+x*.5,2.035+.024*Math.sin(a),-.287+z]],.028,.014,copper,gleam,[Math.sin(a),0,Math.cos(a)],j+11);
      }
      s.oval('#E0A653',.038,2.304,-.303,.064,.016,.044,-.48,0,-.23);
      section('helmet');
      const carbon='#374747',rubber='#263334',brass='#C9A773';
      // Longitudinal shell segments leave open, tapered air channels. The
      // inner sidewalls rise from the dark impact liner to the painted shell.
      s.oval(carbon,0,2.501,-.027,.349,.189,.306,-.042);
      function shell(u,b,depth=0) {
        const a=(u-.5)*Math.PI,cb=Math.cos(b),front=Math.sin(a);
        return [(.362-depth)*Math.sin(b),2.473+(.240-depth)*cb*Math.cos(a)-.015*front+.019*cb*front*front,
          -.021+(.343-depth)*cb*front];
      }
      for(let j=0;j<9;j++){
        const l=-Math.PI/2+j*Math.PI/9,r=l+Math.PI/9;
        const edge=(u,end)=>{
          const open=.040*Math.sin(Math.PI*u)**.9*(.52+.48*Math.sin(u*Math.PI)**2);
          return end?r-(j===8?0:open):l+(j===0?0:open);
        };
        const g=surface(48,9,(u,v)=>shell(1-u,edge(1-u,0)+(edge(1-u,1)-edge(1-u,0))*v),false);
        addPainted(g,s,(_x,y,_z,i)=>{
          const col=i%10/9;
          const tone=(j===2||j===6)?'#DB8345':'#DA9146';
          return ramp(tone,j===4?'#FFD892':'#F3B766',.18+.35*Math.sin(col*Math.PI)+.21*clipped((y-2.49)/.23));
        });
        for(const side of [0,1]){
          const wall=surface(34,3,(u,v)=>shell(u,edge(u,side),.025*(side?v:1-v)),false);
          s.part(wall,side?'#916D4D':'#A07850');wall.dispose();
        }
      }
      // Hard visor with a slight upturned edge and twin reflective chevrons.
      const peak=surface(11,32,(u,v)=>{
        const x=(1-2*v)*.236,h=x/.236;
        return [x,2.478-.020*u-.011*h*h,.207+.157*u*(1-.72*h*h)];
      },false);
      s.part(peak,'#A96C42');peak.dispose();
      s.line('#E8B76C',Array.from({length:23},(_,i)=>{const a=i/11-1;return [.236*a,2.461-.011*a*a,.207+.157*(1-.72*a*a)];}),.006);
      for(const k of [-1,1]){
        s.line('#DADFC4',[shell(.68,k*.79,.0),shell(.60,k*.83,-.003),shell(.51,k*.83,-.004)],.008);
        s.line(rubber,[[k*.308,2.473,.101],[k*.306,2.353,.084],[k*.273,2.186,.086],[k*.153,2.046,.052],[k*.022,1.993,.048]],.0084);
        s.line(rubber,[[k*.316,2.468,-.164],[k*.324,2.344,-.067],[k*.273,2.186,.086]],.0079);
        s.oval('#B9AB88',k*.276,2.196,.086,.012,.017,.009,0,0,-k*.37);
      }
      s.oval(brass,.032,1.996,.050,.030,.014,.014);
      s.oval(rubber,0,2.471,-.311,.061,.036,.023);
      s.oval('#A55043',0,2.474,-.332,.043,.018,.010);
      for(let j=0;j<6;j++)s.oval('#D78465',-.031+j*.012,2.475,-.342,.0027,.005,.002);
      section('head');
    }
    function cyclingShoes(k){
      const x=k*.128;
      s.oval('#486B68',x,.130,.118,.087,.035,.081,-.50);
      for(let j=0;j<2;j++)s.line('#CCCDB7',[[x-.064,.144+j*.018,.148-j*.035],[x-.014,.160+j*.011,.154-j*.034],[x+.052,.151+j*.011,.127-j*.03]],.007);
      s.oval('#43504E',x+k*.068,.146,.099,.017,.017,.012,0,k*.48);
      s.oval('#B8BDAD',x+k*.072,.148,.107,.007,.007,.005,0,k*.48);
    }
    function cyclingGlove(k){
      const x=k*.323,base='#3A5250',edge='#293F3E';
      s.oval(base,x,.984,.064,.066,.071,.053,-.09,0,k*.07);
      s.oval(edge,k*.320,1.03,.054,.066,.016,.055);
      for(let j=0;j<4;j++)s.oval(base,k*(.288+j*.022),.946,.073+.009*Math.sin(j),.0145,.021,.020,.15);
      s.oval(base,k*.276,.99,.097,.025,.035,.03,-.29,0,-k*.32);
      for(let j=0;j<2;j++){
        s.line('#94A898',[[k*.286,.981+j*.014,.108],[k*.306,.974+j*.013,.117],[k*.337,.979+j*.013,.117]],.0035);
      }
      if(k===-1){
        section('watch');
        s.oval('#2E4241',-.330,1.048,.049,.085,.020,.080,-.12);
        s.part(block,'#475957',-.325,1.052,.123,.065,.05,.016,-.15,.11,.04);
        s.part(block,'#C4D4BB',-.325,1.054,.133,.052,.037,.004,-.15,.11,.04);
        s.line('#54817A',[[-.344,1.052,.137],[-.335,1.057,.137],[-.326,1.050,.137],[-.314,1.061,.137]],.0025);
        s.oval('#C07842',-.313,1.061,.138,.0035,.0035,.002);
      }
    }
    function courierJacket(){
      const dark='#294F50',sage='#B1C5AB',citrus='#D99549',mesh='#3C7671';
      // A split stand collar and offset weatherproof front zip.
      s.oval(dark,0,1.868,-.003,.124,.071,.100);
      for(const k of [-1,1]){
        panel(coat,[[k*.018,1.879],[k*.102,1.889],[k*.149,1.836],[k*.098,1.796],[k*.026,1.812]],.023);
        stitch(sage,[[k*.103,1.878],[k*.131,1.838],[k*.105,1.809]],.0029,.030);
      }
      panel(citrus,[[-.274,1.763],[-.126,1.786],[.259,1.583],[.237,1.526],[-.170,1.689]],.022);
      stitch('#D7D9B5',[[-.257,1.742],[-.134,1.749],[.073,1.644],[.239,1.558]],.007,.030);
      stitch(dark,[[.042,1.87],[.049,1.754],[.031,1.637],[.011,1.488],[.003,1.318],[.002,.981]],.008,.039);
      s.oval('#B8BBA1',...fabric(.045,1.741,.05),.008,.023,.006);
      for(const k of [-1,1]){
        panel(mesh,[[k*.193,1.522],[k*.222,1.486],[k*.190,1.307],[k*.19,1.151],[k*.146,1.229],[k*.166,1.372]],.015);
        for(let j=0;j<5;j++)for(let n=0;n<3;n++){
          const x=k*(.176+n*.009),y=1.401-j*.024+.005*(n%2);
          s.oval(dark,...fabric(x,y,.021),.0026,.0033,.002);
        }
        stitch(sage,[[k*.095,1.242],[k*.145,1.256],[k*.184,1.28]],.004,.022);
      }
      // Roll-top courier pack, bicycle patch, tension straps and diagonal bungee.
      s.oval('#78634D',0,1.486,-.205,.246,.246,.103);
      s.oval('#B79562',0,1.537,-.267,.224,.199,.073);
      s.oval('#C1A075',0,1.703,-.256,.241,.065,.079,-.09);
      for(const k of [-1,1]){
        s.line(dark,[[k*.139,1.767,-.226],[k*.142,1.687,-.311],[k*.138,1.577,-.330],[k*.15,1.337,-.291]],.011);
        s.part(block,'#3F5350',k*.141,1.589,-.335,.037,.043,.013);
        s.line('#65746A',[[k*.145,1.511,-.337],[-k*.121,1.410,-.333],[k*.135,1.315,-.307]],.004);
        s.line(dark,[[k*.153,1.77,-.15],[k*.160,1.843,-.02],[k*.183,1.813,.094],[k*.197,1.662,.140],[k*.179,1.455,.109]],.019);
      }
      s.oval('#D6CA9C',0,1.6,-.34,.052,.033,.005);
      for(const k of [-1,1])s.band('#55786B',k*.025,1.596,-.347,.013,.013,.013,.14);
      s.line('#55786B',[[-.025,1.596,-.349],[-.009,1.61,-.349],[.001,1.594,-.349],[.015,1.608,-.349],[.025,1.596,-.349]],.0024);
    }
    function recordHead(){
      section('hair');
      const grey='#77746C',shadow='#67645F',light='#CBC5B5';
      const edge=a=>2.228+.25*((1+Math.cos(a))*.5)**1.72+.063*Math.exp(-(((Math.abs(Math.sin(a))-.56)/.21)**2))*Math.max(0,Math.cos(a));
      const scalp=(u,a,lift=0)=>{
        const from=edge(a),y=from+(2.619-from)*u,[rx,rz,cz]=profileAt(head,Math.min(2.615,y));
        return [(rx+.010+lift)*Math.sin(a)-.012*u*u,y+.011*u,cz+(rz+.012+lift)*Math.cos(a)];
      };
      const cap=surface(37,96,(u,v)=>scalp(u,tau*v));
      addPainted(cap,s,(x,y,z,i)=>ramp(shadow,'#C4BEB0',.24+.29*clipped((y-2.29)/.31)+.11*Math.cos(i%96*.91+8*y)));
      // Short grey locks on the temples become thicker waves over the part.
      for(let j=0;j<30;j++){
        const a=-2.98+j*5.96/29,front=Math.max(0,Math.cos(a)),side=Math.sign(a-.27)||1;
        const at=u=>scalp(u,a-.40*front*u-.12*u+.09*Math.sin(u*Math.PI)*side,.003+.013*front*Math.sin(u*Math.PI));
        const coords=[at(.91),at(.70),at(.49),at(.27),at(.09),at(0)];
        coords.at(-1)[1]-=.015+.025*front*(.5+.5*Math.sin(j*2));
        lock(s,coords,.021+.018*front,.012,grey,light,[Math.sin(a),.48,Math.cos(a)],j+8);
      }
      for(let j=0;j<5;j++){
        const t=j/4;
        lock(s,[[.124,2.598,.059-.035*t],[.085-.018*t,2.611,.122],[-.065-.05*t,2.609,.142],[-.173-.032*t,2.553+.017*t,.158],[-.210-.030*t,2.470+.029*t,.127]],.027,.012,grey,light,[-.24,.58,.75],j+13);
      }
      for(const k of [-1,1]){
        lock(s,[[k*.253,2.473,.094],[k*.291,2.414,.097],[k*.290,2.306,.086],[k*.263,2.214,.101]],.027,.010,grey,light,[k*.83,0,.56],k+6);
        for(let j=0;j<6;j++){
          const t=j/5,c='#B8AC96',x=k*(.007+.012*t),y=2.121+.007*t;
          lock(s,[onFace(x,y,.008),onFace(k*(.041+.012*t),y-.002,.015),onFace(k*(.066+.020*t),2.110+.008*t,.012),onFace(k*(.091+.018*t),2.117+.005*t,.007)],.009,.004,grey,c,[0,.2,1],j+2);
        }
      }
      section('head');
      // Pantoscopic tilt and a keyhole bridge keep the lenses off his cheeks.
      const horn='#795F48',bronze='#B69765';
      const frameZ=(x,y)=>.249-(Math.abs(x)-.137)*.41+(y-2.285)*.10;
      for(const k of [-1,1]){
        const ring=Array.from({length:49},(_,i)=>{
          const a=i*tau/48,c=Math.cos(a),d=Math.sin(a),x=k*(.14+.103*Math.sign(c)*Math.abs(c)**.78),y=2.285+.061*Math.sign(d)*Math.abs(d)**.82;
          return [x,y,frameZ(x,y)];
        });
        s.line(horn,ring,.0058,true);
        s.line(bronze,ring.slice(5,16).map(([x,y,z])=>[x,y+.002,z+.003]),.0020);
        s.line(bronze,[[k*.24,2.302,.209],[k*.277,2.315,.139],[k*.307,2.305,.045],[k*.306,2.282,-.016]],.0044);
        s.oval('#CFBC91',k*.241,2.301,.213,.006,.006,.003);
        s.oval('#C7A581',k*.052,2.27,.274,.009,.013,.005,0,0,-k*.29);
      }
      s.line(bronze,[[-.041,2.297,.289],[-.018,2.309,.293],[0,2.314,.294],[.018,2.309,.293],[.041,2.297,.289]],.0045);
      for(let j=0;j<13;j++){
        const k=j%2?1:-1,x=k*(.080+(j%6)*.017),y=2.187+.016*Math.sin(j*1.7);
        s.oval('#A78469',...onFace(x,y,.001),.0025+.001*(j%3),.0023,.0013);
      }
    }
    function elderKnuckles(k){
      for(let j=0;j<3;j++){
        const x=k*(.298+.019*j);
        s.line('#B69074',[[x,.964,.108],[x+k*.008,.962,.112]],.0018);
        s.oval('#AF886D',x,.987+.009*Math.sin(j),.110,.0028,.002,.0017);
      }
      s.band('#C3A571',k*.331,.937,.070,.014,.016,.016,.14,-Math.PI/2,0,-.12);
    }
    // A hand wrapped tightly around stems or a shutter cannot also cup a bun.
    // These four forearms retain the owner's sleeve, cuff and watch. The relaxed
    // hand has the same bind-space palm centre as the rest of the diners.
    function mealForearm(side){
      section('mealFore'+side);
      const elbowX=index===9?.347:index===11?.362:.35;
      const elbowZ=index===12?.046:.067,hem=index===12?1.11:1.19;
      const cloth=index===9?'#B6BAA6':index===11?'#E6C4AE':'#97674E';
      const edge=index===9?'#939E90':index===11?'#CDA991':'#AE8262';
      function sectionAt(y){
        const t=clipped((y-1.035)/.323);
        return [side*(.325+(elbowX-.325)*t),.053+(elbowZ-.053)*t];
      }
      function tube(color,rows){
        const g=surface(24,24,(u,v)=>{
          const y=rows[0][0]+(rows.at(-1)[0]-rows[0][0])*u;
          const [rx,rz]=profileAt(rows,y),[x,z]=sectionAt(y),a=tau*v;
          return [x+rx*Math.sin(a),y,z+rz*Math.cos(a)];
        });
        s.part(g,color);g.dispose();
      }
      tube(skin,[[1.013,.039,.037,0],[1.061,.046,.043,0],[hem-.011,.056,.052,0],[hem+.030,.060,.054,0]]);
      tube(cloth,[[hem,.071,.070,0],[hem+.025,.077,.074,0],[1.274,.084,.080,0],[1.346,.089,.086,0],[1.392,.070,.068,0]]);
      tube(edge,[[hem-.006,.071,.071,0],[hem,.077,.076,0],[hem+.012,.078,.076,0],[hem+.019,.073,.071,0]]);
      if(index===9&&side<0){
        tube('#76604F',[[1.058,.046,.045,0],[1.063,.049,.047,0],[1.079,.051,.049,0],[1.084,.048,.046,0]]);
        s.oval('#B6AA8D',-.330,1.071,.103,.023,.020,.006);
        s.oval('#4B625C',-.330,1.071,.108,.018,.016,.005);
      }
      if(global.DinerHandForm){
        const hand=sculptGuestHand(index,side,skin);s.part(hand,'#FFFFFF');hand.dispose();
      }else{
        s.oval(skin,side*.324,.974,.069,.050,.074,.042);
        for(let i=0;i<4;i++)s.oval(skin,side*(.294+.018*i),.911,.077,.012,.042,.015);
        s.oval(skin,side*.282,.969,.099,.018,.046,.019,-.30,0,-side*.28);
      }
    }
    function recordArm(){
      const velvet='#97674E',cord='#AE8262',inner='#6A5444';
      function segment(color,a,b,w,d){
        const start=point(...a),v=point(...b).sub(start),c=start.clone().addScaledVector(v,.5);
        const rot=new T.Euler().setFromQuaternion(new T.Quaternion().setFromUnitVectors(point(0,1,0),v.clone().normalize()));
        s.oval(color,c.x,c.y,c.z,w,v.length()*.57,d,rot.x,rot.y,rot.z);
      }
      const elbow=[-.35,1.343,.046];
      section('arm-1');
      segment(velvet,[-.270,1.782,-.020],elbow,.113,.122);
      for(let j=0;j<5;j++){
        const x=-.302-.014*j;
        s.line(j%2?cord:'#A57558',[[x,1.70,.091],[x-.013,1.603,.110],[x-.020,1.499,.110],[x-.013,1.42,.107]],.0027);
      }
      section('fore-1');
      const wrist=[-.224,1.393,.255],e=point(...elbow),w=point(...wrist);
      segment(velvet,elbow,e.clone().lerp(w,.76).toArray(),.095,.096);
      segment(inner,e.clone().lerp(w,.59).toArray(),e.clone().lerp(w,.76).toArray(),.089,.086);
      segment(cord,e.clone().lerp(w,.62).toArray(),e.clone().lerp(w,.78).toArray(),.090,.088);
      segment(skin,e.clone().lerp(w,.72).toArray(),wrist,.050,.050);
      s.oval(skin,-.204,1.392,.275,.059,.045,.054,-.18,.3,-.49);
      for(let j=0;j<4;j++){
        const x=-.226+j*.017,y=1.387-j*.005,z=.292;
        segment(skin,[x,y,z],[x+.015,y+.001,z+.035],.012,.012);
        segment(skin,[x+.015,y+.001,z+.035],[x+.024,y+.021,z+.049],.010,.010);
        s.oval('#C8A388',x+.023,y+.020,z+.056,.006,.007,.0025);
      }
      segment(skin,[-.243,1.414,.285],[-.226,1.438,.313],.017,.016);
      segment(skin,[-.228,1.438,.313],[-.202,1.435,.326],.013,.013);
      section('sleeve');
      const x=-.163,y=1.533,z=.274,w2=.176,h2=.169;
      // Sleeve front and back are distinct printed card stock; the record travels
      // in the gap between them. A scalloped opening reveals the label at the top.
      s.part(block,'#B09A79',x,y,z,w2*2,h2*2,.009,0,0,-.035);
      s.part(block,'#E0CAA4',x,y,z+.021,w2*2,h2*2,.010,0,0,-.035);
      s.part(block,'#BCA886',x,y-h2+.004,z+.010,w2*1.99,.011,.025,0,0,-.035);
      s.part(block,'#546865',x,y+.001,z+.028,.323,.288,.004,0,0,-.035);
      function disk(c,px,py,pz,r,d){
        const geo=new T.CylinderGeometry(r,r,d,64);s.part(geo,c,px,py,pz,1,1,1,Math.PI/2);geo.dispose();
      }
      disk('#CB9674',x+.046,y+.038,z+.032,.066,.003);
      for(let j=0;j<4;j++){
        const yy=y-.065+.024*j;
        s.line(['#68837A','#95A590','#BBC1A2','#D7CBA8'][j],[[x-.150,yy,z+.036+j*.001],[x-.085,yy+.015,z+.036+j*.001],[x-.031,yy+.012,z+.036+j*.001],[x+.044,yy+.044,z+.036+j*.001],[x+.151,yy+.022,z+.036+j*.001]],.0046);
      }
      for(const [dx,ww] of [[-.097,.081],[.084,.043]])s.part(block,'#DAC4A3',x+dx,y-.116,z+.031,ww,.003,.003,0,0,-.035);
      // Tiny typeset marker at the top of the sleeve: hand-cut raised 33⅓ rpm stripes.
      for(let j=0;j<3;j++)s.part(block,'#DAC6A2',x-.135+j*.015,y+.131,z+.032,.008,.012-j*.002,.002);
      section('vinyl');
      const vx=x+.008,vy=y+.087,vz=z+.012;
      disk('#242D2C',vx,vy,vz,.159,.005);
      for(let j=0;j<20;j++){
        const r=.052+.00525*j;
        s.band(j%4===0?'#56605A':'#39423F',vx,vy,vz+.0035,r,.013,r,.006);
      }
      disk('#B78D58',vx,vy,vz+.005,.048,.0025);
      disk('#D4B57F',vx,vy,vz+.007,.022,.002);
      disk('#333B37',vx,vy,vz+.009,.006,.001);
      section('body');
    }
    function recordJacket(){
      const wale='#A97E5F',warm='#8B634C',ground='#705341',leather='#805E45',thread='#BD9D79';
      // Corduroy ribs follow the curvature of each front quarter and stop at the seams.
      for(const k of [-1,1]){
        for(let j=0;j<16;j++){
          const x=.038+j*.012,y=1.733-.024*Math.sin(j*.47);
          stitch(j%3?wale:'#997153',[[k*x,y],[k*(x-.01),1.60],[k*(x-.004),1.43],[k*(x-.008),1.28],[k*(x+.001),1.14],[k*(x+.007),.982]],.0022,.009);
        }
      }
      panel(shirt,[[-.101,1.849],[.103,1.849],[.113,1.73],[.059,1.487],[0,1.385],[-.065,1.51],[-.109,1.74]],.023);
      s.oval(shirt,0,1.857,.001,.12,.056,.098);
      for(const k of [-1,1]){
        panel(ground,[[k*.092,1.859],[k*.201,1.815],[k*.161,1.739],[k*.189,1.70],[k*.047,1.457],[k*.089,1.69]],.031);
        panel(warm,[[k*.096,1.849],[k*.188,1.811],[k*.148,1.74],[k*.175,1.706],[k*.054,1.486],[k*.101,1.709]],.036);
        stitch(thread,[[k*.105,1.844],[k*.178,1.81],[k*.140,1.74],[k*.164,1.704],[k*.060,1.504]],.0029,.041);
        for(let j=0;j<4;j++)stitch('#63756B',[[k*(.027+j*.021),1.832],[k*(.031+j*.019),1.763],[k*(.024+j*.015),1.70]],.0027,.027);
        const left=k*.133-.063,right=k*.133+.063;
        panel(warm,[[left,1.292],[right,1.292],[right-.005,1.17],[(left+right)/2,1.150],[left+.005,1.169]],.024);
        stitch(thread,[[left+.007,1.283],[left+.009,1.177],[(left+right)/2,1.159],[right-.009,1.177],[right-.007,1.283]],.0025,.030);
        stitch(leather,[[left-.004,1.292],[(left+right)/2,1.296],[right+.004,1.292]],.005,.034);
      }
      stitch('#604838',[[0,1.469],[.004,1.362],[.002,1.202],[.002,1.002]],.005,.018);
      for(let j=0;j<3;j++){
        const yy=1.411-j*.148;
        s.oval('#735942',...fabric(.004,yy,.031),.015,.015,.006);
        for(const k of [-1,1])s.oval('#C1A481',...fabric(.004+k*.004,yy,.038),.0016,.0028,.001);
      }
      panel('#525A50',[[.127,1.657],[.199,1.656],[.196,1.611],[.128,1.612]],.034);
      s.oval('#C4AE79',...fabric(.158,1.636,.044),.012,.012,.003);
      s.line('#D0B989',[fabric(.171,1.642,.044),fabric(.188,1.642,.044)],.0018);
    }

    function photographerEye(k){
      const arch=t=>2.345+.021*Math.sin(t*Math.PI)+.013*t;
      const brow=surface(5,32,(row,v)=>{
        const t=k>0?v:1-v,x=k*(.052+.17*t),thick=(.008+.017*Math.sin(Math.PI*t)**.7)*(1-.43*t);
        return onFace(x,arch(t)+thick*row,.008+.003*Math.sin(t*Math.PI));
      },false);
      addPainted(brow,s,(_x,_y,_z,i)=>ramp('#302C2C','#6D5142',.22+.34*Math.floor(i/33)/5+.10*Math.sin(i*.9)));
      for(let j=0;j<11;j++){
        const t=.07+.079*j,x=k*(.052+.17*t),y=arch(t)+.006;
        s.line('#4B3C34',[onFace(x,y,.012),onFace(x+k*.009,y+.007,.012)],.0019);
      }
      // One faint eyebrow notch and a small sun crease at each outside corner.
      if(k===1)drawn('#C5997C',[[.177,2.374],[.181,2.385]],.0018,.012);
      drawn('#BF947D',[[k*.126,2.249],[k*.165,2.248],[k*.199,2.257]],.0019,.002);
      drawn('#B98C77',[[k*.221,2.271],[k*.241,2.27],[k*.253,2.274]],.002,.003);
      if(k===-1)s.oval('#986B56',...onFace(-.184,2.147,.002),.0035,.003,.002);
    }
    function photographerHair(){
      section('hair');
      const base='#252B2B',rich='#344043',light='#5B6966',warm='#797366';
      function scalp(p,a,lift=0){
        const radius=Math.sin(p),yTop=2.631,y=yTop-.310*(1-Math.cos(p));
        const sourceY=Math.min(2.615,y-.016*(1-radius));
        const [rx,rz,cz]=profileAt(head,sourceY),x=(rx+.010+lift)*Math.sin(a);
        const z=relief(x,sourceY,cz+(rz+.012+lift)*Math.cos(a),Math.cos(a));
        return [x,y,z];
      }
      const hairline=a=>2.27-1.23*((1+Math.cos(a))*.5)**1.68-.14*Math.sin(a)*((1+Math.cos(a))*.5)**2+.035*Math.cos(5*a);
      function crown(u,a){
        const p=(1-u)*hairline(a)+.007,front=clipped(.52+.48*Math.cos(a)),towards=Math.sin(p);
        const wave=14*a-2.65*p*Math.cos(a*.65)+.43*Math.sin(3*a+p);
        const top=clipped((2.01-p)/1.25),ridge=.0035*Math.cos(wave)*top;
        const lockLift=.017+.060*Math.exp(-(((p-.69)/.49)**2))*front*(.79-.18*Math.sin(a));
        const xyz=scalp(p,a,ridge+lockLift*top);
        xyz[0]-=.043*top**1.8;xyz[1]+=.042*top**1.45+.03*front*Math.sin(p*2)**2;
        xyz[2]+=.014*front*towards*top;
        const covered=clipped((xyz[1]-2.445)/.15);
        xyz[0]*=1-.12*covered;xyz[2]*=1-.12*covered;
        if(xyz[1]>2.455)xyz[1]=2.455+.53*(xyz[1]-2.455);
        return xyz;
      }
      const columns=144,rows=52;
      const crop=surface(rows,columns,(u,v)=>crown(u,v*tau));
      addPainted(crop,s,(x,y,z,i)=>{
        const a=tau*(i%columns)/columns,u=Math.floor(i/columns)/rows,p=(1-u)*hairline(a);
        const wave=14*a-2.65*p*Math.cos(a*.65)+.43*Math.sin(3*a+p);
        const fade=clipped((Math.abs(x)-.18)/.105)*clipped((2.48-y)/.19);
        const fill=.06+.12*clipped((y-2.34)/.28)+.09*(.5+.5*Math.cos(wave))**3+.32*fade;
        return ramp('#242B2B','#65716C',fill);
      });
      // Broad but shallow hair ribbons lie flush against the swept crown. Their
      // ends overlap the fade independently rather than forming a hard cap edge.
      for(let j=0;j<18;j++){
        const a=(j<9?-1:1)*(.65+(j%9)*.231);
        const sweep=a<.56?1:-.72,front=Math.max(0,Math.cos(a));
        const at=(u,slip)=>crown(u,a+sweep*(.075+.43*front)*u+.09*Math.sin(u*Math.PI+slip)*Math.sin(a+1.1));
        const coords=[at(.35,j*.31),at(.21,j*.31),at(.11,j*.31),at(.041,j*.31),at(.002,j*.31)];
        const lower=coords.at(-1);lower[1]-=.010+.020*front*(.5+.5*Math.sin(j*2.31));lower[2]+=.005*front;
        lock(s,coords,.021+.013*front,.009,rich,light,[Math.sin(a),.51,Math.cos(a)],j+4);
      }
      for(const k of [-1,1])for(let j=0;j<11;j++){
        const a=k*(1.1+j*.12),end=hairline(a),p=end-.055-.040*Math.sin(j);
        s.line('#62685E',[scalp(p-.09,a-.018*k,.004),scalp(p-.04,a,.004),scalp(p,a+.012*k,.004)],.0015);
      }
      if(global.DinerGuestHair)section('helmet');
      // A slouched herringbone flat cap. Six real gores meet off-centre above
      // the crown, while the short, separately cut peak projects over the brow.
      const hatAt=(u,a)=>{
        const p=(1-u)*Math.PI*.52+.001,front=Math.cos(a),r=Math.sin(p);
        const panel=.009*Math.cos(6*a-.28)*Math.sin(Math.PI*u)**.7;
        return [-.030*u+.016*(1-u)+(.354+panel)*r*Math.sin(a),
          2.477+(.225+.012*Math.sin(a-.3))*Math.cos(p)+.018*(1-front)*r-.021*Math.sin(a+.28)*r,
          -.006+.012*u+(.310+.049*Math.max(0,front)**4+panel)*r*front];
      };
      const sweatband=surface(5,96,(u,v)=>{
        const a=v*tau,front=Math.cos(a),r=.99+.018*u;
        return [.329*r*Math.sin(a),2.443+.029*u+.011*(1-front)-.018*Math.sin(a+.28),-.002+.294*r*Math.cos(a)];
      });
      s.part(sweatband,'#645F51');sweatband.dispose();
      const underside=surface(4,96,(u,v)=>{
        const a=v*tau,inner=[.318*Math.sin(a),2.455,-.002+.285*Math.cos(a)],outer=hatAt(0,a);
        return inner.map((c,i)=>c+(outer[i]-c)*u);
      });
      s.part(underside,'#5E594C');underside.dispose();
      const cap=surface(35,108,(u,v)=>hatAt(u,v*tau));
      addPainted(cap,s,(_x,_y,_z,i)=>{
        const u=Math.floor(i/108)/35,a=i%108/108*tau;
        const tweed=.047*Math.sin(i%108*1.55+Math.floor(i/108)*2.12)+.035*Math.cos(i%108*2.13-Math.floor(i/108)*1.75);
        return ramp('#514E46','#8D8772',.26+.20*u+.15*Math.cos(a*6-.28)*Math.sin(u*Math.PI)+tweed);
      });
      for(let j=0;j<6;j++){
        const a=j*tau/6+.044;
        s.line('#756F5F',Array.from({length:21},(_,i)=>{const q=hatAt(.018+.936*i/20,a);q[1]+=.002;return q;}),.0027);
      }
      const peak=surface(10,38,(u,v)=>{
        const side=1-v*2,z=.234+.165*(1-.81*side*side)*u;
        return [.261*side,2.473-.026*u-.029*side*side+.003*Math.sin(u*Math.PI),z];
      },false);
      addPainted(peak,s,(_x,_y,_z,i)=>ramp('#49483E','#837D68',.26+.37*Math.sin(i%39/38*Math.PI)));
      s.line('#655E50',Array.from({length:21},(_,i)=>{const h=i/10-1;return [.261*h,2.447-.029*h*h,.234+.165*(1-.81*h*h)];}),.005);
      s.oval('#78705D',-.029,2.704,.006,.017,.008,.017);
      s.part(block,'#A47D59',.321,2.506,.061,.012,.034,.054,0,.17,-.12);
      section('head');
      const rand=rng(58234);
      for(let j=0;j<71;j++){
        const x=(rand()-.5)*.44,side=Math.abs(x),y=2.014+rand()*(.062+.16*clipped((side-.04)/.19));
        if(side>profileAt(head,y)[0]*.88||y>2.072+.17*clipped((side-.055)/.17)**1.35)continue;
        drawn(j%4?'#A47F69':'#AA846F',[[x,y],[x+.002*Math.sign(x),y+.004]],.0014,.0015);
      }
      for(const k of [-1,1])s.oval('#BA8C6E',...onFace(k*.035,2.15,.0004),.010,.003,.0018);
    }
    function photographerVest(){
      const canvas='#526466',edge='#34494B',stitching='#ADB29C',leather='#956E51',linen='#BBC0AB';
      // A narrow standing collar, shawl facing and the worn centre of his shirt.
      s.oval(linen,0,1.857,-.004,.107,.047,.087);
      panel(linen,[[-.088,1.868],[.087,1.868],[.112,1.747],[.060,1.43],[.013,.966],[-.073,.968],[-.073,1.43],[-.111,1.74]],.014);
      stitch('#A0A58F',[[.006,1.864],[.011,1.681],[.007,1.49],[.008,1.2],[.01,.982]],.0045,.022);
      for(let j=0;j<5;j++)s.oval('#8D8E78',...fabric(.012,1.798-j*.148,.027),.008,.009,.005);
      for(const k of [-1,1]){
        const pts=[[k*.097,1.863],[k*.185,1.825],[k*.167,1.738],[k*.092,1.655],[k*.110,1.49],[k*.080,1.23],[k*.068,.957]];
        stitch(edge,pts,.010,.028);
        stitch('#88948B',pts.map(([x,y])=>[x+k*.011,y]),.0026,.036);
        panel(linen,[[k*.013,1.863],[k*.088,1.875],[k*.132,1.847],[k*.091,1.764]],.038);
        const x=k*.153;
        panel(canvas,[[x-.060,1.689],[x+.055,1.7],[x+.058,1.555],[x+.013,1.533],[x-.053,1.546]],.027);
        panel('#657775',[[x-.061,1.698],[x+.056,1.707],[x+.057,1.67],[x,1.648],[x-.06,1.664]],.041);
        stitch(stitching,[[x-.055,1.685],[x,1.66],[x+.049,1.679]],.0028,.047);
        s.oval('#C3AE83',...fabric(x,1.666,.049),.007,.007,.004);
        const y=1.283;
        panel(canvas,[[x-.063,y],[x+.064,y+.004],[x+.054,y-.133],[x-.051,y-.143]],.024);
        stitch('#93A18D',[[x-.056,y-.012],[x-.046,y-.126],[x+.047,y-.118],[x+.057,y-.005]],.0030,.031);
        stitch('#334D4F',[[x-.059,y-.004],[x+.061,y]],.0082,.038);
        s.oval('#C8AA70',...fabric(x+k*.038,y-.025,.051),.008,.019,.004);
      }
      // Press card with a little halftone press portrait above two type lines.
      panel('#BFAC83',[[-.213,1.608],[-.13,1.619],[-.128,1.557],[-.209,1.547]],.054);
      s.oval('#617470',...fabric(-.182,1.592,.059),.010,.011,.003);
      stitch('#768279',[[-.194,1.572],[-.18,1.581],[-.173,1.574]],.0038,.06);
      for(let j=0;j<2;j++)stitch('#7C7962',[[-.16,1.599-.011*j],[-.138,1.602-.011*j]],.0024,.06);
      // Cross-body bag leatherwork is sculpted on the back and visible in the orbit.
      s.line(leather,[[-.184,1.823,.061],[-.193,1.83,-.04],[-.151,1.746,-.12],[.178,1.321,-.105],[.208,1.219,-.067]],.027);
      s.oval('#7F6952',.190,1.171,-.145,.155,.151,.087,0,-.38,-.083);
      s.oval('#A68660',.195,1.222,-.192,.149,.082,.057,0,-.41,-.093);
      s.oval('#B9A273',.231,1.169,-.230,.022,.030,.012,0,-.41);
      s.line(leather,[[-.116,1.849,-.056],[-.122,1.850,.084],[-.154,1.727,.145],[-.155,1.597,.222],[-.136,1.55,.275]],.012);
      s.line(leather,[[.116,1.849,-.056],[.122,1.850,.084],[.16,1.728,.146],[.164,1.610,.224],[.138,1.55,.275]],.012);
    }
    function photographerArm(k){
      section('arm'+k);
      const chambray='#B6BAA6',shirtDark='#8E9A90',skinTone=skin;
      const elbow=[k*.347,1.36,.067];
      function shaft(color,a,b,w,d){
        const start=point(...a),ray=point(...b).sub(start),center=start.clone().addScaledVector(ray,.5);
        const e=new T.Euler().setFromQuaternion(new T.Quaternion().setFromUnitVectors(point(0,1,0),ray.clone().normalize()));
        s.oval(color,center.x,center.y,center.z,w,ray.length()*.56,d,e.x,e.y,e.z);
      }
      shaft(chambray,[k*.273,1.79,-.016],elbow,.113,.118);
      s.oval(chambray,k*.342,1.405,.057,.105,.112,.108,-.31,0,-k*.17);
      const fold=(points,c=shirtDark,w=.0035)=>s.line(c,points,w);
      for(let j=0;j<4;j++){
        fold([[k*(.279+j*.019),1.746-j*.013,.08],[k*(.307+j*.018),1.678-j*.012,.104],[k*(.325+j*.014),1.629-j*.015,.105]]);
      }
      section('fore'+k);
      const wrist=k>0?[.174,1.499,.276]:[-.126,1.469,.302];
      const e=point(...elbow),w=point(...wrist),c=e.clone().lerp(w,.51);
      shaft(chambray,elbow,c.toArray(),.091,.088);
      for(let j=0;j<2;j++){
        const a=e.clone().lerp(w,.36+j*.11),b=e.clone().lerp(w,.49+j*.10);
        shaft(j===0?shirtDark:chambray,a.toArray(),b.toArray(),.094-j*.004,.091-j*.004);
      }
      shaft(skinTone,e.clone().lerp(w,.49).toArray(),w.toArray(),.052,.052);
      if(k===-1){
        // A leather wristwatch and milled metal case follow the supporting wrist.
        shaft('#725948',e.clone().lerp(w,.79).toArray(),e.clone().lerp(w,.88).toArray(),.056,.055);
        s.oval('#B6AA8D',-.157,1.479,.289,.027,.023,.011,0,-.33,.15);
        s.oval('#4B625C',-.157,1.481,.297,.021,.016,.006,0,-.32,.15);
        s.line('#D2C7AB',[[-.166,1.484,.300],[-.157,1.482,.305],[-.153,1.490,.303]],.0017);
      }
      if(k===1){
        s.oval(skinTone,.15,1.508,.290,.053,.062,.044,-.35,.55,-.45);
        for(let j=0;j<3;j++){
          const y=1.531-j*.025;
          shaft(skinTone,[.175,y,.302],[.154,y+.004,.336],.014,.013);
          shaft(skinTone,[.155,y+.004,.335],[.126,y+.009,.338],.011,.011);
          s.oval('#BC8970',.130,y+.013,.347,.009,.006,.004);
        }
        shaft(skinTone,[.134,1.544,.273],[.110,1.564,.257],.018,.016);
        section('shutter');
        shaft(skinTone,[.153,1.55,.300],[.131,1.582,.299],.015,.014);
        shaft(skinTone,[.131,1.581,.299],[.097,1.591,.295],.012,.011);
        s.oval('#D3A186',.099,1.598,.297,.009,.004,.007);
      }else{
        s.oval(skinTone,-.093,1.458,.326,.072,.040,.052,-.16,-.19,-.09);
        for(let j=0;j<4;j++){
          const x=-.104+j*.019,z=.340+j*.007;
          shaft(skinTone,[x,1.466,z],[x+.013,1.475,z+.027],.012,.013);
          shaft(skinTone,[x+.013,1.475,z+.027],[x+.025,1.496,z+.032],.011,.010);
          s.oval('#C39278',x+.025,1.493,z+.039,.006,.007,.003);
        }
        shaft(skinTone,[-.133,1.476,.328],[-.151,1.512,.318],.017,.015);
      }
      if(k===1){
        section('camera');
        photographerCamera();
      }
      section('body');
    }
    function photographerCamera(){
      const cy=1.517,cz=.279,metal='#B7B4A4',highlight='#D0CBBA',black='#354041',rubber='#414846',edge='#686E64';
      // Milled rounded body, recessed leather panels and a separate machined top deck.
      function plate(color,x,y,z,w,h,d,r){
        const shape=new T.Shape();
        shape.moveTo(-w/2+r,-h/2);shape.lineTo(w/2-r,-h/2);shape.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);
        shape.lineTo(w/2,h/2-r);shape.quadraticCurveTo(w/2,h/2,w/2-r,h/2);shape.lineTo(-w/2+r,h/2);
        shape.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);shape.lineTo(-w/2,-h/2+r);shape.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);
        const g=new T.ExtrudeGeometry(shape,{depth:d,bevelEnabled:true,bevelSegments:2,bevelSize:.002,bevelThickness:.002,curveSegments:5});
        s.part(g,color,x,y,z);g.dispose();
      }
      function disk(color,x,y,z,r,depth,axis='z',count=40){
        const g=new T.CylinderGeometry(r,r,depth,count);
        s.part(g,color,x,y,z,1,1,1,axis==='z'?Math.PI/2:0);g.dispose();
      }
      plate(black,0,cy,cz-.045,.282,.138,.087,.013);
      plate(rubber,0,cy-.008,cz+.040,.277,.100,.007,.011);
      plate(metal,0,cy+.047,cz-.046,.287,.045,.093,.008);
      plate(edge,0,cy-.065,cz-.043,.278,.012,.092,.005);
      // Viewfinder and rangefinder windows have distinct recessed glass faces.
      for(const [x,w,h] of [[-.099,.044,.021],[-.049,.026,.017]]){
        plate(black,x,cy+.046,cz+.048,w+.009,h+.007,.002,.003);
        plate('#68857F',x,cy+.047,cz+.052,w,h,.002,.003);
        s.line('#B6D0B6',[[x-w*.34,cy+.049,cz+.056],[x-w*.12,cy+.052,cz+.056]],.0014);
      }
      plate('#8C5D4C',.100,cy+.026,cz+.053,.021,.013,.003,.004);
      const lensX=-.03,lensY=cy-.013;
      for(const [z,r,d,c] of [[.328,.068,.013,metal],[.338,.063,.012,black],[.353,.061,.024,rubber],[.371,.057,.015,metal],[.386,.052,.017,black],[.397,.049,.007,edge]])
        disk(c,lensX,lensY,z,r,d);
      for(let j=0;j<52;j++){
        const a=tau*j/52,si=Math.sin(a),co=Math.cos(a);
        s.line(j%3?'#515856':'#666E66',[[lensX+.062*si,lensY+.062*co,.348],[lensX+.062*si,lensY+.062*co,.363]],.0014);
      }
      // Convex coated lens elements glow teal at glancing angles, around a dark iris.
      const lens=surface(13,48,(u,v)=>{
        const r=.043*u,a=tau*v;return [lensX+r*Math.sin(a),lensY+r*Math.cos(a),.399+.008*(1-u*u)];
      });
      addPainted(lens,s,(x,y,z,i)=>{
        const r=Math.floor(i/48)/13,a=i%48/48*tau;
        return ramp('#192D38','#719A91',.09+.66*r**2+.18*Math.max(0,Math.cos(a+.7))*r);
      });
      s.oval('#BED1AF',lensX-.016,lensY+.012,.407,.008,.004,.002,0,0,.54);
      s.oval('#92B2A0',lensX+.017,lensY-.014,.405,.003,.003,.002);
      disk('#414744',-.106,cy+.076,cz,.025,.012,'y',32);
      disk(metal,-.106,cy+.084,cz,.020,.006,'y',32);
      s.part(block,black,-.104,cy+.089,cz,.030,.005,.006,0,.35);
      disk(black,.062,cy+.078,cz,.030,.015,'y',32);
      for(let j=0;j<12;j++){
        const a=j*tau/12;
        s.part(block,highlight,.062+.023*Math.sin(a),cy+.087,cz+.023*Math.cos(a),.0025,.002,.005,0,a);
      }
      disk('#A9AC9E',.100,cy+.079,cz+.015,.012,.013,'y',24);
      for(const x of [-.019,.012])s.part(block,highlight,x,cy+.074,cz,.005,.009,.035);
      plate('#606C61',-.028,cy-.003,cz-.050,.076,.049,.003,.003);
      plate('#D0B886',-.028,cy-.003,cz-.054,.069,.042,.003,.003);
      for(let j=0;j<3;j++)s.line('#8E805F',[[-.055,cy+.006-j*.009,cz-.056],[-.023+.009*Math.sin(j),cy+.006-j*.009,cz-.056]],.0019);
      for(const k of [-1,1])s.band(metal,k*.143,cy+.022,cz,.011,.010,.012,.18,0,k*.49);
    }

    function floristEye(k){
      section('eyes'+k);
      // A warm tear line, shaded upper-lid plane and individual tapered tail lashes.
      function eyelidPoint(t,upper){
        const a=Math.sin(Math.PI*t),x=k*(.049+.184*t);
        const y=upper?2.277+.019*t+.042*eyeOpen*a**.82:2.276+.015*t-.022*eyeOpen*a;
        return onFace(x,y,upper?.022:.012);
      }
      const upper=surface(5,32,(u,v)=>{
        const t=k>0?v:1-v,p=eyelidPoint(t,true),w=Math.sin(Math.PI*t)**.75;
        return onFace(p[0],p[1]+.023*w*u,.015+.009*(1-u)*w);
      },false);
      addPainted(upper,s,(_x,_y,_z,i)=>ramp('#986758',skin,Math.floor(i/33)/5));
      s.line('#D49B89',Array.from({length:17},(_,i)=>eyelidPoint(.07+.79*i/16,false)),.0031);
      for(let j=0;j<3;j++){
        const t=.73+j*.074,p=eyelidPoint(t,true);
        lock(s,[p,onFace(p[0]+k*.01,p[1]+.004,.024),onFace(p[0]+k*(.018+j*.004),p[1]+.011+j*.002,.017)],.0048,.002,eye,'#613E3C',[0,0,1],j);
      }
      section('head');
      const brow=surface(4,30,(u,v)=>{
        const t=k>0?v:1-v,arch=Math.sin(t*Math.PI),x=k*(.055+.159*t);
        return onFace(x,2.354+.031*arch+.011*t+u*(.005+.012*arch)*(1-.55*t),.007+.003*arch);
      },false);
      addPainted(brow,s,(_x,_y,_z,i)=>ramp('#603D35','#95725D',.13+.23*Math.floor(i/31)/4));
      for(let j=0;j<7;j++){
        const t=j/9,x=k*(.061+.153*t),y=2.359+.03*Math.sin(t*Math.PI)+.011*t;
        s.line('#785443',[onFace(x,y,.011),onFace(x+k*.006,y+.007,.013)],.0016);
      }
      if(k===1){
        for(let j=0;j<8;j++){
          const x=.102+.016*(j%5),y=2.174+.011*Math.sin(j*1.8);
          s.oval('#C7947D',...onFace(x,y,.002),.0028,.002,.0014);
        }
        s.oval('#BD8A72',...onFace(-.105,2.132,.003),.0035,.003,.002);
      }
    }
    function floristHair(){
      section('hair');
      const root='#49312E',mid='#704637',light='#AD7958',amber='#B78A61';
      const pointAt=(a,p,extra=0)=>[(.320+extra)*Math.sin(p)*Math.sin(a),2.337+(.312+extra)*Math.cos(p),-.014+(.269+extra)*Math.sin(p)*Math.cos(a)];
      const hairline=a=>{
        const front=((1+Math.cos(a))*.5)**1.75;
        return 2.35-1.35*front+front*(.054*Math.sin(5*a+.4)+.028*Math.sin(12*a-.6));
      };
      const cap=surface(35,84,(u,v)=>pointAt(tau*v,(1-u)*hairline(tau*v)+.001));
      addPainted(cap,s,(x,y,z)=>ramp('#54372F',mid,.33+.35*Math.max(0,(y-2.27)*2)+.14*(1+Math.sin(Math.atan2(x,z+.014)*22))));
      // The crown parts above the left brow and sweeps to the nape. Locks follow
      // the scalp rather than converging from a single raised point.
      for(const k of [-1,1]){
        for(let j=0;j<11;j++){
          const t=j/10,startA=k*(.15+.92*t),endA=k*(.62+2.25*t),end=hairline(endA);
          const chain=[pointAt(startA,.20+.13*t,.005),pointAt(k*(.45+1.21*t),.53,.007),pointAt(k*(.54+1.78*t),.93,.01),pointAt(endA,end+.035,.009)];
          lock(s,chain,.031+.010*Math.sin(t*Math.PI),.012,mid,light,[Math.sin(endA),.44,Math.cos(endA)],j+5);
        }
        // Framing curls are layered in front of and behind the ear.
        const cords=[
          [[k*.143,2.553,.132],[k*.226,2.483,.162],[k*.272,2.374,.132],[k*.254,2.271,.158],[k*.278,2.211,.151]],
          [[k*.181,2.547,.113],[k*.275,2.445,.113],[k*.300,2.299,.095],[k*.278,2.128,.131],[k*.316,2.051,.093]],
          [[k*.241,2.492,.068],[k*.293,2.412,.051],[k*.311,2.286,.036],[k*.302,2.17,.032]]
        ];
        cords.forEach((path,j)=>lock(s,path,[.031,.036,.024][j],[.014,.018,.012][j],mid,light,[k*.54,.08,.82],j+k+4));
        const wisp=cords[1].map(([x,y,z],i)=>[x+k*(.011+.005*i),y-.015,z+.004]);
        s.line('#986C50',wisp,.0025);
      }
      // Fine asymmetric fringe exposes the brows, ending in tapered separated tips.
      for(let j=0;j<7;j++){
        const t=j/6,ex=-.260+.518*t,edge=Math.abs(ex)/.26;
        const y=2.374+.068*Math.exp(-(((ex+.07)/.105)**2))+.018*Math.cos(j*.72);
        const fringe=[[-.062+.075*t,2.628,.076],[-.087+.259*t,2.572,.158],[-.16+.379*t,2.507-.043*edge,.228-.046*edge],[ex,y,.254-.087*edge]];
        lock(s,fringe,.053,.018,mid,light,[ex,.23,1],j+14);
        if(j%2===1){
          const inner=fringe.map(([x,y,z],i)=>[x+.016,y+.013-i*.003,z+.0005]);
          lock(s,inner,.013,.007,'#76503F','#B78965',[ex,.23,1],j+7);
        }
      }
      if(global.DinerGuestHair)section('helmet');
      // A wrapped silk band, with a fabric selvedge and painted block-print leaves.
      const scarfPoint=(a,w)=>{
        const p=1.42-.82*Math.cos(a)+.15*w;
        return pointAt(a,p,.038+.010*Math.sin((w+1)*Math.PI*.5));
      };
      const scarf=surface(8,90,(u,v)=>scarfPoint(v*tau,1-2*u));
      addPainted(scarf,s,(_x,_y,_z,i)=>ramp('#986665','#C89482',.26+.42*Math.sin(Math.floor(i/90)/8*Math.PI)+.065*Math.cos(i%90*.48)));
      for(const edge of [-1,1])s.line('#D9B39A',Array.from({length:61},(_,i)=>scarfPoint(i*tau/60,edge)),.0032);
      for(let j=0;j<23;j++){
        const a=tau*j/23+.06,p=scarfPoint(a,.13),q=scarfPoint(a+.04,-.12);
        s.oval('#E3C8A3',...p,.007,.004,.005,0,a,a+.48);
        s.oval('#A87B74',...q,.005,.006,.005,0,a);
      }
      // The thick plait crosses the shoulder. Three continuous strands wind
      // around one common centreline with a diminishing radius towards its tie.
      const braid=new T.CatmullRomCurve3([[.065,2.35,-.238],[.17,2.206,-.248],[.267,2.08,-.184],[.300,1.978,-.037],[.277,1.87,.097],[.239,1.75,.164],[.215,1.648,.172]].map(p=>point(...p)));
      const side=new T.Vector3(),out=new T.Vector3(),front=point(0,0,1);
      for(let strand=0;strand<3;strand++){
        const centers=Array.from({length:45},(_,i)=>{
          const u=i/44,c=braid.getPoint(u),t=braid.getTangent(u),a=strand*tau/3+u*15,w=.046-.024*u;
          side.crossVectors(t,front).normalize();out.crossVectors(side,t).normalize();
          return c.addScaledVector(side,Math.sin(a)*w).addScaledVector(out,.69*Math.cos(a)*w).toArray();
        });
        const path=new T.CatmullRomCurve3(centers.map(p=>point(...p)));
        const strandG=surface(60,12,(u,v)=>{
          const c=path.getPoint(u),t=path.getTangent(u),r=(.036-.017*u)*(1-.85*Math.max(0,(u-.93)/.07)),a=v*tau;
          side.crossVectors(t,front).normalize();out.crossVectors(side,t).normalize();
          return c.addScaledVector(side,Math.sin(a)*r).addScaledVector(out,Math.cos(a)*r).toArray();
        });
        addPainted(strandG,s,(_x,_y,_z,i)=>ramp(root,light,.09+.57*Math.max(0,Math.cos(i%12*tau/12-.5))**3));
        for(let j=0;j<3;j++){
          const points=Array.from({length:45},(_,i)=>{
            const u=.055+.864*i/44,c=path.getPoint(u),t=path.getTangent(u),a=(j-1)*.36+.46+.10*Math.sin(u*6+strand),r=.036-.017*u;
            side.crossVectors(t,front).normalize();out.crossVectors(side,t).normalize();
            return c.addScaledVector(side,Math.sin(a)*r).addScaledVector(out,Math.cos(a)*r).toArray();
          });
          s.line(j===1?'#9E7055':'#83573F',points,j===1?.0014:.0011);
        }
      }
      s.oval('#A5796B',.219,1.684,.171,.048,.016,.032,0,0,-.15);
      for(let j=0;j<4;j++)lock(s,[[.218+j*.004,1.679,.173],[.213+.01*j,1.641,.177],[.195+j*.009,1.592,.175],[.186+j*.013,1.558+.010*j,.162]],.018,.009,mid,amber,[0,0,1],j);
      section('head');
      for(const k of [-1,1]){
        s.line('#CD9C88',[[k*.306,2.194,.039],[k*.308,2.222,.041],[k*.318,2.243,.039]],.004);
        s.band('#BF9257',k*.31,2.133,.023,.018,.014,.023,.17,0,k*.44);
        s.oval('#83A18A',k*.311,2.103,.028,.009,.014,.007);
      }
    }
    function floristApron(){
      const green='#526D59',lit='#89A18A',thread='#B4B39A',linen='#E6C5AE',clay='#AA7A67',brass='#BA945B';
      for(const k of [-1,1]){
        panel(linen,[[k*.014,1.862],[k*.094,1.877],[k*.151,1.843],[k*.119,1.794],[k*.066,1.759]],.020);
        stitch('#EDD8C2',[[k*.094,1.870],[k*.141,1.837],[k*.117,1.803],[k*.067,1.767]],.0033,.027);
        for(let j=0;j<4;j++){
          const x=.083+j*.028,y=1.780+.010*j;
          stitch('#CAAC98',[[k*x,y],[k*(x+.014),y-.030],[k*(x+.020),y-.084],[k*(x+.014),y-.125]],.0028,.008);
        }
      }
      // A softly draped canvas bib. The outer seams and inside pocket conform
      // to the same folds and don't float at three-quarter view.
      function apron(u,v){
        const leftRight=2*v-1,y=.902+.738*u;
        const w=.207-.060*u+.013*Math.sin(u*Math.PI*2.05);
        const x=w*leftRight;
        const fold=(.008+.005*(1-u))*Math.sin(leftRight*Math.PI*3.4+1.38*u)*(.5+.5*Math.abs(leftRight));
        const dip=.024*(1-leftRight*leftRight)*(1-u)**4;
        return fabric(x,y-dip,.028+fold);
      }
      const cloth=surface(37,48,(u,v)=>apron(u,v),false);
      addPainted(cloth,s,(x,y,z,i)=>{
        const u=Math.floor(i/49)/37,v=i%49/48;
        return ramp(green,lit,.12+.13*Math.sin(v*6.8*Math.PI+1.38*u)+.09*Math.sin(Math.PI*u)+.12*Math.max(0,(z-.15)*7));
      });
      for(const k of [0,1]){
        const seam=Array.from({length:21},(_,j)=>apron(j/20,k===0?.019:.981));
        s.line(thread,seam.map(([x,y,z])=>[x,y,z+.002]),.0027);
      }
      const hem=Array.from({length:27},(_,j)=>apron(.018,j/26));
      s.line('#9DA38A',hem.map(([x,y,z])=>[x,y,z+.002]),.004);
      for(const k of [-1,1]){
        const strap=[[k*.127,1.831],[k*.132,1.774],[k*.129,1.691],[k*.115,1.619]];
        const sides=strap.map(([x,y])=>[x-.015,y]).concat(strap.slice().reverse().map(([x,y])=>[x+.015,y]));
        panel(clay,sides,.039);
        stitch('#CCA48B',strap.map(([x,y])=>[x+k*.010,y]),.0025,.045);
        s.band(brass,k*.121,1.658,torsoZ(k*.121,1.658)+.050,.019,.021,.014,.15,0,k*.24);
        s.oval(brass,...fabric(k*.115,1.62,.052),.009,.009,.006);
        s.line(clay,[[k*.129,1.831,.063],[k*.14,1.846,.003],[k*.152,1.81,-.085],[-k*.174,1.295,-.093]],.014);
      }
      const y0=1.351;
      panel('#6C806B',[[-.126,y0],[.127,y0+.007],[.116,1.22],[.065,1.181],[-.080,1.188],[-.122,1.224]],.054);
      stitch(thread,[[-.116,1.345],[-.113,1.231],[-.077,1.199],[.065,1.19],[.106,1.228],[.115,1.347]],.0027,.058);
      stitch('#82947E',[[-.126,y0+.001],[-.042,y0-.004],[.042,y0-.002],[.126,y0+.007]],.007,.060);
      // Pruning snips in a sleeve pocket: brass pivot and two distinct finger loops.
      for(const k of [-1,1]){
        const x=.054+k*.022;
        s.line('#78867E',[fabric(.053,1.325,.063),fabric(x,1.403,.057),fabric(x,1.428,.056)],.0047);
        s.band('#865C50',x,1.432,torsoZ(x,1.432)+.057,.017,.017,.028,.19,0,0,k*.25);
      }
      s.oval(brass,...fabric(.052,1.371,.068),.008,.008,.005);
      // Thread-painted olive branch logo follows the bib, with pearly tiny buds.
      stitch('#D2C4A1',[[.057,1.511],[.074,1.539],[.095,1.566],[.126,1.597]],.0029,.047);
      for(let j=0;j<5;j++){
        const y=1.52+j*.014,x=.064+j*.012,side=j%2?1:-1;
        s.oval(j%2?'#B7C1A5':'#99B19B',...fabric(x+side*.014,y+.009,.049),.007,.015,.003,0,.14,-side*.74);
      }
      for(const k of [-1,1])s.oval('#D4B99A',...fabric(.119+k*.007,1.596+k*.005,.046),.006,.007,.004);
      ovalRing(s,green,0,1.298,.006,.216,.142,.014);
      for(const k of [-1,1])lock(s,[[.012,1.304,-.151],[k*.044,1.285,-.177],[k*.081,1.195,-.181],[k*.106,1.111,-.157]],.020,.01,green,lit,[0,0,-1],k+3);
      s.oval(clay,.008,1.30,-.158,.033,.023,.021);
    }
    function floristArm(){
      const sleeve='#E6C4AE',shade='#C19F8C';
      section('arm-1');
      s.oval(sleeve,-.315,1.555,.018,.109,.253,.119,-.15,0,-.18);
      s.oval(sleeve,-.35,1.406,.057,.099,.112,.110,-.29,0,-.14);
      for(let j=0;j<3;j++)s.line('#CEAC96',[[-.34-j*.017,1.719-j*.009,.104],[-.352-j*.018,1.68,.115],[-.356-j*.014,1.627,.115]],.0028);
      section('fore-1');
      const elbow=point(-.362,1.356,.067),wrist=point(-.285,1.448,.236);
      function segment(color,a,b,w,d){
        const vec=point(...b).sub(point(...a)),length=vec.length(),cen=point(...a).addScaledVector(vec,.5);
        const rotation=new T.Euler().setFromQuaternion(new T.Quaternion().setFromUnitVectors(point(0,1,0),vec.normalize()));
        s.oval(color,cen.x,cen.y,cen.z,w,length*.55,d,rotation.x,rotation.y,rotation.z);
      }
      segment(sleeve,elbow.toArray(),[-.298,1.423,.18],.088,.088);
      segment(shade,[-.327,1.389,.134],[-.302,1.425,.19],.088,.086);
      segment(sleeve,[-.326,1.389,.137],[-.299,1.426,.190],.09,.09);
      segment(skin,[-.308,1.407,.174],wrist.toArray(),.053,.052);
      s.oval(skin,-.274,1.447,.249,.05,.058,.044,-.36,.32,-.45);
      // Bent phalanges wrap the stems; the thumb rests over the index finger.
      for(let j=0;j<4;j++){
        const x=-.286+j*.012,y=1.457-j*.014,z=.266;
        segment(skin,[x,y,z],[x+.033,y+.006,z+.017],.0115,.012);
        segment(skin,[x+.033,y+.006,z+.017],[x+.044,y+.019,z-.002],.010,.010);
        s.oval('#DCAB96',x+.045,y+.018,z+.001,.006,.007,.005,0,.42);
      }
      segment(skin,[-.294,1.473,.273],[-.270,1.493,.293],.018,.018);
      segment(skin,[-.271,1.492,.293],[-.246,1.481,.289],.014,.014);
      s.oval('#E5B4A1',-.246,1.483,.298,.008,.006,.003);
      section('bouquet');floristBouquet();section('body');
    }
    function floristBouquet(){
      const grip=point(-.257,1.472,.273);
      function petal(centre,normal,angle,from,to,halfWidth,cupping,base,tip,phase){
        const nz=point(...normal).normalize(),dx=new T.Vector3().crossVectors(point(0,1,0),nz).normalize(),dy=new T.Vector3().crossVectors(nz,dx);
        const radial=dx.clone().multiplyScalar(Math.sin(angle)).addScaledVector(dy,Math.cos(angle));
        const tang=dx.clone().multiplyScalar(Math.cos(angle)).addScaledVector(dy,-Math.sin(angle));const origin=point(...centre);
        const g=surface(8,6,(u,v)=>{
          const w=v*2-1,spread=(.018+.982*Math.sin(Math.PI*(.08+.88*u))**.74)*halfWidth;
          return origin.clone().addScaledVector(radial,from+(to-from)*u).addScaledVector(tang,w*spread+.002*Math.sin(u*3+phase)).
            addScaledVector(nz,cupping*(.70*Math.sin(u*Math.PI)-.70*w*w*Math.sin(u*Math.PI*.82)+.4*u*u)+.0009*Math.sin(4*angle+phase+w*5)*u*u).toArray();
        },false);
        addPainted(g,s,(_x,_y,_z,i)=>ramp(base,tip,.17+.68*Math.floor(i/7)/8+.10*Math.abs(i%7-3)/3));
      }
      function leaf(start,end,width,green,lit,bend){
        const a=point(...start),b=point(...end),v=b.clone().sub(a),side=point(-v.y,v.x,0).normalize();
        const grid=surface(11,4,(u,w)=>{
          const edge=w*2-1,r=width*Math.sin(u*Math.PI)**.86;
          return a.clone().addScaledVector(v,u).addScaledVector(side,edge*r).add(point(0,0,bend*Math.sin(u*Math.PI)+.003*(1-Math.abs(edge))*Math.sin(Math.PI*u))).toArray();
        },false);
        addPainted(grid,s,(_x,_y,_z,i)=>ramp(green,lit,.10+.57*(1-Math.abs(i%5-2)/2)+.16*Math.floor(i/5)/11));
      }
      const blooms=[
        {p:[-.366,1.751,.316],n:[-.20,.43,.89],r:.077,core:'#B05D66',tip:'#E9AF9B',shape:'rose'},
        {p:[-.256,1.694,.352],n:[.23,.39,.9],r:.060,core:'#C7844B',tip:'#F7D59E',shape:'rose'},
        {p:[-.457,1.699,.319],n:[-.46,.38,.89],r:.049,core:'#D6AE74',tip:'#FFF2CE',shape:'daisy'},
        {p:[-.303,1.785,.263],n:[.11,.53,.85],r:.039,core:'#B98288',tip:'#EAC0BB',shape:'rose'},
        {p:[-.402,1.643,.354],n:[-.18,.22,.97],r:.036,core:'#C4A177',tip:'#FFF1D2',shape:'daisy'}
      ];
      for(let i=0;i<blooms.length;i++){
        const {p,n,r,core,tip,shape}=blooms[i],side=(i%2?1:-1);
        const base=[grip.x+.007*i,grip.y-.109,grip.z-.046+.003*i];
        s.line('#687F55',[base,[grip.x+.005*i,grip.y,grip.z],[p[0]+.027,1.618,p[2]-.028],p],.0045);
        leaf([p[0]+.015,1.612,p[2]-.028],[p[0]+side*.055,1.681,p[2]-.019],.013,'#536F50','#91A983',.014);
        const layers=shape==='rose'?4:2;
        for(let tier=0;tier<layers;tier++){
          const frac=1-tier/layers,count=shape==='rose'?[9,7,5,4][tier]:tier?12:13;
          for(let j=0;j<count;j++){
            const a=tau*j/count+tier*.58+.065*Math.sin(1.7*j+i),x=p[0]+n[0]*tier*.005,y=p[1]+n[1]*tier*.005,z=p[2]+n[2]*tier*.005;
            petal([x,y,z],n,a,shape==='rose'?r*.09*frac:r*.12,r*(shape==='rose'?frac:.94-tier*.22)*(1+.063*Math.sin(j*3.1+i)),r*(shape==='rose'?.37*frac:.115),r*(shape==='rose'?.34:.15),core,tip,j+tier);
          }
        }
        s.oval(shape==='rose'?core:'#C79950',p[0]+.003,p[1]+.005,p[2]+.016,shape==='rose'?.010:.012,.012,.008);
      }
      // Paired eucalyptus leaves and the loose, branching tips of waxflower.
      for(let j=0;j<4;j++){
        const x=-.458+j*.071,y=1.79+.047*Math.sin(j*2.28),z=.209-.025*Math.sin(j),tip=[x,y,z];
        s.line('#6A805F',[[grip.x,grip.y,grip.z-.005],[(grip.x+x)/2,1.635,.243],tip],.0034);
        for(let i=0;i<3;i++){
          const u=.61+.13*i,c=grip.clone().lerp(point(...tip),u);
          for(const k of [-1,1])leaf(c.toArray(),[c.x+k*(.029-.005*i),c.y+.027,c.z+.009],.011-.001*i,'#688776','#B2BE9E',.003);
        }
        if(j===0||j===2)for(let k=0;k<5;k++){
          const px=x+.020*Math.sin(k*2.2),py=y+.022*Math.sin(k*.78),pz=z+.013*Math.cos(1.7*k);
          s.line('#809576',[[x,y-.02,z],[px,py,pz]],.002);
          s.oval('#E9DBB5',px,py,pz,.006,.007,.005);
        }
      }
      // Irregular paper collar flares behind the blooms. The folded lip and twine
      // knot show how the bunch is tied, even when seen from the side.
      const wrapper=surface(12,48,(u,v)=>{
        const a=tau*v,front=(1+Math.cos(a))*.5;
        const radius=(.027+.105*u*(1-.70*front))*(1+.09*Math.cos(a*7));
        return [grip.x-.07*u+Math.sin(a)*radius,grip.y-.041+u*(.187-.063*front+.019*Math.cos(4*a)),grip.z+.011*u+Math.cos(a)*radius*.66];
      });
      addPainted(wrapper,s,(_x,_y,_z,i)=>ramp('#A98666','#DED0AD',.35+.24*Math.sin(i%48/48*tau*7)+.23*Math.floor(i/48)/12));
      for(let j=0;j<2;j++)ovalRing(s,'#A57A61',grip.x-.011,grip.y+.01+j*.009,grip.z,.042,.034,.003);
      for(const k of [-1,1])s.line('#B18E74',[[grip.x-.036,grip.y+.011,grip.z+.024],[grip.x-.044+k*.012,grip.y-.031,grip.z+.041],[grip.x-.052+k*.028,grip.y-.081,grip.z+.039]],.0033);
    }


    function fittedNeckline(){
      // Each strip wraps the back of the neck and rolls down over the
      // shoulders. The two ends open independently above the existing placket.
      const shape={
        2:['rib',coat,cream,.041],3:['point',shirt,'#DCC8AA',.077],
        4:['wrap',shirt,'#C3A86D',.054],5:['point',shirt,'#AF916E',.082],
        6:['sailor',shirt,'#627D93',.053],7:['roll',shirt,'#D9B482',.062],
        8:['lapel',coat,'#483A53',.103],9:['point',shirt,'#978F78',.066],
        10:['stand',coat,'#DAA451',.067],11:['round',coat,'#BB9185',.068],
        12:['roll',shirt,'#293F42',.058]
      }[index];
      if(!shape)return;
      const [cut,pigment,thread,l]=shape,rib=cut==='rib'||cut==='roll'||cut==='stand';
      const fold=cut==='lapel'||cut==='point';
      const gap=rib?(cut==='roll'?.004:.14):cut==='round'?.016:.13;
      function neckline(u,v){
        const a=gap+(tau-2*gap)*v,sn=Math.sin(a),cs=Math.cos(a),front=Math.max(0,cs);
        const pointFall=fold?Math.exp(-((Math.abs(Math.atan2(sn,cs))-.65)**2)/.14):0;
        const edgeWidth=rib?.025:cut==='sailor'?.110:.085;
        const rx=.097+edgeWidth*(1-u)+.016*Math.sin(u*Math.PI);
        const rz=.085+(rib?.027:.055)*(1-u)+.009*Math.sin(u*Math.PI);
        const y=(rib?1.940:1.909)-.018*front-(1-u)*(l+.012*front+.083*pointFall);
        return [rx*sn,y,-.008+rz*cs+.018*front**3*(1-u)];
      }
      const fabric=surface(18,80,neckline,false);
      addPainted(fabric,s,(x,y,z,i)=>{
        const u=Math.floor(i/81)/18,v=i%81/80;
        const shadow=.09+.21*(1-u)**5+.14*(1-Math.sin(u*Math.PI))+.045*Math.cos(2*Math.PI*v);
        return ramp(pigment,'#55424A',shadow+(rib?.033*Math.cos(v*tau*36):0));
      });
      const edge=(u,dy)=>Array.from({length:53},(_,j)=>{
        const p=neckline(u,j/52);p[1]+=dy;return p;
      });
      s.line(pigment,edge(.02,.0005),rib?.0045:.004);
      if(['sailor','stand','rib'].includes(cut))s.line(thread,edge(.35,.0008),.0028);
      if(cut==='sailor'||cut==='rib')s.line(thread,edge(.52,.001),.0017);
    }
    function outfit(){
      if(index===10){courierJacket();return;}
      if(index===12){recordJacket();return;}
      function button(x,y,color=gold,r=.013){
        s.oval(color,...fabric(x,y,.031),r,r,.006);
        s.oval('#695A50',...fabric(x,y,.037),r*.26,r*.26,.002);
      }
      function collar(color){
        for(const k of [-1,1]){
          panel(color,[[k*.015,1.859],[k*.102,1.873],[k*.173,1.835],[k*.105,1.748]],.024);
          stitch(cream,[[k*.026,1.852],[k*.104,1.763],[k*.152,1.822]],.0026,.029);
        }
      }
      function pocket(x,y,w,h,color,flap=false){
        const left=x-w/2,right=x+w/2;
        panel(color,[[left,y],[right,y],[right,y-h+.016],[x,y-h],[left,y-h+.017]],.024);
        stitch('#AB977F',[[left+.007,y-.009],[left+.008,y-h+.024],[x,y-h+.008],[right-.008,y-h+.024],[right-.008,y-.009]],.0027,.028);
        if(flap){
          panel(color,[[left-.003,y+.008],[right+.003,y+.008],[right,y-.021],[x,y-.042],[left,y-.021]],.033);
          button(x,y-.026,gold,.008);
        }
      }
      function stripe(points,width,color,z=.025){
        const outline=points.map(([x,y])=>[x-width/2,y]).concat(points.slice().reverse().map(([x,y])=>[x+width/2,y]));
        panel(color,outline,z);
      }
      function knit(color,x,y,h,n){
        for(let i=0;i<n;i++){
          const cx=x+i*.029;
          stitch(color,Array.from({length:24},(_,j)=>[cx+.007*Math.sin(j*1.22),y-h*j/23]),.004);
        }
      }
      function crossedBack(color){
        for(const k of [-1,1])s.line(color,[[k*.137,1.835,.057],[k*.133,1.855,-.032],[k*.16,1.795,-.095],[-k*.161,1.24,-.089]],.019);
      }
      function disc(color,x,y,z,r,h){
        const g=new T.CylinderGeometry(r,r,h,32);
        s.part(g,color,x,y,z,1,1,1,Math.PI/2);g.dispose();
      }
      const garmentHem=Array.from({length:32},(_,j)=>{const a=tau*j/32;return [.233*Math.sin(a),.947,.170*Math.cos(a)];});
      s.line(index===6?accent:coat,garmentHem,.012,true);
      if(index===2){
        // Varsity jacket, ribbed neck and chenille lightning patch.
        collar(coat);
        stitch('#E2B998',[[0,1.855],[0,1.69],[0,1.45],[0,1.22],[0,.99]],.009);
        for(let i=0;i<6;i++)button(0,1.758-i*.140,cream,.011);
        const patch=[[-.181,1.721],[-.089,1.747],[-.127,1.688],[-.099,1.688],[-.186,1.589],[-.155,1.665],[-.191,1.658]];
        panel(cream,patch,.027);
        for(const k of [-1,1])stitch('#CFB78B',[[k*.095,1.178],[k*.144,1.215],[k*.185,1.25]],.009);
      }else if(index===9){photographerVest();
      }else if(index===3){
        collar(shirt);
        panel(shirt,[[-.103,1.852],[.101,1.852],[.087,1.757],[0,1.408],[-.086,1.756]],.014);
        for(const k of [-1,1]){
          stitch('#8C4E61',[[k*.106,1.85],[k*.113,1.77],[k*.071,1.61],[0,1.408]],.008,.03);
          pocket(k*.124,1.304,.14,.115,coat);
        }
          for(let i=0;i<4;i++)button(0,1.38-i*.103);
          for(let j=0;j<3;j++){
            const x=.114+j*.022,y=1.618+Math.sin(j+1)*.017;
            stitch(['#B2834A','#504C50','#A55746'][j],[[x,y-.066],[x+.005,y+.015]],.006,.032);
            stitch(cream,[[x+.005,y+.014],[x+.005,y+.035]],.004,.033);
          }
          pocket(.145,1.568,.106,.087,coat);
          s.part(block,'#765A44',-.241,1.068,.111,.094,.3,.065,-.14,0,-.15);
          s.part(block,'#DFCDA8',-.241,1.073,.126,.084,.29,.046,-.14,0,-.15);
      }else if(index===4){
        for(const k of [-1,1]){
          panel(shirt,[[k*.022,1.873],[k*.103,1.868],[k*.148,1.813],[0,1.608]],.018);
          stitch(accent,[[k*.108,1.858],[k*.12,1.81],[k*.031,1.646],[-k*.124,1.444],[-k*.193,1.359]],.010,.029);
        }
        ovalRing(s,accent,0,1.352,.006,.206,.143,.012);
        for(const k of [-1,1])lock(s,[fabric(.14,1.363,.025),fabric(.15+k*.014,1.32,.039),fabric(.15+k*.039,1.21,.024)],.021,.009,accent,cream,[0,0,1],k+3);
      }else if(index===11){floristApron();
      }else if(index===5){
        const apron='#80664C';
        collar(shirt);
        panel(apron,[[-.145,1.638],[.145,1.638],[.154,1.474],[.203,1.35],[.217,.936],[-.210,.936],[-.201,1.355],[-.155,1.463]],.024);
        crossedBack(apron);
        for(const k of [-1,1]){
          stripe([[k*.136,1.822],[k*.133,1.72],[k*.115,1.605]],.034,apron,.030);
          button(k*.116,1.619,gold,.010);
          stitch('#C0AA83',[[k*.143,1.627],[k*.15,1.473],[k*.195,1.35],[k*.204,.963]],.003,.032);
        }
        pocket(0,1.37,.241,.159,apron);
        for(let i=0;i<3;i++){
            const x=.036+i*.021;
            stitch(['#BB7C47','#AE6455','#C8A65C'][i],[[x,1.37],[x+.012,1.491-i*.014]],.007,.04);
            s.oval('#66504C',...fabric(x+.012,1.494-i*.014,.04),.004,.009,.004);
          }
          s.part(block,'#4E5551',-.164,1.33,.118,.075,.062,.063,0,-.65,.06);
        s.oval('#D1A65F',-.166,1.332,.146,.025,.021,.015);
      }else if(index===6){
        for(const k of [-1,1]){
          panel(shirt,[[k*.075,1.874],[k*.242,1.822],[k*.205,1.723],[0,1.573],[k*.049,1.731]],.020);
          stitch('#859AAA',[[k*.207,1.817],[k*.185,1.742],[k*.025,1.609]],.005,.026);
          s.line('#5A4541',[[k*.177,1.828,-.077],[k*.204,1.792,.085],[k*.211,1.64,.113],[k*.178,1.4,.109],[k*.19,1.29,.074]],.017);
        }
        lock(s,[fabric(0,1.621,.03),fabric(-.004,1.55,.05),fabric(.008,1.399,.034)],.036,.012,accent,cream,[0,0,1],4);
        s.oval('#B3674F',0,1.617,torsoZ(0,1.617)+.035,.032,.025,.021);
        s.oval('#9D644A',0,1.493,-.183,.222,.276,.102);
        s.oval('#BD8061',0,1.649,-.242,.212,.135,.060);
        s.oval('#D7AD7E',0,1.568,-.294,.022,.026,.012);
      }else if(index===7){
        panel(shirt,[[-.122,1.855],[.122,1.855],[.107,1.72],[.048,1.557],[0,1.473],[-.057,1.577],[-.109,1.729]],.020);
        s.oval(shirt,0,1.869,.002,.122,.069,.1);
        for(const k of [-1,1]){
          stitch(index===7?'#B58565':'#B5916F',[[k*.091,1.88],[k*.135,1.817],[k*.109,1.703],[k*.065,1.571],[0,1.47]],.016,.025);
          knit(index===7?'#C17B57':'#9D775C',k*.108,1.529,.375,2);
        }
        for(let i=0;i<4;i++)button(0,1.449-i*.117);
          s.part(block,'#9C7250',-.162,1.649,.144,.010,.148,.009,-.21,0,.29);
          s.part(block,'#9C7250',-.193,1.642,.134,.010,.142,.009,-.12,0,-.13);
          s.oval('#D5A74D',-.182,1.715,.151,.012,.012,.012);
          s.oval('#D5A74D',-.181,1.71,.13,.012,.012,.012);
          pocket(-.165,1.591,.10,.093,coat);
      }else if(index===8){
        collar(coat);
        panel(shirt,[[-.083,1.847],[.083,1.847],[.06,1.653],[.012,1.013],[-.098,1.013],[-.12,1.574]],.018);
        for(const k of [-1,1]){
          stitch('#C3BBA2',[[k*.099,1.823],[k*.126,1.716],[k*.094,1.465],[k*.081,1.021]],.006,.025);
          s.oval('#353E42',k*.127,1.748,.138,.073,.084,.034,0,k*.32,k*.12);
          s.oval(accent,k*.127,1.748,.169,.053,.067,.015,0,k*.32,k*.12);
          s.oval('#515358',k*.127,1.748,.183,.04,.053,.008,0,k*.32,k*.12);
        }
        s.line('#343A39',[[-.124,1.757,.152],[-.148,1.851,.032],[-.112,1.904,-.062],[0,1.912,-.103],[.111,1.896,-.065],[.151,1.842,.038],[.124,1.757,.152]],.012);
        s.line('#3E3E42',[[-.128,1.679,.145],[-.151,1.542,.128],[-.119,1.396,.139],[-.162,1.252,.118]],.0038);
      }
    }

    function headwear(){
      if(style==='cap'){
        // Six sewn panels over the crown and a covered top button.
        for(let j=0;j<6;j++){
          const a=tau*j/6+.19;
          const seam=Array.from({length:11},(_,i)=>{
            const p=(i+.25)/10.3*Math.PI/2;
            return [.334*Math.sin(p)*Math.sin(a),2.566+.152*Math.cos(p),-.024+.303*Math.sin(p)*Math.cos(a)];
          });
          s.line('#B67553',seam,.0037);
        }
        s.oval(accent,0,2.718,-.024,.017,.012,.017);
      }else if(style==='bob'){
        for(const k of [-1,1])for(let j=0;j<5;j++){
          const a=.96+j*.39,dx=k*Math.sin(a),dz=Math.cos(a);
          lock(s,[[dx*.18,2.56,dz*.17],[dx*.299,2.385,dz*.244],[dx*.314,2.20,dz*.249],[dx*(.288+.013*Math.sin(j)),2.008+.035*Math.cos(j*.9),dz*.244+.019]],
            .057,.027,hair,shine,[dx,0,dz],j+9);
        }
        for(let j=0;j<2;j++)s.line('#AD8973',[[.245,2.432+j*.018,.159],[.275,2.416+j*.018,.123],[.293,2.406+j*.018,.103]],.004);
      }else if(style==='bun'){
        for(let j=0;j<6;j++){
          const a=tau*j/6,cx=-.12,cy=2.575,cz=.157;
          s.oval('#C87961',cx+.032*Math.sin(a),cy+.027*Math.cos(a),cz,.016,.025,.009,0,0,-a);
        }
        s.oval('#F6CE77',-.12,2.575,.172,.015,.013,.007);
      }else if(style==='gent'||style==='silver'){
        for(const k of [-1,1]){
          for(let j=0;j<3;j++){
            const yy=2.271-j*.012;
            drawn('#A67F6C',[[k*.213,yy],[k*.231,yy+.001-j*.002],[k*.253,yy+.008-j*.004]],.0028,.004);
          }
          drawn('#AE8570',[[k*.053,2.146],[k*.074,2.125],[k*.085,2.104]],.003,.004);
          if(style==='silver'){
            lock(s,[onFace(k*.002,2.124,.008),onFace(k*.041,2.118,.013),onFace(k*.083,2.114,.009)],.016,.007,hair,shine,[0,.1,1],k+3);
            lock(s,[[k*.249,2.493,.106],[k*.300,2.395,.083],[k*.299,2.293,.079],[k*.268,2.197,.099]],.036,.017,hair,shine,[k*.8,0,.4],k+6);
          }
        }
      }else if(style==='twins'){
        for(const k of [-1,1]){
          for(const d of [-1,1])s.oval(accent,k*.275+d*.029,2.463,.10,.044,.023,.021,0,.13,d*.58);
          s.oval(cream,k*.275,2.463,.124,.012,.014,.008);
        }
      }else if(style==='swept'){
        const sign=1;
        for(let j=0;j<7;j++){
          const t=j/6;
          lock(s,[[sign*(.21-.05*t),2.507+.024*t,.137],[sign*(.14-.05*t),2.605+.02*t,.145],[sign*(-.036-.045*t),2.638+.013*t,.15],[sign*(-.193-.029*t),2.541+.026*t,.154],[sign*(-.252-.024*t),2.394+.04*t,.117]],
            .044,.022,hair,shine,[sign*-.1,.6,.8],j+3);
        }
      }else if(style==='helmet'){
        // Slotted cycle helmet: a dark impact liner shows between raised shell ribs.
        s.oval('#364A47',0,2.514,-.035,.346,.184,.312);
        const xy=(a,p,r=1)=>[.353*r*Math.sin(p)*Math.sin(a),2.522+.212*r*Math.cos(p)-.004*Math.cos(a),-.037+.314*r*Math.sin(p)*Math.cos(a)];
        for(let j=0;j<8;j++){
          const a=tau*j/8, w=j%2?.327:.367;
          const g=surface(20,10,(u,v)=>xy(a+(v*2-1)*w*(.86+.14*u),1.51-u*1.45,1.008),false);
          paintGeometry(g,(_x,_y,_z,i)=>ramp(accent,'#FFE0A0',.08+.21*Math.sin(i%11/10*Math.PI)));
          s.part(g,'#FFFFFF');g.dispose();
        }
        s.oval(accent,0,2.733,-.039,.065,.009,.059);
        s.oval('#DF9543',0,2.502,.229,.216,.016,.115,-.15);
        for(const k of [-1,1]){
          s.line('#4A4741',[[k*.292,2.474,.098],[k*.293,2.344,.079],[k*.271,2.194,.094],[k*.176,2.050,.059],[k*.049,1.987,.055]],.009);
          s.line('#4A4741',[[k*.301,2.493,-.151],[k*.320,2.374,-.061],[k*.272,2.194,.093]],.008);
        }
        s.oval('#D6B16D',0,1.988,.059,.052,.014,.014);
      }
    }

  }
  function wrapMesh(mesh,name){
    const group=new T.Group();
    const instance=new T.Mesh(mesh.geometry,mesh.material);
    instance.castShadow=true; instance.receiveShadow=true;
    group.name=name;group.add(instance);return group;
  }
  function food(id,grade=0,relativeOffset,sauceSupport,cheeseToPatty) {
    if(!Object.prototype.hasOwnProperty.call(heights,id))return new T.Group();
    if(!foodCache.has(id))foodCache.set(id,makeFood(id));
    let mesh=foodCache.get(id),heat=0;
    if(id==='smoke'&&sauceSupport&&global.DinerCheeseMelt){
      if(cheeseToPatty&&!foodCache.has('patty'))foodCache.set('patty',makeFood('patty'));
      const meat=cheeseToPatty?foodCache.get('patty').geometry:null;
      mesh=global.DinerCheeseMelt.drizzle(T,mesh,sauceSupport,heights.cheese,relativeOffset||[0,0],meat,cheeseToPatty,heights.patty);
    }
    if(id==='cheese'&&Number.isInteger(grade)&&grade>0&&grade<=4&&global.DinerCheeseMelt){
      heat=grade;
      if(!foodCache.has('patty'))foodCache.set('patty',makeFood('patty'));
      const meat=foodCache.get('patty'),melt=global.DinerCheeseMelt;
      if(relativeOffset?.some(v=>v!==0)&&melt.shifted){
        mesh=melt.shifted(T,mesh,meat,grade,heights.patty,relativeOffset);
      }else{
        const key='warm-cheddar-'+grade;
        if(!foodCache.has(key))foodCache.set(key,melt.form(T,mesh,meat,grade,heights.patty));
        mesh=foodCache.get(key);
      }
    }
    const layer=wrapMesh(mesh,id);
    if(id==='cheese')layer.userData.melt=heat;
    return layer;
  }
  function burger(ids,faces,offsets) {
    const group=new T.Group();group.name='burger';let y=0;
    ids.forEach((id,i)=>{
      if(!Object.prototype.hasOwnProperty.call(heights,id))return;
      const grade=id==='cheese'?global.DinerCheeseMelt?.heat(ids[i-1],faces):0;
      const [x,z]=offsets?.[i]||[0,0],below=offsets?.[i-1];
      const sauceSupport=id==='smoke'&&ids[i-1]==='cheese'?group.children.at(-1)?.children[0].geometry:null;
      const relative=grade||sauceSupport?[x-(below?.[0]||0),z-(below?.[1]||0)]:null;
      const pattyOffset=sauceSupport&&ids[i-2]==='patty'?offsets?.[i-2]||[0,0]:null;
      const cheeseToPatty=pattyOffset?[(below?.[0]||0)-pattyOffset[0],(below?.[1]||0)-pattyOffset[1]]:null;
      const layer=food(id,grade,relative,sauceSupport,cheeseToPatty);
      layer.position.set(x,y,z);y+=heights[id];group.add(layer);
    });
    return group;
  }
  // Cluster vertices in model space, preserving paint boundaries. At a rendered
  // height of 160 px a cell spans about 1.4 px. Welded normals and colours are
  // averaged so embroidered seams, eye whites and petals keep their own edges.
  const distantCache=new WeakMap();
  function distantGeometry(source){
    if(source.userData.portraitAnimated||source.userData.flexSleeve)return source;
    const cached=distantCache.get(source);
    if(cached)return cached;
    const {position,normal,color,uv}=source.attributes;
    if(position.count<130){distantCache.set(source,source);return source;}
    const grid=new Map(),xyz=[],rgb=[],directions=[],weights=[],coords=[];
    const remap=new Uint32Array(position.count),step=.024;
    for(let i=0;i<position.count;i++){
      const x=position.getX(i),y=position.getY(i),z=position.getZ(i);
      const r=color.getX(i),g=color.getY(i),b=color.getZ(i);
      const cell=(Math.floor((x+1)/step)*256+Math.floor((y+.3)/step))*128+Math.floor((z+1)/step);
      const pigment=(Math.round(Math.sqrt(r)*6)*7+Math.round(Math.sqrt(g)*6))*7+Math.round(Math.sqrt(b)*6);
      let key=cell*512+pigment;
      if(uv)key=key*1024+Math.min(31,Math.floor(uv.getX(i)*32))+32*Math.min(31,Math.floor(uv.getY(i)*32));
      let j=grid.get(key);
      if(j===undefined){
        j=weights.length;grid.set(key,j);weights.push(0);
        xyz.push(0,0,0);rgb.push(0,0,0);directions.push(0,0,0);
        if(uv)coords.push(uv.getX(i),uv.getY(i));
      }
      const off=j*3;remap[i]=j;weights[j]++;
      xyz[off]+=x;xyz[off+1]+=y;xyz[off+2]+=z;
      rgb[off]+=r;rgb[off+1]+=g;rgb[off+2]+=b;
      directions[off]+=normal.getX(i);directions[off+1]+=normal.getY(i);directions[off+2]+=normal.getZ(i);
    }
    const triangles=[],ids=source.index.array;
    for(let i=0;i<ids.length;i+=3){
      const a=remap[ids[i]],b=remap[ids[i+1]],c=remap[ids[i+2]];
      if(a!==b&&b!==c&&c!==a)triangles.push(a,b,c);
    }
    if(triangles.length===0){distantCache.set(source,source);return source;}
    for(let i=0,j=0;i<weights.length;i++,j+=3){
      const n=Math.hypot(directions[j],directions[j+1],directions[j+2])||1;
      for(let k=0;k<3;k++){
        xyz[j+k]/=weights[i];rgb[j+k]/=weights[i];directions[j+k]/=n;
      }
    }
    const geo=new T.BufferGeometry();
    geo.setAttribute('position',new T.Float32BufferAttribute(xyz,3));
    geo.setAttribute('normal',new T.Float32BufferAttribute(directions,3));
    geo.setAttribute('color',new T.Float32BufferAttribute(rgb,3));
    if(uv)geo.setAttribute('uv',new T.Float32BufferAttribute(coords,2));
    geo.setIndex(triangles);geo.computeBoundingSphere();distantCache.set(source,geo);return geo;
  }

  function flexSleeve(original,pivot){
    const geometry=new T.BufferGeometry();
    for(const [name,a] of Object.entries(original.attributes))geometry.setAttribute(name,name==='position'||name==='normal'?a.clone().setUsage(T.DynamicDrawUsage):a);
    geometry.setIndex(original.index);geometry.userData.flexSleeve=true;
    const positions=original.attributes.position,normals=original.attributes.normal;
    const out=geometry.attributes.position,directions=geometry.attributes.normal;
    const bands=Array.from({length:33},()=>[]);
    for(let i=0;i<positions.count;i++){
      const t=clipped((pivot.y+.115-positions.getY(i))/.23);
      const band=Math.round(32*t*t*(3-2*t));
      if(band)bands[band].push(i);
    }
    const previous=new T.Quaternion(),rotation=new T.Quaternion(),v=new T.Vector3();
    // Conservative bounds include the swung cuff throughout the service poses.
    geometry.boundingSphere=new T.Sphere(pivot.clone(),.62);
    function update(forearm){
      if(1-Math.abs(forearm.dot(previous))<1e-8)return;
      previous.copy(forearm);
      for(let band=1;band<bands.length;band++){
        rotation.identity().slerp(forearm,band/32);
        for(const i of bands[band]){
          v.fromBufferAttribute(positions,i).sub(pivot).applyQuaternion(rotation).add(pivot);out.setXYZ(i,v.x,v.y,v.z);
          v.fromBufferAttribute(normals,i).applyQuaternion(rotation);directions.setXYZ(i,v.x,v.y,v.z);
        }
      }
      out.needsUpdate=directions.needsUpdate=true;
    }
    return {geometry,update};
  }

  // Rigid sections share geometry across visitors; every instance has its own joints.
  function articulate(index,geometries,staff=false){
    const holder=new T.Group(),bones={},pivots={},renderParts=[];
    const instanceMeshes=[],sleeves=[];
    const owner=staff&&Boolean(geometries.restHand1);
    holder.name='guest-'+index;
    function joint(name,pivot,parent){
      const node=new T.Group(),origin=point(...pivot),base=parent?pivots[parent]:point(0,0,0);
      node.name=name;node.position.copy(origin).sub(base);(parent?bones[parent]:holder).add(node);
      let material=name==='hair'?(index===9||owner?croppedHairFinish:hairFinish):name==='bouquet'?petalFinish:['camera','vinyl','helmet','watch'].includes(name)?cameraFinish:figureFinish;
      if(name==='helmet'&&(index===9||index===11))material=figureFinish;
      if(owner&&global.DinerOwnerHead.material)material=global.DinerOwnerHead.material(geometries[name],material,T,name);
      if(!staff&&index>=2){
        if(/^(head|eyes-?1|iris-?1|mouth)$/.test(name))material=global.DinerGuestFaces?.material?.(geometries[name],material,T,name)||material;
        else if(name.startsWith('foot'))material=global.DinerGuestFootwear?.material(geometries[name],material,T)||material;
        else material=global.DinerGuestCloth?.material(geometries[name],material,T,name)||material;
      }
      const original=geometries[name];
      let geometry=(owner||!staff&&index>=2)&&global.DinerGuestFaces?.instance?global.DinerGuestFaces.instance(original,T):original;
      if(!staff&&index>=2&&index!==9&&/^arm-?1$/.test(name)&&!(name==='arm-1'&&(index===11||index===12))){
        const side=name==='arm1'?1:-1;
        const sleeve=flexSleeve(original,point(.336*side,1.357,.011));
        geometry=sleeve.geometry;
        sleeves.push([sleeve,'fore'+side]);
      }
      if(geometry!==original)instanceMeshes.push(geometry);
      const mesh=new T.Mesh(geometry,material);renderParts.push([mesh,geometry]);
      mesh.position.copy(origin).multiplyScalar(-1);mesh.castShadow=true;mesh.receiveShadow=true;node.add(mesh);
      bones[name]=node;pivots[name]=origin;
    }
    joint('body',[0,0,0]);
    let upperBody='body';
    if(staff){
      const spine=new T.Group(),waist=point(0,.954,0),torso=bones.body.children[0];
      spine.name='spine';bones.body.add(spine);spine.position.copy(waist);spine.add(torso);torso.position.sub(waist);
      bones.spine=spine;pivots.spine=waist;upperBody='spine';holder.name='house-chef';
    }
    joint('head',[0,1.98,0],upperBody);
    const headShape=[[1,.995],[.99,1.02],[1.01,.97],[.95,1.04],[.96,1.02],[1.06,1.03],[1.01,.95],[1.01,1.0],[.96,1.045],[1.015,1.04],[.97,.98],[.975,1.02],[1.025,1.02],[1.015,1.04]][index];
    if(!owner)bones.head.scale.set(headShape[0],headShape[1],1);
    if(!staff&&index>=2){
      const scale=[.655,.645,.642,.687,.74,.66,.658,.667,.644,.642,.682][index-2];
      bones.head.scale.multiplyScalar(scale);
      bones.head.position.y-=.026;
    }
    // Use the anatomical face in the gallery even when extra geometry such
    // as a helmet, hat or long hair belongs to the same articulated joint.
    const faceBox=owner?new T.Box3().setFromBufferAttribute(geometries.head.attributes.position)
      .translate(pivots.head.clone().multiplyScalar(-1)):new T.Box3(point(-.302,-.013,-.24),point(.302,.635,.265));
    holder.userData.portraitFaceBounds=out=>out.copy(faceBox).applyMatrix4(bones.head.matrixWorld);
    joint('mouth',[0,owner?global.DinerOwnerHead.mouthY:2.083,.15],'head');
    if(geometries.hair)joint('hair',[0,1.98,0],'head');
    if(geometries.helmet)joint('helmet',[0,1.98,0],'head');
    for(const k of [-1,1]){
      const eyeY=owner?global.DinerOwnerHead.eyeY:2.285;
      joint('eyes'+k,[k*.142,eyeY,.12],'head');
      joint('iris'+k,[k*.142,eyeY,.12],'eyes'+k);
      joint('arm'+k,[k*.272,1.76,-.015],upperBody);
      const elbow=index===9?[k*.347,1.36,.067]:index===12&&k===-1?[-.35,1.343,.046]:index===11&&k===-1?[-.362,1.356,.067]:[k*.336,1.357,.011];
      joint('fore'+k,elbow,'arm'+k);
      if(geometries['mealFore'+k]){
        joint('mealFore'+k,elbow,'fore'+k);
        bones['mealFore'+k].visible=false;
      }
      if(staff){
        const at=[k*.324,.974,.069];joint('hand'+k,at,'fore'+k);joint('noteHand'+k,at,'hand'+k);
        bones['noteHand'+k].visible=false;
        if(owner){
          joint('restHand'+k,at,'hand'+k);
          bones['hand'+k].children[0].visible=false;
        }
      }
      if(k===1&&geometries.camera){
        joint('camera',[0,1.52,.30],'fore1');
        joint('shutter',[.097,1.594,.292],'fore1');
      }
      if(k===-1&&geometries.watch)joint('watch',[-.328,1.064,.05],'fore-1');
      if(k===-1&&geometries.sleeve){
        joint('sleeve',[-.175,1.396,.269],'fore-1');
        joint('vinyl',[-.175,1.396,.269],'sleeve');
      }
      if(k===-1&&geometries.bouquet)joint('bouquet',[-.265,1.45,.229],'fore'+k);
      joint('thigh'+k,[k*.122,.956,0],'body');
      joint('shin'+k,[k*.128,.516,.016],'thigh'+k);
      joint('foot'+k,[k*.128,.160,-.01],'shin'+k);
    }
    let distant=false;
    function bendCloth(){for(const [sleeve,name] of sleeves)sleeve.update(bones[name].quaternion);}
    if(instanceMeshes.length)holder.userData.dispose=()=>{for(const geometry of instanceMeshes)geometry.dispose();};
    holder.userData.detailSources=()=>renderParts.map(([mesh,high])=>[mesh,high,distantGeometry(high)]);
    holder.userData.setDetailForHeight=pixels=>{
      const next=distant?pixels<215:pixels<175;
      if(next===distant)return;
      distant=next;
      for(const [mesh,original] of renderParts)mesh.geometry=distant?distantGeometry(original):original;
      holder.userData.distant=distant;
    };
    const reachData=[],freeHands=[];
    const mealCenter=new T.Vector3(),ray=new T.Vector3(),pole=new T.Vector3(),elbowPoint=new T.Vector3(),targetPalm=new T.Vector3(),aim=new T.Vector3();
    const worldFore=new T.Quaternion(),relativeFore=new T.Quaternion();
    for(const k of [-1,1]){
      const shoulder=pivots['arm'+k],elbow=pivots['fore'+k],upper=elbow.clone().sub(shoulder);
      const lower=point(.324*k,.974,.069).sub(elbow);
      const data={k,shoulder,upperLength:upper.length(),lowerLength:lower.length(),upper:upper.normalize(),lower:lower.normalize()};
      reachData.push(data);
      if(!bones['mealFore'+k])freeHands.push(data);
    }
    // During the meal the album leans against the booth, the bouquet lies on
    // the seat and the camera rests on its base. Use the same prop meshes.
    const prop=bones.camera||bones.bouquet||bones.sleeve;
    let parked,carryBone;
    if(prop){
      carryBone=prop.parent;parked=new T.Group();parked.name='parkedProps';bones.body.add(parked);
      if(index===9){parked.position.set(.52,1.101,-.04);parked.rotation.y=-.34;}
      if(index===11){parked.position.set(-.55,1.055,.14);parked.rotation.set(-1.19,.10,.16);}
      if(index===12){parked.position.set(-.56,1.057,-.045);parked.rotation.set(-.24,.36,.17);}
    }
    function setDiningHands(eating){
      if(!prop)return;
      for(const {k} of reachData){
        const alternative=bones['mealFore'+k];if(!alternative)continue;
        alternative.visible=eating;bones['fore'+k].children[0].visible=!eating;
      }
      if(bones.shutter)bones.shutter.visible=!eating;
      if(eating){parked.add(prop);prop.position.set(0,0,0);}
      else{
        carryBone.add(prop);prop.position.copy(pivots[prop.name]).sub(pivots[carryBone.name]);
      }
    }
    let holdingMeal=false,lastBite=NaN;
    // A free hand finds a feature of its owner's clothes when they wait:
    // the varsity pocket, the sketchbook, a waist tie or a shoulder strap.
    const waitingHand={
      2:[1,.212,1.199,.126],3:[-1,-.244,1.213,.159],4:[1,.202,1.325,.119],
      5:[-1,-.170,1.322,.194],6:[1,.189,1.596,.146],7:[-1,-.147,1.300,.184],
      8:[-1,-.156,1.709,.163]
    }[index];
    function aimPalm(data,target){
      const {k,shoulder,upperLength,lowerLength,upper,lower}=data;
      ray.copy(target).sub(shoulder);
      const length=Math.max(Math.abs(upperLength-lowerLength)+.003,Math.min(ray.length(),upperLength+lowerLength-.003));
      ray.normalize();
      const along=(length*length+upperLength**2-lowerLength**2)/(2*length);
      pole.set(k*.96,-.16,-.84);pole.addScaledVector(ray,-pole.dot(ray)).normalize();
      elbowPoint.copy(shoulder).addScaledVector(ray,along).addScaledVector(pole,Math.sqrt(Math.max(0,upperLength**2-along**2)));
      const arm=bones['arm'+k],fore=bones['fore'+k];
      arm.quaternion.setFromUnitVectors(upper,aim.copy(elbowPoint).sub(shoulder).normalize());
      worldFore.setFromUnitVectors(lower,aim.copy(shoulder).addScaledVector(ray,length).sub(elbowPoint).normalize());
      fore.quaternion.copy(relativeFore.copy(arm.quaternion).invert().multiply(worldFore));
    }
    function cupMeal(center,bite){
      const tailored=!staff&&index>=2;
      for(const data of reachData){
        // The served bun has a radius of about .26. Rest the palm against
        // the rim so the fingers can curl around its visible front edge.
        const span=tailored?.270-.009*bite:.216-.020*bite;
        targetPalm.set(center.x+data.k*span,center.y-.023,center.z+(tailored?.043:-.040));
        aimPalm(data,targetPalm);
      }
    }
    function reachForMeal(bite){
      const tailored=!staff&&index>=2,jawOffset=tailored?.026+.103*(1-bones.head.scale.y):0;
      mealCenter.set(0,1.622+(.317-jawOffset)*bite,.65-(tailored?.277:.237)*bite);
      cupMeal(mealCenter,bite);
    }
    if(!staff&&index>=2){
      const inverseBody=new T.Matrix4(),carriedCenter=new T.Vector3();
      holder.userData.alignMealGrip=localCenter=>{
        if(!holdingMeal)return;
        bones.body.updateMatrix();
        carriedCenter.copy(localCenter).applyMatrix4(inverseBody.copy(bones.body.matrix).invert());
        cupMeal(carriedCenter,lastBite);bendCloth();
      };
    }
    const recordRim=new T.Vector3(),restPalm=new T.Vector3(),beginArm=new T.Quaternion(),beginFore=new T.Quaternion();
    if(staff){
      const inverseTorso=new T.Matrix4(),inverseHand=new T.Quaternion(),orientation=new T.Quaternion(),spine=bones.spine;
      holder.userData.serviceHands=(writing,left,right,lean,yawL=0,yawR=0)=>{
        spine.rotation.x=lean;
        bones.body.updateMatrix();spine.updateMatrix();
        inverseTorso.multiplyMatrices(bones.body.matrix,spine.matrix).invert();
        for(const data of reachData){
          const k=data.k,arm=bones['arm'+k],fore=bones['fore'+k],hand=bones['hand'+k];
          targetPalm.copy(k<0?left:right).applyMatrix4(inverseTorso).add(pivots.spine);
          aimPalm(data,targetPalm);
          orientation.setFromAxisAngle(aim.set(0,1,0),k<0?yawL:yawR);
          inverseHand.copy(bones.body.quaternion).multiply(spine.quaternion).multiply(arm.quaternion).multiply(fore.quaternion).invert();
          hand.quaternion.copy(inverseHand.multiply(orientation));
          hand.children[0].visible=!writing;bones['noteHand'+k].visible=writing;
          if(owner)bones['restHand'+k].visible=false;
        }
      };
    }
    holder.userData.mealAnchor=out=>{
      if(!holdingMeal)return false;
      bones.body.updateMatrix();return out.copy(mealCenter).applyMatrix4(bones.body.matrix);
    };
    let lastSit=NaN,lastWalk=NaN,lastPhase=NaN,lastWait=0;
    // Leave one hand beside the knee while the other rests at the table edge.
    // The courier keeps his watch hand free, and the last two guests retain
    // their original grip on the bouquet and record.
    const lapSide=!staff&&index>=2&&index<=10&&index!==9?
      ([3,6,8,10].includes(index)?1:-1):0;
    const restsAtEdge=!staff&&index>=2&&index!==10&&index!==12;
    holder.userData.setVisitPose=(mode,phase=0,amount=1)=>{
      const sit=mode==='eat'?1:mode==='sit'?clipped(amount):0,walk=mode==='walk'?clipped(amount):0;
      const wait=mode==='wait'?clipped(amount):0;
      const nextHolding=mode==='eat'&&reachData.length>0,bite=nextHolding?clipped(amount):0;
      if(sit===lastSit&&walk===lastWalk&&wait===lastWait&&(!walk||phase===lastPhase)&&holdingMeal===nextHolding){
        if(nextHolding&&bite!==lastBite){reachForMeal(bite);lastBite=bite;bendCloth();}
        return;
      }
      if(holdingMeal!==nextHolding)setDiningHands(nextHolding);
      holdingMeal=nextHolding;lastBite=bite;
      lastSit=sit;lastWalk=walk;lastPhase=phase;lastWait=wait;
      const lean=waitingHand?waitingHand[0]*.023:.012;
      const roll=.021*walk*Math.sin(phase)+lean*wait,cr=Math.cos(roll),sr=Math.sin(roll);
      let floor=Infinity;
      bones.body.rotation.z=roll;
      for(const k of [-1,1]){
        const swing=k*Math.sin(phase),lift=Math.max(0,k*Math.cos(phase));
        bones['thigh'+k].rotation.x=-1.45*sit+.56*walk*swing;
        bones['shin'+k].rotation.x=1.47*sit+walk*(.14+.61*lift);
        bones['foot'+k].rotation.x=-.025*sit-walk*(.13+.27*lift+.13*swing);
        if(wait&&k===1){
          bones.thigh1.rotation.x-=.11*wait;bones.shin1.rotation.x+=.18*wait;bones.foot1.rotation.x-=.07*wait;
        }
        const hip=bones['thigh'+k].rotation.x,knee=hip+bones['shin'+k].rotation.x,ankle=knee+bones['foot'+k].rotation.x;
        const ankleY=.956-.440*Math.cos(hip)-.016*Math.sin(hip)-.356*Math.cos(knee)+.026*Math.sin(knee);
        const cosAnkle=Math.cos(ankle),sinAnkle=Math.sin(ankle),shoe=geometries['foot'+k].attributes.position.array;
        for(let j=0;j<shoe.length;j+=3){
          const y=ankleY+(shoe[j+1]-.160)*cosAnkle-(shoe[j+2]+.01)*sinAnkle;
          floor=Math.min(floor,y*cr+shoe[j]*sr);
        }
        bones['arm'+k].rotation.set(-.36*sit-.36*walk*swing,0,0);
        bones['fore'+k].rotation.set(-.78*sit-walk*(.12+.085*swing),0,0);
        if(wait&&index!==9&&index!==10&&index!==11&&index!==12){
          bones['arm'+k].rotation.x-=wait*(k===1?.09:.18);
          bones['fore'+k].rotation.x-=wait*(k===1?.21:.61);
          bones['fore'+k].rotation.z+=k*.08*wait;
        }
        if(index===9){
          bones['arm'+k].rotation.x=.12*sit;
          bones['fore'+k].rotation.x=-.39*sit;
        }
        if((index===11||index===12)&&k===-1){
          bones['arm'+k].rotation.x=(index===11?-.26:-.50)*sit-.061*walk*swing;
          bones['arm'+k].rotation.z=(index===11?-.60:-.66)*sit;
          bones['fore'+k].rotation.x=(index===11?0:.10)*sit+.032*walk*swing;
        }
      }
      bones.body.position.y=-floor;
      if(wait&&waitingHand){
        const [side,x,y,z]=waitingHand,arm=bones['arm'+side],fore=bones['fore'+side];
        beginArm.copy(arm.quaternion);beginFore.copy(fore.quaternion);
        aimPalm(reachData.find(data=>data.k===side),targetPalm.set(x,y,z));
        arm.quaternion.slerp(beginArm,1-wait);fore.quaternion.slerp(beginFore,1-wait);
      }
      if(holdingMeal)reachForMeal(bite);
      else if(sit>0){
        // Lift relaxed hands before advancing them past the near edge of the table.
        const ease=x=>{const u=clipped(x);return u*u*(3-2*u);};
        const raise=ease(sit/.76),over=ease((sit-.22)/.78);
        for(const data of freeHands){
          if(data.k===lapSide){
            // Bring the wrist in once the knees turn forward. It stays on the
            // chair side of the table edge throughout the descent.
            const settle=ease((sit-.39)/.61),besideKnee=.166+.015*(index%3);
            targetPalm.set(data.k*(.324-(.324-besideKnee)*settle),
              .974+(.132+.013*(index%3))*settle,.069+(.096+.014*(index%4))*settle);
          }else{
            const settleAtEdge=restsAtEdge ? .054*ease((sit-.78)/.22) : 0;
            targetPalm.set(data.k*(.324-.048*ease(sit)),.974+.631*raise-settleAtEdge,.069+.412*over);
          }
          const arm=bones['arm'+data.k],fore=bones['fore'+data.k],blend=ease(sit/.32);
          beginArm.copy(arm.quaternion);beginFore.copy(fore.quaternion);
          aimPalm(data,targetPalm);
          arm.quaternion.slerp(beginArm,1-blend);fore.quaternion.slerp(beginFore,1-blend);
        }
      }
      bendCloth();
    };
    holder.userData.setVisitPose('stand');
    holder.userData.onFrame=(t,reduced,phase)=>{
      const sec=t*.001,seed=index*.79;
      const blink=reduced?0:Math.max(0,1-Math.abs(((t+index*413)%4760)-4510)/108);
      for(const k of [-1,1]){
        bones['eyes'+k].scale.y=1-.96*blink;
        const iris=bones['iris'+k];
        // Shift only the irises. The lids and sclera stay anchored to the face.
        iris.position.x=reduced?0:.0042*Math.sin(sec*.57+seed)+.0016*Math.sin(sec*1.13+index);
        iris.position.y=reduced?0:.0019*Math.sin(sec*.71+seed);
      }
      bones.head.rotation.y=reduced?0:Math.sin(sec*.68+seed)*.039;
      if(lastWait)bones.head.rotation.y+=lastWait*(reduced?.075:.075+.09*Math.sin(sec*.43+seed));
      bones.head.rotation.x=reduced?0:Math.sin(sec*1.42+seed)*.009+(phase==='result'?-.027:0);
      bones.head.rotation.z=reduced?0:Math.sin(sec*.47+seed)*.013;
      const eating=phase==='eating'&&!reduced;
      const chew=eating?Math.max(0,Math.sin(sec*4.1+seed))**1.4:0;
      bones.mouth.scale.y=1+.30*chew;
      bones.mouth.position.y=pivots.mouth.y-pivots.head.y-.0028*chew;
      if(owner||!staff&&index>=2)global.DinerGuestFaces?.expression?.(bones,blink,chew);
      bones.head.rotation.x+=.016*chew;
      if(index===10&&!holdingMeal&&!lastWalk&&(lastSit===0||lastSit===1)){
        const rest=lastSit||0,clock=(sec+.37)%7.7,check=reduced?0:Math.sin(Math.PI*clipped((clock-1.4)/2.3))**2;
        const left=reachData[0];
        if(rest===1)
          aimPalm(left,targetPalm.set(-.276+.092*check,1.605+.216*check,.481-.160*check));
        else{
          bones['arm-1'].rotation.set(-.36*rest-.62*check,0,.20*check);
          bones['fore-1'].rotation.set(-.78*rest-(1.08-.48*rest)*check,-.26*check,-.33*check);
        }
        bones.head.rotation.x+=.135*check;bones.head.rotation.y-=.09*check;
      }
      if(index===12){
        const clock=(sec+1.3)%8.1,active=!reduced&&!eating&&!lastWalk&&!holdingMeal;
        const ease=x=>{const u=clipped(x);return u*u*(3-2*u);};
        const grasp=active?ease((clock-.76)/.91)*ease((5.94-clock)/.86):0;
        const read=active?ease((clock-1.77)/.86)*ease((5.03-clock)/.84):0;
        bones.sleeve.rotation.z=.065*read;
        bones.vinyl.position.set(.012*read,.068*read,0);
        bones.head.rotation.x+=.075*grasp;
        bones.head.rotation.z+=(reduced?0:.012*Math.sin(sec*2.64))*(1-read);
        if(!lastWalk&&!holdingMeal&&(lastSit===0||lastSit===1)){
          const sit=lastSit||0;
          if(sit===1)aimPalm(freeHands[0],targetPalm.set(.276,1.605,.481));
          else{bones.arm1.rotation.set(-.36*sit,0,0);bones.fore1.rotation.set(-.78*sit,0,0);}
          if(grasp){
            const arm=bones.arm1,fore=bones.fore1;
            arm.updateMatrix();fore.updateMatrix();
            restPalm.set(.324,.974,.069).sub(pivots.fore1).applyMatrix4(fore.matrix).applyMatrix4(arm.matrix);
            // Follow the same point on the exposed vinyl rim as his left wrist
            // and sleeve move. The fingers stop just ahead of the shiny groove.
            recordRim.set(-.058,1.743,.309).sub(pivots.vinyl);
            for(const part of [bones.vinyl,bones.sleeve,bones['fore-1'],bones['arm-1']]){
              part.updateMatrix();recordRim.applyMatrix4(part.matrix);
            }
            aimPalm(freeHands[0],targetPalm.copy(restPalm).lerp(recordRim,grasp));
          }
        }
      }
      if(index===9&&!holdingMeal){
        // Both elbows share an axis in this two-handed grip, so the palms
        // stay in contact as he tips the rangefinder up to inspect its dials.
        const clock=(sec+.9)%8.3,check=reduced?0:Math.sin(Math.PI*clipped((clock-2.1)/2.7))**2;
        const tip=-.39*(lastSit||0)-.36*check;
        bones.fore1.rotation.x=bones['fore-1'].rotation.x=tip;
        bones.head.rotation.x+=.10*check;
        bones.shutter.rotation.x=reduced?0:.22*Math.exp(-(((clock-3.9)/.16)**2));
      }
      bendCloth();
    };
    return holder;
  }

  function customer(index) {
    index=((Math.trunc(Number(index)||0)%looks.length)+looks.length)%looks.length;
    if(!peopleCache.has(index)){
      const geometry=makeCustomer(index);
      if(index>=2){
        global.DinerGuestFaces?.refine(index,geometry,T);
        global.DinerGuestHair?.refine(index,geometry,T);
        global.DinerGuestWardrobe?.refine(index,geometry,T);
        global.DinerGuestCloth?.fit(index,geometry,T,looks[index].skin);
        const diningSleeves={};
        for(const side of [-1,1])if(geometry['mealFore'+side])diningSleeves['fore'+side]=geometry['mealFore'+side];
        if(Object.keys(diningSleeves).length)global.DinerGuestCloth?.fit(index,diningSleeves,T,looks[index].skin);
      }
      peopleCache.set(index,geometry);
    }
    return articulate(index,peopleCache.get(index));
  }
  function chef(){
    if(!chefSections){
      chefSections=global.DinerOwnerHead&&global.DinerOwnerUniform&&global.DinerOwnerHands
        ? Object.assign(global.DinerOwnerUniform.build(T,()=>sculpture(figureFinish),'#D6A484'),
          global.DinerOwnerHead.create(T),global.DinerOwnerHands.build(T,()=>sculpture(figureFinish),'#D6A484'))
        : makeCustomer(legacyChefStyle,true);
    }
    return articulate(legacyChefStyle,chefSections,true);
  }
  global.DinerModels=Object.freeze({customer,chef,food,burger});
})(window);
