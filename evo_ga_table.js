(function () {
  const tmpl = document.createElement("template");
  tmpl.innerHTML = `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&family=Space+Mono&display=swap');
      :host { display: block; font-family: 'Plus Jakarta Sans', sans-serif; width: 100%; height: 100%; }
      .container { background: #fff; border: 1px solid #e4e4e7; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      thead th { background: #f4f4f5; padding: 14px 18px; font-weight: 600; color: #71717a; text-transform: uppercase; font-size: 10px; border-bottom: 1px solid #e4e4e7; text-align: right; }
      thead th:first-child { text-align: left; }
      tbody td { padding: 12px 18px; border-bottom: 1px solid #f4f4f5; vertical-align: middle; }
      .val { font-family: 'Space Mono', monospace; text-align: right; font-size: 12px; }
      .ccu { font-weight: 600; color: #09090b; }
      .delta { font-weight: 700; padding: 4px 8px; border-radius: 6px; font-size: 11px; display: inline-flex; align-items: center; gap: 4px; }
      .red { color: #e11d48; background: #fff1f2; }
      .green { color: #16a34a; background: #f0fdf4; }
      .info-box { padding: 30px; color: #71717a; font-size: 13px; text-align: center; font-weight: 500; }
    </style>
    <div class="container">
      <table>
        <thead>
          <tr>
            <th>Centro de Custo</th>
            <th>Realizado</th>
            <th>Budget</th>
            <th>Desvio</th>
          </tr>
        </thead>
        <tbody id="tbody"></tbody>
      </table>
      <div id="status"></div>
    </div>
  `;

  class EvoGATableOnly extends HTMLElement {
    constructor() {
      super();
      this._shadowRoot = this.attachShadow({ mode: "open" });
      this._shadowRoot.appendChild(tmpl.content.cloneNode(true));
      this._fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    onCustomWidgetAfterUpdate(changedProperties) {
      const status = this._shadowRoot.getElementById("status");
      const tbody = this._shadowRoot.getElementById("tbody");
      
      if (this.dataBindings && this.dataBindings.getDataBinding("financialData")) {
        const binding = this.dataBindings.getDataBinding("financialData");
        
        if (binding && binding.data && binding.data.length > 0) {
          status.innerHTML = "";
          this._render(binding.data, binding.metadata);
        } else {
          tbody.innerHTML = "";
          status.innerHTML = `<div class="info-box">Aguardando dados: Certifique-se de preencher o Builder do componente no Story.</div>`;
        }
      } else {
        tbody.innerHTML = "";
        status.innerHTML = `<div class="info-box" style="color: #ef4444;">Aguardando sincronização do arquivo JSON.</div>`;
      }
    }

    _render(data, metadata) {
      const tbody = this._shadowRoot.getElementById("tbody");
      const consolidated = {};

      // Captura as chaves de colunas criadas pelas contas restritas do modelo
      const memberKeys = Object.keys(metadata?.mainStructureMembers || {});
      const realKey = memberKeys[0];
      const budgetKey = memberKeys[1];

      data.forEach(row => {
        const dimKeys = Object.keys(row).filter(k => k.includes("dimensions_"));
        const ccuDesc = row[dimKeys[0]]?.description || row[dimKeys[0]]?.id || "N/A";
        const ccuId = row[dimKeys[0]]?.id || "N/A";

        const vReal = parseFloat(row[realKey]?.rawValue) || 0;
        const vBud = parseFloat(row[budgetKey]?.rawValue) || 0;

        if (!consolidated[ccuId]) {
          consolidated[ccuId] = { desc: ccuDesc, real: 0, budget: 0 };
        }

        consolidated[ccuId].real += vReal;
        consolidated[ccuId].budget += vBud;
      });

      tbody.innerHTML = Object.values(consolidated).map(item => {
        const delta = item.real - item.budget;
        const color = delta > 0.01 ? 'red' : 'green';
        const sign = delta > 0 ? '▲' : '▼';

        return `
          <tr>
            <td class="ccu">${item.desc}</td>
            <td class="val">${this._fmt.format(item.real)}</td>
            <td class="val" style="color:#71717a">${this._fmt.format(item.budget)}</td>
            <td style="text-align:right">
              <span class="delta ${color}">${sign} ${this._fmt.format(Math.abs(delta))}</span>
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  customElements.define("evo-ga-table-only", EvoGATableOnly);
})();
