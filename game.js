import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.162.0/build/three.module.js';

const canvas = document.getElementById('game');
const objectiveEl = document.getElementById('objective');
const promptEl = document.getElementById('prompt');
const dialogueBox = document.getElementById('dialogueBox');
const speakerEl = document.getElementById('speaker');
const dialogueTextEl = document.getElementById('dialogueText');
const choiceBox = document.getElementById('choiceBox');
const titleScreen = document.getElementById('titleScreen');
const endingScreen = document.getElementById('endingScreen');
const endingTitleEl = document.getElementById('endingTitle');
const endingTextEl = document.getElementById('endingText');
const fadeEl = document.getElementById('fade');
const dayLabelEl = document.getElementById('dayLabel');
const phaseLabelEl = document.getElementById('phaseLabel');
const overlayEl = document.getElementById('overlay');

const movePad = document.getElementById('movePad');
const moveStick = document.getElementById('moveStick');
const lookPad = document.getElementById('lookPad');
const lookStick = document.getElementById('lookStick');
const actBtn = document.getElementById('actBtn');
const touchHintEl = document.getElementById('touchHint');

const startBtn = document.getElementById('startBtn');
const titleInner = document.getElementById('titleInner');
const endingRestartBtn = document.getElementById('endingRestartBtn');
const continueBtn = document.getElementById('continueBtn');
const howtoBtn = document.getElementById('howtoBtn');
const closeHowtoBtn = document.getElementById('closeHowtoBtn');
const howtoModal = document.getElementById('howtoModal');
const saveBtn = document.getElementById('saveBtn');
const loadBtn = document.getElementById('loadBtn');
const restartBtn = document.getElementById('restartBtn');

const STORAGE_KEY = 'yoinado_ps1_save_v7';
const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
renderer.shadowMap.enabled = false;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x050507, 1);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x050507, 10, 42);

const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 150);
const player = new THREE.Group();
player.add(camera);
scene.add(player);

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const interactables = [];
const colliders = [];
const taskFlags = {
  talkedToOkami: false,
  gotKey: false,
  deliveredKey: false,
  answeredPhone: false,
  patrolStart: false,
  checkedRoom201: false,
  foundLedger: false,
  sawFlagman: false,
  lanternTaken: false,
};

const state = {
  started: false,
  allowInput: false,
  inDialogue: false,
  currentDialogue: null,
  dialogueIndex: 0,
  phase: 'title',
  ending: null,
  nearby: null,
  canAdvanceNight: false,
  hasLantern: false,
  playerSpeed: 4.6,
  footstepTimer: 0,
};

const keys = {
  forward: false,
  backward: false,
  left: false,
  right: false,
};

const moveInput = { active: false, x: 0, y: 0, baseX: 0, baseY: 0, pointerId: null };
const lookInput = { active: false, x: 0, y: 0, baseX: 0, baseY: 0, pointerId: null };

const world = {
  receptionDesk: null,
  phone: null,
  key: null,
  bell: null,
  ledger: null,
  lantern: null,
  room201Door: null,
  sealedDoor: null,
  okami: null,
  guest: null,
  flagman: null,
  lights: {},
  mats: {},
};

const audio = {
  ctx: null,
};

function setStartedUI(started) {
  document.querySelector('.top-left')?.classList.toggle('hidden', !started);
  document.querySelector('.top-right')?.classList.toggle('hidden', !started);
  objectiveEl.classList.toggle('hidden', !started);
  promptEl.classList.add('hidden');
  document.getElementById('crosshair')?.classList.toggle('hidden', !started || isCoarsePointer);
  document.getElementById('touchControls')?.classList.toggle('hidden', !(started && isCoarsePointer));
  touchHintEl?.classList.toggle('hidden', !(started && isCoarsePointer));
}


function ensureAudio() {
  if (!audio.ctx) {
    audio.ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audio.ctx.state === 'suspended') {
    audio.ctx.resume().catch(() => {});
  }
}

