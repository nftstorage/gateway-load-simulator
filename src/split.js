import fs from 'fs'
import os from 'os'
import { csvRead } from 'iterparse'
import { createObjectCsvWriter } from 'csv-writer'
import { Web3Storage, getFilesFromPath } from 'web3.storage'

const WRITER_BUFFER_SIZE = 100

/**
 * Randomly splits a csv file into multiple csv files, and adds them to web3.storage.
 *
 * @param {string} csvPath
 * @param {number} number
 */
export async function split (csvPath, number) {
  const outputPath = `${os.tmpdir()}/${(parseInt(String(Math.random() * 1e9), 10)).toString() + Date.now()}`

  await fs.promises.mkdir(outputPath)

  // Create csvWriters and writer buffer
  const csvWriters = Array.from({ length: number }, (_, i) => {
    return createObjectCsvWriter({
      path: `${outputPath}/${i}.csv`,
      header: [
        { id: 'ts', title: 'ts' },
        { id: 'cid', title: 'cid' }
      ]
    })
  })
  const writerBuffer = Array.from({ length: number }, (_, i) => [])

  // Read entries, split them and write when buffer full
  for await (const { data } of csvRead({ filePath: csvPath })) {
    const idx = randomNumberBetweenInterval(0, number - 1)

    writerBuffer[idx].push({
      ts: new Date(data.ts).toISOString(),
      cid: data.cid
    })

    if (writerBuffer[idx].length >= WRITER_BUFFER_SIZE) {
      await csvWriters[idx].writeRecords(writerBuffer[idx])
      writerBuffer[idx] = []
    }
  }

  // Flush out buffers
  for (let i = 0; i < writerBuffer.length; i++) {
    if (writerBuffer[i].length) {
      await csvWriters[i].writeRecords(writerBuffer[i])
    }
  }

  // Store data to web3.storage
  const w3Client = new Web3Storage({
    token: process.env.WEB3_STORAGE_TOKEN
  })
  const files = await getFilesFromPath(outputPath)
  const cid = await w3Client.put(files, {
    name: `gateway-logs-${Date.now()}`,
    wrapWithDirectory: false
  })
  console.log('cid', cid)

  // Clean files
  await fs.promises.rm(outputPath, { recursive: true, force: true })
}

function randomNumberBetweenInterval (min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min)
}
