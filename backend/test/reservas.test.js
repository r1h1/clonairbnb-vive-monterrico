// Prueba de concurrencia: dos clientes reservan las mismas fechas al mismo
// tiempo. Solo una reserva puede quedar creada.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/db.js';
import { levantarServidor, http, crearUsuario, crearChalet, limpiar, fechaFutura } from './helpers.js';

let servidor, dueno, clientes, chaletId;

before(async () => {
  servidor = await levantarServidor();
  dueno = await crearUsuario('dueno', 'dueno');
  clientes = await Promise.all(Array.from({ length: 5 }, (_, i) => crearUsuario('cliente', `cli${i}`)));
  chaletId = await crearChalet(dueno.id);
});

after(async () => {
  await limpiar();
  servidor?.kill();
  await pool.end();
});

test('dos clientes reservando la misma fecha exacta al mismo tiempo: solo uno gana', async () => {
  const body = { chalet_id: chaletId, fecha_entrada: fechaFutura(30), fecha_salida: fechaFutura(32), huespedes: 2 };
  const [a, b] = await Promise.all(clientes.slice(0, 2).map((c) => http('POST', '/reservas', { token: c.token, body })));
  const estados = [a.status, b.status].sort();
  assert.deepEqual(estados, [201, 409], `se esperaba un 201 y un 409, llegaron ${estados}`);
  const { rows } = await pool.query(`SELECT count(*)::int AS n FROM reservas WHERE chalet_id = $1`, [chaletId]);
  assert.equal(rows[0].n, 1, 'debe existir una sola reserva para esas fechas');
});

test('cinco clientes simultaneos con fechas que se traslapan: solo uno gana', async () => {
  const body = { chalet_id: chaletId, fecha_entrada: fechaFutura(60), fecha_salida: fechaFutura(63), huespedes: 2 };
  const resp = await Promise.all(clientes.map((c) => http('POST', '/reservas', { token: c.token, body })));
  assert.equal(resp.filter((r) => r.status === 201).length, 1);
  assert.equal(resp.filter((r) => r.status === 409).length, 4);
});

test('fechas que solo se tocan (salida = entrada) no son conflicto', async () => {
  const mk = (e, s) => ({ chalet_id: chaletId, fecha_entrada: fechaFutura(e), fecha_salida: fechaFutura(s), huespedes: 2 });
  const r1 = await http('POST', '/reservas', { token: clientes[0].token, body: mk(90, 92) });
  const r2 = await http('POST', '/reservas', { token: clientes[1].token, body: mk(92, 94) });
  assert.equal(r1.status, 201);
  assert.equal(r2.status, 201);
});

test('una reserva cancelada libera las fechas', async () => {
  const body = { chalet_id: chaletId, fecha_entrada: fechaFutura(120), fecha_salida: fechaFutura(122), huespedes: 2 };
  const r1 = await http('POST', '/reservas', { token: clientes[0].token, body });
  assert.equal(r1.status, 201);
  await http('PUT', `/reservas/${r1.data.id}/cancelar`, { token: clientes[0].token });
  const r2 = await http('POST', '/reservas', { token: clientes[1].token, body });
  assert.equal(r2.status, 201);
});
