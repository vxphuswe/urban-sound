import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPrivateIp } from '../api/fetch-audio.js';

test('chặn địa chỉ nội bộ, cho phép địa chỉ công khai', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.1.1', '172.20.0.1', '169.254.169.254', '::1', 'fd00::1', '::ffff:127.0.0.1', '0.0.0.0'])
    assert.equal(isPrivateIp(ip), true, ip);
  for (const ip of ['8.8.8.8', '104.16.0.1', '2606:4700::1111'])
    assert.equal(isPrivateIp(ip), false, ip);
});
