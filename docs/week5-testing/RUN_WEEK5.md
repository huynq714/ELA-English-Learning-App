# Chạy demo và kiểm thử Week 5

Chạy từ thư mục gốc dự án. Bốn script PowerShell mới đã qua kiểm tra cú pháp;
chưa chạy lại launcher có nhập credential trong phiên này để tránh dừng Backend/Expo
đang dùng. Các lệnh và test thành phần đã được thực thi theo báo cáo tương ứng.

## 1. Backend, PostgreSQL, JWT và Gmail OTP trong một lệnh

```powershell
Set-Location 'D:\My Project\Project 6 - Mobile\English Learning App'
.\scripts\start-backend-week5.ps1
```

Nhập username PostgreSQL, password PostgreSQL, Gmail gửi OTP và Google App Password.
Password được nhập ẩn, App Password tự bỏ khoảng trắng. Script dùng DB hiện có
`english_learning_db` ở `127.0.0.1:5432`, không tạo DB/schema. JWT key lấy từ biến
`AUTH_JWT_SECRET` đã có; nếu thiếu thì sinh ngẫu nhiên trong bộ nhớ phiên local.
Không ghi credentials vào file hoặc in chúng ra console. Khóa mới yêu cầu đăng nhập
lại. Chạy profile default, bind LAN `0.0.0.0:8080`; endpoint dev local không bật.

**Google sign-in chưa triển khai.** Nút hiện tại chỉ mở thông báo demo.
Google App Password ở đây phục vụ **Gmail SMTP gửi OTP**, không bật Google OAuth.

Giữ terminal mở. Nếu PowerShell chặn script, dùng đúng file local đã xem:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-backend-week5.ps1
```

## 2. Máy ảo Android

Ở terminal riêng, chỉ chạy nếu máy ảo chưa mở:

```powershell
.\scripts\start-android-week5.ps1
```

AVD hiện có `ELA_Pixel2_API34`, SDK/AVD trên ổ D. Dùng software GPU, tắt Vulkan và
snapshot theo cấu hình đã chạy ổn định. Không wipe data. Chờ màn hình chính Android.

## 3. Một Expo dùng cho cả Android và iPhone 14

Dừng Metro cũ bằng Ctrl+C trước khi chạy để tránh nhiều server/cấu hình API khác nhau.
Ở terminal khác:

```powershell
.\scripts\start-expo-week5.ps1
```

Script hiển thị ipconfig và hỏi IPv4 Wi-Fi của laptop. Nhập IPv4 hiện tại, không nhập
localhost hay `10.0.2.2`. Có thể truyền thẳng IP đã xác minh bằng `-LanIp`.
Script đặt `EXPO_PUBLIC_API_BASE_URL=http://<LAN-IP>:8080` cho cả hai thiết bị.

- iPhone: cùng mạng với laptop, quét QR và mở lại app để nhận URL mới.
- Emulator: nhấn `a` trong terminal Expo; máy ảo phải truy cập được IP LAN đó.
- Kiểm tra Safari iPhone mở `http://<LAN-IP>:8080/api/v1/health` trước nếu không kết nối.
- Không mở PostgreSQL ra LAN. Các script không thay Firewall.
- Giữ Expo ở port 8081 để bộ test Android dùng deep link hiện tại. Nếu bị hỏi đổi
  port, kiểm tra Metro cũ trước; runner hiện mặc định port 8081.
- Khi đổi mạng, chạy lại Expo script với IP Wi-Fi mới; không cần thay source.

## 4. Chạy các kiểm tra tự động đã sử dụng

Backend/Expo/máy ảo phải chạy sẵn. Một terminal riêng, không thao tác máy ảo trong lúc test:

```powershell
.\scripts\run-week5-tests.ps1 -IncludeAndroid -IncludeIpaAdapter
```

Lần lượt: TypeScript, lint, mốc giờ lời chào, IPA catalogue/input, Expo web export,
Maven, IPA Python adapter unit tests, Android smoke, Android extended và Home layout.
Không tải model/dataset. Chỉ bật IPA adapter unit khi venv cache hiện có còn tồn tại;
không cần chạy engine service cho unit tests. Máy yếu có thể bỏ `-IncludeIpaAdapter`.

Maven có thể SKIP PostgreSQL integration khi thiếu `FSRS_TEST_JDBC_*`; không tính
những ca này là PASS. Không tự trỏ các biến test tới DB phát triển. Script chỉ ghi
trạng thái command; kết luận ca kiểm thử lấy trong report từng bộ, gồm PARTIAL audio.

Runner Android tạo user test riêng và lưu study/Quiz history của user đó qua API;
không xóa user/dữ liệu có sẵn và không chạy migration. Mỗi lượt tạo fixture mới.
Kết quả/ảnh mới ở `.artifacts/week5-*`. Script extended tạm đổi mạng/kích thước
máy ảo, có khôi phục khi kết thúc bình thường. Tránh force-kill khi đang test.

Chạy riêng:

```powershell
python .\docs\week5-testing\scripts\android-smoke.py
python .\docs\week5-testing\scripts\android-smoke.py --extended
python .\docs\week5-testing\scripts\android-smoke.py --home-only
```

## 5. Các ca thủ công không nằm trong một lệnh auto

- iPhone: W5-01–16 và các biến thể đăng ký đã hướng dẫn trong phiên kiểm thử.
- OTP Gmail thật: gửi thư, mã sai/đúng, đặt mật khẩu và đăng nhập lại.
- Nghe đúng từ/câu: telemetry không thay việc nghe đầu ra.
- Cỡ chữ lớn và bàn phím native trên iPhone.
- Xác nhận còn thiếu: mở lại Profile sau đổi tên, mật khẩu cũ/mới theo từng bước,
  đổi level tự cập nhật không nhấn Làm mới, học từ đã lưu tab A1.

Không biến các bước còn thiếu thành PASS. Xem `ANDROID_SMOKE_REPORT.md` và
`ANDROID_EXTENDED_REPORT.md` cho bằng chứng tự động, giới hạn và lỗi đã sửa.

## 6. Demo báo cáo khoảng 5–7 phút

1. Login sai/đúng; Vocabulary đúng level.
2. Lật Flashcard, Bookmark, mở My Vocabulary.
3. Quiz với một câu sai và kết quả 4/5, 80%.
4. Lỗi mạng và thử lại; giữ phiên đăng nhập.
5. So sánh Home 320 trước/sau sửa, ba ảnh retest.

PowerPoint được lưu trong `.artifacts/week5-report/output/`, ngoài Git.
Không đưa ảnh lộ mật khẩu, OTP, JWT hoặc email cá nhân vào slide.
