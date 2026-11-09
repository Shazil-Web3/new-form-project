import registerUserRoutes from "./userRoutes";
import registerTaskRoutes from "./taskRoutes";
import registerOrgRoutes from "./orgRoutes";
import { registerNumberRoutes } from "./numberRoutes";

export default function registerAuthRoutes(deps) {
  registerUserRoutes(deps);
  registerTaskRoutes(deps);
  registerOrgRoutes(deps);
  registerNumberRoutes(deps);
}
