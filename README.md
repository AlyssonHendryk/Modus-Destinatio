# Modus Destinatio

**Sistema web de apoio à gestão de estoque e à logística interna de distribuidores de alimentos.**

O Modus Destinatio é um MVP acadêmico desenvolvido para organizar produtos, pedidos e operações de separação. A PA Alimentos é utilizada no trabalho como cenário fictício de referência.

## Funcionalidades

- Autenticação e acesso conforme o perfil do usuário.
- Cadastro, edição e consulta de produtos e estoque.
- Criação e acompanhamento de pedidos.
- Separação de pedidos e atualização do estoque.
- Histórico de movimentações.
- Alertas de estoque mínimo e indicadores no painel.
- Consulta do quadro de auditoria das ações realizadas.
- Interface responsiva e cache de dados operacionais para consulta quando disponível.

As gravações e atualizações dependem da comunicação com a API e os serviços do Supabase. O cache operacional não representa uma fila de alterações offline para sincronização posterior.

## Tecnologias

| Camada | Tecnologias |
|---|---|
| Interface | Next.js 16.3.4, React 19.2.4 e Tailwind CSS 4 |
| API | Python 3.14.7, FastAPI, Uvicorn e Pydantic |
| Banco de dados e autenticação | Supabase Cloud e PostgreSQL |
| Testes | `node:test` e `unittest` |

A versão mínima de Node.js indicada pela documentação do Next.js é 20.9. Consulte os [requisitos oficiais do Next.js](https://nextjs.org/docs/app/getting-started/installation).

## Requisitos para executar

- Node.js 20.9 ou superior e npm.
- Python 3.14.7 foi utilizado no ambiente de teste do projeto.
- Um projeto Supabase configurado com as tabelas, políticas e permissões esperadas pela aplicação.
- Credenciais do Supabase configuradas localmente para o frontend e para a API.

## Configuração local

Não publique chaves, tokens ou arquivos `.env` no repositório. O `.gitignore` do projeto já ignora arquivos `.env*`.

### Frontend

Crie `.env.local` na raiz do projeto:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<identificador-do-projeto>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<chave-publicavel-do-supabase>
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

A chave `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` é usada pelo cliente do Supabase no navegador. Não coloque nela uma chave privada ou administrativa.

### Backend

Crie `.env` na raiz do projeto:

```env
SUPABASE_URL=https://<identificador-do-projeto>.supabase.co
SUPABASE_KEY=<chave-privada-do-backend>
SUPABASE_JWT_ALGORITHM=ES256
SUPABASE_JWT_AUDIENCE=authenticated
SUPABASE_JWT_ISSUER=https://<identificador-do-projeto>.supabase.co/auth/v1
```

`SUPABASE_KEY` é utilizada somente no backend. Mantenha-a em segredo. Se a configuração de autenticação usar `HS256`, também será necessário configurar `SUPABASE_JWT_SECRET`; com `ES256`, a validação usa as chaves públicas do emissor configurado.

## Como executar

Clone o repositório e entre na pasta:

```powershell
git clone https://github.com/AlyssonHendryk/Modus-Destinatio.git
cd Modus-Destinatio
```

### 1. Instalar as dependências do frontend

```powershell
npm ci
```

### 2. Preparar e iniciar a API

Em um PowerShell, crie e ative um ambiente virtual:

```powershell
py -3.14 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

Inicie a API:

```powershell
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

A documentação interativa da API fica disponível em:

```text
http://127.0.0.1:8000/docs
```

### 3. Iniciar o frontend

Em outro PowerShell, na raiz do projeto:

```powershell
npm run dev
```

Acesse:

```text
http://localhost:3000
```

## Testes automatizados

Na raiz do projeto, execute os testes JavaScript:

```powershell
node --test tests/*.test.mjs
```

Com o ambiente virtual Python ativado, execute os testes do backend:

```powershell
python -m unittest discover -s tests -p "test_*.py" -v
```

Os testes do backend utilizam dependências simuladas; não substituem a validação de uma conexão real com o Supabase.

## Compilar para produção

```powershell
npm run build
```

Para iniciar a versão compilada localmente:

```powershell
npm start
```

## Estrutura principal

```text
.
├── docs/             # Documentação e artefatos do projeto
├── src/              # Aplicação frontend
├── tests/            # Testes automatizados
├── admin_users.py    # Rotas administrativas da API
├── api_auth.py       # Autenticação e autorização da API
├── main.py           # Aplicação FastAPI
├── package.json      # Dependências e comandos do frontend
└── requirements.txt  # Dependências do backend
```

## Contexto acadêmico

Projeto desenvolvido como Trabalho de Graduação do curso de Análise e Desenvolvimento de Sistemas. O controle de lotes e datas de validade está previsto como melhoria futura.
