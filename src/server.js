const Koa = require('koa');
const _ = require('./routes/aurora');

const app = new Koa();

app.use(_.routes()).use(_.allowedMethods());

app.listen(3000, function(){
    console.log('Server running on https://localhost:3000')
});
