// ================================
// CAPA DE SEGURIDAD FORTIFICADA
// ================================

(function() {
    'use strict';
    
    Object.freeze(Object.prototype);
    Object.freeze(Array.prototype);
    Object.freeze(String.prototype);
    
    window._sanitizeHTML = function(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    };
    
    window._escapeHTML = function(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
    };
    
    const _LS_KEY = 'un1l1n3_s3cur3_2025';
    
    window._secureStorage = {
        set: function(key, value) {
            try {
                const str = JSON.stringify(value);
                const encoded = btoa(str.split('').map((c, i) => 
                    String.fromCharCode(c.charCodeAt(0) ^ _LS_KEY.charCodeAt(i % _LS_KEY.length))
                ).join(''));
                localStorage.setItem(key, encoded);
            } catch (e) {}
        },
        get: function(key) {
            try {
                const encoded = localStorage.getItem(key);
                if (!encoded) return null;
                const decoded = atob(encoded).split('').map((c, i) =>
                    String.fromCharCode(c.charCodeAt(0) ^ _LS_KEY.charCodeAt(i % _LS_KEY.length))
                ).join('');
                return JSON.parse(decoded);
            } catch (e) {
                return null;
            }
        },
        remove: function(key) {
            localStorage.removeItem(key);
        }
    };
    
    window._validateInput = {
        email: function(email) {
            if (!email || typeof email !== 'string') return false;
            const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return re.test(email) && email.length < 255;
        },
        phone: function(phone) {
            if (!phone) return false;
            return String(phone).replace(/\D/g, '').length === 10;
        },
        text: function(text, maxLen = 500) {
            if (!text) return true;
            return typeof text === 'string' && text.length <= maxLen;
        },
        number: function(num, min = 0, max = 999999) {
            const n = Number(num);
            return !isNaN(n) && n >= min && n <= max && isFinite(n);
        }
    };
    
    const _rateLimits = {};
    
    window._rateLimit = function(key, maxCalls = 30, windowMs = 60000) {
        const now = Date.now();
        if (!_rateLimits[key]) {
            _rateLimits[key] = { calls: [] };
        }
        
        const limit = _rateLimits[key];
        limit.calls = limit.calls.filter(t => now - t < windowMs);
        
        if (limit.calls.length >= maxCalls) return false;
        
        limit.calls.push(now);
        return true;
    };
    
    if (window.top !== window.self) {
        window.top.location = window.self.location;
    }
    
    if (location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
        const noop = function() {};
        ['log', 'warn', 'error', 'info', 'debug'].forEach(m => {
            window.console[m] = noop;
        });
    }
    
    window._securityLayer = true;
    
})();
