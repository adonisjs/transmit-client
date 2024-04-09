/*
 * @adonisjs/transmit-client
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { setTimeout } from 'node:timers/promises'
import { test } from '@japa/runner'
import { Hook } from '../src/hook.js'
import { Subscription } from '../src/subscription.js'
import { FakeHttpClient } from '../test_utils/fake_http_client.js'
import { TransmitStatus } from '../src/transmit_status.js'

const client = new FakeHttpClient({
  baseUrl: 'http://localhost',
  uid: '1',
})

const hook = new Hook()

function subscriptionFactory(statusFactory?: () => TransmitStatus) {
  return new Subscription({
    channel: 'foo',
    httpClient: client,
    hooks: hook,
    getEventSourceStatus: () => statusFactory?.() ?? 'connected',
  })
}

test.group('Subscription', (group) => {
  group.each.teardown(() => client.reset())

  test('should be pending by default', ({ assert }) => {
    const subscription = subscriptionFactory()

    assert.isFalse(subscription.isCreated)
    assert.isFalse(subscription.isDeleted)
  })

  test('should create a subscription', async ({ assert }) => {
    const subscription = subscriptionFactory()

    await subscription.create()

    assert.isTrue(subscription.isCreated)
    assert.lengthOf(client.sentRequests, 1)
  })

  test('should not create a subscription when already created', async ({ assert }) => {
    const subscription = subscriptionFactory()

    await subscription.create()
    await subscription.create()

    assert.isTrue(subscription.isCreated)
    assert.lengthOf(client.sentRequests, 1)
  })

  test('should not create a subscription when event source is not connected', async ({
    assert,
  }) => {
    let status: TransmitStatus = TransmitStatus.Connecting
    const subscription = subscriptionFactory(() => status)

    void subscription.create()

    //? Waiting for the request to be sent
    await setTimeout(500)

    assert.isFalse(subscription.isCreated)
    assert.lengthOf(client.sentRequests, 0)

    //? Changing the status to connected to avoid setTimeout loop
    status = TransmitStatus.Connected
  })

  test('should delete a subscription', async ({ assert }) => {
    const subscription = subscriptionFactory()

    await subscription.create()

    assert.isTrue(subscription.isCreated)
    assert.lengthOf(client.sentRequests, 1)

    await subscription.delete()

    assert.isTrue(subscription.isDeleted)
    assert.lengthOf(client.sentRequests, 2)
  })

  test('should not delete a subscription when already deleted', async ({ assert }) => {
    const subscription = subscriptionFactory()

    await subscription.create()

    assert.isTrue(subscription.isCreated)
    assert.lengthOf(client.sentRequests, 1)

    await subscription.delete()

    assert.isTrue(subscription.isDeleted)
    assert.lengthOf(client.sentRequests, 2)

    await subscription.delete()

    assert.lengthOf(client.sentRequests, 2)
  })

  test('should not delete a subscription when not created', async ({ assert }) => {
    const subscription = subscriptionFactory()

    await subscription.delete()

    assert.isFalse(subscription.isDeleted)
    assert.lengthOf(client.sentRequests, 0)
  })

  test('should register a handler', async ({ assert }) => {
    assert.plan(1)

    const subscription = subscriptionFactory()

    subscription.onMessage(() => {
      assert.isTrue(true)
    })

    subscription.$runHandler(null)
  })

  test('should run all registered handlers', async ({ assert }) => {
    assert.plan(2)

    const subscription = subscriptionFactory()

    subscription.onMessage((payload) => {
      assert.equal(payload, 1)
    })

    subscription.onMessage((payload) => {
      assert.equal(payload, 1)
    })

    subscription.$runHandler(1)
  })

  test('should run only once some handler', async ({ assert }) => {
    assert.plan(1)

    const subscription = subscriptionFactory()

    subscription.onMessageOnce(() => {
      assert.isTrue(true)
    })

    subscription.$runHandler(null)
    subscription.$runHandler(null)
  })
})
