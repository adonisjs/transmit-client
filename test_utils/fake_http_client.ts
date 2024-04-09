import { HttpClient } from '../src/http_client.js'

export class FakeHttpClient extends HttpClient {
  sentRequests: Request[] = []

  async send(request: Request) {
    this.sentRequests.push(request)

    return new Response()
  }

  reset() {
    this.sentRequests = []
  }
}
