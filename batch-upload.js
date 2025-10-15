const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000';

// Step 1: Get API key from the server (requires valid session cookie once)
async function getApiKey(sessionCookie) {
  const response = await fetch(`${BASE_URL}/api/batch-upload`, {
    method: 'GET',
    headers: {
      'Cookie': sessionCookie
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to get API key: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log(`API key obtained! Valid until: ${data.expiresAt}`);
  return data.apiKey;
}

// Fetch existing chains
async function getExistingChains(timelineId, sessionCookie) {
  const response = await fetch(`${BASE_URL}/api/chains?timelineId=${timelineId}`, {
    headers: {
      'Cookie': sessionCookie,
    }
  });

  if (!response.ok) {
    console.warn('Failed to fetch existing chains');
    return [];
  }

  return await response.json();
}

// Fetch existing entities
async function getExistingEntities(timelineId, sessionCookie) {
  const response = await fetch(`${BASE_URL}/api/entities?timelineId=${timelineId}`, {
    headers: {
      'Cookie': sessionCookie,
    }
  });

  if (!response.ok) {
    console.warn('Failed to fetch existing entities');
    return [];
  }

  return await response.json();
}

// Generate color from name hash
function generateColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const r = (hash & 0xFF0000) >> 16;
  const g = (hash & 0x00FF00) >> 8;
  const b = hash & 0x0000FF;
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Create or find chains
async function processChains(chains, timelineId, sessionCookie, existingChains) {
  const chainMap = new Map();

  for (const chainData of chains || []) {
    const existingChain = existingChains.find(c => c.name === chainData.name);

    if (existingChain) {
      chainMap.set(chainData.name, existingChain._id);
      console.log(`      Chain (existing): ${existingChain.name}`);
    } else {
      const response = await fetch(`${BASE_URL}/api/chains`, {
        method: 'POST',
        headers: {
          'Cookie': sessionCookie,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: chainData.name,
          description: chainData.description,
          color: generateColor(chainData.name),
          timelineId,
        }),
      });

      if (response.ok) {
        const chain = await response.json();
        chainMap.set(chainData.name, chain._id);
        console.log(`      Chain (new): ${chain.name}`);
      }
    }
  }

  return chainMap;
}

// Create locations and place entities
async function processLocations(locations, timelineId, sessionCookie, existingEntities) {
  const locationMap = new Map();
  const entityMap = new Map();

  for (const locationData of locations || []) {
    let locationRecordId;

    // Check if Location already exists
    const existingLocationResponse = await fetch(`${BASE_URL}/api/locations?search=${encodeURIComponent(locationData.name)}`, {
      headers: {
        'Cookie': sessionCookie,
      }
    });

    if (existingLocationResponse.ok) {
      const existingLocations = await existingLocationResponse.json();
      const exactMatch = existingLocations.find(loc =>
        loc.name === locationData.name &&
        loc.latitude === locationData.lat &&
        loc.longitude === locationData.lon
      );
      if (exactMatch) {
        locationRecordId = exactMatch._id;
        console.log(`      Location (existing): ${exactMatch.name}`);
      }
    }

    // Create Location record if it doesn't exist
    if (!locationRecordId && locationData.lat && locationData.lon) {
      const locationResponse = await fetch(`${BASE_URL}/api/locations`, {
        method: 'POST',
        headers: {
          'Cookie': sessionCookie,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: locationData.name,
          latitude: locationData.lat,
          longitude: locationData.lon,
          description: locationData.description || '',
          geocoded: true,
          geocodingSource: 'nominatim',
        }),
      });

      if (locationResponse.ok) {
        const location = await locationResponse.json();
        locationRecordId = location._id;
        console.log(`      Location (new): ${location.name}`);
      }
    }

    locationMap.set(locationData.name, locationRecordId || '');

    // Create or find place entity
    const existingEntity = existingEntities.find(e => e.name === locationData.name && e.type === 'place');

    if (existingEntity) {
      entityMap.set(locationData.name, existingEntity._id);
      console.log(`      Place (existing): ${existingEntity.name}`);
    } else {
      const entityResponse = await fetch(`${BASE_URL}/api/entities`, {
        method: 'POST',
        headers: {
          'Cookie': sessionCookie,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: locationData.name,
          type: 'place',
          description: locationData.description || '',
          importance: 3,
          locationId: locationRecordId,
          timelineId,
        }),
      });

      if (entityResponse.ok) {
        const entity = await entityResponse.json();
        entityMap.set(locationData.name, entity._id);
        existingEntities.push(entity);
        console.log(`      Place (new): ${entity.name}`);
      }
    }
  }

  return { locationMap, entityMap };
}

