// ================================
// DELIVERY APP - VERSIÓN FORTIFICADA
// ================================

(function() {
'use strict';

// Verificar que la capa de seguridad esté cargada
if (!window._securityLayer) {
    alert('ERROR: Capa de seguridad no cargada. Recarga la página.');
    throw new Error('Security layer required');
}

// ================================
// API URL PROTEGIDA
// ================================
const _API_URL = 'https://delivery-uniline-back-d0e649feca1a.herokuapp.com';

// ================================
// VARIABLES INTERNAS PROTEGIDAS
// ================================
let _sessionData = null;
let _menuData = { categorias: [], productos: [], extras: [], productoExtras: [], banners: [], promociones: [] };
let _filteredProducts = [];
let _cart = [];
let _currentProduct = null;
let _modalQuantity = 1;
let _selectedExtras = [];
let _tipoServicio = "Domicilio";
let _costoEnvio = 25;
let _direccionSeleccionada = null;
let _coordenadasEntrega = "";
let _direccionesCliente = [];
let _pendingAction = null;
let _cuponAplicado = null;
let _cuponAutomaticoData = null;
let _promocionesData = [];
let _currentPromo = null;
let _promoCantidad = 1;
let _pedidosInterval = null;
let _pedidosCache = {};
let _currentView = localStorage.getItem("viewPreference") || "grid";
let _bannerInterval = null;
let _currentBanner = 0;
let _ultimosVistos = JSON.parse(localStorage.getItem("uniline_ultimos") || "[]");
const _MAX_ULTIMOS = 10;

// ================================
// EXPONER SOLO GETTERS PROTEGIDOS
// ================================
Object.defineProperty(window, 'sessionData', {
    get: function() {
        return _sessionData ? Object.assign({}, _sessionData) : null;
    },
    set: function(value) {
        if (!window._securityLayer) return false;
        if (value && value.id && value.nombre && value.correo) {
            _sessionData = Object.freeze(Object.assign({}, value));
            return true;
        }
        return false;
    },
    configurable: false,
    enumerable: true
});

Object.defineProperty(window, 'cart', {
    get: function() {
        return _cart.slice();
    },
    set: function() {
        return false;
    },
    configurable: false
});

// ================================
// HELPER: FETCH API SEGURO
// ================================
async function callAPI(endpoint, options = {}) {
    if (!window._rateLimit) {
        return { error: 'Security layer not loaded' };
    }
    
    if (!window._rateLimit('api_call', 30, 60000)) {
        return { error: 'Demasiadas peticiones, espera un momento' };
    }
    
    try {
        const response = await fetch(_API_URL + endpoint, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                ...options.headers
            }
        });
        
        if (!response.ok) {
            throw new Error('Network error');
        }
        
        return await response.json();
    } catch (error) {
        return { error: error.message };
    }
}

// ================================
// INICIALIZACIÓN
// ================================
window.addEventListener("load", function() {
    var savedSession = window._secureStorage.get("uniline_session");
    var savedCliente = window._secureStorage.get("uniline_cliente");
    
    if (savedSession && savedCliente) {
        if (savedCliente.id && savedCliente.nombre && savedCliente.correo) {
            _sessionData = Object.freeze(savedCliente);
        }
    }
    
    actualizarUIUsuario();
    loadCart();
    mostrarApp();
});

function mostrarApp() {
    document.getElementById("appSection").style.display = "block";
    cargarMenu();
    
    setTimeout(function() {
        verificarCuponAutomatico();
    }, 2000);
}

function actualizarUIUsuario() {
    if (_sessionData) {
        document.getElementById("userInitial").textContent = window._escapeHTML(_sessionData.nombre.charAt(0).toUpperCase());
        document.getElementById("userPoints").textContent = "⭐ " + (_sessionData.puntos || 0);
        document.getElementById("menuUserName").textContent = window._escapeHTML(_sessionData.nombre);
        document.getElementById("menuUserEmail").textContent = window._escapeHTML(_sessionData.correo);
        document.getElementById("footerCuentaLabel").textContent = "Cuenta";
        
        var btnLogin = document.getElementById("btnLoginDesktop");
        if (btnLogin) btnLogin.style.display = "none";
    } else {
        document.getElementById("userInitial").textContent = "?";
        document.getElementById("userPoints").textContent = "";
        document.getElementById("menuUserName").textContent = "Invitado";
        document.getElementById("menuUserEmail").textContent = "No has iniciado sesión";
        document.getElementById("footerCuentaLabel").textContent = "Entrar";
        
        var btnLogin = document.getElementById("btnLoginDesktop");
        if (btnLogin) btnLogin.style.display = "block";
    }
}

// ================================
// CARGAR MENÚ
// ================================
async function cargarMenu() {
    const data = await callAPI('/api/menu');
    
    if (data.error) {
        document.getElementById("productsGrid").textContent = "Error al cargar productos";
        return;
    }
    
    _menuData = data;
    _filteredProducts = _menuData.productos.slice();
    _promocionesData = _menuData.promociones || [];
    
    renderBanners();
    renderDestacados();
    renderPromociones();
    renderUltimosVistos();
    renderBannerSecundario();
    renderCategorias();
    renderProductos();
    renderBannerTerciario();
    renderProductosPorCategoria();
    initViewToggle();
}

// ================================
// BANNERS
// ================================
function renderBanners() {
    var container = document.getElementById("bannersContainer");
    var slider = document.getElementById("bannersSlider");
    var dots = document.getElementById("bannersDots");
    
    if (!_menuData.banners || _menuData.banners.length === 0) {
        container.style.display = "none";
        return;
    }
    
    container.style.display = "block";
    slider.innerHTML = '';
    
    for (var i = 0; i < _menuData.banners.length; i++) {
        var b = _menuData.banners[i];
        var slide = document.createElement('div');
        slide.className = 'banner-slide';
        var img = document.createElement('img');
        img.src = b.url;
        img.alt = '';
        img.onerror = function() { this.parentElement.style.display = 'none'; };
        slide.appendChild(img);
        slider.appendChild(slide);
    }
    
    dots.innerHTML = '';
    for (var j = 0; j < _menuData.banners.length; j++) {
        var dot = document.createElement('div');
        dot.className = 'banner-dot' + (j === 0 ? ' active' : '');
        dot.setAttribute('data-index', j);
        dot.onclick = function() {
            window.goToBanner(parseInt(this.getAttribute('data-index')));
        };
        dots.appendChild(dot);
    }
    
    if (_menuData.banners.length > 1) {
        startBannerAutoplay();
    }
}

window.goToBanner = function(index) {
    _currentBanner = index;
    document.getElementById("bannersSlider").style.transform = "translateX(-" + (index * 100) + "%)";
    var allDots = document.querySelectorAll(".banner-dot");
    for (var i = 0; i < allDots.length; i++) {
        allDots[i].classList.remove("active");
    }
    if (allDots[index]) allDots[index].classList.add("active");
};

function startBannerAutoplay() {
    if (_bannerInterval) clearInterval(_bannerInterval);
    _bannerInterval = setInterval(function() {
        _currentBanner = (_currentBanner + 1) % _menuData.banners.length;
        window.goToBanner(_currentBanner);
    }, 4000);
}

// ================================
// CATEGORÍAS
// ================================
function renderCategorias() {
    var container = document.getElementById("categoriesContainer");
    container.innerHTML = '';
    
    var chipAll = document.createElement('div');
    chipAll.className = 'category-chip active';
    chipAll.setAttribute('data-cat', 'all');
    chipAll.textContent = 'Todos';
    chipAll.onclick = function() { window.filtrarCategoria('all'); };
    container.appendChild(chipAll);
    
    for (var i = 0; i < _menuData.categorias.length; i++) {
        var cat = _menuData.categorias[i];
        var chip = document.createElement('div');
        chip.className = 'category-chip';
        chip.setAttribute('data-cat', cat.id);
        chip.textContent = cat.icono + ' ' + cat.nombre;
        chip.setAttribute('data-catid', cat.id);
        chip.onclick = function() {
            window.filtrarCategoria(this.getAttribute('data-catid'));
        };
        container.appendChild(chip);
    }
}

window.filtrarCategoria = function(catId) {
    var chips = document.querySelectorAll(".category-chip");
    for (var i = 0; i < chips.length; i++) {
        chips[i].classList.remove("active");
        if (chips[i].getAttribute('data-cat') === catId || chips[i].getAttribute('data-catid') === catId) {
            chips[i].classList.add("active");
        }
    }
    
    if (catId === "all") {
        _filteredProducts = _menuData.productos.slice();
        document.getElementById("categoryTitle").textContent = "Todos los Platillos";
    } else {
        _filteredProducts = [];
        for (var j = 0; j < _menuData.productos.length; j++) {
            if (_menuData.productos[j].categoria === catId) {
                _filteredProducts.push(_menuData.productos[j]);
            }
        }
        var cat = _menuData.categorias.find(c => c.id === catId);
        document.getElementById("categoryTitle").textContent = cat ? cat.nombre : "Platillos";
    }
    renderProductos();
};

// ================================
// PRODUCTOS
// ================================
window.buscarProductos = function() {
    var term = document.getElementById("searchInput").value.toLowerCase();
    term = window._sanitizeHTML(term).substring(0, 100);
    
    if (!window._validateInput.text(term, 100)) {
        return;
    }
    
    _filteredProducts = [];
    for (var i = 0; i < _menuData.productos.length; i++) {
        var p = _menuData.productos[i];
        if (p.nombre.toLowerCase().indexOf(term) >= 0 || p.descripcion.toLowerCase().indexOf(term) >= 0) {
            _filteredProducts.push(p);
        }
    }
    renderProductos();
};

function renderProductos() {
    var grid = document.getElementById("productsGrid");
    document.getElementById("productsCount").textContent = _filteredProducts.length + " productos";
    
    if (_filteredProducts.length === 0) {
        grid.textContent = "No hay productos";
        return;
    }
    
    grid.innerHTML = '';
    for (var i = 0; i < _filteredProducts.length; i++) {
        var p = _filteredProducts[i];
        var card = createProductCard(p);
        grid.appendChild(card);
    }
}

