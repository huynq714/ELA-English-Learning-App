# Hướng dẫn kiểm thử native bổ sung

Chưa có kết quả Native Mobile trong lượt 3C này. Web viewport không thay thế Android/iOS. Máy có SDK và AVD Medium_Phone API35; adb chưa có thiết bị. Không mở thêm AVD trong phiên giới hạn tài nguyên/hạn mức, không cài công cụ mới. Emulator accel-check báo WHPX usable nhưng không phải bằng chứng app chạy.

1. Khi có đủ bộ nhớ/dung lượng, mở AVD Medium_Phone từ Android Studio hiện có, hoặc dùng điện thoại có Expo Go tương thích SDK58. Không cần cài lại Android Studio. Kiểm tra `adb devices -l` bằng SDK/platform-tools/adb.exe.
2. Runtime test: PostgreSQL55436, backend58125. Emulator dùng API `http://10.0.2.2:58125`; điện thoại dùng IPv4 LAN của máy, cùng Wi-Fi. Với điện thoại, bind backend vào IPv4 LAN được xác minh qua SERVER_ADDRESS, mở health từ điện thoại trước. Không mở PostgreSQL ra LAN.
3. Terminal Expo: đặt EXPO_PUBLIC_API_BASE_URL đúng địa chỉ trên rồi `npm.cmd start -- --go --lan --port 58126`. Tránh chạy Metro trùng cổng; khởi động lại Metro khi đổi URL. Quét QR/mở Android trên AVD. Không dùng URL localhost của điện thoại cho backend trên máy tính.

| Ca | Thao tác ngắn | Đạt khi |
| --- | --- | --- |
| AUTH-04 | Login A, đóng/mở app; logout; Back/deep link Profile; login B | Khôi phục đúng A; logout không vào màn bảo vệ; B không thấy dữ liệu A |
| HOME-02/03 | Học 2 từ, về Home, mở Review, tiếp tục phiên | Số khớp summary, chuyển đúng màn và phiên |
| FLASH-02/03/04 | Lật nhanh, Again/Hard/Good/Easy; nghe từ/ví dụ; giảm chuyển động | Không crash; tiến độ đúng, nghe được hoặc báo lỗi rõ |
| QUIZ-01/04 | Học đủ, làm Quiz; rời và mở lại | Đủ 5 câu, giữ đáp án đã chấm và kết quả |
| UI-03/04/05 | Màn nhỏ, tăng cỡ chữ, mở bàn phím form, Back phần cứng | Đọc/cuộn/bấm nút được, route bảo vệ đúng |
| NET-01/02/06 | Sau tải bundle, ngắt Wi-Fi lúc login/tải Deck, nối lại và thử lại | Kết thúc chờ, báo lỗi; phục hồi đúng user/dữ liệu |

Ghi model/OS/Expo Go, ngày giờ, ID ca, đầu vào và kết quả từng biến thể; chụp 2–3 ảnh đại diện không chứa mật khẩu/JWT/OTP. Chỉ cập nhật CSV thành PASS khi đủ phạm vi hàng; kiểm một phần ghi PARTIAL. PG17 tiếp tục chặn My Vocabulary; Gmail thật cần cấu hình riêng. Không dùng tài khoản cá nhân thật để thử mất mạng/reset.
