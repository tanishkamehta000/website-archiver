import React from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './pages/App'
import Home from './pages/Home'
import SiteDetail from './pages/SiteDetail'
import Viewer from './pages/Viewer'
import Sites from './pages/Sites'
import Map from './pages/Map'

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Home /> },
      { path: 'sites', element: <Sites /> },
      { path: 'site/:host', element: <SiteDetail /> },
      { path: 'view/:host/:ts/*', element: <Viewer /> },
      { path: 'map/:host/:ts', element: <Map /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
)