import {
  CHARACTER_COUNTS,
  composeCharacterCanvas,
  loadCreatorDraft,
  normalizeAppearance,
  saveCreatorDraft,
  type CharacterAppearance,
  type CharacterFacing,
  type CharacterSex,
} from '../character/CharacterAppearance';
import {
  composeCreatorCharacterCanvas,
  CREATOR_CHARACTER_TILE_SIZE,
} from '../character/CreatorCharacterPreview';

export interface CharacterCreatorCallbacks {
  onStart: (appearance: CharacterAppearance) => Promise<void> | void;
  onBack: () => void;
}

type PreviewMode = 'body' | 'face';

function option(value: string, label: string): HTMLOptionElement {
  const el = document.createElement('option');
  el.value = value;
  el.textContent = label;
  return el;
}

function labelledControl(label: string, control: HTMLElement): HTMLLabelElement {
  const wrapper = document.createElement('label');
  wrapper.className = 'creator-control';
  const span = document.createElement('span');
  span.textContent = label;
  wrapper.append(span, control);
  return wrapper;
}

function fillStyleSelect(select: HTMLSelectElement, count: number, noneLabel = 'None') {
  const current = Number(select.value || 0);
  select.innerHTML = '';
  select.append(option('0', noneLabel));
  for (let i = 1; i <= count; i++) select.append(option(String(i), `Style ${i}`));
  select.value = String(Math.min(count, Math.max(0, current)));
}

function setSelected(select: HTMLSelectElement, value: number) {
  select.value = String(value);
}

