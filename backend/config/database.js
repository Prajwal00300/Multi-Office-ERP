const path = require('path');
const { Sequelize } = require('sequelize');
const mysql2 = require('mysql2');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Extract database configuration from environment variables
const {
  DB_NAME,
  DB_USER,
  DB_PASSWORD,
  DB_HOST,
  DB_PORT,
  DATABASE_URL,
  MYSQL_URL
} = process.env;

const fs = require('fs');
const connectionString = DATABASE_URL || MYSQL_URL;

let sslConfig = {};
if (process.env.DB_SSL === 'true') {
  sslConfig = {
    ssl: {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'false' ? false : true
    }
  };

  if (process.env.DB_CA_CERT && fs.existsSync(process.env.DB_CA_CERT)) {
    try {
      sslConfig.ssl.ca = fs.readFileSync(process.env.DB_CA_CERT);
    } catch (caErr) {
      console.warn('⚠️ Warning: Could not read DB_CA_CERT file:', caErr.message);
    }
  }
}

// Create Sequelize instance
let sequelize;
if (connectionString) {
  sequelize = new Sequelize(connectionString, {
    dialect: 'mysql',
    dialectModule: mysql2,
    dialectOptions: sslConfig,
    logging: false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  });
} else {
  sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
    host: DB_HOST,
    port: parseInt(DB_PORT, 10) || 4000,
    dialect: 'mysql',
    dialectModule: mysql2,
    dialectOptions: sslConfig,
    logging: false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  });
}

module.exports = sequelize;
