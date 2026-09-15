/* items.js — catálogo curado de ITENS de segurar (held items) competitivos.
 *
 * Em vez de puxar as centenas de itens do endpoint /item da PokéAPI (a maioria irrelevante
 * pra montar time — pokébolas, itens de história, etc.), embutimos aqui uma lista curada dos
 * itens que importam no teambuilder, cada um com:
 *   - id: slug igual ao da PokéAPI (serve pro sprite em sprites/items/{id}.png)
 *   - pt: rótulo em português (nome oficial EN entre parênteses)
 *   - cat: categoria pra agrupar/filtrar no seletor
 *   - effect: descrição curta do efeito, em PT
 *   - mod:   multiplicadores de status finais que o MOTOR DE ANÁLISE aplica (ex. Choice Scarf ×1.5 Vel)
 *   - dmg:   multiplicador de dano fixo usado pela CALCULADORA DE DANO (ex. Life Orb ×1.3)
 *   - se:    multiplicador de dano só quando é super-efetivo (ex. Expert Belt ×1.2)
 *   - phys/spec: multiplicador só pra golpe físico/especial (Muscle Band / Wise Glasses)
 *   - locks: trava o Pokémon em um golpe (itens Choice) — usado nas checagens de coerência
 *   - blocksStatus: impede golpes de status (Assault Vest) — checagem de coerência
 *   - nfeOnly: só faz efeito em Pokémon NÃO totalmente evoluído (Eviolite)
 */

