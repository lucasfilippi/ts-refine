import TypedFastBitSet from 'typedfastbitset';

import { GeoKDBush } from './geokdbush';
import { Index, IndexSearchResult, PlainObject } from './refine';

export type GeoBuildOptions = {
  field: string;
};

export type Coordinates = [long: number, lat: number];

enum GeoOperationKind {
  GeoWithinSphere = 1,
  GeoWithinBox,
  GeoAround,
}

export interface GeoOperation {
  kind: GeoOperationKind;
  execute(index: GeoKDBush<Coordinates>): number[];
}

export class GeoWithinSphere implements GeoOperation {
  kind = GeoOperationKind.GeoWithinSphere;
  protected center: Coordinates;
  protected radius: number;

  constructor(center: Coordinates, radius: number) {
    this.center = center;
    this.radius = radius;
  }

  execute(index: GeoKDBush<Coordinates>): number[] {
    return index.within(this.center[0], this.center[1], this.radius);
  }
}

export class GeoWithinBox implements GeoOperation {
  kind = GeoOperationKind.GeoWithinBox;
  protected min: Coordinates;
  protected max: Coordinates;

  constructor(min: Coordinates, max: Coordinates) {
    this.min = min;
    this.max = max;
  }

  execute(index: GeoKDBush<Coordinates>): number[] {
    return index.range(this.min[0], this.min[1], this.max[0], this.max[1]);
  }
}

export class GeoAround implements GeoOperation {
  kind = GeoOperationKind.GeoAround;
  protected center: Coordinates;
  protected radius?: number;
  protected maxResults?: number;

  constructor(center: Coordinates, radius?: number, maxResults?: number) {
    this.center = center;
    this.radius = radius;
    this.maxResults = maxResults;
  }

  execute(index: GeoKDBush<Coordinates>): number[] {
    return index.around(
      this.center[0],
      this.center[1],
      this.maxResults,
      this.radius
    );
  }
}

export class GeoIndex implements Index {
  protected field: string;
  protected index?: GeoKDBush<Coordinates>;

  constructor(options: GeoBuildOptions) {
    this.field = options.field;
  }

  // add some documents to the index
  build(documents: PlainObject[]): void {
    this.index = new GeoKDBush<Coordinates>(
      documents.map((d) => {
        return d[this.field] as Coordinates;
      })
    );
  }

  async search(
    on: TypedFastBitSet,
    operation: GeoOperation
  ): Promise<IndexSearchResult> {
    return {
      ids: on.new_intersection(
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        new TypedFastBitSet(operation.execute(this.index!))
      ),
      // metadata?: Map<number, PlainObject>; // ids indexed metadata
    };
  }

  asPlainObject(): PlainObject {
    if (!this.index) return {};
    return {
      points: this.index.points as number[][],
    };
  }

  load(raw: PlainObject): void {
    if (
      raw.points &&
      Array.isArray(raw.points) &&
      (raw.points as Array<unknown>).every(
        (p) =>
          Array.isArray(p) &&
          p.length === 2 &&
          typeof p[0] === 'number' &&
          typeof p[1] === 'number'
      )
    ) {
      this.index = new GeoKDBush<Coordinates>(raw.points as Coordinates[]);
    }
  }
}
