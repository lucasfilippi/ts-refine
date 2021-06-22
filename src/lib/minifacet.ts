import MiniSearch, {
  // AsPlainObject,
  Options as MiniSearchOptions,
  SearchOptions,
  // SearchResult as MiniSearchSearchResult,
} from 'minisearch';
import TypedFastBitSet from 'typedfastbitset';

export type Primitives = string | number | boolean;

export class FacetFilter {
  protected name: string;
  protected values: Primitives[];

  constructor(name: string, values: Primitives[]) {
    this.name = name;
    this.values = values;
  }

  facetIds(): string[] {
    return this.values.map((v) => `${this.name}:${v}`);
  }
}

export interface Indexable {
  [attr: string]: Primitives | Primitives[];
}

export type FacetedSearchOptions = SearchOptions & {
  readonly facets?: string[];
  facetFilters?: FacetFilter[];
};

export type FacetsDistribution = {
  readonly [facetName: string]: { [facetValue: string]: number };
};

export type SearchResult = {
  score: number;
  data: Indexable;
};

export type FacetedSearchResult = {
  readonly hits: readonly SearchResult[];
  readonly facetsDistribution: FacetsDistribution;
};

export type Options<T> = MiniSearchOptions<T> & {
  facetingFields: string[];
  storedField: string[];
};

export class MiniFacet<T extends Indexable> {
  protected minisearch: MiniSearch;
  protected facetingFields: string[];
  protected storedField: string[];
  protected db: Indexable[];
  protected raw: T[];
  protected facetIndexes: Map<string, TypedFastBitSet>;

  constructor(options: Options<T>) {
    this.facetingFields = options.facetingFields;
    this.storedField = options.storedField || [];
    // minisearch do not store any data
    delete options.storeFields;
    this.minisearch = new MiniSearch<T>(options);
    this.db = [];
    this.raw = [];
    this.facetIndexes = new Map();
  }

  get database(): Indexable[] {
    return this.db;
  }

  /**
   * Adds all the given documents to the internal db
   * This method can be called multiple times
   *
   * @param documents  An array of documents to be indexed
   */
  add(documents: T[]): void {
    this.raw.push(...documents);
  }

  buildFacetIndexes(): void {
    this.raw.forEach((doc, docIdx) => {
      for (const field of this.facetingFields) {
        const values: Primitives[] = Array.isArray(doc[field])
          ? (doc[field] as Primitives[])
          : ([doc[field]] as Primitives[]);

        values.forEach((v) => {
          const value: string = v.toString();
          if (value) {
            const id = `${field}:${value}`;
            if (!this.facetIndexes.has(id)) {
              const fbs = new TypedFastBitSet();
              fbs.add(docIdx);
              this.facetIndexes.set(id, fbs);
            } else {
              this.facetIndexes.get(id)?.add(docIdx);
            }
          }
        });
      }
    });
  }

  /**
   * Compile the indexes.
   */
  compile(): void {
    // Add to minisearch index
    this.minisearch.addAll(this.raw);
    // Compute facets bitmap indexes
    this.buildFacetIndexes();

    // filter raw to store in db
    this.db = this.raw.map((d) => {
      return Object.keys(d)
        .filter((key) => this.storedField.includes(key))
        .reduce((obj: Indexable, key) => {
          obj[key] = d[key];
          return obj as T;
        }, {});
    });
    // reset raw
    this.raw = [];
  }

  applyFacetFilters(facetFilters: FacetFilter[]): TypedFastBitSet {
    // get all facetIndexesId
    const facetIndexesIds = facetFilters.map((f) => f.facetIds());

    const results: TypedFastBitSet = new TypedFastBitSet([...this.db.keys()]);

    facetIndexesIds.forEach((filter) => {
      const idx = filter
        .filter((id) => this.facetIndexes.has(id))
        .map((id) => {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          return this.facetIndexes.get(id)!;
        })
        .reduce(
          (acc: TypedFastBitSet, curr: TypedFastBitSet): TypedFastBitSet =>
            acc.union(curr),
          new TypedFastBitSet()
        );

      results.intersection(idx);
    });

    return results;
  }

  computeFacetDistribution(
    hits: TypedFastBitSet,
    facetingFields: string[]
  ): FacetsDistribution {
    const indexes = new Map();

    for (const [key, idx] of this.facetIndexes) {
      const [field, value] = key.split(':', 2);

      if (facetingFields.includes(field)) {
        if (!indexes.has(field)) {
          indexes.set(field, new Map());
        }

        indexes.get(field).set(value, idx);
      }
    }

    const distribution: FacetsDistribution = Object.fromEntries(
      facetingFields.map((field: string) => {
        const dist: { [facetValue: string]: number } = {};

        if (indexes.has(field)) {
          for (const [key, idx] of indexes.get(field)) {
            dist[key] = hits.new_intersection(idx).size();
          }
        }

        return [field, dist];
      })
    );

    return distribution;
  }

  indexToSearchResult(index: TypedFastBitSet): SearchResult[] {
    return this.db
      .filter((_, i) => index.has(i))
      .map((d) => {
        return { score: 1, data: d };
      });
  }

  // facetedSearch(
  //   queryString: string,
  //   searchOptions: FacetedSearchOptions = {}
  // ): FacetedSearchResult {
  //   const msResults = this.applyFacetFilters(
  //     this.minisearch.search(queryString, searchOptions),
  //     searchOptions.facetFilters
  //   );

  //   const results: FacetedSearchResult = {
  //     hits: msResults,
  //     nbHits: msResults.length,
  //     facetsDistribution: this.computeFacetDistribution(
  //       msResults,
  //       searchOptions.facets || this.facetingFields
  //     ),
  //   };

  //   return results;
  // }

  // getAll(): FacetedSearchResult {
  //   console.log('minifacet::getAll');
  //   const msResults = this.minisearch.getAll();

  //   const results: FacetedSearchResult = {
  //     hits: msResults,
  //     nbHits: msResults.length,
  //     facetsDistribution: this.computeFacetDistribution(
  //       msResults,
  //       this.facetingFields
  //     ),
  //   };

  //   return results;
  // }

  // toJSON(): AsPlainObject {
  //   return this.minisearch.toJSON();
  //   // return {
  //   //   ...this.minisearch.toJSON(),
  //   //   ...{ facetingFields: this.facetingFields },
  //   // };
  // }

  // // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // static loadJSON<T = any>(json: string, options: Options<T>): MiniFacet<T> {
  //   const miniFacet = new MiniFacet(options);
  //   const minisearch = MiniSearch.loadJSON(json, options) as MiniSearch;
  //   miniFacet.minisearch = minisearch;
  //   return miniFacet;
  // }

  // // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // static async fetchJSON<T = any>(
  //   url: string,
  //   options: Options<T>
  // ): Promise<MiniFacet<T>> {
  //   const response = await window.fetch(url);

  //   if (response.ok) {
  //     const json = await response.json();
  //     // TODO: check json de serialization OK
  //     const miniFacet = new MiniFacet(options);
  //     const minisearch = MiniSearch.loadJS(json, options);
  //     miniFacet.minisearch = minisearch as MiniSearch;
  //     return miniFacet;
  //   } else {
  //     return Promise.reject(response.statusText);
  //   }
  // }
}
