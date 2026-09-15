import http from 'node:http';
import { execFile } from 'node:child_process';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
const publicRoot = path.join(here, 'public');
const draftRoot = path.join(repoRoot, 'ContentData', 'Drafts');
const roots = {
  items: path.join(draftRoot, 'items'),
  creatures: path.join(draftRoot, 'creatures'),
  resources: path.join(draftRoot, 'resources'),
  recipes: path.join(draftRoot, 'recipes'),
  definitions: path.join(draftRoot, 'definitions'),
};
const port = Number.parseInt(process.env.PORT ?? '4175', 10);
const host = process.env.HOST ?? '0.0.0.0';

const itemTypes = new Set([
  'Tool', 'Weapon', 'Armor', 'Resource', 'Food', 'Potion', 'Material', 'Currency',
  'Seed', 'Ammunition', 'Miscellaneous',
]);
const equipmentSlots = new Set([
  'Head', 'Amulet', 'Cape', 'Chest', 'Legs', 'Hands', 'Boots', 'MainHand',
  'OffHand', 'Ring1', 'Ring2',
]);
const skills = new Set([
  'Hitpoints', 'Attack', 'Strength', 'Defence', 'Ranged', 'Magic', 'Woodcutting',
  'Mining', 'Fishing', 'Farming', 'Cooking', 'Firemaking', 'Smithing', 'Crafting',
  'Fletching', 'Herblore', 'Construction', 'Agility',
]);
const gatheringSkills = new Set(['Woodcutting', 'Mining', 'Fishing', 'Farming']);
const productionSkills = new Set(['Cooking', 'Firemaking', 'Smithing', 'Crafting', 'Fletching', 'Herblore', 'Construction']);
const gatheringToolKinds = new Set([
  'None', 'Hatchet', 'Pickaxe', 'FishingNet', 'FishingRod', 'LobsterPot', 'Harpoon',
]);
const availabilityModes = new Set(['Personal', 'Shared']);
const dispositions = new Set(['Passive', 'Neutral', 'Aggressive']);
const combatStyles = new Set(['Melee', 'Ranged', 'Magic']);
const assetStates = new Set(['needs-assets', 'placeholder', 'linked', 'final', 'not-required']);
const contentIdPattern = /^[a-z0-9][a-z0-9._/-]{1,79}$/;

await Promise.all(Object.values(roots).map(root => mkdir(root, { recursive: true })));

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

function text(res, status, body, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

async function readBody(req) {
  let total = 0;
  const chunks = [];
  for await (const chunk of req) {
    total += chunk.length;
    if (total > 1024 * 1024) throw new Error('Request body is too large.');
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function git(args) {
  const { stdout } = await execFileAsync('git', args, {
    cwd: repoRoot,
    maxBuffer: 1024 * 1024,
  });
  return stdout.trim();
}

async function repoStatus() {
  const branch = await git(['branch', '--show-current']);
  const status = await git(['status', '--short', '--', 'ContentData/Drafts']);
  const changedFiles = status ? status.split(/\r?\n/).filter(Boolean).length : 0;
  const pushAllowed = branch !== 'main' && branch !== 'master' && branch.length > 0;
  return { branch, changedFiles, pushAllowed };
}

function ensureObject(input, label) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error(`${label} payload must be an object.`);
}

function asInteger(value, field, minimum = Number.MIN_SAFE_INTEGER, maximum = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    throw new Error(`${field} must be an integer between ${minimum} and ${maximum}.`);
  }
  return number;
}

function asNumber(value, field, minimum = -Number.MAX_VALUE, maximum = Number.MAX_VALUE) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum) {
    throw new Error(`${field} must be a number between ${minimum} and ${maximum}.`);
  }
  return number;
}

function asBoolean(value, field) {
  if (typeof value !== 'boolean') throw new Error(`${field} must be true or false.`);
  return value;
}

function asId(value, field = 'Permanent ID', optional = false) {
  if (optional && (value == null || value === '')) return null;
  const id = String(value ?? '').trim();
  if (!contentIdPattern.test(id)) {
    throw new Error(`${field} must be 2-80 characters using lower-case a-z, 0-9, dot, underscore, hyphen or slash.`);
  }
  return id;
}

