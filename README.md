# TikTok Saver — bản web

Đây là bản chạy trên website; không cần cài ứng dụng Windows. Người dùng có thể dán liên kết video hoặc trang cá nhân, xem ảnh trước, chọn video ở nhiều trang và theo dõi tiến độ tìm/tải.

## Đưa lên Netlify

1. Đẩy nội dung thư mục này lên GitHub.
2. Trong Netlify, chọn **Add new site → Import an existing project** và kết nối repo GitHub.
3. Chọn repo `khanfaun/toptopdownload`, nhánh `main`. Netlify sẽ tự đọc cấu hình trong `netlify.toml`.
4. Bấm deploy. Mỗi lần cập nhật nhánh `main`, Netlify sẽ tự build lại trang.

Thiết lập build được lưu sẵn: lệnh `node scripts/build.mjs`, thư mục xuất bản `dist`, Node.js 22. API tìm video và lấy luồng tải chạy qua Netlify Edge Function tại `/api/*`. Không cần thêm khóa bí mật.

## Chạy thử trên máy

Cần Node.js 22 trở lên.

```powershell
node scripts/build.mjs
node scripts/dev.mjs
```

Mở `http://127.0.0.1:8787`. Khi tải video vào thư mục trên máy, dùng Chrome hoặc Edge mới nhất và chọn **Chọn thư mục lưu**. Nếu trình duyệt không hỗ trợ chọn thư mục, trình duyệt sẽ dùng cách tải file thông thường.

## Lưu ý

- Phần chọn thư mục trên web cần trình duyệt hỗ trợ và kết nối an toàn. Netlify tự cấp HTTPS.
- Khi người dùng đóng trang, trình duyệt có thể dừng lượt tải đang chạy. Hãy giữ trang mở cho tới khi hoàn tất.
- Website lấy bản HD khi dịch vụ cung cấp; không tự đổi sang bản chất lượng thấp.
- Netlify Edge cần truy cập được dịch vụ lấy thông tin video và nguồn video.
