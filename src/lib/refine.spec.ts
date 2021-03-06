import test from 'ava';
import TypedFastBitSet from 'typedfastbitset';

import { deserializeBitSet, serializeBitSet } from './bitsetserializer';
import {
  Builder,
  Index,
  IndexSearchResult,
  PlainObject,
  SearchResult,
} from './refine';

function shallowEqual(object1: PlainObject, object2: PlainObject) {
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
  index: TypedFastBitSet = new TypedFastBitSet();

  build(documents: PlainObject[]): void {
    this.index = new TypedFastBitSet([...documents.keys()]);
  }

  async search(): Promise<IndexSearchResult> {
    const metadata = new Map<number, PlainObject>();

    this.index.array().forEach((i) => metadata.set(i, { dumber: 1 }));
    return {
      ids: this.index,
      metadata: metadata,
    };
  }

  postProcess(_on: TypedFastBitSet, results: SearchResult): SearchResult {
    results.meta.set('ident', { i1: 'value2', i2: 2 });
    return results;
  }

  asPlainObject(): PlainObject {
    return {
      index: serializeBitSet(this.index),
    };
  }

  load(raw: PlainObject): void {
    if (raw.index && typeof raw.index === 'string') {
      this.index = deserializeBitSet(raw.index);
    }
  }
}

class EvenIndex implements Index {
  index: TypedFastBitSet = new TypedFastBitSet();

  build(documents: PlainObject[]): void {
    this.index = new TypedFastBitSet(
      [...documents.keys()].filter((k) => k % 2 === 0)
    );
  }

  async search(): Promise<IndexSearchResult> {
    const metadata = new Map<number, PlainObject>();

    this.index.array().forEach((i) => metadata.set(i, { dumb: 1 }));

    return {
      ids: this.index,
      metadata: metadata, // ids indexed metadata
    };
  }

  postProcess(_on: TypedFastBitSet, results: SearchResult): SearchResult {
    results.meta.set('even', { m1: 'value1', m2: 1 });
    return results;
  }

  asPlainObject(): PlainObject {
    return {
      index: serializeBitSet(this.index),
    };
  }

  load(raw: PlainObject): void {
    if (raw.index && typeof raw.index === 'string') {
      this.index = deserializeBitSet(raw.index);
    }
  }
}

const pointOfInterest = [
  {
    name: 'Le louvre',
    description: `Le mus??e du Louvre est un mus??e situ?? dans le 1????? arrondissement de Paris, en France. Une pr??figuration en est imagin??e en 1775-1776 par le comte d'Angiviller, directeur g??n??ral des B??timents du roi, comme lieu de pr??sentation des chefs-d'??uvre de la collection de la Couronne.`,
    coordinates: [48.860052, 2.336072],
    tags: ['museum', 'monument'],
  },
  {
    name: 'Arc de Triomphe',
    description: `L'arc de triomphe de l?????toile, souvent appel?? simplement l'Arc de Triomphe, est un monument situ?? ?? Paris, en un point haut ?? la jonction des territoires des 8e, 16e et 17e arrondissements`,
    coordinates: [48.861697, 2.332939],
    tags: ['monument'],
  },
  {
    name: 'Le sacr?? coeur',
    description: `La basilique du Sacr??-C??ur de Montmartre, dite du V??u national, situ??e au sommet de la butte Montmartre, dans le quartier de Clignancourt du 18e arrondissement de Paris (France), est un ??difice religieux parisien majeur, ?? sanctuaire de l'adoration eucharistique et de la mis??ricorde divine ?? et propri??t?? de l'archidioc??se de Paris1.`,
    coordinates: [48.886183, 2.34311],
    tags: ['monument', 'church'],
  },
  {
    name: 'P??re-lachaise',
    description: `Le cimeti??re du P??re-Lachaise est le plus grand cimeti??re parisien intra muros et l'un des plus c??l??bres dans le monde. Situ?? dans le 20??? arrondissement, de nombreuses personnes c??l??bres y sont enterr??es.`,
    coordinates: [48.85989, 2.389177],
    tags: ['place', 'graveyard'],
  },
  {
    name: 'Disneyland paris',
    description: `Disneyland Paris, anciennement Euro Disney Resort puis Disneyland Resort Paris, est un complexe touristique et urbain de 22,30 km?? situ?? en sa majeure partie sur la commune de Chessy, ?? trente-deux kilom??tres ?? l'est de Paris.`,
    coordinates: [48.867208, 2.783858],
    tags: ['park', 'amusement'],
  },
  {
    name: 'Notre dame de reims',
    description: `La cath??drale Notre-Dame de Reims, est une cath??drale catholique romaine situ??e ?? Reims, dans le d??partement fran??ais de la Marne en r??gion Grand Est. Elle est connue pour avoir ??t??, ?? partir du XI??? si??cle, le lieu de la quasi-totalit?? des sacres des rois de France.`,
    coordinates: [49.253418, 4.033719],
    tags: ['church'],
  },
  {
    name: 'Memorial Verdun',
    description: `Le M??morial de Verdun est un mus??e consacr?? ?? l'histoire et ?? la m??moire de la bataille de Verdun de 1916, situ?? ?? Fleury-devant-Douaumont, ?? quelques kilom??tres de Verdun, dans le d??partement de la Meuse en r??gion Grand Est`,
    coordinates: [49.194235, 5.433743],
    tags: ['place', 'graveyard'],
  },
  {
    name: 'Notre dame de Strasbourg',
    description: `La cath??drale Notre-Dame de Strasbourg est une cath??drale gothique situ??e ?? Strasbourg, dans la circonscription administrative du Bas-Rhin, sur le territoire de la collectivit?? europ??enne d'Alsace.`,
    coordinates: [48.581454, 7.750879],
    tags: ['church'],
  },
];

