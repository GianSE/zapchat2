# 💬 ZapChat 2

**Projeto 2 de EC48B — Programação Web Back-End**
Temática: **📱 Mensagens instantâneas** (entidades Usuário, Conversa, Mensagem + Contato e Reação)

**Integrante:** Gian Pedro Rodrigues — RA 2503638

---

## 1. Descrição

O ZapChat 2 é a evolução Web do **ZapChat (Projeto 1)**. A aplicação de terminal virou uma
aplicação **Express.js** com páginas geradas por **templates EJS** (Opção A do enunciado), login com
**sessões** (`express-session`), parâmetros **GET/POST** e o mesmo **MongoDB Driver** do Projeto 1.

As classes de entidade, o CRUD genérico, a validação, as exceções e o log do Projeto 1 foram
**reaproveitados**: a camada Web só recebe a requisição, chama essas classes e devolve a página.

| Vem do Projeto 1 (reaproveitado) | Novo no Projeto 2 |
| --- | --- |
| `src/models/` — `Modelo` (classe abstrata com o CRUD) e as 5 entidades | `app.js` e `bin/www` (estrutura do express-generator) |
| `src/services/ChatService.js` — regras que envolvem várias coleções | `src/routes/` — rotas Express |
| `src/database/Database.js` — conexão Singleton com o MongoDB Driver | `src/controllers/` — processamento das requisições |
| `src/errors/` — hierarquia de exceções | `src/views/` — templates EJS |
| `src/utils/Validador.js`, `Seguranca.js` (hash scrypt), `Logger.js` | `src/middlewares/` — sessão/login, conexão, tratamento de erros |
| `scripts/seed.js` — dados de exemplo | `public/` — CSS |

**Adaptações feitas no código do Projeto 1** (todas comentadas com "Projeto 2" no código):

- `ErroAutenticacao` (401) e `ErroPermissao` (403) entraram na hierarquia de exceções; o login
  incorreto e as verificações "somente o autor / administrador / participante" passaram a usá-las.
- Com a sessão, o usuário só pode mexer no que é dele: `Contato.obterDoUsuario`,
  `Mensagem.obterDoAutor`, `Conversa.garantirAdministrador` e novos casos de uso no `ChatService`
  (`atualizarGrupo`, `removerDoGrupo`, `fixarMensagem`, `excluirConta`, `adicionarContatoPorEmail`,
  `enviarMensagemDoUsuario`).
- A URL de anexo agora só aceita `http://` ou `https://` (um link `javascript:` viraria ataque XSS na página).
- O índice único de apelido usa filtro parcial: o índice `sparse` do Projeto 1 indexava `null` e
  impedia dois usuários sem apelido de se cadastrarem.
- O histórico da conversa mostra as mensagens **mais recentes**; a busca de mensagens aceita uma lista
  de conversas (para buscar só nas conversas do usuário logado).
- `Database.conectar()` reaproveita uma tentativa de conexão em andamento (várias requisições simultâneas).
- O `Logger` marca a exceção como registrada, para o tratador do Express não gravá-la duas vezes.

---

## 2. Funcionalidades

- **Conta:** cadastro, login, logout, edição do perfil, status de presença, troca de senha e exclusão
  da conta (com confirmação de senha e remoção em cascata).
- **Usuários:** listagem paginada, busca por nome/apelido/e-mail e perfil público.
- **Contatos (agenda):** adicionar (por e-mail ou pela lista de usuários), filtrar
  (todos/favoritos/bloqueados), apelidar, favoritar, bloquear e remover.
- **Conversas:** conversa privada (reaproveita a existente), grupos com administradores, editar
  nome/descrição/ícone, adicionar e remover participantes, sair do grupo e excluir conversa.
- **Mensagens:** enviar texto ou mídia (anexo por URL), responder, editar, fixar, reagir com emoji,
  apagar para todos (exclusão lógica) ou excluir definitivamente; controle de não lidas; busca por
  texto (índice `$text`).
- **Painel e estatísticas:** conversas recentes, não lidas, agenda, rankings (agregações `$lookup`/`$group`).

## 3. Entidades e coleções

