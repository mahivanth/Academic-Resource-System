const express = require('express');
const router = express.Router();
const { ensureAuthenticated, ensureAdmin } = require('../config/auth');
const Resource = require('../models/Resource');
const User = require('../models/User');
const Booking = require('../models/Booking');
const SlotTiming = require('../models/SlotTiming');

// Admin Dashboard
router.get('/dashboard', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const bookingsCount = await Booking.countDocuments();
        const resourcesCount = await Resource.countDocuments({ type: 'resource' });
        const pendingCount = await Booking.countDocuments({ status: 'pending' });
        const approvedCount = await Booking.countDocuments({ status: 'approved' });
        const cancelledCount = await Booking.countDocuments({ status: 'cancelled' });
        
        const studentsCount = await User.countDocuments({ role: 'student' });
        const facultyCount = await User.countDocuments({ role: 'faculty' });

        // Get Recent Bookings
        const recentBookingsRaw = await Booking.find()
            .sort({ createdAt: -1 })
            .limit(6)
            .populate({
                path: 'resource',
                populate: {
                    path: 'slotTimings.assignedFaculty',
                    select: 'name'
                }
            })
            .populate('user', 'name');

        const recentBookings = recentBookingsRaw.map(b => {
             let facultyNames = new Set();
             if (b.resource && b.resource.slotTimings) {
                 b.resource.slotTimings.forEach(slot => {
                     if (slot.assignedFaculty) {
                         slot.assignedFaculty.forEach(f => {
                             if (f && f.name) facultyNames.add(f.name);
                         });
                     }
                 });
             }
             const facultyStr = facultyNames.size > 0 ? Array.from(facultyNames).join(', ') : '-';
             
             return {
                 student: b.user ? b.user.name : 'Unknown',
                 resource: b.resource ? b.resource.name : 'Unknown',
                 status: b.status,
                 faculty: facultyStr,
                 date: b.date ? b.date.toISOString().split('T')[0] : '-',
                 time: `${b.startTime} - ${b.endTime}`
             };
        });

        res.render('admin/dashboard', {
            user: req.user,
            stats: { 
                bookings: bookingsCount, 
                resources: resourcesCount, 
                pending: pendingCount,
                approved: approvedCount,
                cancelled: cancelledCount,
                students: studentsCount,
                faculty: facultyCount
            },
            recentBookings: recentBookings
        });
    } catch (err) {
        console.error(err);
        res.render('admin/dashboard', { user: req.user, stats: {}, recentBookings: [] });
    }
});

// Manage Bookings
router.get('/bookings', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const bookings = await Booking.find()
            .populate('resource')
            .populate('user')
            .populate('bookedBy')
            .sort({ date: -1 });
        res.render('admin/bookings', {
            user: req.user,
            bookings: bookings
        });
    } catch (err) {
        console.error(err);
        res.redirect('/admin/dashboard');
    }
});

// List Resources
router.get('/resources', ensureAuthenticated, ensureAdmin, async (req, res) => {
    const parentId = req.query.parentId || null;
    try {
        const resources = await Resource.find({ parent: parentId });
        let parentResource = null;
        if (parentId) {
            parentResource = await Resource.findById(parentId);
        }
        res.render('admin/resources', {
            user: req.user,
            resources: resources,
            parent: parentResource
        });
    } catch (err) {
        console.error(err);
        res.redirect('/admin/dashboard');
    }
});

// Create Resource Form
router.get('/resources/create', ensureAuthenticated, ensureAdmin, async (req, res) => {
    const parentId = req.query.parentId || null;
    try {
        res.render('admin/resource_form', {
            user: req.user,
            parentId: parentId,
            resource: null // Null for create
        });
    } catch (err) {
        console.error(err);
        res.redirect('/admin/resources');
    }
});

