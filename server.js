const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration
const SKILLS_REPO_PATH = process.env.SKILLS_REPO_PATH || path.join(__dirname, 'skills_repo');
const GLOBAL_SKILLS_PATH = process.env.GLOBAL_SKILLS_PATH || path.join(os.homedir(), '.config', 'opencode', 'skill');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Parse SKILL.md frontmatter to extract name, description, category, and tags
 */
function parseSkillMd(content) {
  const result = { name: '', description: '', category: 'Other', tags: [] };

  // Check for YAML frontmatter
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (frontmatterMatch) {
    const frontmatter = frontmatterMatch[1];

    // Extract name
    const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
    if (nameMatch) {
      result.name = nameMatch[1].trim().replace(/^["']|["']$/g, '');
    }

    // Extract description
    const descMatch = frontmatter.match(/^description:\s*(.+)$/m);
    if (descMatch) {
      result.description = descMatch[1].trim().replace(/^["']|["']$/g, '');
    }

    // Extract category
    const categoryMatch = frontmatter.match(/^category:\s*(.+)$/m);
    if (categoryMatch) {
      result.category = categoryMatch[1].trim().replace(/^["']|["']$/g, '');
    }

    // Extract tags (comma-separated or YAML array)
    const tagsMatch = frontmatter.match(/^tags:\s*(.+)$/m);
    if (tagsMatch) {
      const tagsStr = tagsMatch[1].trim();
      // Handle both formats: "tag1, tag2" or "[tag1, tag2]"
      const cleanTags = tagsStr.replace(/^\[|\]$/g, '');
      result.tags = cleanTags.split(',').map(t => t.trim().replace(/^["']|["']$/g, '')).filter(t => t);
    }
  }

  return result;
}

/**
 * Helper function to list skills from a directory
 */
async function listSkillsFromDir(dirPath) {
  const skills = [];

  if (!await fs.pathExists(dirPath)) {
    return skills;
  }

  const items = await fs.readdir(dirPath, { withFileTypes: true });

  for (const item of items) {
    if (item.isDirectory()) {
      const skillPath = path.join(dirPath, item.name);
      const skillMdPath = path.join(skillPath, 'SKILL.md');

      let skillInfo = {
        id: item.name,
        name: item.name,
        description: 'No description available',
        category: 'Other',
        tags: [],
        path: skillPath
      };

      if (await fs.pathExists(skillMdPath)) {
        try {
          const content = await fs.readFile(skillMdPath, 'utf-8');
          const parsed = parseSkillMd(content);
          if (parsed.name) skillInfo.name = parsed.name;
          if (parsed.description) skillInfo.description = parsed.description;
          if (parsed.category) skillInfo.category = parsed.category;
          if (parsed.tags) skillInfo.tags = parsed.tags;
        } catch (err) {
          console.error(`Error reading SKILL.md for ${item.name}:`, err.message);
        }
      }

      skills.push(skillInfo);
    }
  }

  return skills;
}

/**
 * GET /api/installed - List installed skills (global and/or project)
 * Query: ?type=global|project|all&projectPath=/path/to/project
 */
app.get('/api/installed', async (req, res) => {
  try {
    const { type = 'all', projectPath } = req.query;
    const result = {
      global: [],
      project: []
    };

    // Get global installed skills
    if (type === 'all' || type === 'global') {
      result.global = await listSkillsFromDir(GLOBAL_SKILLS_PATH);
    }

    // Get project installed skills
    if ((type === 'all' || type === 'project') && projectPath) {
      const expandedPath = projectPath.replace(/^~/, os.homedir());
      const projectSkillsPath = path.join(expandedPath, '.opencode', 'skill');
      result.project = await listSkillsFromDir(projectSkillsPath);
    }

    res.json({ success: true, installed: result });
  } catch (error) {
    console.error('Error listing installed skills:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/skills - List all available skills
 */
app.get('/api/skills', async (req, res) => {
  try {
    // Ensure skills repo exists
    await fs.ensureDir(SKILLS_REPO_PATH);

    const items = await fs.readdir(SKILLS_REPO_PATH, { withFileTypes: true });
    const skills = [];
    const categoriesSet = new Set();

    for (const item of items) {
      if (item.isDirectory()) {
        const skillPath = path.join(SKILLS_REPO_PATH, item.name);
        const skillMdPath = path.join(skillPath, 'SKILL.md');

        let skillInfo = {
          id: item.name,
          name: item.name,
          description: 'No description available',
          category: 'Other',
          tags: [],
          path: skillPath
        };

        // Try to read SKILL.md for metadata
        if (await fs.pathExists(skillMdPath)) {
          try {
            const content = await fs.readFile(skillMdPath, 'utf-8');
            const parsed = parseSkillMd(content);
            if (parsed.name) skillInfo.name = parsed.name;
            if (parsed.description) skillInfo.description = parsed.description;
            if (parsed.category) skillInfo.category = parsed.category;
            if (parsed.tags) skillInfo.tags = parsed.tags;
          } catch (err) {
            console.error(`Error reading SKILL.md for ${item.name}:`, err.message);
          }
        }

        categoriesSet.add(skillInfo.category);
        skills.push(skillInfo);
      }
    }

    // Sort categories alphabetically, but keep "Other" at the end
    const categories = Array.from(categoriesSet).sort((a, b) => {
      if (a === 'Other') return 1;
      if (b === 'Other') return -1;
      return a.localeCompare(b);
    });

    res.json({ success: true, skills, categories });
  } catch (error) {
    console.error('Error listing skills:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/skills/:name - Get specific skill details
 */
app.get('/api/skills/:name', async (req, res) => {
  try {
    const skillPath = path.join(SKILLS_REPO_PATH, req.params.name);

    if (!await fs.pathExists(skillPath)) {
      return res.status(404).json({ success: false, error: 'Skill not found' });
    }

    const skillMdPath = path.join(skillPath, 'SKILL.md');
    let content = '';
    let skillInfo = {
      id: req.params.name,
      name: req.params.name,
      description: 'No description available',
      content: ''
    };

    if (await fs.pathExists(skillMdPath)) {
      content = await fs.readFile(skillMdPath, 'utf-8');
      const parsed = parseSkillMd(content);
      if (parsed.name) skillInfo.name = parsed.name;
      if (parsed.description) skillInfo.description = parsed.description;
      skillInfo.content = content;
    }

    // Get list of files in skill directory
    const files = await fs.readdir(skillPath, { withFileTypes: true });
    skillInfo.files = files.map(f => ({
      name: f.name,
      isDirectory: f.isDirectory()
    }));

    res.json({ success: true, skill: skillInfo });
  } catch (error) {
    console.error('Error getting skill details:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/config - Get configuration options
 */
app.get('/api/config', (req, res) => {
  res.json({
    success: true,
    config: {
      skillsRepoPath: SKILLS_REPO_PATH,
      globalSkillsPath: GLOBAL_SKILLS_PATH,
      destinations: [
        { id: 'global', name: 'Global (OpenCode)', path: GLOBAL_SKILLS_PATH },
        { id: 'project', name: 'Project', path: '.opencode/skill' }
      ]
    }
  });
});

/**
 * POST /api/download - Copy skill to destination
 * Body: { skillId: string, destination: 'global' | 'project', projectPath?: string }
 */
app.post('/api/download', async (req, res) => {
  try {
    const { skillId, destination, projectPath } = req.body;

    if (!skillId) {
      return res.status(400).json({ success: false, error: 'skillId is required' });
    }

    if (!destination) {
      return res.status(400).json({ success: false, error: 'destination is required' });
    }

    const sourcePath = path.join(SKILLS_REPO_PATH, skillId);

    if (!await fs.pathExists(sourcePath)) {
      return res.status(404).json({ success: false, error: 'Skill not found' });
    }

    let destPath;
    if (destination === 'global') {
      destPath = path.join(GLOBAL_SKILLS_PATH, skillId);
    } else if (destination === 'project') {
      if (!projectPath) {
        return res.status(400).json({ success: false, error: 'projectPath is required for project destination' });
      }
      // Expand ~ to home directory
      const expandedProjectPath = projectPath.replace(/^~/, os.homedir());
      destPath = path.join(expandedProjectPath, '.opencode', 'skill', skillId);
    } else {
      return res.status(400).json({ success: false, error: 'Invalid destination' });
    }

    // Ensure destination directory exists
    await fs.ensureDir(path.dirname(destPath));

    // Copy skill directory
    await fs.copy(sourcePath, destPath, { overwrite: true });

    res.json({
      success: true,
      message: `Skill "${skillId}" copied successfully`,
      destination: destPath
    });
  } catch (error) {
    console.error('Error copying skill:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Skill Manager running at http://localhost:${PORT}`);
  console.log(`📁 Skills repository: ${SKILLS_REPO_PATH}`);
  console.log(`🌍 Global skills path: ${GLOBAL_SKILLS_PATH}`);
});
