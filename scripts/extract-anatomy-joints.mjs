// scripts/extract-anatomy-joints.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Derives the ANATOMY_JOINTS anchor coordinates in
// frontend/src/components/command/anatomyViewerData.js directly from the real
// Z-Anatomy mesh, so the interactive joint nodes sit on true anatomical points
// instead of eyeballed magic numbers. Walks the GLB node transform tree and reads
// each mesh's POSITION accessor min/max (present even under Draco) to compute
// world-space bounding boxes — no Draco decode needed.
//
// Run from the repo root after any mesh re-export:
//   node scripts/extract-anatomy-joints.mjs [path/to/model.glb]
// then paste the printed positions into ANATOMY_JOINTS.
import fs from 'node:fs';

const GLB = process.argv[2] || 'frontend/public/anatomy/model.glb';
const b = fs.readFileSync(GLB);
const jsonLen = b.readUInt32LE(12);
const gltf = JSON.parse(b.toString('utf8', 20, 20 + jsonLen));
const nodes = gltf.nodes || [];
const accessors = gltf.accessors || [];
const meshes = gltf.meshes || [];

// ── mat4 helpers (column-major, gl-style) ────────────────────────────────────
function identity() { return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]; }
function mul(a, b) {
  const o = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    o[c*4+r] = a[0*4+r]*b[c*4+0] + a[1*4+r]*b[c*4+1] + a[2*4+r]*b[c*4+2] + a[3*4+r]*b[c*4+3];
  }
  return o;
}
function fromTRS(t = [0,0,0], q = [0,0,0,1], s = [1,1,1]) {
  const [x,y,z,w] = q;
  const x2=x+x, y2=y+y, z2=z+z;
  const xx=x*x2, xy=x*y2, xz=x*z2, yy=y*y2, yz=y*z2, zz=z*z2, wx=w*x2, wy=w*y2, wz=w*z2;
  const [sx,sy,sz] = s;
  return [
    (1-(yy+zz))*sx, (xy+wz)*sx, (xz-wy)*sx, 0,
    (xy-wz)*sy, (1-(xx+zz))*sy, (yz+wx)*sy, 0,
    (xz+wy)*sz, (yz-wx)*sz, (1-(xx+yy))*sz, 0,
    t[0], t[1], t[2], 1,
  ];
}
function xform(m, p) {
  return [
    m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],
    m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],
    m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14],
  ];
}

// ── parent map + world matrix per node ───────────────────────────────────────
const parent = new Array(nodes.length).fill(-1);
nodes.forEach((n, i) => (n.children || []).forEach((c) => { parent[c] = i; }));
const localM = nodes.map((n) => n.matrix ? n.matrix : fromTRS(n.translation, n.rotation, n.scale));
const worldCache = new Array(nodes.length).fill(null);
function world(i) {
  if (worldCache[i]) return worldCache[i];
  const m = parent[i] === -1 ? localM[i] : mul(world(parent[i]), localM[i]);
  worldCache[i] = m;
  return m;
}

// ── AABB of a node's own mesh (world space), from POSITION accessor min/max ───
function nodeMeshAABB(i) {
  const n = nodes[i];
  if (n.mesh == null) return null;
  const m = world(i);
  let mn = [Infinity,Infinity,Infinity], mx = [-Infinity,-Infinity,-Infinity];
  for (const prim of (meshes[n.mesh].primitives || [])) {
    const posIdx = prim.attributes?.POSITION;
    if (posIdx == null) continue;
    const a = accessors[posIdx];
    if (!a.min || !a.max) continue;
    // transform all 8 corners of the local AABB
    for (let cx=0; cx<2; cx++) for (let cy=0; cy<2; cy++) for (let cz=0; cz<2; cz++) {
      const p = xform(m, [cx?a.max[0]:a.min[0], cy?a.max[1]:a.min[1], cz?a.max[2]:a.min[2]]);
      for (let k=0;k<3;k++){ mn[k]=Math.min(mn[k],p[k]); mx[k]=Math.max(mx[k],p[k]); }
    }
  }
  if (mn[0] === Infinity) return null;
  return { mn, mx };
}

// ── union AABB over a node subtree (matched node + all descendants) ───────────
function subtreeAABB(root) {
  let mn = [Infinity,Infinity,Infinity], mx = [-Infinity,-Infinity,-Infinity], any = false;
  const stack = [root];
  while (stack.length) {
    const i = stack.pop();
    const bb = nodeMeshAABB(i);
    if (bb) { any = true; for (let k=0;k<3;k++){ mn[k]=Math.min(mn[k],bb.mn[k]); mx[k]=Math.max(mx[k],bb.mx[k]); } }
    for (const c of (nodes[i].children || [])) stack.push(c);
  }
  return any ? { mn, mx } : null;
}
const center = (bb) => bb ? [ (bb.mn[0]+bb.mx[0])/2, (bb.mn[1]+bb.mx[1])/2, (bb.mn[2]+bb.mx[2])/2 ] : null;
const r3 = (v) => v.map((x)=>Math.round(x*1000)/1000);