| Classe | Coleção | Campos principais |
| --- | --- | --- |
| `Usuario` | `usuarios` | nome, email (único), senhaHash (scrypt), apelido, telefone, avatar, recado, status |
| `Contato` | `contatos` | usuarioId → dono da agenda, contatoId → usuário salvo, apelido, favorito, bloqueado |
| `Conversa` | `conversas` | tipo (privada/grupo), participantes, administradores, nome, descricao, ultimaMensagem |
| `Mensagem` | `mensagens` | conversaId, autorId, conteudo, tipo, anexo, respostaA, lidaPor, editada, excluida, fixada |
| `Reacao` | `reacoes` | mensagemId, usuarioId, emoji (índice único: um emoji por usuário por mensagem) |

Todas herdam de `Modelo` (classe abstrata com inserir, consultar, atualizar, excluir, contar e agregar).

---

## 4. Organização dos arquivos (MVC)

```
zapchat2/
├── app.js                  # aplicação Express: middlewares, sessão, rotas, erros
├── bin/www                 # sobe o servidor HTTP (formato do express-generator)
├── package.json
├── .env.example            # configuração opcional
├── public/stylesheets/     # CSS
├── logs/                   # errors.log e app.log (gerados na execução)
├── scripts/                # setup, seed e reset do banco
└── src/
    ├── models/             # MODEL  - entidades + acesso ao MongoDB (Projeto 1)
    ├── services/           # MODEL  - ChatService: regras entre coleções (Projeto 1)
    ├── views/              # VIEW   - templates EJS (partials/, autenticacao/, conversas/...)
    ├── controllers/        # CONTROLLER - leem req.query/params/body, chamam o Model, renderizam a view
    ├── routes/             # URL + método HTTP → controller
    ├── middlewares/        # sessão/login, avisos, conexão com o banco, tratamento de erros
    ├── database/           # conexão Singleton e índices (Projeto 1)
    ├── errors/             # exceções da aplicação
    ├── config/             # configuração (lê o .env com o módulo fs)
    └── utils/              # Logger, Validador, Seguranca, Formulario, RespostaErro, Formatacao
```

Fluxo de uma requisição:

```
navegador → rota (src/routes) → middleware exigirLogin → controller → Model (entidade / ChatService) → MongoDB
                                                              ↓
                                                   view EJS (src/views) → HTML
```

Os controllers não acessam o MongoDB diretamente, e as views não conhecem banco nem entidades: só
recebem dados prontos.

---

## 5. Dependências

| Pacote | Uso | Onde foi visto |
| --- | --- | --- |
| `express` | framework Web, rotas, parâmetros GET/POST | semanas 9 e 10 |
| `ejs` | templates das páginas (`app.set('view engine', 'ejs')`) | semana 9 (templates) |
| `express-session` | sessão do usuário logado | semana 11 (Sessions) |
| `cookie-parser` | leitura do cookie "lembrar meu e-mail" | semana 11 (Cookies) · gerado pelo express-generator |
| `morgan` | log das requisições no terminal | gerado pelo express-generator |
| `http-errors` | erro 404 das rotas inexistentes | gerado pelo express-generator |
| `mongodb` | MongoDB Driver (mesmo do Projeto 1) | semana 6 |
| `nodemon` (dev) | reinicia o servidor ao salvar (`npm run dev`) | semana 9 |

O hash de senha (`crypto`), a leitura do `.env` (`fs`) e os logs (`fs`) continuam com módulos nativos.
Requer **Node.js 18+** (testado no Node 24).

---

## 6. Configuração do MongoDB

É preciso um **MongoDB 5+ rodando em `localhost:27017`**.

- **Windows:** `winget install MongoDB.Server` (ou o instalador MSI). Para conferir:
  `Get-Service MongoDB` → `Running`. Se estiver parado: `net start MongoDB` (como administrador).
- **Linux:** `sudo systemctl start mongod` · **macOS:** `brew services start mongodb-community`.

Não é preciso configurar mais nada: a aplicação usa o banco **`zapchat2`** e cria as coleções e os
índices ao iniciar. Para mudar porta, URI, banco ou a chave da sessão, copie `.env.example` para
`.env` e ajuste:

