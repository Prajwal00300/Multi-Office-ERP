require('dotenv').config();
const express = require('express');
const sequelize = require('./config/database');
const organizationRoutes = require('./routes/organizationRoutes');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const customerRoutes = require('./routes/customerRoutes');
const productRoutes = require('./routes/productRoutes');
const estimateRoutes = require('./routes/estimateRoutes');
const billRoutes = require('./routes/billRoutes');
const purchaseRoutes = require('./routes/purchaseRoutes');
const weighbridgeRoutes = require('./routes/weighbridgeRoutes');
const gatePassRoutes = require('./routes/gatePassRoutes');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map(s => s.trim())
  : ['http://localhost:5173', 'http://localhost:5174'];

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server, curl, Postman, or requests without origin
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.includes('*') ||
      allowedOrigins.includes(origin) ||
      origin.endsWith('.vercel.app') ||
      origin.includes('localhost')
    ) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true
}));
app.use(express.json());

// Register API Routes
app.use('/api/organizations', organizationRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/products', productRoutes);
app.use('/api/estimates', estimateRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/weighbridge', weighbridgeRoutes);
app.use('/api/gate-passes', gatePassRoutes);

// Basic health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Backend is running' });
});

app.get('/', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'OfficeFlow ERP API is running' });
});

// Function to initialize the database and start the server
const startServer = async () => {
  try {
    // Authenticate with the database
    await sequelize.authenticate();
    console.log('✅ Connection to the MySQL database has been established successfully.');

    // Sync database models
    // Using { alter: false } or just sync() to follow a clean approach. 
    // In production, migrations should be used instead of sync.
    await sequelize.sync();
    console.log('✅ Database models synchronized successfully.');

    // Start Express server
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error.message);
    process.exit(1); // Exit process with failure
  }
};

// If not running in Vercel serverless, start standalone server
if (!process.env.VERCEL) {
  startServer();
} else {
  // In Vercel serverless environment, authenticate DB connection asynchronously
  sequelize.authenticate()
    .then(() => console.log('✅ Connected to Aiven MySQL (Vercel Serverless)'))
    .catch(err => console.error('❌ Vercel DB connection error:', err));
}

module.exports = app;
