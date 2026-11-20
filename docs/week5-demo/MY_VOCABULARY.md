# Bộ từ vựng của tôi

## Cập nhật PostgreSQL

- **pgAdmin:** mở Query Tool của `english_learning_db`, mở và chạy toàn bộ [V1_6__user_saved_words.sql](../../database/week5/migrations/V1_6__user_saved_words.sql). Đợi thông báo `COMMIT`. Có thể xác nhận bằng `SELECT to_regclass('public.user_saved_words');`.
- **Docker:** volume mới tự chạy migration. Với volume đã có, chạy các lệnh sau ở thư mục gốc repo.

```powershell
docker compose up -d db
docker compose exec -T db sh -ec 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/009-my-vocabulary.sql'
docker compose up --build -d backend
```

## Demo trên Expo Go

1. Khởi động Backend theo [README](../../README.md) và mở Expo Go với địa chỉ IP LAN của laptop. Với Backend chạy native, giữ profile `local` tắt khi mở Backend ra LAN. Điện thoại và laptop cần kết nối được với nhau.
2. Đăng nhập tài khoản có trình độ A1. Vào **Từ vựng**, mở một Deck và bấm ngôi sao trên thẻ để lưu từ.
3. Về **Từ vựng → Bộ từ vựng của tôi**. Tìm bằng từ tiếng Anh hoặc nghĩa tiếng Việt, sau đó thử bộ lọc A1 và A2.
4. Đổi Profile sang A2 và quay lại danh sách. Từ A1 đã lưu vẫn xuất hiện ở **Tất cả** và **A1**. Đăng xuất rồi đăng nhập lại để kiểm tra dữ liệu vẫn còn.
5. Bấm **Học lại bằng Flashcards**, lật thẻ, thử nút loa và mở nguồn học liệu. Phiên học đi qua các từ đã lưu của tài khoản, ghi nhận vị trí trong phiên trên màn hình và không cập nhật Quiz, FSRS hoặc streak.
6. Về danh sách, bấm **Bỏ lưu**. Có thể tắt kết nối mạng trước khi bấm để thử thông báo lỗi, rồi nối lại và thử lại.

## API

Tất cả yêu cầu JWT. Danh sách hỗ trợ `query`, `level=A1|A2`, `page` bắt đầu từ 0 và `size` từ 1 đến 100.

| Method | URL | Kết quả thành công |
| --- | --- | --- |
| GET | `/api/v1/my-vocabulary` | `200`, danh sách phân trang |
| GET | `/api/v1/my-vocabulary/count` | `200`, tổng số từ đã lưu duy nhất |
| GET | `/api/v1/my-vocabulary/groups?query=` | `200`, nhóm theo Deck hệ thống, số từ và tối đa ba từ xem trước |
| GET | `/api/v1/my-vocabulary/{wordId}` | `200`, trạng thái `saved` của người đang đăng nhập |
| POST | `/api/v1/my-vocabulary/{wordId}` | `204`, lưu từ hoặc giữ bản ghi đã tồn tại |
| DELETE | `/api/v1/my-vocabulary/{wordId}` | `204`, bỏ lưu hoặc giữ trạng thái chưa lưu |

API trả `404` khi lưu một từ mới ngoài Deck được phép truy cập.
Danh sách từ trong một nhóm dùng cùng API danh sách với tham số `groupId`. Một từ thuộc nhiều Deck được tính một lần trong tổng số đã lưu và một lần trong mỗi Deck tương ứng.
