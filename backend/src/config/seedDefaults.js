/**
 * @file seedDefaults.js
 * @description Automatic database seeder and workspace self-healing engine.
 * Ensures the system ALWAYS has:
 *  1. Default Organization (Org 1: ProDoc Enterprise)
 *  2. Default Core Users (Admin, Alice Approver, Reginald Reviewer, Valerie Standard, Shazil Saddique)
 *  3. Standard Departments (Engineering, HR, Finance, QA, Legal, Operations)
 *  4. Standard Template Categories (SOPs, Policies, Contracts, Specs)
 *  5. Published Starter Templates (SOP, NDA, Security Policy, Tech Spec, Onboarding)
 *  6. Sample In-Progress and Published Documents with active permissions
 *  7. Cross-tenant auto-provisioning: any newly created organization automatically gets starter data.
 */

const DEFAULT_BCRYPT_PASSWORD_HASH = '$2b$10$kFwz91cDr/a8p1LdPTB.her9mdtAM5LxZxW77x31vGH2OfxNbBieO'; // 'password123'
const SHAZIL_BCRYPT_HASH = '$2b$10$M7qVN/zc8gYysjI0wKThfO2ys.zikIH.51CVivgHfecErC35UZPIa';

const STARTER_DEPARTMENTS = [
  'Engineering',
  'Human Resources',
  'Finance',
  'Quality Assurance',
  'Legal & Compliance',
  'Operations'
];

const STARTER_CATEGORIES = [
  { name: 'Standard Operating Procedures (SOP)', prefix: 'SOP' },
  { name: 'Corporate Policies', prefix: 'POL' },
  { name: 'Contracts & Agreements', prefix: 'AGR' },
  { name: 'Technical Specifications', prefix: 'SPEC' },
  { name: 'Project Management', prefix: 'PRJ' }
];

const STARTER_TEMPLATES = [
  {
    id: 'tpl-starter-sop-001',
    name: 'Standard Operating Procedure (SOP) Template',
    description: 'Master operating procedure with step-by-step responsibilities, QA controls, and verification gates.',
    status: 'published',
    version: 1,
    content: `<h2>1. Purpose & Objectives</h2><p>This standard operating procedure defines the verified methodology for executing critical operational workflows in compliance with organizational quality benchmarks.</p><h2>2. Scope</h2><p>Applies to all engineering, QA, and operational personnel across authorized facilities.</p><h2>3. Responsibilities</h2><p><strong>Primary Author / Operator:</strong> Executes documented sequence and logs real-time status.</p><p><strong>Quality Assurance Reviewer:</strong> Verifies adherence to safety and operational guidelines.</p><h2>4. Step-by-Step Procedure</h2><ol><li>Verify operational readiness of environment and prerequisite tooling.</li><li>Execute primary workflow parameters and record telemetry.</li><li>Perform secondary verification and log sign-off.</li></ol><h2>5. Revision & Audit History</h2><p>Document subject to biannual audit by compliance committee.</p>`
  },
  {
    id: 'tpl-starter-nda-002',
    name: 'Mutual Non-Disclosure & Confidentiality Agreement',
    description: 'Standard two-way confidential disclosure framework covering proprietary IP, trade secrets, and terms.',
    status: 'published',
    version: 1,
    content: `<h2>Mutual Non-Disclosure Agreement</h2><p>This Mutual Non-Disclosure Agreement (&quot;Agreement&quot;) governs the disclosure and protection of proprietary materials between the Disclosing Party and Recipient.</p><h3>1. Definition of Confidential Information</h3><p>Includes all technical data, system specifications, code bases, customer records, and strategic plans disclosed verbally or in writing.</p><h3>2. Standard of Protection</h3><p>The Recipient agrees to employ no less than reasonable standard of care to safeguard disclosed materials against unauthorized exploitation or leak.</p><h3>3. Governing Term</h3><p>This agreement remains actively enforceable for a period of three (3) consecutive calendar years from the execution date.</p>`
  },
  {
    id: 'tpl-starter-policy-003',
    name: 'Information Security & Access Governance Policy',
    description: 'Enterprise governance document outlining credential management, RBAC compliance, and access logging.',
    status: 'published',
    version: 1,
    content: `<h2>1. Overview & Policy Objective</h2><p>Mandates strict zero-trust identity verification, credential hygiene, and least-privilege role assignment across all enterprise applications.</p><h2>2. Access Controls & Role-Based Access</h2><p>All user roles must be designated via the centralized ProDoc RBAC Matrix. Elevated administrative privileges require mandatory periodic review.</p><h2>3. Audit Logging & Retention</h2><p>Authentication attempts, document permission updates, and workflow reviews are immutably logged to the centralized audit trail table for 365 days.</p>`
  },
  {
    id: 'tpl-starter-spec-004',
    name: 'Engineering Technical Architecture Specification',
    description: 'Detailed system architecture document covering endpoints, schema invariants, and high-availability design.',
    status: 'published',
    version: 1,
    content: `<h2>1. Architectural Abstract</h2><p>Specifies high-level technical architecture, persistent data models, asynchronous job processing, and secure communication channels.</p><h2>2. API Contracts & Payload Invariants</h2><p>REST endpoints enforce strict authentication tokens, RFC-compliant error envelopes, and automated pagination headers.</p><h2>3. Resilience & Disaster Recovery</h2><p>Database synchronization runs automatically on bootstrap to heal schema drifts and seed baseline operational data.</p>`
  },
  {
    id: 'tpl-starter-onboarding-005',
    name: 'Employee Training & Onboarding Protocol',
    description: 'Structured onboarding checklist and 90-day progress milestones for new organization members.',
    status: 'published',
    version: 1,
    content: `<h2>1. Welcome & Orientation</h2><p>Introduction to company values, compliance standards, and workspace navigation.</p><h2>2. 30-Day Milestone: System Familiarization</h2><p>Complete assigned LMS modules, configure user security profile, and participate in peer review workflows.</p><h2>3. 60-Day Milestone: Autonomous Contribution</h2><p>Draft primary project documents and manage inbound stakeholder change requests.</p>`
  }
];

