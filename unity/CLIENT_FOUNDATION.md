# Unity client foundation

The Unity client remains presentation-only. Logical `GridLocation`, authored terrain cells and server state are authoritative; Unity Transforms and generated meshes are disposable views.

## Current client pieces

- `GridPresentationSpace` maps stable 180,000 x 180,000 logical coordinates into a small Unity-local X/Z space. The origin can move later for floating-origin streaming without changing logical coordinates.
- `BoundedObliqueCameraRig` implements the settled restricted camera shape: fixed oblique orientation, smooth bounded zoom, no free orbit and no over-the-shoulder mode. Zoom input is injected rather than tied to a particular Unity input package.
- `LogicalActorView` interpolates authoritative logical actor locations into smooth 3D motion and never writes Transform state back into simulation truth.
- `LogicalTerrainChunkMeshBuilder` creates custom chunk-derived terrain geometry from authored 1x1 cells rather than using Unity Terrain as canonical truth. It emits exact tile tops and vertical cliff faces where cardinal neighbours are lower.
- `LogicalTerrainChunkView` owns the disposable Unity Mesh/MeshCollider for one render chunk. Destroying/unloading a chunk view cannot delete authored world data.

## First Unity-open work

1. Let Unity 6.3 LTS `6000.3.24f1` import/compile the branch and resolve real package metadata.
2. Run the Editor test assemblies and fix compile/parity issues before building more presentation on top.
3. Choose and pin the render pipeline/material package set rather than guessing it from the work PC.
4. Create the first test scene with a `GridPresentationSpace`, camera rig, a few authored pages and generated terrain chunk views.
5. Add click projection/request adapters and a temporary character view, then import the canonical male/female 3D bases.
6. Add render-chunk window streaming/preload around the player and benchmark the 64x64 baseline before treating it as fixed.

Ground-material batching, terrain dressing, water rendering and final low-poly/pixel-like shading are intentionally not hard-coded into the first mesh builder; those depend on the visual pipeline chosen during the first real Unity pass.
