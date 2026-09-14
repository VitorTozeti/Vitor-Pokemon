/* app.js — boot da aplicação, navegação por abas e a tela de Tipos. */

(function () {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  // ---- navegação por abas ----
  function setupTabs() {
    $$(".tab").forEach(tab => {
      tab.addEventListener("click", () => {
        $$(".tab").forEach(t => t.classList.remove("active"));
        $$(".view").forEach(v => v.classList.remove("active"));
        tab.classList.add("active");
        $("#view-" + tab.dataset.view).classList.add("active");
      });
    });
  }

  // ---- tela de Tipos: tabela de efetividade 18x18 ----
  function renderTypeChart() {
    const T = window.TYPES;
    const cellColor = (m) =>
      m === 0 ? "#3a3a3a" : m === 2 ? "#16A34A" : m === 0.5 ? "#DC2626" : "transparent";
    const cellText = (m) => (m === 1 ? "" : m === 0 ? "0" : m === 0.5 ? "½" : "2");

    let html = `<table class="typechart"><thead><tr><th class="corner">Atk＼Def</th>`;
    html += T.map(d => `<th style="--c:${d.color}"><span>${d.pt}</span></th>`).join("");
    html += `</tr></thead><tbody>`;
    for (const atk of T) {
      html += `<tr><th class="rowh" style="--c:${atk.color}">${atk.pt}</th>`;
      for (const def of T) {
        const m = window.effectiveness(atk.id, [def.id]);
        html += `<td style="background:${cellColor(m)}" title="${atk.pt} → ${def.pt}: ×${m}">${cellText(m)}</td>`;
      }
      html += `</tr>`;
    }
    html += `</tbody></table>`;
    $("#typechart-wrap").innerHTML = html;
  }

  // ---- boot ----
  async function boot() {
    setupTabs();
    renderTypeChart();
    window.Team.init();

    const status = $("#boot-status");
    try {
      status.textContent = "Carregando índice de tipos (18 requisições, cacheado)…";
      await window.API.buildTypeIndex((done, total) => {
        status.textContent = `Carregando tipos… ${done}/${total}`;
      });
      status.textContent = "Carregando lista de Pokémon…";
      const list = await window.API.getList();
      await window.Pokedex.init(list);
      $("#boot").hidden = true;
    } catch (e) {
      status.innerHTML = `<span class="error">Falha ao carregar da PokéAPI: ${e.message}.
        Verifique a conexão e recarregue.</span>`;
    }

    // botão de limpar cache (rodapé)
    const cc = $("#clear-cache");
    if (cc) cc.addEventListener("click", () => {
      if (confirm("Limpar o cache local da PokéAPI? (o time é preservado)")) {
        window.API.clearCache(); location.reload();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
