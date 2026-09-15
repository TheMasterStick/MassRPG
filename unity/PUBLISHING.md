# Data publishing and rollback

MassRPG separates three states that must not be conflated:

1. **Editor draft** — what the developer is currently changing locally.
2. **Local test** — an explicitly exported version used by local/test simulation.
3. **Live published** — an immutable numbered package version selected by the MMO server.

Gameplay content and authored world data are intended to be publishable independently of rebuilding the Unity executable where practical. Every published version receives a manifest containing a monotonically chosen version number, an optional parent version, schema version, creation timestamp, label, and package hashes.

Published versions are immutable. A bad live release does not get silently edited in place. The server moves its active pointer to another known manifest. Therefore a release such as version 147 can be rolled back to parent version 146 while both packages remain available for diagnosis.

The current classes establish the contract only. The full Data Editor still needs validation, package export, cryptographic hashing, deployment permissions, staging/live promotion, migration checks, and persistent server integration. Publishing must remain a deliberate action and is never the same operation as Ctrl+S or editor autosave.
