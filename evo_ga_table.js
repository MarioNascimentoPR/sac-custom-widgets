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
            }
            th:first-child { 
                text-align: left; 
            }
            td { 
                padding: 16px 12px; 
                border-bottom: 1px solid #F8F8F8; 
                font-size: 13px; 
                color: #555555; 
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
            .var-positive { color: #D32F2F; font-weight: 600; } /* Vermelho para desvio acima do orçado */
            .var-negative { color: #388E3C; font-weight: 600; } /* Verde para desvio abaixo do orçado */
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

                // Parser para garantir cálculo matemático limpo
                const parseNumber = (val) => {
                    if (typeof val === 'number') return val;
                    if (!val || val === "-") return 0;
                    const cleanStr = String(val).replace(/[^0-9.-]/g, '');
                    return parseFloat(cleanStr) || 0;
                };

                // Formatador visual de moeda (para o desvio e para os valores caso venham brutos)
                const formatNumber = (num) => {
                    if (num === 0) return "-";
                    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                };

                const rowDimName = getName(dimensions[rowDimKey]);

                const uniqueCols = [...new Set(financialData.data.map(row => getName(row[colDimKey])))];
                const uniqueRows = [...new Set(financialData.data.map(row => getName(row[rowDimKey])))];

                const dataMap = {};
                financialData.data.forEach(row => {
                    const rKey = getName(row[rowDimKey]);
                    const cKey = getName(row[colDimKey]);
                    
                    let value = "-";
                    
                    if (row[measureKey] && (row[measureKey].formattedValue !== undefined || row[measureKey].raw !== undefined)) {
                        value = row[measureKey].formattedValue || row[measureKey].raw;
                    } else {
                        for (const key in row) {
                            const cell = row[key];
                            if (cell && typeof cell === "object" && ("formattedValue" in cell || "raw" in cell)) {
                                value = cell.formattedValue || cell.raw;
                                break;
                            }
                        }
                    }

                    // Se vier como float longo sem formato do SAC, já formata
                    if (typeof value === "number" || !isNaN(parseFloat(value))) {
                        value = parseNumber(value);
                    }

                    if (!dataMap[rKey]) dataMap[rKey] = {};
                    dataMap[rKey][cKey] = value;
                });

                let tableHtml = `<table>`;
                
                tableHtml += `<thead><tr><th>${rowDimName}</th>`;
                uniqueCols.forEach(col => {
                    tableHtml += `<th>${col}</th>`;
                });
                tableHtml += `<th>VARIAÇÃO R$</th></tr></thead><tbody>`;

                uniqueRows.forEach(row => {
                    tableHtml += `<tr><td>${row}</td>`;
                    
                    let valOrcado = 0;
                    let valRealizado = 0;

                    uniqueCols.forEach(col => {
                        let cellValue = (dataMap[row] && dataMap[row][col] !== undefined) ? dataMap[row][col] : "-";
                        
                        // Extrai valores para matemática
                        const numValue = parseNumber(cellValue);
                        if (col.toUpperCase().includes("ORÇADO") || col.toUpperCase().includes("ORCADO")) {
                            valOrcado = numValue;
                        } else if (col.toUpperCase().includes("REALIZADO")) {
                            valRealizado = numValue;
                        }

                        // Aplica formatação final na célula da versão
                        if (typeof cellValue === "number") cellValue = formatNumber(cellValue);
                        
                        tableHtml += `<td class="numeric">${cellValue}</td>`;
                    });

                    // Cálculo e injeção do Desvio
                    const desvio = valRealizado - valOrcado;
                    const desvioFormatted = formatNumber(desvio);
                    
                    let colorClass = "";
                    if (desvio > 0) colorClass = "var-positive";
                    else if (desvio < 0) colorClass = "var-negative";

                    tableHtml += `<td class="numeric ${colorClass}">${desvioFormatted !== "-" ? (desvio > 0 ? "+" : "") + desvioFormatted : "-"}</td>`;
                    
                    tableHtml += `</tr>`;
                });

                tableHtml += `</tbody></table>`;
                container.innerHTML = tableHtml;

            } catch (error) {
                container.innerHTML = `<div style='padding:10px; color:red;'>Erro ao renderizar: ${error.message}</div>`;
                console.error("Erro no Widget:", error);
            }
        }
    }

    customElements.define("evo-ga-table-only", EvoGATable);
})();
