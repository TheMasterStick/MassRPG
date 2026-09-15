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
const itemRoot = path.join(repoRoot, 'ContentData', 'Drafts', 'items');
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
const gatheringToolKinds = new Set([
  'None', 'Hatchet', 'Pickaxe', 'FishingNet', 'FishingRod', 'LobsterPot', 'Harpoon',
]);
const itemIdPattern = /^[a-z0-9][a-z0-9._-]{1,79}$/;

await mkdir(itemRoot, { recursive: true });

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
    if (total > 512 * 1024) throw new Error('Request body is too large.');
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

function asInteger(value, field, minimum = Number.MIN_SAFE_INTEGER, maximum = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    throw new Error(`${field} must be an integer between ${minimum} and ${maximum}.`);
  }
  return number;
}

function asBoolean(value, field) {
  if (typeof value !== 'boolean') throw new Error(`${field} must be true or false.`);
  return value;
}

function normalizeItem(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Item payload must be an object.');

  const id = String(input.id ?? '').trim();
  if (!itemIdPattern.test(id)) {
    throw new Error('Permanent ID must be 2-80 characters using lower-case a-z, 0-9, dot, underscore or hyphen.');
  }

  const displayName = String(input.displayName ?? '').trim();
  if (displayName.length < 1 || displayName.length > 100) throw new Error('Display name must be 1-100 characters.');

  const description = String(input.description ?? '');
  if (description.length > 2000) throw new Error('Description must be 2000 characters or less.');

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
  const editorState = input.editorState === 'ready-for-review' ? 'ready-for-review' : 'draft';

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
    editorState,
  };

  if (item.twoHanded && item.canDualWield) throw new Error('A two-handed item cannot also be dual-wieldable.');
  if (item.twoHanded && !item.allowedEquipmentSlots.includes('MainHand')) {
    throw new Error('Two-handed equipment must include MainHand as an allowed equipment slot.');
  }
  if (item.canDualWield && !item.allowedEquipmentSlots.includes('MainHand')) {
    throw new Error('Dual-wieldable equipment must include MainHand as an allowed equipment slot.');
  }

  return item;
}

async function listItems() {
  const names = (await readdir(itemRoot)).filter(name => name.endsWith('.json')).sort();
  const result = [];
  for (const name of names) {
    try {
      const parsed = JSON.parse(await readFile(path.join(itemRoot, name), 'utf8'));
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

async function saveItem(input) {
  const item = normalizeItem(input);
  const filePath = path.join(itemRoot, `${item.id}.json`);
  await writeFile(filePath, `${JSON.stringify(item, null, 2)}\n`, 'utf8');
  return item;
}

async function commitAndPush(message) {
  const status = await repoStatus();
  if (!status.pushAllowed) {
    throw new Error('Refusing to commit/push from main/master or a detached HEAD. Open the editor from a dedicated data/editor branch.');
  }
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

async function serveIndex(res) {
  const body = await readFile(path.join(publicRoot, 'index.html'), 'utf8');
  text(res, 200, body, 'text/html; charset=utf-8');
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

    if (req.method === 'GET' && url.pathname === '/') {
      await serveIndex(res);
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/status') {
      json(res, 200, await repoStatus());
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/items') {
      json(res, 200, { items: await listItems() });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/items') {
      const item = await saveItem(await readBody(req));
      json(res, 200, { item, status: await repoStatus() });
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
