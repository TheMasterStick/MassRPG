#!/usr/bin/env python3
"""Static preflight for MassRPG Unity assembly definitions.

This intentionally does not try to replace Unity's compiler. It catches repository-level
assembly mistakes that can be checked before the first real Unity Editor open:
- malformed/duplicate asmdefs;
- missing or unnecessary-to-resolve MassRPG assembly references;
- source imports that require an asmdef reference which is not declared;
- cycles in the MassRPG assembly graph;
- runtime assemblies referencing Editor-only assemblies;
- noEngineReferences assemblies containing UnityEngine/UnityEditor API references;
- source under an Editor directory owned by a non-Editor assembly.
"""

from __future__ import annotations

import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
UNITY_SOURCE_ROOT = REPO_ROOT / "unity" / "Assets" / "MassRPG"
UNITY_API_PATTERN = re.compile(
    r"(?:^|\s)using\s+Unity(?:Engine|Editor)(?:\.|\s*;)|\bUnity(?:Engine|Editor)\."
)
MASSRPG_USING_PATTERN = re.compile(
    r"^\s*using\s+(?:static\s+)?(?:[A-Za-z_][A-Za-z0-9_]*\s*=\s*)?"
    r"(MassRPG\.(?:EditorCore|Editor|Client|Server|Data|Core|Tests))(?:\.|\s*;)",
    re.MULTILINE,
)


@dataclass(frozen=True)
class Assembly:
    name: str
    path: Path
    directory: Path
    references: tuple[str, ...]
    include_platforms: tuple[str, ...]
    no_engine_references: bool

    @property
    def editor_only(self) -> bool:
        return bool(self.include_platforms) and set(self.include_platforms) == {"Editor"}


def fail(errors: list[str], message: str) -> None:
    errors.append(message)


def load_assemblies(errors: list[str]) -> dict[str, Assembly]:
    assemblies: dict[str, Assembly] = {}
    for path in sorted(UNITY_SOURCE_ROOT.rglob("*.asmdef")):
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            fail(errors, f"{path.relative_to(REPO_ROOT)}: invalid asmdef JSON: {exc}")
            continue

        name = payload.get("name")
        if not isinstance(name, str) or not name.strip():
            fail(errors, f"{path.relative_to(REPO_ROOT)}: missing non-empty 'name'")
            continue
        if name in assemblies:
            fail(
                errors,
                f"duplicate assembly name {name!r}: "
                f"{assemblies[name].path.relative_to(REPO_ROOT)} and {path.relative_to(REPO_ROOT)}",
            )
            continue

        references = payload.get("references", [])
        include_platforms = payload.get("includePlatforms", [])
        if not isinstance(references, list) or not all(isinstance(value, str) for value in references):
            fail(errors, f"{path.relative_to(REPO_ROOT)}: 'references' must be a string array")
            references = []
        if not isinstance(include_platforms, list) or not all(
            isinstance(value, str) for value in include_platforms
        ):
            fail(errors, f"{path.relative_to(REPO_ROOT)}: 'includePlatforms' must be a string array")
            include_platforms = []

        assemblies[name] = Assembly(
            name=name,
            path=path,
            directory=path.parent,
            references=tuple(references),
            include_platforms=tuple(include_platforms),
            no_engine_references=payload.get("noEngineReferences") is True,
        )

    if not assemblies:
        fail(errors, f"no asmdefs found beneath {UNITY_SOURCE_ROOT.relative_to(REPO_ROOT)}")
    return assemblies


def project_reference_name(reference: str) -> str | None:
    # Name-based references are used by MassRPG today. GUID references may be introduced by
    # Unity later, so do not reject external/GUID references here.
    if reference.startswith("MassRPG."):
        return reference
    return None


def validate_references(assemblies: dict[str, Assembly], errors: list[str]) -> dict[str, list[str]]:
    graph: dict[str, list[str]] = {name: [] for name in assemblies}
    for assembly in assemblies.values():
        for reference in assembly.references:
            project_name = project_reference_name(reference)
            if project_name is None:
                continue
            target = assemblies.get(project_name)
            if target is None:
                fail(
                    errors,
                    f"{assembly.path.relative_to(REPO_ROOT)}: missing MassRPG reference {project_name!r}",
                )
                continue
            graph[assembly.name].append(target.name)
            if not assembly.editor_only and target.editor_only:
                fail(
                    errors,
                    f"runtime-capable assembly {assembly.name!r} references Editor-only {target.name!r}",
                )
            if assembly.no_engine_references and not target.no_engine_references:
                fail(
                    errors,
                    f"noEngineReferences assembly {assembly.name!r} references engine assembly {target.name!r}",
                )
    return graph


