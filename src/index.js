import ClientCache from './WorkerCache';

const noop = () => {};

const getMehods = (obj) => Object.getOwnPropertyNames(obj)
    .filter(name => typeof obj[name] === 'function');

const getObjectKey = (str) => {
    let hash = 0;

    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }

    return hash;
}

const getArgsKey = (args) => JSON.stringify(args);

const cache = new ClientCache();

const applyCache = (obj, objectKey) => {
    const methods = getMehods(obj);

    objectKey = objectKey || getObjectKey(methods.sort().join(';'));

    methods.forEach((method) => {
        const baseMethod = obj[method].bind(obj);

        obj[method] = (...args) => {
            const cacheKey = `${objectKey}_${method}_${getArgsKey(args)}`;

            return cache.get(cacheKey)
                .catch(() => {
                    const returnValue = baseMethod(...args);

                    return cache.add(cacheKey, returnValue)
                        .catch(noop)
                        .then(() => returnValue)
                })
        };

        obj[method].clearCache = (...args) => {
            const cacheKey = `${objectKey}_${method}_${getArgsKey(args)}`;

            return cache.delete(cacheKey);
        }
    });

    return obj;
};


export default applyCache;