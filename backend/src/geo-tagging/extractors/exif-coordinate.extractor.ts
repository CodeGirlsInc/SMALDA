import { Injectable, Logger } from "@nestjs/common"
import type { CoordinateExtractor, ExtractedCoordinate } from "../interfaces/coordinate-extractor.interface"
import { CoordinateSource, CoordinateFormat, LocationAccuracy } from "../entities/geo-tag.entity"
import * as ExifReader from "exifreader"
import * as fs from "fs"

@Injectable()
export class ExifCoordinateExtractor implements CoordinateExtractor {
  private readonly logger = new Logger(ExifCoordinateExtractor.name)

  private readonly supportedMimeTypes = ["image/jpeg", "image/jpg", "image/tiff", "image/tif"]

  async extractCoordinates(content: string, filename?: string): Promise<ExtractedCoordinate[]> {
    const coordinates: ExtractedCoordinate[] = []

    try {
      // For file path content, read the file
      if (this.isFilePath(content)) {
        const fileBuffer = fs.readFileSync(content)
        const exifData = ExifReader.load(fileBuffer.buffer)

        const extractedCoords = this.extractFromExifData(exifData, content)
        coordinates.push(...extractedCoords)
      }

      this.logger.log(`Extracted ${coordinates.length} coordinates from EXIF data in ${filename || "file"}`)
      return coordinates
    } catch (error) {
      this.logger.error(`Error extracting EXIF coordinates: ${error.message}`)
      return []
    }
  }

  canHandle(content: string, mimeType?: string): boolean {
    return mimeType ? this.supportedMimeTypes.includes(mimeType) : this.isFilePath(content)
  }

  getExtractorName(): string {
    return "ExifCoordinateExtractor"
  }

  private extractFromExifData(exifData: any, filePath: string): ExtractedCoordinate[] {
    const coordinates: ExtractedCoordinate[] = []

    try {
      // Check for GPS data in EXIF
      const gpsLatitude = exifData["GPS Latitude"]
      const gpsLatitudeRef = exifData["GPS Latitude Ref"]
      const gpsLongitude = exifData["GPS Longitude"]
      const gpsLongitudeRef = exifData["GPS Longitude Ref"]
      const gpsAltitude = exifData["GPS Altitude"]
      const gpsAltitudeRef = exifData["GPS Altitude Ref"]

      if (gpsLatitude && gpsLongitude && gpsLatitudeRef && gpsLongitudeRef) {
        const lat = this.convertDMSToDecimal(gpsLatitude.description, gpsLatitudeRef.value[0])
        const lon = this.convertDMSToDecimal(gpsLongitude.description, gpsLongitudeRef.value[0])

        let altitude: number | undefined
        if (gpsAltitude) {
          altitude = Number.parseFloat(gpsAltitude.description)
          if (gpsAltitudeRef && gpsAltitudeRef.value[0] === 1) {
            altitude = -altitude // Below sea level
          }
        }

        if (this.isValidCoordinate(lat, lon)) {
          // Get additional metadata
          const timestamp = exifData["DateTime"] || exifData["GPS Date/Time"]
          const camera = this.getCameraInfo(exifData)

          coordinates.push({
            latitude: lat,
            longitude: lon,
            altitude,
            source: CoordinateSource.EXIF_DATA,
            originalFormat: CoordinateFormat.DEGREES_MINUTES_SECONDS,
            accuracy: LocationAccuracy.EXACT,
            accuracyRadius: this.estimateGpsAccuracy(exifData),
            extractedText: `GPS: ${lat}, ${lon}`,
            confidence: 0.98, // EXIF GPS data is highly reliable
            metadata: {
              originalCoordinates: `${gpsLatitude.description} ${gpsLatitudeRef.value[0]}, ${gpsLongitude.description} ${gpsLongitudeRef.value[0]}`,
              extractionMethod: "exif_gps",
              timestamp: timestamp?.description,
              camera: camera,
              filePath: filePath,
              gpsProcessingMethod: exifData["GPS Processing Method"]?.description,
              gpsDilutionOfPrecision: exifData["GPS DOP"]?.description,
            },
          })
        }
      }

      // Check for location data in other EXIF fields
      const locationInfo = this.extractLocationInfo(exifData)
      if (locationInfo) {
        coordinates.push(...locationInfo)
      }
    } catch (error) {
      this.logger.warn(`Error parsing EXIF GPS data: ${error.message}`)
    }

    return coordinates
  }

  private convertDMSToDecimal(dmsString: string, direction: string): number {
    // Parse DMS format like "40° 42' 46.11""
    const dmsMatch = dmsString.match(/(\d+)°\s*(\d+)'\s*(\d+(?:\.\d+)?)"?/)

    if (!dmsMatch) {
      throw new Error(`Invalid DMS format: ${dmsString}`)
    }

    const degrees = Number.parseInt(dmsMatch[1])
    const minutes = Number.parseInt(dmsMatch[2])
    const seconds = Number.parseFloat(dmsMatch[3])

    let decimal = degrees + minutes / 60 + seconds / 3600

    if (direction === "S" || direction === "W") {
      decimal = -decimal
    }

    return decimal
  }

  private getCameraInfo(exifData: any): any {
    return {
      make: exifData["Make"]?.description,
      model: exifData["Model"]?.description,
      software: exifData["Software"]?.description,
      dateTime: exifData["DateTime"]?.description,
    }
  }

  private estimateGpsAccuracy(exifData: any): number {
    // Estimate GPS accuracy based on available EXIF data
    const dop = exifData["GPS DOP"]?.description
    if (dop) {
      const dopValue = Number.parseFloat(dop)
      // Convert DOP to approximate accuracy in meters
      return dopValue * 5 // Rough conversion
    }

    // Default GPS accuracy for smartphones/cameras
    return 5 // 5 meters typical accuracy
  }

  private extractLocationInfo(exifData: any): ExtractedCoordinate[] {
    const coordinates: ExtractedCoordinate[] = []

    // Check for location names in EXIF
    const locationName =
      exifData["GPS Area Information"]?.description ||
      exifData["Location"]?.description ||
      exifData["GPS Destination"]?.description

    if (locationName && locationName.length > 2) {
      // This would require geocoding to convert to coordinates
      // For now, we'll mark it as requiring geocoding
      coordinates.push({
        latitude: 0, // Placeholder
        longitude: 0, // Placeholder
        source: CoordinateSource.EXIF_DATA,
        originalFormat: CoordinateFormat.DECIMAL_DEGREES,
        accuracy: LocationAccuracy.APPROXIMATE,
        extractedText: locationName,
        confidence: 0.6,
        metadata: {
          originalCoordinates: locationName,
          extractionMethod: "exif_location_name",
          requiresGeocoding: true,
        },
      })
    }

    return coordinates
  }

  private isFilePath(content: string): boolean {
    // Simple check if content looks like a file path
    return (
      content.length < 500 &&
      (content.includes("/") || content.includes("\\")) &&
      !content.includes("\n") &&
      !content.includes(" ")
    ) // File paths typically don't have spaces in this context
  }

  private isValidCoordinate(lat: number, lon: number): boolean {
    return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 && !Number.isNaN(lat) && !Number.isNaN(lon)
  }
}
