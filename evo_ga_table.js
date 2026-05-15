(function () {
    let template = document.createElement("template");
    template.innerHTML = `
        <style>
            :host { display: block; width: 100%; height: 100%; overflow: auto; background: white; }
            table { width: 100%; border-collapse: collapse; font-family: Arial, sans-serif; font-size: 13px; }
            th, td { border: 1px solid #d3d3d3; padding: 8px; text-align: left; }
            th { background-color: #f4f4f4; font-weight: bold; text-align: center; color: #333; }
            .numeric { text-align: right; }
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

                const rowDimName = getName(dimensions[rowDimKey]);
                const measureName = getName(measures[measureKey]);

                const uniqueCols = [...new Set(financialData.data.map(row => getName(row[colDimKey])))];
                const uniqueRows = [...new Set(financialData.data.map(row => getName(row[rowDimKey])))];

                const dataMap = {};
                financialData.data.forEach(row => {
                    const rKey = getName(row[rowDimKey]);
                    const cKey = getName(row[colDimKey]);
                    
                    let value = "-";
                    
                    // 1. Tenta acessar via chave primária mapeada
                    if (row[measureKey] && (row[measureKey].formattedValue !== undefined || row[measureKey].raw !== undefined)) {
                        value = row[measureKey].formattedValue || row[measureKey].raw;
                    } else {
                        // 2. Fallback: Varre a linha para localizar o objeto de valor. 
                        // Necessário para modelos novos do SAC onde Medidas e Contas cruzam chaves.
                        for (const key in row) {
                            const cell = row[key];
                            if (cell && typeof cell === "object" && ("formattedValue" in cell || "raw" in cell)) {
                                value = cell.formattedValue || cell.raw;
                                break;
                            }
                        }
                    }

                    if (!dataMap[rKey]) dataMap[rKey] = {};
                    dataMap[rKey][cKey] = value;
                });

                let tableHtml = `<table>`;
                
                tableHtml += `<tr><th rowspan="2">${rowDimName}</th>`;
                uniqueCols.forEach(col => {
                    tableHtml += `<th>${col}</th>`;
                });
                tableHtml += `</tr>`;

                tableHtml += `<tr>`;
                uniqueCols.forEach(() => {
                    tableHtml += `<th>${measureName}</th>`;
                });
                tableHtml += `</tr>`;

                uniqueRows.forEach(row => {
                    tableHtml += `<tr><td>${row}</td>`;
                    uniqueCols.forEach(col => {
                        const cellValue = (dataMap[row] && dataMap[row][col]) ? dataMap[row][col] : "-";
                        tableHtml += `<td class="numeric">${cellValue}</td>`;
                    });
                    tableHtml += `</tr>`;
                });

                tableHtml += `</table>`;
                container.innerHTML = tableHtml;

            } catch (error) {
                container.innerHTML = `<div style='padding:10px; color:red;'>Erro ao renderizar: ${error.message}</div>`;
                console.error("Erro no Widget:", error);
            }
        }
    }

    customElements.define("evo-ga-table-only", EvoGATable);
})();
