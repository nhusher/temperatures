const fs = require('fs')
const { readFilePromise, mapIndexToPoint } = require('./utils')

const HEADER_LINE_REGEX = /^(\w+)\s+(\S+)/

// Parse a line in the header file into [key, value] pairs:
function parseHeaderLine (line) {
  if (!HEADER_LINE_REGEX.test(line)) return null
  let parsed = line.match(HEADER_LINE_REGEX)

  return [parsed[1], isNaN(parseFloat(parsed[2])) ? parsed[2] : parseFloat(parsed[2])]
}

// Reads the headers definition from the provided file name, returns Promise<HeaderDefs>
function readHeaderFile (headerFileName) {
  return readFilePromise(headerFileName, 'utf8').then(data => {
    let configLines = data.split(/\n/).map(parseHeaderLine).filter(v => v)

    return configLines.reduce((config, [key, value]) => {
      config[key] = value
      return config
    }, {})
  })
}

// Reads the data file and returns a list of parsed floats as Promise<[Float]>
function readDataFile (dataFileName) {
  // Here, we're reading the whole file. For large data files (>10m), much of the below would need
  // to be redesigned to not consume horrific amounts of memory.
  return readFilePromise(dataFileName).then(data => {
    let dataPoints = []

    // Hardcode to 32-bit little-endian floats: we could read this from the headers file, but it's
    // not clear what other acceptable values of that value are, or how they would map to nodeJS IO
    // calls. It should be easy to pass that config value as a parameter to `readDataFile` and
    // change the behavior:
    for (let i = 0, l = data.length / 4; i < l; i += 1) {
      dataPoints.push(data.readFloatLE(i * 4))
    }

    return dataPoints
  })
}

// Generates a 'temperature map' data object that contains both the parsed binary data from the
// .bil file, and enough metadata to make sense of that data via utility functions (in utils.js)
function generateTemperatureMap (headers, data) {
  return {
    data: data.map(v => v === headers.NODATA ? null : v), // make null values more ergonomic
    rows:          headers.NROWS,
    columns:       headers.NCOLS,
    latitude:      headers.ULYMAP,
    longitude:     headers.ULXMAP,
    latitudeStep:  headers.YDIM,
    longitudeStep: headers.XDIM
  }
}

// Reads the provided headers and data file and generates a 'temperatureMap' file that contains
// a synthesis of both, wrapped in a Promise
function readFileAsTemperatureMap (headerFileName, dataFileName) {
  return Promise.all([
    readHeaderFile(headerFileName),
    readDataFile(dataFileName)
  ]).then(([ headers, data ]) => generateTemperatureMap(headers, data))
}

exports.readFileAsTemperatureMap = readFileAsTemperatureMap