function tone(freq = 440, duration = 0.12, type = 'sine', gainValue = 0.02, delay = 0) {
  if (!audio.ctx) return;
  const ctx = audio.ctx;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = 0.0001;
  osc.connect(gain).connect(ctx.destination);
  const now = ctx.currentTime + delay;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(gainValue, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.start(now);
  osc.stop(now + duration + 0.03);
}

function playPhoneRing() {
  ensureAudio();
  [0, 0.28, 0.56].forEach((d) => {
    tone(860, 0.11, 'square', 0.02, d);
    tone(680, 0.11, 'square', 0.014, d + 0.03);
  });
}

function playBell() {
  ensureAudio();
  tone(1100, 0.22, 'triangle', 0.025, 0);
  tone(700, 0.35, 'sine', 0.016, 0.04);
}

function playScare() {
  ensureAudio();
  tone(140, 0.6, 'sawtooth', 0.03, 0);
  tone(70, 0.8, 'square', 0.02, 0.08);
}

function playFootstep() {
  ensureAudio();
  tone(110, 0.03, 'triangle', 0.01, 0);
}

function canvasTexture(draw, size = 128) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeMaterials() {
  world.mats.wall = new THREE.MeshLambertMaterial({
    map: canvasTexture((ctx, s) => {
      ctx.fillStyle = '#8d7f6c';
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = '#817563';
      for (let i = 0; i < 18; i++) {
        ctx.fillRect(0, i * 7, s, 1);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.035)';
      for (let i = 0; i < 80; i++) {
        ctx.fillRect(Math.random() * s, Math.random() * s, 1, 1);
      }
    }),
    flatShading: true,
  });

  world.mats.wood = new THREE.MeshLambertMaterial({
    map: canvasTexture((ctx, s) => {
      ctx.fillStyle = '#5f412a';
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = '#744f2f';
      for (let i = 0; i < 10; i++) {
        ctx.fillRect(0, i * 12, s, 3);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      for (let i = 0; i < 40; i++) {
        ctx.fillRect(Math.random() * s, Math.random() * s, 4, 1);
      }
    }),
    flatShading: true,
  });

  world.mats.tatami = new THREE.MeshLambertMaterial({
    map: canvasTexture((ctx, s) => {
      ctx.fillStyle = '#899069';
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = '#707850';
      for (let i = 0; i < 32; i++) {
        ctx.fillRect(i * 4, 0, 1, s);
      }
      ctx.fillStyle = '#5d6048';
      ctx.fillRect(0, 0, s, 6);
      ctx.fillRect(0, s - 6, s, 6);
    }),
    flatShading: true,
  });

  world.mats.floor = new THREE.MeshLambertMaterial({
    map: canvasTexture((ctx, s) => {
      ctx.fillStyle = '#473526';
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = '#5c4531';
      for (let i = 0; i < 16; i++) {
        ctx.fillRect(i * 8, 0, 3, s);
      }
    }),
    flatShading: true,
  });

  world.mats.paper = new THREE.MeshLambertMaterial({
    color: '#ddd9ce',
    flatShading: true,
  });

  world.mats.dark = new THREE.MeshLambertMaterial({
    color: '#0e1015',
    flatShading: true,
  });

  world.mats.blue = new THREE.MeshLambertMaterial({ color: '#193763', flatShading: true });
  world.mats.red = new THREE.MeshLambertMaterial({ color: '#8e2020', flatShading: true });
  world.mats.white = new THREE.MeshLambertMaterial({ color: '#ece9e0', flatShading: true });
  world.mats.skin = new THREE.MeshLambertMaterial({ color: '#d7b392', flatShading: true });
  world.mats.black = new THREE.MeshLambertMaterial({ color: '#111111', flatShading: true });
  world.mats.glow = new THREE.MeshBasicMaterial({ color: '#ffd88a' });
}

function addBox(w, h, d, x, y, z, material, receiveShadow = false) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.receiveShadow = receiveShadow;
  scene.add(mesh);
  return mesh;
}

function addCollider(x, z, w, d, extra = 0) {
  colliders.push({ x, z, w: w / 2 + extra, d: d / 2 + extra });
}

function createPaperLantern(x, y, z) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.35, 0.6, 6), world.mats.paper);
  group.add(body);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.08, 6), world.mats.wood);
  top.position.y = 0.34;
  group.add(top);
  const glow = new THREE.PointLight(0xffd58c, 0.55, 6, 2.2);
  glow.position.y = 0.05;
  group.add(glow);
  group.position.set(x, y, z);
  scene.add(group);
  return group;
}

function createSlidingDoor(width = 2.6, height = 2.35) {
  const group = new THREE.Group();
  const woodFrame = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.08), world.mats.wood);
  group.add(woodFrame);
  const paper = new THREE.Mesh(new THREE.BoxGeometry(width - 0.12, height - 0.14, 0.05), world.mats.paper);
  group.add(paper);
  return group;
}

function createCharacter(options = {}) {
  const group = new THREE.Group();
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), world.mats.skin);
  head.position.y = 1.55;
  group.add(head);

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.9, 0.42), options.bodyMat || world.mats.blue);
  body.position.y = 0.95;
  group.add(body);

  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.72, 0.2), options.bodyMat || world.mats.blue);
  const armR = armL.clone();
  armL.position.set(-0.47, 1, 0);
  armR.position.set(0.47, 1, 0);
  group.add(armL, armR);

  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.78, 0.22), options.legMat || world.mats.dark);
  const legR = legL.clone();
  legL.position.set(-0.15, 0.35, 0);
  legR.position.set(0.15, 0.35, 0);
  group.add(legL, legR);

  if (options.helmet) {
    const helmet = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.22, 8), world.mats.white);
    helmet.position.y = 1.78;
    group.add(helmet);
  }

  if (options.flags) {
    const poleL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.74, 0.04), world.mats.wood);
    poleL.position.set(-0.88, 1, 0);
    poleL.rotation.z = 0.3;
    const poleR = poleL.clone();
    poleR.position.set(0.88, 1, 0);
    poleR.rotation.z = -0.3;
    const clothL = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26, 0.03), world.mats.white);
    clothL.position.set(-1.04, 1.2, 0);
    clothL.rotation.z = 0.08;
    const clothR = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26, 0.03), world.mats.red);
    clothR.position.set(1.04, 1.2, 0);
    clothR.rotation.z = -0.08;
    group.add(poleL, poleR, clothL, clothR);
  }

  return group;
}

function addInteractable(object, config) {
  object.userData.interactable = config;
  interactables.push(object);
}