window.ITEMS = [
  // ---- Defensivos / sobrevivência ----
  { id: "leftovers",        pt: "Restos (Leftovers)",            cat: "defense", effect: "Recupera 1/16 do HP máx. a cada turno.", mod: { hp: 1.06 } },
  { id: "black-sludge",     pt: "Lodo Negro (Black Sludge)",     cat: "defense", effect: "Cura Pokémon Venenoso (1/16/turno); fere os demais.", mod: { hp: 1.05 } },
  { id: "assault-vest",     pt: "Colete de Combate (Assault Vest)", cat: "defense", effect: "+50% Def. Esp., mas só deixa usar golpes de ataque (sem status).", mod: { "special-defense": 1.5 }, blocksStatus: true },
  { id: "eviolite",         pt: "Eviolite",                      cat: "defense", effect: "+50% Def e Def. Esp. em Pokémon que ainda pode evoluir.", mod: { defense: 1.5, "special-defense": 1.5 }, nfeOnly: true },
  { id: "rocky-helmet",     pt: "Capacete de Pedra (Rocky Helmet)", cat: "defense", effect: "Fere em 1/6 quem te acerta com golpe de contato." },
  { id: "heavy-duty-boots", pt: "Botas Reforçadas (Heavy-Duty Boots)", cat: "defense", effect: "Ignora armadilhas de entrada (Stealth Rock, Spikes…)." },
  { id: "focus-sash",       pt: "Faixa Foco (Focus Sash)",       cat: "defense", effect: "Sobrevive com 1 HP a um golpe que nocautearia (se estiver com HP cheio)." },
  { id: "air-balloon",      pt: "Balão de Ar (Air Balloon)",     cat: "defense", effect: "Imune a Terra até levar um golpe; estoura ao ser atingido." },
  { id: "shell-bell",       pt: "Sino Concha (Shell Bell)",      cat: "defense", effect: "Recupera 1/8 do dano que você causar." },
  { id: "sitrus-berry",     pt: "Fruta Sitrus (Sitrus Berry)",   cat: "defense", effect: "Recupera 25% do HP quando cai abaixo de 50%." },
  { id: "weakness-policy",  pt: "Política de Fraqueza (Weakness Policy)", cat: "defense", effect: "+2 Atk e +2 Atq.Esp. ao ser atingido por golpe super-efetivo." },

  // ---- Ofensivos ----
  { id: "life-orb",     pt: "Orbe da Vida (Life Orb)",        cat: "offense", effect: "+30% de dano, mas perde 1/10 do HP a cada ataque.", dmg: 1.3 },
  { id: "choice-band",  pt: "Bandana Escolha (Choice Band)",  cat: "offense", effect: "+50% Ataque, mas trava no 1º golpe usado.", mod: { attack: 1.5 }, locks: true },
  { id: "choice-specs", pt: "Óculos Escolha (Choice Specs)",  cat: "offense", effect: "+50% Atq. Esp., mas trava no 1º golpe usado.", mod: { "special-attack": 1.5 }, locks: true },
  { id: "choice-scarf", pt: "Lenço Escolha (Choice Scarf)",   cat: "offense", effect: "+50% Velocidade, mas trava no 1º golpe usado.", mod: { speed: 1.5 }, locks: true },
  { id: "expert-belt",  pt: "Cinto Perito (Expert Belt)",     cat: "offense", effect: "+20% de dano em golpes super-efetivos.", se: 1.2 },
  { id: "muscle-band",  pt: "Faixa Muscular (Muscle Band)",   cat: "offense", effect: "+10% de dano em golpes físicos.", phys: 1.1 },
  { id: "wise-glasses", pt: "Óculos Sábios (Wise Glasses)",   cat: "offense", effect: "+10% de dano em golpes especiais.", spec: 1.1 },
  { id: "punching-glove", pt: "Luva de Soco (Punching Glove)", cat: "offense", effect: "+10% de dano em golpes de soco; ignora contato." },
  { id: "loaded-dice",  pt: "Dados Viciados (Loaded Dice)",   cat: "offense", effect: "Golpes de múltiplos acertos batem 4–5 vezes." },
  { id: "scope-lens",   pt: "Lente de Mira (Scope Lens)",     cat: "offense", effect: "+ chance de acerto crítico." },
  { id: "metronome",    pt: "Metrônomo (Metronome)",          cat: "offense", effect: "Repetir o mesmo golpe aumenta o dano progressivamente." },

  // ---- Status / truques ----
  { id: "flame-orb",    pt: "Orbe de Chama (Flame Orb)",      cat: "status", effect: "Queima o portador no fim do 1º turno (combos com Guts/Facade)." },
  { id: "toxic-orb",    pt: "Orbe Tóxico (Toxic Orb)",        cat: "status", effect: "Envenena gravemente o portador (combos com Poison Heal/Guts)." },
  { id: "lum-berry",    pt: "Fruta Lum (Lum Berry)",          cat: "status", effect: "Cura qualquer condição de status uma vez." },
  { id: "chesto-berry", pt: "Fruta Chesto (Chesto Berry)",    cat: "status", effect: "Acorda na hora uma vez (combo com Rest)." },
  { id: "mental-herb",  pt: "Erva Mental (Mental Herb)",      cat: "status", effect: "Protege de Taunt/Encore/Attract uma vez." },
  { id: "covert-cloak", pt: "Manto Furtivo (Covert Cloak)",   cat: "status", effect: "Ignora os efeitos secundários dos golpes inimigos." },
  { id: "clear-amulet", pt: "Amuleto Claro (Clear Amulet)",   cat: "status", effect: "Impede que o inimigo baixe seus status." },
  { id: "safety-goggles", pt: "Óculos de Proteção (Safety Goggles)", cat: "status", effect: "Imune a pó/esporo e a dano de clima (areia/granizo)." },

  // ---- Utilidade / clima / campo ----
  { id: "light-clay",      pt: "Argila Leve (Light Clay)",       cat: "utility", effect: "Reflect/Light Screen duram 8 turnos em vez de 5." },
  { id: "damp-rock",       pt: "Pedra Úmida (Damp Rock)",        cat: "utility", effect: "Chuva dura 8 turnos em vez de 5." },
  { id: "heat-rock",       pt: "Pedra de Calor (Heat Rock)",     cat: "utility", effect: "Sol dura 8 turnos em vez de 5." },
  { id: "terrain-extender", pt: "Extensor de Terreno (Terrain Extender)", cat: "utility", effect: "Terrenos duram 8 turnos em vez de 5." },
  { id: "booster-energy",  pt: "Energia Booster (Booster Energy)", cat: "utility", effect: "Ativa Protosynthesis/Quark Drive uma vez, sem clima/terreno." },
  { id: "power-herb",      pt: "Erva de Poder (Power Herb)",     cat: "utility", effect: "Pula o turno de carga de golpes como Solar Beam uma vez." },
  { id: "white-herb",      pt: "Erva Branca (White Herb)",       cat: "utility", effect: "Restaura status reduzidos uma vez." },
  { id: "quick-claw",      pt: "Garra Rápida (Quick Claw)",      cat: "utility", effect: "20% de chance de atacar primeiro no turno." },
  { id: "bright-powder",   pt: "Pó Brilhante (Bright Powder)",   cat: "utility", effect: "Reduz levemente a precisão dos ataques inimigos." },

  // ---- Frutas de resistência (berries defensivas de tipo) ----
  { id: "occa-berry",   pt: "Fruta Occa (Occa Berry)",       cat: "berry", effect: "Reduz pela metade um golpe de Fogo super-efetivo (uma vez)." },
  { id: "roseli-berry", pt: "Fruta Roseli (Roseli Berry)",   cat: "berry", effect: "Reduz pela metade um golpe de Fada super-efetivo (uma vez)." },
  { id: "salac-berry",  pt: "Fruta Salac (Salac Berry)",     cat: "berry", effect: "+1 de Velocidade quando o HP fica baixo.", mod: { speed: 1.15 } },
];

