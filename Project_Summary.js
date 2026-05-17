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
        padding: 16px;
        box-sizing: border-box;
        font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        position: relative;
        overflow: hidden;
      }

      .widget-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        border-bottom: 1px solid #f0f0f0;
        padding-bottom: 8px;
      }

      .widget-title {
        font-size: 14px;
        font-weight: 700;
        color: #2c3e50;
      }

      .scale-tag {
        font-size: 11px;
        font-weight: 600;
        color: #7f8c8d;
        background: #f8f9fa;
        padding: 2px 8px;
        border-radius: 12px;
        border: 1px solid #e2e8f0;
      }

      .widget-legend {
        display: flex;
        gap: 16px;
        margin-bottom: 24px;
        font-size: 11px;
        font-weight: 600;
        color: #4a5568;
      }

      .legend-item {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .legend-color {
        width: 12px;
        height: 12px;
        border-radius: 3px;
      }

      .legend-color.hist { background-color: var(--color-historical); }
      .legend-color.act { background-color: var(--color-actual); }
      .legend-color.bud { 
        background-color: transparent; 
        border: 2px dashed var(--color-budget);
        box-sizing: border-box;
      }
      
      .chart-area {
        flex: 1;
        display: flex;
        position: relative;
        margin-bottom: 24px;
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
        padding: 0 8px;
      }
      
      .bar-element {
        width: 100%;
        max-width: 55px;
        transition: height 0.3s ease, background-color 0.3s ease;
        border-radius: 4px 4px 0 0;
        position: relative;
        display: flex;
        justify-content: center;
      }
      
      .bar-element.historical {
        background-color: var(--color-historical);
      }
      
      .bar-element.actual {
        background-color: var(--color-actual);
        box-shadow: 0 0 12px rgba(31, 119, 180, 0.45);
        border: 1px solid #15517b;
      }
      
      .bar-element.budget {
        background-color: transparent;
        border: 2px dashed var(--color-budget);
        box-sizing: border-box;
      }
      
      .kpi-label {
        position: absolute;
        top: -22px;
        font-size: var(--font-size-labels);
        font-weight: 700;
        color: #2d3748;
        white-space: nowrap;
      }

      .bar-element.actual .kpi-label {
        color: #1a202c;
        background: #edf2f7;
        padding: 1px 4px;
        border-radius: 4px;
        top: -24px;
      }
      
      .axis-x {
        display: flex;
        justify-content: space-between;
        border-top: 1px solid #cbd5e0;
        padding-top: 8px;
        height: 20px;
      }
      
      .axis-label {
        flex: 1;
        text-align: center;
        font-size: var(--font-size-labels);
        font-weight: 600;
        color: #718096;
        text-overflow: ellipsis;
        white-space: nowrap;
        overflow: hidden;
        padding: 0 4px;
      }

      .axis-label.actual-month {
        color: var(--color-actual);
        font-weight: 700;
      }
      
      .variance-tag {
        font-size: calc(var(--font-size-labels) - 1px);
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 4px;
        background-color: #ffffff;
        border: 1px solid #cbd5e0;
        box-shadow: 0 2px 4px rgba(0,0,0,0.08);
      }
      
      .placeholder-text {
        padding: 10px;
        color: #718096;
        font-size: 13px;
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

      <div class="chart-area" id="chartArea">
        <svg class="svg-overlay" id="svgOverlay">
          <defs>
            <marker id="arrow-green" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#2f855a"/>
            </marker>
            <marker id="arrow-red" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#c53030"/>
            </marker>
          </defs>
        </svg>
      </div>
      <div class="axis-x" id="axisX"></div>
    </div>
  `;

  class EvoSummaryWidget extends HTMLElement {
    constructor() {
      super();
      this._shadowRoot = this.attachShadow({ mode: "open" });
      this._shadowRoot.appendChild(template.content.cloneNode(true));

      this._chartArea = this._shadowRoot.getElementById("chartArea");
      this._svgOverlay = this._shadowRoot.getElementById("svgOverlay");
      this._axisX = this._shadowRoot.getElementById("axisX");

      this._props = {};
      this._currentData = null;
    }

    connectedCallback() {
      this._resizeObserver = new ResizeObserver(() => {
        if (document.contains(this)) {
          this.renderChart();
        }
      });
      this._resizeObserver.observe(this._chartArea);
    }

    disconnectedCallback() {
      if (this._resizeObserver) {
        this._resizeObserver.disconnect();
      }
    }

    onCustomWidgetBeforeUpdate(changedProperties) {
      this._props = { ...this._props, ...changedProperties };
    }

    onCustomWidgetAfterUpdate(changedProperties) {
      this._updateStyles();
      if ("performanceCube" in changedProperties && this.performanceCube) {
        this._currentData = this.performanceCube;
        this.renderChart();
      }
    }

    _updateStyles() {
      const style = this.style;
      if (this._props.colorActualMonth) style.setProperty("--color-actual", this._props.colorActualMonth);
      if (this._props.colorHistorical) style.setProperty("--color-historical", this._props.colorHistorical);
      if (this._props.colorBudget) style.setProperty("--color-budget", this._props.colorBudget);
      if (this._props.fontSizeLabels) style.setProperty("--font-size-labels", `${this._props.fontSizeLabels}px`);
    }

    renderChart() {
      if (!document.contains(this)) {
        setTimeout(() => this.renderChart(), 0);
        return;
      }

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

        const parseNumber = (val) => {
          if (typeof val === 'number') return val;
          if (!val || val === "-") return 0;
          return parseFloat(String(val).replace(/[^0-9.,-]/g, '').replace(',', '.')) || 0;
        };

        const timelineMap = {};

        financialData.data.forEach(row => {
          const tempoObj = row[tempoDimId];
          if (!tempoObj) return;

          const tId = String(tempoObj.id);
          const tLabel = tempoObj.label || tempoObj.description || tId;

          if (tId.toLowerCase().includes("(all)") || tLabel.toLowerCase().includes("(all)")) return;

          if (!timelineMap[tId]) {
            timelineMap[tId] = {
              id: tId,
              label: tLabel,
              realizado: 0,
              orcado: 0,
              isCurrentMonth: false
            };
          }

          if (tempoObj.properties && (tempoObj.properties.isCurrent === "true" || tempoObj.properties.isCurrent === true)) {
            timelineMap[tId].isCurrentMonth = true;
          }
          if (row.versionContext && row.versionContext.isActualMonth) {
            timelineMap[tId].isCurrentMonth = true;
          }

          const measObj = row[measId];
          const rawValue = parseNumber(measObj ? (measObj.formattedValue || measObj.raw || 0) : 0);

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
          this._axisX.innerHTML = "<div class='placeholder-text'>Nenhum dado válido encontrado.</div>";
          return;
        }

        const seriesData = [];
        let actualIndex = -1;

        // Montagem da série cronológica linear estável
        sortedMonths.forEach((m, idx) => {
          const type = m.isCurrentMonth ? "actual" : "historical";
          if (type === "actual") actualIndex = idx;

          seriesData.push({
            label: m.label,
            value: m.realizado,
            type: type,
            rawValues: m
          });
        });

        if (actualIndex === -1 && seriesData.length > 0) {
          actualIndex = seriesData.length - 1;
          seriesData[actualIndex].type = "actual";
        }

        // ALINHAMENTO DO MÊS DO BUDGET (Anexo 1): Injeta a barra de orçamento na mesma competência do mês atual
        const targetBudgetSource = sortedMonths[actualIndex];
        seriesData.push({
          label: `budget - ${targetBudgetSource.label}`,
          value: targetBudgetSource.orcado > 0 ? targetBudgetSource.orcado : targetBudgetSource.realizado,
          type: "budget",
          rawValues: targetBudgetSource
        });

        this._clearDOM();

        const maxVal = Math.max(...seriesData.map(d => d.value)) * 1.25 || 1;
        const barElements = [];

        seriesData.forEach((d, index) => {
          const barWrapper = document.createElement("div");
          barWrapper.className = "bar-wrapper";

          const barElement = document.createElement("div");
          barElement.className = "bar-element";
          
          const pctHeight = (d.value / maxVal) * 100;
          barElement.style.height = `${pctHeight}%`;
          barElement.classList.add(d.type);

          const valueInMillions = d.value / 1000000;
          const kpiLabel = document.createElement("span");
          kpiLabel.className = "kpi-label";
          kpiLabel.textContent = valueInMillions.toFixed(1) + "M";
          barElement.appendChild(kpiLabel);

          barWrapper.appendChild(barElement);
          this._chartArea.appendChild(barWrapper);
          barElements.push(barElement);

          const axisLabel = document.createElement("div");
          axisLabel.className = "axis-label";
          axisLabel.textContent = d.label;
          if (d.type === "actual") {
            axisLabel.classList.add("actual-month");
          }
          this._axisX.appendChild(axisLabel);
        });

        // Execução do desenho dos conectores retos estruturados
        requestAnimationFrame(() => {
          this._drawOrthogonalConnections(barElements, seriesData, actualIndex);
        });

      } catch (error) {
        console.error("Erro interno no processamento visual:", error);
      }
    }

    _clearDOM() {
      const existingBars = this._chartArea.querySelectorAll(".bar-wrapper");
      existingBars.forEach((el) => el.remove());
      while (this._axisX.firstChild) {
        this._axisX.removeChild(this._axisX.firstChild);
      }
      const svg = this._svgOverlay;
      while (svg.firstChild && svg.firstChild.nodeName !== 'defs') {
        svg.removeChild(svg.firstChild);
      }
      const markers = svg.querySelectorAll(':not(defs):not(marker):not(path)');
      markers.forEach(el => el.remove());
    }

    // CONECTORES ORTOGONAIS (Anexo 2): Traça linhas em formato de degrau reto com setas e variação
    _drawOrthogonalConnections(barElements, seriesData, actualIndex) {
      if (!document.contains(this) || actualIndex === -1) return;

      const svgRect = this._svgOverlay.getBoundingClientRect();
      if (svgRect.width === 0 || svgRect.height === 0) return;

      const pairsToConnect = [];
      if (actualIndex > 0) pairsToConnect.push({ from: actualIndex - 1, to: actualIndex, isToBudget: false });
      if (actualIndex < barElements.length - 1) pairsToConnect.push({ from: actualIndex, to: actualIndex + 1, isToBudget: true });

      // Determina a altura máxima do teto para que as linhas paralelas não colidam entre si
      const topY1 = barElements[actualIndex].getBoundingClientRect().top - svgRect.top;
      const topY0 = actualIndex > 0 ? barElements[actualIndex - 1].getBoundingClientRect().top - svgRect.top : topY1;
      const highestBarY = Math.min(topY1, topY0) - 35; 

      pairsToConnect.forEach((pair, pIdx) => {
        const currentBar = barElements[pair.from];
        const nextBar = barElements[pair.to];

        if (!currentBar || !nextBar) return;

        const currRect = currentBar.getBoundingClientRect();
        const nextRect = nextBar.getBoundingClientRect();

        const x1 = currRect.left + currRect.width / 2 - svgRect.left;
        const y1 = currRect.top - svgRect.top;
        const x2 = nextRect.left + nextRect.width / 2 - svgRect.left;
        const y2 = nextRect.top - svgRect.top;

        const val1 = seriesData[pair.from].value;
        const val2 = seriesData[pair.to].value;
        
        let varianceText = "0%";
        if (val1 !== 0) {
          const variance = ((val2 - val1) / val1) * 100;
          varianceText = (variance >= 0 ? "+" : "") + variance.toFixed(1) + "%";
        }

        const isPositiveVariance = val2 >= val1;
        // Economia/Queda de custo (Realizado menor ou Budget menor) = Verde [cite: 124, 280]
        const strokeColor = isPositiveVariance ? "#c53030" : "#2f855a"; 
        const markerId = isPositiveVariance ? "url(#arrow-red)" : "url(#arrow-green)";

        // Calibração do teto do degrau ortogonal para evitar sobreposição de linhas paralelas
        const stepY = pair.isToBudget ? highestBarY : highestBarY - 18;

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        // Desenho do cano rígido em formato de degrau com seta terminal apontando para baixo (M -> H -> V)
        path.setAttribute("d", `M ${x1} ${y1} L ${x1} ${stepY} L ${x2} ${stepY} L ${x2} ${y2 - 6}`);
        path.setAttribute("stroke", strokeColor);
        path.setAttribute("stroke-width", "1.5");
        path.setAttribute("fill", "none");
        path.setAttribute("marker-end", markerId);
        this._svgOverlay.appendChild(path);

        // Injeção da caixa de texto de variação centralizada no eixo horizontal do degrau
        const midX = x1 + (x2 - x1) / 2;

        const foreignObj = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
        foreignObj.setAttribute("x", (midX - 35).toString());
        foreignObj.setAttribute("y", (stepY - 11).toString());
        foreignObj.setAttribute("width", "70");
        foreignObj.setAttribute("height", "24");

        const div = document.createElement("div");
        div.style.display = "flex";
        div.style.justify = "center";
        div.style.alignItems = "center";
        div.style.width = "100%";
        div.style.height = "100%";

        const span = document.createElement("span");
        span.className = "variance-tag";
        span.textContent = varianceText;
        span.style.color = strokeColor;
        span.style.borderColor = strokeColor;
        span.style.fontSize = "10px";
        span.style.padding = "1px 4px";

        div.appendChild(span);
        foreignObj.appendChild(div);
        this._svgOverlay.appendChild(foreignObj);
      });
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
