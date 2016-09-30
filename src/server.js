const express = require('express')
const geojsonvt = require('geojson-vt')
const vtpbf = require('vt-pbf')
const { readFileAsTemperatureMap } = require('./read')
const { readFilePromise, averageTemperature, toGeoJson } = require('./utils')
const PORT = process.env.PORT || 8181

// Builds the tile server given a temperatureMap object. Summary:
//
// First, it generates a geojson->vectortile cache using geojson-vt
// Then it initializes the server routes
// Then starts the server
function buildTileServer(temperatureMap) {
  return new Promise(resolve => {
    const app = express()

    // geojsonvt translates geojson into a mvt (mapbox vector tile) cache that makes it easier to
    // serve dynamic vector tiles to the client. The configuration dials down the accuracy in
    // order to reduce the memory footprint of the cache:
    const tileIndex = geojsonvt(toGeoJson(temperatureMap), {
      maxZoom: 8,
      tolerance: 10
    })

    // Set up the tile-serving route:
    // The route fetches a slippy tile from the cache, translates it into protobuf, and sends it
    // to the server. If no tile exists, just return an empty 200:
    app.get('/tile/:z/:x/:y.mvt', (req, res) => {
      let
        { z, y, x } = req.params,
        tile = tileIndex.getTile(+z, +x, +y)

      res.set('Content-Type', 'vnd.mapbox-vector-tile')
      if(tile) {
        res.send(vtpbf.fromGeojsonVt({ 'temperatures': tileIndex.getTile(+z,+x,+y) }))
      }  else {
        res.status(200).end()
      }
    })

    // Get the average temperature for a set of bounds:
    // This is a wrapper for the averageTemperature API call defined in utils.js
    app.get('/avg-temp/:lat0/:lng0/:lat1/:lng1', (req, res) => {
      let { lat0, lng0, lat1, lng1 } = req.params

      res.set('Content-Type', 'application/json')
      res.send(JSON.stringify({
        averageTemperature: averageTemperature(+lat0, +lng0, +lat1, +lng1, temperatureMap)
      })).end()
    })

    // For all other routes, just serve up index.html:
    app.get('/*', (req, res) => {
      res.set('Content-Type', 'text/html')
      readFilePromise('./index.html', 'utf8').then(text => res.send(text))
    })

    const server = app.listen(PORT, () => resolve(server))
  })
}

readFileAsTemperatureMap('./sample_data.hdr', './sample_data.bil')
  .then(buildTileServer)
  .then(server => console.log(`app started on ${PORT}`))
  .catch(e => console.error(e))

