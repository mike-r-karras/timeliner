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

async function deleteTimelineData() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find the timeline by ID (change this to the ID you want to delete)
    const Timeline = mongoose.model('Timeline', new mongoose.Schema({
      name: String,
      description: String,
      createdBy: mongoose.Schema.Types.ObjectId,
    }));

    // Use the parse test timeline ID from the logs
    const TIMELINE_ID = '68e5a105622487710d3ab9ff';

    const timeline = await Timeline.findById(TIMELINE_ID);

    if (!timeline) {
      console.log(`Timeline with ID ${TIMELINE_ID} not found`);
      await mongoose.connection.close();
      return;
    }

    console.log(`Found timeline: "${timeline.name || timeline.description}" with ID: ${timeline._id}`);
    const timelineId = timeline._id;

    // Define all collections to clean up
    const Event = mongoose.model('Event', new mongoose.Schema({ timelineId: mongoose.Schema.Types.ObjectId }));
    const Entity = mongoose.model('Entity', new mongoose.Schema({ timelineId: mongoose.Schema.Types.ObjectId }));
    const Connection = mongoose.model('Connection', new mongoose.Schema({ timelineId: mongoose.Schema.Types.ObjectId }));
    const Chain = mongoose.model('Chain', new mongoose.Schema({ timelineId: mongoose.Schema.Types.ObjectId }));
    const Location = mongoose.model('Location', new mongoose.Schema({ timelineId: mongoose.Schema.Types.ObjectId }));

    // For Link and Attachment, we need to find them via their association tables
    const Link = mongoose.model('Link', new mongoose.Schema({ createdBy: mongoose.Schema.Types.ObjectId }));
    const LinkLink = mongoose.model('LinkLink', new mongoose.Schema({
      linkId: mongoose.Schema.Types.ObjectId,
      eventId: mongoose.Schema.Types.ObjectId,
      entityId: mongoose.Schema.Types.ObjectId,
    }));
    const Attachment = mongoose.model('Attachment', new mongoose.Schema({ createdBy: mongoose.Schema.Types.ObjectId }));
    const AttachmentLink = mongoose.model('AttachmentLink', new mongoose.Schema({
      attachmentId: mongoose.Schema.Types.ObjectId,
      eventId: mongoose.Schema.Types.ObjectId,
      entityId: mongoose.Schema.Types.ObjectId,
    }));

    // Get all events for this timeline to find associated links and attachments
    const events = await Event.find({ timelineId });
    const eventIds = events.map(e => e._id);

    const entities = await Entity.find({ timelineId });
    const entityIds = entities.map(e => e._id);

    console.log(`\nFound associated documents:`);
    console.log(`- Events: ${eventIds.length}`);
    console.log(`- Entities: ${entityIds.length}`);

    // Count all documents before deletion
    const eventCount = await Event.countDocuments({ timelineId });
    const entityCount = await Entity.countDocuments({ timelineId });
    const connectionCount = await Connection.countDocuments({ timelineId });
    const chainCount = await Chain.countDocuments({ timelineId });
    const locationCount = await Location.countDocuments({ timelineId });

    // Find link associations
    const linkLinks = await LinkLink.find({
      $or: [
        { eventId: { $in: eventIds } },
        { entityId: { $in: entityIds } }
      ]
    });
    const linkIds = linkLinks.map(ll => ll.linkId);

    // Find attachment associations
    const attachmentLinks = await AttachmentLink.find({
      $or: [
        { eventId: { $in: eventIds } },
        { entityId: { $in: entityIds } }
      ]
    });
    const attachmentIds = attachmentLinks.map(al => al.attachmentId);

    console.log(`- Connections: ${connectionCount}`);
    console.log(`- Chains: ${chainCount}`);
    console.log(`- Locations: ${locationCount}`);
    console.log(`- Link associations: ${linkLinks.length}`);
    console.log(`- Attachment associations: ${attachmentLinks.length}`);

    // Confirm deletion
    console.log(`\n⚠️  This will delete ALL data associated with timeline "9/11"`);
    console.log(`⚠️  This action cannot be undone!`);
    console.log(`\nStarting deletion in 3 seconds...`);

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Delete in order (most dependent first)
    console.log('\nDeleting documents...');

    // Delete link associations
    const deletedLinkLinks = await LinkLink.deleteMany({
      $or: [
        { eventId: { $in: eventIds } },
        { entityId: { $in: entityIds } }
      ]
    });
    console.log(`✓ Deleted ${deletedLinkLinks.deletedCount} link associations`);

    // Delete attachment associations
    const deletedAttachmentLinks = await AttachmentLink.deleteMany({
      $or: [
        { eventId: { $in: eventIds } },
        { entityId: { $in: entityIds } }
      ]
    });
    console.log(`✓ Deleted ${deletedAttachmentLinks.deletedCount} attachment associations`);

    // Delete links (only if no other associations exist)
    let deletedLinksCount = 0;
    for (const linkId of linkIds) {
      const remainingAssociations = await LinkLink.countDocuments({ linkId });
      if (remainingAssociations === 0) {
        await Link.deleteOne({ _id: linkId });
        deletedLinksCount++;
      }
    }
    console.log(`✓ Deleted ${deletedLinksCount} orphaned links`);

    // Delete attachments (only if no other associations exist)
    let deletedAttachmentsCount = 0;
    for (const attachmentId of attachmentIds) {
      const remainingAssociations = await AttachmentLink.countDocuments({ attachmentId });
      if (remainingAssociations === 0) {
        await Attachment.deleteOne({ _id: attachmentId });
        deletedAttachmentsCount++;
      }
    }
    console.log(`✓ Deleted ${deletedAttachmentsCount} orphaned attachments`);

    // Delete connections
    const deletedConnections = await Connection.deleteMany({ timelineId });
    console.log(`✓ Deleted ${deletedConnections.deletedCount} connections`);

    // Delete chains
    const deletedChains = await Chain.deleteMany({ timelineId });
    console.log(`✓ Deleted ${deletedChains.deletedCount} chains`);

    // Delete locations
    const deletedLocations = await Location.deleteMany({ timelineId });
    console.log(`✓ Deleted ${deletedLocations.deletedCount} locations`);

    // Delete entities
    const deletedEntities = await Entity.deleteMany({ timelineId });
    console.log(`✓ Deleted ${deletedEntities.deletedCount} entities`);

    // Delete events
    const deletedEvents = await Event.deleteMany({ timelineId });
    console.log(`✓ Deleted ${deletedEvents.deletedCount} events`);

    // Finally, delete the timeline itself
    await Timeline.deleteOne({ _id: timelineId });
    console.log(`✓ Deleted timeline "9/11"`);

    console.log('\n✅ All data associated with timeline "9/11" has been deleted');

    await mongoose.connection.close();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

deleteTimelineData();
