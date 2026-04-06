(function(){
'use strict';
if (typeof THREE === 'undefined') {
  alert('Three.js の読み込みに失敗しました。通信状態を確認して再読み込みしてください。');
  return;
}

const SAVE_KEY = 'yoiyado_real3d_a1_v19';
const TAU = Math.PI * 2;

const canvas = document.getElementById('game-canvas');
const hud = document.getElementById('hud');
const promptEl = document.getElementById('prompt');
const objectiveTextEl = document.getElementById('objective-text');
const objectiveSubEl = document.getElementById('objective-sub');
const areaLabelEl = document.getElementById('area-label');
const phaseLabelEl = document.getElementById('phase-label');
const dayLabelEl = document.getElementById('day-label');
const distanceLabelEl = document.getElementById('distance-label');
const minimap = document.getElementById('minimap');
const minimapCtx = minimap.getContext('2d');
const menuBtn = document.getElementById('menu-btn');
const menuOverlay = document.getElementById('menu');
const dialogueOverlay = document.getElementById('dialogue');
const portraitEl = document.getElementById('portrait');
const dialogueNameEl = document.getElementById('dialogue-name');
const dialogueTextEl = document.getElementById('dialogue-text');
const gameOverEl = document.getElementById('gameover');
const endingEl = document.getElementById('ending');
const actBtn = document.getElementById('act-btn');
const lookZone = document.getElementById('look-zone');
const joystickBase = document.getElementById('joystick-base');
const joystickKnob = document.getElementById('joystick-knob');
const joystickZone = document.getElementById('joystick-zone');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x06080d);
scene.fog = new THREE.Fog(0x080a10, 16, 42);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 90);
const player = { x: 0, z: 0, yaw: 0, pitch: 0, height: 1.62, radius: 0.33, speed: 2.6, run: 1.32 };

const rootGroup = new THREE.Group();
scene.add(rootGroup);
const areaGroup = new THREE.Group();
const dynamicGroup = new THREE.Group();
rootGroup.add(areaGroup);
rootGroup.add(dynamicGroup);

const hemi = new THREE.HemisphereLight(0xbdd2ff, 0x2f2419, 0.7);
scene.add(hemi);
const dirLight = new THREE.DirectionalLight(0xfff0da, 0.9);
dirLight.position.set(6, 10, 5);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 1024;
dirLight.shadow.mapSize.height = 1024;
dirLight.shadow.camera.left = -18;
dirLight.shadow.camera.right = 18;
dirLight.shadow.camera.top = 18;
dirLight.shadow.camera.bottom = -18;
scene.add(dirLight);

const state = {
  area: 'lobby',
  day: 1,
  phaseLabel: '昼勤務',
  step: 'talk_okami',
  hudHidden: false,
  menuOpen: false,
  dialogueQueue: [],
  checkpoint: null,
  chase: null,
  guide: null,
  lastDoorId: null,
  doorCooldownUntil: 0,
  inputLockUntil: 0,
  questFlags: {},
  ended: false
};

const input = {
  keys: Object.create(null),
  lookDragging: false,
  lookId: null,
  joyId: null,
  joyX: 0,
  joyY: 0,
  pointerX: 0,
  pointerY: 0,
  mouseDrag: false,
  interactQueued: false
};

const colliders = [];
const doors = [];
const npcs = [];
const items = [];
const areaAnchors = {};
const graph = {
  lobby: { corridor: 12, kitchen: 8, archive: 9 },
  kitchen: { lobby: 8 },
  corridor: { lobby: 12, room201: 6, bath: 12, north: 13 },
  room201: { corridor: 6 },
  bath: { corridor: 12 },
  archive: { lobby: 9, detached: 14 },
  north: { corridor: 13, detached: 8 },
  detached: { north: 8, archive: 14 }
};

const areaLabels = {
  lobby: '帳場', kitchen: '厨房', corridor: '客室廊下', room201: '201号室', bath: '浴場前', archive: '宿帳庫', north: '北廊下', detached: '離れ通路'
};

const stepDefs = {
  talk_okami: { day: 1, phase: '昼勤務', text: '女将に話しかける', sub: '帳場へ', targetArea: 'lobby', targetPos: { x: 0, z: -2 }, trigger: { type: 'npc', id: 'okami' } },
  get_tray: { day: 1, phase: '昼勤務', text: '厨房でお茶の盆を受け取る', sub: '厨房へ', targetArea: 'kitchen', targetPos: { x: 0, z: -1 }, trigger: { type: 'item', id: 'tray' } },
  deliver_201: { day: 1, phase: '昼勤務', text: '201号室の客にお茶を届ける', sub: '201号室へ', targetArea: 'room201', targetPos: { x: 0, z: -1.8 }, trigger: { type: 'npc', id: 'guest201' } },
  report_okami: { day: 1, phase: '昼勤務', text: '帳場へ戻って女将に報告する', sub: '帳場へ', targetArea: 'lobby', targetPos: { x: 0, z: -2 }, trigger: { type: 'npc', id: 'okami' } },
  answer_phone: { day: 1, phase: '夕方', text: '浴場前の黒電話に出る', sub: '浴場前へ', targetArea: 'bath', targetPos: { x: 0, z: -2 }, trigger: { type: 'item', id: 'phone' } },
  inspect_archive: { day: 1, phase: '深夜調査', text: '宿帳庫で青い宿帳を探す', sub: '宿帳庫へ', targetArea: 'archive', targetPos: { x: 0, z: -3 }, trigger: { type: 'item', id: 'blueLedger' } },
  escape_archive: { day: 1, phase: '深夜追跡', text: '誘導員から逃げて帳場へ戻る', sub: '帳場へ', targetArea: 'lobby', targetPos: { x: 0, z: -2 }, trigger: { type: 'npc', id: 'okami' } },
  talk_maid: { day: 2, phase: '昼勤務', text: '廊下で仲居に昨夜のことを聞く', sub: '客室廊下へ', targetArea: 'corridor', targetPos: { x: 0, z: 0 }, trigger: { type: 'npc', id: 'maid' } },
  inspect_north: { day: 2, phase: '夕方', text: '北廊下の閉ざされた札を調べる', sub: '北廊下へ', targetArea: 'north', targetPos: { x: 0, z: -2.5 }, trigger: { type: 'item', id: 'sealTag' } },
  inspect_detached: { day: 2, phase: '深夜調査', text: '離れ通路の祠を調べる', sub: '離れ通路へ', targetArea: 'detached', targetPos: { x: 0, z: -3 }, trigger: { type: 'item', id: 'altar' } },
  escape_detached: { day: 2, phase: '深夜追跡', text: '誘導員から逃げて帳場へ戻る', sub: '帳場へ', targetArea: 'lobby', targetPos: { x: 0, z: -2 }, trigger: { type: 'npc', id: 'okami' } },
  finale: { day: 2, phase: '終幕', text: '女将に宿帳のことを問いただす', sub: '帳場へ', targetArea: 'lobby', targetPos: { x: 0, z: -2 }, trigger: { type: 'npc', id: 'okami' } }
};

