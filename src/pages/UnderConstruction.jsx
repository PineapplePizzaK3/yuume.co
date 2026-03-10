import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'

/**
 * Página "Em construção" exibida quando o usuário acessa Login/Registro.
 */
function UnderConstruction() {
  return (
    <>
      <Helmet>
        <title>Em breve | Login e Registro | Delivery</title>
        <meta
          name="description"
          content="A área de login e registro está em construção. Em breve você poderá se cadastrar em nossa plataforma."
        />
      </Helmet>

      <section className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-4 pt-24 pb-16">
        <div className="mx-auto max-w-lg text-center">
          <img
            src="/em-construcao.png"
            alt="Área em construção - Logo em breve"
            className="mx-auto w-full max-w-md rounded-lg object-contain"
          />
          <h1 className="mt-8 text-2xl font-bold text-earth-900 sm:text-3xl">
            Em construção
          </h1>
          <p className="mt-3 text-earth-600">
            A área de login e registro está sendo preparada. Em breve você poderá
            se cadastrar e acompanhar seus pedidos em nossa plataforma.
          </p>
          <Link
            to="/"
            className="mt-8 inline-flex rounded-lg bg-earth-900 px-6 py-3 text-base font-medium text-earth-50 transition hover:bg-earth-800"
          >
            Voltar ao início
          </Link>
        </div>
      </section>
    </>
  )
}

export default UnderConstruction
