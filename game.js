(function () {
  const canvas = document.getElementById('gameCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d', { alpha: false });
  const mapCanvas = document.getElementById('miniMap');
  const mapCtx = mapCanvas.getContext('2d', { alpha: false });

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

  const STORAGE_KEY = 'yoinado_v12_save';
  const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

  const OFF_W = 256;
  const OFF_H = 160;
  const off = document.createElement('canvas');
  off.width = OFF_W;
  off.height = OFF_H;
  const g = off.getContext('2d', { alpha: false });
  g.imageSmoothingEnabled = false;

  const FOV = Math.PI / 3.1;
  const MAX_DEPTH = 26;
  const AMBIENT_DAY = 1.0;
  const AMBIENT_NIGHT = 0.58;

  const map = [
    '#######################',
    '#.....................#',
    '#.....................#',
    '#....SSSSSSSSSSSSS....#',
    '#....S...........S....#',
    '#....S...........S....#',
    '#....S...........S....#',
    '#....S...........S....#',
    '#....S...........S....#',
    '#....SSSSSSSSSSSSS....#',
    '#.....................#',
    '#.....................#',
    '#.....................#',
    '#.....................#',
    '#######################'
  ];
  const MAP_W = map[0].length;
  const MAP_H = map.length;

  const player = { x: 2.4, y: 12.8, a: -0.05, radius: 0.18, speed: 2.15 };
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
  function setObjective(text) { state.objective = text; }

  function tileAt(x, y) {
    const mx = Math.floor(x), my = Math.floor(y);
    if (mx < 0 || my < 0 || mx >= MAP_W || my >= MAP_H) return '#';
    return map[my][mx];
  }

  function isSolidTile(tile) {
    return tile === '#' || tile === 'S';
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
      phase: state.phase,
      objective: state.objective,
    };
  }

  function saveGame() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(getSaveData()));
    setStatus('保存した / v12');
  }

  function loadGame() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) { setStatus('保存データなし'); return false; }
    try {
      const data = JSON.parse(raw);
      Object.assign(player, data.player || {});
      Object.assign(tasks, data.tasks || {});
      state.phase = data.phase || 'day';
      phaseLabel.textContent = state.phase === 'night' ? '深夜見回り' : '昼勤務';
      state.ending = false;
      state.inDialogue = false;
      dialogueBox.classList.add('hidden');
      endingScreen.classList.add('hidden');
      setObjective(data.objective || '続きから再開');
      setStatus('ロードした / v12');
      return true;
    } catch (e) {
      setStatus('ロード失敗');
      return false;
    }
  }

  function startNew() {
    player.x = 2.4;
    player.y = 12.8;
    player.a = -0.05;
    Object.keys(tasks).forEach(k => tasks[k] = false);
    state.phase = 'day';
    state.inDialogue = false;
    state.dialogueQueue = [];
    state.dialogueOnEnd = null;
    state.nearby = null;
    state.ending = false;
    phaseLabel.textContent = '昼勤務';
    endingScreen.classList.add('hidden');
    dialogueBox.classList.add('hidden');
    setObjective('女将に話しかける');
    setStatus('起動完了 / v12');
    showDialogue([
      ['記録', '見取り図つきで、昼の勤務が始まる。'],
      ['記録', '左下が帳場。右下が201号室。まずは女将に話しかけよう。']
    ]);
  }

  function makeTexture(kind) {
    const c = document.createElement('canvas');
    c.width = 32; c.height = 32;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    if (kind === 'wood') {
      x.fillStyle = '#4a3222'; x.fillRect(0, 0, 32, 32);
      for (let i = 0; i < 32; i += 8) {
        x.fillStyle = i % 16 === 0 ? '#6d4b31' : '#5a3d29';
        x.fillRect(i, 0, 6, 32);
      }
      x.fillStyle = 'rgba(30,18,10,0.5)';
      for (let i = 0; i < 32; i += 4) x.fillRect(i, 0, 1, 32);
    } else if (kind === 'shoji') {
      x.fillStyle = '#d5cab4'; x.fillRect(0, 0, 32, 32);
      x.fillStyle = '#7c6041';
      for (let i = 0; i < 32; i += 8) {
        x.fillRect(i, 0, 1, 32);
        x.fillRect(0, i, 32, 1);
      }
      x.fillStyle = 'rgba(255,234,180,0.10)';
      x.fillRect(0, 0, 32, 32);
    } else {
      x.fillStyle = '#1d1713'; x.fillRect(0, 0, 32, 32);
    }
    return x.getImageData(0, 0, 32, 32).data;
  }

  const textures = {
    wood: makeTexture('wood'),
    shoji: makeTexture('shoji'),
    dark: makeTexture('dark'),
  };

  function sampleTexture(tex, u, v, brightness) {
    const tx = (((u % 1) + 1) % 1 * 31) | 0;
    const ty = (((v % 1) + 1) % 1 * 31) | 0;
    const idx = (ty * 32 + tx) * 4;
    return [
      Math.min(255, tex[idx] * brightness),
      Math.min(255, tex[idx + 1] * brightness),
      Math.min(255, tex[idx + 2] * brightness),
    ];
  }

  function outlineRect(x, y, w, h, fill, stroke = '#111') {
    return { x, y, w, h, fill, stroke };
  }

  function drawShapes(ctx2, shapes) {
    for (const s of shapes) {
      ctx2.fillStyle = s.stroke;
      ctx2.fillRect(s.x - 1, s.y - 1, s.w + 2, s.h + 2);
      ctx2.fillStyle = s.fill;
      ctx2.fillRect(s.x, s.y, s.w, s.h);
    }
  }

  function makeSprite(kind) {
    const c = document.createElement('canvas');
    c.width = 72; c.height = 108;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.clearRect(0, 0, 72, 108);

    if (kind === 'okami') {
      drawShapes(x, [
        outlineRect(22, 8, 28, 18, '#14121c'),
        outlineRect(24, 18, 24, 18, '#f0e2cd'),
        outlineRect(18, 36, 36, 34, '#4e2c3c'),
        outlineRect(14, 42, 44, 16, '#b15f67'),
        outlineRect(28, 46, 16, 8, '#d8b66e'),
        outlineRect(14, 40, 8, 18, '#f0e2cd'),
        outlineRect(50, 40, 8, 18, '#f0e2cd'),
        outlineRect(22, 70, 10, 18, '#2c2230'),
        outlineRect(40, 70, 10, 18, '#2c2230'),
      ]);
    } else if (kind === 'guest') {
      drawShapes(x, [
        outlineRect(20, 14, 32, 18, '#2a2330'),
        outlineRect(24, 22, 24, 18, '#f0e2cd'),
        outlineRect(18, 40, 36, 28, '#6856a9'),
        outlineRect(12, 44, 10, 18, '#f0e2cd'),
        outlineRect(50, 44, 10, 18, '#f0e2cd'),
        outlineRect(22, 68, 12, 18, '#513e87'),
        outlineRect(38, 68, 12, 18, '#513e87'),
        outlineRect(18, 28, 36, 6, '#111'),
      ]);
    } else if (kind === 'flagman') {
      drawShapes(x, [
        outlineRect(18, 8, 36, 14, '#ffffff'),
        outlineRect(24, 20, 24, 8, '#dbdbdb'),
        outlineRect(26, 28, 20, 18, '#f3dfc7'),
        outlineRect(18, 46, 36, 26, '#214e9d'),
        outlineRect(10, 48, 10, 22, '#1b2f5d'),
        outlineRect(52, 48, 10, 22, '#1b2f5d'),
        outlineRect(49, 50, 13, 8, '#79d6b5'),
        outlineRect(18, 72, 12, 20, '#12223f'),
        outlineRect(42, 72, 12, 20, '#12223f'),
        outlineRect(4, 44, 18, 10, '#f4f4f4'),
        outlineRect(50, 40, 18, 14, '#c83f3f'),
        outlineRect(20, 40, 2, 26, '#7a5b41'),
        outlineRect(50, 38, 2, 28, '#7a5b41'),
      ]);
    } else if (kind === 'key') {
      drawShapes(x, [
        outlineRect(20, 40, 14, 14, '#e7d59e'),
        outlineRect(28, 44, 22, 6, '#d1b560'),
        outlineRect(44, 40, 6, 18, '#c6a550'),
      ]);
      x.clearRect(24, 44, 6, 6);
    } else if (kind === 'phone') {
      drawShapes(x, [
        outlineRect(18, 46, 36, 14, '#1d1d1f'),
        outlineRect(24, 36, 24, 10, '#2e2e31'),
        outlineRect(26, 28, 20, 8, '#d6d6d8'),
      ]);
    } else if (kind === 'ledger') {
      drawShapes(x, [
        outlineRect(20, 28, 32, 42, '#ece3d3'),
        outlineRect(20, 28, 8, 42, '#a33d3d'),
      ]);
      x.fillStyle = '#7f6a52';
      x.fillRect(30, 38, 16, 2);
      x.fillRect(30, 46, 16, 2);
      x.fillRect(30, 54, 12, 2);
    } else if (kind === 'lantern') {
      drawShapes(x, [
        outlineRect(26, 8, 4, 10, '#7a5d38'),
        outlineRect(16, 18, 40, 36, '#f3c86d'),
        outlineRect(14, 16, 44, 4, '#9b452c'),
        outlineRect(14, 54, 44, 4, '#9b452c'),
      ]);
      x.fillStyle = 'rgba(255,240,190,0.9)';
      x.fillRect(28, 26, 16, 14);
    } else if (kind === 'sign201') {
      drawShapes(x, [outlineRect(12, 24, 48, 30, '#d8ccb6'), outlineRect(34, 54, 4, 26, '#6c5137')]);
      x.fillStyle = '#2b231c'; x.font = 'bold 18px sans-serif'; x.textAlign = 'center'; x.fillText('201', 36, 45);
    } else if (kind === 'signFront') {
      drawShapes(x, [outlineRect(10, 24, 52, 30, '#d8ccb6'), outlineRect(34, 54, 4, 26, '#6c5137')]);
      x.fillStyle = '#2b231c'; x.font = 'bold 16px sans-serif'; x.textAlign = 'center'; x.fillText('帳場', 36, 45);
    } else if (kind === 'signNorth') {
      drawShapes(x, [outlineRect(12, 24, 48, 30, '#d8ccb6'), outlineRect(34, 54, 4, 26, '#6c5137')]);
      x.fillStyle = '#2b231c'; x.font = 'bold 15px sans-serif'; x.textAlign = 'center'; x.fillText('北廊下', 36, 44);
    }
    return c;
  }

  const spriteSheets = {
    okami: makeSprite('okami'),
    guest: makeSprite('guest'),
    flagman: makeSprite('flagman'),
    key: makeSprite('key'),
    phone: makeSprite('phone'),
    ledger: makeSprite('ledger'),
    lantern: makeSprite('lantern'),
    sign201: makeSprite('sign201'),
    signFront: makeSprite('signFront'),
    signNorth: makeSprite('signNorth'),
  };

  function currentObjectiveTargetId() {
    if (!tasks.talkedToOkami) return 'okami';
    if (!tasks.gotKey) return 'key';
    if (!tasks.deliveredKey) return 'guest';
    if (!tasks.answeredPhone) return 'phone';
    if (!tasks.startedNight) return 'nightDoor';
    if (!tasks.checkedRoom) return 'roomCheck';
    if (!tasks.foundLedger) return 'ledger';
    if (!tasks.sawFlagman) return 'flagman';
    return null;
  }

  const interactives = [
    {
      id: 'okami', x: 3.2, y: 12.3, r: 0.8, label: '女将', sprite: 'okami', phase: 'day',
      visible: () => true,
      onInteract() {
        if (!tasks.talkedToOkami) {
          tasks.talkedToOkami = true;
          setObjective('鍵掛けから201号室の鍵を取る');
          showDialogue([
            ['女将', 'ようこそ。今日は客が少ないから、まずは201の鍵を持っていって。'],
            ['女将', '見取り図の右下にいる客だよ。迷ったら右上の案内図を見な。']
          ]);
        } else {
          showDialogue([['女将', tasks.startedNight ? '北廊下の先だけ、やけに長く感じるはずだよ。' : '201の鍵を先に持っていって。']]);
        }
      }
    },
    {
      id: 'key', x: 5.2, y: 12.45, r: 0.52, label: '201の鍵', sprite: 'key', phase: 'day',
      visible: () => tasks.talkedToOkami && !tasks.gotKey,
      onInteract() {
        tasks.gotKey = true;
        setObjective('右下の201号室の客に鍵を渡す');
        showDialogue([['記録', '真鍮の鍵を取った。帳場の空気だけが少し冷たい。']]);
      }
    },
    {
      id: 'guest', x: 18.8, y: 12.2, r: 0.86, label: '201号室の客', sprite: 'guest', phase: 'day',
      visible: () => tasks.gotKey && !tasks.deliveredKey,
      onInteract() {
        tasks.deliveredKey = true;
        setObjective('帳場へ戻って電話に出る');
        showDialogue([
          ['宿泊客', '……ありがとうございます。'],
          ['宿泊客', 'この旅館、夜になると北の廊下だけ音が遅れて届きます。']
        ]);
      }
    },
    {
      id: 'phone', x: 7.4, y: 12.45, r: 0.55, label: '帳場の電話', sprite: 'phone', phase: 'day',
      visible: () => tasks.deliveredKey && !tasks.answeredPhone,
      onInteract() {
        tasks.answeredPhone = true;
        setObjective('北廊下の札を調べて夜の見回りに入る');
        showDialogue([
          ['内線', '……見回りを始めて。北廊下の札をめくって。'],
          ['内線', '白い旗が見えたら、目を逸らさないで。']
        ]);
      }
    },
    {
      id: 'nightDoor', x: 11.5, y: 2.2, r: 0.72, label: '北廊下の札', sprite: 'signNorth', phase: 'day',
      visible: () => tasks.answeredPhone && !tasks.startedNight,
      onInteract() {
        tasks.startedNight = true;
        state.phase = 'night';
        phaseLabel.textContent = '深夜見回り';
        player.x = 11.5; player.y = 2.8; player.a = Math.PI / 2;
        setObjective('201号室の前を見回る');
        showDialogue([
          ['記録', '提灯の灯りが一段落ちた。旅館の広さだけが静かに伸びる。'],
          ['女将', '201の前を見たら、帳場ノートを取りに戻るんだよ。']
        ]);
      }
    },
    {
      id: 'roomCheck', x: 18.8, y: 12.2, r: 0.82, label: '201号室の前', sprite: 'sign201', phase: 'night',
      visible: () => tasks.startedNight && !tasks.checkedRoom,
      onInteract() {
        tasks.checkedRoom = true;
        setObjective('帳場ノートを取りに戻る');
        showDialogue([
          ['記録', '201号室の前には誰もいない。'],
          ['記録', '障子の向こうに、人が立った形だけが遅れて残っていた。']
        ]);
      }
    },
    {
      id: 'ledger', x: 4.4, y: 12.15, r: 0.62, label: '帳場ノート', sprite: 'ledger', phase: 'night',
      visible: () => tasks.checkedRoom && !tasks.foundLedger,
      onInteract() {
        tasks.foundLedger = true;
        setObjective('北廊下の奥を確認する');
        showDialogue([
          ['帳場ノート', '「白旗は進め、赤旗は戻れ」'],
          ['帳場ノート', '「だが宵宿では、その二つは同じ意味になる」']
        ]);
      }
    },
    {
      id: 'flagman', x: 11.5, y: 1.55, r: 0.95, label: '旗を振る誘導員', sprite: 'flagman', phase: 'night',
      visible: () => tasks.foundLedger && !tasks.sawFlagman,
      onInteract() {
        tasks.sawFlagman = true;
        showDialogue([
          ['誘導員', '白旗でも、赤旗でも、今夜は同じだ。'],
          ['誘導員', '戻ったつもりでも、お前はずっと旅館の内側にいる。']
        ], () => {
          endGame('赤旗の廊下', '出口へ戻ったはずなのに、帳場の灯りは遠ざかるばかりだった。宵宿の見回りは、朝まで終わらない。');
        });
      }
    }
  ];

  const decor = [
    { id: 'frontSign', x: 2.5, y: 11.3, r: 0.7, sprite: 'signFront', label: '帳場', phase: 'any' },
    { id: 'roomSign', x: 18.9, y: 11.2, r: 0.74, sprite: 'sign201', label: '201号室', phase: 'any' },
    { id: 'northSign', x: 11.5, y: 3.0, r: 0.65, sprite: 'signNorth', label: '北廊下', phase: 'any' },
    { id: 'lan1', x: 6.0, y: 10.8, r: 0.74, sprite: 'lantern', label: '', phase: 'any' },
    { id: 'lan2', x: 17.2, y: 10.8, r: 0.74, sprite: 'lantern', label: '', phase: 'any' },
    { id: 'lan3', x: 6.1, y: 2.2, r: 0.74, sprite: 'lantern', label: '', phase: 'any' },
    { id: 'lan4', x: 17.0, y: 2.2, r: 0.74, sprite: 'lantern', label: '', phase: 'any' },
  ];

  function getActiveTarget() {
    const targetId = currentObjectiveTargetId();
    return interactives.find(obj => obj.id === targetId && obj.visible() && (obj.phase === state.phase || obj.phase === 'any')) || null;
  }

  function directionText(angle) {
    if (Math.abs(angle) < 0.35) return '前方';
    if (angle > 0.35 && angle < 1.2) return '前方右';
    if (angle < -0.35 && angle > -1.2) return '前方左';
    if (angle >= 1.2) return '右奥';
    return '左奥';
  }

  function updateObjectiveDisplay() {
    const target = getActiveTarget();
    if (!target) {
      objectiveBox.textContent = state.objective;
      return;
    }
    let rel = Math.atan2(target.y - player.y, target.x - player.x) - player.a;
    while (rel < -Math.PI) rel += Math.PI * 2;
    while (rel > Math.PI) rel -= Math.PI * 2;
    const dist = Math.hypot(target.x - player.x, target.y - player.y);
    objectiveBox.textContent = `目標: ${state.objective} / ${directionText(rel)} / 約${dist.toFixed(1)}m`;
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
    while (depth < MAX_DEPTH) {
      depth += 0.01;
      const x = player.x + cos * depth;
      const y = player.y + sin * depth;
      const tile = tileAt(x, y);
      if (isSolidTile(tile)) {
        const fx = x - Math.floor(x);
        const fy = y - Math.floor(y);
        const side = (fx < 0.03 || fx > 0.97) ? 0 : 1;
        const edge = (fx < 0.03 || fx > 0.97 || fy < 0.03 || fy > 0.97);
        const u = side === 0 ? fy : fx;
        const tex = tile === 'S' ? textures.shoji : textures.wood;
        return { depth, side, edge, tex, u };
      }
    }
    return { depth: MAX_DEPTH, side: 0, edge: false, tex: textures.dark, u: 0 };
  }

  const depthBuffer = new Float32Array(OFF_W);

  function floorShade(wx, wy, t) {
    const inLobby = wy > 10.5;
    const inNorth = wy < 3.4;
    const ring = (wx > 3.6 && wx < 19.4 && wy > 2.6 && wy < 10.4);

    if (inLobby) {
      const tatami = ((Math.floor(wx * 1.1) + Math.floor(wy * 1.2)) & 1) ? 1 : 0;
      return tatami ? [125 - t * 22, 116 - t * 18, 90 - t * 14] : [113 - t * 22, 104 - t * 16, 80 - t * 14];
    }
    if (inNorth) {
      const carpet = Math.abs(wx - 11.5) < 1.2;
      return carpet ? [96 - t * 18, 35 - t * 12, 34 - t * 8] : [78 - t * 20, 58 - t * 14, 42 - t * 12];
    }
    if (ring) {
      const verticalRunner = (Math.abs(wx - 4.5) < 0.5) || (Math.abs(wx - 18.5) < 0.5);
      const horizontalRunner = (Math.abs(wy - 2.5) < 0.5) || (Math.abs(wy - 10.5) < 0.5);
      const runner = verticalRunner || horizontalRunner;
      return runner ? [112 - t * 24, 34 - t * 12, 32 - t * 10] : [86 - t * 20, 61 - t * 14, 42 - t * 10];
    }
    return [66 - t * 18, 50 - t * 10, 36 - t * 8];
  }

  function drawBackground(now) {
    const horizon = OFF_H * 0.44;
    const sky = g.createLinearGradient(0, 0, 0, horizon);
    if (state.phase === 'night') {
      sky.addColorStop(0, '#070910');
      sky.addColorStop(1, '#17131a');
    } else {
      sky.addColorStop(0, '#201712');
      sky.addColorStop(1, '#513928');
    }
    g.fillStyle = sky;
    g.fillRect(0, 0, OFF_W, horizon);

    g.fillStyle = state.phase === 'night' ? '#1d140f' : '#6f533d';
    g.fillRect(0, horizon, OFF_W, OFF_H - horizon);

    for (let y = horizon; y < OFF_H; y++) {
      const t = (y - horizon) / (OFF_H - horizon);
      const rowDist = 0.7 + t * 9.0;
      const worldLeftX = player.x + Math.cos(player.a - FOV / 2) * rowDist;
      const worldLeftY = player.y + Math.sin(player.a - FOV / 2) * rowDist;
      const worldRightX = player.x + Math.cos(player.a + FOV / 2) * rowDist;
      const worldRightY = player.y + Math.sin(player.a + FOV / 2) * rowDist;
      for (let x = 0; x < OFF_W; x += 2) {
        const u = x / OFF_W;
        const wx = worldLeftX + (worldRightX - worldLeftX) * u;
        const wy = worldLeftY + (worldRightY - worldLeftY) * u;
        const [r, gg, b] = floorShade(wx, wy, t);
        g.fillStyle = `rgb(${Math.max(0,r)|0},${Math.max(0,gg)|0},${Math.max(0,b)|0})`;
        g.fillRect(x, y, 2, 1);
      }
    }

    const lights = [0.18, 0.5, 0.82];
    for (const lc of lights) {
      const r = state.phase === 'night' ? 18 : 24;
      const px = OFF_W * lc;
      const py = horizon - 4;
      const grad = g.createRadialGradient(px, py, 0, px, py, r);
      grad.addColorStop(0, state.phase === 'night' ? 'rgba(255,210,120,0.15)' : 'rgba(255,230,180,0.22)');
      grad.addColorStop(1, 'rgba(255,212,130,0)');
      g.fillStyle = grad;
      g.fillRect(px - r, py - r, r * 2, r * 2);
    }

    g.fillStyle = 'rgba(0,0,0,0.14)';
    g.fillRect(0, horizon - 1, OFF_W, 2);
  }

  function drawWalls() {
    const ambient = state.phase === 'night' ? AMBIENT_NIGHT + state.flicker : AMBIENT_DAY;
    for (let x = 0; x < OFF_W; x++) {
      const rayAngle = player.a - FOV / 2 + (x / OFF_W) * FOV;
      const hit = castRay(rayAngle);
      const corrected = hit.depth * Math.cos(rayAngle - player.a);
      depthBuffer[x] = corrected;
      const wallH = Math.min(OFF_H * 1.15, (OFF_H * 0.84) / Math.max(corrected, 0.0001));
      const top = ((OFF_H - wallH) / 2) | 0;
      const brightness = Math.max(0.20, (state.phase === 'night' ? 1.14 : 1.36) - corrected * 0.075 - hit.side * 0.11) * ambient;
      for (let y = 0; y < wallH; y++) {
        const v = y / wallH;
        const color = sampleTexture(hit.tex, hit.u, v, brightness);
        if (hit.edge) {
          color[0] *= 0.7; color[1] *= 0.7; color[2] *= 0.7;
        }
        g.fillStyle = `rgb(${color[0]|0},${color[1]|0},${color[2]|0})`;
        g.fillRect(x, top + y, 1, 1);
      }
    }
  }

  function renderSpriteEntity(obj) {
    const dx = obj.x - player.x;
    const dy = obj.y - player.y;
    const dist = Math.hypot(dx, dy);
    const angleTo = Math.atan2(dy, dx) - player.a;
    let rel = angleTo;
    while (rel < -Math.PI) rel += Math.PI * 2;
    while (rel > Math.PI) rel -= Math.PI * 2;
    if (Math.abs(rel) > FOV * 0.70 || dist < 0.15) return;

    const sheet = spriteSheets[obj.sprite];
    if (!sheet) return;
    const screenX = (0.5 + rel / FOV) * OFF_W;
    const size = Math.max(12, (OFF_H * obj.r * 2.85) / dist);
    const drawW = size;
    const drawH = size * (sheet.height / sheet.width);
    const top = OFF_H * 0.58 - drawH * 0.5;
    const left = screenX - drawW / 2;
    const isTarget = obj.id && obj.id === currentObjectiveTargetId();

    if (isTarget) {
      const haloR = drawW * 0.66;
      const halo = g.createRadialGradient(screenX, top + drawH * 0.42, 0, screenX, top + drawH * 0.42, haloR);
      halo.addColorStop(0, 'rgba(255,220,140,0.42)');
      halo.addColorStop(1, 'rgba(255,220,140,0)');
      g.fillStyle = halo;
      g.fillRect(screenX - haloR, top + drawH * 0.42 - haloR, haloR * 2, haloR * 2);
    }

    for (let sx = 0; sx < drawW; sx++) {
      const px = (left + sx) | 0;
      if (px < 0 || px >= OFF_W) continue;
      if (depthBuffer[px] < dist - 0.10) continue;
      const srcX = (sx / drawW) * sheet.width;
      g.drawImage(sheet, srcX, 0, 1, sheet.height, px, top, 1, drawH);
    }

    if ((dist < 3.6 || isTarget) && obj.label) {
      const label = obj.label;
      g.font = 'bold 8px sans-serif';
      const tw = g.measureText(label).width + 10;
      const tx = Math.max(3, Math.min(OFF_W - tw - 3, screenX - tw / 2));
      const ty = Math.max(4, top - 12);
      g.fillStyle = 'rgba(4,6,10,0.88)';
      g.fillRect(tx, ty, tw, 10);
      g.strokeStyle = isTarget ? '#f0c779' : 'rgba(255,255,255,0.16)';
      g.strokeRect(tx + 0.5, ty + 0.5, tw - 1, 9);
      g.fillStyle = isTarget ? '#f0c779' : '#f4eee3';
      g.fillText(label, tx + 5, ty + 7.7);
    }
  }

  function drawSprites() {
    const list = [];
    for (const obj of decor) if (obj.phase === 'any' || obj.phase === state.phase) list.push(obj);
    for (const obj of interactives) {
      if ((obj.phase === state.phase || obj.phase === 'any') && obj.visible()) list.push(obj);
    }
    list.sort((a, b) => Math.hypot(b.x - player.x, b.y - player.y) - Math.hypot(a.x - player.x, a.y - player.y));
    list.forEach(renderSpriteEntity);
  }

  function drawOverlays(now) {
    state.pulse += 0.016;
    const vignette = g.createRadialGradient(OFF_W * 0.5, OFF_H * 0.5, OFF_H * 0.12, OFF_W * 0.5, OFF_H * 0.5, OFF_H * 0.8);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, state.phase === 'night' ? 'rgba(0,0,0,0.48)' : 'rgba(0,0,0,0.28)');
    g.fillStyle = vignette;
    g.fillRect(0, 0, OFF_W, OFF_H);

    g.globalAlpha = state.phase === 'night' ? 0.12 : 0.07;
    for (let i = 0; i < 36; i++) {
      g.fillStyle = i % 2 ? '#ffffff' : '#9b6b40';
      g.fillRect(Math.random() * OFF_W, Math.random() * OFF_H, 1, 1);
    }
    g.globalAlpha = 1;

    g.fillStyle = 'rgba(255,255,255,0.03)';
    for (let y = 0; y < OFF_H; y += 3) g.fillRect(0, y, OFF_W, 1);
  }

  function drawFrame(now) {
    state.flicker = state.phase === 'night' ? Math.sin(now * 0.004) * 0.05 + Math.cos(now * 0.002) * 0.018 : 0;
    drawBackground(now);
    drawWalls();
    drawSprites();
    drawOverlays(now);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
  }

  function drawMiniMap() {
    const w = mapCanvas.width;
    const h = mapCanvas.height;
    mapCtx.fillStyle = '#0b0d12';
    mapCtx.fillRect(0, 0, w, h);
    const cell = Math.min(w / MAP_W, h / MAP_H);
    const ox = (w - MAP_W * cell) / 2;
    const oy = (h - MAP_H * cell) / 2;

    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const tile = map[y][x];
        if (tile === '#') mapCtx.fillStyle = '#5d3d2a';
        else if (tile === 'S') mapCtx.fillStyle = '#b9a88d';
        else mapCtx.fillStyle = '#1b1d24';
        mapCtx.fillRect(ox + x * cell, oy + y * cell, cell - 0.5, cell - 0.5);
      }
    }

    for (const obj of decor) {
      mapCtx.fillStyle = obj.id === 'roomSign' ? '#9f78dd' : '#d9b56c';
      mapCtx.fillRect(ox + obj.x * cell - 1, oy + obj.y * cell - 1, 3, 3);
    }

    for (const obj of interactives) {
      if (!(obj.phase === state.phase || obj.phase === 'any') || !obj.visible()) continue;
      mapCtx.fillStyle = obj.id === currentObjectiveTargetId() ? '#f1cf7a' : '#72b2e9';
      mapCtx.beginPath();
      mapCtx.arc(ox + obj.x * cell, oy + obj.y * cell, obj.id === currentObjectiveTargetId() ? 3.1 : 2.2, 0, Math.PI * 2);
      mapCtx.fill();
    }

    const px = ox + player.x * cell;
    const py = oy + player.y * cell;
    mapCtx.fillStyle = '#ffffff';
    mapCtx.beginPath();
    mapCtx.arc(px, py, 3.2, 0, Math.PI * 2);
    mapCtx.fill();
    mapCtx.strokeStyle = '#ffffff';
    mapCtx.beginPath();
    mapCtx.moveTo(px, py);
    mapCtx.lineTo(px + Math.cos(player.a) * 8, py + Math.sin(player.a) * 8);
    mapCtx.stroke();
  }

  function updateNearby() {
    state.nearby = null;
    promptBox.classList.add('hidden');
    let best = null;
    for (const obj of interactives) {
      if (!(obj.phase === state.phase || obj.phase === 'any') || !obj.visible()) continue;
      const dx = obj.x - player.x;
      const dy = obj.y - player.y;
      const dist = Math.hypot(dx, dy);
      let rel = Math.atan2(dy, dx) - player.a;
      while (rel < -Math.PI) rel += Math.PI * 2;
      while (rel > Math.PI) rel -= Math.PI * 2;
      if (dist < 1.8 && Math.abs(rel) < 0.85) {
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
      player.a += lookInput.dx * 0.0028;
      lookInput.dx *= 0.72;
    }
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    updateMovement(dt);
    updateNearby();
    updateObjectiveDisplay();
    drawFrame(now);
    drawMiniMap();
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
  requestAnimationFrame(frame);
})();
