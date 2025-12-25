// ================================
// CAPA DE SEGURIDAD FORTIFICADA
// Cargar ANTES de script.js
// ================================

(function() {
    'use strict';
    
    // ================================
    // 1. PROTECCIÓN ANTI-TAMPERING
    // ================================
    
    Object.freeze(Object.prototype);
    Object.freeze(Array.prototype);
    Object.freeze(String.prototype);
    
    // ================================
    // 2. SANITIZACIÓN XSS
    // ================================
    
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
    
    // ================================
    // 3. PROTECCIÓN LOCALSTORAGE
    // ================================
    
    const _LS_KEY = 'un1l1n3_s3cur3_2025';
    
    window._secureStorage = {
        set: function(key, value) {
            try {
                const str = JSON.stringify(value);
                const encoded = btoa(str.split('').map((c, i) => 
                    String.fromCharCode(c.charCodeAt(0) ^ _LS_KEY.charCodeAt(i % _LS_KEY.length))
                ).join(''));
                localStorage.setItem(key, encoded);
            } catch (e) {
                console.error('Error storing data');
            }
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
        },
        clear: function() {
            localStorage.clear();
        }
    };
    
    // ================================
    // 4. VALIDACIÓN DE INPUTS
    // ================================
    
    window._validateInput = {
        email: function(email) {
            if (!email || typeof email !== 'string') return false;
            const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return re.test(email) && email.length < 255 && email.length > 5;
        },
        phone: function(phone) {
            if (!phone) return false;
            const cleaned = String(phone).replace(/\D/g, '');
            return cleaned.length === 10;
        },
        text: function(text, maxLen = 500) {
            if (text === null || text === undefined) return true;
            return typeof text === 'string' && text.length <= maxLen;
        },
        number: function(num, min = 0, max = 999999) {
            const n = Number(num);
            return !isNaN(n) && n >= min && n <= max && isFinite(n);
        }
    };
    
    // ================================
    // 5. RATE LIMITING
    // ================================
    
    const _rateLimits = {};
    
    window._rateLimit = function(key, maxCalls = 10, windowMs = 60000) {
        const now = Date.now();
        if (!_rateLimits[key]) {
            _rateLimits[key] = { calls: [], window: windowMs };
        }
        
        const limit = _rateLimits[key];
        limit.calls = limit.calls.filter(t => now - t < limit.window);
        
        if (limit.calls.length >= maxCalls) {
            return false;
        }
        
        limit.calls.push(now);
        return true;
    };
    
    // ================================
    // 6. PROTECCIÓN CONTRA CLICKJACKING
    // ================================
    
    if (window.top !== window.self) {
        window.top.location = window.self.location;
    }
    
    // ================================
    // 7. DESHABILITAR CONSOLE EN PRODUCCIÓN
    // ================================
    
    if (location.hostname !== 'localhost' && 
        location.hostname !== '127.0.0.1' &&
        !location.hostname.includes('github.io')) {
        const noop = function() {};
        ['log', 'warn', 'error', 'info', 'debug', 'trace'].forEach(method => {
            window.console[method] = noop;
        });
    }
    
    // ================================
    // 8. MARCAR COMO CARGADO
    // ================================
    
    Object.defineProperty(window, '_securityLayer', {
        value: true,
        writable: false,
        configurable: false
    });
    
    console.log('🛡️ Capa de seguridad activada');
    
})();
