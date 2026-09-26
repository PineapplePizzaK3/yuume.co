import { Routes, useLocation } from 'react-router-dom'
import Navbar from '../../components/Navbar'
import GlobalCatalogSearchShortcut from '../../components/GlobalCatalogSearchShortcut'
import Footer from '../../components/Footer'
import { ServicesRoutes } from './servicesRoutes'

export function ServicesApp({ components, p, e }) {
  const location = useLocation()
  const isLiveRipsRoute =
    location.pathname === '/live-rips' ||
    location.pathname.startsWith('/live-rips/') ||
    location.pathname === '/en/live-rips' ||
    location.pathname.startsWith('/en/live-rips/')

  return (
    <>
      {!isLiveRipsRoute ? <Navbar /> : null}
      {!isLiveRipsRoute ? <GlobalCatalogSearchShortcut /> : null}
      <main className="flex-1">
        <Routes>
          {ServicesRoutes({ components, p, e })}
        </Routes>
      </main>
      {!isLiveRipsRoute ? <Footer /> : null}
    </>
  )
}

