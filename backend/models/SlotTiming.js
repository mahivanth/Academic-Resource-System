const mongoose = require('mongoose');

const SlotTimingSchema = new mongoose.Schema({
    label: {
        type: String,
        trim: true
    },
    startTime: {
        type: String,
        required: true
    },
    endTime: {
        type: String,
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    }
});

const SlotTiming = mongoose.model('SlotTiming', SlotTimingSchema);
module.exports = SlotTiming;
