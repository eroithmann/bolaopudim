
-- Audit log for predictions: never lose a bet
CREATE TABLE public.prediction_audit (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prediction_id uuid,
  user_id uuid,
  match_id uuid,
  action text NOT NULL, -- INSERT | UPDATE | DELETE
  old_home_score integer,
  old_away_score integer,
  old_points integer,
  new_home_score integer,
  new_away_score integer,
  new_points integer,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.prediction_audit TO authenticated;
GRANT ALL ON public.prediction_audit TO service_role;

ALTER TABLE public.prediction_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all audit logs"
ON public.prediction_audit
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_prediction_audit_prediction_id ON public.prediction_audit(prediction_id);
CREATE INDEX idx_prediction_audit_user_id ON public.prediction_audit(user_id);
CREATE INDEX idx_prediction_audit_changed_at ON public.prediction_audit(changed_at DESC);

-- Trigger function
CREATE OR REPLACE FUNCTION public.log_prediction_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO public.prediction_audit (
      prediction_id, user_id, match_id, action,
      new_home_score, new_away_score, new_points, changed_by
    ) VALUES (
      NEW.id, NEW.user_id, NEW.match_id, 'INSERT',
      NEW.home_score, NEW.away_score, NEW.points, auth.uid()
    );
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO public.prediction_audit (
      prediction_id, user_id, match_id, action,
      old_home_score, old_away_score, old_points,
      new_home_score, new_away_score, new_points, changed_by
    ) VALUES (
      NEW.id, NEW.user_id, NEW.match_id, 'UPDATE',
      OLD.home_score, OLD.away_score, OLD.points,
      NEW.home_score, NEW.away_score, NEW.points, auth.uid()
    );
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO public.prediction_audit (
      prediction_id, user_id, match_id, action,
      old_home_score, old_away_score, old_points, changed_by
    ) VALUES (
      OLD.id, OLD.user_id, OLD.match_id, 'DELETE',
      OLD.home_score, OLD.away_score, OLD.points, auth.uid()
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_prediction_change() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_predictions_audit
AFTER INSERT OR UPDATE OR DELETE ON public.predictions
FOR EACH ROW EXECUTE FUNCTION public.log_prediction_change();

-- Backfill existing predictions as initial INSERT records so we have history from now on
INSERT INTO public.prediction_audit (
  prediction_id, user_id, match_id, action,
  new_home_score, new_away_score, new_points, changed_at
)
SELECT id, user_id, match_id, 'BACKFILL',
       home_score, away_score, points, created_at
FROM public.predictions;
