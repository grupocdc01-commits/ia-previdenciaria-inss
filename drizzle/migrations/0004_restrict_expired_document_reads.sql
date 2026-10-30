ALTER POLICY previdenciary_objects_read ON storage.objects USING (
 bucket_id='documentos-previdenciarios' AND (storage.foldername(name))[1]=auth.uid()::text
 AND EXISTS(SELECT 1 FROM public.investigations i WHERE i.id::text=(storage.foldername(name))[2] AND i.user_id=auth.uid())
 AND EXISTS(SELECT 1 FROM public.previdenciary_documents d WHERE d.storage_path=storage.objects.name AND d.user_id=auth.uid() AND d.deletion_state='active' AND (d.delete_after IS NULL OR d.delete_after > now()))
);
ALTER POLICY previdenciary_document_owner_read ON public.previdenciary_documents USING (
 user_id=auth.uid() AND EXISTS(SELECT 1 FROM public.investigations i WHERE i.id=investigation_id AND i.user_id=auth.uid())
 AND deletion_state='active' AND (delete_after IS NULL OR delete_after > now())
);