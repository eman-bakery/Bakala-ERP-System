export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-zinc-950">
      <main className="flex flex-1 w-full max-w-2xl flex-col items-center justify-center gap-8 px-8 py-16">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Bakala ERP
          </h1>
          <p className="text-lg text-zinc-500 dark:text-zinc-400" dir="rtl">
            شركة مخابز ايمان جدة للخبز
          </p>
        </div>

        <p className="text-xl font-medium text-zinc-700 dark:text-zinc-300 italic">
          &ldquo;The Taste of Tradition&rdquo;
        </p>
        <p className="text-sm text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
          Since 2007
        </p>

        <div className="mt-8 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400 text-center">
            Enterprise Resource Planning &amp; Point of Sale System
          </p>
          <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500 text-center font-mono">
            System initializing...
          </p>
        </div>
      </main>
    </div>
  );
}
