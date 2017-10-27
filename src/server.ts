const app = require('./app');
import * as SwaggerExpress from 'swagger-express-mw';



const config = {
    appRoot: __dirname // required config
};

SwaggerExpress.create(config, function(err, swaggerExpress) {
    if (err) { throw err; }

    // install middleware
    swaggerExpress.register(app);

    const port = process.env.PORT || 10010;
    app.listen(port);
});