function createProductCard(p) {
    var card = document.createElement('div');
    card.className = 'product-card';
    card.setAttribute('data-productid', p.id);
    card.onclick = function() {
        window.abrirModal(this.getAttribute('data-productid'));
    };
    
    var imgDiv = document.createElement('div');
    imgDiv.className = 'product-image';
    if (p.imagen && p.imagen.trim() !== "") {
        var img = document.createElement('img');
        img.src = p.imagen;
        img.alt = window._escapeHTML(p.nombre);
        img.onerror = function() {
            this.parentElement.innerHTML = '<div class="no-image"><span>📷</span></div>';
        };
        imgDiv.appendChild(img);
    } else {
        imgDiv.innerHTML = '<div class="no-image"><span>📷</span></div>';
    }
    card.appendChild(imgDiv);
    
    var info = document.createElement('div');
    info.className = 'product-info';
    
    var name = document.createElement('div');
    name.className = 'product-name';
    name.textContent = p.nombre;
    info.appendChild(name);
    
    var desc = document.createElement('div');
    desc.className = 'product-desc';
    desc.textContent = p.descripcion || '';
    info.appendChild(desc);
    
    var footer = document.createElement('div');
    footer.className = 'product-footer';
    
    var price = document.createElement('span');
    price.className = 'product-price';
    price.textContent = '$' + p.precio.toFixed(2);
    footer.appendChild(price);
    
    var time = document.createElement('span');
    time.className = 'product-time';
    time.textContent = p.tiempo;
    footer.appendChild(time);
    
    info.appendChild(footer);
    
    var btn = document.createElement('button');
    btn.className = 'btn-add-cart';
    btn.textContent = 'Agregar';
    btn.setAttribute('data-productid', p.id);
    btn.onclick = function(e) {
        e.stopPropagation();
        window.abrirModal(this.getAttribute('data-productid'));
    };
    info.appendChild(btn);
    
    card.appendChild(info);
    
    return card;
}

// ================================
// VISTA GRID/LIST
// ================================
function initViewToggle() {
    var grid = document.getElementById("productsGrid");
    var btnGrid = document.getElementById("btnViewGrid");
    var btnList = document.getElementById("btnViewList");
    
    if (!grid || !btnGrid || !btnList) return;
    
    if (_currentView === "list") {
        grid.classList.remove("view-grid");
        grid.classList.add("view-list");
        btnGrid.classList.remove("active");
        btnList.classList.add("active");
    } else {
        grid.classList.remove("view-list");
        grid.classList.add("view-grid");
        btnGrid.classList.add("active");
        btnList.classList.remove("active");
    }
}

window.cambiarVista = function(vista) {
    _currentView = vista;
    localStorage.setItem("viewPreference", vista);
    
    var grid = document.getElementById("productsGrid");
    var btnGrid = document.getElementById("btnViewGrid");
    var btnList = document.getElementById("btnViewList");
    
    if (!grid || !btnGrid || !btnList) return;
    
    if (vista === "list") {
        grid.classList.remove("view-grid");
        grid.classList.add("view-list");
        btnGrid.classList.remove("active");
        btnList.classList.add("active");
    } else {
        grid.classList.remove("view-list");
        grid.classList.add("view-grid");
        btnGrid.classList.add("active");
        btnList.classList.remove("active");
    }
};

// ================================
// DESTACADOS
// ================================
function renderDestacados() {
    var section = document.getElementById("destacadosSection");
    var container = document.getElementById("destacadosContainer");
    
    if (!_menuData.destacados || _menuData.destacados.length === 0) {
        section.style.display = "none";
        return;
    }
    
    section.style.display = "block";
    container.innerHTML = '';
    
    for (var i = 0; i < _menuData.destacados.length; i++) {
        var p = _menuData.destacados[i];
        
        var card = document.createElement('div');
        card.className = 'destacado-card';
        card.setAttribute('data-productid', p.id);
        card.onclick = function() {
            window.abrirModal(this.getAttribute('data-productid'));
        };
        
        var badge = document.createElement('div');
        badge.className = 'destacado-badge';
        badge.textContent = '⭐ Popular';
        card.appendChild(badge);
        
        var imgDiv = document.createElement('div');
        imgDiv.className = 'destacado-card-img';
        if (p.imagen && p.imagen.trim() !== "") {
            var img = document.createElement('img');
            img.src = p.imagen;
            img.alt = window._escapeHTML(p.nombre);
            img.onerror = function() {
                this.parentElement.innerHTML = '<div class="no-image">📷</div>';
            };
            imgDiv.appendChild(img);
        } else {
            imgDiv.innerHTML = '<div class="no-image">📷</div>';
        }
        card.appendChild(imgDiv);
        
        var info = document.createElement('div');
        info.className = 'destacado-card-info';
        
        var nombre = document.createElement('div');
        nombre.className = 'destacado-card-nombre';
        nombre.textContent = p.nombre;
        info.appendChild(nombre);
        
        var precio = document.createElement('div');
        precio.className = 'destacado-card-precio';
        precio.textContent = '$' + p.precio.toFixed(2);
        info.appendChild(precio);
        
        card.appendChild(info);
        container.appendChild(card);
    }
}

function renderBannerSecundario() {
    var container = document.getElementById("bannerSecundario");
    var img = document.getElementById("bannerSecundarioImg");
    
    if (!_menuData.bannersSecundario || _menuData.bannersSecundario.length === 0) {
        container.style.display = "none";
    } else {
        var banner = _menuData.bannersSecundario[Math.floor(Math.random() * _menuData.bannersSecundario.length)];
        img.src = banner.url;
        img.onerror = function() { container.style.display = "none"; checkBannersExtra(); };
        container.style.display = "block";
    }
}

function renderBannerTerciario() {
    var container = document.getElementById("bannerTerciario");
    var img = document.getElementById("bannerTerciarioImg");
    
    if (!_menuData.bannersTerciario || _menuData.bannersTerciario.length === 0) {
        container.style.display = "none";
    } else {
        var banner = _menuData.bannersTerciario[Math.floor(Math.random() * _menuData.bannersTerciario.length)];
        img.src = banner.url;
        img.onerror = function() { container.style.display = "none"; checkBannersExtra(); };
        container.style.display = "block";
    }
    
    checkBannersExtra();
}

function checkBannersExtra() {
    var sec = document.getElementById("bannerSecundario");
    var ter = document.getElementById("bannerTerciario");
    var container = document.getElementById("bannersExtraContainer");
    
    if (sec && ter && container) {
        if (sec.style.display === "none" && ter.style.display === "none") {
            container.style.display = "none";
        } else {
            container.style.display = "grid";
        }
    }
}

// ================================
// PROMOCIONES
// ================================
function renderPromociones() {
    var section = document.getElementById("promocionesSection");
    var container = document.getElementById("promocionesContainer");
    
    if (_promocionesData.length === 0) {
        section.style.display = "none";
        return;
    }
    
    section.style.display = "block";
    container.innerHTML = '';
    
    for (var i = 0; i < _promocionesData.length; i++) {
        var p = _promocionesData[i];
        
        var card = document.createElement('div');
        card.className = 'promo-card';
        card.setAttribute('data-promoid', p.id);
        card.onclick = function() {
            window.abrirModalPromo(this.getAttribute('data-promoid'));
        };
        
        var badge = document.createElement('div');
        badge.className = 'promo-card-badge';
        badge.textContent = '-' + p.descuentoPct + '%';
        card.appendChild(badge);
        
        var imgDiv = document.createElement('div');
        imgDiv.className = 'promo-card-imagen';
        if (p.imagen && p.imagen.trim() !== "") {
            var img = document.createElement('img');
            img.src = p.imagen;
            img.alt = window._escapeHTML(p.nombre);
            imgDiv.appendChild(img);
        } else {
            imgDiv.innerHTML = '<div class="no-image">🎁</div>';
        }
        card.appendChild(imgDiv);
        
        var body = document.createElement('div');
        body.className = 'promo-card-body';
        
        var nombre = document.createElement('div');
        nombre.className = 'promo-card-nombre';
        nombre.textContent = p.nombre;
        body.appendChild(nombre);
        
        var desc = document.createElement('div');
        desc.className = 'promo-card-desc';
        desc.textContent = p.descripcion;
        body.appendChild(desc);
        
        var precios = document.createElement('div');
        precios.className = 'promo-card-precios';
        
        var precioNormal = document.createElement('span');
        precioNormal.className = 'promo-card-precio-normal';
        precioNormal.textContent = '$' + p.precioNormal.toFixed(2);
        precios.appendChild(precioNormal);
        
        var precioPromo = document.createElement('span');
        precioPromo.className = 'promo-card-precio-promo';
        precioPromo.textContent = '$' + p.precioPromo.toFixed(2);
        precios.appendChild(precioPromo);
        
        body.appendChild(precios);
        
        var ahorro = document.createElement('div');
        ahorro.className = 'promo-card-ahorro';
        ahorro.textContent = 'Ahorras $' + p.ahorro.toFixed(2);
        body.appendChild(ahorro);
        
        card.appendChild(body);
        container.appendChild(card);
    }
}

