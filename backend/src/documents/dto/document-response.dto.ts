export class DocumentResponseDto {
  id: string;
  title: string;
  status: string;
  riskScore: number | null;
  riskFlags: string[] | null;
  fileSize: number;
  latitude: number | null;
  longitude: number | null;
  createdAt: Date;
  updatedAt: Date;
}
