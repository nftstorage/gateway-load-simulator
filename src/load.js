import fs from 'fs'
import os from 'os'
import delay from 'delay'
import { csvRead } from 'iterparse'
import fetch from '@web-std/fetch'
import pQueue from 'p-queue'
import { ReadableWebToNodeStream } from 'readable-web-to-node-stream'
import { CID } from 'multiformats/cid'

/**
 * @param {string} csvPath
 */
export async function loadTest (csvPath) {
  const executionTimes = []
  let timeoutCount = 0

  try {
    await fs.promises.stat(csvPath)
  } catch (err) {
    throw new Error('no file in given path')
  }

  // Create queue for concurrent requests to gateway as needed
  const ipfsGateway = process.env.IPFS_GATEWAY
  const queue = new pQueue({ concurrency: 3 })

  queue.on('next', () => {
    console.log(`Task is completed. Size: ${queue.size}, Pending: ${queue.pending}`);
  })

  let initialTs, differenceTs

  for await (const { data } of csvRead({ filePath: csvPath })) {
    // Fill in initialTs if not exists
    if (!initialTs) {
      initialTs = Date.now()
      differenceTs = initialTs - new Date(data.ts).getTime()
    }

    // New timestamp relative to the current time
    const relativeTs = new Date(data.ts).getTime() + differenceTs
    const now = Date.now()
    relativeTs > now && await delay(relativeTs - now)

    // Add gateway fetch to queue
    const nCid = normalizeCid(data.cid)
    const path = data.path || ''
    queue.add(async () => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 15000)
      const start = Date.now()

      try {
        const res = await fetch(`https://${nCid}.ipfs.${ipfsGateway}${path}`, { signal: controller.signal })

        clearTimeout(timer)

        executionTimes.push(Date.now() - start)
        return res
      } catch (err) {
        timeoutCount++
      }
    })
  }

  // Wait until queue fulfills all requests
  await queue.onEmpty()

  // Report back on response times + timeout
  const sum = executionTimes.reduce((a, b) => a + b, 0);
  const avg = (sum / executionTimes.length) || 0

  console.log('Average response time: ', avg)
  console.log('Count timeouts: ', timeoutCount)
}

/**
 * Load csv file from IPFS network and use it for load test.
 *
 * @param {string} cid
 * @param {string} fileName
 */
export async function loadTestFromWeb3 (cid, fileName) {
  // Get file from network
  const ipfsGateway = process.env.IPFS_GATEWAY
  const nCid = normalizeCid(cid)
  const outputPath = `${os.tmpdir()}/${(parseInt(String(Math.random() * 1e9), 10)).toString() + Date.now()}`
  const fileOutputPath = `${outputPath}/${fileName}`
  const res = await fetch(`https://${nCid}.ipfs.${ipfsGateway}/${fileName}`)

  await fs.promises.mkdir(outputPath)
  await new Promise((resolve, reject) => {
    const dest = fs.createWriteStream(fileOutputPath)
    const source = new ReadableWebToNodeStream(res.body)
    source.pipe(dest)
    source.on('end', resolve)
    dest.on('error', reject)
  })

  console.log('CSV file written to ', fileOutputPath)
  await loadTest(fileOutputPath)

  // Clean files
  await fs.promises.rm(outputPath, { recursive: true, force: true })
}

/**
 * Parse CID and return normalized b32 v1
 *
 * @param {string} cid
 */
export function normalizeCid (cid) {
  try {
    const c = CID.parse(cid)
    return c.toV1().toString()
  } catch (err) {
    return cid
  }
}
