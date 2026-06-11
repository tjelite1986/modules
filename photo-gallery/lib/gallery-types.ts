export type MediaKind = "image" | "video";
export type GalleryTab = "timeline" | "favorites" | "trash";

export interface GalleryItem {
  id: number;
  user_id: number;
  filename: string;
  storage_key: string;
  kind: MediaKind;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  taken_at: string;
  uploaded_at: string;
  thumbnail_ready: number;
  preview_ready: number;
  is_favorite: number;
  is_deleted: number;
  deleted_at: string | null;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  location_name: string | null;
  rating: number;
  media_version?: number;
  tag_count?: number;
}

export interface AlbumWithCounts {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  cover_item_id: number | null;
  created_at: string;
  updated_at: string;
  item_count: number;
  cover_storage_key: string | null;
  cover_kind: MediaKind | null;
}

export interface ListResult {
  items: GalleryItem[];
  nextCursor: string | null;
}

export interface TagSummary {
  tag: string;
  count: number;
  cover_storage_key: string | null;
  cover_kind: MediaKind | null;
}

export interface MemoryGroup {
  years_ago: number;
  year: number;
  items: GalleryItem[];
}

export interface GalleryStats {
  total_items: number;
  total_size_bytes: number;
  image_count: number;
  video_count: number;
  trash_count: number;
  trash_size_bytes: number;
  album_count: number;
  oldest_taken_at: string | null;
  newest_taken_at: string | null;
}
