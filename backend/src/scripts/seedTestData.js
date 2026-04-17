const { pool, query } = require("../db");
const { hashPassword } = require("../services/authService");
const { createSalesOrder } = require("../services/salesOrderService");
const { generateTasksForOrderEvent } = require("../services/taskGenerationService");
const { normalizeTaskGenerationEvent } = require("../services/taskGenerationLogic");

/**
 * Test/demo seed data — only runs when SEED_TEST_DATA=true.
 * Idempotent: uses ON CONFLICT DO NOTHING so it's safe to run repeatedly.
 *
 * Domain: small e-commerce company selling robotic parts to build robots.
 *
 * Seeds:
 *  - 1 warehouse (Roboparts Fulfillment Center)
 *  - 6 zones: 2 pick, 1 bulk, 1 inbound dock, 1 outbound dock, 1 staging
 *  - 33 locations across those zones
 *  - 100 robotic-parts SKUs (~100 units each)
 *  - Rich movement history (30 days)
 *  - 12 operators + zone assignments
 *  - User accounts (managers, supervisors, operators, viewers)
 *  - Historical tasks with audit logs & labor metrics
 *  - Live sales orders and purchase orders via service layer (generates real tasks)
 */

const seed = async () => {
  if (process.env.SEED_TEST_DATA !== "true") {
    console.log("SEED_TEST_DATA is not 'true', skipping test data seed.");
    return;
  }

  console.log("Seeding test data (Roboparts Fulfillment Center)...");

  // ── Warehouse ──────────────────────────────────────────────────
  await query(`
    INSERT INTO warehouses (code, name) VALUES
      ('WH-ROBOPARTS-01', 'Roboparts Fulfillment Center')
    ON CONFLICT (code) DO NOTHING
  `);
  console.log("  warehouse");

  const { rows: warehouses } = await query(`SELECT id, code FROM warehouses`);
  const whId = warehouses.find((w) => w.code === "WH-ROBOPARTS-01").id;

  // ── Zones ──────────────────────────────────────────────────────
  await query(`
    INSERT INTO zones (warehouse_id, name, type) VALUES
      ($1, 'Small Parts Pick',  'pick'),
      ($1, 'Large Parts Pick',  'pick'),
      ($1, 'Bulk Reserve',      'bulk'),
      ($1, 'Inbound Dock',      'dock'),
      ($1, 'Outbound Dock',     'dock'),
      ($1, 'Packing & Staging', 'staging')
    ON CONFLICT (warehouse_id, name) DO NOTHING
  `, [whId]);
  console.log("  zones");

  const { rows: zones } = await query(`SELECT id, name FROM zones`);
  const zoneId = (name) => zones.find((z) => z.name === name).id;

  const zSmallPick  = zoneId("Small Parts Pick");
  const zLargePick  = zoneId("Large Parts Pick");
  const zBulk       = zoneId("Bulk Reserve");
  const zInDock     = zoneId("Inbound Dock");
  const zOutDock    = zoneId("Outbound Dock");
  const zStaging    = zoneId("Packing & Staging");

  // ── Locations ──────────────────────────────────────────────────
  // 15 shelf bins (small parts pick), 8 racks (large parts pick),
  // 3 bulk floor, 2 inbound dock, 2 outbound dock, 3 staging
  const locationRows = [
    // Small Parts Pick — shelf bins
    [whId, zSmallPick,  'SHELF-A01', 'Shelf A01 – Sensors I',          'active', 'shelf',   200],
    [whId, zSmallPick,  'SHELF-A02', 'Shelf A02 – Sensors II',         'active', 'shelf',   200],
    [whId, zSmallPick,  'SHELF-A03', 'Shelf A03 – Sensors III',        'active', 'shelf',   200],
    [whId, zSmallPick,  'SHELF-A04', 'Shelf A04 – Sensors IV / MCU I', 'active', 'shelf',   200],
    [whId, zSmallPick,  'SHELF-A05', 'Shelf A05 – MCU II',             'active', 'shelf',   200],
    [whId, zSmallPick,  'SHELF-A06', 'Shelf A06 – MCU III',            'active', 'shelf',   200],
    [whId, zSmallPick,  'SHELF-A07', 'Shelf A07 – MCU IV / Comms I',   'active', 'shelf',   200],
    [whId, zSmallPick,  'SHELF-A08', 'Shelf A08 – Comms II',           'active', 'shelf',   200],
    [whId, zSmallPick,  'SHELF-A09', 'Shelf A09 – Comms III / Cables I','active','shelf',   200],
    [whId, zSmallPick,  'SHELF-A10', 'Shelf A10 – Cables II',          'active', 'shelf',   200],
    [whId, zSmallPick,  'SHELF-A11', 'Shelf A11 – Cables III / Acc I', 'active', 'shelf',   200],
    [whId, zSmallPick,  'SHELF-A12', 'Shelf A12 – Accessories II',     'active', 'shelf',   200],
    [whId, zSmallPick,  'SHELF-A13', 'Shelf A13 – Accessories III',    'active', 'shelf',   200],
    [whId, zSmallPick,  'SHELF-A14', 'Shelf A14 – Tools I',            'active', 'shelf',   200],
    [whId, zSmallPick,  'SHELF-A15', 'Shelf A15 – Tools II',           'active', 'shelf',   200],
    // Large Parts Pick — racks
    [whId, zLargePick,  'RACK-B01',  'Rack B01 – Servo Motors I',      'active', 'rack',    150],
    [whId, zLargePick,  'RACK-B02',  'Rack B02 – Servo Motors II',     'active', 'rack',    150],
    [whId, zLargePick,  'RACK-B03',  'Rack B03 – Power Electronics I', 'active', 'rack',    150],
    [whId, zLargePick,  'RACK-B04',  'Rack B04 – Power Electronics II','active', 'rack',    150],
    [whId, zLargePick,  'RACK-B05',  'Rack B05 – Structural Parts I',  'active', 'rack',    120],
    [whId, zLargePick,  'RACK-B06',  'Rack B06 – Structural Parts II', 'active', 'rack',    120],
    [whId, zLargePick,  'RACK-B07',  'Rack B07 – Drive Systems I',     'active', 'rack',    120],
    [whId, zLargePick,  'RACK-B08',  'Rack B08 – Drive Systems II / Grippers', 'active', 'rack', 120],
    // Bulk Reserve — floor storage (capacity 1000 to accommodate bulk volumes)
    [whId, zBulk,       'BULK-01',   'Bulk Floor 01',                  'active', 'floor',  1000],
    [whId, zBulk,       'BULK-02',   'Bulk Floor 02',                  'active', 'floor',  1000],
    [whId, zBulk,       'BULK-03',   'Bulk Floor 03',                  'active', 'floor',  1000],
    // Inbound Dock
    [whId, zInDock,     'DOCK-IN-01','Inbound Dock Bay 1',             'active', 'dock',    400],
    [whId, zInDock,     'DOCK-IN-02','Inbound Dock Bay 2',             'active', 'dock',    400],
    // Outbound Dock
    [whId, zOutDock,    'DOCK-OUT-01','Outbound Dock Bay 1',           'active', 'dock',    400],
    [whId, zOutDock,    'DOCK-OUT-02','Outbound Dock Bay 2',           'active', 'dock',    400],
    // Packing & Staging
    [whId, zStaging,    'STAGE-01',  'Staging Area 1',                 'active', 'staging', 250],
    [whId, zStaging,    'STAGE-02',  'Staging Area 2',                 'active', 'staging', 250],
    [whId, zStaging,    'STAGE-03',  'Staging Area 3',                 'active', 'staging', 250],
  ];

  for (const [wh, zone, code, name, status, type, capacity] of locationRows) {
    await query(`
      INSERT INTO locations (warehouse_id, zone_id, code, name, status, type, capacity)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (warehouse_id, code) DO NOTHING
    `, [wh, zone, code, name, status, type, capacity]);
  }
  console.log("  locations");

  // ── SKUs (100 robotic parts) ────────────────────────────────────
  // Columns: sku, description, weight_kg, dim_x, dim_y, dim_z
  const skuData = [
    // SERVO — Servo motors & actuators (10)
    ['SERVO-001', 'Micro Servo Motor 9g 1.8kg.cm SG90',                 0.009,  2.3,  1.2,  2.9],
    ['SERVO-002', 'Digital Servo Motor 20kg.cm MG996R',                 0.055,  4.0,  2.0,  4.3],
    ['SERVO-003', 'High-Torque Servo 60kg.cm Metal Gear BLS-900',       0.132,  4.0,  2.1,  4.4],
    ['SERVO-004', 'Linear Actuator 12V 50mm Stroke 15N',                0.185, 15.0,  3.5,  3.5],
    ['SERVO-005', 'Linear Actuator 12V 150mm Stroke 20N',               0.270, 22.0,  3.5,  3.5],
    ['SERVO-006', 'Stepper Motor NEMA17 1.8deg 1.7A',                   0.280,  4.2,  4.2,  4.0],
    ['SERVO-007', 'Stepper Motor NEMA23 2.8A 3Nm',                      0.650,  5.7,  5.7,  5.6],
    ['SERVO-008', 'DC Geared Motor 12V 100RPM 25D',                     0.125,  6.7,  2.5,  2.5],
    ['SERVO-009', 'Brushless Outrunner Motor 2212 920KV',                0.052,  2.8,  2.8,  2.8],
    ['SERVO-010', 'Hollow-Shaft Servo 300deg/s 8.5kg.cm',               0.185,  4.0,  3.6,  3.6],
    // SENS — Sensors (15)
    ['SENS-001',  'Ultrasonic Sensor HC-SR04 4m Range',                 0.009,  4.5,  2.0,  1.5],
    ['SENS-002',  'IR Distance Sensor Sharp GP2Y0A21',                  0.003,  3.2,  1.5,  1.3],
    ['SENS-003',  'LiDAR TF-Luna 8m Single-Point ToF',                  0.005,  3.5,  1.5,  0.7],
    ['SENS-004',  'IMU Module MPU-6050 6-Axis Gyro+Accel',              0.003,  2.0,  1.6,  0.1],
    ['SENS-005',  'IMU Module ICM-42688-P High-Perf 6-Axis',            0.002,  2.0,  1.6,  0.1],
    ['SENS-006',  'Magnetic Encoder AS5048A SPI/PWM 14-bit',            0.003,  1.4,  1.4,  0.1],
    ['SENS-007',  '6-Axis Force Torque Sensor 200N/20Nm',               0.071,  2.5,  2.5,  1.4],
    ['SENS-008',  'Color Sensor TCS34725 RGB+Clear I2C',                0.002,  1.9,  1.7,  0.1],
    ['SENS-009',  'ToF Proximity Sensor VL53L1X 4m I2C',                0.001,  1.5,  1.0,  0.1],
    ['SENS-010',  'Temperature & Humidity Sensor DHT22',                0.004,  2.8,  1.5,  1.0],
    ['SENS-011',  'Camera Module OV2640 2MP 160deg Wide',               0.014,  3.2,  3.2,  0.5],
    ['SENS-012',  'Camera Module IMX219 8MP Raspberry Pi',              0.007,  2.5,  2.3,  0.2],
    ['SENS-013',  'Barometric Pressure Sensor BMP390',                  0.001,  1.0,  1.0,  0.1],
    ['SENS-014',  'Current & Power Sensor INA226 26V I2C',              0.002,  1.5,  1.5,  0.1],
    ['SENS-015',  'Hall Effect Sensor AH3144 NPN Pack10',               0.010,  5.0,  3.0,  0.5],
    // MCU — Microcontrollers & compute (10)
    ['MCU-001',   'Arduino Mega 2560 Rev3',                             0.037, 10.2,  5.3,  1.0],
    ['MCU-002',   'Raspberry Pi 4B 4GB RAM',                            0.046,  8.5,  5.6,  1.7],
    ['MCU-003',   'NVIDIA Jetson Nano 4GB Developer Kit',               0.250, 10.0,  8.0,  3.0],
    ['MCU-004',   'STM32F4 Discovery Board 168MHz',                     0.020,  6.9,  5.0,  0.8],
    ['MCU-005',   'ESP32-WROOM-32 DevKit 240MHz WiFi+BT',               0.010,  5.5,  2.8,  0.8],
    ['MCU-006',   'Arduino Nano 33 BLE Sense IMU+Mic',                  0.007,  4.5,  1.8,  0.3],
    ['MCU-007',   'Teensy 4.1 600MHz ARM Cortex-M7',                    0.014,  6.1,  1.8,  0.3],
    ['MCU-008',   'BeagleBone Blue Robotics Linux Board',               0.045,  8.6,  5.4,  1.2],
    ['MCU-009',   'OpenCR1.0 ROS Embedded Controller',                  0.077, 10.5,  6.6,  1.7],
    ['MCU-010',   'Lattice iCE40 FPGA Breakout Board',                  0.018,  6.0,  4.0,  0.8],
    // PWR — Power & electronics (10)
    ['PWR-001',   'LiPo Battery 3S 11.1V 5000mAh 50C',                 0.320, 14.5,  5.0,  3.0],
    ['PWR-002',   'LiPo Battery 4S 14.8V 10000mAh 30C',                0.680, 18.0,  6.5,  4.0],
    ['PWR-003',   'BMS 3S 20A Balance Protection PCB',                  0.025,  7.0,  4.0,  0.5],
    ['PWR-004',   'DC-DC Buck Converter LM2596 3A Adjustable',          0.012,  4.3,  2.1,  0.9],
    ['PWR-005',   'ESC 30A Brushless BLHeli32',                         0.028,  5.0,  3.0,  0.8],
    ['PWR-006',   'ESC 60A Brushless BLHeli32 Telemetry',               0.044,  5.5,  4.0,  1.0],
    ['PWR-007',   'PWM Servo Driver PCA9685 16-Channel I2C',            0.020,  6.5,  2.5,  0.3],
    ['PWR-008',   'Power Distribution Board 12V 8-Port',                0.045,  8.0,  5.0,  0.5],
    ['PWR-009',   'Supercapacitor 2.7V 10F Ultracapacitor',             0.018,  3.3,  1.4,  1.4],
    ['PWR-010',   'DC-DC Boost Converter 150W 10A Adjustable',          0.085,  6.0,  5.0,  2.8],
    // STR — Structural parts (8)
    ['STR-001',   'Aluminum V-Slot Extrusion 2020 500mm',               0.220, 50.0,  2.0,  2.0],
    ['STR-002',   'Aluminum V-Slot Extrusion 2040 500mm',               0.380, 50.0,  4.0,  2.0],
    ['STR-003',   'Robot Base Plate Aluminum 300x300x5mm',              0.810, 30.0, 30.0,  0.5],
    ['STR-004',   'V-Slot 90deg Corner Bracket Pack4',                  0.048,  4.5,  4.5,  0.5],
    ['STR-005',   'Nylon Standoff M3 10mm Pack50',                      0.020,  8.0,  5.0,  2.0],
    ['STR-006',   'Steel Shaft D8mm L300mm Hardened',                   0.120, 30.0,  0.8,  0.8],
    ['STR-007',   'Carbon Fiber Plate 3K 2mm 200x150mm',                0.068, 20.0, 15.0,  0.2],
    ['STR-008',   'Acrylic Sheet 5mm Clear 300x200mm',                  0.210, 30.0, 20.0,  0.5],
    // DRV — Drive systems (8)
    ['DRV-001',   'Omni Wheel 60mm 4-Roller Plastic',                   0.048,  6.0,  6.0,  2.0],
    ['DRV-002',   'Rubber Drive Wheel 65mm 26mm Wide',                  0.062,  6.5,  6.5,  2.6],
    ['DRV-003',   'Mecanum Wheel 80mm Aluminium Set 4pcs',              0.520,  8.0,  8.0,  2.8],
    ['DRV-004',   'GT2 Timing Belt 6mm 200mm Closed Loop',              0.015, 20.0,  0.6,  0.3],
    ['DRV-005',   'GT2 Timing Pulley 20T 5mm Bore Aluminium',           0.012,  2.0,  2.0,  1.6],
    ['DRV-006',   'Planetary Gearbox 30:1 NEMA17 3-Stage',              0.250,  4.2,  4.2,  3.5],
    ['DRV-007',   'Ball Bearing 608ZZ 8x22x7mm Pack10',                 0.055,  6.0,  6.0,  3.0],
    ['DRV-008',   'Rubber Track Set 250mm Wide 4-Link',                 0.480, 25.0, 10.0,  4.0],
    // GRP — Grippers & end-effectors (5)
    ['GRP-001',   'Parallel Gripper 2-Finger 50mm Stroke',              0.195,  8.5,  4.5,  3.8],
    ['GRP-002',   'Silicone Suction Cup 40mm Flat',                     0.012,  4.0,  4.0,  2.5],
    ['GRP-003',   'Mini Vacuum Pump 12V 7L/min',                        0.095,  8.0,  4.0,  3.5],
    ['GRP-004',   'Gripper Rubber Tip Replacement Pack4',               0.008,  3.0,  3.0,  1.0],
    ['GRP-005',   'Electromagnetic Gripper 12V 5kg Holding Force',      0.155,  5.0,  5.0,  2.5],
    // COM — Communication modules (8)
    ['COM-001',   'WiFi Module ESP8266 NodeMCU v3 Lua',                 0.014,  5.8,  3.1,  1.0],
    ['COM-002',   'Bluetooth Module HC-05 Master/Slave UART',           0.004,  3.7,  1.6,  0.4],
    ['COM-003',   'CAN Bus Module MCP2515 SPI 1Mbps',                   0.010,  4.0,  2.0,  0.7],
    ['COM-004',   'RS485 Module MAX485 5V Half-Duplex UART',            0.004,  4.4,  1.4,  1.4],
    ['COM-005',   'ZigBee Module XBee S2C 63mW PCB Ant',                0.006,  2.7,  2.4,  0.6],
    ['COM-006',   'LoRa Module Ra-02 433MHz SX1278 SPI',                0.007,  1.7,  1.6,  0.3],
    ['COM-007',   'USB-to-Serial Converter FTDI FT232RL',               0.005,  3.5,  2.0,  0.5],
    ['COM-008',   'Ethernet Controller W5500 SPI 10/100Mbps',           0.010,  5.5,  4.0,  1.0],
    // CAB — Cables & connectors (8)
    ['CAB-001',   'Servo Extension Cable 30cm JST-SH Pack10',           0.025, 30.0,  1.0,  0.2],
    ['CAB-002',   'JST-XH 2.54mm Connector Assortment 120pcs',          0.060,  9.0,  6.5,  3.0],
    ['CAB-003',   'XT60 Connector Pair Male+Female Amass Gold',         0.015,  4.5,  2.5,  1.5],
    ['CAB-004',   'Bullet Connector 3.5mm Banana 20 Pairs',             0.030, 10.0,  5.0,  2.0],
    ['CAB-005',   'Braided USB-C Cable 1m 3A Fast Charge Pack2',        0.060, 10.0,  7.0,  2.0],
    ['CAB-006',   'Silicone Wire 20AWG Red Flexible 2m',                0.045, 20.0,  1.5,  1.5],
    ['CAB-007',   'Silicone Wire 20AWG Black Flexible 2m',              0.045, 20.0,  1.5,  1.5],
    ['CAB-008',   'Dupont Jumper Cable 40pin Female-Female 20cm',       0.025, 20.0,  5.0,  1.5],
    // ACC — Accessories & consumables (10)
    ['ACC-001',   'M3 Stainless Hex Bolt & Nut Assortment 300pcs',      0.185, 11.0,  6.5,  4.0],
    ['ACC-002',   'M4 Socket Cap Screw & Nut Set 200pcs',               0.225, 12.0,  7.0,  4.5],
    ['ACC-003',   'M5 Socket Head Bolt Assortment 150pcs',              0.280, 13.0,  7.5,  5.0],
    ['ACC-004',   'Heat Shrink Tube Kit 270pcs Mixed Sizes',            0.095,  9.0,  6.0,  5.0],
    ['ACC-005',   'Nylon Cable Tie Assortment 200pcs 3 Sizes',          0.065, 12.0,  8.0,  5.0],
    ['ACC-006',   'M2.5 PCB Brass Standoff Spacer Kit 100pcs',          0.055,  8.0,  6.0,  3.5],
    ['ACC-007',   'Thermal Paste CPU/GPU Syringe 4g',                   0.015,  7.5,  2.0,  1.5],
    ['ACC-008',   'Solder Wire 60/40 Sn/Pb 0.8mm 100g',                0.100,  6.0,  6.0,  6.0],
    ['ACC-009',   'Thread Locker Blue Medium Strength 5ml',             0.012,  9.5,  2.0,  2.0],
    ['ACC-010',   'PETG Filament 1.75mm 1kg Spool Black',               1.200, 20.0, 20.0,  7.0],
    // TOOL — Tools (8)
    ['TOOL-001',  'Digital Calipers 150mm 0.01mm Stainless',            0.100, 20.5,  6.5,  2.5],
    ['TOOL-002',  'Hex Key Allen Wrench Set Metric 1.5-10mm 9pcs',      0.090, 14.0,  5.0,  2.0],
    ['TOOL-003',  'Digital Multimeter AC/DC Auto-Range',                0.215, 18.5,  8.7,  3.5],
    ['TOOL-004',  'Soldering Iron Station 60W Temperature Ctrl',        0.310, 20.0, 10.0,  6.0],
    ['TOOL-005',  'Anti-Static Wrist Strap with Ground Cord',           0.020, 15.0,  8.0,  1.0],
    ['TOOL-006',  'Conformal Coating Spray 400ml Acrylic',              0.430,  6.8,  6.8, 20.0],
    ['TOOL-007',  'PEI Spring Steel Magnetic Sheet 235x235mm',          0.180, 23.5, 23.5,  0.5],
    ['TOOL-008',  'Ratchet Wire Stripper & Crimper 0.08-6mm',           0.280, 21.5,  9.5,  3.5],
  ];

  for (const [sku, desc, wt, dx, dy, dz] of skuData) {
    await query(`
      INSERT INTO skus (sku, description, weight_kg, dimension_x_cm, dimension_y_cm, dimension_z_cm)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (sku) DO NOTHING
    `, [sku, desc, wt, dx, dy, dz]);
  }
  console.log(`  skus (${skuData.length})`);

  // ── Inventory ──────────────────────────────────────────────────
  // Each SKU is stocked at ~100 units in a primary pick location.
  // Some high-velocity SKUs also have bulk overflow.
  const inventoryData = [
    // SHELF-A01 — Sensors I
    ['SENS-001', 'SHELF-A01', 112], ['SENS-002', 'SHELF-A01', 98],
    ['SENS-003', 'SHELF-A01', 87],  ['SENS-004', 'SHELF-A01', 124],
    // SHELF-A02 — Sensors II
    ['SENS-005', 'SHELF-A02', 105], ['SENS-006', 'SHELF-A02', 93],
    ['SENS-007', 'SHELF-A02', 42],  ['SENS-008', 'SHELF-A02', 116],
    // SHELF-A03 — Sensors III
    ['SENS-009', 'SHELF-A03', 130], ['SENS-010', 'SHELF-A03', 88],
    ['SENS-011', 'SHELF-A03', 74],  ['SENS-012', 'SHELF-A03', 91],
    // SHELF-A04 — Sensors IV / MCU I
    ['SENS-013', 'SHELF-A04', 108], ['SENS-014', 'SHELF-A04', 97],
    ['SENS-015', 'SHELF-A04', 115], ['MCU-001',  'SHELF-A04', 63],
    // SHELF-A05 — MCU II
    ['MCU-002', 'SHELF-A05', 48],  ['MCU-003', 'SHELF-A05', 22],
    ['MCU-004', 'SHELF-A05', 85],  ['MCU-005', 'SHELF-A05', 119],
    // SHELF-A06 — MCU III
    ['MCU-006', 'SHELF-A06', 77],  ['MCU-007', 'SHELF-A06', 60],
    ['MCU-008', 'SHELF-A06', 35],  ['MCU-009', 'SHELF-A06', 27],
    // SHELF-A07 — MCU IV / Comms I
    ['MCU-010', 'SHELF-A07', 45],  ['COM-001', 'SHELF-A07', 102],
    ['COM-002', 'SHELF-A07', 88],  ['COM-003', 'SHELF-A07', 94],
    // SHELF-A08 — Comms II
    ['COM-004', 'SHELF-A08', 76],  ['COM-005', 'SHELF-A08', 59],
    ['COM-006', 'SHELF-A08', 83],  ['COM-007', 'SHELF-A08', 111],
    // SHELF-A09 — Comms III / Cables I
    ['COM-008', 'SHELF-A09', 68],  ['CAB-001', 'SHELF-A09', 140],
    ['CAB-002', 'SHELF-A09', 95],  ['CAB-003', 'SHELF-A09', 107],
    // SHELF-A10 — Cables II
    ['CAB-004', 'SHELF-A10', 88],  ['CAB-005', 'SHELF-A10', 72],
    ['CAB-006', 'SHELF-A10', 130], ['CAB-007', 'SHELF-A10', 128],
    // SHELF-A11 — Cables III / Acc I
    ['CAB-008', 'SHELF-A11', 96],  ['ACC-001', 'SHELF-A11', 118],
    ['ACC-002', 'SHELF-A11', 104], ['ACC-003', 'SHELF-A11', 99],
    // SHELF-A12 — Accessories II
    ['ACC-004', 'SHELF-A12', 86],  ['ACC-005', 'SHELF-A12', 121],
    ['ACC-006', 'SHELF-A12', 93],  ['ACC-007', 'SHELF-A12', 57],
    // SHELF-A13 — Accessories III
    ['ACC-008', 'SHELF-A13', 100], ['ACC-009', 'SHELF-A13', 78],
    ['ACC-010', 'SHELF-A13', 31],  ['TOOL-001', 'SHELF-A13', 44],
    // SHELF-A14 — Tools I
    ['TOOL-002', 'SHELF-A14', 55], ['TOOL-003', 'SHELF-A14', 38],
    ['TOOL-004', 'SHELF-A14', 29], ['TOOL-005', 'SHELF-A14', 82],
    // SHELF-A15 — Tools II
    ['TOOL-006', 'SHELF-A15', 47], ['TOOL-007', 'SHELF-A15', 61],
    ['TOOL-008', 'SHELF-A15', 73],
    // RACK-B01 — Servo Motors I
    ['SERVO-001', 'RACK-B01', 95], ['SERVO-002', 'RACK-B01', 72],
    ['SERVO-003', 'RACK-B01', 48], ['SERVO-004', 'RACK-B01', 63],
    ['SERVO-005', 'RACK-B01', 41],
    // RACK-B02 — Servo Motors II
    ['SERVO-006', 'RACK-B02', 88], ['SERVO-007', 'RACK-B02', 35],
    ['SERVO-008', 'RACK-B02', 107],['SERVO-009', 'RACK-B02', 80],
    ['SERVO-010', 'RACK-B02', 52],
    // RACK-B03 — Power Electronics I
    ['PWR-001', 'RACK-B03', 60],  ['PWR-002', 'RACK-B03', 38],
    ['PWR-003', 'RACK-B03', 82],  ['PWR-004', 'RACK-B03', 115],
    ['PWR-005', 'RACK-B03', 74],
    // RACK-B04 — Power Electronics II
    ['PWR-006', 'RACK-B04', 56],  ['PWR-007', 'RACK-B04', 98],
    ['PWR-008', 'RACK-B04', 44],  ['PWR-009', 'RACK-B04', 130],
    ['PWR-010', 'RACK-B04', 67],
    // RACK-B05 — Structural Parts I
    ['STR-001', 'RACK-B05', 85],  ['STR-002', 'RACK-B05', 72],
    ['STR-003', 'RACK-B05', 34],  ['STR-004', 'RACK-B05', 110],
    ['STR-005', 'RACK-B05', 92],
    // RACK-B06 — Structural Parts II
    ['STR-006', 'RACK-B06', 68],  ['STR-007', 'RACK-B06', 45],
    ['STR-008', 'RACK-B06', 79],  ['DRV-001', 'RACK-B06', 100],
    ['DRV-002', 'RACK-B06', 87],
    // RACK-B07 — Drive Systems I
    ['DRV-003', 'RACK-B07', 50],  ['DRV-004', 'RACK-B07', 120],
    ['DRV-005', 'RACK-B07', 108], ['DRV-006', 'RACK-B07', 42],
    ['DRV-007', 'RACK-B07', 95],  ['DRV-008', 'RACK-B07', 28],
    // RACK-B08 — Drive Systems II / Grippers
    ['GRP-001', 'RACK-B08', 55],  ['GRP-002', 'RACK-B08', 88],
    ['GRP-003', 'RACK-B08', 62],  ['GRP-004', 'RACK-B08', 114],
    ['GRP-005', 'RACK-B08', 47],
    // BULK-01 — High-velocity overflow
    ['SENS-001', 'BULK-01', 200], ['SENS-004', 'BULK-01', 180],
    ['SERVO-001','BULK-01', 150], ['MCU-005',  'BULK-01', 120],
    // BULK-02 — Battery & cable overflow
    ['PWR-001',  'BULK-02',  80], ['PWR-002',  'BULK-02',  60],
    ['CAB-001',  'BULK-02', 250], ['ACC-001',  'BULK-02', 300],
    // BULK-03 — Hardware overflow
    ['ACC-002',  'BULK-03', 200], ['ACC-003',  'BULK-03', 180],
    ['DRV-007',  'BULK-03', 100], ['ACC-008',  'BULK-03', 120],
  ];

  await query(`
    INSERT INTO inventory (sku_id, location_id, quantity)
    SELECT s.id, l.id, v.qty
    FROM (VALUES ${inventoryData.map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3}::int)`).join(",")}) AS v(sku_code, loc_code, qty)
    JOIN skus      s ON s.sku  = v.sku_code
    JOIN locations l ON l.code = v.loc_code
    ON CONFLICT (sku_id, location_id) DO NOTHING
  `, inventoryData.flatMap(([sku, loc, qty]) => [sku, loc, qty]));
  console.log(`  inventory (${inventoryData.length} records)`);

  // ── Movements (30-day history) ─────────────────────────────────
  const movementData = [
    // Week 4 ago — initial stocking
    ['SERVO-001', null,           'RACK-B01',  100, 'INBOUND',    'PO-2026-0310-001', 28],
    ['SERVO-006', null,           'RACK-B02',   90, 'INBOUND',    'PO-2026-0310-002', 27],
    ['SENS-001',  null,           'SHELF-A01', 150, 'INBOUND',    'PO-2026-0311-001', 26],
    ['PWR-001',   null,           'RACK-B03',   70, 'INBOUND',    'PO-2026-0311-002', 25],
    ['MCU-002',   null,           'SHELF-A05',  50, 'INBOUND',    'PO-2026-0312-001', 25],
    ['DRV-007',   null,           'RACK-B07',  100, 'INBOUND',    'PO-2026-0312-002', 24],
    // Week 3 ago — customer outbound
    ['SERVO-001', 'RACK-B01',  'DOCK-OUT-01',  12, 'OUTBOUND',   'SO-2026-0315-001', 22],
    ['SENS-004',  'SHELF-A01', 'DOCK-OUT-01',   8, 'OUTBOUND',   'SO-2026-0315-002', 22],
    ['MCU-005',   'SHELF-A05', 'DOCK-OUT-01',   5, 'OUTBOUND',   'SO-2026-0316-001', 21],
    ['PWR-003',   null,           'RACK-B03',   90, 'INBOUND',    'PO-2026-0317-001', 20],
    ['STR-001',   null,           'RACK-B05',  100, 'INBOUND',    'PO-2026-0317-002', 20],
    ['ACC-001',   null,           'SHELF-A11', 150, 'INBOUND',    'PO-2026-0318-001', 19],
    // Week 2 ago — mixed activity
    ['SERVO-002', 'RACK-B01',  'DOCK-OUT-01',  10, 'OUTBOUND',   'SO-2026-0322-001', 17],
    ['SENS-001',  'SHELF-A01', 'BULK-01',       80, 'TRANSFER',   'TRF-2026-001',     16],
    ['PWR-001',   null,           'RACK-B03',   60, 'INBOUND',    'PO-2026-0323-001', 15],
    ['CAB-001',   null,           'SHELF-A09', 200, 'INBOUND',    'PO-2026-0323-002', 15],
    ['MCU-003',   null,           'SHELF-A05',  25, 'INBOUND',    'PO-2026-0324-001', 14],
    ['DRV-003',   'RACK-B07',  'DOCK-OUT-01',   4, 'OUTBOUND',   'SO-2026-0324-002', 14],
    ['GRP-001',   null,           'RACK-B08',   60, 'INBOUND',    'PO-2026-0325-001', 13],
    ['SENS-007',  null,           'SHELF-A02',  45, 'INBOUND',    'PO-2026-0325-002', 13],
    // Recent week
    ['SERVO-001', null,           'BULK-01',    80, 'INBOUND',    'PO-2026-0329-001', 10],
    ['SERVO-009', 'RACK-B02',  'DOCK-OUT-01',   6, 'OUTBOUND',   'SO-2026-0329-002', 10],
    ['PWR-007',   null,           'RACK-B04',  100, 'INBOUND',    'PO-2026-0330-001',  9],
    ['ACC-002',   null,           'BULK-03',   250, 'INBOUND',    'PO-2026-0330-002',  9],
    ['MCU-005',   null,           'BULK-01',   120, 'INBOUND',    'PO-2026-0331-001',  8],
    ['SENS-009',  'SHELF-A03', 'DOCK-OUT-02',  15, 'OUTBOUND',   'SO-2026-0331-001',  8],
    ['PWR-001',   null,           'BULK-02',    80, 'INBOUND',    'PO-2026-0401-001',  7],
    ['DRV-004',   null,           'RACK-B07',  130, 'INBOUND',    'PO-2026-0401-002',  7],
    ['SERVO-006', 'RACK-B02',  'DOCK-OUT-01',   8, 'OUTBOUND',   'SO-2026-0402-001',  6],
    ['MCU-001',   'SHELF-A04', 'DOCK-OUT-01',   4, 'OUTBOUND',   'SO-2026-0402-002',  6],
    // This week
    ['ACC-008',   null,           'BULK-03',   120, 'INBOUND',    'PO-2026-0407-001',  5],
    ['CAB-001',   null,           'BULK-02',   250, 'INBOUND',    'PO-2026-0407-002',  5],
    ['SERVO-002', null,           'RACK-B01',   80, 'INBOUND',    'PO-2026-0408-001',  4],
    ['SENS-004',  null,           'BULK-01',   180, 'INBOUND',    'PO-2026-0408-002',  4],
    ['GRP-002',   null,           'RACK-B08',   90, 'INBOUND',    'PO-2026-0409-001',  3],
    ['PWR-005',   'RACK-B03',  'DOCK-OUT-02',   5, 'OUTBOUND',   'SO-2026-0409-001',  3],
    ['MCU-004',   null,           'SHELF-A05',  90, 'INBOUND',    'PO-2026-0410-001',  2],
    ['SENS-001',  'SHELF-A01', 'DOCK-OUT-01',  20, 'OUTBOUND',   'SO-2026-0410-001',  2],
    ['ACC-003',   null,           'BULK-03',   180, 'INBOUND',    'PO-2026-0411-001',  1],
    ['STR-004',   null,           'RACK-B05',  110, 'INBOUND',    'PO-2026-0411-002',  1],
    ['SENS-006',  'SHELF-A02', null,            -3, 'ADJUSTMENT', 'ADJ-2026-001',       0],
    ['DRV-007',   null,           'BULK-03',   100, 'INBOUND',    'PO-2026-0412-001',  0],
  ];

  for (const [sku, fromLoc, toLoc, qty, mtype, ref, daysAgo] of movementData) {
    const absQty = Math.abs(qty);
    await query(`
      INSERT INTO movements (sku_id, from_location_id, to_location_id, quantity, movement_type, reference, created_at)
      SELECT s.id, fl.id, tl.id, $4, $5, $6,
             NOW() - ($7 || ' days')::interval + (random() * interval '6 hours')
      FROM skus s
      LEFT JOIN locations fl ON fl.code = $2
      LEFT JOIN locations tl ON tl.code = $3
      WHERE s.sku = $1
      ON CONFLICT DO NOTHING
    `, [sku, fromLoc, toLoc, absQty, mtype, ref, daysAgo]);
  }
  console.log(`  movements (${movementData.length} records)`);

  // ── Operators ──────────────────────────────────────────────────
  await query(`
    INSERT INTO operators (id, name, role, status) VALUES
      ('b0000000-0000-4000-b000-000000000001', 'Alex Torres',     'picker',   'available'),
      ('b0000000-0000-4000-b000-000000000002', 'Jordan Kim',      'picker',   'available'),
      ('b0000000-0000-4000-b000-000000000003', 'Sam Chen',        'picker',   'available'),
      ('b0000000-0000-4000-b000-000000000004', 'Riley Patel',     'picker',   'available'),
      ('b0000000-0000-4000-b000-000000000005', 'Morgan Davis',    'picker',   'available'),
      ('b0000000-0000-4000-b000-000000000006', 'Casey Wilson',    'picker',   'available'),
      ('b0000000-0000-4000-b000-000000000007', 'Quinn Martinez',  'picker',   'available'),
      ('b0000000-0000-4000-b000-000000000008', 'Blake Johnson',   'picker',   'available'),
      ('b0000000-0000-4000-b000-000000000009', 'Drew Anderson',   'forklift', 'available'),
      ('b0000000-0000-4000-b000-000000000010', 'Cameron Lee',     'forklift', 'available'),
      ('b0000000-0000-4000-b000-000000000011', 'Taylor Brown',    'forklift', 'available'),
      ('b0000000-0000-4000-b000-000000000012', 'Avery Garcia',    'forklift', 'available')
    ON CONFLICT (id) DO NOTHING
  `);
  console.log("  operators");

  // ── Users ──────────────────────────────────────────────────────
  const testUsers = [
    { username: "manager1",    password: "manager123", displayName: "Marcus Webb",     role: "warehouse_manager", operatorId: null },
    { username: "manager2",    password: "manager123", displayName: "Priya Sharma",    role: "warehouse_manager", operatorId: null },
    { username: "supervisor1", password: "super123",   displayName: "Nathan Clarke",   role: "supervisor",        operatorId: null },
    { username: "supervisor2", password: "super123",   displayName: "Olivia Turner",   role: "supervisor",        operatorId: null },
    { username: "operator1",   password: "oper123",    displayName: "Alex Torres",     role: "operator",          operatorId: "b0000000-0000-4000-b000-000000000001" },
    { username: "operator2",   password: "oper123",    displayName: "Jordan Kim",      role: "operator",          operatorId: "b0000000-0000-4000-b000-000000000002" },
    { username: "operator3",   password: "oper123",    displayName: "Sam Chen",        role: "operator",          operatorId: "b0000000-0000-4000-b000-000000000003" },
    { username: "operator4",   password: "oper123",    displayName: "Riley Patel",     role: "operator",          operatorId: "b0000000-0000-4000-b000-000000000004" },
    { username: "operator5",   password: "oper123",    displayName: "Morgan Davis",    role: "operator",          operatorId: "b0000000-0000-4000-b000-000000000005" },
    { username: "operator6",   password: "oper123",    displayName: "Casey Wilson",    role: "operator",          operatorId: "b0000000-0000-4000-b000-000000000006" },
    { username: "viewer1",     password: "viewer123",  displayName: "Ethan Brooks",    role: "viewer",            operatorId: null },
    { username: "viewer2",     password: "viewer123",  displayName: "Sophia Nguyen",   role: "viewer",            operatorId: null },
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
  console.log("  users");

  // ── Historical tasks ───────────────────────────────────────────
  const taskRows = [
    // -- Completed pick tasks (spread over 14 days, Small Parts Pick zone)
    { type: "pick",    priority: 90, status: "completed", zone: "Small Parts Pick",  op: "b0000000-0000-4000-b000-000000000001", doc: "SO-2026-0403-001", est: 108, actual: 92,  daysAgo: 14 },
    { type: "pick",    priority: 80, status: "completed", zone: "Small Parts Pick",  op: "b0000000-0000-4000-b000-000000000002", doc: "SO-2026-0403-002", est: 96,  actual: 88,  daysAgo: 14 },
    { type: "putaway", priority: 60, status: "completed", zone: "Bulk Reserve",      op: "b0000000-0000-4000-b000-000000000009", doc: "PO-2026-0403-001", est: 165, actual: 148, daysAgo: 13 },
    { type: "pick",    priority: 85, status: "completed", zone: "Large Parts Pick",  op: "b0000000-0000-4000-b000-000000000006", doc: "SO-2026-0404-001", est: 120, actual: 105, daysAgo: 12 },
    { type: "putaway", priority: 60, status: "completed", zone: "Bulk Reserve",      op: "b0000000-0000-4000-b000-000000000010", doc: "PO-2026-0404-001", est: 180, actual: 162, daysAgo: 11 },
    { type: "pick",    priority: 80, status: "completed", zone: "Small Parts Pick",  op: "b0000000-0000-4000-b000-000000000003", doc: "SO-2026-0405-001", est: 102, actual: 94,  daysAgo: 10 },
    { type: "pick",    priority: 75, status: "completed", zone: "Large Parts Pick",  op: "b0000000-0000-4000-b000-000000000007", doc: "SO-2026-0405-002", est: 130, actual: 118, daysAgo: 9  },
    { type: "putaway", priority: 60, status: "completed", zone: "Inbound Dock",      op: "b0000000-0000-4000-b000-000000000011", doc: "PO-2026-0406-001", est: 145, actual: 140, daysAgo: 8  },
    { type: "pick",    priority: 90, status: "completed", zone: "Small Parts Pick",  op: "b0000000-0000-4000-b000-000000000001", doc: "SO-2026-0407-001", est: 95,  actual: 82,  daysAgo: 7  },
    { type: "pick",    priority: 85, status: "completed", zone: "Large Parts Pick",  op: "b0000000-0000-4000-b000-000000000003", doc: "SO-2026-0407-002", est: 115, actual: 104, daysAgo: 7  },
    { type: "putaway", priority: 65, status: "completed", zone: "Bulk Reserve",      op: "b0000000-0000-4000-b000-000000000009", doc: "PO-2026-0408-001", est: 155, actual: 143, daysAgo: 6  },
    { type: "pick",    priority: 80, status: "completed", zone: "Small Parts Pick",  op: "b0000000-0000-4000-b000-000000000004", doc: "SO-2026-0409-001", est: 100, actual: 91,  daysAgo: 5  },
    { type: "pick",    priority: 75, status: "completed", zone: "Small Parts Pick",  op: "b0000000-0000-4000-b000-000000000008", doc: "SO-2026-0409-002", est: 112, actual: 107, daysAgo: 5  },
    { type: "putaway", priority: 60, status: "completed", zone: "Inbound Dock",      op: "b0000000-0000-4000-b000-000000000012", doc: "PO-2026-0410-001", est: 140, actual: 135, daysAgo: 4  },
    { type: "pick",    priority: 85, status: "completed", zone: "Large Parts Pick",  op: "b0000000-0000-4000-b000-000000000006", doc: "SO-2026-0411-001", est: 118, actual: 108, daysAgo: 3  },
    { type: "pick",    priority: 90, status: "completed", zone: "Small Parts Pick",  op: "b0000000-0000-4000-b000-000000000002", doc: "SO-2026-0412-001", est: 97,  actual: 85,  daysAgo: 2  },
    { type: "putaway", priority: 65, status: "completed", zone: "Bulk Reserve",      op: "b0000000-0000-4000-b000-000000000010", doc: "PO-2026-0413-001", est: 168, actual: 155, daysAgo: 1  },
    { type: "pick",    priority: 80, status: "completed", zone: "Small Parts Pick",  op: "b0000000-0000-4000-b000-000000000001", doc: "SO-2026-0413-001", est: 103, actual: 96,  daysAgo: 1  },
    { type: "pick",    priority: 70, status: "completed", zone: "Large Parts Pick",  op: "b0000000-0000-4000-b000-000000000007", doc: "SO-2026-0413-002", est: 125, actual: 117, daysAgo: 1  },
    // -- Cancelled
    { type: "pick",    priority: 75, status: "cancelled", zone: "Small Parts Pick",  op: "b0000000-0000-4000-b000-000000000005", doc: "SO-2026-0409-003", est: 110, actual: null, daysAgo: 5 },
    { type: "putaway", priority: 60, status: "cancelled", zone: "Bulk Reserve",      op: "b0000000-0000-4000-b000-000000000011", doc: "PO-2026-0411-002", est: 150, actual: null, daysAgo: 3 },
    // -- Active tasks (max 1 per operator, operators 1-4)
    { type: "pick",    priority: 90, status: "assigned",  zone: "Small Parts Pick",  op: "b0000000-0000-4000-b000-000000000001", doc: "SO-2026-0416-001", est: 100, actual: null, daysAgo: 0 },
    { type: "pick",    priority: 85, status: "assigned",  zone: "Large Parts Pick",  op: "b0000000-0000-4000-b000-000000000003", doc: "SO-2026-0416-002", est: 118, actual: null, daysAgo: 0 },
    { type: "putaway", priority: 60, status: "assigned",  zone: "Inbound Dock",      op: "b0000000-0000-4000-b000-000000000009", doc: "PO-2026-0416-001", est: 175, actual: null, daysAgo: 0 },
    { type: "pick",    priority: 80, status: "assigned",  zone: "Small Parts Pick",  op: "b0000000-0000-4000-b000-000000000006", doc: "SO-2026-0416-003", est: 95,  actual: null, daysAgo: 0 },
    // -- Unassigned (pending assignment worker)
    { type: "pick",    priority: 88, status: "created",   zone: "Small Parts Pick",  op: null, doc: "SO-2026-0416-004", est: 108, actual: null, daysAgo: 0 },
    { type: "pick",    priority: 78, status: "created",   zone: "Large Parts Pick",  op: null, doc: "SO-2026-0416-005", est: 130, actual: null, daysAgo: 0 },
    { type: "putaway", priority: 60, status: "created",   zone: "Bulk Reserve",      op: null, doc: "PO-2026-0416-002", est: 160, actual: null, daysAgo: 0 },
    { type: "pick",    priority: 92, status: "created",   zone: "Small Parts Pick",  op: null, doc: "SO-2026-0416-006", est: 90,  actual: null, daysAgo: 0 },
    { type: "replenish",priority:45, status: "created",   zone: "Large Parts Pick",  op: null, doc: "RPL-2026-0416-001",est: 220, actual: null, daysAgo: 0 },
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
    `, [t.type, t.priority, t.status, zoneId(t.zone), t.op, t.doc, t.est, t.actual, t.daysAgo]);

    if (rows.length > 0) taskIds.push({ id: rows[0].id, ...t });
  }
  console.log(`  tasks (${taskIds.length} created)`);

  // ── Task Lines ─────────────────────────────────────────────────
  const zoneLineConfig = {
    "Small Parts Pick": {
      from: ["SHELF-A01", "SHELF-A02", "SHELF-A03", "SHELF-A04", "SHELF-A07", "SHELF-A09", "SHELF-A11"],
      to:   ["DOCK-OUT-01", "DOCK-OUT-02", "STAGE-01"]
    },
    "Large Parts Pick": {
      from: ["RACK-B01", "RACK-B02", "RACK-B03", "RACK-B05", "RACK-B07", "RACK-B08"],
      to:   ["DOCK-OUT-01", "DOCK-OUT-02", "STAGE-02"]
    },
    "Bulk Reserve": {
      from: ["DOCK-IN-01", "DOCK-IN-02"],
      to:   ["BULK-01", "BULK-02", "BULK-03"]
    },
    "Inbound Dock": {
      from: ["DOCK-IN-01", "DOCK-IN-02"],
      to:   ["RACK-B01", "RACK-B03", "RACK-B05", "RACK-B07"]
    },
  };
  const skuPool = [
    "SERVO-001", "SERVO-002", "SERVO-006", "SERVO-008",
    "SENS-001", "SENS-004", "SENS-009",
    "MCU-001", "MCU-002", "MCU-005",
    "PWR-001", "PWR-003", "PWR-007",
    "STR-001", "STR-004",
    "DRV-001", "DRV-007",
    "CAB-001", "CAB-002",
    "ACC-001", "ACC-008",
    "GRP-001", "GRP-002",
  ];

  for (const t of taskIds) {
    const lineStatus = t.status === "completed" ? "completed"
      : t.status === "cancelled" ? "cancelled"
      : "created";

    const config = zoneLineConfig[t.zone];
    if (!config) continue;

    const numLines = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < numLines; i++) {
      const sku  = skuPool[Math.floor(Math.random() * skuPool.length)];
      const qty  = 1 + Math.floor(Math.random() * 18);
      const from = config.from[Math.floor(Math.random() * config.from.length)];
      const to   = config.to[Math.floor(Math.random() * config.to.length)];

      await query(`
        INSERT INTO task_lines (task_id, sku_id, from_location_id, to_location_id, quantity, status)
        SELECT $1::uuid, s.id, fl.id, tl.id, $4, $5::task_line_status
        FROM skus s
        JOIN locations fl ON fl.code = $2
        JOIN locations tl ON tl.code = $3
        WHERE s.sku = $6
      `, [t.id, from, to, qty, lineStatus, sku]);
    }
  }
  console.log("  task_lines");

  // ── Task Status Audit Logs ─────────────────────────────────────
  for (const t of taskIds) {
    const transitions = [];
    if (["assigned","in_progress","completed","cancelled","paused","failed"].includes(t.status)) {
      transitions.push({ from: "created",    to: "assigned",    version: 1 });
    }
    if (["in_progress","completed","paused","failed"].includes(t.status)) {
      transitions.push({ from: "assigned",   to: "in_progress", version: 2 });
    }
    if (t.status === "completed") {
      transitions.push({ from: "in_progress",to: "completed",   version: 3 });
    }
    if (t.status === "cancelled") {
      transitions.push({ from: "assigned",   to: "cancelled",   version: 2 });
    }
    if (t.status === "paused") {
      transitions.push({ from: "in_progress",to: "paused",      version: 3 });
    }

    for (const tr of transitions) {
      await query(`
        INSERT INTO task_status_audit_logs (task_id, from_status, to_status, task_version, changed_by_operator_id)
        VALUES ($1, $2::task_status, $3::task_status, $4, $5)
      `, [t.id, tr.from, tr.to, tr.version, t.op]);
    }
  }
  console.log("  task_status_audit_logs");

  // ── Labor Daily Metrics (14 days for all operators) ────────────
  const metricProfiles = [
    { id: "b0000000-0000-4000-b000-000000000001", avgTasks: 13, avgUnits: 88,  avgTime: 96,  avgUtil: 91 },
    { id: "b0000000-0000-4000-b000-000000000002", avgTasks: 11, avgUnits: 74,  avgTime: 104, avgUtil: 84 },
    { id: "b0000000-0000-4000-b000-000000000003", avgTasks: 15, avgUnits: 98,  avgTime: 87,  avgUtil: 94 },
    { id: "b0000000-0000-4000-b000-000000000004", avgTasks: 10, avgUnits: 68,  avgTime: 110, avgUtil: 80 },
    { id: "b0000000-0000-4000-b000-000000000005", avgTasks:  9, avgUnits: 55,  avgTime: 118, avgUtil: 74 },
    { id: "b0000000-0000-4000-b000-000000000006", avgTasks: 14, avgUnits: 92,  avgTime: 90,  avgUtil: 93 },
    { id: "b0000000-0000-4000-b000-000000000007", avgTasks: 10, avgUnits: 65,  avgTime: 108, avgUtil: 79 },
    { id: "b0000000-0000-4000-b000-000000000008", avgTasks: 12, avgUnits: 80,  avgTime: 99,  avgUtil: 87 },
    { id: "b0000000-0000-4000-b000-000000000009", avgTasks:  8, avgUnits: 42,  avgTime: 148, avgUtil: 71 },
    { id: "b0000000-0000-4000-b000-000000000010", avgTasks:  7, avgUnits: 36,  avgTime: 155, avgUtil: 66 },
    { id: "b0000000-0000-4000-b000-000000000011", avgTasks:  8, avgUnits: 40,  avgTime: 142, avgUtil: 69 },
    { id: "b0000000-0000-4000-b000-000000000012", avgTasks:  6, avgUnits: 30,  avgTime: 162, avgUtil: 62 },
  ];

  for (const op of metricProfiles) {
    for (let d = 1; d <= 14; d++) {
      const v = () => 0.8 + Math.random() * 0.4;
      await query(`
        INSERT INTO labor_daily_metrics (operator_id, date, tasks_completed, units_processed, avg_task_time, utilization_percent)
        VALUES ($1, CURRENT_DATE - $2::int, $3, $4, $5, $6)
        ON CONFLICT (operator_id, date) DO NOTHING
      `, [
        op.id,
        d,
        Math.round(op.avgTasks * v()),
        Math.round(op.avgUnits * v()),
        Math.round(op.avgTime  * v() * 10) / 10,
        Math.min(100, Math.round(op.avgUtil * v() * 100) / 100)
      ]);
    }
  }
  console.log("  labor_daily_metrics (14 days × 12 operators)");

  // ── Sales orders & purchase orders via service layer ───────────
  // Query SKU IDs (needed by createSalesOrder / generateTasksForOrderEvent)
  const { rows: skuRows } = await query(`SELECT id, sku FROM skus`);
  const skuId = (code) => {
    const row = skuRows.find((r) => r.sku === code);
    if (!row) throw new Error(`SKU not found: ${code}`);
    return row.id;
  };

  // Helper: today + N days ISO string
  const shipDate = (daysFromNow) =>
    new Date(Date.now() + daysFromNow * 86400000).toISOString();

  // ── Sales orders (generates pick tasks automatically) ──────────
  const salesOrders = [
    {
      salesOrderId: "RP-SO-2026-001",
      shipDate: shipDate(1),
      comment: "Urgent: 6-DOF robot arm components",
      lines: [
        { skuId: skuId("SERVO-002"), quantity: 6 },
        { skuId: skuId("SERVO-006"), quantity: 2 },
        { skuId: skuId("MCU-001"),   quantity: 1 },
        { skuId: skuId("PWR-007"),   quantity: 1 },
      ]
    },
    {
      salesOrderId: "RP-SO-2026-002",
      shipDate: shipDate(2),
      comment: "Differential drive mobile base",
      lines: [
        { skuId: skuId("SERVO-008"), quantity: 2 },
        { skuId: skuId("DRV-002"),   quantity: 4 },
        { skuId: skuId("MCU-005"),   quantity: 1 },
        { skuId: skuId("SENS-001"),  quantity: 2 },
      ]
    },
    {
      salesOrderId: "RP-SO-2026-003",
      shipDate: shipDate(2),
      comment: "Sensor kit for autonomous navigation",
      lines: [
        { skuId: skuId("SENS-003"), quantity: 1 },
        { skuId: skuId("SENS-004"), quantity: 2 },
        { skuId: skuId("SENS-009"), quantity: 4 },
        { skuId: skuId("SENS-011"), quantity: 1 },
      ]
    },
    {
      salesOrderId: "RP-SO-2026-004",
      shipDate: shipDate(3),
      comment: "FPV drone build — motors + ESCs",
      lines: [
        { skuId: skuId("SERVO-009"), quantity: 4 },
        { skuId: skuId("PWR-005"),   quantity: 4 },
        { skuId: skuId("PWR-001"),   quantity: 2 },
      ]
    },
    {
      salesOrderId: "RP-SO-2026-005",
      shipDate: shipDate(3),
      comment: "Embedded compute stack for ROS robot",
      lines: [
        { skuId: skuId("MCU-002"),  quantity: 1 },
        { skuId: skuId("MCU-005"),  quantity: 2 },
        { skuId: skuId("COM-003"),  quantity: 1 },
        { skuId: skuId("CAB-001"),  quantity: 3 },
      ]
    },
    {
      salesOrderId: "RP-SO-2026-006",
      shipDate: shipDate(4),
      comment: "Pick-and-place gripper assembly",
      lines: [
        { skuId: skuId("GRP-001"),  quantity: 1 },
        { skuId: skuId("GRP-002"),  quantity: 4 },
        { skuId: skuId("GRP-003"),  quantity: 1 },
        { skuId: skuId("SERVO-003"),quantity: 2 },
      ]
    },
    {
      salesOrderId: "RP-SO-2026-007",
      shipDate: shipDate(5),
      comment: "Structural frame for delta robot",
      lines: [
        { skuId: skuId("STR-001"),  quantity: 6 },
        { skuId: skuId("STR-004"),  quantity: 12 },
        { skuId: skuId("STR-005"),  quantity: 2 },
        { skuId: skuId("DRV-006"),  quantity: 3 },
      ]
    },
    {
      salesOrderId: "RP-SO-2026-008",
      shipDate: shipDate(5),
      comment: "Hardware & consumables bundle",
      lines: [
        { skuId: skuId("ACC-001"),  quantity: 2 },
        { skuId: skuId("ACC-004"),  quantity: 1 },
        { skuId: skuId("CAB-002"),  quantity: 1 },
        { skuId: skuId("CAB-003"),  quantity: 5 },
      ]
    },
    {
      salesOrderId: "RP-SO-2026-009",
      shipDate: shipDate(7),
      comment: "CNC machine retrofit: steppers + drivers",
      lines: [
        { skuId: skuId("SERVO-006"), quantity: 3 },
        { skuId: skuId("SERVO-007"), quantity: 1 },
        { skuId: skuId("PWR-004"),   quantity: 3 },
        { skuId: skuId("CAB-008"),   quantity: 2 },
      ]
    },
    {
      salesOrderId: "RP-SO-2026-010",
      shipDate: shipDate(7),
      comment: "Mecanum rover platform kit",
      lines: [
        { skuId: skuId("DRV-003"),  quantity: 1 },
        { skuId: skuId("SERVO-008"),quantity: 4 },
        { skuId: skuId("MCU-004"),  quantity: 1 },
        { skuId: skuId("PWR-008"),  quantity: 1 },
      ]
    },
  ];

  let soCreated = 0;
  for (const so of salesOrders) {
    try {
      const normalizedEvent = normalizeTaskGenerationEvent({
        type: "sales_order_ready_for_pick",
        salesOrderId: so.salesOrderId,
        shipDate: so.shipDate,
        lines: so.lines
      });
      const result = await createSalesOrder(normalizedEvent);
      if (!result.skipped) soCreated++;
    } catch (err) {
      console.warn(`  [warn] Sales order ${so.salesOrderId} skipped: ${err.message}`);
    }
  }
  console.log(`  sales orders (${soCreated}/${salesOrders.length} created, tasks generated automatically)`);

  // ── Purchase orders (generates putaway tasks automatically) ────
  const purchaseOrders = [
    {
      purchaseOrderId: "RP-PO-2026-001",
      strategy: "CONSOLIDATION",
      comment: "Servo motor restock",
      lines: [
        { skuId: skuId("SERVO-001"), quantity: 30 },
        { skuId: skuId("SERVO-002"), quantity: 25 },
        { skuId: skuId("SERVO-006"), quantity: 20 },
      ]
    },
    {
      purchaseOrderId: "RP-PO-2026-002",
      strategy: "CONSOLIDATION",
      comment: "Sensor module restock",
      lines: [
        { skuId: skuId("SENS-001"), quantity: 50 },
        { skuId: skuId("SENS-004"), quantity: 40 },
        { skuId: skuId("SENS-009"), quantity: 30 },
      ]
    },
    {
      purchaseOrderId: "RP-PO-2026-003",
      strategy: "RANDOM",
      comment: "Power electronics restocking run",
      lines: [
        { skuId: skuId("PWR-001"), quantity: 20 },
        { skuId: skuId("PWR-003"), quantity: 30 },
        { skuId: skuId("PWR-007"), quantity: 25 },
      ]
    },
    {
      purchaseOrderId: "RP-PO-2026-004",
      strategy: "RANDOM",
      comment: "Hardware consumables bulk order",
      lines: [
        { skuId: skuId("ACC-001"), quantity: 40 },
        { skuId: skuId("ACC-008"), quantity: 25 },
        { skuId: skuId("CAB-001"), quantity: 50 },
      ]
    },
    {
      purchaseOrderId: "RP-PO-2026-005",
      strategy: "EMPTY",
      comment: "MCU & compute boards restock",
      lines: [
        { skuId: skuId("MCU-001"), quantity: 15 },
        { skuId: skuId("MCU-005"), quantity: 20 },
        { skuId: skuId("MCU-002"), quantity: 10 },
      ]
    },
  ];

  let poCreated = 0;
  for (const po of purchaseOrders) {
    try {
      const result = await generateTasksForOrderEvent({
        type: "purchase_order_received",
        purchaseOrderId: po.purchaseOrderId,
        strategy: po.strategy,
        lines: po.lines
      });
      if (!result.skipped) poCreated++;
    } catch (err) {
      console.warn(`  [warn] Purchase order ${po.purchaseOrderId} skipped: ${err.message}`);
    }
  }
  console.log(`  purchase orders (${poCreated}/${purchaseOrders.length} created, putaway tasks generated automatically)`);

  console.log("Test data seed complete.");
};

seed()
  .then(() => pool.end())
  .catch((error) => {
    console.error("Test data seed failed:", error);
    process.exit(1);
  });
