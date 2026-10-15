const registerCoreDocumentRoutes = require('./documentRoutes');
const registerDocumentWorkflowRoutes = require('./documentWorkflow');
const registerRelatedDocumentsRoutes = require('./relatedDocumentsRoutes');
const documentHelpers = require('./documentHelpers');

module.exports = function registerDocumentRoutes(deps) {
  registerCoreDocumentRoutes(deps);
  registerDocumentWorkflowRoutes(deps);
  registerRelatedDocumentsRoutes(deps);
};

module.exports.documentHelpers = documentHelpers;
