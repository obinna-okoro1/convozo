/**
 * Phone Country Codes
 * Static data for the phone number country code picker.
 * Includes a timezone→country map for auto-detection.
 */

export interface CountryCode {
  code: string;    // dial code e.g. "+1"
  country: string; // country name
  flag: string;    // emoji flag
  iso: string;     // ISO 3166-1 alpha-2
}

export const COUNTRY_CODES: CountryCode[] = [
  { code: '+1',   country: 'United States',   flag: '🇺🇸', iso: 'US' },
  { code: '+1',   country: 'Canada',           flag: '🇨🇦', iso: 'CA' },
  { code: '+44',  country: 'United Kingdom',   flag: '🇬🇧', iso: 'GB' },
  { code: '+61',  country: 'Australia',         flag: '🇦🇺', iso: 'AU' },
  { code: '+91',  country: 'India',             flag: '🇮🇳', iso: 'IN' },
  { code: '+49',  country: 'Germany',           flag: '🇩🇪', iso: 'DE' },
  { code: '+33',  country: 'France',            flag: '🇫🇷', iso: 'FR' },
  { code: '+81',  country: 'Japan',             flag: '🇯🇵', iso: 'JP' },
  { code: '+82',  country: 'South Korea',       flag: '🇰🇷', iso: 'KR' },
  { code: '+86',  country: 'China',             flag: '🇨🇳', iso: 'CN' },
  { code: '+55',  country: 'Brazil',            flag: '🇧🇷', iso: 'BR' },
  { code: '+52',  country: 'Mexico',            flag: '🇲🇽', iso: 'MX' },
  { code: '+39',  country: 'Italy',             flag: '🇮🇹', iso: 'IT' },
  { code: '+34',  country: 'Spain',             flag: '🇪🇸', iso: 'ES' },
  { code: '+31',  country: 'Netherlands',       flag: '🇳🇱', iso: 'NL' },
  { code: '+46',  country: 'Sweden',            flag: '🇸🇪', iso: 'SE' },
  { code: '+47',  country: 'Norway',            flag: '🇳🇴', iso: 'NO' },
  { code: '+45',  country: 'Denmark',           flag: '🇩🇰', iso: 'DK' },
  { code: '+358', country: 'Finland',           flag: '🇫🇮', iso: 'FI' },
  { code: '+48',  country: 'Poland',            flag: '🇵🇱', iso: 'PL' },
  { code: '+41',  country: 'Switzerland',       flag: '🇨🇭', iso: 'CH' },
  { code: '+43',  country: 'Austria',           flag: '🇦🇹', iso: 'AT' },
  { code: '+32',  country: 'Belgium',           flag: '🇧🇪', iso: 'BE' },
  { code: '+351', country: 'Portugal',          flag: '🇵🇹', iso: 'PT' },
  { code: '+353', country: 'Ireland',           flag: '🇮🇪', iso: 'IE' },
  { code: '+64',  country: 'New Zealand',       flag: '🇳🇿', iso: 'NZ' },
  { code: '+65',  country: 'Singapore',         flag: '🇸🇬', iso: 'SG' },
  { code: '+852', country: 'Hong Kong',         flag: '🇭🇰', iso: 'HK' },
  { code: '+971', country: 'UAE',               flag: '🇦🇪', iso: 'AE' },
  { code: '+966', country: 'Saudi Arabia',      flag: '🇸🇦', iso: 'SA' },
  { code: '+972', country: 'Israel',            flag: '🇮🇱', iso: 'IL' },
  { code: '+90',  country: 'Turkey',            flag: '🇹🇷', iso: 'TR' },
  { code: '+27',  country: 'South Africa',      flag: '🇿🇦', iso: 'ZA' },
  { code: '+234', country: 'Nigeria',           flag: '🇳🇬', iso: 'NG' },
  { code: '+233', country: 'Ghana',             flag: '🇬🇭', iso: 'GH' },
  { code: '+254', country: 'Kenya',             flag: '🇰🇪', iso: 'KE' },
  { code: '+255', country: 'Tanzania',          flag: '🇹🇿', iso: 'TZ' },
  { code: '+256', country: 'Uganda',            flag: '🇺🇬', iso: 'UG' },
  { code: '+250', country: 'Rwanda',            flag: '🇷🇼', iso: 'RW' },
  { code: '+260', country: 'Zambia',            flag: '🇿🇲', iso: 'ZM' },
  { code: '+237', country: 'Cameroon',          flag: '🇨🇲', iso: 'CM' },
  { code: '+225', country: "Côte d'Ivoire",    flag: '🇨🇮', iso: 'CI' },
  { code: '+221', country: 'Senegal',           flag: '🇸🇳', iso: 'SN' },
  { code: '+212', country: 'Morocco',           flag: '🇲🇦', iso: 'MA' },
  { code: '+20',  country: 'Egypt',             flag: '🇪🇬', iso: 'EG' },
  { code: '+63',  country: 'Philippines',       flag: '🇵🇭', iso: 'PH' },
  { code: '+66',  country: 'Thailand',          flag: '🇹🇭', iso: 'TH' },
  { code: '+60',  country: 'Malaysia',          flag: '🇲🇾', iso: 'MY' },
  { code: '+62',  country: 'Indonesia',         flag: '🇮🇩', iso: 'ID' },
  { code: '+84',  country: 'Vietnam',           flag: '🇻🇳', iso: 'VN' },
  { code: '+92',  country: 'Pakistan',          flag: '🇵🇰', iso: 'PK' },
  { code: '+880', country: 'Bangladesh',        flag: '🇧🇩', iso: 'BD' },
  { code: '+94',  country: 'Sri Lanka',         flag: '🇱🇰', iso: 'LK' },
  { code: '+57',  country: 'Colombia',          flag: '🇨🇴', iso: 'CO' },
  { code: '+56',  country: 'Chile',             flag: '🇨🇱', iso: 'CL' },
  { code: '+54',  country: 'Argentina',         flag: '🇦🇷', iso: 'AR' },
  { code: '+51',  country: 'Peru',              flag: '🇵🇪', iso: 'PE' },
  { code: '+7',   country: 'Russia',            flag: '🇷🇺', iso: 'RU' },
  { code: '+380', country: 'Ukraine',           flag: '🇺🇦', iso: 'UA' },
  { code: '+40',  country: 'Romania',           flag: '🇷🇴', iso: 'RO' },
  { code: '+420', country: 'Czech Republic',    flag: '🇨🇿', iso: 'CZ' },
  { code: '+36',  country: 'Hungary',           flag: '🇭🇺', iso: 'HU' },
  { code: '+30',  country: 'Greece',            flag: '🇬🇷', iso: 'GR' },
];

