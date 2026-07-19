// ========================= DATA =========================
const PLAN = JSON.parse(document.getElementById('plan-data').textContent);
const WEEKS = PLAN.weeks;
const SERIES = PLAN.series;
const PREV_WEEKS = JSON.parse(document.getElementById('prev-plan-data').textContent);
const DAY_NAMES = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
const TYPE_LABEL = {z2a:'ER', z2b:'ER', series:'Series', tirada:'Tirada', carrera:'Carrera', descanso:'Descanso'};

const STORAGE_KEY = 'planimedia_v1';
function loadState(){
  try{ return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {done:{}}; }
  catch(e){ return {done:{}}; }
}
function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(STATE)); }
let STATE = loadState();

function sessionId(w, day, type){ return `w${w}-d${day}-${type}`; }
function isDone(id){ return !!STATE.done[id]; }
function toggleDone(id){ STATE.done[id] = !STATE.done[id]; saveState(); renderAll(); }

// ========================= DATE HELPERS =========================
function parseISO(s){ const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d); }
function fmtDateShort(d){ return d.toLocaleDateString('es-ES',{day:'numeric',month:'short'}); }
function addDays(d, n){ const r=new Date(d); r.setDate(r.getDate()+n); return r; }
function todayLocal(){ const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }

const TODAY = todayLocal();
const PLAN_START = parseISO(PLAN.start);
const RACE_WEEK = WEEKS[WEEKS.length-1];
const RACE_DATE = addDays(parseISO(RACE_WEEK.start), 4); // sábado = day index 5 (1-based day 5 -> offset 4)

function weekForDate(d){
  for(const w of WEEKS){
    const ws = parseISO(w.start), we = parseISO(w.end);
    if(d >= ws && d <= we) return w;
  }
  if(d < PLAN_START) return WEEKS[0];
  return WEEKS[WEEKS.length-1];
}
const CURRENT_WEEK = weekForDate(TODAY);

function sessionDate(week, day){ return addDays(parseISO(week.start), day-1); }

// ========================= COUNTDOWN =========================
function renderCountdown(){
  const diffDays = Math.ceil((RACE_DATE - TODAY) / 86400000);
  const el = document.getElementById('countdown');
  if(diffDays > 0){
    el.innerHTML = `<b>${diffDays}</b> días para la carrera`;
  } else if(diffDays === 0){
    el.innerHTML = `<b>Hoy es el día</b>`;
  } else {
    el.innerHTML = `Carrera completada`;
  }
}

// ========================= WEEK VOLUME (real km) =========================
function weekPlannedKm(week){
  // parse "36-40" style range -> average, or single number
  const parts = week.vol.split('-').map(s=>parseFloat(s));
  if(parts.length===2) return (parts[0]+parts[1])/2;
  return parts[0];
}
function weekVolRange(week){ return week.vol; }

