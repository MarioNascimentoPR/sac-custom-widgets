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
                --small-font-size: 11px;
                --body-font-size: 12px;
                --label-font-size: 10px;
                --enterprise-text: #243443;
                --enterprise-muted: #64748b;
                --enterprise-border: #dbe3ec;
            }
            #widget-wrapper {
                display: flex;
                flex-direction: column;
                width: 100%;
                height: 100%;
                position: relative;
            }
            #header-container {
                padding: 4px 16px 12px 10px; /* Ajuste: 10px na esquerda para alinhar com a tabela */
                flex-shrink: 0;
                position: relative;
                z-index: 3000;
                overflow: visible;
            }
            #table-container {
                width: 100%;
                flex-grow: 1;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                min-height: 0;
            }
            .table-title {
                font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                font-size: 14px;
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
                flex-shrink: 0;
            }
            .filter-container-finance {
                display: flex;
                align-items: center;
                gap: 8px;
                margin: 0 0 8px 0;
                position: relative;
                z-index: 1200;
                width: fit-content;
            }
            .filter-label-finance {
                font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                font-size: var(--small-font-size);
                font-weight: 600;
                color: #4A5568;
            }
            .tree-dropdown-trigger {
                min-width: 136px;
                max-width: 220px;
                border: 1px solid #CBD5E0;
                border-radius: 6px;
                background-color: #F8FAFC;
                color: #2D3748;
                font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                font-size: var(--small-font-size);
                font-weight: 700;
                padding: 5px 28px 5px 10px;
                cursor: pointer;
                box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%234a5568'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E");
                background-repeat: no-repeat;
                background-position: right 8px center;
                background-size: 12px;
                user-select: none;
                text-overflow: ellipsis;
                white-space: nowrap;
                overflow: hidden;
            }
            .tree-dropdown-trigger.disabled {
                color: #94A3B8;
                background: #F8FAFC;
                cursor: not-allowed;
            }
            .tree-dropdown-content {
                display: none;
                position: absolute;
                top: 100%;
                left: 42px;
                margin-top: 4px;
                min-width: 160px;
                max-height: 260px;
                overflow-y: auto;
                background: #ffffff;
                border: 1px solid #cbd5e0;
                border-radius: 6px;
                box-shadow: 0 10px 24px rgba(15, 23, 42, 0.16);
                z-index: 5000;
                padding: 6px 0;
            }
            .tree-dropdown-content.show { display: block; }
            .tree-month-item {
                font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                font-size: var(--small-font-size);
                font-weight: 600;
                color: #4A5568;
                padding: 6px 12px;
                cursor: pointer;
                user-select: none;
            }
            .tree-month-item:hover { background-color: #E2E8F0; color: #1F4E79; }
            .tree-month-item.selected { background-color: #EDF2F7; color: #1F4E79; font-weight: 700; }
            .telemetry-btn {
                height: 28px;
                border: 1px solid #CBD5E0;
                border-radius: 4px;
                background: #F1F5F9;
                color: #475569;
                font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                font-size: var(--small-font-size);
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
            .executive-oversight {
                font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                margin: 0 0 8px 0;
                background: #F8FAFC;
                border: 1px solid #E2E8F0;
                border-left: 4px solid #64748B;
                border-radius: 4px;
                padding: 10px 12px;
                color: #1E293B;
            }
            .executive-oversight.risk-baixo { border-left-color: #2E7D32; }
            .executive-oversight.risk-moderado { border-left-color: #EF6C00; }
            .executive-oversight.risk-alto { border-left-color: #D32F2F; }
            .executive-oversight.risk-critico { border-left-color: #7F1D1D; }
            .executive-headline {
                display: flex;
                align-items: baseline;
                justify-content: space-between;
                gap: 12px;
                font-size: 12px;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 6px;
            }
            .executive-score {
                font-variant-numeric: tabular-nums;
                white-space: nowrap;
            }
            .executive-grid {
                display: grid;
                grid-template-columns: 1.2fr 1fr 1fr;
                gap: 10px;
                font-size: 11.5px;
                line-height: 1.45;
            }
            .executive-label {
                display: block;
                font-size: 10px;
                font-weight: 800;
                color: #64748B;
                text-transform: uppercase;
                letter-spacing: 0.4px;
                margin-bottom: 2px;
            }
            .executive-text strong { color: #0F172A; }
            .view-tabs {
                display: inline-flex;
                align-items: center;
                align-self: flex-start;
                gap: 3px;
                margin: 0 10px 10px 10px;
                padding: 3px;
                background: #F1F5F9;
                border: 1px solid #DBE3EC;
                border-radius: 7px;
                flex-shrink: 0;
            }
            .view-tab {
                border: none;
                background: transparent;
                color: #475569;
                font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                font-size: var(--small-font-size);
                font-weight: 700;
                border-radius: 5px;
                padding: 6px 11px;
                cursor: pointer;
            }
            .view-tab:hover { background: #E2E8F0; color: #1E293B; }
            .view-tab.active {
                background: #FFFFFF;
                color: #1F4E79;
                box-shadow: 0 1px 3px rgba(15,23,42,0.08);
            }
            .view-panel {
                display: none;
                padding: 10px;
                overflow: auto;
                flex-grow: 1;
                min-height: 0;
                font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                font-size: var(--body-font-size);
            }
            .view-panel.active { display: block; }
            .executive-kpi-grid {
                display: grid;
                grid-template-columns: repeat(4, minmax(130px, 1fr));
                gap: 8px;
                margin-bottom: 10px;
            }
            .executive-kpi {
                border: 1px solid #E2E8F0;
                border-radius: 6px;
                padding: 9px 10px;
                background: #FFFFFF;
                font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            }
            .kpi-label {
                font-size: 10px;
                font-weight: 800;
                color: #64748B;
                text-transform: uppercase;
                letter-spacing: 0.35px;
                margin-bottom: 4px;
            }
            .kpi-value {
                font-size: 16px;
                font-weight: 800;
                color: #0F172A;
                font-variant-numeric: tabular-nums;
            }
            .kpi-sub {
                margin-top: 2px;
                font-size: 11px;
                color: #64748B;
            }
            .executive-section {
                border: 1px solid #E2E8F0;
                border-radius: 6px;
                background: #FFFFFF;
                padding: 10px 12px;
                margin-bottom: 10px;
                font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            }
            .section-title {
                font-size: 11px;
                font-weight: 800;
                color: #334155;
                text-transform: uppercase;
                letter-spacing: 0.4px;
                margin-bottom: 8px;
            }
            .driver-list { display: grid; gap: 6px; }
            .driver-row {
                display: grid;
                grid-template-columns: 1.4fr 0.8fr 0.8fr 0.8fr;
                gap: 8px;
                align-items: center;
                font-size: 11.5px;
                border-bottom: 1px solid #F1F5F9;
                padding-bottom: 6px;
            }
            .driver-row:last-child { border-bottom: 0; padding-bottom: 0; }
            .driver-name { font-weight: 700; color: #0F172A; }
            .driver-meta { color: #64748B; }
            .diagnostic-grid {
                display: grid;
                grid-template-columns: repeat(2, minmax(220px, 1fr));
                gap: 10px;
            }
            @media (max-width: 900px) {
                .executive-kpi-grid { grid-template-columns: repeat(2, minmax(130px, 1fr)); }
                .diagnostic-grid { grid-template-columns: 1fr; }
                .driver-row { grid-template-columns: 1fr; }
            }
            @media (max-width: 760px) {
                .executive-grid { grid-template-columns: 1fr; }
                .executive-headline { flex-direction: column; gap: 2px; }
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
            .status-baixa { background-color: #E8F5E9; color: #1B5E20; border: 1px solid #C8E6C9; }
            .status-baixo { background-color: #E8F5E9; color: #1B5E20; border: 1px solid #C8E6C9; }
            .status-moderada { background-color: #FFF3E0; color: #E65100; border: 1px solid #FFE0B2; }
            .status-moderado { background-color: #FFF3E0; color: #E65100; border: 1px solid #FFE0B2; }
            .status-alta { background-color: #FFEBEE; color: #B71C1C; border: 1px solid #FFCDD2; }
            .status-alto { background-color: #FFEBEE; color: #B71C1C; border: 1px solid #FFCDD2; }
            .status-critica { background-color: #FEE2E2; color: #7F1D1D; border: 1px solid #FCA5A5; }
            .status-critico { background-color: #FEE2E2; color: #7F1D1D; border: 1px solid #FCA5A5; }
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
            this._activeView = "executive";
            this._isDropdownOpen = false;
            this._profiler = new EvoGATableProfiler();
            this._boundWindowClick = (event) => {
                const path = event.composedPath ? event.composedPath() : [];
                const trigger = this._shadowRoot.getElementById("treeDropdownTrigger");
                const content = this._shadowRoot.getElementById("treeDropdownContent");
                const telemetryBtn = this._shadowRoot.getElementById("telemetryBtn");
                if (this._isDropdownOpen && trigger && content && !path.includes(trigger) && !path.includes(content)) {
                    this._isDropdownOpen = false;
                    this._toggleDropdownDOM();
                }
                if (this._telemetryModal && this._telemetryModal.classList.contains("show") && telemetryBtn && !path.includes(telemetryBtn) && !path.includes(this._telemetryModal)) {
                    this._telemetryModal.classList.remove("show");
                }
            };
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

        connectedCallback() {
            if (typeof window !== "undefined") window.addEventListener("click", this._boundWindowClick);
        }

        disconnectedCallback() {
            if (typeof window !== "undefined") window.removeEventListener("click", this._boundWindowClick);
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

        _setActiveView(viewName) {
            this._activeView = viewName;
            this.renderTable();
        }

        _toggleDropdownDOM() {
            const dropdownContent = this._shadowRoot.getElementById("treeDropdownContent");
            if (dropdownContent) dropdownContent.classList.toggle("show", this._isDropdownOpen);
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
            const monthTrigger = this._shadowRoot.getElementById("treeDropdownTrigger");
            const monthMenu = this._shadowRoot.getElementById("treeDropdownContent");
            const telemetryBtn = this._shadowRoot.getElementById("telemetryBtn");
            if (monthTrigger && monthMenu) {
                monthTrigger.addEventListener("click", (event) => {
                    event.stopPropagation();
                    if (!hasMonthFilter) return;
                    this._isDropdownOpen = !this._isDropdownOpen;
                    this._toggleDropdownDOM();
                });
                monthMenu.querySelectorAll(".tree-month-item").forEach(item => {
                    item.addEventListener("click", (event) => {
                        event.stopPropagation();
                        this._selectedMonth = event.currentTarget.getAttribute("data-month-value") || "__all__";
                        this._isDropdownOpen = false;
                        this._toggleDropdownDOM();
                        this._dispatchMonthFilterChanged();
                        this.renderTable();
                    });
                    item.classList.toggle("selected", item.getAttribute("data-month-value") === this._selectedMonth);
                });
            }
            this._shadowRoot.querySelectorAll("[data-view]").forEach(tab => {
                tab.addEventListener("click", (event) => {
                    const nextView = event.currentTarget.getAttribute("data-view");
                    if (nextView) this._setActiveView(nextView);
                });
            });
            if (telemetryBtn && ENABLE_TELEMETRY) {
                telemetryBtn.addEventListener("click", (event) => {
                    event.stopPropagation();
                    this._telemetryModal.classList.toggle("show");
                });
            }
        }

        _dispatchMonthFilterChanged() {
                    this.dispatchEvent(new CustomEvent("monthFilterChanged", {
                        detail: {
                            selectedMonth: this._selectedMonth === "__all__" ? null : this._selectedMonth,
                            isAllMonths: this._selectedMonth === "__all__"
                        }
                    }));
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
                const minimumMaterialityThreshold = 0.20;
                const classifySeverity = (score) => {
                    if (score > 0.70) return "Crítica";
                    if (score >= 0.45) return "Alta";
                    if (score >= 0.20) return "Moderada";
                    return "Baixa";
                };
                const classifyRisk = (score) => {
                    if (score > 0.75) return "Crítico";
                    if (score >= 0.50) return "Alto";
                    if (score >= 0.25) return "Moderado";
                    return "Baixo";
                };
                const classifyAccountNature = (name) => {
                    const text = normalizeText(name);
                    if (text.includes("COMPLIANCE") || text.includes("AUDITORIA") || text.includes("CONTROLES")) return "Compliance";
                    if (text.includes("JURID") || text.includes("LEGAL") || text.includes("ADVOC")) return "Legal";
                    if (text.includes("TI") || text.includes("TECNOLOG") || text.includes("SISTEMA") || text.includes("SOFTWARE") || text.includes("LICEN")) return "Corporate IT";
                    if (text.includes("FACILIT") || text.includes("ALUG") || text.includes("PREDIAL") || text.includes("CONDOM") || text.includes("MANUTEN")) return "Facilities";
                    if (text.includes("PESSO") || text.includes("FOLHA") || text.includes("SALARIO") || text.includes("BENEF") || text.includes("RH")) return "People";
                    if (text.includes("CONSULT") || text.includes("TERCEIR") || text.includes("SERVICO")) return "Consulting";
                    if (text.includes("TREIN") || text.includes("CAPACIT")) return "Training";
                    if (text.includes("VIAGEM") || text.includes("HOSPED") || text.includes("PASSAGEM") || text.includes("DESLOC")) return "Travel";
                    if (text.includes("SHARED") || text.includes("CENTRO DE SERV") || text.includes("CSC")) return "Shared Services";
                    if (text.includes("BACKOFFICE") || text.includes("ADMINISTR")) return "Backoffice";
                    return "SG&A";
                };
                const administrativeCriticalityWeight = (nature) => ({
                    "Compliance": 1.0,
                    "Legal": 0.9,
                    "Corporate IT": 0.9,
                    "Facilities": 0.7,
                    "People": 0.7,
                    "Consulting": 0.6,
                    "Training": 0.4,
                    "Travel": 0.3,
                    "Shared Services": 0.6,
                    "Backoffice": 0.6,
                    "SG&A": 0.5
                }[nature] || 0.5);
                const buildTrendProfile = (monthlyValues) => {
                    const series = (monthlyValues || []).map(item => item.actual - item.budget);
                    const positives = series.map(value => value > 0);
                    let recurrenceMonths = 0;
                    for (let i = positives.length - 1; i >= 0 && positives[i]; i--) recurrenceMonths++;
                    const last3 = series.slice(-3);
                    let trendDirection = "stable";
                    if (last3.length >= 3 && last3[0] < last3[1] && last3[1] < last3[2]) trendDirection = "worsening";
                    else if (last3.length >= 3 && last3[0] > last3[1] && last3[1] > last3[2]) trendDirection = "improving";
                    else if (last3.length >= 2 && last3[last3.length - 1] > last3[last3.length - 2] * 1.15) trendDirection = "acceleration";
                    else if (recurrenceMonths === 0 && positives.slice(0, -1).some(Boolean)) trendDirection = "normalization";
                    const recurrenceType = recurrenceMonths >= 6 ? "persistent" : (recurrenceMonths >= 3 ? "recurring" : (recurrenceMonths >= 1 ? "isolated" : "none"));
                    const trendRisk = trendDirection === "worsening" || trendDirection === "acceleration" ? 1 : (trendDirection === "stable" ? 0.45 : 0.15);
                    const recurrenceRisk = recurrenceMonths >= 6 ? 1 : (recurrenceMonths >= 3 ? 0.65 : (recurrenceMonths >= 1 ? 0.25 : 0));
                    return { trendDirection, recurrenceType, trendRisk, recurrenceRisk, recurrenceMonths };
                };
                const buildExecutiveNarrative = (riskLabel, riskScore, drivers, totalDesvio, totalPct) => {
                    const driverNames = drivers.slice(0, 3).map(item => item.accountNature || item.name);
                    const uniqueDrivers = Array.from(new Set(driverNames));
                    const driverText = uniqueDrivers.length ? uniqueDrivers.join(", ") : "sem concentração material";
                    const topDriver = drivers[0];
                    const trendText = topDriver && topDriver.trendDirection === "worsening"
                        ? `deterioração recorrente em ${topDriver.recurrenceMonths || 3} períodos recentes`
                        : (topDriver && topDriver.trendDirection === "acceleration" ? "aceleração no período corrente" : "comportamento sob controle relativo");
                    const directionText = totalDesvio > 0 ? "pressão administrativa acima do esperado" : "aderência orçamentária com oportunidade de preservação de saving";
                    const recommendation = riskScore >= 0.50
                        ? "Priorizar revisão executiva dos vetores materiais, validar recorrência contratual e pactuar plano de contenção com responsáveis administrativos."
                        : "Manter acompanhamento no ciclo de forecast e preservar disciplina de aprovação para despesas recorrentes.";
                    return {
                        headline: `RISCO ORÇAMENTÁRIO G&A: ${riskLabel.toUpperCase()}`,
                        keyDrivers: `Principais vetores: ${driverText}.`,
                        rootCause: topDriver ? `A leitura aponta concentração em ${topDriver.accountNature}, com materialidade ${(topDriver.materialityScore * 100).toFixed(0)}%.` : "Não há vetor administrativo dominante com materialidade executiva.",
                        severity: riskLabel,
                        trend: `Tendência: ${trendText}.`,
                        recommendation,
                        riskAssessment: `Contexto: ${directionText}; variação consolidada de ${totalPct.toFixed(1)}% sobre o orçamento G&A.`
                    };
                };

                const headerName = getName(dimensions[calcDimKey]);

                const dataMap = {};
                const uniqueColsSet = new Set();
                this._profiler.metrics.steps.parsing = this._profiler._now() - tParsingStart;
                const tAggregationStart = this._profiler._now();
                const monthlyIndex = {};
                const addMonthlyValue = (key, month, col, value) => {
                    if (!month) return;
                    if (!monthlyIndex[key]) monthlyIndex[key] = {};
                    if (!monthlyIndex[key][month]) monthlyIndex[key][month] = { budget: 0, actual: 0 };
                    if (isVersionMember(col) && normalizeText(col).includes("ORCADO")) monthlyIndex[key][month].budget += value;
                    else if (isVersionMember(col) && normalizeText(col).includes("REALIZADO")) monthlyIndex[key][month].actual += value;
                };
                const getMeasureValueFromRow = (row) => {
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
                    return parseNumber(value);
                };
                const selectedMonthIndex = this._selectedMonth === "__all__" ? -1 : monthOptions.indexOf(this._selectedMonth);
                const ytdRows = monthDimKey && selectedMonthIndex >= 0
                    ? financialData.data.filter(row => {
                        const rowMonthIndex = monthOptions.indexOf(getName(row[monthDimKey]));
                        return rowMonthIndex >= 0 && rowMonthIndex <= selectedMonthIndex;
                    })
                    : rowsForRender;
                const sumRowsByVersion = (rows) => rows.reduce((acc, row) => {
                    const col = getName(row[colDimKey]);
                    const numVal = getMeasureValueFromRow(row);
                    if (normalizeText(col).includes("ORCADO")) acc.budget += numVal;
                    else if (normalizeText(col).includes("REALIZADO")) acc.actual += numVal;
                    return acc;
                }, { budget: 0, actual: 0 });
                const ytdTotals = sumRowsByVersion(ytdRows);

                rowsForRender.forEach(row => {
                    const calcNode = getName(row[calcDimKey]);
                    const ccNivel1 = getName(row[ccNivel1DimKey]);
                    const ccNivel2 = getName(row[ccNivel2DimKey]);
                    const conta = getName(row[contaDimKey]);
                    const col = getName(row[colDimKey]);
                    uniqueColsSet.add(col);
                    
                    const numVal = getMeasureValueFromRow(row);

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

                if (monthDimKey) {
                    financialData.data.forEach(row => {
                        const calcNode = getName(row[calcDimKey]);
                        const ccNivel1 = getName(row[ccNivel1DimKey]);
                        const ccNivel2 = getName(row[ccNivel2DimKey]);
                        const conta = getName(row[contaDimKey]);
                        const col = getName(row[colDimKey]);
                        const month = getName(row[monthDimKey]);
                        const numVal = getMeasureValueFromRow(row);
                        addMonthlyValue(`calc:${calcNode}`, month, col, numVal);
                        addMonthlyValue(`calc:${calcNode}|cc1:${ccNivel1}`, month, col, numVal);
                        addMonthlyValue(`calc:${calcNode}|cc1:${ccNivel1}|cc2:${ccNivel2}`, month, col, numVal);
                        addMonthlyValue(`calc:${calcNode}|cc1:${ccNivel1}|cc2:${ccNivel2}|conta:${conta}`, month, col, numVal);
                    });
                }

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
                const allNodes = [];
                const collectNodes = (node) => {
                    allNodes.push(node);
                    (node.children || []).forEach(collectNodes);
                };
                tableData.forEach(collectNodes);
                const maxVarianceAbs = Math.max(...allNodes.map(node => Math.abs(node.desvio)), 1);
                const monthlyProfileFor = (key) => {
                    const monthMap = monthlyIndex[key] || {};
                    return this._sortMonthOptions(Object.keys(monthMap)).map(month => monthMap[month]);
                };
                const annotateNode = (node) => {
                    (node.children || []).forEach(annotateNode);
                    const varianceAbs = node.desvio;
                    const variancePct = node.valOrcado > 0 ? ((node.valRealizado - node.valOrcado) / node.valOrcado) * 100 : 0;
                    const budgetWeight = totalGlobalOrcado > 0 ? node.valOrcado / totalGlobalOrcado : 0;
                    const organizationalWeight = totalGlobalRealizado > 0 ? node.valRealizado / totalGlobalRealizado : 0;
                    const normalizedVariancePct = Math.min(Math.abs(variancePct) / 100, 1);
                    const normalizedVarianceAbs = Math.min(Math.abs(varianceAbs) / maxVarianceAbs, 1);
                    const materialityScore = (normalizedVariancePct * 0.35) + (normalizedVarianceAbs * 0.35) + (budgetWeight * 0.20) + (organizationalWeight * 0.10);
                    const childrenByMateriality = [...(node.children || [])].sort((a, b) => (b.materialityScore || 0) - (a.materialityScore || 0));
                    const inheritedNature = childrenByMateriality[0] && childrenByMateriality[0].accountNature;
                    const accountNature = node.children && node.children.length ? (inheritedNature || classifyAccountNature(node.name)) : classifyAccountNature(node.name);
                    const trendProfile = buildTrendProfile(monthlyProfileFor(node.key));
                    const administrativeCriticality = administrativeCriticalityWeight(accountNature);
                    const executiveRiskScore = (materialityScore * 0.40) + (trendProfile.trendRisk * 0.25) + (trendProfile.recurrenceRisk * 0.20) + (administrativeCriticality * 0.15);
                    node.varianceAbs = varianceAbs;
                    node.variancePct = variancePct;
                    node.budgetWeight = budgetWeight;
                    node.organizationalWeight = organizationalWeight;
                    node.materialityScore = materialityScore;
                    node.executiveSeverity = classifySeverity(materialityScore);
                    node.varianceDirection = varianceAbs > 0 ? "negative" : (varianceAbs < 0 ? "positive" : "neutral");
                    node.varianceSeverity = node.executiveSeverity.toLowerCase();
                    node.trendDirection = trendProfile.trendDirection;
                    node.businessCriticality = "administrative";
                    node.recurrenceType = trendProfile.recurrenceType;
                    node.recurrenceMonths = trendProfile.recurrenceMonths;
                    node.accountNature = accountNature;
                    node.administrativeCriticality = administrativeCriticality;
                    node.executiveRiskScore = executiveRiskScore;
                    node.executiveRisk = classifyRisk(executiveRiskScore);
                    node.isExecutiveNoise = Math.abs(variancePct) < 2 && Math.abs(varianceAbs) < 100000 && materialityScore < minimumMaterialityThreshold;
                };
                tableData.forEach(annotateNode);

                const centrosDeCusto = tableData.flatMap(item =>
                    item.children.flatMap(ccNivel1 => ccNivel1.children)
                );
                const ofensores = [...centrosDeCusto]
                    .filter(item => item.desvio > 0 && !item.isExecutiveNoise)
                    .sort((a, b) => b.materialityScore - a.materialityScore)
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
                const executiveDrivers = [...centrosDeCusto]
                    .filter(item => item.desvio > 0 && !item.isExecutiveNoise)
                    .sort((a, b) => b.executiveRiskScore - a.executiveRiskScore || b.materialityScore - a.materialityScore)
                    .slice(0, 5);
                const consolidatedRiskScore = executiveDrivers.length
                    ? Math.max(...executiveDrivers.map(item => item.executiveRiskScore))
                    : (tableData[0] ? tableData[0].executiveRiskScore : 0);
                const consolidatedRiskLabel = classifyRisk(consolidatedRiskScore);
                const totalVariancePct = totalGlobalOrcado > 0 ? (totalGlobalDesvio / totalGlobalOrcado) * 100 : 0;
                const executiveNarrative = buildExecutiveNarrative(consolidatedRiskLabel, consolidatedRiskScore, executiveDrivers, totalGlobalDesvio, totalVariancePct);
                const riskClass = `risk-${normalizeText(consolidatedRiskLabel).toLowerCase()}`;
                const ytdDesvio = ytdTotals.actual - ytdTotals.budget;
                const ytdVariancePct = ytdTotals.budget > 0 ? (ytdDesvio / ytdTotals.budget) * 100 : 0;
                const kpiConsumptionText = totalGlobalOrcado > 0 ? `${((totalGlobalRealizado / totalGlobalOrcado) * 100).toFixed(1)}%` : "-";
                const ytdLabel = this._selectedMonth === "__all__" ? "YTD disponível" : `YTD até ${this._selectedMonth}`;
                const periodLabel = this._selectedMonth === "__all__" ? "Período disponível" : this._selectedMonth;
                const driversListHtml = executiveDrivers.length ? executiveDrivers.slice(0, 5).map((driver, index) => `
                    <div class="driver-row">
                        <div>
                            <div class="driver-name">${index + 1}. ${escapeHtml(driver.name)}</div>
                            <div class="driver-meta">${escapeHtml(driver.accountNature)} · ${escapeHtml(driver.trendDirection)} · ${escapeHtml(driver.recurrenceType)}</div>
                        </div>
                        <div><span class="executive-label">Desvio</span>${formatNumber(Math.abs(driver.desvio), true, true, driver.desvio)}</div>
                        <div><span class="executive-label">Materialidade</span>${(driver.materialityScore * 100).toFixed(1)}%</div>
                        <div><span class="executive-label">Risco</span>${escapeHtml(driver.executiveRisk)}</div>
                    </div>
                `).join("") : `<div class="driver-meta">Não há ofensores materiais acima do limiar executivo no período selecionado.</div>`;
                const diagnosticHtml = `
                    <div class="diagnostic-grid">
                        <div class="executive-section">
                            <div class="section-title">Critérios de Materialidade</div>
                            <div class="driver-list">
                                <div class="driver-row"><div class="driver-name">Desvio percentual normalizado</div><div>35%</div><div class="driver-meta">Escala 0-1</div><div></div></div>
                                <div class="driver-row"><div class="driver-name">Desvio absoluto normalizado</div><div>35%</div><div class="driver-meta">Escala 0-1</div><div></div></div>
                                <div class="driver-row"><div class="driver-name">Peso no orçamento G&A</div><div>20%</div><div class="driver-meta">Budget / total</div><div></div></div>
                                <div class="driver-row"><div class="driver-name">Peso organizacional</div><div>10%</div><div class="driver-meta">Actual / total</div><div></div></div>
                            </div>
                        </div>
                        <div class="executive-section">
                            <div class="section-title">Leitura de Risco Executivo</div>
                            <div class="driver-list">
                                <div class="driver-row"><div class="driver-name">Risco consolidado</div><div>${escapeHtml(consolidatedRiskLabel)}</div><div>${(consolidatedRiskScore * 100).toFixed(1)}%</div><div></div></div>
                                <div class="driver-row"><div class="driver-name">Linhas SAC analisadas</div><div>${financialData.data.length}</div><div class="driver-meta">Filtradas: ${rowsForRender.length}</div><div></div></div>
                                <div class="driver-row"><div class="driver-name">Ruído executivo ocultado</div><div>${centrosDeCusto.filter(item => item.isExecutiveNoise).length}</div><div class="driver-meta">Critério 2% / R$100k / baixa materialidade</div><div></div></div>
                            </div>
                        </div>
                    </div>
                `;

                this._profiler.metrics.steps.aggregation = this._profiler._now() - tAggregationStart;
                const tDOMStart = this._profiler._now();
                const monthItemsHtml = [`<div class="tree-month-item ${this._selectedMonth === "__all__" ? "selected" : ""}" data-month-value="__all__">Todos os meses</div>`]
                    .concat(monthOptions.map(month =>
                        `<div class="tree-month-item ${this._selectedMonth === month ? "selected" : ""}" data-month-value="${escapeHtml(month)}">${escapeHtml(month)}</div>`
                    )).join("");
                const selectedMonthLabel = this._selectedMonth === "__all__" ? "Todos os meses" : this._selectedMonth;
                const monthDisabledClass = monthOptions.length ? "" : "disabled";

                headerContainer.innerHTML = `
                    <div class="header-top">
                        <h1 class="table-title">G&A Executive Oversight Engine</h1>
                        <div class="header-actions">
                            <button class="telemetry-btn" id="telemetryBtn" type="button">Telemetria</button>
                        </div>
                    </div>
                    <div class="filter-container-finance">
                        <span class="filter-label-finance">Corte:</span>
                        <div class="tree-dropdown-trigger ${monthDisabledClass}" id="treeDropdownTrigger">${escapeHtml(selectedMonthLabel)}</div>
                        <div class="tree-dropdown-content ${this._isDropdownOpen ? "show" : ""}" id="treeDropdownContent">
                            ${monthItemsHtml}
                        </div>
                    </div>
                `;
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
                    let barFillClass = "fill-green";
                    if (rowObj.executiveSeverity === "Crítica" || rowObj.executiveSeverity === "Alta") barFillClass = "fill-red";
                    else if (rowObj.executiveSeverity === "Moderada" || rowObj.percentConsumption >= 100) barFillClass = "fill-yellow";
                    let consumptionText = rowObj.percentConsumption === Infinity ? "∞" : (rowObj.percentConsumption === 0 ? "-" : formatPercentage(rowObj.percentConsumption));
                    
                    if(rowObj.valOrcado === 0 && rowObj.valRealizado === 0) barFillWidth = 0;

                    html += `<td class="cell-consumption">
                        <div class="consumption-wrapper">
                            <div class="bar-container"><div class="bar-fill ${barFillClass}" style="width: ${barFillWidth}%;"></div></div>
                            <div class="percent-value">${consumptionText}</div>
                        </div>
                    </td>`;

                    let statusText = rowObj.executiveSeverity || "-";
                    let statusPillClass = `status-${normalizeText(statusText).toLowerCase()}`;
                    if (rowObj.isExecutiveNoise) { statusText = "Baixa"; statusPillClass = "status-baixa"; }

                    let statusTitle = `Materialidade ${(rowObj.materialityScore * 100).toFixed(1)}% | Risco ${(rowObj.executiveRiskScore * 100).toFixed(1)}% | ${rowObj.accountNature}`;
                    let statusHtml = statusText !== "-" ? `<span class="status-pill ${statusPillClass}" title="${escapeHtml(statusTitle)}">${statusText}</span>` : "-";
                    html += `<td class="center cell-status">${statusHtml}</td></tr>`;
                    
                    return html;
                };
                const hasVisibleSignal = (rowObj, level = 0) => {
                    if (level === 0) return true;
                    if (!rowObj.isExecutiveNoise) return true;
                    return (rowObj.children || []).some(child => hasVisibleSignal(child, level + 1));
                };

                tableData.forEach(calcRow => {
                    tableHtml += renderRowHtml(calcRow, 0);
                    if (this._expandedRows.has(calcRow.key)) {
                        calcRow.children.forEach(ccNivel1Row => {
                            if (!hasVisibleSignal(ccNivel1Row, 1)) return;
                            tableHtml += renderRowHtml(ccNivel1Row, 1);
                            if (this._expandedRows.has(ccNivel1Row.key)) {
                                ccNivel1Row.children.forEach(ccNivel2Row => {
                                    if (!hasVisibleSignal(ccNivel2Row, 2)) return;
                                    tableHtml += renderRowHtml(ccNivel2Row, 2);
                                    if (this._expandedRows.has(ccNivel2Row.key)) {
                                        ccNivel2Row.children.forEach(contaRow => {
                                            if (!hasVisibleSignal(contaRow, 3)) return;
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
                let totalBarFillClass = consolidatedRiskLabel === "Crítico" || consolidatedRiskLabel === "Alto" ? "fill-red" : (consolidatedRiskLabel === "Moderado" ? "fill-yellow" : "fill-green");
                let totalConsumptionText = totalPercentConsumption === Infinity ? "∞" : (totalPercentConsumption === 0 ? "-" : formatPercentage(totalPercentConsumption));
                if(totalGlobalOrcado === 0 && totalGlobalRealizado === 0) totalBarFillWidth = 0;

                let totalStatusText = consolidatedRiskLabel;
                let totalStatusPillClass = `status-${normalizeText(consolidatedRiskLabel).toLowerCase()}`;

                tableHtml += `<tfoot><tr><td>TOTAL GERAL</td>`;
                uniqueCols.forEach(col => {
                    if (col.toUpperCase().includes("ORÇADO") || col.toUpperCase().includes("ORCADO")) tableHtml += `<td class="numeric">${formatNumber(totalGlobalOrcado)}</td>`;
                    else if (col.toUpperCase().includes("REALIZADO")) tableHtml += `<td class="numeric">${formatNumber(totalGlobalRealizado)}</td>`;
                    else tableHtml += `<td class="numeric">-</td>`;
                });
                tableHtml += `<td class="numeric cell-variance ${totalVarColorClass}">${totalGlobalDesvio !== 0 ? totalDesvioFormatted : "-"}</td>`;
                tableHtml += `<td class="cell-consumption"><div class="consumption-wrapper"><div class="bar-container"><div class="bar-fill ${totalBarFillClass}" style="width: ${totalBarFillWidth}%;"></div></div><div class="percent-value">${totalConsumptionText}</div></div></td>`;
                tableHtml += `<td class="center cell-status">${totalStatusText !== "-" ? `<span class="status-pill ${totalStatusPillClass}">${totalStatusText}</span>` : "-"}</td></tr></tfoot></table>`;

                const executivePanelHtml = `
                    <div class="executive-kpi-grid">
                        <div class="executive-kpi">
                            <div class="kpi-label">Consumo Orçado G&A</div>
                            <div class="kpi-value">${escapeHtml(kpiConsumptionText)}</div>
                            <div class="kpi-sub">${escapeHtml(periodLabel)} · ${formatNumber(totalGlobalRealizado)} realizado</div>
                        </div>
                        <div class="executive-kpi">
                            <div class="kpi-label">Desvio do Período</div>
                            <div class="kpi-value">${formatNumber(Math.abs(totalGlobalDesvio), true, true, totalGlobalDesvio)}</div>
                            <div class="kpi-sub">${totalVariancePct.toFixed(1)}% vs orçamento</div>
                        </div>
                        <div class="executive-kpi">
                            <div class="kpi-label">Desvio YTD</div>
                            <div class="kpi-value">${formatNumber(Math.abs(ytdDesvio), true, true, ytdDesvio)}</div>
                            <div class="kpi-sub">${escapeHtml(ytdLabel)} · ${ytdVariancePct.toFixed(1)}%</div>
                        </div>
                        <div class="executive-kpi">
                            <div class="kpi-label">Risco Executivo</div>
                            <div class="kpi-value">${escapeHtml(consolidatedRiskLabel)}</div>
                            <div class="kpi-sub">Score ${(consolidatedRiskScore * 100).toFixed(0)}</div>
                        </div>
                    </div>
                    <div class="executive-oversight ${riskClass}">
                        <div class="executive-headline">
                            <span>${escapeHtml(executiveNarrative.headline)}</span>
                            <span class="executive-score">Score ${(consolidatedRiskScore * 100).toFixed(0)}</span>
                        </div>
                        <div class="executive-grid">
                            <div class="executive-text">
                                <span class="executive-label">Contexto e Insight</span>
                                ${escapeHtml(executiveNarrative.riskAssessment)} ${escapeHtml(executiveNarrative.keyDrivers)}
                            </div>
                            <div class="executive-text">
                                <span class="executive-label">Tendência e Causa</span>
                                ${escapeHtml(executiveNarrative.trend)} ${escapeHtml(executiveNarrative.rootCause)}
                            </div>
                            <div class="executive-text">
                                <span class="executive-label">Recomendação</span>
                                ${escapeHtml(executiveNarrative.recommendation)}
                            </div>
                        </div>
                    </div>
                    <div class="executive-section">
                        <div class="section-title">Principais Ofensores do Período</div>
                        <div class="driver-list">${driversListHtml}</div>
                    </div>
                    <p class="table-summary ${varianceClass}">
                        No período analisado, observamos um <strong>${varianceType} de R$ ${formattedGlobalDesvio}</strong> em relação ao orçamento planejado, com filtro executivo de materialidade aplicado.${ofensoresText}
                    </p>
                `;

                container.innerHTML = `
                    <div class="view-tabs">
                        <button class="view-tab ${this._activeView === "executive" ? "active" : ""}" type="button" data-view="executive">Resumo Executivo</button>
                        <button class="view-tab ${this._activeView === "diagnostic" ? "active" : ""}" type="button" data-view="diagnostic">Diagnóstico</button>
                        <button class="view-tab ${this._activeView === "operational" ? "active" : ""}" type="button" data-view="operational">Operacional</button>
                    </div>
                    <div class="view-panel ${this._activeView === "executive" ? "active" : ""}" id="executiveView">${executivePanelHtml}</div>
                    <div class="view-panel ${this._activeView === "diagnostic" ? "active" : ""}" id="diagnosticView">${diagnosticHtml}</div>
                    <div class="view-panel ${this._activeView === "operational" ? "active" : ""}" id="operationalView">${tableHtml}</div>
                `;
                this._bindHeaderControls(monthOptions, Boolean(monthDimKey));

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
