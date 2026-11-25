const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { randomUUID } = require('node:crypto');
const { chromium } = require(resolve('.artifacts/quiz-tools/node_modules/playwright-core'));

async function main() {
  const output = resolve('docs/week5-testing/evidence/new-machine');
  mkdirSync(output, { recursive: true });
  const api = 'http://127.0.0.1:58125/api/v1';
  const web = 'http://127.0.0.1:58127';
  const password = 'Ela7-' + randomUUID();
  const email = `startup-${randomUUID()}@example.test`;
  const registered = await fetch(api + '/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, confirmPassword: password,
      displayName: 'Week 5 New Machine', englishLevel: 'A1' }),
  });
  assert.equal(registered.status, 201);
  console.log('Fixture registered');
  const account = await registered.json();
  const headers = { Authorization: `Bearer ${account.accessToken}` };
  const decks = await (await fetch(api + '/decks', { headers })).json();
  const summary = await (await fetch(api + '/review/summary', { headers })).json();
  assert.equal(decks.length, 3);
  assert.equal(summary.learnedCount, 0);
  console.log('Real database endpoints verified');
  const preflight = await fetch(api + '/auth/login', { method: 'OPTIONS', headers: {
    Origin: 'http://localhost:58126', 'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'content-type',
  } });
  console.log('Preflight response recorded');
  const browser = await chromium.launch({
    executablePath: process.env.QUIZ_EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true,
  });
  console.log('Browser launched');
  const result = { api: [], pageErrors: [], decks: decks.length, summary,
    preflight: { status: preflight.status, allowOrigin: preflight.headers.get('access-control-allow-origin') } };
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', e => result.pageErrors.push(e.message));
    page.on('response', r => {
      const path = new URL(r.url()).pathname;
      if (path.startsWith('/api/v1/')) result.api.push({ path, status: r.status() });
    });
    await page.goto(web + '/login', { timeout: 180000, waitUntil: 'domcontentloaded' });
    await page.getByTestId('screen-login').waitFor({ timeout: 180000 });
    console.log('Login screen rendered');
    await page.screenshot({ path: output + '/web-login.png' });
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
    await page.getByTestId('login-submit').click();
    await page.getByTestId('screen-home').waitFor({ timeout: 45000 });
    await page.getByText('Week 5 New Machine', { exact: false }).first().waitFor();
    await page.screenshot({ path: output + '/web-home.png' });
    result.loginRendered = true;
    result.homeRendered = true;
    assert.equal(result.pageErrors.length, 0);
    console.log('PASS real API registration, decks, summary and Web Login -> Home');
    console.log(`OBSERVED cross-origin OPTIONS: ${preflight.status}, allow-origin=${result.preflight.allowOrigin}`);
    if (process.argv.includes('--capture-saved-error')) {
      await page.getByTestId('tab-vocabulary').click();
      const response = page.waitForResponse(r => new URL(r.url()).pathname === '/api/v1/my-vocabulary/groups');
      await page.getByRole('button', { name: 'Bộ từ vựng của tôi', exact: true }).click();
      const savedResponse = await response;
      await page.getByText('Chưa tải được bộ từ đã lưu.', { exact: true }).waitFor();
      await page.screenshot({ path: output + '/saved-vocabulary-postgres17.png' });
      result.savedVocabulary = { http: savedResponse.status(), errorVisible: true, status: 'BLOCKED' };
      console.log(`OBSERVED My Vocabulary HTTP ${savedResponse.status()} and visible load error (PostgreSQL 17)`);
    }
  } finally {
    await browser.close();
    writeFileSync(output + '/web-startup.json', JSON.stringify(result, null, 2));
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
