// ================================
// CAPA DE SEGURIDAD - CARGAR ANTES DE script.js
// ================================

(function() {
    'use strict';
    
    // ================================
    // 1. PROTECCIÓN ANTI-TAMPERING
    // ================================
    
    const _freeze = Object.freeze;
    const _seal = Object.seal;
    const _defineProperty = Object.defineProperty;
    
    // Prevenir modificación de prototipos críticos
    _freeze(Object.prototype);
    _freeze(Array.prototype);
    _freeze(String.prototype);
    _freeze(Function.prototype);
    
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
    
    const _LS_KEY = 'k3y_s@lt_2025';
    
    // Cifrado simple XOR (NO usar para datos críticos)
    window._secureStorage = {
        set: function(key, value) {
            const str = JSON.stringify(value);
            const encoded = btoa(str.split('').map((c, i) => 
                String.fromCharCode(c.charCodeAt(0) ^ _LS_KEY.charCodeAt(i % _LS_KEY.length))
            ).join(''));
            localStorage.setItem(key, encoded);
        },
        get: function(key) {
            const encoded = localStorage.getItem(key);
            if (!encoded) return null;
            try {
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
    
    // ================================
    // 4. VALIDACIÓN DE INPUTS
    // ================================
    
    window._validateInput = {
        email: function(email) {
            const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return re.test(email) && email.length < 255;
        },
        phone: function(phone) {
            const re = /^\d{10}$/;
            return re.test(phone.replace(/\D/g, ''));
        },
        text: function(text, maxLen = 500) {
            return typeof text === 'string' && text.length <= maxLen;
        },
        number: function(num, min = 0, max = 999999) {
            const n = Number(num);
            return !isNaN(n) && n >= min && n <= max;
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
    // 6. DETECCIÓN DEVTOOLS (Opcional)
    // ================================
    
    let _devToolsOpen = false;
    
    (function detectDevTools() {
        const threshold = 160;
        const check = function() {
            if (window.outerWidth - window.innerWidth > threshold || 
                window.outerHeight - window.innerHeight > threshold) {
                if (!_devToolsOpen) {
                    _devToolsOpen = true;
                    console.warn('🔒 Modo desarrollo detectado');
                }
            } else {
                _devToolsOpen = false;
            }
        };
        setInterval(check, 1000);
    })();
    
    // ================================
    // 7. PROTECCIÓN CONSOLE
    // ================================
    
    if (typeof window !== 'undefined') {
        const _console = window.console;
        const methods = ['log', 'warn', 'error', 'info', 'debug'];
        
        // En producción, deshabilitar console (opcional)
        if (location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
            methods.forEach(method => {
                window.console[method] = function() {};
            });
        }
    }
    
    // ================================
    // 8. PROTECCIÓN CONTRA CLICKJACKING
    // ================================
    
    if (window.top !== window.self) {
        window.top.location = window.self.location;
    }
    
    console.log('🛡️ Capa de seguridad activada');
    
})();
