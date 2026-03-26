const mongoose = require('mongoose');
const User = require('./backend/models/User');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI;

async function findAdmins() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB Atlas');

        const admins = await User.find({ role: 'admin' }, { name: 1, email: 1, username: 1, role: 1 });
        console.log('Admin Users in Atlas:', JSON.stringify(admins, null, 2));

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

findAdmins();
