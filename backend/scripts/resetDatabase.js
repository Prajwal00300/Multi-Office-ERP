const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const sequelize = require('../config/database');
const ddls = require('../scripts_backup_ddls.json');

const USERS_SEED = [
  {
    id: 1,
    username: 'prajwal',
    password: '$2b$10$rNesge/RzAmnwmZj22BjAeS7WGJkfZ7bi8ZkveD7wxBegk9YFrq5.',
    role: 'SUPER_ADMIN',
    status: 'ACTIVE',
    fullName: null,
    phone: null,
    email: null,
    organizationId: null
  },
  {
    id: 2,
    username: 'manjit',
    password: '$2b$10$foRiEnWjQ1jCLY1tE9S6yezSegat8Ja2vXQ.ZOZIgeda.UTCIfvdi',
    role: 'CEO',
    status: 'ACTIVE',
    fullName: 'manjit',
    phone: '9876543210',
    email: 'm@gmail.com',
    organizationId: 1
  },
  {
    id: 3,
    username: 'kevin',
    password: '$2b$10$ZAJU7jcr.VeMMDw9z.0IrevcxcanXbCd9.OQ5GBGrT69X912Wv2fe',
    role: 'CEO',
    status: 'ACTIVE',
    fullName: 'kevin',
    phone: '1234567890',
    email: 'k@gmail.com',
    organizationId: 2
  }
];

const ORGS_SEED = [
  {
    id: 1,
    name: 'Chandigarh',
    address: 'Sector 34A',
    phone: '9876543210',
    status: 'ACTIVE',
    ceoId: 2
  },
  {
    id: 2,
    name: 'New Chandigarh',
    address: 'new',
    phone: '9876543210',
    status: 'ACTIVE',
    ceoId: 3
  }
];

async function resetDatabase() {
  console.log('🚀 Starting Database Reset & Sequence Normalization...');
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database.');

    // 1. Disable FK checks
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0;');
    console.log('🔒 Foreign key checks disabled.');

    // 2. Drop and recreate all 24 tables with AUTO_ID_CACHE = 1
    const tableNames = Object.keys(ddls);
    console.log(`📋 Processing ${tableNames.length} tables...`);

    for (const name of tableNames) {
      console.log(`  -> Resetting table: ${name}`);
      await sequelize.query(`DROP TABLE IF EXISTS \`${name}\`;`);

      let ddl = ddls[name];
      // Strip any AUTO_INCREMENT=\d+
      ddl = ddl.replace(/\s*AUTO_INCREMENT=\d+/gi, '');
      // Add AUTO_ID_CACHE=1 to ENGINE=InnoDB if not already present
      if (!ddl.includes('AUTO_ID_CACHE=1')) {
        ddl = ddl.replace(/ENGINE=InnoDB/i, 'ENGINE=InnoDB AUTO_ID_CACHE=1');
      }

      await sequelize.query(ddl);
      console.log(`     ✅ Recreated with AUTO_ID_CACHE=1`);
    }

    // 3. Seed Organizations (with sequential IDs 1 and 2)
    console.log('🏢 Seeding Organizations (IDs 1, 2)...');
    const now = new Date();
    for (const org of ORGS_SEED) {
      await sequelize.query(`
        INSERT INTO organizations (id, name, address, phone, status, ceoId, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, {
        replacements: [org.id, org.name, org.address, org.phone, org.status, org.ceoId, now, now]
      });
    }
    console.log('   ✅ Organizations seeded successfully.');

    // 4. Seed Users (with sequential IDs 1, 2, 3)
    console.log('👤 Seeding Users (IDs 1, 2, 3)...');
    for (const user of USERS_SEED) {
      await sequelize.query(`
        INSERT INTO users (id, username, password, role, status, fullName, phone, email, organizationId, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, {
        replacements: [
          user.id,
          user.username,
          user.password,
          user.role,
          user.status,
          user.fullName,
          user.phone,
          user.email,
          user.organizationId,
          now,
          now
        ]
      });
    }
    console.log('   ✅ Users seeded successfully.');

    // 5. Re-enable FK checks
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');
    console.log('🔓 Foreign key checks re-enabled.');

    // 6. Verification
    console.log('\n🔍 Running Post-Reset Verification...');
    for (const name of tableNames) {
      const [countRes] = await sequelize.query(`SELECT COUNT(*) AS cnt FROM \`${name}\`;`);
      const [createRes] = await sequelize.query(`SHOW CREATE TABLE \`${name}\`;`);
      const createSql = createRes[0]['Create Table'];
      const hasAutoIdCache = createSql.includes('AUTO_ID_CACHE=1');
      console.log(`   Table ${name.padEnd(35)} : Count=${countRes[0].cnt}, AUTO_ID_CACHE=1: ${hasAutoIdCache}`);
    }

    // 7. Verify test insert starts at 1
    console.log('\n🧪 Testing ID start on products and customers...');
    await sequelize.query(`
      INSERT INTO customers (organizationId, name, createdAt, updatedAt)
      VALUES (1, '__test_customer__', NOW(), NOW());
    `);
    const [testCust] = await sequelize.query(`SELECT id, name FROM customers WHERE name = '__test_customer__';`);
    console.log(`   First Customer ID: ${testCust[0].id} (Expected: 1)`);

    await sequelize.query(`
      INSERT INTO products (organizationId, name, unit, price, createdAt, updatedAt)
      VALUES (1, '__test_product__', 'Ton', 50000.00, NOW(), NOW());
    `);
    const [testProd] = await sequelize.query(`SELECT id, name, price FROM products WHERE name = '__test_product__';`);
    console.log(`   First Product ID: ${testProd[0].id} (Expected: 1)`);

    // Clean up test rows
    await sequelize.query(`DELETE FROM customers WHERE name = '__test_customer__';`);
    await sequelize.query(`DELETE FROM products WHERE name = '__test_product__';`);
    await sequelize.query(`ALTER TABLE customers AUTO_INCREMENT = 1;`);
    await sequelize.query(`ALTER TABLE products AUTO_INCREMENT = 1;`);
    console.log('   ✅ Test records removed and counters reset to 1.');

    console.log('\n🎉 ALL DATABASE OPERATIONAL DATA ERASED & SEQUENCES CONFIGURED FOR 1, 2, 3, 4... SUCCESSFUL!');
  } catch (err) {
    console.error('❌ Reset failed:', err);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

resetDatabase();
