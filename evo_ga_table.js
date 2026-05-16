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
                border-collapse: separate; 
                border-spacing: 0;
                font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
                table-layout: auto;
            }
            th { 
                position: sticky; 
                top: 0;
                background-color: #ffffff; 
                z-index: 10;
                color: #A0A0A0; 
                font-size: 11px; 
                font-weight: 700; 
                text-transform: uppercase; 
                letter-spacing: 0.5px; 
                padding: 16px 12px; 
                box-shadow: 0 2px 0 0 #F2F2F2; 
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
            
            /* Configuração do Rodapé Fixo (Sticky Footer) */
            tfoot td {
                position: sticky;
                bottom: 0;
                background-color: #ffffff;
                z-index: 10;
                font-weight: bold !important;
                color: #333333 !important;
                box-shadow: 0 -2px 0 0 #F2F2F2; 
                border-bottom: none;
            }
            tfoot td:first-child {
                color: #333333 !important;
            }

            .numeric { 
                text-align: right; 
                font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; /* Mesma fonte do corpo */
                font-variant-numeric: tabular-nums; /* Força largura fixa por caractere (monoespaço apenas na largura) */
                font-weight: 500;
                color: #444444;
            }
            .center { text-align: center; }

            .var-positive { color: #D32F2F; font-weight: 600; } 
            .var-negative { color: #388E3C; font-weight: 600; } 

            .cell-variance { white-space: nowrap; }
            .cell-variance .var-icon { margin-right: 4px; font-size: 1.2em; vertical-align: middle; }

            .cell-consumption { text-align: center !important; width: 120px; }
            .bar-container { position: relative; width: 100%; height: 6px; background-color: #F2F2F2; border-radius: 3px; overflow: hidden; margin-bottom: 4px; }
            .bar-fill { position: absolute; top: 0; left: 0; height: 100%; width: 0%; border-radius: 3px; transition: width 0.3s ease; }
            .fill-green { background-color: #4CAF50; }
            .fill-yellow { background-color: #FF9800; }
            .fill-red { background-color: #F44336; }
            .percent-value { font-size: 11px; color: #666666; margin-top: 2px; }

            .cell-status { text-align: center !important; }
            .status-pill { display: inline-block; padding: 4px 10px; border-radius: 16px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
            .status-abaixo { background-color: #E8F5E9; color: #2E7D32; } 
            .status-atencao { background-color: #FFF3E0; color: #EF6C00; } 
            .status-acima { background-color: #FFEBEE; color: #C62828; } 
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

                const parseNumber = (val) => {
                    if (typeof val === 'number') return val;
                    if (!val || val === "-") return 0;
                    const cleanStr = String(val).replace(/[^0-9.,-]/g, '').replace(',', '.'); 
                    return parseFloat(cleanStr) || 0;
                };

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
                    return val.toFixed(1) + "%"; 
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

                    dataMap[rKey] = dataMap[rKey] || {};
                    dataMap[rKey][cKey] = parseNumber(value);
                });

                let tableHtml = `<table>`;
                
                tableHtml += `<thead><tr><th>${rowDimName}</th>`;
                uniqueCols.forEach(col => {
                    tableHtml += `<th>${col}</th>`;
                });
                tableHtml += `<th>VARIAÇÃO R$</th><th class="center">CONSUMO</th><th class="center">STATUS</th></tr></thead><tbody>`;

                let totalOrcado = 0;
                let totalRealizado = 0;

                uniqueRows.forEach(row => {
                    tableHtml += `<tr><td>${row}</td>`;
                    
                    let valOrcado = 0;
                    let valRealizado = 0;

                    uniqueCols.forEach(col => {
                        let numValue = (dataMap[row] && dataMap[row][col] !== undefined) ? dataMap[row][col] : 0;
                        
                        if (col.toUpperCase().includes("ORÇADO") || col.toUpperCase().includes("ORCADO")) {
                            valOrcado = numValue;
                        } else if (col.toUpperCase().includes("REALIZADO")) {
                            valRealizado = numValue;
                        }

                        tableHtml += `<td class="numeric">${formatNumber(numValue)}</td>`;
                    });

                    totalOrcado += valOrcado;
                    totalRealizado += valRealizado;

                    const desvio = valRealizado - valOrcado;
                    const desvioFormatted = formatNumber(Math.abs(desvio)); 
                    
                    let varColorClass = "";
                    if (desvio > 0) varColorClass = "var-positive";
                    else if (desvio < 0) varColorClass = "var-negative";
                    
                    tableHtml += `<td class="numeric cell-variance ${varColorClass}">${desvioFormatted !== "-" ? (desvio > 0 ? "+" : "") + desvioFormatted : "-"}</td>`;

                    let percentConsumption = valOrcado > 0 ? (valRealizado / valOrcado) * 100 : (valRealizado > 0 ? Infinity : 0);
                    
                    let barFillWidth = 0;
                    let barFillClass = "";
                    let consumptionText = "";
                    
                    if (percentConsumption === Infinity) {
                        barFillWidth = 100;
                        barFillClass = "fill-red";
                        consumptionText = "∞";
                    } else if (percentConsumption === 0) {
                        barFillWidth = 0;
                        consumptionText = "-";
                    } else {
                        barFillWidth = Math.min(100, percentConsumption); 
                        if (percentConsumption < 90) barFillClass = "fill-green";
                        else if (percentConsumption < 100) barFillClass = "fill-yellow";
                        else barFillClass = "fill-red";
                        consumptionText = formatPercentage(percentConsumption);
                    }
                    
                    tableHtml += `<td class="center cell-consumption">
                        <div class="bar-container"><div class="bar-fill ${barFillClass}" style="width: ${barFillWidth}%;"></div></div>
                        <div class="percent-value">${consumptionText}</div>
                    </td>`;

                    let statusText = "";
                    let statusPillClass = "";
                    
                    if (percentConsumption < 90) { statusText = "Abaixo"; statusPillClass = "status-abaixo"; }
                    else if (percentConsumption < 100) { statusText = "Atenção"; statusPillClass = "status-atencao"; }
                    else if (percentConsumption >= 100) { statusText = "Acima"; statusPillClass = "status-acima"; }
                    else if (valOrcado === 0 && valRealizado === 0) { statusText = "-"; statusPillClass = ""; } 
                    else if (valOrcado === 0 && valRealizado > 0) { statusText = "Acima"; statusPillClass = "status-acima"; } 

                    let statusHtml = statusText !== "-" ? `<span class="status-pill ${statusPillClass}">${statusText}</span>` : "-";
                    tableHtml += `<td class="center cell-status">${statusHtml}</td>`;
                    tableHtml += `</tr>`;
                });

                tableHtml += `</tbody>`;

                const totalDesvio = totalRealizado - totalOrcado;
                const totalDesvioFormatted = formatNumber(Math.abs(totalDesvio));
                
                let totalVarColorClass = "";
                if (totalDesvio > 0) totalVarColorClass = "var-positive";
                else if (totalDesvio < 0) totalVarColorClass = "var-negative";

                let totalPercentConsumption = totalOrcado > 0 ? (totalRealizado / totalOrcado) * 100 : (totalRealizado > 0 ? Infinity : 0);
                let totalBarFillWidth = 0;
                let totalBarFillClass = "";
                let totalConsumptionText = "";

                if (totalPercentConsumption === Infinity) {
                    totalBarFillWidth = 100;
                    totalBarFillClass = "fill-red";
                    totalConsumptionText = "∞";
                } else if (totalPercentConsumption === 0) {
                    totalBarFillWidth = 0;
                    totalConsumptionText = "-";
                } else {
                    totalBarFillWidth = Math.min(100, totalPercentConsumption);
                    if (totalPercentConsumption < 90) totalBarFillClass = "fill-green";
                    else if (totalPercentConsumption < 100) totalBarFillClass = "fill-yellow";
                    else totalBarFillClass = "fill-red";
                    totalConsumptionText = formatPercentage(totalPercentConsumption);
                }

                let totalStatusText = "";
                let totalStatusPillClass = "";
                if (totalPercentConsumption < 90) { totalStatusText = "Abaixo"; totalStatusPillClass = "status-abaixo"; }
                else if (totalPercentConsumption < 100) { totalStatusText = "Atenção"; totalStatusPillClass = "status-atencao"; }
                else if (totalPercentConsumption >= 100) { totalStatusText = "Acima"; totalStatusPillClass = "status-acima"; }

                let totalStatusHtml = totalStatusText !== "" ? `<span class="status-pill ${totalStatusPillClass}">${totalStatusText}</span>` : "-";

                tableHtml += `<tfoot><tr><td>TOTAL GERAL</td>`;
                uniqueCols.forEach(col => {
                    if (col.toUpperCase().includes("ORÇADO") || col.toUpperCase().includes("ORCADO")) {
                        tableHtml += `<td class="numeric">${formatNumber(totalOrcado)}</td>`;
                    } else if (col.toUpperCase().includes("REALIZADO")) {
                        tableHtml += `<td class="numeric">${formatNumber(totalRealizado)}</td>`;
                    } else {
                        tableHtml += `<td class="numeric">-</td>`;
                    }
                });

                tableHtml += `<td class="numeric cell-variance ${totalVarColorClass}">${totalDesvioFormatted !== "-" ? (totalDesvio > 0 ? "+" : "") + totalDesvioFormatted : "-"}</td>`;
                tableHtml += `<td class="center cell-consumption">
                    <div class="bar-container"><div class="bar-fill ${totalBarFillClass}" style="width: ${totalBarFillWidth}%;"></div></div>
                    <div class="percent-value">${totalConsumptionText}</div>
                </td>`;
                tableHtml += `<td class="center cell-status">${totalStatusHtml}</td>`;
                tableHtml += `</tr></tfoot>`;

                tableHtml += `</table>`;
                container.innerHTML = tableHtml;

            } catch (error) {
                container.innerHTML = `<div style='padding:10px; color:red;'>Erro ao renderizar: ${error.message}</div>`;
                console.error("Erro no Widget:", error);
            }
        }
    }

    if (!customElements.get("evo-ga-table-only")) {
        customElements.define("evo-ga-table-only", EvoGATable);
    }
})();
