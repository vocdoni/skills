/**
 * pi-subagent MCP server.
 *
 * Exposes tools that let Claude Code delegate bounded coding tasks to Pi (pi --mode rpc),
 * isolated in git worktrees, and read back compact summaries + diff paths.
 *
 * NOTE: stdout is the MCP transport. All diagnostics go to stderr only.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { loadConfig } from "./config";
import { PiTaskManager, type RunAgentParams, type StartTaskParams } from "./pi-task-manager";
import { formatResultText } from "./result-format";
import {
  applyResultShape,
  cancelShape,
  cleanupShape,
  followUpShape,
  getResultShape,
  getStatusShape,
  listAgentsShape,
  listTasksShape,
  runAgentShape,
  startTaskShape,
  steerShape,
} from "./schemas";
import type { TaskResult } from "./types";

function textResult(text: string): CallToolResult {
  return { content: [{ type: "text", text }] };
}

function jsonResult(label: string, value: unknown): CallToolResult {
  return textResult(`${label}\n\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``);
}

function resultToContent(result: TaskResult): CallToolResult {
  return textResult(formatResultText(result));
}

function errorResult(err: unknown): CallToolResult {
  const message = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
}

function main(): Promise<void> {
  const config = loadConfig();
  const manager = new PiTaskManager(config);
  const server = new McpServer({ name: "pi-subagent", version: "0.2.0" });

  server.registerTool(
    "pi_list_agents",
    {
      title: "List pi-agents",
      description:
        "List the named pi-agents available to delegate to. Each agent is an .md definition (persona + model + " +
        "tools) discovered from the configured agent directories (by default ~/.pi/agents and the project's " +
        ".pi/agents). Use this to discover agents before calling pi_run_agent.",
      inputSchema: listAgentsShape,
    },
    async () => {
      try {
        const agents = await manager.listAgents();
        return jsonResult(`${agents.length} pi-agent(s) available.`, agents);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "pi_run_agent",
    {
      title: "Run a named pi-agent",
      description:
        "Delegate to a named pi-agent: launch Pi configured as that agent (its model, system prompt, and tools — " +
        "including any MCP tools) and run it against `input` (e.g. a name, term, or topic). Returns the agent's " +
        "summary plus artifact paths. Example: agent 'web-scout', input 'Vocdoni' → a researched summary. " +
        "Agents that can edit files run in an isolated git worktree; read-only agents run in place. Blocks until " +
        "done unless `background` is set. Discover agents with pi_list_agents.",
      inputSchema: runAgentShape,
    },
    async (args) => {
      try {
        return resultToContent(await manager.runAgent(args as RunAgentParams));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "pi_run_task",
    {
      title: "Run a Pi task (blocking)",
      description:
        "Delegate a bounded coding task to Pi and wait for it to finish, returning a compact summary, " +
        "the changed-file list, and a path to the full diff. Pi runs in an isolated detached git worktree " +
        "by default; changes are NEVER applied to your project automatically. Choose mode: ask/review/plan " +
        "are read-only (tools: read,grep,find,ls); patch/test may edit files inside the worktree " +
        "(tools: read,grep,find,ls,edit,write,bash). Best for tasks short enough to finish within the timeout.",
      inputSchema: startTaskShape,
    },
    async (args) => {
      try {
        return resultToContent(await manager.runTask(args as StartTaskParams));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "pi_start_task",
    {
      title: "Start a Pi task (non-blocking)",
      description:
        "Start a Pi task and return immediately with a task id and 'running' status. Poll with pi_get_status " +
        "and read the outcome with pi_get_result. Same modes and worktree isolation as pi_run_task. Use this for " +
        "longer tasks or to run several tasks in parallel (up to the configured max).",
      inputSchema: startTaskShape,
    },
    async (args) => {
      try {
        return resultToContent(await manager.startTask(args as StartTaskParams));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "pi_get_status",
    {
      title: "Get Pi task status",
      description:
        "Return the live status of a task: running/completed/failed/cancelled/timeout, whether Pi is currently " +
        "streaming, elapsed time, a preview of Pi's latest output, and recent tool activity.",
      inputSchema: getStatusShape,
    },
    async (args) => {
      try {
        const status = manager.getStatus(args.taskId);
        return jsonResult(`Pi task ${status.taskId} — ${status.status}`, status);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "pi_get_result",
    {
      title: "Get Pi task result",
      description:
        "Return the full structured result for a task: summary, last assistant text, changed files, worktree path, " +
        "diff path, a truncated diff preview, and artifact paths. Inspect the diff yourself before trusting or applying it.",
      inputSchema: getResultShape,
    },
    async (args) => {
      try {
        return resultToContent(manager.getResult(args.taskId, args.maxDiffChars));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "pi_steer",
    {
      title: "Steer a running Pi task",
      description:
        "Inject a steering instruction into a task that is currently running, to correct course mid-run without " +
        "restarting. Only valid while the task is streaming.",
      inputSchema: steerShape,
    },
    async (args) => {
      try {
        return jsonResult("Steering message delivered.", await manager.steer(args.taskId, args.message));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "pi_follow_up",
    {
      title: "Follow up on a Pi task",
      description:
        "Send a follow-up instruction on a task's existing Pi session (preserving its context). If the task is idle, " +
        "this starts a new run and waits for it to finish; if it is still running, the message is queued. Returns the " +
        "updated result.",
      inputSchema: followUpShape,
    },
    async (args) => {
      try {
        return resultToContent(await manager.followUp(args.taskId, args.message, args.timeoutSeconds, args.maxDiffChars));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "pi_cancel",
    {
      title: "Cancel a Pi task",
      description:
        "Abort a running task and stop its Pi process. Any changes made so far in the worktree are still captured as a " +
        "diff; run artifacts are kept until pi_cleanup.",
      inputSchema: cancelShape,
    },
    async (args) => {
      try {
        return resultToContent(await manager.cancel(args.taskId));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "pi_list_tasks",
    {
      title: "List Pi tasks",
      description: "List all known tasks this session with their status, mode, changed-file count, and worktree path.",
      inputSchema: listTasksShape,
    },
    async () => {
      try {
        const tasks = manager.listTasks();
        return jsonResult(`${tasks.length} task(s).`, tasks);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "pi_cleanup",
    {
      title: "Clean up Pi tasks",
      description:
        "Remove finished tasks: stop their Pi process, remove the git worktree, and delete the run directory under " +
        ".claude/pi-runs. Pass a taskId to clean one task, or omit it to clean all non-running tasks. Running tasks are skipped.",
      inputSchema: cleanupShape,
    },
    async (args) => {
      try {
        const summary = await manager.cleanup(args.taskId, args.removeWorktree ?? true);
        return jsonResult("Cleanup complete.", summary);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  if (config.allowApply) {
    server.registerTool(
      "pi_apply_result",
      {
        title: "Apply a Pi task's diff",
        description:
          "Apply a completed task's diff.patch into your project working tree via `git apply --3way`. Disabled unless the " +
          "plugin's allow_apply_tool setting is enabled. Review the diff first — never assume Pi's patch is correct.",
        inputSchema: applyResultShape,
      },
      async (args) => {
        try {
          return jsonResult("Patch applied.", await manager.applyResult(args.taskId));
        } catch (err) {
          return errorResult(err);
        }
      },
    );
  }

  // Graceful shutdown: kill any live Pi processes.
  let shuttingDown = false;
  const shutdown = (): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    void manager.shutdown().finally(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  const transport = new StdioServerTransport();
  transport.onclose = shutdown;

  process.stderr.write(
    `pi-subagent MCP server starting (project=${config.projectDir}, pi=${config.piPath}, ` +
      `maxParallel=${config.maxParallel}, worktrees=${config.useWorktrees}, applyTool=${config.allowApply})\n`,
  );

  return server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`pi-subagent fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exit(1);
});
