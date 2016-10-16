function FileBufferReceiver(fbr) {
    var fbReceiver = this;

    fbReceiver.chunks = {};
    fbReceiver.chunksWaiters = {};

    function receive(chunk, callback) {
        if (!chunk.uuid) {
            fbr.convertToObject(chunk, function(object) {
                receive(object);
            });
            return;
        }

        if (chunk.start && !fbReceiver.chunks[chunk.uuid]) {
            fbReceiver.chunks[chunk.uuid] = [];
            if (fbr.onBegin) fbr.onBegin(chunk);
        }

        if (!chunk.end && chunk.buffer) {
            fbReceiver.chunks[chunk.uuid].push(chunk.buffer);
        }

        if (chunk.end) {
            var chunks = fbReceiver.chunks[chunk.uuid];
            var finalArray = [],
                length = chunks.length;

            for (var i = 0; i < length; i++) {
                if (!!chunks[i]) {
                    finalArray.push(chunks[i]);
                }
            }

            var blob = new Blob(finalArray, {
                type: chunk.type
            });
            blob = merge(blob, chunk);
            blob.url = URL.createObjectURL(blob);
            blob.uuid = chunk.uuid;

            if (!blob.size) console.error('Something went wrong. Blob Size is 0.');

            if (fbr.onEnd) fbr.onEnd(blob);

            // clear system memory
            delete fbReceiver.chunks[chunk.uuid];
            delete fbReceiver.chunksWaiters[chunk.uuid];
        }

        if (chunk.buffer && fbr.onProgress) fbr.onProgress(chunk);

        if (!chunk.end) {
            callback(chunk);

            fbReceiver.chunksWaiters[chunk.uuid] = function() {
                function looper() {
                    if (!chunk.buffer) {
                        return;
                    }

                    if (!fbReceiver.chunks[chunk.uuid]) {
                        return;
                    }

                    if (chunk.currentPosition != chunk.maxChunks && !fbReceiver.chunks[chunk.uuid][chunk.currentPosition]) {
                        console.error('checking', chunk.currentPosition, chunk.maxChunks);
                        callback(chunk);
                        setTimeout(looper, 5000);
                    }
                }
                setTimeout(looper, 5000);
            };

            fbReceiver.chunksWaiters[chunk.uuid]();
        }
    }

    fbReceiver.receive = receive;
}
