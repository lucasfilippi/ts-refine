import {
  Options as MiniSearchOptions,
  SearchOptions,
  SearchResult,
} from 'minisearch';
import MiniSearch from 'minisearch';

export type FacetFilter = {
  readonly name: string;
  readonly values: readonly (string | number | boolean)[];
};

export type FacetedSearchOptions = SearchOptions & {
  readonly facets?: string[];
  facetFilters?: FacetFilter[];
};

export type FacetsDistribution = {
  readonly [facetName: string]: { [facetValue: string]: number };
};

export type FacetedSearchResult = {
  readonly hits: readonly SearchResult[];
  readonly nbHits: number;
  readonly facetsDistribution: FacetsDistribution;
};

export type Options<T> = MiniSearchOptions<T> & {
  facetingFields: string[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class MiniFacet<T = any> extends MiniSearch {
  protected _facetingFields: string[];

  constructor(options: Options<T>) {
    super(options);
    this._facetingFields = options.facetingFields;
  }

  facetedSearch(
    queryString: string,
    searchOptions: FacetedSearchOptions = {}
  ): FacetedSearchResult {
    const msResults = this.applyFacetFilters(
      super.search(queryString, searchOptions),
      searchOptions.facetFilters
    );

    const results: FacetedSearchResult = {
      hits: msResults,
      nbHits: msResults.length,
      facetsDistribution: this.computeFacetDistribution(
        msResults,
        searchOptions.facets || this._facetingFields
      ),
    };

    return results;
  }

  applyFacetFilters(
    hits: SearchResult[],
    facetFilters?: FacetFilter[]
  ): SearchResult[] {
    if (!facetFilters || facetFilters.length === 0) {
      return hits;
    }

    return hits.filter((r: SearchResult) => {
      for (const filter of facetFilters) {
        if (!r[filter.name] || !filter.values.includes(r[filter.name]))
          return false;
      }
      return true;
    });
  }

  computeFacetDistribution(
    hits: SearchResult[],
    facetingFields: string[]
  ): FacetsDistribution {
    const distribution: FacetsDistribution = Object.fromEntries(
      facetingFields.map((a: string) => [a, {}])
    );

    hits.forEach((hit: SearchResult) => {
      for (const field of facetingFields) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const values: any[] = Array.isArray(hit[field])
          ? hit[field]
          : [hit[field]];

        values.forEach((value) => {
          if (!(value in distribution[field])) {
            distribution[field][value] = 1;
          } else {
            distribution[field][value]++;
          }
        });
      }
    });

    return distribution;
  }
}
