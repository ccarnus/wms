const { pool, query } = require("../db");
const { hashPassword } = require("../services/authService");

/**
 * Test/demo seed data — only runs when SEED_TEST_DATA=true.
 * Idempotent: uses ON CONFLICT DO NOTHING so it's safe to run repeatedly.
 *
 * Seeds:
 *  - Warehouses, locations, products, inventory
 *  - Rich movement history (30 days)
 *  - Zones, zone-location mappings
 *  - Operators, operator-zone assignments
 *  - Test user accounts
 *  - Tasks with realistic status distribution (max 1 active per operator)
 *  - Audit logs, labor metrics (14 days)
 *  - Task generation events (simulating past OMS orders)
 */

const seed = async () => {
  if (process.env.SEED_TEST_DATA !== "true") {
    console.log("SEED_TEST_DATA is not 'true', skipping test data seed.");
    return;
  }

  console.log("Seeding test data...");

  // ── Warehouses ──────────────────────────────────────────────
  await query(`
    INSERT INTO warehouses (code, name) VALUES
      ('WH-PARIS-01',  'Paris Main Warehouse'),
      ('WH-LILLE-01',  'Lille Distribution Center'),
      ('WH-LYON-01',   'Lyon Regional Hub')
    ON CONFLICT (code) DO NOTHING
  `);
  console.log("  warehouses");

  const { rows: warehouses } = await query(`SELECT id, code FROM warehouses`);
  const whId = (code) => warehouses.find((w) => w.code === code).id;

  // ── Locations ───────────────────────────────────────────────
  await query(`
    INSERT INTO locations (warehouse_id, code, name) VALUES
      ($1, 'PAR-DOCK-IN',   'Paris Inbound Dock'),
      ($1, 'PAR-DOCK-OUT',  'Paris Outbound Dock'),
      ($1, 'PAR-STAGE-01',  'Paris Staging Area 1'),
      ($1, 'PAR-STAGE-02',  'Paris Staging Area 2'),
      ($1, 'PAR-RACK-A1',   'Paris Rack A1'),
      ($1, 'PAR-RACK-A2',   'Paris Rack A2'),
      ($1, 'PAR-RACK-A3',   'Paris Rack A3'),
      ($1, 'PAR-RACK-B1',   'Paris Rack B1'),
      ($1, 'PAR-RACK-B2',   'Paris Rack B2'),
      ($1, 'PAR-BULK-01',   'Paris Bulk Storage 1'),
      ($1, 'PAR-BULK-02',   'Paris Bulk Storage 2'),
      ($2, 'LIL-DOCK-IN',   'Lille Inbound Dock'),
      ($2, 'LIL-DOCK-OUT',  'Lille Outbound Dock'),
      ($2, 'LIL-STAGE-01',  'Lille Staging Area 1'),
      ($2, 'LIL-RACK-A1',   'Lille Rack A1'),
      ($2, 'LIL-RACK-A2',   'Lille Rack A2'),
      ($2, 'LIL-RACK-B1',   'Lille Rack B1'),
      ($2, 'LIL-BULK-01',   'Lille Bulk Storage 1'),
      ($3, 'LYN-DOCK-IN',   'Lyon Inbound Dock'),
      ($3, 'LYN-DOCK-OUT',  'Lyon Outbound Dock'),
      ($3, 'LYN-RACK-A1',   'Lyon Rack A1'),
      ($3, 'LYN-RACK-B1',   'Lyon Rack B1'),
      ($3, 'LYN-BULK-01',   'Lyon Bulk Storage 1')
    ON CONFLICT (warehouse_id, code) DO NOTHING
  `, [whId("WH-PARIS-01"), whId("WH-LILLE-01"), whId("WH-LYON-01")]);
  console.log("  locations");

  // ── Products ────────────────────────────────────────────────
  await query(`
    INSERT INTO products (sku, name) VALUES
      ('SKU-1001', 'Storage Bin Small'),
      ('SKU-1002', 'Storage Bin Large'),
      ('SKU-1003', 'Barcode Scanner'),
      ('SKU-1004', 'RFID Tag Pack (100)'),
      ('SKU-1005', 'Shelf Divider Set'),
      ('SKU-2001', 'Packing Tape Roll'),
      ('SKU-2002', 'Stretch Wrap Film'),
      ('SKU-2003', 'Cardboard Box 40x30'),
      ('SKU-2004', 'Cardboard Box 60x40'),
      ('SKU-2005', 'Bubble Wrap Roll'),
      ('SKU-2006', 'Packing Peanuts Bag'),
      ('SKU-2007', 'Shipping Label Roll (500)'),
      ('SKU-3001', 'Safety Gloves Pair'),
      ('SKU-3002', 'Safety Goggles'),
      ('SKU-3003', 'Hi-Vis Vest'),
      ('SKU-3004', 'Steel-Toe Boots'),
      ('SKU-3005', 'Ear Protection Muffs'),
      ('SKU-4001', 'Pallet Jack Manual'),
      ('SKU-4002', 'Label Printer Ribbon'),
      ('SKU-4003', 'Conveyor Belt Section'),
      ('SKU-4004', 'Forklift Battery Pack'),
      ('SKU-4005', 'Warehouse Fan Industrial')
    ON CONFLICT (sku) DO NOTHING
  `);
  console.log("  products");

  // ── Inventory ───────────────────────────────────────────────
  await query(`
    INSERT INTO inventory (product_id, location_id, quantity)
    SELECT p.id, l.id, s.qty
    FROM (VALUES
      ('SKU-1001', 'PAR-RACK-A1',  120),
      ('SKU-1002', 'PAR-RACK-A1',   45),
      ('SKU-1003', 'PAR-RACK-A2',   30),
      ('SKU-1004', 'PAR-RACK-A2',   80),
      ('SKU-1005', 'PAR-RACK-A3',   55),
      ('SKU-2001', 'PAR-RACK-B1',  500),
      ('SKU-2002', 'PAR-BULK-01',  200),
      ('SKU-2003', 'PAR-BULK-01',  150),
      ('SKU-2004', 'PAR-BULK-01',   80),
      ('SKU-2005', 'PAR-BULK-02',  300),
      ('SKU-2006', 'PAR-BULK-02',  120),
      ('SKU-2007', 'PAR-RACK-B2',   60),
      ('SKU-3001', 'LIL-RACK-A1',  300),
      ('SKU-3002', 'LIL-RACK-A1',   75),
      ('SKU-3003', 'LIL-RACK-A2',  160),
      ('SKU-3004', 'LIL-RACK-A2',   40),
      ('SKU-3005', 'LIL-RACK-B1',   90),
      ('SKU-4001', 'LIL-BULK-01',   10),
      ('SKU-4002', 'LYN-RACK-A1',   90),
      ('SKU-4003', 'LYN-RACK-A1',   15),
      ('SKU-4004', 'LYN-RACK-B1',    8),
      ('SKU-4005', 'LYN-BULK-01',   12),
      ('SKU-1001', 'LYN-RACK-B1',   60),
      ('SKU-2003', 'LYN-RACK-B1',   40),
      ('SKU-1002', 'LIL-RACK-B1',   35),
      ('SKU-2001', 'LYN-RACK-A1',  180)
    ) AS s(sku, loc_code, qty)
    JOIN products  p ON p.sku  = s.sku
    JOIN locations l ON l.code = s.loc_code
    ON CONFLICT (product_id, location_id) DO NOTHING
  `);
  console.log("  inventory");

  // ── Movements (30-day history) ──────────────────────────────
  const movementData = [
    // Older history (20-30 days ago)
    ['SKU-1001', null,           'PAR-RACK-A1',  100, 'INBOUND',   'PO-20260210-H01', 28],
    ['SKU-2001', null,           'PAR-RACK-B1',  250, 'INBOUND',   'PO-20260210-H02', 27],
    ['SKU-3001', null,           'LIL-RACK-A1',  150, 'INBOUND',   'PO-20260211-H01', 26],
    ['SKU-1002', 'PAR-RACK-A1', 'PAR-DOCK-OUT',  20, 'OUTBOUND',  'SO-20260212-H01', 25],
    ['SKU-2003', null,           'PAR-BULK-01',  100, 'INBOUND',   'PO-20260213-H01', 24],
    ['SKU-3003', null,           'LIL-RACK-A2',   80, 'INBOUND',   'PO-20260214-H01', 23],
    ['SKU-1001', 'PAR-RACK-A1', 'LYN-RACK-B1',   30, 'TRANSFER',  'TRF-H001',        22],
    ['SKU-4002', null,           'LYN-RACK-A1',   50, 'INBOUND',   'PO-20260215-H01', 21],
    ['SKU-2005', null,           'PAR-BULK-02',  200, 'INBOUND',   'PO-20260216-H01', 20],
    // Mid history (10-20 days ago)
    ['SKU-1003', null,           'PAR-RACK-A2',   30, 'INBOUND',   'PO-20260220-H01', 18],
    ['SKU-2002', null,           'PAR-BULK-01',  100, 'INBOUND',   'PO-20260221-H01', 17],
    ['SKU-1001', 'PAR-RACK-A1', 'PAR-DOCK-OUT',  15, 'OUTBOUND',  'SO-20260222-H01', 16],
    ['SKU-3002', null,           'LIL-RACK-A1',   75, 'INBOUND',   'PO-20260223-H01', 15],
    ['SKU-2004', null,           'PAR-BULK-01',   40, 'INBOUND',   'PO-20260224-H01', 14],
    ['SKU-1005', null,           'PAR-RACK-A3',   55, 'INBOUND',   'PO-20260225-H01', 13],
    ['SKU-4001', null,           'LIL-BULK-01',   10, 'INBOUND',   'PO-20260226-H01', 12],
    ['SKU-2007', null,           'PAR-RACK-B2',   30, 'INBOUND',   'PO-20260227-H01', 11],
    ['SKU-3004', null,           'LIL-RACK-A2',   40, 'INBOUND',   'PO-20260228-H01', 10],
    // Recent history (1-10 days ago)
    ['SKU-1001', null,           'PAR-RACK-A1',   50, 'INBOUND',   'PO-20260301-001',  9],
    ['SKU-1001', null,           'PAR-RACK-A1',   70, 'INBOUND',   'PO-20260302-001',  8],
    ['SKU-2001', null,           'PAR-RACK-B1',  200, 'INBOUND',   'PO-20260303-001',  7],
    ['SKU-1002', 'PAR-RACK-A1', 'PAR-DOCK-OUT',  10, 'OUTBOUND',  'SO-20260304-001',  6],
    ['SKU-3001', null,           'LIL-RACK-A1',  150, 'INBOUND',   'PO-20260305-001',  5],
    ['SKU-1001', 'PAR-RACK-A1', 'LYN-RACK-B1',   20, 'TRANSFER',  'TRF-0001',         4],
    ['SKU-2003', 'PAR-BULK-01', null,              5, 'ADJUSTMENT', 'ADJ-0001',         3],
    ['SKU-1004', null,           'PAR-RACK-A2',   80, 'INBOUND',   'PO-20260308-001',  2],
    ['SKU-2005', null,           'PAR-BULK-02',  100, 'INBOUND',   'PO-20260309-001',  1],
    ['SKU-3005', null,           'LIL-RACK-B1',   90, 'INBOUND',   'PO-20260310-001',  1],
    ['SKU-4002', 'LYN-RACK-A1', 'LYN-DOCK-OUT',  15, 'OUTBOUND',  'SO-20260311-001',  0],
    ['SKU-2007', null,           'PAR-RACK-B2',   30, 'INBOUND',   'PO-20260312-001',  0],
  ];

  for (const [sku, fromLoc, toLoc, qty, mtype, ref, daysAgo] of movementData) {
    await query(`
      INSERT INTO movements (product_id, from_location_id, to_location_id, quantity, movement_type, reference, created_at)
      SELECT p.id, fl.id, tl.id, $4, $5, $6, NOW() - ($7 || ' days')::interval + (random() * interval '8 hours')
      FROM products p
      LEFT JOIN locations fl ON fl.code = $2
      LEFT JOIN locations tl ON tl.code = $3
      WHERE p.sku = $1
      ON CONFLICT DO NOTHING
    `, [sku, fromLoc, toLoc, qty, mtype, ref, daysAgo]);
  }
  console.log("  movements (30-day history)");

  // ── Zones ───────────────────────────────────────────────────
  await query(`
    INSERT INTO zones (warehouse_id, name, type) VALUES
      ($1, 'Paris Pick Zone',     'pick'),
      ($1, 'Paris Bulk Zone',     'bulk'),
      ($1, 'Paris Dock Zone',     'dock'),
      ($1, 'Paris Staging Zone',  'staging'),
      ($2, 'Lille Pick Zone',     'pick'),
      ($2, 'Lille Dock Zone',     'dock'),
      ($2, 'Lille Bulk Zone',     'bulk'),
      ($3, 'Lyon Pick Zone',      'pick'),
      ($3, 'Lyon Dock Zone',      'dock')
    ON CONFLICT (warehouse_id, name) DO NOTHING
  `, [whId("WH-PARIS-01"), whId("WH-LILLE-01"), whId("WH-LYON-01")]);
  console.log("  zones");

  const { rows: zones } = await query(`SELECT id, name FROM zones`);
  const zoneId = (name) => zones.find((z) => z.name === name).id;

  // ── Location -> Zone mapping ────────────────────────────────
  await query(`
    INSERT INTO location_zones (location_id, zone_id)
    SELECT l.id, s.zone_id
    FROM (VALUES
      ('PAR-RACK-A1',  $1::uuid),
      ('PAR-RACK-A2',  $1::uuid),
      ('PAR-RACK-A3',  $1::uuid),
      ('PAR-RACK-B1',  $1::uuid),
      ('PAR-RACK-B2',  $1::uuid),
      ('PAR-BULK-01',  $2::uuid),
      ('PAR-BULK-02',  $2::uuid),
      ('PAR-DOCK-IN',  $3::uuid),
      ('PAR-DOCK-OUT', $3::uuid),
      ('PAR-STAGE-01', $4::uuid),
      ('PAR-STAGE-02', $4::uuid),
      ('LIL-RACK-A1',  $5::uuid),
      ('LIL-RACK-A2',  $5::uuid),
      ('LIL-RACK-B1',  $5::uuid),
      ('LIL-DOCK-IN',  $6::uuid),
      ('LIL-DOCK-OUT', $6::uuid),
      ('LIL-BULK-01',  $7::uuid),
      ('LIL-STAGE-01', $5::uuid),
      ('LYN-RACK-A1',  $8::uuid),
      ('LYN-RACK-B1',  $8::uuid),
      ('LYN-DOCK-IN',  $9::uuid),
      ('LYN-DOCK-OUT', $9::uuid),
      ('LYN-BULK-01',  $8::uuid)
    ) AS s(loc_code, zone_id)
    JOIN locations l ON l.code = s.loc_code
    ON CONFLICT (location_id) DO NOTHING
  `, [
    zoneId("Paris Pick Zone"), zoneId("Paris Bulk Zone"),
    zoneId("Paris Dock Zone"), zoneId("Paris Staging Zone"),
    zoneId("Lille Pick Zone"), zoneId("Lille Dock Zone"),
    zoneId("Lille Bulk Zone"),
    zoneId("Lyon Pick Zone"), zoneId("Lyon Dock Zone")
  ]);
  console.log("  location_zones");

  // ── Operators ───────────────────────────────────────────────
  await query(`
    INSERT INTO operators (id, name, role, status, shift_start, shift_end, performance_score) VALUES
      ('a0000000-0000-4000-a000-000000000001', 'Alice Martin',    'picker',    'available', '06:00', '14:00', 92.5),
      ('a0000000-0000-4000-a000-000000000002', 'Bob Dupont',      'picker',    'available', '06:00', '14:00', 87.0),
      ('a0000000-0000-4000-a000-000000000003', 'Claire Bernard',  'picker',    'available', '14:00', '22:00', 95.2),
      ('a0000000-0000-4000-a000-000000000004', 'David Leroy',     'forklift',  'available', '06:00', '14:00', 78.3),
      ('a0000000-0000-4000-a000-000000000005', 'Emma Petit',      'forklift',  'available', '06:00', '14:00', 84.1),
      ('a0000000-0000-4000-a000-000000000006', 'Francois Moreau', 'picker',    'available', '14:00', '22:00', 90.0),
      ('a0000000-0000-4000-a000-000000000007', 'Gabrielle Roux',  'picker',    'available', '06:00', '14:00', 88.7),
      ('a0000000-0000-4000-a000-000000000008', 'Hugo Lambert',    'forklift',  'available', '14:00', '22:00', 81.4),
      ('a0000000-0000-4000-a000-000000000009', 'Isabelle Faure',  'picker',    'available', '22:00', '06:00', 93.8),
      ('a0000000-0000-4000-a000-000000000010', 'Julien Garnier',  'forklift',  'available', '22:00', '06:00', 76.5)
    ON CONFLICT (id) DO NOTHING
  `);
  console.log("  operators");

  // ── Operator -> Zone assignments ────────────────────────────
  await query(`
    INSERT INTO operator_zones (operator_id, zone_id) VALUES
      ('a0000000-0000-4000-a000-000000000001', $1),
      ('a0000000-0000-4000-a000-000000000001', $2),
      ('a0000000-0000-4000-a000-000000000002', $1),
      ('a0000000-0000-4000-a000-000000000002', $4),
      ('a0000000-0000-4000-a000-000000000003', $3),
      ('a0000000-0000-4000-a000-000000000003', $5),
      ('a0000000-0000-4000-a000-000000000004', $2),
      ('a0000000-0000-4000-a000-000000000004', $4),
      ('a0000000-0000-4000-a000-000000000005', $4),
      ('a0000000-0000-4000-a000-000000000005', $6),
      ('a0000000-0000-4000-a000-000000000006', $3),
      ('a0000000-0000-4000-a000-000000000006', $5),
      ('a0000000-0000-4000-a000-000000000007', $1),
      ('a0000000-0000-4000-a000-000000000007', $7),
      ('a0000000-0000-4000-a000-000000000008', $6),
      ('a0000000-0000-4000-a000-000000000008', $8),
      ('a0000000-0000-4000-a000-000000000009', $5),
      ('a0000000-0000-4000-a000-000000000009', $9),
      ('a0000000-0000-4000-a000-000000000010', $8),
      ('a0000000-0000-4000-a000-000000000010', $9)
    ON CONFLICT (operator_id, zone_id) DO NOTHING
  `, [
    zoneId("Paris Pick Zone"),    // $1
    zoneId("Paris Bulk Zone"),    // $2
    zoneId("Lille Pick Zone"),    // $3
    zoneId("Paris Dock Zone"),    // $4
    zoneId("Lyon Pick Zone"),     // $5
    zoneId("Lille Dock Zone"),    // $6
    zoneId("Lille Bulk Zone"),    // $7
    zoneId("Lyon Dock Zone"),     // $8
    zoneId("Paris Staging Zone")  // $9
  ]);
  console.log("  operator_zones");

  // ── Users (test accounts) ──────────────────────────────────
  const testUsers = [
    { username: "manager1",    password: "manager123",  displayName: "Marie Durand",     role: "warehouse_manager", operatorId: null },
    { username: "manager2",    password: "manager123",  displayName: "Pierre Blanc",     role: "warehouse_manager", operatorId: null },
    { username: "supervisor1", password: "super123",    displayName: "Jean Rousseau",    role: "supervisor",        operatorId: null },
    { username: "operator1",   password: "oper123",     displayName: "Alice Martin",     role: "operator",          operatorId: "a0000000-0000-4000-a000-000000000001" },
    { username: "operator2",   password: "oper123",     displayName: "Bob Dupont",       role: "operator",          operatorId: "a0000000-0000-4000-a000-000000000002" },
    { username: "operator3",   password: "oper123",     displayName: "Claire Bernard",   role: "operator",          operatorId: "a0000000-0000-4000-a000-000000000003" },
    { username: "operator4",   password: "oper123",     displayName: "David Leroy",      role: "operator",          operatorId: "a0000000-0000-4000-a000-000000000004" },
    { username: "viewer1",     password: "viewer123",   displayName: "Luc Perrin",       role: "viewer",            operatorId: null }
  ];

  for (const u of testUsers) {
    const { rowCount } = await query(`SELECT 1 FROM users WHERE username = $1`, [u.username]);
    if (rowCount > 0) continue;
    const hash = await hashPassword(u.password);
    await query(
      `INSERT INTO users (username, password_hash, display_name, role, operator_id)
       VALUES ($1, $2, $3, $4::user_role, $5)`,
      [u.username, hash, u.displayName, u.role, u.operatorId]
    );
  }
  console.log("  users (test accounts)");

  // ── Tasks ───────────────────────────────────────────────────
  // Rule: max 1 active task (assigned/in_progress/paused) per operator.
  // Operators 001-004 each get one active task. The rest are free.
  // Many completed tasks for historical KPIs.
  const taskRows = [
    // Completed tasks (historical, spread across 14 days) — operators can have many completed
    { type: "pick",      priority: 80, status: "completed",   zone: "Paris Pick Zone",    operator: "a0000000-0000-4000-a000-000000000001", doc: "SO-20260226-001", est: 120, actual: 105, daysAgo: 14 },
    { type: "pick",      priority: 70, status: "completed",   zone: "Paris Pick Zone",    operator: "a0000000-0000-4000-a000-000000000002", doc: "SO-20260226-002", est: 90,  actual: 88,  daysAgo: 14 },
    { type: "putaway",   priority: 60, status: "completed",   zone: "Paris Bulk Zone",    operator: "a0000000-0000-4000-a000-000000000004", doc: "PO-20260227-001", est: 150, actual: 140, daysAgo: 13 },
    { type: "pick",      priority: 85, status: "completed",   zone: "Paris Pick Zone",    operator: "a0000000-0000-4000-a000-000000000001", doc: "SO-20260228-001", est: 110, actual: 95,  daysAgo: 12 },
    { type: "putaway",   priority: 55, status: "completed",   zone: "Paris Bulk Zone",    operator: "a0000000-0000-4000-a000-000000000005", doc: "PO-20260301-001", est: 160, actual: 170, daysAgo: 11 },
    { type: "pick",      priority: 75, status: "completed",   zone: "Lille Pick Zone",    operator: "a0000000-0000-4000-a000-000000000003", doc: "SO-20260301-002", est: 100, actual: 92,  daysAgo: 10 },
    { type: "pick",      priority: 80, status: "completed",   zone: "Lyon Pick Zone",     operator: "a0000000-0000-4000-a000-000000000006", doc: "SO-20260302-001", est: 130, actual: 118, daysAgo: 9 },
    { type: "putaway",   priority: 60, status: "completed",   zone: "Lille Bulk Zone",    operator: "a0000000-0000-4000-a000-000000000007", doc: "PO-20260303-001", est: 140, actual: 135, daysAgo: 8 },
    { type: "pick",      priority: 90, status: "completed",   zone: "Paris Pick Zone",    operator: "a0000000-0000-4000-a000-000000000001", doc: "SO-20260304-001", est: 95,  actual: 82,  daysAgo: 7 },
    { type: "pick",      priority: 85, status: "completed",   zone: "Lille Pick Zone",    operator: "a0000000-0000-4000-a000-000000000006", doc: "SO-20260305-001", est: 105, actual: 98,  daysAgo: 6 },
    { type: "putaway",   priority: 65, status: "completed",   zone: "Paris Dock Zone",    operator: "a0000000-0000-4000-a000-000000000004", doc: "PO-20260305-002", est: 170, actual: 155, daysAgo: 6 },
    { type: "pick",      priority: 80, status: "completed",   zone: "Paris Pick Zone",    operator: "a0000000-0000-4000-a000-000000000002", doc: "SO-20260306-001", est: 100, actual: 94,  daysAgo: 5 },
    { type: "pick",      priority: 75, status: "completed",   zone: "Lyon Pick Zone",     operator: "a0000000-0000-4000-a000-000000000009", doc: "SO-20260306-002", est: 115, actual: 108, daysAgo: 5 },
    { type: "putaway",   priority: 60, status: "completed",   zone: "Lyon Dock Zone",     operator: "a0000000-0000-4000-a000-000000000008", doc: "PO-20260307-001", est: 145, actual: 138, daysAgo: 4 },
    { type: "pick",      priority: 85, status: "completed",   zone: "Lille Pick Zone",    operator: "a0000000-0000-4000-a000-000000000003", doc: "SO-20260308-001", est: 100, actual: 90,  daysAgo: 3 },
    { type: "pick",      priority: 90, status: "completed",   zone: "Paris Pick Zone",    operator: "a0000000-0000-4000-a000-000000000007", doc: "SO-20260309-001", est: 110, actual: 100, daysAgo: 2 },
    { type: "putaway",   priority: 65, status: "completed",   zone: "Paris Bulk Zone",    operator: "a0000000-0000-4000-a000-000000000005", doc: "PO-20260310-001", est: 150, actual: 142, daysAgo: 1 },
    { type: "pick",      priority: 80, status: "completed",   zone: "Paris Pick Zone",    operator: "a0000000-0000-4000-a000-000000000001", doc: "SO-20260311-001", est: 105, actual: 97,  daysAgo: 1 },
    { type: "pick",      priority: 70, status: "completed",   zone: "Lyon Pick Zone",     operator: "a0000000-0000-4000-a000-000000000006", doc: "SO-20260311-002", est: 95,  actual: 88,  daysAgo: 1 },
    // Cancelled
    { type: "pick",      priority: 75, status: "cancelled",   zone: "Lille Pick Zone",    operator: "a0000000-0000-4000-a000-000000000006", doc: "SO-20260306-003", est: 130, actual: null, daysAgo: 5 },
    // Active tasks — EXACTLY ONE per operator (only operators 001-004 have active tasks)
    // Operator 001 (Alice): assigned task (pending, not started)
    { type: "pick",      priority: 90, status: "assigned",    zone: "Paris Pick Zone",    operator: "a0000000-0000-4000-a000-000000000001", doc: "SO-20260312-001", est: 100, actual: null, daysAgo: 0 },
    // Operator 002 (Bob): assigned task (pending, not started)
    { type: "pick",      priority: 85, status: "assigned",    zone: "Paris Pick Zone",    operator: "a0000000-0000-4000-a000-000000000002", doc: "SO-20260312-002", est: 110, actual: null, daysAgo: 0 },
    // Operator 003 (Claire): assigned task (pending)
    { type: "pick",      priority: 80, status: "assigned",    zone: "Lille Pick Zone",    operator: "a0000000-0000-4000-a000-000000000003", doc: "SO-20260312-003", est: 95,  actual: null, daysAgo: 0 },
    // Operator 004 (David): assigned task (pending)
    { type: "putaway",   priority: 60, status: "assigned",    zone: "Paris Dock Zone",    operator: "a0000000-0000-4000-a000-000000000004", doc: "PO-20260312-001", est: 180, actual: null, daysAgo: 0 },
    // Created tasks (unassigned, to be picked up by assignment worker or manual assignment)
    { type: "replenish", priority: 50, status: "created",     zone: "Paris Pick Zone",    operator: null, doc: "RPL-20260312-001", est: 200, actual: null, daysAgo: 0 },
    { type: "count",     priority: 30, status: "created",     zone: "Lyon Pick Zone",     operator: null, doc: "CNT-20260312-001", est: 300, actual: null, daysAgo: 0 },
    { type: "pick",      priority: 85, status: "created",     zone: "Paris Pick Zone",    operator: null, doc: "SO-20260312-004",  est: 115, actual: null, daysAgo: 0 },
    { type: "pick",      priority: 78, status: "created",     zone: "Lille Pick Zone",    operator: null, doc: "SO-20260312-005",  est: 95,  actual: null, daysAgo: 0 },
    { type: "putaway",   priority: 60, status: "created",     zone: "Paris Bulk Zone",    operator: null, doc: "PO-20260312-002",  est: 145, actual: null, daysAgo: 0 },
    { type: "pick",      priority: 90, status: "created",     zone: "Lyon Pick Zone",     operator: null, doc: "SO-20260312-006",  est: 100, actual: null, daysAgo: 0 },
    { type: "putaway",   priority: 65, status: "created",     zone: "Lille Dock Zone",    operator: null, doc: "PO-20260312-003",  est: 170, actual: null, daysAgo: 0 },
    { type: "replenish", priority: 45, status: "created",     zone: "Lille Pick Zone",    operator: null, doc: "RPL-20260312-002", est: 220, actual: null, daysAgo: 0 },
  ];

  const taskIds = [];
  for (const t of taskRows) {
    const startedAt = ["in_progress", "completed", "paused", "cancelled", "failed"].includes(t.status)
      ? `NOW() - interval '${t.daysAgo} days' - interval '${t.est} seconds'`
      : "NULL";
    const completedAt = t.status === "completed"
      ? `NOW() - interval '${t.daysAgo} days'`
      : "NULL";

    const { rows } = await query(`
      INSERT INTO tasks (type, priority, status, zone_id, assigned_operator_id, source_document_id,
                         estimated_time_seconds, actual_time_seconds, started_at, completed_at, created_at)
      VALUES ($1::task_type, $2, $3::task_status, $4, $5, $6, $7, $8,
              ${startedAt}, ${completedAt},
              NOW() - ($9 || ' days')::interval)
      ON CONFLICT DO NOTHING
      RETURNING id
    `, [t.type, t.priority, t.status, zoneId(t.zone), t.operator, t.doc, t.est, t.actual, t.daysAgo]);

    if (rows.length > 0) taskIds.push({ id: rows[0].id, ...t });
  }
  console.log(`  tasks (${taskIds.length} created)`);

  // ── Task Lines ──────────────────────────────────────────────
  const pickLocations = {
    "Paris Pick Zone":  { from: ["PAR-RACK-A1", "PAR-RACK-A2", "PAR-RACK-A3", "PAR-RACK-B1"], to: "PAR-DOCK-OUT" },
    "Paris Bulk Zone":  { from: ["PAR-DOCK-IN"], to: ["PAR-BULK-01", "PAR-BULK-02"] },
    "Paris Dock Zone":  { from: ["PAR-DOCK-IN"], to: ["PAR-BULK-01", "PAR-RACK-B1"] },
    "Lille Pick Zone":  { from: ["LIL-RACK-A1", "LIL-RACK-A2", "LIL-RACK-B1"], to: "LIL-DOCK-OUT" },
    "Lille Dock Zone":  { from: ["LIL-DOCK-IN"], to: ["LIL-RACK-A1", "LIL-BULK-01"] },
    "Lille Bulk Zone":  { from: ["LIL-DOCK-IN"], to: ["LIL-BULK-01"] },
    "Lyon Pick Zone":   { from: ["LYN-RACK-A1", "LYN-RACK-B1"], to: "LYN-DOCK-OUT" },
    "Lyon Dock Zone":   { from: ["LYN-DOCK-IN"], to: ["LYN-RACK-A1", "LYN-BULK-01"] }
  };

  const allSkus = [
    "SKU-1001", "SKU-1002", "SKU-1003", "SKU-1004", "SKU-1005",
    "SKU-2001", "SKU-2002", "SKU-2003", "SKU-2004", "SKU-2005",
    "SKU-2006", "SKU-2007", "SKU-3001", "SKU-3002", "SKU-3003",
    "SKU-3004", "SKU-3005", "SKU-4001", "SKU-4002"
  ];

  for (const t of taskIds) {
    const lineStatus = t.status === "completed" ? "completed"
      : t.status === "cancelled" ? "cancelled"
      : t.status === "in_progress" ? "in_progress"
      : "created";

    const zoneConfig = pickLocations[t.zone];
    if (!zoneConfig) continue;

    const numLines = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < numLines; i++) {
      const sku = allSkus[Math.floor(Math.random() * allSkus.length)];
      const qty = 1 + Math.floor(Math.random() * 20);

      let fromLoc, toLoc;
      if (t.type === "pick" || t.type === "replenish") {
        const fromArr = zoneConfig.from;
        fromLoc = fromArr[Math.floor(Math.random() * fromArr.length)];
        toLoc = Array.isArray(zoneConfig.to) ? zoneConfig.to[Math.floor(Math.random() * zoneConfig.to.length)] : zoneConfig.to;
      } else if (t.type === "putaway") {
        fromLoc = Array.isArray(zoneConfig.from) ? zoneConfig.from[0] : zoneConfig.from;
        const toArr = Array.isArray(zoneConfig.to) ? zoneConfig.to : [zoneConfig.to];
        toLoc = toArr[Math.floor(Math.random() * toArr.length)];
      } else {
        const locArr = zoneConfig.from;
        fromLoc = locArr[Math.floor(Math.random() * locArr.length)];
        toLoc = fromLoc;
      }

      await query(`
        INSERT INTO task_lines (task_id, sku_id, from_location_id, to_location_id, quantity, status)
        SELECT $1::uuid, p.id, fl.id, tl.id, $4, $5::task_line_status
        FROM products p
        JOIN locations fl ON fl.code = $2
        JOIN locations tl ON tl.code = $3
        WHERE p.sku = $6
      `, [t.id, fromLoc, toLoc, qty, lineStatus, sku]);
    }
  }
  console.log("  task_lines");

  // ── Task Status Audit Logs ──────────────────────────────────
  for (const t of taskIds) {
    const transitions = [];
    if (["assigned", "in_progress", "completed", "cancelled", "paused", "failed"].includes(t.status)) {
      transitions.push({ from: "created", to: "assigned", version: 1 });
    }
    if (["in_progress", "completed", "paused", "failed"].includes(t.status)) {
      transitions.push({ from: "assigned", to: "in_progress", version: 2 });
    }
    if (t.status === "completed") {
      transitions.push({ from: "in_progress", to: "completed", version: 3 });
    }
    if (t.status === "cancelled") {
      transitions.push({ from: "assigned", to: "cancelled", version: 2 });
    }
    if (t.status === "paused") {
      transitions.push({ from: "in_progress", to: "paused", version: 3 });
    }

    for (const tr of transitions) {
      await query(`
        INSERT INTO task_status_audit_logs (task_id, from_status, to_status, task_version, changed_by_operator_id)
        VALUES ($1, $2::task_status, $3::task_status, $4, $5)
      `, [t.id, tr.from, tr.to, tr.version, t.operator]);
    }
  }
  console.log("  task_status_audit_logs");

  // ── Labor Daily Metrics (14 days for all operators) ─────────
  const metricOperators = [
    { id: "a0000000-0000-4000-a000-000000000001", avgTasks: 12, avgUnits: 85,  avgTime: 98,  avgUtil: 88 },
    { id: "a0000000-0000-4000-a000-000000000002", avgTasks: 10, avgUnits: 70,  avgTime: 105, avgUtil: 82 },
    { id: "a0000000-0000-4000-a000-000000000003", avgTasks: 14, avgUnits: 95,  avgTime: 88,  avgUtil: 93 },
    { id: "a0000000-0000-4000-a000-000000000004", avgTasks: 8,  avgUnits: 40,  avgTime: 145, avgUtil: 72 },
    { id: "a0000000-0000-4000-a000-000000000005", avgTasks: 9,  avgUnits: 50,  avgTime: 135, avgUtil: 76 },
    { id: "a0000000-0000-4000-a000-000000000006", avgTasks: 11, avgUnits: 78,  avgTime: 100, avgUtil: 85 },
    { id: "a0000000-0000-4000-a000-000000000007", avgTasks: 13, avgUnits: 88,  avgTime: 92,  avgUtil: 89 },
    { id: "a0000000-0000-4000-a000-000000000008", avgTasks: 7,  avgUnits: 35,  avgTime: 150, avgUtil: 68 },
    { id: "a0000000-0000-4000-a000-000000000009", avgTasks: 15, avgUnits: 100, avgTime: 85,  avgUtil: 94 },
    { id: "a0000000-0000-4000-a000-000000000010", avgTasks: 6,  avgUnits: 30,  avgTime: 160, avgUtil: 65 }
  ];

  for (const op of metricOperators) {
    for (let d = 1; d <= 14; d++) {
      const variance = () => 0.8 + Math.random() * 0.4;
      await query(`
        INSERT INTO labor_daily_metrics (operator_id, date, tasks_completed, units_processed, avg_task_time, utilization_percent)
        VALUES ($1, CURRENT_DATE - $2::int, $3, $4, $5, $6)
        ON CONFLICT (operator_id, date) DO NOTHING
      `, [
        op.id,
        d,
        Math.round(op.avgTasks * variance()),
        Math.round(op.avgUnits * variance()),
        Math.round(op.avgTime * variance() * 10) / 10,
        Math.min(100, Math.round(op.avgUtil * variance() * 100) / 100)
      ]);
    }
  }
  console.log("  labor_daily_metrics (14 days)");

  // ── Task Generation Events (simulating past OMS orders) ─────
  const orderEvents = [];
  for (let d = 14; d >= 0; d--) {
    const numOrders = 2 + Math.floor(Math.random() * 4); // 2-5 orders per day
    for (let i = 0; i < numOrders; i++) {
      const isSales = Math.random() < 0.6;
      const dateStr = new Date(Date.now() - d * 86400000).toISOString().split("T")[0].replace(/-/g, "");
      const key = `evt-${isSales ? "so" : "po"}-${dateStr}-${String(i + 1).padStart(3, "0")}`;
      const docId = `${isSales ? "SO" : "PO"}-${dateStr}-${String(i + 1).padStart(3, "0")}`;
      const eventType = isSales ? "sales_order_ready_for_pick" : "purchase_order_received";

      const numLines = 1 + Math.floor(Math.random() * 3);
      const lines = [];
      for (let li = 0; li < numLines; li++) {
        const sku = allSkus[Math.floor(Math.random() * allSkus.length)];
        lines.push({ sku, qty: 1 + Math.floor(Math.random() * 25) });
      }

      orderEvents.push([key, eventType, docId, JSON.stringify({ orderId: docId, lines })]);
    }
  }

  for (const [key, eventType, docId, payload] of orderEvents) {
    await query(`
      INSERT INTO task_generation_events (event_key, event_type, source_document_id, payload)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (event_key) DO NOTHING
    `, [key, eventType, docId, payload]);
  }
  console.log(`  task_generation_events (${orderEvents.length} historical OMS orders)`);

  console.log("Test data seed complete.");
};

seed()
  .then(() => pool.end())
  .catch((error) => {
    console.error("Test data seed failed:", error);
    process.exit(1);
  });
