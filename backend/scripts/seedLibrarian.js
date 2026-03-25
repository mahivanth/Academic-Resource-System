const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const User = require('../models/User');

(async () => {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const existing = await User.findOne({ email: 'librarian@arus.edu' });
    if (existing) {
        console.log('⚠️  Librarian already exists:', existing.email);
        await mongoose.disconnect();
        return;
    }

    const hashed = await bcrypt.hash('Library@123', 10);
    await User.create({
        name: 'Library Staff',
        email: 'librarian@arus.edu',
        password: hashed,
        role: 'faculty',
        facultyType: 'non-teaching',
        department: 'Library',
        facultyId: 'LIB001'
    });

    console.log('✅ Librarian created:');
    console.log('   Email    : librarian@arus.edu');
    console.log('   Password : Library@123');
    console.log('   Role     : Non-Teaching Faculty — Library');
    await mongoose.disconnect();
})();
