import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'

import { loadTestFromWeb3 } from './load.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

dotenv.config({
  path: path.join(__dirname, '/../.env.local')
})

async function main () {
  const csvDirectoryCid = process.env.CSV_DIR_CID
  const csvFileName = process.env.CSV_FILE_NAME

  if (!csvDirectoryCid || !csvFileName) {
    throw new Error('Either directory CID or filename were not provided')
  }

  await loadTestFromWeb3(csvDirectoryCid, csvFileName)
}

main()
