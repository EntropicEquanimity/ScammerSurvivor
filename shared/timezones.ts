// Time zone to country, for the browser's first guess. Manual override wins.
// Every JAPAC country, with its IANA zones and the older link names browsers
// still report. A zone that maps to more than one country sends the player to
// the picker; today every zone here maps to one.

export const JAPAC_COUNTRIES: { code: string; name: string }[] = [
  { code: 'AU', name: 'Australia' },
  { code: 'BD', name: 'Bangladesh' },
  { code: 'BT', name: 'Bhutan' },
  { code: 'BN', name: 'Brunei' },
  { code: 'KH', name: 'Cambodia' },
  { code: 'CN', name: 'China' },
  { code: 'CK', name: 'Cook Islands' },
  { code: 'FJ', name: 'Fiji' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'IN', name: 'India' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'JP', name: 'Japan' },
  { code: 'KI', name: 'Kiribati' },
  { code: 'LA', name: 'Laos' },
  { code: 'MO', name: 'Macau' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'MV', name: 'Maldives' },
  { code: 'MH', name: 'Marshall Islands' },
  { code: 'FM', name: 'Micronesia' },
  { code: 'MN', name: 'Mongolia' },
  { code: 'MM', name: 'Myanmar' },
  { code: 'NR', name: 'Nauru' },
  { code: 'NP', name: 'Nepal' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'NU', name: 'Niue' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'PW', name: 'Palau' },
  { code: 'PG', name: 'Papua New Guinea' },
  { code: 'PH', name: 'Philippines' },
  { code: 'WS', name: 'Samoa' },
  { code: 'SG', name: 'Singapore' },
  { code: 'SB', name: 'Solomon Islands' },
  { code: 'KR', name: 'South Korea' },
  { code: 'LK', name: 'Sri Lanka' },
  { code: 'TW', name: 'Taiwan' },
  { code: 'TH', name: 'Thailand' },
  { code: 'TL', name: 'Timor-Leste' },
  { code: 'TK', name: 'Tokelau' },
  { code: 'TO', name: 'Tonga' },
  { code: 'TV', name: 'Tuvalu' },
  { code: 'VU', name: 'Vanuatu' },
  { code: 'VN', name: 'Vietnam' },
];

const COUNTRY_ZONES: Record<string, string[]> = {
  AU: [
    'Australia/Adelaide', 'Australia/Brisbane', 'Australia/Broken_Hill', 'Australia/Darwin', 'Australia/Eucla',
    'Australia/Hobart', 'Australia/Lindeman', 'Australia/Lord_Howe', 'Australia/Melbourne', 'Australia/Perth',
    'Australia/Sydney', 'Australia/ACT', 'Australia/Canberra', 'Australia/Currie', 'Australia/LHI', 'Australia/NSW',
    'Australia/North', 'Australia/Queensland', 'Australia/South', 'Australia/Tasmania', 'Australia/Victoria',
    'Australia/West', 'Australia/Yancowinna', 'Antarctica/Macquarie',
  ],
  BD: ['Asia/Dhaka', 'Asia/Dacca'],
  BT: ['Asia/Thimphu', 'Asia/Thimbu'],
  BN: ['Asia/Brunei'],
  KH: ['Asia/Phnom_Penh'],
  CN: ['Asia/Shanghai', 'Asia/Urumqi', 'Asia/Chongqing', 'Asia/Chungking', 'Asia/Harbin', 'Asia/Kashgar', 'PRC'],
  CK: ['Pacific/Rarotonga'],
  FJ: ['Pacific/Fiji'],
  HK: ['Asia/Hong_Kong', 'Hongkong'],
  IN: ['Asia/Kolkata', 'Asia/Calcutta'],
  ID: ['Asia/Jakarta', 'Asia/Pontianak', 'Asia/Makassar', 'Asia/Jayapura', 'Asia/Ujung_Pandang'],
  JP: ['Asia/Tokyo', 'Japan'],
  KI: ['Pacific/Tarawa', 'Pacific/Kanton', 'Pacific/Enderbury', 'Pacific/Kiritimati'],
  LA: ['Asia/Vientiane'],
  MO: ['Asia/Macau', 'Asia/Macao'],
  MY: ['Asia/Kuala_Lumpur', 'Asia/Kuching'],
  MV: ['Indian/Maldives'],
  MH: ['Pacific/Majuro', 'Pacific/Kwajalein', 'Kwajalein'],
  FM: ['Pacific/Chuuk', 'Pacific/Pohnpei', 'Pacific/Kosrae', 'Pacific/Truk', 'Pacific/Yap', 'Pacific/Ponape'],
  MN: ['Asia/Ulaanbaatar', 'Asia/Ulan_Bator', 'Asia/Hovd', 'Asia/Choibalsan'],
  MM: ['Asia/Yangon', 'Asia/Rangoon'],
  NR: ['Pacific/Nauru'],
  NP: ['Asia/Kathmandu', 'Asia/Katmandu'],
  NZ: ['Pacific/Auckland', 'Pacific/Chatham', 'NZ', 'NZ-CHAT', 'Antarctica/South_Pole'],
  NU: ['Pacific/Niue'],
  PK: ['Asia/Karachi'],
  PW: ['Pacific/Palau'],
  PG: ['Pacific/Port_Moresby', 'Pacific/Bougainville'],
  PH: ['Asia/Manila'],
  WS: ['Pacific/Apia'],
  SG: ['Asia/Singapore', 'Singapore'],
  SB: ['Pacific/Guadalcanal'],
  KR: ['Asia/Seoul', 'ROK'],
  LK: ['Asia/Colombo'],
  TW: ['Asia/Taipei', 'ROC'],
  TH: ['Asia/Bangkok'],
  TL: ['Asia/Dili'],
  TK: ['Pacific/Fakaofo'],
  TO: ['Pacific/Tongatapu'],
  TV: ['Pacific/Funafuti'],
  VU: ['Pacific/Efate'],
  VN: ['Asia/Ho_Chi_Minh', 'Asia/Saigon'],
};

const invert = (byCountry: Record<string, string[]>): Record<string, string[]> =>
  Object.entries(byCountry).reduce<Record<string, string[]>>(
    (map, [code, zones]) =>
      zones.reduce((inner, zone) => ({ ...inner, [zone]: [...(inner[zone] ?? []), code] }), map),
    {},
  );

export const ZONE_TO_COUNTRIES: Record<string, string[]> = invert(COUNTRY_ZONES);

export function countriesForZone(zone: string): string[] {
  return ZONE_TO_COUNTRIES[zone] ?? [];
}

export function countryName(code: string): string | undefined {
  return JAPAC_COUNTRIES.find((country) => country.code === code)?.name;
}
