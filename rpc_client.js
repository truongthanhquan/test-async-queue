#!/usr/bin/env node

var amqp = require('amqplib/callback_api');
const { reject } = require('bluebird');
const EventEmitter = require('events');

class MyEmitter extends EventEmitter { }

const myEmitter = new MyEmitter();

var args = process.argv.slice(2);

if (args.length == 0) {
    console.log("Usage: rpc_client.js num");
    process.exit(1);
}

(async function () {
    var gQ;
    await new Promise((resolve, reject) => {
        amqp.connect('amqp://localhost', async function (error0, connection) {
            if (error0) {
                throw error0;
            }
            connection.createChannel(async function (error1, channel) {
                if (error1) {
                    return reject(error1);
                }
                channel.assertQueue('', {
                    exclusive: true
                }, async function (error2, q) {
                    if (error2) {
                        throw error2;
                    }
                    var num = parseInt(args[0]);

                    console.log(' [x] Consume fib(%d)', num);

                    channel.consume(q.queue, function (msg) {
                        console.info("Message: ", msg.content.toString());
                        if (msg.properties.correlationId) {
                            myEmitter.emit(msg.properties.correlationId, msg.content.toString());
                        }
                    }, {
                        noAck: true
                    });
                    gQ = q
                    resolve();
                });
            });
        });
    });

    amqp.connect('amqp://localhost', async function (error0, connection) {
        if (error0) {
            throw error0;
        }

        connection.createChannel(async function (error1, channel) {
            if (error1) {
                throw error1;
            }
            var correlationId = generateUuid();
            var num = parseInt(args[0]);

            console.log(' [x] Requesting fib(%d)', num);
            await new Promise((resolve, reject) => {
                myEmitter.once(correlationId, (v) => {
                    resolve()
                    console.log(' [.] Got %s', v);
                    setTimeout(function () {
                        connection.close();
                        process.exit(0)
                    }, 500);
                });

                channel.sendToQueue('rpc_queue',
                    Buffer.from(num.toString()), {
                    correlationId: correlationId,
                    replyTo: gQ.queue
                });
            })
            console.log("test");
        });
    });

    function generateUuid() {
        return Math.random().toString() +
            Math.random().toString() +
            Math.random().toString();
    }
})();