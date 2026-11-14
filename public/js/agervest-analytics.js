/* AgerVest V3 analytics layer — integrated into the 0.8 UI. */
(function () {
  const DATA = window.AGERVEST_DATA || {};
  const analytics = DATA.analytics || { crops: {}, meta: {} };
  const cropKeys = Object.keys(analytics.crops || {});

  function $(id) { return document.getElementById(id); }
  function safe(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\W/g, '').toLowerCase(); }
  function normalizeCrop(s) {
    const q = safe(s);
    return cropKeys.find(k => safe(k) === q) || cropKeys.find(k => safe(k).includes(q) || q.includes(safe(k))) || null;
  }
  function n(v, decimals = 0) {
    if (v === null || v === undefined || Number.isNaN(Number(v))) return 'Sin dato';
    return Number(v).toLocaleString('es-PE', { maximumFractionDigits: decimals });
  }
  function money(v) { return `S/ ${n(v, 0)}`; }
  function finite(v) { return typeof v === 'number' && isFinite(v); }
  function fmtCompact(v) {
    if (!finite(v)) return '';
    const av = Math.abs(v);
    if (av >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
    if (av >= 1e3) return `${(v / 1e3).toFixed(0)}k`;
    if (av >= 10) return v.toFixed(0);
    return v.toFixed(1);
  }
  function chartCtx(id) {
    const c = $(id); if (!c) return null;
    const dpr = window.devicePixelRatio || 1;
    const r = c.getBoundingClientRect();
    c.width = Math.max(320, r.width * dpr);
    c.height = Math.max(180, r.height * dpr);
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { x: ctx, w: Math.max(320, r.width), h: Math.max(180, r.height) };
  }
  function drawLine(id, labels, series, opt = {}) {
    const o = chartCtx(id); if (!o) return;
    const { x, w, h } = o, pad = { l: 48, r: 18, t: 20, b: 38 };
    const vals = series.flatMap(s => s.data.filter(finite));
    if (!vals.length) return;
    const max0 = Math.max(...vals), min0 = Math.min(...vals);
    const range = Math.max(1, max0 - min0);
    const max = max0 + range * .12, min = Math.max(0, min0 - range * .08);
    x.clearRect(0, 0, w, h); x.strokeStyle = '#dfe6e1'; x.fillStyle = '#6c7d75'; x.font = '11px Segoe UI';
    for (let i = 0; i < 4; i++) { const y = pad.t + (h - pad.t - pad.b) * i / 3; x.beginPath(); x.moveTo(pad.l, y); x.lineTo(w - pad.r, y); x.stroke(); const val = max - (max - min) * i / 3; x.fillText(`${opt.prefix || ''}${fmtCompact(val)}`, 4, y + 4); }
    const plotW = w - pad.l - pad.r, plotH = h - pad.t - pad.b, palette = ['#0b6b4f', '#c7a13a', '#8f5e43'];
    series.forEach((s, si) => {
      x.strokeStyle = palette[si % palette.length]; x.lineWidth = 2.5; x.beginPath(); let started = false;
      s.data.forEach((v, i) => { if (!finite(v)) return; const xx = pad.l + plotW * (labels.length <= 1 ? 0 : i / (labels.length - 1)); const yy = pad.t + (max - v) / (max - min || 1) * plotH; if (!started) { x.moveTo(xx, yy); started = true; } else x.lineTo(xx, yy); });
      x.stroke();
    });
    labels.forEach((lab, i) => { if (i % 2 === 0 || labels.length <= 7) { const xx = pad.l + plotW * (labels.length <= 1 ? 0 : i / (labels.length - 1)); x.fillStyle = '#6c7d75'; x.fillText(lab, xx - 10, h - 12); } });
    series.forEach((s, i) => { x.fillStyle = palette[i % palette.length]; x.fillRect(w - 132, pad.t + i * 17, 10, 10); x.fillStyle = '#4c655b'; x.fillText(s.label, w - 116, pad.t + 9 + i * 17); });
  }
  function drawBars(id, labels, series, opt = {}) {
    const o = chartCtx(id); if (!o) return;
    const { x, w, h } = o, pad = { l: 48, r: 18, t: 22, b: 44 };
    const vals = series.flatMap(s => s.data.filter(finite)); if (!vals.length) return;
    const max = Math.max(...vals) * 1.12 || 1;
    x.clearRect(0, 0, w, h); x.strokeStyle = '#dfe6e1'; x.fillStyle = '#6c7d75'; x.font = '11px Segoe UI';
    for (let i = 0; i < 4; i++) { const y = pad.t + (h - pad.t - pad.b) * i / 3; x.beginPath(); x.moveTo(pad.l, y); x.lineTo(w - pad.r, y); x.stroke(); x.fillText(fmtCompact(max * (1 - i / 3)), 4, y + 4); }
    const plotW = w - pad.l - pad.r, plotH = h - pad.t - pad.b, groupW = plotW / labels.length;
    const barW = Math.max(6, Math.min(22, groupW / (series.length + 1))); const palette = ['#0b6b4f', '#c7a13a', '#8f5e43'];
    labels.forEach((lab, i) => { series.forEach((s, si) => { const v = s.data[i]; if (!finite(v)) return; const bh = v / max * plotH; const xx = pad.l + i * groupW + (groupW - barW * series.length) / 2 + si * barW; const yy = pad.t + plotH - bh; x.fillStyle = palette[si % palette.length]; x.fillRect(xx, yy, barW - 2, bh); }); if (i % 2 === 0 || labels.length <= 7) { x.fillStyle = '#6c7d75'; x.fillText(lab, pad.l + i * groupW + 4, h - 12); } });
    series.forEach((s, i) => { x.fillStyle = palette[i % palette.length]; x.fillRect(w - 122, pad.t + i * 16, 9, 9); x.fillStyle = '#4c655b'; x.fillText(s.label, w - 106, pad.t + 8 + i * 16); });
  }
  function avg2(a) { const vals = (a || []).slice(0, 2).filter(finite); return vals.length ? vals.reduce((s, x) => s + x, 0) / vals.length : null; }

  function cropTabs(active, id) {
    const box = $(id); if (!box) return;
    const key = normalizeCrop(active) || cropKeys[0]; box.innerHTML = cropKeys.map(c => `<button type="button" class="crop-tab ${c === key ? 'active' : ''}" data-av-crop="${c}">${c}</button>`).join('');
  }
  function renderCropPanel(container, crop, compact = false, prefix = 'av') {
    const el = typeof container === 'string' ? $(container.replace(/^#/, '')) : container; if (!el) return;
    const key = normalizeCrop(crop); const a = key ? analytics.crops[key] : null; if (!a) { el.innerHTML = `<div class="data-empty">No hay series históricas disponibles para <b>${crop || 'este cultivo'}</b> en el dataset V3. Las referencias integradas actualmente cubren: ${cropKeys.join(', ')}.</div>`; return; }
    const r = a.arequipa || {};
    const id = `${prefix}-${safe(key)}-${Math.random().toString(36).slice(2, 7)}`;
    el.innerHTML = `<div class="av-analytics-grid ${compact ? 'compact' : ''}">
      <article class="av-chart-card av-span-8"><div class="av-card-head"><div><span class="eyebrow">Mercado observado</span><h3>Precio pagado al productor</h3></div><span class="data-badge">2025–2026</span></div><div class="av-chart-wrap"><canvas id="${id}-price"></canvas></div><p class="data-note">Promedio mensual nacional según la serie disponible. 2026 contiene datos hasta julio. La serie no constituye una proyección de precios.</p></article>
      <article class="av-chart-card av-span-4"><div class="av-card-head"><div><span class="eyebrow">Temporada</span><h3>Meses con mayor precio observado</h3></div></div><div class="season-list">${(a.favorableMonths || []).map(m => `<span>${m}</span>`).join('')}</div><p class="data-note">${a.priceNote || ''}</p><div class="metric-table av-metrics"><div class="metric-row"><small>Rendimiento Arequipa 2025</small><strong>${n(r.yield2025)} kg/ha</strong></div><div class="metric-row"><small>Rendimiento Arequipa 2026</small><strong>${n(r.yield2026)} kg/ha</strong></div></div></article>
      <article class="av-chart-card av-span-6"><h3>Producción mensual nacional</h3><div class="av-chart-wrap small"><canvas id="${id}-prod"></canvas></div></article>
      <article class="av-chart-card av-span-6"><h3>Comparación regional — Arequipa</h3><div class="av-chart-wrap small"><canvas id="${id}-region"></canvas></div><div class="av-stat-strip"><span>2025: <b>${money(r.production2025)} t</b></span><span>2026: <b>${money(r.production2026)} t</b></span></div></article>
    </div>`;
    setTimeout(() => {
      const months = analytics.meta?.months || [];
      drawLine(`${id}-price`, months, [{label:'2025',data:a.prices2025 || []},{label:'2026',data:a.prices2026 || []}], {prefix:'S/ '});
      drawBars(`${id}-prod`, months, [{label:'2025',data:a.production2025 || []},{label:'2026',data:a.production2026 || []}]);
      drawBars(`${id}-region`, ['Producción (t)','Rendimiento (kg/ha)'], [{label:'2025',data:[r.production2025,r.yield2025]},{label:'2026',data:[r.production2026,r.yield2026]}]);
    }, 20);
  }
  function renderRiskAndCosts(container, prefix='av') {
    const el = typeof container === 'string' ? $(container.replace(/^#/, '')) : container; if (!el) return;
    const sac = analytics.meta?.sacSeries || []; const c = analytics.meta?.costs || {};
    const id = `${prefix}-${Math.random().toString(36).slice(2, 7)}`;
    const climate = analytics.meta?.climate2024 || []; const climates = climate.filter(x => finite(x.temp)); const avgTemp = climates.length ? climates.reduce((a,x)=>a+x.temp,0)/climates.length : null; const avgHum = climates.length ? climates.reduce((a,x)=>a+x.humidity,0)/climates.length : null;
    el.innerHTML = `<div class="av-analytics-grid"><article class="av-chart-card av-span-6"><div class="av-card-head"><div><span class="eyebrow">Seguro Agrícola Catastrófico</span><h3>Siniestralidad regional</h3></div></div><div class="av-chart-wrap small"><canvas id="${id}-sac"></canvas></div><p class="data-note">Serie de referencia regional. No corresponde a un cultivo individual ni predice siniestralidad futura.</p></article><article class="av-chart-card av-span-6"><div class="av-card-head"><div><span class="eyebrow">Presión operativa</span><h3>Costos de referencia</h3></div></div><div class="av-chart-wrap small"><canvas id="${id}-cost"></canvas></div><p class="data-note">Comparación de jornal, tractor y yunta en los primeros meses con datos disponibles.</p></article><article class="av-chart-card av-span-12"><div class="av-card-head"><div><span class="eyebrow">Contexto meteorológico</span><h3>Referencia climática 2024</h3></div></div><div class="av-stat-strip"><span>Temperatura media disponible: <b>${avgTemp===null?'Sin dato':n(avgTemp,2)+' °C'}</b></span><span>Humedad media: <b>${avgHum===null?'Sin dato':n(avgHum,2)+'%'}</b></span><span>Estaciones: <b>${DATA.regionStats?.climateStations || '—'}</b></span></div><p class="data-note">Variables meteorológicas históricas incluidas en el dataset de referencia; no constituyen una predicción climática.</p></article></div>`;
    setTimeout(() => { drawBars(`${id}-sac`, sac.map(x => x.label.replace('20','')), [{label:'Índice %',data:sac.map(x=>x.value)}]); drawBars(`${id}-cost`, ['Jornal','Tractor','Yunta'], [{label:'2025 ene-feb',data:[avg2(c.jornal2025),avg2(c.tractor2025),avg2(c.yunta2025)]},{label:'2026 ene-feb',data:[avg2(c.jornal2026),avg2(c.tractor2026),avg2(c.yunta2026)]}]); }, 20);
  }
  function renderOverview(container) {
    const el = typeof container === 'string' ? $(container.replace(/^#/, '')) : container; if (!el) return;
    const r = DATA.regionStats || {}; const crops = cropKeys;
    el.innerHTML = `<div class="av-overview-grid"><div class="av-overview-card"><span>Región piloto</span><strong>${r.pilot || 'Arequipa'}</strong><small>Última actualización: ${r.lastUpdate || '—'}</small></div><div class="av-overview-card"><span>Cultivos monitoreados</span><strong>${r.cultivosMonitoreados || crops.length}</strong><small>${crops.join(' · ')}</small></div><div class="av-overview-card"><span>Superficie de referencia</span><strong>${n(r.surfaceProtectedHa)} ha</strong><small>Dato de contexto regional</small></div><div class="av-overview-card"><span>Fuentes integradas</span><strong>${r.sourcesCount || 0}</strong><small>MIDAGRI · SENAMHI · SAC y costos</small></div><div class="av-overview-card"><span>Siniestralidad de referencia</span><strong>${n(r.siniestralidadActual,2)}%</strong><small>Serie SAC regional del dataset V3</small></div><div class="av-overview-card"><span>Estaciones climáticas</span><strong>${r.climateStations || 0}</strong><small>Referencia meteorológica incorporada</small></div></div><div class="av-source-line"><b>Fuentes de referencia:</b> MIDAGRI, SENAMHI, Seguro Agrícola Catastrófico y series de costos agrícolas incorporadas en el prototipo.</div>`;
  }
  window.AgerVestAnalytics = { data: DATA, analytics, cropKeys, normalizeCrop, renderCropPanel, renderRiskAndCosts, renderOverview, cropTabs };
})();
