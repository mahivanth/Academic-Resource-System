const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../config/auth');
const Booking = require('../models/Booking');
const BookBorrow = require('../models/BookBorrow');
const Fine = require('../models/Fine');

router.get('/dashboard', ensureAuthenticated, async (req, res) => {
    try {
        const bookings = await Booking.find({ user: req.user._id })
            .populate('resource')
            .sort({ date: -1 });

        const stats = {
            total: bookings.length,
            approved: bookings.filter(b => b.status === 'approved').length,
            pending: bookings.filter(b => b.status === 'pending').length,
            cancelled: bookings.filter(b => b.status === 'cancelled').length
        };

        const calendarEvents = bookings.map(b => {
            let dateStr = '';
            if (b.date) {
                dateStr = b.date.toISOString().split('T')[0];
            }
            
            let color = '#3b82f6';
            if (b.status === 'approved') color = '#10b981';
            if (b.status === 'cancelled') color = '#ef4444';
            if (b.status === 'pending') color = '#f59e0b';
            
            return {
                title: b.resource ? b.resource.name : 'Booking',
                start: dateStr && b.startTime ? `${dateStr}T${b.startTime}` : dateStr,
                end: dateStr && b.endTime ? `${dateStr}T${b.endTime}` : dateStr,
                color: color,
                extendedProps: {
                    status: b.status
                }
            };
        });

        res.render('student/dashboard', {
            user: req.user,
            bookings: bookings,
            stats: stats,
            calendarEvents: JSON.stringify(calendarEvents)
        });
    } catch (err) {
        console.error(err);
        res.render('student/dashboard', { user: req.user, bookings: [] });
    }
});

// ── Feature 1: My Borrowing History ──────────────────────────────
router.get('/borrow-history', ensureAuthenticated, async (req, res) => {
    if (req.user.role !== 'student') return res.redirect('/dashboard');
    try {
        const borrows = await BookBorrow.find({ student: req.user._id })
            .populate('book', 'title author isbn category')
            .populate('approvedBy', 'name')
            .sort({ requestedAt: -1 });

        const now = new Date();
        const enriched = borrows.map(b => {
            let overdueDays = 0;
            if (b.status === 'borrowed' && b.dueDate && b.dueDate < now) {
                overdueDays = Math.floor((now - b.dueDate) / (1000 * 60 * 60 * 24));
            }
            return { ...b.toObject(), overdueDays };
        });

        res.render('student/borrow_history', { user: req.user, borrows: enriched });
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Failed to load borrow history.');
        res.redirect('/student/dashboard');
    }
});

// ── Feature 3: Booking History ────────────────────────────────────
router.get('/booking-history', ensureAuthenticated, async (req, res) => {
    if (req.user.role !== 'student') return res.redirect('/dashboard');
    try {
        const bookings = await Booking.find({ user: req.user._id })
            .populate('resource')
            .sort({ date: -1 });

        res.render('student/booking_history', { user: req.user, bookings });
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Failed to load booking history.');
        res.redirect('/student/dashboard');
    }
});

// ── Feature 4: Fines & Due Date Tracker ───────────────────────────
router.get('/fines', ensureAuthenticated, async (req, res) => {
    if (req.user.role !== 'student') return res.redirect('/dashboard');
    try {
        const now = new Date();
        // Active borrows with due dates
        const activeBorrows = await BookBorrow.find({
            student: req.user._id,
            status: 'borrowed'
        }).populate('book', 'title author');

        const overdue = activeBorrows.filter(b => b.dueDate && b.dueDate < now).map(b => {
            const daysOverdue = Math.floor((now - b.dueDate) / (1000 * 60 * 60 * 24));
            const fineAmount = daysOverdue * 2; // ₹2 per day
            return { ...b.toObject(), daysOverdue, fineAmount };
        });

        const upcoming = activeBorrows.filter(b => b.dueDate && b.dueDate >= now).map(b => {
            const daysLeft = Math.ceil((b.dueDate - now) / (1000 * 60 * 60 * 24));
            return { ...b.toObject(), daysLeft };
        });

        // Paid/settled fines
        const fines = await Fine.find({ student: req.user._id })
            .populate({ path: 'borrow', populate: { path: 'book', select: 'title author' } })
            .sort({ createdAt: -1 });

        res.render('student/fines', { user: req.user, overdue, upcoming, fines });
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Failed to load fines.');
        res.redirect('/student/dashboard');
    }
});

module.exports = router;