// Create events
async function processEvents(events, timelineId, sessionCookie, chainMap, locationMap) {
  const eventMap = new Map();

  for (const eventData of events || []) {
    const chainIds = (eventData.chains || [])
      .map(chainName => chainMap.get(chainName))
      .filter(id => !!id);

    const locationId = eventData.location ? locationMap.get(eventData.location) : undefined;

    const response = await fetch(`${BASE_URL}/api/events`, {
      method: 'POST',
      headers: {
        'Cookie': sessionCookie,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: eventData.title,
        description: eventData.description,
        startDateTime: eventData.startDateTime,
        endDateTime: eventData.endDateTime,
        importance: eventData.importance,
        locationId: locationId,
        chainIds: chainIds,
        timelineId,
      }),
    });

    if (response.ok) {
      const event = await response.json();
      eventMap.set(eventData.title, event._id);
      console.log(`      Event: ${event.title}`);
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.error(`      Failed to create event: ${eventData.title}`, errorData);
    }
  }

  return eventMap;
}

// Create entities
async function processEntities(entities, timelineId, sessionCookie, existingEntities, entityMap) {
  for (const entityData of entities || []) {
    const existingEntity = existingEntities.find(
      e => e.name === entityData.name && e.type === entityData.type
    );

    if (existingEntity) {
      entityMap.set(entityData.name, existingEntity._id);
      console.log(`      Entity (existing): ${existingEntity.name}`);
    } else {
      const response = await fetch(`${BASE_URL}/api/entities`, {
        method: 'POST',
        headers: {
          'Cookie': sessionCookie,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: entityData.name,
          type: entityData.type,
          description: entityData.description,
          importance: entityData.importance,
          metadata: entityData.metadata,
          timelineId,
        }),
      });

      if (response.ok) {
        const entity = await response.json();
        entityMap.set(entityData.name, entity._id);
        existingEntities.push(entity);
        console.log(`      Entity (new): ${entity.name}`);
      }
    }
  }
}

// Create links
async function processLinks(links, sessionCookie, eventMap, firstEventTitle) {
  const firstEventId = firstEventTitle ? eventMap.get(firstEventTitle) : null;

  if (!firstEventId) {
    console.log('      No event found to associate links with, skipping...');
    return new Map();
  }

  const linkMap = new Map();

  for (const linkData of links || []) {
    const cleanTitle = linkData.title.replace(/^\[\d+\]:\s*/, '');

    const response = await fetch(`${BASE_URL}/api/links`, {
      method: 'POST',
      headers: {
        'Cookie': sessionCookie,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: cleanTitle,
        url: linkData.url,
        eventId: firstEventId,
      }),
    });

    if (response.ok) {
      const responseData = await response.json();
      const link = responseData.link;
      linkMap.set(cleanTitle, link._id);
      console.log(`      Link: ${link.title}`);
    }
  }

  return linkMap;
}

// Create connections
async function processConnections(connections, timelineId, sessionCookie, eventMap, entityMap, firstEventTitle) {
  for (const connectionData of connections || []) {
    let sourceId, targetId, sourceModel, targetModel;

    // Determine source
    if (connectionData.sourceType === 'event') {
      sourceId = connectionData.sourceName === firstEventTitle ? eventMap.get(firstEventTitle) : null;
      sourceModel = 'Event';
    } else {
      sourceId = entityMap.get(connectionData.sourceName);
      sourceModel = 'Entity';
    }

    // Determine target
    if (connectionData.targetType === 'event') {
      targetId = connectionData.targetName === firstEventTitle ? eventMap.get(firstEventTitle) : null;
      targetModel = 'Event';
    } else {
      targetId = entityMap.get(connectionData.targetName);
      targetModel = 'Entity';
    }

    if (!sourceId || !targetId) {
      console.log(`      Skipping connection (missing source or target): ${connectionData.relationshipType}`);
      continue;
    }

    const connectionType = sourceModel === 'Event' && targetModel === 'Event' ? 'event-event' :
      sourceModel === 'Entity' && targetModel === 'Entity' ? 'entity-entity' : 'event-entity';

    const response = await fetch(`${BASE_URL}/api/connections`, {
      method: 'POST',
      headers: {
        'Cookie': sessionCookie,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: connectionType,
        sourceId,
        targetId,
        sourceModel,
        targetModel,
        relationshipType: connectionData.relationshipType,
        description: connectionData.context,
        timelineId,
      }),
    });

    if (response.ok) {
      console.log(`      Connection: ${connectionData.relationshipType}`);
    }
  }
}

