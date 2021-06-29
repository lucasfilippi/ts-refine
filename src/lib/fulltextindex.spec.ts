import test from 'ava';
import TypedFastBitSet from 'typedfastbitset';

import { FullTextIndex, FullTextSearchOptions } from './fulltextindex';

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

test('fullTextIndex ', async (t) => {
  const idx = new FullTextIndex({
    fields: ['title', 'text'],
  });

  idx.build(documents);

  const results = await idx.search(new TypedFastBitSet([0, 1, 2, 3]), {
    query: 'zen art motorcycle',
  });
  t.deepEqual(results.ids.size(), 2);
  t.true(results.ids.has(1));
  t.true(results.ids.has(3));
  t.deepEqual(results.metadata?.size, 2);
  t.deepEqual(results.metadata?.get(1)!.match, {
    art: ['title'],
    motorcycle: ['title'],
    zen: ['title'],
  });
  t.deepEqual(results.metadata?.get(1)!.terms, ['zen', 'art', 'motorcycle']);
  t.deepEqual(results.metadata?.get(3)!.match, {
    art: ['title'],
    zen: ['title'],
  });
  t.deepEqual(results.metadata?.get(3)!.terms, ['zen', 'art']);
});
