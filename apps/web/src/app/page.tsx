import Link from 'next/link';
import {
  BusFront,
  ArrowUpRight,
  MapPin,
  Ticket,
  MessageSquare,
  ArrowRight,
  ShieldCheck,
  Navigation,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
export default function Landing() {
  return (
    <main className="landing" id="content">
      <header className="landing-header">
        <Link href="/" className="brand">
          <span className="brand-mark">
            <BusFront size={24} />
          </span>
          vantrack.
        </Link>
        <nav>
          <a href="#como-funciona">Como funciona</a>
          <Link href="/login">Entrar</Link>
          <ThemeToggle />
          <Button asChild>
            <Link href="/cadastro">
              Começar
              <ArrowUpRight size={16} />
            </Link>
          </Button>
        </nav>
      </header>
      <section className="landing-hero">
        <div className="landing-copy">
          <span className="route-chip">
            <MapPin size={15} />
            Rio de Janeiro ↔ Teresópolis
          </span>
          <h1>
            Seu trajeto.
            <br />
            Mais tranquilo.
          </h1>
          <p>
            Saiba onde está sua van. Garanta seu lugar. E deixe a próxima viagem fazer parte da sua
            rotina, sem incertezas.
          </p>
          <div className="hero-actions">
            <Button size="lg" asChild>
              <Link href="/cadastro">
                Reserve seu próximo trajeto
                <ArrowUpRight size={18} />
              </Link>
            </Button>
            <Link href="/login" className="driver-link">
              Sou motorista <ArrowRight size={17} />
            </Link>
          </div>
          <p className="hero-caption">
            <ShieldCheck size={16} />
            Feito para conectar professores, motoristas e caminhos.
          </p>
        </div>
        <div
          className="landing-route-art"
          aria-label="Ilustração esquemática do trajeto entre Rio e Teresópolis"
        >
          <span className="art-route-label">Conexão cidade & serra</span>
          <svg
            viewBox="0 0 480 460"
            role="img"
            aria-label="Percurso ilustrativo, sem posição de veículo real"
          >
            <path
              className="terrain-line"
              d="M-20 380Q90 130 190 290T500 100M-20 420Q100 180 220 330T500 150M-20 460Q100 230 240 370T500 200M-20 340Q80 80 160 250T500 50"
            />
            <path className="route-stroke" d="M100 360C260 390 120 210 260 220S270 60 380 90" />
            <circle cx="100" cy="360" r="8" />
            <circle cx="380" cy="90" r="8" />
          </svg>
          <div className="art-origin">
            <span>Saída</span>
            <strong>Rio de Janeiro</strong>
          </div>
          <div className="art-destination">
            <span>Destino</span>
            <strong>Teresópolis</strong>
          </div>
          <div className="art-message">
            <Navigation size={23} />
            <div>
              <strong>Cada trecho, mais perto.</strong>
              <span>Conexão para uma rotina melhor.</span>
            </div>
          </div>
          <span className="art-disclaimer">Percurso ilustrativo</span>
        </div>
      </section>
      <section className="landing-workflow" id="como-funciona">
        <h2>
          Do primeiro toque
          <br />
          ao seu destino.
        </h2>
        <div>
          {[
            {
              icon: Ticket,
              title: 'Seu lugar, garantido.',
              text: 'Consulte horários, escolha o embarque e reserve uma vaga.',
            },
            {
              icon: MapPin,
              title: 'Acompanhe o caminho.',
              text: 'Veja a localização compartilhada pelo motorista durante a viagem.',
            },
            {
              icon: MessageSquare,
              title: 'Todo mundo conectado.',
              text: 'Converse com sua viagem e receba avisos quando algo mudar.',
            },
          ].map((x) => (
            <article key={x.title}>
              <x.icon size={23} />
              <h3>{x.title}</h3>
              <p>{x.text}</p>
            </article>
          ))}
        </div>
      </section>
      <footer className="landing-footer">
        <span>vantrack.</span>
        <p>Rio, serra e você. No mesmo caminho.</p>
        <Link href="/login">
          Acessar plataforma <ArrowUpRight size={16} />
        </Link>
      </footer>
    </main>
  );
}
