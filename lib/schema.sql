-- FranconLean Supabase SQL Schema

-- Sites
CREATE TABLE sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  manager_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users (extends Supabase auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'director', 'manager', 'collaborator')),
  site_id UUID REFERENCES sites(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sales
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  target NUMERIC(12,2) NOT NULL DEFAULT 0,
  period TEXT NOT NULL CHECK (period IN ('day', 'week', 'month')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- GX Score (Roller's Guest Experience survey score, -100..+100, aggregated daily)
CREATE TABLE gx_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  score NUMERIC(6,2) NOT NULL DEFAULT 0,
  responses_count INTEGER NOT NULL DEFAULT 0,
  period TEXT NOT NULL CHECK (period IN ('day', 'week', 'month')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Incidents
CREATE TABLE incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('process', 'quality', 'security', 'client', 'it', 'logistics', 'other')),
  impact TEXT NOT NULL CHECK (impact IN ('low', 'medium', 'high')),
  owner TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'standardized')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Customer Feedback
CREATE TABLE customer_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('satisfaction', 'complaint')),
  category TEXT NOT NULL CHECK (category IN ('compliment', 'positive_experience', 'complaint', 'remark', 'quality_issue', 'service_issue')),
  description TEXT NOT NULL,
  sentiment TEXT NOT NULL CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Kaizen
CREATE TABLE kaizen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  description TEXT NOT NULL,
  estimated_gain NUMERIC(12,2) NOT NULL DEFAULT 0,
  real_gain NUMERIC(12,2),
  status TEXT NOT NULL DEFAULT 'idea' CHECK (status IN ('idea', 'in_progress', 'implemented', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PDCA
CREATE TABLE pdca (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  problem TEXT NOT NULL,
  objective TEXT NOT NULL,
  action TEXT NOT NULL,
  result TEXT NOT NULL DEFAULT '',
  standardization TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'plan' CHECK (status IN ('plan', 'do', 'check', 'act')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- A3 Reports
CREATE TABLE a3_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  context TEXT NOT NULL DEFAULT '',
  current_state TEXT NOT NULL DEFAULT '',
  target_state TEXT NOT NULL DEFAULT '',
  root_causes TEXT[] NOT NULL DEFAULT '{}',
  five_whys TEXT[] NOT NULL DEFAULT '{}',
  action_plan TEXT[] NOT NULL DEFAULT '{}',
  results TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insights
CREATE TABLE insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('warning', 'improvement', 'info')),
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies

ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE gx_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE kaizen ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdca ENABLE ROW LEVEL SECURITY;
ALTER TABLE a3_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE insights ENABLE ROW LEVEL SECURITY;

-- Sites: authenticated users can read
CREATE POLICY "Sites readable by authenticated" ON sites FOR SELECT TO authenticated USING (true);
CREATE POLICY "Sites writable by admin" ON sites FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

-- Users: users can read their own profile and users in their site
CREATE POLICY "Users readable by authenticated" ON users FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE TO authenticated USING (id = auth.uid());

-- Sales: users can read and write for their site
CREATE POLICY "Sales readable by site members" ON sales FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND site_id = sales.site_id)
);
CREATE POLICY "Sales writable by managers" ON sales FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND site_id = sales.site_id AND role IN ('admin', 'director', 'manager'))
);

-- GX Score: users can read for their site (writes come only from the sync-gx Edge Function via service role)
CREATE POLICY "GX scores readable by site members" ON gx_scores FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND site_id = gx_scores.site_id)
);

-- Incidents: site members can read and write
CREATE POLICY "Incidents readable by site members" ON incidents FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND site_id = incidents.site_id)
);
CREATE POLICY "Incidents writable by site members" ON incidents FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND site_id = incidents.site_id)
);
CREATE POLICY "Incidents updatable by site members" ON incidents FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND site_id = incidents.site_id)
);

-- Customer feedback: site members can read and write
CREATE POLICY "Feedback readable by site members" ON customer_feedback FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND site_id = customer_feedback.site_id)
);
CREATE POLICY "Feedback writable by site members" ON customer_feedback FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND site_id = customer_feedback.site_id)
);

-- Kaizen: site members can read and write
CREATE POLICY "Kaizen readable by site members" ON kaizen FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND site_id = kaizen.site_id)
);
CREATE POLICY "Kaizen writable by site members" ON kaizen FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND site_id = kaizen.site_id)
);
CREATE POLICY "Kaizen updatable by site members" ON kaizen FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND site_id = kaizen.site_id)
);

-- PDCA: site members can read and write
CREATE POLICY "PDCA readable by site members" ON pdca FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND site_id = pdca.site_id)
);
CREATE POLICY "PDCA writable by site members" ON pdca FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND site_id = pdca.site_id)
);
CREATE POLICY "PDCA updatable by site members" ON pdca FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND site_id = pdca.site_id)
);

-- A3 Reports: site members can read and write
CREATE POLICY "A3 readable by site members" ON a3_reports FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND site_id = a3_reports.site_id)
);
CREATE POLICY "A3 writable by site members" ON a3_reports FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND site_id = a3_reports.site_id)
);

-- Insights: site members can read
CREATE POLICY "Insights readable by site members" ON insights FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND site_id = insights.site_id)
);

-- Improvements (to-do per zone for upcoming weekend)
CREATE TABLE improvements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  zone TEXT NOT NULL CHECK (zone IN ('parc', 'anniv', 'bar', 'caisse')),
  description TEXT NOT NULL,
  comment TEXT NOT NULL DEFAULT '',
  done BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE improvements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all" ON improvements FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE improvements ADD COLUMN kind TEXT NOT NULL DEFAULT 'improvement' CHECK (kind IN ('positive', 'improvement'));

-- Link GX reviews to their Roller booking, to surface reviews tied to Anniversaire bookings
ALTER TABLE gx_reviews ADD COLUMN booking_reference TEXT;

-- Brainstorm (team meeting): quick keywords per category, positive/negative
CREATE TABLE brainstorm_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('accueil', 'salles', 'extensions', 'ambiance', 'communication', 'comprehension', 'entraide', 'satisfaction', 'accompagnement', 'feedback')),
  sentiment TEXT NOT NULL CHECK (sentiment IN ('positive', 'negative')),
  keyword TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE brainstorm_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all" ON brainstorm_entries FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Brainstorm session settings: open/close the public form
CREATE TABLE brainstorm_settings (
  site_id UUID PRIMARY KEY REFERENCES sites(id) ON DELETE CASCADE,
  is_open BOOLEAN NOT NULL DEFAULT TRUE
);

ALTER TABLE brainstorm_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all" ON brainstorm_settings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
