(function() {
    try {
        window._stg_webrtc_active = true;
        
        // Listen for the toggle switch from the extension
        window.addEventListener('message', (event) => {
            if (event.data && event.data.type === "STG_DISABLE_WEBRTC") {
                window._stg_webrtc_active = false;
            }
        });

        const OriginalRTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
        if (!OriginalRTCPeerConnection) return; // Browser doesn't support WebRTC

        // --- DIAGRAM FUNCTION 1: dropLocalIceCandidates ---
        // Identifies and targets local IPs (192.168.x.x, 10.x.x.x) and mDNS leaks
        function dropLocalIceCandidates(candidateStr) {
            if (!candidateStr) return false;
            // Regex to catch Local IPv4 ranges and .local mDNS addresses
            const isLocal = /(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|.+\.local)/.test(candidateStr);
            return isLocal; // Returns true if the candidate is dangerous and must be dropped
        }

        // --- DIAGRAM FUNCTION 2: proxyRtcPeerConnection ---
        // The core wrapper that hijacks the connection and enforces the drop function
        function proxyRtcPeerConnection() {
            class SafeRTCPeerConnection extends OriginalRTCPeerConnection {
                constructor(config) {
                    super(config);

                    // 1. Intercept the property setter (onicecandidate)
                    const originalOnIceCandidate = this.onicecandidate;
                    Object.defineProperty(this, 'onicecandidate', {
                        get() {
                            return this._onicecandidate || null;
                        },
                        set(callback) {
                            if (typeof callback === 'function') {
                                this._onicecandidate = (event) => {
                                    // Intercept the ICE candidate before the tracker sees it
                                    if (window._stg_webrtc_active && event.candidate) {
                                        if (dropLocalIceCandidates(event.candidate.candidate)) {
                                            // SILENT DROP: Do not pass this local IP to the tracking script
                                            return; 
                                        }
                                    }
                                    return callback(event);
                                };
                                super.onicecandidate = this._onicecandidate;
                            } else {
                                this._onicecandidate = null;
                                super.onicecandidate = null;
                            }
                        }
                    });
                }

                // 2. Intercept the Event Listener approach
                addEventListener(type, listener, options) {
                    if (type === 'icecandidate' && window._stg_webrtc_active) {
                        const wrappedListener = (event) => {
                            if (event.candidate && dropLocalIceCandidates(event.candidate.candidate)) {
                                return; // SILENT DROP
                            }
                            listener(event);
                        };
                        return super.addEventListener(type, wrappedListener, options);
                    }
                    return super.addEventListener(type, listener, options);
                }
            }

            // Apply the Magic Cloak so trackers think this is the native browser API
            SafeRTCPeerConnection.prototype.toString = function() {
                return 'function RTCPeerConnection() { [native code] }';
            };

            // Overwrite the global browser variables with our Proxy
            window.RTCPeerConnection = SafeRTCPeerConnection;
            window.webkitRTCPeerConnection = SafeRTCPeerConnection;
            window.mozRTCPeerConnection = SafeRTCPeerConnection;
        }

        // Execute the proxy initialization
        proxyRtcPeerConnection();

    } catch (error) {
        // Fail silently to prevent breaking the webpage
    }
})();