# `/draco/` — Draco decoder for the Biomechanics Viewer

These are the **Google Draco** WebAssembly decoder binaries (the `gltf` variant
shipped with `three@0.185`), served **locally** from this folder so the app stays
CSP-clean — no CDN fetch. `AnatomyViewport3D.jsx` points Drei's `useGLTF` at
`/draco/`, so a Draco-compressed Z-Anatomy `.glb` decodes right here.

| file | purpose |
|---|---|
| `draco_decoder.wasm` | the WASM decoder (primary path) |
| `draco_wasm_wrapper.js` | JS glue that instantiates the WASM |
| `draco_decoder.js` | pure-JS fallback for browsers without WASM |

> Keep these **version-matched to `three`**. After a `three` upgrade, recopy from
> `node_modules/three/examples/jsm/libs/draco/gltf/` into this folder.

## Dropping in the Z-Anatomy mesh (3 steps)

The viewport renders the **procedural rig** until a real mesh is wired. When the
Z-Anatomy `.glb` is ready:

1. **Upload** it to the public `anatomy-assets` bucket with a 1-year cache header:
   ```bash
   # drop  z-anatomy.glb  into  assets/anatomy/  then:
   node scripts/upload-anatomy-assets.mjs            # or upload via the Supabase dashboard
   ```
   Public URL shape:
   `https://ihclbceghxpuawymlvgi.supabase.co/storage/v1/object/public/anatomy-assets/z-anatomy.glb`

2. **Set `MODEL_URL`** in `frontend/src/components/command/AnatomyViewport3D.jsx`:
   ```js
   const MODEL_URL = 'https://ihclbceghxpuawymlvgi.supabase.co/storage/v1/object/public/anatomy-assets/z-anatomy.glb';
   ```
   The `<Suspense>` + `useGLTF(MODEL_URL, '/draco/')` path then loads + Draco-decodes
   the mesh; the procedural rig stays as the Suspense fallback.

3. **(Optional) Re-map the joint IDs** onto the mesh. Today the five interactive
   nodes (`lumbar / shoulder / hip / knee / ankle`, in `anatomyViewerData.js →
   ANATOMY_JOINTS`) are invisible raycast proxies at anatomical coordinates. To
   snap them onto named sub-objects of the real mesh, traverse the loaded
   `scene` and tag meshes by name (e.g. `child.name.includes('L4_L5')`) instead of
   using the proxy positions.

### Notes
- **Draco is optional.** A plain (un-compressed) `.glb` also loads via `useGLTF`;
  the decoder is only exercised for Draco-compressed geometry (smaller files).
- **Bump `sw.js` `CACHE`** and redeploy after setting `MODEL_URL` so clients pull
  the update.
- **Z-Anatomy licensing** (CC-BY-SA / GPL) carries attribution + share-alike
  obligations — clear the commercial-use terms before shipping the asset.
