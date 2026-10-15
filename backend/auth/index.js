const registerUserRoutes = require('./userRoutes');
const registerTaskRoutes = require('./taskRoutes');
const registerOrgRoutes = require('./orgRoutes');
const { registerNumberRoutes } = require('./numberRoutes');

module.exports = function registerAuthRoutes(deps) {
  registerUserRoutes(deps);
  registerTaskRoutes(deps);
  registerOrgRoutes(deps);
  registerNumberRoutes(deps);
};

