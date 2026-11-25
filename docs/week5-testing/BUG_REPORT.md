# Ghi nhận lỗi và trở ngại tuần 5

## Kết thúc phạm vi đại diện 3C–5 (25/11/2026)

Kết quả CSV hiện tại: **26 PASS, 0 FAIL, 14 PARTIAL, 2 BLOCKED, 21 NOT RUN**. Đã chọn 9 ca chưa hoàn tất cho Web: AUTH-04, HOME-01/03, UI-03/04/05, NET-01/02, FLASH-04. Log/JSON ghi chính xác phần chạy được; chỉ tăng lên PARTIAL, không đổi thành PASS native. Quiz/Flashcard được chạy lại bằng smoke script sẵn có để hồi quy.

Native: adb không có thiết bị; có AVD nhưng không mở trong phạm vi tài nguyên/hạn mức hạn chế. WHPX usable không chứng nhận app native. Xem MANUAL_TEST_GUIDE.md. Không cài hoặc nâng công cụ.

BUG-W5-001 đã sửa bằng CORS allowlist cấu hình rõ ràng, mặc định rỗng; từ chối wildcard, không gửi cookie credentials. Runtime local khai báo 3 origin loopback. Trước: OPTIONS401; sau: origin cho phép200, origin lạ/giả mạo403, endpoint thiếu JWT401, trình duyệt đọc được phản hồi API khác origin. Đây là lỗi cấu hình tích hợp trong ứng dụng; không phải lỗi mạng máy tính. Xem evidence/representative/cors-after.json.

Maven cuối package SUCCESS, **95/95 tests, 0 skip** (thêm một bài CORS; 19 bài tích hợp), lint/typecheck đạt. Quiz Web regression exit0. Lượt package đầu bị khóa JAR do backend đang chạy; đã dừng đúng backend test trước build lại. Các lần sửa locator/khởi động quá sớm của script 3C không tính PASS; log gốc nằm .artifacts. Không phát hiện thêm lỗi ứng dụng đã xác nhận trong phạm vi đại diện.

Tổng ghi nhận: 1 lỗi ứng dụng đã sửa trong lượt này, 2 vấn đề môi trường, 2 vấn đề script (1 đã sửa từ 3B, 1 còn mở). Không tính chúng thành 5 lỗi nghiệp vụ. Không nâng PG17, không sửa My Vocabulary để né blocker.

Các đoạn phía trên mô tả lượt 3B trước sửa (94 tests/CORS OPEN/26 PASS); mục này và CSV là trạng thái mới nhất. Hồ sơ báo cáo đủ 5 mục theo phạm vi giới hạn, không đồng nghĩa hoàn tất mọi test hay nghiệm thu native. Thực hiện commit/push đúng feat/week5-testing theo yêu cầu hiện tại.


## Lịch sử 3B trước lượt sửa CORS

Các trạng thái OPEN/chưa commit và số liệu phía dưới thuộc lượt trước. Trạng thái hiện tại xem mục đầu.

Ngày 25/11/2026, Asia/Saigon. Source kiểm thử: `cf018aab276318ea094dc953eb27163d1f9ce29f`, nhánh `feat/week5-testing`. Chưa sửa mã nghiệp vụ. ID `BUG` là lỗi ứng dụng đã tái hiện; `ENV` là trở ngại môi trường; `TEST` là vấn đề của bộ kiểm thử.

## BUG-W5-001 — Expo Web gọi API khác origin bị chặn bởi CORS

- Trạng thái: **OPEN**, mức độ Medium, ưu tiên P1; ảnh hưởng Web dùng URL API trực tiếp theo README. Chưa xác nhận ảnh hưởng native.
- Môi trường: Expo Web `http://localhost:58126`, Spring Boot `http://127.0.0.1:58125`.
- Tái hiện: gửi `OPTIONS /api/v1/auth/login` với `Origin: http://localhost:58126`, `Access-Control-Request-Method: POST`, `Access-Control-Request-Headers: content-type`.
- Kỳ vọng: origin Web được cấu hình cho môi trường phát triển có thể hoàn tất preflight để gọi login JSON.
- Thực tế: **401**, không có `Access-Control-Allow-Origin`; trình duyệt không thể tiếp tục request khác origin.
- Minh chứng: [web-startup.json](evidence/new-machine/web-startup.json), [log](evidence/new-machine/web-startup-evidence.log). Quan sát từ máy cũ nay đã tái hiện bằng request thật trên máy mới.
- Liên quan: quy trình khởi động Web và lỗi kết nối; không tự đổi trạng thái ca native TC-NET-01/06 vì chưa kiểm thử native.
- Cách tiếp tục kiểm thử: proxy loopback hiện có tại `58127` chuyển Web và API về cùng origin. Đây là cấu hình môi trường, lỗi CORS vẫn OPEN. Chưa sửa `SecurityConfig.java`.

