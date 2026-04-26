#!/usr/bin/env node
/**
 * Repair Router Agent
 * Detects failed GitHub Actions and enqueues repair tasks
 */

const GITHUB_API = 'https://api.github.com';

class RepairRouter {
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
        'User-Agent': 'Devonn-RepairRouter'
      }
    });
    
    if (!res.ok) {
      throw new Error(`GitHub API error: ${res.status}`);
    }
    
    return await res.json();
  }

  /**
   * Get failed workflow runs
   */
  async getFailedRuns(repo, since = null) {
    const sinceParam = since ? `&created=>${since}` : '';
    const data = await this.makeRequest(
      `/repos/${this.org}/${repo}/actions/runs?status=completed&conclusion=failure&per_page=20${sinceParam}`
    );
    
    return data.workflow_runs?.map(run => ({
      id: run.id,
      name: run.name,
      branch: run.head_branch,
      commit: run.head_commit?.message?.slice(0, 50),
      commitSha: run.head_sha?.slice(0, 7),
      author: run.actor?.login,
      createdAt: run.created_at,
      failedAt: run.updated_at,
      url: run.html_url,
      logsUrl: run.logs_url
    })) || [];
  }

  /**
   * Get workflow run logs (metadata)
   */
  async getRunLogs(repo, runId) {
    try {
      // Get jobs for the run
      const jobs = await this.makeRequest(
        `/repos/${this.org}/${repo}/actions/runs/${runId}/jobs`
      );
      
      const failedJobs = jobs.jobs?.filter(j => j.conclusion === 'failure') || [];
      
      return failedJobs.map(job => ({
        jobName: job.name,
        failedSteps: job.steps?.filter(s => s.conclusion === 'failure').map(s => ({
          name: s.name,
          number: s.number
        })) || []
      }));
    } catch (err) {
      return [{ error: err.message }];
    }
  }

  /**
   * Analyze failure patterns
   */
  async analyzeFailures(repo, runId) {
    const [runDetails, logs] = await Promise.all([
      this.makeRequest(`/repos/${this.org}/${repo}/actions/runs/${runId}`).catch(() => null),
      this.getRunLogs(repo, runId)
    ]);

    const commonPatterns = [
      { pattern: /npm|yarn|pnpm|bun/, type: 'dependency_install', fix: 'Clear cache and reinstall' },
      { pattern: /pytest|jest|mocha|vitest/, type: 'test_failure', fix: 'Check test assertions' },
      { pattern: /lint|eslint|prettier|black/, type: 'lint_error', fix: 'Run formatter' },
      { pattern: /build|compile|tsc|webpack/, type: 'build_error', fix: 'Check build config' },
      { pattern: /deploy|docker|kubectl/, type: 'deploy_error', fix: 'Check deployment credentials' },
      { pattern: /timeout|timed out/, type: 'timeout', fix: 'Increase timeout or optimize' }
    ];

    const detectedPatterns = [];
    const runName = runDetails?.name || '';
    
    for (const p of commonPatterns) {
      if (p.pattern.test(runName)) {
        detectedPatterns.push(p);
      }
    }

    return {
      runId,
      repo,
      patterns: detectedPatterns,
      failedJobs: logs,
      suggestedFix: detectedPatterns[0]?.fix || 'Manual investigation required',
      autoRepairable: detectedPatterns.some(p => 
        ['lint_error', 'dependency_install'].includes(p.type)
      )
    };
  }

  /**
   * Check for failures and create repair tasks
   */
  async checkAndCreateRepairs(repo, since = null) {
    const failures = await this.getFailedRuns(repo, since);
    
    const repairs = [];
    for (const failure of failures.slice(0, 5)) {
      const analysis = await this.analyzeFailures(repo, failure.id);
      
      repairs.push({
        originalFailure: failure,
        analysis,
        repairTask: {
          type: 'build_failure_repair',
          priority: analysis.autoRepairable ? 7 : 5,
          payload: {
            repo,
            runId: failure.id,
            runName: failure.name,
            branch: failure.branch,
            commitSha: failure.commitSha,
            patterns: analysis.patterns.map(p => p.type),
            suggestedFix: analysis.suggestedFix,
            autoRepairable: analysis.autoRepairable,
            logsUrl: failure.logsUrl
          }
        }
      });
    }

    return {
      repo,
      timestamp: new Date().toISOString(),
      failureCount: failures.length,
      repairs,
      tasksToQueue: repairs.map(r => r.repairTask)
    };
  }

  /**
   * Monitor all repos for failures
   */
  async monitorAll(repos = null) {
    const targetRepos = repos || [
      'supreme-ai-deployment-hub',
      'central-orchestrator',
      'openclaw-gateway'
    ];

    const results = {
      timestamp: new Date().toISOString(),
      org: this.org,
      totalFailures: 0,
      autoRepairable: 0,
      repos: {},
      allRepairTasks: []
    };

    for (const repo of targetRepos) {
      try {
        const check = await this.checkAndCreateRepairs(repo);
        results.repos[repo] = check;
        results.totalFailures += check.failureCount;
        results.autoRepairable += check.repairs.filter(r => r.analysis.autoRepairable).length;
        results.allRepairTasks.push(...check.tasksToQueue);
      } catch (err) {
        results.repos[repo] = { error: err.message };
      }
    }

    return results;
  }
}

/**
 * Execute repair router task
 */
export async function executeRepairRouter(payload) {
  const router = new RepairRouter(payload.token, payload.org);
  
  switch (payload.action) {
    case 'failed_runs':
      return await router.getFailedRuns(payload.repo, payload.since);
    
    case 'analyze':
      return await router.analyzeFailures(payload.repo, payload.runId);
    
    case 'check_repairs':
      return await router.checkAndCreateRepairs(payload.repo, payload.since);
    
    case 'monitor_all':
      return await router.monitorAll(payload.repos);
    
    default:
      throw new Error(`Unknown action: ${payload.action}`);
  }
}

export { RepairRouter };
export default RepairRouter;