```env
PORTA=3000
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=zapchat2
SESSAO_SEGREDO=troque-esta-chave
SESSAO_MINUTOS=120
LOG_NIVEL=INFO
```

---

## 7. Instalação e execução

```bash
cd zapchat2
npm install        # instala as dependências (node_modules não vai na entrega)
npm run seed       # carrega os dados de exemplo
npm start          # http://localhost:3000
```

| Comando | O que faz |
| --- | --- |
| `npm start` | inicia o servidor (`node ./bin/www`) |
| `npm run dev` | inicia com **nodemon** (reinicia ao salvar arquivos) |
| `npm run seed` | limpa o banco e carrega os dados de exemplo |
| `npm run setup` | só cria as coleções e os índices |
| `npm run reset` | esvazia as coleções |

Após o `seed`: **5 usuários, 9 contatos, 4 conversas, 15 mensagens e 5 reações**.
Senha de todos: **`senha123`** — `ana@zapchat.dev`, `bruno@zapchat.dev`, `carla@zapchat.dev`,
`diego@zapchat.dev`, `eva@zapchat.dev`.

---

## 8. Login, sessão e funcionalidades protegidas

| Etapa | Como funciona | Onde está |
| --- | --- | --- |
| Identificação e credenciais | formulário `POST /login` com e-mail e senha | `AutenticacaoController.entrar` |
| Verificação | `Usuario.autenticar` compara a senha com o **hash scrypt** (nunca em texto puro) | `src/models/Usuario.js` |
| Criação da sessão | `req.session.regenerate()` + `req.session.usuario = {...}`; o navegador recebe só o cookie `zapchat.sid` (`httpOnly`, `sameSite=lax`, 2 h) | `src/controllers/Controlador.js` |
| Verificação antes das rotas | middleware `exigirLogin` confere a sessão **e** se o usuário ainda existe no banco | `src/middlewares/autenticacao.js` |
| Sem sessão | página → redireciona ao login com aviso e, após entrar, volta à página pedida; JSON → `401` | `src/middlewares/erros.js` |
| Logout | `POST /logout` → status `offline`, `req.session.destroy()` e remoção do cookie | `AutenticacaoController.sair` |
| Cookie (preferência) | "Lembrar meu e-mail" grava o cookie `ultimoEmail` para preencher o login | `AutenticacaoController` |

**Roteiro para testar o login:**

1. Acesse `http://localhost:3000/painel` sem estar logado → vai para `/login` com o aviso
   "Voce precisa entrar no ZapChat...".
2. Entre com senha errada → "E-mail ou senha incorretos" (HTTP 401). Deixe tudo em branco → campos
   obrigatórios (HTTP 400).
3. Entre como `ana@zapchat.dev` / `senha123`, marcando "Lembrar meu e-mail" → painel da Ana.
4. Navegue pelas páginas (todas protegidas). Abra uma aba anônima e cole o endereço de uma conversa →
   redireciona ao login.
5. Clique em **Sair** → volta ao login com o e-mail preenchido pelo cookie; `/painel` volta a exigir login.
6. Entre como `bruno@zapchat.dev` e tente `Configurar grupo` no grupo da Ana (`/conversas/<id>/editar`)
   → **403 — Somente administradores**. Tente abrir o grupo "Amigos da faculdade" logado como Ana → **403**.

---

## 9. Rotas

Todas as rotas, exceto login e cadastro, exigem sessão. Como formulários HTML só enviam GET e POST,
atualização e exclusão usam `POST /recurso/atualizar` e `POST /recurso/excluir` (como no exemplo do enunciado).

