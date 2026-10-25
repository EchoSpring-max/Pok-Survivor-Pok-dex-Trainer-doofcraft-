const test = require('node:test');
const assert = require('node:assert/strict');
const { activityStateFromUrl, isValidClientId } = require('../src/discord-presence');

test('validates Discord snowflake application ids', () => {
  assert.equal(isValidClientId('12345678901234567'), true);
  assert.equal(isValidClientId('12345678901234567890'), true);
  assert.equal(isValidClientId('not-a-client-id'), false);
});

test('maps game routes to privacy-safe presence text', () => {
  assert.equal(activityStateFromUrl('https://pokesurvivor.doofcraft.com/#login'), 'At the login screen');
  assert.equal(activityStateFromUrl('https://pokesurvivor.doofcraft.com/#menu'), 'In the main menu');
  assert.equal(activityStateFromUrl('https://pokesurvivor.doofcraft.com/#multiplayer'), 'Playing multiplayer');
});
