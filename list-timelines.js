const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Read .env.local file
const envPath = path.join(__dirname, '.env.local');
let MONGODB_URI;

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const match = envContent.match(/MONGODB_URI=(.+)/);
  if (match) {
    MONGODB_URI = match[1].trim();
  }
}

if (!MONGODB_URI) {
  console.error('MONGODB_URI not found in .env.local');
  process.exit(1);
}

async function listTimelines() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB\n');

    const Timeline = mongoose.model('Timeline', new mongoose.Schema({
      name: String,
      description: String,
      createdBy: mongoose.Schema.Types.ObjectId,
      createdAt: Date,
    }));

    const timelines = await Timeline.find().sort({ createdAt: -1 });

    console.log(`Found ${timelines.length} timeline(s):\n`);

    for (const timeline of timelines) {
      console.log(`ID: ${timeline._id}`);
      console.log(`Name: "${timeline.name}"`);
      console.log(`Description: ${timeline.description || 'N/A'}`);
      console.log(`Created: ${timeline.createdAt}`);
      console.log('---');
    }

    await mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

listTimelines();
