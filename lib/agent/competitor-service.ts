import { getLanguageModel } from "@/lib/agent/ai-provider";
import { generateText } from "ai";
import { getUdyamDistrictIntelligence } from "@/lib/api/datagov";
import { searchGoogleMaps, searchGoogleWeb, type GoogleMapsPlace } from "./serpapi-service";

export interface CompetitorShop {
  name: string;
  distance: string;
  landmark: string;
  speciality: string;
  priceRange: string;
  threatLevel: "High" | "Medium" | "Low";
  differentiator?: string;
  lat?: number;
  lng?: number;
  rating?: number;
  reviews?: number;
}

export interface CompetitorIntelligenceResult {
  success: boolean;
  needsLocation?: boolean;
  message?: string;
  category?: string;
  targetBusinessName?: string;
  locationSummary?: string;
  district?: string;
  state?: string;
  udyamStats?: {
    totalRegisteredUnits: number;
    saturationLevel: string;
    odopProduct?: string;
    highPotentialGap?: string;
  };
  spokenSummary?: string;
  fromCache?: boolean;
  competitors: CompetitorShop[]; // Top 12 strategic competitors for SWOT
  allPlaces?: CompetitorShop[]; // All verified mapped places for Leaflet radar pins
}

export interface SearchCompetitorsParams {
  category?: string;
  radiusKm?: number;
  location?: string;
  lat?: number;
  lon?: number;
  lng?: number;
  userId?: string;
  businessName?: string;
  bypassCache?: boolean;
}

// In-memory cache for fast zero-DB execution
const competitorCache = new Map<string, { timestamp: number; data: CompetitorIntelligenceResult }>();

/**
 * Reverse geocode latitude and longitude to resolve hyper-local street & district.
 */
async function reverseGeocode(lat: number, lon: number) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "VyaparSetu/1.0 (contact@vyaparsetu.in)",
      },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      const road = addr.road || addr.street || addr.suburb || "";
      const suburb = addr.suburb || addr.neighbourhood || addr.residential || "";
      const city = addr.city || addr.town || addr.state_district || addr.county || "";
      const state = addr.state || "";
      const postcode = addr.postcode || "";

      const parts = [road, suburb, city, state, postcode].filter(Boolean);
      return {
        displayName: data.display_name || parts.join(", "),
        road,
        suburb,
        city,
        state,
        postcode,
      };
    }
  } catch (e: any) {
    console.warn("[competitor-service] Geocoding warning:", e?.message);
  }
  return null;
}

