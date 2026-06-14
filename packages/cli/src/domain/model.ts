export const PROJECT_DIRECTORY = ".better-webhook";
export const PROJECT_CONFIG_FILE = "project.json";
export const PROJECT_CONFIG_RELATIVE_PATH = `${PROJECT_DIRECTORY}/${PROJECT_CONFIG_FILE}`;
export const MACHINE_SCHEMA_VERSION = "1";

export type OutputFormat = "human" | "json";

export type EndpointMode = "generic" | "provider";
export type ProviderId = "github" | "stripe";

export type SecretReference =
	| {
			readonly kind: "env";
			readonly name: string;
	  }
	| {
			readonly kind: "literal";
			readonly value: string;
	  };

export interface EndpointProfile {
	readonly id: string;
	readonly mode: EndpointMode;
	readonly provider?: ProviderId;
	readonly targetUrl: string;
	readonly route: string;
	readonly secretRef?: SecretReference;
	readonly createdAt: string;
	readonly updatedAt: string;
}

export interface ProjectConfig {
	readonly schemaVersion: "1";
	readonly name: string;
	readonly endpoints: Record<string, EndpointProfile>;
}

export interface ResolvedProject {
	readonly root: string;
	readonly configPath: string;
	readonly config: ProjectConfig;
}

export interface CommandEnvelope<TCommand extends string, TData> {
	readonly schemaVersion: typeof MACHINE_SCHEMA_VERSION;
	readonly command: TCommand;
	readonly data: TData;
}
