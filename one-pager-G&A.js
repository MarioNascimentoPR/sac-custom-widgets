// One Pager - table summary with base period selector (MTD/YTD/YTD PY)
(function () {
  const WIDGET_VERSION = "1.9.72";
  const ACCOUNT_MEASURE_PROPERTY = "accountMeasureMap";
  const SHOW_TOTAL_PROPERTY = "showTotal";
  const DELTA_ABS_DECIMALS_PROPERTY = "deltaAbsDecimals";
  const DELTA_PCT_DECIMALS_PROPERTY = "deltaPctDecimals";
  const SCENARIO_CONFIG_PROPERTY = "scenarioConfig";
  const TYPOGRAPHY_CONFIG_PROPERTY = "typographyConfig";
  const WIDGET_TITLE_PROPERTY = "widgetTitle";
  const FOOTER_NOTES_PROPERTY = "footerNotes";
  const INDICATOR_HEADER_PROPERTY = "indicatorHeaderLabel";
  const VIEW_CONFIG_PROPERTY = "viewConfig";
  const ITR_DIMENSION_CONFIG_PROPERTY = "itrDimensionConfig";
  const BASE_PERIOD_CONFIG_PROPERTY = "basePeriodConfig";
  const FORMULA_AUDIT_REQUEST_PROPERTY = "formulaAuditRequest";
  const FORMULA_AUDIT_REQUEST_MAX_AGE_MS = 30000;
  const CALCULATED_INDICATORS_PROPERTY = "calculatedIndicators";
  const CALCULATED_INDICATORS_MIRROR_KEY = "__calculatedIndicators";
  const DISPLAY_SCALE_DIVISOR = {
    unit: 1,
    percent: 1,
    multiple: 1,
    thousand: 1000,
    million: 1000000,
    billion: 1000000000
  };
  const DEFAULT_MEASURE_TOKEN = "__DEFAULT__";
  const DEFAULT_SCENARIO_CONFIG = {
    scenarioAlias: "",
    actualMember: "",
    budgetMember: "",
    actualLabel: "Realizado",
    budgetLabel: "Orcado"
  };
  const DEFAULT_TYPOGRAPHY_CONFIG = {
    title: 20,
    header: 11,
    indicator: 14,
    value: 14,
    itrRowSpacing: 10
  };
  const DEFAULT_WIDGET_TITLE = "One Page Summary";
  const DEFAULT_INDICATOR_HEADER = "INDICATOR";
  const DEFAULT_VIEW_CONFIG = {
    mode: "standard",
    dimensionAlias: "",
    balanceDimensionAlias: "",
    rowDimensionAlias: "",
    rowDimensionAliases: [],
    itrDrilldownDimensionAlias: "",
    rowOrder: [],
    percentageComparisons: [
      { label: "Average 2026 vs Budget 2027", leftYear: 2026, leftVersion: "Average", rightYear: 2027, rightVersion: "Budget 2027" },
      { label: "Forecast 2026 vs Budget 2027", leftYear: 2026, leftVersion: "Forecast", rightYear: 2027, rightVersion: "Budget 2027" }
    ]
  };
  const DEFAULT_ITR_DIMENSION_CONFIG = {
    periodAlias: "",
    measureAlias: "",
    scenarioAlias: ""
  };
  const DEFAULT_BASE_PERIOD_CONFIG = {
    mode: "auto",
    periodKey: ""
  };
  const DEFAULT_DISPLAY_FORMAT = {
    itrDisplayLabel: "",
    itrDrilldownDimensionAlias: "",
    itrDrilldownExpanded: false,
    scale: "unit",
    decimals: 2,
    ytdMode: "default",
    weightMeasureToken: "",
    deltaPolarity: "lower_better",
    hidden: false,
    highlight: false,
    subordinate: false,
    subordinateFormula: { tokens: [] },
    subordinateLabel: "",
    subordinateMeasureToken: "",
    subordinateScale: "unit",
    subordinateDecimals: 2,
    subordinateYtdMode: "default",
    subordinateFormulaAggregation: "periodic",
    subordinates: []
  };
  const DEFAULT_CALCULATED_INDICATOR = {
    id: "",
    name: "Indicador calculado",
    displayMode: "independent",
    parentId: "",
    scale: "unit",
    decimals: 2,
    ytdMode: "default",
    formulaAggregation: "periodic",
    bpCalculationPeriod: "balance",
    deltaPolarity: "neutral",
    highlight: false,
    formula: { tokens: [] }
  };

  const PERIOD_HINTS = ["DATA", "DATE", "PERIODO", "PERIOD", "MES", "MONTH", "TIME", "CALMONTH", "FISCAL"];
  const SCENARIO_HINTS = ["VERSAO", "VERSION", "SCENARIO", "CENARIO", "CATEGORY", "PLAN"];
  const MEASURE_DIM_HINTS = ["@MEASUREDIMENSION", "MEASURE", "MEASURES", "MEDIDA", "MEDIDAS"];
  const ACTUAL_HINTS = ["ACTUAL", "REALIZADO", "REAL", "ACT"];
  const BUDGET_HINTS = ["BUDGET", "ORCADO", "ORCAMENTO", "PLAN", "PLANEJADO", "BGT"];

  const MONTH_NAMES = [
    "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
    "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"
  ];

  const MONTH_TOKEN_TO_NUMBER = {
    JAN: 1, JANEIRO: 1, JANUARY: 1,
    FEV: 2, FEVEREIRO: 2, FEB: 2, FEBRUARY: 2,
    MAR: 3, MARCO: 3, MARCH: 3,
    ABR: 4, ABRIL: 4, APR: 4, APRIL: 4,
    MAI: 5, MAIO: 5, MAY: 5,
    JUN: 6, JUNHO: 6, JUNE: 6,
    JUL: 7, JULHO: 7, JULY: 7,
    AGO: 8, AGOSTO: 8, AUG: 8, AUGUST: 8,
    SET: 9, SETEMBRO: 9, SEP: 9, SEPT: 9, SEPTEMBER: 9,
    OUT: 10, OUTUBRO: 10, OCT: 10, OCTOBER: 10,
    NOV: 11, NOVEMBRO: 11, NOVEMBER: 11,
    DEZ: 12, DEZEMBRO: 12, DEC: 12, DECEMBER: 12
  };
  const OnePagerCore = {
    toText(value) {
      if (value == null) return "";
      if (typeof value === "string") return value;
      if (typeof value === "object") {
        try {
          return JSON.stringify(value);
        } catch (error) {
          return "";
        }
      }
      return String(value);
    },

    parseJsonObject(value) {
      if (!value) return {};
      if (typeof value === "object") return value;
      const text = String(value).trim();
      if (!text) return {};
      try {
        const parsed = JSON.parse(text);
        return parsed && typeof parsed === "object" ? parsed : {};
      } catch (error) {
        return {};
      }
    },

    normalizeToken(value) {
      return String(value == null ? "" : value)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .trim();
    },

    tokenSet(values) {
      const set = new Set();
      (values || []).forEach(value => {
        const token = OnePagerCore.normalizeToken(value);
        if (token) set.add(token);
      });
      return set;
    },

    toBoolean(value) {
      if (value === true) return true;
      if (value === false) return false;
      const token = String(value == null ? "" : value).trim().toLowerCase();
      return token === "true" || token === "1" || token === "yes" || token === "sim";
    },

    bindingNumber(value, depth = 0) {
      if (depth > 4 || value == null || typeof value === "boolean") return null;
      if (typeof value === "number") return Number.isFinite(value) ? value : null;
      if (typeof value === "object") {
        // A supplied raw null is authoritative; presentation fields are never operands.
        if (Object.prototype.hasOwnProperty.call(value, "raw")) return OnePagerCore.bindingNumber(value.raw, depth + 1);
        if (Object.prototype.hasOwnProperty.call(value, "value")) return OnePagerCore.bindingNumber(value.value, depth + 1);
        return null;
      }
      if (typeof value !== "string") return null;
      const text = value.trim();
      if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)) return null;
      const numeric = Number(text);
      return Number.isFinite(numeric) ? numeric : null;
    },

    toNumber(value) {
      return OnePagerCore.bindingNumber(value);
    },

    periodWeight(year, month) {
      return new Date(Number(year), Number(month), 0).getDate();
    },

    normalizeAverageInput(value) {
      // Display precision must never alter the values used by averages.
      return value;
    },

    aggregateYtd(entries, mode) {
      if (!Array.isArray(entries) || !entries.length) return 0;
      const normalizedMode = String(mode || "default").trim().toLowerCase();

      let sum = 0;
      let weightedSum = 0;
      let weightedDivisor = 0;
      let count = 0;
      for (const entry of entries) {
        if (!entry || !Number.isFinite(entry.value)) continue;
        const weight = Number.isFinite(entry.weight) ? entry.weight : 1;
        count += 1;
        sum += entry.value;
        weightedSum += entry.value * weight;
        weightedDivisor += weight;
      }
      if (!count) return 0;

      if (normalizedMode === "simple_avg") {
        return sum / count;
      }
      if (normalizedMode === "weighted_avg") {
        return weightedDivisor ? (weightedSum / weightedDivisor) : (sum / count);
      }
      return sum;
    }
  };
  const OnePagerAccountLabels = {
    syncProperty: "accountCaptionSync",

    syncOnly(properties) {
      const keys = Object.keys(properties || {});
      return keys.length === 1 && keys[0] === this.syncProperty;
    },

    syncMessage(raw) {
      try {
        const value = JSON.parse(raw);
        return value && typeof value.nonce === "string" ? value : null;
      } catch (error) {
        return null;
      }
    },

    sources: new WeakMap(),
    contexts: new WeakMap(),
    documents: new WeakMap(),
    sharedCaptionLimit: 4096,
    memberQueue: [],
    memberActive: 0,

    invalidateContext(host) {
      this.contexts.delete(host);
    },

    captionHostActive(host) {
      if (host._renderSuspended) return false;
      if (typeof host._readViewConfig !== "function") return true;
      return ["overview_bp", "overview_bp_free"].includes(host._readViewConfig(host._props?.viewConfig, [], {}).mode);
    },

    captionLanguage(document) {
      return JSON.stringify([document?.documentElement?.lang || "", document?.defaultView?.navigator?.language || ""]);
    },

    captionContextCurrent(host, context) {
      return this.contexts.get(host) === context && this.sources.get(host) === context.cache
        && host.dataBindings === context.api && host.ownerDocument === context.document
        && this.captionLanguage(host.ownerDocument) === context.language;
    },

    captionConsumer(entry) {
      for (const [host, context] of entry.consumers) {
        if (this.captionHostActive(host) && this.captionContextCurrent(host, context)) return { host, context };
      }
      return null;
    },

    sharedCaptions(context) {
      const document = context.document;
      if (!context.modelId || !document || typeof document !== "object") return null;
      let cache = this.documents.get(document);
      if (!cache) {
        cache = new Map();
        this.documents.set(document, cache);
      }
      return cache;
    },

    enqueueMemberRead(run, valid) {
      return new Promise((resolve, reject) => {
        this.memberQueue.push({ run, valid, resolve, reject });
        this.drainMemberQueue();
      });
    },

    drainMemberQueue() {
      while (this.memberQueue.length) {
        if (!this.memberQueue[0].valid()) {
          this.memberQueue.shift().resolve(null);
          continue;
        }
        if (this.memberActive >= 2) return;
        const task = this.memberQueue.shift();
        this.memberActive++;
        Promise.resolve().then(() => task.valid() ? task.run() : null).then(task.resolve, task.reject).finally(() => {
          this.memberActive--;
          this.drainMemberQueue();
        });
      }
    },

    feedContext(host, binding) {
      const api = host.dataBindings;
      const document = host.ownerDocument, language = this.captionLanguage(document);
      const previous = this.contexts.get(host);
      if (previous && previous.api === api && previous.binding === binding && previous.metadata === binding?.metadata
        && previous.document === document && previous.language === language) return previous.promise;
      const context = { api, binding, metadata: binding?.metadata, document, language };
      this.contexts.set(host, context);
      context.promise = (async () => {
        try {
          const feed = await api.getDataBinding("financialData");
          const source = feed && typeof feed.getDataSource === "function" ? await feed.getDataSource() : null;
          if (!source || typeof source.getMember !== "function") return null;
          const info = typeof source.getInfo === "function" ? await source.getInfo() : null;
          if (this.contexts.get(host) !== context) return null;
          const modelId = this.text(info && info.modelId);
          const scope = modelId || source;
          let cache = this.sources.get(host);
          if (!cache || cache.scope !== scope || cache.document !== document || cache.language !== language) {
            cache = { scope, document, language, members: new Map() };
            this.sources.set(host, cache);
          }
          Object.assign(context, { source, modelId, cache });
          return context;
        } catch (error) {
          return null;
        }
      })();
      return context.promise;
    },

    async fromFeed(host, binding, accounts) {
      const missing = accounts.filter(account => !this.readable({ label: account.label }, [account.id, account.alias]));
      if (!missing.length || !this.captionHostActive(host)
        || !host.dataBindings || typeof host.dataBindings.getDataBinding !== "function") return new Map();
      try {
        const context = await this.feedContext(host, binding);
        if (!context || !this.captionHostActive(host) || !this.captionContextCurrent(host, context)) return new Map();
        const { modelId, cache } = context;
        const shared = this.sharedCaptions(context);
        const labels = new Map();
        // Only selected, unresolved feed members: never query facts or enumerate the model.
        const resolve = async account => {
          const id = this.text(account.id);
          const dimension = /^\[([^\]]+)\]/.exec(id)?.[1];
          if (!dimension) return;
          const key = JSON.stringify([modelId, context.language, dimension, id]);
          let entry = cache.members.get(id);
          if (!entry && shared) entry = shared.get(key);
          if (!entry) {
            entry = { label: "", consumers: new Map([[host, context]]) };
            // Share only names/pending reads in this document; never numeric results or anonymous models.
            if (shared && shared.size < this.sharedCaptionLimit) shared.set(key, entry);
            entry.promise = (async () => {
              let attempted = false, obsolete = false, issuer;
              try {
                const member = await this.enqueueMemberRead(() => {
                  issuer = this.captionConsumer(entry);
                  if (!issuer) return null;
                  attempted = true;
                  return issuer.context.source.getMember(dimension, id);
                }, () => !!this.captionConsumer(entry));
                const current = issuer && this.contexts.get(issuer.host);
                // A newer binding may have validated the same model while this read was in flight.
                obsolete = !!issuer && (!current || current.cache !== issuer.context.cache
                  || current.api !== issuer.context.api || !this.captionContextCurrent(issuer.host, current));
                if (obsolete) return;
                if (!member || (modelId && member.modelId && member.modelId !== modelId)) return;
                const expected = this.identity(id), actual = this.identity(member.id);
                if (actual.leaf !== expected.leaf || (actual.scope && actual.scope !== expected.scope)) return;
                if (member.dimensionId && member.dimensionId !== dimension) return;
                entry.label = this.readable(member, [id, account.alias, member.id]);
              } catch (error) {
                // An unavailable caption must not interrupt the data or invent a name.
              } finally {
                // Failures stay local to participants, so a new widget is not poisoned by another's failure.
                if (!entry.label && shared?.get(key) === entry) shared.delete(key);
                if (!attempted || obsolete) {
                  for (const consumer of entry.consumers.values()) {
                    if (consumer.cache.members.get(id) === entry) consumer.cache.members.delete(id);
                  }
                }
                entry.consumers = null;
              }
            })();
          }
          cache.members.set(id, entry);
          if (entry.consumers) entry.consumers.set(host, context);
          await entry.promise;
          if (entry.label && this.captionHostActive(host) && this.captionContextCurrent(host, context)) labels.set(id, entry.label);
        };
        // Table and panel share pending work; one queue also bounds disjoint overlapping batches.
        await Promise.all(missing.map(resolve));
        return labels;
      } catch (error) {
        return new Map();
      }
    },

    text(value) {
      return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
    },

    identity(value) {
      const id = this.text(value);
      const member = /^\[([^\]]+)\].*&\[((?:\]\]|[^\]])+)\]$/.exec(id);
      return { id: id.toUpperCase(), scope: member ? member[1].toUpperCase() : "",
        leaf: member ? member[2].replace(/\]\]/g, "]").toUpperCase() : id.toUpperCase() };
    },

    readable(entry, identities) {
      const keys = new Set(identities.flatMap(value => {
        const key = this.identity(value);
        return [key.id, key.leaf];
      }).filter(Boolean));
      return [entry.description, entry.label, entry.caption, entry.text, entry.name]
        .map(value => this.text(value))
        .find(value => value && !keys.has(value.toUpperCase())
          && !/^\[[^\]]+\](?:\.&?\[[^\]]+\])+$/.test(value)) || "";
    },

    label(alias, metadataEntry) {
      const entry = metadataEntry || {};
      return this.readable(entry, [alias, entry.id, entry.key, entry.memberId])
        || this.text(entry.description) || this.text(entry.label) || this.text(entry.id) || this.text(alias);
    },

    resolve(metadata, aliases, rows) {
      const main = metadata.mainStructureMembers || {};
      const exact = new Map(), scoped = new Map(), leaves = new Map(), wanted = new Map();
      const scopes = new Set();
      const addKey = (index, key, target) => {
        if (!key) return;
        index.set(key, index.has(key) && index.get(key) !== target ? null : target);
      };
      aliases.forEach(alias => {
        const entry = main[alias] || {};
        const id = this.text(entry.id) || alias;
        if (this.readable(entry, [alias, id])) return;
        const target = { alias, id, scope: this.identity(id).scope };
        wanted.set(alias, target);
        [alias, id].forEach(value => addKey(exact, this.identity(value).id, target));
        const key = this.identity(id);
        addKey(leaves, key.leaf, target);
        if (key.scope) {
          scopes.add(key.scope);
          addKey(scoped, key.scope + "\0" + key.leaf, target);
        }
      });
      if (!wanted.size) return new Map();

      const found = new Map();
      const offer = (entry, mapKey, scope, rank, accountSource) => {
        if (!entry || typeof entry !== "object") return;
        const identities = [entry.id, entry.key, entry.memberId, mapKey].map(value => this.text(value)).filter(Boolean);
        const matches = new Set();
        identities.forEach(value => {
          const key = this.identity(value);
          // Full IDs are authoritative. Bare member codes require the account dimension.
          const direct = exact.get(key.id);
          if (direct && (!scope || !direct.scope || scope === direct.scope || key.scope === direct.scope)) matches.add(direct);
          const memberScope = key.scope || scope;
          const target = memberScope ? scoped.get(memberScope + "\0" + key.leaf)
            : (accountSource ? leaves.get(key.leaf) : null);
          if (target) matches.add(target);
        });
        if (matches.size !== 1) return;
        const target = [...matches][0];
        const recordId = this.identity(entry.id || entry.memberId || entry.key);
        const targetId = this.identity(target.id);
        if (recordId.id && recordId.id !== targetId.id && recordId.id !== this.identity(target.alias).id
          && (recordId.leaf !== targetId.leaf || (recordId.scope && recordId.scope !== targetId.scope))) return;
        const label = this.readable(entry, [...identities, target.id, target.alias]);
        if (!label) return;
        const previous = found.get(target.alias);
        if (!previous || rank < previous.rank) found.set(target.alias, { label, rank, conflict: false });
        else if (rank === previous.rank && previous.label.toUpperCase() !== label.toUpperCase()) previous.conflict = true;
      };
      const containers = ["members", "memberInfos", "availableMembers", "values", "items", "children", "hierarchy", "nodes"];
      const visited = new WeakSet();
      const visit = (value, mapKey, scope, rank, accountSource, depth = 0) => {
        if (typeof value === "string" && mapKey) {
          offer({ description: value }, mapKey, scope, rank, accountSource);
          return;
        }
        if (!value || typeof value !== "object" || depth > 16 || visited.has(value)) return;
        visited.add(value);
        if (Array.isArray(value)) {
          value.forEach(item => visit(item, "", scope, rank, accountSource, depth + 1));
        } else if (["id", "key", "memberId", "description", "label", "caption", "text", "name"].some(key => Object.hasOwn(value, key))) {
          offer(value, mapKey, scope, rank, accountSource);
          containers.forEach(key => visit(value[key], "", scope, rank, accountSource, depth + 1));
        } else {
          Object.entries(value).forEach(([key, item]) => visit(item, key, scope, rank, accountSource, depth + 1));
        }
      };
      visit(main, "", "", 1, true);
      const dimensions = metadata.dimensions || {};
      const dimensionScope = alias => {
        const id = this.text((dimensions[alias] || {}).id) || alias;
        return (id.match(/^\[([^\]]+)\]/)?.[1] || id).toUpperCase();
      };
      Object.entries(dimensions).forEach(([alias, dimension]) => {
        const scope = dimensionScope(alias);
        if (!scopes.has(scope)) return;
        containers.forEach(key => visit(dimension[key], "", scope, 2, false));
      });
      if ([...wanted.keys()].some(alias => !found.has(alias))) {
        (rows || []).forEach(row => {
          Object.entries(row || {}).forEach(([alias, cell]) => {
            if (!cell || typeof cell !== "object" || Object.hasOwn(cell, "raw") || typeof cell.value === "number") return;
            const scope = wanted.get(alias)?.scope || dimensionScope(alias);
            offer(cell, "", scope, 3, wanted.has(alias));
          });
        });
      }
      return new Map([...found].filter(([, item]) => !item.conflict).map(([alias, item]) => [alias, item.label]));
    }
  };

  // Display names may change; persisted mode IDs must remain stable.
  const ONE_PAGER_PRESETS = [
    { value: "standard", group: "Mensal e acumulado", label: "Realizado x Orcado", previousLabel: "Padrao (atual)",
      description: "Contas nas linhas. Compare Realizado e Orcado no mes e no acumulado YTD." },
    { value: "dimension_columns", group: "Mensal e acumulado", label: "Colunas por dimensao", previousLabel: "Colunas por dimensao",
      description: "Contas nas linhas. Abra as colunas pela dimensao escolhida, de janeiro ate a Data Base." },
    { value: "overview", group: "Anos e versoes", label: "Anual por contas", previousLabel: "Overview",
      description: "Contas e indicadores calculados nas linhas. Colunas por ano e versao, incluindo os anos anteriores ate a Data Base." },
    { value: "overview_balancetes", group: "Anos e versoes", label: "Anual por dimensao", previousLabel: "Overview (Balancetes)",
      description: "Escolha uma dimensao para as linhas. Colunas por ano e versao, incluindo os anos anteriores ate a Data Base." },
    { value: "overview_2", group: "Anos e versoes", label: "Anual com drilldown", previousLabel: "Overview 2",
      description: "Empilhe ate 4 dimensoes nas linhas, com abertura por niveis. Colunas por ano e versao ate a Data Base." },
    { value: "overview_itr", group: "Trimestres (ITR)", label: "ITR por contas", previousLabel: "Overview ITR",
      description: "Contas e indicadores calculados nas linhas. Compare trimestres, o mesmo trimestre do ano anterior e os acumulados YTD." },
    { value: "overview_itr_d", group: "Trimestres (ITR)", label: "ITR com drilldown por conta", previousLabel: "Overview ITR (D)",
      description: "Mesmas colunas do ITR por contas, com abertura por dimensao abaixo de cada conta. Configure a dimensao dentro da conta." },
    { value: "overview_bp", group: "Balanco Patrimonial", label: "BP classificado", previousLabel: "Overview BP",
      description: "Saldos por Ativo, Passivo e PL, segregados em circulante e nao circulante quando aplicavel. Cinco fechamentos trimestrais com variacoes e totais dos grupos." },
    { value: "overview_bp_free", group: "Balanco Patrimonial", label: "BP livre", previousLabel: "Overview BP (Livre)",
      description: "Saldos acumulados sem classificacao ou totais de grupos. Contas e indicadores calculados na mesma lista, com formato de colunas configuravel." }
  ];

  const OnePagerAverageWeights = {
    fields(value) {
      return value && typeof value === "object" ? { weightConfig: this.normalize(value) } : {};
    },
    normalize(value) {
      const source = value && typeof value === "object" ? value : {};
      return {
        source: source.source === "account_measure" ? "account_measure" : "calendar",
        accountId: String(source.accountId || "").trim(),
        measureToken: String(source.measureToken || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim()
      };
    },
    custom(format) {
      return format?.ytdMode === "weighted_avg" && format?.weightConfig?.source === "account_measure";
    }
  };
  class OnePager extends HTMLElement {
    constructor() {
      super();
      this._root = this.attachShadow({ mode: "open" });
      this._binding = null;
      this._explicitBinding = null;
      this._props = {};
      this._selectedPeriodKey = "";
      this._periodSelectionIsLocal = false;
      this._itrLayout = "itr";
      this._selectedRowKeys = new Set();
      this._bpSearchTerm = "";
      this._highlightedRowKeys = new Set();
      this._overview2ExpandedKeys = new Set();
      this._overview2CollapsedKeys = new Set();
      this._defaultExpandedDrilldownKeys = new Set();
      this._contextMenu = { open: false, x: 0, y: 0 };
      this._auditOpen = false;
      this._formulaAuditOpen = false;
      this._formulaAuditData = null;
      this._formulaAuditContext = null;
      this._pendingFormulaAuditRequest = null;
      this._lastFormulaAuditRequestNonce = "";
      this._compiledFormulaCache = new Map();
      this._calculatedValueCache = new Map();
      this._docClickHandler = event => this._handleDocumentClick(event);
      this._docClickBound = false;
      this._pendingRender = null;
      this._updateInProgress = false;
      this._renderSuspended = false;
      this._isDataReadyForExport = false;
      this._lastModelState = "boot";
      this._lastModelMessage = "";
      this._lastRenderAt = 0;
      this._hasReceivedBindingRows = false;
      this._hasConfiguredBinding = false;
      this._hasHostUpdate = false;
      this._presetPreviewCheck = null;
      this._renderMessage("Aguardando dados do SAC...");
    }


    connectedCallback() {
      this._renderSuspended = false;
      if (!this._docClickBound && typeof document !== "undefined" && document && typeof document.addEventListener === "function") {
        document.addEventListener("click", this._docClickHandler);
        this._docClickBound = true;
      }
      this._requestRender();
    }


    disconnectedCallback() {
      this._presetPreviewCheck = null;
      this._renderSuspended = true;
      this._updateInProgress = false;
      this._pendingRender = null;
      this._localModelReady = false;
      this._isDataReadyForExport = false;
      if (this._docClickBound && typeof document !== "undefined" && document && typeof document.removeEventListener === "function") {
        document.removeEventListener("click", this._docClickHandler);
        this._docClickBound = false;
      }
    }


    onCustomWidgetBeforeUpdate(changedProperties) {
      if (this._isFooterNotesOnlyUpdate(changedProperties)) {
        this._props = { ...this._props, ...changedProperties };
        this._refreshFooterNotes();
        return;
      }
      if (OnePagerAccountLabels.syncOnly(changedProperties)) {
        this._props = { ...this._props, ...changedProperties };
        return;
      }
      this._updateInProgress = true;
      this._pendingRender = null;
      this._isDataReadyForExport = false;
      this._localModelReady = false;
      this._props = { ...this._props, ...(changedProperties || {}) };
      if (changedProperties && Object.prototype.hasOwnProperty.call(changedProperties, ACCOUNT_MEASURE_PROPERTY)) {
        this._overview2ExpandedKeys.clear();
        this._overview2CollapsedKeys.clear();
      }
      if (changedProperties && Object.prototype.hasOwnProperty.call(changedProperties, BASE_PERIOD_CONFIG_PROPERTY)) {
        this._selectedPeriodKey = "";
        this._periodSelectionIsLocal = false;
      }
      if (changedProperties && Object.prototype.hasOwnProperty.call(changedProperties, FORMULA_AUDIT_REQUEST_PROPERTY)) {
        this._queueFormulaAuditRequest(changedProperties[FORMULA_AUDIT_REQUEST_PROPERTY]);
      }
      if (changedProperties && Object.prototype.hasOwnProperty.call(changedProperties, "financialData")) {
        this._presetPreviewCheck = null;
        OnePagerAccountLabels.invalidateContext(this);
        this._explicitBinding = changedProperties.financialData;
        this._binding = changedProperties.financialData;
      }
    }


    onCustomWidgetAfterUpdate(changedProperties) {
      this._hasHostUpdate = true;
      if (this._isFooterNotesOnlyUpdate(changedProperties)) {
        this._props = { ...this._props, ...changedProperties };
        this._refreshFooterNotes();
        return;
      }
      if (OnePagerAccountLabels.syncOnly(changedProperties)) {
        this._props = { ...this._props, ...changedProperties };
        this._respondToAccountCaptionRequest();
        return;
      }
      this._updateInProgress = false;
      this._props = { ...this._props, ...(changedProperties || {}) };
      if (changedProperties && Object.prototype.hasOwnProperty.call(changedProperties, ACCOUNT_MEASURE_PROPERTY)) {
        this._overview2ExpandedKeys.clear();
        this._overview2CollapsedKeys.clear();
      }
      if (changedProperties && Object.prototype.hasOwnProperty.call(changedProperties, BASE_PERIOD_CONFIG_PROPERTY)) {
        this._selectedPeriodKey = "";
        this._periodSelectionIsLocal = false;
      }
      if (changedProperties && Object.prototype.hasOwnProperty.call(changedProperties, FORMULA_AUDIT_REQUEST_PROPERTY)) {
        this._queueFormulaAuditRequest(changedProperties[FORMULA_AUDIT_REQUEST_PROPERTY]);
      }
      if (changedProperties && Object.prototype.hasOwnProperty.call(changedProperties, "financialData")) {
        this._presetPreviewCheck = null;
        OnePagerAccountLabels.invalidateContext(this);
        this._explicitBinding = changedProperties.financialData;
        this._binding = changedProperties.financialData;
      } else if (this.financialData !== undefined) {
        this._binding = this.financialData;
      }
      this._requestRender();
    }


    set accountCaptionSync(value) {
      this._props[OnePagerAccountLabels.syncProperty] = value;
      this._respondToAccountCaptionRequest();
    }

    get accountCaptionSync() {
      return this._props[OnePagerAccountLabels.syncProperty] || "";
    }

    set financialData(value) {
      this._presetPreviewCheck = null;
      OnePagerAccountLabels.invalidateContext(this);
      this._explicitBinding = value;
      this._binding = value;
      this._requestRender();
    }


    get financialData() {
      return this._explicitBinding != null ? this._explicitBinding : this._binding;
    }


    set accountMeasureMap(value) {
      this._props[ACCOUNT_MEASURE_PROPERTY] = value;
      this._overview2ExpandedKeys.clear();
      this._overview2CollapsedKeys.clear();
      this._requestRender();
    }


    get accountMeasureMap() {
      return this._props[ACCOUNT_MEASURE_PROPERTY];
    }


    set showTotal(value) {
      this._props[SHOW_TOTAL_PROPERTY] = value;
      this._requestRender();
    }


    get showTotal() {
      return this._props[SHOW_TOTAL_PROPERTY];
    }


    set deltaAbsDecimals(value) {
      this._props[DELTA_ABS_DECIMALS_PROPERTY] = value;
      this._requestRender();
    }


    get deltaAbsDecimals() {
      return this._props[DELTA_ABS_DECIMALS_PROPERTY];
    }


    set deltaPctDecimals(value) {
      this._props[DELTA_PCT_DECIMALS_PROPERTY] = value;
      this._requestRender();
    }


    get deltaPctDecimals() {
      return this._props[DELTA_PCT_DECIMALS_PROPERTY];
    }


    set scenarioConfig(value) {
      this._props[SCENARIO_CONFIG_PROPERTY] = value;
      this._requestRender();
    }


    get scenarioConfig() {
      return this._props[SCENARIO_CONFIG_PROPERTY];
    }


    set typographyConfig(value) {
      this._props[TYPOGRAPHY_CONFIG_PROPERTY] = value;
      this._requestRender();
    }


    get typographyConfig() {
      return this._props[TYPOGRAPHY_CONFIG_PROPERTY];
    }


    set widgetTitle(value) {
      this._props[WIDGET_TITLE_PROPERTY] = value;
      this._requestRender();
    }


    get widgetTitle() {
      return this._props[WIDGET_TITLE_PROPERTY];
    }

    set footerNotes(value) {
      this._props[FOOTER_NOTES_PROPERTY] = this._normalizeFooterNotes(value);
      this._refreshFooterNotes();
    }

    get footerNotes() {
      return this._normalizeFooterNotes(this._props[FOOTER_NOTES_PROPERTY]);
    }


    set indicatorHeaderLabel(value) {
      this._props[INDICATOR_HEADER_PROPERTY] = value;
      this._requestRender();
    }


    get indicatorHeaderLabel() {
      return this._props[INDICATOR_HEADER_PROPERTY];
    }


    set viewConfig(value) {
      this._props[VIEW_CONFIG_PROPERTY] = value;
      this._requestRender();
    }


    get viewConfig() {
      return this._props[VIEW_CONFIG_PROPERTY];
    }


    set itrDimensionConfig(value) {
      this._props[ITR_DIMENSION_CONFIG_PROPERTY] = value;
      this._requestRender();
    }


    get itrDimensionConfig() {
      return this._props[ITR_DIMENSION_CONFIG_PROPERTY];
    }


    set basePeriodConfig(value) {
      this._props[BASE_PERIOD_CONFIG_PROPERTY] = value;
      this._selectedPeriodKey = "";
      this._periodSelectionIsLocal = false;
      this._requestRender();
    }


    get basePeriodConfig() {
      return this._props[BASE_PERIOD_CONFIG_PROPERTY];
    }


    set formulaAuditRequest(value) {
      this._props[FORMULA_AUDIT_REQUEST_PROPERTY] = value;
      this._queueFormulaAuditRequest(value);
      this._requestRender();
    }


    get formulaAuditRequest() {
      return this._props[FORMULA_AUDIT_REQUEST_PROPERTY];
    }


    set calculatedIndicators(value) {
      this._props[CALCULATED_INDICATORS_PROPERTY] = value;
      this._calculatedValueCache.clear();
      this._requestRender();
    }


    get calculatedIndicators() {
      return this._props[CALCULATED_INDICATORS_PROPERTY];
    }

  }
  const OnePagerLifecycleModule = {
    _isFooterNotesOnlyUpdate(changes) {
      return !!changes && Object.keys(changes).length === 1 && Object.hasOwn(changes, FOOTER_NOTES_PROPERTY);
    },

    _requestRender() {
      this._localModelReady = false;
      this._isDataReadyForExport = false;
      if (this._updateInProgress || this._renderSuspended || this._pendingRender) return;
      // Coalesce synchronous host calls, without a timer or frame delay.
      const request = {};
      this._pendingRender = request;
      Promise.resolve().then(() => {
        if (this._pendingRender !== request) return;
        this._pendingRender = null;
        this._render();
      });
    },

    _flushPendingRender() {
      if (this._pendingRender && !this._updateInProgress && !this._renderSuspended) this._render();
    },

    _renderVisual() {
      if (this._updateInProgress || this._renderSuspended) return;
      if (!this._localModelReady || !this._lastModel || this._lastModel.state !== "ok") {
        this._render();
        return;
      }
      const wrap = this._root.querySelector(".table-wrap");
      const scroll = wrap ? { top: wrap.scrollTop, left: wrap.scrollLeft } : null;
      this._renderTable(this._lastModel);
      const nextWrap = this._root.querySelector(".table-wrap");
      if (scroll && nextWrap) {
        nextWrap.scrollTop = scroll.top;
        nextWrap.scrollLeft = scroll.left;
      }
      this._notifyRenderComplete();
    },

    _refreshSelection() {
      if (!this._localModelReady) return this._renderVisual();
      const rows = this._root.querySelectorAll(".table-wrap tbody tr.data-row[data-row-key]");
      rows.forEach(row => {
        const key = row.getAttribute("data-row-key");
        const highlighted = this._highlightedRowKeys && this._highlightedRowKeys.has(key);
        row.classList.toggle("is-selected", !!highlighted || this._selectedRowKeys.has(key));
      });
      this._notifyRenderComplete();
    },

    _render() {
      if (this._updateInProgress || this._renderSuspended) return;
      this._pendingRender = null;
      this._localModelReady = false;
      const runtimeBinding = this._resolveRuntimeBinding();
      if (
        runtimeBinding &&
        (
          this._extractRows(runtimeBinding).length > 0 ||
          !this._binding ||
          runtimeBinding === this._binding
        )
      ) {
        this._binding = runtimeBinding;
      }

      this._respondToAccountCaptionRequest();
      const model = this._buildModel(this._binding);
      this._lastModel = model;
      this._lastModelState = model && model.state ? String(model.state) : "unknown";
      this._lastModelMessage = model && model.message ? String(model.message) : "";
      this._isDataReadyForExport = false;
      if (model.state === "ok" || model.state === "error") this._hasReceivedBindingRows = true;
      if (model.state === "empty" && this._shouldWaitForData(this._binding)) {
        // Resume only when SAC delivers an update, not by polling its binding API.
        const failed = ["error", "failed", "failure"].includes(String(this._binding?.state || "").trim().toLowerCase());
        if (!failed && this._showUnconfiguredPresetPreview()) return;
        else this._renderMessage(failed
          ? "Nao foi possivel receber dados do binding. Verifique a conexao e os feeds no Gerador do SAC."
          : this._hasReceivedBindingRows
            ? "Sem linhas no binding atual. Aguarde a atualizacao ou confira os filtros e os feeds no SAC."
            : "Aguardando dados do SAC. Confira os filtros e os feeds no Gerador se o resultado continuar vazio.");
        return;
      }

      if (model.state !== "ok") {
        this._renderMessage(model.message);
        this._notifyRenderComplete();
        return;
      }
      this._processPendingFormulaAudit(model);
      this._renderTable(model);
      this._localModelReady = true;
      this._isDataReadyForExport = true;
      this._notifyRenderComplete();
      this._resolveBalanceSheetLabels(model);
    },

    _resolveBalanceSheetLabels(model) {
      const view = model.overviewItrView;
      if (!view || !["overview_bp", "overview_bp_free"].includes(view.mode)) return;
      const accounts = view.rows.filter(row => !row.isCalculatedIndicator).map(row => ({ id: row.accountId, label: row.account }));
      this._bpLabelsPending = OnePagerAccountLabels.fromFeed(this, this._binding, accounts).then(labels => {
        if (this._lastModel !== model || !this._localModelReady || this._updateInProgress || this._renderSuspended) return;
        let changed = false;
        view.rows.forEach(row => {
          if (row.isCalculatedIndicator) return;
          const label = labels.get(row.accountId);
          if (!label || row.formatConfig.itrDisplayLabel || row.account === label) return;
          row.account = label;
          changed = true;
        });
        // Captions are presentation only; retain the already calculated balances and totals.
        if (changed) this._renderVisual();
      });
    },


    _resolveRuntimeBinding() {
      this._presetPreviewHandle = null;
      const directBinding = this.financialData !== undefined && this.financialData !== null ? this.financialData : null;
      const candidates = [];
      const pushCandidate = candidate => {
        if (!candidate) return;
        if (candidates.includes(candidate)) return;
        candidates.push(candidate);
      };

      // Prioriza o binding explicitamente entregue pelo ciclo de update/setter.
      pushCandidate(this._explicitBinding);
      pushCandidate(this._binding);
      pushCandidate(directBinding);

      const available = candidates.find(candidate => this._extractRows(candidate).length > 0);
      if (available) return available;

      const dataBindingsApi = this.dataBindings;
      if (dataBindingsApi) {
        if (dataBindingsApi.financialData) {
          this._presetPreviewHandle = dataBindingsApi.financialData;
          pushCandidate(dataBindingsApi.financialData);
        }
        const delivered = candidates.find(candidate => this._extractRows(candidate).length > 0);
        if (delivered) return delivered;
        try {
          if (typeof dataBindingsApi.getDataBinding === "function") {
            const byId = dataBindingsApi.getDataBinding("financialData");
            if (byId) this._presetPreviewHandle = byId;
            pushCandidate(byId);
            if (this._extractRows(byId).length > 0) return byId;
            const first = dataBindingsApi.getDataBinding();
            if (!this._presetPreviewHandle) this._presetPreviewHandle = first;
            pushCandidate(first);
          }
        } catch (error) {
          // Ignora erros de API e segue com os candidatos disponiveis.
        }
      }

      for (let index = 0; index < candidates.length; index += 1) {
        const candidate = candidates[index];
        if (this._extractRows(candidate).length > 0) return candidate;
      }
      return candidates.length ? candidates[0] : null;
    },


    _shouldWaitForData(binding) {
      if (!binding) return true;
      if (Array.isArray(binding) && !binding.length) return true;
      if (typeof binding !== "object") return false;
      const rowsCount = this._extractRows(binding).length;
      if (rowsCount > 0) return false;
      if (binding.state != null) {
        const stateToken = this._normalize(binding.state);
        if (stateToken && stateToken !== "success") return true;
        // Mesmo com estado "success", algumas paginas entregam binding parcial sem linhas.
        if (stateToken === "success" && rowsCount === 0) return true;
      }
      if (binding.metadata && binding.metadata.feeds) return true;
      return rowsCount === 0;
    },


    _notifyRenderComplete() {
      this._lastRenderAt = Date.now();
      try {
        this.dispatchEvent(new Event("customWidgetRenderComplete"));
      } catch (error) {
        // Nao interrompe o fluxo do widget caso o ambiente nao suporte o evento.
      }
    },

  };
  const OnePagerAccountLabelModule = {
    _respondToAccountCaptionRequest() {
      const key = OnePagerAccountLabels.syncProperty;
      const request = OnePagerAccountLabels.syncMessage(this._props[key]);
      if (!request || request.kind !== "request" || !Array.isArray(request.ids)
        || !Number.isFinite(request.at) || Math.abs(Date.now() - request.at) > 30000
        || this._renderSuspended || this._updateInProgress) return;
      if (!["overview_bp", "overview_bp_free"].includes(this._readViewConfig(this._props[VIEW_CONFIG_PROPERTY], [], {}).mode)) return;
      const binding = this._binding;
      const metadata = binding && binding.metadata;
      if (!metadata) return;
      const previous = this._accountCaptionJob;
      if (previous && previous.nonce === request.nonce && previous.binding === binding) return;
      const aliases = this._feedValues((metadata.feeds || {}).accounts);
      const selected = new Set(request.ids.filter(id => typeof id === "string"));
      const localLabels = OnePagerAccountLabels.resolve(metadata, aliases, this._extractRows(binding));
      const accounts = aliases.map(alias => {
        const member = this._buildAccountMember(alias, (metadata.mainStructureMembers || {})[alias], true);
        if (localLabels.has(alias)) member.label = localLabels.get(alias);
        return member;
      }).filter(member => selected.has(member.id));
      const job = { nonce: request.nonce, binding };
      this._accountCaptionJob = job;
      // Reuse the table's catalog cache; the styling component needs no data-source API.
      this._accountCaptionReplyPending = OnePagerAccountLabels.fromFeed(this, binding, accounts).then(found => {
        if (this._accountCaptionJob !== job || this._binding !== binding
          || this._renderSuspended || this._updateInProgress
          || OnePagerAccountLabels.syncMessage(this._props[key])?.nonce !== job.nonce
          || !["overview_bp", "overview_bp_free"].includes(this._readViewConfig(this._props[VIEW_CONFIG_PROPERTY], [], {}).mode)) {
          if (this._accountCaptionJob === job) this._accountCaptionJob = null;
          return;
        }
        const labels = accounts.flatMap(account => {
          const label = found.get(account.id) || OnePagerAccountLabels.readable(account, [account.id, account.alias]);
          return label ? [[account.id, label]] : [];
        });
        const raw = JSON.stringify({ kind: "response", nonce: request.nonce, labels });
        this._props[key] = raw;
        this.dispatchEvent(new CustomEvent("propertiesChanged", { detail: { properties: { [key]: raw } } }));
      });
    }
  };

  const OnePagerDataModule = {
    _buildModel(binding) {
      this._formulaAuditContext = null;
      const rows = this._extractRows(binding);
      if (!rows.length) {
        return {
          state: "empty",
          message: "One Pager conectado. Sem linhas no binding financialData."
        };
      }

      const metadata = binding && binding.metadata ? binding.metadata : {};
      const feeds = metadata.feeds || {};
      const dimensionsMeta = metadata.dimensions || {};
      const mainMembers = metadata.mainStructureMembers || {};

      const accountAliases = this._feedValues(feeds.accounts);
      const dimensionAliases = this._feedValues(feeds.dimensions);
      const measureAliases = this._feedValues(feeds.measures);
      const scenarioConfig = this._readScenarioConfig(this._props[SCENARIO_CONFIG_PROPERTY], dimensionAliases, dimensionsMeta);
      const viewConfig = this._readViewConfig(this._props[VIEW_CONFIG_PROPERTY], dimensionAliases, dimensionsMeta);
      const isBalanceFree = viewConfig.mode === "overview_bp_free";
      const isBalanceSheet = viewConfig.mode === "overview_bp" || viewConfig.mode === "overview_bp_free";
      const isItrMode = viewConfig.mode === "overview_itr" || viewConfig.mode === "overview_itr_d" || isBalanceSheet;
      const isOverviewBalancesMode = viewConfig.mode === "overview_balancetes";
      const itrDimensionConfig = this._readItrDimensionConfig(
        this._props[ITR_DIMENSION_CONFIG_PROPERTY],
        dimensionAliases,
        dimensionsMeta
      );
      const allowDimensionRows = viewConfig.mode === "overview_2" || isOverviewBalancesMode;

      if (!accountAliases.length && !allowDimensionRows) {
        return {
          state: "error",
          message: "One Pager conectado, mas o feed de Contas esta vazio."
        };
      }

      const accountLabels = isBalanceSheet
        ? OnePagerAccountLabels.resolve(metadata, accountAliases, rows) : new Map();
      const accountMembers = this._orderAccountMembersByRowOrder(
        accountAliases.map(alias => {
          const member = this._buildAccountMember(alias, mainMembers[alias], isBalanceSheet);
          if (accountLabels.has(alias)) member.label = accountLabels.get(alias);
          return member;
        }),
        viewConfig.rowOrder
      );
      const accountLookup = allowDimensionRows ? null : this._buildAccountLookup(accountMembers);
      const detectedPeriodAlias = this._detectPeriodAlias(rows, dimensionAliases, dimensionsMeta);
      const itrPeriodOverride = isItrMode ? itrDimensionConfig.periodAlias : "";
      const periodAlias = itrPeriodOverride || detectedPeriodAlias;
      const itrPeriodAlias = "";
      const scenarioAliasDetected = this._detectScenarioAlias(
        rows,
        dimensionAliases,
        dimensionsMeta,
        [periodAlias, itrPeriodAlias]
      );
      const configuredScenarioAlias = scenarioConfig.scenarioAlias === itrPeriodAlias
        ? ""
        : scenarioConfig.scenarioAlias;
      const itrScenarioOverride = isItrMode
        && itrDimensionConfig.scenarioAlias !== periodAlias
        ? itrDimensionConfig.scenarioAlias
        : "";
      const scenarioAlias = itrScenarioOverride
        || (isItrMode && configuredScenarioAlias === periodAlias ? "" : configuredScenarioAlias)
        || scenarioAliasDetected;
      const detectedMeasureDimAlias = this._detectMeasureDimensionAlias(
        rows,
        dimensionAliases,
        dimensionsMeta,
        [periodAlias, scenarioAlias, itrPeriodAlias]
      );
      const itrMeasureOverride = isItrMode
        && itrDimensionConfig.measureAlias !== periodAlias
        && itrDimensionConfig.measureAlias !== scenarioAlias
        ? itrDimensionConfig.measureAlias
        : "";
      const measureDimAlias = itrMeasureOverride || detectedMeasureDimAlias;
      const scenarioResolver = isBalanceSheet
        ? this._buildBalanceSheetScenarioResolver(rows, scenarioAlias, scenarioConfig)
        : this._buildScenarioResolver(rows, scenarioAlias, scenarioConfig);
      const accountMode = this._detectAccountMode(rows, accountAliases);
      const rules = this._parseAccountMeasureRules(this._props[ACCOUNT_MEASURE_PROPERTY], accountMembers);
      const standardWeights = this._createAverageWeightResolver({ rows, accountMembers, accountAliases, accountMode, periodAlias, dimensionAliases, measureAliases, measureDimAlias }, row => scenarioResolver.resolve(row));
      const scenarioWeights = scenario => (format, key) => standardWeights(format, key, scenario);
      const itrDrilldownRules = viewConfig.mode === "overview_itr_d"
        ? new Map(accountMembers.map(member => [member.id, this._resolveMeasureRuleForAccount(member, rules)]))
        : null;
      let calculatedCatalog = null;
      if (!allowDimensionRows && viewConfig.mode !== "overview_bp") {
        const accountMeasurePayload = this._parseJsonObject(this._props[ACCOUNT_MEASURE_PROPERTY]);
        calculatedCatalog = this._readCalculatedIndicatorCatalog(this._props[CALCULATED_INDICATORS_PROPERTY]);
        if (!calculatedCatalog.items.length && accountMeasurePayload[CALCULATED_INDICATORS_MIRROR_KEY]) {
          calculatedCatalog = this._readCalculatedIndicatorCatalog(
            accountMeasurePayload[CALCULATED_INDICATORS_MIRROR_KEY]
          );
        }
      }
      const formulaAccountIds = new Set();
      if (!allowDimensionRows && !isBalanceSheet && rules.byAccount instanceof Map) {
        rules.byAccount.forEach(rule => {
          const formulas = [];
          if (rule && rule.subordinateFormula) formulas.push(rule.subordinateFormula);
          if (rule && Array.isArray(rule.subordinates)) {
            rule.subordinates.forEach(config => {
              if (config && config.formula) formulas.push(config.formula);
            });
          }
          formulas.forEach(formula => {
            const normalizedFormula = this._normalizeFormula(formula);
            normalizedFormula.tokens.forEach(token => {
              if (!token || token.type !== "measure") return;
              const split = this._splitOperandValue(token.value);
              const accountKey = this._normalize(token.accountId || split.accountId || token.accountLabel || "");
              const resolvedAccountId = accountLookup.get(accountKey);
              if (resolvedAccountId) formulaAccountIds.add(resolvedAccountId);
            });
          });
        });
      }
      if (!allowDimensionRows && !isBalanceSheet) {
        this._collectCalculatedFormulaAccountIds(calculatedCatalog, accountLookup).forEach(accountId => {
          if (accountId) formulaAccountIds.add(accountId);
        });
      }
      const hasSubordinateFormulas = formulaAccountIds.size > 0;

      const periodMap = new Map();
      const cube = new Map();
      const formulaCube = hasSubordinateFormulas ? new Map() : null;
      if (!allowDimensionRows && !isBalanceFree) accountMembers.forEach(member => {
        const createAccountNode = () => ({
          id: member.id,
          label: member.label,
          tokens: member.tokens,
          periods: new Map()
        });
        cube.set(member.id, createAccountNode());
        if (formulaCube && formulaAccountIds.has(member.id)) formulaCube.set(member.id, createAccountNode());
      });

      const addValue = (accountMember, periodKey, role, measureToken, value) => {
        if (!accountMember || value == null) return;
        if (!cube.has(accountMember.id)) {
          cube.set(accountMember.id, {
            id: accountMember.id,
            label: accountMember.label || accountMember.id,
            tokens: accountMember.tokens || this._tokenSet([accountMember.id, accountMember.label]),
            periods: new Map()
          });
        }
        const accountNode = cube.get(accountMember.id);
        if (!accountNode.periods.has(periodKey)) {
          accountNode.periods.set(periodKey, this._createPeriodBucket());
        }
        const periodBucket = accountNode.periods.get(periodKey);
        const scenarioBucket = role === "budget" ? periodBucket.budget : periodBucket.actual;
        const tokenKey = measureToken || DEFAULT_MEASURE_TOKEN;

        scenarioBucket.total += value;
        scenarioBucket.byMeasure.set(tokenKey, (scenarioBucket.byMeasure.get(tokenKey) || 0) + value);
      };

      const addFormulaValue = (accountMember, periodKey, role, measureToken, value) => {
        if (!formulaCube || !accountMember || value == null) return;
        if (!formulaAccountIds.has(accountMember.id)) return;
        if (role !== "actual" && role !== "budget") return;
        if (!formulaCube.has(accountMember.id)) {
          formulaCube.set(accountMember.id, {
            id: accountMember.id,
            label: accountMember.label || accountMember.id,
            tokens: accountMember.tokens || this._tokenSet([accountMember.id, accountMember.label]),
            periods: new Map()
          });
        }
        const accountNode = formulaCube.get(accountMember.id);
        if (!accountNode.periods.has(periodKey)) {
          accountNode.periods.set(periodKey, this._createPeriodBucket());
        }
        const periodBucket = accountNode.periods.get(periodKey);
        const scenarioBucket = role === "budget" ? periodBucket.budget : periodBucket.actual;
        const tokenKey = measureToken || DEFAULT_MEASURE_TOKEN;
        scenarioBucket.total += value;
        scenarioBucket.byMeasure.set(tokenKey, (scenarioBucket.byMeasure.get(tokenKey) || 0) + value);
      };

      const periodByRow = allowDimensionRows ? new WeakMap() : null;
      rows.forEach(row => {
        const period = this._extractPeriodFromRow(row, periodAlias, dimensionAliases);
        if (periodByRow) periodByRow.set(row, period || null);
        if (!period) return;
        periodMap.set(period.key, period);
        // BP Livre reads raw balances/formula operands from the ITR matrix, not this legacy cube.
        if (allowDimensionRows || isBalanceFree) return;

        const scenarioRole = scenarioResolver.resolve(row);
        if (scenarioRole !== "actual" && scenarioRole !== "budget") return;
        const rowMeasureToken = this._extractMeasureToken(row, measureDimAlias);
        const rowMeasureTokenKey = rowMeasureToken || DEFAULT_MEASURE_TOKEN;

        if (accountMode === "rows") {
          const accountMember = this._resolveRowAccountMember(row, accountMembers, accountAliases);
          if (!accountMember) return;
          const accountRule = itrDrilldownRules
            ? itrDrilldownRules.get(accountMember.id)
            : this._resolveMeasureRuleForAccount(accountMember, rules);
          const requiredToken = accountRule.measureToken;
          const value = this._readRowNumericValue(row, measureAliases, dimensionAliases, accountAliases);
          if (formulaAccountIds.has(accountMember.id)) {
            addFormulaValue(accountMember, period.key, scenarioRole, rowMeasureTokenKey, value);
          }
          if (requiredToken && rowMeasureToken && requiredToken !== rowMeasureToken) return;
          addValue(accountMember, period.key, scenarioRole, rowMeasureTokenKey, value);
          return;
        }

        accountMembers.forEach(member => {
          const accountRule = itrDrilldownRules
            ? itrDrilldownRules.get(member.id)
            : this._resolveMeasureRuleForAccount(member, rules);
          const requiredToken = accountRule.measureToken;
          const value = this._toNumber(this._cellNumeric(row[member.alias]));
          if (formulaAccountIds.has(member.id)) {
            addFormulaValue(member, period.key, scenarioRole, rowMeasureTokenKey, value);
          }
          if (requiredToken && rowMeasureToken && requiredToken !== rowMeasureToken) return;
          addValue(member, period.key, scenarioRole, rowMeasureTokenKey, value);
        });
      });

      const metadataPeriods = this._collectPeriodsFromDimensionMeta((dimensionsMeta || {})[periodAlias]);
      metadataPeriods.forEach(period => {
        if (period && !periodMap.has(period.key)) periodMap.set(period.key, period);
      });

      const periods = this._expandPeriodRange(Array.from(periodMap.values()));
      if (!periods.length) {
        return {
          state: "error",
          message: "One Pager conectado, mas nao encontrou dimensao de periodo mensal no resultset."
        };
      }

      const selectedPeriod = this._resolveSelectedPeriod(periods);
      if (!selectedPeriod) {
        return {
          state: "error",
          message: "One Pager conectado, mas nao conseguiu selecionar um periodo base."
        };
      }
      this._selectedPeriodKey = selectedPeriod.key;

      const selectedYear = selectedPeriod.year;
      const selectedMonth = selectedPeriod.month;
      const previousYear = selectedYear - 1;
      const dimensionColumnsView = viewConfig.mode === "dimension_columns"
        ? this._buildDimensionColumnsView({
          rows,
          accountMembers,
          accountMode,
          accountAliases,
          rules,
          selectedPeriod,
          selectedYear,
          selectedMonth,
          periodAlias,
          itrPeriodAlias,
          scenarioAlias,
          scenarioResolver,
          measureAliases,
          dimensionAliases,
          dimensionsMeta,
          measureDimAlias,
          dimensionAlias: viewConfig.dimensionAlias
        })
        : null;
      const overviewView = viewConfig.mode === "overview"
        ? this._buildOverviewView({
          rows,
          accountMembers,
          accountMode,
          accountAliases,
          rules,
          selectedPeriod,
          selectedYear,
          selectedMonth,
          periodAlias,
          scenarioAlias,
          scenarioResolver,
          measureAliases,
          dimensionAliases,
          dimensionsMeta,
          measureDimAlias,
          cube,
          accountLookup,
          calculatedCatalog,
          rowOrder: viewConfig.rowOrder,
          percentageComparisons: viewConfig.percentageComparisons
        })
        : null;
      const overview2View = viewConfig.mode === "overview_2"
        ? this._buildOverviewDimensionRowsView({
          rows,
          accountMembers,
          accountMode,
          accountAliases,
          rules,
          selectedPeriod,
          selectedYear,
          selectedMonth,
          periodAlias,
          scenarioAlias,
          scenarioResolver,
          measureAliases,
          dimensionAliases,
          measureDimAlias,
          periodByRow,
          rowDimensionAlias: viewConfig.rowDimensionAlias,
          rowDimensionAliases: viewConfig.rowDimensionAliases
        })
        : null;
      const overviewBalancesView = viewConfig.mode === "overview_balancetes"
        ? (() => {
          const reservedAliases = new Set([periodAlias, scenarioAlias, measureDimAlias].filter(Boolean));
          const balanceDimensionAlias = reservedAliases.has(viewConfig.balanceDimensionAlias)
            ? ""
            : viewConfig.balanceDimensionAlias;
          const view = this._buildOverviewDimensionRowsView({
            rows,
            accountMembers,
            accountMode,
            accountAliases,
            rules,
            selectedPeriod,
            selectedYear,
            selectedMonth,
            periodAlias,
            scenarioAlias,
            scenarioResolver,
            measureAliases,
            dimensionAliases,
            measureDimAlias,
            periodByRow,
            rowDimensionAlias: balanceDimensionAlias,
            rowDimensionAliases: balanceDimensionAlias
              ? [balanceDimensionAlias]
              : []
          });
          return {
            ...view,
            mode: "overview_balancetes",
            message: view.state === "missing_dimension"
              ? "Selecione a dimensao das linhas no painel de estilizacao."
              : view.message,
            balanceDimensionAlias: balanceDimensionAlias || ""
          };
        })()
        : null;
      if (allowDimensionRows) {
        const dimensionRowsView = overviewBalancesView || overview2View;
        const auditRows = accountMembers.flatMap(member => {
          const formatConfig = this._normalizeDisplayFormat(this._resolveMeasureRuleForAccount(member, rules));
          if (formatConfig.hidden) return [];
          return [{
            accountId: member.id,
            rowKey: `${member.id}::main`,
            account: member.label,
            isSubordinateRow: false,
            formatConfig: { ...formatConfig, subordinate: false }
          }];
        });
        return {
          state: "ok",
          widgetVersion: WIDGET_VERSION,
          periods,
          selectedPeriod,
          selectedYear,
          previousYear,
          dimensionAliases,
          dimensionsMeta,
          rows: auditRows,
          totals: {},
          totalFormat: dimensionRowsView && dimensionRowsView.totalFormat
            ? dimensionRowsView.totalFormat
            : this._deriveTotalFormat(auditRows),
          scenarioAlias: scenarioAlias || "(nao identificado)",
          periodAlias: periodAlias || "(nao identificado)",
          itrPeriodAlias: "",
          measureAlias: measureDimAlias || "(nao identificado)",
          scenarioActualLabel: scenarioResolver.actualLabel || DEFAULT_SCENARIO_CONFIG.actualLabel,
          scenarioBudgetLabel: scenarioResolver.budgetLabel || DEFAULT_SCENARIO_CONFIG.budgetLabel,
          viewConfig,
          dimensionColumnsView: null,
          overviewView: null,
          overviewBalancesView,
          overview2View,
          overviewItrView: null,
          mappedAccounts: rules.entries.length,
          parseErrorOnRules: rules.parseError
        };
      }
      const overviewItrParams = {
          rows,
          accountMembers,
          accountMode,
          accountAliases,
          rules,
          selectedPeriod,
          selectedYear,
          selectedMonth,
          periodAlias,
          scenarioAlias,
          scenarioResolver,
          measureAliases,
          dimensionAliases,
          dimensionsMeta,
          measureDimAlias,
          cube,
          formulaCube: formulaCube || cube,
          accountLookup,
          calculatedCatalog,
          rowOrder: viewConfig.rowOrder
        };
      const getItrLayoutView = ["overview_itr", "overview_itr_d"].includes(viewConfig.mode)
        ? this._createItrLayoutViews(overviewItrParams, viewConfig) : null;
      const overviewItrView = getItrLayoutView ? getItrLayoutView(this._itrLayout) : isBalanceSheet
        ? this._buildOverviewItrView({
          ...overviewItrParams,
          bpOpeningPeriod: isBalanceSheet ? viewConfig.bpOpeningPeriod : "",
          bpColumnLayout: viewConfig.bpColumnLayout,
          bpUngrouped: viewConfig.mode === "overview_bp_free"
        })
        : null;

      if (isBalanceSheet) {
        return {
          state: "ok",
          widgetVersion: WIDGET_VERSION,
          periods, selectedPeriod, selectedYear, previousYear, dimensionAliases, dimensionsMeta,
          rows: overviewItrView.rows,
          totals: {},
          totalFormat: DEFAULT_DISPLAY_FORMAT,
          scenarioAlias: scenarioAlias || "(nao identificado)",
          periodAlias: periodAlias || "(nao identificado)",
          measureAlias: measureDimAlias || "(nao identificado)",
          scenarioActualLabel: scenarioResolver.actualLabel || DEFAULT_SCENARIO_CONFIG.actualLabel,
          viewConfig, overviewItrView,
          mappedAccounts: rules.entries.length,
          parseErrorOnRules: rules.parseError
        };
      }

      const standardFormulaAuditContext = {
        kind: "standard",
        resolveWeight: standardWeights,
        cube: formulaCube || cube,
        accountLookup,
        accountMembers,
        rules,
        selectedPeriod,
        selectedYear,
        selectedMonth,
        previousYear,
        actualLabel: scenarioResolver.actualLabel || DEFAULT_SCENARIO_CONFIG.actualLabel,
        budgetLabel: scenarioResolver.budgetLabel || DEFAULT_SCENARIO_CONFIG.budgetLabel
      };
      this._formulaAuditContext = viewConfig.mode === "overview" && overviewView && overviewView.auditContext
        ? overviewView.auditContext
        : (viewConfig.mode === "standard" ? standardFormulaAuditContext : null);

      const rowsOut = [];
      accountMembers.forEach(member => {
        const accountNode = cube.get(member.id) || {
          id: member.id,
          label: member.label,
          periods: new Map()
        };
        const rawFormatConfig = this._normalizeDisplayFormat(this._resolveMeasureRuleForAccount(accountNode, rules));
        if (rawFormatConfig.hidden) return;
        const parentFormatConfig = { ...rawFormatConfig, subordinate: false };

        const monthBucket = accountNode.periods.get(selectedPeriod.key) || this._createPeriodBucket();
        const monthActual = this._resolveScenarioDisplayValue(monthBucket.actual, rawFormatConfig);
        const monthBudget = this._resolveScenarioDisplayValue(monthBucket.budget, rawFormatConfig);
        const ytdCurrentActual = this._calculateYtdDisplayValue(accountNode.periods, selectedYear, selectedMonth, "actual", rawFormatConfig, scenarioWeights("actual"));
        const ytdCurrentBudget = this._calculateYtdDisplayValue(accountNode.periods, selectedYear, selectedMonth, "budget", rawFormatConfig, scenarioWeights("budget"));
        const ytdPreviousActual = this._calculateYtdDisplayValue(accountNode.periods, previousYear, selectedMonth, "actual", rawFormatConfig, scenarioWeights("actual"));

        let subordinateData = null;
        const subordinateEnabled = this._normalizeBoolean(rawFormatConfig.subordinate);
        const formula = rawFormatConfig.subordinateFormula;
        const formulaValidation = this._validateFormulaTokens(
          formula && formula.tokens
            ? formula.tokens
            : []
        );
        if (subordinateEnabled) {
          const formulaSourceCube = formulaCube || cube;
          const subordinateFormat = this._normalizeDisplayFormat({
            ...rawFormatConfig,
            measureToken: rawFormatConfig.subordinateMeasureToken || rawFormatConfig.measureToken || "",
            scale: rawFormatConfig.subordinateScale || rawFormatConfig.scale,
            decimals: rawFormatConfig.subordinateDecimals,
            ytdMode: rawFormatConfig.subordinateYtdMode || rawFormatConfig.ytdMode,
            weightConfig: rawFormatConfig.subordinateWeightConfig,
            formulaAggregation: rawFormatConfig.subordinateFormulaAggregation || DEFAULT_DISPLAY_FORMAT.subordinateFormulaAggregation,
            subordinateFormulaAggregation: rawFormatConfig.subordinateFormulaAggregation || DEFAULT_DISPLAY_FORMAT.subordinateFormulaAggregation,
            highlight: false,
            subordinate: false,
            subordinates: []
          });
          const subordinateLabel = subordinateFormat.subordinateLabel || this._formulaReadableLabel(formula, "Indicador subordinado");

          if (!formulaValidation.valid) {
            subordinateData = this._buildSubordinateDataWithError(
              subordinateLabel,
              subordinateFormat,
              this._createFormulaError("FORMULA_ERROR", formulaValidation.error || "Erro na formula")
            );
          } else {
            const subMonthActualResult = this._evaluateFormulaMonthValue(
              formulaSourceCube,
              accountLookup,
              formula,
              selectedYear,
              selectedMonth,
              "actual",
              subordinateFormat
            );
            const subMonthBudgetResult = this._evaluateFormulaMonthValue(
              formulaSourceCube,
              accountLookup,
              formula,
              selectedYear,
              selectedMonth,
              "budget",
              subordinateFormat
            );
            const useAggregatedOperands = subordinateFormat.subordinateFormulaAggregation === "aggregate_operands";
            const calculateSubordinateYtdFormula = (year, monthLimit, scenarioKey) => {
              if (useAggregatedOperands) {
                return this._calculateAggregatedFormulaValue(
                  formulaSourceCube,
                  accountLookup,
                  formula,
                  year,
                  monthLimit,
                  scenarioKey,
                  rules,
                  subordinateFormat,
                  scenarioWeights(scenarioKey)
                );
              }
              return this._calculateYtdFormulaValue(
                formulaSourceCube,
                accountLookup,
                formula,
                year,
                monthLimit,
                scenarioKey,
                subordinateFormat.ytdMode,
                subordinateFormat,
                scenarioWeights(scenarioKey)
              );
            };
            const subYtdActualResult = calculateSubordinateYtdFormula(selectedYear, selectedMonth, "actual");
            const subYtdBudgetResult = calculateSubordinateYtdFormula(selectedYear, selectedMonth, "budget");
            const subPreviousYtdResult = calculateSubordinateYtdFormula(previousYear, selectedMonth, "actual");

            subordinateData = this._composeSubordinateData(
              subordinateLabel,
              subordinateFormat,
              subMonthActualResult,
              subMonthBudgetResult,
              subYtdActualResult,
              subYtdBudgetResult,
              subPreviousYtdResult
            );
          }
        }

        rowsOut.push({
          accountId: member.id,
          rowKey: `${member.id}::main`,
          account: accountNode.label,
          isSubordinateRow: false,
          formatConfig: parentFormatConfig,
          monthActual,
          monthBudget,
          monthDeltaAbs: monthActual - monthBudget,
          monthDeltaPct: this._safePct(monthActual - monthBudget, monthBudget),
          ytdActual: ytdCurrentActual,
          ytdBudget: ytdCurrentBudget,
          ytdDeltaAbs: Number.isFinite(ytdCurrentActual) && Number.isFinite(ytdCurrentBudget) ? ytdCurrentActual - ytdCurrentBudget : null,
          ytdDeltaPct: Number.isFinite(ytdCurrentActual) && Number.isFinite(ytdCurrentBudget) ? this._safePct(ytdCurrentActual - ytdCurrentBudget, ytdCurrentBudget) : null,
          previousYtdActual: ytdPreviousActual,
          subordinate: subordinateData
        });
      });

      // Respeita a ordem original do feed de Contas no SAC.

      const totals = rowsOut.reduce((acc, row) => {
        acc.monthActual += row.monthActual;
        acc.monthBudget += row.monthBudget;
        acc.monthDeltaAbs += row.monthDeltaAbs;
        acc.ytdActual += row.ytdActual;
        acc.ytdBudget += row.ytdBudget;
        acc.ytdDeltaAbs += row.ytdDeltaAbs;
        acc.previousYtdActual += row.previousYtdActual;
        return acc;
      }, {
        monthActual: 0,
        monthBudget: 0,
        monthDeltaAbs: 0,
        ytdActual: 0,
        ytdBudget: 0,
        ytdDeltaAbs: 0,
        previousYtdActual: 0
      });
      for (const key of ["ytdActual", "ytdBudget", "ytdDeltaAbs", "previousYtdActual"]) {
        if (rowsOut.some(row => OnePagerAverageWeights.custom(row.formatConfig) && row[key] === null)) totals[key] = null;
      }
      totals.monthDeltaPct = this._safePct(totals.monthDeltaAbs, totals.monthBudget);
      totals.ytdDeltaPct = this._safePct(totals.ytdDeltaAbs, totals.ytdBudget);
      const totalFormat = this._deriveTotalFormat(rowsOut);

      return {
        state: "ok",
        widgetVersion: WIDGET_VERSION,
        periods,
        selectedPeriod,
        selectedYear,
        previousYear,
        dimensionAliases,
        dimensionsMeta,
        rows: rowsOut,
        totals,
        totalFormat,
        scenarioAlias: scenarioAlias || "(nao identificado)",
        periodAlias: periodAlias || "(nao identificado)",
        itrPeriodAlias: itrPeriodAlias || "",
        measureAlias: measureDimAlias || "(nao identificado)",
        scenarioActualLabel: scenarioResolver.actualLabel || DEFAULT_SCENARIO_CONFIG.actualLabel,
        scenarioBudgetLabel: scenarioResolver.budgetLabel || DEFAULT_SCENARIO_CONFIG.budgetLabel,
        viewConfig,
        dimensionColumnsView,
        overviewView,
        overviewBalancesView,
        overview2View,
        overviewItrView,
        ...(getItrLayoutView ? { _getItrLayoutView: getItrLayoutView } : {}),
        mappedAccounts: rules.entries.length,
        parseErrorOnRules: rules.parseError
      };
    },


    _extractRows(binding) {
      if (Array.isArray(binding)) return this._isRowArray(binding) ? binding : [];
      if (!binding || typeof binding !== "object") return [];
      if (this._isRowArray(binding.data)) return binding.data;
      if (this._isRowArray(binding.rows)) return binding.rows;
      if (this._isRowArray(binding.resultSet)) return binding.resultSet;
      if (this._isRowArray(binding.resultset)) return binding.resultset;
      if (this._isRowArray(binding.values)) return binding.values;

      const queue = [binding.data, binding.payload, binding.response, binding.binding];
      const visited = new Set();
      while (queue.length) {
        const current = queue.shift();
        if (!current || typeof current !== "object") continue;
        if (visited.has(current)) continue;
        visited.add(current);

        if (Array.isArray(current)) {
          if (this._isRowArray(current)) return current;
          continue;
        }

        if (this._isRowArray(current.data)) return current.data;
        if (this._isRowArray(current.rows)) return current.rows;
        if (this._isRowArray(current.resultSet)) return current.resultSet;
        if (this._isRowArray(current.resultset)) return current.resultset;
        if (this._isRowArray(current.values)) return current.values;

        Object.keys(current).slice(0, 24).forEach(key => {
          const value = current[key];
          if (value && typeof value === "object") queue.push(value);
        });
      }
      return [];
    },


    _isRowArray(value) {
      if (!Array.isArray(value)) return false;
      if (!value.length) return true;
      const first = value[0];
      return !!(first && typeof first === "object" && !Array.isArray(first));
    },


    _feedValues(feed) {
      return feed && Array.isArray(feed.values) ? feed.values.map(String) : [];
    },


    _accountMemberLabel(alias, metadataEntry) {
      return OnePagerAccountLabels.label(alias, metadataEntry);
    },


    _buildAccountMember(alias, metadataEntry, preferReadableLabel = false) {
      const entry = metadataEntry || {};
      const id = String(entry.id || alias);
      const label = preferReadableLabel
        ? this._accountMemberLabel(alias, entry)
        : String(entry.description || entry.label || entry.id || alias);
      return {
        alias: String(alias),
        id,
        label,
        tokens: this._tokenSet([alias, id, label, entry.description])
      };
    },


    _buildAccountLookup(accountMembers) {
      const out = new Map();
      (accountMembers || []).forEach(member => {
        const ownerId = String(member && member.id != null ? member.id : "");
        if (!ownerId) return;
        const candidates = [
          ownerId,
          member && member.label,
          member && member.alias,
          ...(member && member.tokens ? Array.from(member.tokens) : [])
        ];
        candidates.forEach(value => {
          const token = this._normalize(value);
          if (!token || out.has(token)) return;
          out.set(token, ownerId);
        });
      });
      return out;
    },


    _detectAccountMode(rows, accountAliases) {
      const sample = rows.slice(0, 300);
      let numericHits = 0;
      let memberHits = 0;

      sample.forEach(row => {
        accountAliases.forEach(alias => {
          const cell = row ? row[alias] : undefined;
          const numeric = this._toNumber(this._cellNumeric(cell));
          if (numeric != null) {
            numericHits += 1;
            return;
          }
          if (this._looksLikeMemberCell(cell)) memberHits += 1;
        });
      });

      if (numericHits > 0) return "columns";
      if (memberHits > 0) return "rows";
      return "columns";
    },


    _detectPeriodAlias(rows, dimensionAliases, dimensionsMeta) {
      const sample = rows.slice(0, 1000);
      let bestAlias = "";
      let bestScore = -1;

      dimensionAliases.forEach(alias => {
        const meta = dimensionsMeta[alias] || {};
        const metaText = this._normalize([alias, meta.id, meta.label, meta.description].filter(Boolean).join(" "));

        let nameScore = 0;
        PERIOD_HINTS.forEach(hint => {
          if (metaText.includes(hint)) nameScore += 20;
        });

        let parseHits = 0;
        let nonEmpty = 0;
        sample.forEach(row => {
          const parsed = this._parsePeriodFromCell(row ? row[alias] : null);
          const text = this._cellText(row ? row[alias] : null);
          if (text) nonEmpty += 1;
          if (parsed) parseHits += 1;
        });

        const parseScore = parseHits * 3 + (nonEmpty > 0 ? Math.round((parseHits / nonEmpty) * 40) : 0);
        const score = nameScore + parseScore;
        if (score > bestScore) {
          bestScore = score;
          bestAlias = alias;
        }
      });

      return bestScore > 0 ? bestAlias : "";
    },


    _detectScenarioAlias(rows, dimensionAliases, dimensionsMeta, excludedAliases) {
      const sample = rows.slice(0, 1000);
      const excluded = new Set(Array.isArray(excludedAliases) ? excludedAliases : [excludedAliases]);
      let bestAlias = "";
      let bestScore = -1;

      dimensionAliases.forEach(alias => {
        if (excluded.has(alias)) return;
        const meta = dimensionsMeta[alias] || {};
        const metaText = this._normalize([alias, meta.id, meta.label, meta.description].filter(Boolean).join(" "));

        let nameScore = 0;
        SCENARIO_HINTS.forEach(hint => {
          if (metaText.includes(hint)) nameScore += 20;
        });

        const values = new Set();
        let roleHits = 0;
        sample.forEach(row => {
          const value = this._cellLabel(row ? row[alias] : null) || this._cellText(row ? row[alias] : null);
          if (!value) return;
          values.add(this._normalize(value));
          const role = this._classifyScenario(value);
          if (role !== "unknown") roleHits += 1;
        });

        if (nameScore === 0 && roleHits === 0) return;
        const score = nameScore + Math.min(values.size, 25) + roleHits;
        if (score > bestScore) {
          bestScore = score;
          bestAlias = alias;
        }
      });

      return bestScore > 0 ? bestAlias : "";
    },


    _detectMeasureDimensionAlias(rows, dimensionAliases, dimensionsMeta, excludedAliases) {
      const excluded = new Set(excludedAliases || []);
      const sample = rows.slice(0, 1000);
      let bestAlias = "";
      let bestScore = -1;

      dimensionAliases.forEach(alias => {
        if (excluded.has(alias)) return;
        const meta = dimensionsMeta[alias] || {};
        const metaText = this._normalize([alias, meta.id, meta.label, meta.description].filter(Boolean).join(" "));
        let score = 0;

        MEASURE_DIM_HINTS.forEach(hint => {
          if (metaText.includes(hint)) score += 25;
        });

        const members = new Set();
        sample.forEach(row => {
          const value = this._cellId(row ? row[alias] : null) || this._cellLabel(row ? row[alias] : null);
          if (!value) return;
          members.add(this._normalize(value));
        });

        if (members.size > 1) score += Math.min(members.size, 20);
        if (score > bestScore) {
          bestScore = score;
          bestAlias = alias;
        }
      });

      return bestScore > 0 ? bestAlias : "";
    },


    _buildScenarioResolver(rows, scenarioAlias, scenarioConfigRaw) {
      const scenarioConfig = this._normalizeScenarioConfig(scenarioConfigRaw);
      const defaultActualLabel = scenarioConfig.actualLabel || DEFAULT_SCENARIO_CONFIG.actualLabel;
      const defaultBudgetLabel = scenarioConfig.budgetLabel || DEFAULT_SCENARIO_CONFIG.budgetLabel;
      if (!scenarioAlias) {
        return {
          resolve: () => "actual",
          actualLabel: defaultActualLabel,
          budgetLabel: defaultBudgetLabel
        };
      }

      const stats = new Map();
      rows.slice(0, 5000).forEach(row => {
        const cell = row ? row[scenarioAlias] : null;
        const raw = this._cellLabel(cell) || this._cellText(cell);
        if (!raw) return;
        const idToken = this._normalize(this._cellId(cell));
        const labelToken = this._normalize(this._cellLabel(cell));
        const textToken = this._normalize(this._cellText(cell));
        const key = idToken || labelToken || textToken;
        if (!key) return;
        if (!stats.has(key)) {
          stats.set(key, {
            key,
            idToken,
            labelToken,
            textToken,
            raw,
            count: 0,
            role: this._classifyScenario(raw)
          });
        }
        stats.get(key).count += 1;
      });

      const members = Array.from(stats.values()).sort((a, b) => b.count - a.count);
      let actual = members.find(item => item.role === "actual") || members[0] || null;
      let budget = members.find(item => item.role === "budget") || null;
      if (!budget && members.length > 1) {
        budget = members.find(item => item.key !== (actual ? actual.key : "")) || null;
      }

      const roleByKey = new Map();
      const applyRole = (token, role) => {
        const normalized = this._normalize(token);
        if (!normalized) return false;
        roleByKey.set(normalized, role);
        const matched = members.find(item =>
          item.key === normalized ||
          item.idToken === normalized ||
          item.labelToken === normalized ||
          item.textToken === normalized
        );
        if (!matched) return false;
        if (matched.key) roleByKey.set(matched.key, role);
        if (matched.idToken) roleByKey.set(matched.idToken, role);
        if (matched.labelToken) roleByKey.set(matched.labelToken, role);
        if (matched.textToken) roleByKey.set(matched.textToken, role);
        if (role === "actual") actual = matched;
        if (role === "budget") budget = matched;
        return true;
      };

      if (actual) {
        applyRole(actual.key, "actual");
      }
      if (budget) {
        applyRole(budget.key, "budget");
      }

      if (scenarioConfig.actualMember) applyRole(scenarioConfig.actualMember, "actual");
      if (scenarioConfig.budgetMember) applyRole(scenarioConfig.budgetMember, "budget");

      const resolvedActualLabel = scenarioConfig.actualLabel || (actual && actual.raw ? String(actual.raw).trim() : DEFAULT_SCENARIO_CONFIG.actualLabel);
      const resolvedBudgetLabel = scenarioConfig.budgetLabel || (budget && budget.raw ? String(budget.raw).trim() : DEFAULT_SCENARIO_CONFIG.budgetLabel);

      return {
        resolve: row => {
          const cell = row ? row[scenarioAlias] : null;
          const candidates = [
            this._normalize(this._cellId(cell)),
            this._normalize(this._cellLabel(cell)),
            this._normalize(this._cellText(cell))
          ].filter(Boolean);
          if (!candidates.length) return "unknown";
          for (const key of candidates) {
            if (roleByKey.has(key)) return roleByKey.get(key);
          }
          const raw = this._cellLabel(cell) || this._cellText(cell);
          const classified = this._classifyScenario(raw);
          if (classified !== "unknown") return classified;
          return "unknown";
        },
        actualLabel: resolvedActualLabel,
        budgetLabel: resolvedBudgetLabel
      };
    },


    _classifyScenario(value) {
      const text = this._normalize(value);
      if (!text) return "unknown";
      if (BUDGET_HINTS.some(item => text.includes(item))) return "budget";
      if (ACTUAL_HINTS.some(item => text.includes(item))) return "actual";
      return "unknown";
    },


    _extractPeriodFromRow(row, preferredAlias, dimensionAliases) {
      if (preferredAlias) {
        const parsed = this._parsePeriodFromCell(row ? row[preferredAlias] : null);
        if (parsed) return parsed;
      }

      for (const alias of dimensionAliases || []) {
        if (alias === preferredAlias) continue;
        const parsed = this._parsePeriodFromCell(row ? row[alias] : null);
        if (parsed) return parsed;
      }
      return null;
    },


    _parsePeriodFromCell(cell) {
      const texts = this._cellCandidates(cell);
      for (const original of texts) {
        const raw = String(original || "").trim();
        if (!raw) continue;
        const normalized = this._normalize(raw);

        // 202604
        let match = normalized.match(/(?:^|[^0-9])((?:19|20)[0-9]{2})(0[1-9]|1[0-2])(?:[^0-9]|$)/);
        if (match) {
          const year = Number(match[1]);
          const month = Number(match[2]);
          return this._buildPeriod(year, month);
        }

        // 2026-04 / 2026.04 / 2026/04
        match = normalized.match(/(?:^|[^0-9])((?:19|20)[0-9]{2})[-/. ](0?[1-9]|1[0-2])(?:[^0-9]|$)/);
        if (match) {
          const year = Number(match[1]);
          const month = Number(match[2]);
          return this._buildPeriod(year, month);
        }

        // 04-2026
        match = normalized.match(/(?:^|[^0-9])(0?[1-9]|1[0-2])[-/. ]((?:19|20)[0-9]{2})(?:[^0-9]|$)/);
        if (match) {
          const month = Number(match[1]);
          const year = Number(match[2]);
          return this._buildPeriod(year, month);
        }

        // 20260430
        match = normalized.match(/(?:^|[^0-9])((?:19|20)[0-9]{2})(0[1-9]|1[0-2])[0-3][0-9](?:[^0-9]|$)/);
        if (match) {
          const year = Number(match[1]);
          const month = Number(match[2]);
          return this._buildPeriod(year, month);
        }

        // ABRIL 2026 / APR 2026
        const monthToken = Object.keys(MONTH_TOKEN_TO_NUMBER).find(token =>
          normalized.includes(token) && normalized.match(new RegExp(`(?:^|[^0-9])((?:19|20)[0-9]{2})(?:[^0-9]|$)`))
        );
        if (monthToken) {
          const yearMatch = normalized.match(/(?:^|[^0-9])((?:19|20)[0-9]{2})(?:[^0-9]|$)/);
          if (yearMatch) {
            const year = Number(yearMatch[1]);
            const month = MONTH_TOKEN_TO_NUMBER[monthToken];
            return this._buildPeriod(year, month);
          }
        }
      }
      return null;
    },


    _buildPeriod(year, month) {
      if (!Number.isInteger(year) || !Number.isInteger(month)) return null;
      if (month < 1 || month > 12) return null;
      const mm = String(month).padStart(2, "0");
      return {
        key: `${year}-${mm}`,
        year,
        month,
        label: `${MONTH_NAMES[month - 1]} ${year}`,
        sort: year * 100 + month
      };
    },


    _collectPeriodsFromDimensionMeta(meta) {
      const periods = [];
      const visited = new Set();
      const visit = value => {
        if (value == null) return;
        if (typeof value !== "object") {
          const period = this._parsePeriodFromCell(value);
          if (period) periods.push(period);
          return;
        }
        if (visited.has(value)) return;
        visited.add(value);

        const direct = this._parsePeriodFromCell(value);
        if (direct) periods.push(direct);

        if (Array.isArray(value)) {
          value.forEach(visit);
          return;
        }

        [
          "members",
          "memberInfos",
          "availableMembers",
          "values",
          "items",
          "children",
          "hierarchy",
          "nodes"
        ].forEach(key => {
          const child = value[key];
          if (Array.isArray(child)) child.forEach(visit);
          else if (child && typeof child === "object") Object.keys(child).forEach(itemKey => visit(child[itemKey]));
        });
      };
      visit(meta);
      return periods;
    },


    _expandPeriodRange(periods) {
      const unique = new Map();
      (periods || []).forEach(period => {
        if (period && period.key && !unique.has(period.key)) unique.set(period.key, period);
      });
      const values = Array.from(unique.values());
      if (!values.length) return [];

      const minSort = Math.min(...values.map(period => period.sort));
      const maxSort = Math.max(...values.map(period => period.sort));
      const minYear = Math.floor(minSort / 100);
      const minMonth = minSort % 100;
      const maxYear = Math.floor(maxSort / 100);
      const maxMonth = maxSort % 100;
      const monthCount = ((maxYear - minYear) * 12) + (maxMonth - minMonth) + 1;
      if (!Number.isFinite(monthCount) || monthCount < 1 || monthCount > 600) {
        return values.sort((a, b) => b.sort - a.sort);
      }

      for (let offset = 0; offset < monthCount; offset += 1) {
        const monthIndex = (minMonth - 1) + offset;
        const year = minYear + Math.floor(monthIndex / 12);
        const month = (monthIndex % 12) + 1;
        const period = this._buildPeriod(year, month);
        if (period && !unique.has(period.key)) unique.set(period.key, period);
      }

      return Array.from(unique.values()).sort((a, b) => b.sort - a.sort);
    },


    _resolveSelectedPeriod(periods) {
      if (!Array.isArray(periods) || !periods.length) return null;
      const byKey = new Map(periods.map(period => [period.key, period]));
      const basePeriodConfig = this._readBasePeriodConfig(this._props[BASE_PERIOD_CONFIG_PROPERTY]);
      if (this._periodSelectionIsLocal && this._selectedPeriodKey && byKey.has(this._selectedPeriodKey)) {
        return byKey.get(this._selectedPeriodKey);
      }
      if (basePeriodConfig.mode === "fixed" && byKey.has(basePeriodConfig.periodKey)) {
        return byKey.get(basePeriodConfig.periodKey);
      }
      if (this._selectedPeriodKey && byKey.has(this._selectedPeriodKey)) {
        return byKey.get(this._selectedPeriodKey);
      }

      const now = new Date();
      const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const preferred = this._buildPeriod(prevMonthDate.getFullYear(), prevMonthDate.getMonth() + 1);
      if (preferred && byKey.has(preferred.key)) return byKey.get(preferred.key);

      const preferredSort = preferred ? preferred.sort : Number.MAX_SAFE_INTEGER;
      const nearest = periods.find(period => period.sort <= preferredSort);
      if (nearest) return nearest;

      return periods[0];
    },


    _createScenarioBucket() {
      return {
        total: 0,
        byMeasure: new Map()
      };
    },


    _createPeriodBucket() {
      return {
        actual: this._createScenarioBucket(),
        budget: this._createScenarioBucket()
      };
    },


    _resolveScenarioDisplayValue(scenarioBucket, formatConfig) {
      if (!scenarioBucket) return 0;
      const measureToken = formatConfig && formatConfig.measureToken
        ? formatConfig.measureToken
        : DEFAULT_MEASURE_TOKEN;

      if (measureToken === DEFAULT_MEASURE_TOKEN) return scenarioBucket.total || 0;
      const byMeasure = scenarioBucket.byMeasure || new Map();
      if (byMeasure.has(measureToken)) return byMeasure.get(measureToken) || 0;
      if (byMeasure.has(DEFAULT_MEASURE_TOKEN)) return byMeasure.get(DEFAULT_MEASURE_TOKEN) || 0;
      return scenarioBucket.total || 0;
    },


    _calculateYtdDisplayValue(periodBuckets, year, monthLimit, scenarioKey, formatConfig, resolveWeight) {
      const values = new Map();

      for (let month = 1; month <= monthLimit; month += 1) {
        const key = `${year}-${String(month).padStart(2, "0")}`;
        const bucket = (periodBuckets || new Map()).get(key);
        if (!bucket) continue;

        const scenarioBucket = scenarioKey === "budget" ? bucket.budget : bucket.actual;
        const resolved = this._resolveScenarioDisplayValue(scenarioBucket, formatConfig);
        if (Number.isFinite(resolved)) values.set(key, resolved);
      }
      return this._aggregateMonthlyValues(values, formatConfig, resolveWeight);
    },


    _aggregateMonthlyValues(periodValues, formatConfig, resolveWeight) {
      const mode = (formatConfig && formatConfig.ytdMode) || "default";
      if (mode === "default") {
        let total = 0;
        if (periodValues) periodValues.forEach((value, key) => {
          if (Number.isFinite(value) && this._periodFromKey(key)) total += value;
        });
        return total;
      }
      const byYear = new Map();
      if (periodValues) periodValues.forEach((value, key) => {
        const period = this._periodFromKey(key);
        if (!period || !Number.isFinite(value)) return;
        if (!byYear.has(period.year)) byYear.set(period.year, new Map());
        byYear.get(period.year).set(period.month, value);
      });
      const entries = [];
      byYear.forEach((months, year) => {
        const limits = Array.from(months.keys());
        // Internal gaps remain zero; do not shrink the average to populated months.
        for (let month = Math.min(...limits); month <= Math.max(...limits); month += 1) {
          const key = String(year) + "-" + String(month).padStart(2, "0");
          entries.push(this._averageEntry(months.has(month) ? months.get(month) : 0, key, formatConfig, resolveWeight));
        }
      });
      return this._aggregateAverageEntries(entries, formatConfig);
    },


    _periodWeight(year, month) {
      return OnePagerCore.periodWeight(year, month);
    },


    _normalizeAverageInput(value, formatConfig) {
      return OnePagerCore.normalizeAverageInput(value, this._normalizeDecimals(formatConfig && formatConfig.decimals));
    },


    _periodFromKey(key) {
      const match = String(key || "").match(/^([0-9]{4})-([0-9]{2})$/);
      if (!match) return null;
      const year = Number(match[1]);
      const month = Number(match[2]);
      if (!year || !month) return null;
      return { year, month };
    },


    _safePct(numerator, denominator) {
      if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null;
      return (numerator / denominator) * 100;
    },


    _readScenarioConfig(rawValue, dimensionAliases, dimensionsMeta) {
      const parsed = this._parseJsonObject(rawValue);
      const normalized = this._normalizeScenarioConfig(parsed);
      const resolvedAlias = this._resolveDimensionAlias(
        normalized.scenarioAlias,
        dimensionAliases,
        dimensionsMeta
      );
      return {
        ...normalized,
        scenarioAlias: resolvedAlias
      };
    },


    _normalizeScenarioConfig(value) {
      const source = value && typeof value === "object" ? value : {};
      const scenarioAliasRaw = source.scenarioAlias != null
        ? source.scenarioAlias
        : (source.versionAlias != null ? source.versionAlias : source.aliasVersao);
      const actualMemberRaw = source.actualMember != null
        ? source.actualMember
        : (source.actualId != null
          ? source.actualId
          : (source.realizadoMember != null ? source.realizadoMember : source.realizado));
      const budgetMemberRaw = source.budgetMember != null
        ? source.budgetMember
        : (source.budgetId != null
          ? source.budgetId
          : (source.orcadoMember != null ? source.orcadoMember : source.orcado));
      const actualLabelRaw = source.actualLabel != null
        ? source.actualLabel
        : (source.realizadoLabel != null ? source.realizadoLabel : source.realizadoAlias);
      const budgetLabelRaw = source.budgetLabel != null
        ? source.budgetLabel
        : (source.orcadoLabel != null ? source.orcadoLabel : source.orcadoAlias);
      return {
        scenarioAlias: String(scenarioAliasRaw == null ? "" : scenarioAliasRaw).trim(),
        actualMember: this._normalize(actualMemberRaw || ""),
        budgetMember: this._normalize(budgetMemberRaw || ""),
        actualLabel: String(actualLabelRaw == null ? DEFAULT_SCENARIO_CONFIG.actualLabel : actualLabelRaw).trim() || DEFAULT_SCENARIO_CONFIG.actualLabel,
        budgetLabel: String(budgetLabelRaw == null ? DEFAULT_SCENARIO_CONFIG.budgetLabel : budgetLabelRaw).trim() || DEFAULT_SCENARIO_CONFIG.budgetLabel
      };
    },


    _readViewConfig(rawValue, dimensionAliases, dimensionsMeta) {
      const parsed = this._parseJsonObject(rawValue);
      const normalized = this._normalizeViewConfig(parsed);
      const resolvedAlias = this._resolveDimensionAlias(
        normalized.dimensionAlias,
        dimensionAliases,
        dimensionsMeta
      );
      const resolvedBalanceAlias = this._resolveDimensionAlias(
        normalized.balanceDimensionAlias,
        dimensionAliases,
        dimensionsMeta
      );
      const resolvedRowAlias = this._resolveDimensionAlias(
        normalized.rowDimensionAlias,
        dimensionAliases,
        dimensionsMeta
      );
      const resolvedItrDrilldownAlias = this._resolveDimensionAlias(
        normalized.itrDrilldownDimensionAlias,
        dimensionAliases,
        dimensionsMeta
      );
      const resolvedRowAliases = [];
      (normalized.rowDimensionAliases || []).forEach(alias => {
        const resolved = this._resolveDimensionAlias(alias, dimensionAliases, dimensionsMeta);
        if (resolved && !resolvedRowAliases.includes(resolved)) resolvedRowAliases.push(resolved);
      });
      if (resolvedRowAlias && !resolvedRowAliases.includes(resolvedRowAlias)) {
        resolvedRowAliases.unshift(resolvedRowAlias);
      }
      return {
        ...normalized,
        dimensionAlias: resolvedAlias,
        balanceDimensionAlias: resolvedBalanceAlias,
        rowDimensionAlias: resolvedRowAliases[0] || resolvedRowAlias,
        rowDimensionAliases: resolvedRowAliases.slice(0, 4),
        itrDrilldownDimensionAlias: resolvedItrDrilldownAlias
      };
    },


    _readItrDimensionConfig(rawValue, dimensionAliases, dimensionsMeta) {
      const parsed = this._parseJsonObject(rawValue);
      const normalized = this._normalizeItrDimensionConfig(parsed);
      return {
        periodAlias: this._resolveDimensionAlias(normalized.periodAlias, dimensionAliases, dimensionsMeta),
        measureAlias: this._resolveDimensionAlias(normalized.measureAlias, dimensionAliases, dimensionsMeta),
        scenarioAlias: this._resolveDimensionAlias(normalized.scenarioAlias, dimensionAliases, dimensionsMeta)
      };
    },


    _normalizeItrDimensionConfig(value) {
      const source = value && typeof value === "object" ? value : {};
      const periodAlias = source.periodAlias != null
        ? source.periodAlias
        : (source.dateAlias != null ? source.dateAlias : source.dataAlias);
      const measureAlias = source.measureAlias != null
        ? source.measureAlias
        : (source.measureDimensionAlias != null ? source.measureDimensionAlias : source.medidaAlias);
      const scenarioAlias = source.scenarioAlias != null
        ? source.scenarioAlias
        : (source.versionAlias != null ? source.versionAlias : source.versaoAlias);
      return {
        periodAlias: String(periodAlias == null ? DEFAULT_ITR_DIMENSION_CONFIG.periodAlias : periodAlias).trim(),
        measureAlias: String(measureAlias == null ? DEFAULT_ITR_DIMENSION_CONFIG.measureAlias : measureAlias).trim(),
        scenarioAlias: String(scenarioAlias == null ? DEFAULT_ITR_DIMENSION_CONFIG.scenarioAlias : scenarioAlias).trim()
      };
    },


    _readBasePeriodConfig(rawValue) {
      const parsed = this._parseJsonObject(rawValue);
      return this._normalizeBasePeriodConfig(parsed);
    },


    _normalizeBasePeriodConfig(value) {
      const source = value && typeof value === "object" ? value : {};
      const modeToken = this._normalize(source.mode != null ? source.mode : source.baseMode);
      const periodRaw = source.periodKey != null
        ? source.periodKey
        : (source.basePeriodKey != null ? source.basePeriodKey : source.dataBase);
      const periodKey = this._normalizePeriodKey(periodRaw);
      return {
        mode: modeToken === "FIXED" && periodKey ? "fixed" : DEFAULT_BASE_PERIOD_CONFIG.mode,
        periodKey
      };
    },


    _normalizePeriodKey(value) {
      const text = String(value == null ? "" : value).trim();
      if (!text) return "";
      const parsed = this._parsePeriodFromCell(text);
      if (parsed) return parsed.key;
      const itrPeriod = typeof this._parseItrPeriodFromCell === "function"
        ? this._parseItrPeriodFromCell(text)
        : null;
      if (!itrPeriod) return "";
      const cutoff = this._buildPeriod(itrPeriod.year, itrPeriod.cutoffMonth);
      return cutoff ? cutoff.key : "";
    },


    _normalizeViewConfig(value) {
      const source = value && typeof value === "object" ? value : {};
      const modeRaw = source.mode != null
        ? source.mode
        : (source.viewMode != null ? source.viewMode : source.layoutMode);
      const dimensionAliasRaw = source.dimensionAlias != null
        ? source.dimensionAlias
        : (source.columnsDimensionAlias != null
          ? source.columnsDimensionAlias
          : (source.dimensionColumnsAlias != null ? source.dimensionColumnsAlias : source.columnsByDimension));
      const balanceDimensionAliasRaw = source.balanceDimensionAlias != null
        ? source.balanceDimensionAlias
        : (source.balanceteDimensionAlias != null
          ? source.balanceteDimensionAlias
          : source.overviewBalanceDimensionAlias);
      const rowDimensionAliasRaw = source.rowDimensionAlias != null
        ? source.rowDimensionAlias
        : (source.rowsDimensionAlias != null
          ? source.rowsDimensionAlias
          : (source.overviewRowDimensionAlias != null ? source.overviewRowDimensionAlias : source.linesDimensionAlias));
      const rowDimensionAliasesRaw = source.rowDimensionAliases != null
        ? source.rowDimensionAliases
        : (source.rowsDimensionAliases != null
          ? source.rowsDimensionAliases
          : (source.drilldownDimensionAliases != null ? source.drilldownDimensionAliases : source.drilldownAliases));
      const itrDrilldownDimensionAliasRaw = source.itrDrilldownDimensionAlias != null
        ? source.itrDrilldownDimensionAlias
        : (source.overviewItrDrilldownDimensionAlias != null
          ? source.overviewItrDrilldownDimensionAlias
          : source.itrRowDimensionAlias);
      const rowDimensionAliasesSource = Array.isArray(rowDimensionAliasesRaw)
        ? rowDimensionAliasesRaw
        : (rowDimensionAliasesRaw && typeof rowDimensionAliasesRaw === "object"
          ? Object.keys(rowDimensionAliasesRaw)
            .sort((a, b) => Number(a) - Number(b))
            .map(key => rowDimensionAliasesRaw[key])
          : []);
      const rowDimensionAliases = [
        rowDimensionAliasRaw,
        ...rowDimensionAliasesSource,
        source.rowDimensionAlias2,
        source.rowDimensionAlias3,
        source.rowDimensionAlias4,
        source.drilldownLevel1,
        source.drilldownLevel2,
        source.drilldownLevel3,
        source.drilldownLevel4
      ]
        .map(item => String(item == null ? "" : item).trim())
        .filter(Boolean)
        .filter((item, index, list) => list.indexOf(item) === index)
        .slice(0, 4);
      const rowOrderSource = Array.isArray(source.rowOrder)
        ? source.rowOrder
        : (Array.isArray(source.indicatorOrder) ? source.indicatorOrder : []);
      const rowOrder = rowOrderSource
        .map(item => String(item == null ? "" : item).trim())
        .filter(Boolean)
        .filter((item, index, list) => list.indexOf(item) === index)
        .slice(0, 500);
      const comparisonSource = Array.isArray(source.percentageComparisons)
        ? source.percentageComparisons : DEFAULT_VIEW_CONFIG.percentageComparisons;
      const percentageComparisons = comparisonSource
        .filter(item => item && typeof item === "object")
        .map(item => ({
          label: String(item.label || "").trim(),
          leftYear: Number(item.leftYear),
          leftVersion: String(item.leftVersion || "").trim(),
          rightYear: Number(item.rightYear),
          rightVersion: String(item.rightVersion || "").trim()
        }))
        .filter(item => item.label && Number.isInteger(item.leftYear) && item.leftVersion
          && Number.isInteger(item.rightYear) && item.rightVersion)
        .slice(0, 20);
      const modeToken = this._normalize(modeRaw);
      let mode = "standard";
      if (modeToken === "OVERVIEW_BP" || modeToken === "OVERVIEW BP") mode = "overview_bp";
      if (modeToken === "OVERVIEW_BP_FREE" || modeToken === "OVERVIEW BP (LIVRE)") mode = "overview_bp_free";
      if (modeToken === "DIMENSION_COLUMNS" || modeToken === "COLUMNS_BY_DIMENSION") mode = "dimension_columns";
      if (modeToken === "OVERVIEW") mode = "overview";
      if (
        modeToken === "OVERVIEW_BALANCETES" ||
        modeToken === "OVERVIEW BALANCETES" ||
        modeToken === "OVERVIEW (BALANCETES)" ||
        modeToken === "OVERVIEWBALANCETES"
      ) mode = "overview_balancetes";
      if (modeToken === "OVERVIEW_2" || modeToken === "OVERVIEW2") mode = "overview_2";
      if (modeToken === "OVERVIEW_ITR" || modeToken === "OVERVIEW ITR" || modeToken === "OVERVIEWITR" || modeToken === "ITR") mode = "overview_itr";
      if (
        modeToken === "OVERVIEW_ITR_D" ||
        modeToken === "OVERVIEW ITR (D)" ||
        modeToken === "OVERVIEW ITR D" ||
        modeToken === "OVERVIEWITRD" ||
        modeToken === "ITR_D"
      ) mode = "overview_itr_d";
      return {
        mode,
        bpColumnLayout: source.bpColumnLayout === "last_5_itrs" ? "last_5_itrs" : "comparison",
        bpOpeningPeriod: /^(?:19|20)\d{2}-(?:0[1-9]|1[0-2])$/.test(source.bpOpeningPeriod || "")
          ? source.bpOpeningPeriod : "2024-12",
        bpDisplayScale: ["unit", "thousand", "million", "billion"].includes(source.bpDisplayScale)
          ? source.bpDisplayScale : "individual",
        bpDisplayDecimals: [0, 1, 2, 3, 4, "0", "1", "2", "3", "4"].includes(source.bpDisplayDecimals)
          ? String(source.bpDisplayDecimals) : "individual",
        bpDisplaySign: ["positive", "negative"].includes(source.bpDisplaySign) ? source.bpDisplaySign : "individual",
        dimensionAlias: String(dimensionAliasRaw == null ? "" : dimensionAliasRaw).trim(),
        balanceDimensionAlias: String(
          balanceDimensionAliasRaw == null ? "" : balanceDimensionAliasRaw
        ).trim(),
        rowDimensionAlias: rowDimensionAliases[0] || String(rowDimensionAliasRaw == null ? "" : rowDimensionAliasRaw).trim(),
        rowDimensionAliases,
        itrDrilldownDimensionAlias: String(
          itrDrilldownDimensionAliasRaw == null ? "" : itrDrilldownDimensionAliasRaw
        ).trim(),
        percentageComparisons,
        rowOrder
      };
    },


    _readTypographyConfig(rawValue) {
      const parsed = this._parseJsonObject(rawValue);
      return this._normalizeTypographyConfig(parsed);
    },


    _normalizeTypographyConfig(value) {
      const source = value && typeof value === "object" ? value : {};
      return {
        title: this._normalizeFontSize(
          source.title != null ? source.title : source.titleSize,
          DEFAULT_TYPOGRAPHY_CONFIG.title,
          12,
          48
        ),
        header: this._normalizeFontSize(
          source.header != null ? source.header : source.headerSize,
          DEFAULT_TYPOGRAPHY_CONFIG.header,
          9,
          28
        ),
        indicator: this._normalizeFontSize(
          source.indicator != null ? source.indicator : source.indicatorSize,
          DEFAULT_TYPOGRAPHY_CONFIG.indicator,
          10,
          32
        ),
        value: this._normalizeFontSize(
          source.value != null ? source.value : source.valueSize,
          DEFAULT_TYPOGRAPHY_CONFIG.value,
          10,
          32
        ),
        itrRowSpacing: this._normalizeFontSize(
          source.itrRowSpacing,
          DEFAULT_TYPOGRAPHY_CONFIG.itrRowSpacing,
          4,
          20
        )
      };
    },


    _normalizeFontSize(value, fallback, min, max) {
      const parsed = Number.parseInt(String(value == null ? "" : value), 10);
      if (!Number.isFinite(parsed)) return fallback;
      return Math.max(min, Math.min(max, parsed));
    },


    _readLabelProperty(rawValue, fallback, maxLength) {
      const text = String(rawValue == null ? "" : rawValue).trim();
      if (!text) return fallback;
      return text.slice(0, maxLength || 120);
    },


    _resolveDimensionAlias(value, dimensionAliases, dimensionsMeta) {
      const raw = String(value == null ? "" : value).trim();
      if (!raw) return "";
      if ((dimensionAliases || []).includes(raw)) return raw;
      const token = this._normalize(raw);
      for (const alias of dimensionAliases || []) {
        const meta = (dimensionsMeta || {})[alias] || {};
        const candidates = [
          alias,
          meta.id,
          meta.label,
          meta.description
        ];
        if (candidates.some(item => this._normalize(item) === token)) return alias;
      }
      return "";
    },


    _deriveTotalFormat(rows) {
      const items = (rows || []).map(row => this._normalizeDisplayFormat(row && row.formatConfig));
      if (!items.length) return { ...DEFAULT_DISPLAY_FORMAT };

      const first = items[0];
      const same = items.every(item => item.scale === first.scale && item.decimals === first.decimals);
      if (same) return first;
      return { ...DEFAULT_DISPLAY_FORMAT };
    },


    _buildOverviewView(params) {
      const input = params || {};
      const accountMembers = Array.isArray(input.accountMembers) ? input.accountMembers : [];
      const accountAliases = Array.isArray(input.accountAliases) ? input.accountAliases : [];
      const accountLookup = input.accountLookup || this._buildAccountLookup(accountMembers);
      const rows = Array.isArray(input.rows) ? input.rows : [];
      const rules = input.rules || { entries: [] };
      const selectedPeriod = input.selectedPeriod || null;
      const selectedYear = Number(input.selectedYear || 0);
      const selectedMonth = Number(input.selectedMonth || 0);
      const selectedSort = selectedYear * 100 + selectedMonth;
      const periodAlias = input.periodAlias || "";
      const scenarioAlias = input.scenarioAlias || "";
      const scenarioResolver = input.scenarioResolver || { actualLabel: DEFAULT_SCENARIO_CONFIG.actualLabel };
      const accountMode = input.accountMode || "rows";
      const measureAliases = Array.isArray(input.measureAliases) ? input.measureAliases : [];
      const dimensionAliases = Array.isArray(input.dimensionAliases) ? input.dimensionAliases : [];
      const measureDimAlias = input.measureDimAlias || "";
      const calculatedCatalog = input.calculatedCatalog || this._readCalculatedIndicatorCatalog("");
      if (!selectedPeriod || !selectedYear || !selectedMonth) {
        return {
          mode: "overview",
          state: "empty",
          message: "Periodo base invalido para gerar Overview.",
          columns: [],
          yearGroups: [],
          rows: [],
          totals: []
        };
      }

      const columnMap = new Map();
      const rowMatrix = new Map();
      const formulaCube = new Map();
      const columnPeriodKeys = new Map();
      const versionOrder = new Map();

      const resolveVersion = row => {
        if (!scenarioAlias) {
          return {
            key: "ACTUAL",
            label: String(scenarioResolver.actualLabel || DEFAULT_SCENARIO_CONFIG.actualLabel)
          };
        }
        const cell = row ? row[scenarioAlias] : null;
        const rawId = this._cellId(cell);
        const rawLabel = this._cellLabel(cell) || this._cellText(cell);
        const key = this._normalize(rawId || rawLabel);
        if (!key) return null;
        return {
          key,
          label: String(rawLabel || rawId || key).trim()
        };
      };

      const weights = this._createAverageWeightResolver(input, (row, period) => {
        const version = resolveVersion(row);
        return version ? String(period.year) + "::" + version.key : null;
      });
      const columnWeights = column => (format, key) => weights(format, key, column.key);
      const ensureColumn = (period, version) => {
        if (!period || !version || !version.key) return null;
        if (!versionOrder.has(version.key)) versionOrder.set(version.key, versionOrder.size);
        const key = `${period.year}::${version.key}`;
        if (!columnMap.has(key)) {
          columnMap.set(key, {
            key,
            year: period.year,
            versionKey: version.key,
            versionLabel: version.label,
            sort: period.year * 1000 + versionOrder.get(version.key)
          });
        }
        return key;
      };

      const addValue = (accountMember, columnKey, period, value) => {
        if (!accountMember || !columnKey || value == null) return;
        if (!rowMatrix.has(accountMember.id)) rowMatrix.set(accountMember.id, new Map());
        const accountMap = rowMatrix.get(accountMember.id);
        if (!accountMap.has(columnKey)) accountMap.set(columnKey, new Map());
        const periodMap = accountMap.get(columnKey);
        const periodKey = `${period.year}-${String(period.month).padStart(2, "0")}`;
        periodMap.set(periodKey, (periodMap.get(periodKey) || 0) + value);
      };

      const addFormulaValue = (accountMember, columnKey, period, measureToken, value) => {
        if (!accountMember || !columnKey || !period || value == null) return;
        if (!formulaCube.has(accountMember.id)) {
          formulaCube.set(accountMember.id, {
            id: accountMember.id,
            label: accountMember.label || accountMember.id,
            columns: new Map()
          });
        }
        if (!formulaCube.get(accountMember.id).columns.has(columnKey)) {
          formulaCube.get(accountMember.id).columns.set(columnKey, new Map());
        }
        const columnPeriods = formulaCube.get(accountMember.id).columns.get(columnKey);
        const periodKey = `${period.year}-${String(period.month).padStart(2, "0")}`;
        if (!columnPeriods.has(periodKey)) columnPeriods.set(periodKey, this._createScenarioBucket());
        const bucket = columnPeriods.get(periodKey);
        const tokenKey = measureToken || DEFAULT_MEASURE_TOKEN;
        bucket.total += value;
        bucket.byMeasure.set(tokenKey, (bucket.byMeasure.get(tokenKey) || 0) + value);
        if (!columnPeriodKeys.has(columnKey)) columnPeriodKeys.set(columnKey, new Set());
        columnPeriodKeys.get(columnKey).add(periodKey);
      };

      rows.forEach(row => {
        const period = this._extractPeriodFromRow(row, periodAlias, dimensionAliases);
        if (!period || period.sort > selectedSort) return;
        const version = resolveVersion(row);
        if (!version) return;
        const columnKey = ensureColumn(period, version);
        if (!columnKey) return;

        const rowMeasureToken = this._extractMeasureToken(row, measureDimAlias);
        if (accountMode === "rows") {
          const accountMember = this._resolveRowAccountMember(row, accountMembers, accountAliases);
          if (!accountMember) return;
          const accountRule = this._resolveMeasureRuleForAccount(accountMember, rules);
          const requiredToken = accountRule.measureToken;
          const value = this._readRowNumericValue(row, measureAliases, dimensionAliases, accountAliases);
          addFormulaValue(accountMember, columnKey, period, rowMeasureToken || DEFAULT_MEASURE_TOKEN, value);
          if (requiredToken && rowMeasureToken && requiredToken !== rowMeasureToken) return;
          addValue(accountMember, columnKey, period, value);
          return;
        }

        accountMembers.forEach(member => {
          const accountRule = this._resolveMeasureRuleForAccount(member, rules);
          const requiredToken = accountRule.measureToken;
          const value = this._toNumber(this._cellNumeric(row[member.alias]));
          addFormulaValue(member, columnKey, period, rowMeasureToken || DEFAULT_MEASURE_TOKEN, value);
          if (requiredToken && rowMeasureToken && requiredToken !== rowMeasureToken) return;
          addValue(member, columnKey, period, value);
        });
      });

      const columns = Array.from(columnMap.values()).sort((a, b) => a.sort - b.sort);
      const yearGroups = [];
      columns.forEach(column => {
        const last = yearGroups[yearGroups.length - 1];
        if (last && last.year === column.year) {
          last.colspan += 1;
          return;
        }
        yearGroups.push({ year: column.year, colspan: 1 });
      });

      const rowsOut = [];
      const aggregateColumnValue = (periodValues, formatConfig, column) => {
        return this._aggregateMonthlyValues(periodValues, formatConfig, columnWeights(column));
      };

      const resolveOverviewFormulaOperandValue = (token, columnKey, periodKey, formatConfig) => {
        if (!token || token.type !== "measure") {
          return this._createFormulaError("MISSING_OPERAND", "Conta/medida nao encontrada");
        }
        const accountToken = this._normalize(token.accountId || token.accountLabel || "");
        const measureToken = this._normalize(token.measureId || token.measureLabel || token.value || "");
        const accountResolved = accountLookup.get(accountToken);
        const accountId = typeof accountResolved === "string"
          ? accountResolved
          : (accountResolved && accountResolved.id);
        if (!accountId) return this._createFormulaError("MISSING_OPERAND", "Conta/medida nao encontrada");
        const accountNode = formulaCube.get(accountId);
        if (!accountNode || !accountNode.columns) return this._createFormulaError("MISSING_OPERAND", "Conta/medida nao encontrada");
        const periodBuckets = accountNode.columns.get(columnKey);
        if (!periodBuckets) return this._createFormulaError("MISSING_OPERAND", "Conta/medida nao encontrada");
        const bucket = periodBuckets.get(periodKey);
        if (!bucket) return this._createFormulaError("MISSING_OPERAND", "Conta/medida nao encontrada");
        return this._resolveScenarioBucketMeasureValue(bucket, measureToken, token, formatConfig);
      };

      const evaluateOverviewFormulaPeriodValue = (formula, columnKey, periodKey, formatConfig) => {
        return this._evaluateFormula(formula, token => {
          return resolveOverviewFormulaOperandValue(token, columnKey, periodKey, formatConfig);
        });
      };

      const resolveOverviewAggregatedOperandValue = (token, column, periodKeys, coverageByOperand) => {
        if (!token || token.type !== "measure") {
          return this._createFormulaError("MISSING_OPERAND", "Conta/medida nao encontrada");
        }
        const split = this._splitOperandValue(token.value);
        const accountToken = this._normalize(token.accountId || split.accountId || token.accountLabel || "");
        const accountResolved = accountLookup.get(accountToken);
        const accountId = typeof accountResolved === "string"
          ? accountResolved
          : (accountResolved && accountResolved.id);
        if (!accountId) return this._createFormulaError("MISSING_OPERAND", "Conta/medida nao encontrada");
        const accountNode = formulaCube.get(accountId);
        if (!accountNode || !accountNode.columns) return this._createFormulaError("MISSING_OPERAND", "Conta/medida nao encontrada");
        const periodBuckets = accountNode.columns.get(column.key);
        if (!periodBuckets) return this._createFormulaError("MISSING_OPERAND", "Conta/medida nao encontrada");

        const accountFormat = this._normalizeDisplayFormat(this._resolveMeasureRuleForAccount({
          id: accountId,
          label: accountNode.label || token.accountLabel || accountId,
          alias: token.accountId || accountId
        }, rules));
        const measureToken = this._normalize(token.measureId || split.measureId || accountFormat.measureToken || "");
        const operandFormat = {
          ...accountFormat,
          measureToken: measureToken || accountFormat.measureToken || "",
          subordinateMeasureToken: ""
        };
        const mode = this._normalizeYtdMode(operandFormat.ytdMode);
        const values = new Map();
        const coveredPeriods = [];
        let firstError = null;

        periodKeys.forEach(periodKey => {
          const period = this._periodFromKey(periodKey);
          if (!period) return;
          const bucket = periodBuckets.get(periodKey);
          if (!bucket) {
            if (!firstError) firstError = this._createFormulaError("MISSING_OPERAND", "Conta/medida nao encontrada");
            return;
          }
          const result = this._resolveScenarioBucketMeasureValue(bucket, measureToken, token, operandFormat);
          if (!result || result.ok !== true || !Number.isFinite(result.value)) {
            if (!firstError) firstError = this._normalizeFormulaResult(result);
            return;
          }
          const value = result.value;
          if (!Number.isFinite(value)) return;
          values.set(periodKey, value);
          coveredPeriods.push(periodKey);
        });

        if (!values.size) {
          return firstError || this._createFormulaError("FORMULA_ERROR", "Erro na formula");
        }
        this._recordFormulaOperandCoverage(coverageByOperand, token, coveredPeriods);
        return this._averageValueResult(this._aggregateMonthlyValues(values, operandFormat, columnWeights(column)), operandFormat);
      };

      const calculateOverviewFormulaFromAggregatedOperands = (formula, column, periodKeys) => {
        const coverageByOperand = new Map();
        const result = this._evaluateFormula(formula, token => {
          return resolveOverviewAggregatedOperandValue(token, column, periodKeys, coverageByOperand);
        });
        if (!result || result.ok !== true) return result;
        const coverageError = this._validateFormulaOperandCoverage(coverageByOperand);
        return coverageError || result;
      };

      const calculateOverviewFormulaColumnValue = (formula, column, formatConfig) => {
        const mode = (formatConfig && formatConfig.ytdMode) || "default";
        const periodKeys = Array.from(columnPeriodKeys.get(column.key) || [])
          .sort((a, b) => String(a).localeCompare(String(b)));
        const formulaAggregation = this._normalizeFormulaAggregation(
          formatConfig && (formatConfig.subordinateFormulaAggregation || formatConfig.formulaAggregation)
        );
        if (formulaAggregation === "aggregate_operands") {
          return calculateOverviewFormulaFromAggregatedOperands(formula, column, periodKeys);
        }
        const entries = [];
        const activeKeys = this._formulaInputPeriodKeys(formula, periodKeys, (token, key) => {
          return resolveOverviewFormulaOperandValue(token, column.key, key, formatConfig).ok;
        });
        for (const periodKey of activeKeys) {
          const period = this._periodFromKey(periodKey);
          if (!period) continue;
          const result = evaluateOverviewFormulaPeriodValue(formula, column.key, periodKey, formatConfig);
          if (!result || !result.ok || !Number.isFinite(result.value)) {
            return this._normalizeFormulaResult(result);
          }
          entries.push(this._averageEntry(result.value, periodKey, formatConfig, columnWeights(column)));
        }
        if (!entries.length) {
          return this._createFormulaError("MISSING_OPERAND", "Conta/medida nao encontrada");
        }
        return this._averageFormulaResult(entries, formatConfig);
      };

      const buildOverviewSubordinates = (member, parentFormatConfig) => {
        const configs = Array.isArray(parentFormatConfig.subordinates)
          ? parentFormatConfig.subordinates.filter(item => item && item.enabled)
          : [];
        if (!configs.length) return [];
        return configs.map((config, subIndex) => {
          const formula = this._normalizeFormula(config.formula);
          const subordinateFormat = this._normalizeDisplayFormat({
            ...parentFormatConfig,
            measureToken: config.measureToken || parentFormatConfig.measureToken || "",
            scale: config.scale || parentFormatConfig.scale,
            decimals: config.decimals,
            ytdMode: config.ytdMode || parentFormatConfig.ytdMode,
            weightConfig: config.weightConfig,
            formulaAggregation: config.formulaAggregation || DEFAULT_DISPLAY_FORMAT.subordinateFormulaAggregation,
            subordinateFormulaAggregation: config.formulaAggregation || DEFAULT_DISPLAY_FORMAT.subordinateFormulaAggregation,
            highlight: false,
            subordinate: false,
            subordinates: []
          });
          subordinateFormat.subordinateFormula = formula;
          const label = String(config.label || "").trim() || this._formulaReadableLabel(formula, "Indicador subordinado");
          const validation = this._validateFormulaTokens(formula && formula.tokens ? formula.tokens : []);
          if (!validation.valid) {
            const error = this._createFormulaError("FORMULA_ERROR", validation.error || "Erro na formula");
            return {
              account: label,
              rowKey: `${member.id}::subordinate::${subIndex}`,
              accountId: member.id,
              parentAccountId: member.id,
              subordinateIndex: subIndex,
              formula,
              parentAccount: member.label,
              isOverviewSubordinate: true,
              formatConfig: subordinateFormat,
              values: columns.map(() => null),
              cellErrors: columns.map(() => error)
            };
          }
          const results = columns.map(column => calculateOverviewFormulaColumnValue(formula, column, subordinateFormat));
          return {
            account: label,
            rowKey: `${member.id}::subordinate::${subIndex}`,
            accountId: member.id,
            parentAccountId: member.id,
            subordinateIndex: subIndex,
            formula,
            parentAccount: member.label,
            isOverviewSubordinate: true,
            formatConfig: subordinateFormat,
            values: results.map(result => this._resultValue(result)),
            cellErrors: results.map(result => this._resultError(result))
          };
        });
      };

      accountMembers.forEach(member => {
        const formatConfig = this._normalizeDisplayFormat(this._resolveMeasureRuleForAccount(member, rules));
        if (formatConfig.hidden) return;
        const accountValues = rowMatrix.get(member.id) || new Map();
        const values = columns.map(col => aggregateColumnValue(accountValues.get(col.key), formatConfig, col));
        rowsOut.push({
          accountId: member.id,
          rowKey: `${member.id}::main`,
          account: member.label,
          formatConfig,
          values
        });
        buildOverviewSubordinates(member, formatConfig).forEach(subordinateRow => rowsOut.push(subordinateRow));
      });

      const rowsWithCalculated = this._buildCalculatedOverviewRows({
        catalog: calculatedCatalog,
        resolveWeight: (format, key, column) => weights(format, key, column.key),
        columns,
        columnPeriodKeys,
        baseRows: rowsOut,
        resolveMeasurePeriod: (token, column, periodKey, formatConfig) => {
          return resolveOverviewFormulaOperandValue(token, column.key, periodKey, formatConfig);
        },
        resolveMeasureAggregate: (token, column, periodKeys, coverageByOperand) => {
          return resolveOverviewAggregatedOperandValue(token, column, periodKeys, coverageByOperand);
        },
        rowOrder: input.rowOrder
      });

      const totals = columns.map((col, index) => {
        let sum = 0;
        rowsWithCalculated.forEach(row => {
          if (row && (row.isOverviewSubordinate || row.isCalculatedIndicator)) return;
          sum += Number(row.values[index] || 0);
        });
        return rowsWithCalculated.some(row => !row.isOverviewSubordinate && !row.isCalculatedIndicator && OnePagerAverageWeights.custom(row.formatConfig) && row.values[index] === null) ? null : sum;
      });
      const comparisonPairs = (input.percentageComparisons || []).map(config => {
        const findSource = (year, version) => {
          const token = this._normalize(version);
          return columns.findIndex(column => Number(column.year) === Number(year)
            && [column.versionLabel, column.versionKey].some(value => this._normalize(value) === token));
        };
        const leftIndex = findSource(config.leftYear, config.leftVersion);
        const rightIndex = findSource(config.rightYear, config.rightVersion);
        return leftIndex >= 0 && rightIndex >= 0
          ? { ...config, leftIndex, rightIndex, key: "comparison::" + leftIndex + "::" + rightIndex + "::" + this._normalize(config.label) }
          : null;
      }).filter(Boolean);
      const comparisonColumns = comparisonPairs.map(pair => ({
        key: pair.key, type: "delta_pct", year: "VARIAÇÃO %", versionLabel: pair.label,
        comparisonLeftKey: columns[pair.leftIndex].key, comparisonRightKey: columns[pair.rightIndex].key
      }));
      rowsWithCalculated.forEach(row => {
        const sourceValues = row.values || [];
        const sourceErrors = row.cellErrors || [];
        row.values = sourceValues.concat(comparisonPairs.map(pair => {
          const left = sourceValues[pair.leftIndex], right = sourceValues[pair.rightIndex];
          return Number.isFinite(left) && Number.isFinite(right) ? this._safePct(left - right, right) : null;
        }));
        if (row.cellErrors) row.cellErrors = sourceErrors.concat(comparisonPairs.map(pair =>
          sourceErrors[pair.leftIndex] || sourceErrors[pair.rightIndex] || null));
      });
      const displayColumns = columns.concat(comparisonColumns);
      const displayYearGroups = yearGroups.slice();
      if (comparisonColumns.length) displayYearGroups.push({ year: "VARIAÇÃO %", colspan: comparisonColumns.length, isComparison: true });
      if (comparisonPairs.length) totals.push(...comparisonPairs.map(pair => {
        const left = totals[pair.leftIndex], right = totals[pair.rightIndex];
        return Number.isFinite(left) && Number.isFinite(right) ? this._safePct(left - right, right) : null;
      }));
      const totalFormat = this._deriveTotalFormat(
        rowsWithCalculated
          .filter(item => !(item && (item.isOverviewSubordinate || item.isCalculatedIndicator)))
          .map(item => ({ formatConfig: item.formatConfig }))
      );

      return {
        mode: "overview",
        state: columns.length ? "ok" : "empty",
        message: columns.length ? "" : "Sem dados ate a data base selecionada.",
        columns: displayColumns,
        yearGroups: displayYearGroups,
        rows: rowsWithCalculated,
        totals,
        totalFormat,
        scenarioAlias: scenarioAlias || "",
        auditContext: {
          kind: "overview",
          resolveWeight: weights,
          formulaCube,
          columnPeriodKeys,
          accountLookup,
          accountMembers,
          rules,
          columns,
          selectedPeriod,
          calculatedCatalog
        },
        calculatedCatalog
      };
    },


    _buildOverviewDimensionRowsView(params) {
      const input = params || {};
      const rowDimensionAlias = String(input.rowDimensionAlias || "").trim();
      const configuredRowAliases = Array.isArray(input.rowDimensionAliases)
        ? input.rowDimensionAliases
        : [];
      const rowDimensionAliases = [
        rowDimensionAlias,
        ...configuredRowAliases
      ]
        .map(alias => String(alias == null ? "" : alias).trim())
        .filter(Boolean)
        .filter((alias, index, list) => list.indexOf(alias) === index)
        .slice(0, 4);
      if (!rowDimensionAliases.length) {
        return {
          mode: "overview_2",
          state: "missing_dimension",
          message: "Selecione pelo menos o Nivel 1 do drilldown de linhas no painel de estilizacao.",
          rowDimensionAlias: "",
          rowDimensionAliases: [],
          columns: [],
          yearGroups: [],
          rows: [],
          totals: []
        };
      }

      const accountMembers = Array.isArray(input.accountMembers) ? input.accountMembers : [];
      const accountAliases = Array.isArray(input.accountAliases) ? input.accountAliases : [];
      const rows = Array.isArray(input.rows) ? input.rows : [];
      const rules = input.rules || { entries: [] };
      const selectedPeriod = input.selectedPeriod || null;
      const selectedYear = Number(input.selectedYear || 0);
      const selectedMonth = Number(input.selectedMonth || 0);
      const selectedSort = selectedYear * 100 + selectedMonth;
      const periodAlias = input.periodAlias || "";
      const scenarioAlias = input.scenarioAlias || "";
      const scenarioResolver = input.scenarioResolver || { actualLabel: DEFAULT_SCENARIO_CONFIG.actualLabel };
      const accountMode = input.accountMode || "rows";
      const measureAliases = Array.isArray(input.measureAliases) ? input.measureAliases : [];
      const dimensionAliases = Array.isArray(input.dimensionAliases) ? input.dimensionAliases : [];
      const measureDimAlias = input.measureDimAlias || "";
      const periodByRow = input.periodByRow && typeof input.periodByRow.get === "function"
        ? input.periodByRow
        : null;
      if (!selectedPeriod || !selectedYear || !selectedMonth) {
        return {
          mode: "overview_2",
          state: "empty",
          message: "Periodo base invalido para gerar Overview 2.",
          rowDimensionAlias: rowDimensionAliases[0] || "",
          rowDimensionAliases,
          columns: [],
          yearGroups: [],
          rows: [],
          totals: []
        };
      }

      const columnMap = new Map();
      const rootNodes = [];
      const nodeMap = new Map();
      const columnTotals = new Map();
      const versionOrder = new Map();
      let nodeOrder = 0;
      const syntheticAccountId = "__OVERVIEW2_VALUE__";
      const accountFormatById = new Map();
      const accountRuntime = accountMembers.map(member => {
        const formatConfig = this._normalizeDisplayFormat(this._resolveMeasureRuleForAccount(member, rules));
        accountFormatById.set(member.id, formatConfig);
        return { member, formatConfig };
      });
      const hasWeightConfiguration = accountRuntime.some(item => !!item.formatConfig.weightConfig);
      const baseFormat = accountMembers.length === 1
        ? accountFormatById.get(accountMembers[0].id)
        : this._deriveTotalFormat(accountMembers.map(member => ({
          formatConfig: accountFormatById.get(member.id)
        })));

      const resolveVersion = row => {
        if (!scenarioAlias) {
          return {
            key: "ACTUAL",
            label: String(scenarioResolver.actualLabel || DEFAULT_SCENARIO_CONFIG.actualLabel)
          };
        }
        const cell = row ? row[scenarioAlias] : null;
        const rawId = this._cellId(cell);
        const rawLabel = this._cellLabel(cell) || this._cellText(cell);
        const key = this._normalize(rawId || rawLabel);
        if (!key) return null;
        return {
          key,
          label: String(rawLabel || rawId || key).trim()
        };
      };

      const resolveRowPath = row => {
        const path = [];
        for (const alias of rowDimensionAliases) {
          const cell = row ? row[alias] : null;
          const rawId = this._cellId(cell);
          const rawLabel = this._cellLabel(cell) || this._cellText(cell);
          const key = this._normalize(rawId || rawLabel);
          if (!key) {
            if (!path.length) return null;
            break;
          }
          path.push({
            alias,
            key,
            label: String(rawLabel || rawId || key).trim()
          });
        }
        return path.length ? path : null;
      };

      const weights = this._createAverageWeightResolver(input, (row, period) => {
        const version = resolveVersion(row), path = resolveRowPath(row);
        if (!version || !path) return null;
        const column = String(period.year) + "::" + version.key;
        const scopes = [JSON.stringify([column, ""])];
        let key = "";
        for (const member of path) {
          key = (key ? key + ">" : "") + member.alias + ":" + member.key;
          scopes.push(JSON.stringify([column, key]));
        }
        return scopes;
      });
      const ensureColumn = (period, version) => {
        if (!period || !version || !version.key) return null;
        if (!versionOrder.has(version.key)) versionOrder.set(version.key, versionOrder.size);
        const key = `${period.year}::${version.key}`;
        if (!columnMap.has(key)) {
          columnMap.set(key, {
            key,
            year: period.year,
            versionKey: version.key,
            versionLabel: version.label,
            sort: period.year * 1000 + versionOrder.get(version.key)
          });
        }
        return key;
      };

      const ensureNode = (pathMembers, level) => {
        let parent = null;
        let fullKey = "";
        for (let index = 0; index <= level; index += 1) {
          const member = pathMembers[index];
          const part = `${member.alias}:${member.key}`;
          fullKey = fullKey ? `${fullKey}>${part}` : part;
          if (!nodeMap.has(fullKey)) {
            const node = {
              key: fullKey,
              rowKey: `DRILL::${fullKey}`,
              account: member.label,
              label: member.label,
              level: index,
              dimensionAlias: member.alias,
              path: pathMembers.slice(0, index + 1).map(item => item.label),
              parentKey: parent ? parent.key : "",
              order: nodeOrder,
              values: new Map(),
              children: new Map()
            };
            nodeOrder += 1;
            nodeMap.set(fullKey, node);
            if (parent) parent.children.set(fullKey, node);
            else rootNodes.push(node);
          }
          parent = nodeMap.get(fullKey);
        }
        return parent;
      };

      const addAccountPeriodValue = (targetMap, columnKey, accountKey, periodKey, value) => {
        if (!targetMap.has(columnKey)) targetMap.set(columnKey, new Map());
        const accountMap = targetMap.get(columnKey);
        if (!accountMap.has(accountKey)) accountMap.set(accountKey, new Map());
        const periodMap = accountMap.get(accountKey);
        periodMap.set(periodKey, (periodMap.get(periodKey) || 0) + value);
      };

      const addValue = (rowPath, columnKey, period, value, accountKeyRaw) => {
        if (!rowPath || !rowPath.length || !columnKey || value == null) return;
        const periodKey = `${period.year}-${String(period.month).padStart(2, "0")}`;
        const accountKey = String(accountKeyRaw || syntheticAccountId);
        addAccountPeriodValue(columnTotals, columnKey, accountKey, periodKey, value);
        rowPath.forEach((member, level) => {
          const node = ensureNode(rowPath, level);
          if (!node) return;
          addAccountPeriodValue(node.values, columnKey, accountKey, periodKey, value);
        });
      };

      rows.forEach(row => {
        const period = periodByRow
          ? periodByRow.get(row)
          : this._extractPeriodFromRow(row, periodAlias, dimensionAliases);
        if (!period || period.sort > selectedSort) return;
        const version = resolveVersion(row);
        const rowPath = resolveRowPath(row);
        if (!version || !rowPath) return;
        const columnKey = ensureColumn(period, version);
        if (!columnKey) return;

        const rowMeasureToken = this._extractMeasureToken(row, measureDimAlias);
        if (accountMode === "columns" && accountMembers.length) {
          accountRuntime.forEach(({ member, formatConfig }) => {
            const requiredToken = formatConfig.measureToken;
            if (requiredToken && rowMeasureToken && requiredToken !== rowMeasureToken) return;
            const value = this._toNumber(this._cellNumeric(row[member.alias]));
            addValue(rowPath, columnKey, period, value, member.id);
          });
          return;
        }

        if (accountMode === "rows" && accountMembers.length) {
          const accountMember = this._resolveRowAccountMember(row, accountMembers, accountAliases);
          if (!accountMember) return;
          const accountRule = accountFormatById.get(accountMember.id)
            || this._normalizeDisplayFormat(this._resolveMeasureRuleForAccount(accountMember, rules));
          const requiredToken = accountRule.measureToken;
          if (requiredToken && rowMeasureToken && requiredToken !== rowMeasureToken) return;
          const value = this._readRowNumericValue(row, measureAliases, dimensionAliases, accountAliases);
          addValue(rowPath, columnKey, period, value, accountMember.id);
          return;
        }

        const value = this._readRowNumericValue(row, measureAliases, dimensionAliases, accountAliases);
        addValue(rowPath, columnKey, period, value, syntheticAccountId);
      });

      const columns = Array.from(columnMap.values()).sort((a, b) => a.sort - b.sort);
      const yearGroups = [];
      columns.forEach(column => {
        const last = yearGroups[yearGroups.length - 1];
        if (last && last.year === column.year) {
          last.colspan += 1;
          return;
        }
        yearGroups.push({ year: column.year, colspan: 1 });
      });

      const aggregateColumnValue = (accountPeriodValues, column, nodeKey = "") => {
        let sum = 0;
        let hasValue = false;
        let invalidWeight = false;
        if (accountPeriodValues && typeof accountPeriodValues.forEach === "function") {
          accountPeriodValues.forEach((periodValues, accountKey) => {
            const formatConfig = accountFormatById.get(accountKey) || baseFormat;
            if (hasWeightConfiguration && formatConfig.hidden) return;
            const value = this._aggregateMonthlyValues(periodValues, formatConfig,
              (format, key) => weights(format, key, JSON.stringify([column.key, nodeKey])));
            if (value === null && OnePagerAverageWeights.custom(formatConfig)) invalidWeight = true;
            if (!Number.isFinite(value)) return;
            sum += value;
            hasValue = true;
          });
        }
        return invalidWeight ? null : hasValue ? sum : 0;
      };
      const cachedNodeRows = new Map();
      const projectRows = () => {
        const expandedKeys = this._overview2ExpandedKeys || new Set();
        const rowsOut = [];
        const appendVisibleNode = node => {
          const isExpanded = expandedKeys.has(node.key);
          if (!cachedNodeRows.has(node.key)) cachedNodeRows.set(node.key, {
            account: node.account,
            rowKey: node.rowKey,
            drilldownKey: node.key,
            drilldownLevel: node.level,
            drilldownPath: node.path,
            hasChildren: node.children.size > 0,
            isExpanded,
            formatConfig: baseFormat,
            values: columns.map(col => aggregateColumnValue(node.values.get(col.key), col, node.key))
          });
          const row = cachedNodeRows.get(node.key);
          row.isExpanded = isExpanded;
          rowsOut.push(row);
          if (isExpanded) node.children.forEach(appendVisibleNode);
        };
        rootNodes.forEach(appendVisibleNode);
        return rowsOut;
      };
      const rowsOut = projectRows();

      const totals = columns.map(col => aggregateColumnValue(columnTotals.get(col.key), col));

      return {
        mode: "overview_2",
        state: columns.length && rootNodes.length ? "ok" : "empty",
        message: columns.length && rootNodes.length ? "" : "Sem dados ate a data base selecionada para as dimensoes de linhas.",
        rowDimensionAlias: rowDimensionAliases[0] || "",
        rowDimensionAliases,
        columns,
        yearGroups,
        rows: rowsOut,
        _projectRows: rowDimensionAliases.length > 1 ? projectRows : null,
        totals,
        totalFormat: baseFormat,
        scenarioAlias: scenarioAlias || ""
      };
    },


    _buildDimensionColumnsView(params) {
      const input = params || {};
      const dimensionAlias = String(input.dimensionAlias || "").trim();
      if (!dimensionAlias) {
        return {
          mode: "dimension_columns",
          state: "missing_dimension",
          message: "Selecione uma dimensao para abrir as colunas no painel de estilizacao.",
          dimensionAlias: "",
          columns: [],
          rows: [],
          totals: []
        };
      }

      const accountMembers = Array.isArray(input.accountMembers) ? input.accountMembers : [];
      const accountAliases = Array.isArray(input.accountAliases) ? input.accountAliases : [];
      const rows = Array.isArray(input.rows) ? input.rows : [];
      const scenarioResolver = input.scenarioResolver || { resolve: () => "actual" };
      const rules = input.rules || { entries: [] };
      const selectedPeriod = input.selectedPeriod || null;
      const selectedYear = Number(input.selectedYear || 0);
      const selectedMonth = Number(input.selectedMonth || 0);
      const periodAlias = input.periodAlias || "";
      const scenarioAlias = input.scenarioAlias || "";
      const accountMode = input.accountMode || "rows";
      const measureAliases = Array.isArray(input.measureAliases) ? input.measureAliases : [];
      const dimensionAliases = Array.isArray(input.dimensionAliases) ? input.dimensionAliases : [];
      const measureDimAlias = input.measureDimAlias || "";
      if (!selectedPeriod || !selectedYear || !selectedMonth) {
        return {
          mode: "dimension_columns",
          state: "empty",
          message: "Periodo base invalido para gerar colunas por dimensao.",
          dimensionAlias,
          columns: [],
          rows: [],
          totals: []
        };
      }

      const useRawScenarioMembers = !!(scenarioAlias && scenarioAlias === dimensionAlias);
      const weights = this._createAverageWeightResolver(input, row => {
        if (!useRawScenarioMembers && scenarioResolver.resolve(row) !== "actual") return null;
        const cell = row[dimensionAlias];
        return this._normalize(this._cellId(cell) || this._cellLabel(cell) || this._cellText(cell)) || null;
      });
      const columnMap = new Map();
      const rowMatrix = new Map();

      const addValue = (accountMember, columnKey, columnLabel, period, value) => {
        if (!accountMember || !columnKey || value == null) return;
        if (!rowMatrix.has(accountMember.id)) rowMatrix.set(accountMember.id, new Map());
        const accountMap = rowMatrix.get(accountMember.id);
        if (!accountMap.has(columnKey)) accountMap.set(columnKey, new Map());
        const periods = accountMap.get(columnKey);
        periods.set(period.key, (periods.get(period.key) || 0) + value);
        if (!columnMap.has(columnKey)) {
          columnMap.set(columnKey, {
            key: columnKey,
            label: columnLabel || columnKey
          });
        }
      };

      rows.forEach(row => {
        const period = this._extractPeriodFromRow(row, periodAlias, dimensionAliases);
        if (!period) return;
        // Modo colunas por dimensao: agrega YTD da BASE (JAN ate mes selecionado).
        if (period.year !== selectedYear || period.month > selectedMonth) return;

        if (!useRawScenarioMembers) {
          const scenarioRole = scenarioResolver.resolve(row);
          if (scenarioRole !== "actual") return;
        }

        const columnCell = row ? row[dimensionAlias] : null;
        const rawColumnId = this._cellId(columnCell);
        const rawColumnLabel = this._cellLabel(columnCell) || this._cellText(columnCell);
        const columnKey = this._normalize(rawColumnId || rawColumnLabel);
        if (!columnKey) return;
        const columnLabel = String(rawColumnLabel || rawColumnId || columnKey).trim();

        const rowMeasureToken = this._extractMeasureToken(row, measureDimAlias);

        if (accountMode === "rows") {
          const accountMember = this._resolveRowAccountMember(row, accountMembers, accountAliases);
          if (!accountMember) return;
          const accountRule = this._resolveMeasureRuleForAccount(accountMember, rules);
          const requiredToken = accountRule.measureToken;
          if (requiredToken && rowMeasureToken && requiredToken !== rowMeasureToken) return;
          const value = this._readRowNumericValue(row, measureAliases, dimensionAliases, accountAliases);
          addValue(accountMember, columnKey, columnLabel, period, value);
          return;
        }

        accountMembers.forEach(member => {
          const accountRule = this._resolveMeasureRuleForAccount(member, rules);
          const requiredToken = accountRule.measureToken;
          if (requiredToken && rowMeasureToken && requiredToken !== rowMeasureToken) return;
          const value = this._toNumber(this._cellNumeric(row[member.alias]));
          addValue(member, columnKey, columnLabel, period, value);
        });
      });

      const columns = Array.from(columnMap.values());
      const rowsOut = [];
      accountMembers.forEach(member => {
        const formatConfig = this._normalizeDisplayFormat(this._resolveMeasureRuleForAccount(member, rules));
        if (formatConfig.hidden) return;
        const accountValues = rowMatrix.get(member.id) || new Map();
        const values = columns.map(col => this._aggregateMonthlyValues(accountValues.get(col.key), formatConfig, (format, key) => weights(format, key, col.key)));
        rowsOut.push({
          account: member.label,
          formatConfig,
          values
        });
      });

      const totals = columns.map((col, index) => {
        let sum = 0;
        rowsOut.forEach(row => {
          sum += Number(row.values[index] || 0);
        });
        return rowsOut.some(row => OnePagerAverageWeights.custom(row.formatConfig) && row.values[index] === null) ? null : sum;
      });
      const totalFormat = this._deriveTotalFormat(rowsOut.map(item => ({ formatConfig: item.formatConfig })));

      return {
        mode: "dimension_columns",
        state: columns.length ? "ok" : "empty",
        message: columns.length ? "" : "Sem dados para a dimensao selecionada no ano base.",
        dimensionAlias,
        columns,
        rows: rowsOut,
        totals,
        totalFormat,
        useRawScenarioMembers
      };
    },


    _resolveRowAccountMember(row, accountMembers, accountAliases) {
      for (const alias of accountAliases || []) {
        const cell = row ? row[alias] : null;
        const label = this._cellLabel(cell);
        const numeric = this._toNumber(this._cellNumeric(cell));
        if (!label || numeric != null) continue;
        const found = this._findAccountMember(label, accountMembers);
        if (found) return found;
      }

      const rowTexts = Object.keys(row || {})
        .map(key => this._cellText(row[key]))
        .filter(Boolean)
        .map(text => this._normalize(text));

      for (const member of accountMembers || []) {
        for (const token of member.tokens) {
          if (rowTexts.some(text => text.includes(token))) return member;
        }
      }
      return null;
    },


    _findAccountMember(label, accountMembers) {
      const token = this._normalize(label);
      if (!token) return null;
      return (accountMembers || []).find(member => member.tokens.has(token)) || null;
    },


    _extractMeasureToken(row, measureAlias) {
      if (!measureAlias) return "";
      const cell = row ? row[measureAlias] : null;
      const id = this._cellId(cell);
      const label = this._cellLabel(cell);
      const token = this._normalize(id || label);
      return token || "";
    },


    _readRowNumericValue(row, measureAliases, dimensionAliases, accountAliases = []) {
      for (const alias of measureAliases || []) {
        const value = this._toNumber(this._cellNumeric(row ? row[alias] : null));
        if (value != null) return value;
      }

      if (measureAliases && measureAliases.length) return null;
      const excluded = new Set([...(dimensionAliases || []), ...accountAliases]);
      const candidates = [];
      for (const key of Object.keys(row || {})) {
        if (excluded.has(key) || key.endsWith("_id")) continue;
        const cell = row[key];
        const isRawField = typeof cell === "number" || (cell && typeof cell === "object" && (
          Object.prototype.hasOwnProperty.call(cell, "raw") || Object.prototype.hasOwnProperty.call(cell, "value")
        ));
        if (!isRawField) continue;
        const value = this._cellNumeric(cell);
        if (value != null) candidates.push(value);
      }
      return candidates.length === 1 ? candidates[0] : null;
    },


    _parseAccountMeasureRules(rawValue, accountMembers) {
      const out = {
        parseError: false,
        byAccount: new Map(),
        entries: []
      };

      const text = this._toText(rawValue).trim();
      if (!text || text === "{}") return out;

      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (error) {
        return { ...out, parseError: true };
      }
      if (!parsed || typeof parsed !== "object") return { ...out, parseError: true };

      const register = (accountRaw, ruleRaw) => {
        const accountToken = this._normalize(accountRaw);
        if (!accountToken) return;
        const config = this._normalizeRuleConfig(ruleRaw);
        out.byAccount.set(accountToken, config);
        out.entries.push({
          account: accountToken,
          measure: config.measureToken,
          scale: config.scale,
          decimals: config.decimals,
          ytdMode: config.ytdMode,
          deltaPolarity: config.deltaPolarity,
          weightMeasure: config.weightMeasureToken,
          hidden: config.hidden,
          highlight: config.highlight,
          subordinate: config.subordinate,
          subordinateFormulaTokens: Array.isArray(config.subordinateFormula && config.subordinateFormula.tokens)
            ? config.subordinateFormula.tokens.length
            : 0
        });
      };

      if (Array.isArray(parsed.rules)) {
        parsed.rules.forEach(rule => {
          if (!rule || typeof rule !== "object") return;
          register(
            rule.accountId || rule.accountLabel || rule.account || "",
            rule
          );
        });
      } else {
        Object.keys(parsed).forEach(accountKey => {
          if (accountKey === CALCULATED_INDICATORS_MIRROR_KEY) return;
          const value = parsed[accountKey];
          if (value == null) return;
          register(accountKey, value);
        });
      }

      (accountMembers || []).forEach(member => {
        const direct = this._resolveMeasureRuleForAccount(member, out);
        if (
          direct.measureToken ||
          direct.itrDisplayLabel ||
          direct.bpSection ||
          direct.bpClassification ||
          direct.bpDynamicClassification ||
          direct.bpCompanyDimensionAlias ||
          (direct.itrDisplaySign && direct.itrDisplaySign !== "original") ||
          direct.scale !== DEFAULT_DISPLAY_FORMAT.scale ||
          direct.decimals !== DEFAULT_DISPLAY_FORMAT.decimals ||
          direct.ytdMode !== DEFAULT_DISPLAY_FORMAT.ytdMode ||
          direct.deltaPolarity !== DEFAULT_DISPLAY_FORMAT.deltaPolarity ||
          direct.weightMeasureToken ||
          direct.hidden ||
          direct.highlight ||
          direct.subordinate ||
          (direct.subordinateFormula && Array.isArray(direct.subordinateFormula.tokens) && direct.subordinateFormula.tokens.length) ||
          direct.subordinateLabel ||
          direct.subordinateMeasureToken ||
          direct.subordinateScale !== DEFAULT_DISPLAY_FORMAT.subordinateScale ||
          direct.subordinateDecimals !== DEFAULT_DISPLAY_FORMAT.subordinateDecimals ||
          direct.subordinateYtdMode !== DEFAULT_DISPLAY_FORMAT.subordinateYtdMode
        ) return;
        const byLabel = out.byAccount.get(this._normalize(member.label));
        if (!byLabel) return;
        out.byAccount.set(this._normalize(member.id), { ...byLabel });
      });

      return out;
    },


    _resolveMeasureRuleForAccount(accountMember, rules) {
      if (!accountMember || !rules || !rules.byAccount) return { ...DEFAULT_DISPLAY_FORMAT, measureToken: "" };
      const candidates = [
        this._normalize(accountMember.id),
        this._normalize(accountMember.label),
        this._normalize(accountMember.alias)
      ].filter(Boolean);
      for (const key of candidates) {
        if (rules.byAccount.has(key)) {
          return this._normalizeDisplayFormat(rules.byAccount.get(key));
        }
      }
      return { ...DEFAULT_DISPLAY_FORMAT, measureToken: "" };
    },


    _normalizeRuleConfig(value) {
      if (typeof value === "string") {
        return {
          measureToken: this._normalize(value),
          itrDisplayLabel: DEFAULT_DISPLAY_FORMAT.itrDisplayLabel,
          itrDrilldownDimensionAlias: DEFAULT_DISPLAY_FORMAT.itrDrilldownDimensionAlias,
          itrDrilldownExpanded: DEFAULT_DISPLAY_FORMAT.itrDrilldownExpanded,
          scale: DEFAULT_DISPLAY_FORMAT.scale,
          decimals: DEFAULT_DISPLAY_FORMAT.decimals,
          ytdMode: DEFAULT_DISPLAY_FORMAT.ytdMode,
          deltaPolarity: DEFAULT_DISPLAY_FORMAT.deltaPolarity,
          weightMeasureToken: DEFAULT_DISPLAY_FORMAT.weightMeasureToken,
          hidden: DEFAULT_DISPLAY_FORMAT.hidden,
          highlight: DEFAULT_DISPLAY_FORMAT.highlight,
          subordinate: DEFAULT_DISPLAY_FORMAT.subordinate,
          subordinateFormula: { tokens: [] },
          subordinateLabel: DEFAULT_DISPLAY_FORMAT.subordinateLabel,
          subordinateMeasureToken: DEFAULT_DISPLAY_FORMAT.subordinateMeasureToken,
          subordinateScale: DEFAULT_DISPLAY_FORMAT.subordinateScale,
          subordinateDecimals: DEFAULT_DISPLAY_FORMAT.subordinateDecimals,
          subordinateYtdMode: DEFAULT_DISPLAY_FORMAT.subordinateYtdMode,
          subordinateFormulaAggregation: DEFAULT_DISPLAY_FORMAT.subordinateFormulaAggregation,
          subordinates: []
        };
      }
      if (!value || typeof value !== "object") {
        return { ...DEFAULT_DISPLAY_FORMAT, measureToken: "" };
      }
      const hiddenRaw = value.hidden != null ? value.hidden : value.ocultar;
      const highlightRaw = value.highlight != null ? value.highlight : value.destacar;
      const subordinateRaw = value.subordinate != null
        ? value.subordinate
        : (value.indicadorSubordinado != null ? value.indicadorSubordinado : value.subordinado);
      const subordinateFormulaRaw = value.subordinateFormulaJson != null
        ? value.subordinateFormulaJson
        : (value.subordinateFormula != null
          ? value.subordinateFormula
          : (value.formulaJson != null ? value.formulaJson : value.formula));
      const subordinateLabelRaw = value.subordinateLabel != null
        ? value.subordinateLabel
        : (value.subordinateName != null
          ? value.subordinateName
          : (value.subordinateTitle != null ? value.subordinateTitle : value.nomeSubordinado));
      const legacySubordinate = {
        ...OnePagerAverageWeights.fields(value.subordinateWeightConfig),
        enabled: this._normalizeBoolean(subordinateRaw),
        formula: this._parseFormula(subordinateFormulaRaw || ""),
        label: String(subordinateLabelRaw == null ? "" : subordinateLabelRaw).trim(),
        measureToken: this._normalize(
          value.subordinateMeasureToken || value.subordinateMeasureId || value.subordinateMeasureLabel || value.subordinateMeasure || ""
        ),
        scale: this._normalizeScale(
          value.subordinateDisplayScale || value.subordinateScale || DEFAULT_DISPLAY_FORMAT.subordinateScale
        ),
        decimals: this._normalizeDecimals(
          value.subordinateDecimals != null ? value.subordinateDecimals : DEFAULT_DISPLAY_FORMAT.subordinateDecimals
        ),
        ytdMode: this._normalizeYtdMode(
          value.subordinateYtdMode || DEFAULT_DISPLAY_FORMAT.subordinateYtdMode
        ),
        formulaAggregation: this._normalizeFormulaAggregation(
          value.subordinateFormulaAggregation || value.formulaAggregation || DEFAULT_DISPLAY_FORMAT.subordinateFormulaAggregation
        )
      };
      const subordinates = Array.isArray(value.subordinates)
        ? value.subordinates
          .map(item => this._normalizeSubordinateConfig(item))
          .filter(item => item.enabled || item.label || (item.formula && item.formula.tokens && item.formula.tokens.length))
        : [];
      if (!subordinates.length && (
        legacySubordinate.enabled ||
        legacySubordinate.label ||
        (legacySubordinate.formula && legacySubordinate.formula.tokens && legacySubordinate.formula.tokens.length)
      )) {
        subordinates.push(legacySubordinate);
      }
      const primarySubordinate = subordinates[0] || legacySubordinate;
      return {
        measureToken: this._normalize(
          value.measureToken || value.measureId || value.measureLabel || value.measure || ""
        ),
        itrDisplayLabel: String(value.itrDisplayLabel || "").trim(),
        bpSection: ["assets", "liabilities", "equity"].includes(value.bpSection) ? value.bpSection : "",
        bpClassification: ["current", "non_current"].includes(value.bpClassification) ? value.bpClassification : "",
        bpDynamicClassification: this._normalizeBoolean(value.bpDynamicClassification),
        bpCompanyDimensionAlias: String(value.bpCompanyDimensionAlias || "").trim(),
        itrDisplaySign: this._normalizeItrDisplaySign(value.itrDisplaySign),
        itrDrilldownDimensionAlias: String(
          value.itrDrilldownDimensionAlias || value.overviewItrDrilldownDimensionAlias || value.itrRowDimensionAlias || ""
        ).trim(),
        itrDrilldownExpanded: this._normalizeBoolean(
          value.itrDrilldownExpanded != null
            ? value.itrDrilldownExpanded
            : value.overviewItrDrilldownExpanded
        ),
        scale: this._normalizeScale(value.displayScale || value.scale || DEFAULT_DISPLAY_FORMAT.scale),
        decimals: this._normalizeDecimals(value.decimals),
        ytdMode: this._normalizeYtdMode(value.ytdMode),
        ...OnePagerAverageWeights.fields(value.weightConfig),
        deltaPolarity: this._normalizeDeltaPolarity(
          value.deltaPolarity != null
            ? value.deltaPolarity
            : (value.polaridadeDelta != null ? value.polaridadeDelta : DEFAULT_DISPLAY_FORMAT.deltaPolarity)
        ),
        hidden: this._normalizeBoolean(hiddenRaw),
        highlight: this._normalizeHighlight(highlightRaw),
        subordinate: primarySubordinate.enabled || subordinates.length > 0,
        subordinateFormula: this._normalizeFormula(primarySubordinate.formula),
        subordinateLabel: String(primarySubordinate.label || "").trim(),
        subordinateMeasureToken: primarySubordinate.measureToken || "",
        subordinateScale: primarySubordinate.scale || DEFAULT_DISPLAY_FORMAT.subordinateScale,
        subordinateDecimals: this._normalizeDecimals(primarySubordinate.decimals),
        subordinateYtdMode: primarySubordinate.ytdMode || DEFAULT_DISPLAY_FORMAT.subordinateYtdMode,
        subordinateFormulaAggregation: primarySubordinate.formulaAggregation || DEFAULT_DISPLAY_FORMAT.subordinateFormulaAggregation,
        ...(primarySubordinate.weightConfig ? { subordinateWeightConfig: primarySubordinate.weightConfig } : {}),
        subordinates,
        weightMeasureToken: this._normalize(
          value.weightMeasureToken || value.weightMeasureId || value.weightMeasureLabel || value.weightMeasure || ""
        )
      };
    },


    _normalizeSubordinateConfig(value) {
      const source = value && typeof value === "object" ? value : {};
      const enabledRaw = source.enabled != null
        ? source.enabled
        : (source.subordinate != null
          ? source.subordinate
          : (source.indicadorSubordinado != null ? source.indicadorSubordinado : true));
      const formulaRaw = source.formulaJson != null
        ? source.formulaJson
        : (source.subordinateFormulaJson != null
          ? source.subordinateFormulaJson
          : (source.formula != null ? source.formula : source.subordinateFormula));
      return {
        enabled: this._normalizeBoolean(enabledRaw),
        ...OnePagerAverageWeights.fields(source.weightConfig || source.subordinateWeightConfig),
        formula: this._parseFormula(formulaRaw || ""),
        label: String(
          source.label || source.name || source.title || source.subordinateLabel || source.subordinateName || source.subordinateTitle || ""
        ).trim(),
        measureToken: this._normalize(
          source.measureToken || source.measureId || source.measureLabel || source.measure ||
          source.subordinateMeasureToken || source.subordinateMeasureId || source.subordinateMeasureLabel || source.subordinateMeasure || ""
        ),
        scale: this._normalizeScale(
          source.displayScale || source.scale || source.subordinateDisplayScale || source.subordinateScale || DEFAULT_DISPLAY_FORMAT.subordinateScale
        ),
        decimals: this._normalizeDecimals(
          source.decimals != null
            ? source.decimals
            : (source.subordinateDecimals != null ? source.subordinateDecimals : DEFAULT_DISPLAY_FORMAT.subordinateDecimals)
        ),
        ytdMode: this._normalizeYtdMode(
          source.ytdMode || source.subordinateYtdMode || DEFAULT_DISPLAY_FORMAT.subordinateYtdMode
        ),
        formulaAggregation: this._normalizeFormulaAggregation(
          source.formulaAggregation || source.subordinateFormulaAggregation || DEFAULT_DISPLAY_FORMAT.subordinateFormulaAggregation
        )
      };
    },


    _normalizeDisplayFormat(value) {
      const normalized = this._normalizeRuleConfig(value);
      const subordinates = Array.isArray(normalized.subordinates)
        ? normalized.subordinates.map(item => this._normalizeSubordinateConfig(item))
        : [];
      const primarySubordinate = subordinates[0] || null;
      return {
        measureToken: normalized.measureToken || "",
        itrDisplayLabel: String(normalized.itrDisplayLabel || "").trim(),
        bpSection: normalized.bpSection || "",
        bpClassification: normalized.bpClassification || "",
        bpDynamicClassification: this._normalizeBoolean(normalized.bpDynamicClassification),
        bpCompanyDimensionAlias: String(normalized.bpCompanyDimensionAlias || "").trim(),
        itrDisplaySign: this._normalizeItrDisplaySign(normalized.itrDisplaySign),
        itrDrilldownDimensionAlias: String(normalized.itrDrilldownDimensionAlias || "").trim(),
        itrDrilldownExpanded: this._normalizeBoolean(normalized.itrDrilldownExpanded),
        scale: normalized.scale,
        decimals: normalized.decimals,
        ytdMode: normalized.ytdMode,
        ...OnePagerAverageWeights.fields(normalized.weightConfig),
        deltaPolarity: normalized.deltaPolarity || DEFAULT_DISPLAY_FORMAT.deltaPolarity,
        hidden: this._normalizeBoolean(normalized.hidden),
        highlight: normalized.highlight,
        subordinate: normalized.subordinate || !!primarySubordinate,
        subordinateFormula: primarySubordinate
          ? this._normalizeFormula(primarySubordinate.formula)
          : this._normalizeFormula(normalized.subordinateFormula),
        subordinateLabel: primarySubordinate
          ? String(primarySubordinate.label || "").trim()
          : String(normalized.subordinateLabel || "").trim(),
        subordinateMeasureToken: primarySubordinate
          ? (primarySubordinate.measureToken || "")
          : (normalized.subordinateMeasureToken || ""),
        subordinateScale: primarySubordinate
          ? (primarySubordinate.scale || DEFAULT_DISPLAY_FORMAT.subordinateScale)
          : (normalized.subordinateScale || DEFAULT_DISPLAY_FORMAT.subordinateScale),
        subordinateDecimals: primarySubordinate
          ? this._normalizeDecimals(primarySubordinate.decimals)
          : this._normalizeDecimals(normalized.subordinateDecimals),
        subordinateYtdMode: primarySubordinate
          ? (primarySubordinate.ytdMode || DEFAULT_DISPLAY_FORMAT.subordinateYtdMode)
          : (normalized.subordinateYtdMode || DEFAULT_DISPLAY_FORMAT.subordinateYtdMode),
        subordinateFormulaAggregation: primarySubordinate
          ? (primarySubordinate.formulaAggregation || DEFAULT_DISPLAY_FORMAT.subordinateFormulaAggregation)
          : (normalized.subordinateFormulaAggregation || DEFAULT_DISPLAY_FORMAT.subordinateFormulaAggregation),
        subordinates,
        ...(primarySubordinate?.weightConfig ? { subordinateWeightConfig: primarySubordinate.weightConfig } : {}),
        weightMeasureToken: normalized.weightMeasureToken || ""
      };
    },


    _normalizeScale(value) {
      const token = String(value == null ? "" : value).trim().toLowerCase();
      if (token === "percent" || token === "percentage" || token === "pct" || token === "%" || token === "percentual") return "percent";
      if (token === "multiple" || token === "x") return "multiple";
      if (token === "thousand") return "thousand";
      if (token === "million") return "million";
      if (token === "billion") return "billion";
      return "unit";
    },


    _normalizeDecimals(value) {
      const parsed = Number.parseInt(String(value == null ? "" : value), 10);
      if (!Number.isFinite(parsed)) return DEFAULT_DISPLAY_FORMAT.decimals;
      return Math.max(0, Math.min(4, parsed));
    },


    _normalizeYtdMode(value) {
      const token = String(value == null ? "" : value).trim().toLowerCase();
      if (token === "simple_avg") return "simple_avg";
      if (token === "weighted_avg") return "weighted_avg";
      return DEFAULT_DISPLAY_FORMAT.ytdMode;
    },


    _normalizeFormulaAggregation(value) {
      const token = String(value == null ? "" : value).trim().toLowerCase();
      if (token === "aggregate_operands" || token === "operands" || token === "operand_aggregate") return "aggregate_operands";
      return DEFAULT_DISPLAY_FORMAT.subordinateFormulaAggregation;
    },


    _normalizeDeltaPolarity(value) {
      const token = String(value == null ? "" : value).trim().toLowerCase();
      if (token === "higher_better" || token === "maior_melhor" || token === "maior melhor") return "higher_better";
      if (token === "neutral" || token === "neutro") return "neutral";
      return "lower_better";
    },


    _normalizeItrDisplaySign(value) {
      const token = String(value || "").trim().toLowerCase();
      return ["invert", "positive", "negative"].includes(token) ? token : "original";
    },


    _normalizeHighlight(value) {
      return OnePagerCore.toBoolean(value);
    },


    _normalizeBoolean(value) {
      return OnePagerCore.toBoolean(value);
    },


    _cellCandidates(cell) {
      if (cell == null) return [];
      if (typeof cell !== "object") return [String(cell)];
      return [
        cell.id,
        cell.key,
        cell.label,
        cell.description,
        cell.formattedValue,
        cell.formatted,
        cell.value,
        cell.raw
      ].filter(value => value != null && value !== "");
    },


    _cellId(cell) {
      const candidates = this._cellCandidates(cell);
      return candidates.length ? String(candidates[0]).trim() : "";
    },


    _cellLabel(cell) {
      if (cell == null) return "";
      if (typeof cell !== "object") return String(cell).trim();
      return String(
        cell.description ||
          cell.label ||
          cell.formattedValue ||
          cell.formatted ||
          cell.value ||
          cell.raw ||
          cell.id ||
          cell.key ||
          ""
      ).trim();
    },


    _cellText(cell) {
      return this._cellCandidates(cell).map(String).join(" ").trim();
    },


    _cellNumeric(cell) {
      return OnePagerCore.bindingNumber(cell);
    },


    _looksLikeMemberCell(cell) {
      if (!cell || typeof cell !== "object") return false;
      return !!(cell.id || cell.key || cell.label || cell.description);
    },


    _toNumber(value) {
      return OnePagerCore.toNumber(value);
    },


    _toText(value) {
      return OnePagerCore.toText(value);
    },


    _parseJsonObject(value) {
      return OnePagerCore.parseJsonObject(value);
    },


    _tokenSet(values) {
      return OnePagerCore.tokenSet(values);
    },


    _normalize(value) {
      return OnePagerCore.normalizeToken(value);
    },


    _isTotalEnabled() {
      const raw = this._props ? this._props[SHOW_TOTAL_PROPERTY] : undefined;
      if (raw == null || raw === "") return true;
      if (typeof raw === "boolean") return raw;
      const token = String(raw).trim().toLowerCase();
      if (token === "false" || token === "0" || token === "no" || token === "nao") return false;
      return true;
    },


    _parseOptionalDecimals(value) {
      if (value == null) return null;
      const token = String(value).trim().toLowerCase();
      if (!token || token === "auto" || token === "automatico") return null;
      const parsed = Number.parseInt(token, 10);
      if (!Number.isFinite(parsed)) return null;
      return this._normalizeDecimals(parsed);
    },


    _resolveDeltaAbsDecimals(fallbackDecimals) {
      const configured = this._parseOptionalDecimals(this._props ? this._props[DELTA_ABS_DECIMALS_PROPERTY] : undefined);
      if (configured == null) return this._normalizeDecimals(fallbackDecimals);
      return configured;
    },


    _resolveDeltaPctDecimals(fallbackDecimals) {
      const configured = this._parseOptionalDecimals(this._props ? this._props[DELTA_PCT_DECIMALS_PROPERTY] : undefined);
      if (configured == null) return this._normalizeDecimals(fallbackDecimals);
      return configured;
    },

  };
  const OnePagerAverageWeightsModule = {
    _createAverageWeightResolver(input, contextsForRow) {
      // Lazy, per-build indexes: no queries, no reuse across binding updates, no work for calendar weights.
      const cache = new Map();
      return (format, periodKey, context = "actual") => {
        const config = OnePagerAverageWeights.normalize(format?.weightConfig);
        const members = input.weightAccountMembers || input.accountMembers || [];
        const member = members.find(item => String(item.id) === config.accountId);
        if (!member || !config.measureToken) return null;
        const cacheKey = JSON.stringify([member.id, config.measureToken]);
        if (!cache.has(cacheKey)) {
          const values = new Map();
          for (const row of input.rows || []) {
            if (this._extractMeasureToken(row, input.measureDimAlias) !== config.measureToken) continue;
            const period = input.weightItrPeriods
              ? this._extractItrPeriodFromRow(row, input.periodAlias, input.dimensionAliases || [])
              : this._extractPeriodFromRow(row, input.periodAlias, input.dimensionAliases || []);
            if (!period || (input.weightItrPeriods && period.kind !== "month")) continue;
            const key = `${period.year}-${String(period.month).padStart(2, "0")}`;
            const contexts = contextsForRow(row, period);
            if (contexts == null) continue;
            let value;
            if (input.accountMode === "rows") {
              const account = this._resolveRowAccountMember(row, members, input.accountAliases || []);
              if (!account || account.id !== member.id) continue;
              value = this._readRowNumericValue(row, input.measureAliases || [], input.dimensionAliases || [], input.accountAliases || []);
            } else value = this._cellNumeric(row[member.alias]);
            if (!Number.isFinite(value)) continue;
            for (const scope of new Set(Array.isArray(contexts) ? contexts : [contexts])) {
              const scopedKey = JSON.stringify([scope, key]);
              values.set(scopedKey, (values.get(scopedKey) || 0) + value);
            }
          }
          cache.set(cacheKey, values);
        }
        return cache.get(cacheKey).get(JSON.stringify([context, periodKey])) ?? null;
      };
    },

    _averageEntry(value, periodKey, format, resolver, calendarWeight) {
      const period = this._periodFromKey(periodKey);
      const custom = OnePagerAverageWeights.custom(format);
      const weight = custom
        ? (typeof resolver === "function" ? resolver(format, periodKey) : null)
        : (Number.isFinite(calendarWeight) ? calendarWeight : period ? this._periodWeight(period.year, period.month) : 1);
      return { value, weight };
    },

    _aggregateAverageEntries(entries, format) {
      if (OnePagerAverageWeights.custom(format)) {
        if (!entries.length || entries.some(entry => !Number.isFinite(entry.weight) || entry.weight < 0) ||
            !entries.some(entry => entry.weight > 0)) return null;
      }
      const value = OnePagerCore.aggregateYtd(entries, format?.ytdMode);
      return Number.isFinite(value) ? value : null;
    },

    _averageFormulaResult(entries, format) {
      const value = this._aggregateAverageEntries(entries, format);
      return this._averageValueResult(value, format);
    },

    _averageValueResult(value, format) {
      return !Number.isFinite(value) && OnePagerAverageWeights.custom(format)
        ? this._createFormulaError("INVALID_WEIGHT", "Peso ausente/invalido ou soma dos pesos igual a zero. Confira a conta e medida de peso no binding.")
        : this._createFormulaSuccess(value);
    }
  };
  const OnePagerItrModule = {
    _createItrLayoutViews(params, viewConfig) {
      // Two lazy views per data build; never reuse values across host updates.
      const cache = new Map();
      const drilldown = viewConfig.mode === "overview_itr_d";
      return layout => {
        const key = layout === "monthly" ? "monthly" : "itr";
        if (!cache.has(key)) {
          const input = { ...params, itrLayout: key, rowDimensionAlias: viewConfig.itrDrilldownDimensionAlias };
          const view = drilldown ? this._buildOverviewItrDrilldownView(input) : this._buildOverviewItrView(input);
          cache.set(key, { view, expandedKeys: this._defaultExpandedDrilldownKeys });
        }
        const entry = cache.get(key);
        if (drilldown) {
          this._defaultExpandedDrilldownKeys = entry.expandedKeys;
          if (typeof entry.view._projectRows === "function") entry.view.rows = entry.view._projectRows();
        }
        return entry.view;
      };
    },

    _itrMonthlyColumns(year, month) {
      const end = (Number(year) * 12) + Number(month) - 1;
      const count = 12;
      return Array.from({ length: count }, (_, index) => {
        const serial = end - count + 1 + index;
        const columnYear = Math.floor(serial / 12);
        const columnMonth = (serial % 12) + 1;
        const period = this._buildPeriod(columnYear, columnMonth);
        const name = MONTH_NAMES[columnMonth - 1];
        return {
          key: period.key, type: "value", targetKind: "month", year: columnYear,
          startMonth: columnMonth, endMonth: columnMonth,
          exactKey: `M:${columnYear}:${String(columnMonth).padStart(2, "0")}`,
          memberLabel: `${name[0]}${name.slice(1, 3).toLowerCase()}/${String(columnYear).slice(-2)}`,
          semanticLabel: period.label, isCurrentPeriod: index === count - 1
        };
      });
    },

    _detectItrPeriodAlias(rows, dimensionAliases, dimensionsMeta) {
      const sample = (rows || []).slice(0, 1000);
      let bestAlias = "";
      let bestScore = -1;

      (dimensionAliases || []).forEach(alias => {
        const meta = (dimensionsMeta || {})[alias] || {};
        const metaText = this._normalize([alias, meta.id, meta.label, meta.description].filter(Boolean).join(" "));
        let nameScore = 0;
        PERIOD_HINTS.forEach(hint => {
          if (metaText.includes(hint)) nameScore += 20;
        });

        let parseHits = 0;
        let aggregateHits = 0;
        let nonEmpty = 0;
        sample.forEach(row => {
          const cell = row ? row[alias] : null;
          const parsed = this._parseItrPeriodFromCell(cell);
          if (this._cellText(cell)) nonEmpty += 1;
          if (!parsed) return;
          parseHits += 1;
          if (parsed.kind !== "month") aggregateHits += 1;
        });

        const parseScore = (parseHits * 3) + (aggregateHits * 2) + (nonEmpty > 0 ? Math.round((parseHits / nonEmpty) * 40) : 0);
        const score = nameScore + parseScore;
        if (score > bestScore) {
          bestScore = score;
          bestAlias = alias;
        }
      });

      return bestScore > 0 ? bestAlias : "";
    },


    _extractItrPeriodFromRow(row, preferredAlias, dimensionAliases) {
      if (preferredAlias) {
        const parsed = this._parseItrPeriodFromCell(row ? row[preferredAlias] : null);
        if (parsed) return parsed;
      }
      for (const alias of dimensionAliases || []) {
        if (alias === preferredAlias) continue;
        const parsed = this._parseItrPeriodFromCell(row ? row[alias] : null);
        if (parsed) return parsed;
      }
      return null;
    },


    _extractItrCutoffPeriodFromRow(row, preferredAlias, dimensionAliases) {
      const descriptor = this._extractItrPeriodFromRow(row, preferredAlias, dimensionAliases);
      return descriptor ? this._buildPeriod(descriptor.year, descriptor.cutoffMonth) : null;
    },


    _parseItrPeriodFromCell(cell) {
      const texts = this._cellCandidates(cell);
      for (const original of texts) {
        const raw = String(original || "").trim();
        if (!raw) continue;
        const normalized = this._normalize(raw).replace(/\s+/g, "");
        let match = normalized.match(/(?:^|[^A-Z0-9])([1-4])[TQ][-/.]?((?:19|20)?[0-9]{2})(?:[^A-Z0-9]|$)/);
        if (match) {
          const quarter = Number(match[1]);
          const year = this._expandItrYear(match[2]);
          if (year) {
            return {
              key: `Q:${year}:${quarter}`,
              kind: "quarter",
              year,
              quarter,
              cutoffMonth: quarter * 3,
              label: raw,
              sort: (year * 100) + (quarter * 3)
            };
          }
        }

        match = normalized.match(/(?:^|[^A-Z0-9])([12])S[-/.]?((?:19|20)?[0-9]{2})(?:[^A-Z0-9]|$)/);
        if (match) {
          const semester = Number(match[1]);
          const year = this._expandItrYear(match[2]);
          const cutoffMonth = semester * 6;
          if (year) {
            return {
              key: `YTD:${year}:${cutoffMonth}`,
              kind: "ytd",
              year,
              cutoffMonth,
              label: raw,
              sort: (year * 100) + cutoffMonth
            };
          }
        }

        match = normalized.match(/(?:^|[^A-Z0-9])9M[-/.]?((?:19|20)?[0-9]{2})(?:[^A-Z0-9]|$)/);
        if (match) {
          const year = this._expandItrYear(match[1]);
          if (year) {
            return {
              key: `YTD:${year}:9`,
              kind: "ytd",
              year,
              cutoffMonth: 9,
              label: raw,
              sort: (year * 100) + 9
            };
          }
        }

        match = normalized.match(/^(?:FY)?((?:19|20)[0-9]{2})$/);
        if (match) {
          const year = Number(match[1]);
          return {
            key: `YTD:${year}:12`,
            kind: "ytd",
            year,
            cutoffMonth: 12,
            label: raw,
            sort: (year * 100) + 12
          };
        }

      }
      const monthly = this._parsePeriodFromCell(cell);
      if (monthly) {
        return {
          key: `M:${monthly.year}:${String(monthly.month).padStart(2, "0")}`,
          kind: "month",
          year: monthly.year,
          month: monthly.month,
          cutoffMonth: monthly.month,
          label: monthly.label,
          sort: monthly.sort
        };
      }
      return null;
    },


    _expandItrYear(value) {
      const token = String(value == null ? "" : value).replace(/[^0-9]/g, "");
      if (/^(?:19|20)[0-9]{2}$/.test(token)) return Number(token);
      if (/^[0-9]{2}$/.test(token)) return 2000 + Number(token);
      return 0;
    },


    _collectItrCutoffPeriodsFromDimensionMeta(meta) {
      const periods = [];
      const visited = new Set();
      const visit = value => {
        if (value == null) return;
        if (typeof value !== "object") {
          const descriptor = this._parseItrPeriodFromCell(value);
          if (descriptor) periods.push(this._buildPeriod(descriptor.year, descriptor.cutoffMonth));
          return;
        }
        if (visited.has(value)) return;
        visited.add(value);
        const direct = this._parseItrPeriodFromCell(value);
        if (direct) periods.push(this._buildPeriod(direct.year, direct.cutoffMonth));
        if (Array.isArray(value)) {
          value.forEach(visit);
          return;
        }
        ["members", "memberInfos", "availableMembers", "values", "items", "children", "hierarchy", "nodes"].forEach(key => {
          const child = value[key];
          if (Array.isArray(child)) child.forEach(visit);
          else if (child && typeof child === "object") Object.keys(child).forEach(itemKey => visit(child[itemKey]));
        });
      };
      visit(meta);
      return periods.filter(Boolean);
    },


    _resolveItrScenarioDisplayValue(scenarioBucket, formatConfig) {
      if (!scenarioBucket) return null;
      const measureToken = formatConfig && formatConfig.measureToken
        ? formatConfig.measureToken
        : DEFAULT_MEASURE_TOKEN;
      if (measureToken === DEFAULT_MEASURE_TOKEN) {
        return Number.isFinite(scenarioBucket.total) ? scenarioBucket.total : null;
      }
      const byMeasure = scenarioBucket.byMeasure instanceof Map
        ? scenarioBucket.byMeasure
        : new Map();
      if (!byMeasure.has(measureToken)) return null;
      const value = byMeasure.get(measureToken);
      return Number.isFinite(value) ? value : null;
    },


    _buildOverviewItrDrilldownView(params) {
      // Share parsing and formats only within this data build, never across SAC updates.
      const input = { ...params, _itrRowFacts: new WeakMap(), _itrFormats: new Map() };
      const defaultExpandedKeys = new Set();
      this._defaultExpandedDrilldownKeys = defaultExpandedKeys;
      const baseView = this._buildOverviewItrView(input);
      const reservedAliases = new Set([
        input.periodAlias,
        input.scenarioAlias,
        input.measureDimAlias
      ].map(alias => String(alias || "").trim()).filter(Boolean));
      if (baseView.state !== "ok") {
        return {
          ...baseView,
          mode: "overview_itr_d"
        };
      }

      const dimensionAliases = Array.isArray(input.dimensionAliases) ? input.dimensionAliases : [];
      const dimensionsMeta = input.dimensionsMeta || {};
      const legacyAlias = this._resolveDimensionAlias(
        input.rowDimensionAlias,
        dimensionAliases,
        dimensionsMeta
      );
      const accountDimensionAliases = new Map();
      const accountIdsByDimension = new Map();
      (baseView.rows || []).forEach(row => {
        if (!row || row.isOverviewSubordinate || row.isCalculatedIndicator || !row.accountId) return;
        const configuredAlias = String(
          row.formatConfig && row.formatConfig.itrDrilldownDimensionAlias || ""
        ).trim();
        if (configuredAlias === "__NONE__") return;
        const resolvedAlias = this._resolveDimensionAlias(
          configuredAlias || legacyAlias,
          dimensionAliases,
          dimensionsMeta
        );
        if (!resolvedAlias || reservedAliases.has(resolvedAlias)) return;
        const accountId = String(row.accountId);
        accountDimensionAliases.set(accountId, resolvedAlias);
        if (!accountIdsByDimension.has(resolvedAlias)) accountIdsByDimension.set(resolvedAlias, new Set());
        accountIdsByDimension.get(resolvedAlias).add(accountId);
      });

      const emptyCalculatedCatalog = { items: [], byId: new Map() };
      const childrenByAccountId = new Map();
      accountIdsByDimension.forEach((accountIds, rowDimensionAlias) => {
        const groups = new Map();
        (Array.isArray(input.rows) ? input.rows : []).forEach(sourceRow => {
          const cell = sourceRow ? sourceRow[rowDimensionAlias] : null;
          const memberId = this._cellId(cell);
          const memberLabel = this._cellLabel(cell) || this._cellText(cell) || memberId;
          const memberKey = this._normalize(memberId || memberLabel) || "__UNASSIGNED__";
          if (!groups.has(memberKey)) {
            groups.set(memberKey, {
              key: memberKey,
              label: String(memberLabel || "(Sem membro)").trim() || "(Sem membro)",
              rows: []
            });
          }
          groups.get(memberKey).rows.push(sourceRow);
        });

        const accountMembers = (input.accountMembers || []).filter(member => (
          member && accountIds.has(String(member.id))
        ));
        groups.forEach(group => {
          const childView = this._buildOverviewItrView({
            ...input,
            rows: group.rows,
            accountMembers,
            weightAccountMembers: input.accountMembers,
            cube: new Map(),
            formulaCube: new Map(),
            calculatedCatalog: emptyCalculatedCatalog,
            _itrChildRowsOnly: true
          });
          (childView.rows || []).forEach(childRow => {
            if (!childRow || childRow.isOverviewSubordinate || childRow.isCalculatedIndicator) return;
            const accountId = String(childRow.accountId || "").trim();
            if (!accountIds.has(accountId) || !(childRow.values || []).some(value => Number.isFinite(value))) return;
            if (!childrenByAccountId.has(accountId)) childrenByAccountId.set(accountId, []);
            childrenByAccountId.get(accountId).push({
              group: { key: group.key, label: group.label }, row: childRow, rowDimensionAlias
            });
          });
        });
      });

      const projectRows = () => {
        const expandedKeys = this._overview2ExpandedKeys instanceof Set
          ? this._overview2ExpandedKeys
          : new Set();
        const collapsedKeys = this._overview2CollapsedKeys instanceof Set
          ? this._overview2CollapsedKeys
          : new Set();
        const rowsOut = [];
        (baseView.rows || []).forEach(row => {
          if (!row || row.isOverviewSubordinate || row.isCalculatedIndicator || !row.accountId) {
            rowsOut.push(row);
            return;
          }
          const accountId = String(row.accountId);
          const rowDimensionAlias = accountDimensionAliases.get(accountId) || "";
          if (!rowDimensionAlias) {
            rowsOut.push(row);
            return;
          }
          const children = childrenByAccountId.get(accountId) || [];
          const drilldownKey = `itr-d:${accountId}:${this._normalize(rowDimensionAlias)}`;
          const expandsOnRefresh = this._normalizeBoolean(
            row.formatConfig && row.formatConfig.itrDrilldownExpanded
          );
          if (expandsOnRefresh) defaultExpandedKeys.add(drilldownKey);
          const isExpanded = children.length > 0 && (
            expandedKeys.has(drilldownKey) ||
            (expandsOnRefresh && !collapsedKeys.has(drilldownKey))
          );
          rowsOut.push({
            ...row,
            drilldownKey,
            drilldownLevel: 0,
            hasChildren: children.length > 0,
            isExpanded
          });
          if (!isExpanded) return;
          children.forEach(({ group, row: childRow }) => {
            rowsOut.push({
              ...childRow,
              account: group.label,
              rowKey: `${drilldownKey}::${group.key}`,
              parentAccountId: accountId,
              isItrDimensionChild: true,
              drilldownLevel: 1,
              hasChildren: false,
              isExpanded: false
            });
          });
        });

        return rowsOut;
      };

      const accountDimensionAliasesOutput = {};
      accountDimensionAliases.forEach((alias, accountId) => {
        accountDimensionAliasesOutput[accountId] = alias;
      });

      return {
        ...baseView,
        mode: "overview_itr_d",
        accountDimensionAliases: accountDimensionAliasesOutput,
        rows: projectRows(),
        _projectRows: projectRows
      };
    },


    _buildOverviewItrView(params) {
      const input = params || {};
      const monthlyLayout = input.itrLayout === "monthly" && !input.bpOpeningPeriod;
      const rows = Array.isArray(input.rows) ? input.rows : [];
      const accountMembers = Array.isArray(input.accountMembers) ? input.accountMembers : [];
      const accountAliases = Array.isArray(input.accountAliases) ? input.accountAliases : [];
      const dimensionAliases = Array.isArray(input.dimensionAliases) ? input.dimensionAliases : [];
      const measureAliases = Array.isArray(input.measureAliases) ? input.measureAliases : [];
      const rules = input.rules || { entries: [] };
      let selectedYear = Number(input.selectedYear || 0);
      const selectedMonth = Number(input.selectedMonth || 0);
      let selectedQuarter = Math.floor(selectedMonth / 3);
      if (selectedQuarter < 1) {
        selectedQuarter = 4;
        selectedYear -= 1;
      }
      const accountMode = input.accountMode || "rows";
      const periodAlias = input.periodAlias || "";
      const measureDimAlias = input.measureDimAlias || "";
      const scenarioResolver = input.scenarioResolver || { resolve: () => "actual" };
      const fallbackCube = input.cube instanceof Map ? input.cube : new Map();
      const formulaFallbackCube = input.formulaCube instanceof Map ? input.formulaCube : fallbackCube;
      const accountLookup = input.accountLookup instanceof Map
        ? input.accountLookup
        : this._buildAccountLookup(accountMembers);
      const calculatedCatalog = input.calculatedCatalog || this._readCalculatedIndicatorCatalog("");
      const matrix = new Map();
      const labels = new Map();
      const rowFacts = input._itrRowFacts;
      const formats = input._itrFormats || (input.bpOpeningPeriod ? new Map() : null);
      const resolveFormat = member => {
        if (formats && formats.has(member.id)) return formats.get(member.id);
        const format = this._normalizeDisplayFormat(this._resolveMeasureRuleForAccount(member, rules));
        if (formats) formats.set(member.id, format);
        return format;
      };
      const bpCompanies = input.bpOpeningPeriod && !input.bpUngrouped
        ? this._prepareBalanceSheetCompanies(input, accountMembers, resolveFormat, selectedYear, selectedQuarter) : null;

      const ensureBucket = (accountId, periodKey) => {
        if (!matrix.has(accountId)) matrix.set(accountId, new Map());
        const accountPeriods = matrix.get(accountId);
        if (!accountPeriods.has(periodKey)) accountPeriods.set(periodKey, this._createScenarioBucket());
        return accountPeriods.get(periodKey);
      };
      const addValue = (member, descriptor, measureToken, value, row) => {
        if (!member || !descriptor || value == null || !Number.isFinite(value)) return;
        const bucket = ensureBucket(member.id, descriptor.key);
        const tokenKey = measureToken || DEFAULT_MEASURE_TOKEN;
        bucket.total += value;
        bucket.byMeasure.set(tokenKey, (bucket.byMeasure.get(tokenKey) || 0) + value);
        if (bpCompanies) this._addBalanceSheetCompanyValue(bpCompanies, member.id, row, descriptor, tokenKey, value);
        if (!labels.has(descriptor.key)) labels.set(descriptor.key, descriptor.label);
      };

      rows.forEach(row => {
        let facts = rowFacts && rowFacts.get(row);
        if (!facts) {
          facts = {
            descriptor: this._extractItrPeriodFromRow(row, periodAlias, dimensionAliases),
            scenarioRole: scenarioResolver.resolve(row),
            measureToken: this._extractMeasureToken(row, measureDimAlias) || DEFAULT_MEASURE_TOKEN
          };
          if (rowFacts && row && typeof row === "object") rowFacts.set(row, facts);
        }
        const { descriptor, scenarioRole, measureToken } = facts;
        if (!descriptor) return;
        if (input.bpOpeningPeriod && descriptor.kind !== "month") return;
        if (scenarioRole !== "actual") return;

        if (accountMode === "rows") {
          const member = this._resolveRowAccountMember(row, accountMembers, accountAliases);
          if (!member) return;
          const value = this._readRowNumericValue(row, measureAliases, dimensionAliases, accountAliases);
          addValue(member, descriptor, measureToken, value, row);
          return;
        }

        accountMembers.forEach(member => {
          const value = this._toNumber(this._cellNumeric(row[member.alias]));
          addValue(member, descriptor, measureToken, value, row);
        });
      });

      const previousQuarter = selectedQuarter === 1 ? 4 : selectedQuarter - 1;
      const previousQuarterYear = selectedQuarter === 1 ? selectedYear - 1 : selectedYear;
      const previousYear = selectedYear - 1;
      const cutoffMonth = selectedQuarter * 3;
      const targetKeys = {
        currentItr: `Q:${selectedYear}:${selectedQuarter}`,
        previousItr: `Q:${previousQuarterYear}:${previousQuarter}`,
        priorYearItr: `Q:${previousYear}:${selectedQuarter}`,
        currentYtd: selectedQuarter === 1 ? `Q:${selectedYear}:1` : `YTD:${selectedYear}:${cutoffMonth}`,
        priorYearYtd: selectedQuarter === 1 ? `Q:${previousYear}:1` : `YTD:${previousYear}:${cutoffMonth}`
      };
      const canonicalLabel = (kind, year, quarter) => {
        const shortYear = String(year).slice(-2);
        if (kind === "quarter") return `${quarter}T${shortYear}`;
        if (quarter === 1) return `1T${shortYear}`;
        if (quarter === 2) return `1S${shortYear}`;
        if (quarter === 3) return `9M${shortYear}`;
        return String(year);
      };
      const monthlyColumns = monthlyLayout ? this._itrMonthlyColumns(input.selectedYear, input.selectedMonth) : null;
      const columns = monthlyLayout ? monthlyColumns : [
        { key: "currentItr", type: "value", isCurrentPeriod: true, semanticLabel: "ITR Atual", memberLabel: labels.get(targetKeys.currentItr) || canonicalLabel("quarter", selectedYear, selectedQuarter) },
        { key: "previousItr", type: "value", semanticLabel: "ITR Anterior", memberLabel: labels.get(targetKeys.previousItr) || canonicalLabel("quarter", previousQuarterYear, previousQuarter) },
        { key: "deltaPreviousItr", type: "delta_pct", semanticLabel: "Delta ITR", memberLabel: "Δ%" },
        { key: "priorYearItr", type: "value", semanticLabel: "ITR Atual (Ano Anterior)", memberLabel: labels.get(targetKeys.priorYearItr) || canonicalLabel("quarter", previousYear, selectedQuarter) },
        { key: "deltaPriorYearItr", type: "delta_pct", semanticLabel: "Delta Ano Anterior", memberLabel: "Δ%" },
        { key: "currentYtd", type: "value", isCurrentPeriod: true, semanticLabel: "Acumulado YTD Atual", memberLabel: labels.get(targetKeys.currentYtd) || canonicalLabel("ytd", selectedYear, selectedQuarter) },
        { key: "priorYearYtd", type: "value", semanticLabel: "Acumulado YTD Ano Anterior", memberLabel: labels.get(targetKeys.priorYearYtd) || canonicalLabel("ytd", previousYear, selectedQuarter) },
        { key: "deltaYtd", type: "delta_pct", semanticLabel: "Delta YTD", memberLabel: "Δ%" }
      ];
      const valueColumns = monthlyLayout ? monthlyColumns : [
        {
          key: "currentItr",
          targetKind: "quarter",
          year: selectedYear,
          quarter: selectedQuarter,
          startMonth: (selectedQuarter * 3) - 2,
          endMonth: selectedQuarter * 3,
          exactKey: targetKeys.currentItr
        },
        {
          key: "previousItr",
          targetKind: "quarter",
          year: previousQuarterYear,
          quarter: previousQuarter,
          startMonth: (previousQuarter * 3) - 2,
          endMonth: previousQuarter * 3,
          exactKey: targetKeys.previousItr
        },
        {
          key: "priorYearItr",
          targetKind: "quarter",
          year: previousYear,
          quarter: selectedQuarter,
          startMonth: (selectedQuarter * 3) - 2,
          endMonth: selectedQuarter * 3,
          exactKey: targetKeys.priorYearItr
        },
        {
          key: "currentYtd",
          targetKind: "ytd",
          year: selectedYear,
          quarter: selectedQuarter,
          startMonth: 1,
          endMonth: cutoffMonth,
          exactKey: targetKeys.currentYtd
        },
        {
          key: "priorYearYtd",
          targetKind: "ytd",
          year: previousYear,
          quarter: selectedQuarter,
          startMonth: 1,
          endMonth: cutoffMonth,
          exactKey: targetKeys.priorYearYtd
        }
      ];
      if (input.bpOpeningPeriod) {
        if (input.bpUngrouped) return this._buildBalanceSheetFreeView({
          input, matrix, accountMembers, resolveFormat, columns, valueColumns, selectedQuarter, selectedYear
        });
        return this._buildBalanceSheetQuarterlyView({
          input, matrix, bpCompanies, accountMembers, resolveFormat, columns, valueColumns, selectedQuarter, selectedYear
        });
      }
      const weights = this._createAverageWeightResolver({ ...input, weightItrPeriods: true }, row =>
        !input.scenarioResolver || input.scenarioResolver.resolve(row) === "actual" ? "actual" : null);
      const valueColumnByKey = new Map(valueColumns.map(column => [column.key, column]));
      const monthlyPeriodKeys = target => {
        const keys = [];
        for (let month = target.startMonth; month <= target.endMonth; month += 1) {
          keys.push(String(target.year) + "-" + String(month).padStart(2, "0"));
        }
        return keys;
      };
      const calculatedPeriodKeys = new Map(
        valueColumns.map(column => [column.key, new Set(monthlyPeriodKeys(column))])
      );

      const resolveExact = (accountPeriods, key, formatConfig) => {
        const bucket = accountPeriods ? accountPeriods.get(key) : null;
        if (!bucket) return null;
        const value = this._resolveItrScenarioDisplayValue(bucket, formatConfig);
        return Number.isFinite(value) ? value : null;
      };
      const resolveMonthly = (accountId, accountPeriods, year, startMonth, endMonth, formatConfig) => {
        const values = new Map();
        const fallbackAccount = fallbackCube.get(accountId);
        for (let month = startMonth; month <= endMonth; month += 1) {
          const key = `M:${year}:${String(month).padStart(2, "0")}`;
          let value = resolveExact(accountPeriods, key, formatConfig);
          if (!monthlyLayout && !Number.isFinite(value) && fallbackAccount && fallbackAccount.periods) {
            const periodKey = `${year}-${String(month).padStart(2, "0")}`;
            const periodBucket = fallbackAccount.periods.get(periodKey);
            value = periodBucket
              ? this._resolveItrScenarioDisplayValue(periodBucket.actual, formatConfig)
              : null;
          }
          if (!Number.isFinite(value)) continue;
          values.set(`${year}-${String(month).padStart(2, "0")}`, value);
        }
        return values.size ? this._aggregateMonthlyValues(values, formatConfig, weights) : null;
      };
      const resolveQuarter = (accountId, accountPeriods, year, quarter, formatConfig) => {
        const mode = (formatConfig && formatConfig.ytdMode) || "default";
        const endMonth = quarter * 3;
        const monthly = resolveMonthly(accountId, accountPeriods, year, endMonth - 2, endMonth, formatConfig);
        if (Number.isFinite(monthly)) return monthly;
        if (mode === "default") {
          const exact = resolveExact(accountPeriods, `Q:${year}:${quarter}`, formatConfig);
          if (Number.isFinite(exact)) return exact;
        }
        return null;
      };
      const resolveYtd = (accountId, accountPeriods, year, quarter, formatConfig) => {
        const monthLimit = quarter * 3;
        const mode = (formatConfig && formatConfig.ytdMode) || "default";
        const monthly = resolveMonthly(accountId, accountPeriods, year, 1, monthLimit, formatConfig);
        if (Number.isFinite(monthly)) return monthly;
        if (mode === "default") {
          const exactKey = quarter === 1 ? `Q:${year}:1` : `YTD:${year}:${monthLimit}`;
          const exact = resolveExact(accountPeriods, exactKey, formatConfig);
          if (Number.isFinite(exact)) return exact;
        }
        return null;
      };
      const deltaPct = (current, comparison) => {
        if (!Number.isFinite(current) || !Number.isFinite(comparison)) return null;
        return this._safePct(current - comparison, comparison);
      };

      const resolveFormulaAccountId = token => {
        const split = this._splitOperandValue(token && token.value);
        const accountToken = this._normalize(
          (token && (token.accountId || split.accountId || token.accountLabel)) || ""
        );
        const resolved = accountLookup.get(accountToken);
        return typeof resolved === "string"
          ? resolved
          : (resolved && resolved.id ? String(resolved.id) : "");
      };
      const resolveFormulaMeasureToken = token => {
        const split = this._splitOperandValue(token && token.value);
        return this._normalize(
          (token && (token.measureId || split.measureId || token.measureLabel)) || ""
        );
      };
      const resolveFormulaScenarioBucket = (accountId, periodKey) => {
        const accountPeriods = matrix.get(accountId);
        const monthly = this._periodFromKey(periodKey);
        const matrixKey = monthly
          ? "M:" + monthly.year + ":" + String(monthly.month).padStart(2, "0")
          : periodKey;
        const matrixBucket = accountPeriods ? accountPeriods.get(matrixKey) : null;
        if (matrixBucket) return matrixBucket;
        if (!monthly || monthlyLayout) return null;
        const accountNode = formulaFallbackCube.get(accountId);
        const periodBucket = accountNode && accountNode.periods
          ? accountNode.periods.get(periodKey)
          : null;
        return periodBucket ? periodBucket.actual : null;
      };
      const resolveFormulaPeriodValue = (token, column, periodKey, formatConfig) => {
        if (!token || token.type !== "measure") {
          return this._createFormulaError("MISSING_OPERAND", "Conta/medida nao encontrada");
        }
        const accountId = resolveFormulaAccountId(token);
        if (!accountId) {
          return this._createFormulaError("MISSING_OPERAND", "Conta/medida nao encontrada");
        }
        const bucket = resolveFormulaScenarioBucket(accountId, periodKey);
        return this._resolveScenarioBucketMeasureValue(
          bucket,
          resolveFormulaMeasureToken(token),
          token,
          formatConfig
        );
      };
      const formulaHasPeriodCoverage = (item, column, periodKey, visited) => {
        if (!item || !periodKey) return false;
        const trail = visited instanceof Set ? new Set(visited) : new Set();
        if (trail.has(item.id)) return false;
        trail.add(item.id);
        const tokens = item.formula && Array.isArray(item.formula.tokens)
          ? item.formula.tokens
          : [];
        let hasOperand = false;
        for (const token of tokens) {
          if (!token) continue;
          if (token.type === "measure") {
            hasOperand = true;
            const result = resolveFormulaPeriodValue(
              token,
              column,
              periodKey,
              this._calculatedIndicatorFormat(item)
            );
            if (!result || result.ok !== true || !Number.isFinite(result.value)) return false;
          } else if (token.type === "calculated") {
            hasOperand = true;
            const dependencyId = String(token.calculatedId || token.value || "");
            const dependency = calculatedCatalog.byId instanceof Map
              ? calculatedCatalog.byId.get(dependencyId)
              : null;
            if (!formulaHasPeriodCoverage(dependency, column, periodKey, trail)) return false;
          }
        }
        return hasOperand;
      };
      const formulaHasExactCoverage = (item, column) => {
        const target = valueColumnByKey.get(column.key);
        return !!(target && target.exactKey && formulaHasPeriodCoverage(item, column, target.exactKey));
      };
      const formulaHasMonthlyCoverage = (item, column) => {
        const target = valueColumnByKey.get(column.key);
        return !!(target && monthlyPeriodKeys(target).some(periodKey => (
          formulaHasPeriodCoverage(item, column, periodKey)
        )));
      };
      const resolveCalculatedPeriodKeys = (item, column) => {
        const target = valueColumnByKey.get(column.key);
        if (!target) return [];
        const monthlyKeys = monthlyPeriodKeys(target);
        if (formulaHasMonthlyCoverage(item, column)) return monthlyKeys;
        const mode = this._normalizeYtdMode(item && item.ytdMode);
        if (mode === "default" && formulaHasExactCoverage(item, column)) return [target.exactKey];
        return monthlyKeys;
      };
      const resolveCalculatedPeriodInfo = (periodKey, column) => {
        const monthly = this._periodFromKey(periodKey);
        if (monthly) return monthly;
        const target = valueColumnByKey.get(column.key);
        if (!target || target.exactKey !== periodKey) return null;
        return { year: target.year, month: target.endMonth, weight: 1 };
      };
      const resolveAggregatedFormulaOperand = (token, column, periodKeys, coverageByOperand) => {
        if (!token || token.type !== "measure") {
          return this._createFormulaError("MISSING_OPERAND", "Conta/medida nao encontrada");
        }
        const accountId = resolveFormulaAccountId(token);
        const target = valueColumnByKey.get(column.key);
        if (!accountId || !target) {
          return this._createFormulaError("MISSING_OPERAND", "Conta/medida nao encontrada");
        }
        const accountNode = formulaFallbackCube.get(accountId);
        const member = accountMembers.find(item => item && String(item.id) === accountId);
        const accountFormat = this._normalizeDisplayFormat(this._resolveMeasureRuleForAccount({
          id: accountId,
          label: (member && member.label) || (accountNode && accountNode.label) || accountId,
          alias: (member && member.alias) || accountId
        }, rules));
        const measureToken = resolveFormulaMeasureToken(token) || accountFormat.measureToken || "";
        const operandFormat = this._normalizeDisplayFormat({
          ...accountFormat,
          measureToken,
          subordinateMeasureToken: ""
        });
        const accountPeriods = matrix.get(accountId) || new Map();
        const value = target.targetKind === "month"
          ? resolveMonthly(accountId, accountPeriods, target.year, target.startMonth, target.endMonth, operandFormat)
          : target.targetKind === "quarter"
          ? resolveQuarter(accountId, accountPeriods, target.year, target.quarter, operandFormat)
          : resolveYtd(accountId, accountPeriods, target.year, target.quarter, operandFormat);
        if (!Number.isFinite(value)) {
          return this._averageValueResult(value, operandFormat);
        }

        const coveredPeriods = [];
        const mode = this._normalizeYtdMode(operandFormat.ytdMode);
        monthlyPeriodKeys(target).forEach(periodKey => {
          const result = resolveFormulaPeriodValue(token, column, periodKey, operandFormat);
          if (result && result.ok === true && Number.isFinite(result.value)) {
            coveredPeriods.push(periodKey);
          }
        });
        if (!coveredPeriods.length && mode === "default") {
          const exactResult = resolveFormulaPeriodValue(token, column, target.exactKey, operandFormat);
          if (exactResult && exactResult.ok === true && Number.isFinite(exactResult.value)) {
            coveredPeriods.push(target.exactKey);
          }
        }
        if (!coveredPeriods.length) coveredPeriods.push(target.exactKey);
        this._recordFormulaOperandCoverage(coverageByOperand, token, coveredPeriods);
        return this._createFormulaSuccess(value);
      };

      const rowsOut = [];
      accountMembers.forEach(member => {
        const formatConfig = resolveFormat(member);
        if (formatConfig.hidden) return;
        const accountPeriods = matrix.get(member.id) || new Map();
        if (monthlyLayout) {
          rowsOut.push({
            accountId: member.id, rowKey: `${member.id}::main`,
            account: formatConfig.itrDisplayLabel || member.label, formatConfig,
            values: valueColumns.map(column => resolveMonthly(member.id, accountPeriods, column.year, column.startMonth, column.endMonth, formatConfig))
          });
          return;
        }
        const currentItr = resolveQuarter(member.id, accountPeriods, selectedYear, selectedQuarter, formatConfig);
        const previousItr = resolveQuarter(member.id, accountPeriods, previousQuarterYear, previousQuarter, formatConfig);
        const priorYearItr = resolveQuarter(member.id, accountPeriods, previousYear, selectedQuarter, formatConfig);
        const currentYtd = resolveYtd(member.id, accountPeriods, selectedYear, selectedQuarter, formatConfig);
        const priorYearYtd = resolveYtd(member.id, accountPeriods, previousYear, selectedQuarter, formatConfig);
        rowsOut.push({
          accountId: member.id,
          rowKey: `${member.id}::main`,
          account: formatConfig.itrDisplayLabel || member.label,
          formatConfig,
          values: [
            currentItr,
            previousItr,
            deltaPct(currentItr, previousItr),
            priorYearItr,
            deltaPct(currentItr, priorYearItr),
            currentYtd,
            priorYearYtd,
            deltaPct(currentYtd, priorYearYtd)
          ]
        });
      });

      // Drilldown children use only account rows, not a second calculated catalog or totals.
      if (input._itrChildRowsOnly) return { rows: rowsOut };

      const baseRowsForCalculation = monthlyLayout ? rowsOut : rowsOut.map(row => ({
        ...row,
        values: [row.values[0], row.values[1], row.values[3], row.values[5], row.values[6]]
      }));
      const calculatedRows = this._buildCalculatedOverviewRows({
        catalog: calculatedCatalog,
        columns: valueColumns,
        columnPeriodKeys: calculatedPeriodKeys,
        baseRows: baseRowsForCalculation,
        resolveColumnPeriodKeys: resolveCalculatedPeriodKeys,
        resolvePeriodInfo: resolveCalculatedPeriodInfo,
        resolveMeasurePeriod: resolveFormulaPeriodValue,
        resolveMeasureAggregate: resolveAggregatedFormulaOperand,
        resolveWeight: (format, key) => weights(format, key),
        rowOrder: input.rowOrder
      });
      const expandCalculatedRow = row => {
        const sourceValues = Array.isArray(row && row.values) ? row.values : [];
        const sourceErrors = Array.isArray(row && row.cellErrors) ? row.cellErrors : null;
        const expanded = {
          ...row,
          values: [
            sourceValues[0],
            sourceValues[1],
            deltaPct(sourceValues[0], sourceValues[1]),
            sourceValues[2],
            deltaPct(sourceValues[0], sourceValues[2]),
            sourceValues[3],
            sourceValues[4],
            deltaPct(sourceValues[3], sourceValues[4])
          ]
        };
        if (sourceErrors) {
          expanded.cellErrors = [
            sourceErrors[0] || null,
            sourceErrors[1] || null,
            sourceErrors[0] || sourceErrors[1] || null,
            sourceErrors[2] || null,
            sourceErrors[0] || sourceErrors[2] || null,
            sourceErrors[3] || null,
            sourceErrors[4] || null,
            sourceErrors[3] || sourceErrors[4] || null
          ];
        }
        return expanded;
      };
      const rowsWithCalculated = monthlyLayout ? calculatedRows : calculatedRows.map(expandCalculatedRow);

      const totalAt = index => rowsWithCalculated.some(row => !row.isOverviewSubordinate && !row.isCalculatedIndicator && OnePagerAverageWeights.custom(row.formatConfig) && row.values[index] === null) ? null : rowsWithCalculated.reduce((sum, row) => {
        if (row && (row.isOverviewSubordinate || row.isCalculatedIndicator)) return sum;
        const value = row && Array.isArray(row.values) ? row.values[index] : null;
        return Number.isFinite(value) ? sum + value : sum;
      }, 0);
      const totalCurrentItr = totalAt(0);
      const totalPreviousItr = totalAt(1);
      const totalPriorYearItr = totalAt(3);
      const totalCurrentYtd = totalAt(5);
      const totalPriorYearYtd = totalAt(6);
      const totals = monthlyLayout ? columns.map((_, index) => totalAt(index)) : [
        totalCurrentItr,
        totalPreviousItr,
        deltaPct(totalCurrentItr, totalPreviousItr),
        totalPriorYearItr,
        deltaPct(totalCurrentItr, totalPriorYearItr),
        totalCurrentYtd,
        totalPriorYearYtd,
        deltaPct(totalCurrentYtd, totalPriorYearYtd)
      ];

      return {
        mode: "overview_itr",
        ...(monthlyLayout ? { columnLayout: "monthly" } : {}),
        state: rowsWithCalculated.length ? "ok" : "empty",
        message: rowsWithCalculated.length ? "" : "Sem dados ITR para a data base selecionada.",
        columns,
        rows: rowsWithCalculated,
        totals,
        totalFormat: this._deriveTotalFormat(
          rowsWithCalculated.filter(row => !(row && (row.isOverviewSubordinate || row.isCalculatedIndicator)))
        ),
        selectedQuarter,
        selectedYear,
        targetKeys
      };
    }
  };
  const OnePagerBalanceSheetModule = {
    _buildBalanceSheetQuarterlyView(params) {
      const valueColumns = Array.from({ length: 5 }, (_, offset) => {
        const ordinal = params.selectedYear * 4 + params.selectedQuarter - 1 - offset;
        const year = Math.floor(ordinal / 4);
        const quarter = ordinal % 4 + 1;
        return {
          key: `balance_${year}_${quarter}`, type: "value", year, quarter, endMonth: quarter * 3,
          memberLabel: `${quarter}T${String(year).slice(-2)}`,
          semanticLabel: offset === 0 ? "Saldo no ITR atual" : `Saldo no ITR -${offset}`,
          isCurrentPeriod: offset === 0
        };
      });
      const columns = [
        valueColumns[0],
        { key: "deltaPreviousItr", type: "delta_pct", memberLabel: "\u0394%",
          currentBalanceKey: valueColumns[0].key, comparisonBalanceKey: valueColumns[1].key,
          semanticLabel: `${valueColumns[0].memberLabel} contra ${valueColumns[1].memberLabel}` },
        ...valueColumns.slice(1),
        { key: "deltaPriorYearItr", type: "delta_pct", memberLabel: "\u0394%",
          currentBalanceKey: valueColumns[0].key, comparisonBalanceKey: valueColumns[4].key,
          semanticLabel: `${valueColumns[0].memberLabel} contra ${valueColumns[4].memberLabel}` }
      ];
      return this._buildBalanceSheetView({
        ...params, columns, valueColumns, balanceProjection: [0, [0, 1], 1, 2, 3, 4, [0, 4]]
      });
    },

    _projectBalanceSheetValues(balances, projection) {
      // Numbers select raw balances; pairs compare two of those same raw balances.
      return projection.map(source => {
        if (!Array.isArray(source)) return balances[source];
        const current = balances[source[0]], prior = balances[source[1]];
        return Number.isFinite(current) && Number.isFinite(prior)
          ? this._safePct(current - prior, prior) : null;
      });
    },

    _prepareBalanceSheetCompanies(input, accountMembers, resolveFormat, year, quarter) {
      const accounts = new Map();
      const reserved = new Set([input.periodAlias, input.scenarioAlias, input.measureDimAlias, ...(input.accountAliases || [])]);
      accountMembers.forEach(member => {
        const format = resolveFormat(member);
        if (!format.bpDynamicClassification || format.hidden) return;
        const alias = this._resolveDimensionAlias(format.bpCompanyDimensionAlias, input.dimensionAliases, input.dimensionsMeta);
        accounts.set(member.id, {
          alias, measure: format.measureToken || DEFAULT_MEASURE_TOKEN, companies: new Map(),
          error: !alias || reserved.has(alias) ? "Selecione uma dimensao Empresa valida no binding." : ""
        });
      });
      return accounts.size ? {
        accounts, openingSort: Number(input.bpOpeningPeriod.replace("-", "")), cutoffSort: year * 100 + quarter * 3
      } : null;
    },

    _addBalanceSheetCompanyValue(state, accountId, row, descriptor, measure, value) {
      const account = state.accounts.get(accountId);
      if (!account || account.error || (account.measure !== DEFAULT_MEASURE_TOKEN && account.measure !== measure)) return;
      const match = /^M:(\d{4}):(\d{2})$/.exec(descriptor.key);
      if (!match) return;
      const sort = Number(match[1]) * 100 + Number(match[2]);
      if (sort < state.openingSort || sort > state.cutoffSort) return;
      const company = this._cellId(row[account.alias]);
      if (!company) {
        account.error = "Ha valores sem identificacao de empresa no periodo.";
        return;
      }
      if (!account.companies.has(company)) account.companies.set(company, new Map());
      const months = account.companies.get(company);
      months.set(sort, (months.get(sort) ?? 0) + value);
    },

    _balanceSheetCompanyProjection(account, openingSort, sortedCutoffs, cutoffSorts) {
      if (account.error) return { error: account.error, parts: [] };
      const closing = new Map(sortedCutoffs.map(sort => [sort, { assets: 0, liabilities: 0, known: false }]));
      let missingOpening = !account.companies.size;
      for (const months of account.companies.values()) {
        if (!months.has(openingSort)) missingOpening = true;
        const monthly = [...months.entries()].sort((a, b) => a[0] - b[0]);
        let balance = 0;
        let index = 0;
        // Accumulate each company first; only then classify the closing balance.
        for (const cutoff of sortedCutoffs) {
          while (index < monthly.length && monthly[index][0] <= cutoff) balance += monthly[index++][1];
          if (cutoff < openingSort || !index) continue;
          if (!Number.isFinite(balance)) return { error: "Saldo por empresa fora do limite numerico.", parts: [] };
          const group = closing.get(cutoff);
          group.known = true;
          if (balance > 0) group.assets += balance;
          if (balance < 0) group.liabilities += balance;
        }
      }
      const parts = ["assets", "liabilities"].map(section => ({
        section, balances: cutoffSorts.map(sort => closing.get(sort).known ? closing.get(sort)[section] : null)
      })).filter(part => part.balances.some(value => Number.isFinite(value) && value !== 0));
      if ([...closing.values()].some(group => !Number.isFinite(group.assets) || !Number.isFinite(group.liabilities))) {
        return { error: "Total por natureza fora do limite numerico.", parts: [] };
      }
      return { parts, missingOpening };
    },

    _buildBalanceSheetTotals(rows, projection) {
      const groups = new Map();
      const balanceIndexes = [];
      projection.forEach((source, index) => {
        if (Number.isInteger(source)) balanceIndexes[source] = index;
      });
      rows.forEach(row => {
        if (!["assets", "liabilities", "equity"].includes(row.bpSection)) return;
        const keys = [row.bpSection];
        if (["current", "non_current"].includes(row.bpClassification)) keys.push(`${row.bpSection}:${row.bpClassification}`);
        keys.forEach(key => {
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push(row);
        });
      });
      const labels = {
        assets: "Total do Ativo", "assets:current": "Total do Ativo Circulante",
        "assets:non_current": "Total do Ativo Nao Circulante",
        liabilities: "Total do Passivo", "liabilities:current": "Total do Passivo Circulante",
        "liabilities:non_current": "Total do Passivo Nao Circulante",
        equity: "Total do Patrimonio Liquido"
      };
      const totals = {};
      groups.forEach((members, key) => {
        const first = members[0].formatConfig;
        const common = (field, fallback) => members.every(row => row.formatConfig[field] === first[field])
          ? first[field] : fallback;
        const sum = index => {
          let total = 0;
          let count = 0;
          members.forEach(row => {
            const value = row.values[index];
            if (!Number.isFinite(value)) return;
            total += value;
            count++;
          });
          return count && Number.isFinite(total) ? total : null;
        };
        // Only raw balances are additive. Percent deltas are recomputed from the totals.
        const balances = balanceIndexes.map(sum);
        totals[key] = {
          isBalanceSheetTotal: true,
          rowKey: `bp-total:${key}`,
          account: labels[key],
          bpSection: members[0].bpSection,
          bpTotalLevel: key.includes(":") ? "group" : "section",
          formatConfig: {
            ...DEFAULT_DISPLAY_FORMAT,
            scale: common("scale", DEFAULT_DISPLAY_FORMAT.scale),
            decimals: members.reduce((max, row) => Math.max(max, row.formatConfig.decimals), 0),
            itrDisplaySign: common("itrDisplaySign", "original"),
            deltaPolarity: common("deltaPolarity", DEFAULT_DISPLAY_FORMAT.deltaPolarity)
          },
          values: this._projectBalanceSheetValues(balances, projection)
        };
      });
      return totals;
    },

    _buildBalanceSheetScenarioResolver(rows, alias, config) {
      const selected = this._normalize(config.actualMember || "");
      if (!alias) return { resolve: () => selected ? "unknown" : "actual" };
      const candidates = cell => [this._cellId(cell), this._cellLabel(cell), this._cellText(cell)]
        .map(value => this._normalize(value)).filter(Boolean);
      const members = new Map();
      let selectedKey = selected;
      rows.forEach(row => {
        const cell = row[alias];
        const tokens = candidates(cell);
        const key = tokens[0];
        if (!key) return;
        if (selected && tokens.includes(selected)) selectedKey = key;
        if (!members.has(key)) members.set(key, {
          key, count: 0, label: this._cellLabel(cell) || this._cellText(cell),
          actual: this._classifyScenario(this._cellLabel(cell) || this._cellText(cell)) === "actual"
        });
        members.get(key).count += 1;
      });
      if (!selectedKey) {
        const ranked = [...members.values()].sort((a, b) => Number(b.actual) - Number(a.actual) || b.count - a.count);
        selectedKey = ranked[0]?.key || "";
      }
      return {
        resolve: row => candidates(row[alias])[0] === selectedKey ? "actual" : "unknown",
        actualLabel: members.get(selectedKey)?.label || config.actualLabel
      };
    },

    _buildBalanceSheetView({ input, matrix, bpCompanies, accountMembers, resolveFormat, columns, valueColumns, selectedQuarter, selectedYear,
      balanceValuesOnly = false, balanceProjection = [0, 1, [0, 1], 2, [0, 2], 3, 4, [3, 4]] }) {
      const openingPeriod = input.bpOpeningPeriod;
      const openingSort = Number(openingPeriod.replace("-", ""));
      const sectionLabels = {
        assets: "Ativo",
        liabilities: "Passivo",
        equity: "Patrimonio Liquido",
        unclassified: "A classificar"
      };
      const sections = new Map(Object.keys(sectionLabels).map(key => [key, []]));
      const missingOpening = [];
      const dynamicIssues = [];
      const cutoffSorts = valueColumns.map(column => column.year * 100 + column.endMonth);
      const sortedCutoffs = [...new Set(cutoffSorts)].sort((a, b) => a - b);
      const projection = balanceValuesOnly ? valueColumns.map((column, index) => index) : balanceProjection;
      const values = closing => this._projectBalanceSheetValues(closing, projection);

      accountMembers.forEach(member => {
        const formatConfig = resolveFormat(member);
        if (formatConfig.hidden) return;
        const monthly = [];
        let hasOpening = false;
        (matrix.get(member.id) || new Map()).forEach((bucket, key) => {
          // Ignore SAC year/quarter totals: only opening month + monthly movements.
          const match = /^M:(\d{4}):(\d{2})$/.exec(key);
          if (!match) return;
          const sort = Number(match[1]) * 100 + Number(match[2]);
          if (sort < openingSort) return;
          const value = this._resolveItrScenarioDisplayValue(bucket, formatConfig);
          if (!Number.isFinite(value)) return;
          if (sort === openingSort) hasOpening = true;
          if (sort > sortedCutoffs[sortedCutoffs.length - 1]) return;
          monthly.push({ sort, value });
        });
        monthly.sort((a, b) => a.sort - b.sort);

        // One forward pass per account, including movements from previous years.
        const balances = new Map();
        let index = 0;
        let balance = 0;
        sortedCutoffs.forEach(cutoff => {
          while (index < monthly.length && monthly[index].sort <= cutoff) {
            balance += monthly[index].value;
            index += 1;
          }
          balances.set(cutoff, cutoff >= openingSort && index > 0 && Number.isFinite(balance) ? balance : null);
        });
        const baseRow = {
          accountId: member.id,
          rowKey: `${member.id}::main`,
          account: formatConfig.itrDisplayLabel || member.label,
          formatConfig,
          values: values(cutoffSorts.map(sort => balances.get(sort)))
        };
        const companyAccount = bpCompanies && bpCompanies.accounts.get(member.id);
        if (companyAccount) {
          const projected = this._balanceSheetCompanyProjection(companyAccount, openingSort, sortedCutoffs, cutoffSorts);
          if (!hasOpening || projected.missingOpening) missingOpening.push(member.id);
          if (projected.error) dynamicIssues.push({ accountId: member.id, message: projected.error });
          if (!projected.parts.length) {
            sections.get("unclassified").push({ ...baseRow, bpSection: "unclassified",
              bpSectionLabel: sectionLabels.unclassified, bpClassification: "" });
          }
          projected.parts.forEach(part => sections.get(part.section).push({
            ...baseRow, rowKey: `${member.id}::bp:${part.section}`, bpSection: part.section,
            bpSectionLabel: sectionLabels[part.section], bpClassification: "non_current", values: values(part.balances)
          }));
          return;
        }
        if (!hasOpening) missingOpening.push(member.id);
        const section = Object.hasOwn(sectionLabels, formatConfig.bpSection) ? formatConfig.bpSection : "unclassified";
        sections.get(section).push({
          ...baseRow,
          bpSection: section,
          bpSectionLabel: sectionLabels[section],
          bpClassification: section === "assets" || section === "liabilities" ? formatConfig.bpClassification || "" : ""
        });
      });
      const classificationLabels = { current: "Circulante", non_current: "Nao circulante", "": "A classificar" };
      const rows = [...sections.values()].flatMap(sectionRows => {
        // Preserve legacy order until at least one account in this area is classified.
        if (!sectionRows.some(row => row.bpClassification)) return sectionRows;
        const groups = new Map(["current", "non_current", ""].map(key => [key, []]));
        sectionRows.forEach(row => groups.get(row.bpClassification).push({
          ...row,
          bpClassificationLabel: classificationLabels[row.bpClassification]
        }));
        return [...groups.values()].flat();
      });
      return {
        mode: "overview_bp",
        state: rows.length ? "ok" : "empty",
        message: rows.length ? "" : "Adicione as contas do Balanco Patrimonial ao feed.",
        columns: columns.map(column => ({
          ...column,
          semanticLabel: column.type === "value"
            ? `${column.semanticLabel}: saldo inicial + movimentos ate o fechamento`
            : column.semanticLabel
        })),
        rows,
        balanceSheetTotals: this._buildBalanceSheetTotals(rows, projection),
        totals: [],
        selectedQuarter,
        selectedYear,
        openingPeriod,
        missingOpening,
        dynamicIssues,
        notice: [
          missingOpening.length ? `${missingOpening.length} conta(s) sem saldo inicial numerico em ${openingPeriod}${bpCompanies ? " (inclusive por empresa)" : ""}. O mes ausente vale zero. Confira a medida e se o binding inclui todo o historico.` : "",
          dynamicIssues.length ? `${dynamicIssues.length} conta(s) com regra dinamica sem abertura valida por empresa: ${dynamicIssues.map(issue => `${issue.accountId}: ${issue.message}`).join("; ")} Saldos mantidos em A classificar, fora dos totais de Ativo e Passivo.` : ""
        ].filter(Boolean).join(" ")
      };
    }
  };

  const OnePagerBalanceFreeModule = {
    _buildBalanceSheetFreeView(params) {
      const { input, matrix, accountMembers, resolveFormat, selectedYear, selectedQuarter } = params;
      const lastFive = input.bpColumnLayout === "last_5_itrs";
      const valueColumns = lastFive ? Array.from({ length: 5 }, (_, offset) => {
        const ordinal = selectedYear * 4 + selectedQuarter - 1 - offset;
        const year = Math.floor(ordinal / 4);
        const quarter = ordinal % 4 + 1;
        return {
          key: `itr_${year}_${quarter}`, type: "value", targetKind: "quarter",
          year, quarter, startMonth: quarter * 3 - 2, endMonth: quarter * 3,
          exactKey: `Q:${year}:${quarter}`, memberLabel: `${quarter}T${String(year).slice(-2)}`,
          isCurrentPeriod: offset === 0, semanticLabel: offset === 0 ? "ITR Atual" : `ITR -${offset}`
        };
      }) : params.valueColumns;
      const columns = lastFive ? valueColumns : params.columns;
      // Use the BP balance engine, but never execute or inherit account classifications.
      const base = this._buildBalanceSheetView({
        ...params, columns, valueColumns, balanceValuesOnly: lastFive, bpCompanies: null,
        resolveFormat: member => ({ ...resolveFormat(member), bpSection: "", bpClassification: "",
          bpDynamicClassification: false, bpCompanyDimensionAlias: "" })
      });
      const catalog = this._buildCalculatedIndicatorGraph((input.calculatedCatalog?.items || []).map(item => ({
        ...item, formulaAggregation: "aggregate_operands"
      })));
      const members = new Map(accountMembers.map(member => [String(member.id), member]));
      const lookup = input.accountLookup || this._buildAccountLookup(accountMembers);
      const openingSort = Number(input.bpOpeningPeriod.replace("-", ""));
      const cutoffs = [...new Set(valueColumns.map(col => col.year * 100 + col.endMonth))].sort((a, b) => a - b);
      const cache = new Map();
      const warnings = new Set();
      const cacheKey = (id, measure) => JSON.stringify([id, measure || DEFAULT_MEASURE_TOKEN]);
      const trailingCache = new Map();
      const trailingBalances = (member, measure) => {
        const key = cacheKey(String(member.id), measure);
        if (trailingCache.has(key)) return trailingCache.get(key);
        const periods = matrix.get(member.id) || new Map();
        const monthly = new Map();
        const balances = new Map();
        cutoffs.forEach(cutoff => {
          const end = Math.floor(cutoff / 100) * 12 + cutoff % 100 - 1;
          let total = 0;
          let count = 0;
          // Sum the fixed window directly; subtracting large lifetime balances loses precision.
          for (let month = end - 11; month <= end; month++) {
            const period = `M:${Math.floor(month / 12)}:${String(month % 12 + 1).padStart(2, "0")}`;
            if (!monthly.has(period)) {
              const bucket = periods.get(period);
              monthly.set(period, bucket ? this._resolveItrScenarioDisplayValue(bucket, { measureToken: measure }) : null);
            }
            const value = monthly.get(period);
            if (!Number.isFinite(value)) continue;
            total += value;
            count++;
          }
          balances.set(cutoff, count && Number.isFinite(total) ? total : null);
        });
        trailingCache.set(key, balances);
        return balances;
      };
      const baseRows = base.rows.map(row => {
        const values = lastFive ? row.values.slice() : [row.values[0], row.values[1], row.values[3], row.values[5], row.values[6]];
        cache.set(cacheKey(String(row.accountId), row.formatConfig.measureToken),
          new Map(valueColumns.map((col, index) => [col.year * 100 + col.endMonth, values[index]])));
        return { ...row, values };
      });
      const resolveOperand = (token, column, periodKeys, coverage, format, item) => {
        const trailing = item?.bpCalculationPeriod === "last_12_months";
        const missing = () => this._createFormulaError("MISSING_OPERAND", trailing
          ? "Conta/medida sem dados nos ultimos 12 meses" : "Conta/medida sem saldo no fechamento");
        const split = this._splitOperandValue(token && token.value);
        const resolved = lookup.get(this._normalize(token?.accountId || split.accountId || token?.accountLabel || ""));
        const accountId = typeof resolved === "string" ? resolved : resolved?.id;
        const member = members.get(String(accountId));
        if (!member) return missing();
        const measure = this._normalize(token?.measureId || split.measureId || token?.measureLabel || "")
          || resolveFormat(member).measureToken || DEFAULT_MEASURE_TOKEN;
        if (trailing) {
          const value = trailingBalances(member, measure).get(column.year * 100 + column.endMonth);
          return Number.isFinite(value) ? this._createFormulaSuccess(value) : missing();
        }
        const key = cacheKey(String(accountId), measure);
        if (!cache.has(key)) {
          const monthly = [];
          let hasOpening = false;
          (matrix.get(member.id) || new Map()).forEach((bucket, period) => {
            const match = /^M:(\d{4}):(\d{2})$/.exec(period);
            if (!match) return;
            const sort = Number(match[1]) * 100 + Number(match[2]);
            if (sort < openingSort || sort > cutoffs[cutoffs.length - 1]) return;
            const value = this._resolveItrScenarioDisplayValue(bucket, { measureToken: measure });
            if (!Number.isFinite(value)) return;
            if (sort === openingSort) hasOpening = true;
            monthly.push({ sort, value });
          });
          if (!hasOpening) warnings.add(`${member.id} (${measure})`);
          monthly.sort((a, b) => a.sort - b.sort);
          let index = 0;
          let balance = 0;
          const balances = new Map();
          cutoffs.forEach(cutoff => {
            while (index < monthly.length && monthly[index].sort <= cutoff) balance += monthly[index++].value;
            balances.set(cutoff, cutoff >= openingSort && index > 0 && Number.isFinite(balance) ? balance : null);
          });
          cache.set(key, balances);
        }
        const value = cache.get(key).get(column.year * 100 + column.endMonth);
        return Number.isFinite(value) ? this._createFormulaSuccess(value) : missing();
      };
      const calculated = this._buildCalculatedOverviewRows({
        catalog, baseRows, columns: valueColumns, resolveMeasureAggregate: resolveOperand, rowOrder: input.rowOrder
      });
      const delta = (current, prior) => Number.isFinite(current) && Number.isFinite(prior)
        ? this._safePct(current - prior, prior) : null;
      const rows = lastFive ? calculated : calculated.map(row => {
        const [current, previous, priorYear, currentYtd, priorYtd] = row.values;
        const errors = row.cellErrors;
        return { ...row, values: [current, previous, delta(current, previous), priorYear, delta(current, priorYear),
          currentYtd, priorYtd, delta(currentYtd, priorYtd)],
          ...(errors ? { cellErrors: [errors[0], errors[1], errors[0] || errors[1], errors[2], errors[0] || errors[2],
            errors[3], errors[4], errors[3] || errors[4]].map(error => error || null) } : {})
        };
      });
      return { ...base, mode: "overview_bp_free", rows, balanceSheetTotals: {}, totals: [],
        columnLayout: lastFive ? "last_5_itrs" : "comparison",
        state: rows.length ? "ok" : "empty", message: rows.length ? "" : "Adicione contas ou indicadores calculados.",
        notice: [base.notice, warnings.size
          ? `Operando(s) sem saldo inicial numerico em ${input.bpOpeningPeriod}: ${[...warnings].join(", ")}. O mes ausente vale zero. Confira a medida e todo o historico no binding.`
          : ""].filter(Boolean).join(" ")
      };
    }
  };
  const OnePagerFormulaModule = {
    _evaluateFormulaMonthValue(cube, accountLookup, formula, year, month, scenarioKey, formatConfig) {
      const periodKey = `${year}-${String(month).padStart(2, "0")}`;
      return this._evaluateFormula(formula, token => {
        return this._resolveFormulaOperandValue(cube, accountLookup, token, periodKey, scenarioKey, formatConfig);
      });
    },


    _calculateYtdFormulaValue(cube, accountLookup, formula, year, monthLimit, scenarioKey, modeRaw, formatConfig, resolveWeight) {
      const mode = this._normalizeYtdMode(modeRaw);
      const entries = [];
      const candidates = Array.from({ length: monthLimit }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`);
      const periodKeys = this._formulaInputPeriodKeys(formula, candidates, (token, key) => {
        return this._resolveFormulaOperandValue(cube, accountLookup, token, key, scenarioKey, formatConfig).ok;
      });
      for (const periodKey of periodKeys) {
        const { month } = this._periodFromKey(periodKey);
        const result = this._evaluateFormulaMonthValue(cube, accountLookup, formula, year, month, scenarioKey, formatConfig);
        if (!result || result.ok !== true || !Number.isFinite(result.value)) {
          return this._normalizeFormulaResult(result);
        }
        entries.push(this._averageEntry(result.value, periodKey, { ...formatConfig, ytdMode: mode }, resolveWeight));
      }

      if (!entries.length) {
        return this._createFormulaError("MISSING_OPERAND", "Conta/medida nao encontrada");
      }
      return this._averageFormulaResult(entries, { ...formatConfig, ytdMode: mode });
    },


    _formulaInputPeriodKeys(formula, candidates, hasInput) {
      const tokens = formula && Array.isArray(formula.tokens) ? formula.tokens : [];
      const keys = Array.from(new Set(candidates || [])).sort();
      const active = keys.filter(key => tokens.some(token => token &&
        (token.type === "measure" || token.type === "calculated") && hasInput(token, key)));
      if (!active.length) return [];
      if (!active.every(key => this._periodFromKey(key))) return active;
      // Missing operands inside the covered span must not disappear from a formula.
      return this._expandPeriodRange([this._periodFromKey(active[0]), this._periodFromKey(active[active.length - 1])]
        .map(period => this._buildPeriod(period.year, period.month)))
        .map(period => period.key).sort();
    },


    _calculateAggregatedFormulaValue(cube, accountLookup, formula, year, monthLimit, scenarioKey, rules, formatConfig, resolveWeight) {
      const limit = Math.max(1, Math.min(12, Number.parseInt(String(monthLimit || 0), 10) || 0));
      const coverageByOperand = new Map();
      const result = this._evaluateFormula(formula, token => {
        return this._resolveAggregatedFormulaOperandValue(
          cube,
          accountLookup,
          token,
          year,
          limit,
          scenarioKey,
          rules,
          formatConfig,
          coverageByOperand,
          resolveWeight
        );
      });
      if (!result || result.ok !== true) return result;
      const coverageError = this._validateFormulaOperandCoverage(coverageByOperand);
      return coverageError || result;
    },


    _resolveAggregatedFormulaOperandValue(cube, accountLookup, token, year, monthLimit, scenarioKey, rules, formatConfig, coverageByOperand, resolveWeight) {
      if (!token || token.type !== "measure") {
        return this._createFormulaError("MISSING_OPERAND", "Conta/medida nao encontrada");
      }

      const safeToken = token || {};
      const split = this._splitOperandValue(safeToken.value);
      const accountKey = this._normalize(safeToken.accountId || split.accountId || safeToken.accountLabel || "");
      const resolvedAccountId = accountLookup instanceof Map
        ? (accountLookup.get(accountKey) || "")
        : "";
      if (!resolvedAccountId) {
        return this._createFormulaError("MISSING_OPERAND", "Conta/medida nao encontrada");
      }

      const accountNode = cube instanceof Map ? cube.get(resolvedAccountId) : null;
      if (!accountNode || !(accountNode.periods instanceof Map)) {
        return this._createFormulaError("MISSING_OPERAND", "Conta/medida nao encontrada");
      }

      const accountFormat = this._normalizeDisplayFormat(this._resolveMeasureRuleForAccount({
        id: resolvedAccountId,
        label: accountNode.label || safeToken.accountLabel || resolvedAccountId,
        alias: safeToken.accountId || resolvedAccountId
      }, rules || { byAccount: new Map() }));
      const measureToken = this._normalize(safeToken.measureId || split.measureId || accountFormat.measureToken || "");
      const operandFormat = {
        ...accountFormat,
        measureToken: measureToken || accountFormat.measureToken || "",
        subordinateMeasureToken: ""
      };
      const mode = this._normalizeYtdMode(operandFormat.ytdMode);
      const values = new Map();
      const coveredPeriods = [];
      let firstError = null;

      for (let month = 1; month <= monthLimit; month += 1) {
        const periodKey = `${year}-${String(month).padStart(2, "0")}`;
        const periodBucket = accountNode.periods.get(periodKey);
        if (!periodBucket) {
          if (!firstError) firstError = this._createFormulaError("MISSING_OPERAND", "Conta/medida nao encontrada");
          continue;
        }
        const scenarioBucket = scenarioKey === "budget" ? periodBucket.budget : periodBucket.actual;
        const result = this._resolveScenarioBucketMeasureValue(scenarioBucket, measureToken, safeToken, operandFormat);
        if (!result || result.ok !== true || !Number.isFinite(result.value)) {
          if (!firstError) firstError = this._normalizeFormulaResult(result);
          continue;
        }

        const value = result.value;
        if (!Number.isFinite(value)) continue;
        values.set(periodKey, value);
        coveredPeriods.push(periodKey);
      }

      if (!values.size) {
        return firstError || this._createFormulaError("FORMULA_ERROR", "Erro na formula");
      }
      this._recordFormulaOperandCoverage(coverageByOperand, safeToken, coveredPeriods);
      return this._averageValueResult(this._aggregateMonthlyValues(values, operandFormat, resolveWeight), operandFormat);
    },


    _recordFormulaOperandCoverage(coverageByOperand, token, periodKeys) {
      if (!(coverageByOperand instanceof Map) || !token) return;
      const split = this._splitOperandValue(token.value);
      const accountId = this._normalize(token.accountId || split.accountId || token.accountLabel || "");
      const measureId = this._normalize(token.measureId || split.measureId || token.measureLabel || "");
      const operandKey = `${accountId}::${measureId}`;
      if (!accountId || !measureId || coverageByOperand.has(operandKey)) return;
      const signature = Array.from(new Set(periodKeys || []))
        .map(String)
        .sort((a, b) => a.localeCompare(b))
        .join("|");
      coverageByOperand.set(operandKey, signature);
    },


    _validateFormulaOperandCoverage(coverageByOperand) {
      if (!(coverageByOperand instanceof Map) || coverageByOperand.size <= 1) return null;
      const signatures = new Set(Array.from(coverageByOperand.values()));
      if (signatures.size <= 1) return null;
      return this._createFormulaError("PERIOD_MISMATCH", "Cobertura mensal divergente entre operandos");
    },


    _resolveScenarioBucketMeasureValue(scenarioBucket, measureRaw, token, formatConfig) {
      if (!scenarioBucket) {
        return this._createFormulaError("MISSING_OPERAND", "Conta/medida nao encontrada");
      }
      const safeToken = token || {};
      const measureToken = this._normalize(measureRaw);
      if (!measureToken || measureToken === DEFAULT_MEASURE_TOKEN) {
        if (!Number.isFinite(scenarioBucket.total)) {
          return this._createFormulaError("MISSING_OPERAND", "Conta/medida nao encontrada");
        }
        return this._createFormulaSuccess(scenarioBucket.total);
      }

      const byMeasure = scenarioBucket.byMeasure || new Map();
      if (byMeasure.has(measureToken)) return this._createFormulaSuccess(byMeasure.get(measureToken));

      const measureLabelToken = this._normalize(safeToken.measureLabel || safeToken.label || "");
      const altTokens = [measureToken, measureLabelToken].filter(Boolean);
      for (const [key, value] of byMeasure.entries()) {
        const normalizedKey = this._normalize(key);
        const isMatch = altTokens.some(tokenKey => normalizedKey === tokenKey);
        if (isMatch) return this._createFormulaSuccess(value);
      }

      return this._createFormulaError("MISSING_OPERAND", "Conta/medida nao encontrada");
    },


    _resolveFormulaOperandValue(cube, accountLookup, token, periodKey, scenarioKey, formatConfig) {
      const safeToken = token || {};
      const split = this._splitOperandValue(safeToken.value);
      const accountIdRaw = safeToken.accountId || split.accountId;
      const measureRaw = safeToken.measureId || split.measureId;
      const accountKey = this._normalize(accountIdRaw);
      const resolvedAccountId = accountLookup instanceof Map
        ? (accountLookup.get(accountKey) || "")
        : "";
      if (!resolvedAccountId) {
        return this._createFormulaError("MISSING_OPERAND", "Conta/medida nao encontrada");
      }
      const accountNode = cube instanceof Map ? cube.get(resolvedAccountId) : null;
      if (!accountNode || !(accountNode.periods instanceof Map)) {
        return this._createFormulaError("MISSING_OPERAND", "Conta/medida nao encontrada");
      }
      const periodBucket = accountNode.periods.get(periodKey);
      if (!periodBucket) {
        return this._createFormulaError("MISSING_OPERAND", "Conta/medida nao encontrada");
      }
      const scenarioBucket = scenarioKey === "budget" ? periodBucket.budget : periodBucket.actual;
      return this._resolveScenarioBucketMeasureValue(scenarioBucket, measureRaw, safeToken, formatConfig);
    },


    _cleanFormulaLabel(value) {
      return String(value == null ? "" : value)
        .replace(/\s*\((?=[^)]*(?:\$|\[|\]|_|measures?[_-]|S_[A-Z0-9]+))[^)]*\)/gi, "")
        .replace(/\s*\[[^\]]*\]/g, "")
        .replace(/\s{2,}/g, " ")
        .trim();
    },


    _splitOperandValue(value) {
      const text = String(value == null ? "" : value).trim();
      if (!text.includes("::")) return { accountId: "", measureId: text };
      const parts = text.split("::");
      return {
        accountId: String(parts[0] || "").trim(),
        measureId: String(parts.slice(1).join("::") || "").trim()
      };
    },


    _normalizeFormula(formula) {
      const rawTokens = Array.isArray(formula && formula.tokens) ? formula.tokens : [];
      const tokens = rawTokens.reduce((all, token) => {
        if (!token || typeof token !== "object") return all;
        if (token.type === "measure") {
          const split = this._splitOperandValue(token.value);
          const accountId = String(token.accountId || split.accountId || "").trim();
          const measureId = String(token.measureId || split.measureId || "").trim();
          if (!accountId || !measureId) return all;
          const accountLabel = this._cleanFormulaLabel(token.accountLabel || accountId);
          const measureLabel = this._cleanFormulaLabel(token.measureLabel || token.label || measureId);
          all.push({
            type: "measure",
            value: `${accountId}::${measureId}`,
            key: `${accountId}::${measureId}`,
            accountId,
            accountLabel,
            measureId,
            measureLabel,
            label: this._cleanFormulaLabel(token.label || `${accountLabel} | ${measureLabel}`)
          });
          return all;
        }
        if (token.type === "calculated") {
          const calculatedId = String(token.calculatedId || token.value || "").trim();
          if (!calculatedId) return all;
          const calculatedLabel = this._cleanFormulaLabel(token.calculatedLabel || token.label || calculatedId);
          all.push({
            type: "calculated",
            value: calculatedId,
            key: `calculated::${calculatedId}`,
            calculatedId,
            calculatedLabel,
            label: calculatedLabel || calculatedId
          });
          return all;
        }
        if (token.type === "operator") {
          const raw = String(token.value || token.op || "").trim();
          const value = raw === "×" || raw.toLowerCase() === "x" ? "*" : raw === "÷" ? "/" : raw;
          if (value === "+" || value === "-" || value === "*" || value === "/") {
            all.push({ type: "operator", value });
          }
          return all;
        }
        if (token.type === "paren") {
          const value = token.value === "(" || token.value === ")" ? token.value : "";
          if (value) all.push({ type: "paren", value });
        }
        return all;
      }, []);
      return { tokens };
    },


    _parseFormula(value) {
      if (!value) return { tokens: [] };
      if (typeof value === "object") return this._normalizeFormula(value);
      try {
        return this._normalizeFormula(JSON.parse(String(value)));
      } catch (error) {
        return { tokens: [] };
      }
    },


    _formulaReadableLabel(formula, fallback = "Indicador subordinado") {
      const normalized = this._normalizeFormula(formula);
      if (!normalized.tokens.length) return fallback;
      return normalized.tokens.map(token => {
        if (token.type === "measure" || token.type === "calculated") {
          const account = this._cleanFormulaLabel(token.accountLabel || token.accountId || "");
          const measure = this._cleanFormulaLabel(token.measureLabel || token.measureId || "");
          if (token.type === "calculated") {
            return this._cleanFormulaLabel(token.calculatedLabel || token.label || token.calculatedId || token.value);
          }
          if (account && measure) return `${account} | ${measure}`;
          return account || measure || token.value;
        }
        if (token.type === "operator") {
          if (token.value === "*") return "×";
          if (token.value === "/") return "÷";
          return token.value;
        }
        return token.value;
      }).join(" ");
    },


    _validateFormulaTokens(tokens) {
      if (!Array.isArray(tokens) || !tokens.length) {
        return { valid: false, error: "Adicione ao menos um operando de conta e medida." };
      }
      let balance = 0;
      let expectsOperand = true;
      for (const token of tokens) {
        if (token.type === "measure" || token.type === "calculated") {
          if (!expectsOperand) return { valid: false, error: "Faltou operador entre medidas." };
          expectsOperand = false;
          continue;
        }
        if (token.type === "operator") {
          if (expectsOperand) return { valid: false, error: "Operador sem medida antes." };
          expectsOperand = true;
          continue;
        }
        if (token.type === "paren" && token.value === "(") {
          if (!expectsOperand) return { valid: false, error: "Faltou operador antes do parenteses." };
          balance += 1;
          continue;
        }
        if (token.type === "paren" && token.value === ")") {
          if (expectsOperand) return { valid: false, error: "Parenteses fechando sem medida." };
          balance -= 1;
          if (balance < 0) return { valid: false, error: "Parenteses fechando sem abertura." };
          expectsOperand = false;
        }
      }
      if (expectsOperand) return { valid: false, error: "Formula termina com operador." };
      if (balance !== 0) return { valid: false, error: "Parenteses incompletos." };
      return { valid: true, error: "" };
    },


    _formulaToRpn(formula) {
      const normalized = this._normalizeFormula(formula);
      const signature = JSON.stringify(normalized.tokens.map(token => ({
        type: token.type,
        value: token.value,
        accountId: token.accountId || "",
        measureId: token.measureId || "",
        calculatedId: token.calculatedId || ""
      })));
      if (!(this._compiledFormulaCache instanceof Map)) this._compiledFormulaCache = new Map();
      const cached = this._compiledFormulaCache.get(signature);
      if (cached) return cached;
      const validation = this._validateFormulaTokens(normalized.tokens);
      if (!validation.valid) {
        const invalid = { valid: false, error: validation.error, rpn: [] };
        this._rememberCompiledFormula(signature, invalid);
        return invalid;
      }
      const output = [];
      const operators = [];
      const precedence = { "+": 1, "-": 1, "*": 2, "/": 2 };
      normalized.tokens.forEach(token => {
        if (token.type === "measure" || token.type === "calculated") {
          output.push(token);
          return;
        }
        if (token.type === "operator") {
          while (operators.length) {
            const previous = operators[operators.length - 1];
            if (previous.type !== "operator") break;
            if ((precedence[previous.value] || 0) < (precedence[token.value] || 0)) break;
            output.push(operators.pop());
          }
          operators.push(token);
          return;
        }
        if (token.type === "paren" && token.value === "(") {
          operators.push(token);
          return;
        }
        if (token.type === "paren" && token.value === ")") {
          while (operators.length && operators[operators.length - 1].value !== "(") output.push(operators.pop());
          operators.pop();
        }
      });
      while (operators.length) output.push(operators.pop());
      const compiled = { valid: true, error: "", rpn: output };
      this._rememberCompiledFormula(signature, compiled);
      return compiled;
    },


    _rememberCompiledFormula(signature, compiled) {
      if (!(this._compiledFormulaCache instanceof Map)) this._compiledFormulaCache = new Map();
      if (this._compiledFormulaCache.size >= 256) {
        const oldest = this._compiledFormulaCache.keys().next();
        if (!oldest.done) this._compiledFormulaCache.delete(oldest.value);
      }
      this._compiledFormulaCache.set(signature, compiled);
    },


    _evaluateFormula(formula, valueResolver) {
      const compiled = this._formulaToRpn(formula);
      if (!compiled.valid) return this._createFormulaError("FORMULA_ERROR", compiled.error || "Erro na formula");
      const stack = [];
      for (const token of compiled.rpn) {
        if (token.type === "measure" || token.type === "calculated") {
          const resolved = this._normalizeFormulaResult(valueResolver(token));
          if (!resolved.ok) return resolved;
          const value = Number(resolved.value);
          if (!Number.isFinite(value)) {
            return this._createFormulaError("MISSING_OPERAND", "Conta/medida nao encontrada");
          }
          stack.push(value);
          continue;
        }
        if (token.type !== "operator" || stack.length < 2) {
          return this._createFormulaError("FORMULA_ERROR", "Erro na formula");
        }
        const right = stack.pop();
        const left = stack.pop();
        let next = null;
        if (token.value === "+") next = left + right;
        if (token.value === "-") next = left - right;
        if (token.value === "*") next = left * right;
        if (token.value === "/") {
          if (right === 0) return this._createFormulaError("DIV_ZERO", "Divisao por zero");
          next = left / right;
        }
        if (!Number.isFinite(next)) return this._createFormulaError("FORMULA_ERROR", "Erro na formula");
        stack.push(next);
      }
      if (stack.length === 1 && Number.isFinite(stack[0])) return this._createFormulaSuccess(stack[0]);
      return this._createFormulaError("FORMULA_ERROR", "Erro na formula");
    },


    _createFormulaSuccess(value) {
      const numeric = OnePagerCore.bindingNumber(value);
      if (!Number.isFinite(numeric)) {
        return this._createFormulaError("MISSING_OPERAND", "Conta/medida nao encontrada");
      }
      return {
        ok: true,
        value: numeric,
        errorCode: "",
        errorMessage: ""
      };
    },


    _createFormulaError(errorCode, errorMessage) {
      return {
        ok: false,
        value: null,
        errorCode: errorCode || "FORMULA_ERROR",
        errorMessage: errorMessage || "Erro na formula"
      };
    },


    _normalizeFormulaResult(result) {
      if (result && typeof result === "object" && Object.prototype.hasOwnProperty.call(result, "ok")) {
        if (result.ok) {
          return this._createFormulaSuccess(result.value);
        }
        return this._createFormulaError(result.errorCode, result.errorMessage);
      }
      const numeric = OnePagerCore.bindingNumber(result);
      if (Number.isFinite(numeric)) return this._createFormulaSuccess(numeric);
      return this._createFormulaError("FORMULA_ERROR", "Erro na formula");
    },


    _resultValue(result) {
      const normalized = this._normalizeFormulaResult(result);
      return normalized.ok ? normalized.value : null;
    },


    _resultError(result) {
      const normalized = this._normalizeFormulaResult(result);
      return normalized.ok ? null : normalized;
    },


    _firstResultError(...results) {
      for (const result of results) {
        const error = this._resultError(result);
        if (error) return error;
      }
      return null;
    },


    _composeSubordinateData(
      label,
      formatConfig,
      monthActualResult,
      monthBudgetResult,
      ytdActualResult,
      ytdBudgetResult,
      previousYtdActualResult
    ) {
      const monthActual = this._resultValue(monthActualResult);
      const monthBudget = this._resultValue(monthBudgetResult);
      const ytdActual = this._resultValue(ytdActualResult);
      const ytdBudget = this._resultValue(ytdBudgetResult);
      const previousYtdActual = this._resultValue(previousYtdActualResult);

      const monthActualError = this._resultError(monthActualResult);
      const monthBudgetError = this._resultError(monthBudgetResult);
      const ytdActualError = this._resultError(ytdActualResult);
      const ytdBudgetError = this._resultError(ytdBudgetResult);
      const previousYtdActualError = this._resultError(previousYtdActualResult);

      const monthDeltaAbsError = this._firstResultError(monthActualResult, monthBudgetResult);
      const ytdDeltaAbsError = this._firstResultError(ytdActualResult, ytdBudgetResult);

      const monthDeltaAbs = monthDeltaAbsError ? null : (monthActual - monthBudget);
      const ytdDeltaAbs = ytdDeltaAbsError ? null : (ytdActual - ytdBudget);

      let monthDeltaPct = null;
      let monthDeltaPctError = monthDeltaAbsError;
      if (!monthDeltaPctError) {
        if (!Number.isFinite(monthBudget) || monthBudget === 0) {
          monthDeltaPctError = this._createFormulaError("DIV_ZERO", "Divisao por zero");
        } else {
          monthDeltaPct = this._safePct(monthDeltaAbs, monthBudget);
        }
      }

      let ytdDeltaPct = null;
      let ytdDeltaPctError = ytdDeltaAbsError;
      if (!ytdDeltaPctError) {
        if (!Number.isFinite(ytdBudget) || ytdBudget === 0) {
          ytdDeltaPctError = this._createFormulaError("DIV_ZERO", "Divisao por zero");
        } else {
          ytdDeltaPct = this._safePct(ytdDeltaAbs, ytdBudget);
        }
      }

      return {
        label,
        formatConfig,
        monthActual: Number.isFinite(monthActual) ? monthActual : null,
        monthBudget: Number.isFinite(monthBudget) ? monthBudget : null,
        monthDeltaAbs,
        monthDeltaPct,
        ytdActual: Number.isFinite(ytdActual) ? ytdActual : null,
        ytdBudget: Number.isFinite(ytdBudget) ? ytdBudget : null,
        ytdDeltaAbs,
        ytdDeltaPct,
        previousYtdActual: Number.isFinite(previousYtdActual) ? previousYtdActual : null,
        errors: {
          monthActual: monthActualError,
          monthBudget: monthBudgetError,
          monthDeltaAbs: monthDeltaAbsError,
          monthDeltaPct: monthDeltaPctError,
          ytdActual: ytdActualError,
          ytdBudget: ytdBudgetError,
          ytdDeltaAbs: ytdDeltaAbsError,
          ytdDeltaPct: ytdDeltaPctError,
          previousYtdActual: previousYtdActualError
        }
      };
    },


    _buildSubordinateDataWithError(label, formatConfig, error) {
      const safeError = this._normalizeFormulaResult(error);
      return {
        label,
        formatConfig,
        monthActual: null,
        monthBudget: null,
        monthDeltaAbs: null,
        monthDeltaPct: null,
        ytdActual: null,
        ytdBudget: null,
        ytdDeltaAbs: null,
        ytdDeltaPct: null,
        previousYtdActual: null,
        errors: {
          monthActual: safeError,
          monthBudget: safeError,
          monthDeltaAbs: safeError,
          monthDeltaPct: safeError,
          ytdActual: safeError,
          ytdBudget: safeError,
          ytdDeltaAbs: safeError,
          ytdDeltaPct: safeError,
          previousYtdActual: safeError
        }
      };
    },

  };
  const OnePagerCalculatedModule = {
    _readCalculatedIndicatorCatalog(rawValue) {
      const parsed = this._parseJsonObject(rawValue);
      const rawItems = Array.isArray(parsed)
        ? parsed
        : (Array.isArray(parsed.items) ? parsed.items : []);
      const items = [];
      const usedIds = new Set();
      rawItems.forEach((rawItem, index) => {
        const item = this._normalizeCalculatedIndicator(rawItem, index);
        if (!item.id || usedIds.has(item.id)) return;
        usedIds.add(item.id);
        items.push(item);
      });
      return this._buildCalculatedIndicatorGraph(items);
    },


    _normalizeCalculatedIndicator(rawValue, index) {
      const source = rawValue && typeof rawValue === "object" ? rawValue : {};
      const fallbackId = `calc_${Math.max(0, Number(index) || 0) + 1}`;
      const id = String(source.id || source.key || fallbackId).trim().slice(0, 100);
      const name = String(source.name || source.label || source.title || DEFAULT_CALCULATED_INDICATOR.name)
        .trim()
        .slice(0, 120) || DEFAULT_CALCULATED_INDICATOR.name;
      return {
        id,
        name,
        displayMode: this._normalizeCalculatedDisplayMode(source.displayMode || source.display || source.mode),
        parentId: String(source.parentId || source.parent || "").trim().slice(0, 140),
        scale: this._normalizeScale(source.displayScale || source.scale || DEFAULT_CALCULATED_INDICATOR.scale),
        decimals: this._normalizeDecimals(source.decimals),
        ytdMode: this._normalizeYtdMode(source.ytdMode),
        ...OnePagerAverageWeights.fields(source.weightConfig),
        bpCalculationPeriod: source.bpCalculationPeriod === "last_12_months" ? "last_12_months" : "balance",
        formulaAggregation: this._normalizeFormulaAggregation(
          source.formulaAggregation || source.subordinateFormulaAggregation || DEFAULT_CALCULATED_INDICATOR.formulaAggregation
        ),
        deltaPolarity: this._normalizeDeltaPolarity(source.deltaPolarity || DEFAULT_CALCULATED_INDICATOR.deltaPolarity),
        highlight: this._normalizeHighlight(source.highlight),
        itrDisplaySign: this._normalizeItrDisplaySign(source.itrDisplaySign),
        formula: this._parseFormula(source.formulaJson != null ? source.formulaJson : source.formula),
        order: Math.max(0, Number.isFinite(Number(source.order)) ? Number(source.order) : Number(index) || 0)
      };
    },


    _normalizeCalculatedDisplayMode(value) {
      const token = String(value == null ? "" : value).trim().toLowerCase();
      if (token === "subordinate" || token === "subordinado") return "subordinate";
      if (token === "hidden" || token === "oculto") return "hidden";
      return "independent";
    },


    _buildCalculatedIndicatorGraph(items) {
      const safeItems = Array.isArray(items) ? items.slice() : [];
      const byId = new Map(safeItems.map(item => [item.id, item]));
      const errors = new Map();
      const dependencies = new Map();
      safeItems.forEach(item => {
        const validation = this._validateFormulaTokens(item.formula && item.formula.tokens);
        if (!validation.valid) {
          errors.set(item.id, this._createFormulaError("FORMULA_ERROR", validation.error || "Erro na formula"));
        }
        const refs = new Set();
        (item.formula && Array.isArray(item.formula.tokens) ? item.formula.tokens : []).forEach(token => {
          if (!token || token.type !== "calculated") return;
          const refId = String(token.calculatedId || token.value || "").trim();
          if (!refId) return;
          refs.add(refId);
          if (!byId.has(refId) && !errors.has(item.id)) {
            errors.set(item.id, this._createFormulaError("MISSING_CALCULATED", "Indicador calculado nao encontrado"));
          }
        });
        dependencies.set(item.id, refs);
      });

      const state = new Map();
      const stack = [];
      const order = [];
      const visit = id => {
        const currentState = state.get(id) || 0;
        if (currentState === 2) return;
        if (currentState === 1) {
          const start = Math.max(0, stack.indexOf(id));
          stack.slice(start).concat(id).forEach(cycleId => {
            errors.set(cycleId, this._createFormulaError("CALC_CYCLE", "Dependencia circular entre indicadores"));
          });
          return;
        }
        state.set(id, 1);
        stack.push(id);
        (dependencies.get(id) || new Set()).forEach(dependencyId => {
          if (byId.has(dependencyId)) visit(dependencyId);
        });
        stack.pop();
        state.set(id, 2);
        order.push(id);
      };
      safeItems.forEach(item => visit(item.id));
      return {
        items: safeItems,
        byId,
        dependencies,
        errors,
        order: order.map(id => byId.get(id)).filter(Boolean)
      };
    },


    _collectCalculatedFormulaAccountIds(catalog, accountLookup) {
      const accountIds = new Set();
      const items = catalog && Array.isArray(catalog.items) ? catalog.items : [];
      items.forEach(item => {
        const formula = this._normalizeFormula(item.formula);
        formula.tokens.forEach(token => {
          if (!token || token.type !== "measure") return;
          const split = this._splitOperandValue(token.value);
          const key = this._normalize(token.accountId || split.accountId || token.accountLabel || "");
          const resolved = accountLookup instanceof Map ? accountLookup.get(key) : "";
          if (resolved) accountIds.add(typeof resolved === "string" ? resolved : resolved.id);
        });
      });
      return accountIds;
    },


    _rowOrderRankMap(rowOrder) {
      const rank = new Map();
      (Array.isArray(rowOrder) ? rowOrder : []).forEach((key, index) => {
        const token = String(key == null ? "" : key).trim();
        if (token && !rank.has(token)) rank.set(token, index);
      });
      return rank;
    },


    _orderAccountMembersByRowOrder(accountMembers, rowOrder) {
      const members = Array.isArray(accountMembers) ? accountMembers.slice() : [];
      const rank = this._rowOrderRankMap(rowOrder);
      if (!rank.size) return members;
      return members
        .map((member, index) => ({ member, index }))
        .sort((left, right) => {
          const leftKey = "account:" + String(left.member && left.member.id || "").trim();
          const rightKey = "account:" + String(right.member && right.member.id || "").trim();
          const leftRank = rank.has(leftKey) ? rank.get(leftKey) : rank.size + left.index;
          const rightRank = rank.has(rightKey) ? rank.get(rightKey) : rank.size + right.index;
          return leftRank - rightRank || left.index - right.index;
        })
        .map(entry => entry.member);
    },


    _orderOverviewRowsByRowOrder(rows, rowOrder) {
      const source = Array.isArray(rows) ? rows : [];
      const rank = this._rowOrderRankMap(rowOrder);
      if (!rank.size || source.length < 2) return source;
      const groups = [];
      source.forEach((row, index) => {
        if (row && row.isOverviewSubordinate && groups.length) {
          groups[groups.length - 1].rows.push(row);
          return;
        }
        const id = String(row && (row.calculatedIndicatorId || row.accountId) || "").trim();
        const key = row && row.isCalculatedIndicator ? "calculated:" + id : "account:" + id;
        groups.push({ key, index, rows: [row] });
      });
      groups.sort((left, right) => {
        const leftRank = rank.has(left.key) ? rank.get(left.key) : rank.size + left.index;
        const rightRank = rank.has(right.key) ? rank.get(right.key) : rank.size + right.index;
        return leftRank - rightRank || left.index - right.index;
      });
      return groups.flatMap(group => group.rows);
    },


    _calculatedIndicatorFormat(item) {
      return this._normalizeDisplayFormat({
        measureToken: "",
        displayScale: item.scale,
        decimals: item.decimals,
        ytdMode: item.ytdMode,
        ...OnePagerAverageWeights.fields(item.weightConfig),
        deltaPolarity: item.deltaPolarity,
        highlight: item.highlight,
        itrDisplaySign: item.itrDisplaySign,
        hidden: item.displayMode === "hidden",
        subordinate: false,
        subordinates: []
      });
    },


    _buildCalculatedOverviewRows(params) {
      const input = params || {};
      const catalog = input.catalog || { items: [], byId: new Map(), errors: new Map(), order: [] };
      if (!Array.isArray(catalog.items) || !catalog.items.length) return Array.isArray(input.baseRows) ? input.baseRows : [];
      const columns = Array.isArray(input.columns) ? input.columns : [];
      const baseRows = Array.isArray(input.baseRows) ? input.baseRows : [];
      const columnPeriodKeys = input.columnPeriodKeys instanceof Map ? input.columnPeriodKeys : new Map();
      const resolveMeasurePeriod = typeof input.resolveMeasurePeriod === "function"
        ? input.resolveMeasurePeriod
        : (() => this._createFormulaError("MISSING_OPERAND", "Conta/medida nao encontrada"));
      const resolveMeasureAggregate = typeof input.resolveMeasureAggregate === "function"
        ? input.resolveMeasureAggregate
        : (() => this._createFormulaError("MISSING_OPERAND", "Conta/medida nao encontrada"));
      const resolveColumnPeriodKeys = typeof input.resolveColumnPeriodKeys === "function"
        ? input.resolveColumnPeriodKeys
        : ((item, column) => Array.from(columnPeriodKeys.get(column.key) || []));
      const resolvePeriodInfo = typeof input.resolvePeriodInfo === "function"
        ? input.resolvePeriodInfo
        : (periodKey => this._periodFromKey(periodKey));
      const periodCache = new Map();
      const columnCache = new Map();
      const inputCache = new Map();
      const hasPeriodInput = (item, column, periodKey, trail = new Set()) => {
        if (!item || trail.has(item.id)) return false;
        const key = `${item.id}::${column.key}::${periodKey}`;
        if (inputCache.has(key)) return inputCache.get(key);
        const nextTrail = new Set(trail).add(item.id);
        const found = (item.formula && item.formula.tokens || []).some(token => {
          if (token.type === "calculated") {
            return hasPeriodInput(catalog.byId.get(String(token.calculatedId || token.value || "")), column, periodKey, nextTrail);
          }
          if (token.type !== "measure") return false;
          const value = resolveMeasurePeriod(token, column, periodKey, this._calculatedIndicatorFormat(item));
          return value && value.ok === true && Number.isFinite(value.value);
        });
        inputCache.set(key, found);
        return found;
      };

      const evaluatePeriod = (itemId, column, periodKey) => {
        const cacheKey = `${itemId}::${column.key}::${periodKey}`;
        if (periodCache.has(cacheKey)) return periodCache.get(cacheKey);
        const item = catalog.byId.get(itemId);
        const graphError = catalog.errors.get(itemId);
        if (!item || graphError) {
          const error = graphError || this._createFormulaError("MISSING_CALCULATED", "Indicador calculado nao encontrado");
          periodCache.set(cacheKey, error);
          return error;
        }
        const formatConfig = this._calculatedIndicatorFormat(item);
        const result = this._evaluateFormula(item.formula, token => {
          if (token.type === "calculated") {
            return evaluatePeriod(String(token.calculatedId || token.value || ""), column, periodKey);
          }
          return resolveMeasurePeriod(token, column, periodKey, formatConfig);
        });
        periodCache.set(cacheKey, result);
        return result;
      };

      const evaluateColumn = (itemId, column) => {
        const cacheKey = `${itemId}::${column.key}`;
        if (columnCache.has(cacheKey)) return columnCache.get(cacheKey);
        const item = catalog.byId.get(itemId);
        const graphError = catalog.errors.get(itemId);
        if (!item || graphError) {
          const error = graphError || this._createFormulaError("MISSING_CALCULATED", "Indicador calculado nao encontrado");
          columnCache.set(cacheKey, error);
          return error;
        }
        const formatConfig = this._calculatedIndicatorFormat(item);
        const configuredPeriodKeys = resolveColumnPeriodKeys(item, column);
        const periodKeys = Array.from(configuredPeriodKeys || []).sort((a, b) => String(a).localeCompare(String(b)));
        let result;
        if (item.formulaAggregation === "aggregate_operands") {
          const coverageByOperand = new Map();
          result = this._evaluateFormula(item.formula, token => {
            if (token.type === "calculated") {
              return evaluateColumn(String(token.calculatedId || token.value || ""), column);
            }
            return resolveMeasureAggregate(token, column, periodKeys, coverageByOperand, formatConfig, item);
          });
          if (result && result.ok === true) {
            result = this._validateFormulaOperandCoverage(coverageByOperand) || result;
          }
        } else {
          const entries = [];
          let firstError = null;
          const activeKeys = this._formulaInputPeriodKeys(item.formula, periodKeys, (token, key) => {
            if (token.type === "calculated") {
              return hasPeriodInput(catalog.byId.get(String(token.calculatedId || token.value || "")), column, key);
            }
            const value = resolveMeasurePeriod(token, column, key, formatConfig);
            return value && value.ok === true && Number.isFinite(value.value);
          });
          for (const periodKey of activeKeys) {
            const period = resolvePeriodInfo(periodKey, column, item);
            if (!period) continue;
            const periodResult = evaluatePeriod(item.id, column, periodKey);
            if (!periodResult || periodResult.ok !== true || !Number.isFinite(periodResult.value)) {
              firstError = this._normalizeFormulaResult(periodResult);
              break;
            }
            entries.push(this._averageEntry(periodResult.value, periodKey, formatConfig,
              input.resolveWeight ? (format, key) => input.resolveWeight(format, key, column) : null, period.weight));
          }
          result = firstError || (entries.length
            ? this._averageFormulaResult(entries, formatConfig)
            : this._createFormulaError("MISSING_OPERAND", "Conta/medida nao encontrada"));
        }
        columnCache.set(cacheKey, result);
        return result;
      };

      const calculatedRows = new Map();
      catalog.order.forEach(item => {
        const results = columns.map(column => evaluateColumn(item.id, column));
        calculatedRows.set(item.id, {
          account: item.name,
          rowKey: `CALCULATED::${item.id}`,
          accountId: item.id,
          calculatedIndicatorId: item.id,
          parentAccountId: item.parentId || "",
          isCalculatedIndicator: true,
          isOverviewSubordinate: item.displayMode === "subordinate",
          formatConfig: this._calculatedIndicatorFormat(item),
          formula: item.formula,
          values: results.map(result => this._resultValue(result)),
          cellErrors: results.map(result => this._resultError(result))
        });
      });

      const childrenByParent = new Map();
      catalog.items.forEach(item => {
        if (item.displayMode !== "subordinate" || !item.parentId) return;
        if (!childrenByParent.has(item.parentId)) childrenByParent.set(item.parentId, []);
        childrenByParent.get(item.parentId).push(item);
      });
      const rowOrderRank = this._rowOrderRankMap(input.rowOrder);
      childrenByParent.forEach(items => items.sort((a, b) => {
        const aKey = "calculated:" + a.id;
        const bKey = "calculated:" + b.id;
        const aRank = rowOrderRank.has(aKey) ? rowOrderRank.get(aKey) : rowOrderRank.size + a.order;
        const bRank = rowOrderRank.has(bKey) ? rowOrderRank.get(bKey) : rowOrderRank.size + b.order;
        return aRank - bRank || a.order - b.order;
      }));
      const emitted = new Set();
      const output = [];
      const appendCalculated = (item, depth, parentLabel) => {
        if (!item || item.displayMode === "hidden" || emitted.has(item.id)) return;
        const row = calculatedRows.get(item.id);
        if (!row) return;
        emitted.add(item.id);
        row.isOverviewSubordinate = depth > 0;
        row.drilldownLevel = Math.max(0, depth - 1);
        row.parentAccount = parentLabel || "";
        output.push(row);
        (childrenByParent.get(item.id) || []).forEach(child => appendCalculated(child, depth + 1, item.name));
      };

      const accountIds = new Set();
      baseRows.forEach(row => {
        output.push(row);
        if (!row || row.isOverviewSubordinate) return;
        const accountId = String(row.accountId || "").trim();
        if (!accountId) return;
        accountIds.add(accountId);
        const following = childrenByParent.get(accountId) || [];
        following.forEach(item => appendCalculated(item, 1, row.account));
      });
      catalog.items
        .filter(item => item.displayMode === "independent")
        .sort((a, b) => a.order - b.order)
        .forEach(item => appendCalculated(item, 0, ""));
      catalog.items
        .filter(item => item.displayMode === "subordinate" && !emitted.has(item.id))
        .sort((a, b) => a.order - b.order)
        .forEach(item => {
          const parentExists = catalog.byId.has(item.parentId) || accountIds.has(item.parentId);
          if (!parentExists) appendCalculated(item, 0, "");
        });
      return this._orderOverviewRowsByRowOrder(output, input.rowOrder);
    },

  };
  const OnePagerFormulaAuditModule = {
    _queueFormulaAuditRequest(rawValue) {
      let parsed = rawValue;
      if (typeof parsed === "string") {
        try {
          parsed = JSON.parse(parsed);
        } catch (error) {
          parsed = null;
        }
      }
      if (!parsed || typeof parsed !== "object") return;
      const accountId = String(parsed.accountId || parsed.account || "").trim();
      const calculatedIndicatorId = String(parsed.calculatedIndicatorId || parsed.calculatedId || "").trim();
      if (!accountId && !calculatedIndicatorId) return;
      const subordinateIndex = Math.max(0, Number.parseInt(String(parsed.subordinateIndex || 0), 10) || 0);
      const nonce = String(parsed.nonce || parsed.requestId || `${accountId || calculatedIndicatorId}::${subordinateIndex}`).trim();
      if (nonce && nonce === this._lastFormulaAuditRequestNonce) return;
      this._lastFormulaAuditRequestNonce = nonce;
      const nonceTimestampMatch = nonce.match(/^(\d{12,})-/);
      const requestedAt = Number(parsed.requestedAt || (nonceTimestampMatch && nonceTimestampMatch[1]));
      const requestAge = Number.isFinite(requestedAt) ? Math.abs(Date.now() - requestedAt) : Infinity;
      if (requestAge > FORMULA_AUDIT_REQUEST_MAX_AGE_MS) return;
      this._pendingFormulaAuditRequest = { accountId, calculatedIndicatorId, subordinateIndex, nonce };
    },


    _processPendingFormulaAudit(model) {
      if (!this._pendingFormulaAuditRequest) return;
      const request = this._pendingFormulaAuditRequest;
      this._pendingFormulaAuditRequest = null;
      this._formulaAuditData = this._buildFormulaAuditData(model, request);
      this._formulaAuditOpen = true;
    },


    _openFormulaAudit(model, request) {
      this._formulaAuditData = this._buildFormulaAuditData(model, request);
      this._formulaAuditOpen = true;
      this._renderVisual();
    },


    _closeFormulaAudit() {
      if (!this._formulaAuditOpen) return;
      this._formulaAuditOpen = false;
      this._formulaAuditData = null;
      this._renderVisual();
    },


    _formulaAuditOperandKey(token) {
      const safe = token || {};
      if (safe.type === "calculated") {
        return `CALCULATED::${String(safe.calculatedId || safe.value || "").trim()}`;
      }
      const split = this._splitOperandValue(safe.value);
      const accountId = this._normalize(safe.accountId || split.accountId || safe.accountLabel || "");
      const measureId = this._normalize(safe.measureId || split.measureId || safe.measureLabel || "");
      return `${accountId}::${measureId}`;
    },


    _formulaAuditOperands(formula) {
      const out = [];
      const seen = new Set();
      this._normalizeFormula(formula).tokens.forEach(token => {
        if (!token || (token.type !== "measure" && token.type !== "calculated")) return;
        const key = this._formulaAuditOperandKey(token);
        if (!key || seen.has(key)) return;
        seen.add(key);
        out.push({
          key,
          token,
          label: this._formulaReadableLabel({ tokens: [token] }, token.label || token.value || "Operando")
        });
      });
      return out;
    },


    _evaluateFormulaWithTrace(formula, valueResolver) {
      const compiled = this._formulaToRpn(formula);
      if (!compiled.valid) {
        return {
          result: this._createFormulaError("FORMULA_ERROR", compiled.error || "Erro na formula"),
          operands: {},
          operations: []
        };
      }
      const stack = [];
      const operands = {};
      const operations = [];
      for (const token of compiled.rpn) {
        if (token.type === "measure" || token.type === "calculated") {
          const key = this._formulaAuditOperandKey(token);
          if (!Object.prototype.hasOwnProperty.call(operands, key)) operands[key] = this._normalizeFormulaResult(valueResolver(token));
        }
      }
      for (const token of compiled.rpn) {
        if (token.type === "measure" || token.type === "calculated") {
          const key = this._formulaAuditOperandKey(token);
          const result = operands[key];
          if (!result.ok) return { result, operands, operations };
          stack.push({ value: result.value, label: this._formulaReadableLabel({ tokens: [token] }, token.value) });
          continue;
        }
        if (token.type !== "operator" || stack.length < 2) {
          return {
            result: this._createFormulaError("FORMULA_ERROR", "Erro na formula"),
            operands,
            operations
          };
        }
        const right = stack.pop();
        const left = stack.pop();
        let value = null;
        if (token.value === "+") value = left.value + right.value;
        if (token.value === "-") value = left.value - right.value;
        if (token.value === "*") value = left.value * right.value;
        if (token.value === "/") {
          if (right.value === 0) {
            return {
              result: this._createFormulaError("DIV_ZERO", "Divisao por zero"),
              operands,
              operations
            };
          }
          value = left.value / right.value;
        }
        if (!Number.isFinite(value)) {
          return {
            result: this._createFormulaError("FORMULA_ERROR", "Erro na formula"),
            operands,
            operations
          };
        }
        operations.push({ left: left.value, operator: token.value, right: right.value, result: value });
        stack.push({ value, label: "resultado" });
      }
      const result = stack.length === 1
        ? this._createFormulaSuccess(stack[0].value)
        : this._createFormulaError("FORMULA_ERROR", "Erro na formula");
      return { result, operands, operations };
    },


    _resolveFormulaAuditDefinition(context, request) {
      if (!context || !request) return null;
      const calculatedIndicatorId = String(request.calculatedIndicatorId || "").trim();
      if (calculatedIndicatorId) {
        const catalog = context.calculatedCatalog || { byId: new Map() };
        const item = catalog.byId instanceof Map ? catalog.byId.get(calculatedIndicatorId) : null;
        if (!item) return null;
        const formula = this._normalizeFormula(item.formula);
        const formatConfig = this._calculatedIndicatorFormat(item);
        formatConfig.subordinateFormulaAggregation = item.formulaAggregation;
        return {
          accountId: item.parentId || item.id,
          accountLabel: item.parentId || "Catalogo de indicadores",
          calculatedIndicatorId: item.id,
          subordinateIndex: 0,
          subordinateLabel: item.name,
          formula,
          formatConfig,
          formulaAggregation: item.formulaAggregation,
          operands: this._formulaAuditOperands(formula)
        };
      }
      const requestToken = this._normalize(request.accountId || "");
      const accountLookup = context.accountLookup instanceof Map ? context.accountLookup : new Map();
      const resolvedAccountId = accountLookup.get(requestToken) || String(request.accountId || "").trim();
      const members = Array.isArray(context.accountMembers) ? context.accountMembers : [];
      const member = members.find(item => item && (
        String(item.id || "") === resolvedAccountId ||
        this._normalize(item.id) === requestToken ||
        this._normalize(item.label) === requestToken
      ));
      if (!member) return null;
      const parentFormat = this._normalizeDisplayFormat(this._resolveMeasureRuleForAccount(member, context.rules));
      let configs = Array.isArray(parentFormat.subordinates)
        ? parentFormat.subordinates.filter(item => item && item.enabled)
        : [];
      if (!configs.length && parentFormat.subordinate) {
        configs = [{
          enabled: true,
          formula: parentFormat.subordinateFormula,
          label: parentFormat.subordinateLabel,
          measureToken: parentFormat.subordinateMeasureToken,
          scale: parentFormat.subordinateScale,
          decimals: parentFormat.subordinateDecimals,
          ytdMode: parentFormat.subordinateYtdMode,
          weightConfig: parentFormat.subordinateWeightConfig,
          formulaAggregation: parentFormat.subordinateFormulaAggregation
        }];
      }
      const subordinateIndex = Math.max(0, Number.parseInt(String(request.subordinateIndex || 0), 10) || 0);
      const config = configs[subordinateIndex];
      if (!config) return null;
      const formula = this._normalizeFormula(config.formula);
      const formatConfig = this._normalizeDisplayFormat({
        ...parentFormat,
        measureToken: config.measureToken || parentFormat.measureToken || "",
        scale: config.scale || parentFormat.scale,
        decimals: config.decimals,
        ytdMode: config.ytdMode || parentFormat.ytdMode,
        weightConfig: config.weightConfig,
        subordinateFormulaAggregation: config.formulaAggregation || DEFAULT_DISPLAY_FORMAT.subordinateFormulaAggregation,
        subordinate: false,
        subordinates: []
      });
      formatConfig.subordinateFormulaAggregation = this._normalizeFormulaAggregation(
        config.formulaAggregation || DEFAULT_DISPLAY_FORMAT.subordinateFormulaAggregation
      );
      return {
        accountId: member.id,
        accountLabel: member.label || member.id,
        subordinateIndex,
        subordinateLabel: String(config.label || "").trim() || this._formulaReadableLabel(formula, "Indicador subordinado"),
        formula,
        formatConfig,
        formulaAggregation: formatConfig.subordinateFormulaAggregation,
        operands: this._formulaAuditOperands(formula)
      };
    },


    _formulaAuditTraceStandardPeriod(context, definition, year, month, scenarioKey) {
      const periodKey = `${year}-${String(month).padStart(2, "0")}`;
      return this._evaluateFormulaWithTrace(definition.formula, token => {
        return this._resolveFormulaOperandValue(
          context.cube,
          context.accountLookup,
          token,
          periodKey,
          scenarioKey,
          definition.formatConfig
        );
      });
    },


    _formulaAuditTraceStandardAggregated(context, definition, year, monthLimit, scenarioKey) {
      const coverageByOperand = new Map();
      const trace = this._evaluateFormulaWithTrace(definition.formula, token => {
        return this._resolveAggregatedFormulaOperandValue(
          context.cube,
          context.accountLookup,
          token,
          year,
          monthLimit,
          scenarioKey,
          context.rules,
          definition.formatConfig,
          coverageByOperand,
          context.resolveWeight ? (format, key) => context.resolveWeight(format, key, scenarioKey) : null
        );
      });
      if (trace.result && trace.result.ok) {
        const coverageError = this._validateFormulaOperandCoverage(coverageByOperand);
        if (coverageError) trace.result = coverageError;
      }
      return trace;
    },


    _formulaAuditResolveOverviewPeriod(context, token, columnKey, periodKey, formatConfig) {
      const split = this._splitOperandValue(token && token.value);
      const accountToken = this._normalize(token && (token.accountId || split.accountId || token.accountLabel || ""));
      const resolved = context.accountLookup instanceof Map ? context.accountLookup.get(accountToken) : "";
      const accountId = typeof resolved === "string" ? resolved : (resolved && resolved.id);
      if (!accountId) return this._createFormulaError("MISSING_OPERAND", "Conta/medida nao encontrada");
      const accountNode = context.formulaCube instanceof Map ? context.formulaCube.get(accountId) : null;
      const periodBuckets = accountNode && accountNode.columns instanceof Map ? accountNode.columns.get(columnKey) : null;
      const bucket = periodBuckets instanceof Map ? periodBuckets.get(periodKey) : null;
      if (!bucket) return this._createFormulaError("MISSING_OPERAND", "Conta/medida nao encontrada");
      const measureToken = this._normalize(token.measureId || split.measureId || token.measureLabel || "");
      return this._resolveScenarioBucketMeasureValue(bucket, measureToken, token, formatConfig);
    },


    _formulaAuditResolveOverviewAggregated(context, token, column, periodKeys, coverageByOperand) {
      const split = this._splitOperandValue(token && token.value);
      const accountToken = this._normalize(token && (token.accountId || split.accountId || token.accountLabel || ""));
      const resolved = context.accountLookup instanceof Map ? context.accountLookup.get(accountToken) : "";
      const accountId = typeof resolved === "string" ? resolved : (resolved && resolved.id);
      if (!accountId) return this._createFormulaError("MISSING_OPERAND", "Conta/medida nao encontrada");
      const accountNode = context.formulaCube instanceof Map ? context.formulaCube.get(accountId) : null;
      const periodBuckets = accountNode && accountNode.columns instanceof Map ? accountNode.columns.get(column.key) : null;
      if (!(periodBuckets instanceof Map)) return this._createFormulaError("MISSING_OPERAND", "Conta/medida nao encontrada");

      const accountFormat = this._normalizeDisplayFormat(this._resolveMeasureRuleForAccount({
        id: accountId,
        label: accountNode.label || token.accountLabel || accountId,
        alias: token.accountId || accountId
      }, context.rules));
      const measureToken = this._normalize(token.measureId || split.measureId || accountFormat.measureToken || "");
      const operandFormat = { ...accountFormat, measureToken: measureToken || accountFormat.measureToken || "", subordinateMeasureToken: "" };
      const mode = this._normalizeYtdMode(operandFormat.ytdMode);
      const values = new Map();
      const coveredPeriods = [];
      let firstError = null;
      (periodKeys || []).forEach(periodKey => {
        const period = this._periodFromKey(periodKey);
        const bucket = periodBuckets.get(periodKey);
        if (!period || !bucket) {
          if (!firstError) firstError = this._createFormulaError("MISSING_OPERAND", "Conta/medida nao encontrada");
          return;
        }
        const result = this._resolveScenarioBucketMeasureValue(bucket, measureToken, token, operandFormat);
        if (!result || result.ok !== true || !Number.isFinite(result.value)) {
          if (!firstError) firstError = this._normalizeFormulaResult(result);
          return;
        }
        const value = result.value;
        if (!Number.isFinite(value)) return;
        values.set(periodKey, value);
        coveredPeriods.push(periodKey);
      });
      if (!values.size) return firstError || this._createFormulaError("FORMULA_ERROR", "Erro na formula");
      this._recordFormulaOperandCoverage(coverageByOperand, token, coveredPeriods);
      return this._averageValueResult(this._aggregateMonthlyValues(values, operandFormat, context.resolveWeight ? (format, key) => context.resolveWeight(format, key, column.key) : null), operandFormat);
    },


    _formulaAuditCalculatedOverviewPeriod(context, calculatedId, column, periodKey, cacheRaw) {
      const cache = cacheRaw instanceof Map ? cacheRaw : new Map();
      const key = `${calculatedId}::${column.key}::${periodKey}`;
      if (cache.has(key)) return cache.get(key);
      const catalog = context.calculatedCatalog || { byId: new Map(), errors: new Map() };
      const item = catalog.byId instanceof Map ? catalog.byId.get(calculatedId) : null;
      const graphError = catalog.errors instanceof Map ? catalog.errors.get(calculatedId) : null;
      if (!item || graphError) {
        const error = graphError || this._createFormulaError("MISSING_CALCULATED", "Indicador calculado nao encontrado");
        cache.set(key, error);
        return error;
      }
      const formatConfig = this._calculatedIndicatorFormat(item);
      const result = this._evaluateFormula(item.formula, token => {
        if (token.type === "calculated") {
          return this._formulaAuditCalculatedOverviewPeriod(
            context,
            String(token.calculatedId || token.value || ""),
            column,
            periodKey,
            cache
          );
        }
        return this._formulaAuditResolveOverviewPeriod(context, token, column.key, periodKey, formatConfig);
      });
      cache.set(key, result);
      return result;
    },


    _formulaAuditCalculatedOverviewColumn(context, calculatedId, column, cacheRaw) {
      const cache = cacheRaw instanceof Map ? cacheRaw : new Map();
      const key = `${calculatedId}::${column.key}`;
      if (cache.has(key)) return cache.get(key);
      const catalog = context.calculatedCatalog || { byId: new Map(), errors: new Map() };
      const item = catalog.byId instanceof Map ? catalog.byId.get(calculatedId) : null;
      const graphError = catalog.errors instanceof Map ? catalog.errors.get(calculatedId) : null;
      if (!item || graphError) {
        const error = graphError || this._createFormulaError("MISSING_CALCULATED", "Indicador calculado nao encontrado");
        cache.set(key, error);
        return error;
      }
      const formatConfig = this._calculatedIndicatorFormat(item);
      const periodKeys = Array.from(context.columnPeriodKeys.get(column.key) || []).sort((a, b) => String(a).localeCompare(String(b)));
      let result;
      if (item.formulaAggregation === "aggregate_operands") {
        const coverageByOperand = new Map();
        result = this._evaluateFormula(item.formula, token => {
          if (token.type === "calculated") {
            return this._formulaAuditCalculatedOverviewColumn(
              context,
              String(token.calculatedId || token.value || ""),
              column,
              cache
            );
          }
          return this._formulaAuditResolveOverviewAggregated(context, token, column, periodKeys, coverageByOperand);
        });
        if (result && result.ok) result = this._validateFormulaOperandCoverage(coverageByOperand) || result;
      } else {
        const periodCache = new Map();
        const entries = [];
        let firstError = null;
        const hasInput = (token, key, trail = new Set()) => {
          if (token.type !== "calculated") return this._formulaAuditResolveOverviewPeriod(context, token, column.key, key, formatConfig).ok;
          const id = String(token.calculatedId || token.value || "");
          if (trail.has(id)) return false;
          const dependency = catalog.byId.get(id);
          return !!dependency && dependency.formula.tokens.some(child => hasInput(child, key, new Set(trail).add(id)));
        };
        const activeKeys = this._formulaInputPeriodKeys(item.formula, periodKeys, hasInput);
        for (const periodKey of activeKeys) {
          const period = this._periodFromKey(periodKey);
          const periodResult = this._formulaAuditCalculatedOverviewPeriod(context, item.id, column, periodKey, periodCache);
          if (!period || !periodResult || !periodResult.ok || !Number.isFinite(periodResult.value)) {
            firstError = this._normalizeFormulaResult(periodResult);
            break;
          }
          entries.push(this._averageEntry(periodResult.value, periodKey, formatConfig,
            context.resolveWeight ? (format, key) => context.resolveWeight(format, key, column.key) : null));
        }
        result = firstError || (entries.length
          ? this._averageFormulaResult(entries, formatConfig)
          : this._createFormulaError("MISSING_OPERAND", "Conta/medida nao encontrada"));
      }
      cache.set(key, result);
      return result;
    },


    _formulaAuditTraceOverviewPeriod(context, definition, column, periodKey) {
      const calculatedCache = new Map();
      return this._evaluateFormulaWithTrace(definition.formula, token => {
        if (token.type === "calculated") {
          return this._formulaAuditCalculatedOverviewPeriod(
            context,
            String(token.calculatedId || token.value || ""),
            column,
            periodKey,
            calculatedCache
          );
        }
        return this._formulaAuditResolveOverviewPeriod(context, token, column.key, periodKey, definition.formatConfig);
      });
    },


    _formulaAuditTraceOverviewAggregated(context, definition, column, periodKeys) {
      const coverageByOperand = new Map();
      const calculatedCache = new Map();
      const trace = this._evaluateFormulaWithTrace(definition.formula, token => {
        if (token.type === "calculated") {
          return this._formulaAuditCalculatedOverviewColumn(
            context,
            String(token.calculatedId || token.value || ""),
            column,
            calculatedCache
          );
        }
        return this._formulaAuditResolveOverviewAggregated(context, token, column, periodKeys, coverageByOperand);
      });
      if (trace.result && trace.result.ok) {
        const coverageError = this._validateFormulaOperandCoverage(coverageByOperand);
        if (coverageError) trace.result = coverageError;
      }
      return trace;
    },


    _formulaAuditWeightDetails(rows, formatConfig, resolveWeight) {
      if (!OnePagerAverageWeights.custom(formatConfig) || typeof resolveWeight !== "function") return;
      rows.forEach(row => {
        if (!this._periodFromKey(row.periodKey)) return;
        const weight = resolveWeight(formatConfig, row.periodKey);
        const text = Number.isFinite(weight) ? this._formatFormulaAuditRaw(weight) : "ausente";
        row.operation = (row.operation ? row.operation + " | " : "") + "Peso bruto: " + text;
      });
    },

    _formulaAuditPeriodicResult(traces, formatConfig, resolveWeight) {
      const mode = this._normalizeYtdMode(formatConfig && formatConfig.ytdMode);
      const entries = [];
      const byPeriod = new Map((traces || []).map(item => [item.periodKey, item]));
      const keys = this._formulaInputPeriodKeys({ tokens: [{ type: "measure" }] }, Array.from(byPeriod.keys()), (token, key) => {
        const trace = byPeriod.get(key).trace;
        return Object.values(trace.operands || {}).some(result => result && result.ok) ||
          (trace.result && !trace.result.ok && trace.result.errorCode !== "MISSING_OPERAND");
      });
      for (const key of keys) {
        const item = byPeriod.get(key);
        const result = item && item.trace ? this._normalizeFormulaResult(item.trace.result) : null;
        if (!result || !result.ok) {
          return result || this._createFormulaError("MISSING_OPERAND", "Conta/medida nao encontrada");
        }
        const period = this._periodFromKey(item.periodKey);
        const value = mode === "default"
          ? result.value
          : this._normalizeAverageInput(result.value, formatConfig);
        if (!period || !Number.isFinite(value)) continue;
        entries.push(this._averageEntry(value, item.periodKey, formatConfig, resolveWeight));
      }
      if (!entries.length) return this._createFormulaError("MISSING_OPERAND", "Conta/medida nao encontrada");
      return this._averageFormulaResult(entries, formatConfig);
    },


    _formulaAuditOperationText(operations) {
      return (Array.isArray(operations) ? operations : []).map(item => {
        const operator = item.operator === "*" ? "×" : (item.operator === "/" ? "÷" : item.operator);
        return `${this._formatFormulaAuditRaw(item.left)} ${operator} ${this._formatFormulaAuditRaw(item.right)} = ${this._formatFormulaAuditRaw(item.result)}`;
      }).join("; ");
    },


    _formulaAuditDetailRow(periodKey, versionLabel, trace, definition, kind = "period") {
      const safeTrace = trace || { result: this._createFormulaError("FORMULA_ERROR", "Erro na formula"), operands: {}, operations: [] };
      const result = this._normalizeFormulaResult(safeTrace.result);
      const values = {};
      definition.operands.forEach(operand => {
        const operandResult = safeTrace.operands ? safeTrace.operands[operand.key] : null;
        values[operand.key] = operandResult && operandResult.ok ? operandResult.value : null;
      });
      return {
        kind,
        periodKey,
        versionLabel,
        operandValues: values,
        result: result.ok ? result.value : null,
        operation: this._formulaAuditOperationText(safeTrace.operations),
        error: result.ok ? null : result
      };
    },


    _formulaAuditScopeStatus(configuredResult, expectedValue) {
      const result = this._normalizeFormulaResult(configuredResult);
      if (!result.ok) return { label: result.errorMessage || "Erro", tone: "error", difference: null };
      if (!Number.isFinite(expectedValue)) return { label: "Calculado", tone: "info", difference: null };
      const difference = result.value - expectedValue;
      const tolerance = Math.max(1e-8, Math.abs(expectedValue) * 1e-10);
      if (Math.abs(difference) <= tolerance) return { label: "Conferido", tone: "success", difference };
      return { label: "Divergencia", tone: "error", difference };
    },


    _buildStandardFormulaAuditScopes(context, definition, model) {
      const parentRow = (model.rows || []).find(row => row && row.accountId === definition.accountId);
      const displayed = definition.subordinateIndex === 0 && parentRow ? parentRow.subordinate : null;
      const specs = [
        {
          year: context.selectedYear,
          monthLimit: context.selectedMonth,
          scenarioKey: "actual",
          label: `${context.selectedYear} | ${context.actualLabel}`,
          expected: displayed && displayed.ytdActual
        },
        {
          year: context.selectedYear,
          monthLimit: context.selectedMonth,
          scenarioKey: "budget",
          label: `${context.selectedYear} | ${context.budgetLabel}`,
          expected: displayed && displayed.ytdBudget
        },
        {
          year: context.previousYear,
          monthLimit: context.selectedMonth,
          scenarioKey: "actual",
          label: `${context.previousYear} | ${context.actualLabel}`,
          expected: displayed && displayed.previousYtdActual
        }
      ];
      return specs.map(spec => {
        const traceItems = [];
        const rows = [];
        for (let month = 1; month <= spec.monthLimit; month += 1) {
          const periodKey = `${spec.year}-${String(month).padStart(2, "0")}`;
          const trace = this._formulaAuditTraceStandardPeriod(context, definition, spec.year, month, spec.scenarioKey);
          traceItems.push({ periodKey, trace });
          rows.push(this._formulaAuditDetailRow(periodKey, spec.label, trace, definition));
        }
        this._formulaAuditWeightDetails(rows, definition.formatConfig,
          context.resolveWeight ? (format, key) => context.resolveWeight(format, key, spec.scenarioKey) : null);
        const periodicResult = this._formulaAuditPeriodicResult(traceItems, definition.formatConfig,
          context.resolveWeight ? (format, key) => context.resolveWeight(format, key, spec.scenarioKey) : null);
        const aggregateTrace = this._formulaAuditTraceStandardAggregated(
          context,
          definition,
          spec.year,
          spec.monthLimit,
          spec.scenarioKey
        );
        const aggregateResult = aggregateTrace.result;
        rows.push(this._formulaAuditDetailRow("YTD - agregar operandos", spec.label, aggregateTrace, definition, "summary"));
        rows.push({
          kind: "summary",
          periodKey: "YTD - mes a mes",
          versionLabel: spec.label,
          operandValues: {},
          result: this._resultValue(periodicResult),
          operation: `Agregacao ${this._ytdModeLabel(definition.formatConfig.ytdMode)}`,
          error: this._resultError(periodicResult)
        });
        const configuredResult = definition.formulaAggregation === "aggregate_operands" ? aggregateResult : periodicResult;
        const status = this._formulaAuditScopeStatus(configuredResult, spec.expected);
        return {
          label: spec.label,
          expected: Number.isFinite(spec.expected) ? spec.expected : null,
          periodicResult,
          aggregateResult,
          configuredResult,
          status,
          rows
        };
      });
    },


    _buildOverviewFormulaAuditScopes(context, definition, model) {
      const view = model.overviewView || {};
      const targetRow = (view.rows || []).find(row => row && (
        definition.calculatedIndicatorId
          ? row.calculatedIndicatorId === definition.calculatedIndicatorId
          : (row.isOverviewSubordinate && row.parentAccountId === definition.accountId && row.subordinateIndex === definition.subordinateIndex)
      ));
      return (context.columns || []).map((column, columnIndex) => {
        const periodKeys = Array.from(context.columnPeriodKeys.get(column.key) || [])
          .sort((a, b) => String(a).localeCompare(String(b)));
        const traceItems = periodKeys.map(periodKey => ({
          periodKey,
          trace: this._formulaAuditTraceOverviewPeriod(context, definition, column, periodKey)
        }));
        const rows = traceItems.map(item => this._formulaAuditDetailRow(
          item.periodKey,
          `${column.year} | ${column.versionLabel}`,
          item.trace,
          definition
        ));
        this._formulaAuditWeightDetails(rows, definition.formatConfig,
          context.resolveWeight ? (format, key) => context.resolveWeight(format, key, column.key) : null);
        const periodicResult = this._formulaAuditPeriodicResult(traceItems, definition.formatConfig,
          context.resolveWeight ? (format, key) => context.resolveWeight(format, key, column.key) : null);
        const aggregateTrace = this._formulaAuditTraceOverviewAggregated(context, definition, column, periodKeys);
        const aggregateResult = aggregateTrace.result;
        rows.push(this._formulaAuditDetailRow(
          "YTD - agregar operandos",
          `${column.year} | ${column.versionLabel}`,
          aggregateTrace,
          definition,
          "summary"
        ));
        rows.push({
          kind: "summary",
          periodKey: "YTD - mes a mes",
          versionLabel: `${column.year} | ${column.versionLabel}`,
          operandValues: {},
          result: this._resultValue(periodicResult),
          operation: `Agregacao ${this._ytdModeLabel(definition.formatConfig.ytdMode)}`,
          error: this._resultError(periodicResult)
        });
        const configuredResult = definition.formulaAggregation === "aggregate_operands" ? aggregateResult : periodicResult;
        const expected = targetRow && Array.isArray(targetRow.values) ? targetRow.values[columnIndex] : null;
        const status = this._formulaAuditScopeStatus(configuredResult, expected);
        return {
          label: `${column.year} | ${column.versionLabel}`,
          expected: Number.isFinite(expected) ? expected : null,
          periodicResult,
          aggregateResult,
          configuredResult,
          status,
          rows
        };
      });
    },


    _buildFormulaAuditData(model, request) {
      const context = this._formulaAuditContext;
      if (!context) {
        return { error: "A memoria de calculo esta disponivel nos presets Realizado x Orcado e Anual por contas." };
      }
      const definition = this._resolveFormulaAuditDefinition(context, request);
      if (!definition) {
        return { error: "Indicador subordinado nao encontrado para auditoria." };
      }
      const validation = this._validateFormulaTokens(definition.formula.tokens);
      if (!validation.valid) {
        return {
          error: validation.error || "Formula invalida.",
          accountLabel: definition.accountLabel,
          subordinateLabel: definition.subordinateLabel
        };
      }
      const scopes = context.kind === "overview"
        ? this._buildOverviewFormulaAuditScopes(context, definition, model)
        : this._buildStandardFormulaAuditScopes(context, definition, model);
      return {
        accountId: definition.accountId,
        accountLabel: definition.accountLabel,
        subordinateIndex: definition.subordinateIndex,
        subordinateLabel: definition.subordinateLabel,
        formulaText: this._formulaReadableLabel(definition.formula),
        ytdMode: definition.formatConfig.ytdMode,
        formulaAggregation: definition.formulaAggregation,
        formatConfig: definition.formatConfig,
        operands: definition.operands,
        scopes
      };
    },


    _formatFormulaAuditRaw(value) {
      if (!Number.isFinite(value)) return "-";
      return new Intl.NumberFormat("pt-BR", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 8
      }).format(value);
    },


    _formulaAuditAggregationLabel(value) {
      return this._normalizeFormulaAggregation(value) === "aggregate_operands"
        ? "Agregar operandos"
        : "Mes a mes";
    },


    _formulaAuditStyles() {
      return `
        .formula-audit-overlay { position:absolute; inset:0; background:rgba(15,23,42,0.28); z-index:100; display:flex; align-items:center; justify-content:center; padding:18px; box-sizing:border-box; }
        .formula-audit-modal { width:min(1180px,100%); max-height:100%; background:#fff; border:1px solid #d7dde8; border-radius:12px; box-shadow:0 18px 44px rgba(15,23,42,0.26); display:flex; flex-direction:column; overflow:hidden; }
        .formula-audit-header { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:13px 16px; border-bottom:1px solid #e5eaf2; }
        .formula-audit-title { margin:0; font-size:15px; font-weight:700; color:#162235; }
        .formula-audit-header-actions { display:flex; align-items:center; gap:8px; }
        .formula-audit-button { border:1px solid #d7dde8; background:#fff; border-radius:8px; min-height:30px; padding:0 10px; color:#334155; cursor:pointer; font-size:12px; font-weight:600; }
        .formula-audit-button:hover { background:#f7f8fa; }
        .formula-audit-body { overflow:auto; padding:12px 14px 16px; }
        .formula-audit-meta { display:flex; flex-wrap:wrap; gap:7px; margin-bottom:12px; }
        .formula-audit-tag { border:1px solid #dbe3ee; border-radius:999px; background:#f8fafc; padding:4px 9px; color:#475569; font-size:11px; }
        .formula-audit-section-title { margin:15px 0 7px; color:#334155; font-size:12px; font-weight:800; letter-spacing:.06em; text-transform:uppercase; }
        .formula-audit-table { width:100%; min-width:900px; border-collapse:collapse; }
        .formula-audit-table th, .formula-audit-table td { border:1px solid #e8edf5; padding:7px 8px; white-space:normal; vertical-align:top; line-height:1.3; font-size:11px; color:#243247; text-align:left; }
        .formula-audit-table th { background:#f8fafc; color:#526174; font-size:10px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; }
        .formula-audit-table td.num { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
        .formula-audit-table tr.summary-row td { background:#f8fafc; font-weight:700; }
        .formula-audit-status { display:inline-flex; align-items:center; border-radius:999px; padding:2px 7px; font-size:10px; font-weight:700; white-space:nowrap; }
        .formula-audit-status.success { color:#027a48; background:#ecfdf3; border:1px solid #a6f4c5; }
        .formula-audit-status.error { color:#b42318; background:#fff1f0; border:1px solid #fecdca; }
        .formula-audit-status.info { color:#475467; background:#f2f4f7; border:1px solid #d0d5dd; }
        .formula-audit-error { color:#b42318; background:#fff1f0; border:1px solid #fecdca; border-radius:8px; padding:10px 12px; font-size:12px; }
      `;
    },


    _renderFormulaAuditOverlayHtml() {
      if (!this._formulaAuditOpen) return "";
      const data = this._formulaAuditData || {};
      if (data.error) {
        return `
          <div class="formula-audit-overlay" id="formulaAuditOverlay">
            <div class="formula-audit-modal" role="dialog" aria-modal="true" aria-label="Memoria de calculo">
              <div class="formula-audit-header">
                <h3 class="formula-audit-title">Memoria de calculo</h3>
                <button type="button" class="formula-audit-button" id="formulaAuditCloseBtn">Fechar</button>
              </div>
              <div class="formula-audit-body"><div class="formula-audit-error">${this._escape(data.error)}</div></div>
            </div>
          </div>
        `;
      }
      const summaryRows = (data.scopes || []).map(scope => {
        const configured = this._normalizeFormulaResult(scope.configuredResult);
        const periodic = this._normalizeFormulaResult(scope.periodicResult);
        const aggregate = this._normalizeFormulaResult(scope.aggregateResult);
        const formatValue = result => result.ok ? this._formatNumber(result.value, data.formatConfig) : this._escape(result.errorMessage || "Erro");
        return `
          <tr>
            <td>${this._escape(scope.label)}</td>
            <td>${this._escape(this._formulaAuditAggregationLabel(data.formulaAggregation))}</td>
            <td class="num">${Number.isFinite(scope.expected) ? this._formatNumber(scope.expected, data.formatConfig) : "-"}</td>
            <td class="num">${formatValue(periodic)}</td>
            <td class="num">${formatValue(aggregate)}</td>
            <td class="num">${Number.isFinite(scope.status && scope.status.difference) ? this._formatNumber(scope.status.difference, data.formatConfig) : "-"}</td>
            <td><span class="formula-audit-status ${this._escape(scope.status.tone)}">${this._escape(scope.status.label)}</span></td>
          </tr>
        `;
      }).join("");
      const operandHeaders = (data.operands || []).map(item => `<th>${this._escape(item.label)}<br><small>valor bruto</small></th>`).join("");
      const detailSections = (data.scopes || []).map(scope => {
        const rows = (scope.rows || []).map(row => {
          const operandCells = (data.operands || []).map(item => `<td class="num">${this._formatFormulaAuditRaw(row.operandValues && row.operandValues[item.key])}</td>`).join("");
          const status = row.error
            ? `<span class="formula-audit-status error">${this._escape(row.error.errorMessage || "Erro")}</span>`
            : `<span class="formula-audit-status success">OK</span>`;
          return `
            <tr class="${row.kind === "summary" ? "summary-row" : ""}">
              <td>${this._escape(row.periodKey)}</td>
              <td>${this._escape(row.versionLabel)}</td>
              ${operandCells}
              <td class="num">${this._formatFormulaAuditRaw(row.result)}</td>
              <td>${this._escape(row.operation || "-")}</td>
              <td>${status}</td>
            </tr>
          `;
        }).join("");
        return `
          <h4 class="formula-audit-section-title">${this._escape(scope.label)}</h4>
          <table class="formula-audit-table">
            <thead><tr><th>Periodo</th><th>Versao</th>${operandHeaders}<th>Resultado bruto</th><th>Operacao</th><th>Status</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        `;
      }).join("");
      return `
        <div class="formula-audit-overlay" id="formulaAuditOverlay">
          <div class="formula-audit-modal" role="dialog" aria-modal="true" aria-label="Memoria de calculo">
            <div class="formula-audit-header">
              <h3 class="formula-audit-title">Memoria de calculo - ${this._escape(data.subordinateLabel)}</h3>
              <div class="formula-audit-header-actions">
                <button type="button" class="formula-audit-button" id="formulaAuditCopyBtn">Copiar memoria</button>
                <button type="button" class="formula-audit-button" id="formulaAuditCloseBtn">Fechar</button>
              </div>
            </div>
            <div class="formula-audit-body">
              <div class="formula-audit-meta">
                <span class="formula-audit-tag"><strong>Principal:</strong> ${this._escape(data.accountLabel)}</span>
                <span class="formula-audit-tag"><strong>Formula:</strong> ${this._escape(data.formulaText)}</span>
                <span class="formula-audit-tag"><strong>Regra YTD:</strong> ${this._escape(this._ytdModeLabel(data.ytdMode))}</span>
                <span class="formula-audit-tag"><strong>Formula YTD:</strong> ${this._escape(this._formulaAuditAggregationLabel(data.formulaAggregation))}</span>
              </div>
              <h4 class="formula-audit-section-title">Conferencia do resultado</h4>
              <table class="formula-audit-table">
                <thead><tr><th>Escopo</th><th>Metodo configurado</th><th>Resultado exibido</th><th>Mes a mes</th><th>Agregar operandos</th><th>Diferenca</th><th>Status</th></tr></thead>
                <tbody>${summaryRows}</tbody>
              </table>
              ${detailSections}
            </div>
          </div>
        </div>
      `;
    },


    _formulaAuditClipboardMatrix() {
      const data = this._formulaAuditData || {};
      if (data.error) return [["ERRO", data.error]];
      const matrix = [
        ["MEMORIA DE CALCULO", data.subordinateLabel || ""],
        ["INDICADOR PRINCIPAL", data.accountLabel || ""],
        ["FORMULA", data.formulaText || ""],
        ["REGRA YTD", this._ytdModeLabel(data.ytdMode)],
        ["FORMULA YTD", this._formulaAuditAggregationLabel(data.formulaAggregation)],
        [],
        ["ESCOPO", "METODO", "RESULTADO EXIBIDO", "MES A MES", "AGREGAR OPERANDOS", "DIFERENCA", "STATUS"]
      ];
      (data.scopes || []).forEach(scope => {
        matrix.push([
          scope.label,
          this._formulaAuditAggregationLabel(data.formulaAggregation),
          Number.isFinite(scope.expected) ? scope.expected : "",
          this._resultValue(scope.periodicResult),
          this._resultValue(scope.aggregateResult),
          scope.status && scope.status.difference,
          scope.status && scope.status.label
        ]);
      });
      matrix.push([]);
      matrix.push(["PERIODO", "VERSAO", ...(data.operands || []).map(item => item.label), "RESULTADO BRUTO", "OPERACAO", "STATUS"]);
      (data.scopes || []).forEach(scope => {
        (scope.rows || []).forEach(row => {
          matrix.push([
            row.periodKey,
            row.versionLabel,
            ...(data.operands || []).map(item => row.operandValues && row.operandValues[item.key]),
            row.result,
            row.operation,
            row.error ? row.error.errorMessage : "OK"
          ]);
        });
      });
      return matrix;
    },


    async _copyFormulaAuditToClipboard() {
      const text = this._clipboardMatrixToTsv(this._formulaAuditClipboardMatrix());
      const clipboard = typeof navigator !== "undefined" ? navigator.clipboard : null;
      if (clipboard && typeof clipboard.writeText === "function") {
        await clipboard.writeText(text);
        return;
      }
      if (!this._legacyCopyText(text)) {
        throw new Error("Clipboard de texto nao suportado neste ambiente.");
      }
    },
  };
  // Illustrative content only: never passed to the binding, calculation engine or export scope.
  const ONE_PAGER_PREVIEW_GUIDES = {
    standard: {
      features: ["Realizado x Orcado", "Mes e acumulado YTD", "Deltas absolutos e %", "Subordinado por conta"],
      steps: ["No Gerador, conecte o modelo, adicione o feed Contas e inclua Data, Versao e Medidas nas dimensoes.", "Em Dados e periodo, escolha a Data Base e confira as versoes realizada e orcada.", "Em Contas e indicadores, defina a medida e a agregacao de cada conta. Ajuste escala, decimais e subordinados se necessario."]
    },
    dimension_columns: {
      features: ["Contas nas linhas", "Colunas por dimensao", "Janeiro ate a Data Base"],
      steps: ["No Gerador, adicione as contas e as dimensoes Data, Versao, Medidas e a dimensao que deseja abrir nas colunas.", "Em Dados e periodo, escolha a Dimensao das colunas e a Data Base.", "Configure medida e agregacao por conta. Se as colunas forem de versao, todas as versoes disponiveis participam da comparacao."]
    },
    overview: {
      features: ["Ano > versao", "Indicadores calculados", "Varios subordinados", "Ordem das linhas"],
      steps: ["No Gerador, adicione as contas e as dimensoes Data, Versao e Medidas.", "Em Dados e periodo, confira a dimensao de versao e escolha a Data Base. Ela limita o fim, sem excluir os anos anteriores.", "Configure medidas e agregacoes nas contas. Adicione calculados ou subordinados e organize a ordem das linhas."]
    },
    overview_balancetes: {
      features: ["Uma dimensao nas linhas", "Ano > versao", "Valores vindos do feed"],
      steps: ["No Gerador, inclua Data, Versao, Medidas e a dimensao que deseja abrir nas linhas, alem das contas de origem.", "Em Dados e periodo, selecione a Dimensao das Linhas e a Data Base.", "Em Valores de origem, confira a medida e a agregacao das contas. As linhas exibidas serao os membros da dimensao escolhida."]
    },
    overview_2: {
      features: ["Ate 4 dimensoes", "Drilldown de linhas", "Ano > versao"],
      steps: ["No Gerador, inclua as contas, Data, Versao, Medidas e as dimensoes que formarao os niveis.", "Em Dados e periodo > Drilldown de linhas, escolha as dimensoes dos niveis 1 a 4, na ordem desejada.", "Defina a Data Base e configure os valores de origem. Com os dados reais, use as setas das linhas para expandir ou recolher os niveis."]
    },
    overview_itr: {
      features: ["Trimestres e YTD", "Deltas %", "Calculados", "Media simples ou ponderada"],
      steps: ["No Gerador, adicione as contas e as dimensoes Data, Versao e Medidas. Os rotulos como 2T26 sao gerados pelo widget.", "Em Dados e periodo, mapeie Data, Medidas e Versao, escolha a versao utilizada e a Data Base.", "Configure a medida e a agregacao do trimestre / YTD em cada conta. Adicione indicadores calculados e arraste as linhas para ordenar."]
    },
    overview_itr_d: {
      features: ["Colunas ITR e YTD", "Drilldown por conta", "Dimensoes independentes", "Estado aberto ou fechado"],
      steps: ["No Gerador, adicione as contas, Data, Versao, Medidas e as dimensoes que usara para abrir as contas.", "Em Dados e periodo, mapeie as dimensoes de origem, escolha a versao e a Data Base.", "Abra cada conta em Contas e indicadores > Abertura da conta. Escolha sua dimensao de drilldown e se deve iniciar expandida ou recolhida."]
    },
    overview_bp: {
      features: ["Ativo, Passivo e PL", "Circulante / nao circulante", "Totais dos grupos", "Classificacao dinamica"],
      steps: ["No Gerador, adicione apenas contas detalhadas. Inclua o saldo inicial e todos os movimentos posteriores no binding.", "Em Dados e periodo, mapeie Data, Medidas e Versao, informe o Mes do saldo inicial e escolha a Data Base.", "Em cada conta, confira a medida e classifique area e grupo. Para a regra dinamica, inclua a dimensao Empresa e selecione-a na conta."]
    },
    overview_bp_free: {
      features: ["Saldos sem classificacao", "Indicadores calculados", "Excecao de ultimos 12 meses", "Colunas configuraveis"],
      steps: ["No Gerador, adicione as contas, Data, Versao e Medidas. Inclua o saldo inicial e o historico completo de movimentos.", "Em Dados e periodo, mapeie as dimensoes e informe o Mes do saldo inicial. Escolha comparativo ITR/YTD ou Ultimos 5 ITRs.", "Confira a medida de cada conta e adicione calculados. Saldo acumulado e o padrao; use ultimos 12 meses somente nos calculados que exigirem essa excecao."]
    }
  };

  const OnePagerPreviewModule = {
    _presetPreviewSpec(view) {
      const column = (label, percent = false, current = false) => ({ label, percent, current });
      const row = (label, values, extra = {}) => ({ label, values, ...extra });
      const pct = (current, previous) => previous ? (current - previous) / Math.abs(previous) * 100 : null;
      const financial = [
        row("Receita liquida", [1200, 1000, 900, 2200, 1700]),
        row("Custos operacionais", [700, 600, 550, 1300, 1050]),
        row("EBITDA", [500, 400, 350, 900, 650], { highlight: true })
      ];
      const itrColumns = [column("2T26", false, true), column("1T26"), column("Delta %", true), column("2T25"),
        column("Delta %", true), column("1S26", false, true), column("1S25"), column("Delta %", true)];
      const itrValues = ([current, previous, priorYear, ytd, ytdPriorYear]) => [current, previous, pct(current, previous), priorYear,
        pct(current, priorYear), ytd, ytdPriorYear, pct(ytd, ytdPriorYear)];
      const annualGroups = [{ label: "2025", span: 1, previous: true }, { label: "2026", span: 2 }];
      const annualColumns = [column("Realizado"), column("Orcado"), column("Projecao")];
      const annualRows = [row("Receita liquida", [1700, 2000, 2200]), row("Custos operacionais", [1050, 1250, 1300]),
        row("EBITDA", [650, 750, 900], { highlight: true })];
      const spec = { groups: [], columns: [], rows: [], ...ONE_PAGER_PREVIEW_GUIDES[view.mode] };
      if (view.mode === "standard") {
        spec.groups = [{ label: "2026 / JUN", span: 4 }, { label: "2026 / YTD", span: 4 }, { label: "2025 / YTD", span: 1, previous: true }];
        spec.columns = [column("Realizado"), column("Orcado"), column("Delta"), column("Delta %", true),
          column("Realizado"), column("Orcado"), column("Delta"), column("Delta %", true), column("Realizado")];
        spec.rows = financial.map(item => {
          const [actual, budget, , ytd, prior] = item.values, ytdBudget = budget * 2;
          return { ...item, values: [actual, budget, actual - budget, pct(actual, budget), ytd, ytdBudget, ytd - ytdBudget, pct(ytd, ytdBudget), prior] };
        });
      } else if (view.mode === "dimension_columns") {
        spec.groups = [{ label: "2026 / Departamento", span: 3 }];
        spec.columns = [column("Operacao A"), column("Operacao B"), column("Operacao C")];
        spec.rows = financial.map(item => ({ ...item, values: [item.values[0] * 0.5, item.values[0] * 0.3, item.values[0] * 0.2] }));
      } else if (["overview", "overview_balancetes", "overview_2"].includes(view.mode)) {
        spec.groups = annualGroups; spec.columns = annualColumns;
        spec.rows = view.mode === "overview" ? [...annualRows, row("Margem EBITDA", [650 / 1700 * 100, 37.5, 900 / 2200 * 100], { percent: true, calculated: true })]
          : [row("Operacao A", [600, 750, 800], { highlight: view.mode === "overview_2" }),
            ...(view.mode === "overview_2" ? [row("Pessoal", [400, 500, 550], { level: 1 }), row("Servicos", [200, 250, 250], { level: 1 })] : []),
            row("Operacao B", [300, 350, 400]), row("Corporativo", [150, 150, 100])];
      } else if (view.mode === "overview_itr" || view.mode === "overview_itr_d") {
        spec.columns = itrColumns;
        spec.rows = financial.flatMap(item => [
          { ...item, values: itrValues(item.values) },
          ...(view.mode === "overview_itr_d" && item.label === "Custos operacionais"
            ? [row("Pessoal", itrValues(item.values.map(value => value * 0.6)), { level: 1 }),
              row("Servicos", itrValues(item.values.map(value => value * 0.4)), { level: 1 })] : [])
        ]);
        if (view.mode === "overview_itr") {
          const margin = financial[2].values.map((value, index) => value / financial[0].values[index] * 100);
          spec.rows.push(row("Margem EBITDA", itrValues(margin), { percent: true, calculated: true }));
        }
      } else {
        const closingColumns = [column("2T26", false, true), column("1T26"), column("4T25"), column("3T25"), column("2T25")];
        const balances = amount => [amount, amount * 0.9, amount * 0.8, amount * 0.7, amount * 0.6];
        if (view.mode === "overview_bp") {
          spec.columns = [closingColumns[0], column("Delta %", true), ...closingColumns.slice(1), column("Delta %", true)];
          spec.rows = [
            ["Ativo", 4500, 0, true], ["Circulante", 2800, 1, true], ["Caixa e equivalentes", 1800, 2], ["Clientes", 1000, 2],
            ["Nao circulante", 1700, 1, true], ["Imobilizado", 1700, 2],
            ["Passivo", 2800, 0, true], ["Circulante", 1000, 1, true], ["Fornecedores", 1000, 2],
            ["Nao circulante", 1800, 1, true], ["Financiamentos", 1800, 2], ["Patrimonio Liquido", 1700, 0, true], ["Capital e reservas", 1700, 1]
          ].map(([label, amount, level, highlight]) => {
            const values = balances(amount);
            return row(label, [values[0], pct(values[0], values[1]), ...values.slice(1), pct(values[0], values[4])], { level, highlight });
          });
        } else {
          const five = view.bpColumnLayout === "last_5_itrs";
          spec.columns = five ? closingColumns : itrColumns;
          spec.rows = [["Caixa e equivalentes", 1800], ["Divida bruta", 2100], ["Divida liquida", 300]].map(([label, amount], index) => {
            const values = balances(amount);
            return row(label, five ? values : itrValues([values[0], values[1], values[4], values[0], values[4]]), { calculated: index === 2, highlight: index === 2 });
          });
        }
      }
      return spec;
    },

    _presetPreviewBindingState() {
      if (this._hasReceivedBindingRows || this._hasConfiguredBinding) return "configured";
      const metadata = this._binding?.metadata;
      const feeds = metadata?.feeds;
      if (Object.values(feeds || {}).some(feed => Array.isArray(feed?.values) && feed.values.length) ||
          Object.keys(metadata?.dimensions || {}).length || Object.keys(metadata?.mainStructureMembers || {}).length) {
        this._hasConfiguredBinding = true;
        return "configured";
      }
      // Loading, missing metadata and an empty result are not proof of empty feeds.
      const state = String(this._binding?.state || "").trim().toLowerCase();
      if (state && state !== "success") return "waiting";
      return ["accounts", "dimensions"].every(id => Array.isArray(feeds?.[id]?.values) && !feeds[id].values.length)
        ? "unconfigured" : "unknown";
    },

    _showUnconfiguredPresetPreview() {
      if (!this._hasHostUpdate) return false;
      const state = this._presetPreviewBindingState();
      if (state === "configured" || state === "waiting") return false;
      const handle = this._presetPreviewHandle;
      if (!handle || typeof handle.getMembers !== "function" || typeof handle.getDimensions !== "function") {
        if (state !== "unconfigured") return false;
        this._renderPresetPreview();
        return true;
      }
      const previous = this._presetPreviewCheck;
      if (previous) {
        if (previous.state !== "unconfigured") return false;
        this._renderPresetPreview();
        return true;
      }
      const check = { state: "pending" };
      this._presetPreviewCheck = check;
      // Read selected feeds only, never DataSource.getMembers/getResultSet. Reuse the existing handle.
      Promise.resolve().then(async () => {
        if (this._presetPreviewCheck !== check) return;
        const accounts = await handle.getMembers("accounts");
        if (this._presetPreviewCheck !== check) return;
        if (!Array.isArray(accounts)) { check.state = "unknown"; return; }
        if (accounts.length) { check.state = "configured"; this._hasConfiguredBinding = true; return; }
        const dimensions = await handle.getDimensions("dimensions");
        if (this._presetPreviewCheck !== check) return;
        if (!Array.isArray(dimensions)) { check.state = "unknown"; return; }
        check.state = dimensions.length ? "configured" : "unconfigured";
        if (check.state === "configured") this._hasConfiguredBinding = true;
        if (check.state === "unconfigured" && !this._renderSuspended && !this._updateInProgress &&
            this._lastModel?.state === "empty" && ["unknown", "unconfigured"].includes(this._presetPreviewBindingState())) {
          this._renderPresetPreview();
        }
      }).catch(() => { check.state = "unknown"; });
      return false;
    },

    _renderPresetPreview() {
      this._isDataReadyForExport = false;
      this._localModelReady = false;
      const view = this._readViewConfig(this._props[VIEW_CONFIG_PROPERTY], [], {});
      const preset = ONE_PAGER_PRESETS.find(item => item.value === view.mode) || ONE_PAGER_PRESETS[0];
      const spec = this._presetPreviewSpec(view);
      const valueText = (value, asPercent) => value == null ? "-" : asPercent ? this._formatPct(value, 1) : this._formatSignedNumber(value, 0);
      this._root.innerHTML = `
        <style>
          :host { display:block; width:100%; height:100%; min-height:0; }
          .demo { --ink:#123c39; --line:#e5ecef; --muted:#637780; box-sizing:border-box; height:100%; overflow:auto; padding:20px;
            color:var(--ink); background:#fff; font-family:"Segoe UI", Arial, sans-serif; font-size:13px; }
          .demo * { box-sizing:border-box; }
          .demo-banner { display:flex; flex-wrap:wrap; align-items:center; gap:8px 14px; padding:10px 12px; margin-bottom:18px;
            border:1px solid #d5e5dc; border-radius:6px; background:linear-gradient(105deg,#edf6ef,#f7faf8); }
          .demo-banner strong { font-size:11px; letter-spacing:.07em; }
          .demo-banner span { color:#526b60; font-size:12px; }
          .demo-heading { display:flex; flex-wrap:wrap; align-items:baseline; justify-content:space-between; gap:8px; }
          .demo h2 { margin:0; font-size:20px; font-weight:650; }
          .demo-base { font-size:10px; font-weight:600; letter-spacing:.06em; color:var(--muted); }
          .demo-intro { margin:8px 0 16px; color:var(--muted); line-height:1.5; }
          .demo-table-scroll { overflow:auto; max-height:360px; border-bottom:1px solid var(--line); }
          .demo table { width:100%; min-width:620px; border-collapse:collapse; white-space:nowrap; font-size:12px; }
          .demo caption { text-align:left; color:var(--muted); font-size:11px; padding:0 0 10px; }
          .demo thead { position:sticky; top:0; background:#fff; z-index:1; }
          .demo th, .demo td { padding:9px 10px; text-align:right; border-bottom:1px solid var(--line); }
          .demo th:first-child { text-align:left; }
          .demo tbody th { font-weight:500; padding-left:calc(10px + var(--level,0) * 16px); }
          .demo thead th { font-size:11px; font-weight:650; color:#075749; }
          .demo .demo-group { text-align:center; border-top:2px solid #09624e; background:linear-gradient(#edf5f0,#fff); }
          .demo .demo-previous { border-top-color:#b78826; background:linear-gradient(#fbf5e8,#fff); color:#916c1b; }
          .demo .demo-current { background:#edf5ef; }
          .demo .demo-total { background:#f5f7f8; }
          .demo .demo-total th { font-weight:650; }
          .demo .demo-total .demo-current { background:#e4efe7; }
          .demo-calc { margin-left:6px; color:var(--muted); font-size:10px; font-weight:400; }
          .demo-guide { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr)); gap:20px; margin-top:22px; }
          .demo h3 { font-size:12px; margin:0 0 10px; letter-spacing:.03em; }
          .demo-features { display:flex; flex-wrap:wrap; gap:6px; padding:0; margin:0; list-style:none; }
          .demo-features li { background:#f1f6f3; border:1px solid #deebe2; border-radius:5px; padding:6px 9px; font-size:11px; }
          .demo ol { margin:0; padding-left:18px; color:#445e66; line-height:1.5; }
          .demo ol li { padding:0 0 8px 3px; }
          .demo-note { margin:12px 0 0; font-size:11px; line-height:1.5; color:var(--muted); }
          .demo-waiting { margin:18px 0 0; padding-top:12px; border-top:1px solid var(--line); font-size:11px; color:var(--muted); }
        </style>
        <section class="demo" data-preset-preview="${this._escape(preset.value)}" aria-label="Demonstracao do preset, sem dados reais">
          <div class="demo-banner"><strong>DEMONSTRACAO - SEM DADOS REAIS</strong><span>Exemplo estatico para orientar a configuracao.</span></div>
          <div class="demo-heading"><h2>${this._escape(preset.label)}</h2><span class="demo-base">BASE ILUSTRATIVA: JUN/2026</span></div>
          <p class="demo-intro">${this._escape(preset.description)}</p>
          <div class="demo-table-scroll" tabindex="0" role="region" aria-label="Tabela ilustrativa; role para ver todas as colunas e linhas">
            <table><caption>Datas e valores ficticios. Montantes em milhares; percentuais identificados com %.</caption><thead>
              ${spec.groups.length ? `<tr><th rowspan="2" scope="col">INDICADOR</th>${spec.groups.map(group => `<th scope="colgroup" colspan="${group.span}" class="demo-group ${group.previous ? "demo-previous" : ""}">${this._escape(group.label)}</th>`).join("")}</tr>` : ""}
              <tr>${spec.groups.length ? "" : '<th scope="col">INDICADOR</th>'}${spec.columns.map(col => `<th scope="col" class="${col.current ? "demo-current" : ""}">${this._escape(col.label)}</th>`).join("")}</tr>
            </thead><tbody>${spec.rows.map(item => `<tr class="${item.highlight ? "demo-total" : ""}">
              <th scope="row" style="--level:${item.level || 0}">${this._escape(item.label)}${item.calculated ? '<span class="demo-calc">calculado</span>' : ""}</th>
              ${item.values.map((value, index) => `<td class="${spec.columns[index].current ? "demo-current" : ""}">${this._escape(valueText(value, item.percent || spec.columns[index].percent))}</td>`).join("")}</tr>`).join("")}</tbody></table>
          </div>
          <div class="demo-guide"><section><h3>Recursos deste preset</h3><ul class="demo-features">${spec.features.map(feature => `<li>${this._escape(feature)}</li>`).join("")}</ul>
            <p class="demo-note">A tabela acima e apenas uma ilustracao. Drilldown, busca, formulas e menus ficam disponiveis na tabela real conforme o preset.</p>
            <p class="demo-note">Use Aparencia para ajustar textos e fontes. Notas de rodape estao disponiveis em todos os presets.</p></section>
            <section><h3>Como configurar</h3><ol>${spec.steps.map(step => `<li>${this._escape(step)}</li>`).join("")}</ol></section></div>
          <p class="demo-waiting" role="status">Nenhum item foi adicionado aos feeds. Configure os dados no Gerador do SAC para sair da demonstracao. Este exemplo nao participa dos calculos nem da exportacao do widget.</p>
        </section>`;
    }
  };
  const OnePagerRenderModule = {
    _normalizeFooterNotes(value) {
      return (typeof value === "string" ? value : "").replace(/\r\n?/g, "\n")
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").slice(0, 4000).replace(/[\uD800-\uDBFF]$/, "");
    },

    _renderFooterNotes() {
      const text = this._normalizeFooterNotes(this._props[FOOTER_NOTES_PROPERTY]);
      return `<div id="footerNotes" class="footer-notes" role="note" aria-label="Notas de rodape"${text.trim() ? "" : " hidden"} style="flex:0 0 auto;margin:0 20px 16px;padding-top:8px;border-top:1px solid #edf2f7;color:#526174;font-size:11px;font-weight:400;line-height:1.4;white-space:pre-wrap;overflow-wrap:anywhere;">${this._escape(text)}</div>`;
    },

    _refreshFooterNotes() {
      // A notes-only host update must not rebuild calculations, rows or drilldown state.
      if (this._updateInProgress || this._renderSuspended || this._pendingRender || !this._localModelReady) return;
      const node = this._root.getElementById("footerNotes");
      if (!node) return;
      const text = this._normalizeFooterNotes(this._props[FOOTER_NOTES_PROPERTY]);
      if (node.textContent === text && node.hidden === !text.trim()) return;
      node.textContent = text;
      node.hidden = !text.trim();
      this._notifyRenderComplete();
    },

    _balanceSheetDisplayFormat(format, viewConfig) {
      if (!viewConfig || !["overview_bp", "overview_bp_free"].includes(viewConfig.mode)) return format;
      const scale = ["unit", "thousand", "million", "billion"].includes(viewConfig.bpDisplayScale)
        ? viewConfig.bpDisplayScale : null;
      const decimals = ["0", "1", "2", "3", "4"].includes(viewConfig.bpDisplayDecimals)
        ? Number(viewConfig.bpDisplayDecimals) : null;
      const sign = viewConfig.mode === "overview_bp" && ["positive", "negative"].includes(viewConfig.bpDisplaySign)
        ? viewConfig.bpDisplaySign : null;
      if (scale === null && decimals === null && sign === null) return format;
      // Override presentation only; preserve the saved account format and raw balances.
      return { ...format,
        ...(scale === null ? {} : { scale, displayScale: scale }),
        ...(decimals === null ? {} : { decimals }),
        ...(sign === null ? {} : { itrDisplaySign: sign })
      };
    },

    _formatNumber(value, formatConfig) {
      if (!Number.isFinite(value) || value === 0) return "-";
      const source = formatConfig || {};
      const format = {
        scale: this._normalizeScale(source.displayScale || source.scale || DEFAULT_DISPLAY_FORMAT.scale),
        decimals: this._normalizeDecimals(source.decimals)
      };
      if (format.scale === "percent") return this._formatPct(value * 100, format.decimals);
      const divisor = DISPLAY_SCALE_DIVISOR[format.scale] || 1;
      const scaled = value / divisor;
      return this._formatSignedNumber(scaled, format.decimals, format.scale === "multiple" ? "x" : "");
    },


    _formatItrNumber(value, formatConfig) {
      const sign = formatConfig && formatConfig.itrDisplaySign;
      let displayValue = value;
      if (Number.isFinite(value)) {
        if (sign === "invert") displayValue = -value;
        else if (sign === "positive") displayValue = Math.abs(value);
        else if (sign === "negative") displayValue = -Math.abs(value);
      }
      return this._formatNumber(displayValue, formatConfig);
    },


    _formatPct(value, decimals) {
      if (!Number.isFinite(value)) return "-";
      const safeDecimals = this._normalizeDecimals(decimals == null ? 0 : decimals);
      return `${this._numberFormatter(safeDecimals).format(value)}%`;
    },


    _formatSignedNumber(value, decimals, suffix = "") {
      if (!Number.isFinite(value)) return "-";
      const text = this._numberFormatter(decimals).format(Math.abs(value)) + suffix;
      return value < 0 ? `(${text})` : text;
    },


    _numberFormatter(decimals) {
      if (!this._numberFormatters) this._numberFormatters = new Map();
      if (!this._numberFormatters.has(decimals)) {
        this._numberFormatters.set(decimals, new Intl.NumberFormat("pt-BR", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals
        }));
      }
      return this._numberFormatters.get(decimals);
    },


    _deltaClass(value, formatConfig) {
      if (!Number.isFinite(value) || value === 0) return "";
      const polarity = this._normalizeDeltaPolarity(formatConfig && formatConfig.deltaPolarity);
      if (polarity === "neutral") return "";
      const positiveClass = polarity === "higher_better" ? "delta-good" : "delta-bad";
      const negativeClass = polarity === "higher_better" ? "delta-bad" : "delta-good";
      return value > 0 ? positiveClass : negativeClass;
    },


    _formulaErrorBadge(error) {
      if (!error) return "";
      const normalized = this._normalizeFormulaResult(error);
      if (!normalized || normalized.ok) return "";
      const code = normalized.errorCode || "FORMULA_ERROR";
      if (code === "MISSING_OPERAND") return "Conta/medida nao encontrada";
      if (code === "DIV_ZERO") return "Divisao por zero";
      if (code === "INVALID_WEIGHT") return "Peso indisponivel";
      return "Erro na formula";
    },


    _scaleLabel(scale) {
      const token = this._normalizeScale(scale);
      if (token === "percent") return "Percentual (%)";
      if (token === "multiple") return "Multiplo (x)";
      if (token === "thousand") return "Milhares";
      if (token === "million") return "Milhoes";
      if (token === "billion") return "Bilhoes";
      return "Inteiro";
    },


    _ytdModeLabel(mode) {
      const token = this._normalizeYtdMode(mode);
      if (token === "simple_avg") return "Media simples";
      if (token === "weighted_avg") return "Media ponderada";
      return "Padrao (soma)";
    },


    _measureTokenLabel(token) {
      const text = String(token == null ? "" : token).trim();
      return text || "Automatico";
    },


    _formulaToAuditText(formula) {
      const normalized = this._normalizeFormula(formula);
      if (!normalized.tokens.length) return "-";
      return normalized.tokens.map(token => {
        if (token.type === "measure") {
          const account = this._cleanFormulaLabel(token.accountLabel || token.accountId || "");
          const measure = this._cleanFormulaLabel(token.measureLabel || token.measureId || "");
          if (account && measure) return `${account} | ${measure}`;
          return account || measure || token.value;
        }
        if (token.type === "calculated") {
          return this._cleanFormulaLabel(token.calculatedLabel || token.label || token.calculatedId || token.value);
        }
        if (token.type === "operator") {
          if (token.value === "*") return "×";
          if (token.value === "/") return "÷";
          return token.value;
        }
        return token.value;
      }).join(" ");
    },


    _buildAuditRows(model) {
      const balanceSheet = model && model.viewConfig && ["overview_bp", "overview_bp_free"].includes(model.viewConfig.mode);
      return (model && Array.isArray(model.rows) ? model.rows : []).flatMap(row => {
        const format = this._balanceSheetDisplayFormat(
          this._normalizeDisplayFormat(row && row.formatConfig ? row.formatConfig : {}), model.viewConfig
        );
        const subordinate = row && row.subordinate ? row.subordinate : null;
        const baseRow = {
          indicator: row && row.account ? row.account : "-",
          mainMeasure: this._measureTokenLabel(format.measureToken),
          mainScale: this._scaleLabel(format.scale),
          mainDecimals: format.decimals,
          mainYtd: balanceSheet
            ? `Saldo inicial (${model.viewConfig.bpOpeningPeriod}) + movimentos ate o fechamento`
            : this._ytdModeLabel(format.ytdMode),
        };
        if (balanceSheet) return [baseRow];

        const configuredSubordinates = Array.isArray(format.subordinates) && format.subordinates.length
          ? format.subordinates
          : [];
        if (configuredSubordinates.length) {
          return configuredSubordinates.map(config => {
            const subordinateFormat = this._normalizeDisplayFormat({
              ...format,
              measureToken: config.measureToken || format.measureToken,
              scale: config.scale || format.scale,
              decimals: config.decimals,
              ytdMode: config.ytdMode || format.ytdMode,
              subordinateFormula: config.formula,
              subordinate: false,
              subordinates: []
            });
            return {
              ...baseRow,
              subordinateLabel: config.label || this._formulaReadableLabel(config.formula, "Indicador subordinado"),
              subordinateFormula: this._formulaToAuditText(config.formula),
              subordinateMeasure: this._measureTokenLabel(subordinateFormat.measureToken || format.measureToken),
              subordinateScale: this._scaleLabel(subordinateFormat.scale),
              subordinateDecimals: subordinateFormat.decimals,
              subordinateYtd: this._ytdModeLabel(subordinateFormat.ytdMode)
            };
          });
        }

        const subordinateFormat = subordinate
          ? this._normalizeDisplayFormat(subordinate.formatConfig || {})
          : null;
        return [{
          ...baseRow,
          subordinateLabel: subordinate ? (subordinate.label || "Indicador subordinado") : "",
          subordinateFormula: subordinate ? this._formulaToAuditText(subordinateFormat.subordinateFormula) : "",
          subordinateMeasure: subordinate ? this._measureTokenLabel(subordinateFormat.measureToken || format.measureToken) : "",
          subordinateScale: subordinate ? this._scaleLabel(subordinateFormat.scale) : "",
          subordinateDecimals: subordinate ? subordinateFormat.decimals : "",
          subordinateYtd: subordinate ? this._ytdModeLabel(subordinateFormat.ytdMode) : ""
        }];
      });
    },


    _renderAuditRowsHtml(auditRows) {
      return (Array.isArray(auditRows) ? auditRows : []).map((row, index) => `
        <tr>
          <td>${this._escape(String(index + 1))}</td>
          <td>${this._escape(row.indicator)}</td>
          <td>${this._escape(row.mainMeasure)}</td>
          <td>${this._escape(row.mainScale)}</td>
          <td class="num">${this._escape(row.mainDecimals)}</td>
          <td>${this._escape(row.mainYtd)}</td>
          <td>${this._escape(row.subordinateLabel || "-")}</td>
          <td>${this._escape(row.subordinateFormula || "-")}</td>
          <td>${this._escape(row.subordinateMeasure || "-")}</td>
          <td>${this._escape(row.subordinateScale || "-")}</td>
          <td class="num">${this._escape(row.subordinateDecimals || "-")}</td>
          <td>${this._escape(row.subordinateYtd || "-")}</td>
        </tr>
      `).join("");
    },


    _renderContextMenuHtml(isOpen, left, top, showFormulaAudit = false) {
      const open = !!isOpen;
      const x = Number.isFinite(left) ? left : 8;
      const y = Number.isFinite(top) ? top : 8;
      return `
          <div
            class="table-context-menu${open ? " open" : ""}"
            id="tableContextMenu"
            style="left:${this._escape(x)}px;top:${this._escape(y)}px;"
          >
            <button type="button" class="context-action" data-context-action="copy-image">Copy to clipboard (imagem)</button>
            <button type="button" class="context-action" data-context-action="copy-data">Copy data (Excel)</button>
            ${showFormulaAudit ? `<button type="button" class="context-action" data-context-action="formula-audit">Memoria de calculo</button>` : ""}
            <button type="button" class="context-action" data-context-action="audit">Audit</button>
          </div>
      `;
    },


    _renderAuditOverlayHtml(auditRowsHtml) {
      if (!this._auditOpen) return "";
      return `
          <div class="audit-overlay" id="auditOverlay">
            <div class="audit-modal" role="dialog" aria-modal="true" aria-label="Audit">
              <div class="audit-header">
                <h3 class="audit-title">Audit - Formulas por linha</h3>
                <button type="button" class="audit-close" id="auditCloseBtn">Fechar</button>
              </div>
              <div class="audit-body">
                <table class="audit-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Indicator</th>
                      <th>Measure</th>
                      <th>Scale</th>
                      <th>Decimals</th>
                      <th>YTD Rule</th>
                      <th>Subordinate</th>
                      <th>Subordinate Formula</th>
                      <th>Sub Measure</th>
                      <th>Sub Scale</th>
                      <th>Sub Decimals</th>
                      <th>Sub YTD Rule</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${auditRowsHtml || `<tr><td colspan="12">Sem linhas para auditoria.</td></tr>`}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
      `;
    },


    _escape(value) {
      return String(value == null ? "" : value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;"
      }[char]));
    },


    _renderMessage(message) {
      this._isDataReadyForExport = false;
      this._root.innerHTML = `
        <style>
          :host {
            display: block;
            width: 100%;
            height: 100%;
            box-sizing: border-box;
            font-family: "Inter", Arial, Helvetica, sans-serif;
          }
          .wrap {
            width: 100%;
            height: 100%;
            min-height: 140px;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 18px;
            border: 1px solid #d8dee6;
            border-radius: 12px;
            background: #ffffff;
            color: #1f2937;
            font-size: 15px;
            font-weight: 600;
          }
        </style>
        <div class="wrap">${this._escape(message)}</div>
      `;
    },


    _renderTable(model) {
      this._highlightedRowKeys = new Set();
      const showTotal = this._isTotalEnabled();
      const periodOptions = model.periods.map(period => `
        <button type="button" class="period-option${period.key === model.selectedPeriod.key ? " active" : ""}" data-period-key="${this._escape(period.key)}">
          ${this._escape(period.label)}
        </button>
      `).join("");

      const actualLabel = String(model.scenarioActualLabel || DEFAULT_SCENARIO_CONFIG.actualLabel).trim() || DEFAULT_SCENARIO_CONFIG.actualLabel;
      const budgetLabel = String(model.scenarioBudgetLabel || DEFAULT_SCENARIO_CONFIG.budgetLabel).trim() || DEFAULT_SCENARIO_CONFIG.budgetLabel;
      const widgetTitle = this._readLabelProperty(this._props[WIDGET_TITLE_PROPERTY], DEFAULT_WIDGET_TITLE, 120);
      const indicatorHeader = this._readLabelProperty(this._props[INDICATOR_HEADER_PROPERTY], DEFAULT_INDICATOR_HEADER, 60);
      const typography = this._readTypographyConfig(this._props[TYPOGRAPHY_CONFIG_PROPERTY]);
      const titleFontSize = typography.title;
      const headerFontSize = typography.header;
      const indicatorFontSize = typography.indicator;
      const valueFontSize = typography.value;
      const groupYearFontSize = Math.max(headerFontSize + 7, 14);
      const groupSubFontSize = Math.max(headerFontSize - 1, 9);
      const deltaHeaderFontSize = Math.max(headerFontSize + 3, headerFontSize);
      const valueSubFontSize = Math.max(valueFontSize - 2, 9);
      const indicatorSubFontSize = Math.max(indicatorFontSize - 2, 9);
      const contextMenuLeft = this._contextMenu && Number.isFinite(this._contextMenu.x) ? this._contextMenu.x : 8;
      const contextMenuTop = this._contextMenu && Number.isFinite(this._contextMenu.y) ? this._contextMenu.y : 8;
      const contextMenuOpen = !!(this._contextMenu && this._contextMenu.open);
      const contextMenuFormulaAudit = !!(this._contextMenu && this._contextMenu.hasFormulaAudit);
      const auditRows = this._auditOpen ? this._buildAuditRows(model) : [];
      const useOverviewMode = !!(model && model.viewConfig && (
        model.viewConfig.mode === "overview" ||
        model.viewConfig.mode === "overview_balancetes" ||
        model.viewConfig.mode === "overview_2" ||
        model.viewConfig.mode === "overview_itr" ||
        model.viewConfig.mode === "overview_itr_d" ||
        model.viewConfig.mode === "overview_bp" || model.viewConfig.mode === "overview_bp_free"
      ));
      if (useOverviewMode) {
        this._renderOverviewTable({
          model,
          showTotal,
          periodOptions,
          widgetTitle,
          indicatorHeader,
          titleFontSize,
          headerFontSize,
          indicatorFontSize,
          valueFontSize,
          itrRowSpacing: typography.itrRowSpacing,
          groupYearFontSize,
          groupSubFontSize,
          contextMenuLeft,
          contextMenuTop,
          contextMenuOpen,
          contextMenuFormulaAudit,
          auditRows
        });
        return;
      }
      const useDimensionColumnsMode = !!(model && model.viewConfig && model.viewConfig.mode === "dimension_columns");
      if (useDimensionColumnsMode) {
        this._renderDimensionColumnsTable({
          model,
          showTotal,
          periodOptions,
          widgetTitle,
          indicatorHeader,
          titleFontSize,
          headerFontSize,
          indicatorFontSize,
          valueFontSize,
          groupYearFontSize,
          groupSubFontSize,
          valueSubFontSize,
          contextMenuLeft,
          contextMenuTop,
          contextMenuOpen,
          contextMenuFormulaAudit,
          auditRows
        });
        return;
      }

      const rowsHtml = model.rows.map((row, index) => {
        const rowKey = row.rowKey || `${index}::${this._normalize(row.account)}`;
        const rowHighlightedByUser = this._selectedRowKeys && this._selectedRowKeys.has(rowKey);
        const rowHighlightedByConfig = !!(row && row.formatConfig && row.formatConfig.highlight);
        if (rowHighlightedByConfig) this._highlightedRowKeys.add(rowKey);
        const selectedClass = (rowHighlightedByUser || rowHighlightedByConfig) ? "is-selected" : "";
        const deltaAbsDecimals = this._resolveDeltaAbsDecimals(row.formatConfig.decimals);
        const deltaPctDecimals = this._resolveDeltaPctDecimals(row.formatConfig.decimals);
        const deltaAbsFormat = { ...row.formatConfig, decimals: deltaAbsDecimals };
        const hasSubordinate = !!(row && row.subordinate);
        const sub = hasSubordinate ? row.subordinate : null;
        const subErrors = hasSubordinate && sub && sub.errors ? sub.errors : {};
        const subDeltaAbsDecimals = hasSubordinate ? this._resolveDeltaAbsDecimals(sub.formatConfig.decimals) : null;
        const subDeltaPctDecimals = hasSubordinate ? this._resolveDeltaPctDecimals(sub.formatConfig.decimals) : null;
        const subDeltaAbsFormat = hasSubordinate ? { ...sub.formatConfig, decimals: subDeltaAbsDecimals } : null;

        const renderSubNumber = (value, format, error) => {
          const badge = this._formulaErrorBadge(error);
          if (badge) return `<span class="formula-badge" title="${this._escape(badge)}">${this._escape(badge)}</span>`;
          return this._formatNumber(value, format);
        };
        const renderSubPct = (value, decimals, error) => {
          const badge = this._formulaErrorBadge(error);
          if (badge) return `<span class="formula-badge" title="${this._escape(badge)}">${this._escape(badge)}</span>`;
          return this._formatPct(value, decimals);
        };
        const dualCell = (mainValue, mainFormat, subValue, subFormat, subError) => {
          const mainHtml = this._formatNumber(mainValue, mainFormat);
          if (!hasSubordinate) return mainHtml;
          const subHtml = renderSubNumber(subValue, subFormat, subError);
          return `<div class="cell-main">${mainHtml}</div><div class="cell-sub">${subHtml}</div>`;
        };
        const dualDeltaCell = (mainValue, mainFormat, mainPolarity, subValue, subFormat, subPolarity, subError) => {
          const mainClass = this._deltaClass(mainValue, mainPolarity);
          if (!hasSubordinate) {
            return `<div class="cell-main ${mainClass}">${this._formatNumber(mainValue, mainFormat)}</div>`;
          }
          const subClass = this._formulaErrorBadge(subError) ? "" : this._deltaClass(subValue, subPolarity);
          const subHtml = renderSubNumber(subValue, subFormat, subError);
          return `<div class="cell-main ${mainClass}">${this._formatNumber(mainValue, mainFormat)}</div><div class="cell-sub ${subClass}">${subHtml}</div>`;
        };
        const dualPctCell = (mainValue, mainDecimals, mainPolarity, subValue, subDecimals, subPolarity, subError) => {
          const mainClass = this._deltaClass(mainValue, mainPolarity);
          if (!hasSubordinate) {
            return `<div class="cell-main ${mainClass}">${this._formatPct(mainValue, mainDecimals)}</div>`;
          }
          const subClass = this._formulaErrorBadge(subError) ? "" : this._deltaClass(subValue, subPolarity);
          const subHtml = renderSubPct(subValue, subDecimals, subError);
          return `<div class="cell-main ${mainClass}">${this._formatPct(mainValue, mainDecimals)}</div><div class="cell-sub ${subClass}">${subHtml}</div>`;
        };
        return `
        <tr class="data-row ${selectedClass}" data-row-key="${this._escape(rowKey)}">
          <td class="indicator">
            <div class="cell-main">${this._escape(row.account)}</div>
            ${hasSubordinate ? `<div class="cell-sub">${this._escape(sub.label)}</div>` : ""}
          </td>
          <td class="num">${dualCell(row.monthActual, row.formatConfig, sub && sub.monthActual, sub && sub.formatConfig, subErrors.monthActual)}</td>
          <td class="num">${dualCell(row.monthBudget, row.formatConfig, sub && sub.monthBudget, sub && sub.formatConfig, subErrors.monthBudget)}</td>
          <td class="num delta-col">${dualDeltaCell(row.monthDeltaAbs, deltaAbsFormat, row.formatConfig, sub && sub.monthDeltaAbs, subDeltaAbsFormat, sub && sub.formatConfig, subErrors.monthDeltaAbs)}</td>
          <td class="num delta-col">${dualPctCell(row.monthDeltaPct, deltaPctDecimals, row.formatConfig, sub && sub.monthDeltaPct, subDeltaPctDecimals, sub && sub.formatConfig, subErrors.monthDeltaPct)}</td>
          <td class="spacer"></td>
          <td class="num">${dualCell(row.ytdActual, row.formatConfig, sub && sub.ytdActual, sub && sub.formatConfig, subErrors.ytdActual)}</td>
          <td class="num">${dualCell(row.ytdBudget, row.formatConfig, sub && sub.ytdBudget, sub && sub.formatConfig, subErrors.ytdBudget)}</td>
          <td class="num delta-col">${dualDeltaCell(row.ytdDeltaAbs, deltaAbsFormat, row.formatConfig, sub && sub.ytdDeltaAbs, subDeltaAbsFormat, sub && sub.formatConfig, subErrors.ytdDeltaAbs)}</td>
          <td class="num delta-col">${dualPctCell(row.ytdDeltaPct, deltaPctDecimals, row.formatConfig, sub && sub.ytdDeltaPct, subDeltaPctDecimals, sub && sub.formatConfig, subErrors.ytdDeltaPct)}</td>
          <td class="spacer"></td>
          <td class="num">${dualCell(row.previousYtdActual, row.formatConfig, sub && sub.previousYtdActual, sub && sub.formatConfig, subErrors.previousYtdActual)}</td>
        </tr>
      `;
      }).join("");

      const totalDeltaAbsDecimals = this._resolveDeltaAbsDecimals(model.totalFormat.decimals);
      const totalDeltaPctDecimals = this._resolveDeltaPctDecimals(model.totalFormat.decimals);
      const totalDeltaAbsFormat = { ...model.totalFormat, decimals: totalDeltaAbsDecimals };

      const totalHtml = showTotal ? `
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td class="num">${this._formatNumber(model.totals.monthActual, model.totalFormat)}</td>
                  <td class="num">${this._formatNumber(model.totals.monthBudget, model.totalFormat)}</td>
                  <td class="num">${this._formatNumber(model.totals.monthDeltaAbs, totalDeltaAbsFormat)}</td>
                  <td class="num">${this._formatPct(model.totals.monthDeltaPct, totalDeltaPctDecimals)}</td>
                  <td class="spacer"></td>
                  <td class="num">${this._formatNumber(model.totals.ytdActual, model.totalFormat)}</td>
                  <td class="num">${this._formatNumber(model.totals.ytdBudget, model.totalFormat)}</td>
                  <td class="num">${this._formatNumber(model.totals.ytdDeltaAbs, totalDeltaAbsFormat)}</td>
                  <td class="num">${this._formatPct(model.totals.ytdDeltaPct, totalDeltaPctDecimals)}</td>
                  <td class="spacer"></td>
                  <td class="num">${this._formatNumber(model.totals.previousYtdActual, model.totalFormat)}</td>
                </tr>
              </tfoot>
      ` : "";

      const auditRowsHtml = this._renderAuditRowsHtml(auditRows);
      const contextMenuHtml = this._renderContextMenuHtml(contextMenuOpen, contextMenuLeft, contextMenuTop, contextMenuFormulaAudit);
      const auditOverlayHtml = this._renderAuditOverlayHtml(auditRowsHtml);
      const formulaAuditOverlayHtml = this._renderFormulaAuditOverlayHtml();

      this._root.innerHTML = `
        <style>
          :host {
            display: block;
            width: 100%;
            height: 100%;
            box-sizing: border-box;
            font-family: "Segoe UI", "Inter", Arial, Helvetica, sans-serif;
            color: #0f172a;
          }
          .container {
            width: 100%;
            height: 100%;
            box-sizing: border-box;
            position: relative;
            border: none;
            border-radius: 12px;
            background: #ffffff;
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }
          .export-scope {
            flex: 1;
            min-height: 0;
            display: flex;
            flex-direction: column;
          }
          .header {
            padding: 18px 20px 12px 20px;
            border-bottom: none;
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 16px;
          }
          .title-wrap {
            display: flex;
            align-items: center;
            gap: 0;
            min-width: 0;
          }
          .title {
            margin: 0;
            font-size: ${titleFontSize}px;
            line-height: 1.15;
            font-weight: 700;
            color: #083f2a;
          }
          .meta {
            display: none;
          }
          .tag {
            font-size: 10px;
            border: 1px solid #d1d8e2;
            border-radius: 999px;
            padding: 2px 8px;
            color: #4b5563;
            background: #ffffff;
          }
          .tag.warn {
            color: #92400e;
            border-color: #f0ca75;
            background: #fffbeb;
          }
          details.base-picker {
            position: relative;
            min-width: 200px;
          }
          .base-summary {
            list-style: none;
            cursor: pointer;
            user-select: none;
            font-size: 12px;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            font-weight: 700;
            color: #455066;
            border: none;
            border-radius: 999px;
            padding: 7px 12px;
            background: #ffffff;
            text-align: right;
          }
          .base-summary::-webkit-details-marker {
            display: none;
          }
          .base-summary::after {
            content: " ▼";
            font-size: 10px;
          }
          details.base-picker[open] .base-summary::after {
            content: " ▲";
          }
          .base-menu {
            position: absolute;
            right: 0;
            top: calc(100% + 6px);
            background: #ffffff;
            border: none;
            border-radius: 10px;
            box-shadow: 0 10px 24px rgba(15, 23, 42, 0.14);
            padding: 6px;
            z-index: 30;
            min-width: 210px;
            max-height: 260px;
            overflow: auto;
          }
          .period-option {
            width: 100%;
            border: none;
            border-radius: 8px;
            padding: 8px 10px;
            text-align: left;
            font-size: 12px;
            background: transparent;
            color: #1f2937;
            cursor: pointer;
          }
          .period-option:hover {
            background: #f2f8ff;
          }
          .period-option.active {
            background: #e6f2ff;
            color: #0b4f88;
            font-weight: 700;
          }
          .table-wrap {
            flex: 1;
            overflow: auto;
            padding: 8px 20px 20px 20px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            min-width: 1040px;
          }
          th, td {
            border-bottom: 1px solid #edf2f7;
            padding: 10px 8px;
            white-space: nowrap;
            line-height: 1.2;
          }
          thead tr:first-child th {
            border-bottom: none;
            padding-top: 8px;
            padding-bottom: 6px;
          }
          thead tr:nth-child(2) th {
            border-top: none;
            border-bottom: 1px solid #d7dde8;
          }
          th.group {
            text-align: center;
          }
          th.group .year {
            display: block;
            font-size: ${groupYearFontSize}px;
            font-weight: 700;
            line-height: 1.05;
            color: #0f2846;
          }
          th.group.month-group .year {
            color: #d7a61f;
          }
          th.group.ytd-group .year {
            color: #0b5a3e;
          }
          th.group.prev-group .year {
            color: #7f8aa1;
          }
          th.group .sub {
            display: block;
            font-size: ${groupSubFontSize}px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #7b879a;
            margin-top: 3px;
          }
          th.group.month-group {
            border-top: 2px solid #d7a61f;
            background: linear-gradient(180deg, rgba(215, 166, 31, 0.09) 0%, rgba(215, 166, 31, 0) 72%);
          }
          th.group.ytd-group {
            border-top: 2px solid #0b5a3e;
            background: linear-gradient(180deg, rgba(11, 90, 62, 0.09) 0%, rgba(11, 90, 62, 0) 72%);
          }
          th.group.prev-group {
            border-top: 2px solid #7f8aa1;
            background: linear-gradient(180deg, rgba(127, 138, 161, 0.09) 0%, rgba(127, 138, 161, 0) 72%);
          }
          th.col {
            font-size: ${headerFontSize}px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #58657b;
            text-align: left;
            font-weight: 700;
          }
          th.col.num {
            text-align: right;
          }
          th.col.delta-head {
            font-size: ${deltaHeaderFontSize}px;
            letter-spacing: 0;
            color: #5b6473;
          }
          th.indicator-col {
            width: 290px;
          }
          td {
            font-size: ${valueFontSize}px;
          }
          td.indicator {
            font-weight: 600;
            color: #162235;
            text-align: left;
            font-size: ${indicatorFontSize}px;
          }
          td.num {
            text-align: right;
            font-variant-numeric: tabular-nums;
          }
          .cell-main {
            display: block;
          }
          .cell-sub {
            display: block;
            margin-top: 3px;
            font-size: ${valueSubFontSize}px;
            color: #667085;
            font-weight: 500;
          }
          td.indicator .cell-main {
            font-weight: 600;
            color: #162235;
          }
          td.indicator .cell-sub {
            padding-left: 14px;
            font-size: ${indicatorSubFontSize}px;
          }
          td.num .cell-sub {
            text-align: right;
          }
          tbody tr.data-row {
            cursor: pointer;
          }
          tbody tr.data-row:hover td {
            background: #f7f8fa;
          }
          tbody tr.data-row.is-selected td {
            background: #f7f8fa;
          }
          .delta-col {
            color: #5f6b7b;
          }
          .delta-good {
            color: #027a48;
          }
          .delta-bad {
            color: #b42318;
          }
          .formula-badge {
            display: inline-block;
            padding: 1px 6px;
            border: 1px solid #f0ca75;
            border-radius: 999px;
            background: #fffbeb;
            color: #a16207;
            font-size: 10px;
            font-weight: 600;
            line-height: 1.3;
          }
          .spacer, th.spacer {
            width: 14px;
            border: none !important;
            padding: 0 !important;
            background: transparent;
          }
          tfoot td {
            background: #f7f9fc;
            border-top: 1px solid #d7dde8;
            border-bottom: 1px solid #d7dde8;
            font-weight: 700;
          }
          .table-context-menu {
            position: absolute;
            min-width: 230px;
            background: #ffffff;
            border: 1px solid #d7dde8;
            border-radius: 10px;
            box-shadow: 0 10px 24px rgba(15, 23, 42, 0.18);
            padding: 6px;
            z-index: 80;
            display: none;
          }
          .table-context-menu.open {
            display: block;
          }
          .context-action {
            width: 100%;
            border: none;
            background: transparent;
            text-align: left;
            padding: 9px 10px;
            border-radius: 8px;
            color: #162235;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
          }
          .context-action:hover {
            background: #f7f8fa;
          }
          .audit-overlay {
            position: absolute;
            inset: 0;
            background: rgba(15, 23, 42, 0.22);
            z-index: 90;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            box-sizing: border-box;
          }
          .audit-modal {
            width: min(1120px, 100%);
            max-height: 100%;
            background: #ffffff;
            border-radius: 12px;
            box-shadow: 0 18px 40px rgba(15, 23, 42, 0.24);
            border: 1px solid #d7dde8;
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }
          .audit-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 12px 16px;
            border-bottom: 1px solid #e5eaf2;
          }
          .audit-title {
            margin: 0;
            font-size: 14px;
            font-weight: 700;
            color: #162235;
          }
          .audit-close {
            border: 1px solid #d7dde8;
            background: #ffffff;
            border-radius: 8px;
            height: 30px;
            padding: 0 10px;
            color: #334155;
            cursor: pointer;
            font-size: 12px;
            font-weight: 600;
          }
          .audit-body {
            overflow: auto;
            padding: 10px 14px 14px 14px;
          }
          .audit-table {
            width: 100%;
            min-width: 980px;
            border-collapse: collapse;
          }
          .audit-table th,
          .audit-table td {
            border: 1px solid #e8edf5;
            padding: 7px 8px;
            white-space: normal;
            vertical-align: top;
            line-height: 1.3;
            font-size: 12px;
            color: #243247;
            text-align: left;
          }
          .audit-table th {
            background: #f8fafc;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            font-size: 10px;
          }
          ${this._formulaAuditStyles()}
        </style>

        <div class="container">
          <div class="export-scope" id="exportScope">
            <div class="header">
              <div>
                <div class="title-wrap">
                  <h2 class="title">${this._escape(widgetTitle)}</h2>
                </div>
              </div>
              <details class="base-picker" id="basePicker">
                <summary class="base-summary">BASE: ${this._escape(model.selectedPeriod.label)}</summary>
                <div class="base-menu">${periodOptions}</div>
              </details>
            </div>

            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th class="indicator-col"></th>
                    <th colspan="4" class="group month-group">
                      <span class="year">${this._escape(model.selectedYear)}</span>
                      <span class="sub">${this._escape(MONTH_NAMES[model.selectedPeriod.month - 1])}</span>
                    </th>
                    <th class="spacer"></th>
                    <th colspan="4" class="group ytd-group">
                      <span class="year">${this._escape(model.selectedYear)}</span>
                      <span class="sub">YTD</span>
                    </th>
                    <th class="spacer"></th>
                    <th class="group prev-group">
                      <span class="year">${this._escape(model.previousYear)}</span>
                      <span class="sub">YTD</span>
                    </th>
                  </tr>
                  <tr>
                    <th class="col indicator-col">${this._escape(indicatorHeader)}</th>
                    <th class="col num">${this._escape(actualLabel)}</th>
                    <th class="col num">${this._escape(budgetLabel)}</th>
                    <th class="col num delta-head">Δ</th>
                    <th class="col num delta-head">Δ%</th>
                    <th class="spacer"></th>
                    <th class="col num">${this._escape(actualLabel)}</th>
                    <th class="col num">${this._escape(budgetLabel)}</th>
                    <th class="col num delta-head">Δ</th>
                    <th class="col num delta-head">Δ%</th>
                    <th class="spacer"></th>
                    <th class="col num">${this._escape(actualLabel)}</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml || `<tr><td colspan="12">Sem dados para o periodo selecionado.</td></tr>`}
                </tbody>
                ${totalHtml}
              </table>
            </div>
            ${this._renderFooterNotes()}
          </div>

          ${contextMenuHtml}
          ${auditOverlayHtml}
          ${formulaAuditOverlayHtml}
        </div>
      `;

      this._bindRenderInteractions(model);
    },


    _balanceSheetDeltaPresentation(row, column, columns, value) {
      const current = row.values?.[columns.findIndex(col => col.key === column.currentBalanceKey)];
      const prior = row.values?.[columns.findIndex(col => col.key === column.comparisonBalanceKey)];
      if (!Number.isFinite(current) || !Number.isFinite(prior)) return null;
      // Presentation thresholds use raw balances and percentages, never displayed precision or scale.
      const residual = Math.abs(prior) < 0.01;
      const excessive = Number.isFinite(value) && Math.abs(value) > 10000;
      if (!residual && !excessive) return null;
      const raw = number => Number.isFinite(number) ? String(number).replace(".", ",") : "-";
      const reason = residual
        ? "n.m. (nao significativo): modulo do saldo comparativo menor que 0,01."
        : "Percentual acima do limite de exibicao de 10.000% em modulo.";
      const percentage = prior === 0 ? "indefinido (base zero)"
        : (Number.isFinite(value) ? `${raw(value)}%` : "indisponivel");
      return {
        text: residual ? "n.m." : (value > 0 ? ">10.000%" : "< -10.000%"),
        title: `${reason} ${column.semanticLabel}. Saldo atual (bruto): ${raw(current)}; saldo comparativo (bruto): ${raw(prior)}; variacao absoluta (bruta): ${raw(current - prior)}; percentual calculado: ${percentage}.`
      };
    },

    _renderOverviewValueCells(row, columns, balanceSheetDeltas = false) {
      return columns.map((col, colIndex) => {
        const value = Array.isArray(row.values) ? row.values[colIndex] : null;
        const currentPeriodClass = col && col.isCurrentPeriod ? " current-period-cell" : "";
        const error = Array.isArray(row.cellErrors) ? row.cellErrors[colIndex] : null;
        const badge = this._formulaErrorBadge(error);
        if (badge) return `<td class="num${currentPeriodClass}"><span class="formula-badge" title="${this._escape(badge)}">${this._escape(badge)}</span></td>`;
        if (col && col.type === "delta_pct") {
          const decimals = this._resolveDeltaPctDecimals(row.formatConfig ? row.formatConfig.decimals : 0);
          const deltaClass = this._deltaClass(value, row.formatConfig || DEFAULT_DISPLAY_FORMAT);
          const display = balanceSheetDeltas ? this._balanceSheetDeltaPresentation(row, col, columns, value) : null;
          if (display) return `<td class="num itr-delta ${deltaClass}" title="${this._escape(display.title)}">${this._escape(display.text)}</td>`;
          return `<td class="num itr-delta ${deltaClass}">${this._formatPct(value, decimals)}</td>`;
        }
        const formattedValue = col && col.type === "value"
          ? this._formatItrNumber(value, row.formatConfig)
          : this._formatNumber(value, row.formatConfig);
        return `<td class="num${currentPeriodClass}">${formattedValue}</td>`;
      }).join("");
    },

    _renderBalanceSheetGroupRow(total, label, level, columns, balanceSheetDeltas = false) {
      const groupClass = level === "section" ? "bp-section" : "bp-subsection";
      if (!total) {
        return `<tr class="${groupClass}"><th colspan="${columns.length + 1}" scope="rowgroup">${this._escape(label)}</th></tr>`;
      }
      const title = `Total do grupo completo; nao muda com a busca. Escala: ${this._scaleLabel(total.formatConfig.scale)}.`;
      return `<tr class="${groupClass} bp-total" data-row-key="${this._escape(total.rowKey)}" data-bp-total-level="${level}" title="${this._escape(title)}">
        <th class="indicator" scope="row">${this._escape(label)}</th>
        ${this._renderOverviewValueCells(total, columns, balanceSheetDeltas)}
      </tr>`;
    },

    _renderOverviewRow(row, index, dataRows, columns, balanceSheetDeltas = false) {
      const rowKey = row.rowKey || row.drilldownKey || `${index}::${this._normalize(row.account)}`;
      if (row.formatConfig && row.formatConfig.highlight) this._highlightedRowKeys.add(rowKey);
      const selectedClass = ((this._selectedRowKeys && this._selectedRowKeys.has(rowKey))
        || (row.formatConfig && row.formatConfig.highlight)) ? "is-selected" : "";
      const isOverviewSubordinate = !!row.isOverviewSubordinate;
      const nextRow = dataRows[index + 1] || null;
      const hasOverviewSubordinatesAfter = !isOverviewSubordinate && !!(nextRow && nextRow.isOverviewSubordinate);
      const isLastOverviewSubordinate = isOverviewSubordinate && !(nextRow && nextRow.isOverviewSubordinate);
      const drilldownLevel = Math.max(0, Math.min(3, Number(row.drilldownLevel || 0)));
      const hasDrilldownChildren = !!row.hasChildren;
      const drilldownToggle = hasDrilldownChildren
        ? `<button type="button" class="drill-toggle${row.isExpanded ? " expanded" : ""}" data-drilldown-toggle="true" data-drilldown-key="${this._escape(row.drilldownKey || rowKey)}" aria-label="${this._escape(row.isExpanded ? "Recolher" : "Expandir")}"></button>`
        : `<span class="drill-spacer"></span>`;
      const valuesHtml = this._renderOverviewValueCells(row, columns, balanceSheetDeltas);
      return `
        <tr class="${row.isBalanceSheetTotal ? "bp-total" : "data-row"} drill-row drill-level-${this._escape(String(drilldownLevel))} ${hasOverviewSubordinatesAfter ? "overview-parent-with-sub" : ""} ${isOverviewSubordinate ? "overview-sub-row" : ""} ${isLastOverviewSubordinate ? "overview-sub-last" : ""} ${hasDrilldownChildren ? "has-children" : ""} ${selectedClass}" data-row-key="${this._escape(rowKey)}"${row.isBalanceSheetTotal ? ` data-bp-total-level="${this._escape(row.bpTotalLevel)}" title="${this._escape(`Total do grupo completo; nao muda com a busca. Escala: ${this._scaleLabel(row.formatConfig.scale)}.`)}"` : ""}>
          <td class="indicator">
            <div class="drill-cell" style="--drill-level:${this._escape(String(isOverviewSubordinate ? drilldownLevel + 1 : drilldownLevel))};">
              ${drilldownToggle}
              <div class="cell-main">${this._escape(row.account)}</div>
            </div>
          </td>
          ${valuesHtml}
        </tr>
      `;
    },


    _renderOverviewTable(context) {
      const cfg = context || {};
      const model = cfg.model || {};
      const showTotal = !!cfg.showTotal;
      const periodOptions = cfg.periodOptions || "";
      const widgetTitle = cfg.widgetTitle || DEFAULT_WIDGET_TITLE;
      const indicatorHeader = cfg.indicatorHeader || DEFAULT_INDICATOR_HEADER;
      const titleFontSize = cfg.titleFontSize || DEFAULT_TYPOGRAPHY_CONFIG.title;
      const headerFontSize = cfg.headerFontSize || DEFAULT_TYPOGRAPHY_CONFIG.header;
      const indicatorFontSize = cfg.indicatorFontSize || DEFAULT_TYPOGRAPHY_CONFIG.indicator;
      const valueFontSize = cfg.valueFontSize || DEFAULT_TYPOGRAPHY_CONFIG.value;
      const groupYearFontSize = cfg.groupYearFontSize || Math.max(headerFontSize + 7, 14);
      const groupSubFontSize = cfg.groupSubFontSize || Math.max(headerFontSize - 1, 9);
      const contextMenuLeft = Number.isFinite(cfg.contextMenuLeft) ? cfg.contextMenuLeft : 8;
      const contextMenuTop = Number.isFinite(cfg.contextMenuTop) ? cfg.contextMenuTop : 8;
      const contextMenuOpen = !!cfg.contextMenuOpen;
      const contextMenuFormulaAudit = !!cfg.contextMenuFormulaAudit;
      const auditRows = Array.isArray(cfg.auditRows) ? cfg.auditRows : [];

      const isItrMode = !!(model && model.viewConfig && (
        model.viewConfig.mode === "overview_itr" ||
        model.viewConfig.mode === "overview_itr_d" ||
        model.viewConfig.mode === "overview_bp" || model.viewConfig.mode === "overview_bp_free"
      ));
      const dataRowPadding = isItrMode
        ? this._normalizeFontSize(
          cfg.itrRowSpacing,
          DEFAULT_TYPOGRAPHY_CONFIG.itrRowSpacing,
          4,
          20
        )
        : 10;
      const view = isItrMode
        ? (model.overviewItrView || {})
        : (model && model.viewConfig && model.viewConfig.mode === "overview_2"
          ? (model.overview2View || {})
          : (model && model.viewConfig && model.viewConfig.mode === "overview_balancetes"
            ? (model.overviewBalancesView || {})
            : (model.overviewView || {})));
      const columns = Array.isArray(view.columns) ? view.columns : [];
      const yearGroups = Array.isArray(view.yearGroups) ? view.yearGroups : [];
      const dataRows = Array.isArray(view.rows) ? view.rows : [];
      const totals = Array.isArray(view.totals) ? view.totals : [];
      const totalFormat = view.totalFormat || model.totalFormat || DEFAULT_DISPLAY_FORMAT;
      const emptyMessage = view.message || "Sem dados ate a data base selecionada.";
      const canSwitchItrLayout = ["overview_itr", "overview_itr_d"].includes(model.viewConfig?.mode);
      const monthlyLayout = view.columnLayout === "monthly";
      const fiveItrColumns = view.mode === "overview_bp_free" && view.columnLayout === "last_5_itrs";
      const tableMinWidth = Math.max(isItrMode && !fiveItrColumns ? 1320 : 900, 280 + (columns.length * 132));

      const isBalanceSheet = view.mode === "overview_bp" || view.mode === "overview_bp_free";
      const isGroupedBalanceSheet = view.mode === "overview_bp";
      const displayRow = row => {
        const baseFormat = this._balanceSheetDisplayFormat(row.formatConfig, model.viewConfig);
        const format = isBalanceSheet && baseFormat.deltaPolarity !== "neutral"
          ? { ...baseFormat, deltaPolarity: "neutral" } : baseFormat;
        return format === row.formatConfig ? row : { ...row, formatConfig: format };
      };
      const renderBpGroup = (key, label, level) => {
        const row = view.balanceSheetTotals && view.balanceSheetTotals[key];
        return this._renderBalanceSheetGroupRow(row ? displayRow(row) : null, label, level, columns, isGroupedBalanceSheet);
      };
      const rowsHtml = dataRows.map((row, index) => {
        const newSection = isGroupedBalanceSheet && (index === 0 || dataRows[index - 1].bpSection !== row.bpSection);
        const section = newSection
          ? renderBpGroup(row.bpSection, row.bpSectionLabel, "section")
          : "";
        const classification = isGroupedBalanceSheet && row.bpClassificationLabel
          && (newSection || dataRows[index - 1].bpClassification !== row.bpClassification)
          ? renderBpGroup(`${row.bpSection}:${row.bpClassification}`, row.bpClassificationLabel, "group")
          : "";
        return section + classification + this._renderOverviewRow(displayRow(row), index, dataRows, columns, isGroupedBalanceSheet);
      }).join("");

      const totalCellsHtml = columns.map((col, colIndex) => {
        const value = totals[colIndex];
        const currentPeriodClass = col && col.isCurrentPeriod ? " current-period-cell" : "";
        if (col && col.type === "delta_pct") {
          return `<td class="num itr-delta">${this._formatPct(value, this._resolveDeltaPctDecimals(totalFormat.decimals))}</td>`;
        }
        return `<td class="num${currentPeriodClass}">${this._formatNumber(value, totalFormat)}</td>`;
      }).join("");
      const totalHtml = showTotal && !isBalanceSheet && columns.length ? `
              <tfoot>
                <tr>
                  <td>Total</td>
                  ${totalCellsHtml}
                </tr>
              </tfoot>
      ` : "";

      const overviewYearPalette = [
        { accent: "#d99a00", rgb: "217,154,0" },
        { accent: "#0b5a3e", rgb: "11,90,62" },
        { accent: "#64748b", rgb: "100,116,139" },
        { accent: "#0f766e", rgb: "15,118,110" },
        { accent: "#2563eb", rgb: "37,99,235" }
      ];
      const pickOverviewYearColor = (year, index) => {
        const yearNumber = Number(year || 0);
        const selectedYearNumber = Number(model.selectedYear || 0);
        if (selectedYearNumber && yearNumber === selectedYearNumber) {
          return { accent: "#0b5a3e", rgb: "11,90,62" };
        }
        if (selectedYearNumber && yearNumber === selectedYearNumber - 1) {
          return { accent: "#d99a00", rgb: "217,154,0" };
        }
        if (selectedYearNumber && yearNumber < selectedYearNumber - 1) {
          return { accent: "#64748b", rgb: "100,116,139" };
        }
        return overviewYearPalette[index % overviewYearPalette.length];
      };
      const yearHeaders = !isItrMode && yearGroups.length
        ? yearGroups.map((group, index) => {
          const color = pickOverviewYearColor(group.year, index);
          return `
                    <th colspan="${this._escape(String(group.colspan || 1))}" class="group overview-year-group" style="--year-accent:${this._escape(color.accent)};--year-rgb:${this._escape(color.rgb)};">
                      <span class="year">${this._escape(group.isComparison ? "VARIAÇÃO %" : group.year)}</span>
                      <span class="sub">${group.isComparison ? "COMPARAÇÕES" : "VERSION"}</span>
                    </th>
          `;
        }).join("")
        : (!isItrMode ? `<th class="group"><span class="year">-</span><span class="sub">VERSION</span></th>` : "");
      const columnHeaders = columns.map(col => {
        if (isItrMode) {
          const currentPeriodClass = col && col.isCurrentPeriod ? " current-period-col" : "";
          return `<th class="col num itr-col${currentPeriodClass}" title="${this._escape(col.semanticLabel || "")}"><span class="itr-member">${this._escape(col.memberLabel || col.versionLabel || col.versionKey || "-")}</span></th>`;
        }
        return `<th class="col num${col.type === "delta_pct" ? " delta-head" : ""}">${this._escape(col.versionLabel || col.versionKey || "-")}</th>`;
      }).join("");
      const auditRowsHtml = this._renderAuditRowsHtml(auditRows);
      const contextMenuHtml = this._renderContextMenuHtml(contextMenuOpen, contextMenuLeft, contextMenuTop, contextMenuFormulaAudit);
      const auditOverlayHtml = this._renderAuditOverlayHtml(auditRowsHtml);
      const formulaAuditOverlayHtml = this._renderFormulaAuditOverlayHtml();

      this._root.innerHTML = `
        <style>
          :host { display:block; width:100%; height:100%; box-sizing:border-box; font-family:"Segoe UI","Inter",Arial,Helvetica,sans-serif; color:#0f172a; }
          .container { width:100%; height:100%; box-sizing:border-box; position:relative; border:none; border-radius:12px; background:#ffffff; overflow:hidden; display:flex; flex-direction:column; }
          .export-scope { flex:1; min-height:0; display:flex; flex-direction:column; }
          .header { padding:18px 20px 12px 20px; display:flex; align-items:flex-start; justify-content:space-between; gap:16px; }
          .title { margin:0; font-size:${titleFontSize}px; line-height:1.15; font-weight:700; color:#083f2a; }
          details.base-picker { position:relative; min-width:200px; }
          .base-summary { list-style:none; cursor:pointer; user-select:none; font-size:12px; letter-spacing:0.12em; text-transform:uppercase; font-weight:700; color:#455066; border:none; border-radius:999px; padding:7px 12px; background:#ffffff; text-align:right; }
          .base-summary::-webkit-details-marker { display:none; }
          .base-summary::after { content:" ▼"; font-size:10px; }
          details.base-picker[open] .base-summary::after { content:" ▲"; }
          .base-menu { position:absolute; right:0; top:calc(100% + 6px); background:#ffffff; border:none; border-radius:10px; box-shadow:0 10px 24px rgba(15,23,42,0.14); padding:6px; z-index:30; min-width:210px; max-height:260px; overflow:auto; }
          .period-option { width:100%; border:none; border-radius:8px; padding:8px 10px; text-align:left; font-size:12px; background:transparent; color:#1f2937; cursor:pointer; }
          .period-option:hover { background:#f2f8ff; }
          .period-option.active { background:#e6f2ff; color:#0b4f88; font-weight:700; }
          .table-wrap { flex:1; overflow:auto; padding:8px 20px 20px 20px; }
          table { width:100%; border-collapse:collapse; min-width:${this._escape(String(tableMinWidth))}px; }
          th, td { border-bottom:1px solid #edf2f7; padding:10px 8px; white-space:nowrap; line-height:1.2; }
          tbody td { padding-top:${dataRowPadding}px; padding-bottom:${dataRowPadding}px; }
          ${canSwitchItrLayout ? `
          .itr-layout-header { flex-wrap:wrap; }
          .itr-header-actions { display:flex; align-items:center; justify-content:flex-end; flex-wrap:wrap; gap:6px; margin-left:auto; max-width:100%; }
          .itr-layout-toggle { flex:0 0 auto; border:1px solid #d9e5df; border-radius:6px; background:#fff; color:#51685b; font:inherit; font-size:11px; line-height:1.3; padding:5px 8px; cursor:pointer; }
          .itr-layout-toggle:hover { background:#f3f7f4; }
          .itr-layout-toggle[aria-pressed="true"] { background:#edf4ef; border-color:#a7c6b3; color:#0b5a3e; }
          .itr-layout-toggle:focus-visible { outline:2px solid #0b5a3e; outline-offset:2px; }
          /* Keep gutters outside the scrollport so sticky labels cover its left edge. */
          .table-wrap.itr-frozen-labels { margin:0 20px; padding-left:0; padding-right:0; }
          .itr-frozen-labels > table > thead > tr > th.indicator-col,
          .itr-frozen-labels > table > tbody > tr > td.indicator,
          .itr-frozen-labels > table > tfoot > tr > td:first-child { position:sticky; left:0; z-index:2; box-shadow:1px 0 0 #edf2f7; }
          .itr-frozen-labels > table > thead > tr > th.indicator-col { z-index:3; background:#ffffff; }
          .itr-frozen-labels > table > tbody > tr > td.indicator { background:#ffffff; }
          .itr-frozen-labels > table > tbody > tr.data-row:hover > td.indicator,
          .itr-frozen-labels > table > tbody > tr.data-row.is-selected > td.indicator { background:#f7f8fa; }
          ` : ""}
          .bp-section th, .bp-section td { background:#edf4ef; border-top:1px solid #cadcd0; padding:10px 8px; }
          .bp-section th { text-align:left; color:#0b5a3e; font-size:${indicatorFontSize}px; }
          .bp-subsection th, .bp-subsection td { background:#f7faf8; padding:7px 8px; }
          .bp-subsection th { text-align:left; color:#3d6551; font-size:${indicatorFontSize}px; padding-left:24px; font-weight:600; }
          .bp-total td { font-weight:700; }
          .bp-total td.current-period-cell { background:#e5efe3; }
          .bp-total[data-bp-total-level="section"] td.current-period-cell { background:#dce9d9; }
          .bp-notice { margin:0 20px 6px; color:#805b10; font-size:12px; }
          .bp-search { display:flex; align-items:flex-end; flex-wrap:wrap; gap:8px 12px; padding:0 20px 8px; }
          .bp-search label { display:grid; gap:4px; flex:1 1 220px; max-width:360px; min-width:0; font-size:11px; font-weight:600; color:#3d6551; }
          .bp-search input { box-sizing:border-box; width:100%; min-width:0; border:1px solid #cadcd0; border-radius:7px; padding:7px 10px; background:#ffffff; color:#162235; font:inherit; font-size:12px; }
          .bp-search button { border:1px solid #cadcd0; border-radius:7px; padding:7px 10px; background:#f7faf8; color:#0b5a3e; font:inherit; font-size:12px; cursor:pointer; }
          .bp-search input:focus-visible, .bp-search button:focus-visible { outline:2px solid #3d6551; outline-offset:2px; }
          .bp-search button:disabled { opacity:0.5; cursor:default; }
          .bp-search-status { color:#64748b; font-size:11px; padding-bottom:8px; }
          .bp-search-empty td { color:#64748b; text-align:center; padding:18px 8px; }
          tbody tr[hidden] { display:none; }
          thead tr:first-child th { border-bottom:none; padding-top:8px; padding-bottom:6px; }
          thead tr:nth-child(2) th { border-top:none; border-bottom:1px solid #d7dde8; }
          th.group { text-align:center; border-top:2px solid var(--year-accent, #0b5a3e); background:linear-gradient(180deg, rgba(var(--year-rgb, 11,90,62), 0.09) 0%, rgba(var(--year-rgb, 11,90,62), 0) 72%); }
          th.group .year { display:block; font-size:${groupYearFontSize}px; font-weight:700; line-height:1.05; color:var(--year-accent, #0b5a3e); }
          th.group .sub { display:block; font-size:${groupSubFontSize}px; text-transform:uppercase; letter-spacing:0.08em; color:#7b879a; margin-top:3px; }
          th.col { font-size:${headerFontSize}px; text-transform:uppercase; letter-spacing:0.08em; color:#58657b; text-align:left; font-weight:700; }
          th.col.num { text-align:right; }
          th.itr-col { border-top:2px solid #0b5a3e; background:linear-gradient(180deg, rgba(11,90,62,0.09) 0%, rgba(11,90,62,0) 76%); vertical-align:bottom; padding-top:9px; }
          th.itr-col.current-period-col { background:linear-gradient(180deg, rgba(52,120,62,0.18) 0%, rgba(52,120,62,0.09) 100%); }
          thead tr.itr-header-row th { border-bottom:1px solid #d7dde8; }
          .itr-member { display:block; font-size:${Math.max(11, headerFontSize + 2)}px; line-height:1.1; color:#0b5a3e; letter-spacing:0.04em; }
          th.indicator-col { width:290px; }
          td { font-size:${valueFontSize}px; }
          td.indicator { font-weight:600; color:#162235; text-align:left; font-size:${indicatorFontSize}px; }
          td.num { text-align:right; font-variant-numeric:tabular-nums; }
          td.current-period-cell { background:rgba(82,142,64,0.09); }
          tbody tr.data-row:hover td.current-period-cell,
          tbody tr.data-row.is-selected td.current-period-cell { background:rgba(82,142,64,0.14); }
          .delta-good { color:#008a5a; }
          .delta-bad { color:#df2b20; }
          .cell-main { display:block; }
          .drill-cell { display:flex; align-items:center; gap:8px; padding-left:calc(var(--drill-level, 0) * 18px); min-width:0; }
          .drill-toggle, .drill-spacer { flex:0 0 18px; width:18px; height:18px; }
          .drill-toggle {
            border:none;
            border-radius:999px;
            background:transparent;
            color:#64748b;
            cursor:pointer;
            display:inline-flex;
            align-items:center;
            justify-content:center;
            padding:0;
            transition:background-color 0.16s ease, color 0.16s ease, box-shadow 0.16s ease;
          }
          .drill-toggle:hover {
            background:#eef6f2;
            color:#0b5a3e;
            box-shadow:inset 0 0 0 1px rgba(11,90,62,0.12);
          }
          .drill-toggle:focus-visible {
            outline:2px solid rgba(11,90,62,0.24);
            outline-offset:1px;
          }
          .drill-toggle::before {
            content:"";
            width:6px;
            height:6px;
            border-right:1.6px solid currentColor;
            border-bottom:1.6px solid currentColor;
            transform:rotate(-45deg);
            transition:transform 0.16s ease;
            margin-left:-2px;
          }
          .drill-toggle.expanded::before {
            transform:rotate(45deg);
            margin-left:0;
            margin-top:-2px;
          }
          tr.has-children td.indicator .cell-main { font-weight:700; }
          tr.drill-level-1 td.indicator { color:#334155; font-weight:600; }
          tr.drill-level-2 td.indicator, tr.drill-level-3 td.indicator { color:#526174; font-weight:500; }
          tr.overview-parent-with-sub td { border-bottom:none; padding-bottom:4px; }
          tr.overview-sub-row td { color:#64748b; font-size:${Math.max(10, valueFontSize - 2)}px; }
          tr.overview-sub-row td.indicator { color:#64748b; font-weight:500; font-size:${Math.max(10, indicatorFontSize - 2)}px; }
          tr.overview-sub-row .cell-main { font-weight:500; }
          tr.overview-sub-row td { border-bottom:none; padding-top:4px; padding-bottom:6px; }
          tr.overview-sub-row.overview-sub-last td { border-bottom:1px solid #edf2f7; padding-bottom:10px; }
          tbody tr.data-row { cursor:pointer; }
          tbody tr.data-row:hover td { background:#f7f8fa; }
          tbody tr.data-row.is-selected td { background:#f7f8fa; }
          tfoot td { background:#f7f9fc; border-top:1px solid #d7dde8; border-bottom:1px solid #d7dde8; font-weight:700; }
          .table-context-menu { position:absolute; min-width:230px; background:#ffffff; border:1px solid #d7dde8; border-radius:10px; box-shadow:0 10px 24px rgba(15,23,42,0.18); padding:6px; z-index:80; display:none; }
          .table-context-menu.open { display:block; }
          .context-action { width:100%; border:none; background:transparent; text-align:left; padding:9px 10px; border-radius:8px; color:#162235; font-size:13px; font-weight:600; cursor:pointer; }
          .context-action:hover { background:#f7f8fa; }
          .formula-badge { display:inline-flex; align-items:center; justify-content:center; min-width:52px; border:1px solid #f5c2c0; border-radius:999px; padding:2px 7px; color:#9f1239; background:#fff1f2; font-size:10px; font-weight:700; line-height:1.3; }
          .audit-overlay { position:absolute; inset:0; background:rgba(15,23,42,0.22); z-index:90; display:flex; align-items:center; justify-content:center; padding:20px; box-sizing:border-box; }
          .audit-modal { width:min(1120px,100%); max-height:100%; background:#ffffff; border-radius:12px; box-shadow:0 18px 40px rgba(15,23,42,0.24); border:1px solid #d7dde8; display:flex; flex-direction:column; overflow:hidden; }
          .audit-header { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 16px; border-bottom:1px solid #e5eaf2; }
          .audit-title { margin:0; font-size:14px; font-weight:700; color:#162235; }
          .audit-close { border:1px solid #d7dde8; background:#ffffff; border-radius:8px; height:30px; padding:0 10px; color:#334155; cursor:pointer; font-size:12px; font-weight:600; }
          .audit-body { overflow:auto; padding:10px 14px 14px 14px; }
          .audit-table { width:100%; min-width:980px; border-collapse:collapse; }
          .audit-table th, .audit-table td { border:1px solid #e8edf5; padding:7px 8px; white-space:normal; vertical-align:top; line-height:1.3; font-size:12px; color:#243247; text-align:left; }
          .audit-table th { background:#f8fafc; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; font-size:10px; }
          ${this._formulaAuditStyles()}
        </style>
        <div class="container">
          <div class="export-scope" id="exportScope">
            <div class="header${canSwitchItrLayout ? " itr-layout-header" : ""}">
              <h2 class="title">${this._escape(widgetTitle)}</h2>
              ${canSwitchItrLayout ? `<div class="itr-header-actions"><button type="button" id="itrLayoutToggle" class="itr-layout-toggle" aria-pressed="${monthlyLayout}" aria-label="Visao mensal dos ultimos 12 meses" title="${monthlyLayout ? "Voltar ao comparativo ITR" : "Ver os ultimos 12 meses ate a Data Base"}">Mensal (12m)</button>` : ""}
              <details class="base-picker" id="basePicker">
                <summary class="base-summary">BASE: ${this._escape(model.selectedPeriod.label)}</summary>
                <div class="base-menu">${periodOptions}</div>
              </details>
              ${canSwitchItrLayout ? "</div>" : ""}
            </div>
            ${isBalanceSheet && view.notice ? `<p class="bp-notice" role="status">${this._escape(view.notice)}</p>` : ""}
            ${isBalanceSheet && dataRows.length ? `<div class="bp-search" id="bpSearchBar">
              <label for="bpIndicatorSearch">Buscar indicador
                <input id="bpIndicatorSearch" type="search" placeholder="Nome ou ID do indicador" maxlength="120" autocomplete="off" value="${this._escape(this._bpSearchTerm || "")}" />
              </label>
              <button type="button" id="bpSearchClear">Limpar</button>
              <span class="bp-search-status" id="bpSearchStatus" role="status" aria-live="polite" aria-atomic="true"></span>
            </div>` : ""}
            <div class="table-wrap${canSwitchItrLayout ? " itr-frozen-labels" : ""}">
              <table>
                <thead>
                  ${isItrMode ? `
                  <tr class="itr-header-row">
                    <th class="col indicator-col">${this._escape(indicatorHeader)}</th>
                    ${columnHeaders}
                  </tr>
                  ` : `
                  <tr>
                    <th class="indicator-col"></th>
                    ${yearHeaders}
                  </tr>
                  <tr>
                    <th class="col indicator-col">${this._escape(indicatorHeader)}</th>
                    ${columnHeaders}
                  </tr>
                  `}
                </thead>
                <tbody>
                  ${rowsHtml || `<tr><td colspan="${this._escape(String(Math.max(columns.length + 1, 2)))}">${this._escape(emptyMessage)}</td></tr>`}
                  ${isBalanceSheet && dataRows.length ? `<tr class="bp-search-empty" id="bpSearchEmpty" hidden><td colspan="${columns.length + 1}">Nenhum indicador encontrado. Limpe a busca para exibir todas as contas.</td></tr>` : ""}
                </tbody>
                ${totalHtml}
              </table>
            </div>
            ${this._renderFooterNotes()}
          </div>
          ${contextMenuHtml}
          ${auditOverlayHtml}
          ${formulaAuditOverlayHtml}
        </div>
      `;

      this._bindRenderInteractions(model);
    },


    _renderDimensionColumnsTable(context) {
      const cfg = context || {};
      const model = cfg.model || {};
      const showTotal = !!cfg.showTotal;
      const periodOptions = cfg.periodOptions || "";
      const widgetTitle = cfg.widgetTitle || DEFAULT_WIDGET_TITLE;
      const indicatorHeader = cfg.indicatorHeader || DEFAULT_INDICATOR_HEADER;
      const titleFontSize = cfg.titleFontSize || DEFAULT_TYPOGRAPHY_CONFIG.title;
      const headerFontSize = cfg.headerFontSize || DEFAULT_TYPOGRAPHY_CONFIG.header;
      const indicatorFontSize = cfg.indicatorFontSize || DEFAULT_TYPOGRAPHY_CONFIG.indicator;
      const valueFontSize = cfg.valueFontSize || DEFAULT_TYPOGRAPHY_CONFIG.value;
      const groupYearFontSize = cfg.groupYearFontSize || Math.max(headerFontSize + 7, 14);
      const groupSubFontSize = Math.max(headerFontSize - 1, 9);
      const contextMenuLeft = Number.isFinite(cfg.contextMenuLeft) ? cfg.contextMenuLeft : 8;
      const contextMenuTop = Number.isFinite(cfg.contextMenuTop) ? cfg.contextMenuTop : 8;
      const contextMenuOpen = !!cfg.contextMenuOpen;
      const contextMenuFormulaAudit = !!cfg.contextMenuFormulaAudit;
      const auditRows = Array.isArray(cfg.auditRows) ? cfg.auditRows : [];

      const view = model.dimensionColumnsView || {};
      const columns = Array.isArray(view.columns) ? view.columns : [];
      const dataRows = Array.isArray(view.rows) ? view.rows : [];
      const totals = Array.isArray(view.totals) ? view.totals : [];
      const totalFormat = view.totalFormat || model.totalFormat || DEFAULT_DISPLAY_FORMAT;
      const dimensionAlias = String(view.dimensionAlias || "").trim();
      const dimensionMeta = dimensionAlias && model.dimensionsMeta ? model.dimensionsMeta[dimensionAlias] : null;
      const dimensionLabel = String(
        (dimensionMeta && (dimensionMeta.description || dimensionMeta.label || dimensionMeta.id)) ||
        dimensionAlias ||
        "Dimensao"
      ).trim();
      const emptyMessage = view.message || "Sem dados para o periodo selecionado.";
      const tableMinWidth = Math.max(860, 280 + (columns.length * 150));

      const rowsHtml = dataRows.map((row, index) => {
        const rowKey = `${index}::${this._normalize(row.account)}`;
        const rowHighlightedByUser = this._selectedRowKeys && this._selectedRowKeys.has(rowKey);
        const rowHighlightedByConfig = !!(row && row.formatConfig && row.formatConfig.highlight);
        if (rowHighlightedByConfig) this._highlightedRowKeys.add(rowKey);
        const selectedClass = (rowHighlightedByUser || rowHighlightedByConfig) ? "is-selected" : "";
        const valuesHtml = columns.map((col, colIndex) => {
          const value = row && Array.isArray(row.values) ? row.values[colIndex] : 0;
          return `<td class="num">${this._formatNumber(value, row.formatConfig)}</td>`;
        }).join("");
        return `
        <tr class="data-row ${selectedClass}" data-row-key="${this._escape(rowKey)}">
          <td class="indicator"><div class="cell-main">${this._escape(row.account)}</div></td>
          ${valuesHtml}
        </tr>
      `;
      }).join("");

      const totalCellsHtml = columns.map((col, colIndex) => {
        const value = totals[colIndex] || 0;
        return `<td class="num">${this._formatNumber(value, totalFormat)}</td>`;
      }).join("");
      const totalHtml = showTotal && columns.length ? `
              <tfoot>
                <tr>
                  <td>Total</td>
                  ${totalCellsHtml}
                </tr>
              </tfoot>
      ` : "";

      const columnHeaders = columns.map(col => `<th class="col num">${this._escape(col.label || col.key || "-")}</th>`).join("");
      const auditRowsHtml = this._renderAuditRowsHtml(auditRows);
      const contextMenuHtml = this._renderContextMenuHtml(contextMenuOpen, contextMenuLeft, contextMenuTop, contextMenuFormulaAudit);
      const auditOverlayHtml = this._renderAuditOverlayHtml(auditRowsHtml);
      const formulaAuditOverlayHtml = this._renderFormulaAuditOverlayHtml();

      this._root.innerHTML = `
        <style>
          :host { display:block; width:100%; height:100%; box-sizing:border-box; font-family:"Segoe UI","Inter",Arial,Helvetica,sans-serif; color:#0f172a; }
          .container { width:100%; height:100%; box-sizing:border-box; position:relative; border:none; border-radius:12px; background:#ffffff; overflow:hidden; display:flex; flex-direction:column; }
          .export-scope { flex:1; min-height:0; display:flex; flex-direction:column; }
          .header { padding:18px 20px 12px 20px; display:flex; align-items:flex-start; justify-content:space-between; gap:16px; }
          .title { margin:0; font-size:${titleFontSize}px; line-height:1.15; font-weight:700; color:#083f2a; }
          details.base-picker { position:relative; min-width:200px; }
          .base-summary { list-style:none; cursor:pointer; user-select:none; font-size:12px; letter-spacing:0.12em; text-transform:uppercase; font-weight:700; color:#455066; border:none; border-radius:999px; padding:7px 12px; background:#ffffff; text-align:right; }
          .base-summary::-webkit-details-marker { display:none; }
          .base-summary::after { content:" ▼"; font-size:10px; }
          details.base-picker[open] .base-summary::after { content:" ▲"; }
          .base-menu { position:absolute; right:0; top:calc(100% + 6px); background:#ffffff; border:none; border-radius:10px; box-shadow:0 10px 24px rgba(15,23,42,0.14); padding:6px; z-index:30; min-width:210px; max-height:260px; overflow:auto; }
          .period-option { width:100%; border:none; border-radius:8px; padding:8px 10px; text-align:left; font-size:12px; background:transparent; color:#1f2937; cursor:pointer; }
          .period-option:hover { background:#f2f8ff; }
          .period-option.active { background:#e6f2ff; color:#0b4f88; font-weight:700; }
          .table-wrap { flex:1; overflow:auto; padding:8px 20px 20px 20px; }
          table { width:100%; border-collapse:collapse; min-width:${this._escape(String(tableMinWidth))}px; }
          th, td { border-bottom:1px solid #edf2f7; padding:10px 8px; white-space:nowrap; line-height:1.2; }
          thead tr:first-child th { border-bottom:none; padding-top:8px; padding-bottom:6px; }
          thead tr:nth-child(2) th { border-top:none; border-bottom:1px solid #d7dde8; }
          th.group { text-align:center; border-top:2px solid #0b5a3e; background:linear-gradient(180deg, rgba(11, 90, 62, 0.09) 0%, rgba(11, 90, 62, 0) 72%); }
          th.group .year { display:block; font-size:${groupYearFontSize}px; font-weight:700; line-height:1.05; color:#0b5a3e; }
          th.group .sub { display:block; font-size:${groupSubFontSize}px; text-transform:uppercase; letter-spacing:0.08em; color:#7b879a; margin-top:3px; }
          th.col { font-size:${headerFontSize}px; text-transform:uppercase; letter-spacing:0.08em; color:#58657b; text-align:left; font-weight:700; }
          th.col.num { text-align:right; }
          th.indicator-col { width:290px; }
          td { font-size:${valueFontSize}px; }
          td.indicator { font-weight:600; color:#162235; text-align:left; font-size:${indicatorFontSize}px; }
          td.num { text-align:right; font-variant-numeric:tabular-nums; }
          .cell-main { display:block; }
          tbody tr.data-row { cursor:pointer; }
          tbody tr.data-row:hover td { background:#f7f8fa; }
          tbody tr.data-row.is-selected td { background:#f7f8fa; }
          tfoot td { background:#f7f9fc; border-top:1px solid #d7dde8; border-bottom:1px solid #d7dde8; font-weight:700; }
          .table-context-menu { position:absolute; min-width:230px; background:#ffffff; border:1px solid #d7dde8; border-radius:10px; box-shadow:0 10px 24px rgba(15,23,42,0.18); padding:6px; z-index:80; display:none; }
          .table-context-menu.open { display:block; }
          .context-action { width:100%; border:none; background:transparent; text-align:left; padding:9px 10px; border-radius:8px; color:#162235; font-size:13px; font-weight:600; cursor:pointer; }
          .context-action:hover { background:#f7f8fa; }
          .audit-overlay { position:absolute; inset:0; background:rgba(15,23,42,0.22); z-index:90; display:flex; align-items:center; justify-content:center; padding:20px; box-sizing:border-box; }
          .audit-modal { width:min(1120px,100%); max-height:100%; background:#ffffff; border-radius:12px; box-shadow:0 18px 40px rgba(15,23,42,0.24); border:1px solid #d7dde8; display:flex; flex-direction:column; overflow:hidden; }
          .audit-header { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 16px; border-bottom:1px solid #e5eaf2; }
          .audit-title { margin:0; font-size:14px; font-weight:700; color:#162235; }
          .audit-close { border:1px solid #d7dde8; background:#ffffff; border-radius:8px; height:30px; padding:0 10px; color:#334155; cursor:pointer; font-size:12px; font-weight:600; }
          .audit-body { overflow:auto; padding:10px 14px 14px 14px; }
          .audit-table { width:100%; min-width:980px; border-collapse:collapse; }
          .audit-table th, .audit-table td { border:1px solid #e8edf5; padding:7px 8px; white-space:normal; vertical-align:top; line-height:1.3; font-size:12px; color:#243247; text-align:left; }
          .audit-table th { background:#f8fafc; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; font-size:10px; }
          ${this._formulaAuditStyles()}
        </style>
        <div class="container">
          <div class="export-scope" id="exportScope">
            <div class="header">
              <h2 class="title">${this._escape(widgetTitle)}</h2>
              <details class="base-picker" id="basePicker">
                <summary class="base-summary">BASE: ${this._escape(model.selectedPeriod.label)}</summary>
                <div class="base-menu">${periodOptions}</div>
              </details>
            </div>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th class="indicator-col"></th>
                    <th colspan="${this._escape(String(Math.max(columns.length, 1)))}" class="group">
                      <span class="year">${this._escape(model.selectedYear)}</span>
                      <span class="sub">${this._escape(dimensionLabel)}</span>
                    </th>
                  </tr>
                  <tr>
                    <th class="col indicator-col">${this._escape(indicatorHeader)}</th>
                    ${columnHeaders}
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml || `<tr><td colspan="${this._escape(String(Math.max(columns.length + 1, 2)))}">${this._escape(emptyMessage)}</td></tr>`}
                </tbody>
                ${totalHtml}
              </table>
            </div>
            ${this._renderFooterNotes()}
          </div>
          ${contextMenuHtml}
          ${auditOverlayHtml}
          ${formulaAuditOverlayHtml}
        </div>
      `;

      this._bindRenderInteractions(model);
    },

  };
  const OnePagerExportModule = {
    _sleep(ms) {
      const timeout = Number.isFinite(Number(ms)) ? Math.max(0, Number(ms)) : 0;
      return new Promise(resolve => setTimeout(resolve, timeout));
    },


    _waitForTwoPaints() {
      return new Promise(resolve => {
        if (typeof window !== "undefined" && window && typeof window.requestAnimationFrame === "function") {
          window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => resolve());
          });
          return;
        }
        setTimeout(resolve, 34);
      });
    },


    _hasRenderableExportScope() {
      const exportScope = this._root ? this._root.getElementById("exportScope") : null;
      if (!exportScope) return false;
      const text = String(exportScope.textContent || "").trim();
      if (!text) return false;
      if (/Aguardando dados do SAC/i.test(text)) return false;
      return true;
    },


    async _waitForExportReady(maxWaitMs = 58000) {
      const waitLimit = Number.isFinite(Number(maxWaitMs)) ? Math.max(1200, Number(maxWaitMs)) : 58000;
      const deadline = Date.now() + waitLimit;
      let forcedRender = false;

      while (Date.now() < deadline) {
        if (this._renderSuspended) return false;
        if (this._updateInProgress) {
          await this._sleep(120);
          continue;
        }
        const hadPendingRender = !!this._pendingRender;
        this._flushPendingRender();
        if (hadPendingRender) forcedRender = true;
        if (this._isDataReadyForExport && this._hasRenderableExportScope()) {
          await this._waitForTwoPaints();
          if (this._isDataReadyForExport && !this._pendingRender && !this._updateInProgress && this._hasRenderableExportScope()) return true;
          continue;
        }

        // An explicit export may flush once; waiting afterwards only observes SAC-driven updates.
        if (!forcedRender) {
          this._render();
          forcedRender = true;
          await this._waitForTwoPaints();
          if (this._isDataReadyForExport && this._hasRenderableExportScope()) return true;
        }
        await this._sleep(120);
      }
      return this._isDataReadyForExport && this._hasRenderableExportScope();
    },


    _blobToDataUrl(blob) {
      return new Promise((resolve, reject) => {
        if (!blob) {
          reject(new Error("Blob de imagem nao informado."));
          return;
        }
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Falha ao converter imagem para Base64."));
        reader.readAsDataURL(blob);
      });
    },


    async _buildExportScopePngBlob() {
      const exportScope = this._root ? this._root.getElementById("exportScope") : null;
      if (!exportScope) {
        throw new Error("Container de exportacao nao encontrado.");
      }

      const width = Math.max(1, Math.ceil(exportScope.scrollWidth));
      const height = Math.max(1, Math.ceil(exportScope.scrollHeight));
      const styleNode = this._root ? this._root.querySelector("style") : null;
      const styleText = styleNode ? String(styleNode.textContent || "") : "";
      const exportClone = exportScope.cloneNode(true);
      const searchBar = exportClone.querySelector("#bpSearchBar");
      if (searchBar && searchBar.parentNode) searchBar.parentNode.removeChild(searchBar);
      const layoutToggle = exportClone.querySelector("#itrLayoutToggle");
      if (layoutToggle && layoutToggle.parentNode) layoutToggle.parentNode.removeChild(layoutToggle);
      const frozenLabels = exportClone.querySelector(".itr-frozen-labels");
      if (frozenLabels) frozenLabels.classList.remove("itr-frozen-labels");
      const computed = (typeof window !== "undefined" && window.getComputedStyle)
        ? window.getComputedStyle(exportScope)
        : null;
      const baseFontFamily = computed && computed.fontFamily
        ? computed.fontFamily
        : "\"Segoe UI\", \"Inter\", Arial, Helvetica, sans-serif";
      const baseFontSize = computed && computed.fontSize ? computed.fontSize : "14px";
      const baseFontWeight = computed && computed.fontWeight ? computed.fontWeight : "400";
      const baseLineHeight = computed && computed.lineHeight ? computed.lineHeight : "normal";
      const baseColor = computed && computed.color ? computed.color : "#0f172a";
      const inlineFontFamily = baseFontFamily.replace(/"/g, "&quot;");

      if (exportClone && exportClone.style) {
        exportClone.style.fontFamily = baseFontFamily;
        exportClone.style.fontSize = baseFontSize;
        exportClone.style.fontWeight = baseFontWeight;
        exportClone.style.lineHeight = baseLineHeight;
        exportClone.style.color = baseColor;
        const notes = exportClone.querySelector("#footerNotes");
        if (notes && !notes.hidden && String(notes.textContent || "").trim()) {
          // Preserve the footer below the scrollable table within the captured viewport.
          exportClone.style.height = `${height}px`;
          exportClone.style.boxSizing = "border-box";
        }
      }
      const picker = exportClone.querySelector("#basePicker");
      if (picker && picker.parentNode) {
        const summary = picker.querySelector(".base-summary");
        const staticBase = document.createElement("div");
        staticBase.className = "base-summary";
        staticBase.textContent = summary ? String(summary.textContent || "").replace(/\s*[▼▲]\s*$/, "") : "";
        picker.parentNode.replaceChild(staticBase, picker);
      }

      const html = `
        <div xmlns="http://www.w3.org/1999/xhtml" style="padding:0;margin:0;background:#ffffff;width:${width}px;height:${height}px;overflow:hidden;font-family:${inlineFontFamily};font-size:${baseFontSize};font-weight:${baseFontWeight};line-height:${baseLineHeight};color:${baseColor};">
          <style>${styleText}</style>
          ${exportClone.outerHTML}
        </div>
      `;
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
          <foreignObject x="0" y="0" width="100%" height="100%">
            ${html}
          </foreignObject>
        </svg>
      `;
      const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Falha ao renderizar imagem do container de exportacao."));
        img.src = svgUrl;
      });

      const baseRatio = (typeof window !== "undefined" && window.devicePixelRatio) ? window.devicePixelRatio : 1;
      let ratio = Math.max(3, Math.ceil(baseRatio || 1));
      const maxPixels = 24000000; // limite para evitar estouro de memoria
      const targetPixels = width * height * ratio * ratio;
      if (targetPixels > maxPixels) {
        const safeRatio = Math.floor(Math.sqrt(maxPixels / (width * height)));
        ratio = Math.max(1, safeRatio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(width * ratio));
      canvas.height = Math.max(1, Math.round(height * ratio));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Nao foi possivel inicializar o canvas da copia.");
      ctx.imageSmoothingEnabled = true;
      if ("imageSmoothingQuality" in ctx) {
        ctx.imageSmoothingQuality = "high";
      }
      ctx.scale(ratio, ratio);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(image, 0, 0, width, height);

      const pngBlob = await new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
          if (blob) resolve(blob);
          else reject(new Error("Falha ao gerar PNG do container de exportacao."));
        }, "image/png");
      });

      return pngBlob;
    },


    async serializeCustomWidgetToImage() {
      const ready = await this._waitForExportReady();
      if (!ready) {
        throw new Error(
          `Widget ainda nao ficou pronto para exportacao (estado: ${this._lastModelState || "desconhecido"}).`
        );
      }
      const pngBlob = await this._buildExportScopePngBlob();
      const dataUrl = await this._blobToDataUrl(pngBlob);
      if (!dataUrl || !dataUrl.startsWith("data:image/")) {
        throw new Error("Falha ao serializar widget para imagem.");
      }
      return dataUrl;
    },


    async _copyTableAsImageToClipboard() {
      if (
        typeof navigator === "undefined" ||
        !navigator.clipboard ||
        typeof navigator.clipboard.write !== "function" ||
        typeof ClipboardItem === "undefined"
      ) {
        throw new Error("Clipboard de imagem nao suportado neste ambiente.");
      }

      const ready = await this._waitForExportReady();
      if (!ready) {
        throw new Error(
          `Widget ainda nao ficou pronto para copia (estado: ${this._lastModelState || "desconhecido"}).`
        );
      }
      const pngBlob = await this._buildExportScopePngBlob();
      const item = new ClipboardItem({ "image/png": pngBlob });
      await navigator.clipboard.write([item]);
    },


    _clipboardCellText(node) {
      return String(node && node.textContent ? node.textContent : "")
        .replace(/\u00a0/g, " ")
        .replace(/[\t\r\n]+/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim();
    },


    _tableRowsForClipboard() {
      const table = this._root ? this._root.querySelector(".table-wrap table") : null;
      if (!table || !table.rows) return [];

      const matrix = [];
      Array.from(table.rows).forEach(row => {
        if (row.hidden) return;
        const mainRow = [];
        const subordinateRow = [];
        let hasSubordinate = false;

        Array.from(row.cells || []).forEach(cell => {
          if (cell.classList && cell.classList.contains("spacer")) return;

          const span = Math.max(1, Number(cell.colSpan) || 1);
          const mainNode = cell.querySelector ? cell.querySelector(".cell-main") : null;
          const subordinateNode = cell.querySelector ? cell.querySelector(".cell-sub") : null;
          const mainText = mainNode
            ? this._clipboardCellText(mainNode)
            : this._clipboardCellText(cell);
          const subordinateText = subordinateNode
            ? this._clipboardCellText(subordinateNode)
            : "";

          mainRow.push(mainText);
          subordinateRow.push(subordinateText);
          if (subordinateText) hasSubordinate = true;

          for (let index = 1; index < span; index += 1) {
            mainRow.push("");
            subordinateRow.push("");
          }
        });

        if (mainRow.length) matrix.push(mainRow);
        if (hasSubordinate) matrix.push(subordinateRow);
      });

      const width = matrix.reduce((max, row) => Math.max(max, row.length), 0);
      return matrix.map(row => {
        const normalized = row.slice();
        while (normalized.length < width) normalized.push("");
        return normalized;
      });
    },


    _clipboardMatrixToTsv(matrix) {
      return (Array.isArray(matrix) ? matrix : [])
        .map(row => (Array.isArray(row) ? row : [])
          .map(value => String(value == null ? "" : value)
            .replace(/\u00a0/g, " ")
            .replace(/[\t\r\n]+/g, " ")
            .trim())
          .join("\t"))
        .join("\r\n");
    },


    _clipboardMatrixToHtml(matrix) {
      const rows = (Array.isArray(matrix) ? matrix : []).map((row, rowIndex) => {
        const tag = rowIndex < 2 ? "th" : "td";
        const cells = (Array.isArray(row) ? row : [])
          .map(value => `<${tag}>${this._escape(String(value == null ? "" : value))}</${tag}>`)
          .join("");
        return `<tr>${cells}</tr>`;
      }).join("");
      return `<table>${rows}</table>`;
    },


    _legacyCopyText(text) {
      if (typeof document === "undefined" || !document.body || typeof document.execCommand !== "function") {
        return false;
      }
      const textarea = document.createElement("textarea");
      textarea.value = String(text || "");
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      let copied = false;
      try {
        copied = document.execCommand("copy");
      } finally {
        textarea.remove();
      }
      return copied;
    },


    async _copyTableDataToClipboard() {
      this._flushPendingRender();
      if (this._updateInProgress || this._renderSuspended) throw new Error("Aguarde a atualizacao dos dados para copiar.");
      const matrix = this._tableRowsForClipboard();
      if (!matrix.length) throw new Error("Tabela sem dados para copiar.");

      const tsv = this._clipboardMatrixToTsv(matrix);
      const html = this._clipboardMatrixToHtml(matrix);
      const clipboard = typeof navigator !== "undefined" ? navigator.clipboard : null;

      if (
        clipboard &&
        typeof clipboard.write === "function" &&
        typeof ClipboardItem !== "undefined" &&
        typeof Blob !== "undefined"
      ) {
        try {
          const item = new ClipboardItem({
            "text/plain": new Blob([tsv], { type: "text/plain;charset=utf-8" }),
            "text/html": new Blob([html], { type: "text/html;charset=utf-8" })
          });
          await clipboard.write([item]);
          return;
        } catch (error) {
          // Alguns hosts do SAC aceitam texto, mas bloqueiam ClipboardItem com HTML.
        }
      }

      if (clipboard && typeof clipboard.writeText === "function") {
        await clipboard.writeText(tsv);
        return;
      }

      if (!this._legacyCopyText(tsv)) {
        throw new Error("Clipboard de texto nao suportado neste ambiente.");
      }
    },

  };
  const OnePagerInteractionModule = {
    _toggleItrLayout() {
      const model = this._lastModel;
      if (!this._localModelReady || this._updateInProgress || this._renderSuspended || this._pendingRender
        || !["overview_itr", "overview_itr_d"].includes(model?.viewConfig?.mode)
        || typeof model._getItrLayoutView !== "function") return;
      const layout = model.overviewItrView.columnLayout === "monthly" ? "itr" : "monthly";
      const view = model._getItrLayoutView(layout);
      this._itrLayout = layout;
      model.overviewItrView = view;
      this._closeContextMenu(false);
      this._renderVisual();
      const button = this._root.getElementById("itrLayoutToggle");
      if (button && typeof button.focus === "function") button.focus({ preventScroll: true });
    },

    _clearSelectedRows() {
      if (!this._selectedRowKeys || !this._selectedRowKeys.size) return;
      this._selectedRowKeys.clear();
      this._refreshSelection();
    },


    _openContextMenuAt(clientX, clientY, targetRowKey = "", hasFormulaAudit = false) {
      const container = this._root ? this._root.querySelector(".container") : null;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = Math.max(8, Math.round(clientX - rect.left));
      const y = Math.max(8, Math.round(clientY - rect.top));
      this._contextMenu = { open: true, x, y, targetRowKey, hasFormulaAudit };
      this._renderVisual();
    },


    _closeContextMenu(shouldRender = true) {
      if (!this._contextMenu || !this._contextMenu.open) return;
      this._contextMenu = { ...this._contextMenu, open: false };
      if (shouldRender) this._renderVisual();
    },


    _positionContextMenu() {
      if (!this._contextMenu || !this._contextMenu.open || !this._root) return;
      const menu = this._root.getElementById("tableContextMenu");
      const container = this._root.querySelector(".container");
      if (!menu || !container) return;

      const margin = 8;
      const maxLeft = Math.max(margin, container.clientWidth - menu.offsetWidth - margin);
      const maxTop = Math.max(margin, container.clientHeight - menu.offsetHeight - margin);
      const left = Math.max(margin, Math.min(this._contextMenu.x, maxLeft));
      const top = Math.max(margin, Math.min(this._contextMenu.y, maxTop));
      menu.style.left = `${left}px`;
      menu.style.top = `${top}px`;
    },


    _openAudit() {
      this._auditOpen = true;
      this._renderVisual();
    },


    _closeAudit() {
      if (!this._auditOpen) return;
      this._auditOpen = false;
      this._renderVisual();
    },


    _toggleOverview2Drilldown(key) {
      const drillKey = String(key || "").trim();
      if (!drillKey) return;
      if (!(this._overview2ExpandedKeys instanceof Set)) {
        this._overview2ExpandedKeys = new Set();
      }
      if (!(this._overview2CollapsedKeys instanceof Set)) {
        this._overview2CollapsedKeys = new Set();
      }
      const defaultExpanded = this._defaultExpandedDrilldownKeys instanceof Set
        && this._defaultExpandedDrilldownKeys.has(drillKey);
      const isExpanded = this._overview2ExpandedKeys.has(drillKey)
        || (defaultExpanded && !this._overview2CollapsedKeys.has(drillKey));
      if (isExpanded) {
        this._overview2ExpandedKeys.delete(drillKey);
        this._overview2CollapsedKeys.add(drillKey);
      } else {
        this._overview2CollapsedKeys.delete(drillKey);
        this._overview2ExpandedKeys.add(drillKey);
      }
      const model = this._lastModel;
      const mode = model && model.viewConfig && model.viewConfig.mode;
      const view = mode === "overview_itr_d" ? model.overviewItrView
        : (mode === "overview_2" ? model.overview2View : null);
      if (this._localModelReady && view && typeof view._projectRows === "function") {
        view.rows = view._projectRows();
        if (!this._patchOverviewDrilldownRows(view, drillKey)) this._renderTable(model);
        this._notifyRenderComplete();
        return;
      }
      this._render();
    },


    _patchOverviewDrilldownRows(view, drillKey) {
      const tbody = this._root && this._root.querySelector(".table-wrap table tbody");
      if (!tbody) return false;
      const rows = view.rows || [];
      const rowKey = (row, index) => row.rowKey || row.drilldownKey || `${index}::${this._normalize(row.account)}`;
      const wanted = new Set(rows.map(rowKey));
      const existing = new Map();
      Array.from(tbody.children).forEach(element => {
        const key = element.getAttribute("data-row-key");
        if (wanted.has(key)) existing.set(key, element);
        else element.remove();
      });
      let pendingHtml = "";
      rows.forEach((row, index) => {
        const element = existing.get(rowKey(row, index));
        if (!element) {
          pendingHtml += this._renderOverviewRow(row, index, rows, view.columns);
          return;
        }
        if (pendingHtml) {
          element.insertAdjacentHTML("beforebegin", pendingHtml);
          pendingHtml = "";
        }
        const nextIsSub = !!(rows[index + 1] && rows[index + 1].isOverviewSubordinate);
        element.classList.toggle("overview-parent-with-sub", !row.isOverviewSubordinate && nextIsSub);
        element.classList.toggle("overview-sub-last", !!row.isOverviewSubordinate && !nextIsSub);
        if (row.drilldownKey === drillKey) {
          const toggle = element.querySelector("[data-drilldown-toggle]");
          if (toggle) {
            toggle.classList.toggle("expanded", !!row.isExpanded);
            toggle.setAttribute("aria-label", row.isExpanded ? "Recolher" : "Expandir");
          }
        }
      });
      if (pendingHtml) tbody.insertAdjacentHTML("beforeend", pendingHtml);
      return true;
    },


    _formulaAuditRequestForRow(model, rowKey) {
      const targetKey = String(rowKey || "").trim();
      if (!targetKey || !model) return null;
      if (model.viewConfig && model.viewConfig.mode === "overview") {
        const rows = model.overviewView && Array.isArray(model.overviewView.rows) ? model.overviewView.rows : [];
        const row = rows.find((item, index) => {
          const key = item && (item.rowKey || item.drilldownKey || `${index}::${this._normalize(item.account)}`);
          return key === targetKey;
        });
        if (row && row.isCalculatedIndicator && row.calculatedIndicatorId) {
          return { calculatedIndicatorId: row.calculatedIndicatorId };
        }
        if (!row || !row.isOverviewSubordinate || !row.parentAccountId) return null;
        return {
          accountId: row.parentAccountId,
          subordinateIndex: Math.max(0, Number(row.subordinateIndex) || 0)
        };
      }
      if (model.viewConfig && model.viewConfig.mode !== "standard") return null;
      const rows = Array.isArray(model.rows) ? model.rows : [];
      const row = rows.find((item, index) => {
        const key = item && (item.rowKey || `${index}::${this._normalize(item.account)}`);
        return key === targetKey;
      });
      if (!row || !row.subordinate || !row.accountId) return null;
      return { accountId: row.accountId, subordinateIndex: 0 };
    },


    async _handleContextAction(action, model) {
      const token = String(action || "").trim().toLowerCase();
      this._closeContextMenu(false);

      if (token === "audit") {
        this._openAudit();
        return;
      }

      if (token === "formula-audit") {
        const request = this._formulaAuditRequestForRow(model, this._contextMenu && this._contextMenu.targetRowKey);
        if (request) {
          this._openFormulaAudit(model, request);
          return;
        }
        this._renderVisual();
        return;
      }

      if (token === "copy-image") {
        try {
          await this._copyTableAsImageToClipboard();
          if (typeof window !== "undefined" && window && typeof window.alert === "function") {
            window.alert("Container do widget copiado para o clipboard como imagem.");
          }
        } catch (error) {
          if (typeof console !== "undefined" && console && typeof console.error === "function") {
            console.error("One Pager: falha ao copiar imagem", error);
          }
          if (typeof window !== "undefined" && window && typeof window.alert === "function") {
            window.alert("Nao foi possivel copiar a imagem do container do widget.");
          }
        }
        this._renderVisual();
        return;
      }

      if (token === "copy-data") {
        try {
          await this._copyTableDataToClipboard();
          if (typeof window !== "undefined" && window && typeof window.alert === "function") {
            window.alert("Dados da tabela copiados. Cole diretamente no Excel.");
          }
        } catch (error) {
          if (typeof console !== "undefined" && console && typeof console.error === "function") {
            console.error("One Pager: falha ao copiar dados", error);
          }
          if (typeof window !== "undefined" && window && typeof window.alert === "function") {
            window.alert("Nao foi possivel copiar os dados da tabela.");
          }
        }
        this._renderVisual();
        return;
      }

      this._renderVisual();
    },


    _handleDocumentClick(event) {
      if (!event) return;
      const path = typeof event.composedPath === "function" ? event.composedPath() : [];
      const picker = this._root ? this._root.getElementById("basePicker") : null;
      if (picker && picker.hasAttribute("open")) {
        const clickedInsidePicker = path.includes(picker);
        if (!clickedInsidePicker) picker.removeAttribute("open");
      }

      let needsRender = false;
      const menu = this._root ? this._root.getElementById("tableContextMenu") : null;
      if (this._contextMenu && this._contextMenu.open) {
        const clickedInsideMenu = !!(menu && path.includes(menu));
        if (!clickedInsideMenu) {
          this._contextMenu = { ...this._contextMenu, open: false };
          needsRender = true;
        }
      }

      if (!this._selectedRowKeys || !this._selectedRowKeys.size) {
        if (needsRender) this._renderVisual();
        return;
      }
      const clickedInsideWidget = path.includes(this);
      if (!clickedInsideWidget) {
        this._selectedRowKeys.clear();
        this._contextMenu = { ...this._contextMenu, open: false };
        this._renderVisual();
        return;
      }

      const clickedDataRow = path.some(node =>
        node &&
        node.nodeType === 1 &&
        typeof node.matches === "function" &&
        node.matches("tbody tr[data-row-key]")
      );
      if (!clickedDataRow) {
        this._selectedRowKeys.clear();
        needsRender = true;
      }
      if (needsRender) this._renderVisual();
    },


    _bindBalanceSheetSearch(model) {
      if (!model || !model.viewConfig || !["overview_bp", "overview_bp_free"].includes(model.viewConfig.mode)) return;
      const input = this._root.getElementById("bpIndicatorSearch");
      const tbody = this._root.querySelector(".table-wrap table tbody");
      if (!input || !tbody) return;
      const clear = this._root.getElementById("bpSearchClear");
      const status = this._root.getElementById("bpSearchStatus");
      const empty = this._root.getElementById("bpSearchEmpty");
      const normalize = value => String(value || "").normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().replace(/\s+/g, " ").trim();
      const labels = new Map((model.overviewItrView.rows || []).map(row => [
        row.rowKey, normalize(`${row.account} ${row.accountId}`)
      ]));
      const headers = [];
      const entries = [];
      let area = null;
      let group = null;
      // Index once per table render; keystrokes only change visibility, never the model.
      tbody.querySelectorAll("tr").forEach(node => {
        if (node.classList.contains("bp-section")) {
          area = node;
          group = null;
          headers.push(node);
        } else if (node.classList.contains("bp-subsection")) {
          group = node;
          headers.push(node);
        } else if (node.classList.contains("data-row")) {
          entries.push({ node, area, group, text: labels.get(node.getAttribute("data-row-key")) || "" });
        }
      });
      const hasGroupTotals = headers.some(node => node.classList.contains("bp-total"));
      const setHidden = (node, hidden) => {
        if (node && node.hidden !== hidden) node.hidden = hidden;
      };
      const apply = () => {
        this._bpSearchTerm = input.value;
        const query = normalize(input.value);
        const visibleHeaders = new Set();
        let count = 0;
        entries.forEach(entry => {
          const matches = !query || entry.text.includes(query);
          setHidden(entry.node, !matches);
          if (!matches) return;
          count++;
          visibleHeaders.add(entry.area);
          visibleHeaders.add(entry.group);
        });
        headers.forEach(node => setHidden(node, !visibleHeaders.has(node)));
        setHidden(empty, count > 0);
        if (status) status.textContent = `${count} de ${entries.length} indicadores${query && count && hasGroupTotals ? " | Totais integrais dos grupos" : ""}`;
        if (clear) clear.disabled = !input.value;
      };
      const reset = () => {
        input.value = "";
        apply();
        input.focus();
      };
      input.addEventListener("input", apply);
      input.addEventListener("search", apply);
      input.addEventListener("keydown", event => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        reset();
      });
      if (clear) clear.addEventListener("click", reset);
      apply();
    },


    _bindRenderInteractions(model) {
      this._bindBalanceSheetSearch(model);
      const itrLayoutToggle = this._root.getElementById("itrLayoutToggle");
      if (itrLayoutToggle) itrLayoutToggle.addEventListener("click", () => this._toggleItrLayout());
      const picker = this._root.getElementById("basePicker");
      const options = this._root.querySelectorAll(".period-option");
      options.forEach(button => {
        button.addEventListener("click", event => {
          const key = event.currentTarget.getAttribute("data-period-key");
          if (!key) return;
          this._selectedPeriodKey = key;
          this._periodSelectionIsLocal = true;
          if (picker) picker.removeAttribute("open");
          this._render();
        });
      });

      const tableWrap = this._root.querySelector(".table-wrap");
      if (tableWrap) {
        tableWrap.addEventListener("click", event => {
          const path = typeof event.composedPath === "function" ? event.composedPath() : [];
          const findElement = selector => path.find(node => node && node.nodeType === 1
            && typeof node.matches === "function" && node.matches(selector));
          const toggle = findElement("[data-drilldown-toggle][data-drilldown-key]");
          if (toggle) {
            event.preventDefault();
            event.stopPropagation();
            this._toggleOverview2Drilldown(toggle.getAttribute("data-drilldown-key"));
            return;
          }
          const row = findElement("tbody tr.data-row[data-row-key]");
          if (!row) return;
          const key = row.getAttribute("data-row-key");
          if (!key) return;

          const useMultiSelect = !!(event.ctrlKey || event.metaKey);
          if (useMultiSelect) {
            if (this._selectedRowKeys.has(key)) this._selectedRowKeys.delete(key);
            else this._selectedRowKeys.add(key);
            this._refreshSelection();
            return;
          }

          if (this._selectedRowKeys.size === 1 && this._selectedRowKeys.has(key)) {
            this._selectedRowKeys.clear();
            this._refreshSelection();
            return;
          }

          this._selectedRowKeys.clear();
          this._selectedRowKeys.add(key);
          this._refreshSelection();
        });
        tableWrap.addEventListener("contextmenu", event => {
          event.preventDefault();
          event.stopPropagation();
          const path = typeof event.composedPath === "function" ? event.composedPath() : [];
          const targetRow = path.find(node =>
            node &&
            node.nodeType === 1 &&
            typeof node.matches === "function" &&
            node.matches("tbody tr[data-row-key]")
          );
          const targetRowKey = targetRow ? String(targetRow.getAttribute("data-row-key") || "") : "";
          const hasFormulaAudit = !!this._formulaAuditRequestForRow(model, targetRowKey);
          this._openContextMenuAt(event.clientX, event.clientY, targetRowKey, hasFormulaAudit);
        });
      }

      const contextMenu = this._root.getElementById("tableContextMenu");
      if (contextMenu) {
        contextMenu.addEventListener("contextmenu", event => {
          event.preventDefault();
          event.stopPropagation();
        });
      }

      const contextActions = this._root.querySelectorAll("[data-context-action]");
      contextActions.forEach(button => {
        button.addEventListener("click", event => {
          event.preventDefault();
          event.stopPropagation();
          const action = event.currentTarget.getAttribute("data-context-action");
          this._handleContextAction(action, model);
        });
      });

      const auditOverlay = this._root.getElementById("auditOverlay");
      if (auditOverlay) {
        auditOverlay.addEventListener("click", event => {
          if (event.target === auditOverlay) {
            this._closeAudit();
          }
        });
      }

      const auditCloseBtn = this._root.getElementById("auditCloseBtn");
      if (auditCloseBtn) {
        auditCloseBtn.addEventListener("click", event => {
          event.preventDefault();
          this._closeAudit();
        });
      }

      const formulaAuditOverlay = this._root.getElementById("formulaAuditOverlay");
      if (formulaAuditOverlay) {
        formulaAuditOverlay.addEventListener("click", event => {
          if (event.target === formulaAuditOverlay) this._closeFormulaAudit();
        });
      }

      const formulaAuditCloseBtn = this._root.getElementById("formulaAuditCloseBtn");
      if (formulaAuditCloseBtn) {
        formulaAuditCloseBtn.addEventListener("click", event => {
          event.preventDefault();
          this._closeFormulaAudit();
        });
      }

      const formulaAuditCopyBtn = this._root.getElementById("formulaAuditCopyBtn");
      if (formulaAuditCopyBtn) {
        formulaAuditCopyBtn.addEventListener("click", async event => {
          event.preventDefault();
          try {
            await this._copyFormulaAuditToClipboard();
            if (typeof window !== "undefined" && window && typeof window.alert === "function") {
              window.alert("Memoria de calculo copiada para o clipboard.");
            }
          } catch (error) {
            if (typeof console !== "undefined" && console && typeof console.error === "function") {
              console.error("One Pager: falha ao copiar memoria de calculo", error);
            }
          }
        });
      }

      this._positionContextMenu();
    },
  };
  Object.assign(
    OnePager.prototype,
    OnePagerLifecycleModule,
    OnePagerAccountLabelModule,
    OnePagerDataModule,
    OnePagerAverageWeightsModule,
    OnePagerItrModule,
    OnePagerBalanceSheetModule,
    OnePagerBalanceFreeModule,
    OnePagerFormulaModule,
    OnePagerCalculatedModule,
    OnePagerFormulaAuditModule,
    OnePagerPreviewModule,
    OnePagerRenderModule,
    OnePagerExportModule,
    OnePagerInteractionModule
  );


  if (!customElements.get("one-pager")) {
    customElements.define("one-pager", OnePager);
  }
})();
