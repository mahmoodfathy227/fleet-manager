-- Enable pgcrypto extension for gen_random_bytes function
-- This is required for generating secure tokens in notifications
CREATE EXTENSION IF NOT EXISTS pgcrypto;

