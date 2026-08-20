export interface CommentTreeInput {
  id: string;
  parentCommentId: string | null;
}

// Nhóm danh sách bình luận PHẲNG thành cây 1 cấp (bình luận gốc + mảng replies trực tiếp) — reply
// lồng nhau chỉ hỗ trợ 1 cấp (CommentsService.resolveParentCommentId tự "phẳng hoá" reply-của-reply
// về đúng bình luận gốc lúc tạo, nên input vào đây không bao giờ có 2 cấp lồng). Reply mồ côi (cha
// không có trong danh sách — hiếm, ví dụ cha bị lọc theo visibility) bị bỏ qua thầm lặng.
export function buildCommentTree<T extends CommentTreeInput>(flat: T[]): (T & { replies: T[] })[] {
  const nodes = new Map<string, T & { replies: T[] }>();
  for (const c of flat) nodes.set(c.id, { ...c, replies: [] });

  const topLevel: (T & { replies: T[] })[] = [];
  for (const c of flat) {
    const node = nodes.get(c.id)!;
    if (c.parentCommentId) {
      nodes.get(c.parentCommentId)?.replies.push(node);
    } else {
      topLevel.push(node);
    }
  }
  return topLevel;
}