function asName(value, field = 'Display name') {
  const name = String(value ?? '').trim();
  if (name.length < 1 || name.length > 100) throw new Error(`${field} must be 1-100 characters.`);
  return name;
}

function asText(value, field, maximum) {
  const textValue = String(value ?? '');
  if (textValue.length > maximum) throw new Error(`${field} must be ${maximum} characters or less.`);
  return textValue;
}

function stateOf(input) {
  return input.editorState === 'ready-for-review' ? 'ready-for-review' : 'draft';
}

function normalizePresentation(input, defaultAssetState = 'needs-assets') {
  const raw = input?.presentation;
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const assetState = String(source.assetState ?? defaultAssetState);
  if (!assetStates.has(assetState)) throw new Error(`Unknown presentation asset state '${assetState}'.`);
  return {
    assetState,
    iconAssetId: asId(source.iconAssetId, 'Icon asset ID', true),
    modelAssetId: asId(source.modelAssetId, 'Model asset ID', true),
    portraitAssetId: asId(source.portraitAssetId, 'Portrait asset ID', true),
    animationSetAssetId: asId(source.animationSetAssetId, 'Animation-set asset ID', true),
    notes: asText(source.notes, 'Presentation notes', 2000),
  };
}

function normalizeItem(input) {
  ensureObject(input, 'Item');
  const id = asId(input.id);
  const displayName = asName(input.displayName);
  const description = asText(input.description, 'Description', 2000);
  const type = String(input.type ?? 'Miscellaneous');
  if (!itemTypes.has(type)) throw new Error(`Unknown item type '${type}'.`);

  const slots = Array.isArray(input.allowedEquipmentSlots) ? input.allowedEquipmentSlots.map(String) : [];
  if (new Set(slots).size !== slots.length || slots.some(slot => !equipmentSlots.has(slot))) {
    throw new Error('Equipment slots contain an unknown or duplicate value.');
  }

  const equipRequirementSkill = input.equipRequirementSkill == null || input.equipRequirementSkill === ''
    ? null
    : String(input.equipRequirementSkill);
  if (equipRequirementSkill !== null && !skills.has(equipRequirementSkill)) {
    throw new Error(`Unknown equip requirement skill '${equipRequirementSkill}'.`);
  }

  const gatheringToolKind = String(input.gatheringToolKind ?? 'None');
  if (!gatheringToolKinds.has(gatheringToolKind)) throw new Error(`Unknown gathering tool kind '${gatheringToolKind}'.`);
  const bonusInput = input.bonuses && typeof input.bonuses === 'object' ? input.bonuses : {};

  const item = {
    schemaVersion: 1,
    id,
    displayName,
    description,
    type,
    stackable: asBoolean(input.stackable, 'Stackable'),
    value: asInteger(input.value ?? 0, 'Value', 0),
    allowedEquipmentSlots: slots,
    twoHanded: asBoolean(input.twoHanded, 'Two-handed'),
    canDualWield: asBoolean(input.canDualWield, 'Can dual wield'),
    equipRequirementSkill,
    equipRequirementLevel: asInteger(input.equipRequirementLevel ?? 1, 'Equip requirement level', 1, 300),
    healAmount: asInteger(input.healAmount ?? 0, 'Heal amount', 0),
    toolTier: asInteger(input.toolTier ?? 0, 'Tool tier', 0),
    gatheringToolKind,
    attackIntervalMilliseconds: asInteger(input.attackIntervalMilliseconds ?? 0, 'Attack interval', 0),
    attackRangeTiles: asInteger(input.attackRangeTiles ?? 0, 'Attack range', 0),
    bonuses: {
      attack: asInteger(bonusInput.attack ?? 0, 'Attack bonus'),
      strength: asInteger(bonusInput.strength ?? 0, 'Strength bonus'),
      defence: asInteger(bonusInput.defence ?? 0, 'Defence bonus'),
      rangedAttack: asInteger(bonusInput.rangedAttack ?? 0, 'Ranged attack bonus'),
      rangedStrength: asInteger(bonusInput.rangedStrength ?? 0, 'Ranged strength bonus'),
      magic: asInteger(bonusInput.magic ?? 0, 'Magic bonus'),
    },
    presentation: normalizePresentation(input, 'needs-assets'),
    editorState: stateOf(input),
  };

  if (item.twoHanded && item.canDualWield) throw new Error('A two-handed item cannot also be dual-wieldable.');
  if (item.twoHanded && !item.allowedEquipmentSlots.includes('MainHand')) throw new Error('Two-handed equipment must include MainHand.');
  if (item.canDualWield && !item.allowedEquipmentSlots.includes('MainHand')) throw new Error('Dual-wieldable equipment must include MainHand.');
  return item;
}

