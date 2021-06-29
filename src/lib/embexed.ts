import * as t from 'io-ts';
import TypedFastBitSet from 'typedfastbitset';

//INPUT Validation
const indexableCodec = t.record(
  t.string,
  t.union([
    t.undefined,
    t.null,
    t.string,
    t.number,
    t.boolean,
    t.array(t.string),
    t.array(t.number),
  ])
);
export type Indexable = t.TypeOf<typeof indexableCodec>;

export type BuilderOptions = {
  storedFields?: string[];
};

// SEARCH
export type Metadata = {
  [metadata: string]:
    | number
    | string
    | boolean
    | string[]
    | number[]
    | Metadata;
};

export function mergeMetadata(m1: Metadata, m2: Metadata): Metadata {
  return Object.assign(m1, m2);
}

export type IndexSearchResult = {
  ids: TypedFastBitSet;
  metadata?: Map<number, Metadata>; // ids indexed metadata
  // searchMetadata?: Map<string, Metadata>; // Global metadata indexed by key to use in SearchResults
};

export type Hit = {
  internalId: number;
  data: Indexable;
  meta?: Metadata;
};

export type SearchResult = {
  hits: Hit[];
  meta: Map<string, Metadata>; // Union of IndexSearchResult.searchMetadata
};

export type SearchOption = {
  [metadata: string]: unknown;
};

export interface Index {
  // add some documents to the index
  build(documents: Indexable[]): void;
  search(on: TypedFastBitSet, options: unknown): Promise<IndexSearchResult>;
  postProcess?(
    on: TypedFastBitSet,
    results: SearchResult,
    options: unknown
  ): SearchResult;
  serialize(): string;
  key: string;
}

export class Embexed {
  protected indexes: Map<string, Index>;
  protected datastore: Indexable[];

  constructor(datastore: Indexable[], indexes: Map<string, Index>) {
    this.indexes = indexes;
    this.datastore = datastore;
  }

  async search(options: SearchOption): Promise<SearchResult> {
    const promises: Promise<IndexSearchResult>[] = [];
    const matches = new TypedFastBitSet([...this.datastore.keys()]);

    Object.keys(options).forEach((key) => {
      if (this.indexes.has(key)) {
        promises.push(
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          this.indexes.get(key)!.search(matches.clone(), options[key])
        );
      }
    });

    const metadata: Map<number, Metadata> = new Map();

    if (promises.length > 0) {
      const results = await Promise.all(promises);

      for (const r of results) {
        //validate metada is not present or same as ids
        if (!r.metadata || r.ids.size() === r.metadata.size) {
          matches.intersection(r.ids);

          if (r.metadata) {
            for (const [id, meta] of r.metadata) {
              if (metadata.has(id)) {
                metadata.set(
                  id,
                  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                  mergeMetadata(metadata.get(id)!, meta)
                );
              } else {
                metadata.set(id, meta);
              }
            }
          }
        }
      }
    }

    let results: SearchResult = {
      hits: matches.array().map((i) => {
        return {
          internalId: i,
          data: this.datastore[i],
          meta: metadata.get(i),
        };
      }),
      meta: new Map(),
    };

    Object.keys(options).forEach((key) => {
      if (
        this.indexes.has(key) &&
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.indexes.get(key)!.postProcess !== undefined
      ) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        results = this.indexes.get(key)!.postProcess!(
          matches,
          results,
          options[key]
        );
      }
    });
    return results;
  }

  serialize(): string {
    return '';
  }
}

export class Builder {
  protected indexes: Index[];
  protected datastore: Indexable[];
  protected storedFields?: string[];

  constructor(options?: BuilderOptions) {
    this.indexes = [];
    this.datastore = [];
    this.storedFields = options?.storedFields;
  }

  addIndex(index: Index) {
    this.indexes.push(index);
  }

  addDocuments(documents: Indexable[]): void {
    this.datastore.push(...documents);
  }

  build(): Embexed {
    const indexes = new Map();

    this.indexes.forEach((i) => {
      i.build(this.datastore);
      indexes.set(i.key, i);
    });

    // filter datastore fields if necessary
    if (this.storedFields && this.storedFields.length > 0) {
      return new Embexed(
        this.datastore.map((d) => {
          return (
            Object.keys(d)
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              .filter((key) => this.storedFields!.includes(key))
              .reduce((obj: Indexable, key) => {
                obj[key] = d[key];
                return obj;
              }, {})
          );
        }),
        indexes
      );
    }

    return new Embexed(this.datastore, indexes);
  }
}
