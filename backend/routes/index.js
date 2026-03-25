const express = require('express');
const router = express.Router();
const { ensureAuthenticated, forwardAuthenticated } = require('../config/auth');
const Announcement = require('../models/Announcement');

// Welcome Page -> Redirect to Login
router.get('/', forwardAuthenticated, (req, res) => res.redirect('/users/login'));

// Dashboard (Protected)
router.get('/dashboard', ensureAuthenticated, (req, res) => {
    // Redirect based on role
    if (req.user.role === 'admin') {
        res.redirect('/admin/dashboard');
    } else if (req.user.role === 'faculty') {
        // Librarian gets their own portal
        const isLibrarian = req.user.facultyType === 'non-teaching' &&
            req.user.department &&
            req.user.department.toLowerCase().includes('librar');
        if (isLibrarian) {
            res.redirect('/library/manage');
        } else {
            res.redirect('/faculty/dashboard');
        }
    } else {
        res.redirect('/student/dashboard'); // Student
    }
});

// Auth Routes (Login/Register/Google)
router.use('/users', require('./users'));
router.use('/auth', require('./auth')); // Separate file for google auth clarity

// Role based Application Routes
router.use('/admin', require('./admin'));
router.use('/faculty', require('./faculty'));
router.use('/student', require('./student'));
router.use('/resources', require('./resources'));
router.use('/bookings', require('./bookings'));

// Announcements Route for all users
router.get('/announcements', ensureAuthenticated, async (req, res) => {
    try {
        const announcements = await Announcement.find({
            isActive: true,
            $or: [
                { targetRoles: 'all' },
                { targetRoles: req.user.role }
            ]
        }).populate('createdBy', 'name').sort({ createdAt: -1 });
        
        // Mark as read
        await Announcement.updateMany(
            { 
                isActive: true, 
                $or: [{ targetRoles: 'all' }, { targetRoles: req.user.role }],
                readBy: { $ne: req.user._id }
            },
            { $addToSet: { readBy: req.user._id } }
        );
        
        res.render('announcements', {
            user: req.user,
            announcements: announcements
        });
    } catch (err) {
        console.error(err);
        res.redirect('/dashboard');
    }
});

// Profile Route
router.get('/profile', ensureAuthenticated, async (req, res) => {
    try {
        // Notifications removed
        res.render('profile', {
            user: req.user,
            notifications: [] // Empty array
        });
    } catch (err) {
        console.error(err);
        res.redirect('/dashboard');
    }
});

// Dismiss Notification removed

module.exports = router;