/**
 * Self-heals and seeds the entire database.
 * @param {import('mysql2/promise').Connection|import('mysql2/promise').Pool} poolOrConnection
 * @param {number|string} [targetOrgId] If provided, provisions for this specific organization
 * @param {number|string} [targetUserId] User ID to attribute ownership to
 */
async function seedDefaults(poolOrConnection, targetOrgId = null, targetUserId = null) {
  const isPool = typeof poolOrConnection.getConnection === 'function';
  const conn = isPool ? await poolOrConnection.getConnection() : poolOrConnection;

  try {
    console.log('🌱 [Seeder] Checking and self-healing workspace defaults...');

    // 1. Ensure Default Organization (Org 1) exists
    await conn.execute(`
      INSERT INTO organizations (id, name, created_at, settings)
      VALUES (1, 'ProDoc Enterprise', NOW(), '{"general":{"timezone":"UTC","default_language":"en"}}')
      ON DUPLICATE KEY UPDATE name = COALESCE(name, 'ProDoc Enterprise')
    `);

    // 2. Ensure Core Demo Users exist in Org 1
    const coreUsers = [
      { email: 'admin123@gmail.com', firstName: 'Daniel', lastName: 'Ventura', role: 'admin', orgId: 1, hash: DEFAULT_BCRYPT_PASSWORD_HASH, tplApprover: 'yes' },
      { email: 'shaziltest3@gmail.com', firstName: 'Shazil', lastName: 'Saddique', role: 'admin', orgId: 1, hash: SHAZIL_BCRYPT_HASH, tplApprover: 'yes' },
      { email: 'approver@prodoc.com', firstName: 'Alice', lastName: 'Approver', role: 'approver', orgId: 1, hash: DEFAULT_BCRYPT_PASSWORD_HASH, tplApprover: 'yes' },
      { email: 'reviewer@prodoc.com', firstName: 'Reginald', lastName: 'Reviewer', role: 'reviewer', orgId: 1, hash: DEFAULT_BCRYPT_PASSWORD_HASH, tplApprover: 'no' },
      { email: 'viewer@prodoc.com', firstName: 'Valerie', lastName: 'Standard', role: 'viewer', orgId: 1, hash: DEFAULT_BCRYPT_PASSWORD_HASH, tplApprover: 'no' },
      { email: 'author@prodoc.com', firstName: 'Daniel', lastName: 'Author', role: 'author', orgId: 1, hash: DEFAULT_BCRYPT_PASSWORD_HASH, tplApprover: 'no' }
    ];

    for (const u of coreUsers) {
      await conn.execute(`
        INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role, status, template_approver, token_version)
        VALUES (?, ?, ?, ?, ?, ?, 'active', ?, 1)
        ON DUPLICATE KEY UPDATE 
          organization_id = VALUES(organization_id),
          status = 'active',
          role = VALUES(role),
          template_approver = VALUES(template_approver)
      `, [u.orgId, u.email, u.hash, u.firstName, u.lastName, u.role, u.tplApprover]);
    }

    // Retrieve Admin User ID from Org 1
    const [adminRows] = await conn.execute(
      'SELECT id FROM users WHERE email IN ("admin123@gmail.com", "shaziltest3@gmail.com") ORDER BY id ASC LIMIT 1'
    );
    const defaultAdminId = adminRows[0]?.id || 1;

    // Retrieve Approver and Reviewer IDs for workflows
    const [approverRows] = await conn.execute('SELECT id, email, first_name, last_name FROM users WHERE email = "approver@prodoc.com" LIMIT 1');
    const [reviewerRows] = await conn.execute('SELECT id, email, first_name, last_name FROM users WHERE email = "reviewer@prodoc.com" LIMIT 1');
    const approverUser = approverRows[0] || { id: 32, email: 'approver@prodoc.com', first_name: 'Alice', last_name: 'Approver' };
    const reviewerUser = reviewerRows[0] || { id: 31, email: 'reviewer@prodoc.com', first_name: 'Reginald', last_name: 'Reviewer' };

    // Determine target organizations to process
    let orgIds = [];
    if (targetOrgId) {
      orgIds = [Number(targetOrgId)];
    } else {
      const [allOrgs] = await conn.execute('SELECT id FROM organizations');
      orgIds = allOrgs.map(o => Number(o.id));
      if (!orgIds.includes(1)) orgIds.push(1);
    }

    // 3. Provision each organization with departments, categories, templates & documents
    for (const orgId of orgIds) {
      const creatorId = targetUserId || defaultAdminId;
      await provisionSingleOrganization(conn, orgId, creatorId, approverUser, reviewerUser);
    }

    console.log('✅ [Seeder] Workspace defaults successfully seeded and verified across all organizations.');
    return { success: true, orgsProcessed: orgIds.length };
  } catch (err) {
    console.error('❌ [Seeder] Error seeding workspace defaults:', err);
    throw err;
  } finally {
    if (isPool) conn.release();
  }
}

