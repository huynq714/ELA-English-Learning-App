const assert = require('node:assert/strict');
const { join, resolve } = require('node:path');
const { randomUUID } = require('node:crypto');
const { chromium } = require(resolve('.artifacts/quiz-tools/node_modules/playwright-core'));

async function run() {
  const web = process.env.REVIEW_WEB_URL || 'http://127.0.0.1:58157';
  const edge = process.env.QUIZ_EDGE_PATH || join(process.env['ProgramFiles(x86)'], 'Microsoft/Edge/Application/msedge.exe');
  const browser = await chromium.launch({ executablePath: edge, headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const user = { id: randomUUID(), email: 'review@example.test', displayName: 'Review Test' };
    const id = randomUUID(), wordId = randomUUID();
    const words = [{ id: wordId, headword: 'apple', partOfSpeech: null, cefrLevel: 'A1', definitionEn: null,
      meaningVi: 'quả táo', ipa: '/ˈæp.əl/', exampleEn: null, exampleVi: null, audioUrl: null,
      sourceMetadata: { vietnamese: { reviewStatus: 'VERIFIED' } } }];
    const session = { sessionId: id, type: 'DUE', status: 'IN_PROGRESS', targetCount: 1, completedCount: 0,
      pendingCount: 1, nextWordId: wordId, nextDueAt: new Date().toISOString(), waiting: false, empty: false,
      items: [{ wordId, againCount: 0, dueAt: new Date().toISOString() }] };
    let submitted;
    let requests = 0;
    await context.route('**/api/v1/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/v1/auth/login') return route.fulfill({ json: {
        accessToken: 'test-token', tokenType: 'Bearer', expiresAt: new Date(Date.now() + 600000).toISOString(), user,
      } });
      if (path === '/api/v1/review/summary') return route.fulfill({ json: {
        dueCount: submitted ? 0 : 1, newCount: submitted ? 0 : 1, learningCount: 0, reviewCount: submitted ? 1 : 0,
        relearningCount: 0, currentStreak: submitted ? 1 : 0, longestStreak: submitted ? 1 : 0, totalCards: 1,
        activeSessionId: null,
      } });
      if (path.endsWith('/rate')) {
        requests++;
        const action = route.request().postDataJSON();
        if (!submitted) {
          submitted = action;
          Object.assign(session, { status: 'COMPLETED', completedCount: 1, pendingCount: 0, nextWordId: null });
          return route.abort('internetdisconnected');
        }
        assert.deepEqual(action, submitted);
        return route.fulfill({ json: { sessionStatus: 'COMPLETED' } });
      }
      if (path.startsWith('/api/v1/review/session/')) return route.fulfill({ json: { session, words } });
      return route.fulfill({ status: 404, json: {} });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(45000);
    async function login() {
      await page.goto(web + '/login');
      await page.getByPlaceholder(/email/i).fill(user.email);
      await page.locator('input[type=password]').fill('fixture-password');
      await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
      await page.getByTestId('screen-home').waitFor();
      await page.getByText('Ôn tập SRS', { exact: true }).click();
    }
    await login();
    await page.getByRole('button', { name: 'Bắt đầu ôn tập' }).click();
    await page.getByTestId('flashcard-flip').click();
    await page.getByTestId('review-rating-EASY').click();
    await page.getByTestId('review-retry-rating').waitFor();
    assert.equal(requests, 1);
    await login();
    await page.getByRole('button', { name: 'Tiếp tục ôn tập' }).click();
    await page.getByTestId('review-retry-rating').click();
    await page.getByTestId('review-complete').waitFor();
    await page.getByTestId('review-retry-rating').waitFor({ state: 'hidden' });
    assert.equal(requests, 2);
    assert.match(submitted.clientRequestToken, /^[0-9a-f-]{36}$/i);
    console.log('PASS Review UI persisted the original rating token across reload and used it on retry');
  } finally {
    await browser.close();
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
