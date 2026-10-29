# Cadastro administrativo de funcionários

`POST /api/admin/users` é uma operação exclusivamente do servidor. Ela exige
um JWT válido e um perfil `admin` ativo, confirmado em `public.profiles` pelo
backend. O navegador nunca recebe nem usa a credencial administrativa do
Supabase.

## Contrato

O corpo deve conter exatamente `name`, `email` e `password`. O nome é
obrigatório (após remover espaços externos) e tem no máximo 120 caracteres; o
e-mail é normalizado para minúsculas e validado em formato conservador; a senha
tem de 8 a 128 caracteres e não pode ser vazia ou conter caracteres de controle.
Campos como `id`, `role` e `status` são rejeitados.

O servidor cria a conta somente com `supabase.auth.admin.create_user`, usando
`email_confirm=True`, e então insere o perfil com o mesmo UUID, `role` fixado
em `employee` e `status` fixado em `active`. `email_confirm=True` representa a
decisão administrativa de habilitar a senha inicial; não comprova posse do
endereço de e-mail e não substitui um processo posterior de verificação de
e-mail.

Em sucesso (`201`), a resposta contém apenas `id`, `name`, `role` e `status`.
Ela não contém senha, sessão, token nem resposta bruta do Supabase.

## Falhas e consistência

Duplicidade conhecida de e-mail retorna `409` sem alterar uma conta existente.
Entrada inválida retorna `422` com mensagem genérica, para que a senha não seja
refletida pela resposta. Falhas do Auth retornam `502` e falhas de perfil
retornam `500`, também sem detalhes internos.

Auth e `profiles` pertencem a serviços distintos, portanto não há transação
única entre as duas operações. Se a criação do perfil falhar, o servidor tenta
apagar apenas o UUID que acabou de receber do Auth, depois de confirmar que não
há perfil para ele. Caso a leitura ou a compensação seja incerta, ou se um
perfil já existir, nada é sobrescrito ou apagado: é registrado apenas um evento
técnico sem dados sensíveis para reconciliação administrativa. Isso evita uma
deleção baseada em e-mail ou em uma identidade não confirmada.

O endpoint não usa `signUp`, `signInWithPassword` ou `setSession`; portanto, a
sessão do administrador não é substituída.
