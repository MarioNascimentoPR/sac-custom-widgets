/* ==========================================================================
   EVOSTREAM PERFORMANCE SUMMARY WIDGET - CORE RUNTIME (PRODUCTION READY)
   ========================================================================== */

(function () {
  // CHAVE DE DESATIVAÇÃO OPERACIONAL: Altere para false para desligar 100% a Telemetria
  const ENABLE_TELEMETRY = true;

  /* ==========================================================================
     SUBSISTEMA ENCAPSULADO DE TELEMETRIA E PROFILING CIENTÍFICO (HEADLESS)
     ========================================================================== */
  class EvoStreamProfiler {
    constructor() {
      this.metrics = {
        totalCycle: 0, jsTime: 0, domTime: 0, fps: 60,
        steps: { parsing: 0, aggregation: 0, domCreation: 0, svgDrawing: 0, highlights: 0 },
        memory: 0, redundantRenders: 0, dataVolume: 0
      };
      this._lastDataSignature = "";
      this._fpsFrameCount = 0;
      this._fpsLastTime = performance.now();
    }

    _buildDataSignature(cubeData) {
      const rows = Array.isArray(cubeData) ? cubeData : (cubeData && cubeData.data);
      if (!Array.isArray(rows)) return "";
      let hash = 2166136261;
      const mix = (value) => {
        const text = String(value == null ? "" : value);
        for (let i = 0; i < text.length; i++) {
          hash ^= text.charCodeAt(i);
          hash = Math.imul(hash, 16777619);
        }
      };

      if (!Array.isArray(cubeData) && cubeData.metadata) {
        const metadata = cubeData.metadata;
        const dimensions = metadata.dimensions || {};
        const mainStructureMembers = metadata.mainStructureMembers || {};
        Object.keys(dimensions).forEach(key => {
          const dim = dimensions[key] || {};
          mix(key); mix(dim.id); mix(dim.description); mix(dim.label);
        });
        Object.keys(mainStructureMembers).forEach(key => {
          const measure = mainStructureMembers[key] || {};
          mix(key); mix(measure.id); mix(measure.description); mix(measure.label);
        });
      }

      mix(rows.length);
      rows.forEach(row => {
        if (!row) return;
        if (row.versionContext) {
          mix(row.versionContext.isActualMonth);
        }
        Object.keys(row).forEach(key => {
          const cell = row[key];
          mix(key);
          if (cell && typeof cell === "object") {
            mix(cell.id);
            mix(cell.label || cell.description);
            if (cell.properties) {
              mix(cell.properties.isCurrent);
            }
            mix(cell.formattedValue !== undefined ? cell.formattedValue : cell.raw);
          } else {
            mix(cell);
          }
        });
      });

      return `${rows.length}:${hash >>> 0}`;
    }

    verifyRedundancy(cubeData) {
      if (!ENABLE_TELEMETRY || !cubeData) return false;
      try {
        const signature = this._buildDataSignature(cubeData);
        if (!signature) return false;
        if (this._lastDataSignature === signature) {
          this.metrics.redundantRenders++;
          return true;
        }
        this._lastDataSignature = signature;
      } catch (e) { return false; }
      return false;
    }

    startFPSMonitor() {
      if (!ENABLE_TELEMETRY) return;
      this._fpsFrameCount = 0;
      this._fpsLastTime = performance.now();
      const run = () => {
        this._fpsFrameCount++;
        const now = performance.now();
        if (now - this._fpsLastTime >= 500) {
          this.metrics.fps = Math.round((this._fpsFrameCount * 1000) / (now - this._fpsLastTime));
          this._fpsFrameCount = 0;
          this._fpsLastTime = now;
        } else if (this._fpsFrameCount < 60) {
          requestAnimationFrame(run);
        }
      };
      requestAnimationFrame(run);
    }

    collectMemory() {
      if (!ENABLE_TELEMETRY) return;
      if (window.performance && performance.memory) {
        this.metrics.memory = performance.memory.usedJSHeapSize;
      }
    }

    runStressProjection(baseRows, sampleJSTime) {
      if (!baseRows || baseRows === 0) return { k10: 0, k25: 0, k50: 0, k100: 0 };
      const baseValue = sampleJSTime / baseRows;
      return {
        k10: baseValue * 10000 * 1.02,
        k25: baseValue * 25000 * 1.05,
        k50: baseValue * 50000 * 1.08,
        k100: baseValue * 100000 * 1.12
      };
    }
  }

  const template = document.createElement("template");
  template.innerHTML = `
    <style>
      :host {
        --color-actual: #1f77b4;
        --color-historical: #7f7f7f;
        --color-budget: #aec7e8;
        --font-size-labels: 12px;
        display: block; width: 100%; height: 100%; box-sizing: border-box; background: #ffffff;
      }
      #widget-wrapper {
        display: flex; flex-direction: column; width: 100%; height: 100%; padding: 14px 18px; box-sizing: border-box;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; position: relative; overflow: auto;
      }
      .widget-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; border-bottom: 1px solid #f0f0f0; padding-bottom: 8px; flex-shrink: 0; gap: 12px; }
      .header-left-block { display: flex; flex-direction: column; }
      .widget-title { font-size: 16px; font-weight: 700; color: #2c3e50; }
      .scale-tag { font-size: 10px; font-weight: 600; color: #7f8c8d; margin-top: 2px; }
      
      .filter-container-finance { position: relative; display: flex; align-items: center; gap: 8px; z-index: 100; }
      .filter-label-finance { font-size: 11px; font-weight: 600; color: #4a5568; }
      .tree-dropdown-trigger {
        font-size: 11px; font-weight: 700; color: #2d3748; background-color: #f8fafc; border: 1px solid #cbd5e0; border-radius: 6px; padding: 4px 28px 4px 10px; cursor: pointer; min-width: 120px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%234a5568'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E");
        background-repeat: no-repeat; background-position: right 8px center; background-size: 12px; user-select: none; text-overflow: ellipsis; white-space: nowrap; overflow: hidden;
      }
      .tree-dropdown-content {
        display: none; position: absolute; top: 100%; right: 0; margin-top: 4px; background: #ffffff; border: 1px solid #cbd5e0; border-radius: 6px; max-height: 260px; overflow-y: auto; min-width: 160px; padding: 6px 0;
      }
      .tree-dropdown-content.show { display: block; }
      .tree-year-node { font-weight: 700; color: #2d3748; padding: 6px 10px; cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 11px; user-select: none; }
      .tree-year-node:hover { background-color: #edf2f7; }
      .tree-year-node::before { content: '▶'; font-size: 8px; color: #718096; transition: transform 0.2s ease; display: inline-block; }
      .tree-year-node.expanded::before { transform: rotate(90deg); }
      .tree-months-container { display: none; flex-direction: column; padding-left: 14px; background: #f7fafc; }
      .tree-months-container.show { display: flex; }
      .tree-month-item { font-size: 11px; font-weight: 600; color: #4a5568; padding: 5px 12px; cursor: pointer; }
      .tree-month-item:hover { background-color: #e2e8f0; color: var(--color-actual); }
      .tree-month-item.selected { background-color: #edf2f7; color: var(--color-actual); font-weight: 700; }
      
      .telemetry-btn {
        font-size: 11px; font-weight: 700; color: #4a5568; background-color: #f1f5f9; border: 1px solid #cbd5e0; border-radius: 6px; padding: 4px 10px; cursor: pointer; display: flex; align-items: center; gap: 4px; transition: all 0.2s; user-select: none;
      }
      .telemetry-btn:hover { background-color: #e2e8f0; color: #1e293b; }
      .telemetry-modal {
        display: none; position: absolute; top: 48px; right: 18px; width: 330px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; z-index: 1000; padding: 14px; font-size: 11px; color: #334155;
      }
      .telemetry-modal.show { display: block; }
      .telemetry-title { font-size: 11.5px; font-weight: 700; color: #1e293b; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #edf2f7; padding-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
      .telemetry-close { background: none; border: none; font-size: 16px; cursor: pointer; color: #94a3b8; font-weight: 700; line-height: 1; }
      .telemetry-close:hover { color: #64748b; }
      .telemetry-section-title { font-size: 10px; font-weight: 700; color: #475569; text-transform: uppercase; margin: 10px 0 4px 0; background: #f1f5f9; padding: 2px 6px; border-radius: 3px; }
      .telemetry-row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dashed #f1f5f9; align-items: center; }
      .telemetry-label { font-weight: 600; color: #64748b; }
      .telemetry-val { font-weight: 700; color: #0f172a; font-variant-numeric: tabular-nums; background: #f8fafc; padding: 1px 6px; border-radius: 4px; border: 1px solid #e2e8f0; }
      .stress-table { width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 10.5px; }
      .stress-table th { text-align: left; background: #e2e8f0; color: #334155; padding: 3px 6px; font-weight: 700; }
      .stress-table td { padding: 4px 6px; border-bottom: 1px solid #edf2f7; font-weight: 600; }

      .widget-legend { display: flex; gap: 14px; margin-bottom: 12px; font-size: 10.5px; font-weight: 600; color: #4a5568; flex-shrink: 0; }
      .legend-item { display: flex; align-items: center; gap: 5px; }
      .legend-color { width: 10px; height: 10px; border-radius: 2px; }
      .legend-color.hist { background-color: var(--color-historical); }
      .legend-color.act { background-color: var(--color-actual); }
      .legend-color.bud { 
        background-color: #ffffff; border: 1px solid var(--color-budget); box-sizing: border-box;
        background-image: linear-gradient(45deg, var(--color-budget) 25%, transparent 25%, transparent 50%, var(--color-budget) 50%, var(--color-budget) 75%, transparent 75%, transparent);
        background-size: 4px 4px;
      }
      .main-visualization-layout { display: flex; width: 100%; gap: 24px; margin-bottom: 20px; flex-shrink: 0; align-items: stretch; }
      .visualization-column { display: flex; flex-direction: column; justify-content: flex-end; position: relative; }
      .visualization-column.monthly-col { flex: 3; }
      .visualization-column.ytd-col { flex: 1; border-left: 1px solid #e2e8f0; padding-left: 24px; }
      
      .chart-container-block { position: relative; height: 155px; padding-top: 45px; box-sizing: border-box; width: 100%; }
      .chart-area { width: 100%; height: 100%; display: flex; position: relative; align-items: flex-end; justify-content: center; gap: 20px; }
      
      .html-connectors-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1; overflow: visible; }
      .html-bracket-track { position: absolute; border-top: 1.25px solid #cbd5e0; border-left: 1.25px solid #cbd5e0; border-right: 1.25px solid #cbd5e0; pointer-events: none; box-sizing: border-box; }
      .html-bracket-badge-anchor { position: absolute; width: 70px; height: 22px; display: flex; justify-content: center; align-items: center; pointer-events: none; transform: translate(-35px, -11px); }

      .bar-wrapper { display: flex; flex-direction: column; align-items: center; width: 46px; height: 100%; justify-content: flex-end; position: relative; z-index: 2; }
      .bar-element { width: 100%; max-width: 46px; border-radius: 3px 3px 0 0; position: relative; display: flex; justify-content: center; bottom: 0px; height: 0%; transition: height 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
      .bar-element.historical { background-color: var(--color-historical); }
      .bar-element.actual { background-color: var(--color-actual); box-shadow: none; box-sizing: border-box; }
      .bar-element.budget {
        background-color: #ffffff; border: 1px solid var(--color-budget); box-sizing: border-box;
        background-image: linear-gradient(45deg, rgba(174, 199, 232, 0.4) 25%, transparent 25%, transparent 50%, rgba(174, 199, 232, 0.4) 50%, rgba(174, 199, 232, 0.4) 75%, transparent 75%, transparent);
        background-size: 6px 6px;
      }
      .kpi-label { position: absolute; top: -22px; font-size: calc(var(--font-size-labels) - 0.5px); font-weight: 700; color: #2d3748; white-space: nowrap; background: #ffffff; padding: 1px 4px; border-radius: 4px; z-index: 3; }
      .bar-element.actual .kpi-label { color: #1a202c; background: #edf2f7; top: -24px; }
      
      .axis-x-block { display: flex; flex-direction: column; flex-shrink: 0; border-top: 1px solid #cbd5e0; padding-top: 6px; width: 100%; }
      .axis-x { display: flex; justify-content: center; gap: 20px; height: 18px; }
      .axis-label { width: 46px; text-align: center; font-size: calc(var(--font-size-labels) - 1px); font-weight: 600; color: #718096; white-space: nowrap; }
      .axis-label.actual-month { color: var(--color-actual); font-weight: 700; }
      .variance-tag { font-size: calc(var(--font-size-labels) - 2px); font-weight: 700; padding: 1px 5px; border-radius: 3px; box-shadow: none; white-space: nowrap; display: inline-block; position: relative; z-index: 4; }
      .variance-tag.saving { background-color: #e6f4ea; color: #137333; border: 1px solid #ceead6; }
      .variance-tag.increase { background-color: #fce8e6; color: #c5221f; border: 1px solid #fad2cf; }
      
      .insight-grid { 
        display: grid; 
        grid-template-columns: 1fr 1.8fr; 
        gap: 24px; margin-top: auto; padding-top: 16px; border-top: 1px solid #e2e8f0; flex-shrink: 0; width: 100%; 
      }
      .grid-column-finance { display: flex; flex-direction: column; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; }
      .column-title-finance { font-size: 11px; font-weight: 700; color: #4a5568; text-transform: uppercase; letter-spacing: 0.75px; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 2px solid #cbd5e0; }
      
      .period-summary-banner {
        font-size: 11.5px; line-height: 1.5; color: #444444; margin: 0 0 12px 0; padding: 8px 12px;
        border-radius: 4px; border-left: 4px solid #cbd5e0; font-family: system-ui, -apple-system, sans-serif;
      }
      .period-summary-banner.summary-saving { background-color: #e8f5e9; color: #1b5e20; border-left-color: #2E7D32; }
      .period-summary-banner.summary-desvio { background-color: #ffebee; color: #b71c1c; border-left-color: #D32F2F; }

      .panel-content-rows { display: flex; flex-direction: column; gap: 1px; background-color: #e2e8f0; border-radius: 4px; overflow: hidden; }
      .data-row-item { display: grid; grid-template-columns: 1.8fr 1fr 1fr; align-items: center; background: #ffffff; padding: 8px 12px; font-size: calc(var(--font-size-labels) - 0.5px); color: #2d3748; gap: 8px; }
      .cell-label { font-weight: 600; color: #4a5568; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 6px; }
      .cell-label::before { content: ''; width: 4px; height: 12px; background: #cbd5e0; border-radius: 2px; display: inline-block; flex-shrink: 0; }
      .row-m-style .cell-label::before { background: var(--color-actual); }
      .row-ytd-style .cell-label::before { background: #2b6cb0; }
      .cell-value { text-align: right; font-variant-numeric: tabular-nums; font-weight: 700; color: #1e293b; white-space: nowrap; }
      .cell-status-wrapper { display: flex; justify-content: flex-end; align-items: center; }
      .status-badge-finance { font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 4px; text-align: center; white-space: nowrap; display: inline-flex; align-items: center; justify-content: center; min-width: 75px; box-sizing: border-box; }
      .status-badge-finance.success { background-color: #e6f4ea; color: #137333; border: 1px solid #ceead6; }
      .status-badge-finance.warning { background-color: #fce8e6; color: #c5221f; border: 1px solid #fad2cf; }
      .status-badge-finance.neutral { background-color: #f1f3f4; color: #5f6368; border: 1px solid #e8eaed; }
      
      .highlight-card-area { 
        display: flex; flex-direction: column; background: #F8F9FA; border: 1px solid #e2e8f0; 
        border-left: 4px solid #cbd5e0; border-radius: 8px; padding: 14px 16px; color: #333333;
      }
      .highlight-title-box { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; color: #1e293b; text-transform: uppercase; letter-spacing: 0.75px; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 2px solid #cbd5e0; }
      .ul-highlight { margin: 0; padding-left: 16px; font-size: 11.5px; color: #333333; line-height: 1.5; display: flex; flex-direction: column; gap: 8px; }
    </style>
    <div id="widget-wrapper">
      <div class="widget-header">
        <div class="header-left-block">
          <div class="widget-title" id="widgetTitle">Performance Summary</div>
          <div class="scale-tag">Valores em Milhões (M)</div>
        </div>
        <div class="filter-container-finance">
          <span class="filter-label-finance">Corte:</span>
          <div class="tree-dropdown-trigger" id="treeDropdownTrigger">Selecionar...</div>
          <div class="tree-dropdown-content" id="treeDropdownContent"></div>
          
          <button class="telemetry-btn" id="telemetryBtn" style="display: none;">📊 Telemetria</button>
          
          <div class="telemetry-modal" id="telemetryModal">
            <div class="telemetry-title">
              <span>Métricas de Performance</span>
              <button class="telemetry-close" id="closeTelemetry">×</button>
            </div>
            
            <div class="telemetry-section-title">Ciclo de Vida Total</div>
            <div class="telemetry-row"><span class="telemetry-label">Tempo Total Ciclo:</span><span class="telemetry-val" id="tmTotal">0.00 ms</span></div>
            <div class="telemetry-row"><span class="telemetry-label">Engine JS Puro:</span><span class="telemetry-val" id="tmJS">0.00 ms</span></div>
            <div class="telemetry-row"><span class="telemetry-label">Pintura e Layout:</span><span class="telemetry-val" id="tmDOM">0.00 ms</span></div>
            <div class="telemetry-row"><span class="telemetry-label">Estabilidade (FPS):</span><span class="telemetry-val" id="tmFPS">60 FPS</span></div>
            
            <div class="telemetry-section-title">Amostragem por Etapa</div>
            <div class="telemetry-row"><span class="telemetry-label">1. Ingestão e Parsing:</span><span class="telemetry-val" id="stParsing">0.00 ms</span></div>
            <div class="telemetry-row"><span class="telemetry-label">2. Agregação e Cubo:</span><span class="telemetry-val" id="stAggr">0.00 ms</span></div>
            <div class="telemetry-row"><span class="telemetry-label">3. Construção Base DOM:</span><span class="telemetry-val" id="stDOM">0.00 ms</span></div>
            <div class="telemetry-row"><span class="telemetry-label">4. Plotagem HTML Connectors:</span><span class="telemetry-val" id="stSVG">0.00 ms</span></div>
            <div class="telemetry-row"><span class="telemetry-label">5. Geração Highlights:</span><span class="telemetry-val" id="stHL">0.00 ms</span></div>
            
            <div class="telemetry-section-title">Diagnóstico de Saúde</div>
            <div class="telemetry-row"><span class="telemetry-label">Memória Heap V8:</span><span class="telemetry-val" id="tmMem">0.00 MB</span></div>
            <div class="telemetry-row"><span class="telemetry-label">Re-renders Redundantes:</span><span class="telemetry-val" id="tmRedund">0</span></div>
            <div class="telemetry-row"><span class="telemetry-label">Volume de Linhas SAC:</span><span class="telemetry-val" id="tmVol">0 rows</span></div>
            
            <div class="telemetry-section-title">Simulação de Estresse Operacional</div>
            <table class="stress-table">
              <thead><tr><th>Carga</th><th>Cenário Preditivo (JS)</th></tr></thead>
              <tbody>
                <tr><td>10k linhas</td><td id="st10k">-</td></tr>
                <tr><td>25k linhas</td><td id="st25k">-</td></tr>
                <tr><td>50k linhas</td><td id="st50k">-</td></tr>
                <tr><td>100k linhas</td><td id="st100k">-</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div class="widget-legend">
        <div class="legend-item"><div class="legend-color hist"></div> Histórico (Realizado)</div>
        <div class="legend-item"><div class="legend-color act"></div> Mês Atual (Realizado)</div>
        <div class="legend-item"><div class="legend-color bud"></div> Orçado (Budget)</div>
      </div>
      <div class="main-visualization-layout">
        <div class="monthly-col visualization-column">
          <div class="chart-container-block">
            <div class="html-connectors-overlay" id="monthlyConnectors"></div>
            <div class="chart-area" id="chartArea"></div>
          </div>
          <div class="axis-x-block"><div class="axis-x" id="axisX"></div></div>
        </div>
        <div class="visualization-column ytd-col">
          <div class="chart-container-block">
            <div class="html-connectors-overlay" id="ytdConnectors"></div>
            <div class="chart-area" id="ytdChartArea">
              <div class="bar-wrapper"><div class="bar-element historical" id="mini-bar-prev"><span class="kpi-label" id="mini-lbl-prev">-</span></div></div>
              <div class="bar-wrapper"><div class="bar-element actual" id="mini-bar-act"><span class="kpi-label" id="mini-lbl-act">-</span></div></div>
              <div class="bar-wrapper"><div class="bar-element budget" id="mini-bar-bud"><span class="kpi-label" id="mini-lbl-bud">-</span></div></div>
            </div>
          </div>
          <div class="axis-x-block">
            <div class="axis-x" id="ytdAxisX">
              <div class="axis-label" id="ytd-axis-lbl-prev">Ano Ant.</div>
              <div class="axis-label" id="ytd-axis-lbl-act">Ano Atual</div>
              <div class="axis-label">Meta YTD</div>
            </div>
          </div>
        </div>
      </div>
      <div class="insight-grid" id="insightGrid" style="display: none;">
        <div class="grid-column-finance">
          <div class="column-title-finance">Acompanhamento de Metas Orçamentárias</div>
          <div id="periodSummaryBanner" class="period-summary-banner" style="display: none;"></div>
          <div class="panel-content-rows">
            <div class="data-row-item row-m-style">
              <div class="cell-label">Desvio Mês (Real x Orçado)</div><div class="cell-value" id="val-diff-row">-</div>
              <div class="cell-status-wrapper"><span class="status-badge-finance" id="val-pct-row">-</span></div>
            </div>
            <div class="data-row-item row-m-style">
              <div class="cell-label">Consumo do Budget no Mês</div><div class="cell-value" id="val-pct-consumption-row">-</div>
              <div class="cell-status-wrapper"><span class="status-badge-finance neutral">Mês</span></div>
            </div>
            <div class="data-row-item row-ytd-style">
              <div class="cell-label">Desvio YTD (Real x Orçado)</div><div class="cell-value" id="ytd-diff-row">-</div>
              <div class="cell-status-wrapper"><span class="status-badge-finance" id="ytd-diff-pct-badge">-</span></div>
            </div>
            <div class="data-row-item row-ytd-style">
              <div class="cell-label">Consumo do Budget Período (YTD)</div><div class="cell-value" id="ytd-pct-row">-</div>
              <div class="cell-status-wrapper"><span class="status-badge-finance neutral">YTD</span></div>
            </div>
          </div>
        </div>
        <div class="highlight-card-area" id="highlightCardArea">
          <div class="highlight-title-box"><span class="highlight-icon-box">💡</span><span>Highlights</span></div>
          <div class="highlight-content-text" id="highlightContentText"></div>
        </div>
      </div>
    </div>
  `;

  /* ==========================================================================
     4 & 5. ENGINE DE INTELIGÊNCIA ANALÍTICA SANEADA (PURE HEADLESS)
     ========================================================================== */
  class EvoNarrativeEngine {
    constructor() {
      this._monthOrderMap = { "JAN":1, "FEB":2, "MAR":3, "APR":4, "MAY":5, "JUN":6, "JUL":7, "AUG":8, "SEP":9, "OCT":10, "NOV":11, "DEC":12 };
    }

    analyze(cubeData, targetNode, currentYear, previousYear, tempoDimId, versaoDimId, itemFinanceiroDimId, contaContabilDimId, measId, fullSeriesData, profiler) {
      const tStartAggregation = performance.now();
      const varianceTable = { month: {}, ytd: {} };
      const driverTable = [];
      const outlierTable = [];
      const rankingTable = [];

      let monthActual = targetNode.value;
      let monthBudget = targetNode.originalNode.orcado > 0 ? targetNode.originalNode.orcado : targetNode.originalNode.realizado;
      let monthDiff = monthActual - monthBudget;

      varianceTable.month = {
        actual: monthActual, budget: monthBudget, diffNominal: monthDiff,
        pctVar: monthBudget !== 0 ? (monthDiff / monthBudget) * 100 : 0,
        consumption: monthBudget !== 0 ? (monthActual / monthBudget) * 100 : 0,
        isSaving: monthDiff <= 0
      };

      let totalRealizadoYTDAtual = 0; let totalRealizadoYTDAntigo = 0; let totalBudgetYTDCompleto = 0;
      fullSeriesData.forEach(d => {
        if (d.yearValue === currentYear && d.monthNum <= targetNode.monthNum) {
          totalRealizadoYTDAtual += d.value;
          totalBudgetYTDCompleto += (d.originalNode ? d.originalNode.orcado : 0);
        }
        if (d.yearValue === previousYear && d.monthNum <= targetNode.monthNum) {
          totalRealizadoYTDAntigo += d.value;
        }
      });
      if (totalBudgetYTDCompleto === 0) totalBudgetYTDCompleto = totalRealizadoYTDAtual || 1;
      let ytdDiff = totalRealizadoYTDAtual - totalBudgetYTDCompleto;

      varianceTable.ytd = {
        actual: totalRealizadoYTDAtual, budget: totalBudgetYTDCompleto, previous: totalRealizadoYTDAntigo,
        diffNominal: ytdDiff, pctVar: totalBudgetYTDCompleto !== 0 ? (ytdDiff / totalBudgetYTDCompleto) * 100 : 0,
        consumption: totalBudgetYTDCompleto !== 0 ? (totalRealizadoYTDAtual / totalBudgetYTDCompleto) * 100 : 0,
        isSaving: ytdDiff <= 0
      };

      const fullSeriesById = new Map(fullSeriesData.map(d => [d.id, d]));
      const topCandidates = [];
      const topLimit = 200;

      cubeData.forEach((row, index) => {
        const rawValue = this._parseRawValue(row[measId] ? (row[measId].formattedValue || row[measId].raw || 0) : 0);
        const candidate = { row, weight: Math.abs(rawValue), index };

        if (topCandidates.length < topLimit) {
          topCandidates.push(candidate);
          return;
        }

        let minIdx = 0;
        for (let i = 1; i < topCandidates.length; i++) {
          if (
            topCandidates[i].weight < topCandidates[minIdx].weight ||
            (topCandidates[i].weight === topCandidates[minIdx].weight && topCandidates[i].index > topCandidates[minIdx].index)
          ) {
            minIdx = i;
          }
        }

        if (candidate.weight > topCandidates[minIdx].weight) {
          topCandidates[minIdx] = candidate;
        }
      });

      topCandidates.sort((a, b) => (b.weight - a.weight) || (a.index - b.index));
      const topImpactRows = topCandidates.map(item => item.row);

      const itemFinanceiroMap = {};

      topImpactRows.forEach(row => {
        if (!tempoDimId || !itemFinanceiroDimId) return;
        const tObj = row[tempoDimId]; if (!tObj) return;
        
        const rowMonthNode = fullSeriesById.get(String(tObj.id));
        if (!rowMonthNode || rowMonthNode.yearValue !== currentYear || rowMonthNode.monthNum > targetNode.monthNum) return;

        const itemObj = row[itemFinanceiroDimId];
        const itemName = itemObj ? (itemObj.label || itemObj.description || itemObj.id || "Outros") : "Outros";
        const itemUpper = itemName.toUpperCase();

        if (
          itemUpper.includes("TOTAL") || itemUpper.includes("ALL_MEMBERS") || 
          itemUpper.includes("(ALL)") || itemUpper === "OUTROS" || 
          itemUpper.includes("RATEIO") || itemUpper.includes("LIQUIDA")
        ) return;

        let contaName = "Geral";
        if (contaContabilDimId && row[contaContabilDimId]) {
          contaName = row[contaContabilDimId].label || row[contaContabilDimId].description || row[contaContabilDimId].id || "Geral";
        }
        const contaUpper = contaName.toUpperCase();
        if (contaUpper.includes("RATEIO") || contaUpper.includes("LIQUIDA")) return;

        if (!itemFinanceiroMap[itemName]) {
          itemFinanceiroMap[itemName] = { realizado: 0, orcado: 0, contas: {} };
        }

        const rawValue = this._parseRawValue(row[measId] ? (row[measId].formattedValue || row[measId].raw || 0) : 0);
        let isBudget = false;
        if (versaoDimId && row[versaoDimId]) {
          const vId = String(row[versaoDimId].id).toUpperCase();
          const vLabel = String(row[versaoDimId].label || row[versaoDimId].description || "").toUpperCase();
          if (vId.includes("ORÇADO") || vId.includes("ORCADO") || vId.includes("BUDGET") || vLabel.includes("ORÇADO") || vLabel.includes("BUDGET")) {
            isBudget = true;
          }
        }

        if (isBudget) { itemFinanceiroMap[itemName].orcado += rawValue; } 
        else { itemFinanceiroMap[itemName].realizado += rawValue; }

        if (!itemFinanceiroMap[itemName].contas[contaName]) {
          itemFinanceiroMap[itemName].contas[contaName] = { realizado: 0, orcado: 0 };
        }
        if (isBudget) { itemFinanceiroMap[itemName].contas[contaName].orcado += rawValue; } 
        else { itemFinanceiroMap[itemName].contas[contaName].realizado += rawValue; }
      });

      Object.keys(itemFinanceiroMap).forEach(name => {
        const item = itemFinanceiroMap[name];
        const desvioNominal = item.realizado - item.orcado;
        const variancePct = item.orcado !== 0 ? (desvioNominal / item.orcado) * 100 : 0;

        let driverContaName = ""; let maxContaImpact = -1;
        Object.keys(item.contas).forEach(cName => {
          const cImpact = item.contas[cName].realizado - item.contas[cName].orcado;
          if (Math.abs(cImpact) > maxContaImpact) {
            maxContaImpact = Math.abs(cImpact);
            driverContaName = cName;
          }
        });

        let driverImpactValue = 0;
        if (driverContaName && item.contas[driverContaName]) {
          driverImpactValue = item.contas[driverContaName].realizado - item.contas[driverContaName].orcado;
        }

        const featureRow = {
          itemName: name, realizado: item.realizado, budget: item.orcado,
          desvio: desvioNominal, pctVar: variancePct, isSaving: desvioNominal <= 0,
          driverConta: driverContaName, driverImpact: driverImpactValue,
          score: Math.abs(desvioNominal)
        };

        driverTable.push(featureRow);
        if (Math.abs(desvioNominal) > 1000) { outlierTable.push(featureRow); }
      });

      rankingTable.push(...outlierTable);
      rankingTable.sort((a, b) => b.score - a.score);

      if (ENABLE_TELEMETRY && profiler) {
        profiler.metrics.steps.aggregation = performance.now() - tStartAggregation;
      }

      return { varianceTable, driverTable, outlierTable: rankingTable, rankingTable };
    }

    _parseRawValue(val) {
      if (typeof val === 'number') return val;
      if (!val || val === "-") return 0;
      return parseFloat(String(val).replace(/[^0-9.,-]/g, '').replace(',', '.')) || 0;
    }
  }

  /* ==========================================================================
     UI LAYER CONTROLLER WIDGET LAYER
     ========================================================================== */
  class EvoSummaryWidget extends HTMLElement {
    constructor() {
      super();
      this._props = {};
      this._currentData = null;
      this._shadowRoot = null;
      this._resizeTimeout = null;
      this._selectedCutoffId = null;
      this._isTreeBuilt = false; 
      this._isDropdownOpen = false; 
      this._yearRegex = /\d{4}/;
      this._monthOrderMap = { "JAN":1, "FEB":2, "MAR":3, "APR":4, "MAY":5, "JUN":6, "JUL":7, "AUG":8, "SEP":9, "OCT":10, "NOV":11, "DEC":12 };
      this._ytdSeriesMock = [{ value: 0, type: "historical" }, { value: 0, type: "actual" }, { value: 0, type: "budget" }];
      
      this._updateQueued = false;
      this._layoutUpdateQueued = false;
      this._analyticsEngine = new EvoNarrativeEngine();
      this._profiler = new EvoStreamProfiler();

      this._metadataSignature = "";
      this._metadataContext = null;
      this._seriesCache = null;
      this._lastVisualState = null;
      this._analysisCache = null;
      this._dataSignature = "";
      this._lastHighlightKey = "";
      this._lastPeriodSummaryKey = "";

      this._tempoDimId = null;
      this._versaoDimId = null;
      this._itemFinanceiroDimId = null;
      this._contaContabilDimId = null;
      this._extraDimIds = [];
      this._reflowCount = 0;

      this._boundWindowClick = (e) => {
        const path = e.composedPath();
        if (this._isDropdownOpen && !path.includes(this._treeDropdownTrigger) && !path.includes(this._treeDropdownContent)) {
          this._isDropdownOpen = false;
          this._toggleDropdownDOM();
        }
        if (this._telemetryModal && this._telemetryModal.classList.contains("show") && !path.includes(this._telemetryBtn) && !path.includes(this._telemetryModal)) {
          this._telemetryModal.classList.remove("show");
        }
      };
    }

    connectedCallback() {
      if (!this._shadowRoot) {
        this._shadowRoot = this.attachShadow({ mode: "open" });
        this._shadowRoot.appendChild(template.content.cloneNode(true));
        
        this._chartArea = this._shadowRoot.getElementById("chartArea");
        this._ytdChartArea = this._shadowRoot.getElementById("ytdChartArea");
        this._monthlyConnectors = this._shadowRoot.getElementById("monthlyConnectors");
        this._ytdConnectors = this._shadowRoot.getElementById("ytdConnectors");
        this._axisX = this._shadowRoot.getElementById("axisX");
        this._insightGrid = this._shadowRoot.getElementById("insightGrid");
        this._treeDropdownTrigger = this._shadowRoot.getElementById("treeDropdownTrigger");
        this._treeDropdownContent = this._shadowRoot.getElementById("treeDropdownContent");
        this._widgetTitle = this._shadowRoot.getElementById("widgetTitle");
        this._periodSummaryBanner = this._shadowRoot.getElementById("periodSummaryBanner");
        
        this._telemetryBtn = this._shadowRoot.getElementById("telemetryBtn");
        this._telemetryModal = this._shadowRoot.getElementById("telemetryModal");
        this._closeTelemetry = this._shadowRoot.getElementById("closeTelemetry");
        this._lblTotal = this._shadowRoot.getElementById("tmTotal");
        this._lblJS = this._shadowRoot.getElementById("tmJS");
        this._lblDOM = this._shadowRoot.getElementById("tmDOM");
        this._lblFPS = this._shadowRoot.getElementById("tmFPS");
        this._lblParsing = this._shadowRoot.getElementById("stParsing");
        this._lblAggr = this._shadowRoot.getElementById("stAggr");
        this._lblStepDOM = this._shadowRoot.getElementById("stDOM");
        this._lblStepSVG = this._shadowRoot.getElementById("stSVG");
        this._lblStepHL = this._shadowRoot.getElementById("stHL");
        this._lblMem = this._shadowRoot.getElementById("tmMem");
        this._lblRedund = this._shadowRoot.getElementById("tmRedund");
        this._lblVol = this._shadowRoot.getElementById("tmVol");
        
        this._st10k = this._shadowRoot.getElementById("st10k");
        this._st25k = this._shadowRoot.getElementById("st25k");
        this._st50k = this._shadowRoot.getElementById("st50k");
        this._st100k = this._shadowRoot.getElementById("st100k");

        this._valDiffRow = this._shadowRoot.getElementById("val-diff-row");
        this._valPctRow = this._shadowRoot.getElementById("val-pct-row");
        this._valPctConsumptionRow = this._shadowRoot.getElementById("val-pct-consumption-row");
        this._ytdDiffRow = this._shadowRoot.getElementById("ytd-diff-row");
        this._ytdDiffPctBadge = this._shadowRoot.getElementById("ytd-diff-pct-badge");
        this._ytdPctRow = this._shadowRoot.getElementById("ytd-pct-row");
        this._highlightContentText = this._shadowRoot.getElementById("highlightContentText");
        this._highlightCardArea = this._shadowRoot.getElementById("highlightCardArea");

        // 🛠️ MAPEAMENTO SEGURO DAS MINI BARRAS ESTÁTICAS DE ACORDO COM O TEMPLATE
        this._miniBarPrev = this._shadowRoot.getElementById("mini-bar-prev");
        this._miniBarAct = this._shadowRoot.getElementById("mini-bar-act");
        this._miniBarBud = this._shadowRoot.getElementById("mini-bar-bud");
        this._miniLblPrev = this._shadowRoot.getElementById("mini-lbl-prev");
        this._miniLblAct = this._shadowRoot.getElementById("mini-lbl-act");
        this._miniLblBud = this._shadowRoot.getElementById("mini-lbl-bud");

        if (ENABLE_TELEMETRY) {
          this._telemetryBtn.style.display = "flex";
          this._telemetryBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            this._telemetryModal.classList.toggle("show");
          });
          this._closeTelemetry.addEventListener("click", () => {
            this._telemetryModal.classList.remove("show");
          });
          this._profiler.startFPSMonitor();
        }

        this._treeDropdownTrigger.addEventListener("click", (e) => {
          e.stopPropagation();
          this._isDropdownOpen = !this._isDropdownOpen;
          this._toggleDropdownDOM();
        });

        this._initStaticHighlightsDOM();
      }

      window.addEventListener("click", this._boundWindowClick);

      this._resizeObserver = new ResizeObserver(() => {
        if (!document.contains(this)) return;
        clearTimeout(this._resizeTimeout);
        this._resizeTimeout = setTimeout(() => {
          this.requestLayoutUpdate();
        }, 40);
      });
      this._resizeObserver.observe(this._chartArea);
    }

    disconnectedCallback() {
      if (this._resizeObserver) this._resizeObserver.disconnect();
      window.removeEventListener("click", this._boundWindowClick);
      clearTimeout(this._resizeTimeout);
    }

    requestUpdate() {
      if (this._updateQueued) return;
      this._updateQueued = true;
      requestAnimationFrame(() => {
        this.renderChart();
        this._updateQueued = false;
      });
    }

    requestLayoutUpdate() {
      if (this._layoutUpdateQueued || !this._lastVisualState) return;
      this._layoutUpdateQueued = true;
      requestAnimationFrame(() => {
        const tSVGStart = performance.now();
        this._redrawConnectorsOnly();
        if (ENABLE_TELEMETRY) {
          this._profiler.metrics.steps.svgDrawing = performance.now() - tSVGStart;
          if (this._lblStepSVG) this._setText(this._lblStepSVG, `${this._profiler.metrics.steps.svgDrawing.toFixed(2)} ms`);
        }
        this._layoutUpdateQueued = false;
      });
    }

    _redrawConnectorsOnly() {
      if (!this._lastVisualState || !document.contains(this) || !this._shadowRoot) return;
      this._reflowCount++;
      this._drawUnifiedFlatConnections(this._monthlyConnectors, this._chartArea, ".bar-element", this._lastVisualState.visibleSeriesData, this._lastVisualState.visibleActualIndex, "monthly");
      this._drawUnifiedFlatConnections(this._ytdConnectors, this._ytdChartArea, ".bar-element", this._ytdSeriesMock, 1, "ytd");
    }

    _setText(node, value) {
      if (!node) return;
      const text = String(value);
      if (node.textContent !== text) node.textContent = text;
    }

    _setClass(node, value) {
      if (node && node.className !== value) node.className = value;
    }

    _setStyle(node, prop, value) {
      if (node && node.style[prop] !== value) node.style[prop] = value;
    }

    _initStaticHighlightsDOM() {
      this._hlUl = document.createElement("ul");
      this._hlUl.className = "ul-highlight";
      this._highlightContentText.textContent = "";
      this._highlightContentText.appendChild(this._hlUl);
    }

    _toggleDropdownDOM() {
      if (this._treeDropdownContent) {
        this._treeDropdownContent.classList.toggle("show", this._isDropdownOpen);
      }
    }

    onCustomWidgetBeforeUpdate(changedProperties) {
      this._props = { ...this._props, ...changedProperties };
    }

    onCustomWidgetAfterUpdate(changedProperties) {
      this._updateStyles();
      if ("performanceCube" in changedProperties && this.performanceCube) {
        if (this._profiler.verifyRedundancy(this.performanceCube)) {
          if (ENABLE_TELEMETRY) this._lblRedund.textContent = this._profiler.metrics.redundantRenders;
          return; 
        }

        this._currentData = this.performanceCube;
        this._dataSignature = this._profiler._lastDataSignature || this._profiler._buildDataSignature(this.performanceCube);
        this._selectedCutoffId = null;
        this._isTreeBuilt = false; 
        this._seriesCache = null;
        this._lastVisualState = null;
        this._analysisCache = null;
        this._lastHighlightKey = "";
        this._lastPeriodSummaryKey = "";
        if (this._shadowRoot) {
          this._treeDropdownContent.textContent = ""; 
          this.requestUpdate();
        }
      }
    }

    _updateStyles() {
      if (!this._shadowRoot) return;
      const style = this.style;
      if (this._props.colorActualMonth) style.setProperty("--color-actual", this._props.colorActualMonth);
      if (this._props.colorHistorical) style.setProperty("--color-historical", this._props.colorHistorical);
      if (this._props.colorBudget) style.setProperty("--color-budget", this._props.colorBudget);
      if (this._props.fontSizeLabels) style.setProperty("--font-size-labels", `${this._props.fontSizeLabels}px`);
    }

    _parseValue(val) {
      if (typeof val === 'number') return val;
      if (!val || val === "-") return 0;
      return parseFloat(String(val).replace(/[^0-9.,-]/g, '').replace(',', '.')) || 0;
    }

    _getMetadataContext(metadata) {
      const dimensions = metadata.dimensions || {};
      const mainStructureMembers = metadata.mainStructureMembers || {};
      const dimKeys = Object.keys(dimensions);
      const measureKeys = Object.keys(mainStructureMembers);

      if (dimKeys.length < 1 || measureKeys.length < 1) return null;

      const signatureParts = [];
      dimKeys.forEach(key => {
        const dim = dimensions[key] || {};
        signatureParts.push(key, dim.id || "", dim.description || "", dim.label || "");
      });
      measureKeys.forEach(key => {
        const measure = mainStructureMembers[key] || {};
        signatureParts.push(key, measure.id || "", measure.description || "", measure.label || "");
      });

      const metadataSignature = signatureParts.join("|");
      if (this._metadataContext && this._metadataSignature === metadataSignature) {
        return this._metadataContext;
      }

      const measId = measureKeys[0];
      let tempoDimId = null;
      let versaoDimId = null;
      let itemFinanceiroDimId = null;
      let contaContabilDimId = null;

      dimKeys.forEach(key => {
        const desc = String(dimensions[key].description || "").toUpperCase();
        const id = String(dimensions[key].id || "").toUpperCase();
        
        if (desc.includes("VERSÃO") || desc.includes("VERSION") || desc.includes("CENÁRIO") || id.includes("VERSION") || id.includes("CATEGORY")) {
          versaoDimId = key;
        } else if (desc.includes("TEMPO") || desc.includes("MÊS") || desc.includes("MES") || desc.includes("ANO") || desc.includes("DATE") || id.includes("TIME") || id.includes("CALENDAR")) {
          tempoDimId = key;
        } else if (desc.includes("ITEM") || id.includes("ITEM") || desc.includes("FINANCEIRO")) {
          itemFinanceiroDimId = key;
        } else if (desc.includes("CONTA") || id.includes("ACCOUNT") || desc.includes("CONTÁBIL") || desc.includes("CONTABIL")) {
          contaContabilDimId = key;
        }
      });

      if (!tempoDimId) tempoDimId = dimKeys[0];
      if (!versaoDimId) versaoDimId = dimKeys[1] || null;

      const extraDimIds = dimKeys.filter(key => key !== tempoDimId && key !== versaoDimId);
      if (!itemFinanceiroDimId) itemFinanceiroDimId = extraDimIds[0] || null;
      if (!contaContabilDimId) contaContabilDimId = extraDimIds[1] || null;

      const measureInfo = mainStructureMembers[measId] || {};
      const context = {
        dimKeys,
        measureKeys,
        measId,
        measureInfo,
        tempoDimId,
        versaoDimId,
        itemFinanceiroDimId,
        contaContabilDimId,
        extraDimIds
      };

      this._metadataSignature = metadataSignature;
      this._metadataContext = context;
      return context;
    }

    renderChart() {
      if (!document.contains(this) || !this._shadowRoot) return;
      
      const tArrivalData = performance.now();

      const residualPlaceholder = this._axisX.querySelector(".placeholder-text");
      if (residualPlaceholder) residualPlaceholder.remove();

      const financialData = this._currentData;
      if (!financialData || !financialData.data || financialData.data.length === 0) {
        this._axisX.textContent = "";
        const placeholder = document.createElement("div");
        placeholder.className = "placeholder-text";
        placeholder.textContent = "Aguardando dados estruturados...";
        this._axisX.appendChild(placeholder);
        return;
      }

      try {
        const tParsingStart = performance.now();
        const metadata = financialData.metadata;
        const metadataContext = this._getMetadataContext(metadata);
        if (!metadataContext) return;

        this._measId = metadataContext.measId;
        this._tempoDimId = metadataContext.tempoDimId;
        this._versaoDimId = metadataContext.versaoDimId;
        this._itemFinanceiroDimId = metadataContext.itemFinanceiroDimId;
        this._contaContabilDimId = metadataContext.contaContabilDimId;
        this._extraDimIds = metadataContext.extraDimIds;
        
        const measureInfo = metadataContext.measureInfo || {};
        const indicatorLabel = measureInfo.label || measureInfo.description || measureInfo.id || "Indicador";
        if (this._widgetTitle) {
          this._widgetTitle.textContent = `Overview - ${indicatorLabel}`;
        }

        const nowRuntime = new Date();
        const currentYearRuntime = nowRuntime.getFullYear();
        let targetMonthNum = nowRuntime.getMonth(); 
        let targetYearNum = nowRuntime.getFullYear();
        
        if (targetMonthNum === 0) {
          targetMonthNum = 12; 
          targetYearNum -= 1;
        }

        const runtimeCutoffKey = `${targetYearNum}-${targetMonthNum}`;
        let fullSeriesData;
        let defaultActualIndex = -1;

        if (
          this._seriesCache &&
          this._seriesCache.sourceData === financialData &&
          this._seriesCache.metadataSignature === this._metadataSignature &&
          this._seriesCache.runtimeCutoffKey === runtimeCutoffKey
        ) {
          fullSeriesData = this._seriesCache.fullSeriesData;
          defaultActualIndex = this._seriesCache.defaultActualIndex;
        } else {
          const timelineMap = {};

          financialData.data.forEach(row => {
            const tempoObj = row[this._tempoDimId]; if (!tempoObj) return;
            const tId = String(tempoObj.id); 
            if (tId.toLowerCase().includes("(all)")) return;
            
            const tLabel = tempoObj.label || tempoObj.description || tId;
            if (tLabel.toLowerCase().includes("(all)")) return;

            if (!timelineMap[tId]) {
              timelineMap[tId] = { id: tId, label: tLabel, realizado: 0, orcado: 0, isCurrentMonth: false, rowContext: row };
            }
            if (tempoObj.properties && (tempoObj.properties.isCurrent === "true" || tempoObj.properties.isCurrent === true)) { timelineMap[tId].isCurrentMonth = true; }
            if (row.versionContext && row.versionContext.isActualMonth) { timelineMap[tId].isCurrentMonth = true; }

            const rawValue = this._parseValue(row[this._measId] ? (row[this._measId].formattedValue || row[this._measId].raw || 0) : 0);
            if (this._versaoDimId) {
              const vObj = row[this._versaoDimId];
              if (vObj) {
                const vId = String(vObj.id).toUpperCase(); 
                const vLabel = String(vObj.label || vObj.description || "").toUpperCase();
                if (vId.includes("ORÇADO") || vId.includes("ORCADO") || vId.includes("BUDGET") || vLabel.includes("ORÇADO") || vLabel.includes("BUDGET")) { 
                  timelineMap[tId].orcado += rawValue; 
                } else { 
                  timelineMap[tId].realizado += rawValue; 
                }
              }
            } else { timelineMap[tId].realizado += rawValue; }
          });

          const sortedMonths = Object.values(timelineMap);
          if (sortedMonths.length === 0) return;

          fullSeriesData = [];

          sortedMonths.forEach((m) => {
            let parsedYear = currentYearRuntime;
            const matches = m.id.match(this._yearRegex);
            if (matches) {
              parsedYear = parseInt(matches[0]);
            } else {
              const labelDigits = m.label.match(this._yearRegex);
              if (labelDigits) parsedYear = parseInt(labelDigits[0]);
            }

            if (parsedYear < 2022 || parsedYear > 2028) return;

            const cleanLabelUpper = String(m.label).substring(0, 3).toUpperCase();
            const targetMonthIndex = this._monthOrderMap[cleanLabelUpper] || 1;
            const alignedLabel = `${m.label.substring(0,3)} ${String(parsedYear).substring(2, 4)}`;

            fullSeriesData.push({ 
              id: m.id, label: alignedLabel, value: m.realizado, type: m.isCurrentMonth ? "actual" : "historical", originalNode: m, yearValue: parsedYear, monthNum: targetMonthIndex, rawRow: m.rowContext 
            });
          });

          fullSeriesData.sort((a, b) => {
            if (a.yearValue !== b.yearValue) return a.yearValue - b.yearValue;
            return a.monthNum - b.monthNum;
          });

          let dynamicIdx = fullSeriesData.findIndex(d => d.yearValue === targetYearNum && d.monthNum === targetMonthNum);
          
          if (dynamicIdx !== -1) {
            defaultActualIndex = dynamicIdx;
          } else {
            fullSeriesData.forEach((d, idx) => {
              if (d.type === "actual") defaultActualIndex = idx;
            });
            if (defaultActualIndex === -1 && fullSeriesData.length > 0) {
              defaultActualIndex = fullSeriesData.length - 1;
            }
          }

          this._seriesCache = {
            sourceData: financialData,
            metadataSignature: this._metadataSignature,
            runtimeCutoffKey,
            fullSeriesData,
            defaultActualIndex
          };
        }

        if (fullSeriesData.length === 0) return;

        if (!this._isTreeBuilt && fullSeriesData.length > 0) {
          this._treeDropdownContent.textContent = ""; 
          const yearsMap = {};
          
          fullSeriesData.forEach(d => {
            if (!yearsMap[d.yearValue]) {
              const yearNode = document.createElement("div");
              yearNode.className = "tree-year-node";
              yearNode.textContent = `Ano ${d.yearValue}`;
              const monthsContainer = document.createElement("div");
              monthsContainer.className = "tree-months-container";
              
              yearNode.addEventListener("click", (e) => {
                e.stopPropagation();
                yearNode.classList.toggle("expanded");
                monthsContainer.classList.toggle("show");
              });

              this._treeDropdownContent.appendChild(yearNode);
              this._treeDropdownContent.appendChild(monthsContainer);
              yearsMap[d.yearValue] = monthsContainer;
            }

            const monthItem = document.createElement("div");
            monthItem.className = "tree-month-item";
            monthItem.textContent = d.label;
            monthItem.setAttribute("data-id", d.id);
            
            monthItem.addEventListener("click", (e) => {
              e.stopPropagation();
              this._selectedCutoffId = d.id;
              this._isDropdownOpen = false; 
              this._toggleDropdownDOM();
              this.requestUpdate();
            });

            yearsMap[d.yearValue].appendChild(monthItem);
          });

          if (!this._selectedCutoffId && fullSeriesData[defaultActualIndex]) {
            this._selectedCutoffId = fullSeriesData[defaultActualIndex].id;
          }
          this._isTreeBuilt = true; 
        }

        let actualIndex = fullSeriesData.findIndex(d => d.id === this._selectedCutoffId);
        if (actualIndex === -1) actualIndex = defaultActualIndex;

        if (fullSeriesData[actualIndex]) {
          this._treeDropdownTrigger.textContent = fullSeriesData[actualIndex].label;
        }

        const dropdownItems = this._treeDropdownContent.querySelectorAll(".tree-month-item");
        dropdownItems.forEach(item => {
          item.classList.toggle("selected", item.getAttribute("data-id") === this._selectedCutoffId);
        });

        fullSeriesData.forEach((d, idx) => {
          d.type = (idx === actualIndex) ? "actual" : "historical";
        });

        const targetBudgetSource = fullSeriesData[actualIndex].originalNode;
        const calculatedBudget = targetBudgetSource.orcado > 0 ? targetBudgetSource.orcado : targetBudgetSource.realizado;

        const startIndex = Math.max(0, actualIndex - 11); 
        const visibleSeriesData = fullSeriesData.slice(startIndex, actualIndex + 1);

        let visibleActualIndex = visibleSeriesData.findIndex(d => d.id === this._selectedCutoffId);
        if (visibleActualIndex === -1) visibleActualIndex = visibleSeriesData.length - 1;

        visibleSeriesData.push({
          label: `Bud. ${fullSeriesData[actualIndex].label.split(' ')[0]}`, value: calculatedBudget, type: "budget", yearValue: fullSeriesData[actualIndex].yearValue, monthNum: fullSeriesData[actualIndex].monthNum
        });

        const maxVal = Math.max(...visibleSeriesData.map(d => d.value)) * 1.10 || 1;

        if (ENABLE_TELEMETRY) {
          this._profiler.metrics.steps.parsing = performance.now() - tParsingStart;
        }

        // RECONCILIAÇÃO DO DOM DE ALTA PERFORMANCE (SEM LIMPEZA DESTRUTIVA)
        const tDOMStart = performance.now();
        this._reconcileBarsAndLabels(visibleSeriesData, maxVal);
        if (ENABLE_TELEMETRY) {
          this._profiler.metrics.steps.domCreation = performance.now() - tDOMStart;
        }

        this._renderDoubleFinancePanel(visibleSeriesData, fullSeriesData, actualIndex, calculatedBudget);
        this._lastVisualState = { visibleSeriesData, visibleActualIndex };

        const tDOMPaintStart = performance.now();
        requestAnimationFrame(() => {
          const tSVGStart = performance.now();
          
          this._redrawConnectorsOnly();
          
          if (ENABLE_TELEMETRY) {
            this._profiler.metrics.steps.svgDrawing = performance.now() - tSVGStart;
            this._profiler.collectMemory();

            const tFinalPaint = performance.now();
            const jsTotalTime = tEndJS - tArrivalData;
            const domTotalTime = tFinalPaint - tDOMPaintStart;

            this._lblTotal.textContent = `${(tFinalPaint - tArrivalData).toFixed(2)} ms`;
            this._lblJS.textContent = `${jsTotalTime.toFixed(2)} ms`;
            this._lblDOM.textContent = `${domTotalTime.toFixed(2)} ms`;
            this._lblFPS.textContent = `${this._profiler.metrics.fps} FPS`;
            
            this._lblParsing.textContent = `${this._profiler.metrics.steps.parsing.toFixed(2)} ms`;
            this._lblAggr.textContent = `${this._profiler.metrics.steps.aggregation.toFixed(2)} ms`;
            this._lblStepDOM.textContent = `${this._profiler.metrics.steps.domCreation.toFixed(2)} ms`;
            this._lblStepSVG.textContent = `${this._profiler.metrics.steps.svgDrawing.toFixed(2)} ms`;
            this._lblStepHL.textContent = `${this._profiler.metrics.steps.highlights.toFixed(2)} ms`;
            
            this._lblMem.textContent = `${(this._profiler.metrics.memory / 1024 / 1024).toFixed(2)} MB`;
            this._lblVol.textContent = `${financialData.data.length} rows`;

            const stressProjections = this._profiler.runStressProjection(financialData.data.length, jsTotalTime);
            this._st10k.textContent = `${stressProjections.k10.toFixed(2)} ms`;
            this._st25k.textContent = `${stressProjections.k25.toFixed(2)} ms`;
            this._st50k.textContent = `${stressProjections.k50.toFixed(2)} ms`;
            this._st100k.textContent = `${stressProjections.k100.toFixed(2)} ms`;
          }
        });

      } catch (error) {
        console.error("Erro interno no processamento visual:", error);
      }
      const tEndJS = performance.now();
    }

    /* ==========================================================================
       RECONCILIAÇÃO DO POOL DO DOM MENSAL (BLINDADO)
       ========================================================================== */
    _reconcileBarsAndLabels(visibleSeriesData, maxVal) {
      const existingWrappers = this._chartArea.querySelectorAll(".bar-wrapper");
      const existingLabels = this._axisX.querySelectorAll(".axis-label");
      const targetLength = visibleSeriesData.length;

      if (existingWrappers.length < targetLength) {
        for (let i = existingWrappers.length; i < targetLength; i++) {
          const wrapper = document.createElement("div"); wrapper.className = "bar-wrapper";
          const bar = document.createElement("div"); bar.className = "bar-element";
          const label = document.createElement("span"); label.className = "kpi-label";
          bar.appendChild(label); wrapper.appendChild(bar); this._chartArea.appendChild(wrapper);
        }
      } else if (existingWrappers.length > targetLength) {
        for (let i = existingWrappers.length - 1; i >= targetLength; i--) { existingWrappers[i].remove(); }
      }

      if (existingLabels.length < targetLength) {
        for (let i = existingLabels.length; i < targetLength; i++) {
          const axisLabel = document.createElement("div"); axisLabel.className = "axis-label";
          this._axisX.appendChild(axisLabel);
        }
      } else if (existingLabels.length > targetLength) {
        for (let i = existingLabels.length - 1; i >= targetLength; i--) { existingLabels[i].remove(); }
      }

      const updatedWrappers = this._chartArea.querySelectorAll(".bar-wrapper");
      const updatedLabels = this._axisX.querySelectorAll(".axis-label");

      visibleSeriesData.forEach((d, idx) => {
        const bar = updatedWrappers[idx].querySelector(".bar-element");
        const label = bar.querySelector(".kpi-label");
        
        this._setClass(bar, `bar-element ${d.type}`);
        this._setStyle(bar, "height", `${(d.value / maxVal) * 100}%`);
        this._setText(label, `${(d.value / 1000000).toFixed(2)}M`);

        const axisLabel = updatedLabels[idx];
        this._setClass(axisLabel, d.type === "actual" ? "axis-label actual-month" : "axis-label");
        this._setText(axisLabel, d.label);
      });
    }

    _drawUnifiedFlatConnections(overlayContainer, chartArea, barSelector, dataArray, actualIndex, mode) {
      if (!document.contains(this) || !this._shadowRoot || actualIndex === -1) return;
      
      const containerHeight = chartArea.offsetHeight; if (containerHeight === 0) return;
      const barElements = chartArea.querySelectorAll(barSelector); if (!barElements || barElements.length === 0) return;
      
      const barCenters = Array.from(barElements).map(bar => {
        if (!bar) return 0;
        return bar.parentElement.offsetLeft + bar.offsetLeft + (bar.offsetWidth / 2);
      });
      
      const pairs = [];
      if (mode === "monthly") {
        if (actualIndex > 0) pairs.push({ from: actualIndex - 1, to: actualIndex });
        if (actualIndex < barElements.length - 1) pairs.push({ from: actualIndex, to: actualIndex + 1 });
      } else if (mode === "ytd") {
        pairs.push({ from: 0, to: 1 }); pairs.push({ from: 1, to: 2 });
      }

      const drawablePairs = [];
      pairs.forEach((pair) => {
        const xFrom = barCenters[pair.from];
        const xTo = barCenters[pair.to];
        if (xFrom === 0 || xTo === 0) return;
        
        const itemFrom = dataArray[pair.from];
        const itemTo = dataArray[pair.to];
        
        let isCostSaving = false;
        let variancePercent = 0;
        let directionalArrow = "";

        if (itemTo.type === "budget") {
          const diff = itemFrom.value - itemTo.value;
          isCostSaving = diff <= 0;
          variancePercent = itemTo.value !== 0 ? (diff / itemTo.value) * 100 : 0;
          directionalArrow = isCostSaving ? "▼ " : "▲ ";
        } else {
          const diff = itemTo.value - itemFrom.value;
          isCostSaving = diff <= 0;
          variancePercent = itemFrom.value !== 0 ? (diff / itemFrom.value) * 100 : 0;
          directionalArrow = isCostSaving ? "▼ " : "▲ ";
        }

        const varianceText = directionalArrow + Math.abs(variancePercent).toFixed(2) + "%";

        const leftX = Math.min(xFrom, xTo);
        const trackWidth = Math.abs(xTo - xFrom);
        const ceilingY = 24;
        const midX = leftX + (trackWidth / 2);

        drawablePairs.push({
          leftX,
          midX,
          trackWidth,
          ceilingY,
          height: containerHeight - ceilingY - 24,
          tagClass: isCostSaving ? "variance-tag saving" : "variance-tag increase",
          varianceText
        });
      });

      let tracks = Array.from(overlayContainer.querySelectorAll(".html-bracket-track"));
      let badges = Array.from(overlayContainer.querySelectorAll(".html-bracket-badge-anchor"));

      while (tracks.length > drawablePairs.length) {
        const node = tracks.pop();
        if (node) node.remove();
      }
      while (badges.length > drawablePairs.length) {
        const node = badges.pop();
        if (node) node.remove();
      }

      const fragment = document.createDocumentFragment();
      while (tracks.length < drawablePairs.length) {
        const trackDiv = document.createElement("div");
        trackDiv.className = "html-bracket-track";
        tracks.push(trackDiv);
        fragment.appendChild(trackDiv);
      }
      while (badges.length < drawablePairs.length) {
        const badgeAnchor = document.createElement("div");
        badgeAnchor.className = "html-bracket-badge-anchor";
        const spanTag = document.createElement("span");
        badgeAnchor.appendChild(spanTag);
        badges.push(badgeAnchor);
        fragment.appendChild(badgeAnchor);
      }
      if (fragment.childNodes.length > 0) {
        overlayContainer.appendChild(fragment);
      }

      drawablePairs.forEach((item, idx) => {
        const trackDiv = tracks[idx];
        const badgeAnchor = badges[idx];
        let spanTag = badgeAnchor.querySelector("span");
        if (!spanTag) {
          spanTag = document.createElement("span");
          badgeAnchor.appendChild(spanTag);
        }

        this._setStyle(trackDiv, "left", `${item.leftX}px`);
        this._setStyle(trackDiv, "top", `${item.ceilingY}px`);
        this._setStyle(trackDiv, "width", `${item.trackWidth}px`);
        this._setStyle(trackDiv, "height", `${item.height}px`);

        this._setStyle(badgeAnchor, "left", `${item.midX}px`);
        this._setStyle(badgeAnchor, "top", `${item.ceilingY}px`);
        this._setClass(spanTag, item.tagClass);
        this._setText(spanTag, item.varianceText);
      });
    }

    _renderDoubleFinancePanel(visibleSeriesData, fullSeriesData, actualIndex, budgetVal) {
      const currentBarNode = fullSeriesData[actualIndex]; const actualVal = currentBarNode.value; 
      const monthLabel = currentBarNode.label.split(' ')[0];
      const currentYear = currentBarNode.yearValue; const previousYear = currentYear - 1;

      const diffNominal = actualVal - budgetVal;
      const diffPercent = budgetVal !== 0 ? (diffNominal / budgetVal) * 100 : 0;
      const consumptionMonthPercent = budgetVal !== 0 ? (actualVal / budgetVal) * 100 : 0;
      const isMonthSaving = diffNominal <= 0;
      
      const formatM = (v) => (v / 1000000).toFixed(2) + "M";
      const formatPercent = (v, isSaving) => (isSaving ? "▼ " : "▲ ") + Math.abs(v).toFixed(2) + "%";

      this._setText(this._valDiffRow, (diffNominal >= 0 ? "+" : "") + formatM(diffNominal));
      this._setText(this._valPctRow, formatPercent(diffPercent, isMonthSaving));
      this._setClass(this._valPctRow, "status-badge-finance " + (isMonthSaving ? "success" : "warning"));
      this._setText(this._valPctConsumptionRow, consumptionMonthPercent.toFixed(2) + "%");

      let totalRealizadoYTDAtual = 0; let totalRealizadoYTDAntigo = 0; let totalBudgetYTDCompleto = 0;

      fullSeriesData.forEach((d, idx) => {
        if (idx <= actualIndex) {
          if (d.yearValue === currentYear) {
            totalRealizadoYTDAtual += d.value;
            totalBudgetYTDCompleto += (d.originalNode ? d.originalNode.orcado : 0);
          }
        }
        if (d.yearValue === previousYear && d.monthNum <= currentBarNode.monthNum) {
          totalRealizadoYTDAntigo += d.value;
        }
      });

      if (totalBudgetYTDCompleto === 0) totalBudgetYTDCompleto = totalRealizadoYTDAtual || 1;

      const diffYtdNominal = totalRealizadoYTDAtual - totalBudgetYTDCompleto;
      const diffYtdPercent = totalBudgetYTDCompleto !== 0 ? (diffYtdNominal / totalBudgetYTDCompleto) * 100 : 0;
      const consumoBudgetPercent = (totalRealizadoYTDAtual / totalBudgetYTDCompleto) * 100;
      const isYtdSaving = diffYtdNominal <= 0;

      this._setText(this._ytdDiffRow, (diffYtdNominal >= 0 ? "+" : "") + formatM(diffYtdNominal));
      this._setText(this._ytdDiffPctBadge, formatPercent(diffYtdPercent, isYtdSaving));
      this._setClass(this._ytdDiffPctBadge, "status-badge-finance " + (isYtdSaving ? "success" : "warning"));
      this._setText(this._ytdPctRow, consumoBudgetPercent.toFixed(2) + "%");

      // 🛠️ ATUALIZAÇÃO DIRETA E BLINDADA: Mini barras atualizadas de forma segura e sem apagar o DOM
      const maxYTD = Math.max(totalRealizadoYTDAntigo, totalRealizadoYTDAtual, totalBudgetYTDCompleto) * 1.10 || 1;
      
      this._setStyle(this._miniBarPrev, "height", `${(totalRealizadoYTDAntigo / maxYTD) * 100}%`);
      this._setStyle(this._miniBarAct, "height", `${(totalRealizadoYTDAtual / maxYTD) * 100}%`);
      this._setStyle(this._miniBarBud, "height", `${(totalBudgetYTDCompleto / maxYTD) * 100}%`);

      this._setText(this._miniLblPrev, formatM(totalRealizadoYTDAntigo));
      this._setText(this._miniLblAct, formatM(totalRealizadoYTDAtual));
      this._setText(this._miniLblBud, formatM(totalBudgetYTDCompleto));

      this._setText(this._shadowRoot.getElementById("ytd-axis-lbl-prev"), `Ant. (${previousYear})`);
      this._setText(this._shadowRoot.getElementById("ytd-axis-lbl-act"), `Atual (${currentYear})`);

      this._ytdSeriesMock = [{ value: totalRealizadoYTDAntigo, type: "historical" }, { value: totalRealizadoYTDAtual, type: "actual" }, { value: totalBudgetYTDCompleto, type: "budget" }];

      if (this._highlightCardArea) {
        this._setStyle(this._highlightCardArea, "borderLeft", isYtdSaving ? "4px solid #2E7D32" : "4px solid #D32F2F");
      }

      if (this._periodSummaryBanner) {
        const periodSummaryKey = [
          isYtdSaving,
          diffYtdNominal,
          diffYtdPercent,
          consumoBudgetPercent
        ].join("|");

        this._setStyle(this._periodSummaryBanner, "display", "block");
        this._setClass(this._periodSummaryBanner, isYtdSaving ? "period-summary-banner summary-saving" : "period-summary-banner summary-desvio");
        if (this._lastPeriodSummaryKey !== periodSummaryKey) {
          this._lastPeriodSummaryKey = periodSummaryKey;
          this._periodSummaryBanner.textContent = "";

          this._periodSummaryBanner.appendChild(document.createTextNode("No acumulado YTD, o projeto opera "));
          const spanYtdStatus = document.createElement("strong");
          spanYtdStatus.textContent = isYtdSaving ? "abaixo do teto orçamentário (eficiência) " : "acima da meta prevista (atenção) ";
          this._periodSummaryBanner.appendChild(spanYtdStatus);

          this._periodSummaryBanner.appendChild(document.createTextNode("com variação de "));
          const spanYtdDelta = document.createElement("strong");
          spanYtdDelta.textContent = `R$ ${Math.abs(diffYtdNominal/1000000).toFixed(2)}M (${diffYtdNominal >= 0 ? "+" : ""}${diffYtdPercent.toFixed(1)}%)`;
          this._periodSummaryBanner.appendChild(spanYtdDelta);
          this._periodSummaryBanner.appendChild(document.createTextNode(`, absorvendo ${consumoBudgetPercent.toFixed(1)}% do orçamento total.`));
        }
      }

      const highlightKey = [
        this._dataSignature,
        this._metadataSignature,
        currentBarNode.id,
        actualVal,
        budgetVal,
        totalRealizadoYTDAntigo,
        totalRealizadoYTDAtual,
        totalBudgetYTDCompleto
      ].join("|");

      if (this._lastHighlightKey === highlightKey && this._hlUl.childNodes.length > 0) {
        if (ENABLE_TELEMETRY) {
          this._profiler.metrics.steps.highlights = 0;
        }
        this._setStyle(this._insightGrid, "display", "grid");
        return;
      }

      this._lastHighlightKey = highlightKey;
      this._hlUl.textContent = "";

      const monthStatusText = diffNominal <= 0 ? "economia de custos" : "estouro orçamentário";
      const semanticColorMonth = diffNominal <= 0 ? "#2E7D32" : "#D32F2F";
      const semanticColorCons = consumptionMonthPercent > 100 ? "#D32F2F" : (consumptionMonthPercent > 90 ? "#EF6C00" : "#2E7D32");

      const liMonth = document.createElement("li");
      const s1 = document.createElement("strong"); s1.textContent = `Mês Corrente (${monthLabel}): `;
      const statusSpan1 = document.createElement("span"); statusSpan1.textContent = monthStatusText; statusSpan1.style.color = semanticColorMonth; statusSpan1.style.fontWeight = "700";
      liMonth.appendChild(s1); liMonth.appendChild(document.createTextNode("Fechamento com ")); liMonth.appendChild(statusSpan1); 
      liMonth.appendChild(document.createTextNode(` de R$ ${Math.abs(diffNominal/1000000).toFixed(2)}M.`));
      this._hlUl.appendChild(liMonth);

      const liCons = document.createElement("li");
      const s2 = document.createElement("strong"); s2.textContent = "Consumo Operacional: ";
      const statusSpan2 = document.createElement("span"); statusSpan2.textContent = `${consumptionMonthPercent.toFixed(1)}%`; statusSpan2.style.color = semanticColorCons; statusSpan2.style.fontWeight = "700";
      liCons.appendChild(s2); liCons.appendChild(document.createTextNode("A absorção atingiu ")); liCons.appendChild(statusSpan2); liCons.appendChild(document.createTextNode(" do orçamento da competência."));
      this._hlUl.appendChild(liCons);

      const tHLStart = performance.now();
      let analysis;
      if (this._analysisCache && this._analysisCache.key === highlightKey) {
        analysis = this._analysisCache.analysis;
      } else {
        analysis = this._analyticsEngine.analyze(
          this._currentData.data, currentBarNode, currentYear, previousYear,
          this._tempoDimId, this._versaoDimId, this._itemFinanceiroDimId, this._contaContabilDimId, this._measId, fullSeriesData, this._profiler
        );
        this._analysisCache = { key: highlightKey, analysis };
      }

      analysis.outlierTable.forEach(item => {
        const statusText = item.isSaving ? "economia operacional" : "desvio adverso";
        const semanticColor = item.isSaving ? "#2E7D32" : "#D32F2F";
        const directionalArrow = item.isSaving ? "▼ " : "▲ ";

        const liItem = document.createElement("li");
        const sLabel = document.createElement("strong"); sLabel.textContent = `${item.itemName}: `;
        liItem.appendChild(sLabel);

        liItem.appendChild(document.createTextNode("O acumulado YTD consolidou "));
        const spanStatus = document.createElement("span"); spanStatus.textContent = statusText; spanStatus.style.color = semanticColor; spanStatus.style.fontWeight = "700";
        liItem.appendChild(spanStatus);

        liItem.appendChild(document.createTextNode(` de R$ ${Math.abs(item.desvio/1000000).toFixed(2)}M (${directionalArrow}${Math.abs(item.pctVar).toFixed(2)}%), registrando Realizado de R$ ${(item.realizado/1000000).toFixed(2)}M contra orçamento de R$ ${(item.budget/1000000).toFixed(2)}M.`));

        if (item.driverConta && Math.abs(item.driverImpact) > 0) {
          const cSaving = item.driverImpact <= 0;
          const cColor = cSaving ? "#2E7D32" : "#D32F2F";
          
          liItem.appendChild(document.createTextNode(" O principal driver desse comportamento foi a natureza de "));
          const spanConta = document.createElement("span"); spanConta.textContent = item.driverConta; spanConta.style.fontWeight = "700";
          liItem.appendChild(spanConta); liItem.appendChild(document.createTextNode(" com um impacto de "));
          
          const spanContaDiff = document.createElement("span");
          spanContaDiff.textContent = `${item.driverImpact >= 0 ? "+" : ""}${(item.driverImpact/1000000).toFixed(2)}M`;
          spanContaDiff.style.color = cColor; spanContaDiff.style.fontWeight = "700";
          liItem.appendChild(spanContaDiff); liItem.appendChild(document.createTextNode("."));
        }

        this._hlUl.appendChild(liItem);
      });

      if (ENABLE_TELEMETRY) {
        this._profiler.metrics.steps.highlights = performance.now() - tHLStart;
      }

      this._setStyle(this._insightGrid, "display", "grid");
    }

    getColorActualMonth() { return this._props.colorActualMonth; }
    setColorActualMonth(value) { this._props.colorActualMonth = value; }
    getColorHistorical() { return this._props.colorHistorical; }
    setColorHistorical(value) { this._props.colorHistorical = value; }
    getColorBudget() { return this._props.colorBudget; }
    setColorBudget(value) { this._props.colorBudget = value; }
    getFontSizeLabels() { return this._props.fontSizeLabels; }
    setFontSizeLabels(value) { this._props.fontSizeLabels = value; }
  }
  
  if (!customElements.get("sac-summary")) {
    customElements.define("sac-summary", EvoSummaryWidget);
  }
})();
