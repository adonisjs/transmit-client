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
import { HookEvent } from '../src/hook_event.js'

test.group('Hook', () => {
  test('should register a handler for {$self} event')
    .with([
      HookEvent.BeforeSubscribe,
      HookEvent.BeforeUnsubscribe,
      HookEvent.OnReconnectAttempt,
      HookEvent.OnSubscribeFailed,
      HookEvent.OnSubscription,
      HookEvent.OnUnsubscription,
    ])
    .run(({ assert }, event) => {
      assert.plan(1)

      const hook = new Hook()

      hook.register(event, (payload) => {
        assert.equal(payload, 1)
      })

      // @ts-expect-error
      hook[event](1)
    })

  test('should register multiple handlers for {$self} event')
    .with([
      HookEvent.BeforeSubscribe,
      HookEvent.BeforeUnsubscribe,
      HookEvent.OnReconnectAttempt,
      HookEvent.OnSubscribeFailed,
      HookEvent.OnSubscription,
      HookEvent.OnUnsubscription,
    ])
    .run(({ assert }, event: HookEvent) => {
      assert.plan(2)

      const hook = new Hook()

      hook.register(event, (payload) => {
        assert.equal(payload, 1)
      })

      hook.register(event, (payload) => {
        assert.equal(payload, 1)
      })

      // @ts-expect-error
      hook[event](1)
    })

  test('should register a handler for {$self} event')
    .with([HookEvent.OnReconnectFailed])
    .run(({ assert }, event) => {
      assert.plan(1)

      const hook = new Hook()

      hook.register(event, () => {
        assert.isTrue(true)
      })

      hook[event]()
    })

  test('should register multiple handlers for {$self} event')
    .with([HookEvent.OnReconnectFailed])
    .run(({ assert }, event) => {
      assert.plan(2)

      const hook = new Hook()

      hook.register(event, () => {
        assert.isTrue(true)
      })

      hook.register(event, () => {
        assert.isTrue(true)
      })

      hook[event]()
    })

  test('should not throw error no handler are defined', () => {
    const hook = new Hook()

    hook.beforeSubscribe(new Request('http://localhost'))
  })
})
