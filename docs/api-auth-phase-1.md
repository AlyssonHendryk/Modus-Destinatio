# Autenticação da API — etapa 1

Todas as dez operações privadas existentes exigem Bearer JWT válido e um registro
em `public.profiles`, com `id = sub`, `status = active` e `role` igual a `admin`
ou `employee`. `/api/health` permanece público. OpenAPI e documentação interativa
não são endpoints de dados privados. O papel enviado no corpo, no frontend ou
no claim `role` do JWT não concede permissões de aplicação.

Nenhuma diferença de autorização entre os dois papéis foi aplicada nesta etapa.
O perfil validado fica disponível em `request.state.authenticated_user`.
As funções RPC e os corpos das operações existentes foram preservados.

## Configuração necessária antes de uso real

Não alteramos `.env` nem configurações externas. Configurar somente no backend:

- `SUPABASE_URL` e `SUPABASE_KEY`: já usados pelo cliente existente. A chave do
  servidor não representa a identidade do usuário: ela só é utilizada depois
  da verificação do JWT e do perfil para executar as operações existentes.
- `SUPABASE_JWT_ALGORITHM`: confirmar nas configurações de assinatura do projeto;
  usar exatamente `ES256`, `RS256` ou `HS256`, conforme o mecanismo real.
- `SUPABASE_JWT_AUDIENCE`: confirmar a audiência real dos tokens de acesso.
  Não foi assumido um valor padrão.
- `SUPABASE_JWT_ISSUER`: opcional quando o emissor é exatamente
  `SUPABASE_URL` acrescido de `/auth/v1`; informar explicitamente se for diferente.
- `SUPABASE_JWT_SECRET`: necessário exclusivamente para o mecanismo legado
  `HS256`. É o segredo de assinatura JWT, nunca a chave de API administrativa.
  Não usar variáveis `NEXT_PUBLIC_` para esse valor.

Para ES256/RS256, PyJWT obtém as chaves públicas do JWKS do emissor configurado,
com cache e atualização por `kid`. URLs fornecidas no token não são utilizadas.
Para HS256, a assinatura é verificada pelo PyJWT com o segredo do backend.
Algoritmo, assinatura, emissor, audiência, expiração e presença dos claims
obrigatórios são verificados; `sub` deve ser um UUID. Erros não expõem tokens,
chaves ou detalhes internos. Falhas de configuração, JWKS ou consulta de perfil
bloqueiam a operação. Tokens ausentes/inválidos retornam 401 quando a validação
está configurada; perfis não autorizados retornam 403; indisponibilidade retorna 503.

É necessário verificar externamente que `profiles` não permite ao usuário
alterar seu próprio papel/status e que as tabelas/RPCs não podem ser acessadas
diretamente contornando a API. As políticas RLS e grants não foram inspecionados
no banco nem alterados. A proteção da API não comprova essas garantias externas.

## Limitações deliberadas

O frontend envia a sessão atual e preserva o status HTTP dos erros. Não repete
mutações automaticamente. Os fluxos visuais, cache local, sincronização de sessão,
recuperação de senha e MFA não foram modificados. O AppContext existente ainda
carrega dados antes da autenticação e usa fallback local: isso será tratado em
etapa própria. Após login, pode ser necessário recarregar a página para carregar
dados reais. Cache local não é comprovação de autenticação ou persistência.

Logout não revoga instantaneamente um JWT já emitido: a assinatura local aceita
o token até sua expiração se o perfil continuar ativo. Revogação por sessão está
fora desta etapa. Inativação do perfil é consultada a cada requisição.

## Matriz proposta — aguarda aprovação

| Operação existente | Funcionário | Administrador |
| --- | --- | --- |
| GET /api/orders | Dados operacionais, sem valores | Completo |
| POST /api/orders | Negado | Permitido |
| PUT /api/orders/{order_id} | Somente transições de separação autorizadas | Edição completa |
| DELETE /api/orders/{order_id} | Negado | Permitido |
| GET /api/products | Sem preços | Completo |
| POST /api/products | Negado | Permitido |
| PUT /api/products/{product_id} | Negado | Permitido |
| DELETE /api/products/{product_id} | Negado | Permitido |
| PATCH /api/products/{product_id}/stock | Proposta: negado; confirmar necessidade operacional | Permitido |
| GET /api/stock-movements | Histórico operacional sem valores | Completo |

Antes de aplicar: o PUT de separação precisa derivar os demais campos do pedido
persistido, pois funcionários não devem enviar valores financeiros nem editar
itens/preços. Não basta proteger o PUT inteiro como admin. Confirmar também as
transições permitidas e a necessidade de movimentação manual por funcionários.

## Testes isolados

Na raiz do projeto, com dependências de requirements.txt e httpx disponíveis:

```text
python -m unittest discover -s tests -v
node --test tests/backend_auth.test.mjs
```

As chaves são geradas apenas em memória. Supabase, consulta de perfis e transporte
JWKS são substituídos nos testes; as assinaturas criptográficas são verificadas
realmente pelo PyJWT. Estes testes não comprovam login, RPCs ou persistência no
projeto Supabase real. O ambiente venv encontrado não contém python-dotenv;
os testes desta execução usam o Python disponível com as bibliotecas instaladas.
