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
      }
      
      .widget-container {
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        padding: 16px;
        display: flex;
        flex-direction: column;
        font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        position: relative;
        overflow: hidden;
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
        max-width: 60px;
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
      }
      
      .bar-element.budget {
        background-color: transparent;
        border: 2px dashed var(--color-budget);
        box-sizing: border-box;
      }
      
      .kpi-label {
        position: absolute;
        top: -20px;
        font-size: var(--font-size-labels);
        font-weight: 600;
        color: #333333;
        white-space: nowrap;
      }
      
      .axis-x {
        display: flex;
        justify-content: space-between;
        border-top: 1px solid #dcdcdc;
        padding-top: 8px;
        height: 20px;
      }
      
      .axis-label {
        flex: 1;
        text-align: center;
        font-size: var(--font-size-labels);
        color: #666666;
        text-overflow: ellipsis;
        white-space: nowrap;
        overflow: hidden;
        padding: 0 4px;
      }
      
      .variance-tag {
        font-size: calc(var(--font-size-labels) - 1px);
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 4px;
        background-color: #ffffff;
        border: 1px solid #e0e0e0;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      }
    </style>
    <div class="widget-container">
      <div class="chart-area" id="chartArea">
        <svg class="svg-overlay" id="svgOverlay"></svg>
      </div>
      <div class="axis-x" id="axisX"></div>
    </div>
  `;

  class SACPerformanceBarWidget extends HTMLElement {
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
          this._renderChart();
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
      }
      
      this._renderChart();
    }

    _updateStyles() {
      const style = this.style;
      if (this._props.colorActualMonth) style.setProperty("--color-actual", this._props.colorActualMonth);
      if (this._props.colorHistorical) style.setProperty("--color-historical", this._props.colorHistorical);
      if (this._props.colorBudget) style.setProperty("--color-budget", this._props.colorBudget);
      if (this._props.fontSizeLabels) style.setProperty("--font-size-labels", `${this._props.fontSizeLabels}px`);
    }

    _renderChart() {
      // Validação de Acoplamento do Nó no DOM Principal (Defesa de Escopo EvoStream)
      if (!document.contains(this)) {
        setTimeout(() => this._renderChart(), 0);
        return;
      }

      const financialData = this._currentData;
      if (!financialData || !financialData.data || financialData.data.length === 0) {
        return;
      }

      try {
        const resultSet = financialData.data;
        const metadata = financialData.metadata;

        const dimensions = metadata.dimensions || {};
        const measures = metadata.mainStructureMembers || {};

        const dimKeys = Object.keys(dimensions);
        const measureKeys = Object.keys(measures);

        if (dimKeys.length < 1 || measureKeys.length < 1) {
          return;
        }

        const dimId = dimKeys[0];
        const measId = measureKeys[0];

        // Limpeza preventiva e atômica do DOM secundário
        const existingBars = this._chartArea.querySelectorAll(".bar-wrapper");
        existingBars.forEach((el) => el.remove());
        
        while (this._axisX.firstChild) {
          this._axisX.removeChild(this._axisX.firstChild);
        }
        while (this._svgOverlay.firstChild) {
          this._svgOverlay.removeChild(this._svgOverlay.firstChild);
        }

        const parseNumber = (val) => {
          if (typeof val === 'number') return val;
          if (!val || val === "-") return 0;
          return parseFloat(String(val).replace(/[^0-9.,-]/g, '').replace(',', '.')) || 0;
        };

        const maxVal = Math.max(...resultSet.map((row) => {
          const mObj = row[measId];
          const val = mObj ? (mObj.formattedValue || mObj.raw || 0) : 0;
          return parseNumber(val);
        })) * 1.15 || 1;

        const barElements = [];

        resultSet.forEach((row, index) => {
          const dimObj = row[dimId];
          const measObj = row[measId];
          if (!dimObj || !measObj) return;
          
          const labelText = dimObj.label || dimObj.description || dimObj.id || "N/D";
          const rawValue = parseNumber(measObj.formattedValue || measObj.raw || 0);
          const formattedValue = measObj.formattedValue || rawValue.toString();

          const barWrapper = document.createElement("div");
          barWrapper.className = "bar-wrapper";

          const barElement = document.createElement("div");
          barElement.className = "bar-element";
          
          const pctHeight = (rawValue / maxVal) * 100;
          barElement.style.height = `${pctHeight}%`;

          let versionType = "historical";
          if (index === resultSet.length - 1) {
            versionType = "budget";
          } else if (row.versionContext && row.versionContext.isActualMonth) {
            versionType = "actual";
          } else if (dimObj.properties && dimObj.properties.isCurrent === "true") {
            versionType = "actual";
          }

          barElement.classList.add(versionType);

          const kpiLabel = document.createElement("span");
          kpiLabel.className = "kpi-label";
          kpiLabel.textContent = formattedValue;
          barElement.appendChild(kpiLabel);

          barWrapper.appendChild(barElement);
          this._chartArea.appendChild(barWrapper);
          barElements.push(barElement);

          const axisLabel = document.createElement("div");
          axisLabel.className = "axis-label";
          axisLabel.textContent = labelText;
          this._axisX.appendChild(axisLabel);
        });

        // Agendamento seguro da renderização de vetores (SVG) pós-layout do navegador
        requestAnimationFrame(() => {
          this._drawConnections(barElements, resultSet, measId, parseNumber);
        });

      } catch (error) {
        console.error("Erro na renderização do Custom Widget:", error);
      }
    }

    _drawConnections(barElements, resultSet, measId, parseNumber) {
      if (!document.contains(this)) return;
      
      while (this._svgOverlay.firstChild) {
        this._svgOverlay.removeChild(this._svgOverlay.firstChild);
      }

      const svgRect = this._svgOverlay.getBoundingClientRect();
      if (svgRect.width === 0 || svgRect.height === 0) return;

      for (let i = 0; i < barElements.length - 1; i++) {
        const currentBar = barElements[i];
        const nextBar = barElements[i + 1];

        if (!currentBar || !nextBar) continue;

        const currRect = currentBar.getBoundingClientRect();
        const nextRect = nextBar.getBoundingClientRect();

        const x1 = currRect.left + currRect.width / 2 - svgRect.left;
        const y1 = currRect.top - svgRect.top;
        const x2 = nextRect.left + nextRect.width / 2 - svgRect.left;
        const y2 = nextRect.top - svgRect.top;

        const obj1 = resultSet[i][measId];
        const obj2 = resultSet[i + 1][measId];
        
        const val1 = obj1 ? parseNumber(obj1.formattedValue || obj1.raw || 0) : 0;
        const val2 = obj2 ? parseNumber(obj2.formattedValue || obj2.raw || 0) : 0;
        
        let varianceText = "0%";
        if (val1 !== 0) {
          const variance = ((val2 - val1) / val1) * 100;
          varianceText = (variance >= 0 ? "+" : "") + variance.toFixed(1) + "%";
        }

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        const cpX1 = x1 + (x2 - x1) / 2;
        const cpY1 = y1;
        const cpX2 = x1 + (x2 - x1) / 2;
        const cpY2 = y2;
        
        path.setAttribute("d", `M ${x1} ${y1} C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${x2} ${y2}`);
        path.setAttribute("stroke", "#cccccc");
        path.setAttribute("stroke-width", "1.5");
        path.setAttribute("fill", "none");
        path.setAttribute("stroke-dasharray", "4,4");
        this._svgOverlay.appendChild(path);

        const midX = x1 + (x2 - x1) / 2;
        const midY = y1 + (y2 - y1) / 2;

        const foreignObj = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
        foreignObj.setAttribute("x", (midX - 35).toString());
        foreignObj.setAttribute("y", (midY - 12).toString());
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

        if (val2 >= val1) {
          span.style.color = "#2e7d32";
        } else {
          span.style.color = "#c62828";
        }

        div.appendChild(span);
        foreignObj.appendChild(div);
        this._svgOverlay.appendChild(foreignObj);
      }
    }

    // Getters e Setters de propriedades do Widget
    getColorActualMonth() { return this._props.colorActualMonth; }
    setColorActualMonth(val) { this._props.colorActualMonth = val; }

    getColorHistorical() { return this._props.colorHistorical; }
    setColorHistorical(val) { this._props.colorHistorical = val; }

    getColorBudget() { return this._props.colorBudget; }
    setColorBudget(val) { this._props.colorBudget = val; }

    getFontSizeLabels() { return this._props.fontSizeLabels; }
    setFontSizeLabels(val) { this._props.fontSizeLabels = val; }
  }

  if (!customElements.get("sac-performance-bar-widget")) {
    customElements.define("sac-performance-bar-widget", SACPerformanceBarWidget);
  }
})();