// ========================= RENDER: ESTA SEMANA =========================
function renderHoy(){
  const w = CURRENT_WEEK;
  const el = document.getElementById('view-hoy');
  const doneCount = w.sessions.filter(s=>isDone(sessionId(w.n,s.day,s.type))).length;
  const total = w.sessions.length;

  let html = `
  <div class="hero">
    <div class="hero-top">
      <div>
        <div class="hero-block-tag">${w.block}${w.deload?' · descarga':''}</div>
        <div class="hero-week">Semana ${w.n} de 13</div>
        <div class="hero-dates">${fmtDateShort(parseISO(w.start))} – ${fmtDateShort(parseISO(w.end))}</div>
      </div>
      <div class="hero-vol">
        <div class="hero-vol-num">${w.vol}</div>
        <div class="hero-vol-label">km objetivo</div>
      </div>
    </div>
    <div class="week-bar-track">${renderBarSegs(w)}</div>
    <div class="week-progress">${doneCount}/${total} sesiones completadas esta semana</div>
  </div>`;

  if(w.checkpoint){
    html += `<div class="checkpoint-flag"><span>★</span><div><b>Checkpoint:</b> ${w.checkpoint}</div></div>`;
  }
  if(w.note){
    html += `<div class="note-flag">${w.note}</div>`;
  }

  html += `<div class="sec-head"><span class="sec-title">Sesiones</span><span class="sec-sub">toca el círculo para marcar hecha</span></div>`;

  w.sessions.forEach(s=>{
    const id = sessionId(w.n, s.day, s.type);
    const d = sessionDate(w, s.day);
    const done = isDone(id);
    const isToday = d.getTime()===TODAY.getTime();
    html += `
    <div class="session type-${s.type} ${done?'done':''}" style="${isToday?'box-shadow:0 0 0 1px var(--accent) inset;':''}" onclick="toggleDone('${id}')">
      <div class="session-day">${DAY_NAMES[s.day-1]}<b>${d.getDate()}</b></div>
      <div class="session-check">${done?'✓':''}</div>
      <div class="session-body">
        <div class="session-label">${s.label}</div>
        <div class="session-detail">${s.detail}</div>
      </div>
      <div class="session-tag">${TYPE_LABEL[s.type]||s.type}</div>
    </div>`;
  });

  // next week preview
  const nextW = WEEKS[w.n]; // n is 1-indexed, array 0-indexed -> WEEKS[n] is next
  if(nextW){
    html += `
    <div class="sec-head" style="margin-top:24px;"><span class="sec-title">Próxima semana</span><span class="sec-sub">semana ${nextW.n} · ${nextW.block}</span></div>
    <div class="week-row" onclick="goToView('calendario')">
      <div class="week-row-top">
        <div class="week-row-title">
          <span class="week-num">S${nextW.n}</span>
          <span class="week-block">${nextW.block}${nextW.deload?' (descarga)':''}</span>
        </div>
        <div class="week-vol">${nextW.vol} km</div>
      </div>
      <div class="week-dates">${fmtDateShort(parseISO(nextW.start))} – ${fmtDateShort(parseISO(nextW.end))}</div>
    </div>`;
  }

  el.innerHTML = html;
}

function renderBarSegs(week){
  const colors = {z2a:'var(--z2)', z2b:'var(--z2)', series:'var(--series)', tirada:'var(--tirada)', carrera:'var(--carrera)'};
  return week.sessions.map(s=>{
    const done = isDone(sessionId(week.n,s.day,s.type));
    const c = done ? 'var(--done)' : (colors[s.type]||'var(--line-strong)');
    return `<div class="week-bar-seg" style="flex:1; background:${c};"></div>`;
  }).join('');
}

// ========================= RENDER: VISTA GENERAL =========================
function renderGeneral(){
  const el = document.getElementById('view-general');

  const totalKmRange = WEEKS.reduce((acc,w)=>{
    const parts = w.vol.split('-').map(Number);
    return [acc[0]+parts[0], acc[1]+(parts[1]||parts[0])];
  },[0,0]);
  const totalSessions = WEEKS.reduce((a,w)=>a+w.sessions.length,0);
  const doneSessions = WEEKS.reduce((a,w)=>a+w.sessions.filter(s=>isDone(sessionId(w.n,s.day,s.type))).length,0);
  const weeksElapsed = Math.min(Math.max(CURRENT_WEEK.n - 1, 0), 13);

  let html = `
  <div class="sec-head"><span class="sec-title">Resumen del bloque</span><span class="sec-sub">13 semanas · 13/07 → 10/10/2026</span></div>
  <div class="grid grid-4" style="margin-bottom:22px;">
    <div class="card stat"><div class="stat-label">Volumen total</div><div class="stat-value">${totalKmRange[0]}<small>–${totalKmRange[1]} km</small></div></div>
    <div class="card stat"><div class="stat-label">Semana actual</div><div class="stat-value accent">${CURRENT_WEEK.n}<small>/13</small></div></div>
    <div class="card stat"><div class="stat-label">Sesiones hechas</div><div class="stat-value">${doneSessions}<small>/${totalSessions}</small></div></div>
    <div class="card stat"><div class="stat-label">Ritmo objetivo</div><div class="stat-value accent">3'56<small>/km</small></div></div>
  </div>

  <div class="sec-head"><span class="sec-title">Bloques</span></div>
  <div class="block-band">
    <div class="block-seg b0"><div class="block-seg-label">Reconstrucción</div><div class="block-seg-weeks">S1–S3</div></div>
    <div class="block-seg b1"><div class="block-seg-label">Construcción</div><div class="block-seg-weeks">S4–S9</div></div>
    <div class="block-seg b2"><div class="block-seg-label">Pico específico</div><div class="block-seg-weeks">S10–S12</div></div>
    <div class="block-seg b3"><div class="block-seg-label">Race week</div><div class="block-seg-weeks">S13</div></div>
  </div>

  <div class="sec-head"><span class="sec-title">Todas las semanas</span><span class="sec-sub">toca para ver detalle en calendario</span></div>`;

  WEEKS.forEach(w=>{
    const doneCount = w.sessions.filter(s=>isDone(sessionId(w.n,s.day,s.type))).length;
    const isCurrent = w.n === CURRENT_WEEK.n;
    html += `
    <div class="week-row ${isCurrent?'current':''}" onclick="goToWeekDetail(${w.n})">
      <div class="week-row-top">
        <div class="week-row-title">
          <span class="week-num">S${w.n}</span>
          <span class="week-block">${w.block}</span>
          ${w.deload?'<span class="deload-flag">Descarga</span>':''}
          ${w.checkpoint?'<span class="deload-flag" style="color:var(--accent); border-color:var(--accent-dim); background:var(--accent-bg);">★ Checkpoint</span>':''}
        </div>
        <div class="week-vol">${w.vol} km</div>
      </div>
      <div class="week-dates" style="margin-bottom:6px;">${fmtDateShort(parseISO(w.start))} – ${fmtDateShort(parseISO(w.end))}</div>
      <div class="week-bar-track">${renderBarSegs(w)}</div>
      <div class="week-progress">${doneCount}/${w.sessions.length} sesiones</div>
    </div>`;
  });

  el.innerHTML = html;
}

