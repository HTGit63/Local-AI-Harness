import * as fs from 'fs/promises';
import * as path from 'path';

const DIVISIONS = [
  'engineering',
  'design',
  'product',
  'specialized',
  'testing',
  'project-management',
  'support',
  'strategy',
  'marketing',
  'sales',
  'academic',
  'game-development',
  'spatial-computing',
  'paid-media',
];

const CURATED_SLUGS = [
  'frontend-developer',
  'backend-architect',
  'rapid-prototyper',
  'code-reviewer',
  'technical-writer',
  'product-manager',
  'reality-checker',
  'workflow-architect',
  'mcp-builder',
  'software-architect',
  'database-optimizer',
  'security-engineer',
];

export interface SkillMetadata {
  slug: string;
  title: string;
  division: string;
  description: string;
  sourceFile: string;
  sourceRepo: string;
  tags: string[];
  recommendedUse: string;
  riskLevel: string;
}

interface IndexSkillsOptions {
  rootDir?: string;
  outputDir?: string;
}

function parseFrontmatter(content: string): Record<string, string> {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    return {};
  }

  const values: Record<string, string> = {};
  for (const line of frontmatterMatch[1].split('\n')) {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key) {
      values[key] = value;
    }
  }

  return values;
}

function extractSection(content: string, heading: string): string | null {
  const regex = new RegExp(`^##\\s+${heading}\\s*\\n([\\s\\S]*?)(?=^##\\s+|^#\\s+|\\Z)`, 'im');
  const match = content.match(regex);
  if (!match) {
    return null;
  }

  const firstMeaningfulLine = match[1]
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !line.startsWith('-'));

  return firstMeaningfulLine || null;
}

function inferRiskLevel(content: string): string {
  const lowerContent = content.toLowerCase();
  if (
    lowerContent.includes('privilege escalation') ||
    lowerContent.includes('delete production') ||
    lowerContent.includes('security-critical') ||
    lowerContent.includes('system modification')
  ) {
    return 'High';
  }

  if (
    lowerContent.includes('security') ||
    lowerContent.includes('approval') ||
    lowerContent.includes('compliance') ||
    lowerContent.includes('database migration')
  ) {
    return 'Medium';
  }

  return 'Low';
}

function toSkillMetadata(rootDir: string, division: string, filePath: string, content: string): SkillMetadata {
  const frontmatter = parseFrontmatter(content);
  const slug = path.basename(filePath, '.md');
  const title =
    frontmatter.name ||
    content.match(/^#\s+(.*)/m)?.[1]?.trim() ||
    slug.replace(/-/g, ' ');
  const description =
    frontmatter.description ||
    extractSection(content, 'Core Mission') ||
    extractSection(content, 'Role') ||
    'Agent definition.';
  const recommendedUse =
    extractSection(content, 'Recommended Use') ||
    extractSection(content, 'Core Mission') ||
    'General use.';

  return {
    slug,
    title,
    division,
    description,
    sourceFile: filePath.replace(rootDir, 'third_party/agency-agents'),
    sourceRepo: 'agency-agents',
    tags: [division, 'agent', slug],
    recommendedUse,
    riskLevel: inferRiskLevel(content),
  };
}

export async function indexSkills(options: IndexSkillsOptions = {}) {
  const rootDir = path.resolve(options.rootDir || path.join(__dirname, '../../../third_party/agency-agents'));
  const outDir = path.resolve(options.outputDir || path.join(__dirname, '../dist'));
  const skills: SkillMetadata[] = [];

  for (const division of DIVISIONS) {
    const divisionPath = path.join(rootDir, division);
    try {
      const files = await fs.readdir(divisionPath);
      for (const file of files) {
        if (!file.endsWith('.md') || file === 'README.md') {
          continue;
        }

        const filePath = path.join(divisionPath, file);
        const content = await fs.readFile(filePath, 'utf8');
        skills.push(toSkillMetadata(rootDir, division, filePath, content));
      }
    } catch {
      continue;
    }
  }

  const curated = skills.filter((skill) => CURATED_SLUGS.some((slug) => skill.slug.includes(slug)));

  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, 'all_skills.json'), JSON.stringify(skills, null, 2));
  await fs.writeFile(path.join(outDir, 'curated_pack.json'), JSON.stringify(curated, null, 2));

  const antigravityDir = path.join(outDir, 'antigravity_exports');
  await fs.rm(antigravityDir, { recursive: true, force: true });
  await fs.mkdir(antigravityDir, { recursive: true });

  for (const skill of curated) {
    const skillDir = path.join(antigravityDir, skill.slug);
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(
      path.join(skillDir, 'SKILL.md'),
      [
        '---',
        `name: ${skill.title}`,
        `description: ${skill.description}`,
        '---',
        `# ${skill.title}`,
        '',
        `Source: ${skill.sourceFile}`,
        `Division: ${skill.division}`,
        `Recommended Use: ${skill.recommendedUse}`,
        `Risk Level: ${skill.riskLevel}`,
        '',
        `You are acting as ${skill.title}. Follow the source role guidance while staying within the harness safety model.`,
        '',
      ].join('\n'),
      'utf8',
    );
  }

  return { skills, curated, outDir, antigravityDir };
}

export async function loadCuratedSkills(outputDir = path.resolve(path.join(__dirname, '../dist'))): Promise<SkillMetadata[]> {
  const raw = await fs.readFile(path.join(outputDir, 'curated_pack.json'), 'utf8');
  return JSON.parse(raw) as SkillMetadata[];
}

if (require.main === module) {
  indexSkills()
    .then(({ skills, curated }) => {
      console.log(`Indexed ${skills.length} total skills.`);
      console.log(`Extracted ${curated.length} curated skills for local coding environment.`);
    })
    .catch((error) => {
      console.error('Indexer failed:', error);
      process.exit(1);
    });
}
