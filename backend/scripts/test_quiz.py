"""Test the JWT-protected Quiz flow and deferred triggers on an isolated database."""

from concurrent.futures import ThreadPoolExecutor
import json
import os
from pathlib import Path
import subprocess
import sys
from uuid import uuid4

from test_auth_profile import expect


START = "/quiz/attempts"


def sql(query, *, error=None):
    process = subprocess.run(
        [os.environ["QUIZ_SMOKE_PSQL"], "-XwqAt", "-v", "ON_ERROR_STOP=1",
         "-h", "127.0.0.1", "-U", "auth_check", "-d", "postgres",
         "-p", os.environ["QUIZ_SMOKE_DB_PORT"], "-c", query],
        capture_output=True, encoding="utf-8", check=False,
    )
    if error:
        assert process.returncode != 0 and error in process.stderr, process.stderr
    else:
        assert process.returncode == 0, process.stderr
    return process.stdout.strip()


def snapshot(attempt_id):
    return json.loads(sql(f"SELECT question_snapshot FROM quiz_attempts WHERE id = '{attempt_id}'"))


def check_quiz(quiz, words):
    assert len(quiz["questions"]) == 5
    assert quiz["answered"] == [], "Correct options must not be exposed before an answer"
    saved = snapshot(quiz["attemptId"])
    by_id = {word["id"]: word for word in words}
    assert len({item["wordId"] for item in saved["questions"]}) == 5
    is_english = quiz["direction"] == "EN_TO_VI"
    option_key = "meaningVi" if is_english else "headword"
    option_pool = {word[option_key] for word in words}
    for index, (public, private) in enumerate(zip(quiz["questions"], saved["questions"]), 1):
        assert set(public) == {"questionNo", "prompt", "options"} and public["questionNo"] == index
        assert public["prompt"] == by_id[private["wordId"]]["headword" if is_english else "meaningVi"]
        assert len(public["options"]) == len(set(public["options"])) == 4
        assert set(public["options"]) <= option_pool
        assert public["options"][private["correctOption"]] == by_id[private["wordId"]][option_key]


def selections(attempt_id, score):
    questions = snapshot(attempt_id)["questions"]
    return {"answers": [
        {"questionNo": index + 1,
         "optionIndex": item["correctOption"] if index < score else (item["correctOption"] + 1) % 4}
        for index, item in enumerate(questions)
    ]}


def submit(quiz, token, score):
    attempt_id = quiz["attemptId"]
    result = expect(f"score {score}/5", "POST", f"{START}/{attempt_id}/submit", 200,
                    payload=selections(attempt_id, score), access=token)
    assert (result["correctCount"], result["totalQuestions"], result["percentage"], result["passed"]) == (
        score, 5, score * 20, score >= 3)
    return result


