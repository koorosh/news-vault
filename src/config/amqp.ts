import * as amqplib from 'amqplib'
import {Observable, Subject} from 'rxjs'
import {ParserTypes} from '../core/parsers'

export enum Queues {
  PARSED_PAGE = 'parsed_page',
  WATCH_PAGE = 'watch_page',
}

export type WatchPageMsg = {
  taskId: string
  url: string
  type: ParserTypes
}

export type ParsePageMsg = {
  taskId: string
  pageId: string
}

const host = process.env.AMQP_HOST || 'amqp://localhost'

const connection: Promise<amqplib.Channel> = amqplib.connect(host)
  .then(connection => connection.createChannel())

export function publishToQueue<T>(queue: Queues, data: T) {
  connection.then(channel => channel.sendToQueue(queue, Buffer.from(JSON.stringify(data))))
}

export function listenToQueue<T>(queue: Queues): Observable<T> {
  const source$ = new Subject<T>()

  connection.then(async channel => {
    await channel.assertQueue(queue)
    await channel.consume(queue, msg => {
      if (msg) {
        const data: T = JSON.parse(msg.content.toString())
        source$.next(data)
        // channel.ack(msg) // TODO: has to be ack after handling in code.
      }
    })
  })

  return source$.asObservable()
}

process.on('exit', () => {
  connection.then(async channel => {
    await channel.close()
    console.log(`Closing Amqp channel`)
  })
})