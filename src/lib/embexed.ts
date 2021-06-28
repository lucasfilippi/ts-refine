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

export type Indexed = {
  id: number;
  data: Indexable;
};

// SEARCH
export type Metadata = {
  [metadata: string]: number | string | boolean;
};

export function mergeMetadata(m1: Metadata, m2: Metadata): Metadata {
  return Object.assign(m1, m2);
}

export type IndexSearchResult = {
  ids: TypedFastBitSet;
  resultMetadata?: Map<number, Metadata>; // ids indexed metadata
  searchMetadata?: Map<string, Metadata>; // Global metadata indexed by key to use in SearchResults
};

export type Hit = {
  data: Indexable;
  meta?: Metadata;
};

export type SearchResult = {
  hits: Hit[];
  meta?: Map<string, Metadata>; // Union of IndexSearchResult.searchMetadata
};

export type SearchOption = {
  [metadata: string]: unknown;
};

export interface Index {
  // add some documents to the index
  build(documents: Indexable[]): void;
  search(options: unknown): Promise<IndexSearchResult>;
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
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        promises.push(this.indexes.get(key)!.search(options[key]));
      }
    });

    const metadata = new Map();
    const resultMetadata: Map<number, Metadata> = new Map();

    if (promises.length > 0) {
      const results = await Promise.all(promises);

      for (const r of results) {
        //validate metada is not present or same as ids
        if (!r.resultMetadata || r.ids.size() === r.resultMetadata.size) {
          matches.intersection(r.ids);

          if (r.resultMetadata) {
            for (const [id, meta] of r.resultMetadata) {
              if (resultMetadata.has(id)) {
                resultMetadata.set(
                  id,
                  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                  mergeMetadata(resultMetadata.get(id)!, meta)
                );
              } else {
                resultMetadata.set(id, meta);
              }
            }
          }

          if (r.searchMetadata) {
            for (const [key, value] of r.searchMetadata) {
              metadata.set(key, value);
            }
          }
        }
      }
    }

    const results: SearchResult = {
      hits: matches.array().map((i) => {
        return {
          data: this.datastore[i],
          meta: resultMetadata.get(i),
        };
      }),
      meta: metadata,
    };

    return results;
  }

  serialize(): string {
    return '';
  }
}

export class Builder {
  protected indexes: Index[];
  protected datastore: Indexable[];

  constructor() {
    this.indexes = [];
    this.datastore = [];
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

    return new Embexed(this.datastore, indexes);
  }
}
