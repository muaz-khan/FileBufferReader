// Muaz Khan    - www.MuazKhan.com
// MIT License  - www.WebRTC-Experiment.com/licence
// Source Code  - https://github.com/muaz-khan/FileBufferReader

// _________
// PeerUI.js

window.addEventListener('load', function() {
    var setupOffer = document.getElementById('setup-offer'),
        innerHTML;

    var SIGNALING_URI = 'wss://webrtc-signaling.herokuapp.com:443/ws/';

    var channel = location.href.replace(/\/|:|#|%|\.|\[|\]/g, '');

    if (location.hash && location.hash.length > 2) {
        channel = location.hash.replace('#', '');
    }

    var websocket = new WebSocket(SIGNALING_URI);
    websocket.onopen = function() {
        var innerHTML = '<span>Setup</span> <span>WebRTC Connection</span>';
        setupOffer.innerHTML = innerHTML;
        setupOffer.disabled = false;

        console.log('websocket connection opened!');
        websocket.push(JSON.stringify({
            open: true,
            channel: channel
        }));
    };
    websocket.push = websocket.send;
    websocket.send = function(data) {
        if (websocket.readyState != 1) {
            console.warn('websocket connection is not opened yet.');
            return setTimeout(function() {
                websocket.send(data);
            }, 1000);
        }

        websocket.push(JSON.stringify({
            data: data,
            channel: channel
        }));
    };

    var progressHelper = {};
    var outputPanel = document.querySelector('.output-panel');

    function previewFile(file) {
        try {
            file.url = URL.createObjectURL(fileSelector.lastSelectedFile || file);
        } catch (e) {
            return;
        }

        var html = '<a class="single-line-text" href="' + file.url + '" target="_blank" download="' + file.name + '">Download <span class="highlighted-name">' + file.name + '</span> on your Disk!</a>';

        if (file.name.match(/\.jpg|\.png|\.jpeg|\.gif/gi)) {
            html += '<img crossOrigin="anonymous" src="' + file.url + '">';
        } else if (file.name.match(/\.wav|\.mp3/gi)) {
            html += '<audio src="' + file.url + '" controls></audio>';
        } else if (file.name.match(/\.webm|\.flv|\.mp4/gi)) {
            html += '<video src="' + file.url + '" controls></video>';
        } else if (file.name.match(/\.pdf|\.js|\.txt|\.sh/gi)) {
            html += '<a href="' + file.url + '" target="_blank" download="' + file.name + '">';
            html += '<br><iframe class="inline-iframe" src="' + file.url + '"></iframe></a>';
        }

        progressHelper[file.uuid].li.innerHTML = html;

        fileSelector.lastSelectedFile = false;
    }

    var FileHelper = {
        onBegin: function(file) {
            var li = document.createElement('li');
            li.title = file.name;
            li.innerHTML = '<section style="text-align:center;" class="file-name specific-h2">' + file.name + '</section><br><progress style="display:none;" value="0"></progress><div class="circular-progress-bar c100 p25" style="margin-left: 40%;"><span class="circular-progress-bar-percentage">25%</span><div class="slice"><div class="bar"></div><div class="fill"></div></div></div>';
            li.style['min-height'] = '350px';
            outputPanel.insertBefore(li, outputPanel.firstChild);
            progressHelper[file.uuid] = {
                li: li,
                progress: li.querySelector('progress'),
                label: li.querySelector('label')
            };
            progressHelper[file.uuid].progress.max = file.maxChunks;

            btnSelectFile.disabled = true;

            if (fileSelector.lastSelectedFile) {
                btnSelectFile.innerHTML = 'File Sending In-Progress...';
            } else {
                btnSelectFile.innerHTML = 'File Receiving In-Progress...';
            }

            resetTimeCalculator();
        },
        onEnd: function(file) {
            previewFile(file);

            btnSelectFile.innerHTML = 'Select & Share A File';
            btnSelectFile.disabled = false;
        },
        onProgress: function(chunk) {
            var helper = progressHelper[chunk.uuid];
            helper.progress.value = chunk.currentPosition || chunk.maxChunks || helper.progress.max;

            if (helper.progress.position > 0 && helper.li.querySelector('.circular-progress-bar-percentage')) {
                var position = +helper.progress.position.toFixed(2).split('.')[1] || 100;
                helper.li.querySelector('.circular-progress-bar-percentage').innerHTML = position + '%';
                helper.li.querySelector('.circular-progress-bar').className = 'circular-progress-bar c100 p' + position;
            }

            if (chunk.currentPosition + 2 != chunk.maxChunks && helper.li.querySelector('.file-name')) {
                progressHelper[chunk.uuid].lastChunk = chunk;
                timeCalculator(helper.progress, function(timeRemaining) {
                    var lastChunk = progressHelper[chunk.uuid].lastChunk;

                    var html = (fileSelector.lastSelectedFile ? 'Sending' : 'Receiving') + ' file &lt;' + lastChunk.name + '&gt;:';
                    html += '<br>Remaining chunks: ' + (lastChunk.maxChunks - lastChunk.currentPosition);
                    html += '<br>Remaining time: ' + timeRemaining;
                    helper.li.querySelector('.file-name').innerHTML = html;
                });
            } else {
                btnSelectFile.innerHTML = 'Select & Share A File';
                btnSelectFile.disabled = false;
            }
        }
    };

    // RTCPeerConection
    // ----------------
    var peerConnection = new PeerConnection(websocket);

    peerConnection.onuserfound = function(userid) {
        setupOffer.innerHTML = 'Please wait a few seconds.';
        setupOffer.disabled = true;

        peerConnection.sendParticipationRequest(userid);
    };

    peerConnection.onopen = function() {
        peerConnection.isOpened = true;

        innerHTML = '<span>PeerConnection</span> <span>is established.</span>';
        setupOffer.innerHTML = innerHTML;
        setupOffer.disabled = true;

        btnSelectFile.disabled = false;
    };

    peerConnection.onclose = function() {
        onCloseOrOnError('<span>PeerConnection</span> <span>is closed.</span>');
        resetButtons();
    };

    function resetButtons() {
        btnSelectFile.innerHTML = 'Select & Share A File';
        btnSelectFile.disabled = true;
        setupOffer.disabled = false;
        setupOffer.innerHTML = 'Setup WebRTC Connection';
    }

    peerConnection.onerror = function() {
        onCloseOrOnError('<span>Something</span> <span>went wrong.</span>');
        resetButtons();
    };

    // getNextChunkCallback gets next available buffer
    // you need to send that buffer using WebRTC data channels
    function getNextChunkCallback(nextChunk, isLastChunk) {
        if (isLastChunk) {
            // alert('File Successfully sent.');
        }

        // sending using WebRTC data channels
        peerConnection.send(nextChunk);
    };

    peerConnection.ondata = function(chunk) {
        if (chunk instanceof ArrayBuffer || chunk instanceof DataView) {
            // array buffers are passed using WebRTC data channels
            // need to convert data back into JavaScript objects

            fileBufferReader.convertToObject(chunk, function(object) {
                peerConnection.ondata(object);
            });
            return;
        }

        // if target user requested next chunk
        if (chunk.readyForNextChunk) {
            fileBufferReader.getNextChunk(chunk /*aka metadata*/ , getNextChunkCallback);
            return;
        }

        // if any of the chunks missed
        if (chunk.chunkMissing) {
            fileBufferReader.chunkMissing(chunk);
            return;
        }

        // if chunk is received
        fileBufferReader.addChunk(chunk, function(promptNextChunk) {
            // request next chunk
            peerConnection.send(promptNextChunk);
        });
    };

    var progressIterations = 0;
    var calculateInProgress = false;
    var ONE_SECOND = 1000;

    function resetTimeCalculator() {
        progressIterations = 0;
        calculateInProgress = false;
    }

    // https://github.com/23/resumable.js/issues/168#issuecomment-65297110
    function timeCalculator(progress, callback, selfInvoker) {
        if (calculateInProgress && !selfInvoker) {
            return;
        }
        calculateInProgress = true;

        var step = 1;

        var remainingProgress = 1.0 - progress.position;

        var estimatedCompletionTime = Math.round((remainingProgress / progress.position) * progressIterations);
        var estimatedHours, estimatedMinutes, estimatedSeconds, displayHours, displayMinutes, displaySeconds;
        progressIterations += step;

        if (progress.position < 1.0) {
            if (isFinite(estimatedCompletionTime)) {
                estimatedHours = Math.floor(estimatedCompletionTime / 3600);
                displayHours = estimatedHours > 9 ? estimatedHours : '0' + estimatedHours;
                estimatedMinutes = Math.floor((estimatedCompletionTime / 60) % 60);
                displayMinutes = estimatedMinutes > 9 ? estimatedMinutes : '0' + estimatedMinutes;
                estimatedSeconds = estimatedCompletionTime % 60;
                displaySeconds = estimatedSeconds > 9 ? estimatedSeconds : '0' + estimatedSeconds;
            }
            callback(displayHours + ':' + displayMinutes + ':' + displaySeconds);
        }

        setTimeout(function() {
            timeCalculator(progress, callback, true);
        }, step * ONE_SECOND);
    }

    // -------------------------
    // using FileBufferReader.js

    var fileSelector = new FileSelector();

    // you can force specific files e.g.
    // image/png, image/*, image/jpeg, video/webm, audio/ogg etc.
    fileSelector.accept = '*.*';

    var fileBufferReader = new FileBufferReader();

    fileBufferReader.onBegin = FileHelper.onBegin;
    fileBufferReader.onProgress = FileHelper.onProgress;
    fileBufferReader.onEnd = FileHelper.onEnd;

    var btnSelectFile = document.getElementById('select-file');
    btnSelectFile.onclick = function() {
        btnSelectFile.disabled = true;
        fileSelector.selectSingleFile(function(file) {
            fileSelector.lastSelectedFile = file;

            btnSelectFile.innerHTML = 'Please wait..';;
            btnSelectFile.disabled = true;

            fileBufferReader.readAsArrayBuffer(file, function(metadata) {
                fileBufferReader.getNextChunk(metadata, getNextChunkCallback);
            });
        });

        setTimeout(function() {
            if (fileSelector.lastSelectedFile) return;
            btnSelectFile.innerHTML = 'Select & Share A File';
            btnSelectFile.disabled = false;
        }, 5000);
    };

    // --------------------------------------------------------
    setupOffer.onclick = function() {
        setupOffer.innerHTML = 'Please wait a few seconds.';
        setupOffer.disabled = true;

        // start broadcasting userid
        peerConnection.startBroadcasting();

        setTimeout(function() {
            if (!peerConnection.isOpened) {
                var innerHTML = 'Open Same URL in a NEW Tab';
                setupOffer.innerHTML = innerHTML;
            }
        }, 5 * 1000);
    };

    function onCloseOrOnError(_innerHTML) {
        innerHTML = _innerHTML;
        setupOffer.innerHTML = innerHTML;
        setupOffer.disabled = false;
        setupOffer.className = 'button';

        setTimeout(function() {
            innerHTML = '<span>Setup</span> <span>WebRTC Connection</span>';
            setupOffer.innerHTML = innerHTML;
            setupOffer.disabled = false;
        }, 1000);

        document.getElementById('select-file').disabled = true;
    }

    function getToken() {
        if (window.crypto && window.crypto.getRandomValues && navigator.userAgent.indexOf('Safari') === -1) {
            var a = window.crypto.getRandomValues(new Uint32Array(3)),
                token = '';
            for (var i = 0, l = a.length; i < l; i++) {
                token += a[i].toString(36);
            }
            return token;
        } else {
            return (Math.random() * new Date().getTime()).toString(36).replace(/\./g, '');
        }
    }

    var uniqueToken = document.getElementById('unique-token');
    if (uniqueToken)
        if (location.hash.length > 2)
            uniqueToken.parentNode.parentNode.innerHTML = '<h2 style="text-align:center;"><a href="' + location.href + '" target="_blank">Share this Link!</a></h2>';
        else
            uniqueToken.innerHTML = uniqueToken.parentNode.href = '#' + getToken();

}, false);
