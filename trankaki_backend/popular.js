/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const csv = require('csv-parser');

// -------------------------------------------------------------------
// ⚠️ COLOQUE A SUA CONNECTION STRING DO NEON AQUI
// (Encontre em: Neon -> Dashboard -> Connection Details -> Connection string)
// -------------------------------------------------------------------
const connectionString = 'postgresql://neondb_owner:npg_TQRa1SWw5KlN@ep-soft-dew-aeznnvvq-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'; 
// Ex: "postgresql://user:password@host.neon.tech/trankaki?sslmode=require"
// -------------------------------------------------------------------

if (connectionString === 'SUA_CONNECTION_STRING_AQUI') { 
  console.error('ERRO: Por favor, edite o ficheiro "popular.js" e insira a sua connection string do Neon.');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
});

/**
 * Função genérica para ler um CSV e inserir no banco de dados.
 */
async function processarCSV(filePath, tableName, processRowCallback = null) {
  const client = await pool.connect();
  console.log(`\n--- Processando ${tableName} ---`);
  
  const stream = fs.createReadStream(filePath).pipe(csv());
  let count = 0;

  try {
    await client.query('BEGIN');

    for await (const row of stream) {
      let processedRow = row;
      
      // Aplica a função de correção específica se ela existir
      if (processRowCallback) {
        processedRow = processRowCallback(row);
      }
      
      // Limpa valores vazios para NULL
      Object.keys(processedRow).forEach(key => {
        if (processedRow[key] === '' || processedRow[key] === 'NULL') {
          processedRow[key] = null;
        }
      });

      const columns = Object.keys(processedRow).join(', ');
      const placeholders = Object.keys(processedRow).map((_, i) => `$${i + 1}`).join(', ');
      const values = Object.values(processedRow);

      const query = `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders})`;

      try {
        await client.query(query, values);
        count++;
      } catch (insertError) {
        console.error(`Erro ao inserir linha em ${tableName}:`, processedRow);
        console.error('Erro SQL:', insertError.message);
        throw insertError; // Interrompe se houver erro
      }
    }

    await client.query('COMMIT');
    console.log(`✅ Sucesso! ${count} linhas inseridas em ${tableName}.`);
  
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`❌ FALHA ao processar ${tableName}. Rollback realizado.`, error.message);
  } finally {
    client.release();
  }
}

/**
 * * ESTA É A FUNÇÃO QUE CORRIGE O SEU PROBLEMA
 * * Remove as aspas simples (') extras no final das colunas nome e cargo.
 */
function corrigirFuncionario(row) {
  // O ficheiro CSV tem os nomes das colunas entre aspas, ex: '"nome"'
  // O parser pode ler essas aspas, então tratamos os dois casos.
  const nomeKey = row['"nome"'] ? '"nome"' : 'nome';
  const cargoKey = row['"cargo"'] ? '"cargo"' : 'cargo';

  // Copia a linha para não modificar a original
  const newRow = { ...row };

  // Remove a aspa simples (') extra do final, se existir
  if (newRow[nomeKey] && newRow[nomeKey].endsWith("'")) {
    newRow[nomeKey] = newRow[nomeKey].slice(0, -1);
  }
  if (newRow[cargoKey] && newRow[cargoKey].endsWith("'")) {
    newRow[cargoKey] = newRow[cargoKey].slice(0, -1);
  }
  
  // Remove as aspas duplas das chaves (se o parser as incluiu)
  // O resultado final deve ser { id: '1', matricula: '1001', nome: 'Carlos Silva', cargo: 'Gerente de Manutenção' }
  const cleanedRow = {};
  for (const key in newRow) {
    const cleanedKey = key.replace(/"/g, ''); // Remove " de "nome"
    cleanedRow[cleanedKey] = newRow[key];
  }

  return cleanedRow;
}


/**
 * Função principal que executa a população na ordem correta
 * para respeitar as Chaves Estrangeiras (Foreign Keys).
 */
async function popularBanco() {
  console.log('Iniciando população do banco de dados "trankaki"...\n');

  try {
    // Nível 1 (Sem dependências)
    await processarCSV(path.join(__dirname, 'usuario.csv'), 'usuario');
    await processarCSV(path.join(__dirname, 'praia.csv'), 'praia');
    
    // Nível 2 (Dependem de Nível 1)
    // Aplicamos a função de correção aqui!
    await processarCSV(path.join(__dirname, 'funcionario.csv'), 'funcionario', corrigirFuncionario); 
    await processarCSV(path.join(__dirname, 'cartao_credito.csv'), 'cartao_credito');
    await processarCSV(path.join(__dirname, 'notificacao.csv'), 'notificacao');
    await processarCSV(path.join(__dirname, 'armario.csv'), 'armario');

    // Nível 3 (Dependem de Nível 2)
    await processarCSV(path.join(__dirname, 'pagamento.csv'), 'pagamento');
    await processarCSV(path.join(__dirname, 'aluguel.csv'), 'aluguel');
    await processarCSV(path.join(__dirname, 'avaliacao.csv'), 'avaliacao');
    await processarCSV(path.join(__dirname, 'manutencao.csv'), 'manutencao');

    // Nível 4 (Dependem de Nível 3)
    await processarCSV(path.join(__dirname, 'multa.csv'), 'multa');

    console.log('\n-----------------------------------------------');
    console.log('🎉 FASE 1 CONCLUÍDA! Banco de dados populado com sucesso!');
    console.log('-----------------------------------------------\n');

  } catch (error) {
    console.error('\nErro fatal durante a população:', error.message);
  } finally {
    await pool.end();
    console.log('Conexão com o banco de dados encerrada.');
  }
}

// Executa a função principal
popularBanco();