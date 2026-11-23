/* Three-dimensional Palm Street counter, flat-top grill and assembly bench. */
(function () {
  "use strict";
  // A separate tabletop set leaves the whole camera orbit clear of the diner walls.
  function makeShowcase(T, models, shadowMap, gpu) {
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(29, 1, .035, 36);
    const resources = [];
    function owned(resource) { resources.push(resource); return resource; }
    const color = value => new T.Color(value).convertSRGBToLinear();
    scene.background = color(0xe7cfae);
    scene.add(new T.HemisphereLight(0xfff2df, 0xe4c6b2, .54));
    const key = new T.DirectionalLight(0xffefd5, .86);
    key.position.set(-2.8, 4.6, 3.0);
    key.castShadow = gpu;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, {left:-1.45, right:1.45, top:1.8, bottom:-1.45, near:.25, far:9});
    key.shadow.bias = -.00045;
    key.shadow.normalBias = .002;
    key.shadow.radius = 3;
    scene.add(key);
    const fill = new T.DirectionalLight(0xd6ebe5, .31);
    fill.position.set(3.2, 2.5, -1.8);
    scene.add(fill);
    const rim = new T.DirectionalLight(0xffdbab, .43);
    rim.position.set(-1.7, 3.1, -3);
    scene.add(rim);

    // The floor curves continuously into the backdrop. Its painted tones stay
    // readable in the CPU renderer as well as under WebGL.
    const sweep = [[.001,0],[.8,0],[1.5,0],[2.5,0],[4,0],[6,0],[7,.16],[8,.63],[8.7,1.42],[9,2.5],[9,4],[9,9]];
    const background = owned(new T.LatheGeometry(sweep.map(([r,y])=>new T.Vector2(r,y)), 80));
    const bgRGB = [], bgPoint = new T.Vector3();
    const center = color(0xf2dfbf), far = color(0xcdbda5), warm = color(0xe5ad88);
    const ink = new T.Color();
    for(let i=0;i<background.attributes.position.count;i++){
      bgPoint.fromBufferAttribute(background.attributes.position,i);
      const r=Math.hypot(bgPoint.x,bgPoint.z);
      ink.copy(center).lerp(far, Math.min(1,r*.145))
        .lerp(warm, Math.max(0,(bgPoint.x*.75-bgPoint.z*.5)/9)*.60);
      bgRGB.push(ink.r,ink.g,ink.b);
    }
    background.setAttribute('color',new T.Float32BufferAttribute(bgRGB,3));
    const sweepMesh = new T.Mesh(background,owned(new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide})));
    scene.add(sweepMesh);
    function softContact(y,width,depth,opacity,x=0,z=0) {
      const mat = owned(new T.MeshBasicMaterial({map:shadowMap,transparent:true,opacity,depthWrite:false}));
      const m = new T.Mesh(owned(new T.PlaneGeometry(width,depth)),mat);
      m.rotation.x = -Math.PI/2;
      m.position.set(x,y,z);
      m.renderOrder = 1;
      scene.add(m);
    }
    softContact(.002,2.08,1.86,.92,.045,-.025);
    // Glazed ceramic with two fine hand-painted enamel lines around a rolled lip.
    const cream=0xf4ebd5, green=0x38766c, red=0xad5038;
    const profile=[
      [.001,.014,cream],[.38,.014,cream],[.42,.009,green],[.435,.011,green],
      [.444,.031,cream],[.64,.049,cream],[.74,.064,cream],[.78,.082,cream],
      [.783,.095,green],[.779,.103,green],[.770,.109,cream],[.753,.108,cream],
      [.747,.105,red],[.741,.103,red],[.733,.102,cream],[.716,.097,cream],
      [.710,.095,green],[.705,.094,green],[.698,.092,cream],[.58,.075,cream],
      [.54,.072,cream],[.001,.072,cream]];
    const plateGeo=owned(new T.LatheGeometry(profile.map(([r,y])=>new T.Vector2(r,y)),128));
    const plateRGB=[];
    const glazes=profile.map(row=>color(row[2]));
    for(let i=0;i<plateGeo.attributes.position.count;i++){
      const c=glazes[i%profile.length];plateRGB.push(c.r,c.g,c.b);
    }
    plateGeo.setAttribute('color',new T.Float32BufferAttribute(plateRGB,3));
    const plate=new T.Mesh(plateGeo,owned(new T.MeshStandardMaterial({vertexColors:true,roughness:.27,metalness:.02,side:T.DoubleSide})));
    plate.receiveShadow=true;
    scene.add(plate);
    const stripe=owned(new T.MeshStandardMaterial({color:color(green),roughness:.29,side:T.DoubleSide}));
    for(const [start,arc] of [[1.15,.41],[1.60,.045],[1.69,.045]]){
      const band=owned(new T.LatheGeometry([new T.Vector2(.664,.0885),new T.Vector2(.694,.0928)],24,start,arc));
      scene.add(new T.Mesh(band,stripe));
    }
    softContact(.074,1.25,1.22,.82);
    // One tiny painted star sits on the flat of the plate, visible as it turns.
    const star=new T.Shape();
    for(let i=0;i<8;i++){
      const angle=i*Math.PI/4, radius=i%2?.011:.044;
      const x=Math.cos(angle)*radius, y=Math.sin(angle)*radius;
      if(i===0)star.moveTo(x,y);else star.lineTo(x,y);
    }
    star.closePath();
    const mark=new T.Mesh(owned(new T.ShapeGeometry(star)),owned(new T.MeshBasicMaterial({color:color(green),side:T.DoubleSide})));
    mark.rotation.x=-Math.PI/2-.13;mark.position.set(.14,.084,.615);
    scene.add(mark);

    let burger=null,top=.75,foodRadius=.55,progress=0,tilt=0,zoom=1,layerSpread=0,rest=[];
    const look=new T.Vector3();
    function frame(aspect) {
      camera.aspect=aspect;
      const phase=Math.PI*2*progress;
      const yaw=.40 + phase;
      const pitch=(13.5 + tilt + 3*(1-Math.cos(phase))*.5)*Math.PI/180;
      const sin=Math.sin(pitch),cos=Math.cos(pitch),tan=Math.tan(T.MathUtils.degToRad(camera.fov*.5));
      const rings=[[.009,.79],[.109,.79],[.074,foodRadius],[top+layerSpread*Math.max(0,rest.length-1),foodRadius]];
      const yScale=1/(tan*.80),xScale=1/(tan*aspect*.86);
      const upper=sin+cos*yScale,lower=sin-cos*yScale;
      const topEdge=Math.max(...rings.map(([y,r])=>y*upper+r*Math.abs(cos-sin*yScale)));
      const bottomEdge=Math.max(...rings.map(([y,r])=>y*lower+r*(cos+sin*yScale)));
      look.y=(topEdge-bottomEdge)/(upper-lower);
      // Fit rings at the top and bottom of the burger and around the platter.
      // These bounds also hold between sampled angles on tall custom stacks.
      let distance=0;
      for(const [y,r] of rings){
        const dy=y-look.y;
        distance=Math.max(distance,dy*sin+r*Math.hypot(cos,xScale),
          dy*(sin+cos*yScale)+r*Math.abs(cos-sin*yScale),
          dy*(sin-cos*yScale)+r*(cos+sin*yScale));
      }
      distance/=zoom;
      camera.position.set(distance*cos*Math.sin(yaw),look.y+distance*sin,distance*cos*Math.cos(yaw));
      camera.lookAt(look);
      camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
    }
    function clear(){if(burger){scene.remove(burger);burger=null;}rest=[];}
    return {
      scene,camera,clear,frame,
      load(stack,faces,offsets) {
        clear();
        const model=models.burger(stack,faces,offsets);window.DinerSearing.finish(T,model,faces);
        const bounds=new T.Box3().setFromObject(model);
        if(bounds.isEmpty())return false;
        const center=bounds.getCenter(new T.Vector3());
        model.position.set(-center.x,.075-bounds.min.y,-center.z);
        top=bounds.max.y-bounds.min.y+.075;
        foodRadius=Math.max(center.x-bounds.min.x,center.z-bounds.min.z)*1.07;
        scene.add(model);burger=model;progress=0;tilt=0;zoom=1;layerSpread=0;rest=model.children.map(layer=>layer.position.y);
        return true;
      },
      setProgress(value){progress=value;},
      inspect(angle,elevation,magnification,split){
        progress=angle;tilt=elevation;zoom=magnification;layerSpread=split*.18;
        if(burger)burger.children.forEach((layer,i)=>{layer.position.y=rest[i]+i*layerSpread;});
      },
      dispose(){clear();key.shadow.map?.dispose();resources.forEach(r=>r.dispose());}
    };
  }
  function mount(container) {
    const T = window.THREE;
    const models = window.DinerModels;
    if (!T || !models) throw new Error("Missing diner models or Three.js");
    let renderer;
    try {
      renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    } catch (error) {
      if (!window.DinerCanvasRenderer) throw error;
      renderer = new window.DinerCanvasRenderer();
    }
    const gpu = renderer instanceof T.WebGLRenderer;
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.shadowMap.enabled = gpu;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate=false;
    function refreshShadows(){if(gpu)renderer.shadowMap.needsUpdate=true;}
    refreshShadows();
    const nativeRatio=Math.min(gpu?1.85:1.35,window.devicePixelRatio||1);
    renderer.setPixelRatio(nativeRatio);
    const canvas = renderer.domElement;
    canvas.setAttribute("aria-label", "可互动的三维汉堡店工作台");
    canvas.style.cssText = "display:block;width:100%;height:100%;position:absolute;inset:0;pointer-events:none";
    container.appendChild(canvas);
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(31.5, 1, .05, 85);
    const linear = (c) => new T.Color(c).convertSRGBToLinear();
    scene.background = linear(0xa4dcdf);
    const mats = new Map();
    function material(c, basic) {
      const key = c + (basic ? "-flat" : "-lit");
      if (!mats.has(key)) mats.set(key, basic ? new T.MeshBasicMaterial({color:linear(c)}) : new T.MeshLambertMaterial({color:linear(c)}));
      return mats.get(key);
    }
    const geom = new Map();
    function cached(k, create) {
      if (!geom.has(k)) geom.set(k, create());
      return geom.get(k);
    }
    function group(parent, x = 0, y = 0, z = 0) {
      const g = new T.Group();
      parent.add(g);
      g.position.set(x,y,z);
      return g;
    }
    function mesh(parent, geo, mat, x,y,z, sx = 1,sy = 1,sz = 1) {
      const obj = new T.Mesh(geo, typeof mat === "number" ? material(mat) : mat);
      obj.position.set(x,y,z);
      obj.scale.set(sx,sy,sz);
      obj.castShadow = !obj.material.isMeshBasicMaterial;
      obj.receiveShadow = true;
      parent.add(obj);
      return obj;
    }
    const cube = cached("cube", () => new T.BoxGeometry(1,1,1));
    function box(p,x,y,z,w,h,d,m) { return mesh(p,cube,m,x,y,z,w,h,d); }
    function cylinder(p,x,y,z,rb,rt,h,c,seg=28) {
      const k = "c" + [rb,rt,h,seg].join("/");
      return mesh(p,cached(k,()=>new T.CylinderGeometry(rt,rb,h,seg)),c,x,y,z);
    }
    function ball(p,x,y,z,rx,ry,rz,c) {
      return mesh(p,cached("ball",()=>new T.SphereGeometry(1,16,10)),c,x,y,z,rx,ry,rz);
    }
    function rod(p,a,b,r,c,seg=12) {
      const direction = new T.Vector3().subVectors(b,a);
      const mid = new T.Vector3().addVectors(a,b).multiplyScalar(.5);
      const m = cylinder(p,mid.x,mid.y,mid.z,r,r,direction.length(),c,seg);
      m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),direction.normalize());
      return m;
    }
    const vec = (x,y,z) => new T.Vector3(x,y,z);
    function slab(p,x,y,z,w,h,d,r,color) {
      // An extruded rounded rectangle instrument panel in the XY plane.
      const key = "s" + [w,h,d,r].join("/");
      const geo = cached(key, () => {
        const s = new T.Shape(), l=-w/2, b=-h/2, R=w/2, t=h/2;
        r=Math.min(r,w/2,h/2);
        s.moveTo(l+r,b); s.lineTo(R-r,b); s.quadraticCurveTo(R,b,R,b+r);
        s.lineTo(R,t-r); s.quadraticCurveTo(R,t,R-r,t);
        s.lineTo(l+r,t); s.quadraticCurveTo(l,t,l,t-r);
        s.lineTo(l,b+r); s.quadraticCurveTo(l,b,l+r,b);
        const chamfer=Math.min(.013,d*.12,r*.16);
        return new T.ExtrudeGeometry(s,{depth:d,bevelEnabled:chamfer>0,bevelThickness:chamfer,bevelSize:chamfer,bevelSegments:2,curveSegments:7});
      });
      return mesh(p,geo,color,x,y,z);
    }
    const C = {
      ink:0x263b36, evergreen:0x185951, teal:0x23897c, mint:0x7fcab2,
      pale:0xc5d9c5, cream:0xffedc3, white:0xfff4df, grey:0xc3cfc3,
      darkmetal:0x647b74, red:0xc74732, cherry:0x9f382e, orange:0xea873f,
      amber:0xf2b749, brass:0xb9955e, wood:0xbe7850, brown:0x795139, grill:0x323d37
    };
    const world = group(scene), workstations = {};
    const base = {}, itemHolders = {};
    for (const id of ["order","grill","build"]) {
      workstations[id]=group(world);
      base[id]=group(workstations[id]);
      itemHolders[id]=group(workstations[id]);
    }
    const shared=group(world);
    const hemi = new T.HemisphereLight(0xfff1da,0xc2a99a,.64);
    scene.add(hemi);
    const sun = new T.DirectionalLight(0xffefcb,.81);
    sun.position.set(-3.4,7,4); sun.target.position.set(0,.65,0);
    sun.castShadow=true;
    sun.shadow.mapSize.set(1024,1024);
    Object.assign(sun.shadow.camera,{left:-4.4,right:4.4,top:4.5,bottom:-4.5,near:.5,far:17});
    sun.shadow.bias=-.0009;
    sun.shadow.normalBias=.012;
    scene.add(sun,sun.target);
    const soft=new T.DirectionalLight(0xffd2a3,.23);
    soft.position.set(4,5,-1.6); scene.add(soft);
    const bounce=new T.DirectionalLight(0xbdd9dc,.09);
    bounce.position.set(1,1,5);scene.add(bounce);

    function decal(p,x,y,z,w,h,draw) {
      const cv=document.createElement("canvas");
      cv.width=Math.round(432*w);cv.height=Math.round(432*h);
      const ctx=cv.getContext("2d");
      ctx.scale(cv.width/w,cv.height/h);
      draw(ctx,w,h);
      const tex=new T.CanvasTexture(cv);
      tex.encoding=T.sRGBEncoding;
      tex.minFilter=T.LinearFilter; tex.generateMipmaps=false;
      const mat=new T.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,side:T.FrontSide});
      const plane=mesh(p,new T.PlaneGeometry(w,h),mat,x,y,z);
      plane.renderOrder=2;
      return plane;
    }
    function label(ctx,txt,x,y,font,size,color,align="center") {
      ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline="middle";
      ctx.font=font.replace("SIZE",String(size)+"px");
      ctx.fillText(txt,x,y);
    }
    function sparkle(ctx,x,y,r) {
      ctx.beginPath();ctx.moveTo(x,y-r);ctx.quadraticCurveTo(x+.05*r,y-.1*r,x+r*.72,y);
      ctx.quadraticCurveTo(x+.1*r,y+.02*r,x,y+r);
      ctx.quadraticCurveTo(x-.06*r,y+.1*r,x-r*.72,y);ctx.quadraticCurveTo(x-.1*r,y-.1*r,x,y-r);
      ctx.fill();
    }
    // The worktops, enamel and wall panels have local painted surface maps.
    let seed=48117;
    function rnd(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
    function paint(w,h,painter){
      const cv=document.createElement("canvas");cv.width=w;cv.height=h;
      painter(cv.getContext("2d"),w,h);
      const t=new T.CanvasTexture(cv);t.encoding=T.sRGBEncoding;t.minFilter=T.LinearMipmapLinearFilter;
      if(renderer.capabilities&&renderer.capabilities.getMaxAnisotropy)t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
      return t;
    }
    function finish(map,roughness=.72,metalness=.02) {
      return new T.MeshStandardMaterial({color:0xffffff,map,roughness,metalness});
    }
    function surface(p,x,y,z,w,d,mat,angle=0){
      const s=mesh(p,new T.PlaneGeometry(w,d),mat,x,y,z);
      s.rotation.set(-Math.PI/2,0,angle);s.castShadow=false;
      return s;
    }
    const terrazzo=finish(paint(1024,256,(c,w,h)=>{
      const g=c.createLinearGradient(0,0,w,h);
      g.addColorStop(0,"#e8d4b4");g.addColorStop(.42,"#dec6a6");g.addColorStop(.84,"#eedcc0");g.addColorStop(1,"#dbc5a7");
      c.fillStyle=g;c.fillRect(0,0,w,h);
      for(let i=0;i<5600;i++){
        const x=rnd()*w,y=rnd()*h,a=(.4+rnd()*1.38),b=(.35+rnd()*.89);
        c.fillStyle=["#ba927b","#fff1d8","#ad9b81","#d1b09b","#faf0d5","#d9c8af"][i%6];
        c.beginPath();c.moveTo(x,y-b);c.lineTo(x+a,y+b*.36);c.lineTo(x+.16*a,y+b);c.lineTo(x-a*.82,y+b*.4);c.fill();
      }
    }),.45);
    const griddleSurface=finish(paint(512,512,(c,w,h)=>{
      const g=c.createLinearGradient(0,0,w,h);g.addColorStop(0,"#4d5651");g.addColorStop(.42,"#343e3c");g.addColorStop(.64,"#43453a");g.addColorStop(1,"#323635");
      c.fillStyle=g;c.fillRect(0,0,w,h);
      for(let i=0;i<2100;i++){
        c.strokeStyle=i%3?"rgba(207,184,146,.12)":"rgba(10,16,17,.2)";
        const x=rnd()*w,y=rnd()*h;
        c.lineWidth=.3+rnd()*.5;c.beginPath();c.moveTo(x,y);c.lineTo(x+3+rnd()*23,y-1-rnd()*3);c.stroke();
      }
      for(let i=0;i<155;i++){
        const x=rnd()*w,y=rnd()*h,r=1+rnd()*1.6;
        c.fillStyle="rgba(183,146,83,.34)";c.beginPath();c.ellipse(x,y,r,r*.5,.1,0,Math.PI*2);c.fill();
      }
    }),.57,.20);
    const woodSurface=finish(paint(1024,512,(c,w,h)=>{
      const cols=["#c69162","#d7a477","#e0b181","#cd9968","#dfad7b","#cf9d72","#e4b685","#d29d6c"];
      const bw=w/8;
      cols.forEach((col,i)=>{
        const ox=i*bw;
        c.fillStyle=col;c.fillRect(ox,0,bw,h);
        c.save();c.beginPath();c.rect(ox,0,bw,h);c.clip();
        for(let k=0;k<74;k++) {
          const x=ox+rnd()*bw, phase=rnd()*7, drift=2+rnd()*4;
          c.strokeStyle=k%3?"rgba(118,74,51,.17)":"rgba(255,219,163,.43)";
          c.lineWidth=.4+rnd()*1.4;c.beginPath();
          for(let j=0;j<17;j++){const t=j/16;const xx=x+Math.sin(phase+t*9)*drift+Math.sin(phase+t*20)*.8;j?c.lineTo(xx,t*h):c.moveTo(xx,0);}c.stroke();
        }
        c.restore();c.fillStyle="rgba(99,67,45,.4)";c.fillRect(ox,0,1,h);
      });
      for(let i=0;i<125;i++){
        const x=w*(.09+.82*rnd()),y=h*(.1+.80*rnd()),d=4+rnd()*28;
        c.strokeStyle="rgba(117,80,50,.25)";c.lineWidth=.7;c.beginPath();c.moveTo(x,y);c.lineTo(x+d,y-d*.51);c.stroke();
      }
    }),.84);
    const shadowMap=paint(128,128,(c,w,h)=>{
      const s=c.createRadialGradient(w*.5,h*.5,0,w*.5,h*.5,w*.5);
      s.addColorStop(0,"rgba(64,45,34,.69)");s.addColorStop(.40,"rgba(66,52,35,.46)");s.addColorStop(.74,"rgba(80,67,43,.15)");s.addColorStop(1,"rgba(84,64,39,0)");
      c.fillStyle=s;c.fillRect(0,0,w,h);
    });
    const shadowMat=new T.MeshBasicMaterial({map:shadowMap,transparent:true,depthWrite:false});
    function contact(p,x,y,z,w,d){
      const s=surface(p,x,y,z,w,d,shadowMat);s.receiveShadow=false;s.renderOrder=1;
    }
    function screw(p,x,y,z,size=.025) {
      const cap=cylinder(p,x,y,z,size,size,.009,C.darkmetal,12);cap.rotation.x=Math.PI/2;
      const slot=box(p,x,y,z+.007,size*1.4,size*.2,.005,C.ink);slot.rotation.z=.5;
    }
    function exterior(p,wide=false){
      if(window.DinerRoomArt?.addExterior?.(T,p,wide))return;
      const tex=paint(1024,480,(c,w,h)=>{
        const sky=c.createLinearGradient(0,0,0,h);sky.addColorStop(0,"#569bab");sky.addColorStop(.58,"#b1d6c9");sky.addColorStop(1,"#f1ceac");
        c.fillStyle=sky;c.fillRect(0,0,w,h);
        for(let i=0;i<23;i++){
          const x=rnd()*w,y=25+rnd()*155,sz=15+rnd()*35;
          for(let j=0;j<5;j++){
            c.fillStyle=j<2?"rgba(201,220,214,.70)":"rgba(245,233,206,.84)";
            c.beginPath();c.ellipse(x+j*sz*.37,y-3*Math.sin(j*.85),sz*(.63-.045*j),sz*(.145+.03*Math.sin(j)),0,0,Math.PI*2);c.fill();
          }
        }
        function ridge(base,amp,col,offset) {
          c.fillStyle=col;c.beginPath();c.moveTo(0,h);
          for(let i=0;i<=100;i++){const x=w*i/100;const y=base-amp*(.42*Math.sin(x*.012+offset)+.40*Math.sin(x*.021-offset)+.13*Math.sin(x*.064));c.lineTo(x,y);}
          c.lineTo(w,h);c.closePath();c.fill();
        }
        ridge(260,60,"#acbeba",2);ridge(290,50,"#89a9a4",1);ridge(316,43,"#779a91",2.4);
        // Vintage pastel motel frontage, windows and sunlit parapets.
        let x=-4;
        for(let i=0;i<19;i++) {
          const bw=43+rnd()*43,bh=28+rnd()*57,y=364-bh;
          c.fillStyle=["#d5ab89","#c5866e","#d6c5a2","#9dbfb2","#e0af8c"][i%5];c.fillRect(x,y,bw,bh+90);
          c.fillStyle="#a68e78";c.fillRect(x+bw*.84,y+5,bw*.16,bh+80);
          c.fillStyle="#f3dfb5";c.fillRect(x-2,y-3,bw+3,4);c.fillRect(x+3,y+7,bw*.76,2);
          for(let wy=y+15;wy<369;wy+=19)for(let wx=x+6;wx<x+bw*.81-3;wx+=13){c.fillStyle="#59797a";c.fillRect(wx,wy,7,10);c.fillStyle="#b6c8b6";c.fillRect(wx+1,wy+1,5,3);}
          x+=bw+3;
        }
        c.strokeStyle="#4f6862";c.lineWidth=1.2;
        for(let i=0;i<8;i++){
          const bx=200+i*60+(rnd()-.5)*26,by=92+85*rnd();c.beginPath();c.moveTo(bx-5,by-2);c.quadraticCurveTo(bx-2,by-2,bx,by+1);c.quadraticCurveTo(bx+2,by-3,bx+5,by-3);c.stroke();
        }
      });
      const wall=mesh(p,new T.PlaneGeometry(wide?28:17,6.6),new T.MeshBasicMaterial({map:tex}),wide?0:-2,2.75,-7.24);wall.castShadow=false;
    }
    exterior(shared);
    function dinerSign(p,x,y,z,scale) {
      const g=group(p,x,y,z);g.scale.setScalar(scale);
      slab(g,0,-.015,0,2.17,1.06,.07,.16,C.cherry);
      slab(g,0,.016,.078,2.13,1.04,.055,.16,C.amber);
      slab(g,0,.016,.136,2.04,.956,.035,.13,C.evergreen);
      slab(g,0,.016,.174,1.98,.9,.016,.11,C.cream);
      decal(g,0,.016,.196,1.96,.88,(ctx,w,h)=>{
        ctx.save();ctx.translate(w/2,h/2);ctx.rotate(-.043);
        label(ctx,"BURGER",.008,-.126,"italic 900 SIZE Georgia",.29,"#e5a243");
        label(ctx,"BURGER",0,-.147,"italic 900 SIZE Georgia",.29,"#ab392c");
        label(ctx,"CLUB",0,.113,"900 SIZE Georgia",.275,"#245a51");
        label(ctx,"•   P A L M    S T R E E T   •",0,.328,"900 SIZE Arial",.065,"#886742");
        ctx.fillStyle="#d68c32";sparkle(ctx,-.734,-.045,.092);sparkle(ctx,.734,.03,.092);ctx.restore();
      });
    }
    // A real window opening looks onto layered palm trees, low hills and summer clouds.
    function palm(p,x,z,h) {
      const g=group(p,x,0,z), trunk=0xa68b68;
      rod(g,vec(0,.04,0),vec(.2,h*.62,0),.09,trunk);
      rod(g,vec(.2,h*.62,0),vec(.13,h,0),.063,trunk);
      for(let i=1;i<17;i++){
        const t=i/17,x=t<.62?t/.62*.20:.20-(t-.62)/.38*.07;
        const knot=cylinder(g,x,t*h,0,.084-.021*t,.089-.021*t,.026,0x967c5b,10);
        knot.rotation.z=.15*Math.sin(i*1.7);
      }
      for (let i=0;i<11;i++) {
        const a=i*2.40,dx=Math.cos(a),dz=Math.sin(a),len=1.04+.30*rnd(),lift=.25+rnd()*.19;
        const pos=[];
        function point(t){return vec(.13+dx*t*len,h+Math.sin(t*Math.PI)*lift-t*t*.32,dz*t*len);}
        for (let j=1;j<=15;j++){
          const t=(j-.5)/15,d=t<.5?t*1.25+.23:Math.max(.06,(1-t)*1.50);
          for(const side of [-1,1]){
            const start=point(t-.02),e=point(Math.min(1,t+.19));
            e.x+=-dz*d*.54*side;e.z+=dx*d*.54*side;e.y-=.095+d*.16;
            const end=point(t+.073);
            for(const v of [start,e,end])pos.push(v.x,v.y,v.z);
          }
        }
        const leafGeo=new T.BufferGeometry();leafGeo.setAttribute("position",new T.Float32BufferAttribute(pos,3));leafGeo.computeVertexNormals();
        const m=material([0x558d76,0x679a77,0x799c76][i%3]).clone();m.side=T.DoubleSide;
        mesh(g,leafGeo,m,0,0,0);
        rod(g,point(0),point(.39),.015,0x817e56,6);rod(g,point(.39),point(.72),.009,0x719267,6);
      }
    }
    box(shared,0,-.08,-2,21,.13,15,C.cream);
    const floorMat=finish(paint(1280,768,(c,w,h)=>{
      const tile=64;c.fillStyle="#9f9d83";c.fillRect(0,0,w,h);
      for(let j=0;j<h/tile;j++)for(let i=0;i<w/tile;i++){
        const x=i*tile,y=j*tile,mint=(i+j)%2;
        c.fillStyle=mint?["#739e90","#769e90","#7ba397"][(i+j*3)%3]:["#d8d1b6","#ded6bb","#d9ceb2"][(i*2+j)%3];
        c.fillRect(x+.8,y+.8,tile-1.6,tile-1.6);
        c.fillStyle="rgba(255,246,208,.21)";c.fillRect(x+2,y+1.3,tile-4,1);c.fillRect(x+1.4,y+3,1,tile-5);
        for(let k=0;k<36;k++){c.fillStyle=k%4?"rgba(68,86,74,.12)":"rgba(247,232,189,.22)";const px=x+rnd()*tile,py=y+rnd()*tile;c.fillRect(px,py,.4+rnd()*2,rnd()+.3);}
      }
      // Late-afternoon light through the front windows.
      c.fillStyle="rgba(253,229,178,.13)";
      for(let i=0;i<4;i++){
        const x=280+i*133;c.beginPath();c.moveTo(x,0);c.lineTo(x+70,0);c.lineTo(x+359,h);c.lineTo(x+291,h);c.closePath();c.fill();
      }
    }),.56);
    surface(shared,0,-.009,-1.25,14.8,8.88,floorMat);
    box(shared,0,2,-15,42,15,.1,material(0x9fd9df,true));
    palm(shared,-2.7,-5.4,3.08);palm(shared,-5,-6,2.65);
    // Wall sections frame the opening on its four sides.
    box(shared,0,.53,-3.18,20,1.05,.18,C.pale);
    box(shared,0,4.85,-3.18,21,1.75,.2,C.cream);
    box(shared,4.74,2.59,-3.18,8.95,3.25,.2,C.cream);
    box(shared,-6.43,2.59,-3.18,4.65,3.25,.2,C.cream);
    const wallTiles=finish(paint(900,540,(c,w,h)=>{
      c.fillStyle="#a49e87";c.fillRect(0,0,w,h);
      const bw=90,bh=90;
      for(let j=0;j<6;j++)for(let i=0;i<10;i++){
        const x=i*bw+1,y=j*bh+1;
        const grad=c.createLinearGradient(x,y,x+bw*.55,y+bh);
        grad.addColorStop(0,["#e5d5b2","#e2d1ad","#decaa7"][(j*9+i)%3]);grad.addColorStop(.58,"#e7d6b5");grad.addColorStop(1,"#d7c7a5");
        c.fillStyle=grad;c.fillRect(x,y,bw-2,bh-2);
        c.fillStyle="rgba(255,242,212,.7)";c.fillRect(x+1,y+1,bw-4,1.4);
        c.fillStyle="rgba(145,115,84,.28)";c.fillRect(x+bw-4,y+2,1.4,bh-4);
      }
      for(let n=0;n<5500;n++){c.fillStyle=n%3?"rgba(130,106,80,.07)":"rgba(255,249,222,.19)";c.fillRect(rnd()*w,rnd()*h,1.1,.8);}
    }),.55);
    for(const [x,w] of [[2.89,5.16],[-6.5,4.61]]) {
      const panel=mesh(shared,new T.PlaneGeometry(w,3.1),wallTiles,x,2.55,-3.045);panel.castShadow=false;
    }
    box(shared,-1.94,1.20,-3.08,4.54,.13,.3,C.wood);
    box(shared,-1.94,1.13,-2.98,4.6,.06,.34,C.evergreen);
    for(const x of [-4.13,-2,.27]) box(shared,x,2.68,-3.05,.088,2.88,.12,C.evergreen);
    box(shared,-1.94,3.21,-3.045,4.5,.06,.1,C.evergreen);
    for(const x of [-4.13,-2,.27]){
      box(shared,x+.032,2.61,-2.974,.014,2.8,.018,C.mint);
      box(shared,x-.04,2.61,-2.974,.014,2.8,.018,C.ink);
    }
    box(shared,-1.94,1.255,-2.91,4.65,.035,.36,0xd19d72);
    box(shared,-1.94,3.24,-2.979,4.5,.012,.015,C.mint);
    for (let i=0;i<13;i++) {
      const x=-4.22+i*.363;
      const awn=box(shared,x,3.85,-3.35,.365,.075,.80,i%2===0?C.red:C.cream);
      awn.rotation.x=-.25;
      const flap=ball(shared,x,3.72,-2.96,.183,.14,.048,i%2===0?C.red:C.cream);flap.castShadow=false;
    }
    for(let i=-11;i<=11;i++) {
      box(shared,i*.43,.92,-3.06,.422,.27,.07,i%2===0?C.teal:C.white);
      box(shared,i*.43,.652,-3.06,.422,.258,.07,i%2===1?C.teal:C.white);
    }
    box(shared,0,1.074,-3.025,18,.057,.13,C.teal);
    for (const x of [.75,1.18,1.61,2.04,2.47,2.9,3.33,3.76,4.19])
      box(shared,x,2.55,-3.068,.012,2.91,.02,0xeddbb8);
    for (const y of [1.53,1.96,2.39,2.82,3.25,3.68])
      box(shared,2.57,y,-3.062,4.56,.014,.02,0xeddbb8);
    dinerSign(shared,1.51,2.89,-2.82,1.12);
    function menuBoard(p,x,y,z) {
      const g=group(p,x,y,z);g.rotation.z=-.026;
      rod(g,vec(-.39,.58,0),vec(0,.88,0),.009,C.brown);
      rod(g,vec(0,.88,0),vec(.39,.58,0),.009,C.brown);
      slab(g,0,0,0,1.06,1.28,.065,.046,C.brown);slab(g,0,0,.068,.974,1.19,.025,.035,C.amber);
      slab(g,0,0,.096,.932,1.15,.013,.022,C.evergreen);
      decal(g,0,0,.114,.90,1.10,(c,w,h)=>{
        label(c,"Kitchen Menu",w*.5,.14,"italic bold SIZE Georgia",.108,"#ffdaa2");
        label(c,"•  H O U S E   S P E C I A L S  •",w*.5,.255,"700 SIZE Arial",.035,"#b6cbb8");
        c.strokeStyle="#ccac72";c.lineWidth=.005;c.beginPath();c.moveTo(.07,.31);c.lineTo(.83,.31);c.stroke();
        [["Cheeseburger","8"],["Garden melt","9"],["Palm special","12"],["Skinny fries","4"]].forEach(([name,price],i)=>{
          const oy=.427+i*.128;label(c,name,.08,oy,"italic SIZE Georgia",.072,"#f7e5c5","left");
          label(c,price,.80,oy,"bold SIZE Georgia",.068,"#f0bd72","right");
        });
        c.strokeStyle="#bd9c69";c.beginPath();c.moveTo(.09,.91);c.lineTo(.81,.91);c.stroke();
        label(c,"M A D E   T O   O R D E R",w*.5,1.02,"600 SIZE Arial",.038,"#f9d295");
      });
    }
    menuBoard(shared,3.66,2.44,-2.93);
    // A wall clock with a brass bezel, painted indices, arbors and hands.
    const clock=group(shared,-4.66,2.64,-2.98);
    for(const [r,z,col] of [[.34,0,C.evergreen],[.31,.05,C.amber],[.285,.09,C.cream]]){
      const ring=cylinder(clock,0,0,z,r,r,.047,col,48);ring.rotation.x=Math.PI/2;
    }
    for(let i=0;i<12;i++){
      const a=i*Math.PI/6;
      const mark=box(clock,.241*Math.sin(a),.241*Math.cos(a),.12,.013,i%3?.030:.048,.008,C.ink);
      mark.rotation.z=-a;
    }
    rod(clock,vec(0,0,.129),vec(-.086,.104,.129),.012,C.ink);
    rod(clock,vec(0,0,.13),vec(.15,.064,.13),.009,C.red);
    function booth(p,x) {
      const g=group(p,x,0,-2.18);
      contact(g,0,-.006,.02,2.24,1.29);contact(g,0,-.005,.82,.75,.62);
      box(g,0,.20,.02,1.78,.36,.63,C.evergreen);
      slab(g,0,.48,-.32,1.78,.34,.62,.13,C.cherry);
      slab(g,0,.83,-.4,1.78,.61,.19,.12,C.red);
      for(const dx of [-.65,-.44,-.22,0,.22,.44,.65]) box(g,dx,.84,-.198,.013,.46,.01,0xda6047);
      box(g,0,.97,-.18,1.67,.024,.02,0xffd9ac);
      for (let i=-3;i<=3;i++){
        const stud=ball(g,i*.20,.815,-.19,.023,.023,.012,C.cherry);stud.castShadow=false;
      }
      cylinder(g,0,.43,.82,.095,.095,.85,C.darkmetal);
      cylinder(g,0,.06,.82,.255,.19,.073,C.darkmetal);
      slab(g,0,.865,.83,1.15,.73,.085,.10,C.wood).rotation.x=-Math.PI/2;
      cylinder(g,-.29,.99,.88,.057,.047,.245,C.red);
      cylinder(g,-.29,1.133,.88,.023,.011,.052,C.cream);
      const paper=slab(g,.32,.97,.78,.155,.19,.06,.012,C.grey);paper.rotation.z=-.04;
      for(let i=0;i<3;i++)box(g,.32+i*.004,1.08+i*.008,.793+i*.006,.125,.075,.006,C.white);
    }
    booth(shared,-3.05);booth(shared,2.85);
    function lamp(p,x,z,y) {
      cylinder(p,x,y+.84,z,.014,.014,1.72,C.ink,10);
      cylinder(p,x,y+.16,z,.065,.05,.15,C.amber,16);
      cylinder(p,x,y,z,.315,.079,.26,C.evergreen,32);
      cylinder(p,x,y-.139,z,.324,.308,.036,C.amber,32);
      cylinder(p,x,y-.159,z,.283,.28,.014,material(0xffdd90,true),32);
      ball(p,x,y-.175,z,.063,.065,.063,material(0xffefbb,true));
    }
    lamp(shared,-2.65,-.9,3.45);lamp(shared,2.87,-1.18,3.51);

    function counter(p,w=12) {
      box(p,0,.42,1.02,w,.86,1.48,C.teal);
      box(p,0,.46,1.775,w,.58,.038,C.evergreen);
      const ribs=Math.floor((w/2-.12)/.38);
      for (let i=-ribs;i<=ribs;i++) box(p,i*.38,.46,1.80,.03,.55,.028,C.teal);
      box(p,0,.78,1.80,w,.058,.056,C.amber);
      box(p,0,.839,1.04,w,.082,1.62,C.evergreen);
      box(p,0,.898,1.06,w,.048,1.66,C.amber);
      const lip=slab(p,0,.904,1.04,w,1.67,.067,.082,0xd9c29e);lip.rotation.x=-Math.PI/2;
      surface(p,0,.981,1.04,w-.09,1.61,terrazzo);
      for(const y of [.885,.858])box(p,0,y,1.881,w,.013,.008,y>.86?0xe3ad70:C.darkmetal);
      const mounts=Math.floor((w/2-.17)/.73);
      for(let i=-mounts;i<=mounts;i++)screw(p,i*.73,.783,1.845,.014);
    }
    const counterProps=window.DinerCounterProps.create(T);
    function bottle(p,x,y,z,color,s=1) {return counterProps.add(p,color===C.red?'ketchup':'mustard',x,y,z,s);}
    function paperTray(p,x,y,z,w,d,color=C.white) {
      box(p,x,y,z,w,.031,d,C.red);
      box(p,x,y+.022,z,w*.977,.028,d*.966,color);
      for(let i=0;i<6;i++) for(let j=0;j<4;j++)
        if((i+j)%2===0) box(p,x-w*.425+i*w*.17,y+.039,z-d*.374+j*d*.25,w*.159,.006,d*.24,0xde9e82);
    }
    function till(p,x,y,z) {
      const g=group(p,x,y,z);g.rotation.y=.22;
      slab(g,0,.09,-.18,.76,.19,.49,.055,C.evergreen);
      slab(g,0,.23,-.14,.69,.16,.42,.05,C.mint);
      slab(g,0,.38,-.22,.57,.26,.28,.06,C.teal);
      slab(g,0,.48,.066,.42,.10,.015,.018,C.ink);
      for(let i=0;i<3;i++)for(let j=0;j<2;j++) box(g,-.20+i*.115,.329,.147+j*.089,.073,.044,.060,(i===2&&j===1)?C.amber:C.cream);
      box(g,.205,.308,.19,.11,.032,.15,C.red);
      box(g,0,.112,.313,.55,.018,.008,C.darkmetal);
      box(g,.0,.083,.321,.14,.021,.013,C.amber);
      decal(g,0,.478,.087,.38,.09,(c,w,h)=>{
        label(c,"06.50",w*.54,h*.50,"bold SIZE monospace",.073,"#d4dda0");
      });
      for(let i=0;i<3;i++)for(let j=0;j<2;j++){
        box(g,-.20+i*.115,.355,.14+j*.089,.031,.003,.007,C.ink);
      }
    }
    function cup(p,x,y,z) {return counterProps.add(p,'soda',x,y,z);}
    function napkins(p,x,y,z) {
      const g=group(p,x,y,z);g.rotation.y=.17;
      slab(g,0,.15,-.15,.35,.31,.27,.043,C.darkmetal);
      slab(g,0,.15,.122,.32,.28,.018,.036,C.grey);
      slab(g,0,.235,.144,.25,.071,.005,.022,C.ink);
      for(let i=0;i<3;i++){
        const a=slab(g,.006*i,.302+i*.018,.055+.026*i,.22,.16,.008,.01,0xf9e9ca);
        a.rotation.z=.10-.10*i;a.rotation.x=-.07*i;
      }
      screw(g,-.115,.068,.146,.012);screw(g,.115,.068,.146,.012);
    }
    function fries(p,x,y,z,s) {
      const g=group(p,x,y,z);g.scale.setScalar(s);
      const tub=cylinder(g,0,.147,0,.14,.19,.28,C.red,4);tub.rotation.y=Math.PI/4;
      for(let i=0;i<9;i++){
        const stick=box(g,(i%3-1)*.078,.293+(i%4)*.012,(Math.floor(i/3)-1)*.062,.054,.23+i%3*.042,.053,i%2?C.amber:0xf0c264);
        stick.rotation.z=(i%3-1)*.14;stick.rotation.x=(i%4-1)*.07;
      }
      box(g,0,.145,.155,.15,.045,.009,C.cream);
    }
    // The dining room has a real entrance, an unobstructed centre aisle, and four service tables.
    const diningRoom=group(world), diningShell=group(diningRoom), diningProps=group(diningRoom);
    exterior(diningShell,true);
    // Warm window light and the cool return from the glazed frontage are local to the dining room.
    const windowLight=new T.DirectionalLight(0xffe1b0,.26),roomFill=new T.HemisphereLight(0xd7eeea,0xcaa47f,.16);
    windowLight.position.set(-4.4,4.8,-5.6);diningRoom.add(windowLight,roomFill);
    const jukebox=window.DinerJukebox?.create(T)||null;
    if(jukebox){jukebox.position.set(1.47,0,-3.68);jukebox.rotation.y=-.17;diningProps.add(jukebox);}
    palm(diningShell,-3.75,-6.3,3.1);palm(diningShell,4.3,-6.05,3.28);
    const roomWidth=12.2, back=-4.22;
    box(diningShell,0,-.075,0,roomWidth,.13,13,C.cream);
    surface(diningShell,0,-.006,0,roomWidth,12.9,floorMat);
    // Continuous shopfront glazing and individual timber casements. The opening reaches floor level.
    const glass=finish(paint(256,384,(c,w,h)=>{
      const g=c.createLinearGradient(0,0,w,h);g.addColorStop(0,'rgba(181,225,220,0.12)');g.addColorStop(1,'rgba(238,244,214,0.18)');
      c.fillStyle=g;c.fillRect(0,0,w,h);
      c.strokeStyle='rgba(255,246,222,.22)';c.lineWidth=8;
      for(let i=0;i<3;i++){c.beginPath();c.moveTo(w*(.24+i*.18),h*.48);c.lineTo(w*(.50+i*.18),h*.26);c.stroke();}
    }),.20);
    glass.transparent=true;glass.depthWrite=false;
    const pane=(p,x,y,z,w,h)=>{const m=mesh(p,new T.PlaneGeometry(w,h),glass,x,y,z);m.castShadow=false;m.receiveShadow=false;};
    function panel(p,x,y,z,w,h,col){return slab(p,x,y,z,w,h,.035,.025,col);}
    function dado(p,x,w){
      box(p,x,.54,back,w,1.08,.16,C.pale);
      for(let u=-w/2+.22;u<w/2;u+=.45){
        box(p,x+u,.53,back+.089,.032,.88,.03,C.mint);
      }
      box(p,x,.12,back+.12,w,.11,.10,C.evergreen);
      box(p,x,1.07,back+.12,w,.10,.17,C.evergreen);
      box(p,x,1.13,back+.13,w,.028,.16,C.amber);
    }
    const doorW=1.68;
    for(const s of [-1,1]){
      const w=roomWidth*.5-doorW*.5,cx=s*(doorW*.5+w*.5);
      dado(diningShell,cx,w);
      pane(diningShell,cx,2.31,back+.005,w,2.35);
      for(let j=0;j<=3;j++)box(diningShell,cx-w/2+w*j/3,2.31,back+.05,.06,2.4,.115,C.evergreen);
      box(diningShell,cx,3.04,back+.06,w,.052,.10,C.evergreen);
      for(const y of [1.15,3.49])box(diningShell,cx,y,back+.09,w,.087,.14,C.evergreen);
    }
    box(diningShell,0,3.90,back,roomWidth,.82,.17,C.cream);
    box(diningShell,0,4.27,back+.08,roomWidth,.115,.16,C.evergreen);
    for(let j=0;j<35;j++){
      const ax=-6.02+j*.354, col=j%2?C.cream:C.red;
      const a=box(diningShell,ax,3.52,back-.19,.355,.063,.92,col);a.rotation.x=.13;
      const fringe=ball(diningShell,ax,3.44,back-.63,.177,.105,.04,col);fringe.castShadow=false;
    }
    for(const x of [-.87,.87])box(diningShell,x,1.76,back+.035,.10,3.52,.16,C.evergreen);
    box(diningShell,0,3.48,back+.08,1.84,.10,.16,C.evergreen);
    // A glazed enamel sign marks the waiting spot without occupying aisle space.
    const hostSign=group(diningShell,-1.69,3.08,back+.21);
    for(const x of [-.44,.44]){
      rod(hostSign,vec(x,.19,-.015),vec(x,.405,-.038),.009,C.brass,8);
      ball(hostSign,x,.185,0,.026,.022,.016,C.amber);
    }
    slab(hostSign,0,0,0,1.32,.36,.026,.050,C.brass);
    slab(hostSign,0,0,.028,1.285,.329,.015,.044,C.evergreen);
    decal(hostSign,0,0,.048,1.23,.306,(c,w,h)=>{
      label(c,'请在此候位',w*.5,h*.40,'bold SIZE "Microsoft YaHei", sans-serif',.114,'#fff0c6');
      label(c,'PLEASE WAIT TO BE SEATED',w*.5,h*.79,'bold SIZE Georgia',.045,'#f0cd89');
    });
    box(diningShell,0,.014,back,.01+doorW,.028,.34,C.darkmetal);
    const door=group(diningProps,-doorW*.5,0,back);
    const leaf=group(door,doorW*.5,0,0);
    for(const x of [-doorW*.5+.049,doorW*.5-.049])box(leaf,x,1.72,0,.09,3.42,.09,C.teal);
    for(const y of [.07,.88,3.37])box(leaf,0,y,.006,doorW,.10,.092,C.teal);
    panel(leaf,0,.44,-.032,1.58,.73,C.teal);pane(leaf,0,2.13,0,1.49,2.45);
    box(leaf,.61,1.32,.07,.035,.49,.062,C.amber);
    rod(leaf,vec(-.25,2.60,.074),vec(0,2.83,.074),.007,C.ink,6);
    rod(leaf,vec(.25,2.60,.074),vec(0,2.83,.074),.007,C.ink,6);
    panel(leaf,0,2.47,.065,.66,.26,C.cream);
    decal(leaf,0,2.47,.11,.61,.22,(c,w,h)=>label(c,'OPEN',w/2,h/2,'bold SIZE Georgia',.16,'#ac4535'));
    const mat=surface(diningShell,0,.006,-3.86,1.76,.60,finish(paint(384,120,(c,w,h)=>{
      c.fillStyle='#774e38';c.fillRect(0,0,w,h);
      for(let x=0;x<w;x+=5){c.fillStyle=x%2?'#8b6044':'#916a4a';c.fillRect(x,0,2,h);}
      c.strokeStyle='#e2ba7e';c.lineWidth=3;c.strokeRect(7,7,w-14,h-14);
      label(c,'WELCOME',w/2,h*.52,'bold SIZE Georgia',37,'#e9cfa0');
    }),.93));mat.castShadow=false;
    // Side walls, etched menu prints and two brass wall lights on each side.
    for(const side of [-1,1]){
      const sidewall=group(diningShell,side*roomWidth*.5,0,.16);
      sidewall.rotation.y=-side*Math.PI/2;
      box(sidewall,0,2.21,-.085,9.0,4.44,.15,0xf0dbb8);
      box(sidewall,0,.65,.01,9,1.30,.09,0x91b8a2);
      for(let i=-9;i<=9;i++)box(sidewall,i*.48,.63,.077,.028,1.09,.027,0xa5c6ac);
      box(sidewall,0,1.31,.074,9,.113,.18,C.evergreen);
      box(sidewall,0,1.393,.065,9,.031,.16,C.amber);
      box(sidewall,0,.117,.09,9,.135,.09,C.evergreen);
      box(sidewall,0,4.22,.032,9,.15,.17,C.teal);
      for(const j of [-1,1]){
        const cx=j*2.03, t=group(sidewall,cx,2.54,.12);
        panel(t,0,0,0,1.31,1.59,C.brown);panel(t,0,0,.05,1.23,1.50,C.cream);
        if(!window.DinerRoomArt?.addPoster?.(T,t,side,j<0?0:1))decal(t,0,0,.089,1.13,1.39,(c,w,h)=>{
          const green=(j*side)>0;c.fillStyle=green?'#336b60':'#c86141';c.fillRect(0,0,w,h);
          c.strokeStyle='#ffe0ab';c.lineWidth=.012;c.strokeRect(.037,.038,w-.074,h-.076);
          c.fillStyle=green?'#f5b873':'#ffd690';c.beginPath();c.arc(w*.50,h*.41,.245,0,Math.PI*2);c.fill();
          c.fillStyle=green?'#394f44':'#a44335';c.beginPath();c.moveTo(0,h*.63);c.quadraticCurveTo(w*.28,h*.39,w*.51,h*.57);c.quadraticCurveTo(w*.75,h*.40,w,h*.58);c.lineTo(w,h*.72);c.lineTo(0,h*.72);c.fill();
          label(c,green?'PALM STREET':'SUNSET',w*.5,h*.83,'bold SIZE Georgia',green?.12:.17,'#fff2c7');
          label(c,'B U R G E R    C L U B',w*.5,h*.93,'bold SIZE Arial',.043,'#f3c88c');
        });
      }
      const sconce=group(sidewall,0,2.84,.14);
      panel(sconce,0,0,0,.13,.32,C.amber);rod(sconce,vec(0,0,0),vec(0,.02,.22),.031,C.brown);
      cylinder(sconce,0,.16,.20,.145,.084,.22,C.cream,24);
    }
    // The ceiling and side fascia reach beyond the camera for the reverse table angles.
    // This removable ceiling is the camera set's fourth wall. Let the soft overhead key reach the tables.
    const ceilingRoot=group(diningRoom);
    const ceiling=box(ceilingRoot,0,4.60,-.25,roomWidth+.1,.145,12.2,0xf0ddbd);ceiling.castShadow=false;
    for(const z of [-3.7,-.72,2.46])box(ceilingRoot,0,4.44,z,roomWidth,.13,.15,0xd5b28b);
    const diningSeats=[
      {x:-2.68,z:-1.90},{x:2.68,z:-1.90},{x:-2.68,z:1.27},{x:2.68,z:1.27}
    ];
    const tableOffset=.83,tableY=.985;
    const tableGlow=paint(192,192,(c,w,h)=>{
      const falloff=c.createRadialGradient(w*.50,h*.5,0,w*.50,h*.5,w*.50);
      falloff.addColorStop(0,'rgba(255,205,121,.84)');falloff.addColorStop(.42,'rgba(255,204,132,.64)');falloff.addColorStop(.80,'rgba(255,198,117,.22)');falloff.addColorStop(1,'rgba(255,210,145,0)');
      c.fillStyle=falloff;c.fillRect(0,0,w,h);
    });
    const poolMaterial=new T.MeshBasicMaterial({map:tableGlow,transparent:true,opacity:0,depthWrite:false});
    const pendants=[];
    for(const {x,z} of diningSeats){
      const lampZ=z+tableOffset;lamp(diningShell,x,lampZ,3.48);
      const light=new T.PointLight(0xffcc88,.04,4.4,1.6);light.position.set(x,3.19,lampZ);diningRoom.add(light);pendants.push(light);
      const lightPool=surface(diningProps,x,1.030,lampZ,1.82,.97,poolMaterial);lightPool.renderOrder=1;lightPool.receiveShadow=false;
    }
    function roundTop(p,x,y,z,w,d,h,r,color){
      // Extrusion runs along +Z in local space, hence +Y after rotating.
      const m=slab(p,x,y,z,w,d,h,r,color);m.rotation.x=-Math.PI/2;return m;
    }
    // Bake the broad bounce light and tiny material variations that also read in the CPU renderer.
    const vinylInk=finish(paint(768,384,(c,w,h)=>{
      const shade=c.createLinearGradient(0,0,0,h);
      for(const [at,col] of [[0,'#853629'],[.08,'#b05843'],[.19,'#bf6450'],[.36,'#b65743'],[.66,'#a54a3a'],[.87,'#883d31'],[1,'#71372e']])shade.addColorStop(at,col);
      c.fillStyle=shade;c.fillRect(0,0,w,h);
      const step=w/10;
      for(let i=0;i<=10;i++){
        const x=i*step, channel=c.createLinearGradient(x-12,0,x+12,0);
        channel.addColorStop(0,'rgba(64,25,24,0)');channel.addColorStop(.43,'rgba(69,29,26,.29)');
        channel.addColorStop(.54,'rgba(75,28,23,.50)');channel.addColorStop(.68,'rgba(250,173,124,.15)');channel.addColorStop(1,'rgba(240,160,113,0)');
        c.fillStyle=channel;c.fillRect(x-12,0,24,h);
        c.strokeStyle='rgba(220,154,121,.58)';c.lineWidth=1.1;c.setLineDash([3.8,4.2]);
        c.beginPath();c.moveTo(x+4,11);c.lineTo(x+4,h-15);c.stroke();
      }
      c.setLineDash([]);
      for(let i=0;i<9700;i++){
        const x=rnd()*w,y=rnd()*h;c.fillStyle=i%2?'rgba(245,199,152,.080)':'rgba(56,26,22,.085)';c.fillRect(x,y,.6+1.6*rnd(),.6+rnd());
      }
      c.strokeStyle='rgba(241,169,127,.40)';c.lineWidth=1.1;c.strokeRect(5,5,w-10,h-10);
    }),.53,.025);
    const upholstery=new T.PlaneGeometry(1.965,.81,100,24),up=upholstery.attributes.position;
    for(let k=0;k<up.count;k++){
      const x=up.getX(k),y=up.getY(k),edge=Math.max(0,(Math.abs(y)-.306)/.099),t=(x/1.965+.5)*10;
      const crest=Math.sin(t*Math.PI)**2,roll=Math.max(0,1-(y/.409)**2);
      up.setXYZ(k,x*(1-.057*edge*edge),y,.011+roll*(.014+.050*crest)-.031*edge*edge);
    }
    upholstery.computeVertexNormals();
    const laminate=finish(paint(768,416,(c,w,h)=>{
      const r=60;c.beginPath();c.moveTo(r,0);c.arcTo(w,0,w,h,r);c.arcTo(w,h,0,h,r);c.arcTo(0,h,0,0,r);c.arcTo(0,0,w,0,r);c.clip();
      const glow=c.createLinearGradient(0,0,w*.8,h);glow.addColorStop(0,'#c3b092');glow.addColorStop(.36,'#dfccb1');glow.addColorStop(.63,'#e7d6bd');glow.addColorStop(1,'#cfb89a');
      c.fillStyle=glow;c.fillRect(0,0,w,h);
      for(let n=0;n<5300;n++){
        const x=rnd()*w,y=rnd()*h,sz=.45+1.8*rnd();c.fillStyle=['#b09b83','#f8e8cf','#aab0a3','#c1ae98','#ece3d0'][n%5];
        c.globalAlpha=.34+.37*rnd();c.beginPath();c.moveTo(x-sz,y);c.lineTo(x+sz*.27,y-sz*.7);c.lineTo(x+sz*1.6,y+sz*.36);c.lineTo(x,y+sz*.70);c.fill();
      }
      c.globalAlpha=1;
      const sweep=c.createLinearGradient(0,h*.98,w*.9,0);sweep.addColorStop(0,'rgba(255,245,212,0)');sweep.addColorStop(.45,'rgba(255,248,222,0)');sweep.addColorStop(.50,'rgba(255,246,220,.15)');sweep.addColorStop(.62,'rgba(255,246,220,.18)');sweep.addColorStop(.72,'rgba(255,246,220,0)');
      c.fillStyle=sweep;c.fillRect(0,0,w,h);
    }),.39,.035);laminate.alphaTest=.25;
    const chrome=finish(paint(128,96,(c,w,h)=>{
      const g=c.createLinearGradient(0,0,w,0);[[0,'#7e877f'],[.16,'#c7c9bc'],[.34,'#e9e5d3'],[.43,'#a6b4a7'],[.60,'#72847f'],[.78,'#d7d4c4'],[1,'#788b83']].forEach(([a,b])=>g.addColorStop(a,b));
      c.fillStyle=g;c.fillRect(0,0,w,h);for(let i=0;i<h;i+=2){c.fillStyle='rgba(255,250,231,.08)';c.fillRect(0,i,w,1);}
    }),.32,.18);
    const glassSalt=finish(paint(128,180,(c,w,h)=>{
      const g=c.createLinearGradient(0,0,w,0);g.addColorStop(0,'#b3b7a5');g.addColorStop(.3,'#eee6d4');g.addColorStop(.48,'#c4c8b6');g.addColorStop(.72,'#f5ecda');g.addColorStop(1,'#aab5a9');c.fillStyle=g;c.fillRect(0,0,w,h);
      for(let i=0;i<1300;i++){c.fillStyle=i%2?'#f6efdd':'#b4b7a7';c.globalAlpha=.43;c.fillRect(rnd()*w,rnd()*h,1+rnd(),1+rnd());}
    }),.36);
    const glassPepper=finish(paint(128,180,(c,w,h)=>{
      c.fillStyle='#584b3e';c.fillRect(0,0,w,h);
      for(let i=0;i<2400;i++){c.fillStyle=['#312f2c','#806850','#9c8974','#50473c'][i%4];c.fillRect(rnd()*w,rnd()*h,1+rnd()*2,2);}
      for(let j=0;j<8;j++){c.fillStyle='rgba(229,232,209,.20)';c.fillRect(j*16+2,0,2,h);}
    }),.40);
    const tissue=finish(paint(192,180,(c,w,h)=>{
      const shade=c.createLinearGradient(0,0,w,h);shade.addColorStop(0,'#fdf3de');shade.addColorStop(.51,'#fff9e9');shade.addColorStop(1,'#e1d6bf');c.fillStyle=shade;c.fillRect(0,0,w,h);
      c.strokeStyle='rgba(183,165,136,.27)';c.lineWidth=1;
      for(let j=-h;j<w;j+=8){c.beginPath();c.moveTo(j,0);c.lineTo(j+h,h);c.stroke();}
      c.strokeStyle='rgba(255,255,241,.75)';c.strokeRect(4,4,w-8,h-8);c.strokeStyle='#d8cbb3';c.strokeRect(7,7,w-14,h-14);
    }),.96);tissue.side=T.DoubleSide;
    const tissueGeo=new T.PlaneGeometry(.253,.153,14,8),paperPoints=tissueGeo.attributes.position;
    for(let i=0;i<paperPoints.count;i++){
      const x=paperPoints.getX(i),y=paperPoints.getY(i),t=(y+.0765)/.153;
      paperPoints.setXYZ(i,x*(.88+.12*t),y+.013*t*Math.sin(x*26),.016*Math.cos(x*31)-.034*t*t);
    }
    tissueGeo.computeVertexNormals();
    function napkinDispenser(p){
      roundTop(p,0,.006,0,.362,.281,.026,.037,C.ink);
      slab(p,0,.175,-.124,.35,.302,.243,.053,chrome);
      slab(p,0,.172,.123,.310,.251,.012,.039,0xc7cabc);
      slab(p,0,.219,.140,.258,.089,.007,.034,0x4d625c);
      slab(p,0,.231,.150,.224,.050,.006,.020,0xf1e6d1);
      for(let j=0;j<3;j++){
        const sheet=mesh(p,tissueGeo,tissue,(j-1)*.012,.348+j*.011,-.035+.023*j);
        sheet.rotation.set(-.10+j*.085,0,(j-1)*.10);
      }
      for(const k of [-1,1]){
        rod(p,vec(k*.109,.093,.141),vec(k*.109,.092,.151),.009,C.darkmetal,10);
        box(p,k*.109,.092,.155,.013,.003,.002,C.ink);
      }
    }
    function makeTable(seat,i){
      const {x,z}=seat, g=group(diningShell,x,0,z), far=Math.sign(x);
      // Long pleated vinyl booth seats, cream edge welt and routed backrest.
      box(g,0,.26,-.02,1.98,.47,.63,C.evergreen);
      roundTop(g,0,.413,.015,2.07,.77,.11,.12,C.cherry);
      roundTop(g,0,.520,.015,2.065,.77,.014,.12,0xf3b890);
      roundTop(g,0,.538,.018,2.055,.76,.067,.12,C.red);
      slab(g,0,.966,-.505,2.075,.93,.17,.14,C.cherry);
      slab(g,0,.975,-.34,2.01,.86,.085,.12,0xd2644d);
      mesh(g,upholstery,vinylInk,0,.975,-.237);
      rod(g,vec(-.92,1.355,-.216),vec(.92,1.355,-.216),.009,0xf2c49c,8);
      for(const k of [-1,1]){
        rod(g,vec(k*.92,1.355,-.216),vec(k*.967,1.31,-.217),.009,0xf2c49c,8);
        rod(g,vec(k*.967,1.31,-.217),vec(k*.973,.66,-.217),.008,0xd9a386,8);
      }
      contact(g,0,-.001,.08,2.48,1.24);
      const tz=tableOffset;
      cylinder(g,0,.038,tz,.37,.39,.044,C.ink,48);
      cylinder(g,0,.078,tz,.39,.33,.05,chrome,48);
      cylinder(g,0,.109,tz,.33,.22,.035,chrome,48);
      cylinder(g,0,.476,tz,.106,.086,.73,chrome,32);
      cylinder(g,0,.89,tz,.21,.28,.072,C.evergreen,32);
      roundTop(g,0,.90,tz,1.92,1.04,.057,.16,C.darkmetal);
      roundTop(g,0,.944,tz,1.927,1.051,.012,.16,0xe4d8be);
      roundTop(g,0,.960,tz,1.923,1.046,.012,.16,0x916947);
      roundTop(g,0,.971,tz,1.923,1.043,.008,.16,0xd9b682);
      roundTop(g,0,.978,tz,1.918,1.033,.042,.16,C.cream);
      surface(g,0,1.027,tz,1.906,1.017,laminate);
      const menuCorner=group(g,-far*.126,0,-.18);
      window.DinerRoomArt?.addMenu?.(T,menuCorner,far,i);
      contact(g,-far*.676,1.029,.51,.56,.39);
      // Napkin fan, ribbed salt/pepper shakers, and the enamel table number.
      const nx=far*.75;
      const napkinRack=group(g,nx,1.029,tz-.23);napkinRack.scale.set(.81,.86,.80);
      napkinDispenser(napkinRack);
      contact(g,nx,1.030,tz-.19,.40,.33);
      for(let k=0;k<2;k++){
        const px=nx-far*(.24+.129*k),pz=tz-.316;
        contact(g,px,1.030,pz,.148,.108);
        cylinder(g,px,1.045,pz,.056,.055,.025,chrome,16);
        cylinder(g,px,1.127,pz,.054,.042,.143,k?glassPepper:glassSalt,12);
        cylinder(g,px,1.202,pz,.046,.044,.022,chrome,24);
        ball(g,px,1.215,pz,.044,.021,.044,chrome);
        for(let h=0;h<5;h++){const a=h*Math.PI*.4;ball(g,px+.019*Math.cos(a),1.234,pz+.019*Math.sin(a),.004,.002,.004,C.ink);}
      }
      const tag=group(g,far*.755,1.032,tz+.24);tag.scale.setScalar(.86);
      contact(g,far*.756,1.030,tz+.24,.44,.205);
      roundTop(tag,0,0,0,.42,.18,.022,.023,C.evergreen);
      panel(tag,0,.146,-.023,.396,.244,C.evergreen);
      decal(tag,0,.142,.027,.36,.206,(c,w,h)=>{
        c.strokeStyle='#c8d7ae';c.lineWidth=.006;c.strokeRect(.007,.008,w-.014,h-.016);
        label(c,'0'+(i+1),w/2,h*.52,'bold SIZE Georgia',.128,'#fff1cb');
      });
      contact(g,.045,.001,tz-.018,1.83,1.17);
    }
    diningSeats.forEach(makeTable);
    // Service tray slides from the pass to the top of the selected table.
    const carryTray=group(diningProps);
    roundTop(carryTray,0,0,0,1.06,.64,.042,.092,C.evergreen);
    roundTop(carryTray,0,.043,0,1.02,.61,.016,.085,C.amber);
    roundTop(carryTray,0,.060,0,.995,.58,.012,.079,C.white);
    cup(carryTray,.338,.075,-.065,C.teal);
    contact(carryTray,.338,.0745,-.065,.34,.30);contact(carryTray,-.13,.0744,0,.65,.51);
    const carrySpot=group(carryTray,-.13,.075,0);carrySpot.name='meal-position';
    carryTray.visible=false;
    // A staffed serving hatch anchors the delivery route at the front of the room.
    const servicePass=group(diningShell,5.13,0,3.72);servicePass.rotation.y=-1.20;
    box(servicePass,0,.49,0,2.72,.96,.68,C.teal);
    box(servicePass,0,.48,.346,2.68,.75,.035,C.evergreen);
    for(let i=-7;i<=7;i++)box(servicePass,i*.171,.48,.37,.025,.71,.025,C.teal);
    roundTop(servicePass,0,.986,0,2.81,.81,.043,.09,C.amber);
    roundTop(servicePass,0,1.035,0,2.81,.81,.075,.09,C.cream);
    surface(servicePass,0,1.122,0,2.59,.65,terrazzo);
    till(servicePass,.68,1.123,0);napkins(servicePass,-1.01,1.12,-.11);
    for(let i=0;i<4;i++)cylinder(servicePass,-.55,1.14+i*.025,.08,.23,.234,.022,i%2?C.white:C.pale,32);
    for(const x of [-1.16,1.16])rod(servicePass,vec(x,1.11,-.23),vec(x,2.22,-.23),.027,C.amber);
    roundTop(servicePass,0,2.22,-.16,2.62,.49,.048,.047,C.evergreen);
    for(const x of [-.68,.28]){
      cylinder(servicePass,x,2.13,-.14,.15,.055,.143,C.amber,24);
      cylinder(servicePass,x,2.05,-.14,.143,.14,.014,material(0xffd78a,true),24);
    }
    const ticketPaper=window.DinerOrderSlip.create(T);
    let server=null,staffHead=null,staffEyes=null,notepad=null,orderPencil=null;
    function getServer(){
      if(server)return server;
      server=models.chef();
      staffHead=server.getObjectByName('head');
      staffEyes=[server.getObjectByName('iris-1'),server.getObjectByName('iris1')];
      notepad=group(diningProps);notepad.name='server-order-pad';
      panel(notepad,0,0,0,.34,.42,0x795439);panel(notepad,0,0,.041,.30,.381,C.white);
      const padPage=ticketPaper.sheet(.274,.355,.003);padPage.position.z=.088;notepad.add(padPage);
      box(notepad,0,.168,.09,.115,.021,.012,chrome);
      orderPencil=group(diningProps);orderPencil.name='server-order-pencil';
      // Pivot at the graphite tip, so it follows the paper throughout a stroke.
      cylinder(orderPencil,0,.003,0,.0024,.0004,.006,0x393B36,6);
      cylinder(orderPencil,0,.014,0,.010,.0024,.017,0xC79762,6);
      cylinder(orderPencil,0,.092,0,.010,.010,.140,0xE1A549,6);
      cylinder(orderPencil,0,.165,0,.0105,.0105,.017,0xB69C67,8);
      cylinder(orderPencil,0,.180,0,.010,.009,.014,0xBE7463,8);
      diningProps.add(server);return server;
    }
    const serverPos=new T.Vector3(),toward=new T.Vector3(),palmL=new T.Vector3(),palmR=new T.Vector3();
    const trayStart=new T.Vector3(),stationaryTray=new T.Vector3(),forward=new T.Vector3(),across=new T.Vector3();
    const servicePoint=new T.Vector3(),staffUp=vec(0,1,0),staffDir=new T.Vector3(),staffInverse=new T.Matrix4();
    const passPosition=vec(4.11,0,3.36);
    const serviceRoutes=diningSeats.map(({x,z})=>{
      const side=Math.sign(x);
      return new T.CatmullRomCurve3([passPosition,vec(2.90,0,3.36),vec(side*.58,0,2.78),vec(side*.72,0,z+1.12),vec(x-side*1.24,0,z+.82)]);
    });
    function poseStaff(){
      const ordering=state.visit==='ordering',waiting=state.visit==='carrying',carrying=waiting||state.visit==='delivering';
      if(!diningRoom.visible||(!ordering&&!carrying)){if(server)server.visible=notepad.visible=orderPencil.visible=false;return;}
      const person=getServer(),idx=occupiedTable(),seat=diningSeats[idx],side=Math.sign(seat.x),p=sat(state.visitProgress||0);
      person.visible=true;notepad.visible=orderPencil.visible=ordering;
      const q=waiting?0:carrying?visitStep(p,0,.69):visitStep(p,0,.40),route=serviceRoutes[idx],u=ordering?mix(.79,1,q):q;
      route.getPointAt(u,serverPos);route.getTangentAt(u,toward);
      const targetYaw=ordering?side*1.23:Math.atan2(seat.x-serverPos.x,seat.z+tableOffset+.15-serverPos.z);
      const walkYaw=Math.atan2(toward.x,toward.z),face=visitStep(q,.68,1);
      person.rotation.y=walkYaw+Math.atan2(Math.sin(targetYaw-walkYaw),Math.cos(targetYaw-walkYaw))*face;
      const yaw=person.rotation.y,motion=lowMotion||waiting?0:1-visitStep(q,.83,1),stride=u*route.getLength()*7.2;
      forward.set(Math.sin(yaw),0,Math.cos(yaw));across.set(Math.cos(yaw),0,-Math.sin(yaw));
      const settle=carrying&&!waiting?visitStep(p,.66,.89):0,release=carrying&&!waiting?visitStep(p,.91,1):0;
      // The cook takes a final short step at the edge of the booth.
      person.position.copy(serverPos).addScaledVector(forward,.105*settle);
      person.userData.setVisitPose('walk',stride,motion);
      person.userData.onFrame(performance.now(),lowMotion,ordering?'waiting':'playing');
      person.updateMatrix();staffInverse.copy(person.matrix).invert();
      if(ordering){
        const note=visitStep(p,.28,.52)*(1-visitStep(p,.89,.99));
        notepad.position.set(-.122,1.474+.033*note,.407).applyMatrix4(person.matrix);
        notepad.rotation.set(-1.88+.074*note,yaw-.10,-.158,'YXZ');notepad.updateMatrix();
        const beat=Math.max(0,p-.34)*37,row=Math.floor(beat/3)%3,draw=beat%3;
        const sx=-.085+.065*draw,sy=.062-.047*row+(lowMotion?0:.010*Math.sin(draw*11));
        orderPencil.position.set(sx,sy,.093+.026*(1-note)).applyMatrix4(notepad.matrix);
        staffDir.set(.446,.838,-.318).normalize().transformDirection(person.matrix);
        orderPencil.quaternion.setFromUnitVectors(staffUp,staffDir);
        // Intersect the index/thumb pinch exactly eighty millimetres up
        // the pencil shaft. The other hand supports the lower pad corner.
        palmR.copy(orderPencil.position).addScaledVector(staffDir,.080).applyMatrix4(staffInverse);
        palmR.x+=.055;palmR.y-=.026;palmR.z-=.040;
        palmL.set(-.132,-.086,.061).applyMatrix4(notepad.matrix).applyMatrix4(staffInverse);
        palmL.x-=.055;palmL.y-=.026;palmL.z-=.040;
        person.userData.serviceHands(true,palmL,palmR,.035+.070*note);
        // At the booth he turns to listen, follows the page while writing,
        // then looks back at the guest as the pencil lifts.
        staffHead.rotation.x+=.255*note;
        staffHead.rotation.y+=side*(.41-.34*note);
        for(const pupil of staffEyes){
          pupil.position.y-=.0055*note;
          pupil.position.x+=side*(.0028-.005*note);
        }
      }else{
        const lower=waiting?0:visitStep(p,.67,.87),slide=waiting?0:visitStep(p,.84,.982),edge=waiting?0:visitStep(p,.765,.855);
        trayStart.set(0,1.40+(lowMotion?0:.009*Math.sin(stride)*motion),.56).applyMatrix4(person.matrix);
        stationaryTray.set(seat.x,tableY+.042,seat.z+tableOffset+.15);
        const near=servicePoint.copy(stationaryTray).sub(person.position);near.y=0;near.normalize();
        near.multiplyScalar(-.32*(1-slide)).add(stationaryTray);
        carryTray.position.copy(trayStart).lerp(near,lower);
        // Keep the plate level during travel. It first touches the laminate
        // near the cook, then slides gently to the centre as the fingers open.
        carryTray.rotation.set(0,yaw+Math.atan2(Math.sin(-yaw),Math.cos(-yaw))*slide,0);
        carryTray.updateMatrix();
        for(const k of [-1,1]){
          const hand=k<0?palmL:palmR,offset=servicePoint.copy(across).multiplyScalar(k*mix(.273,.155,slide)).addScaledVector(forward,-mix(.147,.56,edge));
          const trayYaw=carryTray.rotation.y,c=Math.cos(trayYaw),s=Math.sin(trayYaw);
          const tx=T.MathUtils.clamp(c*offset.x-s*offset.z,-.518,.518),tz=T.MathUtils.clamp(s*offset.x+c*offset.z,-.323,.323);
          hand.set(tx,mix(-.028,.038,edge),tz).applyMatrix4(carryTray.matrix).applyMatrix4(staffInverse);
          hand.x+=k*.064;hand.lerp(servicePoint.set(k*.304,1.207,.31),release);
        }
        person.userData.serviceHands(false,palmL,palmR,.042+.332*settle-.24*release);
        staffHead.rotation.x+=.075*(1-release)-.06*release;
      }
    }
    // A folded receipt on the table records the customer's order.
    const cheque=group(diningProps);
    roundTop(cheque,0,0,0,.29,.40,.008,.009,C.white);
    const tablePage=ticketPaper.sheet(.274,.383,.008);tablePage.rotation.x=-Math.PI/2;tablePage.position.y=.011;cheque.add(tablePage);
    cheque.visible=false;
    const barLift=.52;
    const order=base.order;counter(order);order.position.y=barLift;
    box(order,0,-barLift/2,1.02,12,barLift,1.48,C.teal);
    till(order,-2.02,.983,.91);napkins(order,2.68,.985,.92);
    contact(order,-2.01,.984,.93,1.01,.72);
    bottle(order,2.07,.987,.64,C.red,1.2);bottle(order,2.35,.987,.64,C.amber,1.04);
    // Original display burger on a pedestal with enamel rim.
    const bx=.84,bz=.86,displayScale=.57;
    const stand=group(order,bx,.984,bz);stand.scale.setScalar(displayScale);
    cylinder(stand,0,.021,0,.385,.4,.05,C.teal);
    cylinder(stand,0,.083,0,.127,.123,.08,C.cream);
    cylinder(stand,0,.151,0,.5,.59,.077,C.evergreen);
    cylinder(stand,0,.200,0,.61,.595,.035,C.amber);
    cylinder(stand,0,.228,0,.585,.565,.029,C.white);
    contact(stand,0,.244,0,1.08,.97);
    const hero=models.burger(["bottom","patty","cheese","lettuce","tomato","top"]);
    hero.position.set(bx,barLift+.984+.245*displayScale,bz);hero.rotation.y=-.32;hero.scale.setScalar(.94*displayScale);itemHolders.order.add(hero);
    cup(order,1.67,.988,.91,C.teal);
    contact(order,bx,.985,bz,.67,.57);
    for(const [x,z,w,d] of [[1.67,.91,.38,.34],[2.07,.64,.30,.23],[2.35,.64,.27,.22],[-.18,1.12,.68,.56],[-1.2,1.28,.41,.34]])contact(order,x,.984,z,w,d);
    paperTray(order,-.18,.993,1.12,.55,.43);fries(order,-.18,1.034,1.11,.8);
    // A countertop bell and its tiny spring post.
    cylinder(order,-1.20,1.01,1.28,.16,.16,.045,C.ink);
    ball(order,-1.20,1.044,1.28,.13,.090,.13,C.amber);
    cylinder(order,-1.2,1.135,1.28,.026,.033,.060,C.darkmetal);
    const benchWidth=4.74,prepCenter=4.78;
    workstations.build.position.x=prepCenter;
    const grill=base.grill;counter(grill,benchWidth);
    const grillTop=1.22;
    box(grill,0,1.066,.86,2.96,.205,1.64,C.darkmetal);
    box(grill,0,1.17,.84,2.89,.102,1.57,C.ink);
    box(grill,0,grillTop,.87,2.73,.033,1.41,C.grill);
    surface(grill,0,grillTop+.018,.87,2.72,1.399,griddleSurface);
    for(let i=-12;i<13;i++) {
      const r=slab(grill,i*.104,grillTop+.019,.88,.028,1.30,.016,.012,0x48504b);
      r.rotation.x=-Math.PI/2;
    }
    box(grill,0,1.10,1.705,2.96,.170,.064,C.cream);
    for(const x of [-.92,-.46,.46,.92]) {
      const knob=cylinder(grill,x,1.10,1.767,.071,.071,.09,C.ink);
      knob.rotation.x=Math.PI/2;
      box(grill,x,1.112,1.818,.012,.044,.017,C.amber);
      for(let i=0;i<7;i++){
        const a=(i/6-.5)*3.8;
        const tick=box(grill,x+.084*Math.sin(a),1.10+.084*Math.cos(a),1.743,.007,.016,.012,C.ink);
        tick.rotation.z=-a;
      }
    }
    screw(grill,-1.38,1.106,1.744);screw(grill,1.38,1.106,1.744);
    slab(grill,0,1.099,1.744,.50,.099,.012,.016,C.evergreen);
    decal(grill,0,1.099,1.76,.46,.097,(c,w,h)=>{
      label(c,"PALM  •  1962",w*.5,h*.50,"800 SIZE Georgia",.051,"#eac896");
    });
    box(grill,0,1.36,.04,2.95,.30,.067,C.grey);
    box(grill,0,1.52,.038,2.98,.038,.10,C.darkmetal);
    const stainless=finish(paint(512,128,(c,w,h)=>{
      const g=c.createLinearGradient(0,0,w,h);g.addColorStop(0,"#99a69b");g.addColorStop(.3,"#d5d9c8");g.addColorStop(.6,"#939d99");g.addColorStop(.79,"#cad1bf");g.addColorStop(1,"#a5aea5");c.fillStyle=g;c.fillRect(0,0,w,h);
      for(let i=0;i<500;i++){c.fillStyle=i%2?"rgba(45,62,58,.11)":"rgba(255,246,221,.25)";c.fillRect(rnd()*w,rnd()*h,rnd()*w*.6,.24+rnd()*.42);}
    }),.38,.30);
    const steel=mesh(grill,new T.PlaneGeometry(2.9,.275),stainless,0,1.36,.079);steel.castShadow=false;
    for(const x of [-1.32,-.68,.68,1.32])screw(grill,x,1.44,.08,.016);
    // The grill has its own service shelf with a tiled backing, bottles and rail.
    const shelf=group(grill,0,0,-.78);
    slab(shelf,0,1.18,-.22,3.66,.98,.10,.074,C.darkmetal);
    const backsplash=mesh(shelf,new T.PlaneGeometry(3.51,.86),wallTiles,0,1.19,-.111);backsplash.castShadow=false;
    const shelfTop=slab(shelf,0,1.68,-.03,3.78,.64,.052,.063,C.darkmetal);shelfTop.rotation.x=-Math.PI/2;
    surface(shelf,0,1.736,-.03,3.69,.57,stainless);
    box(shelf,0,1.687,.293,3.68,.048,.027,C.grey);
    rod(shelf,vec(-1.58,1.50,.02),vec(1.58,1.50,.02),.022,C.grey);
    for(const x of [-1.58,1.58]) {
      rod(shelf,vec(x,1.50,.02),vec(x,1.50,-.12),.022,C.darkmetal);
      screw(shelf,x,1.5,-.105,.033);
    }
    const saucePan=group(shelf,-.88,1.74,-.06);
    const copper=finish(paint(256,96,(c,w,h)=>{
      const wash=c.createLinearGradient(0,0,w,0);[[0,'#8b5441'],[.15,'#aa7258'],[.33,'#cf9a71'],[.48,'#995e44'],[.72,'#b17c59'],[1,'#7d4c3d']].forEach(([at,col])=>wash.addColorStop(at,col));c.fillStyle=wash;c.fillRect(0,0,w,h);
      for(let j=0;j<500;j++){c.fillStyle=j%2?'#edb88b45':'#78453447';c.fillRect(rnd()*w,rnd()*h,3+rnd()*13,.9);}
    }),.38,.20);
    cylinder(saucePan,0,.105,0,.216,.232,.209,copper,42);
    cylinder(saucePan,0,.025,0,.209,.214,.027,C.darkmetal,42);
    cylinder(saucePan,0,.208,0,.237,.235,.016,chrome,42);
    cylinder(saucePan,0,.215,0,.224,.223,.013,0x79513a,42);
    const sauce=cylinder(saucePan,0,.223,0,.203,.202,.007,0x8e3b26,40);sauce.castShadow=false;
    for(let j=0;j<14;j++){
      const a=2.4*j,r=Math.sqrt((j+.42)/14)*.177;
      const herb=ball(saucePan,r*Math.cos(a),.227,r*Math.sin(a),.007,.0021,.004,j%3?0xc07543:0x647048);herb.rotation.y=a;
    }
    rod(saucePan,vec(.19,.162,0),vec(.39,.206,0),.025,chrome);
    rod(saucePan,vec(.33,.197,0),vec(.57,.249,0),.035,C.brown);
    for(const x of [.348,.543]){const brass=cylinder(saucePan,x,.201+(x-.34)*.22,0,.037,.037,.018,C.amber,16);brass.rotation.z=-1.35;}
    for(let i=0;i<3;i++){
      const x=.26+i*.35;
      cylinder(shelf,x,1.891,-.01,.102,.103,.31,[C.cherry,C.amber,C.teal][i],32);
      cylinder(shelf,x,2.053,-.01,.11,.11,.036,C.grey,32);
      for(const dy of [-.115,.086])cylinder(shelf,x,1.894+dy,-.01,.104,.105,.015,C.cream,28);
      decal(shelf,x,1.90,.096,.15,.13,(c,w,h)=>{
        c.fillStyle="#f6dfb3";c.fillRect(0,.018,w,.095);
        label(c,["PAPRIKA","SALT","HERBS"][i],w*.5,h*.51,"900 SIZE Georgia",.023,"#62493b");
      });
    }
    for(const x of [-1.18,-.89,1.04,1.28]){
      mesh(shelf,cached("hook",()=>new T.TorusGeometry(.041,.009,6,14)),C.darkmetal,x,1.48,.035);
      rod(shelf,vec(x,1.443,.039),vec(x,1.305,.046),.014,C.amber);
      if(x<0)ball(shelf,x,1.262,.051,.045,.07,.021,C.grey);
      else slab(shelf,x,1.264,.047,.079,.095,.016,.014,C.grey);
    }
    for(const x of [-1.43,1.43]) box(grill,x,1.31,.84,.055,.19,1.61,C.grey);
    function spatula(p,x,y,z) {
      const g=group(p,x,y,z);g.rotation.y=.45;
      const die=new T.Shape();die.moveTo(-.066,-.17);die.lineTo(-.125,-.11);die.lineTo(-.135,.128);die.quadraticCurveTo(-.135,.157,-.104,.157);
      die.lineTo(.106,.157);die.quadraticCurveTo(.135,.157,.135,.128);die.lineTo(.125,-.11);die.lineTo(.066,-.17);die.closePath();
      for(const dx of [-.069,-.023,.023,.069]){
        const h=new T.Path();h.moveTo(dx-.010,-.083);h.quadraticCurveTo(dx,-.106,dx+.010,-.083);h.lineTo(dx+.010,.083);h.quadraticCurveTo(dx,.103,dx-.010,.083);h.closePath();die.holes.push(h);
      }
      const blade=mesh(g,new T.ExtrudeGeometry(die,{depth:.006,bevelEnabled:true,bevelSegments:1,bevelSize:.004,bevelThickness:.002,curveSegments:6}),chrome,0,.031,-.15);blade.rotation.x=-Math.PI/2;
      rod(g,vec(0,.035,.010),vec(0,.087,.153),.021,chrome,10);
      rod(g,vec(0,.087,.153),vec(0,.091,.251),.021,chrome,10);
      const grip=new T.LatheGeometry([[.022,.0],[.048,.01],[.051,.034],[.045,.07],[.057,.19],[.056,.245],[.050,.272],[.017,.282]].map(([r,h])=>new T.Vector2(r,h)),24);
      const handle=mesh(g,grip,woodSurface,0,.090,.207);handle.rotation.x=Math.PI/2;handle.scale.z=.73;
      for(const dz of [.243,.422])cylinder(g,0,.129,dz,.011,.011,.005,chrome,12);
      const ferrule=cylinder(g,0,.090,.215,.048,.048,.029,C.amber,20);ferrule.rotation.x=Math.PI/2;ferrule.scale.z=.75;
      const loop=mesh(g,new T.TorusGeometry(.022,.005,6,14),chrome,0,.087,.504);loop.rotation.x=-Math.PI/2;
      return g;
    }
    const turner=spatula(itemHolders.grill,1.72,.985,.86);
    contact(grill,1.75,.985,1.0,.44,.83);contact(grill,0,.984,.91,3.37,1.89);
    bottle(grill,-1.82,.984,.56,C.red,1.18);bottle(grill,-2.06,.984,.49,C.amber,1.13);
    const prep=base.build; counter(prep,benchWidth);
    const cookingRoom=group(world);
    const galley=group(cookingRoom);
    // The cooking line stands on two serviceable cabinets with a kickplate, access doors and a cold-unit grille.
    function baseCabinet(base,cold){
      const z=1.837;
      slab(base,0,.442,z,4.58,.604,.027,.037,0x365750);
      box(base,0,.132,1.811,4.53,.116,.043,C.darkmetal);
      for(const [i,x] of [-1.53,0,1.53].entries()){
        const front=group(base,x,.458,z+.03);
        slab(front,0,0,0,1.48,.535,.024,.028,cold?0x799d8d:0x548476);
        if(cold&&i===2){
          slab(front,0,0,.025,1.31,.387,.010,.021,C.darkmetal);
          decal(front,0,0,.039,1.262,.353,(c,w,h)=>{
            c.fillStyle='#596d65';c.fillRect(0,0,w,h);
            for(let r=0;r<5;r++)for(let j=0;j<9;j++){
              const x=.033+j*.137,y=.024+r*.063;
              c.fillStyle='#334d46';c.fillRect(x,y,.103,.025);c.fillStyle='#9ba99a';c.fillRect(x,y+.025,.102,.005);
            }
          });
        }else{
          const hX=i===0?.52:-.52;
          rod(front,vec(hX,.119,.04),vec(hX,.119,.099),.018,chrome,12);
          rod(front,vec(hX,-.038,.04),vec(hX,-.038,.099),.018,chrome,12);
          rod(front,vec(hX,-.038,.099),vec(hX,.119,.099),.024,chrome,16);
          for(const y of [-.134,.133]){
            slab(front,-hX,y,.031,.068,.075,.012,.008,chrome);
            for(const dy of [-.02,.02])screw(front,-hX,y+dy,.048,.006);
          }
        }
      }
    }
    baseCabinet(grill,false);baseCabinet(prep,true);
    const tileCladding=finish(paint(1536,512,(c,w,h)=>{
      const row=27,bw=50;c.fillStyle='#a6ad9f';c.fillRect(0,0,w,h);
      for(let j=0;j<Math.ceil(h/row);j++)for(let i=-1;i<Math.ceil(w/bw)+1;i++){
        const x=i*bw+(j%2)*bw*.5,y=j*row,base=['#d4ded0','#cddbcf','#dfe4d2','#d5dfcd','#dae1d3'][(j*3+i+25)%5];
        c.fillStyle=base;c.fillRect(x+2,y+2,bw-3,row-3);
        const glow=c.createLinearGradient(0,y,0,y+row);glow.addColorStop(0,'#fff2d666');glow.addColorStop(.12,'#ffeccb16');glow.addColorStop(.76,'#7e9a8d08');glow.addColorStop(1,'#687f762a');
        c.fillStyle=glow;c.fillRect(x+2,y+2,bw-3,row-3);
        c.fillStyle='#f9f3d9';c.fillRect(x+3,y+3,bw-6,1.3);c.fillStyle='#aab5a9';c.fillRect(x+3,y+row-3,bw-5,1);
      }
      const warm=c.createRadialGradient(w*.40,h*.60,0,w*.40,h*.60,w*.33);warm.addColorStop(0,'rgba(255,198,105,.19)');warm.addColorStop(1,'rgba(255,198,105,0)');
      c.fillStyle=warm;c.fillRect(0,0,w,h);
    }),.33,.04);
    // One continuous cooking line. The greaseproof wall and tile return meet both counters.
    box(galley,2.31,-.066,.75,15,.123,10,C.cream);
    surface(galley,2.31,.001,.75,14.86,9.75,floorMat);
    box(galley,2.32,2.46,-1.62,15,.01+4.94,.14,0xe0d5b9);
    const ceramics=mesh(galley,new T.PlaneGeometry(14.97,3.88),tileCladding,2.32,2.22,-1.538);ceramics.castShadow=false;
    box(galley,2.32,.36,-1.484,15,.11,.15,C.evergreen);
    box(galley,2.32,2.11,-1.48,15,.051,.09,C.evergreen);
    box(galley,2.32,2.16,-1.47,15,.021,.095,C.amber);
    // An enamel trim with a stainless cap bridges the two sections without a gap.
    box(galley,prepCenter/2,.47,1.03,.085,.92,1.47,C.evergreen);
    box(galley,prepCenter/2,.978,1.05,.047,.038,1.65,chrome);
    box(galley,prepCenter/2,.85,1.872,.046,.16,.035,C.darkmetal);
    for(let i=0;i<4;i++)screw(galley,prepCenter/2,.80+.042*i,1.895,.008);
    // Stainless heat shield; brushed directional streaks, return folds, anchors and raised rim.
    slab(galley,0,1.82,-1.48,3.98,1.66,.039,.045,chrome);
    const hotWall=mesh(galley,new T.PlaneGeometry(3.88,1.55),stainless,0,1.82,-1.432);hotWall.castShadow=false;
    for(const x of [-1.86,0,1.86])for(const y of [1.17,1.84,2.48])screw(galley,x,y,-1.422,.018);
    for(const x of [-1.91,1.91])box(galley,x,1.83,-1.411,.018,1.55,.044,C.grey);
    // The capture canopy slopes into a vertical duct. Mirrored filter banks remain clear of the food and sightline.
    function prismRoof(p,xlo,xhi,backZ,frontZ,top,lip,mat){
      const v=[xlo,top,backZ,xhi,top,backZ,xlo,lip,frontZ,xhi,lip,frontZ];
      const shape=new T.BufferGeometry();shape.setAttribute('position',new T.Float32BufferAttribute(v,3));
      shape.setAttribute('uv',new T.Float32BufferAttribute([0,1,1,1,0,0,1,0],2));shape.setIndex([0,2,1,2,3,1]);shape.computeVertexNormals();
      const hood=mesh(p,shape,mat,0,0,0);hood.material.side=T.DoubleSide;
    }
    const hood=group(galley,0,0,0);
    // Extend the open capture mouth over the rear of the griddle while the higher lip clears the cook's head.
    hood.position.y=.15;
    prismRoof(hood,-1.72,1.72,-1.42,.73,3.32,2.66,stainless);
    box(hood,0,2.616,.704,3.50,.112,.11,chrome);
    box(hood,0,2.565,.733,3.45,.024,.113,C.evergreen);
    box(hood,0,2.65,.764,3.45,.013,.021,C.grey);
    for(const side of [-1,1]) {
      const cheek=new T.Shape();cheek.moveTo(-1.42,2.55);cheek.lineTo(.73,2.55);cheek.lineTo(.73,2.68);cheek.lineTo(-1.42,3.32);cheek.closePath();
      const caps=mesh(hood,new T.ExtrudeGeometry(cheek,{depth:.03,bevelEnabled:false}),C.darkmetal,side*1.73,0,0);
      caps.rotation.y=-Math.PI/2;
      box(hood,side*1.72,2.55,-.344,.058,.046,2.14,chrome);
    }
    const duct=group(hood,0,3.34,-1.21);
    box(duct,0,.54,0,.86,1.12,.54,chrome);
    for(const y of [.025,.46,.89]){box(duct,0,y,0,.91,.042,.58,C.darkmetal);box(duct,0,y+.025,.01,.914,.013,.583,C.grey);}
    rod(duct,vec(-.40,1.07,0),vec(-1.63,1.07,0),.22,C.grey,20);
    rod(duct,vec(-1.63,1.07,0),vec(-1.63,1.07,-.51),.22,chrome,22);
    ball(duct,-1.63,1.07,0,.221,.221,.221,chrome);
    panel(duct,-1.63,1.07,-.37,.54,.54,C.darkmetal);
    for(const x of [-.61,-1.12,-1.52]){const clamp=cylinder(duct,x,1.07,0,.23,.23,.036,C.darkmetal,20);clamp.rotation.z=Math.PI/2;}
    for(const sx of [-.96,0,.96]){
      const bank=group(hood,sx,2.616,-.82);bank.rotation.x=-.30;
      box(bank,0,0,0,.87,.055,.74,C.ink);
      for(let i=-4;i<=4;i++){const slat=box(bank,i*.089,-.022,.0,.057,.044,.679,chrome);slat.rotation.z=-.37;}
    }
    // Warm halogen bars have an enamel guard and a translucent-light appearance without loading another texture.
    for(const sx of [-1.06,1.06]){
      box(hood,sx,2.552,.531,.76,.053,.15,C.darkmetal);
      const lens=roundTop(hood,sx,2.516,.529,.67,.101,.022,.029,material(0xffe0a3,true));lens.castShadow=false;
      for(const k of [-.24,0,.24])box(hood,sx+k,2.515,.529,.013,.024,.13,C.grey);
    }
    for(const x of [-1.62,-.80,0,.80,1.62])screw(hood,x,2.618,.770,.013);
    const trim=group(hood,0,2.616,.775);
    decal(trim,0,0,.002,.48,.055,(c,w,h)=>{
      c.fillStyle='#53655b';c.fillRect(0,0,w,h);label(c,'PALM  •  COOKLINE',w*.5,h*.52,'bold SIZE Georgia',.032,'#f9e3bc');
    });
    const taskLight=new T.PointLight(0xffd7a1,.44,4);taskLight.position.set(-.17,2.4,-.17);cookingRoom.add(taskLight);
    // A service pass behind the cold station: sleeved brass heat lamps, stone landing and stacks of glazed plates.
    const passRack=group(galley,prepCenter,0,-.84);
    box(passRack,0,.96,0,3.53,.38,.71,C.evergreen);
    roundTop(passRack,0,1.13,0,3.58,.76,.064,.073,chrome);
    surface(passRack,0,1.201,0,3.43,.63,terrazzo);
    for(const x of [-1.61,1.61]) {
      cylinder(passRack,x,1.676,-.255,.023,.023,.96,chrome,18);
      cylinder(passRack,x,1.242,-.255,.061,.048,.076,chrome,18);
      cylinder(passRack,x,2.13,-.255,.042,.042,.060,C.amber,18);
    }
    rod(passRack,vec(-1.65,2.15,-.255),vec(1.65,2.15,-.255),.034,chrome,16);
    const hangingTicket=group(passRack,0,1.885,-.19);
    const passPage=ticketPaper.sheet(.355,.485,.035);passPage.rotation.z=-.048;hangingTicket.add(passPage);
    const grip=group(passRack,0,2.126,-.203);
    box(grip,0,0,0,.153,.074,.065,chrome);box(grip,0,.041,-.018,.091,.019,.031,C.ink);
    for(const side of [-1,1])rod(grip,vec(side*.037,.063,.011),vec(side*.045,.001,.026),.006,C.darkmetal,8);
    for(const x of [-.91,.91]){
      rod(passRack,vec(x,2.15,-.255),vec(x,2.15,.06),.021,C.darkmetal);
      cylinder(passRack,x,2.066,.06,.043,.035,.14,C.amber,16);
      cylinder(passRack,x,1.93,.06,.187,.053,.17,0xa65e41,36);
      cylinder(passRack,x,1.843,.06,.192,.191,.024,C.amber,36);
      cylinder(passRack,x,1.829,.06,.169,.168,.014,material(0xffdfa0,true),32).castShadow=false;
      const meals=group(passRack,x,1.206,.04);
      for(let j=0;j<(x<0?4:7);j++){
        cylinder(meals,0,.015+j*.024,0,.185,.247,.028,j%2?C.white:0xe2dcc4,36);
        cylinder(meals,0,.026+j*.024,0,.248,.244,.01,j%2?C.cream:C.teal,36);
      }
      contact(passRack,x,1.205,.035,.62,.55);
    }
    const rail=group(galley,prepCenter+1.74,0,-1.38);
    rod(rail,vec(-.44,1.81,0),vec(.44,1.81,0),.015,C.amber,12);
    for(let k=0;k<3;k++){
      const x=(k-1)*.25;mesh(rail,cached('hook',()=>new T.TorusGeometry(.041,.009,6,14)),C.darkmetal,x,1.782,.012);
      rod(rail,vec(x,1.755,.019),vec(x,1.49,.022),.016,0x805d43);
      for(const y of [1.54,1.70])ball(rail,x,y,.041,.007,.007,.003,C.amber);
      if(k===0)ball(rail,x,1.421,.054,.067,.089,.031,chrome);
      else if(k===1)slab(rail,x,1.422,.014,.137,.132,.015,.021,chrome);
      else for(const q of [-1,1])rod(rail,vec(x,1.476,.02),vec(x+q*.043,1.369,.04),.009,C.grey,8);
    }
    const boardY=1.081;
    box(prep,0,1.015,1.02,2.52,.075,1.49,C.brown);
    for(let i=0;i<8;i++) box(prep,-1.085+i*.31,1.058,1.02,.308,.052,1.48,[0xd5a76c,0xdcb47b,0xdfb67f,0xd9aa75][i%4]);
    surface(prep,0,1.086,1.02,2.479,1.475,woodSurface);
    contact(prep,0,.985,1.025,2.91,1.72);
    box(prep,0,1.008,1.783,2.52,.053,.018,C.wood);
    const bins=["lettuce","tomato","cheese","pickle","onion","top"];
    const binX=i=>-1.425+i*.57;
    box(prep,0,.992,-.03,3.48,.095,.61,C.evergreen);
    // Stamped steel ingredient wells have a hollow rolled lip and a retaining rail along the cold bar.
    function roundedPath(path,w,h,r){
      const l=-w/2,b=-h/2;path.moveTo(l+r,b);path.lineTo(-l-r,b);path.quadraticCurveTo(-l,b,-l,b+r);
      path.lineTo(-l,-b-r);path.quadraticCurveTo(-l,-b,-l-r,-b);path.lineTo(l+r,-b);path.quadraticCurveTo(l,-b,l,-b-r);
      path.lineTo(l,b+r);path.quadraticCurveTo(l,b,l+r,b);path.closePath();return path;
    }
    const panRim=roundedPath(new T.Shape(),.55,.419,.035);
    panRim.holes.push(roundedPath(new T.Path(),.486,.354,.030));
    const rimGeometry=new T.ExtrudeGeometry(panRim,{depth:.010,bevelThickness:.004,bevelSize:.004,bevelSegments:2,curveSegments:5});
    for(const z of [-.264,.188])rod(prep,vec(-1.72,1.205,z),vec(1.72,1.205,z),.014,chrome,12);
    bins.forEach((id,i)=>{
      const x=binX(i);
      box(prep,x,1.108,-.04,.54,.21,.40,C.darkmetal);
      slab(prep,x,1.105,.160,.527,.175,.014,.022,chrome);
      const lip=mesh(prep,rimGeometry,chrome,x,1.236,-.04);lip.rotation.x=-Math.PI/2;
      box(prep,x,1.242,-.04,.49,.018,.35,C.ink);
      for(const side of [-1,1]){
        const folded=box(prep,x+side*.241,1.218,-.04,.011,.045,.332,chrome);folded.rotation.z=-side*.12;
      }
      const sample=models.food(id);sample.position.set(x,1.254,-.04);sample.scale.set(.445,.66,.36);prep.add(sample);
    });
    bottle(prep,1.66,.986,.57,C.red);bottle(prep,1.9,.986,.55,C.amber);
    paperTray(prep,-1.78,.996,1.02,.64,.55);
    const towel=finish(paint(256,256,(c,w,h)=>{
      c.fillStyle="#dbcead";c.fillRect(0,0,w,h);
      for(let i=0;i<8;i++) {
        c.fillStyle="rgba(128,61,46,.25)";c.fillRect(i*32,0,15,h);c.fillRect(0,i*32,w,15);
        c.fillStyle="rgba(121,66,49,.6)";c.fillRect(i*32+5,0,1,h);c.fillRect(0,i*32+5,w,1);
      }
      for(let i=0;i<256;i+=4){c.fillStyle="rgba(249,233,200,.23)";c.fillRect(i,0,.5,h);c.fillRect(0,i,w,.5);}
    }),.96);
    function foldedTowel(p,x,z){
      const g=group(p,x,.985,z);g.rotation.y=-.22;
      for(let i=0;i<3;i++){
        const fold=slab(g,.006*i,.018*i,.01*i,.39,.61,.014,.018,i%2?0xac826e:0xd0b69b);
        fold.rotation.x=-Math.PI/2;
      }
      surface(g,.012,.052,.02,.375,.597,towel);
      for(let i=-5;i<=5;i++)box(g,i*.029,.039,.33,.005,.007,.023,0xc5a383);
    }
    foldedTowel(prep,1.70,1.24);foldedTowel(grill,-1.75,1.30);
    const boardShadow=group(itemHolders.build,.01,boardY+.011,1.05);
    contact(boardShadow,0,0,0,1.61,1.29);
    const fryShadow=group(itemHolders.grill,.02,grillTop+.039,.95);
    contact(fryShadow,0,0,0,1.47,1.29);
    const customerSlot=itemHolders.order, activeGrill=itemHolders.grill, activeStack=itemHolders.build;
    const transferred=models.food("patty");
    transferred.position.set(-1.78,1.037,1.02);transferred.scale.setScalar(.62);activeStack.add(transferred);
    const grillPatty=models.food('patty');grillPatty.position.set(.02,grillTop+.031,.95);grillPatty.scale.setScalar(1.23);activeGrill.add(grillPatty);
    const grillColour=window.DinerSearing.create(T,grillPatty,models.food('raw').children[0].material);
    const platedColour=window.DinerSearing.create(T,transferred);
    const smoke = group(activeGrill);
    const vapor=paint(64,128,(c,w,h)=>{
      for(let j=0;j<22;j++){
        const t=j/22,cx=w*(.48+.11*Math.sin(6.0*t+.25)+.06*Math.sin(t*9)),cy=h*(.95-.88*t),r=w*(.044+.19*t);
        const puff=c.createRadialGradient(cx,cy,0,cx,cy,r);
        puff.addColorStop(0,'rgba(255,243,215,'+(.155*(1-.48*t))+')');puff.addColorStop(.53,'rgba(255,243,217,.08)');puff.addColorStop(1,'rgba(255,244,226,0)');
        c.fillStyle=puff;c.fillRect(cx-r,cy-r,2*r,2*r);
      }
    });
    const smokeMat=new T.MeshBasicMaterial({map:vapor,color:0xfff6e4,transparent:true,opacity:.62,depthWrite:false,side:T.DoubleSide});
    for(let i=0;i<4;i++) {
      const m=mesh(smoke,cached('vapor',()=>new T.PlaneGeometry(1,1)),smokeMat,0,0,0);
      m.castShadow=false;m.receiveShadow=false;
    }
    // Batch unmoving opaque furnishings to keep mobile draw calls low.
    function batch(root) {
      if(!gpu) return;
      root.updateMatrixWorld(true);
      const inv=new T.Matrix4().copy(root.matrixWorld).invert();
      const batches=new Map();
      root.traverse(m=>{
        if(!m.isMesh||Array.isArray(m.material)||m.material.map||m.material.transparent||m.material.vertexColors||m.geometry.getAttribute("color"))return;
        const key=m.material.uuid+'/'+Number(m.castShadow)+'/'+Number(m.receiveShadow);
        if(!batches.has(key))batches.set(key,[]);
        batches.get(key).push(m);
      });
      for(const entries of batches.values()){
        if(entries.length<2)continue;
        let size=0;
        for(const m of entries)size+=(m.geometry.index||m.geometry.attributes.position).count;
        const pos=new Float32Array(size*3), nrm=new Float32Array(size*3);
        let o=0;
        const matrix=new T.Matrix4(),normalMatrix=new T.Matrix3(),pt=new T.Vector3(),n=new T.Vector3();
        for(const m of entries){
          matrix.multiplyMatrices(inv,m.matrixWorld);normalMatrix.getNormalMatrix(matrix);
          const geometry=m.geometry, ap=geometry.attributes.position, an=geometry.attributes.normal, index=geometry.index;
          const count=index?index.count:ap.count;
          for(let j=0;j<count;j++){
            const k=index?index.getX(j):j;
            pt.fromBufferAttribute(ap,k).applyMatrix4(matrix);pt.toArray(pos,o);
            if(an){n.fromBufferAttribute(an,k).applyNormalMatrix(normalMatrix);n.toArray(nrm,o);}
            o+=3;
          }
        }
        const combined=new T.BufferGeometry();
        combined.setAttribute("position",new T.BufferAttribute(pos,3));combined.setAttribute("normal",new T.BufferAttribute(nrm,3));combined.computeBoundingSphere();
        for(const m of entries)m.parent.remove(m);
        const merged=new T.Mesh(combined,entries[0].material);
        merged.castShadow=entries[0].castShadow;merged.receiveShadow=entries[0].receiveShadow;root.add(merged);
      }
    }
    for(const root of [shared,order,grill,prep,diningShell,door,carryTray,galley])batch(root);

    // Build the stock and the slate after batching so they can switch together
    // on the first morning that the house sauce is on the menu.
    const sauceBottle=counterProps.add(prep,'smoke',1.44,.987,.71,1.56);
    sauceBottle.userData.smokeStock=true;
    const specialsBoard=group(diningShell,2.42,2.31,back+.19);
    specialsBoard.name='house-specials-board';specialsBoard.userData.smokeStock=true;
    for(const side of [-1,1])rod(specialsBoard,vec(side*.55,.428,.02),vec(side*.48,.73,-.07),.008,C.brown,8);
    slab(specialsBoard,0,0,0,1.48,.88,.058,.035,C.brown);
    slab(specialsBoard,0,0,.065,1.43,.83,.018,.026,C.amber);
    decal(specialsBoard,0,0,.089,1.396,.799,(c,w,h)=>{
      c.fillStyle='#263e36';c.fillRect(0,0,w,h);
      c.strokeStyle='#82917a';c.lineWidth=.002;c.strokeRect(.027,.027,w-.054,h-.054);
      label(c,'HOUSE  SPECIAL',w*.5,.146,'bold SIZE Georgia',.084,'#e9bd78');
      c.strokeStyle='#d4ad73';c.beginPath();c.moveTo(.26,.234);c.lineTo(w-.26,.234);c.stroke();
      label(c,'烟熏芝士堡',w*.5,.447,'bold SIZE "Microsoft YaHei",sans-serif',.193,'#fdf0d0');
      label(c,'SMOKED BBQ  /  CHEDDAR',w*.5,.666,'bold SIZE Georgia',.061,'#d7bd97');
    });
    let state={station:"order",customer:0,stack:[],grillStage:"empty"};
    let customer=null,customerId=null,lastStack="",lastLayerCount=0,servedStack=null,servedSignature="",flipAt=-1000,frame=0,priorFrame=0,dirty=true;
    const stack=group(activeStack,.01,boardY+.011,1.05);
    stack.scale.setScalar(1.22);stack.rotation.y=-.22;
    const lowMotion=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;
    const assembly=window.DinerPlacement.create(T,models,stack,shadowMap,lowMotion,refreshShadows,()=>({camera,faces:state.platedFaces??state.cookedFaces,rect:container.getBoundingClientRect(),source:id=>id==="patty"?transferred:prep.getObjectByName(id)}));
    let placementClock=null;
    let grillDrop=null,grillTransfer=null,grillPaused=false,onGrillContact=null,onGrillPlate=null;
    const dropDuration=lowMotion?.08:.34;
    function poseGrillDrop(elapsed) {
      const progress=Math.min(1,elapsed/dropDuration),air=1-progress*progress;
      const offset=(lowMotion?.04:.55)*air;
      const settleTime=Math.max(0,elapsed-dropDuration);
      const compression=settleTime<.19?.07*Math.sin(Math.PI*settleTime/.19)*Math.exp(-12*settleTime):0;
      grillPatty.position.set(.02-offset*.58,grillTop+.031+offset,.95+offset*.15);
      grillPatty.rotation.z=air*(lowMotion?0:.25);
      grillPatty.scale.set(1.23*(1+compression*.45),1.23*(1-compression),1.23*(1+compression*.45));
      fryShadow.position.x=.02-offset*.37;fryShadow.scale.setScalar(1+offset*.23);
    }
    function finishGrillDrop(contact) {
      if(!grillDrop)return;
      const landed=grillDrop.landed;grillDrop=null;
      poseGrillDrop(dropDuration+.20);
      if(contact&&!landed)onGrillContact?.();
    }
    function advanceGrillDrop(t) {
      if(!grillDrop||grillPaused)return;
      const d=grillDrop;
      if(d.clock!==null)d.elapsed+=Math.min(.75,Math.max(0,(t-d.clock)/1000));
      d.clock=t;poseGrillDrop(d.elapsed);
      if(d.elapsed>=dropDuration&&!d.landed){d.landed=true;smoke.visible=true;refreshShadows();onGrillContact?.();}
      if(d.elapsed>=dropDuration+.19)finishGrillDrop(false);
      dirty=true;
    }
    function advanceGrillTransfer(t){
      if(!grillTransfer||grillPaused)return;
      const move=grillTransfer;
      if(move.clock!==null)move.elapsed+=Math.min(.18,Math.max(0,(t-move.clock)/1000));
      move.clock=t;const f=sat(move.elapsed/.98),travel=visitStep(f,.14,.88),lift=visitStep(f,0,.25)*(1-visitStep(f,.70,.96));
      const x=mix(.02,prepCenter-1.78,travel),z=mix(.95,1.02,travel),scale=mix(1.23,.62,travel);
      const y=mix(grillTop+.031,1.037,travel)+.28*lift;
      grillPatty.visible=f<1;grillPatty.scale.setScalar(scale);grillPatty.rotation.z=Math.PI;grillPatty.position.set(x,y+.157*scale,z);
      const withdraw=visitStep(f,.86,1);turner.position.set(mix(x+.18,1.72,withdraw),mix(y-.035,.985,withdraw),mix(z+.08,.86,withdraw));turner.rotation.set(0,mix(1.05,.45,withdraw),-.065*lift);
      transferred.visible=f>=1&&state.hasPatty;
      if(f>=.88&&!move.plated){move.plated=true;onGrillPlate?.();}
      if(f>=1){grillTransfer=null;refreshShadows();}
      dirty=true;
    }
    let width=1,height=1,closeup=false,orbit=0,lastHeroRevision=null;
    let showcase=null,showingBurger=false;
    const poses = {
      order:{eye:[.36,2.65,4.39], look:[-.025,2.075,-.04], width:3.66},
      grill:{eye:[.96,3.63,5.62],look:[0,1.47,.67],width:3.88},
      build:{eye:[.76,3.23,4.58],look:[0,1.39,.71],width:3.75}
    };
    const macro={
      order:{eye:[-.43,2.70,1.66],look:[-.72,2.56,.09],width:1.05},
      grill:{eye:[.51,2.51,2.46],look:[.02,1.29,.94],width:1.79},
      build:{eye:[.58,2.22,3.16],look:[.01,1.51,1.05],width:1.79}
    };
    const wideButton=document.getElementById('diningWideBtn'),floorPlan=document.getElementById('diningMap');
    const tableButtons=Array.from(floorPlan?.querySelectorAll('[data-table]')||[]);
    function syncTableSeats(){
      if(!floorPlan||floorPlan.hidden)return;
      const choosing=state.visit==='carrying';
      for(const button of tableButtons){
        const table=Number(button.dataset.table),here=table===occupiedTable()+1;
        const other=state.previousDiners?.find(diner=>diner.table===table);
        let status=here?(choosing?'送餐':'本单'):'空桌';
        if(!here&&other){
          const times=window.DinerGame.mealTimes(other);
          status=other.seconds<times.leave?'用餐':other.seconds<times.exit?'离席':'收桌';
        }
        const guest=here?state.customerName:other?window.DinerGame.guests[other.customer].name:'';
        const label=table+' 号桌 · '+status+(guest?' · '+guest:'');
        if(button.getAttribute('aria-label')===label&&button.disabled===!choosing)continue;
        button.disabled=!choosing;button.title=label;button.setAttribute('aria-label',label);
        button.textContent=String(table).padStart(2,'0')+' '+status;
        button.classList.toggle('occupied',here);
        button.classList.toggle('has-diner',!here&&!!other);
        if(here)button.setAttribute('aria-current','location');else button.removeAttribute('aria-current');
      }
    }
    let roomWide=false;
    const inKitchen=()=>state.station==='grill'||state.station==='build';
    function syncRoomControls(){
      const inspect=document.getElementById('inspectBtn');if(inspect)inspect.hidden=state.visit==='carrying';
      if(wideButton){
        wideButton.hidden=!inKitchen()&&(!visiting()||state.visit==='carrying');
        wideButton.setAttribute('aria-pressed',String(roomWide));
        wideButton.textContent=roomWide?(inKitchen()?'返回操作台':'返回桌边'):(inKitchen()?'后厨全景':'餐厅全景');
      }
      const streetButton=document.getElementById('streetViewBtn');if(streetButton)streetButton.hidden=!roomWide;
      if(floorPlan){
        const choosing=state.visit==='carrying';
        floorPlan.hidden=!(visiting()&&(choosing||state.phase==='waiting'&&state.visit!=='ordering'));
        syncTableSeats();
      }
    }
    function toggleRoomWide(){
      if(!visiting()&&!inKitchen())return;
      if(!roomWide&&closeup)document.getElementById('inspectBtn')?.click();
      roomWide=!roomWide;syncRoomControls();pointCamera();
    }
    wideButton?.addEventListener('click',toggleRoomWide);
    const sat=t=>Math.max(0,Math.min(1,t));
    const ease=t=>{t=sat(t);return t*t*(3-2*t);};
    const mix=(a,b,f)=>a+(b-a)*f;
    const visitStep=(p,from,to)=>ease((p-from)/(to-from));
    const tableRoutes=diningSeats.map(seat=>{
      const sign=Math.sign(seat.x);
      // Approach beside the open end of the booth, turn, then slide back onto the cushion.
      return new T.CatmullRomCurve3([vec(0,0,-4.90),vec(0,0,-3.55),vec(sign*.39,0,seat.z-.18),
        vec(sign*1.24,0,seat.z+.17),vec(seat.x-sign*.43,0,seat.z+.19),vec(seat.x,0,seat.z+.04)]);
    });
    // Keep the waiting spot clear of the door swing, the jukebox and the aisle.
    const lobbyRoute=new T.CatmullRomCurve3([vec(.14,0,-5.28),vec(.15,0,-4.32),vec(.08,0,-3.65),
      vec(-.76,0,-3.33),vec(-1.62,0,-3.34)]);
    const waitingMark=group(diningProps);
    contact(waitingMark,0,.007,0,.76,.46);waitingMark.visible=false;
    const waitingPoint=vec(0,0,0),waitingTangent=vec(0,0,0);
    let waitingActor=null,waitingTicket='',waitingProgress=-1,waitingDoor=0;
    let promotedRoute=null,promotedKey='',promotedYaw=0;
    function lobbyYaw(p){
      lobbyRoute.getTangentAt(p,waitingTangent);
      const yaw=Math.atan2(waitingTangent.x,waitingTangent.z);
      return yaw+Math.atan2(Math.sin(.42-yaw),Math.cos(.42-yaw))*visitStep(p,.72,1);
    }
    function clearWaitingActor(){
      if(waitingActor){
        diningProps.remove(waitingActor);
        waitingActor.userData.dispose?.();
      }
      waitingActor=null;waitingTicket='';waitingProgress=-1;waitingMark.visible=false;waitingDoor=0;
    }
    function syncWaitingGuest(createNow){
      const guest=state.waitingGuest;
      const ticket=guest?guest.day+'/'+guest.orderNo+'/'+guest.customer:'';
      if(ticket!==waitingTicket)clearWaitingActor();
      if(!guest||(!waitingActor&&!createNow))return;
      if(!waitingActor){
        waitingActor=window.DinerGuests?window.DinerGuests.customer(guest.customer,models):models.customer(guest.customer);
        waitingActor.name='waiting-guest-'+guest.customer;
        diningProps.add(waitingActor);waitingTicket=ticket;
      }
      const p=sat(guest.seconds/window.DinerGame.queueWalkSeconds);
      if(p===waitingProgress)return;
      waitingProgress=p;
      lobbyRoute.getPointAt(p,waitingPoint);
      const stride=p*lobbyRoute.getLength()*7.7;
      waitingActor.position.copy(waitingPoint);waitingActor.rotation.y=lobbyYaw(p);
      if(p<.92){
        const motion=1-visitStep(p,.82,1);
        waitingActor.userData.setVisitPose?.('walk',stride,lowMotion?0:motion);
        if(!lowMotion)waitingActor.position.y=.015*motion*Math.abs(Math.sin(stride));
      }else waitingActor.userData.setVisitPose?.('wait',0,visitStep(p,.92,1));
      waitingMark.position.copy(waitingPoint);waitingMark.visible=true;
      if(diningRoom.visible)actorDetail(waitingActor);
      waitingDoor=1.16*(visitStep(p,0,.14)-visitStep(p,.43,.65));refreshShadows();
    }
    function entryRoute(seat,idx){
      const queued=state.queueEntryProgress;
      if(!Number.isFinite(queued))return tableRoutes[idx];
      const key=state.day+'/'+state.orderNo+'/'+queued;
      if(promotedKey===key)return promotedRoute;
      promotedKey=key;
      const p=sat(queued),start=lobbyRoute.getPointAt(p);
      promotedYaw=lobbyYaw(p);
      const path=[start],side=Math.sign(seat.x);
      if(start.z< -3.8)path.push(vec(.15,0,-3.64));
      if(start.x<-.60)path.push(vec(-.97,0,-2.97));
      path.push(vec(0,0,-2.60),vec(side*.4,0,seat.z-.17),vec(side*1.24,0,seat.z+.17),
        vec(seat.x-side*.43,0,seat.z+.19),vec(seat.x,0,seat.z+.04));
      promotedRoute=new T.CatmullRomCurve3(path);
      return promotedRoute;
    }
    const diners=window.DinerDiningGuests.create({T,models,parent:diningProps,seats:diningSeats,routes:tableRoutes,emptyTray:carryTray,reduced:lowMotion});
    const routePoint=new T.Vector3(),routeDirection=new T.Vector3();
    const occupiedTable=()=>Math.min(3,Math.max(0,(state.table||1)-1));
    const atSeat=()=>diningSeats[occupiedTable()];
    const visiting=()=>Boolean(state.visit&&state.station==='order');
    let lastShadowTime=0;
    function placeGuest(){
      if(!customer)return;
      if(!visiting()){
        customer.userData.setVisitPose?.('stand');
        customer.position.set(-.72,0,.05);customer.scale.setScalar(1.13);customer.rotation.y=.125;
        return;
      }
      customer.scale.setScalar(1);
      const idx=occupiedTable(),seat=diningSeats[idx],f=sat(state.visitProgress||0),arriving=state.visit==='arriving';
      const fall=arriving?visitStep(f,.75,1):1;
      if(arriving){
        const route=entryRoute(seat,idx);
        // Linear travel in the middle makes the feet advance evenly in the aisle.
        const u=sat((f-.04)/.89);
        route.getPointAt(u,routePoint);route.getTangentAt(u,routeDirection);
        customer.position.copy(routePoint);
        const turn=visitStep(f,.68,.91);
        let yaw=Math.atan2(routeDirection.x,routeDirection.z);
        if(Number.isFinite(state.queueEntryProgress))yaw=promotedYaw+
          Math.atan2(Math.sin(yaw-promotedYaw),Math.cos(yaw-promotedYaw))*visitStep(f,0,.15);
        customer.rotation.y=mix(yaw,-Math.sign(seat.x)*.15,turn);
        const from=state.queueEntryProgress,midEntry=Number.isFinite(from)&&from<.92;
        const priorStride=midEntry?from*lobbyRoute.getLength()*7.7:0;
        const stride=priorStride+u*route.getLength()*7.7;
        const priorWeight=midEntry?1-visitStep(from,.82,1):0;
        const walkWeight=midEntry?mix(priorWeight,1,visitStep(f,0,.12)):
          from>=.92?visitStep(f,.09,.17):1;
        if(from>=.92&&f<.09)customer.userData.setVisitPose?.('wait',0,visitStep(from,.92,1)*(1-visitStep(f,0,.09)));
        else if(f<.75)customer.userData.setVisitPose?.('walk',stride,lowMotion&&Number.isFinite(from)?0:walkWeight);
        else customer.userData.setVisitPose?.('sit',0,fall);
        if(!lowMotion&&f<.76)customer.position.y=(midEntry?mix(.015,.018,visitStep(f,0,.12)):.018)*walkWeight*Math.abs(Math.sin(stride));
        door.rotation.y=Number.isFinite(from)
          ?1.16*(1-visitStep(from,.43,.65))*(visitStep(from,0,.14)+(1-visitStep(from,0,.14))*visitStep(f,0,.13))*(1-visitStep(f,.27,.45))
          :1.16*(visitStep(f,0,.15)-visitStep(f,.34,.56));
      }else{
        customer.position.set(seat.x,0,seat.z+.04);
        customer.rotation.y=-Math.sign(seat.x)*.15;
        customer.userData.setVisitPose?.('sit',0,1);
        door.rotation.y=0;
      }
      guestMark.position.set(customer.position.x,.005,customer.position.z);
      seatShade.position.set(seat.x,.615,seat.z+.024);
      seatShade.visible=fall>.08;seatShade.scale.set(fall,1,fall);
      if(!customer.userData.setVisitPose)customer.position.y-=.40*fall;
      const receiving=state.visit==='delivering'||state.visit==='carrying', delivered=Boolean(state.served);
      carryTray.visible=receiving||delivered;
      const q=receiving?f:1, ride=visitStep(q,0,.73), glide=visitStep(q,.69,1);
      const side=Math.sign(seat.x);
      const bridge=.13*Math.sin(Math.PI*ride),footfall=lowMotion?0:.018*Math.sin(ride*9*Math.PI)*(1-glide);
      carryTray.position.set(mix(-side*.34,seat.x,ride)-side*.20*(1-glide),
        mix(1.47,tableY+.042,glide)+bridge+footfall,
        mix(3.55,seat.z+tableOffset+.15,ride)+.028*glide);
      carryTray.rotation.set(-.026*(1-glide),-.07*side*(1-glide),.012*Math.sin(ride*9*Math.PI)*(1-glide));
      cheque.visible=['ordering','dining','delivering'].includes(state.visit)||delivered;
      const noteIn=state.visit==='ordering'?visitStep(f,.42,.93):1;
      cheque.position.set(seat.x+side*.18,1.036+.26*(1-noteIn),seat.z+tableOffset-.29+.24*(1-noteIn));
      cheque.rotation.set(-.30*(1-noteIn),-.18*side,.05*(1-noteIn));
      cheque.scale.setScalar(.73*(state.visit==='ordering'?visitStep(f,.30,.61):1));
    }
    const guestMark=group(diningProps);
    contact(guestMark,0,0,0,1.12,.63);
    const seatShade=group(diningProps);contact(seatShade,0,0,0,.84,.65);seatShade.visible=false;
    // Cameras first establish the street door, then move into the aisle and to the occupied table.
    function diningLens(){
      const seat=atSeat(),side=Math.sign(seat.x),f=sat(state.visitProgress||0);
      if(state.visit==='carrying')return {eye:[1.08,3.63,9.32],look:[.46,1.37,-.18],width:11.35};
      if(roomWide)return {eye:[.24,3.36,8.74],look:[0,1.42,-.43],width:10.65};
      const chest=vec(seat.x,1.42,seat.z+.14);
      const eye=vec(seat.x-side*.97,2.03,seat.z+3.60);
      if(closeup){
        chest.set(seat.x,1.86,seat.z+.095);
        eye.set(seat.x-side*.47,2.02,seat.z+2.03);
      }
      let blend=1;
      const entry=state.visit==='arriving',serve=state.visit==='delivering';
      const ordering=state.visit==='ordering';
      if(!closeup&&(ordering||serve)){
        // Keep the standing cook, the seated guest and the table in the same frame.
        const reveal=ordering?visitStep(f,0,.31):1;
        chest.lerp(vec(seat.x-side*.55,1.52,seat.z+.34),reveal);
        eye.lerp(vec(seat.x-side*1.22,2.37,seat.z+5.20),reveal);
      }
      if(entry)blend=visitStep(f,.24,.98);
      else if(serve)blend=visitStep(f,.17,.95);
      // Over the server's shoulder: keep the tray and its destination in one view.
      if(entry||serve){
        const establishing=entry?vec(.45,2.87,4.55):vec(2.46,3.07,8.22);
        const focus=entry?vec(-side*.14,1.53,-3.35):vec(2.75,1.54,2.35);
        if(entry&&customer){
          const position=customer.position,follow=visitStep(f,.17,.55),sitDown=visitStep(f,.77,1);
          focus.lerp(vec(position.x,1.39,position.z),follow);
          establishing.lerp(vec(position.x-side*.42,2.22,position.z+5.45),follow);
          eye.lerp(establishing,1-sitDown);chest.lerp(focus,1-sitDown);
        }else{
          eye.lerp(establishing,1-blend);chest.lerp(focus,1-blend);
        }
      }
      if(state.visit==='ordering'&&!lowMotion){
        const lean=Math.sin(Math.PI*f);
        eye.x-=side*.14*lean;eye.z-=.20*lean;chest.y+=.045*lean;
      }
      return {eye:eye.toArray(),look:chest.toArray(),width:mix(entry?4.8:3.5,closeup?1.15:2.69,blend)};
    }
    const hitGroups={order:[],grill:[],build:[]};
    const raycaster=new T.Raycaster();
    function target(station,x,y,z,w,h,d,action) {
      const shape=new T.Mesh(cube,material(C.ink));
      shape.position.set(x+(station==='build'?prepCenter:0),y,z);shape.scale.set(w,h,d);shape.updateMatrixWorld();
      shape.userData.action=action;hitGroups[station].push(shape);
    }
    target("order",-.72,2.08,.05,1.29,1.85,.85,{act:"take"});
    target("order",-1.20,barLift+1.087,1.28,.38,.23,.38,{act:"take"});
    target("grill",0,1.28,.84,2.94,.28,1.70,{act:"grill"});
    bins.forEach((id,i)=>target("build",binX(i),1.196,-.04,.56,.39,.47,{act:"add",v:id}));
    target('build',sauceBottle.position.x,1.33,sauceBottle.position.z,.32,.70,.30,{act:'add',v:'smoke'});
    target("build",-1.78,1.087,1.02,.66,.20,.57,{act:"add",v:"patty"});
    const tableTargets=diningSeats.map(({x,z},i)=>{
      const shape=new T.Mesh(cube,material(C.ink));
      shape.scale.set(2.05,2.25,1.58);shape.position.set(x,1.13,z+.37);shape.updateMatrixWorld();
      shape.userData.table=i+1;shape.userData.action={act:'take'};return shape;
    });
    const diningSurfaces=diningSeats.map(({x,z},i)=>{
      const top=new T.Mesh(cube,material(C.ink));top.userData.table=i+1;
      top.position.set(x,1.00,z+tableOffset);top.scale.set(2.0,.46,1.08);top.updateMatrixWorld();
      return top;
    });
    const jukeboxHit=jukebox?new T.Mesh(cube,material(C.ink)):null;
    if(jukeboxHit){jukeboxHit.position.set(1.47,.94,-3.68);jukeboxHit.rotation.y=-.17;jukeboxHit.scale.set(1.16,1.88,.65);jukeboxHit.updateMatrixWorld();}
    function hit(clientX,clientY) {
      if(showingBurger)return null;
      const rect=container.getBoundingClientRect();
      const x=(clientX-rect.left)/rect.width, y=(clientY-rect.top)/rect.height;
      if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>1||y<0||y>1)return null;
      raycaster.setFromCamera(new T.Vector2(2*x-1,1-2*y),camera);
      const musicHit=jukeboxHit&&visiting()?raycaster.intersectObject(jukeboxHit,false)[0]:null;
      if(musicHit){
        const ahead=raycaster.intersectObjects(diningSurfaces,false)[0];
        if(!ahead||ahead.distance>musicHit.distance)return {act:'music'};
      }
      if((state.station==="order"&&state.phase&&state.phase!=="waiting"&&state.visit!=="carrying")||
         (state.station!=="order"&&state.phase&&state.phase!=="playing"))return null;
      const choosing=state.visit==='carrying';
      if(visiting()&&state.visit!=='seated'&&!choosing)return null;
      const targets=choosing?diningSurfaces:visiting()?[tableTargets[occupiedTable()]]:hitGroups[state.station];
      const contact=raycaster.intersectObjects(targets,false)[0];
      if(!contact)return null;
      if(choosing)return {act:'deliver',v:contact.object.userData.table};
      const action=contact.object.userData.action;
      if(action.v==='smoke'&&!specialsBoard.visible)return null;
      if(action.v==="patty"&&!state.hasPatty)return null;
      return action;
    }
    const projected=new T.Vector3(),nextEye=new T.Vector3(),lastLook=new T.Vector3();
    let slide=null;
    function actorDetail(actor){
      if(!actor?.visible||!actor.userData.setDetailForHeight)return;
      actor.getWorldPosition(projected);projected.y+=1.35*actor.scale.y;projected.applyMatrix4(camera.matrixWorldInverse);
      const pixels=2.69*actor.scale.y*height/(2*Math.tan(camera.fov*Math.PI/360)*Math.max(.15,-projected.z));
      actor.userData.setDetailForHeight(pixels);
    }
    function detailLevels(){
      if(!visiting())return;
      for(const actor of [customer,server,waitingActor])actorDetail(actor);
      diners.detail?.(camera,height);
    }
    function cameraAt(eye,look){
      camera.position.copy(eye);camera.lookAt(look);lastLook.copy(look);
      camera.updateProjectionMatrix();camera.updateMatrixWorld(true);detailLevels();dirty=true;
    }
    function pointCamera(animate=false) {
      const views=closeup?macro:poses;
      const kitchenOverview=inKitchen()&&roomWide;
      camera.fov=kitchenOverview||visiting()&&(roomWide||state.visit==='carrying')?39:31.5;
      const pose=kitchenOverview?{eye:[3.06,3.16,8.16],look:[2.31,1.52,-.33],width:10.40}:visiting()?diningLens():views[state.station]||views.order;
      const target=vec(...pose.look), eye=vec(...pose.eye), ray=eye.sub(target);
      if(!kitchenOverview&&state.station==='build')target.x+=prepCenter;
      if(closeup&&orbit)ray.applyAxisAngle(vec(0,1,0),orbit*(state.station==="order"?28:47)*Math.PI/180);
      const aspect=width/Math.max(height,1);
      if(!kitchenOverview&&state.station==="build"){
        const height=assembly.top*stack.scale.y;
        // Keep enough headroom for a topping in flight and for the palette overlay below.
        const stageHeight=height+(closeup?1.32:1.48);
        const middle=stack.position.y+height*.5+(closeup?.29:.24);
        target.y=closeup?middle:Math.max(target.y,middle);
        const currentHeight=ray.length()*2*Math.tan(camera.fov*Math.PI/360);
        ray.multiplyScalar(Math.max(1,stageHeight/currentHeight));
      }
      const impliedWidth=ray.length()*2*Math.tan(camera.fov*Math.PI/360)*aspect;
      ray.multiplyScalar(Math.max(1,pose.width/impliedWidth));
      nextEye.copy(target).add(ray);camera.aspect=aspect;
      if(animate&&!lowMotion){
        slide={fromEye:camera.position.clone(),fromLook:lastLook.clone(),toEye:nextEye.clone(),toLook:target,start:performance.now(),duration:grillTransfer?960:330};
        dirty=true;
      }else{slide=null;cameraAt(nextEye,target);}
    }
    function resize() {
      const rect=container.getBoundingClientRect();
      width=Math.max(1,Math.round(rect.width));height=Math.max(1,Math.round(rect.height));
      renderer.setSize(width,height,false);pointCamera();
      if(showingBurger)showcase.frame(width/height);
    }
    function setShowcase(orderStack) {
      refreshShadows();
      if(orderStack===null){
        if(showcase)showcase.clear();
        showingBurger=false;dirty=true;
        return true;
      }
      if(!Array.isArray(orderStack)||!orderStack.length)return false;
      if(!showcase)showcase=makeShowcase(T,models,shadowMap,gpu);
      showingBurger=showcase.load(orderStack,state.platedFaces,state.stackOffsets);
      if(showingBurger)showcase.frame(width/height);
      dirty=true;return showingBurger;
    }
    function setShowcaseProgress(value) {
      if(!showingBurger||!Number.isFinite(value))return;
      showcase.setProgress(value);showcase.frame(width/height);
      dirty=true;
    }
    // Each shift starts in daylight and ends under the window pendants. Keep the preparation benches legible throughout.
    let lightKey='';
    function setServiceLight(cooking){
      const time=state.orderNo>=state.daySize?'evening':state.orderNo>1?'afternoon':'noon';
      const key=time+'-'+cooking;if(key===lightKey)return;lightKey=key;
      const late=time==='evening',gold=time==='afternoon';
      scene.userData.canvasLight=cooking?[1,1,1]:late?[.66,.59,.62]:gold?[1,.944,.865]:[1,1,1];
      window.DinerRoomArt?.setService(T,diningShell,time);
      hemi.color.setHex(late?0xc4d3eb:gold?0xffeddf:0xfff1da);hemi.groundColor.setHex(late?0x9a7771:0xc2a99a);
      hemi.intensity=cooking?.64:late?.36:.64;
      sun.color.setHex(cooking?0xffefcb:late?0xb3c9e9:gold?0xffddb8:0xffefcb);sun.intensity=cooking?.81:late?.23:.66;
      windowLight.color.setHex(late?0x92b7e6:gold?0xffc788:0xffe1b0);windowLight.intensity=late?.27:.26;
      roomFill.color.setHex(late?0xf8d6a1:0xd7eeea);roomFill.intensity=late?.19:.16;
      poolMaterial.opacity=late?(gpu?.13:.29):gold?.045:.024;
      for(const pendant of pendants)pendant.intensity=late?1.67:gold?.28:.09;
      refreshShadows();dirty=true;
    }
    function update(next) {
      const previous=state;
      state=Object.assign({},state,next);
      const stocked=state.smokeLaunchDay>0&&state.day>=state.smokeLaunchDay;
      specialsBoard.visible=stocked;
      sauceBottle.userData.stocked=stocked;
      sauceBottle.visible=stocked&&!sauceBottle.userData.dispensing;
      ticketPaper.update(state);hangingTicket.visible=state.phase!=="waiting";grip.visible=hangingTicket.visible;
      if(!poses[state.station])state.station="order";
      const cooking=state.station==='grill'||state.station==='build';
      for(const id of Object.keys(workstations))workstations[id].visible=cooking?id!=='order':id===state.station;
      cookingRoom.visible=cooking;diningRoom.visible=visiting();order.visible=!diningRoom.visible;shared.visible=!diningRoom.visible&&!cooking;
      setServiceLight(cooking);
      if(previous.station!==state.station){
        const focusX=state.station==='build'?prepCenter:0;
        sun.position.x=focusX-3.4;sun.target.position.x=focusX;
      }
      if(previous.station!==state.station||previous.visit!==state.visit||previous.table!==state.table){
        if(previous.station!==state.station)roomWide=false;
        syncRoomControls();
      }else syncTableSeats();
      let retired=null;
      if(customerId!==state.customer){
        refreshShadows();
        if(customer&&(state.previousDiners?.at(-1)?.customer??state.previousDiner?.customer)===customerId){retired=customer;customer=null;}
        if(customer){customerSlot.remove(customer);customer.userData.dispose?.();}
        customerId=state.customer;
        const ticket=state.day+'/'+state.orderNo+'/'+customerId;
        if(waitingActor&&waitingTicket===ticket){
          customer=waitingActor;waitingActor=null;clearWaitingActor();customer.name='guest-'+customerId;
        }else customer=window.DinerGuests?window.DinerGuests.customer(customerId||0,models):models.customer(customerId||0);
        customer.position.set(-.72,0,.05);customer.scale.setScalar(1.13);
        customer.rotation.y=.125;customerSlot.add(customer);
      }
      if(!cooking)placeGuest();
      syncWaitingGuest(diningRoom.visible);
      const exitDoor=diners.sync(state.previousDiners??state.previousDiner,diningRoom.visible,retired);
      door.rotation.y=Math.max(door.rotation.y,exitDoor,waitingDoor);
      poseStaff();
      if(visiting()&&(previous.visit!==state.visit||previous.visitProgress!==state.visitProgress||previous.table!==state.table))pointCamera();
      const ids=state.stack||[];
      const signature=ids.length?ids.join("/")+"|"+(state.stackOffsets||[]).join("/")+"|"+(state.platedFaces||[]).join("/"):"";
      if(previous.station==="build"&&state.station!=="build"){
        assembly.settle();placementClock=null;
      }
      if(signature!==lastStack){
        const placing=ids.length>lastLayerCount&&state.phase==="playing"&&state.station==="build"&&
          previous.phase==="playing"&&previous.station==="build";
        assembly.change(ids,placing,state.stackOffsets);
        if(placing&&placementClock===null)placementClock=performance.now();
        lastStack=signature;lastLayerCount=ids.length;
        if(state.station==="build"&&previous.station===state.station)pointCamera();
      }
      // The ticketed build is presented on the pedestal when the guest receives it.
      const receipt=state.served||state.visit==="delivering"||state.visit==="carrying"?signature:"";
      if(receipt!==servedSignature) {
        if(servedStack?.parent)servedStack.parent.remove(servedStack);
        servedStack=receipt?models.burger(state.stack,state.platedFaces,state.stackOffsets):null;
        if(servedStack){
          window.DinerSearing.finish(T,servedStack,state.platedFaces);
          if(state.visit){
            servedStack.scale.setScalar(.50);servedStack.rotation.y=-.22;carrySpot.add(servedStack);
          } else {
            servedStack.position.copy(hero.position);servedStack.rotation.copy(hero.rotation);
          servedStack.scale.copy(hero.scale);customerSlot.add(servedStack); }
        }
        servedSignature=receipt;
      }
      hero.visible=!diningRoom.visible&&!servedStack;
      if(previous.visit!==state.visit||(diningRoom.visible&&['arriving','delivering'].includes(state.visit)&&performance.now()-lastShadowTime>170)){
        lastShadowTime=performance.now();refreshShadows();
      }
      if(previous.grillStage==='sideB'&&state.grillStage==='ready'&&state.station==='build'){
        if(lowMotion)onGrillPlate?.();
        else grillTransfer={elapsed:0,clock:performance.now(),plated:false};
      }
      if(grillTransfer&&(state.station!=='build'||!state.hasPatty))grillTransfer=null;
      transferred.visible=state.hasPatty===true&&!grillTransfer;
      boardShadow.visible=!!signature;
      grillPatty.visible=state.grillStage==='sideA'||state.grillStage==='sideB';
      if(grillPatty.visible)grillColour?.cook(state.heatA,state.heatB,state.grillStage==='sideB');
      if(state.hasPatty&&state.cookedFaces)platedColour?.cook(state.cookedFaces[1],state.cookedFaces[0]);
      if(state.grillStage==='sideA'&&!grillDrop)poseGrillDrop(dropDuration+.21);
      if(grillDrop&&(state.station!=="grill"||state.grillStage!=="sideA"))finishGrillDrop(false);
      fryShadow.visible=state.grillStage==="sideA"||state.grillStage==="sideB";
      smoke.visible=!lowMotion&&fryShadow.visible&&(!grillDrop||grillDrop.landed);
      if(previous.grillStage==="sideA"&&state.grillStage==="sideB")flipAt=performance.now();
      if(previous.station!==state.station){refreshShadows();orbit=0;pointCamera(inKitchen()&&['grill','build'].includes(previous.station));}
      if(previous.grillStage!==state.grillStage||!!previous.served!==!!state.served)refreshShadows();
      const staticGrill=state.station==='grill'&&previous.station==='grill'&&previous.grillStage===state.grillStage&&!fryShadow.visible;
      if(!staticGrill)dirty=true;
    }
    function invalidate(){refreshShadows();dirty=true;}
    window.addEventListener("diner-model-ready",invalidate);
    window.addEventListener("diner-room-art-ready",invalidate);
    let cpuRatio=nativeRatio,cpuBudget=820,slowFrames=0,fastFrames=0;
    let surfaceLost=false;
    function lostSurface(event){
      event.preventDefault();surfaceLost=true;
      container.dispatchEvent(new Event('diner-surface-lost'));
    }
    function restoredSurface(){
      surfaceLost=false;priorFrame=0;placementClock=null;
      renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;
      resize();invalidate();container.dispatchEvent(new Event('diner-surface-restored'));
    }
    if(gpu){
      canvas.addEventListener('webglcontextlost',lostSurface);
      canvas.addEventListener('webglcontextrestored',restoredSurface);
    }
    function draw(t) {
      frame=requestAnimationFrame(draw);
      if(surfaceLost||document.hidden){placementClock=null;return;}
      const placing=state.station==="build"&&assembly.animating();
      const visitMoving=visiting()&&['arriving','ordering','delivering'].includes(state.visit);
      const continuous=!grillPaused&&!showingBurger&&(placing||grillDrop||grillTransfer||slide||visitMoving||state.station==='grill'&&smoke.visible);
      const interval=gpu?32:continuous?55:130;
      if(t-priorFrame<interval)return;
      if(!gpu){
        // Keep still menus, table portraits and plated closeups at full resolution. Under CPU rasterization,
        // spend a bounded number of pixels on moving frames so motion does not block input on wider displays.
        const desired=continuous?Math.max(.5,Math.min(nativeRatio,cpuBudget/width)):nativeRatio;
        if(Math.abs(desired-cpuRatio)>.005){cpuRatio=desired;renderer.setPixelRatio(desired);renderer.setSize(width,height,false);dirty=true;}
      }
      if(showingBurger){
        if(dirty){renderer.render(showcase.scene,showcase.camera);dirty=false;priorFrame=t;}
        return;
      }
      // Gallery and jukebox each own their own renderer. Keep a single still of the paused room behind them.
      if(grillPaused&&!dirty)return;
      if(slide){
        const move=slide,p=ease((t-move.start)/move.duration);
        cameraAt(nextEye.lerpVectors(move.fromEye,move.toEye,p),projected.lerpVectors(move.fromLook,move.toLook,p));
        if(p>=1)slide=null;
      }
      if(customer&&lastHeroRevision!==customer.userData.revision){
        placeGuest();poseStaff();
        lastHeroRevision=customer.userData.revision;dirty=true;
      }
      if(placing){
        const delta=placementClock===null?0:(t-placementClock)/1000;
        placementClock=t;
        if(assembly.advance(delta))dirty=true;
      } else placementClock=null;
      advanceGrillDrop(t);advanceGrillTransfer(t);
      if(!dirty&&!(state.station==="grill"&&smoke.visible)&&!(gpu&&state.station==="order"&&!lowMotion))return;
      priorFrame=t;
      if(state.station==='grill'&&grillPatty.visible&&state.grillStage==='sideB'){
        // Rotate about the patty centre so the opposite face settles against the hot plate.
        const f=lowMotion?1:sat((t-flipAt)/740),lift=sat((f-.19)/.55),angle=ease(lift)*Math.PI;
        const center=.084,arc=Math.sin(lift*Math.PI),sy=1.23;
        grillPatty.rotation.z=angle;grillPatty.position.set(.02+Math.sin(angle)*center*sy,grillTop+.031+center*sy*(1-Math.cos(angle))+.56*arc,.95);
        const reach=visitStep(f,0,.25)*(1-visitStep(f,.72,1));
        turner.position.set(mix(1.72,.20,reach),mix(.985,grillTop+.006,reach)+.36*arc,mix(.86,1.11,reach));turner.rotation.y=mix(.45,1.1,reach);turner.rotation.z=.32*arc;
      }else if(!grillTransfer){turner.position.set(1.72,.985,.86);turner.rotation.set(0,.45,0);}
      if(!lowMotion){
        if(customer&&state.station==="order"){customer.rotation.z=.003*Math.sin(t*.00136);}
        if(smoke.visible&&state.station==="grill")smoke.children.forEach((m,i)=>{
          const f=(t*.00063+i*.247)%1,a=i*2.37;
          m.position.set(.02+.30*Math.sin(a)+f*.14*Math.sin(a+.9),grillTop+.16+f*.62,.95+.22*Math.cos(a));
          m.scale.set(.105+.20*f,.19+.30*f,1);
          m.quaternion.copy(camera.quaternion);m.rotateZ(Math.sin(a+f*4)*.27);
          m.visible=f>.06&&f<.92;
        });
      }
      if(visiting()&&customer?.userData.onFrame)customer.userData.onFrame(t,lowMotion,state.visit==='ordering'?'waiting':state.phase);
      if(diningRoom.visible&&waitingActor)waitingActor.userData.onFrame?.(t,lowMotion,'lobby');
      if(diningRoom.visible)diners.animate(t);
      if(jukebox&&diningRoom.visible)jukebox.userData.playback?.(window.DinerMusic?.selection,t,lowMotion);
      const began=!gpu&&continuous?performance.now():0;
      renderer.render(scene,camera);dirty=false;
      if(began){
        const cost=performance.now()-began;
        slowFrames=cost>67?slowFrames+1:0;fastFrames=cost<32?fastFrames+1:0;
        if(slowFrames>=4&&cpuBudget>610){cpuBudget-=70;slowFrames=0;}
        else if(fastFrames>=35&&cpuBudget<820){cpuBudget+=70;fastFrames=0;}
      }
    }
    update(state);resize();frame=requestAnimationFrame(draw);
    const observer=window.ResizeObserver?new ResizeObserver(resize):null;
    if(observer)observer.observe(container);else window.addEventListener("resize",resize);
    return {update,resize,hit,setShowcase,setShowcaseProgress,
      inspectShowcase(angle,elevation,magnification,split){if(!showingBurger)return;showcase.inspect(angle,elevation,magnification,split);showcase.frame(width/height);refreshShadows();dirty=true;},
      getBuildingParts(){
        syncWaitingGuest(true);
        const period=state.orderNo>=state.daySize?'evening':state.orderNo>1?'afternoon':'noon';
        return {hall:diningShell,door,grill,prep,galley,jukebox,period,smokeStock:specialsBoard.visible,visitors(){
          const rows=diners.forTour(state.previousDiners??(state.previousDiner?[state.previousDiner]:[]));
          if(waitingActor)rows.push({table:'entrance',customer:state.waitingGuest.customer,actor:waitingActor,
            extras:[waitingMark],stack:[],waiting:true});
          if(customer){
            const seat=atSeat(),onFloor=visiting();
            const extras=onFloor?[cheque,server,notepad,orderPencil].filter(o=>o?.visible):[];
            rows.push({table:occupiedTable()+1,customer:customerId,actor:customer,
              seat:onFloor?null:{x:seat.x,z:seat.z+.04,yaw:-Math.sign(seat.x)*.15},
              tray:onFloor&&carryTray.visible?carryTray:null,food:servedStack?.uuid,extras,
              stack:servedStack?(state.stack||[]).slice():[],stackOffsets:servedStack?state.stackOffsets:[],current:true});
          }
          return rows;
        }};
      },
      isPlacing:assembly.busy,whenPlacementSettled:assembly.whenSettled,setPlacementListener:assembly.setListener,
      setGrillPlateListener(handler){onGrillPlate=typeof handler==='function'?handler:null;},
      setPlacementPaused(value){assembly.pause(value);placementClock=null;grillPaused=value;if(grillDrop)grillDrop.clock=null;if(grillTransfer)grillTransfer.clock=null;dirty=true;},
      startGrillDrop(){grillDrop={elapsed:0,clock:performance.now(),landed:false};poseGrillDrop(0);dirty=true;},
      isGrillAirborne(){return !!grillDrop&&!grillDrop.landed;},finishGrillDrop,
      setGrillContactListener(fn){onGrillContact=fn;},
      holdIngredient(id,x,y){
        if(showingBurger||state.station!=="build"||state.phase!=="playing")return false;
        if(id==='smoke'&&!specialsBoard.visible)return false;
        dirty=true;return assembly.hold(id,x,y,camera,container.getBoundingClientRect());
      },
      moveHeldIngredient(x,y){dirty=true;return assembly.move(x,y,camera,container.getBoundingClientRect());},
      releaseIngredient(commit){dirty=true;return assembly.release(!!commit);},
      setCloseup(value){closeup=!!value;if(closeup&&roomWide){roomWide=false;syncRoomControls();}orbit=0;pointCamera();},
      orbitCloseup(fraction){if(closeup&&Number.isFinite(fraction)){orbit=Math.max(-1,Math.min(1,fraction));pointCamera();}},
      dispose(){
      cancelAnimationFrame(frame);wideButton?.removeEventListener("click",toggleRoomWide);
      window.removeEventListener("diner-model-ready",invalidate);
      window.removeEventListener("diner-room-art-ready",invalidate);
      if(observer)observer.disconnect();else window.removeEventListener("resize",resize);
      if(showcase)showcase.dispose();
      customer?.userData.dispose?.();
      clearWaitingActor();
      diners.dispose?.();grillColour?.dispose();platedColour?.dispose();assembly.dispose();
      canvas.removeEventListener('webglcontextlost',lostSurface);
      canvas.removeEventListener('webglcontextrestored',restoredSurface);
      if(renderer.dispose)renderer.dispose();canvas.remove();
    }};
  }
  window.DinerScene={mount};
})();


