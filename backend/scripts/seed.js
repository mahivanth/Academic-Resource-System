const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('MongoDB Connected for Seeding'))
    .catch(err => console.log(err));

async function seed() {
    try {
        await User.deleteMany({}); // Clear existing users

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('123', salt);

        const users = [
            {
                username: 'admin',
                email: 'admin@example.com',
                password: hashedPassword,
                role: 'admin',
                name: 'System Admin'
            },
            {
                username: 'faculty',
                email: 'faculty@example.com',
                password: hashedPassword,
                role: 'faculty',
                name: 'Dr. Faculty Member',
                facultyId: 'FAC001'
            },
            {
                username: 'student',
                email: 'student@example.com',
                password: hashedPassword,
                role: 'student',
                name: 'John Student',
                rollNo: 'STU001'
            }
        ];

        await User.insertMany(users);
        console.log('Users Seeded Successfully');
        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

seed();