const storyNodes = {
  okami_intro: [
    ['女将', 'よう来たね。ここは人手が足りていない。\n今夜から帳場の手伝いをしてもらう。', 'okami'],
    ['女将', 'まずは厨房へ行って、201号室へお茶の盆を届けておくれ。\n道は短いが、夜は北廊下に近づかないこと。', 'okami']
  ],
  tray: [
    ['料理番', '女将さんから聞いてるよ。\n盆を持ったら、こぼさないようにまっすぐ201へ。', 'chef']
  ],
  guest201: [
    ['201号室の客', '……遅かったな。\n今朝からこの宿、変な音がする。壁の向こうを誰か歩いてる。', 'guest'],
    ['201号室の客', 'さっきも、赤と白の旗を持った男が廊下の先に立っていた。\n宿の人間なら妙な格好だ。', 'guest']
  ],
  report_okami: [
    ['女将', '客の話は気にしなくていい。\n古い建物だから、音はいろいろ響くものさ。', 'okami'],
    ['女将', '……だが、もし今夜、黒電話が鳴ったら必ず出ておくれ。', 'okami']
  ],
  phone: [
    ['黒電話', '――……カタン。\n受話器の向こうから、誰かの息だけが聞こえる。', 'phone'],
    ['黒電話', '低い声', '宿帳を、見るな。……いや、見ろ。\n北の札より先に、帳場の奥を確かめろ。', 'phone']
  ],
  blueLedger: [
    ['主人公', '青い宿帳だ。\n同じ名前が、年を跨いで何度も記されている。', 'hero'],
    ['主人公', 'ページの端に、赤いインクで「誘導員に従うな」とある。', 'hero']
  ],
  escape_archive: [
    ['女将', '見たのかい。\nそれなら、今夜のうちに帳場へ隠しておくしかない。', 'okami'],
    ['女将', '明日は、廊下の仲居にだけ話を聞いておくれ。\n他の客には悟られないように。', 'okami']
  ],
  maid: [
    ['仲居', '昨夜、帳場の灯りが消えたあと……北廊下の奥で、旗が擦れる音がしました。', 'maid'],
    ['仲居', '昔の火事で死んだ誘導員の噂、聞いたことありますか。\n道を誤らせる男です。', 'maid']
  ],
  sealTag: [
    ['主人公', '閉ざされた札の裏に、細い鍵が隠されている。\n札そのものは焦げた匂いがする。', 'hero']
  ],
  altar: [
    ['主人公', '離れの祠の下に、宿帳の切れ端と写真がある。\n女将と、見覚えのない誘導員の写真だ。', 'hero'],
    ['主人公', '足音。……また来る。', 'hero']
  ],
  finale: [
    ['女将', 'あれは追う者ではなく、連れていく者だよ。\n昔この宿で、客を避難させるはずだった男さ。', 'okami'],
    ['女将', '火事の夜、誰も救えなかった。\nだから今も、間違った道へ客を導こうとする。', 'okami'],
    ['女将', '……宿帳は預かっておく。\n続きは、明日の夜に。', 'okami']
  ]
};

const faceTextures = {
  okami: makeFaceTexture('#f0d7c6', '#201515', '#7b2932', 'okami'),
  maid: makeFaceTexture('#efd5c2', '#1e2228', '#63543f', 'maid'),
  guest: makeFaceTexture('#e8d0bc', '#16191d', '#4d4d4d', 'guest'),
  guide: makeFaceTexture('#d5dce5', '#4b0d0d', '#98a4b4', 'guide'),
  chef: makeFaceTexture('#ebdccb', '#1a1a1a', '#ffffff', 'chef'),
  hero: makeFaceTexture('#e7d0bc', '#1d1d1d', '#303030', 'hero'),
  phone: makeFaceTexture('#0f1216', '#d7d7d7', '#0f1216', 'phone')
};

function makeFaceTexture(skin, eye, accent, type) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = skin;
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = eye;
  if (type === 'guide') {
    g.fillRect(84, 110, 20, 12);
    g.fillRect(152, 110, 20, 12);
    g.fillStyle = '#7a0e12';
    g.fillRect(96, 156, 64, 8);
  } else {
    g.fillRect(86, 100, 18, 10);
    g.fillRect(152, 100, 18, 10);
    g.fillStyle = '#8b544d';
    g.fillRect(106, 152, 44, 6);
  }
  g.fillStyle = accent;
  if (type === 'okami') {
    g.fillRect(44, 42, 168, 34);
  } else if (type === 'maid') {
    g.fillRect(36, 28, 184, 42);
  } else if (type === 'guest') {
    g.fillRect(28, 30, 200, 36);
  } else if (type === 'guide') {
    g.fillRect(54, 10, 148, 44);
    g.fillStyle = '#ffffff';
    g.fillRect(112, 58, 32, 22);
  } else if (type === 'chef') {
    g.fillRect(58, 18, 140, 30);
    g.fillStyle = '#ffffff';
    g.fillRect(74, 0, 108, 34);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const materials = {
  wood: new THREE.MeshStandardMaterial({ map: makeWoodTexture(512, 512), roughness: 0.88 }),
  darkWood: new THREE.MeshStandardMaterial({ map: makeWoodTexture(512, 512, true), roughness: 0.92 }),
  shoji: new THREE.MeshStandardMaterial({ map: makeShojiTexture(512, 512), roughness: 0.98 }),
  tatami: new THREE.MeshStandardMaterial({ map: makeTatamiTexture(512, 512), roughness: 1 }),
  tile: new THREE.MeshStandardMaterial({ map: makeTileTexture(512, 512), roughness: 0.95 }),
  carpet: new THREE.MeshStandardMaterial({ map: makeCarpetTexture(512, 512), roughness: 1 }),
  wallWarm: new THREE.MeshStandardMaterial({ color: 0xdac7a2, roughness: 1 }),
  wallRose: new THREE.MeshStandardMaterial({ color: 0xb78587, roughness: 1 }),
  wallDark: new THREE.MeshStandardMaterial({ color: 0x3a2d23, roughness: 1 }),
  black: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xc9a96e, roughness: 0.45, metalness: 0.4 }),
  paper: new THREE.MeshStandardMaterial({ color: 0xf6f0df, roughness: 1 })
};

function makeWoodTexture(w, h, dark){
  const c=document.createElement('canvas'); c.width=w; c.height=h; const g=c.getContext('2d');
  const base=dark? '#4a3729':'#7a5b42';
  const hi=dark? '#5c4837':'#946f52';
  const lo=dark? '#37271d':'#654c39';
  g.fillStyle=base; g.fillRect(0,0,w,h);
  for(let i=0;i<260;i++){
    g.fillStyle = i%3===0? hi: lo;
    const y = Math.random()*h;
    g.fillRect(0,y,w,Math.random()*2+1);
  }
  const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(2,2); tex.colorSpace = THREE.SRGBColorSpace; return tex;
}
function makeShojiTexture(w,h){
  const c=document.createElement('canvas'); c.width=w; c.height=h; const g=c.getContext('2d');
  g.fillStyle='#f1ebdc'; g.fillRect(0,0,w,h);
  g.strokeStyle='#5c3d23'; g.lineWidth=10;
  for(let x=0;x<=w;x+=w/4){ g.beginPath(); g.moveTo(x,0); g.lineTo(x,h); g.stroke(); }
  for(let y=0;y<=h;y+=h/4){ g.beginPath(); g.moveTo(0,y); g.lineTo(w,y); g.stroke(); }
  const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace; return tex;
}
function makeTatamiTexture(w,h){
  const c=document.createElement('canvas'); c.width=w; c.height=h; const g=c.getContext('2d');
  g.fillStyle='#8a8c6a'; g.fillRect(0,0,w,h);
  for(let i=0;i<600;i++){
    g.strokeStyle = i%2? 'rgba(85,92,62,.5)' : 'rgba(137,144,106,.38)';
    g.beginPath(); const x=Math.random()*w; g.moveTo(x,0); g.lineTo(x+Math.random()*20-10,h); g.stroke();
  }
  const tex=new THREE.CanvasTexture(c); tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(2,2); tex.colorSpace=THREE.SRGBColorSpace; return tex;
}
function makeTileTexture(w,h){
  const c=document.createElement('canvas'); c.width=w; c.height=h; const g=c.getContext('2d');
  g.fillStyle='#6e6f72'; g.fillRect(0,0,w,h); g.strokeStyle='rgba(255,255,255,.08)';
  for(let x=0;x<=w;x+=64){g.beginPath();g.moveTo(x,0);g.lineTo(x,h);g.stroke();}
  for(let y=0;y<=h;y+=64){g.beginPath();g.moveTo(0,y);g.lineTo(w,y);g.stroke();}
  const tex=new THREE.CanvasTexture(c); tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(4,4); tex.colorSpace=THREE.SRGBColorSpace; return tex;
}
function makeCarpetTexture(w,h){
  const c=document.createElement('canvas'); c.width=w; c.height=h; const g=c.getContext('2d');
  g.fillStyle='#3b1c1c'; g.fillRect(0,0,w,h);
  for(let i=0;i<1000;i++){ g.fillStyle = i%2?'rgba(120,40,40,.18)':'rgba(50,12,12,.18)'; g.fillRect(Math.random()*w, Math.random()*h, 2, 2);}  
  const tex=new THREE.CanvasTexture(c); tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(3,3); tex.colorSpace=THREE.SRGBColorSpace; return tex;
}

