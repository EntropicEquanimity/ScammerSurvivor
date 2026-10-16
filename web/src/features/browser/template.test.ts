import test from 'node:test';
import assert from 'node:assert/strict';
import { templateKind, templatePage } from './template.ts';

const card = (displayName: string, text: string, institutionId?: string) => ({
  sender: { displayName, maskedNumber: '', ...(institutionId ? { institutionId } : {}) },
  setup: [{ id: 's1', text: 'Hello.' }],
  ask: [{ id: 'a1', text }],
});

test('the page kind follows the sender', () => {
  assert.equal(templateKind(card('Harbourline Bank', '').sender), 'sign_in');
  assert.equal(templateKind(card('Someone', '', 'wallet').sender), 'sign_in');
  assert.equal(templateKind(card('Northgate Parcels', '').sender), 'redelivery');
  assert.equal(templateKind(card('Kai', '').sender), 'continue');
});

test('the host is the first .example host in the message, and a sign-in asks for name and password', () => {
  const page = templatePage(card('Harbourline Bank', 'Check it at https://harbourline-verify.example/login today.'));
  assert.equal(page.host, 'harbourline-verify.example');
  assert.deepEqual(page.fields, ['name', 'password']);
});

test('a courier page asks for card and code; anyone else gets a continue page with no rows', () => {
  assert.deepEqual(templatePage(card('Northgate Parcels', 'www.ng-desk.example')).fields, ['card', 'code']);
  const other = templatePage(card('Kai', 'see shop.example'));
  assert.deepEqual(other.fields, []);
  assert.equal(other.host, 'shop.example');
});

test('a message with no link of its own opens a page that says so', () => {
  const page = templatePage(card('Harbourline Bank', 'View it in the official app.'));
  assert.equal(page.title, 'No link to open');
  assert.deepEqual(page.lines.map((line) => line.text), ['There is no link in this message.']);
  assert.deepEqual(page.fields, []);
});

test('a realistic host opens the template under that host', () => {
  assert.equal(templatePage(card('Northgate Parcel', 'Book at northgate-parcel-help.top/fee today.')).host, 'northgate-parcel-help.top');
  assert.equal(templatePage(card('Harbourline Bank', 'Sign in at harbourline-secure.net now.')).host, 'harbourline-secure.net');
});
