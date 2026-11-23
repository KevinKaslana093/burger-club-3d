/* Retarget the licensed facial topology to each diner's proportions in bind space.
   The eyes, oral cavity and skin retain their matching UVs and expression deltas. */
(function(global){
  'use strict';
  const cast=[
    // Source, complexion, iris, brow, jaw, cheek width, aperture, nose and chin.
    ['b','#D99D78','#8CCBBC','#604238',1.05,1.03,.90,.92,1.02],
    ['a','#F0BE99','#D6A3AE','#453844',.91,1.00,.91,.92,1.00],
    ['b','#B77859','#E5B27B','#583B33',.95,.96,.83,1.05,1.06],
    ['a','#DEAA87','#AAC3B1','#847971',1.27,1.07,.73,1.19,1.14],
    ['a','#BF815E','#E6BC85','#51372F',.89,1.08,.98,.83,.91],
    ['b','#F1BF95','#83CCBF','#965F47',1.04,1.03,.88,.91,1.01],
    ['a','#CE9870','#B1ADDA','#55434D',1.13,.94,.83,1.05,1.08],
    ['a','#D7A079','#8FBFC7','#484952',1.24,1.06,.78,1.14,1.10],
    ['b','#AC765A','#E6B473','#593D35',.98,.96,.86,1.03,1.04],
    ['b','#E7B399','#B8C183','#80584E',.89,1.02,.94,.90,1.05],
    ['a','#CAA384','#D2BC9F','#918479',1.30,1.05,.75,1.17,1.14]
  ];
  const decoded={},textures={},deformation=new WeakMap(),animated=new WeakMap();
  const range=(v,a,b)=>Math.max(0,Math.min(1,(v-a)/(b-a)));
  function ints(str,type){
    const raw=atob(str),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
    return type===Uint8Array?bytes:new type(bytes.buffer);
  }
  function source(key){
    if(!decoded[key]){
      const data=global.DinerPortraitMesh[key].parts,parts={};
      for(const [name,raw] of Object.entries(data)){
        const part={};for(const [attr,s] of Object.entries(raw))part[attr]=ints(s,attr==='i'?Uint16Array:Int16Array);
        parts[name]=part;
      }
      decoded[key]=parts;
    }
    return decoded[key];
  }
  function texture(key,T){
    if(!global.document)return null;
    if(textures[key])return textures[key];
    const data=global.DinerPortraitMesh[key],canvas=document.createElement('canvas');
    const atlasSize=Math.sqrt(atob(data.thumb).length);
    canvas.width=canvas.height=atlasSize;
    const ctx=canvas.getContext('2d'),preview=ctx.createImageData(atlasSize,atlasSize);
    const pal=ints(data.palette,Uint8Array),thumb=ints(data.thumb,Uint8Array);
    for(let i=0;i<thumb.length;i++)for(let j=0;j<4;j++)preview.data[i*4+j]=pal[4*thumb[i]+j];
    ctx.putImageData(preview,0,0);
    const tex=new T.CanvasTexture(canvas);
    tex.encoding=T.sRGBEncoding;tex.anisotropy=4;textures[key]=tex;
    const image=new Image();
    image.onload=()=>{
      canvas.width=image.width;canvas.height=image.height;ctx.drawImage(image,0,0);
      tex.needsUpdate=true;global.dispatchEvent(new Event('diner-model-ready'));
    };
    image.src='data:image/png;base64,'+data.atlas;
    return tex;
  }
  function shape(x,y,z,style,id){
    const [key,,,,jaw,width,open,nose,chin]=style;
    const a=key==='a',eye=a?1.443:1.370;
    let h=2.285+(y-eye)*(y<eye?(a?3.39:3.67):(a?2.54:2.78));
    let xx=x*(a?3.08:3.42);
    const ab=Math.abs(xx),lower=range(2.26-h,0,.23),front=range(z,-.012,.035);
    xx*=1+(jaw-1)*lower*.95+(width-1)*(1-.46*lower);
    // Pull the lower face to a different chin without moving the eyes or cap.
    h-=(chin-1)*.20*lower;
    if([5,8,9,12].includes(id))h+=.026*lower*Math.exp(-((xx/.083)**2));
    const orbital=Math.exp(-((ab-.14)**2/.009)-((h-2.285)**2/.008))*front;
    h+=((h-2.285)*(open-1)+.011*Math.sin(id*1.64)*(ab-.14)/.09)*orbital;
    // A compressed occiput follows the restaurant mesh's nape and avoids hats.
    let zz=z*(z<0?1.80:(a?3.11:2.97))+(a?.023:.007);
    zz+=.059*(nose-1)*Math.exp(-(xx*xx/.003)-((h-2.171)**2/.015));
    if(id===5||id===9||id===12)zz+=.012*lower*Math.exp(-((h-2.04)**2/.005))*front;
    // Match the exposed forehead and upper cranium to the headwear's bind
    // envelope. The face mesh and the scalp closure share this same warp.
    if(h>2.352){
      const blend=range(h,2.352,2.436);
      h-=.053*range(h,2.412,2.66);
      const polar=Math.min(.995,Math.max(0,(h-2.318)/.295));
      const arc=Math.sqrt(1-polar*polar),rx=.285*arc,rz=.219*arc;
      const radius=Math.sqrt((xx/rx)**2+((zz+.013)/rz)**2);
      if(radius>1){const shrink=1-blend+blend/radius;xx*=shrink;zz=(zz+.013)*shrink-.013;}
    }
    return [xx,h,zz];
  }
  function bucket(){return {p:[],n:[],c:[],uv:[],i:[],blink:[],talk:[]};}
  function mesh(part,T,key){
    const g=new T.BufferGeometry();
    for(const [attr,name,n] of [['p','position',3],['n','normal',3],['c','color',3],['uv','uv',2]])
      g.setAttribute(name,new T.Float32BufferAttribute(part[attr],n));
    g.setIndex(part.i);g.computeBoundingSphere();
    g.userData.portraitKey=key;
    const verts=[],blink=[],talk=[];
    for(let i=0;i<part.blink.length;i+=3){
      if(!part.blink.slice(i,i+3).some(Boolean)&&!part.talk.slice(i,i+3).some(Boolean))continue;
      verts.push(i);
      for(let j=i;j<i+3;j++){blink.push(part.blink[j]);talk.push(part.talk[j]);}
    }
    if(verts.length){
      deformation.set(g,{vertices:new Uint32Array(verts),blink:new Float32Array(blink),talk:new Float32Array(talk)});
      g.userData.portraitAnimated=true;
    }
    return g;
  }
  function accessory(old,out,id){
    const p=old.attributes.position,n=old.attributes.normal,c=old.attributes.color,indices=old.index.array;
    const start=old.userData.trimStart;
    if(!Number.isFinite(start))throw Error('Missing portrait accessory boundary');
    const used=new Map();
    for(let i=0;i<indices.length;i+=3){
      const a=indices[i],b=indices[i+1],d=indices[i+2],x=p.getX(a),y=p.getY(a),z=p.getZ(a);
      const drop=a<start&&Math.abs(x)>.282&&y<2.16&&c.getX(a)>.55&&c.getY(a)>.30&&c.getZ(a)<.24;
      if(a<start&&!drop)continue;
      if(a>=start&&id>=9&&Math.abs(x)<.24&&y<2.211&&z>.1)continue;
      for(const j of [a,b,d]){
        if(!used.has(j)){
          const k=out.p.length/3;
          used.set(j,k);out.p.push(p.getX(j),p.getY(j)+(drop?.023:0),p.getZ(j)-(drop?.059:0));
          out.n.push(n.getX(j),n.getY(j),n.getZ(j));out.c.push(c.getX(j),c.getY(j),c.getZ(j));
          out.uv.push(.99,.01);out.blink.push(0,0,0);out.talk.push(0,0,0);
        }
        out.i.push(used.get(j));
      }
    }
  }
  // Fit the record-shop owner's whiskers to his finished upper lip and eyebrows.
  // Barycentric weights also transfer the facial expressions to the hair roots.
  function silverWhiskers(head,T){
    const skin=[],position=head.p;
    for(let i=0;i<head.i.length;i+=3){
      const [a,b,c]=head.i.slice(i,i+3).map(v=>3*v);
      const x=position[a],y=position[a+1],u=position[b]-x,v=position[b+1]-y;
      const w=position[c]-x,q=position[c+1]-y,det=u*q-w*v;
      if(Math.abs(det)<1e-8||Math.max(position[a+2],position[b+2],position[c+2])<.09)continue;
      if(Math.min(y,position[b+1],position[c+1])>2.43||Math.max(y,position[b+1],position[c+1])<2.04)continue;
      skin.push({a,b,c,x,y,u,v,w,q,det});
    }
    function attach(x,y){
      let hit,weights,z=-Infinity;
      for(const f of skin){
        const dx=x-f.x,dy=y-f.y,v=(dx*f.q-dy*f.w)/f.det,w=(f.u*dy-f.v*dx)/f.det,u=1-v-w;
        if(Math.min(u,v,w)<-.00005)continue;
        const depth=position[f.a+2]*u+position[f.b+2]*v+position[f.c+2]*w;
        if(depth>z){hit=f;weights=[u,v,w];z=depth;}
      }
      if(!hit)throw Error('Facial hair anchor missed the skin');
      const {a,b,c}=hit,[u,v,w]=weights;
      const sample=(data,j)=>data[a+j]*u+data[b+j]*v+data[c+j]*w;
      return {z,normal:[0,1,2].map(k=>sample(head.n,k)),
        blink:[0,1,2].map(k=>sample(head.blink,k)),talk:[0,1,2].map(k=>sample(head.talk,k))};
    }
    const pigment=hex=>new T.Color(hex).convertSRGBToLinear();
    const root=pigment('#776F66'),silver=pigment('#C8C0AF'),tip=pigment('#E0D7C6');
    function ribbon(side,brow,strand){
      const base=head.p.length/3,rows=26,cols=strand===0?9:4;
      for(let i=0;i<=rows;i++)for(let j=0;j<=cols;j++){
        const t=i/rows,v=j/cols*2-1,arc=Math.sin(t*Math.PI),seed=(strand*1.83+side*.31);
        let x,y,width,offset;
        if(brow){
          x=side*(.056+.160*t);
          y=2.365+.020*Math.sin(Math.PI*(t+.035))+.007*t+.0045*side*(1-t);
          width=.011*(.39+.68*arc**.66)*(1-.98*t*t);
        }else{
          x=side*(.002+.128*t);
          y=2.101+.017*Math.sin(Math.PI*(t+.14))-.010*t+.019*t**3+side*.002*t;
          width=.020*(.42+.80*arc**.75)*(1-.987*t**3);
        }
        if(strand){
          const layer=(strand-4)*.20;
          y+=width*(layer+.22*Math.sin(t*4+seed));
          x+=side*((brow?.003:.005)*Math.sin(t*Math.PI+seed));
          offset=.003+(brow?.004:.009)*(1-layer*layer);
          width*=brow?.12:.16;
        }else offset=.0015;
        y+=width*v;
        const face=attach(x,y),ridge=arc**.46*(1-v*v);
        const lift=offset+ridge*(strand?.002:brow?.007:.014);
        head.p.push(x,y,face.z+lift);
        const [nx,ny,nz]=face.normal;
        const dy=ny+v*(strand?.13:.31),len=Math.hypot(nx,dy,nz)||1;
        head.n.push(nx/len,dy/len,nz/len);
        const highlight=strand?.52+.37*Math.sin(t*2+seed)**2:.40+.41*ridge;
        const color=root.clone().lerp(silver,highlight).lerp(tip,strand?.19*ridge:0);
        head.c.push(color.r,color.g,color.b);head.uv.push(.99,.01);
        head.blink.push(...face.blink);head.talk.push(...face.talk);
      }
      for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){
        const a=base+i*(cols+1)+j,b=a+cols+1;
        if(side>0)head.i.push(a,b,a+1,b,b+1,a+1);
        else head.i.push(a,a+1,b,b,a+1,b+1);
      }
    }
    for(const side of [-1,1])for(const brow of [false,true])
      for(let strand=0;strand<=7;strand++)ribbon(side,brow,strand);
  }
  function refine(id,parts,T){
    const style=cast[id-2];if(!style)return parts;
    const key=style[0],templates=source(key),vcolor=hex=>new T.Color(hex).convertSRGBToLinear();
    const skin=vcolor(style[1]),iris=vcolor(style[2]),brow=vcolor(style[3]),white=vcolor('#FFFFFF');
    const beard=vcolor(id===12?'#817971':'#725C51'),sclera=vcolor('#E3DFDF');
    const skinUV=global.DinerPortraitMesh[key].skins?.[id]||[0,0];
    const out={head:bucket(),mouth:bucket(),'eyes-1':bucket(),eyes1:bucket(),'iris-1':bucket(),iris1:bucket()};
    for(const [kind,data] of Object.entries(templates)){
      if(id===12&&kind==='brow')continue;
      const main=kind==='skin'||kind==='scalp'||kind==='brow',mouth=kind==='mouth';
      const targets=main||mouth?[0]:[-1,1];
      for(const side of targets){
        const dest=out[main?'head':mouth?'mouth':(kind==='iris'||kind==='light'?'iris':'eyes')+side];
        const index=new Map();
        for(const base of data.i){
          const x=data.p[base*3]/16000;
          if(side&&Math.sign(x)!==side)continue;
          if(!index.has(base)){
            const pos=[x,data.p[base*3+1]/16000,data.p[base*3+2]/16000];
            const pt=shape(...pos,style,id),offset=dest.p.length/3;index.set(base,offset);
            dest.p.push(...pt);
            const [nx,ny,nz]=data.n.subarray(base*3,base*3+3);
            const norm=Math.hypot(nx,ny,nz)||1;dest.n.push(nx/norm,ny/norm,nz/norm);
            let color=kind==='skin'||kind==='scalp'?skin:kind==='brow'?brow:kind==='iris'?iris:kind==='white'?sclera:white;
            if(kind==='skin'&&(id===5||id===9||id===12)&&pt[2]>.076){
              const jowl=range(2.064+.15*range(Math.abs(pt[0]),.08,.26)-pt[1],0,.069);
              color=skin.clone().lerp(beard,jowl*(id===9?.36:.22));
            }
            dest.c.push(color.r,color.g,color.b);
            const naturalLine=kind==='line'&&key==='b'&&(id===2||id===10);
            dest.uv.push(data.uv[base*2]/30000+(kind==='skin'?skinUV[0]:0),data.uv[base*2+1]/30000+(kind==='skin'?skinUV[1]:naturalLine?-.125:0));
            for(const name of ['blink','talk']){
              const delta=data[name];
              if(delta){
                const t=shape(pos[0]+delta[base*3]/32000,pos[1]+delta[base*3+1]/32000,pos[2]+delta[base*3+2]/32000,style,id);
                dest[name].push(t[0]-pt[0],t[1]-pt[1],t[2]-pt[2]);
              }else dest[name].push(0,0,0);
            }
          }
          dest.i.push(index.get(base));
        }
      }
    }
    if(id===12)silverWhiskers(out.head,T);
    accessory(parts.head,out.head,id);
    for(const [name,b] of Object.entries(out)){
      parts[name].dispose();parts[name]=mesh(b,T,key);
    }
    return parts;
  }
  const finishes=new WeakMap();
  function material(geo,base){
    const key=geo.userData.portraitKey;
    if(!key||!global.document)return base;
    if(!finishes.has(base))finishes.set(base,{});
    const options=finishes.get(base);
    if(!options[key]){
      const T=global.THREE,map=texture(key,T);
      const mat=new T.MeshLambertMaterial({vertexColors:true,map,side:T.DoubleSide,alphaTest:.31});
      mat.emissive.setRGB(.020,.013,.012);mat.emissiveMap=map;
      options[key]=mat;
    }
    return options[key];
  }
  function instance(geo){
    const morph=deformation.get(geo);if(!morph)return geo;
    // Only expression vertices need private storage. Topology and paint are shared.
    const g=new global.THREE.BufferGeometry();
    for(const [key,attr] of Object.entries(geo.attributes))g.setAttribute(key,key==='position'?attr.clone():attr);
    g.setIndex(geo.index);g.boundingSphere=geo.boundingSphere;g.userData={...geo.userData};
    animated.set(g,{...morph,rest:geo.attributes.position.array,b:-1,t:-1});
    return g;
  }
  function expression(bones,blink,chew){
    if(!bones.head.children[0].geometry.userData.portraitKey)return;
    for(const k of [-1,1])bones['eyes'+k].scale.y=1;
    bones.mouth.scale.y=1;
    for(const name of ['head','mouth','eyes-1','eyes1','iris-1','iris1']){
      const g=bones[name].children[0].geometry,r=animated.get(g);
      if(!r)continue;
      const t=chew*.15;
      if(r.b===blink&&r.t===t)continue;
      const p=g.attributes.position;
      for(let k=0;k<r.vertices.length;k++){
        const i=r.vertices[k];
        for(let j=0;j<3;j++)p.array[i+j]=r.rest[i+j]+r.blink[3*k+j]*blink+r.talk[3*k+j]*t;
      }
      r.b=blink;r.t=t;p.needsUpdate=true;
    }
  }
  global.DinerGuestFaces={refine,material,instance,expression,source,mesh,texture,bucket};
})(window);
