function FileBufferReader() {
    var fbr = this;
    var fbrHelper = new FileBufferReaderHelper();

    fbr.chunks = {};
    fbr.users = {};

    fbr.readAsArrayBuffer = function(file, earlyCallback, extra) {
        var options = {
            file: file,
            earlyCallback: earlyCallback,
            extra: extra || {
                userid: 0
            }
        };

        fbrHelper.readAsArrayBuffer(fbr, options);
    };

    fbr.getNextChunk = function(fileUUID, callback, userid) {
        var allFileChunks = fbr.chunks[fileUUID];
        if (!allFileChunks) {
            return;
        }

        var currentPosition;

        if (typeof userid !== 'undefined') {
            if (!fbr.users[userid + '']) {
                fbr.users[userid + ''] = {
                    fileUUID: fileUUID,
                    userid: userid,
                    currentPosition: -1
                };
            }

            fbr.users[userid + ''].currentPosition++;
            currentPosition = fbr.users[userid + ''].currentPosition;
        } else {
            fbr.chunks[fileUUID].currentPosition++;
            currentPosition = fbr.chunks[fileUUID].currentPosition;
        }

        var nextChunk = allFileChunks[currentPosition];
        if (!nextChunk) return;

        nextChunk = fbrClone(nextChunk);

        if (typeof userid !== 'undefined') {
            nextChunk.remoteUserId = userid + '';
        }

        if (!!nextChunk.start) {
            fbr.onBegin(nextChunk);
        }

        if (!!nextChunk.end) {
            fbr.onEnd(nextChunk);
        }

        fbr.onProgress(nextChunk);

        fbr.convertToArrayBuffer(nextChunk, function(buffer) {
            if (nextChunk.currentPosition == nextChunk.maxChunks) {
                callback(buffer, true);
                return;
            }

            callback(buffer, false);
        });
    };

    var fbReceiver = new FileBufferReceiver(fbr);

    fbr.addChunk = function(chunk, callback) {
        if (!chunk) {
            console.error('Chunk is missing.');
            return;
        }

        fbReceiver.receive(chunk, function(uuid) {
            fbr.convertToArrayBuffer({
                readyForNextChunk: true,
                uuid: uuid
            }, callback);
        });
    };

    fbr.onBegin = function() {};
    fbr.onEnd = function() {};
    fbr.onProgress = function() {};

    fbr.convertToObject = FileConverter.ConvertToObject;
    fbr.convertToArrayBuffer = FileConverter.ConvertToArrayBuffer

    // for backward compatibility----it is redundant.
    fbr.setMultipleUsers = function() {};

    // extends 'from' object with members from 'to'. If 'to' is null, a deep clone of 'from' is returned
    function fbrClone(from, to) {
        if (from == null || typeof from != "object") return from;
        if (from.constructor != Object && from.constructor != Array) return from;
        if (from.constructor == Date || from.constructor == RegExp || from.constructor == Function ||
            from.constructor == String || from.constructor == Number || from.constructor == Boolean)
            return new from.constructor(from);

        to = to || new from.constructor();

        for (var name in from) {
            to[name] = typeof to[name] == "undefined" ? fbrClone(from[name], null) : to[name];
        }

        return to;
    }
}
