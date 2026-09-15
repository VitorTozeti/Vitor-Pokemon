/* settings.js — menu de configurações: MODO (claro/escuro/automático) + PALETA de acento.
 *
 * São dois eixos independentes, ambos salvos em localStorage e aplicados cedo (script inline
 * no <head>) pra evitar flash:
 *   - poke:mode  -> data-mode="light|dark"  (light/dark/auto; "auto" segue prefers-color-scheme)
 *   - poke:theme -> data-theme="ocean|forest|…" (cor de acento; "crystal" é o padrão sem atributo)
 * Cada paleta/modo é um bloco de variáveis CSS em styles.css.
 */

window.Settings = (function () {
  const KEY = "poke:theme";
  const MODE_KEY = "poke:mode";
  const ANIM_KEY = "poke:anim";
  const $ = (s) => document.querySelector(s);

  const PALETTES = [
    { id: "crystal",  label: "Cristal",   c1: "#ff3b5c", c2: "#ffb020" },
    { id: "ocean",    label: "Oceano",    c1: "#2ea8ff", c2: "#20e6c8" },
    { id: "forest",   label: "Floresta",  c1: "#3ecf6b", c2: "#ffb020" },
    { id: "electric", label: "Elétrico",  c1: "#f7d02c", c2: "#ff8a3d" },
    { id: "shadow",   label: "Sombrio",   c1: "#8b5cf6", c2: "#c8c8dc" },
    { id: "fairy",    label: "Fada",      c1: "#ff6fb0", c2: "#c9a6ff" },
    { id: "ember",    label: "Brasa",     c1: "#ff6a3d", c2: "#ffc23d" },
    { id: "aurora",   label: "Aurora",    c1: "#10d9c4", c2: "#7c5cff" },
  ];

  const MODES = [
    { id: "dark",  label: "Escuro",      icon: "🌙" },
    { id: "light", label: "Claro",       icon: "☀️" },
    { id: "auto",  label: "Automático",  icon: "🖥️" },
  ];

  const ANIMS = [
    { id: "on",  label: "Ligadas",   icon: "✨" },
    { id: "off", label: "Reduzidas", icon: "🚫" },
  ];

  function current() {
    try { return localStorage.getItem(KEY) || "crystal"; } catch { return "crystal"; }
  }
  function currentMode() {
    try { return localStorage.getItem(MODE_KEY) || "dark"; } catch { return "dark"; }
  }
  function currentAnim() {
    try { return localStorage.getItem(ANIM_KEY) || "on"; } catch { return "on"; }
  }

  function apply(id) {
    if (!PALETTES.some(p => p.id === id)) id = "crystal";
    if (id === "crystal") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", id);
    try { localStorage.setItem(KEY, id); } catch {}
  }

  function resolveMode(mode) {
    if (mode === "auto") {
      return (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) ? "light" : "dark";
    }
    return mode;
  }
  function applyMode(mode) {
    if (!MODES.some(m => m.id === mode)) mode = "dark";
    document.documentElement.setAttribute("data-mode", resolveMode(mode));
    try { localStorage.setItem(MODE_KEY, mode); } catch {}
  }
  function applyAnim(anim) {
    if (!ANIMS.some(a => a.id === anim)) anim = "on";
    document.documentElement.setAttribute("data-anim", anim);
    try { localStorage.setItem(ANIM_KEY, anim); } catch {}
  }

  function renderGrid() {
    const grid = $("#palette-grid");
    if (!grid) return;
    const active = current();
    grid.innerHTML = PALETTES.map(p => `
      <button type="button" class="palette-swatch${p.id === active ? " active" : ""}" data-theme-pick="${p.id}" title="${p.label}">
        <span class="palette-dots"><i style="background:${p.c1}"></i><i style="background:${p.c2}"></i></span>
        <span class="palette-label">${p.label}</span>
      </button>`).join("");
  }

  function renderModeGrid() {
    const grid = $("#mode-grid");
    if (!grid) return;
    const active = currentMode();
    grid.innerHTML = MODES.map(m => `
      <button type="button" class="mode-btn${m.id === active ? " active" : ""}" data-mode-pick="${m.id}">
        <span class="mode-icon">${m.icon}</span><span>${m.label}</span>
      </button>`).join("");
  }

  function renderAnimGrid() {
    const grid = $("#anim-grid");
    if (!grid) return;
    const active = currentAnim();
    grid.innerHTML = ANIMS.map(a => `
      <button type="button" class="mode-btn${a.id === active ? " active" : ""}" data-anim-pick="${a.id}">
        <span class="mode-icon">${a.icon}</span><span>${a.label}</span>
      </button>`).join("");
  }

  function open() { renderGrid(); renderModeGrid(); renderAnimGrid(); $("#settings-modal").hidden = false; }
  function close() { $("#settings-modal").hidden = true; }

  function resetAll() {
    apply("crystal"); applyMode("dark"); applyAnim("on");
    renderGrid(); renderModeGrid(); renderAnimGrid();
  }

  function init() {
    apply(current());
    applyMode(currentMode());
    applyAnim(currentAnim());
    // se estiver em "auto", reage à mudança do sistema
    if (window.matchMedia) {
      try {
        window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => {
          if (currentMode() === "auto") applyMode("auto");
        });
      } catch {}
    }
    const btn = $("#settings-btn");
    if (btn) btn.addEventListener("click", open);
    const closeBtn = $("#settings-close");
    if (closeBtn) closeBtn.addEventListener("click", close);
    const modal = $("#settings-modal");
    if (modal) modal.addEventListener("click", (e) => { if (e.target.id === "settings-modal") close(); });
    const grid = $("#palette-grid");
    if (grid) grid.addEventListener("click", (e) => {
      const b = e.target.closest("[data-theme-pick]");
      if (!b) return;
      apply(b.dataset.themePick); renderGrid();
    });
    const modeGrid = $("#mode-grid");
    if (modeGrid) modeGrid.addEventListener("click", (e) => {
      const b = e.target.closest("[data-mode-pick]");
      if (!b) return;
      applyMode(b.dataset.modePick); renderModeGrid();
    });
    const animGrid = $("#anim-grid");
    if (animGrid) animGrid.addEventListener("click", (e) => {
      const b = e.target.closest("[data-anim-pick]");
      if (!b) return;
      applyAnim(b.dataset.animPick); renderAnimGrid();
    });
    const resetBtn = $("#settings-reset");
    if (resetBtn) resetBtn.addEventListener("click", resetAll);
  }

  document.addEventListener("DOMContentLoaded", init);
  return { apply, current, applyMode, currentMode, applyAnim, currentAnim };
})();
