-- Add status_response column to leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS status_response TEXT;
