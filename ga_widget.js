(function() {
    let template = document.createElement("template");
    template.innerHTML = `
        <style>
            :host { display: block; font-family: 'Inter', sans-serif; }
            .card { background: #fff; border-radius: 12px; padding: 15px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #f1f5f9; }
            table { width: 100%; border-collapse: collapse; }
            th { text-align: left; font-size: 11px; text-transform: uppercase; color: #64748b; padding: 10px; border-bottom: 2px solid #f8fafc; }
            td { padding: 12px 10px; font-size: 13px; border-bottom: 1px solid #f8fafc; color: #334155; }
            .delta-pos { color: #ef4444; font-weight: 600; }
            .delta-neg { color: #10b981; font-weight: 600; }
            .bar-bg { background: #f1f5f9; height: 6px; border-radius: 10px; width: 80px; overflow: hidden; }
            .bar-fill { height: 100%; border-radius: 10px; }
            .red { background: #f87171; }
            .green { background: #34d399; }
        </style>
        <div class="card">
            <table>
                <thead>
                    <tr>
                        <th>Centro de Custo</th>
                        <th style="text-align: right;">Realizado</th>
                        <th style="text-align: right;">Delta</th>
                        <th>Impacto</th>
                    </tr>
                </thead>
                <tbody id="content"></tbody>
            </table>
        </div>
    `;

    class GATable extends HTMLElement {
        constructor() {
            super();
            this.attachShadow({ mode: "open" });
            this.shadowRoot.appendChild(template.content.cloneNode(true));
        }

        set rows(data) {
            const tbody = this.shadowRoot.getElementById("content");
            tbody.innerHTML = "";
            if (!data || !data.elements) return;

            data.elements.forEach(item => {
                const isOver = item.delta > 0;
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td><strong>${item.desc}</strong><br><small style="color: #94a3b8">${item.id}</small></td>
                    <td style="text-align: right;">${item.real}</td>
                    <td style="text-align: right;" class="${isOver ? 'delta-pos' : 'delta-neg'}">${item.delta}</td>
                    <td>
                        <div class="bar-bg">
                            <div class="bar-fill ${isOver ? 'red' : 'green'}" style="width: ${Math.min(Math.abs(item.impact), 100)}%"></div>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
    }
    customElements.define("evostream-ga-table", GATable);
})();
