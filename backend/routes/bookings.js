const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../config/auth');
const Booking = require('../models/Booking');
const Resource = require('../models/Resource');
const Notification = require('../models/Notification');

// List Bookings (Admin sees all?, Faculty sees assigned? Student sees own?)
// Actually dashboard handles the view. This route is for Actions.

// Approve Booking
router.post('/:id/approve', ensureAuthenticated, async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id)
            .populate({ path: 'resource', populate: { path: 'slotTimings.slotTiming' } });

        // Authorization Check
        let authorized = false;
        if (req.user.role === 'admin') authorized = true;

        if (req.user.role === 'faculty' && req.user.facultyType === 'teaching') {
            const st = (slot) => slot.slotTiming && typeof slot.slotTiming === 'object'
                ? { startTime: slot.slotTiming.startTime, endTime: slot.slotTiming.endTime }
                : { startTime: slot.startTime, endTime: slot.endTime };
            const matchingSlot = booking.resource.slotTimings.find(slot => {
                const t = st(slot);
                return t.startTime === booking.startTime && t.endTime === booking.endTime;
            });
            if (matchingSlot && matchingSlot.assignedFaculty.some(id => id.toString() === req.user._id.toString())) {
                authorized = true;
            }
        }

        if (!authorized) {
            req.flash('error_msg', 'Not Authorized');
            return res.redirect('/dashboard');
        }

        const existingApproved = await Booking.findOne({
            resource: booking.resource._id,
            date: booking.date,
            startTime: booking.startTime,
            endTime: booking.endTime,
            status: 'approved'
        });

        if (existingApproved) {
            req.flash('error_msg', 'This slot has already been approved for another user.');
            return res.redirect('back');
        }

        booking.status = 'approved';
        await booking.save();

        await Notification.create({
            user: booking.user,
            message: `Your booking for ${booking.resource.name} on ${new Date(booking.date).toDateString()} at ${booking.startTime} has been approved.`,
            type: 'success'
        });

        req.flash('success_msg', 'Booking Approved');
        res.redirect('back');

    } catch (err) {
        console.error(err);
        res.redirect('back');
    }
});

// Cancel/Reject Booking
router.post('/:id/cancel', ensureAuthenticated, async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id)
            .populate({ path: 'resource', populate: { path: 'slotTimings.slotTiming' } });

        let authorized = false;

        // 1. Admin can always cancel
        if (req.user.role === 'admin') authorized = true;

        // 2. Teaching Faculty assigned to the slot can always cancel (even if approved)
        if (req.user.role === 'faculty' && req.user.facultyType === 'teaching') {
            const st = (slot) => slot.slotTiming && typeof slot.slotTiming === 'object'
                ? { startTime: slot.slotTiming.startTime, endTime: slot.slotTiming.endTime }
                : { startTime: slot.startTime, endTime: slot.endTime };
            const matchingSlot = booking.resource.slotTimings.find(slot => {
                const t = st(slot);
                return t.startTime === booking.startTime && t.endTime === booking.endTime;
            });
            if (matchingSlot && matchingSlot.assignedFaculty.some(id => id.toString() === req.user._id.toString())) {
                authorized = true;
            }
        }

        // 3. User (Student/Faculty) can cancel their OWN booking ONLY if PENDING
        if (booking.user.toString() === req.user._id.toString()) {
            if (booking.status === 'pending') {
                authorized = true;
            } else if (!authorized) {
                // If they are the owner but status is approved/cancelled, and they aren't authorized via rule 1 or 2
                req.flash('error_msg', 'Cannot cancel approved booking. Please contact Faculty/Admin.');
                return res.redirect('/dashboard');
            }
        }

        if (!authorized) {
            req.flash('error_msg', 'Not Authorized');
            return res.redirect('/dashboard');
        }

        booking.status = 'cancelled';
        await booking.save();

        if (booking.user.toString() !== req.user._id.toString()) {
            await Notification.create({
                user: booking.user,
                message: `Your booking for ${booking.resource.name} on ${new Date(booking.date).toDateString()} at ${booking.startTime} has been cancelled.`,
                type: 'error'
            });
        }

        req.flash('success_msg', 'Booking Cancelled');
        res.redirect('back');

    } catch (err) {
        console.error(err);
        res.redirect('back');
    }
});

module.exports = router;
