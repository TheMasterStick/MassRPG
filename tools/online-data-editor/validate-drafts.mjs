import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
const draftRoot = path.join(repoRoot, 'ContentData', 'Drafts');
const kinds = ['items', 'creatures', 'resources', 'recipes'];
const idPattern = /^[a-z0-9][a-z0-9._/-]{1,79}$/;
const issues = [];
const documents = Object.fromEntries(kinds.map(kind => [kind, []]));

function add(severity, kind, id, message) {
  issues.push({ severity, kind, id: id || '(missing id)', message });
}

function isInteger(value, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) {
  return Number.isInteger(value) && value >= min && value <= max;
}

function requiredIdentity(kind, fileName, doc) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    add('error', kind, fileName, 'Root JSON value must be an object.');
    return false;
  }
  if (doc.schemaVersion !== 1) add('error', kind, doc.id || fileName, `schemaVersion must be 1, got ${doc.schemaVersion}.`);
  if (typeof doc.id !== 'string' || !idPattern.test(doc.id)) add('error', kind, doc.id || fileName, 'Permanent ID is invalid.');
  if (typeof doc.displayName !== 'string' || !doc.displayName.trim()) add('error', kind, doc.id || fileName, 'Display name is required.');
  if (doc.id && fileName !== `${doc.id}.json`) add('error', kind, doc.id, `Filename '${fileName}' does not match permanent ID.`);
  if (doc.editorState !== undefined && !['draft', 'ready-for-review'].includes(doc.editorState)) add('warning', kind, doc.id, `Unknown editorState '${doc.editorState}'.`);
  return true;
}

function validateItem(doc) {
  const slots = Array.isArray(doc.allowedEquipmentSlots) ? doc.allowedEquipmentSlots : [];
  const allowedSlots = new Set(['Head','Amulet','Cape','Chest','Legs','Hands','Boots','MainHand','OffHand','Ring1','Ring2']);
  if (new Set(slots).size !== slots.length || slots.some(slot => !allowedSlots.has(slot))) add('error', 'items', doc.id, 'Equipment slots contain a duplicate or unknown value.');
  if (typeof doc.stackable !== 'boolean') add('error', 'items', doc.id, 'stackable must be boolean.');
  if (!isInteger(doc.value, 0)) add('error', 'items', doc.id, 'value must be a non-negative integer.');
  if (!isInteger(doc.equipRequirementLevel, 1, 300)) add('error', 'items', doc.id, 'equipRequirementLevel must be 1-300.');
  if (doc.twoHanded && doc.canDualWield) add('error', 'items', doc.id, 'Two-handed item cannot also be dual-wieldable.');
  if ((doc.twoHanded || doc.canDualWield) && !slots.includes('MainHand')) add('error', 'items', doc.id, 'Two-handed/dual-wieldable item must include MainHand.');
  for (const [field, value] of [['healAmount',doc.healAmount],['toolTier',doc.toolTier],['attackIntervalMilliseconds',doc.attackIntervalMilliseconds],['attackRangeTiles',doc.attackRangeTiles]]) {
    if (!isInteger(value, 0)) add('error', 'items', doc.id, `${field} must be a non-negative integer.`);
  }
}

function validateCreature(doc) {
  for (const field of ['combatLevel','maxHitpoints','attackLevel','strengthLevel','defenceLevel','attackIntervalMilliseconds','attackRangeTiles','footprintWidth','footprintHeight']) {
    if (!isInteger(doc[field], 1)) add('error', 'creatures', doc.id, `${field} must be an integer >= 1.`);
  }
  for (const field of ['aggroRadiusTiles','leashRadiusTiles']) if (!isInteger(doc[field], 0)) add('error', 'creatures', doc.id, `${field} must be a non-negative integer.`);
  if (!['Melee','Ranged','Magic'].includes(doc.combatStyle)) add('error', 'creatures', doc.id, `Unknown combatStyle '${doc.combatStyle}'.`);
  if (!['Passive','Neutral','Aggressive'].includes(doc.disposition)) add('error', 'creatures', doc.id, `Unknown disposition '${doc.disposition}'.`);
  if (typeof doc.persistentNamedInstance !== 'boolean') add('error', 'creatures', doc.id, 'persistentNamedInstance must be boolean.');
}

function validateResource(doc) {
  if (!['Woodcutting','Mining','Fishing','Farming'].includes(doc.gatheringSkill)) add('error', 'resources', doc.id, `Unknown gatheringSkill '${doc.gatheringSkill}'.`);
  if (!isInteger(doc.requiredLevel, 1, 300)) add('error', 'resources', doc.id, 'requiredLevel must be 1-300.');
  if (!isInteger(doc.experience, 0)) add('error', 'resources', doc.id, 'experience must be non-negative.');
  if (typeof doc.yieldItemId !== 'string' || !idPattern.test(doc.yieldItemId)) add('error', 'resources', doc.id, 'yieldItemId is invalid.');
  if (!isInteger(doc.respawnSeconds, 0)) add('error', 'resources', doc.id, 'respawnSeconds must be non-negative.');
  if (!['Personal','Shared'].includes(doc.availabilityMode)) add('error', 'resources', doc.id, `Unknown availabilityMode '${doc.availabilityMode}'.`);
  if (!isInteger(doc.minimumYield, 1) || !isInteger(doc.maximumYield, 1)) add('error', 'resources', doc.id, 'Yield bounds must be positive integers.');
  else if (doc.maximumYield < doc.minimumYield) add('error', 'resources', doc.id, 'maximumYield is lower than minimumYield.');
  if (!isInteger(doc.minimumToolTier, 0)) add('error', 'resources', doc.id, 'minimumToolTier must be non-negative.');
}

