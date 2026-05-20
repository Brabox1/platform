# Checkout Platform

Plataforma de venda de infoprodutos com checkout próprio, integrada à **AmploPay**.
Monorepo Turborepo + Next.js 15 + Prisma + PostgreSQL.

## 🏗️ Arquitetura

```
checkout-platform/
├── apps/
│   └── web/                   Next.js 15 (App Router)
│       └── src/
│           ├── app/
│           │   ├── (marketing)/         Landing pública
│           │   ├── auth/                Login/registro vendedor
│           │   ├── dashboard/           Painel do vendedor
│           │   ├── c/[slug]/            Checkout público ← já criado
│           │   ├── members/             Área de membros do comprador
│           │   └── api/
│           │       ├── checkout/        POST /api/checkout
│           │       └── webhooks/amplopay   ← já criado
│           ├── components/
│           ├── lib/
│           └── server/                  lógica de negócio
├── packages/
│   ├── db/                    Prisma schema + client
│   └── amplopay/              SDK interno da AmploPay
└── ...
```

## 🚀 Setup

### Pré-requisitos
- Node 20+
- pnpm 9+ (`npm i -g pnpm`)
- PostgreSQL (local ou Neon/Supabase)
- Redis (pra fila de webhooks — opcional na v1)

### 1. Instalar
```bash
pnpm install
```

### 2. Variáveis de ambiente
```bash
cp .env.example .env
```
Preencha pelo menos:
- `DATABASE_URL`
- `BETTER_AUTH_SECRET` (gere com `openssl rand -base64 32`)
- `AMPLOPAY_CLIENT_ID`, `AMPLOPAY_CLIENT_SECRET`, `AMPLOPAY_WEBHOOK_SECRET`

### 3. Banco
```bash
pnpm db:push        # cria as tabelas
pnpm db:studio      # GUI pra inspecionar
```

### 4. Rodar
```bash
pnpm dev            # sobe o Next em http://localhost:3000
```

## 🔌 AmploPay — onde pegar as credenciais

1. Acesse o painel da AmploPay
2. Vá em **API** → **Nova credencial**
3. Marque os escopos: **Criar/Consultar transações**
4. Copie o **Client ID** e **Client Secret** pra `.env`
5. Configure o webhook apontando pra:
   `https://seudominio.com/api/webhooks/amplopay`
6. Copie o secret do webhook pra `AMPLOPAY_WEBHOOK_SECRET`

> ⚠️ **Os endpoints exatos** (`/auth/token`, `/transactions`, etc.) e o nome
> do header de assinatura podem variar conforme a doc atual da AmploPay.
> Abra a documentação no painel e ajuste `packages/amplopay/src/index.ts`
> se for o caso. O esqueleto OAuth client_credentials + HMAC SHA-256 cobre
> o padrão da maioria dos gateways BR.

## 📋 O que já está pronto

- ✅ Schema completo (User, KYC, Product, Order, Course, Webhook, Payout)
- ✅ SDK AmploPay com auth OAuth, criação de transação, validação HMAC do webhook
- ✅ Endpoint `POST /api/checkout` — cria Order + chama AmploPay
- ✅ Webhook `POST /api/webhooks/amplopay` — idempotente, com auditoria
- ✅ Fulfillment automático após `transaction.paid` (libera member access)
- ✅ Página pública de checkout em `/c/[slug]` com PIX + order bumps

## 🛠️ Próximos passos (em ordem)

### Fase 1 — autenticação + KYC
- [ ] Setup do Better Auth (`src/lib/auth.ts`)
- [ ] Páginas `/auth/login` e `/auth/register`
- [ ] Middleware de rota protegida pro dashboard
- [ ] Fluxo de KYC: upload de docs + integração com Caf (sandbox)
- [ ] Bloqueio de `Product.create` se `kycStatus !== APPROVED`

### Fase 2 — painel do vendedor
- [ ] `/dashboard` — métricas (vendas, conversão, MRR)
- [ ] `/dashboard/products` — CRUD de produtos + order bumps
- [ ] `/dashboard/orders` — lista de pedidos, filtros
- [ ] `/dashboard/payouts` — saque

### Fase 3 — área de membros
- [ ] `/members/login` — login do comprador com email + senha temporária
- [ ] `/members/courses` — lista de produtos comprados
- [ ] `/members/[productSlug]` — player + módulos + aulas
- [ ] Tracking de progresso

### Fase 4 — extras de conversão
- [ ] Upsell pós-compra
- [ ] Pixel do Facebook + GA4
- [ ] Cupom de desconto
- [ ] Recuperação de carrinho abandonado
- [ ] Customização visual do checkout (cores, logo)

### Fase 5 — produção
- [ ] Fila de webhooks com BullMQ (pra retry resiliente)
- [ ] Rate limiting (Upstash Ratelimit)
- [ ] Observabilidade (Sentry + Axiom/BetterStack)
- [ ] Deploy: Vercel (web) + Neon (DB) + Upstash (Redis)

## 🔐 Segurança

- ✅ Webhook valida HMAC SHA-256 em tempo constante (`timingSafeEqual`)
- ✅ Idempotência via `WebhookEvent` (unique `provider + externalId`)
- ✅ KYC obrigatório antes de vender (verificado em `createCheckout`)
- ✅ Senhas hash bcrypt
- ⚠️ Em produção, NUNCA exponha `BETTER_AUTH_SECRET` ou `AMPLOPAY_CLIENT_SECRET`

## 📝 Notas regulatórias

A AmploPay é a parte regulada (PSP). Você é o vendedor que opera no app dela.
O KYC dos seus vendedores é **seu** dever pra não virar canal de fraude/lavagem:
quem opera no Brasil é obrigado pelas Circulares BCB 3.978/2020 e 4.122/2021 +
deveres de COAF (PLD/FT). Vale a pena fechar contrato com uma consultoria
especializada antes de escalar.