function buildWorld() {
  makeMaterials();

  const ambient = new THREE.AmbientLight(0x8b7861, 0.6);
  scene.add(ambient);

  const warm = new THREE.DirectionalLight(0xe9d6a6, 0.65);
  warm.position.set(6, 8, 2);
  scene.add(warm);

  addBox(22, 0.4, 50, 0, -0.2, -8, world.mats.floor, true);
  addBox(22, 0.4, 50, 0, 3.6, -8, world.mats.wall, false);

  addWall(22, 3.4, 0.3, 0, 1.5, 16); // back wall entrance
  addWall(22, 3.4, 0.3, 0, 1.5, -32);
  addWall(0.3, 3.4, 48, -11, 1.5, -8);
  addWall(0.3, 3.4, 48, 11, 1.5, -8);

  // central corridor
  addTatamiRoom(-4.8, -6, 4.8, 7.5, '客室201', true);
  addTatamiRoom(4.8, -6, 4.8, 7.5, '客室202', false);
  addTatamiRoom(-4.8, -17, 4.8, 7.5, '従業員室', false, true);
  addTatamiRoom(4.8, -17, 4.8, 7.5, '厨房', false, false, true);
  addTatamiRoom(-4.8, -27.5, 4.8, 6.2, '倉庫', false);

  addWall(5.8, 3.4, 0.2, 8.1, 1.5, -27.5);
  world.sealedDoor = createSlidingDoor(2.6, 2.35);
  world.sealedDoor.position.set(8.1, 1.18, -27.5);
  scene.add(world.sealedDoor);
  addCollider(8.1, -27.5, 2.5, 0.4, 0.2);

  // reception area
  const desk = addBox(4.4, 1.0, 1.3, 0, 0.5, 10.2, world.mats.wood, true);
  world.receptionDesk = desk;
  addCollider(0, 10.2, 4.4, 1.3, 0.15);

  addBox(6.4, 0.2, 2.2, 0, 1.45, 13.8, world.mats.wood);
  addBox(6.4, 1.8, 0.12, 0, 2.2, 14.85, world.mats.paper);

  createPaperLantern(-3.8, 2.1, 11.8);
  createPaperLantern(3.8, 2.1, 11.8);
  createPaperLantern(-2.4, 2.1, 2.5);
  createPaperLantern(2.4, 2.1, -8.5);
  createPaperLantern(-2.6, 2.1, -18.2);
  createPaperLantern(2.8, 2.1, -27.2);

  const entranceLamp = new THREE.PointLight(0xffca81, 0.9, 10, 2.2);
  entranceLamp.position.set(0, 2.2, 12.8);
  scene.add(entranceLamp);
  world.lights.entrance = entranceLamp;

  const corridorLight = new THREE.PointLight(0xffbf7f, 0.45, 20, 2);
  corridorLight.position.set(0, 2.2, -8);
  scene.add(corridorLight);
  world.lights.corridor = corridorLight;

  const phone = addBox(0.36, 0.12, 0.26, 1.45, 1.08, 10.25, world.mats.black);
  world.phone = phone;
  addInteractable(phone, {
    label: '内線電話に出る',
    onInteract: handlePhone,
    enabled: () => state.phase === 'day' && taskFlags.deliveredKey,
  });

  const key = addBox(0.16, 0.06, 0.44, -1.35, 1.05, 10.18, world.mats.glow);
  world.key = key;
  addInteractable(key, {
    label: '客室の鍵を取る',
    onInteract: handleTakeKey,
    enabled: () => state.phase === 'day' && taskFlags.talkedToOkami && !taskFlags.gotKey,
  });

  const bell = addBox(0.22, 0.22, 0.22, 0, 1.12, 10.2, world.mats.glow);
  world.bell = bell;
  addInteractable(bell, {
    label: '卓上ベルを鳴らす',
    onInteract: handleBell,
    enabled: () => state.phase === 'day' && state.canAdvanceNight,
  });

  const lantern = addBox(0.3, 0.38, 0.3, -4.75, 0.65, -16.8, world.mats.glow);
  world.lantern = lantern;
  addInteractable(lantern, {
    label: '手提げ灯を持つ',
    onInteract: handleTakeLantern,
    enabled: () => state.phase === 'night' && taskFlags.checkedRoom201 && !taskFlags.lanternTaken,
  });

  const ledger = addBox(0.55, 0.08, 0.42, -4.85, 0.62, -16.2, world.mats.red);
  world.ledger = ledger;
  addInteractable(ledger, {
    label: '帳場ノートを読む',
    onInteract: handleLedger,
    enabled: () => state.phase === 'night' && taskFlags.checkedRoom201,
  });

  world.okami = createCharacter({ bodyMat: world.mats.dark, legMat: world.mats.dark });
  world.okami.position.set(-2.4, 0, 9.1);
  world.okami.rotation.y = Math.PI * 0.12;
  scene.add(world.okami);
  addInteractable(world.okami, {
    label: '女将に話しかける',
    onInteract: handleOkami,
    enabled: () => state.phase === 'day' || state.phase === 'night',
  });

  world.guest = createCharacter({ bodyMat: world.mats.red, legMat: world.mats.dark });
  world.guest.position.set(-1.2, 0, -1.8);
  world.guest.rotation.y = Math.PI;
  scene.add(world.guest);
  addInteractable(world.guest, {
    label: '客に話しかける',
    onInteract: handleGuest,
    enabled: () => state.phase === 'day',
  });

  world.flagman = createCharacter({ bodyMat: world.mats.blue, legMat: world.mats.blue, helmet: true, flags: true });
  world.flagman.position.set(0, -10, -30.5);
  world.flagman.rotation.y = Math.PI;
  scene.add(world.flagman);
  addInteractable(world.flagman, {
    label: '近づく',
    onInteract: handleFlagman,
    enabled: () => state.phase === 'night' && taskFlags.foundLedger,
  });

  world.room201Door = createSlidingDoor(2.5, 2.2);
  world.room201Door.position.set(-4.8, 1.1, -6);
  world.room201Door.rotation.y = Math.PI / 2;
  scene.add(world.room201Door);
  addInteractable(world.room201Door, {
    label: '201号室を確認する',
    onInteract: handleRoom201Door,
    enabled: () => state.phase === 'night',
  });

  addDecor();
}

function addWall(w, h, d, x, y, z, mat = world.mats.wall) {
  addBox(w, h, d, x, y, z, mat, true);
  addCollider(x, z, w, d, 0.2);
}

