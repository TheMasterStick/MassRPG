# MassRPG data review candidates

A **candidate** is an immutable manifest describing one reproducible snapshot of repository-backed draft content. It is not a live release and it does not activate anything on an MMO server.

Candidate manifests point at an exact Git commit and record the SHA-256 hash of every draft JSON document. Because candidate creation requires `ContentData/Drafts` to be clean, the referenced Git commit contains the exact files that were hashed.

This gives MassRPG a safe middle stage between mutable drafts and future live publishing:

`draft → validate → commit → candidate → local/QA review → published data version → live activation`

Use:

`npm run data-candidate -- "My review label"`

Add `--require-ready` after the label when every included draft must already be marked **Ready for review**.

The command validates drafts first and refuses to create a candidate if structural errors exist or if draft files have uncommitted changes. Candidate manifests themselves can then be committed normally for review/history.

A future publish command will consume a reviewed candidate and produce the `PublishedDataManifest`/package hashes used by servers. Candidate creation intentionally does not perform that final promotion.
