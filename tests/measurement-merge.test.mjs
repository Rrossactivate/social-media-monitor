import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeMeasurement, carryForward } from '../scripts/measurement-merge.mjs';
const early = '2026-10-08T08:00:00Z', late = '2026-10-08T09:00:00Z';
test('newer API observations replace older browser metrics', () => {
 const r = mergeMeasurement({views:10, source:'browser-verified', updatedAt:early}, {views:15, source:'youtube-api', updatedAt:late});
 assert.equal(r.views,15); assert.equal(r.metricVerifiedAt.views,late);
});
test('older high-priority observations cannot overwrite newer data', () => {
 const r = mergeMeasurement({audience:100,source:'x-api',verifiedAt:late,precision:'exact'}, {audience:90,source:'manual-override',verifiedAt:early,precision:'rounded'});
 assert.equal(r.audience,100); assert.equal(r.verifiedAt,late); assert.equal(r.precision,'exact');
});
test('partial views refresh leaves comment verification untouched', () => {
 const r = mergeMeasurement({views:10,comments:2,source:'browser-verified',updatedAt:early}, {views:20,source:'browser-verified',updatedAt:late});
 assert.equal(r.metricVerifiedAt.comments,early); assert.equal(r.metricVerifiedAt.views,late);
});
test('unavailable metrics preserve prior values and never become zero', () => {
 const r = mergeMeasurement({likes:3,source:'instagram-api',updatedAt:early}, {likes:null,source:'browser-verified',updatedAt:late,lastAttemptAt:late});
 assert.equal(r.likes,3); assert.equal(r.updatedAt,early); assert.equal(r.metricVerifiedAt.likes,early); assert.equal(r.lastAttemptAt,late);
});
test('explicit zero is a valid new measurement',()=>{
 assert.equal(mergeMeasurement({comments:2,source:'browser-verified',updatedAt:early},{comments:0,source:'x-api',updatedAt:late}).comments,0);
});
test('carry-forward retains observation date through repeated runs',()=>{
 const old={date:'2026-10-06',audience:3,source:'browser-verified',verifiedAt:early};
 const next=carryForward(carryForward(old,'2026-10-07',late),'2026-10-08',late);
 assert.equal(next.observedOn,'2026-10-06'); assert.equal(next.verifiedAt,early); assert.equal(next.precision,'stale');
});
test('legacy observation dates never become fabricated verification timestamps',()=>{
 const r=mergeMeasurement({date:'2026-10-07',audience:3,source:'browser-verified'},{date:'2026-10-08',audience:4,source:'x-api',verifiedAt:late});
 assert.equal(r.audience,4);
 const old=carryForward({date:'2026-10-07',audience:3,source:'browser-verified'},'2026-10-08',late);
 assert.equal(old.verifiedAt,undefined); assert.equal(old.observedOn,'2026-10-07');
});

test('unknown historical metric time remains unknown after multiple partial refreshes',()=>{
 const first=mergeMeasurement({comments:2,source:'browser-verified'}, {views:10,source:'x-api',updatedAt:early});
 const second=mergeMeasurement(first,{views:20,source:'x-api',updatedAt:late});
 assert.equal(second.metricVerifiedAt.comments,null);
});
