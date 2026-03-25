const mongoose = require('mongoose');

const ResourceSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['folder', 'resource'],
        required: true
    },
    resourceType: {
        type: String,
        enum: ['Lab', 'Classroom', 'Seminar Hall', 'Auditorium', 'Other'],
        default: 'Other'
    },
    parent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Resource',
        default: null // Null means root level
    },
    // Resource specific fields
    description: String,
    capacity: {
        type: Number, // Number of slots or people
        default: 0
    },
    slotTimings: [{
        slotTiming: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'SlotTiming'
        },
        startTime: String, // Legacy: used when slotTiming not set
        endTime: String,
        autoApprove: {
            type: Boolean,
            default: false
        },
        assignedFaculty: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }]
    }],
    date: {
        type: Date,
        default: Date.now
    }
});

const Resource = mongoose.model('Resource', ResourceSchema);
module.exports = Resource;
