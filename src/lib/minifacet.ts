import MiniSearch, {
  // AsPlainObject,
  Options as MiniSearchOptions,
  SearchOptions as MiniSearchSearchOptions,
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

export interface Indexed {
  id: number;
  data: Indexable;
}

export type FullTextSearchOptions = MiniSearchSearchOptions & {
  query: string;
};

export type SearchOptions = {
  // Return only this facet. If not specified every available facet will be computed
  readonly facets?: string[];
  // Filter results on Facets
  facetFilters?: FacetFilter[];
  // Specify a full text search
  fullTextSearchOptions?: FullTextSearchOptions;
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
  protected db: Indexed[];
  protected raw: T[];
  protected facetIndexes: Map<string, TypedFastBitSet>;

  constructor(options: Options<T>) {
    this.facetingFields = options.facetingFields;
    this.storedField = options.storedField.filter(
      (f) => !this.facetingFields.includes(f)
    );
    // minisearch do not store any data
    delete options.storeFields;
    this.minisearch = new MiniSearch<T>(options);
    this.db = [];
    this.raw = [];
    this.facetIndexes = new Map();
  }

  get database(): Indexable[] {
    return this.db.map((indexed) => indexed.data);
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
    this.db = this.raw.map((d, i) => {
      const o = Object.keys(d)
        .filter((key) => this.storedField.includes(key))
        .reduce((obj: Indexable, key) => {
          obj[key] = d[key];
          return obj as T;
        }, {});
      return { id: i, data: o };
    });
    // reset raw
    this.raw = [];
  }

  applyFacetFilters(
    hits: TypedFastBitSet,
    facetFilters: FacetFilter[]
  ): TypedFastBitSet {
    // get all facetIndexesId
    const facetIndexesIds = facetFilters.map((f) => f.facetIds());

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

      hits.intersection(idx);
    });

    return hits;
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
            const count = hits.new_intersection(idx).size();
            if (count > 0) dist[key] = count;
          }
        }

        return [field, dist];
      })
    );

    return distribution;
  }

  indexToSearchResult(index: TypedFastBitSet): SearchResult[] {
    return (
      this.db
        // use only idx in index
        .filter((_, i) => index.has(i))
        // Add Facet from facetIndexes
        .map((indexed) => {
          for (const [key, idx] of this.facetIndexes) {
            if (idx.has(indexed.id)) {
              const [field, value] = key.split(':', 2);

              if (indexed.data[field]) {
                if (Array.isArray(indexed.data[field])) {
                  (indexed.data[field] as Array<Primitives>).push(value);
                } else {
                  indexed.data[field] = [
                    indexed.data[field] as Primitives,
                    value,
                  ];
                }
              } else {
                indexed.data[field] = value;
              }
            }
          }
          return indexed;
        })
        // build SearchResult object
        .map((d) => {
          return { score: 1, data: d.data };
        })
    );
  }

  search(options: SearchOptions = {}): FacetedSearchResult {
    const match: TypedFastBitSet = new TypedFastBitSet([...this.db.keys()]);

    if (options.facetFilters && options.facetFilters.length > 0) {
      this.applyFacetFilters(match, options.facetFilters);
    }

    // TODO add full text search
    // TODO add Geo search

    const results: FacetedSearchResult = {
      hits: this.indexToSearchResult(match),
      facetsDistribution: this.computeFacetDistribution(
        match,
        options.facets || this.facetingFields
      ),
    };

    return results;
  }

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
