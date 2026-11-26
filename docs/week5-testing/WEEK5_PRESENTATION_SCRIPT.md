# Kịch bản thuyết trình Week 5

Dùng với `ELA_Week5_Testing_20261126_v2.pptx` gồm 13 slide.
Thời lượng nói khoảng 7–8 phút, chưa tính demo trực tiếp. Có thể đổi “em” thành
“nhóm em” theo cách phân công của nhóm. Phần trong ngoặc là hướng dẫn, không đọc.

## Slide 1 — English Learning App (20 giây)

“Em chào thầy và các bạn. Hôm nay em trình bày kết quả tuần 5 của dự án English
Learning App, với nội dung kiểm thử và sửa lỗi. Nhóm đã thực hiện kiểm thử trên
iPhone 14 thật và máy ảo Android. Báo cáo tập trung vào những chức năng đã chạy
thực tế, kèm kết quả và minh chứng sau khi sửa lỗi.”

## Slide 2 — Quy trình kiểm thử (30 giây)

“Nhóm thực hiện theo năm bước thầy yêu cầu. Đầu tiên là lập kế hoạch và xác định
tiêu chí đạt. Tiếp theo, nhóm viết các trường hợp nhập đúng, nhập sai, để trống
và dữ liệu biên. Sau đó thực hiện kiểm thử, ghi nhận lỗi, sửa lỗi và chạy lại
các trường hợp liên quan để kiểm tra kết quả sau sửa.”

## Slide 3 — Phạm vi và môi trường (35 giây)

“Nhóm chọn các chức năng đang hoạt động để kiểm thử: đăng ký, đăng nhập, hồ sơ,
quên mật khẩu bằng OTP, danh sách bộ từ, Flashcard, bộ từ đã lưu và Quiz.
Ngoài chức năng, nhóm còn kiểm tra điều hướng, bàn phím và phục hồi khi mất mạng.
Thiết bị gồm iPhone 14 và máy ảo Android 14 chạy Expo Go. Với bố cục, nhóm dùng
ba kích thước giả lập là 320×568, 390×844 và 430×932.”

## Slide 4 — Test case tài khoản (45 giây)

“Đây là các test case đại diện cho phần tài khoản. Với đầu vào rỗng, ứng dụng
phải báo lỗi và không đăng ký. Khi mật khẩu xác nhận không khớp hoặc email
không đúng định dạng, ứng dụng cũng phải từ chối. Nhóm kiểm tra dữ liệu biên
bằng mật khẩu 7 và 8 ký tự có chữ và số: 7 ký tự bị từ chối, còn 8 ký tự được
chấp nhận. Nhóm cũng kiểm tra email trùng, mật khẩu đăng nhập sai và đúng.
Với OTP, nhóm nhận được email thật, thử mã sai rồi mã đúng và vào được màn đặt
mật khẩu mới.”

(Không đọc từng hàng. Chỉ trỏ vào ba ví dụ: rỗng, sai và biên 7/8 ký tự.)

## Slide 5 — Test case học từ vựng (40 giây)

“Ở phần từ vựng, nhóm kiểm tra tìm kiếm chữ hoa, tìm từ khóa không tồn tại và
xóa từ khóa để khôi phục danh sách. Flashcard phải ẩn nghĩa trước khi lật, và
từ được đánh giá Again phải xuất hiện lại. Chức năng lưu từ phải cập nhật đúng
danh sách và số lượng khi lưu hoặc bỏ lưu. Khi ôn trong thư mục hoặc tab A2,
ứng dụng chỉ lấy đúng các từ thuộc phạm vi đó. Các phần này đã được kiểm tra
trên iPhone; một số luồng còn được chạy tự động trên Android.”

## Slide 6 — Kết quả tự động (35 giây)

