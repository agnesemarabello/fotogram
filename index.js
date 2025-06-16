const swaggerUi = require('swagger-ui-express');
const swaggerFile = require('./swagger-output.json');

const express = require('express');
const app = express();
const routes = require('./routes'); 
const port = 3000;
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerFile));


// Middleware
app.use(express.json());

app.use('/', routes);

// Swagger sulla rotta /doc
app.use('/doc', swaggerUi.serve, swaggerUi.setup(swaggerFile));

// Route di test opzionale
app.get('/', (req, res) => {
    res.send('API attiva');
});

// Avvia il server
app.listen(port, () => {
  console.log(`Swagger disponibile su http://localhost:${port}/doc`);
});
