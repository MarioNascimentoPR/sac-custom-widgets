(function () {

  const template = document.createElement("template");

  template.innerHTML = `

    <style>

      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap');

      :host {
        display: block;
        width: 100%;
        height: 100%;
        font-family: 'Inter', sans-serif;
      }

      .wrapper {
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 14px;
        overflow: hidden;
      }

      table {
        width: 100%;
        border-collapse: collapse;
      }

      thead {
        background: #f9fafb;
      }

      thead th {
        padding: 14px 18px;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: .04em;
        color: #6b7280;
        text-align: right;
        border-bottom: 1px solid #e5e7eb;
      }

      thead th:first-child {
        text-align: left;
      }

      tbody td {
        padding: 14px 18px;
        border-bottom: 1px solid #f3f4f6;
        font-size: 13px;
      }

      .cc {
        font-weight: 600;
        color: #111827;
      }

      .money {
        text-align: right;
        font-family: 'JetBrains Mono', monospace;
      }

      .budget {
        color: #6b7280;
      }

      .variance {
        text-align: right;
      }

      .badge {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 5px 9px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 700;
      }

      .negative {
        background: #fef2f2;
        color: #dc2626;
      }

      .positive {
        background: #f0fdf4;
        color: #16a34a;
      }

      .status {
        padding: 24px;
        text-align: center;
        color: #6b7280;
        font-size: 13px;
      }

      .debug {
        background: #111827;
        color: #4ade80;
        padding: 14px;
        font-size: 10px;
        font-family: monospace;
        overflow: auto;
        max-height: 300px;
        border-top: 1px solid #1f2937;
      }

    </style>

    <div class="wrapper">

      <table>

        <thead>
          <tr>
            <th>Centro de Custo</th>
            <th>Realizado</th>
            <th>Orçado</th>
            <th>Desvio</th>
          </tr>
        </thead>

        <tbody id="tbody"></tbody>

      </table>

      <div id="status" class="status"></div>

      <div id="debug" class="debug"></div>

    </div>

  `;

  class EvoGATableOnly extends HTMLElement {

    constructor() {

      super();

      this.attachShadow({ mode: "open" });

      this.shadowRoot.appendChild(
        template.content.cloneNode(true)
      );

      this.currencyFormatter =
        new Intl.NumberFormat(
          "pt-BR",
          {
            style: "currency",
            currency: "BRL"
          }
        );
    }

    onCustomWidgetAfterUpdate() {

      const tbody =
        this.shadowRoot.getElementById("tbody");

      const status =
        this.shadowRoot.getElementById("status");

      const debug =
        this.shadowRoot.getElementById("debug");

      tbody.innerHTML = "";
      status.innerHTML = "";

      try {

        if (
          !this.dataBindings ||
          !this.dataBindings.getDataBinding
        ) {

          status.innerHTML =
            "DataBinding não encontrado.";

          return;
        }

        const binding =
          this.dataBindings.getDataBinding(
            "financialData"
          );

        if (!binding) {

          status.innerHTML =
            'Binding "financialData" não encontrado.';

          return;
        }

        const data =
          binding.data || [];

        debug.innerHTML = `
          TOTAL ROWS: ${data.length}

          <br><br>

          PRIMEIRA LINHA:

          <pre>
${JSON.stringify(data[0], null, 2)}
          </pre>
        `;

        if (!data.length) {

          status.innerHTML =
            "Nenhum dado retornado pelo SAC.";

          return;
        }

        const VERSION_MAP = {
          "PUBLIC.REALIZADO": "realized",
          "PUBLIC.ORÇADO": "budget"
        };

        const consolidated = {};

        data.forEach(row => {

          const dimensionKeys =
            Object.keys(row)
            .filter(key =>
              key.startsWith("dimensions_")
            );

          const measureKey =
            Object.keys(row)
            .find(key =>
              key.startsWith("measures_")
            );

          if (
            dimensionKeys.length < 2 ||
            !measureKey
          ) {
            return;
          }

          const ccDimension =
            row[dimensionKeys[0]];

          const versionDimension =
            row[dimensionKeys[1]];

          const ccId =
            ccDimension?.id || "N/A";

          const ccDescription =
            ccDimension?.description || ccId;

          const versionId =
            (
              versionDimension?.id || ""
            ).toUpperCase();

          const scenario =
            VERSION_MAP[versionId];

          if (!scenario) {
            return;
          }

          const value =
            parseFloat(
              row[measureKey]?.rawValue || 0
            );

          if (!consolidated[ccId]) {

            consolidated[ccId] = {
              description: ccDescription,
              realized: 0,
              budget: 0
            };
          }

          consolidated[ccId][scenario] += value;
        });

        const html =
          Object.values(consolidated)
          .map(item => {

            const variance =
              item.realized - item.budget;

            const positive =
              variance <= 0;

            return `

              <tr>

                <td class="cc">
                  ${item.description}
                </td>

                <td class="money">
                  ${this.currencyFormatter.format(
                    item.realized
                  )}
                </td>

                <td class="money budget">
                  ${this.currencyFormatter.format(
                    item.budget
                  )}
                </td>

                <td class="variance">

                  <span class="
                    badge
                    ${positive
                      ? "positive"
                      : "negative"}
                  ">

                    ${positive ? "▼" : "▲"}

                    ${this.currencyFormatter.format(
                      Math.abs(variance)
                    )}

                  </span>

                </td>

              </tr>

            `;
          })
          .join("");

        tbody.innerHTML = html;

      } catch(error) {

        status.innerHTML =
          "Erro ao renderizar widget.";

        debug.innerHTML = `

          ERROR:

          <pre>
${error.message}

${error.stack}
          </pre>

        `;
      }
    }
  }

  customElements.define(
    "evo-ga-table-only",
    EvoGATableOnly
  );

})();
