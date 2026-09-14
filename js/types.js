/* types.js — dados fixos dos 18 tipos e a tabela de efetividade (Gen 6+).
 * É o coração do motor de análise de time: a matemática de cobertura e fraqueza
 * roda 100% no cliente, sem depender da PokéAPI. Não muda entre gerações recentes.
 * Fonte da nota do vault: projetos/pokedex/pokedex-dados.md ("tabela embutida").
 */

// Ordem canônica dos 18 tipos + rótulo PT-BR + cor (usada em badges e no graph).
window.TYPES = [
  { id: "normal",   pt: "Normal",   color: "#A8A77A" },
  { id: "fire",     pt: "Fogo",     color: "#EE8130" },
  { id: "water",    pt: "Água",     color: "#6390F0" },
  { id: "electric", pt: "Elétrico", color: "#F7D02C" },
  { id: "grass",    pt: "Grama",    color: "#7AC74C" },
  { id: "ice",      pt: "Gelo",     color: "#96D9D6" },
  { id: "fighting", pt: "Lutador",  color: "#C22E28" },
  { id: "poison",   pt: "Venenoso", color: "#A33EA1" },
  { id: "ground",   pt: "Terra",    color: "#E2BF65" },
  { id: "flying",   pt: "Voador",   color: "#A98FF3" },
  { id: "psychic",  pt: "Psíquico", color: "#F95587" },
  { id: "bug",      pt: "Inseto",   color: "#A6B91A" },
  { id: "rock",     pt: "Pedra",    color: "#B6A136" },
  { id: "ghost",    pt: "Fantasma", color: "#735797" },
  { id: "dragon",   pt: "Dragão",   color: "#6F35FC" },
  { id: "dark",     pt: "Sombrio",  color: "#705746" },
  { id: "steel",    pt: "Aço",      color: "#B7B7CE" },
  { id: "fairy",    pt: "Fada",     color: "#D685AD" },
];

// Mapas de apoio rápidos.
window.TYPE_PT = Object.fromEntries(window.TYPES.map(t => [t.id, t.pt]));
window.TYPE_COLOR = Object.fromEntries(window.TYPES.map(t => [t.id, t.color]));
window.TYPE_IDS = window.TYPES.map(t => t.id);

/* TYPE_CHART[atacante][defensor] = multiplicador de dano.
 * Só guardamos os valores != 1 (o resto é neutro = 1). */
window.TYPE_CHART = {
  normal:   { rock: 0.5, ghost: 0, steel: 0.5 },
  fire:     { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water:    { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass:    { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
  ice:      { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5 },
  poison:   { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
  ground:   { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying:   { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic:  { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug:      { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
  rock:     { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost:    { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon:   { dragon: 2, steel: 0.5, fairy: 0 },
  dark:     { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  steel:    { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
  fairy:    { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 },
};

/* Multiplicador de um tipo ATACANTE contra um defensor de 1 ou 2 tipos. */
window.effectiveness = function (attacker, defenderTypes) {
  return defenderTypes.reduce((mult, def) => {
    const row = window.TYPE_CHART[attacker] || {};
    return mult * (def in row ? row[def] : 1);
  }, 1);
};

// Faixas de ID por geração (usadas no filtro da Pokédex).
window.GENERATIONS = [
  { id: 1, label: "Gen 1 (Kanto)",   min: 1,   max: 151 },
  { id: 2, label: "Gen 2 (Johto)",   min: 152, max: 251 },
  { id: 3, label: "Gen 3 (Hoenn)",   min: 252, max: 386 },
  { id: 4, label: "Gen 4 (Sinnoh)",  min: 387, max: 493 },
  { id: 5, label: "Gen 5 (Unova)",   min: 494, max: 649 },
  { id: 6, label: "Gen 6 (Kalos)",   min: 650, max: 721 },
  { id: 7, label: "Gen 7 (Alola)",   min: 722, max: 809 },
  { id: 8, label: "Gen 8 (Galar)",   min: 810, max: 905 },
  { id: 9, label: "Gen 9 (Paldea)",  min: 906, max: 1025 },
];
