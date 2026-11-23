"use strict";
const assert = require("node:assert/strict");
const {create, names} = require("./burger/dist/logic.js");

function memoryStorage() {
  const data = new Map();
  return {
    getItem: key => data.get(key),
    setItem: (key, value) => data.set(key, value)
  };
}
function seatAndOrder(game) {
  assert.equal(game.act('take'), false);
  game.tick(5);
  assert.equal(game.state.visit, 'seated');
  assert.equal(game.act('take'), true);
  assert.equal(game.state.visit, 'ordering');
  game.tick(3);
}
function deliver(game) {
  assert.equal(game.act('serve'), true);
  assert.equal(game.act('serve'), false);
  assert.equal(game.act('station','build'), false);
  assert.equal(game.state.visit, 'carrying');
  assert.equal(game.act('deliver',game.state.table%4+1),false);
  assert.equal(game.act('deliver',game.state.table),true);
  assert.equal(game.state.visit, 'delivering');
  game.tick(4);
  assert.equal(game.state.phase, 'result');
}
function makePatty(game, a = 7, b = 7) {
  assert.equal(game.act("grill"), true);
  game.tick(a);
  assert.equal(game.act("grill"), true);
  game.tick(b);
  assert.equal(game.act("grill"), true);
  assert.equal(game.state.station, "build");
}
function finishOrder(game, side = 7) {
  seatAndOrder(game);
  assert.equal(game.act("take"), false);
  makePatty(game, side, side);
  assert.deepEqual(game.state.stack, ["bottom"]);
  for (const food of game.state.recipe.slice(1)) assert.equal(game.act("add", food), true);
  deliver(game);
  assert.equal(game.act("serve"), false);
}

const storage = memoryStorage();
let game = create({storage});
assert.ok(Object.values(names).every(name => typeof name === "string"));
assert.equal(game.act("serve"), false);
assert.equal(game.act("grill"), false);
assert.equal(game.act("station", "grill"), false);
assert.equal(game.act("next"), false);
const opening = game.state.recipe.join();
seatAndOrder(game);
game.act("grill");
game.tick(NaN);
game.tick(-2);
assert.equal(game.state.heatA, 0);
game.tick(6);
game = create({storage});
assert.equal(game.state.heatA, 66);
assert.equal(game.state.grillStage, "sideA");
game.act("grill");
game.act("station", "order");
game.tick(7);
assert.equal(game.state.heatB, 77);
game.act("station", "grill");
game.act("grill");
assert.equal(game.state.hasPatty, true);
assert.equal(game.act("add", "patty"), true);
assert.equal(game.act("add", "patty"), false);
assert.equal(game.act("add", "prototype"), false);
assert.equal(game.act("undo"), true);
assert.equal(game.state.hasPatty, true);
game.act("add", "patty");
game.act("add", "cheese");
game.act("station", "grill");
game.act("grill");
game.tick(7);
assert.equal(game.state.cookedQuality, 100);
assert.deepEqual(game.state.stack, ["bottom", "patty", "cheese"]);
game.act("grill");
game.tick(7);
game.act("grill");
game.act("add", "top");
assert.equal(game.act("add", "tomato"), false);
assert.equal(game.state.canServe, true);
deliver(game);
assert.deepEqual(game.state.score, {total: 100, cooking: 100, build: 100, alignment: 100, pace: 100, tip: 10});
game = create({storage});
assert.equal(game.state.phase, "result");
assert.equal(game.act("serve"), false);
game.act("next");
assert.notEqual(game.state.recipe.join(), opening);
finishOrder(game);
game.act("next");
finishOrder(game);
assert.equal(game.state.dayTips, 30);
assert.equal(game.act("next"), true);
assert.equal(game.state.phase, "dayEnd");
assert.equal(game.state.daysCompleted, 1);
game = create({storage});
assert.equal(game.state.phase, "dayEnd");
assert.equal(game.act("next"), true);
assert.equal(game.state.day, 2);
assert.equal(game.state.daySize, 4);
assert.equal(game.state.dayTips, 0);
assert.equal(game.state.allTips, 30);
finishOrder(game, 0);
assert.equal(game.state.score.cooking, 0);
assert.equal(game.state.score.build, 100);
game.act("restart");
assert.equal(game.state.phase, "waiting");
assert.equal(game.state.allTips, 30);
assert.equal(game.state.best, 100);
assert.equal(game.state.daysCompleted, 1);

