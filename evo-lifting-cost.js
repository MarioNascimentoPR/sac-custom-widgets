// Lifting Cost Executive v1.2.0
// Estrutura visual derivada de evo-ga-table-drilldown.js, de Mario Argolo.
// Contrato: Item financeiro > G4_O > Data > Versão; medida de custo total em BRL.
(function (root) {
    'use strict';
    const VERSION = '1.2.0';
    const TAG = 'evo-lifting-cost-executive';
    const normalize = value => String(value == null ? '' : value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
    const label = cell => String(cell && typeof cell === 'object' ? (cell.label || cell.description || cell.id || 'Não informado') : (cell == null || cell === '' ? 'Não informado' : cell));
    const memberId = cell => String(cell && typeof cell === 'object' && cell.id != null ? cell.id : label(cell));
    const escapeHtml = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
    const monthNames = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const monthTokens = {JAN:1,JANEIRO:1,FEV:2,FEVEREIRO:2,FEB:2,FEBRUARY:2,MAR:3,MARCO:3,MARCH:3,ABR:4,ABRIL:4,APR:4,APRIL:4,MAI:5,MAIO:5,MAY:5,JUN:6,JUNHO:6,JUNE:6,JUL:7,JULHO:7,JULY:7,AGO:8,AGOSTO:8,AUG:8,AUGUST:8,SET:9,SETEMBRO:9,SEP:9,SEPTEMBER:9,OUT:10,OUTUBRO:10,OCT:10,OCTOBER:10,NOV:11,NOVEMBRO:11,NOVEMBER:11,DEZ:12,DEZEMBRO:12,DEC:12,DECEMBER:12};
    function periodKey(value) {
        const text = normalize(value);
        let match = text.match(/^((?:19|20)\d{2})[-/.]?(0[1-9]|1[0-2])(?:[-/.]?(0[1-9]|[12]\d|3[01]))?(?:T.*)?$/);
        if (match) return match[1] + '-' + match[2];
        match = text.match(/^(?:0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.]((?:19|20)\d{2})$/);
        if (match) return match[2] + '-' + match[1].padStart(2,'0');
        match = text.match(/^(0?[1-9]|1[0-2])[-/.]((?:19|20)\d{2})$/);
        if (match) return match[2] + '-' + match[1].padStart(2,'0');
        const year = text.match(/(?:^|\D)((?:19|20)\d{2})(?:\D|$)/);
        const token = text.split(/[^A-Z]+/).find(t => monthTokens[t]);
        if (year && token) return year[1] + '-' + String(monthTokens[token]).padStart(2,'0');
        return null;
    }
    function cellPeriod(cell) {
        const values = cell && typeof cell === 'object' ? [cell.id,cell.label,cell.description] : [cell];
        for (const value of values) { const key = periodKey(value); if (key) return key; }
        return null;
    }
    function numeric(cell) {
        const value = cell && typeof cell === 'object'
            ? (cell.raw != null ? cell.raw : cell.formattedValue) : cell;
        if (value == null || value === '' || value === '-') return null;
        if (typeof value === 'number') {
            if (!Number.isFinite(value)) throw new Error('Há um valor de Lifting Cost inválido na base recebida.');
            return value;
        }
        let text = String(value).trim();
        const parentheses = /^\(.*\)$/.test(text);
        text = text.replace(/(?:R\$|\s|\u00a0)/g,'');
        if (parentheses) text = text.slice(1,-1);
        if (!/^-?\d+(?:[.,]\d+)*$/.test(text)) throw new Error('Valor de Lifting Cost não reconhecido: ' + value + '. Use o valor numérico sem abreviações.');
        if (text.includes(',') && text.includes('.')) {
            text = text.lastIndexOf(',') > text.lastIndexOf('.') ? text.replace(/\./g,'').replace(',','.') : text.replace(/,/g,'');
        } else if (text.includes(',')) {
            text = text.replace(',','.');
        }
        const result = Number(text);
        if (!Number.isFinite(result)) throw new Error('Valor de Lifting Cost não reconhecido: ' + value);
        return parentheses ? -Math.abs(result) : result;
    }
    function versionOf(cell) {
        const values = cell && typeof cell === 'object' ? [cell.label,cell.description,cell.id] : [cell];
        for (const value of values) {
            const token = normalize(value).replace(/^\[|\]$/g,'').split('.').pop();
            if (token === 'ORCADO') return 'budget';
            if (token === 'REALIZADO') return 'actual';
        }
        return null;
    }
    function normalizeData(binding) {
        if (!binding || !Array.isArray(binding.data) || !binding.data.length) return {facts:[],months:[],warnings:[],rowCount:0};
        const dimensions = Object.keys(binding.metadata && binding.metadata.dimensions || {});
        const measures = Object.keys(binding.metadata && binding.metadata.mainStructureMembers || {});
        if (dimensions.length !== 4 || measures.length !== 1) throw new Error('Configure 4 dimensões nesta ordem: Item financeiro, G4_O, Data e Versão; e somente a medida Lifting Cost.');
        const [itemKey,g4Key,dateKey,versionKey] = dimensions;
        const facts = [], ignored = new Set();
        let emptyValues = 0;
        binding.data.forEach((row,index) => {
            const version = versionOf(row[versionKey]);
            if (!version) { ignored.add(label(row[versionKey])); return; }
            const month = cellPeriod(row[dateKey]);
            if (!month) throw new Error('Data não reconhecida na linha ' + (index + 1) + ': ' + label(row[dateKey]) + '. Envie mês e ano, por exemplo 202608 ou Ago/2026.');
            if (row[measures[0]] === undefined) throw new Error('A medida Lifting Cost está ausente em uma linha da base.');
            const value = numeric(row[measures[0]]);
            if (value === null) { emptyValues++; return; }
            const itemId = memberId(row[itemKey]), g4Id = memberId(row[g4Key]);
            facts.push({itemId,g4Id,item:label(row[itemKey]),g4:label(row[g4Key]),month,version,value,
                itemNodeKey:JSON.stringify([itemId]),key:JSON.stringify([itemId,g4Id])});
        });
        if (!facts.length) throw new Error('Não há valores numéricos nas versões Orçado e Realizado. Confira a ordem das dimensões e os nomes das versões.');
        const warnings = [];
        if (ignored.size) warnings.push('Versões não incluídas na comparação: ' + Array.from(ignored).join(', ') + '.');
        if (emptyValues) warnings.push(emptyValues + ' linha(s) sem valor numérico não foram somadas.');
        return {facts,months:Array.from(new Set(facts.map(f => f.month))).sort(),warnings,rowCount:binding.data.length};
    }
    const priorMonth = key => {
        const [year,month] = key.split('-').map(Number);
        return (month === 1 ? year - 1 : year) + '-' + String(month === 1 ? 12 : month - 1).padStart(2,'0');
    };
    function defaultMonth(data,now = new Date()) {
        const target = priorMonth(now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0'));
        const actualMonths = Array.from(new Set(data.facts.filter(f => f.version === 'actual').map(f => f.month))).sort();
        return actualMonths.filter(m => m <= target).pop() || actualMonths.pop() || data.months.filter(m => m <= target).pop() || data.months[data.months.length-1] || null;
    }
    const emptyTotals = () => ({budget:0,actual:0,hasBudget:false,hasActual:false});
    const add = (totals,fact) => { totals[fact.version] += fact.value; totals[fact.version === 'budget' ? 'hasBudget' : 'hasActual'] = true; };
    function totals(facts) { const result = emptyTotals(); facts.forEach(f => add(result,f)); return result; }
    const variance = total => total.actual - total.budget;
    const variancePct = total => total.budget === 0 ? null : variance(total)/Math.abs(total.budget)*100;
    const consumption = total => total.budget > 0 ? total.actual/total.budget*100 : null;
    const comparable = total => total.hasBudget && total.hasActual;
    function status(total,canCompare = comparable(total)) {
        if (!canCompare) return 'Sem comparação';
        if (total.budget === 0 && total.actual > 0) return 'Sem orçamento';
        if (total.budget === 0 && total.actual === 0) return 'Sem movimento';
        return variance(total) > 0 ? 'Acima do orçamento' : 'Dentro do orçamento';
    }
    function aggregate(facts) {
        const result = new Map();
        facts.forEach(f => {
            for (const [key,name,parent] of [[f.itemNodeKey,f.item,null],[f.key,f.g4,f.itemNodeKey]]) {
                if (!result.has(key)) result.set(key,{key,name,parent,item:f.item,values:emptyTotals()});
                add(result.get(key).values,f);
            }
        });
        return result;
    }
    function trendFor(facts,key,selected) {
        if (selected === '__all__') return {label:'Selecione um mês',recurrence:0};
        const byMonth = new Map();
        facts.filter(f => f.key === key && f.month.slice(0,4) === selected.slice(0,4) && f.month <= selected).forEach(f => {
            if (!byMonth.has(f.month)) byMonth.set(f.month,emptyTotals());
            add(byMonth.get(f.month),f);
        });
        let cursor = selected, recurrence = 0;
        while (cursor.slice(0,4) === selected.slice(0,4)) {
            const value = byMonth.get(cursor);
            if (!value || !comparable(value) || variance(value) <= 0) break;
            recurrence++; cursor = priorMonth(cursor);
        }
        const sequence = [priorMonth(priorMonth(selected)),priorMonth(selected),selected].map(m => byMonth.get(m));
        if (sequence.some(t => !t || !comparable(t))) return {label:'Histórico insuficiente',recurrence};
        const [a,b,c] = sequence.map(variance);
        return {label:a < b && b < c ? 'Desvio em alta' : a > b && b > c ? 'Desvio em queda' : 'Sem direção contínua',recurrence};
    }
    function analyze(data,selected,coverage = 0.8) {
        if (!data.months.includes(selected) && selected !== '__all__') throw new Error('O período selecionado não está disponível.');
        const all = selected === '__all__', year = selected.slice(0,4);
        const currentFacts = all ? data.facts : data.facts.filter(f => f.month === selected);
        const ytdFacts = all ? data.facts : data.facts.filter(f => f.month.slice(0,4) === year && f.month <= selected);
        const annualFacts = all ? [] : data.facts.filter(f => f.month.slice(0,4) === year);
        const current = totals(currentFacts), ytd = totals(ytdFacts), annual = totals(annualFacts);
        const previousKey = all ? null : priorMonth(selected);
        const previous = totals(data.facts.filter(f => f.month === previousKey));
        const requiredMonths = all ? data.months : Array.from({length:Number(selected.slice(5))},(_,i)=>year+'-'+String(i+1).padStart(2,'0'));
        const actualYtdMonths = new Set(ytdFacts.filter(f=>f.version==='actual').map(f=>f.month));
        const budgetYtdMonths = new Set(ytdFacts.filter(f=>f.version==='budget').map(f=>f.month));
        const actualYtdComplete = requiredMonths.every(m=>actualYtdMonths.has(m));
        const budgetYtdComplete = requiredMonths.every(m=>budgetYtdMonths.has(m));
        const canCompare = comparable(current) && (!all || (actualYtdComplete && budgetYtdComplete)), canCompareYtd = comparable(ytd) && actualYtdComplete && budgetYtdComplete;
        const monthlyNodes = aggregate(currentFacts), ytdNodes = aggregate(ytdFacts), annualNodes = aggregate(annualFacts);
        const budgetMonths = new Set(annualFacts.filter(f => f.version === 'budget').map(f => f.month));
        const annualComplete = !all && budgetMonths.size === 12;
        const groups = Array.from(monthlyNodes.values()).filter(n => n.parent !== null).map(n => ({
            key:n.key,name:n.name,item:n.item,budget:n.values.budget,actual:n.values.actual,desvio:variance(n.values)
        }));
        const positive = groups.filter(n => n.desvio > 0).sort((a,b) => b.desvio - a.desvio || a.key.localeCompare(b.key));
        const positiveDeviation = positive.reduce((sum,n) => sum+n.desvio,0);
        const target = Math.min(1,Math.max(0.5,Number(coverage)||0.8));
        let covered = 0;
        const drivers = [];
        if (canCompare) for (const group of positive) {
            drivers.push(group); covered += group.desvio;
            if (covered >= positiveDeviation*target) break;
        }
        const selectedKeys = new Set(drivers.map(d => d.key));
        const remaining = canCompare ? groups.filter(n => !selectedKeys.has(n.key) && n.desvio !== 0).sort((a,b) => Math.abs(b.desvio)-Math.abs(a.desvio)) : [];
        const remainingDeviation = remaining.reduce((sum,n) => sum+n.desvio,0);
        const warnings = data.warnings.slice();
        if (all && (!actualYtdComplete || !budgetYtdComplete)) warnings.push('Orçado e Realizado cobrem períodos diferentes na base completa. Selecione um mês com ambas as versões para comparar.');
        if (!current.hasBudget) warnings.push('Orçado não disponível para o período selecionado.');
        if (!current.hasActual) warnings.push('Realizado não disponível para o período selecionado.');
        if (!all) {
            for (const version of ['budget','actual']) {
                const present = new Set(ytdFacts.filter(f => f.version === version).map(f => f.month));
                const missing = [];
                for (let m=1;m<=Number(selected.slice(5));m++) {
                    const key = year+'-'+String(m).padStart(2,'0');
                    if (!present.has(key)) missing.push(monthNames[m-1]);
                }
                if (missing.length) warnings.push('YTD: sem registros de '+(version === 'budget'?'Orçado':'Realizado')+' em '+missing.join(', ')+'. Acumulado calculado sobre os meses recebidos.');
            }
            if (!annualComplete) warnings.push('Consumo do orçamento anual indisponível: a base recebida não contém os 12 meses de Orçado de '+year+'.');
        }
        const trend = drivers.length ? trendFor(data.facts,drivers[0].key,selected) : {label:canCompare?'Sem desvio positivo':'Sem comparação',recurrence:0};
        const momAvailable = !all && current.hasActual && previous.hasActual;
        return {selected,current,ytd,annual,canCompare,canCompareYtd,previousKey,previous,momAvailable,
            momAbs:momAvailable?current.actual-previous.actual:null,
            momPct:momAvailable && previous.actual!==0?(current.actual-previous.actual)/Math.abs(previous.actual)*100:null,
            annualComplete,actualYtdComplete,budgetYtdComplete,monthlyNodes,ytdNodes,annualNodes,drivers,remaining,positiveDeviation,covered,remainingDeviation,
            coverage:positiveDeviation>0 && canCompare?covered/positiveDeviation:0,target,trend,warnings};
    }
    const core = {VERSION,normalizeData,periodKey,numeric,versionOf,defaultMonth,priorMonth,totals,variance,variancePct,consumption,status,analyze};
    if (typeof module === 'object' && module.exports) module.exports = core;
    if (!root.document) return;
    const styles = "\n            :host { \n                display: block; \n                width: 100%; \n                height: 100%; \n                background: #ffffff; \n                box-sizing: border-box;\n                font-family: system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif;\n                --small-font-size: 12px;\n                --body-font-size: 13px;\n                --label-font-size: 10.5px;\n                --enterprise-text: #243443;\n                --enterprise-muted: #64748b;\n                --enterprise-border: #dbe3ec;\n                --surface: #FFFFFF;\n                --surface-soft: #F8FAFC;\n                --surface-muted: #F1F5F9;\n                --border-soft: #E2E8F0;\n                --border-strong: #CBD5E1;\n                --text-strong: #0F172A;\n                --text-main: #334155;\n                --text-muted: #64748B;\n                --accent: #1F4E79;\n                --danger: #B91C1C;\n                --success: #166534;\n                --warning: #B45309;\n                --radius-sm: 4px;\n                --radius-md: 6px;\n                --weight-regular: 400;\n                --weight-medium: 500;\n                --weight-semibold: 600;\n                --weight-emphasis: 650;\n            }\n            #widget-wrapper {\n                display: flex;\n                flex-direction: column;\n                width: 100%;\n                height: 100%;\n                position: relative;\n            }\n            #header-container {\n                padding: 4px 16px 12px 10px; /* Ajuste: 10px na esquerda para alinhar com a tabela */\n                flex-shrink: 0;\n                position: relative;\n                z-index: 3000;\n                overflow: visible;\n            }\n            #table-container {\n                width: 100%;\n                flex-grow: 1;\n                overflow: hidden;\n                display: flex;\n                flex-direction: column;\n                min-height: 0;\n            }\n            .table-title {\n                font-family: system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif;\n                font-size: 14px;\n                font-weight: 700;\n                color: #2c3e50;\n                margin: 0 0 8px 0;\n                text-transform: none;\n                letter-spacing: 0.1px;\n            }\n            .header-top {\n                display: flex;\n                align-items: center;\n                justify-content: space-between;\n                gap: 12px;\n                margin-bottom: 8px;\n            }\n            .header-top .table-title { margin: 0; }\n            .header-actions {\n                display: flex;\n                align-items: center;\n                gap: 8px;\n                flex-shrink: 0;\n            }\n            .filter-container-finance {\n                display: flex;\n                align-items: center;\n                gap: 8px;\n                margin: 0 0 8px 0;\n                position: relative;\n                z-index: 1200;\n                width: fit-content;\n            }\n            .filter-label-finance {\n                font-family: system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif;\n                font-size: var(--small-font-size);\n                font-weight: 600;\n                color: #4A5568;\n            }\n            .tree-dropdown-trigger {\n                min-width: 136px;\n                max-width: 220px;\n                border: 1px solid #CBD5E0;\n                border-radius: 6px;\n                background-color: #F8FAFC;\n                color: #2D3748;\n                font-family: system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif;\n                font-size: var(--small-font-size);\n                font-weight: 700;\n                padding: 5px 28px 5px 10px;\n                cursor: pointer;\n                box-shadow: 0 1px 2px rgba(0,0,0,0.05);\n                background-image: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%234a5568'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E\");\n                background-repeat: no-repeat;\n                background-position: right 8px center;\n                background-size: 12px;\n                user-select: none;\n                text-overflow: ellipsis;\n                white-space: nowrap;\n                overflow: hidden;\n            }\n            .tree-dropdown-trigger.disabled {\n                color: #94A3B8;\n                background: #F8FAFC;\n                cursor: not-allowed;\n            }\n            .tree-dropdown-content {\n                display: none;\n                position: absolute;\n                top: 100%;\n                left: 42px;\n                margin-top: 4px;\n                min-width: 160px;\n                max-height: 260px;\n                overflow-y: auto;\n                background: #ffffff;\n                border: 1px solid #cbd5e0;\n                border-radius: 6px;\n                box-shadow: 0 10px 24px rgba(15, 23, 42, 0.16);\n                z-index: 5000;\n                padding: 6px 0;\n            }\n            .tree-dropdown-content.show { display: block; }\n            .tree-year-node {\n                font-family: system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif;\n                font-size: var(--small-font-size);\n                font-weight: 700;\n                color: #2D3748;\n                padding: 6px 10px;\n                cursor: pointer;\n                display: flex;\n                align-items: center;\n                gap: 6px;\n                user-select: none;\n            }\n            .tree-year-node:hover { background-color: #EDF2F7; }\n            .tree-year-node::before {\n                content: '▶';\n                font-size: 8px;\n                color: #718096;\n                transition: transform 0.2s ease;\n                display: inline-block;\n            }\n            .tree-year-node.expanded::before { transform: rotate(90deg); }\n            .tree-months-container {\n                display: none;\n                flex-direction: column;\n                padding-left: 14px;\n                background: #F7FAFC;\n            }\n            .tree-months-container.show { display: flex; }\n            .tree-month-item {\n                font-family: system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif;\n                font-size: var(--small-font-size);\n                font-weight: 600;\n                color: #4A5568;\n                padding: 6px 12px;\n                cursor: pointer;\n                user-select: none;\n            }\n            .tree-month-item:hover { background-color: #E2E8F0; color: #1F4E79; }\n            .tree-month-item.selected { background-color: #EDF2F7; color: #1F4E79; font-weight: 700; }\n            .telemetry-btn {\n                height: 28px;\n                border: 1px solid #CBD5E0;\n                border-radius: 4px;\n                background: #F1F5F9;\n                color: #475569;\n                font-family: system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif;\n                font-size: var(--small-font-size);\n                font-weight: 700;\n                padding: 0 10px;\n                cursor: pointer;\n            }\n            .telemetry-btn:hover { background: #E2E8F0; color: #1E293B; }\n            .telemetry-modal {\n                display: none;\n                position: absolute;\n                top: 40px;\n                right: 16px;\n                width: 330px;\n                max-width: calc(100% - 32px);\n                background: #FFFFFF;\n                border: 1px solid #E2E8F0;\n                border-radius: 8px;\n                box-shadow: 0 12px 30px rgba(15, 23, 42, 0.14);\n                z-index: 1000;\n                padding: 14px;\n                font-family: system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif;\n                font-size: 12px;\n                color: #334155;\n            }\n            .telemetry-modal.show { display: block; }\n            .telemetry-title {\n                font-size: 12.5px;\n                font-weight: 700;\n                color: #1E293B;\n                margin-bottom: 10px;\n                display: flex;\n                justify-content: space-between;\n                align-items: center;\n                border-bottom: 2px solid #EDF2F7;\n                padding-bottom: 6px;\n                text-transform: uppercase;\n                letter-spacing: 0.5px;\n            }\n            .telemetry-close {\n                background: none;\n                border: none;\n                font-size: 17px;\n                cursor: pointer;\n                color: #94A3B8;\n                font-weight: 700;\n                line-height: 1;\n            }\n            .telemetry-close:hover { color: #64748B; }\n            .telemetry-section-title {\n                font-size: 10.5px;\n                font-weight: 700;\n                color: #475569;\n                text-transform: uppercase;\n                margin: 10px 0 4px 0;\n                background: #F1F5F9;\n                padding: 2px 6px;\n                border-radius: 3px;\n            }\n            .telemetry-row {\n                display: flex;\n                justify-content: space-between;\n                gap: 12px;\n                padding: 5px 0;\n                border-bottom: 1px dashed #F1F5F9;\n                align-items: center;\n            }\n            .telemetry-label { font-weight: 600; color: #64748B; }\n            .telemetry-val {\n                font-weight: 700;\n                color: #1e293b;\n                font-variant-numeric: tabular-nums;\n                background: #F8FAFC;\n                padding: 1px 6px;\n                border-radius: 4px;\n                border: 1px solid #E2E8F0;\n                white-space: nowrap;\n            }\n            .stress-table { width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 11px; }\n            .stress-table th { text-align: left; background: #E2E8F0; color: #334155; padding: 3px 6px; font-weight: 700; }\n            .stress-table td { padding: 4px 6px; border-bottom: 1px solid #EDF2F7; font-weight: 600; }\n            .table-summary {\n                font-family: system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif;\n                font-size: 12.5px; \n                color: #334155;\n                line-height: 1.5;\n                margin: 0;\n                background-color: #F8F9FA;\n                padding: 8px 12px;\n                border-radius: 4px;\n                border-left: 4px solid #CCCCCC;\n            }\n            .table-summary.summary-saving { border-left-color: #2E7D32; }\n            .table-summary.summary-desvio { border-left-color: #D32F2F; }\n            .executive-oversight {\n                font-family: system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif;\n                width: 100%;\n                box-sizing: border-box;\n                margin: 0 0 14px 0;\n                background: var(--surface-soft);\n                border: 1px solid var(--border-soft);\n                border-left: 4px solid var(--text-muted);\n                border-radius: var(--radius-md);\n                padding: 14px 16px;\n                color: var(--text-main);\n            }\n            .executive-oversight.summary-saving { border-left-color: var(--success); }\n            .executive-oversight.summary-desvio { border-left-color: var(--danger); }\n            .executive-headline {\n                display: flex;\n                align-items: baseline;\n                justify-content: space-between;\n                gap: 12px;\n                font-size: 13px;\n                font-weight: var(--weight-emphasis);\n                text-transform: uppercase;\n                letter-spacing: 0.35px;\n                margin-bottom: 12px;\n                color: var(--text-strong);\n            }\n            .executive-grid,\n            .impact-grid {\n                display: grid;\n                grid-template-columns: repeat(3, minmax(0, 1fr));\n                gap: 14px;\n                font-size: 12.5px;\n                line-height: 1.45;\n            }\n            .impact-column {\n                min-width: 0;\n                padding-right: 10px;\n            }\n            .impact-column + .impact-column {\n                border-left: 1px solid var(--border-soft);\n                padding-left: 14px;\n            }\n            .impact-title {\n                display: block;\n                color: var(--text-strong);\n                font-size: 12px;\n                font-weight: var(--weight-semibold);\n                text-transform: uppercase;\n                letter-spacing: 0;\n            }\n            .impact-subtitle {\n                display: block;\n                margin-top: 1px;\n                color: var(--text-muted);\n                font-size: 11.5px;\n                font-weight: var(--weight-medium);\n            }\n            .impact-list {\n                display: grid;\n                gap: 10px;\n                margin-top: 12px;\n            }\n            .impact-metric,\n            .impact-offender,\n            .impact-trend-main {\n                display: flex;\n                align-items: baseline;\n                gap: 8px;\n                min-width: 0;\n            }\n            .impact-signal {\n                flex: 0 0 auto;\n                display: inline-flex;\n                align-items: center;\n                justify-content: center;\n                width: 18px;\n                height: 18px;\n                border-radius: 999px;\n                border: 1px solid var(--border-soft);\n                background: var(--surface);\n                color: var(--text-muted);\n                font-size: 10.5px;\n                font-weight: var(--weight-emphasis);\n                line-height: 1;\n                font-variant-numeric: tabular-nums;\n            }\n            .impact-signal.alert { color: var(--danger); border-color: #FCA5A5; background: #FEF2F2; }\n            .impact-signal.saving { color: var(--success); border-color: #BBF7D0; background: #F0FDF4; }\n            .impact-signal.neutral { color: var(--text-muted); }\n            .impact-signal.info { color: var(--accent); border-color: #BFDBFE; background: #EFF6FF; }\n            .impact-value {\n                color: var(--text-strong);\n                font-size: 14px;\n                font-weight: var(--weight-semibold);\n                line-height: 1.2;\n                font-variant-numeric: tabular-nums;\n            }\n            .impact-value.alert { color: var(--danger); }\n            .impact-value.saving { color: var(--success); }\n            .impact-value.neutral { color: var(--text-strong); }\n            .impact-detail {\n                display: block;\n                margin-top: 2px;\n                color: var(--text-main);\n                font-size: 11.5px;\n                font-weight: var(--weight-regular);\n                line-height: 1.35;\n            }\n            .impact-offender-name {\n                color: var(--text-strong);\n                font-size: 13px;\n                font-weight: var(--weight-semibold);\n                line-height: 1.25;\n            }\n            .impact-note {\n                margin-top: 12px;\n                color: var(--text-main);\n                font-size: 11.5px;\n                font-weight: var(--weight-regular);\n                line-height: 1.4;\n            }\n            .executive-label {\n                display: block;\n                font-size: var(--label-font-size);\n                font-weight: 600;\n                color: #4a5568;\n                text-transform: uppercase;\n                letter-spacing: 0;\n                margin-bottom: 2px;\n            }\n            .executive-text strong { color: #1e293b; font-weight: 700; }\n            .view-tabs {\n                display: inline-flex;\n                align-items: center;\n                align-self: flex-start;\n                gap: 3px;\n                margin: 0 12px 12px 12px;\n                padding: 3px;\n                background: #F1F5F9;\n                border: 1px solid #DBE3EC;\n                border-radius: 7px;\n                flex-shrink: 0;\n            }\n            .view-tab {\n                border: none;\n                background: transparent;\n                color: #475569;\n                font-family: system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif;\n                font-size: var(--small-font-size);\n                font-weight: 700;\n                border-radius: 5px;\n                padding: 6px 11px;\n                cursor: pointer;\n            }\n            .view-tab:hover { background: #E2E8F0; color: #1E293B; }\n            .view-tab.active {\n                background: #FFFFFF;\n                color: #0f172a;\n                box-shadow: 0 1px 3px rgba(15,23,42,0.08);\n            }\n            .view-panel {\n                display: none;\n                padding: 12px;\n                overflow: auto;\n                flex-grow: 1;\n                min-height: 0;\n                font-family: system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif;\n                font-size: var(--body-font-size);\n            }\n            .view-panel.active { display: block; }\n            .executive-kpi-grid {\n                display: grid;\n                grid-template-columns: minmax(0, 1.25fr) repeat(3, minmax(0, 1fr));\n                width: min(1320px, 100%);\n                gap: 14px;\n                margin-bottom: 14px;\n                align-items: stretch;\n            }\n            .executive-kpi {\n                border: 1px solid var(--border-soft);\n                border-radius: var(--radius-md);\n                padding: 9px 12px;\n                background: var(--surface);\n                font-family: system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif;\n                min-width: 0;\n            }\n            .executive-kpi.primary {\n                border-left: 4px solid var(--accent);\n                background: var(--surface-soft);\n                display: flex;\n                flex-direction: column;\n                justify-content: center;\n                min-height: 76px;\n            }\n            .executive-kpi.alert { border-left: 4px solid var(--danger); }\n            .executive-kpi.saving { border-left: 4px solid var(--success); }\n            .executive-kpi.neutral { border-left: 4px solid var(--text-muted); }\n            .kpi-detail-row {\n                display: flex;\n                justify-content: space-between;\n                gap: 6px;\n                margin-top: 4px;\n                padding-top: 4px;\n                border-top: 1px solid var(--border-soft);\n                font-size: 11.5px;\n                color: var(--text-main);\n                font-weight: var(--weight-medium);\n            }\n            .kpi-detail-row span:last-child {\n                color: var(--text-strong);\n                font-weight: var(--weight-semibold);\n                font-variant-numeric: tabular-nums;\n                white-space: nowrap;\n            }\n            .kpi-label {\n                font-size: var(--label-font-size);\n                font-weight: var(--weight-semibold);\n                color: var(--text-muted);\n                text-transform: uppercase;\n                letter-spacing: 0;\n                margin-bottom: 3px;\n            }\n            .kpi-value {\n                font-size: 15px;\n                font-weight: var(--weight-emphasis);\n                color: var(--text-strong);\n                font-variant-numeric: tabular-nums;\n                white-space: nowrap;\n                overflow: hidden;\n                text-overflow: ellipsis;\n                line-height: 1.2;\n            }\n            .executive-kpi.primary .kpi-value {\n                font-size: 18px;\n            }\n            .kpi-sub {\n                margin-top: 2px;\n                font-size: 11.5px;\n                color: var(--text-main);\n                font-weight: var(--weight-medium);\n                white-space: nowrap;\n                overflow: hidden;\n                text-overflow: ellipsis;\n            }\n            .executive-section {\n                border: 1px solid var(--border-soft);\n                border-radius: var(--radius-md);\n                background: var(--surface);\n                padding: 14px 16px;\n                margin-bottom: 12px;\n                font-family: system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif;\n            }\n            .section-title {\n                font-size: 12px;\n                font-weight: var(--weight-emphasis);\n                color: var(--text-strong);\n                text-transform: uppercase;\n                letter-spacing: 0.25px;\n                margin-bottom: 12px;\n            }\n            .operational-stack {\n                display: grid;\n                gap: 12px;\n            }\n            .operational-section {\n                border: 1px solid #E2E8F0;\n                border-radius: 6px;\n                background: #FFFFFF;\n                overflow: auto;\n            }\n            .operational-section-header {\n                display: flex;\n                align-items: baseline;\n                justify-content: space-between;\n                gap: 10px;\n                padding: 8px 10px;\n                background: #F8FAFC;\n                border-bottom: 1px solid #E2E8F0;\n                position: sticky;\n                top: 0;\n                z-index: 20;\n            }\n            .operational-section-title {\n                font-size: 12px;\n                font-weight: 700;\n                color: #2d3748;\n                text-transform: uppercase;\n                letter-spacing: 0.45px;\n            }\n            .operational-section-sub {\n                font-size: 11.5px;\n                color: #64748b;\n                font-weight: 600;\n                white-space: nowrap;\n            }\n            .operational-table-wrap {\n                overflow: auto;\n            }\n            .driver-list { display: grid; gap: 12px; margin-bottom: 16px; }\n            .pareto-control {\n                display: grid;\n                grid-template-columns: minmax(170px, 1fr) minmax(220px, 260px);\n                align-items: center;\n                gap: 12px;\n                width: min(540px, 100%);\n                padding: 8px 10px;\n                margin-bottom: 12px;\n                border: 1px solid var(--border-soft);\n                border-radius: var(--radius-md);\n                background: var(--surface-soft);\n            }\n            .pareto-control-header {\n                display: flex;\n                align-items: center;\n                justify-content: space-between;\n                gap: 10px;\n                font-size: 12px;\n                color: var(--text-main);\n                line-height: 1.35;\n            }\n            .pareto-control-title {\n                font-weight: var(--weight-semibold);\n                color: var(--text-strong);\n                text-transform: uppercase;\n                letter-spacing: 0.45px;\n            }\n            .pareto-control-sub {\n                display: block;\n                margin-top: 1px;\n                color: var(--text-muted);\n                font-weight: var(--weight-medium);\n                text-transform: none;\n                letter-spacing: 0;\n            }\n            .pareto-control-value {\n                min-width: 42px;\n                text-align: center;\n                color: var(--text-strong);\n                font-weight: var(--weight-semibold);\n                font-variant-numeric: tabular-nums;\n                background: var(--surface);\n                border: 1px solid var(--enterprise-border);\n                border-radius: var(--radius-sm);\n                padding: 2px 5px;\n            }\n            .pareto-slider-wrap {\n                display: grid;\n                gap: 2px;\n                min-width: 0;\n            }\n            .pareto-slider {\n                width: 100%;\n                accent-color: var(--accent);\n                cursor: pointer;\n            }\n            .pareto-scale {\n                display: flex;\n                justify-content: space-between;\n                font-size: 10.5px;\n                color: var(--text-muted);\n                font-weight: var(--weight-medium);\n                padding: 0 1px;\n            }\n            .excluded-effect {\n                display: grid;\n                grid-template-columns: 1.35fr minmax(120px, 0.8fr) minmax(96px, 0.65fr) minmax(92px, 0.65fr);\n                gap: 8px;\n                align-items: center;\n                margin: 2px 0 10px 0;\n                padding: 12px 14px;\n                border: 1px solid var(--border-soft);\n                border-left: 4px solid var(--text-muted);\n                border-radius: var(--radius-md);\n                background: var(--surface-soft);\n                font-size: 12px;\n            }\n            .excluded-effect.alert { border-left-color: var(--danger); }\n            .excluded-effect.saving { border-left-color: var(--success); }\n            .excluded-effect > div:first-child,\n            .driver-row > div:first-child {\n                min-width: 0;\n            }\n            .excluded-effect-title {\n                font-weight: var(--weight-semibold);\n                color: var(--text-strong);\n                text-transform: uppercase;\n                letter-spacing: 0.2px;\n            }\n            .excluded-effect-sub {\n                margin-top: 2px;\n                color: var(--text-muted);\n                font-weight: var(--weight-medium);\n                line-height: 1.35;\n            }\n            .excluded-effect-breakdown {\n                margin-top: 3px;\n                color: var(--text-main);\n                font-weight: var(--weight-regular);\n                line-height: 1.35;\n            }\n            .excluded-effect-metric {\n                min-width: 0;\n                text-align: right;\n            }\n            .excluded-effect-value {\n                display: block;\n                color: var(--text-strong);\n                font-size: 13.5px;\n                font-weight: var(--weight-semibold);\n                line-height: 1.25;\n                font-variant-numeric: tabular-nums;\n                white-space: nowrap;\n            }\n            .excluded-effect-value.alert { color: var(--danger); }\n            .excluded-effect-value.saving { color: var(--success); }\n            .budget-detail-controls {\n                display: flex;\n                align-items: center;\n                flex-wrap: wrap;\n                gap: 8px;\n                margin: 0 0 12px 0;\n            }\n            .budget-detail-btn {\n                min-height: 28px;\n                padding: 5px 9px;\n                border: 1px solid var(--enterprise-border);\n                border-radius: var(--radius-sm);\n                background: var(--surface);\n                color: var(--enterprise-text);\n                font-size: 12px;\n                font-weight: var(--weight-medium);\n                line-height: 1.2;\n                cursor: pointer;\n            }\n            .budget-detail-btn:hover {\n                border-color: var(--border-strong);\n                background: var(--surface-soft);\n            }\n            .budget-detail-btn.active {\n                border-color: var(--accent);\n                background: var(--surface-soft);\n                color: var(--accent);\n                box-shadow: inset 3px 0 0 var(--accent);\n            }\n            .budget-detail-note {\n                color: var(--text-muted);\n                font-size: 11.5px;\n                font-weight: var(--weight-regular);\n                line-height: 1.25;\n            }\n            .driver-row {\n                display: grid;\n                grid-template-columns: 1.35fr minmax(120px, 0.8fr) minmax(96px, 0.65fr) minmax(92px, 0.65fr);\n                gap: 10px;\n                align-items: center;\n                font-size: 13px;\n                border: 1px solid var(--border-soft);\n                border-radius: var(--radius-md);\n                padding: 10px 12px;\n                background: var(--surface);\n            }\n            .driver-row:last-child { padding-bottom: 8px; }\n            .driver-name { font-weight: var(--weight-semibold); color: var(--text-strong); line-height: 1.3; }\n            .driver-meta { color: var(--text-main); font-weight: var(--weight-regular); line-height: 1.35; }\n            .driver-metric { min-width: 0; text-align: right; }\n            .driver-value {\n                display: block;\n                color: var(--text-strong);\n                font-size: 13.5px;\n                font-weight: var(--weight-semibold);\n                line-height: 1.25;\n                font-variant-numeric: tabular-nums;\n                white-space: nowrap;\n            }\n            .driver-value-alert { color: var(--danger); }\n            .driver-value-saving { color: var(--success); }\n            .driver-value-neutral { color: var(--text-strong); }\n            @media (max-width: 900px) {\n                .executive-kpi-grid { grid-template-columns: repeat(2, minmax(130px, 1fr)); }\n                .executive-kpi.primary { grid-row: auto; grid-column: span 2; }\n                .impact-grid { grid-template-columns: 1fr; }\n                .impact-column + .impact-column {\n                    border-left: 0;\n                    border-top: 1px solid #E2E8F0;\n                    padding-left: 0;\n                    padding-top: 10px;\n                }\n                .driver-row { grid-template-columns: 1fr; }\n                .driver-metric { text-align: left; }\n                .excluded-effect { grid-template-columns: 1fr; }\n                .excluded-effect-metric { text-align: left; }\n                .pareto-control { width: 100%; }\n            }\n            @media (max-width: 760px) {\n                .executive-grid, .impact-grid { grid-template-columns: 1fr; }\n                .executive-headline { flex-direction: column; gap: 2px; }\n                .executive-kpi-grid { grid-template-columns: 1fr; }\n                .executive-kpi.primary { grid-column: auto; }\n                .pareto-control { grid-template-columns: 1fr; }\n            }\n\n            table { \n                width: 100%; \n                border-collapse: separate; \n                border-spacing: 0;\n                font-family: system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif; \n                table-layout: auto;\n            }\n            th { \n                position: sticky; \n                top: 0;\n                background-color: #F4F6F9; \n                z-index: 10;\n                color: #2d3748; \n                font-size: 12px; \n                font-weight: 700; \n                text-transform: uppercase; \n                letter-spacing: 0.5px; \n                padding: 10px 10px;\n                box-shadow: 0 2px 0 0 #CCCCCC; \n                text-align: right; \n                vertical-align: bottom;\n            }\n            th:first-child { text-align: left; }\n            .drilldown-table th {\n                background-color: #F8FAFC;\n                color: #1e293b;\n                border-bottom: 1px solid #CBD5E1;\n                box-shadow: none;\n                vertical-align: middle;\n            }\n            .drilldown-table .group-header {\n                text-align: center;\n                color: #1e293b;\n                background: #F1F5F9;\n                font-size: 11.5px; \n                letter-spacing: 0.55px;\n                border-bottom: 1px solid #CBD5E1;\n            }\n            .drilldown-table thead tr:first-child th {\n                top: 0;\n                z-index: 14;\n                background: #F1F5F9;\n                text-align: center;\n                padding: 9px 10px;\n            }\n            .drilldown-table thead tr:first-child th:first-child {\n                text-align: left;\n                vertical-align: middle;\n            }\n            .drilldown-table thead tr:nth-child(2) th {\n                top: 34px;\n                z-index: 13;\n                background: #F8FAFC;\n                border-bottom: 2px solid #CBD5E1;\n                text-align: right;\n            }\n            .drilldown-table thead tr:nth-child(2) th.center { text-align: center; }\n            .drilldown-table .ytd-start {\n                border-left: 1px solid #CBD5E1;\n            }\n            th.sortable { cursor: pointer; user-select: none; transition: background 0.2s; }\n            th.sortable:hover { background-color: #E6E9F0; }\n            .sort-icon { font-size: 10.5px; margin-left: 4px; color: #555; }\n            \n            td { \n                padding: 6px 10px; \n                border-bottom: 1px solid #F0F0F0; \n                font-size: 13px; \n                color: #2d3748; \n                vertical-align: middle;\n            }\n            td:first-child { text-align: left; }\n            \n            tr.row-cc { cursor: pointer; transition: background-color 0.15s; }\n            tr.row-cc:hover { background-color: #F8F9FA; }\n            tr.row-cc td:first-child { font-weight: 600; color: #2d3748; }\n            tr.row-cc-nivel-1 td { background-color: #FCFCFC; }\n            tr.row-cc-nivel-1 td:first-child {\n                padding-left: 26px;\n                color: #334155;\n            }\n            tr.row-cc-nivel-2 td { background-color: #FAFAFA; }\n            tr.row-cc-nivel-2 td:first-child {\n                padding-left: 42px;\n                color: #475569;\n            }\n            .expand-icon { \n                display: inline-block; \n                width: 14px; \n                margin-right: 6px; \n                font-size: 10.5px;\n                color: #888; \n                transition: transform 0.2s ease;\n                text-align: center;\n            }\n            tr.row-cc.expanded .expand-icon { transform: rotate(90deg); color: #000; }\n\n            .ofensor-flag {\n                color: #EF6C00; /* Laranja para alertar ofensor (mais harmonioso que vermelho puro) */\n                margin-left: 6px;\n                font-size: 13px;\n                vertical-align: middle;\n                cursor: help;\n            }\n\n            tr.row-conta td { \n                background-color: #FAFAFA; \n                border-bottom: none;\n                padding-top: 3px;\n                padding-bottom: 3px; \n                font-size: 13px;\n            }\n            \n            tr.row-conta:last-child td {\n                border-bottom: 1px solid #F0F0F0;\n            }\n\n            tr.row-conta td:first-child { \n                padding-left: 86px;\n                font-weight: 400; \n                color: #475569; \n                position: relative;\n            }\n            \n            tr.row-conta td:first-child::before { \n                content: '↳'; \n                position: absolute; \n                left: 68px; \n                top: 50%;\n                transform: translateY(-50%);\n                color: #CCCCCC;\n                font-size: 13px;\n            }\n            \n            tfoot td {\n                position: sticky;\n                bottom: 0;\n                background-color: #F4F6F9; \n                z-index: 10;\n                font-weight: 700 !important;\n                color: #2d3748 !important;\n                box-shadow: 0 -2px 0 0 #CCCCCC; \n                border-bottom: none;\n                padding: 10px 10px;\n            }\n            tfoot td:first-child { color: #2d3748 !important; }\n\n            .numeric { text-align: right; font-variant-numeric: tabular-nums; font-weight: 500; }\n            .center { text-align: center; }\n            .var-positive { color: #D32F2F; font-weight: 600; } \n            .var-negative { color: #2E7D32; font-weight: 600; } \n            .cell-variance { white-space: nowrap; }\n\n            .cell-consumption { width: 184px; min-width: 168px; }\n            .consumption-control {\n                display: grid;\n                gap: 4px;\n                min-width: 158px;\n            }\n            .consumption-meta {\n                display: flex;\n                justify-content: space-between;\n                gap: 12px;\n                color: var(--text-muted);\n                font-size: 11px;\n                line-height: 1.2;\n                white-space: nowrap;\n            }\n            .consumption-meta strong {\n                color: var(--text-strong);\n                font-weight: var(--weight-semibold);\n                font-variant-numeric: tabular-nums;\n            }\n            .consumption-track {\n                position: relative;\n                height: 8px;\n                background: var(--surface-muted);\n                border: 1px solid var(--border-strong);\n                border-radius: 4px;\n                overflow: visible;\n            }\n            .consumption-fill {\n                position: absolute;\n                top: 0;\n                left: 0;\n                height: 100%;\n                width: 0%;\n                border-radius: 3px;\n                transition: width 0.3s ease;\n                z-index: 1;\n            }\n            .consumption-fill.ok { background: #1B5E20; }\n            .consumption-fill.watch { background: #92400E; }\n            .consumption-fill.alert { background: #991B1B; }\n            .consumption-target {\n                position: absolute;\n                top: -3px;\n                width: 2px;\n                height: 14px;\n                background: var(--text-strong);\n                border-radius: 1px;\n                transform: translateX(-1px);\n                z-index: 2;\n            }\n\n            .cell-status { text-align: center !important; width: 128px; }\n            \n            .status-pill { \n                display: inline-flex; \n                align-items: center; \n                justify-content: center; \n                padding: 4px 6px; \n                min-width: 86px; \n                box-sizing: border-box; \n                border-radius: 4px; \n                font-size: 11px;\n                font-weight: var(--weight-semibold); \n                text-transform: uppercase; \n                letter-spacing: 0; \n                white-space: nowrap;\n            }\n            .status-abaixo { background-color: #E8F5E9; color: #1B5E20; border: 1px solid #C8E6C9; } \n            .status-atencao { background-color: #FEE2E2; color: #991B1B; border: 1px solid #FCA5A5; } \n            .status-acima { background-color: #FFEBEE; color: #B71C1C; border: 1px solid #FFCDD2; } \n            .status-baixa { background-color: #E8F5E9; color: #1B5E20; border: 1px solid #C8E6C9; }\n            .status-baixo { background-color: #E8F5E9; color: #1B5E20; border: 1px solid #C8E6C9; }\n            .status-moderada { background-color: #FEF3C7; color: #92400E; border: 1px solid #FDE68A; }\n            .status-moderado { background-color: #FEF3C7; color: #92400E; border: 1px solid #FDE68A; }\n            .status-desvio-moderado { background-color: #FEF3C7; color: #92400E; border: 1px solid #FDE68A; }\n            .status-alta { background-color: #FFEBEE; color: #B71C1C; border: 1px solid #FFCDD2; }\n            .status-alto { background-color: #FFEBEE; color: #B71C1C; border: 1px solid #FFCDD2; }\n            .status-aderente { background-color: #E8F5E9; color: #1B5E20; border: 1px solid #C8E6C9; }\n            .status-leve-desvio { background-color: #E8F5E9; color: #1B5E20; border: 1px solid #C8E6C9; }\n            .status-monitorar { background-color: #EFF6FF; color: #1D4ED8; border: 1px solid #BFDBFE; }\n            .status-sem-movimento { background-color: #F1F5F9; color: #475569; border: 1px solid #CBD5E1; }\n            .status-sem-orcamento { background-color: #FFEBEE; color: #B71C1C; border: 1px solid #FFCDD2; }\n        ";
    const currencyFormat = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:2,maximumFractionDigits:2});
    const money = value => value == null || !Number.isFinite(value) ? '—' : currencyFormat.format(value);
    const percent = value => value == null || !Number.isFinite(value) ? '—' : value.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+'%';
    const periodLabel = key => key === '__all__' ? 'Todos os períodos' : monthNames[Number(key.slice(5))-1]+'/'+key.slice(0,4);
    const tone = value => value == null ? 'neutral' : value > 0 ? 'alert' : value < 0 ? 'saving' : 'neutral';
    const varianceTone = value => value == null ? '' : value > 0 ? 'var-positive' : value < 0 ? 'var-negative' : '';
    class LiftingCostExecutive extends HTMLElement {
        constructor() {
            super();
            this._root = this.attachShadow({mode:'open'});
            this._data = null;
            this._selected = null;
            this._view = 'executive';
            this._detail = 'pareto';
            this._coverage = 0.8;
            this._expanded = new Set();
            this._sort = {key:'name',direction:1};
            this._root.addEventListener('click',event => this._click(event));
            this._root.addEventListener('change',event => this._change(event));
            this._root.addEventListener('input',event => {
                if (event.target.id === 'paretoCoverageSlider') {
                    const output = this._root.querySelector('output');
                    if (output) output.textContent = event.target.value+'%';
                }
            });
            this._shell('<div class="lc-empty">Conecte a medida Lifting Cost e as dimensões Item financeiro, G4_O, Data e Versão.</div>');
        }
        onCustomWidgetBeforeUpdate() {}
        onCustomWidgetAfterUpdate(changedProperties) {
            if (changedProperties && Object.prototype.hasOwnProperty.call(changedProperties,'financialData')) {
                this.setData(this.financialData || changedProperties.financialData);
            }
        }
        setData(binding) {
            try {
                if (binding && (binding.state === 'loading' || binding.state === 'error')) {
                    this._data = null;
                    this._shell('<div class="lc-empty">'+(binding.state === 'loading'?'Carregando Lifting Cost…':'Não foi possível carregar a base do SAC.')+'</div>');
                    return;
                }
                this._data = normalizeData(binding);
                if (!this._data.facts.length) { this._shell('<div class="lc-empty">Nenhum dado disponível para os filtros atuais.</div>'); return; }
                if (!this._data.months.includes(this._selected) && this._selected !== '__all__') this._selected = defaultMonth(this._data);
                this.render();
            } catch (error) {
                this._data = null;
                this._shell('<div class="lc-error" role="alert">'+escapeHtml(error.message)+'</div>');
            }
        }
        _shell(content) {
            this._root.innerHTML = '<style>'+styles+ADDITIONAL_STYLES+DRILLDOWN_STYLES+'</style><div id="widget-wrapper"><div id="header-container"><h1 class="table-title">Lifting Cost | Visão Executiva</h1></div><div id="table-container">'+content+'</div></div>';
        }
        _click(event) {
            const control = event.target.closest('[data-view],[data-detail],[data-expand],[data-sort]');
            if (!control || !this._data) return;
            if (control.dataset.view) this._view = control.dataset.view;
            if (control.dataset.detail) this._detail = control.dataset.detail;
            if (control.dataset.expand) {
                const key = control.dataset.expand;
                if (this._expanded.has(key)) this._expanded.delete(key); else this._expanded.add(key);
            }
            if (control.dataset.sort) {
                const key = control.dataset.sort;
                this._sort = {key,direction:this._sort.key === key?-this._sort.direction:1};
            }
            this.render();
        }
        _change(event) {
            if (!this._data) return;
            if (event.target.id === 'lcMonth') {
                this._selected = event.target.value;
                this.render();
                this.dispatchEvent(new CustomEvent('monthFilterChanged',{detail:{selectedMonth:this._selected,isAllMonths:this._selected === '__all__'},bubbles:true,composed:true}));
            } else if (event.target.id === 'paretoCoverageSlider') {
                this._coverage = Number(event.target.value)/100;
                this.render();
            }
        }
        render() {
            if (!this._data || !this._data.facts.length) return;
            const a = analyze(this._data,this._selected,this._coverage);
            this._analysis = a;
            const groups = new Map();
            this._data.months.forEach(key => {
                const year = key.slice(0,4);
                if (!groups.has(year)) groups.set(year,[]);
                groups.get(year).push(key);
            });
            const options = '<option value="__all__"'+(this._selected === '__all__'?' selected':'')+'>Todos os períodos</option>'+
                Array.from(groups,([year,months]) => '<optgroup label="'+year+'">'+months.map(key => '<option value="'+key+'"'+(key===this._selected?' selected':'')+'>'+periodLabel(key)+'</option>').join('')+'</optgroup>').join('');
            const warnings = a.warnings.length?'<details class="lc-notes"><summary>Observações sobre a base ('+a.warnings.length+')</summary><ul>'+a.warnings.map(w=>'<li>'+escapeHtml(w)+'</li>').join('')+'</ul></details>':'';
            const tabs = '<div class="view-tabs"><button class="view-tab '+(this._view==='executive'?'active':'')+'" data-view="executive" type="button">Resumo Executivo</button><button class="view-tab '+(this._view==='operational'?'active':'')+'" data-view="operational" type="button">Drilldown</button></div>';
            this._shell(tabs+warnings+'<div class="view-panel active" id="'+(this._view==='executive'?'executiveView':'operationalView')+'">'+(this._view==='executive'?this._executive(a):this._drilldown(a))+'</div>');
            this._root.getElementById('header-container').innerHTML = '<div class="header-top"><div><h1 class="table-title">Lifting Cost | Visão Executiva</h1><div class="lc-subtitle">Custo total em R$ · Item financeiro → G4_O</div></div></div><div class="filter-container-finance"><label class="filter-label-finance" for="lcMonth">Mês de análise:</label><select id="lcMonth">'+options+'</select></div>';
        }
        _card(id,title,value,subtitle,rows,kind) {
            return '<div class="executive-kpi '+(kind||'neutral')+'" data-kpi="'+id+'"><div class="kpi-label">'+title+'</div><div class="kpi-value">'+value+'</div><div class="kpi-sub">'+escapeHtml(subtitle)+'</div>'+rows.map(([name,val])=>'<div class="kpi-detail-row"><span>'+name+'</span><span>'+val+'</span></div>').join('')+'</div>';
        }
        _executive(a) {
            const currentVariance = a.canCompare?variance(a.current):null;
            const ytdVariance = a.canCompareYtd?variance(a.ytd):null;
            const ytdTitle = a.selected === '__all__'?'Total da base':'YTD Consolidado';
            const ytdLabel = a.selected === '__all__'?'Todos os períodos recebidos':'YTD até '+periodLabel(a.selected)+(!a.actualYtdComplete||!a.budgetYtdComplete?' · base parcial':'');
            const cards =
                this._card('actual','Total Realizado do Período',money(a.current.hasActual?a.current.actual:null),periodLabel(a.selected),[['Orçado',money(a.current.hasBudget?a.current.budget:null)],['Desvio',money(currentVariance)]],'primary')+
                this._card('ytd',ytdTitle,money(a.ytd.hasActual?a.ytd.actual:null),ytdLabel,[['Orçado',money(a.ytd.hasBudget?a.ytd.budget:null)],['Variação',money(ytdVariance)]],tone(ytdVariance))+
                this._card('mom','Realizado vs Mês Anterior',percent(a.momPct),a.momAvailable?periodLabel(a.previousKey)+' → '+periodLabel(a.selected):'Comparação indisponível',[['Variação R$',money(a.momAbs)]],tone(a.momAbs))+
                this._card('pareto','Pareto Orçamento',a.canCompare?String(a.drivers.length):'—','grupos de G4_O · cobertura '+percent(a.canCompare?a.coverage*100:null),[['Desvio Pareto',money(a.canCompare?a.covered:null)]],'neutral');
            const top = a.drivers.slice(0,3);
            const topHtml = top.length?top.map((d,i)=>'<div class="impact-offender"><span class="impact-signal info">'+(i+1)+'</span><div><span class="impact-offender-name">'+escapeHtml(d.name)+'</span><span class="impact-detail">'+escapeHtml(d.item)+' · '+money(d.desvio)+'</span></div></div>').join(''):'<span class="impact-detail">'+(a.canCompare?'Nenhum grupo de G4_O acima do orçamento.':'Orçado e Realizado são necessários para comparar.')+'</span>';
            const statusHtml = '<div class="impact-column"><span class="impact-title">O Status</span><span class="impact-subtitle">Realizado − Orçado</span><span class="impact-value '+tone(currentVariance)+'">'+escapeHtml(status(a.current,a.canCompare))+'</span><span class="impact-detail">'+percent(a.canCompare?variancePct(a.current):null)+' vs. orçamento do período</span><span class="impact-value '+tone(ytdVariance)+'">'+money(ytdVariance)+'</span><span class="impact-detail">'+escapeHtml(ytdLabel)+'</span></div>';
            const oversight = '<div class="executive-oversight '+(currentVariance>0?'summary-desvio':'summary-saving')+'"><div class="executive-headline">ANÁLISE DE LIFTING COST</div><div class="impact-grid">'+statusHtml+'<div class="impact-column"><span class="impact-title">Principais Desvios</span><span class="impact-subtitle">G4_O dentro de cada item financeiro</span><div class="impact-list">'+topHtml+'</div></div><div class="impact-column"><span class="impact-title">A Tendência</span><span class="impact-subtitle">Histórico até o mês selecionado</span><span class="impact-value">'+escapeHtml(a.trend.label)+'</span><span class="impact-detail">'+(top.length?escapeHtml(top[0].item+' → '+top[0].name):'Sem grupo dominante.')+'</span><span class="impact-detail">'+(a.trend.recurrence?a.trend.recurrence+' mês(es) consecutivo(s) acima do orçamento.':'')+'</span></div></div></div>';
            const list = this._detail === 'remaining'?a.remaining:a.drivers;
            const base = this._detail === 'remaining'?a.remaining.reduce((sum,d)=>sum+Math.abs(d.desvio),0):a.positiveDeviation;
            const driverRows = list.length?list.map((d,i)=>'<div class="driver-row" data-driver-key="'+escapeHtml(d.key)+'"><div><div class="driver-name">'+(i+1)+'. '+escapeHtml(d.name)+'</div><div class="driver-meta">'+escapeHtml(d.item)+'</div></div><div class="driver-metric"><span class="executive-label">Desvio orçamento</span><span class="driver-value driver-value-'+(d.desvio>0?'alert':'saving')+'">'+money(d.desvio)+'</span></div><div class="driver-metric"><span class="executive-label">'+(this._detail==='remaining'?'Peso absoluto':'Contribuição')+'</span><span class="driver-value">'+percent(base?Math.abs(d.desvio)/base*100:null)+'</span></div><div class="driver-metric"><span class="executive-label">Consumo</span><span class="driver-value">'+(d.budget===0&&d.actual>0?'Sem orçamento':percent(consumption(d)))+'</span></div></div>').join(''):'<div class="driver-meta">'+(!a.canCompare?'Comparação indisponível.':this._detail==='remaining'?'Não há demais variações no período.':'Não há desvios positivos no período.')+'</div>';
            const pareto = '<div class="executive-section"><div class="section-title">Principais desvios por G4_O e Item financeiro</div><div class="pareto-control"><div class="pareto-control-header"><div><label class="pareto-control-title" for="paretoCoverageSlider">Cobertura dos desvios positivos</label><span class="pareto-control-sub">Participação acumulada dos grupos acima do orçamento.</span></div><output class="pareto-control-value" for="paretoCoverageSlider">'+Math.round(a.target*100)+'%</output></div><input class="pareto-slider" id="paretoCoverageSlider" type="range" min="50" max="100" step="5" value="'+Math.round(a.target*100)+'" aria-label="Cobertura dos desvios positivos"><div class="pareto-scale"><span>50%</span><span>60%</span><span>70%</span><span>80%</span><span>90%</span><span>100%</span></div></div><div class="budget-detail-controls"><button type="button" class="budget-detail-btn '+(this._detail==='pareto'?'active':'')+'" data-detail="pareto">Principais desvios</button><button type="button" class="budget-detail-btn '+(this._detail==='remaining'?'active':'')+'" data-detail="remaining">Demais variações</button></div><div class="driver-list">'+driverRows+'</div><div class="lc-reconciliation">Fechamento: Pareto '+money(a.canCompare?a.covered:null)+' + demais variações '+money(a.canCompare?a.remainingDeviation:null)+' = desvio total '+money(currentVariance)+'.</div></div>';
            return '<div class="executive-kpi-grid">'+cards+'</div>'+oversight+pareto;
        }
        _drilldown(a) {
            const nodes = Array.from(a.ytdNodes.values());
            const metric = (map,key) => (map.get(key)||{values:emptyTotals()}).values;
            const amount = (t,kind,present) => present?t[kind]:null;
            const rowValues = key => {
                const m = metric(a.monthlyNodes,key), y = metric(a.ytdNodes,key);
                return {monthlyBudget:amount(m,'budget',a.current.hasBudget),monthlyActual:amount(m,'actual',a.current.hasActual),monthlyVariance:a.canCompare?variance(m):null,
                    ytdBudget:amount(y,'budget',a.ytd.hasBudget),ytdActual:amount(y,'actual',a.ytd.hasActual),ytdVariance:a.canCompareYtd?variance(y):null,
                    annualConsumption:a.canCompareYtd&&y.hasBudget&&y.hasActual&&y.budget>0?y.actual/y.budget*100:null,
                    targetConsumption:a.canCompareYtd&&y.hasBudget&&y.budget>0?100:null,
                    status:status(y,a.canCompareYtd)};
            };
            const sort = rows => rows.sort((left,right)=>{
                const l = this._sort.key === 'name'?left.name:rowValues(left.key)[this._sort.key];
                const r = this._sort.key === 'name'?right.name:rowValues(right.key)[this._sort.key];
                if (l==null) return r==null?0:1;
                if (r==null) return -1;
                return (typeof l==='string'?l.localeCompare(r,'pt-BR'):l-r)*this._sort.direction;
            });
            const columns = [['monthlyBudget','Orçado'],['monthlyActual','Realizado'],['monthlyVariance','Variação'],['ytdBudget','Orçado YTD'],['ytdActual','Realizado YTD'],['ytdVariance','Variação'],['annualConsumption','Consumo real'],['status','Status']];
            const header = (key,name) => '<button class="lc-sort" data-sort="'+key+'" type="button">'+name+(this._sort.key===key?(this._sort.direction===1?' ▲':' ▼'):'')+'</button>';
            const statusPresentation = value => value==='Dentro do orçamento'?{label:'Aderente',className:'status-aderente'}:(value==='Acima do orçamento'||value==='Sem orçamento'?{label:'Atenção',className:'status-atencao'}:{label:value,className:'status-neutro'});
            const consumptionCell = v => {
                const actual = v.annualConsumption, target = v.targetConsumption;
                const fill = actual==null?0:Math.max(0,Math.min(100,actual));
                const marker = target==null?null:Math.max(0,Math.min(100,target));
                const tone = v.status==='Dentro do orçamento'?'consumption-good':(v.status==='Acima do orçamento'||v.status==='Sem orçamento'?'consumption-bad':'consumption-neutral');
                return '<div class="consumption"><div class="consumption-labels"><span>Consumo: <strong>'+percent(actual)+'</strong></span><span>Meta: <strong>'+percent(target)+'</strong></span></div><div class="consumption-track"><span class="consumption-fill '+tone+'" style="width:'+fill+'%"></span>'+(marker==null?'':'<span class="consumption-target" style="left:'+marker+'%"></span>')+'</div></div>';
            };
            const cells = v => columns.map(([key]) => {
                const className = (key==='status'?'center':key==='annualConsumption'?'consumption-cell':'numeric')+(key==='ytdBudget'?' ytd-start':'')+(key.toLowerCase().includes('variance')?' '+varianceTone(v[key]):'');
                if (key==='status') { const p=statusPresentation(v.status); return '<td class="'+className+'"><span class="status-pill '+p.className+'">'+escapeHtml(p.label)+'</span></td>'; }
                if (key==='annualConsumption') return '<td class="'+className+'">'+consumptionCell(v)+'</td>';
                return '<td class="'+className+'">'+money(v[key])+'</td>';
            }).join('');
            const renderRow = (node,leaf) => '<tr data-row-key="'+escapeHtml(node.key)+'" data-level="'+(leaf?1:0)+'" class="'+(leaf?'row-conta':'row-cc')+'"><td>'+(leaf?escapeHtml(node.name):'<button class="lc-expand" type="button" aria-expanded="'+this._expanded.has(node.key)+'" data-expand="'+escapeHtml(node.key)+'"><span>'+(this._expanded.has(node.key)?'▼':'▶')+'</span> '+escapeHtml(node.name)+'</button>')+'</td>'+cells(rowValues(node.key))+'</tr>';
            const roots = sort(nodes.filter(n=>n.parent===null));
            const rows = roots.map(n=>renderRow(n,false)+(this._expanded.has(n.key)?sort(nodes.filter(child=>child.parent===n.key)).map(child=>renderRow(child,true)).join(''):'')).join('');
            const total = {monthlyBudget:a.current.hasBudget?a.current.budget:null,monthlyActual:a.current.hasActual?a.current.actual:null,monthlyVariance:a.canCompare?variance(a.current):null,
                ytdBudget:a.ytd.hasBudget?a.ytd.budget:null,ytdActual:a.ytd.hasActual?a.ytd.actual:null,ytdVariance:a.canCompareYtd?variance(a.ytd):null,
                annualConsumption:a.canCompareYtd&&a.ytd.hasBudget&&a.ytd.hasActual&&a.ytd.budget>0?a.ytd.actual/a.ytd.budget*100:null,
                targetConsumption:a.canCompareYtd&&a.ytd.hasBudget&&a.ytd.budget>0?100:null,status:status(a.ytd,a.canCompareYtd)};
            const context = a.selected==='__all__'?'Base completa · valores em R$':periodLabel(a.selected)+' · YTD até '+periodLabel(a.selected)+' · meta consumo '+percent(total.targetConsumption);
            return '<div class="operational-stack lc-drilldown"><section class="operational-section"><div class="operational-section-header"><span class="operational-section-title">Drilldown</span><span class="operational-section-sub">'+context+'</span></div><div class="operational-table-wrap"><table class="drilldown-table"><colgroup><col class="col-name"><col class="col-money"><col class="col-money"><col class="col-money"><col class="col-money"><col class="col-money"><col class="col-money"><col class="col-consumption"><col class="col-status"></colgroup><thead><tr><th rowspan="2">'+header('name','Item financeiro / G4_O')+'</th><th colspan="3" class="group-header">Análise Mensal</th><th colspan="5" class="group-header ytd-start">Análise MYTD</th></tr><tr>'+columns.map(([key,name])=>'<th class="'+(key==='ytdBudget'?'ytd-start':'')+'">'+header(key,name)+'</th>').join('')+'</tr></thead><tbody>'+rows+'</tbody><tfoot><tr><td>TOTAL GERAL</td>'+cells(total)+'</tr></tfoot></table></div></section></div>';
        }
    }
    const ADDITIONAL_STYLES = '.pareto-control{display:block;width:100%;max-width:600px;box-sizing:border-box}.pareto-control-header{display:flex;justify-content:space-between;align-items:center;gap:16px}.pareto-slider{width:100%;margin:14px 0 4px}.pareto-scale{width:100%}\n#widget-wrapper{min-height:300px}#table-container{overflow:hidden}.lc-empty,.lc-error{padding:24px;line-height:1.6}.lc-error{color:#991b1b;background:#fef2f2}.lc-subtitle{color:#64748b;font-size:12px;margin-top:6px}.lc-notes{margin:0 16px 10px;padding:8px 12px;background:#fff8eb;border:1px solid #f3d59c;border-radius:6px;font-size:12px;line-height:1.6;color:#805519}.lc-notes summary{cursor:pointer}.lc-reconciliation{font-size:12px;color:#64748b;padding:14px 0 4px;line-height:1.6}select{font:inherit;color:#1f4e79;background:white;border:1px solid #cbd5e1;border-radius:5px;padding:7px 30px 7px 10px}.lc-sort,.lc-expand{font:inherit;font-weight:inherit;color:inherit;cursor:pointer;background:transparent;border:0;text-align:left;padding:5px}.lc-expand span{color:#1f4e79;font-size:10px}.lc-sort:focus-visible,.lc-expand:focus-visible,button:focus-visible,select:focus-visible,input:focus-visible{outline:2px solid #1f4e79;outline-offset:2px}.impact-column>.impact-value,.impact-column>.impact-detail{display:block;margin:8px 0}.drilldown-table{min-width:1250px}.operational-table-wrap{overflow:auto}.view-panel.active{overflow:auto}.driver-name,.impact-offender-name{overflow-wrap:anywhere}.executive-kpi .kpi-value{overflow-wrap:anywhere}.lc-notes ul{margin:5px 0}.lc-sort{white-space:nowrap}.drilldown-table td:first-child{min-width:240px}';
    const DRILLDOWN_STYLES = `
        .lc-drilldown { gap: 0; }
        .lc-drilldown .operational-section {
            border: 1px solid #CBD5E1;
            border-radius: 4px;
            overflow: hidden;
            background: #FFFFFF;
        }
        .lc-drilldown .operational-section-header {
            min-height: 32px;
            padding: 7px 10px;
            border-bottom: 1px solid #CBD5E1;
            background: #F8FAFC;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            box-sizing: border-box;
        }
        .lc-drilldown .operational-section-title {
            color: #0F172A;
            font-size: 10.5px;
            font-weight: 700;
            letter-spacing: .25px;
            text-transform: uppercase;
        }
        .lc-drilldown .operational-section-sub {
            color: #475569;
            font-size: 10px;
            font-weight: 500;
            white-space: nowrap;
        }
        .lc-drilldown .operational-table-wrap { overflow: auto; }
        .lc-drilldown .drilldown-table {
            min-width: 1080px;
            width: 100%;
            table-layout: fixed;
            border-collapse: collapse;
        }
        .lc-drilldown .col-name { width: 22%; }
        .lc-drilldown .col-money { width: 9.3%; }
        .lc-drilldown .col-consumption { width: 12.8%; }
        .lc-drilldown .col-status { width: 8.3%; }
        .lc-drilldown .drilldown-table th {
            height: 28px;
            box-sizing: border-box;
            padding: 4px 8px;
            border-bottom: 1px solid #CBD5E1;
            color: #0F172A;
            background: #F8FAFC;
            font-size: 10px;
            line-height: 1.15;
            letter-spacing: 0;
        }
        .lc-drilldown .drilldown-table thead tr:first-child th {
            height: 28px;
            padding: 4px 8px;
            background: #EAF0F7;
            font-size: 10px;
        }
        .lc-drilldown .drilldown-table thead tr:nth-child(2) th {
            top: 28px;
            height: 28px;
            padding: 4px 8px;
            background: #F3F6FA;
            border-bottom: 1px solid #B8C4D1;
        }
        .lc-drilldown .drilldown-table .group-header {
            background: #EAF0F7;
            font-size: 10px;
            text-align: center;
        }
        .lc-drilldown .drilldown-table td {
            height: 31px;
            box-sizing: border-box;
            padding: 4px 8px;
            border-bottom: 1px solid #E5E7EB;
            color: #0F2942;
            font-size: 10.5px;
            line-height: 1.15;
            background: #FFFFFF;
        }
        .lc-drilldown .drilldown-table tr.row-cc:hover td,
        .lc-drilldown .drilldown-table tr.row-conta:hover td { background: #F8FAFC; }
        .lc-drilldown .drilldown-table tr.row-conta td {
            height: 28px;
            padding-top: 3px;
            padding-bottom: 3px;
            background: #FBFCFE;
            font-size: 10px;
        }
        .lc-drilldown .drilldown-table tr.row-conta td:first-child {
            min-width: 0;
            padding-left: 31px;
            color: #475569;
        }
        .lc-drilldown .drilldown-table tr.row-conta td:first-child::before {
            content: '↳';
            left: 16px;
            color: #94A3B8;
            font-size: 10px;
        }
        .lc-drilldown .drilldown-table td:first-child { min-width: 0; }
        .lc-drilldown .numeric {
            white-space: nowrap;
            font-variant-numeric: tabular-nums;
            font-weight: 500;
        }
        .lc-drilldown .ytd-start { border-left: 1px solid #B8C4D1; }
        .lc-drilldown .lc-sort {
            width: 100%;
            padding: 2px 0;
            color: inherit;
            font-size: inherit;
            line-height: inherit;
            white-space: normal;
        }
        .lc-drilldown th:not(:first-child) .lc-sort { text-align: right; }
        .lc-drilldown .group-header { text-transform: uppercase; }
        .lc-drilldown .lc-expand {
            max-width: 100%;
            padding: 2px 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .lc-drilldown .lc-expand span {
            display: inline-block;
            width: 12px;
            color: #64748B;
            font-size: 8px;
        }
        .lc-drilldown .var-positive { color: #DC2626; }
        .lc-drilldown .var-negative { color: #15803D; }
        .lc-drilldown .consumption-cell { padding-left: 7px; padding-right: 7px; }
        .lc-drilldown .consumption { display: grid; gap: 3px; min-width: 106px; }
        .lc-drilldown .consumption-labels {
            display: flex;
            justify-content: space-between;
            gap: 8px;
            color: #475569;
            font-size: 8.5px;
            line-height: 1;
            white-space: nowrap;
        }
        .lc-drilldown .consumption-labels strong {
            color: #0F2942;
            font-weight: 600;
            font-variant-numeric: tabular-nums;
        }
        .lc-drilldown .consumption-track {
            position: relative;
            height: 7px;
            border: 1px solid #CBD5E1;
            border-radius: 2px;
            background: #F1F5F9;
            overflow: visible;
        }
        .lc-drilldown .consumption-fill {
            position: absolute;
            inset: 0 auto 0 0;
            height: 100%;
            border-radius: 1px;
        }
        .lc-drilldown .consumption-good { background: #166534; }
        .lc-drilldown .consumption-bad { background: #991B1B; }
        .lc-drilldown .consumption-neutral { background: #64748B; }
        .lc-drilldown .consumption-target {
            position: absolute;
            top: -3px;
            width: 2px;
            height: 13px;
            background: #0F172A;
            transform: translateX(-1px);
            z-index: 2;
        }
        .lc-drilldown .status-pill {
            min-width: 68px;
            padding: 3px 6px;
            border-radius: 3px;
            font-size: 9.5px;
            font-weight: 600;
        }
        .lc-drilldown .status-aderente { background: #E8F5E9; color: #166534; border: 1px solid #BBE0C0; }
        .lc-drilldown .status-atencao { background: #FEF2F2; color: #B91C1C; border: 1px solid #FCA5A5; }
        .lc-drilldown .status-neutro { background: #F1F5F9; color: #475569; border: 1px solid #CBD5E1; }
        .lc-drilldown .drilldown-table tfoot td {
            height: 34px;
            padding: 5px 8px;
            background: #F3F6FA;
            border-top: 1px solid #94A3B8;
            box-shadow: none;
            font-size: 10.5px;
        }
        @media (max-width: 900px) {
            .lc-drilldown .operational-section-header { align-items: flex-start; flex-direction: column; gap: 2px; }
            .lc-drilldown .operational-section-sub { white-space: normal; }
        }
    `;
    if (!root.customElements.get(TAG)) root.customElements.define(TAG,LiftingCostExecutive);
})(typeof window !== 'undefined' ? window : globalThis);
