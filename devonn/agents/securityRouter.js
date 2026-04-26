#!/usr/bin/env node
/**
 * Security Router Agent
 * Routes Snyk/GitHub security alerts into the task queue
 */

const GITHUB_API = 'https://api.github.com';

class SecurityRouter {
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
        'User-Agent': 'Devonn-SecurityRouter'
      }
    });
    
    if (!res.ok) {
      throw new Error(`GitHub API error: ${res.status}`);
    }
    
    return await res.json();
  }

  /**
   * Fetch Dependabot alerts for a repo
   */
  async getDependabotAlerts(repo) {
    try {
      const data = await this.makeRequest(`/repos/${this.org}/${repo}/dependabot/alerts?state=open&per_page=50`);
      
      return data.map(alert => ({
        id: alert.number,
        severity: alert.security_advisory?.severity || 'unknown',
        package: alert.dependency?.package?.name,
        vulnerableVersion: alert.dependency?.vulnerable_version_range,
        patchedVersion: alert.security_advisory?.patched_versions?.[0],
        description: alert.security_advisory?.summary,
        createdAt: alert.created_at,
        url: alert.html_url
      }));
    } catch (err) {
      // Dependabot alerts may not be enabled
      return [];
    }
  }

  /**
   * Fetch code scanning alerts
   */
  async getCodeScanningAlerts(repo) {
    try {
      const data = await this.makeRequest(`/repos/${this.org}/${repo}/code-scanning/alerts?state=open&per_page=50`);
      
      return data.map(alert => ({
        id: alert.number,
        severity: alert.rule?.severity || 'unknown',
        rule: alert.rule?.id,
        description: alert.rule?.description,
        path: alert.most_recent_instance?.location?.path,
        createdAt: alert.created_at,
        url: alert.html_url
      }));
    } catch (err) {
      // Code scanning may not be enabled
      return [];
    }
  }

  /**
   * Get security overview for a repo
   */
  async getSecurityOverview(repo) {
    const [dependabot, codeScanning] = await Promise.all([
      this.getDependabotAlerts(repo).catch(() => []),
      this.getCodeScanningAlerts(repo).catch(() => [])
    ]);

    const critical = [...dependabot, ...codeScanning].filter(a => a.severity === 'critical');
    const high = [...dependabot, ...codeScanning].filter(a => a.severity === 'high');
    const medium = [...dependabot, ...codeScanning].filter(a => a.severity === 'medium');
    const low = [...dependabot, ...codeScanning].filter(a => a.severity === 'low');

    return {
      repo,
      timestamp: new Date().toISOString(),
      summary: {
        critical: critical.length,
        high: high.length,
        medium: medium.length,
        low: low.length,
        total: dependabot.length + codeScanning.length
      },
      alerts: {
        dependabot,
        codeScanning
      },
      tasksToCreate: [
        ...critical.map(a => ({
          type: 'security_fix',
          priority: 10,
          payload: {
            repo,
            alertId: a.id,
            severity: a.severity,
            package: a.package,
            description: a.description,
            autoFix: a.patchedVersion ? true : false
          }
        })),
        ...high.map(a => ({
          type: 'security_fix',
          priority: 8,
          payload: {
            repo,
            alertId: a.id,
            severity: a.severity,
            package: a.package,
            description: a.description
          }
        }))
      ]
    };
  }

  /**
   * Scan all repos for security issues
   */
  async scanAll(repos = null) {
    const targetRepos = repos || [
      'supreme-ai-deployment-hub',
      'central-orchestrator',
      'openclaw-gateway'
    ];

    const results = {
      timestamp: new Date().toISOString(),
      org: this.org,
      totalCritical: 0,
      totalHigh: 0,
      repos: {},
      allTasks: []
    };

    for (const repo of targetRepos) {
      try {
        const overview = await this.getSecurityOverview(repo);
        results.repos[repo] = overview;
        results.totalCritical += overview.summary.critical;
        results.totalHigh += overview.summary.high;
        results.allTasks.push(...overview.tasksToCreate);
      } catch (err) {
        results.repos[repo] = { error: err.message };
      }
    }

    return results;
  }
}

/**
 * Execute security scan task
 */
export async function executeSecurityScan(payload) {
  const router = new SecurityRouter(payload.token, payload.org);
  
  switch (payload.action) {
    case 'dependabot':
      return await router.getDependabotAlerts(payload.repo);
    
    case 'code_scanning':
      return await router.getCodeScanningAlerts(payload.repo);
    
    case 'repo_overview':
      return await router.getSecurityOverview(payload.repo);
    
    case 'scan_all':
      return await router.scanAll(payload.repos);
    
    default:
      throw new Error(`Unknown action: ${payload.action}`);
  }
}

export { SecurityRouter };
export default SecurityRouter;
