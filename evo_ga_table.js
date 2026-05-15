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

            // 1. Identificar qual dimensão é a "Versão" e qual é a medida "AMOUNT"
            const versionDimKey = Object.keys(metadata.dimensions).find(k => 
                metadata.dimensions[k].description.toUpperCase().includes("VERS") || 
                metadata.dimensions[k].description.toUpperCase().includes("VERSION")
            ) || "dimensions_1";

            const measureKey = Object.keys(metadata.mainStructureMembers)[0];

            // 2. Agrupar dados por Centro de Custo (dimensions_0)
            const consolidated = {};

            data.forEach(row => {
                const ccuId = row.dimensions_0.id;
                const ccuDesc = row.dimensions_0.description;
                const versionDesc = row[versionDimKey]?.description.toUpperCase() || "";
                const val = parseFloat(row[measureKey]?.rawValue) || 0;

                if (!consolidated[ccuId]) {
                    consolidated[ccuId] = { desc: ccuDesc, real: 0, budget: 0 };
                }

                // Lógica de Atribuição baseada no membro da dimensão de Versão
                if (versionDesc.includes("REAL") || versionDesc.includes("ACTUAL")) {
                    consolidated[ccuId].real += val;
                } else if (versionDesc.includes("BUD") || versionDesc.includes("ORC") || versionDesc.includes("PLAN")) {
                    consolidated[ccuId].budget += val;
                }
            });

            // 3. Renderizar as linhas consolidadas
            tbody.innerHTML = Object.values(consolidated).map(item => {
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
