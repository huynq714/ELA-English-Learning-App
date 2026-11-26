import assert from 'node:assert/strict';
import test from 'node:test';
import { homeGreeting } from '../src/features/home/greeting.ts';

test('greeting follows device local time, including midnight and period boundaries', () => {
  for (const hour of [0, 4, 18, 23]) {
    assert.deepEqual(homeGreeting(hour), { text: 'Chào buổi tối', icon: '🌙' });
  }
  for (const hour of [5, 11]) assert.equal(homeGreeting(hour).text, 'Chào buổi sáng');
  for (const hour of [12, 17]) assert.equal(homeGreeting(hour).text, 'Chào buổi chiều');
});
