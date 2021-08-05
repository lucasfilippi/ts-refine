import MiniSearch, {
  AsPlainObject,
  Options as MiniSearchOptions,
  SearchOptions as MiniSearchSearchOptions,
} from 'minisearch';
import TypedFastBitSet from 'typedfastbitset';

import { Index, IndexSearchResult, PlainObject } from './refine';

export type FullTextSearchOptions = MiniSearchSearchOptions & {
  query: string;
};

export class FullTextIndex implements Index {
  protected minisearch?: MiniSearch;
  protected options: MiniSearchOptions<PlainObject>;

  constructor(options: MiniSearchOptions<PlainObject>) {
    delete options.storeFields;
    this.options = options;
    // use our internal id, see compile method
    this.options.idField = '_internalId';
  }

  // add some documents to the index
  build(documents: PlainObject[]): void {
    this.minisearch = new MiniSearch<PlainObject>(this.options);
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
    if (!this.minisearch) {
      return { ids: on };
    }

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

  asPlainObject(): PlainObject {
    if (!this.minisearch) return {};
    return {
      minisearch: this.minisearch.toJSON(),
    };
  }

  /*
  index: { _tree: {}, _prefix: string },
  documentCount: number,
  nextId: number,
  documentIds: { [shortId: string]: any }
  fieldIds: { [fieldName: string]: number }
  fieldLength: { [shortId: string]: { [fieldId: string]: number } },
  averageFieldLength: { [fieldId: string]: number },
  storedFields: { [shortId: string]: any }
 */

  load(raw: PlainObject): void {
    if (raw.minisearch) {
      // Add validation ??
      this.minisearch = MiniSearch.loadJS(
        raw.minisearch as AsPlainObject,
        this.options
      );
    }
  }
}