// ========================= RENDER: CALENDARIO =========================
let selectedWeekN = CURRENT_WEEK.n;
function goToWeekDetail(n){
  selectedWeekN = n;
  goToView('calendario');
}
function renderCalendario(){
  const el = document.getElementById('view-calendario');
  const w = WEEKS.find(x=>x.n===selectedWeekN) || CURRENT_WEEK;

  let html = `
  <div class="sec-head">
    <span class="sec-title">Calendario</span>
    <span class="sec-sub">navega por semana</span>
  </div>
  <div style="display:flex; align-items:center; gap:10px; margin-bottom:18px;">
    <button class="reset-btn" onclick="shiftWeek(-1)" ${w.n<=1?'disabled style="opacity:0.3;"':''}>‹ anterior</button>
    <div style="flex:1; text-align:center;">
      <div style="font-family:var(--font-mono); font-size:11px; color:var(--text-faint);">SEMANA ${w.n} / 13</div>
      <div style="font-weight:600; font-size:15px;">${w.block}${w.deload?' · descarga':''}</div>
    </div>
    <button class="reset-btn" onclick="shiftWeek(1)" ${w.n>=13?'disabled style="opacity:0.3;"':''}>siguiente ›</button>
  </div>

  <div class="card" style="margin-bottom:16px;">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
      <span class="mono" style="font-size:12px; color:var(--text-dim);">${fmtDateShort(parseISO(w.start))} – ${fmtDateShort(parseISO(w.end))}</span>
      <span class="mono" style="font-size:16px; font-weight:700; color:var(--accent);">${w.vol} km</span>
    </div>
    <div class="week-bar-track" style="margin-top:8px;">${renderBarSegs(w)}</div>
  </div>`;

  if(w.checkpoint) html += `<div class="checkpoint-flag"><span>★</span><div><b>Checkpoint:</b> ${w.checkpoint}</div></div>`;
  if(w.note) html += `<div class="note-flag">${w.note}</div>`;

  html += `<div class="legend">
    <div class="legend-item"><span class="legend-dot" style="background:var(--z2)"></span>ER</div>
    <div class="legend-item"><span class="legend-dot" style="background:var(--series)"></span>Series</div>
    <div class="legend-item"><span class="legend-dot" style="background:var(--tirada)"></span>Tirada larga</div>
    <div class="legend-item"><span class="legend-dot" style="background:var(--carrera)"></span>Carrera</div>
  </div>`;

  w.sessions.forEach(s=>{
    const id = sessionId(w.n, s.day, s.type);
    const d = sessionDate(w, s.day);
    const done = isDone(id);
    html += `
    <div class="session type-${s.type} ${done?'done':''}" onclick="toggleDone('${id}')">
      <div class="session-day">${DAY_NAMES[s.day-1]}<b>${d.getDate()}</b></div>
      <div class="session-check">${done?'✓':''}</div>
      <div class="session-body">
        <div class="session-label">${s.label}</div>
        <div class="session-detail">${s.detail}</div>
      </div>
      <div class="session-tag">${TYPE_LABEL[s.type]||s.type}</div>
    </div>`;
  });

  el.innerHTML = html;
}
function shiftWeek(delta){
  const n = Math.min(13, Math.max(1, selectedWeekN + delta));
  selectedWeekN = n;
  renderCalendario();
}

