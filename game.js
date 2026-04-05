(function () {
  const canvas = document.getElementById('gameCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d', { alpha: false });
  const statusBox = document.getElementById('statusBox');
  const objectiveBox = document.getElementById('objectiveBox');
  const promptBox = document.getElementById('promptBox');
  const dialogueBox = document.getElementById('dialogueBox');
  const dialogueText = document.getElementById('dialogueText');
  const speakerLabel = document.getElementById('speakerLabel');
  const phaseLabel = document.getElementById('phaseLabel');
  const endingScreen = document.getElementById('endingScreen');
  const endingTitle = document.getElementById('endingTitle');
  const endingText = document.getElementById('endingText');
  const actBtn = document.getElementById('actBtn');
  const movePad = document.getElementById('movePad');
  const moveKnob = document.getElementById('moveKnob');
  const saveBtn = document.getElementById('saveBtn');
  const loadBtn = document.getElementById('loadBtn');

  const STORAGE_KEY = 'yoinado_v11_save';
  const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

  const OFF_W = 240;
  const OFF_H = 152;
  const off = document.createElement('canvas');
  off.width = OFF_W;
  off.height = OFF_H;
  const g = off.getContext('2d', { alpha: false });
  g.imageSmoothingEnabled = false;

  const FOV = Math.PI / 3.15;
  const MAX_DEPTH = 20;
  const AMBIENT_DAY = 1.0;
  const AMBIENT_NIGHT = 0.54;

  const map = [
    '#####################',
    '#....S....D......L..#',
    '#.######.#####.###..#',
    '#.#....#.....#...#..#',
    '#.#.##.#####.#.#.#..#',
    '#.#.##.....#.#.#.#..#',
    '#.#.######.#.#.#.#..#',
    '#.#......#.#.#...#..#',
    '#.######.#.#.#####..#',
    '#......#.#.#....L...#',
    '#.####.#.#.#######..#',
    '#.#....#...#.....#..#',
    '#.#.#########.##.#..#',
    '#.#.....L.....##.#..#',
    '#.##############.#..#',
    '#.................L.#',
    '#####################'
  ];
  const MAP_W = map[0].length;
  const MAP_H = map.length;

  const player = { x: 2.45, y: 15.2, a: -Math.PI / 2, radius: 0.18, speed: 2.05 };
  const keys = { w: false, a: false, s: false, d: false };
  const moveInput = { active: false, x: 0, y: 0, pointerId: null };
  const lookInput = { active: false, lastX: 0, pointerId: null, dx: 0 };

  const state = {
    phase: 'day',
    objective: '女将に話しかける',
    inDialogue: false,
    dialogueQueue: [],
    dialogueOnEnd: null,
    nearby: null,
    ending: false,
    flicker: 0,
    pulse: 0,
    hallwayLocked: true,
  };

  const tasks = {
    talkedToOkami: false,
    gotKey: false,
    deliveredKey: false,
    answeredPhone: false,
    startedNight: false,
    checkedRoom: false,
    foundLedger: false,
    sawFlagman: false,
  };

  function setStatus(text) { statusBox.textContent = text; }
  function setObjective(text) { state.objective = text; objectiveBox.textContent = text; }

  function tileAt(x, y) {
    const mx = Math.floor(x), my = Math.floor(y);
    if (mx < 0 || my < 0 || mx >= MAP_W || my >= MAP_H) return '#';
    return map[my][mx];
  }

  function isSolidTile(tile) {
    if (tile === '.' || tile === 'L') return false;
    if (tile === 'D') return state.hallwayLocked;
    return true;
  }

  function isWall(x, y) {
    return isSolidTile(tileAt(x, y));
  }

  function moveAndCollide(nx, ny) {
    if (!isWall(nx, player.y)) player.x = nx;
    if (!isWall(player.x, ny)) player.y = ny;
  }

  function showDialogue(lines, onEnd) {
    state.inDialogue = true;
    state.dialogueQueue = lines.slice();
    state.dialogueOnEnd = onEnd || null;
    dialogueBox.classList.remove('hidden');
    promptBox.classList.add('hidden');
    advanceDialogue();
  }

  function advanceDialogue() {
    if (!state.inDialogue) return;
    if (state.dialogueQueue.length === 0) {
      state.inDialogue = false;
      dialogueBox.classList.add('hidden');
      const fn = state.dialogueOnEnd;
      state.dialogueOnEnd = null;
      if (typeof fn === 'function') fn();
      return;
    }
    const [speaker, text] = state.dialogueQueue.shift();
    speakerLabel.textContent = speaker;
    dialogueText.textContent = text;
  }

  function endGame(title, text) {
    state.ending = true;
    endingTitle.textContent = title;
    endingText.textContent = text;
    endingScreen.classList.remove('hidden');
    promptBox.classList.add('hidden');
  }

  function getSaveData() {
    return {
      player,
      tasks,
      statePhase: state.phase,
      objective: state.objective,
      hallwayLocked: state.hallwayLocked,
    };
  }

  function saveGame() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(getSaveData()));
    setStatus('保存した');
  }

  function loadGame() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) { setStatus('保存データなし'); return false; }
    try {
      const data = JSON.parse(raw);
      Object.assign(player, data.player || {});
      Object.assign(tasks, data.tasks || {});
      state.phase = data.statePhase || 'day';
      state.hallwayLocked = data.hallwayLocked !== false;
      phaseLabel.textContent = state.phase === 'night' ? '深夜見回り' : '昼勤務';
      setObjective(data.objective || '続きから再開');
      endingScreen.classList.add('hidden');
      state.ending = false;
      state.inDialogue = false;
      dialogueBox.classList.add('hidden');
      setStatus('ロードした');
      return true;
    } catch (e) {
      setStatus('ロード失敗');
      return false;
    }
  }

  function startNew() {
    player.x = 2.45;
    player.y = 15.2;
    player.a = -Math.PI / 2;
    Object.keys(tasks).forEach(k => tasks[k] = false);
    state.phase = 'day';
    state.inDialogue = false;
    state.dialogueQueue = [];
    state.dialogueOnEnd = null;
    state.nearby = null;
    state.ending = false;
    state.hallwayLocked = true;
    phaseLabel.textContent = '昼勤務';
    endingScreen.classList.add('hidden');
    dialogueBox.classList.add('hidden');
    setObjective('女将に話しかける');
    setStatus('起動完了 / v11');
    showDialogue([
      ['記録', '山奥の古い旅館で住み込み勤務を始めた。'],
      ['記録', '昼は接客。夜は見回り。まずは帳場の女将に話しかける。']
    ]);
  }

  function makeTexture(kind) {
    const c = document.createElement('canvas');
    c.width = 32; c.height = 32;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    if (kind === 'wood') {
      x.fillStyle = '#4e3522'; x.fillRect(0, 0, 32, 32);
      for (let i = 0; i < 32; i += 8) {
        x.fillStyle = i % 16 === 0 ? '#6f4c31' : '#5d4028';
        x.fillRect(i, 0, 6, 32);
      }
      x.fillStyle = 'rgba(35,22,14,0.55)';
      for (let i = 0; i < 32; i += 4) x.fillRect(i, 0, 1, 32);
      x.fillStyle = 'rgba(255,220,150,0.06)';
      for (let y = 2; y < 32; y += 6) x.fillRect(0, y, 32, 1);
    } else if (kind === 'shoji') {
      x.fillStyle = '#d7cab0'; x.fillRect(0, 0, 32, 32);
      x.fillStyle = '#7c5f3f';
      for (let i = 0; i < 32; i += 8) {
        x.fillRect(i, 0, 1, 32);
        x.fillRect(0, i, 32, 1);
      }
      x.fillStyle = 'rgba(250,234,190,0.18)';
      x.fillRect(0, 0, 32, 32);
    } else if (kind === 'door') {
      x.fillStyle = '#2f251d'; x.fillRect(0, 0, 32, 32);
      x.fillStyle = '#6c5641'; x.fillRect(3, 3, 26, 26);
      x.fillStyle = '#35281d'; x.fillRect(15, 3, 2, 26);
      x.fillStyle = '#c6a06b'; x.fillRect(22, 16, 3, 3);
    } else {
      x.fillStyle = '#201712'; x.fillRect(0, 0, 32, 32);
    }
    return x.getImageData(0, 0, 32, 32).data;
  }

  const textures = {
    wood: makeTexture('wood'),
    shoji: makeTexture('shoji'),
    door: makeTexture('door'),
    dark: makeTexture('dark'),
  };

  function sampleTexture(tex, u, v, brightness) {
    const tx = ((u % 1 + 1) % 1) * 31 | 0;
    const ty = ((v % 1 + 1) % 1) * 31 | 0;
    const idx = (ty * 32 + tx) * 4;
    return [
      Math.min(255, tex[idx] * brightness),
      Math.min(255, tex[idx + 1] * brightness),
      Math.min(255, tex[idx + 2] * brightness)
    ];
  }

  function makeSprite(kind) {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 96;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.clearRect(0, 0, 64, 96);
    if (kind === 'okami') {
      x.fillStyle = '#f6ead6'; x.fillRect(24, 12, 16, 16);
      x.fillStyle = '#3e2835'; x.fillRect(18, 24, 28, 40);
      x.fillStyle = '#a95c5c'; x.fillRect(10, 30, 44, 16);
      x.fillStyle = '#e1c77c'; x.fillRect(24, 42, 16, 8);
      x.fillStyle = '#181116'; x.fillRect(20, 8, 24, 10);
      x.fillStyle = '#f6ead6'; x.fillRect(16, 28, 8, 18); x.fillRect(40, 28, 8, 18);
    } else if (kind === 'guest') {
      x.fillStyle = '#dde3ea'; x.fillRect(22, 12, 20, 18);
      x.fillStyle = '#63748a'; x.fillRect(18, 30, 28, 34);
      x.fillStyle = '#2b3340'; x.fillRect(18, 20, 28, 8);
      x.fillStyle = '#dde3ea'; x.fillRect(14, 32, 8, 18); x.fillRect(42, 32, 8, 18);
    } else if (kind === 'flagman') {
      x.fillStyle = '#ffffff'; x.fillRect(18, 10, 28, 12);
      x.fillStyle = '#dadada'; x.fillRect(22, 20, 20, 8);
      x.fillStyle = '#f5dfc1'; x.fillRect(24, 26, 16, 16);
      x.fillStyle = '#204d9d'; x.fillRect(18, 42, 28, 30);
      x.fillStyle = '#1b2c59'; x.fillRect(10, 44, 8, 20); x.fillRect(46, 44, 8, 20);
      x.fillStyle = '#7ad3b0'; x.fillRect(44, 46, 10, 8);
      x.fillStyle = '#f4f4f4'; x.fillRect(4, 38, 18, 10);
      x.fillStyle = '#c93c3c'; x.fillRect(42, 34, 18, 14);
      x.fillStyle = '#7b5b40'; x.fillRect(20, 36, 2, 26); x.fillRect(42, 34, 2, 26);
    } else if (kind === 'lantern') {
      x.fillStyle = 'rgba(255,210,120,0.18)'; x.fillRect(6, 14, 52, 52);
      x.fillStyle = '#f6c76b'; x.fillRect(18, 18, 28, 32);
      x.fillStyle = '#9a432a'; x.fillRect(16, 16, 32, 4); x.fillRect(16, 50, 32, 4);
      x.fillStyle = '#fff1bf'; x.fillRect(24, 24, 16, 18);
      x.fillStyle = '#7c5d37'; x.fillRect(30, 8, 4, 10);
    } else if (kind === 'key') {
      x.fillStyle = '#d4b565'; x.fillRect(28, 32, 18, 6);
      x.fillRect(40, 28, 6, 18);
      x.clearRect(24, 30, 8, 8);
      x.fillStyle = '#e7d59e'; x.fillRect(20, 30, 12, 12);
    } else if (kind === 'phone') {
      x.fillStyle = '#1f1f1f'; x.fillRect(18, 34, 28, 14);
      x.fillRect(22, 24, 20, 6);
      x.fillStyle = '#d2d2d2'; x.fillRect(24, 18, 16, 6);
    } else if (kind === 'ledger') {
      x.fillStyle = '#ece4d6'; x.fillRect(18, 24, 28, 34);
      x.fillStyle = '#a13b3b'; x.fillRect(18, 24, 6, 34);
      x.fillStyle = '#7f6a52'; x.fillRect(24, 30, 16, 2); x.fillRect(24, 38, 16, 2); x.fillRect(24, 46, 12, 2);
    }
    return c;
  }

  const spriteSheets = {
    okami: makeSprite('okami'),
    guest: makeSprite('guest'),
    flagman: makeSprite('flagman'),
    lantern: makeSprite('lantern'),
    key: makeSprite('key'),
    phone: makeSprite('phone'),
    ledger: makeSprite('ledger'),
  };

  const interactives = [
    {
      id: 'okami', x: 2.8, y: 13.25, r: 0.55, label: '女将', sprite: 'okami', phase: 'day',
      visible: () => true,
      onInteract() {
        if (!tasks.talkedToOkami) {
          tasks.talkedToOkami = true;
          setObjective('鍵掛けから201号室の鍵を取る');
          showDialogue([
            ['女将', '今日の客は二組だけだよ。まずは201の鍵を持っていきな。'],
            ['女将', '渡し終えたら、帳場の電話に気を付けること。夜は急に静かになるから。']
          ]);
        } else {
          showDialogue([['女将', tasks.startedNight ? '夜は見回りだよ。廊下の奥だけ、あまり長く見ないこと。': '201の鍵を持っていきな。']]);
        }
      }
    },
    {
      id: 'key', x: 6.55, y: 14.2, r: 0.36, label: '201の鍵', sprite: 'key', phase: 'day',
      visible: () => tasks.talkedToOkami && !tasks.gotKey,
      onInteract() {
        tasks.gotKey = true;
        setObjective('201号室の客に鍵を渡す');
        showDialogue([['記録', '201号室の真鍮の鍵を取った。壁にかかった札が妙に冷たい。']]);
      }
    },
    {
      id: 'guest', x: 17.5, y: 9.7, r: 0.52, label: '201号室の客', sprite: 'guest', phase: 'day',
      visible: () => tasks.gotKey && !tasks.deliveredKey,
      onInteract() {
        tasks.deliveredKey = true;
        setObjective('帳場へ戻り、鳴った電話に出る');
        showDialogue([
          ['宿泊客', '……鍵、ありがとうございます。'],
          ['宿泊客', 'この旅館、夜になると廊下の長さが変わりませんか。']
        ]);
      }
    },
    {
      id: 'phone', x: 2.45, y: 14.55, r: 0.34, label: '帳場の電話', sprite: 'phone', phase: 'day',
      visible: () => tasks.deliveredKey && !tasks.answeredPhone,
      onInteract() {
        tasks.answeredPhone = true;
        setObjective('帳場の引き戸を開けて夜の見回りに入る');
        state.hallwayLocked = false;
        showDialogue([
          ['内線', '……今夜も、見回りを始めて。'],
          ['内線', '赤い旗が見えたら、目を逸らさないで。']
        ]);
      }
    },
    {
      id: 'nightDoor', x: 10.6, y: 1.8, r: 0.46, label: '奥廊下の引き戸', sprite: 'lantern', phase: 'day',
      visible: () => tasks.answeredPhone && !tasks.startedNight,
      onInteract() {
        tasks.startedNight = true;
        state.phase = 'night';
        phaseLabel.textContent = '深夜見回り';
        player.x = 9.5; player.y = 2.5; player.a = 0;
        setObjective('201号室の前を見回る');
        showDialogue([
          ['記録', '明かりが一段落ちた。旅館の空気が、昼とは別物になる。'],
          ['女将', '201の前を見たら、帳場ノートを取りに戻りな。']
        ]);
      }
    },
    {
      id: 'room201', x: 16.8, y: 9.8, r: 0.44, label: '201号室の前', sprite: 'lantern', phase: 'night',
      visible: () => tasks.startedNight && !tasks.checkedRoom,
      onInteract() {
        tasks.checkedRoom = true;
        setObjective('帳場ノートを探す');
        showDialogue([
          ['記録', '部屋の前には誰もいない。'],
          ['記録', 'なのに、鍵穴の奥だけが息をしているみたいに揺れていた。']
        ]);
      }
    },
    {
      id: 'ledger', x: 3.25, y: 14.35, r: 0.34, label: '帳場ノート', sprite: 'ledger', phase: 'night',
      visible: () => tasks.checkedRoom && !tasks.foundLedger,
      onInteract() {
        tasks.foundLedger = true;
        setObjective('廊下の一番奥を確認する');
        showDialogue([
          ['帳場ノート', '「白旗は通れ、赤旗は戻れ」'],
          ['帳場ノート', '「ただし宵宿では、その二つは同じ意味になる」']
        ]);
      }
    },
    {
      id: 'flagman', x: 18.2, y: 1.8, r: 0.6, label: '旗を振る誘導員', sprite: 'flagman', phase: 'night',
      visible: () => tasks.foundLedger && !tasks.sawFlagman,
      onInteract() {
        tasks.sawFlagman = true;
        setObjective('出口へ戻る');
        showDialogue([
          ['誘導員', '白旗なら進め。赤旗なら戻れ。'],
          ['誘導員', 'だが今夜は、どちらを選んでも、旅館の外には出られない。']
        ], () => {
          endGame('赤旗の廊下', '出口へ戻ったはずなのに、帳場の明かりは遠ざかるばかりだった。宵宿の廊下は、朝まで終わらない。');
        });
      }
    }
  ];

  const lanternSprites = [];
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (map[y][x] === 'L') lanternSprites.push({ x: x + 0.5, y: y + 0.5, sprite: 'lantern', label: '' });
    }
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(320, window.innerWidth);
    const h = Math.max(480, window.innerHeight);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.imageSmoothingEnabled = false;
  }

  function castRay(angle) {
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    let depth = 0;
    let side = 0;
    while (depth < MAX_DEPTH) {
      depth += 0.01;
      const x = player.x + cos * depth;
      const y = player.y + sin * depth;
      const tile = tileAt(x, y);
      if (isSolidTile(tile)) {
        const fx = x - Math.floor(x);
        const fy = y - Math.floor(y);
        const edge = (fx < 0.03 || fx > 0.97 || fy < 0.03 || fy > 0.97);
        side = (fx < 0.03 || fx > 0.97) ? 0 : 1;
        let tex = textures.wood;
        if (tile === 'S') tex = textures.shoji;
        else if (tile === 'D') tex = textures.door;
        const u = side === 0 ? fy : fx;
        return { depth, side, edge, tex, u, tile };
      }
    }
    return { depth: MAX_DEPTH, side: 0, edge: false, tex: textures.dark, u: 0, tile: '#' };
  }

  const depthBuffer = new Float32Array(OFF_W);

  function drawBackground(now) {
    const ambient = state.phase === 'night' ? AMBIENT_NIGHT + state.flicker : AMBIENT_DAY;
    const horizon = OFF_H * 0.44;

    const sky = g.createLinearGradient(0, 0, 0, horizon);
    if (state.phase === 'night') {
      sky.addColorStop(0, '#070a12');
      sky.addColorStop(1, '#16141a');
    } else {
      sky.addColorStop(0, '#1a1512');
      sky.addColorStop(1, '#3e2b20');
    }
    g.fillStyle = sky;
    g.fillRect(0, 0, OFF_W, horizon);

    const floor = g.createLinearGradient(0, horizon, 0, OFF_H);
    if (state.phase === 'night') {
      floor.addColorStop(0, '#42352c');
      floor.addColorStop(1, '#17110d');
    } else {
      floor.addColorStop(0, '#8b7158');
      floor.addColorStop(1, '#4b3829');
    }
    g.fillStyle = floor;
    g.fillRect(0, horizon, OFF_W, OFF_H - horizon);

    for (let y = horizon; y < OFF_H; y++) {
      const t = (y - horizon) / (OFF_H - horizon);
      const rowDist = 0.65 + t * 8.8;
      const worldLeftX = player.x + Math.cos(player.a - FOV / 2) * rowDist;
      const worldLeftY = player.y + Math.sin(player.a - FOV / 2) * rowDist;
      const worldRightX = player.x + Math.cos(player.a + FOV / 2) * rowDist;
      const worldRightY = player.y + Math.sin(player.a + FOV / 2) * rowDist;
      for (let x = 0; x < OFF_W; x += 2) {
        const u = x / OFF_W;
        const wx = worldLeftX + (worldRightX - worldLeftX) * u;
        const wy = worldLeftY + (worldRightY - worldLeftY) * u;
        const cell = ((Math.floor(wx * 2) + Math.floor(wy * 2)) & 1);
        const line = (Math.floor(wx * 2) % 2 === 0) ? 0.84 : 0.72;
        const b = (state.phase === 'night' ? 40 : 78) + (cell ? 10 : 0) + (line * 12) - t * 28;
        g.fillStyle = `rgb(${b*1.08*ambient|0},${b*0.88*ambient|0},${b*0.66*ambient|0})`;
        g.fillRect(x, y, 2, 1);
      }
    }

    const lightCenters = state.phase === 'night' ? [0.22, 0.5, 0.78] : [0.2, 0.47, 0.74];
    for (const lc of lightCenters) {
      const r = state.phase === 'night' ? 18 : 26;
      const px = OFF_W * lc;
      const py = horizon - 4;
      const grad = g.createRadialGradient(px, py, 0, px, py, r);
      grad.addColorStop(0, state.phase === 'night' ? 'rgba(255,212,130,0.18)' : 'rgba(255,228,170,0.24)');
      grad.addColorStop(1, 'rgba(255,212,130,0)');
      g.fillStyle = grad;
      g.fillRect(px - r, py - r, r * 2, r * 2);
    }

    g.fillStyle = 'rgba(0,0,0,0.16)';
    g.fillRect(0, horizon - 1, OFF_W, 2);
  }

  function drawWalls() {
    const ambient = state.phase === 'night' ? AMBIENT_NIGHT + state.flicker : AMBIENT_DAY;
    for (let x = 0; x < OFF_W; x++) {
      const rayAngle = player.a - FOV / 2 + (x / OFF_W) * FOV;
      const hit = castRay(rayAngle);
      const corrected = hit.depth * Math.cos(rayAngle - player.a);
      depthBuffer[x] = corrected;
      const wallH = Math.min(OFF_H * 1.1, (OFF_H * 0.82) / Math.max(corrected, 0.0001));
      const top = ((OFF_H - wallH) / 2) | 0;
      const brightness = Math.max(0.22, (state.phase === 'night' ? 1.18 : 1.34) - corrected * 0.08 - hit.side * 0.11) * ambient;
      for (let y = 0; y < wallH; y++) {
        const v = y / wallH;
        const color = sampleTexture(hit.tex, hit.u, v, brightness);
        if (hit.edge) {
          color[0] *= 0.72; color[1] *= 0.72; color[2] *= 0.72;
        }
        g.fillStyle = `rgb(${color[0]|0},${color[1]|0},${color[2]|0})`;
        g.fillRect(x, top + y, 1, 1);
      }
    }
  }

  function renderSpriteEntity(obj, dynamicDist) {
    const dx = obj.x - player.x;
    const dy = obj.y - player.y;
    const dist = dynamicDist || Math.hypot(dx, dy);
    const angleTo = Math.atan2(dy, dx) - player.a;
    let rel = angleTo;
    while (rel < -Math.PI) rel += Math.PI * 2;
    while (rel > Math.PI) rel -= Math.PI * 2;
    if (Math.abs(rel) > FOV * 0.68 || dist < 0.2) return;

    const sheet = spriteSheets[obj.sprite];
    if (!sheet) return;
    const screenX = (0.5 + rel / FOV) * OFF_W;
    const size = Math.max(10, (OFF_H * obj.r * 2.2) / dist);
    const drawW = size;
    const drawH = size * (sheet.height / sheet.width);
    const top = OFF_H * 0.56 - drawH * 0.5;
    const left = screenX - drawW / 2;

    if (screenX + drawW < 0 || screenX - drawW > OFF_W) return;
    for (let sx = 0; sx < drawW; sx++) {
      const px = (left + sx) | 0;
      if (px < 0 || px >= OFF_W) continue;
      if (depthBuffer[px] < dist - 0.12) continue;
      const srcX = (sx / drawW) * sheet.width;
      g.drawImage(sheet, srcX, 0, 1, sheet.height, px, top, 1, drawH);
    }
  }

  function drawSprites(now) {
    const list = [];
    for (const obj of lanternSprites) list.push({ ...obj, r: 0.75 });
    for (const obj of interactives) {
      if (obj.phase !== state.phase || !obj.visible()) continue;
      list.push(obj);
    }
    list.sort((a, b) => {
      const da = Math.hypot(a.x - player.x, a.y - player.y);
      const db = Math.hypot(b.x - player.x, b.y - player.y);
      return db - da;
    });
    list.forEach(obj => renderSpriteEntity(obj));
  }

  function drawOverlays(now) {
    state.pulse += 0.016;
    const vignette = g.createRadialGradient(OFF_W * 0.5, OFF_H * 0.48, OFF_H * 0.14, OFF_W * 0.5, OFF_H * 0.48, OFF_H * 0.78);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, state.phase === 'night' ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.28)');
    g.fillStyle = vignette;
    g.fillRect(0, 0, OFF_W, OFF_H);

    g.globalAlpha = state.phase === 'night' ? 0.13 : 0.08;
    for (let i = 0; i < 42; i++) {
      g.fillStyle = i % 2 ? '#ffffff' : '#9b6b40';
      g.fillRect(Math.random() * OFF_W, Math.random() * OFF_H, 1, 1);
    }
    g.globalAlpha = 1;

    g.fillStyle = 'rgba(255,255,255,0.03)';
    for (let y = 0; y < OFF_H; y += 3) g.fillRect(0, y, OFF_W, 1);
  }

  function drawFrame(now) {
    state.flicker = state.phase === 'night' ? Math.sin(now * 0.004) * 0.06 + Math.cos(now * 0.0025) * 0.02 : 0;
    drawBackground(now);
    drawWalls();
    drawSprites(now);
    drawOverlays(now);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
  }

  function updateNearby() {
    state.nearby = null;
    promptBox.classList.add('hidden');
    let best = null;
    for (const obj of interactives) {
      if (obj.phase !== state.phase || !obj.visible()) continue;
      const dx = obj.x - player.x;
      const dy = obj.y - player.y;
      const dist = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx) - player.a;
      let rel = angle;
      while (rel < -Math.PI) rel += Math.PI * 2;
      while (rel > Math.PI) rel -= Math.PI * 2;
      if (dist < 1.45 && Math.abs(rel) < 0.55) {
        if (!best || dist < best.dist) best = { obj, dist };
      }
    }
    if (best) {
      state.nearby = best.obj;
      promptBox.textContent = `ACTで ${best.obj.label}`;
      promptBox.classList.remove('hidden');
    }
  }

  function interact() {
    if (state.ending) return;
    if (state.inDialogue) { advanceDialogue(); return; }
    if (state.nearby && typeof state.nearby.onInteract === 'function') {
      state.nearby.onInteract();
    }
  }

  function updateMovement(dt) {
    if (state.inDialogue || state.ending) return;
    let forward = 0;
    let strafe = 0;
    if (keys.w) forward += 1;
    if (keys.s) forward -= 1;
    if (keys.d) strafe += 1;
    if (keys.a) strafe -= 1;
    forward += -moveInput.y;
    strafe += moveInput.x;

    const len = Math.hypot(forward, strafe) || 1;
    forward /= len;
    strafe /= len;

    const speed = player.speed * dt;
    const nx = player.x + Math.cos(player.a) * forward * speed + Math.cos(player.a + Math.PI / 2) * strafe * speed;
    const ny = player.y + Math.sin(player.a) * forward * speed + Math.sin(player.a + Math.PI / 2) * strafe * speed;
    moveAndCollide(nx, ny);

    if (!isTouch) {
      player.a += lookInput.dx * 0.0024;
      lookInput.dx = 0;
    } else {
      player.a += lookInput.dx * 0.0029;
      lookInput.dx *= 0.74;
    }
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    updateMovement(dt);
    updateNearby();
    drawFrame(now);
    requestAnimationFrame(frame);
  }

  function bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (k === 'w') keys.w = true;
      if (k === 'a') keys.a = true;
      if (k === 's') keys.s = true;
      if (k === 'd') keys.d = true;
      if (k === 'e' || k === 'enter' || k === ' ') { e.preventDefault(); interact(); }
    });
    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      if (k === 'w') keys.w = false;
      if (k === 'a') keys.a = false;
      if (k === 's') keys.s = false;
      if (k === 'd') keys.d = false;
    });
    let dragging = false;
    canvas.addEventListener('pointerdown', (e) => {
      if (isTouch) return;
      dragging = true;
      lookInput.lastX = e.clientX;
    });
    window.addEventListener('pointerup', () => dragging = false);
    window.addEventListener('pointermove', (e) => {
      if (!dragging || isTouch) return;
      lookInput.dx = e.clientX - lookInput.lastX;
      lookInput.lastX = e.clientX;
    });
  }

  function bindMovePad() {
    const radius = 42;
    function update(clientX, clientY) {
      const rect = movePad.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = clientX - cx;
      let dy = clientY - cy;
      const dist = Math.hypot(dx, dy) || 1;
      const limited = Math.min(radius, dist);
      dx = dx / dist * limited;
      dy = dy / dist * limited;
      moveInput.x = dx / radius;
      moveInput.y = dy / radius;
      moveKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    }
    function reset() {
      moveInput.active = false;
      moveInput.pointerId = null;
      moveInput.x = 0;
      moveInput.y = 0;
      moveKnob.style.transform = 'translate(-50%, -50%)';
    }
    movePad.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      moveInput.active = true;
      moveInput.pointerId = e.pointerId;
      movePad.setPointerCapture(e.pointerId);
      update(e.clientX, e.clientY);
    });
    movePad.addEventListener('pointermove', (e) => {
      if (!moveInput.active || moveInput.pointerId !== e.pointerId) return;
      e.preventDefault();
      update(e.clientX, e.clientY);
    });
    movePad.addEventListener('pointerup', reset);
    movePad.addEventListener('pointercancel', reset);
    movePad.addEventListener('lostpointercapture', reset);
  }

  function bindLookDrag() {
    window.addEventListener('pointerdown', (e) => {
      if (!isTouch) return;
      if (e.target === movePad || movePad.contains(e.target) || e.target === actBtn) return;
      if (e.clientX < window.innerWidth * 0.45) return;
      lookInput.active = true;
      lookInput.pointerId = e.pointerId;
      lookInput.lastX = e.clientX;
    }, { passive: false });

    window.addEventListener('pointermove', (e) => {
      if (!isTouch || !lookInput.active || lookInput.pointerId !== e.pointerId) return;
      e.preventDefault();
      lookInput.dx += (e.clientX - lookInput.lastX);
      lookInput.lastX = e.clientX;
    }, { passive: false });

    function end(e) {
      if (!isTouch || !lookInput.active) return;
      if (lookInput.pointerId !== null && e.pointerId !== lookInput.pointerId) return;
      lookInput.active = false;
      lookInput.pointerId = null;
    }
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  }

  dialogueBox.addEventListener('pointerup', interact);
  actBtn.addEventListener('pointerup', interact);
  saveBtn.addEventListener('pointerup', saveGame);
  loadBtn.addEventListener('pointerup', loadGame);
  window.addEventListener('resize', resize);

  bindKeyboard();
  bindMovePad();
  bindLookDrag();
  resize();
  if (window.__YOINADO_CONTINUE__) {
    if (!loadGame()) startNew();
  } else {
    startNew();
  }
  setStatus('起動完了 / v11');
  requestAnimationFrame(frame);
})();
