// Ficheiro: server.js

const express = require('express');
const cors = require('cors');
const { pool, query } = require('./db');

const app = express();
const port = process.env.PORT || 3000;

// --- Middlewares ---
app.use(express.json());
app.use(cors());

// --- ROTA 1: Disponibilidade (Busca Complexa) ---
app.get('/armarios/disponibilidade', async (req, res) => {
  try {
    const { praia, tamanho, status, inicio, fim } = req.query;
    
    let sqlQuery = `
      SELECT 
        a.id AS armario_id, 
        a.cod_armario, 
        a.tamanho, 
        a.status, 
        p.nome AS praia_nome, 
        p.cidade
      FROM armario a
      JOIN praia p ON a.praia_id = p.id
    `;
    
    const filtrosWhere = [];
    const valoresWhere = [];
    let i = 1; 

    if (praia && praia !== 'all') {
      filtrosWhere.push(`p.nome ILIKE $${i}`);
      valoresWhere.push(`%${praia}%`);
      i++;
    }
    if (tamanho && tamanho !== 'all') {
      filtrosWhere.push(`a.tamanho = $${i}`);
      valoresWhere.push(tamanho);
      i++;
    }
    if (status && status !== 'all') {
      filtrosWhere.push(`a.status = $${i}`);
      valoresWhere.push(status);
      i++;
    }

    if (inicio && fim) {
      filtrosWhere.push(`
        a.id NOT IN (
          SELECT DISTINCT al.armario_id
          FROM aluguel al
          WHERE al.status = 'ativo' AND (
            (al.data_inicio, al.data_fim) OVERLAPS (CAST($${i} AS TIMESTAMPTZ), CAST($${i+1} AS TIMESTAMPTZ))
          )
        )
      `);
      valoresWhere.push(inicio, fim);
      i += 2;
    }
    filtrosWhere.push(`a.status != 'Manutenção'`);

    if (filtrosWhere.length > 0) {
      sqlQuery += ` WHERE ${filtrosWhere.join(' AND ')}`;
    }
    
    sqlQuery += ` ORDER BY p.cidade, p.nome, a.cod_armario;`;

    const { rows } = await query(sqlQuery, valoresWhere);
    res.status(200).json(rows);

  } catch (error) {
    console.error('Erro em /armarios/disponibilidade:', error);
    res.status(500).json({ message: 'Erro ao buscar armários.', error: error.message });
  }
});

// --- ROTA 2: Criar Aluguel (Transacional) ---
app.post('/alugueis', async (req, res) => {
  const { usuario_id, armario_id, data_inicio, data_fim_prevista } = req.body;
  if (!usuario_id || !armario_id || !data_inicio || !data_fim_prevista) {
    return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN'); 
    const insertAluguelQuery = `
      INSERT INTO aluguel (usuario_id, armario_id, data_inicio, data_fim, status, valor)
      VALUES ($1, $2, $3, $4, 'ativo', $5)
      RETURNING *;
    `;
    const valorAluguel = 25.00; 
    const aluguelResult = await client.query(insertAluguelQuery, [usuario_id, armario_id, data_inicio, data_fim_prevista, valorAluguel]);
    const updateArmarioQuery = `
      UPDATE armario SET status = 'Ocupado' WHERE id = $1;
    `;
    await client.query(updateArmarioQuery, [armario_id]);
    await client.query('COMMIT'); 
    res.status(201).json(aluguelResult.rows[0]); 
  } catch (error) {
    await client.query('ROLLBACK'); 
    console.error('Erro na transação de /alugueis:', error);
    res.status(500).json({ message: 'Erro ao criar aluguel.', error: error.message });
  } finally {
    client.release(); 
  }
});