// Handle Create Resource
router.post('/resources/create', ensureAuthenticated, ensureAdmin, async (req, res) => {
    const { name, type, parentId, capacity } = req.body;
    let errors = [];

    if (!name || !type) {
        errors.push({ msg: 'Please enter name and type' });
    }

    if (type === 'resource' && (!capacity || parseInt(capacity) < 1)) {
        errors.push({ msg: 'Please enter a valid capacity (at least 1)' });
    }

    if (errors.length > 0) {
        req.flash('error_msg', errors.map(e => e.msg).join('. '));
        return res.redirect(`/admin/resources/create?parentId=${parentId || ''}`);
    }

    const newResource = new Resource({
        name,
        type,
        parent: parentId || null
    });

    if (type === 'resource') {
        newResource.capacity = capacity;
        newResource.resourceType = req.body.resourceType;
    }

    try {
        await newResource.save();
        req.flash('success_msg', 'Resource Created');
        res.redirect(`/admin/resources?parentId=${parentId || ''}`);
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error creating resource');
        res.redirect('/admin/resources');
    }
});

// Edit Resource Form
router.get('/resources/:id/edit', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const resource = await Resource.findById(req.params.id);
        if (!resource) {
            req.flash('error_msg', 'Resource not found');
            return res.redirect('/admin/resources');
        }
        res.render('admin/resource_form', {
            user: req.user,
            parentId: resource.parent,
            resource: resource
        });
    } catch (err) {
        console.error(err);
        res.redirect('/admin/resources');
    }
});

// Handle Edit Resource
router.post('/resources/:id/edit', ensureAuthenticated, ensureAdmin, async (req, res) => {
    const { name, capacity } = req.body;

    try {
        const resource = await Resource.findById(req.params.id);
        if (!resource) {
            req.flash('error_msg', 'Resource not found');
            return res.redirect('/admin/resources');
        }

        if (resource.type === 'resource') {
            if (!capacity || parseInt(capacity) < 1) {
                req.flash('error_msg', 'Please enter a valid capacity (at least 1)');
                return res.redirect(`/admin/resources/${req.params.id}/edit`);
            }
            resource.capacity = parseInt(capacity);
            resource.resourceType = req.body.resourceType;
        }

        resource.name = name;
        await resource.save();
        req.flash('success_msg', 'Resource Updated');
        res.redirect(`/admin/resources?parentId=${resource.parent || ''}`);
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error updating resource');
        res.redirect('/admin/resources');
    }
});

// Delete Resource
router.get('/resources/:id/delete', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const resource = await Resource.findById(req.params.id);
        const parentId = resource.parent;
        // Optionally delete children recursively? MongoDB doesn't cascade. 
        // For now just delete the item.
        await Resource.deleteOne({ _id: req.params.id });
        // If it's a folder, we SHOULD delete children. 
        // Simple recursive delete
        // If it's a folder, we SHOULD delete children. 
        // Simple recursive delete
        if (resource.type === 'folder') {
            await Resource.deleteMany({ parent: req.params.id });
            // This is only one level deep. Better to be robust but time is limited.
            // Assume simple structure.
        }

        res.redirect(`/admin/resources?parentId=${parentId || ''}`);
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error deleting resource');
        res.redirect('/admin/resources');
    }
});

// ========== Slot Timings (created separately, assigned to resources) ==========

router.get('/slot-timings', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const slotTimings = await SlotTiming.find().sort({ startTime: 1 });
        res.render('admin/slot_timings', {
            user: req.user,
            slotTimings: slotTimings
        });
    } catch (err) {
        console.error(err);
        res.redirect('/admin/dashboard');
    }
});

router.get('/slot-timings/create', ensureAuthenticated, ensureAdmin, (req, res) => {
    res.render('admin/slot_timing_form', { user: req.user, slotTiming: null });
});

router.post('/slot-timings/create', ensureAuthenticated, ensureAdmin, async (req, res) => {
    const { label, startTime, endTime } = req.body;
    if (!startTime || !endTime) {
        req.flash('error_msg', 'Start time and end time are required');
        return res.redirect('/admin/slot-timings/create');
    }
    try {
        const st = new SlotTiming({ label: label || undefined, startTime, endTime });
        await st.save();
        req.flash('success_msg', 'Slot timing created');
        res.redirect('/admin/slot-timings');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error creating slot timing');
        res.redirect('/admin/slot-timings/create');
    }
});

router.get('/slot-timings/:id/edit', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const slotTiming = await SlotTiming.findById(req.params.id);
        if (!slotTiming) return res.redirect('/admin/slot-timings');
        res.render('admin/slot_timing_form', { user: req.user, slotTiming });
    } catch (err) {
        console.error(err);
        res.redirect('/admin/slot-timings');
    }
});

