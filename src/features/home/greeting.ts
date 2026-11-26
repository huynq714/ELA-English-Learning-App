/** Use the device's local hour for the Home greeting. */
export function homeGreeting(hour = new Date().getHours()) {
  if (hour >= 5 && hour < 12) return { text: 'Chào buổi sáng', icon: '☀️' };
  if (hour >= 12 && hour < 18) return { text: 'Chào buổi chiều', icon: '🌤️' };
  return { text: 'Chào buổi tối', icon: '🌙' };
}
