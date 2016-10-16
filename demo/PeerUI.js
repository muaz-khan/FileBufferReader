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
            li.innerHTML = '<label>0%</label> <progress></progress>';
            outputPanel.insertBefore(li, outputPanel.firstChild);
            progressHelper[file.uuid] = {
                li: li,
                progress: li.querySelector('progress'),
                label: li.querySelector('label')
            };
            progressHelper[file.uuid].progress.max = file.maxChunks;
        },
        onEnd: function(file) {
            previewFile(file);
        },
        onProgress: function(chunk) {
            var helper = progressHelper[chunk.uuid];
            helper.progress.value = chunk.currentPosition || chunk.maxChunks || helper.progress.max;
            updateLabel(helper.progress, helper.label);
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
    };

    peerConnection.onerror = function() {
        onCloseOrOnError('<span>Something</span> <span>went wrong.</span>');
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
            fileBufferReader.getNextChunk(chunk.uuid, getNextChunkCallback);
            return;
        }

        // if chunk is received
        fileBufferReader.addChunk(chunk, function(promptNextChunk) {
            // request next chunk
            peerConnection.send(promptNextChunk);
        });
    };

    // -------------------------
    // using FileBufferReader.js

    var fileSelector = new FileSelector();
    var fileBufferReader = new FileBufferReader();

    fileBufferReader.onBegin = FileHelper.onBegin;
    fileBufferReader.onProgress = FileHelper.onProgress;
    fileBufferReader.onEnd = FileHelper.onEnd;

    var btnSelectFile = document.getElementById('select-file');
    btnSelectFile.onclick = function() {
        btnSelectFile.disabled = true;
        fileSelector.selectSingleFile(function(file) {
            fileSelector.lastSelectedFile = file;
            fileBufferReader.readAsArrayBuffer(file, function(uuid) {
                fileBufferReader.getNextChunk(uuid, getNextChunkCallback);
                btnSelectFile.disabled = false;
            });
        });
    };

    // --------------------------------------------------------

    function updateLabel(progress, label) {
        if (progress.position == -1) return;
        var position = +progress.position.toFixed(2).split('.')[1] || 100;
        label.innerHTML = position + '%';
    }

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

        document.querySelector('input[type=file]').disabled = true;
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
