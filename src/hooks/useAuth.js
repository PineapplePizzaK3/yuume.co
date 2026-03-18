/**
 * useAuth - Re-exporta do AuthContext para manter imports existentes.
 * O estado é centralizado no AuthProvider para que Navbar e demais
 * componentes sempre vejam o mesmo valor (ex.: ao deslogar).
 */
export { useAuth } from '../contexts/AuthContext'
