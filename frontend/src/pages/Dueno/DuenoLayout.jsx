import { NavLink, Outlet } from 'react-router-dom';

const TABS = [
  { to: '/dueno', end: true, label: 'Resumen' },
  { to: '/dueno/chalets', label: 'Mis chalets' },
  { to: '/dueno/reservas', label: 'Reservas' },
  { to: '/dueno/empleados', label: 'Empleados' },
  { to: '/dueno/calendario', label: 'Calendario' },
  { to: '/dueno/analitica', label: 'Analitica' },
];

export default function DuenoLayout() {
  return (
    <div className="container">
      <h4 className="mb-3">Panel del propietario</h4>

      <ul className="nav nav-tabs mb-3">
        {TABS.map((t) => (
          <li className="nav-item" key={t.to}>
            <NavLink
              to={t.to}
              end={t.end}
              className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
            >
              {t.label}
            </NavLink>
          </li>
        ))}
      </ul>

      <Outlet />
    </div>
  );
}
