-- ====================================================
-- Passenger Assistant QR Token Support
-- ====================================================
-- Adds QR token field to passenger_assistants table and RPC function
-- to upload documents via QR code scanning
-- ====================================================

-- ====================================================
-- ADD QR TOKEN TO PASSENGER_ASSISTANTS TABLE
-- ====================================================

-- Add qr_token column to passenger_assistants table
ALTER TABLE passenger_assistants 
ADD COLUMN IF NOT EXISTS qr_token UUID DEFAULT gen_random_uuid() UNIQUE;

-- Generate QR tokens for existing passenger assistants that don't have one
UPDATE passenger_assistants 
SET qr_token = gen_random_uuid()
WHERE qr_token IS NULL;

-- Create index for fast lookup
CREATE INDEX IF NOT EXISTS idx_passenger_assistants_qr_token ON passenger_assistants(qr_token);

-- Add helpful comment
COMMENT ON COLUMN passenger_assistants.qr_token IS 'Unique UUID token used for QR code scanning to upload documents';

-- ====================================================
-- UPDATE DOCUMENTS TABLE FOR POLYMORPHIC OWNERSHIP
-- ====================================================
-- Add owner_type and owner_id columns to support multiple entity types
-- Keep employee_id for backward compatibility

-- Add owner_type column (nullable, will be 'passenger_assistant', 'employee', etc.)
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS owner_type VARCHAR(50);

-- Add owner_id column (nullable, references different tables based on owner_type)
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS owner_id INTEGER;

-- Add file_url column (for Supabase Storage URLs)
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS file_url TEXT;

-- Add doc_type column (for document type/category)
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS doc_type VARCHAR(100);

-- Add route_session_id to link documents to specific route sessions
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS route_session_id INTEGER REFERENCES route_sessions(id) ON DELETE SET NULL;

-- Create index for owner lookups
CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(owner_type, owner_id);

-- Create index for route session lookups
CREATE INDEX IF NOT EXISTS idx_documents_route_session ON documents(route_session_id);

-- Add helpful comments
COMMENT ON COLUMN documents.owner_type IS 'Type of entity that owns this document (e.g., passenger_assistant, employee)';
COMMENT ON COLUMN documents.owner_id IS 'ID of the owning entity (references different tables based on owner_type)';
COMMENT ON COLUMN documents.file_url IS 'Full URL to the file in Supabase Storage';
COMMENT ON COLUMN documents.doc_type IS 'Type/category of document (e.g., license, certificate, badge)';

-- ====================================================
-- RPC FUNCTION: upload_assistant_document_from_qr
-- ====================================================
-- Allows passenger assistants to upload documents by scanning their QR code
-- ====================================================

