// Cliente HTTP minimo. Adjunta el token guardado y centraliza errores.
const API = {
  token() { return localStorage.getItem('acb_token'); },

  async req(metodo, ruta, cuerpo, esArchivo = false) {
    const headers = {};
    const t = this.token();
    if (t) headers['Authorization'] = 'Bearer ' + t;
    let body;
    if (esArchivo) {
      body = cuerpo; // FormData
    } else if (cuerpo !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(cuerpo);
    }
    const res = await fetch(window.API_BASE + ruta, { method: metodo, headers, body });
    let data = null;
    try { data = await res.json(); } catch { data = null; }
    if (!res.ok) {
      throw new Error((data && data.error) || 'Error ' + res.status);
    }
    return data;
  },

  get(r) { return this.req('GET', r); },
  post(r, b) { return this.req('POST', r, b); },
  put(r, b) { return this.req('PUT', r, b); },
  del(r) { return this.req('DELETE', r); },
  upload(r, formData) { return this.req('POST', r, formData, true); },
};