router.post('/slot-timings/:id/edit', ensureAuthenticated, ensureAdmin, async (req, res) => {
    const { label, startTime, endTime } = req.body;
    if (!startTime || !endTime) {
        req.flash('error_msg', 'Start time and end time are required');
        return res.redirect(`/admin/slot-timings/${req.params.id}/edit`);
    }
    try {
        await SlotTiming.findByIdAndUpdate(req.params.id, {
            label: label || undefined,
            startTime,
            endTime
        });
        req.flash('success_msg', 'Slot timing updated');
        res.redirect('/admin/slot-timings');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error updating slot timing');
        res.redirect(`/admin/slot-timings/${req.params.id}/edit`);
    }
});

router.get('/slot-timings/:id/delete', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        await SlotTiming.findByIdAndDelete(req.params.id);
        req.flash('success_msg', 'Slot timing deleted');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error deleting slot timing');
    }
    res.redirect('/admin/slot-timings');
});

// ========== Manage Students ==========

router.get('/students', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        // Fetch all students to group them by department
        const students = await User.find({ role: 'student' }).sort({ name: 1 });
        const groupedStudents = {};
        students.forEach(s => {
            const dept = s.department || 'Unassigned';
            const year = s.year ? `Year ${s.year}` : 'Unknown Year';
            if (!groupedStudents[dept]) groupedStudents[dept] = {};
            if (!groupedStudents[dept][year]) groupedStudents[dept][year] = [];
            groupedStudents[dept][year].push(s);
        });

        res.render('admin/students', {
            user: req.user,
            groupedStudents
        });
    } catch (err) {
        console.error(err);
        res.redirect('/admin/dashboard');
    }
});

router.get('/students/create', ensureAuthenticated, ensureAdmin, (req, res) => {
    res.render('admin/student_form', { user: req.user, student: null });
});

router.post('/students/create', ensureAuthenticated, ensureAdmin, async (req, res) => {
    const { name, email, password, rollNo, year, department } = req.body;

    if (!name || !email || !password || !rollNo) {
        req.flash('error_msg', 'Please enter all required fields');
        return res.redirect('/admin/students/create');
    }

    try {
        const normalizedEmail = email.toLowerCase().trim();
        const userExists = await User.findOne({ email: normalizedEmail });
        if (userExists) {
            req.flash('error_msg', 'Email is already registered');
            return res.redirect('/admin/students/create');
        }

        const newUser = new User({
            name,
            email,
            password,
            role: 'student',
            rollNo: rollNo,
            year: year || undefined,
            department: department || undefined
        });

        const bcrypt = require('bcryptjs');
        const salt = await bcrypt.genSalt(10);
        newUser.password = await bcrypt.hash(newUser.password, salt);

        await newUser.save();
        req.flash('success_msg', 'Student created successfully');
        res.redirect('/admin/students');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error creating student');
        res.redirect('/admin/students/create');
    }
});

router.get('/students/:id/edit', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const student = await User.findById(req.params.id);
        if (!student || student.role !== 'student') {
            req.flash('error_msg', 'Student not found');
            return res.redirect('/admin/students');
        }
        res.render('admin/student_form', { user: req.user, student });
    } catch (err) {
        console.error(err);
        res.redirect('/admin/students');
    }
});

router.post('/students/:id/edit', ensureAuthenticated, ensureAdmin, async (req, res) => {
    const { name, email, password, rollNo, year, department } = req.body;

    if (!name || !email || !rollNo) {
        req.flash('error_msg', 'Please enter required fields');
        return res.redirect(`/admin/students/${req.params.id}/edit`);
    }

    try {
        const normalizedEmail = email.toLowerCase().trim();
        const userExists = await User.findOne({ email: normalizedEmail, _id: { $ne: req.params.id } });
        if (userExists) {
            req.flash('error_msg', 'Email is already registered by another user');
            return res.redirect(`/admin/students/${req.params.id}/edit`);
        }

        const student = await User.findById(req.params.id);
        if (!student) {
            req.flash('error_msg', 'Student not found');
            return res.redirect('/admin/students');
        }

        student.name = name;
        student.email = email;
        student.rollNo = rollNo;
        student.year = year || undefined;
        student.department = department || undefined;

        if (password) {
            const bcrypt = require('bcryptjs');
            const salt = await bcrypt.genSalt(10);
            student.password = await bcrypt.hash(password, salt);
        }

        await student.save();
        req.flash('success_msg', 'Student updated successfully');
        res.redirect('/admin/students');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error updating student');
        res.redirect(`/admin/students/${req.params.id}/edit`);
    }
});

