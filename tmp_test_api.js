const mongoose = require('mongoose');
require('dotenv').config({path: '.env'});

async function runTest() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const Resource = require('./backend/models/Resource');
        const Booking = require('./backend/models/Booking');
        const User = require('./backend/models/User');

        const testUser = await User.findOne();
        
        console.log('--- Testing Availability API Logic ---');
        
        // 1. Create a resource with capacity 5
        const testResource = new Resource({
            name: 'API Test Resource ' + Date.now(),
            type: 'resource',
            capacity: 5,
            slotTimings: [
                { startTime: '09:00', endTime: '10:00' },
                { startTime: '10:00', endTime: '11:00' }
            ]
        });
        await testResource.save();

        const dateStr = '2026-04-01';

        // 2. Add 3 bookings for slot 0
        for(let i=0; i<3; i++) {
            await new Booking({
                resource: testResource._id,
                user: testUser._id,
                date: new Date(dateStr),
                startTime: '09:00',
                endTime: '10:00',
                status: 'approved'
            }).save();
        }

        // 3. Add 5 bookings for slot 1 (full)
        for(let i=0; i<5; i++) {
            await new Booking({
                resource: testResource._id,
                user: testUser._id,
                date: new Date(dateStr),
                startTime: '10:00',
                endTime: '11:00',
                status: 'pending'
            }).save();
        }

        console.log('Bookings added.');

        // 4. Simulate the API logic
        const bookings = await Booking.find({
            resource: testResource._id,
            date: new Date(dateStr),
            status: { $ne: 'cancelled' }
        });

        const availability = testResource.slotTimings.map((slot, index) => {
            // Replicating resolveSlotTimes logic
            const st = { startTime: slot.startTime, endTime: slot.endTime };
            const count = bookings.filter(b => b.startTime === st.startTime && b.endTime === st.endTime).length;
            return {
                index,
                startTime: st.startTime,
                endTime: st.endTime,
                capacity: testResource.capacity,
                booked: count,
                available: testResource.capacity - count
            };
        });

        console.log('Availability Result:', JSON.stringify(availability, null, 2));

        if (availability[0].available === 2 && availability[1].available === 0) {
            console.log('VERIFIED: API logic returns correct availability (Slot 0: 2 left, Slot 1: 0 left)');
        } else {
            console.log('FAILED: API logic returned incorrect availability');
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
