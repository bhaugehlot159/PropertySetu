import { Outlet } from "react-router-dom";
import TopNav from "./TopNav.jsx";

function AppLayout() {
  return (
    <div className="app-shell">
      <TopNav />
      <main className="container">
        <Outlet />
      </main>
    </div>
  );
}

export default AppLayout;
