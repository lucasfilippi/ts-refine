import test from 'ava';
import TypedFastBitSet from 'typedfastbitset';

import { GeoIndex, GeoWithinBox } from './geoindex';
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

test('geoindex ', async (t) => {
  const idx = new GeoIndex({
    field: 'coordinates',
  });

  idx.build(pointOfInterest);

  const results = await idx.search(
    new TypedFastBitSet([0, 1, 2, 3, 4, 5, 6, 7]),
    new GeoWithinBox([48, 2], [50, 3])
  );

  t.deepEqual(results.ids.array(), [0, 1, 2, 3, 4]);
});
