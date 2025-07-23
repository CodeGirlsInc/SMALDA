import { Injectable, Logger } from "@nestjs/common"
import type { CoordinateExtractor, ExtractedCoordinate } from "../interfaces/coordinate-extractor.interface"
import { CoordinateSource, CoordinateFormat, LocationAccuracy } from "../entities/geo-tag.entity"

@Injectable()
export class RegexCoordinateExtractor implements CoordinateExtractor {
  private readonly logger = new Logger(RegexCoordinateExtractor.name)

  // Decimal degrees patterns
  private readonly decimalDegreesPatterns = [
    // Standard decimal degrees: 40.7128, -74.0060
    /(?:lat(?:itude)?[:\s]*)?(-?\d{1,3}\.?\d*)[°\s]*[,\s]+(?:lon(?:gitude)?[:\s]*)?(-?\d{1,3}\.?\d*)[°\s]*/gi,
    // With explicit lat/lon labels
    /lat[:\s]*(-?\d{1,3}\.?\d*)[°\s]*[,\s]*lon[:\s]*(-?\d{1,3}\.?\d*)[°\s]*/gi,
    // GPS coordinates format
    /GPS[:\s]*(-?\d{1,3}\.?\d*)[°\s]*[,\s]*(-?\d{1,3}\.?\d*)[°\s]*/gi,
    // Coordinates in parentheses
    /$$(-?\d{1,3}\.?\d*)[°\s]*[,\s]*(-?\d{1,3}\.?\d*)[°\s]*$$/gi,
  ]

  // Degrees, minutes, seconds patterns
  private readonly dmsPatterns = [
    // 40°42'46"N, 74°00'22"W
    /(\d{1,3})°(\d{1,2})'(\d{1,2}(?:\.\d+)?)"([NS])[,\s]*(\d{1,3})°(\d{1,2})'(\d{1,2}(?:\.\d+)?)"([EW])/gi,
    // 40° 42' 46" N, 74° 00' 22" W
    /(\d{1,3})°\s*(\d{1,2})'\s*(\d{1,2}(?:\.\d+)?)"?\s*([NS])[,\s]*(\d{1,3})°\s*(\d{1,2})'\s*(\d{1,2}(?:\.\d+)?)"?\s*([EW])/gi,
    // Without quotes: 40 42 46 N, 74 00 22 W
    /(\d{1,3})\s+(\d{1,2})\s+(\d{1,2}(?:\.\d+)?)\s*([NS])[,\s]*(\d{1,3})\s+(\d{1,2})\s+(\d{1,2}(?:\.\d+)?)\s*([EW])/gi,
  ]

  // Degrees and decimal minutes patterns
  private readonly ddmPatterns = [
    // 40°42.767'N, 74°00.367'W
    /(\d{1,3})°(\d{1,2}\.\d+)'([NS])[,\s]*(\d{1,3})°(\d{1,2}\.\d+)'([EW])/gi,
    // 40° 42.767' N, 74° 00.367' W
    /(\d{1,3})°\s*(\d{1,2}\.\d+)'\s*([NS])[,\s]*(\d{1,3})°\s*(\d{1,2}\.\d+)'\s*([EW])/gi,
  ]

  // UTM patterns
  private readonly utmPatterns = [
    // UTM: 18T 585628 4511322
    /UTM[:\s]*(\d{1,2})([A-Z])\s+(\d+)\s+(\d+)/gi,
    // 18T 0585628 4511322
    /(\d{1,2})([A-Z])\s+0?(\d+)\s+(\d+)/gi,
  ]

  // MGRS patterns
  private readonly mgrsPatterns = [
    // MGRS: 18TWL8562811322
    /MGRS[:\s]*(\d{1,2})([A-Z])([A-Z]{2})(\d{10})/gi,
    // 18TWL 85628 11322
    /(\d{1,2})([A-Z])([A-Z]{2})\s+(\d{5})\s+(\d{5})/gi,
  ]

  // Location name patterns (for geocoding)
  private readonly locationPatterns = [
    // Address patterns
    /(?:address|location|place)[:\s]*([^,\n]+(?:,\s*[^,\n]+)*)/gi,
    // City, State patterns
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z]{2}|[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
  ]

