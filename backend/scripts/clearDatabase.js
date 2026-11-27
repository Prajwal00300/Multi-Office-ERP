const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const sequelize = require('../config/database');

const PRESERVED_TABLES = ['users', 'organizations'];

async function clearDatabase() {
  console.log('🚀 Starting Database Clearance for Testing...');
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database.');

    // 1. Get all tables in database
    const [tablesRes] = await sequelize.query('SHOW TABLES;');
    const dbName = sequelize.config.database;
    const tableKey = Object.keys(tablesRes[0])[0];
    const allTables = tablesRes.map(row => row[tableKey]);

    console.log(`📋 Found ${allTables.length} tables in database ${dbName}:`);
    console.log(allTables.map(t => `   - ${t}`).join('\n'));

    // 2. Disable foreign key checks
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0;');
    console.log('🔒 Foreign key checks disabled.');

    // 3. Clear operational tables
    for (const table of allTables) {
      if (PRESERVED_TABLES.includes(table)) {
        console.log(`⏩ Preserving auth/org table: ${table}`);
        continue;
      }

      console.log(`🧹 Clearing table: ${table}...`);
      try {
        await sequelize.query(`TRUNCATE TABLE \`${table}\`;`);
        try {
          await sequelize.query(`ALTER TABLE \`${table}\` AUTO_INCREMENT = 1;`);
        } catch (alterErr) {
          // Some tables might not have auto_increment (e.g. junction tables)
        }
        console.log(`   ✅ Cleared & reset counter for: ${table}`);
      } catch (truncErr) {
        console.warn(`   ⚠️ TRUNCATE failed, falling back to DELETE FROM: ${truncErr.message}`);
        await sequelize.query(`DELETE FROM \`${table}\`;`);
        try {
          await sequelize.query(`ALTER TABLE \`${table}\` AUTO_INCREMENT = 1;`);
        } catch (alterErr) {}
        console.log(`   ✅ Deleted all rows from: ${table}`);
      }
    }

    // 4. Reset sequences if sequence tables exist
    // Check if any auto-increment or serial tracking table exists
    for (const table of allTables) {
      if (table.toLowerCase().includes('serial') || table.toLowerCase().includes('sequence')) {
        console.log(`🔄 Resetting sequence table: ${table}...`);
        await sequelize.query(`TRUNCATE TABLE \`${table}\`;`);
      }
    }

    // 5. Re-enable foreign key checks
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');
    console.log('🔓 Foreign key checks re-enabled.');

    // 6. Summary check
    console.log('\n📊 Verification summary:');
    for (const table of allTables) {
      const [countRes] = await sequelize.query(`SELECT COUNT(*) AS cnt FROM \`${table}\`;`);
      console.log(`   Table ${table.padEnd(35)}: ${countRes[0].cnt} rows`);
    }

    console.log('\n🎉 ALL OPERATIONAL DATA CLEARED SUCCESSFULLY! Ready for fresh testing.');
  } catch (err) {
    console.error('❌ Failed to clear database:', err);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

clearDatabase();
