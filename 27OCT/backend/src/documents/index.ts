import registerCoreDocumentRoutes from "./documentRoutes";
import registerDocumentWorkflowRoutes from "./documentWorkflow";
import registerRelatedDocumentsRoutes from "./relatedDocumentsRoutes";
import * as documentHelpers from "./documentHelpers";

export default function registerDocumentRoutes(deps) {
  registerCoreDocumentRoutes(deps);
  registerDocumentWorkflowRoutes(deps);
  registerRelatedDocumentsRoutes(deps);
};

export { documentHelpers };