/* ---- MEGA PEDRAS ----------------------------------------------------------------
 * Cada mega evolução exige a sua Mega Pedra segurada. Mapeamos o nome da VARIEDADE mega da
 * PokéAPI (ex.: "charizard-mega-x") -> { id: slug da pedra p/ o sprite, pt: rótulo }.
 * O editor usa isto para, ao escolher uma mega, já segurar a pedra certa (e vice-versa).
 */
window.MEGA_STONES = {
  "venusaur-mega":      { id: "venusaurite",    pt: "Venusaurita" },
  "charizard-mega-x":   { id: "charizardite-x", pt: "Charizardita X" },
  "charizard-mega-y":   { id: "charizardite-y", pt: "Charizardita Y" },
  "blastoise-mega":     { id: "blastoisinite",  pt: "Blastoisinita" },
  "beedrill-mega":      { id: "beedrillite",    pt: "Beedrillita" },
  "pidgeot-mega":       { id: "pidgeotite",     pt: "Pidgeotita" },
  "alakazam-mega":      { id: "alakazite",      pt: "Alakazita" },
  "slowbro-mega":       { id: "slowbronite",    pt: "Slowbronita" },
  "gengar-mega":        { id: "gengarite",      pt: "Gengarita" },
  "kangaskhan-mega":    { id: "kangaskhanite",  pt: "Kangaskhanita" },
  "pinsir-mega":        { id: "pinsirite",      pt: "Pinsirita" },
  "gyarados-mega":      { id: "gyaradosite",    pt: "Gyaradosita" },
  "aerodactyl-mega":    { id: "aerodactylite",  pt: "Aerodactylita" },
  "mewtwo-mega-x":      { id: "mewtwonite-x",   pt: "Mewtwonita X" },
  "mewtwo-mega-y":      { id: "mewtwonite-y",   pt: "Mewtwonita Y" },
  "ampharos-mega":      { id: "ampharosite",    pt: "Ampharosita" },
  "steelix-mega":       { id: "steelixite",     pt: "Steelixita" },
  "scizor-mega":        { id: "scizorite",      pt: "Scizorita" },
  "heracross-mega":     { id: "heracronite",    pt: "Heracronita" },
  "houndoom-mega":      { id: "houndoominite",  pt: "Houndoominita" },
  "tyranitar-mega":     { id: "tyranitarite",   pt: "Tyranitarita" },
  "sceptile-mega":      { id: "sceptilite",     pt: "Sceptilita" },
  "blaziken-mega":      { id: "blazikenite",    pt: "Blazikenita" },
  "swampert-mega":      { id: "swampertite",    pt: "Swampertita" },
  "gardevoir-mega":     { id: "gardevoirite",   pt: "Gardevoirita" },
  "sableye-mega":       { id: "sablenite",      pt: "Sablenita" },
  "mawile-mega":        { id: "mawilite",       pt: "Mawilita" },
  "aggron-mega":        { id: "aggronite",      pt: "Aggronita" },
  "medicham-mega":      { id: "medichamite",    pt: "Medichamita" },
  "manectric-mega":     { id: "manectite",      pt: "Manectita" },
  "sharpedo-mega":      { id: "sharpedonite",   pt: "Sharpedonita" },
  "camerupt-mega":      { id: "cameruptite",    pt: "Cameruptita" },
  "altaria-mega":       { id: "altarianite",    pt: "Altarianita" },
  "banette-mega":       { id: "banettite",      pt: "Banettita" },
  "absol-mega":         { id: "absolite",       pt: "Absolita" },
  "glalie-mega":        { id: "glalitite",      pt: "Glalitita" },
  "salamence-mega":     { id: "salamencite",    pt: "Salamencita" },
  "metagross-mega":     { id: "metagrossite",   pt: "Metagrossita" },
  "latias-mega":        { id: "latiasite",      pt: "Latiasita" },
  "latios-mega":        { id: "latiosite",      pt: "Latiosita" },
  "lopunny-mega":       { id: "lopunnite",      pt: "Lopunnita" },
  "garchomp-mega":      { id: "garchompite",    pt: "Garchompita" },
  "lucario-mega":       { id: "lucarionite",    pt: "Lucarionita" },
  "abomasnow-mega":     { id: "abomasite",      pt: "Abomasita" },
  "gallade-mega":       { id: "galladite",      pt: "Galladita" },
  "audino-mega":        { id: "audinite",       pt: "Audinita" },
  "diancie-mega":       { id: "diancite",       pt: "Diancita" },
};

