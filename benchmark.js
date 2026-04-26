let storage = {};
global.localStorage = {
  getItem: (k) => storage[k] || null,
  setItem: (k, v) => storage[k] = v
};

var K = 'bbf_v7';

function GD_old() {
  try { return JSON.parse(localStorage.getItem(K)) || {u:{},l:{},w:{}}; }
  catch(e) { return {u:{},l:{},w:{}}; }
}
function SD_old(d) { localStorage.setItem(K, JSON.stringify(d)); }

var _cachedData = null;
function GD_new() {
  if (_cachedData) return _cachedData;
  try { _cachedData = JSON.parse(localStorage.getItem(K)) || {u:{},l:{},w:{}}; return _cachedData; }
  catch(e) { _cachedData = {u:{},l:{},w:{}}; return _cachedData; }
}
function SD_new(d) {
  _cachedData = d;
  localStorage.setItem(K, JSON.stringify(d));
}

// Fill some dummy data
let dummy = {u:{}, l:{}, w:{}};
for(let i=0; i<1000; i++) {
  dummy.u['user'+i] = {name: 'test'+i, data: [1,2,3,4,5]};
}
SD_old(dummy);

console.log("Measuring old approach...");
let start = performance.now();
for(let i=0; i<10000; i++) {
  GD_old();
}
console.log("Old approach took:", performance.now() - start, "ms");

_cachedData = null;
console.log("Measuring new approach...");
start = performance.now();
for(let i=0; i<10000; i++) {
  GD_new();
}
console.log("New approach took:", performance.now() - start, "ms");