| Método | Rota | Parâmetros | Funcionalidade |
| --- | --- | --- | --- |
| GET | `/` | — | redireciona ao painel ou ao login |
| GET | `/login` | query `motivo` | formulário de login |
| POST | `/login` | body `email`, `senha`, `lembrar` | autentica e cria a sessão |
| GET | `/cadastro` | — | formulário de cadastro |
| POST | `/cadastro` | body `nome`, `email`, `senha`, `confirmacao`, `apelido`, `telefone` | cadastra usuário |
| POST | `/logout` | — | encerra a sessão |
| GET | `/painel` | — | conversas recentes, não lidas, agenda |
| GET | `/estatisticas` | — | totais e rankings |
| GET | `/usuarios` | query `busca`, `pagina` | consultar usuários |
| GET | `/usuarios/:id` | params `id` | consultar um usuário |
| GET | `/perfil` | — | meu perfil |
| POST | `/perfil/atualizar` | body `nome`, `apelido`, `telefone`, `avatar`, `recado` | atualizar perfil |
| POST | `/perfil/status` | body `status` | alterar presença |
| POST | `/perfil/senha` | body `senhaAtual`, `novaSenha`, `confirmacao` | alterar senha |
| POST | `/perfil/excluir` | body `senha` | excluir a conta |
| GET | `/contatos` | query `filtro` (`todos`, `favoritos`, `bloqueados`) | consultar a agenda |
| POST | `/contatos` | body `email` **ou** `contatoId`, `apelido`, `favorito` | cadastrar contato |
| GET | `/contatos/:id/editar` | params `id` | formulário de edição |
| POST | `/contatos/atualizar` | body `id`, `apelido`, `favorito`, `bloqueado` | atualizar contato |
| POST | `/contatos/excluir` | body `id` | excluir contato |
| GET | `/conversas` | — | consultar conversas |
| GET | `/conversas/:id` | params `id`; query `limite`, `responder` | abrir conversa (marca como lidas) |
| POST | `/conversas/privada` | body `destinatarioId` | abrir conversa privada |
| GET | `/conversas/novo` | — | formulário de grupo |
| POST | `/conversas` | body `nome`, `descricao`, `icone`, `participantes[]` | cadastrar grupo |
| GET | `/conversas/:id/editar` | params `id` | configurar grupo (admin) |
| POST | `/conversas/atualizar` | body `id`, `nome`, `descricao`, `icone` | atualizar grupo |
| POST | `/conversas/participantes` | body `id`, `usuarioId` | adicionar participante |
| POST | `/conversas/participantes/remover` | body `id`, `usuarioId` | remover participante / sair |
| POST | `/conversas/excluir` | body `id` | excluir conversa |
| POST | `/mensagens` | body `conversaId`, `conteudo`, `tipo`, `anexoNome`, `anexoUrl`, `anexoTamanho`, `respostaA` | enviar mensagem |
| GET | `/mensagens/busca` | query `termo`, `conversaId` | buscar mensagens |
| GET | `/mensagens/:id/editar` | params `id` | formulário de edição (autor) |
| POST | `/mensagens/atualizar` | body `id`, `conteudo` | editar mensagem |
| POST | `/mensagens/excluir` | body `id`, `modo` (`todos` ou `definitivo`) | apagar / excluir |
| POST | `/mensagens/fixar` | body `id` | fixar / desafixar |
| POST | `/mensagens/reagir` | body `id`, `emoji` | adicionar / remover reação |

**Roteiro sugerido no navegador** (logado como Ana):

1. **GET com parâmetros:** `Usuários` → busque "bru" (`/usuarios?busca=bru`); `Contatos` →
   filtro favoritos (`/contatos?filtro=favoritos`); em uma conversa, clique em "Responder"
   (`/conversas/<id>?responder=<msg>`) ou "Carregar anteriores" (`?limite=60`); `Buscar` → "MongoDB".
2. **CRUD de contato:** adicione `eva@zapchat.dev` → edite (marque bloqueado) → remova.
3. **CRUD de conversa:** `Conversas` → `+ Novo grupo` → marque Bruno e Carla → configure o grupo
   (renomear, adicionar/remover participante) → exclua.
4. **CRUD de mensagem:** envie uma mensagem → edite → reaja com 🔥 → fixe → "Apagar para todos" →
   "Excluir definitivamente". Envie uma mídia com tipo `imagem` e URL `https://...`.
5. **Validação:** envie mensagem vazia, crie grupo sem nome, cadastre com e-mail já usado
   (`ana@zapchat.dev`), use telefone `123` no perfil, ou acesse `/conversas/123` (id inválido) e
   `/conversas/aaaaaaaaaaaaaaaaaaaaaaaa` (inexistente).

