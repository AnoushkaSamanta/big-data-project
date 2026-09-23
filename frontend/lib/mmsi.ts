/**
 * Maritime Mobile Service Identity (MMSI) & Vessel Registry Utilities.
 *
 * Maps ITU Maritime Identification Digits (MID) to country flags and names,
 * and AIS Vessel Type codes to human-readable maritime categories.
 */

export interface CountryInfo {
  country: string;
  flag: string;
  code: string;
}

// ITU Maritime Identification Digits (MID) mapping (first 3 digits of 9-digit MMSI)
const MID_TABLE: Record<string, CountryInfo> = {
  // Europe
  "201": { country: "Albania", flag: "🇦🇱", code: "ALB" },
  "205": { country: "Belgium", flag: "🇧🇪", code: "BEL" },
  "211": { country: "Germany", flag: "🇩🇪", code: "DEU" },
  "212": { country: "Cyprus", flag: "🇨🇾", code: "CYP" },
  "219": { country: "Denmark", flag: "🇩🇰", code: "DNK" },
  "220": { country: "Denmark", flag: "🇩🇰", code: "DNK" },
  "224": { country: "Spain", flag: "🇪🇸", code: "ESP" },
  "225": { country: "Spain", flag: "🇪🇸", code: "ESP" },
  "226": { country: "France", flag: "🇫🇷", code: "FRA" },
  "227": { country: "France", flag: "🇫🇷", code: "FRA" },
  "228": { country: "France", flag: "🇫🇷", code: "FRA" },
  "230": { country: "Finland", flag: "🇫🇮", code: "FIN" },
  "232": { country: "United Kingdom", flag: "🇬🇧", code: "GBR" },
  "233": { country: "United Kingdom", flag: "🇬🇧", code: "GBR" },
  "234": { country: "United Kingdom", flag: "🇬🇧", code: "GBR" },
  "235": { country: "United Kingdom", flag: "🇬🇧", code: "GBR" },
  "237": { country: "Greece", flag: "🇬🇷", code: "GRC" },
  "239": { country: "Greece", flag: "🇬🇷", code: "GRC" },
  "240": { country: "Greece", flag: "🇬🇷", code: "GRC" },
  "242": { country: "Morocco", flag: "🇲🇦", code: "MAR" },
  "244": { country: "Netherlands", flag: "🇳🇱", code: "NLD" },
  "245": { country: "Netherlands", flag: "🇳🇱", code: "NLD" },
  "246": { country: "Netherlands", flag: "🇳🇱", code: "NLD" },
  "247": { country: "Italy", flag: "🇮🇹", code: "ITA" },
  "248": { country: "Malta", flag: "🇲🇹", code: "MLT" },
  "249": { country: "Malta", flag: "🇲🇹", code: "MLT" },
  "250": { country: "Ireland", flag: "🇮🇪", code: "IRL" },
  "255": { country: "Portugal", flag: "🇵🇹", code: "PRT" },
  "257": { country: "Norway", flag: "🇳🇴", code: "NOR" },
  "258": { country: "Norway", flag: "🇳🇴", code: "NOR" },
  "259": { country: "Norway", flag: "🇳🇴", code: "NOR" },
  "261": { country: "Poland", flag: "🇵🇱", code: "POL" },
  "265": { country: "Sweden", flag: "🇸🇪", code: "SWE" },
  "266": { country: "Sweden", flag: "🇸🇪", code: "SWE" },
  "271": { country: "Turkey", flag: "🇹🇷", code: "TUR" },
  "273": { country: "Russia", flag: "🇷🇺", code: "RUS" },

  // Americas
  "303": { country: "United States (Alaska)", flag: "🇺🇸", code: "USA" },
  "304": { country: "Antigua & Barbuda", flag: "🇦🇬", code: "ATG" },
  "305": { country: "Antigua & Barbuda", flag: "🇦🇬", code: "ATG" },
  "308": { country: "Bahamas", flag: "🇧🇸", code: "BHS" },
  "309": { country: "Bahamas", flag: "🇧🇸", code: "BHS" },
  "311": { country: "Bahamas", flag: "🇧🇸", code: "BHS" },
  "312": { country: "Belize", flag: "🇧🇿", code: "BLZ" },
  "316": { country: "Canada", flag: "🇨🇦", code: "CAN" },
  "319": { country: "Cayman Islands", flag: "🇰🇾", code: "CYM" },
  "338": { country: "United States", flag: "🇺🇸", code: "USA" },
  "345": { country: "Mexico", flag: "🇲🇽", code: "MEX" },
  "351": { country: "Panama", flag: "🇵🇦", code: "PAN" },
  "352": { country: "Panama", flag: "🇵🇦", code: "PAN" },
  "353": { country: "Panama", flag: "🇵🇦", code: "PAN" },
  "354": { country: "Panama", flag: "🇵🇦", code: "PAN" },
  "355": { country: "Panama", flag: "🇵🇦", code: "PAN" },
  "356": { country: "Panama", flag: "🇵🇦", code: "PAN" },
  "357": { country: "Panama", flag: "🇵🇦", code: "PAN" },
  "366": { country: "United States", flag: "🇺🇸", code: "USA" },
  "367": { country: "United States", flag: "🇺🇸", code: "USA" },
  "368": { country: "United States", flag: "🇺🇸", code: "USA" },
  "369": { country: "United States", flag: "🇺🇸", code: "USA" },
  "370": { country: "Panama", flag: "🇵🇦", code: "PAN" },
  "371": { country: "Panama", flag: "🇵🇦", code: "PAN" },
  "372": { country: "Panama", flag: "🇵🇦", code: "PAN" },
  "373": { country: "Panama", flag: "🇵🇦", code: "PAN" },
  "375": { country: "St. Vincent & Grenadines", flag: "🇻🇨", code: "VCT" },
  "376": { country: "St. Vincent & Grenadines", flag: "🇻🇨", code: "VCT" },
  "377": { country: "St. Vincent & Grenadines", flag: "🇻🇨", code: "VCT" },

  // Asia / Pacific / Oceania
  "412": { country: "China", flag: "🇨🇳", code: "CHN" },
  "413": { country: "China", flag: "🇨🇳", code: "CHN" },
  "414": { country: "China", flag: "🇨🇳", code: "CHN" },
  "416": { country: "Taiwan", flag: "🇹🇼", code: "TWN" },
  "419": { country: "India", flag: "🇮🇳", code: "IND" },
  "431": { country: "Japan", flag: "🇯🇵", code: "JPN" },
  "432": { country: "Japan", flag: "🇯🇵", code: "JPN" },
  "440": { country: "South Korea", flag: "🇰🇷", code: "KOR" },
  "441": { country: "South Korea", flag: "🇰🇷", code: "KOR" },
  "477": { country: "Hong Kong", flag: "🇭🇰", code: "HKG" },
  "503": { country: "Australia", flag: "🇦🇺", code: "AUS" },
  "512": { country: "New Zealand", flag: "🇳🇿", code: "NZL" },
  "525": { country: "Indonesia", flag: "🇮🇩", code: "IDN" },
  "538": { country: "Marshall Islands", flag: "🇲🇭", code: "MHL" },
  "563": { country: "Singapore", flag: "🇸🇬", code: "SGP" },
  "564": { country: "Singapore", flag: "🇸🇬", code: "SGP" },
  "565": { country: "Singapore", flag: "🇸🇬", code: "SGP" },
  "566": { country: "Singapore", flag: "🇸🇬", code: "SGP" },

  // Africa / Middle East
  "636": { country: "Liberia", flag: "🇱🇷", code: "LBR" },
  "637": { country: "Liberia", flag: "🇱🇷", code: "LBR" },
  "667": { country: "Sierra Leone", flag: "🇸🇱", code: "SLE" },
  "710": { country: "Brazil", flag: "🇧🇷", code: "BRA" },
};