function clearArray(arr){ arr.length = 0; }
function disposeHierarchy(obj){ obj.traverse(child => { if (child.geometry) child.geometry.dispose?.(); }); }

function addCollider(x1,z1,x2,z2){ colliders.push({ x1: Math.min(x1,x2), z1: Math.min(z1,z2), x2: Math.max(x1,x2), z2: Math.max(z1,z2) }); }
function addBoxCollider(x,z,w,d){ addCollider(x - w/2, z - d/2, x + w/2, z + d/2); }

function createFloor(width, depth, material, y){
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, 0.2, depth), material);
  mesh.position.set(0, y || -0.1, 0);
  mesh.receiveShadow = true;
  areaGroup.add(mesh);
  return mesh;
}
function createCeiling(width, depth, color){
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, 0.16, depth), new THREE.MeshStandardMaterial({ color: color || 0xf3eee4, roughness: 1 }));
  mesh.position.set(0, 3.24, 0);
  mesh.receiveShadow = true;
  areaGroup.add(mesh);
  return mesh;
}
function wallSegment(x, z, w, h, d, mat){
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat || materials.wallWarm);
  mesh.position.set(x, h / 2, z);
  mesh.castShadow = true; mesh.receiveShadow = true;
  areaGroup.add(mesh);
  addBoxCollider(x, z, w, d);
  return mesh;
}
function addLamp(x,z,intensity,color){
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), new THREE.MeshBasicMaterial({ color: color || 0xffdda6 }));
  bulb.position.set(x, 2.65, z); areaGroup.add(bulb);
  const p = new THREE.PointLight(color || 0xffd69a, intensity || 0.9, 11, 2.1);
  p.position.set(x, 2.5, z); p.castShadow = false; areaGroup.add(p);
}
function doorModel(x,z,axis,label,color){
  const g = new THREE.Group();
  const frameMat = materials.darkWood;
  const panelMat = new THREE.MeshStandardMaterial({ color: color || 0xe8dcc2, roughness: 0.95 });
  const signMat = new THREE.MeshStandardMaterial({ color: 0x1a100d, roughness: 1 });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.9, 0.05), signMat);
  const signText = makeLabelPlane(label || '扉', 1.0, 0.3);
  signText.position.set(0, 0, 0.03);
  sign.add(signText);
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.3, 0.18), frameMat);
  const right = left.clone();
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.54, 0.12, 0.18), frameMat);
  left.position.set(-0.73, 1.15, 0); right.position.set(0.73, 1.15, 0); top.position.set(0, 2.24, 0);
  const panel = new THREE.Mesh(new THREE.BoxGeometry(1.34, 2.08, 0.12), panelMat);
  panel.position.set(0, 1.04, 0);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12), materials.brass);
  knob.position.set(0.52, 1.08, 0.09);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.34, 0.04), new THREE.MeshStandardMaterial({ color: 0x2d2d31, roughness: 0.5 }));
  plate.position.set(0.52, 1.08, 0.06);
  sign.position.set(0, 2.8, 0.03);
  g.add(left,right,top,panel,plate,knob,sign);
  if (axis === 'x') g.rotation.y = Math.PI / 2;
  g.position.set(x,0,z);
  g.traverse(m => { if (m.isMesh){ m.castShadow = true; m.receiveShadow = true; } });
  areaGroup.add(g);
  return g;
}
function makeLabelPlane(text, scaleX, scaleY){
  const c=document.createElement('canvas'); c.width=512; c.height=256; const g=c.getContext('2d');
  g.fillStyle='#f4f0e2'; g.fillRect(0,0,512,256);
  g.fillStyle='#140d0c'; g.font='bold 92px sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(text,256,128);
  const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace;
  const mat=new THREE.MeshBasicMaterial({ map:tex, transparent:false });
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(scaleX, scaleY), mat);
  return mesh;
}

function receptionDesk(){
  const g=new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.2, 1.2), materials.darkWood);
  base.position.set(0,0.6,0); base.castShadow = true; base.receiveShadow = true;
  const top = new THREE.Mesh(new THREE.BoxGeometry(4.7,0.12,1.35), materials.wood);
  top.position.set(0,1.26,0); top.castShadow = true; top.receiveShadow = true;
  g.add(base,top);
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.12,0.08,18), materials.brass);
  bell.position.set(-1.4,1.36,0); g.add(bell);
  const ledger = new THREE.Mesh(new THREE.BoxGeometry(0.8,0.08,0.6), new THREE.MeshStandardMaterial({ color: 0x27495d, roughness: 0.8 }));
  ledger.position.set(1.1,1.34,0.05); g.add(ledger);
  g.position.set(0,0,-3.4); areaGroup.add(g);
  addBoxCollider(0,-3.4,4.8,1.45);
}
function bathCurtain(){
  const g = new THREE.Group();
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,3,12), materials.brass);
  rod.rotation.z = Math.PI / 2; rod.position.set(0,2.4,0); g.add(rod);
  for(let i=0;i<6;i++){
    const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.42,1.9,0.06), new THREE.MeshStandardMaterial({ color: i%2?0x1e4c8f:0xf4f5f7, roughness: 1 }));
    cloth.position.set(-1.1 + i*0.44,1.42,0); cloth.castShadow = true; cloth.receiveShadow = true; g.add(cloth);
  }
  g.position.set(0,0,-2.7); areaGroup.add(g);
}
function archiveShelves(){
  for(let row=0; row<2; row++){
    const shelf = new THREE.Group();
    const side1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.3, 2.8), materials.darkWood);
    const side2 = side1.clone();
    const boards=[];
    for(let i=0;i<4;i++){
      const board = new THREE.Mesh(new THREE.BoxGeometry(2.2,0.08,2.8), materials.darkWood);
      board.position.set(0,0.34 + i*0.56,0); boards.push(board); shelf.add(board);
    }
    side1.position.set(-1.04,1.15,0); side2.position.set(1.04,1.15,0); shelf.add(side1, side2);
    for(let i=0;i<18;i++){
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.16 + Math.random()*0.08, 0.34 + Math.random()*0.2, 0.28), new THREE.MeshStandardMaterial({ color: [0x2f4b62,0x755544,0x63613d,0x473a57][i%4], roughness: 0.9 }));
      b.position.set(-0.82 + (i%9)*0.2, 0.54 + Math.floor(i/9)*0.56, -1 + (i%3)*0.95); shelf.add(b);
    }
    shelf.position.set(row===0?-2.6:2.6,0,-0.5); shelf.rotation.y = row===0? 0 : 0; areaGroup.add(shelf);
    addBoxCollider(shelf.position.x, shelf.position.z, 2.25, 3.0);
  }
}
function makeCharacter(type, costume){
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xf1d5c3, roughness: 0.85 });
  const clothing = new THREE.MeshStandardMaterial({ color: costume || 0x374c7a, roughness: 0.95 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1a1d24, roughness: 0.95 });
  const headMats = [skin, skin, skin, skin, new THREE.MeshStandardMaterial({ map: faceTextures[type] }), skin];
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42,0.46,0.42), headMats);
  head.position.y = 1.72; head.castShadow = true;
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.16,0.12,0.16), skin); neck.position.y = 1.46; neck.castShadow = true;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.58,0.76,0.34), clothing); torso.position.y = 1.04; torso.castShadow = true;
  const waist = new THREE.Mesh(new THREE.BoxGeometry(0.46,0.22,0.28), clothing); waist.position.y = 0.58; waist.castShadow = true;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18,0.74,0.18), clothing); armL.position.set(-0.42,1.06,0); armL.castShadow = true;
  const armR = armL.clone(); armR.position.x = 0.42;
  const forearmL = new THREE.Mesh(new THREE.BoxGeometry(0.16,0.52,0.16), skin); forearmL.position.set(-0.42,0.56,0.02); forearmL.castShadow = true;
  const forearmR = forearmL.clone(); forearmR.position.x = 0.42;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2,0.74,0.2), dark); legL.position.set(-0.14,0.18,0); legL.castShadow = true;
  const legR = legL.clone(); legR.position.x = 0.14;
  const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.22,0.12,0.36), new THREE.MeshStandardMaterial({ color: 0x0d0f16, roughness: 0.8 })); shoeL.position.set(-0.14,-0.24,0.04); shoeL.castShadow = true;
  const shoeR = shoeL.clone(); shoeR.position.x = 0.14;
  g.add(head, neck, torso, waist, armL, armR, forearmL, forearmR, legL, legR, shoeL, shoeR);
  if (type === 'okami') {
    const kimono = new THREE.Mesh(new THREE.BoxGeometry(0.8,1.1,0.42), new THREE.MeshStandardMaterial({ color: 0x6c3d43, roughness: 0.95 }));
    kimono.position.y = 0.78; kimono.castShadow = true; g.add(kimono);
  }
  if (type === 'guide') {
    const helmet = new THREE.Mesh(new THREE.CylinderGeometry(0.27,0.22,0.22,20), new THREE.MeshStandardMaterial({ color: 0xf5f6f7, roughness: 0.45 }));
    helmet.position.y = 2.0; helmet.castShadow = true; g.add(helmet);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.18,0.34,0.02), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    panel.position.set(0.44,1.1,0.18); g.add(panel);
    const panel2 = panel.clone(); panel2.position.x = -0.44; panel2.material = new THREE.MeshStandardMaterial({ color: 0xc23b3b }); g.add(panel2);
  }
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.48, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = -0.29; g.add(shadow);
  return g;
}

