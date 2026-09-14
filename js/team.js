/* team.js — montador de time (até 6) e o MOTOR DE ANÁLISE.
 * Toda a matemática usa a tabela embutida em types.js — não depende da PokéAPI,
 * exceto buscar os status base de cada membro (cacheado) ao adicioná-lo.
 */

window.Team = (function () {
  const KEY = "poke:team:v1";
  const MAX = 6;
  let members = load();          // [{name, id, types, stats:{...}}]

  const $ = (s) => document.querySelector(s);
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(members)); } catch {}
  }

  async function add(name) {
    if (members.length >= MAX) return toast("Time cheio (máx. 6).");
    if (members.some(m => m.name === name)) return toast(`${cap(name)} já está no time.`);
    toast(`Adicionando ${cap(name)}…`);
    try {
      const p = await window.API.getPokemon(name);
      const stats = Object.fromEntries(p.stats.map(s => [s.stat.name, s.base_stat]));
      members.push({
        name: p.name, id: p.id,
        types: p.types.map(t => t.type.name),
        stats,
      });
      save(); render();
      toast(`${cap(name)} entrou no time!`);
    } catch (e) {
      toast(`Erro ao adicionar: ${e.message}`);
    }
  }

  function remove(name) {
    members = members.filter(m => m.name !== name);
    save(); render();
  }
  function clear() { members = []; save(); render(); }

  // ================= MOTOR DE ANÁLISE =================
  function analyze() {
    const T = window.TYPE_IDS;

    // --- Defesa: para cada tipo atacante, quantos membros são fracos / resistem ---
    const defense = T.map(atk => {
      let weak = 0, resist = 0, immune = 0;
      for (const m of members) {
        const e = window.effectiveness(atk, m.types);
        if (e === 0) immune++;
        else if (e > 1) weak++;
        else if (e < 1) resist++;
      }
      return { type: atk, weak, resist, immune };
    });
    const sharedWeak = defense.filter(d => d.weak >= 2)
      .sort((a, b) => b.weak - a.weak);              // risco: 2+ membros fracos ao mesmo tipo

    // --- Ataque (STAB): quais tipos defensores o time bate super-efetivo ---
    const teamTypes = [...new Set(members.flatMap(m => m.types))];
    const coverage = T.map(def => {
      const best = teamTypes.reduce((mx, atk) =>
        Math.max(mx, window.effectiveness(atk, [def])), 0);
      return { type: def, best };
    });
    const covered = coverage.filter(c => c.best >= 2).map(c => c.type);
    const gaps = coverage.filter(c => c.best <= 1).map(c => c.type); // sem STAB super-efetivo

    // --- Status agregados / perfil de estilo ---
    const sum = { hp: 0, attack: 0, defense: 0, "special-attack": 0, "special-defense": 0, speed: 0 };
    for (const m of members) for (const k in sum) sum[k] += m.stats[k] || 0;
    const n = members.length || 1;
    const avg = Object.fromEntries(Object.entries(sum).map(([k, v]) => [k, Math.round(v / n)]));
    const offense = Math.round((avg.attack + avg["special-attack"]) / 2);
    const bulk = Math.round((avg.hp + avg.defense + avg["special-defense"]) / 3);
    const speed = avg.speed;
    const style = readStyle(offense, bulk, speed);

    return { defense, sharedWeak, covered, gaps, avg, sum, offense, bulk, speed, style };
  }

  function readStyle(offense, bulk, speed) {
    const notes = [];
    if (offense >= 100) notes.push("muito ofensivo");
    else if (offense >= 80) notes.push("ofensivo");
    if (bulk >= 90) notes.push("bem defensivo (muro)");
    else if (bulk < 65) notes.push("frágil defensivamente");
    if (speed >= 95) notes.push("rápido");
    else if (speed < 60) notes.push("lento");
    if (!notes.length) notes.push("equilibrado");
    return notes.join(", ");
  }

  // ================= RENDER =================
  function render() {
    const wrap = $("#team-slots");
    const slots = [];
    for (let i = 0; i < MAX; i++) {
      const m = members[i];
      slots.push(m ? `
        <div class="slot filled" data-name="${m.name}">
          <button class="slot-remove" data-remove="${m.name}" title="Remover">✕</button>
          <img src="${window.API.SPRITE(m.id)}" alt="${m.name}" onerror="this.style.visibility='hidden'">
          <span class="slot-name">${cap(m.name)}</span>
          <span class="card-types">${m.types.map(t =>
            `<span class="badge" style="--c:${window.TYPE_COLOR[t]}">${window.TYPE_PT[t]}</span>`).join("")}</span>
        </div>`
        : `<div class="slot empty">＋<small>vazio</small></div>`);
    }
    wrap.innerHTML = slots.join("");
    $("#team-badge").textContent = members.length;
    renderAnalysis();
  }

  function renderAnalysis() {
    const box = $("#analysis");
    if (members.length === 0) {
      box.innerHTML = `<p class="muted">Adicione Pokémon (botão ＋ nos cards ou na ficha)
        para ver a análise de cobertura de tipos, fraquezas compartilhadas e o perfil de status do time.</p>`;
      return;
    }
    const a = analyze();
    const chip = (t, extra = "") =>
      `<span class="badge" style="--c:${window.TYPE_COLOR[t]}">${window.TYPE_PT[t]}${extra}</span>`;

    // barras do perfil de status
    const bar = (label, val, max = 150) => `
      <div class="stat">
        <span class="stat-label">${label}</span>
        <span class="stat-val">${val}</span>
        <span class="stat-bar"><i style="width:${Math.min(100, (val / max) * 100)}%"></i></span>
      </div>`;

    box.innerHTML = `
      <div class="analysis-grid">
        <section class="acard">
          <h4>🎯 Cobertura ofensiva <span class="muted">(por STAB)</span></h4>
          ${a.gaps.length
            ? `<p>Sem golpe super-efetivo (STAB) contra <b>${a.gaps.length}</b> tipos:</p>
               <div class="chips">${a.gaps.map(t => chip(t)).join("")}</div>`
            : `<p class="good">✔ O time cobre super-efetivamente todos os 18 tipos por STAB.</p>`}
        </section>

        <section class="acard">
          <h4>🛡️ Fraquezas compartilhadas <span class="muted">(2+ membros)</span></h4>
          ${a.sharedWeak.length
            ? `<div class="chips">${a.sharedWeak.map(d =>
                chip(d.type, ` ×${d.weak}`)).join("")}</div>
               <p class="muted small">Nº = quantos membros são fracos a esse tipo. Priorize cobrir os maiores.</p>`
            : `<p class="good">✔ Nenhum tipo ameaça 2+ membros ao mesmo tempo. Bom balanço defensivo.</p>`}
        </section>

        <section class="acard">
          <h4>📊 Perfil de status <span class="muted">(médias do time)</span></h4>
          ${bar("Ofensivo", a.offense)}
          ${bar("Defensivo (bulk)", a.bulk)}
          ${bar("Velocidade", a.speed)}
          <p class="style-read">Estilo do time: <b>${a.style}</b>.</p>
        </section>

        <section class="acard span2">
          <h4>🧭 Sugestões</h4>
          <ul class="suggestions">
            ${a.gaps.length
              ? `<li>Adicione um Pokémon com golpe dos tipos que faltam para fechar a cobertura ofensiva.</li>`
              : `<li class="good">Cobertura ofensiva completa — foque em refinar defesa e velocidade.</li>`}
            ${a.sharedWeak.length
              ? `<li>Reduza a exposição a <b>${window.TYPE_PT[a.sharedWeak[0].type]}</b> (fere ${a.sharedWeak[0].weak} membros): inclua um tipo que resista a ele.</li>`
              : `<li class="good">Defesa equilibrada, sem fraqueza dominante.</li>`}
            ${a.speed < 70 ? `<li>Time relativamente lento — considere um membro veloz para controlar o ritmo.</li>` : ""}
            ${a.bulk < 65 ? `<li>Pouca resistência — um Pokémon "muro" (alto HP/Def) aumenta a longevidade.</li>` : ""}
          </ul>
        </section>
      </div>

      <details class="matrix-details">
        <summary>Ver matriz defensiva completa (18 tipos)</summary>
        <div class="matrix">
          ${a.defense.map(d => {
            const net = d.weak - d.resist;
            const cls = d.weak >= 2 ? "bad" : net > 0 ? "warn" : d.resist > d.weak ? "ok" : "";
            return `<div class="mrow ${cls}">
              <span class="badge" style="--c:${window.TYPE_COLOR[d.type]}">${window.TYPE_PT[d.type]}</span>
              <span title="fracos">💥 ${d.weak}</span>
              <span title="resistem">🛡️ ${d.resist}</span>
              <span title="imunes">🚫 ${d.immune}</span>
            </div>`;
          }).join("")}
        </div>
      </details>`;
  }

  // toast simples
  let toastTimer;
  function toast(msg) {
    let el = $("#toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast"; document.body.appendChild(el);
    }
    el.textContent = msg; el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
  }

  function init() {
    $("#team-slots").addEventListener("click", (e) => {
      const rm = e.target.closest("[data-remove]");
      if (rm) remove(rm.dataset.remove);
    });
    $("#team-clear").addEventListener("click", () => {
      if (members.length && confirm("Limpar o time inteiro?")) clear();
    });
    render();
  }

  return { init, add, remove, clear, analyze };
})();