/**
 * Provisions departments, categories, templates, and sample documents for a single organization.
 */
async function provisionSingleOrganization(conn, orgId, creatorId, approverUser, reviewerUser) {
  // A. Departments
  for (const deptName of STARTER_DEPARTMENTS) {
    const [existing] = await conn.execute(
      'SELECT id FROM departments WHERE organization_id = ? AND name = ?',
      [orgId, deptName]
    );
    if (existing.length === 0) {
      await conn.execute(
        'INSERT INTO departments (organization_id, name, status, created_at) VALUES (?, ?, "active", NOW())',
        [orgId, deptName]
      );
    }
  }

  // B. Categories
  for (const cat of STARTER_CATEGORIES) {
    const [existing] = await conn.execute(
      'SELECT category_id FROM template_categories WHERE organization_id = ? AND category_name = ?',
      [orgId, cat.name]
    );
    if (existing.length === 0) {
      const [res] = await conn.execute(
        'INSERT INTO template_categories (organization_id, category_name, category_prefix, parent_category_id, folder_path) VALUES (?, ?, ?, NULL, "")',
        [orgId, cat.name, cat.prefix]
      );
      const catId = res.insertId;
      await conn.execute('UPDATE template_categories SET folder_path = ? WHERE category_id = ?', [String(catId), catId]);
    }
  }

  // Retrieve an existing category ID for template association
  const [catRows] = await conn.execute(
    'SELECT category_id FROM template_categories WHERE organization_id = ? LIMIT 1',
    [orgId]
  );
  const defaultCatId = catRows[0]?.category_id || null;

  // C. Templates
  const [tplCountRows] = await conn.execute(
    'SELECT count(*) as c FROM templates WHERE organization_id = ?',
    [orgId]
  );
  const tplCount = tplCountRows[0]?.c || 0;

  let seededTplIds = [];
  if (tplCount === 0) {
    console.log(`  📦 Organization ${orgId} has 0 templates. Seeding ${STARTER_TEMPLATES.length} starter templates...`);
    for (const tpl of STARTER_TEMPLATES) {
      const tplId = orgId === 1 ? tpl.id : `${tpl.id}-org${orgId}`;
      seededTplIds.push(tplId);

      const templateApprovers = JSON.stringify({
        reviewers: [{ userId: reviewerUser.id, name: `${reviewerUser.first_name} ${reviewerUser.last_name}`, email: reviewerUser.email }],
        approvers: [{ userId: approverUser.id, name: `${approverUser.first_name} ${approverUser.last_name}`, email: approverUser.email }]
      });

      const templateStructure = JSON.stringify([
        { id: 'sec-1', title: '1. Overview & Objectives', type: 'section' },
        { id: 'sec-2', title: '2. Implementation Details', type: 'section' },
        { id: 'sec-3', title: '3. Quality Verification & Sign-off', type: 'section' }
      ]);

      const jsonContent = JSON.stringify({ content: tpl.content });

      await conn.execute(`
        INSERT INTO templates (
          id, organization_id, name, description, content, template_structure,
          template_approvers, required_approvers, created_by, category_id,
          version, status, progress_value, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE 
          status = 'published',
          organization_id = VALUES(organization_id)
      `, [
        tplId, orgId, tpl.name, tpl.description, jsonContent, templateStructure,
        templateApprovers, templateApprovers, creatorId, defaultCatId,
        tpl.version, tpl.status, 100
      ]);
    }
  } else {
    const [existingTpls] = await conn.execute(
      'SELECT id FROM templates WHERE organization_id = ? LIMIT 5',
      [orgId]
    );
    seededTplIds = existingTpls.map(t => t.id);
  }

  // D. Documents
  const [docCountRows] = await conn.execute(
    'SELECT count(*) as c FROM documents WHERE organization_id = ?',
    [orgId]
  );
  const docCount = docCountRows[0]?.c || 0;

  if (docCount === 0 && seededTplIds.length > 0) {
    console.log(`  📄 Organization ${orgId} has 0 documents. Seeding sample active documents...`);

    const primaryTplId = seededTplIds[0];
    const sampleDocs = [
      {
        id: `doc-sample-1-org${orgId}`,
        title: 'Q4 Quality & Information Security Audit Plan',
        status: 'pending_review',
        department: 'Quality Assurance',
        progress: 35,
        version: '1.0'
      },
      {
        id: `doc-sample-2-org${orgId}`,
        title: 'Customer Data Confidentiality & Protection Assessment',
        status: 'pending_approval',
        department: 'Legal & Compliance',
        progress: 75,
        version: '1.0'
      },
      {
        id: `doc-sample-3-org${orgId}`,
        title: 'Cloud High-Availability Technical Specification',
        status: 'approved',
        department: 'Engineering',
        progress: 100,
        version: '1.0'
      },
      {
        id: `doc-sample-4-org${orgId}`,
        title: 'Vendor Master Services & Mutual NDA Protocol',
        status: 'published',
        department: 'Finance',
        progress: 100,
        version: '1.0'
      },
      {
        id: `doc-sample-5-org${orgId}`,
        title: 'Engineering Department Operational SOP - Rev 1',
        status: 'published',
        department: 'Operations',
        progress: 100,
        version: '1.0'
      },
      {
        id: `doc-sample-6-org${orgId}`,
        title: 'New Member 90-Day Technical Onboarding Guide',
        status: 'draft',
        department: 'Human Resources',
        progress: 15,
        version: '0.1'
      }
    ];

    for (const d of sampleDocs) {
      const docApprovers = JSON.stringify({
        reviewers: [{ userId: reviewerUser.id, name: `${reviewerUser.first_name} ${reviewerUser.last_name}`, email: reviewerUser.email, status: d.status === 'pending_approval' || d.status === 'approved' || d.status === 'published' ? 'approved' : 'pending' }],
        approvers: [{ userId: approverUser.id, name: `${approverUser.first_name} ${approverUser.last_name}`, email: approverUser.email, status: d.status === 'approved' || d.status === 'published' ? 'approved' : 'pending' }]
      });

      const docContent = JSON.stringify({
        content: `<p>Active operational draft for <strong>${d.title}</strong> under Department: <em>${d.department}</em>.</p><p>Document is actively synchronized with the ProDoc Document Engine.</p>`
      });
      const emptyElements = JSON.stringify([]);

      await conn.execute(`
        INSERT INTO documents (
          document_id, organization_id, template_id, title, content, elements,
          version, current_revision, created_by, status, department,
          approvers, required_approvers, progress_value, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE status = VALUES(status)
      `, [
        d.id, orgId, primaryTplId, d.title, docContent, emptyElements,
        1, d.version, creatorId, d.status, d.department,
        docApprovers, docApprovers, d.progress
      ]);

      // Assign document permissions for creator, approver, reviewer
      const permUsers = [
        { uid: creatorId, pType: 'author' },
        { uid: reviewerUser.id, pType: 'reviewer' },
        { uid: approverUser.id, pType: 'approver' }
      ];

      for (const p of permUsers) {
        if (!p.uid) continue;
        await conn.execute(`
          INSERT INTO documentpermissions (document_id, user_id, permission_type, assigned_by, status, assigned_at)
          VALUES (?, ?, ?, ?, 'active', NOW())
          ON DUPLICATE KEY UPDATE status = 'active', permission_type = VALUES(permission_type)
        `, [d.id, p.uid, p.pType, creatorId]);
      }
    }
  }
}

module.exports = {
  seedDefaults,
  provisionSingleOrganization
};
