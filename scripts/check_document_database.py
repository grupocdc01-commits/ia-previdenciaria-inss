"""Isolated PostgreSQL checks for module 3 plus inherited module 2 regressions.

Run ANAMNESIS_TEST_CONTAINER=inss-module3-* python3 scripts/check_document_database.py.
Uses the guarded local-only harness; no URL, port, credential or network access.
"""
import concurrent.futures
import json
import unittest
import uuid
from check_anamnesis_database import AnamnesisDatabaseTests as LocalHarness, OWNER, OTHER, quote

EXTRACTION = {"documentType": "cnis", "fields": [
    {"field": "inicio_vinculo", "value": "2020-01-01", "page": 1, "quote": "01/01/2020"},
    {"field": "fim_vinculo", "value": "2020-01-10", "page": 1, "quote": "10/01/2020"}], "limitations": []}


class DocumentDatabaseTests(LocalHarness):
    def document(self, **patch):
        identity = str(uuid.uuid4())
        thread = self.thread()
        self.sql(f"""INSERT INTO public.previdenciary_documents(id,user_id,investigation_id,storage_path,original_name,mime_type,byte_size,sha256,status,extraction,extraction_version)
        VALUES ({quote(identity)},{quote(OWNER)},{quote(thread)},{quote(identity+'/synthetic.pdf')},'synthetic.pdf','application/pdf',100,{'a'*64!r},'needs_review',{quote(json.dumps(EXTRACTION))}::jsonb,'administrative-v1');""")
        for column, value in patch.items():
            if column not in {"delete_after", "deletion_state", "extraction"}:
                raise ValueError("Unsupported synthetic patch")
            self.sql(f"UPDATE public.previdenciary_documents SET {column}={quote(value)} WHERE id={quote(identity)};")
        return identity

    def review(self, doc, decisions=None, revision=0, owner=OWNER, digest="a"*64, extraction=None, check=True, role="authenticated"):
        decisions = ["confirmed", "pending"] if decisions is None else decisions
        statement = f"SELECT public.review_document_fields({quote(doc)},{quote(digest)},'administrative-v1',{revision},{quote(json.dumps(extraction or EXTRACTION))}::jsonb,{quote(json.dumps(decisions))}::jsonb);"
        return self.sql(statement, owner=owner, check=check, role=role)

    def history_count(self, doc, owner=None):
        return int(self.sql(f"SELECT count(*) FROM public.document_field_reviews WHERE document_id={quote(doc)};", owner=owner).stdout.strip())

    def test_document_simple_review_preserves_extraction_and_appends_revision(self):
        doc = self.document()
        result = json.loads(self.review(doc).stdout)
        self.assertEqual(result, {"revision": 1, "duplicate": False})
        self.assertEqual(self.history_count(doc), 1)
        stored = self.sql(f"SELECT extraction FROM public.previdenciary_documents WHERE id={quote(doc)};").stdout
        self.assertEqual(json.loads(stored), EXTRACTION)
        self.assertEqual(self.history_count(doc, OWNER), 1)

    def test_document_identical_retry_creates_no_duplicate_history(self):
        doc = self.document(); self.review(doc)
        self.assertTrue(json.loads(self.review(doc).stdout)["duplicate"])
        self.assertEqual(self.history_count(doc), 1)

    def test_document_stale_revision_does_not_overwrite_new_decisions(self):
        doc = self.document(); self.review(doc)
        self.assertNotEqual(self.review(doc, ["rejected", "rejected"], check=False).returncode, 0)
        self.assertEqual(self.history_count(doc), 1)
        self.review(doc, ["rejected", "rejected"], revision=1)
        self.assertEqual(self.history_count(doc), 2)

    def test_document_cross_owner_rpc_and_history_are_isolated(self):
        doc = self.document(); self.review(doc)
        self.assertEqual(self.history_count(doc, OTHER), 0)
        self.assertNotEqual(self.review(doc, owner=OTHER, check=False).returncode, 0)
        self.assertEqual(self.history_count(doc), 1)

    def test_document_anonymous_and_direct_writes_are_denied(self):
        doc = self.document()
        self.assertNotEqual(self.review(doc, role="anon", check=False).returncode, 0)
        self.assertNotEqual(self.sql(f"UPDATE public.previdenciary_documents SET administrative_review='[]' WHERE id={quote(doc)};", owner=OWNER, check=False).returncode, 0)
        self.assertNotEqual(self.sql(f"INSERT INTO public.document_field_reviews(document_id,revision,user_id,sha256,extraction_version,decisions) VALUES ({quote(doc)},1,{quote(OWNER)},'x','x','[]');", owner=OWNER, check=False).returncode, 0)
        self.assertEqual(self.history_count(doc), 0)

    def test_document_changed_hash_or_snapshot_is_rejected(self):
        doc = self.document()
        self.assertNotEqual(self.review(doc, digest="b"*64, check=False).returncode, 0)
        changed = {**EXTRACTION, "limitations": ["synthetic change"]}
        self.assertNotEqual(self.review(doc, extraction=changed, check=False).returncode, 0)
        self.assertEqual(self.history_count(doc), 0)

    def test_document_invalid_decisions_and_medical_extraction_are_rejected(self):
        doc = self.document()
        for decisions in [["confirmed"], ["proven", "confirmed"], [None, "confirmed"], ["confirmed"]*101]:
            self.assertNotEqual(self.review(doc, decisions, check=False).returncode, 0)
        medical = {**EXTRACTION, "documentType": "medico"}
        self.sql(f"UPDATE public.previdenciary_documents SET extraction={quote(json.dumps(medical))} WHERE id={quote(doc)};")
        self.assertNotEqual(self.review(doc, extraction=medical, check=False).returncode, 0)
        self.assertEqual(self.history_count(doc), 0)

    def test_document_expired_or_deleting_records_cannot_be_reviewed(self):
        for patch in [{"delete_after": "2000-01-01T00:00:00Z"}, {"deletion_state": "deleting"}]:
            doc = self.document(**patch)
            self.assertNotEqual(self.review(doc, check=False).returncode, 0)
            self.assertEqual(self.history_count(doc), 0)

    def test_document_history_failure_rolls_back_current_review(self):
        doc = self.document()
        self.sql("""CREATE FUNCTION public.synthetic_review_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic failure'; END $$;
        CREATE TRIGGER synthetic_review_failure BEFORE INSERT ON public.document_field_reviews FOR EACH ROW EXECUTE FUNCTION public.synthetic_review_failure();""")
        try:
            self.assertNotEqual(self.review(doc, check=False).returncode, 0)
            revision = self.sql(f"SELECT review_revision FROM public.previdenciary_documents WHERE id={quote(doc)};").stdout.strip()
            self.assertEqual(revision, "0"); self.assertEqual(self.history_count(doc), 0)
        finally:
            self.sql("DROP TRIGGER synthetic_review_failure ON public.document_field_reviews; DROP FUNCTION public.synthetic_review_failure();")

    def test_document_deletion_cascades_review_history(self):
        doc = self.document(); self.review(doc)
        self.sql(f"DELETE FROM public.previdenciary_documents WHERE id={quote(doc)};")
        self.assertEqual(self.history_count(doc), 0)

    def test_document_parallel_identical_retries_commit_once(self):
        doc = self.document()
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            results = list(pool.map(lambda _: self.review(doc), range(20)))
        self.assertEqual(sum(not json.loads(result.stdout)["duplicate"] for result in results), 1)
        self.assertEqual(self.history_count(doc), 1)

    def test_document_parallel_competing_reviews_do_not_overwrite(self):
        doc = self.document()
        choices = [["confirmed", "pending"], ["rejected", "pending"]]
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            results = list(pool.map(lambda i: self.review(doc, choices[i%2], check=False), range(20)))
        # One choice commits; retries of that same choice are idempotent. Others conflict.
        successes = [json.loads(result.stdout) for result in results if result.returncode == 0]
        self.assertEqual(sum(not result["duplicate"] for result in successes), 1)
        self.assertEqual(len(successes), 10)
        self.assertEqual(self.history_count(doc), 1)


if __name__ == "__main__":
    unittest.main(defaultTest="DocumentDatabaseTests", verbosity=2)