function addNPC(id, name, faceType, costume, x, z, rot, onInteract){
  const npc = { id, name, x, z, rot: rot || 0, onInteract, faceType };
  npc.group = makeCharacter(faceType, costume);
  npc.group.position.set(x, 0.28, z);
  npc.group.rotation.y = rot || 0;
  dynamicGroup.add(npc.group);
  npcs.push(npc);
  return npc;
}
function addItem(id, label, x, z, mesh, onInteract){
  mesh.position.set(x, mesh.position.y, z);
  dynamicGroup.add(mesh);
  items.push({ id, label, x, z, mesh, onInteract });
}
function addDoor(id, label, x, z, radius, toArea, toSpawn, axis, color){
  doorModel(x, z, axis, label, color);
  doors.push({ id, label, x, z, radius: radius || 1.18, toArea, toSpawn });
}

function buildArea(areaId){
  areaGroup.clear(); dynamicGroup.clear(); clearArray(colliders); clearArray(doors); clearArray(npcs); clearArray(items);
  areaLabelEl.textContent = areaLabels[areaId];
  phaseLabelEl.textContent = stepDefs[state.step].phase;
  dayLabelEl.textContent = 'DAY ' + stepDefs[state.step].day;
  state.day = stepDefs[state.step].day;
  state.phaseLabel = stepDefs[state.step].phase;
  scene.fog.color.set(0x080a10);
  scene.fog.near = 16; scene.fog.far = 42;
  if (areaId === 'lobby') buildLobby();
  else if (areaId === 'kitchen') buildKitchen();
  else if (areaId === 'corridor') buildCorridor();
  else if (areaId === 'room201') buildRoom201();
  else if (areaId === 'bath') buildBath();
  else if (areaId === 'archive') buildArchive();
  else if (areaId === 'north') buildNorth();
  else if (areaId === 'detached') buildDetached();
}

function buildLobby(){
  createFloor(14, 12, materials.tatami, -0.1);
  createCeiling(14, 12, 0xf0eadc);
  wallSegment(0, -5.95, 14, 3.2, 0.14, materials.wallWarm);
  wallSegment(0, 5.95, 14, 3.2, 0.14, materials.wallWarm);
  wallSegment(-6.95, 0, 0.14, 3.2, 12, materials.darkWood);
  wallSegment(6.95, 0, 0.14, 3.2, 12, materials.darkWood);
  receptionDesk();
  addLamp(-2.4, -0.4, 0.85); addLamp(2.4, -0.4, 0.85);
  const sign = makeLabelPlane('帳場', 1.4, 0.45); sign.position.set(0, 2.5, -5.85); areaGroup.add(sign);
  const cabinet = new THREE.Mesh(new THREE.BoxGeometry(1.3,1.8,0.6), materials.darkWood);
  cabinet.position.set(-5.2,0.9,3.4); cabinet.castShadow = cabinet.receiveShadow = true; areaGroup.add(cabinet); addBoxCollider(-5.2,3.4,1.3,0.6);
  const blackPhone = new THREE.Mesh(new THREE.BoxGeometry(0.4,0.14,0.28), materials.black);
  blackPhone.position.set(2.2,1.36,-3.45); areaGroup.add(blackPhone);
  addDoor('lobbyToCorridor', '客室廊下', 6.32, 0, 1.35, 'corridor', { x: -5.3, z: 0, yaw: 0 });
  addDoor('lobbyToKitchen', '厨房', -6.32, 2.2, 1.2, 'kitchen', { x: 4.2, z: -1.2, yaw: Math.PI });
  addDoor('lobbyToArchive', '宿帳庫', -6.32, -2.2, 1.2, 'archive', { x: 4.2, z: 0, yaw: Math.PI });
  addNPC('okami', '女将', 'okami', 0x6d3d44, 0, -2.1, Math.PI, npcInteract);
}

function buildKitchen(){
  createFloor(11, 9, materials.tile, -0.1);
  createCeiling(11, 9, 0xece7dd);
  wallSegment(0,-4.45,11,3.2,0.14,materials.wallDark); wallSegment(0,4.45,11,3.2,0.14,materials.wallDark); wallSegment(-5.45,0,0.14,3.2,9,materials.wallDark); wallSegment(5.45,0,0.14,3.2,9,materials.wallDark);
  const counter = new THREE.Mesh(new THREE.BoxGeometry(3.8,0.92,1.3), materials.darkWood); counter.position.set(0,0.46,-2.3); counter.castShadow = counter.receiveShadow = true; areaGroup.add(counter); addBoxCollider(0,-2.3,3.8,1.3);
  const stove = new THREE.Mesh(new THREE.BoxGeometry(1.6,0.92,0.8), new THREE.MeshStandardMaterial({ color: 0x54565d, roughness: 0.5 })); stove.position.set(-3.7,0.46,2.5); areaGroup.add(stove); addBoxCollider(-3.7,2.5,1.6,0.8);
  addLamp(0,0,0.9); addLamp(3.2,-1.4,0.7);
  addDoor('kitchenToLobby','帳場',5.0,-1.2,1.2,'lobby',{x:-4.8,z:2.2,yaw:0},'x');
  addNPC('chef','料理番','chef',0xffffff,1.8,-1.2,-Math.PI/2,npcInteract);
  const tray = new THREE.Mesh(new THREE.BoxGeometry(0.86,0.08,0.56), new THREE.MeshStandardMaterial({ color: 0x7a4e2f, roughness: 0.85 }));
  tray.position.y = 0.94;
  const teapot = new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.16,0.18,18), new THREE.MeshStandardMaterial({ color: 0xdfddd7, roughness: 0.55 }));
  teapot.position.set(0.1,0.12,0); tray.add(teapot);
  const cup1 = new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,0.08,18), materials.paper); cup1.position.set(-0.18,0.08,-0.1); tray.add(cup1);
  const cup2 = cup1.clone(); cup2.position.z = 0.1; tray.add(cup2);
  addItem('tray','お茶の盆',0.2,-2.25,tray,itemInteract);
}

