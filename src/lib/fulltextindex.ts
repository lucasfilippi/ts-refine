import MiniSearch, {
  Options as MiniSearchOptions,
  SearchOptions as MiniSearchSearchOptions,
} from 'minisearch';
import TypedFastBitSet from 'typedfastbitset';

import { Index, Indexable, IndexSearchResult, Metadata } from './embexed';

export type FullTextSearchOptions = MiniSearchSearchOptions & {
  query: string;
};

export class FullTextIndex implements Index {
  key = 'fulltext';
  protected minisearch: MiniSearch;

  constructor(options: MiniSearchOptions<Indexable>) {
    delete options.storeFields;
    // use our internal id, see compile method
    options.idField = '_internalId';
    this.minisearch = new MiniSearch<Indexable>(options);
  }

  // add some documents to the index
  build(documents: Indexable[]): void {
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

    const metadata = new Map<number, Metadata>();
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

  serialize(): string {
    return '';
  }
}
