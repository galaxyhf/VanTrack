import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="empty-state">
      <h1>Página não encontrada</h1>
      <Link href="/app">Voltar ao início</Link>
    </main>
  );
}
