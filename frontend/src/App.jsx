import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import Nav from './components/Nav.jsx';
import RequireRole from './components/RequireRole.jsx';

import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Registro from './pages/Registro.jsx';
import Cliente from './pages/Cliente.jsx';
import Admin from './pages/Admin.jsx';

import DuenoLayout from './pages/Dueno/DuenoLayout.jsx';
import Resumen from './pages/Dueno/Resumen.jsx';
import Chalets from './pages/Dueno/Chalets.jsx';
import Reservas from './pages/Dueno/Reservas.jsx';
import Empleados from './pages/Dueno/Empleados.jsx';
import Calendario from './pages/Dueno/Calendario.jsx';
import Analitica from './pages/Dueno/Analitica.jsx';

function Layout() {
  return (
    <>
      <Nav />
      <Outlet />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/registro" element={<Registro />} />

            <Route element={<RequireRole roles={['cliente']} />}>
              <Route path="/cliente" element={<Cliente />} />
            </Route>

            <Route element={<RequireRole roles={['admin']} />}>
              <Route path="/admin" element={<Admin />} />
            </Route>

            <Route element={<RequireRole roles={['dueno', 'admin']} />}>
              <Route path="/dueno" element={<DuenoLayout />}>
                <Route index element={<Resumen />} />
                <Route path="chalets" element={<Chalets />} />
                <Route path="reservas" element={<Reservas />} />
                <Route path="empleados" element={<Empleados />} />
                <Route path="calendario" element={<Calendario />} />
                <Route path="analitica" element={<Analitica />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
