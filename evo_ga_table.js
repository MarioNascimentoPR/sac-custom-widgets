(function () {
    let template = document.createElement("template");
    template.innerHTML = `
        <style>
            :host { 
                display: block; 
                width: 100%; 
                height: 100%; 
                overflow: auto; 
                background: #ffffff; 
                padding: 10px;
                box-sizing: border-box;
            }
            table { 
                width: 100%; 
                border-collapse: collapse; 
                font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
                table-layout: auto;
            }
            th { 
                color: #A0A0A0; 
                font-size: 11px; 
                font-weight: 700; 
                text-transform: uppercase; 
                letter-spacing: 0.5px; 
                padding: 16px 12px; 
                border-bottom: 2px solid #F2F2F2; 
                text-align: right; 
                vertical-align: bottom;
            }
            th:first-child { 
                text-align: left; 
            }
            td { 
                padding: 16px 12px; 
                border-bottom: 1px solid #F8F8F8; 
                font-size: 13px; 
                color: #555555; 
                vertical-align: middle;
            }
            td:first-child { 
                font-weight: 600; 
                color: #333333; 
                text-align: left; 
            }
            .numeric { 
                text-align: right; 
                font-family: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;
                font-weight: 500;
                color: #666666;
            }
            .center { text-align: center; }

            /* Texto colorido para variação */
            .var-positive { color: #D32F2F; font-weight: 600; } /* Acima do orçamento - Vermelho */
            .var-negative { color: #388E3C; font-weight: 600; } /* Abaixo do orçamento - Verde */

            /* Alinhamento de elementos em células */
            .cell-variance { white-space: nowrap; }
            .cell-variance .var-icon { margin-right: 4px; font-size: 1.2em; vertical-align: middle; }

            /* Barras de Progresso de Consumo */
            .cell-consumption { text-align: center !important; width: 120px; }
            .bar-container { position: relative; width: 100%; height: 6px; background-color: #F2F2F2; border-radius: 3px; overflow: hidden; margin-bottom: 4px; }
            .bar-fill { position: absolute; top: 0; left: 0; height: 100%; width: 0%; border-radius: 3px; transition: width 0.3s ease; }
            .fill-green { background-color: #4CAF50; }
            .fill-yellow { background-color: #FF9800; }
            .fill-red { background-color: #F44336; }
            .percent-value { font-size: 11px; color: #666666; margin-top: 2px; }

            /* Status Pills (Etiquetas) */
            .cell-status { text-align: center !important; }
            .status-pill { display: inline-block; padding: 4px 10px; border-radius: 16px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
            .status-abaixo { background-color: #E8F5E9; color: #2E7D32; } /* Verde */
            .status-atencao { background-color: #FFF3E0; color: #EF6C00; } /* Laranja */
            .status-acima { background-color: #FFEBEE; color: #C62828; } /* Vermelho */
        </style>
        <div id="table-container"></div>
    `;

    class EvoGATable extends HTMLElement {
        constructor() {
            super();
            this._shadowRoot = this.attachShadow({ mode: "open" });
            this._shadowRoot.appendChild(template.content.cloneNode(true));
            this._props = {};
        }

        onCustomWidgetBeforeUpdate(changedProperties) {
            this._props = { ...this._props, ...changedProperties };
        }

        onCustomWidgetAfterUpdate(changedProperties) {
            if ("financialData" in changedProperties && this.financialData) {
                this.renderTable(this.financialData);
            }
        }

        renderTable(financialData) {
            const container = this._shadowRoot.getElementById("table-container");
            container.innerHTML = ""; 

            if (!financialData || !financialData.data || financialData.data.length === 0) {
                container.innerHTML = "<div style='padding:10px;'>Aguardando dados no Builder...</div>";
                return;
            }

            try {
                const dimensions = financialData.metadata.dimensions || {};
                const measures = financialData.metadata.mainStructureMembers || {};

                const dimKeys = Object.keys(dimensions);
                const measureKeys = Object.keys(measures);

                if (dimKeys.length < 2 || measureKeys.length < 1) {
                    container.innerHTML = "<div style='padding:10px;'>Adicione pelo menos 2 dimensões e 1 conta/medida no painel.</div>";
                    return;
                }

                const rowDimKey = dimKeys[0];
                const colDimKey = dimKeys[1];
                const measureKey = measureKeys[0];

                const getName = (obj) => {
                    if (!obj) return "N/D";
                    return obj.label || obj.description || obj.id || "N/D";
                };

                // Parser robusto para garantir cálculo matemático independente da formatação do SAC
                const parseNumber = (val) => {
                    if (typeof val === 'number') return val;
                    if (!val || val === "-") return 0;
                    const cleanStr = String(val).replace(/[^0-9.,-]/g, '').replace(',', '.'); // Remove tudo exceto numéros e pontos, e troca vírgula por ponto
                    return parseFloat(cleanStr) || 0;
                };

                // Formatador visual de moeda e números
                const formatNumber = (num, withCurrency = true) => {
                    if (num === 0) return "-";
                    let options = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
                    if (withCurrency) {
                        options.style = 'currency';
                        options.currency = 'BRL';
                    }
                    return num.toLocaleString('pt-BR', options);
                };
                
                const formatPercentage = (val) => {
                    if (val === 0) return "-";
                    if (val === Infinity) return "∞";
                    return val.toFixed(1) + "%"; // Mostra 1 casa decimal, ex: 62.4%
                };

                const rowDimName = getName(dimensions[rowDimKey]);

                const uniqueCols = [...new Set(financialData.data.map(row => getName(row[colDimKey])))];
                const uniqueRows = [...new Set(financialData.data.map(row => getName(row[rowDimKey])))];

                const dataMap = {};
                financialData.data.forEach(row => {
                    const rKey = getName(row[row