function buildCorridor(){
  createFloor(20, 7, materials.wood, -0.1);
  createCeiling(20, 7, 0xe7dcc9);
  wallSegment(0,-3.45,20,3.2,0.14,materials.darkWood); wallSegment(0,3.45,20,3.2,0.14,materials.darkWood); wallSegment(-9.95,0,0.14,3.2,7,materials.wallDark); wallSegment(9.95,0,0.14,3.2,7,materials.wallDark);
  for(let i=-8;i<=8;i+=4){ addLamp(i,0,0.68,0xffd7a6); }
  for(let z of [-2.4,2.4]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(19.6,0.9,0.18), materials.darkWood); rail.position.set(0,0.45,z); rail.castShadow = rail.receiveShadow = true; areaGroup.add(rail); addBoxCollider(0,z,19.6,0.18);
  }
  addDoor('corridorToLobby','帳場',-9.34,0,1.2,'lobby',{x:5.2,z:0,yaw:Math.PI},'x');
  addDoor('corridorTo201','201',0,-3.28,1.2,'room201',{x:0,z:2.8,yaw:Math.PI},null,0xf0e7d1);
  addDoor('corridorToBath','浴場',6.2,3.28,1.2,'bath',{x:-4.2,z:0,yaw:0},null,0xd7ecef);
  addDoor('corridorToNorth','北廊下',9.34,0,1.2,'north',{x:-4.8,z:0,yaw:0},'x',0xc3b28a);
  const placard = makeLabelPlane('客室廊下', 1.8, 0.45); placard.position.set(-6.5,2.4,-3.3); areaGroup.add(placard);
  addNPC('maid','仲居','maid',0x575a79,3.6,0.9,Math.PI,npcInteract);
}

function buildRoom201(){
  createFloor(9, 9, materials.tatami, -0.1);
  createCeiling(9, 9, 0xf2ece1);
  wallSegment(0,-4.45,9,3.2,0.14,materials.wallWarm); wallSegment(0,4.45,9,3.2,0.14,materials.wallWarm); wallSegment(-4.45,0,0.14,3.2,9,materials.wallDark); wallSegment(4.45,0,0.14,3.2,9,materials.wallDark);
  const alcove = new THREE.Mesh(new THREE.BoxGeometry(1.6,2.5,0.4), materials.darkWood); alcove.position.set(-3.2,1.25,-3.6); areaGroup.add(alcove); addBoxCollider(-3.2,-3.6,1.6,0.4);
  const futon = new THREE.Mesh(new THREE.BoxGeometry(2.2,0.26,3.0), new THREE.MeshStandardMaterial({ color: 0xf1efe8, roughness: 1 })); futon.position.set(1.7,0.03,-1.2); areaGroup.add(futon); addBoxCollider(1.7,-1.2,2.2,3.0);
  const table = new THREE.Mesh(new THREE.BoxGeometry(1.2,0.38,1.2), materials.darkWood); table.position.set(-0.2,0.19,0.8); areaGroup.add(table); addBoxCollider(-0.2,0.8,1.2,1.2);
  addLamp(0,0,0.8); addDoor('room201ToCorridor','客室廊下',0,4.18,1.1,'corridor',{x:0,z:-1.8,yaw:0},null,0xf0e7d1);
  addNPC('guest201','201号室の客','guest',0x423d52,-1.6,-1.2,Math.PI/2,npcInteract);
}

function buildBath(){
  createFloor(10, 8, materials.tile, -0.1);
  createCeiling(10, 8, 0xe9ecef);
  wallSegment(0,-3.95,10,3.2,0.14,materials.wallRose); wallSegment(0,3.95,10,3.2,0.14,materials.wallRose); wallSegment(-4.95,0,0.14,3.2,8,materials.wallRose); wallSegment(4.95,0,0.14,3.2,8,materials.wallRose);
  bathCurtain();
  const bench = new THREE.Mesh(new THREE.BoxGeometry(2.2,0.42,0.6), materials.darkWood); bench.position.set(2.2,0.21,2.8); areaGroup.add(bench); addBoxCollider(2.2,2.8,2.2,0.6);
  addLamp(-2.3,0,0.7,0xffe6bc); addLamp(2.3,0,0.7,0xffe6bc);
  addDoor('bathToCorridor','客室廊下',-4.35,0,1.2,'corridor',{x:6.2,z:1.8,yaw:Math.PI},'x',0xddeff3);
  const phoneTable = new THREE.Mesh(new THREE.BoxGeometry(0.9,0.52,0.58), materials.darkWood); phoneTable.position.set(2.5,0.26,-2.5); areaGroup.add(phoneTable); addBoxCollider(2.5,-2.5,0.9,0.58);
  const phone = new THREE.Mesh(new THREE.BoxGeometry(0.46,0.14,0.32), materials.black); phone.position.set(2.5,0.61,-2.5); areaGroup.add(phone);
  addItem('phone','黒電話',2.5,-2.5, phone, itemInteract);
}

function buildArchive(){
  createFloor(12, 10, materials.tile, -0.1);
  createCeiling(12, 10, 0xdad8d6);
  wallSegment(0,-4.95,12,3.2,0.14,materials.wallDark); wallSegment(0,4.95,12,3.2,0.14,materials.wallDark); wallSegment(-5.95,0,0.14,3.2,10,materials.wallDark); wallSegment(5.95,0,0.14,3.2,10,materials.wallDark);
  archiveShelves();
  addLamp(-2.6,0,0.6,0xffe0b4); addLamp(2.6,0,0.6,0xffe0b4);
  addDoor('archiveToLobby','帳場',5.35,0,1.15,'lobby',{x:-4.9,z:-2.2,yaw:0},'x',0xb7b39b);
  addDoor('archiveToDetached','離れ通路',0,-4.35,1.15,'detached',{x:0,z:3.6,yaw:Math.PI},null,0x9689a6);
  const ledger = new THREE.Mesh(new THREE.BoxGeometry(0.72,0.16,0.48), new THREE.MeshStandardMaterial({ color: 0x225688, roughness: 0.85 }));
  ledger.position.y = 1.16;
  addItem('blueLedger','青い宿帳',0,1.1, ledger, itemInteract);
}

function buildNorth(){
  createFloor(11, 7, materials.carpet, -0.1);
  createCeiling(11, 7, 0xd7cab5);
  wallSegment(0,-3.45,11,3.2,0.14,materials.wallDark); wallSegment(0,3.45,11,3.2,0.14,materials.wallDark); wallSegment(-5.45,0,0.14,3.2,7,materials.wallDark); wallSegment(5.45,0,0.14,3.2,7,materials.wallDark);
  addLamp(-2,0,0.45,0xffc388); addLamp(2.4,0,0.45,0xffc388);
  addDoor('northToCorridor','客室廊下',-4.85,0,1.1,'corridor',{x:8.1,z:0,yaw:Math.PI},'x',0xbda67e);
  addDoor('northToDetached','離れ通路',4.85,0,1.1,'detached',{x:-3.8,z:0,yaw:0},'x',0xa89676);
  const rope = new THREE.Mesh(new THREE.BoxGeometry(2.4,0.06,0.06), new THREE.MeshStandardMaterial({ color: 0x8f5c3d, roughness: 1 })); rope.position.set(0,1.4,-1.8); rope.rotation.z = 0.25; areaGroup.add(rope);
  const seal = new THREE.Mesh(new THREE.BoxGeometry(0.18,0.36,0.02), new THREE.MeshStandardMaterial({ color: 0xf7f1df, roughness: 1 })); seal.position.set(0,1.15,-1.78); areaGroup.add(seal);
  addItem('sealTag','閉ざされた札',0,-1.8, seal, itemInteract);
}

