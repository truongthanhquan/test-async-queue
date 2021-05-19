// #!/usr/bin/env node

const amqp = require('amqplib/callback_api');
const { resolve, reject } = require('bluebird');
const EventEmitter = require('events');
class MyEmitter extends EventEmitter { }

class RequestQueue {
    constructor() { }

    init(cb) {
        this.emitter = new MyEmitter();
        const self = this;
        amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost', function (error0, connection) {
            if (error0) {
                throw error0;
            }
            self.connection = connection;

            connection.createChannel(function (error1, channel) {
                if (error1) {
                    return reject(error1);
                }

                self.channel = channel;

                channel.assertQueue('', {
                    exclusive: true
                }, function (error2, q) {
                    if (error2) {
                        throw error2;
                    }
                    self.q = q;

                    console.log('Response consume');
                    channel.consume(q.queue, function (msg) {
                        console.info("Message: ", msg.content.toString());
                        if (msg.properties.correlationId) {
                            let mes = msg.content.toString();
                            if (!self.emitter.emit(msg.properties.correlationId, mes)) {
                                console.error("Missing listen of correlationId: ", msg.properties.correlationId, mes);
                            }
                        }
                    }, {
                        noAck: true
                    });

                    // Callback
                    cb();
                });
            });
        });
    }

    sendRequest(message) {
        const correlationId = generateUuid();
        const self = this;
        const result = new Promise((resolve, reject) => {
            self.emitter.once(correlationId, (v) => {
                console.info(' [.] Got %s', v);
                resolve(v);
            });
        });

        self.channel.sendToQueue('rpc_queue', Buffer.from(message.toString()), {
            correlationId: correlationId,
            replyTo: self.q.queue
        });
        return result;
    }
}


function generateUuid() {
    return Math.random().toString() +
        Math.random().toString() +
        Math.random().toString();
}


const express = require('express');
const app = express();
const port = 3000;
const rq = new RequestQueue();

app.get('/', (req, res) => {
    const num = parseInt(req.query.num);
    console.info("Request num: ", num);
    rq.sendRequest(num).then((v) => res.send(v));
});

rq.init(() => {
    const args = process.argv.slice(2);
    app.listen(args[0] || port, () => {
        console.log(`Example app listening at http://localhost:${port}`);
        console.log(`Use this url for test http://localhost:${port}?num=1`);
    });
});
