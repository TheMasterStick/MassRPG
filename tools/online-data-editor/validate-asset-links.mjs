import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
const root = path.join(repoRoot, 'ContentData', 'AssetLinks');
const roles = new Set(['icon', 'model', 'portrait', 'animation']);
const guidPattern = /^[0-9a-f]{32}$/;
const idPattern = /^asset\/(icon|model|portrait|animation)\/[a-z0-9][a-z0-9._/-]*$/;
const issues = [];

async function exists(target) {
  try { await access(target); return true; } catch { return false; }
}

async function walk(dir, prefix = '') {
  const entries = await readdir(dir, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    if (entry.name === 'README.md') continue;
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...await walk(absolute, relative));
    else if (entry.isFile() && entry.name.endsWith('.json')) result.push(relative.replaceAll('\\', '/'));
  }
  return result;
}

function problem(file, message) {
  issues.push({ file, message });
}

if (!(await exists(root))) {
  console.log('MassRPG asset-link validation: no AssetLinks directory yet.');
  process.exit(0);
}

const files = (await walk(root)).sort();
const seenIds = new Set();
for (const relative of files) {
  let doc;
  try { doc = JSON.parse(await readFile(path.join(root, ...relative.split('/')), 'utf8')); }
  catch (error) { problem(relative, `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`); continue; }

  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    problem(relative, 'Root value must be an object.');
    continue;
  }
  if (doc.schemaVersion !== 1) problem(relative, `schemaVersion must be 1, got ${doc.schemaVersion}.`);
  if (typeof doc.id !== 'string' || !idPattern.test(doc.id)) problem(relative, 'id must be a stable asset/<role>/<content-id> identifier.');
  if (!roles.has(doc.role)) problem(relative, `Unknown role '${doc.role}'.`);
  if (typeof doc.unityGuid !== 'string' || !guidPattern.test(doc.unityGuid)) problem(relative, 'unityGuid must be a 32-character lower-case Unity GUID.');
  if (typeof doc.assetPath !== 'string' || !doc.assetPath.startsWith('Assets/')) problem(relative, 'assetPath must point under Unity Assets/.');

  if (typeof doc.id === 'string' && idPattern.test(doc.id)) {
    if (seenIds.has(doc.id)) problem(relative, `Duplicate stable asset ID '${doc.id}'.`);
    seenIds.add(doc.id);
    const expected = doc.id.slice('asset/'.length) + '.json';
    if (relative !== expected) problem(relative, `Repository path must match stable ID; expected '${expected}'.`);
    const roleFromId = doc.id.split('/')[1];
    if (doc.role !== roleFromId) problem(relative, `role '${doc.role}' does not match ID role '${roleFromId}'.`);
  }
}

console.log(`MassRPG asset-link validation: ${files.length} link document(s), ${issues.length} error(s).`);
for (const issue of issues) console.log(`ERROR [${issue.file}] ${issue.message}`);
if (issues.length) process.exitCode = 1;
