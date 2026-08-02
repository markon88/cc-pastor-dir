const CENSUS_URL = 'https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress';

// Resolves a US street address to its county name via the free Census Geocoder.
// Returns null (rather than throwing) on no-match or API failure so a bad/
// unresolvable address never blocks a sync.
export async function geocodeCounty(street, city, state, zip) {
  if (!street || !city || !state) return null;

  const oneLine = [street, city, state, zip].filter(Boolean).join(', ');
  const url = new URL(CENSUS_URL);
  url.searchParams.set('address', oneLine);
  url.searchParams.set('benchmark', 'Public_AR_Current');
  url.searchParams.set('vintage', 'Current_Current');
  url.searchParams.set('layers', 'Counties');
  url.searchParams.set('format', 'json');

  try {
    const resp = await fetch(url.toString());
    if (!resp.ok) return null;
    const data = await resp.json();
    const match = data?.result?.addressMatches?.[0];
    const county = match?.geographies?.Counties?.[0]?.BASENAME;
    return county ?? null;
  } catch {
    return null;
  }
}
