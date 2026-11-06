CREATE TABLE public.customer_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL UNIQUE REFERENCES public.transactions(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.profiles(id),
  vehicle_id UUID REFERENCES public.vehicles(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000),
  state TEXT NOT NULL DEFAULT 'published' CHECK (state IN ('published', 'hidden')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX customer_reviews_vehicle_idx ON public.customer_reviews(vehicle_id);
CREATE INDEX customer_reviews_created_idx ON public.customer_reviews(created_at DESC);
CREATE TRIGGER customer_reviews_updated_at BEFORE UPDATE ON public.customer_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
ALTER TABLE public.customer_reviews ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.customer_reviews TO authenticated;
CREATE POLICY "Customers insert reviews for own completed transactions" ON public.customer_reviews
  FOR INSERT TO authenticated WITH CHECK (
    customer_id = (SELECT auth.uid()) AND state = 'published'
    AND EXISTS (SELECT 1 FROM public.get_user_roles() r WHERE r.account_id = (SELECT auth.uid()) AND r.role = 'customer')
    AND EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = transaction_id
      AND t.customer_id = (SELECT auth.uid()) AND t.current_state = 'completed'
      AND t.vehicle_id IS NOT DISTINCT FROM customer_reviews.vehicle_id)
  );
CREATE POLICY "Customers read own reviews" ON public.customer_reviews
  FOR SELECT TO authenticated USING (customer_id = (SELECT auth.uid()));
CREATE POLICY "Staff read reviews" ON public.customer_reviews FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.get_user_roles() r WHERE r.account_id = (SELECT auth.uid()) AND r.role <> 'customer')
);