  async extractCoordinates(content: string, filename?: string): Promise<ExtractedCoordinate[]> {
    const coordinates: ExtractedCoordinate[] = []

    try {
      // Extract decimal degrees
      coordinates.push(...this.extractDecimalDegrees(content))

      // Extract DMS coordinates
      coordinates.push(...this.extractDMS(content))

      // Extract DDM coordinates
      coordinates.push(...this.extractDDM(content))

      // Extract UTM coordinates
      coordinates.push(...this.extractUTM(content))

      // Extract MGRS coordinates
      coordinates.push(...this.extractMGRS(content))

      this.logger.log(`Extracted ${coordinates.length} coordinates from ${filename || "content"}`)
      return coordinates
    } catch (error) {
      this.logger.error(`Error extracting coordinates: ${error.message}`)
      return []
    }
  }

  canHandle(content: string, mimeType?: string): boolean {
    // Can handle any text content
    return true
  }

  getExtractorName(): string {
    return "RegexCoordinateExtractor"
  }

  private extractDecimalDegrees(content: string): ExtractedCoordinate[] {
    const coordinates: ExtractedCoordinate[] = []

    for (const pattern of this.decimalDegreesPatterns) {
      let match: RegExpExecArray | null
      while ((match = pattern.exec(content)) !== null) {
        const lat = Number.parseFloat(match[1])
        const lon = Number.parseFloat(match[2])

        if (this.isValidCoordinate(lat, lon)) {
          coordinates.push({
            latitude: lat,
            longitude: lon,
            source: CoordinateSource.REGEX_EXTRACTION,
            originalFormat: CoordinateFormat.DECIMAL_DEGREES,
            accuracy: LocationAccuracy.ESTIMATED,
            extractedText: match[0],
            confidence: this.calculateConfidence(match[0], CoordinateFormat.DECIMAL_DEGREES),
            metadata: {
              originalCoordinates: match[0],
              extractionMethod: "regex_decimal_degrees",
            },
          })
        }
      }
    }

    return coordinates
  }

  private extractDMS(content: string): ExtractedCoordinate[] {
    const coordinates: ExtractedCoordinate[] = []

    for (const pattern of this.dmsPatterns) {
      let match: RegExpExecArray | null
      while ((match = pattern.exec(content)) !== null) {
        try {
          const latDeg = Number.parseInt(match[1])
          const latMin = Number.parseInt(match[2])
          const latSec = Number.parseFloat(match[3])
          const latDir = match[4]
          const lonDeg = Number.parseInt(match[5])
          const lonMin = Number.parseInt(match[6])
          const lonSec = Number.parseFloat(match[7])
          const lonDir = match[8]

          const lat = this.dmsToDecimal(latDeg, latMin, latSec, latDir)
          const lon = this.dmsToDecimal(lonDeg, lonMin, lonSec, lonDir)

          if (this.isValidCoordinate(lat, lon)) {
            coordinates.push({
              latitude: lat,
              longitude: lon,
              source: CoordinateSource.REGEX_EXTRACTION,
              originalFormat: CoordinateFormat.DEGREES_MINUTES_SECONDS,
              accuracy: LocationAccuracy.EXACT,
              extractedText: match[0],
              confidence: this.calculateConfidence(match[0], CoordinateFormat.DEGREES_MINUTES_SECONDS),
              metadata: {
                originalCoordinates: match[0],
                extractionMethod: "regex_dms",
              },
            })
          }
        } catch (error) {
          this.logger.warn(`Error parsing DMS coordinates: ${match[0]}`)
        }
      }
    }

    return coordinates
  }

  private extractDDM(content: string): ExtractedCoordinate[] {
    const coordinates: ExtractedCoordinate[] = []

    for (const pattern of this.ddmPatterns) {
      let match: RegExpExecArray | null
      while ((match = pattern.exec(content)) !== null) {
        try {
          const latDeg = Number.parseInt(match[1])
          const latMin = Number.parseFloat(match[2])
          const latDir = match[3]
          const lonDeg = Number.parseInt(match[4])
          const lonMin = Number.parseFloat(match[5])
          const lonDir = match[6]

          const lat = this.ddmToDecimal(latDeg, latMin, latDir)
          const lon = this.ddmToDecimal(lonDeg, lonMin, lonDir)

          if (this.isValidCoordinate(lat, lon)) {
            coordinates.push({
              latitude: lat,
              longitude: lon,
              source: CoordinateSource.REGEX_EXTRACTION,
              originalFormat: CoordinateFormat.DEGREES_DECIMAL_MINUTES,
              accuracy: LocationAccuracy.EXACT,
              extractedText: match[0],
              confidence: this.calculateConfidence(match[0], CoordinateFormat.DEGREES_DECIMAL_MINUTES),
              metadata: {
                originalCoordinates: match[0],
                extractionMethod: "regex_ddm",
              },
            })
          }
        } catch (error) {
          this.logger.warn(`Error parsing DDM coordinates: ${match[0]}`)
        }
      }
    }

    return coordinates
  }

