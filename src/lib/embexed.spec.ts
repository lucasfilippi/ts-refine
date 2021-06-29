import test from 'ava';
import TypedFastBitSet from 'typedfastbitset';

import {
  Builder,
  Index,
  Indexable,
  IndexSearchResult,
  Metadata,
} from './embexed';

function shallowEqual(object1: Indexable, object2: Indexable) {
  const keys1 = Object.keys(object1);
  const keys2 = Object.keys(object2);

  if (keys1.length !== keys2.length) {
    return false;
  }

  for (const key of keys1) {
    if (Array.isArray(object1[key])) {
      const array1 = object1[key] as string[] | number[];
      const array2 = object2[key] as string[] | number[];
      array1.length === array2.length &&
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        array1.every((value, index) => value === array2[index]);
    } else if (object1[key] !== object2[key]) {
      return false;
    }
  }

  return true;
}

// Create a Index which always return every id
class IdentityIndex implements Index {
  key = 'identity';
  index: TypedFastBitSet = new TypedFastBitSet();

  build(documents: Indexable[]): void {
    this.index = new TypedFastBitSet([...documents.keys()]);
  }

  async search(): Promise<IndexSearchResult> {
    return {
      ids: this.index,
      // metadata?: Map<number, Metadata>; // ids indexed metadata
    };
  }
  serialize(): string {
    return '';
  }
}

class EvenIndex implements Index {
  key = 'even';
  index: TypedFastBitSet = new TypedFastBitSet();

  build(documents: Indexable[]): void {
    this.index = new TypedFastBitSet(
      [...documents.keys()].filter((k) => k % 2 === 0)
    );
  }

  async search(): Promise<IndexSearchResult> {
    const metadata = new Map<number, Metadata>();

    this.index.array().forEach((i) => metadata.set(i, { dumb: 1 }));

    return {
      ids: this.index,
      metadata: metadata, // ids indexed metadata
    };
  }
  serialize(): string {
    return '';
  }
}

class OddIndex implements Index {
  key = 'odd';
  index: TypedFastBitSet = new TypedFastBitSet();

  build(documents: Indexable[]): void {
    this.index = new TypedFastBitSet(
      [...documents.keys()].filter((k) => k % 2 === 1)
    );
  }

  async search(): Promise<IndexSearchResult> {
    return {
      ids: this.index,
      // metadata?: Map<number, Metadata>; // ids indexed metadata
    };
  }
  serialize(): string {
    return '';
  }
}

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

test('embexed build', async (t) => {
  const builder = new Builder({ storedFields: ['name', 'tags'] });
  builder.addIndex(new IdentityIndex());

  builder.addDocuments(pointOfInterest);
  const embexed = builder.build();
  const all = await embexed.search({
    identity: {},
  });
  t.deepEqual(all.hits.length, pointOfInterest.length);

  const filteredPointOfInterest = [
    {
      name: 'Le louvre',
      tags: ['museum', 'monument'],
    },
    {
      name: 'Arc de Triomphe',
      tags: ['monument'],
    },
    {
      name: 'Le sacré coeur',
      tags: ['monument', 'church'],
    },
    {
      name: 'Père-lachaise',
      tags: ['place', 'graveyard'],
    },
    {
      name: 'Disneyland paris',
      tags: ['park', 'amusement'],
    },
    {
      name: 'Notre dame de reims',
      tags: ['church'],
    },
    {
      name: 'Memorial Verdun',
      tags: ['place', 'graveyard'],
    },
    {
      name: 'Notre dame de Strasbourg',
      tags: ['church'],
    },
  ];

  all.hits.forEach((hit) => {
    t.true(
      filteredPointOfInterest.some((item) => shallowEqual(item, hit.data))
    );
  });
});

test('embexed basic search', async (t) => {
  const builder = new Builder();
  builder.addIndex(new IdentityIndex());
  builder.addIndex(new EvenIndex());

  builder.addDocuments(pointOfInterest);
  const embexed = builder.build();

  const all = await embexed.search({
    identity: {},
  });

  t.deepEqual(all.hits.length, pointOfInterest.length);
  all.hits.forEach((hit) => {
    t.true(pointOfInterest.some((item) => shallowEqual(item, hit.data)));
  });

  const even = await embexed.search({
    even: {},
  });

  t.deepEqual(even.hits.length, pointOfInterest.length / 2);
  even.hits.forEach((hit) => {
    t.true(pointOfInterest.some((item) => shallowEqual(item, hit.data)));
    t.deepEqual(hit.meta, { dumb: 1 });
  });

  const both = await embexed.search({
    even: {},
    identity: {},
  });

  t.deepEqual(both.hits.length, pointOfInterest.length / 2);
  both.hits.forEach((hit) => {
    t.true(pointOfInterest.some((item) => shallowEqual(item, hit.data)));
  });
});
