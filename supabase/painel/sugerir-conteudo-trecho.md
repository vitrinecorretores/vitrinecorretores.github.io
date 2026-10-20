# Trecho para colar na função `sugerir-conteudo` (painel Supabase)

O app agora envia `temas_usados` (array de strings, até 60) no corpo da chamada
`{ tipo: "assunto", temas_usados: [...] }`. Cole o trecho abaixo na função.

## 1. Ler o campo (junto de onde você lê `tipo` do body)

```ts
// temas que o corretor já usou (rascunho, agendado ou publicado) — a IA não pode repetir
const temasUsados: string[] = Array.isArray(body?.temas_usados)
  ? body.temas_usados.filter((t: unknown) => typeof t === "string").slice(0, 60).map((t: string) => t.slice(0, 140))
  : [];
```

## 2. Acrescentar ao prompt (no texto enviado à IA, para `tipo: "assunto"`)

```ts
const blocoEvitar = temasUsados.length
  ? `\n\nTEMAS JÁ USADOS por este corretor (NÃO repita nem crie variações, reformulações ou ângulos muito parecidos com nenhum deles):\n` +
    temasUsados.map((t) => `- ${t}`).join("\n") +
    `\nTraga assuntos claramente diferentes destes, com ganchos e ideias novos.`
  : "";
// ex.: const prompt = promptBase + blocoEvitar;
```

## 3. (Opcional) Rede de segurança no servidor

```ts
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2);
const jaccard = (a: string, b: string) => {
  const A = new Set(norm(a)), B = new Set(norm(b));
  const i = [...A].filter((w) => B.has(w)).length;
  return A.size && B.size ? i / (A.size + B.size - i) : 0;
};
// topicos = lista devolvida pela IA, cada um com .gancho
const topicosFiltrados = topicos.filter((t: { gancho: string }) =>
  !temasUsados.some((u) => jaccard(t.gancho, u) >= 0.6));
```

O app também descarta no front qualquer assunto repetido, então o passo 3 é opcional.
