<p align="center">
  <h3 align="center">ts-refine</h3>
  <p align="center">In memory Full-text / Faceted / Geo Search written in typescript</p>
  <p align="center">
    <a href="/package.json"><img alt="Software License" src="https://img.shields.io/badge/license-MIT-brightgreen.svg?style=flat-square"></a>
  </p>
</p>

## What's inside?

In memory search engine written in typescript with several index types :

- full text search, thanks to [Minisearch](https://github.com/lucaong/minisearch)
- faceted search (filters and distribution)
- geo spatial search (with an internal typescript port of [Geokdbush](https://github.com/mourner/geokdbush))

## Why ?

I start ts-refine as an alternative to hosted search engine for small / middle search needs with limited data updates.
ts-refined is in-memory and is particularly suitable for static site, as you can build the indexes during the static site build process.

## Performances

I build a small [performance test](https://github.com/lucasfilippi/ts-refine/src/lib/perf.spec.ts), using [all-the-cities](https://github.com/zeke/all-the-cities) (138,398 cities in the world ), with text, facet and geo index and run a complex query on it.
Currently, on my personal computer (Intel(R) Core(TM) i7-1165G7 + 16Go memory LPDDR4x 4267MHz), I have the following times:

- index build in ~3.5s
- serialized index size is ~44Mb
- index reloaded from string in ~800ms
- query in ~75ms

## Status

ts-refine is under development, this is an alpha version not ready for production use.
** NOT YET published on NPM **

A [gatsbyjs](https://www.gatsbyjs.com) plugin is also under development.

## Examples

See [perf.spec.ts](https://github.com/lucasfilippi/ts-refine/src/lib/perf.spec.ts)

More coming soon...
