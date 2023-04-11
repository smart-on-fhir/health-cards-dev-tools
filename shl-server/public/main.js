
const cache = {};

// Calls the Rest API on the server.
// Caller will specify when return type is other than JSON
//
export async function restCall(url, data, options) {

    const xhr = new XMLHttpRequest();

    options = {
        method: 'POST',
        responseType: 'json',
        cache: false,
        ...options
    }

    if (options.cache && cache[url]?.[data instanceof Object ? JSON.stringify(data) : data]) {
        const cached = cache[url][data instanceof Object ? JSON.stringify(data) : data];
        console.log(`cached: ${url}`)
        return Promise.resolve(cached);
    }

    return new Promise(function (resolve, reject) {

        xhr.open(options.method, url);

        if (data instanceof Object) {
            xhr.setRequestHeader("Content-Type", "application/json");
            data = JSON.stringify(data);
        }
        else if (typeof data === 'string') {
            xhr.setRequestHeader("Content-Type", "text/plain");
        }

        xhr.responseType = options.responseType;

        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4) {

                if (options.cache) {
                    cache[url] = cache[url] || {}
                    cache[url][data instanceof Object ? JSON.stringify(data) : data] = xhr.response;
                }

                resolve(xhr.response);
            }
        };

        xhr.onerror = function (err) {
            reject(err);
        }

        options.method === 'POST' ? xhr.send(data) : xhr.send();

    });
}