function buildDetached(){
  createFloor(14, 8, materials.wood, -0.1);
  createCeiling(14, 8, 0x1d2235);
  scene.fog.color.set(0x0c1019); scene.fog.near = 10; scene.fog.far = 28;
  wallSegment(0,-3.95,14,3.2,0.14,materials.wallDark); wallSegment(0,3.95,14,3.2,0.14,materials.wallDark); wallSegment(-6.95,0,0.14,3.2,8,materials.wallDark); wallSegment(6.95,0,0.14,3.2,8,materials.wallDark);
  for(let i=-5;i<=5;i+=5) addLamp(i,0,0.32,0x6e88aa);
  addDoor('detachedToNorth','北廊下',-6.35,0,1.15,'north',{x:4.0,z:0,yaw:Math.PI},'x',0xa89676);
  addDoor('detachedToArchive','宿帳庫',0,3.35,1.15,'archive',{x:0,z:-3.2,yaw:0},null,0x9689a6);
  const shrine = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.2,0.44,0.8), materials.darkWood); base.position.y = 0.22; shrine.add(base);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.84,1.0,0.44), materials.darkWood); body.position.y = 0.92; shrine.add(body);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.3,0.16,0.8), materials.wood); roof.position.y = 1.48; shrine.add(roof);
  shrine.position.set(0,0,-2.6); shrine.traverse(m => { if (m.isMesh){ m.castShadow = true; m.receiveShadow = true; }}); areaGroup.add(shrine); addBoxCollider(0,-2.6,1.3,0.8);
  addItem('altar','祠',0,-2.6, shrine, itemInteract);
}

function npcInteract(entity){
  if (entity.id === 'okami') {
    if (state.step === 'talk_okami') {
      showDialogue(storyNodes.okami_intro, () => setStep('get_tray'));
    } else if (state.step === 'report_okami') {
      showDialogue(storyNodes.report_okami, () => setStep('answer_phone'));
    } else if (state.step === 'escape_archive') {
      showDialogue(storyNodes.escape_archive, () => setStep('talk_maid'));
    } else if (state.step === 'escape_detached') {
      showDialogue(storyNodes.finale, () => { setStep('finale'); state.ended = true; endingEl.classList.remove('hidden'); saveGame(); });
    } else if (state.step === 'finale') {
      showDialogue(storyNodes.finale, () => { endingEl.classList.remove('hidden'); saveGame(); });
    }
  } else if (entity.id === 'guest201' && state.step === 'deliver_201') {
    showDialogue(storyNodes.guest201, () => setStep('report_okami'));
  } else if (entity.id === 'maid' && state.step === 'talk_maid') {
    showDialogue(storyNodes.maid, () => setStep('inspect_north'));
  } else if (entity.id === 'chef' && state.step === 'get_tray') {
    showDialogue(storyNodes.tray, ()=>{});
  }
}

function itemInteract(entity){
  if (entity.id === 'tray' && state.step === 'get_tray') {
    dynamicGroup.remove(entity.mesh);
    removeItem(entity.id);
    state.questFlags.hasTray = true;
    showDialogue(storyNodes.tray, () => setStep('deliver_201'));
  } else if (entity.id === 'phone' && state.step === 'answer_phone') {
    showDialogue(storyNodes.phone, () => setStep('inspect_archive'));
  } else if (entity.id === 'blueLedger' && state.step === 'inspect_archive') {
    dynamicGroup.remove(entity.mesh);
    removeItem(entity.id);
    state.questFlags.hasLedger = true;
    showDialogue(storyNodes.blueLedger, () => {
      startChase('archive', { x: 0, z: 0 }, 'escape_archive');
      setStep('escape_archive');
    });
  } else if (entity.id === 'sealTag' && state.step === 'inspect_north') {
    showDialogue(storyNodes.sealTag, () => setStep('inspect_detached'));
  } else if (entity.id === 'altar' && state.step === 'inspect_detached') {
    showDialogue(storyNodes.altar, () => {
      startChase('detached', { x: 0, z: 0 }, 'escape_detached');
      setStep('escape_detached');
    });
  }
}

function removeItem(id){
  const idx = items.findIndex(it => it.id === id);
  if (idx >= 0) items.splice(idx,1);
}

function showDialogue(list, done){
  state.menuOpen = true;
  state.dialogueQueue = list.map(row => ({ name: row[0], text: row[1], face: row[2] }));
  dialogueOverlay.classList.remove('hidden');
  dialogueOverlay.dataset.done = done ? '1' : '';
  dialogueOverlay._done = done || null;
  advanceDialogue();
}
function advanceDialogue(){
  if (!state.dialogueQueue.length) {
    dialogueOverlay.classList.add('hidden');
    state.menuOpen = false;
    const done = dialogueOverlay._done;
    dialogueOverlay._done = null;
    if (done) done();
    return;
  }
  const row = state.dialogueQueue.shift();
  dialogueNameEl.textContent = row.name;
  dialogueTextEl.textContent = row.text;
  portraitEl.innerHTML = '';
  portraitEl.appendChild(makePortrait(row.face || 'hero'));
}
function makePortrait(face){
  const wrap = document.createElement('div');
  wrap.style.width = '100%'; wrap.style.height = '100%'; wrap.style.display = 'grid'; wrap.style.placeItems = 'center';
  const card = document.createElement('div');
  card.style.width = '82%'; card.style.aspectRatio = '0.68'; card.style.borderRadius = '18px';
  card.style.background = `linear-gradient(180deg, rgba(255,255,255,.14), rgba(0,0,0,.16)), url(${faceTextures[face].image.toDataURL()}) center/cover no-repeat`;
  card.style.border = '1px solid rgba(255,255,255,.12)';
  wrap.appendChild(card);
  return wrap;
}
dialogueOverlay.addEventListener('pointerdown', advanceDialogue);
dialogueOverlay.addEventListener('touchstart', function(e){ e.preventDefault(); advanceDialogue(); }, { passive:false });

function currentStep(){ return stepDefs[state.step]; }
function setStep(id){
  state.step = id;
  const def = currentStep();
  dayLabelEl.textContent = 'DAY ' + def.day;
  phaseLabelEl.textContent = def.phase;
  objectiveTextEl.textContent = def.text;
  objectiveSubEl.textContent = def.sub;
  saveGame();
}

function startChase(areaId, guidePos, linkedStep){
  state.checkpoint = { area: areaId, x: player.x, z: player.z, yaw: player.yaw, step: linkedStep };
  state.chase = { active: true, speed: 2.55 };
  spawnGuide(guidePos.x, guidePos.z);
}
function stopChase(){
  state.chase = null;
  if (state.guide) { dynamicGroup.remove(state.guide.group); state.guide = null; }
}
function spawnGuide(x,z){
  if (state.guide) dynamicGroup.remove(state.guide.group);
  const group = makeCharacter('guide', 0x2f4d7d);
  group.position.set(x,0.28,z);
  dynamicGroup.add(group);
  state.guide = { group, x, z, yaw: 0 };
}
function triggerGameOver(){
  state.menuOpen = true;
  gameOverEl.classList.remove('hidden');
}
function retryFromCheckpoint(){
  gameOverEl.classList.add('hidden');
  state.menuOpen = false;
  if (!state.checkpoint) return;
  setStep(state.checkpoint.step);
  state.area = state.checkpoint.area;
  buildArea(state.area);
  player.x = state.checkpoint.x;
  player.z = state.checkpoint.z;
  player.yaw = state.checkpoint.yaw;
  player.pitch = 0;
  stopChase();
  if (state.step === 'escape_archive') startChase('archive', {x:0,z:0}, 'escape_archive');
  if (state.step === 'escape_detached') startChase('detached', {x:0,z:0}, 'escape_detached');
}

function interact(){
  if (state.menuOpen) return;
  if (!dialogueOverlay.classList.contains('hidden')) return;
  const target = getNearestInteractable();
  if (!target) return;
  if (target.type === 'door') {
    useDoor(target.entity);
  } else if (target.type === 'npc') {
    target.entity.onInteract(target.entity);
  } else if (target.type === 'item') {
    target.entity.onInteract(target.entity);
  }
}