// slug da pedra -> nome da variedade mega (índice reverso, p/ ir da pedra pra mega)
window.STONE_TO_MEGA = Object.fromEntries(
  Object.entries(window.MEGA_STONES).map(([mega, s]) => [s.id, mega])
);

// injeta as mega pedras no catálogo de itens (categoria "mega") p/ aparecerem no seletor
Object.entries(window.MEGA_STONES).forEach(([mega, s]) => {
  window.ITEMS.push({
    id: s.id, pt: `${s.pt} (Mega Pedra)`, cat: "mega",
    effect: `Permite a mega evolução para ${mega.split("-").map(w => w === "x" || w === "y" ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)).join(" ")} durante a batalha.`,
    megaFor: mega,
  });
});

window.ITEM_BY_ID = Object.fromEntries(window.ITEMS.map(i => [i.id, i]));

// Sprite oficial do item (mesmo repositório de sprites usado pelos Pokémon).
window.itemSprite = (id) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${id}.png`;

// Categorias na ordem em que aparecem no seletor.
window.ITEM_CATS = [
  { id: "",        label: "Todos" },
  { id: "offense", label: "Ofensivos" },
  { id: "defense", label: "Defensivos" },
  { id: "status",  label: "Status" },
  { id: "utility", label: "Utilidade" },
  { id: "berry",   label: "Frutas" },
  { id: "mega",    label: "Mega Pedras" },
];

/* Resolve o rótulo de exibição de um item guardado num build.
 * Aceita: id conhecido -> rótulo PT; texto livre antigo -> ele mesmo; vazio -> "". */
window.itemLabel = function (idOrText) {
  if (!idOrText) return "";
  const it = window.ITEM_BY_ID[idOrText];
  return it ? it.pt : idOrText;
};
