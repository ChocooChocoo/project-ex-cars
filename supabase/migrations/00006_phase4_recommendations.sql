-- Phase 4: Recommendations Can Be Explained
-- Tables: recommendation_runs, recommendation_results, recommendation_feedback

-- 1. Recommendation Runs
CREATE TABLE public.recommendation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES auth.users(id),
  budget NUMERIC(12,2) NOT NULL CHECK (budget >= 0),
  stated_preferences TEXT,
  criteria_version TEXT NOT NULL DEFAULT '1.0',
  run_date TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rec_runs_customer ON public.recommendation_runs(customer_id, run_date DESC);

-- 2. Recommendation Results
CREATE TABLE public.recommendation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.recommendation_runs(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  budget_score NUMERIC(5,2) NOT NULL CHECK (budget_score >= 0 AND budget_score <= 100),
  condition_score NUMERIC(5,2) NOT NULL CHECK (condition_score >= 0 AND condition_score <= 100),
  fuel_score NUMERIC(5,2) NOT NULL CHECK (fuel_score >= 0 AND fuel_score <= 100),
  demand_score NUMERIC(5,2) NOT NULL CHECK (demand_score >= 0 AND demand_score <= 100),
  mileage_score NUMERIC(5,2) NOT NULL CHECK (mileage_score >= 0 AND mileage_score <= 100),
  total_score NUMERIC(5,2) NOT NULL CHECK (total_score >= 0 AND total_score <= 100),
  rank INTEGER NOT NULL CHECK (rank >= 1)
);

CREATE INDEX idx_rec_results_run ON public.recommendation_results(run_id, rank);
CREATE INDEX idx_rec_results_vehicle ON public.recommendation_results(vehicle_id);

-- 3. Recommendation Feedback
CREATE TABLE public.recommendation_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.recommendation_runs(id) ON DELETE CASCADE,
  selected_vehicle_id UUID NOT NULL REFERENCES public.vehicles(id),
  helpful_state TEXT NOT NULL DEFAULT 'unknown' CHECK (helpful_state IN ('helpful', 'not_helpful', 'unknown')),
  resulting_transaction_id UUID,
  outcome TEXT,
  feedback_date TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rec_feedback_run ON public.recommendation_feedback(run_id);
CREATE INDEX idx_rec_feedback_selected ON public.recommendation_feedback(selected_vehicle_id);

-- Row Level Security

-- Recommendation Runs
ALTER TABLE public.recommendation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can read own recommendation runs"
  ON public.recommendation_runs FOR SELECT
  USING (customer_id = auth.uid());

CREATE POLICY "Staff can read all recommendation runs"
  ON public.recommendation_runs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'account_manager', 'sales_manager', 'marketing_specialist')
    )
  );

CREATE POLICY "Customers can create own recommendation runs"
  ON public.recommendation_runs FOR INSERT
  WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Staff can create recommendation runs"
  ON public.recommendation_runs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'account_manager', 'sales_manager')
    )
  );

-- Recommendation Results
ALTER TABLE public.recommendation_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can read results of own runs"
  ON public.recommendation_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.recommendation_runs r
      WHERE r.id = recommendation_results.run_id
      AND r.customer_id = auth.uid()
    )
  );

CREATE POLICY "Staff can read all recommendation results"
  ON public.recommendation_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'account_manager', 'sales_manager', 'marketing_specialist')
    )
  );

CREATE POLICY "System can insert recommendation results"
  ON public.recommendation_results FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.recommendation_runs r
      WHERE r.id = recommendation_results.run_id
      AND r.customer_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'account_manager', 'sales_manager')
    )
  );

-- Recommendation Feedback
ALTER TABLE public.recommendation_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can read own feedback"
  ON public.recommendation_feedback FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.recommendation_runs r
      WHERE r.id = recommendation_feedback.run_id
      AND r.customer_id = auth.uid()
    )
  );

CREATE POLICY "Staff can read all feedback"
  ON public.recommendation_feedback FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'account_manager', 'sales_manager')
    )
  );

CREATE POLICY "Customers can insert own feedback"
  ON public.recommendation_feedback FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.recommendation_runs r
      WHERE r.id = recommendation_feedback.run_id
      AND r.customer_id = auth.uid()
    )
  );

CREATE POLICY "Customers can update own feedback"
  ON public.recommendation_feedback FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.recommendation_runs r
      WHERE r.id = recommendation_feedback.run_id
      AND r.customer_id = auth.uid()
    )
  );
