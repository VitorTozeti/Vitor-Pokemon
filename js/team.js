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
  let openItem = false;      // seletor de item aberto no editor?
  let itemPick = { q: "", cat: "" }; // filtro do seletor de item aberto
  const moveEnrich = {};     // cache em memória: nome do pokémon -> { moveName: detalhe|null }

  // ================= PERSISTÊNCIA =================
  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY));
      if (raw && Array.isArray(raw.teams) && raw.teams.length) {
        raw.teams.forEach(t => { if (typeof t.meta !== "string") t.meta = ""; }); // migra times sem meta
        return raw;
      }
    } catch {}
    // migra do formato antigo (um único time, sem nome)
    let migrated = [];
    try { migrated = JSON.parse(localStorage.getItem(OLD_KEY)) || []; } catch {}
    const first = { id: uid(), name: "Time 1", members: migrated, meta: "" };
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
    const t = { id: uid(), name: `Time ${n}`, members: [], meta: "" };
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
    delete aiRuns[id];
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
      mega: null, // nome da variedade mega escolhida (ex.: "charizard-mega-x") ou null
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
        species: p.species ? p.species.name : p.name,
        types: p.types.map(t => t.type.name),
        base, abilities,
        moveList: window.API.normalizeMoves(p),
        build: makeBuild(abilities),
      };
      team.members.push(member);
      save(); render();
      toast(`${cap(name)} entrou em ${team.name}!`);
      ensureMegaForms(member);
    } catch (e) {
      toast(`Erro ao adicionar: ${e.message}`);
    }
  }

  // ---- mega evolução (mega pedra) ----
  // Detecta, via as "varieties" da espécie na PokéAPI, quais formas mega existem (Mega X/Y
  // incluído) pra oferecer no editor. Não bloqueia o fluxo de adicionar — roda em segundo
  // plano e só re-renderiza se o membro ainda estiver na tela quando terminar.
  function megaFormLabel(varietyName, speciesName) {
    const rest = varietyName.startsWith(speciesName + "-")
      ? varietyName.slice(speciesName.length + 1) : varietyName;
    return rest.split("-").map(w => (w === "x" || w === "y") ? w.toUpperCase() : w === "mega" ? "Mega" : cap(w)).join(" ");
  }

  function ensureMegaForms(m) {
    if (m.megaForms !== undefined) return; // já carregado (ou tentativa em andamento)
    m.megaForms = [];
    loadMegaForms(m);
  }

  async function loadMegaForms(m) {
    try {
      const species = await window.API.getSpecies(m.species || m.name);
      const varieties = species.varieties || [];
      const megas = varieties.filter(v => /-mega(-[xy])?$/.test(v.pokemon.name));
      m.megaForms = megas.map(v => ({
        name: v.pokemon.name,
        id: window.API.idFromUrl(v.pokemon.url),
        label: megaFormLabel(v.pokemon.name, species.name),
      }));
      // + megas customizadas (fan-made) desta espécie (não existem na PokéAPI)
      appendCustomMegas(m, species.name);
      save();
      // só re-renderiza se este membro ainda estiver visível (evita "pulos" de UI)
      const stillThere = activeTeam().members.includes(m);
      if (stillThere) { render(); }
    } catch { /* sem mega forms disponíveis / falha de rede: fica sem a opção */ }
  }

  // acrescenta em m.megaForms as megas customizadas (fan-made) cuja espécie base bate.
  function appendCustomMegas(m, speciesName) {
    const cm = window.CUSTOM_MEGAS || {};
    Object.entries(cm).forEach(([variety, data]) => {
      if (data.base !== speciesName) return;
      if (m.megaForms.some(mf => mf.name === variety)) return; // evita duplicar
      m.megaForms.push({
        name: variety,
        id: data.baseId, // sem sprite próprio: reaproveita o sprite da forma base
        label: megaFormLabel(variety, speciesName) + " ✨", // ✨ marca que é customizada
        custom: true,
      });
    });
  }

  // pedra de mega correspondente a uma variedade mega (ex.: "charizard-mega-x" -> "charizardite-x")
  function stoneForMega(varietyName) {
    const s = window.MEGA_STONES && window.MEGA_STONES[varietyName];
    return s ? s.id : null;
  }

  async function selectMega(m, varietyName) {
    const b = m.build;
    const prevMega = b.mega;
    b.mega = varietyName || null;

    // integração item <-> mega pedra: ao escolher uma mega, já segura a pedra certa; ao tirar
    // a mega, se o item era uma mega pedra, esvazia o item.
    if (b.mega) {
      const stone = stoneForMega(b.mega);
      if (stone) b.item = stone;
    } else {
      const prevStone = prevMega && stoneForMega(prevMega);
      if (prevStone && b.item === prevStone) b.item = "";
    }

    save(); renderEditor(); render(); renderAnalysis();
    if (!b.mega) return;
    if (!m.megaData) m.megaData = {};
    if (m.megaData[b.mega]) { applyMegaAbility(m); renderEditor(); render(); renderAnalysis(); return; }

    // mega customizada (fan-made): dados já embutidos em items.js, sem chamar a PokéAPI.
    const custom = window.CUSTOM_MEGAS && window.CUSTOM_MEGAS[b.mega];
    if (custom) {
      m.megaData[b.mega] = {
        id: custom.baseId, // reaproveita o sprite/nº da forma base
        types: custom.types.slice(),
        base: { ...custom.stats },
        abilities: [{ name: custom.ability, hidden: false }],
      };
      save();
      if (m.build.mega === b.mega) { applyMegaAbility(m); renderEditor(); render(); renderAnalysis(); }
      return;
    }

    try {
      toast("Carregando mega evolução…");
      const mp = await window.API.getPokemon(b.mega);
      m.megaData[b.mega] = {
        id: mp.id,
        types: mp.types.map(t => t.type.name),
        base: Object.fromEntries(mp.stats.map(s => [s.stat.name, s.base_stat])),
        // mega evoluções costumam ter uma habilidade fixa própria (ex.: Charizard X -> Dura Garra)
        abilities: mp.abilities.map(a => ({ name: a.ability.name, hidden: a.is_hidden })),
      };
      save();
      if (m.build.mega === b.mega) { applyMegaAbility(m); renderEditor(); render(); renderAnalysis(); }
    } catch {
      toast("Erro ao carregar a mega evolução.");
      if (m.build.mega === varietyName) { m.build.mega = null; save(); renderEditor(); render(); renderAnalysis(); }
    }
  }

  // quando uma mega tem habilidade própria, adota-a automaticamente no build (a mega evolução
  // sempre muda a habilidade para a da forma mega).
  function applyMegaAbility(m) {
    const data = m.build.mega && m.megaData && m.megaData[m.build.mega];
    if (!data || !data.abilities || !data.abilities.length) return;
    m.build.ability = data.abilities[0].name;
  }

  // habilidades disponíveis no editor: as da forma mega (se ativa) ou as da forma normal.
  function abilitiesOf(m) {
    const data = m.build && m.build.mega && m.megaData && m.megaData[m.build.mega];
    if (data && data.abilities && data.abilities.length) return data.abilities;
    return m.abilities;
  }

  // forma "ativa" de um membro: a mega escolhida (se já carregada) ou a forma normal —
  // usada pra sprite, tipos e status base em todo lugar (slots, editor, análise).
  function activeForm(m) {
    if (m.build && m.build.mega && m.megaData && m.megaData[m.build.mega]) return m.megaData[m.build.mega];
    return { id: m.id, types: m.types, base: m.base };
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

  // ================= IMPORTAR SETS (formato Pokémon Showdown) =================
  const slug = (s) => String(s || "").trim().toLowerCase().replace(/[.'’]/g, "").replace(/\s+/g, "-");
  const SHOWDOWN_STAT = { hp: "hp", atk: "attack", def: "defense", spa: "special-attack", spd: "special-defense", spe: "speed" };

  // Recebe uma lista de sets já parseados (ver tools.js) e monta um NOVO time com eles.
  async function importSets(sets, teamName) {
    if (!sets || !sets.length) { toast("Nada pra importar."); return; }
    const team = { id: uid(), name: (teamName || "Importado").slice(0, 30), members: [], meta: "" };
    state.teams.push(team); state.active = team.id;
    editing = -1; openSlot = -1; openItem = false;
    save(); render();
    toast(`Importando ${Math.min(sets.length, MAX)} Pokémon…`);

    for (const set of sets.slice(0, MAX)) {
      try {
        const p = await window.API.getPokemon(slug(set.species));
        const base = Object.fromEntries(p.stats.map(s => [s.stat.name, s.base_stat]));
        const abilities = p.abilities.map(a => ({ name: a.ability.name, hidden: a.is_hidden }));
        const b = makeBuild(abilities);
        if (set.ability) {
          const wanted = slug(set.ability);
          const found = abilities.find(a => a.name === wanted);
          if (found) b.ability = found.name;
        }
        if (set.item) { const id = slug(set.item); b.item = window.ITEM_BY_ID && window.ITEM_BY_ID[id] ? id : set.item; }
        if (set.level) b.level = Math.max(1, Math.min(100, set.level));
        if (set.nature && window.NATURE_BY_ID[slug(set.nature)]) b.nature = slug(set.nature);
        if (set.evs) for (const k in set.evs) if (window.STAT_KEYS.includes(k)) b.evs[k] = Math.max(0, Math.min(EV_MAX, set.evs[k]));
        if (set.ivs) for (const k in set.ivs) if (window.STAT_KEYS.includes(k)) b.ivs[k] = Math.max(0, Math.min(IV_MAX, set.ivs[k]));
        const moves = (set.moves || []).slice(0, 4).map(n => ({ name: slug(n), type: null, category: "status" }));
        while (moves.length < 4) moves.push(null);
        b.moves = moves;
        const member = {
          name: p.name, id: p.id,
          species: p.species ? p.species.name : p.name,
          types: p.types.map(t => t.type.name),
          base, abilities, moveList: window.API.normalizeMoves(p), build: b,
        };
        team.members.push(member); save(); render();
        // enriquece os golpes escolhidos (tipo/categoria) pra análise ficar correta
        enrichChosenMoves(member);
        ensureMegaForms(member);
      } catch (e) { /* espécie inválida no set: pula */ }
    }
    toast(`${team.name}: ${team.members.length} Pokémon importados.`);
  }

  // busca tipo/categoria dos golpes JÁ escolhidos de um membro e atualiza o build
  async function enrichChosenMoves(member) {
    const chosen = (member.build.moves || []).filter(Boolean);
    for (const mv of chosen) {
      if (mv.type) continue;
      try {
        const d = await window.API.getMove(mv.name);
        if (member.build.moves.includes(mv)) { mv.type = d.type; mv.category = d.category; }
      } catch {}
    }
    save();
    if (activeTeam().members.includes(member)) { render(); renderAnalysis(); }
  }

  // status finais calculados de um membro (usa os status base da MEGA quando escolhida)
  function finalStats(m) {
    const b = m.build;
    const base = activeForm(m).base;
    return Object.fromEntries(window.STAT_KEYS.map(k =>
      [k, window.calcStat(k, base[k], b.ivs[k], b.evs[k], b.level, b.nature)]));
  }

  // item escolhido no build (objeto do catálogo) ou null
  function itemOf(m) {
    return (m.build && m.build.item && window.ITEM_BY_ID) ? window.ITEM_BY_ID[m.build.item] : null;
  }

  // status FINAIS já ajustados pelo efeito do item (Choice Scarf ×1.5 Vel, Assault Vest ×1.5
  // Def.Esp., Eviolite ×1.5 Def/Def.Esp. etc.) — usado no motor de análise e na calc de dano.
  function adjustedStats(m) {
    const fs = finalStats(m);
    const it = itemOf(m);
    if (it && it.mod) {
      for (const k in it.mod) if (fs[k] != null) fs[k] = Math.floor(fs[k] * it.mod[k]);
    }
    return fs;
  }

  // ================= MOTOR DE ANÁLISE (time ativo) =================
  function analyze() {
    const T = window.TYPE_IDS;
    const members = activeTeam().members;

    // Defesa: por tipo atacante, quantos membros são fracos / resistem / imunes
    // (usa os tipos da MEGA quando escolhida — mega evolução pode mudar o tipo, ex. Charizard X)
    const defense = T.map(atk => {
      let weak = 0, resist = 0, immune = 0;
      for (const m of members) {
        const e = window.effectiveness(atk, activeForm(m).types);
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
      else activeForm(m).types.forEach(t => atkTypes.add(t)); // fallback STAB deste membro
    }
    const coverage = T.map(def => {
      const best = [...atkTypes].reduce((mx, atk) => Math.max(mx, window.effectiveness(atk, [def])), 0);
      return { type: def, best };
    });
    const gaps = coverage.filter(c => c.best <= 1).map(c => c.type);

    // Status agregados (usa os status FINAIS já AJUSTADOS pelo item — Scarf/Band/AV/Eviolite…)
    const sum = Object.fromEntries(window.STAT_KEYS.map(k => [k, 0]));
    for (const m of members) { const fs = adjustedStats(m); for (const k in sum) sum[k] += fs[k]; }
    const n = members.length || 1;
    const avg = Object.fromEntries(Object.entries(sum).map(([k, v]) => [k, Math.round(v / n)]));
    const offense = Math.round((avg.attack + avg["special-attack"]) / 2);
    const bulk = Math.round((avg.hp + avg.defense + avg["special-defense"]) / 3);
    const speed = avg.speed;

    // completude do build (quantos têm 4 golpes)
    const incomplete = members.filter(m => (m.build.moves || []).filter(Boolean).length < 4);

    return { defense, sharedWeak, gaps, avg, offense, bulk, speed, usedMoves, incomplete,
             itemNotes: itemCoherence(members),
             style: readStyle(offense, bulk, speed) };
  }

  // Checagem de COERÊNCIA de itens: combinações que não fazem sentido (item + moveset/forma).
  // É barato e detectável só com o que já temos (build.moves, build.item, tipos) — sem fetch.
  const STATUS_ITEMS_OK_WITH_STATUS = new Set(); // (reservado p/ exceções futuras)
  function itemCoherence(members) {
    const notes = [];
    for (const m of members) {
      const it = itemOf(m);
      if (!it) continue;
      const moves = (m.build.moves || []).filter(Boolean);
      const hasDamage = moves.some(x => x.category && x.category !== "status");
      const hasStatus = moves.some(x => x.category === "status");
      const nm = cap(m.name);

      // Colete de Combate bloqueia golpes de status: tê-los no moveset é conflito direto.
      if (it.blocksStatus && hasStatus) {
        notes.push({ level: "bad", text: `${nm}: Colete de Combate não deixa usar golpes de status, mas o moveset tem golpe(s) de status.` });
      }
      // Itens Choice travam num golpe só — golpe de status/setup vira armadilha.
      if (it.locks && hasStatus && moves.length > 1) {
        notes.push({ level: "warn", text: `${nm}: item Choice trava no 1º golpe usado — ter golpe de status/setup no moveset é arriscado.` });
      }
      // Itens de dano puro sem nenhum golpe de ataque são desperdício.
      if ((it.dmg || it.se || it.phys || it.spec || it.locks) && moves.length && !hasDamage) {
        notes.push({ level: "warn", text: `${nm}: ${it.pt} só ajuda ataques, mas o moveset não tem golpe de dano.` });
      }
      // Eviolite só funciona em quem ainda pode evoluir; mega evolução nunca pode.
      if (it.nfeOnly && m.build.mega) {
        notes.push({ level: "bad", text: `${nm}: Eviolite não faz efeito em Pokémon mega evoluído.` });
      }
    }
    return notes;
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
        const form = activeForm(m);
        const megaTag = m.build.mega ? ` <span class="mega-tag">💎 mega</span>` : "";
        const it = itemOf(m);
        const itemLine = (it || m.build.item)
          ? `<span class="slot-item">${it ? `<img src="${window.itemSprite(it.id)}" alt="" onerror="this.style.display='none'">` : ""}${escapeHtml(window.itemLabel(m.build.item))}</span>`
          : "";
        slots.push(`
          <div class="slot filled${editing === i ? " active" : ""}" data-edit="${i}">
            <button class="slot-remove" data-remove="${m.name}" title="Remover">✕</button>
            <img src="${window.API.SPRITE(form.id)}" alt="${m.name}" onerror="this.style.visibility='hidden'">
            <span class="slot-name">${cap(m.name)}${megaTag}</span>
            <span class="card-types">${form.types.map(badge).join("")}</span>
            ${itemLine}
            <span class="slot-info">${nMoves}/4 golpes · <span class="edit-hint">editar ✎</span></span>
          </div>`);
      } else {
        slots.push(`<div class="slot empty">＋<small>vazio</small></div>`);
      }
    }
    wrap.innerHTML = slots.join("");
    $("#team-badge").textContent = team.members.length;
    $("#team-clear").disabled = team.members.length === 0;
    renderMetaBox();
    renderEditor();
    renderAnalysis();
  }

  // ================= RENDER: META DO TIME (objetivo/estratégia) =================
  const META_PRESETS = [
    { id: "ofensivo", label: "⚔️ Ofensivo (hyper offense)", text: "Time ofensivo/hyper offense: atacar rápido e forte, varrer o time adversário." },
    { id: "defensivo", label: "🛡️ Defensivo (stall)", text: "Time defensivo/stall: aguentar dano, curar e desgastar o adversário." },
    { id: "balanceado", label: "⚖️ Balanceado", text: "Time balanceado: mistura de ataque e defesa, sem exagerar em nenhum lado." },
    { id: "trick-room", label: "🌀 Trick Room", text: "Time de Trick Room: usar Pokémon lentos e fortes, invertendo a ordem de velocidade." },
    { id: "chuva", label: "🌧️ Chuva (rain)", text: "Time de chuva: abusar de golpes de Água e clima chuvoso para ganhar vantagem." },
    { id: "sol", label: "☀️ Sol (sun)", text: "Time de sol: abusar de golpes de Fogo e clima ensolarado para ganhar vantagem." },
  ];

  function renderMetaBox() {
    const box = $("#team-meta");
    if (!box) return;
    const team = activeTeam();
    const chips = META_PRESETS.map(p =>
      `<button type="button" class="meta-chip" data-meta-preset="${p.id}" title="Preencher com este objetivo">${p.label}</button>`).join("");
    box.innerHTML = `
      <h3>🎯 Meta do time <span class="muted">(qual é o objetivo/estratégia deste time?)</span></h3>
      <div class="meta-presets">${chips}</div>
      <textarea id="meta-text" class="meta-textarea" rows="2"
        placeholder="Ex.: time ofensivo rápido para varrer partidas, ou defensivo pra segurar o jogo até virar…">${escapeHtml(team.meta || "")}</textarea>
      <button type="button" class="btn-primary meta-send-btn" id="meta-send-ai">📤 Enviar time para a IA</button>`;
    const ta = box.querySelector("#meta-text");
    ta.oninput = debounceMeta(() => { activeTeam().meta = ta.value; save(); });
    box.querySelectorAll("[data-meta-preset]").forEach(btn => {
      btn.onclick = () => {
        const p = META_PRESETS.find(x => x.id === btn.dataset.metaPreset);
        if (!p) return;
        ta.value = p.text;
        activeTeam().meta = p.text;
        save();
      };
    });
    box.querySelector("#meta-send-ai").onclick = () => {
      const t = activeTeam();
      if (!t.members.length) { toast("Adicione Pokémon ao time antes de perguntar pra IA."); return; }
      // garante que o texto digitado vai pro time AGORA (o autosave do textarea tem debounce
      // de 300ms — clicar "enviar" logo após digitar não pode mandar a meta antiga/vazia).
      clearTimeout(metaDebounceTimer);
      t.meta = ta.value;
      save();
      runAi(t, analyze());
      $("#analysis").scrollIntoView({ behavior: "smooth", block: "start" });
    };
  }
  let metaDebounceTimer;
  function debounceMeta(fn) {
    return (...a) => { clearTimeout(metaDebounceTimer); metaDebounceTimer = setTimeout(() => fn(...a), 300); };
  }

  // ================= "IA" LOCAL — analisador de time gratuito, 100% no navegador =================
  // Não é um LLM: é um motor de regras que lê os números da análise (cobertura, fraquezas
  // compartilhadas, status finais, movesets) e a meta declarada pelo treinador, e devolve um
  // parecer em português — funciona offline, sem chave de API e sem custo.
  function stripAccents(s) {
    return s.normalize("NFD").replace(new RegExp("[\u0300-\u036f]", "g"), "");
  }

  function detectMetaProfile(metaText) {
    const t = stripAccents((metaText || "").toLowerCase());
    const has = (...words) => words.some(w => t.includes(w));
    if (has("captur", "false swipe", "investida falsa", "catch team", "pegar pokemon", "pegar pokémon")) {
      return { label: "Captura (time pra pegar Pokémon)", mode: "captura", offense: [0, 999], bulk: [0, 999], speed: [0, 999],
        note: "Time de captura não precisa de dano alto: o ideal é imobilizar o alvo (paralisia/sono/etc.) e baixar o HP sem nocautear — por isso a nota aqui olha pros golpes certos (Investida Falsa, paralisia/sono), não pro perfil ofensivo/bulk/velocidade." };
    }
    if (has("trick room", "trickroom")) {
      return { label: "Trick Room", offense: [200, 999], bulk: [190, 999], speed: [0, 170],
        note: "Em Trick Room a velocidade baixa é uma vantagem, não um problema — o ideal é ter Pokémon lentos e fortes." };
    }
    if (has("hyper offense", "ofensivo", "ataque", "sweep", "varrer")) {
      return { label: "Ofensivo (hyper offense)", offense: [230, 999], bulk: [0, 999], speed: [220, 999],
        note: "Times ofensivos vivem de velocidade e poder de fogo — bulk baixo é aceitável se o time vence rápido." };
    }
    if (has("defensivo", "stall", "muro", "tanque", "segurar")) {
      return { label: "Defensivo (stall)", offense: [0, 999], bulk: [230, 999], speed: [0, 999],
        note: "Times defensivos precisam de bulk alto e boa cobertura defensiva; ofensiva pode ser menor." };
    }
    if (has("chuva", "rain")) {
      return { label: "Chuva (rain)", offense: [190, 999], bulk: [0, 999], speed: [190, 999],
        note: "Times de clima dependem de setter + abusadores do clima (ex.: golpes de Água na chuva) — isso o motor não enxerga pelos números, então confira manualmente as habilidades/golpes de clima." };
    }
    if (has("sol", "sun")) {
      return { label: "Sol (sun)", offense: [190, 999], bulk: [0, 999], speed: [190, 999],
        note: "Times de clima dependem de setter + abusadores do clima (ex.: golpes de Fogo no sol) — isso o motor não enxerga pelos números, então confira manualmente as habilidades/golpes de clima." };
    }
    if (has("balanceado", "equilibrado")) {
      return { label: "Balanceado", offense: [170, 999], bulk: [170, 999], speed: [150, 999],
        note: "Times balanceados querem números razoáveis nas três frentes, sem depender de um único extremo." };
    }
    return { label: "Sem meta declarada (padrão equilibrado)", offense: [160, 999], bulk: [160, 999], speed: [140, 999],
      note: "Sem uma meta declarada, avaliei como um time genérico equilibrado. Descreva o objetivo acima para uma leitura mais precisa." };
  }

  function inRange(v, [min, max]) { return v >= min && v <= max; }

  // golpes usados por treinadores pra deixar o Pokémon selvagem capturável: baixar o HP
  // sem nocautear (chip damage) e travar o alvo (status) — a análise por tipo/bulk normal
  // não enxerga nada disso, então times de captura usam um critério à parte.
  const CAPTURE_CHIP_MOVES = ["false-swipe", "hold-back"];
  const CAPTURE_STATUS_MOVES = [
    "thunder-wave", "stun-spore", "glare", "nuzzle", "spore", "sleep-powder", "hypnosis",
    "sing", "dark-void", "grasswhistle",
  ];
  function teamMoveNames(team) {
    const names = new Set();
    team.members.forEach(m => (m.build.moves || []).forEach(mv => { if (mv) names.add(mv.name); }));
    return names;
  }

  function aiVerdict(a, team) {
    const profile = detectMetaProfile(team.meta);
    if (profile.mode === "captura") return aiVerdictCapture(a, team, profile);

    const n = team.members.length;
    const reasons = { pos: [], neg: [] };
    let score = 0;

    // cobertura ofensiva (até 3 pts)
    if (a.gaps.length === 0) { score += 3; reasons.pos.push("cobertura ofensiva fecha os 18 tipos"); }
    else if (a.gaps.length <= 3) { score += 2; reasons.pos.push("cobertura ofensiva quase completa"); }
    else if (a.gaps.length <= 8) { score += 1; reasons.neg.push(`${a.gaps.length} tipos sem golpe super-efetivo`); }
    else reasons.neg.push(`cobertura ofensiva fraca — ${a.gaps.length} tipos descobertos`);

    // fraquezas compartilhadas (até 2 pts)
    if (a.sharedWeak.length === 0) { score += 2; reasons.pos.push("nenhuma fraqueza compartilhada por 2+ membros"); }
    else if (a.sharedWeak.length === 1) { score += 1; reasons.neg.push(`todo o time é vulnerável a ${window.TYPE_PT[a.sharedWeak[0].type]}`); }
    else reasons.neg.push(`${a.sharedWeak.length} tipos ameaçam 2+ membros ao mesmo tempo`);

    // movesets completos (até 2 pts)
    const incompleteRatio = n ? a.incomplete.length / n : 1;
    if (incompleteRatio === 0) { score += 2; reasons.pos.push("todos os membros já têm 4 golpes definidos"); }
    else if (incompleteRatio <= 0.34) { score += 1; reasons.neg.push(`${a.incomplete.length} membro(s) ainda sem moveset completo`); }
    else reasons.neg.push(`${a.incomplete.length} de ${n} membros ainda sem 4 golpes — a análise fica imprecisa`);

    // encaixe com a meta declarada (até 3 pts)
    const fits = [inRange(a.offense, profile.offense), inRange(a.bulk, profile.bulk), inRange(a.speed, profile.speed)];
    const fitCount = fits.filter(Boolean).length;
    score += fitCount; // 0-3
    if (fitCount === 3) reasons.pos.push(`perfil de status combina com a meta "${profile.label}"`);
    else if (fitCount > 0) reasons.neg.push(`perfil de status só combina parcialmente com a meta "${profile.label}"`);
    else reasons.neg.push(`perfil de status não combina com a meta "${profile.label}" (confira ofensivo/bulk/velocidade)`);

    // coerência de itens (conflitos item×moveset pesam na nota)
    const badItems = (a.itemNotes || []).filter(x => x.level === "bad");
    if (badItems.length) { score -= badItems.length; badItems.forEach(x => reasons.neg.push(x.text)); }
    else if (!(a.itemNotes || []).length && team.members.some(m => m.build.item)) reasons.pos.push("itens escolhidos são coerentes com os movesets");

    // tamanho do time
    if (n < 6) reasons.neg.push(`time incompleto — só ${n}/6 membros (mais Pokémon ampliam cobertura e opções)`);

    score = Math.max(0, Math.min(10, Math.round(score)));
    let tier, tierClass;
    if (score >= 8) { tier = "Time muito bom 👍"; tierClass = "good"; }
    else if (score >= 6) { tier = "Bom, com espaço pra ajuste"; tierClass = "ok"; }
    else if (score >= 4) { tier = "Mediano — precisa de trabalho"; tierClass = "warn"; }
    else { tier = "Fraco pro que se propõe"; tierClass = "bad"; }

    return { score, tier, tierClass, profile, reasons };
  }

  // time de captura: não julga por cobertura/bulk/velocidade de batalha competitiva — olha
  // se o time tem as FERRAMENTAS certas pra pegar Pokémon selvagem (chip damage + status).
  function aiVerdictCapture(a, team, profile) {
    const n = team.members.length;
    const reasons = { pos: [], neg: [] };
    let score = 0;
    const moveNames = teamMoveNames(team);

    const hasChip = CAPTURE_CHIP_MOVES.some(x => moveNames.has(x));
    if (hasChip) { score += 3; reasons.pos.push("tem Investida Falsa (ou golpe parecido) pra baixar o HP sem nocautear"); }
    else reasons.neg.push("nenhum membro conhece Investida Falsa (False Swipe) — sem isso é fácil nocautear o alvo sem querer");

    const hasStatus = CAPTURE_STATUS_MOVES.some(x => moveNames.has(x));
    if (hasStatus) { score += 3; reasons.pos.push("tem golpe de paralisia/sono pra travar o alvo e facilitar a captura"); }
    else reasons.neg.push("nenhum golpe de paralisia/sono no time (ex.: Paralisar, Hipnose, Esporo) — mais difícil garantir a captura");

    // bulk ajuda a sobreviver enquanto tenta paralisar/baixar o HP do selvagem
    if (a.bulk >= 190) { score += 2; reasons.pos.push("bulk alto — aguenta bem enquanto paralisa/baixa o HP do alvo"); }
    else if (a.bulk >= 150) { score += 1; reasons.neg.push("bulk mediano — cuidado pra não ser nocauteado antes de paralisar o alvo"); }
    else reasons.neg.push("bulk baixo — arriscado contra Pokémon selvagens mais fortes");

    const incompleteRatio = n ? a.incomplete.length / n : 1;
    if (incompleteRatio === 0) { score += 2; reasons.pos.push("todos os membros já têm 4 golpes definidos"); }
    else if (incompleteRatio <= 0.34) { score += 1; reasons.neg.push(`${a.incomplete.length} membro(s) ainda sem moveset completo`); }
    else reasons.neg.push(`${a.incomplete.length} de ${n} membros ainda sem 4 golpes — pode faltar Investida Falsa/paralisia na hora H`);

    if (n < 2) reasons.neg.push("time pequeno — vale ter pelo menos 1 pra paralisar/adormecer + 1 com Investida Falsa");

    score = Math.max(0, Math.min(10, Math.round(score)));
    let tier, tierClass;
    if (score >= 8) { tier = "Ótimo time de captura 👍"; tierClass = "good"; }
    else if (score >= 6) { tier = "Dá pro serviço, com espaço pra ajuste"; tierClass = "ok"; }
    else if (score >= 4) { tier = "Mediano — falta ferramenta de captura"; tierClass = "warn"; }
    else { tier = "Fraco pra capturar — falta paralisia/sono e/ou Investida Falsa"; tierClass = "bad"; }

    return { score, tier, tierClass, profile, reasons };
  }

  // guarda o último parecer pedido por time (só roda quando o treinador clica em
  // "Enviar time para a IA" — não fica recalculando sozinho a cada tecla/EV/golpe).
  const aiRuns = {}; // teamId -> { snapshot, result }

  function aiSnapshot(a, team) {
    return JSON.stringify({
      meta: team.meta, n: team.members.length,
      gaps: a.gaps, sharedWeak: a.sharedWeak.map(s => [s.type, s.weak]),
      offense: a.offense, bulk: a.bulk, speed: a.speed, incomplete: a.incomplete.length,
    });
  }

  function runAi(team, a) {
    aiRuns[team.id] = { snapshot: aiSnapshot(a, team), result: aiVerdict(a, team) };
    renderAnalysis();
    toast("A IA analisou o time!");
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
    ensureMegaForms(m);
    const form = activeForm(m);

    const abilityList = abilitiesOf(m);
    const abilityOpts = abilityList.map(a =>
      `<option value="${a.name}"${a.name === b.ability ? " selected" : ""}>${cap((window.abilityLabel ? window.abilityLabel(a.name) : a.name))}${a.hidden ? " (oculta)" : ""}</option>`).join("");
    const natureOpts = window.NATURES.map(nat =>
      `<option value="${nat.id}"${nat.id === b.nature ? " selected" : ""}>${window.natureLabel(nat.id)}</option>`).join("");
    const megaOpts = (m.megaForms || []).length ? `
      <option value="">Nenhuma (forma normal)</option>
      ${m.megaForms.map(mf => `<option value="${mf.name}"${b.mega === mf.name ? " selected" : ""}>${mf.label}</option>`).join("")}` : "";

    const moveSlots = [0, 1, 2, 3].map(i => movePickerHTML(m, i)).join("");

    const evRow = (k) => `
      <div class="ev-row">
        <span class="ev-label">${window.STAT_PT[k]}</span>
        <span class="ev-final" title="status final">${fs[k]}</span>
        <div class="ev-slider-wrap">
          <input class="ev-slider" type="range" min="0" max="${EV_MAX}" step="4" value="${b.evs[k]}" data-ev="${k}" title="EV (0–252)">
          <span class="ev-slider-val" data-ev-val="${k}">${b.evs[k]}</span>
        </div>
        <div class="iv-slider-wrap">
          <input class="iv-slider" type="range" min="0" max="${IV_MAX}" value="${b.ivs[k]}" data-iv="${k}" title="IV (0–31)">
          <span class="iv-slider-val" data-iv-val="${k}">${b.ivs[k]}</span>
        </div>
      </div>`;

    box.innerHTML = `
      <div class="editor-head">
        <img src="${window.API.SPRITE(form.id)}" alt="${m.name}">
        <div>
          <h3>${cap(m.name)}${b.mega ? ` <span class="mega-tag">💎 mega</span>` : ""} <span class="muted">#${String(form.id).padStart(4, "0")}</span></h3>
          <div class="card-types">${form.types.map(badge).join("")}</div>
        </div>
        <button class="btn-ghost" id="editor-close">Fechar ✕</button>
      </div>

      <div class="editor-grid">
        <label class="fld fld-ability">Habilidade
          <select id="f-ability">${abilityOpts}</select>
          <p class="ability-effect small" id="f-ability-effect" data-for="${b.ability}">Carregando efeito…</p>
        </label>
        <label class="fld">Nature
          <select id="f-nature">${natureOpts}</select>
        </label>
        <label class="fld">Nível
          <input id="f-level" type="number" min="1" max="100" value="${b.level}">
        </label>
        <div class="fld">Item (opcional)
          ${itemPickerHTML(m)}
        </div>
        ${megaOpts ? `<label class="fld fld-mega">💎 Mega evolução
          <select id="f-mega">${megaOpts}</select>
          ${megaStoneHintHTML(m)}
        </label>` : ""}
      </div>

      <h4>Movimentos <span class="muted">(escolha até 4 — busque por nome, filtre por método)</span>
        <button type="button" class="btn-ghost btn-auto-moves" id="auto-fill-moves" title="Preenche os slots vazios com bons golpes automaticamente">🎲 Preencher automaticamente</button>
      </h4>
      <div class="moves-editor">${moveSlots}</div>

      <h4>Status <span class="muted">— EVs (0–252, total ${evTotal}/${EV_TOTAL}) e IVs (0–31)</span></h4>
      <div class="ev-head"><span></span><span>Final</span><span>EV</span><span>IV</span></div>
      <div class="ev-grid">${window.STAT_KEYS.map(evRow).join("")}</div>
      ${evTotal > EV_TOTAL ? `<p class="error small">Total de EVs acima de ${EV_TOTAL}. Reduza para um build válido.</p>` : ""}
    `;
    wireEditor(m);
    fillEditorAbilityEffect(m);
  }

  // linha com o sprite + nome da mega pedra que a mega selecionada exige (segurada no item).
  function megaStoneHintHTML(m) {
    const stone = m.build.mega && stoneForMega(m.build.mega);
    if (!stone) return `<span class="mega-stone-hint muted small">Escolha uma mega — a pedra correspondente é segurada automaticamente.</span>`;
    const it = window.ITEM_BY_ID[stone];
    return `<span class="mega-stone-hint">
      <img src="${window.itemSprite(stone)}" alt="" onerror="this.style.display='none'">
      <span>Segurando <b>${it ? escapeHtml(it.pt.replace(/ \(Mega Pedra\)$/, "")) : stone}</b></span>
    </span>`;
  }

  // preenche (async) o efeito da habilidade selecionada no editor (dicionário curado + API).
  async function fillEditorAbilityEffect(m) {
    const el = $("#f-ability-effect");
    if (!el) return;
    const want = m.build.ability;
    if (!want) { el.textContent = "Sem habilidade."; el.classList.add("muted"); return; }
    try {
      const info = await window.abilityInfo(want);
      const cur = $("#f-ability-effect");
      if (!cur || cur.dataset.for !== want) return; // trocou de habilidade/membro
      cur.textContent = info.effect || "Sem descrição disponível.";
      cur.classList.toggle("muted", !info.effect);
    } catch {}
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

  // nomes de golpe na API vêm com hífen ("false-swipe"); o treinador digita com espaço
  // ("false swipe") — normaliza os dois pro mesmo formato antes de comparar.
  const normSearch = (s) => s.trim().toLowerCase().replace(/[\s-]+/g, " ");

  function filteredMoves(m) {
    const q = normSearch(picker.q);
    return m.moveList.filter(mv => {
      if (q && !normSearch(mv.name).includes(q)) return false;
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
    // delegação: o wrap sobrevive a cada re-render (busca/filtro), as linhas de dentro não —
    // por isso o clique é ouvido no wrap, não em cada linha (senão some ao filtrar/buscar).
    wrap.onclick = (e) => {
      const row = e.target.closest("[data-pick-move]");
      if (!row) return;
      const [slot, name] = row.dataset.pickMove.split(/:(.+)/);
      pickMove(m, Number(slot), name);
    };
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
    save(); render(); // render() atualiza a contagem de golpes no card do slot também
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

  // preenche os slots de golpe vazios com boas opções automaticamente: prioriza golpes de
  // dano do próprio tipo (STAB), depois maior poder; usa o que já estiver enriquecido em
  // memória (ensureEnrich já busca em segundo plano ao abrir o editor).
  function autoFillMoves(m) {
    const enrich = moveEnrich[m.name] || {};
    const known = Object.keys(enrich).length;
    if (!known) { toast("Carregando dados dos golpes… tente de novo em um instante."); return; }
    const b = m.build;
    const already = new Set(b.moves.filter(Boolean).map(x => x.name));
    const emptySlots = [0, 1, 2, 3].filter(i => !b.moves[i]);
    if (!emptySlots.length) { toast("Todos os slots já estão preenchidos."); return; }

    const candidates = m.moveList
      .map(mv => ({ name: mv.name, d: enrich[mv.name] }))
      .filter(c => c.d && !already.has(c.name));

    const score = (c) => {
      const stab = m.types.includes(c.d.type) ? 1 : 0;
      const status = c.d.category === "status" ? 0 : 1;
      return status * 200 + stab * 100 + (c.d.power || 0);
    };
    candidates.sort((a, c) => score(c) - score(a));

    // no máximo 1 golpe de status (útil, mas não o time todo)
    const picked = [];
    let statusUsed = 0;
    for (const c of candidates) {
      if (picked.length >= emptySlots.length) break;
      if (c.d.category === "status") {
        if (statusUsed >= 1) continue;
        statusUsed++;
      }
      picked.push(c);
    }

    emptySlots.forEach((slot, i) => {
      const c = picked[i];
      if (c) b.moves[slot] = { name: c.name, type: c.d.type, category: c.d.category };
    });
    save(); render(); // render() atualiza também a contagem de golpes no card do slot
    toast(picked.length ? `${picked.length} golpe(s) preenchido(s) automaticamente.` : "Nenhum golpe novo disponível.");
  }

  // ---- seletor de item (held item) ----
  function itemPickerHTML(m) {
    const it = itemOf(m);
    const btn = it
      ? `<img class="ip-icon" src="${window.itemSprite(it.id)}" alt="" onerror="this.style.display='none'">
         <span class="ip-name">${escapeHtml(it.pt)}</span>`
      : (m.build.item
          ? `<span class="ip-name">${escapeHtml(m.build.item)}</span>` // texto livre antigo (migração)
          : `<span class="ip-name ip-empty">— sem item —</span>`);
    return `
      <div class="item-picker${openItem ? " open" : ""}">
        <button type="button" class="item-picker-btn" id="item-toggle">
          ${btn}<span class="chev">${openItem ? "▲" : "▼"}</span>
        </button>
        ${openItem ? itemPanelHTML() : ""}
      </div>`;
  }

  function itemPanelHTML() {
    const cats = (window.ITEM_CATS || []).map(c =>
      `<button type="button" class="mvp-chip${itemPick.cat === c.id ? " active" : ""}" data-item-cat="${c.id}">${c.label}</button>`).join("");
    return `
      <div class="item-picker-panel">
        <input class="mvp-search" type="search" placeholder="Buscar item…" id="item-search" value="${escapeHtml(itemPick.q)}" autocomplete="off">
        <div class="mvp-filters">${cats}</div>
        <button type="button" class="mvp-clear" id="item-clear">✕ deixar sem item</button>
        <div class="mvp-list" id="item-list"></div>
      </div>`;
  }

  function filteredItems(m) {
    const q = normSearch(itemPick.q);
    // só mostra as mega pedras que ESTE Pokémon pode usar (pelas megaForms detectadas)
    const myMegas = new Set((m && m.megaForms || []).map(mf => mf.name));
    return (window.ITEMS || []).filter(it => {
      if (it.cat === "mega" && !myMegas.has(it.megaFor)) return false;
      if (itemPick.cat && it.cat !== itemPick.cat) return false;
      if (q && !normSearch(it.pt).includes(q) && !normSearch(it.id).includes(q)) return false;
      return true;
    });
  }

  function renderItemList(m) {
    const wrap = document.getElementById("item-list");
    if (!wrap) return;
    const rows = filteredItems(m);
    wrap.innerHTML = rows.length
      ? rows.map(it => `
        <div class="ip-row${m.build.item === it.id ? " selected" : ""}" data-pick-item="${it.id}">
          <img class="ip-icon" src="${window.itemSprite(it.id)}" alt="" onerror="this.style.visibility='hidden'">
          <div class="ip-row-txt">
            <span class="ip-row-name">${escapeHtml(it.pt)}</span>
            <span class="ip-row-eff">${escapeHtml(it.effect)}</span>
          </div>
        </div>`).join("")
      : `<p class="mvp-empty">Nenhum item encontrado.</p>`;
    wrap.onclick = (e) => {
      const row = e.target.closest("[data-pick-item]");
      if (!row) return;
      const picked = row.dataset.pickItem;
      m.build.item = picked;
      openItem = false;
      // se o item é uma mega pedra, ativa a mega correspondente (quando o Pokémon a tem)
      const megaVariety = window.STONE_TO_MEGA && window.STONE_TO_MEGA[picked];
      if (megaVariety && (m.megaForms || []).some(mf => mf.name === megaVariety)) {
        selectMega(m, megaVariety); // já salva/re-renderiza e mantém a pedra
        return;
      }
      save(); renderEditor(); render(); renderAnalysis();
    };
  }

  function wireItemPicker(m) {
    const box = $("#team-editor");
    const toggle = box.querySelector("#item-toggle");
    if (toggle) toggle.onclick = () => {
      openItem = !openItem;
      itemPick = { q: "", cat: "" };
      renderEditor();
    };
    if (!openItem) return;
    renderItemList(m);
    const search = box.querySelector("#item-search");
    if (search) search.oninput = (e) => { itemPick.q = e.target.value; renderItemList(m); };
    box.querySelectorAll("[data-item-cat]").forEach(chip => {
      chip.onclick = () => {
        itemPick.cat = chip.dataset.itemCat;
        box.querySelectorAll("[data-item-cat]").forEach(c => c.classList.toggle("active", c.dataset.itemCat === itemPick.cat));
        renderItemList(m);
      };
    });
    const clear = box.querySelector("#item-clear");
    if (clear) clear.onclick = () => { m.build.item = ""; openItem = false; save(); renderEditor(); render(); renderAnalysis(); };
  }

  function wireEditor(m) {
    const b = m.build;
    const box = $("#team-editor");
    box.querySelector("#editor-close").onclick = () => { editing = -1; openSlot = -1; openItem = false; render(); };
    wireItemPicker(m);
    const autoBtn = box.querySelector("#auto-fill-moves");
    if (autoBtn) autoBtn.onclick = () => autoFillMoves(m);
    box.querySelector("#f-ability").onchange = (e) => {
      b.ability = e.target.value; save();
      const eff = $("#f-ability-effect");
      if (eff) { eff.dataset.for = b.ability; eff.textContent = "Carregando efeito…"; eff.classList.remove("muted"); }
      fillEditorAbilityEffect(m);
    };
    const megaSel = box.querySelector("#f-mega");
    if (megaSel) megaSel.onchange = (e) => selectMega(m, e.target.value || null);
    box.querySelector("#f-nature").onchange = (e) => { b.nature = e.target.value; save(); renderEditor(); renderAnalysis(); };
    box.querySelector("#f-level").onchange = (e) => {
      b.level = Math.max(1, Math.min(100, Number(e.target.value) || 100));
      save(); renderEditor(); renderAnalysis();
    };
    // sliders de EV/IV: atualiza ao vivo enquanto arrasta (sem re-renderizar, pra não
    // "pular" o thumb), e só re-renderiza tudo (status final, análise) ao soltar.
    box.querySelectorAll("[data-ev]").forEach(inp => {
      inp.oninput = (e) => {
        let v = Math.max(0, Math.min(EV_MAX, Number(e.target.value) || 0));
        // respeita o teto total de 510
        const others = window.STAT_KEYS.reduce((a, k) => a + (k === inp.dataset.ev ? 0 : b.evs[k]), 0);
        v = Math.min(v, EV_TOTAL - others);
        e.target.value = v;
        b.evs[inp.dataset.ev] = v;
        const valSpan = box.querySelector(`[data-ev-val="${inp.dataset.ev}"]`);
        if (valSpan) valSpan.textContent = v;
        save();
      };
      inp.onchange = () => { renderEditor(); renderAnalysis(); };
    });
    box.querySelectorAll("[data-iv]").forEach(inp => {
      inp.oninput = (e) => {
        const v = Math.max(0, Math.min(IV_MAX, Number(e.target.value) || 0));
        b.ivs[inp.dataset.iv] = v;
        const valSpan = box.querySelector(`[data-iv-val="${inp.dataset.iv}"]`);
        if (valSpan) valSpan.textContent = v;
        save();
      };
      inp.onchange = () => { renderEditor(); renderAnalysis(); };
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
        b.moves[i] = null; openSlot = -1; save(); render();
      };
      // clique em cada golpe é tratado por delegação dentro de renderMoveList (o wrap
      // sobrevive a buscas/filtros, as linhas não).
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

    const run = aiRuns[team.id];
    const snap = aiSnapshot(a, team);
    const stale = !!run && run.snapshot !== snap;
    const aiCardHtml = !run
      ? `<section class="acard span2 ai-card ai-pending">
          <h4>🤖 Análise do treinador <span class="muted">(IA local, gratuita e offline — não é um LLM)</span></h4>
          <p class="muted">Descreva a meta do time acima e clique em <b>"📤 Enviar time para a IA"</b>
            pra receber uma nota e um parecer sobre se o time está bom pro que ele se propõe.</p>
        </section>`
      : `<section class="acard span2 ai-card ai-${run.result.tierClass}${stale ? " ai-stale" : ""}">
          <h4>🤖 Análise do treinador <span class="muted">(IA local, gratuita e offline — não é um LLM)</span></h4>
          ${stale ? `<p class="ai-stale-note">⚠️ O time mudou desde essa análise — envie de novo pra atualizar o parecer.</p>` : ""}
          <div class="ai-score-row">
            <span class="ai-score">${run.result.score}<small>/10</small></span>
            <div>
              <p class="ai-tier">${run.result.tier}</p>
              <p class="muted small">Meta avaliada: <b>${run.result.profile.label}</b></p>
            </div>
          </div>
          <p class="muted small">${run.result.profile.note}</p>
          ${run.result.reasons.pos.length ? `<p class="ai-sub">Pontos fortes</p><ul class="suggestions ai-pos">
            ${run.result.reasons.pos.map(r => `<li>${r}</li>`).join("")}</ul>` : ""}
          ${run.result.reasons.neg.length ? `<p class="ai-sub">Pontos a melhorar</p><ul class="suggestions ai-neg">
            ${run.result.reasons.neg.map(r => `<li>${r}</li>`).join("")}</ul>` : ""}
          <button type="button" class="btn-ghost ai-resend-btn" id="ai-resend">📤 Enviar de novo</button>
        </section>`;

    box.innerHTML = `
      <div class="analysis-grid">
        ${aiCardHtml}

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
            ${(a.itemNotes || []).map(n => `<li class="${n.level === "bad" ? "error" : "warn-note"}">${n.level === "bad" ? "⛔" : "⚠️"} ${escapeHtml(n.text)}</li>`).join("")}
            ${!(a.itemNotes || []).length ? `<li class="good">Itens coerentes com os movesets.</li>` : ""}
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

    const resend = box.querySelector("#ai-resend");
    if (resend) resend.onclick = () => runAi(team, a);
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
        openSlot = -1; openItem = false;
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

  return {
    init, add, remove, clear: clearMembers, analyze,
    // API pública para as ferramentas (tools.js): exportar/importar/compartilhar/calc de dano
    getActiveTeam: activeTeam,
    getState: () => state,
    finalStats, adjustedStats, activeForm, itemOf,
    importSets,
    SHOWDOWN_STAT,
  };
})();
