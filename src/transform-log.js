import fs from 'fs'
import os from 'os'
import readLine from 'readline'
import { createObjectCsvWriter } from 'csv-writer'

import { normalizeCid } from './utils/cid.js'

const WRITER_BUFFER_SIZE = 100

export async function transformLog (logPath, { outputPath }) {
  const fileStream = fs.createReadStream(logPath)

  const rl = readLine.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  })

  outputPath = outputPath || `${os.tmpdir()}/${(parseInt(String(Math.random() * 1e9), 10)).toString()}`
  const outputFile = `${outputPath}/${Date.now()}.csv`
  await fs.promises.mkdir(outputPath)

  // Create csvWriters and writer buffer
  const csvWriter = createObjectCsvWriter({
    path: outputFile,
    header: [
      { id: 'ts', title: 'ts' },
      { id: 'cid', title: 'cid' },
      { id: 'path', title: 'path' }
    ]
  })
  let writerBuffer = []

  for await (const line of rl) {
    const ts = line.match(/\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\+[0-2]\d:[0-2]\d/)[0]

    let cid, path = ''
    // Is IPFS Path
    if (line.includes('GET /ipfs/')) {
      const ipfsPath = line.match(/ipfs\/[a-zA-Z0-9/]*/)

      if (ipfsPath) {
        cid = ipfsPath[0].split('/')[1]
        path = ipfsPath[0].split(`ipfs/${cid}`)[1] || ''
      }
      // console.log(`ipfs path --- cid: ${cid} --- path: ${path}`)
    } else if (line.includes('.ipfs.')) {
      const subdomainPath = line.match(/[a-zA-Z0-9/]+.ipfs.[a-zA-Z0-9/.]*/)

      if (subdomainPath) {
        cid = subdomainPath[0].split('.ipfs.')[0]
        path = subdomainPath[0].indexOf('/') >= 0 ? subdomainPath[0].substring(subdomainPath.indexOf('/')) : ''
      }
      // console.log(`subdomain path --- cid : ${cid} --- path: ${path}`)
    }

    if (ts && cid) {
      const nCid = normalizeCid(cid)
      nCid && writerBuffer.push({
        ts,
        cid: nCid,
        path
      })

      if (writerBuffer.length >= WRITER_BUFFER_SIZE) {
        await csvWriter.writeRecords(writerBuffer)
        writerBuffer = []
      }
    } else {
      console.log('--------------------------------------------')
      console.log(`invalid line from file: ${line}`)
      console.log('--------------------------------------------')
    }
  }

  // Flush out buffer
  if (writerBuffer.length) {
    await csvWriter.writeRecords(writerBuffer)
    writerBuffer = []
  }

  console.log('output file', outputFile)
}
