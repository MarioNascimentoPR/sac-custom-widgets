                    return (rowObj.children || []).some(child => hasVisibleSignal(child, level + 1));
                };

                tableData.forEach(calcRow => {
                    tableHtml += renderRowHtml(calcRow, 0);
                    if (this._expandedRows.has(calcRow.key)) {
                        calcRow.children.forEach(ccNivel1Row => {
                            if (!hasVisibleSignal(ccNivel1Row, 1)) return;
                            tableHtml += renderRowHtml(ccNivel1Row, 1);
                            if (this._expandedRows.has(ccNivel1Row.key)) {
                                ccNivel1Row.children.forEach(ccNivel2Row => {
                                    if (!hasVisibleSignal(ccNivel2Row, 2)) return;
                                    tableHtml += renderRowHtml(ccNivel2Row, 2);
                                    if (this._expandedRows.has(ccNivel2Row.key)) {
                                        ccNivel2Row.children.forEach(contaRow => {
                                            if (!hasVisibleSignal(contaRow, 3)) return;
                                            tableHtml += renderRowHtml(contaRow, 3);
                                        });
                                    }
                                });
                            }
                        });
                    }
                });

                tableHtml += `</tbody>`;

                const totalDesvioFormatted = formatNumber(Math.abs(totalGlobalDesvio), true, true, totalGlobalDesvio);
                let totalVarColorClass = totalGlobalDesvio > 0 ? "var-positive" : (totalGlobalDesvio < 0 ? "var-negative" : "");
                let totalPercentConsumption = totalGlobalOrcado > 0 ? (totalGlobalRealizado / totalGlobalOrcado) * 100 : (totalGlobalRealizado > 0 ? Infinity : 0);
                
                let totalBarFillWidth = totalPercentConsumption === Infinity ? 100 : Math.min(100, totalPercentConsumption || 0);
                let totalBarFillClass = consolidatedRiskLabel === "Crítico" || consolidatedRiskLabel === "Alto" ? "fill-red" : (consolidatedRiskLabel === "Moderado" ? "fill-yellow" : "fill-green");
                let totalConsumptionText = totalPercentConsumption === Infinity ? "∞" : (totalPercentConsumption === 0 ? "-" : formatPercentage(totalPercentConsumption));
                if(totalGlobalOrcado === 0 && totalGlobalRealizado === 0) totalBarFillWidth = 0;

                let totalStatusText = consolidatedRiskLabel;
                let totalStatusPillClass = `status-${normalizeText(consolidatedRiskLabel).toLowerCase()}`;

                tableHtml += `<tfoot><tr><td>TOTAL GERAL</td>`;
                uniqueCols.forEach(col => {
                    if (col.toUpperCase().includes("ORÇADO") || col.toUpperCase().includes("ORCADO")) tableHtml += `<td class="numeric">${formatNumber(totalGlobalOrcado)}</td>`;
                    else if (col.toUpperCase().includes("REALIZADO")) tableHtml += `<td class="numeric">${formatNumber(totalGlobalRealizado)}</td>`;
                    else tableHtml += `<td class="numeric">-</td>`;
                });
                tableHtml += `<td class="numeric cell-variance ${totalVarColorClass}">${totalGlobalDesvio !== 0 ? totalDesvioFormatted : "-"}</td>`;
                tableHtml += `<td class="cell-consumption"><div class="consumption-wrapper"><div class="bar-container"><div class="bar-fill ${totalBarFillClass}" style="width: ${totalBarFillWidth}%;"></div></div><div class="percent-value">${totalConsumptionText}</div></div></td>`;
                tableHtml += `<td class="center cell-status">${totalStatusText !== "-" ? `<span class="status-pill ${totalStatusPillClass}">${totalStatusText}</span>` : "-"}</td></tr></tfoot></table>`;

                const executivePanelHtml = `
                    <div class="executive-kpi-grid">
                        <div class="executive-kpi">
                            <div class="kpi-label">Consumo Orçado G&A</div>
                            <div class="kpi-value">${escapeHtml(kpiConsumptionText)}</div>
                            <div class="kpi-sub">${escapeHtml(periodLabel)} · ${formatNumber(totalGlobalRealizado)} realizado</div>
                        </div>
                        <div class="executive-kpi">
                            <div class="kpi-label">Desvio do Período</div>
                            <div class="kpi-value">${formatNumber(Math.abs(totalGlobalDesvio), true, true, totalGlobalDesvio)}</div>
                            <div class="kpi-sub">${totalVariancePct.toFixed(1)}% vs orçamento</div>
                        </div>
                        <div class="executive-kpi">
                            <div class="kpi-label">Desvio YTD</div>
                            <div class="kpi-value">${formatNumber(Math.abs(ytdDesvio), true, true, ytdDesvio)}</div>
                            <div class="kpi-sub">${escapeHtml(ytdLabel)} · ${ytdVariancePct.toFixed(1)}%</div>
                        </div>
                        <div class="executive-kpi">
                            <div class="kpi-label">Risco Executivo</div>
                            <div class="kpi-value">${escapeHtml(consolidatedRiskLabel)}</div>
                            <div class="kpi-sub">Score ${(consolidatedRiskScore * 100).toFixed(0)}</div>
                        </div>
                    </div>
                    <div class="executive-oversight ${riskClass}">
                        <div class="executive-headline">
                            <span>${escapeHtml(executiveNarrative.headline)}</span>
                            <span class="executive-score">Score ${(consolidatedRiskScore * 100).toFixed(0)}</span>
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
                            <div class="executive-text">
                                <span class="executive-label">Recomendação</span>
                                ${escapeHtml(executiveNarrative.recommendation)}
                            </div>
                        </div>
                    </div>
                    <div class="executive-section">
                        <div class="section-title">Principais Ofensores do Período</div>
                        <div class="driver-list">${driversListHtml}</div>
                    </div>
                    <p class="table-summary ${varianceClass}">
                        No período analisado, observamos um <strong>${varianceType} de R$ ${formattedGlobalDesvio}</strong> em relação ao orçamento planejado, com filtro executivo de materialidade aplicado.${ofensoresText}
                    </p>
                `;

                container.innerHTML = `
                    <div class="view-tabs">
                        <button class="view-tab ${this._activeView === "executive" ? "active" : ""}" type="button" data-view="executive">Resumo Executivo</button>
                        <button class="view-tab ${this._activeView === "diagnostic" ? "active" : ""}" type="button" data-view="diagnostic">Diagnóstico</button>
                        <button class="view-tab ${this._activeView === "operational" ? "active" : ""}" type="button" data-view="operational">Operacional</button>
                    </div>
                    <div class="view-panel ${this._activeView === "executive" ? "active" : ""}" id="executiveView">${executivePanelHtml}</div>
                    <div class="view-panel ${this._activeView === "diagnostic" ? "active" : ""}" id="diagnosticView">${diagnosticHtml}</div>
                    <div class="view-panel ${this._activeView === "operational" ? "active" : ""}" id="operationalView">${tableHtml}</div>
                `;
                this._bindHeaderControls(monthOptions, Boolean(monthDimKey));

                container.querySelectorAll('th.sortable').forEach(th => {
                    th.addEventListener('click', () => {
                        const col = th.getAttribute('data-sort');
                        if (this._sortState.col === col) {
                            this._sortState.dir = this._sortState.dir === 'asc' ? 'desc' : 'asc';
                        } else {
                            this._sortState.col = col;
                            this._sortState.dir = 'asc';
                        }
                        this.renderTable(); 
                    });
                });

                container.querySelectorAll('tr[data-node-key]').forEach(tr => {
                    tr.addEventListener('click', (e) => {
                        const nodeKey = e.currentTarget.getAttribute('data-node-key');
                        if (this._expandedRows.has(nodeKey)) this._expandedRows.delete(nodeKey);
                        else this._expandedRows.add(nodeKey);
                        this.renderTable(); 
                    });
                });

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
