import all_the_cities from 'all-the-cities';

import { Builder } from '../src/lib/embexed';
import { FacettingFilter, FacettingIndex } from '../src/lib/facettingindex';
import { FullTextIndex } from '../src/lib/fulltextindex';
import { GeoAround, GeoIndex } from '../src/lib/geoindex';

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
  'geo_coordinates'
  new GeoIndex({
    field: 'coordinates',
  })
);

builder.addDocuments(
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
const embexed = builder.build();

const all = await embexed.search({
  fulltext: { query: 'an', prefix: true },
  facetting: {
    filters: [new FacettingFilter('populationClass', ['10K-100K'])],
  },
  geo_coordinates: new GeoAround([2.333333, 48.866667], 200),
});

console.log(all.hits);
console.log(all.meta);
