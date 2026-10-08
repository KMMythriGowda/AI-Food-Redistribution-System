"""Small geocoding helper with deterministic city fallbacks and optional Nominatim lookup."""
import os
from typing import Optional, Tuple
import httpx

# Common Indian city centers make the demo functional without an external geocoding dependency.
CITY_COORDINATES = {
    'kolkata': (22.5726, 88.3639),
    'calcutta': (22.5726, 88.3639),
    'bengaluru': (12.9716, 77.5946),
    'bangalore': (12.9716, 77.5946),
    'mumbai': (19.0760, 72.8777),
    'delhi': (28.6139, 77.2090),
    'new delhi': (28.6139, 77.2090),
    'chennai': (13.0827, 80.2707),
    'hyderabad': (17.3850, 78.4867),
    'pune': (18.5204, 73.8567),
    'ahmedabad': (23.0225, 72.5714),
    'jaipur': (26.9124, 75.7873),
    'lucknow': (26.8467, 80.9462),
    'patna': (25.5941, 85.1376),
    'guwahati': (26.1445, 91.7362),
    'bhubaneswar': (20.2961, 85.8245),
    'chandigarh': (30.7333, 76.7794),
    'kochi': (9.9312, 76.2673),
}


def geocode_address(address: Optional[str]) -> Tuple[Optional[float], Optional[float]]:
    if not address or not address.strip():
        return None, None

    normalized = address.lower().strip()
    for city, coords in CITY_COORDINATES.items():
        if city in normalized:
            return coords

    if os.getenv('ENABLE_GEOCODING', 'false').lower() not in {'1', 'true', 'yes'}:
        return None, None

    try:
        response = httpx.get(
            'https://nominatim.openstreetmap.org/search',
            params={'q': address, 'format': 'json', 'limit': 1},
            headers={'User-Agent': 'FoodRedistributionPlatform/1.0'},
            timeout=3.0,
        )
        response.raise_for_status()
        data = response.json()
        if data:
            return float(data[0]['lat']), float(data[0]['lon'])
    except Exception:
        pass
    return None, None
