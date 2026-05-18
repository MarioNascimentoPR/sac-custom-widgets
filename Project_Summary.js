(function () {
  const template = document.createElement("template");
  template.innerHTML = `
    <style>
      :host {
        --color-actual: #1f77b4;
        --color-historical: #7f7f7f;
        --color-budget: #aec7e8;
        --font-size-labels: 12px;
        
        display: block;
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        background: #ffffff;
      }
      
      #widget-wrapper {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        padding: 14px 18px;
        box-sizing: border-box;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        position: relative;
        overflow-y: auto;
        overflow-x: hidden;
      }

      .widget-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 14px;
        border-bottom: 1px solid #f0f0f0;
        padding-bottom: 8px;
        flex-shrink: 0;
        gap: 12px;
      }

      .header-left-block {
        display: flex;
        flex-direction: column;
      }

      .widget-title {
        font-size: 13px;
        font-weight: 700;
        color: #2c3e50;
      }

      .filter-container-finance {
        position: relative;
        display: flex;
        align-items: center;
        gap: 6px;
        z-index: 100;
      }

      .filter-label-finance {
        font-size: 11px;
        font-weight: 600;
        color: #4a5568;
      }

      .tree-dropdown-trigger {
        font-size: 11px;
        font-weight: 700;
        color: #2d3748;
        background-color: #f8fafc;
        border: 1px solid #cbd5e0;
        border-radius: 6px;
        padding: 4px 28px 4px 10px;
        cursor: pointer;
        min-width: 120px;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%234a5568'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 8px center;
        background-size: 12px;
        user-select: none;
        text-overflow: ellipsis;
        white-space: nowrap;
        overflow: hidden;
      }

      .tree-dropdown-content {
        display: none;
        position: absolute;
        top: 100%;
        right: 0;
        margin-top: 4px;
        background: #ffffff;
        border: 1px solid #cbd5e0;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        max-height: 260px;
        overflow-y: auto;
        min-width: 160px;
        padding: 6px 0;
      }

      .tree-dropdown-content.show { display: block; }

      .tree-year-node {
        font-weight: 700;
        color: #2d3748;
        padding: 6px 10px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        user-select: none;
      }
      .tree-year-node:hover { background-color: #edf2f7; }
      .tree-year-node::before {
        content: '▶'; font-size: 8px; color: #718096; transition: transform 0.2s ease; display: inline-block;
      }
      .tree-year-node.expanded::before { transform: rotate(90deg); }

      .tree-months-container {
        display: none; flex-direction: column; padding-left: 14px; background: #f7fafc;
      }
      .tree-months-container.show { display: flex; }

      .tree-month-item { font-size: 11px; font-weight: 600; color: #4a5568; padding: 5px 12px; cursor: pointer; }
      .tree-month-item:hover { background-color: #e2e8f0; color: var(--color-actual); }
      .tree-month-item.selected { background-color: #edf2f7; color: var(--color-actual); font-weight: 700; }

      .scale-tag { font-size: 10px; font-weight: 600; color: #7f8c8d; margin-top: 2px; }

      .widget-legend {
        display: flex; gap: 14px; margin-bottom: 12px; font-size: 10.5px; font-weight: 600; color: #4a5568; flex-shrink: 0;
      }
      .legend-item { display: flex; align-items: center; gap: 5px; }
      .legend-color { width: 10px; height: 10px; border-radius: 2px; }
      .legend-color.hist { background-color: var(--color-historical); }
      .legend-color.act { background-color: var(--color-actual); }
      .legend-color.bud { 
        background-color: transparent; border: 1px solid var(--color-budget); box-sizing: border-box;
        background-image: linear-gradient(45deg, var(--color-budget) 25%, transparent 25%, transparent 50%, var(--color-budget) 50%, var(--color-budget) 75%, transparent 75%, transparent);
        background-size: 4px 4px;
      }

      .main-visualization-layout {
        display: flex; width: 100%; gap: 24px; margin-bottom: 20px; flex-shrink: 0; align-items: stretch;
      }
      .visualization-column { display: flex; flex-direction: column; justify-content: flex-end; }
      .visualization-column.monthly-col { flex: 3; }
      .visualization-column.ytd-col { flex: 1; border-left: 1px solid #e2e8f0; padding-left: 24px; }

      .ytd-chart-header-title {
        font-size: 11px; font-weight: 700; color: #4a5568; text-transform: uppercase; margin-bottom: auto; padding-bottom: 4px; letter-spacing: 0.5px;
      }
      
      .chart-container-block {
        position: relative; height: 145px; padding-top: 32px; box-sizing: border-box; width: 100%;
      }
      .chart-area {
        width: 100%; height: 100%; display: flex; position: relative; align-items: flex-end; justify-content: center; gap: 20px; 
      }
      .svg-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 2; }
      
      .bar-wrapper {
        display: flex; flex-direction: column; align-items: center; width: 46px; height: 100%; justify-content: flex-end; position: relative; z-index: 1;
      }
      .bar-element {
        width: 100%; max-width: 46px; border-radius: 3px 3px 0 0; position: relative; display: flex; justify-content: center; bottom: 0px;
      }
      .bar-element.historical { background-color: var(--color-historical); }
      .bar-element.actual {
        background-color: var(--color-actual); box-shadow: 0 0 10px rgba(31, 119, 180, 0.35); border: 1px solid #15517b; box-sizing: border-box;
      }
      .bar-element.budget {
        background-color: transparent; border: 1px solid var(--color-budget); border-bottom: 1px solid var(--color-budget); box-sizing: border-box;
        background-image: linear-gradient(45deg, rgba(174, 199, 232, 0.4) 25%, transparent 25%, transparent 50%, rgba(174, 199, 232, 0.4) 50%, rgba(174, 199, 232, 0.4) 75%, transparent 75%, transparent);
        background-size: 6px 6px;
      }
      
      .kpi-label { position: absolute; top: -20px; font-size: calc(var(--font-size-labels) - 0.5px); font-weight: 700; color: #2d3748; white-space: nowrap; }
      .bar-element.actual .kpi-label { color: #1a202c; background: #edf2f7; padding: 1px 4px; border-radius: 4px; top: -22px; }
      
      .axis-x-block { display: flex; flex-direction: column; flex-shrink: 0; border-top: 1px solid #cbd5e0; padding-top: 6px; width: 100%; }
      .axis-x { display: flex; justify-content: center; gap: 20px; height: 18px; }
      .axis-label { width: 46px; text-align: center; font-size: calc(var(--font-size-labels) - 1px); font-weight: 600; color: #718096; white-space: nowrap; }
      .axis-label.actual-month { color: var(--color-actual); font-weight: 700; }
      
      .variance-tag {
        font-size: calc(var(--font-size-labels) - 2px); font-weight: 700; padding: 1px 5px; border-radius: 3px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); white-space: nowrap; border: 1px solid transparent; display: inline-block;
      }
      .variance-tag.saving { background-color: #e6f4ea; color: #137333; border-color: #ceead6; }
      .variance-tag.increase { background-color: #fce8e6; color: #c5221f; border-color: #fad2cf; }

      /* ==========================================================================
         REFATORAÇÃO COMPLETA: GRID FINANCEIRO EXECUTIVO UNIFICADO
         ========================================================================== */
      .insight-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 32px;
        margin-top: auto;
        padding-top: 16px;
        border-top: 1px solid #e2e8f0;
        flex-shrink: 0;
        width: 100%;
      }
      @media (max-width: 768px) { .insight-grid { grid-template-columns: 1fr; gap: 20px; } }

      .grid-column-finance {
        display: flex;
        flex-direction: column;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 14px 16px;
      }

      .column-title-finance {
        font-size: 11px;
        font-weight: 700;
        color: #4a5568;
        text-transform: uppercase;
        letter-spacing: 0.75px;
        margin-bottom: 12px;
        padding-bottom: 6px;
        border-bottom: 2px solid #cbd5e0;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .panel-content-rows {
        display: flex;
        flex-direction: column;
        gap: 1px;
        background-color: #e2e8f0; /* Cria linhas divisórias nativas e sutis */
        border-radius: 4px;
        overflow: hidden;
      }

      .data-row-item {
        display: grid;
        grid-template-columns: 2.2fr 1.2fr 1.1fr;
        align-items: center;
        background: #ffffff;
        padding: 8px 12px;
        font-size: calc(var(--font-size-labels) - 0.5px);
        color: #2d3748;
      }

      .data-row-item.row-main-highlight {
        background: #f1f5f9;
        font-weight: 700;
      }
      .data-row-item.row-main-highlight .cell-label {
        color: #0f172a;
      }

      .data-row-item.row-summary-conclusion {
        background: #edf2f7;
        font-weight: 700;
        border-top: 1px solid #cbd5e0;
      }

      .cell-label {
        font-weight: 600;
        color: #4a5568;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      
      /* Marcadores visuais padronizados */
      .cell-label::before {
        content: ''; width: 4px; height: 12px; background: #cbd5e0; border-radius: 2px; display: inline-block; flex-shrink: 0;
      }
      .row-main-highlight .cell-label::before { background: var(--color-actual); }
      .row-comparison-style { color: #2b6cb0; }
      .row-comparison-style .cell-label::before { background: #2b6cb0; }

      .cell-value {
        text-align: right;
        font-variant-numeric: tabular-nums;
        font-weight: 600;
        color: #1e293b;
      }
      .row-main-highlight .cell-value { color: #0f172a; font-weight: 700; }

      .cell-status-wrapper {
        display: flex;
        justify-content: flex-end;
        align-items: center;
      }

      /* Badges e Status Semânticos Alinhados */
      .status-badge-finance {
        font-size: 10px;
        font-weight: 700;
        padding: 3px 8px;
        border-radius: 4px;
        text-align: center;
        white-space: nowrap;
        display: inline-block;
        min-width: 65px;
        box-sizing: border-box;
      }
      .status-badge-finance.success { background-color: #e6f4ea; color: #137333; border: 1px solid #ceead6; }
      .status-badge-finance.neutral { background-color: #f1f3f4; color: #5f6368; border: 1px solid #e8eaed; }
      .status-badge-finance.warning { background-color: #fce8e6; color: #c5221f; border: 1px solid #fad2cf; }

      .placeholder-text { padding: 10px; font-size: 12px; color: #718096; font-weight: 500; text-align: center; width: 100%; }
    </style>
    
    <div id="widget-wrapper">
      <div class="widget-header">
        <div class="header-left-block">
          <div class="widget-title">Performance Mensal</div>
          <div class="scale-tag">Valores em Milhões (M)</div>
        </div>
        <div class="filter-container-finance">
          <span class="filter-label-finance">Corte:</span>
          <div class="tree-dropdown-trigger" id="treeDropdownTrigger">Selecionar...</div>
          <div class="tree-dropdown-content" id="treeDropdownContent"></div>
        </div>
      </div>
      
      <div class="widget-legend">
        <div class="legend-item"><div class="legend-color hist"></div> Histórico (Realizado)</div>
        <div class="legend-item"><div class="legend-color act"></div> Mês Atual (Realizado)</div>
        <div class="legend-item"><div class="legend-color bud"></div> Orçado (Budget)</div>
      </div>

      <div class="main-visualization-layout">
        <div class="visualization-column monthly-col">
          <div class="chart-container-block">
            <div class="chart-area" id="chartArea">
              <svg class="svg-overlay" id="svgOverlay">
                <defs>
                  <marker id="arrow-neutral" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#718096"/>
                  </marker>
                </defs>
              </svg>
            </div>
          </div>
          <div class="axis-x-block">
            <div class="axis-x" id="axisX"></div>
          </div>
        </div>

        <div class="visualization-column ytd-col">
          <div class="ytd-chart-header-title">Evolução YTD Acumulada</div>
          <div class="chart-container-block">
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

      <!-- PAINEL REESTRUTURADO E PADRONIZADO VIA CSS GRID -->
      <div class="insight-grid" id="insightGrid" style="display: none;">
        
        <!-- Bloco de Visão Mensal -->
        <div class="grid-column-finance">
          <div class="column-title-finance" id="title-col-current">Mês Atual</div>
          <div class="panel-content-rows">
            <div class="data-row-item row-main-highlight">
              <div class="cell-label" id="lbl-act-row">Realizado Comercial</div>
              <div class="cell-value" id="val-act-row">-</div>
              <div class="cell-status-wrapper"><span class="status-badge-finance neutral">—</span></div>
            </div>
            <div class="data-row-item">
              <div class="cell-label">Orçado (Budget)</div>
              <div class="cell-value" id="val-bud-row">-</div>
              <div class="cell-status-wrapper"><span class="status-badge-finance neutral">—</span></div>
            </div>
            <div class="data-row-item row-summary-conclusion">
              <div class="cell-label">Desvio Geral Mês</div>
              <div class="cell-value" id="val-diff-row">-</div>
              <div class="cell-status-wrapper"><span class="status-badge-finance" id="val-pct-row">-</span></div>
            </div>
            <div class="data-row-item row-summary-conclusion row-comparison-style">
              <div class="cell-label" id="lbl-prev-month-row">Mesmo Mês Ano Ant.</div>
              <div class="cell-value" id="val-prev-month-row">-</div>
              <div class="cell-status-wrapper"><span class="status-badge-finance" id="val-prev-month-pct-row">-</span></div>
            </div>
          </div>
        </div>

        <!-- Bloco de Visão Acumulada (YTD) -->
        <div class="grid-column-finance">
          <div class="column-title-finance" id="title-col-ytd">Acumulado Anual (YTD)</div>
          <div class="panel-content-rows">
            <div class="data-row-item row-main-highlight">
              <div class="cell-label" id="ytd-current-lbl">Acumulado Ano Atual</div>
              <div class="cell-value" id="ytd-abs-row">-</div>
              <div class="cell-status-wrapper"><span class="status-badge-finance" id="ytd-status-badge">No Prazo</span></div>
            </div>
            <div class="data-row-item">
              <div class="cell-label" id="ytd-ceiling-lbl">Meta YTD</div>
              <div class="cell-value" id="ytd-meta-val-row">-</div>
              <div class="cell-status-wrapper"><span class="status-badge-finance neutral">Teto</span></div>
            </div>
            <div class="data-row-item row-summary-conclusion">
              <div class="cell-label">Consumo do Budget Período</div>
              <div class="cell-value" id="ytd-pct-row">-</div>
              <div class="cell-status-wrapper"><span class="status-badge-finance neutral" id="ytd-consumption-badge">YTD</span></div>
            </div>
            <div class="data-row-item row-summary-conclusion row-comparison-style">
              <div class="cell-label" id="ytd-prev-lbl">Acumulado Ano Anterior</div>
              <div class="cell-value" id="ytd-prev-abs-row">-</div>
              <div class="cell-status-wrapper"><span class="status-badge-finance" id="ytd-prev-pct-lbl">-</span></div>
            </div>
          </div>
        </div>

      </div>
    </div>
  `;

  class EvoSummaryWidget extends HTMLElement {
    constructor() {
      super();
      this._props = {};
      this._currentData = null;
      this._animationFrameId = null;
      this._shadowRoot = null;
      this._resizeTimeout = null;
      
      this._selectedCutoffId = null;
      this._isTreeBuilt = false; 
      this._isDropdownOpen = false; 
    }

    connectedCallback() {
      if (!this._shadowRoot) {
        this._shadowRoot = this.attachShadow({ mode: "open" });
        this._shadowRoot.appendChild(template.content.cloneNode(true));
        
        this._chartArea = this._shadowRoot.getElementById("chartArea");
        this._svgOverlay = this._shadowRoot.getElementById("svgOverlay");
        this._axisX = this._shadowRoot.getElementById("axisX");
        this._insightGrid = this._shadowRoot.getElementById("insightGrid");
        this._treeDropdownTrigger = this._shadowRoot.getElementById("treeDropdownTrigger");
        this._treeDropdownContent = this._shadowRoot.getElementById("treeDropdownContent");
        
        this._titleColCurrent = this._shadowRoot.getElementById("title-col-current");
        this._lblActRow = this._shadowRoot.getElementById("lbl-act-row");
        this._valActRow = this._shadowRoot.getElementById("val-act-row");
        this._valBudRow = this._shadowRoot.getElementById("val-bud-row");
        this._valDiffRow = this._shadowRoot.getElementById("val-diff-row");
        this._valPctRow = this._shadowRoot.getElementById("val-pct-row");
        
        this._lblPrevMonthRow = this._shadowRoot.getElementById("lbl-prev-month-row");
        this._valPrevMonthRow = this._shadowRoot.getElementById("val-prev-month-row");
        this._valPrevMonthPctRow = this._shadowRoot.getElementById("val-prev-month-pct-row");
        
        this._titleColYtd = this._shadowRoot.getElementById("title-col-ytd");
        this._ytdCurrentLbl = this._shadowRoot.getElementById("ytd-current-lbl");
        this._ytdAbsRow = this._shadowRoot.getElementById("ytd-abs-row");
        this._ytdPctRow = this._shadowRoot.getElementById("ytd-pct-row");
        this._ytdStatusBadge = this._shadowRoot.getElementById("ytd-status-badge");
        this._ytdCeilingLbl = this._shadowRoot.getElementById("ytd-ceiling-lbl");
        this._ytdMetaValRow = this._shadowRoot.getElementById("ytd-meta-val-row");
        this._ytdPrevLbl = this._shadowRoot.getElementById("ytd-prev-lbl");
        this._ytdPrevAbsRow = this._shadowRoot.getElementById("ytd-prev-abs-row");
        this._ytdPrevPctLbl = this._shadowRoot.getElementById("ytd-prev-pct-lbl");

        this._miniBarPrev = this._shadowRoot.getElementById("mini-bar-prev");
        this._miniBarAct = this._shadowRoot.getElementById("mini-bar-act");
        this._miniBarBud = this._shadowRoot.getElementById("mini-bar-bud");
        this._miniLblPrev = this._shadowRoot.getElementById("mini-lbl-prev");
        this._miniLblAct = this._shadowRoot.getElementById("mini-lbl-act");
        this._miniLblBud = this._shadowRoot.getElementById("mini-lbl-bud");

        this._treeDropdownTrigger.addEventListener("click", (e) => {
          e.stopPropagation();
          this._isDropdownOpen = !this._isDropdownOpen;
          this._toggleDropdownDOM();
        });

        window.addEventListener("click", () => {
          this._isDropdownOpen = false;
          this._toggleDropdownDOM();
        });
      }

      this._resizeObserver = new ResizeObserver(() => {
        if (document.contains(this)) {
          clearTimeout(this._resizeTimeout);
          this._resizeTimeout = setTimeout(() => {
            cancelAnimationFrame(this._animationFrameId);
            this._animationFrameId = requestAnimationFrame(() => this.renderChart());
          }, 40);
        }
      });
      this._resizeObserver.observe(this._chartArea);
    }

    disconnectedCallback() {
      if (this._resizeObserver) this._resizeObserver.disconnect();
      cancelAnimationFrame(this._animationFrameId);
      clearTimeout(this._resizeTimeout);
    }

    _toggleDropdownDOM() {
      if (!this._treeDropdownContent) return;
      if (this._isDropdownOpen) {
        this._treeDropdownContent.classList.add("show");
      } else {
        this._treeDropdownContent.classList.remove("show");
      }
    }

    onCustomWidgetBeforeUpdate(changedProperties) {
      this._props = { ...this._props, ...changedProperties };
    }

    onCustomWidgetAfterUpdate(changedProperties) {
      this._updateStyles();
      if ("performanceCube" in changedProperties && this.performanceCube) {
        this._currentData = this.performanceCube;
        this._selectedCutoffId = null;
        this._isTreeBuilt = false; 
        if (this._shadowRoot) {
          this._treeDropdownContent.textContent = ""; 
          cancelAnimationFrame(this._animationFrameId);
          this._animationFrameId = requestAnimationFrame(() => this.renderChart());
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

    _clearDOM() {
      const existingBars = this._chartArea.querySelectorAll(".bar-wrapper");
      existingBars.forEach(el => el.remove());
      this._axisX.textContent = "";

      const svg = this._svgOverlay;
      svg.querySelectorAll('path').forEach(el => el.remove());
      svg.querySelectorAll('foreignObject').forEach(el => el.remove());

      this._insightGrid.style.display = "none";
    }

    renderChart() {
      if (!document.contains(this) || !this._shadowRoot) return;

      const financialData = this._currentData;
      if (!financialData || !financialData.data || financialData.data.length === 0) {
        this._clearDOM();
        const placeholder = document.createElement("div");
        placeholder.className = "placeholder-text";
        placeholder.textContent = "Aguardando dados estruturados...";
        this._axisX.appendChild(placeholder);
        return;
      }

      try {
        const metadata = financialData.metadata;
        const dimensions = metadata.dimensions || {};
        const mainStructureMembers = metadata.mainStructureMembers || {};

        const dimKeys = Object.keys(dimensions);
        const measureKeys = Object.keys(mainStructureMembers);

        if (dimKeys.length < 1 || measureKeys.length < 1) { this._clearDOM(); return; }

        const measId = measureKeys[0];
        let tempoDimId = dimKeys[0];
        let versaoDimId = dimKeys[1] || null;

        if (dimKeys.length >= 2) {
          const descFirst = String(dimensions[dimKeys[0]].description || "").toUpperCase();
          if (descFirst.includes("VERSÃO") || descFirst.includes("VERSION") || descFirst.includes("CENÁRIO")) {
            tempoDimId = dimKeys[1]; versaoDimId = dimKeys[0];
          }
        }

        const timelineMap = {};

        financialData.data.forEach(row => {
          const tempoObj = row[tempoDimId]; if (!tempoObj) return;
          const tId = String(tempoObj.id); const tLabel = tempoObj.label || tempoObj.description || tId;
          if (tId.toLowerCase().includes("(all)") || tLabel.toLowerCase().includes("(all)")) return;

          if (!timelineMap[tId]) {
            timelineMap[tId] = { id: tId, label: tLabel, realizado: 0, orcado: 0, isCurrentMonth: false, rowContext: row };
          }
          if (tempoObj.properties && (tempoObj.properties.isCurrent === "true" || tempoObj.properties.isCurrent === true)) { timelineMap[tId].isCurrentMonth = true; }
          if (row.versionContext && row.versionContext.isActualMonth) { timelineMap[tId].isCurrentMonth = true; }

          const rawValue = this._parseValue(row[measId] ? (row[measId].formattedValue || row[measId].raw || 0) : 0);
          if (versaoDimId) {
            const vObj = row[versaoDimId];
            if (vObj) {
              const vId = String(vObj.id).toUpperCase(); const vLabel = String(vObj.label || vObj.description || "").toUpperCase();
              if (vId.includes("ORÇADO") || vId.includes("ORCADO") || vId.includes("BUDGET") || vLabel.includes("ORÇADO") || vLabel.includes("BUDGET")) { timelineMap[tId].orcado += rawValue; }
              else { timelineMap[tId].realizado += rawValue; }
            }
          } else { timelineMap[tId].realizado += rawValue; }
        });

        const sortedMonths = Object.values(timelineMap);
        if (sortedMonths.length === 0) { this._clearDOM(); return; }

        const monthOrderMap = { "JAN":1, "FEB":2, "MAR":3, "APR":4, "MAY":5, "JUN":6, "JUL":7, "AUG":8, "SEP":9, "OCT":10, "NOV":11, "DEC":12 };
        const fullSeriesData = [];
        let defaultActualIndex = -1;

        sortedMonths.forEach((m) => {
          let parsedYear = new Date().getFullYear();
          const matches = m.id.match(/\d{4}/);
          if (matches) {
            parsedYear = parseInt(matches[0]);
          } else {
            const labelDigits = m.label.match(/\d{4}/);
            if (labelDigits) parsedYear = parseInt(labelDigits[0]);
          }

          if (parsedYear < 2022 || parsedYear > 2028) return;

          const cleanLabelUpper = String(m.label).substring(0, 3).toUpperCase();
          const targetMonthIndex = monthOrderMap[cleanLabelUpper] || 1;
          const alignedLabel = `${m.label.substring(0,3)} ${String(parsedYear).substring(2, 4)}`;

          fullSeriesData.push({ 
            id: m.id, 
            label: alignedLabel, 
            value: m.realizado, 
            type: m.isCurrentMonth ? "actual" : "historical", 
            originalNode: m, 
            yearValue: parsedYear, 
            monthNum: targetMonthIndex, 
            rawRow: m.rowContext 
          });
        });

        fullSeriesData.sort((a, b) => {
          if (a.yearValue !== b.yearValue) return a.yearValue - b.yearValue;
          return a.monthNum - b.monthNum;
        });

        fullSeriesData.forEach((d, idx) => {
          if (d.type === "actual") defaultActualIndex = idx;
        });

        if (defaultActualIndex === -1 && fullSeriesData.length > 0) {
          defaultActualIndex = fullSeriesData.length - 1;
        }

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
              this.renderChart();
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

        this._treeDropdownContent.querySelectorAll(".tree-month-item").forEach(item => {
          if (item.getAttribute("data-id") === this._selectedCutoffId) {
            item.classList.add("selected");
          } else {
            item.classList.remove("selected");
          }
        });

        fullSeriesData.forEach((d, idx) => {
          d.type = (idx === actualIndex) ? "actual" : "historical";
        });

        const targetBudgetSource = fullSeriesData[actualIndex].originalNode;
        const calculatedBudget = targetBudgetSource.orcado > 0 ? targetBudgetSource.orcado : targetBudgetSource.realizado;

        this._clearDOM();

        const startIndex = Math.max(0, actualIndex - 12); 
        const visibleSeriesData = fullSeriesData.slice(startIndex, actualIndex + 1);

        let visibleActualIndex = visibleSeriesData.findIndex(d => d.id === this._selectedCutoffId);
        if (visibleActualIndex === -1) visibleActualIndex = visibleSeriesData.length - 1;

        visibleSeriesData.push({
          label: `Bud. ${fullSeriesData[actualIndex].label.split(' ')[0]}`,
          value: calculatedBudget,
          type: "budget",
          yearValue: fullSeriesData[actualIndex].yearValue,
          monthNum: fullSeriesData[actualIndex].monthNum
        });

        const maxVal = Math.max(...visibleSeriesData.map(d => d.value)) * 1.25 || 1;
        const barElements = [];

        visibleSeriesData.forEach((d) => {
          const barWrapper = document.createElement("div"); barWrapper.className = "bar-wrapper";
          const barElement = document.createElement("div"); barElement.className = "bar-element";
          barElement.style.height = `${(d.value / maxVal) * 100}%`; barElement.classList.add(d.type);
          const kpiLabel = document.createElement("span"); kpiLabel.className = "kpi-label"; kpiLabel.textContent = (d.value / 1000000).toFixed(2) + "M";
          barElement.appendChild(kpiLabel); barWrapper.appendChild(barElement); this._chartArea.appendChild(barWrapper); barElements.push(barElement);
          
          const axisLabel = document.createElement("div"); axisLabel.className = "axis-label"; axisLabel.textContent = d.label;
          if (d.type === "actual") axisLabel.classList.add("actual-month");
          this._axisX.appendChild(axisLabel);
        });

        this._drawUnifiedFlatConnections(barElements, visibleSeriesData, visibleActualIndex);
        this._renderDoubleFinancePanel(fullSeriesData, actualIndex, calculatedBudget);

      } catch (error) {
        console.error("Erro interno no processamento visual:", error);
      }
    }

    _drawUnifiedFlatConnections(barElements, visibleSeriesData, visibleActualIndex) {
      if (!document.contains(this) || !this._shadowRoot || visibleActualIndex === -1) return;
      const svg = this._svgOverlay; const containerHeight = this._chartArea.offsetHeight; if (containerHeight === 0) return;
      
      const pairsToConnect = [];
      if (visibleActualIndex > 0) pairsToConnect.push({ from: visibleActualIndex - 1, to: visibleActualIndex, type: "monthly" });
      if (visibleActualIndex < barElements.length - 1) pairsToConnect.push({ from: visibleActualIndex, to: visibleActualIndex + 1, type: "budget" });
      
      if (visibleSeriesData.length >= 14 && visibleActualIndex === 12) {
        pairsToConnect.push({ from: 0, to: 12, type: "yoy" });
      }

      const getBarCenterAndTop = (idx) => {
        const bar = barElements[idx]; if (!bar) return { x: 0, y: 0 };
        return { x: bar.parentElement.offsetLeft + bar.offsetLeft + (bar.offsetWidth / 2), y: containerHeight - bar.offsetHeight };
      };

      let maxBarHeight = 0; barElements.forEach(bar => { if (bar.offsetHeight > maxBarHeight) maxBarHeight = bar.offsetHeight; });
      const globalCeilingY = containerHeight - maxBarHeight - 16;
      
      pairsToConnect.forEach((pair) => {
        const coordFrom = getBarCenterAndTop(pair.from); const coordTo = getBarCenterAndTop(pair.to);
        if (coordFrom.x === 0 && coordTo.x === 0) return;
        
        const val1 = visibleSeriesData[pair.from].value; const val2 = visibleSeriesData[pair.to].value;
        const diff = val2 - val1; let variancePercent = val1 !== 0 ? (diff / val1) * 100 : 0;
        const isCostIncrease = val2 > val1;
        
        if (isCostIncrease && variancePercent > 0) { variancePercent = -variancePercent; }
        else if (!isCostIncrease && variancePercent < 0) { variancePercent = Math.abs(variancePercent); }
        
        const directionalArrow = variancePercent >= 0 ? "▲ " : "▼ ";
        const varianceText = directionalArrow + Math.abs(variancePercent).toFixed(2) + "%";
        const markerId = "url(#arrow-neutral)";
        
        const lineCeiling = globalCeilingY;
        const lineStrokeColor = "#718096";

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", `M ${coordFrom.x} ${coordFrom.y} L ${coordFrom.x} ${lineCeiling} L ${coordTo.x} ${lineCeiling} L ${coordTo.x} ${coordTo.y - 5}`);
        path.setAttribute("stroke", lineStrokeColor); path.setAttribute("stroke-width", "1.25"); path.setAttribute("fill", "none"); path.setAttribute("marker-end", markerId);
        
        if (pair.type === "yoy" || pair.type === "budget") {
          path.setAttribute("stroke-dasharray", "3,3"); 
        }
        svg.appendChild(path);
        
        const midX = coordFrom.x + (coordTo.x - coordFrom.x) / 2;
        const foreignObj = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
        foreignObj.setAttribute("x", (midX - 35).toString()); foreignObj.setAttribute("y", (lineCeiling - 11).toString()); foreignObj.setAttribute("width", "70"); foreignObj.setAttribute("height", "22");
        
        const div = document.createElement("div"); div.style.display = "flex"; div.style.justifyContent = "center"; div.style.alignItems = "center"; div.style.width = "100%"; div.style.height = "100%";
        const span = document.createElement("span"); span.className = "variance-tag"; span.textContent = varianceText;
        
        if (isCostIncrease) { span.classList.add("increase"); } else { span.classList.add("saving"); }
        div.appendChild(span); foreignObj.appendChild(div); svg.appendChild(foreignObj);
      });
    }

    _renderDoubleFinancePanel(fullSeriesData, actualIndex, budgetVal) {
      const currentBarNode = fullSeriesData[actualIndex]; 
      const actualVal = currentBarNode.value; 
      const monthLabel = currentBarNode.label.split(' ')[0];
      const currentYear = currentBarNode.yearValue; 
      const previousYear = currentYear - 1;

      const diffNominal = actualVal - budgetVal;
      const diffPercent = budgetVal !== 0 ? (diffNominal / budgetVal) * 100 : 0;
      
      const formatM = (v) => (v / 1000000).toFixed(2) + "M";
      const formatPercent = (v) => (v >= 0 ? "▲ " : "▼ ") + Math.abs(v).toFixed(2) + "%";

      // AID RE-HYDRATION: Uso exclusivo de textContent para blindagem e performance
      this._titleColCurrent.textContent = `Mês Atual (${monthLabel.toUpperCase()})`;
      this._lblActRow.textContent = `Realizado Comercial`; 
      this._valActRow.textContent = formatM(actualVal);
      this._valBudRow.textContent = formatM(budgetVal);
      
      this._valDiffRow.textContent = (diffNominal >= 0 ? "+" : "") + formatM(diffNominal);
      this._valPctRow.textContent = formatPercent(diffPercent);
      this._valPctRow.className = "status-badge-finance " + (diffNominal > 0 ? "warning" : "success");

      const prevYearMonthNode = fullSeriesData.find(d => d.yearValue === previousYear && d.monthNum === currentBarNode.monthNum);
      const prevYearMonthVal = prevYearMonthNode ? prevYearMonthNode.value : 0;
      
      const diffMonthYoY = actualVal - prevYearMonthVal;
      let pctMonthYoY = prevYearMonthVal !== 0 ? (diffMonthYoY / prevYearMonthVal) * 100 : 0;
      const isMonthYoYRetraction = actualVal < prevYearMonthVal;
      
      if (isMonthYoYRetraction && pctMonthYoY > 0) {
        pctMonthYoY = -pctMonthYoY;
      } else if (!isMonthYoYRetraction && pctMonthYoY < 0) {
        pctMonthYoY = Math.abs(pctMonthYoY);
      }

      this._lblPrevMonthRow.textContent = `Mesmo Mês Ano Ant. (${previousYear})`;
      this._valPrevMonthRow.textContent = formatM(prevYearMonthVal);
      this._valPrevMonthPctRow.textContent = formatPercent(pctMonthYoY);
      
      this._valPrevMonthPctRow.className = "status-badge-finance " + (isMonthYoYRetraction ? "success" : "warning");

      let totalRealizadoYTDAtual = 0;
      let totalRealizadoYTDAntigo = 0;
      let totalBudgetYTDCompleto = 0;

      fullSeriesData.forEach((d, idx) => {
        if (idx <= actualIndex) {
          if (d.yearValue === currentYear) {
            totalRealizadoYTDAtual += d.value;
            totalBudgetYTDCompleto += (d.originalNode ? d.originalNode.orcado : 0) || d.value;
          }
        }
        if (d.yearValue === previousYear && d.monthNum <= currentBarNode.monthNum) {
          totalRealizadoYTDAntigo += d.value;
        }
      });

      if (totalBudgetYTDCompleto === 0) totalBudgetYTDCompleto = totalRealizadoYTDAtual || 1;

      const consumoBudgetPercent = (totalRealizadoYTDAtual / totalBudgetYTDCompleto) * 100;
      const diffYoYNominal = totalRealizadoYTDAtual - totalRealizadoYTDAntigo;
      const pctYoY = totalRealizadoYTDAntigo !== 0 ? (diffYoYNominal / totalRealizadoYTDAntigo) * 100 : 0;
      const isYoYRetraction = totalRealizadoYTDAtual < totalRealizadoYTDAntigo;

      this._titleColYtd.textContent = `Acumulado Anual (YTD)`;
      this._ytdCurrentLbl.textContent = `Acumulado Ano Atual (${currentYear})`; 
      this._ytdAbsRow.textContent = formatM(totalRealizadoYTDAtual);
      this._ytdPctRow.textContent = consumoBudgetPercent.toFixed(2) + "%";
      
      this._ytdStatusBadge.className = "status-badge-finance " + (totalRealizadoYTDAtual <= totalBudgetYTDCompleto ? "success" : "warning");
      this._ytdStatusBadge.textContent = totalRealizadoYTDAtual <= totalBudgetYTDCompleto ? "No Prazo" : "Estourado";
      
      this._ytdCeilingLbl.textContent = `Meta YTD (${currentYear})`;
      this._ytdMetaValRow.textContent = formatM(totalBudgetYTDCompleto);
      
      this._ytdPrevLbl.textContent = `Acumulado Ano Ant. (${previousYear})`; 
      this._ytdPrevAbsRow.textContent = formatM(totalRealizadoYTDAntigo);
      this._ytdPrevPctLbl.textContent = formatPercent(pctYoY);
      this._ytdPrevPctLbl.className = "status-badge-finance " + (isYoYRetraction ? "success" : "warning");

      const maxYTD = Math.max(totalRealizadoYTDAntigo, totalRealizadoYTDAtual, totalBudgetYTDCompleto) * 1.25 || 1;
      
      this._miniBarPrev.style.height = `${(totalRealizadoYTDAntigo / maxYTD) * 100}%`;
      this._miniBarAct.style.height = `${(totalRealizadoYTDAtual / maxYTD) * 100}%`;
      this._miniBarBud.style.height = `${(totalBudgetYTDCompleto / maxYTD) * 100}%`;

      this._miniLblPrev.textContent = (totalRealizadoYTDAntigo / 1000000).toFixed(2) + "M";
      this._miniLblAct.textContent = (totalRealizadoYTDAtual / 1000000).toFixed(2) + "M";
      this._miniLblBud.textContent = (totalBudgetYTDCompleto / 1000000).toFixed(2) + "M";

      this._shadowRoot.getElementById("ytd-axis-lbl-prev").textContent = `Ant. (${previousYear})`;
      this._shadowRoot.getElementById("ytd-axis-lbl-act").textContent = `Atual (${currentYear})`;

      this._insightGrid.style.display = "grid";
    }

    getColorActualMonth() { return this._props.colorActualMonth; }
    setColorActualMonth(val) { this._props.colorActualMonth = val; }
    getColorHistorical() { return this._props.colorHistorical; }
    setColorHistorical(val) { this._props.colorHistorical = val; }
    getColorBudget() { return this._props.colorBudget; }
    setColorBudget(val) { this._props.colorBudget = val; }
    getFontSizeLabels() { return this._props.fontSizeLabels; }
    setFontSizeLabels(val) { this._props.fontSizeLabels = val; }
  }
  if (!customElements.get("sac-summary")) { customElements.define("sac-summary", EvoSummaryWidget); }
})();
