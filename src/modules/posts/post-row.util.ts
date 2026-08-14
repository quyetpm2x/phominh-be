export interface PostRow {
  id: string;
  author_id: string;
  post_type: 'life' | 'merchant' | 'emergency';
  status: 'active' | 'removed' | 'expired';
  content: string;
  lat: number;
  lng: number;
  display_mode: 'alias' | 'real_name';
  is_library_photo: boolean;
  vote_count: number;
  comment_count: number;
  expires_at: Date | null;
  created_at: Date;
  text_color: string | null;
  background_color: string | null;
  font_size: 'small' | 'medium' | 'large' | null;
  author_alias: string;
  author_real_name: string | null;
  image_url: string | null;
}

export interface NearbyRow extends PostRow {
  distance_m: number;
}

// Tách khỏi PostsService để test thuần không cần mock Prisma.
export function toBaseSummary(row: PostRow) {
  return {
    id: row.id,
    authorId: row.author_id,
    // Chỉ lộ real_name nếu ĐÚNG bài đó chọn hiện tên thật — không trả author_real_name thô ra ngoài
    // để tránh lộ tên thật ngoài ý muốn khi displayMode='alias' (ranh giới quyền riêng tư).
    authorDisplayName:
      row.display_mode === 'real_name'
        ? (row.author_real_name ?? row.author_alias)
        : row.author_alias,
    postType: row.post_type,
    status: row.status,
    content: row.content,
    lat: row.lat,
    lng: row.lng,
    displayMode: row.display_mode,
    isLibraryPhoto: row.is_library_photo,
    voteCount: row.vote_count,
    commentCount: row.comment_count,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    imageUrl: row.image_url,
    textColor: row.text_color,
    backgroundColor: row.background_color,
    fontSize: row.font_size,
  };
}

// Heuristic tạm — chưa có dữ liệu thực tế để tinh chỉnh (bussiness §7A.2 "cần tự tinh chỉnh dựa trên
// hành vi thực tế người dùng Việt Nam", đối chiếu chỉ số G2).
export function engagementWeight(voteCount: number, commentCount: number): number {
  return voteCount + commentCount * 0.5;
}
