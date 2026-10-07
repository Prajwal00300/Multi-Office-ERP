require('dotenv').config();
const express = require('express');
const sequelize = require('./config/database');
const organizationRoutes = require('./routes/organizationRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware to parse JSON
app.use(express.json());

// Register API Routes
app.use('/api/organizations', organizationRoutes);

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