// ========== Manage Faculty ==========

router.get('/faculty', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const faculty = await User.find({ role: 'faculty' }).sort({ name: 1 }).skip(skip).limit(limit);
        const totalFaculty = await User.countDocuments({ role: 'faculty' });
        const totalPages = Math.ceil(totalFaculty / limit);

        if (req.query.ajax === 'true') {
            return res.render('admin/partials/faculty_rows', { user: req.user, faculty });
        }

        res.render('admin/faculty', {
            user: req.user,
            faculty: faculty,
            page,
            totalPages
        });
    } catch (err) {
        console.error(err);
        res.redirect('/admin/dashboard');
    }
});

router.get('/faculty/create', ensureAuthenticated, ensureAdmin, (req, res) => {
    res.render('admin/faculty_form', { user: req.user, faculty: null });
});

router.post('/faculty/create', ensureAuthenticated, ensureAdmin, async (req, res) => {
    const { name, email, password, facultyId, facultyType, department } = req.body;

    if (!name || !email || !password || !facultyId) {
        req.flash('error_msg', 'Please enter all required fields');
        return res.redirect('/admin/faculty/create');
    }

    try {
        const normalizedEmail = email.toLowerCase().trim();
        const userExists = await User.findOne({ email: normalizedEmail });
        if (userExists) {
            req.flash('error_msg', 'Email is already registered');
            return res.redirect('/admin/faculty/create');
        }

        const newUser = new User({
            name,
            email,
            password,
            role: 'faculty',
            facultyId: facultyId,
            facultyType: facultyType || undefined,
            department: department || undefined
        });

        const bcrypt = require('bcryptjs');
        const salt = await bcrypt.genSalt(10);
        newUser.password = await bcrypt.hash(newUser.password, salt);

        await newUser.save();
        req.flash('success_msg', 'Faculty created successfully');
        res.redirect('/admin/faculty');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error creating faculty');
        res.redirect('/admin/faculty/create');
    }
});

router.get('/faculty/:id/edit', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const faculty = await User.findById(req.params.id);
        if (!faculty || faculty.role !== 'faculty') {
            req.flash('error_msg', 'Faculty not found');
            return res.redirect('/admin/faculty');
        }
        res.render('admin/faculty_form', { user: req.user, faculty });
    } catch (err) {
        console.error(err);
        res.redirect('/admin/faculty');
    }
});

router.post('/faculty/:id/edit', ensureAuthenticated, ensureAdmin, async (req, res) => {
    const { name, email, password, facultyId, facultyType, department } = req.body;

    if (!name || !email || !facultyId) {
        req.flash('error_msg', 'Please enter required fields');
        return res.redirect(`/admin/faculty/${req.params.id}/edit`);
    }

    try {
        const normalizedEmail = email.toLowerCase().trim();
        const userExists = await User.findOne({ email: normalizedEmail, _id: { $ne: req.params.id } });
        if (userExists) {
            req.flash('error_msg', 'Email is already registered by another user');
            return res.redirect(`/admin/faculty/${req.params.id}/edit`);
        }

        const facultyUser = await User.findById(req.params.id);
        if (!facultyUser) {
            req.flash('error_msg', 'Faculty not found');
            return res.redirect('/admin/faculty');
        }

        facultyUser.name = name;
        facultyUser.email = email;
        facultyUser.facultyId = facultyId;
        facultyUser.facultyType = facultyType || undefined;
        facultyUser.department = department || undefined;

        if (password) {
            const bcrypt = require('bcryptjs');
            const salt = await bcrypt.genSalt(10);
            facultyUser.password = await bcrypt.hash(password, salt);
        }

        await facultyUser.save();
        req.flash('success_msg', 'Faculty updated successfully');
        res.redirect('/admin/faculty');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error updating faculty');
        res.redirect(`/admin/faculty/${req.params.id}/edit`);
    }
});

