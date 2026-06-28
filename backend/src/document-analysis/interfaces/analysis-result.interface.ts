export interface ExtractedEntity {
  type: 'owner' | 'date' | 'issuer' | 'parcel';
  value: string;
  confidence: number;
}

export interface DateEntity {
  raw: string;
  parsed: Date;
  role: 'issued' | 'expiry' | 'signing';
}

export interface OverlapResult {
  documentId: string;
  similarity: number;
}

export interface DocumentAnalysisResult {
  entities: ExtractedEntity[];
  dates: DateEntity[];
  overlaps: OverlapResult[];
  extractedText: string;
}
