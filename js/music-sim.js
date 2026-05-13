/* music-sim.js
   Client-side renderer for music simulator. 
   增强版：自动清理控制字符，支持光遇 Sky 琴谱
*/
(function(){
  // === 通用数据清洗函数 ===
  function cleanMusicData(raw) {
    return (raw || "")
      .replace(/[\u0000-\u001F\u007F-\u009F\uFEFF]+/g, '')  // 移除所有控制字符（包括  和 ）
      .replace(/,+/g, ',')           // 合并连续逗号
      .replace(/^,|,$/g, '')         // 移除首尾逗号
      .trim();
  }

  function createSimulator(container, raw){
    // === 数据清洗（关键修复）===
    const cleaned = cleanMusicData(raw);
    console.log('原始数据长度:', raw?.length || 0, '→ 清洗后长度:', cleaned.length); // 调试用

    const items = cleaned.split(',').map(s => s.trim()).filter(s => s !== '');
    
    const beats = [];
    function isValidKey(ch){ return /^[a-o]$/.test(ch); }
    
    let i = 0;
    while(i < items.length - 1){
      const currentNote = items[i] || '';
      const currentDuration = parseFloat(items[i+1]) || 0;
      
      if(!isValidKey(currentNote)){
        i += 1; 
        continue;
      }
      
      const beat = { 
        notes: [currentNote], 
        durations: [currentDuration], 
        isCombined: false, 
        durationMs: 0 
      };
      
      i += 2;
      
      // 处理组合音符（duration 为 0）
      while(i < items.length - 1 && beat.durations.slice(-1)[0] === 0){
        const nextNote = items[i] || '';
        const nextDuration = parseFloat(items[i+1]) || 0;
        
        if(isValidKey(nextNote)){
          beat.notes.push(nextNote);
          beat.durations.push(nextDuration);
          beat.isCombined = true;
          i += 2;
        } else {
          break;
        }
      }
      
      const totalDuration = beat.durations.reduce((a,b)=>a+b, 0);
      beat.durationMs = totalDuration * 1000;
      beats.push(beat);
    }

    const uid = 'ms-'+Math.random().toString(36).slice(-6);
    const wrapper = document.createElement('div');
    wrapper.className = 'music-sim-root';
    wrapper.innerHTML = `
      <div class="ms-header"><strong>Music Simulator</strong></div>
      <div class="ms-beats" id="${uid}-beats"></div>
      <div class="ms-controls">
        <button data-action="play">Play</button>
        <button data-action="pause" disabled>Pause</button>
        <button data-action="stop" disabled>Stop</button>
        <span class="ms-status"></span>
      </div>
    `;

    // 样式
    const style = document.createElement('style');
    style.textContent = `
      .music-sim-root{font-family:system-ui,Segoe UI,Roboto,Arial;background:transparent;padding:6px;border-radius:8px}
      .ms-header{margin-bottom:8px;color:#b91c6b}
      .ms-beats{display:grid;grid-template-columns:repeat(4,minmax(160px,1fr));gap:12px}
      .ms-card{background:rgba(255,255,255,0.96);border-radius:12px;padding:8px;border:1px solid rgba(0,0,0,0.04);box-shadow:0 6px 18px rgba(0,0,0,0.04)}
      .ms-card.active{transform:translateY(-6px);box-shadow:0 20px 40px rgba(255,105,180,0.12)}
      .ms-card-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
      .ms-seq{font-weight:800;color:#6b21a8}
      .ms-grid{display:grid;grid-template-columns:repeat(5,1fr);grid-auto-rows:calc(var(--ms-key-size,38px));gap:6px}
      .ms-key{border-radius:10px;background:#fff;border:1px solid rgba(0,0,0,0.06);display:flex;align-items:center;justify-content:center;font-weight:800;color:#6b21a8}
      .ms-key.active-key{background:linear-gradient(145deg,#ff9ff3,#e879f9);color:#fff;border-color:transparent;transform:scale(1.03)}
      .ms-key.zero-duration{box-shadow:0 6px 18px rgba(255,175,189,0.2)}
      .ms-controls{margin-top:8px;display:flex;gap:8px;align-items:center}
      @media (max-width:720px){ .ms-beats{grid-template-columns:repeat(2,minmax(120px,1fr));} }
    `;

    container.appendChild(style);
    container.appendChild(wrapper);

    const beatsContainer = wrapper.querySelector('#'+uid+'-beats');
    
    // 渲染按键布局
    const keyLayout = [ ['a','b','c','d','e'], ['f','g','h','i','j'], ['k','l','m','n','o'] ];
    beats.forEach((b, idx)=>{
      const card = document.createElement('div'); 
      card.className = 'ms-card'; 
      card.dataset.index = idx;
      
      const header = document.createElement('div'); 
      header.className = 'ms-card-header';
      const seq = document.createElement('div'); 
      seq.className = 'ms-seq'; 
      seq.textContent = `${idx+1}/${beats.length}`;
      const duration = document.createElement('div'); 
      duration.className = 'ms-duration'; 
      duration.textContent = (b.durationMs/1000).toFixed(2) + 's';
      header.appendChild(seq); 
      header.appendChild(duration);

      const grid = document.createElement('div'); 
      grid.className = 'ms-grid';
      keyLayout.forEach(row=>{
        row.forEach(letter => {
          const key = document.createElement('div'); 
          key.className = 'ms-key'; 
          key.textContent = letter.toUpperCase();
          const noteIndex = b.notes.indexOf(letter);
          if(noteIndex !== -1){ 
            key.classList.add('active-key'); 
            if(b.durations[noteIndex] === 0) key.classList.add('zero-duration'); 
          }
          grid.appendChild(key);
        });
      });

      card.appendChild(header);
      card.appendChild(grid);
      beatsContainer.appendChild(card);
    });

    // 播放控制
    let idx = 0; 
    let playing = false; 
    let timeoutId = null;
    const playBtn = wrapper.querySelector('[data-action="play"]');
    const pauseBtn = wrapper.querySelector('[data-action="pause"]');
    const stopBtn = wrapper.querySelector('[data-action="stop"]');
    const status = wrapper.querySelector('.ms-status');

    function clearActive(){ 
      beatsContainer.querySelectorAll('.ms-card').forEach(r=>r.classList.remove('active')); 
    }
    function updateButtons(){ 
      playBtn.disabled = playing; 
      pauseBtn.disabled = !playing; 
      stopBtn.disabled = !playing && idx===0; 
    }

    function step(){
      if(idx >= beats.length){ 
        stopPlayback(); 
        return; 
      }
      clearActive();
      const card = beatsContainer.querySelector('[data-index="'+idx+'"]'); 
      if(card) card.classList.add('active');
      
      const duration = Math.max(40, beats[idx].durationMs);
      idx++;
      timeoutId = setTimeout(()=>{ 
        if(playing) step(); 
      }, duration);
      
      status.textContent = idx + ' / ' + beats.length;
      updateButtons();
    }

    function startPlayback(){ 
      if(playing) return; 
      playing=true; 
      updateButtons(); 
      step(); 
    }
    function pausePlayback(){ 
      playing=false; 
      clearTimeout(timeoutId); 
      updateButtons(); 
    }
    function stopPlayback(){ 
      playing=false; 
      clearTimeout(timeoutId); 
      idx=0; 
      clearActive(); 
      status.textContent=''; 
      updateButtons(); 
    }

    playBtn.addEventListener('click', startPlayback);
    pauseBtn.addEventListener('click', pausePlayback);
    stopBtn.addEventListener('click', stopPlayback);

    const cssActive = document.createElement('style'); 
    cssActive.textContent = '.ms-card.active{transform:translateY(-6px);box-shadow:0 20px 40px rgba(255,105,180,0.12)}';
    container.appendChild(cssActive);
  }

  function init(){
    const els = document.querySelectorAll('.music-sim');
    els.forEach(el=>{
      if(el.dataset._msInit) return;
      el.dataset._msInit = '1';
      const raw = el.getAttribute('data-music') || el.textContent || '';
      createSimulator(el, raw);
    });
  }

  if(document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  // 暴露给外部调用
  window.__musicSim_init = init;
  window.__cleanMusicData = cleanMusicData; // 方便外部使用
})();
