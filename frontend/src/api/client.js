// Cliente HTTP minimo, equivalente al frontend-legacy/js/api.js: adjunta el
// token guardado y centraliza errores.
export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api';

function token() {
  return localStorage.getItem('acb_token');
}

async function req(metodo, ruta, cuerpo, esArchivo = false) {
  const headers = {};
  const t = token();
  if (t) headers['Authorization'] = 'Bearer ' + t;
  let body;
  if (esArchivo) {
    body = cuerpo; // FormData
  } else if (cuerpo !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(cuerpo);
  }
  const res = await fetch(API_BASE + ruta, { method: metodo, headers, body });
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok) {
    throw new Error((data && data.error) || 'Error ' + res.status);
  }
  return data;
}

export const API = {
  token,
  get: (r) => req('GET', r),
  post: (r, b) => req('POST', r, b),
  put: (r, b) => req('PUT', r, b),
  del: (r) => req('DELETE', r),
  upload: (r, formData) => req('POST', r, formData, true),
};

// Descarga un archivo binario (ej. el reporte PDF), que no se puede pedir
// a traves de API.get porque esta espera una respuesta JSON.
export async function descargarArchivo(ruta, nombreArchivo) {
  const res = await fetch(API_BASE + ruta, {
    headers: { Authorization: 'Bearer ' + token() },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error((data && data.error) || 'No se pudo descargar el archivo');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