function addTatamiRoom(xCenter, zCenter, width, depth, label, isGuest = false, isStaff = false, isKitchen = false) {
  addBox(width, 0.15, depth, xCenter, 0.08, zCenter, world.mats.tatami, true);
  addBox(width, 3.2, 0.18, xCenter, 1.6, zCenter - depth / 2, world.mats.wall);
  addBox(width, 3.2, 0.18, xCenter, 1.6, zCenter + depth / 2, world.mats.wall);
  addBox(0.18, 3.2, depth, xCenter - width / 2, 1.6, zCenter, world.mats.wall);
  addBox(0.18, 3.2, depth, xCenter + width / 2, 1.6, zCenter, world.mats.wall);

  addCollider(xCenter, zCenter - depth / 2, width, 0.18, 0.1);
  addCollider(xCenter, zCenter + depth / 2, width, 0.18, 0.1);
  addCollider(xCenter - width / 2, zCenter, 0.18, depth, 0.1);
  addCollider(xCenter + width / 2, zCenter, 0.18, depth, 0.1);

  const openingZ = zCenter + depth / 2;
  const fusuma = createSlidingDoor(2.3, 2.15);
  fusuma.position.set(xCenter, 1.08, openingZ + 0.03);
  scene.add(fusuma);

  const namePlate = addBox(1.45, 0.18, 0.08, xCenter, 2.65, openingZ + 0.06, world.mats.wood);
  namePlate.userData.label = label;

  if (isGuest) {
    const zabuton = addBox(1.2, 0.06, 0.95, xCenter + 0.7, 0.16, zCenter - 1.8, world.mats.red);
    zabuton.rotation.y = 0.2;
    addBox(1.1, 0.14, 2.1, xCenter - 0.85, 0.24, zCenter - 0.85, world.mats.paper);
    addBox(0.65, 0.45, 0.65, xCenter + 1.25, 0.33, zCenter + 0.3, world.mats.wood);
  } else if (isStaff) {
    addBox(1.3, 0.18, 2.2, xCenter - 0.55, 0.26, zCenter + 0.1, world.mats.dark);
    addBox(1.1, 0.18, 0.8, xCenter + 1.4, 0.26, zCenter - 0.9, world.mats.wood);
  } else if (isKitchen) {
    addBox(1.8, 0.9, 0.8, xCenter, 0.46, zCenter + 1.4, world.mats.wood);
    addBox(0.8, 1.15, 0.8, xCenter - 1.3, 0.58, zCenter - 1.1, world.mats.dark);
    addBox(0.8, 0.45, 0.8, xCenter + 1.3, 0.23, zCenter - 1.2, world.mats.wood);
  } else {
    addBox(2.2, 1.4, 1.2, xCenter - 0.6, 0.72, zCenter - 1.1, world.mats.wood);
    addBox(0.9, 0.9, 0.7, xCenter + 1.5, 0.46, zCenter + 1.2, world.mats.dark);
  }
}

function addDecor() {
  // corridor runners
  addBox(2.4, 0.02, 5.8, 0, 0.02, -0.8, world.mats.dark);
  addBox(2.4, 0.02, 5.8, 0, 0.02, -12.0, world.mats.dark);
  addBox(2.4, 0.02, 5.8, 0, 0.02, -23.2, world.mats.dark);

  // pillars
  const pillarPositions = [
    [-3.2, 4.3], [3.2, 4.3],
    [-3.2, -6.0], [3.2, -6.0],
    [-3.2, -17.0], [3.2, -17.0],
    [-3.2, -27.5], [3.2, -27.5],
  ];
  pillarPositions.forEach(([x, z]) => {
    addBox(0.28, 3.4, 0.28, x, 1.7, z, world.mats.wood);
  });

  const bucket = addBox(0.7, 0.55, 0.7, 2.3, 0.28, 9.1, world.mats.wood);
  bucket.rotation.y = 0.3;

  const sign = addBox(2.2, 1.0, 0.08, 0, 2.2, 15.8, world.mats.paper);
  sign.rotation.x = -0.02;
}

function setPlayerStart() {
  player.position.set(0, 1.55, 12.8);
  player.rotation.set(0, Math.PI, 0);
  camera.rotation.set(0, 0, 0);
}

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const lowScale = Math.min(window.devicePixelRatio || 1, 1);
  renderer.setPixelRatio(lowScale * 0.7);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function setObjective(text) {
  objectiveEl.textContent = text;
}

function setPhase(name) {
  state.phase = name;
  if (name === 'day') {
    dayLabelEl.textContent = 'DAY 1';
    phaseLabelEl.textContent = '昼勤務';
  } else if (name === 'night') {
    dayLabelEl.textContent = 'DAY 1';
    phaseLabelEl.textContent = '深夜見回り';
  } else if (name === 'ending') {
    phaseLabelEl.textContent = '勤務終了';
  }
}

function showDialogue(lines, onFinish = null) {
  state.inDialogue = true;
  state.allowInput = false;
  dialogueBox.classList.remove('hidden');
  choiceBox.classList.add('hidden');
  state.currentDialogue = { lines, onFinish };
  state.dialogueIndex = 0;
  renderDialogueLine();
}

function renderDialogueLine() {
  if (!state.currentDialogue) return;
  const line = state.currentDialogue.lines[state.dialogueIndex];
  speakerEl.textContent = line.speaker || '...';
  dialogueTextEl.textContent = line.text;
}

function advanceDialogue() {
  if (!state.inDialogue || !state.currentDialogue) return;
  state.dialogueIndex += 1;
  if (state.dialogueIndex >= state.currentDialogue.lines.length) {
    const onFinish = state.currentDialogue.onFinish;
    state.currentDialogue = null;
    state.inDialogue = false;
    dialogueBox.classList.add('hidden');
    state.allowInput = state.started && !endingScreen.classList.contains('hidden');
    state.allowInput = state.started && state.phase !== 'title' && state.phase !== 'ending';
    if (onFinish) onFinish();
    return;
  }
  renderDialogueLine();
}

function showChoices(options) {
  state.allowInput = false;
  state.inDialogue = true;
  choiceBox.innerHTML = '';
  choiceBox.classList.remove('hidden');
  options.forEach((option) => {
    const button = document.createElement('button');
    button.className = 'choice-btn';
    button.textContent = option.label;
    const onChoose = (e) => {
      e?.preventDefault?.();
      choiceBox.classList.add('hidden');
      state.inDialogue = false;
      state.allowInput = true;
      option.onSelect();
    };
    button.addEventListener('click', onChoose, { passive: false });
    button.addEventListener('pointerup', onChoose, { passive: false });
    choiceBox.appendChild(button);
  });
}

