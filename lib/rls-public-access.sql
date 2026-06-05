-- FranconLean — Accès public (anon) en lecture/écriture
--
-- Contexte : l'app lit/écrit avec la clé anon (publique), sans système
-- d'authentification utilisateur. Les policies d'origine exigeaient un
-- utilisateur présent dans la table `users`, ce qui bloquait TOUS les
-- SELECT/INSERT côté navigateur -> dashboard vide (0 €, 0 incidents…).
--
-- Ce script remplace les policies restrictives par un accès public complet
-- sur les tables applicatives. À coller dans Supabase -> SQL Editor -> Run.
--
-- Note sécurité : la clé anon est déjà publique (utilisée côté navigateur).
-- La vraie protection d'un déploiement multi-utilisateur viendrait d'un
-- vrai login Supabase Auth + policies par site. Pour cet outil interne
-- mono-site, l'accès public est acceptable.

-- 1) Supprimer toutes les policies existantes sur les tables applicatives
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'sites', 'sales', 'incidents', 'customer_feedback',
        'kaizen', 'pdca', 'a3_reports', 'insights'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- 2) S'assurer que la RLS est activée (les policies ci-dessous s'appliquent)
ALTER TABLE sites             ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales             ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents         ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE kaizen            ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdca              ENABLE ROW LEVEL SECURITY;
ALTER TABLE a3_reports        ENABLE ROW LEVEL SECURITY;
ALTER TABLE insights          ENABLE ROW LEVEL SECURITY;

-- 3) Policy unique « accès public total » par table (rôles anon + authenticated)
CREATE POLICY "public_all" ON sites             FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON sales             FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON incidents         FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON customer_feedback FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON kaizen            FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON pdca              FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON a3_reports        FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON insights          FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
