# 🏖️ Trankaki – Sistema de Gestão de Armários de Praia

Projeto final desenvolvido para a disciplina **Banco de Dados II (Prof. Leo)**.  
O **Trankaki** é uma aplicação completa (front-end + back-end) para o controle de armários de praia, permitindo:

- Visualizar disponibilidade de armários
- Realizar e encerrar aluguéis
- Gerenciar pagamentos e multas
- Gerar relatórios de devedores

---

## 🚀 Tecnologias Utilizadas

### 🔹 Back-end
- **Node.js + Express**
- **PostgreSQL** (via `pg`)
- **CORS** e **Express JSON**
- Arquitetura RESTful

### 🔹 Front-end
- **React + TypeScript + Vite**
- **TailwindCSS + shadcn/ui**
- **Lucide Icons**
- **Sonner** (notificações)

---

## ⚙️ Configuração do Back-end

### 1. Executar servidor
```bash
node server.js
```

Por padrão, o servidor roda em [http://localhost:3000](http://localhost:3000)

---

## 🌐 Rotas Principais da API

| Método | Endpoint | Descrição |
|--------|-----------|------------|
| **GET** | `/armarios/disponibilidade` | Lista armários filtrando por praia, tamanho, status e período |
| **POST** | `/alugueis` | Cria um novo aluguel (transacional) |
| **POST** | `/alugueis/encerrar-por-codigo` | Encerra aluguel pelo código do armário, gera multa se necessário |
| **GET** | `/pagamentos` | Lista últimos pagamentos |
| **POST** | `/pagamentos` | Registra novo pagamento |
| **GET** | `/relatorios/usuarios-devedores` | Lista usuários com pagamentos em aberto |
| **GET** | `/praias` | Lista praias cadastradas |
| **GET** | `/armarios/ocupados` | Lista armários com aluguel ativo |
| **GET** | `/usuarios` | Lista usuários cadastrados |

---

## 💻 Configuração do Front-end


### 1. Executar a aplicação
```bash
npm run dev
```

Acesse em [http://localhost:5173](http://localhost:5173)

---

## 🧭 Funcionalidades

### 🔍 Aba “Disponibilidade”
- Busca armários por **praia, tamanho, status e período**
- Mostra **status em tempo real**
- Permite **iniciar aluguel**

### 💼 Aba “Aluguéis”
- Encerra aluguéis ativos com cálculo automático de **multas por atraso**
- Atualiza automaticamente o status do armário

### 💳 Aba “Pagamentos”
- Registra novos pagamentos (aluguel ou multa)
- Permite exportar lista para CSV

### 📊 Aba “Devedores”
- Gera relatório dos usuários com débitos pendentes
- Exporta para CSV

---

## 📸 Interface

A interface foi desenvolvida com **shadcn/ui** e **Tailwind**, priorizando clareza e responsividade.

---

## 🗂️ Estrutura do Projeto

```bash
TRANKAKI/
├── trankaki_backend/
│   ├── node_modules/
│   ├── db.js              # Conexão com o PostgreSQL (pool e query)
│   ├── popular.js         # Script opcional para popular o banco
│   ├── server.js          # Servidor Express + rotas REST
│   ├── package.json
│   └── package-lock.json
│
└── trankaki_frontend/
    ├── node_modules/
    ├── public/
    │   └── trankaki.svg   # Logo usada na aplicação
    ├── src/
    │   ├── assets/
    │   ├── components/    # Componentes de UI (Button, Card, etc.)
    │   ├── lib/
    │   ├── App.css
    │   ├── App.tsx        # Interface principal React
    │   ├── index.css
    │   └── main.tsx

```

## 👥 Autores

| Nome | Função |
|------|--------|
| **Equipe Trankaki** | Desenvolvimento e Integração |
| **Prof. Leo** | Orientação (BD II - UNESP) |

---

## 🧾 Licença
Este projeto é de uso acadêmico e livre para fins educacionais.

---

**© 2025 – Trankaki**
