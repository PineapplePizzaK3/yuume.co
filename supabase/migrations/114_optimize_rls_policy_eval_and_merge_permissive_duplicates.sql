-- Supabase Performance Advisor fixes:
-- 1) auth_rls_initplan: wrap auth.* and current_setting() with SELECT in RLS expressions.
-- 2) multiple_permissive_policies: merge duplicate permissive policies per table/action/role-set.

DO $$
DECLARE
  pol RECORD;
  new_qual TEXT;
  new_with_check TEXT;
  qual_changed BOOLEAN;
  check_changed BOOLEAN;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    new_qual := pol.qual;
    new_with_check := pol.with_check;

    IF new_qual IS NOT NULL THEN
      -- Keep already-wrapped calls untouched while replacing bare calls.
      new_qual := regexp_replace(new_qual, '\(\s*select\s+auth\.uid\(\)\s*\)', '__AUTH_UID__', 'gi');
      new_qual := regexp_replace(new_qual, '\(\s*select\s+auth\.jwt\(\)\s*\)', '__AUTH_JWT__', 'gi');
      new_qual := regexp_replace(new_qual, '\(\s*select\s+auth\.role\(\)\s*\)', '__AUTH_ROLE__', 'gi');
      new_qual := regexp_replace(new_qual, '\(\s*select\s+current_setting\(([^)]*)\)\s*\)', '__CURRENT_SETTING__(\1)', 'gi');

      new_qual := regexp_replace(new_qual, 'auth\.uid\(\)', '(select auth.uid())', 'gi');
      new_qual := regexp_replace(new_qual, 'auth\.jwt\(\)', '(select auth.jwt())', 'gi');
      new_qual := regexp_replace(new_qual, 'auth\.role\(\)', '(select auth.role())', 'gi');
      new_qual := regexp_replace(new_qual, 'current_setting\(([^)]*)\)', '(select current_setting(\1))', 'gi');

      new_qual := replace(new_qual, '__AUTH_UID__', '(select auth.uid())');
      new_qual := replace(new_qual, '__AUTH_JWT__', '(select auth.jwt())');
      new_qual := replace(new_qual, '__AUTH_ROLE__', '(select auth.role())');
      new_qual := regexp_replace(new_qual, '__CURRENT_SETTING__\(([^)]*)\)', '(select current_setting(\1))', 'gi');
    END IF;

    IF new_with_check IS NOT NULL THEN
      new_with_check := regexp_replace(new_with_check, '\(\s*select\s+auth\.uid\(\)\s*\)', '__AUTH_UID__', 'gi');
      new_with_check := regexp_replace(new_with_check, '\(\s*select\s+auth\.jwt\(\)\s*\)', '__AUTH_JWT__', 'gi');
      new_with_check := regexp_replace(new_with_check, '\(\s*select\s+auth\.role\(\)\s*\)', '__AUTH_ROLE__', 'gi');
      new_with_check := regexp_replace(new_with_check, '\(\s*select\s+current_setting\(([^)]*)\)\s*\)', '__CURRENT_SETTING__(\1)', 'gi');

      new_with_check := regexp_replace(new_with_check, 'auth\.uid\(\)', '(select auth.uid())', 'gi');
      new_with_check := regexp_replace(new_with_check, 'auth\.jwt\(\)', '(select auth.jwt())', 'gi');
      new_with_check := regexp_replace(new_with_check, 'auth\.role\(\)', '(select auth.role())', 'gi');
      new_with_check := regexp_replace(new_with_check, 'current_setting\(([^)]*)\)', '(select current_setting(\1))', 'gi');

      new_with_check := replace(new_with_check, '__AUTH_UID__', '(select auth.uid())');
      new_with_check := replace(new_with_check, '__AUTH_JWT__', '(select auth.jwt())');
      new_with_check := replace(new_with_check, '__AUTH_ROLE__', '(select auth.role())');
      new_with_check := regexp_replace(new_with_check, '__CURRENT_SETTING__\(([^)]*)\)', '(select current_setting(\1))', 'gi');
    END IF;

    qual_changed := pol.qual IS DISTINCT FROM new_qual;
    check_changed := pol.with_check IS DISTINCT FROM new_with_check;

    IF qual_changed AND new_qual IS NOT NULL THEN
      EXECUTE format(
        'ALTER POLICY %I ON %I.%I USING (%s)',
        pol.policyname,
        pol.schemaname,
        pol.tablename,
        new_qual
      );
    END IF;

    IF check_changed AND new_with_check IS NOT NULL THEN
      EXECUTE format(
        'ALTER POLICY %I ON %I.%I WITH CHECK (%s)',
        pol.policyname,
        pol.schemaname,
        pol.tablename,
        new_with_check
      );
    END IF;
  END LOOP;
END
$$;

DO $$
DECLARE
  grp RECORD;
  pol RECORD;
  merged_qual TEXT;
  merged_with_check TEXT;
  roles_sql TEXT;
  create_sql TEXT;
  new_policy_name TEXT;
BEGIN
  FOR grp IN
    SELECT
      schemaname,
      tablename,
      cmd,
      roles
    FROM pg_policies
    WHERE schemaname = 'public'
      AND permissive = 'PERMISSIVE'
    GROUP BY schemaname, tablename, cmd, roles
    HAVING COUNT(*) > 1
  LOOP
    merged_qual := NULL;
    merged_with_check := NULL;

    FOR pol IN
      SELECT policyname, qual, with_check
      FROM pg_policies
      WHERE schemaname = grp.schemaname
        AND tablename = grp.tablename
        AND cmd = grp.cmd
        AND roles = grp.roles
        AND permissive = 'PERMISSIVE'
      ORDER BY policyname
    LOOP
      IF pol.qual IS NOT NULL THEN
        merged_qual := CASE
          WHEN merged_qual IS NULL THEN '(' || pol.qual || ')'
          ELSE merged_qual || ' OR (' || pol.qual || ')'
        END;
      END IF;

      IF pol.with_check IS NOT NULL THEN
        merged_with_check := CASE
          WHEN merged_with_check IS NULL THEN '(' || pol.with_check || ')'
          ELSE merged_with_check || ' OR (' || pol.with_check || ')'
        END;
      END IF;
    END LOOP;

    SELECT string_agg(format('%I', role_name), ', ')
    INTO roles_sql
    FROM unnest(grp.roles) AS role_name;

    new_policy_name := left(format('perf_merged_%s_%s', grp.tablename, lower(grp.cmd)), 63);

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      new_policy_name,
      grp.schemaname,
      grp.tablename
    );

    FOR pol IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = grp.schemaname
        AND tablename = grp.tablename
        AND cmd = grp.cmd
        AND roles = grp.roles
        AND permissive = 'PERMISSIVE'
    LOOP
      EXECUTE format(
        'DROP POLICY %I ON %I.%I',
        pol.policyname,
        grp.schemaname,
        grp.tablename
      );
    END LOOP;

    create_sql := format(
      'CREATE POLICY %I ON %I.%I AS PERMISSIVE FOR %s TO %s',
      new_policy_name,
      grp.schemaname,
      grp.tablename,
      grp.cmd,
      roles_sql
    );

    IF merged_qual IS NOT NULL AND grp.cmd <> 'INSERT' THEN
      create_sql := create_sql || format(' USING (%s)', merged_qual);
    END IF;

    IF merged_with_check IS NOT NULL AND grp.cmd NOT IN ('SELECT', 'DELETE') THEN
      create_sql := create_sql || format(' WITH CHECK (%s)', merged_with_check);
    END IF;

    EXECUTE create_sql;
  END LOOP;
END
$$;
