// ═══════════════════════════════════════════════════════════════════════
// Build Believe Fit · src/components/promethean-vault-iife.js
// Promethean vault mount IIFE
// Phase 2.1 · Extracted verbatim from the inline <script id="promethean-vault-iife">
// block formerly in bbf-app.html. Loaded via <script src="src/components/promethean-vault-iife.js">
// at the SAME document position so execution order is preserved.
// Do not hand-edit unless you also update the matching block reference.
// ═══════════════════════════════════════════════════════════════════════
/* === MAX MODE engine: sibling IIFE; never touches app state === */

(function(){
  if(document.documentElement.classList.contains('rm')) return;
  var RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ============== SHARED STATE ==============
  var S = {
    mx: innerWidth/2, my: innerHeight/2,
    tmx: innerWidth/2, tmy: innerHeight/2, // smoothed
    mvx: 0, mvy: 0,
    t: 0,
    hr: 62, hrv: 64, spo2: 98, vo2: 52.3, cadence: 0, bp_s: 118, bp_d: 76,
    scrollVel: 0
  };

  function lerp(a,b,t){ return a + (b-a)*t; }

  // ============== 1. VITALS INTRO ==============
  var intro = document.getElementById('vitals-intro');
  if(intro && !sessionStorage.getItem('bbf_intro_done')){
    var lines = intro.querySelectorAll('.row');
    var vals = [
      {el: document.getElementById('vi-hr'),   from: 40, to: 62, suffix: ''},
      {el: document.getElementById('vi-spo2'), from: 88, to: 98, suffix: '%'},
      {el: document.getElementById('vi-cad'),  from: 0,  to: 142, suffix: ''},
      {el: document.getElementById('vi-nb'),   from: 0,  to: 99, suffix: '%'}
    ];
    lines.forEach(function(l,i){ setTimeout(function(){ l.classList.add('on'); }, 180 + i*180); });
    // count up values
    setTimeout(function(){
      vals.forEach(function(v){
        if(!v.el) return;
        var start = performance.now(), dur = 1600;
        (function tick(now){
          var p = Math.min(1, (now-start)/dur);
          var ease = 1 - Math.pow(1-p, 3);
          var cur = Math.round(v.from + (v.to-v.from)*ease);
          v.el.textContent = cur + v.suffix;
          if(p<1) requestAnimationFrame(tick);
        })(start);
      });
    }, 500);
    setTimeout(function(){
      intro.classList.add('gone');
      setTimeout(function(){ intro.remove(); }, 900);
      sessionStorage.setItem('bbf_intro_done', '1');
    }, 2800);
  } else if(intro){
    intro.remove();
  }

  // ============== 2. MOUSE + SCROLL TRACKING ==============
  addEventListener('pointermove', function(e){
    S.mvx = e.clientX - S.mx;
    S.mvy = e.clientY - S.my;
    S.mx = e.clientX; S.my = e.clientY;
  }, {passive:true});

  // ============== 3. WEBGL BLOOM SHADER BG ==============
  (function(){
    var canvas = document.getElementById('shader-bg');
    if(!canvas) return;
    var gl = canvas.getContext('webgl', {alpha:true, antialias:false, premultipliedAlpha:false});
    if(!gl){ canvas.style.display='none'; return; }

    function resize(){
      canvas.width = innerWidth;
      canvas.height = innerHeight;
      gl.viewport(0,0,canvas.width,canvas.height);
    }
    resize(); addEventListener('resize', resize);

    var vs = 'attribute vec2 p; varying vec2 uv; void main(){ uv=p*0.5+0.5; gl_Position=vec4(p,0,1); }';
    var fs = [
      'precision highp float;',
      'varying vec2 uv;',
      'uniform float t;',
      'uniform vec2 mouse;',
      'uniform float pulse;',
      'uniform float scrollV;',
      'float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }',
      'float noise(vec2 p){ vec2 i=floor(p),f=fract(p); vec2 u=f*f*(3.0-2.0*f);',
        'return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y); }',
      'float fbm(vec2 p){ float v=0.,a=.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.05; a*=.5; } return v; }',
      'void main(){',
        'vec2 q = uv;',
        'vec2 toM = mouse - uv;',
        'float d = length(toM);',
        'vec2 warp = normalize(toM) * (0.03 + 0.04*pulse) / (d*6.0+1.0);',
        'q += warp;',
        // two noise layers drifting
        'float n1 = fbm(q*3.0 + vec2(t*0.06, t*0.04));',
        'float n2 = fbm(q*6.0 - vec2(t*0.03, t*0.07 + scrollV*0.5));',
        // bloom centers
        'float bloom = smoothstep(.55, .92, n1*n2);',
        // gold/cyan split based on y
        'vec3 gold = vec3(0.96,0.78,0.0);',
        'vec3 cyan = vec3(0.0,0.9,1.0);',
        'vec3 purple = vec3(0.35,0.18,0.82);',
        'vec3 col = mix(purple*0.3, gold, smoothstep(0.2,0.7,n1));',
        'col = mix(col, cyan, smoothstep(0.55,0.9,n2)*0.55);',
        'col *= bloom * 1.2;',
        // mouse glow
        'col += gold * smoothstep(0.28, 0.0, d) * (0.35 + 0.25*pulse);',
        // pulse wave from center
        'float r = distance(uv, vec2(0.5));',
        'float wave = sin(r*24.0 - t*2.0) * 0.5 + 0.5;',
        'col += cyan * wave * pulse * 0.08 * smoothstep(0.7, 0.0, r);',
        'gl_FragColor = vec4(col, bloom*0.9);',
      '}'
    ].join('\n');

    function sh(type, src){
      var s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)){
        console.warn('shader err', gl.getShaderInfoLog(s));
        return null;
      }
      return s;
    }
    var v = sh(gl.VERTEX_SHADER, vs);
    var f = sh(gl.FRAGMENT_SHADER, fs);
    if(!v || !f){ canvas.style.display='none'; return; }
    var prog = gl.createProgram();
    gl.attachShader(prog,v); gl.attachShader(prog,f); gl.linkProgram(prog);
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    var pLoc = gl.getAttribLocation(prog,'p');
    gl.enableVertexAttribArray(pLoc);
    gl.vertexAttribPointer(pLoc, 2, gl.FLOAT, false, 0, 0);

    var uT = gl.getUniformLocation(prog,'t');
    var uM = gl.getUniformLocation(prog,'mouse');
    var uP = gl.getUniformLocation(prog,'pulse');
    var uSV = gl.getUniformLocation(prog,'scrollV');

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    window.__shaderRender = function(t, pulse){
      gl.uniform1f(uT, t * 0.001);
      gl.uniform2f(uM, S.tmx/innerWidth, 1 - S.tmy/innerHeight);
      gl.uniform1f(uP, pulse);
      gl.uniform1f(uSV, Math.min(1, Math.abs(S.scrollVel)/3000));
      gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
  })();

  // ============== 4. MUSCLE FIBER FIELD ==============
  (function(){
    var c = document.getElementById('fiber-field');
    if(!c) return;
    var ctx = c.getContext('2d');
    var W, H, fibers = [];
    function resize(){
      W = c.width = innerWidth;
      H = c.height = innerHeight;
      fibers = [];
      var count = Math.min(60, Math.floor((W*H) / 28000));
      for(var i=0;i<count;i++){
        fibers.push({
          x: Math.random()*W, y: Math.random()*H,
          len: 80 + Math.random()*180,
          ang: Math.random()*Math.PI*2,
          thick: 0.6 + Math.random()*1.6,
          vAng: (Math.random()-.5)*0.002,
          hue: Math.random() < .6 ? 0 : 1 // 0 gold, 1 cyan
        });
      }
    }
    resize(); addEventListener('resize', resize);

    window.__fiberRender = function(t, pulse){
      ctx.clearRect(0,0,W,H);
      for(var i=0;i<fibers.length;i++){
        var f = fibers[i];
        var dx = S.tmx - f.x, dy = S.tmy - f.y;
        var d = Math.hypot(dx,dy);
        // gravitate slightly to mouse
        var pull = Math.min(1, 140/(d+40));
        var targetAng = Math.atan2(dy,dx);
        f.ang = lerp(f.ang, targetAng, pull*0.06) + f.vAng;
        var amp = 8 + pulse*18;
        var ox = Math.cos(t*0.0008 + i) * amp;
        var oy = Math.sin(t*0.0006 + i*1.3) * amp;
        var x1 = f.x + ox, y1 = f.y + oy;
        var x2 = x1 + Math.cos(f.ang)*f.len;
        var y2 = y1 + Math.sin(f.ang)*f.len;
        var grad = ctx.createLinearGradient(x1,y1,x2,y2);
        var col = f.hue ? 'rgba(0,229,255,' : 'rgba(245,200,0,';
        grad.addColorStop(0, col + '0)');
        grad.addColorStop(0.5, col + (0.25 + pulse*0.35) + ')');
        grad.addColorStop(1, col + '0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = f.thick * (0.8 + pulse*0.5);
        ctx.lineCap = 'round';
        ctx.beginPath();
        // curved fiber (3 segments)
        ctx.moveTo(x1,y1);
        var mx = (x1+x2)/2 + Math.sin(t*0.001+i)*6;
        var my = (y1+y2)/2 + Math.cos(t*0.0012+i)*6;
        ctx.quadraticCurveTo(mx, my, x2, y2);
        ctx.stroke();
      }
    };
  })();

  // ============== 5. NEURAL CURSOR TRAIL ==============
  (function(){
    var c = document.getElementById('neural-trail');
    if(!c) return;
    var ctx = c.getContext('2d');
    var W,H,parts=[];
    function resize(){ W=c.width=innerWidth; H=c.height=innerHeight; }
    resize(); addEventListener('resize', resize);

    function emit(){
      var spd = Math.hypot(S.mvx, S.mvy);
      if(spd < 0.4) return;
      var n = Math.min(4, Math.floor(spd/5) + 1);
      for(var i=0;i<n;i++){
        parts.push({
          x: S.mx + (Math.random()-.5)*6,
          y: S.my + (Math.random()-.5)*6,
          vx: (Math.random()-.5)*1.4 + S.mvx*0.15,
          vy: (Math.random()-.5)*1.4 + S.mvy*0.15,
          life: 1,
          r: 1 + Math.random()*2.2,
          hue: Math.random()<.5 ? 'rgba(0,229,255,' : 'rgba(245,200,0,',
          spark: Math.random()<.18
        });
      }
      if(parts.length > 220) parts.splice(0, parts.length-220);
    }
    setInterval(emit, 30);

    window.__neuralRender = function(dt){
      // fade
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(0,0,W,H);
      ctx.globalCompositeOperation = 'lighter';
      for(var i=parts.length-1;i>=0;i--){
        var p = parts[i];
        p.x += p.vx; p.y += p.vy;
        p.vx *= 0.94; p.vy *= 0.94;
        p.life -= 0.016;
        if(p.life <= 0){ parts.splice(i,1); continue; }
        var a = p.life * (p.spark ? 0.9 : 0.55);
        ctx.fillStyle = p.hue + a + ')';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI*2);
        ctx.fill();
        // connective line to next particle if close
        if(i>0 && i%3===0){
          var q = parts[i-1];
          var dd = Math.hypot(p.x-q.x, p.y-q.y);
          if(dd < 40){
            ctx.strokeStyle = p.hue + (a*0.3) + ')';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(p.x,p.y); ctx.lineTo(q.x,q.y);
            ctx.stroke();
          }
        }
      }
    };
  })();

  // ============== 6. BIOMETRIC HUD + ECG ==============
  (function(){
    var ecg = document.getElementById('bio-ecg');
    if(!ecg) return;
    var ctx = ecg.getContext('2d');
    var W = ecg.width, H = ecg.height;
    var points = [];
    var maxPts = 220;
    // Build initial flat
    for(var i=0;i<maxPts;i++) points.push(0);

    var beatPhase = 0;
    var hrEl = document.getElementById('bio-hr');
    var hrvEl = document.getElementById('bio-hrv');
    var spo2El = document.getElementById('bio-spo2');
    var bpEl = document.getElementById('bio-bp');
    var vo2El = document.getElementById('bio-vo2');
    var cadEl = document.getElementById('bio-cad');

    window.__bioUpdate = function(dt){
      // drive HR from scroll velocity and mouse velocity
      var exertion = Math.min(1, (Math.abs(S.scrollVel)/2000) + Math.hypot(S.mvx,S.mvy)/50);
      var targetHR = 58 + exertion*38;
      S.hr = lerp(S.hr, targetHR, 0.02);
      S.hrv = lerp(S.hrv, 72 - exertion*30, 0.02);
      S.spo2 = lerp(S.spo2, 99 - exertion*3, 0.02);
      S.vo2 = 52.3 + Math.sin(performance.now()*0.0003)*0.4;
      S.cadence = lerp(S.cadence, Math.min(180, Math.abs(S.scrollVel)*0.08), 0.08);
      S.bp_s = Math.round(lerp(S.bp_s, 118 + exertion*22, 0.02));
      S.bp_d = Math.round(lerp(S.bp_d, 76 + exertion*10, 0.02));

      // advance ECG
      beatPhase += dt * (S.hr/60) * 0.001;
      var bp = beatPhase % 1;
      // P, QRS, T waves — stylized
      var y = 0;
      if(bp < 0.08) y = Math.sin(bp/0.08 * Math.PI) * 0.14;
      else if(bp < 0.18){ var q=(bp-0.08)/0.10; y = -q*0.2; }
      else if(bp < 0.22){ var r=(bp-0.18)/0.04; y = -0.2 + r*1.6; }
      else if(bp < 0.28){ var s2=(bp-0.22)/0.06; y = 1.4 - s2*1.8; }
      else if(bp < 0.50){ var tp=(bp-0.28)/0.22; y = -0.4 + Math.sin(tp*Math.PI)*0.6; }
      else y = 0;
      y += (Math.random()-.5)*0.03;
      points.push(y);
      if(points.length > maxPts) points.shift();

      // render ECG
      ctx.clearRect(0,0,W,H);
      // grid
      ctx.strokeStyle = 'rgba(245,200,0,0.08)';
      ctx.lineWidth = 1;
      for(var gx=0; gx<W; gx+=20){ ctx.beginPath(); ctx.moveTo(gx,0); ctx.lineTo(gx,H); ctx.stroke(); }
      // trace
      ctx.strokeStyle = '#00e5ff';
      ctx.shadowBlur = 6;
      ctx.shadowColor = '#00e5ff';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      for(var i=0;i<points.length;i++){
        var x = (i / (maxPts-1)) * W;
        var py = H/2 - points[i] * (H*0.4);
        if(i===0) ctx.moveTo(x,py); else ctx.lineTo(x,py);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Update HUD text
      if(hrEl) hrEl.innerHTML = Math.round(S.hr) + '<span class="u">bpm</span>';
      if(hrvEl) hrvEl.innerHTML = Math.round(S.hrv) + '<span class="u">ms</span>';
      if(spo2El) spo2El.innerHTML = S.spo2.toFixed(0) + '<span class="u">%</span>';
      if(bpEl) bpEl.textContent = S.bp_s + '/' + S.bp_d;
      if(vo2El) vo2El.innerHTML = S.vo2.toFixed(1) + '<span class="u">ml/kg</span>';
      if(cadEl) cadEl.innerHTML = Math.round(S.cadence) + '<span class="u">spm</span>';
    };
  })();

  // ============== 7. FULL-SCREEN BLINK ==============
  var worldBlink = document.getElementById('world-blink');
  function worldBlinkNow(){
    if(!worldBlink) return;
    worldBlink.classList.add('on');
    setTimeout(function(){ worldBlink.classList.remove('on'); }, 160);
  }
  function scheduleWorldBlink(){
    var delay = 18000 + Math.random()*22000; // 18-40s
    setTimeout(function(){
      worldBlinkNow();
      scheduleWorldBlink();
    }, delay);
  }
  setTimeout(scheduleWorldBlink, 8000);

  // ============== 8. BREATHING TEXT ==============
  // Find hero H1 and split into chars
  (function(){
    var target = document.querySelector('#hero h1, #hero .hero-h, #hero .h1');
    if(!target){
      // fallback — first h1 anywhere
      target = document.querySelector('h1');
    }
    if(!target) return;
    // Only do first-level text nodes, preserve inline elements
    function splitNode(node){
      Array.from(node.childNodes).forEach(function(n){
        if(n.nodeType === 3){
          var text = n.textContent;
          var frag = document.createDocumentFragment();
          for(var i=0;i<text.length;i++){
            var ch = text[i];
            if(ch === ' '){ frag.appendChild(document.createTextNode(' ')); continue; }
            var span = document.createElement('span');
            span.className = 'ch';
            span.textContent = ch;
            span.style.setProperty('--i', i);
            frag.appendChild(span);
          }
          node.replaceChild(frag, n);
        } else if(n.nodeType === 1 && !n.classList.contains('ch')){
          // go one level deeper
          splitNode(n);
        }
      });
    }
    target.classList.add('breath-text');
    splitNode(target);
    window.__breathChars = target.querySelectorAll('.ch');
  })();

  // ============== 9. TIER CARD TILT + SHEEN TRACKING ==============
  document.querySelectorAll('.tier-card').forEach(function(card){
    card.addEventListener('pointermove', function(e){
      var r = card.getBoundingClientRect();
      var rx = (e.clientX - r.left) / r.width;
      var ry = (e.clientY - r.top) / r.height;
      card.style.setProperty('--mx', (rx*100) + '%');
      card.style.setProperty('--my', (ry*100) + '%');
      card.style.setProperty('--tilt-x', ((ry-0.5)*-6).toFixed(2) + 'deg');
      card.style.setProperty('--tilt-y', ((rx-0.5)*6).toFixed(2) + 'deg');
    });
    card.addEventListener('pointerleave', function(){
      card.style.setProperty('--tilt-x', '0deg');
      card.style.setProperty('--tilt-y', '0deg');
    });
  });

  // ============== 10. AUDIO (heartbeat thump + drone) ==============
  var audioOn = false, audioCtx = null, masterGain, droneOsc1, droneOsc2, thumpTimer;
  var audBtn = document.getElementById('audio-toggle');
  function startAudio(){
    if(audioCtx) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AC();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = 0.0;
      masterGain.connect(audioCtx.destination);
      // Fade in
      masterGain.gain.linearRampToValueAtTime(0.18, audioCtx.currentTime + 0.8);

      // Low drone — two detuned oscillators
      droneOsc1 = audioCtx.createOscillator();
      droneOsc1.type = 'sine'; droneOsc1.frequency.value = 55;
      droneOsc2 = audioCtx.createOscillator();
      droneOsc2.type = 'sine'; droneOsc2.frequency.value = 55.4;
      var droneGain = audioCtx.createGain(); droneGain.gain.value = 0.14;
      var droneFilter = audioCtx.createBiquadFilter();
      droneFilter.type = 'lowpass'; droneFilter.frequency.value = 220;
      droneOsc1.connect(droneGain); droneOsc2.connect(droneGain);
      droneGain.connect(droneFilter); droneFilter.connect(masterGain);
      droneOsc1.start(); droneOsc2.start();

      // Heartbeat thump — triggered per beat
      function thump(){
        if(!audioCtx) return;
        var now = audioCtx.currentTime;
        var osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(80, now);
        osc.frequency.exponentialRampToValueAtTime(28, now + 0.14);
        var g = audioCtx.createGain();
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(0.55, now + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
        osc.connect(g); g.connect(masterGain);
        osc.start(now); osc.stop(now + 0.2);
        // second smaller thump (lub-dub)
        setTimeout(function(){
          if(!audioCtx) return;
          var n2 = audioCtx.currentTime;
          var o2 = audioCtx.createOscillator();
          o2.type = 'sine';
          o2.frequency.setValueAtTime(64, n2);
          o2.frequency.exponentialRampToValueAtTime(24, n2 + 0.1);
          var g2 = audioCtx.createGain();
          g2.gain.setValueAtTime(0.0001, n2);
          g2.gain.exponentialRampToValueAtTime(0.38, n2 + 0.01);
          g2.gain.exponentialRampToValueAtTime(0.0001, n2 + 0.14);
          o2.connect(g2); g2.connect(masterGain);
          o2.start(n2); o2.stop(n2 + 0.16);
        }, 180);
      }
      function scheduleThump(){
        if(!audioOn) return;
        thump();
        var interval = 60000 / S.hr;
        thumpTimer = setTimeout(scheduleThump, interval);
      }
      scheduleThump();
    } catch(e){ console.warn('audio fail', e); audioOn = false; }
  }
  function stopAudio(){
    if(!audioCtx) return;
    clearTimeout(thumpTimer);
    try {
      masterGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
      setTimeout(function(){
        try { droneOsc1.stop(); droneOsc2.stop(); audioCtx.close(); } catch(e){}
        audioCtx = null;
      }, 400);
    } catch(e){ audioCtx = null; }
  }
  if(audBtn){
    audBtn.addEventListener('click', function(){
      audioOn = !audioOn;
      audBtn.classList.toggle('on', audioOn);
      if(audioOn) startAudio(); else stopAudio();
    });
  }

  // ============== 11. SECTION THRESHOLD FLASH ==============
  var flash = document.getElementById('thresh-flash');
  var seenSections = new Set();
  var sectionObs = new IntersectionObserver(function(entries){
    entries.forEach(function(en){
      if(en.isIntersecting && en.intersectionRatio > 0.5){
        var id = en.target.id;
        if(seenSections.has(id)) return;
        seenSections.add(id);
        if(flash){
          flash.classList.add('flash');
          setTimeout(function(){ flash.classList.remove('flash'); }, 120);
        }
        // Also glitch breath-chars briefly
        if(window.__breathChars){
          window.__breathChars.forEach(function(ch, i){
            setTimeout(function(){
              ch.style.textShadow = '2px 0 #00e5ff, -2px 0 #f5c800';
              setTimeout(function(){ ch.style.textShadow = ''; }, 80);
            }, i * 8);
          });
        }
      }
    });
  }, {threshold: [0.5]});
  document.querySelectorAll('section[id]').forEach(function(s){ sectionObs.observe(s); });

  // ============== SCROLL VELOCITY ==============
  var lastY = scrollY, lastST = performance.now();
  addEventListener('scroll', function(){
    var now = performance.now();
    S.scrollVel = (scrollY - lastY) / Math.max(now-lastST, 1) * 1000;
    lastY = scrollY; lastST = now;
  }, {passive:true});

  // ============== MASTER RAF LOOP ==============
  var lastT = performance.now();
  var lastBeat = 0;
  function frame(t){
    var dt = t - lastT; lastT = t;
    S.t = t;
    // smooth mouse
    S.tmx = lerp(S.tmx, S.mx, 0.15);
    S.tmy = lerp(S.tmy, S.my, 0.15);
    // decay mouse velocity
    S.mvx *= 0.85; S.mvy *= 0.85;
    // scroll vel decay
    S.scrollVel *= 0.9;

    // pulse 0..1 based on HR phase
    var beatMs = 60000 / S.hr;
    var phase = (t % beatMs) / beatMs;
    var pulse = 0;
    if(phase < 0.12) pulse = Math.sin(phase/0.12 * Math.PI);
    else if(phase < 0.24) pulse = Math.sin((phase-0.12)/0.12 * Math.PI) * 0.5;

    // Render systems
    if(window.__shaderRender) window.__shaderRender(t, pulse);
    if(window.__fiberRender) window.__fiberRender(t, pulse);
    if(window.__neuralRender) window.__neuralRender(dt);
    if(window.__bioUpdate) window.__bioUpdate(dt);

    // Breathing text: chars scale & shift on pulse
    if(window.__breathChars){
      var beatScale = 1 + pulse * 0.04;
      var shift = pulse * 1.2;
      for(var i=0;i<window.__breathChars.length;i++){
        var ch = window.__breathChars[i];
        var off = Math.sin(t*0.0014 + i*0.28) * 0.5;
        ch.style.transform = 'translateY(' + (off - shift*Math.sin(i*0.5)).toFixed(2) + 'px) scale(' + beatScale.toFixed(3) + ')';
      }
    }

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  console.log('%c◉◉◉ MAX MODE: full biometric simulation active', 'color:#00e5ff;font-family:monospace;font-weight:bold;');
  console.log('%c   ├ webgl bloom · fiber field · neural trail', 'color:#f5c800;font-family:monospace;');
  console.log('%c   ├ ecg · hr · hrv · spo2 · bp · vo2max · cadence', 'color:#f5c800;font-family:monospace;');
  console.log('%c   └ click speaker to enable pulse audio', 'color:#f5c800;font-family:monospace;');
})();
