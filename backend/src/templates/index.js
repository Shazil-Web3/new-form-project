const registerCoreTemplateRoutes = require('./templateRoutes');
const registerTemplateWorkflowRoutes = require('./templateWorkflow');

module.exports = function registerTemplateRoutes(deps) {
  registerCoreTemplateRoutes(deps);
  registerTemplateWorkflowRoutes(deps);
};
