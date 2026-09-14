/* settings.js — menu de configurações: paletas de cores (persistidas em localStorage).
 * Cada paleta é um bloco `:root[data-theme="id"]` em styles.css que sobrescreve as
 * variáveis de cor; aqui só trocamos o atributo `data-theme` do <html> e salvamos a
 * escolha. O tema "crystal" é o padrão (sem atributo), aplicado o mais cedo possível
 * por um script inline no <head> para evitar flash da cor errada.
 */

window.Settings = (function () {
  const KEY = "poke:theme";
  const $ = (s) => document.querySelector(s);

  const PALETTES = [
    { id: "crystal",  label: "Cristal",   c1: "#ff3b5c", c2: "#ffb020" },
    { id: "ocean",    label: "Oceano",    c1: "#2ea8ff", c2: "#20e6c8" },
    { id: "forest",   label: "Floresta",  c1: "#3ecf6b", c2: "#ffb020" },
    { id: "electric", label: "Elétrico",  c1: "#f7d02c", c2: "#ff8a3d" },
    { id: "shadow",   label: "Sombrio",   c1: "#8b5cf6", c2: "#c8c8dc" },
    { id: "fairy",    label: "Fada",      c1: "#ff6fb0", c2: "#c9a6ff" },
  ];

  function current() {
    try { return localStorage.getItem(KEY) || "crystal"; } catch { return "crystal"; }
  }

  function apply(id) {
    if (!PALETTES.some(p => p.id === id)) id = "crystal";
    if (id === "crystal") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", id);
    try { localStorage.setItem(KEY, id); } catch {}
  }

  function renderGrid() {
    const grid = $("#palette-grid");
    if (!grid) return;
    const active = current();
    grid.innerHTML = PALETTES.map(p => `
      <button type="button" class="palette-swatch${p.id === active ? " active" : ""}" data-theme-pick="${p.id}">
        <span class="palette-dots"><i style="background:${p.c1}"></i><i style="background:${p.c2}"></i></span>
        <span class="palette-label">${p.label}</span>
      </button>`).join("");
  }

  function open() { renderGrid(); $("#settings-modal").hidden = false; }
  function close() { $("#settings-modal").hidden = true; }

  function init() {
    apply(current());
    const btn = $("#settings-btn");
    if (btn) btn.addEventListener("click", open);
    const closeBtn = $("#settings-close");
    if (closeBtn) closeBtn.addEventListener("click", close);
    const modal = $("#settings-modal");
    if (modal) modal.addEventListener("click", (e) => { if (e.target.id === "settings-modal") close(); });
    const grid = $("#palette-grid");
    if (grid) grid.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-theme-pick]");
      if (!btn) return;
      apply(btn.dataset.themePick);
      renderGrid();
    });
  }

  document.addEventListener("DOMContentLoaded", init);
  return { apply, current };
})();