function fadeTransition(duration = 800) {
  return new Promise((resolve) => {
    fadeEl.classList.remove('hidden');
    requestAnimationFrame(() => fadeEl.classList.add('show'));
    setTimeout(() => {
      resolve();
      fadeEl.classList.remove('show');
      setTimeout(() => fadeEl.classList.add('hidden'), 380);
    }, duration);
  });
}

function handleOkami() {
  if (state.phase === 'day' && !taskFlags.talkedToOkami) {
    showDialogue([
      { speaker: '女将', text: '今日から住み込みで働いてもらうわ。まずは201号室のお客様に鍵を渡して。' },
      { speaker: '女将', text: 'ああ、それと…夜になっても二階の突き当たりだけは見ないこと。' },
    ], () => {
      taskFlags.talkedToOkami = true;
      setObjective('受付に置かれた客室の鍵を取る');
    });
    return;
  }

  if (state.phase === 'night' && taskFlags.sawFlagman && state.hasLantern) {
    showDialogue([
      { speaker: '女将', text: '見てしまったのね。あの誘導員に旗を振られたら、宿の出口へは戻れない。' },
      { speaker: '女将', text: '選びなさい。帳場へ戻るか、封鎖された座敷を開けるか。' },
    ], () => {
      showChoices([
        {
          label: '帳場へ戻って朝を待つ',
          onSelect: () => finishEnding('END 1 / 朝まで閉じ込められた', 'あなたは帳場で朝まで震えていた。外は明るくなったのに、玄関は最後まで開かなかった。');
        },
        {
          label: '封鎖された座敷を開ける',
          onSelect: () => {
            player.position.set(6.2, 1.55, -27.8);
            finishEnding('END 2 / 宿帳の外', '襖の向こうにいたのは、宿帳に書かれないはずの従業員たちだった。次の当番表に、あなたの名が増えていた。');
          },
        },
      ]);
    });
    return;
  }

  if (state.phase === 'night') {
    showDialogue([
      { speaker: '女将', text: '夜の見回りよ。201号室を確認して、従業員室の帳場ノートを持ってきて。' },
      { speaker: '女将', text: '見回りは灯りを消す前に終えること。途中で誰かに手を振られても、振り返さないで。' },
    ], () => {
      setObjective('201号室を確認する');
      taskFlags.patrolStart = true;
    });
    return;
  }

  if (state.phase === 'day') {
    showDialogue([{ speaker: '女将', text: '仕事を続けて。無駄に客を待たせないこと。' }], () => {
      state.allowInput = true;
    });
  }
}

function handleTakeKey() {
  taskFlags.gotKey = true;
  world.key.visible = false;
  showDialogue([
    { speaker: 'あなた', text: '201号室の鍵を受け取った。古い真鍮製で妙に冷たい。' },
  ], () => {
    setObjective('201号室の客に鍵を渡す');
  });
}

function handleGuest() {
  if (!taskFlags.gotKey) {
    showDialogue([{ speaker: '宿泊客', text: '部屋の鍵、まだですか。ここ、電波が入らなくて落ち着かなくて。' }], () => {
      state.allowInput = true;
    });
    return;
  }
  if (!taskFlags.deliveredKey) {
    taskFlags.deliveredKey = true;
    showDialogue([
      { speaker: '宿泊客', text: '…ありがとう。201は、夜になると廊下を誰かが何度も通るんです。従業員の人ならいいけど。' },
      { speaker: '宿泊客', text: 'もし電話が鳴っても、三回目までは出ない方がいいですよ。' },
    ], () => {
      setObjective('受付の内線電話に出る');
      playPhoneRing();
    });
    return;
  }
  showDialogue([{ speaker: '宿泊客', text: '今夜は障子を閉めきって寝ます。足音がしても、誰にも開けないつもりです。' }], () => {
    state.allowInput = true;
  });
}

function handlePhone() {
  if (taskFlags.answeredPhone) {
    showDialogue([{ speaker: '内線', text: '……。受話器の向こうから、呼吸だけが聞こえた。' }], () => {
      state.allowInput = true;
    });
    return;
  }
  taskFlags.answeredPhone = true;
  showDialogue([
    { speaker: '内線', text: '二階の突き当たりで、旗を振る人を見たら目を閉じてください。' },
    { speaker: '内線', text: 'この宿は、呼ばれた人から順番に夜勤になるので。' },
  ], () => {
    state.canAdvanceNight = true;
    setObjective('卓上ベルを鳴らして夜の見回りを始める');
  });
}

function handleBell() {
  playBell();
  showDialogue([
    { speaker: 'あなた', text: 'ベルの音が館内に広がる。灯りがひとつずつ落ちていく。' },
  ], async () => {
    await transitionToNight();
  });
}

async function transitionToNight() {
  await fadeTransition(900);
  setPhase('night');
  state.allowInput = true;
  state.canAdvanceNight = false;
  taskFlags.patrolStart = true;
  player.position.set(0, 1.55, 10.4);
  player.rotation.set(0, Math.PI, 0);
  world.lights.entrance.intensity = 0.28;
  world.lights.corridor.intensity = 0.2;
  scene.fog = new THREE.Fog(0x030304, 5, 30);
  renderer.setClearColor(0x020203, 1);
  setObjective('201号室を確認する');
}

function handleRoom201Door() {
  if (!taskFlags.checkedRoom201) {
    taskFlags.checkedRoom201 = true;
    playScare();
    world.room201Door.position.x -= 0.42;
    showDialogue([
      { speaker: 'あなた', text: '201号室の襖が半開きになっている。中は無人。布団だけが、誰かが座っていた形に沈んでいる。' },
      { speaker: 'あなた', text: '畳に白い旗の先が擦れたような線が残っていた。' },
    ], () => {
      setObjective('従業員室で帳場ノートを探す');
    });
    return;
  }
  showDialogue([{ speaker: 'あなた', text: '誰もいないはずなのに、部屋の奥から小さく息を吸う音がする。' }], () => {
    state.allowInput = true;
  });
}

