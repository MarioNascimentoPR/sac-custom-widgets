(function () {
    const tmpl = document.createElement("template");
    tmpl.innerHTML = `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap');
        :host { display: block; font-family: 'Plus Jakarta Sans', sans-serif; width: 100%; height: 100%; }
        .table-container { background: #fff; border: 1px solid #e4e4e7; border-radius: 12px; overflow: hidden; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        thead th { background: #f4f4f5; padding: 14px 18px; font-weight: 600; color: #71717a; text-transform: uppercase; font-size: 10px; border-bottom: 1px solid #e4e4e7; }
        tbody td { padding: 12px 18px; border-bottom: 1px solid #f4f4f5; vertical-align: middle; }
        .val-mono { font-family: 'Space Mono', monospace; text-align: right; font-size: 12px; }
        .alert { font-weight: 700; padding: 4px 8px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px; font-size: 11px; }
        .critical { color: #e11d48; background: #fff1f2; }
        .success { color: #16a34a; background: #f0fdf4; }
      </style>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Centro de Custo</th>
              <th style="text-align:right">Realizado</th>
              <th style="text-align:right">Budget</th>
              <th style="text-align:right">Desvio</th>
            </tr>
          </thead>
          <tbody id="tbody"></tbody>
        </table>
      </div>
    `;

    class EvoGATableOnly extends HTMLElement {
        constructor() {
            super();
            this._shadowRoot = this.attachShadow({ mode: "open" });
            this._shadowRoot.appendChild(tmpl.content.cloneNode(true));
        }

        onCustomWidgetAfterUpdate(changedProperties) {
            if (this.dataBindings) {
                const binding = this.dataBindings.getDataBinding("financialData");
                if (binding && binding.data) {
                    this._render(binding);
                }
            }
        }

        _render(binding) {
            const data = binding.data;
            const metadata = binding.metadata;
            const tbody = this._shadowRoot.getElementById("tbody");
            const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

            if (!data || data.length === 0) return;

            // Mapeia os IDs das contas restritas que você arrastou no Gerador
            // Geralmente Account_0, Account_1 ou similar
            const accountKeys = Object.keys(metadata.mainStructureMembers || {});
            const realKey = accountKeys[0]; // Conta Restrita 1
            const budgetKey = accountKeys[1]; // Conta Restrita 2

            tbody.innerHTML = data.map(row => {
                // Dimensão: Centro de Custo
                const ccuDesc = row.dimensions_0?.description || "S/ CCU";
                
                // Valores das contas restritas
                const realVal = parseFloat(row[realKey]?.rawValue) || 0;
                const budVal = parseFloat(row[budgetKey]?.rawValue) || 0;
                const delta = realVal - budVal;

                return `
                    <tr>
                        <td style="font-weight:600; color:#09090b">${ccuDesc}</td>
                        <td class="val-mono">${fmt.format(realVal)}</td>
                        <td class="val-mono" style="color: #71717a;">${fmt.format(budVal)}</td>
                        <td class="val-mono">
                            <span class="alert ${delta > 0.01 ? 'critical' : 'success'}">
                                ${delta > 0 ? '▲' : '▼'} ${fmt.format(Math.abs(delta))}
                            </span>
                        </td>
                    </tr>
                `;
            }).join('');
        }
    }

    customElements.define("evo-ga-table-only", EvoGATableOnly);
})();
