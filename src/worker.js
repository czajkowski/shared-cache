const DEFERRED_MESSAGE_TIMEOUT = 500000;

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

// Stores cached values
const cache = Object.create(null);

// Stores deferred data:
// {
//     key: {
//         timeout,
//         clients: {
//             messageId: port,
//         }
//     }
// }
const deferredCache = Object.create(null);

self.__workerData = {
    cache,
    deferredCache,
};

self.addEventListener('connect', (event) => {
    const [port] = event.ports;

    const sendResponse = (id, status, value) => {
        port.postMessage({
            id,
            data: {
                status,
                value,
            }
        });
    };

    const operations = {
        [Operation.Add]: (id, key, value) => {
            cache[key] = value;

            console.log(id, 'Added value', key, value, Status.Success);
            sendResponse(id, Status.Success);
        },

        [Operation.Delete]: (id, key) => {
            delete cache[key];

            console.log(id, 'Deleted value', key, undefined, Status.Success);
            sendResponse(id, Status.Success);
        },

        [Operation.Get]: (id, key) => {
            if (deferredCache[key]) {
                deferredCache[key].clients[id] = port;

                console.log(id, 'Get value', key, undefined, Status.Wait);
                sendResponse(id, Status.Wait);
            } else {
                const value = cache[key];
                const status = value === undefined ? Status.Error : Status.Success;

                console.log(id, 'Get value', key, undefined, status);
                sendResponse(id, status, value);
            }
        },

        [Operation.Defer]: (id, key) => {
            if (!deferredCache[key]) {
                deferredCache[key] = {
                    timeout: setTimeout(() => {
                        operations[Operation.Reject](id, key);
                    }, DEFERRED_MESSAGE_TIMEOUT),
                    clients: {},
                };

                console.log(id, 'Defered value', key, undefined, Status.Success);
                sendResponse(id, Status.Success);
            } else {
                console.log(id, 'Defered value', key, undefined, Status.Error);
                sendResponse(id, Status.Error);
            }
        },

        [Operation.Resolve]: (id, key, value) => {
            if (deferredCache[key]) {
                clearTimeout(deferredCache[key].timeout);

                Object.entries(deferredCache[key].clients).forEach(([id, clientPort]) => {
                    clientPort.postMessage({
                        id,
                        data: {
                            status: Status.Success,
                            value,
                        }
                    });
                });

                delete deferredCache[key];
                cache[key] = value;

                console.log(id, 'Resolved value', key, value, Status.Success);
                sendResponse(id, Status.Success);
            } else {
                console.log(id, 'Resolved value', key, value, Status.Error);
                sendResponse(id, Status.Error);
            }
        },

        [Operation.Reject]: (id, key) => {
            if (deferredCache[key]) {
                clearTimeout(deferredCache[key].timeout);

                Object.entries(deferredCache[key].clients).forEach(([id, clientPort]) => {
                    clientPort.postMessage({
                        id,
                        data: {
                            status: Status.Error,
                        }
                    });
                });

                delete deferredCache[key];

                console.log(id, 'Reject value', key, undefined, Status.Success);
                sendResponse(id, Status.Success);
            } else {
                console.log(id, 'Reject value', key, undefined, Status.Error);
                sendResponse(id, Status.Error);
            }
        }
    };

    port.addEventListener('message', ({ data }) => {
        const {
            id,
            data: {
                operation,
                key,
                value,
            }
        } = data;

        const handler = operations[operation];

        if (handler) {
            handler(id, key, value);
        } else {
            sendResponse(id, Status.Error);
        }
    });

    port.start();
});
