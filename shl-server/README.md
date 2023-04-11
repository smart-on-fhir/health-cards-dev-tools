# SMART Health Links Test Server

A simple implementation of a SMART Health Links server for testing purposes.   
This should not be used in production.

<br>

### Build
```
cd ./shl-server
tsc
```

### Run
```
node ./src/server.js
```

<br>

### Port
By default, the SHL server listens on port `8090`.  
To change this, update the port in the `./shl-server/src/config.ts` file and rebuild.

<br>

### Data
Data for the server is placed in the `./shl` folder in a specific JSON format or created with the 'create-link' rest call.  
See the html sample in `./public/index.html`

<br>
<hr>  

### REST Endpoints

<br>  

#### `<base-url>/create-link`
This adds new data to the server and returns a new __SMART Health Link__ to retrieve that data.
```
POST http://localhost:8090/create-link  data:SHLLinkRequest
```

<br>  

#### `<base-url>/*`  
This is for requesting a manifest by a particular random path:
```
POST http://localhost:8090/ERn18l4lL3_5yPXMSzx3ZejyMM_XIeWeseXa3DXsJD0  data:ShlinkManifestRequest
```

<br>  

#### `<base-url>/shl/*`  
This is for requesting a manifest file by a particular random path:
```
GET http://localhost:8090/shl/05pHiEfsMU1kLb9-oTVknO4VUB9oP6Ot4ET46cjJFzU
```