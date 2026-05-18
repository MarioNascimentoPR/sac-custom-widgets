/* ==========================================================================
   PAINEL DE CONFIGURAÇÃO LATERAL (BUILDER PANEL COMPILADO)
   ========================================================================== */

(function () {
  const templateStyling = document.createElement("template");
  templateStyling.innerHTML = `
    <style>
      #root { padding: 14px; font-family: system-ui, -apple-system, sans-serif; font-size: 11px; color: #2c3e50; }
      .control-group { margin-bottom: 12px; }
      label { display: block; font-weight: 600; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
      input[type="color"] { display: block; width: 100%; height: 28px; border: 1px solid #cbd5e0; border-radius: 4px; cursor: pointer; background: #ffffff; }
      input[type="number"] { width: 100%; height: 26px; border: 1px solid #cbd5e0; border-radius: 4px; padding-left: 6px; box-sizing: border-box; }
    </style>
    <div id="root">
      <div class="control-group">
        <label>Cor Mês Atual (Realizado)</label><input id="cls-act" type="color" />
      </div>
      <div class="control-group">
        <label>Cor Histórico (Realizado)</label><input id="cls-hist" type="color" />
      </div>
      <div class="control-group">
        <label>Cor Orçado (Budget)</label><input id="cls-bud" type="color" />
      </div>
      <div class="control-group">
        <label>Tamanho da Fonte Rótulos (px)</label><input id="font-size-lbl" type="number" min="10" max="18" />
      </div>
    </div>
  `;

  class EvoSummaryWidgetStyling extends HTMLElement {
    constructor() {
      super();
      this._shadowRoot = this.attachShadow({ mode: "open" });
      this._shadowRoot.appendChild(templateStyling.content.cloneNode(true));
      
      this._changeProperty = this._changeProperty.bind(this);

      const inputAct = this._shadowRoot.getElementById("cls-act");
      const inputHist = this._shadowRoot.getElementById("cls-hist");
      const inputBud = this._shadowRoot.getElementById("cls-bud");
      const inputFont = this._shadowRoot.getElementById("font-size-lbl");

      if (inputAct) inputAct.addEventListener("change", (e) => this._changeProperty("colorActualMonth", e.target.value));
      if (inputHist) inputHist.addEventListener("change", (e) => this._changeProperty("colorHistorical", e.target.value));
      if (inputBud) inputBud.addEventListener("change", (e) => this._changeProperty("colorBudget", e.target.value));
      if (inputFont) inputFont.addEventListener("change", (e) => this._changeProperty("fontSizeLabels", parseInt(e.target.value) || 13));
    }

    _changeProperty(name, value) {
      this.dispatchEvent(new CustomEvent("propertiesChanged", {
        detail: { properties: { [name]: value } }
      }));
    }

    onCustomWidgetAfterUpdate(changedProperties) {
      if (!this._shadowRoot) return;
      if (changedProperties.colorActualMonth !== undefined) {
        const el = this._shadowRoot.getElementById("cls-act");
        if (el) el.value = changedProperties.colorActualMonth;
      }
      if (changedProperties.colorHistorical !== undefined) {
        const el = this._shadowRoot.getElementById("cls-hist");
        if (el) el.value = changedProperties.colorHistorical;
      }
      if (changedProperties.colorBudget !== undefined) {
        const el = this._shadowRoot.getElementById("cls-bud");
        if (el) el.value = changedProperties.colorBudget;
      }
      if (changedProperties.fontSizeLabels !== undefined) {
        const el = this._shadowRoot.getElementById("font-size-lbl");
        if (el) el.value = changedProperties.fontSizeLabels;
      }
    }
  }

  if (!customElements.get("sac-summary-styling")) {
    customElements.define("sac-summary-styling", EvoSummaryWidgetStyling);
  }
})();
