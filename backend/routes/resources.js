const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../config/auth');
const Resource = require('../models/Resource');
const Booking = require('../models/Booking');
const User = require('../models/User');
const SlotTiming = require('../models/SlotTiming');

function resolveSlotTimes(slot) {
    if (slot.slotTiming && typeof slot.slotTiming === 'object') {
        return { startTime: slot.slotTiming.startTime, endTime: slot.slotTiming.endTime };
    }
    return { startTime: slot.startTime, endTime: slot.endTime };
}
const Notification = require('../models/Notification');

// List Resources for Students/Faculty (Read Only)
router.get('/', ensureAuthenticated, async (req, res) => {
    const parentId = req.query.parentId || null;
    const searchQuery = req.query.search || '';

    try {
        let query = {};
        let parentResource = null;

        if (req.user.role === 'admin') {
            // Admin sees folders and hierarchy
            query = { parent: parentId };
            if (parentId) {
                parentResource = await Resource.findById(parentId);
            }
        } else {
            // Student/Faculty see ONLY resources (no folders), flat list
            query = { type: 'resource' };

            // Search logic
            if (searchQuery) {
                query.name = { $regex: searchQuery, $options: 'i' };
            }
        }

        const resources = await Resource.find(query);

        res.render('resources/index', {
            user: req.user,
            resources: resources,
            parent: parentResource,
            searchQuery: searchQuery
        });
    } catch (err) {
        console.error(err);
        res.redirect('/dashboard');
    }
});

// View Resource Details & Book
router.get('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const resource = await Resource.findById(req.params.id)
            .populate('slotTimings.slotTiming');
        
        if (!resource) {
            req.flash('error_msg', 'Resource not found');
            return res.redirect('/resources');
        }

        let mySlots = [];
        if (req.user.role === 'faculty' && resource.slotTimings) {
            mySlots = resource.slotTimings
                .filter(slot => slot.assignedFaculty.some(id => id.toString() === req.user._id.toString()))
                .map(slot => {
                    const t = resolveSlotTimes(slot);
                    return { ...slot.toObject(), startTime: t.startTime, endTime: t.endTime };
                });
        }
        const resourceObj = resource.toObject();
        if (resourceObj.slotTimings) {
            resourceObj.slotTimings = resourceObj.slotTimings.map(slot => {
                const t = resolveSlotTimes(slot);
                return { ...slot, startTime: t.startTime, endTime: t.endTime };
            });
        }

        res.render('resources/view', {
            user: req.user,
            resource: resourceObj,
            mySlots: mySlots
        });
    } catch (err) {
        console.error(err);
        res.redirect('/resources');
    }
});

// Manage Slots Interface
router.get('/:id/manage-slots', ensureAuthenticated, async (req, res) => {
    if (req.user.role !== 'admin') {
        req.flash('error_msg', 'Not Authorized');
        return res.redirect('/dashboard');
    }
    try {
        const resource = await Resource.findById(req.params.id)
            .populate('slotTimings.slotTiming');
        const faculties = await User.find({ role: 'faculty' });
        const slotTimings = await SlotTiming.find().sort({ startTime: 1 });
        res.render('admin/manage_slots', {
            user: req.user,
            resource: resource,
            faculties: faculties,
            slotTimings: slotTimings
        });
    } catch (err) {
        console.error(err);
        res.redirect('/resources');
    }
});

// Add Slot (assign a pre-defined slot timing to this resource)
router.post('/:id/slots', ensureAuthenticated, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).send('Not Authorized');
    }
    try {
        const resource = await Resource.findById(req.params.id);
        const { slotTimingId, autoApprove, assignedFaculty } = req.body;

        if (!slotTimingId) {
            req.flash('error_msg', 'Please select a slot timing');
            return res.redirect(`/resources/${req.params.id}/manage-slots`);
        }

        const newSlot = {
            slotTiming: slotTimingId,
            autoApprove: autoApprove === 'on',
            assignedFaculty: Array.isArray(assignedFaculty) ? assignedFaculty : (assignedFaculty ? [assignedFaculty] : [])
        };

        resource.slotTimings.push(newSlot);
        await resource.save();
        req.flash('success_msg', 'Slot timing assigned');
        res.redirect(`/resources/${req.params.id}/manage-slots`);
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Failed to assign slot timing');
        res.redirect(`/resources/${req.params.id}/manage-slots`);
    }
});

// Delete Slot (Using POST for simplicity without method-override middleware setup check, though _method is in form)
// Actually commonly express needs method-override for DELETE. Let's start with a POST wrapper or check if app.js has it. 
// App.js doesn't show method-override. So I will use POST for delete for safety /resources/:id/slots/:index/delete
router.post('/:id/slots/:index/delete', ensureAuthenticated, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).send('Not Authorized');
    }
    try {
        const resource = await Resource.findById(req.params.id);
        const index = parseInt(req.params.index);
        if (index >= 0 && index < resource.slotTimings.length) {
            resource.slotTimings.splice(index, 1);
            await resource.save();
            req.flash('success_msg', 'Slot removed');
        }
        res.redirect(`/resources/${req.params.id}/manage-slots`);
    } catch (err) {
        console.error(err);
        res.redirect(`/resources/${req.params.id}/manage-slots`);
    }
});

