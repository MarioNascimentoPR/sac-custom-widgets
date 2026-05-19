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

      .widget-legend { display: flex; flex-wrap: wrap; gap: 10px 16px; margin-bottom: 12px; font-size: var(--small-font-size); font-weight: 600; color: #4a5568; flex-shrink: 0; }
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
      .executive-kpi-grid {
        display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1px; margin-bottom: 14px;
        background: #e2e8f0; border: 1px solid #e2e8f0; border-radius: 4px; overflow: hidden;
      }
      .executive-kpi {
        display: flex; flex-direction: column; gap: 4px; border: none; border-radius: 0; padding: 9px 12px; background: #ffffff;
      }
      .executive-kpi-label { font-size: var(--ui-font-size); font-weight: 600; color: #4a5568; letter-spacing: 0; }
      .executive-kpi-value {
        font-size: calc(var(--ui-font-size) + 2px); line-height: 1.2; font-weight: 700; color: #1e293b; min-height: 20px;
        font-variant-numeric: tabular-nums;
      }
      .executive-kpi-value.driver-kpi-value {
        font-size: var(--ui-font-size); line-height: 1.25; min-height: 32px; white-space: normal; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
      }
      .executive-kpi-sub { font-size: var(--small-font-size); color: #475569; line-height: 1.35; }
      .risk-pill {
        display: inline-flex; align-items: center; justify-content: center; width: fit-content; min-width: 82px; border-radius: 4px; padding: 4px 8px; font-size: var(--small-font-size); font-weight: 700; border: 1px solid transparent;
      }
      .risk-pill.good { background: #e6f4ea; color: #137333; border-color: #ceead6; }
      .risk-pill.watch { background: #fff4e5; color: #b45309; border-color: #fed7aa; }
      .risk-pill.alert { background: #fce8e6; color: #c5221f; border-color: #fad2cf; }
      .executive-grid { display: grid; grid-template-columns: minmax(320px, 1.35fr) minmax(260px, 0.9fr); gap: var(--layout-gap); align-items: stretch; }
      .executive-panel {
        border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc; padding: var(--panel-padding); display: flex; flex-direction: column; min-width: 0;
      }
      .executive-panel-title {
        font-size: var(--small-font-size); font-weight: 700; color: #4a5568; text-transform: uppercase; letter-spacing: 0.75px;
        margin-bottom: 12px; padding-bottom: 6px; border-bottom: 2px solid #cbd5e0;
      }
      .copy-panel-header {
        display: flex; align-items: center; justify-content: space-between; gap: 10px;
        margin-bottom: 12px; padding-bottom: 6px; border-bottom: 2px solid #cbd5e0;
      }
      .copy-panel-header .executive-panel-title,
      .highlight-title-box .highlight-title-main {
        margin-bottom: 0; padding-bottom: 0; border-bottom: none; flex: 1; min-width: 0;
      }
      .copy-text-btn {
        display: inline-flex; align-items: center; justify-content: center; min-width: 58px; height: 24px;
        border: 1px solid #cbd5e0; border-radius: 4px; background: #ffffff; color: #475569;
        font-size: var(--small-font-size); font-weight: 700; line-height: 1; cursor: pointer; white-space: nowrap;
      }
      .copy-text-btn:hover { background: #edf2f7; color: #1e293b; }
      .copy-text-btn.copied { background: #e6f4ea; color: #137333; border-color: #ceead6; }
      .copy-text-btn.error { background: #fce8e6; color: #c5221f; border-color: #fad2cf; }
      .waterfall-panel-header {
        display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px 12px; margin-bottom: 10px;
        padding-bottom: 6px; border-bottom: 2px solid #cbd5e0;
      }
      .waterfall-panel-header .executive-panel-title { margin-bottom: 0; padding-bottom: 0; border-bottom: none; flex: 1 1 120px; min-width: 0; }
      .waterfall-mode-tabs { display: inline-flex; flex: 0 1 auto; max-width: 100%; border: 1px solid #dbe3ec; border-radius: 7px; background: #f8fafc; padding: 2px; gap: 2px; }
      .waterfall-mode-btn { border: none; background: transparent; color: #475569; font-size: var(--small-font-size); font-weight: 700; border-radius: 5px; padding: 5px 9px; cursor: pointer; white-space: nowrap; }
      .waterfall-mode-btn.active { background: #ffffff; color: #0f172a; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08); }
      .waterfall-caption { font-size: var(--small-font-size); color: #64748b; margin-bottom: 8px; min-height: 16px; }
      .waterfall-chart {
        --wf-step-min: 54px; --wf-gap: 6px;
        position: relative; display: flex; align-items: stretch; gap: var(--wf-gap); width: 100%; max-width: 100%; min-width: 0;
        min-height: 174px; height: clamp(174px, 24vw, 215px); overflow-x: auto; overflow-y: hidden; padding: 9px 8px 6px;
        border: 1px solid #e2e8f0; border-radius: 4px; background: #ffffff; box-sizing: border-box; overscroll-behavior-x: contain;
      }
      .waterfall-chart.dense { --wf-step-min: 46px; --wf-gap: 4px; }
      .waterfall-step { display: flex; flex: 1 1 var(--wf-step-min); flex-direction: column; align-items: center; justify-content: flex-end; min-width: var(--wf-step-min); height: 100%; position: relative; }
      .waterfall-value {
        height: 19px; max-width: 100%; min-width: 0; display: inline-flex; align-items: flex-start; justify-content: center; font-size: calc(var(--small-font-size) - 0.5px); font-weight: 700; color: #334155;
        white-space: nowrap; font-variant-numeric: tabular-nums; box-sizing: border-box; overflow: hidden; text-overflow: ellipsis;
      }
      .waterfall-bar-wrap { position: relative; flex: 1; width: 100%; border-bottom: 1px solid #cbd5e0; margin-top: 3px; }
      .waterfall-bar {
        position: absolute; left: 20%; right: 20%; border-radius: 3px 3px 0 0; min-height: 4px;
        box-shadow: none; cursor: help; transition: opacity 0.15s ease;
      }
      .waterfall-bar:hover { opacity: 0.82; }
      .waterfall-bar.total { background: #64748b; }
      .waterfall-bar.total-start { background: #ffffff; border: 1px solid var(--color-budget); box-sizing: border-box; background-image: linear-gradient(45deg, rgba(174, 199, 232, 0.45) 25%, transparent 25%, transparent 50%, rgba(174, 199, 232, 0.45) 50%, rgba(174, 199, 232, 0.45) 75%, transparent 75%, transparent); background-size: 5px 5px; }
      .waterfall-bar.total-end { background: var(--color-actual); }
      .waterfall-bar.positive { background: #d32f2f; }
      .waterfall-bar.negative { background: #2e7d32; }
      .waterfall-label {
        margin-top: 6px; font-size: calc(var(--small-font-size) - 0.5px); font-weight: 600; color: #475569; text-align: center; line-height: 1.2;
        min-height: 30px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; word-break: break-word;
      }
      .waterfall-empty { align-self: center; color: #64748b; font-size: var(--ui-font-size); padding: 20px; }
      .waterfall-tooltip-note { margin-top: 6px; padding-top: 6px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: var(--small-font-size); }
      .executive-summary-list { display: flex; flex-direction: column; gap: 1px; background: #e2e8f0; border-radius: 4px; overflow: hidden; margin: 0; }
      .executive-summary-row { display: grid; grid-template-columns: 88px minmax(0, 1fr); gap: 10px; background: #ffffff; padding: 9px 12px; font-size: var(--ui-font-size); color: #2d3748; }
      .executive-summary-signal { display: inline-flex; align-self: start; justify-content: center; align-items: center; min-width: 76px; border-radius: 4px; padding: 3px 6px; font-size: var(--small-font-size); font-weight: 800; border: 1px solid transparent; text-align: center; }
      .executive-summary-signal.good { background: #e6f4ea; color: #137333; border-color: #ceead6; }
      .executive-summary-signal.watch { background: #fff4e5; color: #b45309; border-color: #fed7aa; }
      .executive-summary-signal.alert { background: #fce8e6; color: #c5221f; border-color: #fad2cf; }
      .executive-summary-body { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
      .executive-summary-metric { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; font-weight: 600; color: #4a5568; }
      .executive-summary-reading { font-variant-numeric: tabular-nums; white-space: nowrap; color: #1e293b; font-weight: 700; }
      .executive-summary-implication { color: #475569; line-height: 1.35; }
      .operational-kpi-grid {
        display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1px; margin-bottom: 14px;
        background: #e2e8f0; border: 1px solid #e2e8f0; border-radius: 4px; overflow: hidden;
      }
      .operational-kpi { background: #ffffff; padding: 9px 12px; display: flex; flex-direction: column; gap: 4px; }
      .operational-kpi-label { font-size: var(--ui-font-size); font-weight: 600; color: #4a5568; }
      .operational-kpi-value { font-size: calc(var(--ui-font-size) + 2px); font-weight: 700; color: #1e293b; font-variant-numeric: tabular-nums; }
      .operational-kpi-sub { font-size: var(--small-font-size); color: #475569; line-height: 1.35; }
      .operational-grid { display: grid; grid-template-columns: minmax(360px, 1.45fr) minmax(260px, 0.85fr); gap: var(--layout-gap); align-items: start; }
      .operational-panel { border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc; padding: var(--panel-padding); min-width: 0; }
      .operational-table-wrap { max-height: 360px; overflow: auto; border: 1px solid #e2e8f0; border-radius: 4px; background: #ffffff; }
      .operational-table { width: 100%; border-collapse: collapse; font-size: var(--ui-font-size); color: #2d3748; }
      .operational-table th {
        position: sticky; top: 0; z-index: 1; background: #f1f5f9; text-align: left; padding: 7px 8px;
        font-size: var(--small-font-size); color: #4a5568; text-transform: uppercase; letter-spacing: 0.55px; border-bottom: 1px solid #e2e8f0;
      }
      .operational-table td { padding: 8px; border-bottom: 1px solid #eef2f6; font-weight: 600; vertical-align: top; }
      .operational-table td.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
      .movement-tag {
        display: inline-flex; align-items: center; justify-content: center; min-width: 86px; border-radius: 4px; padding: 3px 6px;
        font-size: var(--small-font-size); font-weight: 700; border: 1px solid transparent; white-space: nowrap;
      }
      .movement-tag.entrada-nova { background: #e8f0fe; color: #174ea6; border-color: #d2e3fc; }
      .movement-tag.zeragem { background: #f1f3f4; color: #5f6368; border-color: #e8eaed; }
      .movement-tag.pico-vs-media { background: #fce8e6; color: #c5221f; border-color: #fad2cf; }
      .movement-tag.queda-brusca { background: #fff4e5; color: #b45309; border-color: #fed7aa; }
      .movement-tag.reversao { background: #f3e8fd; color: #7e22ce; border-color: #e9d5ff; }
      .movement-tag.normal { background: #e6f4ea; color: #137333; border-color: #ceead6; }
      .operational-attention-list { display: flex; flex-direction: column; gap: 1px; background: #e2e8f0; border-radius: 4px; overflow: hidden; margin-bottom: 12px; }
      .operational-attention-row { background: #ffffff; padding: 9px 10px; font-size: var(--ui-font-size); color: #334155; line-height: 1.4; }
      .operational-explanation-text { display: flex; flex-direction: column; min-width: 0; }
      .operational-generated-text { background: #ffffff; border-left: 4px solid #cbd5e0; border-radius: 4px; padding: 10px 12px; color: #334155; font-size: var(--ui-font-size); line-height: 1.5; }
      .operational-empty { color: #64748b; font-size: var(--ui-font-size); padding: 16px 4px; }
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
      .highlight-title-box { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: var(--small-font-size); font-weight: 700; color: #1e293b; text-transform: uppercase; letter-spacing: 0.75px; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 2px solid #cbd5e0; }
      .highlight-title-main { display: inline-flex; align-items: center; gap: 6px; min-width: 0; }
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
      :host([data-layout="stacked"]) .operational-kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      :host([data-layout="stacked"]) .operational-grid { grid-template-columns: 1fr; }
      :host([data-layout="stacked"]) .main-visualization-layout { flex-direction: column; }
      :host([data-layout="stacked"]) .visualization-column.ytd-col { border-left: none; border-top: 1px solid #e2e8f0; padding-left: 0; padding-top: 14px; }
      :host([data-layout="stacked"]) .insight-grid { grid-template-columns: 1fr; }
      :host([data-size="compact"]) .data-row-item { grid-template-columns: 1fr; align-items: flex-start; }
      :host([data-size="compact"]) .cell-value,
      :host([data-size="compact"]) .cell-status-wrapper { justify-content: flex-start; text-align: left; }
      :host([data-size="compact"]) .executive-kpi-grid { grid-template-columns: 1fr; }
      :host([data-size="compact"]) .operational-kpi-grid { grid-template-columns: 1fr; }
      :host([data-size="compact"]) .executive-summary-row { grid-template-columns: 1fr; }
      :host([data-size="compact"]) .executive-summary-metric { flex-direction: column; align-items: flex-start; }
      :host([data-size="compact"]) .waterfall-panel-header { align-items: stretch; flex-direction: column; }
      :host([data-size="compact"]) .waterfall-mode-tabs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); width: 100%; }
      :host([data-size="compact"]) .waterfall-mode-btn { white-space: normal; padding: 5px 6px; text-align: center; }
      :host([data-size="compact"]) .waterfall-chart { --wf-step-min: 40px; --wf-gap: 3px; min-height: 168px; height: 176px; }
      :host([data-size="compact"]) .waterfall-value { font-size: calc(var(--small-font-size) - 1px); }
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
      <div class="view-tabs" role="tablist" aria-label="Visões do widget">
        <button class="view-tab active" id="executiveTabBtn" type="button" role="tab" aria-selected="true">Executivo</button>
        <button class="view-tab" id="diagnosticTabBtn" type="button" role="tab" aria-selected="false">Diagnóstico</button>
        <button class="view-tab" id="operationalTabBtn" type="button" role="tab" aria-selected="false">Operacional</button>
      </div>
      <div class="view-panel active" id="executiveView">
        <div class="executive-kpi-grid">
          <div class="executive-kpi">
            <div class="executive-kpi-label">Realizado YTD</div>
            <div class="executive-kpi-value" id="execActualYtd">-</div>
            <div class="executive-kpi-sub" id="execActualYtdSub">-</div>
          </div>
          <div class="executive-kpi">
            <div class="executive-kpi-label">Consumo do Orçamento</div>
            <div class="executive-kpi-value" id="execForecast">-</div>
            <div class="executive-kpi-sub" id="execForecastSub">-</div>
          </div>
          <div class="executive-kpi">
            <div class="executive-kpi-label">Principal Driver</div>
            <div class="executive-kpi-value driver-kpi-value" id="execProjectedGap">-</div>
            <div class="executive-kpi-sub" id="execProjectedGapSub">-</div>
          </div>
          <div class="executive-kpi">
            <div class="executive-kpi-label">Risco Executivo</div>
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
            <div class="copy-panel-header">
              <div class="executive-panel-title">Leitura Executiva</div>
              <button class="copy-text-btn" id="copyExecutiveTextBtn" type="button" aria-label="Copiar leitura executiva">Copiar</button>
            </div>
            <div class="executive-summary-list" id="executiveSummaryList"></div>
          </div>
        </div>
      </div>
      <div class="view-panel" id="diagnosticView">
      <div class="widget-legend">
        <div class="legend-item"><div class="legend-color hist"></div> Histórico (Realizado)</div>
        <div class="legend-item"><div class="legend-color act"></div> Mês Atual (Realizado)</div>
        <div class="legend-item"><div class="legend-color bud"></div> Orçado (Budget)</div>
      </div>
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
          <div class="highlight-title-box">
            <span class="highlight-title-main"><span class="highlight-icon-box">💡</span><span>Highlights</span></span>
            <button class="copy-text-btn" id="copyHighlightTextBtn" type="button" aria-label="Copiar highlights visíveis">Copiar</button>
          </div>
          <div class="highlight-content-text" id="highlightContentText"></div>
        </div>
      </div>
      </div>
      <div class="view-panel" id="operationalView">
        <div class="operational-kpi-grid" id="operationalSummaryCards"></div>
        <div class="operational-grid">
          <div class="operational-panel">
            <div class="executive-panel-title">Movimentações Atípicas</div>
            <div class="operational-table-wrap" id="operationalTableWrap"></div>
          </div>
          <div class="operational-panel">
            <div class="copy-panel-header">
              <div class="executive-panel-title">Atenção Controladoria</div>
              <button class="copy-text-btn" id="copyOperationalTextBtn" type="button" aria-label="Copiar explicação operacional">Copiar</button>
            </div>
            <div class="operational-explanation-text" id="operationalExplanationText">
              <div class="operational-attention-list" id="operationalAttentionWrap"></div>
              <div class="operational-generated-text" id="operationalGeneratedText"></div>
            </div>
          </div>
        </div>
      </div>
      <div class="bar-tooltip" id="barTooltip" aria-hidden="true"></div>
    </div>
  `;

  /* ==========================================================================
     4 & 5. ENGINE DE INTELIGÊNCIA ANALÍTICA SANEADA (PURE HEADLESS)
     ========================================================================== */
  class EvoTextGenerator {
    constructor() {
      this.templates = {
        adverseMaterial: "{item}: desvio YTD de {valor} ({pct} vs orçamento), com participação de {share} na variação acumulada.",
        savingMaterial: "{item}: saving YTD de {valorAbs} ({pct} vs orçamento), com participação de {share} na variação acumulada.",
        acceleration: "{item}: piora no mês de {monthValue}, sinalizando aceleração frente à competência anterior.",
        monitoring: "{item}: variação YTD de {valor} ({pct} vs orçamento), sem concentração suficiente para conclusão isolada."
      };
      this.priorityLabels = {
        adverseWatch: "Desvio monitorado",
        savingWatch: "Saving monitorado",
        adverseMaterial: "Desvio material",
        savingMaterial: "Saving relevante",
        budgetAttention: "Ponto de atenção orçamentária",
        savingBudgetAdherence: "Saving em aderência ao orçamento"
      };
      this.trendLabels = {
        stable: "comportamento estável",
        acceleration: "deterioração na competência",
        easingPressure: "redução do desvio na competência",
        savingExpansion: "ampliação do saving na competência",
        savingSoftening: "menor contribuição de saving na competência"
      };
    }

    formatMoney(value, signed) {
      const sign = value < 0 ? "-" : (signed && value > 0 ? "+" : "");
      return `${sign}R$ ${Math.abs(value / 1000000).toFixed(2)}M`;
    }

    formatPercent(value, signed) {
      return `${signed && value > 0 ? "+" : ""}${value.toFixed(1)}%`;
    }

    getPriorityLabel(insight) {
      return this.priorityLabels[insight && insight.priorityKey] || (insight && insight.isSaving ? "Saving monitorado" : "Desvio monitorado");
    }

    getTrendLabel(insight) {
      return this.trendLabels[insight && insight.trendKey] || "comportamento estável";
    }

    buildRiskMessage(source) {
      const ytd = source && source.ytd ? source.ytd : {
        diffNominal: source ? source.diffYtdNominal : 0,
        pctVar: source ? source.diffYtdPercent : 0,
        consumption: source ? source.consumoBudgetPercent : 0
      };
      const absYtdPct = Math.abs(ytd.pctVar || 0);
      const consumption = ytd.consumption || 0;
      if ((ytd.diffNominal || 0) <= 0 && consumption <= 100) {
        return { label: "Controlado", className: "good", description: "YTD dentro do orçamento e sem pressão material." };
      }
      if (absYtdPct <= 5 || consumption <= 105) {
        return { label: "Acompanhar", className: "watch", description: "Desvio moderado, requer acompanhamento dos drivers." };
      }
      return { label: "Atenção", className: "alert", description: "Desvio material no YTD, priorizar plano de ação." };
    }

    buildExecutiveSummary(context) {
      const narrativeEvents = context && Array.isArray(context.narrativeEvents) && context.narrativeEvents.length ? context.narrativeEvents : null;
      if (narrativeEvents) return this.buildExecutiveSummaryFromEvents(narrativeEvents, context);

      const risk = this.buildRiskMessage(context);
      const drivers = this._sortedDrivers(context);
      const mainDriver = drivers[0] || null;
      const confidence = this.buildConfidence(mainDriver);
      const monthNum = Math.max(context.currentBarNode && context.currentBarNode.monthNum ? context.currentBarNode.monthNum : 1, 1);
      const runRateActual = context.totalRealizadoYTDAtual / monthNum;
      const runRateBudget = context.totalBudgetYTDCompleto / monthNum;
      const runRateGap = runRateActual - runRateBudget;
      const status = context.diffYtdNominal <= 0 ? "saving" : "desvio";
      const position = context.diffYtdNominal <= 0 ? "abaixo do orçamento" : "acima do orçamento";
      const driverShare = mainDriver ? Math.min(mainDriver.contributionPct || 0, 999) : 0;
      const driverAccount = mainDriver && mainDriver.driverConta
        ? ` Principal conta: ${mainDriver.driverConta}, com ${this.formatMoney(mainDriver.driverImpact || 0, true)}.`
        : "";
      return [
        {
          signal: risk.label,
          className: risk.className,
          metric: "O que aconteceu?",
          reading: `YTD ${this.formatPercent(context.diffYtdPercent, true)}`,
          implication: `O acumulado está ${position}, com ${status} de ${this.formatMoney(context.diffYtdNominal, true)}.`
        },
        {
          signal: runRateGap <= 0 ? "Pace abaixo" : "Pace acima",
          className: runRateGap <= 0 ? "good" : "alert",
          metric: "Quanto impactou?",
          reading: this.formatMoney(context.diffYtdNominal, true),
          implication: `Run-rate médio de ${this.formatMoney(runRateActual)} por mês vs pace orçamentário de ${this.formatMoney(runRateBudget)} por mês.`
        },
        {
          signal: mainDriver ? "Driver" : "Sem driver",
          className: mainDriver ? (mainDriver.isSaving ? "good" : "watch") : "watch",
          metric: "Qual o driver?",
          reading: mainDriver ? `${mainDriver.itemName} | ${driverShare.toFixed(1)}%` : "Sem driver material",
          implication: mainDriver
            ? `${mainDriver.itemName} é a maior contribuição identificada para o ${status} YTD.${driverAccount}`
            : "A variação está dispersa entre itens, sem concentração suficiente para uma conclusão executiva."
        },
        {
          signal: "Ação",
          className: mainDriver && mainDriver.isSaving ? "good" : "watch",
          metric: "Ação recomendada",
          reading: mainDriver ? this.getPriorityLabel(mainDriver) : "Triagem",
          implication: this.getRecommendedAction(mainDriver)
        },
        {
          signal: confidence.levelLabel,
          className: confidence.className,
          metric: "Nível de confiança",
          reading: `${confidence.share.toFixed(1)}% do impacto`,
          implication: confidence.message
        }
      ];
    }

    buildHighlightList(insights, context) {
      const narrativeEvents = context && Array.isArray(context.narrativeEvents) && context.narrativeEvents.length ? context.narrativeEvents : null;
      if (narrativeEvents) return this.buildHighlightsFromEvents(narrativeEvents, context);

      const mainDriver = (insights && insights[0]) || null;
      const status = context.diffYtdNominal <= 0 ? "saving" : "desvio";
      const position = context.diffYtdNominal <= 0 ? "abaixo do orçamento" : "acima do orçamento";
      const driverPhrase = mainDriver
        ? `com maior contribuição em ${mainDriver.itemName}`
        : "sem concentração dominante entre os itens analisados";
      const rows = [
        {
          title: "O que aconteceu",
          text: `O YTD está ${this.formatPercent(Math.abs(context.diffYtdPercent || 0), false)} ${position}, com ${status} de ${this.formatMoney(context.diffYtdNominal, true)}, ${driverPhrase}.`
        }
      ];
      if (mainDriver) {
        rows.push({
          title: "Driver principal",
          text: this._buildTemplateText(mainDriver)
        });
        if (mainDriver.driverConta) {
          rows.push({
            title: "Conta contábil",
            text: `${mainDriver.driverConta} responde por ${Math.min(mainDriver.driverShare || 0, 999).toFixed(1)}% da variação do item, com impacto de ${this.formatMoney(mainDriver.driverImpact || 0, true)}.`
          });
        }
      }
      rows.push({
        title: "Ação recomendada",
        text: this.getRecommendedAction(mainDriver)
      });
      rows.push({
        title: "Confiança",
        text: this.buildConfidence(mainDriver).message
      });
      return rows;
    }

    buildExecutiveSummaryFromEvents(events, context) {
      const risk = this.buildRiskMessage(context);
      const primary = this._selectPrimaryEvent(events, context);
      const concentration = this._firstEvent(events, "account_concentration");
      const acceleration = this._firstEvent(events, "acceleration");
      const dispersion = this._firstEvent(events, "dispersion");
      const lowConfidence = this._firstEvent(events, "low_confidence");
      const driverEvent = concentration || primary;
      const confidenceEvent = lowConfidence || dispersion || primary;
      const mainActionEvent = acceleration || concentration || primary;
      const status = primary && primary.type === "saving_opportunity" ? "saving" : "desvio";
      const position = status === "saving" ? "abaixo do orçamento" : "acima do orçamento";
      const primaryPercent = primary ? this.formatPercent(Math.abs(primary.percent || 0), false) : this.formatPercent(Math.abs(context.diffYtdPercent || 0), false);

      return [
        {
          signal: risk.label,
          className: risk.className,
          metric: "O que aconteceu?",
          reading: `YTD ${this.formatPercent(context.diffYtdPercent || 0, true)}`,
          implication: primary ? primary.messageHint : `O acumulado está ${position}, com ${status} de ${this.formatMoney(context.diffYtdNominal || 0, true)}.`
        },
        {
          signal: this._eventSeverityLabel(primary),
          className: this._eventClassName(primary),
          metric: "Quanto impactou?",
          reading: this.formatMoney(primary ? primary.amount : context.diffYtdNominal, true),
          implication: primary && primary.businessMeaning
            ? `${primary.businessMeaning} Impacto equivalente a ${primaryPercent} versus orçamento.`
            : `Impacto equivalente a ${primaryPercent} versus orçamento, considerando a leitura acumulada do período.`
        },
        {
          signal: driverEvent && driverEvent.type === "account_concentration" ? "Concentrado" : (driverEvent ? "Driver" : "Sem driver"),
          className: driverEvent ? this._eventClassName(driverEvent) : "watch",
          metric: "Qual o driver?",
          reading: driverEvent && driverEvent.subject ? driverEvent.subject : "Sem driver material",
          implication: driverEvent && driverEvent.driverAccount
            ? `${driverEvent.subject} tem concentração relevante em ${driverEvent.driverAccount}.`
            : (dispersion ? dispersion.messageHint : "A variação está distribuída entre itens, sem concentração dominante.")
        },
        {
          signal: "Ação",
          className: this._eventClassName(mainActionEvent),
          metric: "Ação recomendada",
          reading: mainActionEvent ? this._eventTypeLabel(mainActionEvent.type) : "Triagem",
          implication: mainActionEvent && mainActionEvent.hypothesis
            ? `${mainActionEvent.hypothesis} ${this.getRecommendedActionFromEvent(mainActionEvent)}`
            : this.getRecommendedActionFromEvent(mainActionEvent)
        },
        {
          signal: confidenceEvent ? this._confidenceLabel(confidenceEvent.confidence) : "Baixa",
          className: confidenceEvent ? this._confidenceClassName(confidenceEvent.confidence) : "alert",
          metric: "Nível de confiança",
          reading: confidenceEvent && confidenceEvent.percent ? `${Math.min(Math.abs(confidenceEvent.percent), 999).toFixed(1)}% do impacto` : "Baixa granularidade",
          implication: confidenceEvent && confidenceEvent.rationale ? confidenceEvent.rationale : (confidenceEvent ? confidenceEvent.messageHint : "Confiança baixa: não há driver dominante suficiente para uma leitura conclusiva.")
        }
      ];
    }

    buildHighlightsFromEvents(events, context) {
      const primary = this._selectPrimaryEvent(events, context);
      const acceleration = this._firstEvent(events, "acceleration");
      const concentration = this._firstEvent(events, "account_concentration");
      const dispersion = this._firstEvent(events, "dispersion");
      const lowConfidence = this._firstEvent(events, "low_confidence");
      const actionEvent = acceleration || concentration || primary;
      const rows = [];

      if (primary) {
        rows.push({
          title: "O que aconteceu",
          text: primary.businessMeaning || primary.messageHint
        });
      } else {
        rows.push({
          title: "O que aconteceu",
          text: `O YTD apresenta ${this.formatMoney(context.diffYtdNominal || 0, true)} (${this.formatPercent(Math.abs(context.diffYtdPercent || 0), false)}) versus orçamento.`
        });
      }

      if (concentration) {
        rows.push({
          title: "Driver principal",
          text: concentration.messageHint
        });
      } else if (dispersion) {
        rows.push({
          title: "Driver principal",
          text: dispersion.messageHint
        });
      }

      if (acceleration) {
        rows.push({
          title: "Tendência",
          text: acceleration.hypothesis || acceleration.messageHint
        });
      }

      if (primary && primary.hypothesis && primary !== acceleration) {
        rows.push({
          title: "Hipótese analítica",
          text: primary.hypothesis
        });
      }

      rows.push({
        title: "Ação recomendada",
        text: this.getRecommendedActionFromEvent(actionEvent)
      });

      rows.push({
        title: "Confiança",
        text: (lowConfidence || dispersion || primary || {}).rationale || this._eventConfidenceMessage(lowConfidence || dispersion || primary)
      });

      return rows;
    }

    getRecommendedActionFromEvent(event) {
      if (!event) {
        return "Abrir os principais itens e validar se a dispersão decorre de mix, competência contábil ou ausência de granularidade.";
      }
      if (event.recommendedAction) return event.recommendedAction;
      if (event.type === "acceleration") return "Priorizar investigação da competência atual e revisar premissas do forecast.";
      if (event.type === "saving_opportunity") return "Avaliar se o saving é estrutural ou postergação de despesa antes de incorporar no forecast.";
      if (event.type === "account_concentration") return "Validar recorrência, competência contábil e tendência da conta dominante para o próximo ciclo de forecast.";
      if (event.type === "dispersion" || event.type === "low_confidence") return "Ampliar o drilldown antes de concluir causa raiz ou ajustar forecast.";
      return "Detalhar as contas de maior impacto, confirmar natureza recorrente e definir responsável pelo plano de ação.";
    }

    _firstEvent(events, type) {
      return (events || []).find(event => event.type === type) || null;
    }

    _eventConfidenceMessage(event) {
      if (!event) return "Confiança média: leitura baseada nos principais eventos narrativos do período.";
      const label = this._confidenceLabel(event.confidence).toLowerCase();
      const share = Math.min(Math.abs(event.percent || 0), 999);
      if (event.type === "low_confidence") return event.messageHint;
      if (event.type === "dispersion") return `Confiança ${label}: a variação está distribuída; o maior fator representa ${share.toFixed(1)}% do impacto analisado.`;
      return `Confiança ${label}: leitura baseada no evento de maior relevância identificado para ${event.subject || "o período"}.`;
    }

    _selectPrimaryEvent(events, context) {
      const preferredType = context && context.diffYtdNominal <= 0 ? "saving_opportunity" : "budget_pressure";
      return this._firstEvent(events, preferredType) || this._firstEvent(events, "budget_pressure") || this._firstEvent(events, "saving_opportunity") || (events && events[0]) || null;
    }

    _eventClassName(event) {
      if (!event) return "watch";
      if (event.severity === "critical" || event.severity === "high") return event.type === "saving_opportunity" ? "good" : "alert";
      if (event.severity === "low") return event.type === "saving_opportunity" ? "good" : "watch";
      return "watch";
    }

    _eventSeverityLabel(event) {
      if (!event) return "Impacto";
      if (event.severity === "critical") return "Crítico";
      if (event.severity === "high") return "Material";
      if (event.severity === "medium") return "Relevante";
      return "Monitorar";
    }

    _eventTypeLabel(type) {
      const labels = {
        budget_pressure: "Pressão orçamentária",
        saving_opportunity: "Saving",
        acceleration: "Aceleração",
        dispersion: "Dispersão",
        low_confidence: "Baixa confiança",
        account_concentration: "Concentração"
      };
      return labels[type] || "Triagem";
    }

    _confidenceLabel(confidence) {
      if (confidence === "high") return "Alta";
      if (confidence === "medium") return "Média";
      return "Baixa";
    }

    _confidenceClassName(confidence) {
      if (confidence === "high") return "good";
      if (confidence === "medium") return "watch";
      return "alert";
    }

    buildHighlightDetail(insight) {
      const confidence = this.buildConfidence(insight);
      const parts = [
        this._buildDetailOpening(insight),
        `Realizado acumulado: ${this.formatMoney(insight.realizado)} vs orçamento de ${this.formatMoney(insight.budget)}.`,
        this._buildTrendSentence(insight)
      ];
      if (Math.abs(insight.yoyDiff || 0) > 0) {
        parts.push(`No comparativo YoY, o realizado apresenta ${this.formatMoney(insight.yoyDiff, true)} (${this.formatPercent(insight.yoyPct || 0, true)}).`);
      }
      if (insight.driverConta && Math.abs(insight.driverImpact || 0) > 0) {
        parts.push(`Conta de maior impacto: ${insight.driverConta}, ${this.formatMoney(insight.driverImpact, true)} e ${Math.min(insight.driverShare || 0, 999).toFixed(1)}% da variação do item.`);
      }
      parts.push(`Ação recomendada: ${this.getRecommendedAction(insight)}`);
      parts.push(confidence.message);
      return {
        title: `${this.getPriorityLabel(insight)} - ${insight.itemName}`,
        body: parts.join(" ")
      };
    }

    buildConfidence(insight) {
      if (!insight) {
        return {
          level: "low",
          levelLabel: "Baixa",
          className: "alert",
          share: 0,
          message: "Confiança baixa: não há driver dominante suficiente para uma leitura conclusiva."
        };
      }
      const share = Math.max(insight.driverShare || 0, insight.contributionPct || 0);
      const level = share > 50 ? "high" : (share > 25 ? "medium" : "low");
      const levelLabel = level === "high" ? "Alta" : (level === "medium" ? "Média" : "Baixa");
      const className = level === "high" ? "good" : (level === "medium" ? "watch" : "alert");
      const target = (insight.driverShare || 0) > 0 ? "a principal conta" : "o maior driver";
      const status = insight.isSaving ? "saving" : "desvio";
      const suffix = level === "high"
        ? "há concentração suficiente para direcionar a próxima ação."
        : (level === "medium"
          ? "há concentração relevante, mas ainda existe dispersão entre contas."
          : "há dispersão relevante; trate a leitura como triagem inicial.");
      return {
        level,
        levelLabel,
        className,
        share,
        message: `Confiança ${levelLabel.toLowerCase()}: ${target} representa ${Math.min(share, 999).toFixed(1)}% do ${status}; ${suffix}`
      };
    }

    getRecommendedAction(insight) {
      if (!insight) {
        return "Abrir os principais itens e validar se a dispersão decorre de mix, competência contábil ou ausência de granularidade.";
      }
      if (insight.insightType === "acceleration") {
        return "Priorizar investigação da competência atual e revisar premissas do forecast.";
      }
      if (insight.isSaving) {
        return "Avaliar se o saving é estrutural ou postergação de despesa antes de incorporar no forecast.";
      }
      if ((insight.driverShare || 0) >= 50) {
        return "Validar recorrência, competência contábil e tendência da conta dominante para o próximo ciclo de forecast.";
      }
      return "Detalhar as contas de maior impacto, confirmar natureza recorrente e definir responsável pelo plano de ação.";
    }

    _buildDetailOpening(insight) {
      const direction = insight.isSaving ? "Saving YTD" : "Desvio YTD";
      const value = insight.isSaving
        ? this.formatMoney(Math.abs(insight.desvio || 0), false)
        : this.formatMoney(insight.desvio || 0, true);
      const pct = this.formatPercent(Math.abs(insight.pctVar || 0), false);
      const share = Math.min(Math.abs(insight.contributionPct || 0), 999).toFixed(1);
      return `${direction} de ${value} (${pct} vs orçamento), com participação de ${share}% na variação acumulada.`;
    }

    _buildTrendSentence(insight) {
      const monthDiff = insight.monthDiff || 0;
      const previousMonthDiff = insight.previousMonthDiff || 0;
      const acceleration = insight.acceleration || 0;
      if (insight.insightType === "acceleration") {
        return `Tendência mensal: piora de ${this.formatMoney(acceleration, true)} frente ao mês anterior, com variação atual de ${this.formatMoney(monthDiff, true)}.`;
      }
      if (insight.trendKey === "easingPressure") {
        return `Tendência mensal: pressão em redução; variação atual de ${this.formatMoney(monthDiff, true)} vs ${this.formatMoney(previousMonthDiff, true)} no mês anterior.`;
      }
      if (insight.trendKey === "savingExpansion") {
        return `Tendência mensal: saving em expansão; variação atual de ${this.formatMoney(monthDiff, true)} vs ${this.formatMoney(previousMonthDiff, true)} no mês anterior.`;
      }
      if (insight.trendKey === "savingSoftening") {
        return `Tendência mensal: menor contribuição de saving; variação atual de ${this.formatMoney(monthDiff, true)} vs ${this.formatMoney(previousMonthDiff, true)} no mês anterior.`;
      }
      return `Tendência mensal: ${this.getTrendLabel(insight)}, com variação atual de ${this.formatMoney(monthDiff, true)}.`;
    }

    _sortedDrivers(context) {
      const rows = context && context.analysis && context.analysis.waterfallTable ? context.analysis.waterfallTable : [];
      return [...rows].sort((a, b) => Math.abs(b.desvio) - Math.abs(a.desvio));
    }

    _buildTemplateText(insight) {
      const key = this._templateKey(insight);
      const template = this.templates[key] || this.templates.monitoring;
      return this._applyTemplate(template, {
        item: insight.itemName,
        valor: this.formatMoney(insight.desvio, true),
        valorAbs: this.formatMoney(Math.abs(insight.desvio || 0), false),
        pct: this.formatPercent(Math.abs(insight.pctVar || 0), false),
        share: `${Math.min(Math.abs(insight.contributionPct || 0), 999).toFixed(1)}%`,
        monthValue: this.formatMoney(insight.monthDiff || 0, true)
      });
    }

    _templateKey(insight) {
      if (!insight) return "monitoring";
      if (insight.insightType === "acceleration") return "acceleration";
      if (insight.priorityKey === "adverseMaterial") return "adverseMaterial";
      if (insight.priorityKey === "savingMaterial") return "savingMaterial";
      return insight.isSaving ? "savingMaterial" : "monitoring";
    }

    _applyTemplate(template, values) {
      return template.replace(/\{(\w+)\}/g, (_, key) => values[key] != null ? values[key] : "");
    }
  }

  class EvoNarrativeEventBuilder {
    buildNarrativeEvents(context, analysis, selectedInsights, varianceTable) {
      const resolvedAnalysis = analysis || (context && context.analysis) || {};
      const insights = Array.isArray(selectedInsights)
        ? selectedInsights
        : (Array.isArray(resolvedAnalysis.outlierTable) ? resolvedAnalysis.outlierTable : []);
      const variance = varianceTable || resolvedAnalysis.varianceTable || this._varianceFromContext(context);
      const mainInsight = (resolvedAnalysis.summary && resolvedAnalysis.summary.mainDriver) || insights[0] || null;
      const ytd = variance.ytd || {};
      const ytdDiff = this._number(ytd.diffNominal, context && context.diffYtdNominal);
      const events = [];

      if (ytdDiff > 0 || (mainInsight && !mainInsight.isSaving)) {
        events.push(this._buildBudgetPressureEvent(context, variance, mainInsight));
      }
      if (ytdDiff <= 0 || (mainInsight && mainInsight.isSaving)) {
        events.push(this._buildSavingOpportunityEvent(context, variance, mainInsight));
      }

      const floor = this._materialityFloor(context, variance);
      insights.forEach(insight => {
        if (this._isAcceleration(insight, floor)) {
          events.push(this._buildAccelerationEvent(context, variance, insight));
        }
        if ((insight.driverShare || 0) >= 50) {
          events.push(this._buildAccountConcentrationEvent(context, variance, insight));
        }
      });

      const mainShare = this._confidenceShare(mainInsight);
      if (!mainInsight || mainShare < 25) {
        events.push(this._buildDispersionEvent(context, variance, mainInsight));
      }
      if (this._confidenceLevel(mainInsight) === "low") {
        events.push(this._buildLowConfidenceEvent(context, variance, mainInsight));
      }

      return this._dedupeEvents(events);
    }

    _varianceFromContext(context) {
      const monthDiff = this._number(context && context.diffNominal, 0);
      const monthBudget = this._number(context && context.budgetVal, 0);
      const ytdDiff = this._number(context && context.diffYtdNominal, 0);
      const ytdBudget = this._number(context && context.totalBudgetYTDCompleto, 0);
      return {
        month: {
          diffNominal: monthDiff,
          pctVar: monthBudget !== 0 ? (monthDiff / monthBudget) * 100 : this._number(context && context.diffPercent, 0),
          consumption: this._number(context && context.consumptionMonthPercent, 0),
          isSaving: monthDiff <= 0
        },
        ytd: {
          diffNominal: ytdDiff,
          pctVar: ytdBudget !== 0 ? (ytdDiff / ytdBudget) * 100 : this._number(context && context.diffYtdPercent, 0),
          consumption: this._number(context && context.consumoBudgetPercent, 0),
          budget: ytdBudget,
          actual: this._number(context && context.totalRealizadoYTDAtual, 0),
          isSaving: ytdDiff <= 0
        }
      };
    }

    _buildBudgetPressureEvent(context, variance, insight) {
      const ytd = variance.ytd || {};
      const source = insight && !insight.isSaving ? insight : null;
      const amount = source ? source.desvio : this._number(ytd.diffNominal, context && context.diffYtdNominal);
      const percent = source ? source.pctVar : this._number(ytd.pctVar, context && context.diffYtdPercent);
      const subject = source ? source.itemName : "YTD";
      const confidence = this._confidenceLevel(source || insight);
      const driverText = source
        ? `, com maior contribuição em ${source.itemName}`
        : "";
      return this._event({
        type: "budget_pressure",
        subject,
        amount,
        percent,
        driverAccount: source ? source.driverConta : "",
        confidence,
        messageHint: `O YTD apresenta desvio de ${this._formatMoney(this._number(ytd.diffNominal, amount), true)} (${this._formatPercent(Math.abs(this._number(ytd.pctVar, percent)))}) versus orçamento${driverText}.`,
        recommendedAction: source && source.driverConta
          ? "Validar recorrência, competência contábil e tendência da conta dominante para o próximo ciclo de forecast."
          : "Detalhar os principais itens de pressão e confirmar natureza recorrente antes de ajustar o forecast.",
        source,
        context,
        variance
      });
    }

    _buildSavingOpportunityEvent(context, variance, insight) {
      const ytd = variance.ytd || {};
      const source = insight && insight.isSaving ? insight : null;
      const amount = source ? source.desvio : this._number(ytd.diffNominal, context && context.diffYtdNominal);
      const percent = source ? source.pctVar : this._number(ytd.pctVar, context && context.diffYtdPercent);
      const subject = source ? source.itemName : "YTD";
      const confidence = this._confidenceLevel(source || insight);
      const driverText = source
        ? `, com maior contribuição em ${source.itemName}`
        : "";
      return this._event({
        type: "saving_opportunity",
        subject,
        amount,
        percent,
        driverAccount: source ? source.driverConta : "",
        confidence,
        messageHint: `O YTD apresenta saving de ${this._formatMoney(Math.abs(this._number(ytd.diffNominal, amount)))} (${this._formatPercent(Math.abs(this._number(ytd.pctVar, percent)))}) versus orçamento${driverText}.`,
        recommendedAction: "Avaliar se o saving é estrutural ou postergação de despesa antes de incorporar no forecast.",
        source,
        context,
        variance
      });
    }

    _buildAccelerationEvent(context, variance, insight) {
      const confidence = this._confidenceLevel(insight);
      const acceleration = this._number(insight && insight.acceleration, 0);
      return this._event({
        type: "acceleration",
        subject: insight.itemName,
        amount: this._number(insight.monthDiff, insight.desvio),
        percent: this._number(insight.monthPctVar, insight.pctVar),
        driverAccount: insight.driverConta || "",
        confidence,
        messageHint: `${insight.itemName} mostra aceleração da pressão no mês, com piora de ${this._formatMoney(acceleration, true)} frente à competência anterior.`,
        recommendedAction: "Priorizar investigação da competência atual e revisar premissas do forecast.",
        source: insight,
        context,
        variance
      });
    }

    _buildAccountConcentrationEvent(context, variance, insight) {
      const share = Math.min(insight.driverShare || 0, 999);
      const confidence = this._confidenceLevel(insight);
      return this._event({
        type: "account_concentration",
        subject: insight.itemName,
        amount: this._number(insight.driverImpact, insight.desvio),
        percent: share,
        driverAccount: insight.driverConta || "",
        confidence,
        messageHint: `${insight.itemName} apresenta concentração em ${insight.driverConta || "conta dominante"}, que representa ${share.toFixed(1)}% da variação do item.`,
        recommendedAction: "Validar recorrência, competência contábil e tendência da conta dominante para o próximo ciclo de forecast.",
        source: insight,
        context,
        variance
      });
    }

    _buildDispersionEvent(context, variance, insight) {
      const share = this._confidenceShare(insight);
      return this._event({
        type: "dispersion",
        subject: insight && insight.itemName ? insight.itemName : "Carteira analisada",
        amount: this._number(variance.ytd && variance.ytd.diffNominal, context && context.diffYtdNominal),
        percent: share,
        driverAccount: insight ? insight.driverConta || "" : "",
        confidence: this._confidenceLevel(insight),
        messageHint: `Há dispersão relevante entre os drivers; o maior fator representa ${Math.min(share, 999).toFixed(1)}% do desvio analisado.`,
        recommendedAction: "Ampliar o drilldown antes de concluir causa raiz ou ajustar forecast.",
        source: insight,
        context,
        variance
      });
    }

    _buildLowConfidenceEvent(context, variance, insight) {
      const share = this._confidenceShare(insight);
      return this._event({
        type: "low_confidence",
        subject: insight && insight.itemName ? insight.itemName : "Carteira analisada",
        amount: this._number(variance.ytd && variance.ytd.diffNominal, context && context.diffYtdNominal),
        percent: share,
        driverAccount: insight ? insight.driverConta || "" : "",
        confidence: "low",
        messageHint: `Confiança baixa: o maior driver representa ${Math.min(share, 999).toFixed(1)}% da variação; trate a leitura como triagem inicial.`,
        recommendedAction: "Ampliar granularidade, validar classificação contábil e evitar conclusão definitiva sem drilldown complementar.",
        source: insight,
        context,
        variance
      });
    }

    _event(config) {
      const severity = this._severityFor(config.type, config.amount, config.percent, config.confidence, config.source, config.context, config.variance);
      return {
        type: config.type,
        severity,
        subject: String(config.subject || ""),
        amount: this._number(config.amount, 0),
        percent: this._number(config.percent, 0),
        driverAccount: String(config.driverAccount || ""),
        confidence: config.confidence || "low",
        messageHint: config.messageHint || "",
        recommendedAction: config.recommendedAction || ""
      };
    }

    _severityFor(type, amount, percent, confidence, insight, context, variance) {
      const floor = this._materialityFloor(context, variance);
      const absAmount = Math.abs(this._number(amount, 0));
      const absPct = Math.abs(this._number(percent, 0));
      const budget = Math.abs(this._number(variance && variance.ytd && variance.ytd.budget, context && context.totalBudgetYTDCompleto));
      const materialAmount = budget > 0 ? absAmount >= budget * 0.05 : absAmount >= floor * 8;
      const acceleration = type === "acceleration" || (insight && insight.insightType === "acceleration");
      if ((materialAmount || absPct >= 10) && acceleration && confidence === "low") return "critical";
      if (materialAmount || absPct >= 15 || (type === "account_concentration" && absAmount >= floor * 2)) return "high";
      if (absAmount >= floor || absPct >= 2 || type === "dispersion" || type === "low_confidence") return "medium";
      return "low";
    }

    _isAcceleration(insight, floor) {
      if (!insight) return false;
      if (insight.insightType === "acceleration") return true;
      return this._number(insight.acceleration, 0) > Math.max(floor, 0);
    }

    _confidenceShare(insight) {
      if (!insight) return 0;
      return Math.max(this._number(insight.driverShare, 0), this._number(insight.contributionPct, 0));
    }

    _confidenceLevel(insight) {
      const share = this._confidenceShare(insight);
      if (share > 50) return "high";
      if (share > 25) return "medium";
      return "low";
    }

    _materialityFloor(context, variance) {
      const budget = Math.abs(this._number(variance && variance.ytd && variance.ytd.budget, context && context.totalBudgetYTDCompleto));
      return Math.max(1000, budget * 0.002);
    }

    _dedupeEvents(events) {
      const order = {
        budget_pressure: 1,
        saving_opportunity: 1,
        acceleration: 2,
        account_concentration: 3,
        dispersion: 4,
        low_confidence: 5
      };
      const seen = new Set();
      return events
        .filter(Boolean)
        .filter(event => {
          const key = `${event.type}|${event.subject}|${event.driverAccount}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .sort((a, b) => (order[a.type] || 9) - (order[b.type] || 9));
    }

    _number(value, fallback) {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : (Number.isFinite(Number(fallback)) ? Number(fallback) : 0);
    }

    _formatMoney(value, signed) {
      const numeric = this._number(value, 0);
      const sign = numeric < 0 ? "-" : (signed && numeric > 0 ? "+" : "");
      return `${sign}R$ ${Math.abs(numeric / 1000000).toFixed(2)}M`;
    }

    _formatPercent(value) {
      return `${this._number(value, 0).toFixed(1)}%`;
    }
  }

  class EvoSemanticInterpreter {
    interpret(events, context) {
      if (!Array.isArray(events) || !events.length) return [];
      const index = this._buildIndex(events);
      return events.map(event => this._enrichEvent(event, context, index));
    }

    _buildIndex(events) {
      return events.reduce((acc, event) => {
        acc.types.add(event.type);
        if (!acc.bySubject.has(event.subject)) acc.bySubject.set(event.subject, []);
        acc.bySubject.get(event.subject).push(event);
        return acc;
      }, { types: new Set(), bySubject: new Map() });
    }

    _enrichEvent(event, context, index) {
      const semanticType = this._semanticType(event, context, index);
      return {
        ...event,
        semanticType,
        businessMeaning: this._businessMeaning(semanticType, event),
        hypothesis: this._hypothesis(semanticType, event),
        rationale: this._rationale(semanticType, event, index),
        evidence: this._evidence(event, context)
      };
    }

    _semanticType(event, context, index) {
      if (event.type === "account_concentration") return "concentration_risk";
      if (event.type === "dispersion" || event.type === "low_confidence") return "analytical_uncertainty";
      if (event.type === "acceleration") {
        return event.severity === "critical" || event.severity === "high" ? "structural_pressure" : "operational_instability";
      }
      if (event.type === "budget_pressure") {
        if (index.types.has("acceleration")) return "forecast_risk";
        return event.severity === "critical" || event.severity === "high" ? "structural_pressure" : "temporary_pressure";
      }
      if (event.type === "saving_opportunity") {
        return event.severity === "high" || Math.abs(event.percent || 0) >= 10 ? "possible_postponement" : "efficiency_opportunity";
      }
      if (event.type === "seasonal_behavior") return "seasonal_pattern";
      if (event.type === "operational_instability") return "operational_instability";
      return "financial_variation";
    }

    _businessMeaning(semanticType, event) {
      const labels = {
        structural_pressure: "pressão com indício de recorrência ou deterioração",
        temporary_pressure: "pressão pontual a validar",
        operational_instability: "instabilidade operacional no mês",
        forecast_risk: "risco de revisão de forecast",
        concentration_risk: "risco concentrado em conta ou driver dominante",
        possible_postponement: "saving que pode refletir postergação de despesa",
        efficiency_opportunity: "oportunidade de captura ou manutenção de saving",
        seasonal_pattern: "comportamento compatível com sazonalidade",
        analytical_uncertainty: "evidência insuficiente para conclusão assertiva",
        financial_variation: "variação financeira relevante"
      };
      return `${event.subject}: ${labels[semanticType] || labels.financial_variation}.`;
    }

    _hypothesis(semanticType, event) {
      const hypotheses = {
        structural_pressure: "Indícios de pressão estrutural; confirmar recorrência antes de concluir causa raiz.",
        temporary_pressure: "Possível efeito pontual de competência ou mix; validar recorrência no próximo ciclo.",
        operational_instability: "Possível instabilidade operacional na competência atual.",
        forecast_risk: "Indícios de risco para o forecast caso o comportamento se mantenha.",
        concentration_risk: "Possível concentração de impacto em conta específica, exigindo validação contábil.",
        possible_postponement: "Possível postergação de despesa; confirmar se o saving é estrutural.",
        efficiency_opportunity: "Possível oportunidade de eficiência; validar se há captura permanente.",
        seasonal_pattern: "Comportamento compatível com sazonalidade; comparar com ciclos equivalentes.",
        analytical_uncertainty: "Evidência dispersa; evitar conclusão sem drilldown complementar.",
        financial_variation: "Variação relevante; detalhar composição antes de definir ação."
      };
      return hypotheses[semanticType] || hypotheses.financial_variation;
    }

    _rationale(semanticType, event, index) {
      const parts = [
        `Evento ${event.type}`,
        `severidade ${event.severity}`,
        `confiança ${event.confidence}`,
        `impacto ${this._formatMoney(event.amount)}`
      ];
      if (Math.abs(event.percent || 0) > 0) parts.push(`${Math.abs(event.percent).toFixed(1)}%`);
      if (event.driverAccount) parts.push(`conta ${event.driverAccount}`);
      if (semanticType === "forecast_risk" && index.types.has("acceleration")) parts.push("com aceleração associada");
      return parts.join("; ") + ".";
    }

    _evidence(event, context) {
      const evidence = [
        { label: "tipo", value: event.type },
        { label: "severidade", value: event.severity },
        { label: "confiança", value: event.confidence },
        { label: "impacto", value: event.amount },
        { label: "percentual", value: event.percent }
      ];
      if (event.driverAccount) evidence.push({ label: "conta", value: event.driverAccount });
      if (context && context.currentBarNode) evidence.push({ label: "periodo", value: context.currentBarNode.label || context.currentBarNode.id });
      return evidence;
    }

    _formatMoney(value) {
      const numeric = Number(value) || 0;
      const sign = numeric < 0 ? "-" : "";
      return `${sign}R$ ${Math.abs(numeric / 1000000).toFixed(2)}M`;
    }
  }

  class EvoNarrativePrioritizer {
    prioritize(events, context) {
      if (!Array.isArray(events) || !events.length) return [];
      return [...events]
        .map((event, index) => ({
          ...event,
          priorityScore: this._score(event, context),
          priorityRank: index + 1,
          narrativeLayer: this._layer(event)
        }))
        .sort((a, b) => b.priorityScore - a.priorityScore)
        .map((event, index) => ({ ...event, priorityRank: index + 1 }))
        .slice(0, 6);
    }

    _score(event, context) {
      const severityWeight = { critical: 100, high: 75, medium: 45, low: 20 }[event.severity] || 20;
      const confidencePenalty = { high: 0, medium: 8, low: 18 }[event.confidence] || 18;
      const typeWeight = {
        budget_pressure: 20,
        saving_opportunity: 14,
        acceleration: 24,
        account_concentration: 16,
        forecast_risk: 24,
        operational_instability: 18,
        seasonal_behavior: 10,
        dispersion: 8,
        low_confidence: 6
      }[event.type] || 10;
      const semanticWeight = {
        structural_pressure: 24,
        forecast_risk: 24,
        operational_instability: 18,
        concentration_risk: 16,
        possible_postponement: 14,
        analytical_uncertainty: 8,
        seasonal_pattern: 8,
        temporary_pressure: 10,
        efficiency_opportunity: 10
      }[event.semanticType] || 10;
      const materiality = this._materialityScore(event, context);
      return severityWeight + typeWeight + semanticWeight + materiality - confidencePenalty;
    }

    _materialityScore(event, context) {
      const budget = Math.abs(Number(context && context.totalBudgetYTDCompleto) || 0);
      const amount = Math.abs(Number(event.amount) || 0);
      if (!budget || !amount) return Math.min(Math.abs(Number(event.percent) || 0), 25);
      return Math.min((amount / budget) * 100, 35);
    }

    _layer(event) {
      if (event.semanticType === "structural_pressure" || event.semanticType === "forecast_risk") return "strategic";
      if (event.type === "account_concentration" || event.semanticType === "concentration_risk") return "managerial";
      if (event.type === "acceleration" || event.semanticType === "operational_instability") return "operational";
      return event.confidence === "low" ? "investigative" : "managerial";
    }
  }

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
          priorityKey: classification.priorityKey,
          trendKey: classification.trendKey,
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

      return { outlierTable: selectedInsights, waterfallTable: outlierTable, summary, varianceTable };
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

      let priorityKey = adverse ? "adverseWatch" : "savingWatch";
      if (absContribution >= 30 || absPct >= 15 || Math.abs(desvio) >= adaptiveFloor * 8) {
        priorityKey = adverse ? "adverseMaterial" : "savingMaterial";
      } else if (budgetShare >= 15 || absMonth >= adaptiveFloor * 2) {
        priorityKey = adverse ? "budgetAttention" : "savingBudgetAdherence";
      }

      let trendKey = "stable";
      if (acceleratingAgainstBudget) trendKey = "acceleration";
      else if (easingPressure) trendKey = "easingPressure";
      else if (intensifyingSaving) trendKey = "savingExpansion";
      else if (!adverse && acceleration > adaptiveFloor) trendKey = "savingSoftening";

      let insightType = adverse ? "risk" : "saving";
      if (absPct < 2 && absContribution < 8) insightType = "monitoring";
      if (acceleratingAgainstBudget) insightType = "acceleration";

      return { priorityKey, trendKey, insightType };
    }

    _scoreFeature(desvio, pctVar, contributionPct, monthDiff, acceleration, classification) {
      const riskBoost = desvio > 0 ? 1.15 : 1;
      const priorityBoost = classification.priorityKey === "adverseMaterial" || classification.priorityKey === "savingMaterial" || classification.priorityKey === "budgetAttention" ? 1.25 : 1;
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
      this._eventBuilder = new EvoNarrativeEventBuilder();
      this._semanticInterpreter = new EvoSemanticInterpreter();
      this._narrativePrioritizer = new EvoNarrativePrioritizer();
      this._textGenerator = new EvoTextGenerator();
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
      this._boundWaterfallEnter = (e) => this._handleWaterfallHover(e);
      this._boundWaterfallMove = (e) => this._handleWaterfallHover(e);
      this._boundWaterfallLeave = () => this._hideBarTooltip();
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
        this._executiveTabBtn = this._shadowRoot.getElementById("executiveTabBtn");
        this._diagnosticTabBtn = this._shadowRoot.getElementById("diagnosticTabBtn");
        this._operationalTabBtn = this._shadowRoot.getElementById("operationalTabBtn");
        this._executiveView = this._shadowRoot.getElementById("executiveView");
        this._diagnosticView = this._shadowRoot.getElementById("diagnosticView");
        this._operationalView = this._shadowRoot.getElementById("operationalView");
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
        this._copyExecutiveTextBtn = this._shadowRoot.getElementById("copyExecutiveTextBtn");
        this._copyHighlightTextBtn = this._shadowRoot.getElementById("copyHighlightTextBtn");
        this._copyOperationalTextBtn = this._shadowRoot.getElementById("copyOperationalTextBtn");
        this._operationalSummaryCards = this._shadowRoot.getElementById("operationalSummaryCards");
        this._operationalTableWrap = this._shadowRoot.getElementById("operationalTableWrap");
        this._operationalExplanationText = this._shadowRoot.getElementById("operationalExplanationText");
        this._operationalAttentionWrap = this._shadowRoot.getElementById("operationalAttentionWrap");
        this._operationalGeneratedText = this._shadowRoot.getElementById("operationalGeneratedText");
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
        this._operationalTabBtn.addEventListener("click", () => this._setActiveView("operational"));
        this._waterfallYtdBtn.addEventListener("click", () => this._setWaterfallMode("ytd"));
        this._waterfallMomBtn.addEventListener("click", () => this._setWaterfallMode("mom"));
        this._copyExecutiveTextBtn.addEventListener("click", () => this._copyVisibleText(this._executiveSummaryList, this._copyExecutiveTextBtn));
        this._copyHighlightTextBtn.addEventListener("click", () => this._copyVisibleText(this._highlightContentText, this._copyHighlightTextBtn));
        this._copyOperationalTextBtn.addEventListener("click", () => this._copyVisibleText(this._operationalExplanationText, this._copyOperationalTextBtn));

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

    _isElementVisibleForCopy(element) {
      if (!element || !element.getClientRects || !element.getClientRects().length) return false;
      let current = element;
      while (current && current !== this._shadowRoot) {
        if (current.nodeType === Node.ELEMENT_NODE) {
          const style = getComputedStyle(current);
          if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
        }
        current = current.parentElement;
      }
      return true;
    }

    _normalizeCopiedText(text) {
      return String(text || "")
        .replace(/\s+/g, " ")
        .replace(/\s+([,.;:])/g, "$1")
        .trim();
    }

    _getVisibleTextForCopy(root) {
      if (!root) return "";
      const blockSelector = "li, .executive-summary-row, .operational-attention-row, .operational-generated-text";
      const blocks = [];
      if (root.matches && root.matches(blockSelector)) blocks.push(root);
      if (root.querySelectorAll) blocks.push(...root.querySelectorAll(blockSelector));

      const readTextNodeBlock = (element) => {
        const pieces = [];
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
          acceptNode: (node) => {
            const parent = node.parentElement;
            if (!parent || parent.closest("button, .copy-text-btn, .highlight-toggle-btn")) {
              return NodeFilter.FILTER_REJECT;
            }
            return this._isElementVisibleForCopy(parent) && this._normalizeCopiedText(node.nodeValue)
              ? NodeFilter.FILTER_ACCEPT
              : NodeFilter.FILTER_REJECT;
          }
        });
        while (walker.nextNode()) {
          pieces.push(this._normalizeCopiedText(walker.currentNode.nodeValue));
        }
        return this._normalizeCopiedText(pieces.join(" "));
      };

      const lines = blocks
        .filter(block => this._isElementVisibleForCopy(block))
        .map(readTextNodeBlock)
        .filter(Boolean);

      if (lines.length) return lines.join("\n");
      return readTextNodeBlock(root);
    }

    _applyClipboardInlineStyles(source, target) {
      const computed = getComputedStyle(source);
      const properties = [
        "display", "flex-direction", "grid-template-columns", "gap", "align-items", "justify-content",
        "color", "background-color", "border", "border-left", "border-radius",
        "padding", "margin", "font-family", "font-size", "font-weight", "line-height",
        "text-align", "text-transform", "letter-spacing", "white-space", "font-variant-numeric"
      ];
      properties.forEach(prop => {
        const value = computed.getPropertyValue(prop);
        if (value && value !== "normal" && value !== "none" && value !== "auto") {
          target.style.setProperty(prop, value);
        }
      });
      target.style.boxSizing = "border-box";
      target.style.maxWidth = "100%";
    }

    _cloneVisibleNodeForClipboard(node, isRoot = false) {
      if (node.nodeType === Node.TEXT_NODE) {
        return this._normalizeCopiedText(node.nodeValue) ? document.createTextNode(node.nodeValue) : null;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return null;

      const element = node;
      if (!isRoot && element.closest("button, .copy-text-btn, .highlight-toggle-btn")) return null;
      if (!isRoot && !this._isElementVisibleForCopy(element)) return null;

      const allowedTags = new Set(["DIV", "SPAN", "STRONG", "UL", "LI", "TABLE", "THEAD", "TBODY", "TR", "TH", "TD"]);
      const clone = document.createElement(allowedTags.has(element.tagName) ? element.tagName.toLowerCase() : "span");
      this._applyClipboardInlineStyles(element, clone);

      element.childNodes.forEach(child => {
        const childClone = this._cloneVisibleNodeForClipboard(child);
        if (childClone) clone.appendChild(childClone);
      });

      return clone.textContent.trim() || clone.children.length ? clone : null;
    }

    _getVisibleHtmlForCopy(root) {
      if (!root) return "";
      const clone = this._cloneVisibleNodeForClipboard(root, true);
      if (!clone) return "";
      const wrapper = document.createElement("div");
      wrapper.style.fontFamily = "Arial, sans-serif";
      wrapper.style.fontSize = "12px";
      wrapper.style.lineHeight = "1.45";
      wrapper.style.color = "#334155";
      wrapper.style.maxWidth = "760px";
      wrapper.appendChild(clone);
      return wrapper.outerHTML;
    }

    async _writePlainClipboardText(text) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(text);
          return;
        } catch (error) {
          // Fallback below covers restricted iframe/context permissions.
        }
      }

      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      textarea.style.top = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const copied = document.execCommand && document.execCommand("copy");
      textarea.remove();
      if (!copied) throw new Error("Clipboard indisponível");
    }

    _writeHtmlClipboardFallback(html) {
      if (!document.execCommand || !html) return false;
      const container = document.createElement("div");
      container.contentEditable = "true";
      container.innerHTML = html;
      container.style.position = "fixed";
      container.style.left = "-9999px";
      container.style.top = "0";
      container.style.width = "760px";
      document.body.appendChild(container);

      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(container);
      selection.removeAllRanges();
      selection.addRange(range);
      const copied = document.execCommand("copy");
      selection.removeAllRanges();
      container.remove();
      return copied;
    }

    async _writeClipboardContent(text, html) {
      if (html && navigator.clipboard && navigator.clipboard.write && window.ClipboardItem) {
        try {
          await navigator.clipboard.write([new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([text], { type: "text/plain" })
          })]);
          return;
        } catch (error) {
          // Fallback below covers restricted iframe/context permissions.
        }
      }

      if (html && this._writeHtmlClipboardFallback(html)) return;
      await this._writePlainClipboardText(text);
    }

    _setCopyButtonFeedback(button, label, stateClass) {
      if (!button) return;
      const originalLabel = button.dataset.defaultLabel || button.textContent || "Copiar";
      button.dataset.defaultLabel = originalLabel;
      button.textContent = label;
      button.classList.remove("copied", "error");
      if (stateClass) button.classList.add(stateClass);
      clearTimeout(button._copyFeedbackTimer);
      button._copyFeedbackTimer = setTimeout(() => {
        button.textContent = originalLabel;
        button.classList.remove("copied", "error");
      }, 1400);
    }

    async _copyVisibleText(root, button) {
      const text = this._getVisibleTextForCopy(root);
      if (!text) {
        this._setCopyButtonFeedback(button, "Sem texto", "error");
        return;
      }
      try {
        const html = this._getVisibleHtmlForCopy(root);
        await this._writeClipboardContent(text, html);
        this._setCopyButtonFeedback(button, "Copiado", "copied");
      } catch (error) {
        console.warn("Falha ao copiar texto", error);
        this._setCopyButtonFeedback(button, "Erro", "error");
      }
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
      const textModel = this._textGenerator.buildHighlightDetail(item);
      const liItem = document.createElement("li");
      const sLabel = document.createElement("strong"); sLabel.textContent = `${textModel.title}: `;
      liItem.appendChild(sLabel);
      liItem.appendChild(document.createTextNode(textModel.body));
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
      this._activeView = viewName === "diagnostic" || viewName === "operational" ? viewName : "executive";
      const isExecutive = this._activeView === "executive";
      const isDiagnostic = this._activeView === "diagnostic";
      const isOperational = this._activeView === "operational";
      if (this._executiveView) this._executiveView.classList.toggle("active", isExecutive);
      if (this._diagnosticView) this._diagnosticView.classList.toggle("active", isDiagnostic);
      if (this._operationalView) this._operationalView.classList.toggle("active", isOperational);
      if (this._executiveTabBtn) {
        this._executiveTabBtn.classList.toggle("active", isExecutive);
        this._executiveTabBtn.setAttribute("aria-selected", isExecutive ? "true" : "false");
      }
      if (this._diagnosticTabBtn) {
        this._diagnosticTabBtn.classList.toggle("active", isDiagnostic);
        this._diagnosticTabBtn.setAttribute("aria-selected", isDiagnostic ? "true" : "false");
      }
      if (this._operationalTabBtn) {
        this._operationalTabBtn.classList.toggle("active", isOperational);
        this._operationalTabBtn.setAttribute("aria-selected", isOperational ? "true" : "false");
      }
      if (this._lastAnalyticsViewContext) this._renderAnalyticsViews();
      if (isDiagnostic || isOperational) {
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
          context,
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
        context,
        caption: "Ponte entre orçamento acumulado e realizado acumulado, explicada pelos principais drivers filtrados."
      };
    }

    _getWaterfallAccountRows(model, itemName) {
      const context = model.context;
      if (!context || !itemName || !this._contaContabilDimId || !this._currentData || !Array.isArray(this._currentData.data)) return [];
      const accounts = new Map();
      const ensureAccount = (name) => {
        if (!accounts.has(name)) accounts.set(name, { name, realizado: 0, orcado: 0, current: 0, previous: 0 });
        return accounts.get(name);
      };

      const currentId = context.currentBarNode ? String(context.currentBarNode.id) : "";
      const previousNode = context.currentBarNode ? context.currentBarNode.previousSeriesData : null;
      const previousId = previousNode ? String(previousNode.id) : "";
      const currentYear = context.currentBarNode ? context.currentBarNode.yearValue : null;
      const cutoffMonth = context.currentBarNode ? context.currentBarNode.monthNum : null;

      this._currentData.data.forEach(row => {
        const rowItemName = this._getRowMemberLabel(row, this._itemFinanceiroDimId, "Outros");
        if (rowItemName !== itemName) return;
        const contaName = this._getRowMemberLabel(row, this._contaContabilDimId, "Geral");
        if (this._shouldIgnoreCompositionMember(contaName)) return;

        const tempoObj = this._tempoDimId ? row[this._tempoDimId] : null;
        if (!tempoObj) return;
        const timeId = String(tempoObj.id);
        const rawValue = this._parseValue(row[this._measId] ? (row[this._measId].formattedValue || row[this._measId].raw || 0) : 0);
        const isBudget = this._versaoDimId ? this._isBudgetVersionObject(row[this._versaoDimId]) : false;
        const bucket = ensureAccount(contaName);

        if (model.mode === "mom") {
          if (isBudget) return;
          if (timeId === currentId) bucket.current += rawValue;
          else if (timeId === previousId) bucket.previous += rawValue;
          return;
        }

        const seriesNode = context.fullSeriesById ? context.fullSeriesById.get(timeId) : null;
        if (!seriesNode || seriesNode.yearValue !== currentYear || seriesNode.monthNum > cutoffMonth) return;
        if (isBudget) bucket.orcado += rawValue;
        else bucket.realizado += rawValue;
      });

      return Array.from(accounts.values())
        .map(row => ({
          name: row.name,
          value: model.mode === "mom" ? row.current - row.previous : row.realizado - row.orcado,
          current: row.current,
          previous: row.previous,
          realizado: row.realizado,
          orcado: row.orcado
        }))
        .filter(row => Math.abs(row.value) > 0.00001)
        .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
        .slice(0, 6);
    }

    _buildWaterfallTooltipPayload(model, step, shownValue) {
      const accountRows = step.itemName ? this._getWaterfallAccountRows(model, step.itemName) : [];
      return {
        key: `waterfall|${model.mode}|${step.label}|${shownValue}`,
        title: step.label,
        subtitle: model.mode === "mom" ? "Contas por variação MoM" : "Contas por desvio YTD",
        total: shownValue,
        rows: accountRows
      };
    }

    _renderWaterfallTooltip(payload) {
      if (!this._barTooltip || !payload) return;
      const rows = payload.rows.length
        ? payload.rows.map(item => `<div class="bar-tooltip-row"><span class="bar-tooltip-name">${this._escapeHtml(item.name)}</span><span class="bar-tooltip-value-wrap"><span class="bar-tooltip-value">${this._escapeHtml(this._formatTooltipValue(item.value))}</span></span></div>`).join("")
        : `<div class="bar-tooltip-empty">Sem abertura por conta contábil disponível.</div>`;
      this._barTooltip.innerHTML = `
        <div class="bar-tooltip-title">${this._escapeHtml(payload.title)}<span class="bar-tooltip-subtitle">${this._escapeHtml(payload.subtitle)}</span></div>
        <div class="bar-tooltip-list">${rows}</div>
        <div class="waterfall-tooltip-note">Impacto total da barra: ${this._escapeHtml(this._formatTooltipValue(payload.total))}</div>
      `;
      this._barTooltip.classList.add("show");
      this._barTooltip.setAttribute("aria-hidden", "false");
    }

    _handleWaterfallHover(event) {
      const payload = event.currentTarget ? event.currentTarget._waterfallPayload : null;
      if (!payload) {
        this._hideBarTooltip();
        return;
      }
      if (this._activeTooltipPayload !== payload.key) {
        this._renderWaterfallTooltip(payload);
        this._activeTooltipPayload = payload.key;
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

    _getRiskState(context) {
      return this._textGenerator.buildRiskMessage(context);
    }

    _getExecutiveDriver(context) {
      const rows = context.analysis && context.analysis.waterfallTable ? context.analysis.waterfallTable : [];
      return [...rows].sort((a, b) => Math.abs(b.desvio) - Math.abs(a.desvio))[0] || null;
    }

    _renderAnalyticsViews() {
      if (!this._lastAnalyticsViewContext) return;
      const context = this._lastAnalyticsViewContext;
      const detailRows = this._getInsightRows(context.analysis.outlierTable);
      this._pendingHighlightDetailItems = detailRows;
      this._highlightDetailRendered = false;
      if (this._highlightToggleBtn) {
        this._setStyle(this._highlightToggleBtn, "display", detailRows.length > 0 ? "inline-flex" : "none");
      }
      if (this._isHighlightDetailOpen) this._renderHighlightDetailItems();
      this._renderExecutiveView(context);
      this._renderOperationalView(context);
    }

    _renderExecutiveView(context) {
      if (!this._executiveView) return;
      const formatM = (value) => `${value >= 0 ? "" : "-"}R$ ${Math.abs(value / 1000000).toFixed(2)}M`;
      const risk = this._getRiskState(context);
      const mainDriver = this._getExecutiveDriver(context);
      const ytdGapText = `${context.diffYtdNominal >= 0 ? "+" : ""}${(context.diffYtdNominal / 1000000).toFixed(2)}M`;
      const driverText = mainDriver ? `${mainDriver.desvio >= 0 ? "+" : ""}${(mainDriver.desvio / 1000000).toFixed(2)}M` : "-";

      this._setText(this._execActualYtd, formatM(context.diffYtdNominal));
      this._setText(this._execActualYtdSub, `${ytdGapText} (${context.diffYtdPercent.toFixed(1)}%) vs orçamento YTD`);
      this._setText(this._execForecast, `${context.consumoBudgetPercent.toFixed(1)}%`);
      this._setText(this._execForecastSub, `${formatM(context.totalRealizadoYTDAtual)} consumidos de ${formatM(context.totalBudgetYTDCompleto)}`);
      this._setText(this._execProjectedGap, mainDriver ? mainDriver.itemName : "-");
      if (this._execProjectedGap) this._execProjectedGap.title = mainDriver ? mainDriver.itemName : "";
      this._setText(this._execProjectedGapSub, mainDriver ? `${driverText} de impacto YTD` : "Sem driver material identificado");
      this._setClass(this._execRiskPill, `risk-pill ${risk.className}`);
      this._setText(this._execRiskPill, risk.label);
      this._setText(this._execRiskSub, risk.description);

      const waterfallModel = this._getWaterfallModel(context);
      this._renderWaterfall(waterfallModel);
      this._renderExecutiveSummary(context);
    }

    _renderWaterfall(model) {
      if (!this._waterfallChart) return;
      this._waterfallChart.textContent = "";
      this._waterfallChart.classList.remove("dense");
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
        { label: model.startLabel, value: model.startValue, type: "total", role: "total-start" },
        ...model.rows.map(item => ({ label: item.itemName, itemName: item.itemName, delta: item.delta, type: item.delta >= 0 ? "positive" : "negative" })),
        ...(Math.abs(residualGap) > 0.00001 ? [{ label: "Demais itens", delta: residualGap, type: residualGap >= 0 ? "positive" : "negative" }] : []),
        { label: model.endLabel, value: model.endValue, type: "total", role: "total-end" }
      ];
      this._waterfallChart.classList.toggle("dense", steps.length >= 8);

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
        const valueText = `${shownValue >= 0 ? "" : "-"}R$ ${Math.abs(shownValue / 1000000).toFixed(2)}M`;
        valueEl.textContent = valueText;
        valueEl.title = valueText;
        const wrapEl = document.createElement("div");
        wrapEl.className = "waterfall-bar-wrap";
        const barEl = document.createElement("div");
        barEl.className = `waterfall-bar ${step.type} ${step.role || ""}`;
        barEl.style.bottom = `${bottomPct}%`;
        barEl.style.height = `${heightPct}%`;
        if (step.itemName) {
          barEl._waterfallPayload = this._buildWaterfallTooltipPayload(model, step, shownValue);
          barEl.addEventListener("mouseenter", this._boundWaterfallEnter);
          barEl.addEventListener("mousemove", this._boundWaterfallMove);
          barEl.addEventListener("mouseleave", this._boundWaterfallLeave);
        }
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

    _renderExecutiveSummary(context) {
      if (!this._executiveSummaryList) return;
      this._executiveSummaryList.textContent = "";
      const fragment = document.createDocumentFragment();
      const rows = this._textGenerator.buildExecutiveSummary(context);

      rows.forEach(row => {
        const item = document.createElement("div");
        item.className = "executive-summary-row";
        const signal = document.createElement("div");
        signal.className = `executive-summary-signal ${row.className || "watch"}`;
        signal.textContent = row.signal;
        const body = document.createElement("div");
        body.className = "executive-summary-body";
        const metric = document.createElement("div");
        metric.className = "executive-summary-metric";
        const metricName = document.createElement("span");
        metricName.textContent = row.metric;
        const reading = document.createElement("span");
        reading.className = "executive-summary-reading";
        reading.textContent = row.reading;
        const implication = document.createElement("div");
        implication.className = "executive-summary-implication";
        implication.textContent = row.implication;
        metric.appendChild(metricName);
        metric.appendChild(reading);
        body.appendChild(metric);
        body.appendChild(implication);
        item.appendChild(signal);
        item.appendChild(body);
        fragment.appendChild(item);
      });
      this._executiveSummaryList.appendChild(fragment);
    }

    _buildOperationalMovementAnalysis(context) {
      const emptyResult = {
        summaryCards: [],
        movementRows: [],
        attentionRows: [],
        generatedText: "Sem dados suficientes para comparar movimentações operacionais no período selecionado."
      };
      if (!context || !context.currentBarNode || !context.fullSeriesById || !this._currentData || !Array.isArray(this._currentData.data)) {
        return emptyResult;
      }

      const currentNode = context.currentBarNode;
      const previousNode = currentNode.previousSeriesData || null;
      const currentId = String(currentNode.id);
      const previousId = previousNode ? String(previousNode.id) : "";
      const currentYear = currentNode.yearValue;
      const currentMonth = currentNode.monthNum;
      const previousYtdMonthIds = new Set();
      context.fullSeriesById.forEach((seriesNode, timeId) => {
        if (seriesNode.yearValue === currentYear && seriesNode.monthNum < currentMonth) {
          previousYtdMonthIds.add(String(timeId));
        }
      });
      const averagePeriods = previousYtdMonthIds.size;
      const movementMap = new Map();
      const ensureMovement = (itemName, accountName) => {
        const key = `${itemName}||${accountName}`;
        if (!movementMap.has(key)) {
          movementMap.set(key, {
            itemName,
            accountName,
            currentValue: 0,
            previousValue: 0,
            ytdBeforeValue: 0
          });
        }
        return movementMap.get(key);
      };

      this._currentData.data.forEach(row => {
        const tempoObj = this._tempoDimId ? row[this._tempoDimId] : null;
        if (!tempoObj) return;
        const timeId = String(tempoObj.id);
        const seriesNode = context.fullSeriesById.get(timeId);
        if (!seriesNode) return;
        const isCurrentMonth = timeId === currentId;
        const isPreviousMonth = previousId && timeId === previousId;
        const isPreviousYtdMonth = previousYtdMonthIds.has(timeId);
        if (!isCurrentMonth && !isPreviousMonth && !isPreviousYtdMonth) return;

        if (this._versaoDimId && this._isBudgetVersionObject(row[this._versaoDimId])) return;
        const itemName = this._getRowMemberLabel(row, this._itemFinanceiroDimId, "Item não informado");
        if (this._shouldIgnoreCompositionMember(itemName)) return;
        let accountName = this._contaContabilDimId ? this._getRowMemberLabel(row, this._contaContabilDimId, "Conta não vinculada") : "Conta não vinculada";
        if (this._shouldIgnoreCompositionMember(accountName)) accountName = "Conta não vinculada";
        const value = this._parseValue(row[this._measId] ? (row[this._measId].formattedValue || row[this._measId].raw || 0) : 0);
        const movement = ensureMovement(itemName, accountName);
        if (isCurrentMonth) movement.currentValue += value;
        if (isPreviousMonth) movement.previousValue += value;
        if (isPreviousYtdMonth) movement.ytdBeforeValue += value;
      });

      const rowsBase = Array.from(movementMap.values());
      const totalCurrentAbs = rowsBase.reduce((sum, item) => sum + Math.abs(item.currentValue), 0);
      const materialityFloor = Math.max(1000, totalCurrentAbs * 0.005);
      const severityRank = {
        "Reversão": 6,
        "Entrada nova": 5,
        "Zeragem": 5,
        "Pico vs média": 4,
        "Queda brusca": 4,
        "Normal": 1
      };

      const movementRows = rowsBase
        .map(item => {
          const averageValue = averagePeriods > 0 ? item.ytdBeforeValue / averagePeriods : 0;
          const momDelta = item.currentValue - item.previousValue;
          const avgDelta = item.currentValue - averageValue;
          const momPct = Math.abs(item.previousValue) >= materialityFloor ? (momDelta / Math.abs(item.previousValue)) * 100 : (Math.abs(item.currentValue) >= materialityFloor ? 999 : 0);
          const avgPct = Math.abs(averageValue) >= materialityFloor ? (avgDelta / Math.abs(averageValue)) * 100 : (Math.abs(item.currentValue) >= materialityFloor ? 999 : 0);
          const classification = this._classifyOperationalMovement(item.currentValue, item.previousValue, averageValue, materialityFloor);
          const score = (severityRank[classification] || 1) * 1000000000 + Math.max(Math.abs(momDelta), Math.abs(avgDelta), Math.abs(item.currentValue));
          return {
            ...item,
            averageValue,
            momDelta,
            avgDelta,
            momPct,
            avgPct,
            classification,
            score,
            action: this._getOperationalMovementAction(classification)
          };
        })
        .filter(item => Math.max(Math.abs(item.currentValue), Math.abs(item.previousValue), Math.abs(item.averageValue)) >= materialityFloor * 0.25)
        .sort((a, b) => b.score - a.score);

      const attentionRows = movementRows
        .filter(item => item.classification !== "Normal")
        .slice(0, 10);
      const counts = attentionRows.reduce((acc, item) => {
        acc[item.classification] = (acc[item.classification] || 0) + 1;
        return acc;
      }, {});
      const topAttention = attentionRows[0] || null;
      const summaryCards = [
        {
          label: "Movimentações atípicas",
          value: String(attentionRows.length),
          sub: `${movementRows.length} combinações item/conta analisadas`
        },
        {
          label: "Entradas novas",
          value: String(counts["Entrada nova"] || 0),
          sub: "Sem base material no mês anterior/média"
        },
        {
          label: "Zeragens",
          value: String(counts["Zeragem"] || 0),
          sub: "Base anterior material sem realização atual"
        },
        {
          label: "Maior movimento",
          value: topAttention ? this._formatSignedMoney(Math.abs(topAttention.momDelta) >= Math.abs(topAttention.avgDelta) ? topAttention.momDelta : topAttention.avgDelta) : "-",
          sub: topAttention ? `${topAttention.classification} | ${topAttention.itemName}` : "Sem atipicidade material"
        }
      ];

      const generatedText = topAttention
        ? `No mês selecionado, foram identificadas ${attentionRows.length} movimentações atípicas em ${movementRows.length} combinações de item financeiro e conta contábil. A principal ocorrência é ${topAttention.classification.toLowerCase()} em ${topAttention.itemName} / ${topAttention.accountName}, com realizado de ${this._formatSignedMoney(topAttention.currentValue)}, variação MoM de ${this._formatSignedMoney(topAttention.momDelta)} e diferença contra a média YTD anterior de ${this._formatSignedMoney(topAttention.avgDelta)}. Recomenda-se ${topAttention.action}`
        : `No mês selecionado, não foram identificadas movimentações atípicas materiais entre as ${movementRows.length} combinações item/conta analisadas. Recomenda-se manter o monitoramento das maiores bases e revisar o limiar de materialidade caso o volume analisado seja baixo.`;

      return {
        summaryCards,
        movementRows: movementRows.slice(0, 50),
        attentionRows,
        generatedText
      };
    }

    _classifyOperationalMovement(currentValue, previousValue, averageValue, materialityFloor) {
      const absCurrent = Math.abs(currentValue);
      const absPrevious = Math.abs(previousValue);
      const absAverage = Math.abs(averageValue);
      const nearZero = materialityFloor * 0.25;
      if (absCurrent >= materialityFloor && absPrevious >= materialityFloor && Math.sign(currentValue) !== Math.sign(previousValue)) return "Reversão";
      if (absCurrent >= materialityFloor && absPrevious < nearZero && absAverage < nearZero) return "Entrada nova";
      if (absCurrent < nearZero && (absPrevious >= materialityFloor || absAverage >= materialityFloor)) return "Zeragem";
      if (absAverage >= materialityFloor) {
        const avgRatio = (absCurrent - absAverage) / absAverage;
        if (avgRatio >= 0.75 && absCurrent - absAverage >= materialityFloor) return "Pico vs média";
        if (avgRatio <= -0.60 && absAverage - absCurrent >= materialityFloor) return "Queda brusca";
      }
      if (absPrevious >= materialityFloor) {
        const momRatio = (absCurrent - absPrevious) / absPrevious;
        if (momRatio >= 1.00 && absCurrent - absPrevious >= materialityFloor) return "Pico vs média";
        if (momRatio <= -0.75 && absPrevious - absCurrent >= materialityFloor) return "Queda brusca";
      }
      return "Normal";
    }

    _getOperationalMovementAction(classification) {
      switch (classification) {
        case "Entrada nova":
          return "validar origem da despesa, centro responsável e recorrência esperada para os próximos meses.";
        case "Zeragem":
          return "confirmar se houve encerramento real da despesa, postergação de lançamento ou reclassificação contábil.";
        case "Pico vs média":
          return "verificar competência, evento não recorrente e necessidade de ajustar premissas do forecast.";
        case "Queda brusca":
          return "avaliar se a redução é estrutural, sazonal ou apenas postergação de despesa.";
        case "Reversão":
          return "validar sinal contábil, estornos, reclassificações e consistência da natureza financeira.";
        default:
          return "manter monitoramento no próximo fechamento.";
      }
    }

    _formatSignedMoney(value) {
      const sign = value > 0 ? "+" : (value < 0 ? "-" : "");
      return `${sign}R$ ${Math.abs(value / 1000000).toFixed(2)}M`;
    }

    _movementClassName(classification) {
      return String(classification || "Normal")
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    }

    _renderOperationalView(context) {
      if (!this._operationalView) return;
      const analysis = this._buildOperationalMovementAnalysis(context);
      if (this._operationalSummaryCards) {
        this._operationalSummaryCards.textContent = "";
        const cardFragment = document.createDocumentFragment();
        analysis.summaryCards.forEach(card => {
          const cardEl = document.createElement("div");
          cardEl.className = "operational-kpi";
          const label = document.createElement("div");
          label.className = "operational-kpi-label";
          label.textContent = card.label;
          const value = document.createElement("div");
          value.className = "operational-kpi-value";
          value.textContent = card.value;
          const sub = document.createElement("div");
          sub.className = "operational-kpi-sub";
          sub.textContent = card.sub;
          cardEl.appendChild(label);
          cardEl.appendChild(value);
          cardEl.appendChild(sub);
          cardFragment.appendChild(cardEl);
        });
        this._operationalSummaryCards.appendChild(cardFragment);
      }

      if (this._operationalTableWrap) {
        if (!analysis.movementRows.length) {
          this._operationalTableWrap.innerHTML = `<div class="operational-empty">Sem movimentações suficientes para análise operacional.</div>`;
        } else {
          const rowsHtml = analysis.movementRows.map(row => `
            <tr>
              <td><span class="movement-tag ${this._movementClassName(row.classification)}">${this._escapeHtml(row.classification)}</span></td>
              <td>${this._escapeHtml(row.itemName)}</td>
              <td>${this._escapeHtml(row.accountName)}</td>
              <td class="num">${this._escapeHtml(this._formatSignedMoney(row.currentValue))}</td>
              <td class="num">${this._escapeHtml(this._formatSignedMoney(row.previousValue))}</td>
              <td class="num">${this._escapeHtml(this._formatSignedMoney(row.averageValue))}</td>
              <td class="num">${this._escapeHtml(this._formatSignedMoney(row.momDelta))}</td>
              <td class="num">${this._escapeHtml(this._formatSignedMoney(row.avgDelta))}</td>
            </tr>
          `).join("");
          this._operationalTableWrap.innerHTML = `
            <table class="operational-table">
              <thead>
                <tr>
                  <th>Classificação</th>
                  <th>Item Financeiro</th>
                  <th>Conta Contábil</th>
                  <th>Atual</th>
                  <th>Mês Ant.</th>
                  <th>Média YTD Ant.</th>
                  <th>Δ MoM</th>
                  <th>Δ Média</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          `;
        }
      }

      if (this._operationalAttentionWrap) {
        this._operationalAttentionWrap.textContent = "";
        const attentionFragment = document.createDocumentFragment();
        if (!analysis.attentionRows.length) {
          const empty = document.createElement("div");
          empty.className = "operational-attention-row";
          empty.textContent = "Sem movimentações atípicas materiais para o período selecionado.";
          attentionFragment.appendChild(empty);
        } else {
          analysis.attentionRows.slice(0, 6).forEach(row => {
            const item = document.createElement("div");
            item.className = "operational-attention-row";
            const strong = document.createElement("strong");
            strong.textContent = `${row.classification}: `;
            item.appendChild(strong);
            item.appendChild(document.createTextNode(`${row.itemName} / ${row.accountName}. Atual ${this._formatSignedMoney(row.currentValue)}, MoM ${this._formatSignedMoney(row.momDelta)}. Ação: ${row.action}`));
            attentionFragment.appendChild(item);
          });
        }
        this._operationalAttentionWrap.appendChild(attentionFragment);
      }

      if (this._operationalGeneratedText) {
        this._operationalGeneratedText.textContent = analysis.generatedText;
      }
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
        }
      });

      if (!tempoDimId) tempoDimId = dimKeys[0];
      if (!versaoDimId) versaoDimId = dimKeys[1] || null;

      const extraDimIds = dimKeys.filter(key => key !== tempoDimId && key !== versaoDimId);
      if (!itemFinanceiroDimId) itemFinanceiroDimId = extraDimIds[0] || null;
      if (!contaContabilDimId) contaContabilDimId = extraDimIds[1] || null;

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

          this._periodSummaryBanner.appendChild(document.createTextNode(isYtdSaving ? "com saving de " : "com desvio de "));
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

      const textContext = {
        currentBarNode,
        fullSeriesById: fullSeriesData._byIdMap,
        actualVal,
        budgetVal,
        diffNominal,
        diffPercent,
        consumptionMonthPercent,
        diffYtdNominal,
        diffYtdPercent,
        consumoBudgetPercent,
        totalRealizadoYTDAtual,
        totalRealizadoYTDAntigo,
        totalBudgetYTDCompleto,
        analysis
      };
      const narrativeEvents = this._eventBuilder.buildNarrativeEvents(textContext, analysis, analysis.outlierTable, analysis.varianceTable);
      const semanticEvents = this._semanticInterpreter.interpret(narrativeEvents, textContext);
      textContext.narrativeEvents = this._narrativePrioritizer.prioritize(semanticEvents, textContext);

      this._textGenerator.buildHighlightList(analysis.outlierTable, textContext).forEach(row => {
        const liItem = document.createElement("li");
        const label = document.createElement("strong");
        label.textContent = `${row.title}: `;
        liItem.appendChild(label);
        liItem.appendChild(document.createTextNode(row.text));
        this._hlSummaryUl.appendChild(liItem);
      });

      if (this._highlightToggleBtn) {
        this._setStyle(this._highlightToggleBtn, "display", analysis.outlierTable.length > 0 ? "inline-flex" : "none");
      }

      this._lastAnalyticsViewContext = textContext;
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
