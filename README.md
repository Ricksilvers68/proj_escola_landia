# Controle de Alunos - Escola Prof. Landia Santos Batista

### 📋 Descrição
Esta é uma aplicação de *CRUD de Alunos* com autenticação simples, criada em *Node.js, **Express, **EJS, **MySQL* e *Bootstrap*.  
Possibilita:
- Adição, edição e remoção de alunos.
- Busca por nome e RA.
- Registro de entrada de alunos (com horário registrado).
- Página de login para restringir acesso à área principal.

---

## ⚡ Funcionalidades
- ✅ CRUD de alunos (nome, RA, data de nascimento)  
- ✅ Sistema de autenticação simples para acessar a área principal (index)  
- ✅ Busca de alunos por nome e RA  
- ✅ Registro de entrada de alunos e exibição de horários registrados  
- ✅ Estilização com *Bootstrap 4.5* e ícones do *Bootstrap Icons*

---

## 🛠 Tecnologias Utilizadas
- *Node.js* e *Express*
- *MySQL* (usando mysql2)
- *EJS* para as views
- *Bootstrap 4.5* para layout
- *Bootstrap Icons* para ícones
- *express-session* para controle de sessão

---

## 📁 Estrutura de Pastas

project/
├─ app.js
├─ package.json
├─ node_modules/
├─ public/
│  └─ style.css
├─ views/
│  └─ index.ejs
│  └─ login.ejs
│  └─ buscar.ejs
│  └─ resultado.ejs
├─ .gitignore
├─ README.md


---



bash
git https://github.com/seu-usuario/seu-repo.git



### 3️⃣ Configure o *MySQL*
- Crie o banco de dados e as tabelas:


## 👥 Acesso
✅ Acesse no navegador:

http://localhost:3000


✅ Faça login para acessar a área principal:
- *Usuário:* admin
- *Senha:* 7237

*(Edite para suas credenciais no arquivo app.js.)*

---

## 📷 Telas
- *Login:* Página para autenticação de usuários.
- *Index:* Lista de alunos cadastrados, com opção de adição e edição.
- *Buscar Aluno:* Página para verificar entradas e registros de alunos.

---

## 💡 Melhorias Futuras
- 🔐 Autenticação com hash de senha e armazenamento no BD.
- 📱 Melhor layout para dispositivos móveis.
- 📄 Exportação de relatórios para PDF.
- 👥 Níveis de permissão para diferentes tipos de usuário.

---