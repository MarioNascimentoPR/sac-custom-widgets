(function () {
  const tmpl = document.createElement("template");
  tmpl.innerHTML = `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&family=Space+Mono&display=swap');
      :host { display: block; font-family: 'Plus Jakarta Sans', sans-serif; width: 100%; height: 100%; }
      .container { background: #fff; border: 1px solid #e4e4e7; border-radius: 12px; overflow: hidden; }
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      thead th { background: #f4f4f5; padding: 12px 16px; font-weight: 600; color: #71717a; text-transform: uppercase; font-size: 10px; border-bottom: 1px solid #e4e4e7; text-align: right; }
      thead th:first-child { text-align: left; }
      tbody td { padding: 12px 16px; border-bottom: 1px solid #f4f4f5; vertical-align: middle; }
      .val { font-family: 'Space Mono', monospace; text-align: right; font-size: 12px; }
      .ccu { font-weight: 600; color: #09090b; }
      .delta { font-weight: 700; padding: 4px 8px; border-radius: 6px; font-size: 11px; display: inline-block; }
      .red { color: #e11d48; background: #fff1f2; }
      .green { color: #16a34a; background: #f0fdf4; }
      .error-msg { padding: 20px; color: #ef4444; font-size: 12px; font-family: monospace; }
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

    // O SAC chama esta função sempre que algo muda no Builder
    onCustomWidgetAfterUpdate(changedProperties) {
      const status = this._shadowRoot.getElementById("status");
      
      // Captura QUALQUER dataBinding disponível (evita erro de nome no JSON)
      const bindingKey = Object.keys(this.dataBindings || {})[0];
      const binding = bindingKey ? this.dataBindings.getDataBinding(bindingKey) : null;

      if (binding && binding.data) {
        console.log("SAC Payload Bruto:", binding.data);
        this._render(binding.data);
      } else {
        status.innerHTML = `<div class="error-msg">Aguardando Vinculação: Verifique se 'Centro de Custo', 'Conta Restrita' e 'Montante' estão no Builder.</div>`;
      }
    }

    _render(data) {
      const tbody = this._shadowRoot.getElementById("tbody");
      const status = this._shadowRoot.getElementById("status");
      status.innerHTML = "";

      // Consolidação de Real vs Budget via Membros de Conta
      const consolidated = {};

      data.forEach(row => {
        // 1. Identificar CCU (Dimensão de Linha)
        const dimKeys = Object.keys(row).filter(k => k.includes("dimensions_"));
        const ccuDesc = row[dimKeys[0]]?.description || row[dimKeys[0]]?.id || "N/A";
        const ccuId = row[dimKeys[0]]?.id || "N/A";

        // 2. Identificar Conta/Indicador
        const indicador = (row[dimKeys[1]]?.description || "").toUpperCase();

        // 3. Capturar Valor (Montante)
        const valKeys = Object.keys(row).filter(k => row[k] && typeof row[k].rawValue !== 'undefined');
        const val = parseFloat(row[valKeys[0]]?.rawValue) || 0;

        if (!consolidated[ccuId]) {
          consolidated[ccuId] = { desc: ccuDesc, real: 0, budget: 0 };
        }

        // Lógica de Atribuição: Se a conta for a 1ª do Builder = Real, 2ª = Budget
        // Se houver nomes específicos, filtramos por eles
        if (indicador.includes("RESTRITA 2") || indicador.includes("BUDGET")) {
          consolidated[ccuId].budget += val;
        } else {
          consolidated[ccuId].real += val;
        }
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
