/* eslint-disable no-param-reassign */
/* eslint-disable no-return-await */
/* eslint-disable consistent-return */

const http = require('http');
const Koa = require('koa');
const bodyParser = require('koa-bodyparser');
const WS = require('ws');
const fs = require('fs');
const router = require('koa-router')();
const path = require('path');
const koaStatic = require('koa-static');
const koaBody = require('koa-body');
const jReader = require('./jsonReader');

const pub = path.join(__dirname, '/public');
const app = new Koa();
const port = 7070;

let notes;

jReader('./public/notes.json', (err, result) => {
  if (err) {
    throw new Error(err);
  }
  notes = result;
  notes.sort((a, b) => {
    const date1 = Date.parse(a.created);
    const date2 = Date.parse(b.created);

    if (date1 < date2) {
      return 1;
    }
    if (date1 > date2) {
      return -1;
    }
    return 0;
  });
});

router.post('/', koaBody({ urlencoded: true, multipart: true, formidable: { uploadDir: './public', keepExtensions: true, maxFileSize: 2000 * 1024 * 1024 } }), async (ctx) => {
  const { file } = ctx.request.files;
  ctx.body = file;
});

router.delete('/:url', async (ctx) => {
  const { url } = ctx.params;

  fs.unlinkSync(path.join(pub, url), (e) => {
    if (e) throw new Error(`Attatchment remove error:${e}`);
  });
  ctx.request.status = 200;
  ctx.body = 'Ok';
});

router.put('/:id', async (ctx) => {
  const { id } = ctx.params;
  notes.forEach((note) => {
    if (note.id === id) {
      note.fav = !note.fav;
    }
  });
  ctx.request.status = 200;
  ctx.body = 'Ok';
});

app.use(async (ctx, next) => { const origin = ctx.request.get('Origin'); if (!origin) { return await next(); } const headers = { 'Access-Control-Allow-Origin': '*' }; if (ctx.request.method !== 'OPTIONS') { ctx.response.set({ ...headers }); try { return await next(); } catch (e) { e.headers = { ...e.headers, ...headers }; throw e; } } if (ctx.request.get('Access-Control-Request-Method')) { ctx.response.set({ ...headers, 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH' }); if (ctx.request.get('Access-Control-Request-Headers')) { ctx.response.set('Access-Control-Allow-Headers', ctx.request.get('Access-Control-Allow-Request-Headers')); } ctx.response.status = 204; } });
app.use(koaStatic(pub));
app.use(router.routes());
app.use(bodyParser());

const server = http.createServer(app.callback());
const wsServer = new WS.Server({ server });

function* getNote(i = 0) {
  for (i; i < notes.length; i += 1) {
    yield JSON.stringify(notes[i]);
  }
}

function refreshStorage() {
  fs.writeFile('./public/notes.json', JSON.stringify(notes), (err) => {
    if (err) throw new Error(err);
  });
}

wsServer.on('connection', (ws) => {
  let notesGen = getNote();

  const errCallback = (err) => {
    if (err) {
      throw new Error(err);
    }
  };

  ws.on('message', (msg) => {
    const data = JSON.parse(msg);
    let responseData;

    if (data.startfrom) {
      const i = notes.findIndex((n) => n.id === data.startfrom);
      notesGen = getNote(i + 1);
    }
    switch (data.type) {
      case 'getnext':

        responseData = notesGen.next();
        ws.send(JSON.stringify(responseData), errCallback);
        break;

      case 'newnote':
        notes.unshift(data.content);
        responseData = { value: JSON.stringify(data.content), new: true };
        Array.from(wsServer.clients)
          .filter((o) => o.readyState === 1)
          .forEach((o) => o.send(JSON.stringify(responseData), errCallback));
        break;

      default:
        break;
    }
  }, errCallback);

  ws.on('close', () => {
    refreshStorage();
  }, errCallback);
});

server.listen(port);
