import fs from 'fs'
import os from 'os'
import delay from 'delay'
import ora from 'ora'
import { csvRead } from 'iterparse'
import fetch from 'node-fetch'
import pQueue from 'p-queue'
import pWaitFor from 'p-wait-for'
import { CID } from 'multiformats/cid'
import { Web3Storage } from 'web3.storage'
import { File } from '@web-std/file'
import wcL from 'unix-wc-l'

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

  // Get lines
  const nLines = await wcL(csvPath)
  console.log('wc -l', nLines)

  // Create queue for concurrent requests to gateway as needed
  const ipfsGateway = process.env.IPFS_GATEWAY
  const concurrency = 2
  const queue = new pQueue({ concurrency })

  queue.on('next', () => {
    console.log(`Task is completed. Size: ${queue.size}, Pending: ${queue.pending}`)
  })

  let initialTs, differenceTs, lastTs
  let wasLimitRated
  let countReq = 0, countRateLimited = 0

  const spinnerRead = ora('reading csv and fetching from gateway')
  for await (const { data } of csvRead({ filePath: csvPath })) {
    // Fill in initialTs if not exists
    if (!initialTs) {
      initialTs = Date.now()
      differenceTs = initialTs - new Date(data.ts).getTime()
    }

    // New timestamp relative to the current time
    const relativeTs = new Date(data.ts).getTime() + differenceTs
    const now = Date.now() // wait until ready
    relativeTs > now && await delay(relativeTs - now)

    if (wasLimitRated) {
      console.log('---RATE LIMITED---')
      countRateLimited++
      break
    }

    // Add gateway fetch to queue
    const nCid = normalizeCid(data.cid)
    const path = data.path || ''
    queue.add(async () => {
      // Do not make super fast concurrent requests
      if (lastTs) {
        const readyToGoTs = lastTs + 50
        readyToGoTs > Date.now() && await delay(200)
      }
      lastTs = Date.now()

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 15000)
      const start = Date.now()

      let res
      try {
        res = await fetch(`https://${nCid}.${ipfsGateway}${path}`, { signal: controller.signal })
        executionTimes.push(Date.now() - start)
      } catch (err) {
        timeoutCount++
      } finally {
        clearTimeout(timer)
        countReq += 1
      }
      res && console.log('res', res.ok, res.status)
      if (res && !res.ok) {
        wasLimitRated = true
      }
    })

    if (queue.size >= 500) {
      await pWaitFor(() => queue.size < 200)
    }

    if (wasLimitRated) {
      console.log('---RATE LIMITED---')
      break
    }
  }

  const end = Date.now()
  console.log('start: ', initialTs)
  console.log('end: ', end)
  console.log('duration: ', end - initialTs)
  console.log('requests: ', countReq)
  console.log('rate limited: ', countReq, countRateLimited)

  spinnerRead.stopAndPersist()

  // Wait until queue fulfills all requests
  await queue.onEmpty()

  // Report back on response times + timeout
  const sum = executionTimes.reduce((a, b) => a + b, 0);
  const avg = (sum / executionTimes.length) || 0

  console.log('Average response time: ', avg)
  console.log('Count timeouts: ', timeoutCount)

  // Store data to web3.storage
  const w3Client = new Web3Storage({
    token: process.env.WEB3_STORAGE_TOKEN
  })
  const jsonStr = JSON.stringify({
    sum,
    avg,
    countReq,
    countRateLimited,
    csvPath
  })
  const file = new File([jsonStr], `metrics-${csvPath}`, {
    type: 'text/plain'
  })
  const root = await w3Client.put([file])
  console.log('rootCid', root)
}

/**
 * Load csv file from IPFS network and use it for load test.
 *
 * @param {string} cid
 * @param {string} fileName
 */
export async function loadTestFromWeb3 (cid, fileName) {
  // Get file from network
  const ipfsGateway = process.env.IPFS_GATEWAY_LOAD || process.env.IPFS_GATEWAY
  const nCid = normalizeCid(cid)
  const outputPath = `${os.tmpdir()}/${(parseInt(String(Math.random() * 1e9), 10)).toString() + Date.now()}`
  const fileOutputPath = `${outputPath}/${fileName}`

  await fs.promises.mkdir(outputPath)
  const res = await fetch(`https://${nCid}.ipfs.${ipfsGateway}/${fileName}`)
  const dest = fs.createWriteStream(fileOutputPath)

  await new Promise((resolve, reject) => {
    res.body.pipe(dest)
    res.body.on('error', reject)
    dest.on('finish', resolve)
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
