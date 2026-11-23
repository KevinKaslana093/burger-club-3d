'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const dist=path.join(__dirname,'burger','dist');
global.window=global;
const T=global.THREE=require(path.join(dist,'vendor/three.min.js'));
for(const id of ['food-detail','cheese-melt','models','placement'])require(path.join(dist,id));
const models=DinerModels,ids=['bottom','patty','cheese','smoke','top'];
const ray=new T.Raycaster(),up=new T.Vector3(),down=new T.Vector3(0,-1,0);
let samples=0,worstGap=0;
for(const [heat,shift] of [[0,0],[75,0],[75,.16],[75,-.18]]){
  const offsets=[[0,0],[0,0],[-shift*.5,shift*.25],[shift,0],[0,0]];
  const burger=models.burger(ids,[heat,heat],offsets);
  burger.updateMatrixWorld(true);
  const [base,patty,cheese,sauce,top]=burger.children;
  assert.deepEqual(burger.children.map(n=>n.name),ids);
  const geo=sauce.children[0].geometry,p=geo.attributes.position;
  assert(p.array.every(Number.isFinite)&&geo.attributes.normal.array.every(Number.isFinite));
  assert(geo.userData.nozzleSides>0&&sauce.children[0].material.roughness<.30);
  const sides=geo.userData.nozzleSides,rows=p.count/sides-1;
  for(let j=5;j<rows-4;j+=5){
    // At three quarters of a cross-section we hit the underside of the bead.
    const i=j*sides+sides*3/4;
    const v=sauce.localToWorld(new T.Vector3().fromBufferAttribute(p,i));
    up.set(v.x,1,v.z);ray.set(up,down);
    const support=ray.intersectObjects([cheese.children[0],patty.children[0]]);
    if(!support.length)continue;
    const gap=Math.abs(v.y-support[0].point.y);
    // At the edge the drizzle folds gradually over the seared shoulder.
    if(Math.hypot(v.x-patty.position.x,v.z-patty.position.z)<.39){
      samples++;worstGap=Math.max(worstGap,gap);
      assert(gap<.029,'sauce detached from support by '+gap);
    }
  }
  assert(top.position.y-sauce.position.y<.025);
}
assert(samples>75);
const stack=new T.Group(),bottle=new T.Group();bottle.userData.stocked=true;
const asm=DinerPlacement.create(T,models,stack,new T.Texture(),false,()=>{},
  ()=>({faces:[75,75],source:id=>id==='smoke'?bottle:null}));
asm.change(ids.slice(0,3),false);
const contacts=[];asm.setListener(id=>contacts.push(id));
asm.change(ids.slice(0,4),true);
const placed=stack.getObjectByName('smoke'),live=placed.children[0].geometry;
assert.equal(live.drawRange.count,0);
asm.advance(.32);
assert(live.drawRange.count>0&&live.drawRange.count<live.index.count);
assert(placed.parent.getObjectByName('dispensing-nozzle'));
assert.equal(bottle.visible,false);
asm.advance(.60);
assert.deepEqual(contacts,['smoke']);
assert.equal(bottle.visible,true);
assert.notEqual(placed.children[0].geometry,live);
assert.equal(asm.busy(),false);
asm.change(ids.slice(0,3),false);asm.change(ids.slice(0,4),true);asm.advance(.1);
asm.change(ids.slice(0,3),false);assert.equal(bottle.visible,true);assert.equal(asm.busy(),false);
asm.dispose();
console.log('Smoke sauce contact samples:',samples,'max central gap:',worstGap.toFixed(4),'partial pour, finish and cancellation passed.');
