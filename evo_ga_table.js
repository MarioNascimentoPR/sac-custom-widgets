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
                // Tenta capturar o binding do feed definido no seu JSON
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

            // Mapeamento dinâmico baseado na estrutura do seu print
            const consolidated = {};

            data.forEach(row => {
                // Identifica as chaves de dimensões enviadas pelo SAC
                const dimKeys = Object.keys(row).filter(k => k.includes("dimensions_"));
                
                // No seu build: Centro de Custo está em um feed e Contas em outro.
                // O SAC costuma enviar na ordem dimensions_0, dimensions_1...
                const ccuDesc = row[dimKeys[0]]?.description || "N/A";
                const ccuId = row[dimKeys[0]]?.id || "N/A";
                const indicadorDesc = row[dimKeys[1]]?.description.toUpperCase() || "";

                // Captura a medida (Montante)
                const measureKey = Object.keys(metadata.mainStructureMembers)[0];
                const val = parseFloat(row[measureKey]?.rawValue) || 0;

                if (!consolidated[ccuId]) {
                    consolidated[ccuId] = { desc: ccuDesc, real: 0, budget: 0 };
                }

                if (indicadorDesc.includes("RESTRITA 1")) {
                    consolidated[ccuId].real = val;
                } else if (indicadorDesc.includes("RESTRITA 2")) {
                    consolidated[ccuId].budget = val;
                }
            });

            tbody.innerHTML = Object.values(consolidated)
                .sort((a, b) => (b.real - b.budget) - (a.real - a.budget))
                .map(item => {
                    const delta = item.real - item.budget;
                    return `
                        <tr>
                            <td style="font-weight:600; color:#09090b">${item.desc}</td>
                            <td class="val-mono">${fmt.format(item.real)}</td>
                            <td class="val-mono" style="color: #71717a;">${fmt.format(item.budget)}</td>
                            <td class="val-mono" style="text-align:right">
                                <span class="alert ${delta > 0.01 ? 'critical' : 'success'}">
                                    ${delta > 0 ? '▲' : '▼'} ${fmt.format(Math.abs(delta))}
                                </span>
                            </td>
                        </tr>
                    `;
                }).join('');
        }
    }

    if (!customElements.get("evo-ga-table-only")) {
        customElements.define("evo-ga-table-only", EvoGATableOnly);
    }
})();
