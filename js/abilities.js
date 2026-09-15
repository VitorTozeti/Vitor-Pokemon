/* abilities.js — informações de HABILIDADES (o que cada uma faz), em português.
 *
 * A PokéAPI tem o efeito de cada habilidade, mas quase sempre só em inglês (o `effect_entries`
 * em pt-br é raro). Para a ficha e o editor mostrarem "o que a habilidade faz" em bom português
 * SEM depender de tradução externa, mantemos aqui um dicionário curado das habilidades mais
 * comuns/competitivas. Para qualquer habilidade fora do dicionário, o helper cai para a PokéAPI
 * (`API.getAbility`) e usa o texto em inglês como fallback, tudo cacheado.
 *
 *   window.ABILITY_PT[slug]  -> { pt, effect }         (curado, síncrono)
 *   window.abilityInfo(slug) -> { name, pt, effect, curated }  (async, com fallback à API)
 */

window.ABILITY_PT = {
  // --- clima / terreno ---
  drizzle:        { pt: "Chuvisco",           effect: "Ao entrar em campo, faz chover (fortalece golpes de Água, enfraquece Fogo)." },
  drought:        { pt: "Seca",               effect: "Ao entrar em campo, ativa o sol forte (fortalece Fogo, enfraquece Água)." },
  "sand-stream":  { pt: "Fluxo de Areia",     effect: "Ao entrar, levanta uma tempestade de areia que fere quem não é Pedra/Solo/Aço." },
  "snow-warning": { pt: "Aviso de Nevasca",   effect: "Ao entrar, inicia neve/granizo (protege ou fere conforme o tipo)." },
  "electric-surge": { pt: "Surto Elétrico",   effect: "Ao entrar, cria Terreno Elétrico (impede sono e reforça golpes Elétricos)." },
  "grassy-surge": { pt: "Surto de Grama",     effect: "Ao entrar, cria Terreno de Grama (cura aos poucos e reforça golpes de Grama)." },
  "psychic-surge":{ pt: "Surto Psíquico",     effect: "Ao entrar, cria Terreno Psíquico (bloqueia golpes de prioridade)." },
  "misty-surge":  { pt: "Surto Enevoado",     effect: "Ao entrar, cria Terreno Enevoado (impede status e reduz dano de Dragão)." },

  // --- boosts em clima ---
  "swift-swim":   { pt: "Nado Rápido",        effect: "Dobra a Velocidade sob chuva." },
  chlorophyll:    { pt: "Clorofila",          effect: "Dobra a Velocidade sob sol forte." },
  "sand-rush":    { pt: "Corrida na Areia",   effect: "Dobra a Velocidade na tempestade de areia (e imuniza dela)." },
  "slush-rush":   { pt: "Corrida na Neve",    effect: "Dobra a Velocidade na neve." },
  "solar-power":  { pt: "Poder Solar",        effect: "Sob sol, +50% Atq. Especial, mas perde HP a cada turno." },

  // --- ofensivas ---
  adaptability:   { pt: "Adaptabilidade",     effect: "O bônus de STAB (mesmo tipo) vira ×2 em vez de ×1,5." },
  "huge-power":   { pt: "Força Descomunal",   effect: "Dobra o Ataque físico." },
  "pure-power":   { pt: "Poder Puro",         effect: "Dobra o Ataque físico." },
  guts:           { pt: "Coragem",            effect: "+50% Ataque quando está com status (queima/paralisia/veneno)." },
  moxie:          { pt: "Vaidade",            effect: "+1 de Ataque a cada nocaute que causa." },
  "sheer-force":  { pt: "Força Pura",         effect: "+30% de dano em golpes com efeito extra, abrindo mão desse efeito." },
  technician:     { pt: "Técnico",            effect: "+50% de dano em golpes de poder base 60 ou menos." },
  "tough-claws":  { pt: "Garras Rígidas",     effect: "+30% de dano em golpes de contato." },
  "strong-jaw":   { pt: "Mandíbula Forte",    effect: "+50% de dano em golpes de mordida." },
  "mega-launcher":{ pt: "Megadisparo",        effect: "+50% de dano em golpes de pulso/aura." },
  reckless:       { pt: "Imprudente",         effect: "+20% de dano em golpes com recuo (ex.: Investida Dupla)." },
  "iron-fist":    { pt: "Punho de Ferro",     effect: "+20% de dano em golpes de soco." },
  aerilate:       { pt: "Aerização",          effect: "Golpes Normais viram Voador e ganham +20% de dano." },
  pixilate:       { pt: "Feerização",         effect: "Golpes Normais viram Fada e ganham +20% de dano." },
  refrigerate:    { pt: "Refrigeração",       effect: "Golpes Normais viram Gelo e ganham +20% de dano." },

  // --- defensivas ---
  intimidate:     { pt: "Intimidação",        effect: "Ao entrar, reduz em 1 o Ataque do oponente." },
  levitate:       { pt: "Levitação",          effect: "Imune a golpes de tipo Terra." },
  multiscale:     { pt: "Multiescama",        effect: "Recebe metade do dano quando está com HP cheio." },
  "thick-fat":    { pt: "Gordura Densa",      effect: "Recebe metade do dano de golpes de Fogo e Gelo." },
  "water-absorb": { pt: "Absorver Água",      effect: "Golpes de Água curam em vez de ferir." },
  "volt-absorb":  { pt: "Absorver Volts",     effect: "Golpes Elétricos curam em vez de ferir." },
  "flash-fire":   { pt: "Fogo Súbito",        effect: "Imune a Fogo; ser atingido por Fogo reforça os próprios golpes de Fogo." },
  "storm-drain":  { pt: "Ralo de Tempestade", effect: "Atrai golpes de Água, fica imune e ganha +1 Atq. Especial." },
  "lightning-rod":{ pt: "Para-raios",         effect: "Atrai golpes Elétricos, fica imune e ganha +1 Atq. Especial." },
  "sap-sipper":   { pt: "Sugador de Seiva",   effect: "Imune a Grama; ser atingido por Grama dá +1 Ataque." },
  "magic-guard":  { pt: "Guarda Mágica",      effect: "Só sofre dano de golpes diretos (imune a veneno, tempestade, recuo etc.)." },
  regenerator:    { pt: "Regenerador",        effect: "Recupera 1/3 do HP ao sair de campo (troca)." },
  "natural-cure": { pt: "Cura Natural",       effect: "Cura status ao sair de campo (troca)." },
  sturdy:         { pt: "Robustez",           effect: "Sobrevive com 1 HP a um golpe que nocautearia (se estava com HP cheio)." },
  disguise:       { pt: "Disfarce",           effect: "Bloqueia totalmente o primeiro golpe recebido (uma vez)." },
  "unaware":      { pt: "Inconsciência",      effect: "Ignora as mudanças de status (boosts) do oponente ao atacar/defender." },
  filter:         { pt: "Filtro",             effect: "Reduz o dano de golpes super-efetivos." },
  "solid-rock":   { pt: "Rocha Sólida",       effect: "Reduz o dano de golpes super-efetivos." },
  "prism-armor":  { pt: "Armadura Prismática",effect: "Reduz o dano de golpes super-efetivos." },
  fluffy:         { pt: "Fofura",             effect: "Metade do dano de contato, mas dobro de dano de Fogo." },
  "ice-scales":   { pt: "Escamas de Gelo",    effect: "Recebe metade do dano de golpes especiais." },

  // --- velocidade / prioridade ---
  "speed-boost":  { pt: "Impulso de Velocidade", effect: "+1 de Velocidade ao final de cada turno." },
  prankster:      { pt: "Trapaceiro",         effect: "Golpes de status ganham +1 de prioridade." },
  "gale-wings":   { pt: "Asas do Vendaval",   effect: "Golpes Voador ganham prioridade (com HP cheio)." },

  // --- utilidade / status ---
  "poison-heal":  { pt: "Cura Venenosa",      effect: "Envenenado, recupera HP em vez de perder." },
  "poison-point": { pt: "Ponta Venenosa",     effect: "30% de chance de envenenar quem usa golpe de contato." },
  static:         { pt: "Estática",           effect: "30% de chance de paralisar quem usa golpe de contato." },
  "flame-body":   { pt: "Corpo Flamejante",   effect: "30% de chance de queimar quem usa golpe de contato." },
  "rough-skin":   { pt: "Pele Áspera",        effect: "Fere quem te acerta com golpe de contato." },
  "iron-barbs":   { pt: "Espinhos de Ferro",  effect: "Fere quem te acerta com golpe de contato." },
  pressure:       { pt: "Pressão",            effect: "O oponente gasta 2 PP por golpe usado contra você." },
  "magic-bounce": { pt: "Reflexo Mágico",     effect: "Reflete de volta golpes de status recebidos." },
  "serene-grace": { pt: "Graça Serena",       effect: "Dobra a chance dos efeitos extras dos golpes." },
  "no-guard":     { pt: "Sem Defesa",         effect: "Todos os golpes (seus e do oponente) acertam sempre." },
  mold_breaker:   { pt: "Quebra-molde",       effect: "Ignora habilidades defensivas do oponente ao atacar." },
  "mold-breaker": { pt: "Quebra-molde",       effect: "Ignora habilidades defensivas do oponente ao atacar." },
  protean:        { pt: "Metamorfo",          effect: "Muda para o tipo do golpe que vai usar (ganha STAB sempre)." },
  libero:         { pt: "Líbero",             effect: "Muda para o tipo do golpe que vai usar (ganha STAB sempre)." },
  download:       { pt: "Download",           effect: "Ao entrar, +1 no ataque (físico ou especial) mais útil contra o alvo." },
  "beast-boost":  { pt: "Impulso Bestial",    effect: "+1 no seu melhor status a cada nocaute que causa." },
  "wonder-guard": { pt: "Guarda Milagrosa",   effect: "Só é ferido por golpes super-efetivos." },

  // --- iniciais e outras muito comuns ---
  overgrow:       { pt: "Supercrescimento",   effect: "+50% de dano em golpes de Grama quando o HP fica baixo (1/3)." },
  blaze:          { pt: "Chama",              effect: "+50% de dano em golpes de Fogo quando o HP fica baixo (1/3)." },
  torrent:        { pt: "Torrente",           effect: "+50% de dano em golpes de Água quando o HP fica baixo (1/3)." },
  swarm:          { pt: "Enxame",             effect: "+50% de dano em golpes de Inseto quando o HP fica baixo (1/3)." },
  "shed-skin":    { pt: "Trocar de Pele",     effect: "1/3 de chance de se curar de status a cada turno." },
  "inner-focus":  { pt: "Foco Interior",      effect: "Não recua ao ser atingido; imune a Intimidação." },
  "keen-eye":     { pt: "Olho Aguçado",       effect: "A precisão nunca é reduzida pelo oponente." },
  "clear-body":   { pt: "Corpo Limpo",        effect: "O oponente não consegue reduzir seus status." },
  "water-veil":   { pt: "Véu d'Água",         effect: "Imune a queimadura." },
  immunity:       { pt: "Imunidade",          effect: "Imune a envenenamento." },
  limber:         { pt: "Flexibilidade",      effect: "Imune a paralisia." },
  insomnia:       { pt: "Insônia",            effect: "Imune a sono." },
  "vital-spirit": { pt: "Espírito Vital",     effect: "Imune a sono." },
  "own-tempo":    { pt: "Ritmo Próprio",      effect: "Imune a confusão e a Intimidação." },
  synchronize:    { pt: "Sincronizar",        effect: "Passa queimadura/veneno/paralisia de volta a quem o causou." },
  "cursed-body":  { pt: "Corpo Amaldiçoado",  effect: "30% de chance de desabilitar o golpe que te acertou." },
  competitive:    { pt: "Competitivo",        effect: "+2 Atq. Especial quando um status seu é reduzido." },
  defiant:        { pt: "Desafiador",         effect: "+2 Ataque quando um status seu é reduzido." },
  justified:      { pt: "Justiceiro",         effect: "+1 Ataque ao ser atingido por golpe Sombrio." },
  "water-bubble": { pt: "Bolha d'Água",       effect: "Dobra o dano de golpes de Água; recebe metade do dano de Fogo; imune a queimadura." },
  "grassy-pelt":  { pt: "Pelo de Grama",      effect: "+50% de Defesa em Terreno de Grama." },
  "sand-veil":    { pt: "Véu de Areia",       effect: "Evasão maior na tempestade de areia (e imune a ela)." },
  "snow-cloak":   { pt: "Manto de Neve",      effect: "Evasão maior na neve/granizo (e imune a ele)." },
  "marvel-scale": { pt: "Escama Maravilha",   effect: "+50% de Defesa quando está com status." },
  "shield-dust":  { pt: "Pó de Escudo",       effect: "Bloqueia os efeitos secundários dos golpes recebidos." },
  overcoat:       { pt: "Sobretudo",          effect: "Imune a pó/esporo e a dano de clima." },
};