function normalizeCreature(input) {
  ensureObject(input, 'Creature');
  const combatStyle = String(input.combatStyle ?? 'Melee');
  if (!combatStyles.has(combatStyle)) throw new Error(`Unknown combat style '${combatStyle}'.`);
  const disposition = String(input.disposition ?? 'Neutral');
  if (!dispositions.has(disposition)) throw new Error(`Unknown disposition '${disposition}'.`);

  return {
    schemaVersion: 1,
    id: asId(input.id),
    displayName: asName(input.displayName),
    combatLevel: asInteger(input.combatLevel ?? 1, 'Combat level', 1),
    maxHitpoints: asInteger(input.maxHitpoints ?? 1, 'Max hitpoints', 1),
    attackLevel: asInteger(input.attackLevel ?? 1, 'Attack level', 1, 300),
    strengthLevel: asInteger(input.strengthLevel ?? 1, 'Strength level', 1, 300),
    defenceLevel: asInteger(input.defenceLevel ?? 1, 'Defence level', 1, 300),
    attackBonus: asInteger(input.attackBonus ?? 0, 'Attack bonus'),
    strengthBonus: asInteger(input.strengthBonus ?? 0, 'Strength bonus'),
    defenceBonus: asInteger(input.defenceBonus ?? 0, 'Defence bonus'),
    combatStyle,
    attackIntervalMilliseconds: asInteger(input.attackIntervalMilliseconds ?? 2400, 'Attack interval', 1),
    attackRangeTiles: asInteger(input.attackRangeTiles ?? 1, 'Attack range', 1),
    disposition,
    footprintWidth: asInteger(input.footprintWidth ?? 1, 'Footprint width', 1),
    footprintHeight: asInteger(input.footprintHeight ?? 1, 'Footprint height', 1),
    aggroRadiusTiles: asInteger(input.aggroRadiusTiles ?? 4, 'Aggro radius', 0),
    leashRadiusTiles: asInteger(input.leashRadiusTiles ?? 8, 'Leash radius', 0),
    persistentNamedInstance: asBoolean(input.persistentNamedInstance ?? false, 'Persistent named instance'),
    presentation: normalizePresentation(input, 'needs-assets'),
    editorState: stateOf(input),
  };
}

function normalizeResource(input) {
  ensureObject(input, 'Resource');
  const gatheringSkill = String(input.gatheringSkill ?? 'Mining');
  if (!gatheringSkills.has(gatheringSkill)) throw new Error(`Unknown gathering skill '${gatheringSkill}'.`);
  const availabilityMode = String(input.availabilityMode ?? 'Personal');
  if (!availabilityModes.has(availabilityMode)) throw new Error(`Unknown availability mode '${availabilityMode}'.`);
  const requiredToolKind = String(input.requiredToolKind ?? 'None');
  if (!gatheringToolKinds.has(requiredToolKind)) throw new Error(`Unknown gathering tool kind '${requiredToolKind}'.`);
  const minimumYield = asInteger(input.minimumYield ?? 1, 'Minimum yield', 1);
  const maximumYield = asInteger(input.maximumYield ?? 1, 'Maximum yield', 1);
  if (maximumYield < minimumYield) throw new Error('Maximum yield cannot be lower than minimum yield.');

  return {
    schemaVersion: 1,
    id: asId(input.id),
    displayName: asName(input.displayName),
    gatheringSkill,
    requiredLevel: asInteger(input.requiredLevel ?? 1, 'Required level', 1, 300),
    experience: asInteger(input.experience ?? 0, 'Experience', 0),
    yieldItemId: asId(input.yieldItemId, 'Yield item ID'),
    respawnSeconds: asInteger(input.respawnSeconds ?? 0, 'Respawn seconds', 0),
    availabilityMode,
    minimumYield,
    maximumYield,
    requiredToolKind,
    minimumToolTier: asInteger(input.minimumToolTier ?? 0, 'Minimum tool tier', 0),
    presentation: normalizePresentation(input, 'needs-assets'),
    editorState: stateOf(input),
  };
}