window.abrirModalPromo = function(promoId) {
    _currentPromo = null;
    for (var i = 0; i < _promocionesData.length; i++) {
        if (_promocionesData[i].id === promoId) {
            _currentPromo = _promocionesData[i];
            break;
        }
    }
    if (!_currentPromo) return;
    
    _promoCantidad = 1;
    
    var imgContainer = document.getElementById("promoModalImagen");
    imgContainer.innerHTML = '';
    if (_currentPromo.imagen) {
        var img = document.createElement('img');
        img.src = _currentPromo.imagen;
        img.alt = window._escapeHTML(_currentPromo.nombre);
        imgContainer.appendChild(img);
    } else {
        imgContainer.innerHTML = '<div class="no-image">🎁</div>';
    }
    
    document.getElementById("promoModalBadge").textContent = "-" + _currentPromo.descuentoPct + "%";
    document.getElementById("promoModalNombre").textContent = _currentPromo.nombre;
    document.getElementById("promoModalDesc").textContent = _currentPromo.descripcion;
    document.getElementById("promoModalPrecioNormal").textContent = "$" + _currentPromo.precioNormal.toFixed(2);
    document.getElementById("promoModalPrecioPromo").textContent = "$" + _currentPromo.precioPromo.toFixed(2);
    document.getElementById("promoModalAhorro").textContent = "¡Ahorras $" + _currentPromo.ahorro.toFixed(2) + "!";
    
    var lista = document.getElementById("promoProductosLista");
    lista.innerHTML = '';
    for (var j = 0; j < _currentPromo.productos.length; j++) {
        var prod = _currentPromo.productos[j];
        var item = document.createElement('div');
        item.className = 'promo-producto-item';
        item.innerHTML = '<span class="check">✓</span><span class="cantidad">' + prod.cantidad + 'x</span><span>' + window._escapeHTML(prod.nombreProducto) + '</span>';
        lista.appendChild(item);
    }
    
    document.getElementById("promoModalCantidad").textContent = _promoCantidad;
    document.getElementById("promoModalTotal").textContent = "$" + (_currentPromo.precioPromo * _promoCantidad).toFixed(2);
    
    document.getElementById("modalPromocion").classList.add("show");
    document.body.style.overflow = "hidden";
};

window.cerrarModalPromo = function() {
    document.getElementById("modalPromocion").classList.remove("show");
    document.body.style.overflow = "";
    _currentPromo = null;
};

window.cambiarCantidadPromo = function(delta) {
    _promoCantidad = Math.max(1, _promoCantidad + delta);
    document.getElementById("promoModalCantidad").textContent = _promoCantidad;
    document.getElementById("promoModalTotal").textContent = "$" + (_currentPromo.precioPromo * _promoCantidad).toFixed(2);
};

window.agregarPromoAlCarrito = function() {
    if (!_currentPromo) return;
    
    var item = {
        id: "PROMO_" + _currentPromo.id + "_" + Date.now(),
        productoId: "PROMO_" + _currentPromo.id,
        nombre: "🎁 " + _currentPromo.nombre,
        imagen: _currentPromo.imagen,
        precio: _currentPromo.precioPromo,
        cantidad: _promoCantidad,
        extras: [],
        extrasTotal: 0,
        subtotal: _currentPromo.precioPromo * _promoCantidad,
        notas: "",
        esPromocion: true,
        productosIncluidos: _currentPromo.productos
    };
    
    _cart.push(item);
    saveCart();
    updateCartUI();
    window.cerrarModalPromo();
    mostrarToast("¡Promoción agregada al carrito!");
};

// ================================
// ÚLTIMOS VISTOS
// ================================
function renderUltimosVistos() {
    var section = document.getElementById("ultimosVistosSection");
    var container = document.getElementById("ultimosVistosContainer");
    
    if (_ultimosVistos.length === 0) {
        section.style.display = "none";
        return;
    }
    
    section.style.display = "block";
    container.innerHTML = '';
    
    for (var i = 0; i < _ultimosVistos.length; i++) {
        var id = _ultimosVistos[i];
        var p = _menuData.productos.find(prod => prod.id === id);
        if (!p) continue;
        
        var card = document.createElement('div');
        card.className = 'ultimo-card';
        card.setAttribute('data-productid', p.id);
        card.onclick = function() {
            window.abrirModal(this.getAttribute('data-productid'));
        };
        
        var imgDiv = document.createElement('div');
        imgDiv.className = 'ultimo-card-img';
        if (p.imagen) {
            var img = document.createElement('img');
            img.src = p.imagen;
            img.alt = window._escapeHTML(p.nombre);
            imgDiv.appendChild(img);
        } else {
            imgDiv.innerHTML = '<div class="no-image">📷</div>';
        }
        card.appendChild(imgDiv);
        
        var info = document.createElement('div');
        info.className = 'ultimo-card-info';
        
        var nombre = document.createElement('div');
        nombre.className = 'ultimo-card-nombre';
        nombre.textContent = p.nombre;
        info.appendChild(nombre);
        
        var precio = document.createElement('div');
        precio.className = 'ultimo-card-precio';
        precio.textContent = '$' + p.precio.toFixed(2);
        info.appendChild(precio);
        
        card.appendChild(info);
        container.appendChild(card);
    }
}

function agregarUltimoVisto(productoId) {
    var index = _ultimosVistos.indexOf(productoId);
    if (index > -1) {
        _ultimosVistos.splice(index, 1);
    }
    _ultimosVistos.unshift(productoId);
    if (_ultimosVistos.length > _MAX_ULTIMOS) {
        _ultimosVistos = _ultimosVistos.slice(0, _MAX_ULTIMOS);
    }
    localStorage.setItem("uniline_ultimos", JSON.stringify(_ultimosVistos));
    renderUltimosVistos();
}

// ================================
// PRODUCTOS POR CATEGORÍA
// ================================
function renderProductosPorCategoria() {
    var container = document.getElementById("productosPorCategoria");
    container.innerHTML = '';
    
    for (var i = 0; i < _menuData.categorias.length; i++) {
        var cat = _menuData.categorias[i];
        var prods = _menuData.productos.filter(p => p.categoria === cat.id);
        
        if (prods.length === 0) continue;
        
        var grupo = document.createElement('div');
        grupo.className = 'categoria-grupo';
        
        var header = document.createElement('div');
        header.className = 'categoria-grupo-header';
        header.innerHTML = '<h3>' + cat.icono + ' ' + cat.nombre + '</h3><span class="categoria-grupo-count">' + prods.length + ' productos</span>';
        grupo.appendChild(header);
        
        var prodContainer = document.createElement('div');
        prodContainer.className = 'categoria-grupo-productos';
        
        for (var k = 0; k < prods.length; k++) {
            var card = createProductCard(prods[k]);
            prodContainer.appendChild(card);
        }
        
        grupo.appendChild(prodContainer);
        container.appendChild(grupo);
    }
}

// ================================
// MODAL PRODUCTO
// ================================
window.abrirModal = function(productoId) {
    _currentProduct = _menuData.productos.find(p => p.id === productoId);
    if (!_currentProduct) return;
    
    agregarUltimoVisto(productoId);
    
    _modalQuantity = 1;
    _selectedExtras = [];
    
    var imgContainer = document.getElementById("modalImagen");
    imgContainer.innerHTML = '';
    if (_currentProduct.imagen) {
        var img = document.createElement('img');
        img.src = _currentProduct.imagen;
        img.alt = window._escapeHTML(_currentProduct.nombre);
        img.onerror = function() {
            this.parentElement.innerHTML = '<div class="no-image">📷</div>';
        };
        imgContainer.appendChild(img);
    } else {
        imgContainer.innerHTML = '<div class="no-image">📷</div>';
    }
    
    document.getElementById("modalNombre").textContent = _currentProduct.nombre;
    document.getElementById("modalDescripcion").textContent = _currentProduct.descripcion || "";
    document.getElementById("modalPrecio").textContent = "$" + _currentProduct.precio.toFixed(2);
    document.getElementById("modalTiempo").textContent = _currentProduct.tiempo;
    document.getElementById("modalNotas").value = "";
    
    var extrasSection = document.getElementById("extrasSection");
    if (_currentProduct.tieneExtras) {
        var disponibles = [];
        for (var i = 0; i < _menuData.productoExtras.length; i++) {
            if (_menuData.productoExtras[i].productoId === _currentProduct.id) {
                var extraId = _menuData.productoExtras[i].extraId;
                var extra = _menuData.extras.find(e => e.id === extraId);
                if (extra) disponibles.push(extra);
            }
        }
        
        if (disponibles.length > 0) {
            extrasSection.style.display = "block";
            var lista = document.getElementById("extrasList");
            lista.innerHTML = '';
            
            for (var k = 0; k < disponibles.length; k++) {
                var e = disponibles[k];
                var item = document.createElement('div');
                item.className = 'extra-item';
                item.setAttribute('data-extraid', e.id);
                item.setAttribute('data-extranombre', e.nombre);
                item.setAttribute('data-extraprecio', e.precio);
                item.onclick = function() {
                    window.toggleExtra(
                        this.getAttribute('data-extraid'),
                        this.getAttribute('data-extranombre'),
                        parseFloat(this.getAttribute('data-extraprecio'))
                    );
                };
                
                var check = document.createElement('div');
                check.className = 'extra-check';
                check.id = 'check_' + e.id;
                item.appendChild(check);
                
                var nombre = document.createElement('span');
                nombre.className = 'extra-name';
                nombre.textContent = e.nombre;
                item.appendChild(nombre);
                
                var precio = document.createElement('span');
                precio.className = 'extra-price';
                precio.textContent = '+$' + e.precio.toFixed(2);
                item.appendChild(precio);
                
                lista.appendChild(item);
            }
        } else {
            extrasSection.style.display = "none";
        }
    } else {
        extrasSection.style.display = "none";
    }
    
    document.getElementById("modalCantidad").textContent = _modalQuantity;
    actualizarTotalModal();
    renderSimilares();
    
    document.getElementById("modalProducto").classList.add("show");
    document.body.style.overflow = "hidden";
};

window.cerrarModal = function() {
    document.getElementById("modalProducto").classList.remove("show");
    document.body.style.overflow = "";
    _currentProduct = null;
};

window.toggleExtra = function(id, nombre, precio) {
    var index = _selectedExtras.findIndex(e => e.id === id);
    var checkEl = document.getElementById("check_" + id);
    var itemEl = document.querySelector('[data-extraid="' + id + '"]');
    
    if (index >= 0) {
        _selectedExtras.splice(index, 1);
        if (checkEl) checkEl.textContent = "";
        if (itemEl) itemEl.classList.remove("selected");
    } else {
        _selectedExtras.push({ id: id, nombre: nombre, precio: precio });
        if (checkEl) checkEl.textContent = "✓";
        if (itemEl) itemEl.classList.add("selected");
    }
    actualizarTotalModal();
};