def before_restart(state):
    password = os.environ["QUIZ_SMOKE_PASSWORD"]
    email = f"quiz-smoke-{uuid4().hex}@example.test"
    register = {"email": email, "displayName": "Quiz Smoke", "password": password, "confirmPassword": password}
    user = expect("register quiz user", "POST", "/auth/register", 201, payload=register)
    token = user["accessToken"]
    other = expect("register second user", "POST", "/auth/register", 201,
                   payload={**register, "email": f"quiz-other-{uuid4().hex}@example.test"})["accessToken"]
    published = expect("published decks", "GET", "/decks", 200)
    counts = {}
    word_lists = {}
    for deck in published:
        deck_id = deck["id"]
        words = expect("real imported words", "GET", f"/decks/{deck_id}/words", 200)
        assert all(word["sourceMetadata"]["vietnamese"]["reviewStatus"] == "VERIFIED" for word in words)
        counts[deck_id] = len(words)
        word_lists[deck_id] = words
    assert sorted(counts.values()) == [5, 18, 20]
    print("PASS PostgreSQL/API has 43 verified words in decks of 5, 18, 20")

    deck = next(deck_id for deck_id, size in counts.items() if size == 5)
    bigger = next(deck_id for deck_id, size in counts.items() if size == 18)
    largest = next(deck_id for deck_id, size in counts.items() if size == 20)
    word_id = word_lists[deck][0]["id"]
    progress = f"/decks/{deck}/study-progress"
    assert expect("open flashcards does not create progress", "GET", progress, 200,
                  access=token)["lastStudiedWordId"] is None
    assert sql("SELECT count(*) FROM user_word_progress") == "0"
    first_gate = expect("quiz locked before flashcards", "POST", START, 409, access=token, payload={"deckId": deck})
    assert first_gate["code"] == "STUDY_REQUIRED"
    assert expect("flip records a studied word", "POST", progress, 200,
                  access=token, payload={"wordId": word_id})["lastStudiedWordId"] == word_id
    assert expect("resume the same word", "GET", progress, 200,
                  access=token)["lastStudiedWordId"] == word_id
    expect("word outside deck rejected", "POST", progress, 404,
           access=token, payload={"wordId": word_lists[bigger][0]["id"]})
    expect("progress requires JWT", "GET", progress, 401)
    expect("quiz rejects invalid JWT", "POST", START, 401, access="not-a-jwt", payload={"deckId": deck})
    expect("missing deck rejected", "POST", START, 404, access=token, payload={"deckId": str(uuid4())})

    small = sql("INSERT INTO decks(title) VALUES ('Empty quiz test') RETURNING id")
    expect("deck has fewer than five words", "POST", START, 422, access=token, payload={"deckId": small})
    sql(f"INSERT INTO deck_words(deck_id, word_id) SELECT '{small}', id FROM words WHERE headword IN ('about', 'above', 'around')")
    expect("ambiguous verified deck rejected", "POST", START, 422, access=token, payload={"deckId": small})
    sql(f"UPDATE decks SET is_published = false WHERE id = '{small}'")
    expect("unpublished deck rejected", "POST", START, 404, access=token, payload={"deckId": small})
    expect("unpublished flashcards rejected", "GET", f"/decks/{small}/study-progress", 404, access=token)

    partially_studied = expect("quiz locked after only one flashcard", "POST", START, 409, access=token,
                               payload={"deckId": deck})
    assert partially_studied["code"] == "STUDY_REQUIRED"
    for word in word_lists[deck][1:]:
        unlocked = expect("study flashcard before quiz", "POST", progress, 200, access=token, payload={"wordId": word["id"]})
    assert unlocked["unstudiedWordIds"] == []
    other_gate = expect("study progress is account-specific", "POST", START, 409, access=other, payload={"deckId": deck})
    assert other_gate["code"] == "STUDY_REQUIRED"

    def start():
        return expect("start quiz", "POST", START, 200, access=token, payload={"deckId": deck})

    with ThreadPoolExecutor(max_workers=2) as pool:
        original, duplicate = list(pool.map(lambda _: start(), range(2)))
    assert original == duplicate and original["direction"] == "EN_TO_VI"
    check_quiz(original, word_lists[deck])
    attempt_id = original["attemptId"]
    print("PASS concurrent start resumes the same five server-generated questions")
    expect("unsubmitted result unavailable", "GET", f"{START}/{attempt_id}/result", 409, access=token)
    expect("cannot read another user's quiz", "GET", f"{START}/{attempt_id}/result", 404, access=other)
    valid = selections(attempt_id, 2)
    expect("cannot submit another user's quiz", "POST", f"{START}/{attempt_id}/submit", 404, access=other, payload=valid)
    expect("not enough answers", "POST", f"{START}/{attempt_id}/submit", 400, access=token,
           payload={"answers": valid["answers"][:4]})
    invalid = {"answers": [*valid["answers"][:4], {"questionNo": 5, "optionIndex": 4}]}
    expect("invalid option index", "POST", f"{START}/{attempt_id}/submit", 400, access=token, payload=invalid)
    repeated = {"answers": [*valid["answers"][:4], valid["answers"][0]]}
    expect("duplicate question rejected", "POST", f"{START}/{attempt_id}/submit", 400, access=token, payload=repeated)
    assert sql(f"SELECT count(*) FROM quiz_answers WHERE attempt_id = '{attempt_id}'") == "0"
    answer_path = f"{START}/{attempt_id}/answers"
    expect("cannot grade another user's answer", "POST", answer_path, 404, access=other, payload=valid["answers"][0])
    first = expect("grade a correct selection", "POST", answer_path, 200, access=token, payload=valid["answers"][0])
    wrong = expect("grade an incorrect selection", "POST", answer_path, 200, access=token, payload=valid["answers"][2])
    assert first["correct"] and first["selectedOption"] == first["correctOption"]
    assert not wrong["correct"] and wrong["selectedOption"] != wrong["correctOption"]
    changed_selection = selections(attempt_id, 5)["answers"][2]
    assert expect("repeat grading returns the locked selection", "POST", answer_path, 200,
                  access=token, payload=changed_selection) == wrong
    assert start()["answered"] == [first, wrong]
    conflict = expect("submit cannot change a graded answer", "POST", f"{START}/{attempt_id}/submit", 409,
                      access=token, payload=selections(attempt_id, 5))
    assert conflict["code"] == "ANSWER_LOCKED"
    assert sql(f"SELECT count(*) FROM quiz_answers WHERE attempt_id = '{attempt_id}'") == "2"
    with ThreadPoolExecutor(max_workers=2) as pool:
        failed, replay = list(pool.map(lambda _: submit(original, token, 2), range(2)))
    assert failed == replay
    assert expect("replay cannot change a score", "POST", f"{START}/{attempt_id}/submit", 200, access=token,
                  payload=selections(attempt_id, 5)) == failed
    assert sql(f"SELECT count(*) FROM quiz_answers WHERE attempt_id = '{attempt_id}'") == "5"

    expect("fail blocks direct retake", "POST", START, 409, access=token, payload={"deckId": deck})
    remaining = expect("pre-fail study is not enough", "GET", progress, 200, access=token)["remainingReviewWordIds"]
    assert len(remaining) == 5
    for index, reviewed in enumerate(remaining):
        after = expect("review a required flashcard", "POST", progress, 200, access=token, payload={"wordId": reviewed})
        assert len(after["remainingReviewWordIds"]) == 4 - index
        if index == 3:
            expect("partial review still blocks retake", "POST", START, 409, access=token, payload={"deckId": deck})

    retake = start()
    check_quiz(retake, word_lists[deck])
    assert retake["attemptId"] != attempt_id and retake["direction"] == "VI_TO_EN"
    before = snapshot(attempt_id)["questions"]
    after = snapshot(retake["attemptId"])["questions"]
    assert [item["wordId"] for item in before] != [item["wordId"] for item in after]
    assert all(next(item for item in before if item["wordId"] == question["wordId"])["correctOption"]
               != question["correctOption"] for question in after)
    passed = submit(retake, token, 3)
    assert expect("read a stored pass", "GET", f"{START}/{passed['attemptId']}/result", 200, access=token) == passed
    five = submit(start(), token, 5)
    for extra_deck in (bigger, largest):
        for word in word_lists[extra_deck]:
            expect("study flashcard in the other deck", "POST", f"/decks/{extra_deck}/study-progress",
                   200, access=token, payload={"wordId": word["id"]})
    zero_quiz = expect("second deck quiz", "POST", START, 200, access=token, payload={"deckId": bigger})
    check_quiz(zero_quiz, word_lists[bigger])
    zero = submit(zero_quiz, token, 0)

    open_quiz = expect("third deck quiz", "POST", START, 200, access=token, payload={"deckId": largest})
    check_quiz(open_quiz, word_lists[largest])
    open_id = open_quiz["attemptId"]
    tested_word = snapshot(open_id)["questions"][0]["wordId"]
    sql(f"""BEGIN;
        INSERT INTO quiz_answers(attempt_id,word_id,question_no,selected_answer,is_correct)
        VALUES ('{open_id}','{tested_word}',1,'test',true);
        UPDATE quiz_attempts SET status='COMPLETED',correct_count=1,completed_at=now() WHERE id='{open_id}';
        COMMIT;""", error="must have five answers and a matching score")
    assert sql(f"""SELECT status, (SELECT count(*) FROM quiz_answers WHERE attempt_id = '{open_id}')
               FROM quiz_attempts WHERE id = '{open_id}'""") == "IN_PROGRESS|0"
    print("PASS deferred COMMIT rejection rolls back both answers and status")
    sql(f"UPDATE quiz_attempts SET correct_count=4 WHERE id='{attempt_id}'", error="completed quiz attempt cannot be updated")
    sql(f"UPDATE quiz_answers SET selected_answer='test' WHERE attempt_id='{attempt_id}'",
        error="Answers of a completed quiz are immutable")
    sql(f"UPDATE quiz_answers SET attempt_id='{open_id}' WHERE attempt_id='{attempt_id}'",
        error="Quiz answers cannot move between attempts")
    print("PASS PostgreSQL protects completed scores, answers and inter-attempt moves")
    choice = selections(open_id, 1)["answers"][0]
    saved = expect("save a graded answer before restart", "POST", f"{START}/{open_id}/answers", 200,
                   access=token, payload=choice)
    open_quiz["answered"] = [saved]
    assert sql("SELECT count(*) FROM words") == "43"
    print("PASS Vocabulary still contains the original 43 words")
    state.write_text(json.dumps({"email": email, "results": [failed, passed, five, zero],
                                 "openQuiz": open_quiz, "deckId": largest}), encoding="utf-8")


