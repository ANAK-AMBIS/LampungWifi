// Place data as returned by API
export interface WifiCredential {
  id: number;
  place_id: number;
  ssid: string;
  password: string | null;
  band: '2.4GHz' | '5GHz' | '6GHz' | 'auto';
  password_source: string | null;
  submitted_by_name: string;
  submitted_by_email: string;
  status: 'pending' | 'approved' | 'rejected';
  avg_rating: number;
  rating_count: number;
  created_at: string;
  updated_at: string;
  ratings?: WifiRating[];
}

export interface WifiRating {
  id: number;
  credential_id: number;
  rater_name: string;
  rater_email: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface SpeedTestData {
  id: number;
  place_id: number;
  download_mbps: number | null;
  upload_mbps: number | null;
  ping_ms: number | null;
  jitter_ms: number | null;
  loaded_latency_ms?: number | null;
  packet_loss?: number | null;
  duration_ms?: number | null;
  raw_summary?: any;
  tested_by_name: string;
  tested_by_email: string;
  created_at: string;
}

export interface SpeedStats {
  count: number; // 30d count
  avg_download: number | null;
  avg_upload: number | null;
  avg_ping: number | null;
  avg_jitter: number | null;
  total: number;
  last_test_at: string | null;
}

export interface PlaceData {
  id: number;
  name: string;
  category: string;
  address: string;
  district: string;
  latitude: number | null;
  longitude: number | null;
  wifi_available: boolean;
  wifi_access_type: string | null;
  wifi_password: string | null;
  wifi_ssid: string | null;
  wifi_band: string | null;
  is_hype: boolean;
  password_source: string | null;
  access_notes: string | null;
  wifi_speed_mbps: number | null;
  upload_mbps: number | null;
  ping_ms: number | null;
  has_power_outlets: boolean;
  open_24_hours: boolean;
  quiet_zone: boolean;
  ambience_label: string | null;
  map_context: string | null;
  operating_hours: string | null;
  image_tone: string;
  image_url: string | null;
  submitter_name: string | null;
  submitter_email: string | null;
  status: 'approved' | 'pending' | 'rejected';
  created_at: string;
  updated_at: string;
  // Computed fields from metrics
  avg_rating: number;
  avg_speed_rating: number;
  avg_comfort_rating: number;
  review_count: number;
  reviews?: ReviewData[];
  related_places?: RelatedPlace[];
  wifi_credentials?: WifiCredential[];
  wifi_credentials_total?: number;
  speed_tests?: SpeedTestData[];
  speed_stats?: SpeedStats;
}

export interface ReviewData {
  id: number;
  place_id: number;
  author_name: string;
  author_email?: string;
  review_title: string;
  rating_speed: number;
  rating_comfort: number;
  image_url: string | null;
  comment: string;
  created_at: string;
}

export interface RelatedPlace {
  id: number;
  name: string;
  wifi_speed_mbps: number | null;
}

export interface PlacesResponse {
  data: PlaceData[];
  meta: {
    source: string;
    count: number;
    total: number;
  };
}

export interface PlaceResponse {
  data: PlaceData;
  meta: {
    source: string;
  };
}

export interface PlacesState {
  loading: boolean;
  error: string;
  source: string;
  items: PlaceData[];
  total: number;
}

export interface PlaceState {
  loading: boolean;
  error: string;
  source: string;
  place: PlaceData | null;
}

export interface PlaceFilters {
  q?: string;
  category?: string;
  accessType?: string;
  speed?: string;
  outlets?: boolean;
  open24?: boolean;
  wifi?: string;
  offset?: number;
  status?: string;
  limit?: number;
}

export interface FiltersForm {
  q: string;
  category: string;
  accessType: string;
  speed: string;
  outlets: boolean;
  open24: boolean;
  wifi: boolean;
  offset: number;
}

export interface SubmissionFormData {
  name: string;
  category: string;
  address: string;
  district: string;
  latitude: string;
  longitude: string;
  wifiAvailable: boolean;
  wifiAccessType: string;
  wifiSsid: string;
  wifiBand: string;
  wifiPassword: string;
  passwordSource: string;
  accessNotes: string;
  wifiSpeedMbps: string;
  uploadMbps: string;
  pingMs: string;
  hasPowerOutlets: boolean;
  open24Hours: boolean;
  quietZone: boolean;
  ambienceLabel: string;
  mapContext: string;
  operatingHours: string;
  imageTone: string;
  imageUrl: string;
  submitterName: string;
  submitterEmail: string;
  isHype: boolean;
}

export interface GoogleUser {
  name: string;
  email: string;
  picture?: string;
  credential?: string;
}
