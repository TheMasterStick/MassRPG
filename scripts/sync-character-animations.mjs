import { copyFile, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = path.join(repoRoot, 'public', 'sprites', 'character_animations');
const MIN_FRAME_BYTES = 12_000;

const sources = [
  { sex: 'female', motion: 'idle', facing: 'down', source: 'Female/Idle/femidle/frames', fps: 2.5, loop: true },
  { sex: 'male', motion: 'idle', facing: 'down', source: 'Male/Idle/maleidle/frames', fps: 2.5, loop: true },
  { sex: 'female', motion: 'walk', facing: 'right', source: 'Female/Walk/femwalkright/frames', fps: 8, loop: true },
  { sex: 'male', motion: 'walk', facing: 'right', source: 'Male/Walk/malewalkright/frames', fps: 9, loop: true },
  { sex: 'female', motion: 'run', facing: 'down', source: 'Female/Run/femrunsouth/frames', fps: 10, loop: true },
  { sex: 'male', motion: 'run', facing: 'down', source: 'Male/Run/malerunsouth/frames', fps: 9, loop: true },
  { sex: 'female', motion: 'run', facing: 'up', source: 'femrunnorth/frames', fps: 12, loop: true },
  { sex: 'male', motion: 'run', facing: 'up', source: 'malerunnorth/frames', fps: 11, loop: true },
  { sex: 'female', motion: 'axe', facing: 'right', source: 'Female/Gather/femaxe/frames', fps: 3.2, loop: true },
  { sex: 'male', motion: 'axe', facing: 'right', source: 'Male/Gather/maleaxe/frames', fps: 3.8, loop: true },
  { sex: 'female', motion: 'pickaxe', facing: 'right', source: 'Female/Gather/femalepickaxe/frames', fps: 3.8, loop: true },
  { sex: 'male', motion: 'pickaxe', facing: 'right', source: 'Male/Gather/malepickaxe/frames', fps: 3.8, loop: true },
];

function sequenceTarget(entry) {
  return path.join(outputRoot, entry.sex, entry.motion, entry.facing);
}

async function frameFiles(sourceDir) {
  const entries = await readdir(sourceDir, { withFileTypes: true });
  const candidates = entries
    .filter((entry) => entry.isFile() && /^frame_\d+\.png$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const kept = [];
  for (const name of candidates) {
    const info = await stat(path.join(sourceDir, name));
    if (info.size < MIN_FRAME_BYTES) {
      console.warn(`[character animations] skipping likely-empty ${path.relative(repoRoot, path.join(sourceDir, name))} (${info.size} bytes)`);
      continue;
    }
    kept.push(name);
  }
  return kept;
}

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

const manifest = {
  version: 1,
  renderHeightTiles: 1.7,
  anchorX: 0.5,
  anchorY: 1,
  characters: { female: {}, male: {} },
};

for (const entry of sources) {
  const sourceDir = path.join(repoRoot, entry.source);
  let files;
  try {
    files = await frameFiles(sourceDir);
  } catch {
    console.warn(`[character animations] source missing: ${entry.source}`);
    continue;
  }
  if (!files.length) {
    console.warn(`[character animations] no usable frames: ${entry.source}`);
    continue;
  }

  const targetDir = sequenceTarget(entry);
  await mkdir(targetDir, { recursive: true });
  const urls = [];
  for (const file of files) {
    await copyFile(path.join(sourceDir, file), path.join(targetDir, file));
    urls.push(`/sprites/character_animations/${entry.sex}/${entry.motion}/${entry.facing}/${file}`);
  }

  manifest.characters[entry.sex][entry.motion] ??= {};
  manifest.characters[entry.sex][entry.motion][entry.facing] = {
    frames: urls,
    fps: entry.fps,
    loop: entry.loop,
    source: entry.source,
  };
}

await writeFile(path.join(outputRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`[character animations] prepared ${sources.length} source sequences in ${path.relative(repoRoot, outputRoot)}`);
