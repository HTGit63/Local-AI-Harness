import * as fs from 'fs/promises';
import * as path from 'path';
import ts from 'typescript';

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const IGNORED_DIRS = new Set(['.git', '.gamma-harness', 'node_modules', 'dist', 'build', '.next', 'base_repos', 'third_party']);

export interface SymbolMatch {
  name: string;
  kind: string;
  filePath: string;
  line: number;
  column: number;
  exported: boolean;
  snippet: string;
}

export interface FileCard {
  filePath: string;
  exports: string[];
  keyMethods: string[];
  imports: string[];
  relevantSnippets: Array<{
    startLine: number;
    endLine: number;
    content: string;
  }>;
}

export interface ContextPack {
  query: string;
  filesIncluded: number;
  snippetsIncluded: number;
  contextBudgetUsed: number;
  contextBudgetLimit: number;
  fileCards: FileCard[];
}

async function walkSourceFiles(cwd: string, dir = cwd): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) {
        files.push(...await walkSourceFiles(cwd, path.join(dir, entry.name)));
      }
      continue;
    }

    if (SOURCE_EXTENSIONS.has(path.extname(entry.name)) && !entry.name.endsWith('.d.ts')) {
      files.push(path.relative(cwd, path.join(dir, entry.name)).replace(/\\/g, '/'));
    }
  }

  return files.sort();
}

async function readSourceFile(cwd: string, filePath: string): Promise<{ text: string; source: ts.SourceFile }> {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
  const text = await fs.readFile(absolutePath, 'utf8');
  const source = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, scriptKindForPath(filePath));
  return { text, source };
}

function scriptKindForPath(filePath: string): ts.ScriptKind {
  switch (path.extname(filePath)) {
    case '.tsx':
      return ts.ScriptKind.TSX;
    case '.jsx':
      return ts.ScriptKind.JSX;
    case '.js':
      return ts.ScriptKind.JS;
    default:
      return ts.ScriptKind.TS;
  }
}

function isExported(node: ts.Node): boolean {
  return Boolean(ts.canHaveModifiers(node) && ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword));
}

function snippetForNode(source: ts.SourceFile, text: string, node: ts.Node, radius = 3): string {
  const start = source.getLineAndCharacterOfPosition(node.getStart(source)).line;
  const end = source.getLineAndCharacterOfPosition(node.getEnd()).line;
  const lines = text.split('\n');
  const from = Math.max(0, start - radius);
  const to = Math.min(lines.length, end + radius + 1);
  return lines.slice(from, to).join('\n');
}

function positionFor(source: ts.SourceFile, node: ts.Node): { line: number; column: number } {
  const pos = source.getLineAndCharacterOfPosition(node.getStart(source));
  return { line: pos.line + 1, column: pos.character + 1 };
}

function hasJsxBody(node: ts.Node): boolean {
  return /<\/?[A-Za-z][\w.-]*(\s|>|\/>)/.test(node.getText().slice(0, 2000));
}

function pushSymbol(matches: SymbolMatch[], source: ts.SourceFile, text: string, filePath: string, name: string, kind: string, node: ts.Node, exported = isExported(node)) {
  const pos = positionFor(source, node);
  matches.push({
    name,
    kind,
    filePath,
    line: pos.line,
    column: pos.column,
    exported,
    snippet: snippetForNode(source, text, node),
  });
}

function collectSymbolsFromFile(filePath: string, text: string, source: ts.SourceFile): SymbolMatch[] {
  const matches: SymbolMatch[] = [];

  const visit = (node: ts.Node) => {
    if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isEnumDeclaration(node)) && node.name) {
      const kind = ts.isFunctionDeclaration(node)
        ? (/^[A-Z]/.test(node.name.text) && hasJsxBody(node) ? 'component' : 'function')
        : ts.isClassDeclaration(node)
          ? 'class'
          : ts.isInterfaceDeclaration(node)
            ? 'interface'
            : ts.isTypeAliasDeclaration(node)
              ? 'type'
              : 'enum';
      pushSymbol(matches, source, text, filePath, node.name.text, kind, node);
    }

    if ((ts.isMethodDeclaration(node) || ts.isPropertyDeclaration(node)) && node.name && ts.isIdentifier(node.name)) {
      pushSymbol(matches, source, text, filePath, node.name.text, ts.isMethodDeclaration(node) ? 'method' : 'property', node);
    }

    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const initializer = node.initializer;
      const isFunctionLike = initializer && (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer));
      const isComponent = /^[A-Z]/.test(node.name.text) && initializer && hasJsxBody(initializer);
      if (isFunctionLike || isComponent) {
        pushSymbol(matches, source, text, filePath, node.name.text, isComponent ? 'component' : 'function', node, Boolean(node.parent.parent && isExported(node.parent.parent)));
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(source);
  return matches;
}

