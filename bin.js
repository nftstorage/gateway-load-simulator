#!/usr/bin/env node
import path from 'path'
import dotenv from 'dotenv'
import sade from 'sade'
import { fileURLToPath } from 'url'

import { loadTestFromWeb3, loadTest } from './src/index.js'
import { split } from './src/split.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const prog = sade('db-migration')

dotenv.config({
  path: path.join(__dirname, '/.env.local')
})

prog
  .command('start-w3 <cid> <fileName>')
  .describe('Start gateway load test from a file in web3.storage')
  .action(loadTestFromWeb3)
  .command('start <csvPath>')
  .describe('Start gateway load test from local file')
  .action(loadTest)
  .command('split <csvPath> <number>')
  .describe('Split csv file into multiple files and add them to web3.storage')
  .action(split)

prog.parse(process.argv)
