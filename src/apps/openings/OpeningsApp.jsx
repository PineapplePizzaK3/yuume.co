import { Routes } from 'react-router-dom'
import Navbar from '../../components/Navbar'
import GlobalCatalogSearchShortcut from '../../components/GlobalCatalogSearchShortcut'
import Footer from '../../components/Footer'
import { OpeningsRoutes } from './openingsRoutes'

export function OpeningsApp({ components }) {
  return (
    <>
      <Navbar />
      <GlobalCatalogSearchShortcut />
      <main className="flex-1">
        <Routes>
          {OpeningsRoutes({ components })}
        </Routes>
      </main>
      <Footer />
    </>
  )
}
