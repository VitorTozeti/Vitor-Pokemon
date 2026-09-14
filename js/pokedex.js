/* pokedex.js — grid de Pokémon (busca/filtros) e a ficha detalhada. */

window.Pokedex = (function () {
  let all = [];            // lista completa [{id,name}]
  let filtered = [];       // após busca/filtros
  let shown = 0;           // paginação incremental
  const PAGE = 60;

  const $ = (sel) => document.querySelector(sel);
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const pad = (n) => String(n).padStart(4, "0");

  function typeBadge(t) {
    return `<span class="badge" style="--c:${window.TYPE_COLOR[t]}">${window.TYPE_PT[t]}</span>`;
  }

  // ---- filtros ----
  function applyFilters() {
    const q = $("#search").value.trim().toLowerCase();
    const type = $("#filter-type").value;
    const gen = $("#filter-gen").value;
    filtered = all.filter(p => {
      if (q && !p.name.includes(q) && !String(p.id).includes(q)) return false;
      if (type && !window.API.typesOf(p.name).includes(type)) return false;
      if (gen) {
        const g = window.GENERATIONS.find(x => String(x.id) === gen);
        if (g && (p.id < g.min || p.id > g.max)) return false;
      }
      return true;
    });
    shown = 0;
    $("#grid").innerHTML = "";
    $("#count").textContent = `${filtered.length} Pokémon`;
    renderMore();
  }

  function card(p) {
    const types = window.API.typesOf(p.name);
    return `
      <button class="card" data-name="${p.name}" data-id="${p.id}">
        <span class="card-num">#${pad(p.id)}</span>
        <img loading="lazy" src="${window.API.SPRITE(p.id)}" alt="${p.name}"
             onerror="this.style.visibility='hidden'">
        <span class="card-name">${cap(p.name)}</span>
        <span class="card-types">${types.map(typeBadge).join("")}</span>
        <span class="card-add" title="Adicionar ao time" data-add="${p.name}">＋</span>
      </button>`;
  }

  function renderMore() {
    const slice = filtered.slice(shown, shown + PAGE);
    $("#grid").insertAdjacentHTML("beforeend", slice.map(card).join(""));
    shown += slice.length;
    $("#load-more").hidden = shown >= filtered.length;
  }

  // ---- ficha detalhada (modal) ----
  async function openDetail(idOrName) {
    const modal = $("#modal");
    const body = $("#modal-body");
    modal.hidden = false;
    body.innerHTML = `<p class="loading">Carregando ficha…</p>`;
    try {
      const p = await window.API.getPokemon(idOrName);
      const species = await window.API.getSpecies(p.id).catch(() => null);
      const types = p.types.map(t => t.type.name);
      const flavor = species && (species.flavor_text_entries
        .find(f => f.language.name === "en") || {}).flavor_text;

      const statMax = 255;
      const statRow = (label, val) => `
        <div class="stat">
          <span class="stat-label">${label}</span>
          <span class="stat-val">${val}</span>
          <span class="stat-bar"><i style="width:${(val / statMax) * 100}%;
            background:${val >= 100 ? "#16A34A" : val >= 60 ? "#EAB308" : "#DC2626"}"></i></span>
        </div>`;
      const S = Object.fromEntries(p.stats.map(s => [s.stat.name, s.base_stat]));
      const total = p.stats.reduce((a, s) => a + s.base_stat, 0);

      body.innerHTML = `
        <div class="detail-head" style="background:linear-gradient(135deg, ${window.TYPE_COLOR[types[0]]}55, transparent)">
          <img class="detail-art" src="${window.API.ARTWORK(p.id)}"
               onerror="this.src='${window.API.SPRITE(p.id)}'" alt="${p.name}">
          <div>
            <span class="detail-num">#${pad(p.id)}</span>
            <h2>${cap(p.name)}</h2>
            <div class="card-types">${types.map(typeBadge).join("")}</div>
            <button class="btn-primary" data-add="${p.name}">＋ Adicionar ao time</button>
          </div>
        </div>
        ${flavor ? `<p class="flavor">${flavor.replace(/[\n\f]/g, " ")}</p>` : ""}
        <div class="detail-meta">
          <span><b>Altura</b> ${p.height / 10} m</span>
          <span><b>Peso</b> ${p.weight / 10} kg</span>
          <span><b>Exp. base</b> ${p.base_experience ?? "—"}</span>
        </div>
        <h3>Habilidades</h3>
        <ul class="abilities">
          ${p.abilities.map(a => `<li>${cap(a.ability.name.replace(/-/g, " "))}${a.is_hidden ? " <em>(oculta)</em>" : ""}</li>`).join("")}
        </ul>
        <h3>Status base <span class="muted">(total ${total})</span></h3>
        <div class="stats">
          ${statRow("HP", S["hp"])}
          ${statRow("Ataque", S["attack"])}
          ${statRow("Defesa", S["defense"])}
          ${statRow("Atq. Esp.", S["special-attack"])}
          ${statRow("Def. Esp.", S["special-defense"])}
          ${statRow("Velocidade", S["speed"])}
        </div>
        <h3>Fraquezas defensivas</h3>
        <div class="weakness-grid">${weaknessChips(types)}</div>
        <h3>Movimentos <span class="muted">(${p.moves.length})</span></h3>
        <div class="moves">
          ${p.moves.slice(0, 40).map(m => `<span class="move">${cap(m.move.name.replace(/-/g, " "))}</span>`).join("")}
          ${p.moves.length > 40 ? `<span class="move muted">+${p.moves.length - 40}…</span>` : ""}
        </div>`;
    } catch (e) {
      body.innerHTML = `<p class="error">Não consegui carregar: ${e.message}</p>`;
    }
  }

  // Chips de fraqueza/resistência de UM Pokémon (para a ficha).
  function weaknessChips(types) {
    return window.TYPE_IDS.map(atk => {
      const m = window.effectiveness(atk, types);
      if (m === 1) return "";
      const cls = m > 1 ? "weak" : m === 0 ? "immune" : "resist";
      return `<span class="wk ${cls}" style="--c:${window.TYPE_COLOR[atk]}">
        ${window.TYPE_PT[atk]} <b>×${m}</b></span>`;
    }).filter(Boolean).join("");
  }

  function closeDetail() { $("#modal").hidden = true; }

  // ---- init ----
  async function init(list) {
    all = list;
    filtered = list;
    // popular selects
    $("#filter-type").insertAdjacentHTML("beforeend",
      window.TYPES.map(t => `<option value="${t.id}">${t.pt}</option>`).join(""));
    $("#filter-gen").insertAdjacentHTML("beforeend",
      window.GENERATIONS.map(g => `<option value="${g.id}">${g.label}</option>`).join(""));

    $("#search").addEventListener("input", debounce(applyFilters, 200));
    $("#filter-type").addEventListener("change", applyFilters);
    $("#filter-gen").addEventListener("change", applyFilters);
    $("#load-more").addEventListener("click", renderMore);

    // clique nos cards (delegação): abrir ficha ou adicionar ao time
    $("#grid").addEventListener("click", (e) => {
      const addBtn = e.target.closest("[data-add]");
      if (addBtn) { e.stopPropagation(); window.Team.add(addBtn.dataset.add); return; }
      const c = e.target.closest(".card");
      if (c) openDetail(c.dataset.name);
    });
    $("#modal-body").addEventListener("click", (e) => {
      const addBtn = e.target.closest("[data-add]");
      if (addBtn) window.Team.add(addBtn.dataset.add);
    });
    $("#modal-close").addEventListener("click", closeDetail);
    $("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeDetail(); });

    applyFilters();
  }

  function debounce(fn, ms) {
    let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  }

  return { init, openDetail };
})();
