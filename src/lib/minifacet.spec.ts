import test, { ExecutionContext } from 'ava';
// import { Options } from 'minisearch';
import TypedFastBitSet from 'typedfastbitset';

import {
  FacetedSearchResult,
  FacetFilter,
  FacetsDistribution,
  Indexable,
  MiniFacet,
  Options,
  Primitives,
  SearchOptions,
  SearchResult,
} from './minifacet';

const documents = [
  {
    id: 1,
    title: 'Mobs Dick',
    text: 'Call me Ishmael. Some years ago...',
    category: 'fiction',
    random: 'toc',
    review: 'good',
    tags: ['book', 'cool'],
  },
  {
    id: 2,
    title: 'Zen and the Art of Motorcycle Maintenance',
    text: 'I can see by my watch...',
    category: 'fiction',
    random: 'tic',
    review: 'good',
    tags: ['film', 'motor'],
  },
  {
    id: 3,
    title: 'Necromancer',
    text: 'The sky above the port was...',
    category: 'fiction',
    random: 'tac',
    review: 'neutral',
    tags: ['book', 'dark'],
  },
  {
    id: 4,
    title: 'Zen and the Art of Archery',
    text: 'At first sight it must seem...',
    category: 'non-fiction',
    random: 'toc',
    review: 'bad',
    tags: ['film', 'dark'],
  },
];

test('compile', (t) => {
  const minifacet = new MiniFacet({
    storedField: ['id', 'title'],
    facetingFields: ['category', 'random', 'review'],
  });

  minifacet.add(documents);
  minifacet.compile();

  t.deepEqual(minifacet.database, [
    {
      id: 1,
      title: 'Mobs Dick',
    },
    {
      id: 2,
      title: 'Zen and the Art of Motorcycle Maintenance',
    },
    {
      id: 3,
      title: 'Necromancer',
    },
    {
      id: 4,
      title: 'Zen and the Art of Archery',
    },
  ]);
});

function macroApplyFacetFilters(
  t: ExecutionContext,
  facetFilters: FacetFilter[],
  facetingFields: string[],
  expected: number[]
) {
  const minifacet = new MiniFacet({
    facetingFields: facetingFields,
    storedField: [
      'id',
      'title',
      'text',
      'category',
      'random',
      'review',
      'tags',
    ],
  });

  minifacet.add(documents);
  minifacet.compile();

  const filtered = minifacet.applyFacetFilters(
    new TypedFastBitSet([0, 1, 2, 3]),
    facetFilters
  );

  t.deepEqual(filtered.array(), expected);
}

test(
  'applyFacetFilters basic',
  macroApplyFacetFilters,
  [new FacetFilter('review', ['good'])],
  ['category', 'random', 'review'],
  [0, 1]
);

test(
  'applyFacetFilters filter empty',
  macroApplyFacetFilters,
  [],
  ['category', 'random', 'review'],
  [0, 1, 2, 3]
);

test(
  'applyFacetFilters filter inexistent value',
  macroApplyFacetFilters,
  [new FacetFilter('review', ['awesome'])],
  ['category', 'random', 'review'],
  []
);

test(
  'applyFacetFilters multiple filters',
  macroApplyFacetFilters,
  [
    new FacetFilter('review', ['good']),
    new FacetFilter('random', ['toc']),
    new FacetFilter('category', ['fiction']),
  ],
  ['category', 'random', 'review'],
  [0]
);

test(
  'applyFacetFilters multiple values',
  macroApplyFacetFilters,
  [
    new FacetFilter('random', ['toc', 'tic', 'tac']),
    new FacetFilter('category', ['fiction']),
  ],
  ['category', 'random', 'review'],
  [0, 1, 2]
);

test(
  'applyFacetFilters multiple values with inexistent',
  macroApplyFacetFilters,
  [
    new FacetFilter('random', ['toc', 'tic', 'tac', 'tuc']),
    new FacetFilter('category', ['fiction']),
  ],
  ['category', 'random', 'review'],
  [0, 1, 2]
);

test(
  'applyFacetFilters array facet',
  macroApplyFacetFilters,
  [new FacetFilter('tags', ['motor', 'book'])],
  ['tags'],
  [0, 1, 2]
);

test(
  'applyFacetFilters array facet + simple filter',
  macroApplyFacetFilters,
  [
    new FacetFilter('tags', ['motor', 'book']),
    new FacetFilter('review', ['good']),
  ],
  ['review', 'tags'],
  [0, 1]
);

function macroComputeFacetDistribution(
  t: ExecutionContext,
  attr: string[],
  hits: number[],
  expected: FacetsDistribution
) {
  const minifacet = new MiniFacet({
    facetingFields: attr,
    storedField: [
      'id',
      'title',
      'text',
      'category',
      'random',
      'review',
      'tags',
    ],
  });
  minifacet.add(documents);
  minifacet.compile();

  const distribution = minifacet.computeFacetDistribution(
    new TypedFastBitSet(hits),
    attr
  );

  // t.log(distribution);
  t.deepEqual(distribution, expected);
}