function validateRecipe(doc) {
  if (!['Cooking','Firemaking','Smithing','Crafting','Fletching','Herblore','Construction'].includes(doc.skill)) add('error', 'recipes', doc.id, `Unknown skill '${doc.skill}'.`);
  if (!isInteger(doc.levelRequired, 1, 300)) add('error', 'recipes', doc.id, 'levelRequired must be 1-300.');
  if (!Array.isArray(doc.inputs) || doc.inputs.length < 1) add('error', 'recipes', doc.id, 'Recipe requires at least one input.');
  else for (let i = 0; i < doc.inputs.length; i++) {
    const input = doc.inputs[i];
    if (!input || typeof input.itemId !== 'string' || !idPattern.test(input.itemId)) add('error', 'recipes', doc.id, `Input ${i + 1} itemId is invalid.`);
    if (!input || !isInteger(input.quantity, 1)) add('error', 'recipes', doc.id, `Input ${i + 1} quantity must be >= 1.`);
  }
  if (typeof doc.outputItemId !== 'string' || !idPattern.test(doc.outputItemId)) add('error', 'recipes', doc.id, 'outputItemId is invalid.');
  if (!isInteger(doc.outputQuantity, 1)) add('error', 'recipes', doc.id, 'outputQuantity must be >= 1.');
  if (!isInteger(doc.xp, 0)) add('error', 'recipes', doc.id, 'xp must be non-negative integer.');
  if (!isInteger(doc.durationMilliseconds, 1)) add('error', 'recipes', doc.id, 'durationMilliseconds must be >= 1.');
  if (doc.canBurn && !doc.failureOutputItemId) add('error', 'recipes', doc.id, 'Burnable/failable recipe requires failureOutputItemId.');
  if (typeof doc.failureXpFraction !== 'number' || doc.failureXpFraction < 0 || doc.failureXpFraction > 1) add('error', 'recipes', doc.id, 'failureXpFraction must be 0-1.');
}

async function directoryExists(dir) {
  try { await access(dir); return true; } catch { return false; }
}

for (const kind of kinds) {
  const dir = path.join(draftRoot, kind);
  if (!(await directoryExists(dir))) continue;
  const names = (await readdir(dir)).filter(name => name.endsWith('.json')).sort();
  const seen = new Set();
  for (const name of names) {
    let doc;
    try {
      doc = JSON.parse(await readFile(path.join(dir, name), 'utf8'));
    } catch (error) {
      add('error', kind, name, `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    documents[kind].push(doc);
    requiredIdentity(kind, name, doc);
    if (doc?.id) {
      if (seen.has(doc.id)) add('error', kind, doc.id, 'Duplicate permanent ID in category.');
      seen.add(doc.id);
    }
    if (kind === 'items') validateItem(doc);
    else if (kind === 'creatures') validateCreature(doc);
    else if (kind === 'resources') validateResource(doc);
    else validateRecipe(doc);
  }
}

// Repository-only cross-reference warnings. These are not blocking until migration seed data has
// fully moved into repository files; Unity's authoritative audit can resolve against both sources.
const itemIds = new Set(documents.items.filter(doc => doc?.id).map(doc => doc.id));
function unresolved(kind, id, field, target) {
  if (target && !itemIds.has(target)) add('warning', kind, id, `${field} '${target}' is absent from repository item drafts; it may resolve from migration/reference data.`);
}
for (const doc of documents.resources) unresolved('resources', doc.id, 'Yield item', doc.yieldItemId);
for (const doc of documents.recipes) {
  for (const input of Array.isArray(doc.inputs) ? doc.inputs : []) unresolved('recipes', doc.id, 'Input item', input?.itemId);
  unresolved('recipes', doc.id, 'Output item', doc.outputItemId);
  unresolved('recipes', doc.id, 'Required tool', doc.toolRequiredId);
  unresolved('recipes', doc.id, 'Failure output', doc.failureOutputItemId);
}

const errors = issues.filter(issue => issue.severity === 'error');
const warnings = issues.filter(issue => issue.severity === 'warning');
const total = kinds.reduce((sum, kind) => sum + documents[kind].length, 0);
const ready = kinds.reduce((sum, kind) => sum + documents[kind].filter(doc => doc?.editorState === 'ready-for-review').length, 0);

console.log(`MassRPG draft validation: ${total} documents, ${ready} ready for review, ${errors.length} errors, ${warnings.length} warnings.`);
for (const issue of issues) console.log(`${issue.severity.toUpperCase()} [${issue.kind}/${issue.id}] ${issue.message}`);
if (warnings.length) console.log('Reference warnings are non-blocking while migration seed catalogs remain valid fallback data.');
if (errors.length) process.exitCode = 1;