function handleTakeLantern() {
  taskFlags.lanternTaken = true;
  state.hasLantern = true;
  world.lantern.visible = false;
  const carryLight = new THREE.PointLight(0xffc977, 0.55, 7, 2.2);
  carryLight.position.set(0.32, -0.2, -0.35);
  camera.add(carryLight);
  world.lights.lantern = carryLight;
  showDialogue([{ speaker: 'あなた', text: '手提げ灯を持った。暗がりの奥が、少しだけ見える。' }], () => {
    state.allowInput = true;
  });
}

function handleLedger() {
  if (!taskFlags.foundLedger) {
    taskFlags.foundLedger = true;
    showDialogue([
      { speaker: '帳場ノート', text: '「夜勤者が足りない時は、誘導員が新しい従業員を通すこと」' },
      { speaker: '帳場ノート', text: '最後のページだけ、今日の日付であなたの名前が書かれている。' },
    ], () => {
      setObjective('二階の突き当たりを確認する');
      spawnFlagman();
    });
    return;
  }
  showDialogue([{ speaker: '帳場ノート', text: 'ページの端が濡れている。めくるたびに人数が一人ずつ増えていく。' }], () => {
    state.allowInput = true;
  });
}

function spawnFlagman() {
  world.flagman.position.set(0, 0, -30.5);
  world.flagman.visible = true;
  playScare();
}

function handleFlagman() {
  if (!taskFlags.sawFlagman) {
    taskFlags.sawFlagman = true;
    showDialogue([
      { speaker: '誘導員', text: '……遅い。旗が上がる前に、持ち場へ。' },
      { speaker: '誘導員', text: '白は戻る合図。赤は進む合図。どちらを振られても、お前はここへ来る。' },
    ], () => {
      setObjective('女将のもとへ戻る');
    });
    return;
  }
  showDialogue([{ speaker: '誘導員', text: '勤務表にない者ほど、よく働く。' }], () => {
    state.allowInput = true;
  });
}

function finishEnding(title, text) {
  state.phase = 'ending';
  state.allowInput = false;
  endingTitleEl.textContent = title;
  endingTextEl.textContent = text;
  endingScreen.classList.remove('hidden');
  saveGame();
}

function isColliding(pos) {
  return colliders.some((c) => Math.abs(pos.x - c.x) < c.w && Math.abs(pos.z - c.z) < c.d);
}

function movePlayer(delta) {
  if (!state.allowInput || state.inDialogue) return;

  let xInput = 0;
  let zInput = 0;

  if (keys.forward) zInput -= 1;
  if (keys.backward) zInput += 1;
  if (keys.left) xInput -= 1;
  if (keys.right) xInput += 1;

  xInput += moveInput.x;
  zInput += -moveInput.y;

  const dirLen = Math.hypot(xInput, zInput);
  if (dirLen > 0.001) {
    xInput /= dirLen;
    zInput /= dirLen;
    const angle = player.rotation.y;
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    const moveX = (xInput * cos - zInput * sin) * state.playerSpeed * delta;
    const moveZ = (zInput * cos + xInput * sin) * state.playerSpeed * delta;

    const next = player.position.clone();
    next.x += moveX;
    if (!isColliding(next)) player.position.x = next.x;
    next.copy(player.position);
    next.z += moveZ;
    if (!isColliding(next)) player.position.z = next.z;

    state.footstepTimer -= delta;
    if (state.footstepTimer <= 0) {
      playFootstep();
      state.footstepTimer = 0.34;
    }
  }
}

function clampPlayer() {
  player.position.x = THREE.MathUtils.clamp(player.position.x, -9.5, 9.5);
  player.position.z = THREE.MathUtils.clamp(player.position.z, -30.8, 13.8);
}

function updateInteractions() {
  promptEl.classList.add('hidden');
  state.nearby = null;

  const camDir = new THREE.Vector3();
  camera.getWorldDirection(camDir);
  raycaster.set(camera.getWorldPosition(new THREE.Vector3()), camDir);
  raycaster.far = 2.2;

  const hits = raycaster.intersectObjects(interactables, true);
  for (const hit of hits) {
    let target = hit.object;
    while (target && !target.userData.interactable) target = target.parent;
    if (!target) continue;
    const data = target.userData.interactable;
    if (!data) continue;
    if (typeof data.enabled === 'function' && !data.enabled()) continue;
    promptEl.textContent = `${data.label} / E / ACT`;
    promptEl.classList.remove('hidden');
    state.nearby = target;
    break;
  }
}

function triggerInteraction() {
  if (!state.allowInput || state.inDialogue) return;
  if (!state.nearby) return;
  const data = state.nearby.userData.interactable;
  if (data && data.onInteract) data.onInteract();
}

