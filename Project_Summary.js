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
        padding: 12px 16px;
        box-sizing: border-box;
        font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        position: relative;
        overflow-y: auto;
        overflow-x: hidden;
      }

      .widget-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
        border-bottom: 1px solid #f0f0f0;
        padding-bottom: 6px;
        flex-shrink: 0;
      }

      .widget-title {
        font-size: 13px;
        font-weight: 700;
        color: #2c3e50;
      }

      .scale-tag {
        font-size: 10px;
        font-weight: 600;
        color: #7f8c8d;
        background: #f8f9fa;
        padding: 1px 6px;
        border-radius: 10px;
        border: 1px solid #e2e8f0;
      }

      .widget-legend {
        display: flex;
        gap: 14px;
        margin-bottom: 12px;
        font-size: 10.5px;
        font-weight: 600;
        color: #4a5568;
        flex-shrink: 0;
      }

      .legend-item {
        display: flex;
        align-items: center;
        gap: 5px;
      }

      .legend-color {
        width: 10px;
        height: 10px;
        border-radius: 2px;
      }

      .legend-color.hist { background-color: var(--color-historical); }
      .legend-color.act { background-color: var(--color-actual); }
      .legend-color.bud { 
        background-color: transparent; 
        border: 1.5px dashed var(--color-budget);
        box-sizing: border-box;
      }
      
      .chart-container-block {
        position: relative;
        height: 155px; 
        padding-top: 25px; 
        margin-bottom: 4px;
        flex-shrink: 0;
        box-sizing: border-box;
      }

      .chart-area {
        width: 100%;
        height: 100%;
        display: flex;
        position: relative;
        align-items: flex-end;
        justify-content: space-between;
      }
      
      .svg-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 2;
      }
      
      .bar-wrapper {
        display: flex;
        flex-direction: column;
        align-items: center;
        flex: 1;
        height: 100%;
        justify-content: flex-end;
        position: relative;
        z-index: 1;
        padding: 0 4px;
      }
      
      .bar-element {
        width: 100%;
        max-width: 46px;
        border-radius: 3px 3px 0 0;
        position: relative;
        display: flex;
        justify-content: center;
      }
      
      .bar-element.historical {
        background-color: var(--color-historical);
      }
      
      .bar-element.actual {
        background-color: var(--color-actual);
        box-shadow: 0 0 10px rgba(31, 119, 180, 0.35);
        border: 1px solid #15517b;
      }
      
      .bar-element.budget {
        background-color: transparent;
        border: 2px dashed var(--color-budget);
        box-sizing: border-box;
      }
      
      .kpi-label {
        position: absolute;
        top: -20px;
        font-size: calc(var(--font-size-labels) - 0.5px);
        font-weight: 700;
        color: #2d3748;
        white-space: nowrap;
      }

      .bar-element.actual .kpi-label {
        color: #1a202c;
        background: #edf2f7;
        padding: 1px 4px;
        border-radius: 4px;
        top: -22px;
      }
      
      .axis-x-block {
        display: flex;
        flex-direction: column;
        flex-shrink: 0;
        margin-bottom: 14px;
        border-top: 1px solid #cbd5e0;
        padding-top: 6px;
      }

      .axis-x {
        display: flex;
        justify-content: space-between;
        height: 18px;
      }
      
      .axis-label {
        flex: 1;
        text-align: center;
        font-size: calc(var(--font-size-labels) - 0.5px);
        font-weight: 600;
        color: #718096;
        text-overflow: ellipsis;
        white-space: nowrap;
        overflow: hidden;
        padding: 0 1px;
      }

      .axis-label.actual-month {
        color: var(--color-actual);
        font-weight: 700;
      }
      
      .variance-tag {
        font-size: calc(var(--font-size-labels) - 2px);
        font-weight: 700;
        padding: 1px 5px;
        border-radius: 3px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.06);
        white-space: nowrap;
        border: 1px solid transparent;
        display: inline-block;
      }

      .variance-tag.saving {
        background-color: #e6f4ea;
        color: #137333;
        border-color: #ceead6;
      }

      .variance-tag.increase {
        background-color: #fef7e0;
        color: #b06000;
        border-color: #feebc8;
      }

      .insight-grid {
        display: grid;
        grid-template-columns: 1.1fr 0.9fr;
        gap: 16px;
        margin-top: auto;
        padding-top: 12px;
        border-top: 1px solid #f0f0f0;
        flex-shrink: 0;
      }

      @media (max-width: 620px) {
        .insight-grid {
          grid-template-columns: 1fr;
          gap: 12px;
        }
      }

      .data-table-holder {
        width: 100%;
      }

      .kpi-table {
        width: 100%;
        border-collapse: collapse;
        font-size: calc(var(--font-size-labels) - 0.5px);
        text-align: left;
      }

      .kpi-table th {
        color: #718096;
        font-weight: 600;
        padding-bottom: 6px;
        border-bottom: 2px solid #edf2f7;
      }

      .kpi-table td {
        padding: 6px 0;
        border-bottom: 1px solid #edf2f7;
        color: #2d3748;
        font-weight: 500;
      }

      .kpi-table tr:last-child td {
        border-bottom: none;
      }

      .kpi-table .row-title {
        font-weight: 600;
        color: #4a5568;
        display: flex;
        align-items: center;
        gap: 5px;
      }

      .kpi-table .row-title::before {
        content: '';
        width: 3.5px;
        height: 11px;
        background: #cbd5e0;
        border-radius: 2px;
        display: inline-block;
      }

      .kpi-table tr.highlighted-row .row-title::before {
        background: var(--color-actual);
      }

      .kpi-table .num-cell {
        text-align: right;
        font-variant-numeric: tabular-nums;
      }

      .kpi-table .bold-val {
        font-weight: 700;
        color: #1a202c;
      }

      .text-insight-holder {
        display: flex;
        flex-direction: column;
        background-color: #f8fafc;
        border-radius: 5px;
        padding: 10px 12px;
        border-left: 3px solid #cbd5e0;
        box-sizing: border-box;
      }

      .text-insight-holder.saving { border-left-color: #34a853; }
      .text-insight-holder.increase { border-left-color: #f9ab00; }

      /* CORREÇÃO DO CABEÇALHO DA CAIXA: Renomeado para Highlights (Anexo 2) */
      .insight-box-header {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: calc(var(--font-size-labels) - 0.5px);
        font-weight: 700;
        color: #2d3748;
        margin-bottom: 8px;
        padding-bottom: 4px;
        border-bottom: 1px dashed #e2e8f0;
      }

      .insight-box-header svg {
        width: 14px;
        height: 14px;
        fill: currentColor;
      }

      .insight-paragraph {
        margin: 0;
        font-size: var(--font-size-labels);
        line-height: 1.48;
        color: #4a5568;
      }

      .inline-highlight {
        font-weight: 700;
        padding: 0px 3px;
        border-radius: 2px;
      }

      .inline-highlight.saving {
        background-color: #e6f4ea;
        color: #137333;
      }

      .inline-highlight.increase {
        background-color: #fef7e0;
        color: #b06000;
      }
      
      .placeholder-text {
        padding: 8px;
        color: #718096;
        font-size: 12px;
      }
    </style>
    <div id="widget-wrapper">
      <div class="widget-header">
        <div class="widget-title">Performance Mensal</div>
        <div class="scale-tag">Valores em Milhões (M)</div>
      </div>
      
      <div class="widget-legend">
        <div class="legend-item"><div class="legend-color hist"></div> Histórico (Realizado)</div>
        <div class="legend-item"><div class="legend-color act"></div> Mês Atual (Realizado)</div>
        <div class="legend-item"><div class="legend-color bud"></div> Orçado (Budget)</div>
      </div>

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

      <div class="insight-grid" id="insightGrid" style="display: none;">
        <div class="data-table-holder">
          <table class="kpi-table">
            <thead>
              <tr>
                <th>Cenário Comercial</th>
                <th class="num-cell">Valor Absoluto</th>
                <th class="num-cell">Var. Nominal</th>
              </tr>
            </thead>
            <tbody>
              <tr class="highlighted-row">
                <td class="row-title" id="lbl-act-row">Realizado</td>
                <td class="num-cell bold-val" id="val-act-row">-</td>
                <td class="num-cell">—</td>
              </tr>
              <tr>
                <td class="row-title">Orçado (Budget)</td>
                <td class="num-cell" id="val-bud-row">-</td>
                <td class="num-cell">—</td>
              </tr>
              <tr>
                <td class="row-title">Desvio Geral</td>
                <td class="num-cell bold-val" id="val-diff-row">-</td>
                <td class="num-cell bold-val" id="val-pct-row">-</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="text-insight-holder" id="textInsightBox">
          <div class="insight-box-header">
            <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
            <span>Highlights</span>
          </div>
          <p class="insight-paragraph" id="insightTextDesc"></p>
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
    }

    connectedCallback() {
      if (!this._shadowRoot) {
        this._shadowRoot = this.attachShadow({ mode: "open" });
        this._shadowRoot.appendChild(template.content.cloneNode(true));
        
        this._chartArea = this._shadowRoot.getElementById("chartArea");
        this._svgOverlay = this._shadowRoot.getElementById("svgOverlay");
        this._axisX = this._shadowRoot.getElementById("axisX");
        this._insightGrid = this._shadowRoot.getElementById("insightGrid");
        
        this._lblActRow = this._shadowRoot.getElementById("lbl-act-row");
        this._valActRow = this._shadowRoot.getElementById("val-act-row");
        this._valBudRow = this._shadowRoot.getElementById("val-bud-row");
        this._valDiffRow = this._shadowRoot.getElementById("val-diff-row");
        this._valPctRow = this._shadowRoot.getElementById("val-pct-row");
        this._textInsightBox = this._shadowRoot.getElementById("textInsightBox");
        this._insightTextDesc = this._shadowRoot.getElementById("insightTextDesc");
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

    onCustomWidgetBeforeUpdate(changedProperties) {
      this._props = { ...this._props, ...changedProperties };
    }

    onCustomWidgetAfterUpdate(changedProperties) {
      this._updateStyles();
      if ("performanceCube" in changedProperties && this.performanceCube) {
        this._currentData = this.performanceCube;
        if (this._shadowRoot) {
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
      
      while (this._axisX.firstChild) {
        this._axisX.removeChild(this._axisX.firstChild);
      }

      const svg = this._svgOverlay;
      const paths = svg.querySelectorAll('path');
      const objects = svg.querySelectorAll('foreignObject');
      paths.forEach(el => el.remove());
      objects.forEach(el => el.remove());

      this._insightGrid.style.display = "none";
    }

    renderChart() {
      if (!document.contains(this) || !this._shadowRoot) return;

      const financialData = this._currentData;
      if (!financialData || !financialData.data || financialData.data.length === 0) {
        this._clearDOM();
        this._axisX.innerHTML = "<div class='placeholder-text'>Aguardando dados no Builder...</div>";
        return;
      }

      try {
        const metadata = financialData.metadata;
        const dimensions = metadata.dimensions || {};
        const mainStructureMembers = metadata.mainStructureMembers || {};

        const dimKeys = Object.keys(dimensions);
        const measureKeys = Object.keys(mainStructureMembers);

        if (dimKeys.length < 1 || measureKeys.length < 1) {
          this._clearDOM();
          this._axisX.innerHTML = "<div class='placeholder-text' style='color:#D32F2F;'>Adicione as Dimensões e Medidas no Builder.</div>";
          return;
        }

        const measId = measureKeys[0];
        let tempoDimId = dimKeys[0];
        let versaoDimId = dimKeys[1] || null;

        if (dimKeys.length >= 2) {
          const descFirst = String(dimensions[dimKeys[0]].description || "").toUpperCase();
          if (descFirst.includes("VERSÃO") || descFirst.includes("VERSION") || descFirst.includes("CENÁRIO")) {
            tempoDimId = dimKeys[1];
            versaoDimId = dimKeys[0];
          }
        }

        const timelineMap = {};

        financialData.data.forEach(row => {
          const tempoObj = row[tempoDimId];
          if (!tempoObj) return;

          const tId = String(tempoObj.id);
          const tLabel = tempoObj.label || tempoObj.description || tId;

          if (tId.toLowerCase().includes("(all)") || tLabel.toLowerCase().includes("(all)")) return;

          if (!timelineMap[tId]) {
            timelineMap[tId] = { id: tId, label: tLabel, realizado: 0, orcado: 0, isCurrentMonth: false };
          }

          if (tempoObj.properties && (tempoObj.properties.isCurrent === "true" || tempoObj.properties.isCurrent === true)) {
            timelineMap[tId].isCurrentMonth = true;
          }
          if (row.versionContext && row.versionContext.isActualMonth) {
            timelineMap[tId].isCurrentMonth = true;
          }

          const rawValue = this._parseValue(row[measId] ? (row[measId].formattedValue || row[measId].raw || 0) : 0);

          if (versaoDimId) {
            const vObj = row[versaoDimId];
            if (vObj) {
              const vId = String(vObj.id).toUpperCase();
              const vLabel = String(vObj.label || vObj.description || "").toUpperCase();
              
              if (vId.includes("ORÇADO") || vId.includes("ORCADO") || vId.includes("BUDGET") || vLabel.includes("ORÇADO") || vLabel.includes("BUDGET")) {
                timelineMap[tId].orcado += rawValue;
              } else {
                timelineMap[tId].realizado += rawValue;
              }
            }
          } else {
            timelineMap[tId].realizado += rawValue;
          }
        });

        const sortedMonths = Object.values(timelineMap);
        if (sortedMonths.length === 0) {
          this._clearDOM();
          return;
        }

        const seriesData = [];
        let actualIndex = -1;

        sortedMonths.forEach((m, idx) => {
          const type = m.isCurrentMonth ? "actual" : "historical";
          if (type === "actual") actualIndex = idx;

          // IDENTIFICAÇÃO DE ANO NO EIXO (Anexo 1): Extrai o ano do ID ou String (Formato Jan 25, Mar 25)
          let finalLabel = m.label;
          let foundYear = "";
          const matches = m.id.match(/\\d{4}/);
          if (matches) foundYear = matches[0].substring(2, 4);
          
          if (foundYear && !finalLabel.includes(foundYear)) {
            finalLabel = `${finalLabel} ${foundYear}`;
          }

          seriesData.push({ label: finalLabel, value: m.realizado, type });
        });

        if (actualIndex === -1 && seriesData.length > 0) {
          actualIndex = seriesData.length - 1;
          seriesData[actualIndex].type = "actual";
        }

        const targetBudgetSource = sortedMonths[actualIndex];
        const calculatedBudget = targetBudgetSource.orcado > 0 ? targetBudgetSource.orcado : targetBudgetSource.realizado;
        
        seriesData.push({
          label: `budget - ${seriesData[actualIndex].label}`,
          value: calculatedBudget,
          type: "budget"
        });

        this._clearDOM();

        const maxVal = Math.max(...seriesData.map(d => d.value)) * 1.25 || 1;
        const barElements = [];

        seriesData.forEach((d) => {
          const barWrapper = document.createElement("div");
          barWrapper.className = "bar-wrapper";

          const barElement = document.createElement("div");
          barElement.className = "bar-element";
          barElement.style.height = `${(d.value / maxVal) * 100}%`;
          barElement.classList.add(d.type);

          const kpiLabel = document.createElement("span");
          kpiLabel.className = "kpi-label";
          kpiLabel.textContent = (d.value / 1000000).toFixed(1) + "M";
          barElement.appendChild(kpiLabel);

          barWrapper.appendChild(barElement);
          this._chartArea.appendChild(barWrapper);
          barElements.push(barElement);

          const axisLabel = document.createElement("div");
          axisLabel.className = "axis-label";
          axisLabel.textContent = d.label;
          if (d.type === "actual") axisLabel.classList.add("actual-month");
          this._axisX.appendChild(axisLabel);
        });

        this._drawUnifiedFlatConnections(barElements, seriesData, actualIndex);
        this._renderInsightPanel(seriesData, sortedMonths, actualIndex, calculatedBudget);

      } catch (error) {
        console.error("Erro interno no processamento visual:", error);
      }
    }

    _drawUnifiedFlatConnections(barElements, seriesData, actualIndex) {
      if (!document.contains(this) || !this._shadowRoot || actualIndex === -1) return;

      const svg = this._svgOverlay;
      const containerHeight = this._chartArea.offsetHeight;
      if (containerHeight === 0) return;

      const pairsToConnect = [];
      if (actualIndex > 0) pairsToConnect.push({ from: actualIndex - 1, to: actualIndex });
      if (actualIndex < barElements.length - 1) pairsToConnect.push({ from: actualIndex, to: actualIndex + 1 });

      const getBarCenterAndTop = (idx) => {
        const bar = barElements[idx];
        if (!bar) return { x: 0, y: 0 };
        return {
          x: bar.parentElement.offsetLeft + bar.offsetLeft + (bar.offsetWidth / 2),
          y: containerHeight - bar.offsetHeight
        };
      };

      let maxBarHeight = 0;
      barElements.forEach(bar => {
        if (bar.offsetHeight > maxBarHeight) maxBarHeight = bar.offsetHeight;
      });

      const globalCeilingY = containerHeight - maxBarHeight - 16;

      pairsToConnect.forEach((pair) => {
        const coordFrom = getBarCenterAndTop(pair.from);
        const coordTo = getBarCenterAndTop(pair.to);
        if (coordFrom.x === 0 && coordTo.x === 0) return;

        const val1 = seriesData[pair.from].value;
        const val2 = seriesData[pair.to].value;
        
        let varianceText = "0%";
        if (val1 !== 0) {
          const variance = ((val2 - val1) / val1) * 100;
          varianceText = (variance >= 0 ? "+" : "") + variance.toFixed(1) + "%";
        }

        const lineStrokeColor = "#718096";
        const markerId = "url(#arrow-neutral)";

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", `M ${coordFrom.x} ${coordFrom.y} L ${coordFrom.x} ${globalCeilingY} L ${coordTo.x} ${globalCeilingY} L ${coordTo.x} ${coordTo.y - 5}`);
        path.setAttribute("stroke", lineStrokeColor);
        path.setAttribute("stroke-width", "1.25");
        path.setAttribute("fill", "none");
        path.setAttribute("marker-end", markerId);
        svg.appendChild(path);

        const midX = coordFrom.x + (coordTo.x - coordFrom.x) / 2;

        const foreignObj = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
        foreignObj.setAttribute("x", (midX - 35).toString());
        foreignObj.setAttribute("y", (globalCeilingY - 11).toString());
        foreignObj.setAttribute("width", "70");
        foreignObj.setAttribute("height", "22");

        const div = document.createElement("div");
        div.style.display = "flex";
        div.style.justify = "center";
        div.style.alignItems = "center";
        div.style.width = "100%";
        div.style.height = "100%";

        const span = document.createElement("span");
        span.className = "variance-tag";
        span.textContent = varianceText;
        
        if (val2 > val1) {
          span.classList.add("increase");
        } else {
          span.classList.add("saving");
        }

        div.appendChild(span);
        foreignObj.appendChild(div);
        svg.appendChild(foreignObj);
      });
    }

    _renderInsightPanel(seriesData, sortedMonths, actualIndex, budgetVal) {
      const currentMonthNode = sortedMonths[actualIndex];
      const actualVal = currentMonthNode.realizado;
      const monthLabel = seriesData[actualIndex].label;

      const diffNominal = actualVal - budgetVal;
      const diffPercent = budgetVal !== 0 ? (diffNominal / budgetVal) * 100 : 0;
      
      const formatM = (v) => (v / 1000000).toFixed(2) + "M";
      const formatNominal = (v) => (v >= 0 ? "+" : "") + (v / 1000000).toFixed(2) + "M";
      const formatPercent = (v) => (v >= 0 ? "+" : "") + v.toFixed(1) + "%";

      this._lblActRow.textContent = `Realizado (${monthLabel})`;
      this._valActRow.textContent = formatM(actualVal);
      this._valBudRow.textContent = formatM(budgetVal);
      this._valDiffRow.textContent = formatM(diffNominal);
      this._valPctRow.textContent = formatPercent(diffPercent);

      this._textInsightBox.className = "text-insight-holder";
      
      let semClassBudget = diffNominal > 0 ? "increase" : "saving";
      let statusTextBudget = diffNominal > 0 ? "aumento de custos" : "eficiência operacional";
      let relatoFimBudget = diffNominal > 0 ? "acima do teto projetado." : "abaixo da meta orçada.";

      this._textInsightBox.classList.add(semClassBudget);

      let dynamicNarration = `
        A performance consolidada de <span class="bold-val">${monthLabel}</span> atingiu 
        <span class="bold-val">${formatM(actualVal)}</span>. Em relação ao orçamento planejado (Budget), 
        o desvim nominal foi de <span class="inline-highlight ${semClassBudget}">${formatNominal(diffNominal)}</span> 
        (<span class="inline-highlight ${semClassBudget}">${formatPercent(diffPercent)}</span>), configurando 
        um quadro de <span class="bold-val">${statusTextBudget}</span> ${relatoFimBudget}
      `;

      // ADIÇÃO DE INTELIGÊNCIA COMPARTIMENTADA: Análise Temporal em relação ao mês anterior (Anexo 2)
      if (actualIndex > 0) {
        const prevMonthVal = sortedMonths[actualIndex - 1].realizado;
        const prevMonthLabel = seriesData[actualIndex - 1].label;
        const diffPrev = actualVal - prevMonthVal;
        const diffPrevPct = prevMonthVal !== 0 ? (diffPrev / prevMonthVal) * 100 : 0;

        let semClassPrev = diffPrev > 0 ? "increase" : "saving";
        let statusTextPrev = diffPrev > 0 ? "um avanço sequencial de despesas" : "uma contração estável de custos";

        dynamicNarration += `
          <br><br><b>Comparado ao mês anterior (${prevMonthLabel}):</b> A oscilação nominal fechou em 
          <span class="inline-highlight ${semClassPrev}">${formatNominal(diffPrev)}</span> 
          (<span class="inline-highlight ${semClassPrev}">${formatPercent(diffPrevPct)}</span>), registrando 
          <span class="bold-val">${statusTextPrev}</span> na performance evolutiva dos períodos.
        `;
      }

      this._insightTextDesc.innerHTML = dynamicNarration;
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

  if (!customElements.get("sac-summary")) {
    customElements.define("sac-summary", EvoSummaryWidget);
  }
})();
