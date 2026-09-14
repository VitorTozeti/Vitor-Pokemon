# Pokédex + Gerador de Time

Site estático (JS puro, zero build) que reúne uma **Pokédex** completa e um **analisador de
time** avançado. Consome a [PokéAPI](https://pokeapi.co) com cache local.

> Documentação viva do projeto no vault de conhecimento: `projetos/pokedex/pokedex.md`
> e `projetos/pokedex/pokedex-dados.md`.

## Rodar

Não precisa de Node nem build. Duas opções:

- **Abrir direto:** dê duplo-clique em `index.html` (ou arraste pro navegador).
- **Servidor local (recomendado):** se tiver Python instalado:
  ```bash
  python -m http.server 8080
  ```
  e acesse `http://localhost:8080`.

## Funcionalidades

- **Pokédex:** grid com busca (nome/número) e filtros por **tipo** e **geração** (1–9).
- **Ficha detalhada:** tipos, habilidades, status base (com barras), fraquezas defensivas,
  altura/peso, movimentos e artwork oficial.
- **Tipos:** tabela de efetividade 18×18 (a mesma que alimenta a análise).
- **Time (até 6):** montagem por clique; persiste no navegador (localStorage).
- **Motor de análise do time:**
  - **Cobertura ofensiva** por STAB (tipos que faltam bater super-efetivo).
  - **Fraquezas compartilhadas** (tipos que ferem 2+ membros).
  - **Perfil de status** (ofensivo / bulk / velocidade) e leitura de estilo.
  - **Sugestões** automáticas + matriz defensiva completa.

## Arquitetura

Estático, sem dependências. Toda a matemática de tipos roda no cliente (`js/types.js`).

```
poke/
  index.html
  css/styles.css
  js/
    types.js     # 18 tipos + tabela de efetividade (Gen 6+) + gerações
    api.js       # PokéAPI + cache (localStorage); índice de tipos em 18 requests
    pokedex.js   # grid, busca/filtros e ficha detalhada
    team.js      # montador de time + motor de análise
    app.js       # boot, abas e tela de Tipos
```

### Eficiência / fair-use
A PokéAPI pede cache (dados estáticos). O app: (1) busca os **18 endpoints `/type`** uma
única vez para saber os tipos de **todos** os Pokémon (em vez de 1 request por Pokémon);
(2) busca a lista completa 1 vez; (3) só busca a ficha completa sob demanda. Tudo cacheado
em `localStorage`.

## Dados
[PokéAPI](https://pokeapi.co) · sprites de `PokeAPI/sprites` (GitHub). Uso sob *fair-use*.
