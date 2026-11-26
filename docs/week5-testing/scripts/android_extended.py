"""Extended native checks; called by android-smoke.py --extended.

Only the dedicated generated fixture is studied/graded. Display and connectivity
changes are restored in finally. Audio telemetry is not human listening evidence.
"""
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request


def run_extended(args, token, output, adb, ui, find, wait, tap, fill, scroll_to, screenshot):
    results = []
    original_size = adb('shell', 'wm', 'size')
    original_density = adb('shell', 'wm', 'density')
    wifi = adb('shell', 'settings', 'get', 'global', 'wifi_on').strip()
    data = adb('shell', 'settings', 'get', 'global', 'mobile_data').strip()
    original_rotation = adb('shell', 'settings', 'get', 'system', 'accelerometer_rotation').strip()

    def save():
        (output / 'extended-results.json').write_text(json.dumps({
            'device': args.serial, 'results': results,
            'limitations': 'Quiz fixture learning is prepared via API, not certified as UI learning. Audio telemetry cannot certify intelligibility or correct pronunciation. Display sizes are emulator overrides, not separate real devices.'
        }, ensure_ascii=False, indent=2), encoding='utf-8')

    def case(name, action):
        try:
            detail = action() or 'Native UI assertions satisfied'
            status = 'PARTIAL' if name.startswith('EXT-AUDIO') else 'PASS'
            screenshot(name)
        except Exception as exc:
            status, detail = 'FAIL', str(exc)[:180]
        results.append({'id': name, 'status': status, 'detail': detail})
        save()
        print(name, status, flush=True)
        return status != 'FAIL'

    def api(method, path, body=None):
        req = urllib.request.Request(args.api + path, data=json.dumps(body).encode() if body is not None else None,
            headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token}, method=method)
        try:
            response = urllib.request.urlopen(req, timeout=20)
        except urllib.error.HTTPError as exc:
            response = exc
        with response:
            raw = response.read()
            return response.status, json.loads(raw) if raw else None

    def open_route(route):
        url = 'exp://10.0.2.2:8081/--/' + route
        adb('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', "'" + url + "'", 'host.exp.exponent')
        time.sleep(1)
        tree = ui()
        if find(tree, 'Continue') is not None:
            tap('Continue', 'text')
            tree = ui()
        if find(tree, 'Close', 'content-desc') is not None:
            tap('Close', 'content-desc')

    def vocabulary():
        open_route('vocabulary')
        wait('tab-vocabulary')
        tap('tab-vocabulary')
        scroll_to('Giao tiếp và cảm xúc')

    def restore_network():
        adb('shell', 'svc', 'wifi', 'enable' if wifi == '1' else 'disable')
        adb('shell', 'svc', 'data', 'enable' if data == '1' else 'disable')

    def restore_display():
        size_override = re.search(r'Override size:\s*(\d+x\d+)', original_size)
        density_override = re.search(r'Override density:\s*(\d+)', original_density)
        adb('shell', 'wm', 'size', size_override.group(1) if size_override else 'reset')
        adb('shell', 'wm', 'density', density_override.group(1) if density_override else 'reset')
        adb('shell', 'settings', 'put', 'system', 'accelerometer_rotation', original_rotation)

    try:
        if args.home_only:
            for width, height in [(320, 568), (390, 844), (430, 932)]:
                def home_layout(width=width, height=height):
                    adb('shell', 'wm', 'size', f'{width*3}x{height*3}')
                    adb('shell', 'wm', 'density', '480')
                    time.sleep(2)
                    open_route('home')
                    tap('tab-home')
                    wait('screen-home')
                    scroll_to('home-metric-learned-value')
                    tree = ui()
                    labels = {'learned': 'Đã học qua', 'due': 'Đến hạn ôn', 'cram': 'Ôn thêm'}
                    values = {}
                    for key, expected in labels.items():
                        value = find(tree, f'home-metric-{key}-value')
                        label = find(tree, f'home-metric-{key}-label')
                        assert value is not None and label is not None, 'Metric missing'
                        values[key] = value.get('text', '')
                        assert values[key].isdigit(), 'Metric must have loaded a real count'
                        vx1, vy1, vx2, vy2 = map(int, re.findall(r'\d+', value.get('bounds', '')))
                        lx1, ly1, lx2, ly2 = map(int, re.findall(r'\d+', label.get('bounds', '')))
                        assert 0 <= vx1 < vx2 <= width*3 and 0 <= lx1 < lx2 <= width*3
                        assert vy2-vy1 <= 45*3, 'Value occupies more than one text line'
                        assert label.get('text') == expected, 'Caption text changed or truncated'
                        assert ly2-ly1 <= 40*3, 'Caption fragmented into too many lines'
                        assert vy2 <= ly1, 'Value and label overlap'
                    screenshot(f'HOME-{width}x{height}-metrics')
                    return {'sizeDp': f'{width}x{height}', 'realCounts': values,
                            'checks': 'Single-line numeric height, caption height/text, in-bounds, no value/caption overlap. Screenshots also require visual review.'}
                case(f'HOME-{width}x{height}', home_layout)
            return
        if args.display_only:
            for width, height in [(320, 568)]:
                def small_display():
                    adb('shell', 'wm', 'size', f'{width*3}x{height*3}')
                    adb('shell', 'wm', 'density', '480')
                    time.sleep(2)
                    open_route('vocabulary')
                    wait('tab-vocabulary')
                    tap('tab-vocabulary')
                    screenshot('EXT-SIZE-320x568-top')
                    scroll_to('Giao tiếp và cảm xúc')
                    screenshot('EXT-SIZE-320x568-scrolled')
                    for label in ['tab-home', 'tab-vocabulary', 'tab-profile']:
                        n = wait(label)
                        x1, y1, x2, y2 = map(int, re.findall(r'\d+', n.get('bounds', '')))
                        assert 0 <= x1 < x2 <= width*3 and 0 <= y1 < y2 <= height*3
                    tap('tab-profile')
                    wait('screen-profile')
                    scroll_to('profile-save')
                    assert wait('profile-save').get('enabled') == 'true'
                    return '320x568 dp: catalogue reached; navigation in bounds; Profile save accessible. Earlier missing Deck assertion was caused by deep-link startup leaving Home active.'
                case('EXT-SIZE-320x568-retest', small_display)
            return
        status, decks = api('GET', '/decks')
        assert status == 200 and len(decks) == 3, 'Fixture Decks unavailable'
        deck = decks[0]
        status, words = api('GET', '/decks/' + deck['id'] + '/words')
        assert status == 200 and len(words) >= 5
        quiz_route = 'quiz?' + urllib.parse.urlencode({'deckId': deck['id'], 'deckTitle': deck['title']})

        def gate():
            open_route(quiz_route)
            wait('quiz-start')
            tap('quiz-start')
            wait('Bạn cần lật hết thẻ trong bộ trước khi làm Quiz.')
        if case('EXT-QUIZ-01-study-gate', gate):
            # Fixture preparation uses the production study API, not SQL shortcuts.
            for word in words:
                status, _ = api('POST', '/decks/' + deck['id'] + '/study-progress', {'wordId': word['id']})
                assert status == 200, 'Study fixture preparation failed'
            status, quiz = api('POST', '/quiz/attempts', {'deckId': deck['id']})
            assert status == 200 and len(quiz['questions']) == 5

            def quiz_ui():
                tap('quiz-start')
                for i, question in enumerate(quiz['questions']):
                    wait(question['prompt'], field='text')
                    source = next(w for w in words if (w['headword'] if quiz['direction'] == 'EN_TO_VI' else w['meaningVi']) == question['prompt'])
                    answer = source['meaningVi'] if quiz['direction'] == 'EN_TO_VI' else source['headword']
                    correct = question['options'].index(answer)
                    chosen = (correct + 1) % len(question['options']) if i == 0 else correct
                    tap(question['options'][chosen], 'text')
                    wait('quiz-answer-feedback')
                    wait('Chưa đúng' if i == 0 else 'Chính xác', field='text')
                    wait('Đáp án đúng', field='text')
                    if i == 0: screenshot('EXT-QUIZ-wrong-feedback')
                    scroll_to('quiz-advance')
                    tap('quiz-advance')
                wait('quiz-result')
                wait('4/5', field='text')
                wait('80% câu trả lời đúng', field='text')
                status, result = api('GET', '/quiz/attempts/' + quiz['attemptId'] + '/result')
                assert status == 200 and result['correctCount'] == 4 and result['percentage'] == 80
                return 'Five native answers submitted; one intentional wrong; UI and real API result agree on 4/5, 80%.'
            case('EXT-QUIZ-02-five-answers-result', quiz_ui)

        def offline():
            vocabulary()
            adb('shell', 'svc', 'wifi', 'disable')
            adb('shell', 'svc', 'data', 'disable')
            time.sleep(2)
            assert adb('shell', 'settings', 'get', 'global', 'wifi_on').strip() == '0'
            tap('Làm mới danh sách bộ từ', 'content-desc')
            wait('Thử lại', timeout=35)
            assert any('Không kết nối' in n.get('text', '') for n in ui().iter('node'))
            return 'Emulator Wi-Fi/data disabled; real catalogue reload shows network error and retry.'
        case('EXT-NET-01-offline', offline)
        restore_network()
        def recovered():
            time.sleep(4)
            tap('Thử lại', 'text')
            wait('Giao tiếp và cảm xúc', timeout=35)
            wait('tab-profile')
            return 'Network restored; retry recovers Decks without signing in again.'
        case('EXT-NET-02-recovery', recovered)

        def audio():
            vocabulary()
            tap(deck['title'], 'text')
            wait('flashcard-headword')
            package = adb('shell', 'cmd', 'package', 'list', 'packages', '-U', 'host.exp.exponent')
            uid = re.search(r'uid:(\d+)', package).group(1)
            states = []
            for label in ['Nghe phát âm từ', 'Nghe câu ví dụ']:
                tap(label, 'content-desc')
                observed = []
                for _ in range(4):
                    dump = adb('shell', 'dumpsys', 'audio')
                    observed += [line.strip() for line in dump.splitlines() if ('uid' in line.lower() or 'u/pid' in line.lower()) and uid in line]
                    time.sleep(.2)
                states.append({'button': label, 'playerTelemetry': list(dict.fromkeys(observed))[-12:]})
            (output / 'audio-telemetry.json').write_text(json.dumps(states, ensure_ascii=False, indent=2), encoding='utf-8')
            assert not any('Chưa phát được' in n.get('text', '') for n in ui().iter('node')), 'Playback error shown'
            return 'Both speaker controls exercised; Android player telemetry saved. No captured/independently listened output, so audio correctness NOT TESTED.'
        case('EXT-AUDIO-01-playback-telemetry', audio)

        for width, height in [(320, 568), (390, 844), (430, 932)]:
            def display(width=width, height=height):
                adb('shell', 'wm', 'size', f'{width*3}x{height*3}')
                adb('shell', 'wm', 'density', '480')
                time.sleep(2)
                vocabulary()
                tree = ui()
                for label in ['tab-home', 'tab-vocabulary', 'tab-profile']:
                    n = find(tree, label)
                    assert n is not None, 'Navigation missing at display size'
                    x1, y1, x2, y2 = map(int, re.findall(r'\d+', n.get('bounds', '')))
                    assert 0 <= x1 < x2 <= width*3 and 0 <= y1 < y2 <= height*3, 'Navigation outside viewport'
                screenshot(f'EXT-SIZE-{width}x{height}-vocabulary')
                tap('tab-profile')
                wait('screen-profile')
                scroll_to('profile-save')
                n = wait('profile-save')
                assert n.get('enabled') == 'true'
                return f'Emulated {width}x{height} dp; navigation within viewport and Profile save accessible. Text visual QA separate.'
            case(f'EXT-SIZE-{width}x{height}', display)
    finally:
        restore_network()
        restore_display()
        save()
        print('Extended evidence: ' + str(output), flush=True)
        if any(row['status'] == 'FAIL' for row in results):
            raise RuntimeError('Extended checks failed; inspect extended-results.json')