test(
  'computeFacetDistribution basics',
  macroComputeFacetDistribution,
  ['category', 'random', 'review'],
  [0, 1, 2, 3],
  {
    category: {
      fiction: 3,
      'non-fiction': 1,
    },
    random: {
      toc: 2,
      tic: 1,
      tac: 1,
    },
    review: {
      bad: 1,
      good: 2,
      neutral: 1,
    },
  }
);

test(
  'computeFacetDistribution with array attr',
  macroComputeFacetDistribution,
  ['category', 'random', 'review', 'tags'],
  [0, 1, 2, 3],
  {
    category: {
      fiction: 3,
      'non-fiction': 1,
    },
    random: {
      toc: 2,
      tic: 1,
      tac: 1,
    },
    review: {
      bad: 1,
      good: 2,
      neutral: 1,
    },
    tags: {
      book: 2,
      cool: 1,
      film: 2,
      motor: 1,
      dark: 2,
    },
  }
);

function shallowEqual(object1: SearchResult, object2: SearchResult) {
  if (object1.score !== object2.score) {
    return false;
  }

  const keys1 = Object.keys(object1.data);
  const keys2 = Object.keys(object2.data);

  if (keys1.length !== keys2.length) {
    return false;
  }

  for (const key of keys1) {
    if (Array.isArray(object1.data[key])) {
      const array1 = object1.data[key] as Array<Primitives>;
      const array2 = object2.data[key] as Array<Primitives>;
      array1.length === array2.length &&
        array1.every((value, index) => value === array2[index]);
    } else if (object1.data[key] !== object2.data[key]) {
      return false;
    }
  }

  return true;
}

test('indexToSearchResult', (t) => {
  const minifacet = new MiniFacet({
    storedField: [
      'id',
      'title',
      'text',
      'category',
      'random',
      'review',
      'tags',
    ],
    facetingFields: ['category', 'random', 'review', 'tags'],
  });

  minifacet.add(documents);
  minifacet.compile();

  const idx = new TypedFastBitSet([0, 1, 2, 3]);
  const searchResults = minifacet.indexToSearchResult(idx);

  t.deepEqual(searchResults.length, 4);

  const expectedResults: SearchResult[] = documents.map((d) => {
    d.tags = d.tags.map((x) => x);
    return {
      score: 1,
      data: d,
    };
  });

  // searchResults.forEach((r) => t.log(r));
  // t.log('Expected');
  // expectedResults.forEach((r) => t.log(r));
  expectedResults.forEach((r) => {
    t.true(searchResults.some((item) => shallowEqual(item, r)));
  });
});

test('fullTextSearch', (t) => {
  const minifacet = new MiniFacet({
    storedField: [
      'id',
      'title',
      'text',
      'category',
      'random',
      'review',
      'tags',
    ],
    facetingFields: ['category', 'random', 'review', 'tags'],
    fullTextOptions: {
      fields: ['title', 'text'],
    },
  });

  minifacet.add(documents);
  minifacet.compile();

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const res = minifacet.fullTextSearch({ query: 'zen art motorcycle' });
  t.deepEqual(res.size(), 2);
  t.true(res.has(1));
  t.true(res.has(3));
});

function macroSearch(
  t: ExecutionContext,
  options: Options<Indexable>,
  searchOptions: SearchOptions,
  expected: FacetedSearchResult
) {
  const minifacet = new MiniFacet(options);

  minifacet.add(documents);
  minifacet.compile();

  const results = minifacet.search(searchOptions);

  // t.log(results.hits);
  t.deepEqual(results.hits.length, expected.hits.length);
  expected.hits.forEach((r) => {
    t.true(results.hits.some((item) => shallowEqual(item, r)));
  });

  t.deepEqual(results.facetsDistribution, expected.facetsDistribution);
}

