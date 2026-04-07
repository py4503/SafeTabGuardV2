(function() {
    try {
        window._stg_poison_active = true;
        window.addEventListener('message', (event) => {
            if (event.data && event.data.type === "STG_DISABLE_POISON") {
                window._stg_poison_active = false;
            }
        });

        const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
        const originalToBlob = HTMLCanvasElement.prototype.toBlob;
        const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
        const originalToString = Function.prototype.toString;

        // The Cryptographic Poison Function (Compression-Proof)
        const applyLSBPoison = (imageData) => {
            if (!window._stg_poison_active || !imageData || !imageData.data || imageData.data.length === 0) return imageData;
            
            // We poison 5 random pixels instead of 1 to guarantee a hash change
            for (let i = 0; i < 5; i++) {
                const randomPixelIndex = Math.floor(Math.random() * (imageData.data.length / 4)) * 4;
                
                // Target the ALPHA channel (Index + 3) instead of Red (Index + 0)
                const currentAlpha = imageData.data[randomPixelIndex + 3];
                
                // If it's fully opaque (255), drop it to 254. Otherwise, bump it up by 1.
                // This forces the PNG encoder to save the change!
                
                imageData.data[randomPixelIndex + 3] = currentAlpha === 255 ? 254 : currentAlpha + 1;
            }
            
            return imageData;
        };

        // Hijack 1: getImageData
        const fakeGetImageData = function(x, y, width, height) {
            return applyLSBPoison(originalGetImageData.call(this, x, y, width, height));
        };
        CanvasRenderingContext2D.prototype.getImageData = fakeGetImageData;

        // Hijack 2: toDataURL
        const fakeToDataURL = function(...args) {
            if (!window._stg_poison_active) return originalToDataURL.apply(this, args);
            const cloneCanvas = document.createElement('canvas');
            cloneCanvas.width = this.width; cloneCanvas.height = this.height;
            const cloneCtx = cloneCanvas.getContext('2d');
            cloneCtx.drawImage(this, 0, 0);
            const imageData = originalGetImageData.call(cloneCtx, 0, 0, cloneCanvas.width, cloneCanvas.height);
            cloneCtx.putImageData(applyLSBPoison(imageData), 0, 0);
            return originalToDataURL.apply(cloneCanvas, args);
        };
        HTMLCanvasElement.prototype.toDataURL = fakeToDataURL;

        // Hijack 3: toBlob
        const fakeToBlob = function(callback, ...args) {
            if (!window._stg_poison_active) return originalToBlob.call(this, callback, ...args);
            const cloneCanvas = document.createElement('canvas');
            cloneCanvas.width = this.width; cloneCanvas.height = this.height;
            const cloneCtx = cloneCanvas.getContext('2d');
            cloneCtx.drawImage(this, 0, 0);
            const imageData = originalGetImageData.call(cloneCtx, 0, 0, cloneCanvas.width, cloneCanvas.height);
            cloneCtx.putImageData(applyLSBPoison(imageData), 0, 0);
            return originalToBlob.call(cloneCanvas, callback, ...args);
        };
        HTMLCanvasElement.prototype.toBlob = fakeToBlob;

        // --- THE MAGIC CLOAK ---
        // We hijack the browser's ability to read code. If a tracker asks to see 
        // the code of our hijacked functions, we return the fake native string!
        Function.prototype.toString = function() {
            if (this === fakeToDataURL) return 'function toDataURL() { [native code] }';
            if (this === fakeToBlob) return 'function toBlob() { [native code] }';
            if (this === fakeGetImageData) return 'function getImageData() { [native code] }';
            if (this === Function.prototype.toString) return 'function toString() { [native code] }';
            
            return originalToString.call(this);
        };

        // --- THE IFRAME TRAPDOOR DEFENSE ---
        // We intercept the creation of new iframes to inject our poison into them
        // the millisecond they are spawned by the tracker.
        const originalContentWindow = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow').get;
        Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
            get: function() {
                const win = originalContentWindow.call(this);
                if (win && !win._stg_poison_active) {
                    // Force the iframe's canvas to use our main window's poisoned functions
                    win.HTMLCanvasElement.prototype.toDataURL = fakeToDataURL;
                    win.HTMLCanvasElement.prototype.toBlob = fakeToBlob;
                    win.CanvasRenderingContext2D.prototype.getImageData = fakeGetImageData;
                    win.Function.prototype.toString = Function.prototype.toString;
                    win._stg_poison_active = true;
                }
                return win;
            }
        });

    } catch (error) {
        // Fail silently
    }
})();