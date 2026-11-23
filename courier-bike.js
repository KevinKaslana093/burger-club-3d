/* Palm Street's parked delivery cycle. Dimensions are in metres, front wheel towards +X. */
(() => {
  'use strict';
  function create(T) {
    const outer=new T.Group(), frame=new T.Group();outer.name='Palm Street delivery bicycle';outer.add(frame);
    frame.rotation.x=.073;
    const wine=0x994631, lacquer=0x28635d, shadow=0x234b47, mint=0x8eb8a2, brass=0xc99b54,
      steel=0xb8c1b5, bright=0xdce0cd, alloy=0x728681, ink=0x293a37, rubber=0x333631,
      leather=0x80513c, tan=0xae7851, parchment=0xe5d2a8;
    const tubes=new Map(),surfaces=new Map(),privateGeometry=new Set(),privateMaterials=new Set(),maps=[];
    const v=(x,y,z)=>new T.Vector3(x,y,z);
    function finish(col,metal=false){
      const key=col+'/'+metal;
      if(!surfaces.has(key)){
        const mat=new T.MeshStandardMaterial({color:new T.Color(col).convertSRGBToLinear(),roughness:metal?.39:.65,metalness:metal?.27:.015});
        surfaces.set(key,mat);privateMaterials.add(mat);
      }
      return surfaces.get(key);
    }
    function mesh(geo,col,pos=[0,0,0],metal=false,owner=frame){
      const ob=new T.Mesh(geo,typeof col==='number'?finish(col,metal):col);
      privateGeometry.add(geo);ob.position.set(...pos);ob.castShadow=true;ob.receiveShadow=true;owner.add(ob);return ob;
    }
    function rod(a,b,r,col,metal=false,n=9){
      const pa=new T.Vector3(...a),pb=new T.Vector3(...b),axis=pb.clone().sub(pa);
      if(!tubes.has(n))tubes.set(n,new T.CylinderGeometry(1,1,1,n,1));
      const ob=mesh(tubes.get(n),col,pa.add(pb).multiplyScalar(.5).toArray(),metal);
      ob.scale.set(r,axis.length(),r);ob.quaternion.setFromUnitVectors(v(0,1,0),axis.normalize());return ob;
    }
    const orb=new T.SphereGeometry(1,16,10);
    function oval(p,dim,col,metal=false){
      const m=mesh(orb,col,p,metal);m.scale.set(...dim);return m;
    }
    function wire(points,r,col,metal=false,steps=16,sides=7){
      const path=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));
      return mesh(new T.TubeGeometry(path,steps,r,sides,false),col,[0,0,0],metal);
    }
    function circles(x,y,z,r,thickness,col,metal=false,segments=72){
      return mesh(new T.TorusGeometry(r,thickness,6,segments),col,[x,y,z],metal);
    }
    function roundPlate(x,y,z,w,h,d,r,col,metal=false){
      const a=-w/2,b=-h/2,s=new T.Shape();s.moveTo(a+r,b);s.lineTo(-a-r,b);s.quadraticCurveTo(-a,b,-a,b+r);
      s.lineTo(-a,-b-r);s.quadraticCurveTo(-a,-b,-a-r,-b);s.lineTo(a+r,-b);s.quadraticCurveTo(a,-b,a,-b-r);
      s.lineTo(a,b+r);s.quadraticCurveTo(a,b,a+r,b);s.closePath();
      const bevel=Math.min(.005,d*.12);
      return mesh(new T.ExtrudeGeometry(s,{depth:d,bevelEnabled:true,bevelSegments:2,bevelSize:bevel,bevelThickness:bevel,curveSegments:5}),col,[x,y,z-d/2],metal);
    }
    function band(a,b,t,len,r,col,metal=false){
      const pa=new T.Vector3(...a),axis=new T.Vector3(...b).sub(pa),c=pa.clone().addScaledVector(axis,t),d=axis.normalize().multiplyScalar(len/2);
      return rod(c.clone().sub(d).toArray(),c.add(d).toArray(),r,col,metal,14);
    }
    function texture(w,h,draw){
      const cv=document.createElement('canvas');cv.width=w;cv.height=h;draw(cv.getContext('2d'),w,h);
      const tex=new T.CanvasTexture(cv);tex.encoding=T.sRGBEncoding;tex.anisotropy=4;maps.push(tex);return tex;
    }
    function inkPanel(x,y,z,w,h,tex,reverse=false){
      const mat=new T.MeshLambertMaterial({map:tex,transparent:true,alphaTest:.15,depthWrite:false});
      privateMaterials.add(mat);
      const m=mesh(new T.PlaneGeometry(w,h),mat,[x,y,z]);if(reverse)m.rotation.y=Math.PI;m.castShadow=false;
      return m;
    }
    // Rims have a brake track, a cream-coloured sidewall and a separate black tread crown.
    const cx=.556,cy=.353,tire=.353;
    function rimShell(x,sections,seg=80){
      const xyz=[],colors=[],faces=[];
      for(let i=0;i<=seg;i++){
        const a=i/seg*2*Math.PI,cs=Math.cos(a),sn=Math.sin(a);
        for(const [r,z,col] of sections){
          xyz.push(x+r*cs,cy+r*sn,z);const c=new T.Color(col).convertSRGBToLinear();colors.push(c.r,c.g,c.b);
        }
      }
      const stride=sections.length;
      for(let i=0;i<seg;i++)for(let j=0;j<stride-1;j++){const k=i*stride+j;faces.push(k,k+stride,k+1,k+1,k+stride,k+stride+1);}
      const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(xyz,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(faces);g.computeVertexNormals();
      const mat=new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.78});privateMaterials.add(mat);return mesh(g,mat);
    }
    function wheel(x,rear){
      rimShell(x,[[.287,-.008,alloy],[.296,-.019,steel],[.304,-.020,bright],[.310,-.018,alloy],[.316,-.021,rubber],
        [.320,-.024,parchment],[.329,-.027,0xd5bb8f],[.339,-.025,rubber],[.348,-.017,0x3b3b34],[tire,0,rubber],
        [.348,.017,0x41413a],[.339,.025,rubber],[.332,.027,0xd8bf95],[.319,.024,parchment],[.316,.021,rubber],
        [.311,.018,alloy],[.304,.020,bright],[.296,.019,steel],[.287,.008,alloy],[.287,-.008,alloy]]);
      for(const side of [-1,1]){
        circles(x,cy,.026*side,.325,.0013,0xbf9e70);
        const hub=rear?.040:.029;
        rod([x,cy,.032*side],[x,cy,.040*side],hub,steel,true,24);
        rod([x,cy,.041*side],[x,cy,.060*side],.013,alloy,true,12);
        rod([x,cy,.057*side],[x,cy,.073*side],.011,bright,true,6);
        for(let i=0;i<16;i++){
          const a=(i*2+(side===1?1:0))*Math.PI/16, b=a+(i%2?1:-1)*.87;
          const at=(r,t,z)=>[x+r*Math.cos(t),cy+r*Math.sin(t),z];
          const p=at(hub*.82,b,.037*side),q=at(.290,a,.007*side);
          rod(p,q,.00134,steel,true,5);
          rod(at(.279,a,.007*side),at(.290,a,.007*side),.00235,brass,true,6);
        }
      }
      rod([x,cy,-.038],[x,cy,.038],rear?.023:.017,steel,true,20);
      rod([x-.098,cy-.262,.003],[x-.103,cy-.278,.003],.0036,alloy,true);
    }
    wheel(-cx,true);wheel(cx,false);
    function fender(x,start,end){
      const positions=[],colors=[],ix=[],segments=62,profile=[[-.036,.370,shadow],[-.037,.374,brass],[-.031,.378,lacquer],
        [-.011,.385,0x4a8072],[-.004,.386,parchment],[.004,.386,parchment],[.011,.385,0x4a8072],[.031,.378,lacquer],[.037,.374,brass],[.036,.370,shadow]];
      for(let i=0;i<=segments;i++){
        const a=(start+(end-start)*i/segments)*Math.PI/180;
        for(const [z,r,col] of profile){positions.push(x+r*Math.cos(a),cy+r*Math.sin(a),z);const c=new T.Color(col).convertSRGBToLinear();colors.push(c.r,c.g,c.b);}
      }
      const n=profile.length;
      for(let i=0;i<segments;i++)for(let j=0;j<n-1;j++){const k=i*n+j;ix.push(k,k+n,k+1,k+1,k+n,k+n+1);}
      const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(ix);g.computeVertexNormals();
      const mat=new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.40,metalness:.14});privateMaterials.add(mat);mesh(g,mat);
    }
    fender(cx,21,211);fender(-cx,-7,213);
    for(const side of [-1,1]){
      for(const [wx,a] of [[cx,30],[cx,187],[-cx,30],[-cx,172]]){
        const t=a*Math.PI/180;
        rod([wx,cy,.05*side],[wx+.374*Math.cos(t),cy+.374*Math.sin(t),.034*side],.0031,steel,true,6);
      }
    }
    const bb=[-.032,.306,0],seat=[-.190,.773,0],headLo=[.379,.683,0],headHi=[.340,.823,0];
    rod(bb,seat,.020,lacquer);rod(bb,headLo,.024,lacquer);rod(headLo,headHi,.027,lacquer);
    for(const side of [-1,1]){
      const rear=[-cx,cy,.050*side],forkEnd=[cx,cy,.049*side];
      wire([rear,[-.41,.344,.055*side],[-.215,.318,.048*side],[bb[0],bb[1],.033*side]],.0118,lacquer);
      rod(rear,[seat[0],seat[1]-.032,.019*side],.010,lacquer);
      // The two slender mixte rails pass either side of the seat tube and converge at the head lug.
      wire([rear,[-.34,.443,.039*side],[-.155,.536,.025*side],[.10,.650,.021*side],[.348,.765,.015*side]],.0104,lacquer, false,20,9);
      wire([[.390,.681,.025*side],[.421,.595,.034*side],[.471,.439,.042*side],[.510,.375,.047*side],forkEnd],.0147,lacquer,false,18,10);
      rod([cx-.022,cy+.010,.049*side],[cx+.014,cy-.004,.049*side],.013,alloy,true);
      oval([-.548,cy+.010,.047*side],[.027,.017,.006],steel,true);
    }
    for(const [a,b,r] of [[bb,seat,.0206],[bb,headLo,.0248],[headLo,headHi,.0278]]){
      for(const end of [.10,.89]){band(a,b,end,.008,r,brass,true);band(a,b,end+.024,.003,r+.0004,parchment);}
    }
    oval([.385,.680,0],[.032,.028,.059],lacquer);rod([bb[0],bb[1],-.045],[bb[0],bb[1],.046],.033,alloy,true,22);
    // Seat springs and stitched leather saddle cantilevered over the seat post.
    rod([-.184,.752,0],[-.214,.864,0],.014,steel,true,14);band(bb,seat,.986,.020,.025,alloy,true);
    for(const s of [-1,1]){
      rod([-.212,.851,.015*s],[-.302,.866,.063*s],.0057,steel,true);
      rod([-.302,.866,.063*s],[-.128,.905,.031*s],.0047,steel,true);
      const turns=[];for(let i=0;i<=28;i++){const a=i/28*Math.PI*6;turns.push([-.292+.014*Math.cos(a),.861+.036*i/28,.055*s+.014*Math.sin(a)]);}
      wire(turns,.0024,steel,true,31,5);
    }
    const saddle=oval([-.220,.909,0],[.145,.039,.085],leather);saddle.rotation.z=-.09;
    oval([-.118,.911,0],[.079,.025,.040],leather);
    for(const s of [-1,1]){
      wire([[-.337,.912,.039*s],[-.277,.932,.072*s],[-.207,.932,.074*s],[-.135,.925,.040*s],[-.074,.920,.024*s]],.0018,tan,false,17,5);
      for(const x of [-.312,-.265])oval([x,.931,.051*s],[.004,.003,.004],brass,true);
    }
    // Swept-back bars, cable housings, bell, two independent levers and leather grips.
    rod([.343,.808,0],[.315,.919,0],.016,steel,true,14);rod([.315,.919,0],[.397,.954,0],.0145,steel,true,14);
    for(const s of [-1,1]){
      const gripA=[.321,.977,.129*s],gripB=[.235,.980,.223*s];
      wire([[.397,.954,0],[.403,.956,.088*s],[.384,.969,.122*s],gripA,gripB],.0107,steel,true,20,10);
      rod(gripA,gripB,.016,leather,false,16);
      for(let j=1;j<=7;j++)band(gripA,gripB,j/8,.0021,.0162,tan);
      band(gripA,gripB,.025,.007,.017,brass,true);band(gripA,gripB,.968,.006,.0164,steel,true);
      oval([.348,.962,.130*s],[.018,.013,.018],alloy,true);
      wire([[.345,.957,.131*s],[.323,.929,.151*s],[.289,.918,.177*s],[.261,.918,.199*s]],.0058,steel,true,12,6);
    }
    oval([.376,.989,.105],[.024,.015,.024],brass,true);rod([.373,.976,.103],[.370,.964,.112],.008,alloy,true);
    wire([[.340,.949,.128],[.405,.888,.17],[.481,.737,.117],[.465,.688,.028],[.435,.688,.032]],.0031,ink,false,25,6);
    wire([[.340,.949,-.127],[.275,.879,-.156],[.326,.788,-.071],[.233,.709,-.038],[-.097,.558,-.041],[-.347,.452,-.052],[-.450,.491,-.043]],.0031,ink,false,33,6);
    for(const side of [-1,1]){
      wire([[.396,.682,0],[.431,.680,.035*side],[.477,.629,.046*side]],.0067,alloy,true,8,7);
      rod([.474,.625,.038*side],[.492,.616,.038*side],.0064,rubber);
    }
    // Real lower and upper chain runs, with alternate side plates, rollers and slotted chainring.
    const rearX=-cx,frontX=bb[0],rearY=cy,frontY=bb[1],zChain=.064,ra=.043,rb=.094;
    function sprocket(x,y,r,teeth){
      const gear=new T.Shape();
      for(let i=0;i<=teeth*4;i++){const a=i/(teeth*4)*Math.PI*2,rad=(i%4===1||i%4===2)?r:r-.004;const X=rad*Math.cos(a),Y=rad*Math.sin(a);i?gear.lineTo(X,Y):gear.moveTo(X,Y);}
      if(teeth>20)for(let j=0;j<5;j++){
        const a=j*Math.PI*.4,h=new T.Path();h.absellipse(.054*Math.cos(a),.054*Math.sin(a),.019,.014,a,a+2*Math.PI,false,a);gear.holes.push(h);
      }
      mesh(new T.ExtrudeGeometry(gear,{depth:.004,bevelEnabled:false,curveSegments:5}),steel,[x,y,zChain-.002],true);
    }
    sprocket(rearX,rearY,ra,18);sprocket(frontX,frontY,rb,42);
    const dx=frontX-rearX,dy=frontY-rearY,len=Math.hypot(dx,dy),ux=dx/len,uy=dy/len,ct=(ra-rb)/len,st=Math.sqrt(1-ct*ct);
    const top=Math.atan2(uy*ct+ux*st,ux*ct-uy*st),low=Math.atan2(uy*ct-ux*st,ux*ct+uy*st);
    const chainAt=(x,y,r,a)=>[x+r*Math.cos(a),y+r*Math.sin(a),zChain];
    const chain=[];
    function chainLine(a,b,n){for(let j=0;j<n;j++)chain.push(a.map((k,i)=>k+(b[i]-k)*j/n));}
    function chainArc(x,y,r,start,end,n){for(let j=0;j<n;j++)chain.push(chainAt(x,y,r,start+(end-start)*j/n));}
    const rr=ra+.003,rf=rb+.003;
    chainLine(chainAt(rearX,rearY,rr,top),chainAt(frontX,frontY,rf,top),36);
    chainArc(frontX,frontY,rf,top,low,22);chainLine(chainAt(frontX,frontY,rf,low),chainAt(rearX,rearY,rr,low),36);
    chainArc(rearX,rearY,rr,low,top-2*Math.PI,10);
    for(let j=0;j<chain.length;j++){
      const p=chain[j],q=chain[(j+1)%chain.length],color=j%2?alloy:ink;
      rod([p[0],p[1],zChain-.0036],[q[0],q[1],zChain-.0036],.0026,color,true,5);
      rod([p[0],p[1],zChain+.0036],[q[0],q[1],zChain+.0036],.0026,color,true,5);
      if(!(j%2))rod([p[0],p[1],zChain-.004],[p[0],p[1],zChain+.004],.0032,steel,true,5);
    }
    const crankAngle=-.65;
    for(const s of [-1,1]){
      const x=frontX+s*.15*Math.cos(crankAngle),y=frontY+s*.15*Math.sin(crankAngle),z=(s>0?.074:.052)*s;
      rod([frontX,frontY,z],[x,y,z+.014*s],.009,steel,true);
      rod([x,y,z+.009*s],[x,y,z+.099*s],.006,alloy,true);
      for(const o of [-.029,.029]){
        rod([x+o,y,z+.026*s],[x+o,y,z+.106*s],.011,rubber,false,8);
        for(let j=0;j<3;j++)rod([x+o,y+.008,z+(.032+j*.030)*s],[x+o,y+.008,z+(.037+j*.030)*s],.0077,0x4b4d40);
      }
      rod([x-.030,y,z+.104*s],[x+.030,y,z+.104*s],.0057,steel,true);
    }
    // The kickstand carries the lean of the bicycle onto a third contact point.
    rod([-.115,.333,.049],[-.139,.283,.071],.012,alloy,true);
    rod([-.139,.283,.071],[-.286,.025,.252],.0079,steel,true,10);
    oval([-.286,.024,.252],[.025,.007,.012],rubber);
    // Front carrier and lightly flared wire basket, with its weight carried by axle struts.
    for(const s of [-1,1]){
      rod([cx,.36,.060*s],[.716,.736,.126*s],.0074,lacquer);
      rod([.420,.672,.031*s],[.483,.738,.145*s],.0071,alloy,true);
      rod([.446,.740,.141*s],[.751,.740,.141*s],.0075,steel,true);
    }
    const basketX=.600;
    function hoop(y,hx,hz,r,col){
      const corners=[];for(let i=0;i<4;i++){
        const x=(i===0||i===3)?hx:-hx,z=i<2?hz:-hz,b=.035;
        const start=[0,Math.PI/2,Math.PI,Math.PI*1.5][i];
        for(let j=0;j<=5;j++){const a=start+j*Math.PI/10;corners.push([basketX+x-Math.sign(x)*b+b*Math.cos(a),y,z-Math.sign(z)*b+b*Math.sin(a)]);}
      }
      for(let i=0;i<corners.length;i++)rod(corners[i],corners[(i+1)%corners.length],r,col,true,6);
    }
    for(const [t,rad] of [[0,.0048],[.34,.0028],[.68,.0028],[1,.0056]])hoop(.747+.236*t,.160+.052*t,.138+.046*t,rad,t===1?brass:steel);
    for(const s of [-1,1]){
      for(let j=-3;j<=3;j++){
        const k=j/3;rod([basketX+k*.141,.749,s*.138],[basketX+k*.182,.982,s*.184],.0027,steel,true,6);
      }
      for(let j=-2;j<=2;j++){
        const k=j/2;rod([basketX+s*.161,.749,k*.115],[basketX+s*.211,.982,k*.155],.0027,steel,true,6);
      }
    }
    for(let j=-2;j<=2;j++)rod([basketX-.158,.749,j*.05],[basketX+.158,.749,j*.05],.0028,steel,true,6);
    // A quilted insulated pannier physically fits the basket and has two loop handles, a zipper and a washable name patch.
    roundPlate(basketX,.870,0,.310,.224,.245,.025,0x316b5c);
    roundPlate(basketX,.974,0,.313,.044,.25,.017,0xcd9456);
    const panel=texture(448,296,(c,w,h)=>{
      const g=c.createLinearGradient(0,0,w,h);g.addColorStop(0,'#508673');g.addColorStop(.5,'#386f60');g.addColorStop(1,'#275547');c.fillStyle=g;c.fillRect(0,0,w,h);
      for(let j=0;j<w;j+=3){c.fillStyle='rgba(245,234,202,.06)';c.fillRect(j,0,1,h);}
      for(let j=0;j<h;j+=3){c.fillStyle='rgba(25,49,39,.07)';c.fillRect(0,j,w,1);}
      c.strokeStyle='#b9ae78';c.lineWidth=2;c.setLineDash([4,4]);c.strokeRect(8,8,w-16,h-16);
      c.fillStyle='#ba8754';for(const x of [25,w-56])c.fillRect(x,0,30,h);
      c.fillStyle='#eee3bd';c.fillRect(w*.26,h*.32,w*.48,h*.36);c.strokeStyle='#9a774c';c.strokeRect(w*.27,h*.34,w*.46,h*.32);
      c.setLineDash([]);c.textAlign='center';c.fillStyle='#874430';c.font='italic bold 35px Georgia';c.fillText('Palm Street',w/2,h*.50);
      c.fillStyle='#3e6455';c.font='bold 15px Arial';c.fillText('B U R G E R   C L U B',w/2,h*.60);
    });
    for(const s of [-1,1]){
      inkPanel(basketX,.865,.1286*s,.284,.187,panel,s<0);
      rod([basketX-.128,.956,.131*s],[basketX+.128,.956,.131*s],.0038,ink);
      for(let j=0;j<22;j++)rod([basketX-.123+j*.0115,.956,.1345*s],[basketX-.120+j*.0115,.956,.1345*s],.0017,steel,true,5);
      wire([[basketX-.089,.992,.082*s],[basketX-.064,1.041,.081*s],[basketX,1.055,.076*s],[basketX+.069,1.036,.081*s],[basketX+.091,.991,.082*s]],.0064,leather,false,18,8);
      for(const x of [basketX-.116,basketX+.116]){roundPlate(x,.930,.132*s,.025,.020,.006,.003,brass,true);}
    }
    // The headlamp and red rear lens face along the bicycle, clear of the basket and mudguards.
    rod([.701,.738,0],[.796,.798,0],.0066,steel,true);
    oval([.808,.805,0],[.049,.029,.032],alloy,true);
    rod([.840,.805,0],[.846,.805,0],.028,brass,true,24);
    oval([.847,.805,0],[.007,.024,.024],0xf2daa1);
    oval([-.885,.544,0],[.026,.026,.026],alloy,true);oval([-.906,.545,0],[.008,.019,.021],0xb94832);
    // Batch static surfaces by finish. Hardware remains real geometry at small scene draw-call cost.
    frame.updateMatrixWorld(true);
    const buckets=new Map();
    for(const item of frame.children){
      const painted=item.geometry.attributes.color;
      const key=item.material.map?item.material.uuid:painted?'painted':item.material.metalness>.1?'metal':'matte';
      if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(item);
    }
    const keep=new Set(),textures=new Set(maps);
    for(const [key,items] of buckets){
      const textured=Boolean(items[0].material.map),pos=[],normal=[],rgb=[],uv=[],indices=[];
      for(const item of items){
        const g=item.geometry,p=g.attributes.position,n=g.attributes.normal,c=g.attributes.color,u=g.attributes.uv,base=pos.length/3;
        item.updateMatrixWorld(true);const nm=new T.Matrix3().getNormalMatrix(item.matrixWorld),pnt=new T.Vector3(),norm=new T.Vector3();
        const tint=item.material.color||new T.Color(1,1,1);
        for(let i=0;i<p.count;i++){
          pnt.fromBufferAttribute(p,i).applyMatrix4(item.matrixWorld);pos.push(pnt.x,pnt.y,pnt.z);
          norm.fromBufferAttribute(n,i).applyNormalMatrix(nm);normal.push(norm.x,norm.y,norm.z);
          if(textured)uv.push(u.getX(i),u.getY(i));else rgb.push(c?c.getX(i):tint.r,c?c.getY(i):tint.g,c?c.getZ(i):tint.b);
        }
        if(g.index)for(let i=0;i<g.index.count;i++)indices.push(base+g.index.getX(i));
        else for(let i=0;i<p.count;i++)indices.push(base+i);
      }
      const g=new T.BufferGeometry();g.setIndex(indices);g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(normal,3));
      if(textured)g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));else g.setAttribute('color',new T.Float32BufferAttribute(rgb,3));
      const mat=textured?items[0].material:new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:key==='metal'?.39:.64,metalness:key==='metal'?.26:.02});
      const output=new T.Mesh(g,mat);output.castShadow=!textured;output.receiveShadow=true;outer.add(output);keep.add(mat);
    }
    outer.remove(frame);privateGeometry.forEach(g=>g.dispose());privateMaterials.forEach(m=>{if(!keep.has(m))m.dispose();});
    // Translate only the painted bike; tyres and deployed stand touch the same ground plane.
    const bounds=new T.Box3().setFromObject(outer);for(const part of outer.children)part.position.y-=bounds.min.y;
    const shade=texture(64,64,(c,w,h)=>{const g=c.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);g.addColorStop(0,'rgba(62,45,33,.49)');g.addColorStop(.44,'rgba(70,55,39,.29)');g.addColorStop(1,'rgba(70,55,39,0)');c.fillStyle=g;c.fillRect(0,0,w,h);});
    textures.add(shade);
    const shadeMat=new T.MeshBasicMaterial({map:shade,transparent:true,depthWrite:false});keep.add(shadeMat);
    for(const [x,z,w,d] of [[-cx,0,.22,.105],[cx,0,.22,.105],[-.286,.252,.088,.046]]){
      const m=new T.Mesh(new T.PlaneGeometry(w,d),shadeMat);m.rotation.x=-Math.PI/2;m.position.set(x,.0013,z);m.renderOrder=1;outer.add(m);
    }
    outer.userData.dispose=()=>{for(const child of outer.children)child.geometry.dispose();keep.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());};
    return outer;
  }
  window.DinerBike={create};
})();
