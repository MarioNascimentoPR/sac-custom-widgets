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
        <label>Tamanho da Fonte Rótulos (px)</label><input id="font-size-lbl" type="number" min="8" max="16" />
      </div>
    </div>
  `;

  class EvoSummaryWidgetStyling extends HTMLElement {
    constructor() {
      super();
      this._shadowRoot = this.attachShadow({ mode: "open" });
      this._shadowRoot.appendChild(templateStyling.content.cloneNode(true));
      this._changeProperty = this._changeProperty.bind(this);

      this._shadowRoot.getElementById("cls-act").addEventListener("change", (e) => this._changeProperty("colorActualMonth", e.target.value));
      this._shadowRoot.getElementById("cls-hist").addEventListener("change", (e) => this._changeProperty("colorHistorical", e.target.value));
      this._shadowRoot.getElementById("cls-bud").addEventListener("change", (e) => this._changeProperty("colorBudget", e.target.value));
      this._shadowRoot.getElementById("font-size-lbl").addEventListener("change", (e) => this._changeProperty("fontSizeLabels", parseInt(e.target.value)));
    }

    _changeProperty(name, value) {
      this.dispatchEvent(new CustomEvent("propertiesChanged", {
        detail: { properties: { [name]: value } }
      }));
    }

    onCustomWidgetAfterUpdate(changedProperties) {
      if (changedProperties.colorActualMonth !== undefined) {
        this._shadowRoot.getElementById("cls-act").value = changedProperties.colorActualMonth;
      }
      if (changedProperties.colorHistorical !== undefined) {
        this._shadowRoot.getElementById("cls-hist").value = changedProperties.colorHistorical;
      }
      if (changedProperties.colorBudget !== undefined) {
        this._shadowRoot.getElementById("cls-bud").value = changedProperties.colorBudget;
      }
      if (changedProperties.fontSizeLabels !== undefined) {
        this._shadowRoot.getElementById("font-size-lbl").value = changedProperties.fontSizeLabels;
      }
    }
  }

  customElements.define("sac-summary-styling", EvoSummaryWidgetStyling);
})();
