# Supabase Storage Bucket Setup

## Required Bucket: `ROUTE_DOCUMENTS`

The Passenger Assistant document upload feature requires a Supabase Storage bucket named `ROUTE_DOCUMENTS`.

### Setup Instructions

1. Go to your Supabase Dashboard
2. Navigate to **Storage** section
3. Click **New bucket**
4. Configure the bucket:
   - **Name**: `ROUTE_DOCUMENTS`
   - **Public bucket**: ✅ Enable (checked)
   - **File size limit**: 10 MB (10485760 bytes)
   - **Allowed MIME types**: 
     - `image/jpeg`
     - `image/jpg`
     - `image/png`
     - `image/gif`
     - `application/pdf`

### Storage Policies

The bucket should have the following policies to allow uploads via RPC:

1. **Allow authenticated users to upload**:
   ```sql
   CREATE POLICY "Allow authenticated uploads"
   ON storage.objects FOR INSERT
   TO authenticated
   WITH CHECK (bucket_id = 'ROUTE_DOCUMENTS');
   ```

2. **Allow public read access** (if bucket is public):
   ```sql
   CREATE POLICY "Allow public read"
   ON storage.objects FOR SELECT
   TO public
   USING (bucket_id = 'ROUTE_DOCUMENTS');
   ```

3. **Allow RPC function to upload** (for QR code uploads):
   ```sql
   CREATE POLICY "Allow RPC uploads"
   ON storage.objects FOR INSERT
   TO service_role
   WITH CHECK (bucket_id = 'ROUTE_DOCUMENTS');
   ```

### Folder Structure

Files will be stored in the following structure:
```
ROUTE_DOCUMENTS/
  └── assistants/
      └── {assistant_id}/
          └── {doc_type}_{timestamp}_{index}_{random}.{ext}
```

Example:
```
ROUTE_DOCUMENTS/
  └── assistants/
      └── 1/
          └── TR1_1703123456789_0_abc123.pdf
```

