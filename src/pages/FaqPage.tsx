import { useState, type ReactNode } from 'react'
import { HelpCircle, ChevronDown } from 'lucide-react'

interface Faq {
  q: string
  a: ReactNode
}

const B = ({ children }: { children: ReactNode }) => (
  <span className="text-text font-semibold">{children}</span>
)

const FAQS: Faq[] = [
  {
    q: '¿De qué es la app?',
    a: (
      <>
        HinchaHub es una plataforma para crear y participar en <B>torneos de pronósticos
        deportivos (prode)</B> entre amigos. Predecís los resultados de los partidos de
        competiciones como el Mundial, la Copa Libertadores y más, y competís en un ranking
        según tu puntería. No es una casa de apuestas: la app no recibe ni administra dinero,
        solo organiza y registra tus pronósticos.
      </>
    ),
  },
  {
    q: '¿Cómo entro a un torneo?',
    a: (
      <>
        Andá a la sección <B>Torneos</B>. Vas a ver dos tipos:
        <ul className="mt-2 space-y-1.5 list-disc pl-5">
          <li><B>Abierto</B> (chip verde): tocás <B>Unirse</B> e ingresás al instante.</li>
          <li>
            <B>Con solicitud</B> (chip amarillo): tocás <B>Solicitar ingreso</B>, se abre una
            ventana con la info del torneo, confirmás, y tu solicitud queda pendiente hasta que
            el administrador la acepte. Cuando te acepten te llega una notificación.
          </li>
        </ul>
      </>
    ),
  },
  {
    q: '¿Tengo que pagar para participar?',
    a: (
      <>
        Depende del torneo. <B>HinchaHub no cobra nada ni maneja dinero.</B> Algunos torneos
        tienen un costo definido por su organizador (para repartir premios entre los
        participantes). Si un torneo es pago, al solicitar el ingreso vas a ver toda la info:
        el monto, el alias para transferir y a qué número enviar el comprobante. El pago se
        coordina por fuera de la app, directamente con el administrador del torneo.
      </>
    ),
  },
  {
    q: '¿Cómo veo los partidos de torneos a los que no estoy inscripto?',
    a: (
      <>
        En la sección <B>Partidos</B> (y en <B>Partidos de hoy</B>, dentro de Inicio) se
        muestran las competiciones destacadas aunque no estés inscripto en ningún torneo de
        ellas. Podés moverte por fecha con las flechas para ver los partidos de cada día.
      </>
    ),
  },
  {
    q: '¿Cómo se suman los puntos?',
    a: (
      <>
        Sumás puntos según cuánto le acertás a cada partido: más por el <B>resultado exacto</B>,
        menos por acertar el <B>ganador y los goles de un equipo</B>, y menos aún por acertar
        solo el <B>ganador</B> o solo los <B>goles</B>. Además premia la anticipación: si cargás
        tu pronóstico con <B>más de 24 h</B> de anticipación sumás el puntaje completo; dentro de
        las 24 h (o si modificás un pronóstico) sumás la mitad. En los torneos con <B>bonus</B>
        {' '}(campeón, goleador, etc.) sumás <B>10 / 5 / 3 pts</B> según aciertes con tu 1ª, 2ª o
        3ª opción. El detalle exacto de cada torneo está en <B>Bases y condiciones</B>, dentro
        del prode.
      </>
    ),
  },
  {
    q: '¿Cómo cambio mi foto de perfil o alias?',
    a: (
      <>
        Desde la sección <B>Perfil</B>. Ahí podés tocar tu foto para subir una nueva y editar tu
        alias (el nombre con el que aparecés en los rankings). Si entraste con Google, tu foto de
        Google se usa automáticamente hasta que subas una propia.
      </>
    ),
  },
  {
    q: '¿Cómo veo la posición real y los últimos partidos de un equipo?',
    a: (
      <>
        Tocá el nombre o el escudo de cualquier equipo, donde sea que aparezca (en un partido, en
        una tabla de posiciones, etc.). Se abre una ficha con su <B>posición real</B> en la
        competición, sus <B>últimos 5 partidos</B> (con fecha y resultado) y su <B>próximo
        partido</B>.
      </>
    ),
  },
  {
    q: '¿Cómo veo cuántos puntos voy teniendo y cómo se compone mi puntaje?',
    a: (
      <>
        Entrá al torneo y abrí la pestaña <B>Ranking</B>: ahí ves tu total y tu posición. Tocando
        tu propia fila (la que dice <B>"vos"</B>) se abre el desglose con cuántos puntos ganaste
        en cada partido y cómo se reparte tu puntaje entre <B>partidos</B> y <B>bonus</B>.
      </>
    ),
  },
]

export default function FaqPage() {
  const [open, setOpen] = useState<number | null>(0)

  function toggle(i: number) {
    setOpen(prev => (prev === i ? null : i))
  }

  return (
    <div className="p-6 space-y-5 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand/15 flex items-center justify-center shrink-0">
          <HelpCircle size={20} className="text-brand" />
        </div>
        <div>
          <h1 className="text-text text-xl font-semibold tracking-tight leading-tight">Ayuda</h1>
          <p className="text-muted text-xs">Preguntas frecuentes</p>
        </div>
      </div>

      {/* Accordion */}
      <div className="space-y-3">
        {FAQS.map((faq, i) => {
          const isOpen = open === i
          return (
            <div key={i} className="card overflow-hidden">
              <button
                onClick={() => toggle(i)}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-elevated/50 transition-colors"
              >
                <span className="flex-1 text-text text-sm font-semibold leading-snug">{faq.q}</span>
                <ChevronDown
                  size={18}
                  className={`text-muted shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                />
              </button>
              <div
                className={`grid transition-all duration-300 ease-out ${
                  isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                }`}
              >
                <div className="overflow-hidden">
                  <p className="px-4 pb-4 pt-0 text-muted text-sm leading-relaxed border-t border-border/50">
                    <span className="block pt-3">{faq.a}</span>
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Pie */}
      <p className="text-muted-dark text-xs text-center pt-2">
        ¿Te quedó alguna duda? Escribinos desde la sección Contacto.
      </p>
    </div>
  )
}