-- Drop any existing function with different signatures to avoid conflicts
DROP FUNCTION IF EXISTS upload_assistant_document_from_qr(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS upload_assistant_document_from_qr(UUID, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS upload_assistant_document_from_qr(UUID, TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS upload_assistant_document_from_qr(UUID, TEXT, TEXT, INTEGER, UUID);

CREATE OR REPLACE FUNCTION upload_assistant_document_from_qr(
  p_qr_token UUID,
  p_file_url TEXT,
  p_doc_type TEXT,
  p_route_session_id INTEGER DEFAULT NULL,
  p_uploaded_by UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_assistant_id INTEGER;
  v_employee_id INTEGER;
  v_file_urls TEXT[];
  v_first_url TEXT;
  v_file_name TEXT;
  v_file_type TEXT;
  v_document_id INTEGER;
  v_result JSON;
BEGIN
  -- Validate inputs
  IF p_file_url IS NULL OR p_file_url = '' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'File URL is required'
    );
  END IF;

  IF p_doc_type IS NULL OR p_doc_type = '' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Document type is required'
    );
  END IF;

  -- Find passenger assistant by QR token
  SELECT id, employee_id INTO v_assistant_id, v_employee_id
  FROM passenger_assistants
  WHERE qr_token = p_qr_token;

  IF v_assistant_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Passenger assistant not found with provided QR token'
    );
  END IF;

  -- Parse file URLs (can be a single URL string or JSON array of URLs)
  -- Try to parse as JSON array first, if it fails, treat as single URL
  BEGIN
    v_file_urls := ARRAY(SELECT json_array_elements_text(p_file_url::json));
    v_first_url := v_file_urls[1];
  EXCEPTION
    WHEN OTHERS THEN
      -- If not JSON, treat as single URL string
      v_file_urls := ARRAY[p_file_url];
      v_first_url := p_file_url;
  END;

  -- Extract file name and type from first URL
  v_file_name := substring(v_first_url from '/([^/]+)$');
  v_file_type := CASE 
    WHEN v_first_url LIKE '%.pdf' THEN 'application/pdf'
    WHEN v_first_url LIKE '%.jpg' OR v_first_url LIKE '%.jpeg' THEN 'image/jpeg'
    WHEN v_first_url LIKE '%.png' THEN 'image/png'
    WHEN v_first_url LIKE '%.gif' THEN 'image/gif'
    ELSE 'application/octet-stream'
  END;

    -- Validate route_session_id if provided
    IF p_route_session_id IS NOT NULL THEN
      -- Verify the session exists and belongs to this assistant
      IF NOT EXISTS (
        SELECT 1 FROM route_sessions 
        WHERE id = p_route_session_id 
        AND passenger_assistant_id = v_employee_id
      ) THEN
        RETURN json_build_object(
          'success', false,
          'error', 'Route session not found or does not belong to this passenger assistant'
        );
      END IF;
    END IF;

    -- Store all file URLs as JSON array in file_url column
    -- Insert new document record
    INSERT INTO documents (
      owner_type,
      owner_id,
      employee_id,
      file_url,
      file_name,
      file_type,
      file_path,
      doc_type,
      route_session_id,
      uploaded_by,
      uploaded_at
    )
    VALUES (
      'passenger_assistant',
      v_assistant_id,
      v_employee_id,
      array_to_json(v_file_urls)::text, -- Store JSON array of URLs
      v_file_name || (CASE WHEN array_length(v_file_urls, 1) > 1 THEN ' (+' || (array_length(v_file_urls, 1) - 1)::text || ' more)' ELSE '' END),
      v_file_type,
      v_first_url, -- Store first URL in file_path for backward compatibility
      p_doc_type,
      p_route_session_id,
      NULL, -- uploaded_by is INTEGER (user id), not UUID, so we'll leave it NULL for QR uploads
      NOW()
    )
    RETURNING id INTO v_document_id;

  -- Return success with document details
  v_result := json_build_object(
    'success', true,
    'document_id', v_document_id,
    'assistant_id', v_assistant_id,
    'file_url', array_to_json(v_file_urls)::text,
    'file_urls', v_file_urls, -- Array of URLs
    'file_count', array_length(v_file_urls, 1),
    'doc_type', p_doc_type,
    'uploaded_at', NOW()
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission (specify full signature to avoid ambiguity)
GRANT EXECUTE ON FUNCTION upload_assistant_document_from_qr(UUID, TEXT, TEXT, INTEGER, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION upload_assistant_document_from_qr(UUID, TEXT, TEXT, INTEGER, UUID) TO anon;

-- Add function comment (specify full signature to avoid ambiguity)
COMMENT ON FUNCTION upload_assistant_document_from_qr(UUID, TEXT, TEXT, INTEGER, UUID) IS 
'Uploads a document for a passenger assistant via QR code scanning.
Parameters:
  - p_qr_token: UUID token from passenger assistant QR code
  - p_file_url: Full URL to the uploaded file in Supabase Storage (can be JSON array for multiple files)
  - p_doc_type: Type/category of document (TR1-TR6)
  - p_route_session_id: Optional route session ID to link document to a specific session
  - p_uploaded_by: Optional UUID of user who uploaded (currently not used, kept for future)
Returns: JSON object with success status, document details, or error message.
Example: SELECT upload_assistant_document_from_qr(''123e4567-e89b-12d3-a456-426614174000'', ''https://.../file.pdf'', ''TR1'', 123);';

