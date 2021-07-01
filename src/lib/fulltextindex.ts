import MiniSearch, {
  Options as MiniSearchOptions,
  SearchOptions as MiniSearchSearchOptions,
} from 'minisearch';
import TypedFastBitSet from 'typedfastbitset';

import { Index, IndexSearchResult, PlainObject } from './embexed';

export type FullTextSearchOptions = MiniSearchSearchOptions & {
  query: string;
};

export class FullTextIndex implements Index {
  protected minisearch: MiniSearch;

  constructor(options: MiniSearchOptions<PlainObject>) {
    delete options.storeFields;
    // use our internal id, see compile method
    options.idField = '_internalId';
    this.minisearch = new MiniSearch<PlainObject>(options);
  }

  // add some documents to the index
  build(documents: PlainObject[]): void {
    this.minisearch.addAll(
      documents.map((d, i) => {
        return { ...d, _internalId: i };
      })
    );
  }

  async search(
    on: TypedFastBitSet,
    options: FullTextSearchOptions
  ): Promise<IndexSearchResult> {
    const results = this.minisearch.search(options.query, options);

    const metadata = new Map<number, PlainObject>();
    results.forEach((r) => {
      metadata.set(r.id, {
        terms: r.terms,
        score: r.score,
        match: r.match,
      });
    });

    return {
      ids: on.new_intersection(new TypedFastBitSet(results.map((r) => r.id))),
      metadata: metadata,
    };
  }

  toJSON(): string {
    return '';
  }
}
