export interface ProjectContext {
    cwd: string;
    files: string[];
    manifests: Record<string, string>;
    readmes: Record<string, string>;
    entryPoints: string[];
    summary: string;
}
export interface WorkspaceModuleInfo {
    path: string;
    name: string;
    description?: string;
}
export interface WorkspaceReferenceInfo {
    area: string;
    entries: string[];
}
export interface WorkspaceInventory {
    rootPackageName: string | null;
    workspaceGlobs: string[];
    apps: WorkspaceModuleInfo[];
    packages: WorkspaceModuleInfo[];
    references: WorkspaceReferenceInfo[];
    topLevelAreas: string[];
}
export declare class RepoIndexer {
    private cwd;
    constructor(cwd: string);
    updateWorkspaceRoot(cwd: string): void;
    walk(dir: string, depth?: number, maxDepth?: number): Promise<string[]>;
    private readJsonFile;
    private collectWorkspaceModules;
    private collectReferenceEntries;
    buildWorkspaceInventory(): Promise<WorkspaceInventory>;
    buildContext(): Promise<ProjectContext>;
    generatePromptInjection(ctx: ProjectContext): string;
}