window.cambiarCantidad = function(delta) {
    _modalQuantity = Math.max(1, _modalQuantity + delta);
    document.getElementById("modalCantidad").textContent = _modalQuantity;
    actualizarTotalModal();
};

function actualizarTotalModal() {
    var extrasTotal = 0;
    for (var i = 0; i < _selectedExtras.length; i++) {
        extrasTotal += _selectedExtras[i].precio;
    }
    var total = (_currentProduct.precio + extrasTotal) * _modalQuantity;
    document.getElementById("modalTotal").textContent = "$" + total.toFixed(2);
}

function renderSimilares() {
    var section = document.getElementById("similaresSection");
    var container = document.getElementById("similaresContainer");
    
    if (!_currentProduct) {
        section.style.display = "none";
        return;
    }
    
    var similares = _menuData.productos.filter(p => 
        p.categoria === _currentProduct.categoria && p.id !== _currentProduct.id
    );
    
    if (similares.length === 0) {
        section.style.display = "none";
        return;
    }
    
    section.style.display = "block";
    container.innerHTML = '';
    
    for (var j = 0; j < Math.min(similares.length, 5); j++) {
        var p = similares[j];
        var card = document.createElement('div');
        card.className = 'similar-card';
        card.setAttribute('data-productid', p.id);
        card.onclick = function() {
            window.cerrarModal();
            setTimeout(function() {
                window.abrirModal(this.getAttribute('data-productid'));
            }.bind(this), 300);
        };
        
        var imgDiv = document.createElement('div');
        imgDiv.className = 'similar-card-img';
        if (p.imagen) {
            var img = document.createElement('img');
            img.src = p.imagen;
            img.alt = window._escapeHTML(p.nombre);
            imgDiv.appendChild(img);
        } else {
            imgDiv.innerHTML = '<div class="no-image">📷</div>';
        }
        card.appendChild(imgDiv);
        
        var info = document.createElement('div');
        info.className = 'similar-card-info';
        
        var nombre = document.createElement('div');
        nombre.className = 'similar-card-nombre';
        nombre.textContent = p.nombre;
        info.appendChild(nombre);
        
        var precio = document.createElement('div');
        precio.className = 'similar-card-precio';
        precio.textContent = '$' + p.precio.toFixed(2);
        info.appendChild(precio);
        
        card.appendChild(info);
        container.appendChild(card);
    }
}

window.agregarAlCarrito = function() {
    if (!_currentProduct) return;
    
    var extrasTotal = 0;
    var extrasIds = [];
    
    for (var i = 0; i < _selectedExtras.length; i++) {
        extrasTotal += _selectedExtras[i].precio;
        extrasIds.push(_selectedExtras[i].id);
    }
    
    var notas = document.getElementById("modalNotas").value.trim();
    notas = window._sanitizeHTML(notas).substring(0, 500);
    
    var item = {
        id: _currentProduct.id + "_" + Date.now(),
        productoId: _currentProduct.id,
        nombre: _currentProduct.nombre,
        imagen: _currentProduct.imagen,
        precio: _currentProduct.precio,
        cantidad: _modalQuantity,
        extras: _selectedExtras.slice(),
        extrasIds: extrasIds.join(","),
        extrasTotal: extrasTotal,
        subtotal: (_currentProduct.precio + extrasTotal) * _modalQuantity,
        notas: notas
    };
    
    _cart.push(item);
    saveCart();
    updateCartUI();
    window.cerrarModal();
    mostrarToast("¡Producto agregado al carrito!");
};

// ================================
// CARRITO
// ================================
function saveCart() {
    window._secureStorage.set("uniline_cart", _cart);
}

function loadCart() {
    var saved = window._secureStorage.get("uniline_cart");
    if (saved && Array.isArray(saved)) {
        _cart = saved;
    }
    updateCartUI();
}

function updateCartUI() {
    var totalItems = 0;
    var subtotal = 0;
    
    for (var i = 0; i < _cart.length; i++) {
        totalItems += _cart[i].cantidad;
        subtotal += _cart[i].subtotal;
    }
    
    document.getElementById("cartBadge").textContent = totalItems;
    document.getElementById("footerCartBadge").textContent = totalItems;
    
    var itemsContainer = document.getElementById("cartItems");
    var footer = document.getElementById("cartFooter");
    
    if (_cart.length === 0) {
        itemsContainer.innerHTML = "<div class='cart-empty'><span>🛒</span><p>Tu carrito está vacío</p><button class='btn-comenzar' onclick='toggleCart(); setTimeout(function(){mostrarSeccion(\"menu\")}, 300);'>Comenzar a pedir</button></div>";
        footer.style.display = "none";
        document.getElementById("carritoFlotante").style.display = "none";
        return;
    }
    
    footer.style.display = "block";
    document.getElementById("carritoFlotante").style.display = "flex";
    
    itemsContainer.innerHTML = '';
    for (var j = 0; j < _cart.length; j++) {
        var item = _cart[j];
        
        var cartItem = document.createElement('div');
        cartItem.className = 'cart-item';
        
        var imgDiv = document.createElement('div');
        imgDiv.className = 'cart-item-img';
        if (item.imagen && item.imagen.trim() !== "") {
            var img = document.createElement('img');
            img.src = item.imagen;
            img.alt = window._escapeHTML(item.nombre);
            imgDiv.appendChild(img);
        } else {
            imgDiv.innerHTML = '<div class="no-img">📷</div>';
        }
        cartItem.appendChild(imgDiv);
        
        var info = document.createElement('div');
        info.className = 'cart-item-info';
        
        var nombre = document.createElement('div');
        nombre.className = 'cart-item-name';
        nombre.textContent = item.nombre;
        info.appendChild(nombre);
        
        if (item.extras && item.extras.length > 0) {
            var extrasStr = item.extras.map(e => e.nombre).join(", ");
            var extras = document.createElement('div');
            extras.className = 'cart-item-extras';
            extras.textContent = '+ ' + extrasStr;
            info.appendChild(extras);
        }
        
        if (item.notas) {
            var notas = document.createElement('div');
            notas.className = 'cart-item-notas';
            notas.textContent = '📝 ' + item.notas;
            info.appendChild(notas);
        }
        
        var precio = document.createElement('div');
        precio.className = 'cart-item-price';
        precio.textContent = '$' + item.subtotal.toFixed(2);
        info.appendChild(precio);
        
        var actions = document.createElement('div');
        actions.className = 'cart-item-actions';
        
        var btnMenos = document.createElement('button');
        btnMenos.textContent = '−';
        btnMenos.setAttribute('data-index', j);
        btnMenos.onclick = function() {
            changeItemQuantity(parseInt(this.getAttribute('data-index')), -1);
        };
        actions.appendChild(btnMenos);
        
        var cantidad = document.createElement('span');
        cantidad.textContent = item.cantidad;
        actions.appendChild(cantidad);
        
        var btnMas = document.createElement('button');
        btnMas.textContent = '+';
        btnMas.setAttribute('data-index', j);
        btnMas.onclick = function() {
            changeItemQuantity(parseInt(this.getAttribute('data-index')), 1);
        };
        actions.appendChild(btnMas);
        
        var btnEliminar = document.createElement('button');
        btnEliminar.className = 'cart-item-remove';
        btnEliminar.textContent = '🗑️';
        btnEliminar.setAttribute('data-index', j);
        btnEliminar.onclick = function() {
            removeItem(parseInt(this.getAttribute('data-index')));
        };
        actions.appendChild(btnEliminar);
        
        info.appendChild(actions);
        cartItem.appendChild(info);
        itemsContainer.appendChild(cartItem);
    }
    
    document.getElementById("cartSubtotal").textContent = "$" + subtotal.toFixed(2);
    document.getElementById("cartTotal").textContent = "$" + subtotal.toFixed(2);
    
    document.getElementById("flotanteItems").textContent = totalItems + " items";
    document.getElementById("flotanteTotal").textContent = "$" + subtotal.toFixed(2);
}

function changeItemQuantity(index, delta) {
    if (index < 0 || index >= _cart.length) return;
    
    _cart[index].cantidad = Math.max(1, _cart[index].cantidad + delta);
    var precioUnitario = _cart[index].precio + _cart[index].extrasTotal;
    _cart[index].subtotal = precioUnitario * _cart[index].cantidad;
    saveCart();
    updateCartUI();
}

function removeItem(index) {
    if (index < 0 || index >= _cart.length) return;
    
    _cart.splice(index, 1);
    saveCart();
    updateCartUI();
}

window.toggleCart = function() {
    var overlay = document.getElementById("cartOverlay");
    var sidebar = document.getElementById("cartSidebar");
    
    if (overlay.classList.contains("show")) {
        overlay.classList.remove("show");
        sidebar.classList.remove("show");
    } else {
        overlay.classList.add("show");
        sidebar.classList.add("show");
    }
};

// ================================
// CHECKOUT
// ================================
window.abrirCheckout = function() {
    if (_cart.length === 0) return;
    
    if (!_sessionData) {
        _pendingAction = "checkout";
        window.toggleCart();
        setTimeout(function() {
            window.abrirModalAuth();
        }, 300);
        return;
    }
    
    window.toggleCart();
    
    setTimeout(function() {
        document.getElementById("modalCheckout").classList.add("show");
        document.getElementById("checkoutTelefono").value = _sessionData.telefono || "";
        
        window.selectTipoServicio(_tipoServicio);
        cargarDireccionesCheckout();
        renderCheckoutItems();
    }, 300);
};

window.cerrarCheckout = function() {
    document.getElementById("modalCheckout").classList.remove("show");
    _cuponAplicado = null;
    document.getElementById("cuponAplicadoInfo").style.display = "none";
    document.getElementById("cuponInputWrapper").style.display = "flex";
    document.getElementById("inputCupon").value = "";
    document.getElementById("checkoutDescuentoRow").style.display = "none";
};

