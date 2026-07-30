require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

// One-off: node scripts/set-admin.js someone@example.com
const email = process.argv[2];
if (!email) {
  console.error('Usage: node scripts/set-admin.js <email>');
  process.exit(1);
}

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const user = await User.findOneAndUpdate({ email }, { role: 'admin' }, { returnDocument: 'after' });
  if (!user) {
    console.error(`No user found with email ${email}`);
  } else {
    console.log(`${user.email} is now an admin.`);
  }

  await mongoose.disconnect();
};

run().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
