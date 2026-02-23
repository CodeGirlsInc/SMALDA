import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { ParcelBoundary } from './entities/parcel-boundary.entity';
import {
  GeoJsonGeometry,
  GeoJsonMultiPolygon,
  GeoJsonPolygon,
} from './interfaces/geo-json.interface';
import { OverlapResultDto } from './dto/overlap-result.dto';

@Injectable()
export class ParcelBoundaryService {
  constructor(
    @InjectRepository(ParcelBoundary)
    private readonly parcelBoundaryRepository: Repository<ParcelBoundary>,
  ) {}

  /**
   * Validates and stores a GeoJSON boundary for the given parcel.
   * If a boundary already exists for the parcel it is overwritten.
   */
  async saveBoundary(
    parcelId: string,
    rawGeoJson: Record<string, unknown>,
  ): Promise<ParcelBoundary> {
    if (!this.validateGeoJson(rawGeoJson)) {
      throw new BadRequestException(
        'Invalid GeoJSON: must be a Polygon or MultiPolygon with closed rings of at least 4 positions.',
      );
    }

    const geoJson = rawGeoJson as unknown as GeoJsonGeometry;
    const area = this.computeArea(geoJson);

    const existing = await this.parcelBoundaryRepository.findOne({
      where: { parcelId },
    });

    if (existing) {
      existing.geoJson = geoJson;
      existing.area = area;
      return this.parcelBoundaryRepository.save(existing);
    }

    const boundary = this.parcelBoundaryRepository.create({
      parcelId,
      geoJson,
      area,
    });

    return this.parcelBoundaryRepository.save(boundary);
  }

  /**
   * Returns the stored boundary for a parcel. Throws 404 if not found.
   */
  async getBoundary(parcelId: string): Promise<ParcelBoundary> {
    const boundary = await this.parcelBoundaryRepository.findOne({
      where: { parcelId },
    });

    if (!boundary) {
      throw new NotFoundException(
        `No boundary found for parcel ID "${parcelId}"`,
      );
    }

    return boundary;
  }

  /**
   * Returns true when the input is a structurally valid GeoJSON Polygon or MultiPolygon.
   *
   * Polygon rules:
   *   - coordinates is an array of rings
   *   - every ring has at least 4 positions
   *   - every ring is closed (first position === last position)
   *   - every position is a [number, number] pair
   *
   * MultiPolygon rules:
   *   - coordinates is an array of polygons, each following the Polygon rules above
   */
  validateGeoJson(geoJson: Record<string, unknown>): boolean {
    if (!geoJson || typeof geoJson !== 'object') return false;

    const type = geoJson['type'];
    const coords = geoJson['coordinates'];

    if (!Array.isArray(coords)) return false;

    if (type === 'Polygon') {
      return this.isValidPolygonCoords(coords as unknown[][]);
    }

    if (type === 'MultiPolygon') {
      return (coords as unknown[]).every(
        (polygon) =>
          Array.isArray(polygon) &&
          this.isValidPolygonCoords(polygon as unknown[][]),
      );
    }

    return false;
  }

  /**
   * Heuristic: returns all other parcels whose stored geometry shares at least
   * one exact coordinate point with the given parcel's geometry.
   *
   * Coordinates are serialised as "lng,lat" strings for O(1) lookup.
   * This does NOT perform true geometric intersection — use PostGIS for that.
   */
  async findPotentialOverlaps(parcelId: string): Promise<OverlapResultDto[]> {
    const source = await this.getBoundary(parcelId);
    const sourceCoords = this.buildCoordinateSet(source.geoJson);

    const others = await this.parcelBoundaryRepository.find({
      where: { parcelId: Not(parcelId) },
    });

    const overlaps: OverlapResultDto[] = [];

    for (const other of others) {
      const otherCoords = this.extractCoordinates(other.geoJson);
      let sharedCount = 0;

      for (const key of otherCoords) {
        if (sourceCoords.has(key)) {
          sharedCount++;
        }
      }

      if (sharedCount > 0) {
        overlaps.push({ parcelId: other.parcelId, sharedCoordinateCount: sharedCount });
      }
    }

    return overlaps.sort((a, b) => b.sharedCoordinateCount - a.sharedCoordinateCount);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private isValidPolygonCoords(rings: unknown[][]): boolean {
    if (!Array.isArray(rings) || rings.length === 0) return false;

    return rings.every((ring) => {
      if (!Array.isArray(ring) || ring.length < 4) return false;

      const isClosedRing =
        this.positionKey(ring[0] as number[]) ===
        this.positionKey(ring[ring.length - 1] as number[]);

      return (
        isClosedRing &&
        ring.every(
          (pos) =>
            Array.isArray(pos) &&
            pos.length >= 2 &&
            typeof pos[0] === 'number' &&
            typeof pos[1] === 'number',
        )
      );
    });
  }

  /**
   * Computes approximate area in square metres using the Shoelace formula
   * with an equirectangular projection centred on the geometry's midpoint.
   *
   * For Polygon: area of outer ring minus any holes.
   * For MultiPolygon: sum of each polygon's area.
   */
  private computeArea(geoJson: GeoJsonGeometry): number {
    if (geoJson.type === 'Polygon') {
      return this.polygonArea(geoJson as GeoJsonPolygon);
    }

    return (geoJson as GeoJsonMultiPolygon).coordinates.reduce(
      (sum, rings) =>
        sum + this.polygonArea({ type: 'Polygon', coordinates: rings }),
      0,
    );
  }

  private polygonArea(polygon: GeoJsonPolygon): number {
    if (polygon.coordinates.length === 0) return 0;

    // Outer ring (positive area)
    let area = this.ringArea(polygon.coordinates[0]);

    // Holes (subtract)
    for (let i = 1; i < polygon.coordinates.length; i++) {
      area -= this.ringArea(polygon.coordinates[i]);
    }

    return Math.max(0, area);
  }

  private ringArea(ring: [number, number][]): number {
    if (ring.length < 4) return 0;

    // Compute centroid latitude for projection
    const latSum = ring.reduce((s, c) => s + c[1], 0);
    const latCenter = latSum / ring.length;
    const cosLat = Math.cos((latCenter * Math.PI) / 180);

    const metersPerDegLat = 111_320;
    const metersPerDegLon = 111_320 * cosLat;

    let area = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      const x1 = ring[i][0] * metersPerDegLon;
      const y1 = ring[i][1] * metersPerDegLat;
      const x2 = ring[i + 1][0] * metersPerDegLon;
      const y2 = ring[i + 1][1] * metersPerDegLat;
      area += x1 * y2 - x2 * y1;
    }

    return Math.abs(area) / 2;
  }

  /** Returns a Set of serialised "lng,lat" keys for all positions in a geometry. */
  private buildCoordinateSet(geoJson: GeoJsonGeometry): Set<string> {
    return new Set(this.extractCoordinates(geoJson));
  }

  /** Flattens all positions in the geometry to an array of "lng,lat" strings. */
  private extractCoordinates(geoJson: GeoJsonGeometry): string[] {
    const allRings: [number, number][][] =
      geoJson.type === 'Polygon'
        ? (geoJson as GeoJsonPolygon).coordinates
        : (geoJson as GeoJsonMultiPolygon).coordinates.flat();

    return allRings.flatMap((ring) => ring.map((pos) => this.positionKey(pos)));
  }

  private positionKey(pos: number[]): string {
    return `${pos[0]},${pos[1]}`;
  }
}
