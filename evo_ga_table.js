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
        .debug { font-size: 9px; color: #a1a1aa; padding: 8px; font-family: monospace; border-top: 1px solid #f4f4f5; }
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
        <div id="debug" class="debug"></div>
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
            const tbody = this._shadowRoot.getElementById("tbody");
            const debug = this._shadowRoot.getElementById("debug");
            const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

            if (!data || data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:30px;">Sem dados (Verifique os filtros do SAC)</td></tr>';
                return;
            }

            // Mapeia as chaves que possuem valores numéricos
            // O SAC pode enviar como 'mainStructureMember_X' ou 'measure_X'
            const sampleRow = data[0];
            const valueKeys = Object.keys(sampleRow).filter(k => sampleRow[k] && typeof sampleRow[k].rawValue !== 'undefined');

            tbody.innerHTML = data.map(row => {
                const dimKey = Object.keys(row).find(k => k.includes("dimensions_"));
                const ccuDesc = row[dimKey]?.description || "N/A";

                // Se você tem duas contas restritas, elas serão os dois primeiros índices de valores detectados
                const real = parseFloat(row[valueKeys[0]]?.rawValue) || 0;
                const budget = parseFloat(row[valueKeys[1]]?.rawValue) || 0;
                const delta = real - budget;

                return `
                    <tr>
                        <td style="font-weight:600;">${ccuDesc}</td>
                        <td class="val-mono">${fmt.format(real)}</td>
                        <td class="val-mono" style="color: #71717a;">${fmt.format(budget)}</td>
                        <td class="val-mono">
                            <span class="alert ${delta > 0.01 ? 'critical' : 'success'}">
                                ${delta > 0 ? '▲' : '▼'} ${fmt.format(Math.abs(delta))}
                            </span>
                        </td>
                    </tr>
                `;
            }).join('');

            debug.textContent = `Chaves de valor detectadas: ${valueKeys.join(" | ")}`;
        }
    }

    customElements.define("evo-ga-table-only", EvoGATableOnly);
})();
