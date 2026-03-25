const mongoose = require('mongoose');
require('dotenv').config({path: '.env'});

async function runTest() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const Resource = require('./backend/models/Resource');
        const Booking = require('./backend/models/Booking');
        const User = require('./backend/models/User');

        const testUser = await User.findOne();
        if (!testUser) {
            console.error('No user found to run test');
            process.exit(1);
        }

        console.log('--- Testing Capacity Check Logic ---');
        
        // 1. Create a resource with capacity 2
        const testResource = new Resource({
            name: 'Test Resource ' + Date.now(),
            type: 'resource',
            capacity: 2,
            slotTimings: [{
                startTime: '09:00',
                endTime: '10:00',
                autoApprove: true
            }]
        });
        await testResource.save();
        console.log('Created resource with capacity 2');

        const dateStr = '2026-03-30';
        const date = new Date(dateStr);

        // 2. Add first booking
        const b1 = new Booking({
            resource: testResource._id,
            user: testUser._id,
            date: date,
            startTime: '09:00',
            endTime: '10:00',
            status: 'approved'
        });
        await b1.save();
        console.log('Added booking 1 (approved)');

        // 3. Add second booking
        const b2 = new Booking({
            resource: testResource._id,
            user: testUser._id,
            date: date,
            startTime: '09:00',
            endTime: '10:00',
            status: 'pending'
        });
        await b2.save();
        console.log('Added booking 2 (pending)');

        // 4. Verify count
        const bookingCount = await Booking.countDocuments({
            resource: testResource._id,
            date: dateStr, // Note: the route uses the string date or Date object? 
            // In the route: router.post('/:id/book', ...) uses 'date' from body which is usually a string 'YYYY-MM-DD'.
            // Mongoose handles string to Date conversion for the query.
            startTime: '09:00',
            endTime: '10:00',
            status: { $ne: 'cancelled' }
        });

        console.log('Current booking count:', bookingCount);
        if (bookingCount >= testResource.capacity) {
            console.log('VERIFIED: Slot is FULL as expected (Count: ' + bookingCount + ', Capacity: ' + testResource.capacity + ')');
        } else {
            console.log('FAILED: Slot should be full but count is ' + bookingCount);
        }

        // Cleanup
        await Resource.deleteOne({ _id: testResource._id });
        await Booking.deleteMany({ resource: testResource._id });
        console.log('Cleanup done');
        
        process.exit(0);
    } catch (err) {
        console.error('Test error:', err);
        process.exit(1);
    }
}

runTest();
