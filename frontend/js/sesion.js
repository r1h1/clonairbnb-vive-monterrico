// Manejo de sesion en el navegador y utilidades de UI compartidas.
const Sesion = {
  guardar(usuario, token) {
    localStorage.setItem('acb_token', token);
    localStorage.setItem('acb_usuario', JSON.stringify(usuario));
  },
  usuario() {
    try { return JSON.parse(localStorage.getItem('acb_usuario')); } catch { return null; }
  },
  cerrar() {
    localStorage.removeItem('acb_token');
    localStorage.removeItem('acb_usuario');
    location.href = 'index.html';
  },
  // Redirige al login si no hay sesion o el rol no coincide.
  exigir(...roles) {
    const u = this.usuario();
    if (!u) { location.href = 'login.html'; return null; }
    if (roles.length && !roles.includes(u.rol)) { location.href = 'index.html'; return null; }
    return u;
  },
};

// Barra de navegacion comun. Muestra opciones segun el rol.
function pintarNav(activo) {
  const u = Sesion.usuario();
  let derecha = '';
  if (!u) {
    derecha = `<a class="btn btn-outline-acb btn-sm me-2" href="login.html">Iniciar sesion</a>
               <a class="btn btn-acb btn-sm" href="registro.html">Crear cuenta</a>`;
  } else {
    const panel = u.rol === 'cliente' ? 'cliente.html' : u.rol === 'dueno' ? 'dueno.html' : 'admin.html';
    const etiqueta = u.rol === 'cliente' ? 'Mis reservas' : u.rol === 'dueno' ? 'Mi panel' : 'Administracion';
    derecha = `<a class="btn btn-outline-acb btn-sm me-2" href="${panel}">${etiqueta}</a>
               <span class="me-3 small text-muted">${u.nombre} (${u.rol})</span>
               <button class="btn btn-acb btn-sm" onclick="Sesion.cerrar()">Salir</button>`;
  }
  const html = `
  <nav class="navbar navbar-expand-lg bg-white shadow-sm mb-4">
    <div class="container">
      <a class="navbar-brand" href="index.html">Vive<span>Monterrico</span></a>
      <div class="ms-auto d-flex align-items-center flex-wrap">${derecha}</div>
    </div>
  </nav>`;
  document.getElementById('nav').innerHTML = html;
}

// Formatea Quetzales.
function q(n) { return 'Q' + Number(n).toLocaleString('es-GT', { minimumFractionDigits: 0 }); }

// Muestra un mensaje temporal en un contenedor.
function aviso(id, texto, tipo = 'danger') {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = `<div class="alert alert-${tipo} py-2">${texto}</div>`;
  if (tipo === 'success') setTimeout(() => { el.innerHTML = ''; }, 3500);
}

const badgeEstado = (e) => `<span class="badge badge-estado estado-${e}">${e}</span>`;

// Devuelve el <img> si hay foto, o una caja "Sin foto" (sin depender de
// imagenes externas) mientras el propietario no haya subido ninguna.
function cajaFoto(url, alto = 190, ancho = '100%', redondeo = 0) {
  if (url) {
    return `<img src="${url}" style="height:${alto}px;width:${ancho};object-fit:cover;border-radius:${redondeo}px">`;
  }
  return `
    <div class="foto-placeholder" style="height:${alto}px;width:${ancho};border-radius:${redondeo}px">
      <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="5" width="18" height="14" rx="2"></rect>
        <circle cx="9" cy="10" r="1.6"></circle>
        <path d="M21 15l-5-4-4 3-3-2-6 5"></path>
      </svg>
      <span>Sin foto todavia</span>
    </div>`;
}