def after_restart(state):
    stored = json.loads(state.read_text(encoding="utf-8"))
    login = expect("login after backend restart", "POST", "/auth/login", 200,
                   payload={"email": stored["email"], "password": os.environ["QUIZ_SMOKE_PASSWORD"]})
    token = login["accessToken"]
    for result in stored["results"]:
        assert expect("persisted result after restart", "GET", f"{START}/{result['attemptId']}/result", 200,
                      access=token) == result
    assert expect("same in-progress questions after restart", "POST", START, 200, access=token,
                  payload={"deckId": stored["deckId"]}) == stored["openQuiz"]
    assert sql("""SELECT count(*) FROM quiz_attempts
                  WHERE status='COMPLETED' AND question_snapshot IS NOT NULL""") == "4"
    assert sql("""SELECT count(*) FROM quiz_answers a JOIN quiz_attempts q ON q.id=a.attempt_id
                  WHERE q.status='COMPLETED'""") == "20"
    assert sql("""SELECT count(*) FROM quiz_answers a JOIN quiz_attempts q ON q.id=a.attempt_id
                  WHERE q.status='IN_PROGRESS'""") == "1"
    print("PASS PostgreSQL persisted 4 completed attempts, 20 completed answers and 1 in-progress answer")


if __name__ == "__main__":
    assert os.environ["QUIZ_SMOKE_DB_PORT"] != "5432", "Use the isolated test database"
    state_file = Path(os.environ["QUIZ_SMOKE_STATE"])
    if sys.argv[1] == "before-restart":
        before_restart(state_file)
    elif sys.argv[1] == "after-restart":
        after_restart(state_file)
    else:
        raise SystemExit("Select before-restart or after-restart")
