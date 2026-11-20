const assert = require('node:assert/strict');
const { dirname, join, resolve } = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const { randomUUID } = require('node:crypto');

const { chromium } = require(resolve('.artifacts/quiz-tools/node_modules/playwright-core'));
const web = `http://127.0.0.1:${process.env.QUIZ_WEB_PORT}`;
const api = `http://127.0.0.1:${process.env.AUTH_SMOKE_PORT}`;
const edge = process.env.QUIZ_EDGE_PATH || join(process.env['ProgramFiles(x86)'], 'Microsoft/Edge/Application/msedge.exe');

async function backend(path, body, token) {
  const response = await fetch(`${api}/api/v1${path}`, {
    ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}),
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  assert(response.ok, `${path} returned ${response.status}`);
  return response.json();
}

async function waitForText(page, text) {
  await page.getByText(text, { exact: true }).first().waitFor();
}

function playbackFixture() {
  // Four seconds of PCM silence lets the test observe interruption without depending on CDN access.
  const bytes = Buffer.alloc(44 + 4 * 8000 * 2);
  bytes.write('RIFF', 0);
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(8000, 24);
  bytes.writeUInt32LE(16000, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36);
  bytes.writeUInt32LE(bytes.length - 44, 40);
  return bytes;
}

async function run() {
  const email = `quiz-web-${randomUUID()}@example.test`;
  const password = process.env.QUIZ_SMOKE_PASSWORD;
  const session = await backend('/auth/register', {
    email, displayName: 'Quiz web E2E', password, confirmPassword: password, englishLevel: 'A1',
  });
  const decks = await backend('/decks', null, session.accessToken);
  const deck = decks.find(item => item.topicKey === 'a1-communication-feelings');
  const words = await backend(`/decks/${deck.id}/words`, null, session.accessToken);
  const translations = new Map(words.map(word => [word.headword, word.meaningVi]));
  const originals = new Map(words.map(word => [word.meaningVi, word.headword]));

  const browser = await chromium.launch({ executablePath: edge, headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 }, serviceWorkers: 'block', reducedMotion: 'no-preference',
    });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    await page.addInitScript(() => {
      window.flashcardSpeech = [];
      window.flashcardMedia = [];
      const play = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () {
        const playback = play.call(this);
        playback.then(() => window.flashcardMedia.push({ url: this.currentSrc, media: this })).catch(() => {});
        return playback;
      };
      window.speechSynthesis.speak = utterance => {
        window.flashcardSpeech.push(utterance.text);
        utterance.onend?.();
      };
    });
    let startFailure = 'offline';
    let loseAnswerResponse = true;
    let loseSubmitResponse = true;
    let savedSubmission;
    let currentQuiz;
    await page.route('**/api/v1/**', async route => {
      const url = new URL(route.request().url());
      const starting = url.pathname === '/api/v1/quiz/attempts';
      const submitting = url.pathname.endsWith('/submit');
      const grading = url.pathname.endsWith('/answers');
      if (starting && startFailure !== null) {
        if (startFailure === 'offline') return route.abort('internetdisconnected');
        return route.fulfill({ status: startFailure, json: { code: 'TEST_ERROR', message: 'Injected test error' } });
      }
      const response = await route.fetch({ url: api + url.pathname + url.search, timeout: 20000 });
      if (starting && response.ok()) currentQuiz = await response.json();
      if (grading && loseAnswerResponse) {
        assert(response.ok(), 'Backend should save the choice before its feedback is lost');
        loseAnswerResponse = false;
        return route.abort('internetdisconnected');
      }
      if (submitting && loseSubmitResponse) {
        assert(response.ok(), 'Backend should commit before the reply is lost');
        loseSubmitResponse = false;
        savedSubmission = route.request().postDataJSON();
        return route.abort('internetdisconnected');
      }
      if (submitting && savedSubmission) {
        assert.deepEqual(route.request().postDataJSON(), savedSubmission, 'The retry must keep the original choices');
        savedSubmission = undefined;
      }
      return route.fulfill({ response });
    });

    let metroReady = false;
    for (let i = 0; i < 60; i++) {
      try { metroReady = (await fetch(web + '/status')).ok; } catch {}
      if (metroReady) break;
      await delay(750);
    }
    assert(metroReady, 'Expo Metro did not start');
    await page.goto(web + '/login', { timeout: 180000, waitUntil: 'commit' });
    await page.getByTestId('screen-login').waitFor({ timeout: 180000 });
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
    await page.getByTestId('login-submit').click();
    await page.getByTestId('screen-home').waitFor({ timeout: 60000 });
    console.log('PASS Web login enters Home');
    await page.getByTestId('tab-vocabulary').click();
    const sources = page.getByRole('button', { name: 'Nguồn học liệu', exact: true });
    const sourceDialog = page.getByTestId('vocabulary-sources-dialog');
    const closeSources = sourceDialog.getByRole('button', { name: 'Đóng', exact: true });
    await sources.click();
    await sourceDialog.getByRole('link', { name: 'CEFR-J Wordlist v1.6' }).waitFor();
    await sourceDialog.getByText('Yukio Tono – Tokyo University of Foreign Studies').waitFor();
    await closeSources.click();
    await sourceDialog.waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: new RegExp(deck.title) }).click();
    await page.getByTestId('screen-flashcard').waitFor();
    const quizEntry = page.getByTestId('flashcard-start-quiz');
    const card = page.getByTestId('flashcard-content');
    const heading = card.getByTestId('flashcard-headword');
    const surface = card.getByTestId('flashcard-surface');
    const flip = card.getByTestId('flashcard-flip');
    const meaning = card.getByTestId('flashcard-meaning');
    const good = page.getByRole('button', { name: 'Good', exact: true });
    await heading.waitFor();
    const firstWord = await heading.textContent();
    const data = words.find(word => word.headword === firstWord);
    assert(!(await meaning.isVisible()), 'The front must hide the meaning');
    await card.getByText(data.exampleEn, { exact: true }).waitFor();
    const translatedExample = card.getByText(data.exampleVi, { exact: true });
    assert(!(await translatedExample.isVisible()), 'The front must hide the translated example');
    assert(parseFloat(await surface.evaluate(element => getComputedStyle(element).borderTopWidth)) >= 2);
    assert(!(await quizEntry.isVisible()));
    const evidence = dirname(process.env.QUIZ_SMOKE_STATE);
    await page.screenshot({ path: join(evidence, 'flashcard-front-web.png') });

    const initialTransform = await surface.evaluate(element => getComputedStyle(element).transform);
    const rotation = page.waitForFunction(initial => {
      const panel = document.querySelector('[data-testid="flashcard-surface"]');
      return panel && getComputedStyle(panel).transform !== initial;
    }, initialTransform);
    await flip.click();
    await rotation;
    await meaning.waitFor();
    assert.equal(await meaning.textContent(), data.meaningVi);
    await translatedExample.waitFor();
    await page.locator('[data-testid="flashcard-flip"]:not([aria-disabled="true"])').waitFor();
    await page.screenshot({ path: join(evidence, 'flashcard-back-web.png') });
    await page.getByRole('button', { name: 'Nghe câu ví dụ' }).click();
    await page.waitForFunction(value => window.flashcardSpeech.includes(value), data.exampleEn);

    await flip.click();
    await heading.waitFor();
    assert(!(await meaning.isVisible()), 'Flipping back must hide the meaning');
    await page.getByRole('button', { name: 'Again', exact: true }).click();
    await heading.filter({ hasNotText: firstWord }).waitFor();
    let usedRecording = false;
    let usedSpeech = false;
    for (let studied = 0; studied < words.length; studied++) {
      const current = await heading.textContent();
      const word = words.find(item => item.headword === current);
      assert(!(await meaning.isVisible()), 'Every new card must start on the front');
      assert(!(await quizEntry.isVisible()), 'Quiz must stay outside the study screen');
      if (studied === words.length - 1) assert.equal(current, firstWord, 'Again queues the card at the end');
      const speaker = card.getByRole('button', { name: 'Nghe phát âm từ', exact: true });
      assert.equal((await speaker.textContent())?.trim(), '', 'The speaker button should show only an icon');
      if (word.audioUrl && !usedRecording) {
        await sources.click();
        await sourceDialog.getByText('Bản ghi phát âm', { exact: true }).waitFor();
        await sourceDialog.getByRole('link', { name: /Free Dictionary API \(en-US\)/ }).waitFor();
        await page.screenshot({ path: join(evidence, 'flashcard-sources-web.png') });
        await closeSources.click();
        await sourceDialog.waitFor({ state: 'hidden' });
        const isRecording = url => url.href === word.audioUrl;
        await page.route(isRecording, route => route.fulfill({
          status: 200, contentType: 'audio/wav', body: playbackFixture(),
        }));
        await page.route(isRecording, route => route.abort(), { times: 1 });
        await speaker.click();
        await card.getByText('Chưa phát được bản ghi từ điển. Kiểm tra mạng rồi thử lại.').waitFor();
        await speaker.click();
        await page.waitForFunction(url => window.flashcardMedia.some(item => item.url === url), word.audioUrl);
        await speaker.click();
        await page.waitForFunction(url => {
          const recordings = window.flashcardMedia.filter(item => item.url === url);
          return recordings.length >= 2 && recordings[0].media.paused;
        }, word.audioUrl);
        assert(!(await page.evaluate(text => window.flashcardSpeech.includes(text), current)),
          'A verified recording must never be presented as synthetic speech');
        usedRecording = true;
      } else if (!word.audioUrl && !usedSpeech) {
        await sources.click();
        await sourceDialog.getByText(/dùng giọng máy/).waitFor();
        await closeSources.click();
        await sourceDialog.waitFor({ state: 'hidden' });
        await speaker.click();
        await page.waitForFunction(text => window.flashcardSpeech.includes(text), current);
        usedSpeech = true;
      }
      await good.click();
      if (word.audioUrl && usedRecording) {
        await page.waitForFunction(() => window.flashcardMedia.every(item => item.media.paused));
      }
      if (studied < words.length - 1) await heading.filter({ hasNotText: current }).waitFor();
    }
    assert(usedRecording && usedSpeech, 'The deck should exercise both pronunciation modes');
    console.log('PASS Web opens source dialogs from the header and keeps icon-only pronunciation controls working');
    await page.getByTestId('flashcards-completed').waitFor();
    await quizEntry.click();
    console.log('PASS Web rotates the card, hides meaning on the front, shows it on the back, and resets on the next card');
    const start = page.getByTestId('quiz-start');
    await start.click();
    await waitForText(page, 'Mất kết nối. Hãy kiểm tra mạng rồi thử lại.');
    startFailure = 404;
    await start.click();
    await waitForText(page, 'Bộ từ hoặc bài Quiz không còn khả dụng.');
    startFailure = 500;
    await start.click();
    await waitForText(page, 'Chưa tải được bài Quiz. Hãy thử lại.');
    console.log('PASS Web login, deck, flashcard and Quiz load errors offline/404/500');
    startFailure = null;
    await start.click();

    const advance = page.getByTestId('quiz-advance');
    async function answer(score) {
      await advance.waitFor();
      const quiz = currentQuiz;
      const meanings = quiz.direction === 'EN_TO_VI' ? translations : originals;
      for (const question of quiz.questions) {
        await waitForText(page, `Câu ${question.questionNo}/5 · ${quiz.direction === 'EN_TO_VI' ? 'Anh → Việt' : 'Việt → Anh'}`);
        assert(await advance.isDisabled(), 'An option must be selected before continuing');
        const correct = question.options.indexOf(meanings.get(question.prompt));
        assert(correct >= 0, 'Each correct option is in the imported deck');
        const option = question.questionNo <= score ? correct : (correct + 1) % 4;
        const feedback = page.getByTestId('quiz-answer-feedback');
        assert(!(await feedback.isVisible()), 'Do not show feedback before the user chooses');
        const retryAnswer = question.questionNo === 1 && loseAnswerResponse;
        await page.getByRole('radio').nth(option).click();
        if (retryAnswer) {
          await waitForText(page, 'Mất kết nối. Hãy kiểm tra mạng rồi thử lại.');
          await page.getByTestId('quiz-answer-retry').click();
        }
        await feedback.getByText(option === correct ? 'Chính xác' : 'Chưa đúng', { exact: true }).waitFor();
        await feedback.getByText(`${String.fromCharCode(65 + correct)}. ${question.options[correct]}`, { exact: true }).waitFor();
        assert(await page.getByRole('radio').nth((option + 1) % 4).isDisabled(), 'Graded options cannot be changed');
        await advance.click();
      }
    }

    await answer(2);
    console.log('PASS Web shows the correct answer immediately for correct and incorrect choices, including an answer retry');
    await waitForText(page, 'Mất kết nối. Hãy kiểm tra mạng rồi thử lại.');
    assert(!(await advance.isDisabled()), 'The last option should remain selected on submit failure');
    await advance.click();
    await waitForText(page, 'FAIL · Chưa đạt');
    await waitForText(page, '2/5');
    await page.getByRole('button', { name: 'Ôn lại Flashcards' }).click();
    const retake = page.getByTestId('flashcard-start-quiz');
    for (let remaining = 5; remaining > 0; remaining--) {
      const current = await heading.textContent();
      assert(!(await retake.isVisible()), 'Quiz should stay outside the review screen');
      await good.click();
      if (remaining > 1) await heading.filter({ hasNotText: current }).waitFor();
    }
    console.log('PASS Web submit retry preserves answers; fail requires reviewing five flashcards');

    await retake.click();
    await start.click();
    await answer(3);
    assert.equal(currentQuiz.direction, 'VI_TO_EN');
    await waitForText(page, 'PASS · Đạt');
    await waitForText(page, '60% câu trả lời đúng');
    await page.getByRole('button', { name: 'Hoàn thành', exact: true }).click();
    await page.getByTestId('screen-vocabulary').waitFor();
    console.log('PASS Web reverse-direction retake passes at 3/5 and returns to Vocabulary');

    await page.getByRole('button', { name: new RegExp(deck.title) }).click();
    for (let remaining = words.length; remaining > 0; remaining--) {
      const current = await heading.textContent();
      await good.click();
      if (remaining > 1) await heading.filter({ hasNotText: current }).waitFor();
    }
    await retake.click();
    startFailure = 401;
    await start.click();
    await page.getByTestId('screen-quiz').waitFor({ state: 'hidden' });
    console.log('PASS Web 401 closes the protected Quiz screen');
  } finally {
    await browser.close();
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
