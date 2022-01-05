# gateway load simulation

> Tool to load test a IPFS gateway backed by a CSV file with CIDs and timestamps.

## CSV format

```csv
ts,cid,path
"2021-11-15T09:21:37.554123Z","bafkreidyeivj7adnnac6ljvzj2e3rd5xdw3revw4da7mx2ckrstapoupoq",""
```

The timestamps will be used as a relative time. This tool requires that the timestamps are sorted by timestamp. It will use the first timestamp as the initial date and perform requests with the same cadence as the CSV file states.

## Getting Started

This tool relies on external services that need to be configured by creating a `.env.local` file as follows:

```env
# IPFS gateway with support for subdomain as <cid>.ipfs.<IPFS_GATEWAY>
IPFS_GATEWAY="dweb.link"

# Used for storage
WEB3_STORAGE_TOKEN="<insert token created from web3.storage>"
```

## CLI

### Load test from a CSV file

Run a load test from a local CSV file.

```sh
gw-load start fixtures/gateway.csv
```

### Load test from Partial CSV files

For better simulations, multiple locations should be used to perform the gateway requests. This tool supports CSV random splitting into multiple files that can then be used in multiple machines.

For splitting a CSV you just need to provide the complete CSV and the number of resulting CSV files to create. The CSV files will be stored in web3.storage so that they can then be easily used from this tool.

```sh
gw-load split fixtures/gateway.csv 2
```

The CSV files are stored as `{number}.csv` within the filer.

In different machines it is now possible to run the load test as follows:

```sh
gw-load start-w3 bafybeieems2dpnxyb2as3g7zx4g3qiawz2a47iw45cjjw62o6bxftcvvgu 0.csv
```

```sh
gw-load start-w3 bafybeieems2dpnxyb2as3g7zx4g3qiawz2a47iw45cjjw62o6bxftcvvgu 1.csv
```
