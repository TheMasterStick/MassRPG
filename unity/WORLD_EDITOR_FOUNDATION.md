# World Editor foundation

The Unity World Editor is treated as a first-class production tool, not a throwaway prototype. Its intended front-end remains Warcraft III-like (palette -> tool -> brush -> direct paint) with deeper Galaxy-style data editing beneath it.

`MassRPG.EditorCore` is deliberately engine-independent. It contains authoring operations that can be unit-tested without relying on Unity GUI state. `MassRPG.Editor` will provide the actual Unity windows, scene/world preview, shortcuts, overlays, picking, Play From Here, and visual feedback.

The current editor-core foundation provides:

- explicit editor modes and overlay flags;
- odd-sized 1x1/3x3/5x5/etc. square and circular logical brushes;
- exact terrain/elevation/tile-flag painting;
- Raise/Lower operations that alter only selected logical cells;
- undo/redo history;
- dirty storage-page tracking;
- creation of save documents only for touched pages.

This directly supports the requirement that autosave/crash recovery not rewrite the entire 180,000 x 180,000 world. Background IO, recovery snapshots, selection/fill/copy/paste/stamps, edge/ramp tools, semantic region/POI editing, deterministic biome dressing controls, global search, world overview/minimap, and Play From Here remain to be layered on top.

Large brush/history operations will eventually need page-snapshot or compressed-diff history rather than retaining millions of individual cell changes. The current change-list history is intentionally a clear correctness foundation, not the final memory-optimized implementation for continent-scale brush strokes.
