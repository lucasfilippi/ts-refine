import MiniSearch, {
  Options as MiniSearchOptions,
  SearchOptions as MiniSearchSearchOptions,
} from 'minisearch';
import TypedFastBitSet from 'typedfastbitset';

import { GeoKDBush } from './geokdbush';

export type Primitives = string | number | boolean;
export interface Indexable {
  [attr: string]: Primitives | Primitives[];
}

interface Indexed {
  id: number;
  data: Indexable;
  raw?: Indexable;
}

export type FullTextSearchOptions = MiniSearchSearchOptions & {
  query: string;
};

/* GEO START */
export type Coordinates = [long: number, lat: number];

enum GeoOperationKind {
  GeoWithinSphere = 1,
  GeoWithinBox,
  GeoAround,
}

export interface GeoOperation {
  kind: GeoOperationKind;
  execute(index: GeoKDBush<Coordinates>): number[];
}

export class GeoWithinSphere implements GeoOperation {
  kind = GeoOperationKind.GeoWithinSphere;
  protected center: Coordinates;
  protected radius: number;

  constructor(center: Coordinates, radius: number) {
    this.center = center;
    this.radius = radius;
  }

  execute(index: GeoKDBush<Coordinates>): number[] {
    return index.within(this.center[0], this.center[1], this.radius);
  }
}
export class GeoWithinBox implements GeoOperation {
  kind = GeoOperationKind.GeoWithinBox;
  protected min: Coordinates;
  protected max: Coordinates;

  constructor(min: Coordinates, max: Coordinates) {
    this.min = min;
    this.max = max;
  }

  execute(index: GeoKDBush<Coordinates>): number[] {
    return index.range(this.min[0], this.min[1], this.max[0], this.max[1]);
  }
}

export class GeoAround implements GeoOperation {
  kind = GeoOperationKind.GeoAround;
  protected center: Coordinates;
  protected radius?: number;
  protected maxResults?: number;

  constructor(center: Coordinates, radius?: number, maxResults?: number) {
    this.center = center;
    this.radius = radius;
    this.maxResults = maxResults;
  }

  execute(index: GeoKDBush<Coordinates>): number[] {
    return index.around(
      this.center[0],
      this.center[1],
      this.maxResults,
      this.radius
    );
  }
}

export type GeoSearchOptions = {
  [field: string]: GeoOperation;
};
/* GEO END */

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
export type SearchOptions = {
  // Return only this facet. If not specified every available facet will be computed
  readonly facets?: string[];
  // Filter results on Facets
  facetFilters?: FacetFilter[];
  // Specify a full text search
  fullTextSearchOptions?: FullTextSearchOptions;
  geoSearchOptions?: GeoSearchOptions;
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

// Option construct
export type Options<T> = {
  facetingFields: string[];
  storedFields: string[];
  fullTextOptions?: MiniSearchOptions<T>;
  //Each geoField must be a Coordinates instance
  geoFields?: string[];
};

export class MiniFacet<T extends Indexable> {
  protected minisearch?: MiniSearch;
  protected storedFields: string[];
  protected db: Indexed[];
  protected raw: T[];
  protected facetingFields: string[];
  protected facetIndexes: Map<string, TypedFastBitSet>;
  protected geoFields: string[];
  protected geoIndexes: Map<string, GeoKDBush<Coordinates>>;

  constructor(options: Options<T>) {
    this.facetingFields = options.facetingFields;
    this.storedFields = options.storedFields.filter(
      (f) => !this.facetingFields.includes(f)
    );
    // minisearch do not store any data
    if (options.fullTextOptions) {
      // force minisearch to not stored anything
      delete options.fullTextOptions.storeFields;
      // use our internal id, see compile method
      options.fullTextOptions.idField = '_minifacetId';
      this.minisearch = new MiniSearch<T>(options.fullTextOptions);
    }
    this.db = [];
    this.raw = [];
    this.facetIndexes = new Map();

    this.geoFields = options.geoFields || [];
    this.geoIndexes = new Map();
  }

  get database(): Indexable[] {
    return this.db.map((indexed) => indexed.data);
  }

  /**
   * Adds all the given documents to the internal db
   * This method can be called multiple times before calling compile
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
    // Compute facets bitmap indexes
    this.buildFacetIndexes();

    // filter raw to store in db
    this.db = this.raw.map((d, i) => {
      const o = Object.keys(d)
        .filter((key) => this.storedFields.includes(key))
        .reduce((obj: Indexable, key) => {
          obj[key] = d[key];
          return obj as T;
        }, {});
      return { id: i, data: o, raw: d };
    });

    // reset raw
    this.raw = [];

    // Add to minisearch index
    if (this.minisearch) {
      this.minisearch.addAll(
        this.db.map((indexed) => {
          return { ...indexed.raw, _minifacetId: indexed.id };
        })
      );
    }

    // Add to geo indexes
    for (const field of this.geoFields) {
      this.geoIndexes.set(
        field,
        new GeoKDBush<Coordinates>(
          this.db.map((d) => {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            return d.raw![field] as Coordinates;
          })
        )
      );
    }

    // cleanup db from raw fields
    this.db.forEach((d) => delete d.raw);
  }

  async applyFacetFilters(
    on: TypedFastBitSet,
    facetFilters: FacetFilter[]
  ): Promise<TypedFastBitSet> {
    const hits = on.clone();
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

  protected async fullTextSearch(
    options: FullTextSearchOptions
  ): Promise<TypedFastBitSet> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const results = this.minisearch!.search(options.query, options);

    return new TypedFastBitSet(results.map((r) => r.id));
  }

  protected async geoSearch(
    index: GeoKDBush<Coordinates>,
    operation: GeoOperation
  ): Promise<TypedFastBitSet> {
    return new TypedFastBitSet(operation.execute(index));
  }

  computeFacetDistribution(
    hits: TypedFastBitSet,
    fields: string[]
  ): FacetsDistribution {
    const indexes = new Map();

    for (const [key, idx] of this.facetIndexes) {
      const [field, value] = key.split(':', 2);

      if (fields.includes(field)) {
        if (!indexes.has(field)) {
          indexes.set(field, new Map());
        }

        indexes.get(field).set(value, idx);
      }
    }

    const distribution: FacetsDistribution = Object.fromEntries(
      fields.map((field: string) => {
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

  async search(options: SearchOptions = {}): Promise<FacetedSearchResult> {
    const promises: Promise<TypedFastBitSet>[] = [];
    const matches = new TypedFastBitSet([...this.db.keys()]);

    if (options.facetFilters && options.facetFilters.length > 0) {
      promises.push(this.applyFacetFilters(matches, options.facetFilters));
    }

    if (options.fullTextSearchOptions && this.minisearch) {
      promises.push(this.fullTextSearch(options.fullTextSearchOptions));
    }

    if (options.geoSearchOptions) {
      for (const [indexName, geoOperation] of Object.entries(
        options.geoSearchOptions
      )) {
        if (this.geoIndexes.has(indexName)) {
          promises.push(
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            this.geoSearch(this.geoIndexes.get(indexName)!, geoOperation)
          );
        }
      }
    }

    if (promises.length > 0) {
      const bitsets = await Promise.all(promises);

      for (const bitset of bitsets) {
        matches.intersection(bitset);
      }
    }

    const results: FacetedSearchResult = {
      hits: this.indexToSearchResult(matches),
      facetsDistribution: this.computeFacetDistribution(
        matches,
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