function saveGame() {
  const payload = {
    player: {
      x: player.position.x,
      y: player.position.y,
      z: player.position.z,
      ry: player.rotation.y,
      cx: camera.rotation.x,
    },
    taskFlags,
    state: {
      started: state.started,
      phase: state.phase,
      canAdvanceNight: state.canAdvanceNight,
      hasLantern: state.hasLantern,
    },
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function applyWorldState() {
  world.key.visible = !taskFlags.gotKey;
  if (taskFlags.checkedRoom201) {
    world.room201Door.position.x = -5.22;
  } else {
    world.room201Door.position.x = -4.8;
  }
  world.lantern.visible = !taskFlags.lanternTaken;
  if (taskFlags.foundLedger) {
    world.flagman.position.set(0, 0, -30.5);
  }
  if (state.hasLantern && !world.lights.lantern) {
    const carryLight = new THREE.PointLight(0xffc977, 0.55, 7, 2.2);
    carryLight.position.set(0.32, -0.2, -0.35);
    camera.add(carryLight);
    world.lights.lantern = carryLight;
  }
  if (state.phase === 'night' || taskFlags.patrolStart) {
    renderer.setClearColor(0x020203, 1);
    scene.fog = new THREE.Fog(0x030304, 5, 30);
    world.lights.entrance.intensity = 0.28;
    world.lights.corridor.intensity = 0.2;
    setPhase('night');
  } else {
    renderer.setClearColor(0x050507, 1);
    scene.fog = new THREE.Fog(0x050507, 10, 42);
    world.lights.entrance.intensity = 0.9;
    world.lights.corridor.intensity = 0.45;
    setPhase('day');
  }
  refreshObjectiveFromState();
}

function refreshObjectiveFromState() {
  if (state.phase === 'day') {
    if (!taskFlags.talkedToOkami) setObjective('女将に話しかける');
    else if (!taskFlags.gotKey) setObjective('受付に置かれた客室の鍵を取る');
    else if (!taskFlags.deliveredKey) setObjective('201号室の客に鍵を渡す');
    else if (!taskFlags.answeredPhone) setObjective('受付の内線電話に出る');
    else if (!state.canAdvanceNight) setObjective('少し待つ');
    else setObjective('卓上ベルを鳴らして夜の見回りを始める');
  } else if (state.phase === 'night') {
    if (!taskFlags.checkedRoom201) setObjective('201号室を確認する');
    else if (!taskFlags.foundLedger) setObjective('従業員室で帳場ノートを探す');
    else if (!taskFlags.sawFlagman) setObjective('二階の突き当たりを確認する');
    else setObjective('女将のもとへ戻る');
  }
}

function loadGame() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;
  try {
    const save = JSON.parse(raw);
    Object.assign(taskFlags, save.taskFlags || {});
    state.started = Boolean(save.state?.started);
    state.canAdvanceNight = Boolean(save.state?.canAdvanceNight);
    state.hasLantern = Boolean(save.state?.hasLantern);
    player.position.set(save.player?.x ?? 0, save.player?.y ?? 1.55, save.player?.z ?? 12.8);
    player.rotation.y = save.player?.ry ?? Math.PI;
    camera.rotation.x = save.player?.cx ?? 0;
    titleScreen.classList.add('hidden');
    endingScreen.classList.add('hidden');
    state.allowInput = true;
    setStartedUI(true);
    applyWorldState();
    if (touchHintEl) {
      touchHintEl.classList.remove('hidden');
      window.clearTimeout(window.__yoinadoHintTimer);
      window.__yoinadoHintTimer = window.setTimeout(() => touchHintEl?.classList.add('hidden'), 4000);
    }
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}

function resetGame(showTitle = true) {
  localStorage.removeItem(STORAGE_KEY);
  resetStickState(moveInput, moveStick);
  resetStickState(lookInput, lookStick);
  Object.keys(taskFlags).forEach((key) => {
    taskFlags[key] = false;
  });
  state.started = false;
  state.allowInput = false;
  state.inDialogue = false;
  state.currentDialogue = null;
  state.dialogueIndex = 0;
  state.canAdvanceNight = false;
  state.hasLantern = false;
  if (world.lights.lantern) {
    camera.remove(world.lights.lantern);
    world.lights.lantern = null;
  }
  world.flagman.position.set(0, -10, -30.5);
  world.key.visible = true;
  world.lantern.visible = true;
  world.room201Door.position.x = -4.8;
  endingScreen.classList.add('hidden');
  dialogueBox.classList.add('hidden');
  choiceBox.classList.add('hidden');
  if (showTitle) titleScreen.classList.remove('hidden');
  else titleScreen.classList.add('hidden');
  setPlayerStart();
  renderer.setClearColor(0x050507, 1);
  scene.fog = new THREE.Fog(0x050507, 10, 42);
  world.lights.entrance.intensity = 0.9;
  world.lights.corridor.intensity = 0.45;
  setPhase('title');
  setObjective('タイトルから開始する');
  setStartedUI(false);
}

function startGame() {
  ensureAudio();
  if (touchHintEl) {
    touchHintEl.classList.remove('hidden');
    window.clearTimeout(window.__yoinadoHintTimer);
    window.__yoinadoHintTimer = window.setTimeout(() => touchHintEl?.classList.add('hidden'), 6000);
  }
  titleScreen.classList.add('hidden');
  endingScreen.classList.add('hidden');
  state.started = true;
  state.allowInput = true;
  setPhase('day');
  setObjective('女将に話しかける');
  setStartedUI(true);
  saveGame();
}

function startNewGame() {
  resetGame(false);
  startGame();
}

window.__startGame = () => {
  if (state.started) return;
  if (howtoModal && !howtoModal.classList.contains('hidden')) return;
  startNewGame();
};

window.__forceStart = window.__startGame;

function openHowto() {
  howtoModal?.classList.remove('hidden');
}

function closeHowto() {
  howtoModal?.classList.add('hidden');
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  if (state.started) {
    updateLook(delta);
    movePlayer(delta);
    clampPlayer();
    updateInteractions();
  }
  animateFlagman(delta);
  renderer.render(scene, camera);
}

function animateFlagman(delta) {
  if (!world.flagman.visible || world.flagman.position.y < -5) return;
  const t = performance.now() * 0.002;
  world.flagman.position.y = 0.02 + Math.sin(t * 0.8) * 0.06;
  world.flagman.rotation.y = Math.PI + Math.sin(t * 0.5) * 0.15;
}

function onKey(e, down) {
  const k = e.key.toLowerCase();
  if (k === 'w') keys.forward = down;
  if (k === 's') keys.backward = down;
  if (k === 'a') keys.left = down;
  if (k === 'd') keys.right = down;
  if ((k === 'e' || k === 'enter' || k === ' ') && down) {
    if (state.inDialogue && state.currentDialogue) {
      advanceDialogue();
    } else {
      triggerInteraction();
    }
  }
}

function updateLook(delta) {
  if (!state.allowInput || state.inDialogue) return;
  if (!lookInput.active) return;
  player.rotation.y -= lookInput.x * 2.2 * delta;
  camera.rotation.x = THREE.MathUtils.clamp(camera.rotation.x - lookInput.y * 1.7 * delta, -1.12, 1.12);
}

function bindPress(el, handler) {
  if (!el) return;
  let fired = false;
  const wrapped = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (fired) return;
    fired = true;
    handler(e);
    requestAnimationFrame(() => {
      fired = false;
    });
  };
  el.addEventListener('click', wrapped, { passive: false });
  el.addEventListener('pointerup', wrapped, { passive: false });
  el.addEventListener('touchend', wrapped, { passive: false });
}

function updateStickState(stickState, knob, pad, clientX, clientY, radius = 38) {
  const rect = pad.getBoundingClientRect();
  stickState.baseX = rect.left + rect.width / 2;
  stickState.baseY = rect.top + rect.height / 2;
  const dx = clientX - stickState.baseX;
  const dy = clientY - stickState.baseY;
  const dist = Math.hypot(dx, dy) || 1;
  const clamped = Math.min(dist, radius);
  const nx = (dx / dist) * clamped;
  const ny = (dy / dist) * clamped;
  stickState.x = nx / radius;
  stickState.y = ny / radius;
  knob.style.transform = `translate(${nx}px, ${ny}px)`;
}

function resetStickState(stickState, knob) {
  stickState.active = false;
  stickState.pointerId = null;
  stickState.x = 0;
  stickState.y = 0;
  knob.style.transform = 'translate(0px, 0px)';
}

function initMouseLook() {
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') return;
    if (!state.started || state.inDialogue) return;
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    ensureAudio();
  });

  window.addEventListener('pointerup', (e) => {
    if (e.pointerType !== 'touch') dragging = false;
  });

  window.addEventListener('pointermove', (e) => {
    if (!dragging || e.pointerType === 'touch') return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    player.rotation.y -= dx * 0.0035;
    camera.rotation.x = THREE.MathUtils.clamp(camera.rotation.x - dy * 0.0032, -1.12, 1.12);
  });
}