window.selectTipoServicio = function(tipo) {
    _tipoServicio = tipo;
    
    var btns = document.querySelectorAll(".tipo-btn");
    for (var i = 0; i < btns.length; i++) {
        btns[i].classList.remove("active");
        if (btns[i].textContent.indexOf(tipo) >= 0) {
            btns[i].classList.add("active");
        }
    }
    
    var seccionDir = document.getElementById("seccionDireccion");
    if (tipo === "Domicilio") {
        seccionDir.style.display = "block";
        _costoEnvio = 25;
    } else {
        seccionDir.style.display = "none";
        _costoEnvio = 0;
        _direccionSeleccionada = null;
    }
    
    actualizarTotalesCheckout();
};

async function cargarDireccionesCheckout() {
    if (!_sessionData) return;
    
    var container = document.getElementById("direccionesGuardadas");
    container.innerHTML = "<div class='loading-mini'><span>Cargando...</span></div>";
    
    const data = await callAPI('/api/direcciones/' + _sessionData.id);
    _direccionesCliente = data || [];
    
    if (_direccionesCliente.length === 0) {
        container.innerHTML = "<div class='direcciones-empty'>No tienes direcciones guardadas</div>";
        window.mostrarFormDireccion();
        return;
    }
    
    container.innerHTML = '';
    for (var i = 0; i < _direccionesCliente.length; i++) {
        var d = _direccionesCliente[i];
        var item = document.createElement('div');
        item.className = 'direccion-item';
        if (_direccionSeleccionada && _direccionSeleccionada.id === d.id) {
            item.classList.add('selected');
        }
        item.setAttribute('data-index', i);
        item.onclick = function() {
            window.seleccionarDireccion(parseInt(this.getAttribute('data-index')));
        };
        
        var radio = document.createElement('div');
        radio.className = 'direccion-radio';
        item.appendChild(radio);
        
        var texto = document.createElement('div');
        texto.className = 'direccion-texto';
        texto.textContent = d.direccion;
        item.appendChild(texto);
        
        container.appendChild(item);
    }
    
    if (!_direccionSeleccionada && _direccionesCliente.length > 0) {
        window.seleccionarDireccion(0);
    }
}

window.seleccionarDireccion = function(index) {
    if (index < 0 || index >= _direccionesCliente.length) return;
    
    _direccionSeleccionada = _direccionesCliente[index];
    _coordenadasEntrega = _direccionSeleccionada.maps || "";
    
    var items = document.querySelectorAll("#direccionesGuardadas .direccion-item");
    for (var i = 0; i < items.length; i++) {
        items[i].classList.remove("selected");
    }
    if (items[index]) items[index].classList.add("selected");
    
    document.getElementById("nuevaDireccionForm").style.display = "none";
    document.getElementById("btnAgregarDir").style.display = "block";
};

window.mostrarFormDireccion = function() {
    document.getElementById("checkoutDireccion").value = "";
    document.getElementById("checkoutCoordenadas").value = "";
    document.getElementById("coordenadasInfo").style.display = "none";
    document.getElementById("ubicacionIcon").textContent = "📍";
    document.getElementById("ubicacionText").textContent = "Usar mi ubicación";
    
    document.getElementById("nuevaDireccionForm").style.display = "block";
    document.getElementById("btnAgregarDir").style.display = "none";
    
    _direccionSeleccionada = null;
};

window.cancelarNuevaDireccion = function() {
    document.getElementById("nuevaDireccionForm").style.display = "none";
    document.getElementById("btnAgregarDir").style.display = "block";
};

window.obtenerUbicacion = function() {
    if (!navigator.geolocation) {
        alert("Tu navegador no soporta geolocalización");
        return;
    }
    
    var btn = event.target.closest(".btn-ubicacion");
    btn.classList.add("loading");
    document.getElementById("ubicacionIcon").textContent = "⏳";
    document.getElementById("ubicacionText").textContent = "Obteniendo...";
    
    navigator.geolocation.getCurrentPosition(
        function(position) {
            var lat = position.coords.latitude;
            var lng = position.coords.longitude;
            _coordenadasEntrega = lat + "," + lng;
            document.getElementById("checkoutCoordenadas").value = _coordenadasEntrega;
            document.getElementById("coordenadasInfo").style.display = "block";
            document.getElementById("ubicacionIcon").textContent = "✅";
            document.getElementById("ubicacionText").textContent = "Ubicación capturada";
            btn.classList.remove("loading");
        },
        function(error) {
            btn.classList.remove("loading");
            document.getElementById("ubicacionIcon").textContent = "❌";
            document.getElementById("ubicacionText").textContent = "Error al obtener";
            alert("No se pudo obtener tu ubicación");
        }
    );
};

window.guardarNuevaDireccion = async function() {
    var dir = document.getElementById("checkoutDireccion").value.trim();
    dir = window._sanitizeHTML(dir).substring(0, 500);
    
    if (!dir || !window._validateInput.text(dir, 500)) {
        alert("Escribe una dirección válida");
        return;
    }
    
    var coords = document.getElementById("checkoutCoordenadas").value || "";
    
    const data = await callAPI('/api/direcciones', {
        method: 'POST',
        body: JSON.stringify({
            clienteId: _sessionData.id,
            direccion: dir,
            maps: coords
        })
    });
    
    if (data.success) {
        _direccionSeleccionada = { id: data.id, direccion: dir, maps: coords };
        _coordenadasEntrega = coords;
        cargarDireccionesCheckout();
        mostrarToast("Dirección guardada");
    } else {
        alert("Error al guardar");
    }
};

function renderCheckoutItems() {
    var container = document.getElementById("checkoutItems");
    container.innerHTML = '';
    
    for (var i = 0; i < _cart.length; i++) {
        var item = _cart[i];
        var div = document.createElement('div');
        div.className = 'checkout-item';
        
        var nombre = document.createElement('span');
        nombre.className = 'checkout-item-name';
        nombre.textContent = item.nombre;
        div.appendChild(nombre);
        
        var qty = document.createElement('span');
        qty.className = 'checkout-item-qty';
        qty.textContent = 'x' + item.cantidad + ' = $' + item.subtotal.toFixed(2);
        div.appendChild(qty);
        
        container.appendChild(div);
    }
    
    actualizarTotalesCheckout();
}

function actualizarTotalesCheckout() {
    var subtotal = 0;
    for (var i = 0; i < _cart.length; i++) {
        subtotal += _cart[i].subtotal;
    }
    
    var descuento = 0;
    if (_cuponAplicado) {
        descuento = Math.round(subtotal * (_cuponAplicado.descuento / 100));
    }
    
    var total = subtotal + _costoEnvio - descuento;
    
    document.getElementById("checkoutSubtotal").textContent = "$" + subtotal.toFixed(2);
    
    var envioRow = document.getElementById("checkoutEnvioRow");
    if (_tipoServicio === "Domicilio") {
        envioRow.style.display = "flex";
        document.getElementById("checkoutEnvio").textContent = "$" + _costoEnvio.toFixed(2);
    } else {
        envioRow.style.display = "none";
    }
    
    var descuentoRow = document.getElementById("checkoutDescuentoRow");
    if (descuento > 0) {
        descuentoRow.style.display = "flex";
        document.getElementById("checkoutDescuento").textContent = "-$" + descuento.toFixed(2);
    } else {
        descuentoRow.style.display = "none";
    }
    
    document.getElementById("checkoutTotal").textContent = "$" + total.toFixed(2);
}

// ================================
// CUPONES
// ================================
async function verificarCuponAutomatico() {
    if (!_sessionData) return;
    
    const data = await callAPI('/api/cupones/automatico?clienteId=' + _sessionData.id);
    
    if (!data || !data.id) return;
    
    _cuponAutomaticoData = data;
    
    var imgContainer = document.getElementById("cuponImagen");
    imgContainer.innerHTML = '';
    if (data.imagen) {
        var img = document.createElement('img');
        img.src = data.imagen;
        img.alt = '';
        imgContainer.appendChild(img);
    } else {
        imgContainer.style.display = "none";
    }
    
    document.getElementById("cuponNombre").textContent = data.nombre;
    document.getElementById("cuponDescuento").textContent = "-" + data.descuento + "%";
    
    if (data.vigencia) {
        var fecha = new Date(data.vigencia);
        document.getElementById("cuponVigencia").textContent = "Válido hasta: " + fecha.toLocaleDateString();
    } else {
        document.getElementById("cuponVigencia").textContent = "";
    }
    
    document.getElementById("modalCupon").classList.add("show");
}

window.cerrarModalCupon = function() {
    document.getElementById("modalCupon").classList.remove("show");
    _cuponAutomaticoData = null;
};

window.aplicarCuponAutomatico = function() {
    if (!_cuponAutomaticoData) return;
    
    _cuponAplicado = {
        id: _cuponAutomaticoData.id,
        nombre: _cuponAutomaticoData.nombre,
        descuento: _cuponAutomaticoData.descuento,
        codigo: _cuponAutomaticoData.codigo
    };
    
    window.cerrarModalCupon();
    mostrarToast("¡Cupón aplicado!");
};

