/* ==========================================================================
   EVOSTREAM PERFORMANCE SUMMARY WIDGET - PRODUCTION READY WITH CLEAN ENGINE
   ========================================================================== */

(function () {
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
        display: none; position: absolute; top: 100%; right: 0; margin-top: 4px; background: #ffffff; border: 1px solid #cbd5e0; border-radius: 6px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); max-height: 260px; overflow-y: auto; min-width: 160px; padding: 6px 0;
      }
      .tree-dropdown-content.show { display: block; }
      
      .telemetry-btn {
        font-size: 11px; font-weight: 700; color: #4a5568; background-color: #f1f5f9; border: 1px solid #cbd5e0; border-radius: 6px; padding: 4px 10px; cursor: pointer; display: flex; align-items: center; gap: 4px; transition: all 0.2s; user-select: none;
      }
      .telemetry-btn:hover { background-color: #e2e8f0; color: #1e293b; }
      .telemetry-modal {
        display: none; position: absolute; top: 48px; right: 18px; width: 290px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1); z-index: 1000; padding: 14px; font-size: 11px; color: #334155;
      }
      .telemetry-modal.show { display: block; }
      .telemetry-title { font-size: 11.5px; font-weight: 700; color: #1e293b; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #edf2f7; padding-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
      .telemetry-close { background: none; border: none; font-size: 16px; cursor: pointer; color: #94a3b8; font-weight: 700; line-height: 1; }
      .telemetry-close:hover { color: #64748b; }
      .telemetry-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #f1f5f9; align-items: center; }
      .telemetry-row:last-child { border-bottom: none; }
      .telemetry-label { font-weight: 600; color: #64748b; }
      .telemetry-val { font-weight: 700; color: #0f172a; font-variant-numeric: tabular-nums; background: #f8fafc; padding: 2px 6px; border-radius: 4px; border: 1px solid #e2e8f0; }

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
      .visualization-column { display: flex; flex-direction: column; justify-content: flex-end; }
      .visualization-column.monthly-col { flex: 3; }
      .visualization-column.ytd-col { flex: 1; border-left: 1px solid #e2e8f0; padding-left: 24px; }
      .chart-container-block { position: relative; height: 155px; padding-top: 45px; box-sizing: border-box; width: 100%; }
      .chart-area { width: 100%; height: 100%; display: flex; position: relative; align-items: flex-end; justify-content: center; gap: 20px; }
      .svg-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1; overflow: visible; }
      .bar-wrapper { display: flex; flex-direction: column; align-items: center; width: 46px; height: 100%; justify-content: flex-end; position: relative; z-index: 2; }
      .bar-element { width: 100%; max-width: 46px; border-radius: 3px 3px 0 0; position: relative; display: flex; justify-content: center; bottom: 0px; height: 0%; transition: height 0.3s ease-out; }
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
      .variance-tag { font-size: calc(var(--font-size-labels) - 2px); font-weight: 700; padding: 1px 5px; border-radius: 3px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); white-space: nowrap; display: inline-block; position: relative; z-index: 4; }
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
      .highlight-content-text { font-size: 11.5px; line-height: 1.5; color: #4a5568; font-weight: 500; }
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
          
          <button class="telemetry-btn" id="telemetryBtn">📊 Telemetria</button>
          
          <div class="telemetry-modal" id="telemetryModal">
            <div class="telemetry-title">
              <span>Métricas de Performance</span>
              <button class="telemetry-close" id="closeTelemetry">×</button>
            </div>
            <div class="telemetry-row">
              <span class="telemetry-label">Processamento JS:</span>
              <span class="telemetry-val" id="tmJS">0.00 ms</span>
            </div>
            <div class="telemetry-row">
              <span class="telemetry-label">Renderização DOM:</span>
              <span class="telemetry-val" id="tmDOM">0.00 ms</span>
            </div>
            <div class="telemetry-row">
              <span class="telemetry-label">Reflows Otimizados:</span>
              <span class="telemetry-val" id="tmReflow">0 passes</span>
            </div>
            <div class="telemetry-row">
              <span class="telemetry-label">Escalabilidade SAC:</span>
              <span class="telemetry-val" id="tmVol">0 rows</span>
            </div>
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
          <div class="chart-container-block"><div class="chart-area" id="chartArea"><svg class="svg-overlay" id="svgOverlay"></svg></div></div>
          <div class="axis-x-block"><div class="axis-x" id="axisX"></div></div>
        </div>
        <div class="visualization-column ytd-col">
          <div class="chart-container-block">
            <div class="chart-area" id="ytdChartArea">
              <svg class="svg-overlay" id="svgYtdOverlay"></svg>
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

    analyze(cubeData, targetNode, currentYear, previousYear, tempoDimId, versaoDimId, itemFinanceiroDimId, contaContabilDimId, measId, fullSeriesData) {
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

      const itemFinanceiroMap = {};

      cubeData.forEach(row => {
        if (!tempoDimId || !itemFinanceiroDimId) return;
        const tObj = row[tempoDimId]; if (!tObj) return;
        
        const rowMonthNode = fullSeriesData.find(d => d.id === String(tObj.id));
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

        const featureRow = {
          itemName: name, realizado: item.realizado, budget: item.orcado,
          desvio: desvioNominal, pctVar: variancePct, isSaving: desvioNominal <= 0,
          driverConta: driverContaName, driverImpact: item.contas[driverContaName] ? (item.contas[driverContaName].realizado - item.contas[driverContaName].orcado) : 0,
          score: Math.abs(desvioNominal)
        };

        driverTable.push(featureRow);
        if (Math.abs(desvioNominal) > 1000) { outlierTable.push(featureRow); }
      });

      rankingTable.push(...outlierTable);
      rankingTable.sort((a, b) => b.score - a.score);

      return { varianceTable, driverTable, outlierTable: rankingTable, rankingTable };
    }

    _parseRawValue(val) {
      if (typeof val === 'number') return val;
      if (!val || val === "-") return 0;
      return parseFloat(String(val).replace(/[^0-9.,-]/g, '').replace(',', '.')) || 0;
    }
  }

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
      this._analyticsEngine = new EvoNarrativeEngine();

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
        this._svgOverlay = this._shadowRoot.getElementById("svgOverlay");
        this._svgYtdOverlay = this._shadowRoot.getElementById("svgYtdOverlay");
        this._axisX = this._shadowRoot.getElementById("axisX");
        this._insightGrid = this._shadowRoot.getElementById("insightGrid");
        this._treeDropdownTrigger = this._shadowRoot.getElementById("treeDropdownTrigger");
        this._treeDropdownContent = this._shadowRoot.getElementById("treeDropdownContent");
        this._widgetTitle = this._shadowRoot.getElementById("widgetTitle");
        this._periodSummaryBanner = this._shadowRoot.getElementById("periodSummaryBanner");
        
        this._telemetryBtn = this._shadowRoot.getElementById("telemetryBtn");
        this._telemetryModal = this._shadowRoot.getElementById("telemetryModal");
        this._closeTelemetry = this._shadowRoot.getElementById("closeTelemetry");
        this._lblJS = this._shadowRoot.getElementById("tmJS");
        this._lblDOM = this._shadowRoot.getElementById("tmDOM");
        this._lblReflow = this._shadowRoot.getElementById("tmReflow");
        this._lblVol = this._shadowRoot.getElementById("tmVol");

        this._valDiffRow = this._shadowRoot.getElementById("val-diff-row");
        this._valPctRow = this._shadowRoot.getElementById("val-pct-row");
        this._valPctConsumptionRow = this._shadowRoot.getElementById("val-pct-consumption-row");
        this._ytdDiffRow = this._shadowRoot.getElementById("ytd-diff-row");
        this._ytdDiffPctBadge = this._shadowRoot.getElementById("ytd-diff-pct-badge");
        this._ytdPctRow = this._shadowRoot.getElementById("ytd-pct-row");
        this._highlightContentText = this._shadowRoot.getElementById("highlightContentText");
        this._highlightCardArea = this._shadowRoot.getElementById("highlightCardArea");

        this._miniBarPrev = this._shadowRoot.getElementById("mini-bar-prev");
        this._miniBarAct = this._shadowRoot.getElementById("mini-bar-act");
        this._miniBarBud = this._shadowRoot.getElementById("mini-bar-bud");
        this._miniLblPrev = this._shadowRoot.getElementById("mini-lbl-prev");
        this._miniLblAct = this._shadowRoot.getElementById("mini-lbl-act");
        this._miniLblBud = this._shadowRoot.getElementById("mini-lbl-bud");

        this._telemetryBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          this._telemetryModal.classList.toggle("show");
        });
        this._closeTelemetry.addEventListener("click", () => {
          this._telemetryModal.classList.remove("show");
        });

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
          this.requestUpdate();
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
        this._currentData = this.performanceCube;
        this._selectedCutoffId = null;
        this._isTreeBuilt = false; 
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

    _clearSvgOverlay(svg) {
      while (svg.lastElementChild) {
        svg.removeChild(svg.lastElementChild);
      }
    }

    renderChart() {
      if (!document.contains(this) || !this._shadowRoot) return;
      const tStartJS = performance.now();

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
        this._reflowCount++;
        const metadata = financialData.metadata;
        const dimensions = metadata.dimensions || {};
        const mainStructureMembers = metadata.mainStructureMembers || {};

        const dimKeys = Object.keys(dimensions);
        const measureKeys = Object.keys(mainStructureMembers);

        if (dimKeys.length < 1 || measureKeys.length < 1) return;

        this._measId = measureKeys[0];
        
        const measureInfo = mainStructureMembers[this._measId] || {};
        const indicatorLabel = measureInfo.label || measureInfo.description || measureInfo.id || "Indicador";
        if (this._widgetTitle) {
          this._widgetTitle.textContent = `Overview - ${indicatorLabel}`;
        }

        this._tempoDimId = null;
        this._versaoDimId = null;
        this._itemFinanceiroDimId = null;
        this._contaContabilDimId = null;

        dimKeys.forEach(key => {
          const desc = String(dimensions[key].description || "").toUpperCase();
          const id = String(dimensions[key].id || "").toUpperCase();
          
          if (desc.includes("VERSÃO") || desc.includes("VERSION") || desc.includes("CENÁRIO") || id.includes("VERSION") || id.includes("CATEGORY")) {
            this._versaoDimId = key;
          } else if (desc.includes("TEMPO") || desc.includes("MÊS") || desc.includes("MES") || desc.includes("ANO") || desc.includes("DATE") || id.includes("TIME") || id.includes("CALENDAR")) {
            this._tempoDimId = key;
          } else if (desc.includes("ITEM") || id.includes("ITEM") || desc.includes("FINANCEIRO")) {
            this._itemFinanceiroDimId = key;
          } else if (desc.includes("CONTA") || id.includes("ACCOUNT") || desc.includes("CONTÁBIL") || desc.includes("CONTABIL")) {
            this._contaContabilDimId = key;
          }
        });

        if (!this._tempoDimId) this._tempoDimId = dimKeys[0];
        if (!this._versaoDimId) this._versaoDimId = dimKeys[1] || null;

        this._extraDimIds = dimKeys.filter(key => key !== this._tempoDimId && key !== this._versaoDimId);
        if (!this._itemFinanceiroDimId) this._itemFinanceiroDimId = this._extraDimIds[0] || null;
        if (!this._contaContabilDimId) this._contaContabilDimId = this._extraDimIds[1] || null;

        const timelineMap = {};
        const currentYearRuntime = new Date().getFullYear();

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

        const fullSeriesData = [];
        let defaultActualIndex = -1;

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

        const nowRuntime = new Date();
        let targetMonthNum = nowRuntime.getMonth(); 
        let targetYearNum = nowRuntime.getFullYear();
        
        if (targetMonthNum === 0) {
          targetMonthNum = 12; 
          targetYearNum -= 1;
        }

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

        const tEndJS = performance.now();
        const tStartDOM = performance.now();

        this._reconcileBarsAndLabels(visibleSeriesData, maxVal);
        this._renderDoubleFinancePanel(visibleSeriesData, fullSeriesData, actualIndex, calculatedBudget);

        requestAnimationFrame(() => {
          this._drawUnifiedFlatConnections(this._svgOverlay, this._chartArea, ".bar-element", visibleSeriesData, visibleActualIndex, "monthly");
          this._drawUnifiedFlatConnections(this._svgYtdOverlay, this._ytdChartArea, ".bar-element", this._ytdSeriesMock, 1, "ytd");
          
          const tEndDOM = performance.now();
          this._lblJS.textContent = `${(tEndJS - tStartJS).toFixed(2)} ms`;
          this._lblDOM.textContent = `${(tEndDOM - tStartDOM).toFixed(2)} ms`;
          this._lblReflow.textContent = `${this._reflowCount} passes`;
          this._lblVol.textContent = `${financialData.data.length} rows`;
        });

      } catch (error) {
        console.error("Erro interno no processamento visual:", error);
      }
    }

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
        for (let i = existingWrappers.length - 1; i >= targetLength; i--) {
          existingWrappers[i].remove();
        }
      }

      if (existingLabels.length < targetLength) {
        for (let i = existingLabels.length; i < targetLength; i++) {
          const axisLabel = document.createElement("div"); axisLabel.className = "axis-label";
          this._axisX.appendChild(axisLabel);
        }
      } else if (existingLabels.length > targetLength) {
        for (let i = existingLabels.length - 1; i >= targetLength; i--) {
          existingLabels[i].remove();
        }
      }

      const updatedWrappers = this._chartArea.querySelectorAll(".bar-wrapper");
      const updatedLabels = this._axisX.querySelectorAll(".axis-label");

      visibleSeriesData.forEach((d, idx) => {
        const bar = updatedWrappers[idx].querySelector(".bar-element");
        const label = bar.querySelector(".kpi-label");
        bar.className = `bar-element ${d.type}`;
        bar.style.height = `${(d.value / maxVal) * 100}%`;
        label.textContent = `${(d.value / 1000000).toFixed(2)}M`;

        const axisLabel = updatedLabels[idx];
        axisLabel.className = d.type === "actual" ? "axis-label actual-month" : "axis-label";
        axisLabel.textContent = d.label;
      });
    }

    _drawUnifiedFlatConnections(svg, container, barSelector, dataArray, actualIndex, mode) {
      if (!document.contains(this) || !this._shadowRoot || actualIndex === -1) return;
      
      const containerHeight = container.offsetHeight;
      if (containerHeight === 0) return;
      
      const barElements = container.querySelectorAll(barSelector);
      if (!barElements || barElements.length === 0) return;
      
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

      const ceilingY = -16;
      const floorY = containerHeight;

      let existingGroups = svg.querySelectorAll(".connector-group");

      while (existingGroups.length < pairs.length) {
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.setAttribute("class", "connector-group");
        
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("stroke", "#cbd5e0"); path.setAttribute("stroke-width", "1.25"); path.setAttribute("fill", "none");
        
        const fo = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
        fo.setAttribute("width", "70"); fo.setAttribute("height", "22");
        
        const div = document.createElement("div"); div.style.cssText = "display:flex; justify-content:center; align-items:center; width:100%; height:100%;";
        const span = document.createElement("span"); span.className = "variance-tag";
        
        div.appendChild(span); fo.appendChild(div); g.appendChild(path); g.appendChild(fo); svg.appendChild(g);
        existingGroups = svg.querySelectorAll(".connector-group");
      }

      for (let i = pairs.length; i < existingGroups.length; i++) {
        existingGroups[i].style.display = "none";
      }

      pairs.forEach((pair, idx) => {
        const g = existingGroups[idx];
        g.style.display = "block";
        
        const xFrom = barCenters[pair.from];
        const xTo = barCenters[pair.to];
        
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
        
        g.querySelector("path").setAttribute("d", `M ${xFrom} ${floorY} L ${xFrom} ${ceilingY} L ${xTo} ${ceilingY} L ${xTo} ${floorY}`);
        
        const fo = g.querySelector("foreignObject");
        const midX = xFrom + (xTo - xFrom) / 2;
        fo.setAttribute("x", (midX - 35).toString());
        fo.setAttribute("y", (ceilingY - 11).toString());
        
        const span = g.querySelector(".variance-tag");
        span.className = isCostSaving ? "variance-tag saving" : "variance-tag increase";
        span.textContent = varianceText;
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

      this._valDiffRow.textContent = (diffNominal >= 0 ? "+" : "") + formatM(diffNominal);
      this._valPctRow.textContent = formatPercent(diffPercent, isMonthSaving);
      this._valPctRow.className = "status-badge-finance " + (isMonthSaving ? "success" : "warning");
      this._valPctConsumptionRow.textContent = consumptionMonthPercent.toFixed(2) + "%";

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

      this._ytdDiffRow.textContent = (diffYtdNominal >= 0 ? "+" : "") + formatM(diffYtdNominal);
      this._ytdDiffPctBadge.textContent = formatPercent(diffYtdPercent, isYtdSaving);
      this._ytdDiffPctBadge.className = "status-badge-finance " + (isYtdSaving ? "success" : "warning");
      this._ytdPctRow.textContent = consumoBudgetPercent.toFixed(2) + "%";

      const maxYTD = Math.max(totalRealizadoYTDAntigo, totalRealizadoYTDAtual, totalBudgetYTDCompleto) * 1.10 || 1;
      this._miniBarPrev.style.height = `${(totalRealizadoYTDAntigo / maxYTD) * 100}%`;
      this._miniBarAct.style.style.height = `${(totalRealizadoYTDAtual / maxYTD) * 100}%`; // Limpeza dupla de sintaxe .style.style feita na versão quebrada antiga
      this._miniBarAct.style.height = `${(totalRealizadoYTDAtual / maxYTD) * 100}%`;
      this._miniBarBud.style.height = `${(totalBudgetYTDCompleto / maxYTD) * 100}%`;

      this._miniLblPrev.textContent = formatM(totalRealizadoYTDAntigo);
      this._miniLblAct.textContent = formatM(totalRealizadoYTDAtual);
      this._miniLblBud.textContent = formatM(totalBudgetYTDCompleto);

      this._shadowRoot.getElementById("ytd-axis-lbl-prev").textContent = `Ant. (${previousYear})`;
      this._shadowRoot.getElementById("ytd-axis-lbl-act").textContent = `Atual (${currentYear})`;

      this._ytdSeriesMock = [{ value: totalRealizadoYTDAntigo, type: "historical" }, { value: totalRealizadoYTDAtual, type: "actual" }, { value: totalBudgetYTDCompleto, type: "budget" }];

      if (this._highlightCardArea) {
        this._highlightCardArea.style.borderLeft = isYtdSaving ? "4px solid #2E7D32" : "4px solid #D32F2F";
      }

      if (this._periodSummaryBanner) {
        this._periodSummaryBanner.style.display = "block";
        this._periodSummaryBanner.className = isYtdSaving ? "period-summary-banner summary-saving" : "period-summary-banner summary-desvio";
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

      this._hlUl.textContent = "";

      const monthStatusText = isMonthSaving ? "economia de custos" : "estouro orçamentário";
      const semanticColorMonth = isMonthSaving ? "#2E7D32" : "#D32F2F";
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

      const analysis = this._analyticsEngine.analyze(
        this._currentData.data, currentBarNode, currentYear, previousYear,
        this._tempoDimId, this._versaoDimId, this._itemFinanceiroDimId, this._contaContabilDimId, this._measId, fullSeriesData
      );

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

      this._insightGrid.style.display = "grid";
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
