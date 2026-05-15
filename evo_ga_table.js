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
        .alert { font-weight: 700; padding: 2px 6px; border-radius: 4px; display: inline-block; min-width: 60px; text-align: center; }
        .critical { color: #e11d48; background: #fff1f2; }
        .success { color: #16a34a; background: #f0fdf4; }
      </style>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th id="col-dim">Centro de Custo</th>
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
            const tbody = this._shadowRoot.getElementById("tbody");
            const data = binding.data;
            const metadata = binding.metadata;
            const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

            if (!data || data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">Nenhum dado encontrado ou mapeado.</td></tr>';
                return;
            }

            // DEBUG: Veja no console do navegador (F12) como os dados chegam
            console.log("SAC Data Payload:", data);

            // Identificar as chaves de medidas (ex: "mainStructureMember_0")
            const measureKeys = Object.keys(metadata.mainStructureMembers || {});
            const realKey = measureKeys[0]; // Primeira medida arrastada
            const budgetKey = measureKeys[1]; // Segunda medida arrastada

            tbody.innerHTML = data.map(row => {
                // Captura a descrição da primeira dimensão (Centro de Custo)
                const dimKeys = Object.keys(row).filter(k => k.includes("dimensions_"));
                const ccuDesc = row[dimKeys[0]]?.description || "S/ CCU";
                
                const realVal = row[realKey]?.rawValue || 0;
                const budVal = row[budgetKey]?.rawValue || 0;
                const delta = realVal - budVal;

                return `
                    <tr>
                        <td style="font-weight:600; color:#09090b">${ccuDesc}</td>
                        <td class="val-mono">${fmt.format(realVal)}</td>
                        <td class="val-mono">${fmt.format(budVal)}</td>
                        <td class="val-mono">
                            <span class="alert ${delta > 1 ? 'critical' : 'success'}">
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