function normalizeRecipe(input) {
  ensureObject(input, 'Recipe');
  const skill = String(input.skill ?? 'Cooking');
  if (!productionSkills.has(skill)) throw new Error(`Unknown production skill '${skill}'.`);
  const rawInputs = Array.isArray(input.inputs) ? input.inputs : [];
  if (rawInputs.length < 1) throw new Error('A recipe requires at least one input.');
  if (rawInputs.length > 16) throw new Error('A recipe may have at most 16 input rows in this editor.');
  const inputs = rawInputs.map((entry, index) => {
    ensureObject(entry, `Recipe input ${index + 1}`);
    return {
      itemId: asId(entry.itemId, `Input ${index + 1} item ID`),
      quantity: asInteger(entry.quantity ?? 1, `Input ${index + 1} quantity`, 1),
    };
  });
  const canBurn = asBoolean(input.canBurn ?? false, 'Can burn/fail');
  const failureOutputItemId = asId(input.failureOutputItemId, 'Failure output item ID', true);
  if (canBurn && failureOutputItemId === null) throw new Error('Burnable/failable recipes require a failure output item ID.');

  return {
    schemaVersion: 1,
    id: asId(input.id),
    displayName: asName(input.displayName),
    skill,
    levelRequired: asInteger(input.levelRequired ?? 1, 'Level required', 1, 300),
    inputs,
    outputItemId: asId(input.outputItemId, 'Output item ID'),
    outputQuantity: asInteger(input.outputQuantity ?? 1, 'Output quantity', 1),
    xp: asInteger(input.xp ?? 0, 'XP', 0),
    durationMilliseconds: asInteger(input.durationMilliseconds ?? 1200, 'Duration', 1),
    category: String(input.category ?? '').trim().slice(0, 100),
    stationId: asId(input.stationId, 'Station ID', true),
    toolRequiredId: asId(input.toolRequiredId, 'Tool required ID', true),
    canBurn,
    failureOutputItemId,
    failureXpFraction: asNumber(input.failureXpFraction ?? 0.10, 'Failure XP fraction', 0, 1),
    presentation: normalizePresentation(input, 'not-required'),
    editorState: stateOf(input),
  };
}

function normalizeDefinition(input) {
  ensureObject(input, 'Definition');
  const kind = String(input.kind ?? 'Other').trim();
  if (!kind || kind.length > 60) throw new Error('Definition kind must be 1-60 characters.');
  const tags = Array.isArray(input.tags)
    ? input.tags.map(value => String(value).trim()).filter(Boolean)
    : [];
  if (tags.length > 32) throw new Error('A definition may have at most 32 tags.');
  if (tags.some(tag => tag.length > 50)) throw new Error('Definition tags must be 50 characters or less.');
  const rawData = input.data == null ? {} : input.data;
  ensureObject(rawData, 'Definition data');

  return {
    schemaVersion: 1,
    id: asId(input.id),
    displayName: asName(input.displayName),
    kind,
    description: asText(input.description, 'Description', 5000),
    tags: [...new Set(tags)],
    notes: asText(input.notes, 'Design notes', 10000),
    data: rawData,
    presentation: normalizePresentation(input, 'needs-assets'),
    editorState: stateOf(input),
  };
}

const normalizers = {
  items: normalizeItem,
  creatures: normalizeCreature,
  resources: normalizeResource,
  recipes: normalizeRecipe,
  definitions: normalizeDefinition,
};

