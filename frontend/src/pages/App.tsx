import { Link, Outlet } from 'react-router-dom'

export default function App() {
  return (
    <div style={{ fontFamily: 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif', margin: '1rem auto', maxWidth: 900 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2><Link to="/" style={{ textDecoration: 'none' }}>Website Archiver</Link></h2>
        <nav style={{ display: 'flex', gap: 12 }}>
          <Link to="/sites">All sites</Link>
        </nav>
      </header>
      <Outlet />
    </div>
  )
}