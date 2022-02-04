import fetch from 'node-fetch'
import pQueue from 'p-queue'
import pWaitFor from 'p-wait-for'

async function main () {
  const ipfsGateway = 'cf-ipfs.com'
  const path = ''
  const nCid = 'bafkreidchi5c4c3kwr5rpkvvwnjz3lh44xi2y2lnbldehwmpplgynigidm'
  const concurrency = 3
  const queue = new pQueue({ concurrency })

  let wasLimitRated
  const start = Date.now()
  let countReq = 0
  do {
    queue.add(async () => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 15000)
      let res
      try {
        res = await fetch(`https://${nCid}.ipfs.${ipfsGateway}${path}`, { signal: controller.signal })
      } catch (err) {
        console.log('err', err)
      } finally {
        clearTimeout(timer)
        countReq += 1
      }
      console.log('res', res.ok, res.status)
      if (!res.ok) {
        wasLimitRated = true
      }
    })
    if (queue.size >= 100) {
      await pWaitFor(() => queue.size < 200)
    }
  } while (!wasLimitRated)

  const end = Date.now()
  console.log('start: ', start)
  console.log('end: ', end)
  console.log('duration: ', end - start)
  console.log('requests: ', countReq)

  // Wait until queue fulfills all requests
  await queue.onEmpty()
}

main()