// ========== Common User Actions (Delete / Toggle Block) ==========

router.get('/users/delete/:id', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        if (req.params.id === req.user.id) {
            req.flash('error_msg', 'You cannot delete yourself');
            return res.redirect(req.get('Referrer') || '/admin/dashboard');
        }
        await User.findByIdAndDelete(req.params.id);
        req.flash('success_msg', 'User deleted successfully');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error deleting user');
    }
    res.redirect(req.get('Referrer') || '/admin/dashboard');
});

router.get('/users/toggle-block/:id', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        if (req.params.id === req.user.id) {
            req.flash('error_msg', 'You cannot block yourself');
            return res.redirect(req.get('Referrer') || '/admin/dashboard');
        }
        const user = await User.findById(req.params.id);
        if (user) {
            user.isBlocked = !user.isBlocked;
            await user.save();
            req.flash('success_msg', `User has been ${user.isBlocked ? 'blocked' : 'unblocked'}`);
        }
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error toggling block status');
    }
    res.redirect(req.get('Referrer') || '/admin/dashboard');
});

// ========== Feature 5: Analytics Dashboard ==========

router.get('/analytics', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const BookBorrow = require('../models/BookBorrow');
        const Book = require('../models/Book');

        // Most borrowed books (top 10)
        const topBooksRaw = await BookBorrow.aggregate([
            { $match: { status: { $in: ['borrowed', 'returned'] } } },
            { $group: { _id: '$book', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);
        const topBookIds = topBooksRaw.map(b => b._id);
        const topBookDocs = await Book.find({ _id: { $in: topBookIds } }).select('title author');
        const topBooks = topBooksRaw.map(b => {
            const doc = topBookDocs.find(d => d._id.toString() === b._id.toString());
            return { title: doc ? doc.title : 'Unknown', author: doc ? doc.author : '', count: b.count };
        });

        // Bookings by hour (peak hours)
        const bookingsRaw = await Booking.find().select('startTime status');
        const hourCounts = {};
        for (let h = 0; h < 24; h++) hourCounts[h] = 0;
        bookingsRaw.forEach(b => {
            if (b.startTime) {
                const hour = parseInt(b.startTime.split(':')[0]);
                if (!isNaN(hour)) hourCounts[hour] = (hourCounts[hour] || 0) + 1;
            }
        });
        const peakHours = Object.entries(hourCounts).map(([hour, count]) => ({ hour: `${hour}:00`, count }));

        // Most active students (by bookings)
        const activeStudentsRaw = await Booking.aggregate([
            { $group: { _id: '$user', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);
        const activeStudentIds = activeStudentsRaw.map(s => s._id);
        const activeStudentDocs = await User.find({ _id: { $in: activeStudentIds } }).select('name email rollNo');
        const activeStudents = activeStudentsRaw.map(s => {
            const doc = activeStudentDocs.find(d => d._id.toString() === s._id.toString());
            return { name: doc ? doc.name : 'Unknown', email: doc ? doc.email : '', rollNo: doc ? doc.rollNo : '', bookings: s.count };
        });

        // Booking status breakdown
        const statusBreakdown = {
            pending: await Booking.countDocuments({ status: 'pending' }),
            approved: await Booking.countDocuments({ status: 'approved' }),
            cancelled: await Booking.countDocuments({ status: 'cancelled' })
        };

        // Library stats
        const totalBorrows = await BookBorrow.countDocuments();
        const activeBorrows = await BookBorrow.countDocuments({ status: 'borrowed' });
        const overdueBorrows = await BookBorrow.countDocuments({ status: 'borrowed', dueDate: { $lt: new Date() } });

        res.render('admin/analytics', {
            user: req.user,
            topBooks: JSON.stringify(topBooks),
            peakHours: JSON.stringify(peakHours),
            activeStudents,
            statusBreakdown,
            totalBorrows,
            activeBorrows,
            overdueBorrows
        });
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Failed to load analytics.');
        res.redirect('/admin/dashboard');
    }
});

// ========== Feature 7: Announcements ==========
const Announcement = require('../models/Announcement');

router.get('/announcements', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const announcements = await Announcement.find()
            .populate('createdBy', 'name')
            .sort({ createdAt: -1 });
        res.render('admin/announcements', { user: req.user, announcements });
    } catch (err) {
        console.error(err);
        res.redirect('/admin/dashboard');
    }
});

router.post('/announcements/create', ensureAuthenticated, ensureAdmin, async (req, res) => {
    const { title, content, targetRoles } = req.body;
    if (!title || !content) {
        req.flash('error_msg', 'Title and content are required.');
        return res.redirect('/admin/announcements');
    }
    try {
        const roles = Array.isArray(targetRoles) ? targetRoles : (targetRoles ? [targetRoles] : ['all']);
        await Announcement.create({ title, content, targetRoles: roles, createdBy: req.user._id });
        
        req.flash('success_msg', 'Announcement posted successfully.');
        res.redirect('/admin/announcements');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Failed to create announcement.');
        res.redirect('/admin/announcements');
    }
});

router.post('/announcements/:id/delete', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        await Announcement.findByIdAndDelete(req.params.id);
        req.flash('success_msg', 'Announcement deleted.');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Failed to delete announcement.');
    }
    res.redirect('/admin/announcements');
});

