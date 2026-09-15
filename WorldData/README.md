# MassRPG WorldData

This directory is the versionable source-of-truth root for the authored Twin Lands world.

The Unity World Editor writes canonical logical pages beneath `WorldData/Pages`. These files intentionally live outside `unity/Assets` so a mature world can contain a very large number of streamed storage pages without forcing Unity's AssetDatabase to import and track every page as an editor asset.

Expected layout:

```text
WorldData/
  Pages/
    plane_0/
      storey_0/
        page_0_0.json
        page_0_1.json
        ...
```

A page is an IO/editor unit, currently 512x512 logical tiles. It is not a biome, region, kingdom, settlement or render chunk. Semantic world layers are stored independently.

Do not hand-edit page files unless repairing/migrating data. Use `MassRPG -> World Overview` for coarse whole-world blocking and `MassRPG -> World Editor` for exact 1x1 work.
