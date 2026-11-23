(() => {
  'use strict';
  function create(T,parts){
    const root=new T.Group(),roof=new T.Group();root.name='Palm Street Diner';root.add(roof);
    const brick=0xc68c71,cream=0xf4dfb6,green=0x365d50,deep=0x27473e,coral=0xb54f37,brass=0xb38c4b,steel=0x90a49d;
    const materials=new Map(),unit=new T.BoxGeometry(1,1,1),drum=new T.CylinderGeometry(1,1,1,32),batches=new Map();
    const srgb=c=>new T.Color(c).convertSRGBToLinear();
    function mat(color){if(typeof color==='object')return color;if(!materials.has(color))materials.set(color,new T.MeshStandardMaterial({color:srgb(color),roughness:.76}));return materials.get(color);}
    function instance(group,geo,color,x,y,z,w,h,d,ax=0,ay=0,az=0){const m=mat(color),key=group.uuid+geo.uuid+m.uuid;let batch=batches.get(key);if(!batch){batch={group,geo,m,transforms:[]};batches.set(key,batch);}const o=new T.Object3D();o.position.set(x,y,z);o.rotation.set(ax,ay,az);o.scale.set(w,h,d);o.updateMatrix();batch.transforms.push(o.matrix);}
    const box=(g,x,y,z,w,h,d,c,ax=0,ay=0,az=0)=>instance(g,unit,c,x,y,z,w,h,d,ax,ay,az);
    const tube=(g,x,y,z,r,h,c,ax=0,az=0)=>instance(g,drum,c,x,y,z,r,h,r,ax,0,az);
    function textured(w,h,paint){const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;paint(canvas.getContext('2d'),w,h);const map=new T.CanvasTexture(canvas);map.encoding=T.sRGBEncoding;map.anisotropy=4;return map;}
    function plaque(group,x,y,z,w,h,map,yaw=Math.PI){const m=new T.MeshStandardMaterial({map,roughness:.68});const mesh=new T.Mesh(new T.PlaneGeometry(w,h),m);mesh.position.set(x,y,z);mesh.rotation.y=yaw;group.add(mesh);return mesh;}
    function letters(ctx,text,font,x,y,colour){ctx.fillStyle=colour;ctx.font=font;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,x,y);}
    const sign=textured(1536,280,(c,w,h)=>{c.fillStyle='#f9e8ba';c.fillRect(0,0,w,h);c.strokeStyle='#b69354';c.lineWidth=5;c.strokeRect(10,10,w-20,h-20);c.strokeStyle='#385b4e';c.lineWidth=3;c.strokeRect(18,18,w-36,h-36);letters(c,'B U R G E R    C L U B','italic bold 115px Georgia',w/2,116,'#9a452f');letters(c,'铁 板 汉 堡 社     •     P A L M   S T R E E T','bold 28px Microsoft YaHei, sans-serif',w/2,211,'#385a4d');for(const x of [55,w-55]){c.fillStyle='#d6a755';c.beginPath();c.moveTo(x,96);c.lineTo(x+9,124);c.lineTo(x+28,134);c.lineTo(x+9,144);c.lineTo(x,171);c.lineTo(x-9,144);c.lineTo(x-28,134);c.lineTo(x-9,124);c.fill();}});
    // One physical-scale atlas also preserves the running bond on rasterizers that clamp UVs.
    const paintBrick=textured(1280,512,(c,w,h)=>{
      c.fillStyle='#c3af95';c.fillRect(0,0,w,h);const bw=18.5,bh=9.0;
      const colours=['#bb876f','#c38e74','#ba876f','#b8826d','#c79376','#bc8c76','#bf8a70'];
      for(let row=0;row<=h/bh;row++)for(let col=-1;col<=w/bw;col++){
        const x=(col+(row%2)*.5)*bw,y=row*bh,seed=Math.abs((row*4283)^(col*1437));
        c.fillStyle=colours[(seed+Math.floor(col*col/11))%colours.length];c.fillRect(x+.46,y+.71,bw-.92,bh-1.26);
        c.fillStyle='#e6b49470';c.fillRect(x+.93,y+.85,bw-1.8,.68);
        for(let k=0;k<6;k++){c.fillStyle=k%2?'#875f4724':'#e7bda128';c.fillRect(x+1+(seed>>k)%15,y+2+((seed+k*11)%5),1+k%3,.84);}
      }
      const water=c.createLinearGradient(0,0,0,h);water.addColorStop(0,'#544c4429');water.addColorStop(.22,'#6e635500');water.addColorStop(.87,'#67574303');water.addColorStop(1,'#5c544a30');c.fillStyle=water;c.fillRect(0,0,w,h);
    });const masonry=new T.MeshStandardMaterial({map:paintBrick,roughness:.94});
    const hall=parts.hall.clone(true);hall.traverse(o=>{if(o.name==='Harbor street')o.visible=false;});root.add(hall);
    const entry=parts.door?parts.door.clone(true):new T.Group();
    if(!parts.door)entry.position.set(-.84,0,-4.22);
    entry.rotation.y=0;root.add(entry);
    const doorFaceGroup=new T.Group();doorFaceGroup.position.set(.84,0,0);entry.add(doorFaceGroup);
    if(parts.jukebox)root.add(parts.jukebox.clone(true));
    const kitchen=new T.Group();kitchen.position.set(2.39,0,8.4);kitchen.rotation.y=Math.PI;root.add(kitchen);
    for(const [i,part] of [parts.grill,parts.prep,parts.galley].entries()){if(!part)continue;const copy=part.clone(true);copy.visible=true;copy.position.x=i===1?4.78:0;kitchen.add(copy);}
    // The playable sets extend past their camera edges. Trim only the exhibit's copies to its real building envelope.
    function trim(mesh,limits){
      const geo=mesh.geometry,p=geo.attributes.position;if(!p)return;
      if(!geo.boundingBox)geo.computeBoundingBox();
      const bounds=geo.boundingBox.clone().applyMatrix4(mesh.matrixWorld),lo=bounds.min,hi=bounds.max;
      const planes=limits.filter(([axis,min,value])=>min?lo[axis]<value-.001:hi[axis]>value+.001);
      if(!planes.length)return;
      if(planes.some(([axis,min,value])=>min?hi[axis]<value:lo[axis]>value)){mesh.visible=false;return;}
      const keys=['position','normal','color','uv'].filter(name=>geo.attributes[name]),out=Object.fromEntries(keys.map(k=>[k,[]]));
      const components=keys.map(k=>geo.attributes[k].itemSize);
      const mw=mesh.matrixWorld.elements,axisIndex={x:0,y:1,z:2};
      function distance(a,[axis,min,val]){
        const n=axisIndex[axis],w=mw[n]*a[0]+mw[n+4]*a[1]+mw[n+8]*a[2]+mw[n+12];
        return min?w-val:val-w;
      }
      function data(i){const v=[];for(const k of keys){const a=geo.attributes[k];v.push(a.getX(i),a.getY(i));if(a.itemSize>2)v.push(a.getZ(i));}return v;}
      function emit(row){let offset=0;for(let k=0;k<keys.length;k++){for(let j=0;j<components[k];j++)out[keys[k]].push(row[offset++]);}}
      const index=geo.index,count=index?index.count:p.count;
      for(let j=0;j<count;j+=3){
        let poly=[0,1,2].map(k=>data(index?index.getX(j+k):j+k));
        for(const plane of planes){
          const next=[];if(!poly.length)break;
          let a=poly[poly.length-1],da=distance(a,plane);
          for(const b of poly){const db=distance(b,plane);
            if((db>=0)!==(da>=0)){const t=da/(da-db);next.push(a.map((v,k)=>v+t*(b[k]-v)));}
            if(db>=0)next.push(b);a=b;da=db;
          }
          poly=next;
        }
        for(let k=1;k<poly.length-1;k++){emit(poly[0]);emit(poly[k]);emit(poly[k+1]);}
      }
      if(!out.position.length){mesh.visible=false;return;}
      const clipped=new T.BufferGeometry();keys.forEach((k,i)=>clipped.setAttribute(k,new T.Float32BufferAttribute(out[k],components[i])));mesh.geometry=clipped;
    }
    root.updateMatrixWorld(true);
    kitchen.traverse(o=>{if(o.isMesh)trim(o,[['x',true,-5.97],['x',false,5.97],['z',true,4.64],['z',false,10.18],['y',false,4.43]]);});
    const indoorAwning=[srgb(0xffedc3),srgb(0xc74732)];
    function removeIndoorCanopy(mesh){
      if(!mesh.material.color||!indoorAwning.some(c=>c.equals(mesh.material.color)))return;
      const geo=mesh.geometry,p=geo.attributes.position,idx=geo.index,count=idx?.count??p.count;
      if(!geo.boundingBox)geo.computeBoundingBox();
      const bounds=geo.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
      if(bounds.min.y>3.66||bounds.max.y<3.32||bounds.min.z>-3.86||bounds.max.z< -4.92)return;
      const keep=[],v=[new T.Vector3(),new T.Vector3(),new T.Vector3()];
      for(let i=0;i<count;i+=3){
        const ids=[0,1,2].map(k=>idx?idx.getX(i+k):i+k);
        for(let k=0;k<3;k++)v[k].fromBufferAttribute(p,ids[k]).applyMatrix4(mesh.matrixWorld);
        const inside=v.every(a=>a.y>=3.32&&a.y<=3.66&&a.z>=-4.92&&a.z<=-3.86);
        if(!inside||!v.some(a=>a.z< -4.41||a.z> -4.04))keep.push(...ids);
      }
      if(keep.length===count)return;
      if(!keep.length){mesh.visible=false;return;}
      const cut=new T.BufferGeometry();for(const key of Object.keys(geo.attributes))cut.setAttribute(key,geo.attributes[key]);cut.setIndex(keep);mesh.geometry=cut;
    }
    hall.traverse(o=>{
      if(!o.isMesh||!o.visible)return;
      removeIndoorCanopy(o);if(!o.visible)return;
      trim(o,[['y',false,4.43]]);
      if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();
      const b=o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
      if(b.max.y<.10&&(b.min.z<-4.4||b.max.z>4.65))trim(o,[['x',true,-6.09],['x',false,6.09],['z',true,-4.34],['z',false,4.62]]);
    });
    // Street carpentry, façade fascia and lintel. Hand-set pins and sill returns cast their own outlines.
    box(root,0,4.11,-4.30,12.32,.86,.32,green);box(root,0,4.52,-4.34,12.48,.09,.42,cream);box(root,0,3.73,-4.43,12.4,.10,.38,brass);
    box(root,0,4.10,-4.52,5.75,.95,.25,deep);box(root,0,4.10,-4.67,5.60,.86,.075,brass);plaque(root,0,4.10,-4.713,5.49,.80,sign);
    for(const side of [-1,1]){for(const x of [.92,3.4,6.04]){const xx=x*side;box(root,xx,.59,-4.37,.19,1.14,.22,green);box(root,xx,2.34,-4.30,.105,2.33,.15,cream);box(root,xx,1.13,-4.43,.23,.09,.30,brass);}for(const y of [.15,.98])box(root,3.49*side,y,-4.42,5.04,.09,.19,green);}
    // Shared kitchen annex. The high pass counter leaves a real opening between the dining floor and cooking benches.
    box(root,0,-.075,7.39,12.24,.14,5.91,0xa2a59a);box(root,0,2.24,10.31,12.24,4.48,.22,masonry);
    box(root,-5.62,1.58,4.55,.95,3.17,.16,cream);
    box(root,-2.67,1.58,4.55,2.30,3.17,.16,cream);
    box(root,-4.478,2.775,4.55,1.336,.79,.16,cream);
    for(const x of [-5.14,-3.817])box(root,x,1.195,4.55,.074,2.39,.23,green);
    box(root,-4.478,2.383,4.55,1.395,.080,.236,green);
    const swing=new T.Group();swing.position.set(-5.082,0,4.553);swing.rotation.y=-1.54;root.add(swing);
    box(swing,.546,.827,0,1.087,1.10,.064,green);box(swing,.544,.445,-.036,.97,.237,.018,steel);
    for(const y of [.36,1.22])tube(swing,.014,y,0,.033,.10,brass);
    box(root,1.55,.60,4.55,6.15,1.20,.17,green);box(root,5.39,1.58,4.55,1.52,3.17,.16,cream);
    box(root,1.55,1.23,4.55,6.26,.085,.53,0xbc9777);box(root,1.55,1.273,4.55,6.21,.032,.51,steel);
    box(roof,0,3.55,4.55,12.22,.90,.16,cream);
    for(const x of [-1.38,1.47,4.49])box(root,x,1.06,4.64,.069,.28,.24,steel,-.34);
    box(root,1.53,2.95,4.687,6.25,.085,.070,steel);
    for(const [x,h,angle] of [[-.98,.29,-.028],[-.77,.35,.018],[.95,.30,-.02]]){box(root,x,2.91-h*.5,4.69,.145,h,.014,0xf6e4bc,0,0,angle);for(let j=0;j<3;j++)box(root,x,2.86-j*.036,4.701,.083-j*.01,.007,.004,0x988c75);}
    const black=0x384a43,limestone=0xcdbc99,plum=0x80594d,bronze=0x8a795d;
    function link(g,a,b,r,c){
      const p=new T.Vector3(...a),q=new T.Vector3(...b),delta=q.clone().sub(p),mid=p.add(q).multiplyScalar(.5),rot=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.clone().normalize());
      const e=new T.Euler().setFromQuaternion(rot);instance(g,drum,c,mid.x,mid.y,mid.z,r,delta.length(),r,e.x,e.y,e.z);
    }
    function bent(g,pts,r,c,steps=24){
      const geometry=new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(p=>new T.Vector3(...p))),steps,r,8,false);
      const m=new T.Mesh(geometry,mat(c));m.castShadow=true;m.receiveShadow=true;g.add(m);return m;
    }
    // Applied brass mouldings taper toward the ends of the fascia and throw a slim real shadow.
    for(const s of [-1,1]){
      for(const [y,width] of [[3.984,2.09],[4.091,2.51],[4.199,2.09]]){
        const near=3.10;box(root,s*(near+width*.5),y,-4.478,width,.026,.018,0xb09b64);
        tube(root,s*(near+width),y,-4.494,.020,.018,brass,Math.PI/2);
      }
      for(const a of [-1,1])link(root,[s*5.773,4.089,-4.486],[s*5.864,4.089+a*.077,-4.486],.013,brass);
    }
    const transomMap=textured(512,142,(c,w,h)=>{
      const bottom=h*.985,cx=w/2,ry=h*1.77,rx=w*.55;
      c.fillStyle='#617d6d';c.fillRect(0,0,w,h);
      for(let i=0;i<13;i++){
        const a=Math.PI*i/13,b=Math.PI*(i+1)/13;
        c.fillStyle=['#819c8c','#a0ac89','#ccab71','#c2ad86','#829f96','#6f9391'][i%6];
        c.strokeStyle='#657366';c.lineWidth=3;c.beginPath();c.moveTo(cx,bottom);c.lineTo(cx+Math.cos(a)*rx,bottom-Math.sin(a)*ry);c.lineTo(cx+Math.cos(b)*rx,bottom-Math.sin(b)*ry);c.closePath();c.fill();c.stroke();
      }
      for(const [w2,h2] of [[w*.19,h*.69],[w*.140,h*.502]]){c.beginPath();c.ellipse(cx,bottom,w2,h2,0,Math.PI,2*Math.PI);c.strokeStyle='#687d68';c.lineWidth=6;c.stroke();c.strokeStyle='#dbbd83';c.lineWidth=2;c.stroke();}
      c.strokeStyle='#c6ac71';c.lineWidth=4;c.strokeRect(6,6,w-12,h-12);
    });
    box(root,0,3.175,-4.352,1.59,.40,.055,green);plaque(root,0,3.175,-4.384,1.51,.333,transomMap);
    const plaster= new T.MeshStandardMaterial({map:textured(640,224,(c,w,h)=>{
      const wall=c.createLinearGradient(0,0,0,h);wall.addColorStop(0,'#b9a183');wall.addColorStop(.075,'#dcc7a7');wall.addColorStop(.65,'#dac4a0');wall.addColorStop(1,'#bfa886');
      c.fillStyle=wall;c.fillRect(0,0,w,h);
      for(let j=0;j<3000;j++){c.fillStyle=j%3?'#90795b17':'#f6e8c928';c.fillRect((j*107)%w,(j*79+Math.floor(j/13))%h,1+j%3,1);}
    }),roughness:.93});
    // Long stucco-and-brick side elevations with a stone plinth, stepped pier caps and inset glazed masonry bays.
    for(const side of [-1,1]){
      const g=new T.Group();g.position.set(side*6.12,0,.13);g.rotation.y=side*Math.PI/2;root.add(g);
      // g's +X runs along the street wall; +Z always points outside.
      const pos=z=>-side*(z-.13);
      const sideStrip=(z1,z2,y,h,d,zoff,col)=>box(g,(pos(z1)+pos(z2))/2,y,zoff,Math.abs(z2-z1),h,d,col);
      sideStrip(-4.24,4.52,2.24,4.48,.110,.041,plaster);
      sideStrip(-4.24,4.65,.57,1.135,.14,.078,masonry);
      sideStrip(-4.24,4.69,1.139,.114,.207,.092,limestone);
      for(const z of [-4.15,-1.34,1.55,4.50,10.19]){
        const p=pos(z);box(g,p,2.15,.122,.27,4.28,.13,masonry);
        box(g,p,.225,.16,.40,.45,.21,black);box(g,p,1.167,.155,.36,.13,.19,limestone);
        for(const [y,w,h] of [[4.05,.34,.12],[4.17,.40,.09],[4.27,.46,.10]])box(g,p,y,.144,w,h,.215,limestone);
      }
      for(const z of [-2.76,.09,3.02]){
        const x=pos(z);
        box(g,x,2.49,.101,2.25,2.37,.06,0xc4ac8d);
        box(g,x,2.52,.138,2.065,2.17,.045,0xe1cdab);
        for(const zz of [-.924,.924])box(g,x+zz,2.50,.172,.054,1.88,.035,0xc6ad89);
        for(const y of [1.55,3.46])box(g,x,y,.17,1.89,.046,.036,0xc6ad89);
        // Fluted terracotta insets below a rounded vent rosette.
        box(g,x,1.81,.174,1.67,.30,.040,0xcfb695);
        for(let j=-5;j<=5;j++)box(g,x+j*.138,1.813,.199,.053,.21,.019,limestone);
        const ring=new T.Mesh(new T.TorusGeometry(.267,.026,8,36),mat(bronze));ring.position.set(x,2.81,.209);g.add(ring);
        tube(g,x,2.81,.194,.260,.042,black,Math.PI/2);
        for(let j=-3;j<=3;j++){const y=j*.052;box(g,x,2.81+y,.221,2*Math.sqrt(.246**2-y*y),.027,.038,0x9a9a7e,-.17);}
      }
      sideStrip(-4.26,10.40,4.35,.22,.205,.10,cream);
      sideStrip(-4.26,10.40,4.485,.075,.244,.102,deep);
      // Solid wall segments frame two high kitchen windows with deep masonry reveals.
      const za=5.02,zb=7.27,zc=8.36,zd=9.78;
      const doorSide=side===-1;
      if(doorSide){
        sideStrip(4.56,za,2.22,4.44,.22,0,masonry);
        sideStrip(za,6.26,3.35,2.17,.22,0,masonry);
        sideStrip(6.26,7.27,2.22,4.44,.22,0,masonry);
        const doorX=pos((za+6.26)/2);
        box(g,doorX,1.145,.010,1.208,2.27,.10,0x517063);
        box(g,doorX,1.69,.077,.826,.602,.044,deep);box(g,doorX,1.69,.101,.729,.507,.024,0x638b8a);
        for(const dx of [-.353,0,.353])box(g,doorX+dx,1.69,.126,.021,.495,.021,0x889d8f);
        box(g,doorX,.25,.083,1.05,.33,.039,steel);box(g,doorX+.417,1.05,.115,.047,.215,.064,brass);
        for(const x of [doorX-.649,doorX+.649])box(g,x,1.15,.090,.087,2.30,.19,limestone);
        box(g,doorX,2.322,.109,1.426,.115,.22,limestone);
        box(g,doorX,.045,.255,1.39,.085,.47,0x959788);
        box(g,doorX,2.63,.36,1.72,.063,.82,green,.12);
        for(const s of [-1,1])link(g,[doorX+s*.63,2.23,.12],[doorX+s*.63,2.57,.64],.025,deep);
      }else{
        sideStrip(4.53,zb,.82,1.64,.22,0,masonry);sideStrip(4.53,zb,3.72,1.44,.22,0,masonry);
        sideStrip(4.53,5.07,2.32,1.36,.22,0,masonry);sideStrip(6.85,zb,2.32,1.36,.22,0,masonry);
        serviceWindow(5.07,6.85);
      }
      sideStrip(zb,zc,2.22,4.44,.22,0,masonry);
      sideStrip(zc,zd,.82,1.64,.22,0,masonry);sideStrip(zc,zd,3.72,1.44,.22,0,masonry);serviceWindow(zc,zd);
      sideStrip(zd,10.38,2.22,4.44,.22,0,masonry);
      for(const [za,zb] of (doorSide?[[4.53,5.02],[6.27,10.35]]:[[4.53,10.35]]))sideStrip(za,zb,.22,.44,.24,.042,deep);
      function serviceWindow(start,end){
        const wx=pos((start+end)/2),w=end-start;
        for(const y of [1.67,2.97])box(g,wx,y,.047,w,.075,.168,deep);
        for(const x of [-w/2,0,w/2])box(g,wx+x,2.32,.06,.068,1.35,.171,green);
        box(g,wx,2.59,.078,w,.041,.155,green);
        box(g,wx,1.613,.110,w+.18,.12,.30,limestone);box(g,wx,3.044,.085,w+.20,.12,.27,limestone);
        const pane=new T.Mesh(new T.PlaneGeometry(w-.06,1.26),new T.MeshStandardMaterial({color:srgb(0xb7d1c6),transparent:true,opacity:.23,roughness:.20,side:T.DoubleSide,depthWrite:false}));
        pane.position.set(wx,2.31,.010);g.add(pane);
      }
      // A folded rain leader runs from the scupper into the alley drain. Brackets stand off the brick.
      const x=pos(4.24);
      bent(g,[[x,4.52,.21],[x,4.31,.24],[x+.08,4.08,.17],[x+.08,.49,.17],[x+.08,.22,.24],[x+.08,.18,.36]],.054,0x799186,24);
      for(const y of [.71,1.99,3.33]){box(g,x+.08,y,.18,.166,.031,.104,brass);}
    }
    // Shop awnings are tensioned canvas on sloped rails, with scalloped valances and turned brass hinges.
    const canvasTex=textured(1024,160,(c,w,h)=>{
      const stripe=w/16;for(let j=0;j<16;j++){c.fillStyle=j%2?'#ecd7af':'#a9503c';c.fillRect(j*stripe,0,stripe,h);}
      for(let j=0;j<w;j+=3){c.fillStyle='#ffe2b919';c.fillRect(j,0,1,h);}
      for(let j=0;j<h;j+=3){c.fillStyle='#553a2c0f';c.fillRect(0,j,w,1);}
      const wash=c.createLinearGradient(0,0,0,h);wash.addColorStop(0,'#573d313c');wash.addColorStop(.45,'#fff2ca1a');wash.addColorStop(1,'#a66e5123');c.fillStyle=wash;c.fillRect(0,0,w,h);
    });
    const canvasMat=new T.MeshStandardMaterial({map:canvasTex,roughness:.94,side:T.DoubleSide});
    for(const side of [-1,1]){
      const center=side*3.49,w=5.01,strip=w/16,positions=[],uv=[],ix=[];
      const ribs=[[-4.32,3.59],[-4.61,3.52],[-4.93,3.36],[-5.22,3.25]];
      for(let i=0;i<=16;i++)for(let j=0;j<ribs.length;j++){const [z,y]=ribs[j];positions.push(center-w/2+i*strip,y,z);uv.push(i/16,1-j/(ribs.length-1));if(i<16&&j<3){const n=i*4+j;ix.push(n,n+4,n+1,n+4,n+5,n+1);}}
      const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(ix);geo.computeVertexNormals();
      const awning=new T.Mesh(geo,canvasMat);awning.castShadow=true;awning.receiveShadow=true;root.add(awning);
      for(let j=0;j<16;j++){
        const x=center-w/2+(j+.5)*strip,shape=new T.Shape();shape.moveTo(-strip/2,0);shape.lineTo(strip/2,0);shape.lineTo(strip/2,-.092);
        shape.quadraticCurveTo(0,-.227,-strip/2,-.092);shape.closePath();
        const flap=new T.Mesh(new T.ShapeGeometry(shape,8),mat(j%2?0xe5cba4:0xae513d));flap.material.side=T.DoubleSide;flap.position.set(x,3.259,-5.225);flap.rotation.x=.025;root.add(flap);
      }
      for(let i=0;i<4;i++){
        const x=center-w*.475+w*.95*i/3;
        link(root,[x,2.68,-4.37],[x,3.23,-5.17],.025,deep);
        link(root,[x,3.54,-4.36],[x,3.23,-5.17],.021,bronze);
        tube(root,x,2.69,-4.41,.059,.064,brass,Math.PI/2);
      }
      link(root,[center-w/2,3.24,-5.18],[center+w/2,3.24,-5.18],.026,green);
    }
    // A deeper entrance, kickplate and shaded overhead light make the central door legible from the street.
    box(doorFaceGroup,0,.161,-.086,1.50,.25,.041,steel);box(root,0,.016,-4.47,1.74,.032,.44,0x878d7e);
    for(const x of [-.88,.88]){box(root,x,1.78,-4.416,.087,3.47,.176,green);box(root,x,.27,-4.46,.129,.53,.17,brass);}
    box(doorFaceGroup,.60,1.22,-.156,.039,.39,.089,brass);
    const doorFace=textured(384,144,(c,w,h)=>{
      c.fillStyle='#f1dfb3';c.fillRect(0,0,w,h);c.strokeStyle='#aa7752';c.lineWidth=4;c.strokeRect(9,9,w-18,h-18);
      letters(c,'OPEN','italic bold 76px Georgia',w*.5,h*.50,'#984b3c');
    });
    plaque(doorFaceGroup,0,2.47,.021,.61,.22,doorFace);
    for(const x of [-1.73,1.73]){
      bent(root,[[x,4.49,-4.53],[x,4.74,-4.61],[x,4.78,-4.89],[x,4.54,-4.99]],.031,deep,14);
      tube(root,x,4.465,-4.99,.131,.092,green);tube(root,x,4.408,-4.99,.144,.020,brass);
      tube(root,x,4.393,-4.99,.108,.010,0xffe2a3);
    }
    // Exterior casement faces carry a faint reflected sky above the etched waistline. The café remains visible behind each pane.
    const glassReflection=textured(512,384,(c,w,h)=>{
      const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'rgba(160,195,200,.40)');g.addColorStop(.43,'rgba(177,207,202,.23)');g.addColorStop(.75,'rgba(160,185,172,.12)');g.addColorStop(1,'rgba(106,144,139,.18)');c.fillStyle=g;c.fillRect(0,0,w,h);
      for(const [x,span,level] of [[83,45,.09],[157,11,.12],[382,25,.06]]){
        const g=c.createLinearGradient(x,0,x+span,0);g.addColorStop(0,'rgba(255,239,206,0)');g.addColorStop(1,'rgba(255,239,206,'+level+')');c.fillStyle=g;
        c.save();c.transform(1,0,-.52,1,0,0);c.fillRect(x,0,span,h);c.restore();
      }
      c.strokeStyle='rgba(253,229,170,.69)';c.lineWidth=1.7;
      for(const y of [h*.80,h*.816]){c.beginPath();c.moveTo(0,y);c.lineTo(w*.465,y);c.moveTo(w*.535,y);c.lineTo(w,y);c.stroke();}
      c.beginPath();c.moveTo(w*.50,h*.777);c.lineTo(w*.527,h*.807);c.lineTo(w*.50,h*.837);c.lineTo(w*.473,h*.807);c.closePath();c.stroke();
    });
    const glassFace=new T.MeshBasicMaterial({map:glassReflection,transparent:true,depthWrite:false});
    for(const s of [-1,1]){
      const w=5.202/3;
      for(let bay=0;bay<3;bay++){
        const x=s*(.87+(.5+bay)*w),pane=new T.Mesh(new T.PlaneGeometry(w-.068,2.23),glassFace);
        pane.position.set(x,2.307,-4.281);pane.rotation.y=Math.PI;pane.renderOrder=1;root.add(pane);
        for(const dx of [-w*.5,w*.5]){box(root,x+dx,2.32,-4.289,.049,2.34,.069,green);box(root,x+dx,2.324,-4.330,.012,2.32,.016,brass);}
        box(root,x,2.947,-4.291,w-.043,.039,.064,green);
        box(root,x,.594,-4.382,w-.15,.758,.047,0x698e79);box(root,x,.61,-4.414,w-.265,.641,.026,0x859f87);
        for(const edge of [-1,1]){box(root,x+edge*(w-.299)*.50,.609,-4.436,.026,.58,.018,0x77927b);}
      }
    }
    const terra=mat(0x9b654e),leaves=[],leafNormals=[],leafColors=[],leafIds=[];
    function planter(x,z){
      const profile=[[.142,.032],[.183,.043],[.204,.136],[.244,.376],[.264,.395],[.263,.433],[.224,.439],[.215,.406]];
      const pot=new T.Mesh(new T.LatheGeometry(profile.map(([r,y])=>new T.Vector2(r,y)),24),terra);pot.position.set(x,0,z);pot.castShadow=true;root.add(pot);
      tube(root,x,.402,z,.215,.021,0x574a37);
      for(const [y,r] of [[.113,.204],[.348,.243],[.422,.262]]){const lip=new T.Mesh(new T.TorusGeometry(r,.009,5,24),mat(0xbf8667));lip.rotation.x=-Math.PI/2;lip.position.set(x,y,z);root.add(lip);}
      for(let i=0;i<34;i++){
        const a=i*2.39996+x*.53,b=(i*37%29)/29,r=.22+b*.23,h=.18+((i*13)%23)*.018,dx=Math.cos(a),dz=Math.sin(a);
        const start=leaves.length/3,col=srgb([0x3e6a50,0x517f58,0x648052,0x57795a,0x8a9a62][i%5]);
        for(let j=0;j<=5;j++){
          const t=j/5,stretch=.035+t*r,rad=.007+Math.sin(Math.PI*t)*(.044+.019*b),height=.414+Math.sin(t*Math.PI*.715)*h-.084*t*t;
          for(let k=-1;k<=1;k++){leaves.push(x+dx*stretch+dz*k*rad,height-(k===0?0:rad*.38),z+dz*stretch-dx*k*rad);leafNormals.push(dx*.50,.77,dz*.50);leafColors.push(col.r*(k<0?.79:1),col.g*(k<0?.84:1),col.b*(k<0?.78:1));}
          if(j>0)for(let k=0;k<2;k++){const n=start+(j-1)*3+k;leafIds.push(n,n+3,n+1,n+1,n+3,n+4);}
        }
      }
    }
    planter(-1.20,-4.82);planter(1.20,-4.82);
    const foliage=new T.BufferGeometry();
    foliage.setAttribute('position',new T.Float32BufferAttribute(leaves,3));foliage.setAttribute('normal',new T.Float32BufferAttribute(leafNormals,3));foliage.setAttribute('color',new T.Float32BufferAttribute(leafColors,3));foliage.setIndex(leafIds);
    const plants=new T.Mesh(foliage,new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.81}));plants.castShadow=true;root.add(plants);
    // Seam roof with a separate front parapet, rear service curb and ductwork.
    box(roof,0,4.56,2.96,12.52,.21,14.94,0x637e73);box(roof,0,4.71,2.96,12.27,.12,14.70,0x859e8e);
    for(let i=-8;i<=8;i++)box(roof,i*.71,4.79,2.96,.035,.049,14.63,0xa1b09d);
    for(const s of [-1,1]){box(roof,s*6.22,4.74,2.96,.13,.44,14.93,cream);box(roof,s*6.224,4.97,2.96,.18,.07,15.0,green);}
    for(const z of [-4.48,10.40]){box(roof,0,4.74,z,12.48,.44,.14,cream);box(roof,0,4.97,z,12.59,.07,.19,green);}
    for(const x of [-2.1,1.3]){box(roof,x,4.92,7.35,1.62,.22,1.12,deep);box(roof,x,5.19,7.35,1.48,.48,1.0,steel);tube(roof,x,5.45,7.35,.41,.045,green);for(let i=-3;i<=3;i++)box(roof,x+i*.095,5.482,7.35,.026,.022,Math.sqrt(.16-(i*.095)**2)*2,steel);for(let i=-4;i<=4;i++)box(roof,x+i*.135,5.19,6.835,.06,.28,.025,0x526b60);}
    box(roof,.04,5.04,7.8,2.3,.36,.38,0x91a394);for(const x of [-.8,-.2,.4,.9])box(roof,x,5.045,7.8,.035,.38,.40,0xa9b4a5);
    const zincMap=textured(768,768,(c,w,h)=>{
      c.fillStyle='#8d9e8e';c.fillRect(0,0,w,h);
      for(let i=0;i<17;i++){
        const x=i*w/17,s=w/17,g=c.createLinearGradient(x,0,x+s,0);
        g.addColorStop(0,'#647c6f');g.addColorStop(.08,'#859788');g.addColorStop(.5,i%3===0?'#92a194':'#9baa99');g.addColorStop(1,'#819487');c.fillStyle=g;c.fillRect(x,0,s,h);
        for(let j=0;j<23;j++){c.fillStyle=j%3?'#e6d8ad14':'#53695516';c.fillRect(x+2+(j*7)%s,(j*199+i*43)%h,1,12+j%11);}
      }
      for(let j=1;j<6;j++){c.fillStyle='#60746769';c.fillRect(0,j*h/6, w,1);c.fillStyle='#cbceb34d';c.fillRect(0,j*h/6+1,w,1);}
    });
    const roofSurface=new T.Mesh(new T.PlaneGeometry(12.15,14.54),new T.MeshStandardMaterial({map:zincMap,roughness:.78}));
    roofSurface.rotation.x=-Math.PI/2;roofSurface.position.set(0,4.777,2.96);roofSurface.receiveShadow=true;roof.add(roofSurface);
    for(const x of [-2.1,1.3]){
      for(const r of [.105,.227,.364]){
        const ring=new T.Mesh(new T.TorusGeometry(r,.009,6,32),mat(steel));ring.rotation.x=-Math.PI/2;ring.position.set(x,5.50,7.35);roof.add(ring);
      }
      tube(roof,x,5.51,7.35,.072,.052,green);
      for(let j=0;j<8;j++){const a=j*Math.PI/4;link(roof,[x+Math.cos(a)*.055,5.51,7.35+Math.sin(a)*.055],[x+Math.cos(a)*.38,5.50,7.35+Math.sin(a)*.38],.012,steel);}
    }
    // A spun weather cap and filter cylinder connect to the hood below the rear roof curb.
    const capX=2.38,capZ=9.46;
    box(roof,capX,4.844,capZ,1.0,.138,.89,deep);box(roof,capX,4.927,capZ,.90,.070,.81,steel);
    tube(roof,capX,5.080,capZ,.32,.27,0x6d7c71);tube(roof,capX,5.248,capZ,.37,.078,steel);
    tube(roof,capX,5.377,capZ,.267,.20,black);
    for(let i=0;i<14;i++){const a=i*Math.PI/7;box(roof,capX+Math.sin(a)*.264,5.374,capZ+Math.cos(a)*.264,.041,.172,.024,steel,0,a);}
    const profile=[[.005,5.438],[.403,5.446],[.408,5.483],[.36,5.53],[.23,5.58],[.10,5.602],[.004,5.606]];
    const cap=new T.Mesh(new T.LatheGeometry(profile.map(([r,y])=>new T.Vector2(r,y)),36),mat(0x879a8a));cap.position.set(capX,0,capZ);cap.castShadow=true;roof.add(cap);
    for(const x of [-.39,.39])for(const z of [-.33,.33])tube(roof,capX+x,4.967,capZ+z,.022,.019,brass);
    // A flashed, gasketed hatch, hinge knuckles and raised grab handle give the repair route a clear destination.
    const hx=-4.24,hz=8.79;box(roof,hx,4.868,hz,1.19,.165,1.06,deep);box(roof,hx,4.97,hz,1.22,.058,1.10,0xa5af9b);
    for(const x of [-.38,.38])tube(roof,hx+x,4.984,hz+.52,.039,.167,steel,0,Math.PI/2);
    bent(roof,[[hx-.14,4.999,hz-.35],[hx-.13,5.095,hz-.35],[hx+.13,5.095,hz-.35],[hx+.14,4.999,hz-.35]],.016,deep,14);
    for(const side of [-1,1]){
      for(const z of [-3.18,-.26,2.66,5.58,8.50])box(roof,side*6.222,5.012,z,.206,.023,.085,brass);
      for(const x of [-4.3,-1.45,1.4,4.25])box(roof,x,5.012,side<0?-4.48:10.40,.085,.023,.211,brass);
    }
    // A flush slab edge, individually jointed pavement and a cast-iron storm grate maintain scale at street level.
    const asphaltMap=textured(512,256,(c,w,h)=>{
      c.fillStyle='#646b64';c.fillRect(0,0,w,h);let seed=732;
      function random(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
      for(let i=0;i<18000;i++){c.fillStyle=i%2?'#928f7e67':'#3a453f57';c.fillRect(random()*w,random()*h,1.0+random()*1.7,1.0+random()*1.3);}
      for(const y of [.26,.80]){const g=c.createLinearGradient(0,h*(y-.1),0,h*(y+.1));g.addColorStop(0,'#505b5300');g.addColorStop(.5,'#46504832');g.addColorStop(1,'#505b5300');c.fillStyle=g;c.fillRect(0,h*(y-.11),w,h*.22);}
    });asphaltMap.wrapS=T.RepeatWrapping;asphaltMap.repeat.x=4;
    const asphalt=new T.MeshStandardMaterial({map:asphaltMap,roughness:.96});
    const concrete=['#c5beaa','#c9c0ad','#d0c6b0'].map((base,j)=>new T.MeshStandardMaterial({roughness:.96,map:textured(192,144,(c,w,h)=>{
      c.fillStyle=base;c.fillRect(0,0,w,h);
      for(let i=0;i<2150;i++){c.fillStyle=i%3?'#806c4c13':'#f6ecca28';c.fillRect((i*83+j*17)%w,(i*59+Math.floor(i/17))%h,1.2+i%2,1.0);}
      c.strokeStyle='#988d743b';c.lineWidth=1;c.strokeRect(2,2,w-4,h-4);
    })}));
    box(root,0,-.245,2.4,17.25,.32,20.15,0xa4a599);box(root,0,-.32,-9.12,19.4,.22,3.12,asphalt);
    for(let j=0;j<3;j++)for(let k=-5;k<=5;k++)box(root,k*1.56,.009,-4.83-j*1.13,1.55,.035,1.115,concrete[Math.abs(k+j)%3]);
    for(const x of [-7.1,-4.72,-2.35,.02,2.39,4.76,7.13])box(root,x,-.018,-7.64,2.30,.12,.23,cream);
    for(const x of [-5.2,5.35]){box(root,x,-.195,-7.98,.92,.03,.45,deep);for(let k=-3;k<=3;k++)box(root,x+k*.12,-.17,-7.98,.032,.018,.41,steel);}
    for(const x of [-7,-3.5,0,3.5,7])box(root,x,-.198,-10.10,1.65,.013,.085,0xd8c798);
    for(const s of [-1,1]){tube(root,s*6.25,2.02,9.97,.064,4.04,green);for(const y of [.45,1.55,2.65,3.75]){tube(root,s*6.25,y,9.97,.089,.055,brass);}box(root,s*6.25,.12,9.97,.24,.19,.34,deep);}
    // The alley has a hardscape and a separate washable bin apron, independent of the kitchen floor.
    for(const side of [-1,1]){
      for(let j=0;j<10;j++)box(root,side*7.32,-.021,-3.75+j*1.45,1.97,.085,1.435,[0xa7a394,0xb1ac9b,0xb6ad99][(j+(side+1))%3]);
      box(root,side*8.37,.003,2.68,.13,.151,14.46,0x999f91);
    }
    for(let j=0;j<8;j++)box(root,-5.43+j*1.56,-.023,11.32,1.55,.085,1.82,0xa7a697);
    // Shaded service entrance, insulated delivery bins and protected utility meters on the rear elevation.
    for(const x of [-4.63,-3.45]){
      for(const z of [10.91,11.47])for(const s of [-1,1]){const roller=new T.Mesh(new T.TorusGeometry(.083,.021,7,18),mat(black));roller.rotation.y=Math.PI/2;roller.position.set(x+s*.38,.11,z);root.add(roller);}
      box(root,x,.57,11.18,.96,.91,.68,green);box(root,x,.19,11.18,.90,.11,.62,deep);
      box(root,x,1.052,11.18,1.03,.073,.756,0x577265);box(root,x,1.091,11.16,.89,.034,.65,0x718775);
      for(let j=-2;j<=2;j++)box(root,x+j*.149,.60,11.529,.035,.62,.027,0x597163);
      link(root,[x-.33,.979,11.574],[x+.33,.979,11.574],.022,black);
    }
    const serviceBox=0x778478;
    box(root,0,.173,10.429,12.19,.346,.072,0x657569);box(root,0,.354,10.459,12.20,.046,.121,limestone);
    for(const x of [-5.99,-3.52,3.86,5.99]){
      box(root,x,2.133,10.447,.235,4.21,.173,masonry);box(root,x,.211,10.506,.29,.42,.186,0x657569);
      box(root,x,4.233,10.506,.327,.139,.195,limestone);
    }
    box(root,0,4.336,10.413,12.27,.11,.227,limestone);
    for(const x of [-.72,.26]){
      box(root,x,1.67,10.49,.76,1.04,.15,serviceBox);box(root,x,1.68,10.582,.665,.87,.059,0x94a295);
      tube(root,x,1.867,10.643,.137,.055,steel,Math.PI/2);
      tube(root,x,1.862,10.677,.106,.018,0xe5dfc8,Math.PI/2);
      box(root,x+.027,1.862,10.691,.060,.012,.009,deep,0,0,.49);
      link(root,[x,.28,10.54],[x,1.12,10.54],.031,bronze);
    }
    for(const y of [1.14,1.29]){link(root,[-.70,y,10.57],[1.39,y,10.57],.022,bronze);}
    for(const x of [1.50,3.18]){box(root,x,2.88,10.486,1.14,.66,.11,deep);for(let j=0;j<7;j++)box(root,x,2.616+j*.085,10.567,1.06,.051,.067,0x8a9585,-.32);}
    // Tree guards, cast-iron grates and anchors seat the existing palms in the sidewalk.
    for(const [x,z] of [[-3.75,-6.30],[4.30,-6.05]]){
      box(root,x,.031,z,.76,.023,.76,0x5e6557);
      for(const s of [-1,1])for(const a of [-1,1])box(root,x+s*.376,.046,z+a*.183,.029,.029,.352,deep);
      for(let j=-4;j<=4;j++)for(const s of [-1,1]){
        const centerGap=Math.abs(j)<2?.119:.014,length=.33-centerGap;
        box(root,x+j*.079,.048,z+s*(centerGap+length*.5),.031,.018,length,0x92927e);
      }
    }
    // Inverted-U stands sit parallel to the curb and clear the parked cycle's pedals and deployed stand.
    for(const x of [3.09,4.65]){
      const z=-5.63;
      bent(root,[[x-.42,.038,z],[x-.42,.51,z],[x-.40,.693,z],[x-.31,.752,z],[x+.30,.752,z],[x+.40,.693,z],[x+.42,.51,z],[x+.42,.038,z]],.029,steel,30);
      for(const dx of [-.42,.42]){
        tube(root,x+dx,.043,z,.087,.026,deep);
        for(const n of [-1,1])tube(root,x+dx+.048*n,.061,z,.009,.015,bronze);
      }
    }
    // A shallow step and an entry mat bridge the street door and the sidewalk.
    box(root,0,.032,-4.86,1.55,.018,.52,0x694e3a);
    for(let i=-9;i<=9;i++)box(root,i*.077,.044,-4.86,.024,.007,.43,0x926d4a);
    const badge=textured(512,512,(c,w,h)=>{c.fillStyle='#284c40';c.fillRect(0,0,w,h);c.strokeStyle='#d7b278';c.lineWidth=8;c.strokeRect(14,14,w-28,h-28);c.fillStyle='#e4ad58';c.beginPath();c.ellipse(256,190,119,81,0,Math.PI,2*Math.PI);c.fill();c.fillRect(137,238,238,21);c.fillStyle='#d17b50';c.fillRect(137,214,238,12);c.fillStyle='#e8d8a4';for(let i=0;i<9;i++){c.beginPath();c.ellipse(176+(i*37)%158,151+(i%3)*9,4,2,-.44,0,Math.PI*2);c.fill();}letters(c,'BURGER CLUB','bold 44px Georgia',256,306,'#f4dfaf');letters(c,'P A L M   S T R E E T','bold 17px sans-serif',256,370,'#e3bc82');});
    for(const x of [-5.70,-5.28]){tube(root,x,1.48,-6.66,.055,2.96,green);tube(root,x,.07,-6.66,.15,.12,brass);}
    box(root,-5.49,2.72,-6.66,1.48,1.52,.18,brass);plaque(root,-5.49,2.72,-6.759,1.40,1.44,badge);plaque(root,-5.49,2.72,-6.562,1.40,1.44,badge,0);
    if(window.DinerBike){const bike=window.DinerBike.create(T);bike.position.set(4.60,.028,-5.24);bike.rotation.y=-.22;root.add(bike);}
    // Soft, stable contact shade under the foundation; the rest of the plinth remains visible from every angle.
    const shade=textured(256,256,(c,w,h)=>{const g=c.createRadialGradient(w*.5,h*.5,w*.20,w*.5,h*.5,w*.5);g.addColorStop(0,'rgba(43,66,57,.26)');g.addColorStop(1,'rgba(43,66,57,0)');c.fillStyle=g;c.fillRect(0,0,w,h);});
    const ground=new T.Mesh(new T.PlaneGeometry(160,160),new T.MeshBasicMaterial({color:srgb(0xc6cabc)}));ground.rotation.x=-Math.PI/2;ground.position.y=-.46;ground.receiveShadow=true;root.add(ground);const shadow=new T.Mesh(new T.PlaneGeometry(34,40),new T.MeshBasicMaterial({map:shade,transparent:true,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.set(0,-.45,2);root.add(shadow);
    // Indexed static batches work in the canvas rasterizer as well as on the GPU.
    for(const {group,geo,m,transforms} of batches.values()){
      const p=geo.attributes.position,n=geo.attributes.normal,uv=geo.attributes.uv,idx=geo.index;
      const pos=new Float32Array(transforms.length*p.count*3),norm=new Float32Array(pos.length),tex=m.map?new Float32Array(transforms.length*p.count*2):null;
      const indices=[],point=new T.Vector3(),normal=new T.Vector3(),matrix=new T.Matrix3();
      transforms.forEach((transform,k)=>{
        const offset=k*p.count;matrix.getNormalMatrix(transform);
        for(let i=0;i<p.count;i++){
          point.fromBufferAttribute(p,i).applyMatrix4(transform).toArray(pos,(offset+i)*3);
          normal.fromBufferAttribute(n,i).applyNormalMatrix(matrix).toArray(norm,(offset+i)*3);
          if(tex){
            const k=(offset+i)*2;
            if(m===masonry){
              tex[k]=((Math.abs(normal.z)>Math.abs(normal.x)?point.x:point.z)+11)/22;
              tex[k+1]=Math.abs(normal.y)>.8?(point.z+11)/22:(point.y+.3)/5.3;
            }else{tex[k]=uv.getX(i);tex[k+1]=uv.getY(i);}
          }
        }
        for(let i=0,count=idx?idx.count:p.count;i<count;i++)indices.push(offset+(idx?idx.getX(i):i));
      });
      const packed=new T.BufferGeometry();packed.setAttribute('position',new T.BufferAttribute(pos,3));packed.setAttribute('normal',new T.BufferAttribute(norm,3));
      if(tex)packed.setAttribute('uv',new T.BufferAttribute(tex,2));packed.setIndex(indices);
      const mesh=new T.Mesh(packed,m);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
    }
    const zone=(group,x0,y0,z0,x1,y1,z1)=>({group,box:new T.Box3(new T.Vector3(x0,y0,z0),new T.Vector3(x1,y1,z1))});
    const rooms={hall:zone(hall,-6.4,-.20,-7.42,6.4,4.52,5.58),kitchen:zone(kitchen,-6.02,-.18,4.59,6.02,4.48,10.23)};
    return {root,roof,rooms,setEntryOpen(amount){entry.rotation.y=-1.62*Math.max(0,Math.min(1,amount));}};
  }
  window.DinerBuilding={create};
})();
