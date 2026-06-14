import { Layer } from "effect";

import { ProjectStoreLive } from "./project.js";

export const CliServicesLive = Layer.mergeAll(ProjectStoreLive);
