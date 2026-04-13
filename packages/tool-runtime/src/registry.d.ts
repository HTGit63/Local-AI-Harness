import { ToolActionContext, ToolResult } from './types';
export declare class ToolRegistry {
    private context;
    constructor(context: ToolActionContext);
    updateContext(context: Partial<ToolActionContext>): void;
    private resolveTarget;
    private withApproval;
    private wrapExecution;
    readFile(filePath: string): Promise<ToolResult>;
    listDir(dirPath: string): Promise<ToolResult>;
    glob(pattern: string): Promise<ToolResult>;
    searchText(query: string, filePattern?: string): Promise<ToolResult>;
    patchFile(filePath: string, oldContent: string, newContent: string): Promise<ToolResult>;
    makeDir(dirPath: string): Promise<ToolResult>;
    writeFile(filePath: string, content: string): Promise<ToolResult>;
    deleteFile(filePath: string): Promise<ToolResult>;
    gitStatus(): Promise<ToolResult>;
    gitDiff(): Promise<ToolResult>;
    runCommand(command: string): Promise<ToolResult>;
}
