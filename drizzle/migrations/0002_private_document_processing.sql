CREATE TABLE public.previdenciary_documents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, investigation_id uuid NOT NULL REFERENCES public.investigations(id) ON DELETE CASCADE,
 storage_path text NOT NULL UNIQUE, original_name text NOT NULL, mime_type text NOT NULL, byte_size integer NOT NULL, sha256 text NOT NULL,
 status text NOT NULL DEFAULT 'uploaded', extraction jsonb, model text, extraction_version text, extracted_at timestamptz, external_consent_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), delete_after timestamptz, deletion_state text NOT NULL DEFAULT 'active',
 UNIQUE (investigation_id, sha256)
);
GRANT SELECT ON public.previdenciary_documents TO authenticated;
GRANT ALL ON public.previdenciary_documents TO service_role;
ALTER TABLE public.previdenciary_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY previdenciary_document_owner_read ON public.previdenciary_documents FOR SELECT TO authenticated USING (user_id=auth.uid() AND EXISTS(SELECT 1 FROM public.investigations i WHERE i.id=investigation_id AND i.user_id=auth.uid()));
CREATE INDEX previdenciary_document_thread_idx ON public.previdenciary_documents(investigation_id);
CREATE INDEX previdenciary_document_expiry_idx ON public.previdenciary_documents(delete_after);
CREATE TABLE public.private_ai_usage (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, investigation_id uuid REFERENCES public.investigations(id) ON DELETE CASCADE, document_id uuid REFERENCES public.previdenciary_documents(id) ON DELETE CASCADE,
 operation text NOT NULL, model text, status text NOT NULL DEFAULT 'started', usage jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.private_ai_usage TO authenticated;
GRANT ALL ON public.private_ai_usage TO service_role;
ALTER TABLE public.private_ai_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY private_ai_usage_owner_read ON public.private_ai_usage FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE INDEX private_ai_usage_owner_time_idx ON public.private_ai_usage(user_id,created_at);
CREATE TABLE public.private_processing_preferences (
 user_id uuid PRIMARY KEY, retention_days integer, external_processing_approved boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT retention_positive CHECK(retention_days IS NULL OR retention_days BETWEEN 1 AND 3650)
);
GRANT SELECT ON public.private_processing_preferences TO authenticated;
GRANT ALL ON public.private_processing_preferences TO service_role;
ALTER TABLE public.private_processing_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY private_preferences_read ON public.private_processing_preferences FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE TABLE public.legal_rule_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), rule_key text NOT NULL, version text NOT NULL, official_source_url text NOT NULL, source_sha256 text, effective_from date, effective_until date,
 executable_spec jsonb, status text NOT NULL DEFAULT 'draft', reviewer_reference text, reviewed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(rule_key,version)
);
GRANT SELECT ON public.legal_rule_versions TO authenticated;
GRANT ALL ON public.legal_rule_versions TO service_role;
ALTER TABLE public.legal_rule_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY legal_versions_read ON public.legal_rule_versions FOR SELECT TO authenticated USING(true);
CREATE POLICY previdenciary_objects_read ON storage.objects FOR SELECT TO authenticated USING (bucket_id='documentos-previdenciarios' AND (storage.foldername(name))[1]=auth.uid()::text AND EXISTS(SELECT 1 FROM public.investigations i WHERE i.id::text=(storage.foldername(name))[2] AND i.user_id=auth.uid()));
CREATE FUNCTION public.reserve_private_ai_usage(p_investigation uuid, p_document uuid, p_operation text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE owner_id uuid; event_id uuid;
BEGIN
 SELECT user_id INTO owner_id FROM public.investigations WHERE id=p_investigation;
 IF owner_id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(owner_id::text));
 IF (SELECT count(*) FROM public.private_ai_usage WHERE user_id=owner_id AND created_at > now()-interval '24 hours') >= 20 THEN RAISE EXCEPTION 'usage_limit'; END IF;
 INSERT INTO public.private_ai_usage(user_id,investigation_id,document_id,operation) VALUES(owner_id,p_investigation,p_document,p_operation) RETURNING id INTO event_id;
 RETURN event_id;
END $$;
REVOKE ALL ON FUNCTION public.reserve_private_ai_usage(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_private_ai_usage(uuid,uuid,text) TO service_role;
