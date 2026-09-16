# MassRPG Unity workspace

This directory is the Unity/C# implementation.

The project is pinned to Unity 6.3 LTS `6000.3.24f1` in `ProjectSettings/ProjectVersion.txt`. Before the first real Editor open, the migration branch intentionally commits only the version pin rather than fabricating Unity-generated project state. In particular, `Packages/manifest.json`, the package lock state, the remaining `ProjectSettings/` files and Unity `.meta` files should be generated/resolved by the actual `6000.3.24f1` Editor on the development PC, reviewed, and then committed.

Do not hand-create package versions merely to make the repository look like a fully opened Unity project. The first Editor session is the authority for package metadata and generated settings.

Do not copy gameplay truth into MonoBehaviours merely because Unity makes that convenient. The intended split is:

- Core/Data: deterministic, engine-independent C#.
- Server: authoritative decisions/state changes.
- Client: presentation/input only.
- EditorCore: engine-independent authoring rules.
- Editor: Unity authoring front end.

Repository CI provides two pre-Editor safeguards: the engine-independent C# build/tests are compiled at Unity's C# 9 language level, and a Unity-structure preflight validates asmdef references, cycles, Editor/runtime boundaries and accidental Unity API usage in `noEngineReferences` assemblies. These checks reduce first-open risk but do not replace Unity's own compiler or Test Runner.

After the first successful Editor bootstrap, commit Unity-generated `.meta` files and the reviewed package/project metadata before beginning substantial content or art production.