**Testando como API (Postman / Thunder Client / curl):** as mesmas rotas aceitam corpo JSON
(`Content-Type: application/json`), e os erros respondem em JSON quando a requisição envia
`Accept: application/json`. Para manter a sessão, a ferramenta precisa guardar o cookie `zapchat.sid`:

```bash
curl -c sessao.txt -X POST -d "email=ana@zapchat.dev&senha=senha123" http://localhost:3000/login
curl -b sessao.txt "http://localhost:3000/usuarios?busca=bru"
curl -b sessao.txt -X POST -H "Content-Type: application/json" -d "{\"email\":\"eva@zapchat.dev\"}" http://localhost:3000/contatos
curl -H "Accept: application/json" http://localhost:3000/painel        # sem sessão → 401 em JSON
```

---

## 10. Validação, exceções e logs

**Validação no back-end** (nos Models, antes de acessar o banco): campos obrigatórios, formatos
(e-mail, telefone, senha com letras e números, URL do anexo, `ObjectId`), valores permitidos
(status, tipo de mensagem, emoji), tamanhos de texto e regras da temática. Os parâmetros GET também
são validados (`pagina`, `limite`, `filtro`). Os erros aparecem no próprio formulário ou como aviso
após o redirecionamento, sem expor detalhes internos.

| Situação | Exceção | HTTP |
| --- | --- | --- |
| Campo obrigatório ausente, dado ou identificador inválido | `ErroValidacao` | 400 |
| Login incorreto, acesso sem sessão | `ErroAutenticacao` | 401 |
| Registro de outro usuário (contato, mensagem, grupo, conversa alheia) | `ErroPermissao` | 403 |
| Registro inexistente / rota inexistente | `ErroNaoEncontrado` / 404 | 404 |
| Regra da temática (contato repetido, grupo com menos de 2) / e-mail duplicado | `ErroRegraNegocio` / `ErroBanco` 11000 | 409 |
| MongoDB fora do ar | `ErroConexao` | 503 |
| Falha do driver ou erro inesperado | `ErroBanco` / qualquer `Error` | 500 (mensagem genérica) |

O tratamento é centralizado em `src/middlewares/erros.js` (no Express 5, erros de controllers `async`
chegam automaticamente a ele). Se o MongoDB estiver desligado, **o servidor não cai**: mostra a página
"Banco de dados indisponível" e reconecta sozinho quando o serviço volta. `unhandledRejection` e
`uncaughtException` também são registrados (`bin/www`).

**Logs** em `logs/`: `errors.log` (exceções) e `app.log` (tudo: logins, logouts, inserções,
atualizações, exclusões, rotas inexistentes). Cada registro tem data/hora, nível, tipo, operação
(com a rota HTTP), mensagem, detalhes e stack:

```
[16/11/2026 22:20:10]
NIVEL: ERRO
TIPO: ErroAutenticacao
OPERACAO: autenticacao.exigirLogin | GET /painel
MENSAGEM: Voce precisa entrar no ZapChat para acessar esta funcionalidade
DETALHES: {"rota":"GET /painel","ip":"::1"}
```

---

## 11. Mapa da rubrica

| Critério | Onde ver |
| --- | --- |
| Continuidade do Projeto 1 | seção 1; `src/models`, `src/services`, `src/errors`, `src/utils` vieram do ZapChat |
| Rotas Express | `src/routes/` (seção 9) |
| Parâmetros GET/POST | `req.query`, `req.params` e `req.body` nos controllers; `src/utils/Formulario.js` |
| MongoDB e CRUD | 5 coleções com cadastro, consulta, atualização e exclusão pelas rotas |
| MVC | `src/models` + `src/services` / `src/views` / `src/controllers` (seção 4) |
| Login, autenticação e sessões | seção 8 |
| Validação e mensagens de erro | seção 10 |
| Exceções, logs e documentação | seção 10 e este README |

> A pasta `node_modules` não faz parte da entrega — rode `npm install`.
