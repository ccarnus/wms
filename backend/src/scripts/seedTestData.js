const { pool, query } = require("../db");
const { hashPassword } = require("../services/authService");

/**
 * Test/demo seed data — only runs when SEED_TEST_DATA=true.
 * Idempotent: uses ON CONFLICT DO NOTHING so it's safe to run repeatedly.
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
  console.log("  ✓ warehouses");

  // Fetch warehouse IDs for FK references
  const { rows: warehouses } = await query(`SELECT id, code FROM warehouses`);
  const whId = (code) => warehouses.find((w) => w.code === code).id;

  // ── Locations ───────────────────────────────────────────────
  await query(`
    INSERT INTO locations (warehouse_id, code, name) VALUES
      ($1, 'PAR-DOCK-IN',   'Paris Inbound Dock'),
      ($1, 'PAR-DOCK-OUT',  'Paris Outbound Dock'),
      ($1, 'PAR-STAGE-01',  'Paris Staging Area 1'),
      ($1, 'PAR-RACK-A1',   'Paris Rack A1'),
      ($1, 'PAR-RACK-A2',   'Paris Rack A2'),
      ($1, 'PAR-RACK-B1',   'Paris Rack B1'),
      ($1, 'PAR-BULK-01',   'Paris Bulk Storage 1'),
      ($2, 'LIL-DOCK-IN',   'Lille Inbound Dock'),
      ($2, 'LIL-DOCK-OUT',  'Lille Outbound Dock'),
      ($2, 'LIL-RACK-A1',   'Lille Rack A1'),
      ($2, 'LIL-RACK-A2',   'Lille Rack A2'),
      ($2, 'LIL-BULK-01',   'Lille Bulk Storage 1'),
      ($3, 'LYN-DOCK-IN',   'Lyon Inbound Dock'),
      ($3, 'LYN-RACK-A1',   'Lyon Rack A1'),
      ($3, 'LYN-RACK-B1',   'Lyon Rack B1')
    ON CONFLICT (warehouse_id, code) DO NOTHING
  `, [whId("WH-PARIS-01"), whId("WH-LILLE-01"), whId("WH-LYON-01")]);
  console.log("  ✓ locations");

  // ── Products ────────────────────────────────────────────────
  await query(`
    INSERT INTO products (sku, name) VALUES
      ('SKU-1001', 'Storage Bin Small'),
      ('SKU-1002', 'Storage Bin Large'),
      ('SKU-1003', 'Barcode Scanner'),
      ('SKU-2001', 'Packing Tape Roll'),
      ('SKU-2002', 'Stretch Wrap Film'),
      ('SKU-2003', 'Cardboard Box 40x30'),
      ('SKU-2004', 'Cardboard Box 60x40'),
      ('SKU-3001', 'Safety Gloves Pair'),
      ('SKU-3002', 'Safety Goggles'),
      ('SKU-3003', 'Hi-Vis Vest'),
      ('SKU-4001', 'Pallet Jack Manual'),
      ('SKU-4002', 'Label Printer Ribbon')
    ON CONFLICT (sku) DO NOTHING
  `);
  console.log("  ✓ products");

  // ── Inventory ───────────────────────────────────────────────
  await query(`
    INSERT INTO inventory (product_id, location_id, quantity)
    SELECT p.id, l.id, s.qty
    FROM (VALUES
      ('SKU-1001', 'PAR-RACK-A1',  120),
      ('SKU-1002', 'PAR-RACK-A1',   45),
      ('SKU-1003', 'PAR-RACK-A2',   30),
      ('SKU-2001', 'PAR-RACK-B1',  500),
      ('SKU-2002', 'PAR-BULK-01',  200),
      ('SKU-2003', 'PAR-BULK-01',  150),
      ('SKU-2004', 'PAR-BULK-01',   80),
      ('SKU-3001', 'LIL-RACK-A1',  300),
      ('SKU-3002', 'LIL-RACK-A1',   75),
      ('SKU-3003', 'LIL-RACK-A2',  160),
      ('SKU-4001', 'LIL-BULK-01',   10),
      ('SKU-4002', 'LYN-RACK-A1',   90),
      ('SKU-1001', 'LYN-RACK-B1',   60),
      ('SKU-2003', 'LYN-RACK-B1',   40)
    ) AS s(sku, loc_code, qty)
    JOIN products  p ON p.sku  = s.sku
    JOIN locations l ON l.code = s.loc_code
    ON CONFLICT (product_id, location_id) DO NOTHING
  `);
  console.log("  ✓ inventory");

  // ── Movements (recent history) ──────────────────────────────
  await query(`
    INSERT INTO movements (product_id, from_location_id, to_location_id, quantity, movement_type, reference, created_at)
    SELECT p.id, fl.id, tl.id, s.qty, s.mtype, s.ref, NOW() - (s.days_ago || ' days')::interval
    FROM (VALUES
      ('SKU-1001', NULL,           'PAR-RACK-A1',  50, 'INBOUND',   'PO-20260201',  5),
      ('SKU-1001', NULL,           'PAR-RACK-A1',  70, 'INBOUND',   'PO-20260205',  3),
      ('SKU-2001', NULL,           'PAR-RACK-B1', 200, 'INBOUND',   'PO-20260210',  2),
      ('SKU-1002', 'PAR-RACK-A1', 'PAR-DOCK-OUT', 10, 'OUTBOUND',  'SO-20260212',  1),
      ('SKU-3001', NULL,           'LIL-RACK-A1', 300, 'INBOUND',   'PO-20260208',  4),
      ('SKU-1001', 'PAR-RACK-A1', 'LYN-RACK-B1',  20, 'TRANSFER',  'TRF-0001',     2),
      ('SKU-2003', 'PAR-BULK-01', NULL,            5,  'ADJUSTMENT','ADJ-0001',      1)
    ) AS s(sku, from_loc, to_loc, qty, mtype, ref, days_ago)
    JOIN products  p  ON p.sku  = s.sku
    LEFT JOIN locations fl ON fl.code = s.from_loc
    LEFT JOIN locations tl ON tl.code = s.to_loc
    ON CONFLICT DO NOTHING
  `);
  console.log("  ✓ movements");

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
  console.log("  ✓ zones");

  // Fetch zone IDs
  const { rows: zones } = await query(`SELECT id, name FROM zones`);
  const zoneId = (name) => zones.find((z) => z.name === name).id;

  // ── Location → Zone mapping ─────────────────────────────────
  await query(`
    INSERT INTO location_zones (location_id, zone_id)
    SELECT l.id, s.zone_id
    FROM (VALUES
      ('PAR-RACK-A1',  $1::uuid),
      ('PAR-RACK-A2',  $1::uuid),
      ('PAR-RACK-B1',  $1::uuid),
      ('PAR-BULK-01',  $2::uuid),
      ('PAR-DOCK-IN',  $3::uuid),
      ('PAR-DOCK-OUT', $3::uuid),
      ('PAR-STAGE-01', $4::uuid),
      ('LIL-RACK-A1',  $5::uuid),
      ('LIL-RACK-A2',  $5::uuid),
      ('LIL-DOCK-IN',  $6::uuid),
      ('LIL-DOCK-OUT', $6::uuid),
      ('LIL-BULK-01',  $7::uuid),
      ('LYN-RACK-A1',  $8::uuid),
      ('LYN-RACK-B1',  $8::uuid),
      ('LYN-DOCK-IN',  $9::uuid)
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
  console.log("  ✓ location_zones");

  // ── Operators ───────────────────────────────────────────────
  await query(`
    INSERT INTO operators (id, name, role, status, shift_start, shift_end, performance_score) VALUES
      ('a0000000-0000-0000-0000-000000000001', 'Alice Martin',   'picker',    'available', '06:00', '14:00', 92.5),
      ('a0000000-0000-0000-0000-000000000002', 'Bob Dupont',     'picker',    'available', '06:00', '14:00', 87.0),
      ('a0000000-0000-0000-0000-000000000003', 'Claire Bernard', 'picker',    'offline',   '14:00', '22:00', 95.2),
      ('a0000000-0000-0000-0000-000000000004', 'David Leroy',    'forklift',  'available', '06:00', '14:00', 78.3),
      ('a0000000-0000-0000-0000-000000000005', 'Emma Petit',     'forklift',  'busy',      '06:00', '14:00', 84.1),
      ('a0000000-0000-0000-0000-000000000006', 'François Moreau', 'picker',   'available', '14:00', '22:00', 90.0)
    ON CONFLICT (id) DO NOTHING
  `);
  console.log("  ✓ operators");

  // ── Operator → Zone assignments ─────────────────────────────
  await query(`
    INSERT INTO operator_zones (operator_id, zone_id) VALUES
      ('a0000000-0000-0000-0000-000000000001', $1),
      ('a0000000-0000-0000-0000-000000000001', $2),
      ('a0000000-0000-0000-0000-000000000002', $1),
      ('a0000000-0000-0000-0000-000000000003', $3),
      ('a0000000-0000-0000-0000-000000000004', $2),
      ('a0000000-0000-0000-0000-000000000004', $4),
      ('a0000000-0000-0000-0000-000000000005', $4),
      ('a0000000-0000-0000-0000-000000000006', $3),
      ('a0000000-0000-0000-0000-000000000006', $5)
    ON CONFLICT (operator_id, zone_id) DO NOTHING
  `, [
    zoneId("Paris Pick Zone"), zoneId("Paris Bulk Zone"),
    zoneId("Lille Pick Zone"), zoneId("Paris Dock Zone"),
    zoneId("Lyon Pick Zone")
  ]);
  console.log("  ✓ operator_zones");

  // ── Users (test accounts) ──────────────────────────────────
  const testUsers = [
    { username: "manager1",  password: "manager123",  displayName: "Marie Durand",   role: "warehouse_manager", operatorId: null },
    { username: "supervisor1", password: "super123",  displayName: "Jean Rousseau",  role: "supervisor",        operatorId: null },
    { username: "operator1", password: "oper123",     displayName: "Alice Martin",   role: "operator",          operatorId: "a0000000-0000-0000-0000-000000000001" },
    { username: "operator2", password: "oper123",     displayName: "Bob Dupont",     role: "operator",          operatorId: "a0000000-0000-0000-0000-000000000002" },
    { username: "operator3", password: "oper123",     displayName: "Claire Bernard", role: "operator",          operatorId: "a0000000-0000-0000-0000-000000000003" },
    { username: "viewer1",   password: "viewer123",   displayName: "Luc Perrin",     role: "viewer",            operatorId: null }
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
  console.log("  ✓ users (test accounts)");

  // ── Tasks (mix of statuses) ─────────────────────────────────
  const taskRows = [
    { type: "pick",      priority: 80, status: "completed",   zone: "Paris Pick Zone",  operator: "a0000000-0000-0000-0000-000000000001", doc: "SO-20260201-001", est: 120, actual: 105, daysAgo: 4 },
    { type: "pick",      priority: 70, status: "completed",   zone: "Paris Pick Zone",  operator: "a0000000-0000-0000-0000-000000000002", doc: "SO-20260201-002", est: 90,  actual: 88,  daysAgo: 4 },
    { type: "putaway",   priority: 60, status: "completed",   zone: "Paris Bulk Zone",  operator: "a0000000-0000-0000-0000-000000000004", doc: "PO-20260202-001", est: 150, actual: 140, daysAgo: 3 },
    { type: "pick",      priority: 90, status: "in_progress", zone: "Lille Pick Zone",  operator: "a0000000-0000-0000-0000-000000000003", doc: "SO-20260210-001", est: 100, actual: null, daysAgo: 0 },
    { type: "putaway",   priority: 60, status: "assigned",    zone: "Paris Dock Zone",  operator: "a0000000-0000-0000-0000-000000000004", doc: "PO-20260211-001", est: 180, actual: null, daysAgo: 0 },
    { type: "replenish", priority: 50, status: "created",     zone: "Paris Pick Zone",  operator: null,                                   doc: "RPL-20260212-001", est: 200, actual: null, daysAgo: 0 },
    { type: "count",     priority: 30, status: "created",     zone: "Lyon Pick Zone",   operator: null,                                   doc: "CNT-20260212-001", est: 300, actual: null, daysAgo: 0 },
    { type: "pick",      priority: 85, status: "completed",   zone: "Paris Pick Zone",  operator: "a0000000-0000-0000-0000-000000000001", doc: "SO-20260205-001", est: 110, actual: 95,  daysAgo: 2 },
    { type: "pick",      priority: 75, status: "cancelled",   zone: "Lille Pick Zone",  operator: "a0000000-0000-0000-0000-000000000006", doc: "SO-20260206-001", est: 130, actual: null, daysAgo: 1 },
    { type: "putaway",   priority: 55, status: "completed",   zone: "Paris Bulk Zone",  operator: "a0000000-0000-0000-0000-000000000005", doc: "PO-20260207-001", est: 160, actual: 170, daysAgo: 2 }
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
  console.log(`  ✓ tasks (${taskIds.length} created)`);

  // ── Task Lines ──────────────────────────────────────────────
  for (const t of taskIds) {
    const lineStatus = t.status === "completed" ? "completed"
      : t.status === "cancelled" ? "cancelled"
      : t.status === "in_progress" ? "in_progress"
      : "created";

    if (t.type === "pick" || t.type === "replenish") {
      await query(`
        INSERT INTO task_lines (task_id, sku_id, from_location_id, to_location_id, quantity, status)
        SELECT $1::uuid, p.id, fl.id, tl.id, s.qty, $2::task_line_status
        FROM (VALUES
          ('SKU-1001', 'PAR-RACK-A1', 'PAR-DOCK-OUT', 5),
          ('SKU-2001', 'PAR-RACK-B1', 'PAR-DOCK-OUT', 10)
        ) AS s(sku, from_loc, to_loc, qty)
        JOIN products  p  ON p.sku  = s.sku
        JOIN locations fl ON fl.code = s.from_loc
        JOIN locations tl ON tl.code = s.to_loc
      `, [t.id, lineStatus]);
    } else if (t.type === "putaway") {
      await query(`
        INSERT INTO task_lines (task_id, sku_id, from_location_id, to_location_id, quantity, status)
        SELECT $1::uuid, p.id, fl.id, tl.id, s.qty, $2::task_line_status
        FROM (VALUES
          ('SKU-2003', 'PAR-DOCK-IN', 'PAR-BULK-01', 20)
        ) AS s(sku, from_loc, to_loc, qty)
        JOIN products  p  ON p.sku  = s.sku
        JOIN locations fl ON fl.code = s.from_loc
        JOIN locations tl ON tl.code = s.to_loc
      `, [t.id, lineStatus]);
    } else if (t.type === "count") {
      await query(`
        INSERT INTO task_lines (task_id, sku_id, from_location_id, to_location_id, quantity, status)
        SELECT $1::uuid, p.id, l.id, l.id, 1, $2::task_line_status
        FROM (VALUES ('SKU-4002', 'LYN-RACK-A1')) AS s(sku, loc)
        JOIN products  p ON p.sku  = s.sku
        JOIN locations l ON l.code = s.loc
      `, [t.id, lineStatus]);
    }
  }
  console.log("  ✓ task_lines");

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

    for (const tr of transitions) {
      await query(`
        INSERT INTO task_status_audit_logs (task_id, from_status, to_status, task_version, changed_by_operator_id)
        VALUES ($1, $2::task_status, $3::task_status, $4, $5)
      `, [t.id, tr.from, tr.to, tr.version, t.operator]);
    }
  }
  console.log("  ✓ task_status_audit_logs");

  // ── Labor Daily Metrics (last 7 days for active operators) ──
  const metricOperators = [
    { id: "a0000000-0000-0000-0000-000000000001", avgTasks: 12, avgUnits: 85,  avgTime: 98,  avgUtil: 88 },
    { id: "a0000000-0000-0000-0000-000000000002", avgTasks: 10, avgUnits: 70,  avgTime: 105, avgUtil: 82 },
    { id: "a0000000-0000-0000-0000-000000000003", avgTasks: 14, avgUnits: 95,  avgTime: 88,  avgUtil: 93 },
    { id: "a0000000-0000-0000-0000-000000000004", avgTasks: 8,  avgUnits: 40,  avgTime: 145, avgUtil: 72 },
    { id: "a0000000-0000-0000-0000-000000000005", avgTasks: 9,  avgUnits: 50,  avgTime: 135, avgUtil: 76 },
    { id: "a0000000-0000-0000-0000-000000000006", avgTasks: 11, avgUnits: 78,  avgTime: 100, avgUtil: 85 }
  ];

  for (const op of metricOperators) {
    for (let d = 1; d <= 7; d++) {
      // Add some variance
      const variance = () => 0.8 + Math.random() * 0.4; // 0.8–1.2
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
  console.log("  ✓ labor_daily_metrics (7 days)");

  // ── Task Generation Events ──────────────────────────────────
  await query(`
    INSERT INTO task_generation_events (event_key, event_type, source_document_id, payload) VALUES
      ('evt-so-20260201-001', 'sales_order_ready_for_pick', 'SO-20260201-001', '{"orderId": "SO-20260201-001", "lines": [{"sku": "SKU-1001", "qty": 5}, {"sku": "SKU-2001", "qty": 10}]}'),
      ('evt-so-20260201-002', 'sales_order_ready_for_pick', 'SO-20260201-002', '{"orderId": "SO-20260201-002", "lines": [{"sku": "SKU-1002", "qty": 3}]}'),
      ('evt-po-20260202-001', 'purchase_order_received',    'PO-20260202-001', '{"poId": "PO-20260202-001", "lines": [{"sku": "SKU-2003", "qty": 20}]}'),
      ('evt-so-20260205-001', 'sales_order_ready_for_pick', 'SO-20260205-001', '{"orderId": "SO-20260205-001", "lines": [{"sku": "SKU-1001", "qty": 8}]}'),
      ('evt-po-20260207-001', 'purchase_order_received',    'PO-20260207-001', '{"poId": "PO-20260207-001", "lines": [{"sku": "SKU-2003", "qty": 15}]}'),
      ('evt-so-20260210-001', 'sales_order_ready_for_pick', 'SO-20260210-001', '{"orderId": "SO-20260210-001", "lines": [{"sku": "SKU-3001", "qty": 25}]}'),
      ('evt-po-20260211-001', 'purchase_order_received',    'PO-20260211-001', '{"poId": "PO-20260211-001", "lines": [{"sku": "SKU-2004", "qty": 30}]}')
    ON CONFLICT (event_key) DO NOTHING
  `);
  console.log("  ✓ task_generation_events");

  console.log("Test data seed complete.");
};

seed()
  .then(() => pool.end())
  .catch((error) => {
    console.error("Test data seed failed:", error);
    process.exit(1);
  });