  private extractUTM(content: string): ExtractedCoordinate[] {
    const coordinates: ExtractedCoordinate[] = []

    for (const pattern of this.utmPatterns) {
      let match: RegExpExecArray | null
      while ((match = pattern.exec(content)) !== null) {
        try {
          const zone = Number.parseInt(match[1])
          const band = match[2]
          const easting = Number.parseInt(match[3])
          const northing = Number.parseInt(match[4])

          // Convert UTM to lat/lon (simplified conversion)
          const { lat, lon } = this.utmToLatLon(zone, band, easting, northing)

          if (this.isValidCoordinate(lat, lon)) {
            coordinates.push({
              latitude: lat,
              longitude: lon,
              source: CoordinateSource.REGEX_EXTRACTION,
              originalFormat: CoordinateFormat.UTM,
              accuracy: LocationAccuracy.APPROXIMATE,
              extractedText: match[0],
              confidence: this.calculateConfidence(match[0], CoordinateFormat.UTM),
              metadata: {
                originalCoordinates: match[0],
                extractionMethod: "regex_utm",
                utmZone: zone,
                utmBand: band,
                easting,
                northing,
              },
            })
          }
        } catch (error) {
          this.logger.warn(`Error parsing UTM coordinates: ${match[0]}`)
        }
      }
    }

    return coordinates
  }

  private extractMGRS(content: string): ExtractedCoordinate[] {
    const coordinates: ExtractedCoordinate[] = []

    for (const pattern of this.mgrsPatterns) {
      let match: RegExpExecArray | null
      while ((match = pattern.exec(content)) !== null) {
        try {
          // MGRS to lat/lon conversion would require a specialized library
          // For now, we'll mark these as found but not converted
          coordinates.push({
            latitude: 0, // Placeholder
            longitude: 0, // Placeholder
            source: CoordinateSource.REGEX_EXTRACTION,
            originalFormat: CoordinateFormat.MGRS,
            accuracy: LocationAccuracy.UNKNOWN,
            extractedText: match[0],
            confidence: 0.5, // Lower confidence since we can't convert
            metadata: {
              originalCoordinates: match[0],
              extractionMethod: "regex_mgrs",
              requiresConversion: true,
            },
          })
        } catch (error) {
          this.logger.warn(`Error parsing MGRS coordinates: ${match[0]}`)
        }
      }
    }

    return coordinates
  }

  private dmsToDecimal(degrees: number, minutes: number, seconds: number, direction: string): number {
    let decimal = degrees + minutes / 60 + seconds / 3600
    if (direction === "S" || direction === "W") {
      decimal = -decimal
    }
    return decimal
  }

  private ddmToDecimal(degrees: number, minutes: number, direction: string): number {
    let decimal = degrees + minutes / 60
    if (direction === "S" || direction === "W") {
      decimal = -decimal
    }
    return decimal
  }

  private utmToLatLon(zone: number, band: string, easting: number, northing: number): { lat: number; lon: number } {
    // Simplified UTM to lat/lon conversion
    // In a real implementation, you'd use a proper projection library like proj4js
    const centralMeridian = (zone - 1) * 6 - 180 + 3

    // This is a very simplified approximation
    const lat = (northing - 5000000) / 111320 // Rough conversion
    const lon = centralMeridian + (easting - 500000) / (111320 * Math.cos((lat * Math.PI) / 180))

    return { lat, lon }
  }

  private isValidCoordinate(lat: number, lon: number): boolean {
    return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 && !Number.isNaN(lat) && !Number.isNaN(lon)
  }

  private calculateConfidence(extractedText: string, format: CoordinateFormat): number {
    let confidence = 0.7 // Base confidence

    // Increase confidence based on format specificity
    switch (format) {
      case CoordinateFormat.DEGREES_MINUTES_SECONDS:
        confidence = 0.95 // Very specific format
        break
      case CoordinateFormat.DEGREES_DECIMAL_MINUTES:
        confidence = 0.9 // Specific format
        break
      case CoordinateFormat.DECIMAL_DEGREES:
        confidence = 0.8 // Common format
        break
      case CoordinateFormat.UTM:
        confidence = 0.85 // Technical format
        break
      case CoordinateFormat.MGRS:
        confidence = 0.9 // Military precision
        break
    }

    // Adjust based on context clues
    if (extractedText.toLowerCase().includes("gps")) confidence += 0.1
    if (extractedText.toLowerCase().includes("coordinates")) confidence += 0.05
    if (extractedText.toLowerCase().includes("location")) confidence += 0.05

    return Math.min(confidence, 1.0)
  }
}
