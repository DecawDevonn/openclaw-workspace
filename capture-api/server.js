/**
 * Minimal Capture API v1
 * Lightweight ingestion endpoint for Quick-Capture v2
 * 
 * Features:
 * - POST /capture - ingest new captures
 * - GET /captures - list recent captures
 * - GET /health - status check
 * 
 * Storage: File-based (no database needed)
 * Classification: Rule-based (no LLM needed)
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.CAPTURE_PORT || 3456;

// Middleware
app.use(cors());
app.use(express.json());

// Paths
const CAPTURE_DIR = path.join(__dirname, '..', 'capture');
const INDEX_FILE = path.join(CAPTURE_DIR, 'index.json');

// Ensure capture directory exists
async function ensureDir() {
  try {
    await fs.mkdir(CAPTURE_DIR, { recursive: true });
  } catch (err) {
    console.error('Failed to create capture directory:', err);
  }
}

// Simple rule-based classification
function classifyCapture(text) {
  const lower = text.toLowerCase();
  
  // Todo patterns
  if (/\b(need to|should|must|todo|task|remember to|don't forget|call|email|send|review|check|fix|build|deploy)\b/.test(lower)) {
    return 'todo';
  }
  
  // Idea patterns
  if (/\b(idea|what if|could|maybe|consider|think about|proposal|suggestion)\b/.test(lower)) {
    return 'idea';
  }
  
  // Note patterns
  if (/\b(note|info|details|contact|number|address|link|url)\b/.test(lower)) {
    return 'note';
  }
  
  // Thought patterns
  if (/\b(thought|thinking|feel|opinion|wonder|reflect)\b/.test(lower)) {
    return 'thought';
  }
  
  return 'note'; // default
}

// Extract department hint
function extractDepartment(text) {
  const lower = text.toLowerCase();
  
  if (/\b(api|code|build|deploy|bug|fix|github|database|server|backend|frontend|dev|programming|script)\b/.test(lower)) {
    return 'engineering';
  }
  if (/\b(ad|seo|content|campaign|social|blog|brand|marketing|ads)\b/.test(lower)) {
    return 'marketing';
  }
  if (/\b(lead|deal|proposal|client|contract|revenue|sales|pitch|customer)\b/.test(lower)) {
    return 'sales';
  }
  if (/\b(help|issue|ticket|problem|question|support|bug report)\b/.test(lower)) {
    return 'support';
  }
  
  return 'personal';
}

// Extract simple tags
function extractTags(text) {
  const tags = [];
  const words = text.toLowerCase().split(/\s+/);
  
  // Common tech/business keywords
  const keywords = [
    'api', 'stripe', 'github', 'database', 'server', 'frontend', 'backend',
    'email', 'meeting', 'call', 'review', 'design', 'product', 'feature',
    'bug', 'fix', 'deploy', 'test', 'code', 'script', 'automation',
    'content', 'seo', 'blog', 'social', 'ad', 'campaign',
    'client', 'deal', 'contract', 'proposal', 'revenue'
  ];
  
  keywords.forEach(kw => {
    if (text.toLowerCase().includes(kw) && !tags.includes(kw)) {
      tags.push(kw);
    }
  });
  
  return tags.slice(0, 5); // max 5 tags
}

// Detect priority
function detectPriority(text, type) {
  const lower = text.toLowerCase();
  
  if (/\b(urgent|asap|critical|blocking|emergency|now|today)\b/.test(lower)) {
    return 'urgent';
  }
  if (/\b(important|high priority|needed|should|this week|deadline)\b/.test(lower)) {
    return 'high';
  }
  if (/\b(someday|maybe|whenever|eventually|low priority)\b/.test(lower)) {
    return 'low';
  }
  
  return type === 'todo' ? 'medium' : 'low';
}

// Read index
async function readIndex() {
  try {
    const data = await fs.readFile(INDEX_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return { version: '2.0', captures: [], stats: {} };
  }
}

// Write index
async function writeIndex(index) {
  await fs.writeFile(INDEX_FILE, JSON.stringify(index, null, 2));
}

// Append to markdown file
async function appendToFile(type, entry) {
  const filename = type + 's.md'; // todos.md, ideas.md, etc.
  const filepath = path.join(CAPTURE_DIR, filename);
  
  const date = new Date().toISOString().split('T')[0];
  const dateHeader = `## ${date} (${new Date().toLocaleDateString('en-US', { weekday: 'long' })}`;
  
  let content;
  if (type === 'todo') {
    content = `- [ ] [${entry.department}] ${entry.content} — *captured via ${entry.source}*\n  Tags: ${entry.tags.map(t => '#' + t).join(' ')}\n  Priority: ${entry.priority} | ID: ${entry.id}\n`;
  } else {
    content = `- [${entry.department}] ${entry.content} — *captured via ${entry.source}*\n  Tags: ${entry.tags.map(t => '#' + t).join(' ')}\n  Priority: ${entry.priority} | ID: ${entry.id}\n`;
  }
  
  try {
    let fileContent = await fs.readFile(filepath, 'utf8');
    // Check if date header exists
    if (!fileContent.includes(dateHeader)) {
      fileContent += `\n${dateHeader}\n`;
    }
    fileContent += content;
    await fs.writeFile(filepath, fileContent);
  } catch {
    // File doesn't exist, create it
    const header = `# ${type.charAt(0).toUpperCase() + type.slice(1)}s\n\n${dateHeader}\n${content}`;
    await fs.writeFile(filepath, header);
  }
}

// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'capture-api',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Ingest capture
app.post('/capture', async (req, res) => {
  try {
    const { text, source = 'api', metadata = {} } = req.body;
    
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'text is required' });
    }
    
    // Process
    const type = classifyCapture(text);
    const department = extractDepartment(text);
    const tags = extractTags(text);
    const priority = detectPriority(text, type);
    
    const capture = {
      id: 'cap_' + uuidv4().slice(0, 8),
      type,
      content: text.trim(),
      department,
      tags,
      priority,
      source,
      timestamp: Date.now(),
      date: new Date().toISOString().split('T')[0],
      metadata
    };
    
    // Save to file
    await appendToFile(type, capture);
    
    // Update index
    const index = await readIndex();
    index.captures.unshift(capture);
    index.total_captures = index.captures.length;
    await writeIndex(index);
    
    res.json({
      status: 'captured',
      capture: {
        id: capture.id,
        type: capture.type,
        department: capture.department,
        priority: capture.priority,
        tags: capture.tags
      }
    });
    
  } catch (err) {
    console.error('Capture error:', err);
    res.status(500).json({ error: 'Failed to capture', message: err.message });
  }
});

// List recent captures
app.get('/captures', async (req, res) => {
  try {
    const { limit = 10, type, department } = req.query;
    const index = await readIndex();
    
    let captures = index.captures;
    
    if (type) {
      captures = captures.filter(c => c.type === type);
    }
    if (department) {
      captures = captures.filter(c => c.department === department);
    }
    
    captures = captures.slice(0, parseInt(limit));
    
    res.json({
      total: index.captures.length,
      returned: captures.length,
      captures
    });
    
  } catch (err) {
    res.status(500).json({ error: 'Failed to read captures' });
  }
});

// Get single capture
app.get('/captures/:id', async (req, res) => {
  try {
    const index = await readIndex();
    const capture = index.captures.find(c => c.id === req.params.id);
    
    if (!capture) {
      return res.status(404).json({ error: 'Capture not found' });
    }
    
    res.json({ capture });
    
  } catch (err) {
    res.status(500).json({ error: 'Failed to read capture' });
  }
});

// Search captures
app.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ error: 'Query parameter q is required' });
    }
    
    const index = await readIndex();
    const query = q.toLowerCase();
    
    const results = index.captures.filter(c => 
      c.content.toLowerCase().includes(query) ||
      c.tags.some(t => t.includes(query)) ||
      c.department.includes(query)
    );
    
    res.json({
      query: q,
      results: results.slice(0, 20)
    });
    
  } catch (err) {
    res.status(500).json({ error: 'Search failed' });
  }
});

// Start server
async function start() {
  await ensureDir();
  app.listen(PORT, () => {
    console.log(`📡 Capture API running on port ${PORT}`);
    console.log(`   POST /capture    - Ingest new capture`);
    console.log(`   GET  /captures   - List recent captures`);
    console.log(`   GET  /search?q=  - Search captures`);
    console.log(`   GET  /health     - Health check`);
  });
}

start().catch(console.error);
