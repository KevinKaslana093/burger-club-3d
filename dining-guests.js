/* Recently served booths. The order clock owns seating, meals, departures and cleanup. */
(function(global){
  'use strict';
  const clamp=x=>Math.min(1,Math.max(0,x));
  const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
  const mixAngle=(a,b,x)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*x;
  const bites=[[.175,.568,.298],[-.135,.479,.345],[.135,.382,.410],[-.105,.304,.50],[.037,.236,.609]];
  // The diner alternates sides. Successive overlapping crescents preserve
  // the earlier impressions around the corners of the newest bite.
  function biteEdge(x,stage){
    let edge=.88;
    for(let i=0;i<stage;i++){
      const [cx,cz,radius]=bites[i],d=Math.abs(x-cx);
      const arc=d<radius?cz-Math.sqrt(radius*radius-d*d):cz+(d-radius)*6;
      edge=Math.min(edge,arc);
    }
    return edge+.006*Math.cos(47*x+.58*Math.sin(19*x))+.003*Math.sin(31*x+.7);
  }
  function cutGeometry(T,source,stage,id,offsetX=0,offsetZ=0){
    const localEdge=x=>biteEdge(x+offsetX,stage)-offsetZ;
    const attr=source.attributes,original=attr.position,indices=source.index?.array;
    const dist=new Float32Array(original.count),remap=new Int32Array(original.count).fill(-1);
    const edgeCache=new Map(),positions=[],normals=[],colors=[],uv=[],faces=[],boundary=[];
    const recipes=id==='patty'?{from:[],to:[],blend:[]}:null;
    for(let i=0;i<original.count;i++)dist[i]=original.getZ(i)-localEdge(original.getX(i));
    const streams=Object.entries({position:positions,normal:normals,color:colors,uv}).filter(([name])=>attr[name])
      .map(([name,output])=>({output,src:attr[name].array,stride:attr[name].itemSize}));
    function store(a,b,t){
      const next=positions.length/3;
      if(recipes){recipes.from.push(a);recipes.to.push(b);recipes.blend.push(t);}
      for(const {output,src,stride} of streams){
        const start=a*stride,end=b*stride;
        for(let n=0;n<stride;n++)output.push(src[start+n]+t*(src[end+n]-src[start+n]));
      }
      return next;
    }
    function vertex(i){if(remap[i]<0)remap[i]=store(i,i,0);return remap[i];}
    function intersection(a,b){
      if(a>b){const tmp=a;a=b;b=tmp;}
      const key=a*original.count+b;
      if(edgeCache.has(key))return edgeCache.get(key);
      const ax=original.getX(a),az=original.getZ(a),dx=original.getX(b)-ax,dz=original.getZ(b)-az;
      let lo=0,hi=1;
      for(let j=0;j<9;j++){
        const mid=(lo+hi)*.5;
        if((az+dz*mid<=localEdge(ax+dx*mid))===(dist[a]<=0))lo=mid;else hi=mid;
      }
      const ix=store(a,b,(lo+hi)*.5);edgeCache.set(key,ix);return ix;
    }
    const count=indices?.length??original.count,tri=[0,0,0],poly=[],cross=[];
    for(let i=0;i<count;i+=3){
      tri[0]=indices?indices[i]:i;tri[1]=indices?indices[i+1]:i+1;tri[2]=indices?indices[i+2]:i+2;
      const inside=(dist[tri[0]]<=0)+(dist[tri[1]]<=0)+(dist[tri[2]]<=0);
      if(!inside)continue;
      if(inside===3){faces.push(vertex(tri[0]),vertex(tri[1]),vertex(tri[2]));continue;}
      poly.length=cross.length=0;
      for(let k=0;k<3;k++){
        const a=tri[k],b=tri[(k+1)%3];if(dist[a]<=0)poly.push(vertex(a));
        if((dist[a]<=0)!==(dist[b]<=0)){const hit=intersection(a,b);poly.push(hit);cross.push(hit);}
      }
      for(let k=1;k+1<poly.length;k++)faces.push(poly[0],poly[k],poly[k+1]);
      if(cross.length===2){
        const a=cross[0]*3,b=cross[1]*3;
        if(Math.abs(positions[a]-positions[b])>1e-5)boundary.push([positions[a],positions[a+1],positions[b],positions[b+1]]);
      }
    }
    function geometry(p,n,tex,col,ix){
      const g=new T.BufferGeometry();
      g.setAttribute('position',new T.Float32BufferAttribute(p,3));
      if(n.length)g.setAttribute('normal',new T.Float32BufferAttribute(n,3));
      if(tex.length)g.setAttribute('uv',new T.Float32BufferAttribute(tex,2));
      if(col.length)g.setAttribute('color',new T.Float32BufferAttribute(col,3));
      g.setIndex(ix);if(!n.length)g.computeVertexNormals();g.computeBoundingSphere();return g;
    }
    const outer=geometry(positions,normals,uv,colors,faces);
    if(recipes){
      const Index=original.count>65535?Uint32Array:Uint16Array;
      recipes.from=new Index(recipes.from);recipes.to=new Index(recipes.to);recipes.blend=new Float32Array(recipes.blend);
    }
    if(!boundary.length)return {outer,cut:null,recipes};
    // Fill the cross-section only where the original mesh contains food. A
    // scanline through the edge loops gives true holes in onion rings and
    // separates the two overlapping tomato slices. Lettuce is an open sheet.
    const events=[...new Set(boundary.flatMap(s=>[Math.round(s[0]*420),Math.round(s[2]*420)]))].sort((a,b)=>a-b);
    const capPos=[],capUV=[],capIdx=[];
    const ordinate=(s,x)=>s[1]+(x-s[0])*(s[3]-s[1])/(s[2]-s[0]);
    function strip(x0,x1,lo0,hi0,lo1,hi1){
      const base=capPos.length/3;
      for(const [x,y] of [[x0,lo0],[x1,lo1],[x1,hi1],[x0,hi0]]){
        capPos.push(x,y,localEdge(x)+.00025);capUV.push((x+.62)*1.2,y*3.1+.11);
      }
      capIdx.push(base,base+1,base+2,base,base+2,base+3);
    }
    for(let i=0;i<events.length-1;i++){
      const x0=events[i]/420,x1=events[i+1]/420,x=(x0+x1)*.5;
      const rows=boundary.filter(s=>(s[0]-x)*(s[2]-x)<0).sort((a,b)=>ordinate(a,x)-ordinate(b,x));
      if(id==='lettuce'){
        for(const s of rows){const a=ordinate(s,x0),b=ordinate(s,x1);strip(x0,x1,a-.0015,a+.0015,b-.0015,b+.0015);}
      }else{
        for(let j=0;j+1<rows.length;j+=2)strip(x0,x1,ordinate(rows[j],x0),ordinate(rows[j+1],x0),ordinate(rows[j],x1),ordinate(rows[j+1],x1));
      }
    }
    return {outer,cut:capIdx.length?geometry(capPos,[],capUV,[],capIdx):null,recipes};
  }

  function mealMeshes(T,models){
    const pieces=new Map(),materials=new Map(),pending=new Map();
    let timer=null,closed=false,roster='';
    const finishes={
      top:['#d6ad79','#946b44','#f5d59f',.92],bottom:['#cfaa75','#926e47','#f1d3a1',.92],
      patty:['#88563f','#5d382d','#bb8461',.64],cheese:['#f2bb62','#e5a953','#ffda8e',.58],
      lettuce:['#a5bd74','#88ad62','#dae5b0',.69],tomato:['#e76c4d','#b64e39','#ffc37c',.33],
      pickle:['#a8ad60','#7d8947','#cbd28c',.56],onion:['#d9b4c7','#ba8aa9','#f7dcdf',.62],
      smoke:['#9b4127','#89371f','#be6237',.28]
    };
    function interior(id){
      if(materials.has(id))return materials.get(id);
      const [base,dark,pale,roughness]=finishes[id],canvas=document.createElement('canvas');canvas.width=canvas.height=96;
      const c=canvas.getContext('2d');c.fillStyle=base;c.fillRect(0,0,96,96);
      let seed=43+id.length*8731;
      const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
      const count=id==='top'||id==='bottom'?190:id==='patty'?270:id==='tomato'?36:48;
      for(let i=0;i<count;i++){
        const r=.42+random()*(id==='patty'?2.7:2.1);c.fillStyle=random()<.46?dark:pale;c.globalAlpha=.25+.55*random();
        c.beginPath();c.ellipse(random()*96,random()*96,r,r*(.31+.52*random()),random()*Math.PI,0,2*Math.PI);c.fill();
      }
      if(id==='top'||id==='bottom'){
        for(let i=0;i<25;i++){
          const x=random()*96,y=random()*96,r=.8+random()*2.7,scale=.38+random()*.54,tilt=(random()-.5)*2;
          c.globalAlpha=.50;c.fillStyle=pale;c.beginPath();c.ellipse(x,y+.7,r*1.18,r*scale,tilt,0,Math.PI*2);c.fill();
          c.globalAlpha=.62;c.fillStyle=dark;c.beginPath();c.ellipse(x,y,r,r*scale,tilt,0,Math.PI*2);c.fill();
        }
      }
      const map=new T.CanvasTexture(canvas);map.encoding=T.sRGBEncoding;map.wrapS=map.wrapT=T.RepeatWrapping;
      const relief=id==='top'||id==='bottom'?.008:id==='patty'?.005:.0015;
      const mat=new T.MeshStandardMaterial({map,bumpMap:map,bumpScale:relief,roughness,side:T.DoubleSide});
      materials.set(id,mat);return mat;
    }
    function bakeNext(){
      if(closed)return;
      const job=pending.values().next().value;
      if(!job){timer=null;return;}
      pending.delete(job.key);
      const support=job.cheddar&&models.food('cheese',job.cheddar.grade,job.cheddar.relative).children[0].geometry;
      const mesh=models.food(job.id,job.grade,job.relative,support,job.cheeseToPatty).children[0];
      if(mesh){
        const piece=cutGeometry(T,mesh.geometry,job.stage,job.id,job.x,job.z);
        piece.custom=job.custom;pieces.set(job.key,piece);
      }
      timer=pending.size?global.setTimeout(bakeNext,24):null;
    }
    function shape(stack,i,faces,offsets){
      const id=stack[i],grade=id==='cheese'?(global.DinerCheeseMelt?.heat(stack[i-1],faces)||0):0;
      const [x,z]=offsets?.[i]||[0,0],below=offsets?.[i-1];
      if(id==='smoke'&&stack[i-1]==='cheese'){
        const cheddar=shape(stack,i-1,faces,offsets);
        const relative=[x-(below?.[0]||0),z-(below?.[1]||0)];
        const patty=stack[i-2]==='patty'?offsets?.[i-2]||[0,0]:null;
        const cheeseToPatty=patty?[(below?.[0]||0)-patty[0],(below?.[1]||0)-patty[1]]:null;
        const family=[id,cheddar.family,x,z,...relative,...(cheeseToPatty||[])].join('/');
        return {id,grade,x,z,cheddar,relative,cheeseToPatty,
          custom:x||z||cheddar.custom||cheeseToPatty?.some(v=>v!==0)?family:null,family};
      }
      const relative=grade?[x-(below?.[0]||0),z-(below?.[1]||0)]:null;
      const custom=x||z||relative?.some(v=>v!==0)?[id,grade,x,z,...(relative||[])].join('/'):null;
      return {id,grade,x,z,relative,custom,family:custom||id+'-'+grade};
    }
    function disposePiece(piece){
      for(const g of piece.variants||[])g.dispose();
      piece.outer.dispose();piece.cut?.dispose();
    }
    function retain(diners){
      const stamp=diners.map(d=>[d.stack.join('/'),(d.stackOffsets||[]).join('/'),(d.platedFaces||[]).join('/')].join('|')).join(';');
      if(stamp===roster)return;roster=stamp;
      // Centered cuts are shared indefinitely. Custom cuts and their seared
      // vertex colours belong only to meals still in the dining room.
      const active=new Set();
      for(const d of diners)for(let i=0;i<d.stack.length;i++)active.add(shape(d.stack,i,d.platedFaces,d.stackOffsets).custom);
      for(const [key,piece] of pieces)if(piece.custom&&!active.has(piece.custom)){disposePiece(piece);pieces.delete(key);}
      for(const [key,job] of pending)if(job.custom&&!active.has(job.custom))pending.delete(key);
    }
    function prepare(stack,stage,urgent,faces,offsets){
      if(stage<=0||stage>=6)return true;
      let ready=true;
      for(let i=0;i<stack.length;i++){
        const spec=shape(stack,i,faces,offsets),key=spec.family+'@'+stage;
        if(!finishes[spec.id]||pieces.has(key))continue;
        ready=false;
        if(!pending.has(key))pending.set(key,{...spec,stage,key,urgent});
        else if(urgent)pending.get(key).urgent=true;
      }
      // Finish needed display meshes ahead of speculative work. Each task
      // clips just one shared ingredient between interactive frames.
      if(urgent&&!ready){
        for(const [key,job] of [...pending])if(!job.urgent){pending.delete(key);pending.set(key,job);}
      }
      if(!ready&&timer===null)timer=global.setTimeout(bakeNext,0);
      return ready;
    }
    // Preserve the served patty's actual upper and lower sear. The baking
    // data remembers how each clipped vertex interpolates the original mesh.
    // Only colour varies with doneness; other GPU attributes remain shared.
    function pattySkin(piece,source){
      const cache=piece.skins??=new WeakMap();
      if(cache.has(source))return cache.get(source);
      const {from,to,blend}=piece.recipes,base=source.attributes.color.array;
      const col=new Float32Array(from.length*3);
      for(let i=0;i<from.length;i++){
        const a=from[i]*3,b=to[i]*3;
        for(let k=0;k<3;k++)col[i*3+k]=base[a+k]+(base[b+k]-base[a+k])*blend[i];
      }
      const g=new T.BufferGeometry();
      for(const [name,attr] of Object.entries(piece.outer.attributes))g.setAttribute(name,attr);
      g.setAttribute('color',new T.BufferAttribute(col,3));g.setIndex(piece.outer.index);
      g.boundingSphere=piece.outer.boundingSphere;cache.set(source,g);(piece.variants??=new Set()).add(g);return g;
    }
    function build(stack,stage,faces,offsets){
      const food=models.burger(stack,faces,offsets);
      for(const [i,layer] of food.children.entries()){
        const id=layer.name,mesh=layer.children[0];if(!mesh?.isMesh||!finishes[id])continue;
        const piece=pieces.get(shape(stack,i,faces,offsets).family+'@'+stage);
        const base=mesh.geometry;
        if(id==='patty'&&faces)global.DinerSearing?.finish?.(T,layer,faces);
        if(piece)mesh.geometry=piece.recipes&&mesh.geometry!==base?pattySkin(piece,mesh.geometry):piece.outer;
        if(piece?.cut){
          const cut=new T.Mesh(piece.cut,interior(id));cut.name='bite-'+id;cut.castShadow=true;cut.receiveShadow=true;layer.add(cut);
        }
      }
      return food;
    }
    function dispose(){
      closed=true;global.clearTimeout(timer);pending.clear();
      for(const piece of pieces.values())disposePiece(piece);pieces.clear();
      for(const mat of materials.values()){mat.map.dispose();mat.dispose();}materials.clear();
    }
    return {build,prepare,retain,dispose};
  }
  function create({T,models,parent,seats,routes,emptyTray,reduced}){
    const visitors=new Map(),point=new T.Vector3(),direction=new T.Vector3(),grip=new T.Vector3();
    const projected=new T.Vector3();
    let view=null,viewHeight=0,restoreFrame=0,nextRestore=0,latestInput=null,roomVisible=false;
    const meals=mealMeshes(T,models),crumbGeo=new T.IcosahedronGeometry(1,0);
    const crumbMat=new T.MeshLambertMaterial({color:0xb4834e});
    const clocks=global.DinerGame.mealTimes;
    function add(d,oldActor){
      const group=new T.Group();group.name='dining-table-'+d.table;parent.add(group);
      const tray=emptyTray.clone(true),socket=tray.getObjectByName('meal-position');
      group.add(tray);socket.clear(); // The live service tray can already carry a different order.
      const actor=oldActor||(global.DinerGuests?global.DinerGuests.customer(d.customer,models):models.customer(d.customer));
      group.add(actor);actor.scale.setScalar(1);actor.rotation.z=0;
      const crumbs=new T.Group();crumbs.name='crumbs';socket.add(crumbs);
      for(let n=0;n<8;n++){
        const crumb=new T.Mesh(crumbGeo,crumbMat),angle=n*2.4+d.customer*.34,distance=.073+(n%4)*.047;
        crumb.position.set(Math.cos(angle)*distance,.008,Math.sin(angle)*distance*.82);
        crumb.scale.set(.009+n%3*.002,.004,.007+n%2*.002);crumb.rotation.y=n*.71;crumbs.add(crumb);
      }
      return {group,tray,socket,actor,crumbs,customer:d.customer,stage:-1,time:-1,revision:-1,door:0,pose:'',food:null};
    }
    function remove(v){
      v.actor.userData.dispose?.();parent.remove(v.group);v.group.clear();
    }
    function level(v){
      if(!view||!v.actor.visible||!v.group.visible||!v.actor.userData.setDetailForHeight)return;
      v.actor.getWorldPosition(projected);projected.y+=1.35*v.actor.scale.y;projected.applyMatrix4(view.matrixWorldInverse);
      const pixels=2.69*v.actor.scale.y*viewHeight/(2*Math.tan(view.fov*Math.PI/360)*Math.max(.15,-projected.z));
      v.actor.userData.setDetailForHeight(pixels);
    }
    function detail(camera,height){view=camera;viewHeight=height;for(const v of visitors.values())level(v);}
    function show(v,d){
      const clock=clocks(d),t=d.seconds,seat=seats[d.table-1],route=routes[d.table-1];
      const part=Math.max(0,(Math.min(t,clock.leave)-3.7)/clock.cycle),beat=part%1;
      const leaving=clamp((t-clock.leave)/6.5),stand=smooth(leaving/.17),travel=clamp((leaving-.12)/.88);
      const eating=t<clock.done&&t<clock.leave;
      const stage=t<3.7?0:Math.min(6,Math.floor(part+.42));
      const lift=eating&&t>=3.7&&!reduced?(smooth((beat-.26)/.24)-smooth((beat-.67)/.24)):0;
      v.actor.visible=t<clock.exit;
      route.getPointAt(1-travel,point);route.getTangentAt(1-travel,direction);v.actor.position.copy(point);
      v.actor.rotation.y=mixAngle(-Math.sign(seat.x)*.15,Math.atan2(-direction.x,-direction.z),smooth(leaving/.26));
      v.pose=eating?'eating':'playing';
      const canLift=typeof v.actor.userData.mealAnchor==='function';
      if(!leaving)v.actor.userData.setVisitPose?.(canLift&&eating?'eat':'sit',canLift&&eating?t:0,canLift&&eating?lift:1);
      else if(stand<1)v.actor.userData.setVisitPose?.('sit',0,1-stand);
      else v.actor.userData.setVisitPose?.('walk',travel*route.getLength()*7.7,reduced?0:1);
      const clean=smooth((t-clock.exit)/Math.max(.01,clock.clear-clock.exit));
      const side=Math.sign(seat.x);
      v.tray.visible=clean<1;
      const lowered=smooth((clean-.68)/.32);
      v.tray.position.set(seat.x-side*.93*clean,1.027+.13*Math.sin(clean*Math.PI)-.57*lowered,seat.z+1.008+.18*clean);
      v.tray.rotation.set(.07*lowered,-.08*side,side*.06*lowered);
      const mealKey=d.stack.join('/')+'|'+(d.stackOffsets||[]).join('/')+'|'+(d.platedFaces||[]).join('/');
      if(v.mealKey!==mealKey){v.stage=-1;v.mealKey=mealKey;}
      const ready=meals.prepare(d.stack,stage,true,d.platedFaces,d.stackOffsets);
      v.waitingForBite=!ready;
      if(ready)meals.prepare(d.stack,stage+1,false,d.platedFaces,d.stackOffsets);
      // A restored booth remains visible while its shared cut meshes warm.
      // During normal dining the following bite is prepared several seconds early.
      const display=ready?stage:Math.max(0,v.stage);
      if(v.stage!==display){
        if(v.food)v.socket.remove(v.food);
        v.food=display<6?meals.build(d.stack,display,d.platedFaces,d.stackOffsets):null;
        if(v.food){
          v.food.name='meal-bites-'+display;v.food.scale.setScalar(.5);
          const box=new T.Box3().setFromObject(v.food);
          v.gripOffset=box.isEmpty()?0:(box.max.y-box.min.y)*.45;v.socket.add(v.food);
        }
        v.stage=display;
      }
      for(let k=0;k<v.crumbs.children.length;k++)v.crumbs.children[k].visible=k<stage+Math.floor(stage*.4);
      if(v.food){
        v.food.position.set(0,0,0);v.food.rotation.set(0,-.22+.064*stage,0);
        if(lift>0&&canLift&&v.actor.userData.mealAnchor(grip)){
          // The model provides its local grip rather than a hard-coded face height.
          v.actor.localToWorld(grip);v.socket.worldToLocal(grip);
          grip.y-=v.gripOffset;v.food.position.copy(grip).multiplyScalar(lift);
          v.food.rotation.x=.21*lift;
        }
        if(eating&&v.actor.userData.alignMealGrip){
          // Follow the served burger through the lift, including its tilt and
          // the height of the layers still on the tray after each bite.
          grip.set(0,v.gripOffset,0).applyQuaternion(v.food.quaternion).add(v.food.position);
          v.socket.localToWorld(grip);v.actor.worldToLocal(grip);
          v.actor.userData.alignMealGrip(grip);
        }
      }
      v.door=1.16*(smooth((leaving-.63)/.16)-smooth((leaving-.91)/.09));
      level(v);
    }
    function sync(input,visible,retiredActor){
      const diners=Array.isArray(input)?input:input?[input]:[],latest=diners.at(-1);
      latestInput=diners;roomVisible=visible;
      const active=new Set(diners.map(d=>d.table));
      for(const [table,v] of visitors)if(!active.has(table)){remove(v);visitors.delete(table);}
      meals.retain(diners);
      let door=0,restoredOne=false;
      for(const d of diners){
        let v=visitors.get(d.table);const handoff=d===latest?retiredActor:null;
        if(v&&v.customer!==d.customer){remove(v);visitors.delete(d.table);v=null;}
        if(!v){
          if(!visible&&!handoff)continue;
          // Space out rebuilding detailed patrons when a full dining room
          // is restored. Normal handoffs reuse the live actor immediately.
          if(!handoff&&(restoredOne||performance.now()<nextRestore)){
            if(!restoreFrame)restoreFrame=global.requestAnimationFrame(()=>{
              restoreFrame=0;sync(latestInput,roomVisible);
            });
            continue;
          }
          v=add(d,handoff);visitors.set(d.table,v);
          if(!handoff){restoredOne=true;nextRestore=performance.now()+24;}
        }
        v.group.visible=visible;if(!visible)continue;
        if(v.time!==d.seconds||v.revision!==v.actor.userData.revision||v.input!==d||v.waitingForBite){
          v.input=d;
          v.time=d.seconds;v.revision=v.actor.userData.revision;show(v,d);
        }
        door=Math.max(door,v.door);
      }
      return door;
    }
    function animate(t){for(const v of visitors.values())if(v.group.visible&&v.actor.visible)v.actor.userData.onFrame?.(t,reduced,v.pose);}
    function forTour(input){
      return (input||[]).map(d=>{
        let v=visitors.get(d.table);
        if(!v){v=add(d);visitors.set(d.table,v);v.group.visible=roomVisible;}
        if(v.time!==d.seconds||v.revision!==v.actor.userData.revision||v.waitingForBite){
          v.time=d.seconds;v.revision=v.actor.userData.revision;show(v,d);
        }
        return {table:d.table,customer:d.customer,actor:v.actor.visible?v.actor:null,tray:v.tray.visible?v.tray:null,
          bite:v.stage,food:v.food?.uuid,pending:v.waitingForBite,stack:d.stack.slice(),stackOffsets:d.stackOffsets};
      });
    }
    function dispose(){
      global.cancelAnimationFrame(restoreFrame);
      for(const v of visitors.values())remove(v);visitors.clear();meals.dispose();crumbGeo.dispose();crumbMat.dispose();
    }
    return {sync,animate,detail,forTour,dispose};
  }
  global.DinerDiningGuests={create};
})(window);
