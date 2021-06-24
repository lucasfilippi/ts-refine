import all_the_cities, { City } from 'all-the-cities';
import test from 'ava';

import { GeoKDBush } from './geokdbush';

const index = new GeoKDBush<City>(
  all_the_cities,
  (city) => city.loc.coordinates[0],
  (city) => city.loc.coordinates[1]
);

test('geokdbush around maxresults', (t) => {
  const indices = index.around(-119.7051, 34.4363, 5);

  t.deepEqual(
    indices.map((i) => (i ? all_the_cities[i].name : '')).join(', '),
    'Mission Canyon, Santa Barbara, Montecito, Summerland, Goleta'
  );
});

test('geokdbush calculates great circle distance', (t) => {
  t.deepEqual(
    10131.7396,
    Math.round(1e4 * GeoKDBush.distance(30.5, 50.5, -119.7, 34.4)) / 1e4
  );
});
//El Tarter
test('geokdbush exhaustive search in correct order', (t) => {
  const points = index
    .around(30.5, 50.5)
    .map((i) => (i !== undefined ? all_the_cities[i] : null))
    .filter((c) => {
      if (c === null) {
        t.log(c);
      }
      return c !== null;
    });

  const c = { lon: 30.5, lat: 50.5 };
  const sorted = all_the_cities
    .map((item) => ({
      item: item,
      dist: GeoKDBush.distance(
        c.lon,
        c.lat,
        item.loc.coordinates[0],
        item.loc.coordinates[1]
      ),
    }))
    .sort((a, b) => a.dist - b.dist);

  for (let i = 0; i < sorted.length; i++) {
    const dist = GeoKDBush.distance(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      points[i]!.loc.coordinates[0],
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      points[i]!.loc.coordinates[1],
      c.lon,
      c.lat
    );
    if (dist !== sorted[i].dist) {
      t.fail(
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        `${points[i]!.name} (${dist}) vs ${sorted[i].item.name} (${
          sorted[i].dist
        })`
      );
      break;
    }
  }
  t.pass('all points in correct order');
});
