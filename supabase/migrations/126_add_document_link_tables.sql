-- ====================================================
-- Many-to-many document link tables for subjects
-- ====================================================

CREATE TABLE IF NOT EXISTS document_driver_links (
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  driver_employee_id INTEGER NOT NULL REFERENCES drivers(employee_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (document_id, driver_employee_id)
);

CREATE TABLE IF NOT EXISTS document_pa_links (
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  pa_employee_id INTEGER NOT NULL REFERENCES passenger_assistants(employee_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (document_id, pa_employee_id)
);

CREATE TABLE IF NOT EXISTS document_vehicle_links (
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (document_id, vehicle_id)
);

CREATE TABLE IF NOT EXISTS document_subject_document_links (
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  subject_document_id UUID NOT NULL REFERENCES subject_documents(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (document_id, subject_document_id)
);

CREATE INDEX IF NOT EXISTS idx_document_driver_links_driver
  ON document_driver_links(driver_employee_id);

CREATE INDEX IF NOT EXISTS idx_document_pa_links_pa
  ON document_pa_links(pa_employee_id);

CREATE INDEX IF NOT EXISTS idx_document_vehicle_links_vehicle
  ON document_vehicle_links(vehicle_id);

CREATE INDEX IF NOT EXISTS idx_document_subject_document_links_subject
  ON document_subject_document_links(subject_document_id);

