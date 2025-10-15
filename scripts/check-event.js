const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema({
  title: String,
  description: String,
  footnotes: Array,
}, { timestamps: true });

const Event = mongoose.model('Event', EventSchema);

async function checkEvent() {
  const MONGODB_URI = 'mongodb://timeliner:renilemit@45.61.62.91:27017/lucidio?authSource=admin';
  
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB\n');

    const eventId = process.argv[2] || '68e8bd579624a39215a09b04';
    const event = await Event.findById(eventId);
    
    if (event) {
      console.log('Event Title:', event.title);
      console.log('Description length:', event.description?.length || 0);
      console.log('Footnotes:', JSON.stringify(event.footnotes, null, 2));
      console.log('Footnotes count:', event.footnotes?.length || 0);
      
      // Check for [N] patterns in description
      if (event.description) {
        const matches = event.description.match(/\[\d+\]/g);
        console.log('\nFootnote markers found in description:', matches?.length || 0);
        if (matches) {
          console.log('Markers:', matches.join(', '));
        }
      }
    } else {
      console.log('Event not found');
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkEvent();
