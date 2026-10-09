require('dotenv').config();
const express = require('express');
const sequelize = require('./config/database');
const organizationRoutes = require('./routes/organizationRoutes');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const customerRoutes = require('./routes/customerRoutes');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Register API Routes
app.use('/api/organizations', organizationRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/customers', customerRoutes);

// Basic health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Backend is running' });
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

startServer();
