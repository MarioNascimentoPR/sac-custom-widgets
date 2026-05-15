(function () {
    const tmpl = document.createElement("template");
    tmpl.innerHTML = `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap');
        :host { display: block; font-family: 'Plus Jakarta Sans', sans-serif; width: 100%; height: 100%; }
        .table-container { background: #fff; border: 1px solid #e4e4e7; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        thead th { background: #f4f4f5; padding: 14px 18px; font-weight: 600; color: #71717a; text-transform: uppercase; font-size: 10px; border-bottom: 1px solid #e4e4e7; text-align: left; }
        tbody td { padding: 12px 18px; border-bottom: 1px solid #f4f4f5; vertical-align: middle; }
        .val-mono { font-family: 'Space Mono', monospace; text-align: right; font-size: 12px; }
        .alert { font-weight: 700; padding: 4px 8px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px; font-size: 11px; }
        .critical { color: #e11d48; background: #fff1f2; }
        .success { color: #16a34a; background: #f0fdf4; }
        .right { text-align: right; }
      </style>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Centro de Custo</th>
              <th class="right">Realizado</th>
              <th class="right">Budget</th>
              <th class="right">Desvio</th>
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

            // 1. Identificar chaves dinâmicas
            const dimCCU = "dimensions_0"; // Centro de Custo
            const dimIndicador = "dimensions_1"; // Onde estão "Conta restrita 1" e "2"
            const measureKey = Object.keys(metadata.mainStructureMembers)[0]; // "Montante"

            // 2. Consolidar dados (Agrupar o que o SAC manda em linhas separadas)
            const consolidated = {};

            data.forEach(row => {
                const ccuId = row[dimCCU].id;
                const ccuDesc = row[dimCCU].description;
                const indicadorDesc = row[dimIndicador]?.description.toUpperCase() || "";
                const val = parseFloat(row[measureKey]?.rawValue) || 0;

                if (!consolidated[ccuId]) {
                    consolidated[ccuId] = { desc: ccuDesc, real: 0, budget: 0 };
                }

                // Distribui o valor do Montante conforme a Conta Restrita da linha
                if (indicadorDesc.includes("RESTRITA 1")) {
                    consolidated[ccuId].real = val;
                } else if (indicadorDesc.includes("RESTRITA 2")) {
                    consolidated[ccuId].budget = val;
                }
            });

            // 3. Renderizar
            tbody.innerHTML = Object.values(consolidated)
                .sort((a, b) => (b.real - b.budget) - (a.real - a.budget)) // Ordena por maior desvio
                .map(item => {
                    const delta = item.real - item.budget;
                    return `
                        <tr>
                            <td style="font-weight:600; color:#09090b">${item.desc}</td>
                            <td class="val-mono">${fmt.format(item.real)}</td>
                            <td class="val-mono" style="color: #71717a;">${fmt.format(item.budget)}</td>
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
