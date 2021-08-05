import TypedFastBitSet from 'typedfastbitset';

import { deserializeBitSet, serializeBitSet } from './bitsetserializer';
import { Index, IndexSearchResult, PlainObject, SearchResult } from './refine';

type Primitives = string | number | boolean;

export class FacetFilter {
  protected field: string;
  protected values: Primitives[];

  constructor(field: string, values: Primitives[]) {
    this.field = field;
    this.values = values;
  }

  facetIds(): string[] {
    return this.values.map((v) => `${this.field}:${v}`);
  }
}

export type SearchOptions = {
  filters?: FacetFilter[];
  distributionFields?: string[];
};

export type Distribution = Record<string, Record<string, number>>;

export class FacetedIndex implements Index {
  protected fields: string[];
  protected facetIndexes: Map<string, TypedFastBitSet>;

  constructor(options: { fields: string[] }) {
    this.fields = options.fields;
    this.facetIndexes = new Map();
  }

  build(documents: PlainObject[]): void {
    documents.forEach((doc, i) => {
      for (const field of this.fields) {
        const values: Primitives[] = Array.isArray(doc[field])
          ? (doc[field] as Primitives[])
          : ([doc[field]] as Primitives[]);

        values.forEach((v) => {
          const value: string = v?.toString();
          if (value) {
            const id = `${field}:${value}`;
            if (!this.facetIndexes.has(id)) {
              const bitset = new TypedFastBitSet();
              bitset.add(i);
              this.facetIndexes.set(id, bitset);
            } else {
              this.facetIndexes.get(id)?.add(i);
            }
          }
        });
      }
    });
  }

  async search(
    on: TypedFastBitSet,
    options: SearchOptions
  ): Promise<IndexSearchResult> {
    const facetIndexesIds = options.filters
      ?.filter((f) => f != undefined)
      .map((f) => f.facetIds());

    if (facetIndexesIds) {
      facetIndexesIds.forEach((facetIndexesId) => {
        const idx = facetIndexesId
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

        on.intersection(idx);
      });
    }
    return {
      ids: on,
    };
  }

  postProcess(
    on: TypedFastBitSet,
    results: SearchResult,
    options: SearchOptions
  ): SearchResult {
    const indexes = new Map();
    const fields: string[] = options.distributionFields || this.fields;

    for (const [key, idx] of this.facetIndexes) {
      const [field, value] = key.split(':', 2);

      if (!indexes.has(field)) {
        indexes.set(field, new Map());
      }

      indexes.get(field).set(value, idx);
    }

    const distribution: PlainObject = Object.fromEntries(
      fields.map((field: string) => {
        const dist: { [facetValue: string]: number } = {};

        if (indexes.has(field)) {
          for (const [key, idx] of indexes.get(field)) {
            const count = on.new_intersection(idx).size();
            if (count > 0) dist[key] = count;
          }
        }

        return [field, dist];
      })
    );

    results.meta.set('facetting_distribution', distribution);

    return results;
  }

  asPlainObject(): PlainObject {
    const po: PlainObject = {};

    for (const [key, idx] of this.facetIndexes) {
      po[key] = serializeBitSet(idx);
    }

    return po;
  }

  load(raw: PlainObject): void {
    for (const [key, value] of Object.entries(raw)) {
      if (typeof value === 'string') {
        this.facetIndexes.set(key, deserializeBitSet(value));
      }
    }
  }
}