seatAndOrder(game);
makePatty(game, 50, 50);
assert.equal(game.state.heatA, 100);
assert.equal(game.state.heatB, 100);
game.act("clear");
assert.deepEqual(game.state.stack, []);
assert.equal(game.act("add", "cheese"), false);
assert.equal(game.act("add", "bottom"), true);
assert.equal(game.act("add", "bottom"), false);
assert.equal(game.act("add", "patty"), true);
assert.equal(game.act("add", "top"), true);
game.tick(200);
deliver(game);
assert.ok(game.state.score.cooking < 100 && game.state.score.build < 100 && game.state.score.pace < 100);
assert.equal(create({storage: {getItem: () => "{"}}).state.phase, "waiting");
assert.equal(create({storage: {getItem: () => '{"v":1,"state":{}}'}}).state.day, 1);
const denied = create({storage: {getItem() { throw Error(); }, setItem() { throw Error(); }}});
finishOrder(denied);
assert.equal(denied.state.score.total, 100);

const marathon = create({storage: null});
for (let day = 1; day <= 10; day++) {
  for (let n = 1; n <= marathon.state.daySize; n++) {
    assert.equal(marathon.state.orderNo, n);
    assert.equal(marathon.state.day, day);
    finishOrder(marathon);
    assert.equal(marathon.state.score.total, 100);
    marathon.act("next");
  }
  assert.equal(marathon.state.phase, "dayEnd");
  marathon.act("next");
}
console.log("Diner game tests passed: grill timing, assembly, scoring, recovery, persistence and 10 complete shifts.");

// The guest, kitchen and payout must stay in sync across a reload during service.
{
  const storage=memoryStorage();
  let service=create({storage});
  const reload=expected=>{
    const {customer,table}=service.state;
    service=create({storage});
    assert.equal(service.state.visit,expected);
    assert.equal(service.state.customer,customer);
    assert.equal(service.state.table,table);
  };
  service.tick(1.25);
  reload('arriving');
  service.tick(4);
  reload('seated');
  service.act('take');service.tick(1.25);reload('ordering');
  service.tick(2);reload('dining');makePatty(service);
  service.act('add','patty');
  service.act('station','grill');makePatty(service,0,0);
  service.act('add','cheese');service.act('add','top');
  service.act('serve');reload('carrying');
  assert.equal(service.act('deliver',4),false);
  service.act('deliver',service.state.table);service.tick(1.4);reload('delivering');
  assert.equal(service.state.allTips,0);service.tick(4);reload('dining');
  assert.equal(service.state.score.cooking,100,'A later batch must not change the patty already on the bun');
  assert.deepEqual(service.state.platedFaces,[77,77]);
  service.tick(20);assert.equal(service.state.allTips,10);
  const key='burger-club.shift.v1',stored=JSON.parse(storage.getItem(key));
  for(const field of ['visit','visitProgress','cookedFaces','platedFaces','platedQuality','table'])delete stored.state[field];
  storage.setItem(key,JSON.stringify(stored));
  assert.equal(create({storage}).state.score.total,100);
}