// API: Get slot availability for a specific date
router.get('/:id/availability', ensureAuthenticated, async (req, res) => {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'Date is required' });

    try {
        const resource = await Resource.findById(req.params.id).populate('slotTimings.slotTiming');
        if (!resource) return res.status(404).json({ error: 'Resource not found' });

        // Standardize date to start of day UTC for consistent querying
        const queryDate = new Date(date);
        queryDate.setUTCHours(0, 0, 0, 0);

        const bookings = await Booking.find({
            resource: resource._id,
            date: queryDate,
            status: { $ne: 'cancelled' }
        });

        const availability = resource.slotTimings.map((slot, index) => {
            const t = resolveSlotTimes(slot);
            const count = bookings.filter(b => b.startTime === t.startTime && b.endTime === t.endTime).length;
            return {
                index,
                startTime: t.startTime,
                endTime: t.endTime,
                capacity: resource.capacity,
                booked: count,
                available: resource.capacity - count
            };
        });

        res.json({ slots: availability });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/:id/book', ensureAuthenticated, async (req, res) => {
    const { date, slotIndex, studentId } = req.body;

    try {
        const resource = await Resource.findById(req.params.id)
            .populate('slotTimings.slotTiming');
        
        if (!resource) {
            req.flash('error_msg', 'Resource not found');
            return res.redirect('/resources');
        }

        // Check if user is allowed to book
        if (req.user.role === 'faculty') {
            // Check if this faculty is assigned to ANY slot of this resource
            const isAssigned = resource.slotTimings.some(slot => 
                slot.assignedFaculty.some(id => id.toString() === req.user._id.toString())
            );
            
            if (!isAssigned) {
                req.flash('error_msg', 'Faculty can only book resources they are assigned to.');
                return res.redirect(`/resources/${req.params.id}`);
            }
        }

        let targetUser = req.user._id;
        let status = 'pending';
        if (req.user.role === 'admin' && studentId) {
            const studentInput = studentId.trim();
            let student = null;
            if (studentInput.match(/^[0-9a-fA-F]{24}$/)) {
                student = await User.findById(studentInput);
            }

            if (!student) {
                student = await User.findOne({ email: studentInput });
            }

            if (!student) {
                student = await User.findOne({ rollNo: studentInput });
            }

            if (student) {
                targetUser = student._id;
            } else {
                req.flash('error_msg', 'Student not found');
                return res.redirect(`/resources/${req.params.id}`);
            }
        }

        const selectedSlot = resource.slotTimings[slotIndex];
        if (!selectedSlot) {
            req.flash('error_msg', 'Invalid slot selected');
            return res.redirect(`/resources/${req.params.id}`);
        }
        const slotTimes = resolveSlotTimes(selectedSlot);
        if (!slotTimes.startTime || !slotTimes.endTime) {
            req.flash('error_msg', 'Invalid slot configuration');
            return res.redirect(`/resources/${req.params.id}`);
        }

        // Standardize date for query
        const queryDate = new Date(date);
        queryDate.setUTCHours(0, 0, 0, 0);

        // Count existing bookings for this slot and date
        const bookingCount = await Booking.countDocuments({
            resource: resource._id,
            date: queryDate,
            startTime: slotTimes.startTime,
            endTime: slotTimes.endTime,
            status: { $ne: 'cancelled' }
        });

        if (bookingCount >= resource.capacity) {
            req.flash('error_msg', 'This slot has reached its maximum capacity for the selected date.');
            return res.redirect(`/resources/${req.params.id}`);
        }

        // Auto-approve logic based on SLOT settings
        if (req.user.role === 'admin') {
            status = 'approved';
        } else if (selectedSlot.autoApprove) {
            status = 'approved';
        } else if (req.user.role === 'faculty') {
            if (selectedSlot.assignedFaculty && selectedSlot.assignedFaculty.some(id => id.toString() === req.user._id.toString())) {
                status = 'approved';
            }
        }

        if (resource.slotTimings.length === 0) {
            req.flash('error_msg', 'No slots defined for this resource');
            return res.redirect(`/resources/${req.params.id}`);
        }

        const newBooking = new Booking({
            resource: resource._id,
            user: targetUser,
            bookedBy: req.user._id,
            status: status,
            date: queryDate,
            startTime: slotTimes.startTime,
            endTime: slotTimes.endTime,
            resourceSlotId: selectedSlot._id
        });

        await newBooking.save();

        let notificationMsg = `Your booking request for ${resource.name} on ${new Date(date).toDateString()} at ${slotTimes.startTime} has been submitted and is pending approval.`;
        if (status === 'approved') {
            notificationMsg = `Your booking for ${resource.name} on ${new Date(date).toDateString()} at ${slotTimes.startTime} has been auto-approved.`;
        }

        await Notification.create({
            user: targetUser,
            message: notificationMsg,
            type: status === 'approved' ? 'success' : 'info'
        });

        req.flash('success_msg', 'Booking request submitted' + (status === 'approved' ? ' and approved' : ''));
        res.redirect('/dashboard');

    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error processing booking');
        res.redirect(`/resources/${req.params.id}`);
    }
});

module.exports = router;
