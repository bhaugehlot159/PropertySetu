import { NavLink } from "react-router-dom";
import { APP_NAME } from "../utils/constants.js";

const linkClassName = ({ isActive }) =>
  `nav-link${isActive ? " nav-link-active" : ""}`;

function TopNav() {
  return (
    <header className="top-nav">
      <div className="container top-nav-inner">
        <NavLink to="/" className="brand">
          {APP_NAME}
        </NavLink>
        <nav className="nav-list">
          <NavLink to="/" className={linkClassName}>
            Home
          </NavLink>
          <NavLink to="/properties" className={linkClassName}>
            Properties
          </NavLink>
          <NavLink to="/add-property" className={linkClassName}>
            Add Property
          </NavLink>
        </nav>
      </div>
    </header>
  );
}

export default TopNav;