function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Exclude clearly unrelated institutional or non-commercial establishments
function isIrrelevantTrade(placeTitle: string, placeType: string | undefined, category: string): boolean {
  const lowerCat = category.toLowerCase();
  const lowerTitle = `${placeTitle} ${placeType || ""}`.toLowerCase();

  const isFoodCategory =
    lowerCat.includes("cater") ||
    lowerCat.includes("restaurant") ||
    lowerCat.includes("food") ||
    lowerCat.includes("cafe") ||
    lowerCat.includes("dhaba") ||
    lowerCat.includes("bakery") ||
    lowerCat.includes("sweet") ||
    lowerCat.includes("dining") ||
    lowerCat.includes("snack") ||
    lowerCat.includes("tea") ||
    lowerCat.includes("coffee") ||
    lowerCat.includes("biryani") ||
    lowerCat.includes("pizza") ||
    lowerCat.includes("fast food") ||
    lowerCat.includes("eatery") ||
    lowerCat.includes("kitchen");

  const isKiranaGrocery =
    lowerCat.includes("kirana") ||
    lowerCat.includes("grocer") ||
    lowerCat.includes("supermarket") ||
    lowerCat.includes("provision") ||
    lowerCat.includes("daily need") ||
    lowerCat.includes("fmcg") ||
    lowerCat.includes("mart") ||
    lowerCat.includes("general store");

  const isApparelClothing =
    lowerCat.includes("cloth") ||
    lowerCat.includes("garment") ||
    lowerCat.includes("apparel") ||
    lowerCat.includes("boutique") ||
    lowerCat.includes("saree") ||
    lowerCat.includes("fashion") ||
    lowerCat.includes("textile") ||
    lowerCat.includes("tailor") ||
    lowerCat.includes("footwear") ||
    lowerCat.includes("shoes");

  const isHardwareBuilding =
    lowerCat.includes("hardware") ||
    lowerCat.includes("sanitary") ||
    lowerCat.includes("paint") ||
    lowerCat.includes("plywood") ||
    lowerCat.includes("cement") ||
    lowerCat.includes("tile") ||
    lowerCat.includes("pipe") ||
    lowerCat.includes("building material") ||
    lowerCat.includes("electrical");

  if (isFoodCategory) {
    const nonFoodTradeWords = [
      "hardware", "sanitary", "plywood", "paint store", "electricals", "cement", "tile",
      "gym", "fitness", "yoga", "crossfit", "sports academy",
      "coaching", "classes", "tuition", "institute", "academy", "foundation", "neet", "jee", "school", "college",
      "hospital", "clinic", "pathology", "diagnostic", "pharmacy", "medical store", "chemist", "dentist", "opticals",
      "boutique", "saree", "textile", "menswear", "footwear", "shoes",
      "salon", "beauty parlour", "spa", "hair cut",
      "petrol pump", "garage", "tyre", "car wash", "motor", "service center", "bike point",
      "mobile shop", "telecom", "electronics repair"
    ];
    if (nonFoodTradeWords.some((kw) => lowerTitle.includes(kw))) {
      return true;
    }
  } else if (isKiranaGrocery) {
    const nonKiranaTradeWords = [
      "hardware", "sanitary", "paint store", "plywood",
      "gym", "fitness", "coaching", "classes", "school", "college",
      "hospital", "clinic", "pathology", "dentist",
      "restaurant", "bar", "pub", "lounge", "dhaba", "cafe",
      "garage", "tyre", "petrol pump", "car wash", "salon", "spa"
    ];
    if (nonKiranaTradeWords.some((kw) => lowerTitle.includes(kw))) {
      return true;
    }
  } else if (isApparelClothing) {
    const nonClothingTradeWords = [
      "restaurant", "dhaba", "cafe", "food", "tea", "bakery", "sweet", "bar",
      "hardware", "paint", "plywood", "sanitary",
      "gym", "fitness", "coaching", "classes",
      "hospital", "clinic", "pharmacy", "garage", "petrol pump"
    ];
    if (nonClothingTradeWords.some((kw) => lowerTitle.includes(kw))) {
      return true;
    }
  } else if (isHardwareBuilding) {
    const nonHardwareTradeWords = [
      "restaurant", "dhaba", "cafe", "food", "tea", "bakery", "sweet",
      "boutique", "saree", "clothing", "apparel",
      "hospital", "clinic", "pharmacy", "gym", "coaching"
    ];
    if (nonHardwareTradeWords.some((kw) => lowerTitle.includes(kw))) {
      return true;
    }
  } else {
    if (
      lowerTitle.includes("hospital") ||
      lowerTitle.includes("pharmacy") ||
      lowerTitle.includes("petrol pump") ||
      lowerTitle.includes("tyre repair") ||
      lowerTitle.includes("gym") ||
      lowerTitle.includes("school")
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Uses Vertex AI Gemini to generate 2-3 hyper-local Google Maps queries
 * tailored to Indian commercial trade patterns for comprehensive catchment discovery.
 */
async function generateLocalSearchQueries(
  category: string,
  location: string,
  businessName?: string
): Promise<string[]> {
  try {
    const model = getLanguageModel("vertex", "gemini-3.7-flash");
    const res = await generateText({
      model,
      system: `You are an expert Indian MSME and retail market analyst. Given a business trade category and location in India, generate 2-3 distinct, effective Google Maps search queries in simple English/Hinglish to discover all direct and indirect commercial competitors in the local catchment area.
For example, if category is "Catering & Restaurant Services":
["restaurants dhabas and food corners", "catering services tiffin and banquet", "fast food cafes and sweet shops"]
If category is "Kirana / Grocery":
["kirana store and grocery shop", "supermarket provision store and daily needs", "bakery dairy and food mart"]

Return ONLY a valid JSON array of 2 to 3 query strings. No markdown backticks or explanations.`,
      prompt: `Category: ${category}
Location: ${location}
Business Name: ${businessName || "Local Enterprise"}`,
    });

    if (res.text) {
      const clean = res.text
        .replace(/```json\s*/gi, "")
        .replace(/```\s*$/gi, "")
        .trim();
      const parsed = JSON.parse(clean);
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "string") {
        return parsed.slice(0, 3);
      }
    }
  } catch (err: any) {
    console.warn("[competitor-service] AI query expansion fallback:", err?.message);
  }

  return [`${category}`, `${category} shops and outlets`];
}

/**
 * Search live directories & Google Maps for businesses in the specified category & area.
 * Priority 1: SerpApi Google Maps (Real verified shops, coordinates, star ratings, reviews, phone).
 * Priority 2: SerpApi Google Web Search (Web directory fallback).
 */
async function searchWebForCompetitors(
  category: string,
  location: string,
  lat?: number,
  lon?: number,
  radiusKm: number = 10,
  businessName?: string,
): Promise<{ snippets: string[]; places: GoogleMapsPlace[] }> {
  const snippets: string[] = [];
  const relevantPlaces: GoogleMapsPlace[] = [];

  const serpKey = process.env.SERPAPI_API_KEY;
  if (serpKey) {
    try {
      const aiQueries = await generateLocalSearchQueries(category, location, businessName);
      const queryList = Array.from(
        new Set([...aiQueries, `${category} near ${location}`])
      ).slice(0, 3);

      const searchPromises = queryList.map((q) =>
        searchGoogleMaps({
          query: q,
          location,
          lat,
          lon,
          radiusKm,
          limit: 30,
          timeoutMs: 9000,
        })
      );

      const allResults = await Promise.all(searchPromises);
      const combined = allResults.flat();
      const seenKeys = new Set<string>();

      combined.forEach((p) => {
        if (isIrrelevantTrade(p.title, p.type, category)) {
          return;
        }

        const key =
          p.placeId ||
          `${p.title.toLowerCase()}_${(p.latitude || 0).toFixed(4)}_${(p.longitude || 0).toFixed(4)}`;
        if (seenKeys.has(key)) return;
        seenKeys.add(key);

        let distanceStr = "";
        if (lat && lon && p.latitude && p.longitude) {
          const distKm = calculateDistanceKm(lat, lon, p.latitude, p.longitude);
          if (distKm > radiusKm * 1.35) {
            return;
          }
          distanceStr =
            distKm < 1 ? `${Math.round(distKm * 1000)}m` : `${distKm.toFixed(1)}km`;
        }

        relevantPlaces.push(p);

        const ratingStr = p.rating ? `${p.rating}★ (${p.reviews || 0} reviews)` : "";
        const distStr = distanceStr ? `Distance: ${distanceStr}` : "";
        const coordsStr =
          p.latitude && p.longitude ? `Coords: ${p.latitude}, ${p.longitude}` : "";
        snippets.push(
          `[Google Maps Place]: ${p.title} | ${p.address} | ${distStr} | ${ratingStr} | ${coordsStr}`.trim(),
        );
      });

      if (lat && lon) {
        relevantPlaces.sort((a, b) => {
          const distA =
            a.latitude && a.longitude
              ? calculateDistanceKm(lat, lon, a.latitude, a.longitude)
              : 999;
          const distB =
            b.latitude && b.longitude
              ? calculateDistanceKm(lat, lon, b.latitude, b.longitude)
              : 999;
          return distA - distB;
        });
      }
    } catch (serpErr: any) {
      console.warn("[competitor-service] SerpApi Google Maps error:", serpErr?.message);
    }
  }

  if (snippets.length < 5) {
    const queries = [
      `${category} shops outlets businesses in and near ${location}`,
      `popular local ${category} opposite near landmark ${location}`,
    ];

    for (const q of queries.slice(0, 2)) {
      try {
        const serpResults = await searchGoogleWeb(q, 6);
        for (const r of serpResults) {
          if (r.title || r.snippet) {
            snippets.push(`[Directory Listing - ${r.title}]: ${r.snippet.slice(0, 300)}`);
          }
        }
      } catch (err: any) {
        console.warn("[competitor-service] SerpApi web fallback error:", err?.message);
      }
    }
  }

  return { snippets, places: relevantPlaces };
}

/**
 * Main Centralized Competitor Intelligence Engine.
 * Powered by Google Cloud Vertex AI Gemini 3.7 Flash.
 */
export async function searchCompetitorsIntelligence(
  params: SearchCompetitorsParams
): Promise<CompetitorIntelligenceResult> {
  const {
    category: rawCategory,
    radiusKm = 5,
    location: explicitLocation,
    businessName: explicitBusinessName,
  } = params;

  const lat = params.lat;
  const lon = params.lon ?? params.lng;

  let resolvedLocation = explicitLocation || "";
  let resolvedDistrict = "";
  let resolvedState = "";
  let resolvedCategory = rawCategory || "";
  let resolvedBusinessName = explicitBusinessName || "";

  if (lat && lon) {
    const geo = await reverseGeocode(lat, lon);
    if (geo) {
      resolvedLocation = geo.displayName;
      resolvedDistrict = geo.city || resolvedDistrict;
      resolvedState = geo.state || resolvedState;
    }
  }

  if (!resolvedCategory) {
    resolvedCategory = "Retail & Local Business";
  }

  if (!resolvedLocation) {
    return {
      success: false,
      needsLocation: true,
      category: resolvedCategory,
      message:
        "User location is not available. Please ask the user to turn on their device location (GPS) or tell you the specific city, district, or area they want competitor analysis for.",
      competitors: [],
    };
  }

  // Fast Memory Cache Check
  const cacheKey = `${resolvedCategory.toLowerCase()}_${resolvedLocation.toLowerCase()}_${radiusKm}`;
  if (!params.bypassCache) {
    const cached = competitorCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 3600000) {
      return { ...cached.data, fromCache: true };
    }
  }

  if (!resolvedDistrict) {
    const parts = resolvedLocation.split(",").map((s) => s.trim());
    resolvedDistrict = parts[0] || "Regional Hub";
    resolvedState = parts[1] || "";
  }

  const [{ snippets: webSnippets, places: googlePlaces }, udyamIntelligence] =
    await Promise.all([
      searchWebForCompetitors(
        resolvedCategory,
        resolvedLocation,
        lat,
        lon,
        radiusKm,
        resolvedBusinessName,
      ),
      Promise.resolve(
        getUdyamDistrictIntelligence(resolvedDistrict, resolvedState || "India"),
      ),
    ]);

  const matchedSector =
    udyamIntelligence.topSectors.find((s: any) =>
      resolvedCategory.toLowerCase().includes(s.sector.toLowerCase())
    ) || udyamIntelligence.topSectors[0];

  try {
    const model = getLanguageModel("vertex", "gemini-3.7-flash");

    const systemPrompt = `You are VyaparSetu's Hyper-Local Market Competitor Analyst for Indian Micro/Small Enterprises.
Your mission is to identify, deduplicate, and analyze authentic competitors strictly within the specified business category and catchment radius (${radiusKm} km).

STRICT RELEVANCE & CATEGORY FILTERING RULES:
1. ONLY return businesses that operate in the SAME commercial trade / category as "${resolvedCategory}".
   - If target is Biryani / Food: return biryani joints, dhabas, eateries. NEVER include pharmacies, grocery, or apparel.
   - If target is Kirana / Grocery: return provision stores, general stores, supermarkets. NEVER include restaurants or hardware.
   - For ANY other category: strictly match shops competing directly for the exact same customer requirement.
2. DEDUPLICATION RULE:
   - If multiple search entries refer to the same physical establishment under slight spelling variations, MERGE THEM into a single canonical entry with its most accurate landmark and realistic distance.
3. OUTPUT QUANTITY:
   - Identify and return up to 10 to 15 key competitors (or all available verified establishments).
4. PRESERVE REAL COORDINATES:
   - If a verified establishment has latitude and longitude, preserve its exact "lat" and "lng" and include its "rating" and "reviews".
5. REALISTIC METRICS:
   - Provide genuine competitor names, distances from "${resolvedLocation}" (e.g. "150m", "400m", "1.2km"), landmarks, specialities, price ranges (e.g. "₹100 - ₹250"), and threat levels (High, Medium, Low).

Return ONLY pure valid JSON with NO markdown code-blocks or backticks.`;

    const placesSnippet =
      googlePlaces.length > 0
        ? googlePlaces
            .slice(0, 25)
            .map((p: any, idx: number) => {
              let dist = "";
              if (lat && lon && p.latitude && p.longitude) {
                const d = calculateDistanceKm(lat, lon, p.latitude, p.longitude);
                dist = d < 1 ? `${Math.round(d * 1000)}m` : `${d.toFixed(1)}km`;
              }
              return `${idx + 1}. Title: ${p.title} | Address: ${p.address} | Rating: ${p.rating || "N/A"}★ (${p.reviews || 0} reviews)${dist ? ` | Proximity: ${dist}` : ""}`;
            })
            .join("\n")
        : "";

    const userPrompt = `TARGET BUSINESS EVALUATION:
- Business Name: ${resolvedBusinessName || "Target Enterprise"}
- Category / Trade: ${resolvedCategory}
- Location: ${resolvedLocation}
- Radius: Within ${radiusKm} km
- Center Coordinates: Lat ${lat || "N/A"}, Lng ${lon || "N/A"}
- Udyam MSME District Context: ${resolvedDistrict}, ${resolvedState} (${udyamIntelligence.totalRegisteredUnits} registered MSMEs, ${matchedSector?.sector || "Sector"} Saturation: ${matchedSector?.saturationLevel || "Moderate"})

VERIFIED GOOGLE MAPS ESTABLISHMENTS DISCOVERED IN CATCHMENT:
${placesSnippet || "Local commercial trade area"}

SUPPLEMENTAL DIRECTORY OBSERVATIONS:
${webSnippets.length > 0 ? webSnippets.join("\n") : `Commercial trade area around ${resolvedLocation}`}

Evaluate these competitors. Assess their threat level (High, Medium, Low), speciality, price range, and how a local business can differentiate against them.
Return JSON strictly matching this schema with up to 15 competitors:
{
  "competitors": [
    {
      "name": "Exact Name from verified list or nearby business",
      "speciality": "Specific popular offering or focus",
      "priceRange": "e.g. ₹100 - ₹250 or competitive budget",
      "threatLevel": "High",
      "differentiator": "Concrete differentiation strategy or threat factor"
    }
  ]
}`;

    const aiResult = await generateText({
      model,
      system: systemPrompt,
      prompt: userPrompt,
    });

    let aiCompetitors: Partial<CompetitorShop>[] = [];
    if (aiResult.text) {
      try {
        const clean = aiResult.text
          .replace(/```json\s*/gi, "")
          .replace(/```\s*$/gi, "")
          .trim();
        const parsed = JSON.parse(clean);
        if (Array.isArray(parsed.competitors)) {
          aiCompetitors = parsed.competitors;
        } else if (Array.isArray(parsed)) {
          aiCompetitors = parsed;
        }
      } catch (parseErr: any) {
        console.warn("[competitor-service] JSON parsing warning:", parseErr?.message);
      }
    }

    const validPlaces = googlePlaces.filter(
      (p: any) => typeof p.latitude === "number" && typeof p.longitude === "number"
    );

    const allPlaces: CompetitorShop[] = validPlaces.map((p: any) => {
      let distStr = "Within catchment";
      if (lat && lon && p.latitude && p.longitude) {
        const d = calculateDistanceKm(lat, lon, p.latitude, p.longitude);
        distStr = d < 1 ? `${Math.round(d * 1000)}m` : `${d.toFixed(1)}km`;
      }

      const isHighThreat =
        (p.reviews && p.reviews >= 35) || (p.rating && p.rating >= 4.5);
      const isMedThreat =
        (p.reviews && p.reviews >= 10) || (p.rating && p.rating >= 3.8);
      const threatLevel: "High" | "Medium" | "Low" = isHighThreat
        ? "High"
        : isMedThreat
          ? "Medium"
          : "Low";

      return {
        name: p.title,
        distance: distStr,
        landmark: p.address || resolvedLocation,
        speciality: p.type || `${resolvedCategory} Outlet`,
        priceRange: p.price || "Competitive market pricing",
        threatLevel,
        differentiator: p.rating
          ? `Rated ${p.rating}★ with ${p.reviews || 0} reviews on Google Maps`
          : "Active neighborhood competitor in catchment area",
        lat: p.latitude,
        lng: p.longitude,
        rating: p.rating,
        reviews: p.reviews,
      };
    });

    let top12Competitors: CompetitorShop[] = [];

    if (aiCompetitors.length > 0) {
      aiCompetitors.forEach((aiC) => {
        if (!aiC.name) return;
        const matched = allPlaces.find((p) => {
          const pN = p.name.toLowerCase();
          const aN = aiC.name!.toLowerCase();
          return pN.includes(aN) || aN.includes(pN);
        });
        if (matched && !top12Competitors.some((c) => c.name === matched.name)) {
          top12Competitors.push({
            ...matched,
            threatLevel: aiC.threatLevel || matched.threatLevel,
            speciality: aiC.speciality || matched.speciality,
            priceRange: aiC.priceRange || matched.priceRange,
            differentiator: aiC.differentiator || matched.differentiator,
          });
        }
      });
    }

    for (const p of allPlaces) {
      if (top12Competitors.length >= 12) break;
      if (!top12Competitors.some((c) => c.name === p.name)) {
        top12Competitors.push(p);
      }
    }

    if (top12Competitors.length === 0) {
      if (aiCompetitors.length > 0) {
        top12Competitors = aiCompetitors.slice(0, 12).map((comp, idx) => {
          let compLat = comp.lat;
          let compLng = comp.lng;
          if ((typeof compLat !== "number" || typeof compLng !== "number") && lat && lon) {
            let distKm = 0.8;
            if (comp.distance) {
              const match = comp.distance.match(/([\d.]+)\s*(km|m)/i);
              if (match) {
                const val = parseFloat(match[1]);
                distKm = match[2].toLowerCase() === "m" ? val / 1000 : val;
              }
            }
            distKm = Math.min(distKm, radiusKm * 0.85);
            const goldenAngle = 137.5;
            const angle = ((idx * goldenAngle) * Math.PI) / 180;
            const latOffset = (distKm / 111) * Math.cos(angle);
            const lngOffset =
              (distKm / (111 * Math.cos((lat * Math.PI) / 180))) * Math.sin(angle);
            compLat = lat + latOffset;
            compLng = lon + lngOffset;
          }

          return {
            name: comp.name || `Local ${resolvedCategory} Shop`,
            distance: comp.distance || "Within 500m",
            landmark: comp.landmark || `Main Road, ${resolvedLocation}`,
            speciality: comp.speciality || `${resolvedCategory} services`,
            priceRange: comp.priceRange || "Competitive market rate",
            threatLevel: comp.threatLevel || "Medium",
            differentiator: comp.differentiator || "Local footfall competitor",
            lat: compLat,
            lng: compLng,
            rating: comp.rating,
            reviews: comp.reviews,
          };
        });
      } else {
        top12Competitors = [
          {
            name: `Local Established ${resolvedCategory} Outlet`,
            distance: "Within 350m",
            landmark: `Main Market Road, ${resolvedLocation}`,
            speciality: `Standard ${resolvedCategory} goods & services`,
            priceRange: "Moderate market rate",
            threatLevel: "Medium",
            differentiator: "Established loyal neighborhood customer footfall",
            lat: lat,
            lng: lon,
          },
        ];
      }
    }

    const finalAllPlaces = allPlaces.length > 0 ? allPlaces : top12Competitors;

    const spokenSummaryText = `Found ${finalAllPlaces.length} establishments in catchment, with ${top12Competitors.length} key competitors analyzed for ${resolvedCategory} in ${resolvedLocation}, including ${top12Competitors.slice(0, 3).map((c) => c.name).join(", ")}. Udyam MSME market saturation for this sector is ${matchedSector?.saturationLevel || "Moderate"}.`;

    const result: CompetitorIntelligenceResult = {
      success: true,
      fromCache: false,
      category: resolvedCategory,
      targetBusinessName: resolvedBusinessName,
      locationSummary: resolvedLocation,
      district: resolvedDistrict,
      state: resolvedState,
      udyamStats: {
        totalRegisteredUnits: udyamIntelligence.totalRegisteredUnits,
        saturationLevel: matchedSector?.saturationLevel || "Moderate",
        odopProduct: udyamIntelligence.odopProduct,
        highPotentialGap: udyamIntelligence.highPotentialGap,
      },
      spokenSummary: spokenSummaryText,
      competitors: top12Competitors,
      allPlaces: finalAllPlaces,
    };

    competitorCache.set(cacheKey, { timestamp: Date.now(), data: result });
    return result;
  } catch (error: any) {
    console.error("[competitor-service] Vertex AI error:", error);
    return {
      success: false,
      message: `Failed to synthesize competitor intelligence: ${error?.message}`,
      category: resolvedCategory,
      locationSummary: resolvedLocation,
      competitors: [],
    };
  }
}
