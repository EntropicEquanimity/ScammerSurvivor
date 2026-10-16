import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOST_IN_TEXT, hasOffListLink, hostsIn, isGameHost, isReservedHost, linkHostsIn, registrableOf, withoutTld } from './links.ts';

test('a host on every realistic ending reads as a link', () => {
  for (const host of ['northgate-parcel.com', 'harbourline-secure.net', 'parcel-fee.top', 'prize-desk.info', 'kestrel.co', 'pay.example']) {
    assert.ok(HOST_IN_TEXT.test(`Open ${host}/now today.`), host);
  }
});

test('plain words and longer endings do not read as links', () => {
  assert.ok(!HOST_IN_TEXT.test('See you at the cafe. Tomorrow works.'));
  assert.ok(!HOST_IN_TEXT.test('Track it on parcel.company today'));
  assert.ok(!HOST_IN_TEXT.test('Ask at the counter.'));
});

test('hostsIn lists each host lowercased, .com not cut to .co', () => {
  assert.deepEqual(hostsIn('Pay at Northgate-Parcel-Help.com/fee or www.harbourline-bank.com today.'), ['northgate-parcel-help.com', 'www.harbourline-bank.com']);
});

test('the Director may write .com .net .top .info and the reserved fallbacks, never .co or others', () => {
  for (const host of ['northgate-parcel.com', 'harbourline-secure.net', 'parcel-fee.top', 'prize-desk.info', 'pay.example']) assert.ok(isGameHost(host), host);
  for (const host of ['kestrel.co', 'parcel.xyz', 'Northgate.com', 'pay', 'bad_host.com']) assert.ok(!isGameHost(host), host);
});

test('reserved hosts, registrable names and site names', () => {
  assert.ok(isReservedHost('pay.example'));
  assert.ok(!isReservedHost('pay.com'));
  assert.equal(registrableOf('pay.Northgate-Parcel.com'), 'northgate-parcel.com');
  assert.equal(withoutTld('harbourline-secure.net'), 'harbourline-secure');
  assert.equal(withoutTld('harbour-secure.example'), 'harbour-secure');
});

test('linkHostsIn reads every link shape; hasOffListLink catches endings off the list', () => {
  assert.deepEqual(linkHostsIn('Go to https://www.secure-pay.com/now or pay.xyz'), ['secure-pay.com', 'pay.xyz']);
  assert.ok(hasOffListLink('Visit pay.xyz now'));
  assert.ok(hasOffListLink('Visit kestrel-jobs.co now'));
  assert.ok(!hasOffListLink('Visit kestrel-jobs.com or pay.example now'));
  assert.ok(!hasOffListLink('No link at all.'));
});
