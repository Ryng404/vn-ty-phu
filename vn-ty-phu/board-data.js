// Dữ liệu bàn cờ: 28 ô, 4 ô góc + 24 ô còn lại.
// type: 'corner' | 'province' | 'airport' | 'utility' | 'tax' | 'card'
// group: dùng để tính thưởng sở hữu trọn bộ (chỉ áp dụng cho type 'province')

export const START_MONEY = 1500;      // triệu đồng
export const PASS_GO_BONUS = 200;     // triệu đồng
export const JAIL_INDEX = 7;
export const GO_TO_JAIL_INDEX = 21;
export const MAX_JAIL_TURNS = 3;
export const JAIL_BAIL = 50;
export const GROUP_BONUS_MULTIPLIER = 1.5; // sở hữu trọn nhóm -> thuê x1.5

export const GROUP_NAMES = {
  'tay-bac': 'Tây Bắc',
  'thu-do': 'Thủ Đô',
  'dong-bang-bac-bo': 'Đồng Bằng Bắc Bộ',
  'mien-trung': 'Miền Trung',
  'nam-trung-bo': 'Nam Trung Bộ',
  'nam-bo': 'Nam Bộ',
};

export const GROUP_COLORS = {
  'tay-bac': '#7fa8a3',
  'thu-do': '#c1272d',
  'dong-bang-bac-bo': '#d98e4a',
  'mien-trung': '#3d6b5c',
  'nam-trung-bo': '#c9a227',
  'nam-bo': '#4a5fa5',
};

export const TILES = [
  { i: 0,  type: 'corner',   name: 'Khởi Hành' },
  { i: 1,  type: 'province', name: 'Hà Giang',        group: 'tay-bac', price: 60,  rent: 8 },
  { i: 2,  type: 'card',     name: 'Cơ Hội', deck: 'chance' },
  { i: 3,  type: 'province', name: 'Lào Cai',         group: 'tay-bac', price: 80,  rent: 10 },
  { i: 4,  type: 'tax',      name: 'Thuế Thu Nhập', amount: 100 },
  { i: 5,  type: 'airport',  name: 'Sân Bay Nội Bài', price: 100, rentBase: 25 },
  { i: 6,  type: 'province', name: 'Hà Nội',          group: 'thu-do', price: 320, rent: 40 },
  { i: 7,  type: 'corner',   name: 'Đang Thăm / Nhà Tù' },
  { i: 8,  type: 'province', name: 'Ninh Bình',       group: 'dong-bang-bac-bo', price: 140, rent: 16 },
  { i: 9,  type: 'province', name: 'Hạ Long',         group: 'dong-bang-bac-bo', price: 160, rent: 18 },
  { i: 10, type: 'card',     name: 'Vận Mệnh', deck: 'community' },
  { i: 11, type: 'province', name: 'Huế',             group: 'mien-trung', price: 180, rent: 20 },
  { i: 12, type: 'utility',  name: 'Công Ty Điện Lực', price: 120 },
  { i: 13, type: 'province', name: 'Đà Nẵng',         group: 'mien-trung', price: 200, rent: 22 },
  { i: 14, type: 'corner',   name: 'Bãi Đỗ Xe Miễn Phí' },
  { i: 15, type: 'province', name: 'Hội An',          group: 'mien-trung', price: 220, rent: 24 },
  { i: 16, type: 'card',     name: 'Cơ Hội', deck: 'chance' },
  { i: 17, type: 'province', name: 'Nha Trang',       group: 'nam-trung-bo', price: 240, rent: 26 },
  { i: 18, type: 'province', name: 'Đà Lạt',          group: 'nam-trung-bo', price: 260, rent: 28 },
  { i: 19, type: 'airport',  name: 'Sân Bay Cam Ranh', price: 100, rentBase: 25 },
  { i: 20, type: 'province', name: 'Quy Nhơn',        group: 'nam-trung-bo', price: 200, rent: 22 },
  { i: 21, type: 'corner',   name: 'Đi Tù' },
  { i: 22, type: 'province', name: 'Vũng Tàu',        group: 'nam-bo', price: 280, rent: 30 },
  { i: 23, type: 'card',     name: 'Vận Mệnh', deck: 'community' },
  { i: 24, type: 'province', name: 'TP. Hồ Chí Minh', group: 'nam-bo', price: 400, rent: 50 },
  { i: 25, type: 'utility',  name: 'Công Ty Cấp Nước', price: 120 },
  { i: 26, type: 'province', name: 'Cần Thơ',         group: 'nam-bo', price: 300, rent: 32 },
  { i: 27, type: 'province', name: 'Phú Quốc',        group: 'nam-bo', price: 350, rent: 40 },
];

export const BOARD_SIZE = TILES.length;

export const CHANCE_CARDS = [
  { type: 'money', amount: 100, text: 'Trúng vé số! Nhận 100 triệu đồng.' },
  { type: 'money', amount: -50, text: 'Vượt đèn đỏ, nộp phạt 50 triệu đồng.' },
  { type: 'money', amount: 150, text: 'Ngân hàng trả cổ tức 150 triệu đồng.' },
  { type: 'money', amount: -80, text: 'Sửa xe tốn 80 triệu đồng.' },
  { type: 'moveTo', to: 6, text: 'Bay ra Hà Nội công tác gấp!' },
  { type: 'jail', text: 'Bị giữ ở sân bay vì quên giấy tờ — vào tù!' },
  { type: 'moveRelative', amount: 3, text: 'Được xe khách cho đi nhờ — tiến 3 ô.' },
  { type: 'money', amount: 60, text: 'Bán được đặc sản dọc đường, lãi 60 triệu đồng.' },
];

export const COMMUNITY_CARDS = [
  { type: 'money', amount: 200, text: 'Lì xì đầu năm may mắn! Nhận 200 triệu đồng.' },
  { type: 'money', amount: -100, text: 'Đóng học phí cho con, mất 100 triệu đồng.' },
  { type: 'money', amount: 70, text: 'Trúng thầu nhỏ, nhận 70 triệu đồng.' },
  { type: 'money', amount: -40, text: 'Khám sức khỏe định kỳ, mất 40 triệu đồng.' },
  { type: 'moveTo', to: 24, text: 'Chuyển vào TP. Hồ Chí Minh lập nghiệp!' },
  { type: 'money', amount: 120, text: 'Bán đất được giá, nhận 120 triệu đồng.' },
  { type: 'moveRelative', amount: -3, text: 'Xe hỏng dọc đường — lùi lại 3 ô.' },
  { type: 'money', amount: -60, text: 'Từ thiện ủng hộ đồng bào, mất 60 triệu đồng.' },
];
