# MassRPG Unity workspace

This directory is the new Unity/C# implementation.

The `Assets/MassRPG` source tree is safe to build before the exact installed Unity 6 editor revision is pinned. `Packages/` and `ProjectSettings/` are intentionally not fabricated from an untested editor version on the migration branch; they should be generated/pinned when the project is first opened on the development PC, then committed.

Do not copy gameplay truth into MonoBehaviours merely because Unity makes that convenient. The intended split is:

- Core/Data: deterministic, engine-independent C#.
- Server: authoritative decisions/state changes.
- Client: presentation/input only.
- Editor: authoring tools.

Unity `.meta` files must be committed once Unity generates them.