// ========================= RENDER: SERIES =========================
const REST_ICON = {trote:'trote', parado:'parón', mixto:'mixto'};
const REST_COLOR = {trote:'var(--z2)', parado:'var(--danger)', mixto:'var(--deload)'};

function renderSeries(){
  const el = document.getElementById('view-series');
  let html = `
  <div class="sec-head"><span class="sec-title">Progresión de series</span><span class="sec-sub">ritmo objetivo 3'56/km · umbral actual ~4'00-4'05/km</span></div>
  <div class="legend">
    <div class="legend-item"><span class="legend-dot" style="background:var(--z2)"></span>Descanso trote suave</div>
    <div class="legend-item"><span class="legend-dot" style="background:var(--danger)"></span>Descanso parón real</div>
    <div class="legend-item"><span class="legend-dot" style="background:var(--deload)"></span>Mixto (híbrida)</div>
  </div>
  <div class="card" style="padding:0; overflow-x:auto;">
    <table class="series-table">
      <thead><tr>
        <th>S</th><th>Repeticiones</th><th>Ritmo</th><th>Descanso</th><th>Total ses.</th>
      </tr></thead>
      <tbody>`;
  for(let n=1;n<=13;n++){
    const sdata = SERIES[n];
    const isCurrent = n === CURRENT_WEEK.n;
    const restColor = REST_COLOR[sdata.resttype] || 'var(--text-dim)';
    html += `
      <tr class="${isCurrent?'current-row':''}">
        <td>${n}${sdata.hybrid?' <span style="color:var(--deload);">◆</span>':''}</td>
        <td>${sdata.reps}${sdata.tag?`<br><span style="color:var(--text-faint); font-size:10px;">${sdata.tag}</span>`:''}</td>
        <td class="pace-cell">${sdata.pace}</td>
        <td style="color:${restColor};">${sdata.rest}</td>
        <td>${sdata.total} km</td>
      </tr>`;
  }
  html += `</tbody></table></div>`;

  html += `<div class="sec-head" style="margin-top:22px;"><span class="sec-title">Sesiones híbridas</span><span class="sec-sub">reps cortas + bloque largo sostenido</span></div>`;
  for(let n=1;n<=13;n++){
    if(SERIES[n].hybrid){
      html += `<div class="note-flag" style="font-style:normal;"><b style="color:var(--deload); font-style:normal;">S${n}:</b> ${SERIES[n].detail_long}</div>`;
    }
  }
  html += `<div class="note-flag">Patrón identificado en la sesión del 17/05 de la prepa anterior (3x800m + 3km + 2km) — sostener ritmo con fatiga ya acumulada, como en el tramo final de la carrera real.</div>`;

  html += `<div class="sec-head" style="margin-top:22px;"><span class="sec-title">Checkpoints de series</span></div>`;
  for(let n=1;n<=13;n++){
    if(SERIES[n].checkpoint){
      html += `<div class="checkpoint-flag"><span>★</span><div><b>S${n}:</b> ${SERIES[n].checkpoint}</div></div>`;
    }
  }

  html += `<div class="sec-head" style="margin-top:22px;"><span class="sec-title">Estructura de la sesión tipo</span></div>
  <div class="card">
    <div class="facts-list">
      <div class="fact-row"><span class="fact-k">Calentamiento</span><span class="fact-v">Z2 suave, ~5'00/km</span></div>
      <div class="fact-row"><span class="fact-k">Repeticiones</span><span class="fact-v">ver tabla arriba</span></div>
      <div class="fact-row"><span class="fact-k">Descanso trote</span><span class="fact-v">fijo por tiempo, trote suave ~9'15/km</span></div>
      <div class="fact-row"><span class="fact-k">Descanso parón</span><span class="fact-v">S5, S6, S12 · reps cortas/rápidas de mayor exigencia</span></div>
      <div class="fact-row"><span class="fact-k">Por qué el parón</span><span class="fact-v">llegar fresco a cada rep sin fatiga acumulada</span></div>
      <div class="fact-row"><span class="fact-k">Por qué trote en simulacros</span><span class="fact-v">S9/S10: especificidad, en carrera real no hay parones</span></div>
      <div class="fact-row"><span class="fact-k">Enfriamiento</span><span class="fact-v">Z2 suave</span></div>
      <div class="fact-row"><span class="fact-k">Regla de secuencia</span><span class="fact-v">nunca día consecutivo a tirada larga</span></div>
    </div>
  </div>`;

  el.innerHTML = html;
}

