/* team.js — construtor de time competitivo (MÚLTIPLOS times, até 6 membros cada) + MOTOR DE ANÁLISE.
 *
 * Cada membro é montado "de verdade": habilidade, nature, nível, EVs/IVs (que calculam
 * os status finais) e 4 movimentos escolhidos entre os que o Pokémon aprende, via um
 * seletor de golpes com busca, filtro por método e prévia de tipo/categoria/poder. A
 * análise usa os TIPOS dos movimentos escolhidos para a cobertura ofensiva (fallback: STAB).
 * Toda a matemática de tipos/status roda no cliente (types.js).
 */

window.Team = (function () {
  const KEY = "poke:teams:v1";
  const OLD_KEY = "poke:team:v2";
  const MAX = 6;
  const EV_MAX = 252, EV_TOTAL = 510, IV_MAX = 31;

  const $ = (s) => document.querySelector(s);
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, " ");
  const badge = (t) => `<span class="badge" style="--c:${window.TYPE_COLOR[t]}">${window.TYPE_PT[t]}</span>`;
  const uid = () => "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  let state = load();        // { teams:[{id,name,members}], active:id }
  let editing = -1;          // índice do membro em edição (-1 = nenhum), no time ativo
  let openSlot = -1;         // qual dos 4 slots de golpe está com o seletor aberto (-1 = nenhum)
  let picker = { q: "", method: "" }; // filtro do seletor de golpes aberto
  const moveEnrich = {};     // cache em memória: nome do pokémon -> { moveName: detalhe|null }

  // ================= PERSISTÊNCIA =================
  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY));
      if (raw && Array.isArray(raw.teams) && raw.teams.length) return raw;
    } catch {}
    // migra do formato antigo (um único time, sem nome)
    let migrated = [];
    try { migrated = JSON.parse(localStorage.getItem(OLD_KEY)) || []; } catch {}
    const first = { id: uid(), name: "Time 1", members: migrated };
    return { teams: [first], active: first.id };
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  }
  function activeTeam() {
    return state.teams.find(t => t.id === state.active) || state.teams[0];
  }

  // ================= TIMES =================
  function addTeam() {
    const n = state.teams.length + 1;
    const t = { id: uid(), name: `Time ${n}`, members: [] };
    state.teams.push(t);
    state.active = t.id;
    editing = -1; openSlot = -1;
    save(); render();
    toast(`${t.name} criado.`);
  }
  function renameTeam(id) {
    const t = state.teams.find(x => x.id === id);
    if (!t) return;
    const name = prompt("Nome do time:", t.name);
    if (name == null) return;
    const trimmed = name.trim();
    if (trimmed) t.name = trimmed.slice(0, 30);
    save(); render();
  }
  function removeTeam(id) {
    if (state.teams.length <= 1) return toast("Você precisa de ao menos um time.");
    const t = state.teams.find(x => x.id === id);
    if (!t) return;
    if (!confirm(`Excluir "${t.name}"? Isso remove todos os membros dele.`)) return;
    state.teams = state.teams.filter(x => x.id !== id);
    if (state.active === id) state.active = state.teams[0].id;
    editing = -1; openSlot = -1;
    save(); render();
  }
  function switchTeam(id) {
    if (state.active === id) return;
    state.active = id;
    editing = -1; openSlot = -1;
    save(); render();
  }

  function makeBuild(abilities) {
    const z = () => Object.fromEntries(window.STAT_KEYS.map(k => [k, 0]));
    const iv = () => Object.fromEntries(window.STAT_KEYS.map(k => [k, IV_MAX]));
    return {
      ability: abilities[0] ? abilities[0].name : "",
      nature: "hardy", level: 100,
      evs: z(), ivs: iv(),
      moves: [null, null, null, null], // cada: null ou {name,type,category}
      item: "",
    };
  }

  // ================= MEMBROS DO TIME ATIVO =================
  async function add(name) {
    const team = activeTeam();
    if (team.members.length >= MAX) return toast(`${team.name} está cheio (máx. 6).`);
    if (team.members.some(m => m.name === name)) return toast(`${cap(name)} já está em ${team.name}.`);
    toast(`Adicionando ${cap(name)}…`);
    try {
      const p = await window.API.getPokemon(name);
      const base = Object.fromEntries(p.stats.map(s => [s.stat.name, s.base_stat]));
      const abilities = p.abilities.map(a => ({ name: a.ability.name, hidden: a.is_hidden }));
      const member = {
        name: p.name, id: p.id,
        types: p.types.map(t => t.type.name),
        base, abilities,
        moveList: window.API.normalizeMoves(p),
        build: makeBuild(abilities),
      };
      team.members.push(member);
      save(); render();
      toast(`${cap(name)} entrou em ${team.name}!`);
    } catch (e) {
      toast(`Erro ao adicionar: ${e.message}`);
    }
  }

  function remove(name) {
    const team = activeTeam();
    const i = team.members.findIndex(m => m.name === name);
    team.members = team.members.filter(m => m.name !== name);
    if (editing === i) { editing = -1; openSlot = -1; }
    save(); render();
  }
  function clearMembers() {
    const team = activeTeam();
    team.members = []; editing = -1; openSlot = -1;
    save(); render();
  }

  // status finais calculados de um membro
  function finalStats(m) {
    const b = m.build;
    return Object.fromEntries(window.STAT_KEYS.map(k =>
      [k, window.calcStat(k, m.base[k], b.ivs[k], b.evs[k], b.level, b.nature)]));
  }

  // ================= MOTOR DE ANÁLISE (time ativo) =================
  function analyze() {
    const T = window.TYPE_IDS;
    const members = activeTeam().members;

    // Defesa: por tipo atacante, quantos membros são fracos / resistem / imunes
    const defense = T.map(atk => {
      let weak = 0, resist = 0, immune = 0;
      for (const m of members) {
        const e = window.effectiveness(atk, m.types);
        if (e === 0) immune++; else if (e > 1) weak++; else if (e < 1) resist++;
      }
      return { type: atk, weak, resist, immune };
    });
    const sharedWeak = defense.filter(d => d.weak >= 2).sort((a, b) => b.weak - a.weak);

    // Ataque: usa os TIPOS DOS MOVIMENTOS de dano escolhidos; fallback = STAB (tipos do mon)
    let usedMoves = false;
    const atkTypes = new Set();
    for (const m of members) {
      const dmg = (m.build.moves || []).filter(x => x && x.type && x.category !== "status");
      if (dmg.length) { usedMoves = true; dmg.forEach(x => atkTypes.add(x.type)); }
      else m.types.forEach(t => atkTypes.add(t)); // fallback STAB deste membro
    }
    const coverage = T.map(def => {
      const best = [...atkTypes].reduce((mx, atk) => Math.max(mx, window.effectiveness(atk, [def])), 0);
      return { type: def, best };
    });
    const gaps = coverage.filter(c => c.best <= 1).map(c => c.type);

    // Status agregados (usa os status FINAIS calculados)
    const sum = Object.fromEntries(window.STAT_KEYS.map(k => [k, 0]));
    for (const m of members) { const fs = finalStats(m); for (const k in sum) sum[k] += fs[k]; }
    const n = members.length || 1;
    const avg = Object.fromEntries(Object.entries(sum).map(([k, v]) => [k, Math.round(v / n)]));
    const offense = Math.round((avg.attack + avg["special-attack"]) / 2);
    const bulk = Math.round((avg.hp + avg.defense + avg["special-defense"]) / 3);
    const speed = avg.speed;

    // completude do build (quantos têm 4 golpes)
    const incomplete = members.filter(m => (m.build.moves || []).filter(Boolean).length < 4);

    return { defense, sharedWeak, gaps, avg, offense, bulk, speed, usedMoves, incomplete,
             style: readStyle(offense, bulk, speed) };
  }

  function readStyle(offense, bulk, speed) {
    const notes = [];
    if (offense >= 260) notes.push("muito ofensivo");
    else if (offense >= 210) notes.push("ofensivo");
    if (bulk >= 230) notes.push("bem defensivo (muro)");
    else if (bulk < 170) notes.push("frágil defensivamente");
    if (speed >= 240) notes.push("rápido");
    else if (speed < 160) notes.push("lento");
    if (!notes.length) notes.push("equilibrado");
    return notes.join(", ");
  }

  // ================= RENDER: SELETOR DE TIMES =================
  function renderSwitcher() {
    const wrap = $("#team-switcher");
    if (!wrap) return;
    const chips = state.teams.map(t => `
      <span class="team-chip${t.id === state.active ? " active" : ""}" data-switch="${t.id}" title="Selecionar time">
        <span>${escapeHtml(t.name)} <span class="team-chip-count">${t.members.length}/${MAX}</span></span>
        <span class="team-chip-x" data-rename-team="${t.id}" title="Renomear">✎</span>
        ${state.teams.length > 1 ? `<span class="team-chip-x" data-remove-team="${t.id}" title="Excluir time">✕</span>` : ""}
      </span>`).join("");
    wrap.innerHTML = chips + `<button class="team-chip-add" id="team-add" title="Novo time">＋</button>`;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // ================= RENDER: SLOTS =================
  function render() {
    renderSwitcher();
    const team = activeTeam();
    const wrap = $("#team-slots");
    const slots = [];
    for (let i = 0; i < MAX; i++) {
      const m = team.members[i];
      if (m) {
        const nMoves = (m.build.moves || []).filter(Boolean).length;
        slots.push(`
          <div class="slot filled${editing === i ? " active" : ""}" data-edit="${i}">
            <button class="slot-remove" data-remove="${m.name}" title="Remover">✕</button>
            <img src="${window.API.SPRITE(m.id)}" alt="${m.name}" onerror="this.style.visibility='hidden'">
            <span class="slot-name">${cap(m.name)}</span>
            <span class="card-types">${m.types.map(badge).join("")}</span>
            <span class="slot-info">${nMoves}/4 golpes · <span class="edit-hint">editar ✎</span></span>
          </div>`);
      } else {
        slots.push(`<div class="slot empty">＋<small>vazio</small></div>`);
      }
    }
    wrap.innerHTML = slots.join("");
    $("#team-badge").textContent = team.members.length;
    $("#team-clear").disabled = team.members.length === 0;
    renderEditor();
    renderAnalysis();
  }

  // ================= RENDER: EDITOR DE MEMBRO =================
  function renderEditor() {
    const box = $("#team-editor");
    const team = activeTeam();
    const m = team.members[editing];
    if (editing < 0 || !m) { box.hidden = true; box.innerHTML = ""; return; }
    box.hidden = false;
    const b = m.build;
    const fs = finalStats(m);
    const evTotal = window.STAT_KEYS.reduce((a, k) => a + b.evs[k], 0);

    ensureEnrich(m);

    const abilityOpts = m.abilities.map(a =>
      `<option value="${a.name}"${a.name === b.ability ? " selected" : ""}>${cap(a.name)}${a.hidden ? " (oculta)" : ""}</option>`).join("");
    const natureOpts = window.NATURES.map(nat =>
      `<option value="${nat.id}"${nat.id === b.nature ? " selected" : ""}>${window.natureLabel(nat.id)}</option>`).join("");

    const moveSlots = [0, 1, 2, 3].map(i => movePickerHTML(m, i)).join("");

    const evRow = (k) => `
      <div class="ev-row">
        <span class="ev-label">${window.STAT_PT[k]}</span>
        <span class="ev-final" title="status final">${fs[k]}</span>
        <input class="ev-input" type="number" min="0" max="${EV_MAX}" step="4" value="${b.evs[k]}" data-ev="${k}">
        <input class="iv-input" type="number" min="0" max="${IV_MAX}" value="${b.ivs[k]}" data-iv="${k}" title="IV (0–31)">
        <span class="ev-bar"><i style="width:${(fs[k] / 714) * 100}%"></i></span>
      </div>`;

    box.innerHTML = `
      <div class="editor-head">
        <img src="${window.API.SPRITE(m.id)}" alt="${m.name}">
        <div>
          <h3>${cap(m.name)} <span class="muted">#${String(m.id).padStart(4, "0")}</span></h3>
          <div class="card-types">${m.types.map(badge).join("")}</div>
        </div>
        <button class="btn-ghost" id="editor-close">Fechar ✕</button>
      </div>

      <div class="editor-grid">
        <label class="fld">Habilidade
          <select id="f-ability">${abilityOpts}</select>
        </label>
        <label class="fld">Nature
          <select id="f-nature">${natureOpts}</select>
        </label>
        <label class="fld">Nível
          <input id="f-level" type="number" min="1" max="100" value="${b.level}">
        </label>
        <label class="fld">Item (opcional)
          <input id="f-item" type="text" placeholder="ex.: Leftovers" value="${b.item || ""}">
        </label>
      </div>

      <h4>Movimentos <span class="muted">(escolha até 4 — busque por nome, filtre por método)</span></h4>
      <div class="moves-editor">${moveSlots}</div>

      <h4>Status <span class="muted">— EVs (0–252, total ${evTotal}/${EV_TOTAL}) e IVs (0–31)</span></h4>
      <div class="ev-head"><span></span><span>Final</span><span>EV</span><span>IV</span><span></span></div>
      <div class="ev-grid">${window.STAT_KEYS.map(evRow).join("")}</div>
      ${evTotal > EV_TOTAL ? `<p class="error small">Total de EVs acima de ${EV_TOTAL}. Reduza para um build válido.</p>` : ""}
    `;
    wireEditor(m);
  }

  function catPT(c) { return c === "physical" ? "Físico" : c === "special" ? "Especial" : "Status"; }
  function methodOf(mv) {
    return mv.methods.includes("level-up") ? "level-up"
      : mv.methods.includes("machine") ? "machine"
      : mv.methods.includes("egg") ? "egg" : "tutor";
  }
  function methodLabel(mv) {
    const meth = methodOf(mv);
    if (meth === "level-up") return mv.level ? `Nv ${mv.level}` : "Nível";
    return { machine: "MT/HM", egg: "Ovo", tutor: "Tutor" }[meth];
  }

  // busca detalhes (tipo/categoria/poder) de todos os golpes do membro em edição, em segundo
  // plano, para que o seletor mostre tipo/categoria/poder sem esperar clique a clique.
  function ensureEnrich(m) {
    if (moveEnrich[m.name]) return;
    moveEnrich[m.name] = {}; // placeholder p/ não disparar 2x
    const myEditIndex = editing, myName = m.name;
    window.API.enrichMoves(m.moveList.map(mv => mv.name), (done, total) => {
      if (editing !== myEditIndex || !activeTeam().members[editing] || activeTeam().members[editing].name !== myName) return;
      if (done === total || done % 15 === 0) refreshOpenMoveList();
    }).then(map => {
      moveEnrich[myName] = map;
      if (editing === myEditIndex && activeTeam().members[editing] && activeTeam().members[editing].name === myName) {
        refreshOpenMoveList();
        // atualiza badges de tipo/categoria já escolhidos, se ainda não tínhamos o detalhe
        const b = activeTeam().members[editing].build;
        let changed = false;
        b.moves.forEach((mv, i) => {
          if (mv && mv.type == null && map[mv.name] && map[mv.name].type) {
            b.moves[i] = { name: mv.name, type: map[mv.name].type, category: map[mv.name].category };
            changed = true;
          }
        });
        if (changed) { save(); renderEditor(); renderAnalysis(); } else { refreshOpenMoveList(); }
      }
    });
  }

  // ---- seletor de golpe (por slot 0-3) ----
  function movePickerHTML(m, i) {
    const chosen = m.build.moves[i];
    const isOpen = openSlot === i;
    const btnLabel = chosen
      ? `<span class="badge mv-badge" style="--c:${chosen.type ? window.TYPE_COLOR[chosen.type] : "#666"}">${chosen.type ? window.TYPE_PT[chosen.type] : "?"}</span>
         <span class="mv-name">${cap(chosen.name)}</span>
         <span class="mv-cat cat-${chosen.category || "status"}">${catPT(chosen.category || "status")}</span>`
      : `<span class="mv-name">— escolher golpe —</span>`;
    return `
      <div class="move-picker${isOpen ? " open" : ""}" data-slot="${i}">
        <button type="button" class="move-picker-btn${chosen ? "" : " empty"}" data-toggle-slot="${i}">
          ${btnLabel}<span class="chev">${isOpen ? "▲" : "▼"}</span>
        </button>
        ${isOpen ? movePickerPanelHTML(m, i) : ""}
      </div>`;
  }

  function movePickerPanelHTML(m, i) {
    return `
      <div class="move-picker-panel" data-panel="${i}">
        <input class="mvp-search" type="search" placeholder="Buscar golpe…" data-mvp-search="${i}" value="${escapeHtml(picker.q)}" autocomplete="off">
        <div class="mvp-filters">
          ${["", "level-up", "machine", "egg", "tutor"].map(v => {
            const label = { "": "Todos", "level-up": "Nível", machine: "MT/HM", egg: "Ovo", tutor: "Tutor" }[v];
            return `<button type="button" class="mvp-chip${picker.method === v ? " active" : ""}" data-mvp-method="${v}">${label}</button>`;
          }).join("")}
        </div>
        <button type="button" class="mvp-clear" data-mvp-clear="${i}">✕ deixar slot vazio</button>
        <div class="mvp-list" id="mvp-list"></div>
      </div>`;
  }

  function filteredMoves(m) {
    const q = picker.q.trim().toLowerCase();
    return m.moveList.filter(mv => {
      if (q && !mv.name.includes(q)) return false;
      if (picker.method && !mv.methods.includes(picker.method)) return false;
      return true;
    });
  }

  function moveRowHTML(m, mv, i) {
    const d = (moveEnrich[m.name] || {})[mv.name];
    const selected = m.build.moves[i] && m.build.moves[i].name === mv.name;
    const typeCell = d && d.type
      ? `<span class="badge mv-badge" style="--c:${window.TYPE_COLOR[d.type]}">${window.TYPE_PT[d.type]}</span>`
      : `<span class="badge mv-badge" style="--c:#555">…</span>`;
    const catCell = d ? `<span class="mv-cat cat-${d.category}">${catPT(d.category)}</span>` : "";
    const power = d && d.category !== "status" ? (d.power ?? "—") : "";
    return `
      <div class="mvp-row${selected ? " selected" : ""}" data-pick-move="${i}:${mv.name}">
        ${typeCell}
        <span class="mv-name">${cap(mv.name)}</span>
        ${power !== "" ? `<span class="mv-stat" title="Poder">${power}</span>` : ""}
        ${catCell}
        <span class="mv-how">${methodLabel(mv)}</span>
      </div>`;
  }

  function renderMoveList(m, i) {
    const wrap = document.getElementById("mvp-list");
    if (!wrap) return;
    const rows = filteredMoves(m);
    wrap.innerHTML = rows.length
      ? rows.map(mv => moveRowHTML(m, mv, i)).join("")
      : `<p class="mvp-empty">Nenhum golpe encontrado.</p>`;
  }

  function refreshOpenMoveList() {
    if (openSlot < 0) return;
    const m = activeTeam().members[editing];
    if (m) renderMoveList(m, openSlot);
  }

  async function pickMove(m, i, name) {
    const cached = (moveEnrich[m.name] || {})[name];
    m.build.moves[i] = cached
      ? { name, type: cached.type, category: cached.category }
      : { name, type: null, category: "status" };
    openSlot = -1;
    save(); renderEditor(); renderAnalysis();
    if (!cached) {
      try {
        const d = await window.API.getMove(name);
        const cur = activeTeam().members[editing];
        if (cur && cur.build.moves[i] && cur.build.moves[i].name === name) {
          cur.build.moves[i] = { name, type: d.type, category: d.category };
          save(); renderEditor(); renderAnalysis();
        }
      } catch { /* mantém placeholder */ }
    }
  }

  function wireEditor(m) {
    const b = m.build;
    const box = $("#team-editor");
    box.querySelector("#editor-close").onclick = () => { editing = -1; openSlot = -1; render(); };
    box.querySelector("#f-ability").onchange = (e) => { b.ability = e.target.value; save(); };
    box.querySelector("#f-item").oninput = (e) => { b.item = e.target.value; save(); };
    box.querySelector("#f-nature").onchange = (e) => { b.nature = e.target.value; save(); renderEditor(); renderAnalysis(); };
    box.querySelector("#f-level").onchange = (e) => {
      b.level = Math.max(1, Math.min(100, Number(e.target.value) || 100));
      save(); renderEditor(); renderAnalysis();
    };
    box.querySelectorAll("[data-ev]").forEach(inp => {
      inp.onchange = (e) => {
        let v = Math.max(0, Math.min(EV_MAX, Number(e.target.value) || 0));
        // respeita o teto total de 510
        const others = window.STAT_KEYS.reduce((a, k) => a + (k === inp.dataset.ev ? 0 : b.evs[k]), 0);
        v = Math.min(v, EV_TOTAL - others);
        b.evs[inp.dataset.ev] = v; save(); renderEditor(); renderAnalysis();
      };
    });
    box.querySelectorAll("[data-iv]").forEach(inp => {
      inp.onchange = (e) => {
        b.ivs[inp.dataset.iv] = Math.max(0, Math.min(IV_MAX, Number(e.target.value) || 0));
        save(); renderEditor(); renderAnalysis();
      };
    });

    // seletor de golpes: abrir/fechar, buscar, filtrar por método, escolher, limpar
    box.querySelectorAll("[data-toggle-slot]").forEach(btn => {
      btn.onclick = () => {
        const i = Number(btn.dataset.toggleSlot);
        openSlot = openSlot === i ? -1 : i;
        picker = { q: "", method: "" };
        renderEditor();
        if (openSlot >= 0) {
          const input = box.querySelector(`[data-mvp-search="${openSlot}"]`);
          if (input) input.focus();
        }
      };
    });
    const panel = box.querySelector("[data-panel]");
    if (panel) {
      const i = Number(panel.dataset.panel);
      renderMoveList(m, i);
      const search = panel.querySelector("[data-mvp-search]");
      search.oninput = (e) => { picker.q = e.target.value; renderMoveList(m, i); };
      panel.querySelectorAll("[data-mvp-method]").forEach(chip => {
        chip.onclick = () => {
          picker.method = picker.method === chip.dataset.mvpMethod ? "" : chip.dataset.mvpMethod;
          panel.querySelectorAll("[data-mvp-method]").forEach(c => c.classList.toggle("active", c.dataset.mvpMethod === picker.method));
          renderMoveList(m, i);
        };
      });
      panel.querySelector("[data-mvp-clear]").onclick = () => {
        b.moves[i] = null; openSlot = -1; save(); renderEditor(); renderAnalysis();
      };
      panel.querySelectorAll("[data-pick-move]").forEach(row => {
        row.onclick = () => {
          const [slot, name] = row.dataset.pickMove.split(/:(.+)/);
          pickMove(m, Number(slot), name);
        };
      });
    }
  }

  // ================= RENDER: ANÁLISE =================
  function renderAnalysis() {
    const box = $("#analysis");
    const team = activeTeam();
    if (team.members.length === 0) {
      box.innerHTML = `<p class="muted">Adicione Pokémon a "${escapeHtml(team.name)}" (botão ＋ nos cards ou na ficha)
        e clique num membro para montá-lo (habilidade, nature, EVs/IVs e golpes). A análise abaixo mostra
        cobertura de tipos, fraquezas compartilhadas e o perfil de status deste time. Use o seletor de times
        acima para criar e comparar vários times.</p>`;
      return;
    }
    const a = analyze();
    const chip = (t, extra = "") => `<span class="badge" style="--c:${window.TYPE_COLOR[t]}">${window.TYPE_PT[t]}${extra}</span>`;
    const bar = (label, val, max = 450) => `
      <div class="stat"><span class="stat-label">${label}</span>
        <span class="stat-val">${val}</span>
        <span class="stat-bar"><i style="width:${Math.min(100, (val / max) * 100)}%"></i></span></div>`;

    box.innerHTML = `
      <div class="analysis-grid">
        <section class="acard">
          <h4>🎯 Cobertura ofensiva <span class="muted">(${a.usedMoves ? "pelos golpes" : "por STAB"})</span></h4>
          ${a.gaps.length
            ? `<p>Sem golpe super-efetivo contra <b>${a.gaps.length}</b> tipos:</p>
               <div class="chips">${a.gaps.map(t => chip(t)).join("")}</div>`
            : `<p class="good">✔ O time cobre super-efetivamente todos os 18 tipos.</p>`}
          ${!a.usedMoves ? `<p class="muted small">Escolha golpes de dano nos membros para uma leitura precisa (agora está usando os tipos dos Pokémon).</p>` : ""}
        </section>

        <section class="acard">
          <h4>🛡️ Fraquezas compartilhadas <span class="muted">(2+ membros)</span></h4>
          ${a.sharedWeak.length
            ? `<div class="chips">${a.sharedWeak.map(d => chip(d.type, ` ×${d.weak}`)).join("")}</div>
               <p class="muted small">Nº = quantos membros são fracos a esse tipo.</p>`
            : `<p class="good">✔ Nenhum tipo ameaça 2+ membros ao mesmo tempo.</p>`}
        </section>

        <section class="acard">
          <h4>📊 Perfil de status <span class="muted">(médias, status finais)</span></h4>
          ${bar("Ofensivo", a.offense)}
          ${bar("Defensivo (bulk)", a.bulk)}
          ${bar("Velocidade", a.speed)}
          <p class="style-read">Estilo do time: <b>${a.style}</b>.</p>
        </section>

        <section class="acard span2">
          <h4>🧭 Sugestões</h4>
          <ul class="suggestions">
            ${a.incomplete.length ? `<li>${a.incomplete.length} membro(s) ainda sem 4 golpes — complete o moveset para a cobertura ficar precisa.</li>` : ""}
            ${a.gaps.length ? `<li>Adicione um golpe/Pokémon dos tipos que faltam para fechar a cobertura ofensiva.</li>`
              : `<li class="good">Cobertura ofensiva completa.</li>`}
            ${a.sharedWeak.length ? `<li>Reduza a exposição a <b>${window.TYPE_PT[a.sharedWeak[0].type]}</b> (fere ${a.sharedWeak[0].weak} membros): inclua um tipo que resista a ele.</li>`
              : `<li class="good">Defesa equilibrada, sem fraqueza dominante.</li>`}
            ${a.speed < 200 ? `<li>Time relativamente lento — considere um membro veloz.</li>` : ""}
            ${a.bulk < 170 ? `<li>Pouca resistência — um "muro" (alto HP/Def) aumenta a longevidade.</li>` : ""}
          </ul>
        </section>
      </div>

      <details class="matrix-details">
        <summary>Ver matriz defensiva completa (18 tipos)</summary>
        <div class="matrix">
          ${a.defense.map(d => {
            const net = d.weak - d.resist;
            const cls = d.weak >= 2 ? "bad" : net > 0 ? "warn" : d.resist > d.weak ? "ok" : "";
            return `<div class="mrow ${cls}"><span class="badge" style="--c:${window.TYPE_COLOR[d.type]}">${window.TYPE_PT[d.type]}</span>
              <span title="fracos">💥 ${d.weak}</span><span title="resistem">🛡️ ${d.resist}</span><span title="imunes">🚫 ${d.immune}</span></div>`;
          }).join("")}
        </div>
      </details>`;
  }

  // ---- toast ----
  let toastTimer;
  function toast(msg) {
    let el = $("#toast");
    if (!el) { el = document.createElement("div"); el.id = "toast"; document.body.appendChild(el); }
    el.textContent = msg; el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
  }

  function init() {
    $("#team-switcher").addEventListener("click", (e) => {
      if (e.target.closest("#team-add")) return addTeam();
      const rm = e.target.closest("[data-remove-team]");
      if (rm) { e.stopPropagation(); removeTeam(rm.dataset.removeTeam); return; }
      const rn = e.target.closest("[data-rename-team]");
      if (rn) { e.stopPropagation(); renameTeam(rn.dataset.renameTeam); return; }
      const sw = e.target.closest("[data-switch]");
      if (sw) switchTeam(sw.dataset.switch);
    });
    $("#team-slots").addEventListener("click", (e) => {
      const rm = e.target.closest("[data-remove]");
      if (rm) { e.stopPropagation(); remove(rm.dataset.remove); return; }
      const ed = e.target.closest("[data-edit]");
      if (ed) {
        const i = Number(ed.dataset.edit);
        editing = editing === i ? -1 : i;
        openSlot = -1;
        render();
        if (editing >= 0) $("#team-editor").scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });
    $("#team-clear").addEventListener("click", () => {
      const team = activeTeam();
      if (team.members.length && confirm(`Limpar todos os membros de "${team.name}"?`)) clearMembers();
    });
    render();
  }

  return { init, add, remove, clear: clearMembers, analyze };
})();