function initTouchControls() {
  if (!isCoarsePointer) return;

  const bindStick = (pad, knob, stickState) => {
    pad.addEventListener('pointerdown', (e) => {
      if (!state.started || state.inDialogue) return;
      e.preventDefault();
      ensureAudio();
      stickState.active = true;
      stickState.pointerId = e.pointerId;
      pad.setPointerCapture?.(e.pointerId);
      updateStickState(stickState, knob, pad, e.clientX, e.clientY);
    }, { passive: false });

    pad.addEventListener('pointermove', (e) => {
      if (!stickState.active || stickState.pointerId !== e.pointerId) return;
      e.preventDefault();
      updateStickState(stickState, knob, pad, e.clientX, e.clientY);
    }, { passive: false });

    const endStick = (e) => {
      if (stickState.pointerId !== null && e.pointerId !== stickState.pointerId) return;
      resetStickState(stickState, knob);
    };

    pad.addEventListener('pointerup', endStick, { passive: false });
    pad.addEventListener('pointercancel', endStick, { passive: false });
    pad.addEventListener('lostpointercapture', () => resetStickState(stickState, knob), { passive: true });
  };

  bindStick(movePad, moveStick, moveInput);
  bindStick(lookPad, lookStick, lookInput);

  bindPress(actBtn, () => {
    ensureAudio();
    if (state.inDialogue && state.currentDialogue) {
      advanceDialogue();
    } else {
      triggerInteraction();
    }
  });
}

function bindEvents() {
  window.addEventListener('resize', resize);
  window.addEventListener('keydown', (e) => onKey(e, true));
  window.addEventListener('keyup', (e) => onKey(e, false));

  bindPress(startBtn, () => {
    if (state.started) return;
    if (howtoModal && !howtoModal.classList.contains('hidden')) return;
    startNewGame();
  });

  bindPress(titleInner, (e) => {
    if (state.started) return;
    if (howtoModal && !howtoModal.classList.contains('hidden')) return;
    const target = e?.target;
    if (target?.closest?.('#howtoBtn') || target?.closest?.('#continueBtn') || target?.closest?.('#closeHowtoBtn')) return;
    startNewGame();
  });

  bindPress(continueBtn, () => {
    if (!loadGame()) {
      showDialogue([{ speaker: '記録', text: '保存データが見つからない。' }], () => {
        state.allowInput = false;
      });
    }
  });

  bindPress(howtoBtn, () => openHowto());
  bindPress(closeHowtoBtn, () => closeHowto());
  bindPress(endingRestartBtn, () => resetGame(true));
  bindPress(saveBtn, () => saveGame());
  bindPress(loadBtn, () => {
    if (!loadGame()) {
      showDialogue([{ speaker: '記録', text: '保存データが見つからない。' }], () => {
        state.allowInput = state.started;
      });
    }
  });
  bindPress(restartBtn, () => resetGame(true));

  titleScreen.addEventListener('pointerdown', (e) => {
    if (e.target === titleScreen && !state.started && howtoModal.classList.contains('hidden')) {
      e.preventDefault();
    }
  }, { passive: false });

  howtoModal?.addEventListener('pointerdown', (e) => {
    if (e.target === howtoModal) {
      e.preventDefault();
      closeHowto();
    }
  }, { passive: false });

  bindPress(dialogueBox, () => {
    if (state.currentDialogue) advanceDialogue();
  });

  initMouseLook();
  initTouchControls();
}

buildWorld();
setPlayerStart();
resize();
bindEvents();
setObjective('タイトルから開始する');
setStartedUI(false);
if (localStorage.getItem(STORAGE_KEY)) {
  continueBtn?.classList.remove('hidden');
}
animate();
