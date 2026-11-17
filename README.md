# 💬 ZapChat 2

Projeto 2 de EC48B - Programação Web Back-End

- Temática: mensagens instantâneas
- Integrante: Gian Pedro Rodrigues (RA 2503638)

## Sobre o projeto

O ZapChat 2 é a continuação do ZapChat do Projeto 1. No primeiro projeto o sistema rodava pelo
terminal; agora ele roda no navegador, usando Express.js, páginas feitas com EJS e login com sessão.
O banco continua sendo o MongoDB, acessado pelo MongoDB Driver.

As classes do Projeto 1 (entidades, CRUD, validação, erros e log) foram reaproveitadas. O que foi
adicionado é a parte Web: rotas, controllers, views e o controle de login.

## Funcionalidades

- Criar conta, entrar e sair
- Editar perfil, mudar status, trocar senha e excluir a conta
- Buscar usuários e ver o perfil deles
- Agenda de contatos: adicionar, editar apelido, favoritar, bloquear e remover
- Conversas privadas e grupos (com administradores e participantes)
- Mensagens de texto ou com link de mídia, respostas, edição, reações, fixar e excluir
- Busca de mensagens
- Painel com conversas recentes e mensagens não lidas, e uma página de estatísticas

## Como executar

É preciso ter o Node.js (versão 18 ou mais nova) e o MongoDB instalados.

1. Verifique se o MongoDB está rodando. No Windows, abra o PowerShell e rode `Get-Service MongoDB`.
   Se aparecer `Stopped`, rode `net start MongoDB` como administrador. Se o MongoDB não estiver
   instalado, dá para instalar com `winget install MongoDB.Server`.

2. Dentro da pasta do projeto, instale as dependências e carregue os dados de exemplo:

   ```bash
   npm install
   npm run seed
   ```

3. Inicie o servidor:

   ```bash
   npm start
   ```

4. Acesse http://localhost:3000 e entre com um dos usuários de exemplo. Todos usam a senha `senha123`:
   `ana@zapchat.dev`, `bruno@zapchat.dev`, `carla@zapchat.dev`, `diego@zapchat.dev` e `eva@zapchat.dev`.

Não precisa configurar nada. O sistema usa o MongoDB em `mongodb://localhost:27017`, cria o banco
`zapchat2` e os índices sozinho. Se precisar mudar a porta ou o endereço do banco, copie o arquivo
`.env.example` para `.env` e altere os valores.

Outros comandos:

- `npm run dev`: inicia com o nodemon, que reinicia o servidor quando um arquivo é salvo
- `npm run seed`: apaga os dados e carrega os dados de exemplo de novo
- `npm run reset`: apaga todos os dados

## Como testar

### Login e sessão

1. Sem estar logado, acesse http://localhost:3000/painel. O sistema volta para a tela de login, porque
   essa página é protegida.
2. Tente entrar com `ana@zapchat.dev` e uma senha errada. Aparece a mensagem "E-mail ou senha incorretos".
3. Clique em Entrar com os campos vazios. Aparece o aviso de campos obrigatórios.
4. Entre com `ana@zapchat.dev` e `senha123`, marcando a opção "Lembrar meu e-mail".
5. Clique em Sair, no topo da página. A sessão é encerrada e, na tela de login, o e-mail já vem
   preenchido (isso é feito com um cookie). Se tentar abrir o painel de novo, o sistema pede login.

### Parâmetros GET

Alguns exemplos de páginas que recebem dados pela URL:

- Usuários, buscando por "bru": `/usuarios?busca=bru`
- Contatos favoritos: `/contatos?filtro=favoritos`
- Busca de mensagens: `/mensagens/busca?termo=MongoDB`
- Perfil de um usuário: `/usuarios/<id>`
- Responder uma mensagem: `/conversas/<id>?responder=<id da mensagem>`

### Parâmetros POST e CRUD

Os formulários enviam os dados por POST. Para testar o cadastro, a consulta, a atualização e a exclusão:

