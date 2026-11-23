'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
const dir=path.resolve(__dirname,'../burger/dist');
global.window=global;const T=global.THREE=require(path.join(dir,'vendor/three.min.js'));
for(const file of ['food-detail.js','cheese-melt.js','models.js','placement.js'])require(path.join(dir,file));
const models=DinerModels,cold=models.food('cheese'),meat=models.food('patty'),hot=models.food('cheese',4);
const geo=n=>n.children[0].geometry;
const bounds=n=>{const g=geo(n);g.computeBoundingBox();return g.boundingBox;};
assert.equal(DinerCheeseMelt.heat('patty',[77,77]),4);assert.equal(DinerCheeseMelt.heat('patty',[0,0]),0);
assert.equal(DinerCheeseMelt.heat('patty',null),0);assert(DinerCheeseMelt.heat('patty',[15,90])<DinerCheeseMelt.heat('patty',[90,15]));
for(const s of ['tomato','onion','cheese','bottom',null])assert.equal(DinerCheeseMelt.heat(s,[100,100]),0);
assert.equal(geo(models.food('cheese')),geo(cold));assert.equal(geo(hot),geo(models.food('cheese',4)));
const sequence=['bottom','patty','cheese','tomato','cheese','top'],burger=models.burger(sequence,[77,77]);
assert.deepEqual(burger.children.filter(n=>n.name==='cheese').map(n=>n.userData.melt),[4,0]);
assert.deepEqual(models.burger(sequence).children.filter(n=>n.name==='cheese').map(n=>n.userData.melt),[0,0]);
const yMin=[];
for(let g=0;g<=4;g++){const slice=models.food('cheese',g),b=bounds(slice);yMin.push(b.min.y);assert(b.max.y<=.0321);assert.equal(slice.children.length,1);}
assert(yMin.every((v,i)=>i===0||v<yMin[i-1]));assert(yMin[0]>0&&yMin.at(-1)<-.065);
// Compare the actual slice to triangles on the existing seared patty using rays.
const ray=new T.Raycaster(),origin=new T.Vector3(),down=new T.Vector3(0,-1,0);
const p=geo(hot).attributes.position,lower=geo(hot).attributes.normal;meat.updateMatrixWorld(true);
let deepest=0,hits=0;
for(let i=0;i<p.count;i+=5){
 if(lower.getY(i)>-.45)continue;
 ray.set(origin.set(p.getX(i),1,p.getZ(i)),down);
 const hit=ray.intersectObject(meat,true)[0];if(!hit)continue;
 deepest=Math.max(deepest,hit.point.y-(p.getY(i)+.145));hits++;
}
assert(hits>80);assert(deepest<.017,'Cheese must contact the patty without visibly intersecting its crown: '+deepest);
// Real placement keeps the prep-bin copy flat. Melting begins on contact,
// independently of the gameplay readiness promise, and undo discards the slice.
const stack=new T.Group(),scene=new T.Scene();scene.add(stack);
const api=DinerPlacement.create(T,models,stack,null,false,()=>{},()=>({faces:[77,77]}));
api.change(sequence.slice(0,2),false);api.change(sequence.slice(0,3),true);
const placed=stack.children.find(n=>n.name==='cheese');
let contact=false;api.setListener(()=>contact=true);
while(!contact)api.advance(1/120);
const age0=bounds(placed).min.y;
for(let i=0;i<33;i++)api.advance(1/120);
const settling=bounds(placed).min.y;api.pause(true);const paused=geo(placed).attributes.position.array.slice();
api.advance(.35);assert.deepEqual(geo(placed).attributes.position.array,paused);api.pause(false);
while(api.busy())api.advance(1/120);
assert(api.animating(),'Visual softening must not block handing over the meal');
while(api.animating())api.advance(1/120);
assert.equal(geo(placed),geo(hot));assert(age0>yMin[4]+.045);assert(settling>yMin[4]+.01);
api.change(sequence.slice(0,2),true);assert(!stack.children.some(n=>n.name==='cheese'));
api.change(sequence.slice(0,3),true);api.advance(.11);api.change(sequence.slice(0,2),true);
assert(!api.animating());assert.equal(bounds(cold).min.y,yMin[0]);api.dispose();
console.log(JSON.stringify({yMin,lowerSurfaceSamples:hits,maxPattyIntersection:deepest,firstContact:age0,after275ms:settling}));
