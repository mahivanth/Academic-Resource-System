const express = require('express');
const router = express.Router();
const { ensureAuthenticated, ensureFaculty } = require('../config/auth');
const Resource = require('../models/Resource');
const Booking = require('../models/Booking');

// Dashboard - Assigned Resources & My Bookings
router.get('/dashboard', ensureAuthenticated, ensureFaculty, async (req, res) => {
    try {
        // Find resources assigned to this faculty
        const assignedResources = await Resource.find({ 'slotTimings.assignedFaculty': req.user._id }).populate('slotTimings.slotTiming');
        const resourceIds = assignedResources.map(r => r._id);
        const allBookings = await Booking.find({ resource: { $in: resourceIds } }).populate('resource').populate('user');

        // Filter bookings for this faculty's valid slots
        const bookings = allBookings.filter(booking => {
            const resourceId = booking.resource && booking.resource._id ? booking.resource._id.toString() : booking.resource.toString();
            const resource = assignedResources.find(r => r._id.toString() === resourceId);
            if (!resource) return false;
            
            const st = (slot) => slot.slotTiming && typeof slot.slotTiming === 'object'
                ? { startTime: slot.slotTiming.startTime, endTime: slot.slotTiming.endTime }
                : { startTime: slot.startTime, endTime: slot.endTime };
                
            const matchingSlot = resource.slotTimings.find(slot => {
                const t = st(slot);
                return t.startTime === booking.startTime && t.endTime === booking.endTime;
            });
            
            if (matchingSlot && matchingSlot.assignedFaculty.some(id => id.toString() === req.user._id.toString())) {
                return true;
            }
            return false;
        });

        const stats = {
            totalRequests: bookings.length,
            pendingRequests: bookings.filter(b => b.status === 'pending').length,
            approvedRequests: bookings.filter(b => b.status === 'approved').length,
            resourcesCount: assignedResources.length
        };

        const calendarEvents = bookings.map(b => {
            let dateStr = '';
            if (b.date) dateStr = b.date.toISOString().split('T')[0];
            
            let color = '#3b82f6';
            if (b.status === 'approved') color = '#10b981';
            if (b.status === 'cancelled') color = '#ef4444';
            if (b.status === 'pending') color = '#f59e0b';
            
            return {
                title: (b.resource ? b.resource.name : 'Booking') + (b.user ? ` - ${b.user.name}` : ''),
                start: dateStr && b.startTime ? `${dateStr}T${b.startTime}` : dateStr,
                end: dateStr && b.endTime ? `${dateStr}T${b.endTime}` : dateStr,
                color: color,
                extendedProps: {
                    status: b.status,
                    student: b.user ? b.user.name : 'Unknown'
                }
            };
        });

        res.render('faculty/dashboard', {
            user: req.user,
            assignedResources: assignedResources,
            stats: stats,
            calendarEvents: JSON.stringify(calendarEvents)
        });
    } catch (err) {
        console.error(err);
        res.redirect('/');
    }
});

// View Assigned Resources
router.get('/resources', ensureAuthenticated, ensureFaculty, async (req, res) => {
    try {
        const assignedResources = await Resource.find({ 'slotTimings.assignedFaculty': req.user._id }).populate('slotTimings.slotTiming');

        res.render('faculty/resources', {
            user: req.user,
            assignedResources: assignedResources
        });
    } catch (err) {
        console.error(err);
        res.redirect('/faculty/dashboard');
    }
});

// View Booking Requests
router.get('/requests', ensureAuthenticated, ensureFaculty, async (req, res) => {
    try {
        // Find resources assigned to this faculty
        const assignedResources = await Resource.find({ 'slotTimings.assignedFaculty': req.user._id }).populate('slotTimings.slotTiming');
        const resourceIds = assignedResources.map(r => r._id);

        // Find bookings for these resources
        const allBookings = await Booking.find({ resource: { $in: resourceIds } })
            .populate('resource')
            .populate('user')
            .sort({ date: -1 });

        // Filter bookings for this faculty's valid slots
        const bookings = allBookings.filter(booking => {
            const resourceId = booking.resource && booking.resource._id ? booking.resource._id.toString() : booking.resource.toString();
            const resource = assignedResources.find(r => r._id.toString() === resourceId);
            if (!resource) return false;

            const st = (slot) => slot.slotTiming && typeof slot.slotTiming === 'object'
                ? { startTime: slot.slotTiming.startTime, endTime: slot.slotTiming.endTime }
                : { startTime: slot.startTime, endTime: slot.endTime };
                
            const matchingSlot = resource.slotTimings.find(slot => {
                const t = st(slot);
                return t.startTime === booking.startTime && t.endTime === booking.endTime;
            });
            
            if (matchingSlot && matchingSlot.assignedFaculty.some(id => id.toString() === req.user._id.toString())) {
                return true;
            }
            return false;
        });

        res.render('faculty/requests', {
            user: req.user,
            bookings: bookings
        });
    } catch (err) {
        console.error(err);
        res.redirect('/faculty/dashboard');
    }
});

// ── Feature 13: Slot Notes ────────────────────────────────────
const SlotNote = require('../models/SlotNote');

router.get('/slot-notes', ensureAuthenticated, ensureFaculty, async (req, res) => {
    try {
        const notes = await SlotNote.find({ faculty: req.user._id })
            .populate('resource', 'name')
            .populate('booking', 'date startTime endTime')
            .sort({ date: -1, startTime: 1 });

        res.render('faculty/slot_notes', { user: req.user, notes });
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Failed to load slot notes.');
        res.redirect('/faculty/dashboard');
    }
});

router.post('/slot-notes/create', ensureAuthenticated, ensureFaculty, async (req, res) => {
    try {
        const { resourceId, bookingId, date, startTime, endTime, note } = req.body;
        if (!date || !startTime || !endTime || !note) {
            req.flash('error_msg', 'All fields are required.');
            return res.redirect('/faculty/slot-notes');
        }
        await SlotNote.create({
            resource: resourceId || undefined,
            faculty: req.user._id,
            booking: bookingId || undefined,
            date: new Date(date),
            startTime,
            endTime,
            note
        });
        req.flash('success_msg', 'Note saved successfully.');
        res.redirect('/faculty/slot-notes');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Failed to save note.');
        res.redirect('/faculty/slot-notes');
    }
});

router.post('/slot-notes/:id/delete', ensureAuthenticated, ensureFaculty, async (req, res) => {
    try {
        const note = await SlotNote.findById(req.params.id);
        if (note && note.faculty.toString() === req.user._id.toString()) {
            await SlotNote.findByIdAndDelete(req.params.id);
            req.flash('success_msg', 'Note deleted.');
        } else {
            req.flash('error_msg', 'Note not found or unauthorized.');
        }
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Failed to delete note.');
    }
    res.redirect('/faculty/slot-notes');
});

module.exports = router;