test('embexed build', async (t) => {
  const builder = new Builder({ storedFields: ['name', 'tags'] });
  builder.addIndex('identity', new IdentityIndex());

  const embexed = builder.build(pointOfInterest);
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
      name: 'Le sacr?? coeur',
      tags: ['monument', 'church'],
    },
    {
      name: 'P??re-lachaise',
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

test('embexed no index', async (t) => {
  const builder = new Builder();
  builder.addIndex('identity', new IdentityIndex());
  builder.addIndex('even', new EvenIndex());

  const embexed = builder.build(pointOfInterest);

  const all = await embexed.search({});

  t.deepEqual(all.hits.length, pointOfInterest.length);
  all.hits.forEach((hit) => {
    t.true(pointOfInterest.some((item) => shallowEqual(item, hit.data)));
  });

  t.deepEqual(all.meta.size, 0);
});

test('embexed invalid index', async (t) => {
  const builder = new Builder();
  builder.addIndex('identity', new IdentityIndex());
  builder.addIndex('even', new EvenIndex());

  const embexed = builder.build(pointOfInterest);

  const all = await embexed.search({ inexistent: {} });

  t.deepEqual(all.hits.length, pointOfInterest.length);
  all.hits.forEach((hit) => {
    t.true(pointOfInterest.some((item) => shallowEqual(item, hit.data)));
  });

  t.deepEqual(all.meta.size, 0);
});

test('embexed basic search', async (t) => {
  const builder = new Builder();
  builder.addIndex('identity', new IdentityIndex());
  builder.addIndex('even', new EvenIndex());

  const embexed = builder.build(pointOfInterest);

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
    t.deepEqual(hit.meta, { dumb: 1, dumber: 1 });
  });

  t.true(both.meta.has('even'));
  t.true(both.meta.has('ident'));
  t.deepEqual(both.meta.get('even'), { m1: 'value1', m2: 1 });
  t.deepEqual(both.meta.get('ident'), { i1: 'value2', i2: 2 });
});

test('embexed serialization', async (t) => {
  const builder = new Builder();
  builder.addIndex('identity', new IdentityIndex());
  builder.addIndex('even', new EvenIndex());

  const embexed = builder.build(pointOfInterest);

  const serialized = embexed.serialize();

  const builder2 = new Builder();
  builder2.addIndex('identity', new IdentityIndex());
  builder2.addIndex('even', new EvenIndex());
  const deserialized = builder2.load(serialized);

  t.deepEqual(deserialized, embexed);
});
