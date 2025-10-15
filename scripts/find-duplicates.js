const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema({
  title: String,
  description: String,
  footnotes: Array,
}, { timestamps: true });

const Event = mongoose.model('Event', EventSchema);

async function findDuplicates() {
  const MONGODB_URI = 'mongodb://timeliner:renilemit@45.61.62.91:27017/lucidio?authSource=admin';
  
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB\n');

    const title = "Two 9/11 Hijackers Fly to Boston Airport";
    const events = await Event.find({ title });
    
    console.log(`Found ${events.length} event(s) with title: "${title}"\n`);
    
    events.forEach((event, idx) => {
      console.log(`Event ${idx + 1}:`);
      console.log(`  ID: ${event._id}`);
      console.log(`  Description length: ${event.description?.length || 0}`);
      console.log(`  Footnotes count: ${event.footnotes?.length || 0}`);
      console.log('');
    });

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

findDuplicates();
