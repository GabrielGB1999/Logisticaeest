import { resolve, dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

console.log("__filename:", __filename)
console.log("__dirname:", __dirname)

let filePath = resolve(__dirname, '../../alumnos.xlsx')
console.log("filePath 1:", filePath, "exists:", existsSync(filePath))

let filePath2 = resolve(__dirname, '../alumnos.xlsx')
console.log("filePath 2:", filePath2, "exists:", existsSync(filePath2))

let filePath3 = resolve(process.cwd(), 'alumnos.xlsx')
console.log("filePath 3:", filePath3, "exists:", existsSync(filePath3))