export function mountCharacterCreator(root: HTMLElement, callbacks: CharacterCreatorCallbacks) {
  root.innerHTML = '';

  let appearance = loadCreatorDraft();
  let facing: CharacterFacing = 'down';
  let previewMode: PreviewMode = 'body';
  let renderToken = 0;

  const screen = document.createElement('div');
  screen.className = 'character-creator';

  const header = document.createElement('div');
  header.className = 'creator-header';
  const title = document.createElement('div');
  title.innerHTML = '<h1>Character Creator <span>(Test)</span></h1><p>Layered character builder. Creator preview uses a separate high-resolution art set from the in-world runtime sprite.</p>';
  const backBtn = document.createElement('button');
  backBtn.className = 'secondary';
  backBtn.textContent = '← Main Menu';
  backBtn.addEventListener('click', () => callbacks.onBack());
  header.append(title, backBtn);

  const body = document.createElement('div');
  body.className = 'creator-body';

  const previewPanel = document.createElement('section');
  previewPanel.className = 'creator-preview-panel';

  const viewModeRow = document.createElement('div');
  viewModeRow.className = 'creator-view-mode-row';
  const bodyViewBtn = document.createElement('button');
  bodyViewBtn.className = 'secondary';
  bodyViewBtn.textContent = 'Full Body';
  const faceViewBtn = document.createElement('button');
  faceViewBtn.className = 'secondary';
  faceViewBtn.textContent = 'Face';
  viewModeRow.append(bodyViewBtn, faceViewBtn);

  const previewCanvas = document.createElement('canvas');
  previewCanvas.width = CREATOR_CHARACTER_TILE_SIZE;
  previewCanvas.height = CREATOR_CHARACTER_TILE_SIZE;
  previewCanvas.className = 'creator-preview';

  const facingRow = document.createElement('div');
  facingRow.className = 'creator-facing-row';
  const facingButtons = new Map<CharacterFacing, HTMLButtonElement>();
  const facingDefs: { facing: CharacterFacing; label: string }[] = [
    { facing: 'down', label: 'Front' },
    { facing: 'up', label: 'Back' },
    { facing: 'left', label: 'Left' },
    { facing: 'right', label: 'Right' },
  ];
  for (const def of facingDefs) {
    const btn = document.createElement('button');
    btn.className = 'secondary';
    btn.textContent = def.label;
    btn.addEventListener('click', () => {
      facing = def.facing;
      updatePreviewControls();
      void renderPreview();
    });
    facingButtons.set(def.facing, btn);
    facingRow.append(btn);
  }

  const previewHint = document.createElement('p');
  previewHint.className = 'creator-preview-hint';

  previewPanel.append(viewModeRow, previewCanvas, facingRow, previewHint);

  const controls = document.createElement('section');
  controls.className = 'creator-controls';

  const sexSelect = document.createElement('select');
  sexSelect.append(option('female', 'Female'), option('male', 'Male'));
  sexSelect.value = appearance.sex;

  const hairSelect = document.createElement('select');
  const hairColor = document.createElement('input');
  hairColor.type = 'color';
  hairColor.value = appearance.hairColor;

  const eyeSelect = document.createElement('select');
  const eyeColor = document.createElement('input');
  eyeColor.type = 'color';
  eyeColor.value = appearance.eyeColor;

  const browSelect = document.createElement('select');
  const browColor = document.createElement('input');
  browColor.type = 'color';
  browColor.value = appearance.browColor;

  const noseSelect = document.createElement('select');
  const mouthSelect = document.createElement('select');

  controls.append(
    labelledControl('Body', sexSelect),
    labelledControl('Hair', hairSelect),
    labelledControl('Hair color', hairColor),
    labelledControl('Eyes', eyeSelect),
    labelledControl('Eye color', eyeColor),
    labelledControl('Eyebrows', browSelect),
    labelledControl('Eyebrow color', browColor),
    labelledControl('Nose', noseSelect),
    labelledControl('Mouth', mouthSelect),
  );

  const actions = document.createElement('div');
  actions.className = 'creator-actions';
  const resetBtn = document.createElement('button');
  resetBtn.className = 'secondary';
  resetBtn.textContent = 'Reset';
  const startBtn = document.createElement('button');
  startBtn.textContent = 'Start Test Character';
  actions.append(resetBtn, startBtn);
  controls.append(actions);

  body.append(previewPanel, controls);
  screen.append(header, body);
  root.append(screen);

  function rebuildStyleLists() {
    const counts = CHARACTER_COUNTS[appearance.sex];
    fillStyleSelect(hairSelect, counts.hair);
    fillStyleSelect(eyeSelect, counts.eyes);
    fillStyleSelect(browSelect, counts.brows);
    fillStyleSelect(noseSelect, counts.noses);
    fillStyleSelect(mouthSelect, counts.mouths);

    setSelected(hairSelect, appearance.hairStyle);
    setSelected(eyeSelect, appearance.eyeStyle);
    setSelected(browSelect, appearance.browStyle);
    setSelected(noseSelect, appearance.noseStyle);
    setSelected(mouthSelect, appearance.mouthStyle);
  }

  function readAppearance(): CharacterAppearance {
    return normalizeAppearance({
      sex: sexSelect.value as CharacterSex,
      hairStyle: Number(hairSelect.value),
      hairColor: hairColor.value,
      eyeStyle: Number(eyeSelect.value),
      eyeColor: eyeColor.value,
      browStyle: Number(browSelect.value),
      browColor: browColor.value,
      noseStyle: Number(noseSelect.value),
      mouthStyle: Number(mouthSelect.value),
    });
  }

  function syncControlsFromAppearance() {
    sexSelect.value = appearance.sex;
    hairColor.value = appearance.hairColor;
    eyeColor.value = appearance.eyeColor;
    browColor.value = appearance.browColor;
    rebuildStyleLists();
  }

  function updatePreviewControls() {
    bodyViewBtn.classList.toggle('active', previewMode === 'body');
    faceViewBtn.classList.toggle('active', previewMode === 'face');
    facingRow.hidden = previewMode === 'face';
    previewPanel.classList.toggle('face-mode', previewMode === 'face');

    for (const [buttonFacing, btn] of facingButtons) {
      btn.classList.toggle('active', buttonFacing === facing);
    }

    previewHint.textContent = previewMode === 'face'
      ? 'Face view uses the front-facing HD composition so eyes, eyebrows, nose, mouth and hair can be inspected clearly.'
      : 'Full body view uses the HD creator composition. Front, back, left and right body/hair views are available; facial features are currently front-view assets.';
  }

  async function getPreviewComposition(targetFacing: CharacterFacing): Promise<HTMLCanvasElement> {
    try {
      return await composeCreatorCharacterCanvas(appearance, targetFacing);
    } catch (error) {
      console.warn('HD creator assets unavailable; falling back to runtime character assets.', error);
      return composeCharacterCanvas(appearance, targetFacing);
    }
  }

  async function renderPreview() {
    const token = ++renderToken;
    const targetFacing: CharacterFacing = previewMode === 'face' ? 'down' : facing;
    const preview = await getPreviewComposition(targetFacing);
    if (token !== renderToken) return;

    const ctx = previewCanvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    ctx.imageSmoothingEnabled = false;

    if (previewMode === 'body') {
      ctx.drawImage(preview, 0, 0, previewCanvas.width, previewCanvas.height);
      return;
    }

    // HD face crop. Keep generous room for hairstyles and shoulders while making
    // the actual facial features several times larger than the full-body view.
    const sourceScale = preview.width / CREATOR_CHARACTER_TILE_SIZE;
    const cropX = 150 * sourceScale;
    const cropY = 0;
    const cropWidth = 212 * sourceScale;
    const cropHeight = 190 * sourceScale;
    const destWidth = previewCanvas.width;
    const destHeight = Math.round(destWidth * (cropHeight / cropWidth));
    const destY = Math.round((previewCanvas.height - destHeight) / 2);
    ctx.drawImage(
      preview,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      destY,
      destWidth,
      destHeight,
    );
  }

  function changed() {
    appearance = readAppearance();
    saveCreatorDraft(appearance);
    void renderPreview();
  }

  bodyViewBtn.addEventListener('click', () => {
    previewMode = 'body';
    updatePreviewControls();
    void renderPreview();
  });

  faceViewBtn.addEventListener('click', () => {
    previewMode = 'face';
    updatePreviewControls();
    void renderPreview();
  });

  sexSelect.addEventListener('change', () => {
    appearance = normalizeAppearance({ ...appearance, sex: sexSelect.value as CharacterSex });
    syncControlsFromAppearance();
    saveCreatorDraft(appearance);
    void renderPreview();
  });

  for (const control of [hairSelect, hairColor, eyeSelect, eyeColor, browSelect, browColor, noseSelect, mouthSelect]) {
    control.addEventListener('input', changed);
    control.addEventListener('change', changed);
  }

  resetBtn.addEventListener('click', () => {
    appearance = normalizeAppearance({ sex: sexSelect.value as CharacterSex });
    syncControlsFromAppearance();
    saveCreatorDraft(appearance);
    void renderPreview();
  });

  startBtn.addEventListener('click', async () => {
    appearance = readAppearance();
    saveCreatorDraft(appearance);
    startBtn.disabled = true;
    startBtn.textContent = 'Preparing character…';
    try {
      await callbacks.onStart(appearance);
    } finally {
      startBtn.disabled = false;
      startBtn.textContent = 'Start Test Character';
    }
  });

  syncControlsFromAppearance();
  updatePreviewControls();
  void renderPreview();
}
