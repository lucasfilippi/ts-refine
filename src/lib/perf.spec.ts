import all_the_cities from 'all-the-cities';
import test from 'ava';

import { Builder } from './embexed';
import { FacettingFilter, FacettingIndex } from './facettingindex';
import { FullTextIndex } from './fulltextindex';
import { GeoAround, GeoIndex } from './geoindex';

function classifyPopulation(pop: number): string {
  if (pop < 5000) {
    return '2K-5K';
  } else if (pop < 10000) {
    return '5K-10K';
  } else if (pop < 100000) {
    return '10K-100K';
  } else if (pop < 1000000) {
    return '100K-1M';
  }
  return '>1M';
}

test('perf', async (t) => {
  console.time(`BUILD`);
  const builder = new Builder();
  builder.addIndex(
    'fulltext',
    new FullTextIndex({
      fields: ['name'],
    })
  );
  builder.addIndex(
    'facetting',
    new FacettingIndex({
      facetingFields: ['country', 'featureCode', 'populationClass'],
    })
  );
  builder.addIndex(
    'geo_coordinates',
    new GeoIndex({
      field: 'coordinates',
    })
  );

  const embexed = builder.build(
    all_the_cities.map((city) => {
      return {
        cityId: city.cityId,
        name: city.name,
        country: city.country,
        featureCode: city.featureCode,
        coordinates: city.loc.coordinates,
        populationClass: classifyPopulation(city.population),
        population: city.population,
      };
    })
  );

  console.timeEnd(`BUILD`);

  console.time(`SEARCH`);
  const all = await embexed.search({
    fulltext: { query: 'an', prefix: true },
    facetting: {
      filters: [new FacettingFilter('populationClass', ['10K-100K'])],
    },
    geo_coordinates: new GeoAround([2.333333, 48.866667], 200),
  });

  console.timeEnd(`SEARCH`);

  const asString = JSON.stringify(embexed.serialize());

  console.time(`LOAD`);
  const loader = new Builder();
  loader.addIndex(
    'fulltext',
    new FullTextIndex({
      fields: ['name'],
    })
  );
  loader.addIndex(
    'facetting',
    new FacettingIndex({
      facetingFields: ['country', 'featureCode', 'populationClass'],
    })
  );
  loader.addIndex(
    'geo_coordinates',
    new GeoIndex({
      field: 'coordinates',
    })
  );

  const loaded = loader.load(JSON.parse(asString));
  console.timeEnd(`LOAD`);
  console.time(`SEARCHLOADED`);
  const allFromLoaded = await loaded.search({
    fulltext: { query: 'an', prefix: true },
    facetting: {
      filters: [new FacettingFilter('populationClass', ['10K-100K'])],
    },
    geo_coordinates: new GeoAround([2.333333, 48.866667], 200),
  });

  console.timeEnd(`SEARCHLOADED`);

  t.deepEqual(allFromLoaded, all);
  // t.log(all.hits);
  // t.log(all.meta);
});
