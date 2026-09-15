/* tools.js — ferramentas do teambuilder que rodam 100% no cliente:
 *   1) Exportar/Importar time no formato do Pokémon Showdown (padrão da comunidade).
 *   2) Compartilhar o time por URL (o time vai codificado no #hash — sem backend).
 *   3) Calculadora de dano (fórmula oficial, usa os status finais já ajustados por item).
 *
 * Usa a API pública exposta por Team (getActiveTeam, adjustedStats, activeForm, importSets…).
 */

window.PokeTools = (function () {
  const $ = (s) => document.querySelector(s);
  const cap = (s) => String(s).split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  const T = window.Team;

  function toast(msg) {
    let el = $("#toast");
    if (!el) { el = document.createElement("div"); el.id = "toast"; document.body.appendChild(el); }
    el.textContent = msg; el.classList.add("show");
    clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove("show"), 1800);
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast("Copiado!"); return true; }
    catch {
      // fallback pra navegadores sem clipboard API (ou http)
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); toast("Copiado!"); } catch { toast("Copie manualmente."); }
      ta.remove(); return false;
    }
  }

  // ================= EXPORTAR (build -> texto Showdown) =================
  const SHORT = { hp: "HP", attack: "Atk", defense: "Def", "special-attack": "SpA", "special-defense": "SpD", speed: "Spe" };

  function memberToText(m) {
    const b = m.build;
    const lines = [];
    const itemLabel = b.item ? (window.ITEM_BY_ID[b.item] ? englishItem(b.item) : b.item) : "";
    lines.push(cap(m.name) + (itemLabel ? ` @ ${itemLabel}` : ""));
    if (b.ability) lines.push(`Ability: ${cap(b.ability)}`);
    if (b.level && b.level !== 100) lines.push(`Level: ${b.level}`);
    const evs = window.STAT_KEYS.filter(k => b.evs[k] > 0).map(k => `${b.evs[k]} ${SHORT[k]}`);
    if (evs.length) lines.push(`EVs: ${evs.join(" / ")}`);
    lines.push(`${cap(b.nature)} Nature`);
    const ivs = window.STAT_KEYS.filter(k => b.ivs[k] < 31).map(k => `${b.ivs[k]} ${SHORT[k]}`);
    if (ivs.length) lines.push(`IVs: ${ivs.join(" / ")}`);
    (b.moves || []).filter(Boolean).forEach(mv => lines.push(`- ${cap(mv.name)}`));
    return lines.join("\n");
  }

  // O nome EN oficial do item (do catálogo, tirando o "(...)"): "Choice Scarf".
  function englishItem(id) {
    const it = window.ITEM_BY_ID[id];
    if (!it) return cap(id);
    const m = it.pt.match(/\(([^)]+)\)/);
    return m ? m[1] : it.pt;
  }

  function teamToText(team) {
    return team.members.map(memberToText).join("\n\n");
  }

  // ================= IMPORTAR (texto Showdown -> sets) =================
  function parseShowdown(text) {
    const blocks = text.trim().split(/\n\s*\n/).filter(b => b.trim());
    const sets = [];
    for (const block of blocks) {
      const lines = block.split("\n").map(l => l.trim()).filter(Boolean);
      if (!lines.length) continue;
      const set = { evs: {}, ivs: {}, moves: [] };

      // 1ª linha: "Nickname (Species) @ Item"  |  "Species @ Item"  |  "Species"
      let head = lines.shift();
      let item = "";
      const at = head.split(" @ ");
      if (at.length > 1) { item = at[1].trim(); head = at[0].trim(); }
      const paren = head.match(/\(([^)]+)\)\s*$/);
      let species = paren ? paren[1].trim() : head.trim();
      // remove marcador de gênero " (M)"/" (F)" que sobra em alguns exports
      species = species.replace(/\s*\((?:M|F)\)\s*$/i, "").trim();
      set.species = species; set.item = item;

      for (const line of lines) {
        let mm;
        if ((mm = line.match(/^Ability:\s*(.+)$/i))) set.ability = mm[1].trim();
        else if ((mm = line.match(/^Level:\s*(\d+)$/i))) set.level = Number(mm[1]);
        else if ((mm = line.match(/^(.+?)\s+Nature$/i))) set.nature = mm[1].trim();
        else if ((mm = line.match(/^EVs:\s*(.+)$/i))) set.evs = parseStatLine(mm[1]);
        else if ((mm = line.match(/^IVs:\s*(.+)$/i))) set.ivs = parseStatLine(mm[1]);
        else if (/^[-–]\s*/.test(line)) set.moves.push(line.replace(/^[-–]\s*/, "").replace(/\s*\[.*\]$/, "").split("/")[0].trim());
        // ignora linhas não reconhecidas (Shiny, Tera Type, Happiness…)
      }
      if (set.species) sets.push(set);
    }
    return sets;
  }

  const LABEL_TO_KEY = { hp: "hp", atk: "attack", def: "defense", spa: "special-attack", spd: "special-defense", spe: "speed" };
  function parseStatLine(s) {
    const out = {};
    s.split("/").forEach(part => {
      const m = part.trim().match(/^(\d+)\s+([A-Za-z]+)$/);
      if (m) { const key = LABEL_TO_KEY[m[2].toLowerCase()]; if (key) out[key] = Number(m[1]); }
    });
    return out;
  }

  // ================= COMPARTILHAR POR URL =================
  // codifica o texto Showdown em base64 (unicode-safe) no #hash da URL.
  function encode(text) { return btoa(unescape(encodeURIComponent(text))); }
  function decode(b64) { return decodeURIComponent(escape(atob(b64))); }

  function shareURL(team) {
    const base = location.origin + location.pathname;
    return base + "#team=" + encode(teamToText(team));
  }

  // ao carregar, se houver #team=... na URL, oferece importar.
  function checkHashImport() {
    const m = location.hash.match(/team=([^&]+)/);
    if (!m) return;
    try {
      const text = decode(m[1]);
      const sets = parseShowdown(text);
      if (sets.length && confirm(`Este link contém um time com ${sets.length} Pokémon. Importar como um novo time?`)) {
        T.importSets(sets, "Time compartilhado");
      }
    } catch {}
    // limpa o hash pra não reimportar em reloads
    history.replaceState(null, "", location.pathname + location.search);
  }

  // ================= MODAL genérico de import/export =================
  function openExport() {
    const team = T.getActiveTeam();
    if (!team.members.length) return toast("Adicione Pokémon antes de exportar.");
    const text = teamToText(team);
    const box = $("#io-body");
    box.innerHTML = `
      <h2>📤 Exportar "${escapeHtml(team.name)}"</h2>
      <p class="muted small">Formato Pokémon Showdown — cole em qualquer simulador ou guarde pra depois.</p>
      <textarea class="io-textarea" id="io-text" readonly rows="12">${escapeHtml(text)}</textarea>
      <div class="io-actions">
        <button class="btn-primary" id="io-copy">📋 Copiar</button>
        <button class="btn-primary" id="io-share">🔗 Copiar link de compartilhamento</button>
      </div>`;
    $("#io-modal").hidden = false;
    $("#io-copy").onclick = () => copy(text);
    $("#io-share").onclick = () => copy(shareURL(team));
    $("#io-text").focus(); $("#io-text").select();
  }

  function openImport() {
    const box = $("#io-body");
    box.innerHTML = `
      <h2>📥 Importar time</h2>
      <p class="muted small">Cole um time no formato Pokémon Showdown (um bloco por Pokémon, separados por linha em branco). Vira um time novo.</p>
      <textarea class="io-textarea" id="io-text" rows="12" placeholder="Charizard @ Choice Specs&#10;Ability: Blaze&#10;EVs: 252 SpA / 4 SpD / 252 Spe&#10;Timid Nature&#10;- Flamethrower&#10;- Air Slash&#10;- Solar Beam&#10;- Focus Blast"></textarea>
      <div class="io-actions">
        <button class="btn-primary" id="io-do-import">📥 Importar</button>
      </div>`;
    $("#io-modal").hidden = false;
    $("#io-do-import").onclick = () => {
      const text = $("#io-text").value;
      const sets = parseShowdown(text);
      if (!sets.length) return toast("Não reconheci nenhum Pokémon nesse texto.");
      $("#io-modal").hidden = true;
      T.importSets(sets, "Importado");
      document.querySelector('.tab[data-view="team"]').click();
    };
    $("#io-text").focus();
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // ================= CALCULADORA DE DANO =================
  let dmg = { atkIdx: 0, moveIdx: 0, defIdx: 0 };

  function openDamage() {
    const team = T.getActiveTeam();
    if (team.members.length < 1) return toast("Adicione Pokémon ao time primeiro.");
    dmg = { atkIdx: 0, moveIdx: 0, defIdx: team.members.length > 1 ? 1 : 0 };
    $("#dmg-modal").hidden = false;
    renderDamage();
  }

  function damagingMoves(m) {
    return (m.build.moves || []).filter(x => x && x.category && x.category !== "status");
  }

  function renderDamage() {
    const team = T.getActiveTeam();
    const box = $("#dmg-body");
    const opt = (m, i, sel) => `<option value="${i}"${i === sel ? " selected" : ""}>${cap(m.name)}</option>`;
    const atk = team.members[dmg.atkIdx] || team.members[0];
    const moves = damagingMoves(atk);
    if (dmg.moveIdx >= moves.length) dmg.moveIdx = 0;

    const moveOpts = moves.length
      ? moves.map((mv, i) => `<option value="${i}"${i === dmg.moveIdx ? " selected" : ""}>${cap(mv.name)}${mv.type ? " · " + window.TYPE_PT[mv.type] : ""}</option>`).join("")
      : `<option value="">(sem golpe de dano escolhido)</option>`;

    box.innerHTML = `
      <h2>🧮 Calculadora de dano</h2>
      <p class="muted small">Usa os status finais já ajustados pelos itens (Choice Band, Assault Vest, Eviolite…) e a fórmula oficial. Escolha atacante, golpe e alvo — todos do time ativo.</p>
      <div class="dmg-grid">
        <label class="fld">Atacante<select id="dmg-atk">${team.members.map((m, i) => opt(m, i, dmg.atkIdx)).join("")}</select></label>
        <label class="fld">Golpe<select id="dmg-move">${moveOpts}</select></label>
        <label class="fld">Alvo<select id="dmg-def">${team.members.map((m, i) => opt(m, i, dmg.defIdx)).join("")}</select></label>
      </div>
      <div id="dmg-result" class="dmg-result"><p class="muted">Calculando…</p></div>`;
    $("#dmg-atk").onchange = (e) => { dmg.atkIdx = Number(e.target.value); dmg.moveIdx = 0; renderDamage(); };
    $("#dmg-move").onchange = (e) => { dmg.moveIdx = Number(e.target.value) || 0; compute(); };
    $("#dmg-def").onchange = (e) => { dmg.defIdx = Number(e.target.value); compute(); };
    compute();
  }

  async function compute() {
    const team = T.getActiveTeam();
    const out = $("#dmg-result");
    const atk = team.members[dmg.atkIdx];
    const def = team.members[dmg.defIdx];
    const moves = damagingMoves(atk);
    const mv = moves[dmg.moveIdx];
    if (!atk || !def || !mv) {
      out.innerHTML = `<p class="muted">Escolha um golpe de dano no atacante (aba Time → editar membro) para calcular.</p>`;
      return;
    }
    let detail;
    try { detail = await window.API.getMove(mv.name); } catch { out.innerHTML = `<p class="error">Não consegui carregar o golpe.</p>`; return; }
    const power = detail.power;
    if (!power) { out.innerHTML = `<p class="muted">${cap(mv.name)} não tem poder fixo (golpe variável) — não dá pra calcular direto.</p>`; return; }

    const atkStats = T.adjustedStats(atk);
    const defStats = T.adjustedStats(def);
    const atkForm = T.activeForm(atk), defForm = T.activeForm(def);
    const physical = detail.category === "physical";
    const A = physical ? atkStats.attack : atkStats["special-attack"];
    const D = physical ? defStats.defense : defStats["special-defense"];
    const level = atk.build.level || 100;

    // dano-base (fórmula Gen 3+)
    const baseDmg = Math.floor(Math.floor(Math.floor((2 * level / 5 + 2) * power * A / D) / 50) + 2);

    // modificadores
    const stab = atkForm.types.includes(detail.type) ? 1.5 : 1;
    const eff = window.effectiveness(detail.type, defForm.types);
    const it = T.itemOf(atk);
    let itemMult = 1;
    if (it) {
      if (it.dmg) itemMult *= it.dmg;                 // Life Orb ×1.3
      if (it.se && eff > 1) itemMult *= it.se;         // Expert Belt ×1.2 se super-efetivo
      if (it.phys && physical) itemMult *= it.phys;    // Muscle Band ×1.1
      if (it.spec && !physical) itemMult *= it.spec;   // Wise Glasses ×1.1
    }

    const factor = stab * eff * itemMult;
    const minDmg = Math.max(eff === 0 ? 0 : 1, Math.floor(baseDmg * factor * 0.85));
    const maxDmg = Math.max(eff === 0 ? 0 : 1, Math.floor(baseDmg * factor * 1.00));
    const hp = defStats.hp;
    const minPct = (minDmg / hp) * 100, maxPct = (maxDmg / hp) * 100;

    let ko;
    if (eff === 0) ko = { txt: "Imune — o alvo não sofre dano.", cls: "immune" };
    else if (minDmg >= hp) ko = { txt: "Nocaute garantido (OHKO) 💥", cls: "ohko" };
    else if (maxDmg >= hp) ko = { txt: `Pode nocautear (chance de OHKO)`, cls: "maybe" };
    else {
      const hits = Math.ceil(hp / maxDmg);
      ko = { txt: `Não nocauteia de primeira — ~${hits} golpes pra derrubar (melhor caso)`, cls: "safe" };
    }

    const effLabel = eff === 0 ? "×0 (imune)" : `×${eff}`;
    out.innerHTML = `
      <div class="dmg-head">
        <img src="${window.API.SPRITE(atkForm.id)}" alt="" onerror="this.style.visibility='hidden'">
        <span class="dmg-arrow">
          <span class="badge" style="--c:${window.TYPE_COLOR[detail.type]}">${window.TYPE_PT[detail.type]}</span>
          ${cap(mv.name)} <b>→</b>
        </span>
        <img src="${window.API.SPRITE(defForm.id)}" alt="" onerror="this.style.visibility='hidden'">
      </div>
      <div class="dmg-nums">
        <div class="dmg-big">${minDmg}–${maxDmg}<small> de dano</small></div>
        <div class="dmg-pct">${minPct.toFixed(1)}%–${maxPct.toFixed(1)}% do HP (${hp})</div>
      </div>
      <div class="dmg-bar"><i style="width:${Math.min(100, maxPct)}%"></i><b style="width:${Math.min(100, minPct)}%"></b></div>
      <p class="dmg-ko dmg-${ko.cls}">${ko.txt}</p>
      <p class="muted small">Poder ${power} · ${physical ? "Físico" : "Especial"} · STAB ${stab > 1 ? "sim" : "não"} · Efetividade ${effLabel}${it && (it.dmg || it.se || it.phys || it.spec) ? " · item aplicado" : ""}.
        Estimativa sem considerar habilidades, clima, campo, telas e boosts.</p>`;
  }

  // ================= INIT =================
  function init() {
    const wire = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };
    wire("#tool-export", openExport);
    wire("#tool-import", openImport);
    wire("#tool-share", () => {
      const team = T.getActiveTeam();
      if (!team.members.length) return toast("Adicione Pokémon antes de compartilhar.");
      copy(shareURL(team));
    });
    wire("#tool-damage", openDamage);

    // fechar modais
    ["#io-modal", "#dmg-modal"].forEach(sel => {
      const modal = $(sel);
      if (!modal) return;
      modal.addEventListener("click", (e) => { if (e.target === modal) modal.hidden = true; });
      const close = modal.querySelector(".modal-close");
      if (close) close.onclick = () => modal.hidden = true;
    });

    checkHashImport();
  }

  document.addEventListener("DOMContentLoaded", init);
  return { openExport, openImport, openDamage, parseShowdown, teamToText };
})();
