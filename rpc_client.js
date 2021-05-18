#!/usr/bin/env node

var amqp = require('amqplib/callback_api');
const EventEmitter = require('events');

class MyEmitter extends EventEmitter { }

const myEmitter = new MyEmitter();

var gQ;
(async function () {
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
                    console.log('Consume fib');

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

})();

const express = require('express')
const app = express()
const port = 3000

app.get('/', (req, res) => {
    amqp.connect('amqp://localhost', async function (error0, connection) {
        if (error0) {
            throw error0;
        }

        connection.createChannel(async function (error1, channel) {
            if (error1) {
                throw error1;
            }
            var correlationId = generateUuid();
            var num = parseInt(req.query.num);

            console.log(' [x] Requesting fib(%d)', num);
            await new Promise((resolve, reject) => {
                myEmitter.on(correlationId, (v) => {
                    resolve()
                    console.info(' [.] Got %s', v);
                    res.send(v);
                    // setTimeout(function () {
                    //     connection.close();
                    //     process.exit(0)
                    // }, 500);
                });

                channel.sendToQueue('rpc_queue',
                    Buffer.from(num.toString()), {
                    correlationId: correlationId,
                    replyTo: gQ.queue
                });
            })
            console.log("End");
        });
    });

    function generateUuid() {
        return Math.random().toString() +
            Math.random().toString() +
            Math.random().toString();
    }
})

app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`)
    console.log(`Use this url for test http://localhost:${port}?num=1`)
})