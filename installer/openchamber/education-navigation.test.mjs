import test from 'node:test';
import assert from 'node:assert/strict';
import { createEducationNavigation } from './education-navigation.mjs';
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
function fixture(overrides={}) {
 const calls=[];
 const navigate=createEducationNavigation({ready:async()=>({url:'http://127.0.0.1:1234'}),load:async u=>calls.push(['load',u]),route:async u=>calls.push(['route',u]),show:()=>calls.push(['show']),chat:()=>calls.push(['chat']),alive:()=>true,failed:async e=>calls.push(['error',e.message]),...overrides});
 return {calls,navigate};
}
test('rapid first clicks load only the last requested area',async()=>{
 const {calls,navigate}=fixture();await Promise.all(['library','atlas','create','library'].map(navigate));
 assert.deepEqual(calls,[['load','http://127.0.0.1:1234/library'],['show']]);
});
test('click during document loading waits and routes without a second load',async()=>{
 const gate=deferred(),entered=deferred();let loads=0;
 const {calls,navigate}=fixture({load:async()=>{loads++;entered.resolve();await gate.promise;}});
 const first=navigate('library');await entered.promise;const second=navigate('atlas');gate.resolve();await Promise.all([first,second]);
 assert.equal(loads,1);assert.deepEqual(calls,[['route','/atlas'],['show']]);
});
test('returning to chat while loading does not reopen education',async()=>{
 const gate=deferred(),entered=deferred();const {calls,navigate}=fixture({load:async()=>{entered.resolve();await gate.promise;}});
 const first=navigate('library');await entered.promise;await navigate('chat');gate.resolve();await first;
 assert.deepEqual(calls,[['chat']]);await navigate('atlas');assert.deepEqual(calls.slice(1),[['route','/atlas'],['show']]);
});
test('a real failure is reported and a later click retries',async()=>{
 let attempt=0;const {calls,navigate}=fixture({load:async()=>{if(!attempt++)throw Error('unavailable');}});
 await assert.rejects(navigate('library'),/unavailable/);await navigate('library');assert.equal(attempt,2);assert.deepEqual(calls,[['error','unavailable'],['show']]);
});
test('closed window is not touched after service startup',async()=>{
 const gate=deferred(),entered=deferred();let alive=true;
 const {calls,navigate}=fixture({alive:()=>alive,ready:async()=>{entered.resolve();await gate.promise;return {url:'http://127.0.0.1:1234'};}});
 const first=navigate('library');await entered.promise;alive=false;gate.resolve();await first;assert.deepEqual(calls,[]);
});
