/**
 * GitHub Issue Planner
 * Generates implementation plans for scored issues
 * 
 * Usage: node planner.js <issue-url>
 * Example: node planner.js https://github.com/owner/repo/issues/123
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Parse GitHub URL
function parseGitHubUrl(url) {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)\/issues\/(\d+)/);
  if (!match) return null;
  return {
    owner: match[1],
    repo: match[2],
    issueNumber: match[3]
  };
}

// Fetch issue details
function fetchIssue(owner, repo, number, callback) {
  const options = {
    hostname: 'api.github.com',
    path: `/repos/${owner}/${repo}/issues/${number}`,
    method: 'GET',
    headers: {
      'User-Agent': 'OpenClaw-GitHub-Planner',
      'Accept': 'application/vnd.github.v3+json'
    }
  };
  
  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const issue = JSON.parse(data);
        if (res.statusCode === 200) {
          callback(null, issue);
        } else {
          callback(new Error(issue.message || `HTTP ${res.statusCode}`));
        }
      } catch (err) {
        callback(err);
      }
    });
  });
  
  req.on('error', callback);
  req.end();
}

// Fetch repo contents to understand structure
function fetchRepoContents(owner, repo, path = '', callback) {
  const options = {
    hostname: 'api.github.com',
    path: `/repos/${owner}/${repo}/contents/${path}`,
    method: 'GET',
    headers: {
      'User-Agent': 'OpenClaw-GitHub-Planner',
      'Accept': 'application/vnd.github.v3+json'
    }
  };
  
  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const contents = JSON.parse(data);
        callback(null, Array.isArray(contents) ? contents : [contents]);
      } catch (err) {
        callback(err);
      }
    });
  });
  
  req.on('error', callback);
  req.end();
}

// Generate plan based on issue
function generatePlan(issue, repoStructure) {
  const title = issue.title.toLowerCase();
  const body = (issue.body || '').toLowerCase();
  
  // Detect issue type
  let type = 'general';
  if (title.includes('bug') || title.includes('fix') || title.includes('crash') || title.includes('error')) {
    type = 'bugfix';
  } else if (title.includes('feature') || title.includes('add') || title.includes('support')) {
    type = 'feature';
  } else if (title.includes('doc') || title.includes('readme')) {
    type = 'documentation';
  } else if (title.includes('test')) {
    type = 'testing';
  } else if (title.includes('refactor') || title.includes('clean')) {
    type = 'refactoring';
  }
  
  // Estimate complexity
  let complexity = 'MEDIUM';
  const complexityIndicators = {
    low: ['typo', 'doc', 'comment', 'readme', 'link', 'simple'],
    high: ['refactor', 'architecture', 'breaking', 'redesign', 'migrate']
  };
  
  if (complexityIndicators.low.some(w => title.includes(w) || body.includes(w))) {
    complexity = 'LOW';
  } else if (complexityIndicators.high.some(w => title.includes(w) || body.includes(w))) {
    complexity = 'HIGH';
  }
  
  // Generate approach
  const approaches = {
    bugfix: [
      '1. Reproduce the issue locally',
      '2. Identify root cause in codebase',
      '3. Implement minimal fix',
      '4. Add regression test',
      '5. Verify fix resolves issue'
    ],
    feature: [
      '1. Understand current behavior',
      '2. Design minimal implementation',
      '3. Add feature flag if needed',
      '4. Implement core functionality',
      '5. Add tests and documentation'
    ],
    documentation: [
      '1. Review current documentation',
      '2. Identify gaps or errors',
      '3. Update relevant sections',
      '4. Add examples if needed',
      '5. Verify formatting and links'
    ],
    testing: [
      '1. Identify untested code paths',
      '2. Write unit tests',
      '3. Add integration tests if needed',
      '4. Ensure coverage targets met',
      '5. Verify all tests pass'
    ],
    refactoring: [
      '1. Analyze current implementation',
      '2. Identify improvement areas',
      '3. Plan incremental changes',
      '4. Ensure tests pass throughout',
      '5. Verify no behavior changes'
    ],
    general: [
      '1. Understand issue context',
      '2. Research relevant code',
      '3. Propose solution approach',
      '4. Implement changes',
      '5. Test and validate'
    ]
  };
  
  // Estimate files to touch
  const fileEstimates = {
    bugfix: '1-3 files',
    feature: '3-8 files',
    documentation: '1-2 files',
    testing: '2-4 files',
    refactoring: '3-10 files',
    general: '1-5 files'
  };
  
  // Risk assessment
  const risks = [];
  if (complexity === 'HIGH') risks.push('High complexity - may need breaking changes');
  if (issue.labels.some(l => l.name.includes('breaking'))) risks.push('Breaking change - needs migration guide');
  if (!issue.labels.some(l => l.name.includes('test'))) risks.push('No test label - may need test coverage');
  if (body.length < 100) risks.push('Sparse issue description - may need clarification');
  
  return {
    type,
    complexity,
    approach: approaches[type],
    estimatedFiles: fileEstimates[type],
    risks: risks.length > 0 ? risks : ['No major risks identified'],
    timeEstimate: complexity === 'LOW' ? '1-2 hours' : complexity === 'MEDIUM' ? '2-4 hours' : '4-8 hours',
    needsTests: type !== 'documentation',
    needsDocs: type === 'feature' || type === 'refactoring'
  };
}

// Main function
function main() {
  const issueUrl = process.argv[2];
  
  if (!issueUrl) {
    console.log('📋 GitHub Issue Planner');
    console.log('');
    console.log('Usage: node planner.js <issue-url>');
    console.log('Example: node planner.js https://github.com/facebook/react/issues/12345');
    console.log('');
    process.exit(1);
  }
  
  const parsed = parseGitHubUrl(issueUrl);
  if (!parsed) {
    console.error('❌ Invalid GitHub issue URL');
    process.exit(1);
  }
  
  console.log(`🔍 Analyzing issue #${parsed.issueNumber}...\n`);
  
  fetchIssue(parsed.owner, parsed.repo, parsed.issueNumber, (err, issue) => {
    if (err) {
      console.error('❌ Error fetching issue:', err.message);
      process.exit(1);
    }
    
    console.log(`Issue: ${issue.title}`);
    console.log(`State: ${issue.state}`);
    console.log(`Labels: ${issue.labels.map(l => l.name).join(', ') || 'None'}`);
    console.log('');
    
    // Generate plan
    const plan = generatePlan(issue, null);
    
    console.log('📋 IMPLEMENTATION PLAN');
    console.log('======================');
    console.log('');
    console.log(`Type: ${plan.type.toUpperCase()}`);
    console.log(`Complexity: ${plan.complexity}`);
    console.log(`Estimated Time: ${plan.timeEstimate}`);
    console.log(`Files to Touch: ${plan.estimatedFiles}`);
    console.log('');
    console.log('Approach:');
    plan.approach.forEach(step => console.log(`  ${step}`));
    console.log('');
    console.log('⚠️  Risks:');
    plan.risks.forEach(risk => console.log(`  - ${risk}`));
    console.log('');
    console.log('✅ Checklist:');
    console.log(`  [ ] ${plan.needsTests ? 'Add tests' : 'N/A - no tests needed'}`);
    console.log(`  [ ] ${plan.needsDocs ? 'Update documentation' : 'N/A - no docs needed'}`);
    console.log('  [ ] Run linting');
    console.log('  [ ] Verify all tests pass');
    console.log('  [ ] Create PR with clear description');
    console.log('');
    
    // Save plan
    const planData = {
      created_at: new Date().toISOString(),
      issue: {
        number: issue.number,
        title: issue.title,
        url: issue.html_url,
        state: issue.state,
        labels: issue.labels.map(l => l.name)
      },
      plan
    };
    
    const filename = `plan-${parsed.repo}-${issue.number}.json`;
    fs.writeFileSync(filename, JSON.stringify(planData, null, 2));
    console.log(`✅ Plan saved to ${filename}`);
  });
}

main();