## ENV-W5-001 — PostgreSQL 17 thiếu collation dự án yêu cầu

- Trạng thái: **BLOCKED**, ưu tiên P0 cho việc hoàn tất My Vocabulary trên máy mới.
- Máy có PostgreSQL **17.11**. README và cấu hình dự án yêu cầu PostgreSQL **18.x**. Không cài thêm khi chưa có xác nhận.
- Tái hiện: đăng ký user A1 mới, dùng JWT gọi `GET /api/v1/my-vocabulary` hoặc `/api/v1/my-vocabulary/groups` trên cluster test `127.0.0.1:55436`.
- Thực tế: HTTP **500**; SQLSTATE **42704**, `collation "pg_catalog.pg_unicode_fast" for encoding "UTF8" does not exist`. UI có thông báo tải lỗi và nút thử lại.
- Minh chứng: [lỗi PostgreSQL](evidence/new-machine/postgres17-collation-error.log), [suite API](evidence/new-machine/suite-MyVocabulary-retry.log), [ảnh UI](evidence/new-machine/saved-vocabulary-postgres17.png), [kết quả HTTP](evidence/new-machine/web-startup.json).
- Ảnh hưởng: TC-SAVED-02/05 bị chặn; không suy luận rằng nghiệp vụ sai trên PostgreSQL 18. TC-SAVED-01/04 đã kiểm tra riêng các endpoint không phụ thuộc truy vấn collation này.
- Điều kiện gỡ chặn: PostgreSQL 18 riêng cho test sau khi người dùng cho phép, hoặc cung cấp môi trường PostgreSQL 18 đã có. Không tạo collation giả trên PostgreSQL 17, không thay truy vấn nghiệp vụ để làm test đạt.
- [Tài liệu PostgreSQL 18 về pg_unicode_fast](https://www.postgresql.org/docs/18/collation.html#COLLATION-MANAGING-STANDARD).

## ENV-W5-002 — Thiếu bộ nhớ khả dụng và ổ C hết chỗ

- Lượt chạy đồng thời nhiều JVM và Metro gặp lỗi cấp phát native memory; JVM backend chuẩn bị và một số suite bị ngắt. Ổ C có thời điểm **0 byte trống**, Expo ghi `ENOSPC`, tải DevTools cũng thất bại. Các lượt này không được tính PASS toàn bộ.
- Đã xử lý cấu hình tiến trình: chạy các suite tuần tự, backend `-Xms64m -Xmx384m -XX:MaxMetaspaceSize=256m`, Metro tối đa 2 worker, TEMP/TMP cho Web/Playwright tại `.artifacts/week5-environment/tmp` trên D.
- Maven, Auth và smoke Web đã chạy lại thành công. Log lỗi gốc, JVM crash dump, log Expo ở `.artifacts/week5-environment/`; không đưa crash dump có thể chứa môi trường vào Git.
- Không chỉnh pagefile, không dọn dữ liệu người dùng trên C, không tắt dịch vụ PostgreSQL 17 đang có. Cần theo dõi dung lượng trống trước lượt tiếp theo.

## TEST-W5-001 — Script Auth không đọc được Java Instant trên Python 3.10

- Đã lưu lỗi trước sửa tại `.artifacts/week5-environment/suite-Auth.log`: `ValueError: Invalid isoformat string` với phần thập phân 9 chữ số và hậu tố `Z`.
- Đã điều chỉnh **script test** để rút phần thập phân về microsecond và đổi `Z` thành `+00:00`, giữ kiểm tra thời điểm hết hạn.
- Kiểm thử lại: [Auth suite](evidence/new-machine/suite-Auth-retry.log), exit **0**. Không sửa API/JWT.

## TEST-W5-002 — Web script My Vocabulary dùng locator của UI cũ

- Lượt script hiện có dừng ở `getByText(/Chưa có từ đã lưu\. Bấm ngôi sao/)`, timeout 25 giây: [log](evidence/new-machine/saved-web-final.log).
- Trên PostgreSQL 17, UI thực tế đang ở màn lỗi do ENV-W5-001. Ngoài ra, source UI hiện dùng tiêu đề `Chưa có từ đã lưu`, mô tả `Đánh dấu từ trong Flashcards để thêm vào đây.`, nhóm theo Deck và luồng học đã thay đổi; script vẫn tìm một số chuỗi và cấu trúc cũ.
- Kết luận: cần rà lại locator và hành trình sau khi có PostgreSQL 18. Chưa thể kết luận toàn bộ script sẽ đạt chỉ bằng nâng PostgreSQL. Chưa sửa UI hoặc làm nới assertion để che lỗi.

## Các quan sát validation từ bàn giao

VAL-01–VAL-04 vẫn chưa đủ kiểm chứng đồng thời UI/API trên máy mới. Không nâng các quan sát này thành lỗi đã xác nhận chỉ bằng đọc source hoặc kết quả lịch sử.
