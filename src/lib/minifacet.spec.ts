import test, { ExecutionContext } from 'ava';
import TypedFastBitSet from 'typedfastbitset';
// import { SearchResult } from 'minisearch';

import {
  FacetFilter,
  // Indexable,
  FacetsDistribution,
  MiniFacet,
} from './minifacet';

const documents = [
  {
    id: 1,
    title: 'Zen Mobs Dick',
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
    title: 'Zen Necromancer',
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

function macroApplyFacetFilters(
  t: ExecutionContext,
  facetFilters: FacetFilter[],
  facetingFields: string[],
  expected: number[]
) {
  const minifacet = new MiniFacet({
    fields: ['title', 'text'],
    facetingFields: facetingFields,
  });

  minifacet.add(documents);
  minifacet.compile();

  const filtered = minifacet.applyFacetFilters(facetFilters);

  t.deepEqual(expected, filtered.array());
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

function macroComputeFacetDistribution(
  t: ExecutionContext,
  attr: string[],
  hits: number[],
  expected: FacetsDistribution
) {
  const minifacet = new MiniFacet({
    fields: ['title', 'text'],
    facetingFields: attr,
  });
  minifacet.add(documents);
  minifacet.compile();

  const distribution = minifacet.computeFacetDistribution(
    new TypedFastBitSet(hits),
    attr
  );

  // t.log(distribution);
  t.deepEqual(expected, distribution);
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

// test(
//   'computeFacetDistribution array',
//   macroComputeFacetDistribution,
//   ['key1', 'key2', 'key3', 'key4'],
//   [r1, r2, r3, r4],
//   {
//     key1: {
//       val1: 3,
//       val2: 1,
//     },
//     key2: {
//       2: 3,
//       3: 1,
//     },
//     key3: {
//       true: 3,
//       false: 1,
//     },
//     key4: {
//       attr1: 2,
//       attr2: 2,
//       attr3: 2,
//       attr4: 1,
//     },
//   }
// );

// test('facetedSearch', (t) => {
//   const minifacet = new MiniFacet({
//     fields: ['title', 'text'],
//     storeFields: ['title', 'category', 'random', 'review'],
//     facetingFields: ['category', 'random', 'review'],
//   });

//   const documents = [
//     {
//       id: 1,
//       title: 'Zen Mobs Dick',
//       text: 'Call me Ishmael. Some years ago...',
//       category: 'fiction',
//       random: 'toc',
//       review: 'good',
//     },
//     {
//       id: 2,
//       title: 'Zen and the Art of Motorcycle Maintenance',
//       text: 'I can see by my watch...',
//       category: 'fiction',
//       random: 'tic',
//       review: 'good',
//     },
//     {
//       id: 3,
//       title: 'Zen Necromancer',
//       text: 'The sky above the port was...',
//       category: 'fiction',
//       random: 'tac',
//       review: 'neutral',
//     },
//     {
//       id: 4,
//       title: 'Zen and the Art of Archery',
//       text: 'At first sight it must seem...',
//       category: 'non-fiction',
//       random: 'toc',
//       review: 'bad',
//     },
//   ];
//   // Add documents to the index
//   minifacet.add(documents);
//   minifacet.compile();

//   // Search for documents:
//   const results = minifacet.facetedSearch('zen', {
//     boost: { title: 2 },
//     facetFilters: [{ name: 'category', values: ['fiction'] }],
//   });
//   console.log(results);
//   t.is(3, results.nbHits);
//   t.deepEqual(
//     {
//       category: {
//         fiction: 3,
//       },
//       random: {
//         tac: 1,
//         tic: 1,
//         toc: 1,
//       },
//       review: {
//         good: 2,
//         neutral: 1,
//       },
//     },
//     results.facetsDistribution
//   );
// });
