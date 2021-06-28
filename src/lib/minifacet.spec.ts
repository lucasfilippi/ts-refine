import test, { ExecutionContext } from 'ava';
import TypedFastBitSet from 'typedfastbitset';

import {
  FacetedSearchResult,
  FacetFilter,
  FacetsDistribution,
  GeoWithinBox,
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
    storedFields: ['id', 'title'],
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

async function macroApplyFacetFilters(
  t: ExecutionContext,
  facetFilters: FacetFilter[],
  facetingFields: string[],
  expected: number[]
) {
  const minifacet = new MiniFacet({
    facetingFields: facetingFields,
    storedFields: [
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

  const filtered = await minifacet.applyFacetFilters(
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
    storedFields: [
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
    storedFields: [
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

test('fullTextSearch', async (t) => {
  const minifacet = new MiniFacet({
    storedFields: [
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
  const res = await minifacet.fullTextSearch({ query: 'zen art motorcycle' });
  t.deepEqual(res.size(), 2);
  t.true(res.has(1));
  t.true(res.has(3));
});

async function macroSearch(
  t: ExecutionContext,
  options: Options<Indexable>,
  searchOptions: SearchOptions,
  expected: FacetedSearchResult,
  documents: Indexable[]
) {
  const minifacet = new MiniFacet(options);

  minifacet.add(documents);
  minifacet.compile();

  const results = await minifacet.search(searchOptions);

  // results.hits.forEach((h) => t.log(h));
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
    storedFields: [
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
  },
  documents
);

test(
  'search with facet filters',
  macroSearch,
  {
    facetingFields: ['category', 'random', 'review', 'tags'],
    storedFields: [
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
  },
  documents
);

test(
  'search with facet filters and facet restrictions',
  macroSearch,
  {
    facetingFields: ['category', 'random', 'review', 'tags'],
    storedFields: [
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
  },
  documents
);

test(
  'search FullText',
  macroSearch,
  {
    facetingFields: ['category', 'random', 'review', 'tags'],
    storedFields: [
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
  },
  documents
);

const pointOfInterest = [
  {
    name: 'Le louvre',
    description: `Le musée du Louvre est un musée situé dans le 1ᵉʳ arrondissement de Paris, en France. Une préfiguration en est imaginée en 1775-1776 par le comte d'Angiviller, directeur général des Bâtiments du roi, comme lieu de présentation des chefs-d'œuvre de la collection de la Couronne.`,
    coordinates: [48.860052, 2.336072],
    tags: ['museum', 'monument'],
  },
  {
    name: 'Arc de Triomphe',
    description: `L'arc de triomphe de l’Étoile, souvent appelé simplement l'Arc de Triomphe, est un monument situé à Paris, en un point haut à la jonction des territoires des 8e, 16e et 17e arrondissements`,
    coordinates: [48.861697, 2.332939],
    tags: ['monument'],
  },
  {
    name: 'Le sacré coeur',
    description: `La basilique du Sacré-Cœur de Montmartre, dite du Vœu national, située au sommet de la butte Montmartre, dans le quartier de Clignancourt du 18e arrondissement de Paris (France), est un édifice religieux parisien majeur, « sanctuaire de l'adoration eucharistique et de la miséricorde divine » et propriété de l'archidiocèse de Paris1.`,
    coordinates: [48.886183, 2.34311],
    tags: ['monument', 'church'],
  },
  {
    name: 'Père-lachaise',
    description: `Le cimetière du Père-Lachaise est le plus grand cimetière parisien intra muros et l'un des plus célèbres dans le monde. Situé dans le 20ᵉ arrondissement, de nombreuses personnes célèbres y sont enterrées.`,
    coordinates: [48.85989, 2.389177],
    tags: ['place', 'graveyard'],
  },
  {
    name: 'Disneyland paris',
    description: `Disneyland Paris, anciennement Euro Disney Resort puis Disneyland Resort Paris, est un complexe touristique et urbain de 22,30 km² situé en sa majeure partie sur la commune de Chessy, à trente-deux kilomètres à l'est de Paris.`,
    coordinates: [48.867208, 2.783858],
    tags: ['park', 'amusement'],
  },
  {
    name: 'Notre dame de reims',
    description: `La cathédrale Notre-Dame de Reims, est une cathédrale catholique romaine située à Reims, dans le département français de la Marne en région Grand Est. Elle est connue pour avoir été, à partir du XIᵉ siècle, le lieu de la quasi-totalité des sacres des rois de France.`,
    coordinates: [49.253418, 4.033719],
    tags: ['church'],
  },
  {
    name: 'Memorial Verdun',
    description: `Le Mémorial de Verdun est un musée consacré à l'histoire et à la mémoire de la bataille de Verdun de 1916, situé à Fleury-devant-Douaumont, à quelques kilomètres de Verdun, dans le département de la Meuse en région Grand Est`,
    coordinates: [49.194235, 5.433743],
    tags: ['place', 'graveyard'],
  },
  {
    name: 'Notre dame de Strasbourg',
    description: `La cathédrale Notre-Dame de Strasbourg est une cathédrale gothique située à Strasbourg, dans la circonscription administrative du Bas-Rhin, sur le territoire de la collectivité européenne d'Alsace.`,
    coordinates: [48.581454, 7.750879],
    tags: ['church'],
  },
];

test('compile with geo indexes', (t) => {
  const minifacet = new MiniFacet({
    storedFields: ['name', 'coordinates'],
    facetingFields: ['tags'],
    geoFields: ['coordinates'],
  });

  minifacet.add(pointOfInterest);
  minifacet.compile();

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const geoIndexes = minifacet.geoIndexes;
  t.true(geoIndexes.has('coordinates'));
});

test(
  'search geo index',
  macroSearch,
  {
    storedFields: ['name', 'coordinates'],
    facetingFields: ['tags'],
    geoFields: ['coordinates'],
  },
  {
    facets: ['category', 'tags'],
    geoSearchOptions: {
      coordinates: new GeoWithinBox([48.86, 2.33], [48.87, 2.34]),
    },
  },
  {
    hits: [
      {
        data: {
          coordinates: [48.860052, 2.336072],
          name: 'Le louvre',
          tags: ['museum', 'monument'],
        },
        score: 1,
      },
      {
        data: {
          coordinates: [48.861697, 2.332939],
          name: 'Arc de Triomphe',
          tags: 'monument',
        },
        score: 1,
      },
    ],
    facetsDistribution: {
      category: {},
      tags: {
        museum: 1,
        monument: 2,
      },
    },
  },
  pointOfInterest
);

test(
  'search geo index, filter, fulltext',
  macroSearch,
  {
    storedFields: ['name', 'coordinates'],
    facetingFields: ['tags'],
    geoFields: ['coordinates'],
    fullTextOptions: {
      fields: ['name', 'description'],
    },
  },
  {
    facets: ['tags'],
    facetFilters: [new FacetFilter('tags', ['monument', 'book'])],
    geoSearchOptions: {
      coordinates: new GeoWithinBox([48, 2], [50, 3]),
    },
    fullTextSearchOptions: { query: 'Montmartre' },
  },
  {
    hits: [
      {
        data: {
          coordinates: [48.886183, 2.34311],
          // description: `La basilique du Sacré-Cœur de Montmartre, dite du Vœu national, située au sommet de la butte Montmartre, dans le quartier de Clignancourt du 18e arrondissement de Paris (France), est un édifice religieux parisien majeur, « sanctuaire de l'adoration eucharistique et de la miséricorde divine » et propriété de l'archidiocèse de Paris1.`,
          name: 'Le sacré coeur',
          tags: ['monument', 'church'],
        },
        score: 1,
      },
    ],
    facetsDistribution: {
      tags: {
        church: 1,
        monument: 1,
      },
    },
  },
  pointOfInterest
);

test('serialization', async (t) => {
  const m: Map<string, string> = new Map();
  m.set('ta', 'ta');
  m.set('to', 'to');
  m.set('ti', 'ti');
  m.set('tu', 'tu');
  t.log(JSON.stringify(m));
  t.pass();
});
