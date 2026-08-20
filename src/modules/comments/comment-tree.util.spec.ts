import { buildCommentTree } from './comment-tree.util';

describe('buildCommentTree', () => {
  it('giữ nguyên thứ tự khi toàn bộ là bình luận gốc', () => {
    const flat = [
      { id: 'a', parentCommentId: null },
      { id: 'b', parentCommentId: null },
    ];
    const tree = buildCommentTree(flat);
    expect(tree.map((c) => c.id)).toEqual(['a', 'b']);
    expect(tree[0].replies).toEqual([]);
  });

  it('gộp reply vào đúng bình luận gốc, giữ thứ tự reply', () => {
    const flat = [
      { id: 'a', parentCommentId: null },
      { id: 'a1', parentCommentId: 'a' },
      { id: 'a2', parentCommentId: 'a' },
      { id: 'b', parentCommentId: null },
    ];
    const tree = buildCommentTree(flat);
    expect(tree.map((c) => c.id)).toEqual(['a', 'b']);
    expect(tree[0].replies.map((r) => r.id)).toEqual(['a1', 'a2']);
    expect(tree[1].replies).toEqual([]);
  });

  it('bỏ qua thầm lặng reply mồ côi (cha không có trong danh sách)', () => {
    const flat = [
      { id: 'a', parentCommentId: null },
      { id: 'orphan', parentCommentId: 'khong-ton-tai' },
    ];
    const tree = buildCommentTree(flat);
    expect(tree.map((c) => c.id)).toEqual(['a']);
  });
});