/* Cache em memória do resultado final resolvido (curado ou vindo da API). */
const _abilityCache = {};

/* Extrai um texto de efeito legível do objeto de habilidade da PokéAPI (prefere pt, senão en). */
function _effectFromApi(data) {
  const pick = (arr, langKey, field) => {
    const e = (arr || []).find(x => x.language && x.language.name === langKey);
    return e ? (e[field] || "").replace(/[\n\f]/g, " ").trim() : "";
  };
  return (
    pick(data.effect_entries, "pt-br", "short_effect") ||
    pick(data.effect_entries, "pt", "short_effect") ||
    pick(data.flavor_text_entries, "pt-br", "flavor_text") ||
    pick(data.effect_entries, "en", "short_effect") ||
    pick(data.effect_entries, "en", "effect") ||
    pick(data.flavor_text_entries, "en", "flavor_text") ||
    ""
  );
}

/* Nome "bonito" de uma habilidade a partir do slug (fallback quando não há PT curado). */
window.abilityLabel = function (slug) {
  const c = window.ABILITY_PT[slug];
  if (c) return c.pt;
  return String(slug || "").split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
};

/* Resolve nome PT + efeito de uma habilidade. Curado primeiro; senão PokéAPI (cacheado). */
window.abilityInfo = async function (slug) {
  if (!slug) return { name: slug, pt: "", effect: "", curated: false };
  if (_abilityCache[slug]) return _abilityCache[slug];
  const curated = window.ABILITY_PT[slug];
  if (curated) {
    return (_abilityCache[slug] = { name: slug, pt: curated.pt, effect: curated.effect, curated: true });
  }
  try {
    const data = await window.API.getAbility(slug);
    const ptName = (data.names || []).find(n => n.language && (n.language.name === "pt-br" || n.language.name === "pt"));
    const info = {
      name: slug,
      pt: ptName ? ptName.name : window.abilityLabel(slug),
      effect: _effectFromApi(data),
      curated: false,
    };
    return (_abilityCache[slug] = info);
  } catch {
    return (_abilityCache[slug] = { name: slug, pt: window.abilityLabel(slug), effect: "", curated: false });
  }
};