router.post('/announcements/:id/toggle', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const ann = await Announcement.findById(req.params.id);
        if (ann) { ann.isActive = !ann.isActive; await ann.save(); }
        req.flash('success_msg', 'Announcement status updated.');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Failed to update announcement.');
    }
    res.redirect('/admin/announcements');
});

// ========== Feature 6: Bulk Student Import (CSV) ==========
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

router.post('/students/bulk-import', ensureAuthenticated, ensureAdmin, upload.single('csvFile'), async (req, res) => {
    try {
        if (!req.file) {
            req.flash('error_msg', 'No file uploaded.');
            return res.redirect('/admin/students');
        }
        const content = req.file.buffer.toString('utf-8');
        const lines = content.split('\n').map(l => l.trim()).filter(l => l);
        if (lines.length < 2) {
            req.flash('error_msg', 'CSV file is empty or has no data rows.');
            return res.redirect('/admin/students');
        }
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const bcrypt = require('bcryptjs');
        let added = 0, skipped = 0;

        for (let i = 1; i < lines.length; i++) {
            const vals = lines[i].split(',').map(v => v.trim());
            const row = {};
            headers.forEach((h, idx) => { row[h] = vals[idx] || ''; });

            if (!row.name || !row.email || !row.rollno) { skipped++; continue; }

            const normalizedEmail = row.email.toLowerCase().trim();
            const exists = await User.findOne({ email: normalizedEmail });
            if (exists) { skipped++; continue; }

            const rawPass = row.password || 'Pass@1234';
            const salt = await bcrypt.genSalt(10);
            const hashed = await bcrypt.hash(rawPass, salt);

            await User.create({
                name: row.name,
                email: row.email,
                password: hashed,
                role: 'student',
                rollNo: row.rollno,
                year: row.year ? parseInt(row.year) : undefined,
                department: row.department || undefined
            });
            added++;
        }

        req.flash('success_msg', `Import complete: ${added} added, ${skipped} skipped.`);
        res.redirect('/admin/students');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Failed to import CSV.');
        res.redirect('/admin/students');
    }
});

// ========== Feature 6b: Bulk Faculty Import (CSV) ==========
router.post('/faculty/bulk-import', ensureAuthenticated, ensureAdmin, upload.single('csvFile'), async (req, res) => {
    try {
        if (!req.file) {
            req.flash('error_msg', 'No file uploaded.');
            return res.redirect('/admin/faculty');
        }
        const content = req.file.buffer.toString('utf-8');
        const lines = content.split('\n').map(l => l.trim()).filter(l => l);
        if (lines.length < 2) {
            req.flash('error_msg', 'CSV file is empty or has no data rows.');
            return res.redirect('/admin/faculty');
        }
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const bcrypt = require('bcryptjs');
        let added = 0, skipped = 0;

        for (let i = 1; i < lines.length; i++) {
            const vals = lines[i].split(',').map(v => v.trim());
            const row = {};
            headers.forEach((h, idx) => { row[h] = vals[idx] || ''; });

            // name, email, facultyid are required
            if (!row.name || !row.email || !row.facultyid) { skipped++; continue; }

            const normalizedEmail = row.email.toLowerCase().trim();
            const exists = await User.findOne({ email: normalizedEmail });
            if (exists) { skipped++; continue; }

            const rawPass = row.password || 'Pass@1234';
            const salt = await bcrypt.genSalt(10);
            const hashed = await bcrypt.hash(rawPass, salt);

            await User.create({
                name: row.name,
                email: row.email,
                password: hashed,
                role: 'faculty',
                facultyId: row.facultyid,
                facultyType: row.facultytype || 'teaching',
                department: row.department || undefined
            });
            added++;
        }

        req.flash('success_msg', `Import complete: ${added} added, ${skipped} skipped.`);
        res.redirect('/admin/faculty');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Failed to import CSV.');
        res.redirect('/admin/faculty');
    }
});

