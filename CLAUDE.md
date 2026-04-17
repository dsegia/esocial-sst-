# eSocial SST — Instruções para Claude Code

## Stack
- Next.js 14 (Pages Router) + TypeScript
- Supabase (auth + banco + RLS)
- Vercel (deploy)
- Stripe (pagamentos)
- Resend (e-mails)
- Anthropic API (leitura de PDF via IA)

## Repositório e Deploy

**REGRA CRÍTICA:** Nunca rodar `vercel deploy` manualmente.

O fluxo correto é sempre:
1. Editar arquivos em `/c/esocial-sst` (repositório principal, branch `main`)
2. `git add` + `git commit` + `git push origin main`
3. O Vercel detecta o push no GitHub e faz o deploy automaticamente

O projeto tem dois locais de código:
- **Repositório principal:** `C:\esocial-sst` — sempre editar aqui
- **Worktrees:** `C:\esocial-sst\.claude\worktrees\*` — NÃO editar, NÃO fazer deploy daqui

## Variáveis de ambiente
Estão em `.env.local` (local) e no painel do Vercel (produção).
Nunca commitar `.env.local`.

## Banco de dados
Projeto Supabase: `nujrhikewkodtemvwske`
Sempre usar RLS. Service role key apenas em API routes server-side.

## Padrões de código
- Inline styles (sem CSS modules, sem Tailwind)
- Cores primárias: `#185FA5` (azul), `#f4f6f9` (fundo)
- Sem comentários desnecessários
- Sem `console.log` em produção
