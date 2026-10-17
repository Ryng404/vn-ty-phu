# Cờ Tỷ Phú Việt Nam

Game Cờ Tỷ Phú (Monopoly) online, chơi theo thời gian thực với bạn bè, các ô trên bàn cờ
là 15 tỉnh/thành Việt Nam + sân bay + công ty tiện ích. Backend dùng **Supabase**
(lưu trạng thái phòng + đồng bộ Realtime), frontend là HTML/CSS/JS thuần, host tĩnh trên
**Cloudflare Pages**.

> ⚠️ Lưu ý bảo mật: để đơn giản, mọi người có mã phòng đều đọc/ghi được trạng thái
> phòng đó (không cần đăng nhập). Phù hợp để chơi với bạn bè, **không** phù hợp nếu
> có tiền thật hoặc cần chống gian lận tuyệt đối.

## Các file trong dự án

| File | Vai trò |
|---|---|
| `index.html` | Khung giao diện 3 màn hình: trang chủ, phòng chờ, bàn cờ |
| `style.css` | Giao diện |
| `board-data.js` | Danh sách 28 ô, giá đất, tiền thuê, bộ thẻ Cơ Hội/Vận Mệnh |
| `game.js` | Toàn bộ logic trò chơi + kết nối Supabase |
| `config.js` | **Bạn cần sửa file này** — điền URL và khóa Supabase của bạn |
| `supabase-schema.sql` | Script tạo bảng + cấu hình Realtime trên Supabase |

## Bước 1 — Tạo project Supabase (miễn phí)

1. Vào https://supabase.com → **Start your project** → đăng nhập (GitHub là nhanh nhất).
2. **New project**: đặt tên tuỳ ý, chọn mật khẩu database, chọn khu vực gần Việt Nam
   (ví dụ Singapore), bấm **Create new project** (chờ ~2 phút khởi tạo).
3. Vào mục **SQL Editor** (biểu tượng `>_` ở sidebar) → **New query**.
4. Mở file `supabase-schema.sql` trong dự án này, copy toàn bộ nội dung, dán vào, bấm **Run**.
   Lệnh này tạo bảng `rooms`, bật Row Level Security và bật Realtime.
5. Vào **Project Settings** (biểu tượng bánh răng) → **API**. Ghi lại hai giá trị:
   - **Project URL** (dạng `https://xxxxxxxx.supabase.co`)
   - **anon public key** (chuỗi dài bắt đầu bằng `eyJ...`)

## Bước 2 — Điền thông tin vào `config.js`

Mở `config.js`, thay hai dòng:

```js
export const SUPABASE_URL = 'https://YOUR-PROJECT-REF.supabase.co';
export const SUPABASE_ANON_KEY = 'YOUR-ANON-PUBLIC-KEY';
```

bằng URL và anon key bạn vừa lấy ở Bước 1.

## Bước 3 — Chạy thử trên máy (tuỳ chọn)

Vì `game.js` dùng ES module, cần chạy qua một server tĩnh (không mở trực tiếp file bằng
`file://`). Cách nhanh nhất nếu máy có Python:

```bash
cd vn-ty-phu
python3 -m http.server 8080
```

rồi mở `http://localhost:8080`. Mở 2 tab/trình duyệt khác nhau để thử nhiều người chơi.

## Bước 4 — Deploy lên Cloudflare Pages

**Cách A — kéo-thả, không cần Git (nhanh nhất):**

1. Vào https://dash.cloudflare.com → **Workers & Pages** → **Create** → tab **Pages** →
   **Upload assets**.
2. Đặt tên project, kéo toàn bộ các file (`index.html`, `style.css`, `game.js`,
   `board-data.js`, `config.js` **đã điền key**) vào khung upload — không cần kéo
   `supabase-schema.sql` hay `README.md`.
3. Bấm **Deploy site**. Cloudflare sẽ cho bạn một đường link dạng
   `https://ten-du-an.pages.dev` — gửi link này cho bạn bè là chơi được.

**Cách B — qua GitHub (tiện khi cần cập nhật code sau này):**

1. Đẩy các file này lên một repo GitHub.
2. Trong Cloudflare Pages, chọn **Connect to Git**, chọn repo đó.
3. Build command: để trống. Output directory: `/` (thư mục gốc).
4. Deploy — mỗi lần bạn push code mới, Cloudflare tự build lại.

## Cách chơi

1. Một người bấm **Tạo phòng mới**, nhận được mã phòng 6 ký tự, gửi cho bạn bè.
2. Bạn bè nhập tên + mã phòng → **Tham gia** (tối đa 6 người).
3. Chủ phòng bấm **Bắt đầu ván chơi** khi đủ người (tối thiểu 2).
4. Lần lượt từng người đổ xúc xắc, mua đất, trả tiền thuê. Sở hữu trọn một vùng
   (cùng màu) sẽ được +50% tiền thuê của các ô trong vùng đó.
5. Hết tiền → phá sản, bị loại. Người cuối cùng còn trụ lại thắng cuộc.

## Có thể mở rộng thêm sau

- Xây nhà/khách sạn để tăng tiền thuê theo cấp độ
- Thẻ "thoát tù miễn phí" có thể giữ lại dùng sau
- Giao dịch/đổi đất giữa người chơi với nhau
- Đăng nhập thật (Supabase Auth) nếu muốn chống gian lận chặt hơn
