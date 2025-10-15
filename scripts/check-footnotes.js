// scripts/check-footnotes.js - Check event footnotes
const mongoose = require('mongoose');

// Define Event schema inline
const EventSchema = new mongoose.Schema({
  title: String,
  description: String,
  footnotes: [{
    number: Number,
    type: String,
    referenceId: mongoose.Schema.Types.ObjectId,
    pageRange: String,
    customSource: String,
    date: String,
  }],
}, { timestamps: true });

const Event = mongoose.model('Event', EventSchema);

async function checkFootnotes() {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/timeliner';
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB\n');

    const event = await Event.findOne({ title: { $regex: /Betty Ong/i } });

    if (event) {
      console.log('=== Event Found ===');
      console.log('Title:', event.title);
      console.log('Description length:', event.description?.length || 0);
      console.log('\n=== Footnotes ===');
      console.log('Count:', event.footnotes?.length || 0);

      if (event.footnotes && event.footnotes.length > 0) {
        event.footnotes.forEach((fn, idx) => {
          console.log(`\n[${idx + 1}] Footnote #${fn.number}:`);
          console.log(`  Type: ${fn.type}`);
          console.log(`  Reference ID: ${fn.referenceId}`);
          console.log(`  Custom Source: ${fn.customSource}`);
          console.log(`  Date: ${fn.date || '(none)'}`);
          if (fn.pageRange) {
            console.log(`  Page Range: ${fn.pageRange}`);
          }
        });
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

checkFootnotes();
