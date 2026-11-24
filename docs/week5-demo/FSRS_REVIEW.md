# Demo ôn tập FSRS

## Database phát triển

Việc áp dụng V1_7 và backfill cần phê duyệt riêng. Sau khi được duyệt, xác nhận database đích bằng `SELECT current_database();`, đối chiếu các migration đã có và tạo bản sao lưu có thể phục hồi.

```powershell
pg_dump -Fc -h localhost -p <port> -U <user> -d <database> -f ela-before-v1-7.dump
pg_restore -l ela-before-v1-7.dump
psql -X -v ON_ERROR_STOP=1 -h localhost -p <port> -U <user> -d <database> -f database/week5/migrations/V1_7__fsrs_persistence.sql
```

Kiểm tra `review_sessions`, `review_session_items`, `review_idempotency`, `user_streaks` và cột `review_cards.learning_step` sau migration. Các database Compose đã có volume dùng cùng quy trình migration trên cổng được cấu hình.

Backfill tùy chọn. Summary đã đếm từ đủ điều kiện trong `user_word_progress` và phiên đầu tạo các thẻ còn thiếu. Nếu cần tạo thẻ trước cho dữ liệu cũ, rà nguồn và thử [script backfill](../../database/week5/import/backfill_fsrs_cards_from_user_word_progress.sql) trên bản sao. So sánh số dòng được thêm, thử chạy lần hai để xác nhận kết quả bằng 0 và kiểm tra số dòng `review_logs` cùng tiến độ Quiz. Sau khi được phê duyệt riêng, mới thực hiện trên database đích.

## Expo Go trên iPhone hoặc Android

1. Kết nối máy tính và điện thoại cùng Wi-Fi. Khởi động backend theo [hướng dẫn LAN trong README](../../README.md#chạy-expo-go-trên-điện-thoại-với-docker). Với backend native, cấu hình `SERVER_ADDRESS` là IPv4 Wi-Fi của máy tính khi khởi động Spring Boot.
2. Ở thư mục app, đặt `EXPO_PUBLIC_API_BASE_URL` thành `http://<IPv4-Wi-Fi-của-máy-tính>:8080`. Kiểm tra `/api/v1/health` từ điện thoại, rồi chạy `npm.cmd ci` và `npx.cmd expo start --go --lan --port 0`. Quét QR bằng Expo Go.
3. Đăng nhập, học ít nhất hai từ bằng Flashcards. Mở **Ôn tập hôm nay** và kiểm tra số từ đến hạn. Bắt đầu DUE, lật thẻ rồi chấm **Again** trên một từ. Kiểm tra thẻ còn lại và thời gian chờ cho từ cần ôn lại.
4. Đóng và mở lại app. Vào Review, chọn **Tiếp tục ôn tập** và kiểm tra hàng đợi. Khi đến hạn, dùng **Easy** để hoàn tất rồi đối chiếu tiến độ và streak trên Home.
5. Khi không còn thẻ đến hạn, mở **Ôn tập tự nguyện**, hoàn tất CRAM và xác nhận streak giữ nguyên. Thử bookmark và đổi trình độ A1/A2 để xác nhận lịch sử ôn còn truy cập được.
6. Trong lần kiểm thử mất mạng, gửi rating rồi ngắt kết nối trước khi nhận phản hồi. Kết nối lại và chọn **Gửi lại đánh giá**. Backend cần ghi tối đa một review log cho thao tác.
