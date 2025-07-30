export class LandMetadataDto {
  landId: string;
  owner: string;
  coordinates: { lat: number; long: number };
  documents: {
    docId: string;
    type: string;
    issuedAt: string;
    expiresAt: string;
  }[];
}
