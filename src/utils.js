const fs = require('fs')

// Read a file as a promise, using the provided encoding (binary encoding by default):
function readFilePromise (fileName, encoding = null) {
  return new Promise((resolve, reject) => {
    fs.readFile(fileName, encoding, (err, data) => {
      if (err) return reject(err)
      resolve(data)
    })
  })
}

// ---+ temperature +---
//
// For a given latitude and longitude, and a temperatureMap data object, return the temperature
// at the provided lat/lng
function temperature (lat, lng, temperatureData) {
  return temperatureData.data[mapPointToIndex(lat, lng, temperatureData)]
}

// Since we have to consume bounds linearly out of the data buffer, we need to arrange bounds
// in a way that makes that iteration easier. It will rearrange from any set of bounds to be
// [[MIN_LNG, MIN_LAT], [MAX_LNG, MAX_LAT]]
function arrangeBounds([tl, br]) {
  let
    sw = [Math.min(tl[0], br[0]), Math.min(tl[1], br[1])],
    ne = [Math.max(tl[0], br[0]), Math.max(tl[1], br[1])]

  return [sw, ne]
}

// Return all temperature values within a set of bounds, including a bunch of data that makes it
// easier to transform those data points into other formats (e.g. GeoJSON). Each entry returned
// is in the form of { index, value, lat, lng }. Null/empty values are not included
// Where:
//  index - the index of the data point in the buffer
//  value - the value of the data point at the index
//  lat - the latitude of the data point
//  lng - the longitude of the data point
function valuesWithinBounds (bounds, temperatureData) {
  let vals = [],
    [[south, west], [north, east]] = arrangeBounds(bounds)

  for(let lng = west; lng <= east; lng += temperatureData.longitudeStep) {
    for(let lat = south; lat <= north; lat += temperatureData.latitudeStep) {
      let
        index = mapPointToIndex(lat, lng, temperatureData),
        value = temperatureData.data[index]

      if(value) vals.push({ index, value, lat, lng })
    }
  }

  return vals
}

// ---+ averageTemperature +---
//
// Generate an average temperature for a set of bounds and a a temperatureMap
//
function averageTemperature (lat0, lng0, lat1, lng1, temperatureData) {
  // We could transduce over this collection rather than iterate multiple times, if we really
  // need to save cycles:
  let temps = valuesWithinBounds([[lat0, lng0], [lat1, lng1]], temperatureData)

  if(!temps.length) return null

  return temps.map(v => v.value).reduce((sum, temp) => sum + temp) / temps.length
}

// Map an index in the data buffer to a latitude,longitude pair:
function mapIndexToPoint (i, temperatureData) {
  let
    {rows, columns, latitude, longitude, latitudeStep, longitudeStep} = temperatureData,
    row = Math.floor(i / columns),
    col = i % columns

  return [col * longitudeStep + longitude, row * latitudeStep * -1 + latitude]
}

// Map a point in space to an index in the data buffer:
function mapPointToIndex (lat, lng, temperatureData) {
  let
    {rows, columns, latitude, longitude, latitudeStep, longitudeStep} = temperatureData,
    y = Math.floor((lat - latitude) / latitudeStep * -1),
    x = Math.floor((lng - longitude) / longitudeStep)

  if(lat > latitude || lng < longitude) {
    return -1
  }

  if(y * columns + x >= temperatureData.data.length) {
    return -1
  }

  return y * columns + x
}

// Translate a temperature map object into geojson, so we can display it in a browser that supports
// geojson tiles. Later, this will be turned into an MVT (Mapbox Vector Tile) format served via
// protobuf
function toGeoJson (data) {
  return {
    type: 'FeatureCollection',
    features: data.data.map((temp, i) => {
      if(temp === null) return null

      return {
        type: 'Feature',
        geometry:   {
          type: 'Point',
          coordinates: mapIndexToPoint(i, data)
        },
        properties: {
          value: temp
        }
      }
    }).filter(v => v)
  }
}

exports.readFilePromise = readFilePromise
exports.temperature = temperature
exports.averageTemperature = averageTemperature
exports.mapIndexToPoint = mapIndexToPoint
exports.mapPointToIndex = mapPointToIndex
exports.valuesWithinBounds = valuesWithinBounds
exports.toGeoJson = toGeoJson
