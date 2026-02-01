-- Add source column to leads table if it doesn't exist
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS lead_source TEXT DEFAULT 'manual';

-- Add index for better performance on phone lookups
CREATE INDEX IF NOT EXISTS idx_leads_phone ON public.leads(phone);

-- Add index for lead_source filtering
CREATE INDEX IF NOT EXISTS idx_leads_source ON public.leads(lead_source);