// --- ROTA 3: Encerrar Aluguel POR CÓDIGO DO ARMÁRIO ---
app.post('/alugueis/encerrar-por-codigo', async (req, res) => {
  const { cod_armario, data_fim_real } = req.body;
  if (!cod_armario || !data_fim_real) {
    return res.status(400).json({ message: 'O cod_armario e a data_fim_real são obrigatórios.' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const aluguelRes = await client.query(
      `SELECT al.* FROM aluguel al
       JOIN armario a ON al.armario_id = a.id
       WHERE a.cod_armario = $1 AND al.status = 'ativo'
       LIMIT 1;`,
      [cod_armario]
    );

    if (aluguelRes.rows.length === 0) {
      return res.status(404).json({ message: 'Nenhum aluguel ativo encontrado para este código de armário.' });
    }
    
    const aluguel = aluguelRes.rows[0];
    const { id: aluguel_id, armario_id, data_fim: data_fim_prevista, valor: valor_aluguel } = aluguel;

    const updateAluguelQuery = `
      UPDATE aluguel 
      SET data_fim_real = $1, status = 'encerrado', valor_final = $2
      WHERE id = $3 
      RETURNING *;
    `;
    const aluguelEncerradoRes = await client.query(updateAluguelQuery, [data_fim_real, valor_aluguel, aluguel_id]);

    let multaCriada = null;
    const dataFimPrevistaDT = new Date(data_fim_prevista);
    const dataFimRealDT = new Date(data_fim_real);

    if (dataFimRealDT > dataFimPrevistaDT) {
      const valorMulta = 10.00; 
      
      // CORRIGIDO: A coluna é 'data'
      const insertPgQuery = `
        INSERT INTO pagamento (data, valor, status, usuario_id, alvo) 
        VALUES (NOW(), $1, 'Em Aberto', $2, 'multa') RETURNING id;
      `;
      const pgResult = await client.query(insertPgQuery, [valorMulta, aluguel.usuario_id]);
      const pagamento_id = pgResult.rows[0].id;

      const insertMultaQuery = `
        INSERT INTO multa (valor, pagamento_id, aluguel_id) 
        VALUES ($1, $2, $3) RETURNING *;
      `;
      const multaResult = await client.query(insertMultaQuery, [valorMulta, pagamento_id, aluguel_id]);
      multaCriada = multaResult.rows[0];
    }

    await client.query("UPDATE armario SET status = 'Disponível' WHERE id = $1;", [armario_id]);
    await client.query('COMMIT');

    res.status(200).json({
      aluguel: aluguelEncerradoRes.rows[0],
      multa: multaCriada,
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Erro em /alugueis/encerrar-por-codigo:`, error);
    res.status(500).json({ message: 'Erro ao encerrar aluguel.', error: error.message });
  } finally {
    client.release();
  }
});


// --- ROTA 4: Listar Pagamentos ---
app.get('/pagamentos', async (req, res) => {
  try {
const sqlQuery = `
      SELECT 
        p.id, 
        p.usuario_id, 
        p.valor,
        p.data::TIMESTAMPTZ AS data_pagamento,
        p.alvo, 
        CASE 
          WHEN p.status = 'Concluído' THEN 'pago'
          ELSE 'em_aberto'
        END as status
      FROM pagamento p
      ORDER BY p.data DESC 
      LIMIT 100;
    `;
    const { rows } = await query(sqlQuery);
    res.status(200).json(rows);
  } catch (error) {
    console.error('Erro em /pagamentos:', error);
    res.status(500).json({ message: 'Erro ao buscar pagamentos.', error: error.message });
  }
});

// --- ROTA 5: Criar Pagamento (CORRIGIDA) ---
app.post('/pagamentos', async (req, res) => {
  const { usuario_id, valor, metodo, data_pagamento, alvo } = req.body;

  if (!usuario_id || !valor || !data_pagamento || !alvo) {
    return res.status(400).json({ message: 'Campos obrigatórios em falta.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const insertPgQuery = `
      INSERT INTO pagamento (data, valor, status, usuario_id, metodo, alvo) -- CORRIGIDO
      VALUES ($1, $2, 'Concluído', $3, $4, $5)
      RETURNING *;
    `;
    // Frontend envia 'data_pagamento', mas inserimos na coluna 'data'
    const pgResult = await client.query(insertPgQuery, [data_pagamento, valor, usuario_id, metodo, alvo]);
    const novoPagamento = pgResult.rows[0];

    await client.query('COMMIT');
    res.status(201).json(novoPagamento);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro em POST /pagamentos:', error);
    res.status(500).json({ message: 'Erro ao criar pagamento.', error: error.message });
  } finally {
    client.release();
  }
});

// --- ROTA 6: Relatório de Devedores ---
app.get('/relatorios/usuarios-devedores', async (req, res) => {
  try {
    const sqlQuery = `
      SELECT 
        u.id as usuario_id, 
        u.nome, 
        SUM(p.valor) as total_em_aberto
      FROM pagamento p
      JOIN usuario u ON u.id = p.usuario_id
      WHERE p.status = 'Em Aberto'
      GROUP BY u.id, u.nome
      ORDER BY total_em_aberto DESC;
    `;
    const { rows } = await query(sqlQuery);
    res.status(200).json(rows);
  } catch (error) {
    console.error('Erro em /relatorios/usuarios-devedores:', error);
    res.status(500).json({ message: 'Erro ao gerar relatório de devedores.', error: error.message });
  }
});

// --- ROTA 8: Listar Praias ---
app.get('/praias', async (req, res) => {
  try {
    const sqlQuery = `
      SELECT id, nome, cidade 
      FROM praia 
      ORDER BY cidade, nome;
    `;
    const { rows } = await query(sqlQuery);
    res.status(200).json(rows);
  } catch (error) {
    console.error('Erro em /praias:', error);
    res.status(500).json({ message: 'Erro ao buscar praias.', error: error.message });
  }
});

// --- ROTA 9: Listar Armários Ocupados ---
app.get('/armarios/ocupados', async (req, res) => {
  try {
    const sqlQuery = `
      SELECT 
        a.id, 
        a.cod_armario::TEXT, -- Força a ser TEXTO
        p.nome AS praia_nome
      FROM armario a
      JOIN praia p ON a.praia_id = p.id
      WHERE a.status = 'Ocupado'
      ORDER BY a.cod_armario;
    `;
    const { rows } = await query(sqlQuery);
    res.status(200).json(rows);
  } catch (error) {
    console.error('Erro em /armarios/ocupados:', error);
    res.status(500).json({ message: 'Erro ao buscar armários ocupados.', error: error.message });
  }
});

// --- ROTA 10: Listar Usuários ---
app.get('/usuarios', async (req, res) => {
  try {
    const sqlQuery = `
      SELECT 
        id, 
        nome, 
        cpf 
      FROM usuario 
      ORDER BY nome;
    `;
    const { rows } = await query(sqlQuery);
    res.status(200).json(rows);
  } catch (error) {
    console.error('Erro em /usuarios:', error);
    res.status(500).json({ message: 'Erro ao buscar usuários.', error: error.message });
  }
});


// --- Iniciar o Servidor ---
app.listen(port, () => {
  console.log(`🎉 Servidor "Trankaki" rodando em http://localhost:${port}`);
  console.log('Pressione CTRL+C para parar o servidor.');
});