async function listDocuments(kind) {
  const root = roots[kind];
  const names = (await readdir(root)).filter(name => name.endsWith('.json')).sort();
  const result = [];
  for (const name of names) {
    try {
      const parsed = JSON.parse(await readFile(path.join(root, name), 'utf8'));
      result.push(parsed);
    } catch (error) {
      result.push({
        id: name.replace(/\.json$/i, ''),
        displayName: '(invalid draft file)',
        editorState: 'draft',
        _loadError: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return result.sort((a, b) => String(a.displayName).localeCompare(String(b.displayName)));
}

async function saveDocument(kind, input) {
  const document = normalizers[kind](input);
  const filePath = path.join(roots[kind], `${document.id}.json`);
  await writeFile(filePath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  return document;
}

async function assetBacklog() {
  const result = [];
  for (const kind of Object.keys(roots)) {
    const documents = await listDocuments(kind);
    for (const document of documents) {
      if (document?._loadError) continue;
      const presentation = document?.presentation;
      if (!presentation || presentation.assetState === 'final' || presentation.assetState === 'not-required') continue;
      result.push({
        kind,
        id: document.id,
        displayName: document.displayName,
        definitionKind: document.kind ?? null,
        assetState: presentation.assetState ?? 'needs-assets',
        iconAssetId: presentation.iconAssetId ?? null,
        modelAssetId: presentation.modelAssetId ?? null,
        portraitAssetId: presentation.portraitAssetId ?? null,
        animationSetAssetId: presentation.animationSetAssetId ?? null,
        notes: presentation.notes ?? '',
      });
    }
  }
  result.sort((a, b) => `${a.kind}/${a.displayName}`.localeCompare(`${b.kind}/${b.displayName}`));
  return result;
}

async function commitAndPush(message) {
  const status = await repoStatus();
  if (!status.pushAllowed) throw new Error('Refusing to commit/push from main/master or a detached HEAD. Open the editor from a dedicated data/editor branch.');
  if (status.changedFiles === 0) throw new Error('There are no draft content changes to commit.');

  await git(['add', '--', 'ContentData/Drafts']);
  const commitMessage = String(message ?? '').trim() || 'Update MassRPG data drafts';
  if (commitMessage.length > 120) throw new Error('Commit message must be 120 characters or less.');
  await git(['commit', '-m', commitMessage, '--', 'ContentData/Drafts']);
  await git(['push', 'origin', 'HEAD']);
  return {
    branch: await git(['branch', '--show-current']),
    commit: await git(['rev-parse', '--short', 'HEAD']),
  };
}

async function servePage(res, fileName) {
  const body = await readFile(path.join(publicRoot, fileName), 'utf8');
  text(res, 200, body, 'text/html; charset=utf-8');
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

    if (req.method === 'GET' && url.pathname === '/') {
      await servePage(res, 'home.html');
      return;
    }
    if (req.method === 'GET' && url.pathname === '/items') {
      await servePage(res, 'index.html');
      return;
    }
    if (req.method === 'GET' && ['/creatures', '/resources', '/recipes', '/definitions'].includes(url.pathname)) {
      await servePage(res, 'structured.html');
      return;
    }
    if (req.method === 'GET' && url.pathname === '/assets') {
      await servePage(res, 'assets.html');
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/status') {
      json(res, 200, await repoStatus());
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/asset-backlog') {
      json(res, 200, { entries: await assetBacklog() });
      return;
    }

    const match = url.pathname.match(/^\/api\/(items|creatures|resources|recipes|definitions)$/);
    if (match && req.method === 'GET') {
      const kind = match[1];
      const documents = await listDocuments(kind);
      json(res, 200, { kind, documents, [kind]: documents });
      return;
    }
    if (match && req.method === 'POST') {
      const kind = match[1];
      const document = await saveDocument(kind, await readBody(req));
      json(res, 200, { kind, document, status: await repoStatus() });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/commit') {
      const body = await readBody(req);
      json(res, 200, await commitAndPush(body.message));
      return;
    }

    json(res, 404, { error: 'Not found.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(error);
    json(res, 400, { error: message });
  }
});

server.listen(port, host, () => {
  console.log(`MassRPG online data editor: http://localhost:${port}`);
  console.log('For GitHub Codespaces, open the forwarded port in your browser and keep its visibility Private.');
  console.log('Draft saves write to ContentData/Drafts; Commit & Push is an explicit separate action.');
});