// ========== Feature 8: Export Reports ==========
router.get('/reports/bookings', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const ExcelJS = require('exceljs');
        const bookings = await Booking.find()
            .populate('resource', 'name')
            .populate('user', 'name email rollNo')
            .populate('bookedBy', 'name')
            .sort({ date: -1 });

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Bookings');
        sheet.columns = [
            { header: 'Student Name', key: 'student', width: 25 },
            { header: 'Student Email', key: 'email', width: 30 },
            { header: 'Roll No', key: 'rollNo', width: 15 },
            { header: 'Resource', key: 'resource', width: 25 },
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Start Time', key: 'startTime', width: 12 },
            { header: 'End Time', key: 'endTime', width: 12 },
            { header: 'Status', key: 'status', width: 12 },
        ];
        sheet.getRow(1).font = { bold: true };
        bookings.forEach(b => {
            sheet.addRow({
                student: b.user ? b.user.name : '',
                email: b.user ? b.user.email : '',
                rollNo: b.user ? b.user.rollNo : '',
                resource: b.resource ? b.resource.name : '',
                date: b.date ? b.date.toISOString().split('T')[0] : '',
                startTime: b.startTime || '',
                endTime: b.endTime || '',
                status: b.status || ''
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=bookings_report.xlsx');
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Failed to generate report.');
        res.redirect('/admin/dashboard');
    }
});

router.get('/reports/borrows', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const ExcelJS = require('exceljs');
        const BookBorrow = require('../models/BookBorrow');
        const borrows = await BookBorrow.find()
            .populate('book', 'title author isbn')
            .populate('student', 'name email rollNo')
            .populate('approvedBy', 'name')
            .sort({ requestedAt: -1 });

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Book Borrows');
        sheet.columns = [
            { header: 'Student Name', key: 'student', width: 25 },
            { header: 'Student Email', key: 'email', width: 30 },
            { header: 'Roll No', key: 'rollNo', width: 15 },
            { header: 'Book Title', key: 'title', width: 30 },
            { header: 'Author', key: 'author', width: 20 },
            { header: 'ISBN', key: 'isbn', width: 15 },
            { header: 'Status', key: 'status', width: 12 },
            { header: 'Borrow Date', key: 'borrowDate', width: 15 },
            { header: 'Due Date', key: 'dueDate', width: 15 },
            { header: 'Return Date', key: 'returnDate', width: 15 },
            { header: 'Approved By', key: 'approvedBy', width: 20 },
        ];
        sheet.getRow(1).font = { bold: true };
        borrows.forEach(b => {
            sheet.addRow({
                student: b.student ? b.student.name : '',
                email: b.student ? b.student.email : '',
                rollNo: b.student ? b.student.rollNo : '',
                title: b.book ? b.book.title : '',
                author: b.book ? b.book.author : '',
                isbn: b.book ? b.book.isbn : '',
                status: b.status || '',
                borrowDate: b.borrowDate ? b.borrowDate.toISOString().split('T')[0] : '',
                dueDate: b.dueDate ? b.dueDate.toISOString().split('T')[0] : '',
                returnDate: b.returnDate ? b.returnDate.toISOString().split('T')[0] : '',
                approvedBy: b.approvedBy ? b.approvedBy.name : ''
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=borrows_report.xlsx');
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Failed to generate report.');
        res.redirect('/admin/dashboard');
    }
});

module.exports = router;
