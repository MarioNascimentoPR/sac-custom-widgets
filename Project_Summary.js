(function () {

  const BAR_WIDTH = 46;
  const BAR_GAP = 20;
  const BRACKET_WIDTH = 66;

  const template = document.createElement("template");

  template.innerHTML = `
  <style>
    :host {
      --color-actual: #1f77b4;
      --color-historical: #7f7f7f;
      --color-budget: #aec7e8;
      --font-size-labels: 12px;
      --color-saving: #137333;
      --color-saving-bg: #e6f4ea;
      --color-saving-border: #ceead6;
      --color-increase: #c5221f;
      --color-increase-bg: #fce8e6;
      --color-increase-border: #fad2cf;
      --color-border-axis: #cbd5e0;

      display:block;
      width:100%;
      height:100%;
      background:#fff;
      box-sizing:border-box;
    }

    #widget-wrapper{
      display:flex;
      flex-direction:column;
      width:100%;
      height:100%;
      padding:14px 18px;
      box-sizing:border-box;
      font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
      overflow:auto;
    }

    .widget-header{
      display:flex;
      justify-content:space-between;
      align-items:center;
      margin-bottom:14px;
      padding-bottom:8px;
      border-bottom:1px solid #f0f0f0;
    }

    .widget-title{
      font-size:13px;
      font-weight:700;
      color:#2c3e50;
    }

    .scale-tag{
      font-size:10px;
      font-weight:600;
      color:#7f8c8d;
      margin-top:2px;
    }

    .widget-legend{
      display:flex;
      gap:14px;
      margin-bottom:12px;
      font-size:10.5px;
      font-weight:600;
      color:#4a5568;
    }

    .legend-item{
      display:flex;
      align-items:center;
      gap:5px;
    }

    .legend-color{
      width:10px;
      height:10px;
      border-radius:2px;
    }

    .legend-color.hist{
      background:var(--color-historical);
    }

    .legend-color.act{
      background:var(--color-actual);
    }

    .legend-color.bud{
      border:1px solid var(--color-budget);
      background-image:
        linear-gradient(
          45deg,
          var(--color-budget) 25%,
          transparent 25%,
          transparent 50%,
          var(--color-budget) 50%,
          var(--color-budget) 75%,
          transparent 75%,
          transparent
        );
      background-size:4px 4px;
    }

    .main-visualization-layout{
      display:flex;
      gap:24px;
      margin-bottom:24px;
    }

    .visualization-column{
      position:relative;
      display:flex;
      flex-direction:column;
      justify-content:flex-end;
      padding-top:24px;
    }

    .monthly-col{
      flex:3;
    }

    .ytd-col{
      flex:1;
      border-left:1px solid #e2e8f0;
      padding-left:24px;
    }

    .ytd-chart-header-title{
      position:absolute;
      top:0;
      left:24px;
      font-size:10px;
      font-weight:700;
      color:#4a5568;
      text-transform:uppercase;
    }

    .chart-container-block{
      position:relative;
      height:165px;
      padding-top:60px;
      overflow:hidden;
    }

    .chart-area{
      width:100%;
      height:100%;
      display:flex;
      justify-content:center;
    }

    .chart-area-inner{
      display:flex;
      align-items:flex-end;
      gap:${BAR_GAP}px;
      position:relative;
      height:100%;
    }

    .axis-x{
      width:100%;
      display:flex;
      justify-content:center;
      margin-top:6px;
      border-top:1px solid #cbd5e0;
      padding-top:6px;
    }

    .axis-x-inner{
      display:flex;
      gap:${BAR_GAP}px;
    }

    .bar-wrapper{
      width:${BAR_WIDTH}px;
      height:100%;
      position:relative;
      display:flex;
      align-items:flex-end;
      flex-shrink:0;
    }

    .bar-element{
      width:100%;
      border-radius:3px 3px 0 0;
      position:relative;
      display:flex;
      justify-content:center;
    }

    .historical{
      background:var(--color-historical);
    }

    .actual{
      background:var(--color-actual);
      border:1px solid #15517b;
      box-sizing:border-box;
      box-shadow:0 0 10px rgba(31,119,180,.35);
    }

    .budget{
      border:1px solid var(--color-budget);
      background-image:
        linear-gradient(
          45deg,
          rgba(174,199,232,.4) 25%,
          transparent 25%,
          transparent 50%,
          rgba(174,199,232,.4) 50%,
          rgba(174,199,232,.4) 75%,
          transparent 75%,
          transparent
        );
      background-size:6px 6px;
    }

    .kpi-label{
      position:absolute;
      top:-22px;
      font-size:11px;
      font-weight:700;
      white-space:nowrap;
    }

    .axis-label{
      width:${BAR_WIDTH}px;
      text-align:center;
      font-size:11px;
      font-weight:600;
      color:#718096;
      white-space:nowrap;
    }

    .actual-month{
      color:var(--color-actual);
      font-weight:700;
    }

    .css-bracket{
      position:absolute;
      top:-40px;
      width:${BRACKET_WIDTH}px;
      height:14px;
      border-top:1.5px solid var(--color-border-axis);
      border-left:1.5px solid var(--color-border-axis);
      border-right:1.5px solid var(--color-border-axis);
      pointer-events:none;
    }

    .css-bracket::before,
    .css-bracket::after{
      content:'';
      position:absolute;
      bottom:-5px;
      width:0;
      height:0;
      border-left:3.5px solid transparent;
      border-right:3.5px solid transparent;
      border-top:5px solid var(--color-border-axis);
    }

    .css-bracket::before{
      left:-4px;
    }

    .css-bracket::after{
      right:-4px;
    }

    .css-bracket-label{
      position:absolute;
      top:-11px;
      width:100%;
      display:flex;
      justify-content:center;
    }

    .variance-tag{
      font-size:10px;
      font-weight:700;
      padding:2px 6px;
      border-radius:4px;
      background:#fff;
    }

    .saving{
      background:var(--color-saving-bg);
      color:var(--color-saving);
      border:1px solid var(--color-saving-border);
    }

    .increase{
      background:var(--color-increase-bg);
      color:var(--color-increase);
      border:1px solid var(--color-increase-border);
    }
  </style>

  <div id="widget-wrapper">

    <div class="widget-header">
      <div>
        <div class="widget-title">Performance Mensal</div>
        <div class="scale-tag">Valores em Milhões (M)</div>
      </div>
    </div>

    <div class="widget-legend">
      <div class="legend-item"><div class="legend-color hist"></div> Histórico</div>
      <div class="legend-item"><div class="legend-color act"></div> Atual</div>
      <div class="legend-item"><div class="legend-color bud"></div> Budget</div>
    </div>

    <div class="main-visualization-layout">

      <div class="monthly-col visualization-column">

        <div class="chart-container-block">
          <div class="chart-area">
            <div class="chart-area-inner" id="monthlyChartInner"></div>
          </div>
        </div>

        <div class="axis-x">
          <div class="axis-x-inner" id="monthlyAxisInner"></div>
        </div>

      </div>

      <div class="visualization-column ytd-col">

        <div class="ytd-chart-header-title" id="ytdTitle">
          Evolução YTD
        </div>

        <div class="chart-container-block">
          <div class="chart-area">
            <div class="chart-area-inner" id="ytdChartInner"></div>
          </div>
        </div>

        <div class="axis-x">
          <div class="axis-x-inner" id="ytdAxisInner"></div>
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
    }

    connectedCallback() {

      if (this._shadowRoot) return;

      this._shadowRoot = this.attachShadow({ mode: "open" });

      this._shadowRoot.appendChild(
        template.content.cloneNode(true)
      );

      this._monthlyChartInner =
        this._shadowRoot.getElementById("monthlyChartInner");

      this._monthlyAxisInner =
        this._shadowRoot.getElementById("monthlyAxisInner");

      this._ytdChartInner =
        this._shadowRoot.getElementById("ytdChartInner");

      this._ytdAxisInner =
        this._shadowRoot.getElementById("ytdAxisInner");

      this._ytdTitle =
        this._shadowRoot.getElementById("ytdTitle");
    }

    onCustomWidgetBeforeUpdate(changedProperties) {
      this._props = {
        ...this._props,
        ...changedProperties
      };
    }

    onCustomWidgetAfterUpdate(changedProperties) {

      if ("performanceCube" in changedProperties) {
        this._currentData = this.performanceCube;
        this.renderChart();
      }
    }

    _parseValue(val) {

      if (typeof val === "number") return val;

      if (!val || val === "-") return 0;

      return Number(
        String(val)
          .replaceAll(".", "")
          .replace(",", ".")
          .replace(/[^\d.-]/g, "")
      ) || 0;
    }

    _formatMillions(v) {
      return (v / 1000000).toFixed(2) + "M";
    }

    _formatPercent(v, saving) {
      return `${saving ? "▼" : "▲"} ${Math.abs(v).toFixed(2)}%`;
    }

    _buildBarHTML(data, maxVal) {

      let bars = "";
      let axis = "";

      data.forEach(d => {

        const height = (d.value / maxVal) * 100;

        bars += `
          <div class="bar-wrapper">
            <div 
              class="bar-element ${d.type}" 
              style="height:${height}%"
            >
              <span class="kpi-label">
                ${this._formatMillions(d.value)}
              </span>
            </div>
          </div>
        `;

        axis += `
          <div class="axis-label ${d.type === "actual" ? "actual-month" : ""}">
            ${d.label}
          </div>
        `;
      });

      return { bars, axis };
    }

    _buildBracketHTML(pairs, data) {

      let html = "";

      pairs.forEach(pair => {

        const val1 = data[pair.from].value;
        const val2 = data[pair.to].value;

        const diff = val2 - val1;

        const pct =
          val1 !== 0
            ? (diff / val1) * 100
            : 0;

        const saving = diff <= 0;

        html += `
          <div 
            class="css-bracket"
            style="left:calc(${pair.from} * ${BRACKET_WIDTH}px + 23px)"
          >
            <div class="css-bracket-label">
              <span class="variance-tag ${saving ? "saving" : "increase"}">
                ${this._formatPercent(pct, saving)}
              </span>
            </div>
          </div>
        `;
      });

      return html;
    }

    renderChart() {

      if (!this._currentData) return;

      const financialData = this._currentData;

      if (
        !financialData.data ||
        !financialData.data.length
      ) return;

      const metadata = financialData.metadata;

      const dimensions = metadata.dimensions || {};
      const measures = metadata.mainStructureMembers || {};

      const dimKeys = Object.keys(dimensions);
      const measureKeys = Object.keys(measures);

      const measureId = measureKeys[0];

      let tempoDimId = dimKeys[0];
      let versionDimId = dimKeys[1];

      const timelineMap = {};

      financialData.data.forEach(row => {

        const tempoObj = row[tempoDimId];

        if (!tempoObj) return;

        const id = String(tempoObj.id);

        if (!timelineMap[id]) {

          timelineMap[id] = {
            id,
            label: tempoObj.label,
            realizado: 0,
            orcado: 0,
            isCurrentMonth: false
          };
        }

        const value =
          this._parseValue(
            row[measureId]?.formattedValue ||
            row[measureId]?.raw ||
            0
          );

        const versionObj = row[versionDimId];

        if (versionObj) {

          const version =
            String(versionObj.id).toUpperCase();

          if (
            version.includes("BUDGET") ||
            version.includes("ORÇ")
          ) {
            timelineMap[id].orcado += value;
          } else {
            timelineMap[id].realizado += value;
          }

        } else {

          timelineMap[id].realizado += value;
        }

        if (
          tempoObj.properties?.isCurrent === true ||
          tempoObj.properties?.isCurrent === "true"
        ) {
          timelineMap[id].isCurrentMonth = true;
        }

      });

      const series = Object.values(timelineMap);

      const monthMap = {
        JAN:1,FEB:2,MAR:3,APR:4,
        MAY:5,JUN:6,JUL:7,AUG:8,
        SEP:9,OCT:10,NOV:11,DEC:12
      };

      const finalData = series.map(m => {

        const year =
          parseInt(
            m.id.match(/\d{4}/)?.[0]
          );

        const month =
          monthMap[
            String(m.label)
              .substring(0,3)
              .toUpperCase()
          ] || 1;

        return {
          id:m.id,
          label:m.label,
          value:m.realizado,
          budget:m.orcado,
          yearValue:year,
          monthNum:month,
          type:m.isCurrentMonth
            ? "actual"
            : "historical"
        };
      });

      finalData.sort((a,b) => {

        if (a.yearValue !== b.yearValue) {
          return a.yearValue - b.yearValue;
        }

        return a.monthNum - b.monthNum;
      });

      let actualIndex =
        finalData.findIndex(d => d.type === "actual");

      if (actualIndex === -1) {
        actualIndex = finalData.length - 1;
      }

      finalData.forEach((d, i) => {
        d.type =
          i === actualIndex
            ? "actual"
            : "historical";
      });

      const current = finalData[actualIndex];

      const budgetVal =
        current.budget || current.value;

      const visible =
        finalData.slice(
          Math.max(0, actualIndex - 12),
          actualIndex + 1
        );

      visible.push({
        label:`Bud. ${current.label}`,
        value:budgetVal,
        type:"budget"
      });

      const maxVal =
        Math.max(...visible.map(d => d.value)) * 1.25;

      const monthly =
        this._buildBarHTML(
          visible,
          maxVal
        );

      const visibleActualIndex =
        visible.findIndex(d => d.type === "actual");

      const monthlyBrackets =
        this._buildBracketHTML(
          [
            {
              from:visibleActualIndex - 1,
              to:visibleActualIndex
            },
            {
              from:visibleActualIndex,
              to:visibleActualIndex + 1
            }
          ].filter(v => v.from >= 0 && v.to < visible.length),
          visible
        );

      this._monthlyChartInner.innerHTML =
        monthly.bars + monthlyBrackets;

      this._monthlyAxisInner.innerHTML =
        monthly.axis;

      let ytdAtual = 0;
      let ytdAnterior = 0;
      let ytdBudget = 0;

      const currentYear = current.yearValue;
      const prevYear = currentYear - 1;

      finalData.forEach(d => {

        if (
          d.yearValue === currentYear &&
          d.monthNum <= current.monthNum
        ) {

          ytdAtual += d.value;
          ytdBudget += d.budget || d.value;
        }

        if (
          d.yearValue === prevYear &&
          d.monthNum <= current.monthNum
        ) {

          ytdAnterior += d.value;
        }
      });

      const ytdData = [
        {
          label:`Ant (${prevYear})`,
          value:ytdAnterior,
          type:"historical"
        },
        {
          label:`Atual (${currentYear})`,
          value:ytdAtual,
          type:"actual"
        },
        {
          label:"Meta",
          value:ytdBudget,
          type:"budget"
        }
      ];

      const maxYtd =
        Math.max(...ytdData.map(d => d.value)) * 1.25;

      const ytd =
        this._buildBarHTML(
          ytdData,
          maxYtd
        );

      const ytdBrackets =
        this._buildBracketHTML(
          [
            { from:0, to:1 },
            { from:1, to:2 }
          ],
          ytdData
        );

      this._ytdChartInner.innerHTML =
        ytd.bars + ytdBrackets;

      this._ytdAxisInner.innerHTML =
        ytd.axis;

      this._ytdTitle.textContent =
        `Evolução YTD (${currentYear})`;
    }
  }

  if (!customElements.get("sac-summary")) {
    customElements.define(
      "sac-summary",
      EvoSummaryWidget
    );
  }

})();
