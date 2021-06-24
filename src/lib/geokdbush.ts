import KDBush from 'kdbush';
import TinyQueue from 'tinyqueue';

const earthRadius = 6371;
const rad = Math.PI / 180;

export type Node = {
  id?: number;
  left: number; // left index in the kd-tree array
  right: number; // right index
  axis: number; // 0 for longitude axis and 1 for latitude axis
  dist: number; // will hold the lower bound of children's distances to the query point
  minLng: number; // bounding box of the node
  minLat: number;
  maxLng: number;
  maxLat: number;
};

export class GeoKDBush<T> extends KDBush<T> {
  // lower bound for distance from a location to points inside a bounding box
  protected static boxDist(
    lng: number,
    lat: number,
    cosLat: number,
    node: Node
  ) {
    const minLng = node.minLng;
    const maxLng = node.maxLng;
    const minLat = node.minLat;
    const maxLat = node.maxLat;

    // query point is between minimum and maximum longitudes
    if (lng >= minLng && lng <= maxLng) {
      if (lat < minLat) return GeoKDBush.haverSin((lat - minLat) * rad);
      if (lat > maxLat) return GeoKDBush.haverSin((lat - maxLat) * rad);
      return 0;
    }

    // query point is west or east of the bounding box;
    // calculate the extremum for great circle distance from query point to the closest longitude;
    const haverSinDLng = Math.min(
      GeoKDBush.haverSin((lng - minLng) * rad),
      GeoKDBush.haverSin((lng - maxLng) * rad)
    );
    const extremumLat = GeoKDBush.vertexLat(lat, haverSinDLng);

    // if extremum is inside the box, return the distance to it
    if (extremumLat > minLat && extremumLat < maxLat) {
      return GeoKDBush.haverSinDistPartial(
        haverSinDLng,
        cosLat,
        lat,
        extremumLat
      );
    }
    // otherwise return the distance to one of the bounding box corners (whichever is closest)
    return Math.min(
      GeoKDBush.haverSinDistPartial(haverSinDLng, cosLat, lat, minLat),
      GeoKDBush.haverSinDistPartial(haverSinDLng, cosLat, lat, maxLat)
    );
  }

  protected static haverSin(theta: number) {
    const s = Math.sin(theta / 2);
    return s * s;
  }

  protected static haverSinDistPartial(
    haverSinDLng: number,
    cosLat1: number,
    lat1: number,
    lat2: number
  ) {
    return (
      cosLat1 * Math.cos(lat2 * rad) * haverSinDLng +
      GeoKDBush.haverSin((lat1 - lat2) * rad)
    );
  }

  protected static haverSinDist(
    lng1: number,
    lat1: number,
    lng2: number,
    lat2: number,
    cosLat1: number
  ) {
    const haverSinDLng = GeoKDBush.haverSin((lng1 - lng2) * rad);
    return GeoKDBush.haverSinDistPartial(haverSinDLng, cosLat1, lat1, lat2);
  }

  protected static vertexLat(lat: number, haverSinDLng: number) {
    const cosDLng = 1 - 2 * haverSinDLng;
    if (cosDLng <= 0) return lat > 0 ? 90 : -90;
    return Math.atan(Math.tan(lat * rad) / cosDLng) / rad;
  }

  static distance(lng1: number, lat1: number, lng2: number, lat2: number) {
    const h = GeoKDBush.haverSinDist(
      lng1,
      lat1,
      lng2,
      lat2,
      Math.cos(lat1 * rad)
    );
    return 2 * earthRadius * Math.asin(Math.sqrt(h));
  }

  around(
    lng: number,
    lat: number,
    maxResults?: number,
    maxDistance?: number
  ): number[] {
    let maxHaverSinDist = 1;
    const result: number[] = [];

    if (maxResults === undefined) maxResults = Infinity;
    if (maxDistance !== undefined)
      maxHaverSinDist = GeoKDBush.haverSin(maxDistance / earthRadius);

    // a distance-sorted priority queue that will contain both points and kd-tree nodes
    const q = new TinyQueue<Node>([], (a: Node, b: Node) => a.dist - b.dist);

    // an object that represents the top kd-tree node (the whole Earth)
    let node: Node | undefined = {
      left: 0, // left index in the kd-tree array
      right: this.ids.length - 1, // right index
      axis: 0, // 0 for longitude axis and 1 for latitude axis
      dist: 0, // will hold the lower bound of children's distances to the query point
      minLng: -180, // bounding box of the node
      minLat: -90,
      maxLng: 180,
      maxLat: 90,
    };

    const cosLat = Math.cos(lat * rad);

    while (node) {
      const right = node.right;
      const left = node.left;

      if (right - left <= this.nodeSize) {
        // leaf node

        // add all points of the leaf node to the queue
        for (let i = left; i <= right; i++) {
          q.push({
            id: this.ids[i] as number,
            dist: GeoKDBush.haverSinDist(
              lng,
              lat,
              this.coords[2 * i],
              this.coords[2 * i + 1],
              cosLat
            ),
            left: 0,
            right: 0,
            axis: 0,
            minLng: 0,
            minLat: 0,
            maxLng: 0,
            maxLat: 0,
          });
        }
      } else {
        // not a leaf node (has child nodes)

        const m = (left + right) >> 1; // middle index
        const midLng = this.coords[2 * m];
        const midLat = this.coords[2 * m + 1];

        // add middle point to the queue
        q.push({
          id: this.ids[m],
          dist: GeoKDBush.haverSinDist(lng, lat, midLng, midLat, cosLat),
          left: 0,
          right: 0,
          axis: 0,
          minLng: 0,
          minLat: 0,
          maxLng: 0,
          maxLat: 0,
        });

        const nextAxis = (node.axis + 1) % 2;

        // first half of the node
        const leftNode = {
          left: left,
          right: m - 1,
          axis: nextAxis,
          minLng: node.minLng,
          minLat: node.minLat,
          maxLng: node.axis === 0 ? midLng : node.maxLng,
          maxLat: node.axis === 1 ? midLat : node.maxLat,
          dist: 0,
        };
        // second half of the node
        const rightNode = {
          left: m + 1,
          right: right,
          axis: nextAxis,
          minLng: node.axis === 0 ? midLng : node.minLng,
          minLat: node.axis === 1 ? midLat : node.minLat,
          maxLng: node.maxLng,
          maxLat: node.maxLat,
          dist: 0,
        };

        leftNode.dist = GeoKDBush.boxDist(lng, lat, cosLat, leftNode);
        rightNode.dist = GeoKDBush.boxDist(lng, lat, cosLat, rightNode);

        // add child nodes to the queue
        q.push(leftNode);
        q.push(rightNode);
      }

      // fetch closest points from the queue; they're guaranteed to be closer
      // than all remaining points (both individual and those in kd-tree nodes),
      // since each node's distance is a lower bound of distances to its children
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      while (q.length && q.peek() && q.peek()!.id! >= 0) {
        const candidate: Node = q.pop() as Node;

        if (candidate.dist > maxHaverSinDist) return result;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        result.push(candidate.id!);
        if (result.length === maxResults) return result;
      }

      // the next closest kd-tree node
      node = q.pop();
    }

    return result;
  }
}
