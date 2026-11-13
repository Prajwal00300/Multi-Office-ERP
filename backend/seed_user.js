const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const bcrypt = require('bcryptjs');
const sequelize = require('./config/database');
const User = require('./models/User');

const username = process.argv[2] || 'prajwal';
const password = process.argv[3] || '123456';

async function seed() {
  try {
    await sequelize.authenticate();
    await User.sync();

    const existingUser = await User.findOne({ where: { username } });
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    if (existingUser) {
      existingUser.password = hashedPassword;
      existingUser.role = 'SUPER_ADMIN';
      existingUser.status = 'ACTIVE';
      await existingUser.save();
      console.log(`✅ User '${username}' updated with SUPER_ADMIN role.`);
    } else {
      await User.create({
        username,
        password: hashedPassword,
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
        organizationId: null
      });
      console.log(`✅ User '${username}' created with SUPER_ADMIN role!`);
    }
    console.log(`ℹ️ You can now log in with:
   Username: ${username}
   Password: ${password}`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error seeding user:', err.message);
    process.exit(1);
  }
}

seed();
