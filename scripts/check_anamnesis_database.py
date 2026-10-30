"""Local PostgreSQL-only integration checks. Never accepts a database URL.

Run with ANAMNESIS_TEST_CONTAINER pointing to a disposable inss-module2-* container
on the managed local Docker socket, with --network none and no published ports.
Creates and finally drops its own randomly named test database.
"""
import concurrent.futures
import json
import os
import pathlib
import re
import subprocess
import unittest
import uuid

DOCKER = ["env", "-u", "DOCKER_HOST", "-u", "DOCKER_CONTEXT", "-u", "DOCKER_TLS", "-u", "DOCKER_TLS_VERIFY", "-u", "DOCKER_CERT_PATH", "docker", "--host=unix:///var/run/docker.sock"]
ROOT = pathlib.Path(__file__).resolve().parents[1]
OWNER = "00000000-0000-4000-8000-000000000011"
OTHER = "00000000-0000-4000-8000-000000000012"
INITIAL = "2026-01-01T00:00:00Z"
FACTS = {"interviewVersion": 2, "answers": {}, "responses": {}, "contexto": {}, "storyStatus": "collecting", "story": [], "awaiting": "story", "documentsSkipped": False}


def quote(value):
    return "'" + str(value).replace("'", "''") + "'"


class AnamnesisDatabaseTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.container = os.environ.get("ANAMNESIS_TEST_CONTAINER", "")
        if not re.fullmatch(r"inss-module2-[a-z0-9-]+", cls.container):
            raise RuntimeError("Explicit disposable local test container required")
        info = json.loads(subprocess.check_output([*DOCKER, "inspect", cls.container], text=True))[0]
        if info["HostConfig"]["NetworkMode"] != "none" or info["HostConfig"].get("PortBindings"):
            raise RuntimeError("Container must be isolated, with no published ports")
        if not info["Config"]["Image"].startswith("postgres@sha256:"):
            raise RuntimeError("Pinned PostgreSQL test image required")
        cls.database = "anamnesis_test_" + uuid.uuid4().hex
        subprocess.run([*DOCKER, "exec", cls.container, "createdb", "-U", "postgres", cls.database], check=True, capture_output=True)
        cls.sql("""
          DO $$ BEGIN
            IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
            IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
            IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role; END IF;
          END $$;
          CREATE SCHEMA auth; CREATE SCHEMA storage;
          CREATE TABLE auth.users(id uuid PRIMARY KEY, raw_user_meta_data jsonb NOT NULL DEFAULT '{}');
          CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
          CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text, name text);
          ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
          CREATE FUNCTION storage.foldername(value text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT string_to_array(value,'/') $$;
          GRANT USAGE ON SCHEMA auth,storage TO authenticated,anon,service_role;
          GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon,service_role;
        """)
        for path in sorted((ROOT / "drizzle/migrations").glob("*.sql")):
            cls.sql(path.read_text())
        cls.sql(f"INSERT INTO auth.users(id) VALUES ({quote(OWNER)}),({quote(OTHER)});")

    @classmethod
    def tearDownClass(cls):
        subprocess.run([*DOCKER, "exec", cls.container, "dropdb", "-U", "postgres", cls.database], check=True, capture_output=True)

    @classmethod
    def sql(cls, statement, owner=None, check=True, role="authenticated"):
        prefix = f"SET request.jwt.claim.sub={quote(owner or '')}; SET ROLE {role};" if owner is not None else ""
        result = subprocess.run([*DOCKER, "exec", "-i", cls.container, "psql", "-U", "postgres", "-d", cls.database, "-v", "ON_ERROR_STOP=1", "-Atq"], input=prefix+statement, text=True, capture_output=True)
        if check and result.returncode:
            raise AssertionError(result.stderr)
        return result

    def thread(self, owner=OWNER):
        identity = str(uuid.uuid4())
        self.sql(f"INSERT INTO public.investigations(id,user_id,facts,updated_at) VALUES ({quote(identity)},{quote(owner)},{quote(json.dumps(FACTS))}::jsonb,{quote(INITIAL)});")
        return identity

    def commit(self, thread, request, owner=OWNER, digest="a"*64, assistant="synthetic question", check=True):
        next_facts = {**FACTS, "story": ["synthetic story"]}
        return self.sql(f"SELECT public.commit_anamnesis_turn({quote(thread)}::uuid,{quote(request)}::uuid,{quote(INITIAL)}::timestamptz,{quote(digest)},{quote(json.dumps(next_facts))}::jsonb,NULL,'synthetic story',{quote(assistant)});", owner=owner, check=check)

    def count(self, table, thread):
        return int(self.sql(f"SELECT count(*) FROM public.{table} WHERE {'id' if table=='investigations' else 'investigation_id'}={quote(thread)}::uuid;").stdout.strip())

    def test_simple_commit_persists_facts_and_both_messages(self):
        thread = self.thread()
        result = json.loads(self.commit(thread, str(uuid.uuid4())).stdout)
        self.assertFalse(result["duplicate"])
        self.assertEqual(self.count("investigation_messages", thread), 2)
        self.assertEqual(self.count("anamnesis_turns", thread), 1)
        chronology = self.sql(f"SELECT role FROM public.investigation_messages WHERE investigation_id={quote(thread)} ORDER BY created_at;").stdout.strip().splitlines()
        self.assertEqual(chronology, ["user", "assistant"])
        distinct_times = self.sql(f"SELECT count(DISTINCT created_at) FROM public.investigation_messages WHERE investigation_id={quote(thread)};").stdout.strip()
        self.assertEqual(distinct_times, "2")
        self.assertEqual(json.loads(self.sql(f"SELECT facts->'story' FROM public.investigations WHERE id={quote(thread)};").stdout), ["synthetic story"])

    def test_replay_is_idempotent(self):
        thread = self.thread(); request = str(uuid.uuid4())
        self.commit(thread, request)
        self.assertTrue(json.loads(self.commit(thread, request).stdout)["duplicate"])
        self.assertEqual(self.count("investigation_messages", thread), 2)

    def test_same_request_with_different_payload_is_rejected(self):
        thread = self.thread(); request = str(uuid.uuid4())
        self.commit(thread, request)
        self.assertNotEqual(self.commit(thread, request, digest="b"*64, check=False).returncode, 0)
        self.assertEqual(self.count("anamnesis_turns", thread), 1)

    def test_stale_turn_does_not_write_messages(self):
        thread = self.thread(); self.commit(thread, str(uuid.uuid4()))
        self.assertNotEqual(self.commit(thread, str(uuid.uuid4()), check=False).returncode, 0)
        self.assertEqual(self.count("investigation_messages", thread), 2)

    def test_tenant_isolation_on_rpc_and_ledger_reads(self):
        thread = self.thread(); self.commit(thread, str(uuid.uuid4()))
        result = self.sql(f"SELECT count(*) FROM public.anamnesis_turns WHERE investigation_id={quote(thread)};", owner=OTHER)
        self.assertEqual(result.stdout.strip(), "0")
        self.assertNotEqual(self.commit(thread, str(uuid.uuid4()), owner=OTHER, check=False).returncode, 0)

    def test_anonymous_cannot_execute_rpc(self):
        thread = self.thread()
        statement = f"SELECT public.commit_anamnesis_turn({quote(thread)},{quote(str(uuid.uuid4()))},{quote(INITIAL)},'{'a'*64}','{{\"interviewVersion\":2}}',NULL,'x','y');"
        self.assertNotEqual(self.sql(statement, owner=OWNER, role="anon", check=False).returncode, 0)
        self.assertEqual(self.count("anamnesis_turns", thread), 0)

    def test_direct_ledger_writes_are_not_granted(self):
        thread = self.thread()
        statement = f"INSERT INTO public.anamnesis_turns(investigation_id,request_id,user_id,request_hash) VALUES ({quote(thread)},{quote(str(uuid.uuid4()))},{quote(OWNER)},'{'a'*64}');"
        self.assertNotEqual(self.sql(statement, owner=OWNER, check=False).returncode, 0)

    def test_storage_failure_rolls_back_everything(self):
        thread = self.thread()
        self.sql("""CREATE FUNCTION public.synthetic_message_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.role='assistant' AND NEW.parts->0->>'text'='synthetic-failure' THEN RAISE EXCEPTION 'synthetic failure'; END IF; RETURN NEW; END $$;
        CREATE TRIGGER synthetic_message_failure BEFORE INSERT ON public.investigation_messages FOR EACH ROW EXECUTE FUNCTION public.synthetic_message_failure();""")
        try:
            self.assertNotEqual(self.commit(thread, str(uuid.uuid4()), assistant="synthetic-failure", check=False).returncode, 0)
            self.assertEqual(self.count("investigation_messages", thread), 0)
            self.assertEqual(self.count("anamnesis_turns", thread), 0)
            self.assertEqual(json.loads(self.sql(f"SELECT facts->'story' FROM public.investigations WHERE id={quote(thread)};").stdout), [])
        finally:
            self.sql("DROP TRIGGER synthetic_message_failure ON public.investigation_messages; DROP FUNCTION public.synthetic_message_failure();")

    def test_parallel_retries_commit_only_once(self):
        thread = self.thread(); request = str(uuid.uuid4())
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
            results = list(executor.map(lambda _: self.commit(thread, request), range(20)))
        self.assertEqual(sum(not json.loads(result.stdout)["duplicate"] for result in results), 1)
        self.assertEqual(self.count("investigation_messages", thread), 2)

    def test_parallel_competing_answers_reject_stale_writers(self):
        thread = self.thread()
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
            results = list(executor.map(lambda _: self.commit(thread, str(uuid.uuid4()), check=False), range(20)))
        self.assertEqual(sum(result.returncode == 0 for result in results), 1)
        self.assertEqual(self.count("anamnesis_turns", thread), 1)
        self.assertEqual(self.count("investigation_messages", thread), 2)


if __name__ == "__main__":
    unittest.main(verbosity=2)
