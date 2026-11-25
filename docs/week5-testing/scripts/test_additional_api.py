"""Run missing Week 5 API variants only against the verified isolated cluster.

Credentials come from the launching process. Output deliberately excludes tokens,
passwords and request bodies. This does not certify native UI behavior.
"""
import json
import os
from pathlib import Path
import subprocess
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from uuid import uuid4

BASE = 'http://127.0.0.1:58125/api/v1'
RESULTS = []
PSQL = os.environ.get('WEEK5_PSQL', 'C:/Program Files/PostgreSQL/17/bin/psql.exe')


def sql(statement):
    result = subprocess.run([PSQL, '-XwqAt', '-v', 'ON_ERROR_STOP=1', '-h', '127.0.0.1',
                             '-p', '55436', '-U', 'ela_week5', '-d', 'english_learning_fsrs_test',
                             '-c', statement], capture_output=True, encoding='utf-8', check=True)
    return result.stdout.strip()


def request(method, path, body=None, token=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    req = Request(BASE + path, method=method, headers=headers,
                  data=json.dumps(body).encode() if body is not None else None)
    try:
        response = urlopen(req, timeout=20)
    except HTTPError as error:
        response = error
    with response:
        raw = response.read()
        return response.status, json.loads(raw) if raw else None


def check(case, variant, condition, observed):
    RESULTS.append({'case': case, 'variant': variant, 'status': 'PASS' if condition else 'FAIL',
                    'observed': observed})
    print(f"{'PASS' if condition else 'FAIL'} {case} {variant}: {observed}")


def expect(case, variant, method, path, status, body=None, token=None):
    actual, data = request(method, path, body, token)
    check(case, variant, actual == status, {'http': actual, 'expected': status})
    return data


def account(level='A1'):
    password = 'Ela7-' + uuid4().hex
    address = 'additional-' + uuid4().hex + '@example.test'
    status, data = request('POST', '/auth/register', {
        'email': address, 'displayName': 'Additional API Test', 'password': password,
        'confirmPassword': password, 'englishLevel': level})
    assert status == 201, f'Fixture registration failed: {status}'
    return address, password, data['accessToken'], data['user']['id']


def main():
    assert sql('SELECT current_database()') == 'english_learning_fsrs_test'
    assert sql('SHOW port') == '55436'
    assert sql("SELECT to_regclass('public.review_sessions') IS NOT NULL") == 't'
    address, password, token, user = account()
    _, _, other, other_user = account('A2')
    decks = expect('TC-REG-01', 'A1 catalog', 'GET', '/decks', 200, token=token)
    check('TC-REG-01', 'three A1 decks', len(decks) == 3, len(decks))
    profile = expect('TC-REG-01', 'profile defaults', 'GET', '/users/me/profile', 200, token=token)
    check('TC-REG-01', 'default goal 15', profile['dailyGoalMinutes'] == 15, profile['dailyGoalMinutes'])
    check('TC-REG-01', 'BCrypt persisted', sql(
        f"SELECT (password_hash LIKE '$2a$%')::int FROM users WHERE id='{user}'") == '1', 'BCrypt prefix')
    for field in ('email', 'password'):
        body = {'email': address, 'password': password, field: ''}
        expect('TC-AUTH-03', 'blank ' + field, 'POST', '/auth/login', 400, body)
    for length in (0, 42, 44):
        expect('TC-PASSWORD-06', f'reset token length {length}', 'POST', '/auth/reset-password', 400,
               {'email': address, 'resetToken': 'a' * length, 'newPassword': 'Different7Password',
                'confirmPassword': 'Different7Password'})
    expect('TC-AUTH-02', 'unknown user', 'POST', '/auth/login', 401,
           {'email': 'absent-' + uuid4().hex + '@example.test', 'password': password})
    sql(f"UPDATE users SET status='DISABLED' WHERE id='{other_user}'")
    expect('TC-AUTH-02', 'disabled token', 'GET', '/users/me', 403, token=other)
    # Register another active A2 account for ownership checks.
    _, _, other, other_user = account('A2')
    for goal in (4, 5, 6, 239, 240, 241, None):
        valid = goal is not None and 5 <= goal <= 240
        before = request('GET', '/users/me/profile', token=token)[1]
        expect('TC-PROFILE-03', f'goal={goal}', 'PATCH', '/users/me/profile', 200 if valid else 400,
               {'dailyGoalMinutes': goal}, token)
        after = request('GET', '/users/me/profile', token=token)[1]
        check('TC-PROFILE-03', f'persist goal={goal}',
              after['dailyGoalMinutes'] == (goal if valid else before['dailyGoalMinutes'])
              and after['englishLevel'] == before['englishLevel']
              and after['displayName'] == before['displayName'], {'storedGoal': after['dailyGoalMinutes']})
    first = decks[0]
    words = request('GET', f"/decks/{first['id']}/words", token=token)[1]
    word = words[0]
    for bookmarked in (False, True):
        if bookmarked:
            expect('TC-HOME-01', 'bookmark only', 'POST', '/my-vocabulary/' + word['id'], 204, token=token)
        summary = expect('TC-HOME-01', f'summary bookmark={bookmarked}', 'GET', '/review/summary', 200, token=token)
        check('TC-HOME-01', f'zero counts bookmark={bookmarked}',
              all(summary[k] == 0 for k in ('learnedCount', 'dueCount', 'cramCount')),
              {k: summary[k] for k in ('learnedCount', 'dueCount', 'cramCount')})
        for kind in ('DUE', 'CRAM'):
            session = expect('TC-FSRS-01', f'{kind} bookmark={bookmarked}', 'POST', '/review/session/start',
                             200, {'type': kind}, token)['session']
            check('TC-FSRS-01', f'empty {kind} bookmark={bookmarked}', session['empty'] and not session['sessionId'],
                  {'empty': session['empty'], 'sessionId': session['sessionId']})
    check('TC-FSRS-01', 'no fake sessions/logs', sql(f"SELECT (SELECT count(*) FROM review_sessions WHERE user_id='{user}') + "
          f"(SELECT count(*) FROM review_logs WHERE user_id='{user}')") == '0', 'session/log count = 0')
    for _ in range(2):
        expect('TC-SAVED-01', 'repeat add', 'POST', '/my-vocabulary/' + word['id'], 204, token=token)
    count = request('GET', '/my-vocabulary/count', token=token)[1]['total']
    check('TC-SAVED-01', 'one saved row', count == 1 and sql(
          f"SELECT count(*) FROM user_saved_words WHERE user_id='{user}' AND word_id='{word['id']}'") == '1', count)
    state = request('GET', '/my-vocabulary/' + word['id'], token=other)[1]
    check('TC-SAVED-01', 'other user cannot see bookmark', state == {'saved': False}, state)
    expect('TC-SAVED-01', 'other user delete no-op', 'DELETE', '/my-vocabulary/' + word['id'], 204, token=other)
    check('TC-SAVED-01', 'owner row retained', request('GET', '/my-vocabulary/count', token=token)[1]['total'] == 1, 'owner count=1')
    for _ in range(2):
        expect('TC-SAVED-01', 'repeat removal', 'DELETE', '/my-vocabulary/' + word['id'], 204, token=token)
    check('TC-SAVED-01', 'count returns to zero', request('GET', '/my-vocabulary/count', token=token)[1]['total'] == 0, 'owner count=0')
    other_deck = request('GET', '/decks', token=other)[1][0]
    other_word = request('GET', f"/decks/{other_deck['id']}/words", token=other)[1][0]
    expect('TC-SAVED-04', 'inaccessible level word', 'POST', '/my-vocabulary/' + other_word['id'], 404, token=token)
    expect('TC-SAVED-04', 'unknown group', 'GET', f'/my-vocabulary/groups/{uuid4()}', 404, token=token)
    group = expect('TC-SAVED-04', 'existing group without saved words', 'GET',
                   '/my-vocabulary/groups/' + first['id'], 200, token=token)
    check('TC-SAVED-04', 'empty existing group count', group['wordCount'] == 0, group['wordCount'])
    for kind in (None, '', 'INVALID'):
        expect('TC-FSRS-05', f'type={kind}', 'POST', '/review/session/start', 400, {'type': kind}, token)
    expect('TC-PROFILE-01', 'rename and A1 to A2', 'PATCH', '/users/me/profile', 200,
           {'displayName': 'API Renamed', 'englishLevel': 'A2'}, token)
    changed = request('GET', '/users/me/profile', token=token)[1]
    check('TC-PROFILE-01', 'reload persisted profile', changed['displayName'] == 'API Renamed'
          and changed['englishLevel'] == 'A2', {'name': changed['displayName'], 'level': changed['englishLevel']})
    other_profile = request('GET', '/users/me/profile', token=other)[1]
    check('TC-PROFILE-01', 'other account unchanged', other_profile['displayName'] == 'Additional API Test',
          {'otherName': other_profile['displayName']})
    a2 = expect('TC-VOCAB-04', 'same JWT new catalog', 'GET', '/decks', 200, token=token)
    check('TC-VOCAB-04', 'three A2 decks', len(a2) == 3 and all(d['level'] == 'A2' for d in a2), len(a2))
    expect('TC-VOCAB-04', 'old A1 deck denied', 'GET', f"/decks/{first['id']}/words", 404, token=token)
    expect('TC-VOCAB-02', 'unknown deck', 'GET', f'/decks/{uuid4()}/words', 404, token=token)
    expect('TC-VOCAB-02', 'switch B1', 'PATCH', '/users/me/profile', 200, {'englishLevel': 'B1'}, token)
    b1 = expect('TC-VOCAB-02', 'empty B1 catalog', 'GET', '/decks', 200, token=token)
    check('TC-VOCAB-02', 'B1 is empty', b1 == [], b1)
    request('PATCH', '/users/me/profile', {'englishLevel': 'A1'}, token)
    empty_deck = sql("INSERT INTO decks(title,level,is_published,topic_key,topic,topic_source) "
                     "VALUES('Week5 empty A1','A1',true,'a1-week5-empty','Week5','APP') RETURNING id")
    empty_words = expect('TC-VOCAB-02', 'published empty deck', 'GET', f'/decks/{empty_deck}/words', 200, token=token)
    check('TC-VOCAB-02', 'empty words', empty_words == [], empty_words)
    sql(f"UPDATE decks SET is_published=false WHERE id='{empty_deck}'")
    expect('TC-VOCAB-02', 'hidden deck', 'GET', f'/decks/{empty_deck}/words', 404, token=token)
    sql(f"DELETE FROM decks WHERE id='{empty_deck}'")
    # Restore level to create a real one-card review session and validate every malformed field.
    request('PATCH', '/users/me/profile', {'englishLevel': 'A1'}, token)
    expect('TC-FSRS-05', 'study fixture', 'POST', f"/decks/{first['id']}/study-progress", 200, {'wordId': word['id']}, token)
    session = request('POST', '/review/session/start', {'type': 'DUE'}, token)[1]['session']
    path = '/review/session/' + session['sessionId'] + '/rate'
    valid = {'wordId': word['id'], 'rating': 'EASY', 'clientRequestToken': str(uuid4())}
    for field, values in [('rating', (None, 'good')), ('wordId', (None, 'bad-uuid')),
                          ('clientRequestToken', (None, 'bad-uuid'))]:
        for value in values:
            expect('TC-FSRS-05', f'{field}={value}', 'POST', path, 400, {**valid, field: value}, token)
    expect('TC-FSRS-05', 'cross-account session read', 'GET', '/review/session/' + session['sessionId'], 404, token=other)
    expect('TC-FSRS-05', 'cross-account rating', 'POST', path, 404, valid, other)
    check('TC-FSRS-05', 'no log after invalid requests',
          sql(f"SELECT count(*) FROM review_logs WHERE user_id='{user}'") == '0', '0 logs')
    # Exercise queue caps against real PostgreSQL, using fresh account fixtures.
    all_words = [w for d in decks for w in request('GET', f"/decks/{d['id']}/words", token=token)[1]]
    for amount in (0, 1, 9, 10, 11):
        _, _, fixture_token, fixture_user = account()
        if amount:
            values = ','.join(f"('{fixture_user}','{w['id']}')" for w in all_words[:amount])
            sql('INSERT INTO user_word_progress(user_id,word_id) VALUES ' + values)
        summary = request('GET', '/review/summary', token=fixture_token)[1]
        queue = request('POST', '/review/session/start', {'type': 'DUE'}, fixture_token)[1]['session']
        check('TC-FSRS-02', f'population={amount}', summary['dueCount'] == amount
              and queue['targetCount'] == min(amount, 10),
              {'dueCount': summary['dueCount'], 'targetCount': queue['targetCount']})


if __name__ == '__main__':
    output = Path('docs/week5-testing/evidence/new-machine/additional-api.json')
    output.parent.mkdir(parents=True, exist_ok=True)
    try:
        main()
    finally:
        output.write_text(json.dumps(RESULTS, indent=2, ensure_ascii=False), encoding='utf-8')
    raise SystemExit(1 if any(r['status'] == 'FAIL' for r in RESULTS) else 0)
