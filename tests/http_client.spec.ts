/*
 * @adonisjs/transmit-client
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { HttpClient } from '../src/http_client.js'

test.group('HttpClient', () => {
  test('should create a request instance', ({ assert }) => {
    const client = new HttpClient({
      baseUrl: 'http://localhost',
      uid: '1',
    })

    const request = client.createRequest('/test', { foo: 'bar' })

    assert.equal(request.url, 'http://localhost/test')
    assert.equal(request.method, 'POST')
    assert.equal(request.headers.get('Content-Type'), 'application/json')
    assert.equal(request.headers.get('X-XSRF-TOKEN'), '')
    assert.equal(request.credentials, 'include')
  })

  test('should retrieve XSRF token from cookies', ({ assert }) => {
    // @ts-expect-error
    globalThis.document = {
      cookie: 'XSRF-TOKEN=1234',
    }

    const client = new HttpClient({
      baseUrl: 'http://localhost',
      uid: '1',
    })

    const request = client.createRequest('/test', { foo: 'bar' })

    assert.equal(request.headers.get('X-XSRF-TOKEN'), '1234')
  })
})