window.validarCuponManual = async function() {
    var codigo = document.getElementById("inputCupon").value.trim().toUpperCase();
    codigo = window._sanitizeHTML(codigo).substring(0, 50);
    
    if (!codigo || !window._validateInput.text(codigo, 50)) {
        document.getElementById("cuponError").textContent = "Ingresa un código válido";
        document.getElementById("cuponError").style.display = "block";
        return;
    }
    
    if (!_sessionData) {
        document.getElementById("cuponError").textContent = "Debes iniciar sesión";
        document.getElementById("cuponError").style.display = "block";
        return;
    }
    
    var btn = document.getElementById("btnValidarCupon");
    btn.disabled = true;
    btn.textContent = "...";
    
    const data = await callAPI('/api/cupones/validar', {
        method: 'POST',
        body: JSON.stringify({
            codigo: codigo,
            clienteId: _sessionData.id
        })
    });
    
    btn.disabled = false;
    btn.textContent = "Aplicar";
    
    if (data.success && data.cupon) {
        _cuponAplicado = data.cupon;
        
        document.getElementById("checkoutCuponNombre").textContent = _cuponAplicado.codigo;
        document.getElementById("checkoutCuponDescuento").textContent = "-" + _cuponAplicado.descuento + "%";
        document.getElementById("cuponAplicadoInfo").style.display = "flex";
        document.getElementById("cuponInputWrapper").style.display = "none";
        document.getElementById("cuponError").style.display = "none";
        
        actualizarTotalesCheckout();
        mostrarToast("¡Cupón aplicado!");
    } else {
        document.getElementById("cuponError").textContent = data.mensaje || "Cupón no válido";
        document.getElementById("cuponError").style.display = "block";
    }
};

window.quitarCupon = function() {
    _cuponAplicado = null;
    document.getElementById("cuponAplicadoInfo").style.display = "none";
    document.getElementById("cuponInputWrapper").style.display = "flex";
    document.getElementById("inputCupon").value = "";
    actualizarTotalesCheckout();
};

// ================================
// CONFIRMAR PEDIDO
// ================================
window.confirmarPedido = async function() {
    if (_cart.length === 0) return;
    
    var telefono = document.getElementById("checkoutTelefono").value.trim();
    if (!window._validateInput.phone(telefono)) {
        alert("Ingresa un teléfono válido de 10 dígitos");
        return;
    }
    
    if (_tipoServicio === "Domicilio") {
        if (!_direccionSeleccionada) {
            var dirManual = document.getElementById("checkoutDireccion").value.trim();
            if (!dirManual) {
                alert("Selecciona o ingresa una dirección");
                return;
            }
        }
    }
    
    var btn = document.getElementById("btnConfirmar");
    btn.disabled = true;
    btn.textContent = "Enviando...";
    
    var productos = [];
    for (var i = 0; i < _cart.length; i++) {
        var item = _cart[i];
        productos.push({
            productoId: item.productoId,
            nombre: item.nombre,
            cantidad: item.cantidad,
            precio: item.precio,
            extras: item.extras || [],
            extrasIds: item.extrasIds || "",
            extrasTotal: item.extrasTotal || 0,
            subtotal: item.subtotal,
            notas: item.notas || ""
        });
    }
    
    var observaciones = document.getElementById("checkoutObservaciones").value.trim();
    observaciones = window._sanitizeHTML(observaciones).substring(0, 500);
    
    var datosPedido = {
        clienteId: _sessionData.id,
        nombreCliente: _sessionData.nombre,
        telefono: telefono,
        direccion: _direccionSeleccionada ? _direccionSeleccionada.direccion : document.getElementById("checkoutDireccion").value.trim(),
        tipoServicio: _tipoServicio,
        costoEnvio: _costoEnvio,
        coordenadas: _coordenadasEntrega,
        observaciones: observaciones,
        productos: productos,
        cupon: _cuponAplicado
    };
    
    const data = await callAPI('/api/pedidos', {
        method: 'POST',
        body: JSON.stringify(datosPedido)
    });
    
    btn.disabled = false;
    btn.textContent = "✓ Confirmar Pedido";
    
    if (data.success && data.folio) {
        _cart = [];
        saveCart();
        updateCartUI();
        window.cerrarCheckout();
        
        document.getElementById("exitoFolio").textContent = data.folio;
        document.getElementById("modalExito").classList.add("show");
        
        _cuponAplicado = null;
    } else {
        alert(data.mensaje || "Error al confirmar");
    }
};

window.cerrarExito = function() {
    document.getElementById("modalExito").classList.remove("show");
    window.navegar("pedidos");
};

// ================================
// PEDIDOS
// ================================
async function cargarPedidos() {
    if (!_sessionData) {
        document.getElementById("pedidosList").innerHTML = "<div class='empty-state'><div class='empty-icon'>📦</div><h3>Inicia sesión</h3><p>Debes iniciar sesión para ver tus pedidos</p><button class='btn-comenzar' onclick='window.abrirModalAuth()'>Iniciar Sesión</button></div>";
        return;
    }
    
    document.getElementById("pedidosList").innerHTML = "<div class='loading'><div class='spinner'></div><p>Cargando...</p></div>";
    
    const data = await callAPI('/api/pedidos/' + _sessionData.id);
    _pedidosCache = {};
    
    if (!data || data.length === 0) {
        document.getElementById("pedidosList").innerHTML = "<div class='empty-state'><div class='empty-icon'>📦</div><h3>No hay pedidos</h3><p>Aún no has realizado ningún pedido</p><button class='btn-comenzar' onclick='window.mostrarSeccion(\"menu\")'>Comenzar a Pedir</button></div>";
        return;
    }
    
    var html = '';
    for (var i = 0; i < data.length; i++) {
        var p = data[i];
        _pedidosCache[p.folio] = p;
        html += renderPedidoCard(p);
    }
    
    document.getElementById("pedidosList").innerHTML = html;
    
    if (_pedidosInterval) clearInterval(_pedidosInterval);
    _pedidosInterval = setInterval(actualizarPedidosEnTiempoReal, 15000);
}

function renderPedidoCard(pedido) {
    var total = 0;
    for (var i = 0; i < pedido.productos.length; i++) {
        total += pedido.productos[i].subtotal;
    }
    total += pedido.costoEnvio - pedido.descuento;
    
    var tipoBadgeClass = pedido.tipoServicio === "Domicilio" ? "domicilio" : "recoger";
    var fecha = new Date(pedido.fecha);
    var fechaStr = fecha.toLocaleDateString();
    
    var html = "<div class='pedido-card'>";
    html += "<div class='pedido-header'>";
    html += "<div><div class='pedido-folio'>" + window._escapeHTML(pedido.folio) + "</div><div class='pedido-fecha'>" + fechaStr + " • " + (pedido.hora || "") + "</div></div>";
    html += "<div class='pedido-tipo-badge " + tipoBadgeClass + "'>" + (pedido.tipoServicio === "Domicilio" ? "🏠 Domicilio" : "🏪 Recoger") + "</div>";
    html += "</div>";
    
    if (pedido.tipoServicio === "Domicilio" && pedido.estadoDelivery) {
        html += renderDeliveryTrack(pedido.estadoDelivery);
    }
    
    html += "<div class='pedido-items'>";
    for (var j = 0; j < pedido.productos.length; j++) {
        var prod = pedido.productos[j];
        html += "<div class='pedido-item'>" + prod.cantidad + "x " + window._escapeHTML(prod.nombre);
        if (prod.extras) {
            html += " <span class='pedido-extras'>+ " + window._escapeHTML(prod.extras) + "</span>";
        }
        html += "</div>";
    }
    html += "</div>";
    
    if (pedido.descuento > 0) {
        html += "<div class='pedido-descuento'>💰 Descuento aplicado: -$" + pedido.descuento.toFixed(2) + "</div>";
    }
    
    html += "<div class='pedido-footer'><span class='pedido-total'>Total: $" + total.toFixed(2) + "</span></div>";
    html += "</div>";
    
    return html;
}

function renderDeliveryTrack(estado) {
    var steps = [
        { id: "Solicitado", icon: "📝", label: "Solicitado" },
        { id: "Preparando", icon: "👨‍🍳", label: "Preparando" },
        { id: "EnCamino", icon: "🚗", label: "En camino" },
        { id: "Entregado", icon: "✅", label: "Entregado" }
    ];
    
    var currentIndex = steps.findIndex(s => s.id === estado);
    if (currentIndex === -1) currentIndex = 0;
    
    var html = "<div class='pedido-delivery'><div class='delivery-track'>";
    
    for (var j = 0; j < steps.length; j++) {
        var step = steps[j];
        var completado = j <= currentIndex ? "completado" : "";
        var activo = j === currentIndex ? "activo" : "";
        
        html += "<div class='delivery-step " + completado + " " + activo + "'>";
        html += "<div class='step-icon'>" + step.icon + "</div>";
        html += "<div class='step-label'>" + step.label + "</div>";
        html += "</div>";
        
        if (j < steps.length - 1) {
            var lineClass = j < currentIndex ? "completado" : "";
            html += "<div class='step-line " + lineClass + "'></div>";
        }
    }
    
    html += "</div></div>";
    return html;
}

async function actualizarPedidosEnTiempoReal() {
    if (!_sessionData || document.getElementById("seccionPedidos").style.display === "none") return;
    
    const data = await callAPI('/api/pedidos/' + _sessionData.id);
    
    if (!data || data.length === 0) return;
    
    for (var i = 0; i < data.length; i++) {
        var pedido = data[i];
        var anterior = _pedidosCache[pedido.folio];
        
        if (anterior && anterior.estadoDelivery !== pedido.estadoDelivery) {
            mostrarToast("📦 Actualización: " + pedido.folio + " - " + pedido.estadoDelivery);
        }
        
        _pedidosCache[pedido.folio] = pedido;
    }
    
    var html = "";
    for (var j = 0; j < data.length; j++) {
        html += renderPedidoCard(data[j]);
    }
    document.getElementById("pedidosList").innerHTML = html;
}

// ================================
// AUTH - LOGIN/REGISTRO
// ================================
window.abrirModalAuth = function() {
    document.getElementById("modalAuth").classList.add("show");
    document.body.style.overflow = "hidden";
    window.mostrarTabAuth("login");
};

window.cerrarModalAuth = function() {
    document.getElementById("modalAuth").classList.remove("show");
    document.body.style.overflow = "";
};

window.mostrarTabAuth = function(tab) {
    if (tab === "login") {
        document.getElementById("formLogin").style.display = "block";
        document.getElementById("formRegistro").style.display = "none";
        document.querySelectorAll(".auth-tab")[0].classList.add("active");
        document.querySelectorAll(".auth-tab")[1].classList.remove("active");
    } else {
        document.getElementById("formLogin").style.display = "none";
        document.getElementById("formRegistro").style.display = "block";
        document.querySelectorAll(".auth-tab")[0].classList.remove("active");
        document.querySelectorAll(".auth-tab")[1].classList.add("active");
    }
};

