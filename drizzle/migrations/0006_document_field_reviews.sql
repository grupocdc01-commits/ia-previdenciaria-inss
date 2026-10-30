-- Owner confirmation is administrative only; never proof or legal homologation.
ALTER TABLE public.previdenciary_documents
 ADD COLUMN review_revision integer NOT NULL DEFAULT 0 CHECK (review_revision >= 0),
 ADD COLUMN administrative_review jsonb,
 ADD COLUMN reviewed_at timestamptz;

CREATE TABLE public.document_field_reviews (
 document_id uuid NOT NULL REFERENCES public.previdenciary_documents(id) ON DELETE CASCADE,
 revision integer NOT NULL CHECK (revision > 0),
 user_id uuid NOT NULL,
 sha256 text NOT NULL,
 extraction_version text NOT NULL,
 decisions jsonb NOT NULL CHECK (jsonb_typeof(decisions) = 'array'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(document_id, revision)
);
ALTER TABLE public.document_field_reviews ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.document_field_reviews TO authenticated;
GRANT ALL ON public.document_field_reviews TO service_role;
CREATE POLICY document_reviews_owner_read ON public.document_field_reviews FOR SELECT TO authenticated
 USING (user_id=auth.uid() AND EXISTS (
  SELECT 1 FROM public.previdenciary_documents d WHERE d.id=document_id AND d.user_id=auth.uid()
  AND d.deletion_state='active' AND (d.delete_after IS NULL OR d.delete_after > now())
  AND EXISTS (SELECT 1 FROM public.investigations i WHERE i.id=d.investigation_id AND i.user_id=auth.uid())
 ));

CREATE FUNCTION public.review_document_fields(
 p_document uuid, p_sha256 text, p_extraction_version text, p_expected_revision integer,
 p_extraction jsonb, p_decisions jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE doc public.previdenciary_documents; next_revision integer;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 SELECT d.* INTO doc FROM public.previdenciary_documents d
 WHERE d.id=p_document AND d.user_id=auth.uid()
 AND EXISTS (SELECT 1 FROM public.investigations i WHERE i.id=d.investigation_id AND i.user_id=auth.uid()) FOR UPDATE;
 IF NOT FOUND OR doc.deletion_state <> 'active' OR (doc.delete_after IS NOT NULL AND doc.delete_after <= clock_timestamp())
 THEN RAISE EXCEPTION 'document_unavailable' USING ERRCODE='P0002'; END IF;
 IF p_sha256 IS DISTINCT FROM doc.sha256 OR p_extraction_version IS DISTINCT FROM doc.extraction_version
 OR p_extraction IS DISTINCT FROM doc.extraction OR doc.extraction IS NULL
 THEN RAISE EXCEPTION 'extraction_changed' USING ERRCODE='40001'; END IF;
 IF p_expected_revision IS NULL OR p_expected_revision < 0 OR p_expected_revision >= 2147483647
 OR p_decisions IS NULL OR jsonb_typeof(p_decisions) <> 'array'
 OR jsonb_typeof(doc.extraction->'fields') IS DISTINCT FROM 'array'
 OR doc.extraction->>'documentType' IS NULL OR doc.extraction->>'documentType' = 'medico'
 THEN RAISE EXCEPTION 'invalid_review' USING ERRCODE='22023'; END IF;
 IF jsonb_array_length(p_decisions) > 100 OR jsonb_array_length(p_decisions) <> jsonb_array_length(doc.extraction->'fields')
 OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_decisions) item WHERE item NOT IN ('"pending"'::jsonb,'"confirmed"'::jsonb,'"rejected"'::jsonb))
 THEN RAISE EXCEPTION 'invalid_decisions' USING ERRCODE='22023'; END IF;
 -- An identical retry after a lost response cannot create another revision.
 IF doc.review_revision=p_expected_revision+1 AND doc.administrative_review=p_decisions
 THEN RETURN jsonb_build_object('revision',doc.review_revision,'duplicate',true); END IF;
 IF doc.review_revision <> p_expected_revision THEN RAISE EXCEPTION 'stale_review' USING ERRCODE='40001'; END IF;
 next_revision := doc.review_revision+1;
 UPDATE public.previdenciary_documents SET review_revision=next_revision, administrative_review=p_decisions, reviewed_at=clock_timestamp() WHERE id=doc.id;
 INSERT INTO public.document_field_reviews(document_id,revision,user_id,sha256,extraction_version,decisions)
 VALUES(doc.id,next_revision,auth.uid(),doc.sha256,doc.extraction_version,p_decisions);
 RETURN jsonb_build_object('revision',next_revision,'duplicate',false);
END $$;
REVOKE ALL ON FUNCTION public.review_document_fields(uuid,text,text,integer,jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.review_document_fields(uuid,text,text,integer,jsonb,jsonb) TO authenticated;