test(
  'search all',
  macroSearch,
  {
    facetingFields: ['category', 'random', 'review', 'tags'],
    storedField: [
      'id',
      'title',
      'text',
      'category',
      'random',
      'review',
      'tags',
    ],
  },
  {},
  {
    hits: [
      {
        data: {
          category: 'fiction',
          id: 1,
          random: 'toc',
          review: 'good',
          tags: ['book', 'cool'],
          text: 'Call me Ishmael. Some years ago...',
          title: 'Mobs Dick',
        },
        score: 1,
      },
      {
        data: {
          category: 'fiction',
          id: 2,
          random: 'tic',
          review: 'good',
          tags: ['film', 'motor'],
          text: 'I can see by my watch...',
          title: 'Zen and the Art of Motorcycle Maintenance',
        },
        score: 1,
      },
      {
        data: {
          category: 'fiction',
          id: 3,
          random: 'tac',
          review: 'neutral',
          tags: ['book', 'dark'],
          text: 'The sky above the port was...',
          title: 'Necromancer',
        },
        score: 1,
      },
      {
        data: {
          category: 'non-fiction',
          id: 4,
          random: 'toc',
          review: 'bad',
          tags: ['film', 'dark'],
          text: 'At first sight it must seem...',
          title: 'Zen and the Art of Archery',
        },
        score: 1,
      },
    ],
    facetsDistribution: {
      category: {
        fiction: 3,
        'non-fiction': 1,
      },
      random: {
        toc: 2,
        tic: 1,
        tac: 1,
      },
      review: {
        bad: 1,
        good: 2,
        neutral: 1,
      },
      tags: {
        book: 2,
        cool: 1,
        film: 2,
        motor: 1,
        dark: 2,
      },
    },
  }
);

test(
  'search with facet filters',
  macroSearch,
  {
    facetingFields: ['category', 'random', 'review', 'tags'],
    storedField: [
      'id',
      'title',
      'text',
      'category',
      'random',
      'review',
      'tags',
    ],
  },
  { facetFilters: [new FacetFilter('tags', ['motor', 'book'])] },
  {
    hits: [
      {
        data: {
          category: 'fiction',
          id: 1,
          random: 'toc',
          review: 'good',
          tags: ['book', 'cool'],
          text: 'Call me Ishmael. Some years ago...',
          title: 'Mobs Dick',
        },
        score: 1,
      },
      {
        data: {
          category: 'fiction',
          id: 2,
          random: 'tic',
          review: 'good',
          tags: ['film', 'motor'],
          text: 'I can see by my watch...',
          title: 'Zen and the Art of Motorcycle Maintenance',
        },
        score: 1,
      },
      {
        data: {
          category: 'fiction',
          id: 3,
          random: 'tac',
          review: 'neutral',
          tags: ['book', 'dark'],
          text: 'The sky above the port was...',
          title: 'Necromancer',
        },
        score: 1,
      },
    ],
    facetsDistribution: {
      category: {
        fiction: 3,
      },
      random: {
        toc: 1,
        tic: 1,
        tac: 1,
      },
      review: {
        good: 2,
        neutral: 1,
      },
      tags: {
        book: 2,
        cool: 1,
        film: 1,
        motor: 1,
        dark: 1,
      },
    },
  }
);

test(
  'search with facet filters and facet restrictions',
  macroSearch,
  {
    facetingFields: ['category', 'random', 'review', 'tags'],
    storedField: [
      'id',
      'title',
      'text',
      'category',
      'random',
      'review',
      'tags',
    ],
  },
  {
    facets: ['category', 'tags'],
    facetFilters: [new FacetFilter('tags', ['motor', 'book'])],
  },
  {
    hits: [
      {
        data: {
          category: 'fiction',
          id: 1,
          random: 'toc',
          review: 'good',
          tags: ['book', 'cool'],
          text: 'Call me Ishmael. Some years ago...',
          title: 'Mobs Dick',
        },
        score: 1,
      },
      {
        data: {
          category: 'fiction',
          id: 2,
          random: 'tic',
          review: 'good',
          tags: ['film', 'motor'],
          text: 'I can see by my watch...',
          title: 'Zen and the Art of Motorcycle Maintenance',
        },
        score: 1,
      },
      {
        data: {
          category: 'fiction',
          id: 3,
          random: 'tac',
          review: 'neutral',
          tags: ['book', 'dark'],
          text: 'The sky above the port was...',
          title: 'Necromancer',
        },
        score: 1,
      },
    ],
    facetsDistribution: {
      category: {
        fiction: 3,
      },
      tags: {
        book: 2,
        cool: 1,
        film: 1,
        motor: 1,
        dark: 1,
      },
    },
  }
);

test(
  'search FullText',
  macroSearch,
  {
    facetingFields: ['category', 'random', 'review', 'tags'],
    storedField: [
      'id',
      'title',
      'text',
      'category',
      'random',
      'review',
      'tags',
    ],
    fullTextOptions: {
      fields: ['title', 'text'],
    },
  },
  {
    facets: ['category', 'tags'],
    facetFilters: [new FacetFilter('tags', ['motor', 'book'])],
    fullTextSearchOptions: { query: 'zen art motorcycle' },
  },
  {
    hits: [
      {
        data: {
          category: 'fiction',
          id: 2,
          random: 'tic',
          review: 'good',
          tags: ['film', 'motor'],
          text: 'I can see by my watch...',
          title: 'Zen and the Art of Motorcycle Maintenance',
        },
        score: 1,
      },
    ],
    facetsDistribution: {
      category: {
        fiction: 1,
      },
      tags: {
        film: 1,
        motor: 1,
      },
    },
  }
);
