(function () {
  const tmpl = document.createElement("template");
  tmpl.innerHTML = `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap');
 
      :host {
        display: block;
        font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
        color: #27272a;
        width: 100%;
        height: 100%;
      }
 
      .table-container {
        background: #fff;
        border: 1px solid #e4e4e7;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
      }
      
      .responsive-scroll {
        overflow-x: auto;
      }
 
      table {
        width: 100%;
        border-collapse: collapse;
        text-align: left;
        font-size: 13px;
      }
 
      thead th {
        background: #f4f4f5;
        padding: 14px 18px;
        font-weight: 600;
        text-transform: uppercase;
        font-size: 10.5px;
        letter-spacing: 0.06em;
        color: #71717a;
        border-bottom: 1px solid #e4e4e7;
        white-space: nowrap;
      }
 
      tbody tr { transition: background .1s ease; }
      tbody tr:hover { background: #fafafa; }
 
      tbody td {
        padding: 14px 18px;
        border-bottom: 1px solid #f4f4f5;
        vertical-align: middle;
        white-space: nowrap;
      }
      
      tbody tr:last-child td { border-bottom: none; }
 
      .desc-main { font-weight: 600; color: #09090b; font-size: 13.5px; letter-spacing: -0.01em; }
      .desc-sub { font-size: 11px; color: #a1a1aa; font-family: 'Space Mono', monospace; margin-top: 3px; }
      .val-mono { font-family: 'Space Mono', monospace; font-size: 12px; text-align: right; }
      
      .status-pill {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 4px 8px;
        border-radius: 6px;
        font-weight: 700;
        font-size: 11px;
        font-family: 'Space Mono', monospace;
      }
      .critical { color: #e11d48; background: #fff1f2; }
      .success { color: #16a34a; background: #f0fdf4; }
      .neutral { color: #52525b; background: #f4f4f5; }
 
      .impact-bar-bg { height: 4px; background: #e4e4e7; border-radius: 2px; width: 70px; overflow: hidden; }
      .impact-bar-fill { height: 100%; border-radius: 2px; transition: width .4s ease; }
      .bg-red { background: #f43f5e; }
      .bg-green { background: #10b981; }
 
      .right { text-align: right; }
      .center { text-align: center; }
    </style>
 
    <div class="table-container">
      <div class="responsive-scroll">
        <table>
          <thead>
            <tr>
              <th>Centro de Custo</th>
              <th class="right">Realizado</th>
              <th class="right">Budget</th>
              <th class="right">Desvio (Abs)</th>
              <th class="center">Status</th>
              <th class="center">Impacto</th>
            </tr>
          </thead>
          <tbody id="tbody"></tbody>
        </table>
      </div>
    </div>
  `;
 
  const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
 
  class EvoGATableOnly extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this.shadowRoot.appendChild(tmpl.content.cloneNode(true));
    }
 
    // Executado automaticamente pelo SAC sempre que os dados mudam no modelo
    onCustomWidgetAfterUpdate(changedProperties) {
      if ("dataBindings" in changedProperties && this.dataBindings) {
        const binding = this.dataBindings.getDataBinding("financialData");
        if (binding && binding.data) {
          this._processSACData(binding);
        }
      }
    }
 
    _processSACData(binding) {
      const dataRows = binding.data;
      const metadata = binding.metadata;
 
      // Mapeamento dinâmico de chaves baseado nas dimensões e medidas do crossjoin
      const parsedElements = dataRows.map(row => {
        // Assume ID/Descrição do Centro de Custo da primeira dimensão informada
        const ccuDim = Object.keys(row).find(key => key.startsWith("dim_") || key === "dimensions");
        const ccuLabel = row[ccuDim]?.description || row[ccuDim]?.id || "Sem Identificação";
        const ccuId = row[ccuDim]?.id || "";
 
        // Identificação de propriedades ou dimensões adicionais para Diretoria e Área
        const extraDims = Object.keys(row).filter(key => key !== ccuDim && (key.startsWith("dim_") || key.startsWith("prop_")));
        const dir = row[extraDims[0]]?.description || "G&A Global";
        const area = row[extraDims[1]]?.description || "Geral";
 
        // Separação das medidas/membros da dimensão Versão (AMOUNT filtrado)
        let realValue = 0;
        let budgetValue = 0;
 
        // Varre as chaves de medidas do objeto retornado pelo SAC
        Object.keys(row).forEach(key => {
          if (metadata.mainStructureMembers && metadata.mainStructureMembers[key]) {
            const memberName = metadata.mainStructureMembers[key].description.toLowerCase();
            if (memberName.includes("real") || memberName.includes("actual")) {
              realValue = parseFloat(row[key].rawValue) || 0;
            } else if (memberName.includes("bud") || memberName.includes("orc") || memberName.includes("plan")) {
              budgetValue = parseFloat(row[key].rawValue) || 0;
            }
          }
        });
 
        return {
          id: ccuId,
          desc: ccuLabel,
          real: realValue,
          orc: budgetValue,
          dir: dir,
          area: area
        };
      });
 
      this._render(parsedElements);
    }
 
    _render(elements) {
      if (!elements.length) {
        this.shadowRoot.getElementById('tbody').innerHTML = `<tr><td colspan="6" class="center">Aguardando Vinculação de Dados no SAC...</td></tr>`;
        return;
      }
 
      const absMax = Math.max(...elements.map(e => Math.abs(e.real - e.orc)), 1);
      
      this.shadowRoot.getElementById('tbody').innerHTML = elements
        .map(item => {
          const delta = item.real - item.orc;
          const pctDesvio = item.orc !== 0 ? (delta / item.orc) * 100 : 0;
          
          let statusClass = 'neutral';
          let icon = '●';
          if (delta > 0) { statusClass = 'critical'; icon = '▲'; }
          else if (delta < 0) { statusClass = 'success'; icon = '▼'; }
 
          const barWidth = Math.min((Math.abs(delta) / absMax) * 100, 100);
 
          return `
            <tr>
              <td>
                <div class="desc-main">${item.desc}</div>
                <div class="desc-sub">${item.id} • ${item.dir} • ${item.area}</div>
              </td>
              <td class="val-mono" style="color: #09090b;">${fmt.format(item.real)}</td>
              <td class="val-mono" style="color: #71717a;">${fmt.format(item.orc)}</td>
              <td class="val-mono ${delta > 0 ? 'critical' : 'success'}" style="font-weight: 700;">
                ${delta > 0 ? '+' : ''}${fmt.format(delta)}
              </td>
              <td class="center">
                <span class="status-pill ${statusClass}">
                  ${icon} ${delta > 0 ? '+' : ''}${pctDesvio.toFixed(1)}%
                </span>
              </td>
              <td class="center">
                <div style="display:flex; justify-content:center;">
                  <div class="impact-bar-bg">
                    <div class="impact-bar-fill ${delta > 0 ? 'bg-red' : 'bg-green'}" style="width: ${barWidth}%"></div>
                  </div>
                </div>
              </td>
            </tr>
          `;
        }).join('');
    }
  }
 
  customElements.define('evo-ga-table-only', EvoGATableOnly);
})();
