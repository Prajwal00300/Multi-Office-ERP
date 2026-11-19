const { Op } = require('sequelize');
const sequelize = require('../config/database');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const Purchase = require('../models/Purchase');
const PurchaseItem = require('../models/PurchaseItem');

/**
 * Ensures a Party/Dealer name exists in Customer Master for the given organization.
 */
async function ensureCustomerForParty(organizationId, partyName, transaction) {
  const cleanName = String(partyName || '').trim();
  if (!organizationId || !cleanName) return null;
  const normalized = cleanName.toLowerCase();

  const existing = await Customer.findOne({
    where: {
      organizationId: parseInt(organizationId, 10),
      [Op.and]: [
        sequelize.where(sequelize.fn('LOWER', sequelize.fn('TRIM', sequelize.col('name'))), normalized)
      ]
    },
    transaction
  });

  if (existing) return existing;

  return Customer.create({
    organizationId: parseInt(organizationId, 10),
    name: cleanName
  }, { transaction });
}

/**
 * Ensures a Product Name exists in Product Master (with 0 initial stock) for the given organization.
 */
async function ensureProductForOrderLine(organizationId, { name, unit, specifications } = {}, transaction) {
  const cleanName = String(name || '').trim();
  if (!organizationId || !cleanName) return null;
  const normalized = cleanName.toLowerCase();

  const existing = await Product.findOne({
    where: {
      organizationId: parseInt(organizationId, 10),
      [Op.and]: [
        sequelize.where(sequelize.fn('LOWER', sequelize.fn('TRIM', sequelize.col('name'))), normalized)
      ]
    },
    transaction
  });

  if (existing) return existing;

  return Product.create({
    organizationId: parseInt(organizationId, 10),
    name: cleanName,
    unit: unit ? String(unit).trim() : 'Ton',
    difference: 0,
    specifications: specifications ? String(specifications).trim() : null,
    currentStock: 0,
    status: 'ACTIVE'
  }, { transaction });
}

let syncPromise = null;

/**
 * Non-destructive backfill (runs once per server/serverless lifecycle):
 * Ensures any party names and unlinked product names from previously saved Purchase Orders
 * exist in Customer Master and Product Master, and links purchase_items.productId.
 */
async function syncExistingPurchasePartiesAndProducts() {
  if (syncPromise) return syncPromise;

  syncPromise = (async () => {
    try {
      const purchases = await Purchase.findAll({
        attributes: ['id', 'organizationId', 'vendorName'],
        include: [
          {
            model: PurchaseItem,
            as: 'items',
            attributes: ['id', 'productId', 'productNameSnapshot', 'productSpecificationsSnapshot', 'unit']
          }
        ]
      });

      for (const po of purchases) {
        if (!po.organizationId) continue;

        if (po.vendorName && po.vendorName.trim()) {
          try {
            await ensureCustomerForParty(po.organizationId, po.vendorName);
          } catch (custErr) {
            console.warn('Sync PO party to customer warning:', custErr.message);
          }
        }

        for (const item of (po.items || [])) {
          if (!item.productId && item.productNameSnapshot && item.productNameSnapshot.trim()) {
            try {
              const prod = await ensureProductForOrderLine(po.organizationId, {
                name: item.productNameSnapshot,
                unit: item.unit || 'Ton',
                specifications: item.productSpecificationsSnapshot || null
              });
              if (prod) {
                await item.update({ productId: prod.id });
              }
            } catch (prodErr) {
              console.warn('Sync PO item to product warning:', prodErr.message);
            }
          }
        }
      }
    } catch (err) {
      // Allow retry next call if DB wasn't ready yet
      syncPromise = null;
      console.warn('syncExistingPurchasePartiesAndProducts notice:', err.message);
    }
  })();

  return syncPromise;
}

module.exports = {
  ensureCustomerForParty,
  ensureProductForOrderLine,
  syncExistingPurchasePartiesAndProducts
};
