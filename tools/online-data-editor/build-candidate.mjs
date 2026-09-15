import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
const draftRoot = path.join(repoRoot, 'ContentData', 'Drafts');
const candidateRoot = path.join(repoRoot, 'ContentData', 'Candidates');
const kinds = ['items', 'creatures', 'resources', 'recipes', 'definitions'];
const args = process.argv.slice(2);
const requireReady = args.includes('--require-ready');
const labelArg = args.filter(arg => arg !== '--require-ready').join(' ').trim();
const label = labelArg || 'MassRPG data review candidate';
if (label.length > 120) throw new Error('Candidate label must be 120 characters or less.');

async function git(args) {
  const { stdout } = await execFileAsync('git', args, { cwd: repoRoot, maxBuffer: 1024 * 1024 });
  return stdout.trim();
}

function slug(value) {
  const s = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 36);
  return s || 'candidate';
}

function timestampId(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

async function listJsonFiles(root, prefix = '') {
  const result = [];
  let entries;
  try { entries = await readdir(root, { withFileTypes: true }); }
  catch (error) {
    if (error?.code === 'ENOENT') return result;
    throw error;
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const relative = path.posix.join(prefix, entry.name);
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) result.push(...await listJsonFiles(full, relative));
    else if (entry.isFile() && entry.name.endsWith('.json')) result.push({ full, relative });
  }
  return result;
}

// Use the same structural validation command that CI uses. Reference warnings remain non-blocking
// while temporary migration seed catalogs are still part of the resolved content graph.
try {
  const validation = await execFileAsync(process.execPath, [path.join(here, 'validate-drafts.mjs')], {
    cwd: repoRoot,
    maxBuffer: 4 * 1024 * 1024,
  });
  if (validation.stdout.trim()) console.log(validation.stdout.trim());
  if (validation.stderr.trim()) console.error(validation.stderr.trim());
} catch (error) {
  if (error.stdout) console.error(String(error.stdout).trim());
  if (error.stderr) console.error(String(error.stderr).trim());
  throw new Error('Draft validation failed; candidate was not created.');
}

const branch = await git(['branch', '--show-current']);
if (!branch) throw new Error('Candidate creation requires a named Git branch, not detached HEAD.');
const dirtyDrafts = await git(['status', '--short', '--', 'ContentData/Drafts']);
if (dirtyDrafts) {
  throw new Error('ContentData/Drafts has uncommitted changes. Commit the draft edits first so the candidate can point at a reproducible Git commit.');
}
const sourceCommit = await git(['rev-parse', 'HEAD']);
const shortCommit = sourceCommit.slice(0, 8);

const documentCounts = Object.fromEntries(kinds.map(kind => [kind, 0]));
const readyCounts = Object.fromEntries(kinds.map(kind => [kind, 0]));
const assetStateCounts = {
  'needs-assets': 0,
  placeholder: 0,
  linked: 0,
  final: 0,
  'not-required': 0,
  unspecified: 0,
};
const files = [];

for (const kind of kinds) {
  const categoryRoot = path.join(draftRoot, kind);
  const categoryFiles = await listJsonFiles(categoryRoot);
  for (const file of categoryFiles) {
    const bytes = await readFile(file.full);
    const document = JSON.parse(bytes.toString('utf8'));
    const editorState = document.editorState === 'ready-for-review' ? 'ready-for-review' : 'draft';
    const assetState = document.presentation?.assetState ?? 'unspecified';
    documentCounts[kind] += 1;
    if (editorState === 'ready-for-review') readyCounts[kind] += 1;
    if (assetStateCounts[assetState] === undefined) assetStateCounts.unspecified += 1;
    else assetStateCounts[assetState] += 1;
    files.push({
      path: path.posix.join('ContentData', 'Drafts', kind, file.relative),
      sha256: createHash('sha256').update(bytes).digest('hex'),
      bytes: bytes.length,
      editorState,
      assetState,
    });
  }
}

files.sort((a, b) => a.path.localeCompare(b.path));
const total = kinds.reduce((sum, kind) => sum + documentCounts[kind], 0);
const ready = kinds.reduce((sum, kind) => sum + readyCounts[kind], 0);
const allDraftsReady = total > 0 && ready === total;
if (total === 0) throw new Error('There are no repository draft JSON files to include in a candidate.');
if (requireReady && !allDraftsReady) {
  throw new Error(`Candidate requires all drafts to be ready for review, but only ${ready}/${total} are ready.`);
}

const now = new Date();
const candidateId = `${timestampId(now)}-${shortCommit}-${slug(label)}`;
const manifest = {
  schemaVersion: 1,
  candidateId,
  label,
  createdAtUtc: now.toISOString(),
  sourceBranch: branch,
  sourceCommit,
  documentCounts,
  readyCounts,
  assetStateCounts,
  designOnlyDefinitionCount: documentCounts.definitions,
  allDraftsReady,
  files,
};

await mkdir(candidateRoot, { recursive: true });
const output = path.join(candidateRoot, `${candidateId}.json`);
await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Created candidate ${candidateId}`);
console.log(`Source: ${branch}@${shortCommit}`);
console.log(`Documents: ${total}; ready for review: ${ready}; all ready: ${allDraftsReady ? 'yes' : 'no'}`);
console.log(`Generic design definitions: ${documentCounts.definitions}; unfinished asset entries: ${assetStateCounts['needs-assets'] + assetStateCounts.placeholder + assetStateCounts.linked}`);
console.log(`Manifest: ${path.relative(repoRoot, output)}`);
console.log('This is a review/local-test candidate only. Generic definitions require promotion to typed runtime schemas before live publication.');
