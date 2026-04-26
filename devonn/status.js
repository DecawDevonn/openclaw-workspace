#!/usr/bin/env node
const API_URL = process.env.DEVONN_API_URL || 'http://localhost:7373';

const COLORS = {
  reset: '\x1b[0m', bright: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m'
};

function color(name, text) { return COLORS[name] + text + COLORS.reset; }
function statusEmoji(status) {
  const map = { healthy: '✅', warning: '⚠️', critical: '🔴', running: '🟢', stopped: '⏹️', pending: '⏳', completed: '✅', failed: '❌' };
  return map[status] || '⚪';
}

async function fetchStatus() {
  try {
    const res = await fetch(`${API_URL}/status`);
    return await res.json();
  } catch (error) {
    console.log(color('red', `❌ Cannot connect to scheduler API at ${API_URL}`));
    console.log(color('dim', `   ${error.message}`));
    process.exit(1);
  }
}

async function fetchQueue() {
  try { return await (await fetch(`${API_URL}/queue`)).json(); } catch { return null; }
}

async function fetchEcosystem() {
  try { return await (await fetch(`${API_URL}/ecosystem`)).json(); } catch { return null; }
}

function formatDuration(ms) {
  if (ms < 1000) return ms + 'ms';
  if (ms < 60000) return Math.floor(ms / 1000) + 's';
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return mins + 'm ' + secs + 's';
}

function fmtNum(n, d=1) { return (n || 0).toFixed(d); }

async function showStatus() {
  const data = await fetchStatus();
  const queue = await fetchQueue();
  const ecosystem = await fetchEcosystem();

  console.log();
  console.log(color('bright', '╔══════════════════════════════════════════════════════════╗'));
  console.log(color('bright', '║           DEVONN.ai Scheduler Dashboard                  ║'));
  console.log(color('bright', '╚══════════════════════════════════════════════════════════╝'));
  console.log();

  console.log(color('cyan', '┌─ Scheduler Status'));
  console.log(color('cyan', '│'));
  const s = data.scheduler; const h = data.health;
  console.log(`│  ${statusEmoji(s.running ? 'running' : 'stopped')}  Status:     ${s.running ? color('green', 'RUNNING') : color('red', 'STOPPED')}`);
  console.log(`│  ⏱️   Uptime:     ${color('bright', formatDuration(s.uptime.ms))}`);
  console.log(`│  🔄  Ticks:       ${(s.tickCount || 0).toLocaleString()}`);
  console.log(`│  ⚡  Max Workers: ${s.maxConcurrent}`);
  console.log(color('cyan', '│'));
  const healthStatus = h?.status || 'unknown';
  const healthColor = healthStatus === 'healthy' ? 'green' : (healthStatus === 'warning' ? 'yellow' : 'red');
  console.log(`│  ${statusEmoji(healthStatus)}  Health:     ${color(healthColor, healthStatus.toUpperCase())}`);
  console.log(`│  💻  CPU:         ${fmtNum(h?.cpu)}%`);
  console.log(`│  🧠  Memory:      ${fmtNum(h?.memory)}%`);
  if (h?.failureRate > 0) console.log(`│  📉  Failure Rate: ${(h.failureRate * 100).toFixed(1)}%`);
  console.log(color('cyan', '└'));
  console.log();

  console.log(color('magenta', '┌─ Queue Status'));
  console.log(color('magenta', '│'));
  const q = data.queue;
  console.log(`│  📥  Queued:   ${color('bright', (q?.queued || 0).toString())}`);
  console.log(`│  🏃  Active:   ${color('bright', (q?.active || 0).toString())}`);
  console.log(`│  📊  Total:    ${q?.total || 0}`);
  if (queue && queue.summary) {
    const stats = queue.summary;
    console.log(color('magenta', '│'));
    console.log(`│  📋  Pending:   ${stats.pending || 0}`);
    console.log(`│  ✅  Completed: ${stats.completed || 0}`);
    console.log(`│  ❌  Failed:    ${stats.failed || 0}`);
  }
  console.log(color('magenta', '└'));
  console.log();

  if (queue && queue.running?.length > 0) {
    console.log(color('yellow', '┌─ Running Tasks'));
    queue.running.forEach(t => { console.log(color('yellow', '│')); console.log(`│  🏃 ${(t.id || '').slice(0, 25)} ${t.type} (P${t.priority})`); });
    console.log(color('yellow', '└'));
    console.log();
  }

  if (queue && queue.failed?.length > 0) {
    console.log(color('red', '┌─ Recent Failures'));
    queue.failed.slice(0, 5).forEach(t => { console.log(color('red', '│')); console.log(`│  ❌ ${(t.id || '').slice(0, 25)} ${t.type}`); if (t.error) console.log(`│     ${color('dim', (t.error || '').slice(0, 40))}`); });
    console.log(color('red', '└'));
    console.log();
  }

  if (ecosystem) {
    console.log(color('blue', '┌─ Ecosystem Connection'));
    console.log(color('blue', '│'));
    const mode = ecosystem.mode;
    console.log(`│  ${statusEmoji(mode === 'connected' ? 'running' : 'stopped')}  Mode: ${mode === 'connected' ? color('green', 'CONNECTED') : color('dim', 'STANDALONE')}`);
    if (mode === 'connected' && ecosystem.connector) {
      const c = ecosystem.connector;
      console.log(`│  🌐  Orchestrator: ${(c.orchestratorUrl || '').slice(0, 35)}`);
      console.log(`│  🔗  Gateway:      ${(c.gatewayUrl || '').slice(0, 35)}`);
      console.log(`│  🏢  Organization: ${c.organization}`);
      console.log(`│  ⏱️   Poll Interval: ${c.pollInterval}ms`);
    }
    console.log(color('blue', '│'));
    const env = ecosystem.environment;
    console.log(`│  🔑  GitHub Token:  ${env?.GITHUB_TOKEN === 'set' ? color('green', '✓') : color('red', '✗')}`);
    console.log(`│  🌐  Orchestrator:  ${env?.ORCHESTRATOR_URL === 'set' ? color('green', '✓') : color('red', '✗')}`);
    console.log(`│  🔗  Gateway:       ${env?.GATEWAY_URL === 'set' ? color('green', '✓') : color('red', '✗')}`);
    console.log(color('blue', '└'));
    console.log();
  }

  console.log(color('dim', `Last updated: ${new Date(data.timestamp).toLocaleString()}`));
  console.log();
}

