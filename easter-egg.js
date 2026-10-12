(() => {
  const logo = document.querySelector('.site-logo');
  const overlay = document.getElementById('heroEasterEgg');
  const canvas = overlay.querySelector('canvas');
  const context = canvas.getContext('2d');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let clicks = 0, resetClicks, cleanupTimer, outroTimer, frame, audio, running = false;
  let restoreOverflow, restoreFocus;
  logo.tabIndex = 0;
  logo.setAttribute('role', 'button');
  logo.setAttribute('aria-label', 'PayComp logo');
  const preload = new Image();
  preload.src = overlay.querySelector('img').src;

  function fanfare() {
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      audio = new Audio();
      audio.resume().catch(() => {});
      const master = audio.createGain();
      master.gain.value = 0.17;
      master.connect(audio.destination);
      const start = audio.currentTime;
      // Original synthesized brass-style heroic fanfare, with a rising power-up.
      [[261.63,0.05,0.23],[392,0.28,0.23],[523.25,0.51,0.4],[659.25,0.91,0.4],
       [523.25,1.31,1.65],[659.25,1.31,1.65],[783.99,1.31,1.65]].forEach(([hz,offset,length]) => {
        const oscillator=audio.createOscillator(), gain=audio.createGain();
        const filter=audio.createBiquadFilter();
        oscillator.type='sawtooth'; oscillator.frequency.value=hz;
        filter.type='lowpass'; filter.frequency.value=1800;
        gain.gain.setValueAtTime(0,start+offset);
        gain.gain.linearRampToValueAtTime(0.23,start+offset+0.04);
        gain.gain.exponentialRampToValueAtTime(0.001,start+offset+length);
        oscillator.connect(filter); filter.connect(gain); gain.connect(master);
        oscillator.start(start+offset); oscillator.stop(start+offset+length+0.05);
      });
      const swoosh=audio.createOscillator(), volume=audio.createGain();
      swoosh.type='sine'; swoosh.frequency.setValueAtTime(75,start);
      swoosh.frequency.exponentialRampToValueAtTime(650,start+0.65);
      volume.gain.setValueAtTime(0.001,start); volume.gain.linearRampToValueAtTime(0.45,start+0.12);
      volume.gain.exponentialRampToValueAtTime(0.001,start+0.75);
      swoosh.connect(volume); volume.connect(master); swoosh.start(start); swoosh.stop(start+0.8);
    } catch (_) { /* Keep the visual reveal working if audio is unavailable. */ }
  }

  function finish() {
    if (!running) return;
    running=false; clicks=0;
    clearTimeout(cleanupTimer); clearTimeout(outroTimer); cancelAnimationFrame(frame);
    overlay.classList.remove('active'); overlay.classList.remove('ending'); overlay.setAttribute('aria-hidden','true');
    document.body.style.overflow=restoreOverflow;
    context.clearRect(0,0,canvas.width,canvas.height);
    if(audio){audio.close().catch(()=>{});audio=null;}
    if(restoreFocus) restoreFocus.focus({preventScroll:true});
  }

  function reveal() {
    running=true; clicks=0; clearTimeout(resetClicks);
    restoreOverflow=document.body.style.overflow; restoreFocus=document.activeElement;
    document.body.style.overflow='hidden';
    overlay.classList.add('active'); overlay.setAttribute('aria-hidden','false');
    fanfare();
    const started=performance.now();
    let lastStrike=-200, bolts=[];
    function animate(now) {
      if(!running) return;
      const width=window.innerWidth,height=window.innerHeight;
      if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
      context.clearRect(0,0,width,height);
      const elapsed=now-started;
      if(!reducedMotion.matches && now-lastStrike>180){
        lastStrike=now;bolts=[];
        for(let i=0;i<9;i++){
          const angle=(i/9)*Math.PI*2;
          const points=[[width/2,height/2]];
          for(let step=1;step<=8;step++){
            points.push([width/2+Math.cos(angle)*width*0.8*step/8+(Math.random()-.5)*80,
              height/2+Math.sin(angle)*height*0.9*step/8+(Math.random()-.5)*80]);
          }
          bolts.push(points);
        }
      }
      if(!reducedMotion.matches){
        const alpha=Math.max(0,1-(now-lastStrike)/180)*(elapsed<700?1:0.65);
        context.globalAlpha=alpha;context.lineJoin='round';
        bolts.forEach(points=>{
          [14,4,1.5].forEach((line,i)=>{
            context.beginPath();points.forEach(([x,y],j)=>j?context.lineTo(x,y):context.moveTo(x,y));
            context.lineWidth=line;context.strokeStyle=['#06b0ed55','#5cdeff','#ffffff'][i];
            context.shadowColor='#06b0ed';context.shadowBlur=18;context.stroke();
          });
        });
        context.globalAlpha=1;
      }
      frame=requestAnimationFrame(animate);
    }
    frame=requestAnimationFrame(animate);
    outroTimer=setTimeout(()=>overlay.classList.add('ending'),4200);
    cleanupTimer=setTimeout(finish,4800);
  }
  function activate() {
    if(running) return;
    clearTimeout(resetClicks);
    if(++clicks===5) reveal();
    else resetClicks=setTimeout(()=>{clicks=0;},5000);
  }
  logo.addEventListener('click',activate);
  logo.addEventListener('keydown',event=>{
    if(event.key==='Enter'||event.key===' '){event.preventDefault();if(!event.repeat)activate();}
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape')finish();});
  window.addEventListener('pagehide',finish);
})();
