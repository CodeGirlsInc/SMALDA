export interface GeoJsonPolygon {
  type: 'Polygon';
  /** Outer ring first, then holes. Each ring is [[lng, lat], ...] */
  coordinates: [number, number][][];
}

export interface GeoJsonMultiPolygon {
  type: 'MultiPolygon';
  /** Array of polygons, each with outer ring + optional holes */
  coordinates: [number, number][][][];
}

export type GeoJsonGeometry = GeoJsonPolygon | GeoJsonMultiPolygon;
