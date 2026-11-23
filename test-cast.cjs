/* Run the real customer factory through the near/far service poses. */
'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const dist=path.join(__dirname,'burger','dist');
global.window=global;
const T=global.THREE=require(path.join(dist,'vendor/three.min.js'));
for(const module of ['portrait-mesh','hand-form','guest-faces','guest-hair','footwear','guest-wardrobe','guest-cloth','models'])require(path.join(dist,module));
const guests=require(path.join(dist,'logic.js')).guests;
function checkGrasp(person,name,center){
  person.updateMatrixWorld(true);
  for(const side of [-1,1]){
    const mealFore=person.getObjectByName('mealFore'+side);
    const sleeve=person.getObjectByName('fore'+side).children[0];
    if(mealFore){
      assert.equal(mealFore.visible,true,name+' meal hand should be visible');
      assert.equal(sleeve.visible,false,name+' prop grip should be hidden');
    }
    const mesh=mealFore?.children[0]||sleeve;
    const palm=person.worldToLocal(mesh.localToWorld(new T.Vector3(.324*side,.974,.069)));
    const radius=(palm.x-center.x)*side;
    assert(radius>.246&&radius<.284,name+' palm should meet the bun rim');
    assert(Math.abs(palm.y-center.y)<.055,name+' palm should follow the burger height');
    assert(palm.z>center.z,name+' fingers should reach around the front');
  }
}
for(let index=2;index<guests.length;index++){
  const person=DinerModels.customer(index);
  const high=new Map();
  person.traverse(mesh=>{
    if(mesh.isMesh)high.set(mesh,mesh.geometry);
  });
  for(const pixels of [320,115,300]){
    person.userData.setDetailForHeight(pixels);
    for(const [mesh,original] of high){
      const g=mesh.geometry;
      if(pixels>200)assert.equal(g,original);
      else assert(g.index.count<=original.index.count);
      for(const attribute of Object.values(g.attributes))assert(attribute.array.every(Number.isFinite),mesh.parent.name);
      if(original.attributes.uv)assert.equal(g.attributes.uv.count,g.attributes.position.count);
      assert(g.index.array.every(i=>i>=0&&i<g.attributes.position.count));
    }
    for(const [pose,phase,amount] of [['walk',1,.85],['wait',.6,.8],['sit',0,.48],['sit',0,1],['eat',8,.65]]){
      person.userData.setVisitPose(pose,phase,amount);
      person.userData.onFrame(1600,false,pose==='eat'?'eating':'waiting');
      person.updateMatrixWorld(true);
      assert([...high.keys()].every(mesh=>mesh.matrixWorld.elements.every(Number.isFinite)),guests[index].name+' '+pose);
      if(pose==='eat'){
        const grip=new T.Vector3();
        assert(person.userData.mealAnchor(grip));
        checkGrasp(person,guests[index].name,grip);
        const onTheWay=grip.clone().add(new T.Vector3(.012,-.09,.065));
        person.userData.alignMealGrip(onTheWay.clone());
        person.userData.onFrame(1700,false,'eating');
        checkGrasp(person,guests[index].name,onTheWay);
        const ideal=new T.Vector3();
        person.userData.mealAnchor(ideal);
        assert(ideal.distanceTo(grip)<1e-6,'hand correction must preserve the burger trajectory');
      }
    }
  }
  if([9,11,12].includes(index)){
    const parked=person.getObjectByName('parkedProps');
    const prop=person.getObjectByName(({9:'camera',11:'bouquet',12:'sleeve'})[index]);
    assert.equal(prop.parent,parked,guests[index].name+' should put the prop down to eat');
    person.userData.setVisitPose('sit',0,1);
    person.userData.onFrame(1700,false,'waiting');
    assert.equal(parked.children.length,0);
    assert.equal(prop.parent,person.getObjectByName('fore'+(index===9?1:-1)));
    for(const side of [-1,1]){
      const mealFore=person.getObjectByName('mealFore'+side);
      if(!mealFore)continue;
      assert.equal(mealFore.visible,false);
      assert.equal(person.getObjectByName('fore'+side).children[0].visible,true);
    }
  }
  for(const part of ['body','head','hair','arm1','shin1']){
    const geo=person.getObjectByName(part).children[0].geometry;
    assert(geo.attributes.uv,guests[index].name+' lacks texture coordinates on '+part);
  }
}
console.log('All eleven tailored rigs passed five poses, grip anchors, UVs, finite normals and near/far detail switching.');

// Slow image decoding must leave vertex pigment visible on the first frame.
const loaders=new Map();
const browserThree={...T,TextureLoader:class {
  load(url,ready){assert(!loaders.has(url));loaders.set(url,ready);}
}};
global.document={};
global.dispatchEvent=()=>{};
const sample=new T.BoxGeometry(.1,.1,.1),pos=sample.attributes.position;
sample.setAttribute('color',new T.Float32BufferAttribute(new Float32Array(pos.count*3).fill(.8),3));
DinerGuestCloth.fit(2,{body:sample},T,'#DBA186');
for(const [name,file] of [['body','textiles.jpg'],['hair','grooms.png']]){
  const base=new T.MeshStandardMaterial({vertexColors:true});
  const finish=DinerGuestCloth.material(sample,base,browserThree,name);
  assert.equal(finish.map,null);
  assert.equal(finish.vertexColors,true);
  const texture=new T.Texture();
  loaders.get('art/guest-'+file)(texture);
  assert.equal(finish.map,texture);
  assert(finish.version>0);
  assert.equal(DinerGuestCloth.material(sample,base,browserThree,name),finish);
  const later=DinerGuestCloth.material(sample,base.clone(),browserThree,name);
  assert.equal(later.map,texture);
}
console.log('Garments and hair retain their painted base until each texture finishes loading.');
