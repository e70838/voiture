var express = require('express')
  , app = express()
  , fs = require('fs')
  , stylus = require('stylus') // syntaxe css plus simple reposant sur l'indentation
  , nib = require('nib') // compléte stylus pour enrichir les fichiers css avec les variantes spécifiques aux browser
  , pg = require('pg'); // postgres api

var rollback = function(client, msg) {
  if (msg) console.log(msg);
  //terminating a client connection will automatically rollback any uncommitted transactions
  //so while it's not technically mandatory to call ROLLBACK it is cleaner and more correct
  client.query('ROLLBACK', function() { client.end(); });
};

// Utilisation de pg.defaults au lieu de connectionString
// var connectionString = 'postgres://jef:sirene@localhost:5432';
// psql jef
pg.defaults.user = 'jef';
pg.defaults.password = 'voiture';
pg.defaults.database = 'jef';
pg.defaults.host = 'localhost';
pg.defaults.port = 5432;

pg.connect(function(err, client) {
  if(err) return rollback(client, "connect failed");
  var q=[//"drop table CARBURANT",
	  "create table if not exists STATION (S_STATION varchar(30) primary key, S_NAME text, S_LATITUDE numeric, S_LONGITUDE numeric)",
    //"insert into STATION (S_STATION) values ('Esso VLB')",
    //"insert into STATION (S_STATION) values ('Cora Massy')",
	  "create table if not exists CARBURANT (C_VOITURE varchar(20), C_DATE timestamp with time zone, C_VOLUME numeric(5, 2), C_PRIX   numeric(5, 2), C_KM numeric (9, 1), C_STATION varchar(30), primary key(C_VOITURE, C_DATE))"];
	  //"insert into STATION values ('Esso VLB', 'Station ESSO de Verrières le Buisson', null, null)"];
  var performQuery = function (i) {
    if (i < q.length) {
      var query = client.query(q[i], function(err, result) {
        if(err) return rollback(client, "create table failed " + err);
        console.log("ok " + i);
        performQuery(i+1);
	    });
	    console.log("start " + i);
    }
  };
  performQuery(0);	
});

var myQuery = function(text, values, cb) {
  pg.connect(function(err, client, done) {
    client.query(text, values, function(err, result) {
      done();
      cb(err, result);
    })
  });
}

// fs.readFile('essence.json', 'utf8', function(err, d1) {
//   var d = JSON.parse(d1);
//   console.log ('essence.json read: ' + d);
//   var i=0, l = d.length;
//   var f = function(e, r) {
//     if (e) console.log(e);
//     var j = i;
//     i = i + 1;
//     if (j < l) {
//       console.log('verte ' + d[j].date);
//       myQuery('insert into carburant (c_voiture, c_date, c_volume, c_prix, c_km, c_station) values ($1, $2, $3, $4, $5, $6)', ['verte', d[j].date, d[j].volume, d[j].prix, d[j].km, d[j].station], f);
//     }
//   };
//   f();
// });

var compile = function (str, path) {return stylus(str).set('filename', path).use(nib());};
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.logger('dev'));
app.locals.pretty = true;
app.use(stylus.middleware({src: __dirname + '/public', compile: compile}));
app.use(express.static(__dirname + '/public'));
app.use(express.favicon(__dirname + '/public/img/favicon.ico'));
app.use(express.bodyParser());
app.use(function(req, res, next) {
  console.log ('received: ' + req.method + ' ' + req.url);
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
  if ('OPTIONS' == res.method) {
    res.send(200);
  } else {
    next();
  }
});

var stations;
myQuery('select S_STATION from STATION', [], function(err, result) {
  stations = [];
  for (var i = 0; i < result.rows.length; i++) {
    stations.push(result.rows[i].s_station);
  }
  console.log(JSON.stringify(stations));
});

app.get('/:couleur/stations', function (req, res) {
  res.json(200, stations);
});
app.post('/:couleur/stations', function (req, res) { // create
  myQuery('insert into STATION (S_STATION) values ($1)', [req.body.station], function(err, result) {
    if (err) {
      console.log('insert ' + req.body.station + ' failed');
      res.json(400, {message:'impossible to create station ' + req.body.station});
    } else {
      stations.push(req.body.station);
      res.json(200, stations);
    }
  });
});

app.get('/', function (req, res) {
  res.redirect('/verte');
});
app.get('/:couleur/depenses', function (req, res) {
  pg.connect(function(err, client, done) {
    if(err) return rollback(client, "connect failed");
    var query = client.query('select * from CARBURANT where C_VOITURE = $1 order by C_DATE desc', [req.params.couleur]);
    query.on('row', function(row, result) {
      result.addRow({
        id:row.c_date.toISOString().substring(0, 19),
        date:row.c_date.toISOString().substring(0, 10),
        volume: row.c_volume,
        prix: row.c_prix,
        km: row.c_km.toString(),
        station: row.c_station});});
    query.on('end', function(result) {
      console.log ('Voiture ' + req.params.couleur + ' : ' + JSON.stringify(result.rows));
      done();
      res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
      res.json(200, result.rows);
    });
  });
});

app.get('/:couleur/depenses/:id', function (req, res) {
  console.log('select c_date=' + req.params.id);
  myQuery('select * from CARBURANT where C_VOITURE = $1 and C_DATE = $2',
      [req.params.couleur, req.params.id], function(err, result) {
    var row = result.rows[0];
    if (err) {
      console.log('error:' + err);
    } else {
      res.json(200, {
        id:      row.c_date.toISOString(),
        date:    row.c_date.toISOString().substring(0, 10),
        volume:  row.c_volume,
        prix:    row.c_prix,
        km:      row.c_km,
        station: row.c_station
      });
    }
  });
});

app.put('/:couleur/depenses/:id', function (req, res) { // update
  var newDate = req.params.id;
  if (req.body.date != newDate.substring(0, 10)) {
    newDate = addTime(req.body.date);
  }
  myQuery('update CARBURANT set C_DATE = $1, C_VOLUME = $2, C_PRIX = $3, C_KM = $4, C_STATION = $5 where C_DATE = $6 and C_VOITURE = $7',
      [newDate, req.body.volume, req.body.prix, req.body.km, req.body.station, req.params.id, req.params.couleur],
    function(err, result) {
      console.log('update end ' + err);
      res.json(200, {id:newDate});
    });
});

app.delete('/:couleur/depenses/:id', function (req, res) { // delete
  console.log('delete: ' + req.params.id);
  myQuery('delete from CARBURANT where C_VOITURE = $1 and C_DATE = $2',
      [req.params.couleur, req.params.id],
    function(err, result) {
      console.log('delete end ' + err);
      res.send(204, '');
    });
});

// d is a date as a string
var addTime = function (d) {
  var dt = new Date(d);
  if (0 == dt.getHours()+dt.getMinutes()+dt.getSeconds()) {
    return d.substring(0,10) + (new Date()).toISOString().substring(10);
  } else {
    return d;
  }
};

app.post('/:couleur/depenses', function (req, res) { // create
  var newDate = addTime(req.body.date);
  myQuery('insert into CARBURANT (C_VOITURE, C_DATE, C_VOLUME, C_PRIX, C_KM, C_STATION) values ($1, $2, $3, $4, $5, $6)',
      [req.params.couleur, newDate, req.body.volume, req.body.prix, req.body.km, req.body.station],
    function(err, result) {
      console.log('insert end ' + err);
      res.json(200, {id:newDate});
    });
});

app.get('/:couleur', function (req, res) {
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  res.render('voiture', { title : req.params.couleur });
});

console.log ("http://127.0.0.1:8080");
app.listen(8080);