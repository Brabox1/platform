export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-2xl text-center">
        <h1 className="mb-4 text-5xl font-bold tracking-tight">
          Checkout Platform
        </h1>
        <p className="mb-8 text-lg text-zinc-600">
          Plataforma de venda de infoprodutos integrada à AmploPay.
        </p>
        <div className="flex gap-4 justify-center">
          <a
            href="/auth/login"
            className="rounded-lg bg-brand-500 px-6 py-3 font-semibold text-white hover:bg-brand-600"
          >
            Entrar
          </a>
          <a
            href="/auth/register"
            className="rounded-lg border border-zinc-300 px-6 py-3 font-semibold hover:bg-zinc-50"
          >
            Criar conta
          </a>
        </div>
      </div>
    </main>
  );
}
