import { Options, SearchOptions, SearchResult } from 'minisearch';
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default class MiniFacet<T = any> extends MiniSearch {
  protected _attributesForFaceting: string[];

  constructor(options: Options<T>, attributesForFaceting: string[]) {
    super(options);
    this._attributesForFaceting = attributesForFaceting;
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
        searchOptions.facets || this._attributesForFaceting
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
    attributesForFaceting: string[]
  ): FacetsDistribution {
    const distribution: FacetsDistribution = Object.fromEntries(
      attributesForFaceting.map((a: string) => [a, {}])
    );

    hits.forEach((hit: SearchResult) => {
      for (const attr of attributesForFaceting) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const values: any[] = Array.isArray(hit[attr])
          ? hit[attr]
          : [hit[attr]];

        values.forEach((value) => {
          if (!(value in distribution[attr])) {
            distribution[attr][value] = 1;
          } else {
            distribution[attr][value]++;
          }
        });
      }
    });

    return distribution;
  }
}
