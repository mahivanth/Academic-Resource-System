const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../config/auth');
const Notification = require('../models/Notification');

// View all notifications
router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        const notifications = await Notification.find({ user: req.user._id })
            .sort({ createdAt: -1 });

        res.render('notifications/index', {
            user: req.user,
            notifications
        });
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error fetching notifications');
        res.redirect('/dashboard');
    }
});

// API Get unread notifications
router.get('/api/unread', ensureAuthenticated, async (req, res) => {
    try {
        const notifications = await Notification.find({ user: req.user._id, read: false })
            .sort({ createdAt: -1 })
            .limit(5);
        res.json({ notifications });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

// Mark single notification as read
router.post('/:id/read', ensureAuthenticated, async (req, res) => {
    try {
        const notification = await Notification.findById(req.params.id);
        if (notification && notification.user.toString() === req.user._id.toString()) {
            notification.read = true;
            await notification.save();
        }
        res.redirect('back');
    } catch (err) {
        console.error(err);
        res.redirect('back');
    }
});

// Mark all as read
router.post('/mark-all-read', ensureAuthenticated, async (req, res) => {
    try {
        await Notification.updateMany(
            { user: req.user._id, read: false },
            { $set: { read: true } }
        );
        req.flash('success_msg', 'All notifications marked as read');
        res.redirect('/notifications');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error updating notifications');
        res.redirect('back');
    }
});

// Delete single notification
router.post('/:id/delete', ensureAuthenticated, async (req, res) => {
    try {
        const notification = await Notification.findById(req.params.id);
        if (notification && notification.user.toString() === req.user._id.toString()) {
            await notification.deleteOne();
        }
        res.redirect('back');
    } catch (err) {
        console.error(err);
        res.redirect('back');
    }
});

// Delete all notifications
router.post('/delete-all', ensureAuthenticated, async (req, res) => {
    try {
        await Notification.deleteMany({ user: req.user._id });
        req.flash('success_msg', 'All notifications deleted');
        res.redirect('/notifications');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error deleting notifications');
        res.redirect('back');
    }
});

module.exports = router;
