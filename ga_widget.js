(function () {
  const tmpl = document.createElement("template");
  tmpl.innerHTML = `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
 
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
 
      :host {
        display: block;
        font-family: 'DM Sans', sans-serif;
        background: #f0f2f7;
        padding: 20px;
        min-height: 100%;
        color: #1a1f36;
      }
 
      /* ── KPI STRIP ── */
      .kpi-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
        margin-bottom: 20px;
      }
      .kpi-card {
        background: #fff;
        border-radius: 14px;
        padding: 16px 20px;
        border: 1px solid #e8eaf0;
        position: relative;
        overflow: hidden;
      }
      .kpi-card::before {
        content: '';
        position: absolute;
        top: 0; left: 0; right: 0;
        height: 3px;
        background: var(--accent, #6366f1);
        border-radius: 14px 14px 0 0;
      }
      .kpi-label {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: .08em;
        text-transform: uppercase;
        color: #8b92a9;
        margin-bottom: 6px;
      }
      .kpi-value {
        font-size: 20px;
        font-weight: 700;
        color: #1a1f36;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .kpi-card.danger  { --accent: #f43f5e; }
      .kpi-card.success { --accent: #10b981; }
      .kpi-card.neutral { --accent: #6366f1; }
 
      /* ── LAYOUT ── */
      .layout {
        display: grid;
        grid-template-columns: 1fr 300px;
        gap: 16px;
        align-items: start;
      }
 
      /* ── MAIN TABLE CARD ── */
      .card {
        background: #fff;
        border-radius: 16px;
        border: 1px solid #e8eaf0;
        overflow: hidden;
      }
      .card-header {
        padding: 16px 22px;
        border-bottom: 1px solid #f0f2f7;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .card-title {
        font-size: 13px;
        font-weight: 700;
        color: #1a1f36;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .badge {
        display: inline-flex;
        align-items: center;
        padding: 2px 8px;
        border-radius: 20px;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: .05em;
        text-transform: uppercase;
      }
      .badge-red   { background: #fff1f2; color: #f43f5e; }
      .badge-green { background: #f0fdf4; color: #10b981; }
      .badge-gray  { background: #f1f5f9; color: #64748b; }
 
      /* ── TABLE ── */
      table { width: 100%; border-collapse: collapse; }
      thead th {
        padding: 10px 22px;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: .07em;
        text-transform: uppercase;
        color: #8b92a9;
        background: #fafbfd;
        text-align: left;
        white-space: nowrap;
      }
      thead th.right { text-align: right; }
      thead th.center { text-align: center; }
 
      tbody tr { transition: background .15s; }
      tbody tr:hover { background: #fafbfd; }
 
      tbody td {
        padding: 12px 22px;
        font-size: 12.5px;
        border-bottom: 1px solid #f0f2f7;
        color: #374151;
        vertical-align: middle;
      }
      tbody tr:last-child td { border-bottom: none; }
 
      .td-name { font-weight: 600; color: #1a1f36; font-size: 13px; }
      .td-sub  { font-size: 10px; color: #9ca3af; font-weight: 500; margin-top: 2px; font-family: 'DM Mono', monospace; }
      .td-right { text-align: right; font-family: 'DM Mono', monospace; font-size: 12px; }
      .td-center { text-align: center; }
      .td-real  { font-weight: 600; color: #1a1f36; }
      .td-orc   { color: #6b7280; }
      .td-over  { color: #f43f5e; font-weight: 700; }
      .td-under { color: #10b981; font-weight: 700; }
 
      /* ── IMPACT BAR ── */
      .bar-wrap { width: 90px; margin: 0 auto; }
      .bar-bg {
        background: #f0f2f7;
        height: 5px;
        border-radius: 99px;
        overflow: hidden;
      }
      .bar-fill { height: 100%; border-radius: 99px; transition: width .4s ease; }
      .bar-red   { background: linear-gradient(90deg, #fda4af, #f43f5e); }
      .bar-green { background: linear-gradient(90deg, #6ee7b7, #10b981); }
      .bar-pct {
        font-size: 9px;
        color: #9ca3af;
        text-align: right;
        margin-top: 3px;
        font-family: 'DM Mono', monospace;
      }
 
      /* ── SIDEBAR ── */
      .sidebar { display: flex; flex-direction: column; gap: 14px; }
 
      /* Insight card */
      .insight-card {
        background: #1a1f36;
        border-radius: 16px;
        padding: 22px;
        position: relative;
        overflow: hidden;
      }
      .insight-watermark {
        position: absolute;
        right: -8px; bottom: -8px;
        font-size: 56px;
        font-weight: 900;
        color: rgba(255,255,255,.04);
        line-height: 1;
        user-select: none;
        pointer-events: none;
      }
      .insight-label {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: .08em;
        text-transform: uppercase;
        color: #6366f1;
        margin-bottom: 8px;
      }
      .insight-text {
        font-size: 12px;
        line-height: 1.7;
        color: #94a3b8;
      }
 
      /* Diretoria card */
      .dir-card {
        background: #fff;
        border-radius: 16px;
        border: 1px solid #e8eaf0;
        padding: 18px;
      }
      .dir-title {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: .07em;
        text-transform: uppercase;
        color: #8b92a9;
        margin-bottom: 12px;
        text-align: center;
      }
      .dir-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 9px 12px;
        border-radius: 10px;
        background: #f8fafc;
        margin-bottom: 8px;
      }
      .dir-item:last-child { margin-bottom: 0; }
      .dir-name { font-size: 11px; font-weight: 600; color: #374151; }
      .dir-val  { font-size: 11px; font-weight: 700; font-family: 'DM Mono', monospace; }
 
      /* Empty state */
      .empty {
        text-align: center;
        padding: 48px 24px;
        color: #9ca3af;
        font-size: 13px;
      }
      .empty-icon { font-size: 36px; margin-bottom: 10px; opacity: .4; }
 
      /* Responsive */
      @media (max-width: 900px) {
        .kpi-grid { grid-template-columns: repeat(2, 1fr); }
        .layout { grid-template-columns: 1fr; }
        .bar-wrap { width: 60px; }
      }
    </style>
 
    <!-- KPIs -->
    <div class="kpi-grid">
      <div class="kpi-card neutral">
        <div class="kpi-label">Realizado Total</div>
        <div class="kpi-value" id="kpiReal">—</div>
      </div>
      <div class="kpi-card neutral">
        <div class="kpi-label">Orçado Total</div>
        <div class="kpi-value" id="kpiOrc">—</div>
      </div>
      <div class="kpi-card" id="kpiDeltaCard">
        <div class="kpi-label">Variação (Delta)</div>
        <div class="kpi-value" id="kpiDelta">—</div>
      </div>
      <div class="kpi-card" id="kpiPctCard">
        <div class="kpi-label">% Desvio</div>
        <div class="kpi-value" id="kpiPct">—</div>
      </div>
    </div>
 
    <!-- Main layout -->
    <div class="layout">
 
      <!-- Table card -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            Principais Ofensores
            <span id="statusBadge" class="badge badge-gray">sem dados</span>
          </div>
        </div>
        <div style="overflow-x:auto">
          <table>
            <thead>
              <tr>
                <th>Estrutura de Custo</th>
                <th class="right">Realizado</th>
                <th class="right">Budget</th>
                <th class="right">Desvio</th>
                <th class="center">Impacto</th>
              </tr>
            </thead>
            <tbody id="tbody"></tbody>
          </table>
        </div>
      </div>
 
      <!-- Sidebar -->
      <div class="sidebar">
        <div class="insight-card">
          <div class="insight-watermark">G&A</div>
          <div class="insight-label">📊 Insight do Período</div>
          <div class="insight-text" id="insightText">
            Aguardando dados para gerar análise de performance.
          </div>
        </div>
        <div class="dir-card">
          <div class="dir-title">Impacto por Diretoria</div>
          <div id="dirList">
            <div class="empty"><div class="empty-icon">🏢</div>Sem dados</div>
          </div>
        </div>
      </div>
 
    </div>
  `;
 
  const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmtPct = v => (v > 0 ? '+' : '') + v.toFixed(1) + '%';
 
  class EvoStreamGATable extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this.shadowRoot.appendChild(tmpl.content.cloneNode(true));
      this._rows = null;
    }
 
    // ── Public API ──
    set rows(data) {
      this._rows = data;
      this._render(data);
    }
    get rows() { return this._rows; }
 
    // ── Render ──
    _render(data) {
      const root = this.shadowRoot;
 
      if (!data || !data.elements || !data.elements.length) {
        root.getElementById('tbody').innerHTML =
          `<tr><td colspan="5"><div class="empty"><div class="empty-icon">📂</div>Nenhum dado disponível.</div></td></tr>`;
        return;
      }
 
      const rows = data.elements.map(r => ({
        id:    r.id    ?? '',
        desc:  r.desc  ?? r.id ?? '—',
        real:  parseFloat(r.real)  || 0,
        orc:   parseFloat(r.orc)   || 0,
        delta: parseFloat(r.delta) || 0,
        area:  r.area  ?? '',
        dir:   r.dir   ?? 'Sem diretoria',
      }));
 
      const totalReal  = rows.reduce((s, r) => s + r.real, 0);
      const totalOrc   = rows.reduce((s, r) => s + r.orc,  0);
      const totalDelta = totalReal - totalOrc;
      const pct        = totalOrc !== 0 ? (totalDelta / totalOrc) * 100 : 0;
      const isOver     = totalDelta > 0;
 
      // KPIs
      root.getElementById('kpiReal').textContent  = fmt.format(totalReal);
      root.getElementById('kpiOrc').textContent   = fmt.format(totalOrc);
      root.getElementById('kpiDelta').textContent = fmt.format(totalDelta);
      root.getElementById('kpiPct').textContent   = fmtPct(pct);
 
      const deltaCard = root.getElementById('kpiDeltaCard');
      const pctCard   = root.getElementById('kpiPctCard');
      deltaCard.className = `kpi-card ${isOver ? 'danger' : 'success'}`;
      pctCard.className   = `kpi-card ${isOver ? 'danger' : 'success'}`;
 
      // Badge
      const badge = root.getElementById('statusBadge');
      if (isOver) {
        badge.textContent = 'Orçamento Estourado';
        badge.className   = 'badge badge-red';
      } else {
        badge.textContent = 'Eficiência Positiva';
        badge.className   = 'badge badge-green';
      }
 
      // Insight
      root.getElementById('insightText').textContent = isOver
        ? `Atenção: o gasto total excedeu o budget em ${fmt.format(Math.abs(totalDelta))} (${fmtPct(pct)}). Foque na contenção dos principais ofensores listados.`
        : `Ótimo resultado: o período encerrou com economia de ${fmt.format(Math.abs(totalDelta))} frente ao orçado (${fmtPct(Math.abs(pct))}). Os desvios pontuais não comprometeram a saúde financeira global.`;
 
      // Tabela
      const tbody = root.getElementById('tbody');
      tbody.innerHTML = '';
      const absMax = Math.max(...rows.map(r => Math.abs(r.delta)), 1);
 
      [...rows].sort((a, b) => b.delta - a.delta).forEach(r => {
        const over    = r.delta > 0;
        const barPct  = Math.min((Math.abs(r.delta) / absMax) * 100, 100).toFixed(0);
        const tr      = document.createElement('tr');
        tr.innerHTML  = `
          <td>
            <div class="td-name">${r.desc}</div>
            <div class="td-sub">${r.id}${r.area ? ' · ' + r.area : ''}</div>
          </td>
          <td class="td-right td-real">${fmt.format(r.real)}</td>
          <td class="td-right td-orc">${fmt.format(r.orc)}</td>
          <td class="td-right ${over ? 'td-over' : 'td-under'}">${fmt.format(r.delta)}</td>
          <td class="td-center">
            <div class="bar-wrap">
              <div class="bar-bg">
                <div class="bar-fill ${over ? 'bar-red' : 'bar-green'}" style="width:${barPct}%"></div>
              </div>
              <div class="bar-pct">${barPct}%</div>
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      });
 
      // Diretoria
      const dirMap = {};
      rows.forEach(r => { dirMap[r.dir] = (dirMap[r.dir] || 0) + r.delta; });
      const dirList = root.getElementById('dirList');
      dirList.innerHTML = '';
      Object.entries(dirMap)
        .sort((a, b) => b[1] - a[1])
        .forEach(([name, val]) => {
          const div = document.createElement('div');
          div.className = 'dir-item';
          div.innerHTML = `
            <span class="dir-name">${name}</span>
            <span class="dir-val ${val > 0 ? 'td-over' : 'td-under'}">${fmt.format(val)}</span>
          `;
          dirList.appendChild(div);
        });
    }
  }
 
  customElements.define('evostream-ga-table', EvoStreamGATable);
})();
