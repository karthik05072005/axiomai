-- Add new columns for updated lead structure
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS current_service TEXT,
ADD COLUMN IF NOT EXISTS selected_service TEXT,
ADD COLUMN IF NOT EXISTS status_response TEXT;

-- Rename full_name to name if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='full_name') THEN
        ALTER TABLE public.leads RENAME COLUMN full_name TO name;
    END IF;
END $$;

-- Update existing leads to have default values
UPDATE public.leads 
SET 
  current_service = COALESCE(service_interested, ''),
  selected_service = COALESCE(service_interested, ''),
  status_response = COALESCE(status_response, '')
WHERE current_service IS NULL OR selected_service IS NULL;