- Contatos: adicione `eva@zapchat.dev`, depois edite (por exemplo, marcando como bloqueado) e remova.
- Grupos: em Conversas, clique em "Novo grupo", escolha alguns contatos, depois abra "Configurar grupo"
  para mudar o nome e os participantes. No final, exclua o grupo.
- Mensagens: abra uma conversa, envie uma mensagem, edite, reaja, fixe e depois exclua.
- Perfil: altere os dados, o status e a senha na página do perfil.

### Validação e mensagens de erro

- Enviar uma mensagem vazia
- Criar um grupo sem nome ou sem participantes
- Criar uma conta com um e-mail que já existe (`ana@zapchat.dev`)
- Colocar o telefone `123` no perfil
- Abrir `/conversas/123` (identificador inválido)
- Logado como Ana, abrir o grupo "Amigos da faculdade", do qual ela não participa
- Logado como Bruno, tentar configurar o grupo "Trabalho de Web Back-End", que é da Ana

Em todos esses casos o sistema mostra o motivo do erro. Os erros também ficam registrados no arquivo
`logs/errors.log`.

## Login e sessão

O login usa o `express-session`:

1. O usuário envia o e-mail e a senha pelo formulário (POST `/login`).
2. O sistema busca o usuário no banco e compara a senha com o hash salvo. A senha nunca fica gravada
   em texto puro; ela é guardada como hash, usando o módulo `crypto` do Node.
3. Se a senha estiver certa, os dados do usuário são guardados na sessão (`req.session.usuario`). O
   navegador recebe só um cookie com o identificador da sessão.
4. As rotas protegidas passam pelo middleware `exigirLogin`, que verifica se existe um usuário na
   sessão. Se não existir, o usuário é levado para o login.
5. No logout (POST `/logout`), a sessão é destruída e o cookie é apagado.

Além da sessão, o projeto usa um cookie simples (`ultimoEmail`) para lembrar o e-mail do último login.

## Organização dos arquivos

O projeto foi organizado em MVC, a partir da estrutura criada pelo express-generator:

```
zapchat2/
  app.js           configuração do Express
  bin/www          inicia o servidor
  public/          arquivos estáticos (CSS)
  logs/            arquivos de log
  scripts/         seed, setup e reset do banco
  src/
    models/        Model: entidades e acesso ao MongoDB
    services/      Model: regras que usam mais de uma coleção
    views/         View: páginas EJS
    controllers/   Controller: recebem a requisição, chamam o Model e mostram a view
    routes/        rotas do Express
    middlewares/   login, avisos, conexão com o banco e tratamento de erros
    database/      conexão com o MongoDB
    errors/        classes de erro
    utils/         log, validação, senha e funções auxiliares
```

Uma requisição passa pela rota, depois pelo middleware de login, chega no controller, que usa o model
para acessar o MongoDB e no final renderiza a view.

## O que veio do Projeto 1

As pastas `models`, `services`, `database`, `errors` e `utils` vieram do Projeto 1. Algumas coisas
foram ajustadas para funcionar na Web (os trechos estão marcados com "Projeto 2" nos comentários):

- dois erros novos: `ErroAutenticacao`, para login, e `ErroPermissao`, para quando alguém tenta mexer
  em algo que não é dele;
- verificações para que cada usuário só altere os próprios contatos, mensagens e grupos;
- a URL de anexo agora precisa começar com `http://` ou `https://`;
- correção no índice do apelido, que no Projeto 1 impedia dois usuários sem apelido de se cadastrarem.

## Entidades

| Classe | Coleção | Dados principais |
| --- | --- | --- |
| Usuario | usuarios | nome, e-mail, senha (hash), apelido, telefone, avatar, status |
| Contato | contatos | agenda de cada usuário (apelido, favorito, bloqueado) |
| Conversa | conversas | conversa privada ou grupo, participantes e administradores |
| Mensagem | mensagens | conteúdo, autor, tipo, anexo, resposta, leitura, edição |
| Reacao | reacoes | emoji que um usuário colocou em uma mensagem |

