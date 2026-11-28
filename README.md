# 🏋️ Gym System

Hệ thống quản lý và vận hành phòng gym có hỗ trợ cá nhân hóa cho hội viên.
Đồ án chuyên ngành HK261, ĐH Bách Khoa TP.HCM (Khoa KH&KT Máy tính).

4 vai trò: **Quản trị viên · Quản lý · Huấn luyện viên · Hội viên**.
Trọng tâm kỹ thuật: đặt lớp đồng thời an toàn (bất biến I1, I2) và dự đoán no-show theo từng lượt đặt.

## Công nghệ

| Thành phần | Công nghệ | Cổng |
|---|---|---|
| Web | React 19 + Vite + Tailwind 4 | 5173 |
| API | NestJS + TypeORM + JWT | 3000 (Swagger: `/docs`) |
| AI | Python + FastAPI + scikit-learn | 8000 |
| DB | PostgreSQL 18 (Docker) | 5432 (mặc định) |

## Tiến độ

| Hạng mục | Trạng thái |
|---|---|
| Khung dự án, DB entities, migration Init, seed | ✅ |
| Auth (JWT + refresh xoay vòng), RBAC, quản lý tài khoản | ✅ |
| Members, Packages, Payments | ⬜ bước 2 |
| Trainers, Classes (xung đột lịch) | ⬜ |
| Bookings + Waitlist (chống đặt vượt sức chứa) | ⬜ |
| Check-in QR, điểm danh thủ công, scheduler | ⬜ |
| Dashboard | ⬜ |
| Dự đoán no-show (luật + logistic regression) | ⬜ |
| Giao diện web | ⬜ (hiện là trang mẫu Vite) |

## Chạy nhanh (5 bước)

### 0. Cần cài sẵn
- **Git**, **Node.js LTS (22 trở lên)**
- **Docker** (Docker Desktop, hoặc Docker cài trong WSL2)
- **Python 3.11+** (chỉ cần nếu chạy dịch vụ AI)

### 1. Clone và cài thư viện
```bash
git clone <repo-url> gym-system
cd gym-system
cp .env.example .env          # Windows PowerShell: copy .env.example .env
npm run install:all
```

### 2. Bật database
```bash
npm run db                    # Docker Desktop / Linux / macOS
npm run db:wsl                # Windows dùng Docker trong WSL2
```
Chờ vài giây cho DB sẵn sàng (`docker compose ps` thấy `healthy`).

> Máy đã có PostgreSQL chiếm cổng 5432? Sửa `DB_PORT=5433` trong `.env` rồi chạy lại bước này.

### 3. Tạo bảng và dữ liệu mẫu
```bash
npm run migrate
npm run seed
```

### 4. Chạy
```bash
npm run dev:core              # API + Web
npm run dev                   # API + Web + AI (cần bước "Dịch vụ AI" bên dưới)
```
- API: http://localhost:3000/api
- Swagger: http://localhost:3000/docs
- Web: http://localhost:5173

### 5. Kiểm tra (Windows)
Với API đang chạy ở terminal khác:
```bash
npm run smoke
```
Thấy **TẤT CẢ ĐẠT** là môi trường chuẩn.
Script cần DB vừa seed xong, chạy lại lần 2 thì reset DB trước (xem bên dưới).

## Tài khoản mẫu

Mật khẩu chung: `Passw0rd!`

| Vai trò | Email |
|---|---|
| Quản trị viên | `admin@gym.local` |
| Quản lý | `manager@gym.local` |
| Huấn luyện viên | `trainer1@gym.local` … `trainer3@gym.local` |
| Hội viên | `member1@gym.local` … `member8@gym.local` |

Dữ liệu seed: 2 gói (1 tháng, 10 buổi), 6 lớp trong 3 ngày tới. Lớp "18h ngày mai" có sức chứa 2 để dễ thử lớp đầy và danh sách chờ.

## Thử API bằng Swagger
1. Mở `/docs`, gọi `POST /api/auth/login`, copy `accessToken`.
2. Bấm **Authorize** ở góc trên, dán token.
3. Thử `GET /api/auth/me`, `GET /api/users` (chỉ admin gọi được, vai trò khác sẽ nhận 403).

## Dịch vụ AI (tùy chọn)
```bash
cd apps/ai
python -m venv .venv
.\.venv\Scripts\Activate.ps1          # Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
```
Lần đầu trên Windows nếu bị chặn script: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.
Kiểm tra: http://localhost:8000/health trả `{"ok": true}`.

## Lệnh hay dùng

| Lệnh | Tác dụng |
|---|---|
| `npm run dev:core` / `npm run dev` | Chạy API + Web (+ AI) |
| `npm run db` / `db:wsl` | Bật DB |
| `npm run db:reset` / `db:reset:wsl` | **Xóa sạch DB** rồi bật lại (sau đó chạy `migrate` và `seed`) |
| `npm run migrate` | Chạy migration |
| `npm run seed` | Nạp dữ liệu mẫu (bỏ qua nếu DB đã có dữ liệu) |
| `npm run smoke` | Test tự động auth + RBAC |
| `npm --prefix apps/api run build` | Build API |
| `npm --prefix apps/api run migration:generate -- src/migrations/<Tên>` | Sinh migration sau khi sửa entity |

## Cấu trúc thư mục
```
gym-system/
├─ apps/
│  ├─ api/            NestJS: src/entities, src/migrations, src/auth, src/users, ...
│  ├─ web/            React (Vite)
│  └─ ai/             FastAPI: no-show, chatbot
├─ scripts/           smoke-auth.ps1
├─ docker-compose.yml
└─ .env.example
```

## Quy ước làm việc
- Nhánh `main` luôn chạy được. Mỗi việc một nhánh `feat/...`, merge bằng Pull Request.
- Commit: `feat:`, `fix:`, `chore:`, `docs:`.
- **Không dùng `synchronize`**. Đổi entity thì sinh migration mới và commit chung PR. Người kia pull xong chạy `npm run migrate`.
- Không sửa migration đã được merge.
- Entity mới phải được thêm vào `apps/api/src/entities/index.ts`.
- Không commit `.env`. Biến mới thì thêm vào `.env.example`.
- Where có thể `undefined` thì dựng điều kiện theo kiểu `if (x) where.x = x`, vì TypeORM 1.x ném lỗi khi gặp giá trị `undefined`.

## Gặp lỗi?

| Triệu chứng | Cách xử lý |
|---|---|
| `password authentication failed for user "gym"` | Có Postgres khác chiếm cổng 5432. Đổi `DB_PORT=5433` trong `.env` và chạy lại `npm run db`. Nếu vẫn lỗi: `npm run db:reset` (volume cũ giữ mật khẩu cũ). |
| `ECONNREFUSED` khi migrate hoặc chạy API | DB chưa chạy hoặc chưa healthy. Chạy `npm run db` rồi chờ vài giây. |
| `Unauthorized` / `403` khi test | Token hết hạn (15 phút), đăng nhập lại. 403 nghĩa là sai vai trò. |
| VS Code báo lỗi import dù đã sửa | `Ctrl+Shift+P` → **TypeScript: Restart TS Server**. |
| PowerShell không activate được venv | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`. |
| `smoke` báo sai số user | DB đã bị thêm dữ liệu từ lần chạy trước. `npm run db:reset`, `migrate`, `seed`, rồi chạy lại. |
| Docker trong WSL không chạy | `wsl sudo service docker start` (hoặc bật `systemd=true` trong `/etc/wsl.conf`). |
