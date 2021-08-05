import test, { ExecutionContext } from 'ava';
import TypedFastBitSet from 'typedfastbitset';

import { FacetedIndex, FacetFilter } from './facetedindex';

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

async function macroSearch(
  t: ExecutionContext,
  facetFilters: FacetFilter[],
  fields: string[],
  expected: number[]
) {
  const idx = new FacetedIndex({
    fields: fields,
  });

  idx.build(documents);

  const results = await idx.search(new TypedFastBitSet([0, 1, 2, 3]), {
    filters: facetFilters,
  });

  t.deepEqual(results.ids.array(), expected);
}

test(
  'facettingindex search basic',
  macroSearch,
  [new FacetFilter('review', ['good'])],
  ['category', 'random', 'review'],
  [0, 1]
);

test(
  'facettingindex search filter empty',
  macroSearch,
  [],
  ['category', 'random', 'review'],
  [0, 1, 2, 3]
);

test(
  'facettingindex search filter inexistent value',
  macroSearch,
  [new FacetFilter('review', ['awesome'])],
  ['category', 'random', 'review'],
  []
);

test(
  'facettingindex search multiple filters',
  macroSearch,
  [
    new FacetFilter('review', ['good']),
    new FacetFilter('random', ['toc']),
    new FacetFilter('category', ['fiction']),
  ],
  ['category', 'random', 'review'],
  [0]
);

test(
  'facettingindex search multiple values',
  macroSearch,
  [
    new FacetFilter('random', ['toc', 'tic', 'tac']),
    new FacetFilter('category', ['fiction']),
  ],
  ['category', 'random', 'review'],
  [0, 1, 2]
);

test(
  'facettingindex search multiple values with inexistent',
  macroSearch,
  [
    new FacetFilter('random', ['toc', 'tic', 'tac', 'tuc']),
    new FacetFilter('category', ['fiction']),
  ],
  ['category', 'random', 'review'],
  [0, 1, 2]
);

test(
  'facettingindex search array facet',
  macroSearch,
  [new FacetFilter('tags', ['motor', 'book'])],
  ['tags'],
  [0, 1, 2]
);

test(
  'facettingindex search array facet + simple filter',
  macroSearch,
  [
    new FacetFilter('tags', ['motor', 'book']),
    new FacetFilter('review', ['good']),
  ],
  ['review', 'tags'],
  [0, 1]
);

test('facettingindex postProcess', (t) => {
  const idx = new FacetedIndex({
    fields: ['category', 'random', 'review', 'tags'],
  });

  idx.build(documents);

  const fakeResults = {
    hits: [],
    meta: new Map(),
  };

  const results = idx.postProcess(
    new TypedFastBitSet([0, 1, 2, 3]),
    fakeResults,
    {
      filters: [],
    }
  );

  t.true(results.meta.has('facetting_distribution'));
  t.deepEqual(results.meta.get('facetting_distribution'), {
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
  });
});

test('facettingindex serialization', (t) => {
  const idx = new FacetedIndex({
    fields: ['category', 'random', 'review', 'tags'],
  });

  idx.build(documents);

  const po = idx.asPlainObject();

  const deserializedIdx = new FacetedIndex({
    fields: ['category', 'random', 'review', 'tags'],
  });
  deserializedIdx.load(po);

  t.deepEqual(deserializedIdx, idx);
});
