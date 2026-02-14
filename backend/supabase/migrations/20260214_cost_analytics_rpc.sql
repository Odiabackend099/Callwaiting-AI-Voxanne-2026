/**
 * Cost Analytics RPC Function
 *
 * Provides aggregated billing metrics for dashboard analytics:
 * - Total spend in period
 * - Average cost per call
 * - Call count
 * - Trend data
 *
 * Deployed: 2026-02-14
 * Phase: Priority 2 (Dashboard Cost Analytics)
 */

-- Create function to get cost analytics for an organization
CREATE OR REPLACE FUNCTION get_cost_analytics(
  p_org_id UUID,
  p_days INTEGER DEFAULT 30
) RETURNS JSONB AS $$
DECLARE
  v_total_cost INTEGER;
  v_call_count INTEGER;
  v_avg_cost NUMERIC;
  v_max_cost INTEGER;
  v_min_cost INTEGER;
BEGIN
  -- Aggregate cost metrics from calls table
  SELECT
    COALESCE(SUM(cost_cents), 0),
    COUNT(*),
    COALESCE(AVG(cost_cents), 0),
    COALESCE(MAX(cost_cents), 0),
    COALESCE(MIN(cost_cents), 0)
  INTO v_total_cost, v_call_count, v_avg_cost, v_max_cost, v_min_cost
  FROM calls
  WHERE org_id = p_org_id
    AND created_at > NOW() - (p_days || ' days')::INTERVAL
    AND cost_cents IS NOT NULL;

  -- Return structured JSON response
  RETURN jsonb_build_object(
    'total_cost_cents', v_total_cost,
    'total_calls', v_call_count,
    'avg_cost_cents', ROUND(v_avg_cost::NUMERIC, 2),
    'max_cost_cents', v_max_cost,
    'min_cost_cents', v_min_cost,
    'period_days', p_days,
    'period_start', (NOW() - (p_days || ' days')::INTERVAL)::TEXT,
    'period_end', NOW()::TEXT
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permission to authenticated users
GRANT EXECUTE ON FUNCTION get_cost_analytics(UUID, INTEGER) TO authenticated;

-- Create function to get cost trend (daily breakdown)
CREATE OR REPLACE FUNCTION get_cost_trend(
  p_org_id UUID,
  p_days INTEGER DEFAULT 30
) RETURNS TABLE(
  date DATE,
  cost_cents INTEGER,
  call_count INTEGER,
  avg_cost_cents NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(calls.created_at) as date,
    COALESCE(SUM(calls.cost_cents), 0)::INTEGER,
    COUNT(calls.id)::INTEGER,
    COALESCE(ROUND(AVG(calls.cost_cents)::NUMERIC, 2), 0)
  FROM calls
  WHERE calls.org_id = p_org_id
    AND calls.created_at > NOW() - (p_days || ' days')::INTERVAL
    AND calls.cost_cents IS NOT NULL
  GROUP BY DATE(calls.created_at)
  ORDER BY date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permission to authenticated users
GRANT EXECUTE ON FUNCTION get_cost_trend(UUID, INTEGER) TO authenticated;

-- Index for performance optimization
CREATE INDEX IF NOT EXISTS idx_calls_org_created_cost
ON calls(org_id, created_at DESC, cost_cents)
WHERE cost_cents IS NOT NULL;

-- Verify functions are callable
DO $$
BEGIN
  RAISE NOTICE 'get_cost_analytics function created successfully';
  RAISE NOTICE 'get_cost_trend function created successfully';
  RAISE NOTICE 'Cost analytics indexes created';
END $$;
