const swaggerAutogen = require('swagger-autogen')({ openapi: '3.0.4' });
const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const doc = {
  openapi: '3.0.4',
  info: {
    title: 'Fotogram API',
    description: 'Gestione utenti, post e moderazione',
    version: '1.0.0'
  },
  host: 'localhost:3000',
  schemes: ['http'],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    }
  },
  security: [{
    bearerAuth: []
  }],
  tags: [
    { name: "Auth", description: "Autenticazione e gestione sessioni" },
    { name: "Utente", description: "Gestione utenti" },
    { name: "Post", description: "Gestione post" },
    { name: "Follow", description: "Gestione follow" },
    { name: "Flag", description: "Moderazione e flag" },
    { name: "Moderatore", description: "Gestione moderatori" }
  ]
};

const outputFile = './swagger-output.json';
const endpointsFiles = ['./routes.js'];

swaggerAutogen(outputFile, endpointsFiles, doc);
