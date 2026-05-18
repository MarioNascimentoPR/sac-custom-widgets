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
        font-size: 11px; font-weight: 700; color: #4a5568; text-transform: uppercase; padding-bottom: 4px; letter-spacing: 0.5px; margin-bottom: auto;
      }
      
      .chart-container-block {
        position: relative; height: 145px; padding-top: 32px; box-sizing: border-box; width: 100%;
      }
      .chart-area {
        width: 100%; height: 100%; display: flex; position: relative; align-items: flex-end; justify-content: center; gap: 20px; 
      }
      
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

      /* ==========================================================================
         GRID INTEGRADO DE PERFORMANCE E INSIGHTS (OTIMIZADO)
         ========================================================================== */
      .insight-grid {
        display: grid;
        grid-template-columns: 1.2fr 1fr;
        gap: 24px;
        margin-top: auto;
        padding-top: 16px;
        border-top: 1px solid #e2e8f0;
        flex-shrink: 0;
        width: 100%;
      }
      @media (max-width: 768px) { .insight-grid { grid-template-columns: 1fr; gap: 16px; } }

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
      }

      .panel-content-rows {
        display: flex;
        flex-direction: column;
        gap: 1px;
        background-color: #e2e8f0; 
        border-radius: 4px;
        overflow: hidden;
      }

      .data-row-item {
        display: grid;
        grid-template-columns: 1.8fr 1fr 1fr;
        align-items: center;
        background: #ffffff;
        padding: 8px 12px;
        font-size: calc(var(--font-size-labels) - 0.5px);
        color: #2d3748;
        gap: 8px;
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
      .cell-label::before {
        content: ''; width: 4px; height: 12px; background: #cbd5e0; border-radius: 2px; display: inline-block; flex-shrink: 0;
      }
      .row-m-style .cell-label::before { background: var(--color-actual); }
      .row-ytd-style .cell-label::before { background: #2b6cb0; }

      .cell-value {
        text-align: right;
        font-variant-numeric: tabular-nums;
        font-weight: 700;
        color: #1e293b;
        white-space: nowrap;
      }

      .cell-status-wrapper {
        display: flex;
        justify-content: flex-end;
        align-items: center;
      }

      .status-badge-finance {
        font-size: 10px;
        font-weight: 700;
        padding: 3px 8px;
        border-radius: 4px;
        text-align: center;
        white-space: nowrap;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 75px;
        box-sizing: border-box;
      }
      .status-badge-finance.success { background-color: #e6f4ea; color: #137333; border: 1px solid #ceead6; }
      .status-badge-finance.warning { background-color: #fce8e6; color: #c5221f; border: 1px solid #fad2cf; }
      .status-badge-finance.neutral { background-color: #f1f3f4; color: #5f6368; border: 1px solid #e8eaed; }

      /* AREA DE HIGHLIGHTS DINÂMICOS */
      .highlight-card-area {
        display: flex;
        flex-direction: column;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 14px 16px;
      }
      .highlight-title-box {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        font-weight: 700;
        color: #1e293b;
        text-transform: uppercase;
        letter-spacing: 0.75px;
        margin-bottom: 12px;
        padding-bottom: 6px;
        border-bottom: 2px solid #cbd5e0;
      }
      .highlight-icon-box {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 13px;
      }
      .highlight-content-text {
        font-size: 11.5px;
        line-height: 1.5;
        color: #4a5568;
        font-weight: 500;
        text-align: justify;
      }

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
        <div class="monthly-col visualization-column">
          <div class="chart-container-block">
            <div class="chart-area" id="chartArea"></div>
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

      <div class="insight-grid" id="insightGrid" style="display: none;">
        <div class="grid-column-finance">
          <div class="column-title-finance">Acompanhamento de Metas Orçamentárias</div>
          <div class="panel-content-rows">
            <div class="data-row-item row-m-style">
              <div class="cell-label">Desvio Mês (Real x Orçado)</div>
              <div class="cell-value" id="val-diff-row">-</div>
              <div class="cell-status-wrapper"><span class="status-badge-finance" id="val-pct-row">-</span></div>
            </div>
            <div class="data-row-item row-m-style">
              <div class="cell-label">Consumo do Budget no Mês</div>
              <div class="cell-value" id="val-pct-consumption-row">-</div>
              <div class="cell-status-wrapper"><span class="status-badge-finance neutral">Mês</span></div>
            </div>
            <div class="data-row-item row-ytd-style">
              <div class="cell-label">Desvio YTD (Real x Orçado)</div>
              <div class="cell-value" id="ytd-diff-row">-</div>
              <div class="cell-status-wrapper"><span class="status-badge-finance" id="ytd-diff-pct-badge">-</span></div>
            </div>
            <div class="data-row-item row-ytd-style">
              <div class="cell-label">Consumo do Budget Período (YTD)</div>
              <div class="cell-value" id="ytd-pct-row">-</div>
              <div class="cell-status-wrapper"><span class="status-badge-finance neutral">YTD</span></div>
            </div>
          </div>
        </div>

        <div class="highlight-card-area">
          <div class="highlight-title-box">
            <span class="highlight-icon-box">💡</span>
            <span>Highlights</span>
          </div>
          <div class="highlight-content-text" id="highlightContentText">-</div>
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
        this._ytdChartArea = this._shadowRoot.getElementById("ytdChartArea");
        this._axisX = this._shadowRoot.getElementById("axisX");
        this._insightGrid = this._shadowRoot.getElementById("insightGrid");
        this._treeDropdownTrigger = this._shadowRoot.getElementById("treeDropdownTrigger");
        this._treeDropdownContent = this._shadowRoot.getElementById("treeDropdownContent");
        
        this._valDiffRow = this._shadowRoot.getElementById("val-diff-row");
        this._valPctRow = this._shadowRoot.getElementById("val-pct-row");
        this._valPctConsumptionRow = this._shadowRoot.getElementById("val-pct-consumption-row");
        
        this._ytdDiffRow = this._shadowRoot.getElementById("ytd-diff-row");
        this._ytdDiffPctBadge = this._shadowRoot.getElementById("ytd-diff-pct-badge");
        this._ytdPctRow = this._shadowRoot.getElementById("ytd-pct-row");
        this._highlightContentText = this._shadowRoot.getElementById("highlightContentText");

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

        visibleSeriesData.forEach((d) => {
          const barWrapper = document.createElement("div"); barWrapper.className = "bar-wrapper";
          const barElement = document.createElement("div"); barElement.className = "bar-element";
          barElement.style.height = `${(d.value / maxVal) * 100}%`; barElement.classList.add(d.type);
          const kpiLabel = document.createElement("span"); kpiLabel.className = "kpi-label"; kpiLabel.textContent = (d.value / 1000000).toFixed(2) + "M";
          barElement.appendChild(kpiLabel); barWrapper.appendChild(barElement); this._chartArea.appendChild(barWrapper);
          
          const axisLabel = document.createElement("div"); axisLabel.className = "axis-label"; axisLabel.textContent = d.label;
          if (d.type === "actual") axisLabel.classList.add("actual-month");
          this._axisX.appendChild(axisLabel);
        });

        this._renderDoubleFinancePanel(fullSeriesData, actualIndex, calculatedBudget);

      } catch (error) {
        console.error("Erro interno no processamento visual:", error);
      }
    }

    _renderDoubleFinancePanel(fullSeriesData, actualIndex, budgetVal) {
      const currentBarNode = fullSeriesData[actualIndex]; 
      const actualVal = currentBarNode.value; 
      const monthLabel = currentBarNode.label.split(' ')[0];
      const currentYear = currentBarNode.yearValue; 
      const previousYear = currentYear - 1;

      const diffNominal = actualVal - budgetVal;
      const diffPercent = budgetVal !== 0 ? (diffNominal / budgetVal) * 100 : 0;
      const consumptionMonthPercent = budgetVal !== 0 ? (actualVal / budgetVal) * 100 : 0;
      
      const isMonthSaving = diffNominal <= 0;
      
      const formatM = (v) => (v / 1000000).toFixed(2) + "M";
      const formatPercent = (v, isSaving) => (isSaving ? "▼ " : "▲ ") + Math.abs(v).toFixed(2) + "%";

      this._valDiffRow.textContent = (diffNominal >= 0 ? "+" : "") + formatM(diffNominal);
      this._valPctRow.textContent = formatPercent(diffPercent, isMonthSaving);
      this._valPctRow.className = "status-badge-finance " + (isMonthSaving ? "success" : "warning");
      this._valPctConsumptionRow.textContent = consumptionMonthPercent.toFixed(2) + "%";

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

      const diffYtdNominal = totalRealizadoYTDAtual - totalBudgetYTDCompleto;
      const diffYtdPercent = totalBudgetYTDCompleto !== 0 ? (diffYtdNominal / totalBudgetYTDCompleto) * 100 : 0;
      const consumoBudgetPercent = (totalRealizadoYTDAtual / totalBudgetYTDCompleto) * 100;
      const isYtdSaving = diffYtdNominal <= 0;

      this._ytdDiffRow.textContent = (diffYtdNominal >= 0 ? "+" : "") + formatM(diffYtdNominal);
      this._ytdDiffPctBadge.textContent = formatPercent(diffYtdPercent, isYtdSaving);
      this._ytdDiffPctBadge.className = "status-badge-finance " + (isYtdSaving ? "success" : "warning");
      this._ytdPctRow.textContent = consumoBudgetPercent.toFixed(2) + "%";

      const maxYTD = Math.max(totalRealizadoYTDAntigo, totalRealizadoYTDAtual, totalBudgetYTDCompleto) * 1.25 || 1;
      this._miniBarPrev.style.height = `${(totalRealizadoYTDAntigo / maxYTD) * 100}%`;
      this._miniBarAct.style.height = `${(totalRealizadoYTDAtual / maxYTD) * 100}%`;
      this._miniBarBud.style.height = `${(totalBudgetYTDCompleto / maxYTD) * 100}%`;

      this._miniLblPrev.textContent = (totalRealizadoYTDAntigo / 1000000).toFixed(2) + "M";
      this._miniLblAct.textContent = (totalRealizadoYTDAtual / 1000000).toFixed(2) + "M";
      this._miniLblBud.textContent = (totalBudgetYTDCompleto / 1000000).toFixed(2) + "M";

      this._shadowRoot.getElementById("ytd-axis-lbl-prev").textContent = `Ant. (${previousYear})`;
      this._shadowRoot.getElementById("ytd-axis-lbl-act").textContent = `Atual (${currentYear})`;

      const monthStatusLabel = isMonthSaving ? "economia de custos" : "incremento de despesas";
      const ytdStatusLabel = isYtdSaving ? "abaixo do teto orçamentário (eficiência)" : "acima da meta estabelecida (atenção)";

      this._highlightContentText.innerHTML = `
        <ul style="margin: 0; padding-left: 16px; font-size: 11.5px; color: #4a5568; line-height: 1.5; display: flex; flex-direction: column; gap: 8px;">
            <li><strong>Mês Corrente (${monthLabel}):</strong> Fechamento com ${monthStatusLabel} de R$ ${Math.abs(diffNominal/1000000).toFixed(2)}M.</li>
            <li><strong>Consumo Operacional:</strong> A absorção atingiu ${(consumptionMonthPercent).toFixed(1)}% do planejado para a competência.</li>
            <li><strong>Posicionamento YTD:</strong> O acumulado consolidou um desvio ${ytdStatusLabel}, absorvendo ${(consumoBudgetPercent).toFixed(1)}% da meta anual.</li>
        </ul>
      `;

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

/* ==========================================================================
   PAINEL DE CONFIGURAÇÃO INTEGRADO (METODOLOGIA DE ARQUIVO ÚNICO)
   ========================================================================== */
(function () {
  const templateStyling = document.createElement("template");
  templateStyling.innerHTML = `
    <style>
      #root {
        padding: 14px;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 11px;
        color: #2c3e50;
      }
      .control-group { margin-bottom: 12px; }
      label {
        display: block;
        font-weight: 600;
        margin-bottom: 4px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      input[type="color"] {
        display: block; width: 100%; height: 28px; border: 1px solid #cbd5e0; border-radius: 4px; cursor: pointer; background: #ffffff;
      }
      input[type="number"] {
        width: 100%; height: 26px; border: 1px solid #cbd5e0; border-radius: 4px; padding-left: 6px; box-sizing: border-box;
      }
    </style>
    <div id="root">
      <div class="control-group">
        <label>Cor Mês Atual (Realizado)</label>
        <input id="cls-act" type="color" />
      </div>
      <div class="control-group">
        <label>Cor Histórico (Realizado)</label>
        <input id="cls-hist" type="color" />
      </div>
      <div class="control-group">
        <label>Cor Orçado (Budget)</label>
        <input id="cls-bud" type="color" />
      </div>
      <div class="control-group">
        <label>Tamanho da Fonte Rótulos (px)</label>
        <input id="font-size-lbl" type="number" min="8" max="16" />
      </div>
    </div>
  `;

  class EvoSummaryWidgetStyling extends HTMLElement {
    constructor() {
      super();
      this._shadowRoot = this.attachShadow({ mode: "open" });
      this._shadowRoot.appendChild(templateStyling.content.cloneNode(true));

      this._changeProperty = this._changeProperty.bind(this);

      this._shadowRoot.getElementById("cls-act").addEventListener("change", (e) => this._changeProperty("colorActualMonth", e.target.value));
      this._shadowRoot.getElementById("cls-hist").addEventListener("change", (e) => this._changeProperty("colorHistorical", e.target.value));
      this._shadowRoot.getElementById("cls-bud").addEventListener("change", (e) => this._changeProperty("colorBudget", e.target.value));
      this._shadowRoot.getElementById("font-size-lbl").addEventListener("change", (e) => this._changeProperty("fontSizeLabels", parseInt(e.target.value)));
    }

    _changeProperty(name, value) {
      this.dispatchEvent(new CustomEvent("propertiesChanged", {
        detail: { properties: { [name]: value } }
      }));
    }

    onCustomWidgetAfterUpdate(changedProperties) {
      if (changedProperties.colorActualMonth !== undefined) {
        this._shadowRoot.getElementById("cls-act").value = changedProperties.colorActualMonth;
      }
      if (changedProperties.colorHistorical !== undefined) {
        this._shadowRoot.getElementById("cls-hist").value = changedProperties.colorHistorical;
      }
      if (changedProperties.colorBudget !== undefined) {
        this._shadowRoot.getElementById("cls-bud").value = changedProperties.colorBudget;
      }
      if (changedProperties.fontSizeLabels !== undefined) {
        this._shadowRoot.getElementById("font-size-lbl").value = changedProperties.fontSizeLabels;
      }
    }
  }

  if (!customElements.get("sac-summary-styling")) {
    customElements.define("sac-summary-styling", EvoSummaryWidgetStyling);
  }
})();