“Nhóm dùng ADB và UI Automator để điều khiển máy ảo Android. Bộ smoke test có
11 ca đạt. Bộ mở rộng có 7 ca đạt và 1 ca kiểm tra một phần là audio, vì script
mới kiểm tra thao tác và trạng thái hệ thống, chưa xác nhận bằng việc nghe
âm thanh đầu ra. Riêng Home sau sửa đã đạt ở cả ba kích thước. TypeScript và
ESLint cũng chạy thành công. Các bộ có luồng trùng nhau nên nhóm không cộng
tất cả số lượt chạy thành một tổng test case.”

## Slide 7 — Quiz (35 giây)

“Đối với Quiz, ứng dụng phải chặn khi người dùng chưa học đủ bộ thẻ. Trong
kiểm thử tự động, sau khi chuẩn bị tiến độ học cho tài khoản thử nghiệm qua
API, script trả lời năm câu ngay trên giao diện Android. Nhóm cố ý chọn sai
một câu để kiểm tra phản hồi đáp án đúng. Kết quả cuối cùng là 4 trên 5 câu,
tương ứng 80 phần trăm; giao diện và kết quả API khớp nhau.”

(Chỉ vào ảnh trái: đáp án sai được phản hồi. Ảnh phải: kết quả 4/5.)

## Slide 8 — Mất mạng và phục hồi (35 giây)

“Nhóm kiểm tra mất mạng bằng cách tắt kết nối trên thiết bị rồi tải lại danh
sách bộ từ. Ứng dụng hiển thị lỗi và nút Thử lại thay vì chờ vô hạn. Khi bật
mạng trở lại, danh sách tải được và tài khoản vẫn giữ đăng nhập. Trên iPhone,
nhóm còn thử dừng Backend rồi bật lại; ứng dụng cũng phục hồi bằng nút Thử lại.
Hai ảnh này là bằng chứng mất mạng và phục hồi trên Android.”

## Slide 9 — Bảng lỗi và tình trạng (45 giây)

“Trong quá trình kiểm thử, nhóm ghi nhận hai lỗi hiển thị của ứng dụng. Lỗi
thứ nhất là Home vẫn chào buổi sáng vào ban đêm, do nội dung được ghi cố định.
Lỗi thứ hai là số và nhãn thống kê bị xuống dòng vụn ở màn hình nhỏ. Nhóm ghi
cách tái hiện, mức độ, phụ trách và trạng thái xử lý cho từng lỗi. Hai lỗi này
thuộc phần Frontend và đều đã sửa, kiểm thử lại. Máy ảo còn từng báo System UI
không phản hồi; nhóm ghi riêng là vấn đề môi trường và dùng software GPU, tắt
Vulkan để tiếp tục kiểm thử ổn định.”

## Slide 10 — Home trước và sau sửa (40 giây)

“Đây là ví dụ cụ thể về sửa lỗi và kiểm thử lại. Ở ảnh trước sửa, số 15 bị tách
thành hai dòng, còn các nhãn cũng bị ngắt vụn. Nguyên nhân là icon và phần chữ
cùng chiếm chiều ngang của một ô quá hẹp. Nhóm đổi sang bố cục icon ở trên,
số và nhãn ở dưới cho màn hẹp, đồng thời giữ số trên một dòng. Ảnh bên phải
cho thấy số liệu và nhãn đã đọc được rõ ràng sau sửa.”

## Slide 11 — Kiểm thử lại ba kích thước (25 giây)

“Sau khi sửa Home, nhóm chạy lại ở cả ba kích thước để tránh chỉ sửa đúng một
màn rồi làm ảnh hưởng màn khác. Các kiểm tra về dòng số, nhãn, vị trí và chồng
lấn đều đạt, đồng thời nhóm đã xem ảnh chụp kết quả. Đây là ba kích thước trên
cùng một máy ảo, nên nhóm chưa coi đó là kiểm thử trên ba thiết bị thật.”

## Slide 12 — Phạm vi kiểm thử hiện tại (20 giây)

“Hiện tại dự án chưa hoàn thiện nên chưa có kiểm thử các chức năng còn lại.
Trong báo cáo này, nhóm tập trung vào các chức năng đã thực hiện kiểm thử
trên iPhone và Android Emulator. Các chức năng và biến thể chưa kiểm đầy đủ
sẽ được tiếp tục bổ sung ở các đợt kiểm thử sau.”

