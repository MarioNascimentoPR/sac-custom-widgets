/* ==========================================================================
   EVOSTREAM PERFORMANCE SUMMARY WIDGET - CORE RUNTIME (PRODUCTION READY)
   ========================================================================== */

(function () {
  // CHAVE DE DESATIVAÇÃO OPERACIONAL: Altere para false para desligar 100% a Telemetria
  const ENABLE_TELEMETRY = true;

  /* ==========================================================================
     SUBSISTEMA ENCAPSULADO DE TELEMETRIA E PROFILING CIENTÍFICO (HEADLESS)
     ========================================================================== */
  class EvoStreamProfiler {
    constructor() {
      this.metrics = {
        totalCycle: 0, jsTime: 0, domTime: 0, fps: 60,
        steps: { parsing: 0, aggregation: 0, domCreation: 0, svgDrawing: 0, highlights: 0 },
        memory: 0, redundantRenders: 0, dataVolume: 0
      };
      this._lastDataSignature = "";
      this._fpsFrameCount = 0;
      this._fpsLastTime = performance.now();
    }

    _buildDataSignature(cubeData) {
      const rows = Array.isArray(cubeData) ? cubeData : (cubeData && cubeData.data);
      if (!Array.isArray(rows)) return "";
      let hash = 2166136261;
      const mix = (value) => {
        const text = String(value == null ? "" : value);
        for (let i = 0; i < text.length; i++) {
          hash ^= text.charCodeAt(i);
          hash = Math.imul(hash, 16777619);
        }
      };

      if (!Array.isArray(cubeData) && cubeData.metadata) {
        const metadata = cubeData.metadata;
        const dimensions = metadata.dimensions || {};
        const mainStructureMembers = metadata.mainStructureMembers || {};
        Object.keys(dimensions).forEach(key => {
          const dim = dimensions[key] || {};
          mix(key); mix(dim.id); mix(dim.description); mix(dim.label);
        });
        Object.keys(mainStructureMembers).forEach(key => {
          const measure = mainStructureMembers[key] || {};
          mix(key); mix(measure.id); mix(measure.description); mix(measure.label);
        });
      }

      mix(rows.length);
      rows.forEach(row => {
        if (!row) return;
        if (row.versionContext) {
          mix(row.versionContext.isActualMonth);
        }
        Object.keys(row).forEach(key => {
          const cell = row[key];
          mix(key);
          if (cell && typeof cell === "object") {
            mix(cell.id);
            mix(cell.label || cell.description);
            if (cell.properties) {
              mix(cell.properties.isCurrent);
            }
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
      if (!ENABLE_TELEMETRY) return;
      this._fpsFrameCount = 0;
      this._fpsLastTime = performance.now();
      const run = () => {
        this._fpsFrameCount++;
        const now = performance.now();
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
      if (window.performance && performance.memory) {
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

  const template = document.createElement("template");
  template.innerHTML = `
    <style>
      :host {
        --color-actual: #1f77b4;
        --color-historical: #7f7f7f;
        --color-budget: #aec7e8;
        --font-size-labels: 13px;
        --ui-font-size: 12px;
        --title-font-size: 17px;
        --small-font-size: 11px;
        --chart-height: 185px;
        --chart-padding-top: 52px;
        --bar-width: 44px;
        --bar-gap: 14px;
        --layout-gap: 24px;
        --panel-padding: 16px;
        display: block; width: 100%; height: 100%; box-sizing: border-box; background: #ffffff;
      }
      :host([data-size="compact"]) {
        --ui-font-size: 11.5px;
        --title-font-size: 15px;
        --small-font-size: 10.5px;
        --chart-height: 150px;
        --chart-padding-top: 44px;
        --bar-width: 30px;
        --bar-gap: 7px;
        --layout-gap: 14px;
        --panel-padding: 12px;
      }
      :host([data-size="wide"]) {
        --ui-font-size: 13px;
        --title-font-size: 19px;
        --small-font-size: 12px;
        --chart-height: 230px;
        --chart-padding-top: 62px;
        --bar-width: 56px;
        --bar-gap: 22px;
        --layout-gap: 30px;
        --panel-padding: 18px;
      }
      #widget-wrapper {
        display: flex; flex-direction: column; width: 100%; height: 100%; padding: var(--panel-padding); box-sizing: border-box;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; position: relative; overflow: auto;
      }
      .widget-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; border-bottom: 1px solid #f0f0f0; padding-bottom: 8px; flex-shrink: 0; gap: 12px; }
      .header-left-block { display: flex; flex-direction: column; }
      .widget-title { font-size: var(--title-font-size); font-weight: 700; color: #2c3e50; }
      .scale-tag { font-size: var(--small-font-size); font-weight: 600; color: #7f8c8d; margin-top: 2px; }
      
      .filter-container-finance { position: relative; display: flex; align-items: center; gap: 8px; z-index: 100; }
      .filter-label-finance { font-size: var(--small-font-size); font-weight: 600; color: #4a5568; }
      .tree-dropdown-trigger {
        font-size: var(--small-font-size); font-weight: 700; color: #2d3748; background-color: #f8fafc; border: 1px solid #cbd5e0; border-radius: 6px; padding: 5px 28px 5px 10px; cursor: pointer; min-width: 120px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%234a5568'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E");
        background-repeat: no-repeat; background-position: right 8px center; background-size: 12px; user-select: none; text-overflow: ellipsis; white-space: nowrap; overflow: hidden;
      }
      .tree-dropdown-content {
        display: none; position: absolute; top: 100%; right: 0; margin-top: 4px; background: #ffffff; border: 1px solid #cbd5e0; border-radius: 6px; max-height: 260px; overflow-y: auto; min-width: 160px; padding: 6px 0;
      }
      .tree-dropdown-content.show { display: block; }
      .tree-year-node { font-weight: 700; color: #2d3748; padding: 6px 10px; cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: var(--small-font-size); user-select: none; }
      .tree-year-node:hover { background-color: #edf2f7; }
      .tree-year-node::before { content: '▶'; font-size: 8px; color: #718096; transition: transform 0.2s ease; display: inline-block; }
      .tree-year-node.expanded::before { transform: rotate(90deg); }
      .tree-months-container { display: none; flex-direction: column; padding-left: 14px; background: #f7fafc; }
      .tree-months-container.show { display: flex; }
      .tree-month-item { font-size: var(--small-font-size); font-weight: 600; color: #4a5568; padding: 5px 12px; cursor: pointer; }
      .tree-month-item:hover { background-color: #e2e8f0; color: var(--color-actual); }
      .tree-month-item.selected { background-color: #edf2f7; color: var(--color-actual); font-weight: 700; }
      
      .telemetry-btn {
        font-size: var(--small-font-size); font-weight: 700; color: #4a5568; background-color: #f1f5f9; border: 1px solid #cbd5e0; border-radius: 6px; padding: 5px 10px; cursor: pointer; display: flex; align-items: center; gap: 4px; transition: all 0.2s; user-select: none;
      }
      .telemetry-btn:hover { background-color: #e2e8f0; color: #1e293b; }
      .export-btn {
        font-size: var(--small-font-size); font-weight: 700; color: #1e293b; background-color: #ffffff; border: 1px solid #cbd5e0; border-radius: 6px; padding: 5px 10px; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; transition: all 0.2s; user-select: none;
      }
      .export-btn:hover { background-color: #edf2f7; }
      .telemetry-modal {
        display: none; position: absolute; top: 48px; right: 18px; width: 330px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; z-index: 1000; padding: 14px; font-size: 11px; color: #334155;
      }
      .telemetry-modal.show { display: block; }
      .telemetry-title { font-size: 11.5px; font-weight: 700; color: #1e293b; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #edf2f7; padding-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
      .telemetry-close { background: none; border: none; font-size: 16px; cursor: pointer; color: #94a3b8; font-weight: 700; line-height: 1; }
      .telemetry-close:hover { color: #64748b; }
      .telemetry-section-title { font-size: 10px; font-weight: 700; color: #475569; text-transform: uppercase; margin: 10px 0 4px 0; background: #f1f5f9; padding: 2px 6px; border-radius: 3px; }
      .telemetry-row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dashed #f1f5f9; align-items: center; }
      .telemetry-label { font-weight: 600; color: #64748b; }
      .telemetry-val { font-weight: 700; color: #0f172a; font-variant-numeric: tabular-nums; background: #f8fafc; padding: 1px 6px; border-radius: 4px; border: 1px solid #e2e8f0; }
      .stress-table { width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 10.5px; }
      .stress-table th { text-align: left; background: #e2e8f0; color: #334155; padding: 3px 6px; font-weight: 700; }
      .stress-table td { padding: 4px 6px; border-bottom: 1px solid #edf2f7; font-weight: 600; }

      .widget-legend { display: flex; flex-wrap: wrap; gap: 10px 16px; margin-bottom: 14px; font-size: var(--small-font-size); font-weight: 600; color: #4a5568; flex-shrink: 0; }
      .legend-item { display: flex; align-items: center; gap: 5px; }
      .legend-color { width: 11px; height: 11px; border-radius: 2px; }
      .legend-color.hist { background-color: var(--color-historical); }
      .legend-color.act { background-color: var(--color-actual); }
      .legend-color.bud { 
        background-color: #ffffff; border: 1px solid var(--color-budget); box-sizing: border-box;
        background-image: linear-gradient(45deg, var(--color-budget) 25%, transparent 25%, transparent 50%, var(--color-budget) 50%, var(--color-budget) 75%, transparent 75%, transparent);
        background-size: 4px 4px;
      }
      .view-tabs {
        display: inline-flex; align-self: flex-start; background: #f1f5f9; border: 1px solid #dbe3ec; border-radius: 7px; padding: 3px; gap: 3px; margin-bottom: 14px;
      }
      .view-tab {
        border: none; background: transparent; color: #475569; font-size: var(--small-font-size); font-weight: 700; border-radius: 5px; padding: 6px 11px; cursor: pointer;
      }
      .view-tab.active { background: #ffffff; color: #0f172a; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08); }
      .view-panel { display: none; flex-direction: column; min-width: 0; }
      .view-panel.active { display: flex; }
      .executive-kpi-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 18px; }
      .executive-kpi {
        display: flex; flex-direction: column; gap: 5px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 13px; background: #ffffff;
      }
      .executive-kpi-label { font-size: var(--small-font-size); font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.55px; }
      .executive-kpi-value { font-size: calc(var(--title-font-size) + 1px); line-height: 1.15; font-weight: 700; color: #0f172a; }
      .executive-kpi-sub { font-size: var(--small-font-size); color: #475569; }
      .risk-pill {
        display: inline-flex; align-items: center; justify-content: center; width: fit-content; min-width: 88px; border-radius: 999px; padding: 5px 10px; font-size: var(--small-font-size); font-weight: 700; border: 1px solid transparent;
      }
      .risk-pill.good { background: #e6f4ea; color: #137333; border-color: #ceead6; }
      .risk-pill.watch { background: #fff4e5; color: #b45309; border-color: #fed7aa; }
      .risk-pill.alert { background: #fce8e6; color: #c5221f; border-color: #fad2cf; }
      .executive-grid { display: grid; grid-template-columns: minmax(280px, 1.2fr) minmax(0, 1fr); gap: var(--layout-gap); align-items: stretch; }
      .executive-panel {
        border: 1px solid #e2e8f0; border-radius: 8px; background: #ffffff; padding: var(--panel-padding); display: flex; flex-direction: column; min-width: 0;
      }
      .executive-panel-title { font-size: var(--small-font-size); font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.7px; margin-bottom: 12px; }
      .waterfall-panel-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
      .waterfall-panel-header .executive-panel-title { margin-bottom: 0; }
      .waterfall-mode-tabs { display: inline-flex; border: 1px solid #dbe3ec; border-radius: 7px; background: #f8fafc; padding: 2px; gap: 2px; }
      .waterfall-mode-btn { border: none; background: transparent; color: #475569; font-size: var(--small-font-size); font-weight: 700; border-radius: 5px; padding: 5px 9px; cursor: pointer; white-space: nowrap; }
      .waterfall-mode-btn.active { background: #ffffff; color: #0f172a; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08); }
      .waterfall-caption { font-size: var(--small-font-size); color: #64748b; margin-bottom: 8px; min-height: 16px; }
      .waterfall-chart { position: relative; display: flex; align-items: stretch; gap: 10px; min-height: 240px; height: 240px; overflow-x: auto; padding: 8px 4px 2px; border-top: 1px solid #eef2f6; }
      .waterfall-step { display: flex; flex-direction: column; align-items: center; justify-content: flex-end; min-width: 82px; height: 100%; position: relative; }
      .waterfall-value { height: 24px; display: flex; align-items: flex-start; justify-content: center; font-size: var(--small-font-size); font-weight: 700; color: #334155; white-space: nowrap; font-variant-numeric: tabular-nums; }
      .waterfall-bar-wrap { position: relative; flex: 1; width: 100%; border-bottom: 1px solid #dbe3ec; }
      .waterfall-bar { position: absolute; left: 10%; right: 10%; width: 80%; border-radius: 5px 5px 0 0; min-height: 4px; box-shadow: inset 0 -1px 0 rgba(15, 23, 42, 0.08); }
      .waterfall-bar.total { background: #1f77b4; }
      .waterfall-bar.positive { background: #d32f2f; }
      .waterfall-bar.negative { background: #2e7d32; }
      .waterfall-label { margin-top: 7px; font-size: var(--small-font-size); font-weight: 600; color: #475569; text-align: center; line-height: 1.2; min-height: 34px; max-width: 96px; overflow: hidden; text-overflow: ellipsis; }
      .waterfall-empty { align-self: center; color: #64748b; font-size: var(--ui-font-size); padding: 20px; }
      .executive-summary-list { margin: 0; padding-left: 18px; color: #334155; font-size: var(--ui-font-size); line-height: 1.6; display: flex; flex-direction: column; gap: 10px; }
      .supplier-kpi-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 14px; }
      .supplier-kpi { border: 1px solid #e2e8f0; border-radius: 8px; background: #ffffff; padding: 12px 13px; display: flex; flex-direction: column; gap: 5px; }
      .supplier-kpi-label { font-size: var(--small-font-size); font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.55px; }
      .supplier-kpi-value { font-size: calc(var(--title-font-size) + 1px); line-height: 1.15; font-weight: 700; color: #0f172a; }
      .supplier-kpi-sub { font-size: var(--small-font-size); color: #475569; }
      .supplier-panel { border: 1px solid #e2e8f0; border-radius: 8px; background: #ffffff; padding: var(--panel-padding); display: flex; flex-direction: column; min-width: 0; }
      .supplier-table { width: 100%; border-collapse: collapse; font-size: var(--ui-font-size); color: #334155; }
      .supplier-table th { text-align: left; font-size: var(--small-font-size); color: #64748b; text-transform: uppercase; letter-spacing: 0.55px; padding: 7px 8px; border-bottom: 1px solid #e2e8f0; }
      .supplier-table td { padding: 9px 8px; border-bottom: 1px solid #eef2f6; font-weight: 600; }
      .supplier-table td.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
      .supplier-empty { color: #64748b; font-size: var(--ui-font-size); padding: 18px 4px; }
      .main-visualization-layout { display: flex; width: 100%; gap: var(--layout-gap); margin-bottom: 22px; flex-shrink: 0; align-items: stretch; }
      .visualization-column { display: flex; flex-direction: column; justify-content: flex-end; position: relative; }
      .visualization-column.monthly-col { flex: 3; }
      .visualization-column.ytd-col { flex: 1; border-left: 1px solid #e2e8f0; padding-left: var(--layout-gap); }
      
      .chart-container-block { position: relative; height: var(--chart-height); padding-top: var(--chart-padding-top); box-sizing: border-box; width: 100%; }
      .chart-area { width: 100%; height: 100%; display: flex; position: relative; align-items: flex-end; justify-content: center; gap: var(--bar-gap); }
      
      .html-connectors-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1; overflow: visible; }
      .html-bracket-track { position: absolute; border-top: 1.25px solid #cbd5e0; border-left: 1.25px solid #cbd5e0; border-right: 1.25px solid #cbd5e0; pointer-events: none; box-sizing: border-box; }
      .html-bracket-badge-anchor { position: absolute; width: 78px; height: 24px; display: flex; justify-content: center; align-items: center; pointer-events: none; transform: translate(-39px, -12px); }

      .bar-wrapper { display: flex; flex-direction: column; align-items: center; width: var(--bar-width); min-width: 0; height: 100%; justify-content: flex-end; position: relative; z-index: 2; }
      .bar-element { width: 100%; max-width: var(--bar-width); border-radius: 4px 4px 0 0; position: relative; display: flex; justify-content: center; bottom: 0px; height: 0%; transition: height 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
      .bar-element.historical { background-color: var(--color-historical); }
      .bar-element.actual { background-color: var(--color-actual); box-shadow: none; box-sizing: border-box; }
      .bar-element.budget {
        background-color: #ffffff; border: 1px solid var(--color-budget); box-sizing: border-box;
        background-image: linear-gradient(45deg, rgba(174, 199, 232, 0.4) 25%, transparent 25%, transparent 50%, rgba(174, 199, 232, 0.4) 50%, rgba(174, 199, 232, 0.4) 75%, transparent 75%, transparent);
        background-size: 6px 6px;
      }
      .kpi-label { position: absolute; top: -25px; font-size: var(--font-size-labels); font-weight: 700; color: #2d3748; white-space: nowrap; background: #ffffff; padding: 2px 5px; border-radius: 4px; z-index: 3; }
      .bar-element.actual .kpi-label { color: #1a202c; background: #edf2f7; top: -27px; }
      
      .axis-x-block { display: flex; flex-direction: column; flex-shrink: 0; border-top: 1px solid #cbd5e0; padding-top: 6px; width: 100%; }
      .axis-x { display: flex; justify-content: center; gap: var(--bar-gap); min-height: 22px; }
      .axis-label { width: var(--bar-width); text-align: center; font-size: calc(var(--font-size-labels) - 0.5px); font-weight: 600; color: #718096; white-space: nowrap; }
      .axis-label.actual-month { color: var(--color-actual); font-weight: 700; }
      .variance-tag { font-size: calc(var(--font-size-labels) - 1.5px); font-weight: 700; padding: 2px 6px; border-radius: 3px; box-shadow: none; white-space: nowrap; display: inline-block; position: relative; z-index: 4; }
      .variance-tag.saving { background-color: #e6f4ea; color: #137333; border: 1px solid #ceead6; }
      .variance-tag.increase { background-color: #fce8e6; color: #c5221f; border: 1px solid #fad2cf; }
      
      .insight-grid { 
        display: grid; 
        grid-template-columns: 1fr 1.8fr; 
        gap: var(--layout-gap); margin-top: auto; padding-top: 18px; border-top: 1px solid #e2e8f0; flex-shrink: 0; width: 100%; 
      }
      .grid-column-finance { display: flex; flex-direction: column; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: var(--panel-padding); }
      .column-title-finance { font-size: var(--small-font-size); font-weight: 700; color: #4a5568; text-transform: uppercase; letter-spacing: 0.75px; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 2px solid #cbd5e0; }
      
      .period-summary-banner {
        font-size: var(--ui-font-size); line-height: 1.5; color: #444444; margin: 0 0 12px 0; padding: 9px 12px;
        border-radius: 4px; border-left: 4px solid #cbd5e0; font-family: system-ui, -apple-system, sans-serif;
      }
      .period-summary-banner.summary-saving { background-color: #e8f5e9; color: #1b5e20; border-left-color: #2E7D32; }
      .period-summary-banner.summary-desvio { background-color: #ffebee; color: #b71c1c; border-left-color: #D32F2F; }

      .panel-content-rows { display: flex; flex-direction: column; gap: 1px; background-color: #e2e8f0; border-radius: 4px; overflow: hidden; }
      .data-row-item { display: grid; grid-template-columns: minmax(0, 1.8fr) minmax(76px, 1fr) minmax(76px, 1fr); align-items: center; background: #ffffff; padding: 9px 12px; font-size: var(--ui-font-size); color: #2d3748; gap: 8px; }
      .cell-label { font-weight: 600; color: #4a5568; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 6px; }
      .cell-label::before { content: ''; width: 4px; height: 12px; background: #cbd5e0; border-radius: 2px; display: inline-block; flex-shrink: 0; }
      .row-m-style .cell-label::before { background: var(--color-actual); }
      .row-ytd-style .cell-label::before { background: #2b6cb0; }
      .cell-value { text-align: right; font-variant-numeric: tabular-nums; font-weight: 700; color: #1e293b; white-space: nowrap; }
      .cell-status-wrapper { display: flex; justify-content: flex-end; align-items: center; }
      .status-badge-finance { font-size: var(--small-font-size); font-weight: 700; padding: 4px 8px; border-radius: 4px; text-align: center; white-space: nowrap; display: inline-flex; align-items: center; justify-content: center; min-width: 82px; box-sizing: border-box; }
      .status-badge-finance.success { background-color: #e6f4ea; color: #137333; border: 1px solid #ceead6; }
      .status-badge-finance.warning { background-color: #fce8e6; color: #c5221f; border: 1px solid #fad2cf; }
      .status-badge-finance.neutral { background-color: #f1f3f4; color: #5f6368; border: 1px solid #e8eaed; }
      
      .highlight-card-area { 
        display: flex; flex-direction: column; background: #F8F9FA; border: 1px solid #e2e8f0; 
        border-left: 4px solid #cbd5e0; border-radius: 8px; padding: var(--panel-padding); color: #333333;
      }
      .highlight-title-box { display: flex; align-items: center; gap: 6px; font-size: var(--small-font-size); font-weight: 700; color: #1e293b; text-transform: uppercase; letter-spacing: 0.75px; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 2px solid #cbd5e0; }
      .highlight-content-levels { display: flex; flex-direction: column; gap: 10px; }
      .highlight-section { display: flex; flex-direction: column; gap: 6px; }
      .highlight-section-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: var(--small-font-size); font-weight: 700; color: #4a5568; text-transform: uppercase; letter-spacing: 0.6px; }
      .highlight-section-title { white-space: nowrap; }
      .highlight-detail-section { display: none; padding-top: 10px; border-top: 1px solid #e2e8f0; }
      .highlight-detail-section.show { display: flex; }
      .highlight-toggle-btn { border: 1px solid #cbd5e0; background: #ffffff; color: #2d3748; border-radius: 4px; padding: 4px 9px; font-size: var(--small-font-size); font-weight: 700; cursor: pointer; white-space: nowrap; }
      .highlight-toggle-btn:hover { background: #edf2f7; }
      .ul-highlight { margin: 0; padding-left: 18px; font-size: var(--ui-font-size); color: #333333; line-height: 1.55; display: flex; flex-direction: column; gap: 9px; }
      .bar-tooltip {
        position: absolute; display: none; min-width: 220px; max-width: 320px; max-height: 300px; overflow: hidden auto;
        background: rgba(255, 255, 255, 0.98); border: 1px solid #d7dee8; border-radius: 8px; box-shadow: 0 14px 32px rgba(15, 23, 42, 0.16);
        padding: 10px 12px; z-index: 20; pointer-events: none; color: #243443;
      }
      .bar-tooltip.show { display: block; }
      .bar-tooltip-title { font-size: var(--small-font-size); font-weight: 700; color: #1e293b; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid #e2e8f0; }
      .bar-tooltip-subtitle { font-size: var(--small-font-size); font-weight: 600; color: #64748b; margin-left: 4px; }
      .bar-tooltip-list { display: flex; flex-direction: column; gap: 6px; }
      .bar-tooltip-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; align-items: start; font-size: var(--ui-font-size); }
      .bar-tooltip-name { color: #334155; min-width: 0; word-break: break-word; }
      .bar-tooltip-value-wrap { display: inline-flex; align-items: center; gap: 5px; justify-content: flex-end; min-width: 136px; }
      .bar-tooltip-value { color: #0f172a; font-weight: 700; white-space: nowrap; font-variant-numeric: tabular-nums; min-width: 72px; text-align: right; }
      .bar-tooltip-delta-tag {
        display: inline-flex; align-items: center; justify-content: center; padding: 1px 5px; border-radius: 999px;
        font-size: calc(var(--small-font-size) - 1px); font-weight: 700; white-space: nowrap; border: 1px solid transparent; min-width: 56px; box-sizing: border-box; text-align: center;
      }
      .bar-tooltip-delta-tag.up { background: #fce8e6; color: #c5221f; border-color: #fad2cf; }
      .bar-tooltip-delta-tag.down { background: #e6f4ea; color: #137333; border-color: #ceead6; }
      .bar-tooltip-delta-tag.flat,
      .bar-tooltip-delta-tag.na { background: #f1f5f9; color: #475569; border-color: #e2e8f0; }
      .bar-tooltip-empty { font-size: var(--ui-font-size); color: #64748b; }
      :host([data-layout="stacked"]) .widget-header { align-items: flex-start; flex-direction: column; }
      :host([data-layout="stacked"]) .filter-container-finance { width: 100%; justify-content: flex-start; flex-wrap: wrap; }
      :host([data-layout="stacked"]) .executive-kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      :host([data-layout="stacked"]) .executive-grid { grid-template-columns: 1fr; }
      :host([data-layout="stacked"]) .supplier-kpi-grid { grid-template-columns: 1fr; }
      :host([data-layout="stacked"]) .main-visualization-layout { flex-direction: column; }
      :host([data-layout="stacked"]) .visualization-column.ytd-col { border-left: none; border-top: 1px solid #e2e8f0; padding-left: 0; padding-top: 14px; }
      :host([data-layout="stacked"]) .insight-grid { grid-template-columns: 1fr; }
      :host([data-size="compact"]) .data-row-item { grid-template-columns: 1fr; align-items: flex-start; }
      :host([data-size="compact"]) .cell-value,
      :host([data-size="compact"]) .cell-status-wrapper { justify-content: flex-start; text-align: left; }
      :host([data-size="compact"]) .executive-kpi-grid { grid-template-columns: 1fr; }
      :host([data-size="compact"]) .waterfall-chart { min-height: 190px; height: 190px; }
    </style>
    <div id="widget-wrapper">
      <div class="widget-header">
        <div class="header-left-block">
          <div class="widget-title" id="widgetTitle">Performance Summary</div>
          <div class="scale-tag">Valores em Milhões (M)</div>
        </div>
        <div class="filter-container-finance">
          <span class="filter-label-finance">Corte:</span>
          <div class="tree-dropdown-trigger" id="treeDropdownTrigger">Selecionar...</div>
          <div class="tree-dropdown-content" id="treeDropdownContent"></div>
          <button class="export-btn" id="exportPptBtn" type="button">Exportar PPT</button>
          
          <button class="telemetry-btn" id="telemetryBtn" style="display: none;">📊 Telemetria</button>
          
          <div class="telemetry-modal" id="telemetryModal">
            <div class="telemetry-title">
              <span>Métricas de Performance</span>
              <button class="telemetry-close" id="closeTelemetry">×</button>
            </div>
            
            <div class="telemetry-section-title">Ciclo de Vida Total</div>
            <div class="telemetry-row"><span class="telemetry-label">Tempo Total Ciclo:</span><span class="telemetry-val" id="tmTotal">0.00 ms</span></div>
            <div class="telemetry-row"><span class="telemetry-label">Engine JS Puro:</span><span class="telemetry-val" id="tmJS">0.00 ms</span></div>
            <div class="telemetry-row"><span class="telemetry-label">Pintura e Layout:</span><span class="telemetry-val" id="tmDOM">0.00 ms</span></div>
            <div class="telemetry-row"><span class="telemetry-label">Estabilidade (FPS):</span><span class="telemetry-val" id="tmFPS">60 FPS</span></div>
            
            <div class="telemetry-section-title">Amostragem por Etapa</div>
            <div class="telemetry-row"><span class="telemetry-label">1. Ingestão e Parsing:</span><span class="telemetry-val" id="stParsing">0.00 ms</span></div>
            <div class="telemetry-row"><span class="telemetry-label">2. Agregação e Cubo:</span><span class="telemetry-val" id="stAggr">0.00 ms</span></div>
            <div class="telemetry-row"><span class="telemetry-label">3. Construção Base DOM:</span><span class="telemetry-val" id="stDOM">0.00 ms</span></div>
            <div class="telemetry-row"><span class="telemetry-label">4. Plotagem HTML Connectors:</span><span class="telemetry-val" id="stSVG">0.00 ms</span></div>
            <div class="telemetry-row"><span class="telemetry-label">5. Geração Highlights:</span><span class="telemetry-val" id="stHL">0.00 ms</span></div>
            
            <div class="telemetry-section-title">Diagnóstico de Saúde</div>
            <div class="telemetry-row"><span class="telemetry-label">Memória Heap V8:</span><span class="telemetry-val" id="tmMem">0.00 MB</span></div>
            <div class="telemetry-row"><span class="telemetry-label">Re-renders Redundantes:</span><span class="telemetry-val" id="tmRedund">0</span></div>
            <div class="telemetry-row"><span class="telemetry-label">Volume de Linhas SAC:</span><span class="telemetry-val" id="tmVol">0 rows</span></div>
            
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
      </div>
      <div class="widget-legend">
        <div class="legend-item"><div class="legend-color hist"></div> Histórico (Realizado)</div>
        <div class="legend-item"><div class="legend-color act"></div> Mês Atual (Realizado)</div>
        <div class="legend-item"><div class="legend-color bud"></div> Orçado (Budget)</div>
      </div>
      <div class="view-tabs" role="tablist" aria-label="Visões do widget">
        <button class="view-tab active" id="executiveTabBtn" type="button" role="tab" aria-selected="true">Executivo</button>
        <button class="view-tab" id="diagnosticTabBtn" type="button" role="tab" aria-selected="false">Diagnóstico</button>
        <button class="view-tab" id="supplierTabBtn" type="button" role="tab" aria-selected="false">Fornecedores</button>
      </div>
      <div class="view-panel active" id="executiveView">
        <div class="executive-kpi-grid">
          <div class="executive-kpi">
            <div class="executive-kpi-label">Realizado YTD</div>
            <div class="executive-kpi-value" id="execActualYtd">-</div>
            <div class="executive-kpi-sub" id="execActualYtdSub">-</div>
          </div>
          <div class="executive-kpi">
            <div class="executive-kpi-label">Forecast Fechamento</div>
            <div class="executive-kpi-value" id="execForecast">-</div>
            <div class="executive-kpi-sub" id="execForecastSub">-</div>
          </div>
          <div class="executive-kpi">
            <div class="executive-kpi-label">Desvio Projetado</div>
            <div class="executive-kpi-value" id="execProjectedGap">-</div>
            <div class="executive-kpi-sub" id="execProjectedGapSub">-</div>
          </div>
          <div class="executive-kpi">
            <div class="executive-kpi-label">Semáforo</div>
            <div class="executive-kpi-value"><span class="risk-pill" id="execRiskPill">-</span></div>
            <div class="executive-kpi-sub" id="execRiskSub">-</div>
          </div>
        </div>
        <div class="executive-grid">
          <div class="executive-panel">
            <div class="waterfall-panel-header">
              <div class="executive-panel-title">Waterfall</div>
              <div class="waterfall-mode-tabs">
                <button class="waterfall-mode-btn active" id="waterfallYtdBtn" type="button">YTD Real x Orçado</button>
                <button class="waterfall-mode-btn" id="waterfallMomBtn" type="button">MoM Realizado</button>
              </div>
            </div>
            <div class="waterfall-caption" id="waterfallCaption"></div>
            <div class="waterfall-chart" id="waterfallChart"></div>
          </div>
          <div class="executive-panel">
            <div class="executive-panel-title">Leitura Executiva</div>
            <ul class="executive-summary-list" id="executiveSummaryList"></ul>
          </div>
        </div>
      </div>
      <div class="view-panel" id="diagnosticView">
      <div class="main-visualization-layout">
        <div class="monthly-col visualization-column">
          <div class="chart-container-block">
            <div class="html-connectors-overlay" id="monthlyConnectors"></div>
            <div class="chart-area" id="chartArea"></div>
          </div>
          <div class="axis-x-block"><div class="axis-x" id="axisX"></div></div>
        </div>
        <div class="visualization-column ytd-col">
          <div class="chart-container-block">
            <div class="html-connectors-overlay" id="ytdConnectors"></div>
            <div class="chart-area" id="ytdChartArea">
              <div class="bar-wrapper"><div class="bar-element historical" id="mini-bar-prev"><span class="kpi-label" id="mini-lbl-prev">-</span></div></div>
              <div class="bar-wrapper"><div class="bar-element actual" id="mini-bar-act"><span class="kpi-label" id="mini-lbl-act">-</span></div></div>
              <div class="bar-wrapper"><div class="bar-element budget" id="mini-bar-bud"><span class="kpi-label" id="mini-lbl-bud">-</span></div></div>
            </div>
          </div>
          <div class="axis-x-block">
            <div class="axis-x" id="ytdAxisX">
              <div class="axis-label" id="ytd-axis-lbl-prev">Ano Ant.</div>
              <div class="axis-label" id="ytd-axis-lbl-act">Ano Atual</div>
              <div class="axis-label">Meta YTD</div>
            </div>
          </div>
        </div>
      </div>
      <div class="insight-grid" id="insightGrid" style="display: none;">
        <div class="grid-column-finance">
          <div class="column-title-finance">Acompanhamento de Metas Orçamentárias</div>
          <div id="periodSummaryBanner" class="period-summary-banner" style="display: none;"></div>
          <div class="panel-content-rows">
            <div class="data-row-item row-m-style">
              <div class="cell-label">Desvio Mês (Real x Orçado)</div><div class="cell-value" id="val-diff-row">-</div>
              <div class="cell-status-wrapper"><span class="status-badge-finance" id="val-pct-row">-</span></div>
            </div>
            <div class="data-row-item row-m-style">
              <div class="cell-label">Consumo do Budget no Mês</div><div class="cell-value" id="val-pct-consumption-row">-</div>
              <div class="cell-status-wrapper"><span class="status-badge-finance neutral">Mês</span></div>
            </div>
            <div class="data-row-item row-ytd-style">
              <div class="cell-label">Desvio YTD (Real x Orçado)</div><div class="cell-value" id="ytd-diff-row">-</div>
              <div class="cell-status-wrapper"><span class="status-badge-finance" id="ytd-diff-pct-badge">-</span></div>
            </div>
            <div class="data-row-item row-ytd-style">
              <div class="cell-label">Consumo do Budget Período (YTD)</div><div class="cell-value" id="ytd-pct-row">-</div>
              <div class="cell-status-wrapper"><span class="status-badge-finance neutral">YTD</span></div>
            </div>
          </div>
        </div>
        <div class="highlight-card-area" id="highlightCardArea">
          <div class="highlight-title-box"><span class="highlight-icon-box">💡</span><span>Highlights</span></div>
          <div class="highlight-content-text" id="highlightContentText"></div>
        </div>
      </div>
      </div>
      <div class="view-panel" id="supplierView">
        <div class="supplier-kpi-grid">
          <div class="supplier-kpi">
            <div class="supplier-kpi-label">Maior Fornecedor YTD</div>
            <div class="supplier-kpi-value" id="supplierTopName">-</div>
            <div class="supplier-kpi-sub" id="supplierTopValue">-</div>
          </div>
          <div class="supplier-kpi">
            <div class="supplier-kpi-label">Base Analisada</div>
            <div class="supplier-kpi-value" id="supplierCount">-</div>
            <div class="supplier-kpi-sub" id="supplierCountSub">fornecedores com realizado no período</div>
          </div>
          <div class="supplier-kpi">
            <div class="supplier-kpi-label">Concentração Top 5</div>
            <div class="supplier-kpi-value" id="supplierTop5Share">-</div>
            <div class="supplier-kpi-sub" id="supplierPeriodLabel">-</div>
          </div>
        </div>
        <div class="supplier-panel">
          <div class="executive-panel-title">Análise de Fornecedores</div>
          <div id="supplierTableWrap"></div>
        </div>
      </div>
      <div class="bar-tooltip" id="barTooltip" aria-hidden="true"></div>
    </div>
  `;

  /* ==========================================================================
     4 & 5. ENGINE DE INTELIGÊNCIA ANALÍTICA SANEADA (PURE HEADLESS)
     ========================================================================== */
  class EvoNarrativeEngine {
    constructor() {
      this._monthOrderMap = { "JAN":1, "FEB":2, "MAR":3, "APR":4, "MAY":5, "JUN":6, "JUL":7, "AUG":8, "SEP":9, "OCT":10, "NOV":11, "DEC":12 };
    }

    analyze(cubeData, targetNode, currentYear, previousYear, tempoDimId, versaoDimId, itemFinanceiroDimId, contaContabilDimId, measId, fullSeriesData, profiler) {
      const tStartAggregation = performance.now();
      const varianceTable = { month: {}, ytd: {} };
      const outlierTable = [];

      const monthActual = targetNode.value;
      const monthBudget = targetNode.budgetValue > 0 ? targetNode.budgetValue : targetNode.value;
      const monthDiff = monthActual - monthBudget;

      varianceTable.month = {
        actual: monthActual, budget: monthBudget, diffNominal: monthDiff,
        pctVar: monthBudget !== 0 ? (monthDiff / monthBudget) * 100 : 0,
        consumption: monthBudget !== 0 ? (monthActual / monthBudget) * 100 : 0,
        isSaving: monthDiff <= 0
      };

      let totalRealizadoYTDAtual = 0; let totalRealizadoYTDAntigo = 0; let totalBudgetYTDCompleto = 0;
      fullSeriesData.forEach(d => {
        if (d.yearValue === currentYear && d.monthNum <= targetNode.monthNum) {
          totalRealizadoYTDAtual += d.value;
          totalBudgetYTDCompleto += d.budgetValue || 0;
        }
        if (d.yearValue === previousYear && d.monthNum <= targetNode.monthNum) {
          totalRealizadoYTDAntigo += d.value;
        }
      });
      if (totalBudgetYTDCompleto === 0) totalBudgetYTDCompleto = totalRealizadoYTDAtual || 1;
      const ytdDiff = totalRealizadoYTDAtual - totalBudgetYTDCompleto;

      varianceTable.ytd = {
        actual: totalRealizadoYTDAtual, budget: totalBudgetYTDCompleto, previous: totalRealizadoYTDAntigo,
        diffNominal: ytdDiff, pctVar: totalBudgetYTDCompleto !== 0 ? (ytdDiff / totalBudgetYTDCompleto) * 100 : 0,
        consumption: totalBudgetYTDCompleto !== 0 ? (totalRealizadoYTDAtual / totalBudgetYTDCompleto) * 100 : 0,
        isSaving: ytdDiff <= 0
      };

      const fullSeriesById = fullSeriesData._byIdMap || new Map(fullSeriesData.map(d => [d.id, d]));
      const itemFinanceiroMap = new Map();
      const targetMonthNum = targetNode.monthNum;
      const previousMonthNum = targetMonthNum > 1 ? targetMonthNum - 1 : 12;
      const previousMonthYear = targetMonthNum > 1 ? currentYear : previousYear;

      const ensureItem = (itemName) => {
        if (!itemFinanceiroMap.has(itemName)) {
          itemFinanceiroMap.set(itemName, {
            ytd: { realizado: 0, orcado: 0 },
            month: { realizado: 0, orcado: 0 },
            previousMonth: { realizado: 0, orcado: 0 },
            previousYtd: { realizado: 0, orcado: 0 }
          });
        }
        return itemFinanceiroMap.get(itemName);
      };

      const addValue = (bucket, rawValue, isBudget) => {
        if (isBudget) bucket.orcado += rawValue;
        else bucket.realizado += rawValue;
      };

      cubeData.forEach(row => {
        if (!tempoDimId || !itemFinanceiroDimId) return;
        const tObj = row[tempoDimId]; if (!tObj) return;

        const rowMonthNode = fullSeriesById.get(String(tObj.id));
        if (!rowMonthNode) return;

        const isCurrentYTD = rowMonthNode.yearValue === currentYear && rowMonthNode.monthNum <= targetMonthNum;
        const isPreviousYTD = rowMonthNode.yearValue === previousYear && rowMonthNode.monthNum <= targetMonthNum;
        const isTargetMonth = rowMonthNode.yearValue === currentYear && rowMonthNode.monthNum === targetMonthNum;
        const isPreviousMonth = rowMonthNode.yearValue === previousMonthYear && rowMonthNode.monthNum === previousMonthNum;
        if (!isCurrentYTD && !isPreviousYTD && !isPreviousMonth) return;

        const itemName = this._getMemberLabel(row, itemFinanceiroDimId, "Outros");
        if (this._isIgnoredMember(itemName)) return;

        const contaName = this._getMemberLabel(row, contaContabilDimId, "Geral");
        if (this._isIgnoredMember(contaName, true)) return;

        const rawValue = this._parseRawValue(row[measId] ? (row[measId].formattedValue || row[measId].raw || 0) : 0);
        const isBudget = this._isBudgetRow(row, versaoDimId);
        const item = ensureItem(itemName);

        if (isCurrentYTD) {
          addValue(item.ytd, rawValue, isBudget);
        }
        if (isTargetMonth) addValue(item.month, rawValue, isBudget);
        if (isPreviousMonth) addValue(item.previousMonth, rawValue, isBudget);
        if (isPreviousYTD) addValue(item.previousYtd, rawValue, isBudget);
      });

      const absYtdDiff = Math.abs(ytdDiff);
      const adaptiveFloor = Math.max(1000, Math.abs(totalBudgetYTDCompleto) * 0.002);

      itemFinanceiroMap.forEach((item, name) => {
        const desvioNominal = item.ytd.realizado - item.ytd.orcado;
        const variancePct = item.ytd.orcado !== 0 ? (desvioNominal / item.ytd.orcado) * 100 : 0;
        const consumption = item.ytd.orcado !== 0 ? (item.ytd.realizado / item.ytd.orcado) * 100 : 0;
        const contributionPct = absYtdDiff !== 0 ? (Math.abs(desvioNominal) / absYtdDiff) * 100 : 0;
        const budgetShare = totalBudgetYTDCompleto !== 0 ? (Math.abs(item.ytd.orcado) / Math.abs(totalBudgetYTDCompleto)) * 100 : 0;
        const monthDiffValue = item.month.realizado - item.month.orcado;
        const monthPctVar = item.month.orcado !== 0 ? (monthDiffValue / item.month.orcado) * 100 : 0;
        const previousMonthDiff = item.previousMonth.realizado - item.previousMonth.orcado;
        const acceleration = monthDiffValue - previousMonthDiff;
        const yoyDiff = item.ytd.realizado - item.previousYtd.realizado;
        const yoyPct = item.previousYtd.realizado !== 0 ? (yoyDiff / item.previousYtd.realizado) * 100 : 0;

        const classification = this._classifyFeature(desvioNominal, variancePct, contributionPct, budgetShare, monthDiffValue, acceleration, adaptiveFloor);
        const score = this._scoreFeature(desvioNominal, variancePct, contributionPct, monthDiffValue, acceleration, classification);

        const featureRow = {
          itemName: name,
          realizado: item.ytd.realizado,
          budget: item.ytd.orcado,
          desvio: desvioNominal,
          pctVar: variancePct,
          consumption,
          contributionPct,
          budgetShare,
          isSaving: desvioNominal <= 0,
          driverConta: "",
          driverImpact: 0,
          driverShare: 0,
          monthDiff: monthDiffValue,
          monthPctVar,
          previousMonthDiff,
          acceleration,
          yoyDiff,
          yoyPct,
          priorityLabel: classification.priorityLabel,
          trendLabel: classification.trendLabel,
          insightType: classification.insightType,
          score
        };

        if (
          Math.abs(desvioNominal) >= adaptiveFloor ||
          Math.abs(variancePct) >= 2 ||
          contributionPct >= 8 ||
          Math.abs(monthDiffValue) >= adaptiveFloor
        ) {
          outlierTable.push(featureRow);
        }
      });

      outlierTable.sort((a, b) => b.score - a.score);
      const selectedInsights = this._selectNarrativeRows(outlierTable, varianceTable.ytd.isSaving);
      this._attachDriverAccounts(selectedInsights, cubeData, currentYear, targetMonthNum, tempoDimId, versaoDimId, itemFinanceiroDimId, contaContabilDimId, measId, fullSeriesById);
      const summary = this._buildSummary(selectedInsights);

      if (ENABLE_TELEMETRY && profiler) {
        profiler.metrics.steps.aggregation = performance.now() - tStartAggregation;
      }

      return { outlierTable: selectedInsights, waterfallTable: outlierTable, summary };
    }

    _getMemberLabel(row, dimId, fallback) {
      if (!dimId || !row[dimId]) return fallback;
      const node = row[dimId];
      return node.label || node.description || node.id || fallback;
    }

    _isIgnoredMember(name, allowGeneric) {
      const upper = String(name || "").toUpperCase();
      if (!upper) return true;
      if (allowGeneric && upper === "GERAL") return false;
      return (
        upper.includes("TOTAL") || upper.includes("ALL_MEMBERS") ||
        upper.includes("(ALL)") || upper === "OUTROS" ||
        upper.includes("RATEIO") || upper.includes("LIQUIDA")
      );
    }

    _isBudgetRow(row, versaoDimId) {
      if (!versaoDimId || !row[versaoDimId]) return false;
      const vId = String(row[versaoDimId].id).toUpperCase();
      const vLabel = String(row[versaoDimId].label || row[versaoDimId].description || "").toUpperCase();
      return vId.includes("ORÇADO") || vId.includes("ORCADO") || vId.includes("BUDGET") || vLabel.includes("ORÇADO") || vLabel.includes("BUDGET");
    }

    _classifyFeature(desvio, pctVar, contributionPct, budgetShare, monthDiff, acceleration, adaptiveFloor) {
      const adverse = desvio > 0;
      const absPct = Math.abs(pctVar);
      const absContribution = Math.abs(contributionPct);
      const absMonth = Math.abs(monthDiff);
      const acceleratingAgainstBudget = adverse && acceleration > adaptiveFloor;
      const easingPressure = adverse && acceleration < -adaptiveFloor;
      const intensifyingSaving = !adverse && acceleration < -adaptiveFloor;

      let priorityLabel = adverse ? "Variação desfavorável monitorada" : "Variação favorável monitorada";
      if (absContribution >= 30 || absPct >= 15 || Math.abs(desvio) >= adaptiveFloor * 8) {
        priorityLabel = adverse ? "Variação desfavorável material" : "Variação favorável material";
      } else if (budgetShare >= 15 || absMonth >= adaptiveFloor * 2) {
        priorityLabel = adverse ? "Ponto de atenção orçamentária" : "Aderência orçamentária favorável";
      }

      let trendLabel = "comportamento estável";
      if (acceleratingAgainstBudget) trendLabel = "deterioração na competência";
      else if (easingPressure) trendLabel = "redução da variação desfavorável na competência";
      else if (intensifyingSaving) trendLabel = "ampliação da variação favorável na competência";
      else if (!adverse && acceleration > adaptiveFloor) trendLabel = "menor contribuição favorável na competência";

      let insightType = adverse ? "risk" : "saving";
      if (absPct < 2 && absContribution < 8) insightType = "monitoring";
      if (acceleratingAgainstBudget) insightType = "acceleration";

      return { priorityLabel, trendLabel, insightType };
    }

    _scoreFeature(desvio, pctVar, contributionPct, monthDiff, acceleration, classification) {
      const riskBoost = desvio > 0 ? 1.15 : 1;
      const priorityBoost = classification.priorityLabel.includes("material") || classification.priorityLabel.includes("atenção") ? 1.25 : 1;
      const trendBoost = classification.insightType === "acceleration" ? 1.20 : 1;
      const varianceWeight = 1 + Math.min(Math.abs(pctVar), 80) / 200;
      const contributionWeight = 1 + Math.min(Math.abs(contributionPct), 150) / 150;
      return (Math.abs(desvio) * varianceWeight * contributionWeight * riskBoost * priorityBoost * trendBoost) + (Math.abs(monthDiff) * 0.35) + (Math.abs(acceleration) * 0.20);
    }

    _selectNarrativeRows(rankingTable, ytdIsSaving) {
      const adverse = rankingTable.filter(item => !item.isSaving);
      const savings = rankingTable.filter(item => item.isSaving);
      const selected = [];
      const addUnique = (item) => {
        if (item && !selected.some(existing => existing.itemName === item.itemName)) selected.push(item);
      };

      if (ytdIsSaving) {
        savings.slice(0, 2).forEach(addUnique);
        adverse.slice(0, 2).forEach(addUnique);
      } else {
        adverse.slice(0, 3).forEach(addUnique);
        savings.slice(0, 1).forEach(addUnique);
      }

      rankingTable.forEach(item => {
        if (selected.length < 4) addUnique(item);
      });

      return selected.slice(0, 4).sort((a, b) => b.score - a.score);
    }

    _buildSummary(selectedInsights) {
      return {
        mainDriver: selectedInsights[0] || null
      };
    }

    _attachDriverAccounts(selectedInsights, cubeData, currentYear, targetMonthNum, tempoDimId, versaoDimId, itemFinanceiroDimId, contaContabilDimId, measId, fullSeriesById) {
      if (!selectedInsights.length || !contaContabilDimId) return;

      const selectedNames = new Set(selectedInsights.map(item => item.itemName));
      const accountMaps = new Map();
      const ensureAccountMap = (itemName) => {
        if (!accountMaps.has(itemName)) accountMaps.set(itemName, new Map());
        return accountMaps.get(itemName);
      };

      cubeData.forEach(row => {
        if (!tempoDimId || !itemFinanceiroDimId) return;
        const tObj = row[tempoDimId];
        if (!tObj) return;

        const rowMonthNode = fullSeriesById.get(String(tObj.id));
        if (!rowMonthNode || rowMonthNode.yearValue !== currentYear || rowMonthNode.monthNum > targetMonthNum) return;

        const itemName = this._getMemberLabel(row, itemFinanceiroDimId, "Outros");
        if (!selectedNames.has(itemName) || this._isIgnoredMember(itemName)) return;

        const contaName = this._getMemberLabel(row, contaContabilDimId, "Geral");
        if (this._isIgnoredMember(contaName, true)) return;

        const rawValue = this._parseRawValue(row[measId] ? (row[measId].formattedValue || row[measId].raw || 0) : 0);
        const isBudget = this._isBudgetRow(row, versaoDimId);
        const itemAccounts = ensureAccountMap(itemName);
        if (!itemAccounts.has(contaName)) itemAccounts.set(contaName, { realizado: 0, orcado: 0 });
        const bucket = itemAccounts.get(contaName);
        if (isBudget) bucket.orcado += rawValue;
        else bucket.realizado += rawValue;
      });

      selectedInsights.forEach(item => {
        const itemAccounts = accountMaps.get(item.itemName);
        if (!itemAccounts) return;

        let bestName = "";
        let bestImpact = 0;
        let maxImpact = -1;
        itemAccounts.forEach((bucket, accountName) => {
          const impact = bucket.realizado - bucket.orcado;
          if (Math.abs(impact) > maxImpact) {
            maxImpact = Math.abs(impact);
            bestName = accountName;
            bestImpact = impact;
          }
        });

        item.driverConta = bestName;
        item.driverImpact = bestImpact;
        item.driverShare = item.desvio !== 0 ? (Math.abs(bestImpact) / Math.abs(item.desvio)) * 100 : 0;
      });
    }

    _parseRawValue(val) {
      if (typeof val === 'number') return val;
      if (!val || val === "-") return 0;
      return parseFloat(String(val).replace(/[^0-9.,-]/g, '').replace(',', '.')) || 0;
    }
  }

  /* ==========================================================================
     UI LAYER CONTROLLER WIDGET LAYER
     ========================================================================== */
  class EvoSummaryWidget extends HTMLElement {
    constructor() {
      super();
      this._props = {};
      this._currentData = null;
      this._shadowRoot = null;
      this._resizeTimeout = null;
      this._selectedCutoffId = null;
      this._isTreeBuilt = false; 
      this._isDropdownOpen = false; 
      this._yearRegex = /\d{4}/;
      this._monthOrderMap = { "JAN":1, "FEB":2, "MAR":3, "APR":4, "MAY":5, "JUN":6, "JUL":7, "AUG":8, "SEP":9, "OCT":10, "NOV":11, "DEC":12 };
      this._ytdSeriesMock = [{ value: 0, type: "historical" }, { value: 0, type: "actual" }, { value: 0, type: "budget" }];
      
      this._updateQueued = false;
      this._layoutUpdateQueued = false;
      this._analyticsEngine = new EvoNarrativeEngine();
      this._profiler = new EvoStreamProfiler();

      this._metadataSignature = "";
      this._metadataContext = null;
      this._seriesCache = null;
      this._lastVisualState = null;
      this._analysisCache = null;
      this._dataSignature = "";
      this._lastHighlightKey = "";
      this._lastPeriodSummaryKey = "";
      this._isHighlightDetailOpen = false;
      this._pendingHighlightDetailItems = [];
      this._highlightDetailRendered = false;
      this._responsiveSignature = "";
      this._activeTooltipPayload = null;
      this._pendingTooltipPosition = null;
      this._tooltipMoveQueued = false;
      this._tooltipCompositionCache = new Map();
      this._tooltipPayloadCache = new Map();
      this._tooltipCacheLimit = 6;
      this._activeView = "executive";
      this._waterfallMode = "ytd";
      this._lastAnalyticsViewContext = null;

      this._tempoDimId = null;
      this._versaoDimId = null;
      this._itemFinanceiroDimId = null;
      this._contaContabilDimId = null;
      this._fornecedorDimId = null;
      this._extraDimIds = [];
      this._reflowCount = 0;

      this._boundWindowClick = (e) => {
        const path = e.composedPath();
        if (this._isDropdownOpen && !path.includes(this._treeDropdownTrigger) && !path.includes(this._treeDropdownContent)) {
          this._isDropdownOpen = false;
          this._toggleDropdownDOM();
        }
        if (this._telemetryModal && this._telemetryModal.classList.contains("show") && !path.includes(this._telemetryBtn) && !path.includes(this._telemetryModal)) {
          this._telemetryModal.classList.remove("show");
        }
      };
      this._boundBarEnter = (e) => this._handleBarHover(e);
      this._boundBarMove = (e) => this._handleBarHover(e);
      this._boundBarLeave = () => this._hideBarTooltip();
    }

    connectedCallback() {
      if (!this._shadowRoot) {
        this._shadowRoot = this.attachShadow({ mode: "open" });
        this._shadowRoot.appendChild(template.content.cloneNode(true));
        
        this._widgetWrapper = this._shadowRoot.getElementById("widget-wrapper");
        this._chartArea = this._shadowRoot.getElementById("chartArea");
        this._ytdChartArea = this._shadowRoot.getElementById("ytdChartArea");
        this._monthlyConnectors = this._shadowRoot.getElementById("monthlyConnectors");
        this._ytdConnectors = this._shadowRoot.getElementById("ytdConnectors");
        this._axisX = this._shadowRoot.getElementById("axisX");
        this._insightGrid = this._shadowRoot.getElementById("insightGrid");
        this._treeDropdownTrigger = this._shadowRoot.getElementById("treeDropdownTrigger");
        this._treeDropdownContent = this._shadowRoot.getElementById("treeDropdownContent");
        this._exportPptBtn = this._shadowRoot.getElementById("exportPptBtn");
        this._executiveTabBtn = this._shadowRoot.getElementById("executiveTabBtn");
        this._diagnosticTabBtn = this._shadowRoot.getElementById("diagnosticTabBtn");
        this._supplierTabBtn = this._shadowRoot.getElementById("supplierTabBtn");
        this._executiveView = this._shadowRoot.getElementById("executiveView");
        this._diagnosticView = this._shadowRoot.getElementById("diagnosticView");
        this._supplierView = this._shadowRoot.getElementById("supplierView");
        this._execActualYtd = this._shadowRoot.getElementById("execActualYtd");
        this._execActualYtdSub = this._shadowRoot.getElementById("execActualYtdSub");
        this._execForecast = this._shadowRoot.getElementById("execForecast");
        this._execForecastSub = this._shadowRoot.getElementById("execForecastSub");
        this._execProjectedGap = this._shadowRoot.getElementById("execProjectedGap");
        this._execProjectedGapSub = this._shadowRoot.getElementById("execProjectedGapSub");
        this._execRiskPill = this._shadowRoot.getElementById("execRiskPill");
        this._execRiskSub = this._shadowRoot.getElementById("execRiskSub");
        this._waterfallChart = this._shadowRoot.getElementById("waterfallChart");
        this._waterfallCaption = this._shadowRoot.getElementById("waterfallCaption");
        this._waterfallYtdBtn = this._shadowRoot.getElementById("waterfallYtdBtn");
        this._waterfallMomBtn = this._shadowRoot.getElementById("waterfallMomBtn");
        this._executiveSummaryList = this._shadowRoot.getElementById("executiveSummaryList");
        this._supplierTopName = this._shadowRoot.getElementById("supplierTopName");
        this._supplierTopValue = this._shadowRoot.getElementById("supplierTopValue");
        this._supplierCount = this._shadowRoot.getElementById("supplierCount");
        this._supplierTop5Share = this._shadowRoot.getElementById("supplierTop5Share");
        this._supplierPeriodLabel = this._shadowRoot.getElementById("supplierPeriodLabel");
        this._supplierTableWrap = this._shadowRoot.getElementById("supplierTableWrap");
        this._widgetTitle = this._shadowRoot.getElementById("widgetTitle");
        this._periodSummaryBanner = this._shadowRoot.getElementById("periodSummaryBanner");
        
        this._telemetryBtn = this._shadowRoot.getElementById("telemetryBtn");
        this._telemetryModal = this._shadowRoot.getElementById("telemetryModal");
        this._closeTelemetry = this._shadowRoot.getElementById("closeTelemetry");
        this._lblTotal = this._shadowRoot.getElementById("tmTotal");
        this._lblJS = this._shadowRoot.getElementById("tmJS");
        this._lblDOM = this._shadowRoot.getElementById("tmDOM");
        this._lblFPS = this._shadowRoot.getElementById("tmFPS");
        this._lblParsing = this._shadowRoot.getElementById("stParsing");
        this._lblAggr = this._shadowRoot.getElementById("stAggr");
        this._lblStepDOM = this._shadowRoot.getElementById("stDOM");
        this._lblStepSVG = this._shadowRoot.getElementById("stSVG");
        this._lblStepHL = this._shadowRoot.getElementById("stHL");
        this._lblMem = this._shadowRoot.getElementById("tmMem");
        this._lblRedund = this._shadowRoot.getElementById("tmRedund");
        this._lblVol = this._shadowRoot.getElementById("tmVol");
        
        this._st10k = this._shadowRoot.getElementById("st10k");
        this._st25k = this._shadowRoot.getElementById("st25k");
        this._st50k = this._shadowRoot.getElementById("st50k");
        this._st100k = this._shadowRoot.getElementById("st100k");

        this._valDiffRow = this._shadowRoot.getElementById("val-diff-row");
        this._valPctRow = this._shadowRoot.getElementById("val-pct-row");
        this._valPctConsumptionRow = this._shadowRoot.getElementById("val-pct-consumption-row");
        this._ytdDiffRow = this._shadowRoot.getElementById("ytd-diff-row");
        this._ytdDiffPctBadge = this._shadowRoot.getElementById("ytd-diff-pct-badge");
        this._ytdPctRow = this._shadowRoot.getElementById("ytd-pct-row");
        this._highlightContentText = this._shadowRoot.getElementById("highlightContentText");
        this._highlightCardArea = this._shadowRoot.getElementById("highlightCardArea");
        this._barTooltip = this._shadowRoot.getElementById("barTooltip");

        // 🛠️ MAPEAMENTO SEGURO DAS MINI BARRAS ESTÁTICAS DE ACORDO COM O TEMPLATE
        this._miniBarPrev = this._shadowRoot.getElementById("mini-bar-prev");
        this._miniBarAct = this._shadowRoot.getElementById("mini-bar-act");
        this._miniBarBud = this._shadowRoot.getElementById("mini-bar-bud");
        this._miniLblPrev = this._shadowRoot.getElementById("mini-lbl-prev");
        this._miniLblAct = this._shadowRoot.getElementById("mini-lbl-act");
        this._miniLblBud = this._shadowRoot.getElementById("mini-lbl-bud");

        if (ENABLE_TELEMETRY) {
          this._telemetryBtn.style.display = "flex";
          this._telemetryBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            this._telemetryModal.classList.toggle("show");
          });
          this._closeTelemetry.addEventListener("click", () => {
            this._telemetryModal.classList.remove("show");
          });
          this._profiler.startFPSMonitor();
        }

        this._treeDropdownTrigger.addEventListener("click", (e) => {
          e.stopPropagation();
          this._isDropdownOpen = !this._isDropdownOpen;
          this._toggleDropdownDOM();
        });
        this._executiveTabBtn.addEventListener("click", () => this._setActiveView("executive"));
        this._diagnosticTabBtn.addEventListener("click", () => this._setActiveView("diagnostic"));
        this._supplierTabBtn.addEventListener("click", () => this._setActiveView("supplier"));
        this._exportPptBtn.addEventListener("click", () => this._exportCurrentViewToPpt());
        this._waterfallYtdBtn.addEventListener("click", () => this._setWaterfallMode("ytd"));
        this._waterfallMomBtn.addEventListener("click", () => this._setWaterfallMode("mom"));

        this._initStaticHighlightsDOM();
        this._setActiveView(this._activeView);
        this._applyResponsiveMode();
      }

      window.addEventListener("click", this._boundWindowClick);

      this._resizeObserver = new ResizeObserver(() => {
        if (!document.contains(this)) return;
        const layoutChanged = this._applyResponsiveMode();
        clearTimeout(this._resizeTimeout);
        this._resizeTimeout = setTimeout(() => {
          if (layoutChanged && this._currentData) {
            this.requestUpdate();
          } else {
            this.requestLayoutUpdate();
          }
        }, 40);
      });
      this._resizeObserver.observe(this);
    }

    disconnectedCallback() {
      if (this._resizeObserver) this._resizeObserver.disconnect();
      window.removeEventListener("click", this._boundWindowClick);
      clearTimeout(this._resizeTimeout);
      this._hideBarTooltip();
    }

    requestUpdate() {
      if (this._updateQueued) return;
      this._updateQueued = true;
      requestAnimationFrame(() => {
        this.renderChart();
        this._updateQueued = false;
      });
    }

    requestLayoutUpdate() {
      if (this._layoutUpdateQueued || !this._lastVisualState) return;
      this._layoutUpdateQueued = true;
      requestAnimationFrame(() => {
        const tSVGStart = performance.now();
        this._redrawConnectorsOnly();
        if (ENABLE_TELEMETRY) {
          this._profiler.metrics.steps.svgDrawing = performance.now() - tSVGStart;
          if (this._lblStepSVG) this._setText(this._lblStepSVG, `${this._profiler.metrics.steps.svgDrawing.toFixed(2)} ms`);
        }
        this._layoutUpdateQueued = false;
      });
    }

    _applyResponsiveMode() {
      const rect = this.getBoundingClientRect();
      const width = rect.width || this.offsetWidth || 0;
      const height = rect.height || this.offsetHeight || 0;

      let size = "regular";
      if (width > 0 && (width < 780 || height < 520)) {
        size = "compact";
      } else if (width >= 1180 && height >= 620) {
        size = "wide";
      }

      const layout = width > 0 && width < 1040 ? "stacked" : "split";
      const signature = `${size}|${layout}`;
      if (signature === this._responsiveSignature) return false;

      this._responsiveSignature = signature;
      this.setAttribute("data-size", size);
      this.setAttribute("data-layout", layout);
      return true;
    }

    _redrawConnectorsOnly() {
      if (!this._lastVisualState || !document.contains(this) || !this._shadowRoot) return;
      this._reflowCount++;
      this._drawUnifiedFlatConnections(this._monthlyConnectors, this._chartArea, ".bar-element", this._lastVisualState.visibleSeriesData, this._lastVisualState.visibleActualIndex, "monthly");
      this._drawUnifiedFlatConnections(this._ytdConnectors, this._ytdChartArea, ".bar-element", this._ytdSeriesMock, 1, "ytd");
    }

    _setText(node, value) {
      if (!node) return;
      const text = String(value);
      if (node.textContent !== text) node.textContent = text;
    }

    _setClass(node, value) {
      if (node && node.className !== value) node.className = value;
    }

    _setStyle(node, prop, value) {
      if (node && node.style[prop] !== value) node.style[prop] = value;
    }

    _shouldIgnoreCompositionMember(name) {
      const upper = String(name || "").toUpperCase();
      return (
        !upper ||
        upper.includes("TOTAL") ||
        upper.includes("ALL_MEMBERS") ||
        upper.includes("(ALL)") ||
        upper === "OUTROS" ||
        upper.includes("NÃO INFORMADO") ||
        upper.includes("NAO INFORMADO") ||
        upper.includes("RATEIO") ||
        upper.includes("LIQUIDA")
      );
    }

    _aggregateCompositionValue(map, name, value) {
      if (!map || !name) return;
      map[name] = (map[name] || 0) + value;
    }

    _rememberTooltipCache(cache, key, value) {
      if (cache.has(key)) cache.delete(key);
      cache.set(key, value);
      while (cache.size > this._tooltipCacheLimit) {
        const oldestKey = cache.keys().next().value;
        cache.delete(oldestKey);
      }
      return value;
    }

    _isBudgetVersionObject(versionNode) {
      if (!versionNode) return false;
      const vId = String(versionNode.id || "").toUpperCase();
      const vLabel = String(versionNode.label || versionNode.description || "").toUpperCase();
      return vId.includes("ORÇADO") || vId.includes("ORCADO") || vId.includes("BUDGET") || vLabel.includes("ORÇADO") || vLabel.includes("BUDGET");
    }

    _getTooltipComposition(seriesData, scope) {
      if (!seriesData || !seriesData.id || !this._currentData || !Array.isArray(this._currentData.data)) return {};
      const cacheKey = `${scope}|${seriesData.id}`;
      if (this._tooltipCompositionCache.has(cacheKey)) {
        const cached = this._tooltipCompositionCache.get(cacheKey);
        return this._rememberTooltipCache(this._tooltipCompositionCache, cacheKey, cached);
      }

      const composition = {};
      const targetId = String(seriesData.id);
      this._currentData.data.forEach(row => {
        const tempoObj = this._tempoDimId ? row[this._tempoDimId] : null;
        if (!tempoObj || String(tempoObj.id) !== targetId) return;

        const versionNode = this._versaoDimId ? row[this._versaoDimId] : null;
        if (this._versaoDimId && !versionNode) return;
        const isBudget = this._versaoDimId ? this._isBudgetVersionObject(versionNode) : false;
        if ((scope === "budget") !== isBudget) return;

        const itemNode = this._itemFinanceiroDimId ? row[this._itemFinanceiroDimId] : null;
        const itemName = itemNode ? (itemNode.label || itemNode.description || itemNode.id || null) : null;
        if (!itemName || this._shouldIgnoreCompositionMember(itemName)) return;

        const rawValue = this._parseValue(row[this._measId] ? (row[this._measId].formattedValue || row[this._measId].raw || 0) : 0);
        this._aggregateCompositionValue(composition, itemName, rawValue);
      });

      return this._rememberTooltipCache(this._tooltipCompositionCache, cacheKey, composition);
    }

    _buildTooltipItems(compositionMap, previousCompositionMap) {
      return Object.entries(compositionMap || {})
        .map(([name, value]) => {
          const previousValue = previousCompositionMap && previousCompositionMap[name] !== undefined ? previousCompositionMap[name] : null;
          const delta = this._getTooltipDelta({ value, previousValue });
          return { name, value, previousValue, delta };
        })
        .filter(item => Math.abs(item.value) > 0)
        .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    }

    _formatTooltipValue(value) {
      const sign = value >= 0 ? "" : "-";
      return `${sign}R$ ${Math.abs(value / 1000000).toFixed(2)}M`;
    }

    _getTooltipDelta(item) {
      if (!item || item.previousValue === null || item.previousValue === undefined) {
        return { label: "Sem base", className: "na" };
      }
      if (Math.abs(item.previousValue) < 0.00001) {
        return { label: "Nova base", className: "na" };
      }

      const deltaPct = ((item.value - item.previousValue) / Math.abs(item.previousValue)) * 100;
      if (Math.abs(deltaPct) < 0.05) {
        return { label: "0.0%", className: "flat" };
      }

      return {
        label: `${deltaPct > 0 ? "▲" : "▼"} ${Math.abs(deltaPct).toFixed(1)}%`,
        className: deltaPct > 0 ? "up" : "down"
      };
    }

    _getTooltipPayload(seriesData) {
      if (!seriesData) return null;
      const scope = seriesData.type === "budget" ? "budget" : "actual";
      const payloadCacheKey = `${scope}|${seriesData.id || seriesData.label}`;
      if (this._tooltipPayloadCache.has(payloadCacheKey)) {
        const cached = this._tooltipPayloadCache.get(payloadCacheKey);
        return this._rememberTooltipCache(this._tooltipPayloadCache, payloadCacheKey, cached);
      }

      const compositionMap = this._getTooltipComposition(seriesData, scope);
      const previousCompositionMap = seriesData.previousSeriesData
        ? this._getTooltipComposition(seriesData.previousSeriesData, scope)
        : null;
      const items = this._buildTooltipItems(compositionMap, previousCompositionMap);
      if (items.length === 0) return null;

      const scopeLabel = seriesData.type === "budget" ? "Orçado" : "Realizado";
      const payload = {
        title: seriesData.label || "Composição",
        subtitle: scopeLabel,
        items,
        key: payloadCacheKey
      };
      return this._rememberTooltipCache(this._tooltipPayloadCache, payloadCacheKey, payload);
    }

    _renderBarTooltip(payload) {
      if (!this._barTooltip || !payload) return;
      const rows = payload.items.map(item => {
        const delta = item.delta;
        return `<div class="bar-tooltip-row"><span class="bar-tooltip-name">${this._escapeHtml(item.name)}</span><span class="bar-tooltip-value-wrap"><span class="bar-tooltip-value">${this._escapeHtml(this._formatTooltipValue(item.value))}</span><span class="bar-tooltip-delta-tag ${this._escapeHtml(delta.className)}">${this._escapeHtml(delta.label)}</span></span></div>`;
      }).join("");

      this._barTooltip.innerHTML = `
        <div class="bar-tooltip-title">${this._escapeHtml(payload.title)}<span class="bar-tooltip-subtitle">${this._escapeHtml(payload.subtitle)}</span></div>
        <div class="bar-tooltip-list">${rows || '<div class="bar-tooltip-empty">Sem composição disponível.</div>'}</div>
      `;
      this._barTooltip.classList.add("show");
      this._barTooltip.setAttribute("aria-hidden", "false");
    }

    _positionBarTooltip(clientX, clientY) {
      if (!this._barTooltip || !this._widgetWrapper) return;
      const wrapperRect = this._widgetWrapper.getBoundingClientRect();
      const tooltipRect = this._barTooltip.getBoundingClientRect();
      const maxLeft = Math.max(8, wrapperRect.width - tooltipRect.width - 8);
      const maxTop = Math.max(8, wrapperRect.height - tooltipRect.height - 8);
      const desiredLeft = clientX - wrapperRect.left + 14;
      const desiredTop = clientY - wrapperRect.top - tooltipRect.height - 12;
      const fallbackTop = clientY - wrapperRect.top + 16;
      const topCandidate = desiredTop < 8 ? fallbackTop : desiredTop;
      const left = Math.min(Math.max(8, desiredLeft), maxLeft);
      const top = Math.min(Math.max(8, topCandidate), maxTop);
      this._setStyle(this._barTooltip, "left", `${left}px`);
      this._setStyle(this._barTooltip, "top", `${top}px`);
    }

    _handleBarHover(event) {
      const bar = event.currentTarget;
      const payload = this._getTooltipPayload(bar ? bar._seriesData : null);
      if (!payload) {
        this._hideBarTooltip();
        return;
      }

      const payloadKey = payload.key;
      if (!this._activeTooltipPayload || this._activeTooltipPayload !== payloadKey) {
        this._renderBarTooltip(payload);
        this._activeTooltipPayload = payloadKey;
      }
      this._pendingTooltipPosition = { clientX: event.clientX, clientY: event.clientY };
      if (!this._tooltipMoveQueued) {
        this._tooltipMoveQueued = true;
        requestAnimationFrame(() => {
          this._tooltipMoveQueued = false;
          if (!this._pendingTooltipPosition || !this._activeTooltipPayload) return;
          this._positionBarTooltip(this._pendingTooltipPosition.clientX, this._pendingTooltipPosition.clientY);
        });
      }
    }

    _hideBarTooltip() {
      if (!this._barTooltip) return;
      this._barTooltip.classList.remove("show");
      this._barTooltip.setAttribute("aria-hidden", "true");
      this._activeTooltipPayload = null;
      this._pendingTooltipPosition = null;
    }

    _escapeHtml(value) {
      return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    _initStaticHighlightsDOM() {
      const levelsWrapper = document.createElement("div");
      levelsWrapper.className = "highlight-content-levels";

      const summarySection = document.createElement("div");
      summarySection.className = "highlight-section highlight-summary-section";
      const summaryHeader = document.createElement("div");
      summaryHeader.className = "highlight-section-header";
      const summaryTitle = document.createElement("span");
      summaryTitle.className = "highlight-section-title";
      summaryTitle.textContent = "Resumo executivo";
      summaryHeader.appendChild(summaryTitle);
      this._hlSummaryUl = document.createElement("ul");
      this._hlSummaryUl.className = "ul-highlight";
      summarySection.appendChild(summaryHeader);
      summarySection.appendChild(this._hlSummaryUl);

      const detailSection = document.createElement("div");
      detailSection.className = "highlight-section highlight-detail-section";
      this._highlightDetailSection = detailSection;
      const detailHeader = document.createElement("div");
      detailHeader.className = "highlight-section-header";
      const detailTitle = document.createElement("span");
      detailTitle.className = "highlight-section-title";
      detailTitle.textContent = "Detalhamento analítico";
      detailHeader.appendChild(detailTitle);
      this._hlDetailUl = document.createElement("ul");
      this._hlDetailUl.className = "ul-highlight";
      detailSection.appendChild(detailHeader);
      detailSection.appendChild(this._hlDetailUl);

      this._highlightToggleBtn = document.createElement("button");
      this._highlightToggleBtn.type = "button";
      this._highlightToggleBtn.className = "highlight-toggle-btn";
      this._highlightToggleBtn.addEventListener("click", () => {
        this._isHighlightDetailOpen = !this._isHighlightDetailOpen;
        this._syncHighlightDetailVisibility();
      });

      summaryHeader.appendChild(this._highlightToggleBtn);
      levelsWrapper.appendChild(summarySection);
      levelsWrapper.appendChild(detailSection);
      this._highlightContentText.textContent = "";
      this._highlightContentText.appendChild(levelsWrapper);
      this._hlUl = this._hlSummaryUl;
      this._syncHighlightDetailVisibility();
    }

    _syncHighlightDetailVisibility() {
      if (this._highlightDetailSection) {
        this._highlightDetailSection.classList.toggle("show", this._isHighlightDetailOpen);
      }
      if (this._isHighlightDetailOpen && !this._highlightDetailRendered) {
        this._renderHighlightDetailItems();
      }
      if (this._highlightToggleBtn) {
        this._highlightToggleBtn.textContent = this._isHighlightDetailOpen ? "Ocultar detalhamento" : "Ver detalhamento";
        this._highlightToggleBtn.setAttribute("aria-expanded", this._isHighlightDetailOpen ? "true" : "false");
      }
    }

    _buildHighlightDetailItem(item) {
      const statusText = item.isSaving ? "variação favorável" : "variação desfavorável";
      const semanticColor = item.isSaving ? "#2E7D32" : "#D32F2F";
      const directionalArrow = item.isSaving ? "▼ " : "▲ ";
      const contributionText = item.contributionPct > 0
        ? `, representando ${Math.min(item.contributionPct, 999).toFixed(1)}% da variação líquida YTD`
        : "";
      const budgetShareText = item.budgetShare > 0 ? ` e participação de ${item.budgetShare.toFixed(1)}% no orçamento analisado` : "";

      const liItem = document.createElement("li");
      const sLabel = document.createElement("strong"); sLabel.textContent = `${item.priorityLabel} - ${item.itemName}: `;
      liItem.appendChild(sLabel);

      liItem.appendChild(document.createTextNode("No acumulado YTD, apresenta "));
      const spanStatus = document.createElement("span"); spanStatus.textContent = statusText; spanStatus.style.color = semanticColor; spanStatus.style.fontWeight = "700";
      liItem.appendChild(spanStatus);

      liItem.appendChild(document.createTextNode(` de R$ ${Math.abs(item.desvio/1000000).toFixed(2)}M (${directionalArrow}${Math.abs(item.pctVar).toFixed(2)}%)${contributionText}${budgetShareText}. Realizado acumulado de R$ ${(item.realizado/1000000).toFixed(2)}M versus orçamento de R$ ${(item.budget/1000000).toFixed(2)}M.`));

      if (item.trendLabel && item.trendLabel !== "comportamento estável") {
        const trendColor = item.insightType === "acceleration" ? "#D32F2F" : (item.isSaving ? "#2E7D32" : "#EF6C00");
        liItem.appendChild(document.createTextNode(" Comportamento recente: "));
        const spanTrend = document.createElement("span"); spanTrend.textContent = item.trendLabel; spanTrend.style.color = trendColor; spanTrend.style.fontWeight = "700";
        liItem.appendChild(spanTrend);
        liItem.appendChild(document.createTextNode(`, com variação mensal de ${(item.monthDiff >= 0 ? "+" : "")}${(item.monthDiff/1000000).toFixed(2)}M.`));
      }

      if (Math.abs(item.yoyDiff) > 0) {
        liItem.appendChild(document.createTextNode(` Em relação ao mesmo intervalo do ano anterior, o realizado apresentou variação de ${(item.yoyDiff >= 0 ? "+" : "")}${(item.yoyDiff/1000000).toFixed(2)}M (${item.yoyDiff >= 0 ? "aumento" : "redução"} de ${Math.abs(item.yoyPct).toFixed(1)}%).`));
      }

      if (item.driverConta && Math.abs(item.driverImpact) > 0) {
        const cSaving = item.driverImpact <= 0;
        const cColor = cSaving ? "#2E7D32" : "#D32F2F";
        const driverShareText = item.driverShare > 0 ? `, equivalente a ${Math.min(item.driverShare, 999).toFixed(1)}% da variação do item` : "";

        liItem.appendChild(document.createTextNode(" Principal natureza contábil: "));
        const spanConta = document.createElement("span"); spanConta.textContent = item.driverConta; spanConta.style.fontWeight = "700";
        liItem.appendChild(spanConta); liItem.appendChild(document.createTextNode(" com variação de "));

        const spanContaDiff = document.createElement("span");
        spanContaDiff.textContent = `${item.driverImpact >= 0 ? "+" : ""}${(item.driverImpact/1000000).toFixed(2)}M`;
        spanContaDiff.style.color = cColor;
        spanContaDiff.style.fontWeight = "700";
        liItem.appendChild(spanContaDiff);
        liItem.appendChild(document.createTextNode(`${driverShareText}.`));
      }

      return liItem;
    }

    _renderHighlightDetailItems() {
      if (!this._hlDetailUl) return;
      this._hlDetailUl.textContent = "";
      const fragment = document.createDocumentFragment();
      this._pendingHighlightDetailItems.forEach(item => {
        fragment.appendChild(this._buildHighlightDetailItem(item));
      });
      this._hlDetailUl.appendChild(fragment);
      this._highlightDetailRendered = true;
    }

    _setActiveView(viewName) {
      this._activeView = viewName === "diagnostic" || viewName === "supplier" ? viewName : "executive";
      const isExecutive = this._activeView === "executive";
      const isDiagnostic = this._activeView === "diagnostic";
      const isSupplier = this._activeView === "supplier";
      if (this._executiveView) this._executiveView.classList.toggle("active", isExecutive);
      if (this._diagnosticView) this._diagnosticView.classList.toggle("active", isDiagnostic);
      if (this._supplierView) this._supplierView.classList.toggle("active", isSupplier);
      if (this._executiveTabBtn) {
        this._executiveTabBtn.classList.toggle("active", isExecutive);
        this._executiveTabBtn.setAttribute("aria-selected", isExecutive ? "true" : "false");
      }
      if (this._diagnosticTabBtn) {
        this._diagnosticTabBtn.classList.toggle("active", isDiagnostic);
        this._diagnosticTabBtn.setAttribute("aria-selected", isDiagnostic ? "true" : "false");
      }
      if (this._supplierTabBtn) {
        this._supplierTabBtn.classList.toggle("active", isSupplier);
        this._supplierTabBtn.setAttribute("aria-selected", isSupplier ? "true" : "false");
      }
      if (this._lastAnalyticsViewContext) this._renderAnalyticsViews();
      if (isDiagnostic) {
        requestAnimationFrame(() => this.requestLayoutUpdate());
      }
    }

    _setWaterfallMode(mode) {
      this._waterfallMode = mode === "mom" ? "mom" : "ytd";
      if (this._waterfallYtdBtn) this._waterfallYtdBtn.classList.toggle("active", this._waterfallMode === "ytd");
      if (this._waterfallMomBtn) this._waterfallMomBtn.classList.toggle("active", this._waterfallMode === "mom");
      this._renderAnalyticsViews();
    }

    _getInsightRows(rows) {
      return rows || [];
    }

    _getWaterfallRows(rows) {
      return rows || [];
    }

    _getMoMDriverRows(context) {
      const currentNode = context.currentBarNode;
      const previousNode = currentNode ? currentNode.previousSeriesData : null;
      if (!currentNode || !previousNode) return [];

      const currentComposition = this._getTooltipComposition(currentNode, "actual");
      const previousComposition = this._getTooltipComposition(previousNode, "actual");
      const names = new Set([...Object.keys(currentComposition || {}), ...Object.keys(previousComposition || {})]);
      const rows = [];
      names.forEach(name => {
        const currentValue = currentComposition[name] || 0;
        const previousValue = previousComposition[name] || 0;
        const delta = currentValue - previousValue;
        if (Math.abs(delta) <= 0.00001) return;
        rows.push({
          itemName: name,
          delta,
          pctVar: previousValue !== 0 ? (delta / Math.abs(previousValue)) * 100 : 999,
          currentValue,
          previousValue
        });
      });
      return rows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    }

    _getWaterfallModel(context) {
      if (this._waterfallMode === "mom") {
        const previousNode = context.currentBarNode ? context.currentBarNode.previousSeriesData : null;
        const rawRows = this._getMoMDriverRows(context);
        const filteredRows = this._getWaterfallRows(rawRows).slice(0, 6);
        const startValue = previousNode ? previousNode.value : 0;
        const endValue = context.currentBarNode ? context.currentBarNode.value : 0;
        return {
          mode: "mom",
          startLabel: previousNode ? previousNode.label : "Mês anterior",
          endLabel: context.currentBarNode ? context.currentBarNode.label : "Mês atual",
          startValue,
          endValue,
          rows: filteredRows,
          totalDelta: endValue - startValue,
          caption: previousNode
            ? `Ponte da variação mensal do realizado: ${previousNode.label} para ${context.currentBarNode.label}.`
            : "Sem mês anterior disponível para calcular MoM realizado."
        };
      }

      const rawRows = (context.analysis.waterfallTable || []).map(item => ({
        itemName: item.itemName,
        delta: item.desvio,
        pctVar: item.pctVar,
        isSaving: item.isSaving
      }));
      const filteredRows = this._getWaterfallRows(rawRows)
        .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
        .slice(0, 6);
      return {
        mode: "ytd",
        startLabel: "Orçamento YTD",
        endLabel: "Realizado YTD",
        startValue: context.totalBudgetYTDCompleto,
        endValue: context.totalRealizadoYTDAtual,
        rows: filteredRows,
        totalDelta: context.totalRealizadoYTDAtual - context.totalBudgetYTDCompleto,
        caption: "Ponte entre orçamento acumulado e realizado acumulado, explicada pelos principais drivers filtrados."
      };
    }

    _getForecastSummary(context) {
      const elapsedMonths = Math.max(1, context.currentBarNode.monthNum);
      const remainingMonths = Math.max(0, 12 - elapsedMonths);
      const monthlyRunRate = context.totalRealizadoYTDAtual / elapsedMonths;
      const monthlyBudgetRunRate = context.totalBudgetYTDCompleto / elapsedMonths;
      const projectedActual = context.totalRealizadoYTDAtual + (monthlyRunRate * remainingMonths);
      const projectedBudget = context.totalBudgetYTDCompleto + (monthlyBudgetRunRate * remainingMonths);
      const projectedGap = projectedActual - projectedBudget;
      const projectedPct = projectedBudget !== 0 ? (projectedGap / projectedBudget) * 100 : 0;
      return { elapsedMonths, remainingMonths, projectedActual, projectedBudget, projectedGap, projectedPct };
    }

    _getRiskState(context, forecastSummary) {
      const absProjectedPct = Math.abs(forecastSummary.projectedPct);
      if (forecastSummary.projectedGap <= 0 && absProjectedPct <= 5) {
        return { label: "Controlado", className: "good", description: "Forecast dentro do orçamento projetado." };
      }
      if (forecastSummary.projectedGap <= 0 || absProjectedPct <= 10) {
        return { label: "Acompanhar", className: "watch", description: "Pressão moderada no fechamento projetado." };
      }
      return { label: "Atenção", className: "alert", description: "Risco material de estouro no fechamento." };
    }

    _renderAnalyticsViews() {
      if (!this._lastAnalyticsViewContext) return;
      const context = this._lastAnalyticsViewContext;
      const filteredRows = this._getInsightRows(context.analysis.waterfallTable);
      const detailRows = this._getInsightRows(context.analysis.outlierTable);
      this._pendingHighlightDetailItems = detailRows;
      this._highlightDetailRendered = false;
      if (this._highlightToggleBtn) {
        this._setStyle(this._highlightToggleBtn, "display", detailRows.length > 0 ? "inline-flex" : "none");
      }
      if (this._isHighlightDetailOpen) this._renderHighlightDetailItems();
      this._renderExecutiveView(context, filteredRows);
      this._renderSupplierView(context);
    }

    _renderExecutiveView(context, filteredRows) {
      if (!this._executiveView) return;
      const formatM = (value) => `${value >= 0 ? "" : "-"}R$ ${Math.abs(value / 1000000).toFixed(2)}M`;
      const forecast = this._getForecastSummary(context);
      const risk = this._getRiskState(context, forecast);
      const ytdGapText = `${context.diffYtdNominal >= 0 ? "+" : ""}${(context.diffYtdNominal / 1000000).toFixed(2)}M`;
      const forecastGapText = `${forecast.projectedGap >= 0 ? "+" : ""}${(forecast.projectedGap / 1000000).toFixed(2)}M`;

      this._setText(this._execActualYtd, formatM(context.totalRealizadoYTDAtual));
      this._setText(this._execActualYtdSub, `Desvio atual ${ytdGapText} vs orçamento YTD`);
      this._setText(this._execForecast, formatM(forecast.projectedActual));
      this._setText(this._execForecastSub, `Baseado em run rate de ${forecast.elapsedMonths} mês(es)`);
      this._setText(this._execProjectedGap, formatM(forecast.projectedGap));
      this._setText(this._execProjectedGapSub, `${forecastGapText} vs orçamento projetado`);
      this._setClass(this._execRiskPill, `risk-pill ${risk.className}`);
      this._setText(this._execRiskPill, risk.label);
      this._setText(this._execRiskSub, risk.description);

      const waterfallModel = this._getWaterfallModel(context);
      this._renderWaterfall(waterfallModel);
      this._renderExecutiveSummary(context, filteredRows, forecast, risk, waterfallModel);
    }

    _renderWaterfall(model) {
      if (!this._waterfallChart) return;
      this._waterfallChart.textContent = "";
      if (this._waterfallCaption) this._setText(this._waterfallCaption, model.caption);

      if (model.mode === "mom" && !model.rows.length && !model.totalDelta) {
        const empty = document.createElement("div");
        empty.className = "waterfall-empty";
        empty.textContent = "Sem base anterior disponível para a ponte MoM.";
        this._waterfallChart.appendChild(empty);
        return;
      }

      const explainedGap = model.rows.reduce((sum, item) => sum + item.delta, 0);
      const residualGap = model.totalDelta - explainedGap;
      const steps = [
        { label: model.startLabel, value: model.startValue, type: "total" },
        ...model.rows.map(item => ({ label: item.itemName, delta: item.delta, type: item.delta >= 0 ? "positive" : "negative" })),
        ...(Math.abs(residualGap) > 0.00001 ? [{ label: "Demais itens", delta: residualGap, type: residualGap >= 0 ? "positive" : "negative" }] : []),
        { label: model.endLabel, value: model.endValue, type: "total" }
      ];

      let current = model.startValue;
      const levels = [model.startValue, model.endValue];
      steps.forEach(step => {
        if (step.delta !== undefined) {
          levels.push(current, current + step.delta);
          current += step.delta;
        }
      });
      let minLevel = Math.min(...levels);
      let maxLevel = Math.max(...levels);
      const padding = Math.max((maxLevel - minLevel) * 0.08, Math.max(Math.abs(model.totalDelta) * 0.12, 1));
      minLevel -= padding;
      maxLevel += padding;
      const range = maxLevel - minLevel || 1;
      current = model.startValue;
      const fragment = document.createDocumentFragment();

      steps.forEach(step => {
        let startValue;
        let endValue;
        if (step.type === "total") {
          startValue = minLevel;
          endValue = step.value;
        } else {
          startValue = current;
          endValue = current + step.delta;
          current = endValue;
        }
        const lower = Math.min(startValue, endValue);
        const upper = Math.max(startValue, endValue);
        const bottomPct = ((lower - minLevel) / range) * 100;
        const heightPct = Math.max(((upper - lower) / range) * 100, 2);
        const shownValue = step.type === "total" ? step.value : step.delta;

        const stepEl = document.createElement("div");
        stepEl.className = "waterfall-step";
        const valueEl = document.createElement("div");
        valueEl.className = "waterfall-value";
        valueEl.textContent = `${shownValue >= 0 ? "" : "-"}R$ ${Math.abs(shownValue / 1000000).toFixed(2)}M`;
        const wrapEl = document.createElement("div");
        wrapEl.className = "waterfall-bar-wrap";
        const barEl = document.createElement("div");
        barEl.className = `waterfall-bar ${step.type}`;
        barEl.style.bottom = `${bottomPct}%`;
        barEl.style.height = `${heightPct}%`;
        const labelEl = document.createElement("div");
        labelEl.className = "waterfall-label";
        labelEl.textContent = this._compactWaterfallLabel(step.label);
        labelEl.title = step.label;
        wrapEl.appendChild(barEl);
        stepEl.appendChild(valueEl);
        stepEl.appendChild(wrapEl);
        stepEl.appendChild(labelEl);
        fragment.appendChild(stepEl);
      });

      this._waterfallChart.appendChild(fragment);
    }

    _compactWaterfallLabel(label) {
      const text = String(label || "");
      if (text.length <= 18) return text;
      return `${text.slice(0, 16)}…`;
    }

    _renderExecutiveSummary(context, filteredRows, forecast, risk, waterfallModel) {
      if (!this._executiveSummaryList) return;
      this._executiveSummaryList.textContent = "";
      const fragment = document.createDocumentFragment();
      const topDrivers = [...filteredRows].sort((a, b) => Math.abs(b.desvio) - Math.abs(a.desvio)).slice(0, 3);
      const concentration = context.diffYtdNominal !== 0
        ? (topDrivers.reduce((sum, item) => sum + Math.abs(item.desvio), 0) / Math.abs(context.diffYtdNominal)) * 100
        : 0;
      const waterfallText = waterfallModel.mode === "mom"
        ? `No MoM realizado, a ponte mostra variação de ${(waterfallModel.totalDelta >= 0 ? "+" : "")}${(waterfallModel.totalDelta / 1000000).toFixed(2)}M entre ${waterfallModel.startLabel} e ${waterfallModel.endLabel}.`
        : `No YTD Real x Orçado, a ponte explica ${(waterfallModel.totalDelta >= 0 ? "+" : "")}${(waterfallModel.totalDelta / 1000000).toFixed(2)}M de variação acumulada.`;
      const bullets = [
        `O YTD encerra com ${context.diffYtdNominal <= 0 ? "variação favorável" : "variação desfavorável"} de R$ ${Math.abs(context.diffYtdNominal / 1000000).toFixed(2)}M.`,
        `O forecast projeta R$ ${(forecast.projectedActual / 1000000).toFixed(2)}M no fechamento e mantém o status ${risk.label.toLowerCase()}.`,
        waterfallText,
        topDrivers.length > 0
          ? `Os ${topDrivers.length} maiores drivers explicam ${Math.min(concentration, 999).toFixed(1)}% da variação YTD.`
          : "Nenhum driver relevante foi identificado para o período."
      ];
      bullets.forEach(text => {
        const li = document.createElement("li");
        li.textContent = text;
        fragment.appendChild(li);
      });
      this._executiveSummaryList.appendChild(fragment);
    }

    _buildSupplierAnalysis(context) {
      if (!this._fornecedorDimId || !this._currentData || !Array.isArray(this._currentData.data)) {
        return { rows: [], currentTotal: 0, ytdTotal: 0 };
      }

      const currentYear = context.currentBarNode.yearValue;
      const cutoffMonth = context.currentBarNode.monthNum;
      const currentMonthId = String(context.currentBarNode.id);
      const suppliers = new Map();
      const ensureSupplier = (name) => {
        if (!suppliers.has(name)) {
          suppliers.set(name, { name, currentRealizado: 0, currentOrcado: 0, ytdRealizado: 0, ytdOrcado: 0 });
        }
        return suppliers.get(name);
      };

      this._currentData.data.forEach(row => {
        const tempoObj = this._tempoDimId ? row[this._tempoDimId] : null;
        if (!tempoObj) return;
        const seriesNode = context.fullSeriesById ? context.fullSeriesById.get(String(tempoObj.id)) : null;
        if (!seriesNode) return;
        const isCurrentMonth = String(tempoObj.id) === currentMonthId;
        const isCurrentYtd = seriesNode.yearValue === currentYear && seriesNode.monthNum <= cutoffMonth;
        if (!isCurrentMonth && !isCurrentYtd) return;

        const fornecedor = this._getRowMemberLabel(row, this._fornecedorDimId, "Fornecedor não informado");
        if (this._shouldIgnoreCompositionMember(fornecedor)) return;
        const rawValue = this._parseValue(row[this._measId] ? (row[this._measId].formattedValue || row[this._measId].raw || 0) : 0);
        const isBudget = this._versaoDimId ? this._isBudgetVersionObject(row[this._versaoDimId]) : false;
        const supplier = ensureSupplier(fornecedor);

        if (isCurrentMonth) {
          if (isBudget) supplier.currentOrcado += rawValue;
          else supplier.currentRealizado += rawValue;
        }
        if (isCurrentYtd) {
          if (isBudget) supplier.ytdOrcado += rawValue;
          else supplier.ytdRealizado += rawValue;
        }
      });

      const rows = Array.from(suppliers.values())
        .filter(item => Math.abs(item.ytdRealizado) > 0 || Math.abs(item.currentRealizado) > 0)
        .map(item => ({
          ...item,
          currentDelta: item.currentRealizado - item.currentOrcado,
          ytdDelta: item.ytdRealizado - item.ytdOrcado,
          ytdShare: 0
        }))
        .sort((a, b) => Math.abs(b.ytdRealizado) - Math.abs(a.ytdRealizado));
      const ytdTotal = rows.reduce((sum, item) => sum + Math.abs(item.ytdRealizado), 0);
      const currentTotal = rows.reduce((sum, item) => sum + Math.abs(item.currentRealizado), 0);
      rows.forEach(item => {
        item.ytdShare = ytdTotal !== 0 ? (Math.abs(item.ytdRealizado) / ytdTotal) * 100 : 0;
      });
      return { rows, currentTotal, ytdTotal };
    }

    _renderSupplierView(context) {
      if (!this._supplierView) return;
      const formatM = (value) => `${value >= 0 ? "" : "-"}R$ ${Math.abs(value / 1000000).toFixed(2)}M`;
      if (!this._fornecedorDimId) {
        this._setText(this._supplierTopName, "Dimensão ausente");
        this._setText(this._supplierTopValue, "Inclua Fornecedor no data binding.");
        this._setText(this._supplierCount, "-");
        this._setText(this._supplierTop5Share, "-");
        this._setText(this._supplierPeriodLabel, context.currentBarNode ? context.currentBarNode.label : "-");
        if (this._supplierTableWrap) this._supplierTableWrap.innerHTML = `<div class="supplier-empty">A dimensão Fornecedor ainda não foi vinculada ao widget.</div>`;
        return;
      }

      const analysis = this._buildSupplierAnalysis(context);
      const topSupplier = analysis.rows[0] || null;
      const top5Total = analysis.rows.slice(0, 5).reduce((sum, item) => sum + Math.abs(item.ytdRealizado), 0);
      const top5Share = analysis.ytdTotal !== 0 ? (top5Total / analysis.ytdTotal) * 100 : 0;

      this._setText(this._supplierTopName, topSupplier ? topSupplier.name : "-");
      this._setText(this._supplierTopValue, topSupplier ? `${formatM(topSupplier.ytdRealizado)} no YTD` : "Sem realizado no período");
      this._setText(this._supplierCount, analysis.rows.length);
      this._setText(this._supplierTop5Share, `${top5Share.toFixed(1)}%`);
      this._setText(this._supplierPeriodLabel, `Corte ${context.currentBarNode.label}`);

      if (!this._supplierTableWrap) return;
      if (!analysis.rows.length) {
        this._supplierTableWrap.innerHTML = `<div class="supplier-empty">Sem fornecedores com realizado para o período selecionado.</div>`;
        return;
      }

      const rowsHtml = analysis.rows.slice(0, 12).map(item => `
        <tr>
          <td>${this._escapeHtml(item.name)}</td>
          <td class="num">${this._escapeHtml(formatM(item.currentRealizado))}</td>
          <td class="num">${this._escapeHtml(formatM(item.currentDelta))}</td>
          <td class="num">${this._escapeHtml(formatM(item.ytdRealizado))}</td>
          <td class="num">${this._escapeHtml(formatM(item.ytdDelta))}</td>
          <td class="num">${item.ytdShare.toFixed(1)}%</td>
        </tr>
      `).join("");

      this._supplierTableWrap.innerHTML = `
        <table class="supplier-table">
          <thead>
            <tr>
              <th>Fornecedor</th>
              <th>Realizado Mês</th>
              <th>Desvio Mês</th>
              <th>Realizado YTD</th>
              <th>Desvio YTD</th>
              <th>Part. YTD</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      `;
    }

    async _exportCurrentViewToPpt() {
      if (!this._widgetWrapper || !this._exportPptBtn) return;
      const originalLabel = this._exportPptBtn.textContent;
      try {
        const snapshot = await this._captureWidgetPng();
        this._exportPptBtn.disabled = true;
        this._setText(this._exportPptBtn, "Gerando PPT...");
        const pptBlob = this._buildPptxBlob(snapshot.dataUrl, snapshot.width, snapshot.height);
        const url = URL.createObjectURL(pptBlob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `performance-summary-${this._activeView}.pptx`;
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (error) {
        console.error("Falha ao exportar PPT", error);
      } finally {
        this._exportPptBtn.disabled = false;
        this._setText(this._exportPptBtn, originalLabel);
      }
    }

    async _captureWidgetPng() {
      if (document.fonts && document.fonts.ready) {
        try { await document.fonts.ready; } catch (e) { /* no-op */ }
      }

      const rect = this._widgetWrapper.getBoundingClientRect();
      const width = Math.max(1, Math.ceil(rect.width));
      const height = Math.max(1, Math.ceil(rect.height));
      const clone = this._widgetWrapper.cloneNode(true);
      const sourceInputs = this._widgetWrapper.querySelectorAll("input");
      const cloneInputs = clone.querySelectorAll("input");
      sourceInputs.forEach((input, index) => {
        const cloneInput = cloneInputs[index];
        if (!cloneInput) return;
        cloneInput.setAttribute("value", input.value);
        if (input.checked) cloneInput.setAttribute("checked", "checked");
        else cloneInput.removeAttribute("checked");
      });
      const styles = Array.from(this._shadowRoot.querySelectorAll("style"))
        .map(style => style.textContent.replace(/:host/g, ".export-host"))
        .join("\n");
      const serialized = new XMLSerializer().serializeToString(clone);
      const sizeAttr = this.getAttribute("data-size") || "regular";
      const layoutAttr = this.getAttribute("data-layout") || "split";
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
          <foreignObject width="100%" height="100%">
            <div xmlns="http://www.w3.org/1999/xhtml" class="export-host" data-size="${sizeAttr}" data-layout="${layoutAttr}" style="width:${width}px;height:${height}px;">
              <style>${styles}</style>
              ${serialized}
            </div>
          </foreignObject>
        </svg>
      `;
      const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = svgUrl;
      });
      const scale = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const ctx = canvas.getContext("2d");
      ctx.scale(scale, scale);
      ctx.drawImage(image, 0, 0, width, height);
      return { dataUrl: canvas.toDataURL("image/png"), width, height };
    }

    _buildPptxBlob(pngDataUrl, width, height) {
      const encoder = new TextEncoder();
      const pngBytes = this._base64ToBytes(pngDataUrl.split(",")[1]);
      const slideWidth = 12192000;
      const slideHeight = Math.round(slideWidth * (height / width));
      const now = new Date().toISOString();
      const entries = [
        {
          path: "[Content_Types].xml",
          data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
              <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
              <Default Extension="xml" ContentType="application/xml"/>
              <Default Extension="png" ContentType="image/png"/>
              <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
              <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
              <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
              <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
              <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
              <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
              <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
            </Types>`)
        },
        {
          path: "_rels/.rels",
          data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
              <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
              <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
              <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
            </Relationships>`)
        },
        {
          path: "docProps/core.xml",
          data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
              <dc:title>Performance Summary</dc:title>
              <dc:creator>Performance Summary Widget</dc:creator>
              <cp:lastModifiedBy>Performance Summary Widget</cp:lastModifiedBy>
              <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
              <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
            </cp:coreProperties>`)
        },
        {
          path: "docProps/app.xml",
          data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
              <Application>Performance Summary Widget</Application>
              <Slides>1</Slides>
            </Properties>`)
        },
        {
          path: "ppt/presentation.xml",
          data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
              <p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
              <p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst>
              <p:sldSz cx="${slideWidth}" cy="${slideHeight}" type="custom"/>
              <p:notesSz cx="6858000" cy="9144000"/>
            </p:presentation>`)
        },
        {
          path: "ppt/_rels/presentation.xml.rels",
          data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
              <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
              <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
            </Relationships>`)
        },
        {
          path: "ppt/slides/slide1.xml",
          data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
              <p:cSld><p:spTree>
                <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
                <p:grpSpPr/>
                <p:pic>
                  <p:nvPicPr><p:cNvPr id="2" name="Widget Snapshot"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>
                  <p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>
                  <p:spPr>
                    <a:xfrm><a:off x="0" y="0"/><a:ext cx="${slideWidth}" cy="${slideHeight}"/></a:xfrm>
                    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
                  </p:spPr>
                </p:pic>
              </p:spTree></p:cSld>
              <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
            </p:sld>`)
        },
        {
          path: "ppt/slides/_rels/slide1.xml.rels",
          data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
              <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
              <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/>
            </Relationships>`)
        },
        {
          path: "ppt/slideMasters/slideMaster1.xml",
          data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
              <p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
              <p:clrMap accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" bg1="lt1" bg2="lt2" folHlink="folHlink" hlink="hlink" tx1="dk1" tx2="dk2"/>
              <p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
              <p:txStyles/>
            </p:sldMaster>`)
        },
        {
          path: "ppt/slideMasters/_rels/slideMaster1.xml.rels",
          data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
              <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
              <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
            </Relationships>`)
        },
        {
          path: "ppt/slideLayouts/slideLayout1.xml",
          data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1">
              <p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
              <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
            </p:sldLayout>`)
        },
        {
          path: "ppt/slideLayouts/_rels/slideLayout1.xml.rels",
          data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
              <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
            </Relationships>`)
        },
        {
          path: "ppt/theme/theme1.xml",
          data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office Theme">
              <a:themeElements>
                <a:clrScheme name="Office"><a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="1F497D"/></a:dk2><a:lt2><a:srgbClr val="EEECE1"/></a:lt2><a:accent1><a:srgbClr val="4F81BD"/></a:accent1><a:accent2><a:srgbClr val="C0504D"/></a:accent2><a:accent3><a:srgbClr val="9BBB59"/></a:accent3><a:accent4><a:srgbClr val="8064A2"/></a:accent4><a:accent5><a:srgbClr val="4BACC6"/></a:accent5><a:accent6><a:srgbClr val="F79646"/></a:accent6><a:hlink><a:srgbClr val="0000FF"/></a:hlink><a:folHlink><a:srgbClr val="800080"/></a:folHlink></a:clrScheme>
                <a:fontScheme name="Office">
                  <a:majorFont><a:latin typeface="Arial"/></a:majorFont>
                  <a:minorFont><a:latin typeface="Arial"/></a:minorFont>
                </a:fontScheme>
                <a:fmtScheme name="Office">
                  <a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>
                  <a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>
                  <a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>
                  <a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst>
                </a:fmtScheme>
              </a:themeElements>
            </a:theme>`)
        },
        { path: "ppt/media/image1.png", data: pngBytes }
      ];
      return new Blob([this._zipEntries(entries)], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
    }

    _base64ToBytes(base64) {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return bytes;
    }

    _zipEntries(entries) {
      const encoder = new TextEncoder();
      const localFiles = [];
      const centralFiles = [];
      let offset = 0;
      entries.forEach(entry => {
        const nameBytes = encoder.encode(entry.path);
        const data = entry.data instanceof Uint8Array ? entry.data : new Uint8Array(entry.data);
        const crc = this._crc32(data);
        const localHeader = this._concatBytes([
          this._u32(0x04034b50), this._u16(20), this._u16(0), this._u16(0), this._u16(0), this._u16(0),
          this._u32(crc), this._u32(data.length), this._u32(data.length), this._u16(nameBytes.length), this._u16(0), nameBytes
        ]);
        localFiles.push(localHeader, data);

        const centralHeader = this._concatBytes([
          this._u32(0x02014b50), this._u16(20), this._u16(20), this._u16(0), this._u16(0), this._u16(0), this._u16(0),
          this._u32(crc), this._u32(data.length), this._u32(data.length), this._u16(nameBytes.length), this._u16(0), this._u16(0),
          this._u16(0), this._u16(0), this._u32(0), this._u32(offset), nameBytes
        ]);
        centralFiles.push(centralHeader);
        offset += localHeader.length + data.length;
      });
      const centralDirectory = this._concatBytes(centralFiles);
      const localSection = this._concatBytes(localFiles);
      const endRecord = this._concatBytes([
        this._u32(0x06054b50), this._u16(0), this._u16(0), this._u16(entries.length), this._u16(entries.length),
        this._u32(centralDirectory.length), this._u32(localSection.length), this._u16(0)
      ]);
      return this._concatBytes([localSection, centralDirectory, endRecord]);
    }

    _crc32(bytes) {
      let crc = -1;
      for (let i = 0; i < bytes.length; i++) {
        crc ^= bytes[i];
        for (let j = 0; j < 8; j++) {
          crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
        }
      }
      return (crc ^ -1) >>> 0;
    }

    _u16(value) {
      return new Uint8Array([value & 0xff, (value >>> 8) & 0xff]);
    }

    _u32(value) {
      return new Uint8Array([value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff]);
    }

    _concatBytes(chunks) {
      const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const output = new Uint8Array(total);
      let offset = 0;
      chunks.forEach(chunk => {
        output.set(chunk, offset);
        offset += chunk.length;
      });
      return output;
    }

    _toggleDropdownDOM() {
      if (this._treeDropdownContent) {
        this._treeDropdownContent.classList.toggle("show", this._isDropdownOpen);
      }
    }

    onCustomWidgetBeforeUpdate(changedProperties) {
      this._props = { ...this._props, ...changedProperties };
    }

    onCustomWidgetAfterUpdate(changedProperties) {
      this._updateStyles();
      if ("performanceCube" in changedProperties && this.performanceCube) {
        if (this._profiler.verifyRedundancy(this.performanceCube)) {
          if (ENABLE_TELEMETRY) this._setText(this._lblRedund, this._profiler.metrics.redundantRenders);
          return; 
        }

        this._currentData = this.performanceCube;
        this._dataSignature = this._profiler._lastDataSignature || this._profiler._buildDataSignature(this.performanceCube);
        this._selectedCutoffId = null;
        this._isTreeBuilt = false; 
        this._seriesCache = null;
        this._lastVisualState = null;
        this._analysisCache = null;
        this._lastHighlightKey = "";
        this._lastPeriodSummaryKey = "";
        this._pendingHighlightDetailItems = [];
        this._highlightDetailRendered = false;
        this._tooltipCompositionCache.clear();
        this._tooltipPayloadCache.clear();
        if (this._shadowRoot) {
          this._treeDropdownContent.textContent = ""; 
          this.requestUpdate();
        }
      }
    }

    _updateStyles() {
      if (!this._shadowRoot) return;
      const style = this.style;
      if (this._props.colorActualMonth) style.setProperty("--color-actual", this._props.colorActualMonth);
      if (this._props.colorHistorical) style.setProperty("--color-historical", this._props.colorHistorical);
      if (this._props.colorBudget) style.setProperty("--color-budget", this._props.colorBudget);
      if (this._props.fontSizeLabels) style.setProperty("--font-size-labels", `${this._props.fontSizeLabels}px`);
    }

    _parseValue(val) {
      if (typeof val === 'number') return val;
      if (!val || val === "-") return 0;
      return parseFloat(String(val).replace(/[^0-9.,-]/g, '').replace(',', '.')) || 0;
    }

    _getRowMemberLabel(row, dimId, fallback) {
      if (!dimId || !row || !row[dimId]) return fallback;
      const node = row[dimId];
      return node.label || node.description || node.id || fallback;
    }

    _getMetadataContext(metadata) {
      const dimensions = metadata.dimensions || {};
      const mainStructureMembers = metadata.mainStructureMembers || {};
      const dimKeys = Object.keys(dimensions);
      const measureKeys = Object.keys(mainStructureMembers);

      if (dimKeys.length < 1 || measureKeys.length < 1) return null;

      const signatureParts = [];
      dimKeys.forEach(key => {
        const dim = dimensions[key] || {};
        signatureParts.push(key, dim.id || "", dim.description || "", dim.label || "");
      });
      measureKeys.forEach(key => {
        const measure = mainStructureMembers[key] || {};
        signatureParts.push(key, measure.id || "", measure.description || "", measure.label || "");
      });

      const metadataSignature = signatureParts.join("|");
      if (this._metadataContext && this._metadataSignature === metadataSignature) {
        return this._metadataContext;
      }

      const measId = measureKeys[0];
      let tempoDimId = null;
      let versaoDimId = null;
      let itemFinanceiroDimId = null;
      let contaContabilDimId = null;
      let fornecedorDimId = null;

      dimKeys.forEach(key => {
        const desc = String(dimensions[key].description || "").toUpperCase();
        const id = String(dimensions[key].id || "").toUpperCase();
        
        if (desc.includes("VERSÃO") || desc.includes("VERSION") || desc.includes("CENÁRIO") || id.includes("VERSION") || id.includes("CATEGORY")) {
          versaoDimId = key;
        } else if (desc.includes("TEMPO") || desc.includes("MÊS") || desc.includes("MES") || desc.includes("ANO") || desc.includes("DATE") || id.includes("TIME") || id.includes("CALENDAR")) {
          tempoDimId = key;
        } else if (desc.includes("ITEM") || id.includes("ITEM") || desc.includes("FINANCEIRO")) {
          itemFinanceiroDimId = key;
        } else if (desc.includes("CONTA") || id.includes("ACCOUNT") || desc.includes("CONTÁBIL") || desc.includes("CONTABIL")) {
          contaContabilDimId = key;
        } else if (desc.includes("FORNECEDOR") || desc.includes("VENDOR") || desc.includes("SUPPLIER") || id.includes("FORNECEDOR") || id.includes("VENDOR") || id.includes("SUPPLIER")) {
          fornecedorDimId = key;
        }
      });

      if (!tempoDimId) tempoDimId = dimKeys[0];
      if (!versaoDimId) versaoDimId = dimKeys[1] || null;

      const extraDimIds = dimKeys.filter(key => key !== tempoDimId && key !== versaoDimId);
      if (!itemFinanceiroDimId) itemFinanceiroDimId = extraDimIds[0] || null;
      if (!contaContabilDimId) contaContabilDimId = extraDimIds[1] || null;
      if (!fornecedorDimId) fornecedorDimId = extraDimIds.find(key => key !== itemFinanceiroDimId && key !== contaContabilDimId) || null;

      const measureInfo = mainStructureMembers[measId] || {};
      const context = {
        dimKeys,
        measureKeys,
        measId,
        measureInfo,
        tempoDimId,
        versaoDimId,
        itemFinanceiroDimId,
        contaContabilDimId,
        fornecedorDimId,
        extraDimIds
      };

      this._metadataSignature = metadataSignature;
      this._metadataContext = context;
      return context;
    }

    renderChart() {
      if (!document.contains(this) || !this._shadowRoot) return;
      this._applyResponsiveMode();
      
      const tArrivalData = performance.now();

      const residualPlaceholder = this._axisX.querySelector(".placeholder-text");
      if (residualPlaceholder) residualPlaceholder.remove();

      const financialData = this._currentData;
      if (!financialData || !financialData.data || financialData.data.length === 0) {
        this._axisX.textContent = "";
        const placeholder = document.createElement("div");
        placeholder.className = "placeholder-text";
        placeholder.textContent = "Aguardando dados estruturados...";
        this._axisX.appendChild(placeholder);
        return;
      }

      try {
        const tParsingStart = performance.now();
        const metadata = financialData.metadata;
        const metadataContext = this._getMetadataContext(metadata);
        if (!metadataContext) return;

        this._measId = metadataContext.measId;
        this._tempoDimId = metadataContext.tempoDimId;
        this._versaoDimId = metadataContext.versaoDimId;
        this._itemFinanceiroDimId = metadataContext.itemFinanceiroDimId;
        this._contaContabilDimId = metadataContext.contaContabilDimId;
        this._fornecedorDimId = metadataContext.fornecedorDimId;
        this._extraDimIds = metadataContext.extraDimIds;
        
        const measureInfo = metadataContext.measureInfo || {};
        const indicatorLabel = measureInfo.label || measureInfo.description || measureInfo.id || "Indicador";
        if (this._widgetTitle) {
          this._widgetTitle.textContent = `Overview - ${indicatorLabel}`;
        }

        const nowRuntime = new Date();
        const currentYearRuntime = nowRuntime.getFullYear();
        let targetMonthNum = nowRuntime.getMonth(); 
        let targetYearNum = nowRuntime.getFullYear();
        
        if (targetMonthNum === 0) {
          targetMonthNum = 12; 
          targetYearNum -= 1;
        }

        const runtimeCutoffKey = `${targetYearNum}-${targetMonthNum}`;
        let fullSeriesData;
        let defaultActualIndex = -1;

        if (
          this._seriesCache &&
          this._seriesCache.sourceSignature === this._dataSignature &&
          this._seriesCache.metadataSignature === this._metadataSignature &&
          this._seriesCache.runtimeCutoffKey === runtimeCutoffKey
        ) {
          fullSeriesData = this._seriesCache.fullSeriesData;
          defaultActualIndex = this._seriesCache.defaultActualIndex;
        } else {
          const timelineMap = {};

          financialData.data.forEach(row => {
            const tempoObj = row[this._tempoDimId]; if (!tempoObj) return;
            const tId = String(tempoObj.id); 
            if (tId.toLowerCase().includes("(all)")) return;
            
            const tLabel = tempoObj.label || tempoObj.description || tId;
            if (tLabel.toLowerCase().includes("(all)")) return;

            if (!timelineMap[tId]) {
              timelineMap[tId] = {
                id: tId,
                label: tLabel,
                realizado: 0,
                orcado: 0,
                isCurrentMonth: false
              };
            }
            if (tempoObj.properties && (tempoObj.properties.isCurrent === "true" || tempoObj.properties.isCurrent === true)) { timelineMap[tId].isCurrentMonth = true; }
            if (row.versionContext && row.versionContext.isActualMonth) { timelineMap[tId].isCurrentMonth = true; }

            const rawValue = this._parseValue(row[this._measId] ? (row[this._measId].formattedValue || row[this._measId].raw || 0) : 0);
            if (this._versaoDimId) {
              const vObj = row[this._versaoDimId];
              if (vObj) {
                if (this._isBudgetVersionObject(vObj)) { 
                  timelineMap[tId].orcado += rawValue;
                } else { 
                  timelineMap[tId].realizado += rawValue;
                }
              }
            } else {
              timelineMap[tId].realizado += rawValue;
            }
          });

          const sortedMonths = Object.values(timelineMap);
          if (sortedMonths.length === 0) return;

          fullSeriesData = [];

          sortedMonths.forEach((m) => {
            let parsedYear = currentYearRuntime;
            const matches = m.id.match(this._yearRegex);
            if (matches) {
              parsedYear = parseInt(matches[0]);
            } else {
              const labelDigits = m.label.match(this._yearRegex);
              if (labelDigits) parsedYear = parseInt(labelDigits[0]);
            }

            if (parsedYear < 2022 || parsedYear > 2028) return;

            const cleanLabelUpper = String(m.label).substring(0, 3).toUpperCase();
            const targetMonthIndex = this._monthOrderMap[cleanLabelUpper] || 1;
            const alignedLabel = `${m.label.substring(0,3)} ${String(parsedYear).substring(2, 4)}`;

            fullSeriesData.push({ 
              id: m.id, label: alignedLabel, value: m.realizado, budgetValue: m.orcado, type: m.isCurrentMonth ? "actual" : "historical", yearValue: parsedYear, monthNum: targetMonthIndex
            });
          });

          fullSeriesData.sort((a, b) => {
            if (a.yearValue !== b.yearValue) return a.yearValue - b.yearValue;
            return a.monthNum - b.monthNum;
          });

          fullSeriesData._byIdMap = new Map(fullSeriesData.map(item => [item.id, item]));
          const periodMap = new Map(fullSeriesData.map(item => [`${item.yearValue}-${item.monthNum}`, item]));
          fullSeriesData.forEach(item => {
            const previousMonthNum = item.monthNum === 1 ? 12 : item.monthNum - 1;
            const previousYearValue = item.monthNum === 1 ? item.yearValue - 1 : item.yearValue;
            item.previousSeriesData = periodMap.get(`${previousYearValue}-${previousMonthNum}`) || null;
          });

          let dynamicIdx = fullSeriesData.findIndex(d => d.yearValue === targetYearNum && d.monthNum === targetMonthNum);
          
          if (dynamicIdx !== -1) {
            defaultActualIndex = dynamicIdx;
          } else {
            fullSeriesData.forEach((d, idx) => {
              if (d.type === "actual") defaultActualIndex = idx;
            });
            if (defaultActualIndex === -1 && fullSeriesData.length > 0) {
              defaultActualIndex = fullSeriesData.length - 1;
            }
          }

          this._seriesCache = {
            sourceSignature: this._dataSignature,
            metadataSignature: this._metadataSignature,
            runtimeCutoffKey,
            fullSeriesData,
            defaultActualIndex
          };
        }

        if (fullSeriesData.length === 0) return;

        if (!this._isTreeBuilt && fullSeriesData.length > 0) {
          this._treeDropdownContent.textContent = ""; 
          const yearsMap = {};
          
          fullSeriesData.forEach(d => {
            if (!yearsMap[d.yearValue]) {
              const yearNode = document.createElement("div");
              yearNode.className = "tree-year-node";
              yearNode.textContent = `Ano ${d.yearValue}`;
              const monthsContainer = document.createElement("div");
              monthsContainer.className = "tree-months-container";
              
              yearNode.addEventListener("click", (e) => {
                e.stopPropagation();
                yearNode.classList.toggle("expanded");
                monthsContainer.classList.toggle("show");
              });

              this._treeDropdownContent.appendChild(yearNode);
              this._treeDropdownContent.appendChild(monthsContainer);
              yearsMap[d.yearValue] = monthsContainer;
            }

            const monthItem = document.createElement("div");
            monthItem.className = "tree-month-item";
            monthItem.textContent = d.label;
            monthItem.setAttribute("data-id", d.id);
            
            monthItem.addEventListener("click", (e) => {
              e.stopPropagation();
              this._selectedCutoffId = d.id;
              this._isDropdownOpen = false; 
              this._toggleDropdownDOM();
              this.requestUpdate();
            });

            yearsMap[d.yearValue].appendChild(monthItem);
          });

          if (!this._selectedCutoffId && fullSeriesData[defaultActualIndex]) {
            this._selectedCutoffId = fullSeriesData[defaultActualIndex].id;
          }
          this._isTreeBuilt = true; 
        }

        let actualIndex = fullSeriesData.findIndex(d => d.id === this._selectedCutoffId);
        if (actualIndex === -1) actualIndex = defaultActualIndex;

        if (fullSeriesData[actualIndex]) {
          this._treeDropdownTrigger.textContent = fullSeriesData[actualIndex].label;
        }

        const dropdownItems = this._treeDropdownContent.querySelectorAll(".tree-month-item");
        dropdownItems.forEach(item => {
          item.classList.toggle("selected", item.getAttribute("data-id") === this._selectedCutoffId);
        });

        fullSeriesData.forEach((d, idx) => {
          d.type = (idx === actualIndex) ? "actual" : "historical";
        });

        const targetBudgetSource = fullSeriesData[actualIndex];
        const calculatedBudget = targetBudgetSource.budgetValue > 0 ? targetBudgetSource.budgetValue : targetBudgetSource.value;

        const startIndex = Math.max(0, actualIndex - 11); 
        const visibleSeriesData = fullSeriesData.slice(startIndex, actualIndex + 1);

        let visibleActualIndex = visibleSeriesData.findIndex(d => d.id === this._selectedCutoffId);
        if (visibleActualIndex === -1) visibleActualIndex = visibleSeriesData.length - 1;

        visibleSeriesData.push({
          id: fullSeriesData[actualIndex].id, label: `Bud. ${fullSeriesData[actualIndex].label.split(' ')[0]}`, value: calculatedBudget, type: "budget", yearValue: fullSeriesData[actualIndex].yearValue, monthNum: fullSeriesData[actualIndex].monthNum, previousSeriesData: fullSeriesData[actualIndex].previousSeriesData || null
        });

        const maxVal = Math.max(...visibleSeriesData.map(d => d.value)) * 1.10 || 1;

        if (ENABLE_TELEMETRY) {
          this._profiler.metrics.steps.parsing = performance.now() - tParsingStart;
        }

        // RECONCILIAÇÃO DO DOM DE ALTA PERFORMANCE (SEM LIMPEZA DESTRUTIVA)
        const tDOMStart = performance.now();
        this._reconcileBarsAndLabels(visibleSeriesData, maxVal);
        if (ENABLE_TELEMETRY) {
          this._profiler.metrics.steps.domCreation = performance.now() - tDOMStart;
        }

        this._renderDoubleFinancePanel(visibleSeriesData, fullSeriesData, actualIndex, calculatedBudget);
        this._lastVisualState = { visibleSeriesData, visibleActualIndex };

        const tDOMPaintStart = performance.now();
        requestAnimationFrame(() => {
          const tSVGStart = performance.now();
          
          this._redrawConnectorsOnly();
          
          if (ENABLE_TELEMETRY) {
            this._profiler.metrics.steps.svgDrawing = performance.now() - tSVGStart;
            this._profiler.collectMemory();

            const tFinalPaint = performance.now();
            const jsTotalTime = tEndJS - tArrivalData;
            const domTotalTime = tFinalPaint - tDOMPaintStart;

            this._setText(this._lblTotal, `${(tFinalPaint - tArrivalData).toFixed(2)} ms`);
            this._setText(this._lblJS, `${jsTotalTime.toFixed(2)} ms`);
            this._setText(this._lblDOM, `${domTotalTime.toFixed(2)} ms`);
            this._setText(this._lblFPS, `${this._profiler.metrics.fps} FPS`);
            
            this._setText(this._lblParsing, `${this._profiler.metrics.steps.parsing.toFixed(2)} ms`);
            this._setText(this._lblAggr, `${this._profiler.metrics.steps.aggregation.toFixed(2)} ms`);
            this._setText(this._lblStepDOM, `${this._profiler.metrics.steps.domCreation.toFixed(2)} ms`);
            this._setText(this._lblStepSVG, `${this._profiler.metrics.steps.svgDrawing.toFixed(2)} ms`);
            this._setText(this._lblStepHL, `${this._profiler.metrics.steps.highlights.toFixed(2)} ms`);
            
            this._setText(this._lblMem, `${(this._profiler.metrics.memory / 1024 / 1024).toFixed(2)} MB`);
            this._setText(this._lblVol, `${financialData.data.length} rows`);

            const stressProjections = this._profiler.runStressProjection(financialData.data.length, jsTotalTime);
            this._setText(this._st10k, `${stressProjections.k10.toFixed(2)} ms`);
            this._setText(this._st25k, `${stressProjections.k25.toFixed(2)} ms`);
            this._setText(this._st50k, `${stressProjections.k50.toFixed(2)} ms`);
            this._setText(this._st100k, `${stressProjections.k100.toFixed(2)} ms`);
          }
        });

      } catch (error) {
        console.error("Erro interno no processamento visual:", error);
      }
      const tEndJS = performance.now();
    }

    /* ==========================================================================
       RECONCILIAÇÃO DO POOL DO DOM MENSAL (BLINDADO)
       ========================================================================== */
    _reconcileBarsAndLabels(visibleSeriesData, maxVal) {
      this._hideBarTooltip();
      const existingWrappers = this._chartArea.querySelectorAll(".bar-wrapper");
      const existingLabels = this._axisX.querySelectorAll(".axis-label");
      const targetLength = visibleSeriesData.length;

      if (existingWrappers.length < targetLength) {
        for (let i = existingWrappers.length; i < targetLength; i++) {
          const wrapper = document.createElement("div"); wrapper.className = "bar-wrapper";
          const bar = document.createElement("div"); bar.className = "bar-element";
          const label = document.createElement("span"); label.className = "kpi-label";
          bar.addEventListener("mouseenter", this._boundBarEnter);
          bar.addEventListener("mousemove", this._boundBarMove);
          bar.addEventListener("mouseleave", this._boundBarLeave);
          bar.appendChild(label); wrapper.appendChild(bar); this._chartArea.appendChild(wrapper);
        }
      } else if (existingWrappers.length > targetLength) {
        for (let i = existingWrappers.length - 1; i >= targetLength; i--) { existingWrappers[i].remove(); }
      }

      if (existingLabels.length < targetLength) {
        for (let i = existingLabels.length; i < targetLength; i++) {
          const axisLabel = document.createElement("div"); axisLabel.className = "axis-label";
          this._axisX.appendChild(axisLabel);
        }
      } else if (existingLabels.length > targetLength) {
        for (let i = existingLabels.length - 1; i >= targetLength; i--) { existingLabels[i].remove(); }
      }

      const updatedWrappers = this._chartArea.querySelectorAll(".bar-wrapper");
      const updatedLabels = this._axisX.querySelectorAll(".axis-label");

      visibleSeriesData.forEach((d, idx) => {
        const bar = updatedWrappers[idx].querySelector(".bar-element");
        const label = bar.querySelector(".kpi-label");
        
        this._setClass(bar, `bar-element ${d.type}`);
        this._setStyle(bar, "height", `${(d.value / maxVal) * 100}%`);
        this._setText(label, `${(d.value / 1000000).toFixed(2)}M`);
        bar._seriesData = d;

        const axisLabel = updatedLabels[idx];
        this._setClass(axisLabel, d.type === "actual" ? "axis-label actual-month" : "axis-label");
        this._setText(axisLabel, d.label);
      });
    }

    _drawUnifiedFlatConnections(overlayContainer, chartArea, barSelector, dataArray, actualIndex, mode) {
      if (!document.contains(this) || !this._shadowRoot || actualIndex === -1) return;
      
      const containerHeight = chartArea.offsetHeight; if (containerHeight === 0) return;
      const barElements = chartArea.querySelectorAll(barSelector); if (!barElements || barElements.length === 0) return;
      
      const barCenters = Array.from(barElements).map(bar => {
        if (!bar) return 0;
        return bar.parentElement.offsetLeft + bar.offsetLeft + (bar.offsetWidth / 2);
      });
      
      const pairs = [];
      if (mode === "monthly") {
        if (actualIndex > 0) pairs.push({ from: actualIndex - 1, to: actualIndex });
        if (actualIndex < barElements.length - 1) pairs.push({ from: actualIndex, to: actualIndex + 1 });
      } else if (mode === "ytd") {
        pairs.push({ from: 0, to: 1 }); pairs.push({ from: 1, to: 2 });
      }

      const drawablePairs = [];
      pairs.forEach((pair) => {
        const xFrom = barCenters[pair.from];
        const xTo = barCenters[pair.to];
        if (xFrom === 0 || xTo === 0) return;
        
        const itemFrom = dataArray[pair.from];
        const itemTo = dataArray[pair.to];
        
        let isCostSaving = false;
        let variancePercent = 0;
        let directionalArrow = "";

        if (itemTo.type === "budget") {
          const diff = itemFrom.value - itemTo.value;
          isCostSaving = diff <= 0;
          variancePercent = itemTo.value !== 0 ? (diff / itemTo.value) * 100 : 0;
          directionalArrow = isCostSaving ? "▼ " : "▲ ";
        } else {
          const diff = itemTo.value - itemFrom.value;
          isCostSaving = diff <= 0;
          variancePercent = itemFrom.value !== 0 ? (diff / itemFrom.value) * 100 : 0;
          directionalArrow = isCostSaving ? "▼ " : "▲ ";
        }

        const varianceText = directionalArrow + Math.abs(variancePercent).toFixed(2) + "%";

        const leftX = Math.min(xFrom, xTo);
        const trackWidth = Math.abs(xTo - xFrom);
        const ceilingY = 24;
        const midX = leftX + (trackWidth / 2);

        drawablePairs.push({
          leftX,
          midX,
          trackWidth,
          ceilingY,
          height: containerHeight - ceilingY - 24,
          tagClass: isCostSaving ? "variance-tag saving" : "variance-tag increase",
          varianceText
        });
      });

      let tracks = Array.from(overlayContainer.querySelectorAll(".html-bracket-track"));
      let badges = Array.from(overlayContainer.querySelectorAll(".html-bracket-badge-anchor"));

      while (tracks.length > drawablePairs.length) {
        const node = tracks.pop();
        if (node) node.remove();
      }
      while (badges.length > drawablePairs.length) {
        const node = badges.pop();
        if (node) node.remove();
      }

      const fragment = document.createDocumentFragment();
      while (tracks.length < drawablePairs.length) {
        const trackDiv = document.createElement("div");
        trackDiv.className = "html-bracket-track";
        tracks.push(trackDiv);
        fragment.appendChild(trackDiv);
      }
      while (badges.length < drawablePairs.length) {
        const badgeAnchor = document.createElement("div");
        badgeAnchor.className = "html-bracket-badge-anchor";
        const spanTag = document.createElement("span");
        badgeAnchor.appendChild(spanTag);
        badges.push(badgeAnchor);
        fragment.appendChild(badgeAnchor);
      }
      if (fragment.childNodes.length > 0) {
        overlayContainer.appendChild(fragment);
      }

      drawablePairs.forEach((item, idx) => {
        const trackDiv = tracks[idx];
        const badgeAnchor = badges[idx];
        let spanTag = badgeAnchor.querySelector("span");
        if (!spanTag) {
          spanTag = document.createElement("span");
          badgeAnchor.appendChild(spanTag);
        }

        this._setStyle(trackDiv, "left", `${item.leftX}px`);
        this._setStyle(trackDiv, "top", `${item.ceilingY}px`);
        this._setStyle(trackDiv, "width", `${item.trackWidth}px`);
        this._setStyle(trackDiv, "height", `${item.height}px`);

        this._setStyle(badgeAnchor, "left", `${item.midX}px`);
        this._setStyle(badgeAnchor, "top", `${item.ceilingY}px`);
        this._setClass(spanTag, item.tagClass);
        this._setText(spanTag, item.varianceText);
      });
    }

    _renderDoubleFinancePanel(visibleSeriesData, fullSeriesData, actualIndex, budgetVal) {
      const currentBarNode = fullSeriesData[actualIndex]; const actualVal = currentBarNode.value; 
      const monthLabel = currentBarNode.label.split(' ')[0];
      const currentYear = currentBarNode.yearValue; const previousYear = currentYear - 1;

      const diffNominal = actualVal - budgetVal;
      const diffPercent = budgetVal !== 0 ? (diffNominal / budgetVal) * 100 : 0;
      const consumptionMonthPercent = budgetVal !== 0 ? (actualVal / budgetVal) * 100 : 0;
      const isMonthSaving = diffNominal <= 0;
      
      const formatM = (v) => (v / 1000000).toFixed(2) + "M";
      const formatPercent = (v, isSaving) => (isSaving ? "▼ " : "▲ ") + Math.abs(v).toFixed(2) + "%";

      this._setText(this._valDiffRow, (diffNominal >= 0 ? "+" : "") + formatM(diffNominal));
      this._setText(this._valPctRow, formatPercent(diffPercent, isMonthSaving));
      this._setClass(this._valPctRow, "status-badge-finance " + (isMonthSaving ? "success" : "warning"));
      this._setText(this._valPctConsumptionRow, consumptionMonthPercent.toFixed(2) + "%");

      let totalRealizadoYTDAtual = 0; let totalRealizadoYTDAntigo = 0; let totalBudgetYTDCompleto = 0;

      fullSeriesData.forEach((d, idx) => {
        if (idx <= actualIndex) {
          if (d.yearValue === currentYear) {
            totalRealizadoYTDAtual += d.value;
            totalBudgetYTDCompleto += d.budgetValue || 0;
          }
        }
        if (d.yearValue === previousYear && d.monthNum <= currentBarNode.monthNum) {
          totalRealizadoYTDAntigo += d.value;
        }
      });

      if (totalBudgetYTDCompleto === 0) totalBudgetYTDCompleto = totalRealizadoYTDAtual || 1;

      const diffYtdNominal = totalRealizadoYTDAtual - totalBudgetYTDCompleto;
      const diffYtdPercent = totalBudgetYTDCompleto !== 0 ? (diffYtdNominal / totalBudgetYTDCompleto) * 100 : 0;
      const consumoBudgetPercent = (totalRealizadoYTDAtual / totalBudgetYTDCompleto) * 100;
      const isYtdSaving = diffYtdNominal <= 0;

      this._setText(this._ytdDiffRow, (diffYtdNominal >= 0 ? "+" : "") + formatM(diffYtdNominal));
      this._setText(this._ytdDiffPctBadge, formatPercent(diffYtdPercent, isYtdSaving));
      this._setClass(this._ytdDiffPctBadge, "status-badge-finance " + (isYtdSaving ? "success" : "warning"));
      this._setText(this._ytdPctRow, consumoBudgetPercent.toFixed(2) + "%");

      // 🛠️ ATUALIZAÇÃO DIRETA E BLINDADA: Mini barras atualizadas de forma segura e sem apagar o DOM
      const maxYTD = Math.max(totalRealizadoYTDAntigo, totalRealizadoYTDAtual, totalBudgetYTDCompleto) * 1.10 || 1;
      
      this._setStyle(this._miniBarPrev, "height", `${(totalRealizadoYTDAntigo / maxYTD) * 100}%`);
      this._setStyle(this._miniBarAct, "height", `${(totalRealizadoYTDAtual / maxYTD) * 100}%`);
      this._setStyle(this._miniBarBud, "height", `${(totalBudgetYTDCompleto / maxYTD) * 100}%`);

      this._setText(this._miniLblPrev, formatM(totalRealizadoYTDAntigo));
      this._setText(this._miniLblAct, formatM(totalRealizadoYTDAtual));
      this._setText(this._miniLblBud, formatM(totalBudgetYTDCompleto));

      this._setText(this._shadowRoot.getElementById("ytd-axis-lbl-prev"), `Ant. (${previousYear})`);
      this._setText(this._shadowRoot.getElementById("ytd-axis-lbl-act"), `Atual (${currentYear})`);

      this._ytdSeriesMock = [{ value: totalRealizadoYTDAntigo, type: "historical" }, { value: totalRealizadoYTDAtual, type: "actual" }, { value: totalBudgetYTDCompleto, type: "budget" }];

      if (this._highlightCardArea) {
        this._setStyle(this._highlightCardArea, "borderLeft", isYtdSaving ? "4px solid #2E7D32" : "4px solid #D32F2F");
      }

      if (this._periodSummaryBanner) {
        const periodSummaryKey = [
          isYtdSaving,
          diffYtdNominal,
          diffYtdPercent,
          consumoBudgetPercent
        ].join("|");

        this._setStyle(this._periodSummaryBanner, "display", "block");
        this._setClass(this._periodSummaryBanner, isYtdSaving ? "period-summary-banner summary-saving" : "period-summary-banner summary-desvio");
        if (this._lastPeriodSummaryKey !== periodSummaryKey) {
          this._lastPeriodSummaryKey = periodSummaryKey;
          this._periodSummaryBanner.textContent = "";

          this._periodSummaryBanner.appendChild(document.createTextNode("No acumulado YTD, o projeto opera "));
          const spanYtdStatus = document.createElement("strong");
          spanYtdStatus.textContent = isYtdSaving ? "abaixo do teto orçamentário (eficiência) " : "acima da meta prevista (atenção) ";
          this._periodSummaryBanner.appendChild(spanYtdStatus);

          this._periodSummaryBanner.appendChild(document.createTextNode("com variação de "));
          const spanYtdDelta = document.createElement("strong");
          spanYtdDelta.textContent = `R$ ${Math.abs(diffYtdNominal/1000000).toFixed(2)}M (${diffYtdNominal >= 0 ? "+" : ""}${diffYtdPercent.toFixed(1)}%)`;
          this._periodSummaryBanner.appendChild(spanYtdDelta);
          this._periodSummaryBanner.appendChild(document.createTextNode(`, absorvendo ${consumoBudgetPercent.toFixed(1)}% do orçamento total.`));
        }
      }

      const highlightKey = [
        this._dataSignature,
        this._metadataSignature,
        currentBarNode.id,
        actualVal,
        budgetVal,
        totalRealizadoYTDAntigo,
        totalRealizadoYTDAtual,
        totalBudgetYTDCompleto
      ].join("|");

      if (this._lastHighlightKey === highlightKey && this._hlSummaryUl && this._hlSummaryUl.childNodes.length > 0) {
        if (ENABLE_TELEMETRY) {
          this._profiler.metrics.steps.highlights = 0;
        }
        this._setStyle(this._insightGrid, "display", "grid");
        return;
      }

      this._lastHighlightKey = highlightKey;
      this._isHighlightDetailOpen = false;
      this._pendingHighlightDetailItems = [];
      this._highlightDetailRendered = false;
      this._syncHighlightDetailVisibility();
      this._hlSummaryUl.textContent = "";
      this._hlDetailUl.textContent = "";

      const ytdStatusText = isYtdSaving ? "variação favorável" : "variação desfavorável";
      const semanticColorYtd = isYtdSaving ? "#2E7D32" : "#D32F2F";
      const liYtd = document.createElement("li");
      const sYtd = document.createElement("strong"); sYtd.textContent = "Acumulado YTD: ";
      const statusSpanYtd = document.createElement("span"); statusSpanYtd.textContent = ytdStatusText; statusSpanYtd.style.color = semanticColorYtd; statusSpanYtd.style.fontWeight = "700";
      liYtd.appendChild(sYtd); liYtd.appendChild(document.createTextNode("posição consolidada com ")); liYtd.appendChild(statusSpanYtd);
      liYtd.appendChild(document.createTextNode(` de R$ ${Math.abs(diffYtdNominal/1000000).toFixed(2)}M (${diffYtdNominal >= 0 ? "+" : ""}${diffYtdPercent.toFixed(1)}%), com consumo de ${consumoBudgetPercent.toFixed(1)}% do orçamento.`));
      this._hlSummaryUl.appendChild(liYtd);

      const monthStatusText = diffNominal <= 0 ? "variação favorável" : "variação desfavorável";
      const semanticColorMonth = diffNominal <= 0 ? "#2E7D32" : "#D32F2F";
      const semanticColorCons = consumptionMonthPercent > 100 ? "#D32F2F" : (consumptionMonthPercent > 90 ? "#EF6C00" : "#2E7D32");

      const liMonth = document.createElement("li");
      const s1 = document.createElement("strong"); s1.textContent = `Mês Corrente (${monthLabel}): `;
      const statusSpan1 = document.createElement("span"); statusSpan1.textContent = monthStatusText; statusSpan1.style.color = semanticColorMonth; statusSpan1.style.fontWeight = "700";
      liMonth.appendChild(s1); liMonth.appendChild(document.createTextNode("Fechamento com ")); liMonth.appendChild(statusSpan1); 
      liMonth.appendChild(document.createTextNode(` de R$ ${Math.abs(diffNominal/1000000).toFixed(2)}M em relação ao orçamento da competência.`));
      this._hlSummaryUl.appendChild(liMonth);

      const liCons = document.createElement("li");
      const s2 = document.createElement("strong"); s2.textContent = "Consumo Operacional: ";
      const statusSpan2 = document.createElement("span"); statusSpan2.textContent = `${consumptionMonthPercent.toFixed(1)}%`; statusSpan2.style.color = semanticColorCons; statusSpan2.style.fontWeight = "700";
      liCons.appendChild(s2); liCons.appendChild(document.createTextNode("A absorção atingiu ")); liCons.appendChild(statusSpan2); liCons.appendChild(document.createTextNode(" do orçamento da competência."));
      this._hlSummaryUl.appendChild(liCons);

      const tHLStart = performance.now();
      let analysis;
      if (this._analysisCache && this._analysisCache.key === highlightKey) {
        analysis = this._analysisCache.analysis;
      } else {
        analysis = this._analyticsEngine.analyze(
          this._currentData.data, currentBarNode, currentYear, previousYear,
          this._tempoDimId, this._versaoDimId, this._itemFinanceiroDimId, this._contaContabilDimId, this._measId, fullSeriesData, this._profiler
        );
        this._analysisCache = { key: highlightKey, analysis };
      }

      if (analysis.summary && analysis.summary.mainDriver) {
        const lead = analysis.summary.mainDriver;
        const liSummary = document.createElement("li");
        const sSummary = document.createElement("strong"); sSummary.textContent = "Leitura executiva: ";
        liSummary.appendChild(sSummary);
        liSummary.appendChild(document.createTextNode(`a análise identificou ${analysis.outlierTable.length} item(ns) de maior impacto, com destaque para `));
        const spanLead = document.createElement("span"); spanLead.textContent = lead.itemName; spanLead.style.fontWeight = "700";
        liSummary.appendChild(spanLead);
        liSummary.appendChild(document.createTextNode(`, enquadrado como ${lead.priorityLabel.toLowerCase()} e com ${lead.trendLabel}.`));
        this._hlSummaryUl.appendChild(liSummary);
      }

      if (this._highlightToggleBtn) {
        this._setStyle(this._highlightToggleBtn, "display", analysis.outlierTable.length > 0 ? "inline-flex" : "none");
      }

      this._lastAnalyticsViewContext = {
        currentBarNode,
        fullSeriesById: fullSeriesData._byIdMap,
        diffYtdNominal,
        diffYtdPercent,
        totalRealizadoYTDAtual,
        totalRealizadoYTDAntigo,
        totalBudgetYTDCompleto,
        analysis
      };
      this._renderAnalyticsViews();

      if (ENABLE_TELEMETRY) {
        this._profiler.metrics.steps.highlights = performance.now() - tHLStart;
      }

      this._setStyle(this._insightGrid, "display", "grid");
    }

    getColorActualMonth() { return this._props.colorActualMonth; }
    setColorActualMonth(value) { this._props.colorActualMonth = value; }
    getColorHistorical() { return this._props.colorHistorical; }
    setColorHistorical(value) { this._props.colorHistorical = value; }
    getColorBudget() { return this._props.colorBudget; }
    setColorBudget(value) { this._props.colorBudget = value; }
    getFontSizeLabels() { return this._props.fontSizeLabels; }
    setFontSizeLabels(value) { this._props.fontSizeLabels = value; }
  }
  
  if (!customElements.get("sac-summary")) {
    customElements.define("sac-summary", EvoSummaryWidget);
  }
})();
