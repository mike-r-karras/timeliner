const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://timeliner:renilemit@localhost:27017/timeliner';

// User schema (simplified)
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'user'], default: 'user' }
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model('User', UserSchema);

async function createAdminUser() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check if admin exists
    const existingAdmin = await User.findOne({ username: 'root' });
    if (existingAdmin) {
      console.log('Admin user already exists');
      console.log('Username:', existingAdmin.username);
      console.log('Role:', existingAdmin.role);

      // Test password
      const isValid = await bcrypt.compare('toor', existingAdmin.password);
      console.log('Password test (toor):', isValid ? 'VALID' : 'INVALID');

      await mongoose.disconnect();
      return;
    }

    console.log('Creating admin user...');
    const hashedPassword = await bcrypt.hash('toor', 12);

    const adminUser = await User.create({
      username: 'root',
      password: hashedPassword,
      role: 'admin'
    });

    console.log('Admin user created successfully!');
    console.log('Username: root');
    console.log('Password: toor');
    console.log('Role:', adminUser.role);
    console.log('ID:', adminUser._id);

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

createAdminUser();