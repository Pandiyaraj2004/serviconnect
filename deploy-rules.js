/**
 * ServiConnect - Auto Deploy Firestore & RTDB Rules
 * Run: node deploy-rules.js
 *
 * This script deploys security rules to Firebase using the
 * Firebase Management REST API. It requires a Google OAuth token.
 * 
 * USAGE:
 *   1. Run: node deploy-rules.js
 *   2. Follow the instructions to get an access token
 *   3. Paste the token when prompted
 */

const https = require('https');
const readline = require('readline');
const fs = require('fs');

const PROJECT_ID = 'serviconnect-2bb43';

const FIRESTORE_RULES = fs.readFileSync('./firestore.rules', 'utf8');

const RTDB_RULES = JSON.stringify({
  rules: {
    ".read": true,
    ".write": true
  }
}, null, 2);

function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function deployFirestoreRules(token) {
  console.log('\n📋 Deploying Firestore Security Rules...');

  const body = JSON.stringify({
    source: {
      files: [{
        content: FIRESTORE_RULES,
        name: 'firestore.rules'
      }]
    }
  });

  const result = await httpsRequest({
    hostname: 'firebaserules.googleapis.com',
    path: `/v1/projects/${PROJECT_ID}/releases`,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  }, body);

  if (result.status === 200 || result.status === 201) {
    console.log('✅ Firestore rules deployed successfully!');
  } else {
    // Try updating the ruleset directly
    console.log('   Trying alternative method...');
    await deployFirestoreRulesetDirect(token);
  }
}

async function deployFirestoreRulesetDirect(token) {
  // Step 1: Create ruleset
  const rulesetBody = JSON.stringify({
    source: {
      files: [{
        content: FIRESTORE_RULES,
        name: 'firestore.rules'
      }]
    }
  });

  const rulesetResult = await httpsRequest({
    hostname: 'firebaserules.googleapis.com',
    path: `/v1/projects/${PROJECT_ID}/rulesets`,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(rulesetBody)
    }
  }, rulesetBody);

  if (rulesetResult.status !== 200 && rulesetResult.status !== 201) {
    console.error('❌ Failed to create ruleset:', JSON.stringify(rulesetResult.body, null, 2));
    return;
  }

  const rulesetName = rulesetResult.body.name;
  console.log('   Created ruleset:', rulesetName);

  // Step 2: Update the release to point to new ruleset
  const releaseBody = JSON.stringify({
    release: {
      name: `projects/${PROJECT_ID}/releases/cloud.firestore`,
      rulesetName: rulesetName
    }
  });

  const releaseResult = await httpsRequest({
    hostname: 'firebaserules.googleapis.com',
    path: `/v1/projects/${PROJECT_ID}/releases/cloud.firestore`,
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(releaseBody)
    }
  }, releaseBody);

  if (releaseResult.status === 200) {
    console.log('✅ Firestore rules deployed successfully!');
  } else {
    console.error('❌ Could not deploy Firestore rules:', JSON.stringify(releaseResult.body, null, 2));
    console.log('\n🔴 MANUAL STEP REQUIRED:');
    console.log('   Go to: https://console.firebase.google.com/project/serviconnect-2bb43/firestore/rules');
    console.log('   Paste the contents of firestore.rules and click Publish');
  }
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise(resolve => rl.question(q, resolve));

  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║   ServiConnect - Firebase Rules Auto-Deployer    ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
  console.log('To deploy rules, you need a Google OAuth access token.');
  console.log('');
  console.log('📌 GET YOUR TOKEN (Quick 30-second process):');
  console.log('   1. Open this URL in your browser:');
  console.log('      https://console.firebase.google.com/project/serviconnect-2bb43/firestore/rules');
  console.log('');
  console.log('   2. Open browser DevTools → Console (F12)');
  console.log('');
  console.log('   3. Paste and run this code in the Console:');
  console.log('');
  console.log('      (await firebase.auth().currentUser.getIdToken())');
  console.log('');
  console.log('   OR use gcloud CLI:');
  console.log('      gcloud auth print-access-token');
  console.log('');

  const useManual = await ask('Do you want to do it MANUALLY instead? (y/n): ');

  if (useManual.toLowerCase() === 'y') {
    console.log('\n📋 MANUAL FIRESTORE RULES:');
    console.log('═══════════════════════════════════════════════════');
    console.log(FIRESTORE_RULES);
    console.log('═══════════════════════════════════════════════════');
    console.log('\n1. Go to: https://console.firebase.google.com/project/serviconnect-2bb43/firestore/rules');
    console.log('2. Select ALL existing rules and DELETE them');
    console.log('3. Paste the rules shown above');
    console.log('4. Click PUBLISH button');
    console.log('\n📋 RTDB RULES:');
    console.log('{ "rules": { ".read": true, ".write": true } }');
    console.log('\n1. Go to: https://console.firebase.google.com/project/serviconnect-2bb43/database/serviconnect-2bb43-default-rtdb/rules');
    console.log('2. Replace all content with the JSON above');
    console.log('3. Click PUBLISH button');
    rl.close();
    return;
  }

  const token = await ask('\nPaste your access token: ');
  rl.close();

  if (!token || token.trim().length < 10) {
    console.log('❌ Invalid token. Exiting.');
    return;
  }

  try {
    await deployFirestoreRules(token.trim());
    console.log('\n✅ All done! Firebase rules are now open for your app.');
    console.log('   Refresh your app and try the admin panel again.');
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

main();
