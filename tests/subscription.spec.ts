/*
 * @adonisjs/transmit-client
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { Hook } from '../src/hook.js'
import { Subscription } from '../src/subscription.js'
import { FakeHttpClient } from '../test_utils/fake_http_client.js'

const client = new FakeHttpClient({
  baseUrl: 'http://localhost',
  uid: '1',
})

const hook = new Hook()

function subscriptionFactory(httpClient: FakeHttpClient = client) {
  const subscription: Subscription = new Subscription({
    channel: 'foo',
    httpClient,
    hooks: hook,
    onCreate: () => subscription.$subscribe(),
  })

  return subscription
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

  test('should not create a subscription again once deleted', async ({ assert }) => {
    const subscription = subscriptionFactory()

    await subscription.create()
    await subscription.delete()
    await subscription.create()

    assert.isTrue(subscription.isDeleted)
    assert.isFalse(subscription.isCreated)
    assert.lengthOf(client.sentRequests, 2)
  })

  test('should stay deleted when a late subscribe response arrives', async ({ assert }) => {
    let releaseLateResponse!: () => void
    const lateResponse = new Promise<void>((resolve) => (releaseLateResponse = resolve))
    let calls = 0

    //? Holds back the response of the second subscribe request
    const slowClient = new (class extends FakeHttpClient {
      async send(request: Request) {
        if (++calls === 2) await lateResponse
        return super.send(request)
      }
    })({ baseUrl: 'http://localhost', uid: '1' })

    const subscription = subscriptionFactory(slowClient)

    const first = subscription.create()
    const second = subscription.create()

    await first
    await subscription.delete()

    releaseLateResponse()
    await second

    assert.isTrue(subscription.isDeleted)
    assert.isFalse(subscription.isCreated)
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

  test('should keep running handlers when one throws', async ({ assert }) => {
    assert.plan(1)

    const subscription = subscriptionFactory()

    subscription.onMessage(() => {
      throw new Error('Boom')
    })

    subscription.onMessage(() => {
      assert.isTrue(true)
    })

    subscription.$runHandler(null)
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

  test('should get the number of registered handlers', async ({ assert }) => {
    const subscription = subscriptionFactory()

    subscription.onMessage(() => {})
    subscription.onMessage(() => {})

    assert.equal(subscription.handlerCount, 2)
  })
})
