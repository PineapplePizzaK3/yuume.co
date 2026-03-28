import { Helmet } from 'react-helmet-async'
import { useState } from 'react'
import { CONTATOS_DIRETOS } from '../data/contatoDireto'

const WEB3FORMS_ACCESS_KEY = import.meta.env.VITE_WEB3FORMS_ACCESS_KEY || ''

/**
 * Ícones SVG para os botões de contato direto.
 */
const ICONES = {
  WhatsApp: (
    <svg className="h-10 w-10 sm:h-12 sm:w-12" fill="currentColor" viewBox="0 0 24 24">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  ),
  Telegram: (
    <svg className="h-10 w-10 sm:h-12 sm:w-12" fill="currentColor" viewBox="0 0 24 24">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  ),
  Instagram: (
    <svg className="h-10 w-10 sm:h-12 sm:w-12" fill="currentColor" viewBox="0 0 24 24">
      <path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.048-1.067-.06-1.407-.06-4.123v-.08c0-2.643.012-2.987.06-4.043.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clipRule="evenodd" />
    </svg>
  ),
}

/**
 * Página de Contato com formulário (via Web3Forms) e opções de contato direto.
 * Configure VITE_WEB3FORMS_ACCESS_KEY em .env (obtenha em web3forms.com com support@eiko-dls.com).
 */
function Contact() {
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    mensagem: '',
  })
  const [status, setStatus] = useState('idle') // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState('')

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!WEB3FORMS_ACCESS_KEY) {
      setStatus('error')
      setErrorMsg('Formulário não configurado. Adicione VITE_WEB3FORMS_ACCESS_KEY no .env (obtenha em web3forms.com).')
      return
    }
    setStatus('loading')
    setErrorMsg('')
    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_key: WEB3FORMS_ACCESS_KEY,
          name: formData.nome,
          email: formData.email,
          message: formData.mensagem,
          subject: `Contato - Eiko's Delivery (de ${formData.nome})`,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setStatus('success')
        setFormData({ nome: '', email: '', mensagem: '' })
      } else {
        setStatus('error')
        setErrorMsg(data.message || 'Falha ao enviar. Tente novamente.')
      }
    } catch {
      setStatus('error')
      setErrorMsg('Erro de conexão. Tente novamente.')
    }
  }

  return (
    <>
      <Helmet>
        <title>Contato | Entre em contato conosco</title>
        <meta
          name="description"
          content="Entre em contato com a Delivery. Tire suas dúvidas ou solicite nossos serviços de entrega."
        />
      </Helmet>

      <section className="px-4 pt-24 pb-16">
        <div className="mx-auto max-w-xl">
          <h1 className="text-3xl font-bold tracking-tight text-earth-900 sm:text-4xl">
            Contato
          </h1>
          <p className="mt-2 text-earth-600">
            Preencha o formulário abaixo e retornaremos em breve.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <div>
              <label
                htmlFor="nome"
                className="block text-sm font-medium text-earth-700"
              >
                Nome
              </label>
              <input
                type="text"
                id="nome"
                name="nome"
                value={formData.nome}
                onChange={handleChange}
                required
                className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 shadow-sm focus:border-earth-900 focus:outline-none focus:ring-1 focus:ring-earth-900"
                placeholder="Seu nome completo"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-earth-700"
              >
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 shadow-sm focus:border-earth-900 focus:outline-none focus:ring-1 focus:ring-earth-900"
                placeholder="seu@email.com"
              />
            </div>

            <div>
              <label
                htmlFor="mensagem"
                className="block text-sm font-medium text-earth-700"
              >
                Mensagem
              </label>
              <textarea
                id="mensagem"
                name="mensagem"
                rows={4}
                value={formData.mensagem}
                onChange={handleChange}
                required
                className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 shadow-sm focus:border-earth-900 focus:outline-none focus:ring-1 focus:ring-earth-900"
                placeholder="Como podemos ajudar?"
              />
            </div>

            {status === 'success' && (
              <p className="rounded-lg bg-green-50 p-4 text-sm font-medium text-green-800">
                Mensagem enviada com sucesso! Retornaremos em breve.
              </p>
            )}
            {status === 'error' && (
              <p className="rounded-lg bg-red-50 p-4 text-sm font-medium text-red-800">
                {errorMsg}
              </p>
            )}
            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full rounded-lg bg-earth-900 px-4 py-3 font-medium text-earth-50 transition hover:bg-earth-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {status === 'loading' ? 'Enviando...' : 'Enviar mensagem'}
            </button>
          </form>

          {/* Contato direto: WhatsApp, Telegram, Instagram */}
          <div className="mt-12 border-t border-earth-200 pt-10">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-earth-500">
              Ou entre em contato direto
            </h2>
            <div className="mt-6 grid w-full grid-cols-3 gap-4">
              {CONTATOS_DIRETOS.map((contato) => (
                <a
                  key={contato.nome}
                  href={contato.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={contato.texto}
                  className={`flex w-full flex-col items-center justify-center gap-2 rounded-lg px-4 py-5 text-earth-50 transition ${contato.cor}`}
                >
                  <span className="shrink-0">{ICONES[contato.nome]}</span>
                  <span className="text-center text-sm font-medium">
                    {contato.texto}
                  </span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

export default Contact
