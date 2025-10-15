// Migration script to add chainIds field to existing events
// Run with: node migrate-chainids.js

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

if (!MONGODB_URI) {
  console.error('MONGODB_URI not found in environment variables or .env.local');
  process.exit(1);
}

// Define schema
const EventSchema = new mongoose.Schema({}, { strict: false });
const Event = mongoose.model('Event', EventSchema);

async function migrate() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected successfully\n');

    // Find all events that don't have chainIds field
    const eventsWithoutChainIds = await Event.find({
      chainIds: { $exists: false }
    });

    console.log(`Found ${eventsWithoutChainIds.length} events without chainIds field`);

    if (eventsWithoutChainIds.length === 0) {
      console.log('No migration needed - all events already have chainIds field');
      process.exit(0);
    }

    console.log('Adding chainIds field to these events...\n');

    // Update all events without chainIds to have an empty array
    const result = await Event.updateMany(
      { chainIds: { $exists: false } },
      { $set: { chainIds: [] } }
    );

    console.log(`Migration complete!`);
    console.log(`Modified ${result.modifiedCount} events`);
    console.log(`Matched ${result.matchedCount} events`);

    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