Todas as entidades herdam da classe `Modelo`, que tem os métodos de inserir, consultar, atualizar e excluir.

## Rotas

Só `/login` e `/cadastro` funcionam sem login. Como formulário HTML só envia GET ou POST, as rotas de
atualizar e excluir usam POST.

| Método | Rota | O que faz |
| --- | --- | --- |
| GET / POST | `/login` | tela de login / entrar |
| GET / POST | `/cadastro` | tela de cadastro / criar conta |
| POST | `/logout` | sair |
| GET | `/painel` | painel inicial |
| GET | `/estatisticas` | estatísticas |
| GET | `/usuarios` | lista e busca de usuários (`?busca=` e `?pagina=`) |
| GET | `/usuarios/:id` | perfil de um usuário |
| GET | `/perfil` | meu perfil |
| POST | `/perfil/atualizar`, `/perfil/status`, `/perfil/senha`, `/perfil/excluir` | alterações no perfil |
| GET | `/contatos` | agenda (`?filtro=todos`, `favoritos` ou `bloqueados`) |
| POST | `/contatos` | adicionar contato |
| GET | `/contatos/:id/editar` | editar contato |
| POST | `/contatos/atualizar`, `/contatos/excluir` | atualizar / remover contato |
| GET | `/conversas` | lista de conversas |
| GET | `/conversas/:id` | abrir conversa (`?limite=` e `?responder=`) |
| POST | `/conversas/privada` | abrir conversa privada |
| GET / POST | `/conversas/novo`, `/conversas` | criar grupo |
| GET | `/conversas/:id/editar` | configurar grupo |
| POST | `/conversas/atualizar`, `/conversas/participantes`, `/conversas/participantes/remover`, `/conversas/excluir` | alterar grupo, participantes e excluir conversa |
| POST | `/mensagens` | enviar mensagem |
| GET | `/mensagens/busca` | buscar mensagens (`?termo=` e `?conversaId=`) |
| GET | `/mensagens/:id/editar` | editar mensagem |
| POST | `/mensagens/atualizar`, `/mensagens/excluir`, `/mensagens/fixar`, `/mensagens/reagir` | editar, excluir, fixar e reagir |

As rotas também aceitam dados em JSON, então dá para testar pelo Postman ou Thunder Client. Para isso,
faça primeiro o POST `/login` (a ferramenta guarda o cookie da sessão) e depois chame as outras rotas.

## Erros e logs

Os dados são validados no back-end antes de qualquer operação no banco. Cada tipo de erro tem uma
mensagem e um código HTTP: 400 para dados inválidos, 401 sem login, 403 sem permissão, 404 quando o
registro não existe, 409 quando uma regra é violada e 503 quando o MongoDB está fora do ar.

Se o MongoDB parar, o servidor não cai: ele mostra uma página avisando que o banco está indisponível e
volta a funcionar quando o banco voltar.

Os logs ficam na pasta `logs`. O `errors.log` guarda só os erros e o `app.log` guarda tudo (inclusive
logins e logouts). Cada registro tem a data, a hora, a operação e a mensagem. Exemplo:

```
[16/11/2026 22:20:10]
NIVEL: ERRO
TIPO: ErroAutenticacao
OPERACAO: autenticacao.exigirLogin | GET /painel
MENSAGEM: Voce precisa entrar no ZapChat para acessar esta funcionalidade
```

## Dependências

- `express`: servidor e rotas
- `ejs`: templates das páginas
- `express-session`: sessão do usuário
- `cookie-parser`: leitura de cookies
- `mongodb`: MongoDB Driver
- `morgan`: mostra as requisições no terminal
- `http-errors`: erro 404
- `nodemon` (desenvolvimento): reinicia o servidor automaticamente

O `cookie-parser`, o `morgan` e o `http-errors` vêm na estrutura criada pelo express-generator. A pasta
`node_modules` não vai na entrega; ela é criada pelo `npm install`.
