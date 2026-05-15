(function () {
    const tmpl = document.createElement("template");
    tmpl.innerHTML = `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap');
        :host { display: block; font-family: 'Plus Jakarta Sans', sans-serif; width: 100%; height: 100%; min-height: 200px; }
        .table-container { background: #fff; border: 1px solid #e4e4e7; border-radius: 12px; overflow: hidden; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        thead th { background: #f4f4f5; padding: 14px 18px; font-weight: 600; color: #71717a; text-transform: uppercase; font-size: 10px; border-bottom: 1px solid #e4e4e7; text-align: left; }
        tbody td { padding: 12px 18px; border-bottom: 1px solid #f4f4f5; vertical-align: middle; }
        .val-mono { font-family: 'Space Mono', monospace; text-align: right; font-size: 12px; }
        .alert { font-weight: 700; padding: 4px 8px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px; font-size: 11px; }
        .critical { color: #e11d48; background: #fff1f2; }
        .success { color: #16a34a; background: #f0fdf4; }
        .debug-panel { font-size: 9px; color: #a1a1aa; padding: 10px; background: #fdfdfd; border-top: 1px solid #eee; font-family: monospace; }
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
        <div id="debug" class="debug-panel"></div>
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
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:40px;">DADOS NÃO RECEBIDOS. Verifique o Data Binding no SAC.</td></tr>';
                return;
            }

            const consolidated = {};

            data.forEach((row, index) => {
                // SCANNER: Identifica chaves de dimensões e de valores dinamicamente
                const keys = Object.keys(row);
                const dimKeys = keys.filter(k => row[k] && row[k].id !== undefined);
                const valKeys = keys.filter(k => row[k] && row[k].rawValue !== undefined);

                // No seu cenário: 
                // dimensions_0 (ou primeira dim de texto) = Centro de Custo
                // dimensions_1 (ou segunda dim de texto) = Conta Restrita
                const ccuDesc = row[dimKeys[0]]?.description || row[dimKeys[0]]?.id || "N/A";
                const ccuId = row[dimKeys[0]]?.id || "N/A";
                const indicadorDesc = (row[dimKeys[1]]?.description || "").toUpperCase();

                // Valor vem da primeira medida numérica encontrada (Montante)
                const val = parseFloat(row[valKeys[0]]?.rawValue) || 0;

                if (!consolidated[ccuId]) {
                    consolidated[ccuId] = { desc: ccuDesc, real: 0, budget: 0 };
                }

                // Lógica de separação
                if (indicadorDesc.includes("RESTRITA 2") || indicadorDesc.includes("BUDGET") || indicadorDesc.includes("ORC")) {
                    consolidated[ccuId].budget += val;
                } else {
                    consolidated[ccuId].real += val;
                }
            });

            const rowsHtml = Object.values(consolidated).map(item => {
                const delta = item.real - item.budget;
                return `
                    <tr>
                        <td style="font-weight:600;">${item.desc}</td>
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

            tbody.innerHTML = rowsHtml || '<tr><td colspan="4" style="text-align:center;">Erro ao processar mapeamento.</td></tr>';
            
            // PAINEL DE DEBUG: Isso vai nos dizer exatamente o que está chegando
            debug.textContent = `Linhas: ${data.length} | Dimensões: ${Object.keys(data[0]).filter(k => data[0][k]?.id).length} | Medidas: ${Object.keys(data[0]).filter(k => data[0][k]?.rawValue !== undefined).length}`;
        }
    }

    customElements.define("evo-ga-table-only", EvoGATableOnly);
})();
