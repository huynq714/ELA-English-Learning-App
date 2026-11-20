const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { join, resolve } = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');

const { chromium } = require(resolve('.artifacts/quiz-tools/node_modules/playwright-core'));
const web = `http://127.0.0.1:${process.env.QUIZ_WEB_PORT}`;
const api = `http://127.0.0.1:${process.env.AUTH_SMOKE_PORT}`;
const edge = process.env.QUIZ_EDGE_PATH || join(process.env['ProgramFiles(x86)'], 'Microsoft/Edge/Application/msedge.exe');

async function request(path, { token, method = 'GET', body } = {}) {
  const result = await fetch(api + '/api/v1' + path, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  assert(result.ok, `${path} returned ${result.status}`);
  return result.status === 204 ? undefined : result.json();
}

async function run() {
  const email = `my-vocabulary-web-${randomUUID()}@example.test`;
  const password = process.env.QUIZ_SMOKE_PASSWORD;
  const { accessToken: token } = await request('/auth/register', { method: 'POST', body: {
    email, password, confirmPassword: password, displayName: 'Saved Words Web', englishLevel: 'A1',
  } });
  const decks = await request('/decks', { token });
  const deck = decks.find(item => item.topicKey === 'a1-communication-feelings');
  const [word] = await request(`/decks/${deck.id}/words`, { token });

  const browser = await chromium.launch({ executablePath: edge, headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    page.setDefaultTimeout(25000);
    let postMode = 'offline';
    await page.route('**/api/v1/**', async route => {
      const url = new URL(route.request().url());
      const bookmark = url.pathname === `/api/v1/my-vocabulary/${word.id}` && route.request().method() === 'POST';
      if (bookmark && postMode === 'offline') return route.abort('internetdisconnected');
      const response = await route.fetch({ url: api + url.pathname + url.search, timeout: 20000 });
      if (bookmark && postMode === 'lose-response') {
        assert.equal(response.status(), 204);
        return route.abort('internetdisconnected');
      }
      return route.fulfill({ response });
    });

    let ready = false;
    for (let i = 0; i < 80; i++) {
      try { ready = (await fetch(web + '/status')).ok; } catch {}
      if (ready) break;
      await delay(750);
    }
    assert(ready, 'Metro did not start');
    async function login() {
      await page.goto(web + '/login', { timeout: 180000, waitUntil: 'commit' });
      await page.getByTestId('screen-login').waitFor({ timeout: 180000 });
      await page.getByLabel('Email', { exact: true }).fill(email);
      await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
      await page.getByTestId('login-submit').click();
      await page.getByTestId('screen-home').waitFor();
      await page.getByTestId('tab-vocabulary').click();
    }
    const openSaved = () => page.getByRole('button', { name: 'Bộ từ vựng của tôi', exact: true }).click();
    const empty = page.getByText(/Chưa có từ đã lưu\. Bấm ngôi sao/);
    const rows = page.getByTestId('saved-word-row');
    const saved = page.getByTestId('screen-my-vocabulary');
    await login();
    await openSaved();
    await empty.waitFor();
    await saved.getByRole('button', { name: 'Quay lại' }).click();
    await page.getByRole('button', { name: new RegExp(deck.title) }).click();
    const mark = page.getByRole('button', { name: 'Lưu từ', exact: true });
    const marked = page.getByRole('button', { name: 'Bỏ lưu từ', exact: true });
    await mark.click();
    await page.getByText('Chưa xác nhận được thay đổi. Hãy kiểm tra mạng và thử lại.').waitFor();
    await mark.waitFor();
    assert.equal((await request('/my-vocabulary', { token })).total, 0);
    console.log('PASS Web network failure keeps Bookmark unsaved');

    postMode = 'lose-response';
    await mark.click();
    await marked.waitFor();
    assert.equal((await request('/my-vocabulary', { token })).total, 1);
    console.log('PASS Web recovers Bookmark state after a lost success response');

    await page.goBack({ waitUntil: 'commit' });
    await openSaved();
    await rows.getByText(word.headword, { exact: true }).waitFor();
    await saved.getByRole('button', { name: 'A2', exact: true }).click();
    await page.getByText('Không tìm thấy từ phù hợp.').waitFor();
    await saved.getByRole('button', { name: 'A1', exact: true }).click();
    const search = saved.getByLabel('Tìm từ tiếng Anh hoặc nghĩa tiếng Việt');
    await search.fill('zzzzz');
    await page.getByText('Không tìm thấy từ phù hợp.').waitFor();
    await search.fill(word.meaningVi.toUpperCase());
    await rows.getByText(word.headword, { exact: true }).waitFor();
    console.log('PASS Web supports bilingual search and level filtering');

    await saved.getByRole('button', { name: 'Học lại bằng Flashcards' }).click();
    const review = page.getByTestId('screen-saved-flashcards');
    await review.getByTestId('flashcard-headword').getByText(word.headword, { exact: true }).waitFor();
    assert(!(await review.getByTestId('flashcard-meaning').isVisible()));
    await review.getByTestId('flashcard-flip').click();
    await review.getByTestId('flashcard-meaning').getByText(word.meaningVi, { exact: true }).waitFor();
    await review.getByRole('button', { name: 'Nghe phát âm từ' }).waitFor();
    await review.getByRole('button', { name: 'Nguồn học liệu' }).click();
    const sources = page.getByTestId('vocabulary-sources-dialog');
    await sources.getByRole('link', { name: 'CEFR-J Wordlist v1.6' }).waitFor();
    await sources.getByRole('button', { name: 'Đóng', exact: true }).click();
    assert(!(await review.getByTestId('flashcard-start-quiz').isVisible()));
    assert(!(await review.getByRole('button', { name: 'Again', exact: true }).isVisible()));
    await review.getByRole('button', { name: 'Kết thúc', exact: true }).click();
    await review.getByText('Đã xem hết từ đã lưu').waitFor();
    await review.getByRole('button', { name: 'Về bộ từ của tôi' }).click();
    console.log('PASS Web review reuses card flip, pronunciation control and sources without Quiz or SRS controls');

    await saved.getByRole('button', { name: 'Quay lại' }).click();
    await page.getByTestId('tab-profile').click();
    await page.getByTestId('profile-logout').click();
    await page.getByTestId('screen-profile').waitFor({ state: 'hidden' });
    await login();
    await openSaved();
    await rows.getByText(word.headword, { exact: true }).waitFor();
    await saved.getByRole('button', { name: `Bỏ lưu ${word.headword}` }).click();
    await empty.waitFor();
    assert.equal((await request('/my-vocabulary', { token })).total, 0);
    console.log('PASS Web saved words persist across logout and can be removed');
  } finally {
    await browser.close();
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
