#!/usr/bin/env node
/**
 * GitHub Monitor Agent
 * Monitors repos for workflow failures, open PRs, failed builds
 */

const GITHUB_API = 'https://api.github.com';

class GitHubMonitor {
  constructor(token, org = 'wesship') {
    this.token = token || process.env.GITHUB_TOKEN;
    this.org = org || process.env.ORGANIZATION || 'wesship';
  }

  async makeRequest(path) {
    const url = `${GITHUB_API}${path}`;
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Devonn-Scheduler'
      }
    });
    
    if (!res.ok) {
      throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
    }
    
    return await res.json();
  }

  /**
   * Check workflow runs for a repo
   */
  async checkWorkflowFailures(repo) {
    const data = await this.makeRequest(`/repos/${this.org}/${repo}/actions/runs?per_page=10`);
    const failed = data.workflow_runs?.filter(run => 
      run.conclusion === 'failure' || run.conclusion === 'cancelled'
    ) || [];
    
    return {
      repo,
      total: data.workflow_runs?.length || 0,
      failed: failed.length,
      recentFailures: failed.slice(0, 5).map(run => ({
        id: run.id,
        name: run.name,
        branch: run.head_branch,
        conclusion: run.conclusion,
        createdAt: run.created_at,
        url: run.html_url
      }))
    };
  }

  /**
   * Check open PRs for a repo
   */
  async checkOpenPRs(repo) {
    const data = await this.makeRequest(`/repos/${this.org}/${repo}/pulls?state=open&per_page=20`);
    
    return {
      repo,
      openCount: data.length,
      prs: data.map(pr => ({
        number: pr.number,
        title: pr.title,
        author: pr.user.login,
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
        draft: pr.draft,
        url: pr.html_url
      }))
    };
  }

  /**
   * Check recent commits
   */
  async checkRecentCommits(repo, since = null) {
    const sinceParam = since ? `&since=${since}` : '';
    const data = await this.makeRequest(`/repos/${this.org}/${repo}/commits?per_page=10${sinceParam}`);
    
    return {
      repo,
      commits: data.map(commit => ({
        sha: commit.sha.slice(0, 7),
        message: commit.commit.message.split('\n')[0],
        author: commit.commit.author.name,
        date: commit.commit.author.date,
        url: commit.html_url
      }))
    };
  }

  /**
   * Get repo health overview
   */
  async checkRepoHealth(repo) {
    const [repoInfo, workflows, issues] = await Promise.all([
      this.makeRequest(`/repos/${this.org}/${repo}`),
      this.makeRequest(`/repos/${this.org}/${repo}/actions/runs?per_page=5`).catch(() => ({ workflow_runs: [] })),
      this.makeRequest(`/repos/${this.org}/${repo}/issues?state=open&per_page=1`).catch(() => [])
    ]);

    const lastRun = workflows.workflow_runs?.[0];
    const lastFailure = workflows.workflow_runs?.find(r => r.conclusion === 'failure');
    
    return {
      repo,
      visibility: repoInfo.visibility,
      defaultBranch: repoInfo.default_branch,
      lastPush: repoInfo.pushed_at,
      openIssues: repoInfo.open_issues_count,
      health: {
        lastWorkflowStatus: lastRun?.conclusion || lastRun?.status || 'unknown',
        lastWorkflowName: lastRun?.name,
        lastFailure: lastFailure ? {
          name: lastFailure.name,
          date: lastFailure.created_at,
          url: lastFailure.html_url
        } : null
      }
    };
  }

  /**
   * Monitor all repos in org
   */
  async monitorAll(repos = null) {
    const targetRepos = repos || [
      'supreme-ai-deployment-hub',
      'central-orchestrator', 
      'openclaw-gateway',
      'openclaw-macmini',
      'devonn-autonomous-upgrade'
    ];

    const results = {
      timestamp: new Date().toISOString(),
      org: this.org,
      repos: {}
    };

    for (const repo of targetRepos) {
      try {
        results.repos[repo] = await this.checkRepoHealth(repo);
      } catch (err) {
        results.repos[repo] = { error: err.message };
      }
    }

    return results;
  }
}

/**
 * Execute GitHub monitor task
 */
export async function executeGitHubMonitor(payload) {
  const monitor = new GitHubMonitor(payload.token, payload.org);
  
  switch (payload.action) {
    case 'workflow_failures':
      return await monitor.checkWorkflowFailures(payload.repo);
    
    case 'open_prs':
      return await monitor.checkOpenPRs(payload.repo);
    
    case 'recent_commits':
      return await monitor.checkRecentCommits(payload.repo, payload.since);
    
    case 'repo_health':
      return await monitor.checkRepoHealth(payload.repo);
    
    case 'monitor_all':
      return await monitor.monitorAll(payload.repos);
    
    default:
      throw new Error(`Unknown action: ${payload.action}`);
  }
}

export { GitHubMonitor };
export default GitHubMonitor;
