"""Verify the saved vocabulary rules through the real Spring Boot API."""

from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlencode
from uuid import uuid4

from test_auth_profile import expect
from test_quiz import sql

BASE = "/my-vocabulary"


def main():
    password = "Ela7-" + uuid4().hex

    def register(level):
        email = f"bookmark-{uuid4().hex}@example.test"
        result = expect(f"register {level} account", "POST", "/auth/register", 201, payload={
            "email": email, "displayName": "Vocabulary Test", "englishLevel": level,
            "password": password, "confirmPassword": password,
        })
        return email, result["accessToken"]

    email, alice = register("A1")
    _, bob = register("A2")

    def deck_words(token, topic):
        decks = expect("load published decks", "GET", "/decks", 200, access=token)
        deck = next(deck for deck in decks if deck["topicKey"] == topic)
        return expect("load deck words", "GET", f"/decks/{deck['id']}/words", 200, access=token)

    def saved(token, **filters):
        suffix = "?" + urlencode(filters) if filters else ""
        return expect("load own saved words", "GET", BASE + suffix, 200, access=token)

    def path(word):
        return BASE + "/" + word["id"]

    assert saved(alice)["total"] == 0
    a1 = deck_words(alice, "a1-communication-feelings")
    angry = next(word for word in a1 if word["headword"] == "angry")
    a2 = deck_words(bob, "a2-work-jobs")
    athlete = next(word for word in a2 if word["headword"] == "athlete")
    expect("unauthenticated list", "GET", BASE, 401)
    expect("unauthenticated bookmark", "POST", path(angry), 401)
    expect("unauthenticated removal", "DELETE", path(angry), 401)
    expect("inaccessible level rejected", "POST", path(athlete), 404, access=alice)
    expect("unknown word rejected", "POST", f"{BASE}/{uuid4()}", 404, access=alice)
    expect("unsupported filter rejected", "GET", BASE + "?level=B1", 400, access=alice)
    expect("pagination limit rejected", "GET", BASE + "?size=101", 400, access=alice)
    expect("negative page rejected", "GET", BASE + "?page=-1", 400, access=alice)

    def add_again(_):
        expect("idempotent parallel add", "POST", path(angry), 204, access=alice)
    with ThreadPoolExecutor(max_workers=5) as pool:
        list(pool.map(add_again, range(5)))
    assert saved(alice)["items"] == [{"saved": True, "word": angry}]
    groups = expect("load saved Deck groups", "GET", BASE + "/groups", 200, access=alice)
    assert groups and groups[0]["wordCount"] == 1 and groups[0]["previewWords"]
    assert expect("load saved-word total", "GET", BASE + "/count", 200, access=alice)["total"] == 1
    first_group = groups[0]
    assert saved(alice, groupId=first_group["groupId"])["total"] == 1
    assert expect("owner bookmark status", "GET", path(angry), 200, access=alice) == {"saved": True}
    assert expect("other account bookmark status", "GET", path(angry), 200, access=bob) == {"saved": False}
    expect("other account removal is a no-op", "DELETE", path(angry), 204, access=bob)
    assert saved(bob)["total"] == 0 and saved(alice)["total"] == 1
    assert sql("SELECT count(*) FROM user_saved_words") == "1"
    assert angry["audioUrl"] and angry["sourceMetadata"]["pronunciation"]["audio"]
    assert saved(alice, query=angry["meaningVi"].upper())["total"] == 1
    assert saved(alice, query="ANGr")["total"] == 1

    expect("update Alice to A2", "PATCH", "/users/me/profile", 200,
           payload={"englishLevel": "A2"}, access=alice)
    assert saved(alice, level="A1")["items"][0]["word"] == angry
    expect("old level retry stays idempotent", "POST", path(angry), 204, access=alice)
    expect("cannot add new word from previous level", "POST", path(a1[0]), 404, access=alice)
    expect("add current level word", "POST", path(athlete), 204, access=alice)
    assert saved(alice, level="A2")["items"][0]["word"] == athlete
    new_token = expect("new login after bookmarks", "POST", "/auth/login", 200, payload={
        "email": email, "password": password,
    })["accessToken"]
    first, second = (saved(new_token, page=index, size=1) for index in (0, 1))
    assert first["hasNext"] and not second["hasNext"] and first["total"] == second["total"] == 2
    assert [p["items"][0]["word"]["id"] for p in (first, second)] == [athlete["id"], angry["id"]]
    expect("remove from a previous level", "DELETE", path(angry), 204, access=new_token)
    expect("repeat removal", "DELETE", path(angry), 204, access=new_token)
    assert saved(new_token)["items"] == [{"saved": True, "word": athlete}]
    assert sql("""SELECT (SELECT count(*) FROM user_word_progress) + (SELECT count(*) FROM quiz_attempts)
                       + (SELECT count(*) FROM review_cards) + (SELECT count(*) FROM review_logs)""") == "0"
    print("PASS bookmark writes leave study progress, Quiz and SRS tables untouched")


if __name__ == "__main__":
    main()
