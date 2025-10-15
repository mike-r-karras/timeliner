// scripts/batch-upload.js  (CommonJS, Node 18+)

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

// --- helpers ---
async function fileFromPath(filepath) {
  const buf = await fsp.readFile(filepath);            // fine for .md files
  const name = path.basename(filepath);
  const type = name.toLowerCase().endsWith('.md') ? 'text/markdown' : 'application/octet-stream';
  return new File([buf], name, { type });
}

  async function uploadFile(filePath, timelineId, sessionCookie) {
    const fileName = path.basename(filePath);
    console.log(`  Uploading ${fileName}...`);

    try {
      const form = new FormData();
      form.append('file', fs.createReadStream(filePath));
      form.append('timelineId', timelineId);

      const response = await fetch('http://localhost:3000/api/parse-file', {
        method: 'POST',
        headers: {
          'Cookie': sessionCookie
        },
        body: form
      });

      const responseText = await response.text();
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = responseText;
      }

      // Log the actual response
      console.log(`    Status: ${response.status}`);
      if (response.status === 200) {
        if (responseData.event?._id) {
          console.log(`    ✓ Created event: ${responseData.event._id}`);
        } else {
          console.log(`    ⚠ Response:`, JSON.stringify(responseData).substring(0, 200));
        }
      } else {
        console.error(`    ✗ Error:`, JSON.stringify(responseData).substring(0, 200));
      }

      return {
        file: fileName,
        status: response.status,
        data: responseData
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

async function batchUpload(directory, timelineId, auth, concurrency = 1) {
  const { bearerToken, sessionCookie } = auth || {};
    console.log('Timeline ID:', timelineId);
  console.log('Session cookie:', sessionCookie);
  const files = fs.readdirSync(directory).filter(f => f.endsWith('.md'));
  console.log(`Found ${files.length} files to upload in ${directory}.`);
  if (files.length === 0) return;

  for (let i = 0; i < files.length; i += concurrency) {
    const batch = files.slice(i, i + concurrency);
    const results = await Promise.all(batch.map(async f => {
      const full = path.join(directory, f);
      try {
        const r = await uploadFile(full, timelineId, auth);
        console.log(`${r.ok ? '✓' : '✗'} ${f}: ${r.status}${r.ok ? '' : ` (${r.body?.slice(0,200)})`}`);
        return r;
      } catch (err) {
        console.error(`✗ ${f}: ${err.message}`);
        return { file: f, error: err.message };
      }
    }));
    console.log(`Progress: ${Math.min(i + batch.length, files.length)}/${files.length}`);
  }

  console.log('Batch upload complete.');
}

// ---- entrypoint ----
// Prefer a one-off Bearer token (server checks Authorization header):
const bearerToken = process.env.UPLOAD_ACCESS_TOKEN || '';

// Or, if you insist on NextAuth cookie, pass the exact Cookie header string: // next-auth.session-token=
  const sessionCookie = 'next-auth.csrf-token=6f3be2c3212819217a0dc826941ed86ea5341ef7372e81acb8f0b1077bc947e7%7C2762dcba1200e830d411a5635c77b956a21f4987b488aa7857895612c5faa7ce; next-auth.callback-url=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Fsignin; __next_hmr_refresh_hash__=581; next-auth.session-token=eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..nJGrFBBV4aeTJmcK.WgK3Y9wQpxaK_3LvcefQh_Eo7YHzmZyEOHoyENA0KYf1mgny4JVOY7M0kJMlcOIg96sRyDXVcb3h-uveztyFomDdpG7_I1XVR4tW4KyiuE0xRwDo3_6voIXH0V-HfGg1lQfFgkIKjTvIm7Ljbx3PJi25eFJTazdNiFRLS1xSEl2LLPPJ5wOJhqnynxaWfbMt8B8.dbZUis9-uBufc02kvsKmlQ';
(async () => {
  console.log('Starting batch upload...');
  await batchUpload(
    '../../timeline-of-terror/timelines/key-events',
    '68dd6c01f4b076fb062e237c',
    { bearerToken, sessionCookie },
  );
})().catch(err => {
  console.error(err);
  process.exit(1);
});
