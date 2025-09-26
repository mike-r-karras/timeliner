interface GeocodeResponse {
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    house_number?: string;
    road?: string;
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    postcode?: string;
    country?: string;
    country_code?: string;
  };
  place_id?: string;
  type?: string;
}

interface GeocodeResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  streetAddress?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  country?: string;
  placeId?: string;
}

export class GeocodingService {
  private static readonly BASE_URL = 'https://geocode.maps.co';
  private static readonly RATE_LIMIT_DELAY = 1000; // 1 second between requests

  private static lastRequestTime = 0;

  private static async rateLimitDelay(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.RATE_LIMIT_DELAY) {
      const delay = this.RATE_LIMIT_DELAY - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Geocode an address string to coordinates and structured address
   */
  static async geocodeAddress(address: string): Promise<GeocodeResult | null> {
    try {
      await this.rateLimitDelay();

      const encodedAddress = encodeURIComponent(address.trim());
      const url = `${this.BASE_URL}/search?q=${encodedAddress}&format=json&addressdetails=1&limit=1`;

      console.log(`Geocoding address: "${address}"`);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Timeliner-App/1.0',
        },
      });

      if (!response.ok) {
        console.error(`Geocoding API error: ${response.status} ${response.statusText}`);
        return null;
      }

      const data: GeocodeResponse[] = await response.json();

      if (!data || data.length === 0) {
        console.log(`No geocoding results for: "${address}"`);
        return null;
      }

      const result = data[0];

      return this.parseGeocodeResponse(result);
    } catch (error) {
      console.error('Geocoding error:', error);
      return null;
    }
  }

  /**
   * Reverse geocode coordinates to address
   */
  static async reverseGeocode(latitude: number, longitude: number): Promise<GeocodeResult | null> {
    try {
      await this.rateLimitDelay();

      const url = `${this.BASE_URL}/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`;

      console.log(`Reverse geocoding: ${latitude}, ${longitude}`);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Timeliner-App/1.0',
        },
      });

      if (!response.ok) {
        console.error(`Reverse geocoding API error: ${response.status} ${response.statusText}`);
        return null;
      }

      const data: GeocodeResponse = await response.json();

      if (!data) {
        console.log(`No reverse geocoding results for: ${latitude}, ${longitude}`);
        return null;
      }

      return this.parseGeocodeResponse(data);
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return null;
    }
  }

  /**
   * Search for locations with autocomplete
   */
  static async searchLocations(query: string, limit: number = 5): Promise<GeocodeResult[]> {
    try {
      await this.rateLimitDelay();

      const encodedQuery = encodeURIComponent(query.trim());
      const url = `${this.BASE_URL}/search?q=${encodedQuery}&format=json&addressdetails=1&limit=${limit}`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Timeliner-App/1.0',
        },
      });

      if (!response.ok) {
        console.error(`Location search API error: ${response.status} ${response.statusText}`);
        return [];
      }

      const data: GeocodeResponse[] = await response.json();

      if (!data || data.length === 0) {
        return [];
      }

      return data.map(result => this.parseGeocodeResponse(result)).filter(result => result !== null);
    } catch (error) {
      console.error('Location search error:', error);
      return [];
    }
  }

  private static parseGeocodeResponse(result: GeocodeResponse): GeocodeResult {
    const latitude = parseFloat(result.lat);
    const longitude = parseFloat(result.lon);

    // Extract address components
    const addr = result.address;
    let streetAddress = '';

    if (addr?.house_number && addr?.road) {
      streetAddress = `${addr.house_number} ${addr.road}`;
    } else if (addr?.road) {
      streetAddress = addr.road;
    }

    // Determine city from various possible fields
    const city = addr?.city || addr?.town || addr?.village || addr?.suburb || '';

    return {
      latitude,
      longitude,
      formattedAddress: result.display_name,
      streetAddress: streetAddress || undefined,
      city: city || undefined,
      stateProvince: addr?.state || undefined,
      postalCode: addr?.postcode || undefined,
      country: addr?.country || undefined,
      placeId: result.place_id?.toString() || undefined,
    };
  }

  /**
   * Build a search string from address components
   */
  static buildAddressString(components: {
    streetAddress?: string;
    city?: string;
    stateProvince?: string;
    postalCode?: string;
    country?: string;
  }): string {
    const parts = [
      components.streetAddress,
      components.city,
      components.stateProvince,
      components.postalCode,
      components.country,
    ].filter(Boolean);

    return parts.join(', ');
  }

  /**
   * Validate coordinates
   */
  static isValidCoordinates(latitude: number, longitude: number): boolean {
    return (
      !isNaN(latitude) &&
      !isNaN(longitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180
    );
  }
}