function getNearestInteractable(){
  let best = null; let bestScore = Infinity;
  const def = currentStep();
  const trigger = def && def.trigger ? def.trigger : null;
  const facing = { x: -Math.sin(player.yaw), z: -Math.cos(player.yaw) };
  const all = [];
  doors.forEach(d => all.push({ type: 'door', entity: d, x: d.x, z: d.z, label: d.label }));
  npcs.forEach(n => all.push({ type: 'npc', entity: n, x: n.x, z: n.z, label: n.name }));
  items.forEach(i => all.push({ type: 'item', entity: i, x: i.x, z: i.z, label: i.label }));
  for (const obj of all) {
    const dx = obj.x - player.x, dz = obj.z - player.z;
    const dist = Math.hypot(dx, dz);
    const isCurrentTarget = !!(trigger && trigger.type === obj.type && trigger.id === obj.entity.id);
    const maxDist = obj.type === 'door' ? 2.5 : (isCurrentTarget ? 3.4 : 2.7);
    if (dist > maxDist) continue;
    const dir = dist > 0.001 ? ((dx * facing.x + dz * facing.z) / dist) : 1;
    const minDir = obj.type === 'door' ? 0.05 : (isCurrentTarget ? -0.25 : -0.05);
    if (dir < minDir && dist > 1.2) continue;
    const score = dist - (isCurrentTarget ? 0.75 : 0);
    if (score < bestScore) { bestScore = score; best = obj; }
  }
  return best;
}
function useDoor(door){
  const now = performance.now();
  if (now < state.doorCooldownUntil || now < state.inputLockUntil) return;
  if (state.lastDoorId === door.id) return;
  state.lastDoorId = door.id;
  state.doorCooldownUntil = now + 1200;
  state.inputLockUntil = now + 650;
  resetInput();
  state.area = door.toArea;
  buildArea(state.area);
  player.x = door.toSpawn.x;
  player.z = door.toSpawn.z;
  player.yaw = door.toSpawn.yaw || 0;
  player.pitch = 0;
  if (state.chase && state.area === 'lobby') {
    stopChase();
    if (state.step === 'escape_archive') setStep('talk_maid');
    else if (state.step === 'escape_detached') setStep('finale');
  }
}

function updatePrompt(){
  const now = performance.now();
  const obj = getNearestInteractable();
  if (!obj || state.menuOpen || !dialogueOverlay.classList.contains('hidden') || now < state.inputLockUntil) {
    promptEl.classList.remove('show');
    return;
  }
  const kind = obj.type === 'door' ? '移動' : (obj.type === 'npc' ? '話す' : '調べる');
  promptEl.textContent = 'E / ACT : ' + obj.label + ' / ' + kind;
  promptEl.classList.add('show');
}

function updateObjectiveDistance(){
  const def = currentStep();
  objectiveTextEl.textContent = def.text;
  objectiveSubEl.textContent = def.sub;
  const approx = calculateDistanceToObjective();
  distanceLabelEl.textContent = def.sub + ' 約' + Math.max(1, Math.round(approx)) + 'm';
}
function calculateDistanceToObjective(){
  const def = currentStep();
  if (state.area === def.targetArea) return Math.hypot(player.x - def.targetPos.x, player.z - def.targetPos.z);
  const route = shortestAreaDistance(state.area, def.targetArea);
  return route + 6;
}
function shortestAreaDistance(from, to){
  if (from === to) return 0;
  const dist = {}; const done = {};
  Object.keys(graph).forEach(k => dist[k] = Infinity);
  dist[from] = 0;
  while (true) {
    let current = null, currentDist = Infinity;
    Object.keys(dist).forEach(k => { if (!done[k] && dist[k] < currentDist) { current = k; currentDist = dist[k]; } });
    if (!current) break;
    if (current === to) break;
    done[current] = true;
    const edges = graph[current] || {};
    Object.keys(edges).forEach(next => { dist[next] = Math.min(dist[next], dist[current] + edges[next]); });
  }
  return dist[to] === Infinity ? 99 : dist[to];
}

function updateMinimap(){
  minimapCtx.clearRect(0,0,minimap.width,minimap.height);
  minimapCtx.fillStyle = 'rgba(8,10,18,.86)';
  roundRect(minimapCtx, 0,0,minimap.width,minimap.height,22); minimapCtx.fill();
  minimapCtx.fillStyle = '#a79b84'; minimapCtx.font = '12px sans-serif'; minimapCtx.fillText('館内導線', 14, 18);
  const nodes = {
    lobby:[40,50], kitchen:[40,88], corridor:[105,50], room201:[164,28], bath:[200,28], archive:[105,88], north:[164,88], detached:[200,88]
  };
  minimapCtx.strokeStyle='rgba(255,255,255,.14)'; minimapCtx.lineWidth=2;
  Object.keys(graph).forEach(k=>{ Object.keys(graph[k]).forEach(to=>{ if(k<to){ const a=nodes[k], b=nodes[to]; minimapCtx.beginPath(); minimapCtx.moveTo(a[0],a[1]); minimapCtx.lineTo(b[0],b[1]); minimapCtx.stroke(); } }); });
  Object.keys(nodes).forEach(k=>{
    const [x,y]=nodes[k];
    minimapCtx.fillStyle = k===state.area ? '#d4bb7a' : (k===currentStep().targetArea ? '#91aaf3' : '#2b3348');
    roundRect(minimapCtx, x-28, y-12, 56, 24, 6); minimapCtx.fill();
    minimapCtx.fillStyle = '#f1ede5'; minimapCtx.font = '11px sans-serif'; minimapCtx.textAlign='center'; minimapCtx.textBaseline='middle';
    minimapCtx.fillText(areaLabels[k], x, y);
  });
  minimapCtx.textAlign='start'; minimapCtx.textBaseline='alphabetic';
}
function roundRect(ctx,x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }

function setCamera(){
  camera.position.set(player.x, player.height, player.z);
  camera.rotation.order = 'YXZ';
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;
}

function movePlayer(dt){
  if (state.menuOpen || !dialogueOverlay.classList.contains('hidden')) return;
  const moveX = input.joyX + ((input.keys.KeyD?1:0) - (input.keys.KeyA?1:0));
  const moveY = input.joyY + ((input.keys.KeyW?1:0) - (input.keys.KeyS?1:0));
  const len = Math.hypot(moveX, moveY);
  if (len < 0.01) return;
  const nx = moveX / Math.max(1, len);
  const nz = moveY / Math.max(1, len);
  const speed = player.speed * (input.keys.ShiftLeft ? player.run : 1) * dt;
  const sin = Math.sin(player.yaw), cos = Math.cos(player.yaw);
  const dx = (cos * nx - sin * nz) * speed;
  const dz = (-sin * nx - cos * nz) * speed;
  attemptMove(player.x + dx, player.z + dz);
}
function attemptMove(nx, nz){
  const r = player.radius;
  for (const c of colliders) {
    if (nx + r > c.x1 && nx - r < c.x2 && nz + r > c.z1 && nz - r < c.z2) {
      // try slide X only
      const clearX = !(nx + r > c.x1 && nx - r < c.x2 && player.z + r > c.z1 && player.z - r < c.z2);
      const clearZ = !(player.x + r > c.x1 && player.x - r < c.x2 && nz + r > c.z1 && nz - r < c.z2);
      if (clearX) { player.x = nx; return; }
      if (clearZ) { player.z = nz; return; }
      return;
    }
  }
  player.x = nx; player.z = nz;
}

function updateChase(dt){
  if (!state.chase || !state.guide || state.menuOpen || !dialogueOverlay.classList.contains('hidden')) return;
  const gx = state.guide.group.position.x, gz = state.guide.group.position.z;
  const dx = player.x - gx, dz = player.z - gz;
  const dist = Math.hypot(dx,dz);
  if (dist < 0.86) {
    triggerGameOver();
    return;
  }
  const move = Math.min(state.chase.speed * dt, dist * 0.92);
  state.guide.group.position.x += (dx / Math.max(.001, dist)) * move;
  state.guide.group.position.z += (dz / Math.max(.001, dist)) * move;
  state.guide.group.rotation.y = Math.atan2(dx, dz);
}

