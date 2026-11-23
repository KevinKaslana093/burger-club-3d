'use strict';
const assert = require('node:assert/strict');
const {create, availableTips, smokePrice} = require('./burger/dist/logic.js');
const key = 'burger-club.shift.v1';
const special = ['bottom', 'patty', 'cheese', 'smoke', 'top'];

function savedGame(raw) {
  const values = new Map();
  if (raw) values.set(key, raw);
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key)
  };
}

function prepare(game) {
  game.tick(5);
  assert(game.act('take'));
  game.tick(3);
  assert(game.act('grill'));
  game.tick(7);
  assert(game.act('grill'));
  game.tick(7);
  assert(game.act('grill'));
}

function serve(game, omitSmoke = false) {
  for (const topping of game.state.recipe.slice(1)) {
    if (omitSmoke && topping === 'smoke') continue;
    assert(game.act('add', topping));
  }
  assert(game.act('serve'));
  assert(game.act('deliver', game.state.table));
  game.tick(4);
  return game.state.score;
}

const storage = savedGame();
let game = create({storage});
assert.equal(smokePrice, 12);
assert.equal(game.act('buySmoke'), false);
for (let n = 1; n <= 3; n++) {
  prepare(game);
  assert.equal(game.act('add', 'smoke'), false);
  assert.equal(serve(game).tip, 10);
  assert.equal(game.act('buySmoke'), false, 'settle the whole shift before purchasing');
  assert(game.act('next'));
}
const atClosing = storage.getItem(key);
const old = JSON.parse(atClosing);
delete old.state.smokeLaunchDay;
const legacy = create({storage: savedGame(JSON.stringify(old))});
assert.equal(legacy.state.phase, 'dayEnd');
assert.equal(availableTips(legacy.state), 30);
assert(legacy.act('next'));
assert.equal(legacy.state.customerName, '林舟');
assert.equal(legacy.state.smokeLaunchDay, 0);
assert(!legacy.state.recipe.includes('smoke'));
for (let n = 1; n <= 4; n++) {
  prepare(legacy);
  serve(legacy);
  assert(legacy.act('next'));
}
assert(legacy.act('buySmoke'), 'a skipped purchase remains available at a later closing');
assert.equal(legacy.state.smokeLaunchDay, 3);
assert(legacy.act('next'));
assert.equal(legacy.state.customerName, '阿乐');
assert.deepEqual(legacy.state.recipe, special);

const poorState = JSON.parse(atClosing);
poorState.state.dayTips = poorState.state.allTips = smokePrice - 1;
const poor = create({storage: savedGame(JSON.stringify(poorState))});
assert.equal(poor.act('buySmoke'), false);
assert(poor.act('next'), 'an unaffordable purchase must not block opening');
assert(!poor.state.recipe.includes('smoke'));

assert(game.act('buySmoke'));
assert.equal(game.act('buySmoke'), false);
assert.equal(game.state.smokeLaunchDay, 2);
assert.equal(game.state.allTips, 30);
assert.equal(availableTips(game.state), 18);
const purchased = storage.getItem(key);
const replay = create({storage: savedGame(purchased)});
assert(replay.act('restart'));
assert.equal(availableTips(replay.state), 0);
assert.equal(replay.state.smokeLaunchDay, 0);

game = create({storage});
assert.equal(game.act('buySmoke'), false, 'purchase survives reloading the settlement screen');
assert(game.act('next'));
assert.equal(game.state.customerName, '阿乐');
assert.deepEqual(game.state.recipe, special);
assert.equal(game.state.recipeName, '烟熏芝士堡');
prepare(game);
const missingSauce = serve(game, true);
assert.equal(missingSauce.build, 80);
assert(missingSauce.tip < 10);
assert(game.act('restart'));
assert.equal(game.state.day, 2);
assert.equal(availableTips(game.state), 18);
assert.deepEqual(game.state.recipe, special);
prepare(game);
for (const id of ['patty','cheese','smoke']) assert(game.act('add', id));
game = create({storage});
assert.deepEqual(game.state.stack, special.slice(0, -1));
assert.deepEqual(game.state.recipe, special);
assert(game.act('add','top'));
assert(game.act('serve'));
assert(game.act('deliver',game.state.table));
game.tick(4);
assert.equal(game.state.score.total, 100);
assert.equal(availableTips(game.state), 28);
assert(game.act('next'));
assert.deepEqual(game.state.previousDiner.stack, special);
assert.equal(game.state.smokeLaunchDay, 2);
assert(!game.state.recipe.includes('smoke'));

let sawReturn = false;
while (game.state.day <= 5) {
  if (game.state.customer === 0) {
    sawReturn = true;
    assert.deepEqual(game.state.recipe, special);
  }
  prepare(game);
  serve(game);
  assert(game.act('next'));
  if (game.state.phase === 'dayEnd') {
    assert.equal(game.act('buySmoke'), false);
    assert(game.act('next'));
  }
}
assert(sawReturn, 'a later visit can order the purchased special again');

(async () => {
  // Two tabs on an older shop may decide to buy the special at the same closing.
  const shared = savedGame(JSON.stringify(old));
  const owner = create({storage: shared, coordinated: true});
  const other = create({storage: shared, coordinated: true});
  assert.equal(other.act('buySmoke'), false);
  assert(owner.act('buySmoke'));
  assert.equal(availableTips(other.state), 18);
  assert(await other.session.takeControl());
  assert.equal(owner.act('buySmoke'), false);
  assert.equal(other.act('buySmoke'), false);
  assert(other.act('next'));
  assert.deepEqual(owner.state.recipe, special);
  assert.equal(availableTips(owner.state), 18);
  await other.session.close();
  await owner.session.close();
  console.log('Smoke special passed: purchase, skip, first and returning orders, scores, replay, old saves and tab takeover.');
})().catch(error => {console.error(error); process.exitCode = 1;});
