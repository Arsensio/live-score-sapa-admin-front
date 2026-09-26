import { useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Flag, Trophy } from "lucide-react";
export function Layout() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <>
      <a className="skip-link" href="#main">
        Перейти к содержимому
      </a>
      <header className="app-header">
        <div className="header-inner">
          <Link
            className="brand"
            to="/tournaments"
            aria-label="Touchline — список турниров"
          >
            <span>
              <Flag size={22} />
            </span>
            touchline<b>.</b>
          </Link>
          <Link className="header-link" to="/tournaments">
            <Trophy size={18} />
            <span>Мои турниры</span>
          </Link>
          <span className="admin-label">Панель администратора</span>
        </div>
      </header>
      <main id="main" className="container">
        <Outlet />
      </main>
      <footer className="app-footer">
        <span>touchline.</span> Управление футбольными турнирами
      </footer>
    </>
  );
}