// ── overall scene AABB ───────────────────────────────────────────────────────
let smn=[Infinity,Infinity,Infinity], smx=[-Infinity,-Infinity,-Infinity];
for (let i=0;i<nodes.length;i++){ const bb=nodeMeshAABB(i); if(bb) for(let k=0;k<3;k++){ smn[k]=Math.min(smn[k],bb.mn[k]); smx[k]=Math.max(smx[k],bb.mx[k]); } }
const size = [smx[0]-smn[0], smx[1]-smn[1], smx[2]-smn[2]];
console.log('SCENE bbox min', r3(smn), 'max', r3(smx));
console.log('SCENE size (W,H,D)', r3(size), '| center', r3([(smn[0]+smx[0])/2,(smn[1]+smx[1])/2,(smn[2]+smx[2])/2]));

// ── find first node whose name matches a regex; return its subtree center ─────
function anchorFor(re, sidePick) {
  // gather all matching root nodes, compute each subtree AABB center
  const cands = [];
  nodes.forEach((n,i)=>{ if(n.name && re.test(n.name)) { const bb=subtreeAABB(i); if(bb) cands.push({ i, name:n.name, c:center(bb) }); } });
  if (!cands.length) return null;
  if (sidePick === 'center') {
    // union all, take center
    let mn=[Infinity,Infinity,Infinity],mx=[-Infinity,-Infinity,-Infinity];
    for(const cd of cands){ for(let k=0;k<3;k++){ mn[k]=Math.min(mn[k],cd.c[k]); mx[k]=Math.max(mx[k],cd.c[k]); } }
    return { c:[(mn[0]+mx[0])/2,(mn[1]+mx[1])/2,(mn[2]+mx[2])/2], picked:cands.map(c=>c.name) };
  }
  // pick by x sign: 'maxx' or 'minx'
  cands.sort((a,b)=> sidePick==='maxx' ? b.c[0]-a.c[0] : a.c[0]-b.c[0]);
  return { c:cands[0].c, picked:[cands[0].name] };
}

// Bone-TOP anchor: the proximal head of a long bone (femoral/humeral head) = the
// actual ball joint. Gather bone-name matches, split by x sign, take top-center.
function boneTopAnchor(re, sidePick) {
  const cands = [];
  nodes.forEach((n,i)=>{ if(n.name && re.test(n.name)) { const bb=subtreeAABB(i); if(bb) cands.push({ name:n.name, bb }); } });
  if (!cands.length) return null;
  // union per side
  const side = cands.filter((c)=>{ const cx=(c.bb.mn[0]+c.bb.mx[0])/2; return sidePick==='maxx' ? cx>0 : cx<0; });
  const use = side.length ? side : cands;
  let mn=[Infinity,Infinity,Infinity],mx=[-Infinity,-Infinity,-Infinity];
  for(const c of use){ for(let k=0;k<3;k++){ mn[k]=Math.min(mn[k],c.bb.mn[k]); mx[k]=Math.max(mx[k],c.bb.mx[k]); } }
  return { c:[ (mn[0]+mx[0])/2, mx[1], (mn[2]+mx[2])/2 ], picked:use.map(c=>c.name).slice(0,3) }; // top = mx[1]
}

console.log('\nANATOMY_JOINTS anchors (world space, meters):');
const out = {};
// knee / ankle — discrete bones, center is correct
for (const [id, re, side] of [['knee',/^Patella(\.\d+)?$/i,'minx'],['ankle',/^Talus(\.\d+)?$/i,'minx']]) {
  const a = anchorFor(re, side);
  if (a) { out[id]=r3(a.c); console.log(`  ${id.padEnd(9)} ${JSON.stringify(r3(a.c))}  ← ${a.picked.join(', ')}`); }
}
// hip / shoulder — proximal bone head (top of femur / humerus)
for (const [id, re, side] of [['hip',/femur/i,'minx'],['shoulder',/humerus/i,'maxx']]) {
  const a = boneTopAnchor(re, side);
  if (a) { out[id]=r3(a.c); console.log(`  ${id.padEnd(9)} ${JSON.stringify(r3(a.c))}  ← top of ${a.picked.join(', ')}`); }
}
// lumbar — the lumbar spine block (or fallback: just above the sacrum, midline)
{
  let a = anchorFor(/lumbar/i, 'center');
  if (!a) { const s = anchorFor(/^Sacrum/i, 'center'); if (s) a = { c:[0, s.c[1]+0.12, s.c[2]-0.02], picked:['(sacrum+offset fallback)'] }; }
  if (a) { out.lumbar = r3([0, a.c[1], a.c[2]]); console.log(`  ${'lumbar'.padEnd(9)} ${JSON.stringify(r3([0,a.c[1],a.c[2]]))}  ← ${a.picked.join(', ')}`); }
}
console.log('\nJSON:', JSON.stringify(out));
console.log('suggested node radius (~1.8% of height):', Math.round(size[1]*0.018*1000)/1000);