// ========================= RENDER: GRAFICOS =========================
let chartVolInstance=null, chartLoadInstance=null, chartTypeInstance=null;
function renderGraficos(){
  const el = document.getElementById('view-graficos');
  el.innerHTML = `
  <div class="sec-head"><span class="sec-title">Volumen semanal</span><span class="sec-sub">km objetivo (punto medio del rango)</span></div>
  <div class="chart-card"><div class="chart-wrap" style="height:220px;"><canvas id="chartVol" role="img" aria-label="Gráfico de volumen semanal en kilómetros a lo largo de las 13 semanas"></canvas></div></div>

  <div class="sec-head"><span class="sec-title">Carga acumulada</span><span class="sec-sub">km totales acumulados en el bloque</span></div>
  <div class="chart-card"><div class="chart-wrap" style="height:220px;"><canvas id="chartLoad" role="img" aria-label="Gráfico de carga acumulada en kilómetros"></canvas></div></div>

  <div class="sec-head"><span class="sec-title">Reparto por tipo de sesión</span><span class="sec-sub">km estimados por categoría, todo el bloque</span></div>
  <div class="chart-card"><div class="chart-wrap" style="height:260px;"><canvas id="chartType" role="img" aria-label="Gráfico de barras horizontales del reparto de kilómetros por tipo de sesión"></canvas></div></div>
  `;

  const labels = WEEKS.map(w=>'S'+w.n);
  const vols = WEEKS.map(weekPlannedKm);
  const isDeload = WEEKS.map(w=>w.deload);

  const gridColor = 'rgba(255,255,255,0.06)';
  const textColor = '#9aa39c';

  // ---- volume bar chart ----
  const ctx1 = document.getElementById('chartVol');
  if(chartVolInstance) chartVolInstance.destroy();
  chartVolInstance = new Chart(ctx1, {
    type:'bar',
    data:{ labels, datasets:[{
      label:'km',
      data: vols,
      backgroundColor: WEEKS.map((w,i)=> w.n===CURRENT_WEEK.n ? '#d4ff5c' : (w.deload ? 'rgba(212,165,60,0.55)' : 'rgba(92,156,212,0.55)')),
      borderRadius:4, borderSkipped:false, maxBarThickness:28
    }]},
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{legend:{display:false}, tooltip:{callbacks:{label:c=>c.parsed.y+' km ('+WEEKS[c.dataIndex].vol+')'}}},
      scales:{
        x:{grid:{display:false}, ticks:{color:textColor, font:{family:'JetBrains Mono', size:10}}},
        y:{grid:{color:gridColor}, ticks:{color:textColor, font:{family:'JetBrains Mono', size:10}}, title:{display:true, text:'km', color:textColor, font:{size:10}}}
      }
    }
  });

  // ---- cumulative load line chart ----
  let cum = 0;
  const cumData = vols.map(v=>{ cum += v; return Math.round(cum); });
  const ctx2 = document.getElementById('chartLoad');
  if(chartLoadInstance) chartLoadInstance.destroy();
  chartLoadInstance = new Chart(ctx2, {
    type:'line',
    data:{ labels, datasets:[{
      label:'km acumulados', data: cumData,
      borderColor:'#d4ff5c', backgroundColor:'rgba(212,255,92,0.08)',
      borderWidth:2, pointRadius:3, pointBackgroundColor:'#d4ff5c', pointBorderColor:'#0b0e0d',
      fill:true, tension:0.3
    }]},
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{legend:{display:false}, tooltip:{callbacks:{label:c=>c.parsed.y+' km acumulados'}}},
      scales:{
        x:{grid:{display:false}, ticks:{color:textColor, font:{family:'JetBrains Mono', size:10}}},
        y:{grid:{color:gridColor}, ticks:{color:textColor, font:{family:'JetBrains Mono', size:10}}, title:{display:true, text:'km totales', color:textColor, font:{size:10}}}
      }
    }
  });

  // ---- type breakdown horizontal bar ----
  // estimate km per type across all weeks using session detail durations roughly via series table + z2 midpoints
  const typeKm = {z2:0, series:0, tirada:0, carrera:0};
  WEEKS.forEach(w=>{
    w.sessions.forEach(s=>{
      if(s.type==='z2a'||s.type==='z2b'){
        const m = s.detail.match(/(\d+)-(\d+)min/);
        if(m){ const avgMin=(parseInt(m[1])+parseInt(m[2]))/2; typeKm.z2 += avgMin/5.5; } // ~5'30/km avg z2
      } else if(s.type==='series'){
        typeKm.series += SERIES[w.n] ? SERIES[w.n].total : 0;
      } else if(s.type==='tirada'){
        const m = s.detail.match(/(\d+)-(\d+)min/);
        if(m){ const avgMin=(parseInt(m[1])+parseInt(m[2]))/2; typeKm.tirada += avgMin/5.5; }
      } else if(s.type==='carrera'){
        typeKm.carrera += 21.1;
      }
    });
  });
  const ctx3 = document.getElementById('chartType');
  if(chartTypeInstance) chartTypeInstance.destroy();
  chartTypeInstance = new Chart(ctx3, {
    type:'bar',
    data:{
      labels:['ER (A+B)','Series/calidad','Tiradas largas','Carrera'],
      datasets:[{
        data:[Math.round(typeKm.z2), Math.round(typeKm.series), Math.round(typeKm.tirada), Math.round(typeKm.carrera)],
        backgroundColor:['#5c9cd4','#e8763c','#b083e8','#d4ff5c'],
        borderRadius:4, borderSkipped:false
      }]
    },
    options:{
      indexAxis:'y', responsive:true, maintainAspectRatio:false,
      plugins:{legend:{display:false}, tooltip:{callbacks:{label:c=>c.parsed.x+' km aprox.'}}},
      scales:{
        x:{grid:{color:gridColor}, ticks:{color:textColor, font:{family:'JetBrains Mono', size:10}}, title:{display:true, text:'km estimados', color:textColor, font:{size:10}}},
        y:{grid:{display:false}, ticks:{color:textColor, font:{family:'JetBrains Mono', size:11}}}
      }
    }
  });
}

