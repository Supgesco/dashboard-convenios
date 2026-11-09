// Gera src/api/openapi.json (do FastAPI, sem banco) e src/api/schema.d.ts (openapi-typescript).
// Rode sempre que um modelo de resposta da API mudar: o tsc passa a apontar os usos quebrados.
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import openapiTS, { astToString } from 'openapi-typescript'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const destino = resolve(raiz, 'src/api')

const api = resolve(raiz, '../api')
const texto = execFileSync('uv', ['run', '--directory', api, 'python', resolve(raiz, 'scripts/openapi_dump.py')], {
  encoding: 'utf-8',
  env: { ...process.env, PYTHONPATH: api },
})
const schema = JSON.parse(texto)
writeFileSync(resolve(destino, 'openapi.json'), texto, 'utf-8')

const ast = await openapiTS(schema)
const cabecalho = '// Gerado por `npm run api:tipos` a partir do OpenAPI da API. Não edite à mão.\n\n'
writeFileSync(resolve(destino, 'schema.d.ts'), cabecalho + astToString(ast), 'utf-8')
console.log('Tipos gerados em src/api/openapi.json e src/api/schema.d.ts')
