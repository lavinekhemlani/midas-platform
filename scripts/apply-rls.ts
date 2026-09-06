import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL!)

async function applyRLS() {
  console.log('Applying RLS policies...')

  // Enable RLS on all tables
  await sql`ALTER TABLE users ENABLE ROW LEVEL SECURITY`
  await sql`ALTER TABLE organizations ENABLE ROW LEVEL SECURITY`
  await sql`ALTER TABLE roles ENABLE ROW LEVEL SECURITY`
  await sql`ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY`
  await sql`ALTER TABLE provider_connections ENABLE ROW LEVEL SECURITY`
  await sql`ALTER TABLE qb_customers ENABLE ROW LEVEL SECURITY`
  await sql`ALTER TABLE qb_vendors ENABLE ROW LEVEL SECURITY`
  await sql`ALTER TABLE qb_accounts ENABLE ROW LEVEL SECURITY`
  await sql`ALTER TABLE qb_items ENABLE ROW LEVEL SECURITY`
  await sql`ALTER TABLE qb_invoices ENABLE ROW LEVEL SECURITY`
  await sql`ALTER TABLE qb_bills ENABLE ROW LEVEL SECURITY`
  await sql`ALTER TABLE qb_payments ENABLE ROW LEVEL SECURITY`
  await sql`ALTER TABLE qb_entities ENABLE ROW LEVEL SECURITY`
  await sql`ALTER TABLE sync_cursors ENABLE ROW LEVEL SECURITY`
  await sql`ALTER TABLE sync_jobs ENABLE ROW LEVEL SECURITY`
  await sql`ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY`
  console.log('✓ RLS enabled on all tables')

  // Helper functions
  await sql`
    CREATE OR REPLACE FUNCTION is_org_member(org_id UUID)
    RETURNS BOOLEAN AS $$
      SELECT EXISTS (
        SELECT 1 FROM organization_members
        WHERE organization_id = org_id
          AND user_id = auth.uid()
          AND status = 'active'
      );
    $$ LANGUAGE SQL SECURITY DEFINER STABLE
  `

  await sql`
    CREATE OR REPLACE FUNCTION is_org_admin(org_id UUID)
    RETURNS BOOLEAN AS $$
      SELECT EXISTS (
        SELECT 1 FROM organization_members om
        JOIN roles r ON r.id = om.role_id
        WHERE om.organization_id = org_id
          AND om.user_id = auth.uid()
          AND om.status = 'active'
          AND r.name IN ('owner', 'admin')
      );
    $$ LANGUAGE SQL SECURITY DEFINER STABLE
  `
  console.log('✓ Helper functions created')

  // Users policies
  await sql`DROP POLICY IF EXISTS "Users can view own profile" ON users`
  await sql`CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (id = auth.uid())`
  await sql`DROP POLICY IF EXISTS "Users can update own profile" ON users`
  await sql`CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (id = auth.uid())`

  // Organizations policies
  await sql`DROP POLICY IF EXISTS "Members can view their orgs" ON organizations`
  await sql`CREATE POLICY "Members can view their orgs" ON organizations FOR SELECT USING (is_org_member(id))`
  await sql`DROP POLICY IF EXISTS "Admins can update org" ON organizations`
  await sql`CREATE POLICY "Admins can update org" ON organizations FOR UPDATE USING (is_org_admin(id))`
  await sql`DROP POLICY IF EXISTS "Authenticated can create org" ON organizations`
  await sql`CREATE POLICY "Authenticated can create org" ON organizations FOR INSERT WITH CHECK (auth.uid() IS NOT NULL)`

  // Roles policies
  await sql`DROP POLICY IF EXISTS "Anyone can view roles" ON roles`
  await sql`CREATE POLICY "Anyone can view roles" ON roles FOR SELECT USING (true)`

  // Organization members policies
  await sql`DROP POLICY IF EXISTS "Members can view org members" ON organization_members`
  await sql`CREATE POLICY "Members can view org members" ON organization_members FOR SELECT USING (is_org_member(organization_id))`
  await sql`DROP POLICY IF EXISTS "Admins can manage members" ON organization_members`
  await sql`CREATE POLICY "Admins can manage members" ON organization_members FOR ALL USING (is_org_admin(organization_id))`

  // Provider connections policies
  await sql`DROP POLICY IF EXISTS "Members can view connections" ON provider_connections`
  await sql`CREATE POLICY "Members can view connections" ON provider_connections FOR SELECT USING (is_org_member(organization_id))`
  await sql`DROP POLICY IF EXISTS "Admins can manage connections" ON provider_connections`
  await sql`CREATE POLICY "Admins can manage connections" ON provider_connections FOR ALL USING (is_org_admin(organization_id))`
  console.log('✓ Core policies created')

  // QB entity policies (all same pattern)
  const qbTables = [
    'qb_customers',
    'qb_vendors',
    'qb_accounts',
    'qb_items',
    'qb_invoices',
    'qb_bills',
    'qb_payments',
    'qb_entities',
  ]
  for (const table of qbTables) {
    await sql.unsafe(`DROP POLICY IF EXISTS "Members can view ${table}" ON ${table}`)
    await sql.unsafe(
      `CREATE POLICY "Members can view ${table}" ON ${table} FOR SELECT USING (is_org_member(organization_id))`
    )
    await sql.unsafe(`DROP POLICY IF EXISTS "Members can manage ${table}" ON ${table}`)
    await sql.unsafe(
      `CREATE POLICY "Members can manage ${table}" ON ${table} FOR ALL USING (is_org_member(organization_id))`
    )
  }
  console.log('✓ QB entity policies created')

  // Sync policies
  await sql`DROP POLICY IF EXISTS "Members can view sync_cursors" ON sync_cursors`
  await sql`CREATE POLICY "Members can view sync_cursors" ON sync_cursors FOR SELECT USING (is_org_member(organization_id))`
  await sql`DROP POLICY IF EXISTS "Members can manage sync_cursors" ON sync_cursors`
  await sql`CREATE POLICY "Members can manage sync_cursors" ON sync_cursors FOR ALL USING (is_org_member(organization_id))`
  await sql`DROP POLICY IF EXISTS "Members can view sync_jobs" ON sync_jobs`
  await sql`CREATE POLICY "Members can view sync_jobs" ON sync_jobs FOR SELECT USING (is_org_member(organization_id))`
  await sql`DROP POLICY IF EXISTS "Members can create sync_jobs" ON sync_jobs`
  await sql`CREATE POLICY "Members can create sync_jobs" ON sync_jobs FOR INSERT WITH CHECK (is_org_member(organization_id))`

  // Audit policies
  await sql`DROP POLICY IF EXISTS "Members can view audit_logs" ON audit_logs`
  await sql`CREATE POLICY "Members can view audit_logs" ON audit_logs FOR SELECT USING (organization_id IS NULL OR is_org_member(organization_id))`
  console.log('✓ Sync and audit policies created')

  // Insert default roles
  await sql`
    INSERT INTO roles (name, permissions) VALUES
      ('owner', '["*"]'::jsonb),
      ('admin', '["read", "write", "manage_members"]'::jsonb),
      ('member', '["read", "write"]'::jsonb),
      ('viewer', '["read"]'::jsonb)
    ON CONFLICT (name) DO NOTHING
  `
  console.log('✓ Default roles inserted')

  await sql.end()
  console.log('\n✅ All RLS policies applied successfully!')
}

applyRLS().catch(console.error)
