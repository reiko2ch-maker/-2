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

  const STORAGE_KEY = 'yoinado_v10_save';
  const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

  const map = [
    '###############',
    '#.............#',
    '#.####.###.##.#',
    '#.#..#...#....#',
    '#.#..###.#.##.#',
    '#.#........##.#',
    '#.###.##.###..#',
    '#.....##......#',
    '#.###....###..#',
    '#.#...##...#..#',
    '#.#.####.#.#..#',
    '#...#....#....#',
    '#.###.##.###..#',
    '#.............#',
    '###############'
  ];
  const MAP_W = map[0].length;
  const MAP_H = map.length;
  const TILE = 1;
  const FOV = Math.PI / 3;
  const MAX_DEPTH = 18;

  const player = { x: 2.2, y: 2.2, a: 0, radius: 0.16, speed: 2.2, turnSpeed: 2.6 };
  const keys = { w: false, a: false, s: false, d: false };
  const moveInput = { active: false, x: 0, y: 0, pointerId: null };
  const lookInput = { active: false, lastX: 0, lastY: 0, pointerId: null, dx: 0, dy: 0 };

  const state = {
    phase: 'day',
    objective: '女将に話しかける',
    inDialogue: false,
    dialogueQueue: [],
    dialogueOnEnd: null,
    nearby: null,
    canEnd: false,
    ending: false,
  };

  const tasks = {
    talkedToOkami: false,
    gotKey: false,
    deliveredKey: false,
    answeredPhone: false,
    rangBell: false,
    checked201: false,
    foundLedger: false,
    sawFlagman: false,
  };

  const interactives = [
    {
      id: 'okami', x: 3.5, y: 2.6, r: 0.42, color: '#9d2f2f', label: '女将', phase: 'day', visible: () => true,
      onInteract() {
        if (!tasks.talkedToOkami) {
          tasks.talkedToOkami = true;
          setObjective('受付の鍵を取る');
          showDialogue([
            ['女将', '今日から住み込みだよ。まずは受付の鍵を持っていきな。'],
            ['女将', '201のお客さんを案内したら、内線が鳴るはずだ。']
          ]);
        } else {
          showDialogue([['女将', tasks.rangBell ? '昼の仕事は終わったよ。夜は見回りだ。' : '鍵を取って、201のお客さんを案内しな。']]);
        }
      }
    },
    {
      id: 'key', x: 2.6, y: 3.2, r: 0.24, color: '#cbb76c', label: '受付の鍵', phase: 'day',
      visible: () => !tasks.gotKey,
      onInteract() {
        tasks.gotKey = true;
        setObjective('201号室の客に鍵を渡す');
        showDialogue([['記録', '受付の鍵を取った。201号室へ向かう。']]);
      }
    },
    {
      id: 'guest', x: 10.4, y: 3.8, r: 0.42, color: '#36668a', label: '宿泊客', phase: 'day',
      visible: () => tasks.gotKey && !tasks.deliveredKey,
      onInteract() {
        tasks.deliveredKey = true;
        setObjective('受付に戻り、鳴った内線に出る');
        showDialogue([
          ['宿泊客', '……鍵、ありがとう。'],
          ['宿泊客', '二階の突き当たりは、見ない方がいい。']
        ]);
      }
    },
    {
      id: 'phone', x: 2.35, y: 10.4, r: 0.28, color: '#d9d9d9', label: '内線電話', phase: 'day',
      visible: () => tasks.deliveredKey && !tasks.answeredPhone,
      onInteract() {
        tasks.answeredPhone = true;
        setObjective('帳場のベルを鳴らして昼勤務を終える');
        showDialogue([
          ['内線', '……本当に来たんだ。'],
          ['内線', '夜になったら、帳場ノートを探して。']
        ]);
      }
    },
    {
      id: 'bell', x: 2.9, y: 10.1, r: 0.24, color: '#b47c35', label: '帳場のベル', phase: 'day',
      visible: () => tasks.answeredPhone && !tasks.rangBell,
      onInteract() {
        tasks.rangBell = true;
        state.phase = 'night';
        phaseLabel.textContent = '深夜見回り';
        setObjective('201号室を見回る');
        showDialogue([
          ['記録', '昼の勤務が終わった。旅館は妙に静かだ。'],
          ['女将', '夜は201から見回ること。……ただし、奥だけは見るな。']
        ]);
      }
    },
    {
      id: 'room201', x: 10.1, y: 10.2, r: 0.34, color: '#8e9176', label: '201号室', phase: 'night',
      visible: () => !tasks.checked201,
      onInteract() {
        tasks.checked201 = true;
        setObjective('帳場ノートを探す');
        showDialogue([
          ['記録', '201号室は空だった。布団だけが温かい。'],
          ['記録', '視線の気配がして、背中だけ冷えた。']
        ]);
      }
    },
    {
      id: 'ledger', x: 3.2, y: 10.8, r: 0.28, color: '#ffffff', label: '帳場ノート', phase: 'night',
      visible: () => tasks.checked201 && !tasks.foundLedger,
      onInteract() {
        tasks.foundLedger = true;
        setObjective('二階の突き当たりを確認する');
        showDialogue([
          ['帳場ノート', 'ページの最後に、赤い文字でこう書かれている。'],
          ['帳場ノート', '「旗を振る者を見たら、目を逸らしてはならない」']
        ]);
      }
    },
    {
      id: 'flagman', x: 12.4, y: 12.2, r: 0.5, color: '#2d58b7', label: '誘導員', phase: 'night',
      visible: () => tasks.foundLedger && !tasks.sawFlagman,
      onInteract() {
        tasks.sawFlagman = true;
        state.canEnd = true;
        setObjective('出口へ戻る');
        showDialogue([
          ['誘導員', '白旗なら進め。赤旗なら戻れ。'],
          ['誘導員', 'だが今夜は、どちらも同じだ。']
        ], () => {
          endGame('取り込まれる夜', '出口へ戻ったはずなのに、旅館の廊下は朝まで続いていた。');
        });
      }
    }
  ];

  function setStatus(text) { statusBox.textContent = text; }
  function setObjective(text) { state.objective = text; objectiveBox.textContent = text; }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(320, window.innerWidth);
    const h = Math.max(480, window.innerHeight);
    canvas.width = Math.floor(w * dpr * 0.8);
    canvas.height = Math.floor(h * dpr * 0.8);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.imageSmoothingEnabled = false;
  }

  function isWall(x, y) {
    const mx = Math.floor(x), my = Math.floor(y);
    if (mx < 0 || my < 0 || mx >= MAP_W || my >= MAP_H) return true;
    return map[my][mx] === '#';
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
      phaseLabel.textContent = state.phase === 'night' ? '深夜見回り' : '昼勤務';
      setObjective(data.objective || '続きから再開');
      setStatus('ロードした');
      return true;
    } catch (e) {
      setStatus('ロード失敗');
      return false;
    }
  }

  function startNew() {
    player.x = 2.2; player.y = 2.2; player.a = 0;
    Object.keys(tasks).forEach(k => tasks[k] = false);
    state.phase = 'day';
    state.inDialogue = false;
    state.dialogueQueue = [];
    state.dialogueOnEnd = null;
    state.nearby = null;
    state.canEnd = false;
    state.ending = false;
    phaseLabel.textContent = '昼勤務';
    endingScreen.classList.add('hidden');
    dialogueBox.classList.add('hidden');
    setObjective('女将に話しかける');
    setStatus('起動完了');
    showDialogue([
      ['記録', '山奥の古い旅館で住み込み勤務を始めた。'],
      ['記録', 'まずは女将に話しかけよう。']
    ]);
  }

  function castRay(angle) {
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    let depth = 0;
    while (depth < MAX_DEPTH) {
      depth += 0.02;
      const x = player.x + cos * depth;
      const y = player.y + sin * depth;
      if (isWall(x, y)) {
        const hitX = x - Math.floor(x);
        const hitY = y - Math.floor(y);
        const edge = (hitX < 0.05 || hitX > 0.95 || hitY < 0.05 || hitY > 0.95);
        return { depth, edge };
      }
    }
    return { depth: MAX_DEPTH, edge: false };
  }

  function drawBackground() {
    const w = canvas.width, h = canvas.height;
    const gradTop = ctx.createLinearGradient(0, 0, 0, h * 0.5);
    gradTop.addColorStop(0, state.phase === 'night' ? '#06080d' : '#1d1916');
    gradTop.addColorStop(1, state.phase === 'night' ? '#0d1018' : '#352a1f');
    ctx.fillStyle = gradTop;
    ctx.fillRect(0, 0, w, h * 0.52);

    const gradBottom = ctx.createLinearGradient(0, h * 0.52, 0, h);
    gradBottom.addColorStop(0, state.phase === 'night' ? '#2a241c' : '#6d583f');
    gradBottom.addColorStop(1, state.phase === 'night' ? '#0a0907' : '#3f3021');
    ctx.fillStyle = gradBottom;
    ctx.fillRect(0, h * 0.52, w, h * 0.48);
  }

  function drawWalls() {
    const w = canvas.width, h = canvas.height;
    for (let x = 0; x < w; x += 2) {
      const rayAngle = player.a - FOV / 2 + (x / w) * FOV;
      const hit = castRay(rayAngle);
      const corrected = hit.depth * Math.cos(rayAngle - player.a);
      const wallH = Math.min(h, (h * 0.92) / Math.max(corrected, 0.0001));
      const y = (h - wallH) / 2;
      const shade = Math.max(20, 190 - corrected * (state.phase === 'night' ? 18 : 13));
      const c = hit.edge ? shade - 28 : shade;
      ctx.fillStyle = `rgb(${c},${Math.max(18,c-18)},${Math.max(10,c-30)})`;
      ctx.fillRect(x, y, 2, wallH);
    }
  }

  function renderSprite(obj) {
    if (obj.phase !== state.phase || !obj.visible()) return null;
    const dx = obj.x - player.x;
    const dy = obj.y - player.y;
    const dist = Math.hypot(dx, dy);
    const angleTo = Math.atan2(dy, dx) - player.a;
    let rel = angleTo;
    while (rel < -Math.PI) rel += Math.PI * 2;
    while (rel > Math.PI) rel -= Math.PI * 2;
    if (Math.abs(rel) > FOV * 0.7 || dist < 0.08) return { dist, visible: false };

    const w = canvas.width, h = canvas.height;
    const screenX = (0.5 + rel / FOV) * w;
    const size = Math.max(22, (h * obj.r * 1.6) / dist);
    const baseY = h * 0.62;

    const rayAngle = player.a + rel;
    const hit = castRay(rayAngle);
    if (hit.depth < dist) return { dist, visible: false };

    ctx.fillStyle = obj.color;
    ctx.fillRect(screenX - size / 2, baseY - size, size, size);
    ctx.fillStyle = '#f6eee4';
    ctx.font = `${Math.max(10, size * 0.18)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(obj.label, screenX, baseY - size - 8);
    return { dist, visible: true, rel };
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
      if (dist < 1.2 && Math.abs(rel) < 0.7) {
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
    forward /= len; strafe /= len;

    const speed = player.speed * dt;
    const nx = player.x + Math.cos(player.a) * forward * speed + Math.cos(player.a + Math.PI / 2) * strafe * speed;
    const ny = player.y + Math.sin(player.a) * forward * speed + Math.sin(player.a + Math.PI / 2) * strafe * speed;
    moveAndCollide(nx, ny);

    if (!isTouch) {
      player.a += lookInput.dx * 0.0022;
      lookInput.dx = 0;
    } else {
      player.a += lookInput.dx * 0.0026;
      lookInput.dx *= 0.78;
    }
  }

  function drawMiniNoise() {
    const w = canvas.width, h = canvas.height;
    ctx.globalAlpha = 0.08;
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = i % 2 ? '#ffffff' : '#8d7853';
      ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    updateMovement(dt);
    drawBackground();
    drawWalls();
    interactives
      .map(renderSprite)
      .sort((a, b) => (b?.dist || 0) - (a?.dist || 0));
    drawMiniNoise();
    updateNearby();
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
      lookInput.lastY = e.clientY;
    }, { passive: false });

    window.addEventListener('pointermove', (e) => {
      if (!isTouch || !lookInput.active || lookInput.pointerId !== e.pointerId) return;
      e.preventDefault();
      lookInput.dx += (e.clientX - lookInput.lastX);
      lookInput.lastX = e.clientX;
      lookInput.lastY = e.clientY;
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
  setStatus('起動完了 / v10');
  requestAnimationFrame(frame);
})();