## Slide 13 — Demo và kết thúc (20 giây)

“Sau đây em xin demo ngắn các luồng chính: đăng nhập, học Flashcard, lưu từ,
Quiz và phục hồi khi mất mạng. Qua đợt kiểm thử này, nhóm đã có bảng test case,
bằng chứng thực thi và danh sách lỗi kèm kết quả xử lý. Em cảm ơn thầy và các
bạn đã theo dõi.”

## Demo trực tiếp tùy thời gian (3–5 phút)

Trước giờ báo cáo, mở sẵn Backend và Expo, đăng nhập tài khoản demo. Chọn sẵn
một Deck đã học đủ nếu cần mở Quiz. Không chạy bộ auto test khi đang demo tay.

1. **Đăng nhập (30 giây):** thử sai rồi đúng. Nói “Thông tin sai bị từ chối;
   thông tin đúng mới vào được Home.” Mật khẩu phải ở trạng thái ẩn.
2. **Flashcard và lưu từ (60 giây):** mở Deck, lật thẻ, lưu một từ, vào My
   Vocabulary. Nói “Nghĩa chỉ xuất hiện sau khi lật; từ vừa đánh dấu có trong
   danh sách cá nhân.” Không bỏ lưu dữ liệu của người khác.
3. **Quiz (60–90 giây):** dùng Deck đã đủ điều kiện, cố ý sai một câu, chỉ
   phản hồi đáp án và màn điểm. Nếu thời gian ít, dùng ảnh minh chứng ở slide 7.
4. **Mất mạng (30–60 giây):** dùng ca dừng Backend đã kiểm thử nếu kết nối
   hotspot không tiện ngắt Wi-Fi. Nhấn làm mới, xem lỗi, bật Backend lại và
   Thử lại. Nói đúng “Backend không khả dụng” nếu dùng cách dừng Backend.
5. **Lỗi Home (20 giây):** trỏ ảnh trước/sau ở slide 10, không cần đổi độ
   phân giải trực tiếp lúc đang thuyết trình.

## Nếu thầy hỏi

**Tại sao cần cả thiết bị thật và máy ảo?**
“Máy ảo thuận tiện cho chạy lặp và thay kích thước. Thiết bị thật giúp kiểm
tra bàn phím, âm thanh và thao tác thực tế. Nhóm ghi riêng kết quả của hai môi trường.”

**Làm thế nào kết luận lỗi đã sửa?**
“Nhóm chạy lại đúng ca từng gây lỗi, đối chiếu ảnh trước/sau và kiểm tra thêm
các kích thước liên quan. Với Home, cả ba kích thước đều đạt sau sửa.”

**Auto test có xác nhận nghe đúng audio chưa?**
“Chưa. Kết quả tự động audio là PARTIAL vì mới kiểm tra thao tác và telemetry.
Việc nghe từ và câu ví dụ đã kiểm thủ công trên iPhone theo kết quả thực tế.”

**Có phải toàn bộ ứng dụng đã PASS?**
“Không. Báo cáo chỉ kết luận trong phạm vi các ca đã chạy. Các bộ test có
luồng trùng nhau và những ca chưa thực hiện vẫn được giữ trạng thái riêng.”

**Tại sao không sửa System UI trong source ứng dụng?**
“System UI thuộc Android của máy ảo. Nhóm xử lý cấu hình renderer để môi
trường ổn định rồi mới tiếp tục kiểm thử ứng dụng.”

## Lưu ý khi nói

- Dùng bản PowerPoint v2, không dùng bản trước khi đổi slide 12.
- Không tuyên bố đã hoàn tất mọi biến thể hồ sơ, OTP hoặc tất cả thiết bị.
- Không nói cộng 11 + 7 + 3 thành tổng ca duy nhất vì có kiểm thử lặp.
- Chỉ nói “đã nghe audio” đối với phần đã nghe thủ công trên iPhone.
- Ảnh/màn demo không được lộ mật khẩu, OTP hoặc JWT.
