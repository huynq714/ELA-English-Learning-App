"""Native Android smoke tests via existing ADB/UI Automator; no third-party driver.

Requires ELA Home/Login/Welcome in Expo Go, running backend and Metro. Creates a
dedicated API fixture account; leaves it in the DB for evidence, never deletes
existing data. Password/token stay in memory. UI dumps remain in memory.
"""
import argparse
import json
import re
import secrets
import subprocess
import time
import urllib.request
import uuid
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--adb', default='D:/Android/Sdk/platform-tools/adb.exe')
    parser.add_argument('--serial', default='emulator-5554')
    parser.add_argument('--api', default='http://127.0.0.1:8080/api/v1')
    parser.add_argument('--extended', action='store_true', help='Run Quiz/network/audio/display tests after fixture login')
    parser.add_argument('--display-only', action='store_true', help='Recheck emulator layouts in the currently signed-in test session')
    parser.add_argument('--home-only', action='store_true', help='Check Home metric layout at three emulator sizes')
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[3]
    output = root / '.artifacts' / ('week5-android-' + datetime.now().strftime('%Y%m%d-%H%M%S'))
    output.mkdir(parents=True)
    results = []

    def adb(*command, binary=False):
        run = subprocess.run([args.adb, '-s', args.serial, *command], capture_output=True, timeout=35)
        if run.returncode: raise RuntimeError('ADB command failed (details omitted for privacy)')
        return run.stdout if binary else run.stdout.decode('utf-8', errors='replace')

    def ui():
        adb('shell', 'uiautomator', 'dump', '/sdcard/ela-smoke-window.xml')
        try:
            return ET.fromstring(adb('shell', 'cat', '/sdcard/ela-smoke-window.xml'))
        finally:
            adb('shell', 'rm', '-f', '/sdcard/ela-smoke-window.xml')

    def find(tree, value, field=None):
        for node in reversed(list(tree.iter('node'))):
            fields = [node.get(field, '')] if field else [node.get('resource-id', ''), node.get('content-desc', ''), node.get('text', '')]
            if value in fields: return node
        return None

    def wait(value, timeout=30, field=None):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            node = find(ui(), value, field)
            if node is not None: return node
            time.sleep(.4)
        raise AssertionError('UI element not found: ' + value)

    def tap(value, field=None):
        node = wait(value, field=field)
        x1, y1, x2, y2 = map(int, re.findall(r'\d+', node.get('bounds', '')))
        adb('shell', 'input', 'tap', str((x1+x2)//2), str((y1+y2)//2))
        time.sleep(.6)

    def fill(label, value):
        tap(label, 'content-desc')
        adb('shell', 'input', 'keyevent', 'KEYCODE_MOVE_END')
        adb('shell', 'input', 'keyevent', '--longpress', 'KEYCODE_DEL')
        # Existing values are cleared with SELECT_ALL, including physical keyboards.
        adb('shell', 'input', 'keycombination', '113', '29')
        adb('shell', 'input', 'keyevent', '67')
        if value: adb('shell', 'input', 'text', value)
        if 'mInputShown=true' in adb('shell', 'dumpsys', 'input_method'):
            adb('shell', 'input', 'keyevent', '4')

    def scroll_to(value):
        for _ in range(5):
            if find(ui(), value) is not None: return
            size = list(map(int, re.findall(r'(\d+)x(\d+)', adb('shell', 'wm', 'size'))[-1]))
            adb('shell', 'input', 'swipe', str(size[0]//2), str(int(size[1]*.78)), str(size[0]//2), str(int(size[1]*.3)), '350')
        wait(value, 5)

    def screenshot(name):
        (output / (name + '.png')).write_bytes(adb('exec-out', 'screencap', '-p', binary=True))

    def case(name, action):
        started = time.monotonic()
        try:
            action()
            status, detail = 'PASS', 'Expected native UI assertions satisfied'
            screenshot(name)
        except Exception as error:
            status, detail = 'FAIL', str(error)[:160]
        results.append({'id': name, 'status': status, 'detail': detail, 'seconds': round(time.monotonic()-started, 2)})
        print(name, status, flush=True)
        (output / 'results.json').write_text(json.dumps({'device': args.serial, 'results': results,
            'limitations': 'UI only; no audio listening, Gmail OTP, real-device or multi-size certification.'}, ensure_ascii=False, indent=2), encoding='utf-8')
        if status != 'PASS': raise RuntimeError('Stopped at first failure: ' + name)

    def logout():
        tap('tab-profile')
        scroll_to('profile-logout')
        tap('profile-logout')
        wait('welcome-start')

    try:
        if args.display_only or args.home_only:
            from android_extended import run_extended
            run_extended(args, '', output, adb, ui, find, wait, tap, fill, scroll_to, screenshot)
            return
        initial = ui()
        if find(initial, 'Continue') is not None:
            tap('Continue', 'text')
            initial = ui()
        if find(initial, 'Close', 'content-desc') is not None:
            tap('Close', 'content-desc')
            initial = ui()
        for _ in range(4):
            if any(find(initial, key) is not None for key in ('tab-home', 'screen-login', 'welcome-start')): break
            adb('shell', 'input', 'keyevent', '4')
            initial = ui()
        if not any(find(initial, key) is not None for key in ('tab-home', 'screen-login', 'welcome-start')):
            raise RuntimeError('Open ELA Home, Login or Welcome before running')
        email = 'android-smoke-' + uuid.uuid4().hex[:12] + '@example.test'
        password = 'Ela9' + secrets.token_hex(10)
        data = json.dumps({'email': email, 'displayName': 'Android Smoke', 'password': password,
            'confirmPassword': password, 'englishLevel': 'A1'}).encode()
        request = urllib.request.Request(args.api + '/auth/register', data, {'Content-Type': 'application/json'})
        with urllib.request.urlopen(request, timeout=20) as response:
            assert response.status == 201
            fixture = json.load(response)
        def login_entry():
            if find(ui(), 'tab-home') is not None: logout()
            if find(ui(), 'welcome-start') is not None: tap('welcome-start')
            wait('screen-login')
        case('AND-01-login-entry', login_entry)
        def empty_login():
            tap('login-submit')
            wait('Vui lòng nhập email hợp lệ.')
        case('AND-02-empty-login', empty_login)
        def wrong_login():
            fill('Email', email)
            fill('Mật khẩu', 'Wrong9password')
            tap('login-submit')
            wait('Email hoặc mật khẩu không đúng.')
        case('AND-03-wrong-password', wrong_login)
        def login():
            fill('Mật khẩu', password)
            tap('login-submit')
            wait('tab-home')
            assert any('Android Smoke' in n.get('text', '') for n in ui().iter('node')), 'Wrong account on Home'
        case('AND-04-valid-login', login)
        if args.extended:
            from android_extended import run_extended
            run_extended(args, fixture['accessToken'], output, adb, ui, find, wait, tap, fill, scroll_to, screenshot)
            return
        def catalogue():
            tap('tab-vocabulary')
            for title in ['Giao tiếp và cảm xúc', 'Vị trí và di chuyển', 'Thời gian và tần suất']: wait(title)
        case('AND-05-a1-catalogue', catalogue)
        def empty_search():
            fill('Tìm theo tên bộ từ hoặc chủ đề', 'zzzz123')
            wait('Không tìm thấy bộ từ')
        case('AND-06-empty-search', empty_search)
        def restore_search():
            fill('Tìm theo tên bộ từ hoặc chủ đề', '')
            wait('Giao tiếp và cảm xúc')
        case('AND-07-search-recovery', restore_search)
        def flashcard():
            tap('Giao tiếp và cảm xúc', 'text')
            wait('flashcard-headword')
            assert find(ui(), 'flashcard-meaning') is None, 'Meaning visible before flip'
            tap('flashcard-flip')
            wait('flashcard-meaning')
        case('AND-08-flip-card', flashcard)
        def bookmark():
            tap('Lưu từ', 'content-desc')
            wait('Bỏ lưu từ', field='content-desc')
        case('AND-09-bookmark', bookmark)
        def saved():
            adb('shell', 'input', 'keyevent', '4')
            wait('tab-vocabulary')
            tap('Bộ từ vựng của tôi', 'content-desc')
            wait('Giao tiếp và cảm xúc')
            wait('1 từ')
        case('AND-10-saved-list', saved)
        def unbookmark():
            tap('Giao tiếp và cảm xúc', 'text')
            scroll_to('Ôn tập bộ từ')
            tap('Ôn tập bộ từ', 'text')
            wait('Bỏ lưu từ', field='content-desc')
            tap('Bỏ lưu từ', 'content-desc')
            wait('Lưu từ', field='content-desc')
        case('AND-11-unbookmark', unbookmark)
    finally:
        print('Evidence: ' + str(output), flush=True)


if __name__ == '__main__':
    main()
