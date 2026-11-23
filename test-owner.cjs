/* Check the owner through the same public factory used by the book and scene. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const dist = path.join(__dirname, 'burger', 'dist');
global.window = global;
const T = global.THREE = require(path.join(dist, 'vendor/three.min.js'));
for (const name of ['portrait-mesh','guest-faces','owner-uniform', 'owner-hands', 'owner-head', 'models']) require(path.join(dist, name));
const cast = require(path.join(dist, 'logic.js')).guests;
const owner = DinerModels.chef(), portrait = DinerModels.chef();
const node = name => owner.getObjectByName(name);
const vector = (x,y,z) => new T.Vector3(x,y,z);
const right = vector(.16,1.52,.37), left = vector(-.24,1.46,.35);
function worldVertexDistance(mesh, target) {
  const position = mesh.geometry.attributes.position;
  const point = new T.Vector3();
  let best = Infinity;
  for (let i=0; i<position.count; i++) {
    point.fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld);
    best = Math.min(best, point.distanceTo(target));
  }
  return best;
}
assert.equal(owner.name, 'house-chef');
assert(cast.length > 0);
assert(!cast.some(guest => guest.role === '店主兼主厨'));
owner.traverse(child => {
  if (!child.isMesh) return;
  const geo = child.geometry;
  assert(geo.index.count > 0);
  for (const att of ['position', 'normal', 'color']) {
    assert(geo.attributes[att].array.every(Number.isFinite), child.parent.name + ' ' + att);
  }
});
owner.updateMatrixWorld(true);
const face = owner.userData.portraitFaceBounds(new T.Box3());
const height = face.max.y-face.min.y;
assert(height > .40 && height < .70 && face.min.y > 1.9);
for(const k of [-1,1]){
  assert(node('restHand'+k).visible);
  assert(!node('hand'+k).children[0].visible);
  assert(!node('noteHand'+k).visible);
}
const gaps = {};
for(const writing of [true,false]){
  owner.userData.setVisitPose('walk',.25,.4);
  owner.userData.onFrame(1250,true,'playing');
  owner.userData.serviceHands(writing,left,right,.10);
  owner.updateMatrixWorld(true);
  for(const k of [-1,1]){
    const target = k===1 ? right : left;
    const hand = node('hand'+k), fingers = writing ? node('noteHand'+k).children[0] : hand.children[0];
    assert(hand.getWorldPosition(new T.Vector3()).distanceTo(target) < .0001);
    assert.equal(hand.children[0].visible,!writing);
    assert.equal(node('noteHand'+k).visible,writing);
    assert.equal(node('restHand'+k).visible,false);
    // In the production scene this point is the pencil/pad contact for the
    // writing pose, or the underside of the near tray rim when carrying.
    const contact = target.clone().add(writing?vector(-k*.055,.026,.040):vector(-k*.064,.025,0));
    const gap = worldVertexDistance(fingers, contact);
    gaps[(writing?'note':'tray')+k] = +gap.toFixed(4);
    assert(gap < .016, 'Finger surface too far from contact: '+gap);
  }
}
assert(portrait.getObjectByName('restHand1').visible);
const activeHead=node('head').children[0].geometry,secondHead=portrait.getObjectByName('head').children[0].geometry;
assert.equal(activeHead.index,secondHead.index);
assert.notEqual(activeHead.attributes.position,secondHead.attributes.position);
owner.userData.onFrame(0,true,'portrait');
assert.deepEqual(activeHead.attributes.position.array,secondHead.attributes.position.array);
owner.userData.setDetailForHeight(120);assert.equal(owner.userData.distant,true);
owner.userData.setDetailForHeight(250);assert.equal(owner.userData.distant,false);
console.log('Owner rig passed: facial bounds, separate instances, articulated hands, finite surfaces and near/far detail.', gaps);
