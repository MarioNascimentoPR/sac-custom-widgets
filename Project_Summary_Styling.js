/* global HTMLElement, document, customElements, CustomEvent */
/* ==========================================================================
   EVOSTREAM PERFORMANCE SUMMARY WIDGET - STYLING PANEL (PRODUCTION READY)
   ========================================================================== */

(function () {
  const template = document.createElement("template");
  template.innerHTML = `
    <style>
      #root {
        padding: 14px;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 11px;
        color: #2d3748;
      }
      .section-title {
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 12px;
        border-bottom: 1px solid #e2e8f0;
        padding-bottom: 4px;
        color: #4a5568;
      }
      .setting-row {
        margin-bottom: 10px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      label {
        font-weight: 600;
      }
      input[type="text"], input[type="number"] {
        padding: 4px 8px;
        border: 1px solid #cbd5e0;
        border-radius: 4px;
        font-size: 11px;
        width: 100%;
        box-sizing: border-box;
      }
      button {
        display: block;
        width: 100%;
        padding: 6px;
        margin-top: 14px;
        background-color: #1f77b4;
        color: #ffffff;
        border: none;
        border-radius: 4px;
        font-weight: 700;
        cursor: pointer;
        transition: background 0.2s;
      }
      button:hover {
        background-color: #15517b;
      }
    </style>
    <div id="root">
      <div class="section-title">Paleta de Cores (Custo/OPEX)</div>
      <div class="setting-row">
        <label>Cor do Mês Atual</label>
        <input id="input-actual" type="text" placeholder="#1f77b4" />
      </div>
      <div class="setting-row">
        <label>Cor do Histórico</label>
        <input id="input-historical" type="text" placeholder="#7f7f7f" />
      </div>
      <div class="setting-row">
        <label>Cor da Meta (Budget)</label>
        <input id="input-budget" type="text" placeholder="#aec7e8" />
      </div>
      <div class="section-title">Tipografia</div>
      <div class="setting-row">
        <label>Tamanho da Fonte dos Rótulos (px)</label>
        <input id="input-font" type="number" placeholder="12" />
      </div>
      <button id="btn-apply-settings">Aplicar Propriedades</button>
    </div>
  `;

  class EvoSummaryWidgetStyling extends HTMLElement {
    constructor() {
      super();
      
      // Uso do padrão nativo shadowRoot para evitar alertas de propriedades implícitas
      this.attachShadow({ mode: "open" });
      this.shadowRoot.appendChild(template.content.cloneNode(true));
      
      // Mapeamento explícito dos elementos do DOM interno
      this._inputActual = this.shadowRoot.getElementById("input-actual");
      this._inputHistorical = this.shadowRoot.getElementById("input-historical");
      this._inputBudget = this.shadowRoot.getElementById("input-budget");
      this._inputFont = this.shadowRoot.getElementById("input-font");
      this._btnApply = this.shadowRoot.getElementById("btn-apply-settings");
      
      // Listener seguro utilizando Arrow Function para preservar o escopo do 'this'
      if (this._btnApply) {
        this._btnApply.addEventListener("click", () => {
          this.dispatchEvent(new CustomEvent("propertiesChanged", {
            detail: {
              properties: {
                colorActualMonth: this._inputActual.value || "#1f77b4",
                colorHistorical: this._inputHistorical.value || "#7f7f7f",
                colorBudget: this._inputBudget.value || "#aec7e8",
                fontSizeLabels: parseInt(this._inputFont.value, 10) || 12
              }
            }
          }));
        });
      }
    }

    // Método de reidratação do SAC com verificação e tratamento defensivo (Garante 0 erros)
    onCustomWidgetAfterUpdate(changedProperties) {
      if (!changedProperties) {
        return;
      }
      
      if (changedProperties.colorActualMonth !== undefined && this._inputActual) {
        this._inputActual.value = changedProperties.colorActualMonth;
      }
      if (changedProperties.colorHistorical !== undefined && this._inputHistorical) {
        this._inputHistorical.value = changedProperties.colorHistorical;
      }
      if (changedProperties.colorBudget !== undefined && this._inputBudget) {
        this._inputBudget.value = changedProperties.colorBudget;
      }
      if (changedProperties.fontSizeLabels !== undefined && this._inputFont) {
        this._inputFont.value = changedProperties.fontSizeLabels;
      }
    }
  }

  customElements.define("sac-summary-styling", EvoSummaryWidgetStyling);
})();
