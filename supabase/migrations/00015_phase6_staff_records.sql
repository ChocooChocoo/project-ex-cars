-- 00015: Phase 6 — Staff Records (attendance, employee requests, performance)
-- Staff see own records; Account Manager processes; Head Accountant cross-checks; CEO reads summaries.

-- Attendance entries: one row per employee per date
CREATE TABLE IF NOT EXISTS public.attendance_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  time_in TIMESTAMPTZ,
  time_out TIMESTAMPTZ,
  hours_worked DECIMAL(4,2) GENERATED ALWAYS AS (
    CASE WHEN time_in IS NOT NULL AND time_out IS NOT NULL
      THEN ROUND(EXTRACT(EPOCH FROM (time_out - time_in)) / 3600.0, 2)
      ELSE NULL
    END
  ) STORED,
  status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'half_day', 'on_leave')),
  notes TEXT,
  checked_by UUID REFERENCES public.profiles(id),
  checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_attendance_employee_date UNIQUE (employee_id, attendance_date)
);

ALTER TABLE public.attendance_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read own attendance" ON public.attendance_entries
  FOR SELECT USING (employee_id = auth.uid());

CREATE POLICY "Staff can insert own attendance" ON public.attendance_entries
  FOR INSERT WITH CHECK (employee_id = auth.uid());

CREATE POLICY "Staff can update own attendance before checked" ON public.attendance_entries
  FOR UPDATE USING (employee_id = auth.uid() AND checked_by IS NULL)
  WITH CHECK (employee_id = auth.uid() AND checked_by IS NULL);

CREATE POLICY "Account Manager and CEO can read all attendance" ON public.attendance_entries
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM private.user_roles WHERE account_id = auth.uid()
    AND active = true AND role IN ('ceo', 'account_manager', 'head_accountant')
  ));

CREATE POLICY "Account Manager and Head Accountant can update attendance for checking" ON public.attendance_entries
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM private.user_roles WHERE account_id = auth.uid()
    AND active = true AND role IN ('ceo', 'account_manager', 'head_accountant')
  ));

-- Employee requests: leave, overtime, and other requests
CREATE TABLE IF NOT EXISTS public.employee_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  request_kind TEXT NOT NULL CHECK (request_kind IN ('leave', 'overtime', 'schedule_change', 'other')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  start_date DATE NOT NULL,
  end_date DATE,
  reason TEXT NOT NULL,
  reviewed_by UUID REFERENCES public.profiles(id),
  review_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read own requests" ON public.employee_requests
  FOR SELECT USING (employee_id = auth.uid());

CREATE POLICY "Staff can insert own requests" ON public.employee_requests
  FOR INSERT WITH CHECK (employee_id = auth.uid());

CREATE POLICY "Staff can update own pending requests" ON public.employee_requests
  FOR UPDATE USING (employee_id = auth.uid() AND status = 'pending');

CREATE POLICY "Account Manager can read all requests" ON public.employee_requests
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM private.user_roles WHERE account_id = auth.uid()
    AND active = true AND role IN ('ceo', 'account_manager')
  ));

CREATE POLICY "Account Manager can update requests for review" ON public.employee_requests
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM private.user_roles WHERE account_id = auth.uid()
    AND active = true AND role IN ('ceo', 'account_manager')
  ));

-- Performance records: review cycles for each employee
CREATE TABLE IF NOT EXISTS public.performance_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES public.profiles(id),
  review_period_start DATE NOT NULL,
  review_period_end DATE NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  strengths TEXT,
  areas_for_improvement TEXT,
  goals TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'acknowledged')),
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_review_period CHECK (review_period_end >= review_period_start)
);

ALTER TABLE public.performance_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees can read own reviews" ON public.performance_reviews
  FOR SELECT USING (employee_id = auth.uid());

CREATE POLICY "Account Manager can manage reviews" ON public.performance_reviews
  FOR ALL USING (EXISTS (
    SELECT 1 FROM private.user_roles WHERE account_id = auth.uid()
    AND active = true AND role IN ('ceo', 'account_manager')
  ));

CREATE POLICY "CEO can read all reviews" ON public.performance_reviews
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM private.user_roles WHERE account_id = auth.uid()
    AND active = true AND role = 'ceo'
  ));
