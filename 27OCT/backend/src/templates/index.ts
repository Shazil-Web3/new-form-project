import registerCoreTemplateRoutes from "./templateRoutes";
import registerTemplateWorkflowRoutes from "./templateWorkflow";

export default function registerTemplateRoutes(deps) {
  registerCoreTemplateRoutes(deps);
  registerTemplateWorkflowRoutes(deps);
};
