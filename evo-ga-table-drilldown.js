// Evo GA Executive Oversight Engine v1.4.13 - governed budget oversight.
(function () {
    // =========================================================================
    // CONFIGURACOES GERAIS
    // -------------------------------------------------------------------------
    // Esta area concentra parametros globais e listas de apoio.
    // Manutencoes simples, como mudar o Pareto default ou termos segregados,
    // normalmente comecam aqui.
    // =========================================================================
    const ENABLE_TELEMETRY = true;
    const EVO_GA_MONTH_MAP = {
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
    const EVO_GA_MONTH_TOKENS = Object.keys(EVO_GA_MONTH_MAP);
    const EVO_GA_MONTH_PATTERNS = EVO_GA_MONTH_TOKENS
        .slice()
        .sort((a, b) => b.length - a.length)
        .map(token => ({ token, pattern: new RegExp(`(^|[^A-Z])${token}([^A-Z]|$)`) }));
    const findMonthToken = (normalizedText) => {
        const match = EVO_GA_MONTH_PATTERNS.find(item => item.pattern.test(normalizedText));
        return match ? match.token : null;
    };

    // =========================================================================
    // TELEMETRIA E PERFORMANCE
    // -------------------------------------------------------------------------
    // Mede tempo de processamento, renderizacao, volume de linhas e projecoes de
    // carga. Nao interfere no calculo financeiro; serve para diagnostico.
    // =========================================================================
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

    // =========================================================================
    // HIERARQUIA OFICIAL E PARAMETROS DE NEGOCIO
    // -------------------------------------------------------------------------
    // A hierarquia abaixo descreve como o widget organiza as dimensoes recebidas
    // do SAC. O widget nao cria nova semantica; ele apenas consome essa estrutura.
    // =========================================================================
    const EVO_GA_HIERARCHY = [
        { key: "vp", label: "VP" },
        { key: "diretoria", label: "Diretoria" },
        { key: "departamentoGerencia", label: "Departamento/Gerência" },
        { key: "conta", label: "Conta Contábil" }
    ];

    const EVO_GA_MATERIALITY_CONFIG = {
        minimumMaterialityThreshold: 0.20,
        noiseVariancePct: 2,
        noiseVarianceAbs: 100000
    };

    const EVO_GA_BUDGET_OFFENDER_CONFIG = {
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

    // =========================================================================
    // TREND ENGINE
    // -------------------------------------------------------------------------
    // Analisa a serie temporal disponivel para indicar deterioracao, melhora,
    // estabilidade e recorrencia. Usa somente os valores recebidos do SAC.
    // =========================================================================
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

    // =========================================================================
    // AGREGACAO FINANCEIRA
    // -------------------------------------------------------------------------
    // Soma Realizado, Orcado, Desvio e Consumo para cada nivel da hierarquia.
    // Esta e a base para as tabelas, KPIs e leituras executivas.
    // =========================================================================
    class EvoGAAggregationEngine {
        static addValue(valuesMap, col, value) {
            valuesMap[col] = (valuesMap[col] || 0) + value;
        }

        static addRow(dataMap, rowContext, col, value) {
            const { calcNode, ccNivel1, ccNivel2, conta } = rowContext;
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

            EvoGAAggregationEngine.addValue(dataMap[calcNode].ccNivel1[ccNivel1].ccNivel2[ccNivel2].contas[conta], col, value);
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

    // =========================================================================
    // MATERIALIDADE E STATUS ORCAMENTARIO
    // -------------------------------------------------------------------------
    // Calcula relevancia do desvio e separa ruido operacional de sinal executivo.
    // Nao classifica contas por natureza; usa apenas magnitude e representatividade.
    // =========================================================================
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

        static classifyYtdStatus(ytdBudget, ytdActual, annualBudget, annualConsumptionPct) {
            const ytdDesvio = ytdActual - ytdBudget;
            const ytdVariancePct = ytdBudget > 0 ? (ytdDesvio / ytdBudget) * 100 : (ytdActual > 0 ? Infinity : 0);
            if (annualBudget <= 0 && ytdActual > 0) return "Crítico";
            if (annualConsumptionPct >= 100 || ytdVariancePct >= 10) return "Crítico";
            if (ytdDesvio > 0) return "Atenção";
            return "Aderente";
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
                node.executiveSeverity = EvoGAMaterialityEngine.classifyBudgetStatus(node.valOrcado, node.valRealizado, varianceAbs, variancePct);
                node.isExecutiveNoise =
                    Math.abs(variancePct) < EVO_GA_MATERIALITY_CONFIG.noiseVariancePct &&
                    Math.abs(varianceAbs) < EVO_GA_MATERIALITY_CONFIG.noiseVarianceAbs &&
                    materialityScore < EVO_GA_MATERIALITY_CONFIG.minimumMaterialityThreshold;
            });
        }
    }

    // =========================================================================
    // PARETO DE OFENSORES DO ORCAMENTO
    // -------------------------------------------------------------------------
    // Seleciona os itens de Departamento/Gerencia que explicam o percentual definido do desvio
    // positivo do periodo. IFRS 16, Outros, PBA e Rateio ficam fora da tabela e
    // sao apresentados no bloco "Efeito segregado fora do Pareto".
    // =========================================================================
    class EvoGABudgetOffenderEngine {
        static _normalize(value) {
            return String(value || "")
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toUpperCase()
                .trim();
        }

        static _matchExcludedTerm(values) {
            const text = values.map(value => EvoGABudgetOffenderEngine._normalize(value)).join(" | ");
            return EVO_GA_BUDGET_OFFENDER_CONFIG.excludedTerms.find(term => text.includes(EvoGABudgetOffenderEngine._normalize(term))) || null;
        }

        static _emptyPeriod() {
            return { budget: 0, actual: 0 };
        }

        static _addVersionValue(target, versionName, value) {
            const version = EvoGABudgetOffenderEngine._normalize(versionName);
            if (version.includes("ORCADO")) target.budget += value;
            else if (version.includes("REALIZADO")) target.actual += value;
        }

        static buildDepartmentDrivers(config) {
            const {
                rows,
                currentMonth,
                previousMonth,
                facts,
                dimensionKeys,
                getName,
                getMeasureValueFromRow,
                paretoCoverage
            } = config;
            const targetCoverage = Number.isFinite(paretoCoverage) ? paretoCoverage : EVO_GA_BUDGET_OFFENDER_CONFIG.paretoCoverage;

            if ((!rows && !facts) || (!facts && !currentMonth)) {
                return {
                    drivers: [],
                    remainingDrivers: [],
                    totalBudgetDeviation: 0,
                    coverage: 0,
                    excludedRows: 0,
                    excludedSummary: { budget: 0, actual: 0, desvio: 0, absDesvio: 0, rows: 0, terms: [] },
                    currentMonth,
                    previousMonth
                };
            }

            const sourceFacts = Array.isArray(facts) ? facts : (rows || []).map(row => ({
                month: getName(row[dimensionKeys.month]),
                calcNode: getName(row[dimensionKeys.calc]),
                ccNivel1: getName(row[dimensionKeys.cc1]),
                ccNivel2: getName(row[dimensionKeys.cc2]),
                conta: getName(row[dimensionKeys.conta]),
                col: getName(row[dimensionKeys.version]),
                value: getMeasureValueFromRow(row)
            }));
            const departmentMap = {};
            const excludedSummary = { budget: 0, actual: 0, rows: 0, termsMap: {} };
            let excludedRows = 0;
            sourceFacts.forEach(fact => {
                const rowMonth = fact.month;
                if (!Array.isArray(facts) && currentMonth && rowMonth !== currentMonth) return;

                const calcNode = fact.calcNode;
                const ccNivel1 = fact.ccNivel1;
                const ccNivel2 = fact.ccNivel2;
                const conta = fact.conta;
                const excludedTerm = EvoGABudgetOffenderEngine._matchExcludedTerm([calcNode, ccNivel1, ccNivel2, conta]);
                if (excludedTerm) {
                    excludedRows++;
                    excludedSummary.rows++;
                    if (!excludedSummary.termsMap[excludedTerm]) {
                        excludedSummary.termsMap[excludedTerm] = { term: excludedTerm, budget: 0, actual: 0, rows: 0 };
                    }
                    excludedSummary.termsMap[excludedTerm].rows++;
                    EvoGABudgetOffenderEngine._addVersionValue(excludedSummary, fact.col, fact.value);
                    EvoGABudgetOffenderEngine._addVersionValue(excludedSummary.termsMap[excludedTerm], fact.col, fact.value);
                    return;
                }

                const key = `calc:${calcNode}|cc1:${ccNivel1}|cc2:${ccNivel2}`;
                if (!departmentMap[key]) {
                    departmentMap[key] = {
                        key,
                        name: ccNivel2,
                        hierarchyLabel: "Departamento/Gerência",
                        current: EvoGABudgetOffenderEngine._emptyPeriod()
                    };
                }

                EvoGABudgetOffenderEngine._addVersionValue(departmentMap[key].current, fact.col, fact.value);
            });

            const allDepartmentDrivers = Object.values(departmentMap).map(item => {
                const currentDesvio = item.current.actual - item.current.budget;
                const percentConsumption = item.current.budget > 0 ? (item.current.actual / item.current.budget) * 100 : (item.current.actual > 0 ? Infinity : 0);
                return {
                    ...item,
                    valOrcado: item.current.budget,
                    valRealizado: item.current.actual,
                    desvio: currentDesvio,
                    budgetVariance: currentDesvio,
                    percentConsumption,
                    variancePct: item.current.budget > 0 ? (currentDesvio / item.current.budget) * 100 : 0,
                    trendDirection: currentDesvio > 0 ? "worsening" : (currentDesvio < 0 ? "improving" : "stable"),
                    recurrenceType: "isolated",
                    recurrenceMonths: currentDesvio > 0 ? 1 : 0,
                    isExecutiveNoise: currentDesvio <= 0
                };
            }).filter(item => Math.abs(item.budgetVariance) > 0);

            const positiveDrivers = allDepartmentDrivers.filter(item => item.budgetVariance > 0);
            const totalBudgetDeviation = positiveDrivers.reduce((sum, item) => sum + item.budgetVariance, 0);
            const sortedDrivers = positiveDrivers.sort((a, b) => b.budgetVariance - a.budgetVariance);
            const selectedDrivers = [];
            let cumulative = 0;
            for (const item of sortedDrivers) {
                if (totalBudgetDeviation <= 0) break;
                cumulative += item.budgetVariance;
                selectedDrivers.push({
                    ...item,
                    contributionPct: (item.budgetVariance / totalBudgetDeviation) * 100,
                    cumulativeContributionPct: (cumulative / totalBudgetDeviation) * 100
                });
                if ((cumulative / totalBudgetDeviation) >= targetCoverage) break;
            }
            const selectedDriverKeys = new Set(selectedDrivers.map(item => item.key));
            const remainingDrivers = allDepartmentDrivers
                .filter(item => !selectedDriverKeys.has(item.key))
                .sort((a, b) => Math.abs(b.budgetVariance) - Math.abs(a.budgetVariance));
            const excludedDesvio = excludedSummary.actual - excludedSummary.budget;
            const excludedTerms = Object.values(excludedSummary.termsMap).map(item => ({
                ...item,
                desvio: item.actual - item.budget,
                absDesvio: Math.abs(item.actual - item.budget)
            })).sort((a, b) => b.absDesvio - a.absDesvio);

            return {
                drivers: selectedDrivers,
                remainingDrivers,
                totalBudgetDeviation,
                coverage: totalBudgetDeviation > 0 ? cumulative / totalBudgetDeviation : 0,
                targetCoverage,
                excludedRows,
                excludedSummary: {
                    budget: excludedSummary.budget,
                    actual: excludedSummary.actual,
                    desvio: excludedDesvio,
                    absDesvio: Math.abs(excludedDesvio),
                    rows: excludedSummary.rows,
                    terms: excludedTerms
                },
                currentMonth,
                previousMonth
            };
        }
    }

    // =========================================================================
    // NARRATIVA EXECUTIVA
    // -------------------------------------------------------------------------
    // Monta os textos do Resumo Executivo: headline, contexto, YTD, principais
    // ofensores e tendencia. Esta camada deve explicar, nao recalcular dados.
    // =========================================================================
    class EvoGANarrativeEngine {
        static build(drivers, totalDesvio, totalPct, context = {}) {
            const driverNames = drivers.slice(0, 3).map(item => item.name);
            const driverText = driverNames.length ? driverNames.join("; ") : "sem concentração material";
            const topDriver = drivers[0];
            const topTrend = topDriver ? EvoGATrendEngine.formatTrend(topDriver.trendDirection) : "estável";
            const trendText = topDriver && topDriver.recurrenceMonths > 0
                ? `${topTrend} por ${topDriver.recurrenceMonths} período(s) recente(s)`
                : topTrend;
            const directionText = totalDesvio > 0 ? "pressão administrativa acima do orçamento" : "aderência orçamentária no período";
            const ytdDesvio = Number(context.ytdDesvio) || 0;
            const ytdVariancePct = Number.isFinite(context.ytdVariancePct) ? context.ytdVariancePct : 0;
            const ytdConsumptionText = context.ytdConsumptionText || "-";
            const ytdLabel = context.ytdLabel || "YTD";
            const ytdDirectionText = ytdDesvio > 0 ? "pressão acumulada" : (ytdDesvio < 0 ? "saving acumulado" : "aderência acumulada");
            const ytdContext = context.ytdBudget > 0
                ? `${ytdLabel}: ${ytdDirectionText} de ${ytdVariancePct.toFixed(1)}% e consumo de ${ytdConsumptionText} do orçamento acumulado.`
                : `${ytdLabel}: sem orçamento acumulado disponível para comparação percentual.`;
            return {
                headline: totalDesvio > 0 ? "DISCIPLINA ORÇAMENTÁRIA G&A: PRESSÃO ACIMA DO PLANEJADO" : "DISCIPLINA ORÇAMENTÁRIA G&A: ADERÊNCIA AO PLANEJADO",
                keyDrivers: `Principais ofensores oficiais: ${driverText}.`,
                rootCause: topDriver ? `A concentração está em Departamento/Gerência ${topDriver.name}, conforme estrutura governada do modelo.` : "Não há vetor oficial dominante com desvio relevante.",
                trend: `Tendência: ${trendText}.`,
                riskAssessment: `Contexto: ${directionText}; variação consolidada de ${totalPct.toFixed(1)}% sobre o orçamento G&A. ${ytdContext}`
            };
        }
    }

    // =========================================================================
    // APOIO VISUAL
    // -------------------------------------------------------------------------
    // Pequenos auxiliares para classes CSS e estados visuais. Mantem as regras
    // de apresentacao fora dos calculos principais.
    // =========================================================================
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

    // =========================================================================
    // TEMPLATE, ESTILOS E ESTRUTURA BASE DO WIDGET
    // -------------------------------------------------------------------------
    // O HTML/CSS abaixo e clonado para cada instancia do custom widget.
    // Alteracoes de fonte, cor, espacamento, cards e abas normalmente ficam aqui.
    // =========================================================================
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
                text-transform: none;
                letter-spacing: 0.1px;
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
                grid-template-columns: 1.35fr 1fr;
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
                grid-template-columns: minmax(0, 1.25fr) repeat(3, minmax(0, 1fr));
                gap: 6px;
                margin-bottom: 8px;
                align-items: stretch;
            }
            .executive-kpi {
                border: 1px solid #E2E8F0;
                border-radius: 5px;
                padding: 7px 8px;
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
                min-height: 76px;
            }
            .executive-kpi.alert { border-left: 4px solid #B91C1C; }
            .executive-kpi.saving { border-left: 4px solid #166534; }
            .executive-kpi.neutral { border-left: 4px solid #64748B; }
            .kpi-detail-row {
                display: flex;
                justify-content: space-between;
                gap: 6px;
                margin-top: 4px;
                padding-top: 4px;
                border-top: 1px solid #E2E8F0;
                font-size: 10.5px;
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
                margin-bottom: 3px;
            }
            .kpi-value {
                font-size: 14px;
                font-weight: 700;
                color: #1e293b;
                font-variant-numeric: tabular-nums;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                line-height: 1.2;
            }
            .executive-kpi.primary .kpi-value {
                font-size: 17px;
            }
            .kpi-sub {
                margin-top: 2px;
                font-size: 10.5px;
                color: #475569;
                font-weight: 600;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
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
            .operational-stack {
                display: grid;
                gap: 12px;
            }
            .operational-section {
                border: 1px solid #E2E8F0;
                border-radius: 6px;
                background: #FFFFFF;
                overflow: auto;
            }
            .operational-section-header {
                display: flex;
                align-items: baseline;
                justify-content: space-between;
                gap: 10px;
                padding: 8px 10px;
                background: #F8FAFC;
                border-bottom: 1px solid #E2E8F0;
                position: sticky;
                top: 0;
                z-index: 20;
            }
            .operational-section-title {
                font-size: 11px;
                font-weight: 700;
                color: #2d3748;
                text-transform: uppercase;
                letter-spacing: 0.45px;
            }
            .operational-section-sub {
                font-size: 10.5px;
                color: #64748b;
                font-weight: 600;
                white-space: nowrap;
            }
            .operational-table-wrap {
                overflow: auto;
            }
            .driver-list { display: grid; gap: 8px; }
            .pareto-control {
                display: grid;
                grid-template-columns: minmax(170px, 1fr) minmax(220px, 260px);
                align-items: center;
                gap: 10px;
                width: min(540px, 100%);
                padding: 7px 9px;
                margin-bottom: 9px;
                border: 1px solid #e2e8f0;
                border-radius: 5px;
                background: #f8fafc;
            }
            .pareto-control-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
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
                min-width: 42px;
                text-align: center;
                color: #1e293b;
                font-weight: 700;
                font-variant-numeric: tabular-nums;
                background: #ffffff;
                border: 1px solid #dbe3ec;
                border-radius: 4px;
                padding: 2px 5px;
            }
            .pareto-slider-wrap {
                display: grid;
                gap: 2px;
                min-width: 0;
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
            .excluded-effect {
                display: grid;
                grid-template-columns: minmax(220px, 1.4fr) repeat(3, minmax(105px, 0.7fr));
                gap: 8px;
                align-items: center;
                margin: 0 0 9px 0;
                padding: 8px 10px;
                border: 1px solid #E2E8F0;
                border-left: 4px solid #64748B;
                border-radius: 6px;
                background: #F8FAFC;
                font-size: 11px;
            }
            .excluded-effect.alert { border-left-color: #B91C1C; }
            .excluded-effect.saving { border-left-color: #166534; }
            .excluded-effect-title {
                font-weight: 700;
                color: #2d3748;
                text-transform: uppercase;
                letter-spacing: 0.45px;
            }
            .excluded-effect-sub {
                margin-top: 2px;
                color: #64748b;
                font-weight: 500;
                line-height: 1.35;
            }
            .excluded-effect-breakdown {
                margin-top: 3px;
                color: #475569;
                font-weight: 600;
                line-height: 1.35;
            }
            .excluded-effect-metric {
                min-width: 0;
                text-align: right;
            }
            .excluded-effect-value {
                display: block;
                color: #1e293b;
                font-size: 12.5px;
                font-weight: 700;
                line-height: 1.25;
                font-variant-numeric: tabular-nums;
                white-space: nowrap;
            }
            .excluded-effect-value.alert { color: #B91C1C; }
            .excluded-effect-value.saving { color: #166534; }
            .budget-detail-controls {
                display: flex;
                align-items: center;
                flex-wrap: wrap;
                gap: 6px;
                margin: 0 0 9px 0;
            }
            .budget-detail-btn {
                min-height: 28px;
                padding: 5px 9px;
                border: 1px solid #D6E0EA;
                border-radius: 4px;
                background: #FFFFFF;
                color: #243443;
                font-size: 11px;
                font-weight: 600;
                line-height: 1.2;
                cursor: pointer;
            }
            .budget-detail-btn:hover {
                border-color: #9FB2C7;
                background: #F8FAFC;
            }
            .budget-detail-btn.active {
                border-color: #1F4E79;
                background: #F4F7FA;
                color: #12344D;
                box-shadow: inset 3px 0 0 #1F4E79;
            }
            .budget-detail-note {
                color: #64748b;
                font-size: 10.5px;
                font-weight: 500;
                line-height: 1.25;
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
            @media (max-width: 900px) {
                .executive-kpi-grid { grid-template-columns: repeat(2, minmax(130px, 1fr)); }
                .executive-kpi.primary { grid-row: auto; grid-column: span 2; }
                .driver-row { grid-template-columns: 1fr; }
                .driver-metric { text-align: left; }
                .excluded-effect { grid-template-columns: 1fr; }
                .excluded-effect-metric { text-align: left; }
                .pareto-control { width: 100%; }
            }
            @media (max-width: 760px) {
                .executive-grid { grid-template-columns: 1fr; }
                .executive-headline { flex-direction: column; gap: 2px; }
                .executive-kpi-grid { grid-template-columns: 1fr; }
                .executive-kpi.primary { grid-column: auto; }
                .pareto-control { grid-template-columns: 1fr; }
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
            .drilldown-table th {
                background-color: #F8FAFC;
                color: #1e293b;
                border-bottom: 1px solid #CBD5E1;
                box-shadow: none;
                vertical-align: middle;
            }
            .drilldown-table .group-header {
                text-align: center;
                color: #1e293b;
                background: #F1F5F9;
                font-size: 10.5px;
                letter-spacing: 0.55px;
                border-bottom: 1px solid #CBD5E1;
            }
            .drilldown-table thead tr:first-child th {
                top: 0;
                z-index: 14;
                background: #F1F5F9;
                text-align: center;
                padding: 9px 10px;
            }
            .drilldown-table thead tr:first-child th:first-child {
                text-align: left;
                vertical-align: middle;
            }
            .drilldown-table thead tr:nth-child(2) th {
                top: 34px;
                z-index: 13;
                background: #F8FAFC;
                border-bottom: 2px solid #CBD5E1;
                text-align: right;
            }
            .drilldown-table thead tr:nth-child(2) th.center { text-align: center; }
            .drilldown-table .ytd-start {
                border-left: 1px solid #CBD5E1;
            }
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

    // =========================================================================
    // COMPONENTE PRINCIPAL DO CUSTOM WIDGET
    // -------------------------------------------------------------------------
    // Controla ciclo de vida, estado interno, filtros, renderizacao e eventos.
    // O SAC chama este componente quando envia ou atualiza os dados.
    // =========================================================================
    class EvoGATable extends HTMLElement {
        constructor() {
            super();
            this._shadowRoot = this.attachShadow({ mode: "open" });
            this._shadowRoot.appendChild(template.content.cloneNode(true));

            // Estado interno da tela: ordenacao, linhas abertas, filtro de mes,
            // aba ativa, percentual do Pareto e caches de texto/periodo.
            this._sortState = { col: null, dir: 'asc' };
            this._expandedRows = new Set();
            this._currentData = null;
            this._selectedMonth = "__all__";
            this._hasManualMonthSelection = false;
            this._activeView = "executive";
            this._paretoCoverage = EVO_GA_BUDGET_OFFENDER_CONFIG.paretoCoverage;
            this._budgetDetailView = "pareto";
            this._isDropdownOpen = false;
            this._normalizeCache = new Map();
            this._periodPartsCache = new Map();
            this._refreshOperationalView = null;
            this._paretoRenderTimer = null;
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
            if (this._paretoRenderTimer) {
                clearTimeout(this._paretoRenderTimer);
                this._paretoRenderTimer = null;
            }
        }

        onCustomWidgetBeforeUpdate() {}

        onCustomWidgetAfterUpdate(changedProperties) {
            // Entrada principal do SAC: quando os dados mudam, o widget guarda a
            // base recebida e refaz a tela.
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
            // Troca entre Resumo Executivo e Drilldown.
            // A guia Drilldown e renderizada sob demanda para preservar performance.
            if (this._activeView === viewName) return;
            this._activeView = viewName;
            const hasRenderedPanels = this._shadowRoot.getElementById("executiveView");
            if (!hasRenderedPanels) {
                this.renderTable();
                return;
            }
            this._shadowRoot.querySelectorAll("[data-view]").forEach(tab => {
                tab.classList.toggle("active", tab.getAttribute("data-view") === viewName);
            });
            this._shadowRoot.querySelectorAll(".view-panel").forEach(panel => {
                panel.classList.toggle("active", panel.id === `${viewName}View`);
            });
            if (viewName === "operational" && this._refreshOperationalView) {
                const operationalView = this._shadowRoot.getElementById("operationalView");
                if (operationalView && !operationalView.innerHTML.trim()) this._refreshOperationalView();
            }
        }

        _toggleDropdownDOM() {
            const dropdownContent = this._shadowRoot.getElementById("treeDropdownContent");
            if (dropdownContent) dropdownContent.classList.toggle("show", this._isDropdownOpen);
        }

        _normalizeText(value) {
            // Normalizacao usada para comparar textos vindos do SAC sem depender
            // de acento, caixa alta/baixa ou espacos extras.
            const cacheKey = String(value || "");
            const cached = this._normalizeCache.get(cacheKey);
            if (cached !== undefined) return cached;
            const normalized = cacheKey
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toUpperCase()
                .trim();
            if (this._normalizeCache.size > 2000) this._normalizeCache.clear();
            this._normalizeCache.set(cacheKey, normalized);
            return normalized;
        }

        _getPeriodParts(value) {
            // Interpreta periodos em formatos comuns do SAC, como Abr/2026,
            // 202604 ou 04/2026. Esse resultado alimenta filtro de mes e YTD.
            const text = String(value || "").trim();
            const cached = this._periodPartsCache.get(text);
            if (cached) return cached;
            const normalized = this._normalizeText(text);
            const compact = normalized.replace(/[^A-Z0-9]/g, "");
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
                const token = findMonthToken(normalized);
                if (token) month = EVO_GA_MONTH_MAP[token];
            }

            const result = { year: year || "Sem ano", month: month || 99, raw: text };
            if (this._periodPartsCache.size > 1000) this._periodPartsCache.clear();
            this._periodPartsCache.set(text, result);
            return result;
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
            // Regra de abertura: se existir dimensao de mes, o default tenta usar
            // o mes anterior ao mes atual. Se nao encontrar, usa o periodo mais recente.
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
            // Controles do cabecalho: dropdown de mes agrupado por ano,
            // troca de abas e abertura da telemetria.
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
            // Evento publico para o SAC/story saber que o usuario alterou
            // o periodo de analise no painel.
            this.dispatchEvent(new CustomEvent("monthFilterChanged", {
                detail: {
                    selectedMonth: this._selectedMonth === "__all__" ? null : this._selectedMonth,
                    isAllMonths: this._selectedMonth === "__all__"
                }
            }));
        }

        _updateTelemetry(tStart, tDOMStart, tEndJS, sourceRows, filteredRows) {
            // Atualiza os numeros exibidos no modal de telemetria.
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
            // Ciclo principal de renderizacao:
            // 1) le metadados do SAC;
            // 2) identifica dimensoes;
            // 3) agrega periodo/YTD;
            // 4) monta Resumo Executivo e Drilldown.
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
                    container.innerHTML = "<div style='padding:10px; color:#D32F2F;'>Adicione 5 dimensões (1. Dimensão Calculada/VP, 2. Diretoria, 3. Departamento/Gerência, 4. Conta Contábil, 5. Orçado/Realizado) e 1 medida. A dimensão de mês é opcional.</div>";
                    return;
                }

                // Identificacao das dimensoes recebidas do SAC.
                // A ordem esperada e: VP > Diretoria > Departamento/Gerencia
                // > Conta > Versao > Mes opcional.
                const getName = (obj) => obj ? (obj.label || obj.description || obj.id || "N/D") : "N/D";
                const normalizeText = (value) => this._normalizeText(value);
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
                    if (findMonthToken(normalized)) return true;
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
                const contaDimKey = orderedWithoutMonth[3];
                const fallbackMonthDimKey = orderedWithoutMonth[4] &&
                    financialData.data.some(row => isMonthLikeMember(getName(row[orderedWithoutMonth[4]])))
                    ? orderedWithoutMonth[4]
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

                const selectedMonthHasFilter = monthDimKey && this._selectedMonth !== "__all__";

                const hierarchyDimKeys = [calcDimKey, ccNivel1DimKey, ccNivel2DimKey, contaDimKey].filter(Boolean);
                if (hierarchyDimKeys.length < EVO_GA_HIERARCHY.length) {
                    container.innerHTML = "<div style='padding:10px; color:#D32F2F;'>Não foi possível identificar a hierarquia oficial VP > Diretoria > Departamento/Gerência > Conta Contábil. Verifique a ordem das dimensões no Builder e a dimensão de versão Orçado/Realizado.</div>";
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
                const isGenericMeasureLabel = (value) => {
                    const normalized = normalizeText(value).replace(/[^A-Z0-9]/g, "");
                    if (!normalized) return true;
                    const genericLabels = new Set([
                        "MONTANTE", "VALOR", "VALUE", "AMOUNT", "MEDIDA", "MEASURE",
                        "QUANTIDADE", "QUANTITY", "QTD", "QTY", "TOTAL"
                    ]);
                    return genericLabels.has(normalized);
                };
                const getSelectedMainStructureLabel = () => {
                    const memberNames = Object.keys(measures)
                        .map(key => {
                            const member = measures[key] || {};
                            return getName(member);
                        })
                        .filter(name => name && name !== "N/D" && !isGenericMeasureLabel(name));
                    const uniqueNames = Array.from(new Set(memberNames));
                    if (uniqueNames.length === 1) return uniqueNames[0];
                    if (uniqueNames.length > 1) return uniqueNames.join(" / ");
                    return "";
                };
                // Conversao de valores e formatacao pt-BR.
                // O SAC pode enviar numero cru ou texto formatado; esta etapa
                // padroniza tudo antes dos calculos.
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
                // Fatos normalizados: cada linha do SAC vira um objeto simples
                // usado por todas as engines. Isso evita reler a estrutura SAC
                // varias vezes durante a renderizacao.
                const monthIndexMap = new Map(monthOptions.map((month, index) => [month, index]));
                const sourceFacts = financialData.data.map(row => {
                    const col = getName(row[colDimKey]);
                    return {
                        calcNode: getName(row[calcDimKey]),
                        ccNivel1: getName(row[ccNivel1DimKey]),
                        ccNivel2: getName(row[ccNivel2DimKey]),
                        conta: getName(row[contaDimKey]),
                        col,
                        normalizedCol: normalizeText(col),
                        month: monthDimKey ? getName(row[monthDimKey]) : null,
                        value: getMeasureValueFromRow(row)
                    };
                });
                const nonSegregatedFactsForTitle = sourceFacts.filter(fact =>
                    !EvoGABudgetOffenderEngine._matchExcludedTerm([fact.calcNode, fact.ccNivel1, fact.ccNivel2, fact.conta])
                );
                const titleFacts = nonSegregatedFactsForTitle.length ? nonSegregatedFactsForTitle : sourceFacts;
                const selectedAccountNames = Array.from(new Set(
                    titleFacts
                        .map(fact => fact.conta)
                        .filter(name => name && name !== "N/D")
                )).sort((a, b) => String(a).localeCompare(String(b), "pt-BR"));
                const selectedMainStructureLabel = getSelectedMainStructureLabel();
                const selectedIndicatorLabel = selectedMainStructureLabel || (selectedAccountNames.length === 1
                    ? selectedAccountNames[0]
                    : (selectedAccountNames.length > 1 ? `${selectedAccountNames.length} contas selecionadas` : "Conta não selecionada"));
                const dynamicWidgetTitle = `Executive Budget - ${selectedIndicatorLabel}`;
                const rowsForRender = selectedMonthHasFilter
                    ? sourceFacts.filter(fact => fact.month === this._selectedMonth)
                    : sourceFacts;
                const selectedMonthIndex = this._selectedMonth === "__all__" ? -1 : (monthIndexMap.has(this._selectedMonth) ? monthIndexMap.get(this._selectedMonth) : -1);
                const selectedPeriod = this._getPeriodParts(this._selectedMonth);
                const selectedHasCalendarPeriod = selectedPeriod.year !== "Sem ano" && selectedPeriod.month >= 1 && selectedPeriod.month <= 12;
                // Recorte YTD: usa todos os meses do mesmo ano ate o mes selecionado.
                const ytdRows = monthDimKey && selectedMonthIndex >= 0
                    ? sourceFacts.filter(fact => {
                        const rowMonth = fact.month;
                        if (selectedHasCalendarPeriod) {
                            const rowPeriod = this._getPeriodParts(rowMonth);
                            return rowPeriod.year === selectedPeriod.year && rowPeriod.month >= 1 && rowPeriod.month <= selectedPeriod.month;
                        }
                        const rowMonthIndex = monthIndexMap.get(rowMonth);
                        return rowMonthIndex >= 0 && rowMonthIndex <= selectedMonthIndex;
                    })
                    : rowsForRender;
                // Orcamento anual: usa todos os meses disponiveis do ano selecionado.
                // O consumo da tabela Drilldown sera Realizado YTD / Orcamento anual.
                const annualRows = monthDimKey && selectedHasCalendarPeriod
                    ? sourceFacts.filter(fact => this._getPeriodParts(fact.month).year === selectedPeriod.year)
                    : sourceFacts;
                const sumRowsByVersion = (rows) => rows.reduce((acc, row) => {
                    if (row.normalizedCol.includes("ORCADO")) acc.budget += row.value;
                    else if (row.normalizedCol.includes("REALIZADO")) acc.actual += row.value;
                    return acc;
                }, { budget: 0, actual: 0 });
                const ytdTotals = sumRowsByVersion(ytdRows);
                const totalAnnualBudget = sumRowsByVersion(annualRows).budget;
                const getFactHierarchyKeys = (fact) => [
                    `calc:${fact.calcNode}`,
                    `calc:${fact.calcNode}|cc1:${fact.ccNivel1}`,
                    `calc:${fact.calcNode}|cc1:${fact.ccNivel1}|cc2:${fact.ccNivel2}`,
                    `calc:${fact.calcNode}|cc1:${fact.ccNivel1}|cc2:${fact.ccNivel2}|conta:${fact.conta}`
                ];
                const annualBudgetByKey = new Map();
                annualRows.forEach(fact => {
                    if (!fact.normalizedCol.includes("ORCADO")) return;
                    getFactHierarchyKeys(fact).forEach(key => {
                        annualBudgetByKey.set(key, (annualBudgetByKey.get(key) || 0) + fact.value);
                    });
                });

                // Montagem da arvore operacional completa:
                // VP > Diretoria > Departamento/Gerencia > Conta.
                // Esta arvore e mais pesada e por isso so e usada na guia Drilldown.
                const buildHierarchyFromFacts = (facts) => {
                    const dataMap = {};
                    const uniqueColsSet = new Set();
                    facts.forEach(fact => {
                        uniqueColsSet.add(fact.col);
                        EvoGAAggregationEngine.addRow(dataMap, {
                            calcNode: fact.calcNode,
                            ccNivel1: fact.ccNivel1,
                            ccNivel2: fact.ccNivel2,
                            conta: fact.conta
                        }, fact.col, fact.value);
                    });

                    const uniqueCols = Array.from(uniqueColsSet);
                    const buildRowMetrics = (name, valuesMap, level = 0, path = []) =>
                        EvoGAAggregationEngine.buildRowMetrics(name, valuesMap, uniqueCols, level, path);

                    const tableData = Object.keys(dataMap).map(calcNodeName => {
                        let calcNode = buildRowMetrics(calcNodeName, dataMap[calcNodeName].totals, 0, [calcNodeName]);
                        calcNode.key = `calc:${calcNodeName}`;
                        calcNode.children = Object.keys(dataMap[calcNodeName].ccNivel1).map(ccNivel1 => {
                            let ccNivel1Node = buildRowMetrics(ccNivel1, dataMap[calcNodeName].ccNivel1[ccNivel1].totals, 1, [calcNodeName, ccNivel1]);
                            ccNivel1Node.key = `calc:${calcNodeName}|cc1:${ccNivel1}`;
                            ccNivel1Node.children = Object.keys(dataMap[calcNodeName].ccNivel1[ccNivel1].ccNivel2).map(ccNivel2 => {
                                let ccNivel2Node = buildRowMetrics(ccNivel2, dataMap[calcNodeName].ccNivel1[ccNivel1].ccNivel2[ccNivel2].totals, 2, [calcNodeName, ccNivel1, ccNivel2]);
                                ccNivel2Node.key = `calc:${calcNodeName}|cc1:${ccNivel1}|cc2:${ccNivel2}`;
                                ccNivel2Node.children = Object.keys(dataMap[calcNodeName].ccNivel1[ccNivel1].ccNivel2[ccNivel2].contas).map(conta => {
                                    let contaNode = buildRowMetrics(conta, dataMap[calcNodeName].ccNivel1[ccNivel1].ccNivel2[ccNivel2].contas[conta], 3, [calcNodeName, ccNivel1, ccNivel2, conta]);
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

                    return { uniqueCols, tableData };
                };

                // Resumo leve por Departamento/Gerencia para o Resumo Executivo.
                // Evita montar a arvore completa quando a tela inicial so precisa
                // dos KPIs e dos principais ofensores.
                const buildDepartmentSummaryFromFacts = (facts) => {
                    const departmentMap = {};
                    const uniqueColsSet = new Set();
                    facts.forEach(fact => {
                        uniqueColsSet.add(fact.col);
                        const key = `calc:${fact.calcNode}|cc1:${fact.ccNivel1}|cc2:${fact.ccNivel2}`;
                        if (!departmentMap[key]) {
                            departmentMap[key] = {
                                key,
                                name: fact.ccNivel2,
                                values: {},
                                path: [fact.calcNode, fact.ccNivel1, fact.ccNivel2]
                            };
                        }
                        EvoGAAggregationEngine.addValue(departmentMap[key].values, fact.col, fact.value);
                    });

                    const uniqueCols = Array.from(uniqueColsSet);
                    return Object.values(departmentMap).map(item => {
                        const node = EvoGAAggregationEngine.buildRowMetrics(item.name, item.values, uniqueCols, 2, item.path);
                        node.key = item.key;
                        return node;
                    });
                };

                if (monthDimKey) {
                    sourceFacts.forEach(fact => {
                        addMonthlyValue(`calc:${fact.calcNode}`, fact.month, fact.col, fact.value);
                        addMonthlyValue(`calc:${fact.calcNode}|cc1:${fact.ccNivel1}`, fact.month, fact.col, fact.value);
                        addMonthlyValue(`calc:${fact.calcNode}|cc1:${fact.ccNivel1}|cc2:${fact.ccNivel2}`, fact.month, fact.col, fact.value);
                        addMonthlyValue(`calc:${fact.calcNode}|cc1:${fact.ccNivel1}|cc2:${fact.ccNivel2}|conta:${fact.conta}`, fact.month, fact.col, fact.value);
                    });
                }

                // Totais consolidados do periodo filtrado.
                const periodTotals = sumRowsByVersion(rowsForRender);
                const totalGlobalOrcado = periodTotals.budget;
                const totalGlobalRealizado = periodTotals.actual;
                
                const totalGlobalDesvio = totalGlobalRealizado - totalGlobalOrcado;
                const varianceType = totalGlobalDesvio > 0 ? "desvio" : "saving";
                const varianceClass = totalGlobalDesvio > 0 ? "summary-desvio" : "summary-saving";
                const formattedGlobalDesvio = formatSummaryNumber(totalGlobalDesvio);
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
                const departamentos = buildDepartmentSummaryFromFacts(rowsForRender);
                departamentos.forEach(annotateNode);
                EvoGAMaterialityEngine.annotate(departamentos, totalGlobalOrcado, totalGlobalRealizado);
                // Cache local da arvore operacional.
                // Expandir linha, ordenar ou trocar aba nao deve recalcular tudo.
                let monthlyHierarchy = null;
                let ytdHierarchy = null;
                const getOperationalHierarchies = () => {
                    if (!monthlyHierarchy) {
                        monthlyHierarchy = buildHierarchyFromFacts(rowsForRender);
                        const allNodes = EvoGAAggregationEngine.collectNodes(monthlyHierarchy.tableData);
                        monthlyHierarchy.tableData.forEach(annotateNode);
                        EvoGAMaterialityEngine.annotate(allNodes, totalGlobalOrcado, totalGlobalRealizado);
                    }
                    if (!ytdHierarchy) {
                        ytdHierarchy = buildHierarchyFromFacts(ytdRows);
                    }
                    return {
                        uniqueCols: monthlyHierarchy.uniqueCols,
                        tableData: monthlyHierarchy.tableData,
                        ytdTableData: ytdHierarchy.tableData
                    };
                };
                // Pareto orcamentario por Departamento/Gerencia.
                // Considera desvio Realizado - Orcado e respeita o percentual do slider.
                const selectedAnalysisMonth = this._selectedMonth === "__all__" ? monthOptions[monthOptions.length - 1] : this._selectedMonth;
                const selectedAnalysisMonthIndex = monthIndexMap.has(selectedAnalysisMonth) ? monthIndexMap.get(selectedAnalysisMonth) : -1;
                const previousAnalysisMonth = selectedAnalysisMonthIndex > 0 ? monthOptions[selectedAnalysisMonthIndex - 1] : null;
                const budgetOffenderAnalysis = EvoGABudgetOffenderEngine.buildDepartmentDrivers({
                    facts: rowsForRender,
                    currentMonth: selectedAnalysisMonth,
                    previousMonth: previousAnalysisMonth,
                    paretoCoverage: this._paretoCoverage
                });
                const departmentNodeByKey = new Map(departamentos.map(item => [item.key, item]));
                const executiveDrivers = budgetOffenderAnalysis.drivers.map(driver => {
                    const node = departmentNodeByKey.get(driver.key);
                    return {
                        ...driver,
                        trendDirection: node ? node.trendDirection : driver.trendDirection,
                        recurrenceType: node ? node.recurrenceType : driver.recurrenceType,
                        recurrenceMonths: node ? node.recurrenceMonths : driver.recurrenceMonths
                    };
                });
                const remainingBudgetDrivers = (budgetOffenderAnalysis.remainingDrivers || []).map(driver => {
                    const node = departmentNodeByKey.get(driver.key);
                    return {
                        ...driver,
                        trendDirection: node ? node.trendDirection : driver.trendDirection,
                        recurrenceType: node ? node.recurrenceType : driver.recurrenceType,
                        recurrenceMonths: node ? node.recurrenceMonths : driver.recurrenceMonths
                    };
                });
                const ofensores = executiveDrivers.slice(0, 3);
                const ofensorKeys = new Set(ofensores.map(item => item.key));

                ofensores.forEach(item => {
                    const node = departmentNodeByKey.get(item.key);
                    if (node) node.isOfensor = true;
                });

                let ofensoresText = "";
                if (ofensores.length > 0) {
                    const names = ofensores.map(o => escapeHtml(o.name));
                    if (names.length === 1) ofensoresText = ` O principal ofensor que exige atenção é <strong>${names[0]}</strong>.`;
                    else if (names.length === 2) ofensoresText = ` Os principais ofensores que exigem atenção são <strong>${names[0]}</strong> e <strong>${names[1]}</strong>.`;
                    else ofensoresText = ` Os 3 principais ofensores que exigem atenção são <strong>${names[0]}</strong>, <strong>${names[1]}</strong> e <strong>${names[2]}</strong>.`;
                } else {
                    ofensoresText = " Não foram identificados itens de Departamento/Gerência operando acima do orçamento.";
                }
                const totalVariancePct = totalGlobalOrcado > 0 ? (totalGlobalDesvio / totalGlobalOrcado) * 100 : 0;
                const ytdDesvio = ytdTotals.actual - ytdTotals.budget;
                const ytdVariancePct = ytdTotals.budget > 0 ? (ytdDesvio / ytdTotals.budget) * 100 : 0;
                const ytdConsumptionText = ytdTotals.budget > 0 ? `${((ytdTotals.actual / ytdTotals.budget) * 100).toFixed(1)}%` : "-";
                const oversightClass = totalGlobalDesvio > 0 ? "summary-desvio" : "summary-saving";
                const kpiConsumptionText = totalGlobalOrcado > 0 ? `${((totalGlobalRealizado / totalGlobalOrcado) * 100).toFixed(1)}%` : "-";
                const previousMonthTotals = previousAnalysisMonth && monthDimKey
                    ? sumRowsByVersion(sourceFacts.filter(fact => fact.month === previousAnalysisMonth))
                    : { budget: 0, actual: 0 };
                const realizedMoMAbs = totalGlobalRealizado - previousMonthTotals.actual;
                const realizedMoMPct = previousMonthTotals.actual !== 0 ? (realizedMoMAbs / Math.abs(previousMonthTotals.actual)) * 100 : null;
                const realizedMoMClass = realizedMoMAbs > 0 ? "alert" : (realizedMoMAbs < 0 ? "saving" : "neutral");
                const realizedMoMText = realizedMoMPct === null ? "-" : `${realizedMoMPct.toFixed(1)}%`;
                const selectedMonthDisplay = this._selectedMonth === "__all__" ? "Todos os anos" : this._getPeriodDisplayLabel(this._selectedMonth);
                const ytdLabel = this._selectedMonth === "__all__" ? "Base completa disponível" : `YTD até ${selectedMonthDisplay}`;
                const periodLabel = this._selectedMonth === "__all__" ? "Base completa" : selectedMonthDisplay;
                const momPeriodLabel = budgetOffenderAnalysis.previousMonth && budgetOffenderAnalysis.currentMonth
                    ? `${this._getPeriodDisplayLabel(budgetOffenderAnalysis.previousMonth)} → ${this._getPeriodDisplayLabel(budgetOffenderAnalysis.currentMonth)}`
                    : "MoM indisponível";
                const executiveNarrative = EvoGANarrativeEngine.build(executiveDrivers, totalGlobalDesvio, totalVariancePct, {
                    ytdDesvio,
                    ytdVariancePct,
                    ytdConsumptionText,
                    ytdBudget: ytdTotals.budget,
                    ytdLabel
                });
                const budgetCoverageText = `${(budgetOffenderAnalysis.coverage * 100).toFixed(1)}%`;
                const paretoTargetCoverageText = `${(this._paretoCoverage * 100).toFixed(0)}%`;
                const visibleParetoDeviation = executiveDrivers.reduce((sum, driver) => sum + driver.budgetVariance, 0);
                const excludedTermsLabel = EVO_GA_BUDGET_OFFENDER_CONFIG.excludedTerms.join(", ");
                // Efeito segregado: estes termos nao entram na tabela de ofensores.
                // Eles aparecem em bloco proprio para nao esconder meses em que o
                // desvio inteiro esta concentrado em IFRS 16, Outros, PBA ou Rateio.
                const excludedSummary = budgetOffenderAnalysis.excludedSummary || { budget: 0, actual: 0, desvio: 0, absDesvio: 0, rows: 0, terms: [] };
                const excludedTermItems = Array.isArray(excludedSummary.terms) ? excludedSummary.terms : [];
                const excludedRowsCount = excludedSummary.rows || budgetOffenderAnalysis.excludedRows || 0;
                const excludedGrossAbs = excludedTermItems.reduce((sum, item) => sum + (Number(item.absDesvio) || 0), 0) || excludedSummary.absDesvio || 0;
                const excludedShareBase = (budgetOffenderAnalysis.totalBudgetDeviation || 0) + excludedGrossAbs;
                const excludedShareText = excludedShareBase > 0 ? `${((excludedGrossAbs / excludedShareBase) * 100).toFixed(1)}%` : "-";
                const excludedValueClass = excludedSummary.desvio > 0 ? "alert" : (excludedSummary.desvio < 0 ? "saving" : "neutral");
                const reconciliationRemainder = totalGlobalDesvio - visibleParetoDeviation - (excludedSummary.desvio || 0);
                const excludedTermsText = excludedTermItems.length
                    ? excludedTermItems.map(item => `${escapeHtml(item.term)} ${formatNumber(Math.abs(item.desvio), true, true, item.desvio)}`).join(" · ")
                    : escapeHtml(excludedTermsLabel);
                const excludedEffectHtml = excludedRowsCount > 0 ? `
                    <div class="excluded-effect ${excludedValueClass}">
                        <div>
                            <div class="excluded-effect-title">Efeito segregado fora do Pareto</div>
                            <div class="excluded-effect-sub">IFRS 16, Outros, PBA e Rateio · ${excludedRowsCount} linhas · peso ${escapeHtml(excludedShareText)} no desvio bruto analisado</div>
                            <div class="excluded-effect-breakdown">${excludedTermsText}</div>
                        </div>
                        <div class="excluded-effect-metric"><span class="executive-label">Realizado</span><span class="excluded-effect-value">${formatKpiCurrency(excludedSummary.actual)}</span></div>
                        <div class="excluded-effect-metric"><span class="executive-label">Orçado</span><span class="excluded-effect-value">${formatKpiCurrency(excludedSummary.budget)}</span></div>
                        <div class="excluded-effect-metric"><span class="executive-label">Desvio</span><span class="excluded-effect-value ${excludedValueClass}">${formatNumber(Math.abs(excludedSummary.desvio), true, true, excludedSummary.desvio)}</span></div>
                    </div>
                ` : `
                    <div class="excluded-effect neutral">
                        <div>
                            <div class="excluded-effect-title">Efeito segregado fora do Pareto</div>
                            <div class="excluded-effect-sub">Sem efeito segregado no período selecionado.</div>
                            <div class="excluded-effect-breakdown">${escapeHtml(excludedTermsLabel)}</div>
                        </div>
                        <div class="excluded-effect-metric"><span class="executive-label">Realizado</span><span class="excluded-effect-value">-</span></div>
                        <div class="excluded-effect-metric"><span class="executive-label">Orçado</span><span class="excluded-effect-value">-</span></div>
                        <div class="excluded-effect-metric"><span class="executive-label">Desvio</span><span class="excluded-effect-value">-</span></div>
                    </div>
                `;
                // Controle de detalhamento: alterna entre Pareto e demais variacoes
                // sem transformar a reconciliacao em mais um conjunto de KPIs.
                const budgetDetailView = this._budgetDetailView === "remaining" ? "remaining" : "pareto";
                const budgetDetailControlsHtml = `
                    <div class="budget-detail-controls" aria-label="Detalhamento dos desvios do orçamento">
                        <button class="budget-detail-btn ${budgetDetailView === "pareto" ? "active" : ""}" type="button" data-budget-detail-view="pareto">Apresentar Departamento/Gerência do Pareto</button>
                        <button class="budget-detail-btn ${budgetDetailView === "remaining" ? "active" : ""}" type="button" data-budget-detail-view="remaining">Apresentar as demais variações</button>
                        <span class="budget-detail-note">Fechamento: Pareto + demais variações + efeito segregado = desvio total Real x Orçado.</span>
                    </div>
                `;
                const buildBudgetDriverRowsHtml = (drivers, mode) => {
                    if (!drivers.length) {
                        if (mode === "remaining") return `<div class="driver-meta">Não há demais variações fora do Pareto no período selecionado.</div>`;
                        return `<div class="driver-meta">${excludedRowsCount > 0 && excludedGrossAbs > 0 ? "O desvio orçamentário relevante do período está concentrado no grupo segregado acima; não há itens adicionais no Pareto." : "Não há desvio orçamentário relevante por Departamento/Gerência no período selecionado."}</div>`;
                    }
                    const shareBase = mode === "remaining" ? Math.abs(reconciliationRemainder) : (budgetOffenderAnalysis.totalBudgetDeviation || 0);
                    return drivers.map((driver, index) => {
                        const driverValueClass = EvoGAUIRenderer.driverValueClass(driver.budgetVariance);
                        const driverConsumptionPct = driver.valOrcado > 0 ? (driver.valRealizado / driver.valOrcado) * 100 : null;
                        const driverConsumptionText = driverConsumptionPct !== null
                            ? formatPercentage(driverConsumptionPct)
                            : (driver.valRealizado > 0 ? "Sem orçamento" : "-");
                        const contributionText = shareBase > 0 ? `${((Math.abs(driver.budgetVariance) / shareBase) * 100).toFixed(1)}%` : "-";
                        return `
                            <div class="driver-row">
                                <div>
                                    <div class="driver-name">${index + 1}. ${escapeHtml(driver.name)}</div>
                                </div>
                                <div class="driver-metric"><span class="executive-label">${mode === "remaining" ? "Variação" : "Desvio orçamento"}</span><span class="driver-value ${driverValueClass}">${formatNumber(Math.abs(driver.budgetVariance), true, true, driver.budgetVariance)}</span></div>
                                <div class="driver-metric"><span class="executive-label">${mode === "remaining" ? "Peso no restante" : "Contribuição"}</span><span class="driver-value ${driverValueClass}">${escapeHtml(contributionText)}</span></div>
                                <div class="driver-metric"><span class="executive-label">Consumo</span><span class="driver-value">${escapeHtml(driverConsumptionText)}</span></div>
                            </div>
                        `;
                    }).join("");
                };
                const visibleBudgetDrivers = budgetDetailView === "remaining" ? remainingBudgetDrivers : executiveDrivers;
                const driversListHtml = buildBudgetDriverRowsHtml(visibleBudgetDrivers, budgetDetailView);
                this._profiler.metrics.steps.aggregation = this._profiler._now() - tAggregationStart;
                const tDOMStart = this._profiler._now();

                // Cabecalho e slicer de mes: agrupa meses por ano e marca o periodo atual.
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
                        <h1 class="table-title">${escapeHtml(dynamicWidgetTitle)}</h1>
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
                // Guia Drilldown: monta uma unica tabela com leitura mensal e MYTD.
                // Fica em funcao separada para permitir refresh leve em ordenacao/expansao.
                const buildOperationalPanelHtml = () => {
                    const { tableData: monthlyTableData, ytdTableData } = getOperationalHierarchies();
                    const monthlyNodeByKey = new Map(EvoGAAggregationEngine.collectNodes(monthlyTableData).map(node => [node.key, node]));
                    const ytdNodeByKey = new Map(EvoGAAggregationEngine.collectNodes(ytdTableData).map(node => [node.key, node]));
                    const emptyMetrics = { valOrcado: 0, valRealizado: 0, desvio: 0, percentConsumption: 0, isExecutiveNoise: true, children: [] };
                    const getMonthlyMetrics = (rowObj) => monthlyNodeByKey.get(rowObj.key) || emptyMetrics;
                    const getYtdMetrics = (rowObj) => ytdNodeByKey.get(rowObj.key) || rowObj || emptyMetrics;
                    const getAnnualBudget = (rowObj) => annualBudgetByKey.get(rowObj.key) || 0;
                    const getYtdConsumptionPct = (rowObj) => {
                        const ytdNode = getYtdMetrics(rowObj);
                        const annualBudget = getAnnualBudget(rowObj);
                        if (annualBudget > 0) return (ytdNode.valRealizado / annualBudget) * 100;
                        return ytdNode.valRealizado > 0 ? Infinity : 0;
                    };
                    const getYtdStatus = (rowObj) => {
                        const ytdNode = getYtdMetrics(rowObj);
                        return EvoGAMaterialityEngine.classifyYtdStatus(
                            ytdNode.valOrcado,
                            ytdNode.valRealizado,
                            getAnnualBudget(rowObj),
                            getYtdConsumptionPct(rowObj)
                        );
                    };
                    const getSortValue = (rowObj) => {
                        const monthlyNode = getMonthlyMetrics(rowObj);
                        const ytdNode = getYtdMetrics(rowObj);
                        const statusRank = { "Aderente": 1, "Atenção": 2, "Crítico": 3 };
                        switch (this._sortState.col) {
                            case "monthlyBudget": return monthlyNode.valOrcado;
                            case "monthlyActual": return monthlyNode.valRealizado;
                            case "monthlyVariance": return monthlyNode.desvio;
                            case "ytdBudget": return ytdNode.valOrcado;
                            case "ytdActual": return ytdNode.valRealizado;
                            case "ytdVariance": return ytdNode.desvio;
                            case "ytdConsumption": return getYtdConsumptionPct(rowObj);
                            case "ytdStatus": return statusRank[getYtdStatus(rowObj)] || 0;
                            case "name":
                            default: return rowObj.name;
                        }
                    };
                    const sortHierarchyRows = (rows) => {
                        if (!this._sortState.col) return;
                        rows.sort((a, b) => {
                            const valA = getSortValue(a);
                            const valB = getSortValue(b);
                            if (typeof valA === "string" && typeof valB === "string") {
                                return this._sortState.dir === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
                            }
                            if (valA < valB) return this._sortState.dir === "asc" ? -1 : 1;
                            if (valA > valB) return this._sortState.dir === "asc" ? 1 : -1;
                            return 0;
                        });
                        rows.forEach(row => sortHierarchyRows(row.children || []));
                    };
                    sortHierarchyRows(ytdTableData);

                    const sortIcon = (col) => this._sortState.col === col ? (this._sortState.dir === "asc" ? " ▲" : " ▼") : "";
                    let tableHtml = `<table class="drilldown-table">
                        <thead>
                            <tr>
                                <th rowspan="2" data-sort="name" class="sortable">${escapeHtml(headerName)}<span class="sort-icon">${sortIcon("name")}</span></th>
                                <th colspan="3" class="group-header">Análise Mensal</th>
                                <th colspan="5" class="group-header ytd-start">Análise MYTD</th>
                            </tr>
                            <tr>
                                <th data-sort="monthlyBudget" class="sortable">Orçado<span class="sort-icon">${sortIcon("monthlyBudget")}</span></th>
                                <th data-sort="monthlyActual" class="sortable">Realizado<span class="sort-icon">${sortIcon("monthlyActual")}</span></th>
                                <th data-sort="monthlyVariance" class="sortable">Variação<span class="sort-icon">${sortIcon("monthlyVariance")}</span></th>
                                <th data-sort="ytdBudget" class="sortable ytd-start">Orçado YTD<span class="sort-icon">${sortIcon("ytdBudget")}</span></th>
                                <th data-sort="ytdActual" class="sortable">Realizado YTD<span class="sort-icon">${sortIcon("ytdActual")}</span></th>
                                <th data-sort="ytdVariance" class="sortable">Variação<span class="sort-icon">${sortIcon("ytdVariance")}</span></th>
                                <th data-sort="ytdConsumption" class="sortable">Consumo<span class="sort-icon">${sortIcon("ytdConsumption")}</span></th>
                                <th data-sort="ytdStatus" class="sortable center">Status<span class="sort-icon">${sortIcon("ytdStatus")}</span></th>
                            </tr>
                        </thead><tbody>`;

                    const renderRowHtml = (rowObj, level = 0) => {
                        const monthlyNode = getMonthlyMetrics(rowObj);
                        const ytdNode = getYtdMetrics(rowObj);
                        const annualBudget = getAnnualBudget(rowObj);
                        const ytdConsumptionPct = getYtdConsumptionPct(rowObj);
                        const statusText = getYtdStatus(rowObj);
                        const hasChildren = rowObj.children && rowObj.children.length > 0;
                        let rowClass = "row-conta";
                        if (level === 0) rowClass = "row-cc";
                        else if (level === 1) rowClass = "row-cc row-cc-nivel-1";
                        else if (level === 2) rowClass = "row-cc row-cc-nivel-2";
                        const expandClass = (hasChildren && this._expandedRows.has(rowObj.key)) ? "expanded" : "";
                        const dataAttr = hasChildren ? `data-node-key="${escapeHtml(rowObj.key)}"` : "";
                        const flagHtml = (level === 2 && ofensorKeys.has(rowObj.key)) ? `<span class="ofensor-flag" title="Entre os 3 maiores ofensores do período">⚠️</span>` : "";
                        const safeName = escapeHtml(rowObj.name);
                        const nameCell = level === 3 ? safeName : `<span class="expand-icon">▶</span>${safeName}${flagHtml}`;
                        const monthlyVarianceClass = monthlyNode.desvio > 0 ? "var-positive" : (monthlyNode.desvio < 0 ? "var-negative" : "");
                        const ytdVarianceClass = ytdNode.desvio > 0 ? "var-positive" : (ytdNode.desvio < 0 ? "var-negative" : "");
                        const barFillWidth = ytdConsumptionPct === Infinity ? 100 : Math.min(100, ytdConsumptionPct || 0);
                        const barFillClass = statusText === "Crítico" ? "fill-red" : (statusText === "Atenção" ? "fill-yellow" : "fill-green");
                        const consumptionText = ytdConsumptionPct === Infinity ? "∞" : (ytdConsumptionPct === 0 ? "-" : formatPercentage(ytdConsumptionPct));
                        const statusPillClass = EvoGAUIRenderer.statusClass(statusText, normalizeText);
                        const ytdVariancePct = ytdNode.valOrcado > 0 ? (ytdNode.desvio / ytdNode.valOrcado) * 100 : 0;
                        const statusTitle = `Status YTD: ${statusText} | Desvio YTD ${formatNumber(Math.abs(ytdNode.desvio), true, true, ytdNode.desvio)} | ${ytdVariancePct.toFixed(1)}% vs orçamento YTD | Consumo ${consumptionText} do orçamento anual | Orçamento anual ${formatNumber(annualBudget)}`;

                        return `<tr class="${rowClass} ${expandClass}" ${dataAttr}>
                            <td>${nameCell}</td>
                            <td class="numeric">${formatNumber(monthlyNode.valOrcado)}</td>
                            <td class="numeric">${formatNumber(monthlyNode.valRealizado)}</td>
                            <td class="numeric cell-variance ${monthlyVarianceClass}">${monthlyNode.desvio !== 0 ? formatNumber(Math.abs(monthlyNode.desvio), true, true, monthlyNode.desvio) : "-"}</td>
                            <td class="numeric ytd-start">${formatNumber(ytdNode.valOrcado)}</td>
                            <td class="numeric">${formatNumber(ytdNode.valRealizado)}</td>
                            <td class="numeric cell-variance ${ytdVarianceClass}">${ytdNode.desvio !== 0 ? formatNumber(Math.abs(ytdNode.desvio), true, true, ytdNode.desvio) : "-"}</td>
                            <td class="cell-consumption">
                                <div class="consumption-wrapper">
                                    <div class="bar-container"><div class="bar-fill ${barFillClass}" style="width: ${barFillWidth}%;"></div></div>
                                    <div class="percent-value">${consumptionText}</div>
                                </div>
                            </td>
                            <td class="center cell-status"><span class="status-pill ${statusPillClass}" title="${escapeHtml(statusTitle)}">${statusText}</span></td>
                        </tr>`;
                    };
                    const hasVisibleSignal = (rowObj, level = 0) => {
                        if (level === 0) return true;
                        const monthlyNode = getMonthlyMetrics(rowObj);
                        if (getYtdStatus(rowObj) !== "Aderente") return true;
                        if (monthlyNode && !monthlyNode.isExecutiveNoise) return true;
                        return (rowObj.children || []).some(child => hasVisibleSignal(child, level + 1));
                    };
                    const appendRows = (rows, level = 0) => {
                        let html = "";
                        rows.forEach(rowObj => {
                            if (!hasVisibleSignal(rowObj, level)) return;
                            html += renderRowHtml(rowObj, level);
                            if (this._expandedRows.has(rowObj.key)) html += appendRows(rowObj.children || [], level + 1);
                        });
                        return html;
                    };
                    tableHtml += appendRows(ytdTableData);

                    const totalYtdConsumptionPct = totalAnnualBudget > 0 ? (ytdTotals.actual / totalAnnualBudget) * 100 : (ytdTotals.actual > 0 ? Infinity : 0);
                    const totalYtdStatus = EvoGAMaterialityEngine.classifyYtdStatus(ytdTotals.budget, ytdTotals.actual, totalAnnualBudget, totalYtdConsumptionPct);
                    const totalMonthlyVarianceClass = totalGlobalDesvio > 0 ? "var-positive" : (totalGlobalDesvio < 0 ? "var-negative" : "");
                    const totalYtdVarianceClass = ytdDesvio > 0 ? "var-positive" : (ytdDesvio < 0 ? "var-negative" : "");
                    const totalBarFillWidth = totalYtdConsumptionPct === Infinity ? 100 : Math.min(100, totalYtdConsumptionPct || 0);
                    const totalBarFillClass = totalYtdStatus === "Crítico" ? "fill-red" : (totalYtdStatus === "Atenção" ? "fill-yellow" : "fill-green");
                    const totalConsumptionText = totalYtdConsumptionPct === Infinity ? "∞" : (totalYtdConsumptionPct === 0 ? "-" : formatPercentage(totalYtdConsumptionPct));
                    const totalStatusPillClass = EvoGAUIRenderer.statusClass(totalYtdStatus, normalizeText);

                    tableHtml += `</tbody><tfoot><tr>
                        <td>TOTAL GERAL</td>
                        <td class="numeric">${formatNumber(totalGlobalOrcado)}</td>
                        <td class="numeric">${formatNumber(totalGlobalRealizado)}</td>
                        <td class="numeric cell-variance ${totalMonthlyVarianceClass}">${totalGlobalDesvio !== 0 ? formatNumber(Math.abs(totalGlobalDesvio), true, true, totalGlobalDesvio) : "-"}</td>
                        <td class="numeric ytd-start">${formatNumber(ytdTotals.budget)}</td>
                        <td class="numeric">${formatNumber(ytdTotals.actual)}</td>
                        <td class="numeric cell-variance ${totalYtdVarianceClass}">${ytdDesvio !== 0 ? formatNumber(Math.abs(ytdDesvio), true, true, ytdDesvio) : "-"}</td>
                        <td class="cell-consumption"><div class="consumption-wrapper"><div class="bar-container"><div class="bar-fill ${totalBarFillClass}" style="width: ${totalBarFillWidth}%;"></div></div><div class="percent-value">${totalConsumptionText}</div></div></td>
                        <td class="center cell-status"><span class="status-pill ${totalStatusPillClass}">${totalYtdStatus}</span></td>
                    </tr></tfoot></table>`;

                    const operationalPanelHtml = `
                        <div class="operational-stack">
                            <section class="operational-section">
                                <div class="operational-section-header">
                                    <span class="operational-section-title">Drilldown</span>
                                    <span class="operational-section-sub">${escapeHtml(periodLabel)} · ${escapeHtml(ytdLabel)} · consumo sobre orçamento anual</span>
                                </div>
                                <div class="operational-table-wrap">${tableHtml}</div>
                            </section>
                        </div>
                    `;
                    return operationalPanelHtml;
                };
                // Refresh leve da guia Drilldown.
                // Usado quando o usuario ordena ou expande linhas sem mudar dados.
                this._refreshOperationalView = () => {
                    const tRefreshStart = this._profiler._now();
                    const operationalView = this._shadowRoot.getElementById("operationalView");
                    if (operationalView) operationalView.innerHTML = buildOperationalPanelHtml();
                    const tRefreshEnd = this._profiler._now();
                    this._profiler.metrics.steps.parsing = 0;
                    this._profiler.metrics.steps.aggregation = 0;
                    this._profiler.metrics.steps.domCreation = tRefreshEnd - tRefreshStart;
                    this._updateTelemetry(tRefreshStart, tRefreshStart, tRefreshEnd, financialData.data.length, rowsForRender.length);
                };
                const operationalPanelHtml = this._activeView === "operational" ? buildOperationalPanelHtml() : "";

                // Guia Resumo Executivo: KPIs, narrativa, Pareto e efeito segregado.
                const executivePanelHtml = `
                    <div class="executive-kpi-grid">
                        <div class="executive-kpi primary">
                            <div class="kpi-label">Total Realizado do Período</div>
                            <div class="kpi-value">${formatKpiCurrency(totalGlobalRealizado)}</div>
                            <div class="kpi-sub">${escapeHtml(periodLabel)} · consumo ${escapeHtml(kpiConsumptionText)}</div>
                            <div class="kpi-detail-row"><span>Orçado</span><span>${formatKpiCurrency(totalGlobalOrcado)}</span></div>
                            <div class="kpi-detail-row"><span>Desvio</span><span>${formatNumber(Math.abs(totalGlobalDesvio), true, true, totalGlobalDesvio)}</span></div>
                        </div>
                        <div class="executive-kpi ${ytdDesvio > 0 ? "alert" : "saving"}">
                            <div class="kpi-label">YTD Consolidado</div>
                            <div class="kpi-value">${formatKpiCurrency(ytdTotals.actual)}</div>
                            <div class="kpi-sub">${escapeHtml(ytdLabel)} · consumo ${escapeHtml(ytdConsumptionText)}</div>
                            <div class="kpi-detail-row"><span>Orçado</span><span>${formatKpiCurrency(ytdTotals.budget)}</span></div>
                            <div class="kpi-detail-row"><span>Variação</span><span>${formatNumber(Math.abs(ytdDesvio), true, true, ytdDesvio)}</span></div>
                        </div>
                        <div class="executive-kpi ${realizedMoMClass}">
                            <div class="kpi-label">Realizado vs Mês Anterior</div>
                            <div class="kpi-value">${escapeHtml(realizedMoMText)}</div>
                            <div class="kpi-sub">${escapeHtml(momPeriodLabel)}</div>
                            <div class="kpi-detail-row"><span>Variação R$</span><span>${formatNumber(Math.abs(realizedMoMAbs), true, true, realizedMoMAbs)}</span></div>
                        </div>
                        <div class="executive-kpi neutral">
                            <div class="kpi-label">Pareto Orçamento</div>
                            <div class="kpi-value">${executiveDrivers.length}</div>
                            <div class="kpi-sub">itens · cobertura ${escapeHtml(budgetCoverageText)}</div>
                            <div class="kpi-detail-row"><span>Desvio Pareto</span><span>${formatNumber(Math.abs(visibleParetoDeviation), true, true, visibleParetoDeviation)}</span></div>
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
                        </div>
                    </div>
                    <div class="executive-section">
                        <div class="section-title">Principais Ofensores do Orçamento por Departamento/Gerência</div>
                        <div class="pareto-control">
                            <div class="pareto-control-header">
                                <div>
                                    <span class="pareto-control-title">Cobertura Pareto Orçamento</span>
                                    <span class="pareto-control-sub">Quantidade mínima de itens para explicar o desvio orçamentário.</span>
                                </div>
                                <output class="pareto-control-value" for="paretoCoverageSlider">${escapeHtml(paretoTargetCoverageText)}</output>
                            </div>
                            <div class="pareto-slider-wrap">
                                <input class="pareto-slider" id="paretoCoverageSlider" type="range" min="50" max="100" step="5" value="${Math.round(this._paretoCoverage * 100)}" list="paretoCoverageTicks" aria-label="Cobertura Pareto dos ofensores orçamentários">
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
                        </div>
                        ${budgetDetailControlsHtml}
                        <div class="driver-list">${driversListHtml}</div>
                        ${excludedEffectHtml}
                    </div>
                    <p class="table-summary ${varianceClass}">
                        No período analisado, observamos um <strong>${varianceType} de R$ ${formattedGlobalDesvio}</strong> em relação ao orçamento planejado. A lista de ofensores considera o desvio orçamentário por Departamento/Gerência, excluindo IFRS 16, Outros, PBA e Rateio, até cobrir ao menos ${escapeHtml(paretoTargetCoverageText)} do desvio relevante.${ofensoresText}
                    </p>
                `;

                container.innerHTML = `
                    <div class="view-tabs">
                        <button class="view-tab ${this._activeView === "executive" ? "active" : ""}" type="button" data-view="executive">Resumo Executivo</button>
                        <button class="view-tab ${this._activeView === "operational" ? "active" : ""}" type="button" data-view="operational">Drilldown</button>
                    </div>
                    <div class="view-panel ${this._activeView === "executive" ? "active" : ""}" id="executiveView">${executivePanelHtml}</div>
                    <div class="view-panel ${this._activeView === "operational" ? "active" : ""}" id="operationalView">${operationalPanelHtml}</div>
                `;
                this._bindHeaderControls(monthOptions, Boolean(monthDimKey));

                // Slider do Pareto: atualiza a cobertura alvo com debounce para evitar
                // renderizacoes excessivas enquanto o usuario arrasta o controle.
                const paretoSlider = container.querySelector("#paretoCoverageSlider");
                if (paretoSlider) {
                    const paretoOutput = container.querySelector(".pareto-control-value");
                    const applyParetoCoverage = (nextValue) => {
                        if (!Number.isFinite(nextValue)) return;
                        const nextCoverage = nextValue / 100;
                        if (nextCoverage === this._paretoCoverage) return;
                        this._paretoCoverage = nextCoverage;
                        this.renderTable();
                    };
                    paretoSlider.addEventListener("input", (event) => {
                        const nextValue = parseInt(event.currentTarget.value, 10);
                        if (!Number.isFinite(nextValue)) return;
                        if (paretoOutput) paretoOutput.textContent = `${nextValue}%`;
                        if (this._paretoRenderTimer) clearTimeout(this._paretoRenderTimer);
                        this._paretoRenderTimer = setTimeout(() => {
                            this._paretoRenderTimer = null;
                            applyParetoCoverage(nextValue);
                        }, 140);
                    });
                    paretoSlider.addEventListener("change", (event) => {
                        const nextValue = parseInt(event.currentTarget.value, 10);
                        if (this._paretoRenderTimer) {
                            clearTimeout(this._paretoRenderTimer);
                            this._paretoRenderTimer = null;
                        }
                        applyParetoCoverage(nextValue);
                    });
                }
                container.querySelectorAll("[data-budget-detail-view]").forEach(button => {
                    button.addEventListener("click", (event) => {
                        const nextView = event.currentTarget.getAttribute("data-budget-detail-view");
                        if (nextView !== "pareto" && nextView !== "remaining") return;
                        if (this._budgetDetailView === nextView) return;
                        this._budgetDetailView = nextView;
                        this.renderTable();
                    });
                });

                // Eventos da tabela: ordenar colunas e abrir/fechar niveis da hierarquia.
                container.onclick = (event) => {
                    const eventTarget = event.target && event.target.nodeType === 1 ? event.target : (event.target ? event.target.parentElement : null);
                    const sortHeader = eventTarget && eventTarget.closest ? eventTarget.closest("th.sortable") : null;
                    if (sortHeader && container.contains(sortHeader)) {
                        const col = sortHeader.getAttribute('data-sort');
                        if (this._sortState.col === col) {
                            this._sortState.dir = this._sortState.dir === 'asc' ? 'desc' : 'asc';
                        } else {
                            this._sortState.col = col;
                            this._sortState.dir = 'asc';
                        }
                        if (this._refreshOperationalView) this._refreshOperationalView();
                        else this.renderTable();
                        return;
                    }

                    const nodeRow = eventTarget && eventTarget.closest ? eventTarget.closest('tr[data-node-key]') : null;
                    if (nodeRow && container.contains(nodeRow)) {
                        const nodeKey = nodeRow.getAttribute('data-node-key');
                        if (this._expandedRows.has(nodeKey)) this._expandedRows.delete(nodeKey);
                        else this._expandedRows.add(nodeKey);
                        if (this._refreshOperationalView) this._refreshOperationalView();
                        else this.renderTable();
                    }
                };

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
