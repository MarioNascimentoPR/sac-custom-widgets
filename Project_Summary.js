(function () {
  const template = document.createElement("template");

  template.innerHTML = `
  <style>
    :host{
      --actual:#1f77b4;
      --hist:#7f7f7f;
      --budget:#aec7e8;
      --font:12px;

      display:block;
      width:100%;
      height:100%;
      background:#fff;
      box-sizing:border-box;
      overflow:hidden;
      font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
    }

    *{
      box-sizing:border-box;
    }

    #root{
      display:flex;
      flex-direction:column;
      width:100%;
      height:100%;
      padding:14px 18px;
      overflow:auto;
      gap:14px;
    }

    .header{
      display:flex;
      justify-content:space-between;
      align-items:center;
      border-bottom:1px solid #edf2f7;
      padding-bottom:10px;
      gap:12px;
    }

    .title{
      font-size:13px;
      font-weight:700;
      color:#1e293b;
    }

    .subtitle{
      font-size:10px;
      color:#64748b;
      margin-top:2px;
    }

    .dropdown{
      position:relative;
      min-width:150px;
    }

    .dropdown-btn{
      width:100%;
      padding:6px 28px 6px 10px;
      border:1px solid #cbd5e1;
      border-radius:6px;
      background:#f8fafc;
      font-size:11px;
      font-weight:600;
      cursor:pointer;
      text-align:left;
      overflow:hidden;
      white-space:nowrap;
      text-overflow:ellipsis;
      position:relative;
    }

    .dropdown-btn:after{
      content:"▼";
      position:absolute;
      right:8px;
      top:50%;
      transform:translateY(-50%);
      font-size:9px;
      color:#64748b;
    }

    .dropdown-menu{
      position:absolute;
      top:calc(100% + 4px);
      right:0;
      background:#fff;
      border:1px solid #cbd5e1;
      border-radius:8px;
      min-width:180px;
      max-height:260px;
      overflow:auto;
      display:none;
      z-index:999;
      box-shadow:0 8px 24px rgba(0,0,0,.08);
    }

    .dropdown-menu.show{
      display:block;
    }

    .year{
      padding:8px 10px;
      font-size:11px;
      font-weight:700;
      background:#f8fafc;
      border-bottom:1px solid #edf2f7;
    }

    .month{
      padding:7px 12px;
      font-size:11px;
      cursor:pointer;
      transition:.15s;
    }

    .month:hover{
      background:#f1f5f9;
    }

    .month.selected{
      background:#dbeafe;
      color:#0f172a;
      font-weight:700;
    }

    .legend{
      display:flex;
      gap:16px;
      flex-wrap:wrap;
      font-size:10px;
      color:#475569;
      font-weight:600;
    }

    .legend-item{
      display:flex;
      align-items:center;
      gap:6px;
    }

    .dot{
      width:10px;
      height:10px;
      border-radius:2px;
    }

    .dot.hist{
      background:var(--hist);
    }

    .dot.actual{
      background:var(--actual);
    }

    .dot.budget{
      border:1px solid var(--budget);
      background:
      repeating-linear-gradient(
        45deg,
        rgba(174,199,232,.5),
        rgba(174,199,232,.5) 2px,
        transparent 2px,
        transparent 4px
      );
    }

    .layout{
      display:grid;
      grid-template-columns:1fr 260px;
      gap:24px;
      min-height:260px;
    }

    .chart-block{
      display:flex;
      flex-direction:column;
    }

    .chart-wrap{
      position:relative;
      height:220px;
    }

    .chart{
      height:100%;
      display:flex;
      align-items:flex-end;
      justify-content:center;
      gap:18px;
      position:relative;
      padding-top:35px;
    }

    .svg{
      position:absolute;
      inset:0;
      width:100%;
      height:100%;
      pointer-events:none;
    }

    .bar-col{
      width:48px;
      height:100%;
      display:flex;
      flex-direction:column;
      justify-content:flex-end;
      align-items:center;
      position:relative;
    }

    .bar{
      width:100%;
      border-radius:4px 4px 0 0;
      position:relative;
      transition:height .25s ease;
    }

    .bar.hist{
      background:var(--hist);
    }

    .bar.actual{
      background:var(--actual);
      border:1px solid rgba(0,0,0,.1);
      box-shadow:0 0 12px rgba(31,119,180,.25);
    }

    .bar.budget{
      border:1px solid var(--budget);
      background:
      repeating-linear-gradient(
        45deg,
        rgba(174,199,232,.4),
        rgba(174,199,232,.4) 4px,
        transparent 4px,
        transparent 8px
      );
    }

    .value{
      position:absolute;
      top:-24px;
      font-size:11px;
      font-weight:700;
      color:#1e293b;
      white-space:nowrap;
    }

    .axis{
      display:flex;
      justify-content:center;
      gap:18px;
      border-top:1px solid #cbd5e1;
      padding-top:8px;
      min-height:32px;
    }

    .axis-label{
      width:48px;
      text-align:center;
      font-size:10px;
      font-weight:600;
      color:#64748b;
    }

    .axis-label.actual{
      color:var(--actual);
      font-weight:700;
    }

    .side{
      display:flex;
      flex-direction:column;
      gap:14px;
    }

    .card{
      background:#f8fafc;
      border:1px solid #e2e8f0;
      border-radius:10px;
      padding:14px;
    }

    .card-title{
      font-size:11px;
      font-weight:700;
      text-transform:uppercase;
      color:#475569;
      margin-bottom:12px;
      border-bottom:1px solid #cbd5e1;
      padding-bottom:6px;
    }

    .metric{
      display:flex;
      justify-content:space-between;
      align-items:center;
      padding:8px 0;
      border-bottom:1px solid #edf2f7;
      gap:12px;
      font-size:11px;
    }

    .metric:last-child{
      border-bottom:none;
    }

    .metric-name{
      color:#475569;
      font-weight:600;
    }

    .metric-value{
      font-weight:700;
      color:#0f172a;
      white-space:nowrap;
    }

    .badge{
      padding:2px 7px;
      border-radius:4px;
      font-size:10px;
      font-weight:700;
      white-space:nowrap;
    }

    .good{
      background:#dcfce7;
      color:#166534;
    }

    .bad{
      background:#fee2e2;
      color:#991b1b;
    }

    .highlight{
      font-size:11px;
      line-height:1.55;
      color:#475569;
      text-align:justify;
    }

    .placeholder{
      display:flex;
      align-items:center;
      justify-content:center;
      height:100%;
      font-size:12px;
      color:#64748b;
      font-weight:600;
    }

    @media(max-width:900px){
      .layout{
        grid-template-columns:1fr;
      }
    }
  </style>

  <div id="root">

    <div class="header">
      <div>
        <div class="title">Performance Mensal</div>
        <div class="subtitle">Valores em milhões (M)</div>
      </div>

      <div class="dropdown">
        <button class="dropdown-btn" id="trigger">Selecionar</button>
        <div class="dropdown-menu" id="menu"></div>
      </div>
    </div>

    <div class="legend">
      <div class="legend-item">
        <div class="dot hist"></div> Histórico
      </div>

      <div class="legend-item">
        <div class="dot actual"></div> Atual
      </div>

      <div class="legend-item">
        <div class="dot budget"></div> Budget
      </div>
    </div>

    <div class="layout">

      <div class="chart-block">
        <div class="chart-wrap">
          <svg class="svg" id="svg"></svg>
          <div class="chart" id="chart"></div>
        </div>

        <div class="axis" id="axis"></div>
      </div>

      <div class="side">

        <div class="card">
          <div class="card-title">Indicadores</div>

          <div class="metric">
            <span class="metric-name">Desvio Mês</span>
            <span class="metric-value" id="mDiff">-</span>
          </div>

          <div class="metric">
            <span class="metric-name">% Desvio</span>
            <span class="badge" id="mPct">-</span>
          </div>

          <div class="metric">
            <span class="metric-name">Consumo Budget</span>
            <span class="metric-value" id="mCons">-</span>
          </div>

          <div class="metric">
            <span class="metric-name">YTD</span>
            <span class="metric-value" id="ytd">-</span>
          </div>
        </div>

        <div class="card">
          <div class="card-title">Highlights</div>
          <div class="highlight" id="highlight">-</div>
        </div>

      </div>

    </div>

  </div>
  `;

  class SacSummary extends HTMLElement {

    constructor(){
      super();

      this.attachShadow({mode:"open"});
      this.shadowRoot.appendChild(template.content.cloneNode(true));

      this._data = null;
      this._selected = null;

      this.$ = (id)=>this.shadowRoot.getElementById(id);

      this.chart = this.$("chart");
      this.axis = this.$("axis");
      this.svg = this.$("svg");
      this.menu = this.$("menu");
      this.trigger = this.$("trigger");

      this.trigger.addEventListener("click",(e)=>{
        e.stopPropagation();
        this.menu.classList.toggle("show");
      });

      window.addEventListener("click",()=>{
        this.menu.classList.remove("show");
      });

      this.resizeObserver = new ResizeObserver(()=>{
        cancelAnimationFrame(this.raf);
        this.raf=requestAnimationFrame(()=>this.render());
      });
    }

    connectedCallback(){
      this.resizeObserver.observe(this);
    }

    disconnectedCallback(){
      this.resizeObserver.disconnect();
    }

    onCustomWidgetBeforeUpdate(props){
      this._props={...this._props,...props};
    }

    onCustomWidgetAfterUpdate(props){

      if(props.performanceCube){
        this._data=props.performanceCube;
        this._selected=null;
      }

      this.applyStyles();
      this.render();
    }

    applyStyles(){

      const s=this.style;

      if(this._props?.colorActualMonth){
        s.setProperty("--actual",this._props.colorActualMonth);
      }

      if(this._props?.colorHistorical){
        s.setProperty("--hist",this._props.colorHistorical);
      }

      if(this._props?.colorBudget){
        s.setProperty("--budget",this._props.colorBudget);
      }

      if(this._props?.fontSizeLabels){
        s.setProperty("--font",this._props.fontSizeLabels+"px");
      }
    }

    parse(v){

      if(typeof v==="number") return v;

      return parseFloat(
        String(v || 0)
        .replace(/[^\d,.-]/g,"")
        .replace(",",".")
      ) || 0;
    }

    formatM(v){
      return (v/1000000).toFixed(2)+"M";
    }

    render(){

      if(!this._data?.data?.length){
        this.chart.innerHTML='<div class="placeholder">Aguardando dados...</div>';
        return;
      }

      const metadata=this._data.metadata;
      const dims=Object.keys(metadata.dimensions || {});
      const meas=Object.keys(metadata.mainStructureMembers || {})[0];

      let timeDim=dims[0];
      let versionDim=dims[1];

      const map={};

      this._data.data.forEach(row=>{

        const time=row[timeDim];
        if(!time) return;

        const id=time.id;
        const label=time.label || id;

        if(!map[id]){

          map[id]={
            id,
            label,
            actual:0,
            budget:0,
            current:false
          };
        }

        const value=this.parse(
          row[meas]?.formattedValue ||
          row[meas]?.raw ||
          0
        );

        const version=row[versionDim];

        const isBudget=
          version &&
          /budget|orç|orcado/i.test(
            version.id + version.label
          );

        if(isBudget){
          map[id].budget+=value;
        }else{
          map[id].actual+=value;
        }

        if(
          time.properties?.isCurrent==="true" ||
          row.versionContext?.isActualMonth
        ){
          map[id].current=true;
        }

      });

      const months=Object.values(map)
      .map(m=>{

        const year=(m.id.match(/\d{4}/)||[])[0] || new Date().getFullYear();

        const monthMap={
          JAN:1,FEB:2,MAR:3,APR:4,MAY:5,JUN:6,
          JUL:7,AUG:8,SEP:9,OCT:10,NOV:11,DEC:12
        };

        const mon=monthMap[
          m.label.substring(0,3).toUpperCase()
        ] || 1;

        return{
          ...m,
          year:+year,
          month:mon
        };

      })
      .sort((a,b)=>
        a.year-b.year ||
        a.month-b.month
      );

      if(!months.length) return;

      if(!this._selected){

        const current=
          months.find(m=>m.current);

        this._selected=
          current?.id ||
          months.at(-1).id;
      }

      this.buildDropdown(months);

      const idx=months.findIndex(
        m=>m.id===this._selected
      );

      const current=months[idx];

      const visible=[
        ...months.slice(
          Math.max(0,idx-12),
          idx+1
        ),
        {
          label:"Budget",
          actual:current.budget || current.actual,
          budget:0,
          type:"budget"
        }
      ];

      const max=Math.max(
        ...visible.map(v=>v.actual)
      ) * 1.2;

      this.chart.innerHTML="";
      this.axis.innerHTML="";
      this.svg.innerHTML="";

      const bars=[];

      visible.forEach((m,i)=>{

        const col=document.createElement("div");
        col.className="bar-col";

        const bar=document.createElement("div");

        const type=
          m.type ||
          (i===visible.length-2
            ? "actual"
            : "hist");

        bar.className=`bar ${type}`;

        bar.style.height=
          ((m.actual/max)*100)+"%";

        const value=document.createElement("span");
        value.className="value";
        value.textContent=this.formatM(m.actual);

        bar.appendChild(value);

        col.appendChild(bar);

        this.chart.appendChild(col);

        bars.push(bar);

        const axis=document.createElement("div");

        axis.className=
          "axis-label" +
          (type==="actual" ? " actual":"");

        axis.textContent=
          m.label.split(" ")[0];

        this.axis.appendChild(axis);

      });

      this.drawLine(
        bars[visible.length-2],
        bars[visible.length-1],
        current.actual,
        current.budget || current.actual
      );

      this.renderKPIs(months,idx,current);
    }

    buildDropdown(months){

      this.menu.innerHTML="";

      const years={};

      months.forEach(m=>{

        if(!years[m.year]){
          years[m.year]=[];
        }

        years[m.year].push(m);

      });

      Object.entries(years).forEach(([year,list])=>{

        const y=document.createElement("div");
        y.className="year";
        y.textContent=year;

        this.menu.appendChild(y);

        list.forEach(m=>{

          const item=document.createElement("div");

          item.className=
            "month" +
            (m.id===this._selected
              ? " selected"
              : "");

          item.textContent=m.label;

          item.onclick=(e)=>{

            e.stopPropagation();

            this._selected=m.id;

            this.menu.classList.remove("show");

            this.render();
          };

          this.menu.appendChild(item);

        });

      });

      const selected=
        months.find(m=>m.id===this._selected);

      this.trigger.textContent=
        selected?.label || "Selecionar";
    }

    drawLine(from,to,v1,v2){

      const wrap=this.chart.getBoundingClientRect();

      const a=from.getBoundingClientRect();
      const b=to.getBoundingClientRect();

      const x1=a.left-wrap.left+a.width/2;
      const x2=b.left-wrap.left+b.width/2;

      const y=18;

      const path=document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path"
      );

      path.setAttribute(
        "d",
        `M${x1},${a.top-wrap.top}
         L${x1},${y}
         L${x2},${y}
         L${x2},${b.top-wrap.top}`
      );

      path.setAttribute("fill","none");
      path.setAttribute("stroke","#64748b");
      path.setAttribute("stroke-width","1.3");

      this.svg.appendChild(path);

      const diff=((v2-v1)/v1)*100;

      const tag=document.createElementNS(
        "http://www.w3.org/2000/svg",
        "foreignObject"
      );

      tag.setAttribute("x",(x1+x2)/2-35);
      tag.setAttribute("y",2);
      tag.setAttribute("width",70);
      tag.setAttribute("height",24);

      const div=document.createElement("div");

      div.style.display="flex";
      div.style.justifyContent="center";

      div.innerHTML=`
        <span class="badge ${diff > 0 ? "bad":"good"}">
          ${diff > 0 ? "▼":"▲"} ${Math.abs(diff).toFixed(1)}%
        </span>
      `;

      tag.appendChild(div);

      this.svg.appendChild(tag);
    }

    renderKPIs(months,idx,current){

      const budget=current.budget || current.actual;

      const diff=current.actual-budget;

      const pct=(diff/budget)*100;

      this.$("mDiff").textContent=
        (diff >=0 ? "+" : "") +
        this.formatM(diff);

      const badge=this.$("mPct");

      badge.textContent=
        (pct >=0 ? "▼ ":"▲ ") +
        Math.abs(pct).toFixed(2)+"%";

      badge.className=
        "badge " +
        (diff > 0 ? "bad":"good");

      this.$("mCons").textContent=
        ((current.actual/budget)*100).toFixed(1)+"%";

      let ytd=0;

      months.forEach((m,i)=>{
        if(i<=idx && m.year===current.year){
          ytd+=m.actual;
        }
      });

      this.$("ytd").textContent=
        this.formatM(ytd);

      const status=
        diff > 0
        ? "acima do orçamento"
        : "abaixo do orçamento";

      this.$("highlight").textContent=
        `O mês de ${current.label} encerrou ${status}, com desvio de ${this.formatM(Math.abs(diff))}. O consumo do budget ficou em ${((current.actual/budget)*100).toFixed(1)}%, enquanto o acumulado do ano atingiu ${this.formatM(ytd)}.`;
    }

  }

  if(!customElements.get("sac-summary")){
    customElements.define("sac-summary",SacSummary);
  }

})();