// ========================= RENDER: DATOS CLAVE =========================
function renderDatos(){
  const el = document.getElementById('view-datos');
  el.innerHTML = `
  <div class="sec-head"><span class="sec-title">Objetivo</span></div>
  <div class="card" style="margin-bottom:18px;">
    <div class="facts-list">
      <div class="fact-row"><span class="fact-k">Meta primaria</span><span class="fact-v">sub 1h25</span></div>
      <div class="fact-row"><span class="fact-k">Objetivo real</span><span class="fact-v">1h23 (3'56/km)</span></div>
      <div class="fact-row"><span class="fact-k">1h20</span><span class="fact-v">sin perseguir activamente</span></div>
      <div class="fact-row"><span class="fact-k">Carrera</span><span class="fact-v">Sábado 10/10/2026</span></div>
    </div>
  </div>

  <div class="sec-head"><span class="sec-title">Zonas y ritmos de referencia</span></div>
  <div class="card" style="margin-bottom:18px;">
    <div class="facts-list">
      <div class="fact-row"><span class="fact-k">Z2 · ritmo</span><span class="fact-v">5'30–6'00/km</span></div>
      <div class="fact-row"><span class="fact-k">Z2 · FC objetivo</span><span class="fact-v">~140 bpm, tendiendo a bajar</span></div>
      <div class="fact-row"><span class="fact-k">Z2 · techo duro</span><span class="fact-v">150 bpm (nunca superar)</span></div>
      <div class="fact-row"><span class="fact-k">Umbral real medido</span><span class="fact-v">~4'00–4'05/km</span></div>
      <div class="fact-row"><span class="fact-k">Umbral estimado por Coros</span><span class="fact-v">~3'50/km (sobreestimado)</span></div>
      <div class="fact-row"><span class="fact-k">Margen umbral vs. carrera (prepa anterior)</span><span class="fact-v">~8% más rápido</span></div>
      <div class="fact-row"><span class="fact-k">Nivel ya demostrado (reps 500m-1km)</span><span class="fact-v">3'40–3'50/km, picos 3'05–3'25 en reps cortas</span></div>
    </div>
  </div>

  <div class="sec-head"><span class="sec-title">Estructura semanal</span></div>
  <div class="card" style="margin-bottom:18px;">
    <div class="facts-list">
      <div class="fact-row"><span class="fact-k">S1–S2</span><span class="fact-v">3 sesiones/semana</span></div>
      <div class="fact-row"><span class="fact-k">S3 en adelante</span><span class="fact-v">4 sesiones/semana (si tobillo ok)</span></div>
      <div class="fact-row"><span class="fact-k">S13 (taper)</span><span class="fact-v">3 sesiones/semana</span></div>
      <div class="fact-row"><span class="fact-k">Descargas</span><span class="fact-v">S7 y S11 (-25-30% volumen)</span></div>
      <div class="fact-row"><span class="fact-k">Techo Z2</span><span class="fact-v">1h15/sesión (no aplica a tirada larga)</span></div>
    </div>
  </div>

  <div class="sec-head"><span class="sec-title">Reglas de secuencia</span></div>
  <div class="card" style="margin-bottom:18px;">
    <div class="facts-list">
      <div class="fact-row"><span class="fact-k">Series</span><span class="fact-v">nunca día consecutivo a tirada larga</span></div>
      <div class="fact-row"><span class="fact-k">Tirada larga</span><span class="fact-v">preferente fin de semana</span></div>
      <div class="fact-row"><span class="fact-k">Sesiones exigentes</span><span class="fact-v">nunca 2 seguidas</span></div>
      <div class="fact-row"><span class="fact-k">Si hay que recortar</span><span class="fact-v">series y Z2 antes que saltar sesión (mín. 40min)</span></div>
    </div>
  </div>

  <div class="sec-head"><span class="sec-title">Checkpoints (sin carrera de control)</span></div>
  <div class="card" style="margin-bottom:18px;">
    <div class="facts-list">
      <div class="fact-row"><span class="fact-k">S6</span><span class="fact-v">tirada larga, tramo final a umbral</span></div>
      <div class="fact-row"><span class="fact-k">S9</span><span class="fact-v">simulacro 1 · 2x4km a ritmo objetivo</span></div>
      <div class="fact-row"><span class="fact-k">S10</span><span class="fact-v">simulacro 2 · 3x3km, réplica 29/03</span></div>
    </div>
  </div>

  <div class="sec-head"><span class="sec-title">Estado inicial (julio 2026)</span></div>
  <div class="card" style="margin-bottom:18px;">
    <div class="facts-list">
      <div class="fact-row"><span class="fact-k">Volumen previo</span><span class="fact-v">14–27 km/sem</span></div>
      <div class="fact-row"><span class="fact-k">Tobillo</span><span class="fact-v">esguince reciente, en recuperación</span></div>
      <div class="fact-row"><span class="fact-k">Series reintroducidas</span><span class="fact-v">8x400@4'30 · 6x500@4'05</span></div>
    </div>
  </div>

  <div class="sec-head"><span class="sec-title">Datos</span></div>
  <div class="card">
    <p style="font-size:12px; color:var(--text-dim); margin-bottom:12px;">El progreso (sesiones marcadas) se guarda en este navegador. Si cambias de dispositivo o borras datos del navegador, se pierde.</p>
    <button class="reset-btn" onclick="resetProgress()">Reiniciar todo el progreso</button>
  </div>
  `;
}
function resetProgress(){
  if(confirm('¿Reiniciar todas las sesiones marcadas como hechas? Esta acción no se puede deshacer.')){
    STATE = {done:{}};
    saveState();
    renderAll();
  }
}

