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

export interface CharacterCreatorCallbacks {
  onStart: (appearance: CharacterAppearance) => Promise<void> | void;
  onBack: () => void;
}

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
  let renderToken = 0;

  const screen = document.createElement('div');
  screen.className = 'character-creator';

  const header = document.createElement('div');
  header.className = 'creator-header';
  const title = document.createElement('div');
  title.innerHTML = '<h1>Character Creator <span>(Test)</span></h1><p>Proof-of-concept layered character system using the current PNG set.</p>';
  const backBtn = document.createElement('button');
  backBtn.className = 'secondary';
  backBtn.textContent = '← Main Menu';
  backBtn.addEventListener('click', () => callbacks.onBack());
  header.append(title, backBtn);

  const body = document.createElement('div');
  body.className = 'creator-body';

  const previewPanel = document.createElement('section');
  previewPanel.className = 'creator-preview-panel';
  const previewCanvas = document.createElement('canvas');
  previewCanvas.width = 768;
  previewCanvas.height = 768;
  previewCanvas.className = 'creator-preview';

  const faceDetail = document.createElement('div');
  faceDetail.className = 'creator-face-detail';
  const faceLabel = document.createElement('div');
  faceLabel.className = 'creator-face-detail-label';
  faceLabel.textContent = 'Face detail';
  const faceCanvas = document.createElement('canvas');
  faceCanvas.width = 360;
  faceCanvas.height = 240;
  faceCanvas.className = 'creator-face-preview';
  faceDetail.append(faceLabel, faceCanvas);

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
      updateFacingButtons();
      void renderPreview();
    });
    facingButtons.set(def.facing, btn);
    facingRow.append(btn);
  }

  const previewHint = document.createElement('p');
  previewHint.className = 'creator-preview-hint';
  previewHint.textContent = 'Face detail always shows the front view. Body and hair support front, back, left and right; current facial feature assets are front-view only.';

  previewPanel.append(previewCanvas, faceDetail, facingRow, previewHint);

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

  function updateFacingButtons() {
    for (const [buttonFacing, btn] of facingButtons) {
      btn.classList.toggle('active', buttonFacing === facing);
    }
  }

  async function renderPreview() {
    const token = ++renderToken;
    const [preview, front] = await Promise.all([
      composeCharacterCanvas(appearance, facing),
      composeCharacterCanvas(appearance, 'down'),
    ]);
    if (token !== renderToken) return;

    const ctx = previewCanvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(preview, 0, 0, previewCanvas.width, previewCanvas.height);
    }

    const faceCtx = faceCanvas.getContext('2d');
    if (faceCtx) {
      faceCtx.clearRect(0, 0, faceCanvas.width, faceCanvas.height);
      faceCtx.imageSmoothingEnabled = false;
      const sourceX = 39;
      const sourceY = appearance.sex === 'male' ? 3 : 5;
      const sourceWidth = 50;
      const sourceHeight = 43;
      const scale = Math.min(faceCanvas.width / sourceWidth, faceCanvas.height / sourceHeight);
      const drawWidth = sourceWidth * scale;
      const drawHeight = sourceHeight * scale;
      const drawX = (faceCanvas.width - drawWidth) / 2;
      const drawY = (faceCanvas.height - drawHeight) / 2;
      faceCtx.drawImage(front, sourceX, sourceY, sourceWidth, sourceHeight, drawX, drawY, drawWidth, drawHeight);
    }
  }

  function changed() {
    appearance = readAppearance();
    saveCreatorDraft(appearance);
    void renderPreview();
  }

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
  updateFacingButtons();
  void renderPreview();
}