function normalizeBody(newBody: string): string {
  const trimmed = newBody.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed;
  }
  const indented = trimmed
    .split('\n')
    .map((line) => line ? `  ${line}` : line)
    .join('\n');
  return `{\n${indented}\n}`;
}

function applyTextEdits(text: string, edits: Array<{ start: number; end: number; text: string }>): string {
  return edits
    .sort((left, right) => right.start - left.start)
    .reduce((current, edit) => `${current.slice(0, edit.start)}${edit.text}${current.slice(edit.end)}`, text);
}

function functionBodyEdit(source: ts.SourceFile, functionName: string, newBody: string): { start: number; end: number; text: string } | null {
  let edit: { start: number; end: number; text: string } | null = null;
  const replacement = normalizeBody(newBody);

  const visit = (node: ts.Node) => {
    if (edit) return;
    if ((ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isFunctionExpression(node)) && node.name && ts.isIdentifier(node.name) && node.name.text === functionName && node.body) {
      edit = { start: node.body.getStart(source), end: node.body.getEnd(), text: replacement };
      return;
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === functionName && node.initializer) {
      if (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)) {
        const body = node.initializer.body;
        edit = { start: body.getStart(source), end: body.getEnd(), text: replacement };
        return;
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(source);
  return edit;
}

export async function findSymbols(cwd: string, name: string, kind?: 'symbol' | 'function' | 'component'): Promise<SymbolMatch[]> {
  const files = await walkSourceFiles(cwd);
  const matches: SymbolMatch[] = [];
  for (const filePath of files) {
    const { text, source } = await readSourceFile(cwd, filePath);
    const fileMatches = collectSymbolsFromFile(filePath, text, source)
      .filter((entry) => entry.name === name)
      .filter((entry) => kind === 'function' ? ['function', 'method'].includes(entry.kind) : kind === 'component' ? entry.kind === 'component' || (/^[A-Z]/.test(entry.name) && hasJsxBody(source)) : true);
    matches.push(...fileMatches);
  }
  return matches;
}

export async function replaceFunctionBody(cwd: string, filePath: string, functionName: string, newBody: string): Promise<{ before: string; after: string }> {
  const { text, source } = await readSourceFile(cwd, filePath);
  const edit = functionBodyEdit(source, functionName, newBody);
  if (!edit) {
    throw new Error(`Function ${functionName} not found in ${filePath}.`);
  }
  return {
    before: text,
    after: applyTextEdits(text, [edit]),
  };
}

export async function insertImportStatement(cwd: string, filePath: string, importStatement: string): Promise<{ before: string; after: string }> {
  const { text, source } = await readSourceFile(cwd, filePath);
  const normalized = importStatement.trim().endsWith(';') ? importStatement.trim() : `${importStatement.trim()};`;
  if (text.includes(normalized)) {
    return { before: text, after: text };
  }
  const requestedModule = normalized.match(/\sfrom\s+['"]([^'"]+)['"]/)?.[1] ?? normalized.match(/^import\s+['"]([^'"]+)['"]/)?.[1];
  if (requestedModule && source.statements.some((statement) =>
    ts.isImportDeclaration(statement) &&
    ts.isStringLiteral(statement.moduleSpecifier) &&
    statement.moduleSpecifier.text === requestedModule &&
    statement.getText(source).replace(/\s+/g, ' ').trim() === normalized.replace(/\s+/g, ' ').trim()
  )) {
    return { before: text, after: text };
  }

  let insertAt = 0;
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) || ts.isImportEqualsDeclaration(statement)) {
      insertAt = statement.end;
    }
  }
  const prefix = insertAt > 0 ? '\n' : '';
  return {
    before: text,
    after: `${text.slice(0, insertAt)}${prefix}${normalized}\n${text.slice(insertAt).replace(/^\n/, '')}`,
  };
}