def validate_cycles(graph: dict[str, list[str]], errors: list[str]) -> None:
    state: dict[str, int] = {name: 0 for name in graph}
    stack: list[str] = []

    def visit(name: str) -> None:
        state[name] = 1
        stack.append(name)
        for target in graph[name]:
            if state[target] == 0:
                visit(target)
            elif state[target] == 1:
                start = stack.index(target)
                cycle = stack[start:] + [target]
                fail(errors, "assembly reference cycle: " + " -> ".join(cycle))
        stack.pop()
        state[name] = 2

    for name in sorted(graph):
        if state[name] == 0:
            visit(name)


def owner_for(source: Path, assemblies: dict[str, Assembly]) -> Assembly | None:
    candidates = [assembly for assembly in assemblies.values() if source.is_relative_to(assembly.directory)]
    if not candidates:
        return None
    return max(candidates, key=lambda assembly: len(assembly.directory.parts))


def validate_declared_imports(
    source: Path,
    text: str,
    owner: Assembly,
    assemblies: dict[str, Assembly],
    errors: list[str],
) -> None:
    declared_refs = {
        project_name
        for reference in owner.references
        if (project_name := project_reference_name(reference)) is not None
    }
    for match in MASSRPG_USING_PATTERN.finditer(text):
        target_name = match.group(1)
        if target_name == owner.name:
            continue
        if target_name not in assemblies:
            # A namespace can exist without its own asmdef; only enforce known project assemblies.
            continue
        if target_name in declared_refs:
            continue
        line_number = text.count("\n", 0, match.start()) + 1
        fail(
            errors,
            f"{source.relative_to(REPO_ROOT)}:{line_number}: imports {target_name!r} but "
            f"asmdef {owner.name!r} does not reference it",
        )


def validate_sources(assemblies: dict[str, Assembly], errors: list[str]) -> int:
    source_count = 0
    for source in sorted(UNITY_SOURCE_ROOT.rglob("*.cs")):
        source_count += 1
        owner = owner_for(source, assemblies)
        rel = source.relative_to(REPO_ROOT)
        if owner is None:
            fail(errors, f"{rel}: source is not owned by a MassRPG asmdef")
            continue

        relative_to_assembly = source.relative_to(owner.directory)
        if "Editor" in relative_to_assembly.parts and not owner.editor_only:
            fail(
                errors,
                f"{rel}: Editor-directory source is owned by non-Editor assembly {owner.name!r}",
            )

        try:
            text = source.read_text(encoding="utf-8")
        except OSError as exc:
            fail(errors, f"{rel}: could not read source: {exc}")
            continue

        validate_declared_imports(source, text, owner, assemblies, errors)

        if owner.no_engine_references:
            for line_number, line in enumerate(text.splitlines(), start=1):
                stripped = line.strip()
                if stripped.startswith("//"):
                    continue
                if UNITY_API_PATTERN.search(line):
                    fail(
                        errors,
                        f"{rel}:{line_number}: Unity API reference inside noEngineReferences "
                        f"assembly {owner.name!r}: {stripped}",
                    )
    return source_count


def main() -> int:
    errors: list[str] = []
    if not UNITY_SOURCE_ROOT.is_dir():
        print(f"ERROR: Unity source root not found: {UNITY_SOURCE_ROOT}", file=sys.stderr)
        return 1

    assemblies = load_assemblies(errors)
    graph = validate_references(assemblies, errors)
    validate_cycles(graph, errors)
    source_count = validate_sources(assemblies, errors)

    if errors:
        print("Unity assembly preflight FAILED:", file=sys.stderr)
        for error in errors:
            print(f"  - {error}", file=sys.stderr)
        return 1

    print(
        f"Unity assembly preflight passed: {len(assemblies)} assemblies, "
        f"{source_count} C# source files checked."
    )
    for name in sorted(assemblies):
        assembly = assemblies[name]
        refs = ", ".join(assembly.references) if assembly.references else "(none)"
        mode = "Editor-only" if assembly.editor_only else "runtime-capable"
        engine = "no-engine" if assembly.no_engine_references else "Unity-facing"
        print(f"  {name}: {mode}, {engine}, refs: {refs}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
