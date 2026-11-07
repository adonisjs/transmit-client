/*
 * @adonisjs/transmit-client
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { Hook, type HookHandlers } from '../src/hook.js'
import { HookEvent } from '../src/hook_event.js'

const argsByEvent: { [E in HookEvent]: Parameters<HookHandlers[E]> } = {
  [HookEvent.BeforeSubscribe]: [new Request('http://localhost/subscribe')],
  [HookEvent.BeforeUnsubscribe]: [new Request('http://localhost/unsubscribe')],
  [HookEvent.OnReconnectAttempt]: [3],
  [HookEvent.OnReconnectFailed]: [],
  [HookEvent.OnSubscribeFailed]: [new Response(null, { status: 500 })],
  [HookEvent.OnSubscription]: ['news'],
  [HookEvent.OnUnsubscription]: ['news'],
}

test.group('Hook', () => {
  test('should call every handler registered for {$self} event with its arguments')
    .with(Object.values(HookEvent))
    .run(({ assert }, event) => {
      assert.plan(2)

      const hook = new Hook()
      const args = argsByEvent[event]

      hook.register(event, (...received: unknown[]) => assert.deepEqual(received, args))
      hook.register(event, (...received: unknown[]) => assert.deepEqual(received, args))

      // Handlers of other events must not run.
      for (const other of Object.values(HookEvent)) {
        if (other !== event) {
          hook.register(other, () => assert.fail(`${other} handler should not run`))
        }
      }

      hook.run(event, ...args)
    })

  test('should not throw error no handler are defined', () => {
    const hook = new Hook()

    hook.run(HookEvent.BeforeSubscribe, new Request('http://localhost'))
  })
})