window.togglePassword = function(inputId, iconId) {
    var input = document.getElementById(inputId);
    var icon = document.getElementById(iconId);
    
    if (input.type === "password") {
        input.type = "text";
        icon.textContent = "🙈";
    } else {
        input.type = "password";
        icon.textContent = "👁️";
    }
};

window.handleLogin = async function(e) {
    e.preventDefault();
    
    var correo = document.getElementById("loginCorreo").value.trim();
    var contrasena = document.getElementById("loginContrasena").value;
    
    if (!window._validateInput.email(correo)) {
        document.getElementById("alertLogin").className = "alert alert-error";
        document.getElementById("alertLogin").textContent = "Correo inválido";
        document.getElementById("alertLogin").style.display = "block";
        return false;
    }
    
    if (!contrasena || contrasena.length < 4) {
        document.getElementById("alertLogin").className = "alert alert-error";
        document.getElementById("alertLogin").textContent = "Contraseña muy corta";
        document.getElementById("alertLogin").style.display = "block";
        return false;
    }
    
    var btn = document.getElementById("btnLogin");
    btn.classList.add("loading");
    btn.disabled = true;
    
    document.getElementById("alertLogin").style.display = "none";
    
    const data = await callAPI('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ correo, contrasena })
    });
    
    btn.classList.remove("loading");
    btn.disabled = false;
    
    if (data.success && data.cliente) {
        _sessionData = Object.freeze(data.cliente);
        window._secureStorage.set("uniline_session", data.sessionId);
        window._secureStorage.set("uniline_cliente", data.cliente);
        
        actualizarUIUsuario();
        window.cerrarModalAuth();
        mostrarToast("¡Bienvenido " + _sessionData.nombre + "!");
        
        if (_pendingAction === "checkout") {
            _pendingAction = null;
            setTimeout(function() {
                window.abrirCheckout();
            }, 500);
        }
    } else {
        var alert = document.getElementById("alertLogin");
        alert.className = "alert alert-error";
        alert.textContent = data.mensaje || "Error al iniciar sesión";
        alert.style.display = "block";
    }
    
    return false;
};

window.handleRegistro = async function(e) {
    e.preventDefault();
    
    var nombre = document.getElementById("regNombre").value.trim();
    var telefono = document.getElementById("regTelefono").value.trim();
    var correo = document.getElementById("regCorreo").value.trim();
    var contrasena = document.getElementById("regContrasena").value;
    var contrasena2 = document.getElementById("regContrasena2").value;
    
    nombre = window._sanitizeHTML(nombre).substring(0, 255);
    
    document.getElementById("alertRegistro").style.display = "none";
    
    if (!window._validateInput.text(nombre, 255) || nombre.length < 3) {
        var alert = document.getElementById("alertRegistro");
        alert.className = "alert alert-error";
        alert.textContent = "Nombre muy corto";
        alert.style.display = "block";
        return false;
    }
    
    if (!window._validateInput.phone(telefono)) {
        var alert = document.getElementById("alertRegistro");
        alert.className = "alert alert-error";
        alert.textContent = "Teléfono inválido (10 dígitos)";
        alert.style.display = "block";
        return false;
    }
    
    if (!window._validateInput.email(correo)) {
        var alert = document.getElementById("alertRegistro");
        alert.className = "alert alert-error";
        alert.textContent = "Correo inválido";
        alert.style.display = "block";
        return false;
    }
    
    if (contrasena !== contrasena2) {
        var alert = document.getElementById("alertRegistro");
        alert.className = "alert alert-error";
        alert.textContent = "Las contraseñas no coinciden";
        alert.style.display = "block";
        return false;
    }
    
    if (contrasena.length < 4) {
        var alert = document.getElementById("alertRegistro");
        alert.className = "alert alert-error";
        alert.textContent = "La contraseña debe tener al menos 4 caracteres";
        alert.style.display = "block";
        return false;
    }
    
    var btn = document.getElementById("btnRegistro");
    btn.classList.add("loading");
    btn.disabled = true;
    
    const data = await callAPI('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
            nombre,
            telefono,
            correo,
            contrasena
        })
    });
    
    btn.classList.remove("loading");
    btn.disabled = false;
    
    if (data.success && data.cliente) {
        if (!data.cliente.id || !data.cliente.nombre || !data.cliente.correo) {
            var alert = document.getElementById("alertRegistro");
            alert.className = "alert alert-error";
            alert.textContent = "Error: Datos de registro inválidos";
            alert.style.display = "block";
            return false;
        }
        
        _sessionData = Object.freeze(data.cliente);
        window._secureStorage.set("uniline_session", data.sessionId);
        window._secureStorage.set("uniline_cliente", data.cliente);
        
        actualizarUIUsuario();
        window.cerrarModalAuth();
        mostrarToast("¡Cuenta creada! Bienvenido " + _sessionData.nombre);
        
        if (_pendingAction === "checkout") {
            _pendingAction = null;
            setTimeout(function() {
                window.abrirCheckout();
            }, 500);
        }
    } else {
        var alert = document.getElementById("alertRegistro");
        alert.className = "alert alert-error";
        alert.textContent = data.mensaje || "Error al registrar";
        alert.style.display = "block";
    }
    
    return false;
};

window.logout = function() {
    if (confirm("¿Cerrar sesión?")) {
        _sessionData = null;
        window._secureStorage.remove("uniline_session");
        window._secureStorage.remove("uniline_cliente");
        actualizarUIUsuario();
        
        var menu = document.getElementById("userMenu");
        if (menu) {
            menu.classList.remove("show");
        }
        
        mostrarToast("Sesión cerrada");
        window.mostrarSeccion("menu");
    }
};

// ================================
// CUENTA Y DIRECCIONES
// ================================
window.toggleUserMenu = function() {
    var menu = document.getElementById("userMenu");
    menu.classList.toggle("show");
};

window.navegar = function(seccion) {
    if (seccion === "cuenta") {
        if (!_sessionData) {
            window.abrirModalAuth();
            return;
        }
        window.abrirModalCuenta();
        return;
    }
    
    window.mostrarSeccion(seccion);
    
    if (window.event && window.event.target) {
        var items = document.querySelectorAll(".footer-item");
        for (var i = 0; i < items.length; i++) {
            items[i].classList.remove("active");
        }
        var footerItem = window.event.target.closest(".footer-item");
        if (footerItem) {
            footerItem.classList.add("active");
        }
    }
};

window.mostrarSeccion = function(seccion) {
    document.getElementById("seccionMenu").style.display = "none";
    document.getElementById("seccionPedidos").style.display = "none";
    
    if (seccion === "menu") {
        document.getElementById("seccionMenu").style.display = "block";
    } else if (seccion === "pedidos") {
        document.getElementById("seccionPedidos").style.display = "block";
        cargarPedidos();
    }
    
    window.scrollTo(0, 0);
};

window.abrirModalCuenta = function() {
    if (!_sessionData) return;
    
    document.getElementById("cuentaAvatar").textContent = window._escapeHTML(_sessionData.nombre.charAt(0).toUpperCase());
    document.getElementById("cuentaNombre").textContent = window._escapeHTML(_sessionData.nombre);
    document.getElementById("cuentaCorreo").textContent = window._escapeHTML(_sessionData.correo);
    document.getElementById("cuentaPuntos").textContent = _sessionData.puntos || 0;
    
    document.getElementById("modalCuenta").classList.add("show");
    document.body.style.overflow = "hidden";
};

window.cerrarCuenta = function() {
    document.getElementById("modalCuenta").classList.remove("show");
    document.body.style.overflow = "";
};

window.editarPerfil = function() {
    window.cerrarCuenta();
    
    document.getElementById("editNombre").value = _sessionData.nombre;
    document.getElementById("editTelefono").value = _sessionData.telefono;
    document.getElementById("editCorreo").value = _sessionData.correo;
    document.getElementById("editContrasena").value = "";
    document.getElementById("editContrasena2").value = "";
    
    document.getElementById("alertEditarPerfil").style.display = "none";
    
    document.getElementById("modalEditarPerfil").classList.add("show");
    document.body.style.overflow = "hidden";
};

window.cerrarEditarPerfil = function() {
    document.getElementById("modalEditarPerfil").classList.remove("show");
    document.body.style.overflow = "";
};

window.handleEditarPerfil = async function(e) {
    e.preventDefault();
    
    var nombre = document.getElementById("editNombre").value.trim();
    var telefono = document.getElementById("editTelefono").value.trim();
    var contrasena = document.getElementById("editContrasena").value;
    var contrasena2 = document.getElementById("editContrasena2").value;
    
    nombre = window._sanitizeHTML(nombre).substring(0, 255);
    
    document.getElementById("alertEditarPerfil").style.display = "none";
    
    if (!window._validateInput.text(nombre, 255) || nombre.length < 3) {
        var alert = document.getElementById("alertEditarPerfil");
        alert.className = "alert alert-error";
        alert.textContent = "Nombre muy corto";
        alert.style.display = "block";
        return false;
    }
    
    if (!window._validateInput.phone(telefono)) {
        var alert = document.getElementById("alertEditarPerfil");
        alert.className = "alert alert-error";
        alert.textContent = "Teléfono inválido";
        alert.style.display = "block";
        return false;
    }
    
    if (contrasena.trim() !== "" || contrasena2.trim() !== "") {
        if (contrasena.trim() !== contrasena2.trim()) {
            var alert = document.getElementById("alertEditarPerfil");
            alert.className = "alert alert-error";
            alert.textContent = "Las contraseñas no coinciden";
            alert.style.display = "block";
            return false;
        }
        if (contrasena.length < 4) {
            var alert = document.getElementById("alertEditarPerfil");
            alert.className = "alert alert-error";
            alert.textContent = "La contraseña debe tener al menos 4 caracteres";
            alert.style.display = "block";
            return false;
        }
    }
    
    var btn = document.getElementById("btnEditarPerfil");
    btn.classList.add("loading");
    btn.disabled = true;
    
    var datosActualizar = {
        nombre: nombre,
        telefono: telefono
    };
    
    if (contrasena && contrasena.trim() !== "") {
        datosActualizar.contrasena = contrasena.trim();
    }
    
    try {
        const data = await callAPI('/api/auth/perfil/' + _sessionData.id, {
            method: 'PUT',
            body: JSON.stringify(datosActualizar)
        });
        
        btn.classList.remove("loading");
        btn.disabled = false;
        
        if (data.success && data.cliente) {
            _sessionData = Object.freeze({
                id: data.cliente.id,
                nombre: data.cliente.nombre,
                telefono: data.cliente.telefono,
                correo: data.cliente.correo,
                direccion: data.cliente.direccion || "",
                puntos: data.cliente.puntos || 0
            });
            
            window._secureStorage.set("uniline_cliente", _sessionData);
            
            actualizarUIUsuario();
            window.cerrarEditarPerfil();
            mostrarToast("✅ Perfil actualizado correctamente");
        } else {
            var alert = document.getElementById("alertEditarPerfil");
            alert.className = "alert alert-error";
            alert.textContent = data.mensaje || "Error al actualizar";
            alert.style.display = "block";
        }
    } catch (error) {
        btn.classList.remove("loading");
        btn.disabled = false;
    }
    
    return false;
};

