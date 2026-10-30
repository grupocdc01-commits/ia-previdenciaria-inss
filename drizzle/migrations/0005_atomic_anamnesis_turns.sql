-- Hand-authored migration. Apply only after review in an authorized environment.
CREATE TABLE public.anamnesis_turns (
 investigation_id uuid NOT NULL REFERENCES public.investigations(id) ON DELETE CASCADE,
 request_id uuid NOT NULL, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 request_hash text NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY (investigation_id, request_id)
);
ALTER TABLE public.anamnesis_turns ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.anamnesis_turns TO authenticated;
GRANT ALL ON public.anamnesis_turns TO service_role;
CREATE POLICY anamnesis_turns_owner_read ON public.anamnesis_turns FOR SELECT TO authenticated
 USING (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.investigations i WHERE i.id = investigation_id AND i.user_id = auth.uid()));

CREATE FUNCTION public.commit_anamnesis_turn(
 p_investigation uuid, p_request uuid, p_expected_updated_at timestamptz,
 p_request_hash text, p_facts jsonb, p_benefit text,
 p_user_text text, p_assistant_text text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE current_thread public.investigations%ROWTYPE; prior_hash text; next_time timestamptz;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501'; END IF;
 SELECT * INTO current_thread FROM public.investigations
   WHERE id = p_investigation AND user_id = auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
 SELECT request_hash INTO prior_hash FROM public.anamnesis_turns
   WHERE investigation_id = p_investigation AND request_id = p_request;
 IF FOUND THEN
   IF prior_hash IS DISTINCT FROM p_request_hash THEN RAISE EXCEPTION 'request_conflict' USING ERRCODE = '40001'; END IF;
   RETURN jsonb_build_object('duplicate', true, 'updatedAt', current_thread.updated_at);
 END IF;
 IF current_thread.updated_at IS DISTINCT FROM p_expected_updated_at THEN RAISE EXCEPTION 'stale_turn' USING ERRCODE = '40001'; END IF;
 IF current_thread.facts->>'interviewVersion' IS DISTINCT FROM '2'
   OR jsonb_typeof(p_facts) IS DISTINCT FROM 'object'
   OR p_facts->>'interviewVersion' IS DISTINCT FROM '2'
   OR octet_length(p_facts::text) > 2097152
   OR p_request_hash IS NULL OR p_request_hash !~ '^[a-f0-9]{64}$'
   OR p_user_text IS NULL OR length(p_user_text) NOT BETWEEN 1 AND 5000
   OR p_assistant_text IS NULL OR length(p_assistant_text) NOT BETWEEN 1 AND 5000
   OR (p_benefit IS NOT NULL AND p_benefit NOT IN ('Aposentadoria', 'Benefício por incapacidade', 'BPC/LOAS', 'Pensão por morte', 'Salário-maternidade', 'Auxílio-reclusão', 'Outro benefício', 'Não sei informar'))
 THEN RAISE EXCEPTION 'invalid_turn' USING ERRCODE = '22023'; END IF;
 -- Distinct monotonic timestamps preserve user/reply order in existing history reads.
 next_time := GREATEST(clock_timestamp(), current_thread.updated_at + interval '2 microseconds');
 INSERT INTO public.investigation_messages(investigation_id, client_id, role, parts, created_at)
 VALUES (p_investigation, 'anamnesis-user-' || p_request::text, 'user', jsonb_build_array(jsonb_build_object('type', 'text', 'text', p_user_text)), next_time),
        (p_investigation, 'anamnesis-reply-' || p_request::text, 'assistant', jsonb_build_array(jsonb_build_object('type', 'text', 'text', p_assistant_text)), next_time + interval '1 microsecond');
 next_time := next_time + interval '1 microsecond';
 UPDATE public.investigations SET facts = p_facts, benefit = p_benefit,
   title = COALESCE(p_benefit, 'Nova investigação') || ' — investigação', updated_at = next_time
   WHERE id = p_investigation AND user_id = auth.uid();
 INSERT INTO public.anamnesis_turns(investigation_id, request_id, user_id, request_hash)
 VALUES (p_investigation, p_request, auth.uid(), p_request_hash);
 RETURN jsonb_build_object('duplicate', false, 'updatedAt', next_time);
END $$;
REVOKE ALL ON FUNCTION public.commit_anamnesis_turn(uuid,uuid,timestamptz,text,jsonb,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.commit_anamnesis_turn(uuid,uuid,timestamptz,text,jsonb,text,text,text) TO authenticated;
