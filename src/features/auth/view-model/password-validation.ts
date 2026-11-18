export function validateNewPassword(password: string, confirmation: string): string | null {
  if (password.length < 8 || password.length > 72 || !/\p{L}/u.test(password) || !/\p{Nd}/u.test(password)) {
    return 'Mật khẩu cần từ 8 đến 72 ký tự, có chữ và số.';
  }
  if (password !== confirmation) return 'Mật khẩu xác nhận chưa khớp.';
  return null;
}