function updateDoorLatch(){
  if (!state.lastDoorId) return;
  const door = doors.find(d => d.id === state.lastDoorId);
  if (!door) { state.lastDoorId = null; return; }
  const dist = Math.hypot(player.x - door.x, player.z - door.z);
  if (dist > door.radius + 1.2 && performance.now() > state.doorCooldownUntil) state.lastDoorId = null;
}

function update(){
  updateDoorLatch();
  updatePrompt();
  updateObjectiveDistance();
  updateMinimap();
  if (state.hudHidden) {
    hud.style.display = 'none';
    joystickZone.style.display = 'none';
    actBtn.style.display = 'none';
    lookZone.style.display = 'none';
  } else {
    hud.style.display = '';
    joystickZone.style.display = '';
    actBtn.style.display = '';
    lookZone.style.display = '';
  }
}

let lastTime = performance.now();
function animate(now){
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  movePlayer(dt);
  updateChase(dt);
  setCamera();
  update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function saveGame(){
  const data = {
    area: state.area,
    step: state.step,
    x: player.x,
    z: player.z,
    yaw: player.yaw,
    pitch: player.pitch,
    hudHidden: state.hudHidden,
    questFlags: state.questFlags,
    ended: state.ended,
    checkpoint: state.checkpoint
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}
function loadGame(){
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    state.area = data.area || 'lobby';
    state.step = data.step || 'talk_okami';
    state.hudHidden = !!data.hudHidden;
    state.questFlags = data.questFlags || {};
    state.ended = !!data.ended;
    state.checkpoint = data.checkpoint || null;
    buildArea(state.area);
    player.x = typeof data.x === 'number' ? data.x : 0;
    player.z = typeof data.z === 'number' ? data.z : 0;
    player.yaw = typeof data.yaw === 'number' ? data.yaw : 0;
    player.pitch = typeof data.pitch === 'number' ? data.pitch : 0;
    if (state.step === 'escape_archive') startChase('archive',{x:0,z:0},'escape_archive');
    if (state.step === 'escape_detached') startChase('detached',{x:0,z:0},'escape_detached');
    if (state.ended) endingEl.classList.remove('hidden');
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

function resetInput(){
  input.joyX = 0; input.joyY = 0; input.keys = Object.create(null); centerJoystick();
}

function setupControls(){
  window.addEventListener('resize', onResize);
  document.addEventListener('keydown', function(e){
    if (e.code === 'KeyE') { interact(); e.preventDefault(); return; }
    if (e.code === 'Escape') { toggleMenu(); e.preventDefault(); return; }
    input.keys[e.code] = true;
  });
  document.addEventListener('keyup', function(e){ input.keys[e.code] = false; });
  actBtn.addEventListener('pointerdown', function(e){ e.preventDefault(); interact(); });
  menuBtn.addEventListener('click', toggleMenu);
  menuOverlay.addEventListener('click', function(e){
    const btn = e.target.closest('button'); if (!btn) return;
    const act = btn.dataset.action;
    if (act === 'close') toggleMenu(false);
    else if (act === 'save') { saveGame(); toggleMenu(false); }
    else if (act === 'load') { loadGame(); toggleMenu(false); }
    else if (act === 'hud') { state.hudHidden = !state.hudHidden; toggleMenu(false); saveGame(); }
    else if (act === 'title') { location.href = 'index.html'; }
  });
  gameOverEl.addEventListener('click', function(e){
    const btn = e.target.closest('button'); if (!btn) return;
    if (btn.dataset.go === 'retry') { gameOverEl.classList.add('hidden'); retryFromCheckpoint(); }
    else location.href = 'index.html';
  });
  endingEl.addEventListener('click', function(e){ if (e.target.closest('button')) location.href = 'index.html'; });

  joystickZone.addEventListener('pointerdown', startJoy);
  window.addEventListener('pointermove', moveJoy);
  window.addEventListener('pointerup', endJoy);
  lookZone.addEventListener('pointerdown', startLook);
  canvas.addEventListener('pointerdown', function(e){
    if (state.menuOpen) return;
    if (e.clientX > window.innerWidth * 0.38) {
      input.lookId = e.pointerId;
      input.lookDragging = true;
      input.pointerX = e.clientX;
      input.pointerY = e.clientY;
      canvas.setPointerCapture?.(e.pointerId);
    }
  });
  window.addEventListener('pointermove', moveLook);
  window.addEventListener('pointerup', endLook);
  canvas.addEventListener('mousedown', function(e){ if (e.clientX > window.innerWidth * .38) { input.mouseDrag = true; input.pointerX = e.clientX; input.pointerY = e.clientY; } });
  window.addEventListener('mousemove', function(e){ if (!input.mouseDrag || state.menuOpen) return; const dx = e.clientX - input.pointerX; const dy = e.clientY - input.pointerY; input.pointerX = e.clientX; input.pointerY = e.clientY; rotateLook(dx,dy); });
  window.addEventListener('mouseup', function(){ input.mouseDrag = false; });
  document.addEventListener('gesturestart', preventer, {passive:false});
  document.addEventListener('dblclick', preventer, {passive:false});
}
function preventer(e){ e.preventDefault(); }
function startJoy(e){ if(state.menuOpen) return; input.joyId = e.pointerId; updateJoy(e); joystickZone.setPointerCapture?.(e.pointerId); }
function moveJoy(e){ if(e.pointerId !== input.joyId) return; updateJoy(e); }
function endJoy(e){ if(e.pointerId !== input.joyId) return; input.joyId = null; input.joyX = 0; input.joyY = 0; centerJoystick(); }
function updateJoy(e){
  const rect = joystickBase.getBoundingClientRect();
  const cx = rect.left + rect.width/2, cy = rect.top + rect.height/2;
  const dx = e.clientX - cx, dy = e.clientY - cy;
  const max = rect.width * 0.3; const len = Math.hypot(dx,dy); const clamped = Math.min(max, len || 0.001);
  const nx = dx / (len || 1), ny = dy / (len || 1);
  const x = nx * clamped, y = ny * clamped;
  joystickKnob.style.transform = `translate(${x}px, ${y}px)`;
  input.joyX = x / max;
  input.joyY = -(y / max);
}
function centerJoystick(){ joystickKnob.style.transform = 'translate(0px, 0px)'; }
function startLook(e){ if(state.menuOpen) return; input.lookId = e.pointerId; input.lookDragging = true; input.pointerX = e.clientX; input.pointerY = e.clientY; lookZone.setPointerCapture?.(e.pointerId); }
function moveLook(e){ if(!input.lookDragging || e.pointerId !== input.lookId || state.menuOpen) return; const dx = e.clientX - input.pointerX; const dy = e.clientY - input.pointerY; input.pointerX = e.clientX; input.pointerY = e.clientY; rotateLook(dx,dy); }
function endLook(e){ if(e.pointerId !== input.lookId) return; input.lookDragging = false; input.lookId = null; }
function rotateLook(dx,dy){ player.yaw -= dx * 0.0088; player.pitch -= dy * 0.0064; player.pitch = Math.max(-1.05, Math.min(1.05, player.pitch)); }
function toggleMenu(force){
  const open = typeof force === 'boolean' ? force : !state.menuOpen;
  state.menuOpen = open;
  menuOverlay.classList.toggle('hidden', !open);
  if (open) resetInput();
}
function onResize(){ renderer.setSize(window.innerWidth, window.innerHeight, false); camera.aspect = window.innerWidth/window.innerHeight; camera.updateProjectionMatrix(); }

function init(){
  setupControls();
  const ok = loadGame();
  if (!ok) {
    buildArea(state.area);
    player.x = 0; player.z = 2.8; player.yaw = Math.PI;
    setStep('talk_okami');
  }
  requestAnimationFrame(animate);
}

init();

})();
