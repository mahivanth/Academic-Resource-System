const mongoose = require('mongoose');
require('dotenv').config({path: '.env'});

async function runTest() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const Announcement = require('./backend/models/Announcement');
        const User = require('./backend/models/User');

        const admin = await User.findOne({ role: 'admin' });
        const student = await User.findOne({ role: 'student' });
        const faculty = await User.findOne({ role: 'faculty' });

        console.log('--- Testing Announcement Visibility ---');

        // 1. Create a "All Users" announcement
        const a1 = new Announcement({
            title: 'Welcome All',
            content: 'This is for everyone',
            targetRoles: ['all'],
            createdBy: admin._id
        });
        await a1.save();

        // 2. Create a "Student only" announcement
        const a2 = new Announcement({
            title: 'Student Only',
            content: 'Only for students',
            targetRoles: ['student'],
            createdBy: admin._id
        });
        await a2.save();

        // 3. Test visibility for Student
        const studentVisible = await Announcement.find({
            isActive: true,
            $or: [{ targetRoles: 'all' }, { targetRoles: 'student' }]
        });
        console.log('Student sees:', studentVisible.length, 'announcements');
        const hasA1 = studentVisible.some(a => a.title === 'Welcome All');
        const hasA2 = studentVisible.some(a => a.title === 'Student Only');
        console.log('Student sees A1 (All):', hasA1);
        console.log('Student sees A2 (Student):', hasA2);

        // 4. Test visibility for Faculty
        const facultyVisible = await Announcement.find({
            isActive: true,
            $or: [{ targetRoles: 'all' }, { targetRoles: 'faculty' }]
        });
        console.log('Faculty sees:', facultyVisible.length, 'announcements');
        const fHasA1 = facultyVisible.some(a => a.title === 'Welcome All');
        const fHasA2 = facultyVisible.some(a => a.title === 'Student Only');
        console.log('Faculty sees A1 (All):', fHasA1);
        console.log('Faculty sees A2 (Student):', fHasA2);

        if (hasA1 && hasA2 && fHasA1 && !fHasA2) {
            console.log('VERIFIED: Announcement visibility logic is CORRECT.');
        } else {
            console.log('FAILED: Announcement visibility logic is INCORRECT.');
        }

        // Cleanup
        await Announcement.deleteOne({ _id: a1._id });
        await Announcement.deleteOne({ _id: a2._id });
        console.log('Cleanup done');
        
        process.exit(0);
    } catch (err) {
        console.error('Test error:', err);
        process.exit(1);
    }
}

runTest();
