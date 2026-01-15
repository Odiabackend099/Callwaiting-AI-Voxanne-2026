-- Create bookings table for Phase 6B testing
CREATE TABLE IF NOT EXISTS public.bookings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  patient_email text NOT NULL,
  provider_id uuid NOT NULL,
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  calendar_event_id text,
  confirmation_token text,
  patient_confirmed_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NOT NULL,
  
  CONSTRAINT bookings_pkey PRIMARY KEY (id),
  CONSTRAINT bookings_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.profiles (id) ON DELETE CASCADE,
  CONSTRAINT bookings_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.profiles (id),
  CONSTRAINT bookings_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles (id),
  CONSTRAINT valid_time_range CHECK ((start_time < end_time)),
  CONSTRAINT valid_status CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'completed'::text, 'cancelled'::text]))),
  CONSTRAINT bookings_confirmation_token_key UNIQUE (confirmation_token)
);

-- Create indexes for performance
CREATE INDEX idx_bookings_org_id ON public.bookings USING btree (org_id);
CREATE INDEX idx_bookings_provider_id ON public.bookings USING btree (provider_id);
CREATE INDEX idx_bookings_status ON public.bookings USING btree (status);
CREATE INDEX idx_bookings_start_time ON public.bookings USING btree (start_time);
CREATE INDEX idx_bookings_org_id_status ON public.bookings USING btree (org_id, status);
CREATE INDEX idx_bookings_provider_start ON public.bookings USING btree (provider_id, start_time);
