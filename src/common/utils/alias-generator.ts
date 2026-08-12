// Sinh bí danh cố định lúc tạo tài khoản — tính từ + danh từ + số (tai-lieu-cong-nghe-backend.md
// §7D.3 #10 / tài liệu bussiness §4.3). Hàm thuần túy, không phụ thuộc DB — nơi gọi (AuthService)
// tự lặp lại tới khi tìm được giá trị chưa trùng trong bảng users.
const ADJECTIVES = [
  'NhanhNhen',
  'AmAp',
  'ThanThien',
  'ChanThat',
  'VuiVe',
  'NangDong',
  'TinhTe',
  'HienHoa',
  'ManhMe',
  'DangYeu',
];

const NOUNS = ['HangXom', 'CuDan', 'NguoiHangPho', 'BanLangGieng', 'NguoiQuen', 'CuTanKhu'];

export function generateAliasCandidate(): string {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const number = Math.floor(1000 + Math.random() * 9000); // 4 chữ số, đủ không gian tránh trùng thường xuyên
  return `${adjective}${noun}${number}`;
}
