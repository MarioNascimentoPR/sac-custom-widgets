// Evo GA Executive Oversight Engine v1.3.4 - governed budget oversight.
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

    const EVO_GA_HIERARCHY = [
        { key: "vp", label: "VP" },
        { key: "diretoria", label: "Diretoria" },
        { key: "gerencia", label: "Gerência" },
        { key: "departamento", label: "Departamento" },
        { key: "conta", label: "Conta Contábil" }
    ];

    const EVO_GA_MATERIALITY_CONFIG = {
        minimumMaterialityThreshold: 0.20,
        noiseVariancePct: 2,
        noiseVarianceAbs: 100000
    };

    const EVO_GA_MOM_OFFENDER_CONFIG = {
        paretoCoverage: 0.80,
        excludedTerms: ["IFRS 16", "OUTROS", "PBA", "RATEIO"]
    };

    const EVO_GA_TREND_LABELS = {
        worsening: "deterioração",
        acceleration: "aceleração",
        improving: "melhora",
        normalization: "normalização",
        stable: "estável"
    };

    const EVO_GA_RECURRENCE_LABELS = {
        persistent: "recorrente longa",
        recurring: "recorrente",
        isolated: "isolada",
        none: "sem recorrência"
    };

    class EvoGATrendEngine {
        static buildProfile(monthlyValues) {
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
            return { trendDirection, recurrenceType, recurrenceMonths };
        }

        static formatTrend(value) {
            return EVO_GA_TREND_LABELS[value] || value || "-";
        }

        static formatRecurrence(value) {
            return EVO_GA_RECURRENCE_LABELS[value] || value || "-";
        }
    }

    class EvoGAAggregationEngine {
        static addValue(valuesMap, col, value) {
            valuesMap[col] = (valuesMap[col] || 0) + value;
        }

        static addRow(dataMap, rowContext, col, value) {
            const { calcNode, ccNivel1, ccNivel2, ccNivel3, conta } = rowContext;
            if (!dataMap[calcNode]) {
                dataMap[calcNode] = { totals: {}, ccNivel1: {} };
            }
            if (!dataMap[calcNode].ccNivel1[ccNivel1]) {
                dataMap[calcNode].ccNivel1[ccNivel1] = { totals: {}, ccNivel2: {} };
            }
            if (!dataMap[calcNode].ccNivel1[ccNivel1].ccNivel2[ccNivel2]) {
                dataMap[calcNode].ccNivel1[ccNivel1].ccNivel2[ccNivel2] = { totals: {}, ccNivel3: {} };
            }
            if (!dataMap[calcNode].ccNivel1[ccNivel1].ccNivel2[ccNivel2].ccNivel3[ccNivel3]) {
                dataMap[calcNode].ccNivel1[ccNivel1].ccNivel2[ccNivel2].ccNivel3[ccNivel3] = { totals: {}, contas: {} };
            }
            if (!dataMap[calcNode].ccNivel1[ccNivel1].ccNivel2[ccNivel2].ccNivel3[ccNivel3].contas[conta]) {
                dataMap[calcNode].ccNivel1[ccNivel1].ccNivel2[ccNivel2].ccNivel3[ccNivel3].contas[conta] = {};
            }

            EvoGAAggregationEngine.addValue(dataMap[calcNode].ccNivel1[ccNivel1].ccNivel2[ccNivel2].ccNivel3[ccNivel3].contas[conta], col, value);
            EvoGAAggregationEngine.addValue(dataMap[calcNode].ccNivel1[ccNivel1].ccNivel2[ccNivel2].ccNivel3[ccNivel3].totals, col, value);
            EvoGAAggregationEngine.addValue(dataMap[calcNode].ccNivel1[ccNivel1].ccNivel2[ccNivel2].totals, col, value);
            EvoGAAggregationEngine.addValue(dataMap[calcNode].ccNivel1[ccNivel1].totals, col, value);
            EvoGAAggregationEngine.addValue(dataMap[calcNode].totals, col, value);
        }

        static buildRowMetrics(name, valuesMap, uniqueCols, level = 0, path = []) {
            let valOrcado = 0;
            let valRealizado = 0;
            let numValues = {};

            uniqueCols.forEach(col => {
                const val = valuesMap[col] || 0;
                numValues[col] = val;
                const normalizedCol = String(col || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
                if (normalizedCol.includes("ORCADO")) valOrcado += val;
                else if (normalizedCol.includes("REALIZADO")) valRealizado += val;
            });

            const desvio = valRealizado - valOrcado;
            const percentConsumption = valOrcado > 0 ? (valRealizado / valOrcado) * 100 : (valRealizado > 0 ? Infinity : 0);
            return {
                name,
                level,
                hierarchyLabel: EVO_GA_HIERARCHY[level] ? EVO_GA_HIERARCHY[level].label : "Nível",
                hierarchyPath: path,
                accountabilityPath: path.join(" > "),
                valOrcado,
                valRealizado,
                desvio,
                percentConsumption,
                numValues
            };
        }

        static collectNodes(nodes) {
            const allNodes = [];
            const collect = (node) => {
                allNodes.push(node);
                (node.children || []).forEach(collect);
            };
            nodes.forEach(collect);
            return allNodes;
        }
    }

    class EvoGAMaterialityEngine {
        static classifyBudgetStatus(budget, actual, varianceAbs, variancePct) {
            if (budget === 0 && actual === 0) return "Sem movimento";
            if (budget === 0 && actual > 0) return "Sem orçamento";
            if (varianceAbs <= 0) return "Aderente";
            if (Math.abs(variancePct) < EVO_GA_MATERIALITY_CONFIG.noiseVariancePct &&
                Math.abs(varianceAbs) < EVO_GA_MATERIALITY_CONFIG.noiseVarianceAbs) return "Monitorar";
            if (variancePct >= 10 || varianceAbs >= 500000) return "Acima";
            return "Atenção";
        }

        static annotate(nodes, totalBudget, totalActual) {
            const maxVarianceAbs = Math.max(1, ...nodes.map(node => Math.abs(node.desvio || 0)));
            nodes.forEach(node => {
                const varianceAbs = node.desvio || 0;
                const variancePct = node.valOrcado > 0 ? ((node.valRealizado - node.valOrcado) / node.valOrcado) * 100 : 0;
                const normalizedVariancePct = Math.min(Math.abs(variancePct) / 100, 1);
                const normalizedVarianceAbs = Math.min(Math.abs(varianceAbs) / maxVarianceAbs, 1);
                const budgetWeight = totalBudget > 0 ? node.valOrcado / totalBudget : 0;
                const organizationalWeight = totalActual > 0 ? node.valRealizado / totalActual : 0;
                const materialityScore =
                    (normalizedVariancePct * 0.35) +
                    (normalizedVarianceAbs * 0.35) +
                    (budgetWeight * 0.20) +
                    (organizationalWeight * 0.10);

                node.varianceAbs = varianceAbs;
                node.variancePct = variancePct;
                node.budgetWeight = budgetWeight;
                node.organizationalWeight = organizationalWeight;
                node.materialityScore = materialityScore;
                node.materialityValue = Math.abs(varianceAbs);
                node.executiveSeverity = EvoGAMaterialityEngine.classifyBudgetStatus(node.valOrcado, node.valRealizado, varianceAbs, variancePct);
                node.varianceDirection = varianceAbs > 0 ? "negative" : (varianceAbs < 0 ? "positive" : "neutral");
                node.varianceSeverity = node.executiveSeverity.toLowerCase();
                node.isExecutiveNoise =
                    Math.abs(variancePct) < EVO_GA_MATERIALITY_CONFIG.noiseVariancePct &&
                    Math.abs(varianceAbs) < EVO_GA_MATERIALITY_CONFIG.noiseVarianceAbs &&
                    materialityScore < EVO_GA_MATERIALITY_CONFIG.minimumMaterialityThreshold;
            });
        }
    }

    class EvoGAMoMEngine {
        static _normalize(value) {
            return String(value || "")
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toUpperCase()
                .trim();
        }

        static _hasExcludedTerm(values) {
            const text = values.map(value => EvoGAMoMEngine._normalize(value)).join(" | ");
            return EVO_GA_MOM_OFFENDER_CONFIG.excludedTerms.some(term => text.includes(EvoGAMoMEngine._normalize(term)));
        }

        static _emptyPeriod() {
            return { budget: 0, actual: 0 };
        }

        static _addVersionValue(target, versionName, value) {
            const version = EvoGAMoMEngine._normalize(versionName);
            if (version.includes("ORCADO")) target.budget += value;
            else if (version.includes("REALIZADO")) target.actual += value;
        }

        static buildDepartmentDrivers(config) {
            const {
                rows,
                currentMonth,
                previousMonth,
                dimensionKeys,
                getName,
                getMeasureValueFromRow,
                paretoCoverage
            } = config;
            const targetCoverage = Number.isFinite(paretoCoverage) ? paretoCoverage : EVO_GA_MOM_OFFENDER_CONFIG.paretoCoverage;

            if (!rows || !currentMonth || !previousMonth) {
                return { drivers: [], totalMoMDeviation: 0, coverage: 0, excludedRows: 0, currentMonth, previousMonth };
            }

            const departmentMap = {};
            let excludedRows = 0;
            rows.forEach(row => {
                const rowMonth = getName(row[dimensionKeys.month]);
                if (rowMonth !== currentMonth && rowMonth !== previousMonth) return;

                const calcNode = getName(row[dimensionKeys.calc]);
                const ccNivel1 = getName(row[dimensionKeys.cc1]);
                const ccNivel2 = getName(row[dimensionKeys.cc2]);
                const ccNivel3 = getName(row[dimensionKeys.cc3]);
                const conta = getName(row[dimensionKeys.conta]);
                if (EvoGAMoMEngine._hasExcludedTerm([calcNode, ccNivel1, ccNivel2, ccNivel3, conta])) {
                    excludedRows++;
                    return;
                }

                const key = `calc:${calcNode}|cc1:${ccNivel1}|cc2:${ccNivel2}|cc3:${ccNivel3}`;
                if (!departmentMap[key]) {
                    departmentMap[key] = {
                        key,
                        name: ccNivel3,
                        hierarchyLabel: "Departamento",
                        hierarchyPath: [calcNode, ccNivel1, ccNivel2, ccNivel3],
                        accountabilityPath: [calcNode, ccNivel1, ccNivel2, ccNivel3].join(" > "),
                        current: EvoGAMoMEngine._emptyPeriod(),
                        previous: EvoGAMoMEngine._emptyPeriod()
                    };
                }

                const target = rowMonth === currentMonth ? departmentMap[key].current : departmentMap[key].previous;
                EvoGAMoMEngine._addVersionValue(target, getName(row[dimensionKeys.version]), getMeasureValueFromRow(row));
            });

            const allDrivers = Object.values(departmentMap).map(item => {
                const currentDesvio = item.current.actual - item.current.budget;
                const previousDesvio = item.previous.actual - item.previous.budget;
                const momVariance = currentDesvio - previousDesvio;
                const percentConsumption = item.current.budget > 0 ? (item.current.actual / item.current.budget) * 100 : (item.current.actual > 0 ? Infinity : 0);
                return {
                    ...item,
                    valOrcado: item.current.budget,
                    valRealizado: item.current.actual,
                    desvio: currentDesvio,
                    previousDesvio,
                    momVariance,
                    materialityValue: Math.abs(momVariance),
                    percentConsumption,
                    variancePct: item.current.budget > 0 ? (currentDesvio / item.current.budget) * 100 : 0,
                    trendDirection: momVariance > 0 ? "worsening" : (momVariance < 0 ? "improving" : "stable"),
                    recurrenceType: "isolated",
                    recurrenceMonths: momVariance > 0 ? 1 : 0,
                    isExecutiveNoise: momVariance <= 0
                };
            }).filter(item => item.momVariance > 0);

            const totalMoMDeviation = allDrivers.reduce((sum, item) => sum + item.momVariance, 0);
            const sortedDrivers = allDrivers.sort((a, b) => b.momVariance - a.momVariance);
            const selectedDrivers = [];
            let cumulative = 0;
            for (const item of sortedDrivers) {
                if (totalMoMDeviation <= 0) break;
                cumulative += item.momVariance;
                selectedDrivers.push({
                    ...item,
                    contributionPct: (item.momVariance / totalMoMDeviation) * 100,
                    cumulativeContributionPct: (cumulative / totalMoMDeviation) * 100
                });
                if ((cumulative / totalMoMDeviation) >= targetCoverage) break;
            }

            return {
                drivers: selectedDrivers,
                totalMoMDeviation,
                coverage: totalMoMDeviation > 0 ? cumulative / totalMoMDeviation : 0,
                targetCoverage,
                excludedRows,
                currentMonth,
                previousMonth
            };
        }
    }

    class EvoGANarrativeEngine {
        static build(drivers, totalDesvio, totalPct) {
            const driverNames = drivers.slice(0, 3).map(item => item.name);
            const driverText = driverNames.length ? driverNames.join("; ") : "sem concentração material";
            const topDriver = drivers[0];
            const topTrend = topDriver ? EvoGATrendEngine.formatTrend(topDriver.trendDirection) : "estável";
            const trendText = topDriver && topDriver.recurrenceMonths > 0
                ? `${topTrend} por ${topDriver.recurrenceMonths} período(s) recente(s)`
                : topTrend;
            const directionText = totalDesvio > 0 ? "pressão administrativa acima do orçamento" : "aderência orçamentária no período";
            const recommendation = totalDesvio > 0 && drivers.length
                ? "Priorizar revisão executiva das estruturas oficiais com maior desvio, validar recorrência no ciclo de forecast e pactuar plano de contenção com os responsáveis."
                : "Manter acompanhamento no ciclo de forecast e preservar disciplina de aprovação para despesas recorrentes.";
            return {
                headline: totalDesvio > 0 ? "DISCIPLINA ORÇAMENTÁRIA G&A: PRESSÃO ACIMA DO PLANEJADO" : "DISCIPLINA ORÇAMENTÁRIA G&A: ADERÊNCIA AO PLANEJADO",
                keyDrivers: `Principais ofensores oficiais: ${driverText}.`,
                rootCause: topDriver ? `A concentração está no Departamento ${topDriver.name}, conforme estrutura governada do modelo.` : "Não há vetor oficial dominante com desvio relevante.",
                trend: `Tendência: ${trendText}.`,
                recommendation,
                riskAssessment: `Contexto: ${directionText}; variação consolidada de ${totalPct.toFixed(1)}% sobre o orçamento G&A.`
            };
        }
    }

    class EvoGAUIRenderer {
        static driverValueClass(value) {
            if (value > 0) return "driver-value-alert";
            if (value < 0) return "driver-value-saving";
            return "driver-value-neutral";
        }

        static statusClass(statusText, normalizeText) {
            return `status-${normalizeText(statusText).toLowerCase().replace(/\s+/g, "-")}`;
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
                font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
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
                font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                font-size: 14px;
                font-weight: 700;
                color: #2c3e50;
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
                font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
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
                font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
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
            .tree-year-node {
                font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                font-size: var(--small-font-size);
                font-weight: 700;
                color: #2D3748;
                padding: 6px 10px;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 6px;
                user-select: none;
            }
            .tree-year-node:hover { background-color: #EDF2F7; }
            .tree-year-node::before {
                content: '▶';
                font-size: 8px;
                color: #718096;
                transition: transform 0.2s ease;
                display: inline-block;
            }
            .tree-year-node.expanded::before { transform: rotate(90deg); }
            .tree-months-container {
                display: none;
                flex-direction: column;
                padding-left: 14px;
                background: #F7FAFC;
            }
            .tree-months-container.show { display: flex; }
            .tree-month-item {
                font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
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
                font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
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
                font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
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
                color: #1e293b;
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
                font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                font-size: 11.5px; 
                color: #334155;
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
                font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                margin: 0 0 8px 0;
                background: #F8FAFC;
                border: 1px solid #E2E8F0;
                border-left: 4px solid #64748B;
                border-radius: 4px;
                padding: 10px 12px;
                color: #334155;
            }
            .executive-oversight.summary-saving { border-left-color: #2E7D32; }
            .executive-oversight.summary-desvio { border-left-color: #B91C1C; }
            .executive-headline {
                display: flex;
                align-items: baseline;
                justify-content: space-between;
                gap: 12px;
                font-size: 12px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.35px;
                margin-bottom: 6px;
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
                font-weight: 600;
                color: #4a5568;
                text-transform: uppercase;
                letter-spacing: 0;
                margin-bottom: 2px;
            }
            .executive-text strong { color: #1e293b; font-weight: 700; }
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
                font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                font-size: var(--small-font-size);
                font-weight: 700;
                border-radius: 5px;
                padding: 6px 11px;
                cursor: pointer;
            }
            .view-tab:hover { background: #E2E8F0; color: #1E293B; }
            .view-tab.active {
                background: #FFFFFF;
                color: #0f172a;
                box-shadow: 0 1px 3px rgba(15,23,42,0.08);
            }
            .view-panel {
                display: none;
                padding: 10px;
                overflow: auto;
                flex-grow: 1;
                min-height: 0;
                font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                font-size: var(--body-font-size);
            }
            .view-panel.active { display: block; }
            .executive-kpi-grid {
                display: grid;
                grid-template-columns: 1.35fr repeat(3, minmax(170px, 1fr));
                gap: 8px;
                margin-bottom: 10px;
            }
            .executive-kpi {
                border: 1px solid #E2E8F0;
                border-radius: 6px;
                padding: 10px 11px;
                background: #FFFFFF;
                font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                min-width: 0;
            }
            .executive-kpi.primary {
                border-left: 4px solid #1F4E79;
                background: #F8FAFC;
                display: flex;
                flex-direction: column;
                justify-content: center;
                min-height: 104px;
            }
            .executive-kpi.alert { border-left: 4px solid #B91C1C; }
            .executive-kpi.saving { border-left: 4px solid #166534; }
            .executive-kpi.neutral { border-left: 4px solid #64748B; }
            .kpi-detail-row {
                display: flex;
                justify-content: space-between;
                gap: 8px;
                margin-top: 6px;
                padding-top: 6px;
                border-top: 1px solid #E2E8F0;
                font-size: 11px;
                color: #475569;
                font-weight: 600;
            }
            .kpi-detail-row span:last-child {
                color: #1e293b;
                font-weight: 700;
                font-variant-numeric: tabular-nums;
                white-space: nowrap;
            }
            .kpi-label {
                font-size: 10px;
                font-weight: 600;
                color: #4a5568;
                text-transform: uppercase;
                letter-spacing: 0;
                margin-bottom: 4px;
            }
            .kpi-value {
                font-size: 16px;
                font-weight: 700;
                color: #1e293b;
                font-variant-numeric: tabular-nums;
                white-space: nowrap;
            }
            .executive-kpi.primary .kpi-value {
                font-size: 20px;
            }
            .kpi-sub {
                margin-top: 2px;
                font-size: 11px;
                color: #475569;
                font-weight: 600;
            }
            .executive-section {
                border: 1px solid #E2E8F0;
                border-radius: 6px;
                background: #FFFFFF;
                padding: 10px 12px;
                margin-bottom: 10px;
                font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            }
            .section-title {
                font-size: 11px;
                font-weight: 700;
                color: #4a5568;
                text-transform: uppercase;
                letter-spacing: 0.6px;
                margin-bottom: 8px;
            }
            .driver-list { display: grid; gap: 8px; }
            .pareto-control {
                display: grid;
                gap: 7px;
                padding: 9px 10px;
                margin-bottom: 9px;
                border: 1px solid #e2e8f0;
                border-radius: 6px;
                background: #f8fafc;
            }
            .pareto-control-header {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 12px;
                font-size: 11px;
                color: #4a5568;
                line-height: 1.35;
            }
            .pareto-control-title {
                font-weight: 700;
                color: #2d3748;
                text-transform: uppercase;
                letter-spacing: 0.45px;
            }
            .pareto-control-sub {
                display: block;
                margin-top: 1px;
                color: #64748b;
                font-weight: 500;
                text-transform: none;
                letter-spacing: 0;
            }
            .pareto-control-value {
                min-width: 48px;
                text-align: right;
                color: #1e293b;
                font-weight: 700;
                font-variant-numeric: tabular-nums;
            }
            .pareto-slider {
                width: 100%;
                accent-color: #1f4e79;
                cursor: pointer;
            }
            .pareto-scale {
                display: flex;
                justify-content: space-between;
                font-size: 10px;
                color: #64748b;
                font-weight: 600;
                padding: 0 1px;
            }
            .driver-row {
                display: grid;
                grid-template-columns: 1.35fr minmax(120px, 0.8fr) minmax(96px, 0.65fr) minmax(92px, 0.65fr);
                gap: 8px;
                align-items: center;
                font-size: 12px;
                border: 1px solid #E2E8F0;
                border-radius: 6px;
                padding: 8px 10px;
                background: #FFFFFF;
            }
            .driver-row:last-child { padding-bottom: 8px; }
            .driver-name { font-weight: 700; color: #1e293b; line-height: 1.3; }
            .driver-meta { color: #475569; font-weight: 500; line-height: 1.35; }
            .driver-metric { min-width: 0; text-align: right; }
            .driver-value {
                display: block;
                color: #1e293b;
                font-size: 12.5px;
                font-weight: 700;
                line-height: 1.25;
                font-variant-numeric: tabular-nums;
                white-space: nowrap;
            }
            .driver-value-alert { color: #B91C1C; }
            .driver-value-saving { color: #166534; }
            .driver-value-neutral { color: #1e293b; }
            .diagnostic-grid {
                display: grid;
                grid-template-columns: repeat(2, minmax(220px, 1fr));
                gap: 10px;
            }
            @media (max-width: 900px) {
                .executive-kpi-grid { grid-template-columns: repeat(2, minmax(130px, 1fr)); }
                .executive-kpi.primary { grid-row: auto; grid-column: span 2; }
                .diagnostic-grid { grid-template-columns: 1fr; }
                .driver-row { grid-template-columns: 1fr; }
                .driver-metric { text-align: left; }
            }
            @media (max-width: 760px) {
                .executive-grid { grid-template-columns: 1fr; }
                .executive-headline { flex-direction: column; gap: 2px; }
                .executive-kpi-grid { grid-template-columns: 1fr; }
                .executive-kpi.primary { grid-column: auto; }
            }

            table { 
                width: 100%; 
                border-collapse: separate; 
                border-spacing: 0;
                font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
                table-layout: auto;
            }
            th { 
                position: sticky; 
                top: 0;
                background-color: #F4F6F9; 
                z-index: 10;
                color: #2d3748; 
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
                color: #2d3748; 
                vertical-align: middle;
            }
            td:first-child { text-align: left; }
            
            tr.row-cc { cursor: pointer; transition: background-color 0.15s; }
            tr.row-cc:hover { background-color: #F8F9FA; }
            tr.row-cc td:first-child { font-weight: 600; color: #2d3748; }
            tr.row-cc-nivel-1 td { background-color: #FCFCFC; }
            tr.row-cc-nivel-1 td:first-child {
                padding-left: 26px;
                color: #334155;
            }
            tr.row-cc-nivel-2 td { background-color: #FAFAFA; }
            tr.row-cc-nivel-2 td:first-child {
                padding-left: 42px;
                color: #475569;
            }
            tr.row-cc-nivel-3 td { background-color: #F8FAFC; }
            tr.row-cc-nivel-3 td:first-child {
                padding-left: 58px;
                color: #475569;
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
                padding-left: 86px;
                font-weight: 400; 
                color: #475569; 
                position: relative;
            }
            
            tr.row-conta td:first-child::before { 
                content: '↳'; 
                position: absolute; 
                left: 68px; 
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
                color: #2d3748 !important;
                box-shadow: 0 -2px 0 0 #CCCCCC; 
                border-bottom: none;
                padding: 10px 10px;
            }
            tfoot td:first-child { color: #2d3748 !important; }

            .numeric { text-align: right; font-variant-numeric: tabular-nums; font-weight: 500; }
            .center { text-align: center; }
            .var-positive { color: #D32F2F; font-weight: 600; } 
            .var-negative { color: #2E7D32; font-weight: 600; } 
            .cell-variance { white-space: nowrap; }

            .cell-consumption { width: 140px; }
            .consumption-wrapper { display: flex; align-items: center; gap: 8px; justify-content: flex-end; }
            
            .bar-container { position: relative; flex-grow: 1; min-width: 60px; height: 8px; background-color: #EAEAEA; border-radius: 4px; }
            .bar-container::after { content: ''; position: absolute; right: 0; top: -2px; height: 12px; width: 2px; background-color: #2d3748; z-index: 2; border-radius: 1px; }
            
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
            .status-aderente { background-color: #E8F5E9; color: #1B5E20; border: 1px solid #C8E6C9; }
            .status-monitorar { background-color: #EFF6FF; color: #1D4ED8; border: 1px solid #BFDBFE; }
            .status-sem-movimento { background-color: #F1F5F9; color: #475569; border: 1px solid #CBD5E1; }
            .status-sem-orcamento { background-color: #FFEBEE; color: #B71C1C; border: 1px solid #FFCDD2; }
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
            this._hasManualMonthSelection = false;
            this._activeView = "executive";
            this._paretoCoverage = EVO_GA_MOM_OFFENDER_CONFIG.paretoCoverage;
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

        _normalizeText(value) {
            return String(value || "")
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toUpperCase()
                .trim();
        }

        _getPeriodParts(value) {
            const text = String(value || "").trim();
            const normalized = this._normalizeText(text);
            const compact = normalized.replace(/[^A-Z0-9]/g, "");
            const monthMap = {
                JAN: 1, JANEIRO: 1,
                FEV: 2, FEVEREIRO: 2, FEB: 2,
                MAR: 3, MARCO: 3, MARÇO: 3,
                ABR: 4, ABRIL: 4, APR: 4,
                MAI: 5, MAIO: 5, MAY: 5,
                JUN: 6, JUNHO: 6,
                JUL: 7, JULHO: 7,
                AGO: 8, AGOSTO: 8, AUG: 8,
                SET: 9, SETEMBRO: 9, SEP: 9,
                OUT: 10, OUTUBRO: 10, OCT: 10,
                NOV: 11, NOVEMBRO: 11,
                DEZ: 12, DEZEMBRO: 12, DEC: 12
            };
            let year = null;
            let month = null;

            let match = compact.match(/^((?:19|20)\d{2})(0[1-9]|1[0-2])$/);
            if (match) {
                year = match[1];
                month = parseInt(match[2], 10);
            }

            if (!year) {
                match = compact.match(/^(0[1-9]|1[0-2])((?:19|20)\d{2})$/);
                if (match) {
                    month = parseInt(match[1], 10);
                    year = match[2];
                }
            }

            if (!year) {
                const yearMatch = normalized.match(/(19|20)\d{2}/);
                if (yearMatch) year = yearMatch[0];
            }

            if (!month) {
                const numericMonth = normalized.match(/(?:^|[^0-9])(0?[1-9]|1[0-2])(?:[^0-9]|$)/);
                if (numericMonth) month = parseInt(numericMonth[1], 10);
            }

            if (!month) {
                const token = Object.keys(monthMap).find(key => normalized === key || normalized.startsWith(`${key} `) || normalized.includes(` ${key} `));
                if (token) month = monthMap[token];
            }

            return { year: year || "Sem ano", month: month || 99, raw: text };
        }

        _getPeriodYear(value) {
            return this._getPeriodParts(value).year;
        }

        _getPeriodDisplayLabel(value) {
            const parts = this._getPeriodParts(value);
            const monthLabels = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
            if (parts.year !== "Sem ano" && parts.month >= 1 && parts.month <= 12) return `${monthLabels[parts.month]}/${parts.year}`;
            return parts.raw || "-";
        }

        _sortMonthOptions(options) {
            return [...options].sort((a, b) => {
                const periodA = this._getPeriodParts(a);
                const periodB = this._getPeriodParts(b);
                if (periodA.year !== periodB.year) {
                    if (periodA.year === "Sem ano") return 1;
                    if (periodB.year === "Sem ano") return -1;
                    return String(periodA.year).localeCompare(String(periodB.year), "pt-BR");
                }
                if (periodA.month !== periodB.month) return periodA.month - periodB.month;
                return String(a).localeCompare(String(b), "pt-BR");
            });
        }

        _getPeriodSortValue(value) {
            const period = this._getPeriodParts(value);
            if (period.year === "Sem ano" || period.month < 1 || period.month > 12) return null;
            const yearNumber = parseInt(period.year, 10);
            if (!Number.isFinite(yearNumber)) return null;
            return (yearNumber * 100) + period.month;
        }

        _getPreviousMonthReference() {
            const now = new Date();
            let year = now.getFullYear();
            let month = now.getMonth();
            if (month === 0) {
                year -= 1;
                month = 12;
            }
            return { year: String(year), month };
        }

        _findDefaultMonthOption(monthOptions) {
            if (!monthOptions || monthOptions.length === 0) return "__all__";
            const target = this._getPreviousMonthReference();
            const exactMatch = monthOptions.find(option => {
                const period = this._getPeriodParts(option);
                return period.year === target.year && period.month === target.month;
            });
            if (exactMatch) return exactMatch;

            const targetSortValue = (parseInt(target.year, 10) * 100) + target.month;
            const datedOptions = monthOptions
                .map(option => ({ option, sortValue: this._getPeriodSortValue(option) }))
                .filter(item => item.sortValue !== null)
                .sort((a, b) => b.sortValue - a.sortValue);

            const previousAvailable = datedOptions.find(item => item.sortValue <= targetSortValue);
            if (previousAvailable) return previousAvailable.option;
            if (datedOptions.length) return datedOptions[0].option;
            return monthOptions[monthOptions.length - 1];
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
                monthMenu.querySelectorAll(".tree-year-node").forEach(yearNode => {
                    yearNode.addEventListener("click", (event) => {
                        event.stopPropagation();
                        const monthsContainer = event.currentTarget.nextElementSibling;
                        event.currentTarget.classList.toggle("expanded");
                        if (monthsContainer) monthsContainer.classList.toggle("show");
                    });
                });
                monthMenu.querySelectorAll(".tree-month-item").forEach(item => {
                    item.addEventListener("click", (event) => {
                        event.stopPropagation();
                        this._selectedMonth = event.currentTarget.getAttribute("data-month-value") || "__all__";
                        this._hasManualMonthSelection = true;
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

                if (dimKeys.length < 6 || measureKeys.length < 1) {
                    container.innerHTML = "<div style='padding:10px; color:#D32F2F;'>Adicione 6 dimensões (1. Dimensão Calculada/VP, 2. Centro de Custo Nível 1/Diretoria, 3. Centro de Custo Nível 2/Gerência, 4. Centro de Custo Nível 3/Departamento, 5. Conta Contábil, 6. Orçado/Realizado) e 1 medida. A dimensão de mês é opcional.</div>";
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
                const getDimensionMetadataName = (dimKey) => normalizeText(`${dimKey} ${getName(dimensions[dimKey])}`);
                const isMonthDimension = (dimKey) => {
                    const dimName = getDimensionMetadataName(dimKey);
                    return dimName.includes("MES") || dimName.includes("MONTH") || dimName.includes("COMPETENCIA") ||
                        dimName.includes("PERIODO") || dimName.includes("PERIOD") || dimName.includes("DATA") ||
                        dimName.includes("DATE") || dimName.includes("TEMPO") || dimName.includes("TIME") ||
                        dimName.includes("CALMONTH") || dimName.includes("CALENDAR") || dimName.includes("FISCAL") ||
                        dimName.includes("FISCPER") || dimName.includes("ANO") || dimName.includes("YEAR");
                };
                const isMonthLikeMember = (value) => {
                    const normalized = normalizeText(value).trim();
                    const compact = normalized.replace(/[^A-Z0-9]/g, "");
                    if (!normalized || normalized === "N/D") return false;
                    const monthTokens = ["JAN", "JANEIRO", "FEV", "FEVEREIRO", "FEB", "MAR", "MARCO", "MARÇO", "ABR", "ABRIL", "APR", "MAI", "MAIO", "MAY", "JUN", "JUNHO", "JUL", "JULHO", "AGO", "AGOSTO", "AUG", "SET", "SETEMBRO", "SEP", "OUT", "OUTUBRO", "OCT", "NOV", "NOVEMBRO", "DEZ", "DEZEMBRO", "DEC"];
                    if (monthTokens.some(token => normalized === token || normalized.startsWith(`${token} `) || normalized.includes(` ${token} `))) return true;
                    if (/^(19|20)\d{2}(0[1-9]|1[0-2])$/.test(compact)) return true;
                    if (/^(0[1-9]|1[0-2])(19|20)\d{2}$/.test(compact)) return true;
                    if (/^(0?[1-9]|1[0-2])$/.test(compact)) return true;
                    return false;
                };

                let colDimKey = dimKeys.find(dimKey =>
                    financialData.data.some(row => isVersionMember(getName(row[dimKey])))
                ) || dimKeys[dimKeys.length - 1];

                const candidateHierarchyDimKeys = dimKeys.filter(dimKey => dimKey !== colDimKey);
                const detectedMonthDimKey = candidateHierarchyDimKeys.find(dimKey => isMonthDimension(dimKey));
                const orderedWithoutMonth = candidateHierarchyDimKeys.filter(dimKey => dimKey !== detectedMonthDimKey);
                const calcDimKey = orderedWithoutMonth[0];
                const ccNivel1DimKey = orderedWithoutMonth[1];
                const ccNivel2DimKey = orderedWithoutMonth[2];
                const ccNivel3DimKey = orderedWithoutMonth[3];
                const contaDimKey = orderedWithoutMonth[4];
                const fallbackMonthDimKey = orderedWithoutMonth[5] &&
                    financialData.data.some(row => isMonthLikeMember(getName(row[orderedWithoutMonth[5]])))
                    ? orderedWithoutMonth[5]
                    : null;
                const monthDimKey = detectedMonthDimKey || fallbackMonthDimKey || null;
                const monthOptions = monthDimKey
                    ? this._sortMonthOptions(Array.from(new Set(financialData.data.map(row => getName(row[monthDimKey])).filter(Boolean))))
                    : [];
                if (monthOptions.length) {
                    const selectedStillValid = this._selectedMonth === "__all__" || monthOptions.includes(this._selectedMonth);
                    if (!this._hasManualMonthSelection || !selectedStillValid) {
                        this._selectedMonth = this._findDefaultMonthOption(monthOptions);
                        this._hasManualMonthSelection = false;
                    }
                } else {
                    this._selectedMonth = "__all__";
                    this._hasManualMonthSelection = false;
                }

                const rowsForRender = monthDimKey && this._selectedMonth !== "__all__"
                    ? financialData.data.filter(row => getName(row[monthDimKey]) === this._selectedMonth)
                    : financialData.data;

                const hierarchyDimKeys = [calcDimKey, ccNivel1DimKey, ccNivel2DimKey, ccNivel3DimKey, contaDimKey].filter(Boolean);
                if (hierarchyDimKeys.length < EVO_GA_HIERARCHY.length) {
                    container.innerHTML = "<div style='padding:10px; color:#D32F2F;'>Não foi possível identificar a hierarquia oficial VP > Diretoria > Gerência > Departamento > Conta Contábil. Verifique a ordem das dimensões no Builder e a dimensão de versão Orçado/Realizado.</div>";
                    return;
                }
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

                const formatKpiCurrency = (num) => num.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                });

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
                const selectedPeriod = this._getPeriodParts(this._selectedMonth);
                const selectedHasCalendarPeriod = selectedPeriod.year !== "Sem ano" && selectedPeriod.month >= 1 && selectedPeriod.month <= 12;
                const ytdRows = monthDimKey && selectedMonthIndex >= 0
                    ? financialData.data.filter(row => {
                        const rowMonth = getName(row[monthDimKey]);
                        if (selectedHasCalendarPeriod) {
                            const rowPeriod = this._getPeriodParts(rowMonth);
                            return rowPeriod.year === selectedPeriod.year && rowPeriod.month >= 1 && rowPeriod.month <= selectedPeriod.month;
                        }
                        const rowMonthIndex = monthOptions.indexOf(rowMonth);
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
                    const ccNivel3 = getName(row[ccNivel3DimKey]);
                    const conta = getName(row[contaDimKey]);
                    const col = getName(row[colDimKey]);
                    uniqueColsSet.add(col);
                    
                    const numVal = getMeasureValueFromRow(row);

                    EvoGAAggregationEngine.addRow(dataMap, { calcNode, ccNivel1, ccNivel2, ccNivel3, conta }, col, numVal);
                });

                if (monthDimKey) {
                    financialData.data.forEach(row => {
                        const calcNode = getName(row[calcDimKey]);
                        const ccNivel1 = getName(row[ccNivel1DimKey]);
                        const ccNivel2 = getName(row[ccNivel2DimKey]);
                        const ccNivel3 = getName(row[ccNivel3DimKey]);
                        const conta = getName(row[contaDimKey]);
                        const col = getName(row[colDimKey]);
                        const month = getName(row[monthDimKey]);
                        const numVal = getMeasureValueFromRow(row);
                        addMonthlyValue(`calc:${calcNode}`, month, col, numVal);
                        addMonthlyValue(`calc:${calcNode}|cc1:${ccNivel1}`, month, col, numVal);
                        addMonthlyValue(`calc:${calcNode}|cc1:${ccNivel1}|cc2:${ccNivel2}`, month, col, numVal);
                        addMonthlyValue(`calc:${calcNode}|cc1:${ccNivel1}|cc2:${ccNivel2}|cc3:${ccNivel3}`, month, col, numVal);
                        addMonthlyValue(`calc:${calcNode}|cc1:${ccNivel1}|cc2:${ccNivel2}|cc3:${ccNivel3}|conta:${conta}`, month, col, numVal);
                    });
                }

                const uniqueCols = Array.from(uniqueColsSet);

                const buildRowMetrics = (name, valuesMap, level = 0, path = []) =>
                    EvoGAAggregationEngine.buildRowMetrics(name, valuesMap, uniqueCols, level, path);

                let tableData = Object.keys(dataMap).map(calcNodeName => {
                    let calcNode = buildRowMetrics(calcNodeName, dataMap[calcNodeName].totals, 0, [calcNodeName]);
                    calcNode.key = `calc:${calcNodeName}`;
                    calcNode.children = Object.keys(dataMap[calcNodeName].ccNivel1).map(ccNivel1 => {
                        let ccNivel1Node = buildRowMetrics(ccNivel1, dataMap[calcNodeName].ccNivel1[ccNivel1].totals, 1, [calcNodeName, ccNivel1]);
                        ccNivel1Node.key = `calc:${calcNodeName}|cc1:${ccNivel1}`;
                        ccNivel1Node.children = Object.keys(dataMap[calcNodeName].ccNivel1[ccNivel1].ccNivel2).map(ccNivel2 => {
                            let ccNivel2Node = buildRowMetrics(ccNivel2, dataMap[calcNodeName].ccNivel1[ccNivel1].ccNivel2[ccNivel2].totals, 2, [calcNodeName, ccNivel1, ccNivel2]);
                            ccNivel2Node.key = `calc:${calcNodeName}|cc1:${ccNivel1}|cc2:${ccNivel2}`;
                            ccNivel2Node.children = Object.keys(dataMap[calcNodeName].ccNivel1[ccNivel1].ccNivel2[ccNivel2].ccNivel3).map(ccNivel3 => {
                                let ccNivel3Node = buildRowMetrics(ccNivel3, dataMap[calcNodeName].ccNivel1[ccNivel1].ccNivel2[ccNivel2].ccNivel3[ccNivel3].totals, 3, [calcNodeName, ccNivel1, ccNivel2, ccNivel3]);
                                ccNivel3Node.key = `calc:${calcNodeName}|cc1:${ccNivel1}|cc2:${ccNivel2}|cc3:${ccNivel3}`;
                                ccNivel3Node.children = Object.keys(dataMap[calcNodeName].ccNivel1[ccNivel1].ccNivel2[ccNivel2].ccNivel3[ccNivel3].contas).map(conta => {
                                    let contaNode = buildRowMetrics(conta, dataMap[calcNodeName].ccNivel1[ccNivel1].ccNivel2[ccNivel2].ccNivel3[ccNivel3].contas[conta], 4, [calcNodeName, ccNivel1, ccNivel2, ccNivel3, conta]);
                                    contaNode.key = `calc:${calcNodeName}|cc1:${ccNivel1}|cc2:${ccNivel2}|cc3:${ccNivel3}|conta:${conta}`;
                                    return contaNode;
                                });
                                ccNivel3Node.children.sort((a, b) => b.valRealizado - a.valRealizado);
                                return ccNivel3Node;
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
                const allNodes = EvoGAAggregationEngine.collectNodes(tableData);
                const monthlyProfileFor = (key) => {
                    const monthMap = monthlyIndex[key] || {};
                    return this._sortMonthOptions(Object.keys(monthMap)).map(month => monthMap[month]);
                };
                const annotateNode = (node) => {
                    (node.children || []).forEach(annotateNode);
                    const trendProfile = EvoGATrendEngine.buildProfile(monthlyProfileFor(node.key));
                    node.trendDirection = trendProfile.trendDirection;
                    node.recurrenceType = trendProfile.recurrenceType;
                    node.recurrenceMonths = trendProfile.recurrenceMonths;
                };
                tableData.forEach(annotateNode);
                EvoGAMaterialityEngine.annotate(allNodes, totalGlobalOrcado, totalGlobalRealizado);

                const departamentos = tableData.flatMap(item =>
                    item.children.flatMap(ccNivel1 =>
                        ccNivel1.children.flatMap(ccNivel2 => ccNivel2.children)
                    )
                );
                const selectedMoMMonth = this._selectedMonth === "__all__" ? monthOptions[monthOptions.length - 1] : this._selectedMonth;
                const selectedMoMMonthIndex = monthOptions.indexOf(selectedMoMMonth);
                const previousMoMMonth = selectedMoMMonthIndex > 0 ? monthOptions[selectedMoMMonthIndex - 1] : null;
                const momOffenderAnalysis = monthDimKey ? EvoGAMoMEngine.buildDepartmentDrivers({
                    rows: financialData.data,
                    currentMonth: selectedMoMMonth,
                    previousMonth: previousMoMMonth,
                    dimensionKeys: {
                        calc: calcDimKey,
                        cc1: ccNivel1DimKey,
                        cc2: ccNivel2DimKey,
                        cc3: ccNivel3DimKey,
                        conta: contaDimKey,
                        version: colDimKey,
                        month: monthDimKey
                    },
                    getName,
                    getMeasureValueFromRow,
                    paretoCoverage: this._paretoCoverage
                }) : { drivers: [], totalMoMDeviation: 0, coverage: 0, excludedRows: 0, currentMonth: null, previousMonth: null };
                const departmentNodeByKey = new Map(departamentos.map(item => [item.key, item]));
                const executiveDrivers = momOffenderAnalysis.drivers.map(driver => {
                    const node = departmentNodeByKey.get(driver.key);
                    return {
                        ...driver,
                        trendDirection: node ? node.trendDirection : driver.trendDirection,
                        recurrenceType: node ? node.recurrenceType : driver.recurrenceType,
                        recurrenceMonths: node ? node.recurrenceMonths : driver.recurrenceMonths
                    };
                });
                const ofensores = executiveDrivers.slice(0, 3);

                ofensores.forEach(item => {
                    const node = departmentNodeByKey.get(item.key);
                    if (node) node.isOfensor = true;
                });

                let ofensoresText = "";
                if (ofensores.length > 0) {
                    const names = ofensores.map(o => escapeHtml(o.name));
                    if (names.length === 1) ofensoresText = ` O principal ofensor que exige atenção é o departamento <strong>${names[0]}</strong>.`;
                    else if (names.length === 2) ofensoresText = ` Os principais ofensores que exigem atenção são <strong>${names[0]}</strong> e <strong>${names[1]}</strong>.`;
                    else ofensoresText = ` Os 3 principais ofensores que exigem atenção são <strong>${names[0]}</strong>, <strong>${names[1]}</strong> e <strong>${names[2]}</strong>.`;
                } else {
                    ofensoresText = " Não foram identificados departamentos operando acima do orçamento.";
                }
                const totalVariancePct = totalGlobalOrcado > 0 ? (totalGlobalDesvio / totalGlobalOrcado) * 100 : 0;
                const executiveNarrative = EvoGANarrativeEngine.build(executiveDrivers, totalGlobalDesvio, totalVariancePct);
                const oversightClass = totalGlobalDesvio > 0 ? "summary-desvio" : "summary-saving";
                const ytdDesvio = ytdTotals.actual - ytdTotals.budget;
                const ytdVariancePct = ytdTotals.budget > 0 ? (ytdDesvio / ytdTotals.budget) * 100 : 0;
                const kpiConsumptionText = totalGlobalOrcado > 0 ? `${((totalGlobalRealizado / totalGlobalOrcado) * 100).toFixed(1)}%` : "-";
                const currentPeriodTotal = totalGlobalRealizado;
                const currentPeriodBudget = totalGlobalOrcado;
                const previousMonthTotals = previousMoMMonth && monthDimKey
                    ? sumRowsByVersion(financialData.data.filter(row => getName(row[monthDimKey]) === previousMoMMonth))
                    : { budget: 0, actual: 0 };
                const realizedMoMAbs = currentPeriodTotal - previousMonthTotals.actual;
                const realizedMoMPct = previousMonthTotals.actual !== 0 ? (realizedMoMAbs / Math.abs(previousMonthTotals.actual)) * 100 : null;
                const realizedMoMClass = realizedMoMAbs > 0 ? "alert" : (realizedMoMAbs < 0 ? "saving" : "neutral");
                const realizedMoMText = realizedMoMPct === null ? "-" : `${realizedMoMPct.toFixed(1)}%`;
                const selectedMonthDisplay = this._selectedMonth === "__all__" ? "Todos os anos" : this._getPeriodDisplayLabel(this._selectedMonth);
                const ytdLabel = this._selectedMonth === "__all__" ? "Base completa disponível" : `YTD até ${selectedMonthDisplay}`;
                const periodLabel = this._selectedMonth === "__all__" ? "Base completa" : selectedMonthDisplay;
                const momPeriodLabel = momOffenderAnalysis.previousMonth && momOffenderAnalysis.currentMonth
                    ? `${this._getPeriodDisplayLabel(momOffenderAnalysis.previousMonth)} → ${this._getPeriodDisplayLabel(momOffenderAnalysis.currentMonth)}`
                    : "MoM indisponível";
                const momCoverageText = `${(momOffenderAnalysis.coverage * 100).toFixed(1)}%`;
                const momTargetCoverageText = `${(this._paretoCoverage * 100).toFixed(0)}%`;
                const driversListHtml = executiveDrivers.length ? executiveDrivers.map((driver, index) => {
                    const driverValueClass = EvoGAUIRenderer.driverValueClass(driver.momVariance);
                    return `
                        <div class="driver-row">
                            <div>
                                <div class="driver-name">${index + 1}. ${escapeHtml(driver.name)}</div>
                                <div class="driver-meta">Departamento · MoM ${escapeHtml(momPeriodLabel)}</div>
                            </div>
                            <div class="driver-metric"><span class="executive-label">Variação MoM</span><span class="driver-value ${driverValueClass}">${formatNumber(Math.abs(driver.momVariance), true, true, driver.momVariance)}</span></div>
                            <div class="driver-metric"><span class="executive-label">Contribuição</span><span class="driver-value ${driverValueClass}">${driver.contributionPct.toFixed(1)}%</span></div>
                            <div class="driver-metric"><span class="executive-label">Desvio atual</span><span class="driver-value">${formatNumber(Math.abs(driver.desvio), true, true, driver.desvio)}</span></div>
                        </div>
                    `;
                }).join("") : `<div class="driver-meta">Não há piora MoM relevante por Departamento no período selecionado.</div>`;
                const diagnosticHtml = `
                    <div class="diagnostic-grid">
                        <div class="executive-section">
                            <div class="section-title">Critérios de Relevância</div>
                            <div class="driver-list">
                                <div class="driver-row"><div class="driver-name">Desvio absoluto</div><div class="driver-metric"><span class="driver-value ${totalGlobalDesvio > 0 ? "driver-value-alert" : "driver-value-saving"}">${formatNumber(Math.abs(totalGlobalDesvio), true, true, totalGlobalDesvio)}</span></div><div class="driver-meta">Realizado - Orçado</div><div></div></div>
                                <div class="driver-row"><div class="driver-name">Desvio percentual</div><div class="driver-metric"><span class="driver-value ${totalGlobalDesvio > 0 ? "driver-value-alert" : "driver-value-saving"}">${totalVariancePct.toFixed(1)}%</span></div><div class="driver-meta">Sobre orçamento G&A</div><div></div></div>
                                <div class="driver-row"><div class="driver-name">Consumo do orçamento</div><div class="driver-metric"><span class="driver-value">${escapeHtml(kpiConsumptionText)}</span></div><div class="driver-meta">Realizado / Orçado</div><div></div></div>
                                <div class="driver-row"><div class="driver-name">Ofensores MoM considerados</div><div class="driver-metric"><span class="driver-value">${executiveDrivers.length}</span></div><div class="driver-meta">Alvo ${escapeHtml(momTargetCoverageText)} · cobertura ${escapeHtml(momCoverageText)}</div><div></div></div>
                                <div class="driver-row"><div class="driver-name">Piora MoM total analisada</div><div class="driver-metric"><span class="driver-value driver-value-alert">${formatNumber(Math.abs(momOffenderAnalysis.totalMoMDeviation), true, true, momOffenderAnalysis.totalMoMDeviation)}</span></div><div class="driver-meta">${escapeHtml(momPeriodLabel)}</div><div></div></div>
                            </div>
                        </div>
                        <div class="executive-section">
                            <div class="section-title">Leitura Operacional</div>
                            <div class="driver-list">
                                <div class="driver-row"><div class="driver-name">Linhas SAC analisadas</div><div class="driver-metric"><span class="driver-value">${financialData.data.length}</span></div><div class="driver-meta">Filtradas: ${rowsForRender.length}</div><div></div></div>
                                <div class="driver-row"><div class="driver-name">Ruído operacional ocultado</div><div class="driver-metric"><span class="driver-value">${departamentos.filter(item => item.isExecutiveNoise).length}</span></div><div class="driver-meta">Critério 2%, R$100k e baixa materialidade</div><div></div></div>
                                <div class="driver-row"><div class="driver-name">Linhas excluídas dos ofensores</div><div class="driver-metric"><span class="driver-value">${momOffenderAnalysis.excludedRows}</span></div><div class="driver-meta">${escapeHtml(EVO_GA_MOM_OFFENDER_CONFIG.excludedTerms.join(", "))}</div><div></div></div>
                                <div class="driver-row"><div class="driver-name">Tendência principal</div><div class="driver-metric"><span class="driver-value">${executiveDrivers[0] ? escapeHtml(EvoGATrendEngine.formatTrend(executiveDrivers[0].trendDirection)) : "-"}</span></div><div class="driver-meta">${executiveDrivers[0] ? escapeHtml(EvoGATrendEngine.formatRecurrence(executiveDrivers[0].recurrenceType)) : "Sem ofensor material"}</div><div></div></div>
                            </div>
                        </div>
                    </div>
                `;

                this._profiler.metrics.steps.aggregation = this._profiler._now() - tAggregationStart;
                const tDOMStart = this._profiler._now();
                const selectedYear = this._selectedMonth === "__all__" ? null : this._getPeriodYear(this._selectedMonth);
                const periodsByYear = monthOptions.reduce((acc, month) => {
                    const year = this._getPeriodYear(month);
                    if (!acc[year]) acc[year] = [];
                    acc[year].push(month);
                    return acc;
                }, {});
                const yearKeys = Object.keys(periodsByYear).sort((a, b) => {
                    if (a === "Sem ano") return 1;
                    if (b === "Sem ano") return -1;
                    return String(a).localeCompare(String(b), "pt-BR");
                });
                const yearTreeHtml = yearKeys.map(year => {
                    const isExpanded = selectedYear === year || this._selectedMonth === "__all__";
                    const monthsHtml = periodsByYear[year].map(month =>
                        `<div class="tree-month-item ${this._selectedMonth === month ? "selected" : ""}" data-month-value="${escapeHtml(month)}">${escapeHtml(this._getPeriodDisplayLabel(month))}</div>`
                    ).join("");
                    return `
                        <div class="tree-year-node ${isExpanded ? "expanded" : ""}">${year === "Sem ano" ? "Períodos" : `Ano ${escapeHtml(year)}`}</div>
                        <div class="tree-months-container ${isExpanded ? "show" : ""}">
                            ${monthsHtml}
                        </div>
                    `;
                }).join("");
                const monthItemsHtml = `
                    <div class="tree-month-item ${this._selectedMonth === "__all__" ? "selected" : ""}" data-month-value="__all__">Todos os anos</div>
                    ${yearTreeHtml}
                `;
                const selectedMonthLabel = this._selectedMonth === "__all__" ? "Todos os anos" : this._getPeriodDisplayLabel(this._selectedMonth);
                const monthDisabledClass = monthOptions.length ? "" : "disabled";

                headerContainer.innerHTML = `
                    <div class="header-top">
                        <h1 class="table-title">G&A Executive Oversight Engine</h1>
                        <div class="header-actions">
                            <button class="telemetry-btn" id="telemetryBtn" type="button">Telemetria</button>
                        </div>
                    </div>
                    <div class="filter-container-finance">
                        <span class="filter-label-finance">Mês de análise:</span>
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
                    else if (level === 3) rowClass = "row-cc row-cc-nivel-3";
                    let expandClass = (hasChildren && this._expandedRows.has(rowObj.key)) ? "expanded" : "";
                    let dataAttr = hasChildren ? `data-node-key="${escapeHtml(rowObj.key)}"` : "";
                    
                    let html = `<tr class="${rowClass} ${expandClass}" ${dataAttr}>`;
                    
                    let flagHtml = (level === 3 && rowObj.isOfensor) ? `<span class="ofensor-flag" title="Entre os 3 maiores ofensores do período">⚠️</span>` : "";
                    let safeName = escapeHtml(rowObj.name);
                    let nameCell = level === 4 ? safeName : `<span class="expand-icon">▶</span>${safeName}${flagHtml}`;
                    
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
                    if (rowObj.executiveSeverity === "Acima" || rowObj.executiveSeverity === "Sem orçamento") barFillClass = "fill-red";
                    else if (rowObj.executiveSeverity === "Atenção" || rowObj.percentConsumption >= 100) barFillClass = "fill-yellow";
                    let consumptionText = rowObj.percentConsumption === Infinity ? "∞" : (rowObj.percentConsumption === 0 ? "-" : formatPercentage(rowObj.percentConsumption));
                    
                    if(rowObj.valOrcado === 0 && rowObj.valRealizado === 0) barFillWidth = 0;

                    html += `<td class="cell-consumption">
                        <div class="consumption-wrapper">
                            <div class="bar-container"><div class="bar-fill ${barFillClass}" style="width: ${barFillWidth}%;"></div></div>
                            <div class="percent-value">${consumptionText}</div>
                        </div>
                    </td>`;

                    let statusText = rowObj.executiveSeverity || "-";
                    let statusPillClass = EvoGAUIRenderer.statusClass(statusText, normalizeText);
                    if (rowObj.isExecutiveNoise) { statusText = "Baixa"; statusPillClass = "status-baixa"; }

                    let statusTitle = `Desvio ${formatNumber(Math.abs(rowObj.desvio), true, true, rowObj.desvio)} | ${rowObj.variancePct.toFixed(1)}% vs orçamento | ${rowObj.hierarchyLabel}: ${rowObj.name}`;
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
                                        ccNivel2Row.children.forEach(ccNivel3Row => {
                                            if (!hasVisibleSignal(ccNivel3Row, 3)) return;
                                            tableHtml += renderRowHtml(ccNivel3Row, 3);
                                            if (this._expandedRows.has(ccNivel3Row.key)) {
                                                ccNivel3Row.children.forEach(contaRow => {
                                                    if (!hasVisibleSignal(contaRow, 4)) return;
                                                    tableHtml += renderRowHtml(contaRow, 4);
                                                });
                                            }
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
                let totalBarFillClass = totalGlobalDesvio > 0 ? (totalVariancePct >= 10 ? "fill-red" : "fill-yellow") : "fill-green";
                let totalConsumptionText = totalPercentConsumption === Infinity ? "∞" : (totalPercentConsumption === 0 ? "-" : formatPercentage(totalPercentConsumption));
                if(totalGlobalOrcado === 0 && totalGlobalRealizado === 0) totalBarFillWidth = 0;

                let totalStatusText = EvoGAMaterialityEngine.classifyBudgetStatus(totalGlobalOrcado, totalGlobalRealizado, totalGlobalDesvio, totalVariancePct);
                let totalStatusPillClass = EvoGAUIRenderer.statusClass(totalStatusText, normalizeText);

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
                        <div class="executive-kpi primary">
                            <div class="kpi-label">Total Realizado do Período</div>
                            <div class="kpi-value">${formatKpiCurrency(currentPeriodTotal)}</div>
                            <div class="kpi-sub">${escapeHtml(periodLabel)} · consumo ${escapeHtml(kpiConsumptionText)}</div>
                            <div class="kpi-detail-row"><span>Orçado</span><span>${formatKpiCurrency(currentPeriodBudget)}</span></div>
                            <div class="kpi-detail-row"><span>Desvio</span><span>${formatNumber(Math.abs(totalGlobalDesvio), true, true, totalGlobalDesvio)}</span></div>
                        </div>
                        <div class="executive-kpi neutral">
                            <div class="kpi-label">YTD Realizado</div>
                            <div class="kpi-value">${formatKpiCurrency(ytdTotals.actual)}</div>
                            <div class="kpi-sub">${escapeHtml(ytdLabel)}</div>
                            <div class="kpi-detail-row"><span>YTD Orçado</span><span>${formatKpiCurrency(ytdTotals.budget)}</span></div>
                        </div>
                        <div class="executive-kpi ${ytdDesvio > 0 ? "alert" : "saving"}">
                            <div class="kpi-label">YTD Orçado e Desvio</div>
                            <div class="kpi-value">${formatKpiCurrency(ytdTotals.budget)}</div>
                            <div class="kpi-sub">Desvio YTD ${ytdVariancePct.toFixed(1)}%</div>
                            <div class="kpi-detail-row"><span>Variação</span><span>${formatNumber(Math.abs(ytdDesvio), true, true, ytdDesvio)}</span></div>
                        </div>
                        <div class="executive-kpi ${realizedMoMClass}">
                            <div class="kpi-label">Realizado vs Mês Anterior</div>
                            <div class="kpi-value">${escapeHtml(realizedMoMText)}</div>
                            <div class="kpi-sub">${escapeHtml(momPeriodLabel)}</div>
                            <div class="kpi-detail-row"><span>Variação R$</span><span>${formatNumber(Math.abs(realizedMoMAbs), true, true, realizedMoMAbs)}</span></div>
                        </div>
                        <div class="executive-kpi neutral">
                            <div class="kpi-label">Pareto MoM</div>
                            <div class="kpi-value">${executiveDrivers.length}</div>
                            <div class="kpi-sub">departamentos · cobertura ${escapeHtml(momCoverageText)}</div>
                            <div class="kpi-detail-row"><span>Piora MoM</span><span>${formatNumber(Math.abs(momOffenderAnalysis.totalMoMDeviation), true, true, momOffenderAnalysis.totalMoMDeviation)}</span></div>
                        </div>
                    </div>
                    <div class="executive-oversight ${oversightClass}">
                        <div class="executive-headline">
                            <span>${escapeHtml(executiveNarrative.headline)}</span>
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
                        <div class="section-title">Principais Ofensores do Período por Departamento</div>
                        <div class="pareto-control">
                            <div class="pareto-control-header">
                                <div>
                                    <span class="pareto-control-title">Cobertura Pareto MoM</span>
                                    <span class="pareto-control-sub">Quantidade mínima de departamentos para explicar a piora MoM.</span>
                                </div>
                                <output class="pareto-control-value" for="paretoCoverageSlider">${escapeHtml(momTargetCoverageText)}</output>
                            </div>
                            <input class="pareto-slider" id="paretoCoverageSlider" type="range" min="50" max="100" step="5" value="${Math.round(this._paretoCoverage * 100)}" list="paretoCoverageTicks" aria-label="Cobertura Pareto dos ofensores MoM">
                            <datalist id="paretoCoverageTicks">
                                <option value="50"></option>
                                <option value="60"></option>
                                <option value="70"></option>
                                <option value="80"></option>
                                <option value="90"></option>
                                <option value="100"></option>
                            </datalist>
                            <div class="pareto-scale"><span>50%</span><span>60%</span><span>70%</span><span>80%</span><span>90%</span><span>100%</span></div>
                        </div>
                        <div class="driver-list">${driversListHtml}</div>
                    </div>
                    <p class="table-summary ${varianceClass}">
                        No período analisado, observamos um <strong>${varianceType} de R$ ${formattedGlobalDesvio}</strong> em relação ao orçamento planejado. A lista de ofensores considera a piora MoM por Departamento, excluindo IFRS 16, Outros, PBA e Rateio, até cobrir ao menos ${escapeHtml(momTargetCoverageText)} da variação MoM relevante.${ofensoresText}
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

                const paretoSlider = container.querySelector("#paretoCoverageSlider");
                if (paretoSlider) {
                    paretoSlider.addEventListener("input", (event) => {
                        const nextValue = parseInt(event.currentTarget.value, 10);
                        if (!Number.isFinite(nextValue)) return;
                        const nextCoverage = nextValue / 100;
                        if (nextCoverage === this._paretoCoverage) return;
                        this._paretoCoverage = nextCoverage;
                        this.renderTable();
                    });
                }

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
