(function () {
    const ENABLE_TELEMETRY = true;

    class EvoGATableProfiler {
        constructor() {
            this.metrics = {
                totalCycle: 0,
                jsTime: 0,
                domTime: 0,
                fps: 60,
                steps: { parsing: 0, aggregation: 0, domCreation: 0 },
                memory: 0,
                redundantRenders: 0,
                dataVolume: 0,
                filteredRows: 0
            };
            this._lastDataSignature = "";
            this._fpsFrameCount = 0;
            this._fpsLastTime = this._now();
        }

        _now() {
            return (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
        }

        _buildDataSignature(cubeData) {
            const rows = cubeData && Array.isArray(cubeData.data) ? cubeData.data : [];
            if (!rows.length) return "";
            let hash = 2166136261;
            const mix = (value) => {
                const text = String(value == null ? "" : value);
                for (let i = 0; i < text.length; i++) {
                    hash ^= text.charCodeAt(i);
                    hash = Math.imul(hash, 16777619);
                }
            };
            const metadata = cubeData.metadata || {};
            const dimensions = metadata.dimensions || {};
            const measures = metadata.mainStructureMembers || {};
            Object.keys(dimensions).forEach(key => {
                const dim = dimensions[key] || {};
                mix(key); mix(dim.id); mix(dim.description); mix(dim.label);
            });
            Object.keys(measures).forEach(key => {
                const measure = measures[key] || {};
                mix(key); mix(measure.id); mix(measure.description); mix(measure.label);
            });
            mix(rows.length);
            rows.forEach(row => {
                Object.keys(row || {}).forEach(key => {
                    const cell = row[key];
                    mix(key);
                    if (cell && typeof cell === "object") {
                        mix(cell.id);
                        mix(cell.label || cell.description);
                        mix(cell.formattedValue !== undefined ? cell.formattedValue : cell.raw);
                    } else {
                        mix(cell);
                    }
                });
            });
            return `${rows.length}:${hash >>> 0}`;
        }

        verifyRedundancy(cubeData) {
            if (!ENABLE_TELEMETRY || !cubeData) return false;
            try {
                const signature = this._buildDataSignature(cubeData);
                if (!signature) return false;
                if (this._lastDataSignature === signature) {
                    this.metrics.redundantRenders++;
                    return true;
                }
                this._lastDataSignature = signature;
            } catch (e) { return false; }
            return false;
        }

        startFPSMonitor() {
            if (!ENABLE_TELEMETRY || typeof requestAnimationFrame === "undefined") return;
            this._fpsFrameCount = 0;
            this._fpsLastTime = this._now();
            const run = () => {
                this._fpsFrameCount++;
                const now = this._now();
                if (now - this._fpsLastTime >= 500) {
                    this.metrics.fps = Math.round((this._fpsFrameCount * 1000) / (now - this._fpsLastTime));
                    this._fpsFrameCount = 0;
                    this._fpsLastTime = now;
                } else if (this._fpsFrameCount < 60) {
                    requestAnimationFrame(run);
                }
            };
            requestAnimationFrame(run);
        }

        collectMemory() {
            if (!ENABLE_TELEMETRY) return;
            if (typeof performance !== "undefined" && performance.memory) {
                this.metrics.memory = performance.memory.usedJSHeapSize;
            }
        }

        runStressProjection(baseRows, sampleJSTime) {
            if (!baseRows || baseRows === 0) return { k10: 0, k25: 0, k50: 0, k100: 0 };
            const baseValue = sampleJSTime / baseRows;
            return {
                k10: baseValue * 10000 * 1.02,
                k25: baseValue * 25000 * 1.05,
                k50: baseValue * 50000 * 1.08,
                k100: baseValue * 100000 * 1.12
            };
        }
    }

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
            #widget-wrapper {
                display: flex;
                flex-direction: column;
                width: 100%;
                height: 100%;
            }
            #header-container {
                padding: 4px 16px 12px 10px; /* Ajuste: 10px na esquerda para alinhar com a tabela */
                flex-shrink: 0;
            }
            #table-container {
                width: 100%;
                flex-grow: 1;
                overflow: auto;
            }
            .table-title {
                font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                font-size: 16px;
                font-weight: 700;
                color: #222222;
                margin: 0 0 8px 0;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .header-top {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                margin-bottom: 8px;
            }
            .header-top .table-title { margin: 0; }
            .header-actions {
                display: flex;
                align-items: center;
                gap: 8px;
                position: relative;
                flex-shrink: 0;
            }
            .month-filter {
                min-width: 132px;
                height: 28px;
                border: 1px solid #CBD5E0;
                border-radius: 4px;
                background: #FFFFFF;
                color: #334155;
                font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                font-size: 11.5px;
                font-weight: 600;
                padding: 0 8px;
                cursor: pointer;
            }
            .month-filter:disabled {
                color: #94A3B8;
                background: #F8FAFC;
                cursor: not-allowed;
            }
            .telemetry-btn {
                height: 28px;
                border: 1px solid #CBD5E0;
                border-radius: 4px;
                background: #F1F5F9;
                color: #475569;
                font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                font-size: 11.5px;
                font-weight: 700;
                padding: 0 10px;
                cursor: pointer;
            }
            .telemetry-btn:hover { background: #E2E8F0; color: #1E293B; }
            .telemetry-modal {
                display: none;
                position: absolute;
                top: 40px;
                right: 16px;
                width: 330px;
                max-width: calc(100% - 32px);
                background: #FFFFFF;
                border: 1px solid #E2E8F0;
                border-radius: 8px;
                box-shadow: 0 12px 30px rgba(15, 23, 42, 0.14);
                z-index: 1000;
                padding: 14px;
                font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                font-size: 11px;
                color: #334155;
            }
            .telemetry-modal.show { display: block; }
            .telemetry-title {
                font-size: 11.5px;
                font-weight: 700;
                color: #1E293B;
                margin-bottom: 10px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 2px solid #EDF2F7;
                padding-bottom: 6px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .telemetry-close {
                background: none;
                border: none;
                font-size: 16px;
                cursor: pointer;
                color: #94A3B8;
                font-weight: 700;
                line-height: 1;
            }
            .telemetry-close:hover { color: #64748B; }
            .telemetry-section-title {
                font-size: 10px;
                font-weight: 700;
                color: #475569;
                text-transform: uppercase;
                margin: 10px 0 4px 0;
                background: #F1F5F9;
                padding: 2px 6px;
                border-radius: 3px;
            }
            .telemetry-row {
                display: flex;
                justify-content: space-between;
                gap: 12px;
                padding: 5px 0;
                border-bottom: 1px dashed #F1F5F9;
                align-items: center;
            }
            .telemetry-label { font-weight: 600; color: #64748B; }
            .telemetry-val {
                font-weight: 700;
                color: #0F172A;
                font-variant-numeric: tabular-nums;
                background: #F8FAFC;
                padding: 1px 6px;
                border-radius: 4px;
                border: 1px solid #E2E8F0;
                white-space: nowrap;
            }
            .stress-table { width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 10.5px; }
            .stress-table th { text-align: left; background: #E2E8F0; color: #334155; padding: 3px 6px; font-weight: 700; }
            .stress-table td { padding: 4px 6px; border-bottom: 1px solid #EDF2F7; font-weight: 600; }
            .table-summary {
                font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                font-size: 11.5px; 
                color: #444444;
                line-height: 1.5;
                margin: 0;
                background-color: #F8F9FA;
                padding: 8px 12px;
                border-radius: 4px;
                border-left: 4px solid #CCCCCC;
            }
            .table-summary.summary-saving { border-left-color: #2E7D32; }
            .table-summary.summary-desvio { border-left-color: #D32F2F; }

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
                border-bottom: 1px solid #F0F0F0; 
                font-size: 13px; 
                color: #444444; 
                vertical-align: middle;
            }
            td:first-child { text-align: left; }
            
            tr.row-cc { cursor: pointer; transition: background-color 0.15s; }
            tr.row-cc:hover { background-color: #F8F9FA; }
            tr.row-cc td:first-child { font-weight: 600; color: #222222; }
            tr.row-cc-nivel-1 td { background-color: #FCFCFC; }
            tr.row-cc-nivel-1 td:first-child {
                padding-left: 26px;
                color: #333333;
            }
            tr.row-cc-nivel-2 td { background-color: #FAFAFA; }
            tr.row-cc-nivel-2 td:first-child {
                padding-left: 42px;
                color: #444444;
            }
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

            .ofensor-flag {
                color: #EF6C00; /* Laranja para alertar ofensor (mais harmonioso que vermelho puro) */
                margin-left: 6px;
                font-size: 12px;
                vertical-align: middle;
                cursor: help;
            }

            tr.row-conta td { 
                background-color: #FAFAFA; 
                border-bottom: none;
                padding-top: 3px;
                padding-bottom: 3px; 
                font-size: 12px;
            }
            
            tr.row-conta:last-child td {
                border-bottom: 1px solid #F0F0F0;
            }

            tr.row-conta td:first-child { 
                padding-left: 70px;
                font-weight: 400; 
                color: #555555; 
                position: relative;
            }
            
            tr.row-conta td:first-child::before { 
                content: '↳'; 
                position: absolute; 
                left: 52px; 
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
            
            .bar-container { position: relative; flex-grow: 1; min-width: 60px; height: 8px; background-color: #EAEAEA; border-radius: 4px; }
            .bar-container::after { content: ''; position: absolute; right: 0; top: -2px; height: 12px; width: 2px; background-color: #222222; z-index: 2; border-radius: 1px; }
            
            .bar-fill { position: absolute; top: 0; left: 0; height: 100%; width: 0%; border-radius: 4px; transition: width 0.3s ease; z-index: 1; }
            .fill-green { background-color: #2E7D32; }
            .fill-yellow { background-color: #EF6C00; }
            .fill-red { background-color: #D32F2F; }
            .percent-value { font-size: 12px; font-weight: 500; color: #444444; width: 45px; text-align: right; font-variant-numeric: tabular-nums; }

            .cell-status { text-align: center !important; width: 90px; }
            
            .status-pill { 
                display: inline-flex; 
                align-items: center; 
                justify-content: center; 
                padding: 4px 0; 
                width: 65px; 
                box-sizing: border-box; 
                border-radius: 4px; 
                font-size: 11px; 
                font-weight: 700; 
                text-transform: uppercase; 
                letter-spacing: 0.5px; 
            }
            .status-abaixo { background-color: #E8F5E9; color: #1B5E20; border: 1px solid #C8E6C9; } 
            .status-atencao { background-color: #FFF3E0; color: #E65100; border: 1px solid #FFE0B2; } 
            .status-acima { background-color: #FFEBEE; color: #B71C1C; border: 1px solid #FFCDD2; } 
        </style>
        <div id="widget-wrapper">
            <div id="header-container"></div>
            <div id="table-container"></div>
            <div class="telemetry-modal" id="telemetryModal">
                <div class="telemetry-title">
                    <span>Métricas de Performance</span>
                    <button class="telemetry-close" id="closeTelemetry" type="button">×</button>
                </div>

                <div class="telemetry-section-title">Ciclo de Vida Total</div>
                <div class="telemetry-row"><span class="telemetry-label">Tempo Total Ciclo:</span><span class="telemetry-val" id="tmTotal">0.00 ms</span></div>
                <div class="telemetry-row"><span class="telemetry-label">Engine JS Puro:</span><span class="telemetry-val" id="tmJS">0.00 ms</span></div>
                <div class="telemetry-row"><span class="telemetry-label">Pintura e Layout:</span><span class="telemetry-val" id="tmDOM">0.00 ms</span></div>
                <div class="telemetry-row"><span class="telemetry-label">Estabilidade (FPS):</span><span class="telemetry-val" id="tmFPS">60 FPS</span></div>

                <div class="telemetry-section-title">Amostragem por Etapa</div>
                <div class="telemetry-row"><span class="telemetry-label">1. Ingestão e Filtro:</span><span class="telemetry-val" id="stParsing">0.00 ms</span></div>
                <div class="telemetry-row"><span class="telemetry-label">2. Agregação Hierárquica:</span><span class="telemetry-val" id="stAggr">0.00 ms</span></div>
                <div class="telemetry-row"><span class="telemetry-label">3. Construção DOM:</span><span class="telemetry-val" id="stDOM">0.00 ms</span></div>

                <div class="telemetry-section-title">Diagnóstico de Saúde</div>
                <div class="telemetry-row"><span class="telemetry-label">Memória Heap V8:</span><span class="telemetry-val" id="tmMem">0.00 MB</span></div>
                <div class="telemetry-row"><span class="telemetry-label">Re-renders Redundantes:</span><span class="telemetry-val" id="tmRedund">0</span></div>
                <div class="telemetry-row"><span class="telemetry-label">Volume SAC:</span><span class="telemetry-val" id="tmVol">0 rows</span></div>
                <div class="telemetry-row"><span class="telemetry-label">Linhas Filtradas:</span><span class="telemetry-val" id="tmFiltered">0 rows</span></div>

                <div class="telemetry-section-title">Simulação de Estresse Operacional</div>
                <table class="stress-table">
                    <thead><tr><th>Carga</th><th>Cenário Preditivo (JS)</th></tr></thead>
                    <tbody>
                        <tr><td>10k linhas</td><td id="st10k">-</td></tr>
                        <tr><td>25k linhas</td><td id="st25k">-</td></tr>
                        <tr><td>50k linhas</td><td id="st50k">-</td></tr>
                        <tr><td>100k linhas</td><td id="st100k">-</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    class EvoGATable extends HTMLElement {
        constructor() {
            super();
            this._shadowRoot = this.attachShadow({ mode: "open" });
            this._shadowRoot.appendChild(template.content.cloneNode(true));
            this._props = {};
            this._sortState = { col: null, dir: 'asc' };
            this._expandedRows = new Set();
            this._currentData = null;
            this._selectedMonth = "__all__";
            this._profiler = new EvoGATableProfiler();
            this._telemetryModal = this._shadowRoot.getElementById("telemetryModal");
            this._closeTelemetry = this._shadowRoot.getElementById("closeTelemetry");
            this._telemetryLabels = {
                total: this._shadowRoot.getElementById("tmTotal"),
                js: this._shadowRoot.getElementById("tmJS"),
                dom: this._shadowRoot.getElementById("tmDOM"),
                fps: this._shadowRoot.getElementById("tmFPS"),
                parsing: this._shadowRoot.getElementById("stParsing"),
                aggregation: this._shadowRoot.getElementById("stAggr"),
                domCreation: this._shadowRoot.getElementById("stDOM"),
                memory: this._shadowRoot.getElementById("tmMem"),
                redundant: this._shadowRoot.getElementById("tmRedund"),
                volume: this._shadowRoot.getElementById("tmVol"),
                filtered: this._shadowRoot.getElementById("tmFiltered"),
                k10: this._shadowRoot.getElementById("st10k"),
                k25: this._shadowRoot.getElementById("st25k"),
                k50: this._shadowRoot.getElementById("st50k"),
                k100: this._shadowRoot.getElementById("st100k")
            };
            if (this._closeTelemetry) {
                this._closeTelemetry.addEventListener("click", () => this._telemetryModal.classList.remove("show"));
            }
            this._profiler.startFPSMonitor();
        }

        onCustomWidgetBeforeUpdate(changedProperties) {
            this._props = { ...this._props, ...changedProperties };
        }

        onCustomWidgetAfterUpdate(changedProperties) {
            if ("financialData" in changedProperties && this.financialData) {
                this._profiler.verifyRedundancy(this.financialData);
                this._currentData = this.financialData;
                this.renderTable();
            }
        }

        _setText(element, value) {
            if (element) element.textContent = String(value);
        }

        _sortMonthOptions(options) {
            const monthOrder = {
                "JAN": 1, "JANEIRO": 1, "01": 1, "1": 1,
                "FEV": 2, "FEVEREIRO": 2, "FEB": 2, "02": 2, "2": 2,
                "MAR": 3, "MARCO": 3, "MARÇO": 3, "03": 3, "3": 3,
                "ABR": 4, "ABRIL": 4, "APR": 4, "04": 4, "4": 4,
                "MAI": 5, "MAIO": 5, "MAY": 5, "05": 5, "5": 5,
                "JUN": 6, "JUNHO": 6, "06": 6, "6": 6,
                "JUL": 7, "JULHO": 7, "07": 7, "7": 7,
                "AGO": 8, "AGOSTO": 8, "AUG": 8, "08": 8, "8": 8,
                "SET": 9, "SETEMBRO": 9, "SEP": 9, "09": 9, "9": 9,
                "OUT": 10, "OUTUBRO": 10, "OCT": 10, "10": 10,
                "NOV": 11, "NOVEMBRO": 11, "11": 11,
                "DEZ": 12, "DEZEMBRO": 12, "DEC": 12, "12": 12
            };
            const normalize = (value) => String(value || "")
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toUpperCase()
                .trim();
            const getOrder = (value) => {
                const normalized = normalize(value);
                const direct = monthOrder[normalized];
                if (direct) return direct;
                const firstToken = normalized.split(/[\s/.-]+/)[0];
                return monthOrder[firstToken] || 999;
            };
            return [...options].sort((a, b) => {
                const orderA = getOrder(a);
                const orderB = getOrder(b);
                if (orderA !== orderB) return orderA - orderB;
                return String(a).localeCompare(String(b), "pt-BR");
            });
        }

        _bindHeaderControls(monthOptions, hasMonthFilter) {
            const monthSelect = this._shadowRoot.getElementById("monthFilter");
            const telemetryBtn = this._shadowRoot.getElementById("telemetryBtn");
            if (monthSelect) {
                monthSelect.addEventListener("change", (event) => {
                    this._selectedMonth = event.target.value || "__all__";
                    this.renderTable();
                });
            }
            if (telemetryBtn && ENABLE_TELEMETRY) {
                telemetryBtn.addEventListener("click", (event) => {
                    event.stopPropagation();
                    this._telemetryModal.classList.toggle("show");
                });
            }
            if (!hasMonthFilter && monthSelect) monthSelect.disabled = true;
        }

        _updateTelemetry(tStart, tDOMStart, tEndJS, sourceRows, filteredRows) {
            if (!ENABLE_TELEMETRY) return;
            const paint = () => {
                const tFinalPaint = this._profiler._now();
                const jsTotalTime = tEndJS - tStart;
                const domTotalTime = tFinalPaint - tDOMStart;
                this._profiler.metrics.totalCycle = tFinalPaint - tStart;
                this._profiler.metrics.jsTime = jsTotalTime;
                this._profiler.metrics.domTime = domTotalTime;
                this._profiler.metrics.dataVolume = sourceRows;
                this._profiler.metrics.filteredRows = filteredRows;
                this._profiler.collectMemory();

                this._setText(this._telemetryLabels.total, `${this._profiler.metrics.totalCycle.toFixed(2)} ms`);
                this._setText(this._telemetryLabels.js, `${jsTotalTime.toFixed(2)} ms`);
                this._setText(this._telemetryLabels.dom, `${domTotalTime.toFixed(2)} ms`);
                this._setText(this._telemetryLabels.fps, `${this._profiler.metrics.fps} FPS`);
                this._setText(this._telemetryLabels.parsing, `${this._profiler.metrics.steps.parsing.toFixed(2)} ms`);
                this._setText(this._telemetryLabels.aggregation, `${this._profiler.metrics.steps.aggregation.toFixed(2)} ms`);
                this._setText(this._telemetryLabels.domCreation, `${this._profiler.metrics.steps.domCreation.toFixed(2)} ms`);
                this._setText(this._telemetryLabels.memory, `${(this._profiler.metrics.memory / 1024 / 1024).toFixed(2)} MB`);
                this._setText(this._telemetryLabels.redundant, this._profiler.metrics.redundantRenders);
                this._setText(this._telemetryLabels.volume, `${sourceRows} rows`);
                this._setText(this._telemetryLabels.filtered, `${filteredRows} rows`);

                const stress = this._profiler.runStressProjection(Math.max(filteredRows, 1), jsTotalTime);
                this._setText(this._telemetryLabels.k10, `${stress.k10.toFixed(2)} ms`);
                this._setText(this._telemetryLabels.k25, `${stress.k25.toFixed(2)} ms`);
                this._setText(this._telemetryLabels.k50, `${stress.k50.toFixed(2)} ms`);
                this._setText(this._telemetryLabels.k100, `${stress.k100.toFixed(2)} ms`);
            };
            if (typeof requestAnimationFrame !== "undefined") requestAnimationFrame(paint);
            else paint();
        }

        renderTable() {
            const tArrivalData = this._profiler._now();
            const financialData = this._currentData;
            const headerContainer = this._shadowRoot.getElementById("header-container");
            const container = this._shadowRoot.getElementById("table-container");
            
            headerContainer.innerHTML = "";
            container.innerHTML = ""; 

            if (!financialData || !financialData.data || financialData.data.length === 0) {
                container.innerHTML = "<div style='padding:10px;'>Aguardando dados no Builder...</div>";
                return;
            }

            try {
                const tParsingStart = this._profiler._now();
                const dimensions = financialData.metadata.dimensions || {};
                const measures = financialData.metadata.mainStructureMembers || {};

                const dimKeys = Object.keys(dimensions);
                const measureKeys = Object.keys(measures);

                if (dimKeys.length < 5 || measureKeys.length < 1) {
                    container.innerHTML = "<div style='padding:10px; color:#D32F2F;'>Adicione 5 dimensões (1. Dimensão Calculada, 2. Centro de Custo Nível 1, 3. Centro de Custo Nível 2, 4. Conta Contábil, 5. Orçado/Realizado) e 1 medida.</div>";
                    return;
                }

                const getName = (obj) => obj ? (obj.label || obj.description || obj.id || "N/D") : "N/D";
                const normalizeText = (value) => String(value || "")
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .toUpperCase();
                const isVersionMember = (value) => {
                    const normalized = normalizeText(value);
                    return normalized.includes("ORCADO") || normalized.includes("REALIZADO");
                };
                const isMonthDimension = (dimKey) => {
                    const dimName = normalizeText(getName(dimensions[dimKey]));
                    return dimName.includes("MES") || dimName.includes("MONTH") || dimName.includes("COMPETENCIA") || dimName.includes("PERIODO") || dimName.includes("DATA");
                };

                let colDimKey = dimKeys.find(dimKey =>
                    financialData.data.some(row => isVersionMember(getName(row[dimKey])))
                ) || dimKeys[dimKeys.length - 1];

                const monthDimKey = dimKeys.find(dimKey => dimKey !== colDimKey && isMonthDimension(dimKey));
                const monthOptions = monthDimKey
                    ? this._sortMonthOptions(Array.from(new Set(financialData.data.map(row => getName(row[monthDimKey])).filter(Boolean))))
                    : [];
                if (this._selectedMonth !== "__all__" && !monthOptions.includes(this._selectedMonth)) {
                    this._selectedMonth = "__all__";
                }

                const rowsForRender = monthDimKey && this._selectedMonth !== "__all__"
                    ? financialData.data.filter(row => getName(row[monthDimKey]) === this._selectedMonth)
                    : financialData.data;

                const hierarchyDimKeys = dimKeys.filter(dimKey => dimKey !== colDimKey && dimKey !== monthDimKey);
                if (hierarchyDimKeys.length < 4) {
                    container.innerHTML = "<div style='padding:10px; color:#D32F2F;'>Não foi possível identificar a dimensão de versão (Orçado/Realizado). Verifique se uma dimensão contém os membros Orçado e Realizado.</div>";
                    return;
                }

                const getDimensionMetadataName = (dimKey) => normalizeText(getName(dimensions[dimKey]));
                const ccDimKeys = hierarchyDimKeys.filter(dimKey => {
                    const dimName = getDimensionMetadataName(dimKey);
                    return dimName.includes("CENTRO") || /\bCC\b/.test(dimName);
                });
                const detectedContaDimKey = hierarchyDimKeys.find(dimKey => {
                    const dimName = getDimensionMetadataName(dimKey);
                    return dimName.includes("CONTA");
                });
                const detectedCalcDimKey = hierarchyDimKeys.find(dimKey =>
                    !ccDimKeys.includes(dimKey) && dimKey !== detectedContaDimKey
                );

                const calcDimKey = detectedCalcDimKey || hierarchyDimKeys[0];
                const ccNivel1DimKey = ccDimKeys[0] || hierarchyDimKeys[1];
                const ccNivel2DimKey = ccDimKeys[1] || hierarchyDimKeys[2];
                const contaDimKey = detectedContaDimKey || hierarchyDimKeys[3];
                const measureKey = measureKeys[0];

                const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
                    '&': '&amp;',
                    '<': '&lt;',
                    '>': '&gt;',
                    '"': '&quot;',
                    "'": '&#39;'
                }[char]));
                const parseNumber = (val) => {
                    if (typeof val === 'number') return val;
                    if (!val || val === "-") return 0;
                    let cleanStr = String(val).replace(/[^0-9.,-]/g, '');
                    const lastComma = cleanStr.lastIndexOf(',');
                    const lastDot = cleanStr.lastIndexOf('.');
                    if (lastComma > lastDot) {
                        cleanStr = cleanStr.replace(/\./g, '').replace(',', '.');
                    } else {
                        cleanStr = cleanStr.replace(/,/g, '');
                    }
                    return parseFloat(cleanStr) || 0;
                };

                const formatNumber = (num, withCurrency = true, isVariance = false, rawValue = 0) => {
                    if (num === 0 && !isVariance) return "-";
                    let options = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
                    if (withCurrency) { options.style = 'currency'; options.currency = 'BRL'; }
                    let formatted = num.toLocaleString('pt-BR', options);
                    if (isVariance && rawValue < 0) formatted = "-" + formatted;
                    return formatted;
                };

                const formatSummaryNumber = (num) => {
                    const absNum = Math.abs(num); // Garante que o sinal não vá para o texto resumo
                    if (absNum >= 1000000) return (absNum / 1000000).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + "Mi";
                    if (absNum >= 1000) return (absNum / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + "K";
                    return absNum.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
                };
                
                const formatPercentage = (val) => val === 0 ? "-" : (val === Infinity ? "∞" : val.toFixed(1) + "%");

                const headerName = getName(dimensions[calcDimKey]);

                const dataMap = {};
                const uniqueColsSet = new Set();
                this._profiler.metrics.steps.parsing = this._profiler._now() - tParsingStart;
                const tAggregationStart = this._profiler._now();

                rowsForRender.forEach(row => {
                    const calcNode = getName(row[calcDimKey]);
                    const ccNivel1 = getName(row[ccNivel1DimKey]);
                    const ccNivel2 = getName(row[ccNivel2DimKey]);
                    const conta = getName(row[contaDimKey]);
                    const col = getName(row[colDimKey]);
                    uniqueColsSet.add(col);
                    
                    let value = "-";
                    if (row[measureKey] && (row[measureKey].formattedValue !== undefined || row[measureKey].raw !== undefined)) {
                        value = row[measureKey].raw !== undefined ? row[measureKey].raw : row[measureKey].formattedValue;
                    } else {
                        for (const key in row) {
                            const cell = row[key];
                            if (cell && typeof cell === "object" && ("formattedValue" in cell || "raw" in cell)) {
                                value = cell.raw !== undefined ? cell.raw : cell.formattedValue;
                                break;
                            }
                        }
                    }

                    const numVal = parseNumber(value);

                    if (!dataMap[calcNode]) {
                        dataMap[calcNode] = { totals: {}, ccNivel1: {} };
                    }
                    if (!dataMap[calcNode].ccNivel1[ccNivel1]) {
                        dataMap[calcNode].ccNivel1[ccNivel1] = { totals: {}, ccNivel2: {} };
                    }
                    if (!dataMap[calcNode].ccNivel1[ccNivel1].ccNivel2[ccNivel2]) {
                        dataMap[calcNode].ccNivel1[ccNivel1].ccNivel2[ccNivel2] = { totals: {}, contas: {} };
                    }
                    if (!dataMap[calcNode].ccNivel1[ccNivel1].ccNivel2[ccNivel2].contas[conta]) {
                        dataMap[calcNode].ccNivel1[ccNivel1].ccNivel2[ccNivel2].contas[conta] = {};
                    }

                    dataMap[calcNode].ccNivel1[ccNivel1].ccNivel2[ccNivel2].contas[conta][col] = numVal;
                    dataMap[calcNode].ccNivel1[ccNivel1].ccNivel2[ccNivel2].totals[col] = (dataMap[calcNode].ccNivel1[ccNivel1].ccNivel2[ccNivel2].totals[col] || 0) + numVal;
                    dataMap[calcNode].ccNivel1[ccNivel1].totals[col] = (dataMap[calcNode].ccNivel1[ccNivel1].totals[col] || 0) + numVal;
                    dataMap[calcNode].totals[col] = (dataMap[calcNode].totals[col] || 0) + numVal;
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

                let tableData = Object.keys(dataMap).map(calcNodeName => {
                    let calcNode = buildRowMetrics(calcNodeName, dataMap[calcNodeName].totals);
                    calcNode.key = `calc:${calcNodeName}`;
                    calcNode.children = Object.keys(dataMap[calcNodeName].ccNivel1).map(ccNivel1 => {
                        let ccNivel1Node = buildRowMetrics(ccNivel1, dataMap[calcNodeName].ccNivel1[ccNivel1].totals);
                        ccNivel1Node.key = `calc:${calcNodeName}|cc1:${ccNivel1}`;
                        ccNivel1Node.children = Object.keys(dataMap[calcNodeName].ccNivel1[ccNivel1].ccNivel2).map(ccNivel2 => {
                            let ccNivel2Node = buildRowMetrics(ccNivel2, dataMap[calcNodeName].ccNivel1[ccNivel1].ccNivel2[ccNivel2].totals);
                            ccNivel2Node.key = `calc:${calcNodeName}|cc1:${ccNivel1}|cc2:${ccNivel2}`;
                            ccNivel2Node.children = Object.keys(dataMap[calcNodeName].ccNivel1[ccNivel1].ccNivel2[ccNivel2].contas).map(conta => {
                                let contaNode = buildRowMetrics(conta, dataMap[calcNodeName].ccNivel1[ccNivel1].ccNivel2[ccNivel2].contas[conta]);
                                contaNode.key = `calc:${calcNodeName}|cc1:${ccNivel1}|cc2:${ccNivel2}|conta:${conta}`;
                                return contaNode;
                            });
                            ccNivel2Node.children.sort((a, b) => b.valRealizado - a.valRealizado);
                            return ccNivel2Node;
                        });
                        ccNivel1Node.children.sort((a, b) => b.valRealizado - a.valRealizado);
                        return ccNivel1Node;
                    });
                    calcNode.children.sort((a, b) => b.valRealizado - a.valRealizado);
                    return calcNode;
                });

                let totalGlobalOrcado = 0;
                let totalGlobalRealizado = 0;
                tableData.forEach(row => {
                    totalGlobalOrcado += row.valOrcado;
                    totalGlobalRealizado += row.valRealizado;
                });
                
                const totalGlobalDesvio = totalGlobalRealizado - totalGlobalOrcado;
                const varianceType = totalGlobalDesvio > 0 ? "desvio" : "saving";
                const varianceClass = totalGlobalDesvio > 0 ? "summary-desvio" : "summary-saving";
                const formattedGlobalDesvio = formatSummaryNumber(totalGlobalDesvio);

                const centrosDeCusto = tableData.flatMap(item =>
                    item.children.flatMap(ccNivel1 => ccNivel1.children)
                );
                const ofensores = [...centrosDeCusto]
                    .filter(item => item.desvio > 0)
                    .sort((a, b) => b.desvio - a.desvio)
                    .slice(0, 3);

                ofensores.forEach(item => item.isOfensor = true);

                let ofensoresText = "";
                if (ofensores.length > 0) {
                    const names = ofensores.map(o => escapeHtml(o.name));
                    if (names.length === 1) ofensoresText = ` O principal ofensor que exige atenção é o centro de custo <strong>${names[0]}</strong>.`;
                    else if (names.length === 2) ofensoresText = ` Os principais ofensores que exigem atenção são <strong>${names[0]}</strong> e <strong>${names[1]}</strong>.`;
                    else ofensoresText = ` Os 3 principais ofensores que exigem atenção são <strong>${names[0]}</strong>, <strong>${names[1]}</strong> e <strong>${names[2]}</strong>.`;
                } else {
                    ofensoresText = " Não foram identificados centros de custo operando acima do orçamento.";
                }

                this._profiler.metrics.steps.aggregation = this._profiler._now() - tAggregationStart;
                const tDOMStart = this._profiler._now();
                const monthOptionsHtml = monthOptions.map(month =>
                    `<option value="${escapeHtml(month)}" ${this._selectedMonth === month ? "selected" : ""}>${escapeHtml(month)}</option>`
                ).join("");
                const selectedAll = this._selectedMonth === "__all__" ? "selected" : "";
                const monthDisabled = monthOptions.length ? "" : "disabled";

                headerContainer.innerHTML = `
                    <div class="header-top">
                        <h1 class="table-title">Overview - Acompanhamento Orçamentário</h1>
                        <div class="header-actions">
                            <select class="month-filter" id="monthFilter" ${monthDisabled} aria-label="Filtrar mês">
                                <option value="__all__" ${selectedAll}>Todos os meses</option>
                                ${monthOptionsHtml}
                            </select>
                            <button class="telemetry-btn" id="telemetryBtn" type="button">Telemetria</button>
                        </div>
                    </div>
                    <p class="table-summary ${varianceClass}">
                        No período analisado, observamos um <strong>${varianceType} de R$ ${formattedGlobalDesvio}</strong> em relação ao orçamento planejado.${ofensoresText}
                    </p>
                `;
                this._bindHeaderControls(monthOptions, Boolean(monthDimKey));

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
                tableHtml += `<thead><tr><th data-sort="name" class="sortable">${escapeHtml(headerName)}<span class="sort-icon">${sortIconRow}</span></th>`;
                
                uniqueCols.forEach(col => {
                    let sortKey = '';
                    if (col.toUpperCase().includes("ORÇADO") || col.toUpperCase().includes("ORCADO")) sortKey = 'valOrcado';
                    else if (col.toUpperCase().includes("REALIZADO")) sortKey = 'valRealizado';

                    let sortIcon = this._sortState.col === sortKey ? (this._sortState.dir === 'asc' ? ' ▲' : ' ▼') : '';
                    let sortAttr = sortKey ? `data-sort="${sortKey}" class="sortable"` : '';
                    tableHtml += `<th ${sortAttr}>${escapeHtml(col)}<span class="sort-icon">${sortIcon}</span></th>`;
                });

                let sortIconDesvio = this._sortState.col === 'desvio' ? (this._sortState.dir === 'asc' ? ' ▲' : ' ▼') : '';
                tableHtml += `<th data-sort="desvio" class="sortable">VARIAÇÃO R$<span class="sort-icon">${sortIconDesvio}</span></th>`;
                tableHtml += `<th class="numeric">CONSUMO</th><th class="center">STATUS</th></tr></thead><tbody>`;

                const renderRowHtml = (rowObj, level = 0) => {
                    const hasChildren = rowObj.children && rowObj.children.length > 0;
                    let rowClass = "row-conta";
                    if (level === 0) rowClass = "row-cc";
                    else if (level === 1) rowClass = "row-cc row-cc-nivel-1";
                    else if (level === 2) rowClass = "row-cc row-cc-nivel-2";
                    let expandClass = (hasChildren && this._expandedRows.has(rowObj.key)) ? "expanded" : "";
                    let dataAttr = hasChildren ? `data-node-key="${escapeHtml(rowObj.key)}"` : "";
                    
                    let html = `<tr class="${rowClass} ${expandClass}" ${dataAttr}>`;
                    
                    let flagHtml = (level === 2 && rowObj.isOfensor) ? `<span class="ofensor-flag" title="Entre os 3 maiores ofensores do período">⚠️</span>` : "";
                    let safeName = escapeHtml(rowObj.name);
                    let nameCell = level === 3 ? safeName : `<span class="expand-icon">▶</span>${safeName}${flagHtml}`;
                    
                    html += `<td>${nameCell}</td>`;
                    
                    uniqueCols.forEach(col => {
                        let numValue = rowObj.numValues[col];
                        html += `<td class="numeric">${formatNumber(numValue)}</td>`;
                    });

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

                tableData.forEach(calcRow => {
                    tableHtml += renderRowHtml(calcRow, 0);
                    if (this._expandedRows.has(calcRow.key)) {
                        calcRow.children.forEach(ccNivel1Row => {
                            tableHtml += renderRowHtml(ccNivel1Row, 1);
                            if (this._expandedRows.has(ccNivel1Row.key)) {
                                ccNivel1Row.children.forEach(ccNivel2Row => {
                                    tableHtml += renderRowHtml(ccNivel2Row, 2);
                                    if (this._expandedRows.has(ccNivel2Row.key)) {
                                        ccNivel2Row.children.forEach(contaRow => {
                                            tableHtml += renderRowHtml(contaRow, 3);
                                        });
                                    }
                                });
                            }
                        });
                    }
                });

                tableHtml += `</tbody>`;

                const totalDesvioFormatted = formatNumber(Math.abs(totalGlobalDesvio), true, true, totalGlobalDesvio);
                let totalVarColorClass = totalGlobalDesvio > 0 ? "var-positive" : (totalGlobalDesvio < 0 ? "var-negative" : "");
                let totalPercentConsumption = totalGlobalOrcado > 0 ? (totalGlobalRealizado / totalGlobalOrcado) * 100 : (totalGlobalRealizado > 0 ? Infinity : 0);
                
                let totalBarFillWidth = totalPercentConsumption === Infinity ? 100 : Math.min(100, totalPercentConsumption || 0);
                let totalBarFillClass = totalPercentConsumption === Infinity || totalPercentConsumption >= 100 ? "fill-red" : (totalPercentConsumption < 90 ? "fill-green" : "fill-yellow");
                let totalConsumptionText = totalPercentConsumption === Infinity ? "∞" : (totalPercentConsumption === 0 ? "-" : formatPercentage(totalPercentConsumption));
                if(totalGlobalOrcado === 0 && totalGlobalRealizado === 0) totalBarFillWidth = 0;

                let totalStatusText = "-"; let totalStatusPillClass = "";
                if (totalGlobalOrcado === 0 && totalGlobalRealizado > 0) { totalStatusText = "Acima"; totalStatusPillClass = "status-acima"; }
                else if (totalGlobalOrcado > 0 || totalGlobalRealizado > 0) {
                    if (totalPercentConsumption < 90) { totalStatusText = "Abaixo"; totalStatusPillClass = "status-abaixo"; }
                    else if (totalPercentConsumption < 100) { totalStatusText = "Atenção"; totalStatusPillClass = "status-atencao"; }
                    else { totalStatusText = "Acima"; totalStatusPillClass = "status-acima"; }
                }

                tableHtml += `<tfoot><tr><td>TOTAL GERAL</td>`;
                uniqueCols.forEach(col => {
                    if (col.toUpperCase().includes("ORÇADO") || col.toUpperCase().includes("ORCADO")) tableHtml += `<td class="numeric">${formatNumber(totalGlobalOrcado)}</td>`;
                    else if (col.toUpperCase().includes("REALIZADO")) tableHtml += `<td class="numeric">${formatNumber(totalGlobalRealizado)}</td>`;
                    else tableHtml += `<td class="numeric">-</td>`;
                });
                tableHtml += `<td class="numeric cell-variance ${totalVarColorClass}">${totalGlobalDesvio !== 0 ? totalDesvioFormatted : "-"}</td>`;
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

                container.querySelectorAll('tr[data-node-key]').forEach(tr => {
                    tr.addEventListener('click', (e) => {
                        const nodeKey = e.currentTarget.getAttribute('data-node-key');
                        if (this._expandedRows.has(nodeKey)) this._expandedRows.delete(nodeKey);
                        else this._expandedRows.add(nodeKey);
                        this.renderTable(); 
                    });
                });

                this._profiler.metrics.steps.domCreation = this._profiler._now() - tDOMStart;
                this._updateTelemetry(tArrivalData, tDOMStart, this._profiler._now(), financialData.data.length, rowsForRender.length);

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