async function uploadFile(filePath, timelineId, apiKey, sessionCookie, existingChains, existingEntities) {
  const fileName = path.basename(filePath);
  console.log(`  Uploading ${fileName}...`);

  try {
    // Step 1: Parse the file
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    form.append('timelineId', timelineId);

    const response = await fetch(`${BASE_URL}/api/parse-file`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Origin': BASE_URL,
        'Referer': `${BASE_URL}/`,
      },
      body: form
    });

    if (response.status !== 200) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`    ✗ Parse failed:`, errorData);
      return { file: fileName, status: response.status, error: errorData };
    }

    const parseResult = await response.json();
    const parsed = parseResult.parsed;

    console.log(`    ✓ Parsed successfully`);
    console.log(`    Creating database records...`);

    // Step 2: Create all database records (same as UI logic)
    const chainMap = await processChains(parsed.chains, timelineId, sessionCookie, existingChains);
    const { locationMap, entityMap } = await processLocations(parsed.locations, timelineId, sessionCookie, existingEntities);
    const eventMap = await processEvents(parsed.events, timelineId, sessionCookie, chainMap, locationMap);
    await processEntities(parsed.entities, timelineId, sessionCookie, existingEntities, entityMap);

    const firstEventTitle = parsed.events?.[0]?.title;
    const linkMap = await processLinks(parsed.links, sessionCookie, eventMap, firstEventTitle);
    await processConnections(parsed.connections, timelineId, sessionCookie, eventMap, entityMap, firstEventTitle);

    console.log(`    ✓ All records created`);

    return {
      file: fileName,
      status: 200,
      success: true
    };
  } catch (error) {
    console.error(`    ✗ Fetch failed:`, error.message);
    return {
      file: fileName,
      status: 'error',
      error: error.message
    };
  }
}

async function batchUpload(directory, timelineId, sessionCookie, concurrency = 1) {
  console.log('Getting API key...');
  const apiKey = await getApiKey(sessionCookie);

  const files = fs.readdirSync(directory).filter(f => f.endsWith('.md'));
  console.log(`Found ${files.length} files to upload in ${directory}.`);

  // Fetch existing chains and entities once at the start
  console.log('Fetching existing chains and entities...');
  const existingChains = await getExistingChains(timelineId, sessionCookie);
  const existingEntities = await getExistingEntities(timelineId, sessionCookie);
  console.log(`Found ${existingChains.length} existing chains, ${existingEntities.length} existing entities\n`);

  const results = [];

  for (let i = 0; i < files.length; i += concurrency) {
    const batch = files.slice(i, i + concurrency);

    const batchResults = await Promise.all(
      batch.map(async f => {
        const result = await uploadFile(path.join(directory, f), timelineId, apiKey, sessionCookie, existingChains, existingEntities);
        return result;
      })
    );

    results.push(...batchResults);
    console.log(`Progress: ${i + batch.length}/${files.length}\n`);
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
  }

  // Summary
  console.log('\n=== Upload Summary ===');
  const successful = results.filter(r => r.status === 200);
  const failed = results.filter(r => r.status !== 200);
  console.log(`✓ Successful: ${successful.length}`);
  console.log(`✗ Failed: ${failed.length}`);

  if (failed.length > 0) {
    console.log('\nFailed files:');
    failed.forEach(r => console.log(`  - ${r.file}: ${r.status} ${r.error || ''}`));
  }
}

// Usage
const timelineId = '68dd6c01f4b076fb062e237c';
const sessionCookie = 'next-auth.csrf-token=6f3be2c3212819217a0dc826941ed86ea5341ef7372e81acb8f0b1077bc947e7%7C2762dcba1200e830d411a5635c77b956a21f4987b488aa7857895612c5faa7ce; next-auth.callback-url=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Fsignin; __next_hmr_refresh_hash__=581; next-auth.session-token=eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..nJGrFBBV4aeTJmcK.WgK3Y9wQpxaK_3LvcefQh_Eo7YHzmZyEOHoyENA0KYf1mgny4JVOY7M0kJMlcOIg96sRyDXVcb3h-uveztyFomDdpG7_I1XVR4tW4KyiuE0xRwDo3_6voIXH0V-HfGg1lQfFgkIKjTvIm7Ljbx3PJi25eFJTazdNiFRLS1xSEl2LLPPJ5wOJhqnynxaWfbMt8B8.dbZUis9-uBufc02kvsKmlQ';
const directory = '../timeline-of-terror/timelines/key-events';

console.log('Starting batch upload...');
batchUpload(directory, timelineId, sessionCookie)
  .then(() => {
    console.log('\n✓ Batch upload complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n✗ Batch upload failed:', error);
    process.exit(1);
  });
