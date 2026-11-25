"""Collect shareable execution evidence, excluding raw Surefire properties/output.

Full runtime logs and local credentials stay in the ignored .artifacts directory.
"""
import json
from pathlib import Path
import re
import shutil
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[3]
STATE = ROOT / '.artifacts/week5-environment'
OUTPUT = ROOT / 'docs/week5-testing/evidence/new-machine'
OUTPUT.mkdir(parents=True, exist_ok=True)


def clean(text):
    text = re.sub(r'\x1b\[[0-9;]*m', '', text)
    text = text.replace(str(ROOT), '<project-root>').replace(ROOT.as_posix(), '<project-root>')
    text = re.sub(r'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+', '[JWT REDACTED]', text)
    text = re.sub(r'\$2[aby]\$\d\d\$[A-Za-z0-9./]{53}', '[BCRYPT REDACTED]', text)
    return text


def read(path):
    raw = path.read_bytes()
    if raw.startswith((b'\xff\xfe', b'\xfe\xff')):
        return raw.decode('utf-16')
    return raw.decode('utf-8-sig', errors='replace')


for name in ('suite-Auth-retry.log', 'suite-MyVocabulary-retry.log', 'suite-PasswordReset.log',
             'suite-Quiz.log', 'quiz-web-final.log', 'review-web-final.log', 'saved-web-final.log',
             'additional-api.log', 'database-tests.log', 'database-final.log', 'database-setup.log',
             'lint-final.log', 'typecheck-final.log', 'web-startup-evidence.log',
             'import-builder-final.log', 'test_quiz_missing_answer_commit.sql.log',
             'test_quiz_score_mismatch_commit.sql.log', 'test_conversation_incomplete_commit.sql.log'):
    source = STATE / name
    if source.exists():
        (OUTPUT / name).write_text(clean(read(source)), encoding='utf-8')

# The INFO-only Maven extract excludes DEBUG request DTOs and environment properties.
maven = read(STATE / 'maven-limited.log')
(OUTPUT / 'maven-test.log').write_text('\n'.join(clean(line) for line in maven.splitlines()
                                               if line.startswith('[INFO]')), encoding='utf-8')
suites = []
for source in sorted((ROOT / 'backend/target/surefire-reports').glob('TEST-*.xml')):
    suite = ET.parse(source).getroot()
    suites.append({key: suite.get(key) for key in ('name', 'tests', 'failures', 'errors', 'skipped', 'time')}
                  | {'testcases': [{'name': case.get('name'), 'class': case.get('classname'),
                                   'status': ('FAIL' if case.find('failure') is not None or case.find('error') is not None
                                              else 'SKIPPED' if case.find('skipped') is not None else 'PASS')}
                                  for case in suite.findall('testcase')]})
totals = {key: sum(int(s[key]) for s in suites) for key in ('tests', 'failures', 'errors', 'skipped')}
(OUTPUT / 'junit-summary.json').write_text(json.dumps({'totals': totals, 'suites': suites}, indent=2), encoding='utf-8')

exits = {path.stem: int(read(path).strip()) for path in STATE.glob('*.exit')}
(OUTPUT / 'exit-codes.json').write_text(json.dumps(exits, indent=2), encoding='utf-8')
for name in ('flashcard-front-web.png', 'flashcard-back-web.png', 'flashcard-sources-web.png'):
    if (STATE / name).exists():
        shutil.copyfile(STATE / name, OUTPUT / name)

# Preserve the exact PostgreSQL diagnostic without unrelated server request logs.
source = ROOT / '.artifacts/week4-auth-9060d91c679140d39149205a2b12815a/spring.log'
if source.exists():
    lines = read(source).splitlines()
    diagnostic = [line for line in lines if 'pg_unicode_fast' in line or 'Position: 307' in line or 'SQLState: 42704' in line]
    (OUTPUT / 'postgres17-collation-error.log').write_text(clean('\n'.join(diagnostic)), encoding='utf-8')
print(json.dumps({'junit': totals, 'exit_codes': exits}, indent=2))
