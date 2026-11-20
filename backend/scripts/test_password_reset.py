"""Exercise the real recovery API with isolated PostgreSQL and a loopback SMTP inbox."""

from concurrent.futures import ThreadPoolExecutor
from email import policy
from email.parser import BytesParser
import json
import os
from queue import Empty, Queue
import re
import socketserver
import subprocess
from threading import Thread
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from uuid import UUID, uuid4


BASE = f"http://127.0.0.1:{int(os.environ['AUTH_SMOKE_PORT'])}/api/v1"
INBOX = Queue()


class SmtpInbox(socketserver.StreamRequestHandler):
    def reply(self, line):
        self.wfile.write(line + b"\r\n")

    def handle(self):
        self.reply(b"220 loopback.test")
        while line := self.rfile.readline():
            command = line.partition(b" ")[0].strip().upper()
            if command == b"DATA":
                self.reply(b"354 end with a dot")
                message = bytearray()
                while part := self.rfile.readline():
                    if part == b".\r\n":
                        break
                    message.extend(part)
                INBOX.put(BytesParser(policy=policy.default).parsebytes(message))
            if command == b"QUIT":
                self.reply(b"221 closing")
                return
            self.reply(b"250 OK")


def request(method, path, payload=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    req = Request(BASE + path, method=method, headers=headers,
                  data=json.dumps(payload).encode() if payload is not None else None)
    try:
        response = urlopen(req, timeout=10)
    except HTTPError as error:
        response = error
    with response:
        raw = response.read()
        return response.status, json.loads(raw) if raw else None


def expect(label, status, method, path, payload=None, token=None, code=None):
    actual, body = request(method, path, payload, token)
    assert actual == status, f"{label}: HTTP {actual}, expected {status}"
    if code:
        assert body.get("code") == code, f"{label}: unexpected error code"
    print(f"PASS {label} (HTTP {status})")
    return body


def sql(statement):
    result = subprocess.run(
        [os.environ["RESET_SMOKE_PSQL"], "-XwqAt", "-v", "ON_ERROR_STOP=1",
         "-h", "127.0.0.1", "-p", os.environ["RESET_SMOKE_DB_PORT"],
         "-U", "auth_check", "-d", "postgres", "-c", statement],
        check=True, stdout=subprocess.PIPE, text=True,
    )
    return result.stdout.strip()


def receive(address):
    message = INBOX.get(timeout=8)
    assert str(message["To"]) == address, "SMTP recipient did not match the registered address"
    assert str(message["From"]) == "ela-recovery@example.test", "Unexpected sender"
    match = re.search(r"\b[0-9]{6}\b", message.get_body(preferencelist=("plain",)).get_content())
    assert match, "SMTP message did not contain a six-digit code"
    return match.group()


def assert_no_mail():
    try:
        INBOX.get(timeout=0.6)
    except Empty:
        return
    raise AssertionError("Unexpected SMTP delivery")


def main():
    address = f"reset-{uuid4().hex}@example.test"
    absent = f"missing-{uuid4().hex}@example.test"
    old_password = "Ela7" + uuid4().hex
    new_password = "Ela8" + uuid4().hex
    forgot = "/auth/forgot-password"
    verify = "/auth/verify-reset-otp"
    finish = "/auth/reset-password"
    invalid_otp = "INVALID_RESET_OTP"
    invalid_token = "INVALID_RESET_TOKEN"
    registered = expect("register fixture", 201, "POST", "/auth/register",
                        {"email": address, "displayName": "Recovery Test", "englishLevel": "A1",
                         "password": old_password, "confirmPassword": old_password})
    user_id = UUID(registered["user"]["id"])
    jwt = registered["accessToken"]
    where = f" WHERE user_id = '{user_id}'"

    generic = expect("request for unknown account", 202, "POST", forgot, {"email": absent})
    assert_no_mail()
    assert expect("request for registered account", 202, "POST", forgot, {"email": address}) == generic
    otp = receive(address)
    assert sql("SELECT (octet_length(otp_hash) = 32 AND token_hash IS NULL)::int "
               "FROM password_reset_challenges" + where) == "1"
    print("PASS SMTP delivery and 32-byte OTP hash persisted")
    assert expect("resend in first 60 seconds", 202, "POST", forgot, {"email": address.upper()}) == generic
    assert_no_mail()
    expect("unknown account has generic OTP error", 400, "POST", verify,
           {"email": absent, "otp": otp}, code=invalid_otp)

    def verify_code(label, status, value, code=None):
        return expect(label, status, "POST", verify, {"email": address, "otp": value}, code=code)

    wrong = "000000" if otp != "000000" else "000001"
    for attempt in range(1, 6):
        verify_code(f"wrong OTP attempt {attempt}", 400, wrong, invalid_otp)
    assert sql("SELECT failed_attempts FROM password_reset_challenges" + where) == "5"
    verify_code("correct OTP rejected after five wrong attempts", 400, otp, invalid_otp)

    def expire_and_resend():
        sql("UPDATE password_reset_challenges SET otp_expires_at=now()-interval '1 second'" + where)
        sql("UPDATE password_reset_limits SET expires_at=now()-interval '1 second' "
            "WHERE bucket='send-email-cooldown'")
        assert expect("resend after cooldown", 202, "POST", forgot, {"email": address}) == generic
        return receive(address)

    otp = expire_and_resend()
    sql("UPDATE password_reset_challenges SET otp_expires_at=now()-interval '1 second'" + where)
    verify_code("expired OTP rejected", 400, otp, invalid_otp)
    otp = expire_and_resend()
    reset_token = verify_code("valid OTP verified", 200, otp)["resetToken"]
    assert sql("SELECT (otp_hash IS NULL AND octet_length(token_hash) = 32)::int "
               "FROM password_reset_challenges" + where) == "1"
    verify_code("OTP cannot be reused", 400, otp, invalid_otp)

    payload = {"email": address, "resetToken": reset_token, "newPassword": new_password,
               "confirmPassword": new_password}
    expect("password confirmation required", 400, "POST", finish,
           {**payload, "confirmPassword": "Mismatched7"})
    expect("weak password rejected", 400, "POST", finish,
           {**payload, "newPassword": "onlyletters", "confirmPassword": "onlyletters"})
    sql("UPDATE password_reset_challenges SET token_expires_at=now()-interval '1 second'" + where)
    expect("expired reset token", 400, "POST", finish, payload, code=invalid_token)

    otp = expire_and_resend()
    payload["resetToken"] = verify_code("new OTP after token expiry", 200, otp)["resetToken"]
    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(lambda _: request("POST", finish, payload), range(2)))
    assert sorted(status for status, _ in results) == [204, 400], "Token used more or less than once"
    assert next(body for status, body in results if status == 400).get("code") == invalid_token
    assert sql("SELECT count(*) FROM password_reset_challenges" + where) == "0"
    assert sql(f"SELECT (left(password_hash, 4)='$2a$')::int FROM users WHERE id='{user_id}'") == "1"
    print("PASS concurrent reset consumes token once and persists BCrypt")

    expect("old JWT revoked", 401, "GET", "/users/me/profile", token=jwt)
    expect("old password rejected", 401, "POST", "/auth/login", {"email": address, "password": old_password})
    login = expect("new password accepted", 200, "POST", "/auth/login", {"email": address, "password": new_password})
    expect("new JWT accepted", 200, "GET", "/users/me/profile", token=login["accessToken"])

    expire_and_resend()
    sql("UPDATE password_reset_limits SET expires_at=now()-interval '1 second' "
        "WHERE bucket='send-email-cooldown'")
    assert expect("sixth request has generic response", 202, "POST", forgot, {"email": address}) == generic
    assert_no_mail()
    assert sql("SELECT max(hits) FROM password_reset_limits WHERE bucket='send-email'") == "5"
    print("PASS hourly account rate limit")

    for i in range(20):
        status, body = request("POST", forgot, {"email": f"limited-{i}-{uuid4().hex}@example.test"})
        assert (status, body) == (202, generic), "Rate limit discloses account information"
    assert sql("SELECT hits FROM password_reset_limits WHERE bucket='send-ip'") == "20"
    assert_no_mail()
    print("PASS send IP rate limit and generic response")


if __name__ == "__main__":
    port = int(os.environ["RESET_SMOKE_SMTP_PORT"])
    with socketserver.ThreadingTCPServer(("127.0.0.1", port), SmtpInbox) as server:
        server.daemon_threads = True
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            main()
        finally:
            server.shutdown()
