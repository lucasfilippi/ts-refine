import test, { ExecutionContext } from 'ava';
import { SearchResult } from 'minisearch';

import MiniFacet, { FacetFilter, FacetsDistribution } from './minifacet';

function macroApplyFacetFilters(
  t: ExecutionContext,
  hits: SearchResult[],
  facetFilters: FacetFilter[],
  expected: SearchResult[]
) {
  const minifacet = new MiniFacet(
    {
      fields: ['title', 'text'],
      storeFields: ['title', 'category'],
    },
    ['key1', 'key2', 'key3']
  );

  const filtered = minifacet.applyFacetFilters(hits, facetFilters);

  t.deepEqual(expected, filtered);
}

const r1 = {
  id: '1',
  terms: ['a', 'b'],
  score: 1,
  match: {},
  key1: 'val1',
  key2: 2,
  key3: true,
  key4: ['attr1', 'attr2'],
};
const r2 = {
  id: '2',
  terms: ['a', 'b'],
  score: 1,
  match: {},
  key1: 'val2',
  key2: 2,
  key3: true,
  key4: ['attr3'],
};
const r3 = {
  id: '3',
  terms: ['a', 'b'],
  score: 1,
  match: {},
  key1: 'val1',
  key2: 2,
  key3: false,
  key4: ['attr1', 'attr3'],
};
const r4 = {
  id: '4',
  terms: ['a', 'b'],
  score: 1,
  match: {},
  key1: 'val1',
  key2: 3,
  key3: true,
  key4: ['attr4', 'attr2'],
};

test(
  'applyFacetFilters basic',
  macroApplyFacetFilters,
  [r1, r2, r3],
  [{ name: 'key1', values: ['val1'] }],
  [r1, r3]
);

test(
  'applyFacetFilters filter empty',
  macroApplyFacetFilters,
  [r1, r2, r3],
  [],
  [r1, r2, r3]
);

test(
  'applyFacetFilters multiple filters',
  macroApplyFacetFilters,
  [r1, r2, r3, r4],
  [
    { name: 'key1', values: ['val1'] },
    { name: 'key2', values: [2] },
    { name: 'key3', values: [true] },
  ],
  [r1]
);

test(
  'applyFacetFilters multiple values',
  macroApplyFacetFilters,
  [r1, r2, r3, r4],
  [
    { name: 'key1', values: ['val1'] },
    { name: 'key2', values: [2, 3] },
    { name: 'key3', values: [true] },
  ],
  [r1, r4]
);

function macroComputeFacetDistribution(
  t: ExecutionContext,
  attr: string[],
  hits: SearchResult[],
  expected: FacetsDistribution
) {
  const minifacet = new MiniFacet(
    {
      fields: ['title', 'text'],
      storeFields: ['title', 'category'],
    },
    attr
  );

  const distribution = minifacet.computeFacetDistribution(hits, attr);

  // t.log(distribution);
  t.deepEqual(expected, distribution);
}

test(
  'computeFacetDistribution basics',
  macroComputeFacetDistribution,
  ['key1', 'key2', 'key3'],
  [r1, r2, r3, r4],
  {
    key1: {
      val1: 3,
      val2: 1,
    },
    key2: {
      2: 3,
      3: 1,
    },
    key3: {
      true: 3,
      false: 1,
    },
  }
);

test(
  'computeFacetDistribution array',
  macroComputeFacetDistribution,
  ['key1', 'key2', 'key3', 'key4'],
  [r1, r2, r3, r4],
  {
    key1: {
      val1: 3,
      val2: 1,
    },
    key2: {
      2: 3,
      3: 1,
    },
    key3: {
      true: 3,
      false: 1,
    },
    key4: {
      attr1: 2,
      attr2: 2,
      attr3: 2,
      attr4: 1,
    },
  }
);

test('facetedSearch', (t) => {
  const minifacet = new MiniFacet(
    {
      fields: ['title', 'text'],
      storeFields: ['title', 'category', 'random', 'tag'],
    },
    ['category', 'random', 'tag']
  );

  const documents = [
    {
      id: 1,
      title: 'Zen Mobs Dick',
      text: 'Call me Ishmael. Some years ago...',
      category: 'fiction',
      random: 'toc',
      tag: 'good',
    },
    {
      id: 2,
      title: 'Zen and the Art of Motorcycle Maintenance',
      text: 'I can see by my watch...',
      category: 'fiction',
      random: 'tic',
      tag: 'good',
    },
    {
      id: 3,
      title: 'Zen Necromancer',
      text: 'The sky above the port was...',
      category: 'fiction',
      random: 'tac',
      tag: 'neutral',
    },
    {
      id: 4,
      title: 'Zen and the Art of Archery',
      text: 'At first sight it must seem...',
      category: 'non-fiction',
      random: 'toc',
      tag: 'bad',
    },
  ];
  // Add documents to the index
  minifacet.addAll(documents);

  // Search for documents:
  const results = minifacet.facetedSearch('zen', {
    boost: { title: 2 },
    facetFilters: [{ name: 'category', values: ['fiction'] }],
  });
  t.is(3, results.nbHits);
  t.deepEqual(
    {
      category: {
        fiction: 3,
      },
      random: {
        tac: 1,
        tic: 1,
        toc: 1,
      },
      tag: {
        good: 2,
        neutral: 1,
      },
    },
    results.facetsDistribution
  );
});
