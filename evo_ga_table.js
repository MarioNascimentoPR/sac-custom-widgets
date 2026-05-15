(function () {
    let template = document.createElement("template");
    template.innerHTML = `
        <style>
            :host { display: block; width: 100%; height: 100%; overflow: auto; }
            table { width: 100%; border-collapse: collapse; font-family: Arial, sans-serif; font-size: 13px; }
            th, td { border: 1px solid #d3d3d3; padding: 8px; text-align: left; }
            th { background-color: #f4f4f4; font-weight: bold; text-align: center; }
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

            if (!financialData.data || financialData.data.length === 0) {
                container.innerHTML = "<div>Aguardando dados no Builder...</div>";
                return;
            }

            const dimensions = financialData.metadata.dimensions;
            const measures = financialData.metadata.mainStructureMembers;

            const dimKeys = Object.keys(dimensions);
            const measureKeys = Object.keys(measures);

            if (dimKeys.length < 2 || measureKeys.length < 1) {
                container.innerHTML = "<div>Adicione pelo menos 2 dimensões e 1 medida no painel.</div>";
                return;
            }

            // Mapeia os IDs baseados na ordem do Builder
            const rowDimKey = dimKeys[0];    // 1ª dimensão arrastada vira linha
            const colDimKey = dimKeys[1];    // 2ª dimensão arrastada vira coluna
            const measureKey = measureKeys[0]; // 1ª medida arrastada

            const rowDimName = dimensions[rowDimKey].description;
            const measureName = measures[measureKey].description;

            // Extrai valores únicos para montar os eixos do pivô
            const uniqueCols = [...new Set(financialData.data.map(row => row[colDimKey].description))];
            const uniqueRows = [...new Set(financialData.data.map(row => row[rowDimKey].description))];

            // Cria mapa de dados indexado
            const dataMap = {};
            financialData.data.forEach(row => {
                const rKey = row[rowDimKey].description;
                const cKey = row[colDimKey].description;
                const value = row[measureKey].formattedValue || row[measureKey].value;

                if (!dataMap[rKey]) dataMap[rKey] = {};
                dataMap[rKey][cKey] = value;
            });

            // Geração da estrutura HTML da tabela cruzada
            let tableHtml = `<table>`;
            
            // Header 1: Nome da dimensão de linha + Itens da dimensão de coluna
            tableHtml += `<tr><th rowspan="2">${rowDimName}</th>`;
            uniqueCols.forEach(col => {
                tableHtml += `<th>${col}</th>`;
            });
            tableHtml += `</tr>`;

            // Header 2: Nome da Medida replicada abaixo de cada coluna
            tableHtml += `<tr>`;
            uniqueCols.forEach(() => {
                tableHtml += `<th>${measureName}</th>`;
            });
            tableHtml += `</tr>`;

            // Linhas de dados
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
        }
    }

    customElements.define("evo-ga-table-only", EvoGATable);
})();
