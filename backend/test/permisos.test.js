// Matriz de autorizacion por rol. Cada fila es un intento de acceso que DEBE
// ser rechazado (401 sin sesion, 403 con un rol o dueno equivocado).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/db.js';
import { levantarServidor, BASE, http, crearUsuario, crearChalet, limpiar, fechaFutura } from './helpers.js';

let servidor, admin, dueno, otroDueno, cliente, otroCliente, chaletId, reservaId;

before(async () => {
  servidor = await levantarServidor();
  [admin, dueno, otroDueno, cliente, otroCliente] = await Promise.all([
    crearUsuario('admin', 'admin'), crearUsuario('dueno', 'dueno'), crearUsuario('dueno', 'dueno2'),
    crearUsuario('cliente', 'cliente'), crearUsuario('cliente', 'cliente2'),
  ]);
  chaletId = await crearChalet(dueno.id);
  const r = await http('POST', '/reservas', {
    token: cliente.token,
    body: { chalet_id: chaletId, fecha_entrada: fechaFutura(10), fecha_salida: fechaFutura(12), huespedes: 2 },
  });
  reservaId = r.data.id;
});

after(async () => {
  await limpiar();
  servidor?.kill();
  await pool.end();
});

const t = (u) => u.token;

test('sin sesion: toda ruta protegida responde 401', async () => {
  for (const [m, ruta] of [
    ['GET', '/reservas/mias'], ['GET', '/reservas/dueno'], ['GET', '/dueno/dashboard'],
    ['GET', '/admin/usuarios'], ['GET', '/empleados'], ['POST', '/reservas'],
  ]) {
    assert.equal((await http(m, ruta)).status, 401, `${m} ${ruta}`);
  }
});

test('CLIENTE no puede entrar a rutas de dueno ni de admin (403)', async () => {
  for (const [m, ruta] of [
    ['GET', '/reservas/dueno'], ['GET', '/dueno/dashboard'], ['GET', '/dueno/calendario?desde=2026-01-01&hasta=2026-12-31'],
    ['GET', '/dueno/analitica/metricas'], ['GET', '/dueno/reporte.pdf?desde=2026-01-01&hasta=2026-12-31'],
    ['GET', '/empleados'], ['GET', '/admin/usuarios'], ['GET', '/admin/chalets'], ['GET', '/admin/reservas'],
    ['PUT', `/reservas/${reservaId}/aceptar`], ['PUT', `/reservas/${reservaId}/declinar`],
  ]) {
    assert.equal((await http(m, ruta, { token: t(cliente) })).status, 403, `${m} ${ruta}`);
  }
});

test('DUENO no puede entrar a rutas de admin ni de cliente (403)', async () => {
  for (const [m, ruta] of [
    ['GET', '/admin/usuarios'], ['GET', '/admin/chalets'], ['GET', '/admin/reservas'],
    ['DELETE', `/admin/usuarios/${cliente.id}`], ['GET', '/reservas/mias'],
  ]) {
    assert.equal((await http(m, ruta, { token: t(dueno) })).status, 403, `${m} ${ruta}`);
  }
});

test('un dueno no puede gestionar el chalet ni las reservas de otro dueno (403)', async () => {
  assert.equal((await http('PUT', `/reservas/${reservaId}/aceptar`, { token: t(otroDueno) })).status, 403);
  assert.equal((await http('PUT', `/reservas/${reservaId}/declinar`, { token: t(otroDueno), body: { motivo: 'x' } })).status, 403);
  assert.equal((await http('PUT', `/chalets/${chaletId}`, { token: t(otroDueno), body: { nombre: 'Hackeado' } })).status, 403);
  assert.equal((await http('DELETE', `/chalets/${chaletId}`, { token: t(otroDueno) })).status, 403);
  const lista = await http('GET', '/reservas/dueno', { token: t(otroDueno) });
  assert.equal(lista.data.length, 0, 'el otro dueno no debe ver reservas ajenas');
});

test('un cliente no puede ver ni modificar reservas de otro cliente', async () => {
  assert.equal((await http('GET', `/reservas/${reservaId}`, { token: t(otroCliente) })).status, 403);
  assert.equal((await http('PUT', `/reservas/${reservaId}/cancelar`, { token: t(otroCliente) })).status, 403);
  const fd = new FormData();
  fd.append('comprobante', new Blob([Buffer.from('iVBORw0KGgo=', 'base64')], { type: 'image/png' }), 'c.png');
  const res = await fetch(`${BASE}/reservas/${reservaId}/comprobante`, {
    method: 'POST', headers: { Authorization: `Bearer ${t(otroCliente)}` }, body: fd,
  });
  assert.equal(res.status, 403);
});

test('la direccion del chalet no se revela hasta que la reserva es aceptada', async () => {
  await pool.query(`UPDATE chalets SET direccion_completa = 'Calle secreta 123' WHERE id = $1`, [chaletId]);
  const antes = await http('GET', `/chalets/${chaletId}`, { token: t(cliente) });
  assert.equal(antes.data.direccion_completa, undefined);
  assert.equal((await http('GET', `/chalets/${chaletId}`)).data.direccion_completa, undefined);
  await http('PUT', `/reservas/${reservaId}/aceptar`, { token: t(dueno) });
  const despues = await http('GET', `/chalets/${chaletId}`, { token: t(cliente) });
  assert.equal(despues.data.direccion_completa, 'Calle secreta 123');
  assert.equal((await http('GET', `/chalets/${chaletId}`, { token: t(otroCliente) })).data.direccion_completa, undefined);
});

test('nadie puede registrarse como admin desde el registro publico', async () => {
  const r = await http('POST', '/auth/registro', {
    body: { nombre: 'X', email: `test-x-${Date.now()}@prueba.local`, password: 'abcdef', telefono: '1', rol: 'admin' },
  });
  assert.equal(r.status, 400);
});

test('un token alterado o falso se rechaza (401)', async () => {
  assert.equal((await http('GET', '/reservas/mias', { token: t(cliente).slice(0, -3) + 'xyz' })).status, 401);
  assert.equal((await http('GET', '/admin/usuarios', { token: 'inventado' })).status, 401);
});

test('ADMIN si accede a las rutas de administracion', async () => {
  assert.equal((await http('GET', '/admin/usuarios', { token: t(admin) })).status, 200);
  assert.equal((await http('GET', '/admin/reservas', { token: t(admin) })).status, 200);
});
