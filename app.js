/* Abyss Serpent — PezzaliAPP Edition (Canvas2D, offline-ready)
 * Obiettivo: serpente luminoso che danza in un mare dinamico (senza WebGL, compat compatibilità iOS 8.4.1)
 * Licenza: MIT — 2025 pezzaliAPP
 */
(()=>{
  'use strict';

  const canvas = document.getElementById('scene');
  const ctx = canvas.getContext('2d');
  const DPR = Math.min(2, (window.devicePixelRatio||1));
  let W=0,H=0;
  const state = {
    running:true,
    target:{x:0.5,y:0.5},
    zoom:1,
    themeIndex:0,
    glow:0.9,
    speed:1.0,
    trailLen:180,
    thickness:6,
    waterQuality:0.8,
  };

  const THEMES = [
    {name:'Abyss', body:'#071225', snake:'#69e3ff', tail:'#2dd4bf', waterA:'#0b203f', waterB:'#051024'},
    {name:'Noctiluca', body:'#020813', snake:'#a1a6ff', tail:'#7ac8ff', waterA:'#0b1036', waterB:'#050817'},
    {name:'Sunset', body:'#0b1022', snake:'#ffd07a', tail:'#ff8f5a', waterA:'#1a1a3f', waterB:'#0b0b1e'},
    {name:'Emerald', body:'#041513', snake:'#7bffd4', tail:'#37f0a4', waterA:'#0b2330', waterB:'#031015'},
  ];

  const snake = {
    pts:[],
    max:400,
    vx:0, vy:0,
    px:0.5, py:0.5,
  };

  // Simplex-like noise (value noise) for water displacement
  function mulberry32(a){return function(){var t=a+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
  const rnd = mulberry32(0xA5F00D);
  const perm = new Uint8Array(512);
  for(let i=0;i<256;i++){perm[i]=i}
  for(let i=255;i>0;i--){const j=(rnd()*i)|0; const t=perm[i]; perm[i]=perm[j]; perm[j]=t}
  for(let i=0;i<256;i++) perm[i+256]=perm[i];
  function fade(t){return t*t*(3-2*t)}
  function lerp(a,b,t){return a+(b-a)*t}
  function vnoise(x,y,t){
    const xi = Math.floor(x)&255, yi = Math.floor(y)&255;
    const xf = x - Math.floor(x), yf = y - Math.floor(y);
    const r1 = perm[perm[xi]+yi], r2 = perm[perm[xi+1]+yi];
    const r3 = perm[perm[xi]+yi+1], r4 = perm[perm[xi+1]+yi+1];
    const v1 = (r1/255), v2=(r2/255), v3=(r3/255), v4=(r4/255);
    const u = fade(xf), v = fade(yf);
    return lerp(lerp(v1,v2,u), lerp(v3,v4,u), v);
  }

  // Flow field driven by noise
  function flow(x,y,t){
    const s = 0.0018*state.waterQuality; // density
    const a = vnoise(x*s*0.6, y*s*0.6, t)*Math.PI*2 + t*0.2;
    const m = 0.8 + vnoise(x*s*1.2+8,y*s*1.2+3,t)*0.4;
    return {ax: Math.cos(a)*m, ay: Math.sin(a)*m};
  }

  function resize(){
    W = Math.floor(window.innerWidth);
    H = Math.floor(window.innerHeight);
    canvas.width = Math.floor(W*DPR);
    canvas.height = Math.floor(H*DPR);
    canvas.style.width = W+'px';
    canvas.style.height = H+'px';
    ctx.setTransform(DPR,0,0,DPR,0,0);
  }
  window.addEventListener('resize', resize, {passive:true});
  resize();

  // Controls
  let lastTap=0, pinchDist=0, touching=false;
  function getTouchPoint(e){
    if(e.touches && e.touches.length>0){
      const r = canvas.getBoundingClientRect();
      return {x:(e.touches[0].clientX - r.left)/W, y:(e.touches[0].clientY - r.top)/H};
    } else {
      const r = canvas.getBoundingClientRect();
      return {x:(e.clientX - r.left)/W, y:(e.clientY - r.top)/H};
    }
  }
  canvas.addEventListener('pointerdown', e=>{
    touching=true;
    const p = getTouchPoint(e);
    state.target = p;
  });
  canvas.addEventListener('pointermove', e=>{
    if(!touching) return;
    const p = getTouchPoint(e);
    state.target = p;
  });
  window.addEventListener('pointerup', ()=> touching=false);
  canvas.addEventListener('touchstart', e=>{
    if(e.touches.length===2){
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchDist = Math.hypot(dx,dy);
    } else if(e.touches.length===1){
      const now = performance.now();
      if(now-lastTap<280){ // double tap
        nextTheme();
        e.preventDefault();
      }
      lastTap=now;
    }
  }, {passive:false});
  canvas.addEventListener('touchmove', e=>{
    if(e.touches.length===2){
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const d = Math.hypot(dx,dy);
      const k = (d - pinchDist)/300;
      state.zoom = Math.max(0.7, Math.min(1.6, state.zoom + k));
      pinchDist = d;
      e.preventDefault();
    }
  }, {passive:false});

  // UI
  const elPlay = document.getElementById('btnPlay');
  const elSettings = document.getElementById('btnSettings');
  const elFullscreen = document.getElementById('btnFullscreen');
  const elInstall = document.getElementById('btnInstall');
  const elFps = document.getElementById('fps');
  const elPart = document.getElementById('part');
  const elTheme = document.getElementById('themeName');
  const dlg = document.getElementById('settings');
  const inGlow = document.getElementById('glow');
  const inSpeed = document.getElementById('speed');
  const inTrail = document.getElementById('trail');
  const inThick = document.getElementById('thickness');
  const inWater = document.getElementById('waterQuality');
  const btnTheme = document.getElementById('btnTheme');

  elPlay.addEventListener('click', ()=>{
    state.running = !state.running;
    elPlay.textContent = state.running ? '⏸︎' : '▶︎';
  });
  elSettings.addEventListener('click', ()=> dlg.showModal());
  btnTheme.addEventListener('click', (e)=>{e.preventDefault(); nextTheme();});
  inGlow.addEventListener('input', ()=> state.glow = parseFloat(inGlow.value));
  inSpeed.addEventListener('input', ()=> state.speed = parseFloat(inSpeed.value));
  inTrail.addEventListener('input', ()=> state.trailLen = parseInt(inTrail.value,10));
  inThick.addEventListener('input', ()=> state.thickness = parseInt(inThick.value,10));
  inWater.addEventListener('input', ()=> state.waterQuality = parseFloat(inWater.value));
  elFullscreen.addEventListener('click', ()=>{
    const elem = document.documentElement;
    if(!document.fullscreenElement){
      if(elem.requestFullscreen) elem.requestFullscreen();
    } else {
      if(document.exitFullscreen) document.exitFullscreen();
    }
  });

  let deferredPrompt=null;
  window.addEventListener('beforeinstallprompt', (e)=>{
    e.preventDefault();
    deferredPrompt=e;
    elInstall.style.display='inline-block';
  });
  elInstall.addEventListener('click', async ()=>{
    if(deferredPrompt){ deferredPrompt.prompt(); }
  });

  function nextTheme(){
    state.themeIndex = (state.themeIndex+1)%THEMES.length;
    const t = THEMES[state.themeIndex];
    document.documentElement.style.setProperty('--bg', t.body);
    elTheme.textContent = t.name;
  }
  nextTheme(); // sets initial

  // Init snake
  function resetSnake(){
    snake.pts.length=0;
    snake.px = state.target.x*W;
    snake.py = state.target.y*H;
    snake.vx = 0; snake.vy = 0;
  }
  resetSnake();
  for(let i=0;i<180;i++) snake.pts.push({x:snake.px,y:snake.py});

  // Offscreen buffer for water (compat: standard canvas)
  const water = document.createElement('canvas');
  const wctx = water.getContext('2d');
  function resizeWater(){
    water.width = Math.floor(W*0.6);
    water.height = Math.floor(H*0.6);
  }
  resizeWater();

  let last=performance.now(), acc=0;
  const STEP = 1000/60;
  let frames=0, fps=60, lastFps=last;

  function update(dt){
    // Move target slightly along a dreamy orbit if no touch
    if(!touching){
      const t = performance.now()*0.0002;
      state.target.x = 0.5 + Math.cos(t*1.2)*0.15*Math.sin(t*0.73);
      state.target.y = 0.5 + Math.sin(t*0.9 + Math.cos(t*0.33))*0.12;
    }

    // Physics
    const desiredX = state.target.x*W;
    const desiredY = state.target.y*H;
    const toX = desiredX - snake.px;
    const toY = desiredY - snake.py;
    const dist = Math.hypot(toX,toY)+1e-6;
    const dirX = toX/dist, dirY = toY/dist;
    const maxAccel = 0.24 * state.speed;
    snake.vx += dirX * maxAccel;
    snake.vy += dirY * maxAccel;

    // Flow field influence
    const ff = flow(snake.px, snake.py, performance.now()*0.0003);
    snake.vx += ff.ax * 0.06 * state.speed;
    snake.vy += ff.ay * 0.06 * state.speed;

    // Damping & speed clamp
    const sp = Math.hypot(snake.vx,snake.vy);
    const maxSp = 6 * state.speed;
    const damp = 0.96;
    if(sp>maxSp){ snake.vx = snake.vx/sp*maxSp; snake.vy = snake.vy/sp*maxSp; }
    snake.vx *= damp; snake.vy *= damp;

    snake.px += snake.vx * state.zoom;
    snake.py += snake.vy * state.zoom;
    // keep inside
    snake.px = Math.max(0, Math.min(W, snake.px));
    snake.py = Math.max(0, Math.min(H, snake.py));

    // push head
    snake.pts.unshift({x:snake.px, y:snake.py});
    while(snake.pts.length > state.trailLen) snake.pts.pop();
  }

  function renderWater(){
    const t = performance.now()*0.0004;
    const {waterA,waterB} = THEMES[state.themeIndex];
    const g = wctx.createLinearGradient(0,0,0,water.height);
    g.addColorStop(0, waterA);
    g.addColorStop(1, waterB);
    wctx.fillStyle=g;
    wctx.fillRect(0,0,water.width,water.height);

    // subtle caustics lines via noise contours
    const step = Math.max(2, Math.floor(6*(1.0/state.waterQuality)));
    const amp = 12;
    wctx.globalAlpha = 0.16;
    wctx.lineWidth = 1;
    wctx.strokeStyle = 'rgba(255,255,255,0.25)';
    for(let y=0;y<water.height;y+=step){
      wctx.beginPath();
      for(let x=0;x<water.width;x+=step){
        const v = vnoise(x*0.02, (y+t*40)*0.02, t);
        const yy = y + Math.sin(v*6.283 + t*2)*amp*state.waterQuality;
        if(x===0) wctx.moveTo(x,yy);
        else wctx.lineTo(x,yy);
      }
      wctx.stroke();
    }
    wctx.globalAlpha = 1;
  }

  function renderSnake(){
    const t = THEMES[state.themeIndex];
    const tail = t.tail, head = t.snake;
    // trail glow
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowBlur = 20*state.glow;
    ctx.shadowColor = head;
    ctx.lineCap='round'; ctx.lineJoin='round';

    // variable thickness along the trail
    for(let i=1;i<snake.pts.length;i++){
      const p0 = snake.pts[i-1], p1 = snake.pts[i];
      const a = (1 - i/snake.pts.length);
      const w = Math.max(0.8, state.thickness * (0.25 + a*0.9));
      ctx.strokeStyle = i<8 ? head : tail;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }

    // head aura
    const r = Math.max(12, state.thickness*2.2);
    const g = ctx.createRadialGradient(snake.px,snake.py,0, snake.px,snake.py,r*2.2);
    g.addColorStop(0,'rgba(255,255,255,0.85)');
    g.addColorStop(1, head+'00');
    ctx.fillStyle=g;
    ctx.beginPath(); ctx.arc(snake.px,snake.py,r*2.2,0,Math.PI*2); ctx.fill();

    ctx.restore();
  }

  function frame(now){
    const dt = now - last;
    last = now;
    acc += dt;
    while(acc>=STEP){
      if(state.running) update(STEP);
      acc -= STEP;
    }
    // background water
    renderWater();
    ctx.drawImage(water, 0,0, water.width,water.height, 0,0, W,H);

    // subtle vignette
    const vg = ctx.createRadialGradient(W/2,H*0.7, Math.min(W,H)*0.2, W/2,H*0.6, Math.max(W,H)*0.8);
    vg.addColorStop(0,'#0000'); vg.addColorStop(1,'#0009');
    ctx.fillStyle=vg; ctx.fillRect(0,0,W,H);

    // snake
    renderSnake();

    // HUD
    frames++;
    if(now-lastFps>500){
      fps = Math.round(frames*1000/(now-lastFps));
      frames=0; lastFps=now;
      elFps.textContent = String(fps);
      elPart.textContent = String(snake.pts.length);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // PWA SW
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
  }
})();