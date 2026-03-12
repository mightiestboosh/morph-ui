interface LocationResult {
  city: string;
  region: string;
  country: string;
  lat: number;
  lon: number;
}

export async function handleGetLocation(): Promise<LocationResult | { error: string }> {
  try {
    const response = await fetch('http://ip-api.com/json/');

    if (!response.ok) {
      return { error: `Location API returned status ${response.status}` };
    }

    const data = await response.json();

    if (data.status === 'fail') {
      return { error: data.message || 'Location lookup failed' };
    }

    return {
      city: data.city,
      region: data.regionName,
      country: data.country,
      lat: data.lat,
      lon: data.lon,
    };
  } catch (err: any) {
    console.error('Location error:', err);
    return { error: `Failed to get location: ${err.message}` };
  }
}