// ========================= RENDER: PLANI ANTERIOR =========================
const PREVTYPE_LABEL = {z2:'ER', series:'Series', tirada:'Long Run', carrera:'Carrera', test:'Test', otro:'Otro'};
const PREVTYPE_COLOR = {z2:'var(--z2)', series:'var(--series)', tirada:'var(--tirada)', carrera:'var(--carrera)', test:'var(--deload)', otro:'var(--text-faint)'};
const PREVTYPE_BG = {z2:'var(--z2-bg)', series:'var(--series-bg)', tirada:'var(--tirada-bg)', carrera:'var(--carrera-bg)', test:'rgba(212,165,60,0.1)', otro:'var(--bg-elev)'};

function renderAnterior(){
  const el = document.getElementById('view-anterior');

  const totalKm = PREV_WEEKS.reduce((a,w)=>a+w.vol_km,0);
  const totalSessions = PREV_WEEKS.reduce((a,w)=>a+w.sessions.length,0);
  const seriesSessions = PREV_WEEKS.reduce((a,w)=>a+w.sessions.filter(s=>s.type==='series').length,0);
  const carreras = PREV_WEEKS.flatMap(w=>w.sessions.filter(s=>s.type==='carrera').map(s=>({week:w.n, ...s})));
  const firstDate = parseISO(PREV_WEEKS[0].start);
  const lastDate = parseISO(PREV_WEEKS[PREV_WEEKS.length-1].end);

  let html = `
  <div class="sec-head"><span class="sec-title">Plani anterior</span><span class="sec-sub">${PREV_WEEKS.length} semanas · dic 2025 – may 2026</span></div>
  <div class="grid grid-4" style="margin-bottom:20px;">
    <div class="card stat"><div class="stat-label">Periodo</div><div class="stat-value" style="font-size:15px;">${fmtDateShort(firstDate)} – ${fmtDateShort(lastDate)}</div></div>
    <div class="card stat"><div class="stat-label">Km totales</div><div class="stat-value accent">${Math.round(totalKm)}</div></div>
    <div class="card stat"><div class="stat-label">Sesiones</div><div class="stat-value">${totalSessions}</div></div>
    <div class="card stat"><div class="stat-label">De series</div><div class="stat-value">${seriesSessions}</div></div>
  </div>`;

  if(carreras.length){
    html += `<div class="checkpoint-flag"><span>★</span><div><b>Carreras de control:</b> ${carreras.map(c=>`S${c.week} · ${c.detail}`).join(' · ')}</div></div>`;
  }

  html += `<div class="legend" style="margin-top:10px;">
    <div class="legend-item"><span class="legend-dot" style="background:var(--z2)"></span>ER</div>
    <div class="legend-item"><span class="legend-dot" style="background:var(--series)"></span>Series / Activación</div>
    <div class="legend-item"><span class="legend-dot" style="background:var(--tirada)"></span>Long run</div>
    <div class="legend-item"><span class="legend-dot" style="background:var(--carrera)"></span>Carrera</div>
    <div class="legend-item"><span class="legend-dot" style="background:var(--deload)"></span>Test</div>
  </div>`;

  PREV_WEEKS.forEach(w=>{
    html += `
    <div class="week-row" style="cursor:default;">
      <div class="week-row-top">
        <div class="week-row-title">
          <span class="week-num">Sem. ${w.n}</span>
          <span class="week-dates">${fmtDateShort(parseISO(w.start))} – ${fmtDateShort(parseISO(w.end))}</span>
        </div>
        <div class="week-vol">${w.vol_km} km</div>
      </div>`;

    w.sessions.forEach(s=>{
      const color = PREVTYPE_COLOR[s.type] || 'var(--text-faint)';
      const bg = PREVTYPE_BG[s.type] || 'var(--bg-elev)';
      html += `
      <div class="session readonly" style="margin-top:8px; border-left-color:${color};">
        <div class="session-body">
          <div class="session-label">${s.label}</div>
          <div class="session-detail">${s.detail}</div>
        </div>
        <div class="session-tag" style="background:${bg}; color:${color};">${PREVTYPE_LABEL[s.type]||s.type}</div>
      </div>`;
    });

    html += `</div>`;
  });

  el.innerHTML = html;
}


function goToView(name){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('view-'+name).classList.add('active');
  document.querySelector(`.tab[data-view="${name}"]`).classList.add('active');
  if(name==='calendario') renderCalendario();
  if(name==='graficos') renderGraficos();
  if(name==='anterior') renderAnterior();
  window.scrollTo({top:0, behavior:'instant'});
}

document.getElementById('tabs').addEventListener('click', e=>{
  const btn = e.target.closest('.tab');
  if(!btn) return;
  goToView(btn.dataset.view);
});

// ========================= INIT =========================
function renderAll(){
  renderCountdown();
  renderHoy();
  renderGeneral();
  renderCalendario();
  renderSeries();
  renderAnterior();
  renderDatos();
  const activeView = document.querySelector('.view.active');
  if(activeView && activeView.id === 'view-graficos') renderGraficos();
}
renderAll();
