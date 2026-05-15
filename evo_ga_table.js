(function () {

  const template = document.createElement("template");

  template.innerHTML = `

    <style>

      :host {
        display:block;
        font-family: Arial;
      }

      table {
        width:100%;
        border-collapse: collapse;
      }

      th, td {
        padding:12px;
        border-bottom:1px solid #ddd;
        text-align:right;
      }

      th:first-child,
      td:first-child {
        text-align:left;
      }

      .debug {
        margin-top:20px;
        background:#111;
        color:#0f0;
        padding:15px;
        font-size:11px;
        overflow:auto;
        max-height:400px;
      }

    </style>

    <table>

      <thead>
        <tr>
          <th>Centro de Custo</th>
          <th>Valor 1</th>
          <th>Valor 2</th>
        </tr>
      </thead>

      <tbody id="tbody"></tbody>

    </table>

    <div id="debug" class="debug"></div>

  `;

  class EvoGATableOnly extends HTMLElement {

    constructor() {

      super();

      this.attachShadow({ mode: "open" });

      this.shadowRoot.appendChild(
        template.content.cloneNode(true)
      );
    }

    onCustomWidgetAfterUpdate() {

      const tbody =
        this.shadowRoot.getElementById(
          "tbody"
        );

      const debug =
        this.shadowRoot.getElementById(
          "debug"
        );

      tbody.innerHTML = "";

      try {

        const binding =
          this.dataBindings.getDataBinding(
            "financialData"
          );

        if (!binding) {

          debug.innerHTML =
            "Binding não encontrado.";

          return;
        }

        const data =
          binding.data || [];

        const metadata =
          binding.metadata || {};

        debug.innerHTML = `

          <b>METADATA</b>

          <pre>
${JSON.stringify(metadata, null, 2)}
          </pre>

          <b>PRIMEIRA LINHA</b>

          <pre>
${JSON.stringify(data[0], null, 2)}
          </pre>

        `;

        if (!data.length) {
          return;
        }

        const measureKeys =
          Object.keys(
            metadata.mainStructureMembers || {}
          );

        data.forEach(row => {

          const dimKey =
            Object.keys(row)
            .find(k =>
              k.startsWith("dimensions_")
            );

          const cc =
            row[dimKey]?.description || "N/A";

          let val1 = 0;
          let val2 = 0;

          if (measureKeys.length >= 2) {

            val1 =
              parseFloat(
                row[measureKeys[0]]?.rawValue || 0
              );

            val2 =
              parseFloat(
                row[measureKeys[1]]?.rawValue || 0
              );
          }

          tbody.innerHTML += `

            <tr>
              <td>${cc}</td>
              <td>${val1}</td>
              <td>${val2}</td>
            </tr>

          `;
        });

      } catch(error) {

        debug.innerHTML = `

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
