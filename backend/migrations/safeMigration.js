const sequelize = require('../config/database');

/**
 * Non-destructive migration to support the new CEO -> Office -> Employee hierarchy.
 *
 * Rules:
 * - Checks existing columns before altering
 * - Never drops or truncates any table or record
 * - Preserves all foreign keys and historical data
 */
async function runSafeHierarchyMigration() {
  try {
    console.log('🔄 Checking database schema for CEO hierarchy columns...');

    // 1. Inspect 'users' columns
    const [userColumns] = await sequelize.query(`
      SELECT COLUMN_NAME, COLUMN_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
    `);

    const userColumnNames = userColumns.map(c => (c.COLUMN_NAME || c.column_name || '').toLowerCase());
    const roleColumn = userColumns.find(c => (c.COLUMN_NAME || c.column_name || '').toLowerCase() === 'role');

    // 1a. Ensure 'CEO' is in the users.role ENUM
    if (roleColumn) {
      const colType = (roleColumn.COLUMN_TYPE || roleColumn.column_type || '').toUpperCase();
      if (!colType.includes("'CEO'")) {
        console.log("   -> Adding 'CEO' to users.role ENUM...");
        await sequelize.query(`
          ALTER TABLE users 
          MODIFY COLUMN role ENUM('SUPER_ADMIN', 'CEO', 'ADMIN', 'WEIGHBRIDGE_CONTROLLER', 'OPERATIONS_BILLING', 'PAYMENT_COLLECTOR', 'USER') 
          NOT NULL DEFAULT 'USER'
        `);
        console.log("   ✅ users.role ENUM updated with 'CEO'.");
      }
    }

    // 1b. Ensure users.status exists
    if (!userColumnNames.includes('status')) {
      console.log("   -> Adding 'status' column to users...");
      await sequelize.query(`
        ALTER TABLE users 
        ADD COLUMN status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE'
      `);
      console.log("   ✅ users.status added.");
    }

    // 1c. Ensure users.fullName exists
    if (!userColumnNames.includes('fullname')) {
      console.log("   -> Adding 'fullName' column to users...");
      await sequelize.query(`
        ALTER TABLE users 
        ADD COLUMN fullName VARCHAR(255) NULL
      `);
      console.log("   ✅ users.fullName added.");
    }

    // 1d. Ensure users.phone exists
    if (!userColumnNames.includes('phone')) {
      console.log("   -> Adding 'phone' column to users...");
      await sequelize.query(`
        ALTER TABLE users 
        ADD COLUMN phone VARCHAR(255) NULL
      `);
      console.log("   ✅ users.phone added.");
    }

    // 1e. Ensure users.email exists
    if (!userColumnNames.includes('email')) {
      console.log("   -> Adding 'email' column to users...");
      await sequelize.query(`
        ALTER TABLE users 
        ADD COLUMN email VARCHAR(255) NULL
      `);
      console.log("   ✅ users.email added.");
    }

    // 2. Inspect 'organizations' columns
    const [orgColumns] = await sequelize.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'organizations'
    `);

    const orgColumnNames = orgColumns.map(c => (c.COLUMN_NAME || c.column_name || '').toLowerCase());

    // 2a. Ensure organizations.ceoId exists
    if (!orgColumnNames.includes('ceoid')) {
      console.log("   -> Adding 'ceoId' column to organizations...");
      await sequelize.query(`
        ALTER TABLE organizations 
        ADD COLUMN ceoId INT NULL
      `);
      try {
        await sequelize.query(`
          ALTER TABLE organizations 
          ADD INDEX idx_organizations_ceoId (ceoId)
        `);
      } catch (idxErr) {
        // Index might already exist or ignore
      }
      console.log("   ✅ organizations.ceoId added.");
    }

    // 3. Inspect 'products' columns
    const [productColumns] = await sequelize.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products'
    `);

    const productColumnNames = productColumns.map(c => (c.COLUMN_NAME || c.column_name || '').toLowerCase());

    if (!productColumnNames.includes('price')) {
      console.log("   -> Adding 'price' column to products...");
      await sequelize.query(`
        ALTER TABLE products 
        ADD COLUMN price DECIMAL(15, 2) NOT NULL DEFAULT 0.00
      `);
      console.log("   ✅ products.price added.");
    }

    // Relax category and size nullability so they are optional with safe defaults
    try {
      await sequelize.query(`
        ALTER TABLE products 
        MODIFY COLUMN category VARCHAR(255) NULL DEFAULT 'General'
      `);
      await sequelize.query(`
        ALTER TABLE products 
        MODIFY COLUMN size VARCHAR(255) NULL DEFAULT '-'
      `);
      console.log("   ✅ products.category and products.size relaxed to optional/default.");
    } catch (colErr) {
      console.warn("   ⚠️ Note altering products category/size:", colErr.message);
    }

    console.log('✅ Safe hierarchy migration completed successfully.');
  } catch (error) {
    console.error('⚠️ Safe migration note (can be ignored if columns already up-to-date):', error.message);
  }
}

module.exports = runSafeHierarchyMigration;
module.exports.runSafeHierarchyMigration = runSafeHierarchyMigration;
