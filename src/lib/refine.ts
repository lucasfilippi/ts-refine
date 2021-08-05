import TypedFastBitSet from 'typedfastbitset';

export type PlainObjectValue =
  | undefined
  | null
  | number
  | string
  | boolean
  | PlainObjectValue[]
  | { [key: string]: PlainObjectValue };

export type PlainObject = {
  [key: string]: PlainObjectValue;
};

// SEARCH

export type IndexSearchResult = {
  ids: TypedFastBitSet;
  metadata?: Map<number, PlainObject>; // ids indexed metadata
};

export type Hit = {
  internalId: number;
  data: PlainObject;
  meta?: PlainObject;
};

export type SearchResult = {
  hits: Hit[];
  meta: Map<string, PlainObject>; // Union of IndexSearchResult.searchMetadata
};

export type SearchOption = {
  [metadata: string]: unknown;
};

export interface Index {
  // add some documents to the index
  build(documents: PlainObject[]): void;
  search(on: TypedFastBitSet, options: unknown): Promise<IndexSearchResult>;
  postProcess?(
    on: TypedFastBitSet,
    results: SearchResult,
    options: unknown
  ): SearchResult;
  load(raw: PlainObject): void;
  asPlainObject(): PlainObject;
}

export type Serialized = {
  datastore: PlainObject[];
  indexes: {
    [key: string]: PlainObject;
  };
};

export class Refine {
  protected indexes: Map<string, Index>;
  protected datastore: PlainObject[];

  constructor(datastore: PlainObject[], indexes: Map<string, Index>) {
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

    const metadata: Map<number, PlainObject> = new Map();

    if (promises.length > 0) {
      const results = await Promise.all(promises);

      for (const r of results) {
        //validate metadata is not present or here for every ids
        if (!r.metadata || r.ids.size() === r.metadata.size) {
          matches.intersection(r.ids);

          if (r.metadata) {
            for (const [id, meta] of r.metadata) {
              if (metadata.has(id)) {
                metadata.set(
                  id,
                  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                  Object.assign(metadata.get(id)!, meta)
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

  serialize(): Serialized {
    const indexes: {
      [key: string]: PlainObject;
    } = {};

    for (const [key, idx] of this.indexes) {
      indexes[key] = idx.asPlainObject();
    }

    return {
      datastore: this.datastore,
      indexes: indexes,
    };
  }
}

export class Builder {
  protected indexes: Map<string, Index>;
  protected storedFields?: string[];

  constructor(options?: { storedFields?: string[] }) {
    this.indexes = new Map();
    this.storedFields = options?.storedFields;
  }

  addIndex(key: string, index: Index) {
    this.indexes.set(key, index);
  }

  load(raw: Serialized): Refine {
    const indexes = new Map();
    for (const [key, i] of this.indexes) {
      if (raw.indexes[key]) {
        i.load(raw.indexes[key]);
      }
      indexes.set(key, i);
    }
    return new Refine(raw.datastore, indexes);
  }

  build(documents: PlainObject[]): Refine {
    const datastore: PlainObject[] = [];
    for (const d of documents) {
      datastore.push(d);
    }
    const indexes = new Map();

    for (const [key, i] of this.indexes) {
      i.build(datastore);
      indexes.set(key, i);
    }

    // filter datastore fields if necessary
    if (this.storedFields && this.storedFields.length > 0) {
      return new Refine(
        datastore.map((d) => {
          return (
            Object.keys(d)
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              .filter((key) => this.storedFields!.includes(key))
              .reduce((obj: PlainObject, key) => {
                obj[key] = d[key];
                return obj;
              }, {})
          );
        }),
        indexes
      );
    }

    return new Refine(datastore, indexes);
  }
}