// Recently served visitors occupy real, separate booths until their meals and
// departures finish. Saved meals are independent snapshots of previous orders.
{
  const storage=memoryStorage(),key='burger-club.shift.v1';
  let service=create({storage});
  for(let n=0;n<3;n++){finishOrder(service,0);service.act('next');}
  service.act('next'); // Open the four-order second shift.
  for(let n=0;n<3;n++){
    finishOrder(service,0);service.act('next');
    const diners=service.state.previousDiners;
    assert.equal(diners.length,n+1);
    assert.equal(new Set([service.state.table,...diners.map(v=>v.table)]).size,diners.length+1);
    assert.notEqual(diners.at(-1).stack,service.state.stack);
  }
  const before=structuredClone(service.state.previousDiners);
  assert.equal(before[0].leaveAt,undefined,'No other table is needed after the last order of the day');
  for(const d of before)assert.deepEqual(d.platedFaces,[0,0]);
  service=create({storage});assert.deepEqual(service.state.previousDiners,before);
  assert.equal(service.state.previousDiner,service.state.previousDiners.at(-1));
  const oldest=before[0],clock=require('./burger/dist/logic.js').mealTimes(oldest);
  service.tick(clock.clear-oldest.seconds-.1);
  assert(service.state.previousDiners.some(d=>d.table===oldest.table));
  service.tick(.11);assert(!service.state.previousDiners.some(d=>d.table===oldest.table));
  service.tick(1.1);service=create({storage});
  assert(!service.state.previousDiners.some(d=>d.table===oldest.table));
  const saved=JSON.parse(storage.getItem(key)),sample=service.state.previousDiners.at(-1);
  saved.state.previousDiners=[{...sample,seconds:1},{...sample,seconds:9},{...sample,table:saved.state.table},{...sample,table:3,seconds:900}];
  storage.setItem(key,JSON.stringify(saved));service=create({storage});
  assert.equal(service.state.previousDiners.length,1);assert.equal(service.state.previousDiner.seconds,9);
  delete saved.state.previousDiners;saved.state.previousDiner={...sample,seconds:43};
  storage.setItem(key,JSON.stringify(saved));service=create({storage});
  assert.equal(service.state.previousDiners.length,1);
  assert(service.state.previousDiner.seconds>=require('./burger/dist/logic.js').mealTimes(service.state.previousDiner).leave);
  service.tick(8);assert.equal(service.state.previousDiner,null);
  service.act('restart');assert.deepEqual(service.state.previousDiners,[]);
}
{
  const service=create({storage:null});
  while(service.state.day<3){
    if(service.state.phase!=='dayEnd')finishOrder(service,0);
    service.act('next');
  }
  for(let i=0;i<3;i++){finishOrder(service,0);service.act('next');}
  const oldest=service.state.previousDiners[0];
  assert.equal(oldest.table,service.state.table%4+1);
  assert(oldest.leaveAt<=oldest.seconds+1.81,'Schedule departure only when the next order needs that booth');
  finishOrder(service,0);service.act('next');
  assert.equal(service.state.table,oldest.table);
  assert(!service.state.previousDiners.some(d=>d.table===service.state.table));
}
console.log("Retained diner tests passed: simultaneous seats, save migration, departure, cleanup and restart.");
// Seated waiting costs the same service time before and after a reload, even on the first table.
{
  function runTimedOrder(wait){
    const db=memoryStorage();let service=create({storage:db});service.tick(4.8);
    service.tick(wait);service=create({storage:db});assert.equal(service.state.elapsed,wait);
    service.act('take');service.tick(2.8);makePatty(service);
    for(const id of service.state.recipe.slice(1))assert(service.act('add',id));
    deliver(service);assert.equal(service.state.elapsed,wait+14);
    const score=service.state.score;assert.equal(create({storage:db}).state.allTips,score.tip);
    assert(service.act('next'));assert.equal(service.state.elapsed,0);return score;
  }
  const fast=runTimedOrder(0),slow=runTimedOrder(120);
  assert.deepEqual([fast.pace,fast.total,fast.tip],[100,100,10]);
  assert.deepEqual([slow.pace,slow.total,slow.tip],[33,90,7]);
  console.log('Seated waits 0s / 120s: pace 100 / 33, total 100 / 90, tips 10 / 7.');
}

