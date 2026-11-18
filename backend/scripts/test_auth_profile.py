"""Run HTTP acceptance checks against the isolated Task 02 backend."""

import base64
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import hmac
import json
import os
import secrets
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from uuid import uuid4

BASE = f"http://127.0.0.1:{int(os.environ.get('AUTH_SMOKE_PORT', '58125'))}/api/v1"
AVATAR = (
    "data:image/jpeg;base64,"
    "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCw"
    "sNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQU"
    "FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAABAAEDASIAAhEBAx"
    "EB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQID"
    "AAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRk"
    "dISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2"
    "t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQ"
    "AAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEI"
    "FEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2"
    "hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU"
    "1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD8qqKKKAP/2Q=="
)


def expect(label, method, path, expected, *, payload=None, access=None):
    headers = {"Accept": "application/json"}
    body = None
    if payload is not None:
        headers["Content-Type"] = "application/json"
        body = json.dumps(payload).encode()
    if access:
        headers["Authorization"] = "Bearer " + access
    request = Request(BASE + path, method=method, headers=headers, data=body)
    try:
        response = urlopen(request, timeout=8)
    except HTTPError as error:
        response = error
    with response:
        assert response.status == expected, f"{label}: expected {expected}, got {response.status}"
        data = json.load(response)
    print(f"PASS {label} (HTTP {expected})")
    return data


def test_token(user_id, expiration, audience="english-learning-app"):
    now = int(time.time())
    claims = {"sub": user_id, "iss": "english-learning-api", "aud": [audience],
              "iat": now - 120}
    if expiration is not None:
        claims["exp"] = expiration

    def encode(data):
        return base64.urlsafe_b64encode(json.dumps(data).encode()).rstrip(b"=")

    body = encode({"alg": "HS256", "typ": "JWT"}) + b"." + encode(claims)
    secret = base64.b64decode(os.environ["AUTH_JWT_SECRET"])
    signature = base64.urlsafe_b64encode(hmac.new(secret, body, hashlib.sha256).digest()).rstrip(b"=")
    return (body + b"." + signature).decode()


