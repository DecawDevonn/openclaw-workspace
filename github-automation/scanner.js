/**
 * GitHub Issue Scanner
 * Lightweight automation for finding and scoring "good first issues"
 * 
 * Usage: node scanner.js [owner/repo]
 * Example: node scanner.js facebook/react
 */

const https = require('https');

// Simple scoring based on issue metadata
function scoreIssue(issue) {
  let score = 50; // base score
  const reasons = [];
  
  // Boost for good first issue label
  if (issue.labels.some(l => l.name.toLowerCase().includes('good first issue'))) {
    score += 25;
    reasons.push('Good first issue label');
  }
  
  // Boost for help wanted
  if (issue.labels.some(l => l.name.toLowerCase().includes('help wanted'))) {
    score += 15;
    reasons.push('Help wanted');
  }
  
  // Boost for documentation
  if (issue.labels.some(l => l.name.toLowerCase().includes('documentation'))) {
    score += 10;
    reasons.push('Documentation');
  }
  
  // Penalty for complexity indicators
  const complexityWords = ['refactor', 'architecture', 'breaking', 'major'];
  const titleLower = issue.title.toLowerCase();
  if (complexityWords.some(w => titleLower.includes(w))) {
    score -= 20;
    reasons.push('Complexity keywords detected');
  }
  
  // Boost for recent activity
  const daysSinceUpdate = (Date.now() - new Date(issue.updated_at)) / (1000 * 60 * 60 * 24);
  if (daysSinceUpdate < 7) {
    score += 10;
    reasons.push('Recently updated');
  }
  
  // Penalty for very old issues
  if (daysSinceUpdate > 90) {
    score -= 15;
    reasons.push('Stale issue (>90 days)');
  }
  
  // Boost for short, clear titles
  if (issue.title.length < 50 && issue.title.length > 10) {
    score += 5;
    reasons.push('Clear title');
  }
  
  return {
    score: Math.max(0, Math.min(100, score)),
    reasons,
    complexity: score > 75 ? 'LOW' : score > 50 ? 'MEDIUM' : 'HIGH'
  };
}

// Fetch issues from GitHub API
function fetchIssues(repo, callback) {
  const options = {
    hostname: 'api.github.com',
    path: `/repos/${repo}/issues?state=open&per_page=30`,
    method: 'GET',
    headers: {
      'User-Agent': 'OpenClaw-GitHub-Scanner',
      'Accept': 'application/vnd.github.v3+json'
    }
  };
  
  const req = https.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const issues = JSON.parse(data);
        if (res.statusCode === 200) {
          callback(null, issues.filter(i => !i.pull_request)); // exclude PRs
        } else {
          callback(new Error(`GitHub API error: ${issues.message || res.statusCode}`));
        }
      } catch (err) {
        callback(err);
      }
    });
  });
  
  req.on('error', callback);
  req.end();
}

// Main function
function main() {
  const repo = process.argv[2];
  
  if (!repo || !repo.includes('/')) {
    console.log('📋 GitHub Issue Scanner');
    console.log('');
    console.log('Usage: node scanner.js <owner/repo>');
    console.log('Example: node scanner.js facebook/react');
    console.log('');
    process.exit(1);
  }
  
  console.log(`🔍 Scanning ${repo} for good first issues...\n`);
  
  fetchIssues(repo, (err, issues) => {
    if (err) {
      console.error('❌ Error:', err.message);
      process.exit(1);
    }
    
    if (issues.length === 0) {
      console.log('No open issues found.');
      return;
    }
    
    // Score and sort issues
    const scored = issues.map(issue => ({
      ...issue,
      scoring: scoreIssue(issue)
    })).sort((a, b) => b.scoring.score - a.scoring.score);
    
    // Filter for good candidates (score > 60)
    const candidates = scored.filter(i => i.scoring.score > 60);
    
    console.log(`Found ${issues.length} open issues`);
    console.log(`Top ${Math.min(candidates.length, 10)} candidates:\n`);
    
    candidates.slice(0, 10).forEach((issue, idx) => {
      const s = issue.scoring;
      console.log(`${idx + 1}. [${s.complexity}] ${issue.title}`);
      console.log(`   Score: ${s.score}/100 | #${issue.number}`);
      console.log(`   URL: ${issue.html_url}`);
      console.log(`   Why: ${s.reasons.join(', ')}`);
      console.log('');
    });
    
    // Save results
    const results = {
      scanned_at: new Date().toISOString(),
      repo: repo,
      total_issues: issues.length,
      candidates: candidates.map(i => ({
        number: i.number,
        title: i.title,
        url: i.html_url,
        score: i.scoring.score,
        complexity: i.scoring.complexity,
        reasons: i.scoring.reasons
      }))
    };
    
    require('fs').writeFileSync(
      'scan-results.json',
      JSON.stringify(results, null, 2)
    );
    
    console.log('✅ Results saved to scan-results.json');
  });
}

main();