// A drop stores the signed displacement, while symmetry around the plate
// centre means the same miss to the left or right scores equally.
async function layerPlacement() {
  const key = 'burger-club.shift.v1';
  function start(db) {
    const g = create({storage: db, coordinated: true});
    seatAndOrder(g);makePatty(g);
    return g;
  }
  for (const dx of [-.20, .20, .045]) {
    const g = start(memoryStorage());
    const input = [dx, 0];
    assert(g.act('add', 'patty', input));
    input[0] = 0;
    assert(g.act('add', 'cheese'));assert(g.act('add', 'top'));
    assert.deepEqual(g.state.stackOffsets, [[0,0],[dx,0],[0,0],[0,0]]);
    deliver(g);
    const centered = dx === .045;
    assert.deepEqual(g.state.score, {
      total: centered ? 100 : 91, cooking: 100, build: 100, alignment: centered ? 100 : 53,
      pace: 100, tip: centered ? 10 : 8
    });
    await g.session.close();
  }

  const db = memoryStorage(), first = start(db);
  const extreme = {x: 3, z: 4};
  assert(first.act('add', 'patty', extreme));
  assert(Math.abs(Math.hypot(...first.state.stackOffsets[1]) - .22) < 1e-14);
  assert(Math.abs(first.state.stackOffsets[1][0] - .132) < 1e-14);
  assert(first.act('undo'));assert.deepEqual(first.state.stackOffsets, [[0,0]]);
  assert(first.act('clear'));assert.deepEqual(first.state.stackOffsets, []);
  assert(first.act('add', 'bottom', [-.17,.12]));
  assert(first.act('add', 'patty', [-.20,0]));
  assert(first.act('station','grill'));makePatty(first);
  assert.deepEqual(first.state.stackOffsets, [[0,0],[-.20,0]], 'a second patty must not move the plated layers');
  const second = create({storage:db, coordinated:true});
  assert.equal(await second.session.takeControl(), true);
  assert.equal(first.act('add','cheese',[.12,0]),false);
  assert(second.act('add', 'cheese', [.20,0]));assert(second.act('add','top',[NaN,0]));
  const positions = [[0,0],[-.20,0],[.20,0],[0,0]];
  assert.deepEqual(second.state.stackOffsets, positions);
  deliver(second);
  assert.equal(second.state.score.alignment, 32, 'opposite offsets must not cancel');
  assert(second.act('next'));
  assert.deepEqual(second.state.stackOffsets, []);
  assert.deepEqual(second.state.previousDiner.stackOffsets, positions);
  finishOrder(second);assert(second.act('next'));
  assert.deepEqual(second.state.previousDiners[0].stackOffsets, positions);
  assert(second.state.previousDiners[1].stackOffsets.every(([x,z])=>x===0&&z===0));
  const latest = create({storage:db, coordinated:true});
  assert.deepEqual(latest.state.previousDiners[0].stackOffsets, positions);
  await latest.session.close();await second.session.close();await first.session.close();

  const oldDb = memoryStorage(), legacyGame = create({storage:oldDb});
  finishOrder(legacyGame);
  const archived = JSON.parse(oldDb.getItem(key));
  const originalScore = {total:93,cooking:100,build:100,pace:33,tip:8};
  delete archived.state.stackOffsets;
  archived.state.score = originalScore;
  archived.state.dayTips = archived.state.allTips = 8;
  oldDb.setItem(key, JSON.stringify(archived));
  const restored = create({storage:oldDb});
  assert.deepEqual(restored.state.stackOffsets, restored.state.stack.map(()=>[0,0]));
  assert.deepEqual(restored.state.score, originalScore, 'retain old settled scores and tips verbatim');
  assert.equal(restored.state.allTips,8);
  await restored.session.close();await legacyGame.session.close();

  const prepDb = memoryStorage(), olderPrep = create({storage:prepDb});
  seatAndOrder(olderPrep);makePatty(olderPrep);assert(olderPrep.act('add','patty'));
  const prep = JSON.parse(prepDb.getItem(key));
  delete prep.state.stackOffsets;
  prep.state.previousDiners = [{customer:2,table:2,stack:['bottom','top'],seconds:1}];
  prepDb.setItem(key, JSON.stringify(prep));
  const reloadedPrep = create({storage:prepDb});
  assert.deepEqual(reloadedPrep.state.stackOffsets, [[0,0],[0,0]]);
  assert.deepEqual(reloadedPrep.state.previousDiner.stackOffsets, [[0,0],[0,0]]);
  assert(reloadedPrep.act('add','cheese',[0,-.16]));
  assert.deepEqual(JSON.parse(prepDb.getItem(key)).state.stackOffsets[2], [0,-.16]);
  await reloadedPrep.session.close();await olderPrep.session.close();
  console.log('Layer placement passed: radial score, signed offsets, editing, new patties, multi-table saves, takeover and legacy receipts.');
}
layerPlacement().catch(error=>{console.error(error);process.exitCode=1;});

