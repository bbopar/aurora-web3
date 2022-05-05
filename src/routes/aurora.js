const Router = require('@koa/router');
const auroraController = require('../api/aurora-controller');

const router = new Router({});

router.get('/aurora/apr', async (ctx) => {
    ctx.body = await auroraController.getAPR(ctx);
});

module.exports = router;