/**
 * Resolves country name, flag emoji, and ISO code from an MMSI number.
 */
export function getVesselCountry(mmsi: number | string): CountryInfo {
  const mmsiStr = String(mmsi).padStart(9, "0");
  const mid = mmsiStr.substring(0, 3);
  return (
    MID_TABLE[mid] || {
      country: "International",
      flag: "🌐",
      code: "INT",
    }
  );
}

/**
 * Maps standard AIS Vessel Type codes to human-readable names.
 */
export function getVesselTypeName(typeCode: number | null | undefined): string {
  if (typeCode === null || typeCode === undefined) return "Commercial Vessel";
  const code = Number(typeCode);

  if (code >= 70 && code <= 79) return "Cargo Vessel";
  if (code >= 80 && code <= 89) return "Tanker (Oil / Chemical)";
  if (code === 30) return "Fishing Vessel";
  if (code >= 60 && code <= 69) return "Passenger / Ferry";
  if (code === 52) return "Tug / Towing";
  if (code === 31 || code === 32) return "Towing / Dredging";
  if (code === 50) return "Pilot Vessel";
  if (code === 51) return "Search & Rescue (SAR)";
  if (code === 53) return "Port Tender";
  if (code === 55) return "Law Enforcement";
  if (code >= 40 && code <= 49) return "High-Speed Craft (HSC)";
  if (code >= 36 && code <= 37) return "Sailing / Pleasure Craft";

  return `Vessel (Type ${code})`;
}

/**
 * External direct links for live vessel photography & real-world registry verification.
 */
export function getMarineTrafficUrl(mmsi: number | string): string {
  return `https://www.marinetraffic.com/en/ais/details/ships/mmsi:${mmsi}`;
}

export function getVesselFinderUrl(mmsi: number | string): string {
  return `https://www.vesselfinder.com/vessels?name=${mmsi}`;
}
