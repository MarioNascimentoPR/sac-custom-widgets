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
                border-collapse: separate; /* Alterado de collapse para separate para melhor suporte a sticky borders */
                border-spacing: 0;
                font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
                table-layout: auto;
            }
            th { 
                /* Configuração do Congelamento (Sticky) */
                position: sticky;
                top: 0;
                background-color: #ffffff; /* Fundo opaco obrigatório */
                z-index: 10;
                
                /* Estilização anterior */
                color: #A0A0A0; 
                font-size: 11px; 
                font-weight: 700; 
                text-transform: uppercase; 
                letter-spacing: 0.5px; 
                padding: 16px 12px; 
                box-shadow: 0 2px 0 0 #F2F2F2; /* Usar box-shadow no lugar de border-bottom para headers sticky */
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
                    container.innerHTML = "<div style='padding:10px;'>Adicione pelo menos 2 dimensões e 1 conta/medida no pain
