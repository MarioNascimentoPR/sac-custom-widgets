(function () {
    let template = document.createElement("template");
    template.innerHTML = `
        <style>
            :host { 
                display: block; 
                width: 100%; 
                height: 100%; 
                background: #ffffff; 
                box-sizing: border-box;
            }
            #table-container {
                width: 100%;
                height: 100%;
                overflow: auto;
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
                background-color: #F4F6F9; 
                z-index: 10;
                color: #222222; /* Cor igualada ao Total Geral */
                font-size: 11px; 
                font-weight: 700; 
                text-transform: uppercase; 
                letter-spacing: 0.5px; 
                padding: 12px 10px; 
                box-shadow: 0 2px 0 0 #CCCCCC; 
                text-align: right; 
                vertical-align: bottom;
            }
            th:first-child { 
                text-align: left; 
            }
            th.sortable {
                cursor: pointer;
                user-select: none;
                transition: background 0.2s;
            }
            th.sortable:hover {
                background-color: #E6E9F0;
            }
            .sort-icon {
                font-size: 10px;
                margin-left: 4px;
                color: #555;
            }
            td { 
                padding: 10px; 
                border-bottom: 1px solid #EAEAEA; 
                font-size: 13px; 
                color: #444444; 
                vertical-align: middle;
            }
            td:first-child { 
                font-weight: 600; 
                color: #222222; 
                text-align: left; 
            }
            
            tfoot td {
                position: sticky;
                bottom: 0;
                background-color: #F4F6F9; 
                z-index: 10;
                font-weight: 700 !important;
                color: #222222 !important;
                box-shadow: 0 -2px 0 0 #CCCCCC; 
                border-bottom: none;
                padding: 12px 10px;
            }
            tfoot td:first-child {
                color: #222222 !important;
            }

            .numeric { 
                text-align: right; 
                font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
                font-variant-numeric: tabular-nums; 
                font-weight: 500;
            }
            .center { text-align: center; }

            .var-positive { color: #D32F2F; font-weight: 600; } 
            .var-negative { color: #2E7D32; font-weight: 600; } 

            .cell-variance { white-space: nowrap; }

            .cell-consumption { width: 140px; }
            .consumption-wrapper { display: flex; align-items: center; gap: 8px; justify-content: flex-end; }
            .bar-container { position: relative; flex-grow: 1; min-width: 60px; height: 8px; background-color: #EAEAEA; border-radius: 4px; overflow: hidden; }
            .bar-fill { position: absolute; top: 0; left: 0; height: 100%; width: 0%; border-radius: 4px; transition: width 0.3s ease; }
            .fill-green { background-color: #2E7D32; }
            .fill-yellow { background-color: #EF6C00; }
            .fill-red { background-color: #D32F2F; }
            .percent-value { font-size: 12px; font-weight: 500; color: #444444; width: 45px; text-align: right; font-variant-numeric: tabular-nums; }

            .cell-status { text-align: center !important; width: 90px; }
            .status-pill { display: inline-block; padding: 4px 0; width: 100%; max-width: 80px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; text-align: center; }
            .status-abaixo { background-color: #E8F5E9; color: #2E7D32; border: 1px solid #C8E6C9; } 
            .status-atencao { background-color: #FFF3E0; color: #EF6C00; border: 1px solid #FFE0B2; } 
            .status-acima { background-color: #FFEBEE; color: #C62828; border: 1px solid #FFCDD2; } 
        </style>
        <div id="table-container"></div>
    `;

    class EvoGATable extends HTMLElement {
        constructor() {
            super();
            this._shadowRoot = this.attachShadow({ mode: "open" });
            this._shadowRoot.appendChild(template.content.cloneNode(true));
            this._props = {};
            this._sortState = { col: null, dir: 'asc' }; // Controle de Ordenação
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

                const formatNumber = (num, withCurrency = true, isVariance = false, rawValue = 0) => {
                    if (num === 0 && !isVariance) return "-";
                    let options = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
                    if (withCurrency) {
                        options.style = 'currency';
                        options.currency = 'BRL';
                    }
                    let formatted = num.toLocaleString('pt-BR', options);
                    
                    if (isVariance && rawValue < 0) {
                        formatted = "-" + formatted;
                    } else if (isVariance && rawValue > 0) {
                        formatted = "+" + formatted;
                    }
                    return formatted;
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

                // Prepara array de dados estruturados para ordenação
                let tableData = uniqueRows.map(row => {
                    let valOrcado = 0;
                    let valRealizado = 0;
                    let numValues = {};

                    uniqueCols.forEach(col => {
                        let numValue = (dataMap[row] && dataMap[row][col] !== undefined) ? dataMap[row][col] : 0;
                        numValues[col] = numValue;

                        if (col.toUpperCase().includes("ORÇADO") || col.toUpperCase().includes("ORCADO")) {
                            valOrcado = numValue;
                        } else if (col.toUpperCase().includes("REALIZADO")) {
                            valRealizado = numValue;
                        }
                    });

                    const desvio = valRealizado - valOrcado;
                    const percentConsumption = valOrcado > 0 ? (valRealizado / valOrcado) * 100 : (valRealizado > 0 ? Infinity : 0);

                    return { rowName: row, valOrcado, valRealizado, desvio, percentConsumption, numValues };
                });

                // Executa Ordenação caso haja estado
                if (this._sortState.col) {
                    tableData.sort((a, b) => {
                        let valA = a[this._sortState.col];
                        let valB = b[this._sortState.col];
                        
                        // Fallback para string comparison na primeira coluna
                        if (typeof valA === 'string' && typeof valB === 'string') {
                            return this._sortState.dir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                        }

                        if (valA < valB) return this._sortState.dir === 'asc' ? -1 : 1;
                        if (valA > valB) return this._sortState.dir === 'asc' ? 1 : -1;
                        return 0;
                    });
                }

                let tableHtml = `<table>`;
                
                // Construção Dinâmica dos Cabeçalhos com Indicadores de Ordenação
                let sortIconRow = this._sortState.col === 'rowName' ? (this._sortState.dir === 'asc' ? ' ▲' : ' ▼') : '';
                tableHtml += `<thead><tr><th data-sort="rowName" class="sortable">${rowDimName}<span class="sort-icon">${sortIconRow}</span></th>`;
                
                uniqueCols.forEach(col => {
                    let sortKey = '';
                    if (col.toUpperCase().includes("ORÇADO") || col.toUpperCase().includes("ORCADO")) sortKey = 'valOrcado';
                    else if (col.toUpperCase().includes("REALIZADO")) sortKey = 'valRealizado';

                    let sortIcon = this._sortState.col === sortKey ? (this._sortState.dir === 'asc' ? ' ▲' : ' ▼') : '';
                    let sortAttr = sortKey ? `data-sort="${sortKey}" class="sortable"` : '';
                    tableHtml += `<th ${sortAttr}>${col}<span class="sort-icon">${sortIcon}</span></th>`;
                });

                let sortIconDesvio = this._sortState.col === 'desvio' ? (this._sortState.dir === 'asc' ? ' ▲' : ' ▼') : '';
                tableHtml += `<th data-sort="desvio" class="sortable">VARIAÇÃO R$<span class="sort-icon">${sortIconDesvio}</span></th>`;
                tableHtml += `<th class="numeric">CONSUMO</th><th class="center">STATUS</th></tr></thead><tbody>`;

                let totalOrcado = 0;
                let totalRealizado = 0;

                // Renderização a partir do Array Ordenado
                tableData.forEach(rowObj => {
                    tableHtml += `<tr><td>${rowObj.rowName}</td>`;
                    
                    uniqueCols.forEach(col => {
                        let numValue = rowObj.numValues[col];
                        tableHtml += `<td class="numeric">${formatNumber(numValue)}</td>`;
                    });

                    totalOrcado += rowObj.valOrcado;
                    totalRealizado += rowObj.valRealizado;

                    const desvioFormatted = formatNumber(Math.abs(rowObj.desvio), true, true, rowObj.desvio); 
                    
                    let varColorClass = "";
                    if (rowObj.desvio > 0) varColorClass = "var-positive";
                    else if (rowObj.desvio < 0) varColorClass = "var-negative";
                    
                    tableHtml += `<td class="numeric cell-variance ${varColorClass}">${rowObj.desvio !== 0 ? desvioFormatted : "-"}</td>`;

                    let barFillWidth = 0;
                    let barFillClass = "";
                    let consumptionText = "";
                    
                    if (rowObj.percentConsumption === Infinity) {
                        barFillWidth = 100;
                        barFillClass = "fill-red";
                        consumptionText = "∞";
                    } else if (rowObj.percentConsumption === 0) {
                        barFillWidth = 0;
                        consumptionText = "-";
                    } else {
                        barFillWidth = Math.min(100, rowObj.percentConsumption); 
                        if (rowObj.percentConsumption < 90) barFillClass = "fill-green";
                        else if (rowObj.percentConsumption < 100) barFillClass = "fill-yellow";
                        else barFillClass = "fill-red";
                        consumptionText = formatPercentage(rowObj.percentConsumption);
                    }
                    
                    tableHtml += `<td class="cell-consumption">
                        <div class="consumption-wrapper">
                            <div class="bar-container"><div class="bar-fill ${barFillClass}" style="width: ${barFillWidth}%;"></div></div>
                            <div class="percent-value">${consumptionText}</div>
                        </div>
                    </td>`;

                    let statusText = "";
                    let statusPillClass = "";
                    
                    if (rowObj.percentConsumption < 90) { statusText = "Abaixo"; statusPillClass = "status-abaixo"; }
                    else if (rowObj.percentConsumption < 100) { statusText = "Atenção"; statusPillClass = "status-atencao"; }
                    else if (rowObj.percentConsumption >= 100) { statusText = "Acima"; statusPillClass = "status-acima"; }
                    else if (rowObj.valOrcado === 0 && rowObj.valRealizado === 0) { statusText = "-"; statusPillClass = ""; } 
                    else if (rowObj.valOrcado === 0 && rowObj.valRealizado > 0) { statusText = "Acima"; statusPillClass = "status-acima"; } 

                    let statusHtml = statusText !== "-" ? `<span class="status-pill ${statusPillClass}">${statusText}</span>` : "-";
                    tableHtml += `<td class="center cell-status">${statusHtml}</td>`;
                    tableHtml += `</tr>`;
                });

                tableHtml += `</tbody>`;

                const totalDesvio = totalRealizado - totalOrcado;
                const totalDesvioFormatted = formatNumber(Math.abs(totalDesvio), true, true, totalDesvio);
                
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

                tableHtml += `<td class="numeric cell-variance ${totalVarColorClass}">${totalDesvio !== 0 ? totalDesvioFormatted : "-"}</td>`;
                tableHtml += `<td class="cell-consumption">
                    <div class="consumption-wrapper">
                        <div class="bar-container"><div class="bar-fill ${totalBarFillClass}" style="width: ${totalBarFillWidth}%;"></div></div>
                        <div class="percent-value">${totalConsumptionText}</div>
                    </div>
                </td>`;
                tableHtml += `<td class="center cell-status">${totalStatusHtml}</td>`;
                tableHtml += `</tr></tfoot>`;

                tableHtml += `</table>`;
                container.innerHTML = tableHtml;

                // Bind Eventos de Ordenação
                container.querySelectorAll('.sortable').forEach(th => {
                    th.addEventListener('click', () => {
                        const col = th.getAttribute('data-sort');
                        if (this._sortState.col === col) {
                            this._sortState.dir = this._sortState.dir === 'asc' ? 'desc' : 'asc';
                        } else {
                            this._sortState.col = col;
                            this._sortState.dir = 'asc';
                        }
                        this.renderTable(financialData); // Re-render table bound to updated state
                    });
                });

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
