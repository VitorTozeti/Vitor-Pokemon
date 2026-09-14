/* api.js — acesso à PokéAPI (https://pokeapi.co/api/v2) com cache no cliente.
 *
 * Fair-use (ver vault projetos/pokedex/pokedex-dados.md): os dados são estáticos, então
 * cacheamos tudo em localStorage e evitamos requests repetidos. Truque de eficiência:
 * em vez de 1 fetch por Pokémon só para saber os tipos, buscamos os 18 endpoints /type
 * UMA vez e montamos um índice nome->tipos de TODOS os Pokémon (18 requests no total).
 */

window.API = (function () {
  const BASE = "https://pokeapi.co/api/v2";
  const CACHE_PREFIX = "poke:v1:";
  const SPRITE = (id) =>
    `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
  const ARTWORK = (id) =>
    `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;

  // ---- cache em localStorage (com tolerância a cota estourada) ----
  function cacheGet(key) {
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + key);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
  function cacheSet(key, value) {
    try {
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(value));
    } catch (e) {
      // Cota cheia: limpa os detalhes de Pokémon (o mais volumoso) e tenta 1x.
      try {
        Object.keys(localStorage)
          .filter(k => k.startsWith(CACHE_PREFIX + "pokemon:"))
          .forEach(k => localStorage.removeItem(k));
        localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(value));
      } catch { /* desiste silenciosamente do cache */ }
    }
  }

  async function fetchJSON(url, cacheKey) {
    if (cacheKey) {
      const hit = cacheGet(cacheKey);
      if (hit) return hit;
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(`PokéAPI ${res.status} em ${url}`);
    const data = await res.json();
    if (cacheKey) cacheSet(cacheKey, data);
    return data;
  }

  const idFromUrl = (url) => Number(url.replace(/\/$/, "").split("/").pop());

  // ---- índice global de tipos (nome -> [tipos]) via os 18 endpoints /type ----
  let typeIndex = null; // { byName: {pikachu:["electric"]}, byType: {electric:Set} }

  async function buildTypeIndex(onProgress) {
    if (typeIndex) return typeIndex;
    const cached = cacheGet("typeIndex");
    if (cached) {
      typeIndex = { byName: cached.byName, byType: {} };
      for (const t in cached.byType) typeIndex.byType[t] = new Set(cached.byType[t]);
      return typeIndex;
    }
    const byName = {};
    const byType = {};
    for (let i = 0; i < window.TYPE_IDS.length; i++) {
      const t = window.TYPE_IDS[i];
      const data = await fetchJSON(`${BASE}/type/${t}`, `type:${t}`);
      byType[t] = new Set();
      for (const entry of data.pokemon) {
        const name = entry.pokemon.name;
        (byName[name] = byName[name] || []).push(t);
        byType[t].add(name);
      }
      if (onProgress) onProgress(i + 1, window.TYPE_IDS.length);
    }
    // ordena os tipos de cada Pokémon pela ordem canônica (cosmético)
    for (const n in byName) {
      byName[n].sort((a, b) => window.TYPE_IDS.indexOf(a) - window.TYPE_IDS.indexOf(b));
    }
    typeIndex = { byName, byType };
    // persiste (Sets viram arrays)
    const serializable = { byName, byType: {} };
    for (const t in byType) serializable.byType[t] = [...byType[t]];
    cacheSet("typeIndex", serializable);
    return typeIndex;
  }

  // ---- lista completa de Pokémon (id + nome), 1 request cacheado ----
  let listCache = null;
  async function getList() {
    if (listCache) return listCache;
    const data = await fetchJSON(`${BASE}/pokemon?limit=100000&offset=0`, "list");
    listCache = data.results
      .map(r => ({ id: idFromUrl(r.url), name: r.name }))
      .filter(p => p.id <= 1025) // ignora formas alternativas com IDs altos
      .sort((a, b) => a.id - b.id);
    return listCache;
  }

  // Tipos de um Pokémon a partir do índice (instantâneo, sem novo fetch).
  function typesOf(name) {
    return (typeIndex && typeIndex.byName[name]) || [];
  }

  // ---- detalhe sob demanda (para ficha e para o time) ----
  async function getPokemon(idOrName) {
    return fetchJSON(`${BASE}/pokemon/${idOrName}`, `pokemon:${idOrName}`);
  }
  async function getSpecies(idOrName) {
    return fetchJSON(`${BASE}/pokemon-species/${idOrName}`, `species:${idOrName}`);
  }
  async function getEvolutionChain(url) {
    return fetchJSON(url, `evo:${idFromUrl(url)}`);
  }
  async function getAbility(idOrName) {
    return fetchJSON(`${BASE}/ability/${idOrName}`, `ability:${idOrName}`);
  }

  function clearCache() {
    Object.keys(localStorage)
      .filter(k => k.startsWith(CACHE_PREFIX))
      .forEach(k => localStorage.removeItem(k));
    listCache = null; typeIndex = null;
  }

  return {
    BASE, SPRITE, ARTWORK, idFromUrl,
    buildTypeIndex, getList, typesOf,
    getPokemon, getSpecies, getEvolutionChain, getAbility,
    clearCache,
  };
})();