window.verDirecciones = async function() {
    if (!_sessionData) return;
    
    window.cerrarCuenta();
    
    document.getElementById("modalDirecciones").classList.add("show");
    document.body.style.overflow = "hidden";
    
    await cargarDirecciones();
};

window.cerrarModalDirecciones = function() {
    document.getElementById("modalDirecciones").classList.remove("show");
    document.body.style.overflow = "";
    window.cancelarFormDireccion();
};

async function cargarDirecciones() {
    var lista = document.getElementById("direccionesLista");
    lista.innerHTML = "<div class='loading-mini'><span>Cargando...</span></div>";
    
    const data = await callAPI('/api/direcciones/' + _sessionData.id);
    
    if (!data || data.length === 0) {
        lista.innerHTML = "<div class='direcciones-vacio'><div class='direcciones-vacio-icon'>📍</div><p>No tienes direcciones guardadas</p></div>";
        window.mostrarFormNuevaDireccion();
        return;
    }
    
    lista.innerHTML = '';
    for (var i = 0; i < data.length; i++) {
        var d = data[i];
        var card = document.createElement('div');
        card.className = 'direccion-card';
        
        var content = document.createElement('div');
        content.className = 'direccion-card-content';
        
        var icon = document.createElement('div');
        icon.className = 'direccion-card-icon';
        icon.textContent = '📍';
        content.appendChild(icon);
        
        var info = document.createElement('div');
        info.className = 'direccion-card-info';
        
        var texto = document.createElement('div');
        texto.className = 'direccion-card-text';
        texto.textContent = d.direccion;
        info.appendChild(texto);
        
        if (d.maps) {
            var gps = document.createElement('div');
            gps.className = 'direccion-card-gps';
            gps.textContent = '✓ Con ubicación GPS';
            info.appendChild(gps);
        }
        
        content.appendChild(info);
        card.appendChild(content);
        
        var actions = document.createElement('div');
        actions.className = 'direccion-card-actions';
        
        var btnEditar = document.createElement('button');
        btnEditar.className = 'btn-dir-action btn-dir-editar';
        btnEditar.textContent = '✏️ Editar';
        btnEditar.setAttribute('data-id', d.id);
        btnEditar.setAttribute('data-direccion', d.direccion);
        btnEditar.setAttribute('data-maps', d.maps || '');
        btnEditar.onclick = function() {
            window.editarDireccion(
                this.getAttribute('data-id'),
                this.getAttribute('data-direccion'),
                this.getAttribute('data-maps')
            );
        };
        actions.appendChild(btnEditar);
        
        if (d.maps) {
            var btnMaps = document.createElement('button');
            btnMaps.className = 'btn-dir-action btn-dir-maps';
            btnMaps.textContent = '🗺️ Ver';
            btnMaps.onclick = function() {
                window.open("https://www.google.com/maps?q=" + d.maps, "_blank");
            };
            actions.appendChild(btnMaps);
        }
        
        var btnEliminar = document.createElement('button');
        btnEliminar.className = 'btn-dir-action btn-dir-eliminar';
        btnEliminar.textContent = '🗑️';
        btnEliminar.setAttribute('data-id', d.id);
        btnEliminar.onclick = function() {
            window.eliminarDireccion(this.getAttribute('data-id'));
        };
        actions.appendChild(btnEliminar);
        
        card.appendChild(actions);
        lista.appendChild(card);
    }
}

window.mostrarFormNuevaDireccion = function() {
    document.getElementById("direccionEditId").value = "";
    document.getElementById("direccionFormTitulo").textContent = "Nueva Dirección";
    document.getElementById("direccionInput").value = "";
    document.getElementById("direccionMaps").value = "";
    document.getElementById("coordsDirInfo").style.display = "none";
    document.getElementById("ubicacionDirIcon").textContent = "📍";
    document.getElementById("ubicacionDirText").textContent = "Agregar ubicación GPS";
    
    document.getElementById("direccionForm").style.display = "block";
    document.getElementById("modalDirFooter").style.display = "none";
};

window.editarDireccion = function(id, direccion, maps) {
    document.getElementById("direccionEditId").value = id;
    document.getElementById("direccionFormTitulo").textContent = "Editar Dirección";
    document.getElementById("direccionInput").value = direccion;
    document.getElementById("direccionMaps").value = maps || "";
    
    if (maps) {
        document.getElementById("coordsDirInfo").style.display = "block";
        document.getElementById("ubicacionDirIcon").textContent = "✅";
        document.getElementById("ubicacionDirText").textContent = "Ubicación guardada";
    } else {
        document.getElementById("coordsDirInfo").style.display = "none";
        document.getElementById("ubicacionDirIcon").textContent = "📍";
        document.getElementById("ubicacionDirText").textContent = "Agregar ubicación GPS";
    }
    
    document.getElementById("direccionForm").style.display = "block";
    document.getElementById("modalDirFooter").style.display = "none";
};

window.cancelarFormDireccion = function() {
    document.getElementById("direccionForm").style.display = "none";
    document.getElementById("modalDirFooter").style.display = "block";
};

window.obtenerUbicacionDireccion = function() {
    if (!navigator.geolocation) {
        alert("Tu navegador no soporta geolocalización");
        return;
    }
    
    var btn = event.target.closest(".btn-ubicacion-dir");
    btn.disabled = true;
    document.getElementById("ubicacionDirIcon").textContent = "⏳";
    document.getElementById("ubicacionDirText").textContent = "Obteniendo...";
    
    navigator.geolocation.getCurrentPosition(
        function(position) {
            var coords = position.coords.latitude + "," + position.coords.longitude;
            document.getElementById("direccionMaps").value = coords;
            document.getElementById("coordsDirInfo").style.display = "block";
            document.getElementById("ubicacionDirIcon").textContent = "✅";
            document.getElementById("ubicacionDirText").textContent = "Ubicación capturada";
            btn.disabled = false;
        },
        function(error) {
            document.getElementById("ubicacionDirIcon").textContent = "❌";
            document.getElementById("ubicacionDirText").textContent = "Error al obtener";
            btn.disabled = false;
            alert("No se pudo obtener tu ubicación");
        }
    );
};

window.guardarDireccion = async function() {
    var dir = document.getElementById("direccionInput").value.trim();
    dir = window._sanitizeHTML(dir).substring(0, 500);
    
    if (!dir || !window._validateInput.text(dir, 500)) {
        alert("Escribe una dirección válida");
        return;
    }
    
    var maps = document.getElementById("direccionMaps").value || "";
    var editId = document.getElementById("direccionEditId").value;
    
    var btn = document.getElementById("btnGuardarDir");
    btn.disabled = true;
    btn.textContent = "Guardando...";
    
    var data;
    
    if (editId) {
        data = await callAPI('/api/direcciones/' + editId, {
            method: 'PUT',
            body: JSON.stringify({ direccion: dir, maps: maps })
        });
    } else {
        data = await callAPI('/api/direcciones', {
            method: 'POST',
            body: JSON.stringify({
                clienteId: _sessionData.id,
                direccion: dir,
                maps: maps
            })
        });
    }
    
    btn.disabled = false;
    btn.textContent = "Guardar";
    
    if (data.success) {
        window.cancelarFormDireccion();
        cargarDirecciones();
        mostrarToast(editId ? "Dirección actualizada" : "Dirección guardada");
    } else {
        alert("Error al guardar");
    }
};

window.eliminarDireccion = async function(id) {
    if (!confirm("¿Eliminar esta dirección?")) return;
    
    const data = await callAPI('/api/direcciones/' + id, {
        method: 'DELETE'
    });
    
    if (data.success) {
        cargarDirecciones();
        mostrarToast("Dirección eliminada");
    } else {
        alert("Error al eliminar");
    }
};

// ================================
// UTILIDADES
// ================================
function mostrarToast(mensaje) {
    mensaje = window._sanitizeHTML(mensaje).substring(0, 200);
    
    var toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = mensaje;
    document.body.appendChild(toast);
    
    setTimeout(function() {
        toast.classList.add("show");
    }, 100);
    
    setTimeout(function() {
        toast.classList.remove("show");
        setTimeout(function() {
            if (toast.parentNode) {
                document.body.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

// ================================
// CLICK OUTSIDE CLOSE
// ================================
document.addEventListener("click", function(e) {
    var userMenu = document.getElementById("userMenu");
    var userBtn = document.querySelector(".user-btn");
    
    if (userMenu && userBtn && !userMenu.contains(e.target) && !userBtn.contains(e.target)) {
        userMenu.classList.remove("show");
    }
});
})();