def main():
    tag = uuid4().hex[:12]
    password = "Ela7" + secrets.token_urlsafe(14)
    alice = {"email": f"auth-a-{tag}@example.test", "displayName": "Auth Smoke A",
             "password": password, "confirmPassword": password}
    bob = {**alice, "email": f"auth-b-{tag}@example.test", "displayName": "Auth Smoke B"}
    expect("health remains public", "GET", "/health", 200)
    expect("deck list remains public", "GET", "/decks", 200)
    expect("invalid email rejected", "POST", "/auth/register", 400, payload={**alice, "email": "bad-email"})
    expect("missing password confirmation rejected", "POST", "/auth/register", 400,
           payload={key: value for key, value in alice.items() if key != "confirmPassword"})
    mismatch = expect("registration password mismatch", "POST", "/auth/register", 400,
                      payload={**alice, "confirmPassword": "Different1"})
    assert mismatch["code"] == "PASSWORD_MISMATCH"
    expect("weak password rejected", "POST", "/auth/register", 400,
           payload={**alice, "password": "onlyletters", "confirmPassword": "onlyletters"})
    too_long = "é" * 40 + "1"
    expect("password byte limit", "POST", "/auth/register", 400,
           payload={**alice, "password": too_long, "confirmPassword": too_long})
    registered_a = expect("register account A and issue a session", "POST", "/auth/register", 201, payload=alice)
    user_a = registered_a["user"]
    assert set(user_a) == {"id", "email", "displayName"}
    user_b = expect("register account B", "POST", "/auth/register", 201, payload=bob)["user"]
    assert expect("registration token works without login", "GET", "/users/me", 200,
                  access=registered_a["accessToken"]) == user_a
    expect("duplicate email is case insensitive", "POST", "/auth/register", 409,
           payload={**alice, "email": alice["email"].upper()})
    result = expect("wrong password rejected", "POST", "/auth/login", 401,
                    payload={"email": alice["email"], "password": "incorrect"})
    assert "accessToken" not in result
    session_a = expect("login A", "POST", "/auth/login", 200,
                       payload={"email": alice["email"].upper(), "password": password})
    assert session_a["tokenType"] == "Bearer"
    assert datetime.fromisoformat(session_a["expiresAt"]) > datetime.now(timezone.utc)
    access_a = session_a["accessToken"]
    access_b = expect("login B", "POST", "/auth/login", 200,
                      payload={"email": bob["email"], "password": password})["accessToken"]
    assert expect("get current user", "GET", "/users/me", 200, access=access_a) == user_a
    expect("missing token rejected", "GET", "/users/me/profile", 401)
    header, claims, signature = access_a.split(".")
    bad_signature = ("A" if signature[0] != "A" else "B") + signature[1:]
    expect("bad signature rejected", "GET", "/users/me", 401, access=f"{header}.{claims}.{bad_signature}")
    now = int(time.time())
    expect("expired token rejected", "GET", "/users/me", 401, access=test_token(user_a["id"], now - 15))
    expect("missing expiration rejected", "GET", "/users/me", 401, access=test_token(user_a["id"], None))
    expect("wrong audience rejected", "GET", "/users/me", 401,
           access=test_token(user_a["id"], now + 300, "other-app"))
    profile_a = expect("default profile created", "GET", "/users/me/profile", 200, access=access_a)
    assert (profile_a["userId"], profile_a["englishLevel"], profile_a["dailyGoalMinutes"]) == (user_a["id"], "A1", 15)
    expect("goal validation", "PATCH", "/users/me/profile", 400, access=access_a, payload={"dailyGoalMinutes": 241})
    expect("level validation", "PATCH", "/users/me/profile", 400, access=access_a, payload={"englishLevel": "Z9"})
    expect("cross-account endpoint denied", "GET", f'/users/{user_b["id"]}/profile', 403, access=access_a)
    expect("cross-account dev endpoint denied", "PATCH", f'/dev/users/{user_b["id"]}/profile', 403, access=access_a,
           payload={"englishLevel": "B2"})
    expect("body cannot select another user", "PATCH", "/users/me/profile", 400, access=access_a,
           payload={"userId": user_b["id"], "englishLevel": "B2"})
    expect("blank display name rejected", "PATCH", "/users/me/profile", 400, access=access_a,
           payload={"displayName": "  "})
    expect("invalid JPEG rejected", "PATCH", "/users/me/profile", 400, access=access_a,
           payload={"avatarUrl": "data:image/jpeg;base64,QUJD"})
    patch = {"englishLevel": "B1", "dailyGoalMinutes": 30, "displayName": "Auth Smoke Renamed", "avatarUrl": AVATAR}
    saved = expect("update own profile", "PATCH", "/users/me/profile", 200, access=access_a, payload=patch)
    assert saved["userId"] == user_a["id"] and all(saved[key] == value for key, value in patch.items())
    assert expect("reload own profile", "GET", "/users/me/profile", 200, access=access_a) == saved
    assert expect("display name visible in current user", "GET", "/users/me", 200, access=access_a)["displayName"] == patch["displayName"]
    other = expect("other profile unchanged", "GET", "/users/me/profile", 200, access=access_b)
    assert (other["userId"], other["englishLevel"], other["dailyGoalMinutes"]) == (user_b["id"], "A1", 15)
    assert other["displayName"] == user_b["displayName"] and other["avatarUrl"] is None

    new_password = "Ela8" + secrets.token_urlsafe(14)
    change = {"currentPassword": password, "newPassword": new_password, "confirmPassword": new_password}
    expect("password change requires authentication", "PATCH", "/users/me/password", 401, payload=change)
    wrong = expect("wrong current password rejected", "PATCH", "/users/me/password", 400, access=access_a,
                   payload={**change, "currentPassword": "WrongCurrent1"})
    assert wrong["code"] == "INCORRECT_PASSWORD"
    mismatch = expect("new password confirmation required", "PATCH", "/users/me/password", 400, access=access_a,
                      payload={**change, "confirmPassword": "Different1"})
    assert mismatch["code"] == "PASSWORD_MISMATCH"
    same = expect("password reuse rejected", "PATCH", "/users/me/password", 400, access=access_a,
                  payload={**change, "newPassword": password, "confirmPassword": password})
    assert same["code"] == "SAME_PASSWORD"
    changed = expect("change password issues a replacement token", "PATCH", "/users/me/password", 200,
                     access=access_a, payload=change)
    assert expect("replacement token keeps profile accessible", "GET", "/users/me/profile", 200,
                  access=changed["accessToken"]) == saved
    expect("previous token revoked", "GET", "/users/me", 401, access=access_a)
    expect("old password rejected", "POST", "/auth/login", 401, payload={"email": alice["email"], "password": password})
    expect("new password accepted", "POST", "/auth/login", 200, payload={"email": alice["email"], "password": new_password})

    race = {**alice, "email": f"auth-race-{tag}@example.test"}
    def register_concurrently(_):
        request = Request(BASE + "/auth/register", method="POST", headers={"Content-Type": "application/json"},
                          data=json.dumps(race).encode())
        try:
            with urlopen(request, timeout=8) as response:
                return response.status
        except HTTPError as error:
            with error:
                return error.code

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(register_concurrently, range(2))) == [201, 409]
    print("PASS concurrent duplicate registration (HTTP 201 and 409)")


if __name__ == "__main__":
    main()
