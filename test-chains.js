// Quick test script to check if chainIds are in the database
// Run with: node test-chains.js

const mongoose = require('mongoose');
const fs = require('fs');

// Read MongoDB URI from .env.local
let MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  try {
    const envFile = fs.readFileSync('.env.local', 'utf8');
    const match = envFile.match(/MONGODB_URI=(.+)/);
    if (match) {
      MONGODB_URI = match[1].trim();
    }
  } catch (error) {
    console.error('Could not read .env.local file');
  }
}

// Connect to MongoDB
mongoose.connect(MONGODB_URI);

const EventSchema = new mongoose.Schema({}, { strict: false });
const Event = mongoose.model('Event', EventSchema);

async function checkChainIds() {
  try {
    const events = await Event.find().limit(5);

    console.log('\n=== Checking Events for chainIds ===\n');
    events.forEach(event => {
      console.log(`Event: ${event.title}`);
      console.log(`  _id: ${event._id}`);
      console.log(`  chainIds: ${JSON.stringify(event.chainIds)}`);
      console.log(`  chainIds exists: ${event.chainIds !== undefined}`);
      console.log('');
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkChainIds();
