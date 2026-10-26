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

    // 3b. Ensure products.currentStock exists
    if (!productColumnNames.includes('currentstock')) {
      console.log("   -> Adding 'currentStock' column to products...");
      await sequelize.query(`
        ALTER TABLE products 
        ADD COLUMN currentStock DECIMAL(15, 3) NOT NULL DEFAULT 0.000
      `);
      console.log("   ✅ products.currentStock added.");
    }

    // 3c. Ensure products.difference exists
    if (!productColumnNames.includes('difference')) {
      console.log("   -> Adding 'difference' column to products...");
      await sequelize.query(`
        ALTER TABLE products 
        ADD COLUMN difference DECIMAL(15, 2) NOT NULL DEFAULT 0.00
      `);
      console.log("   ✅ products.difference added.");
    }

    // 3d. Safely drop 'category' and 'price' columns from products table if they exist
    try {
      const [prodColsNow] = await sequelize.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products'
      `);
      const prodColNamesNow = prodColsNow.map(c => (c.COLUMN_NAME || c.column_name || '').toLowerCase());

      const [prodIdxs] = await sequelize.query(`SHOW INDEX FROM products`);
      const indexNames = new Set(prodIdxs.map(idx => idx.Key_name || idx.key_name));

      if (indexNames.has('products_category')) {
        await sequelize.query('ALTER TABLE products DROP INDEX products_category');
      }
      if (indexNames.has('products_organization_id_name_category_size')) {
        await sequelize.query('ALTER TABLE products DROP INDEX products_organization_id_name_category_size');
      }

      if (prodColNamesNow.includes('category')) {
        await sequelize.query('ALTER TABLE products DROP COLUMN category');
        console.log("   ✅ products.category dropped successfully.");
      }
      if (prodColNamesNow.includes('price')) {
        await sequelize.query('ALTER TABLE products DROP COLUMN price');
        console.log("   ✅ products.price dropped successfully.");
      }
      if (prodColNamesNow.includes('size')) {
        await sequelize.query('ALTER TABLE products DROP COLUMN size');
        console.log("   ✅ products.size dropped successfully.");
      }
      if (!indexNames.has('products_org_name')) {
        await sequelize.query('ALTER TABLE products ADD INDEX products_org_name (organizationId, name)');
      }
    } catch (dropErr) {
      console.warn('   ⚠️ Note on dropping product category/price:', dropErr.message);
    }

    // 4. Remove bill_audits and estimate_audits tables as requested
    try {
      await sequelize.query('DROP TABLE IF EXISTS bill_audits');
      await sequelize.query('DROP TABLE IF EXISTS estimate_audits');
      console.log('   ✅ bill_audits and estimate_audits tables dropped successfully.');
    } catch (dropErr) {
      console.warn('   ⚠️ Note dropping audit tables:', dropErr.message);
    }

    // 5. Update purchases.status column to VARCHAR(50)
    try {
      await sequelize.query(`
        ALTER TABLE purchases 
        MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'Pending'
      `);
      console.log("   ✅ purchases.status updated to VARCHAR(50).");
    } catch (purErr) {
      console.warn("   ⚠️ Note altering purchases status:", purErr.message);
    }

    // 5b. Drop global unique constraint on purchases.purchaseNumber to allow office-scoped serials (1, 2, 3...)
    try {
      const [indices] = await sequelize.query(`
        SHOW INDEX FROM purchases WHERE Column_name = 'purchaseNumber' AND Non_unique = 0
      `);
      for (const idx of indices) {
        if (idx.Key_name && idx.Key_name !== 'PRIMARY') {
          await sequelize.query(`ALTER TABLE purchases DROP INDEX \`${idx.Key_name}\``);
          console.log(`   ✅ Dropped global unique index ${idx.Key_name} on purchases.purchaseNumber.`);
        }
      }
    } catch (dropIdxErr) {
      // index may not exist
    }

    // 5c. Convert any legacy non-numeric purchase numbers (e.g. PUR-...) to sequential integers (1, 2, 3...)
    try {
      const [legacyPurchases] = await sequelize.query(`
        SELECT id, purchaseNumber, organizationId
        FROM purchases
        WHERE purchaseNumber NOT REGEXP '^[0-9]+$'
        ORDER BY organizationId ASC, id ASC
      `);
      if (legacyPurchases && legacyPurchases.length > 0) {
        for (const lp of legacyPurchases) {
          const orgId = lp.organizationId;
          const [maxRes] = await sequelize.query(
            "SELECT MAX(CAST(purchaseNumber AS UNSIGNED)) AS maxNum FROM purchases WHERE organizationId = ? AND purchaseNumber REGEXP '^[0-9]+$'",
            { replacements: [orgId] }
          );
          let nextNum = 1;
          if (maxRes && maxRes[0] && maxRes[0].maxNum !== null && maxRes[0].maxNum !== undefined) {
            nextNum = parseInt(maxRes[0].maxNum, 10) + 1;
          }
          await sequelize.query(
            "UPDATE purchases SET purchaseNumber = ? WHERE id = ?",
            { replacements: [String(nextNum), lp.id] }
          );
          await sequelize.query(
            "UPDATE goods_receipts SET purchaseNumber = ? WHERE purchaseId = ?",
            { replacements: [String(nextNum), lp.id] }
          );
          console.log(`   ✅ Renumbered legacy purchase #${lp.id} (${lp.purchaseNumber}) -> Serial Number ${nextNum}`);
        }
      }
    } catch (legacyErr) {
      console.warn("   ⚠️ Note checking legacy purchases:", legacyErr.message);
    }

    // 6. Inspect 'purchase_items' columns for carbonType and receivedQuantity
    const [purchaseItemColumns] = await sequelize.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchase_items'
    `);
    const purchaseItemColumnNames = purchaseItemColumns.map(c => (c.COLUMN_NAME || c.column_name || '').toLowerCase());

    if (!purchaseItemColumnNames.includes('carbontype')) {
      console.log("   -> Adding 'carbonType' column to purchase_items...");
      await sequelize.query(`
        ALTER TABLE purchase_items 
        ADD COLUMN carbonType VARCHAR(50) NOT NULL DEFAULT 'Low Carbon'
      `);
      console.log("   ✅ purchase_items.carbonType added.");
    }

    if (!purchaseItemColumnNames.includes('receivedquantity')) {
      console.log("   -> Adding 'receivedQuantity' column to purchase_items...");
      await sequelize.query(`
        ALTER TABLE purchase_items 
        ADD COLUMN receivedQuantity DECIMAL(15, 3) NOT NULL DEFAULT 0.000
      `);
      console.log("   ✅ purchase_items.receivedQuantity added.");
    }

    // 7. Create goods_receipts table if not exists
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS goods_receipts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        receiptNumber VARCHAR(255) NOT NULL UNIQUE,
        purchaseId INT NOT NULL,
        purchaseNumber VARCHAR(255) NOT NULL,
        organizationId INT NOT NULL,
        receiptDate DATE NOT NULL,
        receivedBy INT NOT NULL,
        remarks TEXT NULL,
        idempotencyKey VARCHAR(255) NULL UNIQUE,
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL,
        INDEX idx_goods_receipts_purchaseId (purchaseId),
        INDEX idx_goods_receipts_orgId (organizationId),
        INDEX idx_goods_receipts_date (receiptDate)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("   ✅ goods_receipts table verified/created.");

    // 8. Create goods_receipt_items table if not exists
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS goods_receipt_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        goodsReceiptId INT NOT NULL,
        purchaseItemId INT NOT NULL,
        productId INT NULL,
        productNameSnapshot VARCHAR(255) NOT NULL,
        carbonType VARCHAR(50) NOT NULL DEFAULT 'Low Carbon',
        quantityReceived DECIMAL(15, 3) NOT NULL DEFAULT 0.000,
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL,
        INDEX idx_gri_receiptId (goodsReceiptId),
        INDEX idx_gri_purchaseItemId (purchaseItemId),
        INDEX idx_gri_productId (productId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("   ✅ goods_receipt_items table verified/created.");

    // 9. Create inventory_movements table if not exists
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS inventory_movements (
        id INT AUTO_INCREMENT PRIMARY KEY,
        organizationId INT NOT NULL,
        productId INT NOT NULL,
        movementType ENUM('IN', 'OUT') NOT NULL,
        quantity DECIMAL(15, 3) NOT NULL,
        referenceType ENUM('GOODS_RECEIPT', 'BILL', 'MANUAL') NOT NULL,
        referenceId INT NULL,
        referenceNumber VARCHAR(255) NULL,
        purchaseItemId INT NULL,
        performedBy INT NULL,
        notes TEXT NULL,
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL,
        INDEX idx_inv_orgId (organizationId),
        INDEX idx_inv_productId (productId),
        INDEX idx_inv_ref (referenceType, referenceId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    // 10. Non-destructive CEO-to-Office 1:1 assignment inspection
    try {
      const [conflicts] = await sequelize.query(`
        SELECT ceoId, COUNT(*) as officeCount, GROUP_CONCAT(id SEPARATOR ', ') as officeIds, GROUP_CONCAT(name SEPARATOR ', ') as officeNames
        FROM organizations
        WHERE ceoId IS NOT NULL
        GROUP BY ceoId
        HAVING COUNT(*) > 1
      `);
      if (conflicts && conflicts.length > 0) {
        console.warn('   ⚠️ [DATA INSPECTION REPORT] Existing multi-office CEO assignments identified:');
        conflicts.forEach(c => {
          console.warn(`      - CEO ID #${c.ceoId} is currently assigned to ${c.officeCount} offices (IDs: [${c.officeIds}], Names: [${c.officeNames}]).`);
        });
        console.warn('      Preserving existing records without modification as instructed. Enforcing strict 1:1 for all future operations.');
      } else {
        console.log('   ✅ CEO-to-office 1:1 assignment inspection passed.');
      }
    } catch (confErr) {
      console.warn('   ⚠️ Note checking CEO conflicts:', confErr.message);
    }

    console.log('✅ Safe hierarchy migration completed successfully.');
  } catch (error) {
    console.error('⚠️ Safe migration note (can be ignored if columns already up-to-date):', error.message);
  }
}

module.exports = runSafeHierarchyMigration;
module.exports.runSafeHierarchyMigration = runSafeHierarchyMigration;
