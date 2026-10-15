const registerCoreDocumentRoutes = require('./documentRoutes');
const registerDocumentWorkflowRoutes = require('./documentWorkflow');
const documentHelpers = require('./documentHelpers');

module.exports = function registerDocumentRoutes(deps) {
  registerCoreDocumentRoutes(deps);
  registerDocumentWorkflowRoutes(deps);
};

module.exports.documentHelpers = documentHelpers;
