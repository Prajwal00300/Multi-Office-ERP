const sequelize = require('./config/database');
const User = require('./models/User');
const bcrypt = require('bcryptjs');

const seedAdmin = async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync();

    const existingAdmin = await User.findOne({ where: { username: 'motheradmin' } });
    if (existingAdmin) {
      console.log('Super admin already exists!');
      process.exit(0);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('123456', salt);

    await User.create({
      username: 'motheradmin',
      password: hashedPassword,
      role: 'SUPER_ADMIN',
      organizationId: null
    });

    console.log('Successfully created the motheradmin Super Admin account on Aiven!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding admin:', error);
    process.exit(1);
  }
};

seedAdmin();
