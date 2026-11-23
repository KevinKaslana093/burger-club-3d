/* Palm Street's two-record jukebox. Cabinet, record mechanism and lamps share the same model in both views. */
(function(global){
  'use strict';
  const maps=new Map(),palette=new Map(),geometries=new Map();
  function cached(cache,key,make){if(!cache.has(key))cache.set(key,make());return cache.get(key);}
  function art(T,key,w,h,draw){return cached(maps,key,()=>{const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const tex=new T.CanvasTexture(c);tex.encoding=T.sRGBEncoding;tex.anisotropy=4;return tex;});}
  function create(T){
    const body=new T.Group();body.name='Palm Street jukebox';
    const paint=(hex,rough=.5,metal=0)=>cached(palette,[hex,rough,metal].join(':'),()=>new T.MeshStandardMaterial({color:new T.Color(hex).convertSRGBToLinear(),roughness:rough,metalness:metal}));
    const walnut=paint('#693d2a',.5), cherry=paint('#aa422e',.30,.12), chrome=paint('#d1cfbd',.25,.22), gold=paint('#dbaa5c',.32,.20), navy=paint('#173e3d',.38), deep=paint('#1e2727',.68), parchment=paint('#fff2cd',.76);
    function add(parent,geometry,material,x,y,z){const m=new T.Mesh(geometry,material);m.position.set(x,y,z);parent.add(m);return m;}
    function box(parent,x,y,z,w,h,d,material){const geo=cached(geometries,'box'+[w,h,d],()=>new T.BoxGeometry(w,h,d));return add(parent,geo,material,x,y,z);}
    function cap(parent,x,y,z,r,depth,mat,seg=48){const geom=cached(geometries,'cap'+[r,depth,seg],()=>new T.CylinderGeometry(r,r,depth,seg));const m=add(parent,geom,mat,x,y,z);m.rotation.x=Math.PI/2;return m;}
    function archShape(w,h,r){const s=new T.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(w/2,h-r);s.absarc(0,h-r,r,0,Math.PI,false);s.lineTo(-w/2,0);return s;}
    function arch(w,h,depth,y,z,mat){const geom=cached(geometries,'arc'+[w,h,depth],()=>new T.ExtrudeGeometry(archShape(w,h,w/2),{depth,curveSegments:28,bevelEnabled:true,bevelSize:.012,bevelThickness:.011,bevelSegments:3}));return add(body,geom,mat,0,y,z);}
    function bar(points,thick,mat){const curve=new T.CurvePath();for(let i=1;i<points.length;i++)curve.add(new T.LineCurve3(points[i-1],points[i]));const geo=cached(geometries,'pipe'+thick+points.map(p=>p.toArray().join(',')).join('/'),()=>new T.TubeGeometry(curve,Math.max(8,points.length*2),thick,8,false));return add(body,geo,mat,0,0,0);}
    function horseshoe(r,thick,z,mat,bottom=.14){const pts=[new T.Vector3(-r,bottom,z)];for(let i=0;i<=42;i++){const a=Math.PI-i*Math.PI/42;pts.push(new T.Vector3(r*Math.cos(a),1.30+r*Math.sin(a),z));}pts.push(new T.Vector3(r,bottom,z));return bar(pts,thick,mat);}
    function tile(key,x,y,z,w,h,map){const mat=cached(palette,key,()=>new T.MeshBasicMaterial({map}));const geo=cached(geometries,'plane'+[w,h],()=>new T.PlaneGeometry(w,h));return add(body,geo,mat,x,y,z);}
    function knob(x,y,z,r){cap(body,x,y,z,r,.014,chrome,18);box(body,x,y,z+.009,r*.94,.003,.003,deep).rotation.z=-.46;}
    // Rounded wooden shell and inset enamel face; no open back when inspected from the dining room.
    box(body,0,.079,0,1.06,.14,.58,deep);arch(1.07,1.78,.48,.10,-.28,walnut);arch(1.027,1.73,.062,.124,.212,cherry);
    arch(.907,1.60,.033,.17,.271,navy);horseshoe(.523,.026,.285,chrome);horseshoe(.481,.031,.302,parchment);horseshoe(.441,.014,.317,gold);
    const bulb=paint('#f8ca69',.30);horseshoe(.477,.012,.339,bulb,.185);
    // Fluted lower loudspeaker cloth with crossed brass brightwork.
    const grille=art(T,'grille',256,256,(g,w,h)=>{g.fillStyle='#766546';g.fillRect(0,0,w,h);for(let y=0;y<h;y+=5){for(let x=(y%10?2:0);x<w;x+=5){g.fillStyle='#292f29';g.fillRect(x,y,3,2);g.fillStyle='#b6a27a';g.fillRect(x+2,y+2,2,1);}}});
    tile('grilleMat',0,.49,.317,.788,.58,grille);
    for(let i=0;i<5;i++){const yy=.235+i*.045;for(const side of [-1,1])bar([new T.Vector3(0,yy,.34),new T.Vector3(side*.375,yy+.242,.34)],.0085,chrome);}
    for(const y of [.155,.187,.774,.799])box(body,0,y,.326,.88,.011,.032,gold);
    const cards=art(T,'record-list',768,224,(g,w,h)=>{
      g.fillStyle='#23463e';g.fillRect(0,0,w,h);g.textAlign='center';g.fillStyle='#f5dba8';g.font='bold 26px Georgia';g.fillText('P A L M   S T R E E T',w/2,38);
      const rows=[['A','LUNCH SHIFT','Original recording'],['B','BOSSA ANTIGUA','Kevin MacLeod']];rows.forEach((a,i)=>{const x=20+i*367;g.fillStyle='#f3e4be';g.fillRect(x,62,357,140);g.fillStyle=i?'#266457':'#ac4732';g.fillRect(x,62,31,140);g.fillStyle='#ffebbe';g.font='bold 24px Georgia';g.fillText(a[0],x+15,143);g.fillStyle='#3b3a2a';g.font='bold 28px Georgia';g.fillText(a[1],x+192,123);g.fillStyle='#7a6046';g.font='italic 19px Georgia';g.fillText(a[2],x+192,167);});
    });
    tile('recordLabels',0,.897,.335,.82,.20,cards);
    box(body,0,1.022,.328,.85,.023,.057,gold);
    // Visible seven-inch vinyl on a tilted display turntable, with lathed grooves and a printed paper label.
    const record=new T.Group();
    record.position.set(-.018,1.335,.336);body.add(record);
    const vinyl=art(T,'seven-inch',512,512,(g,w,h)=>{const cx=w/2,cy=h/2;g.fillStyle='#252a2a';g.fillRect(0,0,w,h);for(let i=86;i<253;i+=3){g.strokeStyle=i%10<3?'#454947':'#303537';g.lineWidth=1;g.beginPath();g.arc(cx,cy,i,0,2*Math.PI);g.stroke();}const radial=g.createRadialGradient(cx,cy,10,cx,cy,86);radial.addColorStop(0,'#f6cd73');radial.addColorStop(1,'#cf7145');g.fillStyle=radial;g.beginPath();g.arc(cx,cy,81,0,Math.PI*2);g.fill();g.fillStyle='#533f30';g.textAlign='center';g.font='bold 19px Georgia';g.fillText('PALM STREET',cx,cy-20);g.font='13px Georgia';g.fillText('45 RPM',cx,cy+30);g.fillStyle='#ded1af';g.beginPath();g.arc(cx,cy,7,0,Math.PI*2);g.fill();});
    cap(record,0,0,-.015,.287,.016,chrome);const vinylMat=cached(palette,'vinylMat',()=>new T.MeshBasicMaterial({map:vinyl}));const discGeo=cached(geometries,'record',()=>new T.CircleGeometry(.272,72));add(record,discGeo,vinylMat,0,0,0);
    const v=(x,y,z)=>new T.Vector3(x,y,z);
    cap(body,.29,1.50,.352,.046,.035,chrome);bar([v(.29,1.50,.379),v(.265,1.365,.395),v(.195,1.289,.399),v(.173,1.29,.405)],.009,gold);
    box(body,.173,1.285,.404,.061,.020,.026,parchment).rotation.z=-.25;
    const keys=[];for(let n=0;n<8;n++){const x=(n-3.5)*.092;const key=box(body,x,.745,.359,.073,.036,.055,n%2?parchment:gold);keys.push(key);}
    for(const x of [-.393,.393])for(const y of [.226,.765,1.034])knob(x,y,.349,.012);
    for(const x of [-.476,.476])for(const y of [.28,.33,.38,1.12,1.16,1.20])box(body,x,y,.345,.084,.016,.018,chrome);
    body.userData.playback=(selection,t,reduced)=>{const on=selection==='online'||selection==='original';if(on&&!reduced)record.rotation.z=-t*.00090;const selected=selection==='original'?2:selection==='online'?5:-1;keys.forEach((m,i)=>m.position.z=i===selected?.342:.359);};
    return body;
  }
  global.DinerJukebox={create};
})(window);