/** Maps IANA timezone → ISO country code for auto-detecting the caller's country */
export const TIMEZONE_TO_COUNTRY: Record<string, string> = {
  'America/New_York': 'US',
  'America/Chicago': 'US',
  'America/Denver': 'US',
  'America/Los_Angeles': 'US',
  'America/Phoenix': 'US',
  'America/Anchorage': 'US',
  'Pacific/Honolulu': 'US',
  'America/Detroit': 'US',
  'America/Indiana/Indianapolis': 'US',
  'America/Toronto': 'CA',
  'America/Vancouver': 'CA',
  'America/Edmonton': 'CA',
  'America/Winnipeg': 'CA',
  'America/Halifax': 'CA',
  'America/St_Johns': 'CA',
  'Europe/London': 'GB',
  'Europe/Dublin': 'IE',
  'Australia/Sydney': 'AU',
  'Australia/Melbourne': 'AU',
  'Australia/Perth': 'AU',
  'Australia/Brisbane': 'AU',
  'Australia/Adelaide': 'AU',
  'Asia/Kolkata': 'IN',
  'Asia/Calcutta': 'IN',
  'Europe/Berlin': 'DE',
  'Europe/Paris': 'FR',
  'Asia/Tokyo': 'JP',
  'Asia/Seoul': 'KR',
  'Asia/Shanghai': 'CN',
  'Asia/Hong_Kong': 'HK',
  'America/Sao_Paulo': 'BR',
  'America/Mexico_City': 'MX',
  'Europe/Rome': 'IT',
  'Europe/Madrid': 'ES',
  'Europe/Amsterdam': 'NL',
  'Europe/Stockholm': 'SE',
  'Europe/Oslo': 'NO',
  'Europe/Copenhagen': 'DK',
  'Europe/Helsinki': 'FI',
  'Europe/Warsaw': 'PL',
  'Europe/Zurich': 'CH',
  'Europe/Vienna': 'AT',
  'Europe/Brussels': 'BE',
  'Europe/Lisbon': 'PT',
  'Pacific/Auckland': 'NZ',
  'Asia/Singapore': 'SG',
  'Asia/Dubai': 'AE',
  'Asia/Riyadh': 'SA',
  'Asia/Jerusalem': 'IL',
  'Europe/Istanbul': 'TR',
  'Africa/Johannesburg': 'ZA',
  'Africa/Lagos': 'NG',
  'Africa/Nairobi': 'KE',
  'Africa/Cairo': 'EG',
  'Africa/Accra': 'GH',
  'Africa/Dar_es_Salaam': 'TZ',
  'Africa/Kampala': 'UG',
  'Africa/Kigali': 'RW',
  'Africa/Lusaka': 'ZM',
  'Africa/Douala': 'CM',
  'Africa/Abidjan': 'CI',
  'Africa/Dakar': 'SN',
  'Africa/Casablanca': 'MA',
  'Asia/Manila': 'PH',
  'Asia/Bangkok': 'TH',
  'Asia/Kuala_Lumpur': 'MY',
  'Asia/Jakarta': 'ID',
  'Asia/Ho_Chi_Minh': 'VN',
  'Asia/Karachi': 'PK',
  'Asia/Dhaka': 'BD',
  'Asia/Colombo': 'LK',
  'America/Bogota': 'CO',
  'America/Santiago': 'CL',
  'America/Argentina/Buenos_Aires': 'AR',
  'America/Lima': 'PE',
  'Europe/Moscow': 'RU',
  'Europe/Kiev': 'UA',
  'Europe/Bucharest': 'RO',
  'Europe/Prague': 'CZ',
  'Europe/Budapest': 'HU',
  'Europe/Athens': 'GR',
};

/**
 * Detect the user's likely country from their browser timezone.
 * Returns the matching index in COUNTRY_CODES, or 0 (US) as fallback.
 */
export function detectCountryIndex(): number {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const iso = TIMEZONE_TO_COUNTRY[tz];
    if (iso) {
      const idx = COUNTRY_CODES.findIndex((c) => c.iso === iso);
      if (idx >= 0) return idx;
    }
  } catch {
    // Fallback: default to US (index 0)
  }
  return 0;
}
