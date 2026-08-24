// Place data as returned by API
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
}

export interface GoogleUser {
  name: string;
  email: string;
  picture?: string;
  credential?: string;
}
