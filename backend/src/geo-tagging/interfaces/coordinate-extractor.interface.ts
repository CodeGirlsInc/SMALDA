import type { CoordinateSource, CoordinateFormat, LocationAccuracy } from "../entities/geo-tag.entity"

export interface ExtractedCoordinate {
  latitude: number
  longitude: number
  altitude?: number
  source: CoordinateSource
  originalFormat: CoordinateFormat
  accuracy: LocationAccuracy
  accuracyRadius?: number
  extractedText: string
  confidence: number
  metadata?: {
    originalCoordinates?: string
    extractionMethod?: string
    [key: string]: any
  }
}

export interface CoordinateExtractor {
  extractCoordinates(content: string, filename?: string): Promise<ExtractedCoordinate[]>
  canHandle(content: string, mimeType?: string): boolean
  getExtractorName(): string
}

export interface GeocodingResult {
  latitude: number
  longitude: number
  address?: string
  city?: string
  region?: string
  country?: string
  postalCode?: string
  accuracy: LocationAccuracy
  confidence: number
}

export interface ReverseGeocodingResult {
  address: string
  city?: string
  region?: string
  country?: string
  postalCode?: string
  confidence: number
}
