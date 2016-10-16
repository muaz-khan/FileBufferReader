function FileBufferReceiver(fbr) {
    var packets = {};

    function receive(chunk, callback) {
        if (!chunk.uuid) {
            fbr.convertToObject(chunk, function(object) {
                receive(object);
            });
            return;
        }

        if (chunk.start && !packets[chunk.uuid]) {
            packets[chunk.uuid] = [];
            if (fbr.onBegin) fbr.onBegin(chunk);
        }

        if (!chunk.end && chunk.buffer) {
            packets[chunk.uuid].push(chunk.buffer);
        }

        if (chunk.end) {
            var _packets = packets[chunk.uuid];
            var finalArray = [],
                length = _packets.length;

            for (var i = 0; i < length; i++) {
                if (!!_packets[i]) {
                    finalArray.push(_packets[i]);
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
        }

        if (chunk.buffer && fbr.onProgress) fbr.onProgress(chunk);

        if (!chunk.end) callback(chunk.uuid);
    }

    this.receive = receive;
}
