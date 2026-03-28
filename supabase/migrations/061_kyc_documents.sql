-- KYC: documentos de identidade (armazenamento privado + metadados no perfil)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS kyc_documents jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.profiles.kyc_documents IS
  'Lista de documentos KYC: [{ "path", "uploaded_at", "original_name" }] — paths no bucket kyc-documents';

INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-documents', 'kyc-documents', false)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "kyc_documents insert own" ON storage.objects;
CREATE POLICY "kyc_documents insert own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "kyc_documents select own" ON storage.objects;
CREATE POLICY "kyc_documents select own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "kyc_documents select admin" ON storage.objects;
CREATE POLICY "kyc_documents select admin" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'kyc-documents'
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "kyc_documents delete own" ON storage.objects;
CREATE POLICY "kyc_documents delete own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
