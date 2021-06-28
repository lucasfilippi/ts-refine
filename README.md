# minifacet

Add faceted search support to minisearch

# TODO

- proper error handling: https://valand.dev/blog/post/from-rust-to-typescript with https://github.com/gcanti/io-ts
- serialization
- doc
- more check on type in compile
- more check on type in search

# Refacto

- use io-ts for runtime typecheck
- use fp-ts for error handling
- split build / run with Builder class
- abstract Index type with Interfaces :
  - params => construct option
  - build
  - search : Id
  - search metadata : fulltext score, geo distance, facets
  - serialization

# Serialization:

facile:

- protected facetingFields: string[];
- protected storedFields: string[];
- protected geoFields: string[];
- protected db: {id: number; data: Indexable}[]

protected facetIndexes: Map<string, TypedFastBitSet>;
protected geoIndexes: Map<string, GeoKDBush<Coordinates>>;
protected minisearch?: MiniSearch;

Search Option

facet: {
filters : {
key: "val",
key2, [1,2,3]
},
facets : ["key","key2","key3"]

}
