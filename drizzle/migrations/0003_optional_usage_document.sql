CREATE OR REPLACE FUNCTION public.reserve_private_ai_usage(p_investigation uuid, p_document uuid DEFAULT NULL, p_operation text DEFAULT 'conversation') RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
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