export async function addInterfaceProperty(cwd: string, filePath: string, interfaceName: string, property: string): Promise<{ before: string; after: string }> {
  const { text, source } = await readSourceFile(cwd, filePath);
  const normalized = property.trim().endsWith(';') ? property.trim() : `${property.trim()};`;
  const requestedName = normalized.match(/^([A-Za-z_$][\w$]*|['"][^'"]+['"])\??\s*:/)?.[1]?.replace(/^['"]|['"]$/g, '');
  let edit: { start: number; end: number; text: string } | null = null;
  let alreadyExists = false;

  const visit = (node: ts.Node) => {
    if (edit) return;
    if (ts.isInterfaceDeclaration(node) && node.name.text === interfaceName) {
      if (node.members.some((member) => {
        if (requestedName && ts.isPropertySignature(member) && member.name) {
          if (ts.isIdentifier(member.name) || ts.isStringLiteral(member.name)) {
            return member.name.text === requestedName;
          }
        }
        return member.getText(source).replace(/\s+/g, ' ').trim() === normalized.replace(/\s+/g, ' ').trim();
      })) {
        alreadyExists = true;
        return;
      }
      edit = {
        start: node.members.end,
        end: node.members.end,
        text: `\n  ${normalized}`,
      };
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);

  if (alreadyExists) {
    return { before: text, after: text };
  }
  if (!edit) {
    throw new Error(`Interface ${interfaceName} not found in ${filePath}.`);
  }
  return { before: text, after: applyTextEdits(text, [edit]) };
}

export async function renameIdentifierText(cwd: string, filePath: string, oldName: string, newName: string): Promise<{ before: string; after: string; replacements: number }> {
  const { text, source } = await readSourceFile(cwd, filePath);
  const edits: Array<{ start: number; end: number; text: string }> = [];

  const visit = (node: ts.Node) => {
    if (ts.isIdentifier(node) && node.text === oldName) {
      edits.push({ start: node.getStart(source), end: node.getEnd(), text: newName });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);

  return {
    before: text,
    after: applyTextEdits(text, edits),
    replacements: edits.length,
  };
}

function collectImportModules(source: ts.SourceFile): string[] {
  return source.statements
    .filter(ts.isImportDeclaration)
    .map((statement) => statement.moduleSpecifier)
    .filter(ts.isStringLiteral)
    .map((literal) => literal.text);
}

function collectExportNames(source: ts.SourceFile, text: string, filePath: string): string[] {
  return collectSymbolsFromFile(filePath, text, source)
    .filter((entry) => entry.exported)
    .map((entry) => entry.name);
}

function keywords(query: string): string[] {
  return Array.from(new Set(query.toLowerCase().match(/[a-z0-9_./-]{3,}/g) ?? []));
}

export async function buildContextPack(cwd: string, query: string, contextBudgetLimit: number, maxFiles = 5): Promise<ContextPack> {
  const files = await walkSourceFiles(cwd);
  const terms = keywords(query);
  const scored: Array<{ filePath: string; score: number; text: string; source: ts.SourceFile }> = [];

  for (const filePath of files) {
    const { text, source } = await readSourceFile(cwd, filePath);
    const lower = `${filePath}\n${text}`.toLowerCase();
    const score = terms.reduce((sum, term) => sum + (lower.includes(term) ? 1 : 0), 0);
    if (score > 0) {
      scored.push({ filePath, score, text, source });
    }
  }

  const fileCards: FileCard[] = scored
    .sort((left, right) => right.score - left.score || left.filePath.localeCompare(right.filePath))
    .slice(0, maxFiles)
    .map(({ filePath, text, source }) => {
      const symbols = collectSymbolsFromFile(filePath, text, source);
      const imports = collectImportModules(source);
      const relevantSnippets = symbols.slice(0, 3).map((symbol) => {
        const startLine = Math.max(1, symbol.line - 2);
        const lines = text.split('\n').slice(startLine - 1, startLine + 8);
        return {
          startLine,
          endLine: startLine + lines.length - 1,
          content: lines.join('\n'),
        };
      });
      return {
        filePath,
        exports: collectExportNames(source, text, filePath).slice(0, 12),
        keyMethods: symbols.filter((symbol) => ['function', 'method', 'component', 'class'].includes(symbol.kind)).map((symbol) => symbol.name).slice(0, 12),
        imports: imports.slice(0, 12),
        relevantSnippets,
      };
    });

  const serialized = JSON.stringify(fileCards);
  return {
    query,
    filesIncluded: fileCards.length,
    snippetsIncluded: fileCards.reduce((sum, card) => sum + card.relevantSnippets.length, 0),
    contextBudgetUsed: Math.min(serialized.length, contextBudgetLimit),
    contextBudgetLimit,
    fileCards,
  };
}