async function showHelp() {
  console.log(color('bright', '\nDEVONN Scheduler Status CLI\n'));
  console.log('Usage: node status.js [command]\n');
  console.log('Commands:');
  console.log('  status    Show full dashboard (default)');
  console.log('  queue     Show queue details');
  console.log('  tasks     List recent tasks');
  console.log('  metrics   Show performance metrics');
  console.log('  health    Quick health check');
  console.log('  help      Show this help\n');
  console.log('Environment:');
  console.log('  DEVONN_API_URL   API endpoint (default: http://localhost:7373)\n');
}

async function showQueue() { console.log(JSON.stringify(await fetchQueue(), null, 2)); }
async function showTasks() { console.log(JSON.stringify(await (await fetch(`${API_URL}/tasks?limit=20`)).json(), null, 2)); }
async function showMetrics() { console.log(JSON.stringify(await (await fetch(`${API_URL}/metrics`)).json(), null, 2)); }
async function healthCheck() {
  try {
    const res = await fetch(`${API_URL}/health`);
    const data = await res.json();
    if (res.ok && data.healthy) { console.log(color('green', '✅ Scheduler is healthy')); process.exit(0); }
    else { console.log(color('red', '❌ Scheduler is unhealthy')); process.exit(1); }
  } catch (err) { console.log(color('red', '❌ Cannot reach scheduler')); process.exit(1); }
}

const cmd = process.argv[2] || 'status';
if (cmd === 'status') showStatus();
else if (cmd === 'queue') showQueue();
else if (cmd === 'tasks') showTasks();
else if (cmd === 'metrics') showMetrics();
else if (cmd === 'health') healthCheck();
else showHelp();