async function waitingLine() {
  const key='burger-club.shift.v1', db=memoryStorage(), make=()=>create({storage:db,coordinated:true});
  const original=make(), other=make();
  seatAndOrder(original);
  original.tick(10);
  assert.equal(original.state.waitingGuest,null);
  assert.equal(original.state.nextGuestIn,1);
  other.tick(100);
  assert.equal(original.state.nextGuestIn,1,'a paused or observing window cannot run the queue');
  original.tick(1.5);
  const entrant={day:1,orderNo:2,customer:1,seconds:.5};
  assert.deepEqual(original.state.waitingGuest,entrant);
  assert.equal(original.act('take'),false);
  assert(await other.session.takeControl());
  assert.deepEqual(other.state.waitingGuest,entrant);
  original.tick(60);
  other.tick(240);
  assert.equal(other.state.waitingGuest.seconds,240.5);
  assert.equal(other.state.customer,0);
  makePatty(other);
  for(const id of other.state.recipe.slice(1))assert(other.act('add',id));
  deliver(other);
  const queueAtReview=structuredClone(other.state.waitingGuest);
  other.tick(555);
  assert.deepEqual(other.state.waitingGuest,queueAtReview);
  assert(other.act('next'));
  assert.equal(other.state.customer,entrant.customer);
  assert.equal(other.state.orderNo,entrant.orderNo);
  assert.equal(other.state.table,2);assert.equal(other.state.queueEntryProgress,1);
  assert.equal(other.state.elapsed,0);assert.equal(other.state.waitingGuest,null);
  assert.equal(other.state.visit,'arriving');assert.equal(other.act('take'),false);
  finishOrder(other);
  assert.equal(other.state.score.pace,100,'time before the player could seat the guest must not penalize this order');
  assert(other.act('next'));
  assert.equal(other.state.orderNo,3);assert.equal(other.state.nextGuestIn,null);
  seatAndOrder(other);other.tick(150);
  assert.equal(other.state.waitingGuest,null,'no queue is formed after the last ticket');
  assert(other.act('restart'));assert.equal(other.state.queueEntryProgress,null);
  await Promise.all([other.session.close(),original.session.close()]);

  // If the ticket finishes while the new guest is still walking to the line,
  // seating starts from their exact point on that approach, including on reload.
  const store=memoryStorage(), short=create({storage:store});
  seatAndOrder(short);makePatty(short,0,8);
  for(const id of short.state.recipe.slice(1))assert(short.act('add',id));
  deliver(short);
  assert(Math.abs(short.state.waitingGuest.seconds-.6)<1e-6);
  const saved=JSON.parse(store.getItem(key));
  const resumed=create({storage:store});assert(resumed.act('next'));
  assert(Math.abs(resumed.state.queueEntryProgress-.25)<1e-6);
  const onRoute=create({storage:store});assert.equal(onRoute.state.queueEntryProgress,resumed.state.queueEntryProgress);
  onRoute.tick(5);assert.equal(onRoute.state.queueEntryProgress,null);
  // Old saved reviews and malformed optional queue data can still advance from the street.
  for(const pending of [undefined,{day:1,orderNo:99,customer:0,seconds:20}]){
    saved.state.waitingGuest=pending;delete saved.state.nextGuestIn;delete saved.state.queueEntryProgress;
    store.setItem(key,JSON.stringify(saved));
    const old=create({storage:store});assert.equal(old.state.waitingGuest,null);
    assert(old.act('next'));assert.equal(old.state.queueEntryProgress,null);
  }
  const quick=create({storage:null});finishOrder(quick,0);
  assert.equal(quick.state.waitingGuest,null);assert(quick.act('next'));
  assert.equal(quick.state.queueEntryProgress,null);
  console.log('Waiting line passed: scheduled entry, first-in seating, interrupted approach, fast service, long waits, old saves, takeover and closing.');
}
waitingLine().catch(error=>{console.error(error);process.exitCode=1;});
