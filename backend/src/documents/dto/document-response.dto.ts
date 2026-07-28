export class DocumentResponseDto {
  id: string;
  title: string;
  status: string;
  riskScore?: number;
  riskFlags?: string[];
  createdAt: Date;
  updatedAt: Date;
}
