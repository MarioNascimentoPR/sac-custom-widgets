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
                color: #222222; 
                font-size: 11px; 
                font-weight: 700; 
                text-transform: uppercase; 
                letter-spacing: 0.5px; 
                padding: 10px 10px;
                box-shadow: 0 2px 0 0 #CCCCCC; 
                text-align: right; 
                vertical-align: bottom;
            }
            th:first-child { text-align: left; }
            th.sortable { cursor: pointer; user-select: none; transition: background 0.2s; }
            th.sortable:hover { background-color: #E6E9F0; }
            .sort-icon { font-size: 10px; margin-left: 4px; color: #555; }
            
            td { 
                padding: 6px 10px; 
                border-bottom: 1px solid #EAEAEA; 
                font-size: 13px; 
                color: #444444; 
                vertical-align: middle;
            }
            td:first-child { text-align: left; }
            
            /* Estilos para o Acordeão (Nível 1 - CC) */
            tr.row-cc { cursor: pointer; transition: background-color 0.15s; }
            tr.row-cc:hover { background-color: #F8F9FA; }
            tr.row-cc td:first-child { font-weight: 600; color: #222222; }
            .expand-icon { 
                display: inline-block; 
                width: 14px; 
                margin-right: 6px; 
                font-size: 10px;
                color: #888; 
                transition: transform 0.2s ease;
                text-align: center;
            }
            tr.row-cc.expanded .expand-icon { transform: rotate(90deg); color: #000; }

            /* Estilos para o Drill-down (Nível 2 - Conta) */
            tr.row-conta td { 
                background-color: #FAFAFA; 
                border-bottom: none;
                padding-top: 3px;
                padding-bottom: 3px; 
                font-size: 12px;
            }
            
            tr.row-conta:last-child td {
                border-bottom: 1px solid #EAEAEA;
            }

            tr.row-conta td:first-child { 
                padding-left: 38px;
                font-weight: 400; 
                color: #555555; 
                position: relative;
            }
            
            tr.row-conta td:first-child::before { 
                content: '↳'; 
                position: absolute; 
                left: 20px; 
                top: 50%;
                transform: translateY(-50%);
                color: #CCCCCC;
                font-size: 12px;
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
                padding: 10px 10px;
            }
            tfoot td:first-child { color: #222222 !important; }

            .numeric { text-align: right; font-variant-numeric: tabular-nums; font-weight: 500; }
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
            this._sortState = { col: null, dir: 'asc' };
            this._expandedRow = null; 
            this._currentData = null; 
        }

        onCustomWidgetBeforeUpdate(changedProperties) {
            this._props = { ...this._props, ...changedProperties };
        }

        onCustomWidgetAfterUpdate(changedProperties) {
            if ("financialData" in changedProperties && this.financialData) {
                this._currentData = this.financialData;
                this.renderTable();
            }
        }

        renderTable() {
            const financialData = this._currentData;
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

                if (dimKeys.length < 3 || measureKeys.length < 1) {
                    container.innerHTML = "<div style='padding:10px; color:#D32F2F;'>Adicione 3 dimensões (Ex: 1. Centro de Custo, 2. Conta Contábil, 3. Orçado/Realizado) e 1 medida.</div>";
                    return;
                }

                const ccDimKey = dimKeys[0];    
                const contaDimKey = dimKeys[1]; 
                const colDimKey = dimKeys[2];   
                const measureKey = measureKeys[0];

                const getName = (obj) => obj ? (obj.label || obj.description || obj.id || "N/D") : "N/D";
                const parseNumber = (val) => {
                    if (typeof val === 'number') return val;
                    if (!val || val === "-") return 0;
                    const cleanStr = String(val).replace(/[^0-9.,-]/g, '').replace(',', '.'); 
                    return parseFloat(cleanStr) || 0;
                };

                const formatNumber = (num, withCurrency = true, isVariance = false, rawValue = 0) => {
                    if (num === 0 && !isVariance) return "-";
                    let options = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
                    if (withCurrency) { options.style = 'currency'; options.currency = 'BRL'; }
                    let formatted = num.toLocaleString('pt-BR', options);
                    if (isVariance && rawValue < 0) formatted = "-" + formatted;
                    else if (isVariance && rawValue > 0) formatted = "+" + formatted;
                    return formatted;
                };
                
                const formatPercentage = (val) => val === 0 ? "-" : (val === Infinity ? "∞" : val.toFixed(1) + "%");

                const headerName = getName(dimensions[ccDimKey]);

                const dataMap = {};
                const uniqueColsSet = new Set();

                financialData.data.forEach(row => {
                    const cc = getName(row[ccDimKey]);
                    const conta = getName(row[contaDimKey]);
                    const col = getName(row[colDimKey]);
                    uniqueColsSet.add(col);
                    
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

                    const numVal = parseNumber(value);

                    if (!dataMap[cc]) {
                        dataMap[cc] = { totals: {}, contas: {} };
                    }
                    if (!dataMap[cc].contas[conta]) {
                        dataMap[cc].contas[conta] = {};
                    }

                    dataMap[cc].contas[conta][col] = numVal;
                    dataMap[cc].totals[col] = (dataMap[cc].totals[col] || 0) + numVal; 
                });

                const uniqueCols = Array.from(uniqueColsSet);

                const buildRowMetrics = (name, valuesMap) => {
                    let valOrcado = 0;
                    let valRealizado = 0;
                    let numValues = {};

                    uniqueCols.forEach(col => {
                        let val = valuesMap[col] || 0;
                        numValues[col] = val;
                        if (col.toUpperCase().includes("ORÇADO") || col.toUpperCase().includes("ORCADO")) valOrcado += val;
                        else if (col.toUpperCase().includes("REALIZADO")) valRealizado += val;
                    });

                    const desvio = valRealizado - valOrcado;
                    const percentConsumption = valOrcado > 0 ? (valRealizado / valOrcado) * 100 : (valRealizado > 0 ? Infinity : 0);
                    return { name, valOrcado, valRealizado, desvio, percentConsumption, numValues };
                };

                let tableData = Object.keys(dataMap).map(cc => {
                    let ccNode = buildRowMetrics(cc, dataMap[cc].totals);
                    ccNode.children = Object.keys(dataMap[cc].contas).map(conta => buildRowMetrics(conta, dataMap[cc].contas[conta]));
                    ccNode.children.sort((a, b) => a.name.localeCompare(b.name));
                    return ccNode;
                });

                if (this._sortState.col) {
                    tableData.sort((a, b) => {
                        let valA = a[this._sortState.col] !== undefined ? a[this._sortState.col] : a.numValues[this._sortState.col];
                        let valB = b[this._sortState.col] !== undefined ? b[this._sortState.col] : b.numValues[this._sortState.col];
                        
                        if (typeof valA === 'string' && typeof valB === 'string') {
                            return this._sortState.dir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                        }
                        if (valA < valB) return this._sortState.dir === 'asc' ? -1 : 1;
                        if (valA > valB) return this._sortState.dir === 'asc' ? 1 : -1;
                        return 0;
                    });
                }

                let tableHtml = `<table>`;
                let sortIconRow = this._sortState.col === 'name' ? (this._sortState.dir === 'asc' ? ' ▲' : ' ▼') : '';
                tableHtml += `<thead><tr><th data-sort="name" class="sortable">${headerName}<span class="sort-icon">${sortIconRow}</span></th>`;
                
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

                const renderRowHtml = (rowObj, isChild = false) => {
                    let rowClass = isChild ? "row-conta" : "row-cc";
                    let expandClass = (!isChild && this._expandedRow === rowObj.name) ? "expanded" : "";
                    let dataAttr = !isChild ? `data-cc="${rowObj.name}"` : "";
                    
                    let html = `<tr class="${rowClass} ${expandClass}" ${dataAttr}>`;
                    let nameCell = isChild ? rowObj.name : `<span class="expand-icon">▶</span>${rowObj.name}`;
                    html += `<td>${nameCell}</td>`;
                    
                    uniqueCols.forEach(col => {
                        let numValue = rowObj.numValues[col];
                        html += `<td class="numeric">${formatNumber(numValue)}</td>`;
                    });

                    if (!isChild) {
                        totalOrcado += rowObj.valOrcado;
                        totalRealizado += rowObj.valRealizado;
                    }

                    const desvioFormatted = formatNumber(Math.abs(rowObj.desvio), true, true, rowObj.desvio); 
                    let varColorClass = rowObj.desvio > 0 ? "var-positive" : (rowObj.desvio < 0 ? "var-negative" : "");
                    html += `<td class="numeric cell-variance ${varColorClass}">${rowObj.desvio !== 0 ? desvioFormatted : "-"}</td>`;

                    let barFillWidth = rowObj.percentConsumption === Infinity ? 100 : Math.min(100, rowObj.percentConsumption || 0);
                    let barFillClass = rowObj.percentConsumption === Infinity || rowObj.percentConsumption >= 100 ? "fill-red" : (rowObj.percentConsumption < 90 ? "fill-green" : "fill-yellow");
                    let consumptionText = rowObj.percentConsumption === Infinity ? "∞" : (rowObj.percentConsumption === 0 ? "-" : formatPercentage(rowObj.percentConsumption));
                    
                    if(rowObj.valOrcado === 0 && rowObj.valRealizado === 0) barFillWidth = 0;

                    html += `<td class="cell-consumption">
                        <div class="consumption-wrapper">
                            <div class="bar-container"><div class="bar-fill ${barFillClass}" style="width: ${barFillWidth}%;"></div></div>
                            <div class="percent-value">${consumptionText}</div>
                        </div>
                    </td>`;

                    let statusText = "-"; let statusPillClass = "";
                    if (rowObj.valOrcado === 0 && rowObj.valRealizado > 0) { statusText = "Acima"; statusPillClass = "status-acima"; }
                    else if (rowObj.valOrcado > 0 || rowObj.valRealizado > 0) {
                        if (rowObj.percentConsumption < 90) { statusText = "Abaixo"; statusPillClass = "status-abaixo"; }
                        else if (rowObj.percentConsumption < 100) { statusText = "Atenção"; statusPillClass = "status-atencao"; }
                        else { statusText = "Acima"; statusPillClass = "status-acima"; }
                    }

                    let statusHtml = statusText !== "-" ? `<span class="status-pill ${statusPillClass}">${statusText}</span>` : "-";
                    html += `<td class="center cell-status">${statusHtml}</td></tr>`;
                    
                    return html;
                };

                tableData.forEach(ccRow => {
                    tableHtml += renderRowHtml(ccRow, false);
                    if (this._expandedRow === ccRow.name) {
                        ccRow.children.forEach(contaRow => {
                            tableHtml += renderRowHtml(contaRow, true);
                        });
                    }
                });

                tableHtml += `</tbody>`;

                const totalDesvio = totalRealizado - totalOrcado;
                const totalDesvioFormatted = formatNumber(Math.abs(totalDesvio), true, true, totalDesvio);
                let totalVarColorClass = totalDesvio > 0 ? "var-positive" : (totalDesvio < 0 ? "var-negative" : "");
                let totalPercentConsumption = totalOrcado > 0 ? (totalRealizado / totalOrcado) * 100 : (totalRealizado > 0 ? Infinity : 0);
                
                let totalBarFillWidth = totalPercentConsumption === Infinity ? 100 : Math.min(100, totalPercentConsumption || 0);
                let totalBarFillClass = totalPercentConsumption === Infinity || totalPercentConsumption >= 100 ? "fill-red" : (totalPercentConsumption < 90 ? "fill-green" : "fill-yellow");
                let totalConsumptionText = totalPercentConsumption === Infinity ? "∞" : (totalPercentConsumption === 0 ? "-" : formatPercentage(totalPercentConsumption));
                if(totalOrcado === 0 && totalRealizado === 0) totalBarFillWidth = 0;

                let totalStatusText = "-"; let totalStatusPillClass = "";
                if (totalOrcado === 0 && totalRealizado > 0) { totalStatusText = "Acima"; totalStatusPillClass = "status-acima"; }
                else if (totalOrcado > 0 || totalRealizado > 0) {
                    if (totalPercentConsumption < 90) { totalStatusText = "Abaixo"; totalStatusPillClass = "status-abaixo"; }
                    else if (totalPercentConsumption < 100) { totalStatusText = "Atenção"; totalStatusPillClass = "status-atencao"; }
                    else { totalStatusText = "Acima"; totalStatusPillClass = "status-acima"; }
                }

                tableHtml += `<tfoot><tr><td>TOTAL GERAL</td>`;
                uniqueCols.forEach(col => {
                    if (col.toUpperCase().includes("ORÇADO") || col.toUpperCase().includes("ORCADO")) tableHtml += `<td class="numeric">${formatNumber(totalOrcado)}</td>`;
                    else if (col.toUpperCase().includes("REALIZADO")) tableHtml += `<td class="numeric">${formatNumber(totalRealizado)}</td>`;
                    else tableHtml += `<td class="numeric">-</td>`;
                });
                tableHtml += `<td class="numeric cell-variance ${totalVarColorClass}">${totalDesvio !== 0 ? totalDesvioFormatted : "-"}</td>`;
                tableHtml += `<td class="cell-consumption"><div class="consumption-wrapper"><div class="bar-container"><div class="bar-fill ${totalBarFillClass}" style="width: ${totalBarFillWidth}%;"></div></div><div class="percent-value">${totalConsumptionText}</div></div></td>`;
                tableHtml += `<td class="center cell-status">${totalStatusText !== "-" ? `<span class="status-pill ${totalStatusPillClass}">${totalStatusText}</span>` : "-"}</td></tr></tfoot></table>`;
                
                container.innerHTML = tableHtml;

                container.querySelectorAll('th.sortable').forEach(th => {
                    th.addEventListener('click', () => {
                        const col = th.getAttribute('data-sort');
                        if (this._sortState.col === col) {
                            this._sortState.dir = this._sortState.dir === 'asc' ? 'desc' : 'asc';
                        } else {
                            this._sortState.col = col;
                            this._sortState.dir = 'asc';
                        }
                        this.renderTable(); 
                    });
                });

                container.querySelectorAll('tr.row-cc').forEach(tr => {
                    tr.addEventListener('click', (e) => {
                        const ccName = e.currentTarget.getAttribute('data-cc');
                        this._expandedRow = this._expandedRow === ccName ? null : ccName;
                        this.renderTable(); 
                    });
                });

            } catch (error) {
                container.innerHTML = `<div style='padding:10px; color:red;'>Erro ao renderizar: ${error.message}</div>`;
                console.error("Erro no Widget:", error);
            }
        }
    }

    if (!customElements.get("evo-ga-table-drilldown")) {
        customElements.define("evo-ga-table-drilldown", EvoGATable);
    }
})();
