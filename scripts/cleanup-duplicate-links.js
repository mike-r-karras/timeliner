// scripts/cleanup-duplicate-links.js - Remove duplicate Link documents
const mongoose = require('mongoose');

// Define schemas
const LinkSchema = new mongoose.Schema({
  title: String,
  url: String,
  createdBy: mongoose.Schema.Types.ObjectId,
}, { timestamps: true });

const LinkLinkSchema = new mongoose.Schema({
  linkId: mongoose.Schema.Types.ObjectId,
  eventId: mongoose.Schema.Types.ObjectId,
  entityId: mongoose.Schema.Types.ObjectId,
  createdBy: mongoose.Schema.Types.ObjectId,
}, { timestamps: true });

const EventSchema = new mongoose.Schema({
  title: String,
  footnotes: [{
    number: Number,
    type: String,
    referenceId: mongoose.Schema.Types.ObjectId,
    pageRange: String,
    customSource: String,
    date: String,
  }],
}, { timestamps: true });

const Link = mongoose.model('Link', LinkSchema);
const LinkLink = mongoose.model('LinkLink', LinkLinkSchema);
const Event = mongoose.model('Event', EventSchema);

async function cleanupDuplicates() {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/timeliner';

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB\n');

    // Find all duplicate URLs
    const db = mongoose.connection.db;
    const duplicates = await db.collection('links').aggregate([
      {
        $group: {
          _id: '$url',
          count: { $sum: 1 },
          ids: { $push: '$_id' },
          titles: { $push: '$title' },
          createdAts: { $push: '$createdAt' }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]).toArray();

    console.log(`Found ${duplicates.length} URLs with duplicates\n`);

    let totalLinksDeleted = 0;
    let totalLinkLinksUpdated = 0;
    let totalFootnotesUpdated = 0;

    for (const dup of duplicates) {
      const url = dup._id;
      const linkIds = dup.ids;

      // Sort by createdAt to keep the oldest one as canonical
      const linksWithDates = linkIds.map((id, idx) => ({
        id,
        createdAt: dup.createdAts[idx]
      })).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

      const canonicalId = linksWithDates[0].id;
      const duplicateIds = linksWithDates.slice(1).map(l => l.id);

      console.log(`URL: ${url.substring(0, 60)}...`);
      console.log(`  Canonical ID: ${canonicalId}`);
      console.log(`  Duplicate IDs (${duplicateIds.length}): ${duplicateIds.slice(0, 3).join(', ')}...`);

      // Update LinkLink entries to point to canonical link
      for (const dupId of duplicateIds) {
        const result = await LinkLink.updateMany(
          { linkId: dupId },
          { $set: { linkId: canonicalId } }
        );
        totalLinkLinksUpdated += result.modifiedCount;
      }

      // Update event footnotes to reference canonical link
      for (const dupId of duplicateIds) {
        const events = await Event.find({ 'footnotes.referenceId': dupId });

        for (const event of events) {
          let updated = false;
          if (event.footnotes && Array.isArray(event.footnotes)) {
            for (const footnote of event.footnotes) {
              if (String(footnote.referenceId) === String(dupId)) {
                footnote.referenceId = canonicalId;
                updated = true;
              }
            }
          }
          if (updated) {
            await event.save();
            totalFootnotesUpdated++;
          }
        }
      }

      // Delete duplicate Link documents
      const deleteResult = await Link.deleteMany({ _id: { $in: duplicateIds } });
      totalLinksDeleted += deleteResult.deletedCount;

      console.log(`  Deleted ${deleteResult.deletedCount} duplicate links`);
      console.log('');
    }

    // Remove duplicate LinkLink entries (same linkId + eventId combination)
    console.log('\nCleaning up duplicate LinkLink entries...');
    const linkLinkDuplicates = await db.collection('linklinks').aggregate([
      {
        $group: {
          _id: { linkId: '$linkId', eventId: '$eventId' },
          count: { $sum: 1 },
          ids: { $push: '$_id' }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]).toArray();

    let linkLinksDeleted = 0;
    for (const dup of linkLinkDuplicates) {
      // Keep the first one, delete the rest
      const toDelete = dup.ids.slice(1);
      await LinkLink.deleteMany({ _id: { $in: toDelete } });
      linkLinksDeleted += toDelete.length;
    }

    console.log(`\n=== CLEANUP SUMMARY ===`);
    console.log(`Duplicate URLs processed: ${duplicates.length}`);
    console.log(`Link documents deleted: ${totalLinksDeleted}`);
    console.log(`LinkLink entries updated: ${totalLinkLinksUpdated}`);
    console.log(`LinkLink duplicates deleted: ${linkLinksDeleted}`);
    console.log(`Event footnotes updated: ${totalFootnotesUpdated}`);

    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Cleanup error:', error);
    process.exit(1);
  }
}

cleanupDuplicates();
