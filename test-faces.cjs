const path=require('node:path'),assert=require('node:assert/strict');
const dist=path.join(__dirname,'burger/dist');
global.window=global;global.THREE=require(path.join(dist,'vendor/three.min.js'));
for(const name of ['portrait-mesh','guest-faces','guest-hair','guest-wardrobe','guest-cloth','models'])require(path.join(dist,name));
const rows=[];
for(let i=2;i<=12;i++){
 const first=DinerModels.customer(i),other=DinerModels.customer(i);
 const all=['head','eyes1','iris1','mouth'];
 const geo=(p,k)=>p.getObjectByName(k).children[0].geometry;
 for(const k of all){if(geo(first,k).userData.portraitAnimated)assert.notEqual(geo(first,k),geo(other,k));}
 first.userData.onFrame(0,true,'waiting');
 const neutral=all.map(k=>geo(first,k).attributes.position.array.slice());
 const max=(p,k,n)=>geo(p,k).attributes.position.array.reduce((v,x,j)=>Math.max(v,Math.abs(x-n[j])),0);
 first.userData.onFrame(4510-413*i+4760,false,'waiting');
 const closed=all.map((k,j)=>max(first,k,neutral[j]));
 assert(closed[0]>.015);
 for(let j=0;j<all.length;j++)assert.equal(max(other,all[j],neutral[j]),0);
 first.userData.onFrame(0,true,'waiting');
 for(let j=0;j<all.length;j++)assert.equal(max(first,all[j],neutral[j]),0);
 first.userData.onFrame((Math.PI/2-i*.79+8*Math.PI)/4.1*1000,false,'eating');
 const bite=max(first,'mouth',neutral[3]);assert(bite>.0005);
 rows.push({index:i,blinkPeak:closed[0],oralDeformation:bite,sharedPoseLeak:false});
}
console.log(rows.length,'independent live facial rigs, closed/open and chewing verified.');

