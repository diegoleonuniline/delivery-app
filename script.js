// ================================
// CONFIGURACIÓN - URL DEL BACKEND
// ================================
const API_URL = 'https://delivery-uniline-back-d0e649feca1a.herokuapp.com';

// ================================
// VARIABLES GLOBALES
// ================================
var sessionData = null;
var menuData = { categorias: [], productos: [], extras: [], productoExtras: [], banners: [], promociones: [] };
var filteredProducts = [];
var cart = [];
var currentProduct = null;
var modalQuantity = 1;
var selectedExtras = [];
var tipoServicio = "Domicilio";
var costoEnvio = 25;
var direccionSeleccionada = null;
var coordenadasEntrega = "";
var direccionesCliente = [];
var pendingAction = null;
var cuponAplicado = null;
var cuponAutomaticoData = null;
var promocionesData = [];
var currentPromo = null;
var promoCantidad = 1;
var pedidosInterval = null;
var pedidosCache = {};
var currentView = localStorage.getItem("viewPreference") || "grid";
var bannerInterval = null;
var currentBanner = 0;
var ultimosVistos = JSON.parse(localStorage.getItem("uniline_ultimos") || "[]");
var MAX_ULTIMOS = 10;



// LIMPIEZA TEMPORAL - Eliminar después de 1 día
(function() {
    var lastClean = localStorage.getItem("uniline_last_clean");
    var now = Date.now();
    
    // Si nunca se ha limpiado o pasaron más de 24 horas
    if (!lastClean || (now - parseInt(lastClean)) > 86400000) {
        // Limpiar solo si hay datos corruptos
        var savedCliente = localStorage.getItem("uniline_cliente");
        if (savedCliente) {
            try {
                var cliente = JSON.parse(savedCliente);
                if (!cliente.id || !cliente.nombre || cliente.correo === "@gmail.com") {
                    localStorage.removeItem("uniline_session");
                    localStorage.removeItem("uniline_cliente");
                }
            } catch (e) {
                localStorage.removeItem("uniline_session");
                localStorage.removeItem("uniline_cliente");
            }
        }
        localStorage.setItem("uniline_last_clean", now.toString());
    }
})();
// ================================
// HELPER: FETCH API
// ================================
async function callAPI(endpoint, options = {}) {
    try {
        const response = await fetch(API_URL + endpoint, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        return await response.json();
    } catch (error) {
        console.error('Error API:', error);
        return { error: error.message };
    }
}

// ================================
// INICIALIZACIÓN
// ================================
window.addEventListener("load", function() {
    var savedSession = localStorage.getItem("uniline_session");
    var savedCliente = localStorage.getItem("uniline_cliente");
    
    // Validar que los datos sean válidos
    if (savedSession && savedCliente) {
        try {
            var cliente = JSON.parse(savedCliente);
            // Verificar que tenga datos mínimos necesarios
            if (cliente && cliente.id && cliente.nombre && cliente.correo) {
                sessionData = cliente;
            } else {
                // Datos corruptos, limpiar
                localStorage.removeItem("uniline_session");
                localStorage.removeItem("uniline_cliente");
                sessionData = null;
            }
        } catch (e) {
            // Error al parsear, limpiar
            localStorage.removeItem("uniline_session");
            localStorage.removeItem("uniline_cliente");
            sessionData = null;
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
    if (sessionData) {
        document.getElementById("userInitial").textContent = sessionData.nombre.charAt(0).toUpperCase();
        document.getElementById("userPoints").textContent = "⭐ " + (sessionData.puntos || 0);
        document.getElementById("menuUserName").textContent = sessionData.nombre;
        document.getElementById("menuUserEmail").textContent = sessionData.correo;
        document.getElementById("footerCuentaLabel").textContent = "Cuenta";
        
        // Ocultar botón login desktop
        var btnLogin = document.getElementById("btnLoginDesktop");
        if (btnLogin) btnLogin.style.display = "none";
    } else {
        document.getElementById("userInitial").textContent = "?";
        document.getElementById("userPoints").textContent = "";
        document.getElementById("menuUserName").textContent = "Invitado";
        document.getElementById("menuUserEmail").textContent = "No has iniciado sesión";
        document.getElementById("footerCuentaLabel").textContent = "Entrar";
        
        // Mostrar botón login desktop
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
        document.getElementById("productsGrid").innerHTML = "<p style='text-align:center;color:#ef4444;'>Error al cargar</p>";
        return;
    }
    
    menuData = data;
    filteredProducts = menuData.productos.slice();
    promocionesData = menuData.promociones || [];
    
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
    
    if (!menuData.banners || menuData.banners.length === 0) {
        container.style.display = "none";
        return;
    }
    
    container.style.display = "block";
    
    var slidesHtml = "";
    for (var i = 0; i < menuData.banners.length; i++) {
        var b = menuData.banners[i];
        slidesHtml += "<div class='banner-slide'><img src='" + b.url + "' alt='' onerror='this.parentElement.style.display=\"none\"'></div>";
    }
    slider.innerHTML = slidesHtml;
    
    var dotsHtml = "";
    for (var j = 0; j < menuData.banners.length; j++) {
        dotsHtml += "<div class='banner-dot " + (j === 0 ? "active" : "") + "' onclick='goToBanner(" + j + ")'></div>";
    }
    dots.innerHTML = dotsHtml;
    
    if (menuData.banners.length > 1) {
        startBannerAutoplay();
    }
}

function goToBanner(index) {
    currentBanner = index;
    document.getElementById("bannersSlider").style.transform = "translateX(-" + (index * 100) + "%)";
    var allDots = document.querySelectorAll(".banner-dot");
    for (var i = 0; i < allDots.length; i++) {
        if (i === index) {
            allDots[i].classList.add("active");
        } else {
            allDots[i].classList.remove("active");
        }
    }
}

function startBannerAutoplay() {
    if (bannerInterval) clearInterval(bannerInterval);
    bannerInterval = setInterval(function() {
        currentBanner = (currentBanner + 1) % menuData.banners.length;
        goToBanner(currentBanner);
    }, 4000);
}

// ================================
// CATEGORÍAS
// ================================
function renderCategorias() {
    var container = document.getElementById("categoriesContainer");
    var html = "<div class='category-chip active' data-cat='all' onclick='filtrarCategoria(\"all\")'>Todos</div>";
    for (var i = 0; i < menuData.categorias.length; i++) {
        var cat = menuData.categorias[i];
        html += "<div class='category-chip' data-cat='" + cat.id + "' onclick='filtrarCategoria(\"" + cat.id + "\")'>" + cat.icono + " " + cat.nombre + "</div>";
    }
    container.innerHTML = html;
}

function filtrarCategoria(catId) {
    var chips = document.querySelectorAll(".category-chip");
    for (var i = 0; i < chips.length; i++) {
        chips[i].classList.remove("active");
    }
    event.target.classList.add("active");
    
    if (catId === "all") {
        filteredProducts = menuData.productos.slice();
        document.getElementById("categoryTitle").textContent = "Todos los Platillos";
    } else {
        filteredProducts = [];
        for (var j = 0; j < menuData.productos.length; j++) {
            if (menuData.productos[j].categoria === catId) {
                filteredProducts.push(menuData.productos[j]);
            }
        }
        var cat = null;
        for (var k = 0; k < menuData.categorias.length; k++) {
            if (menuData.categorias[k].id === catId) {
                cat = menuData.categorias[k];
                break;
            }
        }
        document.getElementById("categoryTitle").textContent = cat ? cat.nombre : "Platillos";
    }
    renderProductos();
}

// ================================
// PRODUCTOS
// ================================
function buscarProductos() {
    var term = document.getElementById("searchInput").value.toLowerCase();
    filteredProducts = [];
    for (var i = 0; i < menuData.productos.length; i++) {
        var p = menuData.productos[i];
        if (p.nombre.toLowerCase().indexOf(term) >= 0 || p.descripcion.toLowerCase().indexOf(term) >= 0) {
            filteredProducts.push(p);
        }
    }
    renderProductos();
}

function renderProductos() {
    var grid = document.getElementById("productsGrid");
    document.getElementById("productsCount").textContent = filteredProducts.length + " productos";
    
    if (filteredProducts.length === 0) {
        grid.innerHTML = "<p style='text-align:center;color:#6b7280;padding:40px;'>No hay productos</p>";
        return;
    }
    
    var html = "";
    for (var i = 0; i < filteredProducts.length; i++) {
        var p = filteredProducts[i];
        var hasImage = p.imagen && p.imagen.trim() !== "";
        var imgHtml = hasImage ? "<img src='" + p.imagen + "' alt='" + p.nombre + "' onerror='this.parentElement.innerHTML=\"<div class=no-image><span>📷</span></div>\"'>" : "<div class='no-image'><span>📷</span></div>";
        
        html += "<div class='product-card' onclick='abrirModal(\"" + p.id + "\")'>";
        html += "<div class='product-image'>" + imgHtml + "</div>";
        html += "<div class='product-info'>";
        html += "<div class='product-name'>" + p.nombre + "</div>";
        html += "<div class='product-desc'>" + (p.descripcion || "") + "</div>";
        html += "<div class='product-footer'>";
        html += "<span class='product-price'>$" + p.precio.toFixed(2) + "</span>";
        html += "<span class='product-time'>" + p.tiempo + "</span>";
        html += "</div>";
        html += "<button class='btn-add-cart' onclick='event.stopPropagation(); abrirModal(\"" + p.id + "\")'>Agregar</button>";
        html += "</div></div>";
    }
    grid.innerHTML = html;
}

// ================================
// VISTA GRID/LIST
// ================================
function initViewToggle() {
    var grid = document.getElementById("productsGrid");
    var btnGrid = document.getElementById("btnViewGrid");
    var btnList = document.getElementById("btnViewList");
    
    if (!grid || !btnGrid || !btnList) return;
    
    if (currentView === "list") {
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

function cambiarVista(vista) {
    currentView = vista;
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
}

// ================================
// DESTACADOS
// ================================
function renderDestacados() {
    var section = document.getElementById("destacadosSection");
    var container = document.getElementById("destacadosContainer");
    
    if (!menuData.destacados || menuData.destacados.length === 0) {
        section.style.display = "none";
        return;
    }
    
    section.style.display = "block";
    
    var html = "";
    for (var i = 0; i < menuData.destacados.length; i++) {
        var p = menuData.destacados[i];
        var hasImage = p.imagen && p.imagen.trim() !== "";
        
        html += "<div class='destacado-card' onclick='abrirModal(\"" + p.id + "\")'>";
        html += "<div class='destacado-badge'>⭐ Popular</div>";
        html += "<div class='destacado-card-img'>";
        if (hasImage) {
            html += "<img src='" + p.imagen + "' alt='" + p.nombre + "' onerror='this.parentElement.innerHTML=\"<div class=no-image>📷</div>\"'>";
        } else {
            html += "<div class='no-image'>📷</div>";
        }
        html += "</div>";
        html += "<div class='destacado-card-info'>";
        html += "<div class='destacado-card-nombre'>" + p.nombre + "</div>";
        html += "<div class='destacado-card-precio'>$" + p.precio.toFixed(2) + "</div>";
        html += "</div>";
        html += "</div>";
    }
    
    container.innerHTML = html;
}

function renderBannerSecundario() {
    var containerExtra = document.getElementById("bannersExtraContainer");
    var container = document.getElementById("bannerSecundario");
    var img = document.getElementById("bannerSecundarioImg");
    
    if (!menuData.bannersSecundario || menuData.bannersSecundario.length === 0) {
        container.style.display = "none";
    } else {
        var banner = menuData.bannersSecundario[Math.floor(Math.random() * menuData.bannersSecundario.length)];
        img.src = banner.url;
        img.onerror = function() { container.style.display = "none"; checkBannersExtra(); };
        container.style.display = "block";
        containerExtra.style.display = "grid";
    }
}

function renderBannerTerciario() {
    var containerExtra = document.getElementById("bannersExtraContainer");
    var container = document.getElementById("bannerTerciario");
    var img = document.getElementById("bannerTerciarioImg");
    
    if (!menuData.bannersTerciario || menuData.bannersTerciario.length === 0) {
        container.style.display = "none";
    } else {
        var banner = menuData.bannersTerciario[Math.floor(Math.random() * menuData.bannersTerciario.length)];
        img.src = banner.url;
        img.onerror = function() { container.style.display = "none"; checkBannersExtra(); };
        container.style.display = "block";
        containerExtra.style.display = "grid";
    }
    
    checkBannersExtra();
}

function checkBannersExtra() {
    var sec = document.getElementById("bannerSecundario");
    var ter = document.getElementById("bannerTerciario");
    var container = document.getElementById("bannersExtraContainer");
    
    if (sec.style.display === "none" && ter.style.display === "none") {
        container.style.display = "none";
    }
}

// ================================
// PROMOCIONES
// ================================
function renderPromociones() {
    var section = document.getElementById("promocionesSection");
    var container = document.getElementById("promocionesContainer");
    
    if (promocionesData.length === 0) {
        section.style.display = "none";
        return;
    }
    
    section.style.display = "block";
    
    var html = "";
    for (var i = 0; i < promocionesData.length; i++) {
        var p = promocionesData[i];
        var hasImage = p.imagen && p.imagen.trim() !== "";
        
        html += "<div class='promo-card' onclick='abrirModalPromo(\"" + p.id + "\")'>";
        html += "<div class='promo-card-badge'>-" + p.descuentoPct + "%</div>";
        html += "<div class='promo-card-imagen'>";
        if (hasImage) {
            html += "<img src='" + p.imagen + "' alt='" + p.nombre + "'>";
        } else {
            html += "<div class='no-image'>🎁</div>";
        }
        html += "</div>";
        html += "<div class='promo-card-body'>";
        html += "<div class='promo-card-nombre'>" + p.nombre + "</div>";
        html += "<div class='promo-card-desc'>" + p.descripcion + "</div>";
        html += "<div class='promo-card-precios'>";
        html += "<span class='promo-card-precio-normal'>$" + p.precioNormal.toFixed(2) + "</span>";
        html += "<span class='promo-card-precio-promo'>$" + p.precioPromo.toFixed(2) + "</span>";
        html += "</div>";
        html += "<div class='promo-card-ahorro'>Ahorras $" + p.ahorro.toFixed(2) + "</div>";
        html += "</div>";
        html += "</div>";
    }
    
    container.innerHTML = html;
}

function abrirModalPromo(promoId) {
    currentPromo = null;
    for (var i = 0; i < promocionesData.length; i++) {
        if (promocionesData[i].id === promoId) {
            currentPromo = promocionesData[i];
            break;
        }
    }
    if (!currentPromo) return;
    
    promoCantidad = 1;
    
    var imgContainer = document.getElementById("promoModalImagen");
    if (currentPromo.imagen) {
        imgContainer.innerHTML = "<img src='" + currentPromo.imagen + "' alt='" + currentPromo.nombre + "'>";
    } else {
        imgContainer.innerHTML = "<div class='no-image'>🎁</div>";
    }
    
    document.getElementById("promoModalBadge").textContent = "-" + currentPromo.descuentoPct + "%";
    document.getElementById("promoModalNombre").textContent = currentPromo.nombre;
    document.getElementById("promoModalDesc").textContent = currentPromo.descripcion;
    document.getElementById("promoModalPrecioNormal").textContent = "$" + currentPromo.precioNormal.toFixed(2);
    document.getElementById("promoModalPrecioPromo").textContent = "$" + currentPromo.precioPromo.toFixed(2);
    document.getElementById("promoModalAhorro").textContent = "¡Ahorras $" + currentPromo.ahorro.toFixed(2) + "!";
    
    var productosHtml = "";
    for (var j = 0; j < currentPromo.productos.length; j++) {
        var prod = currentPromo.productos[j];
        productosHtml += "<div class='promo-producto-item'>";
        productosHtml += "<span class='check'>✓</span>";
        productosHtml += "<span class='cantidad'>" + prod.cantidad + "x</span>";
        productosHtml += "<span>" + prod.nombreProducto + "</span>";
        productosHtml += "</div>";
    }
    document.getElementById("promoProductosLista").innerHTML = productosHtml;
    
    document.getElementById("promoModalCantidad").textContent = promoCantidad;
    document.getElementById("promoModalTotal").textContent = "$" + (currentPromo.precioPromo * promoCantidad).toFixed(2);
    
    document.getElementById("modalPromocion").classList.add("show");
    document.body.style.overflow = "hidden";
}

function cerrarModalPromo() {
    document.getElementById("modalPromocion").classList.remove("show");
    document.body.style.overflow = "";
    currentPromo = null;
}

function cambiarCantidadPromo(delta) {
    promoCantidad = Math.max(1, promoCantidad + delta);
    document.getElementById("promoModalCantidad").textContent = promoCantidad;
    document.getElementById("promoModalTotal").textContent = "$" + (currentPromo.precioPromo * promoCantidad).toFixed(2);
}

function agregarPromoAlCarrito() {
    if (!currentPromo) return;
    
    var item = {
        id: "PROMO_" + currentPromo.id + "_" + Date.now(),
        productoId: "PROMO_" + currentPromo.id,
        nombre: "🎁 " + currentPromo.nombre,
        imagen: currentPromo.imagen,
        precio: currentPromo.precioPromo,
        cantidad: promoCantidad,
        extras: [],
        extrasTotal: 0,
        subtotal: currentPromo.precioPromo * promoCantidad,
        notas: "",
        esPromocion: true,
        productosIncluidos: currentPromo.productos
    };
    
    cart.push(item);
    saveCart();
    updateCartUI();
    cerrarModalPromo();
    mostrarToast("¡Promoción agregada al carrito!");
}
// ================================
// ÚLTIMOS VISTOS
// ================================
function renderUltimosVistos() {
    var section = document.getElementById("ultimosVistosSection");
    var container = document.getElementById("ultimosVistosContainer");
    
    if (ultimosVistos.length === 0) {
        section.style.display = "none";
        return;
    }
    
    section.style.display = "block";
    
    var html = "";
    for (var i = 0; i < ultimosVistos.length; i++) {
        var id = ultimosVistos[i];
        var p = null;
        for (var j = 0; j < menuData.productos.length; j++) {
            if (menuData.productos[j].id === id) {
                p = menuData.productos[j];
                break;
            }
        }
        if (!p) continue;
        
        html += "<div class='ultimo-card' onclick='abrirModal(\"" + p.id + "\")'>";
        html += "<div class='ultimo-card-img'>";
        if (p.imagen) {
            html += "<img src='" + p.imagen + "' alt='" + p.nombre + "'>";
        } else {
            html += "<div class='no-image'>📷</div>";
        }
        html += "</div>";
        html += "<div class='ultimo-card-info'>";
        html += "<div class='ultimo-card-nombre'>" + p.nombre + "</div>";
        html += "<div class='ultimo-card-precio'>$" + p.precio.toFixed(2) + "</div>";
        html += "</div>";
        html += "</div>";
    }
    
    container.innerHTML = html;
}

function agregarUltimoVisto(productoId) {
    var index = ultimosVistos.indexOf(productoId);
    if (index > -1) {
        ultimosVistos.splice(index, 1);
    }
    ultimosVistos.unshift(productoId);
    if (ultimosVistos.length > MAX_ULTIMOS) {
        ultimosVistos = ultimosVistos.slice(0, MAX_ULTIMOS);
    }
    localStorage.setItem("uniline_ultimos", JSON.stringify(ultimosVistos));
    renderUltimosVistos();
}

// ================================
// PRODUCTOS POR CATEGORÍA
// ================================
function renderProductosPorCategoria() {
    var container = document.getElementById("productosPorCategoria");
    var html = "";
    
    for (var i = 0; i < menuData.categorias.length; i++) {
        var cat = menuData.categorias[i];
        var prods = [];
        for (var j = 0; j < menuData.productos.length; j++) {
            if (menuData.productos[j].categoria === cat.id) {
                prods.push(menuData.productos[j]);
            }
        }
        
        if (prods.length === 0) continue;
        
        html += "<div class='categoria-grupo'>";
        html += "<div class='categoria-grupo-header'>";
        html += "<h3>" + cat.icono + " " + cat.nombre + "</h3>";
        html += "<span class='categoria-grupo-count'>" + prods.length + " productos</span>";
        html += "</div>";
        html += "<div class='categoria-grupo-productos'>";
        
        for (var k = 0; k < prods.length; k++) {
            var p = prods[k];
            var hasImage = p.imagen && p.imagen.trim() !== "";
            
            html += "<div class='product-card' onclick='abrirModal(\"" + p.id + "\")'>";
            html += "<div class='product-image'>";
            if (hasImage) {
                html += "<img src='" + p.imagen + "' alt='" + p.nombre + "'>";
            } else {
                html += "<div class='no-image'><span>📷</span></div>";
            }
            html += "</div>";
            html += "<div class='product-info'>";
            html += "<div class='product-name'>" + p.nombre + "</div>";
            html += "<div class='product-desc'>" + (p.descripcion || "") + "</div>";
            html += "<div class='product-footer'>";
            html += "<span class='product-price'>$" + p.precio.toFixed(2) + "</span>";
            html += "<span class='product-time'>" + p.tiempo + "</span>";
            html += "</div>";
            html += "<button class='btn-add-cart' onclick='event.stopPropagation(); abrirModal(\"" + p.id + "\")'>Agregar</button>";
            html += "</div></div>";
        }
        
        html += "</div></div>";
    }
    
    container.innerHTML = html;
}

// ================================
// MODAL PRODUCTO
// ================================
function abrirModal(productoId) {
    currentProduct = null;
    for (var i = 0; i < menuData.productos.length; i++) {
        if (menuData.productos[i].id === productoId) {
            currentProduct = menuData.productos[i];
            break;
        }
    }
    if (!currentProduct) return;
    
    agregarUltimoVisto(productoId);
    
    modalQuantity = 1;
    selectedExtras = [];
    
    var imgContainer = document.getElementById("modalImagen");
    if (currentProduct.imagen) {
        imgContainer.innerHTML = "<img src='" + currentProduct.imagen + "' alt='" + currentProduct.nombre + "' onerror='this.parentElement.innerHTML=\"<div class=no-image>📷</div>\"'>";
    } else {
        imgContainer.innerHTML = "<div class='no-image'>📷</div>";
    }
    
    document.getElementById("modalNombre").textContent = currentProduct.nombre;
    document.getElementById("modalDescripcion").textContent = currentProduct.descripcion || "";
    document.getElementById("modalPrecio").textContent = "$" + currentProduct.precio.toFixed(2);
    document.getElementById("modalTiempo").textContent = currentProduct.tiempo;
    document.getElementById("modalNotas").value = "";
    
    var extrasSection = document.getElementById("extrasSection");
    if (currentProduct.tieneExtras) {
        var disponibles = [];
        for (var i = 0; i < menuData.productoExtras.length; i++) {
            if (menuData.productoExtras[i].productoId === currentProduct.id) {
                var extraId = menuData.productoExtras[i].extraId;
                for (var j = 0; j < menuData.extras.length; j++) {
                    if (menuData.extras[j].id === extraId) {
                        disponibles.push(menuData.extras[j]);
                        break;
                    }
                }
            }
        }
        
        if (disponibles.length > 0) {
            extrasSection.style.display = "block";
            var html = "";
            for (var k = 0; k < disponibles.length; k++) {
                var e = disponibles[k];
                html += "<div class='extra-item' onclick='toggleExtra(\"" + e.id + "\", \"" + e.nombre + "\", " + e.precio + ")'>";
                html += "<div class='extra-check' id='check_" + e.id + "'></div>";
                html += "<span class='extra-name'>" + e.nombre + "</span>";
                html += "<span class='extra-price'>+$" + e.precio.toFixed(2) + "</span>";
                html += "</div>";
            }
            document.getElementById("extrasList").innerHTML = html;
        } else {
            extrasSection.style.display = "none";
        }
    } else {
        extrasSection.style.display = "none";
    }
    
    document.getElementById("modalCantidad").textContent = modalQuantity;
    actualizarTotalModal();
    renderSimilares();
    
    document.getElementById("modalProducto").classList.add("show");
    document.body.style.overflow = "hidden";
}

function cerrarModal() {
    document.getElementById("modalProducto").classList.remove("show");
    document.body.style.overflow = "";
    currentProduct = null;
}

function toggleExtra(id, nombre, precio) {
    var index = -1;
    for (var i = 0; i < selectedExtras.length; i++) {
        if (selectedExtras[i].id === id) {
            index = i;
            break;
        }
    }
    
    if (index >= 0) {
        selectedExtras.splice(index, 1);
        document.getElementById("check_" + id).textContent = "";
        document.querySelector('[onclick*="' + id + '"]').classList.remove("selected");
    } else {
        selectedExtras.push({ id: id, nombre: nombre, precio: precio });
        document.getElementById("check_" + id).textContent = "✓";
        document.querySelector('[onclick*="' + id + '"]').classList.add("selected");
    }
    actualizarTotalModal();
}

function cambiarCantidad(delta) {
    modalQuantity = Math.max(1, modalQuantity + delta);
    document.getElementById("modalCantidad").textContent = modalQuantity;
    actualizarTotalModal();
}

function actualizarTotalModal() {
    var extrasTotal = 0;
    for (var i = 0; i < selectedExtras.length; i++) {
        extrasTotal += selectedExtras[i].precio;
    }
    var total = (currentProduct.precio + extrasTotal) * modalQuantity;
    document.getElementById("modalTotal").textContent = "$" + total.toFixed(2);
}

function renderSimilares() {
    var section = document.getElementById("similaresSection");
    var container = document.getElementById("similaresContainer");
    
    if (!currentProduct) {
        section.style.display = "none";
        return;
    }
    
    var similares = [];
    for (var i = 0; i < menuData.productos.length; i++) {
        var p = menuData.productos[i];
        if (p.categoria === currentProduct.categoria && p.id !== currentProduct.id) {
            similares.push(p);
        }
    }
    
    if (similares.length === 0) {
        section.style.display = "none";
        return;
    }
    
    section.style.display = "block";
    
    var html = "";
    for (var j = 0; j < Math.min(similares.length, 5); j++) {
        var p = similares[j];
        html += "<div class='similar-card' onclick='cerrarModal(); setTimeout(function(){abrirModal(\"" + p.id + "\")}, 300);'>";
        html += "<div class='similar-card-img'>";
        if (p.imagen) {
            html += "<img src='" + p.imagen + "' alt='" + p.nombre + "'>";
        } else {
            html += "<div class='no-image'>📷</div>";
        }
        html += "</div>";
        html += "<div class='similar-card-info'>";
        html += "<div class='similar-card-nombre'>" + p.nombre + "</div>";
        html += "<div class='similar-card-precio'>$" + p.precio.toFixed(2) + "</div>";
        html += "</div>";
        html += "</div>";
    }
    container.innerHTML = html;
}

function agregarAlCarrito() {
    if (!currentProduct) return;
    
    var extrasTotal = 0;
    var extrasIds = [];
    var extrasNombres = [];
    
    for (var i = 0; i < selectedExtras.length; i++) {
        extrasTotal += selectedExtras[i].precio;
        extrasIds.push(selectedExtras[i].id);
        extrasNombres.push(selectedExtras[i].nombre);
    }
    
    var notas = document.getElementById("modalNotas").value.trim();
    
    var item = {
        id: currentProduct.id + "_" + Date.now(),
        productoId: currentProduct.id,
        nombre: currentProduct.nombre,
        imagen: currentProduct.imagen,
        precio: currentProduct.precio,
        cantidad: modalQuantity,
        extras: selectedExtras.slice(),
        extrasIds: extrasIds.join(","),
        extrasTotal: extrasTotal,
        subtotal: (currentProduct.precio + extrasTotal) * modalQuantity,
        notas: notas
    };
    
    cart.push(item);
    saveCart();
    updateCartUI();
    cerrarModal();
    mostrarToast("¡Producto agregado al carrito!");
}

// ================================
// CARRITO
// ================================
function saveCart() {
    localStorage.setItem("uniline_cart", JSON.stringify(cart));
}

function loadCart() {
    var saved = localStorage.getItem("uniline_cart");
    if (saved) {
        cart = JSON.parse(saved);
    }
    updateCartUI();
}

function updateCartUI() {
    var totalItems = 0;
    var subtotal = 0;
    
    for (var i = 0; i < cart.length; i++) {
        totalItems += cart[i].cantidad;
        subtotal += cart[i].subtotal;
    }
    
    document.getElementById("cartBadge").textContent = totalItems;
    document.getElementById("footerCartBadge").textContent = totalItems;
    
    var itemsContainer = document.getElementById("cartItems");
    var footer = document.getElementById("cartFooter");
    
if (cart.length === 0) {
    itemsContainer.innerHTML = "<div class='cart-empty'><span>🛒</span><p>Tu carrito está vacío</p><button class='btn-comenzar' onclick='toggleCart(); setTimeout(function(){mostrarSeccion(\"menu\")}, 300);'>Comenzar a pedir</button></div>";
        footer.style.display = "none";
        document.getElementById("carritoFlotante").style.display = "none";
        return;
    }
    
    footer.style.display = "block";
    document.getElementById("carritoFlotante").style.display = "flex";
    
    var html = "";
    for (var j = 0; j < cart.length; j++) {
        var item = cart[j];
        var hasImage = item.imagen && item.imagen.trim() !== "";
        
        html += "<div class='cart-item'>";
        html += "<div class='cart-item-img'>";
        if (hasImage) {
            html += "<img src='" + item.imagen + "' alt='" + item.nombre + "'>";
        } else {
            html += "<div class='no-img'>📷</div>";
        }
        html += "</div>";
        html += "<div class='cart-item-info'>";
        html += "<div class='cart-item-name'>" + item.nombre + "</div>";
        if (item.extras && item.extras.length > 0) {
            var extrasStr = "";
            for (var k = 0; k < item.extras.length; k++) {
                extrasStr += item.extras[k].nombre + ", ";
            }
            extrasStr = extrasStr.slice(0, -2);
            html += "<div class='cart-item-extras'>+ " + extrasStr + "</div>";
        }
        if (item.notas) {
            html += "<div class='cart-item-notas'>📝 " + item.notas + "</div>";
        }
        html += "<div class='cart-item-price'>$" + item.subtotal.toFixed(2) + "</div>";
        html += "<div class='cart-item-actions'>";
        html += "<button onclick='changeItemQuantity(" + j + ", -1)'>−</button>";
        html += "<span>" + item.cantidad + "</span>";
        html += "<button onclick='changeItemQuantity(" + j + ", 1)'>+</button>";
        html += "<button class='cart-item-remove' onclick='removeItem(" + j + ")'>🗑️</button>";
        html += "</div>";
        html += "</div>";
        html += "</div>";
    }
    
    itemsContainer.innerHTML = html;
    
    document.getElementById("cartSubtotal").textContent = "$" + subtotal.toFixed(2);
    document.getElementById("cartTotal").textContent = "$" + subtotal.toFixed(2);
    
    document.getElementById("flotanteItems").textContent = totalItems + " items";
    document.getElementById("flotanteTotal").textContent = "$" + subtotal.toFixed(2);
}

function changeItemQuantity(index, delta) {
    cart[index].cantidad = Math.max(1, cart[index].cantidad + delta);
    var precioUnitario = cart[index].precio + cart[index].extrasTotal;
    cart[index].subtotal = precioUnitario * cart[index].cantidad;
    saveCart();
    updateCartUI();
}

function removeItem(index) {
    cart.splice(index, 1);
    saveCart();
    updateCartUI();
}

function toggleCart() {
    var overlay = document.getElementById("cartOverlay");
    var sidebar = document.getElementById("cartSidebar");
    
    if (overlay.classList.contains("show")) {
        overlay.classList.remove("show");
        sidebar.classList.remove("show");
    } else {
        overlay.classList.add("show");
        sidebar.classList.add("show");
    }
}

// ================================
// CHECKOUT
// ================================
function abrirCheckout() {
    if (cart.length === 0) return;
    
    if (!sessionData) {
        pendingAction = "checkout";
        toggleCart();
        setTimeout(function() {
            abrirModalAuth();
        }, 300);
        return;
    }
    
    toggleCart();
    
    setTimeout(function() {
        document.getElementById("modalCheckout").classList.add("show");
        document.getElementById("checkoutTelefono").value = sessionData.telefono || "";
        
        selectTipoServicio(tipoServicio);
        cargarDireccionesCheckout();
        renderCheckoutItems();
    }, 300);
}

function cerrarCheckout() {
    document.getElementById("modalCheckout").classList.remove("show");
    cuponAplicado = null;
    document.getElementById("cuponAplicadoInfo").style.display = "none";
    document.getElementById("cuponInputWrapper").style.display = "flex";
    document.getElementById("inputCupon").value = "";
    document.getElementById("checkoutDescuentoRow").style.display = "none";
}

function selectTipoServicio(tipo) {
    tipoServicio = tipo;
    
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
        costoEnvio = 25;
    } else {
        seccionDir.style.display = "none";
        costoEnvio = 0;
        direccionSeleccionada = null;
    }
    
    actualizarTotalesCheckout();
}

async function cargarDireccionesCheckout() {
    if (!sessionData) return;
    
    var container = document.getElementById("direccionesGuardadas");
    container.innerHTML = "<div class='loading-mini'><span>Cargando...</span></div>";
    
    const data = await callAPI('/api/direcciones/' + sessionData.id);
    direccionesCliente = data;
    
    if (direccionesCliente.length === 0) {
        container.innerHTML = "<div class='direcciones-empty'>No tienes direcciones guardadas</div>";
        mostrarFormDireccion();
        return;
    }
    
    var html = "";
    for (var i = 0; i < direccionesCliente.length; i++) {
        var d = direccionesCliente[i];
        var selected = direccionSeleccionada && direccionSeleccionada.id === d.id ? "selected" : "";
        
        html += "<div class='direccion-item " + selected + "' onclick='seleccionarDireccion(" + i + ")'>";
        html += "<div class='direccion-radio'></div>";
        html += "<div class='direccion-texto'>" + d.direccion + "</div>";
        html += "</div>";
    }
    
    container.innerHTML = html;
    
    if (!direccionSeleccionada && direccionesCliente.length > 0) {
        seleccionarDireccion(0);
    }
}

function seleccionarDireccion(index) {
    direccionSeleccionada = direccionesCliente[index];
    coordenadasEntrega = direccionSeleccionada.maps || "";
    
    var items = document.querySelectorAll("#direccionesGuardadas .direccion-item");
    for (var i = 0; i < items.length; i++) {
        items[i].classList.remove("selected");
    }
    items[index].classList.add("selected");
    
    document.getElementById("nuevaDireccionForm").style.display = "none";
    document.getElementById("btnAgregarDir").style.display = "block";
}

function mostrarFormDireccion() {
    document.getElementById("checkoutDireccion").value = "";
    document.getElementById("checkoutCoordenadas").value = "";
    document.getElementById("coordenadasInfo").style.display = "none";
    document.getElementById("ubicacionIcon").textContent = "📍";
    document.getElementById("ubicacionText").textContent = "Usar mi ubicación";
    
    document.getElementById("nuevaDireccionForm").style.display = "block";
    document.getElementById("btnAgregarDir").style.display = "none";
    
    direccionSeleccionada = null;
}

function cancelarNuevaDireccion() {
    document.getElementById("nuevaDireccionForm").style.display = "none";
    document.getElementById("btnAgregarDir").style.display = "block";
}

function obtenerUbicacion() {
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
            coordenadasEntrega = lat + "," + lng;
            document.getElementById("checkoutCoordenadas").value = coordenadasEntrega;
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
}

async function guardarNuevaDireccion() {
    var dir = document.getElementById("checkoutDireccion").value.trim();
    if (!dir) {
        alert("Escribe una dirección");
        return;
    }
    
    var coords = document.getElementById("checkoutCoordenadas").value || "";
    
    const data = await callAPI('/api/direcciones', {
        method: 'POST',
        body: JSON.stringify({
            clienteId: sessionData.id,
            direccion: dir,
            maps: coords
        })
    });
    
    if (data.success) {
        direccionSeleccionada = { id: data.id, direccion: dir, maps: coords };
        coordenadasEntrega = coords;
        cargarDireccionesCheckout();
        mostrarToast("Dirección guardada");
    } else {
        alert("Error al guardar");
    }
}

function renderCheckoutItems() {
    var container = document.getElementById("checkoutItems");
    var html = "";
    
    for (var i = 0; i < cart.length; i++) {
        var item = cart[i];
        html += "<div class='checkout-item'>";
        html += "<span class='checkout-item-name'>" + item.nombre + "</span>";
        html += "<span class='checkout-item-qty'>x" + item.cantidad + " = $" + item.subtotal.toFixed(2) + "</span>";
        html += "</div>";
    }
    
    container.innerHTML = html;
    actualizarTotalesCheckout();
}

function actualizarTotalesCheckout() {
    var subtotal = 0;
    for (var i = 0; i < cart.length; i++) {
        subtotal += cart[i].subtotal;
    }
    
    var descuento = 0;
    if (cuponAplicado) {
        descuento = Math.round(subtotal * (cuponAplicado.descuento / 100));
    }
    
    var total = subtotal + costoEnvio - descuento;
    
    document.getElementById("checkoutSubtotal").textContent = "$" + subtotal.toFixed(2);
    
    var envioRow = document.getElementById("checkoutEnvioRow");
    if (tipoServicio === "Domicilio") {
        envioRow.style.display = "flex";
        document.getElementById("checkoutEnvio").textContent = "$" + costoEnvio.toFixed(2);
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
    if (!sessionData) return;
    
    const data = await callAPI('/api/cupones/automatico?clienteId=' + sessionData.id);
    
    if (!data || !data.id) return;
    
    cuponAutomaticoData = data;
    
    var imgContainer = document.getElementById("cuponImagen");
    if (data.imagen) {
        imgContainer.innerHTML = "<img src='" + data.imagen + "' alt=''>";
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

function cerrarModalCupon() {
    document.getElementById("modalCupon").classList.remove("show");
    cuponAutomaticoData = null;
}

function aplicarCuponAutomatico() {
    if (!cuponAutomaticoData) return;
    
    cuponAplicado = {
        id: cuponAutomaticoData.id,
        nombre: cuponAutomaticoData.nombre,
        descuento: cuponAutomaticoData.descuento,
        codigo: cuponAutomaticoData.codigo
    };
    
    cerrarModalCupon();
    mostrarToast("¡Cupón aplicado!");
}

async function validarCuponManual() {
    var codigo = document.getElementById("inputCupon").value.trim().toUpperCase();
    if (!codigo) {
        document.getElementById("cuponError").textContent = "Ingresa un código";
        document.getElementById("cuponError").style.display = "block";
        return;
    }
    
    if (!sessionData) {
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
            clienteId: sessionData.id
        })
    });
    
    btn.disabled = false;
    btn.textContent = "Aplicar";
    
    if (data.success && data.cupon) {
        cuponAplicado = data.cupon;
        
        document.getElementById("checkoutCuponNombre").textContent = cuponAplicado.codigo;
        document.getElementById("checkoutCuponDescuento").textContent = "-" + cuponAplicado.descuento + "%";
        document.getElementById("cuponAplicadoInfo").style.display = "flex";
        document.getElementById("cuponInputWrapper").style.display = "none";
        document.getElementById("cuponError").style.display = "none";
        
        actualizarTotalesCheckout();
        mostrarToast("¡Cupón aplicado!");
    } else {
        document.getElementById("cuponError").textContent = data.mensaje || "Cupón no válido";
        document.getElementById("cuponError").style.display = "block";
    }
}

function quitarCupon() {
    cuponAplicado = null;
    document.getElementById("cuponAplicadoInfo").style.display = "none";
    document.getElementById("cuponInputWrapper").style.display = "flex";
    document.getElementById("inputCupon").value = "";
    actualizarTotalesCheckout();
}

// ================================
// CONFIRMAR PEDIDO
// ================================
async function confirmarPedido() {
    if (cart.length === 0) return;
    
    var telefono = document.getElementById("checkoutTelefono").value.trim();
    if (!telefono) {
        alert("Ingresa tu teléfono");
        return;
    }
    
    if (tipoServicio === "Domicilio") {
        if (!direccionSeleccionada) {
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
    for (var i = 0; i < cart.length; i++) {
        var item = cart[i];
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
    
    var datosPedido = {
        clienteId: sessionData.id,
        nombreCliente: sessionData.nombre,
        telefono: telefono,
        direccion: direccionSeleccionada ? direccionSeleccionada.direccion : document.getElementById("checkoutDireccion").value.trim(),
        tipoServicio: tipoServicio,
        costoEnvio: costoEnvio,
        coordenadas: coordenadasEntrega,
        observaciones: document.getElementById("checkoutObservaciones").value.trim(),
        productos: productos,
        cupon: cuponAplicado
    };
    
    const data = await callAPI('/api/pedidos', {
        method: 'POST',
        body: JSON.stringify(datosPedido)
    });
    
    btn.disabled = false;
    btn.textContent = "✓ Confirmar Pedido";
    
    if (data.success && data.folio) {
        cart = [];
        saveCart();
        updateCartUI();
        cerrarCheckout();
        
        document.getElementById("exitoFolio").textContent = data.folio;
        document.getElementById("modalExito").classList.add("show");
        
        cuponAplicado = null;
    } else {
        alert(data.mensaje || "Error al confirmar");
    }
}

function cerrarExito() {
    document.getElementById("modalExito").classList.remove("show");
    navegar("pedidos");
}

// ================================
// PEDIDOS
// ================================
async function cargarPedidos() {
    if (!sessionData) {
        document.getElementById("pedidosList").innerHTML = "<div class='empty-state'><div class='empty-icon'>📦</div><h3>Inicia sesión</h3><p>Debes iniciar sesión para ver tus pedidos</p><button class='btn-comenzar' onclick='abrirModalAuth()'>Iniciar Sesión</button></div>";
        return;
    }
    
    document.getElementById("pedidosList").innerHTML = "<div class='loading'><div class='spinner'></div><p>Cargando...</p></div>";
    
    const data = await callAPI('/api/pedidos/' + sessionData.id);
    pedidosCache = {};
    
    if (!data || data.length === 0) {
        document.getElementById("pedidosList").innerHTML = "<div class='empty-state'><div class='empty-icon'>📦</div><h3>No hay pedidos</h3><p>Aún no has realizado ningún pedido</p><button class='btn-comenzar' onclick='navegar(\"menu\")'>Comenzar a Pedir</button></div>";
        return;
    }
    
    var html = "";
    for (var i = 0; i < data.length; i++) {
        var p = data[i];
        pedidosCache[p.folio] = p;
        html += renderPedidoCard(p);
    }
    
    document.getElementById("pedidosList").innerHTML = html;
    
    if (pedidosInterval) clearInterval(pedidosInterval);
    pedidosInterval = setInterval(actualizarPedidosEnTiempoReal, 15000);
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
    html += "<div><div class='pedido-folio'>" + pedido.folio + "</div><div class='pedido-fecha'>" + fechaStr + " • " + (pedido.hora || "") + "</div></div>";
    html += "<div class='pedido-tipo-badge " + tipoBadgeClass + "'>" + (pedido.tipoServicio === "Domicilio" ? "🏠 Domicilio" : "🏪 Recoger") + "</div>";
    html += "</div>";
    
    if (pedido.tipoServicio === "Domicilio" && pedido.estadoDelivery) {
        html += renderDeliveryTrack(pedido.estadoDelivery);
    }
    
    html += "<div class='pedido-items'>";
    for (var j = 0; j < pedido.productos.length; j++) {
        var prod = pedido.productos[j];
        html += "<div class='pedido-item'>" + prod.cantidad + "x " + prod.nombre;
        if (prod.extras) {
            html += " <span class='pedido-extras'>+ " + prod.extras + "</span>";
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
    
    var currentIndex = 0;
    for (var i = 0; i < steps.length; i++) {
        if (steps[i].id === estado) {
            currentIndex = i;
            break;
        }
    }
    
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
    if (!sessionData || document.getElementById("seccionPedidos").style.display === "none") return;
    
    const data = await callAPI('/api/pedidos/' + sessionData.id);
    
    if (!data || data.length === 0) return;
    
    for (var i = 0; i < data.length; i++) {
        var pedido = data[i];
        var anterior = pedidosCache[pedido.folio];
        
        if (anterior && anterior.estadoDelivery !== pedido.estadoDelivery) {
            mostrarToast("📦 Actualización: " + pedido.folio + " - " + pedido.estadoDelivery);
        }
        
        pedidosCache[pedido.folio] = pedido;
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
function abrirModalAuth() {
    document.getElementById("modalAuth").classList.add("show");
    document.body.style.overflow = "hidden";
    mostrarTabAuth("login");
}

function cerrarModalAuth() {
    document.getElementById("modalAuth").classList.remove("show");
    document.body.style.overflow = "";
}

function mostrarTabAuth(tab) {
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
}

function togglePassword(inputId, iconId) {
    var input = document.getElementById(inputId);
    var icon = document.getElementById(iconId);
    
    if (input.type === "password") {
        input.type = "text";
        icon.textContent = "🙈";
    } else {
        input.type = "password";
        icon.textContent = "👁️";
    }
}

async function handleLogin(e) {
    e.preventDefault();
    
    var correo = document.getElementById("loginCorreo").value.trim();
    var contrasena = document.getElementById("loginContrasena").value;
    
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
        sessionData = data.cliente;
        localStorage.setItem("uniline_session", data.sessionId);
        localStorage.setItem("uniline_cliente", JSON.stringify(data.cliente));
        
        actualizarUIUsuario();
        cerrarModalAuth();
        mostrarToast("¡Bienvenido " + sessionData.nombre + "!");
        
        if (pendingAction === "checkout") {
            pendingAction = null;
            setTimeout(function() {
                abrirCheckout();
            }, 500);
        }
    } else {
        var alert = document.getElementById("alertLogin");
        alert.className = "alert alert-error";
        alert.textContent = data.mensaje || "Error al iniciar sesión";
        alert.style.display = "block";
    }
    
    return false;
}

async function handleRegistro(e) {
    e.preventDefault();
    
    var nombre = document.getElementById("regNombre").value.trim();
    var telefono = document.getElementById("regTelefono").value.trim();
    var correo = document.getElementById("regCorreo").value.trim();
    var contrasena = document.getElementById("regContrasena").value;
    var contrasena2 = document.getElementById("regContrasena2").value;
    
    document.getElementById("alertRegistro").style.display = "none";
    
    if (contrasena !== contrasena2) {
        var alert = document.getElementById("alertRegistro");
        alert.className = "alert alert-error";
        alert.textContent = "Las contraseñas no coinciden";
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
    // Validar datos antes de guardar
    if (!data.cliente.id || !data.cliente.nombre || !data.cliente.correo) {
        var alert = document.getElementById("alertRegistro");
        alert.className = "alert alert-error";
        alert.textContent = "Error: Datos de registro inválidos";
        alert.style.display = "block";
        return false;
    }
    
    sessionData = data.cliente;
    localStorage.setItem("uniline_session", data.sessionId);
    localStorage.setItem("uniline_cliente", JSON.stringify(data.cliente));
        actualizarUIUsuario();
        cerrarModalAuth();
        mostrarToast("¡Cuenta creada! Bienvenido " + sessionData.nombre);
        
        if (pendingAction === "checkout") {
            pendingAction = null;
            setTimeout(function() {
                abrirCheckout();
            }, 500);
        }
    } else {
        var alert = document.getElementById("alertRegistro");
        alert.className = "alert alert-error";
        alert.textContent = data.mensaje || "Error al registrar";
        alert.style.display = "block";
    }
    
    return false;
}

function logout() {
    if (confirm("¿Cerrar sesión?")) {
        sessionData = null;
        localStorage.removeItem("uniline_session");
        localStorage.removeItem("uniline_cliente");
        actualizarUIUsuario();
        
        // Cerrar menú
        var menu = document.getElementById("userMenu");
        if (menu) {
            menu.classList.remove("show");
        }
        
        mostrarToast("Sesión cerrada");
        mostrarSeccion("menu");
    }
}

// ================================
// CUENTA Y DIRECCIONES
// ================================
function toggleUserMenu() {
    var menu = document.getElementById("userMenu");
    menu.classList.toggle("show");
}

function navegar(seccion) {
    if (seccion === "cuenta") {
        if (!sessionData) {
            abrirModalAuth();
            return;
        }
        abrirModalCuenta();
        return;
    }
    
    mostrarSeccion(seccion);
    
    // Solo actualizar active si viene del footer
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
}

function mostrarSeccion(seccion) {
    document.getElementById("seccionMenu").style.display = "none";
    document.getElementById("seccionPedidos").style.display = "none";
    
    if (seccion === "menu") {
        document.getElementById("seccionMenu").style.display = "block";
    } else if (seccion === "pedidos") {
        document.getElementById("seccionPedidos").style.display = "block";
        cargarPedidos();
    }
    
    window.scrollTo(0, 0);
}

function abrirModalCuenta() {
    if (!sessionData) return;
    
    document.getElementById("cuentaAvatar").textContent = sessionData.nombre.charAt(0).toUpperCase();
    document.getElementById("cuentaNombre").textContent = sessionData.nombre;
    document.getElementById("cuentaCorreo").textContent = sessionData.correo;
    document.getElementById("cuentaPuntos").textContent = sessionData.puntos || 0;
    
    document.getElementById("modalCuenta").classList.add("show");
    document.body.style.overflow = "hidden";
}

function cerrarCuenta() {
    document.getElementById("modalCuenta").classList.remove("show");
    document.body.style.overflow = "";
}

function editarPerfil() {
    cerrarCuenta();
    
    // Pre-llenar datos
    document.getElementById("editNombre").value = sessionData.nombre;
    document.getElementById("editTelefono").value = sessionData.telefono;
    document.getElementById("editCorreo").value = sessionData.correo;
    document.getElementById("editContrasena").value = "";
    document.getElementById("editContrasena2").value = "";
    
    // Limpiar alertas
    document.getElementById("alertEditarPerfil").style.display = "none";
    
    // Abrir modal
    document.getElementById("modalEditarPerfil").classList.add("show");
    document.body.style.overflow = "hidden";
}

function cerrarEditarPerfil() {
    document.getElementById("modalEditarPerfil").classList.remove("show");
    document.body.style.overflow = "";
}

async function handleEditarPerfil(e) {
    e.preventDefault();
    
    var nombre = document.getElementById("editNombre").value.trim();
    var telefono = document.getElementById("editTelefono").value.trim();
    var contrasena = document.getElementById("editContrasena").value;
    var contrasena2 = document.getElementById("editContrasena2").value;
    
    document.getElementById("alertEditarPerfil").style.display = "none";
    
    // Validar contraseñas solo si se ingresó algo
    if (contrasena || contrasena2) {
        if (contrasena !== contrasena2) {
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
    
   // Preparar datos - solo incluir contraseña si se ingresó
var datosActualizar = {
    nombre: nombre,
    telefono: telefono
};

// Solo agregar contraseña si se escribió algo
if (contrasena && contrasena.trim() !== "") {
    datosActualizar.contrasena = contrasena.trim();
}

const data = await callAPI('/api/auth/perfil/' + sessionData.id, {
    method: 'PUT',
    body: JSON.stringify(datosActualizar)
});
    
    btn.classList.remove("loading");
    btn.disabled = false;
    
    if (data.success && data.cliente) {
        sessionData = data.cliente;
        localStorage.setItem("uniline_cliente", JSON.stringify(data.cliente));
        
        actualizarUIUsuario();
        cerrarEditarPerfil();
        mostrarToast("✅ Perfil actualizado correctamente");
    } else {
        var alert = document.getElementById("alertEditarPerfil");
        alert.className = "alert alert-error";
        alert.textContent = data.mensaje || "Error al actualizar";
        alert.style.display = "block";
    }
    
    return false;
}
async function verDirecciones() {
    if (!sessionData) return;
    
    cerrarCuenta();
    
    document.getElementById("modalDirecciones").classList.add("show");
    document.body.style.overflow = "hidden";
    
    await cargarDirecciones();
}

function cerrarModalDirecciones() {
    document.getElementById("modalDirecciones").classList.remove("show");
    document.body.style.overflow = "";
    cancelarFormDireccion();
}

async function cargarDirecciones() {
    var lista = document.getElementById("direccionesLista");
    lista.innerHTML = "<div class='loading-mini'><span>Cargando...</span></div>";
    
    const data = await callAPI('/api/direcciones/' + sessionData.id);
    
    if (!data || data.length === 0) {
        lista.innerHTML = "<div class='direcciones-vacio'><div class='direcciones-vacio-icon'>📍</div><p>No tienes direcciones guardadas</p></div>";
        mostrarFormNuevaDireccion();
        return;
    }
    
    var html = "";
    for (var i = 0; i < data.length; i++) {
        var d = data[i];
        html += "<div class='direccion-card'>";
        html += "<div class='direccion-card-content'>";
        html += "<div class='direccion-card-icon'>📍</div>";
        html += "<div class='direccion-card-info'>";
        html += "<div class='direccion-card-text'>" + d.direccion + "</div>";
        if (d.maps) {
            html += "<div class='direccion-card-gps'>✓ Con ubicación GPS</div>";
        }
        html += "</div>";
        html += "</div>";
        html += "<div class='direccion-card-actions'>";
        html += "<button class='btn-dir-action btn-dir-editar' onclick='editarDireccion(" + d.id + ", \"" + d.direccion.replace(/"/g, "&quot;") + "\", \"" + (d.maps || "") + "\")'>✏️ Editar</button>";
        if (d.maps) {
            html += "<button class='btn-dir-action btn-dir-maps' onclick='window.open(\"https://www.google.com/maps?q=" + d.maps + "\", \"_blank\")'>🗺️ Ver</button>";
        }
        html += "<button class='btn-dir-action btn-dir-eliminar' onclick='eliminarDireccion(" + d.id + ")'>🗑️</button>";
        html += "</div>";
        html += "</div>";
    }
    
    lista.innerHTML = html;
}

function mostrarFormNuevaDireccion() {
    document.getElementById("direccionEditId").value = "";
    document.getElementById("direccionFormTitulo").textContent = "Nueva Dirección";
    document.getElementById("direccionInput").value = "";
    document.getElementById("direccionMaps").value = "";
    document.getElementById("coordsDirInfo").style.display = "none";
    document.getElementById("ubicacionDirIcon").textContent = "📍";
    document.getElementById("ubicacionDirText").textContent = "Agregar ubicación GPS";
    
    document.getElementById("direccionForm").style.display = "block";
    document.getElementById("modalDirFooter").style.display = "none";
}

function editarDireccion(id, direccion, maps) {
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
}

function cancelarFormDireccion() {
    document.getElementById("direccionForm").style.display = "none";
    document.getElementById("modalDirFooter").style.display = "block";
}

function obtenerUbicacionDireccion() {
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
}

async function guardarDireccion() {
    var dir = document.getElementById("direccionInput").value.trim();
    if (!dir) {
        alert("Escribe una dirección");
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
                clienteId: sessionData.id,
                direccion: dir,
                maps: maps
            })
        });
    }
    
    btn.disabled = false;
    btn.textContent = "Guardar";
    
    if (data.success) {
        cancelarFormDireccion();
        cargarDirecciones();
        mostrarToast(editId ? "Dirección actualizada" : "Dirección guardada");
    } else {
        alert("Error al guardar");
    }
}

async function eliminarDireccion(id) {
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
}

// ================================
// UTILIDADES
// ================================
function mostrarToast(mensaje) {
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
            document.body.removeChild(toast);
        }, 300);
    }, 3000);
}

// Click outside close
document.addEventListener("click", function(e) {
    var userMenu = document.getElementById("userMenu");
    var userBtn = document.querySelector(".user-btn");
    
    if (userMenu && userBtn && !userMenu.contains(e.target) && !userBtn.contains(e.target)) {
        userMenu.classList.remove("show");
    }
});
