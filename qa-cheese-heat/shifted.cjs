'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),root=path.join(__dirname,'../burger/dist');
global.window=global;const T=global.THREE=require(path.join(root,'vendor/three.min.js'));
for(const n of ['food-detail.js','cheese-melt.js','models.js'])require(path.join(root,n));
const base=DinerModels.food('cheese').children[0],meat=DinerModels.food('patty').children[0];
meat.updateMatrixWorld(true);const ray=new T.Raycaster(),down=new T.Vector3(0,-1,0),origin=new T.Vector3();
for(const [dx,dz] of [[0,0],[-.20,0],[.20,0],[.15,.15],[-.28,.27],[.44,0]]){
 const mesh=DinerCheeseMelt.form(T,base,meat,4,.145,[dx,dz]),geo=mesh.geometry;
 const p=geo.attributes.position,n=geo.attributes.normal;let worst=0,penetrating=0,examined=0;
 for(let i=0;i<p.count;i+=5){
  if(n.getY(i)>-.45)continue;
  ray.set(origin.set(dx+p.getX(i),1,dz+p.getZ(i)),down);const hit=ray.intersectObject(meat)[0];
  if(!hit)continue;examined++;const penetration=hit.point.y-(p.getY(i)+.145);
  if(penetration>.004)penetrating++;worst=Math.max(worst,penetration);
 }
 console.log(JSON.stringify({dx,dz,examined,penetrating,worst:+worst.toFixed(5),minY:+geo.boundingBox.min.y.toFixed(3)}));
 assert.ok(examined>=75);
 assert.equal(penetrating,0,'hot cheese intersects the patty by more than .004 model units');
 assert.ok(geo.boundingBox.min.y>=-.145,'edge crossed the lower bun');
}
