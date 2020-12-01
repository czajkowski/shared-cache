const noop = () => {};

const WORKER_RESPONSE_TIMEOUT = 200;
const DEFERRED_MESSAGE_TIMEOUT = 500000;

const getPromise = () => {
    let resolve;
    let reject;

    return {
        promise: new Promise((res, rej) => {
            resolve = res;
            reject = rej;
        }),
        resolve,
        reject,
    };
}

const Operation = {
    Get: 'get',
    Add: 'add',
    Delete: 'delete',
    Defer: 'defer',
    Resolve: 'resolve',
    Reject: 'reject',
};

const Status = {
    Success: 'success',
    Error: 'error',
    Wait: 'wait',
};

export default class ClientCache {
    constructor () {
        this._lastMessageId = 0;
        this._pendingMessages = {};

        this._receiveMessage = this._receiveMessage.bind(this);

        this._worker = this._createWorker();
        this._worker.port.addEventListener('message', this._receiveMessage);
        this._worker.port.start();
    }

    _createWorker() {
        // const source = 'console.log("Imma worker!")';
        // const url = 'data:application/javascript;base64,' + btoa(source);
        const worker = new SharedWorker('../src/worker.js');

        return worker;
    }

    _receiveMessage(event) {
        const {
            id,
            data: {
                status,
                value,
            } = {},
        } = event.data || {};

        if (this._pendingMessages[id]) {
            if (status === Status.Wait) {
                clearTimeout(this._pendingMessages[id].timeout);

                this._pendingMessages[id].timeout = setTimeout(() => {
                    reject(new Error('Deferred message timeout.'));
                }, DEFERRED_MESSAGE_TIMEOUT);
            } else if (status === Status.Success) {
                this._pendingMessages[id].resolve(value);
            } else {
                this._pendingMessages[id].reject(new Error('Value not found.'));
            }
        }
    }

    _sendMessage(operation, key, value) {
        const id = this._lastMessageId++;
        const {
            promise,
            resolve: _resolve,
            reject: _reject,
        } = getPromise();

        const cleanup = () => {
            if (this._pendingMessages[id]) {
                clearTimeout(this._pendingMessages[id].timeout)
                delete this._pendingMessages[id];
            }
        };

        const resolve = (responseData) => {
            cleanup();
            _resolve(responseData);
        }

        const reject = (error) => {
            cleanup();
            _reject(error);
        }

        console.log(id, 'Sending', operation, key, value);
        this._worker.port.postMessage({
            id,
            data: {
                operation,
                key,
                value,
            },
        })

        const timeout = setTimeout(() => {
            reject(new Error('Worker response timeout.'));
        }, WORKER_RESPONSE_TIMEOUT);

        this._pendingMessages[id] = {
            promise,
            resolve,
            reject,
            timeout,
        };

        return promise;
    }

    get(key) {
        return this._sendMessage(Operation.Get, key);
    }

    delete(key) {
        return this._sendMessage(Operation.Delete, key);
    }

    add(key, value) {
        if (value instanceof Promise) {
            return this._sendMessage(Operation.Defer, key)
                .then(() => value
                    .then(data => this._sendMessage(Operation.Resolve, key, data))
                    .catch(() => this._sendMessage(Operation.Reject, key))
                )
        } else {
            return this._sendMessage(Operation.Add, key, value);
        }
    }

}