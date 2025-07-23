import { Injectable, Logger } from "@nestjs/common"
import type { GeocodingResult, ReverseGeocodingResult } from "../interfaces/coordinate-extractor.interface"
import { LocationAccuracy } from "../entities/geo-tag.entity"

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name)

  // Mock geocoding database - in production, use Google Maps, OpenStreetMap, etc.
  private readonly geocodingDatabase = new Map([
    ["New York City", { lat: 40.7128, lon: -74.006, city: "New York", region: "NY", country: "USA" }],
    ["London", { lat: 51.5074, lon: -0.1278, city: "London", region: "England", country: "UK" }],
    ["Tokyo", { lat: 35.6762, lon: 139.6503, city: "Tokyo", region: "Tokyo", country: "Japan" }],
    ["Sydney", { lat: -33.8688, lon: 151.2093, city: "Sydney", region: "NSW", country: "Australia" }],
    ["Paris", { lat: 48.8566, lon: 2.3522, city: "Paris", region: "Île-de-France", country: "France" }],
    ["Berlin", { lat: 52.52, lon: 13.405, city: "Berlin", region: "Berlin", country: "Germany" }],
    ["Moscow", { lat: 55.7558, lon: 37.6176, city: "Moscow", region: "Moscow", country: "Russia" }],
    ["Beijing", { lat: 39.9042, lon: 116.4074, city: "Beijing", region: "Beijing", country: "China" }],
    ["Mumbai", { lat: 19.076, lon: 72.8777, city: "Mumbai", region: "Maharashtra", country: "India" }],
    ["São Paulo", { lat: -23.5505, lon: -46.6333, city: "São Paulo", region: "SP", country: "Brazil" }],
    ["Los Angeles", { lat: 34.0522, lon: -118.2437, city: "Los Angeles", region: "CA", country: "USA" }],
    ["Chicago", { lat: 41.8781, lon: -87.6298, city: "Chicago", region: "IL", country: "USA" }],
    ["Toronto", { lat: 43.6532, lon: -79.3832, city: "Toronto", region: "ON", country: "Canada" }],
    ["Mexico City", { lat: 19.4326, lon: -99.1332, city: "Mexico City", region: "CDMX", country: "Mexico" }],
    ["Buenos Aires", { lat: -34.6118, lon: -58.396, city: "Buenos Aires", region: "CABA", country: "Argentina" }],
  ])

  async geocode(address: string): Promise<GeocodingResult | null> {
    try {
      this.logger.log(`Geocoding address: ${address}`)

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Clean and normalize the address
      const normalizedAddress = this.normalizeAddress(address)

      // Try exact match first
      const exactMatch = this.geocodingDatabase.get(normalizedAddress)
      if (exactMatch) {
        return {
          latitude: exactMatch.lat,
          longitude: exactMatch.lon,
          address: normalizedAddress,
          city: exactMatch.city,
          region: exactMatch.region,
          country: exactMatch.country,
          accuracy: LocationAccuracy.APPROXIMATE,
          confidence: 0.95,
        }
      }

      // Try fuzzy matching
      const fuzzyMatch = this.findFuzzyMatch(normalizedAddress)
      if (fuzzyMatch) {
        return {
          latitude: fuzzyMatch.coords.lat,
          longitude: fuzzyMatch.coords.lon,
          address: fuzzyMatch.name,
          city: fuzzyMatch.coords.city,
          region: fuzzyMatch.coords.region,
          country: fuzzyMatch.coords.country,
          accuracy: LocationAccuracy.APPROXIMATE,
          confidence: fuzzyMatch.confidence,
        }
      }

      // Try parsing structured address
      const structuredResult = await this.parseStructuredAddress(address)
      if (structuredResult) {
        return structuredResult
      }

      this.logger.warn(`Could not geocode address: ${address}`)
      return null
    } catch (error) {
      this.logger.error(`Error geocoding address ${address}: ${error.message}`)
      return null
    }
  }

  async reverseGeocode(latitude: number, longitude: number): Promise<ReverseGeocodingResult | null> {
    try {
      this.logger.log(`Reverse geocoding coordinates: ${latitude}, ${longitude}`)

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Find the closest known location
      let closestLocation: { name: string; coords: any; distance: number } | null = null
      let minDistance = Number.POSITIVE_INFINITY

      for (const [name, coords] of this.geocodingDatabase.entries()) {
        const distance = this.calculateDistance(latitude, longitude, coords.lat, coords.lon)
        if (distance < minDistance) {
          minDistance = distance
          closestLocation = { name, coords, distance }
        }
      }

      if (closestLocation && closestLocation.distance < 100) {
        // Within 100km
        const confidence = Math.max(0.3, 1 - closestLocation.distance / 100)

        return {
          address: `Near ${closestLocation.name}`,
          city: closestLocation.coords.city,
          region: closestLocation.coords.region,
          country: closestLocation.coords.country,
          confidence,
        }
      }

      // Generate approximate address based on coordinates
      const approximateAddress = this.generateApproximateAddress(latitude, longitude)
      return {
        address: approximateAddress,
        confidence: 0.3,
      }
    } catch (error) {
      this.logger.error(`Error reverse geocoding coordinates ${latitude}, ${longitude}: ${error.message}`)
      return null
    }
  }

  async batchGeocode(addresses: string[]): Promise<Array<GeocodingResult | null>> {
    const results = []

    for (const address of addresses) {
      const result = await this.geocode(address)
      results.push(result)

      // Add small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 50))
    }

    return results
  }

  private normalizeAddress(address: string): string {
    return address
      .trim()
      .replace(/\s+/g, " ")
      .replace(/[,.]$/, "")
      .split(",")[0] // Take first part before comma
      .trim()
  }

  private findFuzzyMatch(address: string): { name: string; coords: any; confidence: number } | null {
    const addressLower = address.toLowerCase()

    for (const [name, coords] of this.geocodingDatabase.entries()) {
      const nameLower = name.toLowerCase()

      // Check if address contains the city name or vice versa
      if (addressLower.includes(nameLower) || nameLower.includes(addressLower)) {
        const similarity = this.calculateStringSimilarity(addressLower, nameLower)
        if (similarity > 0.6) {
          return {
            name,
            coords,
            confidence: similarity,
          }
        }
      }
    }

    return null
  }

  private async parseStructuredAddress(address: string): Promise<GeocodingResult | null> {
    // Try to parse structured addresses like "123 Main St, New York, NY"
    const parts = address.split(",").map((part) => part.trim())

    if (parts.length >= 2) {
      const cityPart = parts[parts.length - 2] // Second to last part is usually city
      const result = await this.geocode(cityPart)

      if (result) {
        return {
          ...result,
          address: address,
          confidence: result.confidence * 0.8, // Lower confidence for partial match
        }
      }
    }

    return null
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    // Haversine formula to calculate distance between two points
    const R = 6371 // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1)
    const dLon = this.toRadians(lon2 - lon1)

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180)
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    // Simple Levenshtein distance-based similarity
    const longer = str1.length > str2.length ? str1 : str2
    const shorter = str1.length > str2.length ? str2 : str1

    if (longer.length === 0) return 1.0

    const distance = this.levenshteinDistance(longer, shorter)
    return (longer.length - distance) / longer.length
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = []

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i]
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
        }
      }
    }

    return matrix[str2.length][str1.length]
  }

  private generateApproximateAddress(latitude: number, longitude: number): string {
    // Generate a rough address based on coordinates
    const latDirection = latitude >= 0 ? "N" : "S"
    const lonDirection = longitude >= 0 ? "E" : "W"

    return `Approximately ${Math.abs(latitude).toFixed(2)}°${latDirection}, ${Math.abs(longitude).toFixed(2)}°${lonDirection}`
  }
}
